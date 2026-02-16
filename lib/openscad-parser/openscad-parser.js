var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/openscad-parser/dist/CodeSpan.js
var require_CodeSpan = __commonJS({
  "node_modules/openscad-parser/dist/CodeSpan.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeSpan = class _CodeSpan {
      start;
      end;
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
      toString() {
        return `${this.start.toString()} - ${this.end.toString()}`;
      }
      static combine(...rawSpans) {
        let spans = rawSpans.filter((s) => s != null);
        if (spans.length === 0) {
          throw new Error("Cannot combine zero spans");
        }
        if (spans.length === 1) {
          return spans[0];
        }
        let min = spans[0];
        let max = spans[0];
        for (let span of spans) {
          if (span.start.char < min.start.char) {
            min = span;
          }
          if (span.end.char > max.end.char) {
            max = span;
          }
        }
        return new _CodeSpan(min.start, max.end);
      }
      static combineObject(spans) {
        return _CodeSpan.combine(...Object.values(spans));
      }
    };
    exports.default = CodeSpan;
  }
});

// node_modules/openscad-parser/dist/ast/ASTNode.js
var require_ASTNode = __commonJS({
  "node_modules/openscad-parser/dist/ast/ASTNode.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeSpan_1 = require_CodeSpan();
    var ASTNode = class {
      constructor() {
      }
      get span() {
        return CodeSpan_1.default.combine(...Object.values(this.tokens).flat().map((t) => t?.span));
      }
    };
    exports.default = ASTNode;
  }
});

// node_modules/openscad-parser/dist/ast/ErrorNode.js
var require_ErrorNode = __commonJS({
  "node_modules/openscad-parser/dist/ast/ErrorNode.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ASTNode_1 = require_ASTNode();
    var ErrorNode = class extends ASTNode_1.default {
      tokens;
      constructor(tokens) {
        super();
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitErrorNode(this);
      }
    };
    exports.default = ErrorNode;
  }
});

// node_modules/openscad-parser/dist/ASTAssembler.js
var require_ASTAssembler = __commonJS({
  "node_modules/openscad-parser/dist/ASTAssembler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ErrorNode_1 = require_ErrorNode();
    var ASTAssembler = class {
      visitScadFile(n) {
        return this.processAssembledNode([...n.statements.map((stmt) => () => stmt.accept(this)), n.tokens.eot], n);
      }
      visitAssignmentNode(n) {
        const arr = [];
        if (n.tokens.name) {
          arr.push(n.tokens.name);
        }
        if (n.tokens.equals) {
          arr.push(n.tokens.equals);
        }
        if (n.value) {
          arr.push(() => n.value.accept(this));
        }
        if (n.tokens.trailingCommas) {
          arr.push(...n.tokens.trailingCommas);
        }
        if (n.tokens.semicolon) {
          arr.push(n.tokens.semicolon);
        }
        return this.processAssembledNode(arr, n);
      }
      visitUnaryOpExpr(n) {
        return this.processAssembledNode([n.tokens.operator, () => n.right.accept(this)], n);
      }
      visitBinaryOpExpr(n) {
        return this.processAssembledNode([
          () => n.left.accept(this),
          n.tokens.operator,
          () => n.right.accept(this)
        ], n);
      }
      visitTernaryExpr(n) {
        return this.processAssembledNode([
          () => n.cond.accept(this),
          n.tokens.questionMark,
          () => n.ifExpr.accept(this),
          n.tokens.colon,
          () => n.elseExpr.accept(this)
        ], n);
      }
      visitArrayLookupExpr(n) {
        return this.processAssembledNode([
          () => n.array.accept(this),
          n.tokens.firstBracket,
          () => n.index.accept(this),
          n.tokens.secondBracket
        ], n);
      }
      visitLiteralExpr(n) {
        return this.processAssembledNode([n.tokens.literalToken], n);
      }
      visitRangeExpr(n) {
        if (n.step && n.tokens.secondColon) {
          let parts = [() => n.begin.accept(this), n.tokens.firstColon];
          if (n.step) {
            parts.push(() => n.step.accept(this));
          }
          parts.push(n.tokens.secondColon, () => n.end.accept(this));
          return this.processAssembledNode(parts, n);
        }
        return this.processAssembledNode([
          () => n.begin.accept(this),
          n.tokens.firstColon,
          () => n.end.accept(this)
        ], n);
      }
      visitVectorExpr(n) {
        const arr = [];
        arr.push(n.tokens.firstBracket);
        for (let i = 0; i < n.children.length; i++) {
          arr.push(() => n.children[i].accept(this));
          if (i < n.children.length - 1) {
            arr.push(n.tokens.commas[i]);
          }
        }
        arr.push(...n.tokens.commas.slice(n.children.length));
        arr.push(n.tokens.secondBracket);
        return this.processAssembledNode(arr, n);
      }
      visitLookupExpr(n) {
        return this.processAssembledNode([n.tokens.identifier], n);
      }
      visitMemberLookupExpr(n) {
        return this.processAssembledNode([() => n.expr.accept(this), n.tokens.dot, n.tokens.memberName], n);
      }
      visitFunctionCallExpr(n) {
        return this.processAssembledNode([
          () => n.callee.accept(this),
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen
        ], n);
      }
      visitLetExpr(n) {
        return this.processAssembledNode([
          n.tokens.name,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen
        ], n);
      }
      visitAssertExpr(n) {
        return this.processAssembledNode([
          n.tokens.name,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen
        ], n);
      }
      visitEchoExpr(n) {
        return this.processAssembledNode([
          n.tokens.name,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen
        ], n);
      }
      visitLcIfExpr(n) {
        const elseStuff = [];
        if (n.elseExpr && n.tokens.elseKeyword) {
          elseStuff.push(n.tokens.elseKeyword, () => n.elseExpr.accept(this));
        }
        return this.processAssembledNode([
          n.tokens.ifKeyword,
          n.tokens.firstParen,
          () => n.cond.accept(this),
          n.tokens.secondParen,
          () => n.ifExpr.accept(this),
          ...elseStuff
        ], n);
      }
      visitLcEachExpr(n) {
        return this.processAssembledNode([n.tokens.eachKeyword, () => n.expr.accept(this)], n);
      }
      visitLcForExpr(n) {
        return this.processAssembledNode([
          n.tokens.forKeyword,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.expr.accept(this)
        ], n);
      }
      visitLcForCExpr(n) {
        return this.processAssembledNode([
          n.tokens.forKeyword,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.firstSemicolon,
          () => n.cond.accept(this),
          n.tokens.secondSemicolon,
          ...n.incrArgs.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.expr.accept(this)
        ], n);
      }
      visitLcLetExpr(n) {
        return this.processAssembledNode([
          n.tokens.letKeyword,
          n.tokens.firstParen,
          ...n.args.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.expr.accept(this)
        ], n);
      }
      visitGroupingExpr(n) {
        return this.processAssembledNode([n.tokens.firstParen, () => n.inner.accept(this), n.tokens.secondParen], n);
      }
      visitUseStmt(n) {
        return this.processAssembledNode([n.tokens.useKeyword, n.tokens.filename], n);
      }
      visitIncludeStmt(n) {
        return this.processAssembledNode([n.tokens.includeKeyword, n.tokens.filename], n);
      }
      visitModuleInstantiationStmt(n) {
        const arr = [];
        arr.push(...n.tokens.modifiersInOrder);
        arr.push(n.tokens.name);
        arr.push(n.tokens.firstParen);
        arr.push(...n.args.map((a) => () => a.accept(this)));
        arr.push(n.tokens.secondParen);
        if (n.child && !(n.child instanceof ErrorNode_1.default && n.child.tokens.tokens.length === 0)) {
          arr.push(() => n.child.accept(this));
        }
        return this.processAssembledNode(arr, n);
      }
      visitModuleDeclarationStmt(n) {
        return this.processAssembledNode([
          n.tokens.moduleKeyword,
          n.tokens.name,
          n.tokens.firstParen,
          ...n.definitionArgs.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.stmt.accept(this)
        ], n);
      }
      visitFunctionDeclarationStmt(n) {
        return this.processAssembledNode([
          n.tokens.functionKeyword,
          n.tokens.name,
          n.tokens.firstParen,
          ...n.definitionArgs.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.expr.accept(this),
          n.tokens.semicolon
        ], n);
      }
      visitBlockStmt(n) {
        return this.processAssembledNode([
          n.tokens.firstBrace,
          ...n.children.map((a) => () => a.accept(this)),
          n.tokens.secondBrace
        ], n);
      }
      visitNoopStmt(n) {
        return this.processAssembledNode([n.tokens.semicolon], n);
      }
      visitIfElseStatement(n) {
        const arr = [];
        arr.push(...n.tokens.modifiersInOrder);
        arr.push(n.tokens.ifKeyword);
        arr.push(n.tokens.firstParen);
        arr.push(() => n.cond.accept(this));
        arr.push(n.tokens.secondParen);
        arr.push(() => n.thenBranch.accept(this));
        if (n.elseBranch) {
          arr.push(n.tokens.elseKeyword, () => n.elseBranch.accept(this));
        }
        return this.processAssembledNode(arr, n);
      }
      visitAnonymousFunctionExpr(n) {
        return this.processAssembledNode([
          n.tokens.functionKeyword,
          n.tokens.firstParen,
          ...n.definitionArgs.map((a) => () => a.accept(this)),
          n.tokens.secondParen,
          () => n.expr.accept(this)
        ], n);
      }
      visitErrorNode(n) {
        return this.processAssembledNode([...n.tokens.tokens], n);
      }
    };
    exports.default = ASTAssembler;
  }
});

// node_modules/openscad-parser/dist/ast/ScadFile.js
var require_ScadFile = __commonJS({
  "node_modules/openscad-parser/dist/ast/ScadFile.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ASTNode_1 = require_ASTNode();
    var ScadFile = class extends ASTNode_1.default {
      statements;
      tokens;
      constructor(statements, tokens) {
        super();
        this.statements = statements;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitScadFile(this);
      }
    };
    exports.default = ScadFile;
  }
});

// node_modules/openscad-parser/dist/ast/expressions.js
var require_expressions = __commonJS({
  "node_modules/openscad-parser/dist/ast/expressions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnonymousFunctionExpr = exports.GroupingExpr = exports.LcLetExpr = exports.LcForCExpr = exports.LcForExpr = exports.LcEachExpr = exports.LcIfExpr = exports.ListComprehensionExpression = exports.EchoExpr = exports.AssertExpr = exports.LetExpr = exports.FunctionCallLikeExpr = exports.FunctionCallExpr = exports.MemberLookupExpr = exports.LookupExpr = exports.VectorExpr = exports.RangeExpr = exports.LiteralExpr = exports.ArrayLookupExpr = exports.TernaryExpr = exports.BinaryOpExpr = exports.UnaryOpExpr = exports.Expression = void 0;
    var ASTNode_1 = require_ASTNode();
    var Expression = class extends ASTNode_1.default {
    };
    exports.Expression = Expression;
    var UnaryOpExpr = class extends Expression {
      tokens;
      /**
       * The operation of this unary expression.
       */
      operation;
      /**
       * The expression on which the operation is performed.
       */
      right;
      constructor(op, right, tokens) {
        super();
        this.tokens = tokens;
        this.operation = op;
        this.right = right;
      }
      accept(visitor) {
        return visitor.visitUnaryOpExpr(this);
      }
    };
    exports.UnaryOpExpr = UnaryOpExpr;
    var BinaryOpExpr = class extends Expression {
      tokens;
      /**
       * The left side of the operation.
       */
      left;
      /**
       * The type of the operation performed.
       */
      operation;
      /**
       * The right side of the operation
       */
      right;
      constructor(left, operation, right, tokens) {
        super();
        this.tokens = tokens;
        this.left = left;
        this.operation = operation;
        this.right = right;
      }
      accept(visitor) {
        return visitor.visitBinaryOpExpr(this);
      }
    };
    exports.BinaryOpExpr = BinaryOpExpr;
    var TernaryExpr = class extends Expression {
      tokens;
      cond;
      ifExpr;
      elseExpr;
      constructor(cond, ifExpr, elseExpr, tokens) {
        super();
        this.tokens = tokens;
        this.cond = cond;
        this.ifExpr = ifExpr;
        this.elseExpr = elseExpr;
      }
      accept(visitor) {
        return visitor.visitTernaryExpr(this);
      }
    };
    exports.TernaryExpr = TernaryExpr;
    var ArrayLookupExpr = class extends Expression {
      tokens;
      /**
       * The array being indexed.
       */
      array;
      /**
       * The index which is being looked up.
       */
      index;
      constructor(array, index, tokens) {
        super();
        this.tokens = tokens;
        this.array = array;
        this.index = index;
      }
      accept(visitor) {
        return visitor.visitArrayLookupExpr(this);
      }
    };
    exports.ArrayLookupExpr = ArrayLookupExpr;
    var LiteralExpr = class extends Expression {
      tokens;
      value;
      constructor(value, tokens) {
        super();
        this.tokens = tokens;
        this.value = value;
      }
      accept(visitor) {
        return visitor.visitLiteralExpr(this);
      }
    };
    exports.LiteralExpr = LiteralExpr;
    var RangeExpr = class extends Expression {
      tokens;
      begin;
      /**
       * The optional step expression.
       * It defaults to 1 if not specified.
       */
      step;
      end;
      constructor(begin, step, end, tokens) {
        super();
        this.tokens = tokens;
        this.begin = begin;
        this.step = step;
        this.end = end;
      }
      accept(visitor) {
        return visitor.visitRangeExpr(this);
      }
    };
    exports.RangeExpr = RangeExpr;
    var VectorExpr = class extends Expression {
      tokens;
      children;
      constructor(children, tokens) {
        super();
        this.tokens = tokens;
        this.children = children;
      }
      accept(visitor) {
        return visitor.visitVectorExpr(this);
      }
    };
    exports.VectorExpr = VectorExpr;
    var LookupExpr = class extends Expression {
      tokens;
      name;
      constructor(name, tokens) {
        super();
        this.tokens = tokens;
        this.name = name;
      }
      accept(visitor) {
        return visitor.visitLookupExpr(this);
      }
    };
    exports.LookupExpr = LookupExpr;
    var MemberLookupExpr = class extends Expression {
      tokens;
      expr;
      member;
      constructor(expr, member, tokens) {
        super();
        this.tokens = tokens;
        this.expr = expr;
        this.member = member;
      }
      accept(visitor) {
        return visitor.visitMemberLookupExpr(this);
      }
    };
    exports.MemberLookupExpr = MemberLookupExpr;
    var FunctionCallExpr = class extends Expression {
      tokens;
      /**
       * The expression that is being called.
       */
      callee;
      /**
       * The named arguments of the function call
       */
      args;
      constructor(callee, args, tokens) {
        super();
        this.tokens = tokens;
        this.callee = callee;
        this.args = args;
      }
      accept(visitor) {
        return visitor.visitFunctionCallExpr(this);
      }
    };
    exports.FunctionCallExpr = FunctionCallExpr;
    var FunctionCallLikeExpr = class extends Expression {
      tokens;
      /**
       * The names of the assigned variables in this let expression.
       */
      args;
      /**
       * The inner expression which will use the expression.
       */
      expr;
      constructor(args, expr, tokens) {
        super();
        this.tokens = tokens;
        this.args = args;
        this.expr = expr;
      }
    };
    exports.FunctionCallLikeExpr = FunctionCallLikeExpr;
    var LetExpr = class extends FunctionCallLikeExpr {
      accept(visitor) {
        return visitor.visitLetExpr(this);
      }
    };
    exports.LetExpr = LetExpr;
    var AssertExpr = class extends FunctionCallLikeExpr {
      accept(visitor) {
        return visitor.visitAssertExpr(this);
      }
    };
    exports.AssertExpr = AssertExpr;
    var EchoExpr = class extends FunctionCallLikeExpr {
      accept(visitor) {
        return visitor.visitEchoExpr(this);
      }
    };
    exports.EchoExpr = EchoExpr;
    var ListComprehensionExpression = class extends Expression {
    };
    exports.ListComprehensionExpression = ListComprehensionExpression;
    var LcIfExpr = class extends ListComprehensionExpression {
      tokens;
      cond;
      ifExpr;
      elseExpr;
      constructor(cond, ifExpr, elseExpr, tokens) {
        super();
        this.tokens = tokens;
        this.cond = cond;
        this.ifExpr = ifExpr;
        this.elseExpr = elseExpr;
      }
      accept(visitor) {
        return visitor.visitLcIfExpr(this);
      }
    };
    exports.LcIfExpr = LcIfExpr;
    var LcEachExpr = class extends ListComprehensionExpression {
      tokens;
      /**
       * The expression where the declared variables will be accessible.
       */
      expr;
      constructor(expr, tokens) {
        super();
        this.tokens = tokens;
        this.expr = expr;
      }
      accept(visitor) {
        return visitor.visitLcEachExpr(this);
      }
    };
    exports.LcEachExpr = LcEachExpr;
    var LcForExpr = class extends ListComprehensionExpression {
      tokens;
      /**
       * The variable names in the for expression
       */
      args;
      /**
       * The expression which will be looped.
       */
      expr;
      constructor(args, expr, tokens) {
        super();
        this.tokens = tokens;
        this.args = args;
        this.expr = expr;
      }
      accept(visitor) {
        return visitor.visitLcForExpr(this);
      }
    };
    exports.LcForExpr = LcForExpr;
    var LcForCExpr = class extends ListComprehensionExpression {
      tokens;
      /**
       * The variable names in the for expression
       */
      args;
      incrArgs;
      cond;
      /**
       * The expression which will be looped.
       */
      expr;
      constructor(args, incrArgs, cond, expr, tokens) {
        super();
        this.tokens = tokens;
        this.args = args;
        this.incrArgs = incrArgs;
        this.cond = cond;
        this.expr = expr;
      }
      accept(visitor) {
        return visitor.visitLcForCExpr(this);
      }
    };
    exports.LcForCExpr = LcForCExpr;
    var LcLetExpr = class extends ListComprehensionExpression {
      tokens;
      /**
       * The variable names in the let expression
       */
      args;
      /**
       * The expression where the declared variables will be accessible.
       */
      expr;
      constructor(args, expr, tokens) {
        super();
        this.tokens = tokens;
        this.args = args;
        this.expr = expr;
      }
      accept(visitor) {
        return visitor.visitLcLetExpr(this);
      }
    };
    exports.LcLetExpr = LcLetExpr;
    var GroupingExpr = class extends Expression {
      tokens;
      inner;
      constructor(inner, tokens) {
        super();
        this.tokens = tokens;
        this.inner = inner;
      }
      accept(visitor) {
        return visitor.visitGroupingExpr(this);
      }
    };
    exports.GroupingExpr = GroupingExpr;
    var AnonymousFunctionExpr = class extends Expression {
      definitionArgs;
      expr;
      tokens;
      constructor(definitionArgs, expr, tokens) {
        super();
        this.definitionArgs = definitionArgs;
        this.expr = expr;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitAnonymousFunctionExpr(this);
      }
    };
    exports.AnonymousFunctionExpr = AnonymousFunctionExpr;
  }
});

// node_modules/openscad-parser/dist/ast/statements.js
var require_statements = __commonJS({
  "node_modules/openscad-parser/dist/ast/statements.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.IfElseStatement = exports.NoopStmt = exports.BlockStmt = exports.FunctionDeclarationStmt = exports.ModuleDeclarationStmt = exports.ModuleInstantiationStmt = exports.IncludeStmt = exports.UseStmt = exports.Statement = void 0;
    var ASTNode_1 = require_ASTNode();
    var Statement = class extends ASTNode_1.default {
    };
    exports.Statement = Statement;
    var UseStmt = class extends Statement {
      filename;
      tokens;
      /**
       *
       * @param pos
       * @param filename The used filename
       */
      constructor(filename, tokens) {
        super();
        this.filename = filename;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitUseStmt(this);
      }
    };
    exports.UseStmt = UseStmt;
    var IncludeStmt = class extends Statement {
      filename;
      tokens;
      /**
       *
       * @param pos
       * @param filename The used filename
       */
      constructor(filename, tokens) {
        super();
        this.filename = filename;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitIncludeStmt(this);
      }
    };
    exports.IncludeStmt = IncludeStmt;
    var ModuleInstantiationStmt = class extends Statement {
      name;
      args;
      child;
      tokens;
      /**
       * !
       */
      tagRoot = false;
      /**
       * #
       */
      tagHighlight = false;
      /**
       * %
       */
      tagBackground = false;
      /**
       * *
       */
      tagDisabled = false;
      constructor(name, args, child, tokens) {
        super();
        this.name = name;
        this.args = args;
        this.child = child;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitModuleInstantiationStmt(this);
      }
    };
    exports.ModuleInstantiationStmt = ModuleInstantiationStmt;
    var ModuleDeclarationStmt = class extends Statement {
      name;
      definitionArgs;
      stmt;
      tokens;
      docComment;
      constructor(name, definitionArgs, stmt, tokens, docComment) {
        super();
        this.name = name;
        this.definitionArgs = definitionArgs;
        this.stmt = stmt;
        this.tokens = tokens;
        this.docComment = docComment;
      }
      accept(visitor) {
        return visitor.visitModuleDeclarationStmt(this);
      }
    };
    exports.ModuleDeclarationStmt = ModuleDeclarationStmt;
    var FunctionDeclarationStmt = class extends Statement {
      name;
      definitionArgs;
      expr;
      tokens;
      docComment;
      constructor(name, definitionArgs, expr, tokens, docComment) {
        super();
        this.name = name;
        this.definitionArgs = definitionArgs;
        this.expr = expr;
        this.tokens = tokens;
        this.docComment = docComment;
      }
      accept(visitor) {
        return visitor.visitFunctionDeclarationStmt(this);
      }
    };
    exports.FunctionDeclarationStmt = FunctionDeclarationStmt;
    var BlockStmt = class extends Statement {
      children;
      tokens;
      constructor(children, tokens) {
        super();
        this.children = children;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitBlockStmt(this);
      }
    };
    exports.BlockStmt = BlockStmt;
    var NoopStmt = class extends Statement {
      tokens;
      constructor(tokens) {
        super();
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitNoopStmt(this);
      }
    };
    exports.NoopStmt = NoopStmt;
    var IfElseStatement = class extends Statement {
      cond;
      thenBranch;
      elseBranch;
      tokens;
      tagRoot = false;
      tagHighlight = false;
      tagBackground = false;
      tagDisabled = false;
      constructor(cond, thenBranch, elseBranch, tokens) {
        super();
        this.cond = cond;
        this.thenBranch = thenBranch;
        this.elseBranch = elseBranch;
        this.tokens = tokens;
      }
      accept(visitor) {
        return visitor.visitIfElseStatement(this);
      }
    };
    exports.IfElseStatement = IfElseStatement;
  }
});

// node_modules/openscad-parser/dist/semantic/nodesWithScopes.js
var require_nodesWithScopes = __commonJS({
  "node_modules/openscad-parser/dist/semantic/nodesWithScopes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnonymousFunctionExprWithScope = exports.LcForCExprWithScope = exports.LcForExprWithScope = exports.LcLetExprWithScope = exports.ModuleInstantiationStmtWithScope = exports.ModuleDeclarationStmtWithScope = exports.FunctionDeclarationStmtWithScope = exports.ScadFileWithScope = exports.LetExprWithScope = exports.BlockStmtWithScope = void 0;
    var expressions_1 = require_expressions();
    var ScadFile_1 = require_ScadFile();
    var statements_1 = require_statements();
    var BlockStmtWithScope = class extends statements_1.BlockStmt {
      scope;
      accept(visitor) {
        if (visitor.visitBlockStmtWithScope) {
          return visitor.visitBlockStmtWithScope(this);
        }
        return visitor.visitBlockStmt(this);
      }
    };
    exports.BlockStmtWithScope = BlockStmtWithScope;
    var LetExprWithScope = class extends expressions_1.LetExpr {
      scope;
      accept(visitor) {
        if (visitor.visitLetExprWithScope) {
          return visitor.visitLetExprWithScope(this);
        }
        return visitor.visitLetExpr(this);
      }
    };
    exports.LetExprWithScope = LetExprWithScope;
    var ScadFileWithScope = class extends ScadFile_1.default {
      scope;
      accept(visitor) {
        if (visitor.visitScadFileWithScope) {
          return visitor.visitScadFileWithScope(this);
        }
        return visitor.visitScadFile(this);
      }
    };
    exports.ScadFileWithScope = ScadFileWithScope;
    var FunctionDeclarationStmtWithScope = class extends statements_1.FunctionDeclarationStmt {
      scope;
      accept(visitor) {
        if (visitor.visitFunctionDeclarationStmtWithScope) {
          return visitor.visitFunctionDeclarationStmtWithScope(this);
        }
        return visitor.visitFunctionDeclarationStmt(this);
      }
    };
    exports.FunctionDeclarationStmtWithScope = FunctionDeclarationStmtWithScope;
    var ModuleDeclarationStmtWithScope = class extends statements_1.ModuleDeclarationStmt {
      scope;
      accept(visitor) {
        if (visitor.visitModuleDeclarationStmtWithScope) {
          return visitor.visitModuleDeclarationStmtWithScope(this);
        }
        return visitor.visitModuleDeclarationStmt(this);
      }
    };
    exports.ModuleDeclarationStmtWithScope = ModuleDeclarationStmtWithScope;
    var ModuleInstantiationStmtWithScope = class extends statements_1.ModuleInstantiationStmt {
      scope;
      accept(visitor) {
        if (visitor.visitModuleInstantiationStmtWithScope) {
          return visitor.visitModuleInstantiationStmtWithScope(this);
        }
        return visitor.visitModuleInstantiationStmt(this);
      }
    };
    exports.ModuleInstantiationStmtWithScope = ModuleInstantiationStmtWithScope;
    var LcLetExprWithScope = class extends expressions_1.LcLetExpr {
      scope;
      accept(visitor) {
        if (visitor.visitLcLetExprWithScope) {
          return visitor.visitLcLetExprWithScope(this);
        }
        return visitor.visitLcLetExpr(this);
      }
    };
    exports.LcLetExprWithScope = LcLetExprWithScope;
    var LcForExprWithScope = class extends expressions_1.LcForExpr {
      scope;
      accept(visitor) {
        if (visitor.visitLcForExprWithScope) {
          return visitor.visitLcForExprWithScope(this);
        }
        return visitor.visitLcForExpr(this);
      }
    };
    exports.LcForExprWithScope = LcForExprWithScope;
    var LcForCExprWithScope = class extends expressions_1.LcForCExpr {
      scope;
      accept(visitor) {
        if (visitor.visitLcForCExprWithScope) {
          return visitor.visitLcForCExprWithScope(this);
        }
        return visitor.visitLcForCExpr(this);
      }
    };
    exports.LcForCExprWithScope = LcForCExprWithScope;
    var AnonymousFunctionExprWithScope = class extends expressions_1.AnonymousFunctionExpr {
      scope;
      accept(visitor) {
        if (visitor.visitAnonymousFunctionExprWithScope) {
          return visitor.visitAnonymousFunctionExprWithScope(this);
        }
        return visitor.visitAnonymousFunctionExpr(this);
      }
    };
    exports.AnonymousFunctionExprWithScope = AnonymousFunctionExprWithScope;
  }
});

// node_modules/openscad-parser/dist/ast/AssignmentNode.js
var require_AssignmentNode = __commonJS({
  "node_modules/openscad-parser/dist/ast/AssignmentNode.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AssignmentNodeRole = void 0;
    var ASTNode_1 = require_ASTNode();
    var AssignmentNodeRole;
    (function(AssignmentNodeRole2) {
      AssignmentNodeRole2[AssignmentNodeRole2["VARIABLE_DECLARATION"] = 0] = "VARIABLE_DECLARATION";
      AssignmentNodeRole2[AssignmentNodeRole2["ARGUMENT_DECLARATION"] = 1] = "ARGUMENT_DECLARATION";
      AssignmentNodeRole2[AssignmentNodeRole2["ARGUMENT_ASSIGNMENT"] = 2] = "ARGUMENT_ASSIGNMENT";
    })(AssignmentNodeRole || (exports.AssignmentNodeRole = AssignmentNodeRole = {}));
    var AssignmentNode = class extends ASTNode_1.default {
      role;
      tokens;
      /**
       * The name of the value being assigned.
       * The name field may be empty when it represents a positional argument in a call.
       */
      name;
      /**
       * THe value of the name being assigned.
       * It can be null when the AssignmentNode is used as a function parameter without a default value.
       */
      value;
      /**
       * The documentation and annotations connected with this variable.
       */
      docComment = null;
      constructor(name, value, role, tokens) {
        super();
        this.role = role;
        this.tokens = tokens;
        this.name = name;
        this.value = value;
      }
      accept(visitor) {
        return visitor.visitAssignmentNode(this);
      }
    };
    exports.default = AssignmentNode;
  }
});

// node_modules/openscad-parser/dist/ASTMutator.js
var require_ASTMutator = __commonJS({
  "node_modules/openscad-parser/dist/ASTMutator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ScadFile_1 = require_ScadFile();
    var expressions_1 = require_expressions();
    var statements_1 = require_statements();
    var nodesWithScopes_1 = require_nodesWithScopes();
    var AssignmentNode_1 = require_AssignmentNode();
    var ASTMutator = class {
      visitScadFile(n) {
        const stmts = n.statements.map((s) => s.accept(this));
        if (stmts.length === n.statements.length) {
          let modified = false;
          for (let i = 0; i < stmts.length; i++) {
            if (stmts[i] !== n.statements[i]) {
              modified = true;
              break;
            }
          }
          if (!modified) {
            return n;
          }
        }
        return new ScadFile_1.default(stmts, n.tokens);
      }
      visitAssignmentNode(n) {
        const newValue = n.value ? n.value.accept(this) : null;
        if (newValue === n.value) {
          return n;
        }
        return new AssignmentNode_1.default(n.name, newValue, n.role, n.tokens);
      }
      visitUnaryOpExpr(n) {
        const newRight = n.right.accept(this);
        if (newRight === n.right) {
          return n;
        }
        return new expressions_1.UnaryOpExpr(n.operation, newRight, n.tokens);
      }
      visitBinaryOpExpr(n) {
        const newLeft = n.left.accept(this);
        const newRight = n.right.accept(this);
        if (newRight === n.right && newLeft === n.left) {
          return n;
        }
        return new expressions_1.BinaryOpExpr(newLeft, n.operation, newRight, n.tokens);
      }
      visitTernaryExpr(n) {
        const newCond = n.cond.accept(this);
        const newIfExpr = n.ifExpr.accept(this);
        const newElseExpr = n.elseExpr.accept(this);
        if (newCond === n.cond && newIfExpr === n.ifExpr && newElseExpr === n.elseExpr) {
          return n;
        }
        return new expressions_1.TernaryExpr(n.cond, n.ifExpr, n.elseExpr, n.tokens);
      }
      visitArrayLookupExpr(n) {
        const newArray = n.array.accept(this);
        const newIndex = n.index.accept(this);
        if (newArray === n.array && newIndex === n.index) {
          return n;
        }
        return new expressions_1.ArrayLookupExpr(newArray, newIndex, n.tokens);
      }
      visitLiteralExpr(n) {
        return n;
      }
      visitRangeExpr(n) {
        const newBegin = n.begin.accept(this);
        const newStep = n.step ? n.step.accept(this) : null;
        const newEnd = n.end.accept(this);
        if (newBegin === n.begin && newStep === n.step && newEnd === n.end) {
          return n;
        }
        return new expressions_1.RangeExpr(newBegin, newStep, newEnd, n.tokens);
      }
      visitVectorExpr(n) {
        const newChildren = n.children.map((c) => c.accept(this));
        if (newChildren.length === n.children.length) {
          let modified = false;
          for (let i = 0; i < newChildren.length; i++) {
            if (newChildren[i] !== n.children[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.VectorExpr(newChildren, n.tokens);
      }
      visitLookupExpr(n) {
        return n;
      }
      visitMemberLookupExpr(n) {
        const newExpr = n.expr.accept(this);
        if (newExpr === n.expr) {
          return n;
        }
        return new expressions_1.MemberLookupExpr(newExpr, n.member, n.tokens);
      }
      visitFunctionCallExpr(n) {
        const newArgs = n.args.map((a) => a.accept(this));
        const newCalee = n.callee.accept(this);
        if (newArgs.length === n.args.length && newCalee === n.callee) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.FunctionCallExpr(newCalee, newArgs, n.tokens);
      }
      visitLetExpr(n) {
        const newExpr = n.expr.accept(this);
        const newArgs = n.args.map((a) => a.accept(this));
        if (newArgs.length === n.args.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.LetExpr(newArgs, newExpr, n.tokens);
      }
      visitAssertExpr(n) {
        const newExpr = n.expr.accept(this);
        const newArgs = n.args.map((a) => a.accept(this));
        if (newArgs.length === n.args.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.AssertExpr(newArgs, newExpr, n.tokens);
      }
      visitEchoExpr(n) {
        const newExpr = n.expr.accept(this);
        const newArgs = n.args.map((a) => a.accept(this));
        if (newArgs.length === n.args.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.EchoExpr(newArgs, newExpr, n.tokens);
      }
      visitLcIfExpr(n) {
        const newCond = n.cond.accept(this);
        const newIfExpr = n.ifExpr.accept(this);
        const newElseExpr = n.elseExpr ? n.elseExpr.accept(this) : null;
        if (newCond === n.cond && newIfExpr === n.ifExpr && newElseExpr === n.elseExpr) {
          return n;
        }
        return new expressions_1.LcIfExpr(newCond, newIfExpr, newElseExpr, n.tokens);
      }
      visitLcEachExpr(n) {
        const newExpr = n.expr.accept(this);
        if (newExpr === n.expr) {
          return n;
        }
        return new expressions_1.LcEachExpr(newExpr, n.tokens);
      }
      visitLcForExpr(n) {
        const newExpr = n.expr.accept(this);
        const newArgs = n.args.map((a) => a.accept(this));
        if (newArgs.length === n.args.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.LcForExpr(newArgs, newExpr, n.tokens);
      }
      visitLcForCExpr(n) {
        const newArgs = n.args.map((a) => a.accept(this));
        const newIncrArgs = n.incrArgs.map((a) => a.accept(this));
        const newExpr = n.expr.accept(this);
        const newCond = n.cond.accept(this);
        if (newArgs.length === n.args.length && newIncrArgs.length === n.incrArgs.length && newExpr === n.expr && newCond === n.cond) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          for (let i = 0; i < newIncrArgs.length; i++) {
            if (newIncrArgs[i] !== n.incrArgs[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.LcForCExpr(newArgs, newIncrArgs, newCond, newExpr, n.tokens);
      }
      visitLcLetExpr(n) {
        const newExpr = n.expr.accept(this);
        const newArgs = n.args.map((a) => a.accept(this));
        if (newArgs.length === n.args.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.args[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.LcLetExpr(newArgs, newExpr, n.tokens);
      }
      visitGroupingExpr(n) {
        const newInner = n.inner.accept(this);
        if (newInner === n.inner) {
          return n;
        }
        return new expressions_1.GroupingExpr(n.inner.accept(this), n.tokens);
      }
      visitUseStmt(n) {
        return n;
      }
      visitIncludeStmt(n) {
        return n;
      }
      visitModuleInstantiationStmt(n) {
        const inst = new statements_1.ModuleInstantiationStmt(n.name, n.args.map((a) => a.accept(this)), n.child ? n.child.accept(this) : null, n.tokens);
        inst.tagRoot = n.tagRoot;
        inst.tagHighlight = n.tagHighlight;
        inst.tagBackground = n.tagBackground;
        inst.tagDisabled = n.tagDisabled;
        return inst;
      }
      visitModuleDeclarationStmt(n) {
        const newDefinitionArgs = n.definitionArgs.map((a) => a.accept(this));
        const newStmt = n.stmt.accept(this);
        if (newDefinitionArgs.length === n.definitionArgs.length && newStmt === n.stmt) {
          let modified = false;
          for (let i = 0; i < newDefinitionArgs.length; i++) {
            if (newDefinitionArgs[i] !== n.definitionArgs[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new statements_1.ModuleDeclarationStmt(n.name, newDefinitionArgs, newStmt, n.tokens, n.docComment);
      }
      visitFunctionDeclarationStmt(n) {
        const newDefinitionArgs = n.definitionArgs.map((a) => a.accept(this));
        const newExpr = n.expr.accept(this);
        if (newDefinitionArgs.length === n.definitionArgs.length && newExpr === n.expr) {
          let modified = false;
          for (let i = 0; i < newDefinitionArgs.length; i++) {
            if (newDefinitionArgs[i] !== n.definitionArgs[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new statements_1.FunctionDeclarationStmt(n.name, newDefinitionArgs, newExpr, n.tokens, n.docComment);
      }
      visitBlockStmt(n) {
        const children = n.children.map((s) => s.accept(this));
        if (children.length === n.children.length) {
          let modified = false;
          for (let i = 0; i < children.length; i++) {
            if (children[i] !== n.children[i]) {
              modified = true;
              break;
            }
          }
          if (!modified) {
            return n;
          }
        }
        return new statements_1.BlockStmt(children, n.tokens);
      }
      visitNoopStmt(n) {
        return n;
      }
      visitIfElseStatement(n) {
        const newCond = n.cond.accept(this);
        const newThenBranch = n.thenBranch.accept(this);
        const newElseBranch = n.elseBranch ? n.elseBranch.accept(this) : null;
        if (newCond === n.cond && newThenBranch === n.thenBranch && newElseBranch === n.elseBranch) {
          return n;
        }
        return new statements_1.IfElseStatement(newCond, newThenBranch, newElseBranch, n.tokens);
      }
      visitErrorNode(n) {
        return n;
      }
      visitAnonymousFunctionExpr(n) {
        const newArgs = n.definitionArgs.map((a) => a.accept(this));
        const newBody = n.expr.accept(this);
        if (newArgs.length === n.definitionArgs.length && newBody === n.expr) {
          let modified = false;
          for (let i = 0; i < newArgs.length; i++) {
            if (newArgs[i] !== n.definitionArgs[i]) {
              modified = true;
              break;
            }
          }
          if (!modified)
            return n;
        }
        return new expressions_1.AnonymousFunctionExpr(newArgs, newBody, n.tokens);
      }
      visitBlockStmtWithScope(n) {
        const oldNode = this.visitBlockStmt(n);
        const newNode = new nodesWithScopes_1.BlockStmtWithScope(oldNode.children, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitLetExprWithScope(n) {
        const oldNode = this.visitLetExpr(n);
        const newNode = new nodesWithScopes_1.LetExprWithScope(oldNode.args, oldNode.expr, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitScadFileWithScope(n) {
        const oldNode = this.visitScadFile(n);
        const newNode = new nodesWithScopes_1.ScadFileWithScope(oldNode.statements, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitFunctionDeclarationStmtWithScope(n) {
        const oldNode = this.visitFunctionDeclarationStmt(n);
        const newNode = new nodesWithScopes_1.FunctionDeclarationStmtWithScope(oldNode.name, oldNode.definitionArgs, oldNode.expr, oldNode.tokens, oldNode.docComment);
        newNode.scope = n.scope;
        return newNode;
      }
      visitModuleDeclarationStmtWithScope(n) {
        const oldNode = this.visitModuleDeclarationStmt(n);
        const newNode = new nodesWithScopes_1.ModuleDeclarationStmtWithScope(oldNode.name, oldNode.definitionArgs, oldNode.stmt, oldNode.tokens, n.docComment);
        newNode.scope = n.scope;
        return newNode;
      }
      visitModuleInstantiationStmtWithScope(n) {
        const oldNode = this.visitModuleInstantiationStmt(n);
        const newNode = new nodesWithScopes_1.ModuleInstantiationStmtWithScope(oldNode.name, oldNode.args, oldNode.child, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitLcLetExprWithScope(n) {
        const oldNode = this.visitLcLetExpr(n);
        const newNode = new nodesWithScopes_1.LcLetExprWithScope(oldNode.args, oldNode.expr, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitLcForExprWithScope(n) {
        const oldNode = this.visitLcForExpr(n);
        const newNode = new nodesWithScopes_1.LcForExprWithScope(oldNode.args, oldNode.expr, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitLcForCExprWithScope(n) {
        const oldNode = this.visitLcForCExpr(n);
        const newNode = new nodesWithScopes_1.LcForCExprWithScope(oldNode.args, oldNode.incrArgs, oldNode.cond, oldNode.expr, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
      visitAnonymousFunctionExprWithScope(n) {
        const oldNode = this.visitAnonymousFunctionExpr(n);
        const newNode = new nodesWithScopes_1.AnonymousFunctionExprWithScope(oldNode.definitionArgs, oldNode.expr, oldNode.tokens);
        newNode.scope = n.scope;
        return newNode;
      }
    };
    exports.default = ASTMutator;
  }
});

// node_modules/openscad-parser/dist/extraTokens.js
var require_extraTokens = __commonJS({
  "node_modules/openscad-parser/dist/extraTokens.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MultiLineComment = exports.SingleLineComment = exports.NewLineExtraToken = exports.ExtraToken = void 0;
    var ExtraToken = class {
      pos;
      constructor(pos) {
        this.pos = pos;
      }
    };
    exports.ExtraToken = ExtraToken;
    var NewLineExtraToken = class extends ExtraToken {
    };
    exports.NewLineExtraToken = NewLineExtraToken;
    var SingleLineComment = class extends ExtraToken {
      contents;
      constructor(pos, contents) {
        super(pos);
        this.contents = contents;
      }
    };
    exports.SingleLineComment = SingleLineComment;
    var MultiLineComment = class extends ExtraToken {
      contents;
      constructor(pos, contents) {
        super(pos);
        this.contents = contents;
      }
    };
    exports.MultiLineComment = MultiLineComment;
  }
});

// node_modules/openscad-parser/dist/TokenType.js
var require_TokenType = __commonJS({
  "node_modules/openscad-parser/dist/TokenType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TokenType;
    (function(TokenType2) {
      TokenType2[TokenType2["Error"] = 0] = "Error";
      TokenType2[TokenType2["Eot"] = 1] = "Eot";
      TokenType2[TokenType2["Module"] = 2] = "Module";
      TokenType2[TokenType2["Function"] = 3] = "Function";
      TokenType2[TokenType2["If"] = 4] = "If";
      TokenType2[TokenType2["Else"] = 5] = "Else";
      TokenType2[TokenType2["For"] = 6] = "For";
      TokenType2[TokenType2["Let"] = 7] = "Let";
      TokenType2[TokenType2["Assert"] = 8] = "Assert";
      TokenType2[TokenType2["Echo"] = 9] = "Echo";
      TokenType2[TokenType2["Each"] = 10] = "Each";
      TokenType2[TokenType2["Use"] = 11] = "Use";
      TokenType2[TokenType2["Identifier"] = 12] = "Identifier";
      TokenType2[TokenType2["StringLiteral"] = 13] = "StringLiteral";
      TokenType2[TokenType2["NumberLiteral"] = 14] = "NumberLiteral";
      TokenType2[TokenType2["True"] = 15] = "True";
      TokenType2[TokenType2["False"] = 16] = "False";
      TokenType2[TokenType2["Undef"] = 17] = "Undef";
      TokenType2[TokenType2["Bang"] = 18] = "Bang";
      TokenType2[TokenType2["Less"] = 19] = "Less";
      TokenType2[TokenType2["Greater"] = 20] = "Greater";
      TokenType2[TokenType2["LessEqual"] = 21] = "LessEqual";
      TokenType2[TokenType2["GreaterEqual"] = 22] = "GreaterEqual";
      TokenType2[TokenType2["EqualEqual"] = 23] = "EqualEqual";
      TokenType2[TokenType2["Equal"] = 24] = "Equal";
      TokenType2[TokenType2["BangEqual"] = 25] = "BangEqual";
      TokenType2[TokenType2["AND"] = 26] = "AND";
      TokenType2[TokenType2["OR"] = 27] = "OR";
      TokenType2[TokenType2["Plus"] = 28] = "Plus";
      TokenType2[TokenType2["Minus"] = 29] = "Minus";
      TokenType2[TokenType2["Star"] = 30] = "Star";
      TokenType2[TokenType2["Slash"] = 31] = "Slash";
      TokenType2[TokenType2["Percent"] = 32] = "Percent";
      TokenType2[TokenType2["Caret"] = 33] = "Caret";
      TokenType2[TokenType2["LeftParen"] = 34] = "LeftParen";
      TokenType2[TokenType2["RightParen"] = 35] = "RightParen";
      TokenType2[TokenType2["LeftBracket"] = 36] = "LeftBracket";
      TokenType2[TokenType2["RightBracket"] = 37] = "RightBracket";
      TokenType2[TokenType2["LeftBrace"] = 38] = "LeftBrace";
      TokenType2[TokenType2["RightBrace"] = 39] = "RightBrace";
      TokenType2[TokenType2["Semicolon"] = 40] = "Semicolon";
      TokenType2[TokenType2["Comma"] = 41] = "Comma";
      TokenType2[TokenType2["Dot"] = 42] = "Dot";
      TokenType2[TokenType2["QuestionMark"] = 43] = "QuestionMark";
      TokenType2[TokenType2["Colon"] = 44] = "Colon";
      TokenType2[TokenType2["Hash"] = 45] = "Hash";
      TokenType2[TokenType2["FilenameInChevrons"] = 46] = "FilenameInChevrons";
      TokenType2[TokenType2["Include"] = 47] = "Include";
    })(TokenType || (TokenType = {}));
    exports.default = TokenType;
  }
});

// node_modules/openscad-parser/dist/Token.js
var require_Token = __commonJS({
  "node_modules/openscad-parser/dist/Token.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var extraTokens_1 = require_extraTokens();
    var TokenType_1 = require_TokenType();
    var Token = class {
      type;
      span;
      lexeme;
      /**
       * All the newlines and comments that appear before this token and should be preserved when printing the AST.
       */
      extraTokens = [];
      /**
       * Start of this token, including all the whitespace before it.
       *
       * Set externally in the lexer.
       */
      startWithWhitespace;
      constructor(type, span, lexeme) {
        this.type = type;
        this.span = span;
        this.lexeme = lexeme;
      }
      toString() {
        return `token ${TokenType_1.default[this.type]} ${this.span.toString()}`;
      }
      hasNewlineInExtraTokens() {
        return this.extraTokens.some((t) => t instanceof extraTokens_1.NewLineExtraToken);
      }
    };
    exports.default = Token;
  }
});

// node_modules/openscad-parser/dist/ASTPinpointer.js
var require_ASTPinpointer = __commonJS({
  "node_modules/openscad-parser/dist/ASTPinpointer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BinBefore = exports.BinAfter = void 0;
    var ASTNode_1 = require_ASTNode();
    var ASTAssembler_1 = require_ASTAssembler();
    var Token_1 = require_Token();
    exports.BinAfter = /* @__PURE__ */ Symbol("BinAfter");
    exports.BinBefore = /* @__PURE__ */ Symbol("BinBefore");
    var ASTPinpointer = class extends ASTAssembler_1.default {
      pinpointLocation;
      /**
       * Contains all the ancestors of the pinpointed nodes. The pinpointed node is always first.
       */
      bottomUpHierarchy = [];
      constructor(pinpointLocation) {
        super();
        this.pinpointLocation = pinpointLocation;
      }
      /**
       * Returns the node at pinpointLocation and populates bottomUpHierarchy.
       * @param n The AST (or AST fragment) to search through.
       */
      doPinpoint(n) {
        this.bottomUpHierarchy = [];
        return n.accept(this);
      }
      processAssembledNode(t, self) {
        let l = 0, r = t.length - 1;
        while (l <= r) {
          let pivot = Math.floor((r + l) / 2);
          if (t[pivot] instanceof Token_1.default) {
            const tokenAtPiviot = t[pivot];
            if (tokenAtPiviot.span.end.char <= this.pinpointLocation.char) {
              l = pivot + 1;
              continue;
            }
            if (tokenAtPiviot.startWithWhitespace.char > this.pinpointLocation.char) {
              r = pivot - 1;
              continue;
            }
            this.bottomUpHierarchy.push(self);
            return self;
          } else if (typeof t[pivot] === "function") {
            const astFunc = t[pivot];
            const result = astFunc.call(this);
            if (result === exports.BinBefore) {
              r = pivot - 1;
              continue;
            }
            if (result === exports.BinAfter) {
              l = pivot + 1;
              continue;
            }
            if (result instanceof ASTNode_1.default) {
              this.bottomUpHierarchy.push(self);
              return result;
            }
          } else {
            throw new Error(`Bad element in token mix: ${typeof t[pivot]} at index ${pivot}.`);
          }
        }
        const firstThing = t[0];
        if (firstThing instanceof Token_1.default) {
          if (firstThing.span.end.char <= this.pinpointLocation.char) {
            return exports.BinAfter;
          }
          return exports.BinBefore;
        }
        if (typeof firstThing === "function") {
          return firstThing.call(this);
        }
        throw new Error(`Bad element in first token mix element. Recieved ${firstThing}, expected a function or a Token.`);
      }
    };
    exports.default = ASTPinpointer;
  }
});

// node_modules/openscad-parser/dist/ASTPrinter.js
var require_ASTPrinter = __commonJS({
  "node_modules/openscad-parser/dist/ASTPrinter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var statements_1 = require_statements();
    var extraTokens_1 = require_extraTokens();
    var TokenType_1 = require_TokenType();
    var ASTPrinter = class _ASTPrinter {
      config;
      indentLevel = 0;
      breakBetweenModuleInstantations = false;
      firstModuleInstantation = true;
      doNotAddNewlineAfterBlockStatement = false;
      /**
       * We store data that is global between all the copies of the ASTPrinter in an object so that it is passed by reference.
       */
      deepGlobals = {
        didAddNewline: false,
        shouldAddNewlineAfterNextComment: false,
        newlineAfterNextCommentReason: ""
      };
      constructor(config) {
        this.config = config;
      }
      visitErrorNode(n) {
        throw new Error("Cannot pretty print ast with an error node.");
      }
      visitScadFile(n) {
        let source = "";
        for (const stmt of n.statements) {
          source += this.processStatementWithBreakIfNeeded(stmt);
        }
        source += this.stringifyExtraTokens(n.tokens.eot);
        return source;
      }
      visitAssignmentNode(n) {
        let source = "";
        if (n.name) {
          source += this.stringifyExtraTokens(n.tokens.name);
          source += n.name;
          if (n.tokens.equals) {
            source += this.stringifyExtraTokens(n.tokens.equals);
            source += " = ";
          }
        }
        if (n.value) {
          source += n.value.accept(this);
        }
        if (n.tokens.trailingCommas && n.tokens.trailingCommas.length > 0) {
          for (const tc of n.tokens.trailingCommas) {
            source += this.stringifyExtraTokens(tc);
          }
          source += ", ";
        }
        if (n.tokens.semicolon) {
          source += this.stringifyExtraTokens(n.tokens.semicolon);
          source += ";";
          this.newLineAfterNextComment("after assignment");
        }
        return source;
      }
      visitUnaryOpExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.operator);
        if (n.operation === TokenType_1.default.Bang) {
          source += "!";
        } else if (n.operation === TokenType_1.default.Plus) {
          source += "+";
        } else if (n.operation === TokenType_1.default.Minus) {
          source += "-";
        }
        source += n.right.accept(this);
        return source;
      }
      visitBinaryOpExpr(n) {
        let source = "";
        source += n.left.accept(this);
        source += this.stringifyExtraTokens(n.tokens.operator);
        source += " ";
        if (n.operation === TokenType_1.default.Star) {
          source += "*";
        } else if (n.operation === TokenType_1.default.Slash) {
          source += "/";
        } else if (n.operation === TokenType_1.default.Caret) {
          source += "^";
        } else if (n.operation === TokenType_1.default.Percent) {
          source += "%";
        } else if (n.operation === TokenType_1.default.Less) {
          source += "<";
        } else if (n.operation === TokenType_1.default.LessEqual) {
          source += "<=";
        } else if (n.operation === TokenType_1.default.Greater) {
          source += ">";
        } else if (n.operation === TokenType_1.default.GreaterEqual) {
          source += ">=";
        } else if (n.operation === TokenType_1.default.AND) {
          source += "&&";
        } else if (n.operation === TokenType_1.default.OR) {
          source += "||";
        } else if (n.operation === TokenType_1.default.EqualEqual) {
          source += "==";
        } else if (n.operation === TokenType_1.default.BangEqual) {
          source += "!=";
        } else if (n.operation === TokenType_1.default.Plus) {
          source += "+";
        } else if (n.operation === TokenType_1.default.Minus) {
          source += "-";
        }
        source += " ";
        source += n.right.accept(this);
        return source;
      }
      visitTernaryExpr(n) {
        let source = "";
        source += n.cond.accept(this);
        source += this.stringifyExtraTokens(n.tokens.questionMark);
        source += " ? ";
        source += n.ifExpr.accept(this);
        source += this.stringifyExtraTokens(n.tokens.colon);
        source += " : ";
        source += n.elseExpr.accept(this);
        return source;
      }
      visitArrayLookupExpr(n) {
        let source = "";
        source += n.array.accept(this);
        source += this.stringifyExtraTokens(n.tokens.firstBracket);
        source += "[";
        source += n.index.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondBracket);
        source += "]";
        return source;
      }
      visitLiteralExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.literalToken);
        if (n.value === null) {
          source += "undef";
        } else if (typeof n.value === "string") {
          source += JSON.stringify(n.value);
        } else {
          source += n.value;
        }
        return source;
      }
      visitRangeExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.firstBracket);
        source += "[";
        source += n.begin.accept(this);
        source += this.stringifyExtraTokens(n.tokens.firstColon);
        source += " : ";
        if (n.step && n.tokens.secondColon) {
          source += n.step.accept(this);
          source += this.stringifyExtraTokens(n.tokens.secondColon);
          source += " : ";
        }
        source += n.end.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondBracket);
        source += "]";
        return source;
      }
      visitVectorExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.firstBracket);
        source += "[";
        let commaI = 0;
        for (let i = 0; i < n.children.length; i++) {
          const child = n.children[i];
          source += child.accept(this.copyWithIndent());
          if (i < n.children.length - 1) {
            source += this.stringifyExtraTokens(n.tokens.commas[commaI]);
            commaI++;
            source += ", ";
          }
        }
        for (; commaI < n.tokens.commas.length; commaI++) {
          source += this.stringifyExtraTokens(n.tokens.commas[commaI]);
        }
        source += this.stringifyExtraTokens(n.tokens.secondBracket);
        source += "]";
        return source;
      }
      visitLookupExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.identifier);
        source += n.name;
        return source;
      }
      visitMemberLookupExpr(n) {
        let source = "";
        source += n.expr.accept(this);
        source += this.stringifyExtraTokens(n.tokens.dot);
        source += ".";
        source += this.stringifyExtraTokens(n.tokens.memberName);
        source += n.member;
        return source;
      }
      visitFunctionCallExpr(n) {
        let source = n.callee.accept(this);
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        return source;
      }
      visitLetExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.name);
        source += "let";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this.copyWithIndent());
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        source += " ";
        source += n.expr.accept(this);
        return source;
      }
      visitAssertExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.name);
        source += "assert";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        source += " ";
        source += n.expr.accept(this);
        return source;
      }
      visitEchoExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.name);
        source += "echo";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        source += " ";
        source += n.expr.accept(this);
        return source;
      }
      visitLcIfExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.ifKeyword);
        source += "if";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        source += n.cond.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ") ";
        source += n.ifExpr.accept(this);
        if (n.elseExpr && n.tokens.elseKeyword) {
          source += this.stringifyExtraTokens(n.tokens.elseKeyword);
          source += " else ";
          source += n.elseExpr.accept(this);
        }
        return source;
      }
      visitLcEachExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.eachKeyword);
        source += "each ";
        source += n.expr.accept(this);
        return source;
      }
      visitLcForExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.forKeyword);
        source += "for";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ") ";
        source += n.expr.accept(this);
        return source;
      }
      visitLcForCExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.forKeyword);
        source += "for";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.firstSemicolon);
        source += "; ";
        source += n.cond.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondSemicolon);
        source += "; ";
        for (let i = 0; i < n.incrArgs.length; i++) {
          const arg = n.incrArgs[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ") ";
        source += n.expr.accept(this);
        return source;
      }
      visitLcLetExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.letKeyword);
        source += "let";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ") ";
        source += n.expr.accept(this);
        return source;
      }
      visitGroupingExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        source += n.inner.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        return source;
      }
      visitUseStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.useKeyword);
        source += "use " + this.stringifyExtraTokens(n.tokens.filename) + " <" + n.filename + ">" + this.newLine();
        return source;
      }
      visitIncludeStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.includeKeyword);
        source += "include " + this.stringifyExtraTokens(n.tokens.filename) + " <" + n.filename + ">" + this.newLine();
        return source;
      }
      visitModuleInstantiationStmt(n) {
        let source = "";
        source += n.tokens.modifiersInOrder.map((tk) => this.stringifyExtraTokens(tk) + tk.lexeme).join(" ");
        if (source != "") {
          source += " ";
        }
        source += this.stringifyExtraTokens(n.tokens.name);
        source += n.name;
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        if (!(n.child instanceof statements_1.NoopStmt) && !this.breakBetweenModuleInstantations) {
          source += " ";
        }
        if (this.breakBetweenModuleInstantations) {
          if (n.child instanceof statements_1.ModuleInstantiationStmt) {
            let c = this;
            if (this.firstModuleInstantation) {
              c = this.copyWithIndent();
              c.firstModuleInstantation = false;
            }
            this.newLineAfterNextComment("breakBetweenModuleInstantations");
            source += n.child.accept(c);
          } else {
            const c = this.copyWithBreakBetweenModuleInstantations(false);
            c.firstModuleInstantation = true;
            if (n.child)
              source += n.child.accept(c);
          }
        } else {
          let c = this;
          if (n.child instanceof statements_1.ModuleInstantiationStmt) {
            if (this.firstModuleInstantation && n.child.tokens.name.hasNewlineInExtraTokens()) {
              c = this.copyWithIndent();
              c.firstModuleInstantation = false;
            }
          } else {
            c.firstModuleInstantation = true;
          }
          if (n.child)
            source += n.child.accept(c);
        }
        return source;
      }
      visitModuleDeclarationStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.moduleKeyword);
        source += "module ";
        source += this.stringifyExtraTokens(n.tokens.name);
        source += n.tokens.name.value;
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.definitionArgs.length; i++) {
          const arg = n.definitionArgs[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        if (!this.config.definitionsOnly) {
          if (!(n.stmt instanceof statements_1.NoopStmt)) {
            source += " ";
          }
          source += n.stmt.accept(this);
        }
        return source;
      }
      visitFunctionDeclarationStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.functionKeyword);
        source += "function ";
        source += this.stringifyExtraTokens(n.tokens.name);
        source += n.name;
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.definitionArgs.length; i++) {
          const arg = n.definitionArgs[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        if (!this.config.definitionsOnly) {
          source += this.stringifyExtraTokens(n.tokens.equals);
          source += " = ";
          source += n.expr.accept(this.copyWithIndent());
          source += this.stringifyExtraTokens(n.tokens.semicolon);
          source += ";" + this.newLine(false, "afterFunctionDeclaration");
        }
        return source;
      }
      visitBlockStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.firstBrace);
        let withIndent = this.copyWithIndent();
        source += "{" + withIndent.newLine(false, "beforeBlockStmt");
        if (this.doNotAddNewlineAfterBlockStatement) {
          withIndent.doNotAddNewlineAfterBlockStatement = false;
        }
        for (const stmt of n.children) {
          source += withIndent.processStatementWithBreakIfNeeded(stmt);
        }
        source += withIndent.stringifyExtraTokens(n.tokens.secondBrace);
        if (n.tokens.secondBrace.extraTokens[n.tokens.secondBrace.extraTokens.length - 1] instanceof extraTokens_1.NewLineExtraToken) {
          source = source.substring(0, source.length - this.config.indentCount);
        }
        source += "}";
        if (!this.doNotAddNewlineAfterBlockStatement) {
          this.newLineAfterNextComment("afterBlockStmt");
        }
        return source;
      }
      visitNoopStmt(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.semicolon);
        source += ";";
        return source;
      }
      visitIfElseStatement(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.ifKeyword);
        source += "if";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        source += n.cond.accept(this);
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        if (!(n.thenBranch instanceof statements_1.NoopStmt)) {
          source += " ";
        }
        source += n.thenBranch.accept(n.tokens.elseKeyword ? this.copyWithDoNotAddNewlineAfterBlockStatement() : this);
        if (n.tokens.elseKeyword && n.elseBranch) {
          source += this.stringifyExtraTokens(n.tokens.elseKeyword);
          source += " else";
          if (!(n.elseBranch instanceof statements_1.NoopStmt)) {
            source += " ";
          }
          source += n.elseBranch.accept(this);
        }
        return source;
      }
      visitAnonymousFunctionExpr(n) {
        let source = "";
        source += this.stringifyExtraTokens(n.tokens.functionKeyword);
        source += "function";
        source += this.stringifyExtraTokens(n.tokens.firstParen);
        source += "(";
        for (let i = 0; i < n.definitionArgs.length; i++) {
          const arg = n.definitionArgs[i];
          source += arg.accept(this);
        }
        source += this.stringifyExtraTokens(n.tokens.secondParen);
        source += ")";
        if (!this.config.definitionsOnly) {
          source += n.expr.accept(this.copyWithIndent());
        }
        return source;
      }
      /**
       * Tries printing a ModuleInstantiationStmt without breaking it, if it exceeds 40 chars it breaks it, by printing it again.
       * @param stmt
       */
      processStatementWithBreakIfNeeded(stmt) {
        if (stmt instanceof statements_1.ModuleInstantiationStmt) {
          const saved = this.saveDeepGlobals();
          const line = stmt.accept(this);
          const firstRealLine = line.split("\n").find((l) => !!l.split("//")[0].trim());
          if (firstRealLine && firstRealLine.length > this.config.moduleInstantiationBreakLength) {
            this.restoreDeepGlobals(saved);
            return stmt.accept(this.copyWithBreakBetweenModuleInstantations());
          }
          return line;
        } else {
          return stmt.accept(this);
        }
      }
      stringifyExtraTokens(token) {
        const source = token.extraTokens.map((et) => {
          if (et instanceof extraTokens_1.NewLineExtraToken) {
            if (this.deepGlobals.didAddNewline) {
              this.deepGlobals.didAddNewline = false;
              return "";
            }
            this.deepGlobals.shouldAddNewlineAfterNextComment = false;
            return this.newLine(true, "forcedNewlineExtraToken");
          }
          if (!this.config.definitionsOnly && (et instanceof extraTokens_1.MultiLineComment || et instanceof extraTokens_1.SingleLineComment)) {
            let commentText = "";
            if (this.deepGlobals.shouldAddNewlineAfterNextComment) {
              commentText += " ";
            }
            if (et instanceof extraTokens_1.MultiLineComment) {
              commentText += "/*" + et.contents + "*/";
            } else if (et instanceof extraTokens_1.SingleLineComment) {
              commentText += "//" + et.contents;
            }
            if (this.deepGlobals.shouldAddNewlineAfterNextComment) {
              this.deepGlobals.shouldAddNewlineAfterNextComment = false;
              return commentText + this.newLine(false, this.deepGlobals.newlineAfterNextCommentReason);
            }
            return commentText;
          }
          return "";
        }).reduce((prev, curr) => prev + curr, "");
        this.deepGlobals.didAddNewline = false;
        if (source === "" && this.deepGlobals.shouldAddNewlineAfterNextComment) {
          this.deepGlobals.shouldAddNewlineAfterNextComment = false;
          return this.newLine(false, this.deepGlobals.newlineAfterNextCommentReason);
        }
        return source;
      }
      newLine(forced = false, newlineReason = "no reason") {
        if (!forced) {
          this.deepGlobals.didAddNewline = true;
        }
        if (this.config.debugNewlines) {
          return `   /* NL: ${newlineReason} */
` + this.makeIndent();
        }
        return "\n" + this.makeIndent();
      }
      /**
       * Schedules a newline to be added after the next comment, if present.
       * Otherwise it will be inserted immediately.
       */
      newLineAfterNextComment(reason) {
        this.deepGlobals.shouldAddNewlineAfterNextComment = true;
        this.deepGlobals.newlineAfterNextCommentReason = reason;
      }
      makeIndent() {
        let ind = "";
        for (let i = 0; i < this.indentLevel * this.config.indentCount; i++) {
          ind += this.config.indentChar;
        }
        return ind;
      }
      copy() {
        const next = new _ASTPrinter(this.config);
        next.indentLevel = this.indentLevel;
        next.deepGlobals = this.deepGlobals;
        next.breakBetweenModuleInstantations = this.breakBetweenModuleInstantations;
        return next;
      }
      copyWithIndent() {
        const next = this.copy();
        next.indentLevel++;
        return next;
      }
      copyWithBreakBetweenModuleInstantations(doBreak = true) {
        const next = this.copy();
        next.breakBetweenModuleInstantations = doBreak;
        return next;
      }
      copyWithDoNotAddNewlineAfterBlockStatement(val = true) {
        const next = this.copy();
        next.doNotAddNewlineAfterBlockStatement = val;
        return next;
      }
      saveDeepGlobals() {
        return JSON.parse(JSON.stringify(this.deepGlobals));
      }
      restoreDeepGlobals(dat) {
        for (const k of Object.keys(dat)) {
          this.deepGlobals[k] = dat[k];
        }
      }
    };
    exports.default = ASTPrinter;
  }
});

// scripts/node-shims.js
var require_node_shims = __commonJS({
  "scripts/node-shims.js"(exports, module) {
    module.exports = {};
  }
});

// node_modules/openscad-parser/dist/CodeFile.js
var require_CodeFile = __commonJS({
  "node_modules/openscad-parser/dist/CodeFile.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var fs = require_node_shims();
    var path = require_node_shims();
    var CodeFile = class _CodeFile {
      path;
      code;
      constructor(path2, code) {
        this.path = path2;
        this.code = code;
      }
      get filename() {
        return path.basename(this.path);
      }
      /**
       * Loads an openscad file from the filesystem.
       */
      static async load(pathToLoad) {
        pathToLoad = path.resolve(pathToLoad);
        const contents = await new Promise((res, rej) => {
          fs.readFile(pathToLoad, {
            encoding: "utf8"
          }, (err, data) => {
            if (err) {
              rej(err);
              return;
            }
            res(data);
          });
        });
        return new _CodeFile(pathToLoad, contents);
      }
    };
    exports.default = CodeFile;
  }
});

// node_modules/openscad-parser/dist/CodeLocation.js
var require_CodeLocation = __commonJS({
  "node_modules/openscad-parser/dist/CodeLocation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CONTEXT_LINES_BEFORE = 5;
    var CodeLocation = class {
      constructor(file = null, char = 0, line = 0, col = 0) {
        this.file = file;
        this.char = char;
        this.line = line;
        this.col = col;
      }
      /**
       * THe file to which this location points.
       */
      file;
      /**
       * The character offset in the file contents.
       */
      char = 0;
      /**
       * The line number of this location. Zero-indexed.
       */
      line = 0;
      /**
       * The column number of this location. Zero-indexed.
       */
      col = 0;
      toString() {
        return `file '${this.filename}' line ${this.line + 1} column ${this.col + 1}'`;
      }
      formatWithContext() {
        if (!this.file) {
          throw new Error("No CodeFile associated with this location");
        }
        let outStr = `${this.filename}:${this.line + 1}:${this.col}:
`;
        const sourceLines = this.file.code.split("\n");
        const contextStartIndex = Math.max(0, this.line - CONTEXT_LINES_BEFORE);
        const linesToDisplay = sourceLines.slice(contextStartIndex, this.line + 1);
        outStr += linesToDisplay.reduce((prev, line, index) => {
          return prev + ` ${(contextStartIndex + index + 1).toString().padStart(3)}| ${line}
`;
        }, "");
        outStr += "";
        for (let i = -5; i < this.col; i++) {
          outStr += " ";
        }
        outStr += "^\n";
        return outStr;
      }
      get filename() {
        return this?.file?.filename || "<unknown>";
      }
    };
    exports.default = CodeLocation;
  }
});

// node_modules/openscad-parser/dist/ErrorCollector.js
var require_ErrorCollector = __commonJS({
  "node_modules/openscad-parser/dist/ErrorCollector.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ErrorCollector = class {
      errors = [];
      reportError(err) {
        this.errors.push(err);
        return err;
      }
      printErrors() {
        const msgs = this.errors.reduce((prev, e) => {
          return prev + e.codeLocation.formatWithContext() + Object.getPrototypeOf(e).constructor.name + ": " + e.message + "\n";
        }, "");
        console.log(msgs);
      }
      hasErrors() {
        return this.errors.length > 0;
      }
      /**
       * Throws the first error on the list. Used to simplify testing.
       */
      throwIfAny() {
        if (this.errors.length > 0) {
          throw this.errors[0];
        }
      }
    };
    exports.default = ErrorCollector;
  }
});

// node_modules/openscad-parser/dist/FormattingConfiguration.js
var require_FormattingConfiguration = __commonJS({
  "node_modules/openscad-parser/dist/FormattingConfiguration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var FormattingConfiguration = class {
      indentChar = " ";
      indentCount = 4;
      moduleInstantiationBreakLength = 40;
      /**
       * When sets to true the printer does not print bodies of functions and modules.
       * Used for generating focumentation stubs.
       */
      definitionsOnly = false;
      /**
       * When set to true the formatter adds a comment to each newline describing its purpose.
       */
      debugNewlines = false;
    };
    exports.default = FormattingConfiguration;
  }
});

// node_modules/openscad-parser/dist/errors/CodeError.js
var require_CodeError = __commonJS({
  "node_modules/openscad-parser/dist/errors/CodeError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeError = class extends Error {
      codeLocation;
      constructor(codeLocation, message) {
        super(message);
        this.codeLocation = codeLocation;
      }
    };
    exports.default = CodeError;
  }
});

// node_modules/openscad-parser/dist/errors/LexingError.js
var require_LexingError = __commonJS({
  "node_modules/openscad-parser/dist/errors/LexingError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeError_1 = require_CodeError();
    var LexingError = class extends CodeError_1.default {
    };
    exports.default = LexingError;
  }
});

// node_modules/openscad-parser/dist/errors/lexingErrors.js
var require_lexingErrors = __commonJS({
  "node_modules/openscad-parser/dist/errors/lexingErrors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UnterminatedFilenameLexingError = exports.InvalidNumberLiteralLexingError = exports.TooManyEInNumberLiteralLexingError = exports.TooManyDotsInNumberLiteralLexingError = exports.UnterminatedStringLiteralLexingError = exports.IllegalStringEscapeSequenceLexingError = exports.UnexpectedCharacterLexingError = exports.SingleCharacterNotAllowedLexingError = exports.UnterminatedMultilineCommentLexingError = void 0;
    var LexingError_1 = require_LexingError();
    var UnterminatedMultilineCommentLexingError = class extends LexingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated multiline comment.`);
      }
    };
    exports.UnterminatedMultilineCommentLexingError = UnterminatedMultilineCommentLexingError;
    var SingleCharacterNotAllowedLexingError = class extends LexingError_1.default {
      constructor(pos, char) {
        super(pos, `Single '${char}' is not allowed.`);
      }
    };
    exports.SingleCharacterNotAllowedLexingError = SingleCharacterNotAllowedLexingError;
    var UnexpectedCharacterLexingError = class extends LexingError_1.default {
      constructor(pos, char) {
        super(pos, `Unexpected character '${char}'.`);
      }
    };
    exports.UnexpectedCharacterLexingError = UnexpectedCharacterLexingError;
    var IllegalStringEscapeSequenceLexingError = class extends LexingError_1.default {
      constructor(pos, sequence) {
        super(pos, `Illegal string escape sequence '${sequence}'.`);
      }
    };
    exports.IllegalStringEscapeSequenceLexingError = IllegalStringEscapeSequenceLexingError;
    var UnterminatedStringLiteralLexingError = class extends LexingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated string literal.`);
      }
    };
    exports.UnterminatedStringLiteralLexingError = UnterminatedStringLiteralLexingError;
    var TooManyDotsInNumberLiteralLexingError = class extends LexingError_1.default {
      constructor(pos, lexeme) {
        super(pos, `Too many dots in number literal ${lexeme}. Number literals must contain zero or one dot.`);
      }
    };
    exports.TooManyDotsInNumberLiteralLexingError = TooManyDotsInNumberLiteralLexingError;
    var TooManyEInNumberLiteralLexingError = class extends LexingError_1.default {
      constructor(pos, lexeme) {
        super(pos, `Too many 'e' separators in number literal ${lexeme}. Number literals must contain zero or one 'e'.`);
      }
    };
    exports.TooManyEInNumberLiteralLexingError = TooManyEInNumberLiteralLexingError;
    var InvalidNumberLiteralLexingError = class extends LexingError_1.default {
      constructor(pos, lexeme) {
        super(pos, `Invalid number literal ${lexeme}.`);
      }
    };
    exports.InvalidNumberLiteralLexingError = InvalidNumberLiteralLexingError;
    var UnterminatedFilenameLexingError = class extends LexingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated filename.`);
      }
    };
    exports.UnterminatedFilenameLexingError = UnterminatedFilenameLexingError;
  }
});

// node_modules/openscad-parser/dist/keywords.js
var require_keywords = __commonJS({
  "node_modules/openscad-parser/dist/keywords.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.keywordDocumentation = void 0;
    var TokenType_1 = require_TokenType();
    var keywords = {
      true: TokenType_1.default.True,
      false: TokenType_1.default.False,
      undef: TokenType_1.default.Undef,
      module: TokenType_1.default.Module,
      function: TokenType_1.default.Function,
      if: TokenType_1.default.If,
      else: TokenType_1.default.Else,
      for: TokenType_1.default.For,
      assert: TokenType_1.default.Assert,
      each: TokenType_1.default.Each,
      echo: TokenType_1.default.Echo,
      use: TokenType_1.default.Use,
      let: TokenType_1.default.Let,
      include: TokenType_1.default.Include
    };
    exports.keywordDocumentation = {
      true: "Represents the boolean value true.",
      false: "Represents the boolean value false.",
      undef: `Represents the undefined value. 

It's the initial value of a variable that hasn't been assigned a value, and it is often returned as a result by functions or operations that are passed illegal arguments. `,
      module: `Starts a module declaration.

Usage:

${"```scad"}
module my_module(arg = "default") {
  // module code
}
${"```"}
`,
      function: `Starts a function declaration.

Usage:

${"```scad"}
function my_function (x) = x * x;

// or for anonymous functions
square = function (x) x * x;

${"```"}
`,
      if: `Starts an if statement or expression.

Usage:

${"```scad"}
if (x > 0) {
  // do something
}
${"```"}
`,
      else: `Marks the beginning of an else block in an if statement.

Usage:
${"```scad"}
if (x > 0) {
  // if x is positive
} else {
  // if x is zero or negative
}
${"```"}
`,
      for: `Starts a for loop.

Usage:

${"```scad"}
for ( i = [0 : 5] ){
  rotate( i * 60, [1, 0, 0])
  translate([0, 10, 0])
  sphere(r = 10);
}
${"```"}
`,
      assert: `Starts an assert statement.

Usage:

${"```scad"}
assert(x > 0, "x is not positive");

${"```"}
`
    };
    exports.default = keywords;
  }
});

// node_modules/openscad-parser/dist/LiteralToken.js
var require_LiteralToken = __commonJS({
  "node_modules/openscad-parser/dist/LiteralToken.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Token_1 = require_Token();
    var LiteralToken = class extends Token_1.default {
      value;
      constructor(type, span, lexeme, value) {
        super(type, span, lexeme);
        this.value = value;
      }
    };
    exports.default = LiteralToken;
  }
});

// node_modules/openscad-parser/dist/Lexer.js
var require_Lexer = __commonJS({
  "node_modules/openscad-parser/dist/Lexer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeLocation_1 = require_CodeLocation();
    var CodeSpan_1 = require_CodeSpan();
    var lexingErrors_1 = require_lexingErrors();
    var extraTokens_1 = require_extraTokens();
    var keywords_1 = require_keywords();
    var LiteralToken_1 = require_LiteralToken();
    var Token_1 = require_Token();
    var TokenType_1 = require_TokenType();
    var Lexer = class {
      codeFile;
      errorCollector;
      start;
      startWithWhitespace;
      tokens = [];
      currentExtraTokens = [];
      charOffset = 0;
      lineOffset = 0;
      colOffset = 0;
      _currLocCache = null;
      constructor(codeFile, errorCollector) {
        this.codeFile = codeFile;
        this.errorCollector = errorCollector;
      }
      /**
       * Scans the whole CodeFile and splits it into tokens.
       * @throws LexingError
       */
      scan() {
        this.start = this.getLoc();
        this.startWithWhitespace = this.getLoc();
        while (!this.isAtEnd()) {
          this.start = this.getLoc();
          this.scanToken();
        }
        this.start = this.getLoc();
        this.addToken(TokenType_1.default.Eot);
        return this.tokens;
      }
      scanToken() {
        const c = this.advance();
        switch (c) {
          case "(":
            this.addToken(TokenType_1.default.LeftParen);
            break;
          case ")":
            this.addToken(TokenType_1.default.RightParen);
            break;
          case "{":
            this.addToken(TokenType_1.default.LeftBrace);
            break;
          case "}":
            this.addToken(TokenType_1.default.RightBrace);
            break;
          case "[":
            this.addToken(TokenType_1.default.LeftBracket);
            break;
          case "]":
            this.addToken(TokenType_1.default.RightBracket);
            break;
          case "+":
            this.addToken(TokenType_1.default.Plus);
            break;
          case "-":
            this.addToken(TokenType_1.default.Minus);
            break;
          case "%":
            this.addToken(TokenType_1.default.Percent);
            break;
          case "*":
            this.addToken(TokenType_1.default.Star);
            break;
          case "^":
            this.addToken(TokenType_1.default.Caret);
            break;
          case "/":
            if (this.match("/")) {
              const comment = new extraTokens_1.SingleLineComment(this.getLoc(), "");
              while (this.peek() != "\n" && !this.isAtEnd()) {
                comment.contents += this.advance();
              }
              this.currentExtraTokens.push(comment);
            } else if (this.match("*")) {
              const comment = new extraTokens_1.MultiLineComment(this.getLoc(), "");
              while (!(this.peek() == "*" && this.peekNext() == "/") && !this.isAtEnd()) {
                comment.contents += this.advance();
              }
              if (this.isAtEnd()) {
                throw this.errorCollector.reportError(new lexingErrors_1.UnterminatedMultilineCommentLexingError(this.getLoc()));
              }
              this.currentExtraTokens.push(comment);
              this.advance();
              this.advance();
            } else {
              this.addToken(TokenType_1.default.Slash);
            }
            break;
          case ".":
            if (/[0-9]/.test(this.peek())) {
              this.consumeNumberLiteral();
              break;
            }
            this.addToken(TokenType_1.default.Dot);
            break;
          case ",":
            this.addToken(TokenType_1.default.Comma);
            break;
          case ":":
            this.addToken(TokenType_1.default.Colon);
            break;
          case "?":
            this.addToken(TokenType_1.default.QuestionMark);
            break;
          case ";":
            this.addToken(TokenType_1.default.Semicolon);
            break;
          case "#":
            this.addToken(TokenType_1.default.Hash);
            break;
          case "!":
            if (this.match("=")) {
              this.addToken(TokenType_1.default.BangEqual);
            } else {
              this.addToken(TokenType_1.default.Bang);
            }
            break;
          case "<":
            if (this.match("=")) {
              this.addToken(TokenType_1.default.LessEqual);
            } else {
              this.addToken(TokenType_1.default.Less);
            }
            break;
          case ">":
            if (this.match("=")) {
              this.addToken(TokenType_1.default.GreaterEqual);
            } else {
              this.addToken(TokenType_1.default.Greater);
            }
            break;
          case "=":
            if (this.match("=")) {
              this.addToken(TokenType_1.default.EqualEqual);
            } else {
              this.addToken(TokenType_1.default.Equal);
            }
            break;
          case "&":
            if (this.match("&")) {
              this.addToken(TokenType_1.default.AND);
            } else {
              throw this.errorCollector.reportError(new lexingErrors_1.SingleCharacterNotAllowedLexingError(this.getLoc(), "&"));
            }
            break;
          case "|":
            if (this.match("|")) {
              this.addToken(TokenType_1.default.OR);
            } else {
              throw this.errorCollector.reportError(new lexingErrors_1.SingleCharacterNotAllowedLexingError(this.getLoc(), "&"));
            }
            break;
          case "\n":
            this.currentExtraTokens.push(new extraTokens_1.NewLineExtraToken(this.getLoc()));
            break;
          case "\r":
          case " ":
          case "	":
            break;
          // ignore whitespace
          case '"':
            this.consumeStringLiteral();
            break;
          default:
            if (/[0-9]/.test(c)) {
              this.consumeNumberOrIdentifierOrKeyword();
            } else if (/[A-Za-z\$_]/.test(c)) {
              this.consumeIdentifierOrKeyword();
            } else {
              throw this.errorCollector.reportError(new lexingErrors_1.UnexpectedCharacterLexingError(this.getLoc(), c));
            }
        }
      }
      consumeStringLiteral() {
        let str = "";
        while (this.peek() != '"' && !this.isAtEnd()) {
          const c = this.advance();
          if (c == "\\") {
            if (this.match('"')) {
              str += '"';
            } else if (this.match("\\")) {
              str += "\\";
            } else if (this.match("n")) {
              str += "\n";
            } else if (this.match("t")) {
              str += "	";
            } else if (this.match("r")) {
              str += "\r";
            } else {
              throw this.errorCollector.reportError(new lexingErrors_1.IllegalStringEscapeSequenceLexingError(this.getLoc(), `\\${c}`));
            }
          } else {
            str += c;
          }
        }
        if (this.isAtEnd()) {
          throw this.errorCollector.reportError(new lexingErrors_1.UnterminatedStringLiteralLexingError(this.getLoc()));
        }
        this.advance();
        this.addToken(TokenType_1.default.StringLiteral, str);
      }
      consumeNumberLiteral() {
        let ateDigit = /[0-9]/.test(this.codeFile.code[this.start.char]);
        let ateDot = "." === this.codeFile.code[this.start.char];
        let justAteExp = false;
        while (/[0-9]/.test(this.peek()) || this.peek() == "." && /[0-9]/.test(this.peekNext()) || (this.peek() == "e" || this.peek() == "E") && /[0-9\-+]/.test(this.peekNext()) || this.peek() == "-" && /[0-9]/.test(this.peekNext()) && justAteExp || this.peek() == "+" && /[0-9]/.test(this.peekNext()) && justAteExp || this.peek() == "." && ateDigit && !ateDot) {
          ateDigit = ateDigit || /[0-9]/.test(this.peek());
          ateDot = ateDot || this.peek() == ".";
          justAteExp = this.peek() == "e" || this.peek() == "E";
          this.advance();
        }
        const lexeme = this.codeFile.code.substring(this.start.char, this.charOffset);
        if ((lexeme.match(/\./g) || []).length > 1) {
          throw this.errorCollector.reportError(new lexingErrors_1.TooManyDotsInNumberLiteralLexingError(this.getLoc(), lexeme));
        }
        if ((lexeme.match(/e/g) || []).length > 1) {
          throw this.errorCollector.reportError(new lexingErrors_1.TooManyEInNumberLiteralLexingError(this.getLoc(), lexeme));
        }
        const value = parseFloat(lexeme);
        if (isNaN(value) || !isFinite(value)) {
          throw this.errorCollector.reportError(new lexingErrors_1.InvalidNumberLiteralLexingError(this.getLoc(), lexeme));
        }
        this.addToken(TokenType_1.default.NumberLiteral, value);
      }
      consumeIdentifierOrKeyword() {
        while (/[A-Za-z0-9_\$]/.test(this.peek()) && !this.isAtEnd()) {
          this.advance();
        }
        const lexeme = this.codeFile.code.substring(this.start.char, this.charOffset);
        if (lexeme in keywords_1.default) {
          const keywordType = keywords_1.default[lexeme];
          this.addToken(keywordType);
          if (keywordType === TokenType_1.default.Use || keywordType === TokenType_1.default.Include) {
            this.consumeFileNameInChevrons();
          }
          return;
        }
        this.addToken(TokenType_1.default.Identifier, lexeme);
      }
      consumeNumberOrIdentifierOrKeyword() {
        let wordLength = 1;
        while (this.start.char + wordLength < this.codeFile.code.length && /[0-9a-zA-Z_\$]/.test(this.codeFile.code[this.start.char + wordLength])) {
          wordLength++;
        }
        const possibleNumberStarts = [
          this.peekRegex(/^[0-9]+/),
          this.peekRegex(/^[0-9]+[.]/),
          this.peekRegex(/^[0-9]+[eE][+-]?[0-9]+/)
        ];
        const numberLength = Math.max(...possibleNumberStarts.map((x) => x.length));
        if (numberLength >= wordLength) {
          return this.consumeNumberLiteral();
        } else {
          return this.consumeIdentifierOrKeyword();
        }
      }
      consumeFileNameInChevrons() {
        this.startWithWhitespace = this.getLoc();
        while (!this.isAtEnd()) {
          this.start = this.getLoc();
          if (this.match("\n") || this.match("	") || this.match("\r") || this.match(" "))
            continue;
          if (this.match("<"))
            break;
          throw this.errorCollector.reportError(new lexingErrors_1.UnexpectedCharacterLexingError(this.getLoc(), this.advance()));
        }
        if (this.isAtEnd()) {
          throw this.errorCollector.reportError(new lexingErrors_1.UnterminatedFilenameLexingError(this.getLoc()));
        }
        let filename = "";
        let didEnd = false;
        while (!this.isAtEnd()) {
          const c = this.advance();
          if (c === ">") {
            didEnd = true;
            break;
          }
          filename += c;
        }
        if (!didEnd) {
          throw this.errorCollector.reportError(new lexingErrors_1.UnterminatedFilenameLexingError(this.getLoc()));
        }
        this.addToken(TokenType_1.default.FilenameInChevrons, filename);
      }
      /**
       * Adds a token to the token list. If a value is provieded a LiteralToken is pushed.
       *
       * Additionally it handles clearing and attaching the extra tokens.
       */
      addToken(tokenType, value = null) {
        const lexeme = this.codeFile.code.substring(this.start.char, this.charOffset);
        let token;
        if (value != null) {
          token = new LiteralToken_1.default(tokenType, new CodeSpan_1.default(this.start, this.getLoc()), lexeme, value);
        } else {
          token = new Token_1.default(tokenType, new CodeSpan_1.default(this.start, this.getLoc()), lexeme);
        }
        token.extraTokens = this.currentExtraTokens;
        token.startWithWhitespace = this.startWithWhitespace;
        this.startWithWhitespace = this.getLoc();
        this.currentExtraTokens = [];
        this.tokens.push(token);
      }
      isAtEnd() {
        return this.charOffset >= this.codeFile.code.length;
      }
      match(expected) {
        if (this.isAtEnd())
          return false;
        if (this.codeFile.code[this.charOffset] !== expected)
          return false;
        this.advance();
        return true;
      }
      advance() {
        const c = this.codeFile.code[this.charOffset];
        this.charOffset++;
        if (c === "\n") {
          this.lineOffset++;
          this.colOffset = 0;
        } else {
          this.colOffset++;
        }
        this._currLocCache = null;
        return c;
      }
      getLoc() {
        if (!this._currLocCache) {
          this._currLocCache = new CodeLocation_1.default(this.codeFile, this.charOffset, this.lineOffset, this.colOffset);
        }
        return this._currLocCache;
      }
      peek() {
        if (this.isAtEnd())
          return "\0";
        return this.codeFile.code[this.charOffset];
      }
      peekNext() {
        if (this.charOffset + 1 >= this.codeFile.code.length)
          return "\0";
        return this.codeFile.code[this.charOffset + 1];
      }
      peekRegex(regex) {
        const text = this.codeFile.code.slice(this.start.char);
        const match = regex.exec(text);
        return !match || match.index !== 0 ? "" : match[0];
      }
    };
    exports.default = Lexer;
  }
});

// node_modules/openscad-parser/dist/comments/annotations.js
var require_annotations = __commonJS({
  "node_modules/openscad-parser/dist/comments/annotations.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ParamAnnotation = exports.SeeAnnotation = exports.IntrinsicRenameAnnotation = exports.IntrinsicAnnotation = void 0;
    var IntrinsicAnnotation = class {
      static annotationTag = "intrinsic";
      intrinsicType;
      constructor(contents) {
        this.intrinsicType = contents[0] || "";
      }
    };
    exports.IntrinsicAnnotation = IntrinsicAnnotation;
    var IntrinsicRenameAnnotation = class {
      static annotationTag = "intrinsicRename";
      newName;
      constructor(contents) {
        this.newName = contents[0] || "";
      }
    };
    exports.IntrinsicRenameAnnotation = IntrinsicRenameAnnotation;
    var SeeAnnotation = class {
      static annotationTag = "see";
      link;
      constructor(contents) {
        this.link = contents[0] || "";
      }
    };
    exports.SeeAnnotation = SeeAnnotation;
    var ParamAnnotation = class {
      static annotationTag = "param";
      link;
      description;
      tags = {
        positional: false,
        named: false,
        required: false,
        type: [],
        conflictsWith: [],
        possibleValues: []
      };
      constructor(contents) {
        this.link = contents[0] || "";
        this.description = contents.slice(1).filter((c) => {
          let m = c.match(/^\[(.*?)(=(.*))?\]$/);
          if (!m)
            return true;
          if (!m[3]) {
            this.tags[m[1]] = true;
          } else {
            this.tags[m[1]] = m[3].split(",");
          }
          return false;
        }).join(" ");
      }
    };
    exports.ParamAnnotation = ParamAnnotation;
  }
});

// node_modules/openscad-parser/dist/comments/DocComment.js
var require_DocComment = __commonJS({
  "node_modules/openscad-parser/dist/comments/DocComment.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var extraTokens_1 = require_extraTokens();
    var annotations_1 = require_annotations();
    var DocComment = class _DocComment {
      documentationContent;
      annotations;
      static possibleAnnotations = [
        annotations_1.IntrinsicAnnotation,
        annotations_1.IntrinsicRenameAnnotation,
        annotations_1.ParamAnnotation,
        annotations_1.SeeAnnotation
      ];
      constructor(documentationContent, annotations) {
        this.documentationContent = documentationContent;
        this.annotations = annotations;
      }
      static fromExtraTokens(extraTokens) {
        const docComments = [];
        let beginningNewlinesLimit = 5;
        for (let i = extraTokens.length - 1; i >= 0; i--) {
          if (extraTokens[i] instanceof extraTokens_1.NewLineExtraToken) {
            beginningNewlinesLimit--;
          }
          if (extraTokens[i] instanceof extraTokens_1.MultiLineComment || extraTokens[i] instanceof extraTokens_1.SingleLineComment) {
            beginningNewlinesLimit = 2;
            docComments.unshift(extraTokens[i]);
          }
          if (beginningNewlinesLimit <= 0) {
            break;
          }
        }
        const lines = docComments.map((c) => c.contents).flatMap((c) => c.split("\n")).map((l) => l.trim().replace(/^\*/, "").trim());
        let contents = "";
        let annotations = [];
        for (const line of lines) {
          if (line.startsWith("@")) {
            const segments = line.substring(1).split(" ");
            let foundAnnotation = false;
            for (const possible of this.possibleAnnotations) {
              if (possible.annotationTag === segments[0]) {
                annotations.push(new possible(segments.slice(1)));
                foundAnnotation = true;
                break;
              }
            }
            if (foundAnnotation) {
              continue;
            }
          }
          contents += line + "\n";
        }
        contents = contents.trim();
        return new _DocComment(contents, annotations);
      }
    };
    exports.default = DocComment;
  }
});

// node_modules/openscad-parser/dist/errors/ParsingError.js
var require_ParsingError = __commonJS({
  "node_modules/openscad-parser/dist/errors/ParsingError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CodeError_1 = require_CodeError();
    var ParsingError = class extends CodeError_1.default {
    };
    exports.default = ParsingError;
  }
});

// node_modules/openscad-parser/dist/friendlyTokenNames.js
var require_friendlyTokenNames = __commonJS({
  "node_modules/openscad-parser/dist/friendlyTokenNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TokenType_1 = require_TokenType();
    exports.default = {
      [TokenType_1.default.AND]: "'&&' (AND)",
      [TokenType_1.default.Assert]: "'assert' (Assert)",
      [TokenType_1.default.Bang]: "'!' (Bang)",
      [TokenType_1.default.BangEqual]: "'!=' (BangEqual)",
      [TokenType_1.default.Colon]: "':' (Colon)",
      [TokenType_1.default.Comma]: "',' (Comma)",
      [TokenType_1.default.Dot]: "'.' (Dot)",
      [TokenType_1.default.Each]: "'each' (Each)",
      [TokenType_1.default.Echo]: "'echo' (Echo)",
      [TokenType_1.default.Else]: "'else' (Else)",
      [TokenType_1.default.Eot]: "end of file (Eot)",
      [TokenType_1.default.Equal]: "'=' (Equal)",
      [TokenType_1.default.EqualEqual]: "'==' (EqualEqual)",
      [TokenType_1.default.Error]: "<error> (Error)",
      [TokenType_1.default.False]: "'false' (False)",
      [TokenType_1.default.For]: "'for' (For)",
      [TokenType_1.default.Function]: "'function' (Function)",
      [TokenType_1.default.Greater]: "'>' (Greater)",
      [TokenType_1.default.GreaterEqual]: "'>=' (GreaterEqual)",
      [TokenType_1.default.Hash]: "'#' (Hash)",
      [TokenType_1.default.Identifier]: "identifier (Identifier)",
      [TokenType_1.default.If]: "'if' (If)",
      [TokenType_1.default.LeftBrace]: "'{' (LeftBrace)",
      [TokenType_1.default.LeftBracket]: "'[' (LeftBracket)",
      [TokenType_1.default.LeftParen]: "'(' (LeftParen)",
      [TokenType_1.default.Less]: "'<' (Less)",
      [TokenType_1.default.LessEqual]: "'<=' (LessEqual)",
      [TokenType_1.default.Let]: "'let' (Let)",
      [TokenType_1.default.Minus]: "'-' (Minus)",
      [TokenType_1.default.Module]: "'module' (Module)",
      [TokenType_1.default.NumberLiteral]: "number literal (NumberLiteral)",
      [TokenType_1.default.OR]: "'||' (OR)",
      [TokenType_1.default.Percent]: "'%' (Percent)",
      [TokenType_1.default.Plus]: "'+' (Plus)",
      [TokenType_1.default.QuestionMark]: "'?' (QuestionMark)",
      [TokenType_1.default.RightBrace]: "'}' (RightBrace)",
      [TokenType_1.default.RightBracket]: "']' (RightBracket)",
      [TokenType_1.default.RightParen]: "')' (RightParen)",
      [TokenType_1.default.Semicolon]: "';' (Semicolon)",
      [TokenType_1.default.Slash]: "'/' (Slash)",
      [TokenType_1.default.Star]: "'*' (Star)",
      [TokenType_1.default.Caret]: "'^' (Caret)",
      [TokenType_1.default.StringLiteral]: "string literal (StringLiteral)",
      [TokenType_1.default.True]: "'true' (True)",
      [TokenType_1.default.Undef]: "'undef' (Undef)",
      [TokenType_1.default.Use]: "'use' (Use)",
      [TokenType_1.default.FilenameInChevrons]: "filename (FilenameInChevrons)",
      [TokenType_1.default.Include]: "'include' (Include)"
    };
  }
});

// node_modules/openscad-parser/dist/errors/parsingErrors.js
var require_parsingErrors = __commonJS({
  "node_modules/openscad-parser/dist/errors/parsingErrors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UnexpectedIncludeStatementParsingError = exports.UnexpectedUseStatementParsingError = exports.UnexpectedCommentBeforeUseChevronParsingError = exports.ConsumptionParsingError = exports.UnterminatedVectorExpressionParsingError = exports.FailedToMatchPrimaryExpressionParsingError = exports.UnexpectedTokenInForLoopParamsListParsingError = exports.UnterminatedForLoopParamsParsingError = exports.UnexpectedTokenInNamedArgumentsListParsingError = exports.UnterminatedParametersListParsingError = exports.UnexpectedEndOfFileBeforeModuleInstantiationParsingError = exports.UnexpectedTokenAfterIdentifierInStatementParsingError = exports.UnexpectedTokenWhenStatementParsingError = exports.UnexpectedTokenParsingError = exports.UnterminatedUseStatementParsingError = void 0;
    var friendlyTokenNames_1 = require_friendlyTokenNames();
    var TokenType_1 = require_TokenType();
    var ParsingError_1 = require_ParsingError();
    var UnterminatedUseStatementParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated 'use' statement.`);
      }
    };
    exports.UnterminatedUseStatementParsingError = UnterminatedUseStatementParsingError;
    var UnexpectedTokenParsingError = class extends ParsingError_1.default {
      constructor(pos, tt, extraMsg) {
        if (extraMsg) {
          super(pos, `Unexpected token ${friendlyTokenNames_1.default[tt]}${extraMsg}`);
        } else {
          super(pos, `Unexpected token ${friendlyTokenNames_1.default[tt]}.`);
        }
      }
    };
    exports.UnexpectedTokenParsingError = UnexpectedTokenParsingError;
    var UnexpectedTokenWhenStatementParsingError = class extends UnexpectedTokenParsingError {
      constructor(pos, tt) {
        super(pos, tt, `, expected statement.`);
      }
    };
    exports.UnexpectedTokenWhenStatementParsingError = UnexpectedTokenWhenStatementParsingError;
    var UnexpectedTokenAfterIdentifierInStatementParsingError = class extends UnexpectedTokenParsingError {
      constructor(pos, tt) {
        super(pos, tt, `, expected ${friendlyTokenNames_1.default[TokenType_1.default.LeftParen]} or ${friendlyTokenNames_1.default[TokenType_1.default.Equal]} after identifier in statement.`);
      }
    };
    exports.UnexpectedTokenAfterIdentifierInStatementParsingError = UnexpectedTokenAfterIdentifierInStatementParsingError;
    var UnexpectedEndOfFileBeforeModuleInstantiationParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Unexpected end of file before module instantiation.`);
      }
    };
    exports.UnexpectedEndOfFileBeforeModuleInstantiationParsingError = UnexpectedEndOfFileBeforeModuleInstantiationParsingError;
    var UnterminatedParametersListParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated parameters list.`);
      }
    };
    exports.UnterminatedParametersListParsingError = UnterminatedParametersListParsingError;
    var UnexpectedTokenInNamedArgumentsListParsingError = class extends UnexpectedTokenParsingError {
      constructor(pos, tt) {
        super(pos, tt, ` in named arguments list.`);
      }
    };
    exports.UnexpectedTokenInNamedArgumentsListParsingError = UnexpectedTokenInNamedArgumentsListParsingError;
    var UnterminatedForLoopParamsParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated for loop params.`);
      }
    };
    exports.UnterminatedForLoopParamsParsingError = UnterminatedForLoopParamsParsingError;
    var UnexpectedTokenInForLoopParamsListParsingError = class extends UnexpectedTokenParsingError {
      constructor(pos, tt) {
        super(pos, tt, ` in for loop params list.`);
      }
    };
    exports.UnexpectedTokenInForLoopParamsListParsingError = UnexpectedTokenInForLoopParamsListParsingError;
    var FailedToMatchPrimaryExpressionParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Failed to match primary expression.`);
      }
    };
    exports.FailedToMatchPrimaryExpressionParsingError = FailedToMatchPrimaryExpressionParsingError;
    var UnterminatedVectorExpressionParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Unterminated vector literal.`);
      }
    };
    exports.UnterminatedVectorExpressionParsingError = UnterminatedVectorExpressionParsingError;
    var ConsumptionParsingError = class extends UnexpectedTokenParsingError {
      real;
      expected;
      constructor(pos, real, expected, where) {
        super(pos, real, `, expected ${friendlyTokenNames_1.default[expected]} ${where}.`);
        this.real = real;
        this.expected = expected;
      }
    };
    exports.ConsumptionParsingError = ConsumptionParsingError;
    var UnexpectedCommentBeforeUseChevronParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Comments are illegal before '<' in the use statement.`);
      }
    };
    exports.UnexpectedCommentBeforeUseChevronParsingError = UnexpectedCommentBeforeUseChevronParsingError;
    var UnexpectedUseStatementParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Use ('use <...>') statements are only allowed at the root scope of the file, not inside of blocks.`);
      }
    };
    exports.UnexpectedUseStatementParsingError = UnexpectedUseStatementParsingError;
    var UnexpectedIncludeStatementParsingError = class extends ParsingError_1.default {
      constructor(pos) {
        super(pos, `Include ('include <...>') statements are only allowed at the root scope of the file, not inside of blocks.`);
      }
    };
    exports.UnexpectedIncludeStatementParsingError = UnexpectedIncludeStatementParsingError;
  }
});

// node_modules/openscad-parser/dist/Parser.js
var require_Parser = __commonJS({
  "node_modules/openscad-parser/dist/Parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var AssignmentNode_1 = require_AssignmentNode();
    var ErrorNode_1 = require_ErrorNode();
    var expressions_1 = require_expressions();
    var ScadFile_1 = require_ScadFile();
    var statements_1 = require_statements();
    var annotations_1 = require_annotations();
    var DocComment_1 = require_DocComment();
    var ParsingError_1 = require_ParsingError();
    var parsingErrors_1 = require_parsingErrors();
    var keywords_1 = require_keywords();
    var LiteralToken_1 = require_LiteralToken();
    var TokenType_1 = require_TokenType();
    var moduleInstantiationTagTokens = [
      TokenType_1.default.Bang,
      TokenType_1.default.Hash,
      TokenType_1.default.Percent,
      TokenType_1.default.Star
    ];
    var keywordModuleNames = [
      TokenType_1.default.For,
      TokenType_1.default.Let,
      TokenType_1.default.Assert,
      TokenType_1.default.Echo,
      TokenType_1.default.Each,
      TokenType_1.default.If
    ];
    var listComprehensionElementKeywords = [
      TokenType_1.default.For,
      TokenType_1.default.Let,
      TokenType_1.default.Each,
      TokenType_1.default.If
    ];
    var Parser = class {
      currentToken = 0;
      /**
       * The code file being parsed.
       */
      code;
      /**
       * The tokens being parsed. They have to be provided from the lexer
       * @see [[Lexer.scan]]
       */
      tokens;
      /**
       * The ErrorCollector for this parser. All the errors encountered by the parser will be put there, since it does not throw on non-fatal errors.
       */
      errorCollector;
      constructor(code, tokens, errorCollector) {
        this.code = code;
        this.tokens = tokens;
        this.errorCollector = errorCollector;
      }
      /**
       * Attempts to parse a file and return the AST with the ScadFile as a root node.
       * @throws ParsingError
       */
      parse() {
        const statements = [];
        while (!this.isAtEnd()) {
          statements.push(this.statement(true));
        }
        const eot = this.peek();
        return new ScadFile_1.default(statements, { eot });
      }
      synchronize(e) {
        if (e instanceof parsingErrors_1.ConsumptionParsingError) {
          if (e.expected === TokenType_1.default.Semicolon) {
            if (this.peek().hasNewlineInExtraTokens()) {
              return;
            }
          }
        }
        if (e instanceof parsingErrors_1.FailedToMatchPrimaryExpressionParsingError) {
          if (this.peek().hasNewlineInExtraTokens()) {
            return;
          }
        }
        if (e instanceof parsingErrors_1.UnexpectedTokenAfterIdentifierInStatementParsingError) {
          if (this.peek().hasNewlineInExtraTokens()) {
            return;
          }
        }
        this.advance();
        while (!this.isAtEnd()) {
          if (this.previous().type === TokenType_1.default.Semicolon)
            return;
          switch (this.peek().type) {
            case TokenType_1.default.Module:
            case TokenType_1.default.Function:
            case TokenType_1.default.If:
            case TokenType_1.default.For:
            case TokenType_1.default.Echo:
            case TokenType_1.default.Assert:
            case TokenType_1.default.Let:
              return;
          }
          this.advance();
        }
      }
      /**
       * Parses a statement, including `use` and `include` when isAtRoot is set to true.
       * @param isAtRoot whther we are parsing a statement in the root of the file, set to false inside blocks or modules.
       */
      statement(isAtRoot = false) {
        const syncStartToken = this.currentToken;
        const syncStartLocation = this.getLocation();
        try {
          if (this.matchToken(TokenType_1.default.Use)) {
            if (!isAtRoot) {
              throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedUseStatementParsingError(this.getLocation()));
            }
            const useKeyword = this.previous();
            const filenameToken = this.consume(TokenType_1.default.FilenameInChevrons, "after 'use' keyword");
            return new statements_1.UseStmt(filenameToken.value, {
              useKeyword,
              filename: filenameToken
            });
          }
          if (this.matchToken(TokenType_1.default.Include)) {
            if (!isAtRoot) {
              throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedIncludeStatementParsingError(this.getLocation()));
            }
            const includeKeyword = this.previous();
            const filenameToken = this.consume(TokenType_1.default.FilenameInChevrons, "after 'include' keyword");
            return new statements_1.IncludeStmt(filenameToken.value, {
              includeKeyword,
              filename: filenameToken
            });
          }
          if (this.matchToken(TokenType_1.default.Semicolon)) {
            const semicolon = this.previous();
            return new statements_1.NoopStmt({ semicolon });
          }
          if (this.matchToken(TokenType_1.default.LeftBrace)) {
            return this.blockStatement();
          }
          if (this.matchToken(TokenType_1.default.Module)) {
            return this.moduleDeclarationStatement();
          }
          if (this.matchToken(TokenType_1.default.Function)) {
            return this.functionDeclarationStatement();
          }
          const assignmentOrInst = this.matchAssignmentOrModuleInstantation();
          if (assignmentOrInst) {
            return assignmentOrInst;
          }
          throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedTokenWhenStatementParsingError(this.getLocation(), this.peek().type));
        } catch (e) {
          if (e instanceof ParsingError_1.default) {
            this.synchronize(e);
            return new ErrorNode_1.default({
              tokens: this.tokens.slice(syncStartToken, this.currentToken)
            });
          } else {
            throw e;
          }
        }
      }
      matchAssignmentOrModuleInstantation() {
        if (this.matchToken(TokenType_1.default.Identifier)) {
          if (this.peek().type === TokenType_1.default.Equal) {
            return this.assignmentStatement();
          }
          if (this.peek().type === TokenType_1.default.LeftParen) {
            return this.moduleInstantiationStatement();
          }
          throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedTokenAfterIdentifierInStatementParsingError(this.getLocation(), this.peek().type));
        }
        if (this.matchToken(...moduleInstantiationTagTokens, ...keywordModuleNames)) {
          return this.moduleInstantiationStatement();
        }
        return null;
      }
      blockStatement() {
        const firstBrace = this.previous();
        const startLocation = this.getLocation();
        const innerStatements = [];
        while (!this.checkToken(TokenType_1.default.RightBrace) && !this.isAtEnd()) {
          innerStatements.push(this.statement());
        }
        this.consume(TokenType_1.default.RightBrace, "after block statement");
        const secondBrace = this.previous();
        return new statements_1.BlockStmt(innerStatements, {
          firstBrace,
          secondBrace
        });
      }
      moduleDeclarationStatement() {
        const moduleKeyword = this.previous();
        const nameToken = this.consume(TokenType_1.default.Identifier, "after 'module' keyword");
        this.consume(TokenType_1.default.LeftParen, "after module name");
        const firstParen = this.previous();
        const args = this.args();
        const secondParen = this.previous();
        const body = this.statement();
        const doc = DocComment_1.default.fromExtraTokens(moduleKeyword.extraTokens);
        let name = nameToken.value;
        const renameAnnotation = doc.annotations.find((a) => a instanceof annotations_1.IntrinsicRenameAnnotation);
        if (renameAnnotation) {
          name = renameAnnotation.newName;
        }
        return new statements_1.ModuleDeclarationStmt(name, args, body, {
          moduleKeyword,
          name: nameToken,
          firstParen,
          secondParen
        }, doc);
      }
      functionDeclarationStatement() {
        const functionKeyword = this.previous();
        const nameToken = this.consume(TokenType_1.default.Identifier, "after 'function' keyword");
        this.consume(TokenType_1.default.LeftParen, "after function name");
        const firstParen = this.previous();
        const args = this.args();
        const secondParen = this.previous();
        this.consume(TokenType_1.default.Equal, "after function parameters");
        const equals = this.previous();
        const body = this.expression();
        this.consume(TokenType_1.default.Semicolon, "after function declaration");
        const semicolon = this.previous();
        return new statements_1.FunctionDeclarationStmt(nameToken.value, args, body, {
          functionKeyword,
          equals,
          firstParen,
          name: nameToken,
          secondParen,
          semicolon
        }, DocComment_1.default.fromExtraTokens(functionKeyword.extraTokens));
      }
      assignmentStatement() {
        const pos = this.getLocation();
        const name = this.previous();
        this.consume(TokenType_1.default.Equal, "after assignment name");
        const equals = this.previous();
        const expr = this.expression();
        this.consume(TokenType_1.default.Semicolon, "after assignment statement");
        const semicolon = this.previous();
        const node = new AssignmentNode_1.default(name.value, expr, AssignmentNode_1.AssignmentNodeRole.VARIABLE_DECLARATION, {
          name,
          equals,
          trailingCommas: null,
          semicolon
        });
        node.docComment = DocComment_1.default.fromExtraTokens(name.extraTokens);
        return node;
      }
      moduleInstantiationStatement() {
        if (this.isAtEnd()) {
          throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedEndOfFileBeforeModuleInstantiationParsingError(this.getLocation()));
        }
        if (this.previous().type === TokenType_1.default.Bang) {
          const tagToken = this.previous();
          this.advance();
          const mod2 = this.moduleInstantiationStatement();
          mod2.tagRoot = true;
          mod2.tokens.modifiersInOrder.push(tagToken);
          return mod2;
        }
        if (this.previous().type === TokenType_1.default.Hash) {
          const tagToken = this.previous();
          this.advance();
          const mod2 = this.moduleInstantiationStatement();
          mod2.tagHighlight = true;
          mod2.tokens.modifiersInOrder.push(tagToken);
          return mod2;
        }
        if (this.previous().type === TokenType_1.default.Percent) {
          const tagToken = this.previous();
          this.advance();
          const mod2 = this.moduleInstantiationStatement();
          mod2.tagBackground = true;
          mod2.tokens.modifiersInOrder.push(tagToken);
          return mod2;
        }
        if (this.previous().type === TokenType_1.default.Star) {
          const tagToken = this.previous();
          this.advance();
          const mod2 = this.moduleInstantiationStatement();
          mod2.tagDisabled = true;
          mod2.tokens.modifiersInOrder.push(tagToken);
          return mod2;
        }
        const mod = this.singleModuleInstantiation();
        if (!(mod instanceof statements_1.IfElseStatement)) {
          mod.child = this.statement();
        }
        return mod;
      }
      ifElseStatement() {
        const ifKeyword = this.previous();
        this.consume(TokenType_1.default.LeftParen, "after the if keyword");
        const firstParen = this.previous();
        const cond = this.expression();
        this.consume(TokenType_1.default.RightParen, "after the if condition");
        const secondParen = this.previous();
        const thenBranch = this.statement();
        let elseBranch = null;
        let elseKeyword = null;
        if (this.matchToken(TokenType_1.default.Else)) {
          elseKeyword = this.previous();
          elseBranch = this.statement();
        }
        return new statements_1.IfElseStatement(cond, thenBranch, elseBranch, {
          ifKeyword,
          elseKeyword,
          firstParen,
          secondParen,
          modifiersInOrder: []
        });
      }
      singleModuleInstantiation() {
        const prev = this.previous();
        if (prev.type === TokenType_1.default.If) {
          return this.ifElseStatement();
        }
        this.consume(TokenType_1.default.LeftParen, "after module instantation");
        const firstParen = this.previous();
        let name;
        if (prev instanceof LiteralToken_1.default) {
          name = prev.value;
        } else {
          for (const keywordName of Object.keys(keywords_1.default)) {
            if (keywords_1.default[keywordName] === prev.type) {
              name = keywordName;
              break;
            }
          }
        }
        let isForLoop = name === "for" || name === "intersection_for";
        const args = this.args(true, isForLoop ? AssignmentNode_1.AssignmentNodeRole.VARIABLE_DECLARATION : null);
        const secondParen = this.previous();
        return new statements_1.ModuleInstantiationStmt(name, args, null, {
          firstParen,
          name: prev,
          secondParen,
          modifiersInOrder: []
        });
      }
      /**
       * Parses an argument list including the finishing paren. Can handle trailing and extra commas as well as an empty arguments list.
       * The initial paren must be consumed.
       * @param allowPositional Set to true when in call mode, positional arguments will be allowed.
       */
      args(allowPositional = false, forceType = null) {
        this.consumeUselessCommas();
        const args = [];
        if (this.matchToken(TokenType_1.default.RightParen)) {
          return args;
        }
        while (true) {
          if (this.isAtEnd()) {
            break;
          }
          if (!allowPositional && this.peek().type !== TokenType_1.default.Identifier) {
            break;
          }
          let value = null;
          let name;
          let nameToken = null;
          let equals = null;
          if (!allowPositional || this.peekNext().type === TokenType_1.default.Equal) {
            name = this.advance().value;
            nameToken = this.previous();
            if (this.matchToken(TokenType_1.default.Equal)) {
              equals = this.previous();
              value = this.expression();
            }
          } else {
            name = "";
            value = this.expression();
          }
          const arg = new AssignmentNode_1.default(name, value, forceType == null ? allowPositional ? AssignmentNode_1.AssignmentNodeRole.ARGUMENT_ASSIGNMENT : AssignmentNode_1.AssignmentNodeRole.ARGUMENT_DECLARATION : forceType, {
            name: nameToken,
            equals,
            semicolon: null,
            trailingCommas: []
          });
          args.push(arg);
          if (this.matchToken(TokenType_1.default.Comma)) {
            arg.tokens.trailingCommas.push(this.previous());
            this.consumeUselessCommas(arg.tokens.trailingCommas);
            if (this.matchToken(TokenType_1.default.RightParen)) {
              return args;
            }
            continue;
          }
          this.consumeUselessCommas(arg.tokens.trailingCommas);
          if (this.matchToken(TokenType_1.default.RightParen)) {
            return args;
          }
        }
        if (this.isAtEnd()) {
          throw this.errorCollector.reportError(new parsingErrors_1.UnterminatedParametersListParsingError(this.getLocation()));
        }
        throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedTokenInNamedArgumentsListParsingError(this.getLocation(), this.advance().type));
      }
      /**
       * Parses arguments from the 'for' loop comprehension.
       * The initial paren must be consumed. Stops on semicolon or right paren, but does not consume them.
       */
      forComprehensionArgs() {
        this.consumeUselessCommas();
        const args = [];
        if (this.checkToken(TokenType_1.default.RightParen) || this.checkToken(TokenType_1.default.Semicolon)) {
          return args;
        }
        while (true) {
          if (this.isAtEnd()) {
            break;
          }
          let arg;
          if (this.peek().type === TokenType_1.default.Identifier && this.peekNext().type === TokenType_1.default.Equal) {
            const name = this.advance().value;
            const nameToken = this.previous();
            this.consume(TokenType_1.default.Equal, "after variable name in the 'for' list comprehension");
            const equals = this.previous();
            const value = this.expression();
            arg = new AssignmentNode_1.default(name, value, AssignmentNode_1.AssignmentNodeRole.VARIABLE_DECLARATION, {
              equals,
              semicolon: null,
              name: nameToken,
              trailingCommas: []
            });
            args.push(arg);
          } else {
            const value = this.expression();
            arg = new AssignmentNode_1.default("", value, AssignmentNode_1.AssignmentNodeRole.ARGUMENT_ASSIGNMENT, {
              equals: null,
              semicolon: null,
              name: null,
              trailingCommas: []
            });
            args.push(arg);
          }
          if (this.matchToken(TokenType_1.default.Comma)) {
            arg.tokens.trailingCommas.push(this.previous());
            this.consumeUselessCommas(arg.tokens.trailingCommas);
            if (this.checkToken(TokenType_1.default.RightParen) || this.checkToken(TokenType_1.default.Semicolon)) {
              return args;
            }
            continue;
          }
          this.consumeUselessCommas(arg.tokens.trailingCommas);
          if (this.checkToken(TokenType_1.default.RightParen) || this.checkToken(TokenType_1.default.Semicolon)) {
            return args;
          }
        }
        if (this.isAtEnd()) {
          throw this.errorCollector.reportError(new parsingErrors_1.UnterminatedForLoopParamsParsingError(this.getLocation()));
        }
        throw this.errorCollector.reportError(new parsingErrors_1.UnexpectedTokenInForLoopParamsListParsingError(this.getLocation(), this.advance().type));
      }
      /**
       * Consumes redundant commas and returns true if it consumed any.
       *
       * You can also pass an array of tokens to which all the comma tokens will be pushed.
       */
      consumeUselessCommas(trailingArr) {
        let ret = false;
        while (this.matchToken(TokenType_1.default.Comma) && !this.isAtEnd()) {
          if (trailingArr) {
            trailingArr.push(this.previous());
          }
          ret = true;
        }
        return ret;
      }
      expression() {
        return this.ternary();
      }
      /**
       * Parses the ternary '? :' expression
       */
      ternary() {
        let expr = this.logicalOr();
        while (this.matchToken(TokenType_1.default.QuestionMark)) {
          const questionMark = this.previous();
          const thenBranch = this.ternary();
          this.consume(TokenType_1.default.Colon, "between ternary expression branches");
          const colon = this.previous();
          const elseBranch = this.ternary();
          expr = new expressions_1.TernaryExpr(expr, thenBranch, elseBranch, {
            questionMark,
            colon
          });
        }
        return expr;
      }
      /**
       * Parses the '||' operators
       */
      logicalOr() {
        let expr = this.logicalAnd();
        while (this.matchToken(TokenType_1.default.OR)) {
          const operator = this.previous();
          const right = this.logicalAnd();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      /**
       * Parses the '&&' operators
       */
      logicalAnd() {
        let expr = this.equality();
        while (this.matchToken(TokenType_1.default.AND)) {
          const operator = this.previous();
          const right = this.equality();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      /**
       * Parses the '==' and '!=' operators.
       */
      equality() {
        let expr = this.comparsion();
        while (this.matchToken(TokenType_1.default.EqualEqual, TokenType_1.default.BangEqual)) {
          const operator = this.previous();
          const right = this.comparsion();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      comparsion() {
        let expr = this.addition();
        while (this.matchToken(TokenType_1.default.Less, TokenType_1.default.LessEqual, TokenType_1.default.Greater, TokenType_1.default.GreaterEqual)) {
          const operator = this.previous();
          const right = this.addition();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      addition() {
        let expr = this.multiplication();
        while (this.matchToken(TokenType_1.default.Plus, TokenType_1.default.Minus)) {
          const operator = this.previous();
          const right = this.multiplication();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      multiplication() {
        let expr = this.exponentiation();
        while (this.matchToken(TokenType_1.default.Star, TokenType_1.default.Slash, TokenType_1.default.Percent)) {
          const operator = this.previous();
          const right = this.exponentiation();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      /**
       * Parses b ^ e.
       */
      exponentiation() {
        let expr = this.unary();
        while (this.matchToken(TokenType_1.default.Caret)) {
          const operator = this.previous();
          const right = this.unary();
          expr = new expressions_1.BinaryOpExpr(expr, operator.type, right, {
            operator
          });
        }
        return expr;
      }
      /**
       * Parses +expr, -expr and !expr.
       */
      unary() {
        if (this.matchToken(TokenType_1.default.Plus, TokenType_1.default.Minus, TokenType_1.default.Bang)) {
          const operator = this.previous();
          const right = this.unary();
          return new expressions_1.UnaryOpExpr(operator.type, right, {
            operator
          });
        }
        return this.memberLookupOrArrayLookup();
      }
      memberLookupOrArrayLookup() {
        let expr = this.primary();
        while (true) {
          if (this.matchToken(TokenType_1.default.Dot)) {
            const dot = this.previous();
            const name = this.consume(TokenType_1.default.Identifier, "after '.'");
            expr = new expressions_1.MemberLookupExpr(expr, name.value, {
              dot,
              memberName: name
            });
          } else if (this.matchToken(TokenType_1.default.LeftBracket)) {
            const firstBracket = this.previous();
            const index = this.expression();
            this.consume(TokenType_1.default.RightBracket, "after array index expression");
            const secondBracket = this.previous();
            expr = new expressions_1.ArrayLookupExpr(expr, index, {
              firstBracket,
              secondBracket
            });
          } else if (this.matchToken(TokenType_1.default.LeftParen)) {
            expr = this.finishCall(expr);
          } else {
            break;
          }
        }
        return expr;
      }
      finishCall(callee) {
        const firstParen = this.previous();
        const args = this.args(true);
        const secondParen = this.previous();
        return new expressions_1.FunctionCallExpr(callee, args, {
          firstParen,
          secondParen
        });
      }
      primary() {
        if (this.matchToken(TokenType_1.default.True)) {
          return new expressions_1.LiteralExpr(true, {
            literalToken: this.previous()
          });
        }
        if (this.matchToken(TokenType_1.default.False)) {
          return new expressions_1.LiteralExpr(false, {
            literalToken: this.previous()
          });
        }
        if (this.matchToken(TokenType_1.default.Undef)) {
          return new expressions_1.LiteralExpr(null, {
            literalToken: this.previous()
          });
        }
        if (this.matchToken(TokenType_1.default.NumberLiteral)) {
          return new expressions_1.LiteralExpr(this.previous().value, {
            literalToken: this.previous()
          });
        }
        if (this.matchToken(TokenType_1.default.StringLiteral)) {
          return new expressions_1.LiteralExpr(this.previous().value, {
            literalToken: this.previous()
          });
        }
        if (this.matchToken(TokenType_1.default.Identifier)) {
          const tok = this.previous();
          return new expressions_1.LookupExpr(tok.value, {
            identifier: tok
          });
        }
        if (this.matchToken(TokenType_1.default.Assert)) {
          const keyword = this.previous();
          this.consume(TokenType_1.default.LeftParen, "after call expression");
          const firstParen = this.previous();
          const vars = this.args(true);
          const secondParen = this.previous();
          const innerExpr = this.expression();
          return new expressions_1.AssertExpr(vars, innerExpr, {
            firstParen,
            secondParen,
            name: keyword
          });
        }
        if (this.matchToken(TokenType_1.default.Let)) {
          const keyword = this.previous();
          this.consume(TokenType_1.default.LeftParen, `after call expression`);
          const firstParen = this.previous();
          const vars = this.args(true);
          const secondParen = this.previous();
          const innerExpr = this.expression();
          return new expressions_1.LetExpr(vars, innerExpr, {
            firstParen,
            secondParen,
            name: keyword
          });
        }
        if (this.matchToken(TokenType_1.default.Echo)) {
          const keyword = this.previous();
          this.consume(TokenType_1.default.LeftParen, `after call expression`);
          const firstParen = this.previous();
          const vars = this.args(true);
          const secondParen = this.previous();
          const innerExpr = this.expression();
          return new expressions_1.EchoExpr(vars, innerExpr, {
            firstParen,
            secondParen,
            name: keyword
          });
        }
        if (this.matchToken(TokenType_1.default.Function)) {
          return this.anonymousFunction();
        }
        if (this.matchToken(TokenType_1.default.LeftParen)) {
          const firstParen = this.previous();
          const expr = this.expression();
          this.consume(TokenType_1.default.RightParen, "after grouping expression");
          const secondParen = this.previous();
          return new expressions_1.GroupingExpr(expr, {
            firstParen,
            secondParen
          });
        }
        if (this.matchToken(TokenType_1.default.LeftBracket)) {
          return this.bracketInsides();
        }
        throw this.errorCollector.reportError(new parsingErrors_1.FailedToMatchPrimaryExpressionParsingError(this.previous().span.start));
      }
      /**
       * Handles the parsing of vector literals and range literals.
       */
      bracketInsides() {
        const startBracket = this.previous();
        const uselessCommaTokens = [];
        if (this.consumeUselessCommas(uselessCommaTokens)) {
          this.consume(TokenType_1.default.RightBracket, "after leading commas in a vector literal");
          const secondBracket = this.previous();
          return new expressions_1.VectorExpr([], {
            firstBracket: startBracket,
            secondBracket,
            commas: uselessCommaTokens
          });
        }
        if (this.matchToken(TokenType_1.default.RightBracket)) {
          const secondBracket = this.previous();
          return new expressions_1.VectorExpr([], {
            firstBracket: startBracket,
            commas: [],
            secondBracket
          });
        }
        const first = this.listComprehensionElementsOrExpr();
        if (!(first instanceof expressions_1.ListComprehensionExpression) && this.matchToken(TokenType_1.default.Colon)) {
          const firstColon = this.previous();
          let secondRangeExpr = this.expression();
          let thirdRangeExpr = null;
          let secondColon = null;
          if (this.matchToken(TokenType_1.default.Colon)) {
            secondColon = this.previous();
            thirdRangeExpr = this.expression();
          }
          this.consume(TokenType_1.default.RightBracket, "after expression in a range literal");
          const secondBracket = this.previous();
          if (thirdRangeExpr) {
            return new expressions_1.RangeExpr(first, secondRangeExpr, thirdRangeExpr, {
              firstBracket: startBracket,
              firstColon,
              secondColon,
              secondBracket
            });
          } else {
            return new expressions_1.RangeExpr(first, null, secondRangeExpr, {
              firstBracket: startBracket,
              firstColon,
              secondColon,
              secondBracket
            });
          }
        }
        const vectorLiteral = new expressions_1.VectorExpr([first], {
          commas: [],
          firstBracket: startBracket,
          secondBracket: null
          // we will add the second bracket later in the parsing, so we allow to have a null here
        });
        if (this.matchToken(TokenType_1.default.Comma)) {
          vectorLiteral.tokens.commas.push(this.previous());
          this.consumeUselessCommas(vectorLiteral.tokens.commas);
          if (this.matchToken(TokenType_1.default.RightBracket)) {
            vectorLiteral.tokens.secondBracket = this.previous();
            return vectorLiteral;
          }
          while (true) {
            if (this.isAtEnd()) {
              throw this.errorCollector.reportError(new parsingErrors_1.UnterminatedVectorExpressionParsingError(this.getLocation()));
            }
            vectorLiteral.children.push(this.listComprehensionElementsOrExpr());
            if (this.matchToken(TokenType_1.default.RightBracket)) {
              vectorLiteral.tokens.secondBracket = this.previous();
              break;
            }
            this.consume(TokenType_1.default.Comma, "after vector literal element");
            vectorLiteral.tokens.commas.push(this.previous());
            this.consumeUselessCommas(vectorLiteral.tokens.commas);
            if (this.matchToken(TokenType_1.default.RightBracket)) {
              vectorLiteral.tokens.secondBracket = this.previous();
              break;
            }
          }
        } else {
          this.consume(TokenType_1.default.RightBracket, "after the only vector expression element");
          vectorLiteral.tokens.secondBracket = this.previous();
        }
        return vectorLiteral;
      }
      anonymousFunction() {
        const functionKeyword = this.previous();
        const firstParen = this.consume(TokenType_1.default.LeftParen, "after function keyword in anonymous function");
        const args = this.args();
        const secondParen = this.previous();
        const body = this.expression();
        return new expressions_1.AnonymousFunctionExpr(args, body, {
          functionKeyword,
          firstParen,
          secondParen
        });
      }
      listComprehensionElements() {
        if (this.matchToken(TokenType_1.default.Let)) {
          const letKwrd = this.previous();
          this.consume(TokenType_1.default.LeftParen, "after the let keyword");
          const firstParen = this.previous();
          const args = this.args();
          const secondParen = this.previous();
          const next = this.listComprehensionElementsOrExpr();
          return new expressions_1.LcLetExpr(args, next, {
            letKeyword: letKwrd,
            firstParen,
            secondParen
          });
        }
        if (this.matchToken(TokenType_1.default.Each)) {
          const eachKwrd = this.previous();
          const next = this.listComprehensionElementsOrExpr();
          return new expressions_1.LcEachExpr(next, {
            eachKeyword: eachKwrd
          });
        }
        if (this.matchToken(TokenType_1.default.For)) {
          return this.listComprehensionFor();
        }
        if (this.matchToken(TokenType_1.default.If)) {
          const ifKwrd = this.previous();
          this.consume(TokenType_1.default.LeftParen, "after the if keyword");
          const firstParen = this.previous();
          const cond = this.expression();
          this.consume(TokenType_1.default.RightParen, "after the if comprehension condition");
          const secondParen = this.previous();
          const thenBranch = this.listComprehensionElementsOrExpr();
          let elseBranch = null;
          let elseKeyword = null;
          if (this.matchToken(TokenType_1.default.Else)) {
            elseKeyword = this.previous();
            elseBranch = this.listComprehensionElementsOrExpr();
          }
          return new expressions_1.LcIfExpr(cond, thenBranch, elseBranch, {
            ifKeyword: ifKwrd,
            elseKeyword,
            firstParen,
            secondParen
          });
        }
        throw new Error("Unexpected token in list comprehension elements! THIS SHOULD NOT HAPPEN");
      }
      listComprehensionFor() {
        const forKwrd = this.previous();
        this.consume(TokenType_1.default.LeftParen, "after for keyword in list comprehension");
        const firstParen = this.previous();
        const firstArgs = this.forComprehensionArgs();
        if (this.matchToken(TokenType_1.default.RightParen)) {
          const secondParen2 = this.previous();
          return new expressions_1.LcForExpr(firstArgs, this.listComprehensionElementsOrExpr(), {
            forKeyword: forKwrd,
            firstParen,
            secondParen: secondParen2
          });
        }
        this.consume(TokenType_1.default.Semicolon, "after first 'for' comprehension parameters");
        const firstSemicolon = this.previous();
        const condition = this.expression();
        this.consume(TokenType_1.default.Semicolon, "after 'for' comprehension condition");
        const secondSemicolon = this.previous();
        const secondArgs = this.forComprehensionArgs();
        this.consume(TokenType_1.default.RightParen, "after second 'for' comprehension parameters");
        const secondParen = this.previous();
        const next = this.listComprehensionElementsOrExpr();
        return new expressions_1.LcForCExpr(firstArgs, secondArgs, condition, next, {
          firstParen,
          forKeyword: forKwrd,
          firstSemicolon,
          secondParen,
          secondSemicolon
        });
      }
      listComprehensionElementsOrExpr() {
        if (listComprehensionElementKeywords.includes(this.peek().type) || this.peek().type === TokenType_1.default.LeftParen && listComprehensionElementKeywords.includes(this.peekNext().type)) {
          let withParens = false;
          if (this.matchToken(TokenType_1.default.LeftParen)) {
            withParens = true;
          }
          const comprElemsResult = this.listComprehensionElements();
          if (withParens) {
            this.consume(TokenType_1.default.RightParen, "after parenthesized list comprehension expression");
          }
          return comprElemsResult;
        }
        return this.expression();
      }
      consume(tt, where) {
        if (this.checkToken(tt)) {
          return this.advance();
        }
        throw this.errorCollector.reportError(new parsingErrors_1.ConsumptionParsingError(this.getLocation(), this.peek().type, tt, where));
      }
      matchToken(...toMatch) {
        for (const tt of toMatch) {
          if (this.checkToken(tt)) {
            this.advance();
            return true;
          }
        }
        return false;
      }
      checkToken(tt) {
        if (this.isAtEnd()) {
          return false;
        }
        return this.peek().type == tt;
      }
      advance() {
        if (!this.isAtEnd()) {
          this.currentToken++;
        }
        return this.previous();
      }
      isAtEnd() {
        return this.peek().type === TokenType_1.default.Eot;
      }
      peek() {
        return this.tokens[this.currentToken];
      }
      peekNext() {
        if (this.tokens[this.currentToken].type === TokenType_1.default.Eot) {
          return this.tokens[this.currentToken];
        }
        return this.tokens[this.currentToken + 1];
      }
      getLocation() {
        return this.peek().span.start;
      }
      previous() {
        return this.tokens[this.currentToken - 1];
      }
    };
    exports.default = Parser;
  }
});

// node_modules/openscad-parser/dist/ParsingHelper.js
var require_ParsingHelper = __commonJS({
  "node_modules/openscad-parser/dist/ParsingHelper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ErrorCollector_1 = require_ErrorCollector();
    var Lexer_1 = require_Lexer();
    var Parser_1 = require_Parser();
    var ParsingHelper = class {
      static parseFile(f) {
        const errorCollector = new ErrorCollector_1.default();
        const lexer = new Lexer_1.default(f, errorCollector);
        let tokens;
        try {
          tokens = lexer.scan();
        } catch (e) {
        }
        if (errorCollector.hasErrors()) {
          return [null, errorCollector];
        }
        if (!tokens) {
          throw new Error("No tokens returned from lexer, and no errors were reported");
        }
        const parser = new Parser_1.default(f, tokens, errorCollector);
        let ast = null;
        try {
          ast = parser.parse();
        } catch (e) {
        }
        return [ast, errorCollector];
      }
    };
    exports.default = ParsingHelper;
  }
});

// node_modules/openscad-parser/dist/semantic/Scope.js
var require_Scope = __commonJS({
  "node_modules/openscad-parser/dist/semantic/Scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Scope = class _Scope {
      /**
       * References to other, 'include'd or 'use'd file scopes, filled by the solution manager.
       * We can use those scopes to resolve types from those files.
       */
      siblingScopes = [];
      parent = null;
      functions = /* @__PURE__ */ new Map();
      variables = /* @__PURE__ */ new Map();
      modules = /* @__PURE__ */ new Map();
      copy() {
        const s = new _Scope();
        s.siblingScopes = [...this.siblingScopes];
        s.functions = this.functions;
        s.variables = this.variables;
        s.modules = this.modules;
        return s;
      }
      lookupVariable(name) {
        return this.lookup("variables", name);
      }
      lookupModule(name) {
        return this.lookup("modules", name);
      }
      lookupFunction(name) {
        return this.lookup("functions", name);
      }
      lookup(x, name, visited = /* @__PURE__ */ new WeakMap()) {
        if (visited.has(this)) {
          return null;
        }
        visited.set(this, true);
        if (this[x].has(name)) {
          return this[x].get(name) || null;
        }
        if (this.parent) {
          const val = this.parent.lookup(x, name, visited);
          if (val) {
            return val;
          }
        }
        for (const ss of this.siblingScopes) {
          const val = ss.lookup(x, name, visited);
          if (val) {
            return val;
          }
        }
        return null;
      }
    };
    exports.default = Scope;
  }
});

// node_modules/openscad-parser/dist/semantic/ASTScopePopulator.js
var require_ASTScopePopulator = __commonJS({
  "node_modules/openscad-parser/dist/semantic/ASTScopePopulator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var AssignmentNode_1 = require_AssignmentNode();
    var ErrorNode_1 = require_ErrorNode();
    var expressions_1 = require_expressions();
    var statements_1 = require_statements();
    var nodesWithScopes_1 = require_nodesWithScopes();
    var Scope_1 = require_Scope();
    var ASTScopePopulator = class _ASTScopePopulator {
      nearestScope;
      constructor(rootScope) {
        this.nearestScope = rootScope;
      }
      copyWithNewNearestScope(newScope) {
        return new _ASTScopePopulator(newScope);
      }
      populate(n) {
        return n.accept(this);
      }
      visitScadFile(n) {
        const sf = new nodesWithScopes_1.ScadFileWithScope(n.statements.map((stmt) => stmt.accept(this)), n.tokens);
        sf.scope = this.nearestScope;
        return sf;
      }
      visitAssignmentNode(n) {
        const an = new AssignmentNode_1.default(n.name, n.value ? n.value.accept(this) : null, n.role, n.tokens);
        if (n.name && n.role != AssignmentNode_1.AssignmentNodeRole.ARGUMENT_ASSIGNMENT) {
          this.nearestScope.variables.set(an.name, an);
        }
        return an;
      }
      visitUnaryOpExpr(n) {
        return new expressions_1.UnaryOpExpr(n.operation, n.right.accept(this), n.tokens);
      }
      visitBinaryOpExpr(n) {
        return new expressions_1.BinaryOpExpr(n.left.accept(this), n.operation, n.right.accept(this), n.tokens);
      }
      visitTernaryExpr(n) {
        return new expressions_1.TernaryExpr(n.cond.accept(this), n.ifExpr.accept(this), n.elseExpr.accept(this), n.tokens);
      }
      visitArrayLookupExpr(n) {
        return new expressions_1.ArrayLookupExpr(n.array.accept(this), n.index.accept(this), n.tokens);
      }
      visitLiteralExpr(n) {
        return new expressions_1.LiteralExpr(n.value, n.tokens);
      }
      visitRangeExpr(n) {
        return new expressions_1.RangeExpr(n.begin.accept(this), n.step ? n.step.accept(this) : null, n.end.accept(this), n.tokens);
      }
      visitVectorExpr(n) {
        return new expressions_1.VectorExpr(n.children.map((c) => c.accept(this)), n.tokens);
      }
      visitLookupExpr(n) {
        return new expressions_1.LookupExpr(n.name, n.tokens);
      }
      visitMemberLookupExpr(n) {
        return new expressions_1.MemberLookupExpr(n.expr.accept(this), n.member, n.tokens);
      }
      visitFunctionCallExpr(n) {
        return new expressions_1.FunctionCallExpr(n.callee, n.args.map((a) => a.accept(this)), n.tokens);
      }
      visitLetExpr(n) {
        const letExprWithScope = new nodesWithScopes_1.LetExprWithScope(null, null, n.tokens);
        letExprWithScope.scope = new Scope_1.default();
        letExprWithScope.scope.parent = this.nearestScope;
        const copy = this.copyWithNewNearestScope(letExprWithScope.scope);
        letExprWithScope.args = n.args.map((a) => a.accept(copy));
        letExprWithScope.expr = n.expr.accept(copy);
        for (const a of letExprWithScope.args) {
          if (a.name) {
            letExprWithScope.scope.variables.set(a.name, a);
          }
        }
        return letExprWithScope;
      }
      visitAssertExpr(n) {
        return new expressions_1.AssertExpr(n.args.map((a) => a.accept(this)), n.expr.accept(this), n.tokens);
      }
      visitEchoExpr(n) {
        return new expressions_1.EchoExpr(n.args.map((a) => a.accept(this)), n.expr.accept(this), n.tokens);
      }
      visitLcIfExpr(n) {
        return new expressions_1.LcIfExpr(n.cond.accept(this), n.ifExpr.accept(this), n.elseExpr ? n.elseExpr.accept(this) : null, n.tokens);
      }
      visitLcEachExpr(n) {
        return new expressions_1.LcEachExpr(n.expr.accept(this), n.tokens);
      }
      visitLcForExpr(n) {
        const newNode = new nodesWithScopes_1.LcForExprWithScope(null, null, n.tokens);
        newNode.scope = new Scope_1.default();
        newNode.scope.parent = this.nearestScope;
        const copy = this.copyWithNewNearestScope(newNode.scope);
        newNode.args = n.args.map((a) => a.accept(copy));
        newNode.expr = n.expr.accept(copy);
        return newNode;
      }
      visitLcForCExpr(n) {
        const newNode = new nodesWithScopes_1.LcForCExprWithScope(null, null, null, null, n.tokens);
        newNode.scope = new Scope_1.default();
        newNode.scope.parent = this.nearestScope;
        const copy = this.copyWithNewNearestScope(newNode.scope);
        newNode.args = n.args.map((a) => a.accept(copy));
        newNode.incrArgs = n.incrArgs.map((a) => a.accept(copy));
        newNode.cond = n.cond.accept(copy);
        newNode.expr = n.expr.accept(copy);
        return newNode;
      }
      visitLcLetExpr(n) {
        const lcLetWithScopeExpr = new nodesWithScopes_1.LcLetExprWithScope(null, null, n.tokens);
        lcLetWithScopeExpr.scope = new Scope_1.default();
        lcLetWithScopeExpr.scope.parent = this.nearestScope;
        const copy = this.copyWithNewNearestScope(lcLetWithScopeExpr.scope);
        lcLetWithScopeExpr.args = n.args.map((a) => a.accept(copy));
        lcLetWithScopeExpr.expr = n.expr.accept(copy);
        return lcLetWithScopeExpr;
      }
      visitGroupingExpr(n) {
        return new expressions_1.GroupingExpr(n.inner.accept(this), n.tokens);
      }
      visitUseStmt(n) {
        return n;
      }
      visitIncludeStmt(n) {
        return n;
      }
      visitModuleInstantiationStmt(n) {
        if (n.name === "for" || n.name === "intersection_for") {
          const inst2 = new nodesWithScopes_1.ModuleInstantiationStmtWithScope(n.name, null, null, n.tokens);
          inst2.scope = new Scope_1.default();
          inst2.scope.parent = this.nearestScope;
          const copy = this.copyWithNewNearestScope(inst2.scope);
          inst2.args = n.args.map((a) => a.accept(copy));
          inst2.child = n.child ? n.child.accept(copy) : null;
        }
        const inst = new statements_1.ModuleInstantiationStmt(n.name, n.args.map((a) => a.accept(this)), n.child ? n.child.accept(this) : null, n.tokens);
        inst.tagRoot = n.tagRoot;
        inst.tagHighlight = n.tagHighlight;
        inst.tagBackground = n.tagBackground;
        inst.tagDisabled = n.tagDisabled;
        return inst;
      }
      visitModuleDeclarationStmt(n) {
        const md = new nodesWithScopes_1.ModuleDeclarationStmtWithScope(n.name, null, null, n.tokens, n.docComment);
        this.nearestScope.modules.set(md.name, md);
        md.scope = new Scope_1.default();
        md.scope.parent = this.nearestScope;
        const copy = this.copyWithNewNearestScope(md.scope);
        md.definitionArgs = n.definitionArgs.map((a) => a.accept(copy));
        md.stmt = n.stmt.accept(copy);
        return md;
      }
      visitFunctionDeclarationStmt(n) {
        const fDecl = new nodesWithScopes_1.FunctionDeclarationStmtWithScope(n.name, null, null, n.tokens, n.docComment);
        this.nearestScope.functions.set(n.name, fDecl);
        fDecl.scope = new Scope_1.default();
        fDecl.scope.parent = this.nearestScope;
        const newPopulator = this.copyWithNewNearestScope(fDecl.scope);
        fDecl.definitionArgs = n.definitionArgs.map((a) => a.accept(newPopulator));
        fDecl.expr = n.expr.accept(newPopulator);
        return fDecl;
      }
      visitAnonymousFunctionExpr(n) {
        const fDecl = new nodesWithScopes_1.AnonymousFunctionExprWithScope(null, null, n.tokens);
        fDecl.scope = new Scope_1.default();
        fDecl.scope.parent = this.nearestScope;
        const newPopulator = this.copyWithNewNearestScope(fDecl.scope);
        fDecl.definitionArgs = n.definitionArgs.map((a) => a.accept(newPopulator));
        fDecl.expr = n.expr.accept(newPopulator);
        return fDecl;
      }
      visitBlockStmt(n) {
        const blk = new nodesWithScopes_1.BlockStmtWithScope(null, n.tokens);
        blk.scope = new Scope_1.default();
        blk.scope.parent = this.nearestScope;
        blk.children = n.children.map((c) => c.accept(this.copyWithNewNearestScope(blk.scope)));
        return blk;
      }
      visitNoopStmt(n) {
        return new statements_1.NoopStmt(n.tokens);
      }
      visitIfElseStatement(n) {
        return new statements_1.IfElseStatement(n.cond.accept(this), n.thenBranch.accept(this), n.elseBranch ? n.elseBranch.accept(this) : null, n.tokens);
      }
      visitErrorNode(n) {
        return new ErrorNode_1.default(n.tokens);
      }
    };
    exports.default = ASTScopePopulator;
  }
});

// node_modules/openscad-parser/dist/prelude/PreludeUtil.js
var require_PreludeUtil = __commonJS({
  "node_modules/openscad-parser/dist/prelude/PreludeUtil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var fs_1 = require_node_shims();
    var path_1 = require_node_shims();
    var CodeFile_1 = require_CodeFile();
    var ParsingHelper_1 = require_ParsingHelper();
    var ASTScopePopulator_1 = require_ASTScopePopulator();
    var Scope_1 = require_Scope();
    var PreludeUtil = class {
      static _cachedPreludeScope = null;
      static get preludeScope() {
        if (!this._cachedPreludeScope) {
          const preludeLocation = (0, path_1.join)(__dirname, "prelude.scad");
          let [ast, ec] = ParsingHelper_1.default.parseFile(new CodeFile_1.default(preludeLocation, (0, fs_1.readFileSync)(preludeLocation, "utf8")));
          ec.throwIfAny();
          this._cachedPreludeScope = new Scope_1.default();
          const pop = new ASTScopePopulator_1.default(this._cachedPreludeScope);
          if (!ast) {
            throw new Error("prelude ast is null");
          }
          ast = ast.accept(pop);
        }
        return this._cachedPreludeScope;
      }
    };
    exports.default = PreludeUtil;
  }
});

// node_modules/openscad-parser/dist/semantic/ASTSymbolLister.js
var require_ASTSymbolLister = __commonJS({
  "node_modules/openscad-parser/dist/semantic/ASTSymbolLister.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SymbolKind = void 0;
    var AssignmentNode_1 = require_AssignmentNode();
    var statements_1 = require_statements();
    var ASTAssembler_1 = require_ASTAssembler();
    var CodeSpan_1 = require_CodeSpan();
    var SymbolKind;
    (function(SymbolKind2) {
      SymbolKind2[SymbolKind2["MODULE"] = 0] = "MODULE";
      SymbolKind2[SymbolKind2["FUNCTION"] = 1] = "FUNCTION";
      SymbolKind2[SymbolKind2["VARIABLE"] = 2] = "VARIABLE";
    })(SymbolKind || (exports.SymbolKind = SymbolKind = {}));
    var ASTSymbolLister = class extends ASTAssembler_1.default {
      makeSymbol;
      constructor(makeSymbol) {
        super();
        this.makeSymbol = makeSymbol;
      }
      /**
       * Returns the node at pinpointLocation and populates bottomUpHierarchy.
       * @param n The AST (or AST fragment) to search through.
       */
      doList(n) {
        n.accept(this);
        return this.symbolsAtCurrentDepth;
      }
      symbolsAtCurrentDepth = [];
      processAssembledNode(t, self) {
        let currKind = null;
        let currName = null;
        if (self instanceof statements_1.FunctionDeclarationStmt) {
          currKind = SymbolKind.FUNCTION;
          currName = self.tokens.name;
        } else if (self instanceof statements_1.ModuleDeclarationStmt) {
          currKind = SymbolKind.MODULE;
          currName = self.tokens.name;
        } else if (self instanceof AssignmentNode_1.default && self.role === AssignmentNode_1.AssignmentNodeRole.VARIABLE_DECLARATION) {
          currKind = SymbolKind.VARIABLE;
          currName = self.tokens.name;
        }
        const newArr = [];
        for (const m of t) {
          if (typeof m === "function") {
            newArr.push(...m());
          } else {
            newArr.push(m);
          }
        }
        if (currKind != null && currName != null) {
          let savedSymbols = this.symbolsAtCurrentDepth;
          this.symbolsAtCurrentDepth = [];
          const childrenSymbols = this.symbolsAtCurrentDepth;
          this.symbolsAtCurrentDepth = savedSymbols;
          this.symbolsAtCurrentDepth.push(this.makeSymbol(currName.value, currKind, CodeSpan_1.default.combine(...newArr.map((t2) => t2.span)), currName.span, childrenSymbols));
          return newArr;
        } else {
          return newArr;
        }
      }
    };
    exports.default = ASTSymbolLister;
  }
});

// node_modules/openscad-parser/dist/semantic/CompletionSymbol.js
var require_CompletionSymbol = __commonJS({
  "node_modules/openscad-parser/dist/semantic/CompletionSymbol.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CompletionSymbol = class {
      type;
      name;
      decl;
      constructor(type, name, decl) {
        this.type = type;
        this.name = name;
        this.decl = decl;
      }
    };
    exports.default = CompletionSymbol;
  }
});

// node_modules/openscad-parser/dist/semantic/CompletionType.js
var require_CompletionType = __commonJS({
  "node_modules/openscad-parser/dist/semantic/CompletionType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CompletionType;
    (function(CompletionType2) {
      CompletionType2[CompletionType2["VARIABLE"] = 0] = "VARIABLE";
      CompletionType2[CompletionType2["FUNCTION"] = 1] = "FUNCTION";
      CompletionType2[CompletionType2["MODULE"] = 2] = "MODULE";
      CompletionType2[CompletionType2["KEYWORD"] = 3] = "KEYWORD";
      CompletionType2[CompletionType2["FILE"] = 4] = "FILE";
      CompletionType2[CompletionType2["DIRECTORY"] = 5] = "DIRECTORY";
    })(CompletionType || (CompletionType = {}));
    exports.default = CompletionType;
  }
});

// node_modules/openscad-parser/dist/semantic/IncludeResolver.js
var require_IncludeResolver = __commonJS({
  "node_modules/openscad-parser/dist/semantic/IncludeResolver.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UsedFileNotFoundError = exports.IncludedFileNotFoundError = void 0;
    var statements_1 = require_statements();
    var fs_1 = require_node_shims();
    var os = require_node_shims();
    var path = require_node_shims();
    var CodeError_1 = require_CodeError();
    var IncludedFileNotFoundError = class extends CodeError_1.default {
      constructor(pos, filename) {
        super(pos, `Included file '${filename} not found.'`);
      }
    };
    exports.IncludedFileNotFoundError = IncludedFileNotFoundError;
    var UsedFileNotFoundError = class extends CodeError_1.default {
      constructor(pos, filename) {
        super(pos, `Used file '${filename} not found.'`);
      }
    };
    exports.UsedFileNotFoundError = UsedFileNotFoundError;
    var IncludeResolver = class _IncludeResolver {
      provider;
      constructor(provider) {
        this.provider = provider;
      }
      /**
       * Finds all file includes and returns paths to them
       * @param f
       */
      async resolveIncludes(f, ec) {
        if (!f.span.start.file) {
          throw new Error("file in pos is null");
        }
        const includes = [];
        for (const stmt of f.statements) {
          if (stmt instanceof statements_1.IncludeStmt) {
            const filePath = await this.locateScadFile(f.span.start.file.path, stmt.filename);
            if (!filePath) {
              ec.reportError(new IncludedFileNotFoundError(stmt.tokens.filename.span.start, stmt.filename));
              continue;
            }
            includes.push(filePath);
          }
        }
        return Promise.all(includes.map((incl) => this.provider.provideScadFile(incl)));
      }
      /**
       * Finds all file uses and returns paths to them.
       * Uses do not export to parent scopes and do not execute statements inside of the used files.
       * @param f
       */
      async resolveUses(f, ec) {
        if (!f.span.start.file) {
          throw new Error("file in pos is null");
        }
        const uses = [];
        for (const stmt of f.statements) {
          if (stmt instanceof statements_1.UseStmt) {
            const filePath = await this.locateScadFile(f.span.start.file.path, stmt.filename);
            if (!filePath) {
              ec.reportError(new UsedFileNotFoundError(stmt.tokens.filename.span.start, stmt.filename));
              continue;
            }
            uses.push(filePath);
          }
        }
        return Promise.all(uses.map((incl) => this.provider.provideScadFile(incl)));
      }
      async locateScadFile(parent, relativePath) {
        const searchDirs = [path.dirname(parent), ..._IncludeResolver.includeDirs];
        for (const dir of searchDirs) {
          const resultingPath = path.resolve(dir, relativePath);
          try {
            if ((await fs_1.promises.stat(resultingPath)).isFile()) {
              return resultingPath;
            }
          } catch (e) {
          }
        }
        return null;
      }
      static _includeDirsCache = null;
      static get includeDirs() {
        if (!this._includeDirsCache) {
          this._includeDirsCache = [];
          const ENV_SEP = os.platform() === "win32" ? ";" : ":";
          this._includeDirsCache.push(...(process.env.OPENSCADPATH || "").split(ENV_SEP));
          if (os.platform() === "win32") {
          }
          if (os.platform() === "linux") {
            this._includeDirsCache.push(path.join(os.homedir(), ".local/share/OpenSCAD/libraries"));
            this._includeDirsCache.push("/usr/share/openscad/libraries");
          }
          if (os.platform() === "darwin") {
            this._includeDirsCache.push(path.join(os.homedir(), "Documents/OpenSCAD/libraries"));
          }
        }
        return this._includeDirsCache;
      }
    };
    exports.default = IncludeResolver;
  }
});

// node_modules/openscad-parser/dist/semantic/FilenameCompletionProvider.js
var require_FilenameCompletionProvider = __commonJS({
  "node_modules/openscad-parser/dist/semantic/FilenameCompletionProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CompletionSymbol_1 = require_CompletionSymbol();
    var path = require_node_shims();
    var fs_1 = require_node_shims();
    var CompletionType_1 = require_CompletionType();
    var IncludeResolver_1 = require_IncludeResolver();
    var CodeLocation_1 = require_CodeLocation();
    var FilenameCompletionProvider = class {
      textOnly = true;
      exclusive = true;
      /**
       * Determines whether we are in a include<> or use<> statement
       * @param ast
       * @param loc
       */
      shouldActivate(ast, loc) {
        return this.getExistingPath(ast, loc) != null;
      }
      async getSymbolsAtLocation(ast, locM) {
        const loc = new CodeLocation_1.default(locM.file, locM.char, locM.line, locM.col);
        let existingPath = this.getExistingPath(ast, loc) || "";
        let searchDirs = [];
        if (path.isAbsolute(existingPath)) {
          searchDirs = [path.dirname(existingPath)];
        } else {
          searchDirs = IncludeResolver_1.default.includeDirs.map((id) => path.join(id, path.dirname(existingPath)));
        }
        let output = [];
        for (const sd of searchDirs) {
          try {
            const filenames = (await fs_1.promises.readdir(sd)).filter((p) => p.startsWith(path.basename(existingPath)));
            output = [
              ...output,
              ...(await Promise.all(filenames.map(async (f) => {
                const stat = await fs_1.promises.stat(path.join(sd, f));
                if (stat.isDirectory()) {
                  return new CompletionSymbol_1.default(CompletionType_1.default.DIRECTORY, f);
                }
                if (stat.isFile() && f.endsWith(".scad")) {
                  return new CompletionSymbol_1.default(CompletionType_1.default.FILE, f);
                }
                return null;
              }))).filter((s) => !!s)
            ];
          } catch (e) {
            console.error("filed to find in dir", sd, e);
          }
        }
        return output;
      }
      /**
       * Obtains the part of the included path the user has already entered
       * @param ast the ast to search
       * @param loc the location where the user is typing
       * @returns the part of the included path the user has already entered
       */
      getExistingPath(ast, loc) {
        let charPos = loc.char;
        let linesLimit = 5;
        let stage = 0;
        let existingFilename = "";
        let isFirst = true;
        if (!loc.file) {
          throw new Error("No file in CodeLocation");
        }
        while (true) {
          if (charPos <= 0 || linesLimit <= 0) {
            return null;
          }
          const char = loc.file.code[charPos];
          if (char === "\n") {
            linesLimit--;
          }
          if (!isFirst && char === ">") {
            return null;
          }
          if (!isFirst && stage === 0 && char === "<") {
            stage++;
            existingFilename = loc.file.code.substring(charPos + 1, loc.char + 1);
          } else if (stage === 1 && char !== " " && char !== "	" && char !== "\r" && char !== "\n") {
            if (loc.file.code.substring(charPos - "use".length + 1, charPos + 1) === "use") {
              if (existingFilename.endsWith(">")) {
                return existingFilename.slice(0, -1);
              }
              return existingFilename;
            }
            if (loc.file.code.substring(charPos - "include".length + 1, charPos + 1) === "include") {
              if (existingFilename.endsWith(">")) {
                return existingFilename.slice(0, -1);
              }
              return existingFilename;
            }
            return null;
          }
          isFirst = false;
          charPos--;
        }
      }
    };
    exports.default = FilenameCompletionProvider;
  }
});

// node_modules/openscad-parser/dist/semantic/KeywordsCompletionProvider.js
var require_KeywordsCompletionProvider = __commonJS({
  "node_modules/openscad-parser/dist/semantic/KeywordsCompletionProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CompletionSymbol_1 = require_CompletionSymbol();
    var keywords_1 = require_keywords();
    var CompletionType_1 = require_CompletionType();
    var KeywordsCompletionProvider = class {
      textOnly = true;
      exclusive = false;
      shouldActivate(ast, loc) {
        return true;
      }
      async getSymbolsAtLocation(ast, loc) {
        return Object.keys(keywords_1.default).map((kwrd) => new CompletionSymbol_1.default(CompletionType_1.default.KEYWORD, kwrd));
      }
    };
    exports.default = KeywordsCompletionProvider;
  }
});

// node_modules/openscad-parser/dist/semantic/ScopeSymbolCompletionProvider.js
var require_ScopeSymbolCompletionProvider = __commonJS({
  "node_modules/openscad-parser/dist/semantic/ScopeSymbolCompletionProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ASTPinpointer_1 = require_ASTPinpointer();
    var CompletionSymbol_1 = require_CompletionSymbol();
    var CompletionType_1 = require_CompletionType();
    var Scope_1 = require_Scope();
    var ScopeSymbolCompletionProvider = class {
      textOnly = false;
      exclusive = false;
      shouldActivate(ast, loc) {
        return true;
      }
      async getSymbolsAtLocation(ast, loc) {
        const pp = new ASTPinpointer_1.default(loc);
        pp.doPinpoint(ast);
        let symbols = [];
        const scopesToShow = [];
        for (const h of pp.bottomUpHierarchy) {
          const hh = h;
          if ("scope" in hh && hh.scope instanceof Scope_1.default) {
            scopesToShow.push(hh.scope);
            scopesToShow.push(...hh.scope.siblingScopes);
          }
        }
        for (const scope of scopesToShow) {
          for (const v of scope.variables) {
            symbols.push(new CompletionSymbol_1.default(CompletionType_1.default.VARIABLE, v[1].name, v[1]));
          }
          for (const f of scope.functions) {
            symbols.push(new CompletionSymbol_1.default(CompletionType_1.default.FUNCTION, f[1].name, f[1]));
          }
          for (const m of scope.modules) {
            symbols.push(new CompletionSymbol_1.default(CompletionType_1.default.MODULE, m[1].name, m[1]));
          }
        }
        return symbols;
      }
    };
    exports.default = ScopeSymbolCompletionProvider;
  }
});

// node_modules/openscad-parser/dist/semantic/CompletionUtil.js
var require_CompletionUtil = __commonJS({
  "node_modules/openscad-parser/dist/semantic/CompletionUtil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var FilenameCompletionProvider_1 = require_FilenameCompletionProvider();
    var KeywordsCompletionProvider_1 = require_KeywordsCompletionProvider();
    var ScopeSymbolCompletionProvider_1 = require_ScopeSymbolCompletionProvider();
    var CompletionUtil = class {
      static completionProviders = [
        new FilenameCompletionProvider_1.default(),
        new KeywordsCompletionProvider_1.default(),
        new ScopeSymbolCompletionProvider_1.default()
      ];
      static async getSymbolsAtLocation(ast, loc) {
        let symbols = [];
        for (const cp of this.completionProviders) {
          if (!cp.textOnly && !ast)
            continue;
          if (cp.shouldActivate(ast, loc)) {
            symbols = [...symbols, ...await cp.getSymbolsAtLocation(ast, loc)];
            if (cp.exclusive) {
              break;
            }
          }
        }
        return symbols;
      }
    };
    exports.default = CompletionUtil;
  }
});

// node_modules/openscad-parser/dist/semantic/resolvedNodes.js
var require_resolvedNodes = __commonJS({
  "node_modules/openscad-parser/dist/semantic/resolvedNodes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ResolvedModuleInstantiationStmt = exports.ResolvedLookupExpr = void 0;
    var expressions_1 = require_expressions();
    var statements_1 = require_statements();
    var ResolvedLookupExpr = class extends expressions_1.LookupExpr {
      resolvedDeclaration;
    };
    exports.ResolvedLookupExpr = ResolvedLookupExpr;
    var ResolvedModuleInstantiationStmt = class extends statements_1.ModuleInstantiationStmt {
      resolvedDeclaration;
    };
    exports.ResolvedModuleInstantiationStmt = ResolvedModuleInstantiationStmt;
  }
});

// node_modules/openscad-parser/dist/semantic/unresolvedSymbolErrors.js
var require_unresolvedSymbolErrors = __commonJS({
  "node_modules/openscad-parser/dist/semantic/unresolvedSymbolErrors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.UnresolvedVariableError = exports.UnresolvedModuleError = exports.UnresolvedFunctionError = void 0;
    var CodeError_1 = require_CodeError();
    var UnresolvedFunctionError = class extends CodeError_1.default {
      constructor(pos, functionName) {
        super(pos, `Unresolved function '${functionName}'.`);
      }
    };
    exports.UnresolvedFunctionError = UnresolvedFunctionError;
    var UnresolvedModuleError = class extends CodeError_1.default {
      constructor(pos, functionName) {
        super(pos, `Unresolved module '${functionName}'.`);
      }
    };
    exports.UnresolvedModuleError = UnresolvedModuleError;
    var UnresolvedVariableError = class extends CodeError_1.default {
      constructor(pos, functionName) {
        super(pos, `Unresolved variable '${functionName}'.`);
      }
    };
    exports.UnresolvedVariableError = UnresolvedVariableError;
  }
});

// node_modules/openscad-parser/dist/semantic/SymbolResolver.js
var require_SymbolResolver = __commonJS({
  "node_modules/openscad-parser/dist/semantic/SymbolResolver.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ASTMutator_1 = require_ASTMutator();
    var resolvedNodes_1 = require_resolvedNodes();
    var unresolvedSymbolErrors_1 = require_unresolvedSymbolErrors();
    var SymbolResolver = class _SymbolResolver extends ASTMutator_1.default {
      errorCollector;
      currentScope;
      isInCallee;
      constructor(errorCollector, currentScope = null, isInCallee = false) {
        super();
        this.errorCollector = errorCollector;
        this.currentScope = currentScope;
        this.isInCallee = isInCallee;
      }
      visitLookupExpr(n) {
        if (!this.currentScope) {
          throw new Error("currentScope cannot be null when resolving lookup");
        }
        const resolved = new resolvedNodes_1.ResolvedLookupExpr(n.name, n.tokens);
        resolved.resolvedDeclaration = this.currentScope.lookupVariable(n.name);
        if (this.isInCallee && !resolved.resolvedDeclaration) {
          resolved.resolvedDeclaration = this.currentScope.lookupFunction(n.name);
        }
        if (!resolved.resolvedDeclaration) {
          this.errorCollector.reportError(new unresolvedSymbolErrors_1.UnresolvedVariableError(n.span.start, n.name));
          return n;
        }
        return resolved;
      }
      visitModuleInstantiationStmt(n) {
        if (!this.currentScope) {
          throw new Error("currentScope cannot be null when resolving module");
        }
        const resolved = new resolvedNodes_1.ResolvedModuleInstantiationStmt(n.name, n.args.map((a) => a.accept(this)), n.child ? n.child.accept(this) : null, n.tokens);
        resolved.resolvedDeclaration = this.currentScope.lookupModule(n.name);
        if (!resolved.resolvedDeclaration) {
          this.errorCollector.reportError(new unresolvedSymbolErrors_1.UnresolvedModuleError(n.span.start, n.name));
          return n;
        }
        return resolved;
      }
      /**
       * visitFunctionCallExpr switches the SymbolResolver into a special mode where
       * it falls back to resolving named functions when processing lookup expressions.
       * This behaviour tries to mimic the behaviour of OpenSCAD's function call resolution,
       * it is not perfect, since you can abuse this to do things like assign a named function
       * to a variable which is not allowed in OpenSCAD. So this covers all but the most
       * pathological cases.
       * @param n
       * @returns
       */
      visitFunctionCallExpr(n) {
        return super.visitFunctionCallExpr.call(this.copyWithIsInCallee(), n);
      }
      // scope handling
      copyWithNextScope(s) {
        if (!s) {
          throw new Error("Scope cannot be falsy");
        }
        return new _SymbolResolver(this.errorCollector, s, this.isInCallee);
      }
      copyWithIsInCallee() {
        return new _SymbolResolver(this.errorCollector, this.currentScope, true);
      }
      visitBlockStmt(n) {
        return super.visitBlockStmt.call(this.copyWithNextScope(n.scope), n);
      }
      visitLetExpr(n) {
        return super.visitLetExpr.call(this.copyWithNextScope(n.scope), n);
      }
      visitScadFile(n) {
        return super.visitScadFile.call(this.copyWithNextScope(n.scope), n);
      }
      visitFunctionDeclarationStmt(n) {
        return super.visitFunctionDeclarationStmt.call(this.copyWithNextScope(n.scope), n);
      }
      visitModuleDeclarationStmt(n) {
        return super.visitModuleDeclarationStmt.call(this.copyWithNextScope(n.scope), n);
      }
      visitLcLetExpr(n) {
        return super.visitLcLetExpr.call(this.copyWithNextScope(n.scope), n);
      }
      visitLcForExpr(n) {
        return super.visitLcForExpr.call(this.copyWithNextScope(n.scope), n);
      }
      visitLcForCExpr(n) {
        return super.visitLcForCExpr.call(this.copyWithNextScope(n.scope), n);
      }
      visitAnonymousFunctionExpr(n) {
        return super.visitAnonymousFunctionExpr.call(this.copyWithNextScope(n.scope), n);
      }
    };
    exports.default = SymbolResolver;
  }
});

// node_modules/openscad-parser/dist/SolutionManager.js
var require_SolutionManager = __commonJS({
  "node_modules/openscad-parser/dist/SolutionManager.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SolutionFile = void 0;
    var path = require_node_shims();
    var ASTPinpointer_1 = require_ASTPinpointer();
    var ASTPrinter_1 = require_ASTPrinter();
    var CodeFile_1 = require_CodeFile();
    var FormattingConfiguration_1 = require_FormattingConfiguration();
    var ParsingHelper_1 = require_ParsingHelper();
    var PreludeUtil_1 = require_PreludeUtil();
    var ASTScopePopulator_1 = require_ASTScopePopulator();
    var ASTSymbolLister_1 = require_ASTSymbolLister();
    var CompletionUtil_1 = require_CompletionUtil();
    var IncludeResolver_1 = require_IncludeResolver();
    var resolvedNodes_1 = require_resolvedNodes();
    var Scope_1 = require_Scope();
    var SymbolResolver_1 = require_SymbolResolver();
    var SolutionFile = class {
      solutionManager;
      codeFile;
      ast = null;
      dependencies;
      errors;
      includeResolver;
      includedFiles;
      onlyOwnScope;
      constructor(solutionManager) {
        this.solutionManager = solutionManager;
        this.includeResolver = new IncludeResolver_1.default(this.solutionManager);
      }
      async parseAndProcess() {
        let [ast, errors] = ParsingHelper_1.default.parseFile(this.codeFile);
        if (ast) {
          this.ast = new ASTScopePopulator_1.default(new Scope_1.default()).populate(ast);
          this.includedFiles = await this.includeResolver.resolveIncludes(this.ast, errors);
          const usedFiles = await this.includeResolver.resolveIncludes(this.ast, errors);
          this.dependencies = [...this.includedFiles, ...usedFiles];
          this.onlyOwnScope = this.ast.scope.copy();
          this.ast.scope.siblingScopes = [
            ...this.includedFiles.map((f) => f.getExportedScopes()).flat(),
            ...usedFiles.map((f) => f.getExportedScopes()).flat(),
            PreludeUtil_1.default.preludeScope
          ];
          this.ast = this.ast.accept(new SymbolResolver_1.default(errors));
        }
        this.errors = errors.errors;
      }
      getCompletionsAtLocation(loc) {
        return CompletionUtil_1.default.getSymbolsAtLocation(this.ast, loc);
      }
      getSymbols(makeSymbol) {
        const l = new ASTSymbolLister_1.default(makeSymbol);
        return l.doList(this.ast);
      }
      getFormatted() {
        return new ASTPrinter_1.default(new FormattingConfiguration_1.default()).visitScadFile(this.ast);
      }
      getExportedScopes() {
        return [
          this.onlyOwnScope,
          ...this.includedFiles.map((f) => f.getExportedScopes()).flat()
        ];
      }
      getSymbolDeclaration(loc) {
        const pp = new ASTPinpointer_1.default(loc).doPinpoint(this.ast);
        if (pp instanceof resolvedNodes_1.ResolvedLookupExpr || pp instanceof resolvedNodes_1.ResolvedModuleInstantiationStmt) {
          return pp.resolvedDeclaration;
        }
        return null;
      }
      getSymbolDeclarationLocation(loc) {
        const decl = this.getSymbolDeclaration(loc);
        if (decl) {
          return decl.tokens.name ? decl.tokens.name.span.start : null;
        }
        return null;
      }
    };
    exports.SolutionFile = SolutionFile;
    var SolutionManager = class {
      openedFiles = /* @__PURE__ */ new Map();
      allFiles = /* @__PURE__ */ new Map();
      notReadyFiles = /* @__PURE__ */ new Map();
      /**
       * Returns a registered solution file for a given path. It supports getting files which have not been fully processed yet.
       * @param filePath
       */
      async getFile(filePath) {
        if (!path.isAbsolute(filePath)) {
          throw new Error("Path must be absolute and normalized.");
        }
        let file = this.allFiles.get(filePath);
        if (file) {
          return file;
        }
        return await this.notReadyFiles.get(filePath);
      }
      async notifyNewFileOpened(filePath, contents) {
        if (!path.isAbsolute(filePath)) {
          throw new Error("Path must be absolute and normalized.");
        }
        const cFile = new CodeFile_1.default(filePath, contents);
        this.openedFiles.set(filePath, await this.attachSolutionFile(cFile));
      }
      async notifyFileChanged(filePath, contents) {
        if (!path.isAbsolute(filePath)) {
          throw new Error("Path must be absolute and normalized.");
        }
        const cFile = new CodeFile_1.default(filePath, contents);
        let sf = this.openedFiles.get(filePath);
        if (!sf) {
          if (this.notReadyFiles.has(filePath)) {
            sf = await this.notReadyFiles.get(filePath);
          } else {
            throw new Error("No such file");
          }
        }
        sf.codeFile = cFile;
        await sf.parseAndProcess();
      }
      notifyFileClosed(filePath) {
        this.openedFiles.delete(filePath);
        this.garbageCollect();
      }
      async attachSolutionFile(codeFile) {
        const solutionFile = new SolutionFile(this);
        solutionFile.codeFile = codeFile;
        try {
          let resolve;
          this.notReadyFiles.set(codeFile.path, new Promise((r) => resolve = r));
          await solutionFile.parseAndProcess();
          resolve(solutionFile);
          this.allFiles.set(codeFile.path, solutionFile);
          return solutionFile;
        } finally {
          this.notReadyFiles.delete(codeFile.path);
        }
      }
      /**
       * Checks whether a file is already in the solution, and if not it loads it from disk.
       * @param filePath The dependent-upon file.
       */
      async provideScadFile(filePath) {
        let f = await this.getFile(filePath);
        if (f)
          return f;
        return await this.attachSolutionFile(await CodeFile_1.default.load(filePath));
      }
      /**
       * Removes dependencies that aren't directly or indirectly referenced in any of the open files to free memory.
       */
      garbageCollect() {
        const gcMarked = /* @__PURE__ */ new WeakMap();
        function markRecursive(f) {
          gcMarked.set(f, true);
          for (const dep of f.dependencies) {
            if (!gcMarked.has(dep)) {
              markRecursive(dep);
            }
          }
        }
        for (const [_, dep] of this.openedFiles) {
          markRecursive(dep);
        }
        for (const [path2, f] of this.allFiles) {
          if (!gcMarked.has(f)) {
            this.allFiles.delete(path2);
          }
        }
      }
    };
    exports.default = SolutionManager;
  }
});

// node_modules/openscad-parser/dist/ast/ASTVisitor.js
var require_ASTVisitor = __commonJS({
  "node_modules/openscad-parser/dist/ast/ASTVisitor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/openscad-parser/dist/comments/DocAnnotationClass.js
var require_DocAnnotationClass = __commonJS({
  "node_modules/openscad-parser/dist/comments/DocAnnotationClass.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/openscad-parser/dist/semantic/CompletionProvider.js
var require_CompletionProvider = __commonJS({
  "node_modules/openscad-parser/dist/semantic/CompletionProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/openscad-parser/dist/semantic/NodeWithScope.js
var require_NodeWithScope = __commonJS({
  "node_modules/openscad-parser/dist/semantic/NodeWithScope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/openscad-parser/dist/semantic/ScadFileProvider.js
var require_ScadFileProvider = __commonJS({
  "node_modules/openscad-parser/dist/semantic/ScadFileProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/openscad-parser/dist/index.js
var require_index = __commonJS({
  "node_modules/openscad-parser/dist/index.js"(exports) {
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SymbolResolver = exports.ScopeSymbolCompletionProvider = exports.Scope = exports.KeywordsCompletionProvider = exports.IncludeResolver = exports.FilenameCompletionProvider = exports.CompletionUtil = exports.CompletionType = exports.CompletionSymbol = exports.ASTSymbolLister = exports.ASTScopePopulator = exports.PreludeUtil = exports.ParsingError = exports.LexingError = exports.CodeError = exports.DocComment = exports.ScadFile = exports.ErrorNode = exports.AssignmentNode = exports.ASTNode = exports.keywords = exports.friendlyTokenNames = exports.TokenType = exports.Token = exports.SolutionManager = exports.ParsingHelper = exports.Parser = exports.LiteralToken = exports.Lexer = exports.FormattingConfiguration = exports.ErrorCollector = exports.CodeLocation = exports.CodeFile = exports.ASTPrinter = exports.ASTPinpointer = exports.ASTMutator = exports.ASTAssembler = void 0;
    var ASTAssembler_1 = require_ASTAssembler();
    Object.defineProperty(exports, "ASTAssembler", { enumerable: true, get: function() {
      return ASTAssembler_1.default;
    } });
    __exportStar(require_ASTAssembler(), exports);
    var ASTMutator_1 = require_ASTMutator();
    Object.defineProperty(exports, "ASTMutator", { enumerable: true, get: function() {
      return ASTMutator_1.default;
    } });
    __exportStar(require_ASTMutator(), exports);
    var ASTPinpointer_1 = require_ASTPinpointer();
    Object.defineProperty(exports, "ASTPinpointer", { enumerable: true, get: function() {
      return ASTPinpointer_1.default;
    } });
    __exportStar(require_ASTPinpointer(), exports);
    var ASTPrinter_1 = require_ASTPrinter();
    Object.defineProperty(exports, "ASTPrinter", { enumerable: true, get: function() {
      return ASTPrinter_1.default;
    } });
    __exportStar(require_ASTPrinter(), exports);
    var CodeFile_1 = require_CodeFile();
    Object.defineProperty(exports, "CodeFile", { enumerable: true, get: function() {
      return CodeFile_1.default;
    } });
    __exportStar(require_CodeFile(), exports);
    var CodeLocation_1 = require_CodeLocation();
    Object.defineProperty(exports, "CodeLocation", { enumerable: true, get: function() {
      return CodeLocation_1.default;
    } });
    __exportStar(require_CodeLocation(), exports);
    var ErrorCollector_1 = require_ErrorCollector();
    Object.defineProperty(exports, "ErrorCollector", { enumerable: true, get: function() {
      return ErrorCollector_1.default;
    } });
    __exportStar(require_ErrorCollector(), exports);
    var FormattingConfiguration_1 = require_FormattingConfiguration();
    Object.defineProperty(exports, "FormattingConfiguration", { enumerable: true, get: function() {
      return FormattingConfiguration_1.default;
    } });
    __exportStar(require_FormattingConfiguration(), exports);
    var Lexer_1 = require_Lexer();
    Object.defineProperty(exports, "Lexer", { enumerable: true, get: function() {
      return Lexer_1.default;
    } });
    __exportStar(require_Lexer(), exports);
    var LiteralToken_1 = require_LiteralToken();
    Object.defineProperty(exports, "LiteralToken", { enumerable: true, get: function() {
      return LiteralToken_1.default;
    } });
    __exportStar(require_LiteralToken(), exports);
    var Parser_1 = require_Parser();
    Object.defineProperty(exports, "Parser", { enumerable: true, get: function() {
      return Parser_1.default;
    } });
    __exportStar(require_Parser(), exports);
    var ParsingHelper_1 = require_ParsingHelper();
    Object.defineProperty(exports, "ParsingHelper", { enumerable: true, get: function() {
      return ParsingHelper_1.default;
    } });
    __exportStar(require_ParsingHelper(), exports);
    var SolutionManager_1 = require_SolutionManager();
    Object.defineProperty(exports, "SolutionManager", { enumerable: true, get: function() {
      return SolutionManager_1.default;
    } });
    __exportStar(require_SolutionManager(), exports);
    var Token_1 = require_Token();
    Object.defineProperty(exports, "Token", { enumerable: true, get: function() {
      return Token_1.default;
    } });
    __exportStar(require_Token(), exports);
    var TokenType_1 = require_TokenType();
    Object.defineProperty(exports, "TokenType", { enumerable: true, get: function() {
      return TokenType_1.default;
    } });
    __exportStar(require_TokenType(), exports);
    __exportStar(require_extraTokens(), exports);
    var friendlyTokenNames_1 = require_friendlyTokenNames();
    Object.defineProperty(exports, "friendlyTokenNames", { enumerable: true, get: function() {
      return friendlyTokenNames_1.default;
    } });
    __exportStar(require_friendlyTokenNames(), exports);
    var keywords_1 = require_keywords();
    Object.defineProperty(exports, "keywords", { enumerable: true, get: function() {
      return keywords_1.default;
    } });
    __exportStar(require_keywords(), exports);
    var ASTNode_1 = require_ASTNode();
    Object.defineProperty(exports, "ASTNode", { enumerable: true, get: function() {
      return ASTNode_1.default;
    } });
    __exportStar(require_ASTNode(), exports);
    __exportStar(require_ASTVisitor(), exports);
    var AssignmentNode_1 = require_AssignmentNode();
    Object.defineProperty(exports, "AssignmentNode", { enumerable: true, get: function() {
      return AssignmentNode_1.default;
    } });
    __exportStar(require_AssignmentNode(), exports);
    var ErrorNode_1 = require_ErrorNode();
    Object.defineProperty(exports, "ErrorNode", { enumerable: true, get: function() {
      return ErrorNode_1.default;
    } });
    __exportStar(require_ErrorNode(), exports);
    var ScadFile_1 = require_ScadFile();
    Object.defineProperty(exports, "ScadFile", { enumerable: true, get: function() {
      return ScadFile_1.default;
    } });
    __exportStar(require_ScadFile(), exports);
    __exportStar(require_expressions(), exports);
    __exportStar(require_statements(), exports);
    __exportStar(require_DocAnnotationClass(), exports);
    var DocComment_1 = require_DocComment();
    Object.defineProperty(exports, "DocComment", { enumerable: true, get: function() {
      return DocComment_1.default;
    } });
    __exportStar(require_DocComment(), exports);
    __exportStar(require_annotations(), exports);
    var CodeError_1 = require_CodeError();
    Object.defineProperty(exports, "CodeError", { enumerable: true, get: function() {
      return CodeError_1.default;
    } });
    __exportStar(require_CodeError(), exports);
    var LexingError_1 = require_LexingError();
    Object.defineProperty(exports, "LexingError", { enumerable: true, get: function() {
      return LexingError_1.default;
    } });
    __exportStar(require_LexingError(), exports);
    var ParsingError_1 = require_ParsingError();
    Object.defineProperty(exports, "ParsingError", { enumerable: true, get: function() {
      return ParsingError_1.default;
    } });
    __exportStar(require_ParsingError(), exports);
    __exportStar(require_lexingErrors(), exports);
    __exportStar(require_parsingErrors(), exports);
    var PreludeUtil_1 = require_PreludeUtil();
    Object.defineProperty(exports, "PreludeUtil", { enumerable: true, get: function() {
      return PreludeUtil_1.default;
    } });
    __exportStar(require_PreludeUtil(), exports);
    var ASTScopePopulator_1 = require_ASTScopePopulator();
    Object.defineProperty(exports, "ASTScopePopulator", { enumerable: true, get: function() {
      return ASTScopePopulator_1.default;
    } });
    __exportStar(require_ASTScopePopulator(), exports);
    var ASTSymbolLister_1 = require_ASTSymbolLister();
    Object.defineProperty(exports, "ASTSymbolLister", { enumerable: true, get: function() {
      return ASTSymbolLister_1.default;
    } });
    __exportStar(require_ASTSymbolLister(), exports);
    __exportStar(require_CompletionProvider(), exports);
    var CompletionSymbol_1 = require_CompletionSymbol();
    Object.defineProperty(exports, "CompletionSymbol", { enumerable: true, get: function() {
      return CompletionSymbol_1.default;
    } });
    __exportStar(require_CompletionSymbol(), exports);
    var CompletionType_1 = require_CompletionType();
    Object.defineProperty(exports, "CompletionType", { enumerable: true, get: function() {
      return CompletionType_1.default;
    } });
    __exportStar(require_CompletionType(), exports);
    var CompletionUtil_1 = require_CompletionUtil();
    Object.defineProperty(exports, "CompletionUtil", { enumerable: true, get: function() {
      return CompletionUtil_1.default;
    } });
    __exportStar(require_CompletionUtil(), exports);
    var FilenameCompletionProvider_1 = require_FilenameCompletionProvider();
    Object.defineProperty(exports, "FilenameCompletionProvider", { enumerable: true, get: function() {
      return FilenameCompletionProvider_1.default;
    } });
    __exportStar(require_FilenameCompletionProvider(), exports);
    var IncludeResolver_1 = require_IncludeResolver();
    Object.defineProperty(exports, "IncludeResolver", { enumerable: true, get: function() {
      return IncludeResolver_1.default;
    } });
    __exportStar(require_IncludeResolver(), exports);
    var KeywordsCompletionProvider_1 = require_KeywordsCompletionProvider();
    Object.defineProperty(exports, "KeywordsCompletionProvider", { enumerable: true, get: function() {
      return KeywordsCompletionProvider_1.default;
    } });
    __exportStar(require_KeywordsCompletionProvider(), exports);
    __exportStar(require_NodeWithScope(), exports);
    __exportStar(require_ScadFileProvider(), exports);
    var Scope_1 = require_Scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return Scope_1.default;
    } });
    __exportStar(require_Scope(), exports);
    var ScopeSymbolCompletionProvider_1 = require_ScopeSymbolCompletionProvider();
    Object.defineProperty(exports, "ScopeSymbolCompletionProvider", { enumerable: true, get: function() {
      return ScopeSymbolCompletionProvider_1.default;
    } });
    __exportStar(require_ScopeSymbolCompletionProvider(), exports);
    var SymbolResolver_1 = require_SymbolResolver();
    Object.defineProperty(exports, "SymbolResolver", { enumerable: true, get: function() {
      return SymbolResolver_1.default;
    } });
    __exportStar(require_SymbolResolver(), exports);
    __exportStar(require_nodesWithScopes(), exports);
    __exportStar(require_resolvedNodes(), exports);
    __exportStar(require_unresolvedSymbolErrors(), exports);
  }
});
export default require_index();
//# sourceMappingURL=openscad-parser.js.map
