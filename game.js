// game.js - Star Hopper platformer game engine, loops, level loading, and draw pipelines

// Material limits on the Hopper. Each tuner starts at a "base" cap that's strong
// enough to clear that planet; collecting a planet's samples (gems) unlocks the
// "extreme" cap so kids can engineer further. (mass uses base/extreme as a FLOOR.)
const HOPPER_UPGRADES = {
  engine:      { base: 8,   extreme: 20,  planet: 0, gem: "Emerald Core", part: "engine",            cmd: "hopper.engine",       short: "ENGINE" },
  jump:        { base: 22,  extreme: 45,  planet: 1, gem: "Moon Quartz",  part: "jump springs",      cmd: "hopper.jump_power",   short: "JUMP" },
  rocket:      { base: 80,  extreme: 120, planet: 2, gem: "Amber Storm",  part: "rockets",           cmd: "hopper.rocket_power", short: "ROCKET" },
  mass:        { base: 1.0, extreme: 0.4, planet: 3, gem: "Violet Ice",   part: "lightweight alloy", cmd: "hopper.mass", isFloor: true, short: "LIGHTNESS" },
  antigravity: { base: 6,   extreme: 14,  planet: 4, gem: "Magenta Flux", part: "antigravity coil",  cmd: "antigravity",         short: "ANTIGRAV" }
};

class StarHopperGame {
  constructor() {
    this.unlockedUpgrades = new Set(); // legacy fully-unlocked limits (persists in profile)
    this.upgradeLevels = {}; // per-upgrade unlock fraction 0..1, ticks up with each gem (persisted)
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

    // Mob Survival mode
    this.survivalMode = false;
    this.mobs = [];
    this.projectiles = [];
    this.survivalScore = 0;
    this.weaponLevel = 1;
    this.raveImmuneTimer = 0;
    this.mobSpawnTimer = 0;
    this.shootCooldown = 0;
    this.survivalHitCooldown = 0;
    this._raveMilestone = 0;
    
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
    this.planetClears = {}; // per-planet clear count (persisted) — drives mastery remixes
    // Phase-2 progression state (persisted via profiles.js; default-safe for old saves).
    this.bestClearTimes = {};   // { planetIndex: fastest clear seconds }
    this.masteryCleared = {};   // { planetIndex: true } — mastery challenge beaten
    this.masteryMeters = {};    // { planetIndex: {...} } — reserved for per-world XP
    this.dailySignalClears = 0; // count of Daily Signal challenges beaten
    this.lastPlayedDate = null; // ISO 'YYYY-MM-DD' of last session (return-streak)
    this.streakCount = 0;       // consecutive-day return streak
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
      { id: "magnet", name: "Magenta Flux", shortName: "Flux", color: "#ec4899", glow: "rgba(236, 72, 153, 0.72)" },
      { id: "forge", name: "Orange Forge", shortName: "Forge", color: "#fb923c", glow: "rgba(251, 146, 60, 0.72)" }
    ];
    return gems[index] || gems[0];
  }

  // Gravity the rover actually FEELS (game-units): the planet's gravity (or a gravity=
  // override) minus the antigravity device. Antigravity counters gravity; negative
  // antigravity adds to it. Floored just above zero so you never fully float away.
  getCurrentGravity() {
    const env = (typeof Compiler !== 'undefined' && Compiler.env) ? Compiler.env : {};
    const base = (env.gravity !== null && env.gravity !== undefined)
      ? env.gravity
      : (this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.gravity : 0.6);
    const anti = env.antigravity || 0; // game-units
    return Math.max(0.02, base - anti);
  }

  // How far a tuner is unlocked, 0..1. Starts at 0 (base cap) and ticks up with each
  // gem collected on that upgrade's home planet; 1 == fully reinforced (extreme cap).
  getUpgradeLevel(key) {
    if (this.unlockedUpgrades && this.unlockedUpgrades.has(key)) return 1; // legacy full unlocks
    const lv = this.upgradeLevels ? this.upgradeLevels[key] : 0;
    return Math.max(0, Math.min(1, lv || 0));
  }

  // The active cap for a tuner. It starts at the minimal "base" that just lets you
  // clear the stage, and climbs toward "extreme" as you collect that planet's gems.
  // For mass this value is the lowest allowed (a floor that drops as you progress).
  getUpgradeCap(key) {
    const u = HOPPER_UPGRADES[key];
    if (!u) return Infinity;
    const raw = u.base + (u.extreme - u.base) * this.getUpgradeLevel(key);
    return u.isFloor ? Math.round(raw * 10) / 10 : Math.round(raw);
  }

  // Each required gem nudges its planet's signature cap up one notch and pops a small
  // green "max increased" balloon, so the reward is visible and incremental.
  applyGemUpgradeProgress(planetIndex) {
    const key = Object.keys(HOPPER_UPGRADES).find(k => HOPPER_UPGRADES[k].planet === planetIndex);
    const total = this.requiredCollectiblesTotal;
    if (!key || !total) return;
    this.upgradeLevels = this.upgradeLevels || {};
    const prevCap = this.getUpgradeCap(key);
    // Monotonic: a retry that re-collects gems never lowers a cap you already earned.
    this.upgradeLevels[key] = Math.max(this.upgradeLevels[key] || 0, this.requiredCollectiblesCollected / total);
    const newCap = this.getUpgradeCap(key);
    if (newCap !== prevCap) {
      const u = HOPPER_UPGRADES[key];
      const word = u.isFloor ? 'MIN' : 'MAX';
      // Exciting cap-up: a big green starburst balloon above the cadet + a particle
      // pop + a success chime, so every upgrade feels like a real power spike.
      if (this.player) {
        if (typeof ComicBubbles !== 'undefined') {
          ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 12,
            `⬆ ${u.short} ${word} ${newCap}!`, "jagged", "#4ade80", -0.55, { maxLife: 100, scale: 1.7 });
        }
        Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#4ade80', 18, 3.5, 3, 'glow');
        Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#bbf7d0', 10, 2.2, 2, 'glow');
      }
      if (typeof SFX !== 'undefined' && SFX.playSuccess) SFX.playSuccess();
      if (typeof ui_log_output === 'function') {
        ui_log_output(`⬆ POWER SPIKE! ${u.cmd} can now reach ${u.isFloor ? '≥' : '≤'} ${newCap}.`, "success");
      }
      if (typeof saveLocalProgress === 'function') saveLocalProgress();
    }
  }

  // Tells the cadet WHY a tuner clamped — "X can't go higher than N now, unless you …".
  // Suppressed during `when`-rule execution so a rule body can't spam it every frame.
  reportCapHit(key, requested) {
    if (!Number.isFinite(requested)) return;
    if (typeof Compiler !== 'undefined' && Compiler.suppressCapNotice) return;
    const u = HOPPER_UPGRADES[key];
    if (!u) return;
    const cap = this.getUpgradeCap(key);
    const exceeded = u.isFloor ? (requested < cap) : (requested > cap);
    if (!exceeded) return;
    const unlocked = !!(this.unlockedUpgrades && this.unlockedUpgrades.has(key));
    const planetName = (typeof PLANETS !== 'undefined' && PLANETS[u.planet]) ? PLANETS[u.planet].name : 'its home world';
    const limit = u.isFloor ? `go lower than ${cap}` : `go higher than ${cap}`;
    let msg = `⚙ ${u.cmd} can't ${limit} yet — the materials would fail.`;
    if (!unlocked) {
      const reach = u.isFloor ? `as low as ${u.extreme}` : `up to ${u.extreme}`;
      msg += ` Collect the ${u.gem} samples on ${planetName} to reinforce the ${u.part}, then you can push it ${reach}.`;
    }
    if (typeof ui_log_output === 'function') ui_log_output(msg, "info");
  }

  // Every engineering gauge, shown together so the dashboard is consistent across
  // worlds (Agility + Thrust always visible). `active` marks the current gate.
  getGauges() {
    return [
      { key: 'agility', label: 'Agility', value: this.getAgility(),       target: this.getAgilityTarget(), active: this.currentPlanetIndex === 0 },
      { key: 'thrust',  label: 'Thrust',  value: this.getJupiterThrust(), target: this.getThrustTarget(), active: this.currentPlanetIndex === 2 }
    ];
  }

  // Collecting all of a planet's samples reinforces its signature part.
  unlockUpgradeForPlanet(planetIndex) {
    const key = Object.keys(HOPPER_UPGRADES).find(k => HOPPER_UPGRADES[k].planet === planetIndex);
    if (!key) return;
    this.unlockedUpgrades = this.unlockedUpgrades || new Set();
    if (this.unlockedUpgrades.has(key)) return;
    this.unlockedUpgrades.add(key);
    const u = HOPPER_UPGRADES[key];
    const limitText = u.isFloor ? `as low as ${u.extreme}` : `up to ${u.extreme}`;
    if (typeof showDialogue === 'function') {
      showDialogue(`🔧 ${u.gem} samples collected! The engineers reinforced your ${u.part} — you can now push ${u.cmd} ${limitText}.`, "badge");
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(`🔧 Upgrade unlocked from ${u.gem} samples: ${u.cmd} ${u.isFloor ? '≥' : '≤'} ${u.extreme}.`, "success");
    }
    if (typeof saveLocalProgress === 'function') saveLocalProgress(); // persist the unlock
  }

  getActiveMass() {
    return (this.player && Number.isFinite(this.player.mass)) ? this.player.mass : 1.0;
  }

  // Engine drive force (tunable); falls back to the planet's stock value.
  getEngineForce() {
    if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.engine !== null && Compiler.env.engine !== undefined) {
      return Compiler.env.engine;
    }
    return this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.speed : 4;
  }

  // Top speed is DERIVED: stronger engine OR lighter rover => faster (F = m·a).
  // Calibrated so the mass-1.0 rover keeps its stock speed; only heavier suits feel it.
  getCurrentSpeed() {
    return this.getEngineForce() / this.getActiveMass();
  }

  // Jump force (impulse, tunable via player.jump_power); stock value falls back per planet.
  getJumpForce() {
    if (this.player && Number.isFinite(this.player.jumpPower)) return this.player.jumpPower;
    return this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.jumpPower : 10;
  }

  // Launch velocity is DERIVED: lighter rover => higher jump (impulse / mass).
  getJumpVelocity() {
    return this.getJumpForce() / this.getActiveMass();
  }

  // --- Composite mission stats: ONE forgiving score per world ---
  // Instead of passing four separate thresholds at once, kids tune any mix of
  // properties and watch a single number climb past a target line.

  // These stats describe the engineered Hopper suit, so they read 0 until Hopper
  // is active — that way the shell/HUD never shows a passing score the gate rejects.

  // Earth: faster + higher-jumping + lower-gravity = more agile.
  getAgility() {
    if (!this.player || this.player.charType !== 'hopper') return 0;
    const g = Math.max(0.05, this.getCurrentGravity());           // game-units gravity
    return (this.getCurrentSpeed() + this.getJumpVelocity()) * 0.6 / g;
  }

  // Jupiter: rocket thrust-to-weight plus drive speed = escape power. Calibrated so
  // that at a stock Hopper's weight (2.5) Thrust ≈ rocket_power, and a lighter
  // Hopper lifts the thrust-to-weight higher.
  getJupiterThrust() {
    if (!this.player || this.player.charType !== 'hopper') return 0;
    const rocket = Number.isFinite(this.player.rocketPower) ? this.player.rocketPower : 40;
    return rocket * (2.5 / this.getActiveMass()) + this.getCurrentSpeed();
  }

  // The tilemap the world is ACTUALLY built from this attempt: the Retry Remix variant
  // when one is active, else the canonical planet map. Physics, rendering, and spawning
  // must all read this one (never currentPlanet.map directly) so a remix can never
  // disagree with collisions or visuals.
  getActiveMap() {
    return (this.currentVariant && this.currentVariant.map) || (this.currentPlanet && this.currentPlanet.map);
  }

  // --- Daily Signal: one shared, date-seeded remix per real-world day. ---

  // The highest world today's signal may use: one past the furthest clear (so the
  // daily can tease the next world), Earth only until the first clear.
  getDailySignalPool() {
    const cleared = Object.keys(this.planetClears || {}).map(Number).filter((k) => (this.planetClears[k] || 0) > 0);
    const furthest = cleared.length ? Math.max(...cleared) : -1;
    return Math.max(0, Math.min(4, furthest + 1));
  }

  getDailySignal() {
    if (typeof getDailySignal !== 'function' || typeof PLANETS === 'undefined') return null;
    const dateStr = this.getTodayDateStr();
    return getDailySignal(PLANETS, dateStr, this.getDailySignalPool());
  }

  startDailySignal() {
    const daily = this.getDailySignal();
    if (!daily) return;
    this.dailyInfo = daily;
    this._pendingAttemptOverride = daily.attempt; // consumed by loadPlanet
    this.startLevel(daily.planetIndex);
    if (typeof ui_log_output === 'function') {
      ui_log_output(`📡 Daily Signal accepted — beat it and share your code: ${daily.shareCode}`, "success");
    }
  }

  // Keep the start screen's signal strip current (called at init and after clears).
  refreshDailySignalBanner() {
    const label = document.getElementById('daily-signal-label');
    if (!label) return;
    const daily = this.getDailySignal();
    if (!daily) return;
    label.textContent = `📡 Daily Signal ${daily.dateStr} — ${daily.label}`;
  }

  // Single source of "today" in the browser's LOCAL calendar, not UTC. That matters in
  // US evening hours, where toISOString() has already rolled into tomorrow.
  getTodayDateStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Gentle return-streak: +1 on a new consecutive calendar day, hold on the same day, and
  // SILENTLY reset to 1 after a gap (never shame a kid for taking a break).
  computeStreakIncrement() {
    const today = this.getTodayDateStr();
    if (!this.lastPlayedDate) return 1;
    if (this.lastPlayedDate === today) return this.streakCount || 1;
    const dayMs = 86400000;
    const diff = Math.round((Date.parse(today) - Date.parse(this.lastPlayedDate)) / dayMs);
    if (diff === 1) return (this.streakCount || 0) + 1;
    return 1; // gap of 2+ days (or clock moved back) — reset, no penalty
  }

  // Roll the streak forward once per real-world day, then persist.
  updateReturnStreak() {
    const today = this.getTodayDateStr();
    if (this.lastPlayedDate === today) return;
    this.streakCount = this.computeStreakIncrement();
    this.lastPlayedDate = today;
    if (typeof saveLocalProgress === 'function') saveLocalProgress();
  }

  // Show the celebratory streak chip on the start screen (hidden until there's a streak).
  refreshStreakBanner() {
    const banner = document.getElementById('return-streak-banner');
    if (!banner) return;
    const countEl = document.getElementById('return-streak-count');
    if (this.streakCount > 0) {
      if (countEl) countEl.textContent = this.streakCount;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  // Animate a planet node from locked → available on the start-screen galaxy map.
  unlockNextPlanetNode(targetIndex) {
    if (targetIndex == null) return;
    const nodeBtn = document.querySelector(".planet-node[data-level='" + targetIndex + "']");
    if (!nodeBtn || !nodeBtn.classList.contains('locked')) return;
    nodeBtn.classList.remove('locked');
    nodeBtn.classList.add('unlocking');
    nodeBtn.disabled = false;
    const meta = nodeBtn.querySelector('.mission-meta');
    if (meta && meta.textContent === 'Locked') meta.textContent = 'Unlocked!';
    setTimeout(() => { nodeBtn.classList.remove('unlocking'); }, 900);
  }

  // Numeric goals — a Retry Remix can retune these via currentVariant.targetOverrides,
  // so everything (gauge, HUD, gem gate, gate label) reads ONE source and stays consistent.
  getAgilityTarget() {
    const o = this.currentVariant && this.currentVariant.targetOverrides;
    return (o && Number.isFinite(o.agility)) ? o.agility : 30;
  }
  getThrustTarget() {
    const o = this.currentVariant && this.currentVariant.targetOverrides;
    return (o && Number.isFinite(o.thrust)) ? o.thrust : 45;
  }

  // The composite stat + target for the current world (null if it has no stat gate).
  getMissionStat() {
    if (this.currentPlanetIndex === 0) return { key: 'agility', label: 'Agility', value: this.getAgility(), target: this.getAgilityTarget() };
    if (this.currentPlanetIndex === 2) return { key: 'thrust', label: 'Thrust', value: this.getJupiterThrust(), target: this.getThrustTarget() };
    return null;
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
    return !!(this.player && this.player.charType === 'hopper' && this.getAgility() >= this.getAgilityTarget());
  }

  isJupiterHopperEngineered() {
    return !!(this.player && this.player.charType === 'hopper' && this.getJupiterThrust() >= this.getThrustTarget());
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
    // --- Retry Remix constraint gates: same concept, a new rule on HOW to clear it.
    const c = this.currentVariant && this.currentVariant.constraint;

    // Earth, "no antigravity": ALL gems use the Agility gate (so the otherwise
    // antigravity-only low gems stay solvable) and antigravity must stay off.
    if (c && c.id === "earth-no-antigravity" && planetIndex === 0) {
      const at = this.getAgilityTarget();
      return {
        id: "earth-no-antigravity-gems",
        label: `reach Agility ${at}+ using ONLY hopper.mass, hopper.engine and hopper.jump_power — NO antigravity this run`,
        short: `AGILITY ${at}+ · NO ANTIGRAV!`,
        validate: (game) => game.isEarthHopperEngineered() && !(typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.antigravity)
      };
    }
    // Moon, "loop budget": every gem now needs jump 18+ AND a repeat loop of N springs
    // (interleaves arithmetic with loops). Applied to all gems so the constraint always
    // bites, regardless of which rows this planet's gems happen to occupy.
    if (c && c.id === "moon-spring-budget" && planetIndex === 1) {
      const n = c.springCount;
      return {
        id: "moon-spring-budget-gems",
        label: `boost jump_power to 18+ and use a repeat loop to spawn ${n} springs`,
        short: `JUMP 18+ & ${n} SPRINGS!`,
        validate: (game) => game.player && game.player.jumpPower >= 18 && game.spawnedSprings.length >= n
      };
    }
    // Glacies, "event-only": every gem requires the when player.touching('ice') rule.
    if (c && c.id === "glacies-event-only" && planetIndex === 3) {
      return {
        id: "glacies-event-only-gems",
        label: "add a when player.touching('ice') rule to recover grip — an event rule is required this run",
        short: "USE A when touching('ice') RULE!",
        validate: (game) => game.hasIceTouchRule()
      };
    }

    if (planetIndex === 0) {
      if (row >= 6) {
        return {
          id: "earth-gravity-gems",
          label: "lower the gravity force on Hopper to about 5.7 m/s² or below using antigravity (e.g. antigravity = 4.1)",
          short: "PUSH BACK GRAVITY!",
          validate: (game) => game.getCurrentGravity() <= 0.35 || game.isEarthHopperEngineered()
        };
      }
      const at = this.getAgilityTarget();
      return {
        id: "earth-hopper-engineering-gems",
        label: `engineer Hopper to Agility ${at}+ — lower hopper.mass, add antigravity, and/or raise hopper.engine and hopper.jump_power (any mix that pushes Agility over ${at})`,
        short: `GET AGILITY ${at}+!`,
        validate: (game) => game.isEarthHopperEngineered()
      };
    }

    if (planetIndex === 1) {
      if (row >= 5) {
        return {
          id: "moon-arithmetic-gems",
          label: "boost jump_power to 18 or more with arithmetic",
          short: "JUMP 18+ WITH MATH!",
          validate: (game) => game.player && game.player.jumpPower >= 18
        };
      }
      return {
        id: "moon-loop-spring-gems",
        label: "boost jump_power to 18 and spawn 3 springs with a repeat loop",
        short: "JUMP 18+ & 3 SPRINGS!",
        validate: (game) => game.player && game.player.jumpPower >= 18 && game.spawnedSprings.length >= 3
      };
    }

    if (planetIndex === 2) {
      const tt = this.getThrustTarget();
      return {
        id: "jupiter-thrust-gems",
        label: `engineer Hopper to Thrust ${tt}+ (raise hopper.rocket_power or hopper.engine, lower hopper.mass)`,
        short: `GET THRUST ${tt}+!`,
        validate: (game) => game.isJupiterHopperEngineered()
      };
    }

    if (planetIndex === 3) {
      if (row >= 5) {
        return {
          id: "glacies-friction-gems",
          label: "raise friction to 5 or enable Hopper spikes",
          short: "FRICTION 5+ OR SPIKES!",
          validate: (game) => game.getCurrentFriction() >= 5 || (game.player && game.player.spikes)
        };
      }
      return {
        id: "glacies-ice-rule-gems",
        label: "raise friction or spikes, then add a when player.touching('ice') rule",
        short: "GRIP + ICE RULE!",
        validate: (game) => (game.getCurrentFriction() >= 5 || (game.player && game.player.spikes)) && game.hasIceTouchRule()
      };
    }

    if (planetIndex === 4) {
      return {
        id: "magnet-event-gems",
        label: "combine a hopper.rocket_on rule with a player.touching rule",
        short: "ROCKET + TOUCH RULE!",
        validate: (game) => game.hasRocketEventRule() && game.hasPlayerTouchingRule()
      };
    }

    if (planetIndex === 5) {
      return {
        id: "asteroid-momentum-gems",
        label: "set elasticity to 1.0 (elasticity = 1.0) and make Hopper heavy (hopper.mass = 4.0) to bounce and push boulders",
        short: "ELASTICITY 1.0 & MASS 4.0",
        validate: (game) => (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.elasticity >= 0.9) && game.player.mass >= 3.5
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
    this.refreshDailySignalBanner();
    setupUIBindings(this);
    
    // Begin Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupControls() {
    // Capture keyboard buttons
    window.addEventListener("keydown", (e) => {
      // Shift+C toggles focus between the code shell and the game. Mac/Windows safe
      // (no system clash) and we ignore Ctrl/Cmd/Alt so it never hits Ctrl+Shift+C.
      if (e.shiftKey && (e.key === "C" || e.key === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const consoleInput = document.getElementById("console-input");
        if (document.activeElement === consoleInput) {
          if (consoleInput) consoleInput.blur();   // hand control back to the game
        } else if (consoleInput) {
          consoleInput.focus();                     // jump into the shell to type code
        }
        return;
      }

      // Prevent scrolling on Space and Arrow keys when focused on game
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        if (document.activeElement.id !== "console-input") {
          e.preventDefault();
        }
      }

      if (document.activeElement.id === "console-input") return; // skip gameplay inputs if typing code

      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.key] = true; // raw code support

      // No manual character swap: each planet starts you in the right suit (see
      // loadPlanet). Shift+C (above) jumps between the game and the code shell.
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
    this.clearAction = null;
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

    // Retry Remix: the FIRST exposure to a world is the canonical, hand-built layout;
    // each same-level retry (preserveTunings) bumps the attempt so the world is
    // procedurally re-spun — same lesson, new instance. Deterministic per (planet, attempt).
    // Two more ways into a remix:
    //   • MASTERY: a fresh visit to a world you've already cleared starts remixed (the
    //     clear count picks the flavor), so replays are a new angle, never a rerun.
    //   • DAILY SIGNAL: an explicit attempt override seeded from today's date.
    this.planetAttempts = this.planetAttempts || {};
    if (preserveTunings) {
      this.planetAttempts[index] = (this.planetAttempts[index] || 0) + 1;
      this.remixContext = 'retry';
    } else if (this._pendingAttemptOverride != null) {
      this.planetAttempts[index] = this._pendingAttemptOverride;
      this._pendingAttemptOverride = null;
      this.remixContext = 'daily';
    } else {
      const clears = (this.planetClears && this.planetClears[index]) || 0;
      this.planetAttempts[index] = clears > 0 ? clears : 0;
      this.remixContext = clears > 0 ? 'mastery' : 'first';
    }
    this.retryAttempt = this.planetAttempts[index];
    this.currentVariant = (typeof buildPlanetVariant === 'function')
      ? buildPlanetVariant(this.currentPlanet, index, this.retryAttempt)
      : { map: this.currentPlanet.map, variantLabel: 'standard', targetOverrides: {}, isRemix: false };

    this._brakeHintShown = false; // re-arm the Glacies "raise friction to brake" hint per level
    this.coachSlot = null; // restart the Mission Coach one-tweak-at-a-time walkthrough
    this.missionBalloon = null;   // clear any on-canvas mission balloon
    this.shownGemGateIds = new Set(); // re-arm gem-gate hints (bash + balloon) per level
    this.mobs = []; this.projectiles = []; this.mobSpawnTimer = 50; // fresh critters per planet

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

    // Instantiate the character this world calls for — no manual swap; each planet
    // starts you in the right suit for its lesson.
    this.player = new Player(this.startX, this.startY);
    const defaultChar = this.currentPlanet.defaultChar || 'star';
    this.player.charType = defaultChar;
    if (defaultChar === 'hopper') {
      this.player.w = 24;
      this.player.h = 32;
      this.player.mass = this.hopperMass;
    } else {
      this.player.mass = this.starMass;
    }
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
    this.shownGemGateIds = new Set();   // reset once-per-level gem-gate hints
    this._lastGemLogKey = null;         // reset shell gem-status de-duplication
    this._lastPortalLockMsg = null;     // reset portal-lock message de-duplication
    // Keep global completed missions across planet switches
    Particles.clear();
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.clear();
    }

    // Set variable accent colors in UI
    document.documentElement.style.setProperty('--active-neon', this.currentPlanet.color);
    
    // Load Enemies and Interactive items from tilemap (Retry Remix variant of it).
    const map = this.currentVariant.map;
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
        } else if (val === 8) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'boulder'));
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
      // Retro arcade arrival shout as a comic bubble (one onomatopoeia system).
      if (this.player && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 4, SPEECH.pick("arrive"), "rounded", "#a7f3d0", -0.5, { maxLife: 80, scale: 1.2 });
      }
    }

    // Remix banner: on a re-spun attempt, tell the cadet what changed — in the shell
    // and the Mission-box briefing (full detail), plus a transient comic pop — but
    // WITHOUT clobbering the arrival speech balloon. The wording follows how you got
    // here: a retry, a mastery replay, or today's Daily Signal.
    if (this.state === 'playing' && this.currentVariant && this.currentVariant.isRemix) {
      const rlabel = this.currentVariant.variantLabel;
      let headline, pop;
      if (this.remixContext === 'daily' && this.dailyInfo) {
        headline = `📡 Daily Signal ${this.dailyInfo.dateStr}: ${rlabel} · share code ${this.dailyInfo.shareCode}`;
        pop = "📡 SIGNAL!";
      } else if (this.remixContext === 'mastery') {
        headline = `🏆 Mastery Remix (clear ${(this.planetClears && this.planetClears[index]) || 1}): you beat this world — new angle: ${rlabel}`;
        pop = "🏆 NEW ANGLE!";
      } else {
        headline = `🌀 Retry Remix #${this.retryAttempt}: ${rlabel}`;
        pop = "🌀 REMIX!";
      }
      if (typeof ui_log_output === 'function') ui_log_output(headline, "info");
      if (typeof logMissionBriefing === 'function') logMissionBriefing(headline);
      if (this.player && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 22, pop, "rounded", "#c4b5fd", -0.6, { maxLife: 95, scale: 1.25 });
      }
    }
    // Draw initial mission list
    updateMissionList(this);
    if (typeof updateHUD === 'function') {
      updateHUD(this);
    }

    // Rebake the pre-rendered layers for this layout NOW (terrain/sky/vignette),
    // so the first frame never pays the build cost mid-play.
    if (typeof RenderCache !== 'undefined') {
      RenderCache.invalidate();
      RenderCache.tileLayer(this);
      RenderCache.sky(this);
      RenderCache.vignette(this);
    }

    // Open a fresh row in the Science Notebook's experiment table (and reset the
    // per-attempt telemetry maxima) — but only for real attempts, not the menu preload.
    if (this.state === 'playing' && typeof attemptLogStart === 'function') {
      attemptLogStart(this);
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

  // A loop like `repeat 3: spawn_spring()` runs in ONE frame, so every call spawns at the
  // same spot — without spreading, 3 springs pile onto one pixel and look/work like ONE.
  // This fans same-spot spawns into a small row centered on the player so each is usable.
  spawnStackOffset(list, px, py, step = 36) {
    let near = 0;
    for (const o of list) {
      if (o && !o.collected && Math.abs(o.x - px) < 160 && Math.abs(o.y - py) < 48) near++;
    }
    const facing = (this.player && this.player.facing) ? this.player.facing : 1;
    return facing * near * step;
  }

  // Spawns items (called via compiler terminal functions, with optional position parameters)
  spawnItemAbovePlayer(type, x, y, options) {
    let px = this.player.x;
    let py = this.player.y - 48; // Spawn 48px above helmet
    let useCoords = false;
    if (typeof x === 'number' && typeof y === 'number') {
      px = x;
      py = y;
      useCoords = true;
    }

    const opt = options || {};
    const step = (opt.offset !== undefined) ? Number(opt.offset) : 36;

    if (type === 'coin' || type === 'gem') {
      const ox = useCoords ? 0 : this.spawnStackOffset(this.interactiveObjects.filter(o => o.type === 'coin'), px, py, step);
      const coin = new InteractiveObject(px + ox, py, 'coin');
      coin.requiredCollectible = false;
      coin.gem = this.getGemConfig();
      this.interactiveObjects.push(coin);
      Particles.spawnBurst(px + ox + 10, py + 10, coin.gem.color, 8, 2, 2, 'glow');
    } else if (type === 'box') {
      const ox = useCoords ? 0 : this.spawnStackOffset(this.spawnedBoxes, px, py, step);
      const box = new InteractiveObject(px + ox, py, 'box');
      this.spawnedBoxes.push(box);
      Particles.spawnBurst(px + ox + 16, py + 16, '#ea580c', 10, 2.5, 3);
    } else if (type === 'spring') {
      const ox = useCoords ? 0 : this.spawnStackOffset(this.spawnedSprings, px, py, step);
      const spring = new InteractiveObject(px + ox, py, 'spring');
      this.spawnedSprings.push(spring);
      this.interactiveObjects.push(spring);
      Particles.spawnBurst(px + ox + 16, py + 16, '#f87171', 8, 2, 2.5);
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

  // The gem gate of the first still-locked required gem (for accurate hints).
  getFirstLockedGemGate() {
    const obj = this.interactiveObjects.find(o =>
      o.type === 'coin' && o.requiredCollectible && !o.collected && !this.canCollectGem(o)
    );
    return obj && obj.gemGate ? obj.gemGate : null;
  }

  // Fired on EVERY bump of a still-locked gem (not just the first): a red pulse + wobble
  // on the gem and a throttled buzz, so the stat-gate requirement is felt at the moment
  // of contact. The one-time detailed text still comes from showGemGateHint.
  rejectLockedGem(obj) {
    if (obj) obj.rejectPulse = 1;
    if (this.gemGateNoticeCooldown <= 0) {
      if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
      if (obj && typeof Particles !== 'undefined') {
        Particles.spawnBurst(obj.x + obj.w / 2, obj.y + obj.h / 2, '#ef4444', 8, 1.8, 2, 'glow');
      }
      if (obj && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(obj.x + obj.w / 2, obj.y - 2, "LOCKED!", "jagged", "#fca5a5", -0.5, { maxLife: 40, scale: 1.0 });
      }
      this.gemGateNoticeCooldown = 45; // ~0.75s between buzzes so it never machine-guns
    }
    this.showGemGateHint(obj);
  }

  showGemGateHint(obj) {
    if (!obj || !obj.gemGate) return;
    const gateId = obj.gemGate.id || "gem-gate";
    // Show each gate's requirement only once per level load — one time is enough.
    this.shownGemGateIds = this.shownGemGateIds || new Set();
    if (this.shownGemGateIds.has(gateId)) return;
    this.shownGemGateIds.add(gateId);

    const gem = obj.gem || this.getGemConfig();
    ui_log_output(`Locked ${gem.shortName} gem: ${obj.gemGate.label}.`, "error");
    // Brief version as an on-canvas mission balloon (hopper-balloon style, gold).
    this.showMissionBalloon(`🔒 ${obj.gemGate.short || obj.gemGate.label}`);
    SFX.playError();
    updateMissionList(this);
  }

  // A mission/objective speech balloon drawn on the canvas — same retro window as
  // the Hopper's, but gold and a touch bigger, with word wrap for short phrases.
  showMissionBalloon(text, opts) {
    opts = opts || {};
    this.missionBalloon = {
      text: text,
      timer: opts.timer || 230,    // ~3.8s at 60fps
      color: opts.color || '#facc15',
      reveal: 0,
      prevLen: 0
    };
  }

  drawMissionBalloon(ctx) {
    const mb = this.missionBalloon;
    if (!mb || mb.timer <= 0 || !mb.text) return;
    mb.timer--;
    mb.reveal = Math.min(mb.text.length, (mb.reveal || 0) + 0.7);
    const shownCount = Math.ceil(mb.reveal);
    if (shownCount > (mb.prevLen || 0) && typeof SFX !== 'undefined' && SFX.playType && Math.random() < 0.5) SFX.playType();
    mb.prevLen = shownCount;
    const shown = mb.text.slice(0, shownCount);

    const W = this.canvas ? this.canvas.width : 720;
    ctx.save();
    ctx.font = "10px 'Press Start 2P', monospace";
    // Word-wrap the FULL text to a max width so the box size is steady while typing.
    const maxW = Math.min(360, W - 40);
    const words = mb.text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW - 24 && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const lineH = 16;
    const boxW = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24);
    const boxH = lines.length * lineH + 14;
    const cx = W / 2;
    const bx = cx - boxW / 2;
    const by = 64; // sit below the top control ribbon, inside the play area

    // Outer ink frame → gold edge → cream panel (retro window, gold accent).
    ctx.fillStyle = '#0b1022';
    ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, boxW + 6, boxH + 6, 7); ctx.fill();
    ctx.fillStyle = mb.color;
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, boxW + 2, boxH + 2, 6); ctx.fill();
    ctx.fillStyle = '#fbf3da';
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 5); ctx.fill();

    // Text (reveal across the wrapped lines), ink on cream.
    ctx.fillStyle = '#15233e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let used = 0;
    for (let i = 0; i < lines.length; i++) {
      const full = lines[i];
      const remain = Math.max(0, shown.length - used);
      const part = full.slice(0, remain);
      used += full.length + 1; // + the space
      ctx.fillText(part, cx, by + 9 + i * lineH + lineH / 2 - 4);
    }
    ctx.restore();
  }

  formatObjectiveLockMessage(status = this.getLevelObjectiveStatus()) {
    const parts = [];
    if (status.missionsComplete < status.missionsTotal) {
      // Name the actual remaining task so it's never an opaque "1 task".
      const missions = this.currentPlanet && this.currentPlanet.missions ? this.currentPlanet.missions : [];
      const next = missions.find(m => !this.completedMissions.has(m.id));
      parts.push(next && next.prompt ? `finish the task — ${next.prompt}` : "finish the mission task");
    }
    const gemsLeft = status.collectiblesTotal - status.collectiblesCollected;
    if (gemsLeft > 0) parts.push(`collect ${gemsLeft} more mission gem${gemsLeft === 1 ? "" : "s"}`);
    return parts.length > 0 ? parts.join("; and ") : "complete the final checks";
  }

  attemptPortalClear() {
    this.checkMissions();
    const status = this.getLevelObjectiveStatus();
    if (status.readyForPortal) {
      this.clearLevel();
      return;
    }

    // Only announce the lock when its message changes — no spammy repeats.
    const msg = `Portal locked: ${this.formatObjectiveLockMessage(status)}.`;
    if (this._lastPortalLockMsg !== msg) {
      this._lastPortalLockMsg = msg;
      ui_log_output(msg, "error");
      SFX.playError();
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
    if (this.clearAction === 'log') {
      if (typeof switchMainMode === 'function') {
        switchMainMode('notebook');
      }
      return;
    }

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

    // Cruise the destination orbit for a beat, then call the landing before deploying.
    this.navigationReturnTimer = setTimeout(() => {
      if (window.Nav && window.Nav.ship && typeof SPEECH !== 'undefined') {
        window.Nav.ship.sayText = SPEECH.pick("navLanding");
        window.Nav.ship.sayTimer = 150;
      }
      ui_log_output(`📡 Closing on ${targetName} — prepare for landing!`, "info");
      this.navigationReturnTimer = setTimeout(() => {
        this.navigationReturnTimer = null;
        if (window.Nav) window.Nav.cruising = false; // stop coasting; touchdown
        this.startLevel(targetIndex);
        if (typeof switchMainMode === 'function') {
          switchMainMode('terminal');
        }
      }, 2000);
    }, 2400);
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
      // Paint the animated space backdrop behind the start menu so the FIRST frame a
      // new cadet sees is the dark, twinkling starfield — not a blank canvas. No game
      // logic (update) runs in the start state; this is draw-only. (Fixes the
      // blank-canvas-on-boot bug: the loop previously skipped draw() until 'playing'.)
      if (this.state === 'start' && this.ctx) {
        this.draw();
      }
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

    // 5. Resolve rigid body collisions (capture pre-collision fall to detect a hard landing)
    const _preFallVy = this.player.vy;
    const _wasAirborne = !this.player.onGround;
    Physics.resolveWorldCollisions(this.player, this.getActiveMap(), this.spawnedBoxes, this);
    if (_wasAirborne && this.player.onGround) {
      // Soft "tick" on any real landing closes the jump loop; the bigger dust + bubble
      // only fire on a hard landing so light hops stay subtle.
      if (_preFallVy > 1.2 && typeof SFX !== 'undefined' && SFX.playLanding) SFX.playLanding();
      if (_preFallVy > 4 && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y + this.player.h, SPEECH.pick("land"), "rounded", "#d6d3d1", -0.3, { maxLife: 34, scale: 0.8 });
        Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h, '#cbd5e1', 6, 1.4, 2);
      }
    }

    // 6. Terrain hazards use separate collision from solid ground so spikes remain dangerous.
    if (Physics.getHazardCollisions(this.player, this.getActiveMap()).length > 0) {
      this.killPlayer("contact with terrain hazard!", "hazard");
      return;
    }

    // 7. Check if player fell out of bounds (dead)
    if (this.player.y > 450) {
      this.killPlayer("fell out of bounds!", "fall");
      return;
    }

    // 8. Update camera positioning (lerp horizontal viewport centering)
    const targetCamX = this.player.x - this.canvas.width / 2;
    const maxCamX = (this.getActiveMap()[0].length * TILE_SIZE) - this.canvas.width;
    this.cameraX += (targetCamX - this.cameraX) * 0.1;
    this.cameraX = Math.max(0, Math.min(maxCamX, this.cameraX));

    // 9. Update active level entities
    for (const enemy of this.enemies) {
      enemy.update(this.getActiveMap(), this.player);
      
      // Enemy collision check (only active character takes damage)
      if (Physics.isOverlapping(this.player, enemy)) {
        const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= enemy.y + 6);
        if (isStomp) {
          this.player.vy = -6;
          this.player.hitEnemyThisFrame = true;
          SFX.playStomp();
          if (typeof ComicBubbles !== 'undefined') {
            ComicBubbles.pop(enemy.x + enemy.w/2, enemy.y - 4, SPEECH.pick("stomp"), "#fb7185", 1.2);
          }
          Particles.spawnBurst(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#ef4444', 12, 3, 3, 'glow');
          this.enemies = this.enemies.filter(e => e !== enemy);
        } else {
          if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.enemyFriendly) {
            this.player.vy = -5;
            this.player.vx = (this.player.x < enemy.x ? -3 : 3);
            SFX.playJump();
            if (typeof ComicBubbles !== 'undefined') {
              ComicBubbles.spawn(enemy.x + enemy.w/2, enemy.y, "HELLO!", "rounded", "#4ade80");
            }
          } else {
            this.killPlayer("collision damage from alien life form!", "enemy");
            return;
          }
        }
      }
    }

    // 10. Update objects and check collisions
    for (const obj of this.interactiveObjects) {
      obj.update(this);
      if (obj.collected) continue;

      if (Physics.isOverlapping(this.player, obj)) {
        if (obj.type === 'coin') {
          if (!this.canCollectGem(obj)) {
            this.rejectLockedGem(obj);
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
          const collectedAllSamples = obj.requiredCollectible && this.requiredCollectiblesTotal > 0 &&
            this.requiredCollectiblesCollected >= this.requiredCollectiblesTotal;
          if (typeof ComicBubbles !== 'undefined') {
            if (collectedAllSamples) {
              // Milestone: every sample on the world collected — biggest comic pop.
              ComicBubbles.pop(obj.x + 8, obj.y - 4, SPEECH.pick("powerup"), "#4ade80", 1.35);
            } else if (obj.requiredCollectible) {
              // Mission gem — a satisfying impact pop (these are limited per world).
              ComicBubbles.pop(obj.x + 8, obj.y - 4, SPEECH.pick("get"), "#facc15", 1.1);
            } else {
              // Bonus gems are frequent — keep them as the lighter small balloon.
              ComicBubbles.spawn(obj.x + 8, obj.y, SPEECH.pick("get"), "rounded", "#facc15");
            }
          }
          if (obj.requiredCollectible) {
            ui_log_output(`◆ ${gem.name} gem collected: ${this.requiredCollectiblesCollected}/${this.requiredCollectiblesTotal}`, "success");
            updateMissionList(this);
            // Each gem nudges this planet's cap up one notch (green balloon).
            this.applyGemUpgradeProgress(this.currentPlanetIndex);
            // Collecting ALL of a planet's samples fully reinforces the part (extreme cap).
            if (this.requiredCollectiblesTotal > 0 && this.requiredCollectiblesCollected >= this.requiredCollectiblesTotal) {
              this.unlockUpgradeForPlanet(this.currentPlanetIndex);
            }
          } else {
            ui_log_output(`◆ Bonus ${gem.shortName} gem collected! Total: ${this.coinsCollected}`, "success");
          }
        } else if (obj.type === 'boulder') {
          Physics.resolveElasticCollision(this.player, obj);
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
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.update();
    }

    // 12b. Idle banter: a quiet thought bubble after standing still a while (once per pause).
    this.updateIdleBanter();

    // 12c. Mob Survival mini-mode (mobs, projectiles, score, rewards).
    if (this.survivalMode) this.updateSurvival();

    // 13. Redraw HUD sidebar charts & variables
    updateHUD(this);
    if (typeof updateNotebook === 'function') {
      updateNotebook(this);
    }

    // 14. Check tutorial spatial triggers
    if (this.player.x > 320 && this.player.x < 550) {
      if (this.currentPlanetIndex === 0 && this.player.x < 420) this.triggerTutorialDialogue("wall");
      else if (this.currentPlanetIndex === 1 && this.player.x < 420) this.triggerTutorialDialogue("gap");
      else if (this.currentPlanetIndex === 2 && this.player.x < 420) this.triggerTutorialDialogue("collapse");
      else if (this.currentPlanetIndex === 5) this.triggerTutorialDialogue("boulder");
    }
    if (this.player.x > 750 && this.player.x < 850) {
      if (this.currentPlanetIndex === 3) this.triggerTutorialDialogue("slippery");
      else if (this.currentPlanetIndex === 4) this.triggerTutorialDialogue("poles");
    }

    // Glacies brake hint: fires the first time the cadet is genuinely sliding fast
    // on the ice without having raised friction or enabled spikes — i.e. exactly
    // when "I can't stop!" is felt. Names the fix, then stays quiet (shown once).
    if (this.currentPlanetIndex === 3 && !this._brakeHintShown &&
        this.player.onGround && Math.abs(this.player.vx) > 2.2 &&
        Compiler.env.friction === null && !(this.hopper && this.hopper.spikes)) {
      this._brakeHintShown = true;
      showDialogue("🧊 Sliding and can't brake? The ice has almost no friction. Type friction = 8 (or hopper.spikes = 1) in Mission Coach to grip and stop.", "slippery");
    }
  }

  // ---- MOB SURVIVAL ----------------------------------------------------------
  toggleSurvival() {
    this.survivalMode = !this.survivalMode;
    this.mobs = []; this.projectiles = [];
    this.survivalScore = 0; this.weaponLevel = 1; this.raveImmuneTimer = 0; this._raveMilestone = 0;
    this.mobSpawnTimer = 50;
    const btn = document.getElementById('survival-btn');
    if (btn) btn.classList.toggle('survival-on', this.survivalMode);
    const touch = document.getElementById('touch-controls');
    if (touch) touch.classList.toggle('survival', this.survivalMode); // reveal the FIRE button
    if (this.survivalMode) {
      ui_log_output("👾 MOB SURVIVAL on! Jump on critters or press F to shoot. Score → bigger guns + a rave shield.", "success");
      if (this.player && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 4, "SURVIVE!", "jagged", "#ef4444", -0.4, { maxLife: 75, scale: 1.4 });
      }
    } else {
      ui_log_output("Mob Survival off — back to engineering.", "info");
    }
  }

  spawnMob() {
    if (!this.currentPlanet || !this.currentPlanet.map) return;
    const theme = (typeof MOB_THEMES !== 'undefined' && MOB_THEMES[this.currentPlanetIndex]) || ["👾"];
    const emoji = theme[Math.floor(Math.random() * theme.length)];
    const mapW = this.getActiveMap()[0].length * TILE_SIZE;
    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? this.cameraX - 20 : this.cameraX + this.canvas.width + 20;
    x = Math.max(0, Math.min(mapW - 30, x));
    const m = new Mob(x, 50, emoji);
    m.say(SPEECH.pick('mobChatter'));
    this.mobs.push(m);
  }

  killMob(index, cause) {
    const m = this.mobs[index];
    if (!m) return;
    this.mobs.splice(index, 1);
    this.survivalScore += (cause === 'stomp' ? 15 : cause === 'shot' ? 10 : 8);
    if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(m.x + m.w / 2, m.y - 4, SPEECH.pick('mobDeath'), "#fb7185", 1.0);
    Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#ef4444', 10, 2.5, 2.5, 'glow');
    this.checkSurvivalRewards();
  }

  checkSurvivalRewards() {
    const newWeapon = this.survivalScore >= 140 ? 3 : this.survivalScore >= 60 ? 2 : 1;
    if (newWeapon > this.weaponLevel) {
      this.weaponLevel = newWeapon;
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 6, "GUN UP!", "jagged", "#4ade80", -0.5, { maxLife: 80, scale: 1.5 });
      ui_log_output(`🔫 Weapon level ${this.weaponLevel}! ${this.weaponLevel >= 3 ? 'DOUBLE SHOT!' : 'Faster fire!'}`, "success");
    }
    const milestone = Math.floor(this.survivalScore / 100);
    if (milestone > this._raveMilestone) {
      this._raveMilestone = milestone;
      this.raveImmuneTimer = 420; // ~7s shield
      if (typeof Compiler !== 'undefined') { Compiler.env.raveMode = true; setTimeout(() => { Compiler.env.raveMode = false; }, 7000); }
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 6, "RAVE SHIELD!", "jagged", "#ec4899", -0.5, { maxLife: 95, scale: 1.6 });
      ui_log_output("🌈 RAVE SHIELD! For 7s, just touching mobs zaps them!", "success");
    }
  }

  updateSurvival() {
    if (!this.survivalMode || !this.player || !this.currentPlanet) return;
    const tilemap = this.getActiveMap();
    const mapW = tilemap[0].length * TILE_SIZE;
    if (this.raveImmuneTimer > 0) this.raveImmuneTimer--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.survivalHitCooldown > 0) this.survivalHitCooldown--;
    const flee = this.raveImmuneTimer > 0;

    // Shooting (hold F)
    if ((this.keys['f'] || this.keys['F']) && this.shootCooldown <= 0) {
      const dir = this.player.facing || 1;
      this.shootCooldown = Math.max(6, 16 - this.weaponLevel * 3);
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      this.projectiles.push(new Projectile(px, py, dir * 7));
      if (this.weaponLevel >= 3) this.projectiles.push(new Projectile(px, py - 9, dir * 7));
      if (typeof SFX !== 'undefined' && SFX.playType) SFX.playType();
      if (typeof ComicBubbles !== 'undefined' && Math.random() < 0.25) ComicBubbles.spawn(px + dir * 16, py - 6, "PEW!", "jagged", "#facc15", -0.2, { maxLife: 22, scale: 0.7 });
    }

    // Spawn cadence (ramps up with score)
    if (--this.mobSpawnTimer <= 0 && this.mobs.length < 8) {
      this.mobSpawnTimer = Math.max(45, 120 - Math.floor(this.survivalScore / 40) * 8);
      this.spawnMob();
    }

    // Projectiles vs mobs
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(tilemap);
      if (p.dead) { this.projectiles.splice(i, 1); continue; }
      for (let j = this.mobs.length - 1; j >= 0; j--) {
        const m = this.mobs[j];
        if (Math.abs(p.x - (m.x + m.w / 2)) < m.w / 2 + 5 && Math.abs(p.y - (m.y + m.h / 2)) < m.h / 2 + 6) {
          this.killMob(j, 'shot');
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Mobs vs player
    for (let j = this.mobs.length - 1; j >= 0; j--) {
      const m = this.mobs[j];
      m.update(tilemap, this.player, flee);
      if (m.y > 470 || m.x < -50 || m.x > mapW + 50) { this.mobs.splice(j, 1); continue; }
      if (Physics.isOverlapping(this.player, m)) {
        const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= m.y + 9);
        if (isStomp) { this.player.vy = -7; this.killMob(j, 'stomp'); }
        else if (this.raveImmuneTimer > 0) { this.killMob(j, 'rave'); }
        else if (this.survivalHitCooldown <= 0) {
          this.survivalHitCooldown = 70;
          this.player.vy = -5;
          this.player.vx = (this.player.x < m.x ? -4 : 4);
          this.survivalScore = Math.max(0, this.survivalScore - 5);
          if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y, SPEECH.pick('bonk'), "jagged", "#ef4444", -0.3, { maxLife: 40 });
        }
      }
    }
  }

  drawSurvival(ctx) {
    if (!this.survivalMode) return;
    for (const p of this.projectiles) p.draw(ctx, this.cameraX);
    for (const m of this.mobs) m.draw(ctx, this.cameraX);
    // Score readout, top-center (clear of the corner bubbles)
    ctx.save();
    ctx.font = "bold 13px 'Outfit', sans-serif";
    const label = `👾 ${this.survivalScore}   🔫 L${this.weaponLevel}${this.raveImmuneTimer > 0 ? '   🌈 SHIELD ' + Math.ceil(this.raveImmuneTimer / 60) + 's' : ''}`;
    const tw = ctx.measureText(label).width;
    const cx = this.canvas.width / 2;
    ctx.fillStyle = 'rgba(11,16,34,0.6)';
    ctx.beginPath(); ctx.roundRect(cx - tw / 2 - 10, 8, tw + 20, 24, 8); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, 20);
    ctx.restore();
  }

  // A quiet cloud-thought bubble after the cadet stands still for a few seconds.
  // A long cooldown plus a random, never-repeating line keeps it from going stale.
  updateIdleBanter() {
    if (!this.player) return;
    if (this.idleBanterCooldown > 0) this.idleBanterCooldown--;
    const k = this.keys || {};
    const pressing = k['a'] || k['A'] || k['d'] || k['D'] || k['ArrowLeft'] || k['arrowleft'] ||
      k['ArrowRight'] || k['arrowright'] || k[' '] || k['w'] || k['W'] || k['ArrowUp'] || k['arrowup'] ||
      k['s'] || k['S'] || k['ArrowDown'] || k['arrowdown'];
    const busy = pressing || !this.player.onGround || Math.abs(this.player.vx) > 0.12 || this.player.sayTimer > 0;
    if (busy) { this.idleTimer = 0; return; }
    this.idleTimer = (this.idleTimer || 0) + 1;
    if (this.idleTimer >= 360 && this.idleBanterCooldown <= 0 && typeof ComicBubbles !== 'undefined') {
      this.idleTimer = 0;
      this.idleBanterCooldown = 1500; // ~25s before another musing, so it never nags
      ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 2, SPEECH.pick("idle"), "cloud", "#e0f2fe", -0.25, { maxLife: 150 });
    }
  }

  killPlayer(cause, tag) {
    this.state = 'gameover';
    // Remember WHY for the lab report (diagnostics.js reads live telemetry + this).
    this.lastFailure = {
      tag: tag || 'unknown',
      cause,
      x: this.player ? this.player.x : 0,
      y: this.player ? this.player.y : 0
    };
    // Close this attempt's experiment-log row with the measured telemetry.
    if (typeof attemptLogFinish === 'function') attemptLogFinish(this, this.lastFailure.tag);
    SFX.playError();
    SFX.stopBGM();
    if (typeof ComicBubbles !== 'undefined' && this.player) {
      ComicBubbles.spawn(this.player.x + this.player.w/2, this.player.y + this.player.h/2, SPEECH.pick("kaboom"), "jagged", "#ef4444", -0.2, { maxLife: 95, scale: 1.9 });
    }
    const goScr = document.getElementById("gameover-screen");
    if (goScr) goScr.classList.remove("hidden");
    // Crash → diagnosis: fill the overlay with a specific lab report + one-tap fixes.
    const diag = (typeof renderFailureLab === 'function') ? renderFailureLab(this) : null;
    ui_log_output(`⚠ Star Hopper critical damage: ${cause}`, "error");
    if (diag) ui_log_output(`⚗️ Lab report: ${diag.title}`, "info");
    ui_log_output(`Initializing rescue pod... Click Retry to launch.`, "info");
  }

  clearLevel() {
    this.state = 'clear';
    // A cleared run is an experiment too — log it with its telemetry.
    if (typeof attemptLogFinish === 'function') attemptLogFinish(this, 'cleared');
    const isDailyRun = this.remixContext === 'daily'
      && this.dailyInfo
      && this.dailyInfo.planetIndex === this.currentPlanetIndex;

    if (isDailyRun) {
      // Daily Signal is a side challenge. It should persist its own clear count, but must
      // not mark campaign planets as cleared or unlock later worlds out of order.
      this.dailySignalClears = (this.dailySignalClears || 0) + 1;
    } else {
      // Count the campaign clear (persisted): future fresh visits to this world start
      // REMIXED (mastery), and the Daily Signal pool can grow to the next world.
      this.planetClears = this.planetClears || {};
      this.planetClears[this.currentPlanetIndex] = (this.planetClears[this.currentPlanetIndex] || 0) + 1;
    }
    if (typeof saveLocalProgress === 'function') saveLocalProgress();
    this.refreshDailySignalBanner();
    // Distinct portal fanfare (not the generic success chime) so clearing a world lands
    // as a real milestone moment.
    if (SFX.playPortalUnlock) SFX.playPortalUnlock(); else SFX.playSuccess();
    SFX.stopBGM();
    const clearScr = document.getElementById("clear-screen");
    if (clearScr) clearScr.classList.remove("hidden");
    const clearTitle = document.getElementById("clear-title");
    const clearSubtitle = document.getElementById("clear-subtitle");
    const nextBtn = document.getElementById("btn-next-level");
    const nextIndex = this.getNextPlanetIndex();
    this.clearAction = null;
    // Animate the just-unlocked planet node on the galaxy map (no-op if already open).
    if (!isDailyRun && nextIndex !== null) this.unlockNextPlanetNode(nextIndex);
    const payoff = this.currentPlanet && this.currentPlanet.story ? this.currentPlanet.story.payoff : "";
    const dailyBtn = document.getElementById("btn-clear-daily");
    if (isDailyRun) {
      const share = this.dailyInfo ? this.dailyInfo.shareCode : "today's code";
      if (clearTitle) clearTitle.textContent = "DAILY SIGNAL CLEAR! 📡";
      if (clearSubtitle) clearSubtitle.textContent = `Signal solved: ${share}. This counts toward Daily Signal practice, while campaign planet unlocks stay on the main mission path.`;
      if (nextBtn) nextBtn.textContent = "OPEN LOG";
      if (dailyBtn) dailyBtn.style.display = "none";
      this.clearAction = 'log';
    } else if (nextIndex === null) {
      // Final playable world cleared: the star-map is complete. Rather than dead-end on
      // "three worlds inbound", point the cadet at the Daily Signal — a fresh seeded
      // remix every day — so there's a real reason to come back tomorrow.
      const daily = this.getDailySignal();
      if (clearTitle) clearTitle.textContent = "STAR-MAP COMPLETE! 🛰️";
      if (clearSubtitle) clearSubtitle.textContent = `${payoff ? payoff + " " : ""}A new Daily Signal arrives every day — accept today's to keep your skills sharp while worlds 6–8 are built. Print your Scientist Certificate from the Log.`;
      if (nextBtn) nextBtn.textContent = "OPEN LOG";
      if (dailyBtn) {
        dailyBtn.style.display = daily ? "inline-flex" : "none";
        if (daily) dailyBtn.textContent = `📡 TODAY'S SIGNAL`;
      }
    } else {
      const targetName = PLANETS[nextIndex] ? PLANETS[nextIndex].name : "next planet";
      if (clearTitle) clearTitle.textContent = "SHARD RECOVERED! 🚀";
      if (clearSubtitle) clearSubtitle.textContent = `${payoff ? payoff + " " : "Rover has returned to the spacecraft. "}Run a launch plan to reach ${targetName}.`;
      if (nextBtn) nextBtn.textContent = "RUN LAUNCH PLAN";
      if (dailyBtn) dailyBtn.style.display = "none";
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

    // Start menu: paint only the parallax space backdrop behind the DOM overlay.
    // drawSpaceBackground() null-guards its cached layers and falls back to a direct
    // gradient, so this is safe even before the render cache is warm.
    if (this.state === 'start') {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawSpaceBackground();
      this.drawStartBackdrop();
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Parallax Space Background
    this.drawSpaceBackground();

    // 1b. Draw Spacetime Warping Mesh
    this.drawSpacetimeMesh();

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

    // 9b. Mob Survival: mobs, projectiles, and the score readout
    this.drawSurvival(this.ctx);

    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.draw(this.ctx, this.cameraX);
    }

    // 9c. Soft planet-tinted vignette over the world (cached; one drawImage),
    // under the screen-space balloon so UI text stays at full brightness.
    if (typeof RenderCache !== 'undefined') {
      const vig = RenderCache.vignette(this);
      if (vig) this.ctx.drawImage(vig, 0, 0);
    }

    // 10. Mission/objective speech balloon (screen-space, top-center)
    this.drawMissionBalloon(this.ctx);
  }

  drawSpaceBackground() {
    // Fast path: cached sky + two wrapped parallax starfields + a dozen live
    // twinkles — ~5 drawImage calls instead of a gradient and 80 shimmer arcs.
    if (typeof RenderCache !== 'undefined') {
      const sky = RenderCache.sky(this);
      if (sky) {
        const W = this.canvas.width, H = this.canvas.height;
        this.ctx.drawImage(sky, 0, 0);
        const layers = RenderCache.starLayers(W, H);
        if (layers) {
          const wrap = (img, speed) => {
            let off = (this.cameraX * speed) % W;
            if (off < 0) off += W;
            this.ctx.drawImage(img, -off, 0);
            this.ctx.drawImage(img, W - off, 0);
          };
          wrap(layers.far, 0.06);
          wrap(layers.near, 0.16);
        }
        const tw = RenderCache.twinkles(W, H);
        const t = Date.now() / 700;
        for (const s of tw) {
          this.ctx.globalAlpha = 0.35 + Math.abs(Math.sin(t + s.ph)) * 0.6;
          this.ctx.fillStyle = '#f8fafc';
          this.ctx.beginPath();
          this.ctx.arc(((s.x - this.cameraX * 0.1) % W + W) % W, s.y, s.s, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        return;
      }
    }
    this.drawSpaceBackgroundDirect();
  }

  // Draw spacetime warping coordinate grid mesh (general relativity grid)
  drawSpacetimeMesh() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(79, 70, 229, 0.16)'; // Deep indigo/blue neon grid lines
    ctx.lineWidth = 1.0;
    
    const gridSize = 32;
    const sources = [];
    if (this.player) {
      sources.push({
        x: this.player.x + this.player.w / 2,
        y: this.player.y + this.player.h / 2,
        mass: this.player.mass * 8.0
      });
    }
    
    for (const box of this.spawnedBoxes) {
      if (!box.collected) {
        sources.push({ x: box.x + box.w / 2, y: box.y + box.h / 2, mass: 4.0 });
      }
    }
    for (const spring of this.spawnedSprings) {
      sources.push({ x: spring.x + spring.w / 2, y: spring.y + spring.h / 2, mass: 3.0 });
    }
    
    // Boulders/asteroids in Asteroid Forge (represented by type 'boulder')
    for (const obj of this.interactiveObjects) {
      if (obj.type === 'boulder' && !obj.collected) {
        sources.push({ x: obj.x + obj.w / 2, y: obj.y + obj.h / 2, mass: (obj.mass || 2) * 6.0 });
      }
    }

    const startX = Math.floor(this.cameraX / gridSize) * gridSize - gridSize;
    const endX = startX + W + gridSize * 2;
    
    // Draw horizontal grid lines
    for (let y = 0; y <= H; y += 16) {
      ctx.beginPath();
      let first = true;
      for (let x = startX; x <= endX; x += 16) {
        let wx = x;
        let wy = y;
        
        let dxSum = 0;
        let dySum = 0;
        for (const src of sources) {
          const rx = wx - src.x;
          const ry = wy - src.y;
          const distSq = rx * rx + ry * ry;
          const dist = Math.sqrt(distSq);
          if (dist > 5 && dist < 160) {
            const pull = (src.mass * 30) / (distSq + 180);
            dxSum += (rx / dist) * pull;
            dySum += (ry / dist) * pull;
          }
        }
        
        const drawX = wx - dxSum - this.cameraX;
        const drawY = wy - dySum;
        if (first) {
          ctx.moveTo(drawX, drawY);
          first = false;
        } else {
          ctx.lineTo(drawX, drawY);
        }
      }
      ctx.stroke();
    }
    
    // Draw vertical grid lines
    for (let x = startX; x <= endX; x += 32) {
      ctx.beginPath();
      let first = true;
      for (let y = 0; y <= H; y += 16) {
        let wx = x;
        let wy = y;
        
        let dxSum = 0;
        let dySum = 0;
        for (const src of sources) {
          const rx = wx - src.x;
          const ry = wy - src.y;
          const distSq = rx * rx + ry * ry;
          const dist = Math.sqrt(distSq);
          if (dist > 5 && dist < 160) {
            const pull = (src.mass * 30) / (distSq + 180);
            dxSum += (rx / dist) * pull;
            dySum += (ry / dist) * pull;
          }
        }
        
        const drawX = wx - dxSum - this.cameraX;
        const drawY = wy - dySum;
        if (first) {
          ctx.moveTo(drawX, drawY);
          first = false;
        } else {
          ctx.lineTo(drawX, drawY);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // A calm, comic-styled planet horizon + glow drawn ONLY behind the start menu, so the
  // landing screen feels like a real place rather than an empty void. Cheap (a few arcs),
  // sits low/right of the centered menu, and uses a thick ink rim for the comic look.
  drawStartBackdrop() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const t = Date.now() / 1000;

    // Big home planet rising at the bottom-left — mostly off-screen so only its arc shows.
    const px = W * 0.22, py = H * 1.32, pr = H * 0.95;
    ctx.save();
    const planetGrad = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.5, pr * 0.1, px, py, pr);
    planetGrad.addColorStop(0, '#3b82f6');
    planetGrad.addColorStop(0.55, '#1d4ed8');
    planetGrad.addColorStop(1, '#0b1f4d');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    // Atmospheric glow rim
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
    ctx.stroke();
    // Thick comic ink rim
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1224';
    ctx.stroke();
    // A couple of continent blobs for character
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(px - pr * 0.25, py - pr * 0.62, pr * 0.22, pr * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + pr * 0.18, py - pr * 0.5, pr * 0.15, pr * 0.08, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A small moon drifting top-right, with its own ink outline.
    const mx = W * 0.84 + Math.sin(t * 0.2) * 6, my = H * 0.22, mr = 26;
    ctx.save();
    const moonGrad = ctx.createRadialGradient(mx - 8, my - 8, 4, mx, my, mr);
    moonGrad.addColorStop(0, '#e2e8f0');
    moonGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0b1224';
    ctx.stroke();
    ctx.fillStyle = 'rgba(100,116,139,0.5)';
    ctx.beginPath();
    ctx.arc(mx + 7, my - 5, 5, 0, Math.PI * 2);
    ctx.arc(mx - 6, my + 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Direct background painting — kept as the no-canvas/test fallback.
  drawSpaceBackgroundDirect() {
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
    // Fast path: the whole level is pre-rendered once per layout (see render-cache.js),
    // so a frame pays ONE drawImage instead of a gradient+stroke per visible tile.
    if (typeof RenderCache !== 'undefined') {
      const layer = RenderCache.tileLayer(this);
      if (layer) {
        this.ctx.drawImage(layer, -Math.round(this.cameraX), 0);
        return;
      }
    }
    this.drawTilemapDirect();
  }

  // Direct per-tile painting — kept as the no-canvas/test fallback.
  drawTilemapDirect() {
    const map = this.getActiveMap();
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
    const dots = Physics.calculateTrajectory(this.player, this.getActiveMap(), this.spawnedBoxes, this.currentPlanet);
    
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
