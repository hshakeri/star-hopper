// test-runner.js - Runs automated verification checks for Star Hopper

const testRunnerState = {
  total: 0,
  passed: 0,
  failed: 0
};

// Helper to log test row to UI
function renderTestResult(suiteId, name, success, errorMsg = "") {
  testRunnerState.total++;
  if (success) {
    testRunnerState.passed++;
  } else {
    testRunnerState.failed++;
  }

  const suiteContainer = document.getElementById(suiteId);
  if (!suiteContainer) return;

  const row = document.createElement("div");
  row.className = "test-row";

  const nameSpan = document.createElement("span");
  nameSpan.className = "test-name";
  nameSpan.textContent = name;

  const statusSpan = document.createElement("span");
  statusSpan.className = success ? "status-pass" : "status-fail";
  statusSpan.textContent = success ? "PASS" : "FAIL";

  const leftDiv = document.createElement("div");
  leftDiv.appendChild(nameSpan);

  if (!success && errorMsg) {
    const errDiv = document.createElement("div");
    errDiv.className = "error-details";
    errDiv.style.display = "block";
    errDiv.textContent = errorMsg;
    leftDiv.appendChild(errDiv);
  }

  row.appendChild(leftDiv);
  row.appendChild(statusSpan);
  suiteContainer.appendChild(row);

  // Update summary numbers
  document.getElementById("total-count").textContent = testRunnerState.total;
  document.getElementById("passed-count").textContent = testRunnerState.passed;
  document.getElementById("failed-count").textContent = testRunnerState.failed;
}

// Assert helper
function assertEquals(expected, actual, msg = "") {
  if (expected !== actual) {
    throw new Error(`Expected [${expected}] but got [${actual}]. ${msg}`);
  }
}

function assertClose(expected, actual, tolerance = 0.0001, msg = "") {
  if (Math.abs(expected - actual) > tolerance) {
    throw new Error(`Expected [${expected}] but got [${actual}]. ${msg}`);
  }
}

function makeScaffoldMockGame(planetIndex = 0) {
  return {
    currentPlanet: PLANETS[planetIndex] || PLANETS[0],
    currentPlanetIndex: planetIndex,
    player: {
      charType: 'hopper',
      jumpPower: 10,
      rocketPower: 40,
      mass: 1,
      spikes: false,
      pole: 'north',
      touchingGroundType: 'ice',
      say: () => {},
      isTouching: () => false
    },
    starMass: 1,
    hopperMass: 2.5,
    spawnedBoxes: [],
    spawnedSprings: [],
    spawnItemAbovePlayer(type) {
      if (type === 'box') this.spawnedBoxes.push({});
      if (type === 'spring') this.spawnedSprings.push({});
    },
    shrinkAllEnemies: () => {},
    bouncePlayer: () => {}
  };
}

// -----------------------------------------------------------------------------
// Test Case Declarations
// -----------------------------------------------------------------------------

// Suite 1: Compiler Parser
function runCompilerTests() {
  Compiler.reset();

  // Test 1: Gravity variable assignment
  try {
    const res = Compiler.runCommand("gravity = 9.8", {});
    assertEquals(true, res.success, "Command should succeed");
    assertClose(0.6, Compiler.env.gravity, 0.001, "gravity = 9.8 m/s² should store ~0.6 game-units");
    renderTestResult("compiler-suite", "Variable Assignment: gravity = 9.8 m/s² (stored in game-units)", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Variable Assignment: gravity = 9.8 m/s² (stored in game-units)", false, err.message);
  }

  // Test 2: Friction variable assignment
  try {
    const res = Compiler.runCommand("friction = 3.5", {});
    assertEquals(true, res.success);
    assertEquals(3.5, Compiler.env.friction, "Friction override should be 3.5");
    renderTestResult("compiler-suite", "Variable Assignment: friction = 3.5", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Variable Assignment: friction = 3.5", false, err.message);
  }

  // Test 3: Multiple commands split by semicolon or linebreaks
  try {
    Compiler.reset();
    const res = Compiler.runCommand("gravity = 9.8; friction = 5.0", {});
    assertEquals(true, res.success);
    assertClose(0.6, Compiler.env.gravity, 0.001);
    assertEquals(5.0, Compiler.env.friction);
    renderTestResult("compiler-suite", "Multiple statement parsing (split by ';')", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Multiple statement parsing (split by ';')", false, err.message);
  }

  // Test 4: Unknown keywords trigger failure
  try {
    const res = Compiler.runCommand("teleport_to('mars')", {});
    assertEquals(false, res.success, "Invalid keyword should fail execution");
    renderTestResult("compiler-suite", "Graceful failure for unrecognized commands", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Graceful failure for unrecognized commands", false, err.message);
  }

  // Test 5: Autocomplete Enter accepts the active suggestion, or the top row by default
  try {
    const matches = ["gravity", "grip", "grow"];
    assertEquals(0, getAutocompleteAcceptIndex(matches, -1), "No active row should default to the top suggestion");
    assertEquals(2, getAutocompleteAcceptIndex(matches, 2), "Active row should be accepted when present");
    assertEquals(-1, getAutocompleteAcceptIndex([], -1), "Empty matches should not produce a pick");
    assertEquals("hopper.mass", completeAutocompleteText("hopper.ma", "hopper.ma", "hopper.mass"));
    assertEquals("repeat 3: spawn_spring", completeAutocompleteText("repeat 3: spa", "spa", "spawn_spring"));
    renderTestResult("compiler-suite", "Autocomplete: Enter accepts highlighted or top suggestion", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Autocomplete: Enter accepts highlighted or top suggestion", false, err.message);
  }

  // Test 6: player.tank is wired into KidCode (read + write), like player.fuel
  try {
    Compiler.reset();
    const mockGame = { player: { fuel: 100, tank: 200, maxTank: 200 } };
    const res = Compiler.runCommand("player.tank = 50", mockGame);
    assertEquals(true, res.success, "Setting player.tank should succeed");
    assertEquals(50, mockGame.player.tank, "player.tank assignment writes the reserve");
    assertEquals(true, Compiler.autocomplete.choices.includes("player.tank"), "player.tank is offered in autocomplete");
    renderTestResult("compiler-suite", "KidCode: player.tank is readable/writable + autocompletes", true);
  } catch (err) {
    renderTestResult("compiler-suite", "KidCode: player.tank is readable/writable + autocompletes", false, err.message);
  }

  // Test 6b: Mission Coach Code Bridge aliases are executable, not just display syntax.
  try {
    Compiler.reset();
    let said = "";
    const mockGame = makeScaffoldMockGame(0);
    mockGame.player.charType = 'star';
    mockGame.player.mass = 1;
    mockGame.player.say = (msg) => { said = msg; };
    const res = Compiler.runCommand([
      "useHopper()",
      "hopper.jumpPower = 18",
      "hopper.rocketPower = 75",
      "spawnBlock()"
    ].join("\n"), mockGame);
    assertEquals(true, res.success, "Bridge-style commands should run");
    assertEquals("hopper", mockGame.player.charType, "useHopper alias activates Hopper");
    assertEquals(18, mockGame.player.jumpPower, "hopper.jumpPower writes canonical jump_power");
    assertEquals(75, mockGame.player.rocketPower, "hopper.rocketPower writes canonical rocket_power");
    assertEquals(1, mockGame.spawnedBoxes.length, "spawnBlock alias maps to the box helper");
    assertEquals(1, Compiler.lastRunStats.functionCalls.use_hopper, "Alias calls are recorded under canonical names");
    assertEquals(1, Compiler.lastRunStats.functionCalls.spawn_box, "Block alias keeps canonical spawn stats");
    assertEquals(4, Compiler.lastRunStats.bridgeAliasCount, "Bridge aliases are counted for reward/proof hooks");
    assertEquals(1, Compiler.lastRunStats.bridgeAliasCalls["useHopper->use_hopper"], "useHopper alias records its canonical target");
    assertEquals(1, Compiler.lastRunStats.bridgeAliasCalls["spawnBlock->spawn_box"], "spawnBlock alias records its canonical target");
    assertEquals(1, Compiler.lastRunStats.bridgeAliasVariables["hopper.jumpPower->hopper.jump_power"], "Bridge variable aliases are tracked");

    const repeat = Compiler.runCommand("repeat 2: spawnSpring()", mockGame);
    assertEquals(true, repeat.success, "Bridge-style loop helper should run");
    assertEquals(2, mockGame.spawnedSprings.length, "spawnSpring alias spawns springs");
    assertEquals(2, Compiler.lastRunStats.functionCalls.spawn_spring, "Looped alias spawns keep canonical stats");
    assertEquals(2, Compiler.lastRunStats.repeatSpawnTypes.spring, "Repeat spawn stats still recognize springs");
    assertEquals(2, Compiler.lastRunStats.bridgeAliasCalls["spawnSpring->spawn_spring"], "Looped bridge aliases are counted per execution");

    const branch = Compiler.runCommand("if hopper.jumpPower >= 18: player.say('bridge')", mockGame);
    assertEquals(true, branch.success, "Bridge-style variable aliases should read in expressions");
    assertEquals("bridge", said, "Expression read from hopper.jumpPower should trigger branch");
    assertEquals(1, Compiler.lastRunStats.bridgeAliasVariables["hopper.jumpPower->hopper.jump_power"], "Bridge variable reads are tracked");

    Compiler.reset();
    const eventRes = Compiler.runCommand("when hopper.rocketOn: bounceUp()", mockGame);
    assertEquals(true, eventRes.success, "Bridge-style event alias should register");
    assertEquals("hopper.rocket_on", Compiler.activeRules[0] && Compiler.activeRules[0].target, "Event alias normalizes to the existing rocket trigger");
    assertEquals(1, Compiler.lastRunStats.bridgeAliasEvents["hopper.rocketOn->hopper.rocket_on"], "Bridge event aliases are tracked");
    assertEquals(true, Compiler.autocomplete.choices.includes("spawnSpring()"), "Bridge helper is offered in autocomplete");
    assertEquals(true, Compiler.autocomplete.choices.includes("hopper.jumpPower"), "Bridge variable is offered in autocomplete");
    renderTestResult("compiler-suite", "KidCode: Code Bridge aliases execute + autocomplete", true);
  } catch (err) {
    renderTestResult("compiler-suite", "KidCode: Code Bridge aliases execute + autocomplete", false, err.message);
  }

  // Test 6c: chance(percent) gives KidCode a bounded probability branch.
  try {
    Compiler.reset();
    let sayMsg = "";
    const mockGame = {
      player: {
        say: (msg) => { sayMsg = msg; }
      }
    };
    let res = Compiler.runCommand("if chance(100): player.say('certain')", mockGame);
    assertEquals(true, res.success, "chance(100) branch should run");
    assertEquals("certain", sayMsg, "chance(100) should always pass and run the branch");
    assertEquals(100, mockGame.lastChanceResult && mockGame.lastChanceResult.percent, "Chance percent is clamped and recorded");
    assertEquals(true, mockGame.lastChanceResult && mockGame.lastChanceResult.passed, "chance(100) records a passed roll");
    assertEquals(1, mockGame.chanceTrialStats && mockGame.chanceTrialStats.trials, "chance(100) records one trial");
    assertEquals(1, mockGame.chanceTrialStats && mockGame.chanceTrialStats.passes, "chance(100) records one pass");

    sayMsg = "";
    res = Compiler.runCommand("if chance(0): player.say('never')", mockGame);
    assertEquals(true, res.success, "chance(0) branch should parse and run safely");
    assertEquals("", sayMsg, "chance(0) should never execute the branch");
    assertEquals(0, mockGame.lastChanceResult && mockGame.lastChanceResult.percent, "chance(0) records the lower bound");
    assertEquals(false, mockGame.lastChanceResult && mockGame.lastChanceResult.passed, "chance(0) records a failed roll");
    assertEquals(2, mockGame.chanceTrialStats && mockGame.chanceTrialStats.trials, "chance stats accumulate across runs");
    assertEquals(1, mockGame.chanceTrialStats && mockGame.chanceTrialStats.fails, "chance(0) records one fail");
    assertEquals(50, mockGame.lastChanceResult && mockGame.lastChanceResult.observedRate, "Observed rate summarizes all chance trials");
    assertEquals(true, Compiler.autocomplete.choices.includes("chance(50)"), "chance helper should be offered in autocomplete");
    renderTestResult("compiler-suite", "KidCode: chance(percent) branches and autocompletes", true);
  } catch (err) {
    renderTestResult("compiler-suite", "KidCode: chance(percent) branches and autocompletes", false, err.message);
  }
}

// Suite 2: Infinite Loop & Crash Safety Limits
function runSafetyTests() {
  // Test 5: Loop limits (repeat 5 runs successfully)
  try {
    Compiler.reset();
    // Mock game with spawn function
    let spawnCount = 0;
    const mockGame = {
      spawnItemAbovePlayer: (type) => {
        if (type === 'box') spawnCount++;
      }
    };
    const res = Compiler.runCommand("repeat 5: spawn_box()", mockGame);
    assertEquals(true, res.success);
    assertEquals(5, spawnCount, "Should spawn exactly 5 boxes");
    assertEquals(1, Compiler.lastRunStats.repeatLoops, "Run stats should record one repeat loop");
    assertEquals(5, Compiler.lastRunStats.repeatSpawnTypes.box, "Run stats should record boxes spawned from the repeat loop");
    renderTestResult("safety-suite", "Repeat Loop executes under limit (repeat 5)", true);
  } catch (err) {
    renderTestResult("safety-suite", "Repeat Loop executes under limit (repeat 5)", false, err.message);
  }

  // Test 6: Loop limits exceeded (repeat 100 halts)
  try {
    Compiler.reset();
    let spawnCount = 0;
    const mockGame = {
      spawnItemAbovePlayer: (type) => {
        if (type === 'box') spawnCount++;
      }
    };
    const res = Compiler.runCommand("repeat 100: spawn_box()", mockGame);
    assertEquals(false, res.success, "Loop of size 100 should be rejected by safety sandbox");
    assertEquals(0, spawnCount, "No items should be spawned on safety violation rejection");
    renderTestResult("safety-suite", "Infinite Loop Guard halts repeat statement (repeat 100)", true);
  } catch (err) {
    renderTestResult("safety-suite", "Infinite Loop Guard halts repeat statement (repeat 100)", false, err.message);
  }

  // Test 6b: Spawning objects with set coordinates
  try {
    Compiler.reset();
    let spawnCount = 0;
    let spawnedType = "";
    let spawnedX = undefined;
    let spawnedY = undefined;
    const mockGame = {
      spawnItemAbovePlayer: (type, x, y) => {
        spawnCount++;
        spawnedType = type;
        spawnedX = x;
        spawnedY = y;
      }
    };
    
    // 1) Test positional args
    let res = Compiler.runCommand("spawn_spring(120, 240)", mockGame);
    assertEquals(true, res.success);
    assertEquals(1, spawnCount);
    assertEquals("spring", spawnedType);
    assertEquals(120, spawnedX);
    assertEquals(240, spawnedY);

    // 2) Test generic spawn positional args
    res = Compiler.runCommand("spawn('box', 150, 300)", mockGame);
    assertEquals(true, res.success);
    assertEquals(2, spawnCount);
    assertEquals("box", spawnedType);
    assertEquals(150, spawnedX);
    assertEquals(300, spawnedY);

    // 3) Test generic spawn keyword args
    res = Compiler.runCommand("spawn('coin', x=80, y=160)", mockGame);
    assertEquals(true, res.success);
    assertEquals(3, spawnCount);
    assertEquals("coin", spawnedType);
    assertEquals(80, spawnedX);
    assertEquals(160, spawnedY);

    renderTestResult("safety-suite", "Spawn Functions: accept custom x and y coordinates (positional & keyword)", true);
  } catch (err) {
    renderTestResult("safety-suite", "Spawn Functions: accept custom x and y coordinates (positional & keyword)", false, err.message);
  }

  // Test 6c: Spawning objects with custom offset spacing
  try {
    Compiler.reset();
    let spawnCount = 0;
    let spawnedType = "";
    let spawnedX = undefined;
    let spawnedY = undefined;
    let spawnedOpts = undefined;
    const mockGame = {
      spawnItemAbovePlayer: (type, x, y, options) => {
        spawnCount++;
        spawnedType = type;
        spawnedX = x;
        spawnedY = y;
        spawnedOpts = options;
      }
    };

    // 1) Test spawn_spring with keyword offset
    let res = Compiler.runCommand("spawn_spring(offset=50)", mockGame);
    assertEquals(true, res.success);
    assertEquals(1, spawnCount);
    assertEquals("spring", spawnedType);
    assertEquals(undefined, spawnedX);
    assertEquals(undefined, spawnedY);
    assertEquals(50, spawnedOpts && spawnedOpts.offset);

    // 2) Test generic spawn with keyword offset
    res = Compiler.runCommand("spawn('box', offset=45)", mockGame);
    assertEquals(true, res.success);
    assertEquals(2, spawnCount);
    assertEquals("box", spawnedType);
    assertEquals(undefined, spawnedX);
    assertEquals(undefined, spawnedY);
    assertEquals(45, spawnedOpts && spawnedOpts.offset);

    // 3) Test spawnStackOffset in a real/mock StarHopperGame
    const realGame = new StarHopperGame();
    realGame.player = { x: 100, y: 200, w: 32, h: 32, facing: 1 };
    realGame.spawnedSprings = [];
    
    // First spring stack offset
    let o1 = realGame.spawnStackOffset(realGame.spawnedSprings, 100, 152, 36);
    assertEquals(0, o1, "First spring has 0 offset");
    
    // Push a spring
    realGame.spawnedSprings.push({ x: 100, y: 152, collected: false });
    
    // Second spring stack offset (facing right -> offset should go right/forward)
    let o2 = realGame.spawnStackOffset(realGame.spawnedSprings, 100, 152, 36);
    assertEquals(36, o2, "Second spring offsets forward (+36)");
    
    // Change player facing to left
    realGame.player.facing = -1;
    let o2Left = realGame.spawnStackOffset(realGame.spawnedSprings, 100, 152, 36);
    assertEquals(-36, o2Left, "Second spring offsets forward to the left (-36) when facing left");

    renderTestResult("safety-suite", "Spawn Functions: support custom offset spacing and forward-spawning direction", true);
  } catch (err) {
    renderTestResult("safety-suite", "Spawn Functions: support custom offset spacing and forward-spawning direction", false, err.message);
  }
}

// Suite 3: Mock Game Engine State Integration Tests
function runEngineTests() {
  // Test 7: Event trigger binding
  try {
    Compiler.reset();
    const res = Compiler.runCommand("when hit_enemy: bounce_up()", {});
    assertEquals(true, res.success);
    assertEquals(true, typeof Compiler.events.hit_enemy === 'function', "Event listener for hit_enemy should be registered");
    renderTestResult("engine-suite", "Event listener binding (when hit_enemy: bounce_up())", true);
  } catch (err) {
    renderTestResult("engine-suite", "Event listener binding (when hit_enemy: bounce_up())", false, err.message);
  }

  // Test 8: Physics parameters defaults merging
  try {
    Compiler.reset();
    const mockPlanetPhysics = { gravity: 0.6, friction: 0.15, jumpPower: 11.5 };
    
    // Apply compiler overrides (gravity typed in m/s², stored in game-units)
    Compiler.runCommand("gravity = 9.8", {});

    // Merge overrides logic similar to physics.js
    const activeGravity = (Compiler.env.gravity !== null) ? Compiler.env.gravity : mockPlanetPhysics.gravity;
    const activeFriction = (Compiler.env.friction !== null) ? Compiler.env.friction : mockPlanetPhysics.friction;

    assertClose(0.6, activeGravity, 0.001, "Gravity override should take precedence");
    assertEquals(0.15, activeFriction, "Friction should revert to planet defaults");
    renderTestResult("engine-suite", "Compiler overrides priority vs planet defaults", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler overrides priority vs planet defaults", false, err.message);
  }

  // Test 9: Magnetism falls back to planet defaults when no compiler override is set
  try {
    Compiler.reset();
    const player = {
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      vx: 0,
      vy: 0,
      charType: 'hopper',
      magnetActive: true
    };
    const negNode = { x: 100, y: 0, w: 20, h: 20, type: 'neg_node' };
    Physics.applyMagnetism(player, [negNode], { physics: { magnetStrength: 1.5 } });

    assertEquals(true, player.vx > 0, "North-pole Hopper should be attracted toward a negative node by default");
    assertClose(0, player.vy, 0.0001, "Node is horizontally aligned, so vertical force should be zero");
    renderTestResult("engine-suite", "Physics: default magnet strength applies attraction force", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: default magnet strength applies attraction force", false, err.message);
  }

  // Test 10: Magnet singularities never poison velocity with NaN
  try {
    Compiler.reset();
    const player = {
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      vx: 0,
      vy: 0,
      charType: 'hopper',
      magnetActive: true
    };
    const centeredNode = { x: 0, y: 0, w: 20, h: 20, type: 'neg_node' };
    Physics.applyMagnetism(player, [centeredNode], { physics: { magnetStrength: 1.5 } });

    assertEquals(true, Number.isFinite(player.vx), "Magnet velocity X should remain finite");
    assertEquals(true, Number.isFinite(player.vy), "Magnet velocity Y should remain finite");
    renderTestResult("engine-suite", "Physics: zero-distance magnet force remains finite", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: zero-distance magnet force remains finite", false, err.message);
  }

  // Test 11: Falling below the tilemap remains a death-zone fall, not a hidden floor
  try {
    const openMap = [
      [0,0,0,0,0],
      [0,0,0,0,0]
    ];
    const entity = { x: 32, y: 50, w: 20, h: 20, vx: 0, vy: 20, isJumping: true };

    Physics.resolveWorldCollisions(entity, openMap, [], { currentPlanetIndex: 0 });

    assertEquals(70, entity.y, "Entity should keep falling past the bottom of the tilemap");
    assertEquals(false, entity.onGround, "Bottom out-of-bounds should not mark the player grounded");
    renderTestResult("engine-suite", "Physics: falling below map is not resolved as ground", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: falling below map is not resolved as ground", false, err.message);
  }

  // Test 12: High-speed movement still collides with thin tile walls
  try {
    const wallMap = [
      [0,0,0,0,0,0],
      [0,0,1,0,0,0],
      [0,0,0,0,0,0]
    ];
    const entity = { x: 32, y: 32, w: 20, h: 20, vx: 100, vy: 0, isJumping: false };

    Physics.resolveWorldCollisions(entity, wallMap, [], { currentPlanetIndex: 0 });

    assertEquals(44, entity.x, "Entity should stop at the wall's leading edge");
    assertEquals(0, entity.vx, "Horizontal velocity should clear after wall collision");
    renderTestResult("engine-suite", "Physics: sub-stepped collision prevents wall tunneling", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: sub-stepped collision prevents wall tunneling", false, err.message);
  }

  // Test 13: Spike terrain is detected separately from solid ground
  try {
    const hazardMap = [
      [0,0,0],
      [0,2,0],
      [0,1,0]
    ];
    const entity = { x: 32, y: 32, w: 20, h: 20, vx: 0, vy: 0 };

    const hazards = Physics.getHazardCollisions(entity, hazardMap);

    assertEquals(1, hazards.length, "Entity should overlap the spike hazard tile");
    assertEquals(1, hazards[0].r, "Hazard row should match spike tile row");
    assertEquals(1, hazards[0].c, "Hazard column should match spike tile column");
    renderTestResult("engine-suite", "Physics: spike hazard tiles are detected", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: spike hazard tiles are detected", false, err.message);
  }

  // Test 14: the engine knob writes the engine drive force (top speed = engine / mass)
  try {
    Compiler.reset();
    const mockGame = {
      currentPlanet: { physics: { speed: 3.2 } },
      player: {}
    };

    const res = Compiler.runCommand("hopper.engine = 5.5", mockGame);
    assertEquals(true, res.success);
    assertEquals(5.5, Compiler.env.engine, "hopper.engine should set the engine drive force");

    const res2 = Compiler.runCommand("hopper.engine = 7", mockGame);
    assertEquals(true, res2.success);
    assertEquals(7, Compiler.env.engine, "hopper.engine should set the engine drive force");
    renderTestResult("engine-suite", "Compiler: engine knob sets the runtime drive force", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: engine knob sets the runtime drive force", false, err.message);
  }

  // Test 15: Hopper rocket power produces tunable lift instead of a single clamped value
  try {
    Compiler.reset();
    const planet = { physics: { gravity: 0, friction: 0.9, airResistance: 1, speed: 4 } };
    const lowPower = new Player(0, 0);
    lowPower.charType = 'hopper';
    lowPower.onGround = false;
    lowPower.rocketPower = 30;
    lowPower.update({ " ": true }, planet, { player: lowPower, hopperMass: 1.0 });

    const highPower = new Player(0, 0);
    highPower.charType = 'hopper';
    highPower.onGround = false;
    highPower.rocketPower = 90;
    highPower.update({ " ": true }, planet, { player: highPower, hopperMass: 1.0 });

    assertEquals(true, highPower.vy < lowPower.vy, "Higher rocket power should create stronger upward velocity");
    assertClose(-30 / 35, lowPower.vy, 0.0001, "30 rocket power should map to scaled lift per frame");
    assertClose(-90 / 35, highPower.vy, 0.0001, "90 rocket power should map to scaled lift per frame");
    renderTestResult("engine-suite", "Physics: Hopper rocket power scales lift", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: Hopper rocket power scales lift", false, err.message);
  }

  // Test 15b: Free-fall is mass-independent (Galileo). A light Rover and a heavy Hopper
  // must gain the SAME downward velocity per frame under the same gravity — guarding
  // against the old ×0.7 / ×1.3 character scaling that taught "heavy falls faster".
  try {
    Compiler.reset();
    const planetG = { physics: { gravity: 0.5, friction: 0.9, airResistance: 1, speed: 4 } };

    const light = new Player(0, 0);
    light.charType = 'star'; light.onGround = false; light.vy = 0;
    light.update({}, planetG, { player: light, starMass: 1.0, hopperMass: 2.5 });

    const heavy = new Player(0, 0);
    heavy.charType = 'hopper'; heavy.onGround = false; heavy.vy = 0;
    heavy.update({}, planetG, { player: heavy, starMass: 1.0, hopperMass: 2.5 });

    assertClose(light.vy, heavy.vy, 0.0001, "Light and heavy suits must fall at the same rate (mass-independent gravity)");
    assertClose(0.5, heavy.vy, 0.0001, "Free-fall gain equals planet gravity, unscaled by character type");
    renderTestResult("engine-suite", "Physics: free-fall is mass-independent (no heavy-falls-faster)", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: free-fall is mass-independent (no heavy-falls-faster)", false, err.message);
  }

  // Test 15c: Mass still matters — it resists the jump impulse (F = m·a), so a heavier
  // suit launches with LESS upward velocity from the same jump_power. This is the honest
  // channel for the heavy-vs-floaty feel, replacing the removed gravity scaling.
  try {
    Compiler.reset();
    const planetJ = { physics: { gravity: 0.5, friction: 0.9, airResistance: 1, speed: 4 } };

    const jLight = new Player(0, 0);
    jLight.charType = 'star'; jLight.onGround = true; jLight.vy = 0; jLight.jumpPower = 15;
    jLight.update({ " ": true }, planetJ, { player: jLight, starMass: 1.0, hopperMass: 2.5 });

    const jHeavy = new Player(0, 0);
    jHeavy.charType = 'hopper'; jHeavy.onGround = true; jHeavy.vy = 0; jHeavy.jumpPower = 15;
    jHeavy.update({ " ": true }, planetJ, { player: jHeavy, starMass: 1.0, hopperMass: 2.5 });

    assertEquals(true, jLight.vy < jHeavy.vy, "Lighter suit jumps with more upward velocity (mass resists the impulse)");
    renderTestResult("engine-suite", "Physics: mass resists the jump impulse (F = m·a)", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: mass resists the jump impulse (F = m·a)", false, err.message);
  }

  // Test 16: Portal readiness requires all mission tasks and required collectibles
  const oldBubblePop16 = ComicBubbles.pop;
  const oldParticleBurst16 = Particles.spawnBurst;
  try {
    const game = new StarHopperGame();
    game.currentPlanet = {
      missions: [
        { id: "build" },
        { id: "collect" }
      ]
    };
    game.player = { x: 10, y: 20, w: 24, h: 32 };
    const portal = { type: "portal", x: 160, y: 64, w: 32, h: 32, collected: false };
    game.interactiveObjects = [portal];
    game.completedMissions = new Set(["build"]);
    game.requiredCollectiblesTotal = 3;
    game.requiredCollectiblesCollected = 2;
    const labels = [];
    let bursts = 0;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    let status = game.getLevelObjectiveStatus();
    assertEquals(false, status.readyForPortal, "Portal should stay locked while tasks or gems remain");
    assertEquals(null, game.checkPortalReadyCue("incomplete"), "Portal-ready cue should stay silent before all requirements are done");

    game.completedMissions.add("collect");
    game.requiredCollectiblesCollected = 3;
    status = game.getLevelObjectiveStatus();

    assertEquals(true, status.readyForPortal, "Portal should unlock only after tasks and gems are complete");
    const cue = game.checkPortalReadyCue("test");
    assertEquals(true, !!cue, "Portal-ready cue should fire once when the objective flips complete");
    assertEquals("test", cue.reason, "Portal-ready cue should keep the triggering reason for diagnostics");
    assertEquals(true, labels.includes("PORTAL READY!"), "Portal-ready cue should pop at the portal");
    assertEquals(1, portal.unlockPulse, "Portal should get a ready pulse ring");
    assertEquals(true, bursts >= 2, "Portal-ready cue should sparkle");
    assertEquals(true, cue.missingScienceProof, "Ready cue should detect missing science proof for the 3-star lab goal");
    assertEquals(true, labels.includes("3-STAR PROOF?"), "Ready cue should pop an optional science-proof nudge");
    assertEquals("PORTAL READY: proof for 3 stars or drive", game.missionBalloon.text, "CRT should make science proof optional, not blocking");
    assertEquals(null, game.checkPortalReadyCue("again"), "Portal-ready cue should be one-time per level");
    assertEquals(1, labels.filter(label => label === "PORTAL READY!").length, "Portal-ready pop should not repeat");

    const proofGame = new StarHopperGame();
    proofGame.currentPlanet = { missions: [{ id: "build" }] };
    proofGame.currentPlanetIndex = 0;
    proofGame.player = { x: 10, y: 20, w: 24, h: 32 };
    proofGame.interactiveObjects = [{ type: "portal", x: 160, y: 64, w: 32, h: 32, collected: false }];
    proofGame.completedMissions = new Set(["build"]);
    proofGame.requiredCollectiblesTotal = 1;
    proofGame.requiredCollectiblesCollected = 1;
    proofGame.confirmedHypotheses = new Set(["build"]);
    const proofCue = proofGame.checkPortalReadyCue("proof");
    assertEquals(false, proofCue.missingScienceProof, "Existing science proof should remove the 3-star nudge");
    assertEquals("PORTAL READY: drive to the exit", proofGame.missionBalloon.text, "Proven runs keep the direct exit instruction");
    ComicBubbles.pop = oldBubblePop16;
    Particles.spawnBurst = oldParticleBurst16;
    renderTestResult("engine-suite", "Objectives: portal requires tasks plus mission gems", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop16;
    Particles.spawnBurst = oldParticleBurst16;
    renderTestResult("engine-suite", "Objectives: portal requires tasks plus mission gems", false, err.message);
  }

  // Test 17: Required Earth gems are locked behind the intended engineering concepts
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.player = { charType: 'star', jumpPower: 99, rocketPower: 40, spikes: false };
    game.hopperMass = 2.5;
    game.spawnedSprings = [];
    game.spawnedBoxes = [];

    const lowGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 6, 5) };
    const highGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 3, 34) };

    assertEquals(false, game.canCollectGem(lowGem), "Jump power alone should not unlock low Earth gems");
    Compiler.env.gravity = 0.35;
    assertEquals(true, game.canCollectGem(lowGem), "Low Earth gems should unlock after gravity tuning");

    assertEquals(false, game.canCollectGem(highGem), "High Earth gems should still need full Hopper engineering");
    game.player.charType = 'hopper';
    game.player.mass = 1.2;
    game.hopperMass = 1.2;
    game.player.jumpPower = 18;     // jump FORCE -> launch = 18 / 1.2 = 15
    Compiler.env.engine = 6;        // engine FORCE -> top speed = 6 / 1.2 = 5
    assertEquals(true, game.canCollectGem(highGem), "High Earth gems should unlock with the light + strong Hopper build");
    renderTestResult("engine-suite", "Objectives: Earth gems require progressive engineering gates", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth gems require progressive engineering gates", false, err.message);
  }

  // Test 17b: Low Earth gems unlock if the Agility target is met (even if gravity is not lowered)
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'hopper', jumpPower: 22, rocketPower: 40, mass: 1.0, spikes: false };
    game.hopperMass = 1.0;
    Compiler.env.engine = 8;

    const lowGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 6, 5) };

    assertEquals(true, game.isEarthHopperEngineered(), "Agility target of 30 met");
    assertEquals(true, game.canCollectGem(lowGem), "Low Earth gems should unlock if agility target is met even if gravity is not");
    renderTestResult("engine-suite", "Objectives: Earth low gems unlock upon meeting Agility target", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth low gems unlock upon meeting Agility target", false, err.message);
  }

  // Test 17b2: the in-world sample beacon points to the next collectible mission gem, not locked gates.
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = { x: 0, y: 0, w: 24, h: 32 };
    game.canvas = { width: 300, height: 180 };
    game.cameraX = 0;
    game.reducedMotion = true;
    const lockedNear = { type: 'coin', requiredCollectible: true, collected: false, x: 24, y: 40, w: 16, h: 16, gemGate: { validate: () => false } };
    const bonusNear = { type: 'coin', requiredCollectible: false, collected: false, x: 28, y: 44, w: 16, h: 16 };
    const unlockedNear = { type: 'coin', requiredCollectible: true, collected: false, x: 64, y: 40, w: 16, h: 16, gemGate: { validate: () => true }, gem: { color: '#4ade80' } };
    const unlockedFar = { type: 'coin', requiredCollectible: true, collected: false, x: 220, y: 40, w: 16, h: 16, gemGate: { validate: () => true } };
    const offscreenSample = { type: 'coin', requiredCollectible: true, collected: false, x: 520, y: 50, w: 16, h: 16, gemGate: { validate: () => true }, gem: { color: '#67e8f9' } };
    game.interactiveObjects = [lockedNear, bonusNear, unlockedFar, unlockedNear];

    assertEquals(unlockedNear, game.getNextMissionSampleTarget(), "Beacon should choose the nearest unlocked required gem");

    const labels = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {}, arc() {}, stroke() {}, fill() {},
      moveTo() {}, lineTo() {}, setLineDash() {}, translate() {}, rotate() {},
      strokeText(text) { labels.push(text); }, fillText(text) { labels.push(text); }
    };
    const beacon = game.drawMissionSampleBeacon(ctx);
    assertEquals(unlockedNear, beacon.target, "Beacon render should use the selected sample");
    assertEquals(true, beacon.visible, "Beacon should be visible for an onscreen sample");
    assertEquals('#4ade80', beacon.color, "Beacon should use the sample gem color");
    assertEquals(true, labels.includes("SAMPLE"), "Beacon should label the sample target");

    unlockedNear.collected = true;
    unlockedFar.gemGate.validate = () => false;
    game.interactiveObjects = [lockedNear, bonusNear, unlockedFar, offscreenSample];
    const edgeBeacon = game.drawMissionSampleBeacon(ctx);
    assertEquals(offscreenSample, edgeBeacon.target, "Offscreen marker should still point to the unlocked sample");
    assertEquals(false, edgeBeacon.visible, "Offscreen marker should report that the sample itself is not visible");
    assertEquals(true, !!edgeBeacon.offscreen, "Offscreen sample should render an edge marker");
    assertEquals('#67e8f9', edgeBeacon.color, "Edge marker should use the offscreen sample color");
    assertEquals(276, edgeBeacon.x, "Right-edge marker should clamp inside the canvas");
    assertEquals(true, labels.includes("SAMPLE"), "Edge marker should keep the sample label visible");

    offscreenSample.collected = true;
    assertEquals(null, game.getNextMissionSampleTarget(), "No beacon target remains when all mission gems are locked or collected");
    assertEquals(null, game.drawMissionSampleBeacon(ctx), "Draw helper should no-op without a collectible target");

    const portalGame = new StarHopperGame();
    portalGame.state = 'playing';
    portalGame.player = { x: 0, y: 0, w: 24, h: 32 };
    portalGame.canvas = { width: 300, height: 180 };
    portalGame.cameraX = 0;
    portalGame.reducedMotion = true;
    const portal = { type: 'portal', collected: false, x: 520, y: 56, w: 32, h: 32 };
    portalGame.interactiveObjects = [portal];
    portalGame.getLevelObjectiveStatus = () => ({ readyForPortal: false });
    assertEquals(null, portalGame.getReadyPortalTarget(), "Locked portal should not become the active beacon target");
    assertEquals(null, portalGame.drawMissionSampleBeacon(ctx), "Locked portal should not draw an exit beacon");
    portalGame.getLevelObjectiveStatus = () => ({ readyForPortal: true });
    assertEquals(portal, portalGame.getReadyPortalTarget(), "Ready portal should become the finish beacon target");
    const portalBeacon = portalGame.drawMissionSampleBeacon(ctx);
    assertEquals(portal, portalBeacon.target, "Ready portal marker should point to the portal");
    assertEquals("EXIT", portalBeacon.label, "Ready portal marker should use an exit label");
    assertEquals("portal", portalBeacon.kind, "Ready portal marker should report portal kind");
    assertEquals(false, portalBeacon.visible, "Offscreen portal marker should report that the portal itself is offscreen");
    assertEquals(true, !!portalBeacon.offscreen, "Offscreen portal should render an edge marker");
    assertEquals(276, portalBeacon.x, "Right-edge portal marker should clamp inside the canvas");
    assertEquals(true, labels.includes("EXIT"), "Ready portal marker should keep the exit label visible");
    renderTestResult("engine-suite", "Objectives: beacon marks unlocked mission samples", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: beacon marks unlocked mission samples", false, err.message);
  }

  // Test 17b3: code-opened gem gates pop once on the newly unlocked samples.
  const oldBubblePop17b3 = ComicBubbles.pop;
  const oldParticleBurst17b3 = Particles.spawnBurst;
  try {
    const game = new StarHopperGame();
    const gate = { open: false, validate: () => gate.open };
    const lockedSample = { type: 'coin', requiredCollectible: true, collected: false, x: 40, y: 64, w: 16, h: 16, gemGate: gate, gem: { color: '#4ade80' } };
    const alreadyOpen = { type: 'coin', requiredCollectible: true, collected: false, x: 96, y: 64, w: 16, h: 16, gemGate: { validate: () => true }, gem: { color: '#67e8f9' } };
    game.interactiveObjects = [lockedSample, alreadyOpen];
    const labels = [];
    let bursts = 0;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const before = game.getLockedRequiredCollectibles();
    assertEquals(1, before.length, "Snapshot should include only the locked required sample");
    assertEquals(lockedSample, before[0], "Snapshot should keep the exact locked gem reference");

    gate.open = true;
    const pulse = game.spawnGemGateUnlockEffects(before);
    assertEquals(1, pulse.opened, "Exactly one previously locked sample should open");
    assertEquals(lockedSample, pulse.targets[0], "Open pulse should target the newly collectible sample");
    assertEquals(1, lockedSample.unlockPulse, "Newly opened sample should get the expanding unlock ring");
    assertEquals(true, lockedSample.gateOpenEffectPlayed, "Opened sample should be marked so the cue cannot be replayed");
    assertEquals(true, labels.includes("OPEN!"), "Newly opened sample should pop an OPEN label");
    assertEquals(true, bursts >= 2, "Newly opened sample should spawn a sparkle burst");

    const replay = game.spawnGemGateUnlockEffects(before);
    assertEquals(0, replay.opened, "Same snapshot should not replay gate-open effects");
    assertEquals(1, labels.filter(label => label === "OPEN!").length, "OPEN label should remain one-time");

    ComicBubbles.pop = oldBubblePop17b3;
    Particles.spawnBurst = oldParticleBurst17b3;
    renderTestResult("engine-suite", "Objectives: newly opened gem gates pop once", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop17b3;
    Particles.spawnBurst = oldParticleBurst17b3;
    renderTestResult("engine-suite", "Objectives: newly opened gem gates pop once", false, err.message);
  }

  // Test 17b4: collecting mission samples shows explicit sample progress in the level.
  const oldBubblePop17b4 = ComicBubbles.pop;
  const oldParticleBurst17b4 = Particles.spawnBurst;
  try {
    const game = new StarHopperGame();
    game.requiredCollectiblesTotal = 3;
    game.requiredCollectiblesCollected = 2;
    const sample = { x: 40, y: 64, w: 16, h: 16 };
    const labels = [];
    let bursts = 0;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const partial = game.spawnMissionSampleCollectedEffect(sample, { color: '#4ade80' }, false);
    assertEquals("SAMPLE 2/3", partial.label, "Partial sample pickup should show collected/total progress");
    assertEquals(true, labels.includes("SAMPLE 2/3"), "Partial sample pickup should pop the explicit progress label");
    assertEquals(false, partial.complete, "Partial sample pickup should not claim completion");

    game.requiredCollectiblesCollected = 3;
    const complete = game.spawnMissionSampleCollectedEffect(sample, { color: '#4ade80' }, true);
    assertEquals("ALL SAMPLES!", complete.label, "Final sample pickup should call out the milestone");
    assertEquals(true, labels.includes("ALL SAMPLES!"), "Final sample pickup should pop the milestone label");
    assertEquals(true, complete.complete, "Final sample pickup should report completion");
    assertEquals(true, bursts >= 3, "Sample pickups should keep their sparkle feedback");

    ComicBubbles.pop = oldBubblePop17b4;
    Particles.spawnBurst = oldParticleBurst17b4;
    renderTestResult("engine-suite", "Objectives: sample pickups show mission progress", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop17b4;
    Particles.spawnBurst = oldParticleBurst17b4;
    renderTestResult("engine-suite", "Objectives: sample pickups show mission progress", false, err.message);
  }

  // Test 17b5: Earth coaching reveals one variable at a time from the first mission.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'star', jumpPower: 10, rocketPower: 40, mass: 1, spikes: false };
    game.star = game.player;
    game.hopper = game.player;
    game.hopperMass = 2.5;
    const earthMission = PlatformerMissions.find(mission => mission.id === "earth-gravity-wall");
    const activeMission = { id: "earth-gravity-wall", fullMission: earthMission };

    const phaseRowsOne = getMissionLessonPhaseRows(game, earthMission);
    assertEquals("active", phaseRowsOne[0].status, "Earth phase ladder starts on felt gravity");
    assertEquals("locked", phaseRowsOne[1].status, "Earth phase ladder locks mass before antigravity passes");
    assertEquals("use_hopper()\nantigravity = 4.9", phaseRowsOne[0].command, "Earth first phase stages setup plus one variable");
    assertEquals(true, /Stage the first phase/.test(phaseRowsOne[0].proofText), "Earth first phase should expose its live proof requirement");
    const phaseHTMLBefore = renderMissionLessonPhaseLadder(game, earthMission);
    assertEquals(true, /data-lesson-phase-stage="0"/.test(phaseHTMLBefore), "Active Earth gravity phase should expose a stage button");
    assertEquals(false, /hopper\.mass = 1\.2/.test(phaseHTMLBefore), "Earth ladder should hide mass before gravity proof");
    assertEquals(true, /lesson-phase-pip active/.test(phaseHTMLBefore) && /lesson-phase-pip locked/.test(phaseHTMLBefore), "Earth ladder should render active and locked progress pips");
    assertEquals(true, /PROOF/.test(phaseHTMLBefore) && /Stage the first phase/.test(phaseHTMLBefore), "Earth ladder should render the active proof requirement");

    const phaseOne = scaffoldWithActiveSlots(earthMission.scaffold, game, earthMission);
    assertEquals(1, phaseOne.slots.length, "Earth phase one should expose only the antigravity slot");
    assertEquals("gravity", phaseOne.slots[0].id, "Earth phase one should expose antigravity first");
    assertEquals(false, /hopper\.mass/.test(phaseOne.template), "Earth phase one scaffold should not include mass yet");
    assertEquals("use_hopper()\nantigravity = 4.9", buildNextExperimentCommand(earthMission, null, game), "Earth first stage command should be setup plus antigravity only");
    const firstFormula = getActiveFormulaTarget(game, activeMission);
    assertEquals("Gravity Lab", firstFormula && firstFormula.title, "Earth formula target should still start with Gravity Lab");

    game.player.charType = 'hopper';
    Compiler.env.antigravity = 4.9 / GRAVITY_MPS2_PER_UNIT;
    let rows = getMissionLessonPhaseRows(game, earthMission);
    assertEquals("complete", rows[0].status, "Earth gravity phase completes after antigravity proof");
    assertEquals("active", rows[1].status, "Earth mass phase activates after gravity proof");
    assertEquals("PAYOFF", rows[0].cueLabel, "Completed Earth phase should switch from formula to payoff");
    assertEquals("Low Emerald routes feel reachable", rows[0].detail, "Completed Earth phase should explain the earned gameplay payoff");
    assertEquals(true, /Felt gravity is low enough/.test(rows[0].proofText), "Completed Earth phase should expose the validator success proof");
    assertEquals("UNLOCKED: 2 Light mass", rows[0].unlockLabel, "Completed Earth phase should point to the newly unlocked next tweak");
    assertEquals("hopper.mass = 1.2", rows[1].command, "Earth second phase reveals mass");
    assertEquals("hopper.mass = 1.2", buildNextExperimentCommand(earthMission, null, game), "Earth second stage command should be mass only");
    const phaseHTMLAfterGravity = renderMissionLessonPhaseLadder(game, earthMission);
    assertEquals(true, /PAYOFF/.test(phaseHTMLAfterGravity), "Earth ladder should visibly label completed phase payoff");
    assertEquals(true, /UNLOCKED: 2 Light mass/.test(phaseHTMLAfterGravity), "Earth ladder should visibly point to the next unlocked phase");
    assertEquals(true, /Felt gravity is low enough/.test(phaseHTMLAfterGravity), "Earth ladder should render the completed proof evidence");
    assertEquals(true, /1\/4 lesson phases complete/.test(phaseHTMLAfterGravity), "Earth ladder progress label should summarize completed phases");
    assertEquals(true, /lesson-phase-pip complete/.test(phaseHTMLAfterGravity) && /lesson-phase-pip active/.test(phaseHTMLAfterGravity), "Earth ladder should render complete and active progress pips after proof");

    game.hopperMass = 1.2;
    game.player.mass = 1.2;
    rows = getMissionLessonPhaseRows(game, earthMission);
    assertEquals("complete", rows[1].status, "Earth mass phase completes after mass proof");
    assertEquals("active", rows[2].status, "Earth engine phase activates after mass proof");
    assertEquals("hopper.engine = 6", buildNextExperimentCommand(earthMission, null, game), "Earth third stage command should be engine only");

    Compiler.env.engine = 6;
    rows = getMissionLessonPhaseRows(game, earthMission);
    assertEquals("complete", rows[2].status, "Earth engine phase completes after engine proof");
    assertEquals("active", rows[3].status, "Earth jump phase activates after engine proof");
    assertEquals("hopper.jump_power = 18", buildNextExperimentCommand(earthMission, null, game), "Earth fourth stage command should be jump only");

    game.player.jumpPower = 18;
    rows = getMissionLessonPhaseRows(game, earthMission);
    assertEquals("complete", rows[3].status, "Earth jump phase completes after jump proof");
    assertEquals(true, earthMission.resultChecks.every(check => check.check(game, Compiler)), "Earth phased scaffold checks all pass after the full sequence");

    Compiler.env.antigravity = null;
    Compiler.env.engine = 6;
    const staleGame = new StarHopperGame();
    staleGame.currentPlanet = PLANETS[0];
    staleGame.currentPlanetIndex = 0;
    const stalePhase = scaffoldWithActiveSlots(earthMission.scaffold, staleGame, earthMission);
    assertEquals(1, stalePhase.slots.length, "Stale later values should not unlock Earth phases out of order");
    assertEquals("gravity", stalePhase.slots[0].id, "Earth scaffold still starts at gravity when earlier proof is missing");
    Compiler.reset();
    renderTestResult("engine-suite", "Curriculum: Earth coach phases first variables", true);
  } catch (err) {
    Compiler.reset();
    renderTestResult("engine-suite", "Curriculum: Earth coach phases first variables", false, err.message);
  }

  // Test 17c: Asteroid Forge teaches one concept first: mass unlocks the first gem, then
  // elasticity is required for later boulder-bounce gems.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[5];
    game.currentPlanetIndex = 5;
    game.player = { charType: 'hopper', jumpPower: 10, rocketPower: 40, mass: 2.5, spikes: false };
    game.hopperMass = 2.5;

    const firstForgeGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(5, 6, 18) };
    const laterForgeGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(5, 6, 30) };

    assertEquals(false, game.canCollectGem(firstForgeGem), "First Forge gem should still require a heavy Hopper");
    game.player.mass = 4.0;
    game.hopperMass = 4.0;
    assertEquals(true, game.canCollectGem(firstForgeGem), "First Forge gem unlocks with mass alone");
    assertEquals(false, game.canCollectGem(laterForgeGem), "Later Forge gems still require elasticity after mass");
    Compiler.env.elasticity = 1.0;
    assertEquals(true, game.canCollectGem(laterForgeGem), "Later Forge gems unlock after adding elasticity");
    renderTestResult("engine-suite", "Objectives: Forge gates introduce mass before elasticity", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Forge gates introduce mass before elasticity", false, err.message);
  }

  // Test 17c1: Forge coaching keeps the second variable hidden until the mass shove
  // is proven, so the first success is one obvious code tweak.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[5];
    game.currentPlanetIndex = 5;
    game.player = { charType: 'hopper', jumpPower: 10, rocketPower: 40, mass: 2.5, spikes: false };
    game.hopperMass = 2.5;
    const forgeMission = PlatformerMissions.find(mission => mission.id === "asteroid-forge-momentum");
    const activeMission = { id: "asteroid-forge-momentum", fullMission: forgeMission };

    const phaseRowsOne = getMissionLessonPhaseRows(game, forgeMission);
    assertEquals("active", phaseRowsOne[0].status, "Forge phase ladder starts on the mass shove");
    assertEquals("locked", phaseRowsOne[1].status, "Forge phase ladder locks bounce before mass passes");
    assertEquals("", phaseRowsOne[1].command, "Locked Forge phase should not reveal the elasticity command");
    const phaseHTMLBefore = renderMissionLessonPhaseLadder(game, forgeMission);
    assertEquals(true, /NOW/.test(phaseHTMLBefore) && /LOCKED/.test(phaseHTMLBefore), "Forge phase ladder should show active and locked states");
    assertEquals(false, /elasticity = 1\.0/.test(phaseHTMLBefore), "Forge phase ladder should hide elasticity code before mass proof");
    assertEquals(true, /data-lesson-phase-stage="0"/.test(phaseHTMLBefore), "Active Forge mass phase should expose a stage button");

    const phaseOne = scaffoldWithActiveSlots(forgeMission.scaffold, game, forgeMission);
    assertEquals(1, phaseOne.slots.length, "Forge phase one should expose only one scaffold slot");
    assertEquals("mass", phaseOne.slots[0].id, "Forge phase one should expose mass first");
    assertEquals(false, /elasticity/.test(phaseOne.template), "Forge phase one scaffold should not include elasticity");
    assertEquals("use_hopper()\nhopper.mass = 4.0", buildNextExperimentCommand(forgeMission, null, game), "Forge first stage command should be mass-only");
    const phaseOneState = evaluateMissionResultChecks(game, forgeMission);
    const phaseOneCue = buildNextExperimentCue(game, phaseOneState, activeMission);
    assertEquals(false, /elasticity/.test(phaseOneCue.command), "Forge next cue should not stage elasticity before mass passes");

    game.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind).filter(kind => kind !== "elasticity"));
    assertEquals(null, getActiveFormulaTarget(game, activeMission), "Hidden Forge elasticity should not become the active formula target early");

    game.player.mass = 4.0;
    game.hopperMass = 4.0;
    const phaseRowsTwo = getMissionLessonPhaseRows(game, forgeMission);
    assertEquals("complete", phaseRowsTwo[0].status, "Forge phase ladder marks mass complete after proof");
    assertEquals("active", phaseRowsTwo[1].status, "Forge phase ladder activates bounce after mass proof");
    assertEquals("PAYOFF", phaseRowsTwo[0].cueLabel, "Completed Forge phase should switch from science formula to payoff");
    assertEquals("First Forge gem opens", phaseRowsTwo[0].detail, "Completed Forge phase should name the earned route payoff");
    assertEquals(true, /Hopper is heavy enough/.test(phaseRowsTwo[0].proofText), "Completed Forge phase should expose the validator success proof");
    assertEquals("UNLOCKED: 2 Bounce control", phaseRowsTwo[0].unlockLabel, "Completed Forge phase should point to the unlocked bounce phase");
    assertEquals("elasticity = 1.0", phaseRowsTwo[1].command, "Unlocked Forge phase reveals the elasticity command");
    const phaseHTMLAfter = renderMissionLessonPhaseLadder(game, forgeMission);
    assertEquals(true, /DONE/.test(phaseHTMLAfter) && /NOW/.test(phaseHTMLAfter), "Forge phase ladder should show complete and active states after mass");
    assertEquals(true, /PAYOFF/.test(phaseHTMLAfter) && /UNLOCKED: 2 Bounce control/.test(phaseHTMLAfter), "Forge ladder should show the completed payoff and next unlock");
    assertEquals(true, /Hopper is heavy enough/.test(phaseHTMLAfter), "Forge ladder should render completed proof evidence");
    assertEquals(true, /lesson-phase-pip complete/.test(phaseHTMLAfter) && /lesson-phase-pip active/.test(phaseHTMLAfter), "Forge ladder should render progress pips for complete and active phases");
    assertEquals(true, /elasticity = 1\.0/.test(phaseHTMLAfter), "Forge phase ladder should reveal elasticity after mass proof");
    assertEquals(false, /data-lesson-phase-stage="0"/.test(phaseHTMLAfter), "Completed Forge mass phase should stop exposing the stage action");
    assertEquals(true, /data-lesson-phase-stage="1"/.test(phaseHTMLAfter), "Active Forge bounce phase should expose a stage button");

    const phaseTwo = scaffoldWithActiveSlots(forgeMission.scaffold, game, forgeMission);
    assertEquals(2, phaseTwo.slots.length, "Forge phase two reveals the bounce slot after mass passes");
    assertEquals("elasticity", phaseTwo.slots[1].id, "Forge phase two exposes elasticity second");
    assertEquals("elasticity = 1.0", buildNextExperimentCommand(forgeMission, null, game), "Forge second stage command should be elasticity-only");
    const phaseTwoState = evaluateMissionResultChecks(game, forgeMission);
    const phaseTwoCue = buildNextExperimentCue(game, phaseTwoState, activeMission);
    assertEquals("elasticity = 1.0", phaseTwoCue.command, "Forge next cue should stage elasticity after the mass proof");

    const oldGetElementById17c1 = document.getElementById;
    const oldWindowGame17c1 = window.Game;
    const input17c1 = {
      value: "",
      focused: false,
      style: {},
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    let phaseClick = null;
    const phaseButton = {
      dataset: { lessonPhaseStage: "1" },
      addEventListener(event, handler) { if (event === "click") phaseClick = handler; }
    };
    const phaseRoot = {
      querySelectorAll(selector) { return selector === "[data-lesson-phase-stage]" ? [phaseButton] : []; }
    };
    const restoredPlanet = game.currentPlanet;
    try {
      document.getElementById = (id) => id === "console-input" ? input17c1 : null;
      game.currentPlanet = null;
      window.Game = game;
      attachLessonPhaseStageButtons(phaseRoot, game, forgeMission);
      assertEquals(true, typeof phaseClick === "function", "Lesson phase stage helper should attach a click handler");
      phaseClick();
      assertEquals("elasticity = 1.0", input17c1.value, "Active Forge phase button should stage the exact next phase command");
      assertEquals(true, input17c1.focused, "Active Forge phase button should focus Mission Coach");
      assertEquals("lesson-phase", game.lastStagedExperiment && game.lastStagedExperiment.source, "Phase stage button should enter the shared staged-experiment loop");
      assertEquals("2 Bounce control", game.lastStagedExperiment && game.lastStagedExperiment.title, "Phase stage button should preserve the phase title");
      assertEquals("Lesson phase", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Phase staged reminder should name the lesson phase source");
    } finally {
      game.currentPlanet = restoredPlanet;
      window.Game = oldWindowGame17c1;
      document.getElementById = oldGetElementById17c1;
    }
    renderTestResult("engine-suite", "Curriculum: Forge coach phases mass before elasticity", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: Forge coach phases mass before elasticity", false, err.message);
  }

  // Test 17c1a: Moon coaching stages arithmetic first, then unlocks the repeat loop.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[1];
    game.currentPlanetIndex = 1;
    game.player = { charType: 'rover', jumpPower: 9, mass: 1, spikes: false };
    game.spawnedSprings = [];
    const moonMission = PlatformerMissions.find(mission => mission.id === "moon-canyon-jump");
    const activeMission = { id: "moon-canyon-jump", fullMission: moonMission };

    const phaseRowsOne = getMissionLessonPhaseRows(game, moonMission);
    assertEquals("active", phaseRowsOne[0].status, "Moon phase ladder starts on jump arithmetic");
    assertEquals("locked", phaseRowsOne[1].status, "Moon phase ladder locks the repeat loop before jump math passes");
    assertEquals("", phaseRowsOne[1].command, "Locked Moon phase should not reveal the spring-loop command");
    const phaseHTMLBefore = renderMissionLessonPhaseLadder(game, moonMission);
    assertEquals(true, /data-lesson-phase-stage="0"/.test(phaseHTMLBefore), "Active Moon jump phase should expose a stage button");
    assertEquals(false, /repeat 3: spawn_spring/.test(phaseHTMLBefore), "Moon ladder should hide the loop command before jump proof");

    const phaseOne = scaffoldWithActiveSlots(moonMission.scaffold, game, moonMission);
    assertEquals(1, phaseOne.slots.length, "Moon phase one should expose only the jump-math slot");
    assertEquals("jump_math", phaseOne.slots[0].id, "Moon phase one should expose arithmetic first");
    assertEquals(false, /repeat/.test(phaseOne.template), "Moon phase one scaffold should not include repeat-loop code");
    assertEquals("player.jump_power = gravity * 10", buildNextExperimentCommand(moonMission, null, game), "Moon first stage command should be jump arithmetic only");
    const phaseOneState = evaluateMissionResultChecks(game, moonMission);
    const phaseOneCue = buildNextExperimentCue(game, phaseOneState, activeMission);
    assertEquals(false, /spawn_spring/.test(phaseOneCue.command), "Moon next cue should not stage springs before jump math passes");

    game.player.jumpPower = 20;
    const phaseRowsTwo = getMissionLessonPhaseRows(game, moonMission);
    assertEquals("complete", phaseRowsTwo[0].status, "Moon phase ladder marks jump math complete after proof");
    assertEquals("active", phaseRowsTwo[1].status, "Moon phase ladder activates the spring loop after jump math");
    assertEquals("PAYOFF", phaseRowsTwo[0].cueLabel, "Completed Moon phase should switch from formula to payoff");
    assertEquals("Moon hops reach higher", phaseRowsTwo[0].detail, "Completed Moon phase should explain the earned route payoff");
    assertEquals("UNLOCKED: 2 Spring loop", phaseRowsTwo[0].unlockLabel, "Completed Moon phase should point to the unlocked loop phase");
    assertEquals("repeat 3: spawn_spring()", phaseRowsTwo[1].command, "Unlocked Moon phase reveals the repeat-loop command");
    const phaseHTMLAfter = renderMissionLessonPhaseLadder(game, moonMission);
    assertEquals(true, /PAYOFF/.test(phaseHTMLAfter) && /UNLOCKED: 2 Spring loop/.test(phaseHTMLAfter), "Moon ladder should show the completed payoff and next unlock");
    assertEquals(false, /data-lesson-phase-stage="0"/.test(phaseHTMLAfter), "Completed Moon jump phase should stop exposing the stage action");
    assertEquals(true, /data-lesson-phase-stage="1"/.test(phaseHTMLAfter), "Active Moon loop phase should expose a stage button");

    const phaseTwo = scaffoldWithActiveSlots(moonMission.scaffold, game, moonMission);
    assertEquals(2, phaseTwo.slots.length, "Moon phase two reveals the spring-loop slot after jump math passes");
    assertEquals("springs", phaseTwo.slots[1].id, "Moon phase two exposes repeat-loop springs second");
    assertEquals("repeat 3: spawn_spring()", buildNextExperimentCommand(moonMission, null, game), "Moon second stage command should be repeat-loop only");
    const phaseTwoState = evaluateMissionResultChecks(game, moonMission);
    const phaseTwoCue = buildNextExperimentCue(game, phaseTwoState, activeMission);
    assertEquals("repeat 3: spawn_spring()", phaseTwoCue.command, "Moon next cue should stage the loop after the jump proof");

    game.spawnedSprings = [{}, {}, {}];
    const phaseRowsDone = getMissionLessonPhaseRows(game, moonMission);
    assertEquals("complete", phaseRowsDone[1].status, "Moon phase ladder marks spring loop complete after three springs");
    renderTestResult("engine-suite", "Curriculum: Moon coach phases arithmetic before loops", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: Moon coach phases arithmetic before loops", false, err.message);
  }

  // Test 17c1b: completing a visible Forge phase creates a non-farmable visual cue.
  const oldGetElementById17c1b = document.getElementById;
  const oldWindowGame17c1b = window.Game;
  const oldBubblePop17c1b = ComicBubbles.pop;
  const oldParticleBurst17c1b = Particles.spawnBurst;
  try {
    Compiler.reset();
    let phaseRewardClick = null;
    const phaseRewardButton = {
      dataset: { phaseNextCommand: "elasticity = 1.0", phaseNextTitle: "2 Bounce control" },
      addEventListener(event, handler) { if (event === "click") phaseRewardClick = handler; }
    };
    const panel = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll(selector) {
        return selector === "[data-phase-next-command]" && /data-phase-next-command/.test(this.innerHTML)
          ? [phaseRewardButton]
          : [];
      }
    };
    const input17c1b = {
      value: "",
      focused: false,
      style: {},
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => {
      if (id === "discovery-pulse") return panel;
      if (id === "console-input") return input17c1b;
      return null;
    };
    const labels = [];
    let bursts = 0;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[5];
    game.currentPlanetIndex = 5;
    game.player = { charType: 'hopper', x: 96, y: 90, w: 24, h: 32, jumpPower: 10, rocketPower: 40, mass: 4.0, spikes: false };
    game.hopperMass = 4.0;
    const forgeMission = PlatformerMissions.find(mission => mission.id === "asteroid-forge-momentum");
    const activeMission = { id: "asteroid-forge-momentum", fullMission: forgeMission };
    const massState = {
      allPassed: false,
      items: [
        { id: "asteroid-mass-check", label: "First shove: Hopper mass 4.0", passed: true, message: "Mass proof passed" },
        { id: "asteroid-elasticity-check", label: "Second tweak: elasticity 1.0", passed: false, message: "Bounce still locked" }
      ]
    };

    const outcome = finishSuccessfulCodeRunDiscovery(game, activeMission, "use_hopper()\nhopper.mass = 4.0", massState, 0, []);
    assertEquals("PHASE DONE", outcome.lessonPhaseAdvance && outcome.lessonPhaseAdvance.label, "Forge mass proof should create a phase-complete cue");
    assertEquals("1 Momentum shove", outcome.lessonPhaseAdvance && outcome.lessonPhaseAdvance.title, "Phase cue should name the completed step");
    assertEquals("2 Bounce control", outcome.lessonPhaseAdvance && outcome.lessonPhaseAdvance.nextTitle, "Phase cue should name the next step");
    assertEquals("elasticity = 1.0", outcome.lessonPhaseAdvance && outcome.lessonPhaseAdvance.nextCommand, "Phase cue should carry the next runnable one-variable command");
    assertEquals("PHASE DONE: 1 Momentum shove -> 2 Bounce control", game.missionBalloon && game.missionBalloon.text, "Mission CRT should announce the phase transition");
    assertEquals(true, labels.includes("PHASE DONE!"), "Phase completion should pop an in-world label");
    assertEquals(true, bursts >= 2, "Phase completion should spawn visual particles");
    assertEquals(true, /PHASE DONE/.test(panel.innerHTML), "Discovery Pulse should render the phase chip");
    assertEquals(true, /Next: 2 Bounce control/.test(panel.innerHTML), "Discovery Pulse phase chip should preview the next phase");
    assertEquals(true, /Try <code>elasticity = 1\.0<\/code>/.test(panel.innerHTML), "Discovery Pulse phase chip should show the next runnable command");
    assertEquals(true, /STAGE NEXT/.test(panel.innerHTML), "Discovery Pulse phase chip should expose a stage-next action");
    assertEquals(true, typeof phaseRewardClick === "function", "Discovery Pulse phase action should attach a click handler");
    const restoredPhasePlanet = game.currentPlanet;
    game.currentPlanet = null;
    window.Game = game;
    phaseRewardClick();
    game.currentPlanet = restoredPhasePlanet;
    assertEquals("elasticity = 1.0", input17c1b.value, "Phase reward stage button should write the next command to the console");
    assertEquals(true, input17c1b.focused, "Phase reward stage button should focus the console");
    assertEquals("phase-reward", game.lastStagedExperiment && game.lastStagedExperiment.source, "Phase reward stage button should preserve its source");
    assertEquals("Phase reward", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Phase reward staged reminder should name the reward source");
    const explainPrompt = game.getClearExplainPrompt();
    assertEquals("EXPLAIN THE PHASE", explainPrompt.kicker, "Clear report should switch to phase-specific explanation after a phase proof");
    assertEquals("Explain 1 Momentum shove", explainPrompt.title, "Clear report should name the completed lesson phase");
    assertEquals(true, /p = m \* v/.test(explainPrompt.question), "Clear explanation should ask about the completed phase formula");
    assertEquals(true, /phase: 1 Momentum shove/.test(explainPrompt.evidence), "Notebook starter should name the completed lesson phase");
    assertEquals(true, /phase code: hopper\.mass = 4\.0/.test(explainPrompt.evidence), "Notebook starter should preserve the one obvious phase tweak");
    assertEquals(true, /phase result: First Forge gem opens/.test(explainPrompt.evidence), "Notebook starter should name the phase payoff");
    assertEquals(true, /next phase: 2 Bounce control/.test(explainPrompt.evidence), "Notebook starter should preview the second variable only after the first proof");
    assertEquals(true, /next code: elasticity = 1\.0/.test(explainPrompt.evidence), "Notebook starter should carry the next runnable phase command");

    const repeat = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.mass = 4.0", massState, 0, []);
    assertEquals(null, repeat.lessonPhaseAdvance, "Repeating the same completed phase should not replay the phase cue");
    assertEquals(1, labels.filter(label => label === "PHASE DONE!").length, "Phase cue should remain one-time per session phase");

    Compiler.env.elasticity = 1.0;
    const completeState = {
      allPassed: true,
      items: [
        { id: "asteroid-mass-check", label: "First shove: Hopper mass 4.0", passed: true, message: "Mass proof passed" },
        { id: "asteroid-elasticity-check", label: "Second tweak: elasticity 1.0", passed: true, message: "Bounce proof passed" }
      ]
    };
    const beforePathXP = game.researchXP;
    const finalOutcome = finishSuccessfulCodeRunDiscovery(game, activeMission, "elasticity = 1.0", completeState, 0, []);
    assertEquals("2 Bounce control", finalOutcome.lessonPhaseAdvance && finalOutcome.lessonPhaseAdvance.title, "Final phase cue should name the completed bounce phase");
    assertEquals("LESSON PATH COMPLETE", finalOutcome.lessonPathMastery && finalOutcome.lessonPathMastery.label, "Completing every phase should create a lesson-path capstone");
    assertEquals(8, finalOutcome.lessonPathMastery && finalOutcome.lessonPathMastery.rewardXP, "Lesson path capstone should award focused Research XP");
    assertEquals(2, finalOutcome.lessonPathMastery && finalOutcome.lessonPathMastery.phases, "Lesson path capstone should record the completed phase count");
    assertEquals(1, game.discoveryPassCounts["lesson-path:asteroid-forge-momentum"], "Lesson path capstone stores a one-time source key");
    assertEquals(true, game.researchXP >= beforePathXP + finalOutcome.lessonPathMastery.rewardXP, "Lesson path capstone adds Research XP on top of normal proof rewards");
    assertEquals("LESSON PATH COMPLETE: +8 Research XP", game.missionBalloon && game.missionBalloon.text, "Lesson path capstone should own the final Mission CRT line");
    assertEquals(true, labels.includes("PATH COMPLETE!"), "Lesson path capstone should pop an in-world completion label");
    assertEquals(true, /LESSON PATH COMPLETE/.test(panel.innerHTML), "Discovery Pulse should render the lesson path mastery chip");
    assertEquals(true, /2 phases/.test(panel.innerHTML), "Lesson path mastery chip should show the completed phase count");
    const pathCadetRecord = getCadetIdentityPreview(game);
    assertEquals(true, /Lesson Paths 1\/3 · next Hopper Engineering Shakedown/.test(pathCadetRecord.body), "Cadet Record should persist completed lesson-path progress after the capstone reward");
    const pathSourceRecord = getCadetIdentityPreview({
      researchXP: 0,
      currentPlanetIndex: 0,
      discoveredFormulaKinds: new Set(),
      discoveryPassCounts: {},
      masteryMeters: {
        0: { xp: 16, sources: { [getLessonPathMasterySourceKey("earth-gravity-wall")]: 16 } },
        1: { xp: 16, sources: { [getLessonPathMasterySourceKey("moon-canyon-jump")]: 16 } },
        5: { xp: 16, sources: { [getLessonPathMasterySourceKey("asteroid-forge-momentum")]: 16 } }
      },
      getCadetCallsign: () => "Path Cadet",
      getVillageTrustProgress: () => ({ title: "New Arrival", points: 0 })
    });
    assertEquals(true, /Lesson Paths mastered 3\/3/.test(pathSourceRecord.body), "Cadet Record should count lesson-path mastery from persisted world-mastery sources");
    assertEquals(null, pathSourceRecord.lessonPathAction, "Completed lesson paths should not leave a stale Cadet Record route action");
    const afterPathXP = game.researchXP;
    const duplicatePath = grantLessonPathMastery(game, forgeMission, finalOutcome.lessonPhaseAdvance, getMissionLessonPhaseRows(game, forgeMission), finalOutcome.pulse);
    assertEquals(null, duplicatePath, "Lesson path capstone should not replay after its source key is stored");
    assertEquals(afterPathXP, game.researchXP, "Duplicate lesson path capstone should not farm Research XP");

    document.getElementById = oldGetElementById17c1b;
    window.Game = oldWindowGame17c1b;
    ComicBubbles.pop = oldBubblePop17c1b;
    Particles.spawnBurst = oldParticleBurst17c1b;
    renderTestResult("engine-suite", "Curriculum: Forge phase completion gets visual cue", true);
  } catch (err) {
    document.getElementById = oldGetElementById17c1b;
    window.Game = oldWindowGame17c1b;
    ComicBubbles.pop = oldBubblePop17c1b;
    Particles.spawnBurst = oldParticleBurst17c1b;
    renderTestResult("engine-suite", "Curriculum: Forge phase completion gets visual cue", false, err.message);
  }

  // Test 17c2: Earth no-jump replay locks gems unless Agility is met with stock jump_power.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.currentVariant = {
      map: PLANETS[0].map,
      targetOverrides: { agility: 30 },
      constraint: { id: "earth-no-jump-power", banJumpPower: true }
    };
    game.player = { charType: 'hopper', jumpPower: 22, rocketPower: 40, mass: 1.0, spikes: false };
    game.hopperMass = 1.0;
    Compiler.env.engine = 8;
    const noJumpGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 3, 34) };
    assertEquals(true, game.isEarthHopperEngineered(), "Boosted-jump build should meet the Agility number");
    assertEquals(false, game.canCollectGem(noJumpGem), "No-jump replay should reject boosted jump_power");
    game.player.jumpPower = PLANETS[0].physics.jumpPower;
    Compiler.env.gravity = 0.35;
    assertEquals(true, game.isEarthHopperEngineered(), "Stock-jump build can still meet Agility using gravity and engine");
    assertEquals(true, game.canCollectGem(noJumpGem), "No-jump replay unlocks with stock jump and alternate levers");
    renderTestResult("engine-suite", "Objectives: Earth no-jump replay keeps jump stock", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth no-jump replay keeps jump stock", false, err.message);
  }

  // Test 17c3: Earth no-mass replay locks gems unless Agility is met at stock mass.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.currentVariant = {
      map: PLANETS[0].map,
      targetOverrides: { agility: 26 },
      constraint: { id: "earth-no-mass-cut", banMassLower: true, minMass: 2.5 }
    };
    game.player = { charType: 'hopper', jumpPower: 22, rocketPower: 40, mass: 1.0, spikes: false };
    game.hopperMass = 1.0;
    Compiler.env.engine = 8;
    Compiler.env.antigravity = 0.36;
    const noMassGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 3, 34) };
    assertEquals(true, game.isEarthHopperEngineered(), "Light build should meet the Agility number");
    assertEquals(false, game.canCollectGem(noMassGem), "No-mass replay should reject lightened Hopper");
    game.player.mass = 2.5;
    game.hopperMass = 2.5;
    assertEquals(true, game.isEarthHopperEngineered(), "Stock-mass build can still meet Agility with force and gravity");
    assertEquals(true, game.canCollectGem(noMassGem), "No-mass replay unlocks at stock mass with alternate levers");
    renderTestResult("engine-suite", "Objectives: Earth no-mass replay keeps Hopper heavy", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth no-mass replay keeps Hopper heavy", false, err.message);
  }

  // Test 17c4: Earth engine-only replay accepts only the engine knob.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.currentVariant = {
      map: PLANETS[0].map,
      targetOverrides: { agility: 7 },
      constraint: {
        id: "earth-engine-only",
        engineOnly: true,
        engineMin: 8,
        banAntigravity: true,
        banJumpPower: true,
        banMassLower: true,
        banGravityOverride: true,
        minMass: 2.5
      }
    };
    game.player = { charType: 'hopper', jumpPower: 22, rocketPower: 40, mass: 1.0, spikes: false };
    game.hopperMass = 1.0;
    Compiler.env.engine = 8;
    const engineOnlyGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 6, 34) };
    assertEquals(true, game.isEarthHopperEngineered(), "Alternate-lever build should meet the low Agility number");
    assertEquals(false, game.canCollectGem(engineOnlyGem), "Engine-only replay should reject mass/jump shortcuts");
    game.player.mass = 2.5;
    game.hopperMass = 2.5;
    game.player.jumpPower = PLANETS[0].physics.jumpPower;
    Compiler.env.antigravity = 0.1;
    assertEquals(false, game.canCollectGem(engineOnlyGem), "Engine-only replay should reject antigravity");
    Compiler.env.antigravity = 0;
    assertEquals(true, game.isEarthHopperEngineered(), "Stock-lever engine build should meet the Agility target");
    assertEquals(true, game.canCollectGem(engineOnlyGem), "Engine-only replay unlocks with engine alone");
    renderTestResult("engine-suite", "Objectives: Earth engine-only replay isolates engine", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth engine-only replay isolates engine", false, err.message);
  }

  // Test 17d: late mastery remixes add coding constraints without replacing the physics gate.
  try {
    Compiler.reset();
    const moon = new StarHopperGame();
    moon.currentPlanet = PLANETS[1];
    moon.currentPlanetIndex = 1;
    moon.currentVariant = {
      map: PLANETS[1].map,
      constraint: { id: "moon-strict-spring", springCount: 5, requireRepeatSpring: true }
    };
    moon.player = { charType: 'hopper', jumpPower: 18, rocketPower: 40, mass: 1.2, spikes: false };
    moon.spawnedSprings = [{}, {}, {}, {}, {}];
    moon.codeRunStats = createEmptyCodeRunStats();
    const moonGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: moon.getGemGateForCollectible(1, 4, 12) };
    assertEquals(false, moon.canCollectGem(moonGem), "Moon strict replay should not accept manually accumulated springs");
    moon.recordCodeRunStats({
      repeatLoops: 1,
      forLoops: 0,
      repeatIterations: 5,
      forIterations: 0,
      functionCalls: { spawn_spring: 5 },
      spawnTypes: { spring: 5 },
      repeatSpawnTypes: { spring: 5 },
      loopSpawnTypes: { spring: 5 }
    });
    assertEquals(true, moon.canCollectGem(moonGem), "Moon strict replay should unlock after repeat-spawned springs and jump tuning");

    Compiler.reset();
    const jupiter = new StarHopperGame();
    jupiter.currentPlanet = PLANETS[2];
    jupiter.currentPlanetIndex = 2;
    jupiter.currentVariant = {
      map: PLANETS[2].map,
      targetOverrides: { thrust: 46 },
      constraint: { id: "jupiter-rocket-rule", requireRocketRule: true }
    };
    jupiter.player = { charType: 'hopper', jumpPower: 8, rocketPower: 75, mass: 1.2, spikes: false };
    Compiler.env.engine = 6;
    const jupiterGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: jupiter.getGemGateForCollectible(2, 4, 12) };
    assertEquals(true, jupiter.isJupiterHopperEngineered(), "Jupiter replay build should meet the Thrust target");
    assertEquals(false, jupiter.canCollectGem(jupiterGem), "Jupiter replay gems should stay locked until the rocket event rule exists");
    Compiler.activeRules = [{ target: 'hopper.rocket_on', action: () => {} }];
    assertEquals(true, jupiter.canCollectGem(jupiterGem), "Rocket event rule plus Thrust should unlock Jupiter replay gems");

    Compiler.reset();
    const magnet = new StarHopperGame();
    magnet.currentPlanet = PLANETS[4];
    magnet.currentPlanetIndex = 4;
    magnet.currentVariant = {
      map: PLANETS[4].map,
      constraint: { id: "magnet-polarity-event", requireMagnetTouchRule: true }
    };
    magnet.player = { charType: 'hopper', jumpPower: 12, rocketPower: 50, mass: 1.2, spikes: false };
    const magnetGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: magnet.getGemGateForCollectible(4, 3, 20) };
    Compiler.activeRules = [
      { target: 'hopper.rocket_on', action: () => {} },
      { target: 'player.touching', eventArgs: [{ value: 'ice' }], action: () => {} }
    ];
    assertEquals(false, magnet.canCollectGem(magnetGem), "Generic touching rules should not satisfy the magnet polarity remix");
    Compiler.activeRules[1] = { target: 'player.touching', eventArgs: [{ value: 'magnet' }], action: () => {} };
    assertEquals(true, magnet.canCollectGem(magnetGem), "Rocket rule plus magnet-touch rule should unlock Mag-Net replay gems");

    Compiler.reset();
    const glacies = new StarHopperGame();
    glacies.currentPlanet = PLANETS[3];
    glacies.currentPlanetIndex = 3;
    glacies.currentVariant = {
      map: PLANETS[3].map,
      constraint: { id: "glacies-friction-target", minFriction: 8 }
    };
    glacies.player = { charType: 'hopper', jumpPower: 12, rocketPower: 40, mass: 1.2, spikes: true };
    const glaciesGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: glacies.getGemGateForCollectible(3, 4, 16) };
    assertEquals(false, glacies.canCollectGem(glaciesGem), "Spikes should not satisfy the numeric Glacies friction-target remix");
    Compiler.env.friction = 8;
    assertEquals(true, glacies.canCollectGem(glaciesGem), "Setting friction to the target should unlock Glacies replay gems");

    Compiler.reset();
    renderTestResult("engine-suite", "Objectives: mastery remix gates require extra coding rules", true);
  } catch (err) {
    Compiler.reset();
    renderTestResult("engine-suite", "Objectives: mastery remix gates require extra coding rules", false, err.message);
  }

  // Test 17e: Bridge syntax grants a one-time learning proof after a successful run.
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.currentVariant = { map: PLANETS[0].map };
    game.player = {
      x: 64,
      y: 96,
      w: 24,
      h: 32,
      charType: 'star',
      jumpPower: 10,
      rocketPower: 40,
      mass: 1,
      spikes: false,
      pole: 'north'
    };
    game.researchXP = 0;
    game.discoveryPassCounts = {};
    game.masteryMeters = {};
    game.discoveryLog = [];
    game.codeRunStats = createEmptyCodeRunStats();

    const res = Compiler.runCommand("useHopper()\nhopper.jumpPower = 18", game);
    assertEquals(true, res.success, "Bridge syntax command should run through the compiler");
    assertEquals(2, game.codeRunStats.bridgeAliasCount, "Game stats should merge bridge alias usage");
    assertEquals(3, game.researchXP, "First bridge alias run should award the proof XP");
    assertEquals("Syntax Bridge Proof", game.discoveryPulse && game.discoveryPulse.title, "Bridge proof should become the active Discovery Pulse");
    assertEquals("SYNTAX BRIDGE", game.discoveryPulse && game.discoveryPulse.syntaxBridgeProof && game.discoveryPulse.syntaxBridgeProof.label, "Pulse should carry the bridge proof chip data");
    assertEquals(true, game.codeConcepts && game.codeConcepts.has("ALIAS"), "Bridge syntax should collect the API Alias code concept");
    assertEquals("ALIAS", game.discoveryPulse && game.discoveryPulse.codeConceptProof && game.discoveryPulse.codeConceptProof.concept, "Bridge proof should carry the API Alias concept chip");
    assertEquals("1/5", game.discoveryPulse && game.discoveryPulse.codeConceptProof && game.discoveryPulse.codeConceptProof.progress, "API Alias concept should count toward the five-card deck");
    assertEquals(1, game.discoveryPassCounts[game.getSyntaxBridgeProofSourceKey()], "Bridge proof should be source-key gated");

    const repeat = Compiler.runCommand("hopper.rocketPower = 70", game);
    assertEquals(true, repeat.success, "A later bridge alias should still run");
    assertEquals(3, game.codeRunStats.bridgeAliasCount, "Game stats should keep accumulating bridge alias usage");
    assertEquals(3, game.researchXP, "Bridge proof should not be farmable");
    renderTestResult("engine-suite", "Rewards: Code Bridge syntax grants one-time proof", true);
  } catch (err) {
    Compiler.reset();
    renderTestResult("engine-suite", "Rewards: Code Bridge syntax grants one-time proof", false, err.message);
  }

  // Test 17f: village NPCs are placed away from locked/required gem tiles.
  try {
    const game = new StarHopperGame();
    for (let i = 0; i < PLANETS.length; i++) {
      const planet = PLANETS[i];
      if (!planet || !planet.npcs || !planet.npcs.length || !planet.map) continue;
      game.currentPlanet = planet;
      game.currentPlanetIndex = i;
      game.currentVariant = { map: planet.map };
      game.interactiveObjects = [];
      for (let r = 0; r < planet.map.length; r++) {
        for (let c = 0; c < planet.map[r].length; c++) {
          if (planet.map[r][c] !== 3) continue;
          const coin = new InteractiveObject(c * TILE_SIZE, r * TILE_SIZE, 'coin');
          coin.requiredCollectible = true;
          game.interactiveObjects.push(coin);
        }
      }
      for (const npcConf of planet.npcs) {
        const placed = game.placeNpcAwayFromCollectibles(npcConf);
        const npc = new NPC(placed);
        const roleKey = npc.getRoleVisualKey();
        assertEquals(false, game.npcOverlapsRequiredGem(placed.x, placed.y), `${planet.name} NPC ${npcConf.id} should not overlap a required gem`);
        assertEquals(false, game.npcHasUnsafePlacement(placed.x, placed.y), `${planet.name} NPC ${npcConf.id} should not stand on hazards or crates`);
        assertEquals(true, Number.isFinite(placed.caveX) && Number.isFinite(placed.caveY), `${planet.name} NPC ${npcConf.id} should have a cave home`);
        assertEquals(false, game.npcCaveHasUnsafePlacement(placed.caveX, placed.caveY), `${planet.name} NPC ${npcConf.id} cave should avoid gems, hazards, and crates`);
        assertEquals(true, roleKey !== "trader", `${planet.name} NPC ${npcConf.id} should have profession-specific visual gear`);
      }
    }

    const safeGame = new StarHopperGame();
    safeGame.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,2,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1]
      ]
    };
    safeGame.interactiveObjects = [];
    safeGame.spawnedBoxes = [new InteractiveObject(7 * TILE_SIZE, 3 * TILE_SIZE - 36, 'box')];
    const spikePlaced = safeGame.placeNpcAwayFromCollectibles({ id: 'test_spike', name: 'Test', profession: 'Tester', type: 'npc', x: 4 * TILE_SIZE, color: '#fff' });
    assertEquals(false, safeGame.npcHasUnsafePlacement(spikePlaced.x, spikePlaced.y), "NPC shifts away from spike-backed surface");
    const cratePlaced = safeGame.placeNpcAwayFromCollectibles({ id: 'test_crate', name: 'Test', profession: 'Tester', type: 'npc', x: 7 * TILE_SIZE, color: '#fff' });
    assertEquals(false, safeGame.npcHasUnsafePlacement(cratePlaced.x, cratePlaced.y), "NPC shifts away from spawned crate");
    assertEquals(false, safeGame.npcCaveHasUnsafePlacement(cratePlaced.caveX, cratePlaced.caveY), "NPC cave shifts away from spawned crates");

    const unsafeCaveNpc = new NPC({
      id: 'unsafe_cave',
      name: 'Unsafe Cave',
      profession: 'Tester',
      type: 'npc',
      x: 9 * TILE_SIZE,
      y: 3 * TILE_SIZE - 36,
      homeX: 9 * TILE_SIZE,
      homeY: 3 * TILE_SIZE - 36,
      caveX: 4 * TILE_SIZE - 10,
      caveY: 3 * TILE_SIZE - 36,
      color: '#fff'
    });
    assertEquals(true, safeGame.npcCaveHasUnsafePlacement(unsafeCaveNpc.caveX, unsafeCaveNpc.caveY), "Fixture cave starts on the spike-backed surface");
    safeGame.parkNPCInCave(unsafeCaveNpc, "night");
    assertEquals(false, safeGame.npcCaveHasUnsafePlacement(unsafeCaveNpc.caveX, unsafeCaveNpc.caveY), "Sheltering rehomes an unsafe cave before hiding the villager");
    assertEquals(false, safeGame.entityTouchesHazard(unsafeCaveNpc), "Parked cave villager is not left touching spikes");

    renderTestResult("engine-suite", "Villages: NPC placement avoids gems, spikes, crates, and unsafe caves", true);
  } catch (err) {
    renderTestResult("engine-suite", "Villages: NPC placement avoids gems, spikes, crates, and unsafe caves", false, err.message);
  }

  // Test 17f: Mastery remixes unlock only after the mission gems were fully banked.
  try {
    const game = new StarHopperGame();
    const total = game.getPlanetMissionGemTotal(0);
    assertEquals(true, total > 0, "Earth should have mission gems to gate mastery");

    game.planetClears = { 0: 1 };
    game.gemsAwardedForPlanet = { 0: Math.max(0, total - 1) };
    let plan = game.getFreshReplayPlan(0);
    assertEquals("cleanup", plan.context, "A clear with missing samples should replay the canonical cleanup run");
    assertEquals(0, plan.attempt, "Cleanup run should keep the hand-built layout");
    assertEquals(false, game.isMasteryReplayUnlocked(0), "Partial mission gems do not unlock mastery remix");

    game.gemsAwardedForPlanet = { 0: total };
    plan = game.getFreshReplayPlan(0);
    assertEquals("mastery", plan.context, "All mission gems unlock the mastery remix");
    assertEquals(1, plan.attempt, "First mastered revisit should use the first remix attempt");
    assertEquals(true, game.isMasteryReplayUnlocked(0), "Full mission gems unlock mastery replay");

    game.planetClears = { 0: 3 };
    plan = game.getFreshReplayPlan(0);
    assertEquals(3, plan.attempt, "Later mastered revisits rotate by clear count");

    const legacyStarSave = new StarHopperGame();
    legacyStarSave.planetClears = { 0: 1 };
    legacyStarSave.bestLabStars = { 0: 3 };
    assertEquals("mastery", legacyStarSave.getFreshReplayPlan(0).context, "Old 3-star saves still unlock mastery");

    const legacyMasterySave = new StarHopperGame();
    legacyMasterySave.planetClears = { 0: 1 };
    legacyMasterySave.masteryCleared = { 0: true };
    assertEquals("mastery", legacyMasterySave.getFreshReplayPlan(0).context, "Old mastery flags still unlock mastery");

    const noClear = new StarHopperGame();
    noClear.gemsAwardedForPlanet = { 0: total };
    assertEquals("first", noClear.getFreshReplayPlan(0).context, "Samples alone do not skip the first canonical clear");
    renderTestResult("engine-suite", "Mastery: remixes are gated behind full mission gems", true);
  } catch (err) {
    renderTestResult("engine-suite", "Mastery: remixes are gated behind full mission gems", false, err.message);
  }

  // Test 18: Campaign mission validators read the same derived physics used by gates/HUD.
  try {
    Compiler.reset();
    const earth = new StarHopperGame();
    earth.currentPlanet = PLANETS[0];
    earth.currentPlanetIndex = 0;
    earth.player = { charType: 'hopper', jumpPower: 18, rocketPower: 40, mass: 1.2, spikes: false, x: 1201 };
    earth.hopperMass = 1.2;
    Compiler.env.antigravity = 4.9 / GRAVITY_MPS2_PER_UNIT;
    Compiler.env.engine = 6; // derived speed = 6 / 1.2 = 5

    const earthCampaign = PLANETS[0].missions.find(m => m.id === "earth-gravity-wall");
    assertEquals(true, !!earthCampaign, "Earth should use the rich campaign mission wrapper");
    assertEquals(true, earthCampaign.validate(earth), "Earth campaign task should accept felt gravity + derived speed from engine/mass");

    Compiler.reset();
    const jupiter = new StarHopperGame();
    jupiter.currentPlanet = PLANETS[2];
    jupiter.currentPlanetIndex = 2;
    jupiter.player = { charType: 'hopper', jumpPower: 8, rocketPower: 75, mass: 1.2, spikes: false };
    jupiter.hopperMass = 1.2;
    Compiler.env.engine = 6; // derived speed = 6 / 1.2 = 5
    const jupiterCampaign = PLANETS[2].missions.find(m => m.id === "jupiter-rocket-heavy");
    assertEquals(true, !!jupiterCampaign, "Jupiter should use the rich campaign mission wrapper");
    assertEquals(true, jupiterCampaign.validate(jupiter), "Jupiter campaign task should accept derived speed from engine/mass");

    renderTestResult("engine-suite", "Objectives: campaign validators use felt gravity + derived speed", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: campaign validators use felt gravity + derived speed", false, err.message);
  }

  // Test 19: Every planet mission includes beginner curriculum scaffolding
  try {
    const missing = PlatformerMissions.filter(mission => {
      const scaffold = mission.scaffold;
      const prediction = mission.prediction;
      const badge = mission.badge;
      return !mission.beginnerConcept ||
        !scaffold ||
        !scaffold.template ||
        !scaffold.mode ||
        !Array.isArray(scaffold.slots) ||
        scaffold.slots.length === 0 ||
        !scaffold.explain ||
        !scaffold.parentPrompt ||
        !scaffold.codeIdea ||
        !scaffold.physicsIdea ||
        !scaffold.success ||
        !prediction ||
        !prediction.question ||
        !Array.isArray(prediction.options) ||
        prediction.options.length < 2 ||
        !prediction.options.some(option => option.correct) ||
        !Array.isArray(mission.resultChecks) ||
        mission.resultChecks.length === 0 ||
        !mission.resultChecks.every(check => check.id && check.label && check.success && check.waiting && typeof check.check === 'function') ||
        !badge ||
        !badge.id ||
        !badge.label ||
        !badge.icon ||
        !badge.description;
    });

    assertEquals(0, missing.length, `Missing coach metadata: ${missing.map(m => m.id).join(", ")}`);
    renderTestResult("engine-suite", "Curriculum: planet missions include Mission Coach contracts", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: planet missions include Mission Coach contracts", false, err.message);
  }

  // Test 19: Scaffold templates compile and run as KidCode, or start as intentional debug prompts
  try {
    for (const mission of PlatformerMissions) {
      Compiler.reset();
      const code = buildScaffoldCode(mission.scaffold);
      const res = Compiler.runCommand(code, makeScaffoldMockGame(mission.planetId));
      if (mission.scaffold.mode === "debug-fix") {
        assertEquals(false, res.success, `${mission.id} debug scaffold should begin with a fixable error`);
        const fixedCode = buildScaffoldCode(mission.scaffold, getCorrectedScaffoldValues(mission.scaffold));
        const fixedRes = Compiler.runCommand(fixedCode, makeScaffoldMockGame(mission.planetId));
        assertEquals(true, fixedRes.success, `${mission.id} corrected scaffold failed: ${fixedRes.msg}`);
      } else {
        assertEquals(true, res.success, `${mission.id} scaffold failed: ${res.msg}`);
      }
    }
    renderTestResult("engine-suite", "Curriculum: scaffold templates generate runnable or fixable KidCode", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: scaffold templates generate runnable or fixable KidCode", false, err.message);
  }

  // Test 20: Earth scaffold activates Hopper so the second Emerald gate unlocks
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'star', jumpPower: 10, rocketPower: 40, mass: 1, spikes: false };
    game.star = game.player;
    game.hopper = game.player;
    game.hopperMass = 2.5;

    const earthMission = PlatformerMissions.find(mission => mission.id === "earth-gravity-wall");
    const res = Compiler.runCommand(buildScaffoldCode(earthMission.scaffold), game);
    const highGem = { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 3, 34) };

    assertEquals(true, res.success, res.msg);
    assertEquals("hopper", game.player.charType, "Scaffold should activate Hopper");
    assertEquals(true, game.canCollectGem(highGem), "Full Earth scaffold should unlock high Emerald gems");
    renderTestResult("engine-suite", "Curriculum: Earth scaffold unlocks second Emerald gate", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: Earth scaffold unlocks second Emerald gate", false, err.message);
  }

  // Test 21: Result checks read actual game state after coach code runs
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'star', jumpPower: 10, rocketPower: 40, mass: 1, spikes: false };
    game.star = game.player;
    game.hopper = game.player;
    game.hopperMass = 2.5;
    game.interactiveObjects = [
      { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 6, 5) },
      { type: 'coin', requiredCollectible: true, collected: false, gemGate: game.getGemGateForCollectible(0, 3, 34) }
    ];

    const earthMission = PlatformerMissions.find(mission => mission.id === "earth-gravity-wall");
    const before = earthMission.resultChecks.map(check => check.check(game, Compiler));
    const res = Compiler.runCommand(buildScaffoldCode(earthMission.scaffold), game);
    const after = earthMission.resultChecks.map(check => check.check(game, Compiler));

    assertEquals(false, before.every(Boolean), "Earth result checks should not pass before code");
    assertEquals(true, res.success, res.msg);
    assertEquals(true, after.every(Boolean), "Earth result checks should pass after scaffold code");
    renderTestResult("engine-suite", "Curriculum: result checks reflect live game changes", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: result checks reflect live game changes", false, err.message);
  }

  // Test 22: Completed missions unlock concept badges
  try {
    Compiler.reset();
    const previousUnlock = typeof unlockCoachBadge === 'function' ? unlockCoachBadge : null;
    unlockCoachBadge = (game, fullMission) => {
      game.earnedBadges = game.earnedBadges || new Set();
      game.earnedBadges.add(fullMission.badge.id);
      return true;
    };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'hopper', jumpPower: 18, rocketPower: 40, mass: 1.2, spikes: false, x: 1201 };
    game.hopperMass = 1.2;
    Compiler.env.gravity = 0.35;
    Compiler.env.engine = 6;        // top speed = 6 / 1.2 = 5 (>= 4.8)
    game.checkMissions();

    const earthMission = PlatformerMissions.find(mission => mission.id === "earth-gravity-wall");
    assertEquals(true, game.completedMissions.has(earthMission.id), "Earth mission should be complete");
    assertEquals(true, game.earnedBadges.has(earthMission.badge.id), "Earth concept badge should unlock");

    if (previousUnlock) {
      unlockCoachBadge = previousUnlock;
    } else if (typeof window !== 'undefined') {
      delete window.unlockCoachBadge;
    }
    renderTestResult("engine-suite", "Curriculum: mission completion unlocks concept badges", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: mission completion unlocks concept badges", false, err.message);
  }

  // Test 22a: Locked notebook badges preview the next learning target instead of hiding it.
  const oldGetElementById22badge = document.getElementById;
  const oldCreateElement22badge = document.createElement;
  try {
    const makeBadgeEl = () => {
      let html = "";
      return {
        className: "",
        textContent: "",
        children: [],
        style: {},
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; this.children = []; },
        appendChild(child) { this.children.push(child); return child; },
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
      };
    };
    const list = makeBadgeEl();
    document.getElementById = (id) => id === "badge-shelf-list" ? list : null;
    document.createElement = () => makeBadgeEl();

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.earnedBadges = new Set();
    game.masteryMeters = {};
    const earthMission = PlatformerMissions.find(mission => mission.id === "earth-gravity-wall");

    updateBadgeShelf(game);
    const lockedCard = list.children[0];
    assertEquals(true, !!lockedCard, "Badge shelf should render mission badges");
    assertEquals(true, /active/.test(lockedCard.className), "Current locked badge should be marked active");
    assertEquals(true, /NEXT BADGE/.test(lockedCard.innerHTML), "Active locked badge should name the next reward state");
    assertEquals(true, new RegExp(earthMission.title).test(lockedCard.innerHTML), "Locked preview should name the next mission");
    assertEquals(true, /Change one number/.test(lockedCard.innerHTML), "Locked preview should show the beginner concept");
    assertEquals(true, /Activate Hopper/.test(lockedCard.innerHTML), "Locked preview should show the scaffold code cue");

    game.completedMissions.add(earthMission.id);
    game.earnedBadges.add(earthMission.badge.id);
    updateBadgeShelf(game);
    const earnedCard = list.children[0];
    assertEquals(true, /earned/.test(earnedCard.className), "Completed badge should render as earned");
    assertEquals(true, /EARNED/.test(earnedCard.innerHTML), "Completed badge should show earned state");
    assertEquals(true, new RegExp(earthMission.badge.description).test(earnedCard.innerHTML), "Earned badge should restore the reward description");
    assertEquals(false, /NEXT BADGE/.test(earnedCard.innerHTML), "Earned badge should not keep the locked next-state label");

    document.getElementById = oldGetElementById22badge;
    document.createElement = oldCreateElement22badge;
    renderTestResult("engine-suite", "Curriculum: badge shelf previews locked goals", true);
  } catch (err) {
    document.getElementById = oldGetElementById22badge;
    document.createElement = oldCreateElement22badge;
    renderTestResult("engine-suite", "Curriculum: badge shelf previews locked goals", false, err.message);
  }

  // Test 22a1: Science Passport turns cleared worlds into lesson stamps with the next concept visible.
  const oldGetElementById22passport = document.getElementById;
  const oldWindowGame22passport = window.Game;
  const oldSwitchMainMode22passport = switchMainMode;
  try {
    const panel = { innerHTML: "" };
    const pulsePanel = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll() { return []; }
    };
    document.getElementById = (id) => {
      if (id === "science-passport-panel") return panel;
      if (id === "discovery-pulse") return pulsePanel;
      return null;
    };
    const game = new StarHopperGame();
    game.currentPlanetIndex = 2;
    game.currentPlanet = PLANETS[2];
    game.player = { x: 80, y: 120, w: 24, h: 32 };
    game.researchXP = 10;
    game.planetClears = { 0: 1, 1: 1 };
    game.bestLabStars = { 0: 3, 1: 2 };
    game.masteryMeters = {
      0: { xp: 80, badges: ["scout"], sources: { stars: 30 } },
      1: { xp: 20, badges: [], sources: { clear: 20 } }
    };

    updateSciencePassport(game);
    const totalPassportWorlds = getPassportWorlds().length;
    assertEquals(true, new RegExp(`2\\/${totalPassportWorlds} planet stamps`).test(panel.innerHTML), "Passport should summarize earned planet stamps");
    assertEquals(true, /Next stamp: Jupiter/.test(panel.innerHTML), "Passport should name the next uncleared world");
    assertEquals(true, /CADET SCIENCE PASSPORT/.test(panel.innerHTML), "Passport should render a cadet passport header");
    assertEquals(true, /Earth \(Base Camp\)/.test(panel.innerHTML), "Passport should include the first stamped planet");
    assertEquals(true, /STAMPED/.test(panel.innerHTML), "Cleared worlds should become stamped entries");
    assertEquals(true, /3\/3 Lab Stars/.test(panel.innerHTML), "Stamped worlds should show best lab-star quality");
    assertEquals(true, /Signal Scout · 80 XP/.test(panel.innerHTML), "Stamped worlds should show world mastery depth");
    assertEquals(true, /Jupiter \(Gas Giant Core\)/.test(panel.innerHTML), "Passport should include the active next planet");
    assertEquals(true, /NOW/.test(panel.innerHTML), "Current uncleared world should be marked as the active passport target");
    assertEquals(true, /Mass resists acceleration/.test(panel.innerHTML), "Passport should show the next science concept");
    assertEquals(true, /Activate and tune Hopper/.test(panel.innerHTML), "Passport should show a concrete code cue for the next stamp");
    assertEquals(true, /RUN NEXT STAMP/.test(panel.innerHTML), "Passport should expose a direct launch action");
    assertEquals(true, /data-level="2"/.test(panel.innerHTML), "Passport launch action should target the next unstamped world");
    assertEquals(true, /runSciencePassportAction\(2\)/.test(panel.innerHTML), "Passport launch action should call the run helper");
    const action = getSciencePassportAction(game);
    assertEquals("RUN NEXT STAMP", action.label, "Passport action should name the next stamp loop");
    assertEquals(2, action.levelIndex, "Passport action should target Jupiter after Earth and Moon stamps");
    const passportCadetRecord = getCadetIdentityPreview(game);
    assertEquals(true, new RegExp(`Passport 2\\/${totalPassportWorlds} stamps · next Jupiter`).test(passportCadetRecord.body), "Cadet Record should mirror Science Passport stamp progress");
    const startedLevels22passport = [];
    const modeSwitches22passport = [];
    window.Game = { startLevel: (level) => { startedLevels22passport.push(level); } };
    switchMainMode = (mode) => { modeSwitches22passport.push(mode); };
    assertEquals(true, runSciencePassportAction(2), "Passport action helper should launch the target world");
    assertEquals(2, startedLevels22passport[0], "Passport action helper should call startLevel with the target world");
    assertEquals("terminal", modeSwitches22passport[0], "Passport action should return the UI to the playable terminal");
    game.planetClears[2] = 1;
    const stamp = game.grantSciencePassportStamp(2, { stars: 2, maxStars: 3 }, { previousClears: 0 });
    assertEquals("PASSPORT STAMP", stamp && stamp.label, "First campaign clear should grant a Passport Stamp reward");
    assertEquals(15, game.researchXP, "Passport Stamp should add a small one-time Research XP reward");
    assertEquals("Jupiter (Gas Giant Core)", stamp && stamp.planetName, "Passport Stamp should name the stamped world");
    assertEquals(true, /Mass resists acceleration/.test(stamp && stamp.concept), "Passport Stamp should carry the planet science concept");
    assertEquals(3, stamp && stamp.stampCount, "Passport Stamp should count the newly stamped world");
    assertEquals(true, !!game.lastSciencePassportStampEffect, "Passport Stamp should create an inspectable visual effect");
    assertEquals(true, /PASSPORT STAMP \+5 XP/.test(pulsePanel.innerHTML), "Discovery Pulse should render the Passport Stamp chip");
    assertEquals(true, /3\/6 stamps/.test(pulsePanel.innerHTML), "Discovery Pulse should show passport progress after the stamp");
    assertEquals("PASSPORT STAMP: Jupiter (Gas Giant Core) +5 Research XP", game.missionBalloon && game.missionBalloon.text, "Passport Stamp should write a Mission CRT reward line");
    assertEquals(null, game.grantSciencePassportStamp(2, { stars: 2, maxStars: 3 }, { previousClears: 0 }), "Passport Stamp should not repeat for the same world");
    const replayStamp = new StarHopperGame();
    replayStamp.currentPlanetIndex = 2;
    replayStamp.currentPlanet = PLANETS[2];
    replayStamp.planetClears = { 0: 1, 1: 1, 2: 2 };
    assertEquals(null, replayStamp.grantSciencePassportStamp(2, { stars: 1, maxStars: 3 }, { previousClears: 1 }), "Replay clears should not grant a fresh Passport Stamp");
    window.Game = oldWindowGame22passport;
    switchMainMode = oldSwitchMainMode22passport;
    document.getElementById = oldGetElementById22passport;
    renderTestResult("engine-suite", "Curriculum: Science Passport shows planet lesson stamps", true);
  } catch (err) {
    window.Game = oldWindowGame22passport;
    switchMainMode = oldSwitchMainMode22passport;
    document.getElementById = oldGetElementById22passport;
    renderTestResult("engine-suite", "Curriculum: Science Passport shows planet lesson stamps", false, err.message);
  }

  // Test 22a1b: Village Almanac makes villager requests and relationship pacts reviewable in the Log.
  const oldGetElementById22village = document.getElementById;
  try {
    const panel = { innerHTML: "" };
    document.getElementById = (id) => id === "village-almanac-panel" ? panel : null;
    const game = new StarHopperGame();
    game.currentPlanetIndex = 3;
    game.currentPlanet = PLANETS[3];
    game.gemsWallet = { emerald: 0, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
    game.purchasedTrades = new Set(["glacies_ice_spikes", "glacies_light_alloy"]);
    game.villageTrust = {
      3: { points: 7, badges: ["friend", "ally"], sources: { "village-trade:3:cryo:glacies_ice_spikes": 3, "village-rescue:3:cryo": 4 } }
    };

    updateVillageAlmanac(game);
    const totalVillageWorlds = getVillageAlmanacWorlds().length;
    assertEquals(true, new RegExp(`1\\/${totalVillageWorlds} villages helped`).test(panel.innerHTML), "Village Almanac should summarize trusted villages");
    assertEquals(true, /VILLAGE STORYLINE/.test(panel.innerHTML), "Village Almanac should render a storyline header");
    assertEquals(true, /Glacies \(Ice Comet\): Mix Calming Lotion/.test(panel.innerHTML), "Current village should own the resume request");
    assertEquals(true, /CURRENT VILLAGE/.test(panel.innerHTML), "Current village card should be marked active");
    assertEquals(true, /Gripkeeper Cryo \/\/ Gripkeeper/.test(panel.innerHTML), "Village card should name villager roles");
    assertEquals(true, /Cave Ally · 7 trust/.test(panel.innerHTML), "Village card should show the trust tier and points");
    assertEquals(true, /Collect 1 more Violet Ice/.test(panel.innerHTML), "Village request should show the missing gemstone target");
    assertEquals(true, /calming lotion unlocked/.test(panel.innerHTML), "Village request should show the tool payoff");
    assertEquals(true, /QUEST 2\/3/.test(panel.innerHTML), "Village Almanac should show per-world village quest-chain progress");
    assertEquals(true, /Next: Guard pact/.test(panel.innerHTML), "Village Almanac should show the next village quest-chain step");
    assertEquals(true, /scared -&gt; pet -&gt; guard/.test(panel.innerHTML), "Village Almanac should show the next quest formula");
    assertEquals(true, /OK Trade/.test(panel.innerHTML) && /OK Rescue/.test(panel.innerHTML) && /NEXT Guard/.test(panel.innerHTML), "Village Almanac should mark completed and pending chain steps");
    assertEquals(true, /Guardian Pact: train a pet guard or protect the village \(AI state: scared -&gt; pet -&gt; guard\)/.test(panel.innerHTML), "Village card should show the next relationship pact and coding concept");
    assertEquals(true, /VILLAGE WATCH/.test(panel.innerHTML), "Village worlds without trades should fall back to safety-state story copy");
    document.getElementById = oldGetElementById22village;
    renderTestResult("engine-suite", "Curriculum: Village Almanac shows requests and pacts", true);
  } catch (err) {
    document.getElementById = oldGetElementById22village;
    renderTestResult("engine-suite", "Curriculum: Village Almanac shows requests and pacts", false, err.message);
  }

  // Test 22a1c: AI State Deck turns village and pet behavior proofs into collectible lesson cards.
  const oldGetElementById22aiDeck = document.getElementById;
  const oldSwitchMainMode22aiDeck = switchMainMode;
  try {
    const panel = { innerHTML: "" };
    const pulsePanel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => {
      if (id === "ai-state-deck-panel") return panel;
      if (id === "discovery-pulse") return pulsePanel;
      return null;
    };

    const partialGame = new StarHopperGame();
    partialGame.villageTrust = {
      0: { points: 3, sources: { "village-trade:0:geary:engine_1": 3 } }
    };
    partialGame.masteryMeters = {};
    partialGame.discoveryPassCounts = {};
    let progress = getAIStateDeckProgress(partialGame);
    assertEquals(1, progress.earnedCount, "AI State Deck should count village trade proof from trust sources");
    assertEquals("shelter-loop", progress.nextCard && progress.nextCard.id, "After trade proof, the next AI card should ask for shelter/rescue evidence");

    updateAIStateDeck(partialGame);
    assertEquals(true, /1\/5 AI states logged/.test(panel.innerHTML), "AI State Deck should render partial collection progress");
    assertEquals(true, /LOGGED/.test(panel.innerHTML) && /Trade Flow/.test(panel.innerHTML), "AI State Deck should mark the trade-flow card logged");
    assertEquals(true, /NEXT STATE/.test(panel.innerHTML) && /Shelter Loop/.test(panel.innerHTML), "AI State Deck should mark the next unearned behavior card");
    assertEquals(true, /state = samples -&gt; trade -&gt; tool/.test(panel.innerHTML), "AI State Deck should show the trade state formula");
    assertEquals(true, /Clear mob danger so a villager leaves the cave/.test(panel.innerHTML), "AI State Deck should show the next rescue action");
    assertEquals(true, /RUN RESCUE/.test(panel.innerHTML), "AI State Deck should expose a direct next-state action");
    assertEquals(true, /data-state="shelter-loop"/.test(panel.innerHTML), "AI State Deck action should target the next missing state");

    const rescueStarts = [];
    const rescueModes = [];
    const rescueGame = {
      currentPlanetIndex: 0,
      survivalMode: false,
      startLevel: (level) => rescueStarts.push(level),
      toggleSurvival: () => { rescueGame.survivalMode = true; }
    };
    switchMainMode = (mode) => rescueModes.push(mode);
    assertEquals(true, runAIStateDeckAction("shelter-loop", rescueGame), "AI State Deck rescue action should launch a playable proof route");
    assertEquals(1, rescueStarts[0], "Rescue action should prefer a non-Earth village to avoid night blocking the proof");
    assertEquals(true, rescueGame.survivalMode, "Rescue action should enable Survival so mobs can trigger cave shelter");
    assertEquals("terminal", rescueModes[0], "AI State Deck action should return to the playable terminal");
    assertEquals("shelter-loop", rescueGame.activeAIStateRun && rescueGame.activeAIStateRun.cardId, "AI State Deck route should remember the active in-run proof");

    const petPrep = new StarHopperGame();
    petPrep.unlockedTools = new Set();
    let petAction = getAIStateDeckAction(petPrep, "pet-pact");
    assertEquals("GET LOTION", petAction && petAction.label, "Pet card action should route to the lotion trade before the tool is unlocked");
    assertEquals(false, !!(petAction && petAction.enableSurvival), "Missing-lotion pet route should not start Survival yet");
    petPrep.unlockedTools.add("taming_lotion");
    petAction = getAIStateDeckAction(petPrep, "pet-pact");
    assertEquals("TAME PET", petAction && petAction.label, "Pet card action should switch to taming once lotion is unlocked");
    assertEquals(true, !!(petAction && petAction.enableSurvival), "Taming route should start Survival for scared mobs");

    const completeGame = new StarHopperGame();
    completeGame.villageTrust = {
      3: {
        points: 12,
        sources: {
          "village-trade:3:cryo:glacies_ice_spikes": 3,
          "village-rescue:3:cryo": 4
        }
      }
    };
    completeGame.masteryMeters = {
      3: {
        xp: 40,
        sources: {
          "pet:tame:3": 7,
          "pet:guard:3": 10
        }
      }
    };
    completeGame.discoveryPassCounts = { "village-pact:3:guardian": 1 };
    progress = getAIStateDeckProgress(completeGame);
    assertEquals(5, progress.earnedCount, "AI State Deck should count trade, rescue, pet, guard, and guardian proofs");
    assertEquals(true, progress.complete, "AI State Deck should complete after every behavior proof is present");
    const completeCadetRecord = getCadetIdentityPreview(completeGame);
    assertEquals(true, /AI Mastered 5\/5 states/.test(completeCadetRecord.body), "Cadet Record should celebrate completed AI State Deck mastery");
    assertEquals(null, completeCadetRecord.aiAction, "Completed AI State Deck should not leave a stale Cadet Record route action");
    const sourceKeyCadetRecord = getCadetIdentityPreview({
      researchXP: 0,
      currentPlanetIndex: 0,
      discoveredFormulaKinds: new Set(),
      discoveryPassCounts: {
        "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
      },
      getCadetCallsign: () => "Source Cadet",
      getVillageTrustProgress: () => ({ title: "Trading Friend", points: 3 })
    });
    assertEquals(true, /Future Lab: Source Key complete/.test(sourceKeyCadetRecord.body), "Cadet Record should carry the completed Future Lab source-key portfolio state");

    updateAIStateDeck(completeGame);
    assertEquals(true, /5\/5 AI states logged/.test(panel.innerHTML), "Complete AI State Deck should render full progress");
    assertEquals(true, /All village AI behavior cards logged/.test(panel.innerHTML), "Complete AI State Deck should stop asking for a next card");
    assertEquals(true, /Pet Pact/.test(panel.innerHTML) && /wild -&gt; scared -&gt; pet/.test(panel.innerHTML), "AI State Deck should include the taming hidden-behavior card");
    assertEquals(true, /Guard Mode/.test(panel.innerHTML) && /follow -&gt; protect/.test(panel.innerHTML), "AI State Deck should include the pet guard behavior card");
    assertEquals(true, /Guardian Pact/.test(panel.innerHTML) && /trust -&gt; guardian/.test(panel.innerHTML), "AI State Deck should include the long village arc card");
    assertEquals(false, /ai-state-deck-btn/.test(panel.innerHTML), "Complete AI State Deck should not render an unnecessary launch button");

    const masteryGame = new StarHopperGame();
    masteryGame.currentPlanetIndex = 3;
    masteryGame.currentPlanet = PLANETS[3];
    masteryGame.researchXP = 0;
    masteryGame.villageTrust = {
      3: {
        points: 12,
        sources: {
          "village-trade:3:cryo:glacies_ice_spikes": 3,
          "village-rescue:3:cryo": 4
        }
      }
    };
    masteryGame.masteryMeters = {
      3: {
        xp: 40,
        sources: {
          "pet:tame:3": 7,
          "pet:guard:3": 10
        }
      }
    };
    masteryGame.discoveryPassCounts = { "village-pact:3:guardian": 1 };
    masteryGame.activeAIStateRun = { cardId: "guardian-pact", levelIndex: 3, label: "BUILD TRUST" };
    const masteryPulse = {
      formula: "state deck = complete",
      insight: "All village behavior states are logged as evidence.",
      missionTitle: "AI State Deck",
      passed: 1,
      total: 1,
      progressLabel: "5/5 states",
      rewardXP: 0
    };
    const completedProof = masteryGame.completeActiveAIStateRun("guardian-pact", masteryPulse);
    assertEquals(true, completedProof && completedProof.complete, "Completing the final active AI proof should mark the deck complete");
    assertEquals("AI DECK MASTERED", completedProof && completedProof.deckMastery && completedProof.deckMastery.label, "Final AI proof should add the deck mastery capstone");
    assertEquals("AI DECK MASTERED", masteryPulse.aiStateDeckMastery && masteryPulse.aiStateDeckMastery.label, "Deck mastery should attach a Discovery Pulse chip");
    assertEquals(9, masteryGame.researchXP, "AI State Deck mastery should grant Research XP once");
    assertEquals(52, masteryGame.getWorldMasteryProgress(3).xp, "AI State Deck mastery should feed world mastery once");
    assertEquals(1, masteryGame.discoveryPassCounts["ai-state-deck-mastery"], "AI deck mastery stores a duplicate guard source");
    assertEquals("AI STATE DECK", masteryGame.missionBalloon && masteryGame.missionBalloon.title, "AI deck mastery should write a Mission CRT reward line");
    masteryGame.discoveryPulse = masteryPulse;
    updateDiscoveryPulse(masteryGame);
    assertEquals(true, /AI DECK MASTERED \+9 XP/.test(pulsePanel.innerHTML), "Discovery Pulse should render the AI deck mastery chip");
    assertEquals(true, /AI STATE DECK COMPLETE/.test(pulsePanel.innerHTML), "Discovery Pulse should show the AI deck completion unlock card");
    masteryGame.activeAIStateRun = { cardId: "guardian-pact", levelIndex: 3, label: "BUILD TRUST" };
    const repeatPulse = { formula: "state deck = complete", insight: "Repeat proof.", missionTitle: "AI State Deck", passed: 1, total: 1, rewardXP: 0 };
    const repeatProof = masteryGame.completeActiveAIStateRun("guardian-pact", repeatPulse);
    assertEquals(undefined, repeatProof && repeatProof.deckMastery, "Repeated final AI proof should not repeat the deck mastery capstone");
    assertEquals(undefined, repeatPulse.aiStateDeckMastery, "Repeated final AI proof should not add a second mastery chip");
    assertEquals(9, masteryGame.researchXP, "Repeated AI deck mastery should not farm Research XP");

    switchMainMode = oldSwitchMainMode22aiDeck;
    document.getElementById = oldGetElementById22aiDeck;
    renderTestResult("engine-suite", "Curriculum: AI State Deck collects village behavior proofs", true);
  } catch (err) {
    switchMainMode = oldSwitchMainMode22aiDeck;
    document.getElementById = oldGetElementById22aiDeck;
    renderTestResult("engine-suite", "Curriculum: AI State Deck collects village behavior proofs", false, err.message);
  }

  // Test 22a1d: Code Concept Deck makes programming ideas reviewable in the Log.
  const oldGetElementById22codeDeck = document.getElementById;
  const oldCreateElement22codeDeck = document.createElement;
  const oldWindowGame22codeDeck = window.Game;
  const oldSwitchMainMode22codeDeck = switchMainMode;
  try {
    const panel = {
      innerHTML: "",
      querySelectorAll() { return []; }
    };
    const startQueuePanel22codeDeck = {
      innerHTML: "",
      style: {},
      classList: {
        toggle() {},
        contains() { return false; }
      }
    };
    const radarButton = { dataset: {}, textContent: "", title: "" };
    const inputEl = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => {
      if (id === "code-concept-deck-panel") return panel;
      if (id === "start-objective-queue") return startQueuePanel22codeDeck;
      if (id === "start-mission-radar-btn") return radarButton;
      if (id === "console-input") return inputEl;
      return null;
    };
    const game = new StarHopperGame();
    game.codeConcepts = new Set(["ASSIGN"]);
    updateResearchProgress(game);
    assertEquals(true, /Code Concepts 1\/5/.test(panel.innerHTML), "Code Concept Deck should render partial collection progress");
    assertEquals(true, /Next: Loop/.test(panel.innerHTML), "Code Concept Deck should name the next programming idea");
    assertEquals(true, /NEXT CODING IDEA/.test(panel.innerHTML) && /Loop/.test(panel.innerHTML), "Code Concept Deck should render a next-concept contract");
    assertEquals(true, /repeat 3 \{ spawn_block\(\) \}/.test(panel.innerHTML), "Code Concept Deck should expose a runnable sample for the next idea");
    assertEquals(true, /LEARN/.test(panel.innerHTML) && /Repeat count makes tools/.test(panel.innerHTML), "Code Concept Deck should explain the learning idea");
    assertEquals(true, /CODE/.test(panel.innerHTML) && /Repeat a helper/.test(panel.innerHTML), "Code Concept Deck should name the coding move");
    assertEquals(true, /WIN/.test(panel.innerHTML) && /Build the route/.test(panel.innerHTML), "Code Concept Deck should name the game payoff");
    assertEquals(true, /API Alias/.test(panel.innerHTML) && /Use bridge syntax/.test(panel.innerHTML), "Code Concept Deck should include the bridge alias lesson card");
    assertEquals(true, /Assignment/.test(panel.innerHTML) && /collected/.test(panel.innerHTML), "Code Concept Deck should mark collected ideas");
    assertEquals(true, /Loop/.test(panel.innerHTML) && /next concept/.test(panel.innerHTML), "Code Concept Deck should mark the next card");
    assertEquals(true, /STAGE NEXT/.test(panel.innerHTML), "Code Concept Deck should expose a stage action for the next concept");
    const cadetRecord = getCadetIdentityPreview(game);
    assertEquals(true, /Code Concepts 1\/5 · next Loop/.test(cadetRecord.body), "Cadet Record should summarize Code Concept Deck progress");
    const target = getActiveCodeConceptTarget(game);
    assertEquals("LOOP", target && target.concept, "Code Concept target should identify the next missing idea");
    assertEquals("repeat 3 { spawn_block() }", target && target.command, "Code Concept target should carry the runnable sample");
    assertEquals("Repeat count makes tools", target && target.learn, "Code Concept target should carry the learning idea");
    assertEquals("Repeat a helper", target && target.codeMove, "Code Concept target should carry the coding move");
    assertEquals("Build the route", target && target.payoff, "Code Concept target should carry the game payoff");
    assertEquals("Reward: code concept card", target && target.reward, "Code Concept target should name the next deck payoff");
    assertEquals(1, target && target.count, "Code Concept target should expose collected count");
    assertEquals(5, target && target.total, "Code Concept target should expose deck total");

    const queueGame = new StarHopperGame();
    queueGame.state = "playing";
    queueGame.currentPlanet = { name: "Code Lab", missions: [] };
    queueGame.currentPlanetIndex = 0;
    queueGame.completedMissions = new Set();
    queueGame.discoveryPassCounts = {};
    queueGame.codeConcepts = new Set(["ASSIGN"]);
    const queue = getRunObjectiveQueue(queueGame);
    assertEquals("CODE CONCEPT", queue[0] && queue[0].label, "Run objective queue should surface the next Code Concept when no immediate lab step is ahead");
    assertEquals("Collect Loop", queue[0] && queue[0].title, "Run objective queue should name the next Code Concept target");
    assertEquals("STAGE IDEA", queue[0] && queue[0].cta, "Run objective queue should expose a stage action for the next Code Concept");
    assertEquals("code-concept-target", queue[0] && queue[0].source, "Run objective queue should preserve Code Concept source metadata");
    assertEquals(1, queue[0] && queue[0].progress && queue[0].progress.value, "Run objective queue should carry Code Concept pip progress");
    assertEquals(5, queue[0] && queue[0].progress && queue[0].progress.target, "Run objective queue should carry Code Concept pip total");
    assertEquals("Repeat count makes tools", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.learn, "Run objective queue should carry Code Concept learning chip text");
    assertEquals("Repeat a helper", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.code, "Run objective queue should carry Code Concept coding chip text");
    assertEquals("Build the route", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.win, "Run objective queue should carry Code Concept payoff chip text");
    assertEquals("Code idea -> concept card", getObjectiveLearningContract(queue[0]), "Run objective queue should name the learning contract behind a Code Concept");
    assertEquals(true, /LEARN/.test(renderObjectiveLearningContract(queue[0])) && /Repeat count makes tools/.test(renderObjectiveLearningContract(queue[0])), "Code Concept learning contract should render the LEARN chip");
    assertEquals(true, /CODE/.test(renderObjectiveLearningContract(queue[0])) && /Repeat a helper/.test(renderObjectiveLearningContract(queue[0])), "Code Concept learning contract should render the CODE chip");
    assertEquals(true, /WIN/.test(renderObjectiveLearningContract(queue[0])) && /Build the route/.test(renderObjectiveLearningContract(queue[0])), "Code Concept learning contract should render the WIN chip");

    const startQueue = getStartObjectiveQueue(queueGame, { quest: {}, resumeCue: null, cadetPreview: {} });
    assertEquals("CODE CONCEPT", startQueue[0] && startQueue[0].label, "Start objective queue should surface the next Code Concept when higher-priority routes are absent");
    assertEquals("Collect Loop", startQueue[0] && startQueue[0].title, "Start objective queue should name the next coding idea");
    assertEquals("STAGE IDEA", startQueue[0] && startQueue[0].cta, "Start objective queue should expose a Code Concept stage action");
    assertEquals("code-concept", startQueue[0] && startQueue[0].action, "Start objective queue should keep Code Concept action metadata");
    assertEquals("code-concept", startQueue[0] && startQueue[0].progress && startQueue[0].progress.mode, "Start objective Code Concept should carry progress metadata");
    assertEquals("Repeat count makes tools", startQueue[0] && startQueue[0].lessonSteps && startQueue[0].lessonSteps.learn, "Start objective Code Concept should keep learning chip metadata");
    updateStartObjectiveQueue(queueGame, startQueue);
    assertEquals(true, /start-objective-code/.test(startQueuePanel22codeDeck.innerHTML), "Start objective queue should render a command chip");
    assertEquals(true, /start-objective-contract objective-learning-steps/.test(startQueuePanel22codeDeck.innerHTML), "Start objective queue should render the Code Concept learning chips");
    assertEquals(true, /LEARN/.test(startQueuePanel22codeDeck.innerHTML) && /Repeat count makes tools/.test(startQueuePanel22codeDeck.innerHTML), "Start objective learning chips should explain the coding idea");
    assertEquals(true, /CODE/.test(startQueuePanel22codeDeck.innerHTML) && /Repeat a helper/.test(startQueuePanel22codeDeck.innerHTML), "Start objective learning chips should name the coding move");
    assertEquals(true, /WIN/.test(startQueuePanel22codeDeck.innerHTML) && /Build the route/.test(startQueuePanel22codeDeck.innerHTML), "Start objective learning chips should name the game payoff");
    assertEquals(true, /repeat 3 \{ spawn_block\(\) \}/.test(startQueuePanel22codeDeck.innerHTML), "Start objective command chip should show the Code Concept sample");
    assertEquals(true, /start-objective-progress code-concept/.test(startQueuePanel22codeDeck.innerHTML), "Start objective queue should render Code Concept progress pips");
    assertEquals(true, /1\/5 ideas/.test(startQueuePanel22codeDeck.innerHTML), "Start objective Code Concept progress should show idea count");
    queueGame.lastStartObjectiveQueue = startQueue;
    const startQueueStarts = [];
    const startQueueModes = [];
    queueGame.startLevel = (level) => { startQueueStarts.push(level); };
    switchMainMode = (mode) => { startQueueModes.push(mode); };
    window.Game = queueGame;
    inputEl.value = "";
    inputEl.focused = false;
    assertEquals(true, runStartObjectiveQueueAction(1), "Start objective Code Concept action should dispatch");
    assertEquals(0, startQueueStarts[0], "Start objective Code Concept action should launch the current world");
    assertEquals("terminal", startQueueModes[0], "Start objective Code Concept action should return to the terminal");
    assertEquals("repeat 3 { spawn_block() }", inputEl.value, "Start objective Code Concept action should stage the sample command");
    assertEquals(true, inputEl.focused, "Start objective Code Concept action should focus the terminal");
    assertEquals("start-code-concept", queueGame.lastStagedExperiment && queueGame.lastStagedExperiment.source, "Start objective Code Concept action should preserve its source");

    const clearCodeQueue = queueGame.getClearObjectiveQueue({ codeConceptTarget: target });
    assertEquals("CODE CONCEPT", clearCodeQueue[0] && clearCodeQueue[0].label, "Clear objective queue should surface Code Concept follow-ups");
    assertEquals("Repeat count makes tools", clearCodeQueue[0] && clearCodeQueue[0].lessonSteps && clearCodeQueue[0].lessonSteps.learn, "Clear objective Code Concept should keep learning chip metadata");
    const clearCodeContract = renderObjectiveLearningContract(clearCodeQueue[0], "clear-objective-contract");
    assertEquals(true, /clear-objective-contract objective-learning-steps/.test(clearCodeContract), "Clear objective Code Concept should render learning chips");
    assertEquals(true, /Repeat count makes tools/.test(clearCodeContract) && /Build the route/.test(clearCodeContract), "Clear objective Code Concept chips should keep learn and win text");

    const chainQueueGame = new StarHopperGame();
    chainQueueGame.currentPlanet = { name: "Chain Lab", missions: [] };
    chainQueueGame.currentPlanetIndex = 2;
    chainQueueGame.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "CALL", "ALIAS"]);
    chainQueueGame.discoveryPulse = { combo: 2, rewardXP: 5, formula: "engine changed", insight: "Fresh proof." };
    chainQueueGame.lastScienceDelta = {
      nextExperiment: {
        title: "Raise engine again",
        body: "Change one fresh variable to keep the lab chain alive.",
        command: "hopper.engine = 7"
      }
    };
    const chainStartQueue = getStartObjectiveQueue(chainQueueGame, { quest: {}, resumeCue: null, cadetPreview: {} });
    assertEquals("LAB CHAIN x2", chainStartQueue[0] && chainStartQueue[0].label, "Start objective queue should surface active lab-chain targets");
    assertEquals("Raise engine again", chainStartQueue[0] && chainStartQueue[0].title, "Start lab-chain queue should name the next experiment");
    assertEquals("STAGE CHAIN", chainStartQueue[0] && chainStartQueue[0].cta, "Start lab-chain queue should expose a stage action");
    assertEquals("lab-chain", chainStartQueue[0] && chainStartQueue[0].action, "Start lab-chain queue should keep action metadata");
    assertEquals("lab-chain", chainStartQueue[0] && chainStartQueue[0].progress && chainStartQueue[0].progress.mode, "Start lab-chain queue should carry progress metadata");
    assertEquals("Raise engine again", chainStartQueue[0] && chainStartQueue[0].lessonSteps && chainStartQueue[0].lessonSteps.learn, "Start lab-chain queue should teach the fresh target");
    assertEquals("hopper.engine = 7", chainStartQueue[0] && chainStartQueue[0].lessonSteps && chainStartQueue[0].lessonSteps.code, "Start lab-chain queue should teach the salient code line");
    assertEquals("Next new progress can reach x3", chainStartQueue[0] && chainStartQueue[0].lessonSteps && chainStartQueue[0].lessonSteps.win, "Start lab-chain queue should teach the combo payoff");
    updateStartObjectiveQueue(chainQueueGame, chainStartQueue);
    assertEquals(true, /start-objective-code/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain queue should render a command chip");
    assertEquals(true, /LEARN/.test(startQueuePanel22codeDeck.innerHTML) && /Raise engine again/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain queue should render the LEARN chip");
    assertEquals(true, /CODE/.test(startQueuePanel22codeDeck.innerHTML) && /hopper\.engine = 7/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain queue should render the CODE chip");
    assertEquals(true, /WIN/.test(startQueuePanel22codeDeck.innerHTML) && /Next new progress can reach x3/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain queue should render the WIN chip");
    assertEquals(true, /hopper\.engine = 7/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain command chip should show the next chain command");
    assertEquals(true, /start-objective-progress lab-chain/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain queue should render chain progress pips");
    assertEquals(true, /2\/3 to TRIPLE TEST/.test(startQueuePanel22codeDeck.innerHTML), "Start lab-chain progress should show the next milestone");
    const chainRunQueue = getRunObjectiveQueue(chainQueueGame);
    assertEquals("LAB CHAIN x2", chainRunQueue[0] && chainRunQueue[0].label, "Run objective queue should surface active lab-chain targets");
    assertEquals("lab-chain-target", chainRunQueue[0] && chainRunQueue[0].source, "Run lab-chain queue should preserve source metadata");
    assertEquals("lab-chain", chainRunQueue[0] && chainRunQueue[0].progress && chainRunQueue[0].progress.mode, "Run lab-chain queue should carry progress metadata");
    assertEquals(2, chainRunQueue[0] && chainRunQueue[0].progress && chainRunQueue[0].progress.value, "Run lab-chain progress should show the current combo");
    assertEquals(3, chainRunQueue[0] && chainRunQueue[0].progress && chainRunQueue[0].progress.target, "Run lab-chain progress should show the next milestone target");
    assertEquals("Raise engine again", chainRunQueue[0] && chainRunQueue[0].lessonSteps && chainRunQueue[0].lessonSteps.learn, "Run lab-chain queue should teach the fresh target");
    assertEquals("hopper.engine = 7", chainRunQueue[0] && chainRunQueue[0].lessonSteps && chainRunQueue[0].lessonSteps.code, "Run lab-chain queue should teach the salient code line");
    assertEquals("Next new progress can reach x3", chainRunQueue[0] && chainRunQueue[0].lessonSteps && chainRunQueue[0].lessonSteps.win, "Run lab-chain queue should teach the combo payoff");
    chainQueueGame.state = "playing";
    chainQueueGame.canvas = { width: 360, height: 220 };
    chainQueueGame.player = { x: 120, y: 128, w: 24, h: 32 };
    chainQueueGame.cameraX = 0;
    chainQueueGame.reducedMotion = true;
    const chainCompassCue = chainQueueGame.getRunObjectiveCompassCue();
    assertEquals("LAB CHAIN x2", chainCompassCue && chainCompassCue.label, "Objective compass should surface lab-chain targets when they lead the queue");
    assertEquals("hopper.engine = 7", chainCompassCue && chainCompassCue.commandLine, "Objective compass should show the lab-chain salient command");
    assertEquals("Raise engine again", chainCompassCue && chainCompassCue.lessonSteps && chainCompassCue.lessonSteps.learn, "Objective compass should carry the lab-chain learn step");
    assertEquals("hopper.engine = 7", chainCompassCue && chainCompassCue.lessonSteps && chainCompassCue.lessonSteps.code, "Objective compass should carry the lab-chain code step");
    assertEquals("Next new progress can reach x3", chainCompassCue && chainCompassCue.lessonSteps && chainCompassCue.lessonSteps.win, "Objective compass should carry the lab-chain win step");
    chainQueueGame.lastStartObjectiveQueue = chainStartQueue;
    const chainStarts = [];
    const chainModes = [];
    chainQueueGame.startLevel = (level) => { chainStarts.push(level); };
    switchMainMode = (mode) => { chainModes.push(mode); };
    window.Game = chainQueueGame;
    inputEl.value = "";
    inputEl.focused = false;
    assertEquals(true, runStartObjectiveQueueAction(1), "Start objective Lab Chain action should dispatch");
    assertEquals(2, chainStarts[0], "Start objective Lab Chain action should launch the current world");
    assertEquals("terminal", chainModes[0], "Start objective Lab Chain action should return to the terminal");
    assertEquals("hopper.engine = 7", inputEl.value, "Start objective Lab Chain action should stage the next chain command");
    assertEquals(true, inputEl.focused, "Start objective Lab Chain action should focus the terminal");
    assertEquals("start-lab-chain", chainQueueGame.lastStagedExperiment && chainQueueGame.lastStagedExperiment.source, "Start objective Lab Chain action should preserve its source");

    const makeQueueEl = () => ({
      className: "",
      textContent: "",
      innerHTML: "",
      children: [],
      style: {},
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, handler) { this._events = this._events || {}; this._events[event] = handler; },
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
    });
    const flattenQueueText = (el) => [el.textContent || "", el.innerHTML || ""]
      .concat((el.children || []).map(flattenQueueText))
      .join(" ");
    const findQueueByClass = (el, className) => {
      if ((el.className || "").split(/\s+/).includes(className)) return el;
      for (const child of el.children || []) {
        const found = findQueueByClass(child, className);
        if (found) return found;
      }
      return null;
    };
    const collectQueueByClass = (el, className, out = []) => {
      if (!el) return out;
      if ((el.className || "").split(/\s+/).includes(className)) out.push(el);
      (el.children || []).forEach(child => collectQueueByClass(child, className, out));
      return out;
    };
    const queuePanel = makeQueueEl();
    document.createElement = () => makeQueueEl();
    queueGame.lastStagedExperiment = null;
    appendRunObjectiveQueueCard(queuePanel, queueGame);
    const cartridge = findQueueByClass(queuePanel, "code-concept-cartridge");
    const cartridgeText = flattenQueueText(cartridge || queuePanel);
    assertEquals(true, !!cartridge, "Run objective queue should render a Code Concept lesson cartridge");
    assertEquals(true, /IDEA 1\/5/.test(cartridgeText), "Code Concept cartridge should show deck progress");
    assertEquals(true, /LOOP/.test(cartridgeText), "Code Concept cartridge should show the next concept key");
    assertEquals(true, /Lesson cartridge: Collect Loop/.test(cartridgeText), "Code Concept cartridge should name the collectible lesson");
    assertEquals(5, collectQueueByClass(cartridge, "code-concept-pip").length, "Code Concept cartridge should render one pip per idea");
    assertEquals(1, collectQueueByClass(cartridge, "filled").length, "Code Concept cartridge should fill collected ideas");
    assertEquals(1, collectQueueByClass(cartridge, "next").length, "Code Concept cartridge should mark the next idea");
    const queueStageButton = findQueueByClass(queuePanel, "run-objective-queue-action-btn");
    window.Game = queueGame;
    inputEl.value = "";
    inputEl.focused = false;
    queueStageButton._events.click();
    assertEquals("repeat 3 { spawn_block() }", inputEl.value, "Code Concept cartridge action should stage the sample command");
    assertEquals(true, inputEl.focused, "Code Concept cartridge action should focus the terminal");
    assertEquals("code-concept-target", queueGame.lastStagedExperiment && queueGame.lastStagedExperiment.source, "Code Concept cartridge action should preserve the source metadata");

    const chainQueuePanel = makeQueueEl();
    chainQueueGame.lastStagedExperiment = null;
    appendRunObjectiveQueueCard(chainQueuePanel, chainQueueGame);
    const chainRunProgress = findQueueByClass(chainQueuePanel, "run-objective-progress");
    const chainRunProgressText = flattenQueueText(chainRunProgress || chainQueuePanel);
    assertEquals(true, !!chainRunProgress, "Run lab-chain queue should render milestone progress pips");
    assertEquals(true, /2\/3 to TRIPLE TEST/.test(chainRunProgressText), "Run lab-chain progress should name the next combo milestone");
    assertEquals(true, /LEARN/.test(flattenQueueText(chainQueuePanel)) && /Raise engine again/.test(flattenQueueText(chainQueuePanel)), "Run lab-chain queue should render the LEARN chip");
    assertEquals(true, /CODE/.test(flattenQueueText(chainQueuePanel)) && /hopper\.engine = 7/.test(flattenQueueText(chainQueuePanel)), "Run lab-chain queue should render the CODE chip");
    assertEquals(true, /WIN/.test(flattenQueueText(chainQueuePanel)) && /Next new progress can reach x3/.test(flattenQueueText(chainQueuePanel)), "Run lab-chain queue should render the WIN chip");
    assertEquals(3, collectQueueByClass(chainRunProgress, "run-objective-progress-pip").length, "Run lab-chain progress should render one pip per milestone step");
    assertEquals(2, collectQueueByClass(chainRunProgress, "filled").length, "Run lab-chain progress should fill current combo pips");
    assertEquals(1, collectQueueByClass(chainRunProgress, "next").length, "Run lab-chain progress should mark the next combo pip");
    const chainStageButton = findQueueByClass(chainQueuePanel, "run-objective-queue-action-btn");
    window.Game = chainQueueGame;
    inputEl.value = "";
    inputEl.focused = false;
    chainStageButton._events.click();
    assertEquals("hopper.engine = 7", inputEl.value, "Run lab-chain action should stage the next chain command");
    assertEquals("lab-chain-target", chainQueueGame.lastStagedExperiment && chainQueueGame.lastStagedExperiment.source, "Run lab-chain action should preserve the source metadata");
    document.createElement = oldCreateElement22codeDeck;

    const clearQueueGame = new StarHopperGame();
    clearQueueGame.currentPlanet = PLANETS[0];
    clearQueueGame.currentPlanetIndex = 0;
    const clearQueue = clearQueueGame.getClearObjectiveQueue({ codeConceptTarget: target });
    assertEquals("CODE CONCEPT", clearQueue[0] && clearQueue[0].label, "Clear objective queue should offer a Code Concept follow-up");
    assertEquals("Collect Loop", clearQueue[0] && clearQueue[0].title, "Clear objective queue should name the next Code Concept");
    assertEquals("STAGE IDEA", clearQueue[0] && clearQueue[0].cta, "Clear objective queue should expose the Code Concept stage action");
    assertEquals("code-concept", clearQueue[0] && clearQueue[0].action, "Clear objective queue should preserve Code Concept action metadata");
    assertEquals("repeat 3 { spawn_block() }", clearQueue[0] && clearQueue[0].command, "Clear objective Code Concept should preserve the sample command");
    assertEquals("code-concept", clearQueue[0] && clearQueue[0].progress && clearQueue[0].progress.mode, "Clear objective Code Concept should carry progress metadata");
    assertEquals("1/5 ideas", clearQueue[0] && clearQueue[0].progress && clearQueue[0].progress.label, "Clear objective Code Concept should preserve deck progress");
    assertEquals("Code idea -> concept card", getObjectiveLearningContract(clearQueue[0]), "Clear objective Code Concept should share the same learning contract");
    clearQueueGame.lastClearObjectiveQueue = clearQueue;
    clearQueueGame.lastClearCodeConceptTarget = target;
    window.Game = clearQueueGame;
    const clearModes = [];
    switchMainMode = (mode) => { clearModes.push(mode); };
    inputEl.value = "";
    inputEl.focused = false;
    assertEquals(true, clearQueueGame.runClearObjectiveQueueAction(1), "Clear Code Concept queue action should dispatch");
    assertEquals("terminal", clearModes[0], "Clear Code Concept action should return to the terminal");
    assertEquals("repeat 3 { spawn_block() }", inputEl.value, "Clear Code Concept action should stage the sample command");
    assertEquals(true, inputEl.focused, "Clear Code Concept action should focus the terminal");
    assertEquals("clear-code-concept", clearQueueGame.lastStagedExperiment && clearQueueGame.lastStagedExperiment.source, "Clear Code Concept action should preserve its source");
    assertEquals("Code concept", getStagedExperimentSourceLabel(clearQueueGame.lastStagedExperiment.source), "Clear Code Concept staged reminder should name the source");

    const clearChainTarget = getLabChainTarget(chainQueueGame);
    const clearChainQueue = chainQueueGame.getClearObjectiveQueue({ labChainTarget: clearChainTarget });
    assertEquals("LAB CHAIN x2", clearChainQueue[0] && clearChainQueue[0].label, "Clear objective queue should offer active lab-chain follow-ups");
    assertEquals("Raise engine again", clearChainQueue[0] && clearChainQueue[0].lessonSteps && clearChainQueue[0].lessonSteps.learn, "Clear lab-chain objective should keep the learn chip");
    assertEquals("hopper.engine = 7", clearChainQueue[0] && clearChainQueue[0].lessonSteps && clearChainQueue[0].lessonSteps.code, "Clear lab-chain objective should keep the code chip");
    assertEquals("Next new progress can reach x3", clearChainQueue[0] && clearChainQueue[0].lessonSteps && clearChainQueue[0].lessonSteps.win, "Clear lab-chain objective should keep the win chip");
    const clearChainContract = renderObjectiveLearningContract(clearChainQueue[0], "clear-objective-contract");
    assertEquals(true, /clear-objective-contract objective-learning-steps/.test(clearChainContract), "Clear lab-chain objective should render learning chips");
    assertEquals(true, /Raise engine again/.test(clearChainContract) && /Next new progress can reach x3/.test(clearChainContract), "Clear lab-chain objective should show the target and payoff chips");
    window.Game = oldWindowGame22codeDeck;
    switchMainMode = oldSwitchMainMode22codeDeck;

    const radarGame = new StarHopperGame();
    const earthMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    radarGame.currentPlanet = PLANETS[0];
    radarGame.currentPlanetIndex = 0;
    radarGame.completedMissions = new Set();
    radarGame.coachPredictions = { [earthMission.id]: "lighter-longer" };
    radarGame.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind));
    radarGame.codeConcepts = new Set(["ASSIGN"]);
    radarGame.researchXP = 60;
    const quest = getActiveLabQuest(radarGame);
    assertEquals("NEXT CODE CONCEPT", quest && quest.kicker, "Start radar should promote a Code Concept quest after formula targets are covered");
    assertEquals("Collect Loop", quest && quest.title, "Start radar Code Concept quest should name the missing idea");
    const action = getStartMissionRadarAction(radarGame, quest);
    assertEquals("code-concept", action && action.action, "Start radar Code Concept quest should use a dedicated action");
    assertEquals("STAGE IDEA", action && action.label, "Start radar Code Concept action should stage the idea");
    Object.assign(radarButton.dataset, {
      action: action.action,
      level: String(action.levelIndex),
      command: action.command,
      kind: action.kind,
      stageTitle: action.stageTitle
    });
    const radarStarts = [];
    radarGame.startLevel = (level) => { radarStarts.push(level); };
    window.Game = radarGame;
    assertEquals(true, runStartMissionRadarAction(), "Start radar Code Concept action should execute");
    assertEquals(0, radarStarts[0], "Start radar Code Concept action should launch the current world");
    assertEquals("repeat 3 { spawn_block() }", inputEl.value, "Start radar Code Concept action should stage the sample command");
    assertEquals(true, inputEl.focused, "Start radar Code Concept action should focus the terminal");
    assertEquals("start-code-concept", radarGame.lastStagedExperiment && radarGame.lastStagedExperiment.source, "Start radar Code Concept staging should remember its source");

    game.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "CALL", "ALIAS"]);
    updateCodeConceptDeck(game);
    assertEquals(true, /Code Concepts 5\/5/.test(panel.innerHTML), "Complete Code Concept Deck should render full progress");
    assertEquals(true, /CODE DECK COMPLETE/.test(panel.innerHTML), "Complete Code Concept Deck should celebrate completion");
    assertEquals(false, /STAGE NEXT/.test(panel.innerHTML), "Complete Code Concept Deck should not show a stale next action");
    document.getElementById = oldGetElementById22codeDeck;
    document.createElement = oldCreateElement22codeDeck;
    window.Game = oldWindowGame22codeDeck;
    switchMainMode = oldSwitchMainMode22codeDeck;
    renderTestResult("engine-suite", "Curriculum: Code Concept Deck reviews coding ideas", true);
  } catch (err) {
    document.getElementById = oldGetElementById22codeDeck;
    document.createElement = oldCreateElement22codeDeck;
    window.Game = oldWindowGame22codeDeck;
    switchMainMode = oldSwitchMainMode22codeDeck;
    renderTestResult("engine-suite", "Curriculum: Code Concept Deck reviews coding ideas", false, err.message);
  }

  // Test 22a1e: completing the Code Concept Deck creates a one-time mastery payoff.
  const oldGetElementById22codeMastery = document.getElementById;
  const oldBubblePop22codeMastery = ComicBubbles.pop;
  const oldParticleBurst22codeMastery = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const game = new StarHopperGame();
    game.currentPlanetIndex = 0;
    game.currentPlanet = PLANETS[0];
    game.player = { x: 90, y: 110, w: 24, h: 32 };
    game.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "ALIAS"]);
    game.researchXP = 0;
    game.masteryMeters = {};
    game.discoveryPassCounts = {};
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const resultState = {
      allPassed: true,
      items: [{ id: "call-proof", label: "Function call proof", passed: true, message: "Call proof logged" }]
    };
    const pulse = recordDiscoveryPulse(game, activeMission, "use_hopper()", resultState, 0);
    assertEquals(true, game.codeConcepts.has("CALL"), "Final code concept should be collected from the successful call");
    assertEquals("CALL", pulse.codeConceptProof && pulse.codeConceptProof.concept, "Pulse should name the final collected code concept");
    assertEquals(true, pulse.codeConceptProof && pulse.codeConceptProof.complete, "Final concept proof should mark the code deck complete");
    assertEquals("CODE DECK MASTERED", pulse.codeConceptDeckMastery && pulse.codeConceptDeckMastery.label, "Full code deck should create a mastery chip");
    assertEquals(5, pulse.codeConceptDeckMastery && pulse.codeConceptDeckMastery.count, "Code deck mastery should count all ideas");
    assertEquals(5, pulse.codeConceptDeckMastery && pulse.codeConceptDeckMastery.total, "Code deck mastery should know the deck total");
    assertEquals(1, game.discoveryPassCounts["code-concept-deck-mastery"], "Code deck mastery should store a one-time source");
    assertEquals(true, game.researchXP >= 8, "Code deck mastery should add Research XP to the discovery reward");
    assertEquals(true, game.getWorldMasteryProgress(0).xp >= 10, "Code deck mastery should feed world mastery");
    assertEquals("CODE DECK MASTERED: +8 Research XP", game.missionBalloon && game.missionBalloon.text, "Code deck mastery should write to the Mission CRT");
    assertEquals(true, labels.includes("CODE DECK!"), "Code deck mastery should pop a visible collection cue");
    assertEquals(true, labels.includes("5/5 IDEAS"), "Code deck mastery should name the full-deck payoff");
    assertEquals(true, bursts > 0, "Code deck mastery should spawn reward particles");
    assertEquals(true, /CODE DECK MASTERED \+8 XP/.test(panel.innerHTML), "Discovery Pulse should render the Code Concept Deck mastery chip");
    assertEquals(true, /CODE DECK COMPLETE/.test(panel.innerHTML), "Discovery Pulse should show the completed code-deck unlock card");
    const xpAfterFirst = game.researchXP;
    assertEquals(null, game.grantCodeConceptDeckMastery(pulse), "Repeating Code Concept Deck mastery should be blocked");
    assertEquals(xpAfterFirst, game.researchXP, "Repeated Code Concept Deck mastery should not farm Research XP");

    document.getElementById = oldGetElementById22codeMastery;
    ComicBubbles.pop = oldBubblePop22codeMastery;
    Particles.spawnBurst = oldParticleBurst22codeMastery;
    renderTestResult("engine-suite", "Curriculum: Code Concept Deck mastery rewards full collection", true);
  } catch (err) {
    document.getElementById = oldGetElementById22codeMastery;
    ComicBubbles.pop = oldBubblePop22codeMastery;
    Particles.spawnBurst = oldParticleBurst22codeMastery;
    renderTestResult("engine-suite", "Curriculum: Code Concept Deck mastery rewards full collection", false, err.message);
  }

  // Test 22a2: Scientist Certificate unlock path is visible before it is earned.
  const oldGetElementById22cert = document.getElementById;
  const oldWindowGame22cert = window.Game;
  const oldWindowNav22cert = window.Nav;
  try {
    const makeClassList = (initial = []) => {
      const classes = new Set(initial);
      return {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle: (name, force) => {
          const shouldHave = force === undefined ? !classes.has(name) : !!force;
          if (shouldHave) classes.add(name);
          else classes.delete(name);
          return shouldHave;
        },
        contains: (name) => classes.has(name)
      };
    };
    const card = { className: "", innerHTML: "" };
    const btnClasses = makeClassList(["certificate-locked"]);
    const btn = { disabled: true, textContent: "", title: "", classList: btnClasses };
    document.getElementById = (id) => id === "certificate-progress-card" ? card : (id === "certificate-btn" ? btn : null);

    const game = { state: "playing", completedMissions: new Set() };
    const nav = { orbitalMissionsCompleted: new Set() };
    window.Game = game;
    window.Nav = nav;

    let progress = getScientistCertificateProgress(game, nav);
    assertEquals(false, progress.unlocked, "Certificate starts locked without Play or Navigator proof");
    assertEquals("play", progress.next.id, "Certificate progress starts with the Play proof cue");
    updateCertificateState();
    assertEquals(true, btn.disabled, "Certificate button stays disabled before proof");
    assertEquals(true, btn.classList.contains("certificate-locked"), "Locked certificate button keeps locked class");
    assertEquals(true, /CERTIFICATE PATH/.test(card.innerHTML), "Certificate card names the unlock path");
    assertEquals(true, /1 proof needed/.test(card.innerHTML), "Certificate card shows the single proof requirement");
    assertEquals(true, /Complete either path/.test(card.innerHTML), "Certificate card explains that either route works");
    assertEquals(true, /NEXT/.test(card.innerHTML), "Certificate card marks the next proof path");
    assertEquals(true, /Complete 1 Proof/.test(btn.textContent), "Button text names the remaining proof");

    game.completedMissions.add("earth-gravity-wall");
    updateCertificateState();
    assertEquals(false, btn.disabled, "Completing a Play mission unlocks the certificate button");
    assertEquals(false, btn.classList.contains("certificate-locked"), "Unlocked certificate button clears locked class");
    assertEquals(true, /CERTIFICATE READY/.test(card.innerHTML), "Certificate card switches to ready state");
    assertEquals(true, /Physics proof logged/.test(card.innerHTML), "Certificate card uses completed mission evidence");
    assertEquals(true, /Print Scientist Certificate/.test(btn.textContent), "Unlocked button offers printing");

    game.completedMissions.clear();
    nav.orbitalMissionsCompleted.add("route-earth-moon");
    progress = getScientistCertificateProgress(game, nav);
    assertEquals(true, progress.unlocked, "A Navigator route also unlocks the certificate");

    document.getElementById = oldGetElementById22cert;
    window.Game = oldWindowGame22cert;
    window.Nav = oldWindowNav22cert;
    renderTestResult("engine-suite", "Curriculum: certificate path previews proof goal", true);
  } catch (err) {
    document.getElementById = oldGetElementById22cert;
    window.Game = oldWindowGame22cert;
    window.Nav = oldWindowNav22cert;
    renderTestResult("engine-suite", "Curriculum: certificate path previews proof goal", false, err.message);
  }

  // Test 22a: Mission completion gets an in-level task progress cue and CRT next step.
  const oldBubblePop22a = ComicBubbles.pop;
  const oldParticleBurst22a = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    let secondReady = false;
    const game = new StarHopperGame();
    game.currentPlanet = {
      missions: [
        { id: "first", prompt: "Tune the first variable", validate: () => true },
        { id: "second", prompt: "Tune the second variable", validate: () => secondReady }
      ]
    };
    game.currentPlanetIndex = 0;
    game.player = { x: 40, y: 50, w: 24, h: 32 };
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 0;
    game._labStarPreviewCount = 0;

    game.checkMissions();
    assertEquals(true, game.completedMissions.has("first"), "First task should complete");
    assertEquals(false, game.completedMissions.has("second"), "Second task should remain incomplete");
    assertEquals(true, labels.includes("TASK 1/2"), "Partial task completion should pop progress");
    assertEquals("TASK 1/2: run the next fix", game.missionBalloon.text, "CRT should point to the next code fix");
    const firstTaskPops = labels.filter(label => label === "TASK 1/2").length;
    game.checkMissions();
    assertEquals(firstTaskPops, labels.filter(label => label === "TASK 1/2").length, "Already-completed tasks should not replay progress pops");

    secondReady = true;
    game.requiredCollectiblesCollected = 1;
    game.checkMissions();
    assertEquals(true, game.completedMissions.has("second"), "Second task should complete once the validator passes");
    assertEquals(true, labels.includes("TASKS DONE!"), "Final task should pop a tasks-done milestone");
    assertEquals("TASKS DONE: collect 1 sample", game.missionBalloon.text, "CRT should hand off from code tasks to samples");
    assertEquals(true, bursts >= 2, "Task progress should spawn reward particles");

    ComicBubbles.pop = oldBubblePop22a;
    Particles.spawnBurst = oldParticleBurst22a;
    renderTestResult("engine-suite", "Curriculum: mission tasks pop next-step feedback", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop22a;
    Particles.spawnBurst = oldParticleBurst22a;
    renderTestResult("engine-suite", "Curriculum: mission tasks pop next-step feedback", false, err.message);
  }

  // Test 22b: Mission Coach code creates a science discovery pulse and rewards only new progress.
  const oldGetElementById22b = document.getElementById;
  const oldWindowGame22b = window.Game;
  const oldBubblePop22b = ComicBubbles.pop;
  const oldParticleBurst22b = Particles.spawnBurst;
  try {
    let formulaRewardClick = null;
    let scienceProofClick = null;
    let codeConceptClick = null;
    const formulaRewardButton = {
      dataset: { formulaNextCommand: "hopper.engine = 7", formulaNextTitle: "Engine Lab" },
      addEventListener(event, handler) { if (event === "click") formulaRewardClick = handler; }
    };
    const scienceProofButton = {
      dataset: { scienceProofCommand: "hopper.engine = 7", scienceProofTitle: "Agility 30+ reached" },
      addEventListener(event, handler) { if (event === "click") scienceProofClick = handler; }
    };
    const codeConceptButton = {
      dataset: {
        codeConceptNextCommand: "repeat 3 { spawn_block() }",
        codeConceptNextTitle: "Loop",
        codeConceptNextKind: "LOOP"
      },
      addEventListener(event, handler) { if (event === "click") codeConceptClick = handler; }
    };
    const pulsePanel22b = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll(selector) {
        if (selector === "[data-formula-next-command]" && /data-formula-next-command/.test(this.innerHTML)) return [formulaRewardButton];
        if (selector === "[data-science-proof-command]" && /data-science-proof-command/.test(this.innerHTML)) return [scienceProofButton];
        if (selector === "[data-code-concept-next-command]" && /data-code-concept-next-command/.test(this.innerHTML)) return [codeConceptButton];
        return [];
      }
    };
    const input22b = {
      value: "",
      focused: false,
      style: {},
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => {
      if (id === "discovery-pulse") return pulsePanel22b;
      if (id === "console-input") return input22b;
      return null;
    };
    const bubbleLabels22b = [];
    let particleBursts22b = 0;
    ComicBubbles.pop = (x, y, text) => { bubbleLabels22b.push(text); };
    Particles.spawnBurst = () => { particleBursts22b++; };

    const game = new StarHopperGame();
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.cameraX = 0;
    game.lastScienceDelta = {
      title: "What changed",
      summary: "Mass changed",
      code: "use_hopper()\nhopper.mass = 1.2",
      changes: [
        {
          label: "Mass",
          value: "2.5 -> 1.2 (-1.3)",
          direction: "down",
          cue: "Less mass: same force makes more acceleration; gravity still sets falling acceleration."
        }
      ],
      nextExperiment: {
        title: "Agility 30+ reached",
        body: "Lower mass or raise engine.",
        command: "hopper.engine = 7"
      }
    };
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const partial = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Still locked" }
      ]
    };
    const firstPulse = recordDiscoveryPulse(game, activeMission, "use_hopper()\nhopper.mass = 1.2", partial, 1);
    const firstXP = game.researchXP;
    const formulaDeckTotal22b = DISCOVERY_RULES.length;

    assertEquals("mass", firstPulse.kind, "Mass command should map to the mass science rule");
    assertEquals(true, firstPulse.formula.indexOf("F / m") >= 0, "Pulse should expose the force/mass formula");
    assertEquals(true, /free fall|falling acceleration/.test(`${firstPulse.insight} ${firstPulse.cue}`), "Mass Lab should guard against the heavy-falls-faster misconception");
    const massDelta = buildScienceDelta(game, { mass: 2.5 }, { mass: 1.2 }, "hopper.mass = 1.2");
    assertEquals(true, /gravity still sets falling acceleration/.test(massDelta && massDelta.changes && massDelta.changes[0] && massDelta.changes[0].cue), "Mass science delta should explain that gravity, not mass, controls free-fall acceleration");
    assertEquals(true, !!firstPulse.cardUnlocked, "First real mass progress should unlock the mass formula card");
    assertEquals("SCIENCE PROOF", firstPulse.scienceDeltaProof && firstPulse.scienceDeltaProof.label, "Discovery pulse should carry the matching science proof");
    assertEquals("Mass changed", firstPulse.scienceDeltaProof && firstPulse.scienceDeltaProof.title, "Science proof should name the changed value");
    assertEquals("F/m=a", firstPulse.scienceDeltaProof && firstPulse.scienceDeltaProof.relation, "Science proof should carry the formula relation");
    assertEquals("-1.3", firstPulse.scienceDeltaProof && firstPulse.scienceDeltaProof.delta, "Science proof should expose the numeric delta");
    assertEquals("hopper.engine = 7", firstPulse.scienceDeltaProof && firstPulse.scienceDeltaProof.nextCommand, "Science proof should expose the next runnable experiment");
    assertEquals(true, game.codeConcepts.has("ASSIGN"), "Assignment concept should be collected from the first successful tweak");
    assertEquals("CODE CONCEPT", firstPulse.codeConceptProof && firstPulse.codeConceptProof.label, "Discovery pulse should carry the code concept proof");
    assertEquals("ASSIGN", firstPulse.codeConceptProof && firstPulse.codeConceptProof.concept, "Code concept proof should identify the assignment");
    assertEquals("1/5", firstPulse.codeConceptProof && firstPulse.codeConceptProof.progress, "Code concept proof should show deck progress");
    assertEquals("LOOP", firstPulse.codeConceptProof && firstPulse.codeConceptProof.nextConcept, "Code concept proof should identify the next idea");
    assertEquals("repeat 3 { spawn_block() }", firstPulse.codeConceptProof && firstPulse.codeConceptProof.nextCommand, "Code concept proof should carry the next runnable idea");
    assertEquals("Repeat count makes tools", firstPulse.codeConceptProof && firstPulse.codeConceptProof.nextLearn, "Code concept proof should carry the next learning idea");
    assertEquals("Repeat a helper", firstPulse.codeConceptProof && firstPulse.codeConceptProof.nextCodeMove, "Code concept proof should carry the next coding move");
    assertEquals("Build the route", firstPulse.codeConceptProof && firstPulse.codeConceptProof.nextPayoff, "Code concept proof should carry the next game payoff");
    assertEquals(true, game.discoveredFormulaKinds.has("mass"), "Mass formula should be collected");
    assertEquals(1, game.formulaCardEffects.length, "Formula card unlock should spawn an in-world card effect");
    assertEquals("Mass Lab", game.formulaCardEffects[0].title, "Formula card effect should name the collected card");
    assertEquals(`CARD 1/${formulaDeckTotal22b}`, game.formulaCardEffects[0].deckLabel, "Formula card should show deck collection progress");
    assertEquals(`CARD 1/${formulaDeckTotal22b}`, firstPulse.formulaDeckProgress.label, "Discovery pulse should expose deck progress");
    assertEquals("NEXT Engine Lab", game.formulaCardEffects[0].nextLabel, "Formula card effect should preview the next deck target");
    assertEquals("Engine Lab", firstPulse.formulaDeckProgress.nextTitle, "Discovery pulse should expose the next formula card target");
    assertEquals("hopper.engine = 7", game.formulaCardEffects[0].nextCommand, "Formula card effect should carry the next deck command");
    assertEquals("hopper.engine = 7", firstPulse.formulaDeckProgress.nextCommand, "Discovery pulse should expose the next formula card command");
    assertEquals("Force changes speed", firstPulse.formulaDeckProgress.nextAxis, "Discovery pulse should expose the next card science axis");
    assertEquals("Beat Agility gates", firstPulse.formulaDeckProgress.nextPayoff, "Discovery pulse should expose the next card game payoff");
    const formulaLabels22b = [];
    game.canvas = { width: 720, height: 448 };
    const formulaCtx22b = {
      save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {},
      roundRect() {}, fill() {}, stroke() {},
      measureText(text) { return { width: String(text || "").length * 5 }; },
      fillText(text) { formulaLabels22b.push(text); }
    };
    game.drawFormulaCardEffects(formulaCtx22b);
    assertEquals(true, formulaLabels22b.includes("NEXT Engine Lab"), "Formula card draw should write the next deck target");
    assertEquals(true, formulaLabels22b.includes("TRY hopper.engine = 7"), "Formula card draw should write the next runnable command");
    assertEquals(true, pulsePanel22b.innerHTML.includes(`CARD 1/${formulaDeckTotal22b}`), "Discovery Pulse should show formula deck progress after a card unlock");
    assertEquals(true, /Next: Engine Lab/.test(pulsePanel22b.innerHTML), "Discovery Pulse should show the next formula card target");
    assertEquals(true, /LEARN/.test(pulsePanel22b.innerHTML) && /Force changes speed/.test(pulsePanel22b.innerHTML), "Discovery Pulse should teach the next card science axis");
    assertEquals(true, /WIN/.test(pulsePanel22b.innerHTML) && /Beat Agility gates/.test(pulsePanel22b.innerHTML), "Discovery Pulse should show the next card payoff");
    assertEquals(true, /SCIENCE PROOF/.test(pulsePanel22b.innerHTML), "Discovery Pulse should render the science proof card");
    assertEquals(true, /CODE/.test(pulsePanel22b.innerHTML) && /hopper\.mass = 1\.2/.test(pulsePanel22b.innerHTML), "Science proof should show the causal code");
    assertEquals(true, /SCIENCE/.test(pulsePanel22b.innerHTML) && /F\/m=a/.test(pulsePanel22b.innerHTML), "Science proof should show the formula relation");
    assertEquals(true, /WIN/.test(pulsePanel22b.innerHTML) && /(NEXT Agility 30\+ reached|TARGET Agility)/.test(pulsePanel22b.innerHTML), "Science proof should show the next game target");
    assertEquals(true, /CODE CONCEPT/.test(pulsePanel22b.innerHTML) && /ASSIGN/.test(pulsePanel22b.innerHTML), "Discovery Pulse should show the collected coding concept");
    assertEquals(true, /discovery-code-concept-lesson/.test(pulsePanel22b.innerHTML), "Discovery Pulse should render next Code Concept lesson chips");
    assertEquals(true, /LEARN/.test(pulsePanel22b.innerHTML) && /Repeat count makes tools/.test(pulsePanel22b.innerHTML), "Discovery Pulse Code Concept handoff should teach the next idea");
    assertEquals(true, /CODE/.test(pulsePanel22b.innerHTML) && /Repeat a helper/.test(pulsePanel22b.innerHTML), "Discovery Pulse Code Concept handoff should name the next coding move");
    assertEquals(true, /WIN/.test(pulsePanel22b.innerHTML) && /Build the route/.test(pulsePanel22b.innerHTML), "Discovery Pulse Code Concept handoff should name the next payoff");
    assertEquals(true, /data-code-concept-next-command/.test(pulsePanel22b.innerHTML), "Code Concept proof should carry a next-idea stage command");
    assertEquals(true, /STAGE IDEA/.test(pulsePanel22b.innerHTML), "Code Concept proof should expose a next-idea stage action");
    assertEquals(true, typeof codeConceptClick === "function", "Discovery Pulse Code Concept action should attach a click handler");
    assertEquals(true, /STAGE NEXT/.test(pulsePanel22b.innerHTML), "Science proof should expose a next-experiment stage action");
    assertEquals(true, typeof scienceProofClick === "function", "Discovery Pulse science proof action should attach a click handler");
    assertEquals(true, /Try <code>hopper\.engine = 7<\/code>/.test(pulsePanel22b.innerHTML), "Discovery Pulse should show the next runnable formula command");
    assertEquals(true, /STAGE CARD/.test(pulsePanel22b.innerHTML), "Discovery Pulse should expose a formula stage action");
    assertEquals(true, typeof formulaRewardClick === "function", "Discovery Pulse formula action should attach a click handler");
    assertEquals(true, firstXP > 0, "New check/gem progress should award Research XP");
    const firstWorldXP = game.getWorldMasteryProgress(0).xp;
    assertEquals(true, firstWorldXP > 0, "Science progress should also feed the world mastery meter");
    assertEquals("use_hopper()\nhopper.mass = 1.2", firstPulse.code, "Discovery pulse should remember the code that created it");
    assertEquals(1, game.discoveryCombo, "New discovery starts the combo");
    assertEquals("CHAIN READY!", firstPulse.comboPrimer.label, "First discovery should prime the next-experiment chain");
    assertEquals(true, bubbleLabels22b.includes("CHAIN READY!"), "First discovery should pop a chain-ready cue");
    assertEquals("CHAIN READY: make one new change", game.missionBalloon.text, "CRT should explain how to keep the chain alive");
    const firstBubbleCount = bubbleLabels22b.length;
    const firstBurstCount = particleBursts22b;
    assertEquals(false, bubbleLabels22b.some(label => /LAB CHAIN/.test(label)), "First discovery should not claim a chain yet");

    recordDiscoveryPulse(game, activeMission, "hopper.mass = 1.2", partial, 0);
    assertEquals(firstXP, game.researchXP, "Repeating the same progress should not farm Research XP");
    assertEquals(firstWorldXP, game.getWorldMasteryProgress(0).xp, "Repeating the same progress should not farm world mastery XP");
    assertEquals(1, game.discoveryCombo, "Repeating without progress should not raise combo");
    assertEquals(1, game.discoveredFormulaKinds.size, "Repeating without progress should not unlock new cards");
    assertEquals(1, game.codeConcepts.size, "Repeating without progress should not collect another coding concept");
    assertEquals(1, game.formulaCardEffects.length, "Repeating without a new card should not spawn another effect");
    assertEquals(firstBubbleCount, bubbleLabels22b.length, "Repeating without progress should not spawn combo text");
    assertEquals(firstBurstCount, particleBursts22b, "Repeating without progress should not spawn combo particles");
    window.Game = game;
    scienceProofClick();
    assertEquals("hopper.engine = 7", input22b.value, "Science proof stage button should write the next command to the console");
    assertEquals("science-proof", game.lastStagedExperiment && game.lastStagedExperiment.source, "Science proof stage button should preserve its source");
    assertEquals("Science proof", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Science proof staged reminder should name the reward source");
    codeConceptClick();
    assertEquals("repeat 3 { spawn_block() }", input22b.value, "Code Concept reward stage button should write the next idea to the console");
    assertEquals("code-concept-reward", game.lastStagedExperiment && game.lastStagedExperiment.source, "Code Concept reward stage button should preserve its source");
    assertEquals("Code concept", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Code Concept reward staged reminder should name the reward source");
    formulaRewardClick();
    assertEquals("hopper.engine = 7", input22b.value, "Formula reward stage button should write the next command to the console");
    assertEquals(true, input22b.focused, "Formula reward stage button should focus the console");
    assertEquals("formula-card-reward", game.lastStagedExperiment && game.lastStagedExperiment.source, "Formula reward stage button should preserve its source");
    assertEquals("Formula reward", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Formula reward staged reminder should name the reward source");

    const complete = {
      allPassed: true,
      items: partial.items.map(item => ({ ...item, passed: true }))
    };
    const finalPulse = recordDiscoveryPulse(game, activeMission, "hopper.engine = 6", complete, 0);
    assertEquals("engine", finalPulse.kind, "Engine command should map to the speed formula");
    assertEquals(true, game.researchXP > firstXP, "Newly passed checks should add more Research XP");
    assertEquals(true, game.getWorldMasteryProgress(0).xp > firstWorldXP, "New science progress should keep filling world mastery");
    assertEquals(2, game.discoveryCombo, "Second new discovery extends combo");
    assertEquals(true, !!finalPulse.rankUp, "Crossing a Research XP threshold should flag rank-up");
    assertEquals("Variable Scout", finalPulse.rankTitle, "Rank-up should name the new rank");
    assertEquals("Hypothesis Bonus", finalPulse.rankPerk.label, "Rank-up should unlock the rank's lab perk");
    assertEquals("LAB RANK UP!", finalPulse.rankEffect.label, "Rank-up should create an in-level reward cue");
    assertEquals("Hypothesis Bonus", finalPulse.rankEffect.perkLabel, "Rank-up cue should name the unlocked lab perk");
    assertEquals(true, game.discoveredFormulaKinds.has("engine"), "Engine formula should be collected");
    assertEquals(2, game.formulaCardEffects.length, "A second new formula should spawn a second card effect");
    assertEquals(`CARD 2/${formulaDeckTotal22b}`, game.formulaCardEffects[1].deckLabel, "Second formula card should advance deck collection progress");
    assertEquals(true, /^NEXT /.test(game.formulaCardEffects[1].nextLabel), "Second formula card should still point to the next deck target");
    assertEquals("hopper.jump_power = 20", game.formulaCardEffects[1].nextCommand, "Second formula card should carry the following deck command");
    assertEquals(true, bubbleLabels22b.some(label => /LAB CHAIN x2/.test(label)), "Second real discovery should pop the lab-chain cue");
    assertEquals(true, bubbleLabels22b.some(label => /LAB RANK UP!/.test(label)), "Rank-up should pop a visible lab-rank cue");
    assertEquals(true, particleBursts22b > firstBurstCount, "Second real discovery should add a visual burst");
    document.getElementById = oldGetElementById22b;
    window.Game = oldWindowGame22b;
    ComicBubbles.pop = oldBubblePop22b;
    Particles.spawnBurst = oldParticleBurst22b;
    renderTestResult("engine-suite", "Curriculum: code runs create discovery rewards", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b;
    window.Game = oldWindowGame22b;
    ComicBubbles.pop = oldBubblePop22b;
    Particles.spawnBurst = oldParticleBurst22b;
    renderTestResult("engine-suite", "Curriculum: code runs create discovery rewards", false, err.message);
  }

  // Test 22b1: completing the Formula Deck creates a one-time collection capstone.
  const oldGetElementById22b1 = document.getElementById;
  const oldBubblePop22b1 = ComicBubbles.pop;
  const oldParticleBurst22b1 = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const game = new StarHopperGame();
    game.currentPlanetIndex = 0;
    game.currentPlanet = PLANETS[0];
    game.player = { x: 90, y: 110, w: 24, h: 32 };
    game.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind).filter(kind => kind !== "state"));
    game.researchXP = 0;
    game.masteryMeters = {};
    game.discoveryPassCounts = {};
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const resultState = {
      allPassed: true,
      items: [{ id: "state-proof", label: "AI state proof", passed: true, message: "State proof logged" }]
    };
    const pulse = recordDiscoveryPulse(game, activeMission, "rave_mode()", resultState, 0);
    assertEquals(true, pulse.cardUnlocked, "The final formula card should unlock");
    assertEquals("state", pulse.formulaCardKind || pulse.kind, "The final card should be the AI State Lab card");
    assertEquals("DECK MASTERED", pulse.formulaDeckMastery && pulse.formulaDeckMastery.label, "Full deck should create a mastery chip");
    assertEquals(DISCOVERY_RULES.length, pulse.formulaDeckMastery && pulse.formulaDeckMastery.count, "Mastery chip should show all cards collected");
    assertEquals(DISCOVERY_RULES.length, pulse.formulaDeckMastery && pulse.formulaDeckMastery.total, "Mastery chip should know the deck total");
    assertEquals(1, game.discoveryPassCounts["formula-deck-mastery"], "Formula Deck mastery should store a one-time source");
    assertEquals(true, game.researchXP >= 12, "Formula Deck mastery should add Research XP to the discovery reward");
    assertEquals(true, game.getWorldMasteryProgress(0).xp >= 16, "Formula Deck mastery should feed world mastery");
    assertEquals("DECK MASTERED: +12 Research XP", game.missionBalloon && game.missionBalloon.text, "Mastery capstone should write to the Mission CRT");
    assertEquals(true, labels.includes("DECK MASTERED!"), "Mastery capstone should pop a visible collection cue");
    assertEquals(true, labels.includes("ALL FORMULAS"), "Mastery capstone should name the full-deck payoff");
    assertEquals(true, bursts > 0, "Mastery capstone should spawn reward particles");
    assertEquals(true, /DECK MASTERED \+12 XP/.test(panel.innerHTML), "Discovery Pulse should render the Formula Deck mastery chip");
    assertEquals(true, /FORMULA DECK COMPLETE/.test(panel.innerHTML), "Discovery Pulse should show the completed-deck next-unlock card");
    const xpAfterFirst = game.researchXP;
    assertEquals(null, game.grantFormulaDeckMastery(pulse), "Repeating Formula Deck mastery should be blocked");
    assertEquals(xpAfterFirst, game.researchXP, "Repeated Formula Deck mastery should not farm Research XP");

    const direct = new StarHopperGame();
    direct.currentPlanetIndex = 0;
    direct.currentPlanet = PLANETS[0];
    direct.player = { x: 70, y: 100, w: 24, h: 32 };
    direct.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind).filter(kind => kind !== "state"));
    direct.discoveryPassCounts = {};
    const directPulse = { rewardXP: 0 };
    assertEquals(true, direct.attachFormulaCardUnlock(directPulse, "state"), "Direct proof unlock should collect the final card");
    assertEquals("DECK MASTERED", directPulse.formulaDeckMastery && directPulse.formulaDeckMastery.label, "Direct proof unlocks should also trigger deck mastery");
    assertEquals(12, direct.researchXP, "Direct Formula Deck mastery should apply its Research XP immediately");
    assertEquals(1, direct.discoveryPassCounts["formula-deck-mastery"], "Direct Formula Deck mastery should store the same source guard");

    document.getElementById = oldGetElementById22b1;
    ComicBubbles.pop = oldBubblePop22b1;
    Particles.spawnBurst = oldParticleBurst22b1;
    renderTestResult("engine-suite", "Curriculum: Formula Deck mastery rewards full collection", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b1;
    ComicBubbles.pop = oldBubblePop22b1;
    Particles.spawnBurst = oldParticleBurst22b1;
    renderTestResult("engine-suite", "Curriculum: Formula Deck mastery rewards full collection", false, err.message);
  }

  // Test 22b2: raw terminal code shares the same discovery reward path as Mission Coach.
  const oldBubblePop22b2 = ComicBubbles.pop;
  const oldParticleBurst22b2 = Particles.spawnBurst;
  try {
    const labels = [];
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => {};

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { x: 80, y: 100, w: 24, h: 32 };
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const partial = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Still locked" }
      ]
    };

    const outcome = finishSuccessfulCodeRunDiscovery(game, activeMission, "use_hopper()\nhopper.mass = 1.2", partial, 0, []);
    assertEquals(true, !!outcome.pulse, "Terminal post-run helper should return the discovery pulse");
    assertEquals("mass", outcome.pulse.kind, "Terminal mass code should map to the mass formula");
    assertEquals(true, game.discoveryPulse === outcome.pulse, "Terminal reward should become the visible discovery pulse");
    assertEquals(true, game.discoveredFormulaKinds.has("mass"), "Terminal code should collect formula cards");
    assertEquals(true, labels.includes("CARD!"), "Terminal code should spawn the formula card pop");
    assertEquals(true, labels.includes("CHAIN READY!"), "Terminal code should prime the discovery combo visually");
    assertEquals(true, game.researchXP > 0, "Terminal code should award Research XP for new lab progress");
    assertEquals(1, game.discoveryCombo, "Terminal code should start the discovery combo");

    const xpAfterFirst = game.researchXP;
    finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.mass = 1.2", partial, 0, []);
    assertEquals(xpAfterFirst, game.researchXP, "Repeating terminal progress should not farm Research XP");
    assertEquals(1, game.discoveryCombo, "Repeating terminal progress should not extend the combo");

    ComicBubbles.pop = oldBubblePop22b2;
    Particles.spawnBurst = oldParticleBurst22b2;
    renderTestResult("engine-suite", "Curriculum: terminal code earns discovery rewards", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop22b2;
    Particles.spawnBurst = oldParticleBurst22b2;
    renderTestResult("engine-suite", "Curriculum: terminal code earns discovery rewards", false, err.message);
  }

  // Test 22b2a: staged Crash Lab repairs pay off as one-time proof rewards.
  const oldGetElementById22b2a = document.getElementById;
  const oldBubblePop22b2a = ComicBubbles.pop;
  const oldParticleBurst22b2a = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { x: 80, y: 100, w: 24, h: 32 };
    game.masteryMeters = {};
    game.discoveryPassCounts = {};
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const noProgress = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: false, message: "Need Hopper" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Still locked" }
      ]
    };
    game.lastStagedExperiment = {
      title: "Fix the jump arc",
      source: "failure-lab",
      kind: "failure-diagnosis",
      command: "hopper.jump = 18",
      prediction: "higher",
      time: Date.now()
    };

    const outcome = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.jump = 18", noProgress, 0, []);
    assertEquals(true, !!outcome.repairProof, "Exact staged Crash Lab command should award a repair proof");
    assertEquals("REPAIR PROOF", outcome.repairProof.label, "Crash Lab proof should use the repair label");
    assertEquals("Crash Lab", outcome.repairProof.source, "Crash Lab proof should name its source");
    assertEquals("higher", outcome.repairProof.prediction, "Crash Lab proof should keep the staged hypothesis");
    assertEquals(5, outcome.repairProof.rewardXP, "Crash Lab proof should grant focused Research XP");
    assertEquals(5, game.researchXP, "Repair proof should pay even when no mission checklist item changed");
    assertEquals(7, game.getWorldMasteryProgress(0).xp, "Repair proof should feed world mastery");
    assertEquals(1, game.discoveryPassCounts[outcome.repairProof.sourceKey], "Repair proof should persist its one-time source key");
    assertEquals(1, game.discoveryCombo, "Standalone repair proof should start the discovery chain");
    assertEquals("repair-proof", game.reflectionContext && game.reflectionContext.kind, "Repair proof should seed notebook reflection context");
    assertEquals(outcome.repairProof.sourceKey, game.reflectionContext && game.reflectionContext.proofSourceKey, "Repair reflection context should carry the one-time proof key");
    assertEquals(true, /REPAIR PROOF \+5 XP/.test(panel.innerHTML), "Discovery Pulse should render the repair proof chip");
    assertEquals(true, /predict higher/.test(panel.innerHTML), "Discovery Pulse should render the carried prediction");
    assertEquals("REPAIR PROOF: +5 Research XP", game.missionBalloon && game.missionBalloon.text, "Mission CRT should announce the repair proof reward");
    assertEquals(true, labels.includes("REPAIR PROOF"), "Repair proof should pop a visible reward cue");
    assertEquals(true, bursts > 0, "Repair proof should spawn reward particles");

    const xpAfterFirst = game.researchXP;
    const masteryAfterFirst = game.getWorldMasteryProgress(0).xp;
    const repeat = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.jump = 18", noProgress, 0, []);
    assertEquals(null, repeat.repairProof, "Repeating the same Crash Lab proof should not award again");
    assertEquals(xpAfterFirst, game.researchXP, "Repeated repair proofs should not farm Research XP");
    assertEquals(masteryAfterFirst, game.getWorldMasteryProgress(0).xp, "Repeated repair proofs should not farm world mastery");
    assertEquals(1, game.discoveryCombo, "Repeated repair proofs should not extend the chain");

    document.getElementById = oldGetElementById22b2a;
    ComicBubbles.pop = oldBubblePop22b2a;
    Particles.spawnBurst = oldParticleBurst22b2a;
    renderTestResult("engine-suite", "Curriculum: Crash Lab repairs earn proof rewards", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b2a;
    ComicBubbles.pop = oldBubblePop22b2a;
    Particles.spawnBurst = oldParticleBurst22b2a;
    renderTestResult("engine-suite", "Curriculum: Crash Lab repairs earn proof rewards", false, err.message);
  }

  // Test 22b3: staged Daily/Frontier Signal Lab contracts pay off as one-time proofs.
  const oldGetElementById22b3 = document.getElementById;
  const oldBubblePop22b3 = ComicBubbles.pop;
  const oldParticleBurst22b3 = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const noProgress = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: false, message: "Need Hopper" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Still locked" }
      ]
    };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { x: 80, y: 100, w: 24, h: 32 };
    game.masteryMeters = {};
    game.researchXP = 16;
    game.remixContext = 'daily';
    game.dailyInfo = {
      dateStr: "2026-06-30",
      shareCode: "EARTH-20260630",
      concept: "Force and mass",
      labContract: {
        title: "Mass remix proof",
        body: "Run the mass tweak and compare the motion.",
        concept: "Force and mass",
        command: "hopper.mass = 1.2"
      }
    };
    game.lastStagedExperiment = {
      title: "Mass remix proof",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };

    const outcome = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals(true, !!outcome.signalLabProof, "Exact staged Daily Signal command should award a lab proof");
    assertEquals("SIGNAL LAB TESTED", outcome.signalLabProof.label, "Daily proof should use the signal-lab label");
    assertEquals(4, outcome.signalLabProof.rewardXP, "Daily proof should grant the focused Research XP bonus");
    assertEquals(20, game.researchXP, "Signal proof should pay even when no mission checklist item changed");
    assertEquals(true, !!game.discoveryPulse.rankUp, "Signal proof should flag a rank-up when it crosses a threshold");
    assertEquals("LAB RANK UP!", game.discoveryPulse.rankEffect && game.discoveryPulse.rankEffect.label, "Signal proof rank-up should create an in-level lab-rank cue");
    assertEquals(true, labels.includes("LAB RANK UP!"), "Signal proof rank-up should pop a visible lab-rank cue");
    assertEquals(6, game.getWorldMasteryProgress(0).xp, "Daily proof should feed world mastery");
    assertEquals(1, game.discoveryPassCounts[outcome.signalLabProof.sourceKey], "Signal proof should persist its one-time source key");
    assertEquals(1, game.discoveryCombo, "A standalone signal proof should start the lab chain");
    assertEquals(true, /SIGNAL LAB TESTED \+4 XP/.test(panel.innerHTML), "Discovery pulse should render the signal proof chip");
    assertEquals("SIGNAL LAB TESTED: +4 Research XP", game.missionBalloon && game.missionBalloon.text, "Mission CRT should announce the Daily proof reward");
    assertEquals(true, labels.includes("SIGNAL LAB TESTED"), "Daily proof should pop a visible reward cue");
    assertEquals(true, bursts > 0, "Daily proof should spawn celebratory particles");

    const xpAfterFirst = game.researchXP;
    const masteryAfterFirst = game.getWorldMasteryProgress(0).xp;
    const repeat = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals(null, repeat.signalLabProof, "Repeating the same Signal Lab proof should not award again");
    assertEquals(xpAfterFirst, game.researchXP, "Repeated Signal Lab proofs should not farm Research XP");
    assertEquals(masteryAfterFirst, game.getWorldMasteryProgress(0).xp, "Repeated Signal Lab proofs should not farm world mastery");
    assertEquals(1, game.discoveryCombo, "Repeated Signal Lab proofs should not extend the chain");

    const chain = new StarHopperGame();
    chain.currentPlanet = PLANETS[0];
    chain.currentPlanetIndex = 0;
    chain.player = { x: 80, y: 100, w: 24, h: 32 };
    chain.masteryMeters = {};
    chain.researchXP = 0;
    chain.discoveryPassCounts = {};
    chain.discoveryCombo = 2;
    chain.remixContext = 'daily';
    chain.dailyInfo = {
      dateStr: "2026-06-30",
      shareCode: "DAILY-EARTH-3030",
      labContract: {
        title: "Chain mass proof",
        body: "Prove the mass lever as the third fresh experiment.",
        concept: "Force and mass",
        command: "hopper.mass = 1.2"
      }
    };
    chain.lastStagedExperiment = {
      title: "Chain mass proof",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };
    const chainLabelStart = labels.length;
    const chainOutcome = finishSuccessfulCodeRunDiscovery(chain, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals("SIGNAL LAB TESTED", chainOutcome.signalLabProof && chainOutcome.signalLabProof.label, "Chained Daily proof still earns its proof reward");
    assertEquals(3, chain.discoveryCombo, "Chained Daily proof should extend the lab chain");
    assertEquals("TRIPLE TEST", chain.discoveryPulse.comboMilestone && chain.discoveryPulse.comboMilestone.label, "Replay proofs should trigger combo milestones");
    assertEquals(10, chain.researchXP, "Daily proof plus Triple Test should add combined Research XP");
    assertEquals(14, chain.getWorldMasteryProgress(0).xp, "Daily proof plus Triple Test should add combined world mastery");
    assertEquals(1, chain.discoveryPassCounts[chain.getDiscoveryComboMilestoneSourceKey(3)], "Replay milestone should store the same one-time source");
    assertEquals("TRIPLE TEST: +6 Research XP", chain.missionBalloon && chain.missionBalloon.text, "Replay milestone should own the Mission CRT when it fires");
    assertEquals(true, /TRIPLE TEST \+6 XP/.test(panel.innerHTML), "Discovery pulse should render replay combo milestones");
    assertEquals(true, labels.slice(chainLabelStart).includes("TRIPLE TEST!"), "Replay combo milestone should pop in-level feedback");
    const chainXPAfterFirst = chain.researchXP;
    assertEquals(null, chain.grantDiscoveryComboMilestone(chain.discoveryPulse), "Replay combo milestone should not repeat");
    assertEquals(chainXPAfterFirst, chain.researchXP, "Repeated replay combo milestone should not farm Research XP");

    const frontier = new StarHopperGame();
    frontier.currentPlanet = PLANETS[0];
    frontier.currentPlanetIndex = 0;
    frontier.player = { x: 80, y: 100, w: 24, h: 32 };
    frontier.masteryMeters = {};
    frontier.researchXP = 0;
    frontier.remixContext = 'daily';
    frontier.dailyInfo = {
      isFrontier: true,
      tier: 3,
      shareCode: "FRONTIER-EARTH-3030",
      concept: "Force and mass",
      labContract: {
        title: "Frontier mass proof",
        body: "Prove the mass lever in a harder seed.",
        concept: "Force and mass",
        command: "hopper.mass = 1.2"
      }
    };
    frontier.lastStagedExperiment = {
      title: "Frontier mass proof",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };
    const frontierOutcome = finishSuccessfulCodeRunDiscovery(frontier, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals("FRONTIER LAB TESTED", frontierOutcome.signalLabProof && frontierOutcome.signalLabProof.label, "Frontier proof should use the harder-challenge label");
    assertEquals(6, frontier.researchXP, "Frontier proof should grant the stronger Research XP bonus");
    assertEquals(9, frontier.getWorldMasteryProgress(0).xp, "Frontier proof should grant stronger world mastery");
    assertEquals("FRONTIER LAB TESTED: +6 Research XP", frontier.missionBalloon && frontier.missionBalloon.text, "Mission CRT should announce the Frontier proof reward");

    const echo = new StarHopperGame();
    echo.currentPlanet = PLANETS[0];
    echo.currentPlanetIndex = 0;
    echo.player = { x: 80, y: 100, w: 24, h: 32 };
    echo.masteryMeters = {};
    echo.researchXP = 0;
    echo.remixContext = 'daily';
    echo.dailyInfo = {
      isFrontier: true,
      darkMatterEcho: true,
      tier: 3,
      shareCode: "FRONTIER-EARTH-3131",
      concept: "Infer hidden forces from Frontier evidence",
      labContract: {
        title: "Dark Matter Echo: decode anomaly",
        body: "Compare stars, time, and motion clues.",
        concept: "Infer hidden forces from Frontier evidence",
        command: "hopper.mass = 1.2"
      }
    };
    echo.lastStagedExperiment = {
      title: "Dark Matter Echo: decode anomaly",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };
    const echoOutcome = finishSuccessfulCodeRunDiscovery(echo, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals("DARK MATTER ECHO", echoOutcome.signalLabProof && echoOutcome.signalLabProof.label, "Dark Matter Echo proof should keep the first future-lab label");
    assertEquals("Dark Matter Echo", echoOutcome.signalLabProof && echoOutcome.signalLabProof.source, "Echo proof should name the anomaly source");
    assertEquals(6, echo.researchXP, "Echo proof should keep the Frontier-scale Research XP bonus");
    assertEquals(9, echo.getWorldMasteryProgress(0).xp, "Echo proof should keep the Frontier-scale world mastery bonus");
    assertEquals(true, /^signal-lab-proof:dark-matter-echo:frontier-earth-3131:/.test(echoOutcome.signalLabProof && echoOutcome.signalLabProof.sourceKey), "Echo proof source key should carry the echo route tag");
    assertEquals("DARK MATTER ECHO", echo.missionBalloon && echo.missionBalloon.title, "Mission CRT should label Echo proof distinctly");
    assertEquals("DARK MATTER ECHO: +6 Research XP", echo.missionBalloon && echo.missionBalloon.text, "Mission CRT should announce the Echo proof reward");
    assertEquals(true, labels.includes("DARK MATTER ECHO"), "Echo proof should pop a visible anomaly cue");

    const prep = new StarHopperGame();
    prep.currentPlanet = PLANETS[0];
    prep.currentPlanetIndex = 0;
    prep.player = { x: 80, y: 100, w: 24, h: 32 };
    prep.masteryMeters = {};
    prep.researchXP = 0;
    prep.remixContext = 'daily';
    prep.dailyInfo = {
      isFrontier: true,
      darkMatterPrep: true,
      tier: 4,
      shareCode: "FRONTIER-EARTH-4040",
      concept: "Infer hidden forces from motion",
      labContract: {
        title: "Dark Matter Prep: curve evidence",
        body: "Compare path curve, speed, and force changes.",
        concept: "Infer hidden forces from motion",
        command: "hopper.mass = 1.2"
      }
    };
    prep.lastStagedExperiment = {
      title: "Dark Matter Prep: curve evidence",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };
    const prepOutcome = finishSuccessfulCodeRunDiscovery(prep, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals("DARK MATTER EVIDENCE", prepOutcome.signalLabProof && prepOutcome.signalLabProof.label, "Dark Matter prep proof should get its own evidence label");
    assertEquals("Dark Matter Prep", prepOutcome.signalLabProof && prepOutcome.signalLabProof.source, "Prep proof should name the hidden-force source");
    assertEquals(7, prep.researchXP, "Prep proof should grant the strongest focused Research XP bonus");
    assertEquals(10, prep.getWorldMasteryProgress(0).xp, "Prep proof should feed extra world mastery");
    assertEquals("DARK MATTER PREP", prep.missionBalloon && prep.missionBalloon.title, "Mission CRT should label prep evidence distinctly");
    assertEquals("DARK MATTER EVIDENCE: +7 Research XP", prep.missionBalloon && prep.missionBalloon.text, "Mission CRT should announce the prep proof reward");
    assertEquals(true, /DARK MATTER EVIDENCE \+7 XP/.test(panel.innerHTML), "Discovery pulse should render the Dark Matter evidence chip");
    assertEquals("Quantum Gate wakes", prepOutcome.signalLabProof && prepOutcome.signalLabProof.futureLabScene && prepOutcome.signalLabProof.futureLabScene.title, "Prep proof should attach the next future-lab source scene");
    assertEquals(true, /VECTOR \/\/ Quantum Gate wakes/.test(panel.innerHTML), "Discovery pulse should render the prep source-scene payoff");
    assertEquals(true, labels.includes("DARK MATTER EVIDENCE"), "Prep proof should pop a visible evidence cue");
    const prepXPAfterFirst = prep.researchXP;
    const prepMasteryAfterFirst = prep.getWorldMasteryProgress(0).xp;
    const prepRepeat = finishSuccessfulCodeRunDiscovery(prep, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals(null, prepRepeat.signalLabProof, "Repeating the same prep proof should not award again");
    assertEquals(prepXPAfterFirst, prep.researchXP, "Repeated prep proofs should not farm Research XP");
    assertEquals(prepMasteryAfterFirst, prep.getWorldMasteryProgress(0).xp, "Repeated prep proofs should not farm world mastery");

    const source = new StarHopperGame();
    source.currentPlanet = PLANETS[0];
    source.currentPlanetIndex = 0;
    source.player = { x: 80, y: 100, w: 24, h: 32 };
    source.masteryMeters = {};
    source.researchXP = 0;
    source.remixContext = 'daily';
    source.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1,
      "quantum-chance-proof:0:test-chance-branch:test": 1
    };
    source.dailyInfo = {
      isFrontier: true,
      futureSourcePrep: true,
      tier: 5,
      shareCode: "FRONTIER-EARTH-5050",
      concept: "Combine hidden-force inference with probability evidence",
      labContract: {
        title: "Future Source Key: source rehearsal",
        body: "Compare hidden-force clues with branch and chance evidence.",
        concept: "Combine hidden-force inference with probability evidence",
        command: "hopper.mass = 1.2"
      }
    };
    source.lastStagedExperiment = {
      title: "Future Source Key: source rehearsal",
      source: "signal-lab-contract",
      command: "hopper.mass = 1.2",
      time: Date.now()
    };
    const sourceOutcome = finishSuccessfulCodeRunDiscovery(source, activeMission, "hopper.mass = 1.2", noProgress, 0, []);
    assertEquals("SOURCE KEY TESTED", sourceOutcome.signalLabProof && sourceOutcome.signalLabProof.label, "Future Source proof should get its own source-key label");
    assertEquals("Future Lab Source", sourceOutcome.signalLabProof && sourceOutcome.signalLabProof.source, "Future Source proof should name the capstone source");
    assertEquals(8, source.researchXP, "Future Source proof should grant the strongest focused Research XP bonus");
    assertEquals(12, source.getWorldMasteryProgress(0).xp, "Future Source proof should feed extra world mastery");
    assertEquals("SOURCE KEY", source.missionBalloon && source.missionBalloon.title, "Mission CRT should label source-key evidence distinctly");
    assertEquals("SOURCE KEY TESTED: +8 Research XP", source.missionBalloon && source.missionBalloon.text, "Mission CRT should announce the source-key reward");
    assertEquals(true, /SOURCE KEY TESTED \+8 XP/.test(panel.innerHTML), "Discovery pulse should render the Source Key proof chip");
    assertEquals("The waiting probe answers", sourceOutcome.signalLabProof && sourceOutcome.signalLabProof.futureLabScene && sourceOutcome.signalLabProof.futureLabScene.title, "Source proof should attach the source payoff scene");
    assertEquals(true, labels.includes("SOURCE KEY TESTED"), "Source proof should pop a visible evidence cue");

    document.getElementById = oldGetElementById22b3;
    ComicBubbles.pop = oldBubblePop22b3;
    Particles.spawnBurst = oldParticleBurst22b3;
    renderTestResult("engine-suite", "Curriculum: Signal Lab contracts reward completed proofs", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b3;
    ComicBubbles.pop = oldBubblePop22b3;
    Particles.spawnBurst = oldParticleBurst22b3;
    renderTestResult("engine-suite", "Curriculum: Signal Lab contracts reward completed proofs", false, err.message);
  }

  // Test 22b4: the staged Anomaly Trace quest pays off only when its exact command runs.
  const oldGetElementById22b4 = document.getElementById;
  const oldBubblePop22b4 = ComicBubbles.pop;
  const oldParticleBurst22b4 = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const activeMission = PLANETS[4].missions.find(mission => mission.id === "magnet-field-event");
    const noProgress = {
      allPassed: false,
      items: [
        { id: "magnet-hopper-active", label: "Hopper activated", passed: false, message: "Need Hopper" },
        { id: "magnet-touch-rule", label: "Magnet touch rule", passed: false, message: "Need an event rule" }
      ]
    };
    const command = "use_hopper()\nwhen player.touching('magnet'): hopper.pole = 'south'";

    const anomaly = new StarHopperGame();
    anomaly.currentPlanet = PLANETS[4];
    anomaly.currentPlanetIndex = 4;
    anomaly.player = { x: 80, y: 100, w: 24, h: 32 };
    anomaly.masteryMeters = {};
    anomaly.researchXP = 0;
    anomaly.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    anomaly.frontierRecords = {
      "2026-06-30": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        stars: 2,
        bestTime: 42.2
      }
    };
    anomaly.lastStagedExperiment = {
      title: "Trace hidden force",
      source: "start-anomaly-trace",
      command,
      time: Date.now()
    };

    const outcome = finishSuccessfulCodeRunDiscovery(anomaly, activeMission, command, noProgress, 0, []);
    assertEquals("ANOMALY TRACED", outcome.anomalyTraceProof && outcome.anomalyTraceProof.label, "Exact staged Anomaly Trace command should award proof");
    assertEquals(5, anomaly.researchXP, "Anomaly Trace proof grants focused Research XP");
    assertEquals(8, anomaly.getWorldMasteryProgress(4).xp, "Anomaly Trace proof feeds Mag-Net world mastery");
    assertEquals(1, anomaly.discoveryPassCounts[outcome.anomalyTraceProof.sourceKey], "Anomaly Trace proof stores a one-time source key");
    assertEquals(1, anomaly.discoveryCombo, "A standalone Anomaly Trace proof starts the lab chain");
    assertEquals("ANOMALY TRACE", anomaly.missionBalloon && anomaly.missionBalloon.title, "Mission CRT labels the Anomaly Trace reward");
    assertEquals("ANOMALY TRACED: +5 Research XP", anomaly.missionBalloon && anomaly.missionBalloon.text, "Mission CRT announces the Anomaly Trace reward");
    assertEquals(true, labels.includes("ANOMALY TRACED"), "Anomaly Trace proof pops a visible reward cue");
    assertEquals(true, bursts > 0, "Anomaly Trace proof spawns celebratory particles");
    assertEquals(true, /ANOMALY TRACED \+5 XP/.test(panel.innerHTML), "Discovery pulse renders the Anomaly Trace proof chip");
    assertEquals("Hidden-force case file", outcome.anomalyTraceProof && outcome.anomalyTraceProof.futureLabScene && outcome.anomalyTraceProof.futureLabScene.title, "Anomaly Trace proof should attach the Dark Matter payoff scene");
    assertEquals(true, /VECTOR \/\/ Hidden-force case file/.test(panel.innerHTML), "Discovery pulse renders the Dark Matter source-scene payoff");
    assertEquals("Hidden Force Trace", outcome.anomalyTraceProof.signalStoryUnlock && outcome.anomalyTraceProof.signalStoryUnlock.chapterTitle, "Anomaly Trace proof should decode the next Signal Story chapter");
    assertEquals("Hidden Force Trace", anomaly.lastSignalStoryUnlocks && anomaly.lastSignalStoryUnlocks[0] && anomaly.lastSignalStoryUnlocks[0].title, "Anomaly Trace story unlock should be remembered for the run");

    const xpAfterFirst = anomaly.researchXP;
    const masteryAfterFirst = anomaly.getWorldMasteryProgress(4).xp;
    const repeat = finishSuccessfulCodeRunDiscovery(anomaly, activeMission, command, noProgress, 0, []);
    assertEquals(null, repeat.anomalyTraceProof, "Repeating the same Anomaly Trace proof should not award again");
    assertEquals(xpAfterFirst, anomaly.researchXP, "Repeated Anomaly Trace proofs should not farm Research XP");
    assertEquals(masteryAfterFirst, anomaly.getWorldMasteryProgress(4).xp, "Repeated Anomaly Trace proofs should not farm world mastery");
    assertEquals(1, anomaly.discoveryCombo, "Repeated Anomaly Trace proofs should not extend the chain");

    document.getElementById = oldGetElementById22b4;
    ComicBubbles.pop = oldBubblePop22b4;
    Particles.spawnBurst = oldParticleBurst22b4;
    renderTestResult("engine-suite", "Curriculum: Anomaly Trace rewards completed proofs", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b4;
    ComicBubbles.pop = oldBubblePop22b4;
    Particles.spawnBurst = oldParticleBurst22b4;
    renderTestResult("engine-suite", "Curriculum: Anomaly Trace rewards completed proofs", false, err.message);
  }

  // Test 22b5: the staged Quantum prep branch pays off only when its exact command runs.
  const oldGetElementById22b5 = document.getElementById;
  const oldBubblePop22b5 = ComicBubbles.pop;
  const oldParticleBurst22b5 = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const noProgress = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: false, message: "Need Hopper" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Need more agility" }
      ]
    };
    const command = "player.fuel = 40\nif player.fuel < 50: player.say('branch A')";

    const quantum = new StarHopperGame();
    quantum.currentPlanet = PLANETS[0];
    quantum.currentPlanetIndex = 0;
    quantum.player = { x: 80, y: 100, w: 24, h: 32 };
    quantum.masteryMeters = {};
    quantum.researchXP = 0;
    quantum.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    quantum.frontierRecords = {
      "2026-06-30": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        stars: 2,
        bestTime: 42.2
      }
    };
    quantum.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1
    };
    quantum.lastStagedExperiment = {
      title: "Test a branch condition",
      source: "start-quantum-branch",
      command,
      time: Date.now()
    };

    const outcome = finishSuccessfulCodeRunDiscovery(quantum, activeMission, command, noProgress, 0, []);
    assertEquals("QUANTUM BRANCH", outcome.quantumBranchProof && outcome.quantumBranchProof.label, "Exact staged Quantum Branch command should award proof");
    assertEquals(5, quantum.researchXP, "Quantum Branch proof grants focused Research XP");
    assertEquals(8, quantum.getWorldMasteryProgress(0).xp, "Quantum Branch proof feeds world mastery");
    assertEquals(1, quantum.discoveryPassCounts[outcome.quantumBranchProof.sourceKey], "Quantum Branch proof stores a one-time source key");
    assertEquals(1, quantum.discoveryCombo, "A standalone Quantum Branch proof starts the lab chain");
    assertEquals("QUANTUM PREP", quantum.missionBalloon && quantum.missionBalloon.title, "Mission CRT labels the Quantum Branch reward");
    assertEquals("QUANTUM BRANCH: +5 Research XP", quantum.missionBalloon && quantum.missionBalloon.text, "Mission CRT announces the Quantum Branch reward");
    assertEquals(true, labels.includes("QUANTUM BRANCH"), "Quantum Branch proof pops a visible reward cue");
    assertEquals(true, bursts > 0, "Quantum Branch proof spawns celebratory particles");
    assertEquals(true, /QUANTUM BRANCH \+5 XP/.test(panel.innerHTML), "Discovery pulse renders the Quantum Branch proof chip");
    assertEquals("Two paths detected", outcome.quantumBranchProof && outcome.quantumBranchProof.futureLabScene && outcome.quantumBranchProof.futureLabScene.title, "Quantum Branch proof should attach Hopper-Zero branch payoff");
    assertEquals(true, /HOPPER-ZERO \/\/ Two paths detected/.test(panel.innerHTML), "Discovery pulse renders the Hopper-Zero branch scene");
    assertEquals(true, quantum.discoveredFormulaKinds.has("branch"), "Quantum Branch proof collects the Branch Lab formula card");
    assertEquals(1, quantum.formulaCardEffects.length, "Quantum Branch proof spawns one Branch Lab formula card effect");
    assertEquals("Branch Lab", quantum.formulaCardEffects[0].title, "Quantum Branch card effect names the branch concept");
    assertEquals("if condition -> branch", quantum.formulaCardEffects[0].formula, "Quantum Branch card effect shows the branch formula");

    const xpAfterFirst = quantum.researchXP;
    const masteryAfterFirst = quantum.getWorldMasteryProgress(0).xp;
    const repeat = finishSuccessfulCodeRunDiscovery(quantum, activeMission, command, noProgress, 0, []);
    assertEquals(null, repeat.quantumBranchProof, "Repeating the same Quantum Branch proof should not award again");
    assertEquals(xpAfterFirst, quantum.researchXP, "Repeated Quantum Branch proofs should not farm Research XP");
    assertEquals(masteryAfterFirst, quantum.getWorldMasteryProgress(0).xp, "Repeated Quantum Branch proofs should not farm world mastery");
    assertEquals(1, quantum.discoveryCombo, "Repeated Quantum Branch proofs should not extend the chain");

    document.getElementById = oldGetElementById22b5;
    ComicBubbles.pop = oldBubblePop22b5;
    Particles.spawnBurst = oldParticleBurst22b5;
    renderTestResult("engine-suite", "Curriculum: Quantum Branch rewards completed proofs", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b5;
    ComicBubbles.pop = oldBubblePop22b5;
    Particles.spawnBurst = oldParticleBurst22b5;
    renderTestResult("engine-suite", "Curriculum: Quantum Branch rewards completed proofs", false, err.message);
  }

  // Test 22b6: the staged Quantum chance branch seeds the probability lesson.
  const oldGetElementById22b6 = document.getElementById;
  const oldBubblePop22b6 = ComicBubbles.pop;
  const oldParticleBurst22b6 = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const noProgress = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: false, message: "Need Hopper" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Need more agility" }
      ]
    };
    const command = "if chance(50): player.say('path A')";

    const quantum = new StarHopperGame();
    quantum.currentPlanet = PLANETS[0];
    quantum.currentPlanetIndex = 0;
    quantum.player = { x: 80, y: 100, w: 24, h: 32 };
    quantum.masteryMeters = {};
    quantum.researchXP = 0;
    quantum.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    quantum.frontierRecords = {
      "2026-06-30": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        stars: 2,
        bestTime: 42.2
      }
    };
    quantum.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1
    };
    quantum.lastStagedExperiment = {
      title: "Test chance branch",
      source: "start-quantum-chance",
      command,
      time: Date.now()
    };

    const outcome = finishSuccessfulCodeRunDiscovery(quantum, activeMission, command, noProgress, 0, []);
    assertEquals("QUANTUM CHANCE", outcome.quantumChanceProof && outcome.quantumChanceProof.label, "Exact staged Quantum Chance command should award proof");
    assertEquals(5, quantum.researchXP, "Quantum Chance proof grants focused Research XP");
    assertEquals(8, quantum.getWorldMasteryProgress(0).xp, "Quantum Chance proof feeds world mastery");
    assertEquals(1, quantum.discoveryPassCounts[outcome.quantumChanceProof.sourceKey], "Quantum Chance proof stores a one-time source key");
    assertEquals(1, quantum.discoveryCombo, "A standalone Quantum Chance proof starts the lab chain");
    assertEquals("QUANTUM CHANCE", quantum.missionBalloon && quantum.missionBalloon.title, "Mission CRT labels the Quantum Chance reward");
    assertEquals("QUANTUM CHANCE: +5 Research XP", quantum.missionBalloon && quantum.missionBalloon.text, "Mission CRT announces the Quantum Chance reward");
    assertEquals(true, labels.includes("QUANTUM CHANCE"), "Quantum Chance proof pops a visible reward cue");
    assertEquals(true, bursts > 0, "Quantum Chance proof spawns celebratory particles");
    assertEquals(true, /QUANTUM CHANCE \+5 XP/.test(panel.innerHTML), "Discovery pulse renders the Quantum Chance proof chip");
    assertEquals("The waiting probe answers", outcome.quantumChanceProof && outcome.quantumChanceProof.futureLabScene && outcome.quantumChanceProof.futureLabScene.title, "Quantum Chance proof should attach the probability payoff scene");
    assertEquals(true, /probability is a pattern measured over many trials/.test(panel.innerHTML), "Discovery pulse renders the probability science payoff");
    assertEquals(true, quantum.discoveredFormulaKinds.has("probability"), "Quantum Chance proof collects the Probability Lab formula card");
    assertEquals(1, quantum.formulaCardEffects.length, "Quantum Chance proof spawns one Probability Lab formula card effect");
    assertEquals("Probability Lab", quantum.formulaCardEffects[0].title, "Quantum Chance card effect names the probability concept");
    assertEquals("chance p -> random branch", quantum.formulaCardEffects[0].formula, "Quantum Chance card effect shows the probability formula");

    const xpAfterFirst = quantum.researchXP;
    const masteryAfterFirst = quantum.getWorldMasteryProgress(0).xp;
    const repeat = finishSuccessfulCodeRunDiscovery(quantum, activeMission, command, noProgress, 0, []);
    assertEquals(null, repeat.quantumChanceProof, "Repeating the same Quantum Chance proof should not award again");
    assertEquals(xpAfterFirst, quantum.researchXP, "Repeated Quantum Chance proofs should not farm Research XP");
    assertEquals(masteryAfterFirst, quantum.getWorldMasteryProgress(0).xp, "Repeated Quantum Chance proofs should not farm world mastery");
    assertEquals(1, quantum.discoveryCombo, "Repeated Quantum Chance proofs should not extend the chain");

    document.getElementById = oldGetElementById22b6;
    ComicBubbles.pop = oldBubblePop22b6;
    Particles.spawnBurst = oldParticleBurst22b6;
    renderTestResult("engine-suite", "Curriculum: Quantum Chance rewards completed proofs", true);
  } catch (err) {
    document.getElementById = oldGetElementById22b6;
    ComicBubbles.pop = oldBubblePop22b6;
    Particles.spawnBurst = oldParticleBurst22b6;
    renderTestResult("engine-suite", "Curriculum: Quantum Chance rewards completed proofs", false, err.message);
  }

  // Test 22ba: successful KidCode runs summarize the live science delta.
  const oldGetElementById22ba = document.getElementById;
  const oldBubblePop22ba = ComicBubbles.pop;
  const oldParticleBurst22ba = Particles.spawnBurst;
  const oldWindowGame22ba = window.Game;
  try {
    const scienceDeltaBubbles22ba = [];
    let scienceDeltaBursts22ba = 0;
    ComicBubbles.pop = (x, y, text) => { scienceDeltaBubbles22ba.push(text); };
    Particles.spawnBurst = () => { scienceDeltaBursts22ba++; };

    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { charType: 'hopper', x: 64, y: 96, jumpPower: 10, rocketPower: 40, mass: 2.5, fuel: 100, w: 24, h: 32, say: () => {} };
    game.hopper = game.player;
    game.hopperMass = 2.5;
    game.spawnedBoxes = [];
    game.interactiveObjects = [];

    const before = captureScienceDeltaSnapshot(game);
    const code = "antigravity = 4.9\nhopper.mass = 1.2\nhopper.engine = 6";
    const res = Compiler.runCommand(code, game);
    const delta = recordScienceDelta(game, before, captureScienceDeltaSnapshot(game), code);
    assertEquals(1, game.scienceBreadcrumbEffects.length, "Science delta should spawn one in-scene experiment breadcrumb");
    const breadcrumb22ba = game.scienceBreadcrumbEffects[0];
    assertEquals("", breadcrumb22ba.nextLabel, "Experiment breadcrumb starts without a next-test cue before mission validation attaches one");
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const nextCue = attachScienceDeltaNextExperiment(game, {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Agility is still under 30. Lower mass or raise engine." }
      ]
    }, activeMission);
    const labels = delta.changes.map(change => change.label).join(" ");
    const text = delta.changes.map(change => `${change.label} ${change.value} ${change.cue || ""}`).join(" ");

    assertEquals(true, res.success, res.msg);
    assertEquals(true, !!delta, "Successful physics code should produce a delta");
    assertEquals(true, /Mass/.test(labels), "Delta should include mass changes");
    assertEquals(true, /Felt gravity/.test(labels), "Delta should include antigravity/felt-gravity changes");
    assertEquals(true, /Agility/.test(labels), "Delta should include mission stat movement");
    assertEquals(true, /Less mass/.test(text), "Delta should explain the mass science effect");
    assertEquals(delta, game.lastScienceDelta, "Latest delta should be stored on the game for the CRT");
    assertEquals(true, scienceDeltaBubbles22ba.some(text => /MASS/.test(text)), "Science delta should pop the changed value in the level");
    assertEquals(true, scienceDeltaBursts22ba >= 2, "Science delta should spawn a small particle reward");
    assertEquals("CODE hopper.mass = 1.2", breadcrumb22ba.codeLine, "Experiment breadcrumb should keep the causal code line");
    assertEquals("ASSIGN", breadcrumb22ba.codeSkillChip, "Experiment breadcrumb should name the coding construct behind the code line");
    assertEquals("F/m=a", breadcrumb22ba.relation, "Experiment breadcrumb should name the science relation");
    assertEquals("Mass 2.5 -> 1.2 (-1.3)", breadcrumb22ba.valueLine, "Experiment breadcrumb should keep the changed value");
    assertEquals("-1.3", breadcrumb22ba.deltaChip, "Experiment breadcrumb should expose the numeric delta");
    assertEquals("", breadcrumb22ba.predictionLabel, "Experiment breadcrumb should stay prediction-free without a selected hypothesis");
    assertEquals("NEXT Agility 30+ reached", breadcrumb22ba.nextLabel, "Mission validation should update the live breadcrumb with the next test");
    assertEquals("TRY hopper.engine = 6", breadcrumb22ba.nextCommandLabel, "Breadcrumb next-test cue should pick the actionable assignment line");
    assertEquals("Agility 30+ reached", nextCue.title, "Next experiment cue should name the first failing mission check");
    assertEquals(true, /Lower mass/.test(nextCue.body), "Next experiment cue should reuse the mission waiting message");
    assertEquals(true, /use_hopper\(\)/.test(nextCue.command), "Next experiment cue should include runnable scaffold code");
    assertEquals(true, /hopper\.engine = 6/.test(nextCue.command), "Next experiment cue should keep the mission's target syntax");
    assertEquals(nextCue, game.lastScienceDelta.nextExperiment, "Next experiment cue should be pinned to the latest delta");
    assertEquals("ASSIGN", game.getCommandCodeSkillChip("hopper.mass = 1.2"), "Code-skill helper should identify assignments");
    assertEquals("IF", game.getCommandCodeSkillChip("CODE if chance(100): player.say('path A')"), "Code-skill helper should ignore display prefixes before classification");
    assertEquals("LOOP", game.getCommandCodeSkillChip("repeat(3): spawn_block()"), "Code-skill helper should identify loops");
    assertEquals("IF", game.getCommandCodeSkillChip("if player.touching('ice'): friction = 8"), "Code-skill helper should identify conditionals");
    assertEquals("CALL", game.getCommandCodeSkillChip("use_hopper()"), "Code-skill helper should identify function calls");
    game.state = 'playing';
    game.canvas = { width: 720, height: 448 };
    const runCue = game.getScienceDeltaRunCue();
    assertEquals("EVIDENCE", runCue.label, "In-run evidence ticker should label itself");
    assertEquals("CODE hopper.mass = 1.2", runCue.codeLine, "In-run evidence ticker should show the code line that caused the changed value");
    assertEquals("ASSIGN", runCue.codeSkillChip, "In-run evidence ticker should name the coding construct behind the code line");
    assertEquals(true, /Mass:/.test(runCue.valueLine), "In-run evidence ticker should name the changed science value");
    assertEquals(true, /Less mass/.test(runCue.reasonLine), "In-run evidence ticker should preserve the science cue");
    assertEquals("F/m=a", runCue.formulaChip, "In-run evidence ticker should name the science relation behind the changed value");
    assertEquals("-1.3", runCue.deltaChip, "In-run evidence ticker should expose the numeric size of the changed value");
    assertEquals(true, /TARGET Agility/.test(runCue.targetLine), "In-run evidence ticker should show progress toward the active mission target");
    assertEquals("NEXT 90% TARGET", runCue.targetNextLine, "In-run evidence ticker should preview the next target checkpoint");
    assertEquals(true, /^\+\d/.test(runCue.targetNeedLine), "In-run evidence ticker should show how much more is needed for the next checkpoint");
    assertEquals(true, Number(runCue.targetProgressBefore) < Number(runCue.targetProgress), "In-run evidence ticker should expose the before-to-after target movement");
    assertEquals(true, Number(runCue.targetProgress) > 0, "In-run evidence ticker should expose target progress for the mini meter");
    assertEquals("NEXT Agility 30+ reached", runCue.nextLine, "In-run evidence ticker should show the next experiment title");
    const deltaLabels = [];
    const deltaRects = [];
    const fakeDeltaCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect(x, y, w, h) { deltaRects.push({ x, y, w, h }); },
      fillText(text) { deltaLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    const drawnDeltaCue = game.drawScienceDeltaRunCue(fakeDeltaCtx);
    assertEquals("EVIDENCE", drawnDeltaCue.label, "Drawing should return the in-run evidence cue");
    assertEquals(true, deltaLabels.includes("EVIDENCE"), "Drawing should write the evidence ticker label");
    assertEquals(true, deltaLabels.includes("ASSIGN"), "Drawing should write the evidence ticker coding construct chip");
    assertEquals(true, deltaLabels.includes("CODE hopper.mass = 1.2"), "Drawing should write the causal code line");
    assertEquals(true, deltaLabels.includes("F/m=a"), "Drawing should write the science relation chip");
    assertEquals(true, deltaLabels.includes("DELTA -1.3"), "Drawing should write the numeric delta chip");
    assertEquals(true, deltaLabels.some(text => /TARGET Agility/.test(text)), "Drawing should write the active target line");
    assertEquals(true, deltaLabels.some(text => /^NEXT 90% \+/.test(text)), "Drawing should write the next target checkpoint and needed amount");
    assertEquals(true, deltaRects.some(rect => rect && rect.h === 5), "Drawing should highlight the before-to-after target movement segment");
    assertEquals(true, deltaRects.some(rect => rect && rect.h === 8), "Drawing should mark the after-position on the target rail");
    assertEquals(true, deltaLabels.some(text => /Mass:/.test(text)), "Drawing should write the changed science value");
    assertEquals(true, deltaLabels.includes("NEXT Agility 30+ reached"), "Drawing should write the next experiment title");
    assertEquals(true, drawnDeltaCue.h > 68, "Evidence ticker should reserve compact space for code plus next experiment rows");
    const breadcrumbLabels = [];
    const breadcrumbCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      translate() {},
      fillText(text) { breadcrumbLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    const drawnBreadcrumbs = game.drawScienceBreadcrumbEffects(breadcrumbCtx);
    assertEquals(1, drawnBreadcrumbs.length, "Drawing should return the experiment breadcrumb payload");
    assertEquals("CODE hopper.mass = 1.2", drawnBreadcrumbs[0].codeLine, "Drawn breadcrumb should expose the causal code");
    assertEquals("ASSIGN", drawnBreadcrumbs[0].codeSkillChip, "Drawn breadcrumb should expose the coding construct chip");
    assertEquals("F/m=a", drawnBreadcrumbs[0].relation, "Drawn breadcrumb should expose the science relation");
    assertEquals("Mass 2.5 -> 1.2 (-1.3)", drawnBreadcrumbs[0].valueLine, "Drawn breadcrumb should expose the changed value");
    assertEquals("DELTA -1.3", drawnBreadcrumbs[0].deltaLabel, "Drawn breadcrumb should expose the signed delta label");
    assertEquals("", drawnBreadcrumbs[0].predictionLabel, "Drawn breadcrumb should omit prediction chip without a selected hypothesis");
    assertEquals("NEXT Agility 30+ reached", drawnBreadcrumbs[0].nextLabel, "Drawn breadcrumb should expose the next-test title");
    assertEquals("TRY hopper.engine = 6", drawnBreadcrumbs[0].nextCommandLabel, "Drawn breadcrumb should expose the next-test command");
    assertEquals(true, breadcrumbLabels.includes("CODE"), "Breadcrumb draw should label the code side");
    assertEquals(true, breadcrumbLabels.includes("ASSIGN"), "Breadcrumb draw should write the coding construct chip");
    assertEquals(true, breadcrumbLabels.includes("RESULT"), "Breadcrumb draw should label the result side");
    assertEquals(true, breadcrumbLabels.includes("F/m=a"), "Breadcrumb draw should write the formula relation");
    assertEquals(true, breadcrumbLabels.includes("DELTA -1.3"), "Breadcrumb draw should write the numeric delta");
    assertEquals(true, breadcrumbLabels.includes("NEXT Agility 30+ reached"), "Breadcrumb draw should write the next-test title");
    assertEquals(true, breadcrumbLabels.some(text => /TRY hopper\.engine/.test(text)), "Breadcrumb draw should write the next-test command");
    assertEquals(true, breadcrumbLabels.includes("Mass"), "Breadcrumb draw should write the changed value label");
    game.scienceBreadcrumbEffects[0].life = game.scienceBreadcrumbEffects[0].maxLife - 1;
    game.updateScienceBreadcrumbEffects();
    assertEquals(0, game.scienceBreadcrumbEffects.length, "Experiment breadcrumb should expire instead of becoming permanent clutter");
    game.lastScienceDelta.time = Date.now() - 19000;
    assertEquals(null, game.getScienceDeltaRunCue(), "In-run evidence ticker should expire instead of becoming permanent clutter");

    const chanceBefore = captureScienceDeltaSnapshot(game);
    const chanceRes = Compiler.runCommand("if chance(100): player.say('path A')", game);
    const chanceDelta = recordScienceDelta(game, chanceBefore, captureScienceDeltaSnapshot(game), "if chance(100): player.say('path A')");
    const chanceText = chanceDelta && chanceDelta.changes ? chanceDelta.changes.map(change => `${change.label} ${change.value} ${change.cue || ""}`).join(" ") : "";
    assertEquals(true, chanceRes.success, chanceRes.msg);
    assertEquals(true, !!chanceDelta, "Chance code should produce a probability science delta");
    assertEquals("Probability changed", chanceDelta.summary, "Chance-only code should summarize the probability row");
    assertEquals(1, game.chanceTrialStats && game.chanceTrialStats.trials, "Chance code stores one trial on the game");
    assertEquals(1, game.chanceTrialStats && game.chanceTrialStats.passes, "chance(100) stores one pass on the game");
    assertEquals(true, /Probability/.test(chanceText), "Chance delta should name probability as the changed evidence");
    assertEquals(true, /1\/1 passed \(100%\)/.test(chanceText), "Chance delta should show observed pass rate");
    assertEquals(true, /Target chance 100/.test(chanceText), "Chance delta should show the target probability");
    assertEquals(true, /More trials reveal the pattern/.test(chanceText), "Chance delta should nudge repeated trials");
    const chanceRunCue = game.getScienceDeltaRunCue();
    assertEquals("IF", chanceRunCue.codeSkillChip, "Probability evidence ticker should identify the conditional that produced the chance trial");
    assertEquals("", chanceRunCue.targetLine, "Probability-only experiments should not show an unrelated mission target line");

    const targetReadyLabels = [];
    let targetReadyBursts = 0;
    ComicBubbles.pop = (x, y, text) => { targetReadyLabels.push(text); };
    Particles.spawnBurst = () => { targetReadyBursts++; };
    const targetGame = new StarHopperGame();
    targetGame.player = { charType: 'hopper', x: 40, y: 84, w: 24, h: 32, mass: 1, fuel: 100 };
    targetGame.spawnedBoxes = [];
    targetGame.interactiveObjects = [];
    targetGame.targetTestAgility = 8;
    targetGame.getActiveMass = () => 1;
    targetGame.getEngineForce = () => 4;
    targetGame.getJumpForce = () => 10;
    targetGame.getDesignGravity = () => 1;
    targetGame.getCurrentFriction = () => 0;
    targetGame.getMissionStat = function () {
      return { key: 'agility', label: 'Agility', value: this.targetTestAgility, target: 10 };
    };
    const targetBefore = captureScienceDeltaSnapshot(targetGame);
    targetGame.targetTestAgility = 11;
    const targetDelta = recordScienceDelta(targetGame, targetBefore, captureScienceDeltaSnapshot(targetGame), "hopper.engine = 8");
    assertEquals(true, targetDelta.missionTarget && targetDelta.missionTarget.crossed, "Science delta should mark a mission stat crossing");
    assertEquals("TARGET READY", targetDelta.scienceCheckpointProof && targetDelta.scienceCheckpointProof.label, "Target-ready crossing should create a checkpoint proof");
    assertEquals(5, targetDelta.scienceCheckpointProof && targetDelta.scienceCheckpointProof.rewardXP, "Target-ready checkpoint should award the stronger proof XP");
    assertEquals(1, targetGame.discoveryPassCounts[getScienceCheckpointProofSourceKey(targetGame, targetDelta)], "Target-ready checkpoint should store a one-time source key");
    assertEquals(5, targetGame.researchXP, "Target-ready checkpoint should add Research XP");
    assertEquals("science-checkpoint", targetGame.discoveryPulse && targetGame.discoveryPulse.kind, "Target-ready checkpoint should create a Discovery Pulse");
    assertEquals(null, grantScienceCheckpointProof(targetGame, targetDelta), "Repeating a target-ready checkpoint should not farm rewards");
    assertEquals(5, targetGame.researchXP, "Repeated target-ready checkpoint should not add more Research XP");
    assertEquals(true, targetReadyLabels.includes("TARGET READY!"), "Crossing the mission target should pop a visible ready cue");
    assertEquals(true, targetReadyLabels.includes("AGILITY 11/10"), "Ready cue should show the live stat over the target");
    assertEquals(true, targetReadyLabels.includes("+5 CHECKPOINT"), "Target-ready checkpoint should pop the proof reward");
    assertEquals("TARGET READY: Agility 11/10", targetGame.missionBalloon && targetGame.missionBalloon.text, "Mission CRT should announce the target-ready payoff");
    assertEquals(true, targetReadyBursts >= 4, "Target-ready payoff should add extra particle feedback");
    targetGame.state = 'playing';
    targetGame.canvas = { width: 720, height: 448 };
    const targetReadyCue = targetGame.getScienceDeltaRunCue();
    assertEquals(true, targetReadyCue.targetReady, "Crossed mission target should render as ready in the evidence ticker");
    assertEquals("", targetReadyCue.targetNextLine, "Ready target ticker should not preview another checkpoint");
    assertEquals("", targetReadyCue.targetNeedLine, "Ready target ticker should not show another needed amount");
    assertEquals(true, Number(targetReadyCue.targetProgressBefore) < 1, "Ready ticker should preserve the before-target progress");
    assertEquals(1, targetReadyCue.targetProgress, "Ready ticker should clamp after-target progress to the complete rail");

    const targetCloserLabels = [];
    let targetCloserBursts = 0;
    ComicBubbles.pop = (x, y, text) => { targetCloserLabels.push(text); };
    Particles.spawnBurst = () => { targetCloserBursts++; };
    const targetCloserGame = new StarHopperGame();
    targetCloserGame.player = { charType: 'hopper', x: 54, y: 92, w: 24, h: 32, mass: 1, fuel: 100 };
    targetCloserGame.spawnedBoxes = [];
    targetCloserGame.interactiveObjects = [];
    targetCloserGame.targetTestAgility = 1;
    targetCloserGame.getActiveMass = () => 1;
    targetCloserGame.getEngineForce = () => 4;
    targetCloserGame.getJumpForce = () => 10;
    targetCloserGame.getDesignGravity = () => 1;
    targetCloserGame.getCurrentFriction = () => 0;
    targetCloserGame.getMissionStat = function () {
      return { key: 'agility', label: 'Agility', value: this.targetTestAgility, target: 10 };
    };
    const targetCloserBefore = captureScienceDeltaSnapshot(targetCloserGame);
    targetCloserGame.targetTestAgility = 3;
    const targetCloserDelta = recordScienceDelta(targetCloserGame, targetCloserBefore, captureScienceDeltaSnapshot(targetCloserGame), "hopper.engine = 5");
    assertEquals(false, targetCloserDelta.missionTarget && targetCloserDelta.missionTarget.crossed, "Closer target movement should not mark the target complete");
    assertEquals(null, targetCloserDelta.missionTarget && targetCloserDelta.missionTarget.milestone, "Closer target movement should not invent a checkpoint milestone");
    assertEquals(null, targetCloserDelta.scienceCheckpointProof || null, "Closer target movement should not create a checkpoint proof");
    assertEquals(0, targetCloserGame.researchXP || 0, "Closer target movement should not award Research XP");
    assertEquals(null, targetCloserGame.discoveryPulse || null, "Closer target movement should not create a Discovery Pulse");
    assertEquals(true, targetCloserLabels.includes("CLOSER +20%"), "Closer target movement should pop a non-XP progress cue");
    assertEquals(true, targetCloserLabels.includes("AGILITY 3/10"), "Closer cue should show the updated target stat");
    assertEquals("TARGET CLOSER: Agility 3/10", targetCloserGame.missionBalloon && targetCloserGame.missionBalloon.text, "Mission CRT should announce non-XP target momentum");
    assertEquals("CLOSER +20%", targetCloserGame.lastScienceDeltaEffect && targetCloserGame.lastScienceDeltaEffect.targetCloser && targetCloserGame.lastScienceDeltaEffect.targetCloser.label, "Closer target movement should be inspectable as a visual effect");
    assertEquals(true, targetCloserBursts >= 4, "Closer target movement should still get lightweight particles");

    const targetFartherLabels = [];
    let targetFartherBursts = 0;
    ComicBubbles.pop = (x, y, text) => { targetFartherLabels.push(text); };
    Particles.spawnBurst = () => { targetFartherBursts++; };
    const targetFartherGame = new StarHopperGame();
    targetFartherGame.player = { charType: 'hopper', x: 58, y: 94, w: 24, h: 32, mass: 1, fuel: 100 };
    targetFartherGame.spawnedBoxes = [];
    targetFartherGame.interactiveObjects = [];
    targetFartherGame.targetTestAgility = 5;
    targetFartherGame.getActiveMass = () => 1;
    targetFartherGame.getEngineForce = () => 4;
    targetFartherGame.getJumpForce = () => 10;
    targetFartherGame.getDesignGravity = () => 1;
    targetFartherGame.getCurrentFriction = () => 0;
    targetFartherGame.getMissionStat = function () {
      return { key: 'agility', label: 'Agility', value: this.targetTestAgility, target: 10 };
    };
    const targetFartherBefore = captureScienceDeltaSnapshot(targetFartherGame);
    targetFartherGame.targetTestAgility = 3;
    const targetFartherDelta = recordScienceDelta(targetFartherGame, targetFartherBefore, captureScienceDeltaSnapshot(targetFartherGame), "hopper.mass = 3");
    assertEquals(false, targetFartherDelta.missionTarget && targetFartherDelta.missionTarget.crossed, "Farther target movement should not mark the target complete");
    assertEquals(null, targetFartherDelta.missionTarget && targetFartherDelta.missionTarget.milestone, "Farther target movement should not invent a checkpoint milestone");
    assertEquals(null, targetFartherDelta.scienceCheckpointProof || null, "Farther target movement should not create a checkpoint proof");
    assertEquals(0, targetFartherGame.researchXP || 0, "Farther target movement should not award Research XP");
    assertEquals(null, targetFartherGame.discoveryPulse || null, "Farther target movement should not create a Discovery Pulse");
    assertEquals(true, targetFartherLabels.includes("COMPARE -20%"), "Farther target movement should pop a compare cue instead of a reward");
    assertEquals(true, targetFartherLabels.includes("AGILITY 3/10"), "Compare cue should show the updated target stat");
    assertEquals("TARGET COMPARE: Agility 3/10", targetFartherGame.missionBalloon && targetFartherGame.missionBalloon.text, "Mission CRT should announce target regression as comparison evidence");
    assertEquals("COMPARE -20%", targetFartherGame.lastScienceDeltaEffect && targetFartherGame.lastScienceDeltaEffect.targetFarther && targetFartherGame.lastScienceDeltaEffect.targetFarther.label, "Farther target movement should be inspectable as a visual effect");
    assertEquals(true, targetFartherBursts >= 4, "Farther target movement should still get lightweight particles");
    targetFartherGame.state = 'playing';
    targetFartherGame.canvas = { width: 720, height: 448 };
    const targetFartherCue = targetFartherGame.getScienceDeltaRunCue();
    assertEquals(true, Number(targetFartherCue.targetProgressBefore) > Number(targetFartherCue.targetProgress), "Evidence ticker should expose target movement away from the goal");
    assertEquals("NEXT 50% TARGET", targetFartherCue.targetNextLine, "Target regression should keep the next checkpoint visible");
    assertEquals("+2", targetFartherCue.targetNeedLine, "Target regression should show how much is needed to recover the next checkpoint");

    const targetStepLabels = [];
    let targetStepBursts = 0;
    ComicBubbles.pop = (x, y, text) => { targetStepLabels.push(text); };
    Particles.spawnBurst = () => { targetStepBursts++; };
    const targetStepGame = new StarHopperGame();
    targetStepGame.player = { charType: 'hopper', x: 50, y: 88, w: 24, h: 32, mass: 1, fuel: 100 };
    targetStepGame.spawnedBoxes = [];
    targetStepGame.interactiveObjects = [];
    targetStepGame.targetTestAgility = 4;
    targetStepGame.getActiveMass = () => 1;
    targetStepGame.getEngineForce = () => 4;
    targetStepGame.getJumpForce = () => 10;
    targetStepGame.getDesignGravity = () => 1;
    targetStepGame.getCurrentFriction = () => 0;
    targetStepGame.getMissionStat = function () {
      return { key: 'agility', label: 'Agility', value: this.targetTestAgility, target: 10 };
    };
    const targetStepBefore = captureScienceDeltaSnapshot(targetStepGame);
    targetStepGame.targetTestAgility = 7;
    const targetStepDelta = recordScienceDelta(targetStepGame, targetStepBefore, captureScienceDeltaSnapshot(targetStepGame), "hopper.engine = 7");
    assertEquals(false, targetStepDelta.missionTarget && targetStepDelta.missionTarget.crossed, "Partial target movement should not mark the target complete");
    assertEquals("HALFWAY!", targetStepDelta.missionTarget && targetStepDelta.missionTarget.milestone && targetStepDelta.missionTarget.milestone.label, "Crossing 50% should store a target milestone");
    assertEquals("TARGET CHECKPOINT", targetStepDelta.scienceCheckpointProof && targetStepDelta.scienceCheckpointProof.label, "Crossing a target milestone should create a checkpoint proof");
    assertEquals(3, targetStepDelta.scienceCheckpointProof && targetStepDelta.scienceCheckpointProof.rewardXP, "Partial target checkpoint should award small proof XP");
    assertEquals(1, targetStepGame.discoveryPassCounts[getScienceCheckpointProofSourceKey(targetStepGame, targetStepDelta)], "Partial target checkpoint should store a one-time source key");
    assertEquals(3, targetStepGame.researchXP, "Partial target checkpoint should add Research XP");
    assertEquals(null, grantScienceCheckpointProof(targetStepGame, targetStepDelta), "Repeating a partial target checkpoint should not farm rewards");
    assertEquals(3, targetStepGame.researchXP, "Repeated partial target checkpoint should not add more Research XP");
    assertEquals(true, targetStepLabels.includes("HALFWAY!"), "Crossing a target milestone should pop a visible progress cue");
    assertEquals(true, targetStepLabels.includes("50% TARGET"), "Target milestone cue should show the crossed threshold");
    assertEquals(true, targetStepLabels.includes("+3 CHECKPOINT"), "Partial target checkpoint should pop the proof reward");
    assertEquals("TARGET STEP: Agility 7/10", targetStepGame.missionBalloon && targetStepGame.missionBalloon.text, "Mission CRT should announce non-XP target progress");
    assertEquals(true, targetStepBursts >= 4, "Target milestone should add extra particle feedback");
    const checkpointPanel22ba = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll() { return []; }
    };
    document.getElementById = (id) => id === "discovery-pulse" ? checkpointPanel22ba : null;
    updateDiscoveryPulse(targetStepGame);
    assertEquals(true, /TARGET CHECKPOINT \+3 XP/.test(checkpointPanel22ba.innerHTML), "Discovery Pulse should render the checkpoint reward");
    assertEquals(true, /HALFWAY!/.test(checkpointPanel22ba.innerHTML) && /Agility 7\.0\/10/.test(checkpointPanel22ba.innerHTML), "Checkpoint pulse should show the threshold and target stat");
    targetStepGame.state = 'playing';
    targetStepGame.canvas = { width: 720, height: 448 };
    const targetStepCue = targetStepGame.getScienceDeltaRunCue();
    assertEquals("NEXT 75% TARGET", targetStepCue.targetNextLine, "Partial target step should preview the next checkpoint");
    assertEquals("+0.5", targetStepCue.targetNeedLine, "Partial target step should show the stat gap to the next checkpoint");

    const inputEl = {
      value: "",
      focused: false,
      selection: null,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange(start, end) { this.selection = [start, end]; }
    };
    document.getElementById = (id) => id === "console-input" ? inputEl : null;
    window.Game = game;
    assertEquals(true, stageScienceDeltaCommand(nextCue.command), "Stage button helper should write the command to the console");
    assertEquals(nextCue.command.trim(), inputEl.value, "Staged command should match the next experiment command");
    assertEquals(true, inputEl.focused, "Staging should focus the terminal input");
    assertEquals("CODE STAGED: press Enter to test", game.missionBalloon.text, "Staging should create an on-canvas mission cue");
    assertEquals("MISSION CRT", game.missionBalloon.title, "Staging cue should use the mission monitor");
    window.Game = oldWindowGame22ba;
    document.getElementById = oldGetElementById22ba;
    ComicBubbles.pop = oldBubblePop22ba;
    Particles.spawnBurst = oldParticleBurst22ba;
    renderTestResult("engine-suite", "Curriculum: code runs create science delta feedback", true);
  } catch (err) {
    window.Game = oldWindowGame22ba;
    document.getElementById = oldGetElementById22ba;
    ComicBubbles.pop = oldBubblePop22ba;
    Particles.spawnBurst = oldParticleBurst22ba;
    renderTestResult("engine-suite", "Curriculum: code runs create science delta feedback", false, err.message);
  }

  // Test 22bb: correct predictions become one-time hypothesis confirmations.
  const oldGetElementById22bb = document.getElementById;
  const oldBubblePop22bb = ComicBubbles.pop;
  const oldParticleBurst22bb = Particles.spawnBurst;
  try {
    const bubbleLabels22bb = [];
    const particleColors22bb = [];
    ComicBubbles.pop = (x, y, text) => { bubbleLabels22bb.push(text); };
    Particles.spawnBurst = (x, y, color) => { particleColors22bb.push(color); };

    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const partial = {
      allPassed: false,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: false, message: "Still locked" }
      ]
    };
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;

    const game = new StarHopperGame();
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.coachPredictions = { [activeMission.id]: "lighter-longer" };
    const pulse = recordDiscoveryPulse(game, activeMission, "hopper.mass = 1.2", partial, 0);
    const firstXP = game.researchXP;
    assertEquals(true, !!pulse.hypothesisConfirmed, "Correct prediction should confirm the hypothesis on new progress");
    assertEquals(6, pulse.hypothesisBonusXP, "Hypothesis confirmation should award the bonus XP");
    assertEquals(true, game.confirmedHypotheses.has(activeMission.id), "Confirmed hypothesis should be stored by mission");
    assertEquals(true, /HYPOTHESIS CONFIRMED \+6 XP/.test(panel.innerHTML), "Discovery pulse should render the hypothesis chip");
    assertEquals(true, /LAB PERK UNLOCKED: Hypothesis Bonus/.test(panel.innerHTML), "Discovery pulse should render the lab-perk unlock chip");
    assertEquals(true, bubbleLabels22bb.some(label => /HYPOTHESIS/.test(label)), "Correct prediction should pop a hypothesis cue in the level");
    assertEquals(true, particleColors22bb.some(color => color === "#a7f3d0"), "Correct prediction should spawn a hypothesis burst");
    game.state = 'playing';
    game.canvas = { width: 720, height: 448 };
    game.currentPlanetIndex = 1;
    game.lastScienceDelta = {
      code: "hopper.mass = 1.2",
      summary: "Mass changed",
      time: Date.now(),
      changes: [
        { label: "Mass", value: "2.5 -> 1.2 (-1.3)", direction: "down", cue: "Less mass makes the same force accelerate more." }
      ]
    };
    const predictionCue = game.getScienceDeltaRunCue();
    assertEquals("PREDICT OK +6 XP", predictionCue.predictionLine, "Evidence ticker should connect the tested code to the confirmed prediction reward");
    const predictionLabels = [];
    const predictionCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect() {},
      fillText(text) { predictionLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    game.drawScienceDeltaRunCue(predictionCtx);
    assertEquals(true, predictionLabels.includes("PREDICT OK +6 XP"), "Evidence ticker draw should write the prediction verdict chip");
    game.scienceBreadcrumbEffects = [];
    const predictionBreadcrumb = game.spawnScienceBreadcrumbEffect(game.lastScienceDelta, game.lastScienceDelta.changes[0], { x: 120, y: 96, color: "#93c5fd" });
    assertEquals("PREDICT OK +6 XP", predictionBreadcrumb.predictionLabel, "Experiment breadcrumb should carry rewarded prediction verdicts");
    assertEquals("#fef08a", predictionBreadcrumb.predictionColor, "Confirmed prediction breadcrumb chip should use the prediction color");
    const predictionBreadcrumbLabels = [];
    const predictionBreadcrumbCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      translate() {},
      fillText(text) { predictionBreadcrumbLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    const drawnPredictionBreadcrumb = game.drawScienceBreadcrumbEffects(predictionBreadcrumbCtx);
    assertEquals("PREDICT OK +6 XP", drawnPredictionBreadcrumb[0].predictionLabel, "Drawn breadcrumb should expose the rewarded prediction verdict");
    assertEquals(true, predictionBreadcrumbLabels.includes("PREDICT OK +6 XP"), "Breadcrumb draw should write the rewarded prediction chip");
    const afterHypothesisBubbles22bb = bubbleLabels22bb.filter(label => /HYPOTHESIS/.test(label)).length;
    const afterHypothesisBursts22bb = particleColors22bb.filter(color => color === "#a7f3d0").length;

    const complete = { allPassed: true, items: partial.items.map(item => ({ ...item, passed: true })) };
    const secondPulse = recordDiscoveryPulse(game, activeMission, "hopper.engine = 6", complete, 0);
    assertEquals(false, !!secondPulse.hypothesisConfirmed, "Same mission should not pay the prediction bonus twice");
    assertEquals(1, game.confirmedHypotheses.size, "Confirmed hypothesis set should not grow on repeat mission progress");
    assertEquals(true, game.researchXP > firstXP, "Regular progress XP should still apply after the one-time bonus");
    const repeatPredictionCue = game.getScienceDeltaRunCue();
    assertEquals("PREDICT OK", repeatPredictionCue.predictionLine, "Evidence ticker should still show correct repeated predictions without another XP bonus");
    game.scienceBreadcrumbEffects = [];
    const repeatBreadcrumb = game.spawnScienceBreadcrumbEffect(game.lastScienceDelta, game.lastScienceDelta.changes[0], { x: 128, y: 98, color: "#93c5fd" });
    assertEquals("PREDICT OK", repeatBreadcrumb.predictionLabel, "Experiment breadcrumb should carry repeat prediction verdicts without XP");
    assertEquals(afterHypothesisBubbles22bb, bubbleLabels22bb.filter(label => /HYPOTHESIS/.test(label)).length, "Repeat mission progress should not spawn another hypothesis cue");
    assertEquals(afterHypothesisBursts22bb, particleColors22bb.filter(color => color === "#a7f3d0").length, "Repeat mission progress should not spawn another hypothesis burst");

    const wrong = new StarHopperGame();
    wrong.player = { x: 100, y: 120, w: 24, h: 32 };
    wrong.currentPlanet = PLANETS[0];
    wrong.currentPlanetIndex = 0;
    wrong.coachPredictions = { [activeMission.id]: "heavier" };
    const wrongPulse = recordDiscoveryPulse(wrong, activeMission, "hopper.mass = 1.2", partial, 0);
    assertEquals(false, !!wrongPulse.hypothesisConfirmed, "Wrong prediction should not award the hypothesis bonus");
    assertEquals(0, wrong.confirmedHypotheses.size, "Wrong prediction should not be marked confirmed");
    assertEquals(afterHypothesisBursts22bb, particleColors22bb.filter(color => color === "#a7f3d0").length, "Wrong prediction should not spawn hypothesis particles");
    wrong.state = 'playing';
    wrong.canvas = { width: 720, height: 448 };
    wrong.lastScienceDelta = {
      code: "hopper.mass = 1.2",
      summary: "Mass changed",
      time: Date.now(),
      changes: [
        { label: "Mass", value: "2.5 -> 1.2 (-1.3)", direction: "down", cue: "Less mass makes the same force accelerate more." }
      ]
    };
    const wrongPredictionCue = wrong.getScienceDeltaRunCue();
    assertEquals("PREDICT SURPRISE", wrongPredictionCue.predictionLine, "Evidence ticker should mark wrong predictions as useful surprise evidence");
    assertEquals("#fca5a5", wrongPredictionCue.predictionColor, "Surprise prediction cue should use the compare/warning color without reward");
    wrong.scienceBreadcrumbEffects = [];
    const wrongBreadcrumb = wrong.spawnScienceBreadcrumbEffect(wrong.lastScienceDelta, wrong.lastScienceDelta.changes[0], { x: 112, y: 108, color: "#93c5fd" });
    assertEquals("PREDICT SURPRISE", wrongBreadcrumb.predictionLabel, "Experiment breadcrumb should carry surprise prediction verdicts");
    assertEquals("#fca5a5", wrongBreadcrumb.predictionColor, "Surprise breadcrumb chip should use the prediction color");
    const wrongPredictionLabels = [];
    const wrongPredictionCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect() {},
      fillText(text) { wrongPredictionLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    wrong.drawScienceDeltaRunCue(wrongPredictionCtx);
    assertEquals(true, wrongPredictionLabels.includes("PREDICT SURPRISE"), "Evidence ticker draw should write the surprise prediction verdict");
    const wrongBreadcrumbLabels = [];
    const wrongBreadcrumbCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      translate() {},
      fillText(text) { wrongBreadcrumbLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 5 }; }
    };
    const drawnWrongBreadcrumb = wrong.drawScienceBreadcrumbEffects(wrongBreadcrumbCtx);
    assertEquals("PREDICT SURPRISE", drawnWrongBreadcrumb[0].predictionLabel, "Drawn breadcrumb should expose the surprise prediction verdict");
    assertEquals(true, wrongBreadcrumbLabels.includes("PREDICT SURPRISE"), "Breadcrumb draw should write the surprise prediction chip");

    document.getElementById = oldGetElementById22bb;
    ComicBubbles.pop = oldBubblePop22bb;
    Particles.spawnBurst = oldParticleBurst22bb;
    renderTestResult("engine-suite", "Curriculum: correct predictions earn hypothesis bonuses", true);
  } catch (err) {
    document.getElementById = oldGetElementById22bb;
    ComicBubbles.pop = oldBubblePop22bb;
    Particles.spawnBurst = oldParticleBurst22bb;
    renderTestResult("engine-suite", "Curriculum: correct predictions earn hypothesis bonuses", false, err.message);
  }

  // Test 22bb2: completing the Hypothesis Proof collection creates a one-time mastery payoff.
  const oldGetElementById22bb2 = document.getElementById;
  const oldBubblePop22bb2 = ComicBubbles.pop;
  const oldParticleBurst22bb2 = Particles.spawnBurst;
  try {
    const proofMissions = getHypothesisPortfolioMissions();
    const finalProof = proofMissions[proofMissions.length - 1];
    const activeMission = PLANETS[finalProof.planetIndex].missions.find(mission => mission.id === finalProof.id);
    const correctOption = activeMission.fullMission.prediction.options.find(option => option.correct);
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const game = new StarHopperGame();
    game.currentPlanetIndex = finalProof.planetIndex;
    game.currentPlanet = PLANETS[finalProof.planetIndex];
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.discoveryPassCounts = {};
    game.masteryMeters = {};
    game.confirmedHypotheses = new Set(proofMissions.filter(mission => mission.id !== finalProof.id).map(mission => mission.id));
    game.coachPredictions = { [finalProof.id]: correctOption.id };
    const resultState = {
      allPassed: false,
      items: [{ id: "hypothesis-final-check", label: "Final prediction proof", passed: true, message: "Prediction evidence logged" }]
    };
    const pulse = recordDiscoveryPulse(game, activeMission, "compare evidence", resultState, 0);
    assertEquals(true, !!pulse.hypothesisConfirmed, "Final correct prediction should still create the normal hypothesis confirmation");
    assertEquals("HYPOTHESIS MASTERED", pulse.hypothesisDeckMastery && pulse.hypothesisDeckMastery.label, "Final hypothesis should create a collection mastery chip");
    assertEquals(10, pulse.hypothesisDeckMastery && pulse.hypothesisDeckMastery.rewardXP, "Hypothesis Proof mastery should award Research XP");
    assertEquals(proofMissions.length, pulse.hypothesisDeckMastery && pulse.hypothesisDeckMastery.count, "Hypothesis mastery should count all confirmed proofs");
    assertEquals(proofMissions.length, pulse.hypothesisDeckMastery && pulse.hypothesisDeckMastery.total, "Hypothesis mastery should know the proof total");
    assertEquals(1, game.discoveryPassCounts["hypothesis-proof-mastery"], "Hypothesis mastery should store a one-time source");
    assertEquals(true, game.researchXP >= 16, "Hypothesis mastery should add Research XP to the final confirmation reward");
    assertEquals(true, game.getWorldMasteryProgress(finalProof.planetIndex).xp >= 14, "Hypothesis mastery should feed world mastery");
    assertEquals(true, labels.includes("HYPOTHESIS DECK!"), "Hypothesis mastery should pop a collection cue");
    assertEquals(true, labels.includes(`${proofMissions.length}/${proofMissions.length} PROOFS`), "Hypothesis mastery cue should show full proof count");
    assertEquals(true, bursts > 0, "Hypothesis mastery should spawn reward particles");
    assertEquals(true, /HYPOTHESIS MASTERED \+10 XP/.test(panel.innerHTML), "Discovery Pulse should render the Hypothesis Proof mastery chip");
    assertEquals(true, /HYPOTHESIS PROOFS COMPLETE/.test(panel.innerHTML), "Discovery Pulse should show the completed Hypothesis Proof unlock card");
    const cadetRecord = getCadetIdentityPreview(game);
    assertEquals(true, new RegExp(`Hypothesis Proofs mastered ${proofMissions.length}\\/${proofMissions.length}`).test(cadetRecord.body), "Cadet Record should celebrate completed Hypothesis Proofs");
    assertEquals(null, cadetRecord.hypothesisAction, "Completed Hypothesis Proofs should not leave a stale route action");
    const xpAfterFirst = game.researchXP;
    assertEquals(null, game.grantHypothesisDeckMastery(pulse), "Repeating Hypothesis Proof mastery should be blocked");
    assertEquals(xpAfterFirst, game.researchXP, "Repeated Hypothesis Proof mastery should not farm Research XP");

    document.getElementById = oldGetElementById22bb2;
    ComicBubbles.pop = oldBubblePop22bb2;
    Particles.spawnBurst = oldParticleBurst22bb2;
    renderTestResult("engine-suite", "Curriculum: Hypothesis Proof mastery rewards full collection", true);
  } catch (err) {
    document.getElementById = oldGetElementById22bb2;
    ComicBubbles.pop = oldBubblePop22bb2;
    Particles.spawnBurst = oldParticleBurst22bb2;
    renderTestResult("engine-suite", "Curriculum: Hypothesis Proof mastery rewards full collection", false, err.message);
  }

  // Test 22bc: Loop Engineer's Combo Amplifier pays only for chained NEW progress.
  const oldGetElementById22bc = document.getElementById;
  const oldWindowGame22bc = window.Game;
  try {
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const complete = {
      allPassed: true,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: true, message: "Gate open" }
      ]
    };
    let chainStageClick = null;
    const chainStageButton = {
      dataset: { chainNextCommand: "hopper.jump_power = 18", chainNextTitle: "Raise jump power" },
      addEventListener(event, handler) { if (event === "click") chainStageClick = handler; }
    };
    const panel = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll(selector) {
        return selector === "[data-chain-next-command]" && /data-chain-next-command/.test(this.innerHTML)
          ? [chainStageButton]
          : [];
      }
    };
    const input22bc = {
      value: "",
      focused: false,
      style: {},
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => {
      if (id === "discovery-pulse") return panel;
      if (id === "console-input") return input22bc;
      return null;
    };

    const game = new StarHopperGame();
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.researchXP = 120;
    game.discoveryCombo = 2;
    game.discoveryPassCounts = { [activeMission.id]: 1 };
    game.discoveredFormulaKinds = new Set(["engine"]);
    game.lastScienceDelta = {
      code: "hopper.engine = 6",
      nextExperiment: {
        title: "Raise jump power",
        body: "Jump is still below target; raise one force variable and compare height.",
        command: "hopper.jump_power = 18"
      }
    };
    const beforeXP = game.researchXP;
    const pulse = recordDiscoveryPulse(game, activeMission, "hopper.engine = 6", complete, 0);
    assertEquals(3, pulse.combo, "New progress extends the existing combo");
    assertEquals(3, pulse.comboBonusXP, "Base combo bonus still tracks the chain length");
    assertEquals(4, pulse.comboAmplifierBonusXP, "Loop Engineer adds the amplifier bonus");
    assertEquals("TRIPLE TEST", pulse.comboMilestone && pulse.comboMilestone.label, "A three-discovery chain should unlock the combo milestone");
    assertEquals(6, pulse.comboMilestone && pulse.comboMilestone.rewardXP, "Combo milestone should add a visible Research XP bonus");
    assertEquals(1, game.discoveryPassCounts[game.getDiscoveryComboMilestoneSourceKey(3)], "Combo milestone should store a one-time source");
    assertEquals(17, game.getWorldMasteryProgress(0).xp, "Combo milestone and science proof should both feed world mastery");
    assertEquals("TRIPLE TEST: +6 Research XP", game.missionBalloon && game.missionBalloon.text, "Combo milestone should write to the Mission CRT");
    assertEquals(true, game.researchXP > beforeXP, "Amplified combo still awards Research XP");
    assertEquals(true, /COMBO AMPLIFIER \+4 XP/.test(panel.innerHTML), "Discovery pulse renders the amplifier chip");
    assertEquals(true, /TRIPLE TEST \+6 XP/.test(panel.innerHTML), "Discovery pulse renders the combo milestone chip");
    assertEquals(true, /CHAIN NEXT x4/.test(panel.innerHTML), "Discovery pulse should show the next combo target");
    assertEquals(true, /New progress can add combo XP \+ amplifier XP/.test(panel.innerHTML), "Chain target should explain the amplified reward");
    assertEquals(true, /Unlock a new sample gate, formula card, or mission check/.test(panel.innerHTML), "Chain target should name valid new progress");
    assertEquals(true, /discovery-chain-progress lab-chain/.test(panel.innerHTML), "Discovery pulse should render lab-chain milestone pips");
    assertEquals(true, /3\/5 to FIVE TEST STREAK/.test(panel.innerHTML), "Discovery pulse should show progress toward the next named chain milestone");
    assertEquals(3, (panel.innerHTML.match(/discovery-chain-progress-pip filled/g) || []).length, "Discovery pulse should fill pips for the current combo count");
    assertEquals(1, (panel.innerHTML.match(/discovery-chain-progress-pip next/g) || []).length, "Discovery pulse should mark the next combo pip");
    assertEquals(true, /<b>NEXT<\/b>Raise jump power/.test(panel.innerHTML), "Chain target should turn the next experiment cue into a contract");
    assertEquals(true, /data-chain-next-command=\"hopper\.jump_power = 18\"/.test(panel.innerHTML), "Chain contract should expose a stageable next command");
    assertEquals("function", typeof chainStageClick, "Chain contract should wire a stage button");
    window.Game = null;
    chainStageClick();
    assertEquals("hopper.jump_power = 18", input22bc.value, "Chain stage button should move the next experiment into Mission Coach");
    assertEquals(true, input22bc.focused, "Chain stage button should focus the Mission Coach input");
    assertEquals(true, /FIVE TEST STREAK at x5 \(\+10 XP\)/.test(panel.innerHTML), "Chain target should preview the next combo milestone after Triple Test");
    assertEquals(true, /NEXT LAB UNLOCK/.test(panel.innerHTML), "Discovery pulse should show the next lab unlock target");
    assertEquals(true, /Daily Signal Lab in/.test(panel.innerHTML), "Next unlock cue should name the upcoming rank perk");
    assertEquals(true, /Reach Orbit Scientist/.test(panel.innerHTML), "Next unlock cue should connect XP to the next rank");
    assertEquals(true, /toward next lab unlock/.test(panel.innerHTML), "Next unlock cue should render progress toward the unlock");

    const afterXP = game.researchXP;
    recordDiscoveryPulse(game, activeMission, "hopper.engine = 6", complete, 0);
    assertEquals(afterXP, game.researchXP, "Repeating completed progress does not farm amplifier XP");
    assertEquals(1, game.discoveryPassCounts[game.getDiscoveryComboMilestoneSourceKey(3)], "Repeating completed progress does not reissue the combo milestone");
    assertEquals(3, game.discoveryCombo, "Repeating completed progress does not extend the combo");
    assertEquals(true, /CHAIN PAUSED/.test(panel.innerHTML), "Repeating completed progress should pause the chain hint");
    assertEquals(true, /Repeat commands do not count/.test(panel.innerHTML), "Paused chain should explain why no reward was added");

    document.getElementById = oldGetElementById22bc;
    window.Game = oldWindowGame22bc;
    renderTestResult("engine-suite", "Curriculum: combo amplifier rewards chained progress", true);
  } catch (err) {
    document.getElementById = oldGetElementById22bc;
    window.Game = oldWindowGame22bc;
    renderTestResult("engine-suite", "Curriculum: combo amplifier rewards chained progress", false, err.message);
  }

  // Test 22bc1: the active canvas HUD keeps the next lab-chain milestone visible during play.
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.canvas = { width: 720, height: 448 };
    game.discoveryCombo = 2;
    game.discoveryPulse = {
      code: "hopper.engine = 6",
      combo: 2,
      rewardXP: 10,
      cardUnlocked: true,
      openedGems: 0
    };
    game.discoveryPassCounts = {};
    game.masteryMeters = {};
    const cue = game.getLabChainRunCue();
    assertEquals("LAB CHAIN", cue.label, "Active lab-chain HUD should label the chain");
    assertEquals("active", cue.state, "Two fresh discoveries should create an active chain cue");
    assertEquals(2, cue.combo, "Active lab-chain HUD should show the current combo");
    assertEquals(3, cue.nextCombo, "Active lab-chain HUD should target the next milestone combo");
    assertEquals("TRIPLE TEST", cue.milestoneLabel, "Active lab-chain HUD should name the next milestone");
    assertEquals(6, cue.reward, "Active lab-chain HUD should show the next milestone XP");
    assertEquals("NEXT PAYS", cue.ruleChip, "Active lab-chain HUD should explain that the next fresh proof pays");
    assertEquals("1 FRESH TEST -> +6 XP", cue.contractLine, "Active lab-chain HUD should turn the next milestone into a visible reward contract");
    assertEquals(3, cue.pipTotal, "Active lab-chain HUD should size pips to the next milestone");
    assertEquals(2, cue.pipFilled, "Active lab-chain HUD should fill pips for earned fresh experiments");

    let fillTextCount = 0;
    const labels = [];
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillText(text) { fillTextCount++; labels.push(text); },
      measureText(text) { return { width: String(text || "").length * 6 }; }
    };
    const drawn = game.drawLabChainRunCue(fakeCtx);
    assertEquals("TRIPLE TEST", drawn.milestoneLabel, "Drawing should return the same lab-chain cue");
    assertEquals(true, labels.includes("NEXT PAYS"), "Drawing should write the active lab-chain rule chip");
    assertEquals(true, labels.includes("1 FRESH TEST -> +6 XP"), "Drawing should write the next reward contract");
    assertEquals(true, fillTextCount >= 3, "Drawing should write the label, title, and next-step copy");
    assertEquals("LAB CHAIN", game.lastLabChainRunCue && game.lastLabChainRunCue.label, "Drawing should cache the visible lab-chain cue");

    game.discoveryPulse = { code: "hopper.engine = 6", combo: 2, rewardXP: 0, openedGems: 0 };
    const pausedCue = game.getLabChainRunCue();
    assertEquals("CHAIN PAUSED", pausedCue.label, "Repeat progress should show the paused chain state");
    assertEquals("paused", pausedCue.state, "Paused lab-chain HUD should not look like an active reward");
    assertEquals("NO REPEATS", pausedCue.ruleChip, "Paused lab-chain HUD should explain why repeat commands do not extend the chain");
    assertEquals("FRESH TEST ONLY", pausedCue.contractLine, "Paused lab-chain HUD should explain what kind of action restarts the reward contract");
    assertEquals(true, /Fresh evidence/.test(pausedCue.title), "Paused lab-chain HUD should explain the next valid move");
    game.state = 'start';
    assertEquals(null, game.getLabChainRunCue(), "Lab-chain HUD should stay out of the start screen");
    renderTestResult("engine-suite", "Curriculum: active lab-chain HUD previews next milestone", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: active lab-chain HUD previews next milestone", false, err.message);
  }

  // Test 22bc2: the active canvas compass mirrors the top in-run objective queue item.
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.canvas = { width: 320, height: 200 };
    game.player = { x: 96, y: 118, w: 24, h: 32 };
    game.cameraX = 0;
    game.reducedMotion = true;
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.discoveryPassCounts = {};
    game.lastStagedExperiment = {
      title: "Mass Lab",
      kind: "mass",
      source: "mentor-signal",
      command: "use_hopper()\nhopper.mass = 1.0",
      time: Date.now()
    };

    const cue = game.getRunObjectiveCompassCue();
    assertEquals("READY TO TEST", cue.label, "Objective compass should mirror the top run-queue label");
    assertEquals("RESTAGE", cue.cta, "Objective compass should mirror the top run-queue action");
    assertEquals("Mass Lab", cue.title, "Objective compass should name the queued experiment");
    assertEquals("hopper.mass = 1.0", cue.commandLine, "Objective compass should show the salient assignment, not setup boilerplate");
    assertEquals("F/m=a", cue.formulaChip, "Objective compass should show the science relation for the visible command");
    assertEquals("ASSIGN", cue.codeSkillChip, "Objective compass should name the coding concept behind the visible command");
    assertEquals("FROM Village mentor", cue.rewardChip, "Objective compass should show why the staged experiment matters");
    assertEquals(true, /compare what changed/.test(cue.reasonLine), "Objective compass should preserve the science reason behind the command");
    assertEquals("mentor-signal", cue.source, "Objective compass should preserve queue source metadata");
    assertEquals(true, /READY TO TEST:Mass Lab/.test(cue.key), "Objective compass should expose a stable key for transition feedback");
    assertEquals(true, cue.queueCount >= 2, "Objective compass should know when more queued objectives follow");
    assertEquals("PREDICT", cue.trail[0] && cue.trail[0].label, "Objective compass trail should mirror the second ranked objective");
    assertEquals(true, /#2 PREDICT/.test(cue.trailLabel), "Objective compass trail should summarize the next queued step");

    const labels = [];
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect() {},
      moveTo() {},
      lineTo() {},
      fillText(text) { labels.push(text); },
      measureText(text) { return { width: String(text || "").length * 6 }; }
    };
    const drawn = game.drawRunObjectiveCompass(fakeCtx);
    assertEquals("READY TO TEST", drawn.label, "Drawing should return the visible objective cue");
    assertEquals(true, labels.some(text => /READY TO TEST/.test(text)), "Compass draw should write the ranked objective label");
    assertEquals(true, labels.includes("Mass Lab"), "Compass draw should write the experiment title");
    assertEquals(true, labels.includes("hopper.mass = 1.0"), "Compass draw should write the salient command line");
    assertEquals(true, labels.includes("F/m=a"), "Compass draw should write the command formula chip");
    assertEquals(true, labels.includes("ASSIGN"), "Compass draw should write the coding concept chip");
    assertEquals(true, labels.includes("FROM Village mentor"), "Compass draw should write the reward/source chip");
    assertEquals(true, labels.some(text => /^Press Enter/.test(text)), "Compass draw should write the science reason line");
    assertEquals(true, labels.some(text => /NEXT #2 PREDICT/.test(text)), "Compass draw should show the next queued objective trail");
    assertEquals("READY TO TEST", game.lastRunObjectiveCompassCue && game.lastRunObjectiveCompassCue.label, "Drawing should cache the visible objective cue");
    assertEquals(true, drawn.h > 60, "Compass should reserve compact space when reason and trail lines both render");
    assertEquals(0, drawn.flashFrames, "First compass draw should not pretend the objective changed");
    game.lastStagedExperiment = null;
    const nextDrawn = game.drawRunObjectiveCompass(fakeCtx);
    assertEquals("PREDICT", nextDrawn.label, "Compass should advance to the next queued objective when the staged item clears");
    assertEquals(24, nextDrawn.flashFrames, "Changing the top objective should start the compass flash");
    assertEquals(23, game.runObjectiveCompassFlash, "Compass flash timer should decay after drawing");
    game.state = 'start';
    assertEquals(null, game.getRunObjectiveCompassCue(), "Objective compass should stay out of non-playing screens");
    renderTestResult("engine-suite", "Curriculum: run objective compass mirrors queue", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: run objective compass mirrors queue", false, err.message);
  }

  // Test 22bc3: science checkpoints can become the active in-world compass target.
  const oldGetAttemptLogNextQuestion22bc3 = getAttemptLogNextQuestion;
  const oldGetLabChainTarget22bc3 = getLabChainTarget;
  const oldBuildNextExperimentCue22bc3 = buildNextExperimentCue;
  try {
    getAttemptLogNextQuestion = () => null;
    getLabChainTarget = () => null;
    buildNextExperimentCue = () => ({
      title: "Raise Agility",
      body: "Tune engine, then compare the target stat.",
      command: "use_hopper()\nhopper.engine = 6"
    });
    const game = new StarHopperGame();
    game.state = 'playing';
    game.canvas = { width: 360, height: 220 };
    game.player = { x: 120, y: 128, w: 24, h: 32 };
    game.cameraX = 0;
    game.reducedMotion = true;
    game.currentPlanet = { name: "Checkpoint Lab", missions: [] };
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.discoveryPassCounts = {};
    game.getMissionStat = () => ({ key: "agility", label: "Agility", value: 12, target: 30 });

    const queue = getRunObjectiveQueue(game);
    assertEquals("NEXT CHECKPOINT", queue[0] && queue[0].label, "Run queue should promote an unclaimed science checkpoint when no immediate lab item is ahead");
    assertEquals("science-checkpoint", queue[0] && queue[0].source, "Run queue checkpoint item should preserve source metadata");
    assertEquals("STAGE CHECKPOINT", queue[0] && queue[0].cta, "Run queue checkpoint item should expose a stage action");
    assertEquals(true, /Agility 12\/30/.test(queue[0] && queue[0].body), "Run queue checkpoint item should show the live stat");
    assertEquals(0.4, queue[0] && queue[0].progress && queue[0].progress.value, "Run queue checkpoint item should carry live progress");
    assertEquals(0.5, queue[0] && queue[0].progress && queue[0].progress.target, "Run queue checkpoint item should carry the next target marker");
    assertEquals("50% TARGET", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.learn, "Run queue checkpoint item should carry the learn checkpoint");
    assertEquals("hopper.engine = 6", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.code, "Run queue checkpoint item should carry the staged command");
    assertEquals("+3 XP proof", queue[0] && queue[0].lessonSteps && queue[0].lessonSteps.win, "Run queue checkpoint item should carry the proof payoff");

    const cue = game.getRunObjectiveCompassCue();
    assertEquals("NEXT CHECKPOINT", cue && cue.label, "Objective compass should show checkpoint label when it is the top queue item");
    assertEquals("STAGE CHECKPOINT", cue && cue.cta, "Objective compass should show checkpoint action");
    assertEquals("science-checkpoint", cue && cue.source, "Objective compass should preserve checkpoint source metadata");
    assertEquals("hopper.engine = 6", cue && cue.commandLine, "Objective compass should show the salient checkpoint assignment");
    assertEquals("F->motion", cue && cue.formulaChip, "Objective compass should show the engine-motion formula chip");
    assertEquals("ASSIGN", cue && cue.codeSkillChip, "Objective compass should identify the checkpoint command as an assignment");
    assertEquals("WIN +3 XP proof · 50% TARGET", cue && cue.rewardChip, "Objective compass should show the checkpoint payoff");
    assertEquals(true, /Need \+3\.0 to 50% TARGET/.test(cue && cue.reasonLine), "Objective compass should show the checkpoint gap as the reason line");
    assertEquals(0.4, cue && cue.progress && cue.progress.value, "Objective compass should carry checkpoint progress for a visual rail");
    assertEquals(0.5, cue && cue.progress && cue.progress.target, "Objective compass should carry checkpoint target marker");
    assertEquals("50% TARGET", cue && cue.lessonSteps && cue.lessonSteps.learn, "Objective compass should carry checkpoint learn step");
    assertEquals("hopper.engine = 6", cue && cue.lessonSteps && cue.lessonSteps.code, "Objective compass should carry checkpoint code step");
    assertEquals("+3 XP proof", cue && cue.lessonSteps && cue.lessonSteps.win, "Objective compass should carry checkpoint win step");

    const railOps = [];
    const checkpointLabels = [];
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect(x, y, w, h) { railOps.push({ type: "roundRect", x, y, w, h }); },
      fill() {},
      stroke() {},
      fillRect() {},
      moveTo(x, y) { railOps.push({ type: "moveTo", x, y }); },
      lineTo(x, y) { railOps.push({ type: "lineTo", x, y }); },
      fillText(text) { checkpointLabels.push(text); },
      measureText(text) { return { width: String(text || "").length * 6 }; }
    };
    const drawn = game.drawRunObjectiveCompass(fakeCtx);
    assertEquals("NEXT CHECKPOINT", drawn && drawn.label, "Compass draw should return the checkpoint cue");
    assertEquals(true, checkpointLabels.includes("hopper.engine = 6"), "Compass draw should write the salient checkpoint command");
    assertEquals(true, checkpointLabels.includes("F->motion"), "Compass draw should write the checkpoint formula chip");
    assertEquals(true, checkpointLabels.includes("ASSIGN"), "Compass draw should write the checkpoint coding concept chip");
    assertEquals(true, checkpointLabels.includes("LEARN") && checkpointLabels.includes("CODE") && checkpointLabels.includes("WIN"), "Compass draw should write the checkpoint learning strip");
    assertEquals(true, checkpointLabels.some(text => /^WIN \+3 XP proof/.test(text)), "Compass draw should write the checkpoint payoff chip");
    assertEquals(0.4, drawn && drawn.progress && drawn.progress.value, "Compass draw should preserve checkpoint progress");
    assertEquals(true, drawn && drawn.h > 60, "Compass draw should reserve compact space for the checkpoint rail");
    assertEquals(true, railOps.some(op => op.type === "moveTo"), "Compass draw should paint the checkpoint target marker");

    getAttemptLogNextQuestion = oldGetAttemptLogNextQuestion22bc3;
    getLabChainTarget = oldGetLabChainTarget22bc3;
    buildNextExperimentCue = oldBuildNextExperimentCue22bc3;
    renderTestResult("engine-suite", "Curriculum: science checkpoint reaches objective compass", true);
  } catch (err) {
    getAttemptLogNextQuestion = oldGetAttemptLogNextQuestion22bc3;
    getLabChainTarget = oldGetLabChainTarget22bc3;
    buildNextExperimentCue = oldBuildNextExperimentCue22bc3;
    renderTestResult("engine-suite", "Curriculum: science checkpoint reaches objective compass", false, err.message);
  }

  // Test 22bc4: Code Concept deck progress reaches the active in-world compass as pips.
  const oldGetAttemptLogNextQuestion22bc4 = getAttemptLogNextQuestion;
  const oldGetLabChainTarget22bc4 = getLabChainTarget;
  const oldBuildNextExperimentCue22bc4 = buildNextExperimentCue;
  try {
    getAttemptLogNextQuestion = () => null;
    getLabChainTarget = () => null;
    buildNextExperimentCue = () => null;
    const game = new StarHopperGame();
    game.state = 'playing';
    game.canvas = { width: 360, height: 220 };
    game.player = { x: 120, y: 128, w: 24, h: 32 };
    game.cameraX = 0;
    game.reducedMotion = true;
    game.currentPlanet = { name: "Code Concept Lab", missions: [] };
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.discoveryPassCounts = {};
    game.codeConcepts = new Set(["ASSIGN"]);

    const queue = getRunObjectiveQueue(game);
    assertEquals("CODE CONCEPT", queue[0] && queue[0].label, "Run queue should promote the next Code Concept when no science target is ahead");
    assertEquals("LOOP", queue[0] && queue[0].kind, "Run queue should preserve the next Code Concept key");
    assertEquals(1, queue[0] && queue[0].progress && queue[0].progress.value, "Run queue keeps raw Code Concept count for the CRT cartridge");
    assertEquals(5, queue[0] && queue[0].progress && queue[0].progress.target, "Run queue keeps raw Code Concept total for the CRT cartridge");

    const cue = game.getRunObjectiveCompassCue();
    assertEquals("CODE CONCEPT", cue && cue.label, "Objective compass should show the Code Concept label");
    assertEquals("STAGE IDEA", cue && cue.cta, "Objective compass should show the Code Concept action");
    assertEquals("code-concept-target", cue && cue.source, "Objective compass should preserve Code Concept source metadata");
    assertEquals("repeat 3 { spawn_block() }", cue && cue.commandLine, "Objective compass should show the runnable Code Concept sample");
    assertEquals("LOOP", cue && cue.codeSkillChip, "Objective compass should identify the programming construct");
    assertEquals(0.2, cue && cue.progress && cue.progress.value, "Objective compass should normalize 1/5 Code Concept progress");
    assertEquals(0.4, cue && cue.progress && cue.progress.target, "Objective compass should mark the next 2/5 Code Concept target");
    assertEquals(1, cue && cue.conceptProgress && cue.conceptProgress.current, "Objective compass should carry Code Concept pip current count");
    assertEquals(2, cue && cue.conceptProgress && cue.conceptProgress.next, "Objective compass should carry Code Concept next pip");
    assertEquals(5, cue && cue.conceptProgress && cue.conceptProgress.total, "Objective compass should carry Code Concept pip total");
    assertEquals("Repeat count makes tools", cue && cue.lessonSteps && cue.lessonSteps.learn, "Objective compass should carry Code Concept learn step");
    assertEquals("Repeat a helper", cue && cue.lessonSteps && cue.lessonSteps.code, "Objective compass should carry Code Concept code step");
    assertEquals("Build the route", cue && cue.lessonSteps && cue.lessonSteps.win, "Objective compass should carry Code Concept win step");

    const pipRects = [];
    const labels = [];
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      roundRect(x, y, w, h) { if (h === 6) pipRects.push({ x, y, w, h }); },
      fill() {},
      stroke() {},
      fillRect() {},
      moveTo() {},
      lineTo() {},
      fillText(text) { labels.push(text); },
      measureText(text) { return { width: String(text || "").length * 6 }; }
    };
    const drawn = game.drawRunObjectiveCompass(fakeCtx);
    assertEquals("CODE CONCEPT", drawn && drawn.label, "Compass draw should return the Code Concept cue");
    assertEquals(true, labels.includes("LOOP"), "Compass draw should write the Code Concept chip");
    assertEquals(true, labels.some(text => /repeat 3/.test(text)), "Compass draw should write the Code Concept command");
    assertEquals(true, labels.includes("LEARN") && labels.includes("CODE") && labels.includes("WIN"), "Compass draw should write the Code Concept learning strip");
    assertEquals(true, labels.some(text => /^1\/5/.test(text)), "Compass draw should write the Code Concept pip label");
    assertEquals(true, pipRects.length >= 5, "Compass draw should render one compact pip per Code Concept card");
    assertEquals(true, drawn && drawn.h > 72, "Compass should reserve room for Code Concept learning chips");

    getAttemptLogNextQuestion = oldGetAttemptLogNextQuestion22bc4;
    getLabChainTarget = oldGetLabChainTarget22bc4;
    buildNextExperimentCue = oldBuildNextExperimentCue22bc4;
    renderTestResult("engine-suite", "Curriculum: Code Concept progress reaches objective compass", true);
  } catch (err) {
    getAttemptLogNextQuestion = oldGetAttemptLogNextQuestion22bc4;
    getLabChainTarget = oldGetLabChainTarget22bc4;
    buildNextExperimentCue = oldBuildNextExperimentCue22bc4;
    renderTestResult("engine-suite", "Curriculum: Code Concept progress reaches objective compass", false, err.message);
  }

  // Test 22c: Research rank and discovery deck render a readable learning collection.
  const oldGetElementById22c = document.getElementById;
  const oldWindowGame22c = window.Game;
  const oldBubblePop22c = ComicBubbles.pop;
  const oldParticleBurst22c = Particles.spawnBurst;
  try {
    const rank = getResearchRank(60);
    assertEquals("Physics Tinkerer", rank.title, "60 Research XP should reach the third rank");
    assertEquals("Formula Deck", rank.perk.label, "Rank should carry the current lab perk");
    assertEquals("Combo Amplifier", rank.nextPerk.label, "Rank should preview the next lab perk");
    assertEquals(55, rank.remaining, "Remaining XP should point to the tuned next-rank gap");
    assertEquals("Physics Tinkerer", getResearchRank(114).title, "Tuned curve should keep Combo Amplifier locked until 115 XP");
    assertEquals("Loop Engineer", getResearchRank(115).title, "Tuned curve should unlock Combo Amplifier at 115 XP");
    assertEquals("Loop Engineer", getResearchRank(189).title, "Tuned curve should keep Daily Signal Lab locked until 190 XP");
    assertEquals("Orbit Scientist", getResearchRank(190).title, "Tuned curve should unlock Daily Signal Lab at 190 XP");
    assertEquals("Orbit Scientist", getResearchRank(299).title, "Tuned curve should keep Star Mentor locked until 300 XP");
    assertEquals("Star Mentor", getResearchRank(300).title, "Tuned curve should unlock Star Mentor at 300 XP");

    const focusStageButton = {
      _events: {},
      addEventListener(event, handler) { this._events[event] = handler; }
    };
    const focusInput = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    const focusGame = {
      player: { x: 48, y: 80, w: 24, h: 32 },
      missionBalloon: null,
      showMissionBalloon(text, opts) { this.missionBalloon = { text, ...(opts || {}) }; }
    };
    const focusPops = [];
    let focusBursts = 0;
    ComicBubbles.pop = (x, y, text) => { focusPops.push(text); };
    Particles.spawnBurst = () => { focusBursts++; };
    const els = {
      "research-rank-card": { innerHTML: "" },
      "discovery-deck": {
        innerHTML: "",
        querySelector(selector) {
          return selector === "[data-formula-focus-stage]" ? focusStageButton : null;
        }
      }
    };
    window.Game = focusGame;
    document.getElementById = (id) => id === "console-input" ? focusInput : (els[id] || null);
    updateResearchProgress({
      researchXP: 60,
      discoveryCombo: 2,
      getNextDiscoveryComboMilestone() {
        return { combo: 3, label: "TRIPLE TEST", rewardXP: 6, remaining: 1 };
      },
      discoveryLog: [
        { kind: "mass", title: "Mass Lab", formula: "a = F / m", insight: "Less mass makes acceleration bigger.", rewardXP: 12, cardUnlocked: true },
        { kind: "loop", title: "Loop Lab", formula: "repeat n = command x n", insight: "Loops build patterns quickly.", rewardXP: 9, cardUnlocked: true }
      ]
    });
    assertEquals(true, /Physics Tinkerer/.test(els["research-rank-card"].innerHTML), "Rank card should show the current title");
    assertEquals(true, /Lab Perk/.test(els["research-rank-card"].innerHTML), "Rank card should label the current lab perk");
    assertEquals(true, /Formula Deck/.test(els["research-rank-card"].innerHTML), "Rank card should show the current lab perk");
    assertEquals(true, /Next Perk/.test(els["research-rank-card"].innerHTML), "Rank card should preview the next lab perk");
    assertEquals(true, /Combo Amplifier/.test(els["research-rank-card"].innerHTML), "Rank card should name the next lab perk");
    assertEquals(true, /LAB CHAIN x2/.test(els["research-rank-card"].innerHTML), "Rank card should preserve the active lab-chain count");
    assertEquals(true, /TRIPLE TEST at x3/.test(els["research-rank-card"].innerHTML), "Rank card should preview the next lab-chain milestone");
    assertEquals(true, /Next milestone: TRIPLE TEST at x3 \(\+6 XP\)\./.test(els["research-rank-card"].innerHTML), "Rank card should show the milestone payoff");
    assertEquals(true, new RegExp(`Formula Cards 2\\/${DISCOVERY_RULES.length}`).test(els["discovery-deck"].innerHTML), "Deck should show formula collection progress");
    assertEquals(true, /NEXT EXPERIMENT/.test(els["discovery-deck"].innerHTML), "Deck should turn the next card into a focused experiment");
    assertEquals(true, /Engine Lab/.test(els["discovery-deck"].innerHTML), "Formula focus should point at the next locked card");
    assertEquals(true, /LEARN/.test(els["discovery-deck"].innerHTML), "Formula focus should label the science idea");
    assertEquals(true, /CODE/.test(els["discovery-deck"].innerHTML), "Formula focus should label the coding move");
    assertEquals(true, /WIN/.test(els["discovery-deck"].innerHTML), "Formula focus should label the in-game payoff");
    assertEquals(true, /Force changes speed/.test(els["discovery-deck"].innerHTML), "Formula focus should name the target concept axis");
    assertEquals(true, /Beat Agility gates/.test(els["discovery-deck"].innerHTML), "Formula focus should name a concrete payoff");
    assertEquals(true, /hopper\.engine = 7/.test(els["discovery-deck"].innerHTML), "Formula focus should show a runnable sample command");
    assertEquals(true, /STAGE FOCUS/.test(els["discovery-deck"].innerHTML), "Formula focus should expose a stage-focus action");
    assertEquals(true, !!focusStageButton._events.click, "Formula focus stage action should bind a click handler");
    focusStageButton._events.click();
    assertEquals("hopper.engine = 7", focusInput.value, "Formula focus stage action should stage the next formula command");
    assertEquals(true, focusInput.focused, "Formula focus staging should focus the terminal");
    assertEquals("Engine Lab", focusGame.lastStagedExperiment && focusGame.lastStagedExperiment.title, "Formula focus staging should remember the target card");
    assertEquals("engine", focusGame.lastStagedExperiment && focusGame.lastStagedExperiment.kind, "Formula focus staging should remember the formula kind");
    assertEquals("formula-focus", focusGame.lastStagedExperiment && focusGame.lastStagedExperiment.source, "Formula focus staging should remember its source surface");
    assertEquals("CODE STAGED: press Enter to test", focusGame.missionBalloon && focusGame.missionBalloon.text, "Formula focus staging should keep the CRT test cue");
    assertEquals(true, focusPops.includes("ENGINE LAB READY"), "Formula focus staging should pop a ready cue near the cadet");
    assertEquals(true, focusBursts > 0, "Formula focus staging should add a small particle confirmation");
    assertEquals(true, /a = F \/ m/.test(els["discovery-deck"].innerHTML), "Discovery deck should show collected formulas");
    assertEquals(true, /Loop Lab/.test(els["discovery-deck"].innerHTML), "Discovery deck should show multiple discoveries");
    assertEquals(true, /locked/.test(els["discovery-deck"].innerHTML), "Deck should show locked future cards");
    assertEquals(true, /next goal/.test(els["discovery-deck"].innerHTML), "Deck should label the next locked formula as a goal");
    assertEquals(true, /locked goal/.test(els["discovery-deck"].innerHTML), "Deck should label later locked formulas as future goals");
    assertEquals(true, /Raise hopper\.engine/.test(els["discovery-deck"].innerHTML), "Locked formula cards should preview the coding move");
    assertEquals(true, /Force changes speed/.test(els["discovery-deck"].innerHTML), "Locked formula cards should preview the science idea");
    assertEquals(true, /hopper\.engine = 7/.test(els["discovery-deck"].innerHTML), "Locked formula cards should show the sample command");
    assertEquals(true, /Reach high samples/.test(els["discovery-deck"].innerHTML), "Future locked cards should preview their payoff");
    document.getElementById = oldGetElementById22c;
    window.Game = oldWindowGame22c;
    ComicBubbles.pop = oldBubblePop22c;
    Particles.spawnBurst = oldParticleBurst22c;
    renderTestResult("engine-suite", "Curriculum: research ranks render discovery deck", true);
  } catch (err) {
    document.getElementById = oldGetElementById22c;
    window.Game = oldWindowGame22c;
    ComicBubbles.pop = oldBubblePop22c;
    Particles.spawnBurst = oldParticleBurst22c;
    renderTestResult("engine-suite", "Curriculum: research ranks render discovery deck", false, err.message);
  }

  // Test 22cb: Signal Story turns campaign clears, mastery, and daily practice into a visible narrative trail.
  const oldGetElementById22cb = document.getElementById;
  const oldBubblePop22cb = ComicBubbles.pop;
  const oldParticleBurst22cb = Particles.spawnBurst;
  try {
    const storyBubbles = [];
    const storyParticles = [];
    ComicBubbles.pop = (x, y, text, color, scale) => {
      storyBubbles.push({ x, y, text, color, scale });
      return true;
    };
    Particles.spawnBurst = (x, y, color, count, speed, size, type) => {
      storyParticles.push({ x, y, color, count, speed, size, type });
      return true;
    };
    const partial = {
      planetClears: { 0: 1, 1: 1 },
      masteryCleared: {},
      dailySignalClears: 0,
      researchXP: 0,
      discoveryLog: []
    };
    let story = getSignalStoryProgress(partial);
    assertEquals(2, story.unlocked.length, "Two cleared planets should unlock two story chapters");
    assertEquals("Amber Gravity Well", story.nextChapter.title, "Next story chapter should point at Jupiter");
    let storyContract = getSignalStoryContract(partial, story);
    assertEquals("STORY CONTRACT", storyContract.kicker, "Incomplete story should surface a story contract");
    assertEquals("Clear Jupiter (Gas Giant Core)", storyContract.title, "Story contract should point to the next concrete world clear");
    assertEquals("Reward: Amber Gravity Well", storyContract.reward, "Story contract should name the next chapter reward");
    const storyGame = new StarHopperGame();
    storyGame.currentPlanetIndex = 0;
    const beforeStoryIds = storyGame.getUnlockedSignalStoryIds();
    assertEquals(0, beforeStoryIds.size, "Fresh story state starts with no decoded chapters");
    storyGame.planetClears = { 0: 1 };
    const newChapters = storyGame.getNewSignalStoryChapters(beforeStoryIds);
    assertEquals(1, newChapters.length, "A campaign clear should identify the newly decoded chapter");
    assertEquals("Emerald Wall Signal", newChapters[0].title, "Decoded chapter should match the cleared world");
    storyGame.player = new Player(80, 120);
    const storyEffect = storyGame.spawnSignalStoryUnlockEffect(newChapters[0]);
    assertEquals("SIGNAL DECODED!", storyEffect.label, "Story unlock should create an in-level payoff label");
    assertEquals("Emerald Wall Signal", storyEffect.chapterTitle, "Story unlock effect should name the chapter");
    assertEquals("Variables change motion", storyEffect.concept, "Story unlock effect should name the science concept");
    assertEquals("SIGNAL DECODED: Emerald Wall Signal", storyEffect.monitorText, "Story unlock should create a Mission CRT monitor line");
    assertEquals("STAR-MAP SIGNAL", storyGame.missionBalloon && storyGame.missionBalloon.title, "Story unlock monitor should use the star-map title");
    assertEquals(true, storyBubbles.some(bubble => /SIGNAL DECODED!/.test(bubble.text)), "Story unlock should pop near the cadet");
    assertEquals(true, storyParticles.some(particle => particle.color === "#67e8f9" && particle.type === "glow"), "Story unlock should spawn cyan signal particles");
    assertEquals(true, storyParticles.some(particle => particle.color === "#fef08a" && particle.type === "glow"), "Story unlock should spawn gold reward particles");
    storyGame.lastSignalStoryUnlocks = newChapters;
    const unlockCue = storyGame.getClearSignalStoryUnlock();
    assertEquals("SIGNAL DECODED", unlockCue.kicker, "Clear report unlock cue should label decoded story");
    assertEquals("Variables change motion", unlockCue.concept, "Unlock cue should carry the science concept");
    storyGame.lastSignalStoryUnlocks = [];
    assertEquals(null, storyGame.getClearSignalStoryUnlock({ isDailyRun: true }), "Daily side runs should not fall back to campaign story chapters");

    const starMapReady = {
      planetClears: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      masteryCleared: {},
      masteryMeters: {},
      dailySignalClears: 0,
      researchXP: 0,
      discoveryLog: []
    };
    story = getSignalStoryProgress(starMapReady);
    assertEquals("Dark Matter Echo", story.nextChapter.title, "Restoring the star-map should point toward the next anomaly before optional chapters");
    storyContract = getSignalStoryContract(starMapReady, story);
    assertEquals("Clear one Frontier Challenge", storyContract.title, "The anomaly contract should give one concrete post-campaign action");
    assertEquals("Reward: Dark Matter Echo", storyContract.reward, "The anomaly contract should name the future-world payoff");

    const frontierStoryGame = new StarHopperGame();
    frontierStoryGame.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    const beforeFrontierStoryIds = frontierStoryGame.getUnlockedSignalStoryIds();
    frontierStoryGame.recordFrontierClear({
      frontierInfo: {
        isFrontier: true,
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        variant: { variantLabel: "standard" }
      },
      labStars: { stars: 2 },
      clearTime: { elapsed: 42.2 }
    });
    const frontierStoryUnlocks = frontierStoryGame.getNewSignalStoryChapters(beforeFrontierStoryIds);
    assertEquals(1, frontierStoryUnlocks.length, "The first Frontier record should decode one new anomaly chapter");
    assertEquals("anomaly-echo", frontierStoryUnlocks[0].id, "Frontier evidence should unlock the Dark Matter Echo");
    story = getSignalStoryProgress(frontierStoryGame);
    assertEquals("Hidden Force Trace", story.nextChapter.title, "Decoded anomaly should next ask for the Mag-Net trace proof");
    storyContract = getSignalStoryContract(frontierStoryGame, story);
    assertEquals("Run Trace hidden force", storyContract.title, "The trace story contract should point to the exact prototype quest");

    const complete = {
      planetClears: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      frontierRecords: {
        "2026-06-30": {
          dateStr: "2026-06-30",
          shareCode: "FRONTIER-EARTH-1234",
          tier: 1,
          planetIndex: 0,
          stars: 2,
          bestTime: 42.2
        }
      },
      masteryCleared: { 0: true },
      masteryMeters: { 0: { xp: 80, badges: ["scout"], sources: { "village-rescue:0:geary": 12 } } },
      dailySignalClears: 1,
      researchXP: 0,
      discoveryLog: [],
      discoveryPassCounts: { "anomaly-trace-proof:4:trace-hidden-force:test": 1 }
    };
    story = getSignalStoryProgress(complete);
    assertEquals(12, story.unlocked.length, "Campaign, finale, Frontier, trace, mastery, daily, and village progress should unlock every chapter");
    assertEquals(null, story.nextChapter, "Complete story should have no next locked chapter");

    const els = {
      "research-rank-card": { innerHTML: "" },
      "discovery-deck": { innerHTML: "" },
      "signal-story-panel": { innerHTML: "" }
    };
    document.getElementById = (id) => els[id] || null;
    updateResearchProgress(partial);
    assertEquals(true, /2\/12 decoded/.test(els["signal-story-panel"].innerHTML), "Story panel should show decoded chapter count");
    assertEquals(true, /Emerald Wall Signal/.test(els["signal-story-panel"].innerHTML), "Story panel should show unlocked chapters");
    assertEquals(true, /Next: Amber Gravity Well/.test(els["signal-story-panel"].innerHTML), "Story panel should show the next chapter hook");
    assertEquals(true, /STORY CONTRACT/.test(els["signal-story-panel"].innerHTML), "Story panel should pin one next story contract");
    assertEquals(true, /Clear Jupiter \(Gas Giant Core\)/.test(els["signal-story-panel"].innerHTML), "Story contract should name the next action");
    assertEquals(true, /Reward: Amber Gravity Well/.test(els["signal-story-panel"].innerHTML), "Story contract should name the chapter payoff");
    assertEquals(true, /NEXT EXPERIMENT/.test(els["discovery-deck"].innerHTML), "Empty formula deck should still surface one next experiment");
    assertEquals(true, /hopper\.mass = 1\.0/.test(els["discovery-deck"].innerHTML), "Empty formula deck should include a first runnable command");
    assertEquals(true, /Mass controls acceleration/.test(els["discovery-deck"].innerHTML), "Empty formula focus should name the first science concept");
    assertEquals(true, /Open lighter-build routes/.test(els["discovery-deck"].innerHTML), "Empty formula focus should show the first payoff");
    assertEquals(true, /Run the focus command/.test(els["discovery-deck"].innerHTML), "Empty formula deck should still render while story updates");

    updateSignalStoryPanel(complete);
    assertEquals(true, /12\/12 decoded/.test(els["signal-story-panel"].innerHTML), "Complete story should render all chapters decoded");
    assertEquals(true, /Star-Map Restored/.test(els["signal-story-panel"].innerHTML), "Finale chapter should render");
    assertEquals(true, /Dark Matter Echo/.test(els["signal-story-panel"].innerHTML), "Frontier anomaly chapter should render");
    assertEquals(true, /Hidden Force Trace/.test(els["signal-story-panel"].innerHTML), "Anomaly trace chapter should render");
    assertEquals(true, /Remix Key/.test(els["signal-story-panel"].innerHTML), "Mastery chapter should render");
    assertEquals(true, /Daily Beacon/.test(els["signal-story-panel"].innerHTML), "Daily chapter should render");
    assertEquals(true, /Village Pact/.test(els["signal-story-panel"].innerHTML), "Village rescue chapter should render");
    storyContract = getSignalStoryContract(complete);
    assertEquals("DARK MATTER PREP", storyContract.kicker, "Complete traced story should keep a future-lab prep contract instead of ending cold");
    let sourceScene = getSignalSourceScene(complete, storyContract);
    assertEquals("CASE FILE", sourceScene && sourceScene.label, "Trace proof should surface a Dark Matter source scene");
    assertEquals("VECTOR", sourceScene && sourceScene.speaker, "Dark Matter source scene should use Vector as the speaker");
    assertEquals("Hidden-force case file", sourceScene && sourceScene.title, "Dark Matter source scene should name the hidden-force payoff");
    assertEquals(true, /DARK MATTER PREP/.test(els["signal-story-panel"].innerHTML), "Complete story panel should show the future-lab prep loop");
    assertEquals(true, /Bank curve evidence/.test(els["signal-story-panel"].innerHTML), "Complete story loop should name the next hidden-force evidence target");
    assertEquals(true, /Daily Signal, Frontier run, or mastery remix/.test(els["signal-story-panel"].innerHTML), "Complete story loop should point to replay practice");
    assertEquals(true, /SOURCE SCENE|CASE FILE/.test(els["signal-story-panel"].innerHTML), "Complete story panel should render a future-lab scene card");
    assertEquals(true, /Hidden-force case file/.test(els["signal-story-panel"].innerHTML), "Dark Matter scene should render its payoff title");
    assertEquals(true, /infer an unseen force from visible motion/.test(els["signal-story-panel"].innerHTML), "Dark Matter scene should render the science takeaway");

    const quantumPrepComplete = {
      ...complete,
      discoveryPassCounts: {
        ...complete.discoveryPassCounts,
        "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1
      }
    };
    storyContract = getSignalStoryContract(quantumPrepComplete);
    assertEquals("QUANTUM PREP", storyContract.kicker, "Dark Matter evidence should hand the complete story into Quantum prep");
    assertEquals("Test a branch condition", storyContract.title, "Quantum prep should ask for one branch prototype");
    sourceScene = getSignalSourceScene(quantumPrepComplete, storyContract);
    assertEquals("GATE SCENE", sourceScene && sourceScene.label, "Dark Matter evidence should surface a Quantum Gate scene");
    assertEquals("Quantum Gate wakes", sourceScene && sourceScene.title, "Quantum prep scene should name the waking gate");
    updateSignalStoryPanel(quantumPrepComplete);
    assertEquals(true, /QUANTUM PREP/.test(els["signal-story-panel"].innerHTML), "Story panel should show the Quantum prep loop after Dark Matter evidence");
    assertEquals(true, /Quantum Gate will build probability from branches/.test(els["signal-story-panel"].innerHTML), "Quantum prep should connect branches to probability");
    assertEquals(true, /Quantum Gate wakes/.test(els["signal-story-panel"].innerHTML), "Quantum prep scene should render in the story panel");

    const quantumSeededComplete = {
      ...quantumPrepComplete,
      discoveryPassCounts: {
        ...quantumPrepComplete.discoveryPassCounts,
        "quantum-branch-proof:0:test-a-branch-condition:test": 1
      }
    };
    storyContract = getSignalStoryContract(quantumSeededComplete);
    assertEquals("QUANTUM CHANCE", storyContract.kicker, "Quantum branch proof should ask for one probability branch");
    assertEquals("Test chance branch", storyContract.title, "Branch proof should introduce the chance variable");
    sourceScene = getSignalSourceScene(quantumSeededComplete, storyContract);
    assertEquals("HOPPER-ZERO", sourceScene && sourceScene.speaker, "Quantum branch scene should introduce Hopper-Zero");
    assertEquals("Two paths detected", sourceScene && sourceScene.title, "Quantum branch scene should name the path split");
    updateSignalStoryPanel(quantumSeededComplete);
    assertEquals(true, /QUANTUM CHANCE/.test(els["signal-story-panel"].innerHTML), "Story panel should show the Quantum chance loop");
    assertEquals(true, /Probability turns branching/.test(els["signal-story-panel"].innerHTML), "Quantum chance loop should connect branch code to probability");
    assertEquals(true, /HOPPER-ZERO/.test(els["signal-story-panel"].innerHTML), "Quantum branch scene should render Hopper-Zero as speaker");
    assertEquals(true, /a branch chooses; probability tells how often/.test(els["signal-story-panel"].innerHTML), "Quantum branch scene should render the coding takeaway");

    const quantumChanceComplete = {
      ...quantumSeededComplete,
      discoveryPassCounts: {
        ...quantumSeededComplete.discoveryPassCounts,
        "quantum-chance-proof:0:test-chance-branch:test": 1
      }
    };
    storyContract = getSignalStoryContract(quantumChanceComplete);
    assertEquals("QUANTUM SOURCE", storyContract.kicker, "Quantum chance proof should mark the future source seed as logged");
    assertEquals("Future Source Key ready", storyContract.title, "Chance proof should show the source-key payoff");
    sourceScene = getSignalSourceScene(quantumChanceComplete, storyContract);
    assertEquals("The waiting probe answers", sourceScene && sourceScene.title, "Quantum source scene should answer the teaser");
    updateSignalStoryPanel(quantumChanceComplete);
    assertEquals(true, /QUANTUM SOURCE/.test(els["signal-story-panel"].innerHTML), "Story panel should show the logged Quantum source");
    assertEquals(true, /Future Source Key ready/.test(els["signal-story-panel"].innerHTML), "Story panel should name the source-key rehearsal");
    assertEquals(true, /Source Rehearsal Frontier remix/.test(els["signal-story-panel"].innerHTML), "Story panel should point to the source rehearsal loop");
    assertEquals(true, /The waiting probe answers/.test(els["signal-story-panel"].innerHTML), "Quantum source scene should render the payoff title");
    assertEquals(true, /probability is a pattern measured over many trials/.test(els["signal-story-panel"].innerHTML), "Quantum source scene should render the science takeaway");

    const quantumSourceTested = {
      ...quantumChanceComplete,
      discoveryPassCounts: {
        ...quantumChanceComplete.discoveryPassCounts,
        "signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 1
      }
    };
    storyContract = getSignalStoryContract(quantumSourceTested);
    assertEquals("SOURCE KEY TESTED", storyContract.kicker, "Source proof should turn the story contract toward notebook explanation");
    assertEquals("Explain the source key", storyContract.title, "Source proof should name the capstone explanation task");
    updateSignalStoryPanel(quantumSourceTested);
    assertEquals(true, /SOURCE KEY TESTED/.test(els["signal-story-panel"].innerHTML), "Story panel should show the tested source-key state");
    assertEquals(true, /Source Key Reflection Proof/.test(els["signal-story-panel"].innerHTML), "Story panel should name the source reflection reward");

    const quantumSourceReflected = {
      ...quantumSourceTested,
      masteryMeters: {
        0: {
          ...((quantumSourceTested.masteryMeters && quantumSourceTested.masteryMeters[0]) || {}),
          sources: {
            ...(((quantumSourceTested.masteryMeters && quantumSourceTested.masteryMeters[0]) || {}).sources || {}),
            "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
          }
        }
      }
    };
    storyContract = getSignalStoryContract(quantumSourceReflected);
    assertEquals("SOURCE KEY COMPLETE", storyContract.kicker, "Source reflection should mark the source-key record complete");
    assertEquals("Source Key record complete", storyContract.title, "Complete source key should stop asking for another source rehearsal");

    document.getElementById = oldGetElementById22cb;
    ComicBubbles.pop = oldBubblePop22cb;
    Particles.spawnBurst = oldParticleBurst22cb;
    renderTestResult("engine-suite", "Curriculum: signal story tracks science progression", true);
  } catch (err) {
    document.getElementById = oldGetElementById22cb;
    ComicBubbles.pop = oldBubblePop22cb;
    Particles.spawnBurst = oldParticleBurst22cb;
    renderTestResult("engine-suite", "Curriculum: signal story tracks science progression", false, err.message);
  }

  // Test 22cb1: Future Lab Roadmap turns Dark Matter / Quantum prep into a visible proof ladder.
  const oldGetElementById22cbr = document.getElementById;
  const oldSwitchMainMode22cbr = typeof switchMainMode === 'function' ? switchMainMode : null;
  try {
    const panel = { innerHTML: "" };
    document.getElementById = (id) => id === "future-lab-roadmap-panel" ? panel : null;
    const fullStarMap = {
      planetClears: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      frontierRecords: {},
      discoveryPassCounts: {},
      masteryMeters: {}
    };
    let stages = getFutureLabRoadmapStages(fullStarMap);
    assertEquals("done", stages[0].status, "Roadmap should mark the restored star-map as banked");
    assertEquals("next", stages[1].status, "Roadmap should make Dark Matter Echo the next seed after star-map completion");
    assertEquals("locked", stages[2].status, "Roadmap should lock the trace until Frontier evidence exists");
    updateFutureLabRoadmap(fullStarMap);
    assertEquals(true, /FUTURE LAB SEEDS/.test(panel.innerHTML), "Roadmap should render the future-lab header");
    assertEquals(true, /1\/6 proofs banked/.test(panel.innerHTML), "Roadmap should count banked future proofs");
    assertEquals(true, /Dark Matter Echo/.test(panel.innerHTML), "Roadmap should name the next Dark Matter proof");
    assertEquals(true, /RUN FRONTIER/.test(panel.innerHTML), "Roadmap should expose the next Frontier action");
    const frontierStarts = [];
    fullStarMap.startFrontierChallenge = (opts) => { frontierStarts.push(opts || null); return true; };
    assertEquals(true, runFutureLabRoadmapAction("dark-matter-echo", fullStarMap), "Roadmap action should launch the Frontier proof");
    assertEquals(1, frontierStarts.length, "Roadmap action should call startFrontierChallenge once");
    assertEquals("dark-matter-echo", frontierStarts[0] && frontierStarts[0].source, "Roadmap action should tag the first Future Lab Frontier proof as Dark Matter Echo");

    const quantumBranchReady = {
      ...fullStarMap,
      frontierRecords: { "2026-06-30": { shareCode: "FRONTIER-EARTH-1234", stars: 2 } },
      discoveryPassCounts: {
        "anomaly-trace-proof:4:trace-hidden-force:test": 1,
        "signal-lab-proof:frontier:frontier-earth-1234:t2:0:dark-matter-prep:curve": 1
      }
    };
    stages = getFutureLabRoadmapStages(quantumBranchReady);
    assertEquals("done", stages[1].status, "Roadmap should mark Dark Matter Echo complete after Frontier evidence");
    assertEquals("done", stages[2].status, "Roadmap should mark the hidden-force trace complete after trace proof");
    assertEquals("done", stages[3].status, "Roadmap should mark Dark Matter evidence complete after prep proof");
    assertEquals("next", stages[4].status, "Roadmap should make Quantum branch the next seed after Dark Matter evidence");
    updateFutureLabRoadmap(quantumBranchReady);
    assertEquals(true, /Seed a branch condition/.test(panel.innerHTML), "Roadmap should show the Quantum branch target");
    assertEquals(true, /TEST BRANCH/.test(panel.innerHTML), "Roadmap should expose the Quantum branch action");
    assertEquals(true, /Branch Lab card/.test(panel.innerHTML), "Roadmap should show the branch formula payoff");

    const quantumSourceReady = {
      ...quantumBranchReady,
      discoveryPassCounts: {
        ...quantumBranchReady.discoveryPassCounts,
        "quantum-branch-proof:0:test-a-branch-condition:test": 1,
        "quantum-chance-proof:0:test-chance-branch:test": 1
      }
    };
    stages = getFutureLabRoadmapStages(quantumSourceReady);
    assertEquals(6, stages.filter(stage => stage.status === "done").length, "Roadmap should mark all future proof seeds as banked");
    updateFutureLabRoadmap(quantumSourceReady);
    assertEquals(true, /6\/6 proofs banked/.test(panel.innerHTML), "Roadmap should render complete future-lab progress");
    assertEquals(true, /Run source rehearsal/.test(panel.innerHTML), "Complete roadmap should surface the source-key capstone");
    assertEquals(true, /RUN SOURCE/.test(panel.innerHTML), "Complete roadmap should expose the source rehearsal action");
    const sourceStarts = [];
    quantumSourceReady.startFrontierChallenge = (opts) => { sourceStarts.push(opts || null); return true; };
    assertEquals(true, runFutureLabRoadmapAction("future-source-key", quantumSourceReady), "Complete roadmap action should launch the source rehearsal");
    assertEquals("future-source", sourceStarts[0] && sourceStarts[0].source, "Complete roadmap source action should tag the Frontier launch");

    const quantumSourceTested = {
      ...quantumSourceReady,
      discoveryPassCounts: {
        ...quantumSourceReady.discoveryPassCounts,
        "signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 1
      }
    };
    updateFutureLabRoadmap(quantumSourceTested);
    assertEquals(true, /Explain source key/.test(panel.innerHTML), "Tested source key should move the roadmap to notebook explanation");
    assertEquals(true, /OPEN LOG/.test(panel.innerHTML), "Tested source key should expose the Log action");
    const modeSwitches = [];
    switchMainMode = (mode) => { modeSwitches.push(mode); };
    assertEquals(true, runFutureLabRoadmapAction("future-source-key", quantumSourceTested), "Tested source key roadmap action should open the Log");
    assertEquals("notebook", modeSwitches[0], "Tested source key roadmap action should switch to the notebook");

    const quantumSourceReflected = {
      ...quantumSourceTested,
      masteryMeters: {
        0: {
          sources: {
            "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
          }
        }
      }
    };
    updateFutureLabRoadmap(quantumSourceReflected);
    assertEquals(true, /Source key record complete/.test(panel.innerHTML), "Reflected source key should mark the capstone complete");
    assertEquals(true, /SOURCE KEY COMPLETE/.test(panel.innerHTML), "Reflected source key should render a completion capstone card");
    assertEquals(true, /hidden force \+ branch \+ chance -&gt; source key/.test(panel.innerHTML), "Capstone should summarize the source-key formula");
    assertEquals(true, /Dark Matter Echo/.test(panel.innerHTML), "Capstone should keep Dark Matter evidence in the portfolio");
    assertEquals(true, /Branch Condition/.test(panel.innerHTML), "Capstone should keep branch code in the portfolio");
    assertEquals(true, /Chance Probability/.test(panel.innerHTML), "Capstone should keep chance trials in the portfolio");
    assertEquals(true, /Source Key Reflection/.test(panel.innerHTML), "Capstone should name the final notebook proof");
    assertEquals(true, /Future Lab launch-ready record/.test(panel.innerHTML), "Capstone should name the portfolio reward");
    assertEquals(false, /RUN SOURCE|OPEN LOG/.test(panel.innerHTML), "Complete source key should not keep advertising unfinished actions");
    assertEquals(false, runFutureLabRoadmapAction("future-source-key", quantumSourceReflected), "Complete source key roadmap action should be inert");

    if (oldSwitchMainMode22cbr) switchMainMode = oldSwitchMainMode22cbr;
    document.getElementById = oldGetElementById22cbr;
    renderTestResult("engine-suite", "Curriculum: future lab roadmap tracks prep proofs", true);
  } catch (err) {
    if (oldSwitchMainMode22cbr) switchMainMode = oldSwitchMainMode22cbr;
    document.getElementById = oldGetElementById22cbr;
    renderTestResult("engine-suite", "Curriculum: future lab roadmap tracks prep proofs", false, err.message);
  }

  // Test 22cb1b: tagged future-lab runs surface a visible science cue during play.
  try {
    const g = new StarHopperGame();
    g.state = 'playing';
    g.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    g.frontierRecords = { "2026-06-30": { shareCode: "FRONTIER-EARTH-1234", stars: 2 } };
    g.masteryMeters = {};
    g.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1
    };
    g.dailyInfo = { isFrontier: true, darkMatterPrep: true };
    let cue = g.getFutureLabRunCue();
    assertEquals("DARK MATTER PREP", cue.label, "Dark Matter prep runs should show the hidden-force cue");
    assertEquals("curve", cue.mode, "Dark Matter prep cue should use the curve visualization");
    assertEquals(true, /hidden force/.test(cue.formula), "Dark Matter prep cue should name the hidden-force model");
    assertEquals(3, cue.progress.done, "Dark Matter prep cue should show the 3 banked prerequisite future proofs");
    assertEquals(6, cue.progress.total, "Future lab cue should use the six-step roadmap");
    assertEquals("dark-matter-evidence", cue.progress.nextId, "Dark Matter prep cue should point at curve evidence as the active proof");
    assertEquals(true, /Bank curve evidence/.test(cue.progress.progressLine), "Future lab cue should name the next proof target");
    assertEquals("VECTOR", cue.scene && cue.scene.speaker, "Dark Matter prep cue should carry the Vector source scene");
    assertEquals("Hidden-force case file", cue.scene && cue.scene.title, "Dark Matter prep cue should name the hidden-force story payoff");
    assertEquals(true, /unseen force/.test(cue.scene.lesson), "Dark Matter prep cue should include the science takeaway");
    assertEquals("VECTOR", cue.transmission && cue.transmission.speaker, "Dark Matter prep cue should speak through Vector");
    assertEquals(true, /curve evidence/.test(cue.transmission && cue.transmission.line), "Dark Matter prep transmission should point at the active evidence move");
    assertEquals("3/6 seeds", cue.transmission && cue.transmission.proofCount, "Dark Matter prep transmission should carry proof ladder context");
    g.getRunTimeSeconds = () => 20;
    const rotatedCue = g.getFutureLabRunCue();
    assertEquals(1, rotatedCue.transmission && rotatedCue.transmission.variantIndex, "Future-lab transmissions should rotate during a longer active run");
    assertEquals(true, /one variable|Same route/.test(rotatedCue.transmission && rotatedCue.transmission.line), "Rotated Dark Matter line should stay tied to one-variable evidence");
    g.getRunTimeSeconds = StarHopperGame.prototype.getRunTimeSeconds.bind(g);

    g.frontierRecords = {};
    g.discoveryPassCounts = {};
    g.dailyInfo = { isFrontier: true, darkMatterEcho: true };
    cue = g.getFutureLabRunCue();
    assertEquals("DARK MATTER ECHO", cue.label, "Dark Matter Echo Frontier runs should show the first future-lab cue");
    assertEquals("curve", cue.mode, "Dark Matter Echo cue should use the curve evidence visualization");
    assertEquals(true, /repeat evidence/.test(cue.formula), "Dark Matter Echo cue should name repeated evidence as the model");
    assertEquals(1, cue.progress.done, "Dark Matter Echo cue should show only the star-map seed banked");
    assertEquals("dark-matter-echo", cue.progress.nextId, "Dark Matter Echo cue should point at the echo seed");
    assertEquals("Anomaly triangulation", cue.scene && cue.scene.title, "Dark Matter Echo cue should carry a distinct story scene");
    assertEquals(true, /Frontier evidence/.test(cue.transmission && cue.transmission.line), "Dark Matter Echo transmission should explain why the Frontier run matters");

    g.frontierRecords = { "2026-06-30": { shareCode: "FRONTIER-EARTH-1234", stars: 2 } };
    g.dailyInfo = null;
    g.discoveryPassCounts = {};
    g.lastStagedExperiment = { source: "start-anomaly-trace" };
    cue = g.getFutureLabRunCue();
    assertEquals("ANOMALY TRACE", cue.label, "Anomaly trace staging should show the field cue");
    assertEquals("field", cue.mode, "Anomaly trace cue should use the field visualization");
    assertEquals(2, cue.progress.done, "Anomaly trace cue should count star-map plus Frontier echo prerequisites");
    assertEquals("hidden-force-trace", cue.progress.nextId, "Anomaly trace cue should point at the hidden-force proof");
    assertEquals("TRACE BRIEF", cue.scene && cue.scene.label, "Anomaly trace cue should use a trace briefing scene");
    assertEquals(true, /touch event/.test(cue.scene.lesson), "Anomaly trace cue should connect event code to hidden-force evidence");
    assertEquals(true, /magnet|field/i.test(cue.transmission && cue.transmission.line), "Anomaly transmission should name the visible detector clue");

    g.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t2:0:dark-matter-prep:curve": 1
    };
    g.lastStagedExperiment = { source: "start-quantum-branch" };
    cue = g.getFutureLabRunCue();
    assertEquals("QUANTUM PREP", cue.label, "Quantum branch staging should show the branch cue");
    assertEquals("branch", cue.mode, "Quantum branch cue should use the split-path visualization");
    assertEquals(true, /path A\/B/.test(cue.formula), "Quantum branch cue should name path selection");
    assertEquals(4, cue.progress.done, "Quantum branch cue should show the four banked future proofs");
    assertEquals("quantum-branch", cue.progress.nextId, "Quantum branch cue should point at the branch seed");
    assertEquals(true, /Branch Lab card/.test(cue.progress.nextReward), "Quantum branch cue should preview the formula-card payoff");
    assertEquals("Quantum Gate wakes", cue.scene && cue.scene.title, "Quantum branch cue should carry the gate-wakes scene");
    assertEquals(true, /condition/.test(cue.scene.lesson), "Quantum branch cue should include the conditional coding payoff");
    assertEquals(true, /branch|condition/.test(cue.transmission && cue.transmission.line), "Quantum branch transmission should reinforce conditional branching");

    g.discoveryPassCounts = {
      ...g.discoveryPassCounts,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1
    };
    g.lastStagedExperiment = { source: "start-quantum-chance" };
    cue = g.getFutureLabRunCue();
    assertEquals("QUANTUM CHANCE", cue.label, "Quantum chance staging should show the probability cue");
    assertEquals("chance", cue.mode, "Quantum chance cue should use the probability visualization");
    assertEquals(true, /measured pattern/.test(cue.formula), "Quantum chance cue should connect chance to evidence");
    assertEquals(5, cue.progress.done, "Quantum chance cue should show that only probability remains");
    assertEquals("quantum-chance", cue.progress.nextId, "Quantum chance cue should point at the probability seed");
    assertEquals("HOPPER-ZERO", cue.scene && cue.scene.speaker, "Quantum chance cue should carry the Hopper-Zero scene");
    assertEquals(true, /probability|chance/.test(cue.scene.lesson), "Quantum chance cue should include the probability takeaway");
    assertEquals("HOPPER-ZERO", cue.transmission && cue.transmission.speaker, "Quantum chance transmission should use Hopper-Zero's voice");
    assertEquals(true, /chance|trials|pattern/.test(cue.transmission && cue.transmission.line), "Quantum chance transmission should teach repeated trials");

    g.discoveryPassCounts = {
      ...g.discoveryPassCounts,
      "quantum-chance-proof:0:test-chance-branch:test": 1
    };
    g.lastStagedExperiment = null;
    g.dailyInfo = { isFrontier: true, futureSourcePrep: true };
    cue = g.getFutureLabRunCue();
    assertEquals("SOURCE KEY", cue.label, "Source rehearsal runs should show the source-key cue");
    assertEquals("chance", cue.mode, "Source rehearsal cue should reuse the probability visualization");
    assertEquals(true, /source key/.test(cue.formula), "Source rehearsal cue should name the source-key model");
    assertEquals(6, cue.progress.done, "Source rehearsal cue should show every Future Lab seed banked");
    assertEquals("future-source-key", cue.progress.nextId, "Complete Future Lab progress should point at the source key");
    assertEquals(true, /Source key ready/.test(cue.progress.progressLine), "Complete Future Lab progress should label the ready source key");
    assertEquals("HOPPER-ZERO", cue.scene && cue.scene.speaker, "Source rehearsal cue should carry the Hopper-Zero source scene");
    assertEquals("The source key hums", cue.scene && cue.scene.title, "Source rehearsal cue should name the source-key payoff");
    assertEquals(true, /hidden forces plus probability/.test(cue.scene.lesson), "Source rehearsal cue should combine hidden-force and probability ideas");
    assertEquals(true, /Hidden-force clues|force evidence/.test(cue.transmission && cue.transmission.line), "Source rehearsal transmission should connect force and probability evidence");

    g.state = 'start';
    assertEquals(null, g.getFutureLabRunCue(), "Future-lab cue should stay out of the start screen");
    renderTestResult("engine-suite", "Curriculum: future lab cue follows active prep state", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: future lab cue follows active prep state", false, err.message);
  }

  // Test 22cb2: Narrative spine uses the active cadet callsign, Vector CRT voice, suit quips, and final hero copy.
  const oldProfiles22cb2 = window.StarHopperProfiles;
  try {
    window.StarHopperProfiles = { getActive: () => ({ name: "Nova", emoji: "🚀" }) };
    const game = new StarHopperGame();
    assertEquals("🚀 Nova", game.getCadetCallsign(), "Cadet callsign should use the active profile");
    assertEquals(true, /VECTOR \/\/ 🚀 Nova:/.test(game.formatVectorTransmission("Welcome to Earth.", "start")), "Start transmission should name the cadet");
    assertEquals(true, /^VECTOR \/\/:/.test(game.formatVectorTransmission("Tune one variable.", "wall")), "Mid-level tips should keep Vector's voice");
    assertEquals(true, /Star Rover:/.test(game.getSuitArrivalQuip(0, "star")), "Star Rover should have its own arrival quip");
    assertEquals(true, /Hopper:/.test(game.getSuitArrivalQuip(0, "hopper")), "Hopper should have its own arrival quip");
    assertEquals(true, game.getSuitArrivalQuip(0, "star") !== game.getSuitArrivalQuip(0, "hopper"), "Suit quips should be distinct");
    const finale = game.getStarMapFinaleCopy({ frontier: { tier: 2 }, payoff: "Forge shard secured." });
    assertEquals("STAR-MAP RESTORED! 🛰️", finale.title, "Finale title should be a hero moment");
    assertEquals(true, /Nova/.test(finale.subtitle), "Finale should name the cadet");
    assertEquals(true, /Frontier Challenge is online/.test(finale.subtitle), "Finale should point into Frontier endgame");
    window.StarHopperProfiles = oldProfiles22cb2;
    renderTestResult("engine-suite", "Narrative: cadet callsign and Vector finale", true);
  } catch (err) {
    window.StarHopperProfiles = oldProfiles22cb2;
    renderTestResult("engine-suite", "Narrative: cadet callsign and Vector finale", false, err.message);
  }

  // Test 22cc: Research panel always surfaces the next lab quest.
  const oldGetElementById22cc = document.getElementById;
  const oldWindowGame22cc = window.Game;
  const oldProfiles22cc = window.StarHopperProfiles;
  const oldSwitchMainMode22cc = typeof switchMainMode === 'function' ? switchMainMode : null;
  const oldNotebookEntries22cc = (typeof notebookEntries !== 'undefined' && notebookEntries) ? { ...notebookEntries } : null;
  try {
    window.StarHopperProfiles = { getActive: () => ({ name: "Nova", emoji: "🚀" }) };
    const earthMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.coachPredictions = {};
    game.discoveredFormulaKinds = new Set();
    let quest = getActiveLabQuest(game);
    assertEquals("Make a prediction", quest.title, "Prediction should be the first lab quest when the mission has no guess");

    game.coachPredictions[earthMission.id] = "lighter-longer";
    quest = getActiveLabQuest(game);
    assertEquals("Collect Gravity Lab", quest.title, "After prediction, the quest should target the first mission formula card");

    game.survivalMode = true;
    game.mobs = [new Mob(140, 60, 'hog', '#9a6b4f', 1)];
    quest = getActiveLabQuest(game);
    assertEquals("Keep a village safe", quest.title, "Active mob danger should surface the village rescue lab quest");
    assertEquals(true, /state change/.test(quest.body), "Village quest should frame the behavior as an AI state lesson");
    game.survivalMode = false;
    game.mobs = [];

    game.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind));
    game.researchXP = 60;
    game.codeConcepts = new Set(["ASSIGN"]);
    quest = getActiveLabQuest(game);
    assertEquals("Collect Loop", quest.title, "After the formula deck, the quest should target the next missing Code Concept before rank grinding");
    assertEquals(true, /Repeat one instruction/.test(quest.body), "Code Concept quest should explain the programming idea");
    assertEquals("Reward: code concept card", quest.reward, "Code Concept quest should name the deck-card payoff");
    game.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "CALL", "ALIAS"]);
    quest = getActiveLabQuest(game);
    assertEquals("Reach Loop Engineer", quest.title, "After formula and Code Concept decks, the quest should target the next rank perk");
    assertEquals(true, /Combo Amplifier/.test(quest.reward), "Rank quest should name the next lab perk reward");

    const startKicker = { textContent: "" };
    const resumeCard = {
      style: {},
      classList: {
        hidden: true,
        toggle(cls, force) {
          if (cls === "hidden") this.hidden = force === undefined ? !this.hidden : !!force;
        },
        contains(cls) {
          return cls === "hidden" ? !!this.hidden : false;
        }
      }
    };
    const makeCadetButton = () => ({
      textContent: "",
      title: "",
      dataset: {},
      style: {},
      classList: {
        hidden: true,
        toggle(cls, force) {
          if (cls === "hidden") this.hidden = force === undefined ? !this.hidden : !!force;
        },
        contains(cls) {
          return cls === "hidden" ? !!this.hidden : false;
        }
      }
    });
    const cadetAIButton = makeCadetButton();
    const cadetLessonButton = makeCadetButton();
    const cadetHypothesisButton = makeCadetButton();
    const startObjectiveQueue = {
      innerHTML: "",
      style: {},
      classList: {
        hidden: false,
        toggle(cls, force) {
          if (cls === "hidden") this.hidden = force === undefined ? !this.hidden : !!force;
        },
        contains(cls) {
          return cls === "hidden" ? !!this.hidden : false;
        }
      }
    };
    const startVillagePreviewCard = {
      classList: {
        classes: new Set(),
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      }
    };
    const els = {
      "research-rank-card": { innerHTML: "" },
      "discovery-deck": { innerHTML: "" },
      "start-mission-radar": { querySelector: () => startKicker },
      "start-mission-radar-progress": { textContent: "" },
      "start-mission-radar-title": { textContent: "" },
      "start-mission-radar-body": { textContent: "" },
      "start-mission-radar-reward": { textContent: "" },
      "start-cadet-identity-label": { textContent: "" },
      "start-cadet-identity-title": { textContent: "" },
      "start-cadet-identity-body": { textContent: "" },
      "start-cadet-identity-bar": { style: { width: "" } },
      "start-cadet-ai-btn": cadetAIButton,
      "start-cadet-lesson-btn": cadetLessonButton,
      "start-cadet-hypothesis-btn": cadetHypothesisButton,
      "start-rank-preview-label": { textContent: "" },
      "start-rank-preview-title": { textContent: "" },
      "start-rank-preview-body": { textContent: "" },
      "start-rank-preview-bar": { style: { width: "" } },
      "start-world-preview-label": { textContent: "" },
      "start-world-preview-title": { textContent: "" },
      "start-world-preview-body": { textContent: "" },
      "start-world-preview-bar": { style: { width: "" } },
      "start-village-preview": startVillagePreviewCard,
      "start-village-preview-label": { textContent: "" },
      "start-village-preview-title": { textContent: "" },
      "start-village-preview-body": { textContent: "" },
      "start-village-preview-bar": { style: { width: "" } },
      "start-proof-preview-label": { textContent: "" },
      "start-proof-preview-title": { textContent: "" },
      "start-proof-preview-body": { textContent: "" },
      "start-proof-preview-stars": { innerHTML: "", setAttribute: function (name, value) { this[name] = value; } },
      "start-story-preview-label": { textContent: "" },
      "start-story-preview-title": { textContent: "" },
      "start-story-preview-body": { textContent: "" },
      "start-story-preview-progress": { textContent: "" },
      "start-objective-queue": startObjectiveQueue,
      "start-resume-test": resumeCard,
      "start-resume-test-label": { textContent: "" },
      "start-resume-test-title": { textContent: "" },
      "start-resume-test-body": { textContent: "" },
      "start-resume-test-code": { textContent: "" },
      "start-resume-test-btn": { textContent: "", title: "", dataset: {} },
      "start-mission-radar-btn": { textContent: "", title: "", dataset: {} },
      "console-input": {
        value: "",
        focused: false,
        selection: null,
        style: {},
        scrollHeight: 20,
        focus() { this.focused = true; },
        setSelectionRange(start, end) { this.selection = [start, end]; }
      }
    };
    document.getElementById = (id) => els[id] || null;
    if (oldNotebookEntries22cc) {
      Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
      notebookEntries["earth-gravity-wall"] = {
        title: "Gravity Wall",
        updatedAtMs: 123,
        nextExperiment: {
          title: "Raise engine",
          body: "Raise the engine and compare height.",
          command: "hopper.engine = 6",
          kind: "check"
        }
      };
    }
    game.discoveredFormulaKinds = new Set(["antigravity"]);
    game.planetClears = { 0: 1 };
    game.masteryMeters = { 0: { xp: 80, badges: ["scout"], sources: { "lab-star:0": 20 } } };
    game.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 0;
    game.confirmedHypotheses = new Set();
    game.codeConcepts = new Set(["ASSIGN"]);
    game.discoveryPassCounts = {};
    game.discoveryCombo = 2;
    game.streakCount = 3;
    game.getReturnStreakDailyFocus = () => ({ title: "Mass remix proof" });
    game.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    updateResearchProgress(game);
    assertEquals(true, /NEXT LAB QUEST/.test(els["research-rank-card"].innerHTML), "Rank card should render the lab quest");
    assertEquals(true, /Collect Mass Lab/.test(els["research-rank-card"].innerHTML), "Rendered quest should point to the next formula card");
    assertEquals("LAB QUEST", startKicker.textContent, "Start radar should reuse the lab quest category");
    assertEquals("Collect Mass Lab", els["start-mission-radar-title"].textContent, "Start radar should show the same next quest");
    assertEquals(`1/${DISCOVERY_RULES.length} formulas · 60 XP`, els["start-mission-radar-progress"].textContent, "Start radar should show formula and XP progress");
    assertEquals(true, /formula card/.test(els["start-mission-radar-reward"].textContent), "Start radar should show the quest reward");
    assertEquals("CADET RECORD", els["start-cadet-identity-label"].textContent, "Start radar should label the cadet record");
    assertEquals("🚀 Nova // Physics Tinkerer", els["start-cadet-identity-title"].textContent, "Start radar should name the active cadet and research rank");
    assertEquals(true, /Daily Streak d3 · Mass remix proof/.test(els["start-cadet-identity-body"].textContent), "Cadet record should show the daily lab streak habit");
    assertEquals(true, /Lab Chain x2 -> TRIPLE TEST x3/.test(els["start-cadet-identity-body"].textContent), "Cadet record should show the active lab-chain milestone");
    assertEquals(true, /Passport 1\/6 stamps · next Moon/.test(els["start-cadet-identity-body"].textContent), "Cadet record should show Science Passport stamp progress");
    assertEquals(true, /Lesson Paths 0\/3 · next Hopper Engineering Shakedown/.test(els["start-cadet-identity-body"].textContent), "Cadet record should show persistent lesson-path progress");
    assertEquals(true, /1\/\d+ formulas/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include formula deck progress");
    assertEquals(true, /Code Concepts 1\/5 · next Loop/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include Code Concept Deck progress");
    assertEquals(true, /Hypothesis Proofs 0\/6 · next Hopper Engineering Shakedown/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include hypothesis proof progress");
    assertEquals(true, /1\/12 transmissions/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include story transmission progress");
    assertEquals(true, /1\/5 AI states/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include AI State Deck progress");
    assertEquals(true, /next Shelter Loop/.test(els["start-cadet-identity-body"].textContent), "Cadet record should name the next AI State Deck card");
    assertEquals(true, /RUN RESCUE/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include the next AI State Deck action");
    assertEquals(true, /Trading Friend · 3 trust/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include village trust identity");
    assertEquals("8%", els["start-cadet-identity-bar"].style.width, "Cadet record should show rank progress");
    assertEquals(false, cadetLessonButton.classList.contains("hidden"), "Cadet record should show the next lesson-path route button");
    assertEquals("RUN LESSON", cadetLessonButton.textContent, "Cadet lesson route should use a direct action label");
    assertEquals("earth-gravity-wall", cadetLessonButton.dataset.mission, "Cadet lesson route should target the first unfinished lesson path");
    assertEquals("0", cadetLessonButton.dataset.level, "Cadet lesson route should target the lesson planet");
    assertEquals(true, /use_hopper\(\)/.test(cadetLessonButton.dataset.command), "Cadet lesson route should carry the first one-tweak command");
    assertEquals(false, cadetHypothesisButton.classList.contains("hidden"), "Cadet record should show the next hypothesis proof route button");
    assertEquals("RUN PROOF", cadetHypothesisButton.textContent, "Cadet hypothesis route should switch to proof mode after a prediction is chosen");
    assertEquals("earth-gravity-wall", cadetHypothesisButton.dataset.mission, "Cadet hypothesis route should target the first unconfirmed prediction mission");
    assertEquals("0", cadetHypothesisButton.dataset.level, "Cadet hypothesis route should target the prediction planet");
    assertEquals(false, cadetAIButton.classList.contains("hidden"), "Cadet record should show the next AI route button");
    assertEquals("RUN RESCUE", cadetAIButton.textContent, "Cadet record AI button should use the next route label");
    assertEquals("shelter-loop", cadetAIButton.dataset.state, "Cadet record AI button should target the next missing state");
    assertEquals(false, startObjectiveQueue.classList.contains("hidden"), "Start radar should show the next objective queue");
    assertEquals(true, /NEXT OBJECTIVE QUEUE/.test(startObjectiveQueue.innerHTML), "Start objective queue should render a CRT-style heading");
    assertEquals(true, /#1 LAB QUEST/.test(startObjectiveQueue.innerHTML), "Start objective queue should rank the main lab quest first");
    assertEquals(true, /Collect Mass Lab/.test(startObjectiveQueue.innerHTML), "Start objective queue should include the active formula quest");
    assertEquals(true, /#2 RESUME LAB/.test(startObjectiveQueue.innerHTML), "Start objective queue should include saved notebook follow-up second");
    assertEquals(true, /Raise engine/.test(startObjectiveQueue.innerHTML), "Start objective queue should preserve the saved next-test title");
    assertEquals(true, /#3 HYPOTHESIS PROOF/.test(startObjectiveQueue.innerHTML), "Start objective queue should include the next hypothesis proof route");
    assertEquals(true, /Prove Hopper Engineering Shakedown/.test(startObjectiveQueue.innerHTML), "Start objective queue should name the next hypothesis proof");
    assertEquals(true, /RUN PROOF/.test(startObjectiveQueue.innerHTML), "Start objective queue should expose the hypothesis proof action");
    assertEquals(true, /Predict before code/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the hypothesis proof learning step");
    assertEquals(true, /One tested tweak/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the hypothesis proof coding step");
    assertEquals(true, /Proof \+ XP/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the hypothesis proof payoff");
    assertEquals(true, /#4 LESSON PATH/.test(startObjectiveQueue.innerHTML), "Start objective queue should include the next focused lesson path");
    assertEquals(true, /Hopper Engineering Shakedown/.test(startObjectiveQueue.innerHTML), "Start objective queue should name the next lesson path");
    assertEquals(true, /#5 AI STATE/.test(startObjectiveQueue.innerHTML), "Start objective queue should include the next AI-state proof");
    assertEquals(true, /Shelter Loop/.test(startObjectiveQueue.innerHTML), "Start objective queue should name the next AI-state card");
    assertEquals(true, /Science proof -&gt; formula card/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the lab quest payoff loop");
    assertEquals(true, /Hypothesis -&gt; compare/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the saved experiment loop");
    assertEquals(true, /Observe -&gt; Code -&gt; Test/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the lesson-path loop");
    assertEquals(true, /state \+ event -&gt; next state/.test(startObjectiveQueue.innerHTML), "Start objective queue should explain the AI-state loop");
    assertEquals(5, game.lastStartObjectiveQueue && game.lastStartObjectiveQueue.length, "Start objective queue should keep a compact five-item stack");
    assertEquals("radar", game.lastStartObjectiveQueue[0].action, "Start objective queue first item should dispatch through Mission Radar");
    assertEquals("resume", game.lastStartObjectiveQueue[1].action, "Start objective queue second item should stage the saved test");
    assertEquals("hypothesis", game.lastStartObjectiveQueue[2].action, "Start objective queue third item should launch the hypothesis proof");
    assertEquals("lesson-path", game.lastStartObjectiveQueue[3].action, "Start objective queue fourth item should launch the focused lesson");
    assertEquals("ai-state", game.lastStartObjectiveQueue[4].action, "Start objective queue fifth item should route AI-state proof");
    window.Game = game;
    assertEquals(true, runStartObjectiveQueueAction(2), "Start objective queue resume action should dispatch");
    assertEquals("hopper.engine = 6", els["console-input"].value, "Start queue resume action should stage the saved command");
    assertEquals("start-objective-queue", game.lastStagedExperiment && game.lastStagedExperiment.source, "Start queue resume action should preserve its surface source");
    const queueHypothesisStarts = [];
    const queueHypothesisModes = [];
    game.startLevel = (level) => { queueHypothesisStarts.push(level); };
    switchMainMode = (mode) => { queueHypothesisModes.push(mode); };
    assertEquals(true, runStartObjectiveQueueAction(3), "Start objective queue hypothesis action should dispatch");
    assertEquals(0, queueHypothesisStarts[0], "Start queue hypothesis action should launch Earth for the first proof");
    assertEquals("terminal", queueHypothesisModes[0], "Start queue hypothesis action should return to the terminal");
    assertEquals("earth-gravity-wall", game.activeHypothesisMissionId, "Start queue hypothesis action should remember the active proof mission");
    const queueLessonStarts = [];
    const queueLessonModes = [];
    game.startLevel = (level) => { queueLessonStarts.push(level); };
    switchMainMode = (mode) => { queueLessonModes.push(mode); };
    assertEquals(true, runStartObjectiveQueueAction(4), "Start objective queue lesson action should dispatch");
    assertEquals(0, queueLessonStarts[0], "Start queue lesson action should launch Earth for the first lesson path");
    assertEquals("terminal", queueLessonModes[0], "Start queue lesson action should return to the terminal");
    assertEquals("cadet-lesson-path", game.lastStagedExperiment && game.lastStagedExperiment.source, "Start queue lesson action should enter the lesson staging loop");
    const cadetAIStarts = [];
    const cadetAIModes = [];
    const cadetLessonStarts = [];
    const cadetLessonModes = [];
    const cadetHypothesisStarts = [];
    const cadetHypothesisModes = [];
    game.startLevel = (level) => { cadetHypothesisStarts.push(level); };
    switchMainMode = (mode) => { cadetHypothesisModes.push(mode); };
    window.Game = game;
    assertEquals(true, runStartCadetHypothesisAction(), "Cadet record hypothesis action should launch the next prediction proof");
    assertEquals(0, cadetHypothesisStarts[0], "Cadet record hypothesis action should launch Earth for the first proof");
    assertEquals("terminal", cadetHypothesisModes[0], "Cadet record hypothesis action should return to the playable terminal");
    assertEquals("earth-gravity-wall", game.activeHypothesisMissionId, "Cadet hypothesis action should remember the active proof mission");
    game.startLevel = (level) => { cadetLessonStarts.push(level); };
    switchMainMode = (mode) => { cadetLessonModes.push(mode); };
    window.Game = game;
    assertEquals(true, runStartCadetLessonPathAction(), "Cadet record lesson action should launch the next lesson path");
    assertEquals(0, cadetLessonStarts[0], "Cadet record lesson action should launch Earth for the first lesson path");
    assertEquals("terminal", cadetLessonModes[0], "Cadet record lesson action should return to the playable terminal");
    assertEquals("use_hopper()\nantigravity = 4.9", els["console-input"].value, "Cadet record lesson action should stage the first phase command");
    assertEquals("cadet-lesson-path", game.lastStagedExperiment && game.lastStagedExperiment.source, "Cadet lesson route should enter the shared staged-experiment loop");
    assertEquals("Hopper Engineering Shakedown", game.lastStagedExperiment && game.lastStagedExperiment.title, "Cadet lesson route should name the lesson path");
    assertEquals("Cadet lesson", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Cadet lesson staged reminder should have a readable source label");
    game.startLevel = (level) => { cadetAIStarts.push(level); };
    game.toggleSurvival = () => { game.survivalMode = true; };
    switchMainMode = (mode) => { cadetAIModes.push(mode); };
    window.Game = game;
    assertEquals(true, runStartCadetAIAction(), "Cadet record AI action should launch the next behavior proof");
    assertEquals(1, cadetAIStarts[0], "Cadet record AI action should launch the rescue route world");
    assertEquals("shelter-loop", game.activeAIStateRun && game.activeAIStateRun.cardId, "Cadet record AI action should remember the active proof card");
    assertEquals(true, game.survivalMode, "Cadet record rescue action should enable Survival");
    assertEquals("terminal", cadetAIModes[0], "Cadet record AI action should return to the playable terminal");
    assertEquals("NEXT LAB UNLOCK", els["start-rank-preview-label"].textContent, "Start radar should label the next rank unlock");
    assertEquals("Combo Amplifier in 55 XP", els["start-rank-preview-title"].textContent, "Start radar should name the next perk and tuned remaining XP");
    assertEquals(true, /Reach Loop Engineer/.test(els["start-rank-preview-body"].textContent), "Start radar should connect the perk to the next rank");
    assertEquals(true, /Lab chain: Next milestone: TRIPLE TEST at x3 \(\+6 XP\)\./.test(els["start-rank-preview-body"].textContent), "Start radar should preserve the next lab-chain milestone");
    assertEquals("8%", els["start-rank-preview-bar"].style.width, "Start radar should show tuned rank progress toward the next unlock");
    assertEquals("WORLD MASTERY", els["start-world-preview-label"].textContent, "Start radar should label world mastery preview");
    assertEquals("Signal Scout · 80 XP", els["start-world-preview-title"].textContent, "Start radar should show current world mastery tier and XP");
    assertEquals(true, /30 XP to World Engineer/.test(els["start-world-preview-body"].textContent), "Start radar should show next world mastery gap");
    assertEquals("44%", els["start-world-preview-bar"].style.width, "Start radar should show world mastery progress");
    assertEquals("VILLAGE TRUST", els["start-village-preview-label"].textContent, "Start radar should label village trust preview");
    assertEquals("Trading Friend · 3 trust · Quest 1/3", els["start-village-preview-title"].textContent, "Start radar should show village trust tier, points, and quest-chain progress");
    assertEquals(true, /Village Quest 1\/3: Next: Rescue pact/.test(els["start-village-preview-body"].textContent), "Start radar should show the next village quest-chain step");
    assertEquals(true, /danger -> cave -> safe/.test(els["start-village-preview-body"].textContent), "Start radar should show the next village quest formula");
    assertEquals(true, /4 trust to Cave Ally/.test(els["start-village-preview-body"].textContent), "Start radar should show the next village trust gap");
    assertEquals(true, /Cave Rescue Pact/.test(els["start-village-preview-body"].textContent), "Start radar should name the next village pact");
    assertEquals(true, /State machine: danger -> cave -> safe/.test(els["start-village-preview-body"].textContent), "Start radar should connect village progress to the coding concept");
    assertEquals("25%", els["start-village-preview-bar"].style.width, "Start radar should show village trust progress");
    assertEquals(true, /Village State: SAFE -> trade/.test(els["start-village-preview-body"].textContent), "Start radar should preview the current village state-machine status");
    assertEquals(true, startVillagePreviewCard.classList.contains("village-signal-safe"), "Start radar should color the village preview as safe by default");
    game.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    updateStartMissionRadar(game);
    assertEquals(true, /Village State: NIGHT -> cave; daylight -> trade/.test(els["start-village-preview-body"].textContent), "Start radar should explain night cave shelter before play starts");
    assertEquals(true, startVillagePreviewCard.classList.contains("village-signal-night"), "Start radar should color the village preview for night shelter");
    game.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    game.interactiveObjects = [new NPC({ id: "radar-guard", name: "Radar Guard", profession: "Guard", type: "npc", x: 120, y: 60, color: "#a7f3d0", caveX: 72, caveY: 60 })];
    game.mobs = [new Mob(126, 60, "hog", "#9a6b4f", 1)];
    updateStartMissionRadar(game);
    assertEquals(true, /Village State: DANGER -> cave; clear mobs -> trade/.test(els["start-village-preview-body"].textContent), "Start radar should preview mob danger as a village state transition");
    assertEquals(true, startVillagePreviewCard.classList.contains("village-signal-danger"), "Start radar should color the village preview for mob danger");
    game.interactiveObjects = [];
    game.mobs = [];
    assertEquals("3-STAR PROOF", els["start-proof-preview-label"].textContent, "Start radar should label the lab-star proof preview");
    assertEquals("0/3 Lab Stars ready", els["start-proof-preview-title"].textContent, "Start radar should show current lab-star readiness");
    assertEquals(true, /finish mission tasks/.test(els["start-proof-preview-body"].textContent), "Start radar should name the first missing lab-star goal");
    assertEquals(false, /class="earned"/.test(els["start-proof-preview-stars"].innerHTML), "Start radar should render unearned proof stars");
    assertEquals("NEXT TRANSMISSION", els["start-story-preview-label"].textContent, "Start radar should label the next story hook");
    assertEquals("Moon Loop Echo", els["start-story-preview-title"].textContent, "Start radar should preview the next Signal Story chapter");
    assertEquals(true, /Loops build repeatable patterns/.test(els["start-story-preview-body"].textContent), "Start radar should show the next story concept");
    assertEquals(true, /Next: Clear Moon \(Luna Outpost\)/.test(els["start-story-preview-body"].textContent), "Start radar should name the next story action");
    assertEquals(true, /Reward: Moon Loop Echo/.test(els["start-story-preview-body"].textContent), "Start radar should name the next story reward");
    assertEquals("1/12 decoded", els["start-story-preview-progress"].textContent, "Start radar should show decoded story progress");
    assertEquals(false, resumeCard.classList.contains("hidden"), "Start radar should show a saved next test when notebook proof has one");
    assertEquals("RESUME LAB CHAIN", els["start-resume-test-label"].textContent, "Resume card should label the saved proof loop");
    assertEquals("Raise engine", els["start-resume-test-title"].textContent, "Resume card should show the saved next-test title");
    assertEquals(true, /Gravity Wall/.test(els["start-resume-test-body"].textContent), "Resume card should keep mission context");
    assertEquals("hopper.engine = 6", els["start-resume-test-code"].textContent, "Resume card should show the saved command");
    assertEquals("STAGE NEXT TEST", els["start-resume-test-btn"].textContent, "Resume card should expose a stage action");
    assertEquals("hopper.engine = 6", els["start-resume-test-btn"].dataset.command, "Resume action should retain the command");
    assertEquals("START QUEST", els["start-mission-radar-btn"].textContent, "Formula quests should be directly launchable");
    assertEquals("quest", els["start-mission-radar-btn"].dataset.action, "Formula quest button should use the quest action");
    assertEquals("0", els["start-mission-radar-btn"].dataset.level, "Quest action should target the current planet");

    window.Game = game;
    assertEquals(true, runStartResumeTestAction(), "Resume radar action should stage the saved next test");
    assertEquals("hopper.engine = 6", els["console-input"].value, "Resume radar action should write the saved command to the terminal");
    assertEquals("Raise engine", game.lastStagedExperiment.title, "Resume radar action should preserve the saved next-test title");
    assertEquals("start-resume-proof", game.lastStagedExperiment.source, "Resume radar action should mark the start-screen source");

    if (oldNotebookEntries22cc) Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
    updateStartMissionRadar(game);
    assertEquals(true, resumeCard.classList.contains("hidden"), "Start radar should hide the resume card without a saved next test");
    assertEquals(false, /RESUME LAB/.test(startObjectiveQueue.innerHTML), "Start objective queue should drop stale resume actions without a saved next test");

    game.completedMissions = new Set((game.currentPlanet.missions || []).map(mission => mission.id));
    game.requiredCollectiblesCollected = 2;
    updateStartMissionRadar(game);
    assertEquals("2/3 Lab Stars ready", els["start-proof-preview-title"].textContent, "Start radar should update lab-star proof readiness");
    assertEquals(true, /leave science proof/.test(els["start-proof-preview-body"].textContent), "Start radar should point to science proof after tasks and samples");
    assertEquals(2, (els["start-proof-preview-stars"].innerHTML.match(/class="earned"/g) || []).length, "Start radar should mark earned lab-star goals");

    game.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind));
    game.researchXP = 300;
    game.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    game.masteryCleared = { 0: true };
    game.dailySignalClears = 1;
    game.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "CALL", "ALIAS"]);
    game.masteryMeters = { 0: { xp: 80, badges: ["scout"], sources: { "village-rescue:0:geary": 12 } } };
    updateStartMissionRadar(game);
    assertEquals("Clear today's signal", els["start-mission-radar-title"].textContent, "Complete formula/rank progress should surface the daily practice loop");
    assertEquals("LAB FULLY ONLINE", els["start-rank-preview-label"].textContent, "Max research rank should switch the preview label");
    assertEquals("All lab perks online", els["start-rank-preview-title"].textContent, "Max research rank should show completion copy");
    assertEquals("100%", els["start-rank-preview-bar"].style.width, "Max research rank should fill the preview meter");
    assertEquals("NEXT TRANSMISSION", els["start-story-preview-label"].textContent, "Post star-map story should point to the anomaly before a Frontier record exists");
    assertEquals("Dark Matter Echo", els["start-story-preview-title"].textContent, "Post star-map story should preview the future-world anomaly");
    assertEquals(true, /Clear one Frontier Challenge/.test(els["start-story-preview-body"].textContent), "Post star-map story should give one concrete Frontier action");
    assertEquals("10/12 decoded", els["start-story-preview-progress"].textContent, "Optional story progress should wait on the Frontier anomaly");

    game.frontierRecords = {
      "2026-06-30": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        stars: 2,
        bestTime: 42.2
      }
    };
    updateStartMissionRadar(game);
    assertEquals("NEXT TRANSMISSION", els["start-story-preview-label"].textContent, "Decoded echo should point to the trace proof before story completion");
    assertEquals("Hidden Force Trace", els["start-story-preview-title"].textContent, "Trace proof should become the next story chapter");
    assertEquals(true, /Run Trace hidden force/.test(els["start-story-preview-body"].textContent), "Trace story preview should name the exact next action");
    assertEquals("11/12 decoded", els["start-story-preview-progress"].textContent, "Decoded echo should leave one story chapter locked");
    assertEquals("Trace hidden force", els["start-mission-radar-title"].textContent, "Decoded anomaly should become the next start-radar lab quest");
    assertEquals(true, /unseen field bends motion/.test(els["start-mission-radar-body"].textContent), "Anomaly quest should frame hidden-force inference");
    assertEquals(true, /Dark Matter prep/.test(els["start-mission-radar-reward"].textContent), "Anomaly quest should name the future-world payoff");
    assertEquals("TRACE FORCE", els["start-mission-radar-btn"].textContent, "Anomaly quest should expose a force-trace action");
    assertEquals("anomaly", els["start-mission-radar-btn"].dataset.action, "Anomaly quest button should use the anomaly action");
    assertEquals("4", els["start-mission-radar-btn"].dataset.level, "Anomaly quest should launch the Mag-Net prototype lab");
    assertEquals(true, /player\.touching\('magnet'\)/.test(els["start-mission-radar-btn"].dataset.command), "Anomaly quest should stage a magnet event command");

    const anomalyStarted = [];
    game.startLevel = (level) => { anomalyStarted.push(level); };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Anomaly radar action should execute");
    assertEquals(4, anomalyStarted[0], "Anomaly radar action should launch Mag-Net");
    assertEquals(els["start-mission-radar-btn"].dataset.command, els["console-input"].value, "Anomaly radar action should stage the hidden-force command");
    assertEquals(true, els["console-input"].focused, "Anomaly radar action should focus the terminal");
    assertEquals("start-anomaly-trace", game.lastStagedExperiment && game.lastStagedExperiment.source, "Anomaly staging should remember the start-radar source");

    game.discoveryPassCounts = { "anomaly-trace-proof:4:trace-hidden-force:test": 1 };
    updateStartMissionRadar(game);
    assertEquals("DARK MATTER PREP", els["start-story-preview-label"].textContent, "Trace proof should turn complete story into future-lab prep");
    assertEquals("Source traced", els["start-story-preview-title"].textContent, "Complete traced story should show the source-traced payoff on start radar");
    assertEquals(true, /Bank curve evidence/.test(els["start-story-preview-body"].textContent), "Complete traced story should point into curve-evidence practice");
    assertEquals(true, /Hidden-force case file/.test(els["start-story-preview-body"].textContent), "Start story preview should include the Dark Matter source scene");
    assertEquals("12/12 decoded", els["start-story-preview-progress"].textContent, "Complete story should show all chapters decoded");
    assertEquals("Bank curve evidence", els["start-mission-radar-title"].textContent, "After trace proof, the radar should surface the Dark Matter prep quest");
    assertEquals(true, /path curve, speed, and force/.test(els["start-mission-radar-body"].textContent), "Prep quest should frame the next replay as evidence gathering");
    assertEquals(true, /hidden-force record/.test(els["start-mission-radar-reward"].textContent), "Prep quest should name the hidden-force payoff");
    assertEquals("RUN PREP", els["start-mission-radar-btn"].textContent, "Prep quest should expose a direct run action");
    assertEquals("frontier", els["start-mission-radar-btn"].dataset.action, "Prep quest should start a Frontier evidence run");
    assertEquals("dark-matter-prep", els["start-mission-radar-btn"].dataset.kind, "Prep quest should tag the Frontier launch as Dark Matter prep");
    let prepCalls = 0;
    let prepOptions = null;
    game.startFrontierChallenge = (options) => {
      prepCalls++;
      prepOptions = options || null;
      game.dailyInfo = {
        isFrontier: true,
        darkMatterPrep: true,
        labContract: {
          title: "Dark Matter Prep: curve evidence",
          command: "hopper.engine = 7\nhopper.mass = 1.8"
        }
      };
      return true;
    };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Prep radar action should execute");
    assertEquals(1, prepCalls, "Prep radar action should start the Frontier challenge");
    assertEquals("dark-matter-prep", prepOptions && prepOptions.source, "Prep radar action should pass the Dark Matter prep source");
    assertEquals("hopper.engine = 7\nhopper.mass = 1.8", els["console-input"].value, "Prep radar action should stage the Frontier prep contract");
    assertEquals("dark-matter-prep", game.lastStagedExperiment && game.lastStagedExperiment.kind, "Prep radar staging should preserve the Future Lab route kind");
    assertEquals("signal-lab-contract", game.lastStagedExperiment && game.lastStagedExperiment.source, "Prep radar staging should use the Signal Lab proof source");

    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1
    };
    updateStartMissionRadar(game);
    assertEquals("QUANTUM PREP", els["start-story-preview-label"].textContent, "Banked Dark Matter evidence should turn the story preview toward Quantum prep");
    assertEquals("Branch source warming", els["start-story-preview-title"].textContent, "Quantum prep should show a source-warming story title");
    assertEquals(true, /Test a branch condition/.test(els["start-story-preview-body"].textContent), "Quantum prep story should name the branch prototype");
    assertEquals(true, /Quantum Gate wakes/.test(els["start-story-preview-body"].textContent), "Quantum prep story should include a source scene");
    assertEquals("12/12 decoded", els["start-story-preview-progress"].textContent, "Quantum prep should keep the decoded story count complete");
    assertEquals("Test a branch condition", els["start-mission-radar-title"].textContent, "After Dark Matter evidence, the radar should surface Quantum Branch prep");
    assertEquals(true, /if rule/.test(els["start-mission-radar-body"].textContent), "Quantum prep should frame the next code action as a conditional");
    assertEquals(true, /Branch Lab card/.test(els["start-mission-radar-reward"].textContent), "Quantum prep should name the Branch Lab payoff");
    assertEquals("TEST BRANCH", els["start-mission-radar-btn"].textContent, "Quantum prep should expose a direct branch action");
    assertEquals("quantum", els["start-mission-radar-btn"].dataset.action, "Quantum prep button should use the quantum action");
    assertEquals("0", els["start-mission-radar-btn"].dataset.level, "Quantum prep should launch the Earth prototype lab");
    assertEquals(true, /if player\.fuel < 50/.test(els["start-mission-radar-btn"].dataset.command), "Quantum prep should stage a conditional command");
    const quantumStarted = [];
    game.startLevel = (level) => { quantumStarted.push(level); };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Quantum radar action should execute");
    assertEquals(0, quantumStarted[0], "Quantum radar action should launch Earth");
    assertEquals(els["start-mission-radar-btn"].dataset.command, els["console-input"].value, "Quantum radar action should stage the branch command");
    assertEquals("start-quantum-branch", game.lastStagedExperiment && game.lastStagedExperiment.source, "Quantum staging should remember the start-radar source");

    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1
    };
    updateStartMissionRadar(game);
    assertEquals("QUANTUM CHANCE", els["start-story-preview-label"].textContent, "Branch proof should turn the story preview toward probability");
    assertEquals("Probability path warming", els["start-story-preview-title"].textContent, "Branch proof should show the chance payoff on the story preview");
    assertEquals(true, /Test chance branch/.test(els["start-story-preview-body"].textContent), "Chance story preview should name the next prototype");
    assertEquals(true, /HOPPER-ZERO - Two paths detected/.test(els["start-story-preview-body"].textContent), "Chance story preview should introduce the Hopper-Zero scene");
    assertEquals("Test chance branch", els["start-mission-radar-title"].textContent, "After the branch proof, the radar should surface Quantum Chance prep");
    assertEquals(true, /chance\(50\)/.test(els["start-mission-radar-body"].textContent), "Quantum chance prep should frame the next code action as probability");
    assertEquals(true, /Probability Lab card/.test(els["start-mission-radar-reward"].textContent), "Quantum chance prep should name the Probability Lab payoff");
    assertEquals("TEST CHANCE", els["start-mission-radar-btn"].textContent, "Quantum chance prep should expose a direct chance action");
    assertEquals("quantum-chance", els["start-mission-radar-btn"].dataset.action, "Quantum chance button should use the chance action");
    assertEquals("0", els["start-mission-radar-btn"].dataset.level, "Quantum chance prep should launch the Earth prototype lab");
    assertEquals(true, /chance\(50\)/.test(els["start-mission-radar-btn"].dataset.command), "Quantum chance prep should stage a chance command");
    assertEquals(true, runStartMissionRadarAction(), "Quantum chance radar action should execute");
    assertEquals(0, quantumStarted[1], "Quantum chance radar action should launch Earth");
    assertEquals(els["start-mission-radar-btn"].dataset.command, els["console-input"].value, "Quantum chance radar action should stage the chance command");
    assertEquals("start-quantum-chance", game.lastStagedExperiment && game.lastStagedExperiment.source, "Quantum chance staging should remember the start-radar source");

    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1,
      "quantum-chance-proof:0:test-chance-branch:test": 1
    };
    updateStartMissionRadar(game);
    assertEquals("QUANTUM SOURCE", els["start-story-preview-label"].textContent, "Chance proof should mark the Quantum source as logged");
    assertEquals("Future Source Key ready", els["start-story-preview-title"].textContent, "Chance proof should show the source-key payoff");
    assertEquals(true, /The waiting probe answers/.test(els["start-story-preview-body"].textContent), "Quantum source preview should answer the future-world teaser");
    assertEquals("Run source rehearsal", els["start-mission-radar-title"].textContent, "After all Future Lab seeds, the radar should surface the source rehearsal");
    assertEquals(true, /source-key rehearsal/.test(els["start-mission-radar-body"].textContent), "Source rehearsal quest should explain the capstone loop");
    assertEquals(true, /Source Key record/.test(els["start-mission-radar-reward"].textContent), "Source rehearsal quest should name the source-key payoff");
    assertEquals("RUN SOURCE", els["start-mission-radar-btn"].textContent, "Source rehearsal should expose a direct source action");
    assertEquals("frontier", els["start-mission-radar-btn"].dataset.action, "Source rehearsal should start a Frontier run");
    assertEquals("future-source", els["start-mission-radar-btn"].dataset.kind, "Source rehearsal should tag the Frontier launch");
    let sourceCalls = 0;
    let sourceOptions = null;
    game.startFrontierChallenge = (options) => {
      sourceCalls++;
      sourceOptions = options || null;
      game.dailyInfo = {
        isFrontier: true,
        futureSourcePrep: true,
        labContract: {
          title: "Future Source Key: source rehearsal",
          command: "hopper.pole = -1\nif chance(50): player.say('source')"
        }
      };
      return true;
    };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Source radar action should execute");
    assertEquals(1, sourceCalls, "Source radar action should start one Frontier challenge");
    assertEquals("future-source", sourceOptions && sourceOptions.source, "Source radar action should pass the Future Source tag");
    assertEquals("hopper.pole = -1\nif chance(50): player.say('source')", els["console-input"].value, "Source radar action should stage the Future Source contract");
    assertEquals("future-source", game.lastStagedExperiment && game.lastStagedExperiment.kind, "Source radar staging should preserve the Future Source kind");

    game.discoveryPassCounts = {
      ...game.discoveryPassCounts,
      "signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 1
    };
    updateStartMissionRadar(game);
    assertEquals("SOURCE KEY TESTED", els["start-story-preview-label"].textContent, "Source proof should mark the source key as tested");
    assertEquals("Explain the source key", els["start-story-preview-title"].textContent, "Source proof story preview should ask for explanation");
    assertEquals(true, /Science Notebook explanation/.test(els["start-story-preview-body"].textContent), "Source proof story preview should point to notebook evidence writing");
    assertEquals("Explain the source key", els["start-mission-radar-title"].textContent, "After source proof, the radar should surface source explanation");
    assertEquals(true, /Open the Log/.test(els["start-mission-radar-body"].textContent), "Source explanation quest should direct the player to the Log");
    assertEquals(true, /Source Key Reflection Proof/.test(els["start-mission-radar-reward"].textContent), "Source explanation quest should name the reflection payoff");
    assertEquals("WRITE PROOF", els["start-mission-radar-btn"].textContent, "Source explanation should expose a write-proof action");
    assertEquals("log", els["start-mission-radar-btn"].dataset.action, "Source explanation should open the Log");
    const modeSwitches22cc = [];
    switchMainMode = (mode) => { modeSwitches22cc.push(mode); };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Source explanation radar action should execute");
    assertEquals("notebook", modeSwitches22cc[0], "Source explanation radar action should switch to the notebook");

    game.masteryMeters = {
      0: {
        ...(game.masteryMeters && game.masteryMeters[0] ? game.masteryMeters[0] : {}),
        sources: {
          ...(game.masteryMeters && game.masteryMeters[0] && game.masteryMeters[0].sources ? game.masteryMeters[0].sources : {}),
          "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
        }
      }
    };
    updateStartMissionRadar(game);
    assertEquals("SOURCE KEY COMPLETE", els["start-story-preview-label"].textContent, "Source reflection should mark the source-key record complete");
    assertEquals("Source Key record complete", els["start-story-preview-title"].textContent, "Complete source key should show a final capstone state");
    assertEquals(true, /Future Lab: Source Key complete/.test(els["start-cadet-identity-body"].textContent), "Start Cadet Record should show the completed Future Lab source-key portfolio state");

    game.frontierRecords = {};
    game.discoveryPassCounts = {};
    game.codeConcepts = new Set(["ASSIGN", "LOOP", "IF", "CALL", "ALIAS"]);
    game.masteryMeters = {
      0: { xp: 80, badges: ["scout"], sources: { "village-rescue:0:geary": 12 } }
    };
    updateStartMissionRadar(game);
    assertEquals("Clear today's signal", els["start-mission-radar-title"].textContent, "Without a decoded anomaly, complete progress should surface the daily practice loop");
    assertEquals("ACCEPT SIGNAL", els["start-mission-radar-btn"].textContent, "Daily quest should get a direct accept button");
    assertEquals("daily", els["start-mission-radar-btn"].dataset.action, "Daily quest button should use the daily action");
    game.discoveryPassCounts = {
      [getLessonPathMasterySourceKey("earth-gravity-wall")]: 1,
      [getLessonPathMasterySourceKey("moon-canyon-jump")]: 1,
      [getLessonPathMasterySourceKey("asteroid-forge-momentum")]: 1
    };
    updateStartMissionRadar(game);
    assertEquals(true, /Lesson Paths mastered 3\/3/.test(els["start-cadet-identity-body"].textContent), "Cadet record should celebrate a completed lesson-path set");
    assertEquals(true, cadetLessonButton.classList.contains("hidden"), "Cadet lesson route should hide once all lesson paths are mastered");
    assertEquals(false, /LESSON PATH/.test(startObjectiveQueue.innerHTML), "Start objective queue should hide lesson-path actions once the focused paths are mastered");

    let dailyCalls = 0;
    const startedLevels = [];
    window.Game = {
      startDailySignal: () => { dailyCalls++; return true; },
      getDailySignal: () => ({
        concept: "Force changes motion",
        planetName: "Earth",
        labContract: {
          title: "Mass remix proof",
          command: "hopper.mass = 1.5\nhopper.engine = 6"
        }
      }),
      startLevel: (level) => { startedLevels.push(level); }
    };
    assertEquals(true, runStartMissionRadarAction(), "Daily radar action should execute");
    assertEquals(1, dailyCalls, "Daily radar action should start the Daily Signal");
    assertEquals("hopper.mass = 1.5\nhopper.engine = 6", els["console-input"].value, "Daily radar action should stage the full Signal Lab command");
    assertEquals(true, els["console-input"].focused, "Daily radar action should focus the terminal after staging");
    assertEquals("signal-lab-contract", window.Game.lastStagedExperiment && window.Game.lastStagedExperiment.source, "Daily radar action should stage through the Signal Lab proof source");
    assertEquals("Mass remix proof", window.Game.lastStagedExperiment && window.Game.lastStagedExperiment.title, "Daily radar action should preserve the Signal Lab focus");
    els["start-mission-radar-btn"].dataset.action = "quest";
    els["start-mission-radar-btn"].dataset.level = "2";
    assertEquals(true, runStartMissionRadarAction(), "Quest radar action should execute");
    assertEquals(2, startedLevels[0], "Quest radar action should start the requested planet");
    window.Game = oldWindowGame22cc;
    window.StarHopperProfiles = oldProfiles22cc;
    if (oldSwitchMainMode22cc) switchMainMode = oldSwitchMainMode22cc;

    document.getElementById = oldGetElementById22cc;
    if (oldNotebookEntries22cc) {
      Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
      Object.assign(notebookEntries, oldNotebookEntries22cc);
    }
    renderTestResult("engine-suite", "Curriculum: research panel surfaces next lab quest", true);
  } catch (err) {
    document.getElementById = oldGetElementById22cc;
    window.Game = oldWindowGame22cc;
    window.StarHopperProfiles = oldProfiles22cc;
    if (oldSwitchMainMode22cc) switchMainMode = oldSwitchMainMode22cc;
    if (oldNotebookEntries22cc) {
      Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
      Object.assign(notebookEntries, oldNotebookEntries22cc);
    }
    renderTestResult("engine-suite", "Curriculum: research panel surfaces next lab quest", false, err.message);
  }

  // Test 22d: Mission CRT names the next formula card from the active mission scaffold.
  const oldGetElementById22d = document.getElementById;
  try {
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.discoveredFormulaKinds = new Set();
    const earthMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const firstTarget = getActiveFormulaTarget(game, earthMission);
    assertEquals("Gravity Lab", firstTarget.title, "Earth scaffold should target antigravity first");

    game.discoveredFormulaKinds = new Set(["antigravity", "mass", "engine", "jump"]);
    const fallbackTarget = getActiveFormulaTarget(game, earthMission);
    assertEquals("Rocket Lab", fallbackTarget.title, "After Earth cards, target should fall back to next global card");

    const stageBtn = {
      handler: null,
      addEventListener(event, handler) { if (event === "click") this.handler = handler; }
    };
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "", querySelector: () => stageBtn };
    document.getElementById = (id) => id === "formula-target" ? panel : null;
    game.discoveredFormulaKinds = new Set(["antigravity"]);
    updateFormulaTarget(game);
    assertEquals(true, /NEXT FORMULA CARD/.test(panel.innerHTML), "CRT should label the next card target");
    assertEquals(true, /Mass Lab/.test(panel.innerHTML), "CRT should advance to the next Earth formula card");
    assertEquals(true, new RegExp(`1\\/${DISCOVERY_RULES.length}`).test(panel.innerHTML), "CRT should show collection progress");
    assertEquals(true, /LEARN/.test(panel.innerHTML), "CRT formula target should label the science idea");
    assertEquals(true, /Mass controls acceleration/.test(panel.innerHTML), "CRT formula target should name the concept axis");
    assertEquals(true, /CODE/.test(panel.innerHTML), "CRT formula target should label the coding move");
    assertEquals(true, /Tune hopper\.mass once/.test(panel.innerHTML), "CRT formula target should name the exact code move");
    assertEquals(true, /WIN/.test(panel.innerHTML), "CRT formula target should label the payoff");
    assertEquals(true, /Open lighter-build routes/.test(panel.innerHTML), "CRT formula target should show the in-game payoff");
    assertEquals(true, /hopper\.mass = 1\.0/.test(panel.innerHTML), "CRT formula target should show the runnable sample command");
    assertEquals(true, /STAGE CODE/.test(panel.innerHTML), "CRT formula target should expose a stage-code action");
    assertEquals(true, typeof stageBtn.handler === "function", "CRT formula target should wire the stage-code click handler");
    const inputEl = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => id === "console-input" ? inputEl : null;
    stageBtn.handler();
    assertEquals("hopper.mass = 1.0", inputEl.value, "Stage-code action should place the formula command in the terminal");
    assertEquals(true, inputEl.focused, "Stage-code action should focus the terminal input");
    document.getElementById = oldGetElementById22d;
    renderTestResult("engine-suite", "Curriculum: CRT surfaces next formula card target", true);
  } catch (err) {
    document.getElementById = oldGetElementById22d;
    renderTestResult("engine-suite", "Curriculum: CRT surfaces next formula card target", false, err.message);
  }

  // Test 22e: Clear screen lab report summarizes telemetry, formula progress, and next quest.
  const oldGetElementById22e = document.getElementById;
  const oldProfiles22e = window.StarHopperProfiles;
  const oldWindowGame22e = window.Game;
  const oldAttemptRows22e = (typeof AttemptLog !== 'undefined' && AttemptLog.byPlanet) ? AttemptLog.byPlanet : null;
  const oldSwitchMainMode22e = typeof switchMainMode === 'function' ? switchMainMode : null;
  try {
    window.StarHopperProfiles = { getActive: () => ({ name: "Nova", emoji: "🚀" }) };
    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = { 0: [{ maxH: 222, maxV: 6.4, result: "cleared" }] };
    const report = { innerHTML: "" };
    const inputEl = {
      value: "",
      focused: false,
      style: {},
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => {
      if (id === "clear-lab-report") return report;
      if (id === "console-input") return inputEl;
      return null;
    };

    const game = new StarHopperGame();
    window.Game = game;
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 2;
    game.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    game.discoveryPassCounts = {
      "earth-gravity-wall": 1,
      "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
    };
    game.discoveredFormulaKinds = new Set(["antigravity"]);
    game.researchXP = 60;
    game.planetClears = { 0: 1 };
    game.villageTrust = { 0: { points: 7, badges: ["friend", "ally"], sources: { "village-trade:0:geary:engine_1": 3, "village-rescue:0:geary": 4 } } };
    game.discoveryCombo = 2;
    game.streakCount = 3;
    game.getReturnStreakDailyFocus = () => ({ title: "Mass remix proof" });
    game.discoveryPulse = {
      code: "hopper.mass = 1.0",
      combo: 2,
      rewardXP: 8,
      futureLabScene: {
        label: "CASE FILE",
        speaker: "VECTOR",
        title: "Hidden-force case file",
        body: "The Mag-Net trace proved an invisible field can be tested before Dark Matter Lab opens.",
        lesson: "Science payoff: infer an unseen force from visible motion.",
        proofLabel: "ANOMALY TRACED"
      }
    };
    game.lastScienceDelta = {
      code: "hopper.mass = 1.0",
      nextExperiment: {
        title: "Compare a lighter Hopper",
        body: "Lower mass one step, rerun the jump, and compare the height.",
        command: "hopper.mass = 0.8",
        kind: "mass"
      }
    };
    let labStars22e = game.recordClearLabStars({ isDailyRun: false });
    labStars22e = game.grantMasteryClearReward(labStars22e);
    game.renderClearLabReport({
      isDailyRun: false,
      nextIndex: 1,
      earnedGems: 2,
      gemKey: "emerald",
      labStars: labStars22e,
      clearTime: { elapsed: 12.4, best: 12.4, isNewBest: true }
    });

    assertEquals(true, /CLEAR LAB REPORT/.test(report.innerHTML), "Clear report should render a heading");
    assertEquals(true, /3\/3 Lab Stars/.test(report.innerHTML), "Clear report should include the mastery star rating");
    assertEquals(true, /CADET RECORD/.test(report.innerHTML), "Clear report should include the named cadet record");
    assertEquals(true, /🚀 Nova \/\/ Physics Tinkerer/.test(report.innerHTML), "Clear report should show the cadet and research title");
    assertEquals(true, /Daily Streak d3 · Mass remix proof/.test(report.innerHTML), "Clear report cadet record should show the daily lab streak habit");
    assertEquals(true, /Lab Chain x2 -&gt; TRIPLE TEST x3/.test(report.innerHTML), "Clear report cadet record should show the active lab-chain milestone");
    assertEquals(true, /Passport 1\/6 stamps · next Moon/.test(report.innerHTML), "Clear report cadet record should show Science Passport stamp progress");
    assertEquals(true, /Lesson Paths 0\/3 · next Hopper Engineering Shakedown/.test(report.innerHTML), "Clear report cadet record should show lesson-path portfolio progress");
    assertEquals(true, /1\/\d+ formulas/.test(report.innerHTML), "Clear report cadet record should show formula progress");
    assertEquals(true, /Hypothesis Proofs 0\/6 · next Hopper Engineering Shakedown/.test(report.innerHTML), "Clear report cadet record should show hypothesis proof progress");
    assertEquals(true, /Future Lab: Source Key complete/.test(report.innerHTML), "Clear report cadet record should show the completed Future Lab source-key portfolio state");
    assertEquals(true, /2\/5 AI states/.test(report.innerHTML), "Clear report cadet record should show AI State Deck progress");
    assertEquals(true, /next Pet Pact/.test(report.innerHTML), "Clear report cadet record should name the next AI behavior card");
    assertEquals(true, /GET LOTION/.test(report.innerHTML), "Clear report cadet record should include the next AI behavior action");
    assertEquals(true, /clear-cadet-ai-btn/.test(report.innerHTML), "Clear report cadet record should expose a direct AI route button");
    assertEquals(true, /runClearCadetAIAction\('pet-pact'\)/.test(report.innerHTML), "Clear report AI button should target the next missing state");
    assertEquals(true, /clear-cadet-lesson-btn/.test(report.innerHTML), "Clear report cadet record should expose a direct lesson-path route button");
    assertEquals(true, /runClearCadetLessonPathAction\('earth-gravity-wall'\)/.test(report.innerHTML), "Clear report lesson button should target the next unfinished lesson path");
    assertEquals(true, /clear-cadet-hypothesis-btn/.test(report.innerHTML), "Clear report cadet record should expose a direct hypothesis proof route button");
    assertEquals(true, /runClearCadetHypothesisAction\('earth-gravity-wall'\)/.test(report.innerHTML), "Clear report hypothesis button should target the next unconfirmed prediction proof");
    assertEquals(true, /NEW MASTERY BADGE/.test(report.innerHTML), "Clear report should celebrate a first 3-star mastery");
    assertEquals(true, /\+25 Research XP/.test(report.innerHTML), "Clear report should show the mastery XP reward");
    assertEquals(true, /WORLD MASTERY/.test(report.innerHTML), "Clear report should include per-world mastery progress");
    assertEquals(true, /Signal Scout/.test(report.innerHTML), "Clear report should show newly earned world mastery tier");
    assertEquals(true, /VILLAGE TRUST/.test(report.innerHTML), "Clear report should include village trust progress");
    assertEquals(true, /Cave Ally/.test(report.innerHTML), "Clear report should show current village trust tier");
    assertEquals(true, /7 trust/.test(report.innerHTML), "Clear report should show current village trust points");
    assertEquals(true, /Village Guardian at 12 trust/.test(report.innerHTML), "Clear report should show the next village trust tier");
    assertEquals(true, /Guardian Pact/.test(report.innerHTML), "Clear report should name the next village pact");
    assertEquals(true, /AI state: scared -&gt; pet -&gt; guard/.test(report.innerHTML), "Clear report should connect village trust to the AI-state concept");
    assertEquals(true, /VILLAGE QUEST CHAIN/.test(report.innerHTML), "Clear report should include the village quest chain");
    assertEquals(true, /2\/3/.test(report.innerHTML), "Clear report should show village quest-chain completion");
    assertEquals(true, /Next: Guard pact/.test(report.innerHTML), "Clear report should name the next village quest-chain step");
    assertEquals(true, /scared -&gt; pet -&gt; guard/.test(report.innerHTML), "Clear report should show the next village quest formula");
    assertEquals(true, /OK Trade: Resource flow/.test(report.innerHTML), "Clear report should credit the trade pact in the chain");
    assertEquals(true, /OK Rescue: State machine/.test(report.innerHTML), "Clear report should credit the rescue pact in the chain");
    assertEquals(true, /NEXT LAB UNLOCK/.test(report.innerHTML), "Clear report should show the next research unlock target");
    assertEquals(true, /Combo Amplifier in 30 XP/.test(report.innerHTML), "Clear report should show the post-run tuned XP gap to the next perk");
    assertEquals(true, /50% toward next lab unlock/.test(report.innerHTML), "Clear report should render tuned research unlock progress");
    assertEquals(true, /OK Mission tasks/.test(report.innerHTML), "Clear report should credit completed mission tasks");
    assertEquals(true, /OK Science proof/.test(report.innerHTML), "Clear report should credit the science-proof action");
    assertEquals(true, /222px/.test(report.innerHTML), "Clear report should include max height");
    assertEquals(true, /6.4 px\/f/.test(report.innerHTML), "Clear report should include max speed");
    assertEquals(true, /NEW LAB TIME/.test(report.innerHTML), "Clear report should celebrate a new personal-best time");
    assertEquals(true, /12.4s/.test(report.innerHTML), "Clear report should include the lab clear time");
    assertEquals(true, /Best Time/.test(report.innerHTML), "Clear report should include best-time progress");
    assertEquals(true, /SIGNAL DECODED/.test(report.innerHTML), "Clear report should celebrate the chapter decoded by this clear");
    assertEquals(true, /Emerald Wall Signal/.test(report.innerHTML), "Clear report should name the decoded Signal Story chapter");
    assertEquals(true, /Variables change motion/.test(report.innerHTML), "Decoded story card should show the science concept");
    assertEquals(true, /CASE FILE/.test(report.innerHTML), "Clear report should preserve the future-lab case-file scene from the run");
    assertEquals(true, /VECTOR \/\/ Hidden-force case file/.test(report.innerHTML), "Clear report should name the future-lab scene speaker and title");
    assertEquals(true, /infer an unseen force from visible motion/.test(report.innerHTML), "Clear report should show the future-lab science payoff");
    assertEquals(true, /ANOMALY TRACED/.test(report.innerHTML), "Clear report should connect the scene to the proof label");
    assertEquals(true, /NEXT SIGNAL CHAPTER/.test(report.innerHTML), "Clear report should preview the next story chapter");
    assertEquals(true, /Moon Loop Echo/.test(report.innerHTML), "Clear report should name the next Signal Story chapter");
    assertEquals(true, /Loops build repeatable patterns/.test(report.innerHTML), "Clear report should show the next chapter concept");
    assertEquals(true, /2\/12 decoded/.test(report.innerHTML), "Clear report should show story progress");
    assertEquals(true, /EXPLAIN THE EVIDENCE/.test(report.innerHTML), "Clear report should prompt the post-run explanation step");
    assertEquals(true, /Finish the lab loop/.test(report.innerHTML), "Clear report should frame explanation as the lab-loop finish");
    assertEquals(true, /Evidence starter/.test(report.innerHTML), "Clear report should include the notebook evidence starter");
    assertEquals(true, /WRITE EXPLANATION/.test(report.innerHTML), "Clear report should include a direct notebook action");
    assertEquals(true, /NEXT RUN CONTRACT/.test(report.innerHTML), "Clear report should include a replay contract");
    assertEquals(true, /Collect Mass Lab/.test(report.innerHTML), "Replay contract should target the next formula card");
    assertEquals(true, /RETRY FOR FORMULA/.test(report.innerHTML), "Replay contract should include an actionable next-run button");
    assertEquals(true, /NEXT OBJECTIVE QUEUE/.test(report.innerHTML), "Clear report should rank the best next objectives");
    assertEquals(true, /#1 NEXT RUN CONTRACT/.test(report.innerHTML), "Objective queue should put the replay contract first");
    assertEquals(true, /#2 EXPLAIN THE EVIDENCE/.test(report.innerHTML), "Objective queue should make proof writing the second lab step");
    assertEquals(true, /#3 SIGNAL DECODED/.test(report.innerHTML), "Objective queue should keep story momentum visible");
    assertEquals(true, /#4 LAB CHAIN x2/.test(report.innerHTML), "Objective queue should preserve the active lab chain after a clear");
    assertEquals(true, /clear-objective-contract/.test(report.innerHTML), "Clear objective queue should render learning-contract strips");
    assertEquals(true, /One tweak -&gt; better evidence/.test(report.innerHTML), "Clear replay objective should explain the one-more-run contract");
    assertEquals(true, /Evidence -&gt; explanation/.test(report.innerHTML), "Clear explanation objective should name the evidence loop");
    assertEquals(true, /Signal clue -&gt; next chapter/.test(report.innerHTML), "Clear story objective should name the signal-story loop");
    assertEquals(true, /LEARN/.test(report.innerHTML) && /WIN/.test(report.innerHTML) && /Compare a lighter Hopper/.test(report.innerHTML), "Clear lab-chain objective should render the one-more-run learning chips");
    assertEquals(true, /Predict before code/.test(report.innerHTML), "Clear hypothesis objective should explain the prediction proof learning step");
    assertEquals(true, /One tested tweak/.test(report.innerHTML), "Clear hypothesis objective should explain the prediction proof coding step");
    assertEquals(true, /Proof \+ XP/.test(report.innerHTML), "Clear hypothesis objective should explain the prediction proof payoff");
    assertEquals(true, /state \+ event -&gt; next state/.test(report.innerHTML), "Clear AI objective should name the state-machine loop");
    assertEquals(true, /Compare a lighter Hopper/.test(report.innerHTML), "Lab-chain objective should name the next one-variable tweak");
    assertEquals(true, /clear-objective-item clear-lab-chain/.test(report.innerHTML), "Lab-chain clear objective should get a distinct collectible style");
    assertEquals(true, /clear-objective-code/.test(report.innerHTML), "Clear objective queue should render command chips for stageable items");
    assertEquals(true, /hopper\.mass = 0\.8/.test(report.innerHTML), "Lab-chain clear objective should show the next staged command");
    assertEquals(true, /clear-objective-progress lab-chain/.test(report.innerHTML), "Lab-chain clear objective should render milestone pips");
    assertEquals(true, /2\/3 to TRIPLE TEST/.test(report.innerHTML), "Lab-chain clear objective should show next combo milestone progress");
    assertEquals(true, /clear-objective-action-btn/.test(report.innerHTML), "Lab-chain objective should expose a direct staging button");
    assertEquals(true, /STAGE CHAIN/.test(report.innerHTML), "Lab-chain objective should label the staging action");
    assertEquals(true, /#5 HYPOTHESIS PROOF/.test(report.innerHTML), "Objective queue should include the next hypothesis collection target");
    assertEquals(true, /Prove Hopper Engineering Shakedown/.test(report.innerHTML), "Objective queue should name the next hypothesis proof");
    assertEquals(true, /RUN PROOF/.test(report.innerHTML), "Objective queue should expose the hypothesis proof action");
    assertEquals(true, /clear-objective-progress hypothesis-proof/.test(report.innerHTML), "Hypothesis objective should render proof progress pips");
    assertEquals(true, /0\/6 proofs/.test(report.innerHTML), "Hypothesis objective should show collection progress");
    assertEquals(true, /#6 AI STATE DECK/.test(report.innerHTML), "Objective queue should still include the next AI-state collection target");
    assertEquals(true, /Pet Pact/.test(report.innerHTML), "Objective queue should name the next missing AI-state card");
    assertEquals(true, /GET LOTION/.test(report.innerHTML), "Objective queue should expose the AI-state deck action label");
    const queueActionButtons = (report.innerHTML.match(/clear-objective-action-btn/g) || []).length;
    assertEquals(6, queueActionButtons, "Every ranked clear objective in this report should have a direct action button");
    assertEquals(true, /runClearObjectiveQueueAction\(1\)/.test(report.innerHTML), "Replay objective should route through the queue dispatcher");
    assertEquals(true, /runClearObjectiveQueueAction\(2\)/.test(report.innerHTML), "Explain objective should route through the queue dispatcher");
    assertEquals(true, /runClearObjectiveQueueAction\(3\)/.test(report.innerHTML), "Story objective should route through the queue dispatcher");
    assertEquals(true, /runClearObjectiveQueueAction\(4\)/.test(report.innerHTML), "Lab-chain objective should route through the queue dispatcher");
    assertEquals(true, /runClearObjectiveQueueAction\(5\)/.test(report.innerHTML), "Hypothesis objective should route through the queue dispatcher");
    assertEquals(true, /runClearObjectiveQueueAction\(6\)/.test(report.innerHTML), "AI objective should route through the queue dispatcher");
    assertEquals("Collect Mass Lab", game.lastClearObjectiveQueue[0].title, "Objective queue data should preserve the top replay target");
    assertEquals("replay", game.lastClearObjectiveQueue[0].action, "Replay objective should preserve its action type");
    assertEquals("WRITE EXPLANATION", game.lastClearObjectiveQueue[1].cta, "Objective queue data should preserve the explanation action");
    assertEquals("explain", game.lastClearObjectiveQueue[1].action, "Explain objective should preserve its action type");
    assertEquals("Emerald Wall Signal", game.lastClearObjectiveQueue[2].title, "Objective queue data should preserve the decoded story target");
    assertEquals("story", game.lastClearObjectiveQueue[2].action, "Story objective should preserve its action type");
    assertEquals("Compare a lighter Hopper", game.lastClearObjectiveQueue[3].title, "Objective queue data should preserve the lab-chain target");
    assertEquals("lab-chain", game.lastClearObjectiveQueue[3].action, "Lab-chain objective should preserve its action type");
    assertEquals("hopper.mass = 0.8", game.lastClearObjectiveQueue[3].command, "Lab-chain objective data should preserve the next command");
    assertEquals("lab-chain", game.lastClearObjectiveQueue[3].progress && game.lastClearObjectiveQueue[3].progress.mode, "Lab-chain objective data should preserve progress metadata");
    assertEquals("Prove Hopper Engineering Shakedown", game.lastClearObjectiveQueue[4].title, "Objective queue data should preserve the hypothesis proof target");
    assertEquals("hypothesis", game.lastClearObjectiveQueue[4].action, "Hypothesis objective should preserve its action type");
    assertEquals("earth-gravity-wall", game.lastClearObjectiveQueue[4].missionId, "Hypothesis objective should preserve the mission route");
    assertEquals("hypothesis-proof", game.lastClearObjectiveQueue[4].progress && game.lastClearObjectiveQueue[4].progress.mode, "Hypothesis objective data should preserve progress metadata");
    assertEquals("Pet Pact", game.lastClearObjectiveQueue[5].title, "Objective queue data should preserve the AI-state card target");
    assertEquals("ai-state", game.lastClearObjectiveQueue[5].action, "AI objective should preserve its action type");
    assertEquals("pet-pact", game.lastClearObjectiveQueue[5].cardId, "AI objective should preserve the deck card route");
    let queuedReplay = 0;
    let queuedExplain = null;
    let queuedLab = 0;
    let queuedHypothesis = null;
    let queuedAI = null;
    const queuedStoryModes = [];
    game.runClearReplayContract = (contract) => { queuedReplay++; return contract === game.lastClearReplayContract; };
    game.runClearExplainPrompt = (options) => { queuedExplain = options || {}; return true; };
    game.runClearLabChainTarget = (target) => { queuedLab++; return target === game.lastClearLabChainTarget; };
    game.runClearCadetHypothesisAction = (missionId) => { queuedHypothesis = missionId; return true; };
    game.runClearCadetAIAction = (cardId) => { queuedAI = cardId; return true; };
    switchMainMode = (mode) => { queuedStoryModes.push(mode); };
    assertEquals(true, game.runClearObjectiveQueueAction(1), "Queue replay action should dispatch");
    assertEquals(1, queuedReplay, "Queue replay action should call the replay contract handler");
    assertEquals(true, game.runClearObjectiveQueueAction(2), "Queue explain action should dispatch");
    assertEquals(false, queuedExplain && queuedExplain.preserveReflectionContext, "Generic queue explain action should not preserve stale context");
    assertEquals(true, game.runClearObjectiveQueueAction(3), "Queue story action should dispatch");
    assertEquals("notebook", queuedStoryModes[0], "Queue story action should open the notebook/log surface");
    assertEquals(true, game.runClearObjectiveQueueAction(4), "Queue lab-chain action should dispatch");
    assertEquals(1, queuedLab, "Queue lab-chain action should call the lab-chain handler");
    assertEquals(true, game.runClearObjectiveQueueAction(5), "Queue hypothesis action should dispatch");
    assertEquals("earth-gravity-wall", queuedHypothesis, "Queue hypothesis action should route the next prediction proof");
    assertEquals(true, game.runClearObjectiveQueueAction(6), "Queue AI action should dispatch");
    assertEquals("pet-pact", queuedAI, "Queue AI action should route the next deck card");
    delete game.runClearReplayContract;
    delete game.runClearExplainPrompt;
    delete game.runClearLabChainTarget;
    delete game.runClearCadetHypothesisAction;
    delete game.runClearCadetAIAction;
    const clearChainModes = [];
    switchMainMode = (mode) => { clearChainModes.push(mode); };
    assertEquals(true, game.runClearLabChainTarget(), "Clear report lab-chain action should stage the next experiment");
    assertEquals("terminal", clearChainModes[0], "Lab-chain clear action should return to the terminal");
    assertEquals("hopper.mass = 0.8", inputEl.value, "Lab-chain clear action should stage the next command");
    assertEquals(true, inputEl.focused, "Lab-chain clear action should focus the terminal input");
    assertEquals("clear-lab-chain", game.lastStagedExperiment && game.lastStagedExperiment.source, "Lab-chain staging should record the clear-report source");
    const clearHypothesisStarts = [];
    const clearHypothesisModes = [];
    game.startLevel = (level) => { clearHypothesisStarts.push(level); };
    switchMainMode = (mode) => { clearHypothesisModes.push(mode); };
    assertEquals(true, game.runClearCadetHypothesisAction("earth-gravity-wall"), "Clear report hypothesis action should launch the next prediction proof");
    assertEquals(0, clearHypothesisStarts[0], "Clear report hypothesis action should launch Earth for the first proof");
    assertEquals("earth-gravity-wall", game.activeHypothesisMissionId, "Clear report hypothesis action should remember the active proof mission");
    assertEquals("terminal", clearHypothesisModes[0], "Clear report hypothesis action should return to the playable terminal");
    const clearAIStarts = [];
    const clearAIModes = [];
    game.startLevel = (level) => { clearAIStarts.push(level); };
    switchMainMode = (mode) => { clearAIModes.push(mode); };
    assertEquals(true, game.runClearCadetAIAction("pet-pact"), "Clear report AI action should launch the next behavior proof");
    assertEquals(3, clearAIStarts[0], "Clear report AI action should launch the lotion route world");
    assertEquals("pet-pact", game.activeAIStateRun && game.activeAIStateRun.cardId, "Clear report AI action should remember the active proof card");
    assertEquals("terminal", clearAIModes[0], "Clear report AI action should return to the playable terminal");
    const clearLessonStarts = [];
    const clearLessonModes = [];
    game.startLevel = (level) => { clearLessonStarts.push(level); };
    switchMainMode = (mode) => { clearLessonModes.push(mode); };
    assertEquals(true, game.runClearCadetLessonPathAction("earth-gravity-wall"), "Clear report lesson action should launch the next lesson path");
    assertEquals(0, clearLessonStarts[0], "Clear report lesson action should launch Earth for the first lesson path");
    assertEquals("terminal", clearLessonModes[0], "Clear report lesson action should return to the terminal");
    assertEquals("use_hopper()\nantigravity = 4.9", inputEl.value, "Clear report lesson action should stage the first lesson-path command");
    assertEquals("cadet-lesson-path", game.lastStagedExperiment && game.lastStagedExperiment.source, "Clear report lesson action should enter the shared staged-experiment loop");
    assertEquals(true, new RegExp(`1\\/${DISCOVERY_RULES.length}`).test(report.innerHTML), "Clear report should include formula deck progress");
    assertEquals(true, /\+2 emerald/.test(report.innerHTML), "Clear report should include newly banked gems");
    assertEquals(true, /Collect Mass Lab/.test(report.innerHTML), "Clear report should include the next lab quest");

    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = oldAttemptRows22e || {};
    window.StarHopperProfiles = oldProfiles22e;
    window.Game = oldWindowGame22e;
    if (oldSwitchMainMode22e) switchMainMode = oldSwitchMainMode22e;
    document.getElementById = oldGetElementById22e;
    renderTestResult("engine-suite", "Curriculum: clear screen renders lab report", true);
  } catch (err) {
    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = oldAttemptRows22e || {};
    window.StarHopperProfiles = oldProfiles22e;
    window.Game = oldWindowGame22e;
    if (oldSwitchMainMode22e) switchMainMode = oldSwitchMainMode22e;
    document.getElementById = oldGetElementById22e;
    renderTestResult("engine-suite", "Curriculum: clear screen renders lab report", false, err.message);
  }

  // Test 22f: Clear lab stars reward mission tasks, mission gems, and science proof.
  try {
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    game.requiredCollectiblesTotal = 3;
    game.requiredCollectiblesCollected = 3;
    game.confirmedHypotheses = new Set(["earth-gravity-wall"]);
    game.bestLabStars = { 0: 2 };

    const summary = game.recordClearLabStars({ isDailyRun: false });
    assertEquals(3, summary.stars, "All three lab-star checks should be earned");
    assertEquals(true, summary.isNewBest, "A 3-star clear should beat the previous 2-star best");
    assertEquals(true, summary.isNewMastery, "First 3-star clear should be a new mastery");
    assertEquals(3, game.bestLabStars[0], "Best lab-star score should persist on the game state");
    assertEquals(true, game.masteryCleared[0], "3-star clear should mark the planet mastered");
    assertEquals(20, summary.worldMasteryAddedXP, "A new lab star should add world mastery XP");
    assertEquals(20, game.getWorldMasteryProgress(0).xp, "World mastery meter should persist the lab-star XP");
    const repeat = game.recordClearLabStars({ isDailyRun: false });
    assertEquals(0, repeat.worldMasteryAddedXP, "Repeating the same star best should not farm world mastery XP");
    assertEquals(true, summary.checks.some(check => check.id === "science" && check.earned), "Science proof should count for a lab star");
    renderTestResult("engine-suite", "Curriculum: clear lab stars reward mastery actions", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: clear lab stars reward mastery actions", false, err.message);
  }

  // Test 22ff: Clear times persist personal bests for replay motivation without rewarding slower repeats.
  try {
    const game = new StarHopperGame();
    game.currentPlanetIndex = 0;
    game.bestClearTimes = { 0: 10 };

    let time = game.recordClearTime({ elapsedSeconds: 12.04 });
    assertEquals(12.0, time.elapsed, "Clear time should be rounded to tenths");
    assertEquals(false, time.isNewBest, "Slower replay should not replace a personal best");
    assertEquals(10, game.bestClearTimes[0], "Existing faster best should remain");

    time = game.recordClearTime({ elapsedSeconds: 8.26 });
    assertEquals(8.3, time.elapsed, "Faster clear should be rounded to tenths");
    assertEquals(true, time.isNewBest, "Faster replay should mark a new personal best");
    assertEquals(8.3, game.bestClearTimes[0], "Faster best should persist on the game state");
    assertEquals(time, game.lastClearTimeSummary, "Latest clear time summary should be available to the report");

    game.dailyInfo = { dateStr: "2026-06-30" };
    time = game.recordClearTime({ isDailyRun: true, elapsedSeconds: 19.91 });
    assertEquals("daily:2026-06-30", time.key, "Daily Signal clear time should use the daily key");
    assertEquals(19.9, game.bestClearTimes["daily:2026-06-30"], "Daily best time should persist separately");

    game.levelStartMs = 1000;
    assertEquals(2.5, game.getRunTimeSeconds(3500), "Run timer should measure elapsed seconds from level load");
    renderTestResult("engine-suite", "Curriculum: clear times record personal bests", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: clear times record personal bests", false, err.message);
  }

  // Test 22fg: Clear report replay contracts point to the next concrete learning loop.
  try {
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;

    let contract = game.getClearReplayContract({
      labStars: {
        stars: 2,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: false }
        ]
      },
      clearTime: { best: 9.8 }
    });
    assertEquals("Leave science proof", contract.title, "Missing science star should be the first replay contract");
    assertEquals(true, /3\/3 Lab Stars/.test(contract.reward), "Missing-star contract should name the next star reward");
    assertEquals("replay", contract.action, "Missing-star contract should replay the current world");
    assertEquals("RETRY FOR STAR", contract.cta, "Missing-star contract should have an action label");

    game.discoveredFormulaKinds = new Set(["antigravity"]);
    contract = game.getClearReplayContract({
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ]
      },
      clearTime: { best: 9.8 }
    });
    assertEquals("Collect Mass Lab", contract.title, "After 3 stars, next missing formula should become the contract");
    assertEquals("Reward: formula card + Research XP", contract.reward, "Formula contract should carry the science reward");
    assertEquals("replay", contract.action, "Formula contract should replay the current world");
    assertEquals("RETRY FOR FORMULA", contract.cta, "Formula contract should name the immediate action");

    game.discoveredFormulaKinds = new Set(DISCOVERY_RULES.map(rule => rule.kind));
    contract = game.getClearReplayContract({
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ]
      },
      clearTime: { best: 10 }
    });
    assertEquals("Beat 10.0s Lab Time", contract.title, "Complete science progress should fall through to personal-best timing");
    assertEquals("Target: 9.2s", contract.reward, "Timing contract should set a reachable target");
    assertEquals("CHASE TIME", contract.cta, "Timing contract should invite a speed chase");

    const replayFocus = buildReplayLabContract(PLANETS[3], 3, {
      targetOverrides: {},
      constraint: { id: "glacies-friction-target", minFriction: 8 }
    });
    game.dailyInfo = { labContract: replayFocus };
    const dailyContract = game.getClearReplayContract({
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ]
      },
      isDailyRun: true
    });
    assertEquals(replayFocus.title, dailyContract.title, "Daily clear contract should reuse the replay lab focus");
    assertEquals(true, dailyContract.body.indexOf("friction = 8") >= 0, "Daily clear contract should include the focused command");

    game.dailyInfo = { isFrontier: true, labContract: replayFocus };
    const frontierContract = game.getClearReplayContract({
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ]
      },
      isFrontierRun: true
    });
    assertEquals(replayFocus.title, frontierContract.title, "Frontier clear contract should reuse the replay lab focus when present");
    assertEquals(true, frontierContract.body.indexOf("friction = 8") >= 0, "Frontier clear contract should include the focused command");
    assertEquals("frontier", frontierContract.action, "Frontier contract should start the next frontier run");
    assertEquals("NEXT FRONTIER", frontierContract.cta, "Frontier contract should label the frontier action");

    const oldGetElementById22fgReport = document.getElementById;
    try {
      const repairReport = { innerHTML: "" };
      document.getElementById = (id) => id === "clear-lab-report" ? repairReport : null;
      const repairReportGame = new StarHopperGame();
      repairReportGame.currentPlanet = PLANETS[0];
      repairReportGame.currentPlanetIndex = 0;
      repairReportGame.reflectionContext = {
        kind: "repair-proof",
        source: "Crash Lab",
        title: "Fix the jump arc",
        command: "hopper.jump = 18",
        prediction: "higher",
        proofLabel: "REPAIR PROOF",
        proofSourceKey: "failure-repair-proof:0:fix-the-jump-arc:abc123"
      };
      repairReportGame.renderClearLabReport({
        labStars: {
          stars: 2,
          maxStars: 3,
          checks: [
            { id: "missions", label: "Mission tasks", earned: true },
            { id: "gems", label: "Mission gems", earned: true },
            { id: "science", label: "Science proof", earned: false }
          ]
        }
      });
      assertEquals(true, /EXPLAIN REPAIR PROOF/.test(repairReport.innerHTML), "Clear report should label active repair-proof explanations");
      assertEquals(true, /Reward: Repair Reflection Proof/.test(repairReport.innerHTML), "Clear report should name the repair reflection payoff");
      assertEquals(true, /WRITE REPAIR PROOF/.test(repairReport.innerHTML), "Clear report should expose a repair-proof notebook action");
      assertEquals(true, /runClearExplainPrompt\(\{ preserveReflectionContext: true \}\)/.test(repairReport.innerHTML), "Repair clear-report action should preserve proof context");
    } finally {
      document.getElementById = oldGetElementById22fgReport;
    }

    const actionGame = new StarHopperGame();
    actionGame.currentPlanetIndex = 2;
    let replayArgs = null;
    let dailyCalls = 0;
    let frontierCalls = 0;
    const frontierOptions = [];
    let launchCalls = 0;
    actionGame.startLevel = (index, preserve) => { replayArgs = { index, preserve }; };
    actionGame.startDailySignal = () => { dailyCalls++; return true; };
    actionGame.startFrontierChallenge = (options) => { frontierCalls++; frontierOptions.push(options || null); return true; };
    actionGame.beginNextPlanetNavigation = () => { launchCalls++; };
    actionGame.runClearReplayContract({ action: "replay" });
    assertEquals(2, replayArgs.index, "Replay action should restart the current world");
    assertEquals(true, replayArgs.preserve, "Replay action should preserve tunings for one-more-test iteration");
    actionGame.runClearReplayContract({ action: "daily" });
    actionGame.runClearReplayContract({ action: "frontier" });
    actionGame.runClearReplayContract({ action: "dark-matter-echo" });
    actionGame.runClearReplayContract({ action: "dark-matter-prep" });
    actionGame.runClearReplayContract({ action: "launch" });
    assertEquals(1, dailyCalls, "Daily action should accept the daily signal");
    assertEquals(3, frontierCalls, "Frontier, echo, and prep actions should start Frontier challenges");
    assertEquals(null, frontierOptions[0], "Normal Frontier action should not carry prep options");
    assertEquals("dark-matter-echo", frontierOptions[1] && frontierOptions[1].source, "Echo action should carry the Dark Matter Echo source");
    assertEquals("dark-matter-prep", frontierOptions[2] && frontierOptions[2].source, "Prep action should carry the Dark Matter prep source");
    assertEquals(1, launchCalls, "Launch action should open the navigation bridge");

    const oldSwitchMainMode22fg = typeof switchMainMode === 'function' ? switchMainMode : null;
    const oldUpdateNotebook22fg = typeof updateNotebook === 'function' ? updateNotebook : null;
    const oldUpdateActiveQuestion22fg = typeof updateActiveQuestion === 'function' ? updateActiveQuestion : null;
    const oldUpdateReflectionStarter22fg = typeof updateReflectionEvidenceStarter === 'function' ? updateReflectionEvidenceStarter : null;
    const oldGetElementById22fg = document.getElementById;
    try {
      let notebookMode = null;
      let notebookUpdated = 0;
      let questionUpdated = 0;
      let reflectionMission = null;
      const responseEl = { focused: false, focus() { this.focused = true; } };
      switchMainMode = (mode) => { notebookMode = mode; };
      updateNotebook = () => { notebookUpdated++; };
      updateActiveQuestion = () => { questionUpdated++; };
      updateReflectionEvidenceStarter = (gameArg, missionArg) => { reflectionMission = missionArg; return "Evidence starter - test"; };
      document.getElementById = (id) => id === "notebook-user-response" ? responseEl : null;
      actionGame.currentPlanet = PLANETS[0];
      actionGame.completedMissions = new Set();
      actionGame.player = new Player(0, 0);
      actionGame.reflectionContext = { kind: "signal-lab", title: "Stale signal" };
      assertEquals(true, actionGame.runClearExplainPrompt(), "Explain action should complete successfully");
      assertEquals("notebook", notebookMode, "Explain action should open the Science Notebook");
      assertEquals(1, notebookUpdated, "Explain action should refresh notebook telemetry when a player exists");
      assertEquals(1, questionUpdated, "Explain action should refresh the active reflection question");
      assertEquals("earth-gravity-wall", reflectionMission && reflectionMission.id, "Explain action should use the active platformer mission");
      assertEquals(true, responseEl.focused, "Explain action should focus the reflection textbox");
      assertEquals(null, actionGame.reflectionContext, "Generic clear explanation should clear stale Signal Lab context");
      const repairContext = {
        kind: "repair-proof",
        source: "Crash Lab",
        title: "Fix the jump arc",
        command: "hopper.jump = 18",
        prediction: "higher",
        proofLabel: "REPAIR PROOF",
        proofSourceKey: "failure-repair-proof:0:fix-the-jump-arc:abc123"
      };
      actionGame.reflectionContext = repairContext;
      const repairPrompt = actionGame.getClearExplainPrompt();
      assertEquals("EXPLAIN REPAIR PROOF", repairPrompt.kicker, "Repair proof clear prompt should name the repair explanation");
      assertEquals("WRITE REPAIR PROOF", repairPrompt.cta, "Repair proof clear prompt should use the repair-proof CTA");
      assertEquals("Reward: Repair Reflection Proof", repairPrompt.reward, "Repair proof clear prompt should name the reflection reward");
      assertEquals(true, repairPrompt.preserveReflectionContext, "Repair proof clear prompt should request context preservation");
      assertEquals(true, /hopper\.jump = 18/.test(repairPrompt.question), "Repair proof question should mention the repair command");
      assertEquals(true, /Prediction: higher/.test(repairPrompt.question), "Repair proof question should mention the carried hypothesis");
      responseEl.focused = false;
      assertEquals(true, actionGame.runClearExplainPrompt({ preserveReflectionContext: repairPrompt.preserveReflectionContext }), "Repair explain action should complete successfully");
      assertEquals(repairContext, actionGame.reflectionContext, "Repair explain action should preserve the proof context for notebook saving");
      assertEquals(true, responseEl.focused, "Repair explain action should focus the reflection textbox");
      actionGame.masteryMeters = {
        0: {
          sources: {
            "reflection-proof:repair-reflection:failure-repair-proof:0:fix-the-jump-arc:abc123": 9
          }
        }
      };
      const completedRepairPrompt = actionGame.getClearExplainPrompt();
      assertEquals("EXPLAIN THE EVIDENCE", completedRepairPrompt.kicker, "Completed repair reflections should stop showing the repair-proof prompt");
      assertEquals("WRITE EXPLANATION", completedRepairPrompt.cta, "Completed repair reflections should fall back to the normal explain action");
      assertEquals("Reward: notebook proof + Research XP", completedRepairPrompt.reward, "Completed repair reflections should hand off to the normal notebook reward");
      assertEquals(undefined, completedRepairPrompt.preserveReflectionContext, "Completed repair prompt should not preserve stale repair context");
      assertEquals(false, /crash lab: Crash Lab/.test(completedRepairPrompt.evidence), "Completed repair prompt should not keep stale Crash Lab evidence");
      assertEquals(false, /repair prediction: higher/.test(completedRepairPrompt.evidence), "Completed repair prompt should not keep stale repair hypotheses");
    } finally {
      if (oldSwitchMainMode22fg) switchMainMode = oldSwitchMainMode22fg;
      if (oldUpdateNotebook22fg) updateNotebook = oldUpdateNotebook22fg;
      if (oldUpdateActiveQuestion22fg) updateActiveQuestion = oldUpdateActiveQuestion22fg;
      if (oldUpdateReflectionStarter22fg) updateReflectionEvidenceStarter = oldUpdateReflectionStarter22fg;
      document.getElementById = oldGetElementById22fg;
    }
    renderTestResult("engine-suite", "Curriculum: clear report suggests next replay contract", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: clear report suggests next replay contract", false, err.message);
  }

  // Test 22g: First 3-star mastery grants Research XP and a discovery pulse.
  try {
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.researchXP = 18;
    game.discoveryLog = [];

    const rewarded = game.grantMasteryClearReward({
      stars: 3,
      maxStars: 3,
      mastered: true,
      isNewMastery: true
    });
    assertEquals(43, game.researchXP, "Mastery clear should grant +25 Research XP");
    assertEquals(25, rewarded.masteryRewardXP, "Reward metadata should include XP amount");
    assertEquals(true, rewarded.masteryRankUp, "18 + 25 XP should cross into Variable Scout");
    assertEquals("Variable Scout", rewarded.masteryRankTitle, "Reward metadata should name the new rank");
    assertEquals("Mastery Clear", game.discoveryPulse.title, "Mastery reward should create a discovery pulse");
    assertEquals(1, game.discoveryLog.length, "Mastery reward should enter the discovery log");

    const beforeRepeat = game.researchXP;
    game.grantMasteryClearReward({ stars: 3, maxStars: 3, mastered: true, isNewMastery: false });
    assertEquals(beforeRepeat, game.researchXP, "Existing mastery should not grant duplicate XP");
    renderTestResult("engine-suite", "Curriculum: mastery clear grants Research XP", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: mastery clear grants Research XP", false, err.message);
  }

  // Test 22h: Lab-star progress pops a one-shot reward during play.
  const oldBubblePop22g = ComicBubbles.pop;
  const oldParticleBurst22g = Particles.spawnBurst;
  const oldSfxSuccess22g = SFX.playSuccess;
  try {
    const bubbleLabels22g = [];
    let particleCount = 0;
    let sfxCount = 0;
    ComicBubbles.pop = (x, y, text) => { bubbleLabels22g.push(text); };
    Particles.spawnBurst = () => { particleCount++; };
    SFX.playSuccess = () => { sfxCount++; };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.player = { x: 40, y: 50, w: 20, h: 28 };
    game.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 2;
    game.discoveryPassCounts = { "earth-gravity-wall": 1 };
    game._labStarPreviewCount = 1;

    assertEquals(2, game.checkLabStarProgress("test"), "Two newly earned stars should be reported");
    assertEquals(3, game._labStarPreviewCount, "Preview count should advance to the current star count");
    assertEquals("test", game.lastLabStarPulse.reason, "Pulse should remember why it fired");
    assertEquals("Samples + Proof", game.lastLabStarPulse.goalLabel, "Pulse should name the earned mastery goals");
    assertEquals(null, game.lastLabStarPulse.nextGoal, "A complete 3-star run should have no next missing star");
    assertEquals("LAB STARS 3/3: mastery proof ready", game.lastLabStarPulse.monitorText, "Pulse should store the CRT mastery message");
    assertEquals("LAB STARS 3/3: mastery proof ready", game.missionBalloon.text, "CRT should explain that all lab stars are complete");
    assertEquals("LAB STARS", game.missionBalloon.title, "CRT should label lab-star progress");
    assertEquals(2, bubbleLabels22g.length, "Visual reward should pop the star and goal bubbles");
    assertEquals(true, bubbleLabels22g.includes("LAB STARS +2"), "Visual reward should show the lab-star gain");
    assertEquals(true, bubbleLabels22g.includes("SAMPLES + PROOF"), "Visual reward should name the earned goal categories");
    assertEquals(1, particleCount, "Particle reward should burst once");
    assertEquals(1, sfxCount, "Success chime should play once");
    assertEquals(0, game.checkLabStarProgress("test"), "Calling again without progress should not repeat the reward");

    const partialGame = new StarHopperGame();
    partialGame.currentPlanet = PLANETS[0];
    partialGame.currentPlanetIndex = 0;
    partialGame.player = { x: 40, y: 50, w: 20, h: 28 };
    partialGame.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    partialGame.requiredCollectiblesTotal = 2;
    partialGame.requiredCollectiblesCollected = 0;
    partialGame.discoveryPassCounts = {};
    partialGame._labStarPreviewCount = 0;
    assertEquals(1, partialGame.checkLabStarProgress("mission"), "A partial star gain should still fire once");
    assertEquals("Samples", partialGame.lastLabStarPulse.nextGoal, "CRT cue should name the next missing educational goal");
    assertEquals("LAB STARS 1/3: Tasks; next Samples", partialGame.missionBalloon.text, "CRT should point from the earned star to the next missing star");

    const protectedGame = new StarHopperGame();
    protectedGame.currentPlanet = PLANETS[0];
    protectedGame.currentPlanetIndex = 0;
    protectedGame.player = { x: 40, y: 50, w: 20, h: 28 };
    protectedGame.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    protectedGame.requiredCollectiblesTotal = 2;
    protectedGame.requiredCollectiblesCollected = 0;
    protectedGame.discoveryPassCounts = {};
    protectedGame._labStarPreviewCount = 0;
    protectedGame.showMissionBalloon("TASKS DONE: collect 2 samples", { title: "MISSION CRT", timer: 260 });
    assertEquals(1, protectedGame.checkLabStarProgress("mission"), "Lab-star gain should still record under an active monitor cue");
    assertEquals("LAB STARS 1/3: Tasks; next Samples", protectedGame.lastLabStarPulse.monitorText, "Lab-star monitor text should still be stored");
    assertEquals("TASKS DONE: collect 2 samples", protectedGame.missionBalloon.text, "Lab-star cue should not overwrite a more actionable CRT message");

    ComicBubbles.pop = oldBubblePop22g;
    Particles.spawnBurst = oldParticleBurst22g;
    SFX.playSuccess = oldSfxSuccess22g;
    renderTestResult("engine-suite", "Curriculum: lab-star progress pops reward feedback", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePop22g;
    Particles.spawnBurst = oldParticleBurst22g;
    SFX.playSuccess = oldSfxSuccess22g;
    renderTestResult("engine-suite", "Curriculum: lab-star progress pops reward feedback", false, err.message);
  }

  // Test 22i: The start-screen galaxy map shows saved lab stars and unlocked planets.
  const oldQuerySelectorAll22g = document.querySelectorAll;
  const oldSwitchMainMode22g = switchMainMode;
  try {
    const makeClassList = (initial = []) => {
      const set = new Set(initial);
      return {
        add: (...classes) => classes.forEach(c => set.add(c)),
        remove: (...classes) => classes.forEach(c => set.delete(c)),
        contains: (c) => set.has(c),
        toggle: (c, force) => {
          const shouldAdd = force === undefined ? !set.has(c) : !!force;
          if (shouldAdd) set.add(c); else set.delete(c);
          return shouldAdd;
        },
        _set: set
      };
    };
    const makeNode = (level) => {
      const meta = { textContent: "", innerHTML: "" };
      return {
        level,
        disabled: true,
        title: "",
        classList: makeClassList(["planet-node", "locked"]),
        getAttribute: (name) => name === "data-level" ? String(level) : null,
        querySelector: (selector) => selector === ".mission-meta" ? meta : null,
        _meta: meta
      };
    };
    const makeTeaser = (id) => {
      const meta = { textContent: "", innerHTML: "" };
      return {
        teaser: id,
        disabled: true,
        title: "",
        dataset: {},
        classList: makeClassList(["planet-node", "teaser"]),
        getAttribute: (name) => name === "data-teaser" ? id : null,
        querySelector: (selector) => selector === ".mission-meta" ? meta : null,
        _meta: meta
      };
    };
    const nodes = [0, 1, 2].map(makeNode);
    const teasers = [makeTeaser("dark-matter"), makeTeaser("quantum-gate")];
    document.querySelectorAll = (selector) => {
      if (selector === ".planet-node[data-level]") return nodes;
      if (selector === ".planet-node.teaser[data-teaser]") return teasers;
      return [];
    };

    const game = new StarHopperGame();
    game.currentPlanetIndex = 0;
    game.planetClears = { 0: 2 };
    game.bestLabStars = { 0: 3, 1: 1 };
    game.masteryCleared = { 0: true };
    game.masteryMeters = { 0: { xp: 110, badges: ["scout", "engineer"], sources: {} } };
    game.villageTrust = { 0: { points: 7, badges: ["friend", "ally"], sources: { "village-trade:0:geary:engine_1": 3, "village-rescue:0:geary": 4 } } };
    game.codeConcepts = new Set(["ASSIGN"]);
    game.discoveryCombo = 2;
    game.discoveryPulse = { combo: 2, rewardXP: 5, title: "Fresh proof" };
    game.lastScienceDelta = {
      nextExperiment: {
        title: "Compare a lighter Hopper",
        body: "Lower mass, run, and compare jump height.",
        command: "hopper.mass = 0.8"
      }
    };
    game.refreshGalaxyMapProgress();

    assertEquals(false, nodes[0].disabled, "Cleared Earth node should be selectable");
    assertEquals(true, nodes[0].classList.contains("current"), "Current node should be marked current");
    assertEquals(true, nodes[0].classList.contains("mastered"), "Mastered node should get a map class");
    assertEquals(true, /Mastered/.test(nodes[0]._meta.innerHTML), "Mastered node should show mastered status");
    assertEquals(true, /Standard Gravity &amp; Trajectories/.test(nodes[0]._meta.innerHTML), "Cleared node should show its science concept chip");
    assertEquals(true, /3 of 3 Lab Stars/.test(nodes[0]._meta.innerHTML), "Cleared node should show best lab stars");
    assertEquals(true, /World Engineer/.test(nodes[0]._meta.innerHTML), "Cleared node should show world mastery tier");
    assertEquals(true, /110 XP/.test(nodes[0]._meta.innerHTML), "Cleared node should show world mastery XP");
    assertEquals(true, /Cave Ally/.test(nodes[0]._meta.innerHTML), "Cleared node should show village trust tier");
    assertEquals(true, /7 trust/.test(nodes[0]._meta.innerHTML), "Cleared node should show village trust points");
    assertEquals(true, nodes[0].classList.contains("map-code-next"), "Current map node should mark the next Code Concept action");
    assertEquals(true, /CODE NEXT/.test(nodes[0]._meta.innerHTML), "Current map node should show a Code Concept next chip");
    assertEquals(true, /Loop/.test(nodes[0]._meta.innerHTML), "Code Concept map chip should name the next coding idea");
    assertEquals(true, /repeat 3 \{ spawn_block\(\) \}/.test(nodes[0]._meta.innerHTML), "Code Concept map chip should show its runnable command");
    assertEquals(true, nodes[0].classList.contains("map-lab-next"), "Current map node should mark the next Lab Chain action");
    assertEquals(true, /LAB NEXT/.test(nodes[0]._meta.innerHTML), "Current map node should show a Lab Chain next chip");
    assertEquals(true, /2\/3 to TRIPLE TEST/.test(nodes[0]._meta.innerHTML), "Lab Chain map chip should show milestone progress");
    assertEquals(true, /hopper.mass = 0.8/.test(nodes[0]._meta.innerHTML), "Lab Chain map chip should show the next science command");
    assertEquals(true, nodes[0].classList.contains("map-hypothesis-next"), "Current map node should mark the next Hypothesis Proof action");
    assertEquals(true, /PREDICT NEXT/.test(nodes[0]._meta.innerHTML), "Current map node should show a Hypothesis Proof next chip");
    assertEquals(true, /Hopper Engineering Shakedown/.test(nodes[0]._meta.innerHTML), "Hypothesis map chip should name the next prediction mission");
    assertEquals(true, /0\/6 proofs/.test(nodes[0]._meta.innerHTML), "Hypothesis map chip should show proof progress");
    assertEquals(true, /Standard Gravity & Trajectories/.test(nodes[0].title), "Cleared node title should include the science concept");
    assertEquals(true, /Cave Ally \(7 trust\)/.test(nodes[0].title), "Cleared node title should include village trust progress");
    assertEquals(true, /Code next: Loop \(repeat 3 \{ spawn_block\(\) \}\)/.test(nodes[0].title), "Current node title should include the next Code Concept command");
    assertEquals(true, /Lab next: Compare a lighter Hopper \(hopper.mass = 0.8\)/.test(nodes[0].title), "Current node title should include the next Lab Chain command");
    assertEquals(true, /Hypothesis Proof: Predict Hopper Engineering Shakedown \(RUN PREDICT\)/.test(nodes[0].title), "Current node title should include the next Hypothesis Proof route");
    assertEquals(false, nodes[1].disabled, "Moon should unlock after Earth clear");
    assertEquals(false, nodes[1].classList.contains("map-code-next"), "Only the current node should show Code Concept next-state emphasis");
    assertEquals(false, nodes[1].classList.contains("map-lab-next"), "Only the current node should show Lab Chain next-state emphasis");
    assertEquals(true, /Unlocked/.test(nodes[1]._meta.innerHTML), "Next planet should read as unlocked");
    assertEquals(true, /Low Gravity &amp; Jump Loops/.test(nodes[1]._meta.innerHTML), "Unlocked next node should preview its science concept");
    assertEquals(true, /1 of 3 Lab Stars/.test(nodes[1]._meta.innerHTML), "Saved next-planet stars should render");
    assertEquals(true, nodes[2].disabled, "Jupiter should remain locked before Moon clear");
    assertEquals(true, /Locked/.test(nodes[2]._meta.innerHTML), "Locked node keeps locked copy");
    assertEquals(true, /High Gravity &amp; Rocket Force/.test(nodes[2]._meta.innerHTML), "Locked node should preview the upcoming science concept");
    assertEquals(true, /Recover previous shard/.test(nodes[2]._meta.innerHTML), "Locked node should explain how to unlock");
    assertEquals(true, /Next concept: High Gravity & Rocket Force/.test(nodes[2].title), "Locked node title should name the coming concept");
    assertEquals(true, /Transmission incoming/.test(teasers[0]._meta.innerHTML), "Future Dark Matter node should start as an incoming transmission");
    assertEquals(true, /0\/6 seeds/.test(teasers[0]._meta.innerHTML), "Future Dark Matter node should show unopened Future Lab seed progress");
    assertEquals(true, /Restore the star-map/.test(teasers[0]._meta.innerHTML), "Future Lab seed strip should name the first seed before the star-map is restored");
    assertEquals(false, teasers[0].classList.contains("anomaly-next"), "Future Dark Matter node should not pulse as the next anomaly before the star-map is restored");
    assertEquals(true, teasers[0].disabled, "Future Dark Matter node should stay disabled before the star-map is restored");
    assertEquals(false, teasers[0].classList.contains("future-action"), "Future Dark Matter node should not advertise a click action too early");

    const routedHypothesisStarts22g = [];
    const routedHypothesisModes22g = [];
    const originalHypothesisStartLevel22g = game.startLevel;
    game.startLevel = (level) => { routedHypothesisStarts22g.push(level); };
    switchMainMode = (mode) => { routedHypothesisModes22g.push(mode); };
    assertEquals(true, game.startMapPlanet(0), "Clicking the Hypothesis NEXT map world should use the Hypothesis Proof route");
    assertEquals(0, routedHypothesisStarts22g[0], "Hypothesis NEXT map route should launch the target proof world");
    assertEquals("earth-gravity-wall", game.activeHypothesisMissionId, "Hypothesis NEXT map route should remember the proof mission");
    assertEquals("terminal", routedHypothesisModes22g[0], "Hypothesis NEXT map route should return to the terminal");
    game.startLevel = originalHypothesisStartLevel22g;
    switchMainMode = oldSwitchMainMode22g;

    game.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    game.discoveryPassCounts = {};
    game.refreshGalaxyMapProgress();
    assertEquals(true, nodes[1].classList.contains("ai-state-next"), "Map should mark the world that advances the next AI State Deck proof");
    assertEquals(true, /AI NEXT/.test(nodes[1]._meta.innerHTML), "Next AI state target should render a compact map badge");
    assertEquals(true, /Shelter Loop/.test(nodes[1]._meta.innerHTML), "AI state badge should name the missing behavior card");
    assertEquals(true, /RUN RESCUE/.test(nodes[1]._meta.innerHTML), "AI state badge should mirror the Log action label");
    assertEquals(true, /AI State: Shelter Loop \(RUN RESCUE\)/.test(nodes[1].title), "Next AI state target should be available in the map tooltip");
    const routedStarts22g = [];
    const routedModes22g = [];
    const originalStartLevel22g = game.startLevel;
    const originalToggleSurvival22g = game.toggleSurvival;
    game.survivalMode = false;
    game.startLevel = (level) => routedStarts22g.push(level);
    game.toggleSurvival = () => { game.survivalMode = true; };
    switchMainMode = (mode) => routedModes22g.push(mode);
    assertEquals(true, game.startMapPlanet(1), "Clicking the AI NEXT map world should use the AI State Deck route");
    assertEquals(1, routedStarts22g[0], "AI NEXT map route should launch the target village world");
    assertEquals(true, game.survivalMode, "AI NEXT rescue route should enable Survival from the map");
    assertEquals("terminal", routedModes22g[0], "AI NEXT map route should return to the playable terminal");
    game.startLevel = originalStartLevel22g;
    game.toggleSurvival = originalToggleSurvival22g;
    game.survivalMode = false;
    switchMainMode = oldSwitchMainMode22g;

    game.currentPlanetIndex = 0;
    game.villageTrust = {
      0: {
        points: 12,
        badges: ["friend", "ally", "guardian"],
        sources: {
          "village-trade:0:geary:engine_1": 3,
          "village-rescue:0:geary": 4
        }
      }
    };
    game.masteryMeters = {
      0: {
        xp: 110,
        badges: ["scout", "engineer"],
        sources: {
          "pet:tame:0": 7,
          "pet:guard:0": 10
        }
      }
    };
    game.discoveryPassCounts = { "village-pact:0:guardian": 1 };
    game.refreshGalaxyMapProgress();
    assertEquals(false, nodes[0].classList.contains("ai-state-next"), "Completed AI deck should clear the next-target map class");
    assertEquals(true, nodes[0].classList.contains("ai-state-mastered"), "Current map node should show completed AI State Deck mastery");
    assertEquals(true, /AI MASTERED/.test(nodes[0]._meta.innerHTML), "Completed AI deck should render a compact map trophy");
    assertEquals(true, /5\/5 states/.test(nodes[0]._meta.innerHTML), "AI mastered trophy should show behavior card count");
    assertEquals(true, /AI State Deck mastered \(5\/5\)/.test(nodes[0].title), "Current node tooltip should include AI deck mastery");
    assertEquals(false, nodes[1].classList.contains("ai-state-mastered"), "AI deck mastery trophy should not duplicate onto other map nodes");
    game.confirmedHypotheses = new Set(getHypothesisPortfolioMissions().map(mission => mission.id));
    game.refreshGalaxyMapProgress();
    assertEquals(false, nodes[0].classList.contains("map-hypothesis-next"), "Completed Hypothesis Proofs should clear the next-target map class");
    assertEquals(true, nodes[0].classList.contains("map-hypothesis-mastered"), "Current map node should show completed Hypothesis Proof mastery");
    assertEquals(true, /HYPOTHESIS MASTERED/.test(nodes[0]._meta.innerHTML), "Completed Hypothesis Proofs should render a compact map trophy");
    assertEquals(true, /6\/6 proofs/.test(nodes[0]._meta.innerHTML), "Hypothesis mastered trophy should show proof count");
    assertEquals(true, /Hypothesis Proofs mastered \(6\/6\)/.test(nodes[0].title), "Current node tooltip should include Hypothesis Proof mastery");

    game.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    game.frontierRecords = {};
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[0].classList.contains("anomaly-next"), "Restored star-map should mark Dark Matter as the active anomaly");
    assertEquals(true, /ANOMALY/.test(teasers[0]._meta.innerHTML), "Active anomaly node should label the map hook");
    assertEquals(true, /Infer hidden forces/.test(teasers[0]._meta.innerHTML), "Active anomaly should preview the hidden-force concept");
    assertEquals(true, /Clear one Frontier Challenge/.test(teasers[0]._meta.innerHTML), "Active anomaly should name the retention action");
    assertEquals(true, /1\/6 seeds/.test(teasers[0]._meta.innerHTML), "Restored star-map should advance the Future Lab seed counter");
    assertEquals(true, /Decode Dark Matter Echo/.test(teasers[0]._meta.innerHTML), "Restored star-map should name the next Future Lab seed on the map");
    assertEquals(false, teasers[0].disabled, "Restored star-map should make the active Dark Matter teaser clickable");
    assertEquals(true, teasers[0].classList.contains("future-action"), "Restored star-map should mark Dark Matter as an actionable future seed");
    assertEquals(true, /CLICK: RUN FRONTIER/.test(teasers[0]._meta.innerHTML), "Actionable Dark Matter teaser should show the seed CTA");
    assertEquals(true, /Click to RUN FRONTIER/.test(teasers[0].title), "Actionable Dark Matter tooltip should explain the click action");
    assertEquals(true, /hidden-force anomaly detected/.test(teasers[0].title), "Active anomaly title should explain the next story step");
    assertEquals(true, teasers[1].classList.contains("anomaly-waiting"), "Quantum Gate should wait behind the Dark Matter Echo");
    assertEquals(true, /Decode Dark Matter Echo first/.test(teasers[1]._meta.innerHTML), "Quantum Gate teaser should explain its lock");
    assertEquals(true, /1\/6 seeds/.test(teasers[1]._meta.innerHTML), "Quantum Gate should mirror the shared Future Lab seed counter while locked");
    assertEquals(true, teasers[1].disabled, "Quantum Gate should stay disabled until its own prep seed is next");
    const futureFrontierStarts22g = [];
    const futureModes22g = [];
    const originalFutureStart22g = game.startFrontierChallenge;
    game.startFrontierChallenge = (opts) => { futureFrontierStarts22g.push(opts || null); return true; };
    switchMainMode = (mode) => futureModes22g.push(mode);
    assertEquals(true, game.startFutureWorldTeaser("dark-matter"), "Clicking active Dark Matter teaser should launch the current Future Lab seed");
    assertEquals(1, futureFrontierStarts22g.length, "Dark Matter teaser action should launch one Frontier proof");
    assertEquals("dark-matter-echo", futureFrontierStarts22g[0] && futureFrontierStarts22g[0].source, "Dark Matter Echo action should carry the echo Frontier tag");
    assertEquals("terminal", futureModes22g[0], "Dark Matter teaser action should return to the playable terminal");
    game.startFrontierChallenge = originalFutureStart22g;
    switchMainMode = oldSwitchMainMode22g;

    game.frontierRecords = {
      "2026-06-30": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-EARTH-1234",
        tier: 1,
        planetIndex: 0,
        stars: 2,
        bestTime: 42.2
      }
    };
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[0].classList.contains("anomaly-decoded"), "Frontier evidence should mark the Dark Matter echo decoded on the map");
    assertEquals(true, /ECHO DECODED/.test(teasers[0]._meta.innerHTML), "Decoded anomaly should show the new map state");
    assertEquals(true, /Trace hidden force/.test(teasers[0]._meta.innerHTML), "Decoded anomaly should point to the trace prototype");
    assertEquals(true, teasers[1].classList.contains("anomaly-waiting"), "Quantum Gate should wait for the hidden-force trace after Frontier evidence");
    assertEquals(true, /TRACE NEEDED/.test(teasers[1]._meta.innerHTML), "Quantum Gate should name the missing trace proof");

    game.discoveryPassCounts = { "anomaly-trace-proof:4:trace-hidden-force:test": 1 };
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[0].classList.contains("anomaly-decoded"), "Anomaly proof should keep Dark Matter decoded on the map");
    assertEquals(true, /SOURCE TRACED/.test(teasers[0]._meta.innerHTML), "Anomaly proof should advance Dark Matter to the traced state");
    assertEquals(true, /curve clues/.test(teasers[0]._meta.innerHTML), "Traced anomaly should preview the future hidden-force lab play");
    assertEquals(true, teasers[1].classList.contains("anomaly-decoded"), "Quantum Gate should show that the source trace advanced after the proof");
    assertEquals(true, /FORCE TRACED/.test(teasers[1]._meta.innerHTML), "Quantum Gate should switch from waiting to traced");
    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1
    };
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[1].classList.contains("anomaly-next"), "Dark Matter evidence should make Quantum Gate the active prep teaser");
    assertEquals(true, /QUANTUM PREP/.test(teasers[1]._meta.innerHTML), "Quantum Gate should label its prep state");
    assertEquals(true, /Test a branch condition/.test(teasers[1]._meta.innerHTML), "Quantum Gate prep should name the branch action");
    assertEquals(true, /4\/6 seeds/.test(teasers[1]._meta.innerHTML), "Dark Matter evidence should advance the Quantum Gate seed counter");
    assertEquals(true, /Seed a branch condition/.test(teasers[1]._meta.innerHTML), "Quantum Gate seed strip should name the branch proof");
    assertEquals(false, teasers[1].disabled, "Quantum Gate should become clickable when its branch seed is next");
    assertEquals(true, teasers[1].classList.contains("future-action"), "Quantum Gate should mark the branch seed as actionable");
    assertEquals(true, /CLICK: TEST BRANCH/.test(teasers[1]._meta.innerHTML), "Quantum Gate branch seed should show the click CTA");
    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1
    };
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[1].classList.contains("anomaly-next"), "Quantum branch proof should make Quantum Gate ask for the chance prep");
    assertEquals(true, /CHANCE PREP/.test(teasers[1]._meta.innerHTML), "Quantum Gate should label the chance prep state");
    assertEquals(true, /Test chance\(50\)/.test(teasers[1]._meta.innerHTML), "Quantum Gate chance prep should name the probability action");
    game.discoveryPassCounts = {
      "anomaly-trace-proof:4:trace-hidden-force:test": 1,
      "signal-lab-proof:frontier:frontier-earth-1234:t1:0:dark-matter-prep-curve-evidence:test": 1,
      "quantum-branch-proof:0:test-a-branch-condition:test": 1,
      "quantum-chance-proof:0:test-chance-branch:test": 1
    };
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[1].classList.contains("anomaly-decoded"), "Quantum chance proof should switch Quantum Gate to a logged seed state");
    assertEquals(true, /PROBABILITY SEED/.test(teasers[1]._meta.innerHTML), "Quantum Gate should label the logged probability seed");
    assertEquals(true, /chance paths/.test(teasers[1]._meta.innerHTML), "Quantum Gate seed should preview chance paths");
    assertEquals(true, /6\/6 seeds/.test(teasers[1]._meta.innerHTML), "Complete Quantum prep should show all Future Lab seeds banked");
    assertEquals(true, /Source key ready/.test(teasers[1]._meta.innerHTML), "Complete Future Lab seed strip should point to the source key");
    assertEquals(true, /CLICK: RUN SOURCE/.test(teasers[1]._meta.innerHTML), "Complete Quantum prep should make the source rehearsal clickable");
    document.querySelectorAll = oldQuerySelectorAll22g;
    switchMainMode = oldSwitchMainMode22g;
    renderTestResult("engine-suite", "Curriculum: galaxy map surfaces lab-star mastery", true);
  } catch (err) {
    document.querySelectorAll = oldQuerySelectorAll22g;
    switchMainMode = oldSwitchMainMode22g;
    renderTestResult("engine-suite", "Curriculum: galaxy map surfaces lab-star mastery", false, err.message);
  }

  // Test 22j: The in-run mission panel shows mentor, lab-star, and replay contracts.
  const oldGetElementById22h = document.getElementById;
  const oldCreateElement22h = document.createElement;
  const oldWindowGame22h = window.Game;
  const oldSwitchMainMode22h = switchMainMode;
  try {
    const makeEl = () => {
      let html = "";
      return {
        className: "",
        textContent: "",
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; this.children = []; },
        children: [],
        style: {},
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(event, handler) { this._events = this._events || {}; this._events[event] = handler; },
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
      };
    };
    const flattenText = (el) => [el.textContent || "", el.innerHTML || ""]
      .concat((el.children || []).map(flattenText))
      .join(" ");
    const findByClass = (el, className) => {
      if ((el.className || "").split(/\s+/).includes(className)) return el;
      for (const child of el.children || []) {
        const found = findByClass(child, className);
        if (found) return found;
      }
      return null;
    };
    const collectByClass = (el, className, out = []) => {
      if (!el) return out;
      if ((el.className || "").split(/\s+/).includes(className)) out.push(el);
      (el.children || []).forEach(child => collectByClass(child, className, out));
      return out;
    };
    let list = makeEl();
    document.getElementById = (id) => id === "mission-list" ? list : null;
    document.createElement = () => makeEl();

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 1;
    game.discoveryPassCounts = { "earth-gravity-wall": 1 };
    game.coachPredictions = {};
    game.confirmedHypotheses = new Set();
    game.activeHypothesisMissionId = "earth-gravity-wall";
    game.remixContext = 'first';
    game.bestClearTimes = { 0: 12.4 };
    game.masteryMeters = { 0: { xp: 80, badges: ["scout"], sources: { "science-proof": 24 } } };
    game.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    game.planetClears = { 0: 1, 1: 1 };
    game.discoveredFormulaKinds = new Set(["antigravity"]);
    const villageNpc22h = new NPC({
      id: "geary",
      name: "Machinist Geary",
      profession: "Machinist",
      type: "npc",
      x: 82,
      y: 60,
      homeX: 140,
      homeY: 60,
      caveX: 72,
      caveY: 60,
      color: "#4ade80",
      hiddenInCave: true,
      rescuePending: true,
      shelterReason: "nearby mob"
    });
    const villageMob22h = new Mob(148, 60, "hog", "#9a6b4f", 1);
    villageMob22h.speed = 0;
    villageMob22h.behaviorTimer = 999;
    game.interactiveObjects = [villageNpc22h];
    game.mobs = [villageMob22h];
    window.Game = game;
    game.lastStagedExperiment = {
      title: "Mass Lab",
      kind: "mass",
      source: "mentor-signal",
      command: "hopper.mass = 1.0",
      time: Date.now()
    };
    game.lastScienceDelta = {
      summary: "Agility changed",
      changes: [
        { label: "Mass", value: "2.5 -> 1.2 (-1.3)", direction: "down", cue: "Less mass makes the same force accelerate more." },
        { label: "Probability", value: "1/1 passed (100%)", direction: "up", cue: "Target chance 100%. More trials reveal the pattern." }
      ],
      nextExperiment: {
        title: "Agility 30+ reached",
        body: "Lower mass or raise engine, then test the wall.",
        command: "use_hopper()\nhopper.mass = 1.2\nhopper.engine = 6"
      }
    };

    updateMissionList(game);
    const lens = findByClass(list, "lesson-lens-card");
    const lensText = flattenText(lens || list);
    const scienceDelta = findByClass(list, "science-delta-card");
    const scienceDeltaText = flattenText(scienceDelta || list);
    const labQuestion = findByClass(list, "mission-lab-question-card");
    const labQuestionText = flattenText(labQuestion || list);
    const hypothesisProof = findByClass(list, "hypothesis-proof-crt-card");
    const hypothesisProofText = flattenText(hypothesisProof || list);
    const worldMastery = findByClass(list, "world-mastery-crt-card");
    const worldMasteryText = flattenText(worldMastery || list);
    const villageTrust = findByClass(list, "village-trust-crt-card");
    const villageTrustText = flattenText(villageTrust || list);
    const villageChain = findByClass(list, "village-chain-crt-card");
    const villageChainText = flattenText(villageChain || list);
    const villageState = findByClass(list, "village-state-crt-card");
    const villageStateText = flattenText(villageState || list);
    const signalStory = findByClass(list, "signal-story-crt-card");
    const signalStoryText = flattenText(signalStory || list);
    const mentor = findByClass(list, "mentor-signal-card");
    const mentorText = flattenText(mentor || list);
    const staged = findByClass(list, "staged-experiment-card");
    const stagedText = flattenText(staged || list);
    const runQueue = findByClass(list, "run-objective-queue-card");
    const runQueueText = flattenText(runQueue || list);
    const contract = findByClass(list, "lab-star-contract");
    const replayBeforeProgress = findByClass(list, "run-replay-contract");
    const text = flattenText(contract || list);
    assertEquals(true, !!runQueue, "Mission panel should pin a compact in-run objective queue");
    assertEquals(true, /RUN OBJECTIVE QUEUE/.test(runQueueText), "In-run objective queue should identify itself");
    assertEquals(true, /#1 READY TO TEST/.test(runQueueText), "In-run objective queue should rank staged code first");
    assertEquals(true, /Mass Lab/.test(runQueueText), "In-run objective queue should name the ready staged experiment");
    assertEquals(true, /#2 PREDICT/.test(runQueueText), "In-run objective queue should include the prediction gate before code");
    assertEquals(true, /Choose a hypothesis first/.test(runQueueText), "Prediction queue item should explain why it has no stage button");
    assertEquals(true, /#3 LESSON PATH/.test(runQueueText), "In-run objective queue should include the active lesson phase");
    assertEquals(true, /STAGE LESSON/.test(runQueueText), "Lesson queue item should expose a stage action");
    assertEquals(true, !!lens, "Mission panel should pin the active lesson lens");
    assertEquals(true, /LESSON LENS/.test(lensText), "Lesson lens should identify itself");
    assertEquals(true, /Variable assignment and parameter tuning/.test(lensText), "Lesson lens should show the coding concept");
    assertEquals(true, /Change one number/.test(lensText), "Lesson lens should show the beginner concept");
    assertEquals(true, /Activate Hopper/.test(lensText), "Lesson lens should show the scaffold code idea");
    const blockedLensButton = findByClass(lens || list, "lesson-lens-stage-btn");
    assertEquals(true, !!blockedLensButton, "Lesson lens should render a stage action");
    assertEquals("PREDICT FIRST", blockedLensButton.textContent, "Lesson lens should preserve the prediction-first flow");
    assertEquals(true, !!blockedLensButton.disabled, "Lesson lens staging should stay disabled until a prediction is chosen");
    assertEquals(true, !!labQuestion, "Mission panel should pin the active lab question");
    assertEquals(true, /PREDICT/.test(labQuestionText), "Lab question should ask for prediction before code");
    assertEquals(true, /Which change will help Hopper/.test(labQuestionText), "Lab question should reuse the mission prediction");
    const blockedQuestionButton = findByClass(labQuestion || list, "mission-lab-question-stage-btn");
    assertEquals("STAGE AFTER PREDICT", blockedQuestionButton && blockedQuestionButton.textContent, "Prediction card should explain why staging waits");
    assertEquals(true, !!blockedQuestionButton.disabled, "Prediction card staging stays disabled until the kid predicts");
    assertEquals(true, !!hypothesisProof, "Mission panel should show the active Hypothesis Proof route");
    assertEquals(true, /HYPOTHESIS PROOF RUN/.test(hypothesisProofText), "Hypothesis proof card should identify itself");
    assertEquals(true, /0\/6 proofs/.test(hypothesisProofText), "Hypothesis proof card should show collection progress");
    assertEquals(true, /Hopper Engineering Shakedown · PREDICT FIRST/.test(hypothesisProofText), "Hypothesis proof card should preserve prediction-first state");
    assertEquals(true, /Which change will help Hopper reach the high Emerald gems/.test(hypothesisProofText), "Hypothesis proof card should show the mission prediction question");
    assertEquals(true, /Pick the Mission Coach guess before touching the code/.test(hypothesisProofText), "Hypothesis proof card should explain the prediction gate");
    assertEquals(null, findByClass(hypothesisProof || list, "hypothesis-proof-stage-btn"), "Hypothesis proof card should not stage code before a prediction");
    assertEquals(true, !!worldMastery, "Mission panel should show the world mastery meter");
    assertEquals(true, /WORLD MASTERY/.test(worldMasteryText), "World mastery card should identify itself");
    assertEquals(true, /Signal Scout · 80 XP/.test(worldMasteryText), "World mastery card should show current tier and XP");
    assertEquals(true, /30 XP to World Engineer/.test(worldMasteryText), "World mastery card should show the next tier gap");
    assertEquals(true, /tasks, samples, science proof, rescues, and remixes/.test(worldMasteryText), "World mastery card should explain educational sources");
    assertEquals(true, !!villageTrust, "Mission panel should show the village trust target");
    assertEquals(true, /VILLAGE TRUST/.test(villageTrustText), "Village trust card should identify itself");
    assertEquals(true, /Trading Friend · 3/.test(villageTrustText), "Village trust card should show current tier and points");
    assertEquals(true, /4 trust to Cave Ally/.test(villageTrustText), "Village trust card should show the next relationship tier gap");
    assertEquals(true, /Cave Rescue Pact/.test(villageTrustText), "Village trust card should name the next relationship pact");
    assertEquals(true, /State machine: danger -&gt; cave -&gt; safe/.test(villageTrustText), "Village trust card should frame helpful play as a game-AI lesson");
    assertEquals(true, !!villageChain, "Mission panel should show the village quest chain");
    assertEquals(true, /VILLAGE QUEST CHAIN/.test(villageChainText), "Village quest chain should identify itself");
    assertEquals(true, /1\/3/.test(villageChainText), "Village quest chain should count completed pacts");
    assertEquals(true, /Next: Rescue pact/.test(villageChainText), "Village quest chain should name the next village story step");
    assertEquals(true, /danger -&gt; cave -&gt; safe/.test(villageChainText), "Village quest chain should teach the next AI-state formula");
    assertEquals(true, /Trade/.test(villageChainText) && /Resource flow/.test(villageChainText), "Village quest chain should remember completed trade proof");
    assertEquals(true, !!villageState, "Mission panel should show the live village state monitor");
    assertEquals(true, /VILLAGE STATE/.test(villageStateText), "Village state card should identify itself");
    assertEquals(true, /DANGER/.test(villageStateText), "Village state card should show mob danger");
    assertEquals(true, /mob\.close -&gt; cave/.test(villageStateText), "Village state card should name the mob-to-cave transition");
    assertEquals(true, /state \+ event -&gt; next state/.test(villageStateText), "Village state card should teach the state-machine formula");
    assertEquals(true, /Clear mobs/.test(villageStateText), "Village state card should give the actionable rescue condition");
    assertEquals(true, !!signalStory, "Mission panel should show the active Signal Story contract");
    assertEquals(true, /STAR-MAP SIGNAL/.test(signalStoryText), "Signal Story card should identify itself");
    assertEquals(true, /2\/12 decoded/.test(signalStoryText), "Signal Story card should show decoded progress");
    assertEquals(true, /Amber Gravity Well/.test(signalStoryText), "Signal Story card should name the next chapter");
    assertEquals(true, /Thrust must beat gravity/.test(signalStoryText), "Signal Story card should show the science concept");
    assertEquals(true, /Clear Jupiter \(Gas Giant Core\)/.test(signalStoryText), "Signal Story card should show the next story action");
    assertEquals(true, /Reward: Amber Gravity Well/.test(signalStoryText), "Signal Story card should show the story payoff");
    assertEquals(true, !!mentor, "Mission panel should pin the active mentor signal");
    assertEquals(true, /MENTOR SIGNAL/.test(mentorText), "Mentor signal should identify itself");
    assertEquals(true, /Machinist Geary/.test(mentorText), "Mentor signal should name the science villager");
    assertEquals(true, /Mass Lab/.test(mentorText), "Mentor signal should follow the next locked formula card");
    assertEquals(true, /Payoff: Open lighter-build routes/.test(mentorText), "Mentor signal should show the formula payoff");
    assertEquals(true, /hopper\.mass = 1\.0/.test(mentorText), "Mentor signal should show the runnable focus command");
    const mentorStageButton = findByClass(mentor || list, "mentor-signal-stage-btn");
    assertEquals(true, !!mentorStageButton, "Mentor signal should expose a stage-focus action");
    assertEquals("STAGE FOCUS", mentorStageButton.textContent, "Mentor signal stage action should be terse");
    assertEquals(true, !!staged, "Mission panel should show a staged experiment reminder");
    assertEquals(true, /READY TO TEST/.test(stagedText), "Staged experiment card should identify the ready state");
    assertEquals(true, /Village mentor/.test(stagedText), "Staged experiment card should name the source surface");
    assertEquals(true, /Mass Lab/.test(stagedText), "Staged experiment card should name the target experiment");
    assertEquals(true, /Press Enter/.test(stagedText), "Staged experiment card should tell the kid how to run it");
    assertEquals(true, /hopper\.mass = 1\.0/.test(stagedText), "Staged experiment card should preserve the staged command");
    const stagedRestageButton = findByClass(staged || list, "staged-experiment-stage-btn");
    assertEquals("RESTAGE", stagedRestageButton && stagedRestageButton.textContent, "Staged experiment card should expose a restage action");

    const aiRunGame = new StarHopperGame();
    aiRunGame.currentPlanet = PLANETS[1];
    aiRunGame.currentPlanetIndex = 1;
    aiRunGame.player = new Player(0, 0);
    aiRunGame.completedMissions = new Set();
    aiRunGame.requiredCollectiblesTotal = 0;
    aiRunGame.requiredCollectiblesCollected = 0;
    aiRunGame.discoveryPassCounts = {};
    aiRunGame.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    aiRunGame.activeAIStateRun = { cardId: "shelter-loop", levelIndex: 1, label: "RUN RESCUE" };
    list = makeEl();
    updateMissionList(aiRunGame);
    const aiRunCard = findByClass(list, "ai-state-run-crt-card");
    const aiRunText = flattenText(aiRunCard || list);
    assertEquals(true, !!aiRunCard, "Mission panel should show the active AI State Deck proof route");
    assertEquals(true, /AI PROOF RUN/.test(aiRunText), "AI proof card should identify itself");
    assertEquals(true, /Shelter Loop · RUN RESCUE/.test(aiRunText), "AI proof card should name the active state and action");
    assertEquals(true, /state = patrol -&gt; cave -&gt; trade/.test(aiRunText), "AI proof card should show the state formula");
    assertEquals(true, /Let danger trigger cave shelter/.test(aiRunText), "AI proof card should preserve the route instruction");
    assertEquals(true, /State machine proof · 4 states left/.test(aiRunText), "AI proof card should show collection pressure");
    aiRunGame.villageTrust = {
      0: {
        points: 7,
        badges: ["friend", "ally"],
        sources: { "village-trade:0:geary:engine_1": 3, "village-rescue:0:geary": 4 }
      }
    };
    list = makeEl();
    updateMissionList(aiRunGame);
    assertEquals(null, findByClass(list, "ai-state-run-crt-card"), "AI proof card should hide once that proof is logged");
    assertEquals(null, aiRunGame.activeAIStateRun, "Completed active AI proof should clear stale route state");

    aiRunGame.lastAIStateRunProof = {
      label: "AI PROOF LOGGED",
      title: "Shelter Loop",
      state: "patrol -> cave -> trade",
      concept: "State machine",
      progress: "2/5",
      nextCardId: "pet-pact",
      nextTitle: "Pet Pact",
      nextState: "wild -> scared -> pet",
      nextActionLabel: "GET LOTION",
      nextActionBody: "Run Glacies, collect Violet Ice, and trade with Cryo for calming lotion.",
      levelIndex: 1
    };
    aiRunGame.unlockedTools = new Set(["taming_lotion"]);
    list = makeEl();
    updateMissionList(aiRunGame);
    const aiLoggedCard = findByClass(list, "ai-state-run-crt-card");
    const aiLoggedText = flattenText(aiLoggedCard || list);
    assertEquals(true, !!aiLoggedCard, "Mission panel should show the last completed AI proof route");
    assertEquals(true, /logged/.test(aiLoggedCard.className), "Completed AI proof card should use the logged CRT state");
    assertEquals(true, /AI STATE LOGGED/.test(aiLoggedText), "Completed AI proof card should identify itself");
    assertEquals(true, /Shelter Loop -> Pet Pact/.test(aiLoggedText), "Completed AI proof card should point to the next state card");
    assertEquals(true, /next state = wild -&gt; scared -&gt; pet/.test(aiLoggedText), "Completed AI proof card should show the next state formula");
    assertEquals(true, /TAME PET/.test(aiLoggedText), "Completed AI proof card should refresh the next deck action from live progress");
    assertEquals(true, /Start Survival/.test(aiLoggedText), "Completed AI proof card should refresh the next route body");
    const aiLoggedButton = findByClass(aiLoggedCard || list, "ai-state-run-crt-action-btn");
    assertEquals("TAME PET", aiLoggedButton && aiLoggedButton.textContent, "Completed AI proof card should expose the live next route action");
    const aiRouteStarts = [];
    const aiRouteModes = [];
    aiRunGame.startLevel = (level) => { aiRouteStarts.push(level); aiRunGame.currentPlanetIndex = level; };
    aiRunGame.toggleSurvival = () => { aiRunGame.survivalMode = true; };
    switchMainMode = (mode) => aiRouteModes.push(mode);
    aiLoggedButton._events.click();
    assertEquals(3, aiRouteStarts[0], "Logged AI proof action should launch the next proof world");
    assertEquals(true, aiRunGame.survivalMode, "Logged AI proof action should enable Survival when the next proof needs mobs");
    assertEquals("pet-pact", aiRunGame.activeAIStateRun && aiRunGame.activeAIStateRun.cardId, "Logged AI proof action should restore an active route for the next state card");
    assertEquals("terminal", aiRouteModes[0], "Logged AI proof action should return to the playable terminal");
    aiRunGame.currentPlanetIndex = 2;
    aiRunGame.activeAIStateRun = null;
    list = makeEl();
    updateMissionList(aiRunGame);
    assertEquals(null, findByClass(list, "ai-state-run-crt-card"), "Completed AI proof card should not persist onto other worlds");
    aiRunGame.currentPlanetIndex = 1;

    list = makeEl();
    game.mobs = [];
    villageNpc22h.hiddenInCave = true;
    villageNpc22h.rescuePending = true;
    villageNpc22h.shelterReason = "nearby mob";
    game.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    updateMissionList(game);
    const nightVillageState = findByClass(list, "village-state-crt-card");
    const nightVillageStateText = flattenText(nightVillageState || list);
    assertEquals(true, /NIGHT/.test(nightVillageStateText), "Village state card should let current night shelter override stale rescue danger");
    assertEquals(false, /DANGER/.test(nightVillageStateText), "Village state card should not show cleared mob danger during night shelter");
    assertEquals(true, /night -&gt; cave/.test(nightVillageStateText), "Village state card should name the night-to-cave transition");
    assertEquals(true, /daylight/.test(nightVillageStateText), "Night state should explain when villagers return");
    game.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });

    villageNpc22h.trades = [
      { id: "engine_1", cost: { type: "emerald", amount: 1 }, desc: "Reinforce Engine", reward: { type: "cap", key: "engine", amount: 3 } },
      { id: "pricey", cost: { type: "emerald", amount: 4 }, desc: "Overclock Engine", reward: { type: "cap", key: "engine", amount: 5 } }
    ];
    game.gemsWallet = { emerald: 1, quartz: 0, amber: 0, ice: 0, flux: 0 };
    game.purchasedTrades = new Set();
    villageNpc22h.hiddenInCave = false;
    villageNpc22h.rescuePending = false;
    villageNpc22h.shelterReason = null;
    villageNpc22h.x = villageNpc22h.homeX;
    villageNpc22h.y = villageNpc22h.homeY;
    list = makeEl();
    updateMissionList(game);
    const villageRequest = findByClass(list, "village-request-crt-card");
    const villageRequestText = flattenText(villageRequest || list);
    assertEquals(true, !!villageRequest, "Mission panel should show the current village trade request");
    assertEquals(true, /VILLAGE REQUEST/.test(villageRequestText), "Village request card should identify itself");
    assertEquals(true, /READY TRADE/.test(villageRequestText), "Village request card should prioritize ready trades");
    assertEquals(true, /Machinist Geary: Reinforce Engine/.test(villageRequestText), "Village request card should name the villager and payoff");
    assertEquals(true, /sample -&gt; trade -&gt; tool/.test(villageRequestText), "Village request card should teach the resource-flow formula");
    assertEquals(true, /Payoff: ENGINE \+3 upgrade/.test(villageRequestText), "Village request card should show the concrete reward");
    villageNpc22h.hiddenInCave = true;
    villageNpc22h.shelterReason = "nearby mob";
    list = makeEl();
    updateMissionList(game);
    assertEquals(null, findByClass(list, "village-request-crt-card"), "Mission panel should hide trade requests while the villager is sheltered");
    villageNpc22h.hiddenInCave = false;
    villageNpc22h.shelterReason = null;
    game.villageTrust = {
      0: {
        points: 12,
        badges: ["friend", "ally", "guardian"],
        sources: {
          "village-trade:0:geary:engine_1": 3,
          "village-rescue:0:geary": 4,
          "pet:guard:0": 3
        }
      }
    };
    game.discoveryPassCounts["village-pact:0:guardian"] = 1;
    list = makeEl();
    updateMissionList(game);
    const completeVillageChain = findByClass(list, "village-chain-crt-card");
    const completeVillageChainText = flattenText(completeVillageChain || list);
    assertEquals(true, /3\/3/.test(completeVillageChainText), "Village quest chain should show a complete arc");
    assertEquals(true, /Guardian village complete/.test(completeVillageChainText), "Complete chain should name the village arc payoff");
    assertEquals(true, /trade \+ rescue \+ guard/.test(completeVillageChainText), "Complete chain should summarize the three-system loop");

    list = makeEl();
    game.lastStagedExperiment = null;
    game.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    game.getMissionStat = () => ({ key: "agility", label: "Agility", value: 12, target: 30 });
    updateMissionList(game);
    const activeLens = findByClass(list, "lesson-lens-card");
    const activeLensButton = findByClass(activeLens || list, "lesson-lens-stage-btn");
    const activeLabQuestion = findByClass(list, "mission-lab-question-card");
    const activeLabQuestionText = flattenText(activeLabQuestion || list);
    const activeLabQuestionButton = findByClass(activeLabQuestion || list, "mission-lab-question-stage-btn");
    const activeHypothesisProof = findByClass(list, "hypothesis-proof-crt-card");
    const activeHypothesisProofText = flattenText(activeHypothesisProof || list);
    const activeHypothesisProofButton = findByClass(activeHypothesisProof || list, "hypothesis-proof-stage-btn");
    const activeRunQueue = findByClass(list, "run-objective-queue-card");
    const activeRunQueueText = flattenText(activeRunQueue || list);
    const activeCheckpoint = findByClass(list, "science-checkpoint-target-card");
    const activeCheckpointText = flattenText(activeCheckpoint || list);
    assertEquals("STAGE LESSON CODE", activeLensButton && activeLensButton.textContent, "Lesson lens should stage code after prediction");
    assertEquals(false, !!activeLensButton.disabled, "Lesson lens staging should enable after prediction");
    assertEquals(true, /NEXT TEST/.test(activeLabQuestionText), "After prediction, lab question should move to the next test");
    assertEquals(true, /Hopper activated|Agility 30\+ reached/.test(activeLabQuestionText), "Next test should name a live mission check");
    assertEquals("STAGE TEST", activeLabQuestionButton && activeLabQuestionButton.textContent, "Next-test card should stage its code");
    assertEquals(false, !!activeLabQuestionButton.disabled, "Next-test staging should be enabled");
    assertEquals(true, !!activeHypothesisProof, "Mission panel should keep the active Hypothesis Proof route after prediction");
    assertEquals(true, /Hopper Engineering Shakedown · RUN PROOF/.test(activeHypothesisProofText), "Hypothesis proof card should switch to proof-running state after prediction");
    assertEquals(true, /prediction = More antigravity and lighter Hopper/.test(activeHypothesisProofText), "Hypothesis proof card should show the selected hypothesis");
    assertEquals(true, /One new result can confirm this proof/.test(activeHypothesisProofText), "Hypothesis proof card should explain the proof payoff");
    assertEquals(true, /STAGE PROOF/.test(activeHypothesisProofText), "Hypothesis proof card should expose the proof-stage action");
    assertEquals(true, !!activeHypothesisProofButton, "Hypothesis proof card should render a stage button once a prediction exists");
    assertEquals(true, /use_hopper\(\)/.test(activeHypothesisProofText), "Hypothesis proof card should show the focused proof command");
    assertEquals(true, /#1 NEXT TEST/.test(activeRunQueueText), "In-run objective queue should switch from prediction gate to next-test action after predicting");
    assertEquals(true, /STAGE TEST/.test(activeRunQueueText), "In-run objective queue should expose the next-test stage action");
    assertEquals(true, /NEXT CHECKPOINT/.test(activeRunQueueText), "In-run objective queue should surface the next science checkpoint as a chase target");
    assertEquals(true, /Agility 12\/30 · Need \+3\.0 to 50% TARGET/.test(activeRunQueueText), "In-run objective queue should show the checkpoint stat gap");
    assertEquals(true, /STAGE CHECKPOINT/.test(activeRunQueueText), "In-run objective queue should expose the checkpoint stage action");
    assertEquals(true, !!activeCheckpoint, "Mission panel should preview the next science checkpoint");
    assertEquals(true, /NEXT CHECKPOINT/.test(activeCheckpointText), "Science checkpoint card should identify the next target");
    assertEquals(true, /\+3 XP proof/.test(activeCheckpointText), "Science checkpoint card should show the checkpoint reward");
    assertEquals(true, /Agility 12\/30/.test(activeCheckpointText), "Science checkpoint card should show the live target stat");
    assertEquals(true, /Need \+3\.0 to 50% TARGET/.test(activeCheckpointText), "Science checkpoint card should show the gap to the next checkpoint");
    assertEquals(true, /STAGE CHECKPOINT/.test(activeCheckpointText), "Science checkpoint card should expose a stage action");
    const inputEl22j = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => id === "console-input" ? inputEl22j : (id === "mission-list" ? list : null);
    const queueButtons = collectByClass(activeRunQueue, "run-objective-queue-action-btn");
    assertEquals(true, queueButtons.length >= 2, "In-run objective queue should expose stage buttons for actionable items");
    const queueCheckpointButton = queueButtons.find(button => button && button.textContent === "STAGE CHECKPOINT");
    assertEquals(true, !!queueCheckpointButton, "In-run objective queue should expose a dedicated checkpoint stage button");
    queueButtons[0]._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "In-run queue next-test action should stage the focused lab question command");
    assertEquals("mission-lab-question", game.lastStagedExperiment && game.lastStagedExperiment.source, "In-run queue next-test action should preserve lab-question source");
    assertEquals(true, inputEl22j.focused, "In-run queue next-test action should focus the terminal");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    queueCheckpointButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "In-run queue checkpoint action should stage the target experiment");
    assertEquals(true, inputEl22j.focused, "In-run queue checkpoint action should focus the terminal");
    assertEquals("science-checkpoint", game.lastStagedExperiment && game.lastStagedExperiment.source, "In-run queue checkpoint action should preserve checkpoint source metadata");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeLensButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Lesson lens stage action should include mission setup code");
    assertEquals(true, /antigravity = 4\.9/.test(inputEl22j.value), "Lesson lens stage action should include the first one-variable tweak");
    assertEquals(false, /hopper\.mass/.test(inputEl22j.value), "Lesson lens should hide mass until the antigravity proof passes");
    assertEquals(true, inputEl22j.focused, "Lesson lens stage action should focus the terminal");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeLabQuestionButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Lab question stage action should include setup code");
    assertEquals(false, /hopper\.mass/.test(inputEl22j.value), "Lab question should stage the focused setup fix for the active failed check");
    assertEquals(true, inputEl22j.focused, "Lab question stage action should focus the terminal");
    assertEquals("mission-lab-question", game.lastStagedExperiment && game.lastStagedExperiment.source, "Lab question staging should remember its source");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeHypothesisProofButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Hypothesis proof action should stage the focused proof command");
    assertEquals(true, inputEl22j.focused, "Hypothesis proof action should focus the terminal");
    assertEquals("hypothesis-proof", game.lastStagedExperiment && game.lastStagedExperiment.source, "Hypothesis proof staging should remember its source");
    assertEquals("More antigravity and lighter Hopper", game.lastStagedExperiment && game.lastStagedExperiment.prediction, "Hypothesis proof staging should preserve the selected prediction");
    const activeCheckpointButton = findByClass(activeCheckpoint || list, "science-checkpoint-target-stage-btn");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeCheckpointButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Science checkpoint card should stage the next target experiment");
    assertEquals(true, inputEl22j.focused, "Science checkpoint card should focus the terminal");
    assertEquals("science-checkpoint", game.lastStagedExperiment && game.lastStagedExperiment.source, "Science checkpoint staging should remember its source");
    const activeMentor = findByClass(list, "mentor-signal-card");
    const activeMentorButton = findByClass(activeMentor || list, "mentor-signal-stage-btn");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeMentorButton._events.click();
    assertEquals("hopper.mass = 1.0", inputEl22j.value, "Mentor stage action should stage the one-variable formula command");
    assertEquals(true, inputEl22j.focused, "Mentor stage action should focus the terminal");
    const activeStaged = findByClass(list, "staged-experiment-card");
    const activeRestage = findByClass(activeStaged || list, "staged-experiment-stage-btn");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeRestage._events.click();
    assertEquals("hopper.mass = 1.0", inputEl22j.value, "Staged reminder restage should restore the staged command");
    assertEquals(true, inputEl22j.focused, "Staged reminder restage should focus the terminal");
    game.lastStagedExperiment = {
      title: "Lower mass repair",
      kind: "failure-diagnosis",
      source: "failure-lab",
      prediction: "higher",
      command: "hopper.mass = 1.0",
      time: Date.now()
    };
    updateMissionList(game);
    const repairStaged = findByClass(list, "staged-experiment-card");
    const repairStagedText = flattenText(repairStaged || list);
    assertEquals(true, /REPAIR PROOF READY/.test(repairStagedText), "Failure-lab staged repair should identify itself as a proof");
    assertEquals(true, /Crash Lab/.test(repairStagedText), "Failure-lab staged repair should preserve the crash source");
    assertEquals(true, /predict: higher/i.test(repairStagedText), "Failure-lab staged repair should show the carried prediction");
    assertEquals(true, /test this repair/.test(repairStagedText), "Failure-lab staged repair should explain the retry experiment");
    const repairRestage = findByClass(repairStaged || list, "staged-experiment-stage-btn");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    repairRestage._events.click();
    assertEquals("hopper.mass = 1.0", inputEl22j.value, "Failure-lab restage should restore the repair command");
    assertEquals("failure-lab", game.lastStagedExperiment && game.lastStagedExperiment.source, "Failure-lab restage should preserve its source");
    assertEquals("higher", game.lastStagedExperiment && game.lastStagedExperiment.prediction, "Failure-lab restage should preserve prediction metadata");

    const signalFocus = buildReplayLabContract(PLANETS[3], 3, {
      targetOverrides: {},
      constraint: { id: "glacies-friction-target", minFriction: 8 }
    });
    list = makeEl();
    game.remixContext = 'daily';
    game.dailyInfo = {
      dateStr: "2026-06-30",
      shareCode: "GLACIES-4242",
      concept: signalFocus.concept,
      labContract: signalFocus
    };
    inputEl22j.value = "";
    inputEl22j.focused = false;
    updateMissionList(game);
    const signalLab = findByClass(list, "signal-lab-contract-card");
    const signalLabText = flattenText(signalLab || list);
    const signalRunQueue = findByClass(list, "run-objective-queue-card");
    const signalRunQueueText = flattenText(signalRunQueue || list);
    assertEquals(true, /DAILY SIGNAL/.test(signalRunQueueText), "In-run objective queue should include Daily Signal contracts");
    assertEquals(true, /STAGE SIGNAL/.test(signalRunQueueText), "In-run objective queue should expose the signal stage action");
    assertEquals(true, !!signalLab, "Daily/Frontier runs should pin the signal lab contract in the mission panel");
    assertEquals(true, /DAILY SIGNAL LAB/.test(signalLabText), "Signal lab card should identify Daily Signal runs");
    assertEquals(true, /Numeric friction target/.test(signalLabText), "Signal lab card should show the replay focus title");
    assertEquals(true, /friction = 8/.test(signalLabText), "Signal lab card should show the sample command");
    assertEquals(true, /Standard Gravity|Friction/.test(signalLabText), "Signal lab card should show the science concept");
    assertEquals(null, findByClass(list, "frontier-rival-crt-card"), "Daily Signal runs should not show Frontier rival targets");
    const signalStageButton = findByClass(signalLab || list, "signal-lab-contract-stage-btn");
    assertEquals("STAGE SIGNAL", signalStageButton && signalStageButton.textContent, "Signal lab card should expose a stage action");
    signalStageButton._events.click();
    assertEquals("friction = 8", inputEl22j.value, "Signal lab stage action should stage the replay contract command");
    assertEquals(true, inputEl22j.focused, "Signal lab stage action should focus the terminal");
    assertEquals("signal-lab-contract", game.lastStagedExperiment && game.lastStagedExperiment.source, "Signal lab staging should remember its source");

    list = makeEl();
    updateMissionList(game);
    const signalStaged = findByClass(list, "staged-experiment-card");
    const signalStagedText = flattenText(signalStaged || list);
    assertEquals(true, /Signal Lab/.test(signalStagedText), "Signal lab staged command should name its source in the reminder");
    assertEquals(true, /bank proof/.test(signalStagedText), "Signal lab staged reminder should name the proof payoff");

    const proofStatus = getSignalLabProofStatus(game, signalFocus.command);
    assertEquals(true, !!proofStatus, "Signal lab proof status should expose a durable source key");
    game.discoveryPassCounts[proofStatus.sourceKey] = 1;
    let explainCalls = 0;
    let explainOptions = null;
    game.runClearExplainPrompt = (opts) => { explainCalls++; explainOptions = opts || null; return true; };
    list = makeEl();
    updateMissionList(game);
    const claimedSignalLab = findByClass(list, "signal-lab-contract-card");
    const claimedSignalText = flattenText(claimedSignalLab || list);
    assertEquals(true, /PROOF LOGGED/.test(claimedSignalText), "Claimed Signal Lab card should show the proof is saved");
    assertEquals(true, /Science Notebook/.test(claimedSignalText), "Claimed Signal Lab card should point to explaining evidence");
    assertEquals(true, /TESTED - proof saved/.test(claimedSignalText), "Claimed Signal Lab card should show a tested badge");
    assertEquals(null, findByClass(claimedSignalLab || list, "signal-lab-contract-stage-btn"), "Claimed Signal Lab card should not expose the repeat stage action");
    const explainSignalButton = findByClass(claimedSignalLab || list, "signal-lab-contract-explain-btn");
    assertEquals("EXPLAIN EVIDENCE", explainSignalButton && explainSignalButton.textContent, "Claimed Signal Lab card should expose the explain action");
    explainSignalButton._events.click();
    assertEquals(1, explainCalls, "Signal Lab explain action should reuse the Science Notebook explain flow");
    assertEquals(true, !!(explainOptions && explainOptions.preserveReflectionContext), "Signal Lab explain action should preserve its reflection context");
    assertEquals("signal-lab", game.reflectionContext && game.reflectionContext.kind, "Signal Lab explain action should set notebook reflection context");
    assertEquals("Numeric friction target", game.reflectionContext && game.reflectionContext.title, "Signal Lab reflection context should preserve the replay focus");
    assertEquals("friction = 8", game.reflectionContext && game.reflectionContext.command, "Signal Lab reflection context should preserve the tested command");
    const darkMatterReflection = setSignalLabReflectionContext(game, {
      ...proofStatus,
      signal: { darkMatterPrep: true },
      isFrontier: true
    });
    assertEquals("Dark Matter Prep", darkMatterReflection && darkMatterReflection.source, "Dark Matter prep explains as its own notebook source");
    assertEquals("DARK MATTER EVIDENCE", darkMatterReflection && darkMatterReflection.proofLabel, "Dark Matter prep explanation preserves the stronger proof label");
    const echoReflection = setSignalLabReflectionContext(game, {
      ...proofStatus,
      signal: { darkMatterEcho: true },
      isFrontier: true
    });
    assertEquals("Dark Matter Echo", echoReflection && echoReflection.source, "Dark Matter Echo explains as its own notebook source");
    assertEquals("DARK MATTER ECHO", echoReflection && echoReflection.proofLabel, "Dark Matter Echo explanation preserves the anomaly proof label");

    list = makeEl();
    game.dailyInfo = {
      isFrontier: true,
      dateStr: "2026-06-30",
      tier: 4,
      shareCode: "FRONTIER-ICE-4242",
      concept: signalFocus.concept,
      labContract: signalFocus
    };
    game.frontierBoard = {
      "FRONTIER-ICE-4242": {
        dateStr: "2026-06-30",
        shareCode: "FRONTIER-ICE-4242",
        pilot: "Grace",
        tier: 4,
        stars: 3,
        bestTime: 35.5,
        planetName: "Glacies",
        variantLabel: "Numeric friction target"
      }
    };
    updateMissionList(game);
    const frontierSignalLab = findByClass(list, "signal-lab-contract-card");
    const frontierSignalText = flattenText(frontierSignalLab || list);
    const frontierRival = findByClass(list, "frontier-rival-crt-card");
    const frontierRivalText = flattenText(frontierRival || list);
    assertEquals(true, /FRONTIER LAB/.test(frontierSignalText), "Signal lab card should identify Frontier runs");
    assertEquals(true, /T4/.test(frontierSignalText), "Frontier signal lab card should show the tier");
    assertEquals(true, !!frontierRival, "Frontier runs should pin the imported rival target in the mission panel");
    assertEquals(true, /FRONTIER RIVAL/.test(frontierRivalText), "Frontier rival card should identify itself");
    assertEquals(true, /Chase Grace/.test(frontierRivalText), "Frontier rival card should name the classmate rival");
    assertEquals(true, /Beat Grace/.test(frontierRivalText), "Frontier rival card should show the chase target");
    assertEquals(true, /3\/3 Lab Stars/.test(frontierRivalText), "Frontier rival card should show target lab stars");
    assertEquals(true, /35\.5s/.test(frontierRivalText), "Frontier rival card should show target time");
    assertEquals(true, /Next ladder: 3 proofs to RIVAL LADDER/.test(frontierRivalText), "Frontier rival card should preview the next ladder milestone");

    list = makeEl();
    game.dailyInfo = {
      isFrontier: true,
      darkMatterPrep: true,
      dateStr: "2026-06-30",
      tier: 4,
      shareCode: "FRONTIER-ICE-4242",
      concept: "Infer hidden forces from motion",
      labContract: {
        title: "Dark Matter Prep: curve evidence",
        body: "Run the Frontier remix, then compare path curve, speed, and force changes as hidden-force clues.",
        concept: "Infer hidden forces from motion",
        command: signalFocus.command
      }
    };
    updateMissionList(game);
    const prepSignalLab = findByClass(list, "signal-lab-contract-card");
    const prepSignalText = flattenText(prepSignalLab || list);
    assertEquals(true, /DARK MATTER PREP/.test(prepSignalText), "Tagged prep runs should label the in-run Signal Lab card as Dark Matter prep");
    assertEquals(true, /curve evidence/.test(prepSignalText), "Prep signal card should show the evidence target");
    assertEquals(true, /Infer hidden forces from motion/.test(prepSignalText), "Prep signal card should show the hidden-force concept");
    assertEquals(true, !!scienceDelta, "Mission panel should show the latest science delta");
    assertEquals(true, /WHAT CHANGED/.test(scienceDeltaText), "Science delta card should identify itself");
    assertEquals(true, /Mass/.test(scienceDeltaText), "Science delta should list changed values");
    assertEquals(true, /Less mass/.test(scienceDeltaText), "Science delta should include the science cue");
    assertEquals(true, /Probability/.test(scienceDeltaText), "Science delta should render probability evidence");
    assertEquals(true, /More trials reveal the pattern/.test(scienceDeltaText), "Science delta should explain repeated chance trials");
    assertEquals(true, /NEXT EXPERIMENT/.test(scienceDeltaText), "Science delta should show the next experiment cue");
    assertEquals(true, /Lower mass or raise engine/.test(scienceDeltaText), "Science delta should render the cue body");
    assertEquals(true, /hopper\.engine = 6/.test(scienceDeltaText), "Science delta should render the runnable next command");
    assertEquals(true, /STAGE CODE/.test(scienceDeltaText), "Science delta should expose a stage-code action");
    assertEquals(true, !!contract, "Mission panel should append a lab-star contract");
    assertEquals(false, !!replayBeforeProgress, "First run should not show a replay contract even when profile progress exists");
    assertEquals(true, /LAB STARS/.test(text), "Contract should identify the star target");
    assertEquals(true, /2\/3/.test(text), "Contract should show current star count");
    assertEquals(true, /OK Mission tasks/.test(text), "Contract should credit completed mission tasks");
    assertEquals(true, /NEXT Mission gems/.test(text), "Contract should show missing gem star");
    assertEquals(true, /OK Science proof/.test(text), "Contract should credit science proof");

    list = makeEl();
    game.remixContext = 'first';
    game.dailyInfo = null;
    game.lastStagedExperiment = {
      title: "Mass Lab",
      kind: "mass",
      source: "staged-reminder",
      command: "hopper.mass = 1.0",
      time: Date.now()
    };
    game.lastScienceDelta = {
      code: "hopper.mass = 1.0",
      changes: [{ label: "Mass", value: "2.5 -> 1.0" }],
      nextExperiment: {
        title: "Engine Lab",
        body: "Raise engine, then compare speed.",
        command: "hopper.engine = 7"
      }
    };
    game.discoveryPulse = {
      code: "hopper.mass = 1.0",
      combo: 2,
      rewardXP: 13,
      comboBonusXP: 2,
      comboAmplifierBonusXP: 0,
      openedGems: 0
    };
    updateMissionList(game);
    assertEquals(false, !!findByClass(list, "staged-experiment-card"), "Staged reminder should hide once that command has produced the latest delta");
    const testedDelta = findByClass(list, "science-delta-card");
    const testedDeltaText = flattenText(testedDelta || list);
    assertEquals(true, /TESTED EXPERIMENT/.test(testedDeltaText), "Science delta should identify completed staged experiments");
    assertEquals(true, /Mass Lab/.test(testedDeltaText), "Completed staged result should preserve the staged target title");
    assertEquals(true, /Mission CRT/.test(testedDeltaText), "Completed staged result should preserve the source surface");
    assertEquals(true, /Compare these changes/.test(testedDeltaText), "Completed staged result should connect the code run to evidence");
    assertEquals(true, /LAB CHAIN x2/.test(testedDeltaText), "Completed staged result should show the matching research chain state");
    assertEquals(true, /Combo evidence \+2 XP/.test(testedDeltaText), "Completed staged result should name the chain payoff");
    assertEquals(true, /STAGE NEXT/.test(testedDeltaText), "Completed staged result should offer the follow-up experiment");
    const testedNextButton = findByClass(testedDelta || list, "science-delta-tested-stage-btn");
    const chainTarget = findByClass(list, "lab-chain-target-card");
    const chainTargetText = flattenText(chainTarget || list);
    assertEquals(true, !!chainTarget, "Mission panel should keep the lab-chain target visible");
    assertEquals(true, /LAB CHAIN x2/.test(chainTargetText), "Lab-chain target should show the active combo");
    assertEquals(true, /Next new progress can reach x3/.test(chainTargetText), "Lab-chain target should name the next combo step");
    assertEquals(true, /TRIPLE TEST at x3 \(\+6 XP\)/.test(chainTargetText), "Lab-chain target should preview the next named milestone");
    assertEquals(true, /Engine Lab/.test(chainTargetText), "Lab-chain target should use the next experiment title");
    assertEquals(true, /hopper\.engine = 7/.test(chainTargetText), "Lab-chain target should render the next command");
    const chainStageButton = findByClass(chainTarget || list, "lab-chain-target-stage-btn");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    chainStageButton._events.click();
    assertEquals("hopper.engine = 7", inputEl22j.value, "Lab-chain target should stage the next experiment command");
    assertEquals(true, inputEl22j.focused, "Lab-chain target should focus the terminal");
    assertEquals("lab-chain-target", game.lastStagedExperiment && game.lastStagedExperiment.source, "Lab-chain staging should remember its source");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    testedNextButton._events.click();
    assertEquals("hopper.engine = 7", inputEl22j.value, "Completed staged result should stage the next experiment command");
    assertEquals(true, inputEl22j.focused, "Completed staged result should focus the terminal for the next test");
    assertEquals("tested-result", game.lastStagedExperiment && game.lastStagedExperiment.source, "Follow-up staging should remember that it came from the tested result");
    list = makeEl();
    game.lastScienceDelta = null;
    updateMissionList(game);
    const testedResultStaged = findByClass(list, "staged-experiment-card");
    const testedResultStagedText = flattenText(testedResultStaged || list);
    assertEquals(true, /Tested result/.test(testedResultStagedText), "Follow-up staging should show the tested-result source label");

    list = makeEl();
    game.lastStagedExperiment = null;
    game.lastScienceDelta = {
      code: "hopper.mass = 1.0",
      changes: [{ label: "Mass", value: "2.5 -> 1.0" }],
      nextExperiment: {
        title: "Engine Lab",
        body: "Raise engine, then compare speed.",
        command: "hopper.engine = 7"
      }
    };
    game.discoveryPulse = {
      code: "hopper.mass = 1.0",
      combo: 2,
      rewardXP: 0,
      openedGems: 0
    };
    updateMissionList(game);
    const pausedChainTarget = findByClass(list, "lab-chain-target-card");
    const pausedChainText = flattenText(pausedChainTarget || list);
    assertEquals(true, /CHAIN PAUSED/.test(pausedChainText), "Repeat runs should pause the lab-chain target");
    assertEquals(true, /Repeat commands do not extend the chain/.test(pausedChainText), "Paused chain should explain why the repeat did not pay out");

    list.children = [];
    game.remixContext = 'mastery';
    game.requiredCollectiblesCollected = 2;
    updateMissionList(game);
    const replayContract = findByClass(list, "run-replay-contract");
    const replayText = flattenText(replayContract || list);
    assertEquals(true, !!replayContract, "Replay run should pin the next run contract in the mission panel");
    assertEquals(true, /RUN CONTRACT/.test(replayText), "Replay card should identify itself as a run contract");
    assertEquals(true, /Collect Mass Lab/.test(replayText), "Replay card should show the active contract title");
    assertEquals(true, /Reward: formula card \+ Research XP/.test(replayText), "Replay card should show the contract reward");
    document.getElementById = oldGetElementById22h;
    document.createElement = oldCreateElement22h;
    window.Game = oldWindowGame22h;
    switchMainMode = oldSwitchMainMode22h;
    renderTestResult("engine-suite", "Curriculum: mission panel shows mentor, lab-star, and replay contracts", true);
  } catch (err) {
    document.getElementById = oldGetElementById22h;
    document.createElement = oldCreateElement22h;
    window.Game = oldWindowGame22h;
    switchMainMode = oldSwitchMainMode22h;
    renderTestResult("engine-suite", "Curriculum: mission panel shows mentor, lab-star, and replay contracts", false, err.message);
  }

  // Test 22i: Mission Coach renders the predict-code-test-explain loop as labeled progress.
  const oldGetElementById22i = document.getElementById;
  const oldCreateElement22i = document.createElement;
  try {
    const makeCoachEl = () => ({
      children: [],
      style: {},
      className: "",
      textContent: "",
      innerHTML: "",
      title: "",
      dataset: {},
      value: "",
      autocomplete: "",
      spellcheck: false,
      type: "",
      focused: false,
      _events: {},
      appendChild(child) { this.children.push(child); return child; },
      querySelectorAll: () => [],
      addEventListener(type, handler) { this._events[type] = handler; },
      focus() { this.focused = true; },
      setSelectionRange() {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
    });
    const els = {
      "pedagogical-mission-panel": makeCoachEl(),
      "pedagogical-steps": makeCoachEl(),
      "pedagogical-mission-title": makeCoachEl(),
      "mission-coach-summary": makeCoachEl(),
      "mission-coach-focus": makeCoachEl(),
      "mission-scaffold": makeCoachEl(),
      "console-input": makeCoachEl()
    };
    document.getElementById = (id) => els[id] || null;
    document.createElement = () => makeCoachEl();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set();
    game.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    game.currentMissionId = "earth-gravity-wall";
    game.currentMissionSteps = { observe: true, predict: true, code: false, test: false, explain: false, challenge: false };
    game.discoveryCombo = 2;
    game.discoveryPulse = { combo: 2, rewardXP: 5, code: "hopper.mass = 1.0" };
    game.lastScienceDelta = {
      code: "hopper.mass = 1.0",
      changes: [{ label: "Mass", value: "2.5 -> 1.0" }],
      nextExperiment: {
        title: "Engine Lab",
        body: "Raise engine, then compare speed.",
        command: "hopper.engine = 7"
      }
    };
    updatePedagogicalGuide(game);
    const loop = els["pedagogical-steps"].children.find(child => child.className === "coach-lab-loop");
    assertEquals(true, !!loop, "Coach should render a labeled lab loop strip");
    assertEquals(5, loop.children.length, "Loop strip should show the five learning steps");
    assertEquals("Observe Predict Code Test Explain", loop.children.map(child => child.textContent).join(" "), "Loop strip should name each step");
    assertEquals(true, /done/.test(loop.children[0].className) && /done/.test(loop.children[1].className), "Observed and predicted steps should be marked done");
    assertEquals(true, /active/.test(loop.children[2].className), "Code should be the active step");
    assertEquals(true, /Activate Hopper/.test(els["mission-coach-focus"].innerHTML), "Coach focus should show the next code action");
    assertEquals(true, /Change one number/.test(els["mission-coach-summary"].innerHTML), "Coach summary should surface the beginner concept");
    const proofHook = els["pedagogical-steps"].children.find(child => child.className === "coach-proof-hook");
    assertEquals(true, !!proofHook, "Coach should render the proof payoff hook");
    assertEquals(true, /LAB CHAIN x2/.test(proofHook.innerHTML), "Proof hook should show the active reward path");
    assertEquals(true, /Engine Lab/.test(proofHook.innerHTML), "Proof hook should name the next experiment");
    assertEquals(true, /hopper\.engine = 7/.test(proofHook.innerHTML), "Proof hook should show the runnable follow-up command");
    const proofProgress = proofHook.children.find(child => /^coach-proof-progress/.test(child.className || ""));
    assertEquals(true, !!proofProgress, "Proof hook should render compact milestone progress");
    assertEquals("2/3 to TRIPLE TEST", proofProgress.children[0] && proofProgress.children[0].textContent, "Proof hook should name the next combo milestone");
    assertEquals(3, proofProgress.children[1] && proofProgress.children[1].children.length, "Proof hook should render one pip per combo target");
    const codeBridge = proofHook.children.find(child => child.className === "coach-code-bridge");
    assertEquals(true, !!codeBridge, "Proof hook should render a real-code bridge for the active command");
    assertEquals(true, /CODE BRIDGE/.test(codeBridge.innerHTML), "Code bridge should identify itself");
    assertEquals(true, /KidCode -> Python -> JavaScript/.test(codeBridge.innerHTML), "Code bridge should name the syntax ladder");
    assertEquals(true, /hopper\.engine = 7/.test(codeBridge.innerHTML), "Code bridge should preserve the KidCode assignment");
    assertEquals(true, /hopper\.engine = 7;/.test(codeBridge.innerHTML), "Code bridge should show JavaScript statement syntax");
    const loopBridge = getCoachCodeBridge("repeat 3: spawn_spring()");
    assertEquals(true, /for i in range\(3\):/.test(loopBridge && loopBridge.python), "Code bridge should translate repeat into a Python for-loop");
    assertEquals(true, /for \(let i = 0; i < 3; i\+\+\)/.test(loopBridge && loopBridge.javascript), "Code bridge should translate repeat into a JavaScript for-loop");
    assertEquals(true, /spawnSpring\(\);/.test(loopBridge && loopBridge.javascript), "Code bridge should camel-case JavaScript helper calls");
    const branchBridge = getCoachCodeBridge("if player.fuel < 50: player.say('branch A')");
    assertEquals(true, /if player\.fuel < 50:/.test(branchBridge && branchBridge.python), "Code bridge should translate if branches into Python syntax");
    assertEquals(true, /if \(player\.fuel < 50\)/.test(branchBridge && branchBridge.javascript), "Code bridge should translate if branches into JavaScript syntax");
    const eventBridge = getCoachCodeBridge("when player.touching('magnet'): hopper.pole = 'south'");
    assertEquals(true, /def handler\(\):/.test(eventBridge && eventBridge.python), "Code bridge should translate event rules into a Python handler");
    assertEquals(true, /onEvent\(\"player.touching/.test(eventBridge && eventBridge.javascript), "Code bridge should translate event rules into JavaScript handler syntax");
    const proofStage = proofHook.children.find(child => child.className === "coach-proof-stage-btn");
    assertEquals("STAGE PROOF", proofStage && proofStage.textContent, "Proof hook should expose a stage action");
    proofStage._events.click();
    assertEquals("hopper.engine = 7", els["console-input"].value, "Coach proof action should stage the follow-up command");
    assertEquals(true, els["console-input"].focused, "Coach proof action should focus the terminal");
    assertEquals("coach-proof-hook", game.lastStagedExperiment && game.lastStagedExperiment.source, "Coach proof action should preserve the coach source");
    assertEquals("Engine Lab", game.lastStagedExperiment && game.lastStagedExperiment.title, "Coach proof action should preserve the payoff title");
    assertEquals("Mission Coach proof", getStagedExperimentSourceLabel(game.lastStagedExperiment.source), "Coach proof staged reminder should name the source");
    document.getElementById = oldGetElementById22i;
    document.createElement = oldCreateElement22i;
    renderTestResult("engine-suite", "Curriculum: Mission Coach renders lab loop progress", true);
  } catch (err) {
    document.getElementById = oldGetElementById22i;
    document.createElement = oldCreateElement22i;
    renderTestResult("engine-suite", "Curriculum: Mission Coach renders lab loop progress", false, err.message);
  }

  // Test 23: Mission Coach copy avoids hidden old mode names
  try {
    const texts = [];
    PlatformerMissions.forEach(mission => {
      texts.push(mission.title, mission.beginnerConcept, mission.objective, mission.codingConcept);
      mission.steps.forEach(step => texts.push(step.prompt));
      mission.hints.forEach(hint => texts.push(hint));
      const scaffold = mission.scaffold;
      texts.push(scaffold.explain, scaffold.parentPrompt, scaffold.codeIdea, scaffold.physicsIdea, scaffold.success);
      scaffold.slots.forEach(slot => texts.push(slot.label, slot.hint));
      texts.push(mission.prediction.question);
      mission.prediction.options.forEach(option => texts.push(option.label, option.feedback));
      mission.resultChecks.forEach(check => texts.push(check.label, check.success, check.waiting));
      texts.push(mission.badge.label, mission.badge.description);
    });

    if (typeof getGuidedStepCopy === 'function') {
      texts.push(...getGuidedStepCopy());
    }

    const forbidden = [
      ["Code", "tab"].join(" "),
      ["Nav", "tab"].join(" "),
      ["Navigator", "tab"].join(" "),
      ["Notebook", "tab"].join(" ")
    ];
    const hit = texts.find(text => forbidden.some(term => String(text).includes(term)));
    assertEquals(undefined, hit, `Found hidden UI wording: ${hit}`);
    renderTestResult("engine-suite", "Curriculum: Mission Coach copy avoids hidden tabs", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: Mission Coach copy avoids hidden tabs", false, err.message);
  }

  // Test 24: Guided tutorial clears in-world speech and restores hidden state
  const GUIDED_FLAG = "star_hopper_guided_completed";
  let oldGetElementById;
  let oldGuidedFlag = null;
  let oldGame;
  try {
    oldGetElementById = document.getElementById;
    try { oldGuidedFlag = localStorage.getItem(GUIDED_FLAG); } catch (e) {}
    oldGame = window.Game;

    const makeClassList = (initial = []) => {
      const values = new Set(initial);
      return {
        add: (name) => values.add(name),
        remove: (name) => values.delete(name),
        contains: (name) => values.has(name)
      };
    };
    const genericEl = () => ({
      style: {},
      textContent: "",
      querySelectorAll: () => [],
      classList: makeClassList()
    });
    const hud = {
      style: { display: "none" },
      classList: makeClassList(["hidden"])
    };
    const elements = {
      "guided-mode-hud": hud,
      "guided-step-label": genericEl(),
      "guided-step-desc": genericEl(),
      "guided-next-btn": genericEl(),
      "guided-dots": genericEl(),
      "game-canvas": genericEl(),
      "mode-btn-notebook": genericEl()
    };
    const player = new Player(0, 0);
    player.say("Tutorial line should not freeze on screen.", { dialogue: true, timer: 100 });

    window.Game = { player };
    // Force "guided tutorial not completed" so checkStartGuidedMode actually starts it.
    // (Reassigning window.localStorage is a no-op in browsers — clear the real flag instead.)
    try { localStorage.removeItem(GUIDED_FLAG); } catch (e) {}
    document.getElementById = (id) => elements[id] || genericEl();

    checkStartGuidedMode(0);
    assertEquals("", player.sayText, "Guided mode should clear any queued in-world speech");
    assertEquals(0, player.sayTimer, "Guided mode should stop the speech timer");
    assertEquals(false, hud.classList.contains("hidden"), "Guided HUD should be visible while active");

    completeGuidedMode();
    assertEquals(true, hud.classList.contains("hidden"), "Guided HUD should regain hidden class on completion");

    document.getElementById = oldGetElementById;
    try { if (oldGuidedFlag === null) localStorage.removeItem(GUIDED_FLAG); else localStorage.setItem(GUIDED_FLAG, oldGuidedFlag); } catch (e) {}
    window.Game = oldGame;
    renderTestResult("engine-suite", "Guided mode: clears stale speech and restores hidden state", true);
  } catch (err) {
    if (oldGetElementById) document.getElementById = oldGetElementById;
    try { if (oldGuidedFlag === null) localStorage.removeItem(GUIDED_FLAG); else localStorage.setItem(GUIDED_FLAG, oldGuidedFlag); } catch (e) {}
    window.Game = oldGame;
    renderTestResult("engine-suite", "Guided mode: clears stale speech and restores hidden state", false, err.message);
  }

  // Test 24b: reduced-motion preference is live and suppresses high-motion rave visuals.
  const oldMatchMedia = window.matchMedia;
  try {
    Compiler.reset();
    let listener = null;
    const mediaQuery = {
      matches: false,
      addEventListener: (type, cb) => { if (type === "change") listener = cb; },
      removeEventListener: () => {}
    };
    window.matchMedia = () => mediaQuery;

    const game = new StarHopperGame();
    assertEquals(false, game.setupReducedMotionPreference(), "Initial non-reduced media query should leave motion on");
    assertEquals(false, game.reducedMotion, "Game should start with reduced motion off");
    assertEquals(true, typeof listener === "function", "Game should listen for OS preference changes");

    Compiler.env.raveMode = true;
    mediaQuery.matches = true;
    listener({ matches: true });
    assertEquals(true, game.reducedMotion, "OS reduce-motion changes should update the game flag");
    assertEquals(false, Compiler.env.raveMode, "Reduce motion should clear rainbow rave visuals");

    mediaQuery.matches = false;
    listener({ matches: false });
    assertEquals(false, game.reducedMotion, "Turning reduce motion off should restore the game flag");

    if (oldMatchMedia === undefined) delete window.matchMedia;
    else window.matchMedia = oldMatchMedia;
    Compiler.reset();
    renderTestResult("engine-suite", "Accessibility: reduced motion tracks OS changes", true);
  } catch (err) {
    if (oldMatchMedia === undefined) delete window.matchMedia;
    else window.matchMedia = oldMatchMedia;
    Compiler.reset();
    renderTestResult("engine-suite", "Accessibility: reduced motion tracks OS changes", false, err.message);
  }

  // Test 24c: readable-text mode persists and updates the body/button state.
  const oldGetElementById24c = document.getElementById;
  const oldBody24c = document.body;
  const readableKey = "starHopper.readableText";
  const oldReadableSetting = localStorage.getItem(readableKey);
  try {
    const bodyClasses = new Set();
    const btnClasses = new Set();
    const attrs = {};
    const makeToggle = (set) => ({
      toggle: (name, force) => {
        const on = force === undefined ? !set.has(name) : !!force;
        if (on) set.add(name); else set.delete(name);
        return on;
      },
      contains: (name) => set.has(name)
    });
    const button = {
      classList: makeToggle(btnClasses),
      setAttribute: (name, value) => { attrs[name] = value; },
      getAttribute: (name) => attrs[name],
      title: "",
      dataset: {},
      addEventListener: () => {}
    };
    document.body = { classList: makeToggle(bodyClasses) };
    document.getElementById = (id) => id === "readable-text-btn" ? button : null;

    assertEquals(true, setReadableTextPreference(true), "Readable mode should turn on");
    assertEquals(true, bodyClasses.has("readable-text-mode"), "Body class should mark readable mode");
    assertEquals(true, btnClasses.has("readable-on"), "Button should show active readable mode");
    assertEquals("true", attrs["aria-pressed"], "Button aria-pressed should be true");
    assertEquals("High-contrast readable text mode on", button.title, "Button title should name high-contrast mode when active");
    assertEquals("1", localStorage.getItem(readableKey), "Readable mode should persist on");

    assertEquals(false, toggleReadableTextMode(), "Toggle should turn readable mode off");
    assertEquals(false, bodyClasses.has("readable-text-mode"), "Body class should clear when toggled off");
    assertEquals("High-contrast readable text mode", button.title, "Button title should name high-contrast mode when inactive");
    assertEquals("0", localStorage.getItem(readableKey), "Readable mode should persist off");

    localStorage.setItem(readableKey, "1");
    assertEquals(true, initReadableTextPreference(), "Saved readable mode should restore on init");
    assertEquals(true, bodyClasses.has("readable-text-mode"), "Init should apply the saved body class");

    document.getElementById = oldGetElementById24c;
    document.body = oldBody24c;
    if (oldReadableSetting === null) localStorage.removeItem(readableKey);
    else localStorage.setItem(readableKey, oldReadableSetting);
    renderTestResult("engine-suite", "Accessibility: readable text mode persists", true);
  } catch (err) {
    document.getElementById = oldGetElementById24c;
    document.body = oldBody24c;
    if (oldReadableSetting === null) localStorage.removeItem(readableKey);
    else localStorage.setItem(readableKey, oldReadableSetting);
    renderTestResult("engine-suite", "Accessibility: readable text mode persists", false, err.message);
  }

  // Test 24d: readable-text mode has a contrast contract for lesson cards and code.
  try {
    if (typeof require === "function") {
      const fs = require("fs");
      const path = require("path");
      const css = fs.readFileSync(path.resolve(__dirname, "..", "style.css"), "utf8");
      assertEquals(true, /readable-mode-contrast-contract/.test(css), "Readable mode CSS should carry an explicit contrast contract marker");
      assertEquals(true, /body\.readable-text-mode\s*\{[\s\S]*--panel-bg:\s*rgba\(2,\s*6,\s*23,\s*0\.92\)/.test(css), "Readable mode should darken panels through shared variables");
      assertEquals(true, css.includes(".lesson-lens-card") && css.includes(".mission-lab-question-card") && css.includes(".signal-lab-contract-card") && css.includes(".start-mission-radar") && css.includes(".notebook-entry"), "Readable mode should cover core lesson surfaces");
      assertEquals(true, /body\.readable-text-mode :is\([\s\S]*\.console-input[\s\S]*\.notebook-textarea[\s\S]*\)\s*\{[\s\S]*background:\s*#020617;[\s\S]*border:\s*1px solid rgba\(226,\s*232,\s*240,\s*0\.3\);[\s\S]*color:\s*#f8fafc;/.test(css), "Readable mode should give code and input surfaces solid high-contrast styling");
    }
    renderTestResult("engine-suite", "Accessibility: readable mode boosts lesson contrast", true);
  } catch (err) {
    renderTestResult("engine-suite", "Accessibility: readable mode boosts lesson contrast", false, err.message);
  }

  // Test 25: Hopper pole assignment controls magnetic polarity state
  try {
    Compiler.reset();
    const game = makeScaffoldMockGame(4);
    const res = Compiler.runCommand("hopper.pole = 'south'", game);

    assertEquals(true, res.success);
    assertEquals("south", game.player.pole, "Player pole should update");
    assertEquals("south", Compiler.env.magnetPole, "Compiler magnetic polarity should update");
    renderTestResult("engine-suite", "Compiler: hopper.pole tunes magnetic polarity", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: hopper.pole tunes magnetic polarity", false, err.message);
  }

  // Test 26: Elastic collisions and momentum transfer equations under different elasticity parameters
  try {
    Compiler.reset();
    
    // Player: mass = 1.0, vx = 5.0, vy = 0.0
    // Boulder: mass = 2.0, vx = 0.0, vy = 0.0
    // Position: player at x=0, y=0; boulder at x=20, y=0. Both size=20.
    // They are touching/overlapping. 
    // Vector from player to boulder is along +x. Normal is (1.0, 0.0).
    const player = {
      x: 0, y: 0, w: 20, h: 20,
      vx: 5.0, vy: 0.0, mass: 1.0
    };
    const boulder = {
      x: 10, y: 0, w: 20, h: 20, // centers: player=10, boulder=20. dx=10. normal nx=1.0, ny=0.0
      vx: 0.0, vy: 0.0, mass: 2.0
    };
    
    // Elasticity e = 1.0 (perfectly elastic)
    Compiler.env.elasticity = 1.0;
    
    // Check resolveElasticCollision
    Physics.resolveElasticCollision(player, boulder);
    
    // Using equations:
    // velAlongNormal = v1 - v2 = 5 - 0 = 5
    // impulse = -(1 + e) * velAlongNormal / (1/m1 + 1/m2)
    //         = -(2) * 5 / (1/1 + 1/2) = -10 / 1.5 = -6.6666
    // v1' = v1 + impulse / m1 = 5 - 6.6666/1 = -1.6666
    // v2' = v2 - impulse / m2 = 0 + 6.6666/2 = 3.3333
    assertClose(-1.6666, player.vx, 0.01, "Player final velocity X should match elastic collision equations");
    assertClose(3.3333, boulder.vx, 0.01, "Boulder final velocity X should match elastic collision equations");
    
    renderTestResult("engine-suite", "Physics: elastic momentum transfer resolves correctly", true);
  } catch (err) {
    renderTestResult("engine-suite", "Physics: elastic momentum transfer resolves correctly", false, err.message);
  }

  // Test 27: Compiler: comparison event parsing and edge-triggered event execution
  try {
    Compiler.reset();
    
    let sayCalled = 0;
    let sayMsg = "";
    const mockGame = {
      player: {
        fuel: 30,
        vx: 0, vy: 0,
        say: (msg) => {
          sayCalled++;
          sayMsg = msg;
        },
        isTouching: () => false
      },
      keys: {}
    };
    
    // Register comparison event rule
    const runRes = Compiler.runCommand("when player.fuel < 20: player.say('critical_fuel')", mockGame);
    assertEquals(true, runRes.success, "Command parsing should succeed");
    assertEquals(1, Compiler.activeRules.length, "One event rule should be registered");
    
    // Update rules at fuel = 30 (no trigger)
    Compiler.updateRules(mockGame);
    assertEquals(0, sayCalled, "Should not trigger when fuel is above threshold");
    
    // Drop fuel to 15 (should trigger)
    mockGame.player.fuel = 15;
    Compiler.updateRules(mockGame);
    assertEquals(1, sayCalled, "Should trigger when fuel drops below threshold");
    assertEquals("critical_fuel", sayMsg, "Should pass correct message to say()");
    
    // Update rules again at fuel = 15 (should NOT trigger again - edge triggered)
    Compiler.updateRules(mockGame);
    assertEquals(1, sayCalled, "Should not trigger repeatedly (edge-triggered check)");
    
    // Raise fuel back to 30
    mockGame.player.fuel = 30;
    Compiler.updateRules(mockGame);
    assertEquals(1, sayCalled, "Should not trigger on raising above threshold");
    
    // Drop fuel again to 10 (should trigger again on transition)
    mockGame.player.fuel = 10;
    Compiler.updateRules(mockGame);
    assertEquals(2, sayCalled, "Should trigger on subsequent drop below threshold");
    
    renderTestResult("engine-suite", "Compiler: comparison event registers and triggers edge-triggered", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: comparison event registers and triggers edge-triggered", false, err.message);
  }

  // Test 27b: `when player.touching(...)` is EDGE-triggered — fires once on contact, not every
  // frame (else a body like player.say(...) would re-pin the speech balloon forever).
  try {
    Compiler.reset();
    let sayCount = 0;
    const mockGame = {
      player: { charType: 'star', onGround: true, fuel: 100, vx: 0, vy: 0,
        touchingGroundType: 'ice', isTouching: () => true, say: () => { sayCount++; } },
      keys: {},
    };
    Compiler.runCommand("when player.touching('ice'): player.say('hi')", mockGame);
    for (let i = 0; i < 12; i++) Compiler.updateRules(mockGame);  // stay in contact 12 frames
    assertEquals(1, sayCount, "touching fires once on contact, not every frame");
    // Leave, then re-enter → fires again
    mockGame.player.touchingGroundType = ''; mockGame.player.isTouching = () => false;
    Compiler.updateRules(mockGame);
    mockGame.player.touchingGroundType = 'ice'; mockGame.player.isTouching = () => true;
    Compiler.updateRules(mockGame);
    assertEquals(2, sayCount, "re-entering contact fires again");
    renderTestResult("engine-suite", "Compiler: player.touching is edge-triggered (no balloon pin)", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: player.touching is edge-triggered (no balloon pin)", false, err.message);
  }

  // Test 27c: `when hopper.rocket_on` is EDGE-triggered — fires once per press, not every held frame.
  try {
    Compiler.reset();
    let sayCount = 0;
    const mockGame = {
      player: { charType: 'hopper', onGround: false, fuel: 100, vx: 0, vy: 0,
        isTouching: () => false, say: () => { sayCount++; } },
      keys: {},
    };
    Compiler.runCommand("when hopper.rocket_on: player.say('fly')", mockGame);
    mockGame.keys[' '] = true;
    for (let i = 0; i < 12; i++) Compiler.updateRules(mockGame);  // hold the rocket key 12 frames
    assertEquals(1, sayCount, "rocket_on fires once per press, not every frame");
    mockGame.keys[' '] = false; Compiler.updateRules(mockGame);
    mockGame.keys[' '] = true; Compiler.updateRules(mockGame);
    assertEquals(2, sayCount, "releasing and re-pressing fires again");
    renderTestResult("engine-suite", "Compiler: hopper.rocket_on is edge-triggered (no balloon pin)", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: hopper.rocket_on is edge-triggered (no balloon pin)", false, err.message);
  }

  // Test 28: Compiler: enemy.friendly and enemy.speed variable overrides
  try {
    Compiler.reset();
    
    const mockGame = makeScaffoldMockGame(0);
    
    // Test enemy.friendly override
    let res = Compiler.runCommand("enemy.friendly = 1", mockGame);
    assertEquals(true, res.success);
    assertEquals(true, Compiler.env.enemyFriendly, "enemy.friendly should be true");
    
    // Test enemy.speed override
    res = Compiler.runCommand("enemy.speed = 3.5", mockGame);
    assertEquals(true, res.success);
    assertEquals(3.5, Compiler.env.enemySpeed, "enemy.speed override should be set to 3.5");
    
    // Test that resetting clears overrides
    Compiler.reset();
    assertEquals(false, Compiler.env.enemyFriendly, "enemy.friendly should be reset to false");
    assertEquals(null, Compiler.env.enemySpeed, "enemy.speed override should be reset to null");
    
    renderTestResult("engine-suite", "Compiler: enemy friendly and speed overrides parsed", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: enemy friendly and speed overrides parsed", false, err.message);
  }
}

// Suite 4: Solar Interplanetary Flight Simulator Tests
function runSolarTests() {
  // Test 23: Vector Math Addition and Scaling
  try {
    const v1 = { x: 1.5, y: -2.0 };
    const v2 = { x: 2.5, y: 5.0 };
    const vSum = Nav.Vector.add(v1, v2);
    const vScaled = Nav.Vector.scale(v1, 3.0);

    assertEquals(4.0, vSum.x, "Vector addition X should match");
    assertEquals(3.0, vSum.y, "Vector addition Y should match");
    assertEquals(4.5, vScaled.x, "Vector scaling X should match");
    assertEquals(-6.0, vScaled.y, "Vector scaling Y should match");
    renderTestResult("solar-suite", "Vector Math: 2D addition & scaling correctness", true);
  } catch (err) {
    renderTestResult("solar-suite", "Vector Math: 2D addition & scaling correctness", false, err.message);
  }

  // Test 24: Deterministic circular orbit position lookup
  try {
    const earth = Nav.BODIES.EARTH;
    const state = Nav.bodyStateAt(earth, 0); // t=0

    // For Earth initialAngle=0, x should equal orbitRadius and y should equal 0
    assertEquals(earth.orbitRadius, state.x, "At t=0, Earth X position must equal orbit radius");
    assertEquals(0, state.y, "At t=0, Earth Y position must equal 0 (cos=1, sin=0)");
    renderTestResult("solar-suite", "Planetary Coordinates: deterministic state lookup at t=0", true);
  } catch (err) {
    renderTestResult("solar-suite", "Planetary Coordinates: deterministic state lookup at t=0", false, err.message);
  }

  // Test 25: Hohmann Transfer math validation
  try {
    const earth = Nav.BODIES.EARTH;
    const mars = Nav.BODIES.MARS;
    const transfer = Nav.computeTransfer(earth, mars);

    assertEquals(true, transfer.totalDeltaV > 0, "Total Hohmann transfer Delta-V must be positive");
    assertEquals(true, transfer.timeOfFlight > 0, "Hohmann transit flight duration must be positive");
    assertEquals(true, typeof transfer.targetPhaseAngleDeg === 'number', "Target phase angle must be a valid number");
    renderTestResult("solar-suite", "Analytical Hohmann: transfer requirements calculations", true);
  } catch (err) {
    renderTestResult("solar-suite", "Analytical Hohmann: transfer requirements calculations", false, err.message);
  }

  // Test 26: Spacecraft console command queue parser
  try {
    Nav.initShip(0, 0, 0, 0);
    // Queue up statements
    Nav.runCommands("point_at('mars'); thrust(3.0, 8.0); wait(45.0)");

    assertEquals(3, Nav.commandQueue.length, "Command queue should contain exactly 3 actions");
    assertEquals("rotate", Nav.commandQueue[0].type, "First action should be rotate");
    assertEquals("thrust", Nav.commandQueue[1].type, "Second action should be thrust");
    assertEquals("wait", Nav.commandQueue[2].type, "Third action should be wait");
    renderTestResult("solar-suite", "Console Command Queue parser and sequence scheduler", true);
  } catch (err) {
    renderTestResult("solar-suite", "Console Command Queue parser and sequence scheduler", false, err.message);
  }

  // Test 27: Solar mission starts in a stable local Earth parking orbit
  try {
    Nav.Missions[0].setup();
    const earthState = Nav.bodyStateAt(Nav.BODIES.EARTH, 0);
    const relDistance = Nav.Vector.distance(Nav.ship, earthState);
    const relSpeed = Nav.Vector.distance(
      { x: Nav.ship.vx, y: Nav.ship.vy },
      { x: earthState.vx, y: earthState.vy }
    );

    assertEquals(true, relDistance < Nav.SOI_RADII.earth, "Ship should start inside Earth's SOI");
    assertEquals(true, relSpeed < 0.01, "Parking-orbit speed should match scaled solar units");
    renderTestResult("solar-suite", "Solar setup: Earth parking orbit uses scaled velocity", true);
  } catch (err) {
    renderTestResult("solar-suite", "Solar setup: Earth parking orbit uses scaled velocity", false, err.message);
  }

  // Test 28: Navigator zoom preserves the world point under the cursor
  try {
    const canvas = { width: 800, height: 500 };
    const anchor = { x: 300, y: 190 };
    Nav.SU_TO_PX = 150;
    Nav.viewOffsetX = 35;
    Nav.viewOffsetY = -20;

    const before = Nav.screenToWorld(anchor, canvas);
    Nav.setZoom(210, anchor, canvas);
    const after = Nav.screenToWorld(anchor, canvas);

    assertClose(before.x, after.x, 0.0001, "Zoom should keep anchored world X fixed");
    assertClose(before.y, after.y, 0.0001, "Zoom should keep anchored world Y fixed");
    renderTestResult("solar-suite", "Navigator viewport: anchored zoom keeps frame stable", true);
  } catch (err) {
    renderTestResult("solar-suite", "Navigator viewport: anchored zoom keeps frame stable", false, err.message);
  }

  // Test 29: Beginner route bridge loads the correct next planet route
  try {
    const loaded = Nav.loadRouteToPlanet(0, 1);
    const mission = Nav.Missions[Nav.activeMissionIndex];

    assertEquals(true, loaded, "Route bridge should load");
    assertEquals("route-earth-moon", mission.id, "Earth should bridge to Moon");
    assertEquals(1, mission.targetPlanetIndex, "Bridge should target planet index 1");
    assertEquals(true, mission.starterCode.includes("point_at('moon')"), "Bridge should preload Moon route code");
    renderTestResult("solar-suite", "Navigator: beginner bridge loads next planet route", true);
  } catch (err) {
    renderTestResult("solar-suite", "Navigator: beginner bridge loads next planet route", false, err.message);
  }

  // Test 30: KidCode bridge — a flight plan compiles into ship actions on the queue
  try {
    Nav.Missions[0].setup();
    Nav.runKidCodePlan("point_at('moon')\nthrust(5, 2)\nwait(8)");
    assertEquals(3, Nav.commandQueue.length, "KidCode plan should enqueue 3 ship actions");
    assertEquals("rotate", Nav.commandQueue[0].type, "First action should be rotate");
    assertEquals("thrust", Nav.commandQueue[1].type, "Second action should be thrust");
    assertEquals(5, Nav.commandQueue[1].power, "Thrust power should pass through");
    assertEquals("wait", Nav.commandQueue[2].type, "Third action should be wait");
    renderTestResult("solar-suite", "KidCode bridge: flight plan enqueues ship actions", true);
  } catch (err) {
    renderTestResult("solar-suite", "KidCode bridge: flight plan enqueues ship actions", false, err.message);
  }

  // Test 31: planToQueue expands loops and never mutates the live flight
  try {
    Nav.Missions[0].setup();
    Nav.runKidCodePlan("point_at('moon')");
    const liveLen = Nav.commandQueue.length;
    const preview = Nav.planToQueue("repeat 3:\n  thrust(4, 2)\n  wait(8)");
    assertEquals(6, preview.length, "repeat 3 over 2 actions should expand to 6");
    assertEquals(liveLen, Nav.commandQueue.length, "preview must not mutate the live queue");
    renderTestResult("solar-suite", "Ghost preview: planToQueue expands loops, stays pure", true);
  } catch (err) {
    renderTestResult("solar-suite", "Ghost preview: planToQueue expands loops, stays pure", false, err.message);
  }

  // Test 32: 3-star grading rewards low fuel + few lines (a loop)
  try {
    const m = Nav.Missions[0];
    m.setup();
    Nav.runKidCodePlan(m.starterCode);              // 5-line loop ≤ line par (6)
    Nav.ship.fuelMass = Nav.ship.maxFuel - 0.5;     // fuel used 0.5 ≤ fuel par (0.80)
    assertEquals(3, Nav.computeStars(m).stars, "low fuel + loop should be 3 stars");
    Nav.ship.fuelMass = Nav.ship.maxFuel - 2.0;     // fuel used 2.0 > par
    assertEquals(2, Nav.computeStars(m).stars, "over fuel par should drop to 2 stars");
    renderTestResult("solar-suite", "3-star grade: fuel + line-count efficiency", true);
  } catch (err) {
    renderTestResult("solar-suite", "3-star grade: fuel + line-count efficiency", false, err.message);
  }

  // Test 33: Submit-Lab code round-trips (unicode-safe) and rejects garbage
  try {
    const lab = { v: 1, n: "Cadet 🚀", m: "route-earth-moon", t: "Earth to Moon", s: 2, f: 0.86, l: 5, c: "warp(3)\nrepeat 4:", d: "2026-06-26" };
    const code = StarHopperProfiles.exportLabCode(lab);
    assertEquals(0, code.indexOf("STARHOPPER-"), "lab code should carry the STARHOPPER- prefix");
    const back = StarHopperProfiles.importLabCode(code);
    assertEquals(lab.n, back.n, "emoji cadet name should round-trip");
    assertEquals(lab.s, back.s, "stars should round-trip");
    assertEquals(lab.c, back.c, "flight plan should round-trip");
    assertEquals(null, StarHopperProfiles.importLabCode("not-a-real-code"), "garbage should decode to null");
    renderTestResult("solar-suite", "Submit Lab: Base64 code round-trips, rejects garbage", true);
  } catch (err) {
    renderTestResult("solar-suite", "Submit Lab: Base64 code round-trips, rejects garbage", false, err.message);
  }

  // Test 34: wall-clock guard halts a run that exceeds the time budget
  try {
    const realPerf = global.performance;
    let calls = 0;
    global.performance = { now: () => (calls++ === 0 ? 0 : 1000) }; // 1000ms elapsed by first step
    const res = Compiler.runCommand("gravity = 5\nfriction = 2", (typeof window !== 'undefined' && window.Game) ? window.Game : {});
    global.performance = realPerf;
    assertEquals(false, res.success, "an over-time run should fail gracefully");
    assertEquals(true, /too long/i.test(res.msg), "the message should explain the run took too long");
    renderTestResult("solar-suite", "Safety: wall-clock guard halts a too-slow run", true);
  } catch (err) {
    renderTestResult("solar-suite", "Safety: wall-clock guard halts a too-slow run", false, err.message);
  }
}

// Suite: Wave 4 hazards & health (damage model, meteor event, shelter)
function runHazardTests() {
  const SUITE = "hazard-suite";

  // H1: damagePlayer chips a heart, starts i-frames, and i-frames block a repeat hit
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = new Player(0, 0);
    game.reducedMotion = true;
    assertEquals(3, game.player.health, "Player starts at 3 hearts");
    game.damagePlayer(1, 'debris', 100);
    assertEquals(2, game.player.health, "A hit drops one heart");
    assertEquals(true, game.player.invulnerableFrames > 0, "A hit starts i-frames");
    game.damagePlayer(1, 'debris', 100);
    assertEquals(2, game.player.health, "A second hit during i-frames is ignored");
    renderTestResult(SUITE, "Health: damagePlayer chips a heart + i-frames block re-hit", true);
  } catch (err) {
    renderTestResult(SUITE, "Health: damagePlayer chips a heart + i-frames block re-hit", false, err.message);
  }

  // H2: draining to zero health ends the run (routes to killPlayer → gameover)
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = new Player(0, 0);
    game.reducedMotion = true;
    for (let i = 0; i < 3; i++) { game.player.invulnerableFrames = 0; game.damagePlayer(1, 'enemy'); }
    assertEquals(0, game.player.health, "Three hits empty the health bar");
    assertEquals('gameover', game.state, "Zero health → gameover");
    renderTestResult(SUITE, "Health: zero hearts ends the run", true);
  } catch (err) {
    renderTestResult(SUITE, "Health: zero hearts ends the run", false, err.message);
  }

  // H3: meteor-shower phase machine (idle→warning→active→cooldown→idle)
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = new Player(64, 250);
    game.currentPlanet = PLANETS[1];
    game.currentVariant = { map: PLANETS[1].map };
    game.currentPlanetIndex = 1;
    game.cameraX = 0;
    game.meteors = []; game.meteorPhase = 'idle';
    game.triggerMeteorShower();
    assertEquals('warning', game.meteorPhase, "Trigger enters the warning phase");
    game.meteorWarnTimer = 1; game.updateMeteors();
    assertEquals('active', game.meteorPhase, "Warning elapses → active");
    game.meteorActiveTimer = 1; game.updateMeteors();
    assertEquals('cooldown', game.meteorPhase, "Active elapses → cooldown");
    game.meteorCooldownTimer = 1; game.updateMeteors();
    assertEquals('idle', game.meteorPhase, "Cooldown elapses → idle");
    renderTestResult(SUITE, "Meteor: warning→active→cooldown→idle phases", true);
  } catch (err) {
    renderTestResult(SUITE, "Meteor: warning→active→cooldown→idle phases", false, err.message);
  }

  // H4: isSheltered = a NEARBY overhang protects; the far ceiling border does NOT
  // (levels have a solid row-0 border — it must not make every spot "sheltered").
  try {
    const game = new StarHopperGame();
    const map = [
      [1, 1, 1, 1],   // row 0: solid ceiling border, like real levels
      [0, 0, 0, 0],
      [0, 1, 0, 0],   // row 2: an interior platform over column 1
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [1, 1, 1, 1],   // floor
    ];
    game.currentPlanet = { map }; game.currentVariant = { map };
    const underOverhang = { x: TILE_SIZE * 1, y: TILE_SIZE * 5, w: 20, h: 20 }; // col1, below the row-2 platform
    const openFarCeiling = { x: TILE_SIZE * 3, y: TILE_SIZE * 9, w: 20, h: 20 }; // col3, only the far ceiling above
    assertEquals(true, game.isSheltered(underOverhang), "A nearby overhang = sheltered");
    assertEquals(false, game.isSheltered(openFarCeiling), "Only the far ceiling border = exposed");
    renderTestResult(SUITE, "Meteor: shelter = nearby overhang, not the far ceiling", true);
  } catch (err) {
    renderTestResult(SUITE, "Meteor: shelter = nearby overhang, not the far ceiling", false, err.message);
  }
}

// Suite: Wave 5 combat + fuel economy
function runCombatTests() {
  const SUITE = "combat-suite";

  // C1: unarmed can't fire; equipping a blaster lets a held F spawn a projectile
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = new Player(0, 0);
    game.currentPlanet = PLANETS[0]; game.currentVariant = { map: PLANETS[0].map };
    game.enemies = []; game.mobs = []; game.projectiles = [];
    game.keys = { f: true }; game.shootCooldown = 0;
    game.updateCombat();
    assertEquals(0, game.projectiles.length, "Unarmed cadet cannot fire");
    game.equipWeapon('blaster');
    assertEquals('blaster', game.player.weapon, "equipWeapon arms the cadet");
    game.shootCooldown = 0; game.updateCombat();
    // Firing sets the cooldown (the projectile itself may instantly hit the border tile at origin).
    assertEquals(true, game.shootCooldown > 0, "Armed: holding F fires (cooldown set)");
    renderTestResult(SUITE, "Weapons: unarmed can't fire; blaster unlocks shooting", true);
  } catch (err) {
    renderTestResult(SUITE, "Weapons: unarmed can't fire; blaster unlocks shooting", false, err.message);
  }

  // C2: a shot that overlaps an enemy kills it and grants XP
  try {
    const game = new StarHopperGame();
    game.state = 'playing';
    game.player = new Player(0, 0); game.player.weapon = 'blaster';
    game.currentPlanetIndex = 0; game.currentPlanet = PLANETS[0]; game.currentVariant = { map: PLANETS[0].map };
    game.mobs = []; game.keys = {}; game.totalXP = 0; game.masteryMeters = {};
    const e = new Enemy(100, 100, 'bug'); game.enemies = [e];
    game.projectiles = [new Projectile(e.x + e.w / 2, e.y + e.h / 2, 1)];
    game.updateCombat();
    assertEquals(0, game.enemies.length, "Shot kills a 1-hp enemy");
    assertEquals(true, (game.totalXP || 0) > 0, "Killing an enemy grants XP");
    renderTestResult(SUITE, "Combat: shots kill enemies and grant XP", true);
  } catch (err) {
    renderTestResult(SUITE, "Combat: shots kill enemies and grant XP", false, err.message);
  }

  // C2b: a projectile does not time out early or die on a wall; it travels to the map edge
  try {
    const map = Array.from({ length: 5 }, () => new Array(20).fill(0));
    map[2][4] = 1; // old behavior killed bullets on this wall
    const p = new Projectile(2 * TILE_SIZE, 2 * TILE_SIZE + 12, 7);
    for (let i = 0; i < 70; i++) p.update(map);
    assertEquals(false, p.dead, "Projectile continues past old 60-frame/wall limit");
    for (let i = 0; i < 200 && !p.dead; i++) p.update(map);
    assertEquals(true, p.dead, "Projectile despawns at the scene edge");
    renderTestResult(SUITE, "Combat: bullets travel to the scene edge", true);
  } catch (err) {
    renderTestResult(SUITE, "Combat: bullets travel to the scene edge", false, err.message);
  }

  // C2c: Survival mode uses a faster, drum-backed chiptune and restores the planet track.
  let oldMasterVolumeSettingC2c = null;
  try {
    oldMasterVolumeSettingC2c = typeof localStorage !== 'undefined' ? localStorage.getItem('sh-master-volume') : null;
    if (typeof localStorage !== 'undefined') localStorage.setItem('sh-master-volume', '0.35');
    const s = new SoundEngine();
    s.isMuted = true; // state test only; no AudioContext needed.
    assertEquals(35, s.getMasterVolumePercent(), "Master volume loads from local storage");
    assertEquals(1, s.setMasterVolume(1.4), "Master volume clamps high values");
    assertEquals("1.00", localStorage.getItem('sh-master-volume'), "Master volume persists normalized high clamp");
    assertEquals(0, s.setMasterVolume(-0.2), "Master volume clamps low values");
    assertEquals("0.00", localStorage.getItem('sh-master-volume'), "Master volume persists normalized low clamp");
    assertEquals(60, Math.round(s.setMasterVolume(0.6, false) * 100), "Master volume can update without persisting during setup sync");
    assertEquals("0.00", localStorage.getItem('sh-master-volume'), "Non-persistent volume updates leave storage alone");
    const earth = s.getTrackPattern(0);
    const survival = s.getTrackPattern('survival');
    const budget = s.getTrackPattern(6);
    const acid = s.getTrackPattern(7);
    assertEquals(true, survival.tempo < earth.tempo, "Survival pattern should beat faster than Earth BGM");
    assertEquals(true, !!survival.drums, "Survival pattern should include a drum layer");
    assertEquals("Survival Rush", s.getTrackName('survival'), "Survival track has a HUD-friendly name");
    assertEquals("Budget Master", s.getTrackName(6), "Budget Master track is selectable");
    assertEquals("Acid Craft", s.getTrackName(7), "Acid Craft track is selectable");
    assertEquals(true, !!budget.drums && !!acid.drums, "New original tracks include beat layers");
    s.startBGM(2);
    assertEquals(2, s.currentBgm, "Planet track starts normally");
    s.startSurvivalBGM();
    assertEquals('survival', s.currentBgm, "Survival mode swaps to the battle groove");
    assertEquals(2, s.preSurvivalBgm, "Previous planet track is remembered");
    s.stopSurvivalBGM();
    assertEquals(2, s.currentBgm, "Turning survival off restores the planet track");
    if (typeof localStorage !== 'undefined') {
      if (oldMasterVolumeSettingC2c === null) localStorage.removeItem('sh-master-volume');
      else localStorage.setItem('sh-master-volume', oldMasterVolumeSettingC2c);
    }
    renderTestResult(SUITE, "Music: survival mode raises beat intensity", true);
  } catch (err) {
    if (typeof localStorage !== 'undefined') {
      if (oldMasterVolumeSettingC2c === null) localStorage.removeItem('sh-master-volume');
      else localStorage.setItem('sh-master-volume', oldMasterVolumeSettingC2c);
    }
    renderTestResult(SUITE, "Music: survival mode raises beat intensity", false, err.message);
  }

  // C2d: the drill mines a solid block into inventory, then places a stackable crate.
  try {
    const g = new StarHopperGame();
    g.state = 'playing';
    g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,1,0,0,0],
        [1,1,1,1,1,1]
      ]
    };
    g.player = new Player(50, 64);
    g.player.facing = 1;
    g.spawnedBoxes = [];
    g.minedBlocks = 0;
    assertEquals(true, g.tryDrillMine(), "Drill mines the facing solid tile");
    assertEquals(0, g.getActiveMap()[2][2], "Drilled tile is carved from the map");
    assertEquals(1, g.minedBlocks, "Mining adds one block to inventory");
    assertEquals(true, g.tryPlaceMinedBlock(), "Drill places one mined block when no tile is in reach");
    assertEquals(1, g.spawnedBoxes.length, "Placed block becomes a spawned crate");
    assertEquals(0, g.minedBlocks, "Placing consumes one mined block");
    renderTestResult(SUITE, "Drill: mines terrain and places stackable blocks", true);
  } catch (err) {
    renderTestResult(SUITE, "Drill: mines terrain and places stackable blocks", false, err.message);
  }

  // C2e: drill mining/building creates a one-time discovery reward per world action.
  try {
    const g = new StarHopperGame();
    g.state = 'playing';
    g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,1,0,0,0],
        [1,1,1,1,1,1]
      ]
    };
    g.player = new Player(50, 64);
    g.player.facing = 1;
    g.spawnedBoxes = [];
    g.minedBlocks = 0;
    g.researchXP = 0;
    g.masteryMeters = {};
    g.discoveryLog = [];
    g.discoveryPassCounts = {};

    assertEquals(true, g.tryDrillMine(), "Drill mine action succeeds");
    assertEquals(2, g.researchXP, "First drill mine awards focused Research XP");
    assertEquals(6, g.getWorldMasteryProgress(0).xp, "First drill mine adds world mastery XP");
    assertEquals("Geology Sample", g.discoveryPulse && g.discoveryPulse.title, "Mine reward creates a geology discovery pulse");
    assertEquals("GEOLOGY SAMPLE", g.discoveryPulse && g.discoveryPulse.drillProof && g.discoveryPulse.drillProof.label, "Mine reward exposes a Discovery Pulse chip");
    assertEquals("DRILL LAB", g.missionBalloon && g.missionBalloon.title, "Mine reward uses the mission monitor");
    assertEquals("GEOLOGY SAMPLE: +2 Research XP", g.missionBalloon && g.missionBalloon.text, "Mine reward announces the XP payoff");
    assertEquals(1, g.discoveryPassCounts[g.getDrillDiscoverySourceKey('mine')], "Mine reward stores its one-time source");
    const afterMineXP = g.researchXP;
    assertEquals(null, g.grantDrillDiscoveryReward('mine', { blocks: 2 }), "Repeating the mine reward is blocked");
    assertEquals(afterMineXP, g.researchXP, "Repeated mine reward does not farm XP");

    assertEquals(true, g.tryPlaceMinedBlock(), "Drill stack action succeeds");
    assertEquals(5, g.researchXP, "First drill placement awards its own Research XP");
    assertEquals(16, g.getWorldMasteryProgress(0).xp, "First drill placement adds world mastery XP");
    assertEquals("Build Loop Proof", g.discoveryPulse && g.discoveryPulse.title, "Placement reward creates a build-loop discovery pulse");
    assertEquals("BUILD LOOP PROOF", g.discoveryPulse && g.discoveryPulse.drillProof && g.discoveryPulse.drillProof.label, "Placement reward exposes a Discovery Pulse chip");
    assertEquals("BUILD LOOP PROOF: +3 Research XP", g.missionBalloon && g.missionBalloon.text, "Placement reward announces the XP payoff");
    assertEquals(1, g.discoveryPassCounts[g.getDrillDiscoverySourceKey('place')], "Placement reward stores its one-time source");
    const afterPlaceXP = g.researchXP;
    assertEquals(null, g.grantDrillDiscoveryReward('place', { blocks: 0 }), "Repeating the placement reward is blocked");
    assertEquals(afterPlaceXP, g.researchXP, "Repeated placement reward does not farm XP");
    renderTestResult(SUITE, "Drill: mining and stacking create one-time lab rewards", true);
  } catch (err) {
    renderTestResult(SUITE, "Drill: mining and stacking create one-time lab rewards", false, err.message);
  }

  // C3: XP accrues to the per-world mastery meter and levels the weapon
  const oldBubblePopC3 = ComicBubbles.pop;
  const oldParticleBurstC3 = Particles.spawnBurst;
  try {
    const bubbleLabelsC3 = [];
    const particleColorsC3 = [];
    ComicBubbles.pop = (x, y, text) => { bubbleLabelsC3.push(text); };
    Particles.spawnBurst = (x, y, color) => { particleColorsC3.push(color); };

    const game = new StarHopperGame();
    game.player = new Player(0, 0); game.currentPlanetIndex = 0; game.masteryMeters = {};
    game.weaponLevel = 1; game.totalXP = 0;
    game.addXP(50);
    assertEquals(2, game.weaponLevel, "45+ XP reaches weapon level 2");
    assertEquals(true, (game.masteryMeters[0].xp || 0) >= 50, "XP fills the per-world mastery meter");
    assertEquals(true, game.masteryMeters[0].badges.includes("scout"), "World mastery awards the first tier badge at 50 XP");
    assertEquals(true, game.earnedBadges.has("world-0-scout"), "World mastery tier badge is tracked idempotently");
    assertEquals("WORLD TIER!", game.lastWorldMasteryTierEffect.label, "World mastery tier crossing should create an in-level cue");
    assertEquals("Signal Scout", game.lastWorldMasteryTierEffect.tierLabel, "World mastery cue should name the earned tier");
    assertEquals(true, bubbleLabelsC3.some(label => /WORLD TIER!/.test(label)), "World mastery tier should pop near the player");
    assertEquals(true, particleColorsC3.some(color => color === "#38bdf8"), "World mastery tier should spawn a blue reward burst");
    const tierCueCountC3 = bubbleLabelsC3.filter(label => /WORLD TIER!/.test(label)).length;
    game.addXP(1);
    assertEquals(tierCueCountC3, bubbleLabelsC3.filter(label => /WORLD TIER!/.test(label)).length, "More XP without a new tier should not repeat the tier cue");
    assertEquals("WORLD +1 XP", game.lastWorldMasteryXPEffect.label, "Non-tier mastery progress should still create an in-level XP cue");
    assertEquals("combat practice", game.lastWorldMasteryXPEffect.reason, "World XP cue should remember why mastery increased");
    assertEquals(true, bubbleLabelsC3.some(label => /WORLD \+1 XP/.test(label)), "Non-tier mastery XP should pop near the player");
    assertEquals(true, particleColorsC3.some(color => color === "#67e8f9"), "Non-tier mastery XP should spawn a cyan reward burst");
    ComicBubbles.pop = oldBubblePopC3;
    Particles.spawnBurst = oldParticleBurstC3;
    renderTestResult(SUITE, "XP: fills mastery meter + levels the weapon", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePopC3;
    Particles.spawnBurst = oldParticleBurstC3;
    renderTestResult(SUITE, "XP: fills mastery meter + levels the weapon", false, err.message);
  }

  // C4: a powered jump burns fuel; a lighter suit burns less (mass reduction = less fuel)
  try {
    // Both are Rovers (star) so the airborne branch is a fuel-free glide — isolating the
    // jump cost. update() syncs mass from game.starMass, so set it via the stub.
    const mkStub = (p, m) => ({ getCurrentGravity: () => 0.6, starMass: m, hopperMass: 2.5, player: p });
    const heavy = new Player(0, 0); heavy.charType = 'star'; heavy.jumpPower = 40; heavy.fuel = 100; heavy.onGround = true;
    const light = new Player(0, 0); light.charType = 'star'; light.jumpPower = 40; light.fuel = 100; light.onGround = true;
    heavy.update({ ' ': true }, PLANETS[0], mkStub(heavy, 3));
    light.update({ ' ': true }, PLANETS[0], mkStub(light, 1));
    const heavyBurn = 100 - heavy.fuel, lightBurn = 100 - light.fuel;
    assertEquals(true, heavyBurn > 0, "A powered jump burns fuel");
    assertEquals(true, lightBurn < heavyBurn, "Lower mass burns less fuel");
    renderTestResult(SUITE, "Fuel: powered jumps cost fuel, cheaper at lower mass", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: powered jumps cost fuel, cheaper at lower mass", false, err.message);
  }

  // C5: antigravity stops lifting when the fuel tank is empty (no free floating)
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.player = new Player(0, 0);
    Compiler.env.antigravity = 0.3;
    game.player.fuel = 50; const lifted = game.getCurrentGravity();
    game.player.fuel = 0;  const empty = game.getCurrentGravity();
    assertEquals(true, empty > lifted, "Empty tank → antigravity no longer reduces gravity");
    renderTestResult(SUITE, "Fuel: antigravity needs fuel (no free floating)", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: antigravity needs fuel (no free floating)", false, err.message);
  }

  // C5b: Agility reflects the COMMANDED design, NOT live thruster fuel — so an engineered
  // Agility doesn't collapse (and the gate stay fair) when the thruster drains mid-flight.
  // The physics gravity must STILL fuel-gate (the C5 mechanic is preserved).
  try {
    Compiler.reset();
    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0]; game.currentPlanetIndex = 0;
    game.player = new Player(0, 0); game.player.charType = 'hopper'; game.player.mass = 2;
    Compiler.env.antigravity = 0.4;                       // commanded antigravity (engineering lever)
    game.player.fuel = 100; const agiFull = game.getAgility();
    game.player.fuel = 0;   const agiEmpty = game.getAgility();
    assertEquals(true, agiFull > 0 && Math.abs(agiFull - agiEmpty) < 1e-9, "Agility is unchanged when the thruster empties");
    // Physics gravity still loses antigravity on an empty tank (C5 mechanic intact).
    game.player.fuel = 100; const gLift = game.getCurrentGravity();
    game.player.fuel = 0;   const gEmpty = game.getCurrentGravity();
    assertEquals(true, gEmpty > gLift, "Physics gravity still fuel-gates antigravity");
    renderTestResult(SUITE, "Agility: uses commanded design gravity (stable when out of fuel)", true);
  } catch (err) {
    renderTestResult(SUITE, "Agility: uses commanded design gravity (stable when out of fuel)", false, err.message);
  }

  // C5c: Earth cycles between night and day values for the sky overlay.
  try {
    const g = new StarHopperGame();
    const night = g.getEarthDayNightPhase(0);
    const day = g.getEarthDayNightPhase(32000);
    assertEquals(true, day.daylight > night.daylight, "Halfway through the cycle is brighter than midnight");
    assertEquals(false, night.isDay, "Cycle start is night");
    assertEquals(true, day.isDay, "Cycle midpoint is day");
    renderTestResult(SUITE, "Earth: day/night sky phase cycles", true);
  } catch (err) {
    renderTestResult(SUITE, "Earth: day/night sky phase cycles", false, err.message);
  }

  // C6: bumping a breakable block (tile 10) carves it out of the world
  try {
    const game = new StarHopperGame();
    game.currentPlanetIndex = 0; game.currentPlanet = PLANETS[0];
    game.currentVariant = { map: PLANETS[0].map.map((row) => row.slice()) }; // deep copy (don't mutate source)
    game.player = new Player(0, 0); game.interactiveObjects = []; game.mobs = [];
    const m = game.getActiveMap();
    m[3][5] = 10;
    game.breakBlock(3, 5);
    assertEquals(0, m[3][5], "Breaking a block carves the tile to empty");
    renderTestResult(SUITE, "Blocks: bumping a breakable carves it out", true);
  } catch (err) {
    renderTestResult(SUITE, "Blocks: bumping a breakable carves it out", false, err.message);
  }

  // C7: placeBreakableBlocks scatters breakable tiles into the map
  try {
    const game = new StarHopperGame();
    game.currentPlanetIndex = 0; game.retryAttempt = 0; game.currentPlanet = PLANETS[0];
    game.currentVariant = { map: PLANETS[0].map.map((row) => row.slice()) };
    game.placeBreakableBlocks();
    let tens = 0; game.getActiveMap().forEach((row) => row.forEach((v) => { if (v === 10) tens++; }));
    assertEquals(true, tens >= 1, "placeBreakableBlocks adds at least one breakable block");
    renderTestResult(SUITE, "Blocks: placement scatters breakable tiles", true);
  } catch (err) {
    renderTestResult(SUITE, "Blocks: placement scatters breakable tiles", false, err.message);
  }

  // C8: a woken mob is tougher (hp >= 2) and flagged
  try {
    const game = new StarHopperGame();
    game.currentPlanetIndex = 2; game.currentPlanet = PLANETS[2]; game.mobs = [];
    game.wakeMob(100, 100);
    assertEquals(1, game.mobs.length, "wakeMob adds a mob");
    assertEquals(true, game.mobs[0].hp >= 2, "Woken mob is tougher (hp >= 2)");
    assertEquals(true, game.mobs[0].woken === true, "Woken mob is flagged");
    renderTestResult(SUITE, "Mobs: woken mob has HP and is flagged", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: woken mob has HP and is flagged", false, err.message);
  }

  // C9: a hog lines up and starts a charge; a blob bounces on the ground (species behaviors)
  try {
    const map = PLANETS[0].map;
    const hog = new Mob(200, 200, 'hog', '#9a6b4f', 1);
    hog.onGround = true; hog.behaviorTimer = 0;
    const hogPlayer = { x: 200 + TILE_SIZE * 3, y: 200 };
    hog.update(map, hogPlayer, false);
    assertEquals(true, hog.windupTimer > 0, "Hog telegraphs (winds up) before charging");
    for (let i = 0; i < 24; i++) hog.update(map, hogPlayer, false);
    assertEquals(true, hog.charging > 0, "Hog charges once the wind-up finishes");

    const blob = new Mob(100, 96, 'blob', '#a78bfa', 1);
    blob.onGround = true;
    blob.update(map, { x: 150, y: 96 }, false);
    assertEquals(true, blob.vy < 0, "Blob bounces (hops) on the ground");
    renderTestResult(SUITE, "Mobs: per-species behaviors (hog wind-up→charge, blob bounce)", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: per-species behaviors (hog charge, blob bounce)", false, err.message);
  }

  // C9b: rave mode scares wild mobs away from the cadet instead of letting them keep charging.
  try {
    const g = new StarHopperGame();
    g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    const map = Array.from({ length: 6 }, () => new Array(20).fill(0));
    map[5].fill(1);
    g.currentVariant = { map };
    g.player = new Player(96, 128);
    const mob = new Mob(160, 128, 'hog', '#9a6b4f', 1);
    mob.speed = 0.8; mob.behaviorTimer = 999;
    g.mobs = [mob];
    g.raveImmuneTimer = 60;
    g.updateMobs();
    assertEquals(true, mob.scaredTimer > 0, "Rave mode marks the mob as scared");
    assertEquals(1, mob.dir, "Mob flees away from a cadet standing to its left");
    renderTestResult(SUITE, "Mobs: rave mode scares wild mobs", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: rave mode scares wild mobs", false, err.message);
  }

  // C9c: after buying calming lotion, scared small mobs can become pets and protect the cadet.
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    const map = Array.from({ length: 6 }, () => new Array(20).fill(0));
    map[5].fill(1);
    g.currentVariant = { map };
    g.player = new Player(100, 128);
    g.unlockedTools = new Set(['taming_lotion']);
    g.researchXP = 0;
    g.masteryMeters = {};
    g.discoveryPassCounts = {};
    const tameable = new Mob(134, 128, 'blob', '#a78bfa', 1);
    tameable.speed = 0; tameable.behaviorTimer = 999;
    g.mobs = [tameable];
    g.raveImmuneTimer = 60;
    g.updateMobs();
    assertEquals(1, g.mobs.length, "Taming keeps the mob in the scene");
    assertEquals(true, g.mobs[0].pet, "Calming lotion tames the scared small mob");
    assertEquals(3, g.researchXP, "First pet tame awards Research XP");
    assertEquals(7, g.getWorldMasteryProgress(0).xp, "First pet tame adds world mastery XP");
    assertEquals("Pet Pact", g.discoveryPulse && g.discoveryPulse.title, "Taming creates a pet pact pulse");
    assertEquals("PET PACT", g.discoveryPulse && g.discoveryPulse.petProof && g.discoveryPulse.petProof.label, "Taming exposes a pet proof chip");
    assertEquals(true, g.discoveredFormulaKinds.has("state"), "Taming a scared mob collects the AI State Lab card");
    assertEquals(1, g.formulaCardEffects.length, "AI State Lab card unlock spawns one formula card effect");
    assertEquals("AI State Lab", g.formulaCardEffects[0].title, "AI State Lab card effect names the state-machine concept");
    assertEquals("state + event -> next state", g.formulaCardEffects[0].formula, "AI State Lab card effect shows the state transition formula");
    assertEquals(`CARD 1/${DISCOVERY_RULES.length}`, g.formulaCardEffects[0].deckLabel, "AI State Lab card effect advances the formula deck");
    assertEquals("PET LAB", g.missionBalloon && g.missionBalloon.title, "Pet proof uses the mission monitor");
    assertEquals("PET PACT: +3 Research XP", g.missionBalloon && g.missionBalloon.text, "Pet proof announces the XP payoff");
    assertEquals(1, g.discoveryPassCounts[g.getPetBondProofSourceKey('tame')], "Pet pact stores its one-time source");
    assertEquals(null, g.grantPetBondProof('tame', g.mobs[0]), "Repeating the pet pact is blocked");
    assertEquals(3, g.researchXP, "Repeated pet pact does not farm Research XP");

    const beforeHealth = g.player.health;
    const pet = g.mobs[0];
    pet.x = 112; pet.y = 128; pet.speed = 0; pet.behaviorTimer = 999; pet.attackCooldown = 0;
    const hostile = new Mob(102, 128, 'hog', '#9a6b4f', 1);
    hostile.hp = 1; hostile.woken = true; hostile.speed = 0; hostile.behaviorTimer = 999;
    g.raveImmuneTimer = 0;
    g.mobs = [hostile, pet];
    g.updateMobs();
    assertEquals(1, g.mobs.length, "Pet removes the nearby hostile mob");
    assertEquals(true, g.mobs[0].pet, "The surviving mob is the trained pet");
    assertEquals(beforeHealth, g.player.health, "Pet protection prevents contact damage");
    assertEquals(7, g.researchXP, "First pet guard awards Research XP");
    assertEquals(21, g.getWorldMasteryProgress(0).xp, "Pet guard proof and woken-mob practice add mastery XP");
    assertEquals("Pet Guard Proof", g.discoveryPulse && g.discoveryPulse.title, "Pet protection creates a guard proof pulse");
    assertEquals("GUARD PROOF", g.discoveryPulse && g.discoveryPulse.petProof && g.discoveryPulse.petProof.label, "Pet protection exposes a guard proof chip");
    assertEquals(3, g.getVillageTrustProgress(0).points, "Pet guard proof adds village trust");
    assertEquals("Trading Friend", g.getVillageTrustProgress(0).title, "Pet guard proof reaches the first village trust tier");
    assertEquals("TRUST UP", g.discoveryPulse && g.discoveryPulse.villageTrust && g.discoveryPulse.villageTrust.label, "Pet guard proof exposes a village trust chip");
    assertEquals("GUARD PROOF: +4 Research XP", g.missionBalloon && g.missionBalloon.text, "Guard proof announces the XP payoff");
    assertEquals(1, g.discoveryPassCounts[g.getPetBondProofSourceKey('guard')], "Guard proof stores its one-time source");
    assertEquals(1, g.formulaCardEffects.length, "Guard proof does not duplicate the AI State Lab card after taming unlocked it");
    assertEquals(null, g.grantPetBondProof('guard', pet), "Repeating the guard proof is blocked");
    assertEquals(7, g.researchXP, "Repeated guard proof does not farm Research XP");
    assertEquals(3, g.getVillageTrustProgress(0).points, "Repeated guard proof does not farm village trust");
    renderTestResult(SUITE, "Mobs: lotion tames pets that protect the cadet", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: lotion tames pets that protect the cadet", false, err.message);
  }

  // C10: reversing direction on the ground brakes harder than normal accel (snappy turns)
  try {
    const p = new Player(0, 0); p.charType = 'star'; p.onGround = true; p.vx = 4;
    const stub = { getCurrentGravity: () => 0.6, starMass: 1, hopperMass: 2.5, player: p };
    p.update({ 'ArrowLeft': true }, PLANETS[0], stub); // moving right (vx=4), pressing left
    assertEquals(true, p.vx < 4 - 0.5, "Reversing decelerates faster than the base 0.5 accel");
    renderTestResult(SUITE, "Movement: reversing triggers a snappy skid", true);
  } catch (err) {
    renderTestResult(SUITE, "Movement: reversing triggers a snappy skid", false, err.message);
  }

  // C10b: a jump pressed a few frames before landing buffers and fires on touchdown.
  try {
    Compiler.reset();
    const p = new Player(0, 60);
    p.charType = 'star';
    p.onGround = false;
    p.coyoteFrames = 0;
    p.vy = 4;
    p.jumpPower = 15;
    const stub = { getCurrentGravity: () => 0.6, starMass: 1, hopperMass: 2.5, player: p };
    p.update({ ' ': true }, PLANETS[0], stub);
    assertEquals(true, p.jumpBufferFrames > 0, "Airborne jump press is stored in the buffer");
    assertEquals(true, p.vy > 0, "Buffered airborne press does not jump before landing");
    p.onGround = true;
    p.isJumping = false;
    assertEquals(true, p.consumeJumpBuffer(PLANETS[0], stub), "Landing consumes the buffered jump");
    assertEquals(false, p.onGround, "Buffered jump immediately launches off the ground");
    assertEquals(true, p.vy < 0, "Buffered jump creates upward velocity");
    assertEquals(0, p.jumpBufferFrames, "Buffered jump clears the stored input");

    const g = new StarHopperGame();
    const map = [
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [1,1,1,1,1,1]
    ];
    g.state = 'playing';
    g.currentPlanetIndex = 0;
    g.currentPlanet = PLANETS[0];
    g.currentVariant = { map };
    g.canvas = { width: 720, height: 448 };
    g.player = new Player(64, 60);
    g.player.charType = 'star';
    g.player.onGround = false;
    g.player.coyoteFrames = 0;
    g.player.vy = 6;
    g.starMass = 1;
    g.hopperMass = 2.5;
    g.keys = { ' ': true };
    g.interactiveObjects = [];
    g.enemies = [];
    g.spawnedBoxes = [];
    g.mobs = [];
    g.debris = [];
    g.meteors = [];
    g.update();
    assertEquals(false, g.player.onGround, "Frame loop consumes the buffer right after landing collision");
    assertEquals(true, g.player.vy < 0, "Frame loop launches from a just-before-landing jump press");
    renderTestResult(SUITE, "Movement: jump buffer fires on landing", true);
  } catch (err) {
    renderTestResult(SUITE, "Movement: jump buffer fires on landing", false, err.message);
  }

  // C11: contact knockback scales with the attacker (a charging hog flings you farther)
  try {
    Compiler.reset(); // clean env so getCurrentGravity uses Earth's gravity (gf = 1)
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanet = PLANETS[0];
    const mk = () => { const p = new Player(100, 100); p.facing = 1; return p; };
    g.player = mk(); g.player.invulnerableFrames = 0; g.damagePlayer(1, 'mob', 200, 1.0);
    const soft = Math.abs(g.player.vx);
    g.player = mk(); g.player.invulnerableFrames = 0; g.damagePlayer(1, 'mob', 200, 2.4);
    const hard = Math.abs(g.player.vx);
    assertEquals(true, hard > soft + 1, "Higher knockback flings the cadet farther");
    renderTestResult(SUITE, "Contact: knockback scales with the attacker", true);
  } catch (err) {
    renderTestResult(SUITE, "Contact: knockback scales with the attacker", false, err.message);
  }

  // C12: knockback is scaled by world gravity so low-G worlds don't fling cadets off-map
  try {
    Compiler.reset();
    const earth = new StarHopperGame(); earth.state = 'playing'; earth.currentPlanet = PLANETS[0];
    earth.player = new Player(100, 100); earth.player.facing = 1; earth.player.invulnerableFrames = 0;
    earth.damagePlayer(1, 'mob', 200, 1.5); const earthKb = Math.abs(earth.player.vx);
    Compiler.reset();
    const moon = new StarHopperGame(); moon.state = 'playing'; moon.currentPlanet = PLANETS[1]; // low gravity
    moon.player = new Player(100, 100); moon.player.facing = 1; moon.player.invulnerableFrames = 0;
    moon.damagePlayer(1, 'mob', 200, 1.5); const moonKb = Math.abs(moon.player.vx);
    assertEquals(true, moonKb < earthKb, "A low-gravity world gives a gentler knockback");
    renderTestResult(SUITE, "Contact: knockback scaled by world gravity (no off-map fling)", true);
  } catch (err) {
    renderTestResult(SUITE, "Contact: knockback scaled by world gravity (no off-map fling)", false, err.message);
  }

  // C13: debris bounces off a solid tile instead of phasing through it
  try {
    const map = [[0, 0, 0, 1, 0, 0]]; // solid wall at column 3 (x 96..128)
    const d = new Debris(84, 4, 4, 0, 16); // right edge 100, moving right into the wall
    d.update(map);
    assertEquals(true, d.vx < 0, "Debris reflects (bounces) off a solid tile");
    renderTestResult(SUITE, "Debris: bounces off solid surfaces", true);
  } catch (err) {
    renderTestResult(SUITE, "Debris: bounces off solid surfaces", false, err.message);
  }

  // C14: a meteor shatters a suspended breakable block (tile 10)
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 2; g.currentPlanet = PLANETS[2];
    g.currentVariant = { map: PLANETS[2].map.map((r) => r.slice()) };
    g.player = new Player(0, 0); g.interactiveObjects = []; g.mobs = [];
    const map = g.getActiveMap();
    map[5][6] = 10; // suspended block
    g.meteors = [new Meteor(6 * TILE_SIZE, 5 * TILE_SIZE - 6, 0, 4)]; // falling right onto it
    g.meteorPhase = 'active'; g.meteorActiveTimer = 60;
    for (let i = 0; i < 12 && map[5][6] === 10; i++) g.updateMeteors();
    assertEquals(0, map[5][6], "Meteor shatters the suspended breakable block");
    renderTestResult(SUITE, "Meteor: shatters suspended breakable blocks", true);
  } catch (err) {
    renderTestResult(SUITE, "Meteor: shatters suspended breakable blocks", false, err.message);
  }

  // C14b: a meteor hit damages/kills mobs, not just the cadet and terrain
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 2; g.currentPlanet = PLANETS[2];
    g.currentVariant = { map: Array.from({ length: 8 }, () => new Array(12).fill(0)) };
    g.player = new Player(300, 120); g.enemies = []; g.interactiveObjects = [];
    const mob = new Mob(100, 100, 'blob', '#f97316', 1); mob.hp = 1;
    g.mobs = [mob];
    g.meteors = [new Meteor(100, 100, 0, 0)];
    g.meteorPhase = 'active'; g.meteorActiveTimer = 60; g.meteorSpawnTimer = 999;
    g.updateMeteors();
    assertEquals(0, g.mobs.length, "Meteor kills the overlapping mob");
    assertEquals(0, g.meteors.length, "Meteor is consumed on mob impact");
    renderTestResult(SUITE, "Meteor: shower hurts mobs", true);
  } catch (err) {
    renderTestResult(SUITE, "Meteor: shower hurts mobs", false, err.message);
  }

  // C15: speech/onomatopoeia bubbles keep fading while the world is paused (pause-to-code)
  try {
    const g = new StarHopperGame();
    g.player = new Player(0, 0);
    g.player.sayText = 'hello'; g.player.sayTimer = 100; g.player.sayReveal = 0;
    g.mobs = []; g.hurtFlashTimer = 5;
    g.tickPausedCosmetics();
    assertEquals(99, g.player.sayTimer, "Speech bubble timer ticks down while paused");
    assertEquals(4, g.hurtFlashTimer, "Hurt flash fades while paused");
    renderTestResult(SUITE, "Pause: cosmetic bubbles fade while paused", true);
  } catch (err) {
    renderTestResult(SUITE, "Pause: cosmetic bubbles fade while paused", false, err.message);
  }

  // C16: a shot busts a debris chunk apart (so you can clear it from range)
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.player = new Player(0, 0); g.currentPlanetIndex = 0;
    g.currentVariant = { map: Array.from({ length: 10 }, () => new Array(12).fill(0)) };
    g.enemies = []; g.mobs = []; g.keys = {};
    g.debris = [new Debris(100, 100, 0, 0, 16)];
    g.projectiles = [new Projectile(108, 108, 2)];
    g.updateCombat();
    assertEquals(0, g.debris.length, "A shot destroys the debris chunk");
    assertEquals(0, g.projectiles.length, "The shot is consumed by the debris hit");
    renderTestResult(SUITE, "Combat: shooting space debris destroys it", true);
  } catch (err) {
    renderTestResult(SUITE, "Combat: shooting space debris destroys it", false, err.message);
  }

  // C17: jumping on debris smashes it safely — a bounce, no health lost
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 0; // Earth: no ambient debris spawn to interfere
    g.currentVariant = { map: Array.from({ length: 10 }, () => new Array(12).fill(0)) };
    g.player = new Player(100, 92); g.player.health = 3; g.player.vy = 5; // descending onto the chunk
    g.debris = [new Debris(100, 120, 0, 0, 16)];
    g.updateDebris();
    assertEquals(0, g.debris.length, "Stomping the debris destroys it");
    assertEquals(3, g.player.health, "A stomp costs no health");
    assertEquals(true, g.player.vy < 0, "Stomping bounces the cadet back up");
    renderTestResult(SUITE, "Combat: stomping debris destroys it (no damage, bounce)", true);
  } catch (err) {
    renderTestResult(SUITE, "Combat: stomping debris destroys it (no damage, bounce)", false, err.message);
  }

  // C18: mobs can make mistakes: crater gaps are not invisible brakes, so they fall in.
  try {
    const flat   = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1]];
    const crater = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[1,1,1,1,0,0,0,0]];
    const player = { x: 6 * TILE_SIZE, y: 38 };
    const walk = (map, frames = 32) => {
      const m = new Mob(96, 38, 'bot', '#fff', 1);
      m.speed = 4; m.behaviorTimer = 999; m.scanning = false; m.onGround = true; m.dir = 1;
      let right = m.x + m.w;
      for (let i = 0; i < frames; i++) { m.update(map, player, false); right = Math.max(right, m.x + m.w); }
      return { right, y: m.y, onGround: m.onGround };
    };
    const realRand = Math.random; // suppress the random wall-hop for determinism
    let flatReach, craterReach;
    try {
      Math.random = () => 1;
      flatReach = walk(flat, 24);
      craterReach = walk(crater, 36);
    } finally {
      Math.random = realRand;
    }
    assertEquals(true, flatReach.right > 5 * TILE_SIZE, "Mob walks freely along flat ground");
    assertEquals(true, craterReach.right > 4 * TILE_SIZE + 4, "Mob crosses the crater brink instead of stopping");
    assertEquals(true, craterReach.y > 46, "Mob falls after entering the crater gap");
    renderTestResult(SUITE, "Mobs: fall into crater gaps", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: fall into crater gaps", false, err.message);
  }

  // C19: spike floors also make mobs fall instead of turning them around.
  try {
    const spikes = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[1,1,1,1,2,2,1,1]];
    const player = { x: 6 * TILE_SIZE, y: 38 };
    const m = new Mob(96, 38, 'bot', '#fff', 1);
    m.speed = 4; m.behaviorTimer = 999; m.scanning = false; m.onGround = true; m.dir = 1;
    let right = m.x + m.w;
    const realRand = Math.random;
    try {
      Math.random = () => 1;
      for (let i = 0; i < 36; i++) { m.update(spikes, player, false); right = Math.max(right, m.x + m.w); }
    } finally {
      Math.random = realRand;
    }
    assertEquals(true, right > 4 * TILE_SIZE + 4, "Mob crosses onto spike tiles instead of turning back");
    assertEquals(true, m.y > 46, "Mob falls through the spike floor");
    renderTestResult(SUITE, "Mobs: fall through spike floors", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs: fall through spike floors", false, err.message);
  }

  // C19b: when mobs or villagers actually touch spikes/crates, they take damage instead of
  // sitting safely on top of them.
  try {
    const g = new StarHopperGame();
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,2,0,0,0],
        [1,1,1,1,1,1,1,1]
      ]
    };
    g.currentPlanetIndex = 0;
    g.player = new Player(0, 0);
    const spikeMob = new Mob(4 * TILE_SIZE, 2 * TILE_SIZE, 'bot', '#fff', 1);
    spikeMob.hp = 1;
    g.mobs = [spikeMob];
    g.spawnedBoxes = [];
    assertEquals(true, g.damageMobFromHazards(0), "Spike contact kills a one-HP mob");
    assertEquals(0, g.mobs.length, "Spike-damaged mob is removed");

    const crateMob = new Mob(3 * TILE_SIZE, 64, 'bot', '#fff', 1);
    crateMob.hp = 1;
    g.mobs = [crateMob];
    g.spawnedBoxes = [new InteractiveObject(3 * TILE_SIZE, 64, 'box')];
    assertEquals(true, g.damageMobFromHazards(0), "Crate overlap hurts a one-HP mob");
    assertEquals(0, g.mobs.length, "Crate-damaged mob is removed");

    const npc = new NPC({ id: 'safe', name: 'Safe', profession: 'Tester', type: 'npc', x: 4 * TILE_SIZE, y: 2 * TILE_SIZE, color: '#fff' });
    g.interactiveObjects = [npc];
    g.spawnedBoxes = [];
    g.damageNPCFromHazards(npc);
    assertEquals(true, npc.hitFlash > 0, "Villager flashes when hurt by a spike");
    assertEquals(true, npc.health < npc.maxHealth, "Villager health is chipped");
    assertEquals(false, g.npcHasUnsafePlacement(npc.x, npc.y), "Villager is relocated to a safe spot");
    renderTestResult(SUITE, "Mobs/Villagers: hazards and crates hurt them", true);
  } catch (err) {
    renderTestResult(SUITE, "Mobs/Villagers: hazards and crates hurt them", false, err.message);
  }

  // C19c: special food restores one heart when the cadet is hurt.
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [1,1,1,1,1,1]
      ]
    };
    g.player = new Player(64, 64);
    g.canvas = { width: 720, height: 448 };
    g.player.health = 2;
    g.enemies = []; g.mobs = []; g.spawnedBoxes = []; g.spawnedSprings = []; g.projectiles = []; g.debris = []; g.meteors = [];
    g.interactiveObjects = [new InteractiveObject(60, 60, 'food')];
    g.update();
    assertEquals(3, g.player.health, "Food restores one missing heart");
    assertEquals(true, g.interactiveObjects[0].collected, "Food is consumed on pickup");
    renderTestResult(SUITE, "Food: restores cadet health", true);
  } catch (err) {
    renderTestResult(SUITE, "Food: restores cadet health", false, err.message);
  }

  // C19d: mobs can attack villagers, causing them to flee into their cave homes.
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 1; g.currentPlanet = PLANETS[1];
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1]
      ]
    };
    g.player = new Player(220, 64);
    g.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    g.activeAIStateRun = { cardId: "shelter-loop", levelIndex: 1, label: "RUN RESCUE" };
    const sentry = new NPC({ id: 'lookout', name: 'Lookout', profession: 'Guard', type: 'npc', x: 140, y: 60, color: '#cbd5e1', caveX: 108, caveY: 60 });
    const prowler = new Mob(150, 60, 'hog', '#9a6b4f', 1);
    prowler.speed = 0; prowler.behaviorTimer = 999;
    g.interactiveObjects = [sentry];
    g.mobs = [prowler];
    for (let i = 0; i < 40 && !sentry.hiddenInCave; i++) sentry.update(g);
    assertEquals(true, sentry.hiddenInCave, "Villager hides when a mob is close, before contact");
    assertEquals(0, sentry.caveExitTimer || 0, "Villager has no exit cue while still hidden from the close mob");
    g.mobs = [];
    sentry.panicTimer = 0;
    sentry.update(g);
    assertEquals(false, sentry.hiddenInCave, "Villager comes back out when nearby danger clears");
    assertEquals(true, (sentry.caveExitTimer || 0) > 0, "Villager shows a cave-exit cue when close mob danger clears");
    assertEquals(true, g.discoveredFormulaKinds.has("state"), "Village rescue collects the AI State Lab card");
    assertEquals(1, g.formulaCardEffects.length, "Village rescue spawns one AI State Lab card effect");
    assertEquals("AI State Lab", g.formulaCardEffects[0].title, "Village rescue card effect names the state-machine concept");
    assertEquals(null, g.activeAIStateRun, "Completed rescue proof clears the active AI route");
    assertEquals("AI PROOF LOGGED", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.label, "Active rescue proof adds an AI proof chip");
    assertEquals("Shelter Loop", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.title, "AI proof chip names the completed state card");
    assertEquals("2/5", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.progress, "AI proof chip shows updated deck progress");
    assertEquals("Pet Pact", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.nextTitle, "AI proof chip points to the next behavior card");
    assertEquals("pet-pact", g.lastAIStateRunProof && g.lastAIStateRunProof.nextCardId, "Logged rescue proof remembers the next AI card id");
    assertEquals("GET LOTION", g.lastAIStateRunProof && g.lastAIStateRunProof.nextActionLabel, "Logged rescue proof remembers the next AI route action");
    assertEquals("wild -> scared -> pet", g.lastAIStateRunProof && g.lastAIStateRunProof.nextState, "Logged rescue proof remembers the next AI state formula");

    const villageAlarm = new StarHopperGame();
    villageAlarm.state = 'playing'; villageAlarm.currentPlanetIndex = 1; villageAlarm.currentPlanet = PLANETS[1];
    villageAlarm.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
      ]
    };
    villageAlarm.player = new Player(0, 0);
    villageAlarm.researchXP = 0;
    villageAlarm.masteryMeters = {};
    const nearTrader = new NPC({ id: 'near-alarm', name: 'Near Alarm', profession: 'Guard', type: 'npc', x: 96, y: 60, homeX: 96, homeY: 60, caveX: 64, caveY: 60, color: '#cbd5e1' });
    const farTrader = new NPC({ id: 'far-alarm', name: 'Far Alarm', profession: 'Miner', type: 'npc', x: 360, y: 60, homeX: 360, homeY: 60, caveX: 328, caveY: 60, color: '#a7f3d0' });
    const alarmMob = new Mob(104, 60, 'hog', '#9a6b4f', 1);
    alarmMob.speed = 0; alarmMob.behaviorTimer = 999;
    villageAlarm.interactiveObjects = [nearTrader, farTrader];
    villageAlarm.mobs = [alarmMob];
    const farOwnDistance = Math.hypot((alarmMob.x + alarmMob.w / 2) - (farTrader.x + farTrader.w / 2), (alarmMob.y + alarmMob.h / 2) - (farTrader.y + farTrader.h / 2));
    assertEquals(true, farOwnDistance > villageAlarm.getVillagerThreatRadius(), "Far villager fixture starts outside its own personal mob radius");
    assertEquals(true, !!villageAlarm.getVillagerShelterSignal(farTrader).threat, "Village-wide alarm sends every villager to caves when one mob reaches the village");
    const beforeFarAlarmX = farTrader.x;
    villageAlarm.updateVillagerShelterStates();
    assertEquals(true, nearTrader.x < 96, "Near villager starts retreating from the alarm mob");
    assertEquals(true, farTrader.x < beforeFarAlarmX, "Far villager also starts retreating because the village alarm is active");
    for (let i = 0; i < 40 && !(nearTrader.hiddenInCave && farTrader.hiddenInCave); i++) villageAlarm.updateVillagerShelterStates();
    assertEquals(true, nearTrader.hiddenInCave, "Near villager reaches the cave during village alarm");
    assertEquals(true, farTrader.hiddenInCave, "Far villager reaches the cave during village alarm");
    villageAlarm.mobs = [];
    nearTrader.panicTimer = 0;
    farTrader.panicTimer = 0;
    villageAlarm.updateVillagerShelterStates();
    assertEquals(false, nearTrader.hiddenInCave, "Near villager comes back out when the village alarm clears");
    assertEquals(false, farTrader.hiddenInCave, "Far villager comes back out when the village alarm clears");

    const homeGuard = new NPC({ id: 'home-guard', name: 'Home Guard', profession: 'Guard', type: 'npc', x: 250, y: 60, color: '#cbd5e1', homeX: 250, homeY: 60, caveX: 24, caveY: 60, hiddenInCave: true });
    homeGuard.x = homeGuard.caveX + 10;
    homeGuard.panicTimer = 0;
    homeGuard.rescuePending = true;
    homeGuard.shelterReason = "nearby mob";
    g.interactiveObjects = [homeGuard];
    g.mobs = [new Mob(252, 60, 'hog', '#9a6b4f', 1)];
    g.updateVillagerShelterStates();
    assertEquals(true, homeGuard.hiddenInCave, "Hidden villager stays in cave while a mob waits near the trading spot");
    assertEquals(true, homeGuard.panicTimer > 0, "Home-area mob danger refreshes the villager shelter timer");
    g.mobs = [];
    homeGuard.panicTimer = 0;
    g.updateVillagerShelterStates();
    assertEquals(false, homeGuard.hiddenInCave, "Hidden villager leaves the cave after the home-area danger clears");
    const loopSentry = new NPC({ id: 'loop-lookout', name: 'Loop Lookout', profession: 'Guard', type: 'npc', x: 144, y: 60, color: '#cbd5e1', caveX: 108, caveY: 60 });
    loopSentry.proximity = true;
    g.activeNPC = loopSentry;
    g.interactiveObjects = [loopSentry];
    g.mobs = [new Mob(154, 60, 'hog', '#9a6b4f', 1)];
    const beforeShelterX = loopSentry.x;
    g.updateVillagerShelterStates();
    assertEquals(true, loopSentry.panicTimer > 0, "Game loop shelter pass marks a close mob as danger");
    assertEquals(true, loopSentry.x < beforeShelterX, "Game loop shelter pass starts the cave retreat immediately");
    assertEquals(true, loopSentry.rescuePending, "Close mob danger marks the villager rescue as pending");
    assertEquals(null, g.activeNPC, "Villager cannot stay trade-active while sheltering from a mob");
    for (let i = 0; i < 40 && !loopSentry.hiddenInCave; i++) g.updateVillagerShelterStates();
    assertEquals(true, loopSentry.hiddenInCave, "Game loop keeps routing a threatened villager into the cave");
    loopSentry.proximity = true;
    g.activeNPC = loopSentry;
    assertEquals(false, g.canNPCTrade(loopSentry), "Hidden villagers cannot become trade targets while sheltering");
    g.updateVillagerShelterStates();
    assertEquals(false, loopSentry.proximity, "Shelter pass clears stale cave proximity");
    assertEquals(null, g.activeNPC, "Sheltered villager cannot keep the active trade focus");
    g.mobs = [];
    loopSentry.panicTimer = 0;
    g.updateVillagerShelterStates();
    assertEquals(false, loopSentry.hiddenInCave, "Game loop brings the villager back out once close mob danger clears");

    const earlyWarning = new NPC({ id: 'early-warning', name: 'Early Warning', profession: 'Guard', type: 'npc', x: 100, y: 60, color: '#cbd5e1', homeX: 100, homeY: 60, caveX: 72, caveY: 60 });
    const outsideOldRadiusMob = new Mob(260, 60, 'hog', '#9a6b4f', 1);
    outsideOldRadiusMob.speed = 0;
    outsideOldRadiusMob.behaviorTimer = 999;
    g.interactiveObjects = [earlyWarning];
    g.mobs = [outsideOldRadiusMob];
    g.survivalMode = true;
    assertEquals(null, g.findThreateningMobForNPC(earlyWarning, 128), "Survival warning fixture starts outside the old villager danger radius");
    assertEquals(true, !!g.getVillagerShelterSignal(earlyWarning).threat, "Survival uses the wider shared warning radius before mob contact");
    const beforeEarlyWarningX = earlyWarning.x;
    g.updateVillagerShelterStates();
    assertEquals(true, earlyWarning.x < beforeEarlyWarningX, "Wider Survival warning starts the cave retreat before the mob reaches the villager");
    for (let i = 0; i < 40 && !earlyWarning.hiddenInCave; i++) g.updateVillagerShelterStates();
    assertEquals(true, earlyWarning.hiddenInCave, "Wider Survival warning still routes the villager fully into the cave");
    g.toggleSurvival();
    assertEquals(false, g.survivalMode, "Turning Survival off clears the wider warning state");
    assertEquals(false, earlyWarning.hiddenInCave, "Survival-off brings the early-warning villager back out");

    const cavePathGame = new StarHopperGame();
    cavePathGame.state = 'playing'; cavePathGame.currentPlanetIndex = 1; cavePathGame.currentPlanet = PLANETS[1];
    cavePathGame.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1]
      ]
    };
    cavePathGame.player = new Player(0, 0);
    cavePathGame.spawnedBoxes = [];
    const pathNpc = new NPC({ id: 'path-watch', name: 'Path Watch', profession: 'Miner', type: 'npc', x: 300, y: 60, homeX: 300, homeY: 60, caveX: 120, caveY: 60, color: '#cbd5e1' });
    const caveMouthMob = new Mob(128, 60, 'hog', '#9a6b4f', 1);
    caveMouthMob.speed = 0; caveMouthMob.behaviorTimer = 999;
    cavePathGame.interactiveObjects = [pathNpc];
    cavePathGame.mobs = [caveMouthMob];
    assertEquals(true, !!cavePathGame.getVillagerShelterSignal(pathNpc).threat, "A mob by the cave route counts as nearby village danger");
    const beforePathRetreatX = pathNpc.x;
    cavePathGame.updateVillagerShelterStates();
    assertEquals(true, pathNpc.x < beforePathRetreatX, "Villager starts toward the cave when a mob blocks the cave route");
    cavePathGame.mobs = [];
    pathNpc.panicTimer = 0;
    cavePathGame.updateVillagerShelterStates();
    assertEquals(false, pathNpc.hiddenInCave, "Villager can come back out once the cave-route mob clears");

    const npc = new NPC({ id: 'caver', name: 'Caver', profession: 'Miner', type: 'npc', x: 100, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60 });
    const mob = new Mob(102, 60, 'hog', '#9a6b4f', 1);
    mob.speed = 0; mob.behaviorTimer = 999;
    g.interactiveObjects = [npc];
    g.mobs = [mob];
    assertEquals(true, !!g.findThreateningMobForNPC(npc, 128), "Mob is recognized as a villager threat");
    const shelterSignal = g.getVillagerShelterSignal(npc, { radius: 128 });
    assertEquals("nearby mob", shelterSignal.reason, "Shared villager shelter signal points to close mob danger");
    assertEquals("DANGER", g.getVillagerCaveStatus(npc, shelterSignal).label, "Occupied cave marker labels active mob danger");
    assertEquals(true, g.damageNPCFromMob(npc, mob), "Mob attack damages the villager");
    assertEquals(true, npc.health < npc.maxHealth, "Villager health is chipped by mob attack");
    assertEquals(true, npc.panicTimer > 0, "Villager starts panic retreat");
    for (let i = 0; i < 40 && !npc.hiddenInCave; i++) npc.update(g);
    assertEquals(true, npc.hiddenInCave, "Villager reaches and hides inside the cave");
    npc.panicTimer = 0;
    npc.update(g);
    assertEquals(true, npc.hiddenInCave, "Villager stays hidden while the mob is near the cave");
    g.mobs = [];
    npc.panicTimer = 0;
    npc.update(g);
    assertEquals(false, npc.hiddenInCave, "Villager comes out when danger clears");
    assertEquals(82, npc.x, "Cleared mob danger shows the villager at the cave mouth first");
    assertEquals(true, !!npc.returningFromCave, "Cleared mob danger marks the villager as walking home");
    assertEquals(false, g.canNPCTrade(npc), "Villager does not reopen trade while walking out of the cave");
    for (let i = 0; i < 80 && npc.returningFromCave; i++) npc.update(g);
    assertEquals(false, !!npc.returningFromCave, "Villager finishes the visible cave-exit return");
    assertEquals(100, npc.x, "Cleared mob danger walks the villager back to the village home");
    renderTestResult(SUITE, "Villagers: mobs attack and villagers run to caves", true);
  } catch (err) {
    renderTestResult(SUITE, "Villagers: mobs attack and villagers run to caves", false, err.message);
  }

  // C19d2: trained pets intercept mobs before they can hurt villagers.
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    g.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1]
      ]
    };
    g.player = new Player(360, 64);
    g.researchXP = 0;
    g.masteryMeters = {};
    const villager = new NPC({ id: 'guarded', name: 'Guarded', profession: 'Miner', type: 'npc', x: 112, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60 });
    const pet = new Mob(144, 60, 'blob', '#4ade80', 1);
    pet.pet = true;
    pet.hp = 2;
    pet.attackCooldown = 0;
    const raider = new Mob(114, 60, 'hog', '#9a6b4f', 1);
    raider.speed = 0;
    raider.behaviorTimer = 999;
    raider.hp = 1;
    g.interactiveObjects = [villager];
    g.mobs = [pet, raider];
    g.updateMobs();
    assertEquals(1, g.mobs.length, "Pet guard removes the hostile mob before villager contact damage");
    assertEquals(true, g.mobs[0].pet, "The trained pet remains after guarding the villager");
    assertEquals(villager.maxHealth, villager.health, "Villager health is unchanged when a pet intercepts the mob");
    assertEquals(false, villager.rescuePending, "Guarded villagers do not enter rescue panic");
    assertEquals("pet state -> protect village", g.discoveryPulse && g.discoveryPulse.formula, "Pet guard proof names village protection");
    assertEquals("pet protected village", g.discoveryPulse && g.discoveryPulse.progressLabel, "Pet guard proof records village protection progress");
    assertEquals(3, g.getVillageTrustProgress(0).points, "Village pet guard adds trust once");
    renderTestResult(SUITE, "Villagers: trained pets protect the village", true);
  } catch (err) {
    renderTestResult(SUITE, "Villagers: trained pets protect the village", false, err.message);
  }

  // C19e: turning survival off clears panic hiding unless the stage itself is night.
  try {
    const walkReturningVillagerHome = (game, villager, limit = 220) => {
      for (let i = 0; i < limit && villager && villager.returningFromCave; i++) {
        villager.update(game);
      }
    };
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 1; g.currentPlanet = PLANETS[1];
    g.player = new Player(0, 0);
    g.researchXP = 0;
    g.masteryMeters = {};
    const npc = new NPC({ id: 'release', name: 'Release', profession: 'Miner', type: 'npc', x: 130, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60, hiddenInCave: true });
    npc.panicTimer = 80;
    npc.rescuePending = true;
    npc.shelterReason = "nearby mob";
    g.interactiveObjects = [npc];
    g.survivalMode = true;
    g.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const releaseSummary = g.toggleSurvival();
    assertEquals(false, g.survivalMode, "Survival mode turns off");
    assertEquals(0, g.mobs.length, "Survival mobs are cleared");
    assertEquals(1, releaseSummary && releaseSummary.released, "Survival-off reports one daylight villager release");
    assertEquals(0, releaseSummary && releaseSummary.sheltered, "Survival-off daylight release does not keep villagers sheltered");
    assertEquals(false, g.getVillagerShelterSignal(npc).active, "Daylight shelter signal clears after Survival turns off");
    assertEquals(false, npc.hiddenInCave, "Villager reappears after survival danger ends");
    assertEquals(82, npc.x, "Daylight release shows the villager exiting at the cave mouth");
    assertEquals(60, npc.y, "Daylight cave exit keeps the villager on the village surface");
    assertEquals(null, npc.rescueReason, "Daylight survival release clears the saved mob-rescue cause");
    assertEquals(true, (npc.caveExitTimer || 0) > 0, "Survival-off release keeps a visible cave-exit cue");
    assertEquals(true, !!npc.returningFromCave, "Daylight release starts a visible walk back to the village");
    assertEquals(false, g.canNPCTrade(npc), "Villager cannot trade while still walking home from the cave");
    assertEquals("VILLAGE CLEAR: traders back outside", g.missionBalloon && g.missionBalloon.text, "Survival-off daylight release announces visible villagers");
    assertEquals("clear", releaseSummary && releaseSummary.caveState, "Survival-off daylight release reports the clear cave state");
    assertEquals(true, releaseSummary && releaseSummary.allClear, "Survival-off daylight release reports all caves clear");
    assertEquals("VILLAGE CLEAR: traders back outside", releaseSummary && releaseSummary.message, "Survival-off daylight release exposes the CRT message");
    assertEquals(0, npc.panicTimer, "Villager panic clears after survival mode ends");
    assertEquals(7, g.researchXP, "A danger-caused cave release grants Village Rescue Research XP");
    assertEquals(true, g.hasVillageRescueCredit(1), "Village rescue records world mastery source credit");
    assertEquals(4, g.getVillageTrustProgress(1).points, "Village rescue adds relationship trust");
    assertEquals("Trading Friend", g.getVillageTrustProgress(1).title, "First rescue reaches the first village trust tier");
    assertEquals("TRUST UP", g.discoveryPulse && g.discoveryPulse.villageTrust && g.discoveryPulse.villageTrust.label, "Rescue pulse exposes the trust tier-up");
    assertEquals(null, g.grantVillageRescueReward(npc, "nearby mob"), "The same villager rescue cannot be farmed twice");
    assertEquals(7, g.researchXP, "Duplicate rescue credit does not add more Research XP");
    assertEquals(4, g.getVillageTrustProgress(1).points, "Duplicate rescue credit does not add more village trust");
    walkReturningVillagerHome(g, npc);
    assertEquals(false, !!npc.returningFromCave, "Survival-off villager finishes the cave-exit walk");
    assertEquals(130, npc.x, "Daylight release walks the villager back to the village home");
    assertEquals(true, g.canNPCTrade(npc), "Villager can trade again after reaching home");

    const earthDayRelease = new StarHopperGame();
    earthDayRelease.state = 'playing'; earthDayRelease.currentPlanetIndex = 0; earthDayRelease.currentPlanet = PLANETS[0];
    earthDayRelease.player = new Player(0, 0);
    earthDayRelease.researchXP = 0;
    earthDayRelease.masteryMeters = {};
    earthDayRelease.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    const earthDayNpc = new NPC({ id: 'earth-day-release', name: 'Earth Day Release', profession: 'Miner', type: 'npc', x: 82, y: 60, homeX: 150, homeY: 60, caveX: 72, caveY: 60, hiddenInCave: true, color: '#cbd5e1' });
    earthDayNpc.shelterReason = "night";
    earthDayRelease.interactiveObjects = [earthDayNpc];
    earthDayRelease.survivalMode = true;
    earthDayRelease.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const earthDaySummary = earthDayRelease.toggleSurvival();
    assertEquals(false, earthDayRelease.survivalMode, "Earth daylight Survival-off turns the fight off");
    assertEquals(false, earthDayNpc.hiddenInCave, "Earth daylight Survival-off keeps villagers visible instead of hiding them");
    assertEquals(82, earthDayNpc.x, "Earth daylight Survival-off shows the villager at the cave mouth first");
    assertEquals(true, !!earthDayNpc.returningFromCave, "Earth daylight Survival-off starts the cave-exit walk");
    assertEquals(1, earthDaySummary && earthDaySummary.released, "Earth daylight Survival-off reports the villager release");
    assertEquals(0, earthDaySummary && earthDaySummary.sheltered, "Earth daylight Survival-off does not keep night shelter active");
    assertEquals(false, earthDayRelease.canNPCTrade(earthDayNpc), "Earth daylight cave-exit walk waits before restoring trading");
    walkReturningVillagerHome(earthDayRelease, earthDayNpc);
    assertEquals(150, earthDayNpc.x, "Earth daylight Survival-off walks the villager to the village home");
    assertEquals(true, earthDayRelease.canNPCTrade(earthDayNpc), "Earth daylight Survival-off restores trading after the return");

    const midRetreat = new StarHopperGame();
    midRetreat.state = 'playing'; midRetreat.currentPlanetIndex = 1; midRetreat.currentPlanet = PLANETS[1];
    midRetreat.player = new Player(0, 0);
    midRetreat.researchXP = 0;
    midRetreat.masteryMeters = {};
    const midNpc = new NPC({ id: 'mid-release', name: 'Mid Release', profession: 'Miner', type: 'npc', x: 108, y: 60, color: '#cbd5e1', homeX: 150, homeY: 60, caveX: 72, caveY: 60 });
    midNpc.panicTimer = 90;
    midNpc.rescuePending = true;
    midNpc.shelterReason = "nearby mob";
    midRetreat.interactiveObjects = [midNpc];
    midRetreat.activeNPC = midNpc;
    midRetreat.survivalMode = true;
    midRetreat.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    midRetreat.toggleSurvival();
    assertEquals(false, midNpc.hiddenInCave, "Survival-off release also restores villagers that were mid-retreat");
    assertEquals(108, midNpc.x, "Mid-retreat survival release keeps the villager visible instead of snapping away");
    assertEquals(true, !!midNpc.returningFromCave, "Mid-retreat survival release starts a visible walk home");
    assertEquals(null, midNpc.shelterReason, "Mid-retreat survival release clears stale shelter reason");
    assertEquals(null, midRetreat.activeNPC, "Mid-retreat survival release closes stale trade focus");
    midRetreat.updateVillagerShelterStates();
    assertEquals(false, midNpc.hiddenInCave, "Survival-off villagers stay visible after the next shelter tick");
    assertEquals(true, midNpc.x >= 108 && midNpc.x < 150, "Survival-off villagers keep walking home after the next shelter tick");
    walkReturningVillagerHome(midRetreat, midNpc);
    assertEquals(150, midNpc.x, "Survival-off mid-retreat villagers end at their village home");

    const hiddenOff = new StarHopperGame();
    hiddenOff.state = 'playing'; hiddenOff.currentPlanetIndex = 1; hiddenOff.currentPlanet = PLANETS[1];
    hiddenOff.player = new Player(0, 0);
    hiddenOff.researchXP = 0;
    hiddenOff.masteryMeters = {};
    const hiddenNpc = new NPC({ id: 'hidden-off', name: 'Hidden Off', profession: 'Miner', type: 'npc', x: 82, y: 60, color: '#cbd5e1', homeX: 150, homeY: 60, caveX: 72, caveY: 60, hiddenInCave: true });
    hiddenNpc.rescuePending = true;
    hiddenNpc.shelterReason = "nearby mob";
    hiddenOff.interactiveObjects = [hiddenNpc];
    hiddenOff.survivalMode = true;
    hiddenOff.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    hiddenOff.toggleSurvival();
    assertEquals(false, hiddenNpc.hiddenInCave, "Survival-off brings a hidden villager back outside when it is daytime");
    assertEquals(82, hiddenNpc.x, "Survival-off shows a hidden villager exiting from the cave mouth");
    hiddenOff.updateVillagerShelterStates();
    assertEquals(false, hiddenNpc.hiddenInCave, "Released hidden villager does not disappear again after danger was cleared");
    walkReturningVillagerHome(hiddenOff, hiddenNpc);
    assertEquals(150, hiddenNpc.x, "Survival-off walks a hidden villager back to the village home");

    const dangerHold = new StarHopperGame();
    dangerHold.state = 'playing'; dangerHold.currentPlanetIndex = 1; dangerHold.currentPlanet = PLANETS[1];
    dangerHold.player = new Player(0, 0);
    dangerHold.researchXP = 0;
    dangerHold.masteryMeters = {};
    const dangerNpc = new NPC({ id: 'danger-hold', name: 'Danger Hold', profession: 'Guard', type: 'npc', x: 82, y: 60, color: '#cbd5e1', homeX: 140, homeY: 60, caveX: 72, caveY: 60, hiddenInCave: true });
    dangerNpc.rescuePending = true;
    dangerNpc.shelterReason = "nearby mob";
    dangerHold.interactiveObjects = [dangerNpc];
    dangerHold.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const dangerSummary = dangerHold.releaseVillagersFromCaves({ keepSheltered: false });
    assertEquals(true, dangerNpc.hiddenInCave, "Villager stays in the cave while danger is still near the cave");
    assertEquals(0, dangerSummary && dangerSummary.released, "Danger-held cave release reports no visible release");
    assertEquals(1, dangerSummary && dangerSummary.sheltered, "Danger-held cave release reports one sheltered villager");
    assertEquals("danger", dangerSummary && dangerSummary.caveState, "Danger-held cave release reports a danger cave state");
    assertEquals(false, dangerSummary && dangerSummary.allClear, "Danger-held cave release does not claim all caves are clear");
    assertEquals("VILLAGE WAIT: danger still near caves", dangerHold.missionBalloon && dangerHold.missionBalloon.text, "Danger-held cave release explains why the villager did not come out");

    const rosterRelease = new StarHopperGame();
    rosterRelease.state = 'playing'; rosterRelease.currentPlanetIndex = 1; rosterRelease.currentPlanet = PLANETS[1];
    rosterRelease.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1]
      ]
    };
    rosterRelease.canvas = { width: 720, height: 448 };
    rosterRelease.player = new Player(64, 64);
    rosterRelease.enemies = [];
    rosterRelease.projectiles = [];
    rosterRelease.spawnedBoxes = [];
    rosterRelease.spawnedSprings = [];
    rosterRelease.debris = [];
    rosterRelease.meteors = [];
    rosterRelease.researchXP = 0;
    rosterRelease.masteryMeters = {};
    const rosterNpcA = new NPC({ id: 'roster-a', name: 'Roster A', profession: 'Miner', type: 'npc', x: 82, y: 60, color: '#cbd5e1', homeX: 130, homeY: 60, caveX: 72, caveY: 60, hiddenInCave: true });
    const rosterNpcB = new NPC({ id: 'roster-b', name: 'Roster B', profession: 'Guard', type: 'npc', x: 132, y: 60, color: '#a7f3d0', homeX: 180, homeY: 60, caveX: 122, caveY: 60, hiddenInCave: true });
    [rosterNpcA, rosterNpcB].forEach(npc => {
      npc.rescuePending = true;
      npc.shelterReason = "nearby mob";
    });
    rosterRelease.interactiveObjects = [rosterNpcA, rosterNpcB];
    rosterRelease.survivalMode = true;
    rosterRelease.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const rosterSummary = rosterRelease.toggleSurvival();
    const releasedRoster = rosterRelease.interactiveObjects.filter(obj => obj instanceof NPC);
    assertEquals(2, releasedRoster.length, "Survival-off keeps every villager object in the village roster");
    assertEquals(2, rosterSummary && rosterSummary.released, "Survival-off daylight release reports every hidden villager");
    assertEquals(true, releasedRoster.every(npc => !npc.hiddenInCave), "Survival-off daylight release makes all mob-hidden villagers visible");
    assertEquals(true, releasedRoster.every(npc => !!npc.returningFromCave), "Survival-off daylight release sends all villagers walking back home");
    rosterRelease.update();
    assertEquals(2, rosterRelease.interactiveObjects.filter(obj => obj instanceof NPC).length, "Next full frame still keeps every released villager in the scene");
    assertEquals(true, releasedRoster.every(npc => !npc.hiddenInCave), "Next full frame does not hide released villagers again when danger is gone");

    const rosterNight = new StarHopperGame();
    rosterNight.state = 'playing'; rosterNight.currentPlanetIndex = 0; rosterNight.currentPlanet = PLANETS[0];
    rosterNight.player = new Player(0, 0);
    rosterNight.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    rosterNight.researchXP = 0;
    rosterNight.masteryMeters = {};
    const nightRosterNpcA = new NPC({ id: 'night-roster-a', name: 'Night Roster A', profession: 'Miner', type: 'npc', x: 120, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60 });
    const nightRosterNpcB = new NPC({ id: 'night-roster-b', name: 'Night Roster B', profession: 'Guard', type: 'npc', x: 170, y: 60, color: '#a7f3d0', caveX: 122, caveY: 60 });
    [nightRosterNpcA, nightRosterNpcB].forEach(npc => {
      npc.rescuePending = true;
      npc.shelterReason = "nearby mob";
    });
    rosterNight.interactiveObjects = [nightRosterNpcA, nightRosterNpcB];
    rosterNight.survivalMode = true;
    rosterNight.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const nightRosterSummary = rosterNight.toggleSurvival();
    const nightRoster = rosterNight.interactiveObjects.filter(obj => obj instanceof NPC);
    assertEquals(2, nightRoster.length, "Survival-off night keeps every villager object in the village roster");
    assertEquals(0, nightRosterSummary && nightRosterSummary.released, "Survival-off night reports no daylight villager release");
    assertEquals(2, nightRosterSummary && nightRosterSummary.sheltered, "Survival-off night keeps every villager sheltered");
    assertEquals("night", nightRosterSummary && nightRosterSummary.caveState, "Survival-off night reports the night cave state");
    assertEquals(false, nightRosterSummary && nightRosterSummary.allClear, "Survival-off night does not claim all caves are clear");
    assertEquals(true, nightRoster.every(npc => npc.hiddenInCave), "Earth night sends all villagers into caves after Survival danger ends");
    assertEquals(true, nightRoster.every(npc => npc.shelterReason === "night"), "Earth night owns the visible cave state after mobs clear");
    assertEquals(true, nightRoster.every(npc => npc.rescueReason === "nearby mob"), "Earth night preserves each mob-rescue cause for daylight return");

    const fullFrameRelease = new StarHopperGame();
    fullFrameRelease.state = 'playing'; fullFrameRelease.currentPlanetIndex = 1; fullFrameRelease.currentPlanet = PLANETS[1];
    fullFrameRelease.currentVariant = {
      map: [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1]
      ]
    };
    fullFrameRelease.canvas = { width: 720, height: 448 };
    fullFrameRelease.player = new Player(64, 64);
    fullFrameRelease.enemies = [];
    fullFrameRelease.projectiles = [];
    fullFrameRelease.spawnedBoxes = [];
    fullFrameRelease.spawnedSprings = [];
    fullFrameRelease.debris = [];
    fullFrameRelease.meteors = [];
    fullFrameRelease.researchXP = 0;
    fullFrameRelease.masteryMeters = {};
    const frameNpc = new NPC({ id: 'frame-off', name: 'Frame Off', profession: 'Miner', type: 'npc', x: 82, y: 60, color: '#cbd5e1', homeX: 150, homeY: 60, caveX: 72, caveY: 60, hiddenInCave: true });
    frameNpc.rescuePending = true;
    frameNpc.shelterReason = "nearby mob";
    fullFrameRelease.interactiveObjects = [frameNpc];
    fullFrameRelease.survivalMode = true;
    fullFrameRelease.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    fullFrameRelease.toggleSurvival();
    fullFrameRelease.update();
    assertEquals(false, frameNpc.hiddenInCave, "Survival-off villager stays visible through the next full game frame");
    assertEquals(true, frameNpc.x > 82 && frameNpc.x < 150, "Survival-off full-frame update shows the villager walking out of the cave");
    assertEquals(false, fullFrameRelease.canNPCTrade(frameNpc), "Survival-off full-frame update waits to restore trading until the villager gets home");
    walkReturningVillagerHome(fullFrameRelease, frameNpc);
    assertEquals(150, frameNpc.x, "Survival-off full-frame path ends at the village home");
    assertEquals(true, fullFrameRelease.canNPCTrade(frameNpc), "Survival-off full-frame path restores the villager to a tradeable state");

    const loopRelease = new StarHopperGame();
    loopRelease.state = 'playing'; loopRelease.currentPlanetIndex = 1; loopRelease.currentPlanet = PLANETS[1];
    loopRelease.player = new Player(0, 0);
    loopRelease.researchXP = 0;
    loopRelease.masteryMeters = {};
    const loopNpc = new NPC({ id: 'loop-release', name: 'Loop Release', profession: 'Miner', type: 'npc', x: 130, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60, hiddenInCave: true });
    loopNpc.panicTimer = 90;
    loopNpc.rescuePending = true;
    loopNpc.shelterReason = "nearby mob";
    loopRelease.interactiveObjects = [loopNpc];
    loopRelease.mobs = [];
    loopRelease.updateVillagerShelterStates();
    assertEquals(false, loopNpc.hiddenInCave, "Game loop shelter pass releases a hidden villager when danger is gone");
    assertEquals(0, loopNpc.panicTimer, "Cleared danger cancels stale panic instead of hiding the villager offscreen");
    assertEquals(82, loopNpc.x, "Normal cave release makes the villager visible at the cave mouth");
    assertEquals(7, loopRelease.researchXP, "Loop release grants the rescue XP when the villager exits the cave");
    walkReturningVillagerHome(loopRelease, loopNpc);
    assertEquals(130, loopNpc.x, "Normal cave release walks the villager back to the village home");

    const loopTurnBack = new StarHopperGame();
    loopTurnBack.state = 'playing'; loopTurnBack.currentPlanetIndex = 1; loopTurnBack.currentPlanet = PLANETS[1];
    loopTurnBack.player = new Player(0, 0);
    loopTurnBack.researchXP = 0;
    loopTurnBack.masteryMeters = {};
    const turnBackNpc = new NPC({ id: 'turn-back', name: 'Turn Back', profession: 'Miner', type: 'npc', x: 108, y: 60, color: '#cbd5e1', homeX: 150, homeY: 60, caveX: 72, caveY: 60 });
    turnBackNpc.panicTimer = 90;
    turnBackNpc.rescuePending = true;
    turnBackNpc.shelterReason = "nearby mob";
    loopTurnBack.interactiveObjects = [turnBackNpc];
    loopTurnBack.activeNPC = turnBackNpc;
    loopTurnBack.mobs = [];
    loopTurnBack.updateVillagerShelterStates();
    assertEquals(false, turnBackNpc.hiddenInCave, "Mid-retreat villager stays visible when mob danger clears");
    assertEquals(108, turnBackNpc.x, "Mid-retreat game-loop release keeps the villager at the visible turn-back point");
    assertEquals(true, !!turnBackNpc.returningFromCave, "Mid-retreat game-loop release starts a visible return walk");
    assertEquals(null, turnBackNpc.shelterReason, "Mid-retreat game-loop release clears stale mob shelter reason");
    assertEquals(null, loopTurnBack.activeNPC, "Mid-retreat game-loop release closes stale trade focus");
    assertEquals(7, loopTurnBack.researchXP, "Mid-retreat game-loop release still records the rescue proof once");
    walkReturningVillagerHome(loopTurnBack, turnBackNpc);
    assertEquals(150, turnBackNpc.x, "Mid-retreat game-loop return ends at the village home");

    const directRelease = new StarHopperGame();
    directRelease.state = 'playing'; directRelease.currentPlanetIndex = 1; directRelease.currentPlanet = PLANETS[1];
    directRelease.player = new Player(0, 0);
    directRelease.researchXP = 0;
    directRelease.masteryMeters = {};
    const directNpc = new NPC({ id: 'direct-release', name: 'Direct Release', profession: 'Miner', type: 'npc', x: 130, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60, hiddenInCave: true });
    directNpc.panicTimer = 90;
    directNpc.caveCooldown = 24;
    directNpc.proximity = true;
    directNpc.rescuePending = true;
    directNpc.shelterReason = "nearby mob";
    directRelease.interactiveObjects = [directNpc];
    directRelease.activeNPC = directNpc;
    directRelease.mobs = [];
    directNpc.update(directRelease);
    assertEquals(false, directNpc.hiddenInCave, "NPC update also releases a hidden villager when danger clears");
    assertEquals(82, directNpc.x, "NPC update release shows a hidden villager at the cave mouth");
    assertEquals(0, directNpc.panicTimer, "NPC update clears stale panic once no mob is near the village");
    assertEquals(0, directNpc.caveCooldown, "NPC update uses the shared cave release cleanup");
    assertEquals(false, directNpc.proximity, "NPC update clears stale cave proximity after release");
    assertEquals(null, directRelease.activeNPC, "NPC update release closes stale trade focus");
    assertEquals(7, directRelease.researchXP, "NPC update release records the rescue proof once");
    walkReturningVillagerHome(directRelease, directNpc);
    assertEquals(130, directNpc.x, "NPC update release walks the hidden villager back home");

    const directTurnBack = new StarHopperGame();
    directTurnBack.state = 'playing'; directTurnBack.currentPlanetIndex = 1; directTurnBack.currentPlanet = PLANETS[1];
    directTurnBack.player = new Player(0, 0);
    directTurnBack.researchXP = 0;
    directTurnBack.masteryMeters = {};
    const directTurnNpc = new NPC({ id: 'direct-turn', name: 'Direct Turn', profession: 'Miner', type: 'npc', x: 108, y: 60, color: '#cbd5e1', homeX: 150, homeY: 60, caveX: 72, caveY: 60 });
    directTurnNpc.panicTimer = 90;
    directTurnNpc.rescuePending = true;
    directTurnNpc.shelterReason = "nearby mob";
    directTurnBack.interactiveObjects = [directTurnNpc];
    directTurnBack.activeNPC = directTurnNpc;
    directTurnBack.mobs = [];
    directTurnNpc.update(directTurnBack);
    assertEquals(false, directTurnNpc.hiddenInCave, "NPC update keeps a mid-retreat villager visible once danger clears");
    assertEquals(108, directTurnNpc.x, "NPC update keeps the mid-retreat villager visible at the turn-back point");
    assertEquals(true, !!directTurnNpc.returningFromCave, "NPC update starts a visible mid-retreat return");
    assertEquals(null, directTurnNpc.shelterReason, "NPC update clears stale mid-retreat shelter reason");
    assertEquals(null, directTurnBack.activeNPC, "NPC update closes stale mid-retreat trade focus");
    walkReturningVillagerHome(directTurnBack, directTurnNpc);
    assertEquals(150, directTurnNpc.x, "NPC update mid-retreat return ends at the village home");

    const nightGame = new StarHopperGame();
    nightGame.state = 'playing'; nightGame.currentPlanetIndex = 0; nightGame.currentPlanet = PLANETS[0];
    nightGame.player = new Player(0, 0);
    nightGame.researchXP = 0;
    nightGame.masteryMeters = {};
    nightGame.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    const nightNpc = new NPC({ id: 'night-release', name: 'Night Release', profession: 'Miner', type: 'npc', x: 120, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60, hiddenInCave: false });
    nightNpc.panicTimer = 80;
    nightNpc.rescuePending = true;
    nightNpc.shelterReason = "nearby mob";
    nightGame.interactiveObjects = [nightNpc];
    nightGame.survivalMode = true;
    nightGame.mobs = [new Mob(90, 60, 'hog', '#9a6b4f', 1)];
    const nightSummary = nightGame.toggleSurvival();
    assertEquals(true, nightNpc.hiddenInCave, "Earth night keeps villagers sheltered after survival danger ends");
    assertEquals(0, nightNpc.caveExitTimer || 0, "Earth night does not show a false cave-exit cue while the villager stays hidden");
    assertEquals(0, nightSummary && nightSummary.released, "Survival-off night release reports no daylight villagers");
    assertEquals(1, nightSummary && nightSummary.sheltered, "Survival-off night release reports one villager kept in a cave");
    assertEquals(82, nightNpc.x, "Earth night parks the villager at the cave mouth");
    assertEquals("night", nightNpc.shelterReason, "Earth night becomes the active visible cave state");
    assertEquals("nearby mob", nightNpc.rescueReason, "Earth night preserves the mob-rescue cause for daylight");
    assertEquals("NIGHT", nightGame.getVillagerCaveStatus(nightNpc).label, "Survival-off night cave marker explains the villager did not disappear");
    const nightCrtPreview = getVillageStateCrtPreview(nightGame);
    assertEquals("NIGHT", nightCrtPreview && nightCrtPreview.label, "Mission CRT should show night shelter after Survival-off clears mobs");
    assertEquals("night -> cave", nightCrtPreview && nightCrtPreview.transition, "Mission CRT should keep the visible night-to-cave transition");
    const nightStartSignal = getStartVillageStateSignal(nightGame);
    assertEquals("NIGHT", nightStartSignal && nightStartSignal.label, "Start village signal should show night, not stale danger, after Survival-off");
    assertEquals("VILLAGE NIGHT: traders wait in caves", nightGame.missionBalloon && nightGame.missionBalloon.text, "Survival-off night release explains villagers stayed in caves");
    assertEquals(0, nightNpc.panicTimer, "Night shelter clears mob panic without forcing villagers outside");
    assertEquals(0, nightGame.researchXP, "Night shelter waits to reward until the villager can actually return");
    nightNpc.proximity = true;
    nightGame.activeNPC = nightNpc;
    nightNpc.update(nightGame);
    assertEquals(false, nightNpc.proximity, "Night-cave villager cannot become a trade target at the cave mouth");
    assertEquals(null, nightGame.activeNPC, "Night-cave villager clears stale trade focus");
    nightGame.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    nightGame.updateVillagerShelterStates();
    assertEquals(false, nightNpc.hiddenInCave, "Daylight after survival-off brings the villager back out");
    assertEquals(82, nightNpc.x, "Daylight after survival-off shows the villager at the cave mouth first");
    assertEquals(true, (nightNpc.caveExitTimer || 0) > 0, "Daylight release after night shows a cave-exit cue");
    assertEquals(null, nightNpc.shelterReason, "Daylight after survival-off clears the cave reason");
    assertEquals(null, nightNpc.rescueReason, "Daylight after survival-off clears the preserved rescue cause");
    assertEquals(7, nightGame.researchXP, "The rescue reward waits until the villager actually returns");
    assertEquals(true, /nearby mob/.test(nightGame.discoveryPulse && nightGame.discoveryPulse.insight), "Delayed daylight rescue still explains the original mob danger");
    assertEquals(false, nightGame.canNPCTrade(nightNpc), "Daylight-returned villager waits to trade until it reaches home");
    walkReturningVillagerHome(nightGame, nightNpc);
    assertEquals(120, nightNpc.x, "Daylight after survival-off walks the villager to the village home");
    assertEquals(true, nightGame.canNPCTrade(nightNpc), "Daylight-returned villager can trade again at home");
    renderTestResult(SUITE, "Villagers: survival off releases cave hiding", true);
  } catch (err) {
    renderTestResult(SUITE, "Villagers: survival off releases cave hiding", false, err.message);
  }

  // C19f: Earth night sends villagers into caves, and daylight brings them back out.
  try {
    const walkReturningVillagerHome = (game, villager, limit = 220) => {
      for (let i = 0; i < limit && villager && villager.returningFromCave; i++) {
        villager.update(game);
      }
    };
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 0; g.currentPlanet = PLANETS[0];
    g.player = new Player(220, 64);
    g.mobs = [];
    g.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    const npc = new NPC({ id: 'nightwatch', name: 'Nightwatch', profession: 'Miner', type: 'npc', x: 100, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60 });
    g.interactiveObjects = [npc];
    assertEquals("night", g.getVillagerShelterSignal(npc).reason, "Earth night shelter signal points villagers to caves");
    const beforeNightX = npc.x;
    g.updateVillagerShelterStates();
    assertEquals(true, npc.x < beforeNightX, "Game loop night pass starts the cave retreat immediately");
    for (let i = 0; i < 40 && !npc.hiddenInCave; i++) g.updateVillagerShelterStates();
    assertEquals(true, npc.hiddenInCave, "Villager shelters in a cave at night");
    assertEquals("night", npc.shelterReason, "Night cave shelter is labeled separately from mob rescue");
    assertEquals(false, g.canNPCTrade(npc), "Night-sheltered villagers cannot trade from caves");
    npc.x = 300;
    npc.proximity = true;
    g.activeNPC = npc;
    g.updateVillagerShelterStates();
    assertEquals(82, npc.x, "Night shelter keeps hidden villagers parked at the cave mouth");
    assertEquals(false, npc.proximity, "Night-sheltered villagers cannot open trades");
    assertEquals(null, g.activeNPC, "Night shelter clears active trade target");
    g.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    g.updateVillagerShelterStates();
    assertEquals(false, npc.hiddenInCave, "Villager comes out in daylight");
    assertEquals(82, npc.x, "Daylight shows the villager exiting at the cave mouth");
    assertEquals(true, !!npc.returningFromCave, "Daylight release starts the villager's walk home");
    assertEquals(null, npc.shelterReason, "Daylight clears the night shelter reason");
    assertEquals(0, g.researchXP || 0, "Daylight release from night shelter does not award rescue XP");
    assertEquals(false, g.canNPCTrade(npc), "Daylight cave-exit walk keeps trade closed until the villager gets home");
    walkReturningVillagerHome(g, npc);
    assertEquals(100, npc.x, "Daylight walks the villager back to the village home");
    assertEquals(true, g.canNPCTrade(npc), "Daylight-restored villager can trade after reaching home");
    const partialNightNpc = new NPC({ id: 'partial-night', name: 'Partial Night', profession: 'Miner', type: 'npc', x: 140, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60 });
    partialNightNpc.shelterReason = "night";
    g.interactiveObjects = [partialNightNpc];
    g.mobs = [];
    g.updateVillagerShelterStates();
    assertEquals(null, partialNightNpc.shelterReason, "Daylight clears a partial night retreat before the cave is reached");
    partialNightNpc.shelterReason = "night";
    g.mobs = [new Mob(146, 60, 'hog', '#9a6b4f', 1)];
    g.updateVillagerShelterStates();
    assertEquals("nearby mob", partialNightNpc.shelterReason, "Mob danger overrides stale night shelter state");

    const loadGame = new StarHopperGame();
    loadGame.state = 'playing';
    loadGame.researchXP = 0;
    loadGame.masteryMeters = {};
    loadGame.getEarthDayNightPhase = () => ({ t: 0, daylight: 0.1, isDay: false, sunX: 0.1, sunY: 0.2 });
    loadGame.loadPlanet(0);
    const loadedNpc = loadGame.interactiveObjects.find(obj => obj instanceof NPC);
    assertEquals(true, !!loadedNpc, "Earth loads a village NPC");
    assertEquals(true, loadedNpc.hiddenInCave, "Night-loaded Earth villagers start in caves");
    assertEquals(loadedNpc.caveX + 10, loadedNpc.x, "Night-loaded villager is parked at the cave mouth");
    assertEquals(false, !!loadedNpc.rescuePending, "Night shelter does not count as a mob rescue");
    assertEquals("night", loadedNpc.shelterReason, "Night-loaded cave state is marked as night shelter");
    assertEquals("NIGHT", loadGame.getVillagerCaveStatus(loadedNpc).label, "Night-loaded cave marker labels the occupied cave");
    loadGame.getEarthDayNightPhase = () => ({ t: 0.5, daylight: 1, isDay: true, sunX: 0.5, sunY: 0.34 });
    loadedNpc.update(loadGame);
    assertEquals(false, loadedNpc.hiddenInCave, "Night-loaded villager comes out at daylight");
    assertEquals(loadedNpc.caveX + 10, loadedNpc.x, "Night-loaded villager becomes visible at the cave mouth before walking home");
    assertEquals(0, loadGame.researchXP, "Daylight release from night shelter does not award rescue XP");
    walkReturningVillagerHome(loadGame, loadedNpc);
    assertEquals(loadedNpc.homeX, loadedNpc.x, "Night-loaded villager walks to its village home at daylight");
    renderTestResult(SUITE, "Villagers: Earth night and day controls caves", true);
  } catch (err) {
    renderTestResult(SUITE, "Villagers: Earth night and day controls caves", false, err.message);
  }

  // C20: a meteor smashing a block drops gem/rubble but NEVER conjures a mob (survival-off fix) —
  // while a deliberate head-bump still can, so the two paths stay distinct.
  try {
    const g = new StarHopperGame();
    g.state = 'playing'; g.currentPlanetIndex = 2; g.player = new Player(0, 0); g.interactiveObjects = [];
    let mobFromMeteor = false;
    for (let a = 0; a < 40 && !mobFromMeteor; a++) {
      g.retryAttempt = a; g.currentVariant = { map: [[1, 1, 1], [0, 10, 0], [1, 1, 1]] }; g.mobs = [];
      g.breakBlock(1, 1, 'meteor');
      if (g.mobs.length > 0) mobFromMeteor = true;
    }
    assertEquals(false, mobFromMeteor, "A meteor-shattered block never wakes a mob");
    let mobFromBump = false;
    for (let a = 0; a < 60 && !mobFromBump; a++) {
      g.retryAttempt = a; g.currentVariant = { map: [[1, 1, 1], [0, 10, 0], [1, 1, 1]] }; g.mobs = [];
      g.breakBlock(1, 1);
      if (g.mobs.length > 0) mobFromBump = true;
    }
    assertEquals(true, mobFromBump, "A head-bumped block can still wake a mob");
    renderTestResult(SUITE, "Blocks: meteor breaks never spawn mobs (survival-off fix)", true);
  } catch (err) {
    renderTestResult(SUITE, "Blocks: meteor breaks never spawn mobs (survival-off fix)", false, err.message);
  }

  // C21: two-tier fuel — the grounded thruster refills FROM the finite tank (no free regen),
  // and the tank loses exactly what the thruster gains.
  try {
    if (typeof Compiler !== 'undefined' && Compiler.reset) Compiler.reset();
    const p = new Player(0, 0); p.charType = 'star'; p.onGround = true;
    p.fuel = 50; p.maxFuel = 100; p.tank = 100; p.maxTank = 200;
    const stub = { getCurrentGravity: () => 0.6, starMass: 1, hopperMass: 2.5, player: p };
    p.update({}, PLANETS[0], stub);
    assertEquals(true, p.fuel > 50, "Grounded thruster refills");
    assertEquals(true, p.tank < 100, "Refill is drawn from the tank");
    assertEquals(true, Math.abs((p.fuel - 50) - (100 - p.tank)) < 1e-6, "Tank loses exactly what the thruster gains");
    renderTestResult(SUITE, "Fuel: thruster refills from the finite tank on the ground", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: thruster refills from the finite tank on the ground", false, err.message);
  }

  // C22: an empty tank means the thruster can't refill (run dry → stays dry until a pickup)
  try {
    if (typeof Compiler !== 'undefined' && Compiler.reset) Compiler.reset();
    const p = new Player(0, 0); p.charType = 'star'; p.onGround = true;
    p.fuel = 20; p.maxFuel = 100; p.tank = 0; p.maxTank = 200;
    const stub = { getCurrentGravity: () => 0.6, starMass: 1, hopperMass: 2.5, player: p };
    p.update({}, PLANETS[0], stub);
    assertEquals(20, Math.round(p.fuel), "Empty tank → thruster does not refill");
    assertEquals(0, p.tank, "Empty tank stays empty");
    renderTestResult(SUITE, "Fuel: a dry tank can't recharge the thruster", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: a dry tank can't recharge the thruster", false, err.message);
  }

  // C22b: a rocket burn from a near-empty thruster clamps at 0 (never negative → no gauge glitch)
  try {
    if (typeof Compiler !== 'undefined' && Compiler.reset) Compiler.reset();
    const p = new Player(0, 0); p.charType = 'hopper'; p.onGround = false;
    p.fuel = 0.3; p.maxFuel = 100; p.tank = 50; p.rocketPower = 40; p.coyoteFrames = 0;
    const stub = { getCurrentGravity: () => 0.6, starMass: 1, hopperMass: 2.5, player: p };
    p.update({ ' ': true }, PLANETS[0], stub); // hold jump mid-air → rocket burn
    assertEquals(true, p.fuel >= 0, "Rocket burn never drives the thruster negative");
    assertEquals(0, p.fuel, "Thruster bottoms out exactly at 0");
    renderTestResult(SUITE, "Fuel: rocket burn clamps the thruster at zero", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: rocket burn clamps the thruster at zero", false, err.message);
  }

  // C22c: the infinite-tank toggle flips state, persists, and tops both pools to full
  try {
    const g = new StarHopperGame();
    g.player = new Player(0, 0);
    g.player.tank = 10; g.player.fuel = 10; g.player.maxTank = 200; g.player.maxFuel = 100;
    g.infiniteFuel = false;
    g.toggleInfiniteFuel();
    assertEquals(true, g.infiniteFuel, "Toggle turns infinite fuel on");
    assertEquals(200, g.player.tank, "Turning on tops the TANK to full");
    assertEquals(10, g.player.fuel, "Turning on does NOT fill the thruster (only the tank is infinite)");
    assertEquals('1', localStorage.getItem('sh-infinite-fuel'), "On-state is persisted");
    g.toggleInfiniteFuel();
    assertEquals(false, g.infiniteFuel, "Toggle turns infinite fuel off");
    assertEquals('0', localStorage.getItem('sh-infinite-fuel'), "Off-state is persisted");
    renderTestResult(SUITE, "Fuel: infinite-tank toggle flips, persists, and fills up", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: infinite-tank toggle flips, persists, and fills up", false, err.message);
  }

  // C22d: a spatial tutorial cue fires ONCE per level even though update() polls it every frame
  // (the Moon "gap" bug: re-firing reset the speech balloon each frame so it never cleared).
  try {
    const g = new StarHopperGame();
    g.currentPlanet = { tutorial: [{ trigger: 'gap', text: 'Mind the gap!' }, { trigger: 'wall', text: 'A wall!' }], story: {} };
    g.player = new Player(0, 0);
    let monitorCount = 0;
    const realMonitor = g.showMissionBalloon.bind(g);
    g.showMissionBalloon = (...a) => { monitorCount++; return realMonitor(...a); };
    const prevGame = (typeof window !== 'undefined') ? window.Game : undefined;
    try {
      window.Game = g; // showDialogue reads window.Game
      g._firedTutorialTriggers = new Set();
      for (let i = 0; i < 8; i++) g.triggerTutorialDialogue('gap');   // simulate lingering in the zone
      assertEquals(1, monitorCount, "Re-entering the same cue zone shows the mission monitor only once");
      g.triggerTutorialDialogue('wall');                              // a different cue still fires
      assertEquals(2, monitorCount, "A distinct cue still shows");
      g._firedTutorialTriggers = new Set();                           // new level → cues reset
      g.triggerTutorialDialogue('gap');
      assertEquals(3, monitorCount, "Cues reset on a fresh level load");
    } finally {
      window.Game = prevGame;
    }
    renderTestResult(SUITE, "Tutorial: spatial cues fire once per level (mission monitor clears)", true);
  } catch (err) {
    renderTestResult(SUITE, "Tutorial: spatial cues fire once per level (mission monitor clears)", false, err.message);
  }

  // C23: fuel canisters are scattered onto solid ledges (deterministic per attempt)
  try {
    const g = new StarHopperGame();
    g.currentPlanetIndex = 1; g.retryAttempt = 0; g.interactiveObjects = [];
    const air = () => new Array(14).fill(0);
    const solid = () => new Array(14).fill(1);
    const map = [air(), air(), air(), air(), air(), air(), air(), air(), solid(), air(), air(), air(), air(), air()];
    g.currentVariant = { map };
    g.placeFuelCanisters();
    const cans = g.interactiveObjects.filter((o) => o.type === 'fuel');
    assertEquals(true, cans.length >= 1, "At least one fuel canister is placed");
    const onLedge = cans.every((o) => {
      const c = Math.floor(o.x / TILE_SIZE), r = Math.floor(o.y / TILE_SIZE);
      return map[r] && map[r][c] === 0 && map[r + 1] && map[r + 1][c] === 1;
    });
    assertEquals(true, onLedge, "Every canister rests on a solid ledge");
    renderTestResult(SUITE, "Fuel: canisters spawn on reachable ledges", true);
  } catch (err) {
    renderTestResult(SUITE, "Fuel: canisters spawn on reachable ledges", false, err.message);
  }

  // C24: an NPC trade deducts gems, applies the cap reward, marks it purchased, and refuses
  // a trade the cadet can't afford.
  const oldGetElementByIdC24 = document.getElementById;
  const oldBubblePopC24 = ComicBubbles.pop;
  const oldSwitchMainModeC24 = switchMainMode;
  const prevGameC24 = (typeof window !== 'undefined') ? window.Game : undefined;
  try {
    const bubbleLabelsC24 = [];
    ComicBubbles.pop = (x, y, text) => { bubbleLabelsC24.push(text); };
    const g = new StarHopperGame();
    window.Game = g;
    g.currentPlanetIndex = 1;
    g.player = new Player(0, 0);
    g.gemsWallet = { emerald: 5, quartz: 0, amber: 0, ice: 0, flux: 0 };
    g.purchasedTrades = new Set();
    g.upgradeCapBonuses = { engine: 0, jump: 0, rocket: 0, mass: 0, antigravity: 0 };
    g.researchXP = 0;
    g.masteryMeters = {};
    g.discoveryPassCounts = {};
    const npc = { id: 'geary', name: 'Geary', profession: 'Machinist', color: '#fff', dialogue: ['hi'],
      trades: [
        { id: 'engine_1', cost: { type: 'emerald', amount: 1 }, desc: 'Reinforce Engine', reward: { type: 'cap', key: 'engine', amount: 3 } },
        { id: 'pricey', cost: { type: 'emerald', amount: 99 }, desc: 'Overclock Engine', reward: { type: 'cap', key: 'engine', amount: 5 } },
      ] };
    g.interactiveObjects = [npc];
    let request = getVillageTradeRequest(g, npc);
    assertEquals("READY TRADE", request.kicker, "Trade request should prioritize an affordable unpurchased offer");
    assertEquals("Reinforce Engine", request.title, "Trade request should name the selected offer");
    assertEquals("Payoff: ENGINE +3 upgrade", request.reward, "Trade request should name the upgrade payoff");
    assertEquals(true, /READY TRADE/.test(renderVillageTradeRequestHTML(request)), "Trade request card should render the request status");
    let marker = getVillageTradeMarker(g, npc);
    assertEquals("READY", marker && marker.label, "In-world trade marker should show ready trades before opening the modal");
    assertEquals("TRADE", marker && marker.detail, "Ready trade marker should name the trade action");
    g.activeAIStateRun = { cardId: "trade-flow", levelIndex: 1, label: "MAKE TRADE" };
    executeNPCTrade('geary', 'engine_1');
    assertEquals(4, g.gemsWallet.emerald, "Trade deducts the cost from the wallet");
    assertEquals(3, g.upgradeCapBonuses.engine, "Cap reward applies the bonus");
    assertEquals(true, g.purchasedTrades.has('engine_1'), "Trade is marked purchased");
    assertEquals("CAP UP!", g.lastTradeRewardEffect.label, "Cap trade should create an in-level reward cue");
    assertEquals("ENGINE +3", g.lastTradeRewardEffect.detail, "Cap trade cue should name the upgraded stat");
    assertEquals(true, bubbleLabelsC24.some(label => /CAP UP!/.test(label)), "Cap trade should pop a named reward cue");
    assertEquals(4, g.researchXP, "First village trade should award Research XP");
    assertEquals(8, g.getWorldMasteryProgress(1).xp, "First village trade should add world mastery XP");
    assertEquals("Village Trade Proof", g.discoveryPulse && g.discoveryPulse.title, "Village trade should create a discovery pulse");
    assertEquals("TRADE PACT", g.discoveryPulse && g.discoveryPulse.villageTradeProof && g.discoveryPulse.villageTradeProof.label, "Cap trade should expose a trade proof chip");
    assertEquals(null, g.activeAIStateRun, "Completed trade proof clears the active AI route");
    assertEquals("AI PROOF LOGGED", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.label, "Active trade proof adds an AI proof chip");
    assertEquals("Trade Flow", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.title, "AI proof chip names the completed trade card");
    assertEquals("1/5", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.progress, "AI proof chip shows trade deck progress");
    assertEquals("Shelter Loop", g.discoveryPulse && g.discoveryPulse.aiStateRunProof && g.discoveryPulse.aiStateRunProof.nextTitle, "AI proof chip points to the next AI card");
    assertEquals("shelter-loop", g.lastAIStateRunProof && g.lastAIStateRunProof.nextCardId, "Logged trade proof remembers the next AI card id");
    assertEquals("State machine", g.lastAIStateRunProof && g.lastAIStateRunProof.nextConcept, "Logged trade proof remembers the next AI card concept");
    assertEquals("RUN RESCUE", g.lastAIStateRunProof && g.lastAIStateRunProof.nextActionLabel, "Logged trade proof remembers the next AI route action");
    assertEquals("patrol -> cave -> trade", g.lastAIStateRunProof && g.lastAIStateRunProof.nextState, "Logged trade proof remembers the next AI state formula");
    let aiStatePulseClick = null;
    const aiStatePulseButton = {
      dataset: { aiStateNextCard: "shelter-loop" },
      addEventListener(event, handler) { if (event === "click") aiStatePulseClick = handler; }
    };
    const pulsePanelC24 = {
      classList: { add: () => {}, remove: () => {} },
      innerHTML: "",
      querySelectorAll(selector) {
        if (selector === "[data-ai-state-next-card]" && /data-ai-state-next-card/.test(this.innerHTML)) return [aiStatePulseButton];
        return [];
      }
    };
    document.getElementById = (id) => id === "discovery-pulse" ? pulsePanelC24 : oldGetElementByIdC24.call(document, id);
    updateDiscoveryPulse(g);
    assertEquals(true, /AI PROOF LOGGED/.test(pulsePanelC24.innerHTML), "Discovery Pulse should render the AI proof chip");
    assertEquals(true, /Trade Flow/.test(pulsePanelC24.innerHTML), "Rendered AI proof chip should name the completed card");
    assertEquals(true, /discovery-ai-state-lesson/.test(pulsePanelC24.innerHTML), "Discovery Pulse should render AI State next-step lesson chips");
    assertEquals(true, /LEARN/.test(pulsePanelC24.innerHTML) && /State machine/.test(pulsePanelC24.innerHTML), "AI State proof handoff should teach the next behavior concept");
    assertEquals(true, /CODE/.test(pulsePanelC24.innerHTML) && /patrol -&gt; cave -&gt; trade/.test(pulsePanelC24.innerHTML), "AI State proof handoff should show the next state formula");
    assertEquals(true, /WIN/.test(pulsePanelC24.innerHTML) && /RUN RESCUE/.test(pulsePanelC24.innerHTML), "AI State proof handoff should name the next route payoff");
    assertEquals(true, /discovery-ai-state-next/.test(pulsePanelC24.innerHTML), "AI State proof handoff should render a direct next-state route");
    assertEquals(true, /data-ai-state-next-card="shelter-loop"/.test(pulsePanelC24.innerHTML), "AI State pulse route should target the next deck card");
    assertEquals(true, typeof aiStatePulseClick === "function", "AI State pulse route should bind a click handler");
    document.getElementById = oldGetElementByIdC24;
    const aiPulseStarts = [];
    const aiPulseModes = [];
    g.startLevel = (level) => { aiPulseStarts.push(level); g.currentPlanetIndex = level; };
    g.toggleSurvival = () => { g.survivalMode = true; };
    switchMainMode = (mode) => aiPulseModes.push(mode);
    aiStatePulseClick();
    assertEquals(1, aiPulseStarts[0], "AI State pulse route should launch the next proof world");
    assertEquals(true, g.survivalMode, "AI State pulse route should enable Survival for the rescue proof");
    assertEquals("shelter-loop", g.activeAIStateRun && g.activeAIStateRun.cardId, "AI State pulse route should restore the next active proof");
    assertEquals("terminal", aiPulseModes[0], "AI State pulse route should return to the playable terminal");
    assertEquals(3, g.getVillageTrustProgress(1).points, "First trade should add village trust");
    assertEquals("Trading Friend", g.getVillageTrustProgress(1).title, "First trade should reach the first village trust tier");
    assertEquals("TRUST UP", g.discoveryPulse && g.discoveryPulse.villageTrust && g.discoveryPulse.villageTrust.label, "Trade pulse should expose the village trust chip");
    assertEquals("VILLAGE LAB", g.missionBalloon && g.missionBalloon.title, "Trade proof should use the mission monitor");
    assertEquals("TRADE PACT: +4 Research XP", g.missionBalloon && g.missionBalloon.text, "Trade proof should announce the XP payoff");
    const tradeProofKey = g.getVillageTradeProofSourceKey(npc, npc.trades[0]);
    assertEquals(1, g.discoveryPassCounts[tradeProofKey], "Trade proof stores its one-time source key");
    assertEquals(null, g.grantVillageTradeProof(npc, npc.trades[0]), "Repeating the same trade proof is blocked");
    assertEquals(4, g.researchXP, "Repeated trade proof does not farm Research XP");
    assertEquals(3, g.getVillageTrustProgress(1).points, "Repeated trade proof does not farm village trust");
    request = getVillageTradeRequest(g, npc);
    assertEquals("VILLAGE REQUEST", request.kicker, "After a purchase, request should move to the next unpurchased offer");
    assertEquals(95, request.missing, "Trade request should state the remaining gem gap");
    assertEquals(true, /Collect 95 more Emerald/.test(request.body), "Trade request should explain what to collect next");
    marker = getVillageTradeMarker(g, npc);
    assertEquals("NEED 95", marker && marker.label, "In-world trade marker should show the remaining gem gap");
    assertEquals("EMERALD", marker && marker.detail, "Missing-gem marker should name the requested sample type");
    executeNPCTrade('geary', 'pricey');     // can't afford (have 4, costs 99)
    assertEquals(4, g.gemsWallet.emerald, "Unaffordable trade does not deduct");
    assertEquals(3, g.upgradeCapBonuses.engine, "Unaffordable trade grants no bonus");
    g.purchasedTrades.add('pricey');
    marker = getVillageTradeMarker(g, npc);
    assertEquals("DONE", marker && marker.label, "In-world trade marker should show when local trades are complete");
    npc.hiddenInCave = true;
    assertEquals(null, getVillageTradeMarker(g, npc), "Sheltered villagers should not advertise trade markers");
    document.getElementById = oldGetElementByIdC24;
    window.Game = prevGameC24;
    ComicBubbles.pop = oldBubblePopC24;
    switchMainMode = oldSwitchMainModeC24;
    renderTestResult(SUITE, "Trade: deducts gems, applies cap, blocks over-spend", true);
  } catch (err) {
    document.getElementById = oldGetElementByIdC24;
    window.Game = prevGameC24;
    ComicBubbles.pop = oldBubblePopC24;
    switchMainMode = oldSwitchMainModeC24;
    renderTestResult(SUITE, "Trade: deducts gems, applies cap, blocks over-spend", false, err.message);
  }

  // C24b: reaching the final village trust tier creates a one-time Guardian pact payoff.
  const oldGetElementByIdC24b = document.getElementById;
  const oldBubblePopC24b = ComicBubbles.pop;
  const oldParticleBurstC24b = Particles.spawnBurst;
  try {
    const labels = [];
    let bursts = 0;
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
    ComicBubbles.pop = (x, y, text) => { labels.push(text); };
    Particles.spawnBurst = () => { bursts++; };

    const g = new StarHopperGame();
    g.currentPlanetIndex = 0;
    g.currentPlanet = PLANETS[0];
    g.player = new Player(60, 80);
    g.researchXP = 0;
    g.masteryMeters = {};
    g.discoveryPassCounts = {};
    g.discoveredFormulaKinds = new Set();
    g.formulaCardEffects = [];
    g.villageTrust = {
      0: {
        points: 9,
        badges: ["friend", "ally"],
        sources: { "seed:trade": 3, "seed:rescue": 4, "seed:guard": 2 }
      }
    };
    const npc = { id: 'geary', name: 'Geary', profession: 'Machinist', color: '#facc15' };
    const trade = { id: 'guardian_drill', cost: { type: 'emerald', amount: 1 }, desc: 'Guardian Drill', reward: { type: 'tool', key: 'drill', label: 'drill' } };
    const pulse = g.grantVillageTradeProof(npc, trade);
    assertEquals("Village Trade Proof", pulse && pulse.title, "Final-tier trade still records the trade proof");
    assertEquals("Village Guardian", g.getVillageTrustProgress(0).title, "Final-tier trade reaches Village Guardian");
    assertEquals("VILLAGE PACT", pulse.villagePactProof && pulse.villagePactProof.label, "Final trust tier should create a pact chip");
    assertEquals(14, pulse.rewardXP, "Trade proof and Guardian pact XP should combine in the pulse");
    assertEquals(14, g.researchXP, "Trade proof and Guardian pact should add Research XP once");
    assertEquals(22, g.getWorldMasteryProgress(0).xp, "Trade proof and Guardian pact should both feed world mastery");
    assertEquals(1, g.discoveryPassCounts[g.getVillageGuardianPactSourceKey(0)], "Guardian pact stores a one-time source");
    assertEquals(true, g.discoveredFormulaKinds.has("state"), "Guardian pact unlocks the AI State Lab card");
    assertEquals(1, g.formulaCardEffects.length, "Guardian pact spawns one AI State Lab card effect");
    assertEquals("VILLAGE GUARDIAN", g.missionBalloon && g.missionBalloon.title, "Guardian pact should own the Mission CRT line");
    assertEquals("VILLAGE PACT: +10 Research XP", g.missionBalloon && g.missionBalloon.text, "Guardian pact CRT announces the capstone XP");
    assertEquals(true, labels.includes("VILLAGE PACT!"), "Guardian pact should pop a named capstone cue");
    assertEquals(true, labels.includes("AI STATES MASTERED"), "Guardian pact should name the learned system");
    assertEquals(true, bursts > 0, "Guardian pact should spawn reward particles");
    assertEquals(true, /VILLAGE PACT \+10 XP/.test(panel.innerHTML), "Discovery Pulse should render the Guardian pact chip");
    assertEquals(true, /VILLAGE GUARDIAN PACT/.test(panel.innerHTML), "Discovery Pulse should show the pact completion card");
    const xpAfterFirst = g.researchXP;
    assertEquals(null, g.grantVillageGuardianPact(pulse), "Repeating the Guardian pact should be blocked");
    assertEquals(xpAfterFirst, g.researchXP, "Repeated Guardian pact should not farm Research XP");

    document.getElementById = oldGetElementByIdC24b;
    ComicBubbles.pop = oldBubblePopC24b;
    Particles.spawnBurst = oldParticleBurstC24b;
    renderTestResult(SUITE, "Trade: Village Guardian pact caps trust ladder", true);
  } catch (err) {
    document.getElementById = oldGetElementByIdC24b;
    ComicBubbles.pop = oldBubblePopC24b;
    Particles.spawnBurst = oldParticleBurstC24b;
    renderTestResult(SUITE, "Trade: Village Guardian pact caps trust ladder", false, err.message);
  }

  // C25: tool rewards from NPC trades persist and immediately equip the cadet.
  const oldBubblePopC25 = ComicBubbles.pop;
  const oldParticleBurstC25 = Particles.spawnBurst;
  try {
    const bubbleLabelsC25 = [];
    const particleColorsC25 = [];
    ComicBubbles.pop = (x, y, text) => { bubbleLabelsC25.push(text); };
    Particles.spawnBurst = (x, y, color) => { particleColorsC25.push(color); };

    const g = new StarHopperGame();
    const prevGame = (typeof window !== 'undefined') ? window.Game : undefined;
    try {
      window.Game = g;
      g.player = new Player(0, 0);
      g.gemsWallet = { emerald: 3, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
      g.purchasedTrades = new Set();
      g.unlockedTools = new Set();
      const npc = { id: 'geary', name: 'Geary', profession: 'Machinist', color: '#fff', dialogue: ['hi'],
        trades: [
          { id: 'dual', cost: { type: 'emerald', amount: 2 }, desc: 'x', reward: { type: 'tool', key: 'dual_blaster', label: 'dual blaster' } },
        ] };
      g.interactiveObjects = [npc];
      executeNPCTrade('geary', 'dual');
      assertEquals(1, g.gemsWallet.emerald, "Tool trade deducts the wallet cost");
      assertEquals(true, g.unlockedTools.has('dual_blaster'), "Tool trade records the unlocked tool");
      assertEquals('blaster', g.player.weapon, "Dual blaster reward equips the blaster");
      assertEquals(true, g.weaponLevel >= 3, "Dual blaster reward upgrades weapon level");
      assertEquals("TOOL GET!", g.lastTradeRewardEffect.label, "Tool trade should create an in-level reward cue");
      assertEquals("tool", g.lastTradeRewardEffect.rewardType, "Trade reward effect should record the reward type");
      assertEquals(true, bubbleLabelsC25.some(label => /TOOL GET!/.test(label)), "Tool trade should pop a named reward cue");
      assertEquals(true, particleColorsC25.some(color => color === "#a7f3d0"), "Tool trade should spawn a secondary reward burst");
      const glaciesTrades = (PLANETS[3].npcs[0] && PLANETS[3].npcs[0].trades) || [];
      const lotionTrade = glaciesTrades.find((trade) => trade.id === 'glacies_taming_lotion');
      assertEquals('taming_lotion', lotionTrade && lotionTrade.reward && lotionTrade.reward.key, "Glacies trade unlocks calming lotion");
    } finally {
      window.Game = prevGame;
      ComicBubbles.pop = oldBubblePopC25;
      Particles.spawnBurst = oldParticleBurstC25;
    }
    renderTestResult(SUITE, "Trade: tool rewards unlock and equip weapons", true);
  } catch (err) {
    ComicBubbles.pop = oldBubblePopC25;
    Particles.spawnBurst = oldParticleBurstC25;
    renderTestResult(SUITE, "Trade: tool rewards unlock and equip weapons", false, err.message);
  }

  // C26: getUpgradeCap folds in NPC-trade cap bonuses (raises ceilings, lowers the mass floor).
  try {
    const g = new StarHopperGame();
    g.currentPlanetIndex = 0;
    const engBase = g.getUpgradeCap('engine');
    const massBase = g.getUpgradeCap('mass');
    g.upgradeCapBonuses = { engine: 4, jump: 0, rocket: 0, mass: 0.3, antigravity: 0 };
    assertEquals(engBase + 4, g.getUpgradeCap('engine'), "Engine ceiling rises by the bonus");
    assertEquals(true, g.getUpgradeCap('mass') < massBase, "Mass floor drops with the bonus");
    renderTestResult(SUITE, "Trade: getUpgradeCap folds in purchased cap bonuses", true);
  } catch (err) {
    renderTestResult(SUITE, "Trade: getUpgradeCap folds in purchased cap bonuses", false, err.message);
  }
}

// Suite 5: Retry Remix — seeded procedural variation (same lesson, new instance)
function runRetryRemixTests() {
  const SUITE = "remix-suite";
  const countTile = (m, val) => m.reduce((n, row) => n + row.filter((t) => t === val).length, 0);

  // Test R1: mulberry32 is deterministic for a given seed
  try {
    const a = mulberry32(12345), b = mulberry32(12345);
    assertEquals(a(), b(), "Same seed should produce the same first value");
    renderTestResult(SUITE, "PRNG: mulberry32 is deterministic per seed", true);
  } catch (err) {
    renderTestResult(SUITE, "PRNG: mulberry32 is deterministic per seed", false, err.message);
  }

  // Test R2: attempt 0 is the canonical layout (no remix), map unchanged
  try {
    const v = buildPlanetVariant(PLANETS[0], 0, 0);
    assertEquals(false, !!v.isRemix, "Attempt 0 must not be a remix");
    assertEquals("standard", v.variantLabel, "Attempt 0 label should be 'standard'");
    assertEquals(JSON.stringify(PLANETS[0].map), JSON.stringify(v.map), "Attempt 0 map must equal the canonical map");
    renderTestResult(SUITE, "Variant: first attempt is the canonical layout", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: first attempt is the canonical layout", false, err.message);
  }

  // Test R3: same (planet, attempt) is deterministic (reproducible / shareable)
  try {
    const a = buildPlanetVariant(PLANETS[0], 0, 1);
    const b = buildPlanetVariant(PLANETS[0], 0, 1);
    assertEquals(a.variantLabel, b.variantLabel, "Same seed should give the same label");
    assertEquals(JSON.stringify(a.map), JSON.stringify(b.map), "Same seed should give the same map");
    renderTestResult(SUITE, "Variant: a given retry is reproducible (seeded)", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: a given retry is reproducible (seeded)", false, err.message);
  }

  // Test R4: a remix NEVER changes the required-gem count (saved progress stays valid)
  try {
    for (let p = 0; p < 5; p++) {
      const base = countTile(PLANETS[p].map, 3);
      for (let att = 1; att <= 3; att++) {
        const v = buildPlanetVariant(PLANETS[p], p, att);
        assertEquals(base, countTile(v.map, 3), `Planet ${p} attempt ${att} must keep ${base} gems`);
      }
    }
    renderTestResult(SUITE, "Variant: remixes preserve the required-gem count", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: remixes preserve the required-gem count", false, err.message);
  }

  // Test R5: Earth remix retunes the Agility target into 28..34 and flags as a remix
  try {
    const v = buildPlanetVariant(PLANETS[0], 0, 1);
    const t = v.targetOverrides.agility;
    assertEquals(true, Number.isFinite(t) && t >= 28 && t <= 34, `Earth Agility target ${t} should be 28..34`);
    assertEquals(true, v.isRemix, "Earth attempt 1 should be a remix");
    renderTestResult(SUITE, "Variant: Earth remix retunes Agility target (28-34)", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Earth remix retunes Agility target (28-34)", false, err.message);
  }

  // Test R6: Mag-Net remix flips poles — the +pole and -pole counts swap
  try {
    const basePos = countTile(PLANETS[4].map, 5);
    const baseNeg = countTile(PLANETS[4].map, 6);
    const v = buildPlanetVariant(PLANETS[4], 4, 1);
    assertEquals(baseNeg, countTile(v.map, 5), "After flip, +pole count should equal old -pole count");
    assertEquals(basePos, countTile(v.map, 6), "After flip, -pole count should equal old +pole count");
    renderTestResult(SUITE, "Variant: Mag-Net remix flips pole polarity", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Mag-Net remix flips pole polarity", false, err.message);
  }

  // Test R7: flavors rotate — Earth retry 2 is the "no antigravity" constraint
  try {
    const v1 = buildPlanetVariant(PLANETS[0], 0, 1); // flavor 0: geometry/target
    const v2 = buildPlanetVariant(PLANETS[0], 0, 2); // flavor 1: constraint
    assertEquals(null, v1.constraint, "Earth retry 1 should be a geometry/target flavor (no constraint)");
    assertEquals("earth-no-antigravity", v2.constraint && v2.constraint.id, "Earth retry 2 should be the no-antigravity constraint");
    assertEquals(true, v2.constraint.banAntigravity, "No-antigravity constraint should ban antigravity");
    assertEquals(26, v2.targetOverrides.agility, "No-antigravity Agility target should be the feasible 26");
    renderTestResult(SUITE, "Variant: Earth flavor rotation surfaces the no-antigravity run", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Earth flavor rotation surfaces the no-antigravity run", false, err.message);
  }

  // Test R7a: later Earth retries surface the no-jump-power constraint.
  try {
    const v = buildPlanetVariant(PLANETS[0], 0, 5);
    assertEquals("earth-no-jump-power", v.constraint && v.constraint.id, "Earth retry 5 should require stock jump_power");
    assertEquals(true, v.constraint.banJumpPower, "No-jump Earth remix should ban stronger jump_power");
    assertEquals(30, v.targetOverrides.agility, "No-jump Agility target should match the regular Earth target");
    renderTestResult(SUITE, "Variant: Earth rotation surfaces no-jump run", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Earth rotation surfaces no-jump run", false, err.message);
  }

  // Test R7b: still later Earth retries surface the no-mass-cut constraint.
  try {
    const v = buildPlanetVariant(PLANETS[0], 0, 6);
    assertEquals("earth-no-mass-cut", v.constraint && v.constraint.id, "Earth retry 6 should require stock mass");
    assertEquals(true, v.constraint.banMassLower, "No-mass Earth remix should ban lowering hopper.mass");
    assertEquals(2.5, v.constraint.minMass, "No-mass Earth remix should keep Hopper at stock mass");
    assertEquals(26, v.targetOverrides.agility, "No-mass Agility target should remain feasible");
    renderTestResult(SUITE, "Variant: Earth rotation surfaces no-mass run", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Earth rotation surfaces no-mass run", false, err.message);
  }

  // Test R7c: the Earth rotation now includes the engine-only replay with a reachable low-ledged map.
  try {
    const v = buildPlanetVariant(PLANETS[0], 0, 7);
    assertEquals("earth-engine-only", v.constraint && v.constraint.id, "Earth retry 7 should isolate the engine knob");
    assertEquals(true, v.constraint.engineOnly, "Engine-only Earth remix should expose the engine-only flag");
    assertEquals(8, v.constraint.engineMin, "Engine-only Earth remix should ask for the base engine cap");
    assertEquals(7, v.targetOverrides.agility, "Engine-only Agility target should stay reachable at stock mass/jump/gravity");
    assertEquals(rvCountTiles(PLANETS[0].map, 3), rvCountTiles(v.map, 3), "Engine-only remix preserves required gem count");
    assertEquals(3, v.map[6].slice(31, 38).filter((tile) => tile === 3).length, "Engine-only remix relocates high gems to the low runway");
    renderTestResult(SUITE, "Variant: Earth rotation surfaces engine-only run", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Earth rotation surfaces engine-only run", false, err.message);
  }

  // Test R8: Moon retry 2 is the loop "spring budget" constraint
  try {
    const v = buildPlanetVariant(PLANETS[1], 1, 2);
    assertEquals("moon-spring-budget", v.constraint && v.constraint.id, "Moon retry 2 should be the spring-budget constraint");
    assertEquals(true, Number.isFinite(v.constraint.springCount) && v.constraint.springCount >= 2, "Spring budget should set a loop count");
    renderTestResult(SUITE, "Variant: Moon flavor rotation surfaces a loop spring-budget", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Moon flavor rotation surfaces a loop spring-budget", false, err.message);
  }

  // Test R8a: later Moon retries surface the stricter repeat-loop spring replay.
  try {
    const v = buildPlanetVariant(PLANETS[1], 1, 5);
    assertEquals("moon-strict-spring", v.constraint && v.constraint.id, "Moon retry 5 should require strict repeat-spawned springs");
    assertEquals(true, v.constraint.requireRepeatSpring, "Strict spring replay should require repeat-loop spawn evidence");
    assertEquals(5, v.constraint.springCount, "Strict spring replay should request the five-spring loop");
    renderTestResult(SUITE, "Variant: Moon rotation surfaces strict spring loop", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Moon rotation surfaces strict spring loop", false, err.message);
  }

  // Test R9: Glacies retry 2 is the "event-only" constraint (forces the ice rule)
  try {
    const v = buildPlanetVariant(PLANETS[3], 3, 2);
    assertEquals("glacies-event-only", v.constraint && v.constraint.id, "Glacies retry 2 should be the event-only constraint");
    assertEquals(true, v.constraint.requireIceRule, "Event-only constraint should require the ice rule");
    renderTestResult(SUITE, "Variant: Glacies flavor rotation surfaces an event-only run", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Glacies flavor rotation surfaces an event-only run", false, err.message);
  }

  // Test R9a: Glacies later retries also surface a numeric friction-target run.
  try {
    const v = buildPlanetVariant(PLANETS[3], 3, 4);
    assertEquals("glacies-friction-target", v.constraint && v.constraint.id, "Glacies retry 4 should require a numeric friction target");
    assertEquals(true, Number.isFinite(v.constraint.minFriction) && v.constraint.minFriction >= 7, "Friction target should set a measurable threshold");
    renderTestResult(SUITE, "Variant: Glacies rotation surfaces a friction target", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Glacies rotation surfaces a friction target", false, err.message);
  }

  // Test R9b: later Jupiter and Mag-Net remixes add event-rule constraints, not only geometry.
  try {
    const jupiter = buildPlanetVariant(PLANETS[2], 2, 4);
    assertEquals("jupiter-rocket-rule", jupiter.constraint && jupiter.constraint.id, "Jupiter retry 4 should require a rocket event rule");
    assertEquals(true, jupiter.constraint.requireRocketRule, "Jupiter rocket remix should expose the rocket-rule requirement");
    assertEquals(true, Number.isFinite(jupiter.targetOverrides.thrust) && jupiter.targetOverrides.thrust >= 46 && jupiter.targetOverrides.thrust <= 49, "Jupiter rocket-rule target should stay feasible");

    const magnet = buildPlanetVariant(PLANETS[4], 4, 4);
    assertEquals("magnet-polarity-event", magnet.constraint && magnet.constraint.id, "Mag-Net retry 4 should require a magnet-touch polarity event");
    assertEquals(true, magnet.constraint.requireMagnetTouchRule, "Mag-Net polarity remix should expose the magnet-touch requirement");
    renderTestResult(SUITE, "Variant: Jupiter and Mag-Net add event-rule remixes", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Jupiter and Mag-Net add event-rule remixes", false, err.message);
  }

  // Test R9c: Asteroid Forge has real remix flavors for endgame frontier runs.
  try {
    const forge1 = buildPlanetVariant(PLANETS[5], 5, 1);
    const forge2 = buildPlanetVariant(PLANETS[5], 5, 2);
    const baseGems = rvCountTiles(PLANETS[5].map, 3);
    assertEquals(true, forge1.isRemix, "Forge retry 1 should be a remix");
    assertEquals(true, forge2.isRemix, "Forge retry 2 should be a remix");
    assertEquals(baseGems, rvCountTiles(forge1.map, 3), "Forge remix 1 preserves required gem count");
    assertEquals(baseGems, rvCountTiles(forge2.map, 3), "Forge remix 2 preserves required gem count");
    assertEquals(true, forge1.variantLabel !== "standard" && forge2.variantLabel !== "standard", "Forge remixes should describe what changed");
    renderTestResult(SUITE, "Variant: Asteroid Forge remixes momentum lesson", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Asteroid Forge remixes momentum lesson", false, err.message);
  }

  // Test R10: Daily Signal is deterministic per date and always a playable remix
  try {
    const a = getDailySignal(PLANETS, "2026-06-11", 4);
    const b = getDailySignal(PLANETS, "2026-06-11", 4);
    assertEquals(a.seed, b.seed, "Same date must give the same seed");
    assertEquals(a.planetIndex, b.planetIndex, "Same date must give the same planet");
    assertEquals(a.variant.variantLabel, b.variant.variantLabel, "Same date must give the same remix");
    assertEquals(true, a.variant.isRemix, "The daily is always a remix (attempt >= 1)");
    assertEquals(PLANETS[a.planetIndex].tagline, a.concept, "Daily Signal should carry the planet science concept");
    assertEquals("3 Lab Stars: tasks + samples + proof", a.labGoal, "Daily Signal should name the mastery goal");
    assertEquals(true, !!a.labContract, "Daily Signal should carry a replay lab contract");
    assertEquals(a.concept, a.labContract.concept, "Daily lab contract should preserve the science concept");
    assertEquals(true, !!a.labContract.command, "Daily lab contract should include a stageable sample command");
    assertEquals(true, /^[A-Z]+-\d+$/.test(a.shareCode), "Share code format WORLD-NNNN: " + a.shareCode);
    assertEquals(true, dateSeed("2026-06-11") !== dateSeed("2026-06-12"), "Different dates should hash differently");
    renderTestResult(SUITE, "Daily Signal: deterministic per date, always a remix", true);
  } catch (err) {
    renderTestResult(SUITE, "Daily Signal: deterministic per date, always a remix", false, err.message);
  }

  // Test R11: Daily Signal pool clamps to unlocked worlds (Earth-only until a clear)
  try {
    ["2026-06-11", "2026-06-12", "2026-06-13", "2026-07-04"].forEach((d) => {
      assertEquals(0, getDailySignal(PLANETS, d, 0).planetIndex, "Pool 0 must always pick Earth (" + d + ")");
      const wide = getDailySignal(PLANETS, d, 4).planetIndex;
      assertEquals(true, wide >= 0 && wide <= 4, "Pool 4 stays within the 5 worlds");
    });
    renderTestResult(SUITE, "Daily Signal: pool clamps to unlocked worlds", true);
  } catch (err) {
    renderTestResult(SUITE, "Daily Signal: pool clamps to unlocked worlds", false, err.message);
  }

  // Test R11b: Frontier Challenge unlocks only after the full playable star-map is clear.
  try {
    const g = new StarHopperGame();
    g.getTodayDateStr = () => "2026-06-30";
    g.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };
    assertEquals(null, g.getFrontierChallenge(), "Frontier should stay locked until Asteroid Forge is cleared too");
    g.planetClears[5] = 1;
    g.masteryMeters = {
      0: { xp: 60 }, 1: { xp: 120 }, 2: { xp: 180 },
      3: { xp: 60 }, 4: { xp: 120 }, 5: { xp: 180 }
    };
    const frontier = g.getFrontierChallenge();
    assertEquals(true, !!frontier, "Frontier should unlock after all playable worlds are cleared");
    assertEquals(3, frontier.tier, "Average world mastery should set the frontier tier");
    assertEquals(PLANETS[frontier.planetIndex].tagline, frontier.concept, "Frontier challenge should carry the planet science concept");
    assertEquals("3 Lab Stars: tasks + samples + proof", frontier.labGoal, "Frontier challenge should name the mastery goal");
    assertEquals(true, !!frontier.labContract, "Frontier challenge should carry a replay lab contract");
    assertEquals(frontier.concept, frontier.labContract.concept, "Frontier lab contract should preserve the selected science concept");
    assertEquals(true, !!frontier.labContract.command, "Frontier lab contract should include a sample experiment command");
    assertEquals(true, /^FRONTIER-[A-Z]+-\d{4}$/.test(frontier.shareCode), "Frontier share code should be explicit and padded");
    assertEquals(true, frontier.attempt >= 98, "Frontier should use attempts beyond the normal daily range");
    let startedIndex = null;
    g.startLevel = (index) => { startedIndex = index; };
    assertEquals(true, g.startFrontierChallenge(), "Unlocked frontier starts");
    assertEquals(frontier.attempt, g._pendingAttemptOverride, "Frontier attempt is queued for loadPlanet");
    assertEquals(true, g.dailyInfo.isFrontier, "Frontier run is tagged separately from a daily");
    assertEquals(frontier.planetIndex, startedIndex, "Frontier starts its selected planet");

    g.discoveredFormulaKinds = new Set((typeof DISCOVERY_RULES !== 'undefined' ? DISCOVERY_RULES : []).map(rule => rule.kind));
    const contract = g.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("NEXT FRONTIER CONTRACT", contract.kicker, "Frontier clear should suggest another frontier climb");
    assertEquals(frontier.labContract.title, contract.title, "Frontier clear contract should reuse the replay lab focus");
    assertEquals(true, contract.body.indexOf(frontier.labContract.command.split("\n")[0]) >= 0, "Frontier clear contract should include the sample command");
    assertEquals(true, /world mastery XP/.test(contract.reward), "Frontier reward should name world mastery XP");

    const echoGame = new StarHopperGame();
    echoGame.getTodayDateStr = () => "2026-06-30";
    echoGame.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    echoGame.masteryMeters = { ...g.masteryMeters };
    let echoStartedIndex = null;
    echoGame.startLevel = (index) => { echoStartedIndex = index; };
    assertEquals(true, echoGame.startFrontierChallenge({ source: "dark-matter-echo" }), "Dark Matter Echo starts a tagged Frontier run");
    assertEquals(true, echoGame.dailyInfo.darkMatterEcho, "Echo Frontier run keeps the Dark Matter Echo tag");
    assertEquals(echoGame.dailyInfo.planetIndex, echoStartedIndex, "Echo Frontier run launches its selected planet");
    assertEquals("Dark Matter Echo: Frontier evidence + signal clue", echoGame.dailyInfo.labGoal, "Echo Frontier run rewrites the lab goal around signal evidence");
    assertEquals("Dark Matter Echo: decode anomaly", echoGame.dailyInfo.labContract.title, "Echo Frontier run uses an echo lab contract");
    assertEquals("Infer hidden forces from Frontier evidence", echoGame.dailyInfo.labContract.concept, "Echo lab contract names the hidden-force concept");
    assertEquals(true, /stars, time, and motion clues/.test(echoGame.dailyInfo.labContract.body), "Echo lab contract asks for Frontier evidence comparison");
    const echoContract = echoGame.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("DARK MATTER ECHO CONTRACT", echoContract.kicker, "Echo Frontier clear keeps the first future-lab loop");
    assertEquals("Dark Matter Echo: decode anomaly", echoContract.title, "Echo clear contract keeps the echo lab focus");
    assertEquals("Reward: Dark Matter Echo + share code", echoContract.reward, "Echo clear contract names the echo reward");
    assertEquals("dark-matter-echo", echoContract.action, "Echo clear contract restarts another tagged echo run");
    assertEquals("RUN ECHO", echoContract.cta, "Echo clear contract uses the echo CTA");
    let echoReplayOptions = null;
    echoGame.startFrontierChallenge = (options) => { echoReplayOptions = options || null; return true; };
    assertEquals(true, echoGame.runClearReplayContract(echoContract), "Echo clear contract action should start another echo run");
    assertEquals("dark-matter-echo", echoReplayOptions && echoReplayOptions.source, "Echo clear action should preserve the Dark Matter Echo tag");

    const prepGame = new StarHopperGame();
    prepGame.getTodayDateStr = () => "2026-06-30";
    prepGame.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    prepGame.masteryMeters = { ...g.masteryMeters };
    let prepStartedIndex = null;
    prepGame.startLevel = (index) => { prepStartedIndex = index; };
    assertEquals(true, prepGame.startFrontierChallenge({ source: "dark-matter-prep" }), "Dark Matter prep starts a tagged Frontier run");
    assertEquals(true, prepGame.dailyInfo.darkMatterPrep, "Prep Frontier run keeps the Dark Matter prep tag");
    assertEquals(prepGame.dailyInfo.planetIndex, prepStartedIndex, "Prep Frontier run launches its selected planet");
    assertEquals("Dark Matter Prep: curve + speed + force evidence", prepGame.dailyInfo.labGoal, "Prep Frontier run rewrites the lab goal around evidence");
    assertEquals("Dark Matter Prep: curve evidence", prepGame.dailyInfo.labContract.title, "Prep Frontier run uses a Dark Matter lab contract");
    assertEquals("Infer hidden forces from motion", prepGame.dailyInfo.labContract.concept, "Prep lab contract names the hidden-force concept");
    assertEquals(true, /path curve, speed, and force/.test(prepGame.dailyInfo.labContract.body), "Prep lab contract asks for curve/speed/force comparison");
    assertEquals(true, !!prepGame.dailyInfo.labContract.command, "Prep lab contract keeps the runnable replay command");
    const prepContract = prepGame.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("DARK MATTER PREP CONTRACT", prepContract.kicker, "Prep Frontier clear keeps the future-lab prep loop");
    assertEquals("Dark Matter Prep: curve evidence", prepContract.title, "Prep clear contract keeps the Dark Matter lab focus");
    assertEquals(true, /hidden-force clues/.test(prepContract.body), "Prep clear contract preserves the evidence framing");
    assertEquals("Reward: hidden-force evidence + share code", prepContract.reward, "Prep clear contract names the hidden-force reward");
    assertEquals("dark-matter-prep", prepContract.action, "Prep clear contract restarts another tagged prep run");
    assertEquals("RUN PREP", prepContract.cta, "Prep clear contract uses the prep CTA");

    const sourceGame = new StarHopperGame();
    sourceGame.getTodayDateStr = () => "2026-06-30";
    sourceGame.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    sourceGame.masteryMeters = { ...g.masteryMeters };
    let sourceStartedIndex = null;
    sourceGame.startLevel = (index) => { sourceStartedIndex = index; };
    assertEquals(true, sourceGame.startFrontierChallenge({ source: "future-source" }), "Future Source starts a tagged Frontier run");
    assertEquals(true, sourceGame.dailyInfo.futureSourcePrep, "Source Frontier run keeps the Future Source tag");
    assertEquals(sourceGame.dailyInfo.planetIndex, sourceStartedIndex, "Source Frontier run launches its selected planet");
    assertEquals("Future Source Key: hidden force + probability evidence", sourceGame.dailyInfo.labGoal, "Source Frontier run rewrites the lab goal around source evidence");
    assertEquals("Future Source Key: source rehearsal", sourceGame.dailyInfo.labContract.title, "Source Frontier run uses a source-key lab contract");
    assertEquals("Combine hidden-force inference with probability evidence", sourceGame.dailyInfo.labContract.concept, "Source lab contract names the combined concept");
    assertEquals(true, /hidden-force clues with branch and chance evidence/.test(sourceGame.dailyInfo.labContract.body), "Source lab contract asks for source-key comparison");
    assertEquals(true, !!sourceGame.dailyInfo.labContract.command, "Source lab contract keeps the runnable replay command");
    const sourceContract = sourceGame.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("SOURCE KEY CONTRACT", sourceContract.kicker, "Source Frontier clear keeps the source-key loop");
    assertEquals("Future Source Key: source rehearsal", sourceContract.title, "Source clear contract keeps the source-key lab focus");
    assertEquals(true, /source key/.test(sourceContract.body), "Source clear contract preserves the capstone framing");
    assertEquals("Reward: source key record + share code", sourceContract.reward, "Source clear contract names the source-key reward");
    assertEquals("future-source", sourceContract.action, "Source clear contract restarts another tagged source run");
    assertEquals("RUN SOURCE", sourceContract.cta, "Source clear contract uses the source CTA");
    let sourceReplayOptions = null;
    sourceGame.startFrontierChallenge = (options) => { sourceReplayOptions = options || null; return true; };
    assertEquals(true, sourceGame.runClearReplayContract(sourceContract), "Source clear contract action should start another source rehearsal");
    assertEquals("future-source", sourceReplayOptions && sourceReplayOptions.source, "Source clear action should preserve the Future Source tag");

    sourceGame.discoveryPassCounts = {
      "signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 1
    };
    const sourceExplainContract = sourceGame.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("SOURCE KEY TESTED", sourceExplainContract.kicker, "After source proof, clear contract should shift to explanation");
    assertEquals("Explain the source key", sourceExplainContract.title, "After source proof, clear contract should name the capstone explanation");
    assertEquals("Reward: Source Key Reflection Proof", sourceExplainContract.reward, "After source proof, clear contract should name the reflection payoff");
    assertEquals("log", sourceExplainContract.action, "After source proof, clear contract should open the Log instead of rerunning source");
    assertEquals("WRITE PROOF", sourceExplainContract.cta, "After source proof, clear contract should use the write-proof CTA");

    sourceGame.masteryMeters = {
      0: {
        sources: {
          "reflection-proof:signal-reflection:signal-lab-proof:future-source:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:test": 14
        }
      }
    };
    const sourceCompleteContract = sourceGame.getClearReplayContract({
      labStars: { stars: 3, maxStars: 3, checks: [{ id: "missions", earned: true }, { id: "gems", earned: true }, { id: "science", earned: true }] },
      clearTime: null,
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null
    });
    assertEquals("SOURCE KEY COMPLETE", sourceCompleteContract.kicker, "Source reflection should make clear contract stop looping on source rehearsal");
    assertEquals("frontier", sourceCompleteContract.action, "Complete source key should move back to normal Frontier practice");
    renderTestResult(SUITE, "Frontier Challenge: unlocks after star-map completion", true);
  } catch (err) {
    renderTestResult(SUITE, "Frontier Challenge: unlocks after star-map completion", false, err.message);
  }

  // Test R11c: Frontier records keep the best local clear and expose the share code.
  const oldGetElementByIdR11c = document.getElementById;
  const oldBubblePopR11c = ComicBubbles.pop;
  const oldParticleBurstR11c = Particles.spawnBurst;
  try {
    const shareLabels = [];
    let shareBursts = 0;
    ComicBubbles.pop = (x, y, text) => { shareLabels.push(text); };
    Particles.spawnBurst = () => { shareBursts++; };
    const g = new StarHopperGame();
    g.getTodayDateStr = () => "2026-06-30";
    g.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    g.masteryMeters = { 0: { xp: 120 }, 1: { xp: 120 }, 2: { xp: 120 }, 3: { xp: 120 }, 4: { xp: 120 }, 5: { xp: 120 } };
    const frontier = g.getFrontierChallenge();
    const first = g.recordFrontierClear({
      frontierInfo: frontier,
      labStars: { stars: 2 },
      clearTime: { elapsed: 48.2 }
    });
    assertEquals(true, first.isNewBest, "First Frontier clear creates a local record");
    const worse = g.recordFrontierClear({
      frontierInfo: frontier,
      labStars: { stars: 1 },
      clearTime: { elapsed: 36.1 }
    });
    assertEquals(false, worse.isNewBest, "Faster but lower-star Frontier clear should not replace the best record");
    const better = g.recordFrontierClear({
      frontierInfo: frontier,
      labStars: { stars: 3 },
      clearTime: { elapsed: 44.4 }
    });
    assertEquals(true, better.isNewBest, "Higher-star Frontier clear replaces the local record");
    const summary = g.getFrontierRecordSummary("2026-06-30");
    assertEquals(1, summary.count, "Frontier summary counts local records");
    assertEquals(3, summary.today.stars, "Frontier summary returns today's best stars");
    assertEquals(true, g.getFrontierShareText(frontier).indexOf(frontier.shareCode) >= 0, "Share text includes today's code");
    assertEquals(true, /Pilot/.test(g.getFrontierShareText(frontier)), "Share text includes a pasteable pilot label");

    const parsed = g.parseFrontierShareText(`${frontier.shareCode} · Pilot Ada · Tier 2 Earth Base Camp: remix lane · best 2/3 · 55.5s`);
    assertEquals(frontier.shareCode, parsed.shareCode, "Frontier parser extracts the share code");
    assertEquals("Ada", parsed.pilot, "Frontier parser extracts the pilot name");
    assertEquals(2, parsed.stars, "Frontier parser extracts star proof");
    assertEquals(55.5, parsed.bestTime, "Frontier parser extracts clear time");
    assertEquals("Earth Base Camp", parsed.planetName, "Frontier parser extracts the planet label");

    const imported = g.importFrontierShareText(`${frontier.shareCode} · Pilot Ada · Tier 2 Earth Base Camp: remix lane · best 2/3 · 55.5s`);
    assertEquals(true, imported.isNewBest, "First imported Frontier record starts the board");
    const ignored = g.importFrontierShareText(`${frontier.shareCode} · Pilot Ada · Tier 1 Earth Base Camp: remix lane · best 1/3 · 41.0s`);
    assertEquals(false, ignored.isNewBest, "Worse imported Frontier record does not replace the board entry");
    const upgraded = g.importFrontierShareText(`${frontier.shareCode} · Pilot Ada · Tier 2 Earth Base Camp: remix lane · best 3/3 · 60.0s`);
    assertEquals(true, upgraded.isNewBest, "Higher-star imported Frontier record replaces the board entry");
    assertEquals(3, g.getFrontierBoardList()[0].stars, "Frontier board returns the strongest imported record");
    const rival = g.importFrontierShareText(`${frontier.shareCode} · Pilot Grace · Tier ${frontier.tier} Earth Base Camp: remix lane · best 3/3 · 35.0s`);
    assertEquals(true, rival.isNewBest, "Faster same-star rival replaces the class board entry");
    const target = g.getFrontierRivalTarget(frontier);
    assertEquals("chase", target.state, "A stronger classmate record becomes a chase target");
    assertEquals("Grace", target.entry.pilot, "Rival target names the classmate to beat");
    assertEquals(true, /under 35\.0s/.test(target.label), "Rival target names the time to beat");
    const behindResult = g.getFrontierRivalClearResult({
      frontierInfo: frontier,
      labStars: { stars: 3 },
      clearTime: { elapsed: 36.0 }
    });
    assertEquals("behind", behindResult.state, "A slower same-star clear remains behind the imported rival");
    assertEquals(true, /Grace still leads/.test(behindResult.body), "Behind result should name the remaining class target");
    const chaseContract = g.getClearReplayContract({
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ]
      },
      clearTime: { elapsed: 36.0, best: 36.0, isNewBest: true },
      isDailyRun: true,
      isFrontierRun: true,
      frontierRivalResult: behindResult
    });
    assertEquals("FRONTIER RIVAL CONTRACT", chaseContract.kicker, "Behind Frontier clears should become a rival-specific replay contract");
    assertEquals("Catch Grace", chaseContract.title, "Rival replay contract should name the classmate target");
    assertEquals("CHASE RIVAL", chaseContract.cta, "Rival replay contract should expose a direct chase action");
    assertEquals(true, /under 35\.0s/.test(chaseContract.reward), "Rival replay contract should preserve the target time");
    const beatenResult = g.getFrontierRivalClearResult({
      frontierInfo: frontier,
      labStars: { stars: 3 },
      clearTime: { elapsed: 34.0 }
    });
    assertEquals("beaten", beatenResult.state, "A faster same-star clear beats the imported rival");
    assertEquals(true, /RIVAL BEATEN: Grace/.test(beatenResult.label), "Beaten result should label the classmate win");
    const pulsePanel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? pulsePanel : null;
    const matchedResult = g.getFrontierRivalClearResult({
      frontierInfo: frontier,
      labStars: { stars: 3 },
      clearTime: { elapsed: 35.0 }
    });
    const matchGame = new StarHopperGame();
    matchGame.currentPlanet = PLANETS[0];
    matchGame.currentPlanetIndex = 0;
    matchGame.masteryMeters = {};
    const matchedProof = matchGame.grantFrontierRivalProof(matchedResult);
    assertEquals("RIVAL MATCH", matchedProof && matchedProof.label, "Matching a rival should bank a smaller proof reward");
    assertEquals(frontier.tier, matchedProof && matchedProof.tier, "Matched rival proof should remember the Frontier tier");
    assertEquals(7, matchGame.researchXP, "Matched Tier 3 rival proof should add scaled Research XP once");
    assertEquals(12, matchGame.getWorldMasteryProgress(0).xp, "Matched Tier 3 rival proof should add scaled world mastery XP");
    g.player = { x: 80, y: 90, w: 24, h: 32 };
    const rivalProof = g.grantFrontierRivalProof(beatenResult);
    assertEquals("RIVAL PROOF", rivalProof && rivalProof.label, "Beating a rival should bank a Frontier rival proof");
    assertEquals(frontier.tier, rivalProof && rivalProof.tier, "Beaten rival proof should remember the Frontier tier");
    assertEquals(2, rivalProof && rivalProof.tierBonusXP, "Tier 3 rival proof should add a two-point Research XP tier bonus");
    assertEquals(10, g.researchXP, "Beaten Tier 3 rival proof should add scaled Research XP once");
    assertEquals(136, g.getWorldMasteryProgress(0).xp, "Beaten Tier 3 rival proof should add scaled world mastery XP");
    assertEquals("Frontier Rival Beaten", g.discoveryPulse && g.discoveryPulse.title, "Rival proof should create a discovery pulse");
    assertEquals(true, /RIVAL PROOF \+10 XP/.test(pulsePanel.innerHTML), "Discovery pulse should render the scaled rival proof chip");
    assertEquals(true, /T3/.test(pulsePanel.innerHTML), "Discovery pulse should show the rival proof tier");
    assertEquals(null, g.grantFrontierRivalProof(beatenResult), "Repeating the same rival proof should not farm XP");
    assertEquals(10, g.researchXP, "Repeated rival proof should not add Research XP");
    assertEquals(null, g.grantFrontierRivalProof(matchedResult), "A lower matched proof should not pay after the same rival was beaten");

    const ladderPanel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? ladderPanel : null;
    const ladderGame = new StarHopperGame();
    ladderGame.currentPlanet = PLANETS[0];
    ladderGame.currentPlanetIndex = 0;
    ladderGame.masteryMeters = {};
    ladderGame.player = { x: 90, y: 90, w: 24, h: 32 };
    ladderGame.discoveryPassCounts = {
      "frontier-rival:beaten:first:ada:t1:s3:time420": 1,
      "frontier-rival:matched:second:ben:t2:s3:time390": 1
    };
    const ladderResult = {
      state: "beaten",
      label: "RIVAL BEATEN: Grace",
      body: "Your 3/3 Lab Stars reached the class target from Grace. Share your updated Frontier line.",
      monitorText: "RIVAL BEATEN: Grace · 3/3 · 34.0s",
      local: { ...beatenResult.local },
      entry: { ...beatenResult.entry, shareCode: "FRONTIER-EARTH-3333", tier: frontier.tier, pilot: "Grace" },
      shareCode: "FRONTIER-EARTH-3333"
    };
    const ladderProof = ladderGame.grantFrontierRivalProof(ladderResult);
    assertEquals("RIVAL LADDER", ladderProof && ladderProof.frontierRivalMilestone && ladderProof.frontierRivalMilestone.label, "Third unique rival proof should unlock the Rival Ladder milestone");
    assertEquals(17, ladderGame.researchXP, "Rival Ladder should add milestone XP on top of the scaled rival proof");
    assertEquals(26, ladderGame.getWorldMasteryProgress(0).xp, "Rival Ladder should add milestone world mastery on top of the proof");
    assertEquals(1, ladderGame.discoveryPassCounts[ladderGame.getFrontierRivalMilestoneSourceKey(3)], "Rival Ladder milestone should store a one-time source");
    assertEquals(true, /RIVAL LADDER \+7 XP/.test(ladderPanel.innerHTML), "Discovery pulse should render the Rival Ladder chip");
    assertEquals(true, shareLabels.includes("RIVAL LADDER!"), "Rival Ladder should create an in-world milestone pop");
    assertEquals(null, ladderGame.grantFrontierRivalMilestone(ladderGame.discoveryPulse, ladderProof), "Rival Ladder milestone should not repeat");

    const rivalEffect = g.spawnFrontierRivalClearEffect(beatenResult);
    assertEquals("RIVAL BEATEN!", rivalEffect.label, "Beating a rival should create an in-level payoff cue");
    assertEquals("FRONTIER CRT", g.missionBalloon && g.missionBalloon.title, "Rival payoff should write to the mission CRT");
    assertEquals(true, /RIVAL BEATEN: Grace/.test(g.missionBalloon && g.missionBalloon.text), "Rival payoff should keep the classmate label in the Mission CRT");
    assertEquals(true, /\+10 Research XP/.test(g.missionBalloon && g.missionBalloon.text), "Rival payoff should show the scaled banked Research XP");
    assertEquals(true, shareLabels.includes("+10 RESEARCH"), "Rival payoff should pop the scaled Research XP cue");

    const els = {
      "daily-signal-label": { textContent: "" },
      "frontier-signal-btn": { style: {}, textContent: "", title: "", dataset: {} },
      "daily-signal-code": { textContent: "", title: "", style: {} },
      "daily-signal-btn": { textContent: "", title: "", dataset: {} },
      "frontier-signal-code": { textContent: "", title: "", style: {} },
      "frontier-record-banner": { style: {} },
      "frontier-record-label": { textContent: "" },
      "frontier-record-detail": { textContent: "" },
      "frontier-share-btn": { textContent: "", title: "" },
      "frontier-board": { style: {} },
      "frontier-board-list": { innerHTML: "" },
      "frontier-rival-target": { classList: { toggle: () => {} } },
      "frontier-rival-copy": { textContent: "" },
      "frontier-rival-btn": { style: {} },
      "clear-lab-report": { innerHTML: "" }
    };
    document.getElementById = (id) => els[id] || null;
    const bannerDaily = g.getDailySignal();
    g.refreshDailySignalBanner();
    assertEquals(true, /Daily Signal/.test(els["daily-signal-label"].textContent), "Daily strip should render the daily challenge");
    assertEquals(true, els["daily-signal-label"].textContent.indexOf(bannerDaily.concept) >= 0, "Daily strip should name the science concept");
    assertEquals(true, els["daily-signal-label"].textContent.indexOf(bannerDaily.labContract.title) >= 0, "Daily strip should name the replay lab focus");
    assertEquals(true, els["daily-signal-code"].textContent.indexOf(bannerDaily.labContract.command.split("\n")[0]) >= 0, "Daily strip should expose the first sample command");
    assertEquals(true, /3★ Try:/.test(els["daily-signal-code"].textContent), "Daily strip should frame the command as a 3-star proof attempt");
    assertEquals("inline-block", els["daily-signal-code"].style.display, "Daily sample command should be visible before launch");
    assertEquals(true, /3 Lab Stars/.test(els["daily-signal-btn"].title), "Daily accept button should name the lab-star goal");
    assertEquals(true, els["daily-signal-btn"].title.indexOf(bannerDaily.labContract.command.split("\n")[0]) >= 0, "Daily accept button should preserve the first sample command");
    assertEquals(bannerDaily.labContract.command.split("\n")[0], els["daily-signal-btn"].dataset.command, "Daily accept button should carry the sample command");
    assertEquals("flex", els["frontier-record-banner"].style.display, "Frontier record banner should appear after star-map completion");
    assertEquals(true, /Today's frontier cleared/.test(els["frontier-record-label"].textContent), "Banner should show today's local clear");
    assertEquals(true, /Best T/.test(els["frontier-record-detail"].textContent), "Banner should show the local best tier");
    assertEquals(true, els["frontier-share-btn"].title.indexOf("FRONTIER-") >= 0, "Copy button should carry the share code");
    assertEquals(true, els["frontier-signal-code"].textContent.indexOf(frontier.labContract.command.split("\n")[0]) >= 0, "Frontier strip should expose the first sample command");
    assertEquals(true, /Frontier 3★ Try:/.test(els["frontier-signal-code"].textContent), "Frontier strip should frame the command as a 3-star proof attempt");
    assertEquals("inline-block", els["frontier-signal-code"].style.display, "Frontier sample command should be visible before launch");
    assertEquals(true, /3 Lab Stars/.test(els["frontier-signal-btn"].title), "Frontier button should name the lab-star goal");
    assertEquals(true, els["frontier-signal-btn"].title.indexOf(frontier.labContract.title) >= 0, "Frontier button should name the replay lab focus");
    assertEquals(true, els["frontier-signal-btn"].title.indexOf(frontier.labContract.command.split("\n")[0]) >= 0, "Frontier button should expose the sample command");
    assertEquals(frontier.labContract.command.split("\n")[0], els["frontier-signal-btn"].dataset.command, "Frontier start button should carry the sample command");
    assertEquals("grid", els["frontier-board"].style.display, "Frontier board should appear after star-map completion");
    assertEquals(true, /Grace/.test(els["frontier-board-list"].innerHTML), "Frontier board should render the leading imported pilot");
    assertEquals(true, /Beat Grace/.test(els["frontier-rival-copy"].textContent), "Frontier board should render a specific rival target");
    assertEquals(true, /Ladder: 2 proofs to RIVAL LADDER/.test(els["frontier-rival-copy"].textContent), "Frontier board should preview the next rival ladder milestone");
    assertEquals("inline-flex", els["frontier-rival-btn"].style.display, "Rival chase target should expose a direct start button");
    g.renderClearLabReport({
      isDailyRun: true,
      isFrontierRun: true,
      nextIndex: null,
      labStars: {
        stars: 3,
        maxStars: 3,
        checks: [
          { id: "missions", label: "Mission tasks", earned: true },
          { id: "gems", label: "Mission gems", earned: true },
          { id: "science", label: "Science proof", earned: true }
        ],
        previousBest: 2,
        best: 3,
        isNewBest: true
      },
      clearTime: { elapsed: 34.0, best: 34.0, isNewBest: true },
      frontierRivalResult: beatenResult
    });
    assertEquals(true, /FRONTIER RIVAL/.test(els["clear-lab-report"].innerHTML), "Clear report should add a Frontier rival card");
    assertEquals(true, /RIVAL BEATEN: Grace/.test(els["clear-lab-report"].innerHTML), "Clear report should celebrate the beaten classmate");
    assertEquals(true, /Share your updated Frontier line/.test(els["clear-lab-report"].innerHTML), "Clear report should turn the win into a share loop");
    assertEquals(true, /RIVAL PROOF \+10 XP/.test(els["clear-lab-report"].innerHTML), "Clear report should show the scaled rival proof reward");
    assertEquals(true, /Next ladder: 2 proofs to RIVAL LADDER/.test(els["clear-lab-report"].innerHTML), "Clear report should show the next Rival Ladder target");
    assertEquals(true, /CHASE LADDER/.test(els["clear-lab-report"].innerHTML), "Clear report replay contract should point rival-proof wins at the ladder");
    assertEquals(true, /COPY WIN LINE/.test(els["clear-lab-report"].innerHTML), "Clear report should expose a direct copy action for the updated Frontier line");
    g.recordFrontierClear({
      frontierInfo: frontier,
      labStars: { stars: 3 },
      clearTime: { elapsed: 34.0 }
    });
    const leadingTarget = g.getFrontierRivalTarget(frontier);
    assertEquals("leading", leadingTarget.state, "A stronger local clear flips the rival target into leading state");
    const shareEffect = g.spawnFrontierShareEffect(g.getFrontierShareText(frontier), { copied: true });
    assertEquals("FRONTIER COPIED!", shareEffect.label, "Copying a Frontier line should create a visible share payoff");
    assertEquals(frontier.shareCode, shareEffect.shareCode, "Share payoff should remember the Frontier code");
    assertEquals("FRONTIER LINE COPIED: send it to a classmate", g.missionBalloon && g.missionBalloon.text, "Share payoff should write to the Mission CRT");
    assertEquals(true, shareLabels.includes("FRONTIER COPIED!"), "Share payoff should pop an in-world copy cue");
    assertEquals(true, shareBursts > 0, "Share payoff should spawn particles");
    document.getElementById = oldGetElementByIdR11c;
    ComicBubbles.pop = oldBubblePopR11c;
    Particles.spawnBurst = oldParticleBurstR11c;
    renderTestResult(SUITE, "Frontier Records: local best and class board", true);
  } catch (err) {
    document.getElementById = oldGetElementByIdR11c;
    ComicBubbles.pop = oldBubblePopR11c;
    Particles.spawnBurst = oldParticleBurstR11c;
    renderTestResult(SUITE, "Frontier Records: local best and class board", false, err.message);
  }

  // Test R12: Game-local date formatting uses the browser calendar, not UTC ISO rollover.
  try {
    const g = new StarHopperGame();
    const localLateNight = new Date(2026, 0, 2, 0, 30, 0);
    assertEquals("2026-01-02", g.getTodayDateStr(localLateNight), "Local constructor date should format as the same local calendar day");
    renderTestResult(SUITE, "Daily Signal/Streak: local date avoids UTC rollover", true);
  } catch (err) {
    renderTestResult(SUITE, "Daily Signal/Streak: local date avoids UTC rollover", false, err.message);
  }

  // Test R12b: returning on a later local day grants a small, once-per-day Research XP pulse.
  const oldGetElementByIdR12b = document.getElementById;
  const oldWindowGameR12b = window.Game;
  const oldSaveLocalProgressR12b = (typeof saveLocalProgress === "function") ? saveLocalProgress : null;
  const oldLogMissionBriefingR12b = (typeof logMissionBriefing === "function") ? logMissionBriefing : null;
  const oldBubblePopR12b = ComicBubbles.pop;
  const oldParticleBurstR12b = Particles.spawnBurst;
  try {
    let saveCalls = 0;
    const streakLabels = [];
    let streakBursts = 0;
    saveLocalProgress = () => { saveCalls++; };
    logMissionBriefing = () => {};
    ComicBubbles.pop = (x, y, text) => { streakLabels.push(text); };
    Particles.spawnBurst = () => { streakBursts++; };
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    const banner = { style: {} };
    const count = { textContent: "" };
    const rewardClasses = new Set();
    const reward = {
      textContent: "",
      title: "",
      classList: {
        toggle(cls, active) {
          if (active) rewardClasses.add(cls);
          else rewardClasses.delete(cls);
        },
        remove(...classes) {
          classes.forEach(cls => rewardClasses.delete(cls));
        }
      }
    };
    const focus = { textContent: "" };
    const code = { textContent: "", title: "", style: {} };
    const action = { textContent: "", title: "", dataset: {}, style: {} };
    const input = {
      value: "",
      focused: false,
      selection: null,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange(start, end) { this.selection = [start, end]; }
    };
    document.getElementById = (id) => ({
      "discovery-pulse": panel,
      "return-streak-banner": banner,
      "return-streak-count": count,
      "return-streak-reward": reward,
      "return-streak-focus": focus,
      "return-streak-code": code,
      "return-streak-action": action,
      "console-input": input
    }[id] || null);

    const g = new StarHopperGame();
    g.researchXP = 16;
    g.player = { x: 90, y: 110, w: 24, h: 32 };
    g.getDailySignal = () => ({
      concept: "Force changes motion",
      planetName: "Earth",
      labContract: {
        title: "Mass remix proof",
        command: "hopper.mass = 1.5\nhopper.engine = 6"
      }
    });
    g.getDailySignalForDate = (dateStr) => ({
      concept: "Tomorrow's physics remix",
      planetName: "Moon",
      labContract: {
        title: dateStr === "2026-06-12" ? "Elasticity follow-up" : "Spring chain proof",
        command: dateStr === "2026-06-12" ? "hopper.elasticity = 1.2" : "repeat 3: spawn_spring()"
      }
    });
    g.getTodayDateStr = () => "2026-06-10";
    g.updateReturnStreak();
    assertEquals("2026-06-10", g.lastPlayedDate, "First local day should be recorded");
    assertEquals(1, g.streakCount, "First local day starts the streak");
    assertEquals(16, g.researchXP, "First-ever play should not grant free Research XP");
    assertEquals(null, g.lastReturnStreakReward, "No reward pulse is created on the first-ever day");
    assertEquals("Tomorrow's lab: +5 Research XP · Spring chain proof", reward.textContent, "Start chip should preview tomorrow's daily lab reward and focus");
    assertEquals(true, /2026-06-11/.test(reward.title), "Tomorrow forecast should name the next local date");
    assertEquals(true, /streak day 2/.test(reward.title), "Tomorrow forecast should name the next streak step");
    assertEquals(true, rewardClasses.has("up-next"), "Tomorrow forecast should get the up-next visual state");
    assertEquals("Focus: Mass remix proof", focus.textContent, "Start chip should name today's Daily Signal learning focus");
    assertEquals("hopper.mass = 1.5", code.textContent, "Start chip should show the first Daily Signal sample command");
    assertEquals("inline-block", code.style.display, "Sample command should be visible when today's signal has code");
    assertEquals(true, /Starter command: hopper\.mass = 1\.5/.test(code.title), "Sample command title should preserve the visible command");
    assertEquals("DAILY", action.textContent, "Start chip should expose a direct Daily Signal action");
    assertEquals("daily", action.dataset.action, "Streak action should tag the Daily Signal route");
    assertEquals("Mass remix proof", action.dataset.focus, "Streak action should carry the Daily Signal focus");
    assertEquals("hopper.mass = 1.5", action.dataset.command, "Streak action should carry the first stageable command");
    assertEquals(true, /Mass remix proof/.test(action.title), "Streak action title should name the learning focus");
    assertEquals(true, /hopper\.mass = 1\.5/.test(action.title), "Streak action title should expose the first sample command");
    assertEquals("inline-flex", action.style.display, "Streak action should be visible while the streak chip is visible");
    g.updateReturnStreak();
    assertEquals(1, saveCalls, "Same-day streak refresh should not save or farm rewards");

    g.discoveryLog = [];
    g.getTodayDateStr = () => "2026-06-11";
    g.updateReturnStreak();
    assertEquals("2026-06-11", g.lastPlayedDate, "Next local day should be recorded");
    assertEquals(2, g.streakCount, "Consecutive local day increments the streak");
    assertEquals(21, g.researchXP, "Day 2 streak should grant +5 Research XP");
    assertEquals(5, g.lastReturnStreakReward.rewardXP, "Reward pulse should expose the XP amount");
    assertEquals("Daily Lab Streak", g.discoveryPulse.title, "Daily streak reward should create a discovery pulse");
    assertEquals(2, g.discoveryPulse.streakCount, "Daily streak reward should expose the streak count");
    assertEquals("DAY 2 STREAK!", g.discoveryPulse.streakEffect && g.discoveryPulse.streakEffect.label, "Daily streak reward should pop an in-level streak cue");
    assertEquals("LAB RANK UP!", g.discoveryPulse.rankEffect && g.discoveryPulse.rankEffect.label, "Daily streak rank-up should create an in-level lab-rank cue");
    assertEquals("DAILY STREAK: +5 Research XP", g.missionBalloon && g.missionBalloon.text, "Daily streak reward should write a Daily Lab CRT reward line");
    assertEquals(true, streakLabels.includes("DAY 2 STREAK!"), "Daily streak reward should call the streak bubble");
    assertEquals(true, streakLabels.includes("LAB RANK UP!"), "Daily streak rank-up should pop a visible lab-rank cue");
    assertEquals(true, streakBursts > 0, "Daily streak reward should spawn celebration particles");
    assertEquals(1, g.discoveryLog.length, "Daily streak reward enters the discovery log");
    assertEquals(true, /Rank Up: Variable Scout/.test(panel.innerHTML), "Discovery pulse should render the streak rank-up");
    assertEquals(true, /streak day 2/.test(panel.innerHTML), "Discovery pulse should use the custom streak progress label");
    const streakCadetRecord = getCadetIdentityPreview(g);
    assertEquals(true, /Daily Streak d2 · Mass remix proof/.test(streakCadetRecord.body), "Cadet Record should mirror the active daily lab streak and focus");
    assertEquals("+5 Research XP today", reward.textContent, "Start chip should show today's streak reward");
    assertEquals(true, rewardClasses.has("earned"), "Today's reward should get the earned visual state");
    g.lastReturnStreakReward = null;
    g.refreshStreakBanner();
    assertEquals("Tomorrow's lab: +6 Research XP · Elasticity follow-up", reward.textContent, "Start chip should show tomorrow's focus after today's pulse is gone");
    assertEquals(true, /2026-06-12/.test(reward.title), "Next forecast should advance to the next local date");
    assertEquals(true, rewardClasses.has("up-next"), "Next forecast should return to the up-next visual state");
    let dailyCalls = 0;
    g.startDailySignal = () => { dailyCalls++; g.dailyInfo = g.getDailySignal(); return true; };
    window.Game = g;
    assertEquals(true, runReturnStreakAction(g), "Streak action should launch the Daily Signal");
    assertEquals(1, dailyCalls, "Streak action should call the Daily Signal starter once");
    assertEquals("hopper.mass = 1.5\nhopper.engine = 6", input.value, "Streak action should stage the full Daily Signal contract command");
    assertEquals(true, input.focused, "Streak action should focus the terminal after staging");
    assertEquals("signal-lab-contract", g.lastStagedExperiment && g.lastStagedExperiment.source, "Streak action should stage through the Signal Lab proof source");
    assertEquals("Mass remix proof", g.lastStagedExperiment && g.lastStagedExperiment.title, "Streak action should preserve the Daily Signal focus title");
    g.streakCount = 0;
    g.refreshStreakBanner();
    assertEquals("", reward.title, "Streak reward title should clear when the chip is hidden");
    assertEquals(false, rewardClasses.has("earned") || rewardClasses.has("up-next"), "Streak reward visual states should clear when hidden");
    assertEquals("", focus.textContent, "Streak focus should clear when the streak chip is hidden");
    assertEquals("", code.textContent, "Streak sample command should clear when the streak chip is hidden");
    assertEquals("none", code.style.display, "Streak sample command should hide when the streak chip is hidden");
    assertEquals("none", action.style.display, "Streak action should hide when the streak chip is hidden");
    assertEquals(10, g.getReturnStreakRewardXP(99), "Daily streak XP should stay capped");
    const afterRewardXP = g.researchXP;
    g.updateReturnStreak();
    assertEquals(afterRewardXP, g.researchXP, "Same-day repeat should not grant duplicate streak XP");
    assertEquals(2, saveCalls, "Only real date rollovers should save");

    document.getElementById = oldGetElementByIdR12b;
    window.Game = oldWindowGameR12b;
    if (oldSaveLocalProgressR12b) saveLocalProgress = oldSaveLocalProgressR12b;
    if (oldLogMissionBriefingR12b) logMissionBriefing = oldLogMissionBriefingR12b;
    ComicBubbles.pop = oldBubblePopR12b;
    Particles.spawnBurst = oldParticleBurstR12b;
    renderTestResult(SUITE, "Daily Signal/Streak: return streak grants daily Research XP", true);
  } catch (err) {
    document.getElementById = oldGetElementByIdR12b;
    window.Game = oldWindowGameR12b;
    if (oldSaveLocalProgressR12b) saveLocalProgress = oldSaveLocalProgressR12b;
    if (oldLogMissionBriefingR12b) logMissionBriefing = oldLogMissionBriefingR12b;
    ComicBubbles.pop = oldBubblePopR12b;
    Particles.spawnBurst = oldParticleBurstR12b;
    renderTestResult(SUITE, "Daily Signal/Streak: return streak grants daily Research XP", false, err.message);
  }

  // Test R13: planetClears persists through the cadet-profile snapshot/apply cycle.
  // NOTE: game.js declares a top-level `let Game`, which SHADOWS window.Game — so the
  // mock must be assigned to the bare identifier, not just the window property.
  const oldGameR12 = (typeof Game !== "undefined") ? Game : undefined;
  try {
    Game = {
      completedMissions: new Set(["m1"]), earnedBadges: new Set(), unlockedUpgrades: new Set(),
      upgradeLevels: { engine: 0.5 }, planetClears: { 0: 2, 1: 1 }
    };
    window.Game = Game;
    const snap = shCaptureProgress();
    assertEquals(2, snap.planetClears[0], "Snapshot should capture Earth's clear count");
    Game.planetClears = {};
    shApplyProgress(snap);
    assertEquals(2, Game.planetClears[0], "Apply should restore Earth's clear count");
    assertEquals(1, Game.planetClears[1], "Apply should restore Moon's clear count");
    Game = oldGameR12; window.Game = oldGameR12;
    renderTestResult(SUITE, "Mastery: planetClears survives the profile save/load cycle", true);
  } catch (err) {
    Game = oldGameR12; window.Game = oldGameR12;
    renderTestResult(SUITE, "Mastery: planetClears survives the profile save/load cycle", false, err.message);
  }

  // Test R14: Jupiter and Mag-Net (previously 1 flavor each = identical retries) now rotate
  // through >= 3 DISTINCT variant labels — the core non-repeatability fix.
  try {
    const distinctLabels = (planetIndex, attempts) => {
      const s = new Set();
      for (let a = 1; a <= attempts; a++) s.add(buildPlanetVariant(PLANETS[planetIndex], planetIndex, a).variantLabel);
      return s.size;
    };
    assertEquals(true, distinctLabels(2, 3) >= 3, "Jupiter should rotate >= 3 distinct flavors (was 1)");
    assertEquals(true, distinctLabels(4, 3) >= 3, "Mag-Net should rotate >= 3 distinct flavors (was 1)");
    renderTestResult(SUITE, "Variant: Jupiter & Mag-Net now have a real flavor rotation", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Jupiter & Mag-Net now have a real flavor rotation", false, err.message);
  }

  // Test R15: the new vertical-shift flavors still preserve gem count over a deep attempt
  // range (1..10) for every world — the safety net + count-preserving shifts hold.
  try {
    for (let p = 0; p < 5; p++) {
      const base = countTile(PLANETS[p].map, 3);
      for (let att = 1; att <= 10; att++) {
        assertEquals(base, countTile(buildPlanetVariant(PLANETS[p], p, att).map, 3), `Planet ${p} attempt ${att} keeps ${base} gems`);
      }
    }
    renderTestResult(SUITE, "Variant: deep rotation (incl. vertical shifts) preserves gem count", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: deep rotation (incl. vertical shifts) preserves gem count", false, err.message);
  }

  // Test R16: rvShiftTilesV preserves count and only moves tiles into empty cells.
  try {
    const m = [[0,0,0],[3,1,0],[0,0,0]];
    const before = countTile(m, 3);
    rvShiftTilesV(m, 3, 1); // the gem at (1,0) can drop to (2,0) which is empty
    assertEquals(before, countTile(m, 3), "Vertical shift preserves gem count");
    assertEquals(3, m[2][0], "Gem dropped one row into the empty cell");
    const m2 = [[1,0],[3,0]]; // gem at (1,0) blocked above by wall -> stays
    rvShiftTilesV(m2, 3, -1);
    assertEquals(3, m2[1][0], "Blocked vertical shift restores the original cell");
    renderTestResult(SUITE, "Helper: rvShiftTilesV preserves count and respects blockers", true);
  } catch (err) {
    renderTestResult(SUITE, "Helper: rvShiftTilesV preserves count and respects blockers", false, err.message);
  }

  // Test R17: the new Phase-2 progression fields round-trip through the profile snapshot.
  try {
    const oldGameR16 = (typeof Game !== "undefined") ? Game : undefined;
    Game = {
      completedMissions: new Set(), earnedBadges: new Set(), unlockedUpgrades: new Set(),
      upgradeLevels: {}, planetClears: {},
      bestClearTimes: { 0: 12.4 }, bestLabStars: { 0: 3 }, masteryCleared: { 1: true }, masteryMeters: {},
      villageTrust: { 0: { points: 7, badges: ["friend", "ally"], sources: { "village-trade:0:geary:engine_1": 3, "village-rescue:0:geary": 4 } } },
      dailySignalClears: 3, lastPlayedDate: "2026-06-13", streakCount: 5,
      frontierRecords: { "2026-06-30": { dateStr: "2026-06-30", shareCode: "FRONTIER-EARTH-1234", tier: 2, stars: 3, bestTime: 31.2 } },
      frontierBoard: { "FRONTIER-MOON-2222": { dateStr: "2026-06-30", shareCode: "FRONTIER-MOON-2222", tier: 2, stars: 2, bestTime: 42.5, pilot: "Ada" } },
      researchXP: 24, discoveryCombo: 1, discoveryLog: [], discoveryPassCounts: { "science-checkpoint:0:agility:50": 1 },
      discoveredFormulaKinds: new Set(["mass"]),
      codeConcepts: new Set(["ASSIGN", "IF"]),
      confirmedHypotheses: new Set(["earth-gravity-wall"])
    };
    window.Game = Game;
    const snap = shCaptureProgress();
    Game.bestClearTimes = {}; Game.bestLabStars = {}; Game.dailySignalClears = 0; Game.frontierRecords = {}; Game.frontierBoard = {}; Game.lastPlayedDate = null; Game.streakCount = 0; Game.masteryCleared = {}; Game.villageTrust = {}; Game.researchXP = 0; Game.discoveryPassCounts = {}; Game.discoveredFormulaKinds = new Set(); Game.codeConcepts = new Set(); Game.confirmedHypotheses = new Set();
    shApplyProgress(snap);
    assertEquals(12.4, Game.bestClearTimes[0], "best clear time round-trips");
    assertEquals(3, Game.bestLabStars[0], "best lab stars round-trip");
    assertEquals(true, Game.masteryCleared[1], "mastery-cleared flag round-trips");
    assertEquals(7, Game.villageTrust[0].points, "village trust points round-trip");
    assertEquals(4, Game.villageTrust[0].sources["village-rescue:0:geary"], "village trust sources round-trip");
    assertEquals(3, Game.dailySignalClears, "daily-signal clears round-trip");
    assertEquals("FRONTIER-EARTH-1234", Game.frontierRecords["2026-06-30"].shareCode, "Frontier records round-trip");
    assertEquals("Ada", Game.frontierBoard["FRONTIER-MOON-2222"].pilot, "Frontier class board round-trips");
    assertEquals("2026-06-13", Game.lastPlayedDate, "lastPlayedDate round-trips");
    assertEquals(5, Game.streakCount, "streakCount round-trips");
    assertEquals(24, Game.researchXP, "Research XP round-trips");
    assertEquals(1, Game.discoveryPassCounts["science-checkpoint:0:agility:50"], "Science checkpoint proof source round-trips");
    assertEquals(true, Game.discoveredFormulaKinds.has("mass"), "Formula cards round-trip");
    assertEquals(true, Game.codeConcepts.has("IF"), "Code concepts round-trip");
    assertEquals(true, Game.confirmedHypotheses.has("earth-gravity-wall"), "Confirmed hypotheses round-trip");
    Game = oldGameR16; window.Game = oldGameR16;
    renderTestResult(SUITE, "Persistence: Phase-2 progression fields survive save/load", true);
  } catch (err) {
    renderTestResult(SUITE, "Persistence: Phase-2 progression fields survive save/load", false, err.message);
  }

  // Test R18: Daily Signal clears are side-challenge progress, not campaign clears.
  const oldSaveR18 = (typeof saveLocalProgress === 'function') ? saveLocalProgress : null;
  const oldAttemptFinishR18 = (typeof attemptLogFinish === 'function') ? attemptLogFinish : null;
  try {
    saveLocalProgress = () => {};
    attemptLogFinish = () => {};
    const g = new StarHopperGame();
    g.currentPlanet = PLANETS[1];
    g.currentPlanetIndex = 1;
    g.player = { x: 64, y: 200, w: 24, h: 32 };
    g.planetClears = { 0: 1 };
    g.dailySignalClears = 2;
    g.remixContext = 'daily';
    g.dailyInfo = { planetIndex: 1, shareCode: "MOON-1234" };
    g.clearLevel();
    assertEquals(3, g.dailySignalClears, "Daily clear count increments");
    assertEquals(undefined, g.planetClears[1], "Daily clear should not mark Moon as campaign-cleared");
    assertEquals("log", g.clearAction, "Daily clear button routes to log instead of next campaign planet");
    assertEquals(null, g.lastSciencePassportStamp || null, "Daily clear should not grant a campaign Passport Stamp");
    assertEquals(undefined, g.discoveryPassCounts && g.discoveryPassCounts["passport-stamp:1"], "Daily clear should not store a Passport Stamp source");

    const frontier = new StarHopperGame();
    frontier.currentPlanet = PLANETS[2];
    frontier.currentPlanetIndex = 2;
    frontier.player = { x: 64, y: 200, w: 24, h: 32 };
    frontier.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    frontier.dailySignalClears = 3;
    frontier.remixContext = 'daily';
    frontier.dailyInfo = { planetIndex: 2, dateStr: "2026-06-30", shareCode: "FRONTIER-JUPITER-2222", isFrontier: true, tier: 4 };
    frontier.clearLevel();
    assertEquals(3, frontier.dailySignalClears, "Frontier clear should not inflate Daily Signal clears");
    assertEquals(1, frontier.planetClears[2], "Frontier clear should not advance campaign clears");
    assertEquals("log", frontier.clearAction, "Frontier clear routes to log instead of next campaign planet");
    assertEquals(null, frontier.lastSciencePassportStamp || null, "Frontier clear should not grant a campaign Passport Stamp");
    if (oldSaveR18) saveLocalProgress = oldSaveR18;
    if (oldAttemptFinishR18) attemptLogFinish = oldAttemptFinishR18;
    renderTestResult(SUITE, "Daily Signal/Frontier: side clears do not advance campaign", true);
  } catch (err) {
    if (oldSaveR18) saveLocalProgress = oldSaveR18;
    if (oldAttemptFinishR18) attemptLogFinish = oldAttemptFinishR18;
    renderTestResult(SUITE, "Daily Signal/Frontier: side clears do not advance campaign", false, err.message);
  }

  // Test R19: backup/cloud payloads include the full profile progress schema.
  const oldGameR19 = (typeof Game !== "undefined") ? Game : undefined;
  try {
    Game = {
      completedMissions: new Set(["earth-gravity"]),
      earnedBadges: new Set(["variables"]),
      unlockedUpgrades: new Set(["engine"]),
      upgradeLevels: { engine: 0.75 },
      planetClears: { 0: 2 },
      bestClearTimes: { 0: 38.2 },
      bestLabStars: { 0: 3 },
      masteryCleared: { 0: true },
      masteryMeters: { 0: { xp: 80, badges: ["scout"], sources: { combat: 50 } } },
      villageTrust: { 0: { points: 4, badges: ["friend"], sources: { "village-rescue:0:geary": 4 } } },
      dailySignalClears: 4,
      frontierRecords: { "2026-06-30": { dateStr: "2026-06-30", shareCode: "FRONTIER-EARTH-1234", tier: 2, stars: 3, bestTime: 31.2 } },
      frontierBoard: { "FRONTIER-MOON-2222": { dateStr: "2026-06-30", shareCode: "FRONTIER-MOON-2222", tier: 2, stars: 2, bestTime: 42.5, pilot: "Ada" } },
      lastPlayedDate: "2026-06-18",
      streakCount: 3,
      researchXP: 42,
      discoveryCombo: 2,
      discoveryLog: [{ title: "Mass Lab", formula: "a = F / m" }],
      discoveryPassCounts: { "earth-gravity-wall": 1 },
      discoveredFormulaKinds: new Set(["mass", "loop"]),
      codeConcepts: new Set(["ASSIGN", "LOOP"]),
      confirmedHypotheses: new Set(["earth-gravity-wall"])
    };
    window.Game = Game;
    const payload = buildSavePayload();
    assertEquals(2, payload.schemaVersion, "Payload should be versioned");
    assertEquals(0.75, payload.profileProgress.upgradeLevels.engine, "Upgrade levels should export");
    assertEquals(2, payload.profileProgress.planetClears[0], "Campaign clear counts should export");
    assertEquals(3, payload.profileProgress.bestLabStars[0], "Best lab-star scores should export");
    assertEquals(4, payload.profileProgress.dailySignalClears, "Daily Signal clears should export");
    assertEquals("FRONTIER-EARTH-1234", payload.profileProgress.frontierRecords["2026-06-30"].shareCode, "Frontier records should export");
    assertEquals("Ada", payload.profileProgress.frontierBoard["FRONTIER-MOON-2222"].pilot, "Frontier board should export");
    assertEquals(4, payload.profileProgress.villageTrust[0].points, "Village trust should export");
    assertEquals(42, payload.profileProgress.researchXP, "Research XP should export");
    assertEquals(1, payload.profileProgress.discoveryPassCounts["earth-gravity-wall"], "Discovery progress should export");
    assertEquals(true, payload.profileProgress.discoveredFormulaKinds.includes("loop"), "Formula card kinds should export");
    assertEquals(true, payload.profileProgress.codeConcepts.includes("LOOP"), "Code concept cards should export");
    assertEquals(true, payload.profileProgress.confirmedHypotheses.includes("earth-gravity-wall"), "Confirmed hypotheses should export");
    const merged = mergeProgress(
      { unlockedUpgrades: ["jump"], upgradeLevels: { engine: 0.25 }, planetClears: { 0: 1 }, bestLabStars: { 0: 1, 1: 2 }, masteryMeters: { 0: { xp: 95, badges: ["engineer"], sources: { stars: 40 } } }, villageTrust: { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } }, frontierRecords: { "2026-06-30": { dateStr: "2026-06-30", shareCode: "FRONTIER-EARTH-9999", tier: 2, stars: 2, bestTime: 25.4 } }, frontierBoard: { "FRONTIER-MOON-2222": { dateStr: "2026-06-30", shareCode: "FRONTIER-MOON-2222", tier: 2, stars: 3, bestTime: 49.5, pilot: "Grace" } }, researchXP: 8, discoveryPassCounts: { "earth-gravity-wall": 0 }, discoveredFormulaKinds: ["friction"], codeConcepts: ["IF"], confirmedHypotheses: ["moon-canyon-jump"] },
      progressFromSavePayload(payload)
    );
    assertEquals(true, merged.unlockedUpgrades.includes("engine"), "Incoming unlocked upgrade survives merge");
    assertEquals(true, merged.unlockedUpgrades.includes("jump"), "Local unlocked upgrade survives merge");
    assertEquals(0.75, merged.upgradeLevels.engine, "Merge keeps the higher upgrade level");
    assertEquals(2, merged.planetClears[0], "Merge keeps the higher clear count");
    assertEquals(3, merged.bestLabStars[0], "Merge keeps the higher lab-star count");
    assertEquals(2, merged.bestLabStars[1], "Merge keeps local lab-star counts for other planets");
    assertEquals(95, merged.masteryMeters[0].xp, "Merge keeps the higher world mastery XP");
    assertEquals(true, merged.masteryMeters[0].badges.includes("scout"), "Incoming world mastery badge survives merge");
    assertEquals(true, merged.masteryMeters[0].badges.includes("engineer"), "Local world mastery badge survives merge");
    assertEquals(50, merged.masteryMeters[0].sources.combat, "Incoming mastery source survives merge");
    assertEquals(40, merged.masteryMeters[0].sources.stars, "Local mastery source survives merge");
    assertEquals(7, merged.villageTrust[0].points, "Village trust merges unique local and incoming sources");
    assertEquals(3, merged.villageTrust[0].sources["village-trade:0:geary:engine_1"], "Local village trust source survives merge");
    assertEquals(4, merged.villageTrust[0].sources["village-rescue:0:geary"], "Incoming village trust source survives merge");
    assertEquals("FRONTIER-EARTH-1234", merged.frontierRecords["2026-06-30"].shareCode, "Merge keeps the stronger Frontier record");
    assertEquals("Grace", merged.frontierBoard["FRONTIER-MOON-2222"].pilot, "Merge keeps the stronger Frontier board entry");
    assertEquals(42, merged.researchXP, "Merge keeps the higher Research XP");
    assertEquals(1, merged.discoveryPassCounts["earth-gravity-wall"], "Merge keeps discovery pass progress");
    assertEquals(true, merged.discoveredFormulaKinds.includes("mass"), "Incoming formula card survives merge");
    assertEquals(true, merged.discoveredFormulaKinds.includes("friction"), "Local formula card survives merge");
    assertEquals(true, merged.codeConcepts.includes("LOOP"), "Incoming code concept survives merge");
    assertEquals(true, merged.codeConcepts.includes("IF"), "Local code concept survives merge");
    assertEquals(true, merged.confirmedHypotheses.includes("earth-gravity-wall"), "Incoming confirmed hypothesis survives merge");
    assertEquals(true, merged.confirmedHypotheses.includes("moon-canyon-jump"), "Local confirmed hypothesis survives merge");
    Game = oldGameR19; window.Game = oldGameR19;
    renderTestResult(SUITE, "Persistence: backup/cloud payload keeps rich profile progress", true);
  } catch (err) {
    Game = oldGameR19; window.Game = oldGameR19;
    renderTestResult(SUITE, "Persistence: backup/cloud payload keeps rich profile progress", false, err.message);
  }
}

// Suite 6: Attempt diagnostics — crash → specific lab report with staged fixes
function runDiagnosticsTests() {
  const SUITE = "diag-suite";
  // Pure mock: just the telemetry surface diagnoseFailure reads.
  const makeDiagGame = (over = {}) => Object.assign({
    currentPlanetIndex: 0,
    currentVariant: { constraint: null },
    lastFailure: { tag: "hazard", cause: "contact with terrain hazard!" },
    player: { charType: "hopper", spikes: false },
    getMissionStat: () => null,
    getActiveMass: () => 1.0,
    getJumpForce: () => 22,
    getCurrentGravity: () => 0.6,
    getCurrentFriction: () => 5,
    getUpgradeCap: (k) => ({ mass: 1.0, jump: 22, engine: 8, rocket: 80, antigravity: 6 }[k])
  }, over);

  // Test D1: below-target stat is diagnosed first, with concrete one-tap levers
  try {
    const d = diagnoseFailure(makeDiagGame({
      getMissionStat: () => ({ key: "agility", label: "Agility", value: 12.4, target: 33 })
    }));
    assertEquals(true, /Agility 12\.4 \/ 33/.test(d.title), "Title should read the stat and target: " + d.title);
    assertEquals(true, d.choices.length >= 3, "Should offer at least 3 levers");
    assertEquals(true, d.choices.some((c) => c.command.indexOf("hopper.mass") === 0), "Should offer a mass fix");
    assertEquals(true, d.choices.some((c) => c.command.indexOf("antigravity") === 0), "Unconstrained run should offer antigravity");
    renderTestResult(SUITE, "Diagnosis: below-target stat names the gap + levers", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: below-target stat names the gap + levers", false, err.message);
  }

  // Test D2: the no-antigravity remix never suggests antigravity (and says why)
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentVariant: { constraint: { id: "earth-no-antigravity", banAntigravity: true } },
      getMissionStat: () => ({ key: "agility", label: "Agility", value: 10, target: 26 })
    }));
    assertEquals(false, d.choices.some((c) => /antigravity/.test(c.command)), "Banned remix must not stage antigravity");
    assertEquals(true, /antigravity/i.test(d.message), "Message should explain the antigravity ban");
    renderTestResult(SUITE, "Diagnosis: remix constraint removes banned levers", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: remix constraint removes banned levers", false, err.message);
  }

  // Test D2a: the no-jump-power remix never suggests jump_power.
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentVariant: { constraint: { id: "earth-no-jump-power", banJumpPower: true } },
      getMissionStat: () => ({ key: "agility", label: "Agility", value: 9, target: 30 })
    }));
    assertEquals(false, d.choices.some((c) => /jump_power/.test(c.command)), "Banned remix must not stage jump_power");
    assertEquals(true, /jump_power/i.test(d.message), "Message should explain the jump_power ban");
    assertEquals(true, d.choices.some((c) => /hopper.engine/.test(c.command)), "No-jump remix should still suggest engine");
    renderTestResult(SUITE, "Diagnosis: no-jump remix removes jump lever", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: no-jump remix removes jump lever", false, err.message);
  }

  // Test D2b: the no-mass-cut remix never suggests lowering hopper.mass.
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentVariant: { constraint: { id: "earth-no-mass-cut", banMassLower: true, minMass: 2.5 } },
      getMissionStat: () => ({ key: "agility", label: "Agility", value: 11, target: 26 })
    }));
    assertEquals(false, d.choices.some((c) => /hopper\.mass/.test(c.command)), "Banned remix must not stage hopper.mass");
    assertEquals(true, /mass/i.test(d.message), "Message should explain the mass ban");
    assertEquals(true, d.choices.some((c) => /hopper.engine/.test(c.command)), "No-mass remix should still suggest engine");
    renderTestResult(SUITE, "Diagnosis: no-mass remix removes mass lever", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: no-mass remix removes mass lever", false, err.message);
  }

  // Test D2c: the engine-only remix stages only the engine knob.
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentVariant: {
        constraint: {
          id: "earth-engine-only",
          engineOnly: true,
          engineMin: 8,
          banAntigravity: true,
          banJumpPower: true,
          banMassLower: true,
          banGravityOverride: true,
          minMass: 2.5
        }
      },
      getMissionStat: () => ({ key: "agility", label: "Agility", value: 5, target: 7 })
    }));
    assertEquals(true, /engine-only/i.test(d.message), "Message should explain the engine-only rule");
    assertEquals(true, d.choices.some((c) => c.command === "hopper.engine = 8"), "Engine-only remix should stage the engine target");
    assertEquals(false, d.choices.some((c) => /hopper\.mass|jump_power|antigravity/.test(c.command)), "Engine-only remix must not stage banned levers");
    renderTestResult(SUITE, "Diagnosis: engine-only remix stages engine fix", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: engine-only remix stages engine fix", false, err.message);
  }

  // Test D2d: Moon strict-spring remix stages the repeat-loop pattern.
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentPlanetIndex: 1,
      currentVariant: { constraint: { id: "moon-strict-spring", springCount: 5, requireRepeatSpring: true } },
      player: { charType: "hopper", jumpPower: 18, spikes: false },
      spawnedSprings: [{}, {}, {}],
      hasRepeatSpawned: () => false
    }));
    assertEquals(true, /Spring loop 3 \/ 5/.test(d.title), "Title should show the spring-loop gap: " + d.title);
    assertEquals(true, d.choices.some((c) => c.command === "repeat 5: spawn_spring()"), "Should stage the strict repeat-spring command");
    renderTestResult(SUITE, "Diagnosis: Moon strict spring stages loop fix", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: Moon strict spring stages loop fix", false, err.message);
  }

  // Test D2e: Glacies friction-target remix stages the exact numeric variable.
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentPlanetIndex: 3,
      currentVariant: { constraint: { id: "glacies-friction-target", minFriction: 8 } },
      player: { charType: "hopper", spikes: true },
      getCurrentFriction: () => 5
    }));
    assertEquals(true, /Friction 5\.0 \/ 8/.test(d.title), "Title should show the current friction gap: " + d.title);
    assertEquals(true, d.choices.some((c) => c.command === "friction = 8"), "Should stage the exact friction target");
    assertEquals(false, d.choices.some((c) => /spikes/.test(c.command)), "Friction-target remix should not stage spikes");
    renderTestResult(SUITE, "Diagnosis: Glacies friction target stages numeric fix", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: Glacies friction target stages numeric fix", false, err.message);
  }

  // Test D3: short jump arc → h ≈ J²/(2·g·m²) report with the squared-mass insight
  try {
    const d = diagnoseFailure(makeDiagGame({
      getActiveMass: () => 2.5,
      getJumpForce: () => 10,
      lastFailure: { tag: "fall", cause: "fell out of bounds!" }
    }));
    // v0 = 10/2.5 = 4 → h = 16/(2·0.6) ≈ 13px < 120 → jump-arc diagnosis.
    assertEquals(true, /Jump arc too short/.test(d.title), "Short arc should be diagnosed: " + d.title);
    assertEquals(true, /J²\/\(2·g·m²\)/.test(d.formula), "Formula line should show h ≈ J²/(2·g·m²)");
    assertEquals(true, d.choices.some((c) => /jump_power/.test(c.command)), "Should stage a jump_power fix");
    renderTestResult(SUITE, "Diagnosis: short jump arc shows the height formula", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: short jump arc shows the height formula", false, err.message);
  }

  // Test D4: Glacies slide → friction OR an ice event rule, staged with real syntax
  try {
    const d = diagnoseFailure(makeDiagGame({
      currentPlanetIndex: 3,
      getCurrentFriction: () => 0.5,
      lastFailure: { tag: "hazard", cause: "contact with terrain hazard!" }
    }));
    assertEquals(true, /slid|grip/i.test(d.title), "Slide should be diagnosed: " + d.title);
    assertEquals(true, d.choices.some((c) => c.command === "friction = 8"), "Should stage a friction fix");
    assertEquals(true, d.choices.some((c) => c.command.indexOf("when player.touching('ice')") === 0), "Should stage the ice event rule");
    renderTestResult(SUITE, "Diagnosis: Glacies slide offers friction or event rule", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: Glacies slide offers friction or event rule", false, err.message);
  }

  // Test D5: healthy physics falls back to route/timing (enemy → stomp coaching)
  try {
    const dEnemy = diagnoseFailure(makeDiagGame({ lastFailure: { tag: "enemy", cause: "collision damage!" } }));
    const dOk = diagnoseFailure(makeDiagGame({ lastFailure: { tag: "hazard", cause: "hazard!" } }));
    // jump 22 / mass 1.0 → h ≈ 403px, no stat gap → not a physics problem.
    assertEquals(true, /timing/i.test(dEnemy.title), "Enemy death should coach timing: " + dEnemy.title);
    assertEquals(true, /stomp/i.test(dEnemy.message), "Enemy death should mention stomping");
    assertEquals(true, /Control or timing/i.test(dOk.title), "Strong build should fall back to route/timing: " + dOk.title);
    renderTestResult(SUITE, "Diagnosis: healthy build falls back to timing advice", true);
  } catch (err) {
    renderTestResult(SUITE, "Diagnosis: healthy build falls back to timing advice", false, err.message);
  }

  // Test D6: clicking a crash-lab fix carries its suggested hypothesis into the next attempt.
  const oldGetElementByIdD6 = document.getElementById;
  const oldCreateElementD6 = document.createElement;
  const oldWindowGameD6 = window.Game;
  try {
    const makeClassList = () => {
      const classes = new Set();
      return {
        toggle(name, force) {
          const shouldHave = force === undefined ? !classes.has(name) : !!force;
          if (shouldHave) classes.add(name);
          else classes.delete(name);
          return shouldHave;
        },
        contains(name) { return classes.has(name); },
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); }
      };
    };
    const makeEl = () => {
      let html = "";
      return {
        className: "",
        textContent: "",
        title: "",
        type: "",
        style: {},
        dataset: {},
        children: [],
        _events: {},
        classList: makeClassList(),
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; this.children = []; },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(event, fn) { this._events[event] = fn; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        focus() { this.focused = true; },
        setSelectionRange(start, end) { this.selection = [start, end]; }
      };
    };
    const title = makeEl();
    const cause = makeEl();
    const msg = makeEl();
    const formula = makeEl();
    const choices = makeEl();
    const input = makeEl();
    const hypLabel = makeEl();
    const hypButtons = ["higher", "lower", "same"].map(choice => ({ dataset: { choice }, title: "", classList: makeClassList() }));
    const hypothesis = makeEl();
    hypothesis.querySelector = (selector) => selector === ".hypothesis-label" ? hypLabel : null;
    hypothesis.querySelectorAll = (selector) => selector === ".hypothesis-btn" ? hypButtons : [];

    document.getElementById = (id) => ({
      "failure-title": title,
      "failure-cause": cause,
      "failure-msg": msg,
      "failure-formula": formula,
      "failure-choices": choices,
      "failure-hypothesis": hypothesis,
      "console-input": input
    }[id] || null);
    document.createElement = () => makeEl();
    AttemptLog.byPlanet = {};
    AttemptLog.pendingPrediction = null;
    window.Game = {
      resetLevel() {
        attemptLogStart({ currentPlanetIndex: 0, retryAttempt: 1, currentVariant: { isRemix: false } });
      }
    };

    renderFailureLab(makeDiagGame({
      getActiveMass: () => 2.5,
      getJumpForce: () => 10,
      lastFailure: { tag: "fall", cause: "fell out of bounds!" }
    }));

    assertEquals(true, choices.children.length >= 1, "Crash lab should render at least one staged fix");
    const firstFix = choices.children[0];
    assertEquals("higher", firstFix.dataset.prediction, "Jump-arc fix should recommend a higher-height hypothesis");
    assertEquals(true, hypButtons[0].classList.contains("recommended"), "Higher hypothesis button is marked as recommended");
    assertEquals(true, /max height/.test(hypLabel.textContent), "Crash lab hypothesis label names the measured telemetry");
    const stagedCommand = firstFix.children.find(child => child.className === "failure-choice-code").textContent;
    const retryProof = firstFix.children.find(child => child.className === "failure-choice-reward");
    assertEquals("RETRY PROOF", retryProof && retryProof.textContent, "Crash fix should mark the next retry as a proof attempt");
    firstFix._events.click();
    assertEquals("higher", AttemptLog.byPlanet[0][0].prediction, "Suggested hypothesis attaches to the next attempt before reset");
    assertEquals(null, AttemptLog.pendingPrediction, "Pending hypothesis is consumed by the new attempt row");
    assertEquals(stagedCommand, input.value, "Clicking the fix still stages the command in the console");
    assertEquals(true, input.focused, "Clicking the fix focuses the console for the next experiment");
    assertEquals("failure-lab", window.Game.lastStagedExperiment && window.Game.lastStagedExperiment.source, "Failure fix should enter the shared staged-experiment loop");
    assertEquals("failure-diagnosis", window.Game.lastStagedExperiment && window.Game.lastStagedExperiment.kind, "Failure fix should record the diagnosis kind");
    assertEquals("higher", window.Game.lastStagedExperiment && window.Game.lastStagedExperiment.prediction, "Failure fix should carry prediction metadata");
    assertEquals(stagedCommand, window.Game.lastFailureFix && window.Game.lastFailureFix.command, "Failure fix metadata should remember the staged command");

    document.getElementById = oldGetElementByIdD6;
    document.createElement = oldCreateElementD6;
    window.Game = oldWindowGameD6;
    renderTestResult(SUITE, "Diagnosis: staged fixes carry next-attempt hypotheses", true);
  } catch (err) {
    document.getElementById = oldGetElementByIdD6;
    document.createElement = oldCreateElementD6;
    window.Game = oldWindowGameD6;
    renderTestResult(SUITE, "Diagnosis: staged fixes carry next-attempt hypotheses", false, err.message);
  }
}

// Suite 7: Experiment Log — the notebook's per-attempt table
function runExperimentLogTests() {
  const SUITE = "experiment-suite";
  const makeLogGame = (planet = 0, attempt = 0, remix = null) => ({
    currentPlanetIndex: planet,
    retryAttempt: attempt,
    currentVariant: remix ? { isRemix: true, variantLabel: remix } : { isRemix: false }
  });

  // Test E1: attempt lifecycle — open row, record code, close with result
  try {
    AttemptLog.byPlanet = {}; AttemptLog.pendingPrediction = null;
    const g = makeLogGame(0, 0);
    attemptLogStart(g);
    attemptLogCode(g, "hopper.mass = 1");
    attemptLogCode(g, "hopper.jump_power = 22");
    attemptLogFinish(g, "hazard");
    const row = AttemptLog.byPlanet[0][0];
    assertEquals(1, AttemptLog.byPlanet[0].length, "One row after one attempt");
    assertEquals(1, row.attempt, "Attempt numbering is 1-based");
    assertEquals(2, row.code.length, "Both commands recorded");
    assertEquals("hazard", row.result, "Result stamped on finish");
    attemptLogCode(g, "late command");
    assertEquals(2, row.code.length, "Closed rows reject further code");
    renderTestResult(SUITE, "Experiment log: attempt lifecycle records code + result", true);
  } catch (err) {
    renderTestResult(SUITE, "Experiment log: attempt lifecycle records code + result", false, err.message);
  }

  // Test E2: hypothesis verdicts are gentle and tolerance-based (±8px = same)
  try {
    assertEquals("✓ confirmed", attemptPredictionVerdict("higher", 50, 120), "Higher + rose → confirmed");
    assertEquals("💡 surprise!", attemptPredictionVerdict("higher", 120, 50), "Higher + fell → gentle surprise");
    assertEquals("✓ confirmed", attemptPredictionVerdict("same", 100, 104), "Within ±8px counts as same");
    assertEquals(null, attemptPredictionVerdict(null, 50, 120), "No hypothesis → no verdict");
    assertEquals("~", attemptPredictionVerdict("lower", null, 80), "No baseline → ~");
    renderTestResult(SUITE, "Experiment log: hypothesis verdicts (confirmed/surprise/~)", true);
  } catch (err) {
    renderTestResult(SUITE, "Experiment log: hypothesis verdicts (confirmed/surprise/~)", false, err.message);
  }

  // Test E3: crash-lab prediction lands on the NEXT attempt; mid-run reload = retried
  try {
    AttemptLog.byPlanet = {}; AttemptLog.pendingPrediction = null;
    predictNextAttempt("higher");
    const g = makeLogGame(0, 0);
    attemptLogStart(g);
    assertEquals("higher", AttemptLog.byPlanet[0][0].prediction, "Pending hypothesis attaches to the next attempt");
    assertEquals(null, AttemptLog.pendingPrediction, "Pending hypothesis is consumed");
    const g2 = makeLogGame(0, 1, "gems shifted +1");
    attemptLogStart(g2); // first row never finished → auto-closed as retried
    assertEquals("retried", AttemptLog.byPlanet[0][0].result, "Unfinished row auto-closes as retried");
    assertEquals("gems shifted +1", AttemptLog.byPlanet[0][1].remix, "Remix label captured on the row");
    assertEquals(null, AttemptLog.byPlanet[0][1].prediction, "No stale hypothesis leaks to later attempts");
    renderTestResult(SUITE, "Experiment log: hypothesis staging + retried auto-close", true);
  } catch (err) {
    renderTestResult(SUITE, "Experiment log: hypothesis staging + retried auto-close", false, err.message);
  }

  // Test E4: the attempt log picks the next learning question from mission state.
  try {
    const mission = {
      id: "mass-door",
      fullMission: {
        title: "Mass Door",
        starterCode: "hopper.mass = 1.2",
        prediction: {
          question: "Will lowering mass make the same push accelerate faster?",
          options: [{ id: "yes", label: "Yes", correct: true }]
        },
        resultChecks: [
          {
            id: "mass-ready",
            label: "Mass tuned",
            success: "The same push now accelerates better.",
            waiting: "Mass is still too high; lower one number and compare speed.",
            check: (game) => !!game.massReady
          }
        ],
        reflection: ["Why did changing mass alter the acceleration evidence?"]
      }
    };
    const game = {
      currentPlanetIndex: 0,
      currentPlanet: { missions: [mission] },
      completedMissions: new Set(),
      coachPredictions: {},
      massReady: false
    };

    const predictCue = getAttemptLogNextQuestion(game);
    assertEquals("PREDICT", predictCue.label, "Unpredicted missions ask for a hypothesis first");
    assertEquals("Predict before code", predictCue.title, "Prediction cue has a kid-readable title");
    assertEquals(true, /lowering mass/.test(predictCue.body), "Prediction cue uses the mission question");
    assertEquals("hopper.mass = 1.2", predictCue.command, "Prediction cue can stage the starter command");

    game.coachPredictions["mass-door"] = "yes";
    const testCue = getAttemptLogNextQuestion(game);
    assertEquals("NEXT TEST", testCue.label, "After prediction, the next failed check drives the prompt");
    assertEquals("Mass tuned", testCue.title, "Failed result check becomes the next test title");
    assertEquals(true, /Mass is still too high/.test(testCue.body), "Failed result check gives the actionable body");

    game.massReady = true;
    const explainCue = getAttemptLogNextQuestion(game);
    assertEquals("EXPLAIN", explainCue.label, "Passed checks move the log into explanation");
    assertEquals("Explain the evidence", explainCue.title, "Reflection prompt is explicitly about evidence");
    assertEquals(true, /alter the acceleration/.test(explainCue.body), "Reflection cue comes from the mission");
    renderTestResult(SUITE, "Experiment log: next lab question follows mission state", true);
  } catch (err) {
    renderTestResult(SUITE, "Experiment log: next lab question follows mission state", false, err.message);
  }

  // Test E5: notebook reflection starter turns code/prediction/attempt data into an evidence prompt.
  let oldGetElementByIdE4 = null;
  try {
    oldGetElementByIdE4 = document.getElementById;
    AttemptLog.byPlanet = {
      0: [{ result: "cleared", code: ["hopper.mass = 1.2"], maxH: 140, maxV: 9.2 }]
    };
    const question = { textContent: "", dataset: {} };
    const starter = { textContent: "" };
    const response = { value: "", placeholder: "" };
    const els = {
      "notebook-prompt-question": question,
      "notebook-reflection-starter": starter,
      "notebook-user-response": response
    };
    document.getElementById = (id) => els[id] || null;
    const g = new StarHopperGame();
    g.currentPlanetIndex = 0;
    g.currentPlanet = PLANETS[0];
    g.completedMissions = new Set();
    g.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    g.lastCoachCodeByMission = { "earth-gravity-wall": "use_hopper()\nhopper.mass = 1.2" };
    g.lastScienceDelta = {
      code: "use_hopper()\nhopper.mass = 1.2",
      changes: [
        {
          label: "Mass",
          value: "2.5 -> 1.2 (-1.3)",
          cue: "Less mass makes the same force accelerate more."
        }
      ]
    };
    g.discoveryPulse = {
      code: "use_hopper()\nhopper.mass = 1.2",
      combo: 2,
      rewardXP: 13,
      comboBonusXP: 2
    };
    g.reflectionContext = {
      kind: "signal-lab",
      source: "Daily Signal Lab",
      title: "Mass remix proof",
      concept: "Force and mass",
      command: "hopper.mass = 1.2",
      proofLabel: "SIGNAL LAB TESTED"
    };
    updateActiveQuestion(g);
    assertEquals(true, /signal lab: Daily Signal Lab - Mass remix proof/.test(starter.textContent), "Starter names the Signal Lab proof context");
    assertEquals(true, /focus: Force and mass/.test(starter.textContent), "Starter includes the Signal Lab science focus");
    assertEquals(true, /proof: SIGNAL LAB TESTED/.test(starter.textContent), "Starter includes the Signal Lab proof label");
    assertEquals(true, /code: use_hopper/.test(starter.textContent), "Starter names the latest coach code");
    assertEquals(true, /prediction: More antigravity/.test(starter.textContent), "Starter includes the selected prediction label");
    assertEquals(true, /result: cleared/.test(starter.textContent), "Starter includes the attempt result");
    assertEquals(true, /changed: Mass 2\.5 -> 1\.2/.test(starter.textContent), "Starter includes the latest science delta");
    assertEquals(true, /why: Less mass/.test(starter.textContent), "Starter includes the science cue from What Changed");
    assertEquals(true, /lab chain: active x2/.test(starter.textContent), "Starter includes the matching lab-chain state");
    assertEquals(true, /height: 140px/.test(response.placeholder), "Starter becomes the empty reflection placeholder");
    assertEquals(starter.textContent, question.dataset.evidenceStarter, "Question dataset stores the starter for saving");
    g.reflectionContext.proofSourceKey = "signal-lab-proof:daily:earth-20260630:day:0:mass-remix-proof:abc123";
    g.masteryMeters = {
      0: {
        sources: {
          "reflection-proof:signal-reflection:signal-lab-proof:daily:earth-20260630:day:0:mass-remix-proof:abc123": 9
        }
      }
    };
    updateActiveQuestion(g);
    assertEquals(false, /signal lab: Daily Signal Lab/.test(starter.textContent), "Starter drops completed Signal Lab context");
    assertEquals(false, /proof: SIGNAL LAB TESTED/.test(starter.textContent), "Starter drops completed Signal Lab proof labels");
    g.reflectionContext = {
      kind: "repair-proof",
      source: "Crash Lab",
      title: "Fix the jump arc",
      concept: "Failure diagnosis",
      command: "hopper.jump = 18",
      prediction: "higher",
      proofLabel: "REPAIR PROOF",
      proofSourceKey: "failure-repair-proof:0:fix-the-jump-arc:abc123"
    };
    response.value = "";
    response.placeholder = "";
    updateActiveQuestion(g);
    assertEquals(true, /crash lab: Crash Lab - Fix the jump arc/.test(starter.textContent), "Starter names the Crash Lab repair proof context");
    assertEquals(true, /repair prediction: higher/.test(starter.textContent), "Starter includes the repair hypothesis");
    assertEquals(true, /proof: REPAIR PROOF/.test(starter.textContent), "Starter includes the repair proof label");
    g.masteryMeters = {
      0: {
        sources: {
          "reflection-proof:repair-reflection:failure-repair-proof:0:fix-the-jump-arc:abc123": 9
        }
      }
    };
    updateActiveQuestion(g);
    assertEquals(false, /crash lab: Crash Lab/.test(starter.textContent), "Starter drops completed Crash Lab repair context");
    assertEquals(false, /repair prediction: higher/.test(starter.textContent), "Starter drops completed repair hypothesis context");
    response.value = "Student is already typing";
    response.placeholder = "keep me";
    updateActiveQuestion(g);
    assertEquals("keep me", response.placeholder, "Refreshing never overwrites a typed reflection placeholder");
    document.getElementById = oldGetElementByIdE4;
    renderTestResult(SUITE, "Notebook: reflection starter uses evidence", true);
  } catch (err) {
    renderTestResult(SUITE, "Notebook: reflection starter uses evidence", false, err.message);
  } finally {
    if (oldGetElementByIdE4) document.getElementById = oldGetElementByIdE4;
  }

  // Test E6: saving an evidence explanation pays once, then preserves the proof without farming.
  let oldGetElementByIdE6 = null;
  const oldWindowGameE6 = window.Game;
  const oldNotebookEntriesE6 = (typeof notebookEntries !== 'undefined') ? { ...notebookEntries } : {};
  const oldTriggerCloudSaveE6 = typeof triggerCloudSave === 'function' ? triggerCloudSave : null;
  let oldBubblePopE6 = null;
  let oldParticleBurstE6 = null;
  try {
    oldGetElementByIdE6 = document.getElementById;
    Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
    const reflectionLabels = [];
    let reflectionBursts = 0;
    if (typeof ComicBubbles !== 'undefined') {
      oldBubblePopE6 = ComicBubbles.pop;
      ComicBubbles.pop = (x, y, text) => { reflectionLabels.push(text); };
    }
    if (typeof Particles !== 'undefined') {
      oldParticleBurstE6 = Particles.spawnBurst;
      Particles.spawnBurst = () => { reflectionBursts++; };
    }
    const response = { value: "The lower mass moved higher, so the same force changed acceleration." };
    const question = {
      textContent: "Why did changing mass alter the acceleration evidence?",
      dataset: {
        missionId: "earth-gravity-wall",
        missionTitle: "Gravity Wall",
        starterCode: "hopper.mass = 1.2",
        evidenceStarter: "Evidence starter - code: hopper.mass = 1.2 | height: 140px."
      }
    };
    const history = {
      innerHTML: "",
      children: [],
      appendChild(child) { this.children.push(child); }
    };
    const inputEl = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; }
    };
    const els = {
      "notebook-user-response": response,
      "notebook-prompt-question": question,
      "notebook-history": history,
      "console-input": inputEl,
      "discovery-pulse": null,
      "research-rank-card": null
    };
    document.getElementById = (id) => els[id] || null;
    let cloudSaves = 0;
    triggerCloudSave = () => { cloudSaves++; };

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.researchXP = 16;
    game.masteryMeters = {};
    game.discoveryLog = [];
    game.player = { x: 80, y: 100, w: 24, h: 32 };
    game.currentMissionSteps = { observe: true, predict: true, code: true, test: true, explain: false };
    game.lastScienceDelta = {
      nextExperiment: {
        kind: "check",
        title: "Raise engine",
        body: "Raise the engine, run it, and compare the new height evidence.",
        command: "hopper.engine = 6"
      }
    };
    window.Game = game;

    saveNotebookReflection();
    const entry = notebookEntries["earth-gravity-wall"];
    assertEquals(20, game.researchXP, "First saved reflection should award +4 Research XP");
    assertEquals("Reflection Proof", game.discoveryPulse.title, "Reflection save should create a discovery pulse");
    assertEquals(8, game.discoveryPulse.worldMasteryAddedXP, "Reflection save should add world mastery proof XP");
    assertEquals("PROOF SAVED!", game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.label, "Reflection save should pop an in-level proof cue");
    assertEquals("LAB RANK UP!", game.discoveryPulse.rankEffect && game.discoveryPulse.rankEffect.label, "Reflection proof rank-up should create an in-level lab-rank cue");
    assertEquals(true, reflectionLabels.includes("LAB RANK UP!"), "Reflection proof rank-up should pop a visible lab-rank cue");
    assertEquals("EXPLAIN SAVED: +4 Research XP", game.missionBalloon && game.missionBalloon.text, "Reflection save should write a Science Notebook CRT reward line");
    assertEquals(true, reflectionLabels.includes("PROOF SAVED!"), "Reflection save should call the proof bubble");
    assertEquals(4, entry.reflectionRewardXP, "Notebook entry should remember the reflection reward");
    assertEquals(true, /Reflection Proof: \+4 Research XP/.test(history.children[0].innerHTML), "Notebook history should show the proof reward");
    assertEquals("Raise engine", entry.nextExperiment.title, "Reflection proof should preserve the next experiment cue");
    assertEquals(true, /STAGE NEXT TEST/.test(history.children[0].innerHTML), "Notebook history should offer a next-test stage action");
    assertEquals(true, /hopper\.engine = 6/.test(history.children[0].innerHTML), "Notebook history should show the staged command");
    assertEquals(true, eval(buildNotebookStageCall(entry.nextExperiment)), "Notebook stage call should be executable");
    assertEquals("hopper.engine = 6", inputEl.value, "Notebook stage action should write the next command to the terminal");
    assertEquals(true, inputEl.focused, "Notebook stage action should focus the terminal input");
    assertEquals(true, game.currentMissionSteps.explain, "Saving a reflection completes the Explain loop step");
    assertEquals(1, cloudSaves, "Saving a reflection should persist the updated notebook entry");

    response.value = "A revised explanation still uses evidence.";
    saveNotebookReflection();
    assertEquals(20, game.researchXP, "Re-saving the same mission reflection should not farm XP");
    assertEquals("A revised explanation still uses evidence.", notebookEntries["earth-gravity-wall"].answer, "Re-save should still update the answer");
    assertEquals(4, notebookEntries["earth-gravity-wall"].reflectionRewardXP, "Re-save should preserve the original proof badge");
    assertEquals("Raise engine", notebookEntries["earth-gravity-wall"].nextExperiment.title, "Re-save should preserve the next-test handoff");
    assertEquals(2, cloudSaves, "Re-saving should still persist the revised answer");

    const signalProofKey = "signal-lab-proof:daily:earth-20260630:day:0:mass-remix-proof:abc123";
    game.reflectionContext = {
      kind: "signal-lab",
      source: "Daily Signal Lab",
      title: "Mass remix proof",
      concept: "Force and mass",
      command: "hopper.mass = 1.2",
      proofLabel: "SIGNAL LAB TESTED",
      proofSourceKey: signalProofKey
    };
    question.dataset.evidenceStarter = buildReflectionEvidenceStarter(game, PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall"));
    response.value = "The Daily Signal proof shows lower mass changed acceleration evidence.";
    saveNotebookReflection();
    const signalEntryKey = `signal-reflection:${signalProofKey}`;
    const signalEntry = notebookEntries[signalEntryKey];
    assertEquals(25, game.researchXP, "Daily Signal reflection should award its stronger +5 Research XP");
    assertEquals("Signal Reflection Proof", game.discoveryPulse.title, "Signal Lab reflection should create a specific discovery pulse");
    assertEquals(9, game.discoveryPulse.worldMasteryAddedXP, "Daily Signal reflection should add stronger world mastery proof XP");
    assertEquals("SIGNAL PROOF!", game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.label, "Signal Lab reflection should use the stronger proof cue");
    assertEquals("SIGNAL PROOF: +5 Research XP", game.missionBalloon && game.missionBalloon.text, "Daily Signal reflection should write a signal-specific CRT reward line");
    assertEquals(true, reflectionLabels.includes("SIGNAL PROOF!"), "Signal Lab reflection should call the signal proof bubble");
    assertEquals(true, reflectionBursts > 0, "Reflection proof saves should spawn reward particles");
    assertEquals("Mass remix proof", signalEntry.title, "Signal Lab notebook entry should use the replay focus title");
    assertEquals(5, signalEntry.reflectionRewardXP, "Daily Signal notebook entry should remember its proof reward");
    assertEquals("Signal Reflection Proof", signalEntry.reflectionRewardLabel, "Signal Lab notebook entry should label the specific proof");
    assertEquals(true, /signal lab: Daily Signal Lab/.test(signalEntry.evidence), "Signal Lab entry should preserve contextual evidence");
    assertEquals(true, hasSignalReflectionCredit(game, signalProofKey), "Signal reflection helper should recognize a saved Signal Lab proof");
    assertEquals(3, cloudSaves, "Saving a Signal Lab reflection should persist the new entry");

    response.value = "A revised Daily Signal explanation still should not farm XP.";
    saveNotebookReflection();
    assertEquals(25, game.researchXP, "Re-saving the same Daily Signal reflection should not farm XP");
    assertEquals("A revised Daily Signal explanation still should not farm XP.", notebookEntries[signalEntryKey].answer, "Signal Lab re-save should update the answer");
    assertEquals(5, notebookEntries[signalEntryKey].reflectionRewardXP, "Daily Signal re-save should preserve the original proof badge");
    assertEquals(4, cloudSaves, "Signal Lab re-save should still persist the revised answer");
    const masteryOnlySignal = new StarHopperGame();
    masteryOnlySignal.masteryMeters = {
      0: {
        sources: {
          [`reflection-proof:signal-reflection:${signalProofKey}`]: 9
        }
      }
    };
    assertEquals(true, hasSignalReflectionCredit(masteryOnlySignal, signalProofKey), "Signal reflection helper should recognize world mastery signal credit");

    const frontierProofKey = "signal-lab-proof:frontier:frontier-earth-1234:t2:0:mass-remix-proof:def456";
    game.reflectionContext = {
      kind: "signal-lab",
      source: "Frontier Signal Lab",
      title: "Frontier mass proof",
      concept: "Replay force evidence",
      command: "hopper.mass = 1.1",
      proofLabel: "FRONTIER LAB TESTED",
      proofSourceKey: frontierProofKey
    };
    question.dataset.evidenceStarter = buildReflectionEvidenceStarter(game, PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall"));
    response.value = "The Frontier proof uses the same mass idea against a tougher rival route.";
    saveNotebookReflection();
    const frontierEntryKey = `signal-reflection:${frontierProofKey}`;
    const frontierEntry = notebookEntries[frontierEntryKey];
    assertEquals(31, game.researchXP, "Frontier Signal reflection should award the strongest replay +6 Research XP");
    assertEquals(10, game.discoveryPulse.worldMasteryAddedXP, "Frontier Signal reflection should add stronger world mastery proof XP");
    assertEquals("SIGNAL PROOF: +6 Research XP", game.missionBalloon && game.missionBalloon.text, "Frontier Signal reflection should write the stronger CRT reward line");
    assertEquals("Frontier mass proof", frontierEntry.title, "Frontier notebook entry should use the replay focus title");
    assertEquals(6, frontierEntry.reflectionRewardXP, "Frontier notebook entry should remember its proof reward");
    assertEquals(true, /signal lab: Frontier Signal Lab/.test(frontierEntry.evidence), "Frontier entry should preserve contextual evidence");
    assertEquals(5, cloudSaves, "Saving a Frontier reflection should persist the new entry");

    response.value = "The revised Frontier explanation keeps the same evidence.";
    saveNotebookReflection();
    assertEquals(31, game.researchXP, "Re-saving the same Frontier reflection should not farm XP");
    assertEquals("The revised Frontier explanation keeps the same evidence.", notebookEntries[frontierEntryKey].answer, "Frontier re-save should update the answer");
    assertEquals(6, notebookEntries[frontierEntryKey].reflectionRewardXP, "Frontier re-save should preserve the original proof badge");
    assertEquals(6, cloudSaves, "Frontier re-save should still persist the revised answer");

    const darkMatterProofKey = "signal-lab-proof:frontier:frontier-earth-1234:t2:0:dark-matter-prep:fed789";
    game.reflectionContext = {
      kind: "signal-lab",
      source: "Dark Matter Prep",
      title: "Hidden force evidence",
      concept: "Infer hidden forces",
      command: "antigravity = 3",
      proofLabel: "DARK MATTER EVIDENCE",
      proofSourceKey: darkMatterProofKey
    };
    question.dataset.evidenceStarter = buildReflectionEvidenceStarter(game, PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall"));
    response.value = "The hidden-force prep proof compares the same route with a new invisible push.";
    saveNotebookReflection();
    const darkMatterEntryKey = `signal-reflection:${darkMatterProofKey}`;
    const darkMatterEntry = notebookEntries[darkMatterEntryKey];
    assertEquals(38, game.researchXP, "Dark Matter prep reflection should award +7 Research XP");
    assertEquals("Dark Matter Reflection Proof", game.discoveryPulse.title, "Dark Matter prep reflection should create a named future-lab proof pulse");
    assertEquals(12, game.discoveryPulse.worldMasteryAddedXP, "Dark Matter prep reflection should add the strongest world mastery proof XP");
    assertEquals("DARK PROOF!", game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.label, "Dark Matter prep reflection should use a distinct proof cue");
    assertEquals(true, game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.darkMatter, "Dark Matter reflection effect should expose its future-lab flag");
    assertEquals("DARK MATTER PROOF: +7 Research XP", game.missionBalloon && game.missionBalloon.text, "Dark Matter prep reflection should write the strongest CRT reward line");
    assertEquals(true, reflectionLabels.includes("DARK PROOF!"), "Dark Matter reflection should call the future-lab proof bubble");
    assertEquals("Hidden force evidence", darkMatterEntry.title, "Dark Matter prep notebook entry should use the replay focus title");
    assertEquals(7, darkMatterEntry.reflectionRewardXP, "Dark Matter prep notebook entry should remember its proof reward");
    assertEquals("Dark Matter Reflection Proof", darkMatterEntry.reflectionRewardLabel, "Dark Matter prep notebook entry should label the future-lab proof");
    assertEquals(true, /signal lab: Dark Matter Prep/.test(darkMatterEntry.evidence), "Dark Matter prep entry should preserve contextual evidence");
    assertEquals(7, cloudSaves, "Saving a Dark Matter prep reflection should persist the new entry");

    response.value = "The revised hidden-force explanation still uses the same proof.";
    saveNotebookReflection();
    assertEquals(38, game.researchXP, "Re-saving the same Dark Matter prep reflection should not farm XP");
    assertEquals("The revised hidden-force explanation still uses the same proof.", notebookEntries[darkMatterEntryKey].answer, "Dark Matter prep re-save should update the answer");
    assertEquals(7, notebookEntries[darkMatterEntryKey].reflectionRewardXP, "Dark Matter prep re-save should preserve the original proof badge");
    assertEquals("Dark Matter Reflection Proof", notebookEntries[darkMatterEntryKey].reflectionRewardLabel, "Dark Matter prep re-save should preserve the proof label");
    assertEquals(8, cloudSaves, "Dark Matter prep re-save should still persist the revised answer");

    const sourceProofKey = "signal-lab-proof:frontier:frontier-earth-5050:t5:0:future-source-key-source-rehearsal:abc999";
    game.reflectionContext = {
      kind: "signal-lab",
      source: "Future Lab Source",
      title: "Future Source Key: source rehearsal",
      concept: "Combine hidden-force inference with probability evidence",
      command: "hopper.mass = 1.2",
      proofLabel: "SOURCE KEY TESTED",
      proofSourceKey: sourceProofKey
    };
    question.dataset.evidenceStarter = buildReflectionEvidenceStarter(game, PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall"));
    response.value = "The source-key proof connects hidden-force clues with chance evidence.";
    saveNotebookReflection();
    const sourceEntryKey = `signal-reflection:${sourceProofKey}`;
    const sourceEntry = notebookEntries[sourceEntryKey];
    assertEquals(46, game.researchXP, "Source Key reflection should award the capstone +8 Research XP");
    assertEquals("Source Key Reflection Proof", game.discoveryPulse.title, "Source Key reflection should create a named capstone proof pulse");
    assertEquals(14, game.discoveryPulse.worldMasteryAddedXP, "Source Key reflection should add capstone world mastery proof XP");
    assertEquals("SOURCE PROOF!", game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.label, "Source Key reflection should use a source-specific proof cue");
    assertEquals(true, game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.sourceKey, "Source Key reflection effect should expose its source-key flag");
    assertEquals("SOURCE PROOF: +8 Research XP", game.missionBalloon && game.missionBalloon.text, "Source Key reflection should write a source-specific CRT reward line");
    assertEquals(true, reflectionLabels.includes("SOURCE PROOF!"), "Source Key reflection should call the source proof bubble");
    assertEquals("Future Source Key: source rehearsal", sourceEntry.title, "Source Key notebook entry should use the source rehearsal title");
    assertEquals(8, sourceEntry.reflectionRewardXP, "Source Key notebook entry should remember its proof reward");
    assertEquals("Source Key Reflection Proof", sourceEntry.reflectionRewardLabel, "Source Key notebook entry should label the capstone proof");
    assertEquals(true, /signal lab: Future Lab Source/.test(sourceEntry.evidence), "Source Key entry should preserve source-lab evidence");
    assertEquals(true, /proof: SOURCE KEY TESTED/.test(sourceEntry.evidence), "Source Key entry should preserve the source-key proof label");
    assertEquals(9, cloudSaves, "Saving a Source Key reflection should persist the new entry");

    response.value = "The revised source-key explanation still should not farm XP.";
    saveNotebookReflection();
    assertEquals(46, game.researchXP, "Re-saving the same Source Key reflection should not farm XP");
    assertEquals("The revised source-key explanation still should not farm XP.", notebookEntries[sourceEntryKey].answer, "Source Key re-save should update the answer");
    assertEquals(8, notebookEntries[sourceEntryKey].reflectionRewardXP, "Source Key re-save should preserve the original proof badge");
    assertEquals(10, cloudSaves, "Source Key re-save should still persist the revised answer");

    const repairProofKey = "failure-repair-proof:0:fix-the-jump-arc:repair123";
    game.reflectionContext = {
      kind: "repair-proof",
      source: "Crash Lab",
      title: "Fix the jump arc",
      concept: "Failure diagnosis",
      command: "hopper.jump = 18",
      prediction: "higher",
      proofLabel: "REPAIR PROOF",
      proofSourceKey: repairProofKey
    };
    question.dataset.evidenceStarter = buildReflectionEvidenceStarter(game, PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall"));
    response.value = "The repair proof shows the jump arc went higher after changing the command.";
    saveNotebookReflection();
    const repairEntryKey = `repair-reflection:${repairProofKey}`;
    const repairEntry = notebookEntries[repairEntryKey];
    assertEquals(51, game.researchXP, "Repair reflection should award +5 Research XP");
    assertEquals("Repair Reflection Proof", game.discoveryPulse.title, "Repair reflection should create a specific proof pulse");
    assertEquals(9, game.discoveryPulse.worldMasteryAddedXP, "Repair reflection should add focused world mastery proof XP");
    assertEquals("REPAIR PROOF!", game.discoveryPulse.reflectionEffect && game.discoveryPulse.reflectionEffect.label, "Repair reflection should use a Crash Lab proof cue");
    assertEquals("REPAIR EXPLAINED: +5 Research XP", game.missionBalloon && game.missionBalloon.text, "Repair reflection should write a repair-specific CRT reward line");
    assertEquals(true, reflectionLabels.includes("REPAIR PROOF!"), "Repair reflection should pop a visible repair cue");
    assertEquals("Fix the jump arc", repairEntry.title, "Repair notebook entry should use the repair focus title");
    assertEquals(5, repairEntry.reflectionRewardXP, "Repair notebook entry should remember its proof reward");
    assertEquals("Repair Reflection Proof", repairEntry.reflectionRewardLabel, "Repair notebook entry should label the specific proof");
    assertEquals(true, /crash lab: Crash Lab/.test(repairEntry.evidence), "Repair entry should preserve Crash Lab evidence");
    assertEquals(true, /repair prediction: higher/.test(repairEntry.evidence), "Repair entry should preserve the repair hypothesis");
    assertEquals(11, cloudSaves, "Saving a repair reflection should persist the new entry");
    assertEquals(true, hasRepairReflectionCredit(game, repairProofKey), "Repair reflection helper should recognize a saved notebook repair proof");

    response.value = "The revised repair explanation still should not farm XP.";
    saveNotebookReflection();
    assertEquals(51, game.researchXP, "Re-saving the same repair reflection should not farm XP");
    assertEquals("The revised repair explanation still should not farm XP.", notebookEntries[repairEntryKey].answer, "Repair re-save should update the answer");
    assertEquals(5, notebookEntries[repairEntryKey].reflectionRewardXP, "Repair re-save should preserve the original proof badge");
    assertEquals(12, cloudSaves, "Repair re-save should still persist the revised answer");
    const masteryOnlyRepair = new StarHopperGame();
    masteryOnlyRepair.masteryMeters = {
      0: {
        sources: {
          [`reflection-proof:repair-reflection:${repairProofKey}`]: 9
        }
      }
    };
    assertEquals(true, hasRepairReflectionCredit(masteryOnlyRepair, repairProofKey), "Repair reflection helper should recognize world mastery repair credit");

    document.getElementById = oldGetElementByIdE6;
    Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
    Object.assign(notebookEntries, oldNotebookEntriesE6);
    window.Game = oldWindowGameE6;
    if (oldTriggerCloudSaveE6) triggerCloudSave = oldTriggerCloudSaveE6;
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop = oldBubblePopE6;
    if (typeof Particles !== 'undefined') Particles.spawnBurst = oldParticleBurstE6;
    renderTestResult(SUITE, "Notebook: saved reflections earn proof once", true);
  } catch (err) {
    renderTestResult(SUITE, "Notebook: saved reflections earn proof once", false, err.message);
  } finally {
    if (oldGetElementByIdE6) document.getElementById = oldGetElementByIdE6;
    Object.keys(notebookEntries).forEach(key => delete notebookEntries[key]);
    Object.assign(notebookEntries, oldNotebookEntriesE6);
    window.Game = oldWindowGameE6;
    if (oldTriggerCloudSaveE6) triggerCloudSave = oldTriggerCloudSaveE6;
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop = oldBubblePopE6;
    if (typeof Particles !== 'undefined') Particles.spawnBurst = oldParticleBurstE6;
  }
}

// Suite 8: Render cache — pre-baked layers and sprites (graphics fast path)
function runRenderCacheTests() {
  const SUITE = "render-suite";
  const supported = RenderCache.canvasSupported();
  const T = (typeof TILE_SIZE !== "undefined") ? TILE_SIZE : 32;
  const makeRenderGame = (planet = 0, attempt = 0) => ({
    currentPlanetIndex: planet,
    retryAttempt: attempt,
    currentPlanet: PLANETS[planet],
    canvas: { width: 720, height: 448 },
    getActiveMap() { return PLANETS[planet].map; }
  });

  // Test G1: the tile layer bakes to full level size and re-uses until the key changes
  try {
    RenderCache.invalidate();
    const g = makeRenderGame(0, 0);
    const layer = RenderCache.tileLayer(g);
    if (!supported) {
      assertEquals(null, layer, "Without canvas support the cache must return null");
    } else {
      assertEquals(PLANETS[0].map[0].length * T, layer.width, "Layer width = map cols × tile");
      assertEquals(PLANETS[0].map.length * T, layer.height, "Layer height = map rows × tile");
      assertEquals(true, layer === RenderCache.tileLayer(g), "Same layout must reuse the same canvas");
      const remixed = RenderCache.tileLayer(makeRenderGame(0, 1));
      assertEquals(false, layer === remixed, "A remix attempt must rebake the layer");
    }
    renderTestResult(SUITE, "Render cache: tile layer sizes, reuses, and rebakes per layout", true);
  } catch (err) {
    renderTestResult(SUITE, "Render cache: tile layer sizes, reuses, and rebakes per layout", false, err.message);
  }

  // Test G2: glow sprites are memoized per color+radius (shadowBlur replacement)
  try {
    const a = RenderCache.glowSprite("#facc15", 10);
    const b = RenderCache.glowSprite("#facc15", 10);
    const c = RenderCache.glowSprite("#facc15", 12);
    if (!supported) {
      assertEquals(null, a, "Without canvas support glow sprites are null (callers fall back)");
    } else {
      assertEquals(true, a === b, "Same color+radius must return the cached sprite");
      assertEquals(false, a === c, "A different radius is a different sprite");
      assertEquals(40, a.width, "Sprite canvas is 4×radius");
    }
    renderTestResult(SUITE, "Render cache: glow sprites memoize per color+radius", true);
  } catch (err) {
    renderTestResult(SUITE, "Render cache: glow sprites memoize per color+radius", false, err.message);
  }

  // Test G3: sky/vignette key on planet (and canvas width); deterministic tile hash
  try {
    const h1 = RenderCache._hash(3, 7), h2 = RenderCache._hash(3, 7), h3 = RenderCache._hash(7, 3);
    assertEquals(h1, h2, "Tile hash must be deterministic");
    assertEquals(true, h1 !== h3, "Tile hash should vary by position");
    assertEquals(true, h1 >= 0 && h1 < 1, "Tile hash stays in [0,1)");
    if (supported) {
      RenderCache.invalidate();
      const earth = RenderCache.sky(makeRenderGame(0, 0));
      const earthAgain = RenderCache.sky(makeRenderGame(0, 0));
      assertEquals(true, earth === earthAgain, "Same planet reuses the sky");
      const moon = RenderCache.sky(makeRenderGame(1, 0));
      assertEquals(false, earth === moon, "A different planet rebakes the sky");
      const vig = RenderCache.vignette(makeRenderGame(1, 0));
      assertEquals(720, vig.width, "Vignette matches the canvas size");
    }
    renderTestResult(SUITE, "Render cache: deterministic hash + per-planet sky/vignette keys", true);
  } catch (err) {
    renderTestResult(SUITE, "Render cache: deterministic hash + per-planet sky/vignette keys", false, err.message);
  }
}

// Main execution entry point
window.addEventListener("load", () => {
  runCompilerTests();
  runSafetyTests();
  runEngineTests();
  runSolarTests();
  runRetryRemixTests();
  runDiagnosticsTests();
  runExperimentLogTests();
  runRenderCacheTests();
});
