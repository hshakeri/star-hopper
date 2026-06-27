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
  try {
    const game = new StarHopperGame();
    game.currentPlanet = {
      missions: [
        { id: "build" },
        { id: "collect" }
      ]
    };
    game.completedMissions = new Set(["build"]);
    game.requiredCollectiblesTotal = 3;
    game.requiredCollectiblesCollected = 2;

    let status = game.getLevelObjectiveStatus();
    assertEquals(false, status.readyForPortal, "Portal should stay locked while tasks or gems remain");

    game.completedMissions.add("collect");
    game.requiredCollectiblesCollected = 3;
    status = game.getLevelObjectiveStatus();

    assertEquals(true, status.readyForPortal, "Portal should unlock only after tasks and gems are complete");
    renderTestResult("engine-suite", "Objectives: portal requires tasks plus mission gems", true);
  } catch (err) {
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

  // C3: XP accrues to the per-world mastery meter and levels the weapon
  try {
    const game = new StarHopperGame();
    game.player = new Player(0, 0); game.currentPlanetIndex = 0; game.masteryMeters = {};
    game.weaponLevel = 1; game.totalXP = 0;
    game.addXP(50);
    assertEquals(2, game.weaponLevel, "45+ XP reaches weapon level 2");
    assertEquals(true, (game.masteryMeters[0].xp || 0) >= 50, "XP fills the per-world mastery meter");
    renderTestResult(SUITE, "XP: fills mastery meter + levels the weapon", true);
  } catch (err) {
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

  // Test R8: Moon retry 2 is the loop "spring budget" constraint
  try {
    const v = buildPlanetVariant(PLANETS[1], 1, 2);
    assertEquals("moon-spring-budget", v.constraint && v.constraint.id, "Moon retry 2 should be the spring-budget constraint");
    assertEquals(true, Number.isFinite(v.constraint.springCount) && v.constraint.springCount >= 2, "Spring budget should set a loop count");
    renderTestResult(SUITE, "Variant: Moon flavor rotation surfaces a loop spring-budget", true);
  } catch (err) {
    renderTestResult(SUITE, "Variant: Moon flavor rotation surfaces a loop spring-budget", false, err.message);
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

  // Test R10: Daily Signal is deterministic per date and always a playable remix
  try {
    const a = getDailySignal(PLANETS, "2026-06-11", 4);
    const b = getDailySignal(PLANETS, "2026-06-11", 4);
    assertEquals(a.seed, b.seed, "Same date must give the same seed");
    assertEquals(a.planetIndex, b.planetIndex, "Same date must give the same planet");
    assertEquals(a.variant.variantLabel, b.variant.variantLabel, "Same date must give the same remix");
    assertEquals(true, a.variant.isRemix, "The daily is always a remix (attempt >= 1)");
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

  // Test R12: Game-local date formatting uses the browser calendar, not UTC ISO rollover.
  try {
    const g = new StarHopperGame();
    const localLateNight = new Date(2026, 0, 2, 0, 30, 0);
    assertEquals("2026-01-02", g.getTodayDateStr(localLateNight), "Local constructor date should format as the same local calendar day");
    renderTestResult(SUITE, "Daily Signal/Streak: local date avoids UTC rollover", true);
  } catch (err) {
    renderTestResult(SUITE, "Daily Signal/Streak: local date avoids UTC rollover", false, err.message);
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
      bestClearTimes: { 0: 12.4 }, masteryCleared: { 1: true }, masteryMeters: {},
      dailySignalClears: 3, lastPlayedDate: "2026-06-13", streakCount: 5
    };
    window.Game = Game;
    const snap = shCaptureProgress();
    Game.bestClearTimes = {}; Game.dailySignalClears = 0; Game.lastPlayedDate = null; Game.streakCount = 0; Game.masteryCleared = {};
    shApplyProgress(snap);
    assertEquals(12.4, Game.bestClearTimes[0], "best clear time round-trips");
    assertEquals(true, Game.masteryCleared[1], "mastery-cleared flag round-trips");
    assertEquals(3, Game.dailySignalClears, "daily-signal clears round-trip");
    assertEquals("2026-06-13", Game.lastPlayedDate, "lastPlayedDate round-trips");
    assertEquals(5, Game.streakCount, "streakCount round-trips");
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
    if (oldSaveR18) saveLocalProgress = oldSaveR18;
    if (oldAttemptFinishR18) attemptLogFinish = oldAttemptFinishR18;
    renderTestResult(SUITE, "Daily Signal: clear does not advance campaign unlocks", true);
  } catch (err) {
    if (oldSaveR18) saveLocalProgress = oldSaveR18;
    if (oldAttemptFinishR18) attemptLogFinish = oldAttemptFinishR18;
    renderTestResult(SUITE, "Daily Signal: clear does not advance campaign unlocks", false, err.message);
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
      masteryCleared: { 0: true },
      masteryMeters: { 0: { xp: 5 } },
      dailySignalClears: 4,
      lastPlayedDate: "2026-06-18",
      streakCount: 3
    };
    window.Game = Game;
    const payload = buildSavePayload();
    assertEquals(2, payload.schemaVersion, "Payload should be versioned");
    assertEquals(0.75, payload.profileProgress.upgradeLevels.engine, "Upgrade levels should export");
    assertEquals(2, payload.profileProgress.planetClears[0], "Campaign clear counts should export");
    assertEquals(4, payload.profileProgress.dailySignalClears, "Daily Signal clears should export");
    const merged = mergeProgress(
      { unlockedUpgrades: ["jump"], upgradeLevels: { engine: 0.25 }, planetClears: { 0: 1 } },
      progressFromSavePayload(payload)
    );
    assertEquals(true, merged.unlockedUpgrades.includes("engine"), "Incoming unlocked upgrade survives merge");
    assertEquals(true, merged.unlockedUpgrades.includes("jump"), "Local unlocked upgrade survives merge");
    assertEquals(0.75, merged.upgradeLevels.engine, "Merge keeps the higher upgrade level");
    assertEquals(2, merged.planetClears[0], "Merge keeps the higher clear count");
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
