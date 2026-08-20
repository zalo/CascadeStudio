/**
 * Python language intelligence for the Monaco editor, powered by
 * basedpyright running entirely in the browser (browser-basedpyright's
 * self-contained worker bundle, copied to dist/pyright/ by the build).
 *
 * The worker speaks LSP over postMessage (vscode-jsonrpc/browser); this
 * module is a minimal client modeled on basedpyright-playground's LspClient:
 *   - boots the foreground worker and relays its background-worker spawns
 *     (the `browser/boot` / `browser/newWorker` protocol from the
 *     micro:bit pyright fork — nested workers don't exist on Safari, so the
 *     main thread creates them and hands over a MessagePort),
 *   - seeds the in-memory filesystem with the user document, a
 *     pyrightconfig.json, and the build123d-lite stubs (fetched as one JSON
 *     from typedefs/python-stubs.json),
 *   - registers Monaco providers (hover, completion, signature help) and
 *     forwards publishDiagnostics to setModelMarkers.
 *
 * Everything is lazy: nothing here runs until the first entry into Python
 * mode, so JS/OpenSCAD users pay zero bytes.
 */

import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
} from 'vscode-jsonrpc/browser';

const DOC_URI = 'file:///src/main.py';
const DOC_PATH = '/src/main.py';
const WORKER_URL = './pyright/pyright.worker.js';
const STUBS_URL = './typedefs/python-stubs.json';
const MARKER_OWNER = 'basedpyright';
const CHANGE_DEBOUNCE_MS = 400;

/** basedpyright is stricter than pyright by default; these settings keep the
 *  diagnostics honest but beginner-friendly for CAD scripts. */
const PYRIGHT_CONFIG = {
  typeshedPath: '/typeshed',
  stubPath: '/typings',
  typeCheckingMode: 'standard',
  pythonVersion: '3.13',
  pythonPlatform: 'All',
  reportMissingModuleSource: false,
  // CAD scripts legitimately hold intermediate results they never read, and
  // a bare `shape.label` style expression shouldn't be an error-level lint.
  reportUnusedExpression: 'warning',
  reportUnusedVariable: 'none',
};

/** LSP CompletionItemKind (1-25) → monaco.languages.CompletionItemKind */
function completionKind(monaco, lspKind) {
  const K = monaco.languages.CompletionItemKind;
  const map = {
    1: K.Text, 2: K.Method, 3: K.Function, 4: K.Constructor, 5: K.Field,
    6: K.Variable, 7: K.Class, 8: K.Interface, 9: K.Module, 10: K.Property,
    11: K.Unit, 12: K.Value, 13: K.Enum, 14: K.Keyword, 15: K.Snippet,
    16: K.Color, 17: K.File, 18: K.Reference, 19: K.Folder, 20: K.EnumMember,
    21: K.Constant, 22: K.Struct, 23: K.Event, 24: K.Operator, 25: K.TypeParameter,
  };
  return map[lspKind] ?? K.Text;
}

/** LSP DiagnosticSeverity → monaco MarkerSeverity */
function markerSeverity(monaco, lspSeverity) {
  const S = monaco.MarkerSeverity;
  return { 1: S.Error, 2: S.Warning, 3: S.Info, 4: S.Hint }[lspSeverity] ?? S.Error;
}

function toMarkdownString(contents) {
  if (!contents) { return ''; }
  if (typeof contents === 'string') { return contents; }
  if (Array.isArray(contents)) { return contents.map(toMarkdownString).join('\n\n'); }
  return contents.value || '';
}

export class PythonLanguageProvider {
  /** @param {object} app the CascadeStudioApp (for the editor manager) */
  constructor(app) {
    this._app = app;
    this._connection = null;
    this._workers = [];
    this._disposables = [];
    this._docVersion = 1;
    this._changeTimer = null;
    this._initPromise = null;
  }

  /** Idempotent async bootstrap; safe to call on every Python-mode entry. */
  init() {
    if (!this._initPromise) {
      this._initPromise = this._boot().catch(err => {
        this._initPromise = null; // allow retry on the next mode switch
        console.warn('Python IntelliSense unavailable: ' + err.message);
        throw err;
      });
    }
    return this._initPromise;
  }

  get _editor() { return this._app.editor && this._app.editor.editor; }

  async _boot() {
    const monaco = window.monaco;
    const stubsResp = await fetch(STUBS_URL);
    if (!stubsResp.ok) { throw new Error('failed to fetch Python stubs (' + stubsResp.status + ')'); }
    const stubs = await stubsResp.json();

    // Foreground worker + background-worker relay (Safari-safe protocol).
    const worker = new Worker(WORKER_URL);
    this._workers.push(worker);
    worker.addEventListener('message', (e) => {
      const d = e.data;
      if (d && d.type === 'browser/newWorker') {
        const bg = new Worker(WORKER_URL);
        this._workers.push(bg);
        bg.postMessage({ type: 'browser/boot', mode: 'background', initialData: d.initialData, port: d.port }, [d.port]);
      }
    });
    worker.postMessage({ type: 'browser/boot', mode: 'foreground' });

    const connection = createMessageConnection(
      new BrowserMessageReader(worker),
      new BrowserMessageWriter(worker)
    );
    this._connection = connection;
    connection.onError(() => { /* non-JSONRPC boot messages are expected */ });
    connection.onRequest('workspace/configuration', () => []);
    connection.onRequest('client/registerCapability', () => null);
    connection.onNotification('textDocument/publishDiagnostics', p => this._onDiagnostics(p));
    connection.listen();

    const files = { [DOC_PATH]: this._currentCode() };
    files['/src/pyrightconfig.json'] = JSON.stringify(PYRIGHT_CONFIG);
    for (const [rel, content] of Object.entries(stubs)) {
      files['/typings/' + rel] = content;
    }

    await connection.sendRequest('initialize', {
      processId: null,
      rootPath: '/src',
      rootUri: 'file:///src',
      workspaceFolders: [{ name: 'src', uri: 'file:///src' }],
      initializationOptions: { files },
      capabilities: {
        textDocument: {
          publishDiagnostics: { tagSupport: { valueSet: [1, 2] }, versionSupport: true },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
              parameterInformation: { labelOffsetSupport: true },
              activeParameterSupport: true,
            },
          },
          completion: {
            completionItem: {
              snippetSupport: false,
              documentationFormat: ['markdown', 'plaintext'],
            },
            completionItemKind: { valueSet: Array.from({ length: 25 }, (_, i) => i + 1) },
          },
        },
        workspace: { didChangeConfiguration: { dynamicRegistration: true } },
      },
    });
    connection.sendNotification('initialized', {});
    connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
    connection.sendNotification('textDocument/didOpen', {
      textDocument: { uri: DOC_URI, languageId: 'python', version: this._docVersion, text: this._currentCode() },
    });

    this._registerProviders(monaco);
    this._watchModel();
  }

  _currentCode() {
    return this._editor ? this._editor.getValue() : '';
  }

  _isPythonActive() {
    const editor = this._editor;
    const model = editor && editor.getModel();
    return !!(model && model.getLanguageId() === 'python');
  }

  /** Push the current editor content to the server (debounced callers). */
  sync() {
    if (!this._connection) { return; }
    this._docVersion++;
    this._connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: DOC_URI, version: this._docVersion },
      contentChanges: [{ text: this._currentCode() }],
    });
  }

  _watchModel() {
    const editor = this._editor;
    if (!editor) { return; }
    this._disposables.push(editor.onDidChangeModelContent(() => {
      if (!this._isPythonActive()) { return; }
      clearTimeout(this._changeTimer);
      this._changeTimer = setTimeout(() => this.sync(), CHANGE_DEBOUNCE_MS);
    }));
  }

  _onDiagnostics(params) {
    const monaco = window.monaco;
    if (params.uri !== DOC_URI) { return; }
    const editor = this._editor;
    const model = editor && editor.getModel();
    if (!model) { return; }
    // Leaving Python mode clears the markers instead of painting stale ones
    // onto the JS/OpenSCAD document.
    const markers = this._isPythonActive() ? params.diagnostics.map(d => ({
      severity: markerSeverity(monaco, d.severity),
      message: d.message,
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      code: typeof d.code === 'object' && d.code ? String(d.code.value) : (d.code != null ? String(d.code) : undefined),
      source: d.source,
    })) : [];
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }

  clearMarkers() {
    const monaco = window.monaco;
    const editor = this._editor;
    const model = editor && editor.getModel();
    if (model) { monaco.editor.setModelMarkers(model, MARKER_OWNER, []); }
  }

  _lspPosition(position) {
    return { line: position.lineNumber - 1, character: position.column - 1 };
  }

  _registerProviders(monaco) {
    const textDocument = { uri: DOC_URI };

    this._disposables.push(monaco.languages.registerHoverProvider('python', {
      provideHover: async (model, position) => {
        const r = await this._request('textDocument/hover', {
          textDocument, position: this._lspPosition(position),
        });
        if (!r || !r.contents) { return null; }
        const value = toMarkdownString(r.contents);
        if (!value) { return null; }
        return {
          contents: [{ value }],
          range: r.range && new monaco.Range(
            r.range.start.line + 1, r.range.start.character + 1,
            r.range.end.line + 1, r.range.end.character + 1),
        };
      },
    }));

    this._disposables.push(monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', '[', '"', "'"],
      provideCompletionItems: async (model, position) => {
        const r = await this._request('textDocument/completion', {
          textDocument, position: this._lspPosition(position),
        });
        const items = (r && (r.items || r)) || [];
        if (!Array.isArray(items)) { return { suggestions: [] }; }
        const word = model.getWordUntilPosition(position);
        const defaultRange = new monaco.Range(
          position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          incomplete: !!(r && r.isIncomplete),
          suggestions: items.map(item => {
            let range = defaultRange;
            let insertText = item.insertText || item.label;
            const edit = item.textEdit;
            if (edit && edit.range) {
              insertText = edit.newText;
              range = new monaco.Range(
                edit.range.start.line + 1, edit.range.start.character + 1,
                edit.range.end.line + 1, edit.range.end.character + 1);
            }
            return {
              label: item.label,
              kind: completionKind(monaco, item.kind),
              detail: item.detail,
              documentation: item.documentation && { value: toMarkdownString(item.documentation) },
              sortText: item.sortText,
              filterText: item.filterText,
              insertText, range,
              _lsp: item,
            };
          }),
        };
      },
      resolveCompletionItem: async (item) => {
        if (!item._lsp) { return item; }
        try {
          const resolved = await this._request('completionItem/resolve', item._lsp);
          if (resolved) {
            item.detail = resolved.detail || item.detail;
            if (resolved.documentation) {
              item.documentation = { value: toMarkdownString(resolved.documentation) };
            }
          }
        } catch (e) { /* completion still usable unresolved */ }
        return item;
      },
    }));

    this._disposables.push(monaco.languages.registerSignatureHelpProvider('python', {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (model, position) => {
        const r = await this._request('textDocument/signatureHelp', {
          textDocument, position: this._lspPosition(position),
        });
        if (!r || !r.signatures || !r.signatures.length) { return null; }
        return {
          value: {
            signatures: r.signatures.map(s => ({
              label: s.label,
              documentation: s.documentation && { value: toMarkdownString(s.documentation) },
              parameters: (s.parameters || []).map(p => ({
                label: p.label,
                documentation: p.documentation && { value: toMarkdownString(p.documentation) },
              })),
              activeParameter: s.activeParameter,
            })),
            activeSignature: r.activeSignature || 0,
            activeParameter: r.activeParameter || 0,
          },
          dispose: () => {},
        };
      },
    }));
  }

  async _request(method, params) {
    if (!this._connection || !this._isPythonActive()) { return null; }
    try {
      return await this._connection.sendRequest(method, params);
    } catch (e) {
      return null;
    }
  }

  dispose() {
    clearTimeout(this._changeTimer);
    this.clearMarkers();
    for (const d of this._disposables) { try { d.dispose(); } catch (e) { /* already gone */ } }
    this._disposables = [];
    if (this._connection) { try { this._connection.dispose(); } catch (e) { /* noop */ } }
    this._connection = null;
    for (const w of this._workers) { w.terminate(); }
    this._workers = [];
    this._initPromise = null;
  }
}
