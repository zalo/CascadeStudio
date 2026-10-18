// RemoteCascadeEngine.js — CascadeEngine's API, evaluated by a remote
// EDITING SESSION (a Cloudflare Durable Object, examples/cloudflare-worker/
// src/session.js) instead of a local Web Worker.
//
// Nothing CAD-related loads in the page: no worker, no OpenCascade wasm, no
// Python runtime. Every evaluation POSTs the build123d source to
// `<endpoint>/session/<id>/render` and reads back a framed stream (phase
// events, then the result and the binary viewport mesh — MeshCodec.js). The
// session keeps the engine and its op cache warm between edits, so an edit
// only recomputes what it changed.
//
// The events match CascadeEngine's, in the same order: 'Progress' while the
// job runs (one per server phase), then 'log' per script log line, the GUI
// widget registrations, 'modelHistory', and 'resetWorking'. Script errors
// arrive as 'evalError' {message, line} with the Python line resolved from
// the traceback (the local worker throws them at the page instead).
//
// Two more, for the STREAMED mesh: the session meshes incrementally
// (IncrementalMesher.js — a face whose geometry it meshed before is reused,
// and if this page already holds it, only a reference is sent) and streams
// it in batches, unchanged faces first. 'meshBatch' {faces, edges, total?}
// fires per batch, so a viewport can draw them as they land; 'meshAbort'
// when a stream is thrown away. evaluate() still resolves with the whole
// mesh, in the session's order.

import { FRAME, FRAMES_CONTENT_TYPE, readFrames, frameJSON, unpackMesh } from './MeshCodec.js';

const PHASE_LABELS = {
  accepted: 'Waiting for the session',
  booting: 'Booting the remote engine',
  restoring: 'Restoring the session from storage',
  evaluating: 'Evaluating remotely',
  evaluated: 'Receiving the mesh',
  're-running': 'Re-running the last evaluation',
  exporting: 'Exporting',
};

const GUI_EVENTS = {
  slider: 'addSlider', button: 'addButton', checkbox: 'addCheckbox',
  textbox: 'addTextbox', dropdown: 'addDropdown',
};

const SESSION_KEY = 'cascade-remote-session';
// JSON bodies go out as text/plain: a CORS-safelisted type, so an editor on
// another origin makes "simple" requests with no preflight round trip (the
// session parses the body as JSON either way).
const POST_TYPE = 'text/plain;charset=UTF-8';

class RemoteCascadeEngine {
  /** @param {object} o
   *  @param {string} [o.endpoint]  base URL of the session Worker ('' = this
   *         origin)
   *  @param {string} [o.sessionId] defaults to one per browser tab (kept in
   *         sessionStorage, so a reload resumes the same warm session) */
  constructor({ endpoint = '', sessionId } = {}) {
    this._endpoint = String(endpoint || '').replace(/\/+$/, '');
    this._sessionId = sessionId || RemoteCascadeEngine.tabSessionId();
    this._ready = false;
    this._working = false;
    this._listeners = {};
    this._opNumber = 0;
    /** The last render's `session` report and timings (diagnostics/tests). */
    this.lastReport = null;
    // Face meshes the session sent, by id: an unchanged face comes back as
    // a reference to one of these (MeshCodec MESH frames). The id names THIS
    // cache to the session, so a reload starts it over.
    this._faceCache = new Map();
    this._clientCacheId = RemoteCascadeEngine.randomId();
    // CascadeMain exposes `messageBus.handlers` on window for old callers.
    this.messageBus = { handlers: {} };
  }

  static randomId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(9)),
      (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  }

  static tabSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) { id = RemoteCascadeEngine.randomId(); sessionStorage.setItem(SESSION_KEY, id); }
      return id;
    } catch (e) { return RemoteCascadeEngine.randomId(); }
  }

  get isRemote() { return true; }
  get endpoint() { return this._endpoint || location.origin; }
  get sessionId() { return this._sessionId; }
  get isReady() { return this._ready; }
  get isWorking() { return this._working; }

  _url(action) {
    return this._endpoint + '/session/' + encodeURIComponent(this._sessionId) + action;
  }

  /** Nothing to load: the engine lives in the session. */
  async init() { this._ready = true; }

  /** POST `body` to a framed session route. Streamed meshes arrive as
   *  MESH batches (each handed to `onBatch` as it lands, references resolved
   *  from the face cache) and a DONE frame. Returns {result, mesh, meshStats,
   *  meshBytes, wireBytes}; `mesh` is {faces, edges, shapeLines} in the
   *  session's (ShapeToMesh's) order, or null. */
  async _frames(action, body, { onPhase, onBatch } = {}) {
    const resp = await fetch(this._url(action), {
      method: 'POST',
      headers: { 'content-type': POST_TYPE },
      body: JSON.stringify(Object.assign({ meshStream: true, clientCache: this._clientCacheId }, body)),
    });
    const type = resp.headers.get('content-type') || '';
    if (!type.startsWith(FRAMES_CONTENT_TYPE)) {
      const text = await resp.text();
      let j = null;
      try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
      throw new Error((j && (j.error || (j.errors || []).join('\n')))
        || ('HTTP ' + resp.status + ' ' + text.slice(0, 200)));
    }
    let result = null; let f32 = null; let u32 = null;
    let wireBytes = 0; let meshBytes = 0;
    let batchMeta = null; let done = null; let missing = 0;
    const faces = []; const edges = [];
    const takeBatch = () => {
      const lists = unpackMesh(batchMeta.lists, f32, u32);
      const arrived = [];
      for (const f of lists.faces) {
        let face = f;
        if (f.ref) {
          const g = this._faceCache.get(f.id);
          if (!g) { missing++; continue; }
          face = Object.assign({ slot: f.slot, id: f.id, face_index: f.face_index, shape_index: f.shape_index }, g);
        } else if (f.id) {
          this._faceCache.set(f.id, { vertex_coord: f.vertex_coord, normal_coord: f.normal_coord,
            uv_coord: f.uv_coord, tri_indexes: f.tri_indexes, number_of_triangles: f.number_of_triangles });
        }
        faces[face.slot] = face;
        arrived.push(face);
      }
      for (const e of lists.edges) { edges[e.slot] = e; }
      if (onBatch) { onBatch({ faces: arrived, edges: lists.edges, total: batchMeta.total, reused: batchMeta.reused }); }
      batchMeta = null;
    };
    for await (const { kind, bytes, wireBytes: w } of readFrames(resp.body)) {
      wireBytes += w;
      if (kind === FRAME.PHASE) { if (onPhase) { onPhase(frameJSON(bytes)); } }
      else if (kind === FRAME.RESULT) { result = frameJSON(bytes); }
      else if (kind === FRAME.MESH) { batchMeta = frameJSON(bytes); f32 = null; u32 = null; }
      else if (kind === FRAME.F32) { f32 = new Float32Array(bytes.buffer, 0, bytes.byteLength / 4); meshBytes += bytes.byteLength; }
      else if (kind === FRAME.U32) {
        u32 = new Uint32Array(bytes.buffer, 0, bytes.byteLength / 4);
        meshBytes += bytes.byteLength;
        if (batchMeta) { takeBatch(); }
      } else if (kind === FRAME.DONE) { done = frameJSON(bytes); }
    }
    if (!result) { throw new Error('the session closed the stream without a result'); }
    let mesh = null;
    if (result.meshStream) {
      if (!done) { throw new Error('the mesh stream ended early'); }
      if (done.error) { throw new Error(done.error); }
      if (missing) {
        const err = new Error(missing + ' face(s) referenced that this page does not hold');
        err.code = 'mesh-cache-miss';
        throw err;
      }
      const keep = new Set(done.keep || []);
      for (const id of Array.from(this._faceCache.keys())) { if (!keep.has(id)) { this._faceCache.delete(id); } }
      mesh = { faces: faces.filter(Boolean), edges: edges.filter(Boolean),
        shapeLines: result.meshStream.shapeLines || [] };
    } else if (result.mesh) {
      mesh = unpackMesh(result.mesh.lists, f32 || new Float32Array(0), u32 || new Uint32Array(0));
      mesh.shapeLines = result.mesh.shapeLines || [];
    }
    return { result, mesh, meshStats: done && done.stats, meshBytes, wireBytes };
  }

  _progress(label) {
    this._emit('Progress', { opNumber: this._opNumber++, opType: label });
  }

  /** Evaluate build123d code in the session and return the viewport mesh.
   *  Returns { meshData: {faces, edges, shapeLines}, sceneOptions }. */
  async evaluate(code, { guiState = {}, maxDeviation, sceneOptions, language } = {}) {
    if (!this._ready) { throw new Error('RemoteCascadeEngine not initialized. Call init() first.'); }
    const scene = sceneOptions || {
      groundPlaneVisible: guiState['GroundPlane?'],
      gridVisible: guiState['Grid?'],
    };
    const finish = (meshData) => {
      this._working = false;
      this._emit('resetWorking');
      return { meshData, sceneOptions: meshData ? scene : {} };
    };
    // The editor writes progress over its LAST console line, so the phases
    // end before any log line of the result is emitted.
    const endProgress = () => this._emit('Progress', { opNumber: this._opNumber, opType: '' });
    if (language && language !== 'python') {
      this._emit('evalError', { message: 'This editor evaluates build123d (Python) in a remote '
        + 'session; ' + language + ' mode runs in the local editor only.', line: 0 });
      return finish(null);
    }

    this._working = true;
    this._opNumber = 0;
    this._progress(PHASE_LABELS.accepted);
    const t0 = performance.now();
    const request = {
      code,
      formats: ['mesh'],
      maxDeviation: maxDeviation || guiState['MeshRes'] || 0.1,
      gui: guiState,
    };
    let received = 0;
    this._meshTotal = 0;
    const handlers = {
      onPhase: (p) => this._progress(PHASE_LABELS[p.phase] || p.phase),
      // the faces as they are meshed: unchanged ones first, then the rest
      onBatch: (b) => {
        if (b.total !== undefined) { this._meshTotal = b.total; }
        received += b.faces.length;
        if (this._meshTotal) { this._progress('Meshing ' + received + '/' + this._meshTotal + ' faces'); }
        this._emit('meshBatch', b);
      },
    };
    let got;
    try {
      try {
        got = await this._frames('/render', request, handlers);
      } catch (err) {
        if (err.code !== 'mesh-cache-miss') { throw err; }
        // out of sync with the session: start a fresh cache and ask again
        this._faceCache.clear();
        this._clientCacheId = RemoteCascadeEngine.randomId();
        received = 0;
        this._emit('meshAbort');
        got = await this._frames('/render', request, handlers);
      }
    } catch (err) {
      endProgress();
      this._emit('meshAbort');
      this._emit('evalError', { message: 'Remote session: ' + err.message, line: 0 });
      return finish(null);
    }
    endProgress();
    const { result, mesh, meshStats, meshBytes, wireBytes } = got;
    const wallMs = Math.round(performance.now() - t0);

    for (const line of result.logs || []) { this._emit('log', line); }
    for (const message of result.errors || []) {
      this._emit('evalError', { message, line: RemoteCascadeEngine.pythonLine(message) });
    }
    for (const w of Object.values(result.guiWidgets || {})) {
      const type = GUI_EVENTS[w.kind];
      if (type) { this._emit(type, w); }
    }
    this._emit('modelHistory', result.historySteps || []);

    const s = result.session || {};
    const c = result.cache || {};
    this.lastReport = { wallMs, meshBytes, wireBytes, meshStats, session: s, cache: c,
      timings: result.timings, memory: result.memory, status: result.status };
    this._emit('log', 'Remote session ' + this._sessionId + ': '
      + (s.engineBooted ? 'booted a fresh engine, ' : '')
      + (s.warm ? 'warm' : (s.restore ? 'restored ' + s.restore.restored + ' cached ops from storage'
        : 'new working set'))
      + ', ' + (c.hits || 0) + ' cache hits / ' + (c.misses || 0) + ' misses'
      + (meshStats ? ', ' + meshStats.reused + '/' + meshStats.faces + ' faces unchanged' : '')
      + ', ' + wallMs + ' ms round trip');
    return finish(mesh);
  }

  /** Triangulate one step of the last evaluation's history. */
  async meshHistoryStep(stepIndex, maxDeviation = 0.1) {
    const request = { step: stepIndex, maxDeviation };
    let got;
    try {
      got = await this._frames('/history', request);
    } catch (err) {
      if (err.code !== 'mesh-cache-miss') { throw err; }
      this._faceCache.clear();
      this._clientCacheId = RemoteCascadeEngine.randomId();
      got = await this._frames('/history', request);
    }
    const { result, mesh } = got;
    if (!result.ok) { throw new Error((result.errors || []).join('\n') || 'history step failed'); }
    return mesh ? [mesh.faces, mesh.edges] : null;
  }

  /** The last evaluation's shape as STEP text. */
  async exportSTEP() { return this.exportText('step'); }

  /** 'step' | 'brep' | 'stl' text of the last evaluation's shape. */
  async exportText(format) {
    const resp = await fetch(this._url('/export'), {
      method: 'POST',
      headers: { 'content-type': POST_TYPE },
      body: JSON.stringify({ format }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      let j = null;
      try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
      throw new Error((j && (j.error || (j.errors || []).join('\n'))) || ('HTTP ' + resp.status));
    }
    return text;
  }

  /** The session's stats route (instance, isolate, storage, engine memory). */
  async memoryStats() {
    const resp = await fetch(this._url(''));
    return resp.json();
  }

  /** Forget the session: storage and the in-memory working set. */
  async deleteSession() {
    const resp = await fetch(this._url(''), { method: 'DELETE' });
    return resp.json();
  }

  _unsupported(what) {
    this._emit('evalError', { message: what + ' is not available in a remote session yet.', line: 0 });
  }
  importFiles() { this._unsupported('Importing STEP/IGES/STL files'); }
  async loadExternalFilesAwaited() { this._unsupported('import_step()'); return []; }
  loadPrexistingExternalFiles() { /* nothing is stored locally */ }
  clearExternalFiles() { /* nothing is stored locally */ }

  /** The innermost user-code line of a Python traceback in `message`. */
  static pythonLine(message) {
    let line = 0;
    const re = /File "(?:main|<stdin>|<string>)", line (\d+)/g;
    let m;
    while ((m = re.exec(String(message)))) { line = Number(m[1]); }
    return line;
  }

  on(event, handler) {
    if (!this._listeners[event]) { this._listeners[event] = []; }
    this._listeners[event].push(handler);
  }

  off(event, handler) {
    if (!this._listeners[event]) { return; }
    if (!handler) { delete this._listeners[event]; }
    else { this._listeners[event] = this._listeners[event].filter((h) => h !== handler); }
  }

  dispose() { this._ready = false; }

  _emit(event, ...args) {
    for (const handler of this._listeners[event] || []) { handler(...args); }
  }
}

export { RemoteCascadeEngine };
