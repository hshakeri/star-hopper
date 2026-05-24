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
    
    // Support event structures: 'player.lands' or 'player.touching("ice")'
    const target = this.expect('IDENTIFIER', "Expected an event trigger like player.lands").value;
    
    let eventArgs = [];
    if (this.peek() && this.peek().type === 'LPAREN') {
      this.next(); // consume '('
      if (this.peek().type !== 'RPAREN') {
        eventArgs.push(this.parseExpression());
      }
      this.expect('RPAREN', "Missing closing bracket ')' in event parameter");
    }

    this.expect('COLON', "Expected a colon ':' at the end of the when rule statement");

    const body = [];
    // Parse until end of input or newline (simple single-line block Support)
    while (this.pos < this.tokens.length) {
      const nextT = this.peek();
      if (nextT.type === 'NEWLINE') {
        this.next();
        break;
      }
      body.push(this.parseStatement());
    }

    return { type: 'when', target, eventArgs, body };
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
            return runtimeContext.functions[fnName](this.game, resolvedArgs[0], resolvedKwargs);
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
const runtimeContext = {
  variables: {
    gravity: {
      get: (game) => Compiler.env.gravity !== null ? Compiler.env.gravity : game.currentPlanet.physics.gravity,
      set: (game, val) => { Compiler.env.gravity = val; }
    },
    friction: {
      get: (game) => Compiler.env.friction !== null ? Compiler.env.friction : game.currentPlanet.physics.friction,
      set: (game, val) => { Compiler.env.friction = val; }
    },
    jump_power: {
      get: (game) => game.player.jumpPower,
      set: (game, val) => { game.player.jumpPower = val; }
    },
    "player.jump_power": {
      get: (game) => game.player.jumpPower,
      set: (game, val) => { game.player.jumpPower = val; }
    },
    "player.mass": {
      get: (game) => game.player.mass,
      set: (game, val) => { game.player.mass = val; }
    },
    "player.speed": {
      get: (game) => Compiler.env.speed !== null ? Compiler.env.speed : game.currentPlanet.physics.speed,
      set: (game, val) => {
        const numeric = Number(val);
        const fallback = game.currentPlanet.physics.speed;
        const tunedSpeed = Math.max(1, Math.min(8, Number.isFinite(numeric) ? numeric : fallback));
        Compiler.env.speed = tunedSpeed;
      }
    },
    speed: {
      get: (game) => Compiler.env.speed !== null ? Compiler.env.speed : game.currentPlanet.physics.speed,
      set: (game, val) => {
        const numeric = Number(val);
        const fallback = game.currentPlanet.physics.speed;
        const tunedSpeed = Math.max(1, Math.min(8, Number.isFinite(numeric) ? numeric : fallback));
        Compiler.env.speed = tunedSpeed;
      }
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
        const clamped = Math.max(0.2, Math.min(10.0, Number(val) || 2.5));
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
        game.player.rocketPower = Math.max(0, Math.min(120, Number.isFinite(numeric) ? numeric : 40));
      }
    },
    "hopper.spikes": {
      get: (game) => game.player.spikes || false,
      set: (game, val) => { game.player.spikes = !!val; }
    },
    "hopper.pole": {
      get: (game) => game.player.pole || 'north',
      set: (game, val) => { game.player.pole = val; }
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
        SFX.startBGM(id);
      }
    }
  },
  functions: {
    spawn: (game, type, kwargs) => {
      if (type === 'gem') type = 'coin';
      game.spawnItemAbovePlayer(type);
      return `Spawned ${type === 'coin' ? 'gem' : type}!`;
    },
    spawn_coin: (game) => {
      game.spawnItemAbovePlayer('coin');
      return "Spawned gem!";
    },
    spawn_gem: (game) => {
      game.spawnItemAbovePlayer('coin');
      return "Spawned gem!";
    },
    spawn_box: (game) => {
      game.spawnItemAbovePlayer('box');
      return "Spawned box!";
    },
    spawn_spring: (game) => {
      game.spawnItemAbovePlayer('spring');
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
    shrink_enemies: (game) => {
      game.shrinkAllEnemies();
      return "Enemies shrunk!";
    },
    bounce_up: (game) => {
      game.bouncePlayer();
      return "Bounced!";
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
    }
  }
};

// ----------------------------------------------------
// 5. AUTOCOMPLETE MATCH ENGINE
// ----------------------------------------------------
class AutocompleteEngine {
  constructor() {
    this.choices = [
      "gravity", "friction", "jump_power", "scale",
      "player.jump_power", "player.mass", "player.speed", "player.say()", "player.touching()",
      "star.mass",
      "hopper.mass", "hopper.rocket_power", "hopper.spikes", "hopper.pole",
      "spawn()", "spawn_gem()", "spawn_box()", "spawn_spring()",
      "invert_gravity()", "rave_mode()", "shrink_enemies()", "bounce_up()", "reset()",
      "play_music()", "music"
    ];
  }

  suggest(prefix) {
    if (!prefix) return [];
    
    // Trim leading whitespaces
    const p = prefix.trim().toLowerCase();
    if (p === "") return [];

    // Separate nesting dots
    return this.choices.filter(c => c.toLowerCase().startsWith(p));
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
      magnetStrength: null,
      magnetPole: 'north',
      raveMode: false
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
      magnetStrength: null,
      magnetPole: 'north',
      raveMode: false
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

      if (trigger) {
        try {
          interpreter.evaluate(rule.body);
        } catch (err) {
          // Silently log execution errors to avoid gameplay disruptions
          console.warn("Event execution fail:", err.message);
        }
      }
    }
  }
}

const Compiler = new CompilerSingleton();
