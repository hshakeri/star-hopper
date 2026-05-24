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

// -----------------------------------------------------------------------------
// Test Case Declarations
// -----------------------------------------------------------------------------

// Suite 1: Compiler Parser
function runCompilerTests() {
  Compiler.reset();

  // Test 1: Gravity variable assignment
  try {
    const res = Compiler.runCommand("gravity = 0.25", {});
    assertEquals(true, res.success, "Command should succeed");
    assertEquals(0.25, Compiler.env.gravity, "Gravity override should be 0.25");
    renderTestResult("compiler-suite", "Variable Assignment: gravity = 0.25", true);
  } catch (err) {
    renderTestResult("compiler-suite", "Variable Assignment: gravity = 0.25", false, err.message);
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
    const res = Compiler.runCommand("gravity = 0.1; friction = 5.0", {});
    assertEquals(true, res.success);
    assertEquals(0.1, Compiler.env.gravity);
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
    
    // Apply compiler overrides
    Compiler.runCommand("gravity = 0.2", {});
    
    // Merge overrides logic similar to physics.js
    const activeGravity = (Compiler.env.gravity !== null) ? Compiler.env.gravity : mockPlanetPhysics.gravity;
    const activeFriction = (Compiler.env.friction !== null) ? Compiler.env.friction : mockPlanetPhysics.friction;

    assertEquals(0.2, activeGravity, "Gravity override should take precedence");
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

  // Test 14: player.speed command updates the movement speed override used by physics
  try {
    Compiler.reset();
    const mockGame = {
      currentPlanet: { physics: { speed: 3.2 } },
      player: {}
    };

    const res = Compiler.runCommand("player.speed = 5.5", mockGame);

    assertEquals(true, res.success);
    assertEquals(5.5, Compiler.env.speed, "player.speed should write to the runtime speed override");
    renderTestResult("engine-suite", "Compiler: player.speed tunes active movement speed", true);
  } catch (err) {
    renderTestResult("engine-suite", "Compiler: player.speed tunes active movement speed", false, err.message);
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
    game.player.jumpPower = 17;
    game.hopperMass = 1.2;
    Compiler.env.speed = 4.8;
    assertEquals(true, game.canCollectGem(highGem), "High Earth gems should unlock with the full Hopper build");
    renderTestResult("engine-suite", "Objectives: Earth gems require progressive engineering gates", true);
  } catch (err) {
    renderTestResult("engine-suite", "Objectives: Earth gems require progressive engineering gates", false, err.message);
  }
}

// Suite 4: Solar Interplanetary Flight Simulator Tests
function runSolarTests() {
  // Test 18: Vector Math Addition and Scaling
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

  // Test 19: Deterministic circular orbit position lookup
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

  // Test 20: Hohmann Transfer math validation
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

  // Test 21: Spacecraft console command queue parser
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

  // Test 22: Solar mission starts in a stable local Earth parking orbit
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

  // Test 23: Navigator zoom preserves the world point under the cursor
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
}

// Main execution entry point
window.addEventListener("load", () => {
  runCompilerTests();
  runSafetyTests();
  runEngineTests();
  runSolarTests();
});
