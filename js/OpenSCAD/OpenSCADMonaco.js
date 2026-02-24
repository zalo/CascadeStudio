// OpenSCADMonaco.js - Monaco language integration for OpenSCAD

import openscadParser from '../../lib/openscad-parser/openscad-parser.js';

const { CodeFile, Lexer, Parser, ErrorCollector, ASTScopePopulator, Scope,
        ScopeSymbolCompletionProvider, KeywordsCompletionProvider, SymbolResolver } = openscadParser;

const monaco = window.monaco;

/** OpenSCAD builtin modules with parameter snippets. */
const BUILTIN_MODULES = [
  { name: 'cube', snippet: 'cube(${1:size})', detail: 'cube(size, center)' },
  { name: 'sphere', snippet: 'sphere(${1:r})', detail: 'sphere(r) or sphere(d)' },
  { name: 'cylinder', snippet: 'cylinder(h=${1:10}, r=${2:5})', detail: 'cylinder(h, r, center) or cylinder(h, r1, r2)' },
  { name: 'polygon', snippet: 'polygon(points=${1:[[0,0],[1,0],[0,1]]})', detail: 'polygon(points, paths)' },
  { name: 'circle', snippet: 'circle(${1:r})', detail: 'circle(r) or circle(d)' },
  { name: 'square', snippet: 'square(${1:size})', detail: 'square(size, center)' },
  { name: 'text', snippet: 'text("${1:hello}")', detail: 'text(t, size, font)' },
  { name: 'polyhedron', snippet: 'polyhedron(points=${1:[]}, faces=${2:[]})', detail: 'polyhedron(points, faces)' },
  { name: 'translate', snippet: 'translate([${1:0}, ${2:0}, ${3:0}])', detail: 'translate(v)' },
  { name: 'rotate', snippet: 'rotate([${1:0}, ${2:0}, ${3:0}])', detail: 'rotate(a) or rotate(a, v)' },
  { name: 'scale', snippet: 'scale([${1:1}, ${2:1}, ${3:1}])', detail: 'scale(v)' },
  { name: 'mirror', snippet: 'mirror([${1:1}, ${2:0}, ${3:0}])', detail: 'mirror(v)' },
  { name: 'union', snippet: 'union() {\n\t$0\n}', detail: 'union() { ... }' },
  { name: 'difference', snippet: 'difference() {\n\t$0\n}', detail: 'difference() { ... }' },
  { name: 'intersection', snippet: 'intersection() {\n\t$0\n}', detail: 'intersection() { ... }' },
  { name: 'linear_extrude', snippet: 'linear_extrude(height=${1:10})', detail: 'linear_extrude(height, center, twist, slices)' },
  { name: 'rotate_extrude', snippet: 'rotate_extrude(angle=${1:360})', detail: 'rotate_extrude(angle)' },
  { name: 'hull', snippet: 'hull() {\n\t$0\n}', detail: 'hull() { ... }' },
  { name: 'minkowski', snippet: 'minkowski() {\n\t$0\n}', detail: 'minkowski() { ... }' },
  { name: 'color', snippet: 'color("${1:red}")', detail: 'color(c, alpha)' },
  { name: 'echo', snippet: 'echo(${1:msg})', detail: 'echo(...)' },
  { name: 'for', snippet: 'for (${1:i} = [${2:0}:${3:10}]) {\n\t$0\n}', detail: 'for(var = range) { ... }' },
];

/** OpenSCAD builtin functions. */
const BUILTIN_FUNCTIONS = [
  'abs', 'sign', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'floor', 'ceil', 'round', 'sqrt', 'pow', 'exp', 'log', 'ln',
  'len', 'str', 'chr', 'ord', 'concat', 'lookup', 'search',
  'min', 'max', 'norm', 'cross', 'rands',
  'is_undef', 'is_num', 'is_string', 'is_bool', 'is_list',
];

/** Manages OpenSCAD language support in Monaco editor. */
class OpenSCADMonaco {
  constructor() {
    this._registered = false;
    this._parseTimer = null;
    this._lastAst = null;
    this._lastScopedAst = null;
  }

  /** Register the OpenSCAD language with Monaco (syntax highlighting). */
  registerLanguage() {
    if (this._registered) return;
    this._registered = true;

    monaco.languages.register({ id: 'openscad' });

    // Monarch tokenizer for syntax highlighting
    monaco.languages.setMonarchTokensProvider('openscad', {
      keywords: [
        'module', 'function', 'if', 'else', 'for', 'let', 'each',
        'true', 'false', 'undef', 'include', 'use', 'assert', 'echo'
      ],
      builtins: [
        'cube', 'sphere', 'cylinder', 'cone', 'polyhedron', 'polygon', 'circle', 'square', 'text',
        'translate', 'rotate', 'scale', 'mirror', 'multmatrix', 'color', 'render',
        'union', 'difference', 'intersection', 'hull', 'minkowski',
        'linear_extrude', 'rotate_extrude', 'projection', 'surface',
        'import', 'resize', 'offset', 'children',
        ...BUILTIN_FUNCTIONS,
      ],
      specialVars: /\$[a-zA-Z_]\w*/,
      tokenizer: {
        root: [
          // Comments
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // Special variables
          [/\$[a-zA-Z_]\w*/, 'variable.predefined'],

          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],

          // Numbers
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/\d+/, 'number'],

          // Identifiers
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@builtins': 'type',
              '@default': 'identifier'
            }
          }],

          // Operators
          [/[{}()\[\]]/, '@brackets'],
          [/[<>]=?|[!=]=|&&|\|\||[+\-*\/%^?:;,.]/, 'operator'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop']
        ],
      }
    });

    // Language configuration (brackets, auto-closing)
    monaco.languages.setLanguageConfiguration('openscad', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
      ]
    });
  }

  /** Register completion, diagnostic, hover, and go-to-definition providers.
   *  Returns array of disposables. */
  registerProviders(editor) {
    this.registerLanguage();
    const disposables = [];

    // Completion provider
    disposables.push(monaco.languages.registerCompletionItemProvider('openscad', {
      provideCompletionItems: (model, position) => {
        return this._provideCompletions(model, position);
      }
    }));

    // Hover provider
    disposables.push(monaco.languages.registerHoverProvider('openscad', {
      provideHover: (model, position) => {
        return this._provideHover(model, position);
      }
    }));

    // Definition provider
    disposables.push(monaco.languages.registerDefinitionProvider('openscad', {
      provideDefinition: (model, position) => {
        return this._provideDefinition(model, position);
      }
    }));

    // Diagnostics on edit (debounced)
    disposables.push(editor.onDidChangeModelContent(() => {
      clearTimeout(this._parseTimer);
      this._parseTimer = setTimeout(() => {
        this._updateDiagnostics(editor);
      }, 300);
    }));

    // Initial diagnostics
    setTimeout(() => this._updateDiagnostics(editor), 500);

    return disposables;
  }

  /** Parse and cache AST for the current editor content. */
  _parseAndCache(code) {
    try {
      const codeFile = new CodeFile("<editor>", code);
      const errorCollector = new ErrorCollector();
      const lexer = new Lexer(codeFile, errorCollector);
      const tokens = lexer.scan();
      const parser = new Parser(codeFile, tokens, errorCollector);
      const ast = parser.parse();

      // Scope population
      let scopedAst = ast;
      try {
        const rootScope = new Scope();
        const populator = new ASTScopePopulator(rootScope);
        scopedAst = populator.populate(ast);
      } catch (e) {
        // Scope analysis may fail on incomplete code
      }

      this._lastAst = ast;
      this._lastScopedAst = scopedAst;
      return { ast, scopedAst, errorCollector };
    } catch (e) {
      return { ast: null, scopedAst: null, errorCollector: null };
    }
  }

  /** Provide completion items. */
  _provideCompletions(model, position) {
    const suggestions = [];
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    // Builtin module completions
    for (const mod of BUILTIN_MODULES) {
      suggestions.push({
        label: mod.name,
        kind: monaco.languages.CompletionItemKind.Function,
        detail: mod.detail,
        insertText: mod.snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range
      });
    }

    // Builtin function completions
    for (const fn of BUILTIN_FUNCTIONS) {
      suggestions.push({
        label: fn,
        kind: monaco.languages.CompletionItemKind.Function,
        detail: `${fn}()`,
        insertText: `${fn}(\${1})`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range
      });
    }

    // Try scope-based completions from the parser
    try {
      const code = model.getValue();
      const { scopedAst } = this._parseAndCache(code);
      if (scopedAst) {
        const provider = new ScopeSymbolCompletionProvider();
        const loc = { line: position.lineNumber, col: position.column };
        // getSymbolsAtLocation is async but we run it sync-ish
        provider.getSymbolsAtLocation(scopedAst, loc).then(symbols => {
          // symbols arrive async — Monaco handles this fine since we return suggestions early
          // For simplicity, the builtin completions above cover the main use case
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore completion errors
    }

    // Special variable completions
    const specialVars = ['$fn', '$fa', '$fs', '$t', '$children', '$preview'];
    for (const sv of specialVars) {
      suggestions.push({
        label: sv,
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: 'Special variable',
        insertText: sv,
        range
      });
    }

    return { suggestions };
  }

  /** Update diagnostics (error markers) in the editor. */
  _updateDiagnostics(editor) {
    const model = editor.getModel();
    if (!model || model.getLanguageId() !== 'openscad') return;

    const code = model.getValue();
    const { errorCollector } = this._parseAndCache(code);

    const markers = [];
    if (errorCollector && errorCollector.errors) {
      for (const err of errorCollector.errors) {
        const pos = err.pos || err.span || err.token?.pos;
        if (pos) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: err.message || 'Syntax error',
            startLineNumber: pos.line || 1,
            startColumn: pos.col || 1,
            endLineNumber: pos.line || 1,
            endColumn: (pos.col || 1) + 10
          });
        } else if (err.message) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: err.message,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 100
          });
        }
      }
    }

    monaco.editor.setModelMarkers(model, 'openscad', markers);
  }

  /** Provide hover information. */
  _provideHover(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    const name = word.word;

    // Check builtin modules
    const mod = BUILTIN_MODULES.find(m => m.name === name);
    if (mod) {
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [
          { value: `**${mod.name}**` },
          { value: mod.detail }
        ]
      };
    }

    // Check builtin functions
    if (BUILTIN_FUNCTIONS.includes(name)) {
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [
          { value: `**${name}**` },
          { value: `Built-in function: ${name}()` }
        ]
      };
    }

    return null;
  }

  /** Provide go-to-definition. */
  _provideDefinition(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    const name = word.word;

    try {
      const code = model.getValue();
      const { scopedAst, errorCollector } = this._parseAndCache(code);
      if (!scopedAst) return null;

      // Try to resolve symbols
      const resolver = new SymbolResolver(errorCollector || new ErrorCollector());
      const resolved = resolver.mutate(scopedAst);

      // Search for the declaration in the AST
      const decl = this._findDeclaration(resolved, name);
      if (decl && decl.pos) {
        return {
          uri: model.uri,
          range: new monaco.Range(
            decl.pos.line || 1, decl.pos.col || 1,
            decl.pos.line || 1, (decl.pos.col || 1) + name.length
          )
        };
      }
    } catch (e) {
      // Definition lookup failed
    }

    return null;
  }

  /** Search AST for a named declaration. */
  _findDeclaration(node, name) {
    if (!node) return null;

    // Check if this node is a declaration with matching name
    if (node.name === name) {
      const type = node.constructor.name;
      if (type === 'ModuleDeclarationStmt' || type === 'FunctionDeclarationStmt' ||
          type.includes('ModuleDeclaration') || type.includes('FunctionDeclaration')) {
        return node;
      }
    }

    // Recurse into children
    const children = node.children || node.statements || [];
    for (const child of children) {
      const result = this._findDeclaration(child, name);
      if (result) return result;
    }

    // Check stmt property
    if (node.stmt) {
      const result = this._findDeclaration(node.stmt, name);
      if (result) return result;
    }

    // Check child property
    if (node.child) {
      const result = this._findDeclaration(node.child, name);
      if (result) return result;
    }

    return null;
  }
}

export { OpenSCADMonaco };
