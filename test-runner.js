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

  // Test 6b: chance(percent) gives KidCode a bounded probability branch.
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
    assertEquals("elasticity = 1.0", phaseRowsTwo[1].command, "Unlocked Forge phase reveals the elasticity command");
    const phaseHTMLAfter = renderMissionLessonPhaseLadder(game, forgeMission);
    assertEquals(true, /DONE/.test(phaseHTMLAfter) && /NOW/.test(phaseHTMLAfter), "Forge phase ladder should show complete and active states after mass");
    assertEquals(true, /elasticity = 1\.0/.test(phaseHTMLAfter), "Forge phase ladder should reveal elasticity after mass proof");

    const phaseTwo = scaffoldWithActiveSlots(forgeMission.scaffold, game, forgeMission);
    assertEquals(2, phaseTwo.slots.length, "Forge phase two reveals the bounce slot after mass passes");
    assertEquals("elasticity", phaseTwo.slots[1].id, "Forge phase two exposes elasticity second");
    assertEquals("elasticity = 1.0", buildNextExperimentCommand(forgeMission, null, game), "Forge second stage command should be elasticity-only");
    const phaseTwoState = evaluateMissionResultChecks(game, forgeMission);
    const phaseTwoCue = buildNextExperimentCue(game, phaseTwoState, activeMission);
    assertEquals("elasticity = 1.0", phaseTwoCue.command, "Forge next cue should stage elasticity after the mass proof");
    renderTestResult("engine-suite", "Curriculum: Forge coach phases mass before elasticity", true);
  } catch (err) {
    renderTestResult("engine-suite", "Curriculum: Forge coach phases mass before elasticity", false, err.message);
  }

  // Test 17c1b: completing a visible Forge phase creates a non-farmable visual cue.
  const oldGetElementById17c1b = document.getElementById;
  const oldBubblePop17c1b = ComicBubbles.pop;
  const oldParticleBurst17c1b = Particles.spawnBurst;
  try {
    Compiler.reset();
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;
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
    assertEquals("PHASE DONE: 1 Momentum shove -> 2 Bounce control", game.missionBalloon && game.missionBalloon.text, "Mission CRT should announce the phase transition");
    assertEquals(true, labels.includes("PHASE DONE!"), "Phase completion should pop an in-world label");
    assertEquals(true, bursts >= 2, "Phase completion should spawn visual particles");
    assertEquals(true, /PHASE DONE/.test(panel.innerHTML), "Discovery Pulse should render the phase chip");
    assertEquals(true, /Next: 2 Bounce control/.test(panel.innerHTML), "Discovery Pulse phase chip should preview the next phase");
    const explainPrompt = game.getClearExplainPrompt();
    assertEquals("EXPLAIN THE PHASE", explainPrompt.kicker, "Clear report should switch to phase-specific explanation after a phase proof");
    assertEquals("Explain 1 Momentum shove", explainPrompt.title, "Clear report should name the completed lesson phase");
    assertEquals(true, /p = m \* v/.test(explainPrompt.question), "Clear explanation should ask about the completed phase formula");
    assertEquals(true, /phase: 1 Momentum shove/.test(explainPrompt.evidence), "Notebook starter should name the completed lesson phase");
    assertEquals(true, /phase code: hopper\.mass = 4\.0/.test(explainPrompt.evidence), "Notebook starter should preserve the one obvious phase tweak");
    assertEquals(true, /phase result: First Forge gem opens/.test(explainPrompt.evidence), "Notebook starter should name the phase payoff");
    assertEquals(true, /next phase: 2 Bounce control/.test(explainPrompt.evidence), "Notebook starter should preview the second variable only after the first proof");

    const repeat = finishSuccessfulCodeRunDiscovery(game, activeMission, "hopper.mass = 4.0", massState, 0, []);
    assertEquals(null, repeat.lessonPhaseAdvance, "Repeating the same completed phase should not replay the phase cue");
    assertEquals(1, labels.filter(label => label === "PHASE DONE!").length, "Phase cue should remain one-time per session phase");

    document.getElementById = oldGetElementById17c1b;
    ComicBubbles.pop = oldBubblePop17c1b;
    Particles.spawnBurst = oldParticleBurst17c1b;
    renderTestResult("engine-suite", "Curriculum: Forge phase completion gets visual cue", true);
  } catch (err) {
    document.getElementById = oldGetElementById17c1b;
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

  // Test 17e: village NPCs are placed away from locked/required gem tiles.
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

    renderTestResult("engine-suite", "Villages: NPC placement avoids gems, spikes, and crates", true);
  } catch (err) {
    renderTestResult("engine-suite", "Villages: NPC placement avoids gems, spikes, and crates", false, err.message);
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
  try {
    const panel = { innerHTML: "" };
    document.getElementById = (id) => id === "science-passport-panel" ? panel : null;
    const game = new StarHopperGame();
    game.currentPlanetIndex = 2;
    game.currentPlanet = PLANETS[2];
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
    document.getElementById = oldGetElementById22passport;
    renderTestResult("engine-suite", "Curriculum: Science Passport shows planet lesson stamps", true);
  } catch (err) {
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
    assertEquals(true, /Guardian Pact: train a pet guard or protect the village \(AI state: scared -&gt; pet -&gt; guard\)/.test(panel.innerHTML), "Village card should show the next relationship pact and coding concept");
    assertEquals(true, /VILLAGE WATCH/.test(panel.innerHTML), "Village worlds without trades should fall back to safety-state story copy");
    document.getElementById = oldGetElementById22village;
    renderTestResult("engine-suite", "Curriculum: Village Almanac shows requests and pacts", true);
  } catch (err) {
    document.getElementById = oldGetElementById22village;
    renderTestResult("engine-suite", "Curriculum: Village Almanac shows requests and pacts", false, err.message);
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
  const oldBubblePop22b = ComicBubbles.pop;
  const oldParticleBurst22b = Particles.spawnBurst;
  try {
    const bubbleLabels22b = [];
    let particleBursts22b = 0;
    ComicBubbles.pop = (x, y, text) => { bubbleLabels22b.push(text); };
    Particles.spawnBurst = () => { particleBursts22b++; };

    const game = new StarHopperGame();
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.cameraX = 0;
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
    assertEquals(true, !!firstPulse.cardUnlocked, "First real mass progress should unlock the mass formula card");
    assertEquals(true, game.discoveredFormulaKinds.has("mass"), "Mass formula should be collected");
    assertEquals(1, game.formulaCardEffects.length, "Formula card unlock should spawn an in-world card effect");
    assertEquals("Mass Lab", game.formulaCardEffects[0].title, "Formula card effect should name the collected card");
    assertEquals(`CARD 1/${formulaDeckTotal22b}`, game.formulaCardEffects[0].deckLabel, "Formula card should show deck collection progress");
    assertEquals(`CARD 1/${formulaDeckTotal22b}`, firstPulse.formulaDeckProgress.label, "Discovery pulse should expose deck progress");
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
    assertEquals(1, game.formulaCardEffects.length, "Repeating without a new card should not spawn another effect");
    assertEquals(firstBubbleCount, bubbleLabels22b.length, "Repeating without progress should not spawn combo text");
    assertEquals(firstBurstCount, particleBursts22b, "Repeating without progress should not spawn combo particles");

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
    assertEquals(true, bubbleLabels22b.some(label => /LAB CHAIN x2/.test(label)), "Second real discovery should pop the lab-chain cue");
    assertEquals(true, bubbleLabels22b.some(label => /LAB RANK UP!/.test(label)), "Rank-up should pop a visible lab-rank cue");
    assertEquals(true, particleBursts22b > firstBurstCount, "Second real discovery should add a visual burst");
    ComicBubbles.pop = oldBubblePop22b;
    Particles.spawnBurst = oldParticleBurst22b;
    renderTestResult("engine-suite", "Curriculum: code runs create discovery rewards", true);
  } catch (err) {
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
    let scienceDeltaBubble22ba = "";
    let scienceDeltaBursts22ba = 0;
    ComicBubbles.pop = (x, y, text) => { scienceDeltaBubble22ba = text; };
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
    assertEquals(true, /MASS/.test(scienceDeltaBubble22ba), "Science delta should pop the changed value in the level");
    assertEquals(true, scienceDeltaBursts22ba >= 2, "Science delta should spawn a small particle reward");
    assertEquals("Agility 30+ reached", nextCue.title, "Next experiment cue should name the first failing mission check");
    assertEquals(true, /Lower mass/.test(nextCue.body), "Next experiment cue should reuse the mission waiting message");
    assertEquals(true, /use_hopper\(\)/.test(nextCue.command), "Next experiment cue should include runnable scaffold code");
    assertEquals(true, /hopper\.engine = 6/.test(nextCue.command), "Next experiment cue should keep the mission's target syntax");
    assertEquals(nextCue, game.lastScienceDelta.nextExperiment, "Next experiment cue should be pinned to the latest delta");

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
    const afterHypothesisBubbles22bb = bubbleLabels22bb.filter(label => /HYPOTHESIS/.test(label)).length;
    const afterHypothesisBursts22bb = particleColors22bb.filter(color => color === "#a7f3d0").length;

    const complete = { allPassed: true, items: partial.items.map(item => ({ ...item, passed: true })) };
    const secondPulse = recordDiscoveryPulse(game, activeMission, "hopper.engine = 6", complete, 0);
    assertEquals(false, !!secondPulse.hypothesisConfirmed, "Same mission should not pay the prediction bonus twice");
    assertEquals(1, game.confirmedHypotheses.size, "Confirmed hypothesis set should not grow on repeat mission progress");
    assertEquals(true, game.researchXP > firstXP, "Regular progress XP should still apply after the one-time bonus");
    assertEquals(afterHypothesisBubbles22bb, bubbleLabels22bb.filter(label => /HYPOTHESIS/.test(label)).length, "Repeat mission progress should not spawn another hypothesis cue");
    assertEquals(afterHypothesisBursts22bb, particleColors22bb.filter(color => color === "#a7f3d0").length, "Repeat mission progress should not spawn another hypothesis burst");

    const wrong = new StarHopperGame();
    wrong.player = { x: 100, y: 120, w: 24, h: 32 };
    wrong.coachPredictions = { [activeMission.id]: "heavier" };
    const wrongPulse = recordDiscoveryPulse(wrong, activeMission, "hopper.mass = 1.2", partial, 0);
    assertEquals(false, !!wrongPulse.hypothesisConfirmed, "Wrong prediction should not award the hypothesis bonus");
    assertEquals(0, wrong.confirmedHypotheses.size, "Wrong prediction should not be marked confirmed");
    assertEquals(afterHypothesisBursts22bb, particleColors22bb.filter(color => color === "#a7f3d0").length, "Wrong prediction should not spawn hypothesis particles");

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

  // Test 22bc: Loop Engineer's Combo Amplifier pays only for chained NEW progress.
  const oldGetElementById22bc = document.getElementById;
  try {
    const activeMission = PLANETS[0].missions.find(mission => mission.id === "earth-gravity-wall");
    const complete = {
      allPassed: true,
      items: [
        { id: "earth-hopper-active", label: "Hopper activated", passed: true, message: "Hopper active" },
        { id: "earth-emerald-gates", label: "Agility 30+ reached", passed: true, message: "Gate open" }
      ]
    };
    const panel = { classList: { add: () => {}, remove: () => {} }, innerHTML: "" };
    document.getElementById = (id) => id === "discovery-pulse" ? panel : null;

    const game = new StarHopperGame();
    game.player = { x: 100, y: 120, w: 24, h: 32 };
    game.researchXP = 120;
    game.discoveryCombo = 2;
    game.discoveryPassCounts = { [activeMission.id]: 1 };
    game.discoveredFormulaKinds = new Set(["engine"]);
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
    renderTestResult("engine-suite", "Curriculum: combo amplifier rewards chained progress", true);
  } catch (err) {
    document.getElementById = oldGetElementById22bc;
    renderTestResult("engine-suite", "Curriculum: combo amplifier rewards chained progress", false, err.message);
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
    assertEquals("Probability seed logged", storyContract.title, "Chance proof should show the probability seed payoff");
    sourceScene = getSignalSourceScene(quantumChanceComplete, storyContract);
    assertEquals("The waiting probe answers", sourceScene && sourceScene.title, "Quantum source scene should answer the teaser");
    updateSignalStoryPanel(quantumChanceComplete);
    assertEquals(true, /QUANTUM SOURCE/.test(els["signal-story-panel"].innerHTML), "Story panel should show the logged Quantum source");
    assertEquals(true, /The waiting probe answers/.test(els["signal-story-panel"].innerHTML), "Quantum source scene should render the payoff title");
    assertEquals(true, /probability is a pattern measured over many trials/.test(els["signal-story-panel"].innerHTML), "Quantum source scene should render the science takeaway");

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
    quest = getActiveLabQuest(game);
    assertEquals("Reach Loop Engineer", quest.title, "After the formula deck, the quest should target the next rank perk");
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
      "start-rank-preview-label": { textContent: "" },
      "start-rank-preview-title": { textContent: "" },
      "start-rank-preview-body": { textContent: "" },
      "start-rank-preview-bar": { style: { width: "" } },
      "start-world-preview-label": { textContent: "" },
      "start-world-preview-title": { textContent: "" },
      "start-world-preview-body": { textContent: "" },
      "start-world-preview-bar": { style: { width: "" } },
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
    game.discoveryPassCounts = {};
    game.discoveryCombo = 2;
    updateResearchProgress(game);
    assertEquals(true, /NEXT LAB QUEST/.test(els["research-rank-card"].innerHTML), "Rank card should render the lab quest");
    assertEquals(true, /Collect Mass Lab/.test(els["research-rank-card"].innerHTML), "Rendered quest should point to the next formula card");
    assertEquals("LAB QUEST", startKicker.textContent, "Start radar should reuse the lab quest category");
    assertEquals("Collect Mass Lab", els["start-mission-radar-title"].textContent, "Start radar should show the same next quest");
    assertEquals(`1/${DISCOVERY_RULES.length} formulas · 60 XP`, els["start-mission-radar-progress"].textContent, "Start radar should show formula and XP progress");
    assertEquals(true, /formula card/.test(els["start-mission-radar-reward"].textContent), "Start radar should show the quest reward");
    assertEquals("CADET RECORD", els["start-cadet-identity-label"].textContent, "Start radar should label the cadet record");
    assertEquals("🚀 Nova // Physics Tinkerer", els["start-cadet-identity-title"].textContent, "Start radar should name the active cadet and research rank");
    assertEquals(true, /1\/\d+ formulas/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include formula deck progress");
    assertEquals(true, /1\/12 transmissions/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include story transmission progress");
    assertEquals(true, /Trading Friend · 3 trust/.test(els["start-cadet-identity-body"].textContent), "Cadet record should include village trust identity");
    assertEquals("8%", els["start-cadet-identity-bar"].style.width, "Cadet record should show rank progress");
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
    assertEquals("Trading Friend · 3 trust", els["start-village-preview-title"].textContent, "Start radar should show village trust tier and points");
    assertEquals(true, /4 trust to Cave Ally/.test(els["start-village-preview-body"].textContent), "Start radar should show the next village trust gap");
    assertEquals(true, /Cave Rescue Pact/.test(els["start-village-preview-body"].textContent), "Start radar should name the next village pact");
    assertEquals(true, /State machine: danger -> cave -> safe/.test(els["start-village-preview-body"].textContent), "Start radar should connect village progress to the coding concept");
    assertEquals("25%", els["start-village-preview-bar"].style.width, "Start radar should show village trust progress");
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
    game.startFrontierChallenge = (options) => { prepCalls++; prepOptions = options || null; return true; };
    window.Game = game;
    assertEquals(true, runStartMissionRadarAction(), "Prep radar action should execute");
    assertEquals(1, prepCalls, "Prep radar action should start the Frontier challenge");
    assertEquals("dark-matter-prep", prepOptions && prepOptions.source, "Prep radar action should pass the Dark Matter prep source");

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
    assertEquals("Probability seed logged", els["start-story-preview-title"].textContent, "Chance proof should show the probability seed payoff");
    assertEquals(true, /The waiting probe answers/.test(els["start-story-preview-body"].textContent), "Quantum source preview should answer the future-world teaser");
    assertEquals("Clear today's signal", els["start-mission-radar-title"].textContent, "After the Quantum source seed, complete progress should return to daily practice");

    game.frontierRecords = {};
    game.discoveryPassCounts = {};
    updateStartMissionRadar(game);
    assertEquals("Clear today's signal", els["start-mission-radar-title"].textContent, "Without a decoded anomaly, complete progress should surface the daily practice loop");
    assertEquals("ACCEPT SIGNAL", els["start-mission-radar-btn"].textContent, "Daily quest should get a direct accept button");
    assertEquals("daily", els["start-mission-radar-btn"].dataset.action, "Daily quest button should use the daily action");

    let dailyCalls = 0;
    const startedLevels = [];
    window.Game = {
      startDailySignal: () => { dailyCalls++; },
      startLevel: (level) => { startedLevels.push(level); }
    };
    assertEquals(true, runStartMissionRadarAction(), "Daily radar action should execute");
    assertEquals(1, dailyCalls, "Daily radar action should start the Daily Signal");
    els["start-mission-radar-btn"].dataset.action = "quest";
    els["start-mission-radar-btn"].dataset.level = "2";
    assertEquals(true, runStartMissionRadarAction(), "Quest radar action should execute");
    assertEquals(2, startedLevels[0], "Quest radar action should start the requested planet");
    window.Game = oldWindowGame22cc;
    window.StarHopperProfiles = oldProfiles22cc;

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
  const oldAttemptRows22e = (typeof AttemptLog !== 'undefined' && AttemptLog.byPlanet) ? AttemptLog.byPlanet : null;
  try {
    window.StarHopperProfiles = { getActive: () => ({ name: "Nova", emoji: "🚀" }) };
    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = { 0: [{ maxH: 222, maxV: 6.4, result: "cleared" }] };
    const report = { innerHTML: "" };
    document.getElementById = (id) => id === "clear-lab-report" ? report : null;

    const game = new StarHopperGame();
    game.currentPlanet = PLANETS[0];
    game.currentPlanetIndex = 0;
    game.completedMissions = new Set(PLANETS[0].missions.map(mission => mission.id));
    game.requiredCollectiblesTotal = 2;
    game.requiredCollectiblesCollected = 2;
    game.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    game.discoveryPassCounts = { "earth-gravity-wall": 1 };
    game.discoveredFormulaKinds = new Set(["antigravity"]);
    game.researchXP = 60;
    game.planetClears = { 0: 1 };
    game.villageTrust = { 0: { points: 7, badges: ["friend", "ally"], sources: { "village-trade:0:geary:engine_1": 3, "village-rescue:0:geary": 4 } } };
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
    assertEquals(true, /1\/\d+ formulas/.test(report.innerHTML), "Clear report cadet record should show formula progress");
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
    assertEquals(true, new RegExp(`1\\/${DISCOVERY_RULES.length}`).test(report.innerHTML), "Clear report should include formula deck progress");
    assertEquals(true, /\+2 emerald/.test(report.innerHTML), "Clear report should include newly banked gems");
    assertEquals(true, /Collect Mass Lab/.test(report.innerHTML), "Clear report should include the next lab quest");

    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = oldAttemptRows22e || {};
    window.StarHopperProfiles = oldProfiles22e;
    document.getElementById = oldGetElementById22e;
    renderTestResult("engine-suite", "Curriculum: clear screen renders lab report", true);
  } catch (err) {
    if (typeof AttemptLog !== 'undefined') AttemptLog.byPlanet = oldAttemptRows22e || {};
    window.StarHopperProfiles = oldProfiles22e;
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
    actionGame.runClearReplayContract({ action: "dark-matter-prep" });
    actionGame.runClearReplayContract({ action: "launch" });
    assertEquals(1, dailyCalls, "Daily action should accept the daily signal");
    assertEquals(2, frontierCalls, "Frontier and prep actions should start Frontier challenges");
    assertEquals(null, frontierOptions[0], "Normal Frontier action should not carry prep options");
    assertEquals("dark-matter-prep", frontierOptions[1] && frontierOptions[1].source, "Prep action should carry the Dark Matter prep source");
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
    assertEquals(true, /Standard Gravity & Trajectories/.test(nodes[0].title), "Cleared node title should include the science concept");
    assertEquals(true, /Cave Ally \(7 trust\)/.test(nodes[0].title), "Cleared node title should include village trust progress");
    assertEquals(false, nodes[1].disabled, "Moon should unlock after Earth clear");
    assertEquals(true, /Unlocked/.test(nodes[1]._meta.innerHTML), "Next planet should read as unlocked");
    assertEquals(true, /Low Gravity &amp; Jump Loops/.test(nodes[1]._meta.innerHTML), "Unlocked next node should preview its science concept");
    assertEquals(true, /1 of 3 Lab Stars/.test(nodes[1]._meta.innerHTML), "Saved next-planet stars should render");
    assertEquals(true, nodes[2].disabled, "Jupiter should remain locked before Moon clear");
    assertEquals(true, /Locked/.test(nodes[2]._meta.innerHTML), "Locked node keeps locked copy");
    assertEquals(true, /High Gravity &amp; Rocket Force/.test(nodes[2]._meta.innerHTML), "Locked node should preview the upcoming science concept");
    assertEquals(true, /Recover previous shard/.test(nodes[2]._meta.innerHTML), "Locked node should explain how to unlock");
    assertEquals(true, /Next concept: High Gravity & Rocket Force/.test(nodes[2].title), "Locked node title should name the coming concept");
    assertEquals(true, /Transmission incoming/.test(teasers[0]._meta.innerHTML), "Future Dark Matter node should start as an incoming transmission");
    assertEquals(false, teasers[0].classList.contains("anomaly-next"), "Future Dark Matter node should not pulse as the next anomaly before the star-map is restored");

    game.planetClears = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    game.frontierRecords = {};
    game.refreshGalaxyMapProgress();
    assertEquals(true, teasers[0].classList.contains("anomaly-next"), "Restored star-map should mark Dark Matter as the active anomaly");
    assertEquals(true, /ANOMALY/.test(teasers[0]._meta.innerHTML), "Active anomaly node should label the map hook");
    assertEquals(true, /Infer hidden forces/.test(teasers[0]._meta.innerHTML), "Active anomaly should preview the hidden-force concept");
    assertEquals(true, /Clear one Frontier Challenge/.test(teasers[0]._meta.innerHTML), "Active anomaly should name the retention action");
    assertEquals(true, /hidden-force anomaly detected/.test(teasers[0].title), "Active anomaly title should explain the next story step");
    assertEquals(true, teasers[1].classList.contains("anomaly-waiting"), "Quantum Gate should wait behind the Dark Matter Echo");
    assertEquals(true, /Decode Dark Matter Echo first/.test(teasers[1]._meta.innerHTML), "Quantum Gate teaser should explain its lock");

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
    document.querySelectorAll = oldQuerySelectorAll22g;
    renderTestResult("engine-suite", "Curriculum: galaxy map surfaces lab-star mastery", true);
  } catch (err) {
    document.querySelectorAll = oldQuerySelectorAll22g;
    renderTestResult("engine-suite", "Curriculum: galaxy map surfaces lab-star mastery", false, err.message);
  }

  // Test 22j: The in-run mission panel shows mentor, lab-star, and replay contracts.
  const oldGetElementById22h = document.getElementById;
  const oldCreateElement22h = document.createElement;
  const oldWindowGame22h = window.Game;
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
    game.remixContext = 'first';
    game.bestClearTimes = { 0: 12.4 };
    game.masteryMeters = { 0: { xp: 80, badges: ["scout"], sources: { "science-proof": 24 } } };
    game.villageTrust = { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } };
    game.planetClears = { 0: 1, 1: 1 };
    game.discoveredFormulaKinds = new Set(["antigravity"]);
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
    const worldMastery = findByClass(list, "world-mastery-crt-card");
    const worldMasteryText = flattenText(worldMastery || list);
    const villageTrust = findByClass(list, "village-trust-crt-card");
    const villageTrustText = flattenText(villageTrust || list);
    const signalStory = findByClass(list, "signal-story-crt-card");
    const signalStoryText = flattenText(signalStory || list);
    const mentor = findByClass(list, "mentor-signal-card");
    const mentorText = flattenText(mentor || list);
    const staged = findByClass(list, "staged-experiment-card");
    const stagedText = flattenText(staged || list);
    const contract = findByClass(list, "lab-star-contract");
    const replayBeforeProgress = findByClass(list, "run-replay-contract");
    const text = flattenText(contract || list);
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

    list = makeEl();
    game.lastStagedExperiment = null;
    game.coachPredictions = { "earth-gravity-wall": "lighter-longer" };
    updateMissionList(game);
    const activeLens = findByClass(list, "lesson-lens-card");
    const activeLensButton = findByClass(activeLens || list, "lesson-lens-stage-btn");
    const activeLabQuestion = findByClass(list, "mission-lab-question-card");
    const activeLabQuestionText = flattenText(activeLabQuestion || list);
    const activeLabQuestionButton = findByClass(activeLabQuestion || list, "mission-lab-question-stage-btn");
    assertEquals("STAGE LESSON CODE", activeLensButton && activeLensButton.textContent, "Lesson lens should stage code after prediction");
    assertEquals(false, !!activeLensButton.disabled, "Lesson lens staging should enable after prediction");
    assertEquals(true, /NEXT TEST/.test(activeLabQuestionText), "After prediction, lab question should move to the next test");
    assertEquals(true, /Hopper activated|Agility 30\+ reached/.test(activeLabQuestionText), "Next test should name a live mission check");
    assertEquals("STAGE TEST", activeLabQuestionButton && activeLabQuestionButton.textContent, "Next-test card should stage its code");
    assertEquals(false, !!activeLabQuestionButton.disabled, "Next-test staging should be enabled");
    const inputEl22j = {
      value: "",
      focused: false,
      style: {},
      scrollHeight: 20,
      focus() { this.focused = true; },
      setSelectionRange() {}
    };
    document.getElementById = (id) => id === "console-input" ? inputEl22j : (id === "mission-list" ? list : null);
    activeLensButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Lesson lens stage action should include mission setup code");
    assertEquals(true, /hopper\.mass/.test(inputEl22j.value), "Lesson lens stage action should include the scaffold tuning code");
    assertEquals(true, inputEl22j.focused, "Lesson lens stage action should focus the terminal");
    inputEl22j.value = "";
    inputEl22j.focused = false;
    activeLabQuestionButton._events.click();
    assertEquals(true, /use_hopper\(\)/.test(inputEl22j.value), "Lab question stage action should include setup code");
    assertEquals(false, /hopper\.mass/.test(inputEl22j.value), "Lab question should stage the focused setup fix for the active failed check");
    assertEquals(true, inputEl22j.focused, "Lab question stage action should focus the terminal");
    assertEquals("mission-lab-question", game.lastStagedExperiment && game.lastStagedExperiment.source, "Lab question staging should remember its source");
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
    renderTestResult("engine-suite", "Curriculum: mission panel shows mentor, lab-star, and replay contracts", true);
  } catch (err) {
    document.getElementById = oldGetElementById22h;
    document.createElement = oldCreateElement22h;
    window.Game = oldWindowGame22h;
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
      appendChild(child) { this.children.push(child); return child; },
      querySelectorAll: () => [],
      addEventListener: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
    });
    const els = {
      "pedagogical-mission-panel": makeCoachEl(),
      "pedagogical-steps": makeCoachEl(),
      "pedagogical-mission-title": makeCoachEl(),
      "mission-coach-summary": makeCoachEl(),
      "mission-coach-focus": makeCoachEl(),
      "mission-scaffold": makeCoachEl()
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
    updatePedagogicalGuide(game);
    const loop = els["pedagogical-steps"].children.find(child => child.className === "coach-lab-loop");
    assertEquals(true, !!loop, "Coach should render a labeled lab loop strip");
    assertEquals(5, loop.children.length, "Loop strip should show the five learning steps");
    assertEquals("Observe Predict Code Test Explain", loop.children.map(child => child.textContent).join(" "), "Loop strip should name each step");
    assertEquals(true, /done/.test(loop.children[0].className) && /done/.test(loop.children[1].className), "Observed and predicted steps should be marked done");
    assertEquals(true, /active/.test(loop.children[2].className), "Code should be the active step");
    assertEquals(true, /Activate Hopper/.test(els["mission-coach-focus"].innerHTML), "Coach focus should show the next code action");
    assertEquals(true, /Change one number/.test(els["mission-coach-summary"].innerHTML), "Coach summary should surface the beginner concept");
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
    assertEquals("1", localStorage.getItem(readableKey), "Readable mode should persist on");

    assertEquals(false, toggleReadableTextMode(), "Toggle should turn readable mode off");
    assertEquals(false, bodyClasses.has("readable-text-mode"), "Body class should clear when toggled off");
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
    const sentry = new NPC({ id: 'lookout', name: 'Lookout', profession: 'Guard', type: 'npc', x: 140, y: 60, color: '#cbd5e1', caveX: 108, caveY: 60 });
    const prowler = new Mob(150, 60, 'hog', '#9a6b4f', 1);
    prowler.speed = 0; prowler.behaviorTimer = 999;
    g.interactiveObjects = [sentry];
    g.mobs = [prowler];
    for (let i = 0; i < 40 && !sentry.hiddenInCave; i++) sentry.update(g);
    assertEquals(true, sentry.hiddenInCave, "Villager hides when a mob is close, before contact");
    g.mobs = [];
    sentry.panicTimer = 0;
    sentry.update(g);
    assertEquals(false, sentry.hiddenInCave, "Villager comes back out when nearby danger clears");
    assertEquals(true, g.discoveredFormulaKinds.has("state"), "Village rescue collects the AI State Lab card");
    assertEquals(1, g.formulaCardEffects.length, "Village rescue spawns one AI State Lab card effect");
    assertEquals("AI State Lab", g.formulaCardEffects[0].title, "Village rescue card effect names the state-machine concept");
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
    g.toggleSurvival();
    assertEquals(false, g.survivalMode, "Survival mode turns off");
    assertEquals(0, g.mobs.length, "Survival mobs are cleared");
    assertEquals(false, g.getVillagerShelterSignal(npc).active, "Daylight shelter signal clears after Survival turns off");
    assertEquals(false, npc.hiddenInCave, "Villager reappears after survival danger ends");
    assertEquals(130, npc.x, "Daylight release returns the villager to the village home");
    assertEquals(60, npc.y, "Daylight release keeps the villager on the village surface");
    assertEquals("VILLAGE CLEAR: traders back outside", g.missionBalloon && g.missionBalloon.text, "Survival-off daylight release announces visible villagers");
    assertEquals(0, npc.panicTimer, "Villager panic clears after survival mode ends");
    assertEquals(7, g.researchXP, "A danger-caused cave release grants Village Rescue Research XP");
    assertEquals(true, g.hasVillageRescueCredit(1), "Village rescue records world mastery source credit");
    assertEquals(4, g.getVillageTrustProgress(1).points, "Village rescue adds relationship trust");
    assertEquals("Trading Friend", g.getVillageTrustProgress(1).title, "First rescue reaches the first village trust tier");
    assertEquals("TRUST UP", g.discoveryPulse && g.discoveryPulse.villageTrust && g.discoveryPulse.villageTrust.label, "Rescue pulse exposes the trust tier-up");
    assertEquals(null, g.grantVillageRescueReward(npc, "nearby mob"), "The same villager rescue cannot be farmed twice");
    assertEquals(7, g.researchXP, "Duplicate rescue credit does not add more Research XP");
    assertEquals(4, g.getVillageTrustProgress(1).points, "Duplicate rescue credit does not add more village trust");

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
    assertEquals(150, midNpc.x, "Mid-retreat survival release returns the villager to the village home");
    assertEquals(null, midNpc.shelterReason, "Mid-retreat survival release clears stale shelter reason");
    assertEquals(null, midRetreat.activeNPC, "Mid-retreat survival release closes stale trade focus");

    const loopRelease = new StarHopperGame();
    loopRelease.state = 'playing'; loopRelease.currentPlanetIndex = 1; loopRelease.currentPlanet = PLANETS[1];
    loopRelease.player = new Player(0, 0);
    loopRelease.researchXP = 0;
    loopRelease.masteryMeters = {};
    const loopNpc = new NPC({ id: 'loop-release', name: 'Loop Release', profession: 'Miner', type: 'npc', x: 130, y: 60, color: '#cbd5e1', caveX: 72, caveY: 60, hiddenInCave: true });
    loopNpc.panicTimer = 0;
    loopNpc.rescuePending = true;
    loopNpc.shelterReason = "nearby mob";
    loopRelease.interactiveObjects = [loopNpc];
    loopRelease.mobs = [];
    loopRelease.updateVillagerShelterStates();
    assertEquals(false, loopNpc.hiddenInCave, "Game loop shelter pass releases a hidden villager when danger is gone");
    assertEquals(82, loopNpc.x, "Normal cave release starts the villager at the cave mouth");
    assertEquals(7, loopRelease.researchXP, "Loop release grants the rescue XP once the villager returns");

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
    nightGame.toggleSurvival();
    assertEquals(true, nightNpc.hiddenInCave, "Earth night keeps villagers sheltered after survival danger ends");
    assertEquals(82, nightNpc.x, "Earth night parks the villager at the cave mouth");
    assertEquals("NIGHT", nightGame.getVillagerCaveStatus(nightNpc).label, "Survival-off night cave marker explains the villager did not disappear");
    assertEquals("VILLAGE NIGHT: traders wait in caves", nightGame.missionBalloon && nightGame.missionBalloon.text, "Survival-off night release explains villagers stayed in caves");
    assertEquals(0, nightNpc.panicTimer, "Night shelter clears mob panic without forcing villagers outside");
    assertEquals(0, nightGame.researchXP, "Night shelter waits to reward until the villager can actually return");
    renderTestResult(SUITE, "Villagers: survival off releases cave hiding", true);
  } catch (err) {
    renderTestResult(SUITE, "Villagers: survival off releases cave hiding", false, err.message);
  }

  // C19f: Earth night sends villagers into caves, and daylight brings them back out.
  try {
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
    assertEquals(null, npc.shelterReason, "Daylight clears the night shelter reason");
    assertEquals(0, g.researchXP || 0, "Daylight release from night shelter does not award rescue XP");
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
    assertEquals(0, loadGame.researchXP, "Daylight release from night shelter does not award rescue XP");
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
  const oldBubblePopC24 = ComicBubbles.pop;
  const prevGameC24 = (typeof window !== 'undefined') ? window.Game : undefined;
  try {
    const bubbleLabelsC24 = [];
    ComicBubbles.pop = (x, y, text) => { bubbleLabelsC24.push(text); };
    const g = new StarHopperGame();
    window.Game = g;
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
    executeNPCTrade('geary', 'engine_1');
    assertEquals(4, g.gemsWallet.emerald, "Trade deducts the cost from the wallet");
    assertEquals(3, g.upgradeCapBonuses.engine, "Cap reward applies the bonus");
    assertEquals(true, g.purchasedTrades.has('engine_1'), "Trade is marked purchased");
    assertEquals("CAP UP!", g.lastTradeRewardEffect.label, "Cap trade should create an in-level reward cue");
    assertEquals("ENGINE +3", g.lastTradeRewardEffect.detail, "Cap trade cue should name the upgraded stat");
    assertEquals(true, bubbleLabelsC24.some(label => /CAP UP!/.test(label)), "Cap trade should pop a named reward cue");
    assertEquals(4, g.researchXP, "First village trade should award Research XP");
    assertEquals(8, g.getWorldMasteryProgress(0).xp, "First village trade should add world mastery XP");
    assertEquals("Village Trade Proof", g.discoveryPulse && g.discoveryPulse.title, "Village trade should create a discovery pulse");
    assertEquals("TRADE PACT", g.discoveryPulse && g.discoveryPulse.villageTradeProof && g.discoveryPulse.villageTradeProof.label, "Cap trade should expose a trade proof chip");
    assertEquals(3, g.getVillageTrustProgress(0).points, "First trade should add village trust");
    assertEquals("Trading Friend", g.getVillageTrustProgress(0).title, "First trade should reach the first village trust tier");
    assertEquals("TRUST UP", g.discoveryPulse && g.discoveryPulse.villageTrust && g.discoveryPulse.villageTrust.label, "Trade pulse should expose the village trust chip");
    assertEquals("VILLAGE LAB", g.missionBalloon && g.missionBalloon.title, "Trade proof should use the mission monitor");
    assertEquals("TRADE PACT: +4 Research XP", g.missionBalloon && g.missionBalloon.text, "Trade proof should announce the XP payoff");
    const tradeProofKey = g.getVillageTradeProofSourceKey(npc, npc.trades[0]);
    assertEquals(1, g.discoveryPassCounts[tradeProofKey], "Trade proof stores its one-time source key");
    assertEquals(null, g.grantVillageTradeProof(npc, npc.trades[0]), "Repeating the same trade proof is blocked");
    assertEquals(4, g.researchXP, "Repeated trade proof does not farm Research XP");
    assertEquals(3, g.getVillageTrustProgress(0).points, "Repeated trade proof does not farm village trust");
    request = getVillageTradeRequest(g, npc);
    assertEquals("VILLAGE REQUEST", request.kicker, "After a purchase, request should move to the next unpurchased offer");
    assertEquals(95, request.missing, "Trade request should state the remaining gem gap");
    assertEquals(true, /Collect 95 more Emerald/.test(request.body), "Trade request should explain what to collect next");
    executeNPCTrade('geary', 'pricey');     // can't afford (have 4, costs 99)
    assertEquals(4, g.gemsWallet.emerald, "Unaffordable trade does not deduct");
    assertEquals(3, g.upgradeCapBonuses.engine, "Unaffordable trade grants no bonus");
    window.Game = prevGameC24;
    ComicBubbles.pop = oldBubblePopC24;
    renderTestResult(SUITE, "Trade: deducts gems, applies cap, blocks over-spend", true);
  } catch (err) {
    window.Game = prevGameC24;
    ComicBubbles.pop = oldBubblePopC24;
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
      "frontier-signal-btn": { style: {}, textContent: "", title: "" },
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
    assertEquals("flex", els["frontier-record-banner"].style.display, "Frontier record banner should appear after star-map completion");
    assertEquals(true, /Today's frontier cleared/.test(els["frontier-record-label"].textContent), "Banner should show today's local clear");
    assertEquals(true, /Best T/.test(els["frontier-record-detail"].textContent), "Banner should show the local best tier");
    assertEquals(true, els["frontier-share-btn"].title.indexOf("FRONTIER-") >= 0, "Copy button should carry the share code");
    assertEquals(true, /3 Lab Stars/.test(els["frontier-signal-btn"].title), "Frontier button should name the lab-star goal");
    assertEquals(true, els["frontier-signal-btn"].title.indexOf(frontier.labContract.title) >= 0, "Frontier button should name the replay lab focus");
    assertEquals(true, els["frontier-signal-btn"].title.indexOf(frontier.labContract.command.split("\n")[0]) >= 0, "Frontier button should expose the sample command");
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
    const reward = { textContent: "" };
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
    g.getTodayDateStr = () => "2026-06-10";
    g.updateReturnStreak();
    assertEquals("2026-06-10", g.lastPlayedDate, "First local day should be recorded");
    assertEquals(1, g.streakCount, "First local day starts the streak");
    assertEquals(16, g.researchXP, "First-ever play should not grant free Research XP");
    assertEquals(null, g.lastReturnStreakReward, "No reward pulse is created on the first-ever day");
    assertEquals("Next daily experiment: +5 Research XP", reward.textContent, "Start chip should preview the next daily lab reward");
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
    assertEquals("+5 Research XP today", reward.textContent, "Start chip should show today's streak reward");
    g.lastReturnStreakReward = null;
    g.refreshStreakBanner();
    assertEquals("Next daily experiment: +6 Research XP", reward.textContent, "Start chip should show the next consecutive reward after today's pulse is gone");
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
      researchXP: 24, discoveryCombo: 1, discoveryLog: [], discoveryPassCounts: {},
      discoveredFormulaKinds: new Set(["mass"]),
      confirmedHypotheses: new Set(["earth-gravity-wall"])
    };
    window.Game = Game;
    const snap = shCaptureProgress();
    Game.bestClearTimes = {}; Game.bestLabStars = {}; Game.dailySignalClears = 0; Game.frontierRecords = {}; Game.frontierBoard = {}; Game.lastPlayedDate = null; Game.streakCount = 0; Game.masteryCleared = {}; Game.villageTrust = {}; Game.researchXP = 0; Game.discoveredFormulaKinds = new Set(); Game.confirmedHypotheses = new Set();
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
    assertEquals(true, Game.discoveredFormulaKinds.has("mass"), "Formula cards round-trip");
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
    assertEquals(true, payload.profileProgress.confirmedHypotheses.includes("earth-gravity-wall"), "Confirmed hypotheses should export");
    const merged = mergeProgress(
      { unlockedUpgrades: ["jump"], upgradeLevels: { engine: 0.25 }, planetClears: { 0: 1 }, bestLabStars: { 0: 1, 1: 2 }, masteryMeters: { 0: { xp: 95, badges: ["engineer"], sources: { stars: 40 } } }, villageTrust: { 0: { points: 3, badges: ["friend"], sources: { "village-trade:0:geary:engine_1": 3 } } }, frontierRecords: { "2026-06-30": { dateStr: "2026-06-30", shareCode: "FRONTIER-EARTH-9999", tier: 2, stars: 2, bestTime: 25.4 } }, frontierBoard: { "FRONTIER-MOON-2222": { dateStr: "2026-06-30", shareCode: "FRONTIER-MOON-2222", tier: 2, stars: 3, bestTime: 49.5, pilot: "Grace" } }, researchXP: 8, discoveryPassCounts: { "earth-gravity-wall": 0 }, discoveredFormulaKinds: ["friction"], confirmedHypotheses: ["moon-canyon-jump"] },
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
    firstFix._events.click();
    assertEquals("higher", AttemptLog.byPlanet[0][0].prediction, "Suggested hypothesis attaches to the next attempt before reset");
    assertEquals(null, AttemptLog.pendingPrediction, "Pending hypothesis is consumed by the new attempt row");
    assertEquals(stagedCommand, input.value, "Clicking the fix still stages the command in the console");
    assertEquals(true, input.focused, "Clicking the fix focuses the console for the next experiment");

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
    assertEquals(3, cloudSaves, "Saving a Signal Lab reflection should persist the new entry");

    response.value = "A revised Daily Signal explanation still should not farm XP.";
    saveNotebookReflection();
    assertEquals(25, game.researchXP, "Re-saving the same Daily Signal reflection should not farm XP");
    assertEquals("A revised Daily Signal explanation still should not farm XP.", notebookEntries[signalEntryKey].answer, "Signal Lab re-save should update the answer");
    assertEquals(5, notebookEntries[signalEntryKey].reflectionRewardXP, "Daily Signal re-save should preserve the original proof badge");
    assertEquals(4, cloudSaves, "Signal Lab re-save should still persist the revised answer");

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
    assertEquals(12, game.discoveryPulse.worldMasteryAddedXP, "Dark Matter prep reflection should add the strongest world mastery proof XP");
    assertEquals("SIGNAL PROOF: +7 Research XP", game.missionBalloon && game.missionBalloon.text, "Dark Matter prep reflection should write the strongest CRT reward line");
    assertEquals("Hidden force evidence", darkMatterEntry.title, "Dark Matter prep notebook entry should use the replay focus title");
    assertEquals(7, darkMatterEntry.reflectionRewardXP, "Dark Matter prep notebook entry should remember its proof reward");
    assertEquals(true, /signal lab: Dark Matter Prep/.test(darkMatterEntry.evidence), "Dark Matter prep entry should preserve contextual evidence");
    assertEquals(7, cloudSaves, "Saving a Dark Matter prep reflection should persist the new entry");

    response.value = "The revised hidden-force explanation still uses the same proof.";
    saveNotebookReflection();
    assertEquals(38, game.researchXP, "Re-saving the same Dark Matter prep reflection should not farm XP");
    assertEquals("The revised hidden-force explanation still uses the same proof.", notebookEntries[darkMatterEntryKey].answer, "Dark Matter prep re-save should update the answer");
    assertEquals(7, notebookEntries[darkMatterEntryKey].reflectionRewardXP, "Dark Matter prep re-save should preserve the original proof badge");
    assertEquals(8, cloudSaves, "Dark Matter prep re-save should still persist the revised answer");

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
