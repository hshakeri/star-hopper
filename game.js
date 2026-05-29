// game.js - Star Hopper platformer game engine, loops, level loading, and draw pipelines

class StarHopperGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.currentPlanetIndex = 0;
    this.currentPlanet = null;
    
    // Both characters live simultaneously
    this.star = null;
    this.hopper = null;
    this.player = null; // Reference to active character
    this.starMass = 1.0;
    this.hopperMass = 2.5;
    
    this.enemies = [];
    this.interactiveObjects = [];
    
    // Spawned entities from user terminal commands
    this.spawnedBoxes = [];
    this.spawnedSprings = [];
    
    // Camera coordinates
    this.cameraX = 0;
    
    // Game state: 'start', 'playing', 'clear', 'gameover'
    this.state = 'start';
    
    // Key state tracker
    this.keys = {};
    
    // Background starfield coordinates
    this.bgStars = [];

    // Gem collection tally
    this.coinsCollected = 0;
    this.requiredCollectiblesTotal = 0;
    this.requiredCollectiblesCollected = 0;
    this.portalLockNoticeCooldown = 0;
    this.gemGateNoticeCooldown = 0;
    this.lastGemGateNoticeId = null;

    // Track level checkpoint
    this.startX = 64;
    this.startY = 250;

    // Completed missions list
    this.completedMissions = new Set();
    this.coachPredictions = {};
    this.coachLastResults = {};
    this.lastCoachCodeByMission = {};
    this.earnedBadges = new Set();
    this.pendingNavigationTargetIndex = null;
    this.navigationReturnTimer = null;

    // Fixed-step simulation keeps movement stable across 60Hz, 120Hz, and throttled tabs.
    this.lastFrameTime = 0;
    this.physicsAccumulator = 0;
    this.fixedStepMs = 1000 / 60;
    this.maxAccumulatedFrameMs = 1000 / 15;
    this.maxPhysicsSteps = 5;
    this.isPaused = false;
  }

  getGemConfig(index = this.currentPlanetIndex) {
    const gems = [
      { id: "earth", name: "Emerald Core", shortName: "Emerald", color: "#4ade80", glow: "rgba(74, 222, 128, 0.72)" },
      { id: "moon", name: "Moon Quartz", shortName: "Quartz", color: "#93c5fd", glow: "rgba(147, 197, 253, 0.72)" },
      { id: "jupiter", name: "Amber Storm", shortName: "Amber", color: "#fb923c", glow: "rgba(251, 146, 60, 0.72)" },
      { id: "glacies", name: "Violet Ice", shortName: "Violet", color: "#a78bfa", glow: "rgba(167, 139, 250, 0.72)" },
      { id: "magnet", name: "Magenta Flux", shortName: "Flux", color: "#ec4899", glow: "rgba(236, 72, 153, 0.72)" }
    ];
    return gems[index] || gems[0];
  }

  getCurrentGravity() {
    if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.gravity !== null) {
      return Compiler.env.gravity;
    }
    return this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.gravity : 0;
  }

  getCurrentSpeed() {
    if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.speed !== null) {
      return Compiler.env.speed;
    }
    return this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.speed : 0;
  }

  getCurrentFriction() {
    if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.friction !== null) {
      return Compiler.env.friction;
    }
    return this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.friction : 0;
  }

  hasActiveRule(check) {
    if (typeof Compiler === 'undefined' || !Array.isArray(Compiler.activeRules)) return false;
    return Compiler.activeRules.some(check);
  }

  isEarthHopperEngineered() {
    return this.player
      && this.player.charType === 'hopper'
      && this.getCurrentGravity() <= 0.35
      && this.player.jumpPower >= 17
      && this.hopperMass <= 1.2
      && this.getCurrentSpeed() >= 4.8;
  }

  isJupiterHopperEngineered() {
    return this.player
      && this.player.charType === 'hopper'
      && this.player.rocketPower >= 70
      && this.hopperMass <= 1.4
      && this.getCurrentSpeed() >= 4.5;
  }

  hasIceTouchRule() {
    return this.hasActiveRule(rule => rule.target === 'player.touching'
      && rule.eventArgs
      && rule.eventArgs[0]
      && rule.eventArgs[0].value === 'ice');
  }

  hasPlayerTouchingRule() {
    return this.hasActiveRule(rule => rule.target === 'player.touching');
  }

  hasRocketEventRule() {
    return this.hasActiveRule(rule => rule.target === 'hopper.rocket_on');
  }

  getGemGateForCollectible(planetIndex, row, col) {
    if (planetIndex === 0) {
      if (row >= 6) {
        return {
          id: "earth-gravity-gems",
          label: "lower gravity to 0.35 or below",
          validate: (game) => game.getCurrentGravity() <= 0.35
        };
      }
      return {
        id: "earth-hopper-engineering-gems",
        label: "use Hopper with gravity <= 0.35, jump_power >= 17, hopper.mass <= 1.2, and speed >= 4.8",
        validate: (game) => game.isEarthHopperEngineered()
      };
    }

    if (planetIndex === 1) {
      if (row >= 5) {
        return {
          id: "moon-arithmetic-gems",
          label: "boost jump_power to 18 or more with arithmetic",
          validate: (game) => game.player && game.player.jumpPower >= 18
        };
      }
      return {
        id: "moon-loop-spring-gems",
        label: "boost jump_power to 18 and spawn 3 springs with a repeat loop",
        validate: (game) => game.player && game.player.jumpPower >= 18 && game.spawnedSprings.length >= 3
      };
    }

    if (planetIndex === 2) {
      return {
        id: "jupiter-engineering-loop-gems",
        label: "engineer Hopper for high gravity and spawn 3 crate blocks with a loop",
        validate: (game) => game.isJupiterHopperEngineered() && game.spawnedBoxes.length >= 3
      };
    }

    if (planetIndex === 3) {
      if (row >= 5) {
        return {
          id: "glacies-friction-gems",
          label: "raise friction to 5 or enable Hopper spikes",
          validate: (game) => game.getCurrentFriction() >= 5 || (game.player && game.player.spikes)
        };
      }
      return {
        id: "glacies-ice-rule-gems",
        label: "raise friction or spikes, then add a when player.touching('ice') rule",
        validate: (game) => (game.getCurrentFriction() >= 5 || (game.player && game.player.spikes)) && game.hasIceTouchRule()
      };
    }

    if (planetIndex === 4) {
      return {
        id: "magnet-event-gems",
        label: "combine a hopper.rocket_on rule with a player.touching rule",
        validate: (game) => game.hasRocketEventRule() && game.hasPlayerTouchingRule()
      };
    }

    return null;
  }

  init() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    
    // Setup background stars
    this.bgStars = [];
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3
      });
    }

    this.setupControls();
    this.loadPlanet(0);
    setupUIBindings(this);
    
    // Begin Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupControls() {
    // Capture keyboard buttons
    window.addEventListener("keydown", (e) => {
      // Prevent scrolling on Space and Arrow keys when focused on game
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        if (document.activeElement.id !== "console-input") {
          e.preventDefault();
        }
      }

      if (document.activeElement.id === "console-input") return; // skip gameplay inputs if typing code

      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.key] = true; // raw code support

      // Swap button 'c' or 'Shift'
      if (e.key === "c" || e.key === "C" || e.key === "Shift") {
        if (this.state === 'playing') {
          this.player.swap(this);
          // Update active border accent color in CSS
          const color = (this.player.charType === 'star') ? 'var(--neon-cyan)' : 'var(--neon-orange)';
          document.documentElement.style.setProperty('--active-neon', color);
          
          // Trigger dialogue comment on first swap
          this.triggerTutorialDialogue("swap");
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.key] = false;
    });

    // Binds Start Screen levels buttons
    const btns = document.querySelectorAll(".level-button");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-level"));
        this.startLevel(id);
      });
    });

    // Next level button
    const nextBtn = document.getElementById("btn-next-level");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.beginNextPlanetNavigation();
      });
    }

    // Reset buttons
    const restartBtn = document.getElementById("btn-restart");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        this.resetLevel();
      });
    }
    
    const retryBtn = document.getElementById("btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        this.startLevel(this.currentPlanetIndex, true);
      });
    }
  }

  startLevel(id, preserveTunings = false) {
    this.isPaused = false;
    if (typeof updatePauseControls === 'function') updatePauseControls();
    this.state = 'playing';
    const startScr = document.getElementById("start-screen");
    const clearScr = document.getElementById("clear-screen");
    const goScr = document.getElementById("gameover-screen");

    if (startScr) startScr.classList.add("hidden");
    if (clearScr) clearScr.classList.add("hidden");
    if (goScr) goScr.classList.add("hidden");
    this.loadPlanet(id, preserveTunings);
  }

  loadPlanet(index, preserveTunings = false) {
    this.currentPlanetIndex = index;
    this.currentPlanet = PLANETS[index];

    // On a same-level retry, keep the player's typed code tunings so progress
    // made one task at a time survives death/restart. Only the physical level
    // (position, gems, enemies) is rebuilt below.
    let saved = null;
    if (preserveTunings && this.player) {
      saved = {
        env: { ...Compiler.env },
        rules: Compiler.activeRules.slice(),
        hopperMass: this.hopperMass,
        starMass: this.starMass,
        charType: this.player.charType,
        jumpPower: this.player.jumpPower,
        rocketPower: this.player.rocketPower
      };
    }

    // Clear terminal overrides
    Compiler.reset();
    this.starMass = 1.0;
    this.hopperMass = 2.5;

    // Instantiate single character in place
    this.player = new Player(this.startX, this.startY);
    this.player.charType = 'star'; // default start active character style
    this.player.jumpPower = this.currentPlanet.physics.jumpPower ?? this.player.jumpPower;

    // Set up aliases for backwards compatibility with missions and rules references
    this.star = this.player;
    this.hopper = this.player;

    // Restore preserved code tunings on a retry (set directly to avoid the
    // sound/particle side effects of swap()).
    if (saved) {
      Compiler.env = saved.env;
      Compiler.activeRules = saved.rules;
      this.hopperMass = saved.hopperMass;
      this.starMass = saved.starMass;
      if (saved.charType === 'hopper') {
        this.player.charType = 'hopper';
        this.player.w = 24;
        this.player.h = 32;
        this.player.mass = saved.hopperMass;
      }
      this.player.jumpPower = saved.jumpPower;
      this.player.rocketPower = saved.rocketPower;
    }
    
    this.enemies = [];
    this.interactiveObjects = [];
    this.spawnedBoxes = [];
    this.spawnedSprings = [];
    
    this.cameraX = 0;
    this.coinsCollected = 0;
    this.requiredCollectiblesTotal = 0;
    this.requiredCollectiblesCollected = 0;
    this.portalLockNoticeCooldown = 0;
    // Keep global completed missions across planet switches
    Particles.clear();

    // Set variable accent colors in UI
    document.documentElement.style.setProperty('--active-neon', this.currentPlanet.color);
    
    // Load Enemies and Interactive items from tilemap
    const map = this.currentPlanet.map;
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const val = map[r][c];
        const tx = c * TILE_SIZE;
        const ty = r * TILE_SIZE;

        if (val === 3) {
          const collectible = new InteractiveObject(tx, ty, 'coin');
          collectible.requiredCollectible = true;
          collectible.gem = this.getGemConfig(index);
          collectible.mapRow = r;
          collectible.mapCol = c;
          collectible.gemGate = this.getGemGateForCollectible(index, r, c);
          this.requiredCollectiblesTotal++;
          this.interactiveObjects.push(collectible);
        } else if (val === 4) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'trampoline'));
        } else if (val === 5) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'pos_node'));
        } else if (val === 6) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'neg_node'));
        } else if (val === 7) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'portal'));
        } else if (val === 9) {
          let eType = 'bug';
          if (index === 1) eType = 'spore';
          else if (index === 2) eType = 'crusher';
          else if (index === 3) eType = 'penguin';
          else if (index === 4) eType = 'fly';
          
          this.enemies.push(new Enemy(tx, ty, eType));
        }
      }
    }

    // Set document head name
    const titleText = document.getElementById("header-planet-title");
    if (titleText) titleText.textContent = this.currentPlanet.name;
    const subText = document.getElementById("header-planet-sub");
    if (subText) subText.textContent = `// Coordinate: ${this.currentPlanet.tagline}`;

    // Start background music loop
    SFX.startBGM(index);

    // Initial console dialogue
    ui_log_output(`--- Entering orbit of ${this.currentPlanet.name} ---`, "info");
    ui_log_output(`Gravity defaults: g = ${(this.currentPlanet.physics.gravity/0.6*9.8).toFixed(1)} m/s²`, "info");
    
    // Trigger dialogue helper robot text only after the player launches a mission.
    if (this.state === 'playing') {
      this.triggerTutorialDialogue("start");
    }
    // Draw initial mission list
    updateMissionList(this);
    if (typeof updateHUD === 'function') {
      updateHUD(this);
    }

    // Start Guided tutorial check if Earth index 0 loaded
    if (this.state === 'playing' && typeof checkStartGuidedMode === 'function') {
      checkStartGuidedMode(index);
    }
  }

  triggerTutorialDialogue(trigger) {
    // On arrival, Vector delivers the story transmission (The Signal arc) if the
    // planet defines one; mid-level mechanic cues (wall/gap/poles/...) fall through
    // to the planet's tutorial beats.
    if (trigger === "start" && this.currentPlanet.story && this.currentPlanet.story.arrival) {
      showDialogue(this.currentPlanet.story.arrival, "start");
      return;
    }
    const dialogs = this.currentPlanet.tutorial;
    const item = dialogs.find(d => d.trigger === trigger);
    if (item) {
      showDialogue(item.text, trigger);
    }
  }

  // Spawns items above player (called via compiler terminal functions)
  spawnItemAbovePlayer(type) {
    const px = this.player.x;
    const py = this.player.y - 48; // Spawn 48px above helmet

    if (type === 'coin' || type === 'gem') {
      const coin = new InteractiveObject(px, py, 'coin');
      coin.requiredCollectible = false;
      coin.gem = this.getGemConfig();
      this.interactiveObjects.push(coin);
      Particles.spawnBurst(px + 10, py + 10, coin.gem.color, 8, 2, 2, 'glow');
    } else if (type === 'box') {
      const box = new InteractiveObject(px, py, 'box');
      this.spawnedBoxes.push(box);
      Particles.spawnBurst(px + 16, py + 16, '#ea580c', 10, 2.5, 3);
    } else if (type === 'spring') {
      const spring = new InteractiveObject(px, py, 'spring');
      this.spawnedSprings.push(spring);
      this.interactiveObjects.push(spring);
      Particles.spawnBurst(px + 16, py + 16, '#f87171', 8, 2, 2.5);
    }
  }

  shrinkAllEnemies() {
    for (const enemy of this.enemies) {
      enemy.scale = 0.5;
      Particles.spawnBurst(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#ef4444', 5, 2, 2, 'glow');
    }
  }

  bouncePlayer() {
    this.player.vy = -12;
    this.player.onGround = false;
  }

  checkMissions() {
    if (!this.currentPlanet || !this.currentPlanet.missions) return;

    let anyCompletedThisFrame = false;
    for (const mission of this.currentPlanet.missions) {
      if (!this.completedMissions.has(mission.id)) {
        try {
          if (mission.validate(this)) {
            this.completedMissions.add(mission.id);
            anyCompletedThisFrame = true;
            ui_log_output(`★ Mission Complete: ${mission.prompt}`, "success");
            SFX.playSuccess();
            Particles.spawnBurst(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#facc15', 15, 3, 3, 'glow');
            if (mission.fullMission && typeof unlockCoachBadge === 'function') {
              unlockCoachBadge(this, mission.fullMission);
            }
          }
        } catch (err) {
          console.error("Mission validation failed:", err);
        }
      }
    }
    if (anyCompletedThisFrame) {
      updateMissionList(this);
      if (typeof handleGuidedClearHook === 'function') handleGuidedClearHook();
      if (typeof triggerCloudSave === 'function') triggerCloudSave();
    }
  }

  getLevelObjectiveStatus() {
    const missions = this.currentPlanet && this.currentPlanet.missions ? this.currentPlanet.missions : [];
    const completedMissionCount = missions.filter(mission => this.completedMissions.has(mission.id)).length;
    const allMissionsComplete = completedMissionCount >= missions.length;
    const allCollectiblesCollected = this.requiredCollectiblesCollected >= this.requiredCollectiblesTotal;

    return {
      missionsTotal: missions.length,
      missionsComplete: completedMissionCount,
      collectiblesTotal: this.requiredCollectiblesTotal,
      collectiblesCollected: this.requiredCollectiblesCollected,
      allMissionsComplete,
      allCollectiblesCollected,
      readyForPortal: allMissionsComplete && allCollectiblesCollected
    };
  }

  canCollectGem(obj) {
    if (!obj || !obj.requiredCollectible || !obj.gemGate) return true;
    try {
      return !!obj.gemGate.validate(this);
    } catch (err) {
      console.error("Gem gate validation failed:", err);
      return false;
    }
  }

  getLockedRequiredCollectibleCount() {
    return this.interactiveObjects.filter(obj =>
      obj.type === 'coin'
      && obj.requiredCollectible
      && !obj.collected
      && !this.canCollectGem(obj)
    ).length;
  }

  showGemGateHint(obj) {
    if (!obj || !obj.gemGate) return;
    const gateId = obj.gemGate.id || "gem-gate";
    if (this.gemGateNoticeCooldown > 0 && this.lastGemGateNoticeId === gateId) return;

    const gem = obj.gem || this.getGemConfig();
    ui_log_output(`Locked ${gem.shortName} gem: ${obj.gemGate.label}.`, "error");
    SFX.playError();
    this.gemGateNoticeCooldown = 90;
    this.lastGemGateNoticeId = gateId;
    updateMissionList(this);
  }

  formatObjectiveLockMessage(status = this.getLevelObjectiveStatus()) {
    const missing = [];
    const missionsLeft = status.missionsTotal - status.missionsComplete;
    const collectiblesLeft = status.collectiblesTotal - status.collectiblesCollected;

    if (missionsLeft > 0) {
      missing.push(`${missionsLeft} task${missionsLeft === 1 ? "" : "s"}`);
    }
    if (collectiblesLeft > 0) {
      missing.push(`${collectiblesLeft} mission gem${collectiblesLeft === 1 ? "" : "s"}`);
    }

    return missing.length > 0 ? missing.join(" and ") : "final checks";
  }

  attemptPortalClear() {
    this.checkMissions();
    const status = this.getLevelObjectiveStatus();
    if (status.readyForPortal) {
      this.clearLevel();
      return;
    }

    if (this.portalLockNoticeCooldown <= 0) {
      const remaining = this.formatObjectiveLockMessage(status);
      ui_log_output(`Portal locked: complete ${remaining} before extraction.`, "error");
      SFX.playError();
      this.portalLockNoticeCooldown = 90;
      updateMissionList(this);
    }
  }

  nextPlanet() {
    this.currentPlanetIndex = (this.currentPlanetIndex + 1) % PLANETS.length;
    this.startLevel(this.currentPlanetIndex);
  }

  getNextPlanetIndex() {
    if (!PLANETS || this.currentPlanetIndex >= PLANETS.length - 1) return null;
    return this.currentPlanetIndex + 1;
  }

  beginNextPlanetNavigation() {
    const targetIndex = this.getNextPlanetIndex();
    if (targetIndex === null) {
      if (typeof switchMainMode === 'function') {
        switchMainMode('notebook');
      }
      return;
    }

    this.pendingNavigationTargetIndex = targetIndex;

    const originName = this.currentPlanet ? this.currentPlanet.name : "current planet";
    const targetName = PLANETS[targetIndex] ? PLANETS[targetIndex].name : "next planet";
    ui_log_output(`✓ Rover docked with spacecraft above ${originName}.`, "success");
    ui_log_output(`Spacecraft bridge: run the launch plan to travel to ${targetName}.`, "info");

    if (typeof switchMainMode === 'function') {
      switchMainMode('navigator');
    }
    if (window.Nav && typeof window.Nav.loadRouteToPlanet === 'function') {
      window.Nav.loadRouteToPlanet(this.currentPlanetIndex, targetIndex);
    }
  }

  completeNavigationToNextPlanet(mission) {
    if (this.pendingNavigationTargetIndex === null) return;
    if (!mission || mission.targetPlanetIndex !== this.pendingNavigationTargetIndex) return;

    const targetIndex = this.pendingNavigationTargetIndex;
    const targetName = PLANETS[targetIndex] ? PLANETS[targetIndex].name : "next planet";
    this.pendingNavigationTargetIndex = null;

    if (this.navigationReturnTimer) {
      clearTimeout(this.navigationReturnTimer);
    }

    ui_log_output(`✓ Spacecraft arrived at ${targetName}. Rover deployment ready.`, "success");

    this.navigationReturnTimer = setTimeout(() => {
      this.navigationReturnTimer = null;
      this.startLevel(targetIndex);
      if (typeof switchMainMode === 'function') {
        switchMainMode('terminal');
      }
    }, 1200);
  }

  resetLevel() {
    this.startLevel(this.currentPlanetIndex, true);
  }

  // Core Game Loop
  loop(timestamp) {
    if (this.state === 'playing' || window.navigatorModeActive) {
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }

      const frameMs = Math.min(timestamp - this.lastFrameTime, this.maxAccumulatedFrameMs);
      this.lastFrameTime = timestamp;

      if (!this.isPaused) {
        this.physicsAccumulator += frameMs;

        let steps = 0;
        while (this.physicsAccumulator >= this.fixedStepMs && steps < this.maxPhysicsSteps) {
          this.update();
          this.physicsAccumulator -= this.fixedStepMs;
          steps++;
        }

        if (steps === this.maxPhysicsSteps) {
          this.physicsAccumulator = 0;
        }
      } else {
        this.physicsAccumulator = 0;
      }

      this.draw();
    } else {
      this.lastFrameTime = timestamp;
      this.physicsAccumulator = 0;
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  update() {
    if (window.navigatorModeActive) {
      if (typeof updateNavigator === 'function') {
        updateNavigator(this);
      }
      return;
    }

    // 1. Process active conditional code triggers first
    Compiler.updateRules(this);
    if (this.portalLockNoticeCooldown > 0) {
      this.portalLockNoticeCooldown--;
    }
    if (this.gemGateNoticeCooldown > 0) {
      this.gemGateNoticeCooldown--;
    }

    // 2. Run real-time mission completion validator
    this.checkMissions();

    // 3. Update character inputs and accelerations
    this.player.update(this.keys, this.currentPlanet, this);

    // 4. Magnetic force application
    Physics.applyMagnetism(this.player, this.interactiveObjects, this.currentPlanet);

    // 5. Resolve rigid body collisions
    Physics.resolveWorldCollisions(this.player, this.currentPlanet.map, this.spawnedBoxes, this);

    // 6. Terrain hazards use separate collision from solid ground so spikes remain dangerous.
    if (Physics.getHazardCollisions(this.player, this.currentPlanet.map).length > 0) {
      this.killPlayer("contact with terrain hazard!");
      return;
    }

    // 7. Check if player fell out of bounds (dead)
    if (this.player.y > 450) {
      this.killPlayer("fell out of bounds!");
      return;
    }

    // 8. Update camera positioning (lerp horizontal viewport centering)
    const targetCamX = this.player.x - this.canvas.width / 2;
    const maxCamX = (this.currentPlanet.map[0].length * TILE_SIZE) - this.canvas.width;
    this.cameraX += (targetCamX - this.cameraX) * 0.1;
    this.cameraX = Math.max(0, Math.min(maxCamX, this.cameraX));

    // 9. Update active level entities
    for (const enemy of this.enemies) {
      enemy.update(this.currentPlanet.map, this.player);
      
      // Enemy collision check (only active character takes damage)
      if (Physics.isOverlapping(this.player, enemy)) {
        const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= enemy.y + 6);
        if (isStomp) {
          this.player.vy = -6;
          this.player.hitEnemyThisFrame = true;
          SFX.playStomp();
          Particles.spawnBurst(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#ef4444', 12, 3, 3, 'glow');
          this.enemies = this.enemies.filter(e => e !== enemy);
        } else {
          this.killPlayer("collision damage from alien life form!");
          return;
        }
      }
    }

    // 10. Update objects and check collisions
    for (const obj of this.interactiveObjects) {
      obj.update();
      if (obj.collected) continue;

      if (Physics.isOverlapping(this.player, obj)) {
        if (obj.type === 'coin') {
          if (!this.canCollectGem(obj)) {
            this.showGemGateHint(obj);
            continue;
          }
          obj.collected = true;
          this.coinsCollected++;
          if (obj.requiredCollectible) {
            this.requiredCollectiblesCollected++;
          }
          SFX.playCoin();
          const gem = obj.gem || this.getGemConfig();
          Particles.spawnBurst(obj.x + 8, obj.y + 8, gem.color, 10, 2, 2.5, 'glow');
          if (obj.requiredCollectible) {
            ui_log_output(`◆ ${gem.name} gem collected: ${this.requiredCollectiblesCollected}/${this.requiredCollectiblesTotal}`, "success");
            updateMissionList(this);
          } else {
            ui_log_output(`◆ Bonus ${gem.shortName} gem collected! Total: ${this.coinsCollected}`, "success");
          }
        } else if (obj.type === 'trampoline' || obj.type === 'spring') {
          const isTopBounce = (this.player.vy > 0.1 && this.player.y + this.player.h - this.player.vy <= obj.y + 6);
          if (isTopBounce) {
            obj.bounceTimer = 10;
            this.player.vy = -this.currentPlanet.physics.bounceForce * 1.4;
            this.player.onGround = false;
            SFX.playJump();
            Particles.spawnBurst(obj.x + 16, obj.y, '#f87171', 8, 2, 2);
          }
        } else if (obj.type === 'portal') {
          this.attemptPortalClear();
          return;
        }
      }
    }

    // 11. Update spawned box boxes (AABB block pushes)
    for (const box of this.spawnedBoxes) {
      box.update();
    }

    // 12. Update particle systems
    Particles.update();

    // 13. Redraw HUD sidebar charts & variables
    updateHUD(this);
    if (typeof updateNotebook === 'function') {
      updateNotebook(this);
    }

    // 14. Check tutorial spatial triggers
    if (this.player.x > 320 && this.player.x < 420) {
      if (this.currentPlanetIndex === 0) this.triggerTutorialDialogue("wall");
      else if (this.currentPlanetIndex === 1) this.triggerTutorialDialogue("gap");
      else if (this.currentPlanetIndex === 2) this.triggerTutorialDialogue("collapse");
    }
    if (this.player.x > 750 && this.player.x < 850) {
      if (this.currentPlanetIndex === 3) this.triggerTutorialDialogue("slippery");
      else if (this.currentPlanetIndex === 4) this.triggerTutorialDialogue("poles");
    }
  }

  killPlayer(cause) {
    this.state = 'gameover';
    SFX.playError();
    SFX.stopBGM();
    const goScr = document.getElementById("gameover-screen");
    if (goScr) goScr.classList.remove("hidden");
    ui_log_output(`⚠ Star Hopper critical damage: ${cause}`, "error");
    ui_log_output(`Initializing rescue pod... Click Retry to launch.`, "info");
  }

  clearLevel() {
    this.state = 'clear';
    SFX.playSuccess();
    SFX.stopBGM();
    const clearScr = document.getElementById("clear-screen");
    if (clearScr) clearScr.classList.remove("hidden");
    const clearTitle = document.getElementById("clear-title");
    const clearSubtitle = document.getElementById("clear-subtitle");
    const nextBtn = document.getElementById("btn-next-level");
    const nextIndex = this.getNextPlanetIndex();
    const payoff = this.currentPlanet && this.currentPlanet.story ? this.currentPlanet.story.payoff : "";
    if (nextIndex === null) {
      // Final playable world cleared: the star-map is complete, but the trail leads
      // on to the teased worlds (Asteroid Forge / Dark Matter Lab / Quantum Gate).
      if (clearTitle) clearTitle.textContent = "STAR-MAP COMPLETE! 🛰️";
      if (clearSubtitle) clearSubtitle.textContent = `${payoff ? payoff + " " : ""}Three more worlds are inbound. Open the Log to print your Scientist Certificate.`;
      if (nextBtn) nextBtn.textContent = "OPEN LOG";
    } else {
      const targetName = PLANETS[nextIndex] ? PLANETS[nextIndex].name : "next planet";
      if (clearTitle) clearTitle.textContent = "SHARD RECOVERED! 🚀";
      if (clearSubtitle) clearSubtitle.textContent = `${payoff ? payoff + " " : "Rover has returned to the spacecraft. "}Run a launch plan to reach ${targetName}.`;
      if (nextBtn) nextBtn.textContent = "RUN LAUNCH PLAN";
    }
    ui_log_output(`✓ Level cleared! Target coordinates secured.`, "success");
    ui_log_output(`Rover returning to spacecraft docking bay...`, "info");
    if (typeof updateCertificateState === 'function') updateCertificateState();
  }

  draw() {
    if (window.navigatorModeActive) {
      if (typeof drawNavigator === 'function') {
        drawNavigator(this);
      }
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Parallax Space Background
    this.drawSpaceBackground();

    // 2. Draw active platform level tilemap
    this.drawTilemap();

    // 3. Draw interactive objects
    for (const obj of this.interactiveObjects) {
      obj.draw(this.ctx, this.cameraX, this);
    }
    for (const box of this.spawnedBoxes) {
      box.draw(this.ctx, this.cameraX, this);
    }

    // 4. Draw enemies
    for (const enemy of this.enemies) {
      enemy.draw(this.ctx, this.cameraX);
    }

    // 5. Draw Player Character
    this.player.draw(this.ctx, this.cameraX, this);

    // 6. Draw glowing magnetic lines if active
    this.drawMagneticFields();

    // 7. Draw Dotted Trajectory Line
    this.drawTrajectory();

    // 8. Draw live Force Vectors directly on top of active character
    Physics.drawForceVectors(this.ctx, this.player, this.currentPlanet, this.cameraX);

    // 9. Draw Particle systems
    Particles.draw(this.ctx, this.cameraX);
  }

  drawSpaceBackground() {
    const skyAccent = ["#14532d", "#0e7490", "#7c2d12", "#4c1d95", "#831843"][this.currentPlanetIndex] || "#0f172a";
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    skyGradient.addColorStop(0, skyAccent);
    skyGradient.addColorStop(0.55, this.currentPlanet.skyColor);
    skyGradient.addColorStop(1, "#020617");
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillStyle = ["#86efac", "#67e8f9", "#fdba74", "#c4b5fd", "#f9a8d4"][this.currentPlanetIndex] || "#93c5fd";
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.canvas.width * 0.78 - (this.cameraX * 0.035 % 90),
      this.canvas.height * 0.18,
      86,
      26,
      -0.18,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    this.ctx.globalAlpha = 0.12;
    this.ctx.beginPath();
    this.ctx.ellipse(this.canvas.width * 0.2 - (this.cameraX * 0.02 % 70), this.canvas.height * 0.26, 52, 18, 0.28, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Parallax stars
    for (const star of this.bgStars) {
      let sx = (star.x - this.cameraX * star.speed) % this.canvas.width;
      if (sx < 0) sx += this.canvas.width;

      const shimmer = 0.45 + Math.abs(Math.sin(Date.now() / 900 + star.x)) * 0.55;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${shimmer.toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawTilemap() {
    const map = this.currentPlanet.map;
    const planetId = this.currentPlanetIndex;
    const palettes = [
      { top: "#5eea7f", body: "#a16207", shade: "#78350f", detail: "#bbf7d0" },
      { top: "#94a3b8", body: "#475569", shade: "#334155", detail: "#e2e8f0" },
      { top: "#fb923c", body: "#c2410c", shade: "#7c2d12", detail: "#fed7aa" },
      { top: "#a78bfa", body: "#5b21b6", shade: "#312e81", detail: "#e9d5ff" },
      { top: "#f472b6", body: "#1e293b", shade: "#0f172a", detail: "#fbcfe8" }
    ];

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const val = map[r][c];
        if (val !== 1 && val !== 2) continue; // Skip empty space and entities

        const tx = c * TILE_SIZE - this.cameraX;
        const ty = r * TILE_SIZE;

        if (tx + TILE_SIZE < 0 || tx > this.canvas.width) continue;

        this.ctx.save();

        if (val === 1) {
          const palette = palettes[planetId] || palettes[0];
          const isTop = (r > 0 && map[r - 1][c] !== 1);
          const tileGradient = this.ctx.createLinearGradient(tx, ty, tx, ty + TILE_SIZE);
          tileGradient.addColorStop(0, isTop ? palette.top : palette.body);
          tileGradient.addColorStop(1, palette.shade);
          this.ctx.fillStyle = tileGradient;
          this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

          if (isTop) {
            this.ctx.fillStyle = palette.top;
            this.ctx.fillRect(tx, ty, TILE_SIZE, 7);
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
            this.ctx.fillRect(tx, ty, TILE_SIZE, 2);
            this.ctx.fillStyle = palette.detail;
            if ((c + r) % 3 === 0) this.ctx.fillRect(tx + 5, ty + 4, 5, 2);
            if ((c + r) % 4 === 0) this.ctx.fillRect(tx + 20, ty + 3, 4, 2);
          } else {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
            if ((c * 17 + r * 11) % 5 === 0) {
              this.ctx.beginPath();
              this.ctx.arc(tx + 10, ty + 12, 2, 0, Math.PI * 2);
              this.ctx.fill();
            }
          }

          this.ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(tx + 0.5, ty + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (val === 2) {
          this.ctx.fillStyle = "#fb7185";
          this.ctx.strokeStyle = "#ffe4e6";
          this.ctx.shadowBlur = 6;
          this.ctx.shadowColor = "#fb7185";
          this.ctx.beginPath();
          this.ctx.moveTo(tx, ty + TILE_SIZE);
          this.ctx.lineTo(tx + TILE_SIZE/2, ty);
          this.ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }

        this.ctx.restore();
      }
    }
  }

  drawTrajectory() {
    const dots = Physics.calculateTrajectory(this.player, this.currentPlanet.map, this.spawnedBoxes, this.currentPlanet);
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowColor = '#4ade80';

    for (let i = 0; i < dots.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(dots[i].x - this.cameraX, dots[i].y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawMagneticFields() {
    if (this.player.charType !== 'hopper' || !this.player.magnetActive) return;

    this.ctx.save();
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([4, 4]);

    // Read active polarization setting
    let polarity = Compiler.env.magnet;
    if (!polarity) polarity = Compiler.env.magnetPole || 'north';

    const px = this.player.x + this.player.w/2 - this.cameraX;
    const py = this.player.y + this.player.h/2;

    for (const obj of this.interactiveObjects) {
      if (obj.type !== 'pos_node' && obj.type !== 'neg_node') continue;

      const ox = obj.x + obj.w/2 - this.cameraX;
      const oy = obj.y + obj.h/2;

      const dx = ox - px;
      const dy = oy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 180) {
        let attract = false;
        if (polarity === 'positive' || polarity === '+' || polarity === 'north') {
          attract = (obj.type === 'neg_node');
        } else {
          attract = (obj.type === 'pos_node');
        }

        this.ctx.strokeStyle = attract ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(px, py - this.player.h/2);
        this.ctx.quadraticCurveTo((px + ox)/2, (py + oy)/2 - 20, ox, oy);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }
}

// Global Game Engine instance
let Game;
window.addEventListener("load", () => {
  if (!document.getElementById("game-canvas")) return;
  Game = new StarHopperGame();
  window.Game = Game;
  Game.init();
});
