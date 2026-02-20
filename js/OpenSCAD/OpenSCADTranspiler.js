// OpenSCADTranspiler.js - Transpile OpenSCAD AST to CascadeStudio JS

import openscadParser from '../../lib/openscad-parser/openscad-parser.js';

const { CodeFile, Lexer, Parser, ErrorCollector, ASTScopePopulator, Scope } = openscadParser;

/** Transpiles OpenSCAD source code into CascadeStudio JavaScript.
 *  Parses OpenSCAD, walks the AST, and generates equivalent JS using
 *  the CascadeStudio standard library (Box, Sphere, Union, etc.). */
class OpenSCADTranspiler {
  constructor() {
    this._tempCounter = 0;
    this._warnings = [];
  }

  /** Transpile OpenSCAD source code to CascadeStudio JS.
   *  @param {string} source - OpenSCAD source code
   *  @returns {string} CascadeStudio JS code */
  transpile(source) {
    this._tempCounter = 0;
    this._warnings = [];

    const codeFile = new CodeFile("<editor>", source);
    const errorCollector = new ErrorCollector();
    const lexer = new Lexer(codeFile, errorCollector);
    const tokens = lexer.scan();
    const parser = new Parser(codeFile, tokens, errorCollector);
    const ast = parser.parse();

    if (errorCollector.hasErrors()) {
      const firstError = errorCollector.errors[0];
      throw new Error(firstError.message || "OpenSCAD parse error");
    }

    const lines = [];
    for (const stmt of (ast.statements || ast.children || [])) {
      const code = this._transpileStatement(stmt);
      if (code) lines.push(code);
    }

    if (this._warnings.length > 0) {
      const warningLines = this._warnings.map(w => `console.log("WARNING: ${w}");`);
      return warningLines.join('\n') + '\n' + lines.join('\n');
    }

    return lines.join('\n');
  }

  /** Get warnings from last transpilation. */
  get warnings() { return this._warnings; }

  /** Parse OpenSCAD source and return the AST (for Monaco integration). */
  parse(source) {
    const codeFile = new CodeFile("<editor>", source);
    const errorCollector = new ErrorCollector();
    const lexer = new Lexer(codeFile, errorCollector);
    const tokens = lexer.scan();
    const parser = new Parser(codeFile, tokens, errorCollector);
    const ast = parser.parse();
    return { ast, errorCollector, codeFile };
  }

  _freshVar() {
    return `_t${this._tempCounter++}`;
  }

  // --- Statement transpilation ---

  _transpileStatement(stmt) {
    if (!stmt) return '';
    const type = stmt.constructor.name;

    switch (type) {
      case 'ModuleInstantiationStmt':
        return this._transpileModuleInstantiation(stmt);
      case 'ModuleDeclarationStmt':
        return this._transpileModuleDeclaration(stmt);
      case 'FunctionDeclarationStmt':
        return this._transpileFunctionDeclaration(stmt);
      case 'IfElseStatement':
        return this._transpileIfElse(stmt);
      case 'BlockStmt':
        return this._transpileBlock(stmt);
      case 'NoopStmt':
        return '';
      default:
        // Assignment nodes at top level
        if (stmt.name !== undefined && stmt.value !== undefined) {
          return this._transpileAssignment(stmt);
        }
        return `/* Unsupported statement: ${type} */`;
    }
  }

  _transpileAssignment(node) {
    return `let ${node.name} = ${this._transpileExpr(node.value)};`;
  }

  _transpileBlock(block) {
    const lines = [];
    for (const child of (block.children || [])) {
      const code = this._transpileStatement(child);
      if (code) lines.push(code);
    }
    return lines.join('\n');
  }

  _transpileIfElse(stmt) {
    let code = `if (${this._transpileExpr(stmt.cond)}) {\n`;
    code += this._indentBlock(this._transpileStatement(stmt.thenBranch));
    code += '\n}';
    if (stmt.elseBranch) {
      code += ` else {\n`;
      code += this._indentBlock(this._transpileStatement(stmt.elseBranch));
      code += '\n}';
    }
    return code;
  }

  _transpileModuleDeclaration(stmt) {
    const params = this._extractParams(stmt.definitionArgs);
    let body;
    if (stmt.stmt) {
      body = this._transpileStatement(stmt.stmt);
    } else {
      body = '';
    }
    return `function ${stmt.name}(${params}) {\n${this._indentBlock(body)}\n}`;
  }

  _transpileFunctionDeclaration(stmt) {
    const params = this._extractParams(stmt.definitionArgs);
    const expr = this._transpileExpr(stmt.expr);
    return `function ${stmt.name}(${params}) { return ${expr}; }`;
  }

  // --- Module Instantiation (the core of OpenSCAD) ---

  _transpileModuleInstantiation(stmt) {
    const name = stmt.name;

    // Check for children (BlockStmt or single child)
    const children = this._getChildren(stmt);

    switch (name) {
      // --- Primitives ---
      case 'cube':     return this._transpileCube(stmt);
      case 'sphere':   return this._transpileSphere(stmt);
      case 'cylinder': return this._transpileCylinder(stmt);
      case 'polyhedron': return this._transpilePolyhedron(stmt);
      case 'polygon':  return this._transpilePolygon(stmt);
      case 'circle':   return this._transpileCircle(stmt);
      case 'square':   return this._transpileSquare(stmt);
      case 'text':     return this._transpileText(stmt);

      // --- Transforms ---
      case 'translate': return this._transpileTransform('Translate', stmt, children);
      case 'rotate':    return this._transpileRotate(stmt, children);
      case 'scale':     return this._transpileScale(stmt, children);
      case 'mirror':    return this._transpileMirror(stmt, children);
      case 'multmatrix': return this._transpileMultmatrix(stmt, children);

      // --- Booleans ---
      case 'union':        return this._transpileUnion(children);
      case 'difference':   return this._transpileDifference(children);
      case 'intersection': return this._transpileIntersection(children);

      // --- Extrusions ---
      case 'linear_extrude': return this._transpileLinearExtrude(stmt, children);
      case 'rotate_extrude': return this._transpileRotateExtrude(stmt, children);

      // --- Control flow ---
      case 'for':    return this._transpileFor(stmt);
      case 'let':    return this._transpileLet(stmt);
      case 'assign': return this._transpileLet(stmt); // legacy alias
      case 'echo':   return this._transpileEcho(stmt);

      // --- Pass-through (no BRep effect) ---
      case 'color':
      case 'render':
      case '%':
      case '#':
      case '!':
      case '*':
        return this._transpilePassthrough(children);

      // --- Unsupported ---
      case 'hull':
      case 'minkowski':
      case 'projection':
      case 'surface':
      case 'import':
      case 'resize':
      case 'offset':
        this._warnings.push(`${name}() is not supported in CascadeStudio`);
        return `/* ${name}() is not supported */`;

      // --- User-defined module call ---
      default:
        return this._transpileUserModule(stmt, children);
    }
  }

  // --- Primitives ---

  _transpileCube(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['size', 'center']);
    let x, y, z;
    const sizeExpr = args.size;

    if (!sizeExpr) {
      x = y = z = '1';
    } else if (this._isVector(sizeExpr)) {
      const elems = this._vectorElements(sizeExpr);
      x = this._transpileExpr(elems[0] || { value: 1 });
      y = this._transpileExpr(elems[1] || { value: 1 });
      z = this._transpileExpr(elems[2] || { value: 1 });
    } else {
      const s = this._transpileExpr(sizeExpr);
      x = y = z = s;
    }

    const centered = args.center ? this._transpileExpr(args.center) : 'false';
    return `Box(${x}, ${y}, ${z}, ${centered});`;
  }

  _transpileSphere(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['r']);
    let radius;
    if (args.d) {
      radius = `(${this._transpileExpr(args.d)}) / 2`;
    } else if (args.r) {
      radius = this._transpileExpr(args.r);
    } else {
      radius = '1';
    }
    return `Sphere(${radius});`;
  }

  _transpileCylinder(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['h', 'r', 'r1', 'r2']);
    const h = args.h ? this._transpileExpr(args.h) : '1';
    const centered = args.center ? this._transpileExpr(args.center) : 'false';

    // Handle d/d1/d2 → r/r1/r2
    let r1, r2;
    if (args.d) {
      r1 = r2 = `(${this._transpileExpr(args.d)}) / 2`;
    } else if (args.d1 || args.d2) {
      r1 = args.d1 ? `(${this._transpileExpr(args.d1)}) / 2` : (args.r1 ? this._transpileExpr(args.r1) : '1');
      r2 = args.d2 ? `(${this._transpileExpr(args.d2)}) / 2` : (args.r2 ? this._transpileExpr(args.r2) : '1');
    } else if (args.r1 || args.r2) {
      r1 = args.r1 ? this._transpileExpr(args.r1) : (args.r2 ? this._transpileExpr(args.r2) : '1');
      r2 = args.r2 ? this._transpileExpr(args.r2) : (args.r1 ? this._transpileExpr(args.r1) : '1');
    } else {
      r1 = r2 = args.r ? this._transpileExpr(args.r) : '1';
    }

    if (r1 === r2) {
      return `Cylinder(${r1}, ${h}, ${centered});`;
    } else {
      return `Cone(${r1}, ${r2}, ${h});`;
    }
  }

  _transpilePolyhedron(stmt) {
    this._warnings.push('polyhedron() generates tessellated geometry, not analytic BRep');
    const args = this._parseNamedArgs(stmt.args, ['points', 'faces', 'triangles']);
    const points = args.points ? this._transpileExpr(args.points) : '[]';
    return `/* polyhedron - not directly supported, using raw points */\n(function() { console.log("polyhedron() is not yet supported"); })();`;
  }

  _transpilePolygon(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['points', 'paths']);
    const points = args.points ? this._transpileExpr(args.points) : '[]';
    return `Polygon(${points});`;
  }

  _transpileCircle(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['r']);
    let radius;
    if (args.d) {
      radius = `(${this._transpileExpr(args.d)}) / 2`;
    } else {
      radius = args.r ? this._transpileExpr(args.r) : '1';
    }
    return `Circle(${radius});`;
  }

  _transpileSquare(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['size', 'center']);
    let x, y;
    const sizeExpr = args.size;
    if (!sizeExpr) {
      x = y = '1';
    } else if (this._isVector(sizeExpr)) {
      const elems = this._vectorElements(sizeExpr);
      x = this._transpileExpr(elems[0] || { value: 1 });
      y = this._transpileExpr(elems[1] || { value: 1 });
    } else {
      const s = this._transpileExpr(sizeExpr);
      x = y = s;
    }
    const centered = args.center ? this._transpileExpr(args.center) : 'false';
    // Convert to 4-point polygon, handling dynamic center values
    return `(function() { let _x = ${x}, _y = ${y}; return (${centered}) ? Polygon([[-_x/2, -_y/2], [_x/2, -_y/2], [_x/2, _y/2], [-_x/2, _y/2]]) : Polygon([[0, 0], [_x, 0], [_x, _y], [0, _y]]); })();`;
  }

  _transpileText(stmt) {
    const args = this._parseNamedArgs(stmt.args, ['text']);
    const text = args.text ? this._transpileExpr(args.text) : '""';
    const size = args.size ? this._transpileExpr(args.size) : '10';
    // Text3D(text, size, height, fontName)
    return `Text3D(${text}, ${size}, 0.15);`;
  }

  // --- Transforms ---

  _transpileTransform(csFunc, stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['v']);
    const v = args.v ? this._transpileExpr(args.v) : '[0, 0, 0]';

    if (children.length === 0) return '';
    if (children.length === 1) {
      const childExpr = this._transpileChildAsExpr(children[0]);
      return `${csFunc}(${v}, ${childExpr});`;
    }

    // Multiple children: wrap each, collect
    return this._wrapMultiChild(children, (varNames) => {
      return varNames.map(name => `${csFunc}(${v}, ${name});`).join('\n');
    });
  }

  _transpileRotate(stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['a', 'v']);

    if (children.length === 0) return '';

    if (args.v) {
      // Axis-angle: rotate(a, v) → Rotate(v, a, child)
      const angle = args.a ? this._transpileExpr(args.a) : '0';
      const axis = this._transpileExpr(args.v);
      if (children.length === 1) {
        const childExpr = this._transpileChildAsExpr(children[0]);
        return `Rotate(${axis}, ${angle}, ${childExpr});`;
      }
      return this._wrapMultiChild(children, (varNames) => {
        return varNames.map(name => `Rotate(${axis}, ${angle}, ${name});`).join('\n');
      });
    } else {
      // Euler angles: rotate([x,y,z]) → chain of Rotate calls
      const a = args.a;
      if (a && this._isVector(a)) {
        const elems = this._vectorElements(a);
        // Apply Z, then Y, then X (OpenSCAD convention)
        const rx = elems[0] ? this._transpileExpr(elems[0]) : '0';
        const ry = elems[1] ? this._transpileExpr(elems[1]) : '0';
        const rz = elems[2] ? this._transpileExpr(elems[2]) : '0';
        if (children.length === 1) {
          const childExpr = this._transpileChildAsExpr(children[0]);
          return `Rotate([1,0,0], ${rx}, Rotate([0,1,0], ${ry}, Rotate([0,0,1], ${rz}, ${childExpr})));`;
        }
        return this._wrapMultiChild(children, (varNames) => {
          return varNames.map(name =>
            `Rotate([1,0,0], ${rx}, Rotate([0,1,0], ${ry}, Rotate([0,0,1], ${rz}, ${name})));`
          ).join('\n');
        });
      } else {
        // Scalar angle around Z axis
        const angle = a ? this._transpileExpr(a) : '0';
        if (children.length === 1) {
          const childExpr = this._transpileChildAsExpr(children[0]);
          return `Rotate([0,0,1], ${angle}, ${childExpr});`;
        }
        return this._wrapMultiChild(children, (varNames) => {
          return varNames.map(name => `Rotate([0,0,1], ${angle}, ${name});`).join('\n');
        });
      }
    }
  }

  _transpileScale(stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['v']);
    const v = args.v ? this._transpileExpr(args.v) : '1';

    if (children.length === 0) return '';
    if (children.length === 1) {
      const childExpr = this._transpileChildAsExpr(children[0]);
      return `Scale(${v}, ${childExpr});`;
    }
    return this._wrapMultiChild(children, (varNames) => {
      return varNames.map(name => `Scale(${v}, ${name});`).join('\n');
    });
  }

  _transpileMirror(stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['v']);
    const v = args.v ? this._transpileExpr(args.v) : '[1, 0, 0]';

    if (children.length === 0) return '';
    if (children.length === 1) {
      const childExpr = this._transpileChildAsExpr(children[0]);
      return `Mirror(${v}, ${childExpr});`;
    }
    return this._wrapMultiChild(children, (varNames) => {
      return varNames.map(name => `Mirror(${v}, ${name});`).join('\n');
    });
  }

  _transpileMultmatrix(stmt, children) {
    this._warnings.push('multmatrix() is partially supported');
    return this._transpilePassthrough(children);
  }

  // --- Booleans ---

  _transpileUnion(children) {
    if (children.length === 0) return '';
    if (children.length === 1) return this._transpileStatement(children[0]);

    return this._wrapMultiChild(children, (varNames) => {
      // Remove all from sceneShapes, then Union
      const removeLines = varNames.map(v => `sceneShapes = Remove(sceneShapes, ${v});`);
      return removeLines.join('\n') + '\n' + `Union([${varNames.join(', ')}]);`;
    });
  }

  _transpileDifference(children) {
    if (children.length === 0) return '';
    if (children.length === 1) return this._transpileStatement(children[0]);

    return this._wrapMultiChild(children, (varNames) => {
      const main = varNames[0];
      const rest = varNames.slice(1);
      const removeLines = varNames.map(v => `sceneShapes = Remove(sceneShapes, ${v});`);
      return removeLines.join('\n') + '\n' + `Difference(${main}, [${rest.join(', ')}]);`;
    });
  }

  _transpileIntersection(children) {
    if (children.length === 0) return '';
    if (children.length === 1) return this._transpileStatement(children[0]);

    return this._wrapMultiChild(children, (varNames) => {
      const removeLines = varNames.map(v => `sceneShapes = Remove(sceneShapes, ${v});`);
      return removeLines.join('\n') + '\n' + `Intersection([${varNames.join(', ')}]);`;
    });
  }

  // --- Extrusions ---

  _transpileLinearExtrude(stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['height']);
    const h = args.height ? this._transpileExpr(args.height) : '1';

    if (children.length === 0) return '';
    if (children.length === 1) {
      const childExpr = this._transpileChildAsExpr(children[0]);
      return `Extrude(${childExpr}, [0, 0, ${h}]);`;
    }
    return this._wrapMultiChild(children, (varNames) => {
      const removeLines = varNames.map(v => `sceneShapes = Remove(sceneShapes, ${v});`);
      const extrudeLines = varNames.map(v => `Extrude(${v}, [0, 0, ${h}]);`);
      return removeLines.join('\n') + '\n' + extrudeLines.join('\n');
    });
  }

  _transpileRotateExtrude(stmt, children) {
    const args = this._parseNamedArgs(stmt.args, ['angle']);
    const angle = args.angle ? this._transpileExpr(args.angle) : '360';

    if (children.length === 0) return '';
    if (children.length === 1) {
      const childExpr = this._transpileChildAsExpr(children[0]);
      return `Revolve(${childExpr}, ${angle});`;
    }
    return this._wrapMultiChild(children, (varNames) => {
      const removeLines = varNames.map(v => `sceneShapes = Remove(sceneShapes, ${v});`);
      const revolveLines = varNames.map(v => `Revolve(${v}, ${angle});`);
      return removeLines.join('\n') + '\n' + revolveLines.join('\n');
    });
  }

  // --- Control Flow ---

  _transpileFor(stmt) {
    // OpenSCAD for: for(i=[0:10]) { ... } or for(i=[0:1:10]) { ... }
    const args = stmt.args || [];
    const lines = [];

    if (args.length === 0) return '';

    // Build nested for loops for each argument
    return this._transpileForArgs(args, 0, stmt.child);
  }

  _transpileForArgs(args, idx, body) {
    if (idx >= args.length) {
      return this._transpileChildBody(body);
    }

    const arg = args[idx];
    const varName = arg.name;
    const value = arg.value;

    if (value && value.constructor.name === 'RangeExpr') {
      // Range: [start:end] or [start:step:end]
      const begin = this._transpileExpr(value.begin);
      const end = this._transpileExpr(value.end);
      const step = value.step ? this._transpileExpr(value.step) : '1';
      const inner = this._indentBlock(this._transpileForArgs(args, idx + 1, body));
      return `for (let ${varName} = ${begin}; (${step}) > 0 ? ${varName} <= ${end} : ${varName} >= ${end}; ${varName} += ${step}) {\n${inner}\n}`;
    } else if (value && value.constructor.name === 'VectorExpr') {
      // List iteration: for(i=[1,2,3])
      const list = this._transpileExpr(value);
      const inner = this._indentBlock(this._transpileForArgs(args, idx + 1, body));
      return `for (let ${varName} of ${list}) {\n${inner}\n}`;
    } else {
      // Fallback
      const list = this._transpileExpr(value);
      const inner = this._indentBlock(this._transpileForArgs(args, idx + 1, body));
      return `for (let ${varName} of ${list}) {\n${inner}\n}`;
    }
  }

  _transpileLet(stmt) {
    const args = stmt.args || [];
    const lines = [];
    for (const arg of args) {
      lines.push(`let ${arg.name} = ${this._transpileExpr(arg.value)};`);
    }
    const body = this._transpileChildBody(stmt.child);
    if (body) lines.push(body);
    return lines.join('\n');
  }

  _transpileEcho(stmt) {
    const args = stmt.args || [];
    const exprs = args.map(a => {
      if (a.name) {
        return `"${a.name} = " + JSON.stringify(${this._transpileExpr(a.value)})`;
      }
      return this._transpileExpr(a.value || a);
    });
    return `console.log(${exprs.join(', ')});`;
  }

  _transpilePassthrough(children) {
    // Just transpile children directly
    return children.map(c => this._transpileStatement(c)).join('\n');
  }

  _transpileUserModule(stmt, children) {
    // User-defined module call: moduleName(args...)
    const name = stmt.name;
    const args = (stmt.args || []).map(a => {
      if (a.name) {
        // Named argument — pass positionally for now
        return this._transpileExpr(a.value);
      }
      return this._transpileExpr(a.value || a);
    });
    return `${name}(${args.join(', ')});`;
  }

  // --- Expression transpilation ---

  _transpileExpr(expr) {
    if (!expr) return 'undefined';
    const type = expr.constructor.name;

    switch (type) {
      case 'LiteralExpr':
        if (typeof expr.value === 'string') {
          return `"${expr.value.replace(/"/g, '\\"')}"`;
        }
        if (typeof expr.value === 'boolean') {
          return expr.value ? 'true' : 'false';
        }
        if (expr.value === undefined || expr.value === null) {
          return 'undefined';
        }
        return String(expr.value);

      case 'LookupExpr':
        return expr.name;

      case 'MemberLookupExpr':
        return `${this._transpileExpr(expr.expr)}.${expr.member}`;

      case 'BinaryOpExpr': {
        let op = typeof expr.operation === 'number' ? (expr.tokens?.operator?.lexeme || expr.operation) : expr.operation;
        return `(${this._transpileExpr(expr.left)} ${op} ${this._transpileExpr(expr.right)})`;
      }

      case 'UnaryOpExpr': {
        let op = typeof expr.operation === 'number' ? (expr.tokens?.operator?.lexeme || expr.operation) : expr.operation;
        return `(${op}${this._transpileExpr(expr.right)})`;
      }

      case 'TernaryExpr':
        return `(${this._transpileExpr(expr.cond)} ? ${this._transpileExpr(expr.ifExpr)} : ${this._transpileExpr(expr.elseExpr)})`;

      case 'VectorExpr':
        return `[${(expr.children || []).map(e => this._transpileExpr(e)).join(', ')}]`;

      case 'RangeExpr': {
        // Convert to array via helper
        const begin = this._transpileExpr(expr.begin);
        const end = this._transpileExpr(expr.end);
        const step = expr.step ? this._transpileExpr(expr.step) : '1';
        return `(function() { let _s = ${step}; if (_s === 0) return []; let _b = ${begin}, _e = ${end}; return Array.from({length: Math.max(0, Math.floor((_e - _b) / _s) + 1)}, (_, i) => _b + i * _s); })()`;
      }

      case 'FunctionCallExpr':
        return this._transpileFunctionCall(expr);

      case 'GroupingExpr':
        return `(${this._transpileExpr(expr.inner)})`;

      case 'ArrayLookupExpr':
        return `${this._transpileExpr(expr.array)}[${this._transpileExpr(expr.index)}]`;

      case 'AnonymousFunctionExpr': {
        const params = this._extractParams(expr.definitionArgs);
        return `function(${params}) { return ${this._transpileExpr(expr.expr)}; }`;
      }

      case 'LetExpr': {
        const assignments = (expr.args || []).map(a =>
          `${a.name} = ${this._transpileExpr(a.value)}`
        );
        return `(function() { let ${assignments.join(', ')}; return ${this._transpileExpr(expr.expr)}; })()`;
      }

      case 'EchoExpr': {
        const echoArgs = (expr.args || []).map(a => this._transpileExpr(a.value || a));
        return `(function() { console.log(${echoArgs.join(', ')}); return ${this._transpileExpr(expr.expr)}; })()`;
      }

      case 'AssertExpr':
        return this._transpileExpr(expr.expr);

      default:
        // Check if it has a 'value' property (assignment node used as expr)
        if (expr.value !== undefined && expr.name !== undefined) {
          return this._transpileExpr(expr.value);
        }
        return `/* unsupported expr: ${type} */`;
    }
  }

  _transpileFunctionCall(expr) {
    const name = expr.name || (expr.callee ? this._transpileExpr(expr.callee) : 'unknown');

    // Built-in OpenSCAD functions
    switch (name) {
      case 'len':
        return `${this._transpileExpr(expr.args[0].value || expr.args[0])}.length`;
      case 'concat': {
        const items = expr.args.map(a => this._transpileExpr(a.value || a));
        return `[].concat(${items.join(', ')})`;
      }
      case 'str': {
        const items = expr.args.map(a => `String(${this._transpileExpr(a.value || a)})`);
        return items.join(' + ');
      }
      case 'chr':
        return `String.fromCharCode(${this._transpileExpr(expr.args[0].value || expr.args[0])})`;
      case 'ord':
        return `${this._transpileExpr(expr.args[0].value || expr.args[0])}.charCodeAt(0)`;
      case 'search':
        return `/* search() not supported */[]`;
      // Math functions
      case 'abs': case 'ceil': case 'floor': case 'round':
      case 'sqrt': case 'exp': case 'log': case 'ln':
      case 'sin': case 'cos': case 'tan':
      case 'asin': case 'acos': case 'atan':
      case 'min': case 'max':
      case 'sign': {
        const fnName = name === 'ln' ? 'log' : name;
        const mathArgs = expr.args.map(a => this._transpileExpr(a.value || a));
        return `Math.${fnName}(${mathArgs.join(', ')})`;
      }
      case 'atan2': {
        const mathArgs = expr.args.map(a => this._transpileExpr(a.value || a));
        return `Math.atan2(${mathArgs.join(', ')})`;
      }
      case 'pow': {
        const mathArgs = expr.args.map(a => this._transpileExpr(a.value || a));
        return `Math.pow(${mathArgs.join(', ')})`;
      }
      case 'norm': {
        const v = this._transpileExpr(expr.args[0].value || expr.args[0]);
        return `Math.sqrt(${v}.reduce((s, x) => s + x * x, 0))`;
      }
      case 'cross': {
        const a = this._transpileExpr(expr.args[0].value || expr.args[0]);
        const b = this._transpileExpr(expr.args[1].value || expr.args[1]);
        return `[${a}[1]*${b}[2] - ${a}[2]*${b}[1], ${a}[2]*${b}[0] - ${a}[0]*${b}[2], ${a}[0]*${b}[1] - ${a}[1]*${b}[0]]`;
      }
      case 'lookup': {
        this._warnings.push('lookup() approximated');
        return '0 /* lookup() not supported */';
      }
      case 'rands': {
        const mathArgs = expr.args.map(a => this._transpileExpr(a.value || a));
        return `Array.from({length: ${mathArgs[2] || '1'}}, () => Math.random() * (${mathArgs[1]} - ${mathArgs[0]}) + ${mathArgs[0]})`;
      }
      case 'is_undef':
        return `(${this._transpileExpr(expr.args[0].value || expr.args[0])} === undefined)`;
      case 'is_num': case 'is_number':
        return `(typeof ${this._transpileExpr(expr.args[0].value || expr.args[0])} === 'number')`;
      case 'is_string':
        return `(typeof ${this._transpileExpr(expr.args[0].value || expr.args[0])} === 'string')`;
      case 'is_bool':
        return `(typeof ${this._transpileExpr(expr.args[0].value || expr.args[0])} === 'boolean')`;
      case 'is_list':
        return `Array.isArray(${this._transpileExpr(expr.args[0].value || expr.args[0])})`;

      default: {
        // User-defined function call
        const fnArgs = (expr.args || []).map(a => this._transpileExpr(a.value || a));
        return `${name}(${fnArgs.join(', ')})`;
      }
    }
  }

  // --- Helpers ---

  /** Get children from a module instantiation statement. */
  _getChildren(stmt) {
    const child = stmt.child;
    if (!child) return [];
    const type = child.constructor.name;
    if (type === 'BlockStmt') {
      return child.children || [];
    }
    if (type === 'NoopStmt') {
      return [];
    }
    return [child];
  }

  /** Transpile a child statement as an expression (no trailing semicolon, captures shape). */
  _transpileChildAsExpr(child) {
    const type = child.constructor.name;

    if (type === 'ModuleInstantiationStmt') {
      const name = child.name;
      const grandChildren = this._getChildren(child);

      // Primitives that return a value
      switch (name) {
        case 'cube': return this._exprify(this._transpileCube(child));
        case 'sphere': return this._exprify(this._transpileSphere(child));
        case 'cylinder': return this._exprify(this._transpileCylinder(child));
        case 'polygon': return this._exprify(this._transpilePolygon(child));
        case 'circle': return this._exprify(this._transpileCircle(child));
        case 'square': return this._exprify(this._transpileSquare(child));
        case 'text': return this._exprify(this._transpileText(child));

        // Transforms wrapping a single child
        case 'translate': {
          const args = this._parseNamedArgs(child.args, ['v']);
          const v = args.v ? this._transpileExpr(args.v) : '[0, 0, 0]';
          if (grandChildren.length === 1) {
            return `Translate(${v}, ${this._transpileChildAsExpr(grandChildren[0])})`;
          }
          break;
        }
        case 'rotate': {
          const args = this._parseNamedArgs(child.args, ['a', 'v']);
          if (grandChildren.length === 1) {
            const innerExpr = this._transpileChildAsExpr(grandChildren[0]);
            if (args.v) {
              const angle = args.a ? this._transpileExpr(args.a) : '0';
              const axis = this._transpileExpr(args.v);
              return `Rotate(${axis}, ${angle}, ${innerExpr})`;
            }
            const a = args.a;
            if (a && this._isVector(a)) {
              const elems = this._vectorElements(a);
              const rx = elems[0] ? this._transpileExpr(elems[0]) : '0';
              const ry = elems[1] ? this._transpileExpr(elems[1]) : '0';
              const rz = elems[2] ? this._transpileExpr(elems[2]) : '0';
              return `Rotate([1,0,0], ${rx}, Rotate([0,1,0], ${ry}, Rotate([0,0,1], ${rz}, ${innerExpr})))`;
            }
            const angle = a ? this._transpileExpr(a) : '0';
            return `Rotate([0,0,1], ${angle}, ${innerExpr})`;
          }
          break;
        }
        case 'scale': {
          const args = this._parseNamedArgs(child.args, ['v']);
          const v = args.v ? this._transpileExpr(args.v) : '1';
          if (grandChildren.length === 1) {
            return `Scale(${v}, ${this._transpileChildAsExpr(grandChildren[0])})`;
          }
          break;
        }
        case 'mirror': {
          const args = this._parseNamedArgs(child.args, ['v']);
          const v = args.v ? this._transpileExpr(args.v) : '[1, 0, 0]';
          if (grandChildren.length === 1) {
            return `Mirror(${v}, ${this._transpileChildAsExpr(grandChildren[0])})`;
          }
          break;
        }
        case 'color':
        case 'render':
          if (grandChildren.length === 1) {
            return this._transpileChildAsExpr(grandChildren[0]);
          }
          break;
      }
    }

    // Fallback: wrap in temp var using (function(){...})()
    const v = this._freshVar();
    const code = this._transpileStatement(child);
    return `(function() { ${code} let ${v} = sceneShapes[sceneShapes.length - 1]; sceneShapes = Remove(sceneShapes, ${v}); return ${v}; })()`;
  }

  /** Remove trailing semicolon from a statement to use as expression. */
  _exprify(stmt) {
    return stmt.replace(/;\s*$/, '');
  }

  /** Wrap multiple children: evaluate each, capture in temp vars, then call fn with var names. */
  _wrapMultiChild(children, fn) {
    const varNames = [];
    const lines = [];
    for (const child of children) {
      const v = this._freshVar();
      varNames.push(v);
      const childCode = this._transpileStatement(child);
      lines.push(childCode);
      lines.push(`let ${v} = sceneShapes[sceneShapes.length - 1];`);
      lines.push(`sceneShapes = Remove(sceneShapes, ${v});`);
    }
    lines.push(fn(varNames));
    return lines.join('\n');
  }

  /** Transpile child body (for control flow). */
  _transpileChildBody(child) {
    if (!child) return '';
    const type = child.constructor.name;
    if (type === 'BlockStmt') {
      return (child.children || []).map(c => this._transpileStatement(c)).join('\n');
    }
    return this._transpileStatement(child);
  }

  /** Parse named/positional args from a module instantiation. */
  _parseNamedArgs(args, positionalNames) {
    const result = {};
    if (!args) return result;

    let posIdx = 0;
    for (const arg of args) {
      if (arg.name) {
        result[arg.name] = arg.value;
      } else if (posIdx < positionalNames.length) {
        result[positionalNames[posIdx]] = arg.value || arg;
        posIdx++;
      }
    }
    return result;
  }

  /** Extract parameter names with defaults from definition args. */
  _extractParams(defArgs) {
    if (!defArgs) return '';
    return defArgs.map(a => {
      if (a.value) {
        return `${a.name} = ${this._transpileExpr(a.value)}`;
      }
      return a.name;
    }).join(', ');
  }

  /** Check if an expression node is a VectorExpr. */
  _isVector(expr) {
    return expr && expr.constructor.name === 'VectorExpr';
  }

  /** Get elements of a VectorExpr. */
  _vectorElements(expr) {
    return expr.children || [];
  }

  /** Indent a block of code by 2 spaces. */
  _indentBlock(code) {
    return code.split('\n').map(line => '  ' + line).join('\n');
  }
}

export { OpenSCADTranspiler };
