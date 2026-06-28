// interpreter.js - Safe Python-like KidCode AST compiler, tokenizer, parser, interpreter, and autocompleter

class KidCodeError extends Error {
  constructor(message, suggestion = "") {
    super(message);
    this.name = "KidCodeError";
    this.suggestion = suggestion;
  }
}

// ----------------------------------------------------
// 1. TOKENIZER
// ----------------------------------------------------
class Tokenizer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    // Regex matches for KidCode tokens
    const specs = [
      [/^\s+/, 'WHITESPACE'],
      [/^\d+(?:\.\d+)?\b/, 'NUMBER'],
      [/^"[^"]*"/, 'STRING'],
      [/^'[^']*'/, 'STRING'],
      [/^(?:if)\b/, 'IF'],
      [/^(?:else)\b/, 'ELSE'],
      [/^(?:for)\b/, 'FOR'],
      [/^(?:in)\b/, 'IN'],
      [/^(?:range)\b/, 'RANGE'],
      [/^(?:when)\b/, 'WHEN'],
      [/^(?:repeat)\b/, 'REPEAT'],
      [/^[a-zA-Z_][a-zA-Z0-9_\.]*/, 'IDENTIFIER'],
      [/^==|^!=|^<=|^>=|^<|^>/, 'COMPARISON'],
      [/^=/, 'EQUALS'],
      [/^:/, 'COLON'],
      [/^\(/, 'LPAREN'],
      [/^\)/, 'RPAREN'],
      [/^{/, 'LBRACE'],
      [/^}/, 'RBRACE'],
      [/^\+|^-\b|^\*|^\//, 'OPERATOR'],
      [/^,/, 'COMMA'],
      [/^;/, 'SEMICOLON'],
      [/^\n/, 'NEWLINE']
    ];

    while (this.pos < this.input.length) {
      const remaining = this.input.slice(this.pos);
      let matched = false;

      for (const [regex, type] of specs) {
        const match = remaining.match(regex);
        if (match) {
          const value = match[0];
          this.pos += value.length;
          matched = true;

          // Skip whitespaces except newlines
          if (type !== 'WHITESPACE') {
            this.tokens.push({ type, value });
          }
          break;
        }
      }

      if (!matched) {
        throw new KidCodeError(`Oops! I don't recognize the character: "${remaining[0]}"`);
      }
    }

    return this.tokens;
  }
}

// ----------------------------------------------------
// 2. PARSER
// ----------------------------------------------------
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    return this.tokens[this.pos++];
  }

  expect(type, errorMsg) {
    const t = this.peek();
    if (!t || t.type !== type) {
      throw new KidCodeError(errorMsg || `Expected ${type} but got ${t ? t.value : 'end of code'}`);
    }
    return this.next();
  }

  parse() {
    const statements = [];
    while (this.pos < this.tokens.length) {
      // Ignore trailing newlines or semicolons
      if (this.peek().type === 'NEWLINE' || this.peek().type === 'SEMICOLON') {
        this.next();
        continue;
      }
      statements.push(this.parseStatement());
    }
    return statements;
  }

  parseStatement() {
    const token = this.peek();

    if (token.type === 'IF') {
      return this.parseIfStatement();
    }
    if (token.type === 'WHEN') {
      return this.parseWhenStatement();
    }
    if (token.type === 'FOR') {
      return this.parseForStatement();
    }
    if (token.type === 'REPEAT') {
      return this.parseRepeatStatement();
    }

    // Default statement: assignment or standalone expression call
    return this.parseAssignOrExpr();
  }

  parseIfStatement() {
    this.next(); // consume 'if'
    const condition = this.parseExpression();
    
    // Support either colons (Pythonic) or curly braces (JS)
    let usesBraces = false;
    if (this.peek() && this.peek().type === 'COLON') {
      this.next(); // consume ':'
    } else if (this.peek() && this.peek().type === 'LBRACE') {
      this.next(); // consume '{'
      usesBraces = true;
    }

    const thenBranch = [];
    while (this.pos < this.tokens.length) {
      const nextT = this.peek();
      if (usesBraces && nextT.type === 'RBRACE') {
        this.next(); // consume '}'
        break;
      }
      if (!usesBraces && (nextT.type === 'ELSE' || nextT.type === 'NEWLINE' || nextT.type === 'DEDENT')) {
        break;
      }
      thenBranch.push(this.parseStatement());
    }

    let elseBranch = null;
    if (this.peek() && this.peek().type === 'ELSE') {
      this.next(); // consume 'else'
      let elseUsesBraces = false;
      if (this.peek() && this.peek().type === 'COLON') {
        this.next();
      } else if (this.peek() && this.peek().type === 'LBRACE') {
        this.next();
        elseUsesBraces = true;
      }

      elseBranch = [];
      while (this.pos < this.tokens.length) {
        const nextT = this.peek();
        if (elseUsesBraces && nextT.type === 'RBRACE') {
          this.next();
          break;
        }
        if (!elseUsesBraces && (nextT.type === 'NEWLINE' || nextT.type === 'DEDENT')) {
          break;
        }
        elseBranch.push(this.parseStatement());
      }
    }

    return { type: 'if', condition, thenBranch, elseBranch };
  }

  parseWhenStatement() {
    this.next(); // consume 'when'
    
    // Support event structures: 'player.lands', 'player.touching("ice")', or comparisons like 'player.fuel < 20'
    const target = this.expect('IDENTIFIER', "Expected an event trigger like player.lands").value;
    
    let eventArgs = [];
    let comparisonOp = null;
    let comparisonValue = null;

    if (this.peek() && this.peek().type === 'LPAREN') {
      this.next(); // consume '('
      if (this.peek().type !== 'RPAREN') {
        eventArgs.push(this.parseExpression());
      }
      this.expect('RPAREN', "Missing closing bracket ')' in event parameter");
    } else if (this.peek() && this.peek().type === 'COMPARISON') {
      comparisonOp = this.next().value;
      comparisonValue = this.parseExpression();
    }

    this.expect('COLON', "Expected a colon ':' at the end of the when rule statement");

    const body = [];
    while (this.pos < this.tokens.length) {
      const nextT = this.peek();
      if (nextT.type === 'NEWLINE') {
        this.next();
        break;
      }
      body.push(this.parseStatement());
    }

    return { type: 'when', target, eventArgs, comparisonOp, comparisonValue, body };
  }

  parseForStatement() {
    this.next(); // consume 'for'
    const iterator = this.expect('IDENTIFIER', "Expected an iterator name, e.g. 'for i in ...'").value;
    this.expect('IN', "Expected keyword 'in' in loop structure");
    this.expect('RANGE', "Expected 'range()' in loop structure");
    this.expect('LPAREN', "Expected '(' after range keyword");
    const countExpr = this.parseExpression();
    this.expect('RPAREN', "Expected ')' after loop range");

    let usesBraces = false;
    if (this.peek() && this.peek().type === 'COLON') {
      this.next();
    } else if (this.peek() && this.peek().type === 'LBRACE') {
      this.next();
      usesBraces = true;
    }

    const body = [];
    while (this.pos < this.tokens.length) {
      const nextT = this.peek();
      if (usesBraces && nextT.type === 'RBRACE') {
        this.next();
        break;
      }
      if (!usesBraces && (nextT.type === 'NEWLINE' || nextT.type === 'DEDENT')) {
        break;
      }
      body.push(this.parseStatement());
    }

    return { type: 'for', iterator, limit: countExpr, body };
  }

  parseRepeatStatement() {
    this.next(); // consume 'repeat'
    const limitExpr = this.parseExpression();

    let usesBraces = false;
    if (this.peek() && this.peek().type === 'LBRACE') {
      this.next();
      usesBraces = true;
    } else if (this.peek() && this.peek().type === 'COLON') {
      this.next();
    }

    const body = [];
    while (this.pos < this.tokens.length) {
      const nextT = this.peek();
      if (usesBraces && nextT.type === 'RBRACE') {
        this.next();
        break;
      }
      if (!usesBraces && (nextT.type === 'NEWLINE')) {
        break;
      }
      body.push(this.parseStatement());
    }

    return { type: 'repeat', limit: limitExpr, body };
  }

  parseAssignOrExpr() {
    const expr = this.parseExpression();
    if (this.peek() && this.peek().type === 'EQUALS') {
      this.next(); // consume '='
      const rhs = this.parseExpression();
      if (expr.type !== 'identifier') {
        throw new KidCodeError("Cannot assign values to this object!");
      }
      return { type: 'assign', target: expr.value, value: rhs };
    }
    return { type: 'expr', expression: expr };
  }

  parseExpression() {
    return this.parseComparison();
  }

  parseComparison() {
    let left = this.parseAdditive();
    if (this.peek() && this.peek().type === 'COMPARISON') {
      const op = this.next().value;
      const right = this.parseAdditive();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.peek() && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parsePrimary();
    while (this.peek() && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.next().value;
      const right = this.parsePrimary();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) {
      throw new KidCodeError("Looks like your command stopped early. Did you forget something?");
    }

    if (t.type === 'NUMBER') {
      this.next();
      return { type: 'number', value: parseFloat(t.value) };
    }

    if (t.type === 'STRING') {
      this.next();
      // Remove enclosing quotes
      return { type: 'string', value: t.value.slice(1, -1) };
    }

    if (t.type === 'IDENTIFIER') {
      const idToken = this.next();
      
      // Is it a function call? e.g. spawn("coin")
      if (this.peek() && this.peek().type === 'LPAREN') {
        this.next(); // consume '('
        const args = [];
        const kwargs = {};
        
        while (this.pos < this.tokens.length && this.peek().type !== 'RPAREN') {
          // Check for keyword args, e.g. x=5
          if (this.peek().type === 'IDENTIFIER' && this.tokens[this.pos+1] && this.tokens[this.pos+1].type === 'EQUALS') {
            const kw = this.next().value;
            this.next(); // consume '='
            kwargs[kw] = this.parseExpression();
          } else {
            args.push(this.parseExpression());
          }

          if (this.peek() && this.peek().type === 'COMMA') {
            this.next();
          }
        }
        
        this.expect('RPAREN', "Forgot to close function call with ')'");
        return { type: 'call', name: idToken.value, args, kwargs };
      }

      return { type: 'identifier', value: idToken.value };
    }

    if (t.type === 'LPAREN') {
      this.next();
      const expr = this.parseExpression();
      this.expect('RPAREN', "Forgot to close bracket grouping with ')'");
      return expr;
    }

    throw new KidCodeError(`I was not expecting to see "${t.value}" here.`);
  }
}

// ----------------------------------------------------
// 3. SAFE AST INTERPRETER
// ----------------------------------------------------
class KidCodeInterpreter {
  constructor(game) {
    this.game = game;
    this.spawnsThisRun = 0;
    this.steps = 0;
  }

  evaluate(ast, customLocals = {}) {
    this.spawnsThisRun = 0;
    this.steps = 0;
    // Wall-clock guard: a defense-in-depth backstop for a merely *slow* run (the
    // 200-step / 30-iteration caps already make infinite loops impossible). Stamped
    // here, checked in execute(). performance.now() with a Date.now() fallback for node.
    this.startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    let lastResult = null;
    for (const statement of ast) {
      lastResult = this.execute(statement, customLocals);
    }
    return lastResult;
  }

  execute(node, locals) {
    this.steps++;
    if (this.steps > 200) {
      throw new KidCodeError("Your code takes too many steps! Try running fewer loops.");
    }
    if (Number.isFinite(this.startTime)) {
      const _now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (_now - this.startTime > 250) {
        throw new KidCodeError("Your code is taking too long to run! Try simplifying it.");
      }
    }

    switch (node.type) {
      case 'assign': {
        const val = this.evalExpr(node.value, locals);
        this.setVariable(node.target, val);
        return val;
      }
      
      case 'expr':
        return this.evalExpr(node.expression, locals);

      case 'if': {
        const cond = this.evalExpr(node.condition, locals);
        if (cond) {
          let last = null;
          for (const s of node.thenBranch) {
            last = this.execute(s, locals);
          }
          return last;
        } else if (node.elseBranch) {
          let last = null;
          for (const s of node.elseBranch) {
            last = this.execute(s, locals);
          }
          return last;
        }
        return null;
      }

      case 'for': {
        const limitVal = this.evalExpr(node.limit, locals);
        if (typeof limitVal !== 'number' || limitVal < 0) {
          throw new KidCodeError("Loop range must be a positive number.");
        }
        if (limitVal > 30) {
          throw new KidCodeError("Loop is too big! Try range(10) or smaller.");
        }

        let last = null;
        for (let i = 0; i < limitVal; i++) {
          const newLocals = { ...locals, [node.iterator]: i };
          for (const s of node.body) {
            last = this.execute(s, newLocals);
          }
        }
        return last;
      }

      case 'repeat': {
        const limitVal = this.evalExpr(node.limit, locals);
        if (typeof limitVal !== 'number' || limitVal < 0) {
          throw new KidCodeError("Repeat count must be a positive number.");
        }
        if (limitVal > 30) {
          throw new KidCodeError("Repeat count is too big! Keep it under 10.");
        }

        let last = null;
        for (let i = 0; i < limitVal; i++) {
          for (const s of node.body) {
            last = this.execute(s, locals);
          }
        }
        return last;
      }

      case 'when': {
        // Register the event hook
        Compiler.registerEventHook(node);
        return `Registered when-rule trigger: ${node.target}`;
      }

      default:
        throw new KidCodeError("Unknown statement parsed.");
    }
  }

  evalExpr(expr, locals) {
    switch (expr.type) {
      case 'number':
      case 'string':
        return expr.value;

      case 'identifier': {
        // Look in loop iterator locals first
        if (expr.value in locals) {
          return locals[expr.value];
        }
        return this.getVariable(expr.value);
      }

      case 'binary': {
        const l = this.evalExpr(expr.left, locals);
        const r = this.evalExpr(expr.right, locals);

        switch (expr.operator) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return r === 0 ? 0 : l / r;
          
          // Comparisons
          case '==': return l === r;
          case '!=': return l !== r;
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          
          default: throw new KidCodeError(`Unknown operator: ${expr.operator}`);
        }
      }

      case 'call': {
        const fnName = expr.name;
        const resolvedArgs = expr.args.map(a => this.evalExpr(a, locals));
        
        const resolvedKwargs = {};
        for (const kw in expr.kwargs) {
          resolvedKwargs[kw] = this.evalExpr(expr.kwargs[kw], locals);
        }

        // Call the sandboxed runtime functions
        if (fnName in runtimeContext.functions) {
          // Safeguard item spawning limits
          if (fnName === 'spawn' || fnName.startsWith('spawn_')) {
            this.spawnsThisRun++;
            if (this.spawnsThisRun > 20) {
              throw new KidCodeError("Spawning too many objects! Keep it under 20.");
            }
          }

          if (fnName === 'spawn') {
            return runtimeContext.functions[fnName](this.game, resolvedArgs[0], resolvedArgs[1], resolvedArgs[2], resolvedKwargs);
          } else if (fnName.startsWith('spawn_')) {
            const args = [...resolvedArgs];
            while (args.length < 2) args.push(undefined);
            args.push(resolvedKwargs);
            return runtimeContext.functions[fnName](this.game, ...args);
          } else {
            return runtimeContext.functions[fnName](this.game, ...resolvedArgs);
          }
        } else {
          // Check spelling
          const suggestion = getSpellingSuggestion(fnName, Object.keys(runtimeContext.functions));
          throw new KidCodeError(`I don't know the command: "${fnName}()"`, suggestion);
        }
      }

      default:
        throw new KidCodeError("Unknown expression parsed.");
    }
  }

  getVariable(name) {
    if (name in runtimeContext.variables) {
      return runtimeContext.variables[name].get(this.game);
    }
    // Check spelling
    const suggestion = getSpellingSuggestion(name, Object.keys(runtimeContext.variables));
    throw new KidCodeError(`I do not know the variable name: "${name}"`, suggestion);
  }

  setVariable(name, value) {
    if (name in runtimeContext.variables) {
      runtimeContext.variables[name].set(this.game, value);
    } else {
      const suggestion = getSpellingSuggestion(name, Object.keys(runtimeContext.variables));
      throw new KidCodeError(`I do not know the variable name: "${name}"`, suggestion);
    }
  }
}

// ----------------------------------------------------
// 4. LEVENSHTEIN SUGGESTIONS (FRIENDLY ERRORS)
// ----------------------------------------------------
function levenshtein(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
}

function getSpellingSuggestion(input, list) {
  let best = "";
  let minDist = 3; // Max tolerance 3 edits

  for (const item of list) {
    const d = levenshtein(input, item);
    if (d < minDist) {
      minDist = d;
      best = item;
    }
  }

  if (best) {
    return `Did you mean "${best}"?`;
  }
  return "";
}

// ----------------------------------------------------
// 4.5. RUNTIME CONTEXT DEFINITION
// ----------------------------------------------------
// Earth's 0.6 game-units of gravity represent 9.8 m/s², so 1 game-unit = 16.33 m/s².
const GRAVITY_MPS2_PER_UNIT = 9.8 / 0.6;

// Shared setters so the many aliases (engine/speed, jump_power) clamp identically and
// all surface the same "can't go past the cap" notice via game.reportCapHit().
function _setEngineForce(game, val) {
  const n = Number(val);
  if (typeof game.reportCapHit === 'function') game.reportCapHit('engine', n);
  const cap = (typeof game.getUpgradeCap === 'function') ? game.getUpgradeCap('engine') : 20;
  Compiler.env.engine = Math.max(1, Math.min(cap, Number.isFinite(n) ? n : game.currentPlanet.physics.speed));
}
function _setJumpPower(game, val) {
  const n = Number(val);
  if (typeof game.reportCapHit === 'function') game.reportCapHit('jump', n);
  const cap = (typeof game.getUpgradeCap === 'function') ? game.getUpgradeCap('jump') : 45;
  game.player.jumpPower = Math.max(1, Math.min(cap, Number.isFinite(n) ? n : game.player.jumpPower));
}

const runtimeContext = {
  variables: {
    // Kids type gravity in real m/s² (Earth ≈ 9.8). Stored internally in game-units
    // (0.6 = Earth), converted here so the code value matches the dashboard.
    gravity: {
      get: (game) => {
        const units = Compiler.env.gravity !== null ? Compiler.env.gravity : game.currentPlanet.physics.gravity;
        return Math.round(units * GRAVITY_MPS2_PER_UNIT * 100) / 100;
      },
      set: (game, val) => {
        const n = Number(val);
        const mps2 = Math.max(-40, Math.min(40, Number.isFinite(n) ? n : 9.8));
        Compiler.env.gravity = mps2 / GRAVITY_MPS2_PER_UNIT;
      }
    },
    // Antigravity device (m/s²): counters the planet's fixed gravity. felt = gravity
    // − antigravity. Negative makes it heavier. Capped by the antigravity-coil upgrade.
    antigravity: {
      get: (game) => Math.round((Compiler.env.antigravity || 0) * GRAVITY_MPS2_PER_UNIT * 100) / 100,
      set: (game, val) => {
        const n = Number(val);
        if (typeof game.reportCapHit === 'function') game.reportCapHit('antigravity', n);
        const cap = (typeof game.getUpgradeCap === 'function') ? game.getUpgradeCap('antigravity') : 6;
        const mps2 = Math.max(-40, Math.min(cap, Number.isFinite(n) ? n : 0));
        Compiler.env.antigravity = mps2 / GRAVITY_MPS2_PER_UNIT;
      }
    },
    friction: {
      get: (game) => Compiler.env.friction !== null ? Compiler.env.friction : game.currentPlanet.physics.friction,
      set: (game, val) => { Compiler.env.friction = val; }
    },
    // jump_power affects whichever suit is active, so it has player.* and hopper.*
    // aliases (use hopper.jump_power to match hopper.engine / hopper.mass / hopper.rocket_power).
    jump_power: {
      get: (game) => game.player.jumpPower,
      set: (game, val) => _setJumpPower(game, val)
    },
    "player.jump_power": {
      get: (game) => game.player.jumpPower,
      set: (game, val) => _setJumpPower(game, val)
    },
    "hopper.jump_power": {
      get: (game) => game.player.jumpPower,
      set: (game, val) => _setJumpPower(game, val)
    },
    "player.mass": {
      get: (game) => game.player.mass,
      set: (game, val) => { game.player.mass = val; }
    },
    // Engine drive force. Top speed is DERIVED as engine / mass (F = m·a) — there's no
    // separate "speed" knob; raise hopper.engine (or drop hopper.mass) to go faster.
    engine: {
      get: (game) => game.getEngineForce(),
      set: (game, val) => _setEngineForce(game, val)
    },
    "hopper.engine": {
      get: (game) => game.getEngineForce(),
      set: (game, val) => _setEngineForce(game, val)
    },
    "star.mass": {
      get: (game) => game.starMass !== undefined ? game.starMass : 1.0,
      set: (game, val) => {
        const clamped = Math.max(0.2, Math.min(10.0, Number(val) || 1.0));
        game.starMass = clamped;
        if (game.player && game.player.charType === 'star') {
          game.player.mass = clamped;
        }
      }
    },
    "hopper.mass": {
      get: (game) => game.hopperMass !== undefined ? game.hopperMass : 2.5,
      set: (game, val) => {
        if (typeof game.reportCapHit === 'function') game.reportCapHit('mass', Number(val));
        const massFloor = (typeof game.getUpgradeCap === 'function') ? game.getUpgradeCap('mass') : 0.4;
        const clamped = Math.max(massFloor, Math.min(10.0, Number(val) || 2.5));
        game.hopperMass = clamped;
        if (game.player && game.player.charType === 'hopper') {
          game.player.mass = clamped;
        }
      }
    },
    "hopper.rocket_power": {
      get: (game) => Number.isFinite(game.player.rocketPower) ? game.player.rocketPower : 40,
      set: (game, val) => {
        const numeric = Number(val);
        if (typeof game.reportCapHit === 'function') game.reportCapHit('rocket', numeric);
        const rktCap = (typeof game.getUpgradeCap === 'function') ? game.getUpgradeCap('rocket') : 120;
        game.player.rocketPower = Math.max(0, Math.min(rktCap, Number.isFinite(numeric) ? numeric : 40));
      }
    },
    "hopper.spikes": {
      get: (game) => game.player.spikes || false,
      set: (game, val) => { game.player.spikes = !!val; }
    },
    "hopper.pole": {
      get: (game) => game.player.pole || Compiler.env.magnetPole || 'north',
      set: (game, val) => {
        game.player.pole = val;
        Compiler.env.magnetPole = val;
      }
    },
    music: {
      get: (game) => {
        const names = ["earth", "moon", "jupiter", "glacies", "magnet", "tears"];
        return names[SFX.currentBgm] || "silence";
      },
      set: (game, val) => {
        let id = 0;
        if (typeof val === 'number') {
          id = Math.max(0, Math.min(5, Math.floor(val)));
        } else if (typeof val === 'string') {
          const lower = val.toLowerCase();
          if (lower === 'earth') id = 0;
          else if (lower === 'moon') id = 1;
          else if (lower === 'jupiter') id = 2;
          else if (lower === 'glacies' || lower === 'ice') id = 3;
          else if (lower === 'magnet' || lower === 'space') id = 4;
          else if (lower === 'tears' || lower === 'sad' || lower === 'jazz') id = 5;
        }
      }
    },
    elasticity: {
      get: (game) => (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.elasticity !== null && Compiler.env.elasticity !== undefined) ? Compiler.env.elasticity : 0.8,
      set: (game, val) => {
        const n = Number(val);
        Compiler.env.elasticity = Math.max(0.0, Math.min(1.0, Number.isFinite(n) ? n : 0.8));
      }
    },
    "asteroid.mass": {
      get: (game) => (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.asteroidMass !== null && Compiler.env.asteroidMass !== undefined) ? Compiler.env.asteroidMass : 2.0,
      set: (game, val) => {
        const n = Number(val);
        Compiler.env.asteroidMass = Math.max(0.1, Math.min(20.0, Number.isFinite(n) ? n : 2.0));
      }
    },
    "enemy.speed": {
      get: (game) => (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.enemySpeed !== null && Compiler.env.enemySpeed !== undefined) ? Compiler.env.enemySpeed : 1.0,
      set: (game, val) => {
        const n = Number(val);
        Compiler.env.enemySpeed = Math.max(0.0, Math.min(10.0, Number.isFinite(n) ? n : 1.0));
      }
    },
    "enemy.friendly": {
      get: (game) => (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.enemyFriendly) ? 1 : 0,
      set: (game, val) => {
        Compiler.env.enemyFriendly = !!val;
      }
    },
    "player.fuel": {
      get: (game) => game.player.fuel,
      set: (game, val) => { game.player.fuel = Number(val) || 100; }
    },
    "player.tank": {
      get: (game) => game.player.tank,
      set: (game, val) => { game.player.tank = Number(val) || 0; }
    },
    "player.speed": {
      get: (game) => Math.round(Math.sqrt(game.player.vx * game.player.vx + game.player.vy * game.player.vy) * 100) / 100,
      set: (game, val) => {}
    }
  },
  functions: {
    spawn: (game, type, x, y, kwargs) => {
      let posX = undefined;
      let posY = undefined;

      // Handle positional arguments first
      if (typeof x === 'number') posX = x;
      if (typeof y === 'number') posY = y;

      // Handle keyword arguments
      const kw = (typeof x === 'object' && x !== null) ? x : (typeof y === 'object' && y !== null) ? y : kwargs;
      if (kw && typeof kw === 'object') {
        if (kw.x !== undefined) posX = Number(kw.x);
        if (kw.y !== undefined) posY = Number(kw.y);
      }

      if (type === 'gem') type = 'coin';
      game.spawnItemAbovePlayer(type, posX, posY, kw);
      return `Spawned ${type === 'coin' ? 'gem' : type}!`;
    },
    spawn_coin: (game, x, y, kwargs) => {
      const kw = (typeof x === 'object' && x !== null) ? x : (typeof y === 'object' && y !== null) ? y : kwargs;
      game.spawnItemAbovePlayer('coin', typeof x === 'number' ? x : undefined, typeof y === 'number' ? y : undefined, kw);
      return "Spawned gem!";
    },
    spawn_gem: (game, x, y, kwargs) => {
      const kw = (typeof x === 'object' && x !== null) ? x : (typeof y === 'object' && y !== null) ? y : kwargs;
      game.spawnItemAbovePlayer('coin', typeof x === 'number' ? x : undefined, typeof y === 'number' ? y : undefined, kw);
      return "Spawned gem!";
    },
    spawn_box: (game, x, y, kwargs) => {
      const kw = (typeof x === 'object' && x !== null) ? x : (typeof y === 'object' && y !== null) ? y : kwargs;
      game.spawnItemAbovePlayer('box', typeof x === 'number' ? x : undefined, typeof y === 'number' ? y : undefined, kw);
      return "Spawned box!";
    },
    spawn_spring: (game, x, y, kwargs) => {
      const kw = (typeof x === 'object' && x !== null) ? x : (typeof y === 'object' && y !== null) ? y : kwargs;
      game.spawnItemAbovePlayer('spring', typeof x === 'number' ? x : undefined, typeof y === 'number' ? y : undefined, kw);
      return "Spawned spring!";
    },
    invert_gravity: (game) => {
      const current = Compiler.env.gravity !== null ? Compiler.env.gravity : game.currentPlanet.physics.gravity;
      Compiler.env.gravity = -current;
      return `gravity is now ${Compiler.env.gravity}`;
    },
    rave_mode: (game) => {
      Compiler.env.raveMode = !Compiler.env.raveMode;
      return `rave mode is now ${Compiler.env.raveMode ? 'on' : 'off'}`;
    },
    survival_mode: (game) => {
      if (game && typeof game.toggleSurvival === 'function') game.toggleSurvival();
      return `Mob Survival is now ${game && game.survivalMode ? 'ON — press F to shoot!' : 'off'}`;
    },
    meteor_shower: (game) => {
      if (game && typeof game.triggerMeteorShower === 'function') return game.triggerMeteorShower();
      return "Meteor shower needs the platformer.";
    },
    equip_blaster: (game) => {
      if (game && typeof game.equipWeapon === 'function') return game.equipWeapon('blaster');
      return "Blaster needs the platformer.";
    },
    shrink_enemies: (game) => {
      game.shrinkAllEnemies();
      return "Enemies shrunk!";
    },
    bounce_up: (game) => {
      game.bouncePlayer();
      return "Bounced!";
    },
    use_hopper: (game) => {
      if (!game || !game.player) return "Hopper is not ready yet.";
      game.player.charType = 'hopper';
      game.player.w = 24;
      game.player.h = 32;
      game.player.mass = game.hopperMass !== undefined ? game.hopperMass : 2.5;
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--active-neon', 'var(--neon-orange)');
      }
      return "Hopper activated!";
    },
    use_rover: (game) => {
      if (!game || !game.player) return "Rover is not ready yet.";
      game.player.charType = 'star';
      game.player.w = 20;
      game.player.h = 32;
      game.player.mass = game.starMass !== undefined ? game.starMass : 1.0;
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--active-neon', 'var(--neon-cyan)');
      }
      return "Rover activated!";
    },
    reset: (game) => {
      game.startLevel(game.currentPlanetIndex);
      return "Level reset!";
    },
    "player.say": (game, text) => {
      game.player.say(text);
      return `player says: ${text}`;
    },
    "player.touching": (game, type) => {
      return game.player.isTouching(type, game);
    },
    play_music: (game, name) => {
      let id = 0;
      if (typeof name === 'number') {
        id = Math.max(0, Math.min(5, Math.floor(name)));
      } else if (typeof name === 'string') {
        const lower = name.toLowerCase();
        if (lower === 'earth') id = 0;
        else if (lower === 'moon') id = 1;
        else if (lower === 'jupiter') id = 2;
        else if (lower === 'glacies' || lower === 'ice') id = 3;
        else if (lower === 'magnet' || lower === 'space') id = 4;
        else if (lower === 'tears' || lower === 'sad' || lower === 'jazz') id = 5;
        else return `Unknown track: "${name}". Try: earth, moon, jupiter, glacies, magnet, tears.`;
      } else {
        return "Please specify a music name or number, e.g. play_music('moon') or play_music(2).";
      }
      SFX.startBGM(id);
      return `Now playing track ${id}: "${name}"!`;
    },
    // --- Navigator flight-deck commands ---------------------------------------
    // These let the SAME KidCode language fly the orbital spaceship. Each one
    // ENQUEUES an action (it does not fly inline) onto Nav.commandQueue, which the
    // navigator's processFlightQueue executes over simulation time — so loops and
    // variables now plan multi-burn trajectories. No-op (friendly message) outside
    // the Navigator, where there is no ship. Values are clamped to defuse bad input.
    point_at: (game, body) => {
      if (typeof window === 'undefined' || !window.Nav || !window.Nav.ship) return "point_at works in the Navigator.";
      window.Nav.commandQueue.push({ type: 'rotate', target: String(body || 'sun').toLowerCase() });
      return `Aiming at ${body}`;
    },
    thrust: (game, power, duration) => {
      if (typeof window === 'undefined' || !window.Nav || !window.Nav.ship) return "thrust works in the Navigator.";
      let p = Number(power); p = Number.isFinite(p) ? Math.max(0, Math.min(20, p)) : 2.0;
      let d = Number(duration); d = Number.isFinite(d) ? Math.max(0, Math.min(400, d)) : 5.0;
      window.Nav.commandQueue.push({ type: 'thrust', power: p, duration: d });
      return `Thrust ${p} for ${d} days`;
    },
    wait: (game, duration) => {
      if (typeof window === 'undefined' || !window.Nav || !window.Nav.ship) return "wait works in the Navigator.";
      let d = Number(duration); d = Number.isFinite(d) ? Math.max(0, Math.min(400, d)) : 10.0;
      window.Nav.commandQueue.push({ type: 'wait', duration: d });
      return `Coast ${d} days`;
    },
    warp: (game, factor) => {
      if (typeof window === 'undefined' || !window.Nav || !window.Nav.ship) return "warp works in the Navigator.";
      let f = Number(factor); f = Number.isFinite(f) ? Math.max(1, Math.min(20, f)) : 5.0;
      window.Nav.commandQueue.push({ type: 'warp', factor: f });
      return `Warp ${f}x`;
    }
  }
};

// ----------------------------------------------------
// 5. AUTOCOMPLETE MATCH ENGINE
// ----------------------------------------------------
class AutocompleteEngine {
  constructor() {
    this.choices = [
      "antigravity", "gravity", "friction", "jump_power", "scale",
      "player.jump_power", "player.mass", "player.say()", "player.touching()",
      "player.fuel", "player.tank", "player.speed",
      "star.mass",
      "hopper.engine", "hopper.jump_power", "hopper.mass", "hopper.rocket_power", "hopper.spikes", "hopper.pole",
      "spawn()", "spawn_gem()", "spawn_box()", "spawn_spring()",
      "invert_gravity()", "rave_mode()", "survival_mode()", "meteor_shower()", "equip_blaster()", "shrink_enemies()", "bounce_up()", "reset()",
      "use_hopper()", "use_rover()",
      "play_music()", "music",
      "elasticity", "asteroid.mass", "enemy.speed", "enemy.friendly"
    ];
    // Navigator flight-deck vocabulary — shown when suggest() is called with mode 'nav'.
    this.navChoices = [
      "point_at('earth')", "point_at('moon')", "point_at('mars')",
      "point_at('jupiter')", "point_at('glacies')", "point_at('magnet')",
      "thrust()", "wait()", "warp()", "repeat", "for i in range()"
    ];
  }

  suggest(prefix, mode) {
    if (!prefix) return [];

    // Trim leading whitespaces
    const p = prefix.trim().toLowerCase();
    if (p === "") return [];

    // Platformer vocabulary by default; flight-deck vocabulary in the Navigator.
    const pool = mode === 'nav' ? this.navChoices : this.choices;
    return pool.filter(c => c.toLowerCase().startsWith(p));
  }
}

// ----------------------------------------------------
// 6. COMPILER SINGLETON WRAPPER
// ----------------------------------------------------
class CompilerSingleton {
  constructor() {
    this.env = {
      gravity: null,
      friction: null,
      speed: null,
      engine: null,
      antigravity: 0,
      magnetStrength: null,
      magnetPole: 'north',
      raveMode: false,
      elasticity: null,
      asteroidMass: null,
      enemySpeed: null,
      enemyFriendly: false
    };
    
    // List of active 'when' triggers: { target, eventArgs, bodyAST }
    this.activeRules = [];
    this.previousOnGround = false;
    this.autocomplete = new AutocompleteEngine();
  }

  get events() {
    const evs = {};
    this.activeRules.forEach(rule => {
      evs[rule.target] = (game) => {
        const interpreter = new KidCodeInterpreter(game || window.Game || {});
        interpreter.evaluate(rule.body);
      };
    });
    return evs;
  }

  reset() {
    this.env = {
      gravity: null,
      friction: null,
      speed: null,
      engine: null,
      antigravity: 0,
      magnetStrength: null,
      magnetPole: 'north',
      raveMode: false,
      elasticity: null,
      asteroidMass: null,
      enemySpeed: null,
      enemyFriendly: false
    };
    this.activeRules = [];
    this.previousOnGround = false;
  }

  // Parses and runs a block of KidCode
  runCommand(code, game) {
    try {
      const tokenizer = new Tokenizer(code);
      const tokens = tokenizer.tokenize();
      
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      const interpreter = new KidCodeInterpreter(game);
      const result = interpreter.evaluate(ast);

      return {
        success: true,
        msg: result !== undefined && result !== null ? `=> ${result}` : "✓ Code run successfully!"
      };
    } catch (err) {
      if (err instanceof KidCodeError) {
        return {
          success: false,
          msg: `⚠ ${err.message} ${err.suggestion}`
        };
      }
      console.error(err);
      return {
        success: false,
        msg: `⚠ Parser error: Something looks wrong with the structure.`
      };
    }
  }

  registerEventHook(whenNode) {
    // Check if rule already exists (avoid duplicates)
    const exists = this.activeRules.some(r => r.target === whenNode.target && JSON.stringify(r.eventArgs) === JSON.stringify(whenNode.eventArgs));
    if (!exists) {
      this.activeRules.push(whenNode);
    }
  }

  // Invoked on every gameplay physics step to handle 'when' rules
  updateRules(game) {
    const interpreter = new KidCodeInterpreter(game);

    // Track onGround state transitions for 'player.lands'
    const justLanded = game.player.onGround && !this.previousOnGround;
    this.previousOnGround = game.player.onGround;

    // Check hit enemy stomps
    const hitEnemy = game.player.hitEnemyThisFrame;
    if (hitEnemy) game.player.hitEnemyThisFrame = false; // Reset

    for (const rule of this.activeRules) {
      let trigger = false;

      if (rule.target === 'player.lands' && justLanded) {
        trigger = true;
      }
      
      if (rule.target === 'player.touching') {
        const checkType = rule.eventArgs[0] ? rule.eventArgs[0].value : "";
        if (checkType && (game.player.touchingGroundType === checkType || game.player.isTouching(checkType, game))) {
          trigger = true;
        }
      }

      if (rule.target === 'hopper.rocket_on' && game.player.charType === 'hopper' && game.keys[' ']) {
        trigger = true;
      }

      if (rule.target === 'hit_enemy' && hitEnemy) {
        trigger = true;
      }

      if (rule.comparisonOp && rule.comparisonValue) {
        let leftVal = 0;
        if (rule.target === 'player.fuel' || rule.target === 'hopper.fuel') {
          leftVal = game.player.fuel;
        } else if (rule.target === 'player.speed') {
          leftVal = Math.sqrt(game.player.vx * game.player.vx + game.player.vy * game.player.vy);
        } else {
          try {
            leftVal = interpreter.getVariable(rule.target);
          } catch(e) {
            leftVal = 0;
          }
        }

        const rightVal = interpreter.evalExpr(rule.comparisonValue, {});
        
        let match = false;
        switch (rule.comparisonOp) {
          case '<': match = leftVal < rightVal; break;
          case '>': match = leftVal > rightVal; break;
          case '<=': match = leftVal <= rightVal; break;
          case '>=': match = leftVal >= rightVal; break;
          case '==': match = leftVal === rightVal; break;
          case '!=': match = leftVal !== rightVal; break;
        }

        const wasMatching = !!rule.lastMatch;
        rule.lastMatch = match;
        
        if (match && !wasMatching) {
          trigger = true;
        }
      }

      if (trigger) {
        try {
          // Rule bodies run every frame, so mute cap notices here (a `when` setting
          // an over-cap value must not spam the shell). It still clamps.
          this.suppressCapNotice = true;
          interpreter.evaluate(rule.body);
        } catch (err) {
          // Silently log execution errors to avoid gameplay disruptions
          console.warn("Event execution fail:", err.message);
        } finally {
          this.suppressCapNotice = false;
        }
      }
    }
  }
}

const Compiler = new CompilerSingleton();
