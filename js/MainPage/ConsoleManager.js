// ConsoleManager.js - Console output management and log capture

const monaco = window.monaco;

/** Manages the console panel, captures logs/errors for programmatic access. */
class ConsoleManager {
  constructor(app) {
    this._app = app;
    this.logs = [];
    this.errors = [];
    this._consoleContainer = null;
    this._consoleGolden = null;
    this._realConsoleLog = null;
    this._initialized = false;
  }

  /** Initialize the console panel inside a DockviewContainer. */
  initPanel(container) {
    this._consoleGolden = container;
    this._consoleContainer = document.createElement("div");
    container.element.appendChild(this._consoleContainer);
    container.element.style.overflow  = 'auto';
    container.element.style.boxShadow = "inset 0px 0px 3px rgba(0,0,0,0.75)";

    if (!this._initialized) {
      this._initialized = true;
      this._setupConsoleOverrides();

      this._app.messageBus.on("log", (payload) => { console.log(payload); });
      this._app.messageBus.on("error", (payload) => {
        window.workerWorking = false;
        console.error(payload);
      });

      window.onerror = (err, url, line, colno, errorObj) => {
        let errorText = JSON.stringify(err, ConsoleManager._circularReplacer());
        if (errorText.startsWith('"')) { errorText = errorText.slice(1, -1); }

        this.errors.push("Line " + line + ": " + errorText);

        let newline = document.createElement("div");
        newline.style.color = "#f44336";
        newline.style.fontFamily = "'JetBrains Mono', 'Fira Code', Consolas, monospace";
        newline.style.fontSize = "12px";
        newline.style.padding = "1px 8px";
        newline.style.lineHeight = "1.5";
        newline.innerHTML = "Line " + line + ": " + errorText;
        this._consoleContainer.appendChild(newline);
        this._consoleContainer.parentElement.scrollTop = this._consoleContainer.parentElement.scrollHeight;

        if (!errorObj || !(errorObj.stack.includes("wasm-function"))) {
          const editor = this._app.editor.editor;
          if (editor) {
            monaco.editor.setModelMarkers(editor.getModel(), 'test', [{
              startLineNumber: line,
              startColumn: colno,
              endLineNumber: line,
              endColumn: 1000,
              message: JSON.stringify(err, ConsoleManager._circularReplacer()),
              severity: monaco.MarkerSeverity.Error
            }]);
          }
        }
      };

      this._app.messageBus.on("Progress", (payload) => {
        let el = this._consoleContainer.parentElement?.lastElementChild?.lastElementChild;
        if (el) {
          el.innerText = "> Generating Model" + ".".repeat(payload.opNumber) + ((payload.opType) ? " (" + payload.opType + ")" : "");
        }
      });

      console.log("Welcome to Cascade Studio!");
      console.log("Loading CAD Kernel...");
    }
  }

  /** Legacy: Register the dockable Console component with Golden Layout.
   *  Now delegates to initPanel. */
  registerComponent(layout) {
    layout.registerComponent('console', (container) => {
      this.initPanel(container);
    });
  }

  /** Get all logs since last clear. */
  getLogs() { return this.logs.slice(); }

  /** Get all errors since last clear. */
  getErrors() { return this.errors.slice(); }

  /** Clear logs, errors, and the visual console. */
  clear() {
    this.logs = [];
    this.errors = [];
    if (this._consoleContainer) {
      this._consoleContainer.innerHTML = '';
    }
  }

  /** Get the container (for state persistence of imported files). */
  get goldenContainer() { return this._consoleGolden; }

  /** Override console.log to capture output and display in the panel. */
  _setupConsoleOverrides() {
    let alternatingColor = true;
    this._realConsoleLog = console.log;
    const self = this;

    console.log = function (...args) {
      let messageText;
      if (args.length === 0) {
        messageText = "";
      } else {
        messageText = args.map(arg => {
          if (arg === undefined) return "undefined";
          let s = JSON.stringify(arg, ConsoleManager._circularReplacer());
          if (s && s.startsWith('"')) { s = s.slice(1, -1); }
          return s;
        }).join(' ');
      }

      self.logs.push(messageText);

      let newline = document.createElement("div");
      newline.style.fontFamily = "'JetBrains Mono', 'Fira Code', Consolas, monospace";
      newline.style.color = (alternatingColor = !alternatingColor) ? "#999" : "#ccc";
      newline.style.fontSize = "12px";
      newline.style.padding = "1px 8px";
      newline.style.lineHeight = "1.5";
      newline.innerHTML = "&gt; " + messageText;
      self._consoleContainer.appendChild(newline);
      self._consoleContainer.parentElement.scrollTop = self._consoleContainer.parentElement.scrollHeight;
      self._realConsoleLog.apply(console, args);
    };
  }

  static _circularReplacer() {
    let seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) { return; }
        seen.add(value);
      }
      return value;
    };
  }
}

export { ConsoleManager };
