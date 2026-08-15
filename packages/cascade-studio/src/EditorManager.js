// EditorManager.js - Monaco editor management

const monaco = window.monaco;

/** Which Python interpreter the worker should use for Python mode:
 *  'brython' (default, ~300 KB gz, boots in a few hundred ms) or the
 *  experimental 'pyodide' (real CPython on wasm — see
 *  test/b123d-validation/runtime-comparison.md for why it is not the
 *  default). Selected with `?pyruntime=pyodide` or, so it survives reloads,
 *  localStorage['cascade-py-runtime']. */
export function resolvePyRuntime() {
  try {
    const fromURL = new URLSearchParams(window.location.search).get('pyruntime');
    if (fromURL) { return fromURL === 'pyodide' ? 'pyodide' : 'brython'; }
    const stored = window.localStorage.getItem('cascade-py-runtime');
    if (stored === 'pyodide') { return 'pyodide'; }
  } catch (e) { /* no URL/storage access — fall through to the default */ }
  return 'brython';
}

/** Manages the Monaco code editor instance, mode switching, and code evaluation. */
class EditorManager {
  constructor(app) {
    this._app = app;
    this.editor = null;
    this.mode = 'cascadestudio';
    this._extraLibs = [];
    this._codeContainer = null;
    this._openscadProviders = [];
  }

  /** Initialize the editor panel inside a DockviewContainer. */
  initPanel(container, state) {
    if (this.editor) {
      monaco.editor.getModels().forEach(model => model.dispose());
      this.editor = null;
    }

    // Set the Monaco Language Options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    });
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

    // Import Typescript Intellisense Definitions
    const isBuilt = typeof ESBUILD !== 'undefined';
    let prefix = window.location.href.startsWith("https://zalo.github.io/") ? "/CascadeStudio/" : "";
    const ocDtsPath = isBuilt ? 'typedefs/cascadestudio.d.ts' : prefix + 'node_modules/opencascade.js/dist/cascadestudio.d.ts';
    const threeDtsPath = isBuilt ? 'typedefs/three.d.ts' : prefix + 'node_modules/@types/three/index.d.ts';
    const libDtsPath = isBuilt ? 'typedefs/StandardLibraryIntellisense.ts' : prefix + 'js/StandardLibraryIntellisense.ts';
    Promise.all([
      fetch(ocDtsPath).then(r => r.text()),
      fetch(threeDtsPath).then(r => r.text()),
      fetch(libDtsPath).then(r => r.text()),
    ]).then(([ocDts, threeDts, libDts]) => {
      this._extraLibs = [
        { content: ocDts, filePath: 'file://' + ocDtsPath },
        { content: threeDts, filePath: 'file://' + threeDtsPath },
        { content: libDts, filePath: 'file://' + libDtsPath },
      ];
      monaco.editor.createModel("", "typescript");
      monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
    }).catch(error => console.log("Error loading type definitions: " + error.message));

    // Check for code serialization as an array
    this._codeContainer = container;
    if (EditorManager._isArrayLike(state.code)) {
      let codeString = "";
      for (let i = 0; i < state.code.length; i++) {
        codeString += state.code[i] + "\n";
      }
      codeString = codeString.slice(0, -1);
      state.code = codeString;
      container.setState({ code: codeString });
    }

    // Initialize the Monaco Code Editor
    const isMobile = window.innerHeight > window.innerWidth;
    this.editor = monaco.editor.create(container.element, {
      value: state.code,
      language: "typescript",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      cursorStyle: 'line',
      cursorWidth: 2,
      wordWrap: isMobile ? 'on' : 'off',
      ...(isMobile && {
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        lineNumbers: 'off',
        padding: { top: 0, bottom: 0 }
      })
    });
    window.monacoEditor = this.editor;

    // Collapse all top-level functions in the Editor
    this._collapseTopLevelFunctions(state.code);

    // Set up keyboard shortcuts
    this._setupKeyboardShortcuts(container);
  }

  /** Legacy: Register the dockable Monaco Code Editor component with Golden Layout.
   *  Now delegates to initPanel. */
  registerComponent(layout) {
    layout.registerComponent('codeEditor', (container, state) => {
      this.initPanel(container, state);
    });
  }

  /** Get the current code from the editor. */
  getCode() {
    return this.editor ? this.editor.getValue() : '';
  }

  /** Set the code in the editor. */
  setCode(code) {
    if (this.editor) { this.editor.setValue(code); }
  }

  /** Insert a snippet on a new line after the last non-empty line of the
   *  document. Uses executeEdits so the Monaco undo stack is preserved.
   *  Returns the 1-based line number the snippet's first line landed on. */
  insertCode(snippet) {
    if (!this.editor) return -1;
    const model = this.editor.getModel();
    let lastLine = model.getLineCount();
    while (lastLine > 1 && model.getLineContent(lastLine).trim() === '') { lastLine--; }
    const isEmptyDoc = (lastLine === 1 && model.getLineContent(1).trim() === '');
    const col = model.getLineMaxColumn(lastLine);
    const text = isEmptyDoc ? snippet : '\n' + snippet;
    this.editor.pushUndoStop();
    this.editor.executeEdits('cascade-gui-tools', [{
      range: new monaco.Range(lastLine, col, lastLine, col),
      text: text
    }]);
    this.editor.pushUndoStop();
    return isEmptyDoc ? lastLine : lastLine + 1;
  }

  /** Get the text of a 1-based line (empty string if out of range). */
  getLineContent(lineNumber) {
    if (!this.editor) return '';
    const model = this.editor.getModel();
    if (lineNumber < 1 || lineNumber > model.getLineCount()) return '';
    return model.getLineContent(lineNumber);
  }

  /** Replace the full text of a 1-based line (undo-friendly). */
  replaceLine(lineNumber, newText) {
    if (!this.editor) return;
    const model = this.editor.getModel();
    if (lineNumber < 1 || lineNumber > model.getLineCount()) return;
    this.editor.pushUndoStop();
    this.editor.executeEdits('cascade-gui-tools', [{
      range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
      text: newText
    }]);
    this.editor.pushUndoStop();
  }

  /** Reveal a line and flash a temporary highlight on it.
   *  Used by the Select tool's pick → code line mapping. */
  flashLine(lineNumber) {
    if (!this.editor || !lineNumber || lineNumber < 1) return;
    this.editor.revealLineInCenterIfOutsideViewport(lineNumber);
    const decorations = this.editor.deltaDecorations(this._flashDecorations || [], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: { isWholeLine: true, className: 'cs-pick-line-flash' }
    }]);
    this._flashDecorations = decorations;
    clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => {
      this._flashDecorations = this.editor.deltaDecorations(this._flashDecorations || [], []);
    }, 1200);
  }

  /** Evaluate the current code: transpile if OpenSCAD, then send to worker via engine. */
  evaluateCode(saveToURL = false) {
    if (window.workerWorking) { return; }
    if (!this._app.engine || !this._app.engine.isReady) { return; }
    window.workerWorking = true;

    monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
    let newCode = this.editor.getValue();
    monaco.editor.setModelMarkers(this.editor.getModel(), 'test', []);

    // Clear console and refresh the GUI Panel
    this._app.console.clear();
    this._app.gui.reset();
    if (this._app.viewport) this._app.viewport.clearTransformHandles();

    // Transpile OpenSCAD if needed
    let codeToEval = newCode;
    if (this.mode === 'openscad' && this._app._openscadTranspiler) {
      try {
        codeToEval = this._app._openscadTranspiler.transpile(newCode);
      } catch (e) {
        console.error("OpenSCAD transpile error: " + e.message);
        window.workerWorking = false;
        return;
      }
    }

    // Use CascadeEngine to evaluate and get mesh data.
    // Python code is passed through as-is; the worker runs it via Brython
    // (or Pyodide when the experimental flag is set).
    this._app.engine.evaluate(codeToEval, {
      guiState: this._app.gui.state,
      language: this.mode === 'python' ? 'python' : undefined,
      pyRuntime: this.mode === 'python' ? resolvePyRuntime() : undefined,
    }).then((result) => {
      if (this._app.viewport && result.meshData) {
        this._app.viewport.renderMeshData(result.meshData, result.sceneOptions);
      }
    }).catch((err) => {
      console.error("Evaluation error: " + err.message);
      window.workerWorking = false;
    });

    this._codeContainer.setState({ code: newCode });

    if (saveToURL) {
      const AppClass = this._app.constructor;
      console.log("Saved to URL!");
      // `mode` is a plain, human-readable param so the language travels with
      // the code. Links without it predate mode serialization and load as
      // CascadeStudio JS (see CascadeStudioApp.initialize).
      window.history.replaceState({}, 'Cascade Studio',
        new URL(
          location.pathname + "?code=" + AppClass.encode(newCode) +
          "&gui=" + AppClass.encode(JSON.stringify(this._app.gui.state)) +
          "&mode=" + encodeURIComponent(this.mode),
          location.href
        ).href
      );
    }

    console.log("Generating Model");
  }

  /** Set editor mode: 'cascadestudio', 'openscad', or 'python'. */
  setMode(newMode) {
    if (newMode === this.mode) return;

    // Swap starter code if the current content is any known mode's starter
    const AppClass = this._app.constructor;
    const starters = {
      cascadestudio: AppClass.STARTER_CODE,
      openscad: AppClass.OPENSCAD_STARTER_CODE,
      python: AppClass.PYTHON_STARTER_CODE,
    };
    const currentCode = this.editor.getValue();
    if (starters[newMode] && Object.values(starters).includes(currentCode)) {
      this.editor.setValue(starters[newMode]);
    }

    // Fit camera on the next render after a mode switch
    if (this._app.viewport) {
      this._app.viewport._fitOnNextRender = true;
    }

    this.mode = newMode;

    // Dispose existing OpenSCAD providers
    this._openscadProviders.forEach(d => d.dispose());
    this._openscadProviders = [];

    const model = this.editor.getModel();
    if (newMode === 'openscad') {
      // Switch to OpenSCAD language
      monaco.editor.setModelLanguage(model, 'openscad');

      // Register OpenSCAD providers if available
      if (this._app._openscadMonaco) {
        this._openscadProviders = this._app._openscadMonaco.registerProviders(this.editor);
      }
    } else if (newMode === 'python') {
      // Monaco ships a built-in Python tokenizer — no custom language needed
      monaco.editor.setModelLanguage(model, 'python');
    } else {
      // Switch back to TypeScript
      monaco.editor.setModelLanguage(model, 'typescript');
      monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
    }

    // Let the GUI tools react (e.g. the Sketch tool is JS-only for now)
    if (this._app.viewport && this._app.viewport.toolManager) {
      this._app.viewport.toolManager.onLanguageChanged();
    }
  }

  /** Get the container for the code editor. */
  get container() {
    return this._codeContainer;
  }

  /** Collapse all top-level functions in the editor. */
  _collapseTopLevelFunctions(code) {
    let codeLines = code.split(/\r\n|\r|\n/);
    let collapsed = []; let curCollapse = null;
    for (let li = 0; li < codeLines.length; li++) {
      if (codeLines[li].startsWith("function")) {
        curCollapse = { "startLineNumber": (li + 1) };
      } else if (codeLines[li].startsWith("}") && curCollapse !== null) {
        curCollapse["endLineNumber"] = (li + 1);
        collapsed.push(curCollapse);
        curCollapse = null;
      }
    }
    let mergedViewState = Object.assign(this.editor.saveViewState(), {
      "contributionsState": {
        "editor.contrib.folding": {
          "collapsedRegions": collapsed,
          "lineCount": codeLines.length,
          "provider": "indent"
        },
        "editor.contrib.wordHighlighter": false
      }
    });
    this.editor.restoreViewState(mergedViewState);
  }

  /** Set up keyboard shortcuts for evaluation and save. */
  _setupKeyboardShortcuts(container) {
    document.onkeydown = (e) => {
      if (e.code === 'F5') {
        e.preventDefault();
        this.evaluateCode(true);
        return false;
      }
      if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this._app.saveProject();
        this.evaluateCode(true);
      }
      return true;
    };

    document.onkeyup = (e) => {
      if (!this._app.file.handle || e.which === 0) { return true; }
      if (this._app.file.content == this.editor.getValue()) {
        this._codeContainer.setTitle(this._app.file.handle.name);
      } else {
        this._codeContainer.setTitle('* ' + this._app.file.handle.name);
      }
      return true;
    };
  }

  static _isArrayLike(item) {
    return (
      Array.isArray(item) ||
      (!!item &&
        typeof item === "object" &&
        item.hasOwnProperty("length") &&
        typeof item.length === "number" &&
        item.length > 0 &&
        (item.length - 1) in item
      )
    );
  }
}

export { EditorManager };
