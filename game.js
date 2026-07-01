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
const MASTERY_CLEAR_RESEARCH_XP = 25;
const RETURN_STREAK_RESEARCH_BASE_XP = 4;
const RETURN_STREAK_RESEARCH_CAP_BONUS_XP = 6;
const WORLD_MASTERY_TIERS = [
  { id: "scout", xp: 50, label: "Signal Scout" },
  { id: "engineer", xp: 110, label: "World Engineer" },
  { id: "mentor", xp: 180, label: "Planet Mentor" }
];
const VILLAGE_TRUST_TIERS = [
  { id: "friend", points: 3, label: "Trading Friend" },
  { id: "ally", points: 7, label: "Cave Ally" },
  { id: "guardian", points: 12, label: "Village Guardian" }
];
const VILLAGE_TRUST_PACTS = {
  friend: {
    title: "First Trade Pact",
    action: "make one fair sample trade",
    concept: "Resource flow: samples -> tool",
    body: "Spend a local gemstone with a villager, then test how the traded tool changes the run."
  },
  ally: {
    title: "Cave Rescue Pact",
    action: "rescue a villager or make another useful trade",
    concept: "State machine: danger -> cave -> safe",
    body: "When mobs approach, villagers hide in caves; clearing the danger proves the state changed."
  },
  guardian: {
    title: "Guardian Pact",
    action: "train a pet guard or protect the village",
    concept: "AI state: scared -> pet -> guard",
    body: "Use calming lotion, pets, or rescue play to turn wild mob states into village protection."
  }
};
const DISCOVERY_COMBO_MILESTONES = [
  {
    combo: 3,
    label: "TRIPLE TEST",
    pop: "TRIPLE TEST!",
    title: "Triple-Test Chain",
    rewardXP: 6,
    masteryXP: 8,
    color: "#facc15",
    body: "Three fresh experiments in one chain proves the cadet is testing variables, not guessing."
  },
  {
    combo: 5,
    label: "FIVE TEST STREAK",
    pop: "FIVE TESTS!",
    title: "Five-Test Streak",
    rewardXP: 10,
    masteryXP: 12,
    color: "#67e8f9",
    body: "Five fresh experiments shows a real lab habit: change one thing, measure, then improve."
  }
];
const FRONTIER_RIVAL_MILESTONES = [
  {
    proofs: 3,
    label: "RIVAL LADDER",
    pop: "RIVAL LADDER!",
    title: "Frontier Rival Ladder",
    rewardXP: 7,
    masteryXP: 10,
    color: "#facc15",
    body: "Three unique class targets prove the cadet can compare fair evidence across same-seed Frontier runs."
  },
  {
    proofs: 6,
    label: "CLASS LEADER",
    pop: "CLASS LEADER!",
    title: "Class Frontier Leader",
    rewardXP: 12,
    masteryXP: 16,
    color: "#67e8f9",
    body: "Six rival proofs show a repeatable lab habit: same rules, better data, clearer explanation."
  }
];

function dateSeedFallback(value) {
  const s = String(value || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createEmptyCodeRunStats() {
  return {
    repeatLoops: 0,
    forLoops: 0,
    repeatIterations: 0,
    forIterations: 0,
    functionCalls: {},
    spawnTypes: {},
    repeatSpawnTypes: {},
    loopSpawnTypes: {}
  };
}

class StarHopperGame {
  constructor() {
    this.unlockedUpgrades = new Set(); // legacy fully-unlocked limits (persists in profile)
    this.upgradeLevels = {}; // per-upgrade unlock fraction 0..1, ticks up with each gem (persisted)
    this.gemsWallet = { emerald: 0, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
    this.purchasedTrades = new Set();
    this.unlockedTools = new Set();
    this.upgradeCapBonuses = { engine: 0, jump: 0, rocket: 0, mass: 0, antigravity: 0 };
    this.gemsAwardedForPlanet = {}; // most gems ever banked from each planet — caps replay farming
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
    this.codeRunStats = createEmptyCodeRunStats();

    // Infinite-tank toggle (accessibility/sandbox): when on, the fuel tank never runs out so
    // kids can fly and experiment freely. Persisted so it survives a reload.
    this.infiniteFuel = (typeof localStorage !== 'undefined' && localStorage.getItem('sh-infinite-fuel') === '1');

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
    this.minedBlocks = 0;
    this.drillCooldown = 0;
    this.drillHintCooldown = 0;
    
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
    this.bestLabStars = {};     // { planetIndex|daily:date: highest clear-screen lab stars }
    this.masteryCleared = {};   // { planetIndex: true } — mastery challenge beaten
    this.masteryMeters = {};    // { planetIndex: {...} } — reserved for per-world XP
    this.villageTrust = {};     // { planetIndex: { points, badges, sources } } — village relationship progress
    this.dailySignalClears = 0; // count of Daily Signal challenges beaten
    this.frontierRecords = {};  // { dateStr: best local Frontier clear record + share code }
    this.frontierBoard = {};    // { shareCode: best imported classmate Frontier record }
    this.lastPlayedDate = null; // ISO 'YYYY-MM-DD' of last session (return-streak)
    this.streakCount = 0;       // consecutive-day return streak
    this.coachPredictions = {};
    this.coachLastResults = {};
    this.lastCoachCodeByMission = {};
    this.earnedBadges = new Set();
    this.researchXP = 0;
    this.lastReturnStreakReward = null;
    this.discoveryCombo = 0;
    this.discoveryPulse = null;
    this.discoveryLog = [];
    this.discoveryPassCounts = {};
    this.discoveredFormulaKinds = new Set();
    this.formulaCardEffects = [];
    this.confirmedHypotheses = new Set();
    this._labStarPreviewCount = 0;
    this.lastLabStarPulse = null;
    this.lastSignalStoryEffect = null;
    this.lastWorldMasteryXPEffect = null;
    this.pendingNavigationTargetIndex = null;
    this.navigationReturnTimer = null;
    this.levelStartMs = 0;
    this.lastClearTimeSummary = null;

    // Fixed-step simulation keeps movement stable across 60Hz, 120Hz, and throttled tabs.
    this.lastFrameTime = 0;
    this.physicsAccumulator = 0;
    this.fixedStepMs = 1000 / 60;
    this.maxAccumulatedFrameMs = 1000 / 15;
    this.maxPhysicsSteps = 5;
    this.isPaused = false;
    this.reducedMotion = false;
    this.reducedMotionQuery = null;
    this.reducedMotionListener = null;
  }

  applyReducedMotionPreference(matches) {
    this.reducedMotion = !!matches;
    if (this.reducedMotion && typeof Compiler !== 'undefined' && Compiler.env) {
      Compiler.env.raveMode = false;
    }
    return this.reducedMotion;
  }

  setupReducedMotionPreference() {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return this.applyReducedMotionPreference(false);
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotionQuery = query;
    this.applyReducedMotionPreference(!!query.matches);
    const onChange = (event) => this.applyReducedMotionPreference(
      event && typeof event.matches === 'boolean' ? event.matches : !!query.matches
    );
    this.reducedMotionListener = onChange;
    if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    else if (typeof query.addListener === 'function') query.addListener(onChange);
    return this.reducedMotion;
  }

  getEarthDayNightPhase(nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const cycle = 64000;
    const t = ((now % cycle) / cycle);
    const daylight = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2);
    return {
      t,
      daylight,
      isDay: daylight >= 0.45,
      sunX: 0.1 + t * 0.8,
      sunY: 0.18 + Math.sin(t * Math.PI) * 0.16
    };
  }

  shouldVillagersShelterForNight(nowMs) {
    return this.currentPlanetIndex === 0 && !this.getEarthDayNightPhase(nowMs).isDay;
  }

  getVillagerThreatRadius(options = {}) {
    const baseRadius = this.survivalMode ? 192 : 152;
    return baseRadius + (options && options.waiting ? 32 : 0);
  }

  getVillagerShelterSignal(npc, options = {}) {
    const radius = Number.isFinite(options.radius) ? options.radius : this.getVillagerThreatRadius(options);
    const threat = this.findThreateningMobForNPC(npc, radius);
    if (threat) return { active: true, reason: "nearby mob", threat };
    if (this.shouldVillagersShelterForNight(options.nowMs)) {
      return { active: true, reason: "night", threat: null };
    }
    return { active: false, reason: null, threat: null };
  }

  shouldNPCWaitInCave(npc, signal = null) {
    if (!npc) return false;
    const shelter = signal || this.getVillagerShelterSignal(npc);
    if (shelter && shelter.active) return true;
    if (!npc.rescuePending) return false;
    return !!this.findThreateningMobForNPC(npc, this.getVillagerThreatRadius({ waiting: true }));
  }

  canNPCTrade(npc, signal = null) {
    if (!npc || npc.collected) return false;
    const shelter = signal || this.getVillagerShelterSignal(npc);
    if (shelter && shelter.active) return false;
    if (npc.hiddenInCave || npc.rescuePending || npc.shelterReason || (npc.panicTimer || 0) > 0) return false;
    return true;
  }

  getVillagerCaveStatus(npc, signal = null) {
    const shelter = signal || this.getVillagerShelterSignal(npc);
    if (shelter && shelter.threat) {
      return { label: "DANGER", reason: "nearby mob", color: "#facc15", fill: "rgba(250, 204, 21, 0.32)" };
    }
    if (shelter && shelter.reason === "night") {
      return { label: "NIGHT", reason: "night", color: "#93c5fd", fill: "rgba(147, 197, 253, 0.28)" };
    }
    if (npc && npc.rescuePending) {
      return { label: "WAIT", reason: npc.shelterReason || "danger", color: "#facc15", fill: "rgba(250, 204, 21, 0.26)" };
    }
    if (npc && npc.shelterReason === "night") {
      return { label: "NIGHT", reason: "night", color: "#93c5fd", fill: "rgba(147, 197, 253, 0.24)" };
    }
    return { label: "SAFE", reason: "clear", color: "#a7f3d0", fill: "rgba(167, 243, 208, 0.22)" };
  }

  getVillageRescueSourceKey(npc, index = this.currentPlanetIndex) {
    const planetKey = Number.isFinite(index) ? index : 0;
    const npcKey = npc && npc.id ? String(npc.id).replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : "villager";
    return `village-rescue:${planetKey}:${npcKey}`;
  }

  hasVillageRescueCredit(index = this.currentPlanetIndex) {
    const key = String(Number.isFinite(index) ? index : 0);
    const meter = this.normalizeWorldMasteryMeter(index);
    return Object.keys(meter.sources || {}).some(source => source.indexOf(`village-rescue:${key}:`) === 0);
  }

  normalizeVillageTrust(index = this.currentPlanetIndex) {
    const key = String(Number.isFinite(index) ? index : 0);
    this.villageTrust = this.villageTrust || {};
    const raw = this.villageTrust[key] || this.villageTrust[index] || {};
    const points = Math.max(0, Math.floor(Number(raw.points) || 0));
    const sources = raw.sources && typeof raw.sources === 'object' ? { ...raw.sources } : {};
    const badges = Array.isArray(raw.badges)
      ? raw.badges.slice()
      : VILLAGE_TRUST_TIERS.filter(tier => points >= tier.points).map(tier => tier.id);
    const normalized = { ...raw, points, sources, badges: Array.from(new Set(badges)) };
    this.villageTrust[key] = normalized;
    if (key !== String(index) && this.villageTrust[index]) delete this.villageTrust[index];
    return normalized;
  }

  getVillageTrustProgress(index = this.currentPlanetIndex) {
    const meter = this.normalizeVillageTrust(index);
    const earnedTiers = VILLAGE_TRUST_TIERS.filter(tier => meter.badges.includes(tier.id) || meter.points >= tier.points);
    const nextTier = VILLAGE_TRUST_TIERS.find(tier => meter.points < tier.points) || null;
    const currentTier = earnedTiers.length ? earnedTiers[earnedTiers.length - 1] : null;
    const finalTier = VILLAGE_TRUST_TIERS[VILLAGE_TRUST_TIERS.length - 1];
    return {
      points: meter.points,
      badges: meter.badges.slice(),
      earnedTiers,
      currentTier,
      nextTier,
      currentPact: currentTier ? this.getVillageTrustPactForTier(currentTier) : null,
      nextPact: nextTier ? this.getVillageTrustPactForTier(nextTier) : null,
      title: currentTier ? currentTier.label : "New Arrival",
      pct: finalTier ? Math.max(0, Math.min(100, Math.round((meter.points / finalTier.points) * 100))) : 0
    };
  }

  getVillageTrustPactForTier(tier) {
    const id = typeof tier === "string" ? tier : (tier && tier.id ? tier.id : "");
    const pact = VILLAGE_TRUST_PACTS[id];
    if (!pact) return null;
    return {
      ...pact,
      tierId: id,
      tierLabel: tier && tier.label ? tier.label : ""
    };
  }

  grantVillageTrust(amount, sourceKey, action = "help", options = {}) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return { added: 0, duplicate: false, progress: this.getVillageTrustProgress(options.index) };
    const index = Number.isFinite(options.index) ? options.index : this.currentPlanetIndex;
    const key = String(Number.isFinite(index) ? index : 0);
    const meter = this.normalizeVillageTrust(index);
    const source = sourceKey ? String(sourceKey) : `village-trust:${key}:${action}:${Object.keys(meter.sources || {}).length}`;
    if (meter.sources[source]) {
      return { added: 0, duplicate: true, progress: this.getVillageTrustProgress(index) };
    }

    const beforePoints = meter.points;
    meter.points += add;
    meter.sources[source] = add;
    const tierAwards = [];
    for (const tier of VILLAGE_TRUST_TIERS) {
      if (beforePoints < tier.points && meter.points >= tier.points && !meter.badges.includes(tier.id)) {
        meter.badges.push(tier.id);
        tierAwards.push(tier);
      }
    }
    this.villageTrust[key] = meter;

    const progress = this.getVillageTrustProgress(index);
    const topTier = tierAwards.length ? tierAwards[tierAwards.length - 1] : progress.currentTier;
    const label = tierAwards.length ? "TRUST UP" : `TRUST +${add}`;
    const result = {
      label,
      added: add,
      points: meter.points,
      title: progress.title,
      action,
      sourceKey: source,
      tierUp: tierAwards.length > 0,
      nextTier: progress.nextTier ? progress.nextTier.label : null,
      nextPact: progress.nextPact ? progress.nextPact.title : null,
      nextPactConcept: progress.nextPact ? progress.nextPact.concept : null
    };
    this.lastVillageTrustEffect = result;

    const fx = options.npc || this.player;
    if (fx && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const width = Number.isFinite(fx.w) ? fx.w : 28;
      const x = (Number.isFinite(fx.x) ? fx.x : 0) + width / 2;
      const y = Number.isFinite(fx.y) ? fx.y : 0;
      ComicBubbles.pop(x, y - 54, label, options.color || (fx.color || "#67e8f9"), 0.82);
      ComicBubbles.pop(x, y - 36, `${progress.title}`.toUpperCase(), "#fde68a", 0.68);
    }
    if (fx && typeof Particles !== 'undefined' && Particles.spawnBurst) {
      const width = Number.isFinite(fx.w) ? fx.w : 28;
      const height = Number.isFinite(fx.h) ? fx.h : 36;
      Particles.spawnBurst((Number.isFinite(fx.x) ? fx.x : 0) + width / 2, (Number.isFinite(fx.y) ? fx.y : 0) + height / 2, options.color || "#67e8f9", 8 + tierAwards.length * 4, 1.9, 2.0, "glow");
    }
    if (topTier && typeof ui_log_output === 'function') {
      ui_log_output(`Village trust: ${progress.title} (${meter.points} trust).`, "success");
    }
    return result;
  }

  getVillageGuardianPactSourceKey(index = this.currentPlanetIndex) {
    const planetKey = Number.isFinite(index) ? index : 0;
    return `village-pact:${planetKey}:guardian`;
  }

  grantVillageGuardianPact(pulse = null, options = {}) {
    const index = Number.isFinite(options.index) ? options.index : this.currentPlanetIndex;
    const progress = this.getVillageTrustProgress(index);
    const finalTier = VILLAGE_TRUST_TIERS[VILLAGE_TRUST_TIERS.length - 1];
    if (!finalTier || !progress || progress.points < finalTier.points) return null;
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const sourceKey = this.getVillageGuardianPactSourceKey(index);
    if (this.discoveryPassCounts[sourceKey]) return null;

    const rewardXP = 10;
    const masteryXP = 14;
    const color = options.color || "#facc15";
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, "village guardian pact", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }
    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const result = {
      label: "VILLAGE PACT",
      title: "Village Guardian Pact",
      rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      points: progress.points,
      tier: progress.title,
      sourceKey
    };

    if (pulse) {
      pulse.villagePactProof = result;
      pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
      pulse.worldMasteryAddedXP = Math.max(0, (pulse.worldMasteryAddedXP || 0) + result.worldMasteryAddedXP);
      pulse.nextLabUnlock = {
        label: "VILLAGE GUARDIAN PACT",
        title: "State-machine village secured",
        body: "Use pets, cave safety, and fair trades as evidence that AI states can protect a community.",
        progress: 1
      };
      if (rankUp) {
        pulse.rankUp = true;
        pulse.rankTitle = afterRank ? afterRank.title : null;
        pulse.rankPerk = afterRank ? afterRank.perk : null;
      }
      this.attachFormulaCardUnlock(pulse, "state");
      this.completeActiveAIStateRun("guardian-pact", pulse);
    }

    if (typeof ui_log_output === 'function') {
      const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`Village Guardian Pact: +${rewardXP} Research XP${masteryText}.`, "success");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`VILLAGE PACT: +${rewardXP} Research XP`, {
        title: "VILLAGE GUARDIAN",
        color,
        timer: 260
      });
    }

    const fx = options.npc || this.player;
    if (fx && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const width = Number.isFinite(fx.w) ? fx.w : 28;
      const height = Number.isFinite(fx.h) ? fx.h : 36;
      const x = (Number.isFinite(fx.x) ? fx.x : 0) + width / 2;
      const y = Number.isFinite(fx.y) ? fx.y : 0;
      ComicBubbles.pop(x, y - 64, "VILLAGE PACT!", color, 0.96);
      ComicBubbles.pop(x, y - 44, "AI STATES MASTERED", "#a7f3d0", 0.68);
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(x, y + height / 2, color, 16, 2.2, 2.1, "glow");
        Particles.spawnBurst(x, y + height / 2, "#a7f3d0", 10, 1.6, 1.7, "glow");
      }
    }
    if (rankUp && typeof showBadgeToast === 'function' && afterRank) {
      showBadgeToast({
        icon: "AI",
        label: `Research Rank: ${afterRank.title}`,
        description: `Village Guardian Pact unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && pulse && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    return result;
  }

  completeActiveAIStateRun(cardId, pulse = null) {
    if (!cardId || !this.activeAIStateRun || this.activeAIStateRun.cardId !== cardId) return null;
    if (typeof getAIStateDeckProgress !== 'function') return null;
    const progress = getAIStateDeckProgress(this);
    const card = progress && Array.isArray(progress.cards)
      ? progress.cards.find(item => item && item.id === cardId)
      : null;
    if (!card || !card.earned) return null;
    const next = progress.nextCard || null;
    const nextAction = next && typeof getAIStateDeckAction === 'function'
      ? getAIStateDeckAction(this, next.id)
      : null;
    const result = {
      label: "AI PROOF LOGGED",
      cardId,
      title: card.title || "AI state",
      state: card.state || "",
      concept: card.concept || "State machine",
      progress: `${Math.max(0, Number(progress.earnedCount) || 0)}/${Math.max(0, Number(progress.total) || 0)}`,
      nextCardId: next ? next.id : "",
      nextTitle: next ? next.title : "Deck complete",
      nextState: next ? (next.state || "") : "",
      nextActionLabel: nextAction ? (nextAction.label || "RUN STATE") : "",
      nextActionBody: nextAction ? (nextAction.body || next.next || "") : "",
      levelIndex: Number.isFinite(this.currentPlanetIndex) ? this.currentPlanetIndex : null,
      complete: !!progress.complete
    };
    this.activeAIStateRun = null;
    this.lastAIStateRunProof = result;
    if (pulse) pulse.aiStateRunProof = result;
    if (result.complete) {
      const deckMastery = this.grantAIStateDeckMastery(progress, pulse);
      if (deckMastery) result.deckMastery = deckMastery;
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(`AI proof logged: ${result.title} (${result.progress}). Next: ${result.nextTitle}.`, "success");
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (this.player.w || 24) / 2;
      const py = Number.isFinite(this.player.y) ? this.player.y : 0;
      ComicBubbles.pop(px, py - 62, "AI PROOF!", "#facc15", 0.92);
      ComicBubbles.pop(px, py - 43, result.complete ? "DECK COMPLETE" : `NEXT: ${String(result.nextTitle).toUpperCase()}`, "#7dd3fc", 0.66);
    }
    return result;
  }

  grantAIStateDeckMastery(progress = null, pulse = null) {
    if (typeof getAIStateDeckProgress !== 'function') return null;
    const deck = progress || getAIStateDeckProgress(this);
    if (!deck || !deck.complete || !Array.isArray(deck.cards) || deck.cards.length === 0) return null;
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const sourceKey = "ai-state-deck-mastery";
    let masterySources = null;
    if (typeof this.normalizeWorldMasteryMeter === 'function') {
      const meter = this.normalizeWorldMasteryMeter(this.currentPlanetIndex);
      masterySources = meter && meter.sources ? meter.sources : null;
    }
    if (this.discoveryPassCounts[sourceKey] || (masterySources && masterySources[sourceKey])) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }

    const rewardXP = 9;
    const masteryXP = 12;
    const color = "#7dd3fc";
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, "AI state deck mastery", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }

    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const result = {
      label: "AI DECK MASTERED",
      title: "AI State Deck Mastery",
      rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      count: deck.earnedCount,
      total: deck.total,
      sourceKey
    };

    if (pulse) {
      pulse.aiStateDeckMastery = result;
      pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
      pulse.worldMasteryAddedXP = Math.max(0, (pulse.worldMasteryAddedXP || 0) + result.worldMasteryAddedXP);
      pulse.nextLabUnlock = {
        label: "AI STATE DECK COMPLETE",
        title: "All behavior states logged",
        body: "Use trade, cave, pet, guard, and guardian states in Daily Signals, remixes, and village rescues.",
        progress: 1
      };
      if (rankUp && afterRank) {
        pulse.rankUp = true;
        pulse.rankTitle = afterRank.title;
        pulse.rankPerk = afterRank.perk;
      }
    }

    if (rankUp && afterRank && typeof showBadgeToast === 'function') {
      showBadgeToast({
        icon: "AI",
        label: `Research Rank: ${afterRank.title}`,
        description: `AI State Deck Mastery unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && pulse && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof ui_log_output === 'function') {
      const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`AI State Deck mastered: +${rewardXP} Research XP${masteryText}.`, "success");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`AI DECK MASTERED: +${rewardXP} Research XP`, {
        title: "AI STATE DECK",
        color,
        timer: 260
      });
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (this.player.w || 24) / 2;
      const py = Number.isFinite(this.player.y) ? this.player.y : 0;
      ComicBubbles.pop(px, py - 78, "AI DECK!", color, 1.0);
      ComicBubbles.pop(px, py - 58, `${result.count}/${result.total} STATES`, "#fde68a", 0.76);
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(px, py - 10, color, 16, 2.3, 2.0, "glow");
        Particles.spawnBurst(px, py - 10, "#fde68a", 10, 1.7, 1.6, "glow");
      }
    }
    return result;
  }

  attachFormulaCardUnlock(pulse, kind) {
    if (!pulse || !kind || typeof unlockFormulaKind !== 'function') return false;
    const cardUnlocked = unlockFormulaKind(this, kind);
    pulse.cardUnlocked = !!cardUnlocked;
    pulse.formulaCardKind = kind;
    const rule = typeof DISCOVERY_RULES !== 'undefined' && Array.isArray(DISCOVERY_RULES)
      ? DISCOVERY_RULES.find(item => item && item.kind === kind)
      : null;
    if (rule) {
      pulse.formulaCardTitle = rule.title;
      pulse.formulaCardFormula = rule.formula;
    }
    if (cardUnlocked && typeof this.spawnFormulaCardEffect === 'function') {
      this.spawnFormulaCardEffect(pulse);
    }
    if (cardUnlocked && typeof this.grantFormulaDeckMastery === 'function') {
      this.grantFormulaDeckMastery(pulse);
    }
    return cardUnlocked;
  }

  grantFormulaDeckMastery(pulse = null, options = {}) {
    if (typeof getFormulaCollection !== 'function') return null;
    const collection = getFormulaCollection(this);
    if (!collection || !Array.isArray(collection.cards) || collection.cards.length === 0 || collection.locked.length > 0) return null;
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const sourceKey = "formula-deck-mastery";
    if (this.discoveryPassCounts[sourceKey]) return null;

    this.discoveryPassCounts[sourceKey] = 1;
    const rewardXP = 12;
    const masteryXP = 16;
    const color = "#facc15";
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, "formula deck mastery", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    const result = {
      label: "DECK MASTERED",
      title: "Formula Deck Mastery",
      rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      count: collection.unlocked.length,
      total: collection.cards.length,
      sourceKey
    };

    if (pulse) {
      pulse.formulaDeckMastery = result;
      pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
      pulse.nextLabUnlock = {
        label: "FORMULA DECK COMPLETE",
        title: "All science cards collected",
        body: "Use the full deck in Daily Signals, Frontier runs, and mastery remixes.",
        progress: 1
      };
    }

    if (!options || !options.deferResearchXP) {
      this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
      const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
      if (beforeRank && afterRank && afterRank.level > beforeRank.level && pulse) {
        pulse.rankUp = true;
        pulse.rankTitle = afterRank.title;
        pulse.rankPerk = afterRank.perk;
        if (typeof showBadgeToast === 'function') {
          showBadgeToast({
            icon: "FX",
            label: `Research Rank: ${afterRank.title}`,
            description: `Formula Deck Mastery unlocked ${afterRank.perk.label}.`
          });
        }
        if (typeof this.spawnResearchRankEffect === 'function') {
          pulse.rankEffect = this.spawnResearchRankEffect(pulse);
        }
      }
    }

    if (typeof ui_log_output === 'function') {
      const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`Formula Deck mastered: +${rewardXP} Research XP${masteryText}.`, "success");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`DECK MASTERED: +${rewardXP} Research XP`, {
        title: "FORMULA DECK",
        color,
        timer: 260
      });
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (this.player.w || 24) / 2;
      const py = Number.isFinite(this.player.y) ? this.player.y : 0;
      ComicBubbles.pop(px, py - 64, "DECK MASTERED!", color, 1.0);
      ComicBubbles.pop(px, py - 44, "ALL FORMULAS", "#67e8f9", 0.74);
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(px, py - 10, color, 18, 2.4, 2.2, "glow");
        Particles.spawnBurst(px, py - 10, "#67e8f9", 12, 1.8, 1.8, "glow");
      }
    }
    return result;
  }

  getDiscoveryComboMilestoneSourceKey(combo) {
    const count = Math.max(1, Math.floor(Number(combo) || 1));
    return `lab-chain:${count}`;
  }

  getNextDiscoveryComboMilestone(combo = this.discoveryCombo) {
    const current = Math.max(0, Math.floor(Number(combo) || 0));
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    let masterySources = null;
    if (typeof this.normalizeWorldMasteryMeter === 'function') {
      const meter = this.normalizeWorldMasteryMeter(this.currentPlanetIndex);
      masterySources = meter && meter.sources ? meter.sources : null;
    }
    for (const milestone of DISCOVERY_COMBO_MILESTONES) {
      if (!milestone) continue;
      const sourceKey = this.getDiscoveryComboMilestoneSourceKey(milestone.combo);
      if (this.discoveryPassCounts[sourceKey] || (masterySources && masterySources[sourceKey])) continue;
      return {
        ...milestone,
        sourceKey,
        remaining: Math.max(0, milestone.combo - current)
      };
    }
    return null;
  }

  grantDiscoveryComboMilestone(pulse = null, options = {}) {
    const combo = Math.max(0, Math.floor(Number((pulse && pulse.combo) || this.discoveryCombo) || 0));
    if (combo <= 0 || !Array.isArray(DISCOVERY_COMBO_MILESTONES)) return null;
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const milestone = DISCOVERY_COMBO_MILESTONES.find(item =>
      item && combo >= item.combo && !this.discoveryPassCounts[this.getDiscoveryComboMilestoneSourceKey(item.combo)]
    );
    if (!milestone) return null;

    const sourceKey = this.getDiscoveryComboMilestoneSourceKey(milestone.combo);
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(milestone.masteryXP, "lab chain milestone", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }
    this.discoveryPassCounts[sourceKey] = 1;
    const result = {
      label: milestone.label,
      title: milestone.title,
      combo: milestone.combo,
      rewardXP: milestone.rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      body: milestone.body
    };

    if (pulse) {
      pulse.comboMilestone = result;
      pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + milestone.rewardXP);
      pulse.worldMasteryAddedXP = Math.max(0, (pulse.worldMasteryAddedXP || 0) + result.worldMasteryAddedXP);
    }

    if (!options || !options.deferResearchXP) {
      this.researchXP = Math.max(0, (this.researchXP || 0) + milestone.rewardXP);
      const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
      if (beforeRank && afterRank && afterRank.level > beforeRank.level && pulse) {
        pulse.rankUp = true;
        pulse.rankTitle = afterRank.title;
        pulse.rankPerk = afterRank.perk;
        if (typeof showBadgeToast === 'function') {
          showBadgeToast({
            icon: "x3",
            label: `Research Rank: ${afterRank.title}`,
            description: `${milestone.title} unlocked ${afterRank.perk.label}.`
          });
        }
        if (typeof this.spawnResearchRankEffect === 'function') {
          pulse.rankEffect = this.spawnResearchRankEffect(pulse);
        }
      }
    }

    if (typeof ui_log_output === 'function') {
      const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`${milestone.title}: +${milestone.rewardXP} Research XP${masteryText}.`, "success");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`${milestone.label}: +${milestone.rewardXP} Research XP`, {
        title: "LAB CHAIN",
        color: milestone.color,
        timer: 240
      });
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
      const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
      const width = Number.isFinite(this.player.w) ? this.player.w : 24;
      const height = Number.isFinite(this.player.h) ? this.player.h : 32;
      const px = baseX + width / 2;
      const py = baseY + height / 2;
      ComicBubbles.pop(px, baseY - 66, milestone.pop, milestone.color, 1.02);
      ComicBubbles.pop(px, baseY - 47, `CHAIN x${milestone.combo}`, "#a7f3d0", 0.7);
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(px, py - 8, milestone.color, 14, 2.3, 2.1, "glow");
        Particles.spawnBurst(px, py - 8, "#a7f3d0", 8, 1.7, 1.6, "glow");
      }
    }
    return result;
  }

  grantVillageRescueReward(npc, reason = "danger") {
    if (!npc) return null;
    const sourceKey = this.getVillageRescueSourceKey(npc);
    const award = this.awardWorldMasteryXP(12, "village rescue", { sourceKey, silent: true });
    if (!award || award.duplicate || award.addedXP <= 0) return null;
    const villageTrust = this.grantVillageTrust(4, sourceKey, "rescue", { npc, color: npc.color || "#4ade80" });

    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const xp = 7;
    this.researchXP = Math.max(0, (this.researchXP || 0) + xp);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const villagerName = npc.name || "A villager";
    const pulse = {
      kind: "village",
      title: "Village Rescue",
      formula: "state = patrol -> shelter -> trade",
      insight: `${villagerName} returned after ${reason}. That is a game-AI state machine: detect danger, shelter, then resume trading.`,
      cue: "Clear space, use pets, or end Survival so villagers can safely leave caves.",
      missionId: sourceKey,
      missionTitle: this.currentPlanet ? this.currentPlanet.name : "Village",
      passed: 1,
      total: 1,
      progressLabel: "villager safe",
      openedGems: 0,
      rewardXP: xp,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      worldMasteryAddedXP: award.addedXP,
      villageTrust: villageTrust && villageTrust.added > 0 ? villageTrust : null
    };
    this.attachFormulaCardUnlock(pulse, "state");
    this.completeActiveAIStateRun("shelter-loop", pulse);
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);
    if (typeof ui_log_output === 'function') {
      ui_log_output(`Village Rescue: +${xp} Research XP, +${award.addedXP} world mastery XP.`, "success");
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop((Number.isFinite(npc.x) ? npc.x : 0) + (npc.w || 28) / 2, (Number.isFinite(npc.y) ? npc.y : 0) - 5, "SAFE!", npc.color || "#4ade80", 1.0);
    }
    if (typeof Particles !== 'undefined') {
      Particles.spawnBurst((Number.isFinite(npc.x) ? npc.x : 0) + (npc.w || 28) / 2, (Number.isFinite(npc.y) ? npc.y : 0) + (npc.h || 36) / 2, npc.color || "#4ade80", 10, 2.0, 2.2, "glow");
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    this.grantVillageGuardianPact(pulse, { npc, color: npc.color || "#4ade80" });
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === this) saveLocalProgress();
    return pulse;
  }

  releaseVillagersFromCaves(options = {}) {
    const keepSheltered = Object.prototype.hasOwnProperty.call(options, "keepSheltered")
      ? !!options.keepSheltered
      : this.shouldVillagersShelterForNight();
    let villagers = 0;
    let released = 0;
    let sheltered = 0;
    for (const obj of this.interactiveObjects || []) {
      if (!(typeof NPC !== 'undefined' && obj instanceof NPC)) continue;
      villagers++;
      const hadShelterState = !!(obj.hiddenInCave || obj.rescuePending || obj.shelterReason || (obj.panicTimer || 0) > 0);
      obj.panicTimer = 0;
      obj.caveCooldown = 0;
      if (keepSheltered) {
        sheltered++;
        if (!obj.rescuePending) obj.shelterReason = "night";
        this.parkNPCInCave(obj, "night");
        continue;
      }
      if (hadShelterState) {
        this.releaseNPCFromCave(obj, { returnHome: true });
        released++;
      } else {
        obj.hiddenInCave = false;
        obj.rescuePending = false;
        obj.shelterReason = null;
        obj.proximity = false;
        if (Number.isFinite(obj.homeX)) obj.x = obj.homeX;
        if (Number.isFinite(obj.homeY)) obj.y = obj.homeY;
        if (this.activeNPC === obj) this.activeNPC = null;
        released++;
      }
    }
    if (this.activeNPC && this.activeNPC.hiddenInCave) this.activeNPC = null;
    this.syncTradeTouchControls();
    if (villagers > 0 && typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(
        keepSheltered ? "VILLAGE NIGHT: traders wait in caves" : "VILLAGE CLEAR: traders back outside",
        {
          title: "MISSION CRT",
          color: keepSheltered ? "#fde68a" : "#a7f3d0",
          timer: 220
        }
      );
    }
    return { villagers, released, sheltered, keepSheltered };
  }

  syncTradeTouchControls() {
    if (typeof document === 'undefined') return;
    const touch = document.getElementById('touch-controls');
    if (touch) touch.classList.toggle('npc-near', !!this.activeNPC);
  }

  parkNPCInCave(npc, reason = "shelter") {
    if (!npc) return;
    if (typeof this.ensureNPCSafeCave === 'function') this.ensureNPCSafeCave(npc);
    npc.hiddenInCave = true;
    if (Number.isFinite(npc.caveX)) npc.x = npc.caveX + 10;
    if (Number.isFinite(npc.caveY)) npc.y = npc.caveY;
    if (reason === "night" && !npc.rescuePending) npc.shelterReason = "night";
    else if (!npc.rescuePending && !npc.shelterReason) npc.shelterReason = reason;
    npc.proximity = false;
    if (this.activeNPC === npc) this.activeNPC = null;
  }

  releaseNPCFromCave(npc, options = {}) {
    if (!npc) return;
    const rescuePending = !!npc.rescuePending;
    npc.hiddenInCave = false;
    if (options.returnHome && Number.isFinite(npc.homeX)) npc.x = npc.homeX;
    else if (Number.isFinite(npc.caveX)) npc.x = npc.caveX + 10;
    if (Number.isFinite(npc.homeY)) npc.y = npc.homeY;
    if (rescuePending) this.grantVillageRescueReward(npc, npc.shelterReason || "danger");
    npc.rescuePending = false;
    npc.shelterReason = null;
    npc.panicTimer = 0;
    npc.caveCooldown = 0;
    npc.proximity = false;
    if (this.activeNPC === npc) this.activeNPC = null;
  }

  markNPCShelterThreat(npc, reason = "nearby mob", options = {}) {
    if (!npc) return false;
    npc.panicTimer = Math.max(npc.panicTimer || 0, options.panicTimer || 120);
    npc.rescuePending = true;
    if (!npc.shelterReason || npc.shelterReason === "nearby mob" || npc.shelterReason === "night") npc.shelterReason = reason;
    if (!npc.hiddenInCave && options.bubble && typeof ComicBubbles !== 'undefined' && (npc.caveCooldown || 0) <= 0) {
      ComicBubbles.spawn(npc.x + npc.w / 2, npc.y - 8, "CAVE!", "jagged", "#facc15", -0.35, { maxLife: 60, scale: 0.8 });
    }
    npc.caveCooldown = Math.max(npc.caveCooldown || 0, options.caveCooldown || 90);
    npc.proximity = false;
    if (this.activeNPC === npc) this.activeNPC = null;
    return true;
  }

  updateVillagerShelterStates() {
    if (!(this.interactiveObjects && typeof NPC !== 'undefined')) return;
    let touchNeedsSync = false;
    for (const obj of this.interactiveObjects) {
      if (!(obj instanceof NPC)) continue;
      const shelter = this.getVillagerShelterSignal(obj);
      const threat = shelter.threat;
      if (threat) {
        if (this.markNPCShelterThreat(obj, "nearby mob", { bubble: true, panicTimer: 150 })) touchNeedsSync = true;
        if (typeof this.ensureNPCSafeCave === 'function') this.ensureNPCSafeCave(obj);
        if (!obj.hiddenInCave && typeof obj.stepTowardCave === 'function' && obj.stepTowardCave(2.8)) touchNeedsSync = true;
        continue;
      }
      if (shelter.reason === "night") {
        if (!obj.rescuePending) obj.shelterReason = "night";
        if (this.activeNPC === obj) touchNeedsSync = true;
        if (typeof this.ensureNPCSafeCave === 'function') this.ensureNPCSafeCave(obj);
        if (obj.hiddenInCave) this.parkNPCInCave(obj, "night");
        else if (typeof obj.stepTowardCave === 'function' && obj.stepTowardCave(2.4)) touchNeedsSync = true;
        else obj.proximity = false;
        obj.proximity = false;
        if (this.activeNPC === obj) this.activeNPC = null;
        continue;
      }
      if (this.shouldNPCWaitInCave(obj, shelter)) {
        if (this.activeNPC === obj) touchNeedsSync = true;
        if (typeof this.ensureNPCSafeCave === 'function') this.ensureNPCSafeCave(obj);
        if (obj.hiddenInCave) this.parkNPCInCave(obj, obj.shelterReason || "nearby mob");
        else if (typeof obj.stepTowardCave === 'function' && obj.stepTowardCave(2.8)) touchNeedsSync = true;
        obj.proximity = false;
        if (this.activeNPC === obj) this.activeNPC = null;
        continue;
      }
      if ((obj.panicTimer || 0) > 0) obj.panicTimer = 0;
      if (!obj.hiddenInCave && obj.rescuePending) {
        this.releaseNPCFromCave(obj, { returnHome: true });
        touchNeedsSync = true;
      } else if (obj.hiddenInCave && (obj.panicTimer || 0) <= 0) {
        this.releaseNPCFromCave(obj, { returnHome: true });
        touchNeedsSync = true;
      } else if (!obj.hiddenInCave && obj.shelterReason === "night" && !obj.rescuePending) {
        obj.shelterReason = null;
      }
    }
    if (touchNeedsSync) this.syncTradeTouchControls();
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

  getPlanetMissionGemTotal(index = this.currentPlanetIndex) {
    const planet = (typeof PLANETS !== 'undefined' && PLANETS[index]) || null;
    const map = planet && Array.isArray(planet.map) ? planet.map : null;
    if (!map) return 0;
    let total = 0;
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === 3) total++;
      }
    }
    return total;
  }

  getBankedMissionGemCount(index = this.currentPlanetIndex) {
    const key = String(index || 0);
    const wallet = this.gemsAwardedForPlanet || {};
    const raw = wallet[index] !== undefined ? wallet[index] : wallet[key];
    return Math.max(0, Math.floor(Number(raw) || 0));
  }

  hasCollectedAllMissionGems(index = this.currentPlanetIndex) {
    const key = String(index || 0);
    if (this.masteryCleared && this.masteryCleared[key]) return true;
    if (this.bestLabStars && Number(this.bestLabStars[key] || this.bestLabStars[index]) >= 3) return true;
    const total = this.getPlanetMissionGemTotal(index);
    if (total <= 0) return true;
    return this.getBankedMissionGemCount(index) >= total;
  }

  isMasteryReplayUnlocked(index = this.currentPlanetIndex) {
    const clears = Math.max(0, Math.floor(Number((this.planetClears || {})[index] || (this.planetClears || {})[String(index)] || 0)));
    return clears > 0 && this.hasCollectedAllMissionGems(index);
  }

  getFreshReplayPlan(index = this.currentPlanetIndex) {
    const clears = Math.max(0, Math.floor(Number((this.planetClears || {})[index] || (this.planetClears || {})[String(index)] || 0)));
    if (clears <= 0) return { context: "first", attempt: 0, clears, masteryUnlocked: false };
    const masteryUnlocked = this.isMasteryReplayUnlocked(index);
    return {
      context: masteryUnlocked ? "mastery" : "cleanup",
      attempt: masteryUnlocked ? Math.max(1, clears) : 0,
      clears,
      masteryUnlocked
    };
  }

  getActiveCadetProfile() {
    if (typeof window !== 'undefined' && window.StarHopperProfiles && typeof window.StarHopperProfiles.getActive === 'function') {
      try { return window.StarHopperProfiles.getActive(); } catch (e) { return null; }
    }
    return null;
  }

  getCadetCallsign() {
    const active = this.getActiveCadetProfile();
    const name = active && active.name ? String(active.name).trim().slice(0, 24) : "Cadet";
    const emoji = active && active.emoji ? String(active.emoji).trim() : "";
    return `${emoji ? emoji + " " : ""}${name || "Cadet"}`;
  }

  getCadetStoryName() {
    const active = this.getActiveCadetProfile();
    const name = active && active.name ? String(active.name).trim().slice(0, 18) : "Cadet";
    return name || "Cadet";
  }

  formatVectorTransmission(text, trigger = "start") {
    const clean = String(text || "").replace(/^\s*Vector here\s*[—–-]\s*/i, "").trim();
    if (!clean) return "";
    if (/^VECTOR\s*\/\//i.test(clean)) return clean;
    const prefix = trigger === "start" ? `VECTOR // ${this.getCadetCallsign()}` : "VECTOR //";
    return `${prefix}: ${clean}`;
  }

  getSuitDisplayName(charType = this.player && this.player.charType) {
    return charType === 'hopper' ? "Hopper" : "Star Rover";
  }

  getSuitArrivalQuip(index = this.currentPlanetIndex, charType = this.player && this.player.charType) {
    const planetName = (typeof PLANETS !== 'undefined' && PLANETS[index]) ? PLANETS[index].name.split(" ")[0] : "world";
    const starLines = [
      `Star Rover: light feet ready on ${planetName}.`,
      "Star Rover: glide path checked.",
      "Star Rover: I can feel the arc."
    ];
    const hopperLines = [
      `Hopper: heavy suit online for ${planetName}.`,
      "Hopper: rockets warm, boots planted.",
      "Hopper: mass, force, and nerve."
    ];
    const lines = charType === 'hopper' ? hopperLines : starLines;
    return lines[Math.abs(Number(index) || 0) % lines.length];
  }

  getStarMapFinaleCopy({ frontier = null, payoff = "" } = {}) {
    const cadet = this.getCadetStoryName();
    const lead = payoff ? `${payoff} ` : "";
    const frontierText = frontier
      ? `Vector has logged ${cadet} as the cadet who restored the six-shard star-map. Frontier Challenge is online: a date-seeded tier run that keeps remixing the completed map. Print the Scientist Certificate from the Log, then climb today's frontier.`
      : `Vector has logged ${cadet} as the cadet who restored the six-shard star-map. A new Daily Signal arrives every day to keep the lab habit alive while worlds 7 and 8 are built. Print the Scientist Certificate from the Log.`;
    return {
      title: "STAR-MAP RESTORED! 🛰️",
      subtitle: `${lead}${frontierText}`
    };
  }

  // Gravity the rover actually FEELS (game-units): the planet's gravity (or a gravity=
  // override) minus the antigravity device. Antigravity counters gravity; negative
  // antigravity adds to it. Floored just above zero so you never fully float away.
  getCurrentGravity() {
    const env = (typeof Compiler !== 'undefined' && Compiler.env) ? Compiler.env : {};
    const base = (env.gravity !== null && env.gravity !== undefined)
      ? env.gravity
      : (this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.gravity : 0.6);
    let anti = env.antigravity || 0; // game-units
    // Antigravity needs fuel: an empty tank means the coil can't push back on gravity (PHYSICS).
    if (anti > 0 && this.player && this.player.fuel <= 0) anti = 0;
    return Math.max(0.02, base - anti);
  }

  // The gravity the cadet's DESIGN produces (base minus the antigravity they commanded), WITHOUT
  // the empty-tank gate. Engineering readouts/gates (Agility) use this so the number reflects
  // what was built and never silently collapses when the thruster drains mid-flight — only the
  // actual physics float (getCurrentGravity) is fuel-limited.
  getDesignGravity() {
    const env = (typeof Compiler !== 'undefined' && Compiler.env) ? Compiler.env : {};
    const base = (env.gravity !== null && env.gravity !== undefined)
      ? env.gravity
      : (this.currentPlanet && this.currentPlanet.physics ? this.currentPlanet.physics.gravity : 0.6);
    return Math.max(0.02, base - (env.antigravity || 0));
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
    const bonus = (this.upgradeCapBonuses && this.upgradeCapBonuses[key]) ? this.upgradeCapBonuses[key] : 0;
    let raw = u.base + (u.extreme - u.base) * this.getUpgradeLevel(key);
    if (u.isFloor) {
      raw = Math.max(0.1, raw - bonus);
    } else {
      raw += bonus;
    }
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
    // Use the DESIGN gravity (commanded antigravity), not the fuel-gated physics gravity, so the
    // Agility a cadet engineers stays put — it must not drop just because the thruster ran dry.
    const g = Math.max(0.05, this.getDesignGravity());
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
    return this.getDailySignalForDate(this.getTodayDateStr());
  }

  getDailySignalForDate(dateStr = this.getTodayDateStr()) {
    if (typeof getDailySignal !== 'function' || typeof PLANETS === 'undefined') return null;
    const dateKey = String(dateStr || this.getTodayDateStr());
    return getDailySignal(PLANETS, dateKey, this.getDailySignalPool());
  }

  startDailySignal() {
    const daily = this.getDailySignal();
    if (!daily) return false;
    this.dailyInfo = daily;
    this._pendingAttemptOverride = daily.attempt; // consumed by loadPlanet
    this.startLevel(daily.planetIndex);
    if (typeof ui_log_output === 'function') {
      ui_log_output(`📡 Daily Signal accepted — beat it and share your code: ${daily.shareCode}`, "success");
    }
    return true;
  }

  getFrontierPlayableCount() {
    return (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) ? PLANETS.length : 0;
  }

  hasCompletedMainStarMap() {
    const playableCount = this.getFrontierPlayableCount();
    if (!playableCount) return false;
    for (let i = 0; i < playableCount; i++) {
      if (!((this.planetClears && this.planetClears[i]) || 0)) return false;
    }
    return true;
  }

  getFrontierChallenge(dateStr = null) {
    if (typeof PLANETS === 'undefined' || typeof buildPlanetVariant !== 'function') return null;
    if (!this.hasCompletedMainStarMap()) return null;
    const playableCount = this.getFrontierPlayableCount();
    if (!playableCount) return null;
    const today = dateStr || this.getTodayDateStr();
    const seed = (typeof dateSeed === 'function') ? dateSeed(`frontier:${today}`) : dateSeedFallback(`frontier:${today}`);
    const masteryTotal = Array.from({ length: playableCount }, (_, index) =>
      (this.getWorldMasteryProgress(index).xp || 0)
    ).reduce((sum, xp) => sum + xp, 0);
    const averageMastery = Math.floor(masteryTotal / playableCount);
    const tier = Math.max(1, 1 + Math.floor(averageMastery / 60));
    const planetIndex = seed % playableCount;
    const attempt = 98 + tier * 13 + (seed % 37);
    const planet = PLANETS[planetIndex];
    const variant = buildPlanetVariant(planet, planetIndex, attempt);
    const codeName = (planet.name || "WORLD").split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "");
    const concept = planet.tagline || "Physics remix";
    const labContract = (typeof buildReplayLabContract === 'function')
      ? buildReplayLabContract(planet, planetIndex, variant)
      : null;
    return {
      dateStr: today,
      seed,
      planetIndex,
      attempt,
      tier,
      variant,
      isFrontier: true,
      planetName: planet.name || "World",
      concept,
      labGoal: "3 Lab Stars: tasks + samples + proof",
      labContract,
      shareCode: `FRONTIER-${codeName}-${String(seed % 10000).padStart(4, '0')}`,
      label: `Tier ${tier} ${planet.name}: ${variant.variantLabel}`
    };
  }

  startFrontierChallenge(options = {}) {
    const frontier = this.getFrontierChallenge();
    if (!frontier) {
      if (typeof ui_log_output === 'function') {
        ui_log_output("Complete the star-map to unlock Frontier Challenge mode.", "info");
      }
      return false;
    }
    const darkMatterEcho = !!(options && (options.source === "dark-matter-echo" || options.darkMatterEcho));
    const darkMatterPrep = !!(options && (options.source === "dark-matter-prep" || options.darkMatterPrep));
    const futureSourcePrep = !!(options && (options.source === "future-source" || options.futureSourcePrep));
    if (darkMatterEcho) {
      const base = frontier.labContract || {};
      frontier.darkMatterEcho = true;
      frontier.labGoal = "Dark Matter Echo: Frontier evidence + signal clue";
      frontier.labContract = {
        title: "Dark Matter Echo: decode anomaly",
        body: `${base.title ? `${base.title}: ` : ""}Run the Frontier remix, then compare stars, time, and motion clues to decode the hidden-force echo.`,
        concept: "Infer hidden forces from Frontier evidence",
        command: base.command || ""
      };
    } else if (darkMatterPrep) {
      const base = frontier.labContract || {};
      frontier.darkMatterPrep = true;
      frontier.labGoal = "Dark Matter Prep: curve + speed + force evidence";
      frontier.labContract = {
        title: "Dark Matter Prep: curve evidence",
        body: `${base.title ? `${base.title}: ` : ""}Run the Frontier remix, then compare path curve, speed, and force changes as hidden-force clues.`,
        concept: "Infer hidden forces from motion",
        command: base.command || ""
      };
    } else if (futureSourcePrep) {
      const base = frontier.labContract || {};
      frontier.futureSourcePrep = true;
      frontier.labGoal = "Future Source Key: hidden force + probability evidence";
      frontier.labContract = {
        title: "Future Source Key: source rehearsal",
        body: `${base.title ? `${base.title}: ` : ""}Run the Frontier remix, then compare hidden-force clues with branch and chance evidence for the source key.`,
        concept: "Combine hidden-force inference with probability evidence",
        command: base.command || ""
      };
    }
    this.dailyInfo = frontier;
    this._pendingAttemptOverride = frontier.attempt; // consumed by loadPlanet
    this.startLevel(frontier.planetIndex);
    if (typeof ui_log_output === 'function') {
      ui_log_output(
        futureSourcePrep
          ? `◆ Future Source rehearsal accepted — tune the source key with ${frontier.shareCode}`
          : darkMatterEcho
          ? `◆ Dark Matter Echo accepted — decode the anomaly with ${frontier.shareCode}`
          : darkMatterPrep
          ? `◆ Dark Matter prep run accepted — bank curve evidence with ${frontier.shareCode}`
          : `◆ Frontier Challenge tier ${frontier.tier} accepted — share code ${frontier.shareCode}`,
        "success"
      );
    }
    return true;
  }

  normalizeFrontierRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const tier = Math.max(1, Math.floor(Number(record.tier) || 1));
    const stars = Math.max(0, Math.min(3, Math.floor(Number(record.stars) || 0)));
    const bestTime = Number(record.bestTime);
    return {
      dateStr: record.dateStr ? String(record.dateStr) : this.getTodayDateStr(),
      shareCode: record.shareCode ? String(record.shareCode) : "",
      tier,
      planetIndex: Number.isFinite(Number(record.planetIndex)) ? Number(record.planetIndex) : 0,
      planetName: record.planetName ? String(record.planetName) : "Frontier world",
      variantLabel: record.variantLabel ? String(record.variantLabel) : "seeded remix",
      stars,
      bestTime: Number.isFinite(bestTime) && bestTime > 0 ? Math.round(bestTime * 10) / 10 : null
    };
  }

  compareFrontierRecords(candidate, existing) {
    const next = this.normalizeFrontierRecord(candidate);
    const prev = this.normalizeFrontierRecord(existing);
    if (!next && !prev) return 0;
    if (next && !prev) return 1;
    if (!next && prev) return -1;
    if (next.tier !== prev.tier) return next.tier - prev.tier;
    if (next.stars !== prev.stars) return next.stars - prev.stars;
    const nextTime = Number.isFinite(next.bestTime) ? next.bestTime : Infinity;
    const prevTime = Number.isFinite(prev.bestTime) ? prev.bestTime : Infinity;
    if (nextTime !== prevTime) return prevTime - nextTime;
    return 0;
  }

  isFrontierRecordBetter(candidate, existing) {
    return this.compareFrontierRecords(candidate, existing) > 0;
  }

  getFrontierRecordList() {
    return Object.values(this.frontierRecords || {})
      .map(record => this.normalizeFrontierRecord(record))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier;
        if (b.stars !== a.stars) return b.stars - a.stars;
        const at = Number.isFinite(a.bestTime) ? a.bestTime : Infinity;
        const bt = Number.isFinite(b.bestTime) ? b.bestTime : Infinity;
        if (at !== bt) return at - bt;
        return String(b.dateStr).localeCompare(String(a.dateStr));
      });
  }

  getFrontierRecordSummary(dateStr = this.getTodayDateStr()) {
    const records = this.getFrontierRecordList();
    return {
      count: records.length,
      best: records[0] || null,
      today: this.normalizeFrontierRecord((this.frontierRecords || {})[dateStr]) || null
    };
  }

  recordFrontierClear({ frontierInfo = this.dailyInfo, labStars = null, clearTime = null } = {}) {
    if (!frontierInfo || !frontierInfo.isFrontier) return null;
    const planet = (typeof PLANETS !== 'undefined' && PLANETS[frontierInfo.planetIndex]) || null;
    const record = this.normalizeFrontierRecord({
      dateStr: frontierInfo.dateStr || this.getTodayDateStr(),
      shareCode: frontierInfo.shareCode,
      tier: frontierInfo.tier || 1,
      planetIndex: frontierInfo.planetIndex,
      planetName: planet ? planet.name : "Frontier world",
      variantLabel: frontierInfo.variant ? frontierInfo.variant.variantLabel : "",
      stars: labStars ? labStars.stars : 0,
      bestTime: clearTime ? clearTime.elapsed : null
    });
    if (!record) return null;
    this.frontierRecords = this.frontierRecords || {};
    const previous = this.frontierRecords[record.dateStr];
    const isNewBest = this.isFrontierRecordBetter(record, previous);
    if (isNewBest) this.frontierRecords[record.dateStr] = record;
    return { record: this.normalizeFrontierRecord(this.frontierRecords[record.dateStr] || record), isNewBest };
  }

  getFrontierShareText(frontier = null) {
    const challenge = frontier || this.getFrontierChallenge();
    if (!challenge) return "";
    const record = this.normalizeFrontierRecord((this.frontierRecords || {})[challenge.dateStr]);
    const proof = record
      ? ` · best ${record.stars}/3${Number.isFinite(record.bestTime) ? ` · ${record.bestTime.toFixed(1)}s` : ""}`
      : "";
    return `${challenge.shareCode} · Pilot ${this.getFrontierPilotName()} · ${challenge.label}${proof}`;
  }

  getFrontierPilotName() {
    const profile = this.getActiveCadetProfile ? this.getActiveCadetProfile() : null;
    const raw = (profile && (profile.name || profile.callsign)) || "Cadet";
    return String(raw).replace(/[^\w .-]/g, "").trim().slice(0, 24) || "Cadet";
  }

  planetNameFromFrontierCode(shareCode) {
    const code = String(shareCode || "").split("-")[1] || "";
    if (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) {
      const planet = PLANETS.find(p =>
        p && p.name && p.name.split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "") === code
      );
      if (planet) return planet.name;
    }
    return code ? code.charAt(0) + code.slice(1).toLowerCase() : "Frontier world";
  }

  normalizeFrontierBoardEntry(entry) {
    const record = this.normalizeFrontierRecord(entry);
    if (!record || !record.shareCode) return null;
    const pilot = String((entry && (entry.pilot || entry.name)) || "Classmate")
      .replace(/[^\w .-]/g, "")
      .trim()
      .slice(0, 24) || "Classmate";
    return { ...record, pilot };
  }

  parseFrontierShareText(text, fallbackPilot = "Classmate") {
    const raw = String(text || "").trim();
    const codeMatch = raw.match(/\b(FRONTIER-[A-Z]+-\d{4})\b/i);
    if (!codeMatch) return null;
    const shareCode = codeMatch[1].toUpperCase();
    const tierMatch = raw.match(/\bTier\s+(\d+)\b/i);
    const starsMatch = raw.match(/\b([0-3])\s*\/\s*3\b/i);
    const timeMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*s\b/i);
    const dateMatch = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const pilotMatch = raw.match(/\bPilot\s+([^·|]+)/i);
    const labelMatch = raw.match(/\bTier\s+\d+\s+([^:·|]+)(?::\s*([^·|]+))?/i);
    return this.normalizeFrontierBoardEntry({
      dateStr: dateMatch ? dateMatch[1] : this.getTodayDateStr(),
      shareCode,
      tier: tierMatch ? Number(tierMatch[1]) : 1,
      planetName: labelMatch && labelMatch[1] ? labelMatch[1].trim() : this.planetNameFromFrontierCode(shareCode),
      variantLabel: labelMatch && labelMatch[2] ? labelMatch[2].replace(/\bbest\b.*$/i, "").trim() : "seeded remix",
      stars: starsMatch ? Number(starsMatch[1]) : 0,
      bestTime: timeMatch ? Number(timeMatch[1]) : null,
      pilot: pilotMatch && pilotMatch[1] ? pilotMatch[1].trim() : fallbackPilot
    });
  }

  importFrontierShareText(text, fallbackPilot = "Classmate") {
    const entry = this.parseFrontierShareText(text, fallbackPilot);
    if (!entry) return { entry: null, isNewBest: false, error: "No Frontier share code found" };
    this.frontierBoard = this.frontierBoard || {};
    const previous = this.frontierBoard[entry.shareCode];
    const isNewBest = !previous || this.isFrontierRecordBetter(entry, previous);
    if (isNewBest) this.frontierBoard[entry.shareCode] = entry;
    if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === this) saveLocalProgress();
    return { entry: this.normalizeFrontierBoardEntry(this.frontierBoard[entry.shareCode] || entry), isNewBest };
  }

  getFrontierBoardList(limit = 5) {
    return Object.values(this.frontierBoard || {})
      .map(entry => this.normalizeFrontierBoardEntry(entry))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier;
        if (b.stars !== a.stars) return b.stars - a.stars;
        const at = Number.isFinite(a.bestTime) ? a.bestTime : Infinity;
        const bt = Number.isFinite(b.bestTime) ? b.bestTime : Infinity;
        if (at !== bt) return at - bt;
        return String(a.pilot).localeCompare(String(b.pilot));
      })
      .slice(0, limit);
  }

  getFrontierRivalTarget(frontier = null) {
    const challenge = frontier || this.getFrontierChallenge();
    if (!challenge || !challenge.shareCode) return null;
    const rivals = Object.values(this.frontierBoard || {})
      .map(entry => this.normalizeFrontierBoardEntry(entry))
      .filter(entry => entry && entry.shareCode === challenge.shareCode)
      .sort((a, b) => this.compareFrontierRecords(b, a));
    const leader = rivals[0] || null;
    if (!leader) {
      return {
        state: "empty",
        label: "Paste today's Frontier line to create a rival target.",
        entry: null,
        local: null
      };
    }
    const local = this.normalizeFrontierRecord((this.frontierRecords || {})[challenge.dateStr]);
    if (local && this.compareFrontierRecords(local, leader) >= 0) {
      return {
        state: "leading",
        label: `You lead ${leader.pilot}. Share your Frontier code so classmates can chase it.`,
        entry: leader,
        local
      };
    }
    const timeText = Number.isFinite(leader.bestTime) ? ` under ${leader.bestTime.toFixed(1)}s` : "";
    const label = `Beat ${leader.pilot}: clear T${leader.tier} with ${leader.stars}/3 stars${timeText}.`;
    return {
      state: "chase",
      label,
      entry: leader,
      local
    };
  }

  getFrontierRivalClearResult({ frontierInfo = this.dailyInfo, labStars = null, clearTime = null } = {}) {
    const challenge = frontierInfo || this.dailyInfo;
    if (!challenge || !challenge.isFrontier || !challenge.shareCode) return null;
    const rivals = Object.values(this.frontierBoard || {})
      .map(entry => this.normalizeFrontierBoardEntry(entry))
      .filter(entry => entry && entry.shareCode === challenge.shareCode)
      .sort((a, b) => this.compareFrontierRecords(b, a));
    const leader = rivals[0] || null;
    if (!leader) return null;

    const planet = (typeof PLANETS !== 'undefined' && PLANETS[challenge.planetIndex]) || null;
    const local = this.normalizeFrontierRecord({
      dateStr: challenge.dateStr || this.getTodayDateStr(),
      shareCode: challenge.shareCode,
      tier: challenge.tier || 1,
      planetIndex: challenge.planetIndex,
      planetName: planet ? planet.name : "Frontier world",
      variantLabel: challenge.variant ? challenge.variant.variantLabel : "",
      stars: labStars ? labStars.stars : 0,
      bestTime: clearTime ? clearTime.elapsed : null
    });
    if (!local) return null;

    const comparison = this.compareFrontierRecords(local, leader);
    const state = comparison > 0 ? "beaten" : (comparison === 0 ? "matched" : "behind");
    const localTime = Number.isFinite(local.bestTime) ? ` · ${local.bestTime.toFixed(1)}s` : "";
    const targetTime = Number.isFinite(leader.bestTime) ? ` · ${leader.bestTime.toFixed(1)}s` : "";
    const pilot = leader.pilot || "classmate";
    const label = state === "beaten"
      ? `RIVAL BEATEN: ${pilot}`
      : (state === "matched" ? `RIVAL MATCHED: ${pilot}` : `RIVAL AHEAD: ${pilot}`);
    const body = state === "behind"
      ? `${pilot} still leads with ${leader.stars}/3 Lab Stars${targetTime}. Replay one focused variable and chase the proof target.`
      : `Your ${local.stars}/3 Lab Stars${localTime} reached the class target from ${pilot} (${leader.stars}/3${targetTime}). Share your updated Frontier line.`;

    return {
      state,
      label,
      body,
      monitorText: `${label} · ${local.stars}/3${localTime}`,
      local,
      entry: leader,
      shareCode: challenge.shareCode
    };
  }

  getFrontierRivalProofSourceKey(result, stateOverride = null) {
    if (!result || !result.entry) return "";
    const state = stateOverride || result.state || "rival";
    const entry = result.entry || {};
    const clean = (value, fallback = "x") => {
      const text = String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return text || fallback;
    };
    const share = clean(result.shareCode || entry.shareCode, "frontier");
    const pilot = clean(entry.pilot || "classmate", "classmate");
    const tier = Math.max(1, Math.floor(Number(entry.tier) || 1));
    const stars = Math.max(0, Math.min(3, Math.floor(Number(entry.stars) || 0)));
    const time = Number.isFinite(entry.bestTime) ? String(Math.round(entry.bestTime * 10)) : "notime";
    return `frontier-rival:${state}:${share}:${pilot}:t${tier}:s${stars}:time${time}`;
  }

  getFrontierRivalProofRewards(result) {
    const entry = (result && result.entry) || {};
    const local = (result && result.local) || {};
    const tier = Math.max(1, Math.floor(Number(entry.tier || local.tier) || 1));
    const tierBonusXP = Math.min(6, Math.max(0, tier - 1));
    const beaten = result && result.state === "beaten";
    const baseRewardXP = beaten ? 8 : 5;
    const baseMasteryXP = beaten ? 12 : 8;
    return {
      tier,
      tierBonusXP,
      rewardXP: baseRewardXP + tierBonusXP,
      masteryXP: baseMasteryXP + tierBonusXP * 2
    };
  }

  getFrontierRivalMilestoneSourceKey(proofCount) {
    const count = Math.max(1, Math.floor(Number(proofCount) || 1));
    return `frontier-rival-ladder:${count}`;
  }

  getFrontierRivalProofCount() {
    const counts = this.discoveryPassCounts && typeof this.discoveryPassCounts === 'object'
      ? this.discoveryPassCounts
      : {};
    return Object.keys(counts).filter(key => /^frontier-rival:(beaten|matched):/.test(key) && counts[key]).length;
  }

  getNextFrontierRivalMilestone(proofCount = this.getFrontierRivalProofCount()) {
    const count = Math.max(0, Math.floor(Number(proofCount) || 0));
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    return FRONTIER_RIVAL_MILESTONES.find(milestone =>
      milestone && count >= milestone.proofs && !this.discoveryPassCounts[this.getFrontierRivalMilestoneSourceKey(milestone.proofs)]
    ) || null;
  }

  getFrontierRivalLadderProgress(proofCount = this.getFrontierRivalProofCount()) {
    const count = Math.max(0, Math.floor(Number(proofCount) || 0));
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const next = FRONTIER_RIVAL_MILESTONES.find(milestone =>
      milestone && !this.discoveryPassCounts[this.getFrontierRivalMilestoneSourceKey(milestone.proofs)]
    ) || null;
    if (!next) {
      const finalMilestone = FRONTIER_RIVAL_MILESTONES[FRONTIER_RIVAL_MILESTONES.length - 1] || null;
      return {
        complete: true,
        proofCount: count,
        label: "RIVAL LADDER COMPLETE",
        title: finalMilestone ? finalMilestone.title : "Frontier Rival Ladder",
        remaining: 0,
        rewardXP: 0,
        milestoneProofs: finalMilestone ? finalMilestone.proofs : count
      };
    }
    return {
      complete: false,
      proofCount: count,
      label: next.label,
      title: next.title,
      remaining: Math.max(0, next.proofs - count),
      rewardXP: next.rewardXP,
      milestoneProofs: next.proofs
    };
  }

  grantFrontierRivalMilestone(pulse = null, proof = null) {
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const proofCount = this.getFrontierRivalProofCount();
    const milestone = this.getNextFrontierRivalMilestone(proofCount);
    if (!milestone) return null;

    const sourceKey = this.getFrontierRivalMilestoneSourceKey(milestone.proofs);
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(milestone.masteryXP, "frontier rival ladder", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }

    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + milestone.rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const result = {
      label: milestone.label,
      title: milestone.title,
      rewardXP: milestone.rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      proofCount,
      milestoneProofs: milestone.proofs,
      body: milestone.body
    };

    if (pulse) {
      pulse.frontierRivalMilestone = result;
      pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + milestone.rewardXP);
      pulse.worldMasteryAddedXP = Math.max(0, (pulse.worldMasteryAddedXP || 0) + result.worldMasteryAddedXP);
      pulse.insight = `${pulse.insight} ${milestone.body}`;
      if (rankUp) {
        pulse.rankUp = true;
        pulse.rankTitle = afterRank ? afterRank.title : null;
        pulse.rankPerk = afterRank ? afterRank.perk : null;
      }
    }
    if (proof) proof.frontierRivalMilestone = result;

    if (typeof ui_log_output === 'function') {
      const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`${milestone.title}: +${milestone.rewardXP} Research XP${masteryText}.`, "success");
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (this.player.w || 24) / 2;
      const py = Number.isFinite(this.player.y) ? this.player.y : 0;
      ComicBubbles.pop(px, py - 74, milestone.pop, milestone.color, 1.0);
      ComicBubbles.pop(px, py - 55, `${proofCount} RIVAL PROOFS`, "#a7f3d0", 0.72);
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(px, py - 8, milestone.color, 16, 2.4, 2.2, "glow");
        Particles.spawnBurst(px, py - 8, "#a7f3d0", 10, 1.8, 1.7, "glow");
      }
    }
    if (rankUp && typeof showBadgeToast === 'function' && afterRank) {
      showBadgeToast({
        icon: "FR",
        label: `Research Rank: ${afterRank.title}`,
        description: `${milestone.title} unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && pulse && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    return result;
  }

  grantFrontierRivalProof(result) {
    if (!result || (result.state !== "beaten" && result.state !== "matched")) return null;
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    const sourceKey = this.getFrontierRivalProofSourceKey(result);
    if (!sourceKey) return null;
    if (this.discoveryPassCounts[sourceKey]) return null;
    if (result.state === "matched") {
      const beatenKey = this.getFrontierRivalProofSourceKey(result, "beaten");
      if (beatenKey && this.discoveryPassCounts[beatenKey]) return null;
      if (beatenKey && typeof this.normalizeWorldMasteryMeter === 'function') {
        const meter = this.normalizeWorldMasteryMeter(this.currentPlanetIndex);
        if (meter && meter.sources && meter.sources[beatenKey]) return null;
      }
    }

    const proofRewards = this.getFrontierRivalProofRewards(result);
    const rewardXP = proofRewards.rewardXP;
    const masteryXP = proofRewards.masteryXP;
    const label = result.state === "beaten" ? "RIVAL PROOF" : "RIVAL MATCH";
    const pilot = result.entry && result.entry.pilot ? result.entry.pilot : "classmate";
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, "frontier rival proof", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }

    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const proof = {
      label,
      title: result.state === "beaten" ? "Frontier Rival Beaten" : "Frontier Rival Matched",
      rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      state: result.state,
      pilot,
      tier: proofRewards.tier,
      tierBonusXP: proofRewards.tierBonusXP,
      masteryXP,
      shareCode: result.shareCode || ""
    };
    result.rivalProof = proof;
    result.monitorText = `${result.monitorText || result.label} · +${rewardXP} Research XP`;
    result.body = `${result.body} Rival proof banked: +${rewardXP} Research XP for a Tier ${proof.tier} target.`;

    const pulse = {
      kind: "frontier",
      title: proof.title,
      formula: "rival proof = same seed + tier + stars + time",
      insight: `${pilot}'s Tier ${proof.tier} Frontier line became a measurable target. Same seed, same rules, better evidence proves the improvement.`,
      cue: "Share the updated Frontier line, then chase the next rival with one variable at a time.",
      missionId: sourceKey,
      missionTitle: "Frontier Challenge",
      passed: 1,
      total: 1,
      progressLabel: result.state === "beaten" ? `beat ${pilot}` : `matched ${pilot}`,
      openedGems: 0,
      rewardXP,
      combo: this.discoveryCombo || 0,
      worldMasteryAddedXP: proof.worldMasteryAddedXP,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      frontierRivalProof: proof
    };
    const rivalMilestone = this.grantFrontierRivalMilestone(pulse, proof);
    if (rivalMilestone) {
      result.rivalMilestone = rivalMilestone;
      result.monitorText = `${result.monitorText} · ${rivalMilestone.label} +${rivalMilestone.rewardXP} XP`;
      result.body = `${result.body} ${rivalMilestone.title}: ${rivalMilestone.body}`;
    }
    const previewRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : afterRank;
    if (previewRank && typeof getResearchUnlockPreview === 'function') {
      pulse.nextLabUnlock = getResearchUnlockPreview(previewRank);
    }
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);
    if (rankUp && typeof showBadgeToast === 'function' && afterRank) {
      showBadgeToast({
        icon: "FR",
        label: `Research Rank: ${afterRank.title}`,
        description: `Frontier rival proof unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    if (typeof ui_log_output === 'function') {
      const masteryText = proof.worldMasteryAddedXP > 0 ? `, +${proof.worldMasteryAddedXP} world mastery XP` : "";
      ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.`, "success");
    }
    return proof;
  }

  spawnFrontierRivalClearEffect(result) {
    if (!result || (result.state !== "beaten" && result.state !== "matched")) return null;
    const px = this.player
      ? (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2
      : 0;
    const py = this.player
      ? (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2
      : 0;
    const color = result.state === "beaten" ? "#facc15" : "#c4b5fd";
    const label = result.state === "beaten" ? "RIVAL BEATEN!" : "RIVAL MATCHED!";
    const effect = {
      label,
      state: result.state,
      pilot: result.entry ? result.entry.pilot : "",
      shareCode: result.shareCode || "",
      rivalProof: result.rivalProof || null,
      x: px,
      y: py
    };
    this.lastFrontierRivalEffect = effect;
    if (typeof ui_log_output === 'function') {
      ui_log_output(`${label} ${result.body}`, "success");
    }
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, py - 36, label, color, 1.12);
      if (result.rivalProof && result.rivalProof.rewardXP) {
        ComicBubbles.pop(px, py - 18, `+${result.rivalProof.rewardXP} RESEARCH`, "#a7f3d0", 0.76);
      }
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 6, color, 18, 2.8, 2.4, "glow");
      Particles.spawnBurst(px, py - 6, "#67e8f9", 8, 1.9, 1.8, "glow");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(result.monitorText, {
        title: "FRONTIER CRT",
        color,
        timer: 300
      });
    }
    return effect;
  }

  escapeFrontierHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  refreshFrontierBoard() {
    if (typeof document === 'undefined') return;
    const board = document.getElementById('frontier-board');
    if (!board) return;
    const challenge = this.getFrontierChallenge();
    if (!challenge) {
      board.style.display = 'none';
      return;
    }
    const list = document.getElementById('frontier-board-list');
    const entries = this.getFrontierBoardList(4);
    if (list) {
      list.innerHTML = entries.length
        ? entries.map(entry => {
          const time = Number.isFinite(entry.bestTime) ? ` · ${entry.bestTime.toFixed(1)}s` : "";
          return `<span><strong>${this.escapeFrontierHTML(entry.pilot)}</strong> T${entry.tier} · ${entry.stars}/3${time} · ${this.escapeFrontierHTML(entry.shareCode)}</span>`;
        }).join("")
        : "<span>Paste a classmate's Frontier line to start a local board.</span>";
    }
    const rival = this.getFrontierRivalTarget(challenge);
    const rivalCopy = document.getElementById('frontier-rival-copy');
    const rivalBtn = document.getElementById('frontier-rival-btn');
    const rivalBox = document.getElementById('frontier-rival-target');
    if (rivalBox && rivalBox.classList) {
      rivalBox.classList.toggle('is-chase', !!rival && rival.state === 'chase');
      rivalBox.classList.toggle('is-leading', !!rival && rival.state === 'leading');
    }
    if (rivalCopy) {
      const ladder = typeof this.getFrontierRivalLadderProgress === 'function'
        ? this.getFrontierRivalLadderProgress()
        : null;
      const ladderText = ladder
        ? (ladder.complete
          ? ` · Ladder complete: ${ladder.proofCount} rival proofs`
          : ` · Ladder: ${ladder.remaining} proof${ladder.remaining === 1 ? "" : "s"} to ${ladder.label} (+${ladder.rewardXP} XP)`)
        : "";
      rivalCopy.textContent = `${rival ? rival.label : "Paste today's Frontier line to create a rival target."}${ladderText}`;
    }
    if (rivalBtn) {
      rivalBtn.style.display = rival && rival.state === 'chase' ? 'inline-flex' : 'none';
    }
    board.style.display = 'grid';
  }

  importFrontierBoardFromInput() {
    if (typeof document === 'undefined') return false;
    const input = document.getElementById('frontier-board-input');
    if (!input) return false;
    const result = this.importFrontierShareText(input.value);
    if (!result.entry) {
      if (typeof ui_log_output === 'function') ui_log_output(result.error || "No Frontier share code found.", "error");
      return false;
    }
    input.value = "";
    this.refreshFrontierBoard();
    if (typeof ui_log_output === 'function') {
      ui_log_output(`Frontier Board added ${result.entry.pilot}: ${result.entry.shareCode}`, result.isNewBest ? "success" : "info");
    }
    return true;
  }

  copyFrontierShareCode() {
    const text = this.getFrontierShareText();
    if (!text) return false;
    const done = () => {
      this.spawnFrontierShareEffect(text, { copied: true });
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        this.spawnFrontierShareEffect(text, { copied: false });
      });
      return true;
    }
    this.spawnFrontierShareEffect(text, { copied: false });
    return false;
  }

  spawnFrontierShareEffect(text, options = {}) {
    const shareText = String(text || "").trim();
    if (!shareText) return null;
    const copied = !!options.copied;
    const match = shareText.match(/\b(FRONTIER-[A-Z]+-\d{4})\b/i);
    const shareCode = match ? match[1].toUpperCase() : "";
    const label = copied ? "FRONTIER COPIED!" : "SHARE READY!";
    const monitorText = copied
      ? "FRONTIER LINE COPIED: send it to a classmate"
      : "FRONTIER LINE READY: copy it for a classmate";
    const px = this.player
      ? (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2
      : 0;
    const py = this.player
      ? (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2
      : 0;
    const effect = { label, monitorText, shareCode, text: shareText, copied, x: px, y: py };
    this.lastFrontierShareEffect = effect;

    if (typeof ui_log_output === 'function') {
      ui_log_output(copied ? `Frontier code ready to share: ${shareText}` : shareText, copied ? "success" : "info");
    }
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, py - 44, label, copied ? "#facc15" : "#c4b5fd", 1.04);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 8, copied ? "#facc15" : "#c4b5fd", 14, 2.4, 2.1, "glow");
      Particles.spawnBurst(px, py - 8, "#67e8f9", 6, 1.8, 1.6, "glow");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(monitorText, {
        title: "FRONTIER CRT",
        color: copied ? "#facc15" : "#c4b5fd",
        timer: 260
      });
    }
    return effect;
  }

  refreshFrontierRecordBanner(frontier = null) {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('frontier-record-banner');
    if (!banner) return;
    const label = document.getElementById('frontier-record-label');
    const detail = document.getElementById('frontier-record-detail');
    const shareBtn = document.getElementById('frontier-share-btn');
    const challenge = frontier || this.getFrontierChallenge();
    if (!challenge) {
      banner.style.display = 'none';
      this.refreshFrontierBoard();
      return;
    }
    const summary = this.getFrontierRecordSummary(challenge.dateStr);
    const today = summary.today;
    const best = summary.best;
    const bestText = best
      ? `Best T${best.tier} · ${best.stars}/3 stars${Number.isFinite(best.bestTime) ? ` · ${best.bestTime.toFixed(1)}s` : ""}`
      : "No local clear yet";
    if (label) {
      label.textContent = today
        ? `Today's frontier cleared · T${today.tier} · ${today.stars}/3 stars${Number.isFinite(today.bestTime) ? ` · ${today.bestTime.toFixed(1)}s` : ""}`
        : `Frontier ready · ${challenge.shareCode}`;
    }
    if (detail) {
      detail.textContent = `${bestText}${summary.count ? ` · ${summary.count} recorded` : ""}`;
    }
    if (shareBtn) {
      shareBtn.textContent = 'COPY CODE';
      shareBtn.title = this.getFrontierShareText(challenge);
    }
    banner.style.display = 'flex';
    this.refreshFrontierBoard();
  }

  // Keep the start screen's signal strip current (called at init and after clears).
  refreshDailySignalBanner() {
    const label = document.getElementById('daily-signal-label');
    const dailyCode = document.getElementById('daily-signal-code');
    const dailyBtn = document.getElementById('daily-signal-btn');
    const frontierCode = document.getElementById('frontier-signal-code');
    const frontierBtn = document.getElementById('frontier-signal-btn');
    if (!label) return;
    const daily = this.getDailySignal();
    if (!daily) return;
    const dailyPlanet = daily.planetName || (typeof PLANETS !== 'undefined' && PLANETS[daily.planetIndex] ? PLANETS[daily.planetIndex].name : "World");
    const dailyConcept = daily.concept || (typeof PLANETS !== 'undefined' && PLANETS[daily.planetIndex] ? PLANETS[daily.planetIndex].tagline : "Physics remix");
    const dailyVariant = daily.variant && daily.variant.variantLabel ? daily.variant.variantLabel : daily.label;
    const dailyFocus = daily.labContract && daily.labContract.title ? ` · Focus: ${daily.labContract.title}` : "";
    const dailyGoal = daily.labGoal || "3 Lab Stars: tasks + samples + proof";
    const dailyCommand = daily.labContract && daily.labContract.command ? String(daily.labContract.command).trim() : "";
    const dailyFirstCommand = dailyCommand.split(/\n/).map(line => line.trim()).find(Boolean) || "";
    label.textContent = `📡 Daily Signal ${daily.dateStr} — ${dailyPlanet}: ${dailyConcept} · ${dailyVariant}${dailyFocus}`;
    if (dailyCode) {
      dailyCode.textContent = dailyFirstCommand ? `3★ Try: ${dailyFirstCommand}` : `3★ ${dailyGoal}`;
      dailyCode.title = dailyFirstCommand
        ? `${dailyGoal} · Full contract: ${dailyCommand}`
        : dailyGoal;
      if (dailyCode.style) dailyCode.style.display = "inline-block";
    }
    if (dailyBtn) {
      dailyBtn.textContent = "▶ ACCEPT";
      dailyBtn.title = dailyFirstCommand
        ? `Start today's Daily Signal. ${dailyGoal}. Try: ${dailyFirstCommand}`
        : `Start today's Daily Signal. ${dailyGoal}.`;
      if (dailyBtn.dataset) {
        dailyBtn.dataset.goal = dailyGoal;
        dailyBtn.dataset.focus = daily.labContract && daily.labContract.title ? daily.labContract.title : "";
        dailyBtn.dataset.command = dailyFirstCommand;
      }
    }
    const frontier = this.getFrontierChallenge();
    const frontierContract = frontier && frontier.labContract ? frontier.labContract : null;
    const frontierGoal = frontier && frontier.labGoal ? frontier.labGoal : "3 Lab Stars: tasks + samples + proof";
    const frontierCommand = frontierContract && frontierContract.command ? String(frontierContract.command).trim() : "";
    const frontierFirstCommand = frontierCommand.split(/\n/).map(line => line.trim()).find(Boolean) || "";
    if (frontierCode) {
      if (frontier) {
        frontierCode.textContent = frontierFirstCommand ? `Frontier 3★ Try: ${frontierFirstCommand}` : `Frontier 3★ ${frontierGoal}`;
        frontierCode.title = frontierFirstCommand
          ? `${frontierGoal} · Full contract: ${frontierCommand}`
          : frontierGoal;
        if (frontierCode.style) frontierCode.style.display = "inline-block";
      } else {
        frontierCode.textContent = "";
        frontierCode.title = "";
        if (frontierCode.style) frontierCode.style.display = "none";
      }
    }
    if (frontierBtn) {
      frontierBtn.style.display = frontier ? 'inline-flex' : 'none';
      frontierBtn.textContent = frontier ? `◆ FRONTIER T${frontier.tier}` : '◆ FRONTIER';
      const frontierFocus = frontierContract ? ` · Focus: ${frontierContract.title} · Try: ${frontierCommand}` : "";
      frontierBtn.title = frontier ? `${frontier.concept || "Physics remix"} · ${frontier.labGoal || "3 Lab Stars"} · ${frontier.label}${frontierFocus} · ${frontier.shareCode}` : 'Complete the star-map to unlock Frontier Challenge';
      if (frontierBtn.dataset) {
        frontierBtn.dataset.goal = frontier ? frontierGoal : "";
        frontierBtn.dataset.focus = frontierContract && frontierContract.title ? frontierContract.title : "";
        frontierBtn.dataset.command = frontierFirstCommand;
      }
    }
    this.refreshFrontierRecordBanner(frontier);
    if (typeof updateStartMissionRadar === 'function') updateStartMissionRadar(this);
  }

  // Single source of "today" in the browser's LOCAL calendar, not UTC. That matters in
  // US evening hours, where toISOString() has already rolled into tomorrow.
  getTodayDateStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getTomorrowDateStr(dateStr = this.getTodayDateStr()) {
    const match = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const base = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1)
      : new Date(Date.now() + 86400000);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
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

  getReturnStreakRewardXP(streakCount = this.streakCount) {
    const streak = Math.max(1, Math.floor(Number(streakCount) || 1));
    return RETURN_STREAK_RESEARCH_BASE_XP + Math.min(RETURN_STREAK_RESEARCH_CAP_BONUS_XP, Math.max(0, streak - 1));
  }

  getNextReturnStreakPreview() {
    const current = Math.max(0, Math.floor(Number(this.streakCount) || 0));
    const nextStreak = Math.max(2, current + 1);
    const rewardXP = this.getReturnStreakRewardXP(nextStreak);
    const dateStr = this.getTomorrowDateStr();
    const daily = typeof this.getDailySignalForDate === 'function'
      ? this.getDailySignalForDate(dateStr)
      : null;
    const contract = daily && daily.labContract ? daily.labContract : null;
    const focusTitle = (contract && contract.title) || (daily && daily.concept) || (daily && daily.planetName) || "";
    const focusSuffix = focusTitle ? ` · ${focusTitle}` : "";
    return {
      streak: nextStreak,
      rewardXP,
      dateStr,
      focusTitle,
      label: `Tomorrow's lab: +${rewardXP} Research XP${focusSuffix}`
    };
  }

  getReturnStreakDailyFocus() {
    const daily = typeof this.getDailySignal === 'function' ? this.getDailySignal() : null;
    const contract = daily && daily.labContract ? daily.labContract : null;
    const title = (contract && contract.title) || (daily && daily.concept) || (daily && daily.planetName) || "Daily Signal";
    const command = contract && contract.command ? String(contract.command).trim() : "";
    const firstCommand = command.split(/\n/).map(line => line.trim()).find(Boolean) || "";
    return {
      title,
      command,
      firstCommand,
      label: `Focus: ${title}`
    };
  }

  grantReturnStreakReward(previousDate, today) {
    if (!previousDate || previousDate === today) {
      this.lastReturnStreakReward = null;
      return null;
    }
    const streak = Math.max(1, Math.floor(Number(this.streakCount) || 1));
    const xp = this.getReturnStreakRewardXP(streak);
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    this.researchXP = Math.max(0, (this.researchXP || 0) + xp);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const pulse = {
      kind: "streak",
      title: "Daily Lab Streak",
      formula: "streak = one experiment each day",
      insight: `Day ${streak} keeps your lab habit warm. Come back, predict one thing, and test it.`,
      cue: "Use today's signal or a remix to compare one new result.",
      missionId: `streak-${today || this.getTodayDateStr()}`,
      missionTitle: "Daily Lab",
      passed: 0,
      total: 0,
      progressLabel: `streak day ${streak}`,
      openedGems: 0,
      rewardXP: xp,
      streakCount: streak,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null
    };
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);
    this.lastReturnStreakReward = pulse;
    if (typeof this.spawnReturnStreakEffect === 'function') {
      pulse.streakEffect = this.spawnReturnStreakEffect(pulse);
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(`Daily lab streak: +${xp} Research XP (day ${streak}).`, "success");
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
    if (rankUp && typeof showBadgeToast === 'function') {
      showBadgeToast({
        icon: "R",
        label: `Research Rank: ${afterRank.title}`,
        description: `Daily lab streak unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    return pulse;
  }

  // Roll the streak forward once per real-world day, then persist.
  updateReturnStreak() {
    const today = this.getTodayDateStr();
    if (this.lastPlayedDate === today) return;
    const previousDate = this.lastPlayedDate;
    this.streakCount = this.computeStreakIncrement();
    this.lastPlayedDate = today;
    this.grantReturnStreakReward(previousDate, today);
    if (typeof saveLocalProgress === 'function') saveLocalProgress();
    this.refreshStreakBanner();
  }

  // Show the celebratory streak chip on the start screen (hidden until there's a streak).
  refreshStreakBanner() {
    const banner = document.getElementById('return-streak-banner');
    if (!banner) return;
    const countEl = document.getElementById('return-streak-count');
    const rewardEl = document.getElementById('return-streak-reward');
    const focusEl = document.getElementById('return-streak-focus');
    const codeEl = document.getElementById('return-streak-code');
    const actionEl = document.getElementById('return-streak-action');
    if (this.streakCount > 0) {
      const focus = this.getReturnStreakDailyFocus();
      if (countEl) countEl.textContent = this.streakCount;
      if (rewardEl) {
        const next = this.getNextReturnStreakPreview();
        rewardEl.textContent = this.lastReturnStreakReward
          ? `+${this.lastReturnStreakReward.rewardXP} Research XP today`
          : next.label;
        rewardEl.title = this.lastReturnStreakReward
          ? "Today already counted. Launch the Daily Signal to bank a proof."
          : `Come back on ${next.dateStr} for streak day ${next.streak}${next.focusTitle ? `: ${next.focusTitle}` : ""}.`;
        if (rewardEl.classList && typeof rewardEl.classList.toggle === 'function') {
          rewardEl.classList.toggle("earned", !!this.lastReturnStreakReward);
          rewardEl.classList.toggle("up-next", !this.lastReturnStreakReward);
        }
      }
      if (focusEl) focusEl.textContent = focus.label;
      if (codeEl) {
        codeEl.textContent = focus.firstCommand;
        codeEl.title = focus.firstCommand ? `Starter command: ${focus.firstCommand}` : "";
        if (codeEl.style) codeEl.style.display = focus.firstCommand ? "inline-block" : "none";
      }
      if (actionEl) {
        actionEl.textContent = "DAILY";
        actionEl.title = focus.firstCommand
          ? `Start today's Daily Signal: ${focus.title} · Try: ${focus.firstCommand}`
          : `Start today's Daily Signal: ${focus.title}`;
        if (actionEl.dataset) {
          actionEl.dataset.action = "daily";
          actionEl.dataset.focus = focus.title;
          actionEl.dataset.command = focus.firstCommand;
        }
        if (actionEl.style) actionEl.style.display = "inline-flex";
      }
      banner.style.display = 'flex';
    } else {
      if (rewardEl) {
        rewardEl.textContent = "";
        rewardEl.title = "";
        if (rewardEl.classList && typeof rewardEl.classList.remove === 'function') {
          rewardEl.classList.remove("earned", "up-next");
        }
      }
      if (focusEl) focusEl.textContent = "";
      if (codeEl) {
        codeEl.textContent = "";
        codeEl.title = "";
        if (codeEl.style) codeEl.style.display = "none";
      }
      if (actionEl) {
        if (actionEl.dataset) {
          actionEl.dataset.focus = "";
          actionEl.dataset.command = "";
        }
        if (actionEl.style) actionEl.style.display = "none";
      }
      banner.style.display = 'none';
    }
  }

  isPlanetUnlockedOnMap(index) {
    if (index === 0) return true;
    const clears = this.planetClears || {};
    if ((clears[index] || 0) > 0) return true;
    if ((clears[index - 1] || 0) > 0) return true;
    if (index === 5 && this.purchasedTrades && this.purchasedTrades.has('map_1')) return true;
    return false;
  }

  getPlanetLabStarCount(index) {
    const raw = this.bestLabStars ? Number(this.bestLabStars[index]) : 0;
    return Math.max(0, Math.min(3, Number.isFinite(raw) ? Math.floor(raw) : 0));
  }

  normalizeWorldMasteryMeter(index = this.currentPlanetIndex) {
    const key = String(index || 0);
    this.masteryMeters = this.masteryMeters || {};
    const raw = this.masteryMeters[key] || this.masteryMeters[index] || {};
    const xp = Math.max(0, Math.floor(Number(raw.xp) || 0));
    const sources = raw.sources && typeof raw.sources === 'object' ? { ...raw.sources } : {};
    const badges = Array.isArray(raw.badges)
      ? raw.badges.slice()
      : WORLD_MASTERY_TIERS.filter(tier => xp >= tier.xp).map(tier => tier.id);
    const normalized = { ...raw, xp, sources, badges: Array.from(new Set(badges)) };
    this.masteryMeters[key] = normalized;
    if (key !== String(index) && this.masteryMeters[index]) delete this.masteryMeters[index];
    return normalized;
  }

  getWorldMasteryProgress(index = this.currentPlanetIndex) {
    const meter = this.normalizeWorldMasteryMeter(index);
    const earnedTiers = WORLD_MASTERY_TIERS.filter(tier => meter.badges.includes(tier.id) || meter.xp >= tier.xp);
    const nextTier = WORLD_MASTERY_TIERS.find(tier => meter.xp < tier.xp) || null;
    const currentTier = earnedTiers.length ? earnedTiers[earnedTiers.length - 1] : null;
    const finalTier = WORLD_MASTERY_TIERS[WORLD_MASTERY_TIERS.length - 1];
    return {
      xp: meter.xp,
      badges: meter.badges.slice(),
      earnedTiers,
      currentTier,
      nextTier,
      title: currentTier ? currentTier.label : "Unranked",
      pct: finalTier ? Math.max(0, Math.min(100, Math.round((meter.xp / finalTier.xp) * 100))) : 0
    };
  }

  awardWorldMasteryXP(amount, reason = "practice", options = {}) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return { addedXP: 0, tierAwards: [], duplicate: false, progress: this.getWorldMasteryProgress(options.index) };
    const index = Number.isFinite(options.index) ? options.index : this.currentPlanetIndex;
    const key = String(index || 0);
    const meter = this.normalizeWorldMasteryMeter(index);
    const sourceKey = options.sourceKey ? String(options.sourceKey) : null;
    if (sourceKey && meter.sources[sourceKey]) {
      return { addedXP: 0, tierAwards: [], duplicate: true, progress: this.getWorldMasteryProgress(index) };
    }

    const beforeXP = meter.xp;
    meter.xp += add;
    if (sourceKey) meter.sources[sourceKey] = add;
    const tierAwards = [];
    for (const tier of WORLD_MASTERY_TIERS) {
      if (beforeXP < tier.xp && meter.xp >= tier.xp && !meter.badges.includes(tier.id)) {
        meter.badges.push(tier.id);
        tierAwards.push(tier);
      }
    }
    this.masteryMeters[key] = meter;

    if (tierAwards.length) {
      this.earnedBadges = this.earnedBadges || new Set();
      tierAwards.forEach(tier => this.earnedBadges.add(`world-${key}-${tier.id}`));
      const topTier = tierAwards[tierAwards.length - 1];
      if (typeof showBadgeToast === 'function') {
        showBadgeToast({
          icon: "🏅",
          label: topTier.label,
          description: `${this.currentPlanet ? this.currentPlanet.name : "World"} mastery reached ${meter.xp} XP.`
        });
      }
      if (typeof ui_log_output === 'function') {
        ui_log_output(`World mastery: ${topTier.label} unlocked (${meter.xp} XP).`, "success");
      }
    } else if (!options.silent && typeof ui_log_output === 'function') {
      ui_log_output(`World mastery +${add} XP: ${reason}.`, "success");
    }

    return {
      addedXP: add,
      tierAwards,
      duplicate: false,
      tierEffect: tierAwards.length && typeof this.spawnWorldMasteryTierEffect === 'function'
        ? this.spawnWorldMasteryTierEffect(tierAwards[tierAwards.length - 1], meter.xp)
        : null,
      xpEffect: !tierAwards.length && typeof this.spawnWorldMasteryXPEffect === 'function'
        ? this.spawnWorldMasteryXPEffect(add, reason, this.getWorldMasteryProgress(index))
        : null,
      progress: this.getWorldMasteryProgress(index)
    };
  }

  renderMapStarMeter(index) {
    const stars = this.getPlanetLabStarCount(index);
    const icons = Array.from({ length: 3 }, (_, i) =>
      `<span class="${i < stars ? "earned" : ""}" aria-hidden="true">★</span>`
    ).join("");
    return `<span class="map-star-meter" aria-label="${stars} of 3 Lab Stars">${icons}</span>`;
  }

  renderMapMasteryMeter(index) {
    const progress = this.getWorldMasteryProgress(index);
    const next = progress.nextTier ? `Next ${progress.nextTier.label}` : "Max tier";
    return `<span class="map-mastery-meter" aria-label="${progress.xp} world mastery XP"><span style="width: ${progress.pct}%"></span></span><span class="map-mastery-label">${progress.title} · ${progress.xp} XP · ${next}</span>`;
  }

  renderMapVillageTrustMeter(index) {
    if (typeof this.getVillageTrustProgress !== 'function') return "";
    const progress = this.getVillageTrustProgress(index);
    const next = progress.nextPact ? `Next ${progress.nextPact.title}` : "Max trust";
    return `<span class="map-trust-meter" aria-label="${progress.points} village trust"><span style="width: ${progress.pct}%"></span></span><span class="map-trust-label">${progress.title} · ${progress.points} trust · ${next}</span>`;
  }

  getMapAIStateTarget(index) {
    if (typeof getAIStateDeckProgress !== 'function' || typeof getAIStateDeckAction !== 'function') return null;
    const targetIndex = Number(index);
    if (!Number.isFinite(targetIndex)) return null;
    const progress = getAIStateDeckProgress(this);
    const card = progress && progress.nextCard ? progress.nextCard : null;
    const action = card ? getAIStateDeckAction(this, card.id) : null;
    const levelIndex = action ? Number(action.levelIndex) : NaN;
    if (!card || !action || !Number.isFinite(levelIndex) || levelIndex !== targetIndex) return null;
    return { progress, card, action };
  }

  getMapAIStateMastery(index) {
    if (typeof getAIStateDeckProgress !== 'function') return null;
    const targetIndex = Number(index);
    const currentIndex = Number(this.currentPlanetIndex);
    if (!Number.isFinite(targetIndex) || !Number.isFinite(currentIndex) || targetIndex !== currentIndex) return null;
    const progress = getAIStateDeckProgress(this);
    if (!progress || !progress.complete) return null;
    return progress;
  }

  renderMapAIStateChip(index, target = null) {
    const stateTarget = target || this.getMapAIStateTarget(index);
    if (!stateTarget) return "";
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value || "").replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    const label = stateTarget.action.label || "RUN STATE";
    return `<span class="map-ai-state-chip" aria-label="${safe(`AI State Deck next: ${stateTarget.card.title} - ${label}`)}"><strong>AI NEXT</strong><em>${safe(stateTarget.card.title)} · ${safe(label)}</em></span>`;
  }

  renderMapAIStateMasteryChip(index, progress = null) {
    const deck = progress || this.getMapAIStateMastery(index);
    if (!deck) return "";
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value || "").replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    return `<span class="map-ai-state-chip mastered" aria-label="${safe(`AI State Deck mastered: ${deck.earnedCount}/${deck.total} behavior states logged`)}"><strong>AI MASTERED</strong><em>${safe(`${deck.earnedCount}/${deck.total} states`)}</em></span>`;
  }

  getPlanetMapConcept(index) {
    const planets = (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) ? PLANETS : [];
    const planet = planets[index] || null;
    if (!planet) return "Science mission";
    return planet.tagline || "Science mission";
  }

  renderMapConceptChip(index) {
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value || "").replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    return `<span class="map-concept-chip">${safe(this.getPlanetMapConcept(index))}</span>`;
  }

  renderFutureLabMapSeedProgress(preferredStageId = null) {
    if (typeof this.getFutureLabRunProgress !== 'function') return "";
    let progress = null;
    try {
      progress = this.getFutureLabRunProgress(preferredStageId);
    } catch (err) {
      progress = null;
    }
    if (!progress || !Number.isFinite(progress.done) || !Number.isFinite(progress.total) || progress.total <= 0) return "";
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value || "").replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    const total = Math.max(1, Math.min(12, Math.floor(progress.total)));
    const done = Math.max(0, Math.min(total, Math.floor(progress.done)));
    const complete = done >= total;
    const nextTitle = progress.nextTitle || (complete ? "Source key ready" : "Next proof");
    const statuses = Array.isArray(progress.statuses) ? progress.statuses : [];
    const pips = Array.from({ length: total }).map((_, index) => {
      const rawStatus = statuses[index] && statuses[index].status ? statuses[index].status : (index < done ? "done" : (index === done ? "next" : "locked"));
      const status = rawStatus === "done" || rawStatus === "next" || rawStatus === "locked" ? rawStatus : "locked";
      return `<i class="${safe(status)}" aria-hidden="true"></i>`;
    }).join("");
    return `<span class="map-seed-progress"><b>${safe(`${done}/${total} seeds`)}</b><em>${safe(nextTitle)}</em><span class="map-seed-pips">${pips}</span></span>`;
  }

  getFutureLabRoadmapTarget(stageId = null) {
    if (typeof getFutureLabRoadmapStages !== 'function') return null;
    let stages = [];
    try {
      stages = getFutureLabRoadmapStages(this);
    } catch (err) {
      stages = [];
    }
    if (!Array.isArray(stages) || !stages.length) return null;
    const allDone = stages.every(stage => stage && stage.status === "done");
    const sourceTarget = typeof getFutureLabSourceRoadmapTarget === 'function'
      ? getFutureLabSourceRoadmapTarget(this, allDone)
      : null;
    const target = (stageId && stages.find(stage => stage && stage.id === stageId)) ||
      (stageId === "future-source-key" ? sourceTarget : null) ||
      stages.find(stage => stage && stage.status === "next") ||
      sourceTarget;
    if (!target || target.status === "locked" || target.status === "done") return null;
    return target;
  }

  getFutureLabMapActionForTeaser(teaserId) {
    if (typeof runFutureLabRoadmapAction !== 'function' || typeof this.getFutureLabRunProgress !== 'function') return null;
    const id = String(teaserId || "");
    const preferred = id === "quantum-gate" ? "quantum-branch" : "dark-matter-echo";
    const progress = this.getFutureLabRunProgress(preferred);
    const stageId = progress && progress.nextId ? String(progress.nextId) : "";
    const darkMatterStages = new Set(["dark-matter-echo", "hidden-force-trace", "dark-matter-evidence"]);
    const quantumStages = new Set(["quantum-branch", "quantum-chance", "future-source-key"]);
    if (id === "quantum-gate" && !quantumStages.has(stageId)) return null;
    if (id !== "quantum-gate" && !darkMatterStages.has(stageId)) return null;
    const target = this.getFutureLabRoadmapTarget(stageId);
    if (!target) return null;
    return {
      id: target.id,
      label: target.cta || "RUN SEED",
      title: target.title || "Future Lab seed",
      actionType: target.actionType || "future-lab"
    };
  }

  getFutureWorldTeaserState(teaserId) {
    const id = String(teaserId || "");
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value || "").replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    const storyComplete = typeof hasClearedFullStarMap === 'function'
      ? hasClearedFullStarMap(this)
      : (this.planetClears && [0, 1, 2, 3, 4, 5].every(index => Number(this.planetClears[index] || this.planetClears[String(index)] || 0) > 0));
    const frontierDecoded = typeof hasFrontierStoryCredit === 'function'
      ? hasFrontierStoryCredit(this)
      : !!(this.frontierRecords && Object.keys(this.frontierRecords).length > 0);
    const anomalyTraced = typeof hasAnomalyTraceStoryCredit === 'function'
      ? hasAnomalyTraceStoryCredit(this)
      : false;
    const darkMatterEvidence = typeof hasDarkMatterPrepEvidenceCredit === 'function'
      ? hasDarkMatterPrepEvidenceCredit(this)
      : false;
    const quantumSeeded = typeof hasQuantumBranchProofCredit === 'function'
      ? hasQuantumBranchProofCredit(this)
      : false;
    const quantumChanceSeeded = typeof hasQuantumChanceProofCredit === 'function'
      ? hasQuantumChanceProofCredit(this)
      : false;
    const concept = id === "quantum-gate"
      ? "Branching & probability"
      : "Infer hidden forces";
    const chip = `<span class="map-concept-chip">${safe(concept)}</span>`;
    const seedProgress = this.renderFutureLabMapSeedProgress(id === "quantum-gate" ? "quantum-branch" : "dark-matter-echo");
    const action = this.getFutureLabMapActionForTeaser(id);
    const actionHTML = action
      ? `<span class="map-seed-action">CLICK: ${safe(action.label)}</span>`
      : "";
    const suffix = `${seedProgress}${actionHTML}`;

    if (id === "quantum-gate") {
      if (quantumChanceSeeded) {
        return {
          className: "anomaly-decoded",
          metaHTML: `PROBABILITY SEED · ${chip}<span class="map-lock-hint">Future lab: chance paths</span>${suffix}`,
          title: "Quantum Gate: probability proof logged. The source lab has a chance seed for branching paths.",
          action
        };
      }
      if (quantumSeeded) {
        return {
          className: "anomaly-next",
          metaHTML: `CHANCE PREP · ${chip}<span class="map-lock-hint">Test chance(50)</span>${suffix}`,
          title: "Quantum Gate: branch proof logged. Test a chance branch to seed probability paths.",
          action
        };
      }
      if (darkMatterEvidence) {
        return {
          className: "anomaly-next",
          metaHTML: `QUANTUM PREP · ${chip}<span class="map-lock-hint">Test a branch condition</span>${suffix}`,
          title: "Quantum Gate: hidden-force evidence banked. Test one conditional branch to seed the probability lab.",
          action
        };
      }
      if (anomalyTraced) {
        return {
          className: "anomaly-decoded",
          metaHTML: `FORCE TRACED · ${chip}<span class="map-lock-hint">Next: bank curve evidence</span>${suffix}`,
          title: "Quantum Gate: hidden-force trace logged. Bank Dark Matter evidence before branching into probability.",
          action
        };
      }
      if (frontierDecoded) {
        return {
          className: "anomaly-waiting",
          metaHTML: `TRACE NEEDED · ${chip}<span class="map-lock-hint">Run Trace hidden force</span>${suffix}`,
          title: "Quantum Gate: echo decoded, but the hidden-force trace must be tested before the source opens.",
          action
        };
      }
      if (storyComplete) {
        return {
          className: "anomaly-waiting",
          metaHTML: `SOURCE LOCKED · ${chip}<span class="map-lock-hint">Decode Dark Matter Echo first</span>${suffix}`,
          title: "Quantum Gate: source locked. Clear a Frontier Challenge to triangulate the Dark Matter Echo first.",
          action
        };
      }
      return {
        className: "",
        metaHTML: `Signal source · ${chip}${suffix}`,
        title: "Quantum Gate - source of the signal. Concept: branching and probability.",
        action
      };
    }

    if (anomalyTraced) {
      return {
        className: "anomaly-decoded",
        metaHTML: `SOURCE TRACED · ${chip}<span class="map-lock-hint">Future lab: curve clues</span>${suffix}`,
        title: "Dark Matter Lab: hidden-force trace logged with a Mag-Net prototype. Future lab under construction.",
        action
      };
    }
    if (frontierDecoded) {
      return {
        className: "anomaly-decoded",
        metaHTML: `ECHO DECODED · ${chip}<span class="map-lock-hint">Next: Trace hidden force</span>${suffix}`,
        title: "Dark Matter Lab: Echo decoded. Run the Mag-Net trace prototype to prove hidden-force inference.",
        action
      };
    }
    if (storyComplete) {
      return {
        className: "anomaly-next",
        metaHTML: `ANOMALY · ${chip}<span class="map-lock-hint">Clear one Frontier Challenge</span>${suffix}`,
        title: "Dark Matter Lab: hidden-force anomaly detected. Clear one Frontier Challenge to decode the echo.",
        action
      };
    }
    return {
      className: "",
      metaHTML: `Transmission incoming · ${chip}${suffix}`,
      title: "Dark Matter Lab - something invisible is bending the signal. Concept: inferring hidden forces from motion.",
      action
    };
  }

  refreshFutureWorldTeasers() {
    if (typeof document === 'undefined') return;
    const teasers = Array.from(document.querySelectorAll('.planet-node.teaser[data-teaser]') || []);
    teasers.forEach((node) => {
      const state = this.getFutureWorldTeaserState(node.getAttribute('data-teaser'));
      const meta = node.querySelector('.mission-meta');
      node.classList.remove('anomaly-next', 'anomaly-waiting', 'anomaly-decoded', 'future-action');
      if (state.className) node.classList.add(state.className);
      const action = state.action || null;
      if (action) node.classList.add('future-action');
      node.disabled = !action;
      if (node.dataset) {
        node.dataset.futureActionId = action ? action.id : "";
        node.dataset.futureActionLabel = action ? action.label : "";
      }
      if (meta) meta.innerHTML = state.metaHTML;
      node.title = action
        ? `${state.title} Click to ${action.label}: ${action.title}.`
        : state.title;
    });
  }

  refreshGalaxyMapProgress() {
    if (typeof document === 'undefined') return;
    const planets = (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) ? PLANETS : [];
    const nodes = Array.from(document.querySelectorAll('.planet-node[data-level]') || []);
    nodes.forEach((node) => {
      const index = parseInt(node.getAttribute('data-level'), 10);
      if (!Number.isFinite(index) || !planets[index]) return;
      const available = this.isPlanetUnlockedOnMap(index);
      const clears = (this.planetClears && this.planetClears[index]) || 0;
      const mastered = !!(this.masteryCleared && this.masteryCleared[index]);
      const meta = node.querySelector('.mission-meta');
      node.classList.toggle('locked', !available);
      node.classList.toggle('current', available && index === this.currentPlanetIndex);
      node.classList.toggle('active-hover', available);
      node.classList.toggle('mastered', mastered);
      node.disabled = !available;
      const aiTarget = this.getMapAIStateTarget(index);
      const aiChip = this.renderMapAIStateChip(index, aiTarget);
      const aiMastery = this.getMapAIStateMastery(index);
      const aiMasteryChip = !aiTarget ? this.renderMapAIStateMasteryChip(index, aiMastery) : "";
      node.classList.toggle('ai-state-next', !!aiTarget);
      node.classList.toggle('ai-state-mastered', !!aiMastery && !aiTarget);
      if (meta) {
        const conceptChip = this.renderMapConceptChip(index);
        if (!available) {
          meta.innerHTML = `Locked · ${conceptChip}${aiChip}${aiMasteryChip}<span class="map-lock-hint">Recover previous shard</span>`;
        } else {
          const label = mastered ? "Mastered" : (clears > 0 ? `Clear ${clears}` : (index === 0 ? "Start" : "Unlocked"));
          meta.innerHTML = `${label} · ${conceptChip}${this.renderMapStarMeter(index)}${this.renderMapMasteryMeter(index)}${this.renderMapVillageTrustMeter(index)}${aiChip}${aiMasteryChip}`;
        }
      }
      const stars = this.getPlanetLabStarCount(index);
      const worldMastery = this.getWorldMasteryProgress(index);
      const villageTrust = this.getVillageTrustProgress(index);
      const concept = this.getPlanetMapConcept(index);
      const aiTitle = aiTarget ? ` · AI State: ${aiTarget.card.title} (${aiTarget.action.label || "RUN STATE"})` : "";
      const aiMasteryTitle = aiMastery && !aiTarget ? ` · AI State Deck mastered (${aiMastery.earnedCount}/${aiMastery.total})` : "";
      node.title = available
        ? `${planets[index].name}: ${concept} · ${stars}/3 Lab Stars · ${worldMastery.title} (${worldMastery.xp} XP) · ${villageTrust.title} (${villageTrust.points} trust)${aiTitle}${aiMasteryTitle}${mastered ? " · Mastered" : (clears > 0 ? " · Mastery Remix ready" : "")}`
        : `${planets[index].name}: locked. Next concept: ${concept}.${aiTitle}${aiMasteryTitle} Recover the previous signal shard.`;
    });
    this.refreshFutureWorldTeasers();
  }

  startMapPlanet(index) {
    const levelIndex = Number(index);
    if (!Number.isFinite(levelIndex)) return false;
    const aiTarget = this.getMapAIStateTarget(levelIndex);
    if (aiTarget && typeof runAIStateDeckAction === 'function') {
      return runAIStateDeckAction(aiTarget.card.id, this);
    }
    this.startLevel(levelIndex);
    return true;
  }

  startFutureWorldTeaser(teaserId) {
    const action = this.getFutureLabMapActionForTeaser(teaserId);
    if (!action || typeof runFutureLabRoadmapAction !== 'function') return false;
    const started = runFutureLabRoadmapAction(action.id, this) !== false;
    if (started && action.actionType !== "notebook" && typeof switchMainMode === 'function') {
      switchMainMode('terminal');
    }
    return started;
  }

  // Animate a planet node from locked → available on the start-screen galaxy map.
  unlockNextPlanetNode(targetIndex) {
    if (targetIndex == null) return;
    const nodeBtn = document.querySelector(".planet-node[data-level='" + targetIndex + "']");
    if (!nodeBtn) return;
    const wasLocked = nodeBtn.classList.contains('locked');
    this.refreshGalaxyMapProgress();
    if (!wasLocked || nodeBtn.classList.contains('locked')) return;
    nodeBtn.classList.add('unlocking');
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

  recordCodeRunStats(stats) {
    if (!stats) return;
    if (!this.codeRunStats) this.codeRunStats = createEmptyCodeRunStats();
    const mergeCountMap = (key) => {
      const src = stats[key] || {};
      const dst = this.codeRunStats[key] || {};
      for (const name in src) dst[name] = (dst[name] || 0) + src[name];
      this.codeRunStats[key] = dst;
    };
    this.codeRunStats.repeatLoops += stats.repeatLoops || 0;
    this.codeRunStats.forLoops += stats.forLoops || 0;
    this.codeRunStats.repeatIterations += stats.repeatIterations || 0;
    this.codeRunStats.forIterations += stats.forIterations || 0;
    mergeCountMap('functionCalls');
    mergeCountMap('spawnTypes');
    mergeCountMap('repeatSpawnTypes');
    mergeCountMap('loopSpawnTypes');
  }

  hasRepeatSpawned(type, minCount = 1) {
    const stats = this.codeRunStats || {};
    const repeatSpawns = (stats.repeatSpawnTypes && stats.repeatSpawnTypes[type]) || 0;
    return repeatSpawns >= minCount;
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

  hasMagnetTouchRule() {
    return this.hasActiveRule(rule => rule.target === 'player.touching'
      && rule.eventArgs
      && rule.eventArgs[0]
      && rule.eventArgs[0].value === 'magnet');
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
    // Earth, "no jump_power": keep the jump impulse at the planet's stock value and
    // solve Agility with mass, engine, gravity, and antigravity instead.
    if (c && c.id === "earth-no-jump-power" && planetIndex === 0) {
      const at = this.getAgilityTarget();
      const stockJump = (this.currentPlanet && this.currentPlanet.physics && Number.isFinite(this.currentPlanet.physics.jumpPower))
        ? this.currentPlanet.physics.jumpPower
        : 10;
      return {
        id: "earth-no-jump-power-gems",
        label: `reach Agility ${at}+ while keeping hopper.jump_power at ${stockJump} or lower — use mass, engine, and gravity instead`,
        short: `AGILITY ${at}+ · NO JUMP_POWER!`,
        validate: (game) => game.isEarthHopperEngineered() && game.getJumpForce() <= stockJump + 0.001
      };
    }
    // Earth, "no mass cut": keep Hopper at stock mass or heavier and solve the
    // Agility target with force and gravity levers instead of lightening the suit.
    if (c && c.id === "earth-no-mass-cut" && planetIndex === 0) {
      const at = this.getAgilityTarget();
      const minMass = Number.isFinite(c.minMass) ? c.minMass : 2.5;
      return {
        id: "earth-no-mass-cut-gems",
        label: `reach Agility ${at}+ while keeping hopper.mass at ${minMass} or heavier — use engine, jump_power, and gravity instead`,
        short: `AGILITY ${at}+ · MASS ${minMass}+!`,
        validate: (game) => game.isEarthHopperEngineered() && game.getActiveMass() >= minMass - 0.001
      };
    }
    // Earth, "engine-only": all required gems are placed on lower ledges for this
    // replay, and only the engine knob may move. This isolates F = m * a: more
    // force creates more speed without leaning on mass, jump, or gravity.
    if (c && c.id === "earth-engine-only" && planetIndex === 0) {
      const at = this.getAgilityTarget();
      const engineMin = Number.isFinite(c.engineMin) ? c.engineMin : 8;
      const minMass = Number.isFinite(c.minMass) ? c.minMass : 2.5;
      const stockJump = (this.currentPlanet && this.currentPlanet.physics && Number.isFinite(this.currentPlanet.physics.jumpPower))
        ? this.currentPlanet.physics.jumpPower
        : 10;
      const stockGravity = (this.currentPlanet && this.currentPlanet.physics && Number.isFinite(this.currentPlanet.physics.gravity))
        ? this.currentPlanet.physics.gravity
        : 0.6;
      return {
        id: "earth-engine-only-gems",
        label: `engine-only lab: set hopper.engine to ${engineMin}+ and keep mass, jump_power, gravity, and antigravity stock`,
        short: `ENGINE ${engineMin}+ ONLY!`,
        validate: (game) => {
          const env = (typeof Compiler !== 'undefined' && Compiler.env) ? Compiler.env : {};
          const gravityStock = env.gravity === null || env.gravity === undefined || Math.abs(env.gravity - stockGravity) < 0.001;
          return game.isEarthHopperEngineered()
            && game.getEngineForce() >= engineMin
            && game.getActiveMass() >= minMass - 0.001
            && game.getJumpForce() <= stockJump + 0.001
            && !(env.antigravity)
            && gravityStock;
        }
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
    // Moon, "strict spring": spawned springs must come from a repeat loop, so this
    // replay validates the coding construct, not only the final object count.
    if (c && c.id === "moon-strict-spring" && planetIndex === 1) {
      const n = c.springCount;
      return {
        id: "moon-strict-spring-gems",
        label: `set hopper.jump_power to 18+ and run repeat ${n}: spawn_spring() so the springs come from one loop`,
        short: `REPEAT ${n} SPRINGS + JUMP 18!`,
        validate: (game) => game.player
          && game.player.jumpPower >= 18
          && game.spawnedSprings.length >= n
          && game.hasRepeatSpawned('spring', n)
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
    // Glacies, "friction target": spikes are useful on normal runs, but this replay
    // deliberately asks for the numeric friction variable so the lesson is measurable.
    if (c && c.id === "glacies-friction-target" && planetIndex === 3) {
      const minFriction = Number.isFinite(c.minFriction) ? c.minFriction : 7;
      return {
        id: "glacies-friction-target-gems",
        label: `set friction = ${minFriction} or higher before crossing ice — spikes do not count for this science target`,
        short: `FRICTION ${minFriction}+ REQUIRED!`,
        validate: (game) => game.getCurrentFriction() >= minFriction
      };
    }
    // Jupiter, "rocket rule": keep the usual thrust engineering, but require a
    // rocket event rule so the replay teaches timed code, not just bigger numbers.
    if (c && c.id === "jupiter-rocket-rule" && planetIndex === 2) {
      const tt = this.getThrustTarget();
      return {
        id: "jupiter-rocket-rule-gems",
        label: `reach Thrust ${tt}+ and add a when hopper.rocket_on rule for the rocket burst`,
        short: `THRUST ${tt}+ & ROCKET RULE!`,
        validate: (game) => game.isJupiterHopperEngineered() && game.hasRocketEventRule()
      };
    }
    // Mag-Net, "polarity event": the standard gate accepts any player-touching
    // event. This remix requires the precise magnet-touch rule that changes pole.
    if (c && c.id === "magnet-polarity-event" && planetIndex === 4) {
      return {
        id: "magnet-polarity-event-gems",
        label: "combine the rocket rule with when player.touching('magnet') so polarity changes at the field",
        short: "ROCKET + MAGNET TOUCH RULE!",
        validate: (game) => game.hasRocketEventRule() && game.hasMagnetTouchRule()
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
      if (col <= 22) {
        return {
          id: "asteroid-mass-first-gem",
          label: "first make Hopper heavy with hopper.mass = 4.0 to shove the nearby asteroid",
          short: "MASS 4.0 FIRST!",
          validate: (game) => game.player && game.player.mass >= 3.5
        };
      }
      return {
        id: "asteroid-momentum-gems",
        label: "after the heavy-Hopper shove, add elasticity = 1.0 to bounce cleanly through the later asteroids",
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
    this.refreshGalaxyMapProgress();
    setupUIBindings(this);
    
    // Begin Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupControls() {
    // Honor the OS "reduce motion" setting — gates screen shake / heavy animation.
    this.setupReducedMotionPreference();

    // Capture keyboard buttons
    window.addEventListener("keydown", (e) => {
      // While the trade modal is open the world is paused — swallow gameplay keys so the cadet
      // can't move/jump behind it, and let Escape or E close it (otherwise Escape/P below would
      // resume the world while the panel stayed up).
      const _tradeOpen = (() => { const ts = document.getElementById('trade-screen'); return ts && !ts.classList.contains('hidden'); })();
      if (_tradeOpen) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
          e.preventDefault();
          if (typeof closeTradeScreen === 'function') closeTradeScreen();
        }
        return;
      }

      // Pause / resume with P or Escape (freezes the world mid-jump so you can write code).
      // Ignored while typing in the shell so the keys can be typed normally.
      if ((e.key === "p" || e.key === "P" || e.key === "Escape") &&
          document.activeElement.id !== "console-input" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (typeof toggleGamePause === "function") { e.preventDefault(); toggleGamePause(); return; }
      }

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

      if (e.key.toLowerCase() === "e" && this.activeNPC) {
        e.preventDefault();
        if (typeof openTradeScreen === "function") {
          openTradeScreen(this.activeNPC);
        }
        return;
      }

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
        const teaserId = btn.getAttribute("data-teaser");
        if (teaserId) {
          this.startFutureWorldTeaser(teaserId);
          return;
        }
        const id = parseInt(btn.getAttribute("data-level"));
        this.startMapPlanet(id);
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
    this.levelStartMs = Date.now();
    this.lastClearTimeSummary = null;

    // Retry Remix: the FIRST exposure to a world is the canonical, hand-built layout;
    // each same-level retry (preserveTunings) bumps the attempt so the world is
    // procedurally re-spun — same lesson, new instance. Deterministic per (planet, attempt).
    // Two more ways into a remix:
    //   • MASTERY: a fresh visit to a world you've cleared AND fully sampled starts
    //     remixed (the clear count picks the flavor), so mastery is earned by evidence.
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
      const plan = this.getFreshReplayPlan(index);
      this.planetAttempts[index] = plan.attempt;
      this.remixContext = plan.context;
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
    this.debris = []; this.debrisTimer = 90; // fresh drifting space debris per planet
    this.meteors = []; this.meteorPhase = 'idle'; // meteor-shower event state machine
    this.meteorIdleTimer = 1500 + Math.floor(Math.random() * 1500); // first shower ~25-50s in

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

    this.applyUnlockedTools();
    
    this.enemies = [];
    this.interactiveObjects = [];
    this.spawnedBoxes = [];
    this.spawnedSprings = [];
    this.codeRunStats = createEmptyCodeRunStats();
    
    this.cameraX = 0;
    this.coinsCollected = 0;
    this.requiredCollectiblesTotal = 0;
    this.requiredCollectiblesCollected = 0;
    this.portalLockNoticeCooldown = 0;
    this.shownGemGateIds = new Set();   // reset once-per-level gem-gate hints
    this._lastGemLogKey = null;         // reset shell gem-status de-duplication
    this._lastPortalLockMsg = null;     // reset portal-lock message de-duplication
    this._portalReadyCueShown = false;  // reset the one-time portal-ready fanfare
    this.formulaCardEffects = [];
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
        } else if (val === 11) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'weapon'));
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

    // Scatter a few breakable "?" blocks into the level (before the terrain is baked).
    this.placeBreakableBlocks();
    // Drop a couple of fuel canisters on reachable ledges so the finite tank is refillable.
    this.placeFuelCanisters();
    // Drop one or two food pickups so health can recover after hazards or mobs.
    this.placeFoodPickups();

    // Spawn planet villages. NPCs snap onto the nearest surface so config can focus on
    // the stage layout instead of pixel-perfect y positions.
    if (this.currentPlanet.npcs) {
      for (const npcConf of this.currentPlanet.npcs) {
        if (typeof NPC !== 'undefined') {
          const placed = this.placeNpcAwayFromCollectibles(npcConf);
          const npc = new NPC(placed);
          if (this.shouldVillagersShelterForNight()) this.parkNPCInCave(npc, "night");
          this.interactiveObjects.push(npc);
        }
      }
    }
    this._labStarPreviewCount = this.getClearLabStarSummary().stars;
    this.lastLabStarPulse = null;

    // Set document head name
    const titleText = document.getElementById("header-planet-title");
    if (titleText) titleText.textContent = this.currentPlanet.name;
    const subText = document.getElementById("header-planet-sub");
    if (subText) subText.textContent = `// Coordinate: ${this.currentPlanet.tagline}`;

    // Start background music loop. Survival mode keeps its faster battle groove across
    // planet loads, while remembering the planet track to restore when the fight ends.
    if (this.survivalMode && SFX.startSurvivalBGM) SFX.startSurvivalBGM(index);
    else SFX.startBGM(index);

    // Initial console dialogue
    ui_log_output(`--- Entering orbit of ${this.currentPlanet.name} ---`, "info");
    ui_log_output(`Gravity defaults: g = ${(this.currentPlanet.physics.gravity/0.6*9.8).toFixed(1)} m/s²`, "info");
    
    // Trigger dialogue helper robot text only after the player launches a mission.
    if (this.state === 'playing') {
      this._firedTutorialTriggers = new Set();   // fresh per level so each cue can show once
      this.triggerTutorialDialogue("start");
      if (this.player && typeof this.player.say === 'function') {
        this.player.say(this.getSuitArrivalQuip(index), { timer: 150 });
      }
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
      if (this.remixContext === 'daily' && this.dailyInfo && this.dailyInfo.isFrontier) {
        headline = `◆ Frontier Tier ${this.dailyInfo.tier || 1}: ${rlabel} · share code ${this.dailyInfo.shareCode}`;
        pop = "◆ FRONTIER!";
      } else if (this.remixContext === 'daily' && this.dailyInfo) {
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
    if (this.state === 'playing' && this.remixContext === 'cleanup') {
      const total = this.getPlanetMissionGemTotal(index);
      const banked = this.getBankedMissionGemCount(index);
      const gem = this.getGemConfig(index);
      const headline = `◆ Sample cleanup: bank ${Math.max(0, total - banked)} more ${gem.shortName} mission gem${Math.max(0, total - banked) === 1 ? "" : "s"} to unlock the Mastery Remix.`;
      if (typeof ui_log_output === 'function') ui_log_output(headline, "info");
      if (typeof logMissionBriefing === 'function') logMissionBriefing(headline);
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

  findSurfaceYForNpc(x, fallbackY = 320) {
    const map = this.getActiveMap();
    if (!map || !map.length || !map[0]) return fallbackY;
    const col = Math.max(1, Math.min(map[0].length - 2, Math.floor((x + 14) / TILE_SIZE)));
    for (let r = 1; r < map.length; r++) {
      const cell = map[r] && map[r][col];
      if (cell === 1 || cell === 10) return r * TILE_SIZE - 36;
    }
    return fallbackY;
  }

  npcOverlapsRequiredGem(x, y) {
    const npcRect = { x: x - 12, y: y - 8, w: 52, h: 48 };
    return this.interactiveObjects.some((obj) => {
      if (!obj || obj.type !== 'coin' || !obj.requiredCollectible || obj.collected) return false;
      const gemRect = { x: obj.x - 14, y: obj.y - 14, w: obj.w + 28, h: obj.h + 28 };
      return Physics.isOverlapping(npcRect, gemRect);
    });
  }

  entityTouchesHazard(entity) {
    const map = this.getActiveMap();
    return !!(map && map.length && Physics.getHazardCollisions(entity, map).length > 0);
  }

  entityOverlapsSpawnedBox(entity) {
    return (this.spawnedBoxes || []).some((box) => box && !box.collected && Physics.isOverlapping(entity, box));
  }

  npcHasUnsafePlacement(x, y) {
    const rect = { x: x - 12, y: y - 8, w: 52, h: 48 };
    if (this.npcOverlapsRequiredGem(x, y)) return true;
    if (this.entityTouchesHazard(rect)) return true;
    if (this.entityOverlapsSpawnedBox(rect)) return true;
    return false;
  }

  npcCaveHasUnsafePlacement(caveX, caveY) {
    if (!Number.isFinite(caveX) || !Number.isFinite(caveY)) return true;
    return this.npcHasUnsafePlacement(caveX + 10, caveY);
  }

  findSafeNpcCavePosition(homeX, homeY, options = {}) {
    const map = this.getActiveMap();
    const mapW = map && map[0] ? map[0].length * TILE_SIZE : 1920;
    const baseX = Number.isFinite(homeX) ? homeX : 160;
    const baseY = Number.isFinite(homeY) ? homeY : 320;
    const offsets = [-32, 48, -64, 80, -96, 112, -128, 144, -160, 176, 0, 208, -208];

    for (const dx of offsets) {
      const bodyX = Math.max(48, Math.min(mapW - 96, baseX + dx));
      const bodyY = options.snapToGround === false ? baseY : this.findSurfaceYForNpc(bodyX, baseY);
      const caveX = Math.max(20, bodyX - 10);
      if (!this.npcCaveHasUnsafePlacement(caveX, bodyY)) {
        return { caveX, caveY: bodyY };
      }
    }
    return null;
  }

  ensureNPCSafeCave(npc) {
    if (!npc) return false;
    if (!this.npcCaveHasUnsafePlacement(npc.caveX, npc.caveY)) return true;
    const homeX = Number.isFinite(npc.homeX) ? npc.homeX : npc.x;
    const homeY = Number.isFinite(npc.homeY) ? npc.homeY : npc.y;
    const cave = this.findSafeNpcCavePosition(homeX, homeY);
    if (!cave) return false;
    npc.caveX = cave.caveX;
    npc.caveY = cave.caveY;
    return true;
  }

  placeNpcAwayFromCollectibles(npcConf) {
    const placed = { ...npcConf };
    const map = this.getActiveMap();
    const mapW = map && map[0] ? map[0].length * TILE_SIZE : 1920;
    const baseX = Number.isFinite(placed.x) ? placed.x : 160;
    const offsets = [0, 96, 128, 160, 64, 192, -64, -96, 224, -128, 256, -160, 320];

    for (const dx of offsets) {
      const candidateX = Math.max(48, Math.min(mapW - 96, baseX + dx));
      const candidateY = placed.snapToGround === false
        ? (Number.isFinite(placed.y) ? placed.y : this.findSurfaceYForNpc(candidateX, placed.y))
        : this.findSurfaceYForNpc(candidateX, placed.y);
      if (!this.npcHasUnsafePlacement(candidateX, candidateY)) {
        const cave = this.findSafeNpcCavePosition(candidateX, candidateY, { snapToGround: placed.snapToGround });
        if (!cave) continue;
        placed.x = candidateX;
        placed.y = candidateY;
        placed.homeX = candidateX;
        placed.homeY = candidateY;
        placed.caveX = cave.caveX;
        placed.caveY = cave.caveY;
        return placed;
      }
    }

    placed.x = Math.max(48, Math.min(mapW - 96, baseX + 360));
    if (placed.snapToGround !== false) placed.y = this.findSurfaceYForNpc(placed.x, placed.y);
    placed.homeX = placed.x;
    placed.homeY = placed.y;
    const cave = this.findSafeNpcCavePosition(placed.x, placed.y, { snapToGround: placed.snapToGround });
    placed.caveX = cave ? cave.caveX : Math.max(20, placed.x - 42);
    placed.caveY = cave ? cave.caveY : placed.y;
    return placed;
  }

  triggerTutorialDialogue(trigger) {
    // Each cue fires ONCE per level. The spatial checks in update() poll every frame while the
    // cadet is in the zone (e.g. lingering at the Moon's gap), so without this guard showDialogue
    // would reset the speech balloon every frame and it would never clear.
    this._firedTutorialTriggers = this._firedTutorialTriggers || new Set();
    if (this._firedTutorialTriggers.has(trigger)) return;
    this._firedTutorialTriggers.add(trigger);
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
    } else if (type === 'food') {
      const ox = useCoords ? 0 : this.spawnStackOffset(this.interactiveObjects.filter(o => o.type === 'food'), px, py, step);
      const food = new InteractiveObject(px + ox, py, 'food');
      this.interactiveObjects.push(food);
      Particles.spawnBurst(px + ox + 9, py + 9, '#fb7185', 8, 2, 2, 'glow');
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

  updateDrill() {
    if (!this.player || this.state !== 'playing') return;
    if (this.drillCooldown > 0) this.drillCooldown--;
    if (this.drillHintCooldown > 0) this.drillHintCooldown--;
    if (!(this.keys && (this.keys.d || this.keys.D))) return;
    if (this.drillCooldown > 0) return;
    this.drillCooldown = 14;

    if (this.tryDrillMine()) return;
    if (this.tryPlaceMinedBlock()) return;
    if (this.drillHintCooldown <= 0) {
      this.drillHintCooldown = 90;
      if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 8, "NO BLOCKS", "rounded", "#cbd5e1", -0.25, { maxLife: 48, scale: 0.75 });
      }
    }
  }

  getDrillTileCandidates() {
    const map = this.getActiveMap();
    if (!this.player || !map || !map.length || !map[0]) return [];
    const dir = this.player.facing || 1;
    const probeX = dir > 0 ? this.player.x + this.player.w + 9 : this.player.x - 9;
    const downPressed = !!(this.keys && (this.keys.s || this.keys.S || this.keys.ArrowDown || this.keys.arrowdown || this.keys.Down || this.keys.down));
    const points = [
      { x: probeX, y: this.player.y + this.player.h * 0.35 },
      { x: probeX, y: this.player.y + this.player.h * 0.72 }
    ];
    if (downPressed) points.push({ x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h + 10 });
    const out = [];
    const seen = new Set();
    for (const p of points) {
      const c = Math.floor(p.x / TILE_SIZE);
      const r = Math.floor(p.y / TILE_SIZE);
      const key = `${r}:${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (r <= 0 || c <= 0 || r >= map.length - 1 || c >= map[0].length - 1) continue;
      out.push({ r, c, val: map[r] && map[r][c] });
    }
    return out;
  }

  tryDrillMine() {
    const map = this.getActiveMap();
    if (!map) return false;
    for (const t of this.getDrillTileCandidates()) {
      if (t.val !== 1 && t.val !== 10) continue;
      if (t.val === 10) this.breakBlock(t.r, t.c, 'drill');
      else this.carveTile(t.r, t.c);
      this.minedBlocks = Math.min(99, (this.minedBlocks || 0) + 1);
      if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
      if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.pop(t.c * TILE_SIZE + 16, t.r * TILE_SIZE - 2, `BLOCK +${this.minedBlocks}`, "#cbd5e1", 0.82);
      }
      this.grantDrillDiscoveryReward('mine', { blocks: this.minedBlocks });
      return true;
    }
    return false;
  }

  boxOccupiesCell(c, r) {
    return (this.spawnedBoxes || []).some((box) => {
      if (!box || box.collected) return false;
      return Math.floor((box.x + box.w / 2) / TILE_SIZE) === c && Math.floor((box.y + box.h / 2) / TILE_SIZE) === r;
    });
  }

  tryPlaceMinedBlock() {
    if ((this.minedBlocks || 0) <= 0 || !this.player) return false;
    const map = this.getActiveMap();
    if (!map || !map.length || !map[0]) return false;
    const dir = this.player.facing || 1;
    const cols = map[0].length;
    const c = Math.max(1, Math.min(cols - 2, Math.floor((this.player.x + this.player.w / 2 + dir * 42) / TILE_SIZE)));
    let r = Math.max(1, Math.min(map.length - 2, Math.floor((this.player.y + this.player.h - 2) / TILE_SIZE) - 1));
    while (r > 1 && (map[r][c] !== 0 || this.boxOccupiesCell(c, r))) r--;
    if (map[r][c] !== 0 || this.boxOccupiesCell(c, r)) return false;
    const box = new InteractiveObject(c * TILE_SIZE, r * TILE_SIZE, 'box');
    const playerPad = { x: this.player.x - 2, y: this.player.y - 2, w: this.player.w + 4, h: this.player.h + 4 };
    if (Physics.isOverlapping(playerPad, box)) return false;
    this.spawnedBoxes.push(box);
    this.minedBlocks = Math.max(0, (this.minedBlocks || 0) - 1);
    if (typeof SFX !== 'undefined' && SFX.playLanding) SFX.playLanding();
    if (typeof Particles !== 'undefined') Particles.spawnBurst(box.x + box.w / 2, box.y + box.h / 2, '#d97706', 8, 1.8, 2.0);
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(box.x + box.w / 2, box.y - 2, `STACK ${this.minedBlocks}`, "#f59e0b", 0.78);
    this.grantDrillDiscoveryReward('place', { blocks: this.minedBlocks, placed: box });
    return true;
  }

  getDrillDiscoverySourceKey(kind, index = this.currentPlanetIndex) {
    const planetKey = Number.isFinite(index) ? index : 0;
    return `drill:${kind || 'mine'}:${planetKey}`;
  }

  grantDrillDiscoveryReward(kind = 'mine', meta = {}) {
    const action = kind === 'place' ? 'place' : 'mine';
    const sourceKey = this.getDrillDiscoverySourceKey(action);
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    if (this.discoveryPassCounts[sourceKey]) return null;

    const rewardXP = action === 'place' ? 3 : 2;
    const masteryXP = action === 'place' ? 10 : 6;
    const label = action === 'place' ? 'BUILD LOOP PROOF' : 'GEOLOGY SAMPLE';
    const formula = action === 'place' ? 'mined block -> placed support' : 'solid tile -> mined block';
    const insight = action === 'place'
      ? 'Stacking a mined block turns stored material back into terrain. The route becomes data you can edit, test, and revise.'
      : 'Drilling moves material from the map into your block bank. That is conservation: the matter changed state instead of disappearing.';
    const cue = action === 'place'
      ? 'Mine with D, place with D in open space, then compare the new path.'
      : 'Face a tile and press D. Press Down + D to drill underfoot.';
    const color = action === 'place' ? '#f59e0b' : '#cbd5e1';
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, action === 'place' ? 'drill build proof' : 'drill mining proof', { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }

    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const planetName = this.currentPlanet && this.currentPlanet.name ? this.currentPlanet.name : 'World';
    const blocks = Math.max(0, Math.floor(Number(meta.blocks) || 0));
    const pulse = {
      kind: 'drill',
      title: action === 'place' ? 'Build Loop Proof' : 'Geology Sample',
      formula,
      insight,
      cue,
      missionId: sourceKey,
      missionTitle: planetName,
      passed: 1,
      total: 1,
      progressLabel: action === 'place'
        ? `1 block placed, ${blocks} bank${blocks === 1 ? '' : 's'} left`
        : `${blocks} block${blocks === 1 ? '' : 's'} mined`,
      openedGems: 0,
      rewardXP,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      drillProof: {
        label,
        rewardXP,
        action,
        sourceKey
      }
    };
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);

    if (typeof ui_log_output === 'function') {
      ui_log_output(`${label}: +${rewardXP} Research XP, +${pulse.worldMasteryAddedXP} world mastery XP.`, 'success');
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop && this.player) {
      const px = this.player.x + this.player.w / 2;
      ComicBubbles.pop(px, this.player.y - 28, label, color, 0.86);
      ComicBubbles.pop(px, this.player.y - 10, `+${rewardXP} LAB XP`, '#a7f3d0', 0.72);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst && this.player) {
      Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, color, 12, 2.0, 2.1, 'glow');
      Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#a7f3d0', 8, 1.6, 1.7, 'glow');
    }
    if (rankUp && typeof showBadgeToast === 'function') {
      showBadgeToast({
        icon: 'D',
        label: `Research Rank: ${afterRank.title}`,
        description: `Drill lab unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
        title: 'DRILL LAB',
        color,
        timer: 220
      });
    }
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === this) saveLocalProgress();
    return pulse;
  }

  checkMissions() {
    if (!this.currentPlanet || !this.currentPlanet.missions) return;

    const completedThisFrame = [];
    for (const mission of this.currentPlanet.missions) {
      if (!this.completedMissions.has(mission.id)) {
        try {
          if (mission.validate(this)) {
            this.completedMissions.add(mission.id);
            completedThisFrame.push(mission);
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
    if (completedThisFrame.length > 0) {
      const status = this.getLevelObjectiveStatus();
      this.spawnMissionTaskProgressEffect(completedThisFrame, status);
      this.checkLabStarProgress("mission");
      updateMissionList(this);
      this.checkPortalReadyCue("mission");
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

  spawnMissionTaskProgressEffect(completedMissions = [], status = this.getLevelObjectiveStatus()) {
    const completedList = Array.isArray(completedMissions) ? completedMissions.filter(Boolean) : [];
    if (!completedList.length || !status) return null;
    const total = Math.max(0, Math.floor(Number(status.missionsTotal) || 0));
    const complete = Math.max(0, Math.floor(Number(status.missionsComplete) || 0));
    const samplesLeft = Math.max(0, (Number(status.collectiblesTotal) || 0) - (Number(status.collectiblesCollected) || 0));
    const label = status.allMissionsComplete ? "TASKS DONE!" : `TASK ${complete}/${total || complete}`;
    let monitorText;
    if (status.readyForPortal) {
      monitorText = "TASKS DONE: portal ready";
    } else if (status.allMissionsComplete) {
      monitorText = `TASKS DONE: collect ${samplesLeft} sample${samplesLeft === 1 ? "" : "s"}`;
    } else {
      monitorText = `TASK ${complete}/${total}: run the next fix`;
    }

    const px = this.player ? (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2 : 0;
    const py = this.player ? (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2 : 0;
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, py - 18, label, "#38bdf8", status.allMissionsComplete ? 1.16 : 1.02);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py, status.allMissionsComplete ? '#4ade80' : '#38bdf8', status.allMissionsComplete ? 16 : 10, 2.4, 2.4, 'glow');
    }
    if (!status.readyForPortal) {
      this.showMissionBalloon(monitorText, {
        title: "MISSION CRT",
        color: status.allMissionsComplete ? "#4ade80" : "#38bdf8",
        timer: 260
      });
    }
    return {
      label,
      monitorText,
      completed: complete,
      total,
      samplesLeft,
      allTasksComplete: !!status.allMissionsComplete,
      readyForPortal: !!status.readyForPortal
    };
  }

  checkPortalReadyCue(reason = "progress") {
    if (this._portalReadyCueShown) return null;
    const status = this.getLevelObjectiveStatus();
    if (!status.readyForPortal) return null;
    this._portalReadyCueShown = true;

    const portal = Array.isArray(this.interactiveObjects)
      ? this.interactiveObjects.find(obj => obj && obj.type === 'portal' && !obj.collected)
      : null;
    const target = portal || this.player;
    const cx = target ? (Number.isFinite(target.x) ? target.x : 0) + (Number.isFinite(target.w) ? target.w : 24) / 2 : 0;
    const cy = target ? (Number.isFinite(target.y) ? target.y : 0) + (Number.isFinite(target.h) ? target.h : 32) / 2 : 0;
    if (portal) portal.unlockPulse = 1;

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(cx, cy - 18, "PORTAL READY!", "#4ade80", 1.18);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(cx, cy, '#4ade80', 18, 2.8, 2.6, 'glow');
      Particles.spawnBurst(cx, cy, '#bbf7d0', 10, 2.0, 1.8, 'glow');
    }
    if (typeof SFX !== 'undefined' && SFX.playSuccess) SFX.playSuccess();
    const labStars = typeof this.getClearLabStarSummary === 'function' ? this.getClearLabStarSummary() : null;
    const scienceCheck = labStars && Array.isArray(labStars.checks)
      ? labStars.checks.find(check => check && check.id === "science")
      : null;
    const missingScienceProof = !!(scienceCheck && !scienceCheck.earned);
    const monitorText = missingScienceProof
      ? "PORTAL READY: proof for 3 stars or drive"
      : "PORTAL READY: drive to the exit";
    if (missingScienceProof && this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2;
      const py = (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2;
      ComicBubbles.pop(px, py - 22, "3-STAR PROOF?", "#a7f3d0", 0.95);
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(missingScienceProof
        ? "Portal ready — add a prediction/formula proof for 3 stars, or drive to the exit."
        : "Portal ready — mission tasks and samples are complete. Drive to the exit.", "success");
    }
    this.showMissionBalloon(monitorText, {
      title: "MISSION CRT",
      color: missingScienceProof ? "#a7f3d0" : "#4ade80",
      timer: 280
    });
    return { reason, x: cx, y: cy, portal, status, missingScienceProof, monitorText };
  }

  getClearLabStarKey({ isDailyRun = false, isFrontierRun = false } = {}) {
    if (isFrontierRun && this.dailyInfo && this.dailyInfo.dateStr) {
      return `frontier:${this.dailyInfo.dateStr}:t${this.dailyInfo.tier || 1}`;
    }
    if (isDailyRun && this.dailyInfo && this.dailyInfo.dateStr) return `daily:${this.dailyInfo.dateStr}`;
    return String(this.currentPlanetIndex || 0);
  }

  getRunTimeSeconds(nowMs = Date.now()) {
    if (!Number.isFinite(this.levelStartMs) || this.levelStartMs <= 0) return 0;
    const elapsed = (nowMs - this.levelStartMs) / 1000;
    return Math.max(0, Math.round(elapsed * 10) / 10);
  }

  recordClearTime({ isDailyRun = false, isFrontierRun = false, elapsedSeconds = null } = {}) {
    const key = this.getClearLabStarKey({ isDailyRun, isFrontierRun });
    const elapsed = Number.isFinite(elapsedSeconds)
      ? Math.max(0, Math.round(elapsedSeconds * 10) / 10)
      : this.getRunTimeSeconds();
    this.bestClearTimes = this.bestClearTimes || {};
    const previousBest = Number(this.bestClearTimes[key]);
    const hasPrevious = Number.isFinite(previousBest) && previousBest > 0;
    const isNewBest = !hasPrevious || elapsed < previousBest;
    if (isNewBest) this.bestClearTimes[key] = elapsed;
    const summary = {
      key,
      elapsed,
      previousBest: hasPrevious ? previousBest : null,
      best: isNewBest ? elapsed : previousBest,
      isNewBest
    };
    this.lastClearTimeSummary = summary;
    return summary;
  }

  getClearReplayContract({ labStars = null, clearTime = null, isDailyRun = false, isFrontierRun = false, nextIndex = null, frontierRivalResult = null } = {}) {
    const starSummary = labStars || this.getClearLabStarSummary({ isDailyRun, isFrontierRun });
    const missingStar = starSummary && Array.isArray(starSummary.checks)
      ? starSummary.checks.find(check => !check.earned)
      : null;
    if (missingStar) {
      const missingCopy = {
        missions: {
          title: "Finish the mission task",
          body: "Replay and make the code satisfy the active requirement before entering the portal."
        },
        gems: {
          title: "Collect every mission gem",
          body: "Use the requirement monitor to unlock the remaining gem gates, then bank the samples."
        },
        science: {
          title: "Leave science proof",
          body: "Make a prediction or collect a formula card so the run has evidence, not just a finish."
        }
      };
      const copy = missingCopy[missingStar.id] || {
        title: `Earn ${missingStar.label}`,
        body: "Replay with one focused improvement and compare the result."
      };
      return {
        kicker: "NEXT RUN CONTRACT",
        title: copy.title,
        body: copy.body,
        reward: `Reward: ${Math.min((starSummary.stars || 0) + 1, starSummary.maxStars || 3)}/${starSummary.maxStars || 3} Lab Stars`,
        action: "replay",
        cta: "RETRY FOR STAR"
      };
    }

    if (isFrontierRun && this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.futureSourcePrep) {
      const focus = this.dailyInfo.labContract || null;
      const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
      const sourceTested = typeof hasFutureLabSourceProofCredit === 'function' && hasFutureLabSourceProofCredit(this);
      const sourceReflected = typeof hasFutureLabSourceReflectionCredit === 'function' && hasFutureLabSourceReflectionCredit(this);
      if (sourceTested && !sourceReflected) {
        return {
          kicker: "SOURCE KEY TESTED",
          title: "Explain the source key",
          body: "The source rehearsal is tested. Open the Science Notebook and explain how hidden-force clues plus branch/chance evidence tune the source key.",
          reward: "Reward: Source Key Reflection Proof",
          action: "log",
          cta: "WRITE PROOF"
        };
      }
      if (sourceReflected) {
        return {
          kicker: "SOURCE KEY COMPLETE",
          title: "Source Key record complete",
          body: "The source rehearsal and notebook explanation are banked. Chase a new Frontier rival or Daily Signal next.",
          reward: "Reward: Future Lab launch-ready record",
          action: "frontier",
          cta: "NEXT FRONTIER"
        };
      }
      return {
        kicker: "SOURCE KEY CONTRACT",
        title: focus ? focus.title : "Run source rehearsal",
        body: focus
          ? `${focus.body}${command}`
          : "Run another Frontier remix, then compare hidden-force clues with branch and chance evidence for the source key.",
        reward: "Reward: source key record + share code",
        action: "future-source",
        cta: "RUN SOURCE"
      };
    }

    if (isFrontierRun && this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.darkMatterEcho) {
      const focus = this.dailyInfo.labContract || null;
      const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
      return {
        kicker: "DARK MATTER ECHO CONTRACT",
        title: focus ? focus.title : "Decode Dark Matter Echo",
        body: focus
          ? `${focus.body}${command}`
          : "Run another Frontier remix, then compare stars, time, and motion clues to decode the hidden-force echo.",
        reward: "Reward: Dark Matter Echo + share code",
        action: "dark-matter-echo",
        cta: "RUN ECHO"
      };
    }

    if (isFrontierRun && this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.darkMatterPrep) {
      const focus = this.dailyInfo.labContract || null;
      const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
      return {
        kicker: "DARK MATTER PREP CONTRACT",
        title: focus ? focus.title : "Bank curve evidence",
        body: focus
          ? `${focus.body}${command}`
          : "Run another Frontier remix, then compare path curve, speed, and force changes as hidden-force clues.",
        reward: "Reward: hidden-force evidence + share code",
        action: "dark-matter-prep",
        cta: "RUN PREP"
      };
    }

    if (isFrontierRun && frontierRivalResult && frontierRivalResult.state === "behind" && frontierRivalResult.entry) {
      const rival = frontierRivalResult.entry;
      const timeText = Number.isFinite(rival.bestTime) ? ` under ${rival.bestTime.toFixed(1)}s` : "";
      return {
        kicker: "FRONTIER RIVAL CONTRACT",
        title: `Catch ${rival.pilot || "classmate"}`,
        body: `${frontierRivalResult.body} Replay this seeded lesson, change one variable, and compare the telemetry.`,
        reward: `Target: ${rival.stars || 0}/3 Lab Stars${timeText}`,
        action: "frontier",
        cta: "CHASE RIVAL"
      };
    }

    if (isFrontierRun) {
      const ladder = typeof this.getFrontierRivalLadderProgress === 'function'
        ? this.getFrontierRivalLadderProgress()
        : null;
      if (ladder && !ladder.complete && ladder.proofCount > 0 && ladder.remaining > 0) {
        const frontier = (this.dailyInfo && this.dailyInfo.isFrontier) ? this.dailyInfo : this.getFrontierChallenge();
        const focus = frontier && frontier.labContract ? frontier.labContract : null;
        const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
        return {
          kicker: "FRONTIER LADDER CONTRACT",
          title: `Chase ${ladder.label}`,
          body: `Log ${ladder.remaining} more unique rival proof${ladder.remaining === 1 ? "" : "s"} on same-seed Frontier runs. ${focus ? `${focus.body}${command}` : "Change one variable, compare stars/time, and share the updated line."}`,
          reward: `Reward: ${ladder.label} +${ladder.rewardXP} Research XP`,
          action: "frontier",
          cta: "CHASE LADDER"
        };
      }
    }

    const formulaTarget = (typeof getActiveFormulaTarget === 'function') ? getActiveFormulaTarget(this) : null;
    if (formulaTarget) {
      return {
        kicker: "NEXT RUN CONTRACT",
        title: `Collect ${formulaTarget.title}`,
        body: formulaTarget.cue,
        reward: "Reward: formula card + Research XP",
        action: "replay",
        cta: "RETRY FOR FORMULA"
      };
    }

    if (isFrontierRun) {
      const frontier = (this.dailyInfo && this.dailyInfo.isFrontier) ? this.dailyInfo : this.getFrontierChallenge();
      const focus = frontier && frontier.labContract ? frontier.labContract : null;
      const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
      const darkMatterPrep = !!(frontier && frontier.darkMatterPrep);
      const futureSourcePrep = !!(frontier && frontier.futureSourcePrep);
      const sourceTested = futureSourcePrep && typeof hasFutureLabSourceProofCredit === 'function' && hasFutureLabSourceProofCredit(this);
      const sourceReflected = futureSourcePrep && typeof hasFutureLabSourceReflectionCredit === 'function' && hasFutureLabSourceReflectionCredit(this);
      if (sourceTested && !sourceReflected) {
        return {
          kicker: "SOURCE KEY TESTED",
          title: "Explain the source key",
          body: "Open the Science Notebook and connect hidden-force clues with branch/chance evidence for the capstone proof.",
          reward: "Reward: Source Key Reflection Proof",
          action: "log",
          cta: "WRITE PROOF"
        };
      }
      if (sourceReflected) {
        return {
          kicker: "SOURCE KEY COMPLETE",
          title: "Source Key record complete",
          body: "The source key has a tested run and written explanation. Take the next Frontier challenge to keep the record alive.",
          reward: "Reward: new Frontier evidence",
          action: "frontier",
          cta: "NEXT FRONTIER"
        };
      }
      return {
        kicker: futureSourcePrep ? "SOURCE KEY CONTRACT" : (darkMatterPrep ? "DARK MATTER PREP CONTRACT" : "NEXT FRONTIER CONTRACT"),
        title: focus ? focus.title : (frontier ? `Climb Frontier Tier ${frontier.tier}` : "Climb the frontier ladder"),
        body: focus
          ? `${focus.body}${command}`
          : "Use a seeded remix to prove the same science idea still works after the star-map is complete.",
        reward: futureSourcePrep ? "Reward: source key record + share code" : (darkMatterPrep ? "Reward: hidden-force evidence + share code" : "Reward: world mastery XP + share code"),
        action: futureSourcePrep ? "future-source" : (darkMatterPrep ? "dark-matter-prep" : "frontier"),
        cta: futureSourcePrep ? "RUN SOURCE" : (darkMatterPrep ? "RUN PREP" : "NEXT FRONTIER")
      };
    }

    const timeSummary = clearTime || this.lastClearTimeSummary || null;
    if (timeSummary && Number.isFinite(timeSummary.best) && timeSummary.best > 0) {
      const shave = Math.max(0.5, Math.min(4, timeSummary.best * 0.08));
      const target = Math.max(1, Math.round((timeSummary.best - shave) * 10) / 10);
      return {
        kicker: "NEXT RUN CONTRACT",
        title: `Beat ${timeSummary.best.toFixed(1)}s Lab Time`,
        body: "Replay with one cleaner route or one better variable tweak, then compare the telemetry.",
        reward: `Target: ${target.toFixed(1)}s`,
        action: "replay",
        cta: "CHASE TIME"
      };
    }

    if (isDailyRun) {
      const focus = this.dailyInfo && this.dailyInfo.labContract ? this.dailyInfo.labContract : null;
      const command = focus && focus.command ? ` Try: ${String(focus.command).replace(/\s*\n\s*/g, " / ")}` : "";
      return {
        kicker: "NEXT RUN CONTRACT",
        title: focus ? focus.title : "Compare today's remix",
        body: focus
          ? `${focus.body}${command}`
          : "Open the log, compare the remix with the original world, and write one observation.",
        reward: "Reward: stronger lab record",
        action: "log",
        cta: "OPEN LOG"
      };
    }

    if (nextIndex !== null && typeof PLANETS !== 'undefined' && PLANETS[nextIndex]) {
      return {
        kicker: "NEXT RUN CONTRACT",
        title: `Launch toward ${PLANETS[nextIndex].name}`,
        body: "Run the spacecraft bridge plan to continue the signal trail.",
        reward: "Reward: next science chapter",
        action: "launch",
        cta: "RUN LAUNCH PLAN"
      };
    }

    return {
      kicker: "NEXT RUN CONTRACT",
      title: "Master a daily signal",
      body: "Use a fresh remix to prove the same physics idea still works when the map changes.",
      reward: "Reward: daily clear + share code",
      action: "daily",
      cta: "ACCEPT SIGNAL"
    };
  }

  getClearObjectiveQueue({ replayContract = null, explainPrompt = null, storyUnlock = null, storyPreview = null, labChainTarget = null, villageTrust = null } = {}) {
    const queue = [];
    const add = (item) => {
      if (!item || !item.title) return;
      queue.push({
        label: item.label || "NEXT",
        title: item.title,
        body: item.body || "",
        reward: item.reward || "",
        cta: item.cta || "",
        action: item.action || null,
        cardId: item.cardId || null,
        preserveReflectionContext: !!item.preserveReflectionContext
      });
    };

    if (replayContract) {
      add({
        label: replayContract.kicker || "NEXT RUN",
        title: replayContract.title,
        body: replayContract.body,
        reward: replayContract.reward,
        cta: replayContract.cta,
        action: "replay"
      });
    }

    if (explainPrompt) {
      add({
        label: explainPrompt.kicker || "LAB PROOF",
        title: explainPrompt.title,
        body: explainPrompt.question,
        reward: explainPrompt.reward || "Reward: notebook proof + Research XP",
        cta: explainPrompt.cta,
        action: "explain",
        preserveReflectionContext: !!explainPrompt.preserveReflectionContext
      });
    }

    const story = storyUnlock || storyPreview;
    if (story) {
      add({
        label: story.kicker || (storyUnlock ? "SIGNAL DECODED" : "STORY"),
        title: story.title,
        body: story.body,
        reward: storyUnlock ? (story.progress || "Story chapter decoded") : `Decode: ${story.concept || story.progress || "next chapter"}`,
        cta: storyUnlock ? "READ SIGNAL" : "NEXT CHAPTER",
        action: "story"
      });
    }

    if (labChainTarget) {
      add({
        label: labChainTarget.label || "LAB CHAIN",
        title: labChainTarget.title || "Make one fresh change",
        body: labChainTarget.body || "Change one variable, run it, and compare the new result.",
        reward: labChainTarget.reward || "Next new progress keeps the chain alive",
        cta: labChainTarget.command ? "STAGE CHAIN" : "RUN NEXT",
        action: labChainTarget.command ? "lab-chain" : null
      });
    }

    const aiDeck = typeof getAIStateDeckProgress === 'function' ? getAIStateDeckProgress(this) : null;
    const aiAction = typeof getAIStateDeckAction === 'function' && aiDeck && aiDeck.nextCard
      ? getAIStateDeckAction(this, aiDeck.nextCard.id)
      : null;
    if (aiDeck && aiDeck.nextCard && aiAction) {
      add({
        label: "AI STATE DECK",
        title: aiDeck.nextCard.title,
        body: aiAction.body || aiDeck.nextCard.next || "Run the next behavior proof and watch the state change.",
        reward: `${aiDeck.earnedCount}/${aiDeck.total} AI states logged · ${aiDeck.nextCard.concept || "state machine"}`,
        cta: aiAction.label || "RUN STATE",
        action: "ai-state",
        cardId: aiDeck.nextCard.id
      });
    }

    const pact = villageTrust && villageTrust.nextPact ? villageTrust.nextPact : null;
    if (pact) {
      const nextTier = villageTrust.nextTier
        ? `${villageTrust.nextTier.label} at ${villageTrust.nextTier.points} trust`
        : "Max village trust reached";
      add({
        label: "VILLAGE QUEST",
        title: pact.title,
        body: `${pact.action || "Help the village"} to practice ${pact.concept || "relationship state changes"}.`,
        reward: nextTier,
        cta: "BUILD TRUST"
      });
    }

    return queue.slice(0, 5).map((item, index) => ({
      ...item,
      priority: index + 1
    }));
  }

  runClearLabChainTarget(target = this.lastClearLabChainTarget) {
    if (!target || !target.command || typeof stageScienceDeltaCommand !== 'function') return false;
    if (typeof switchMainMode === 'function') switchMainMode('terminal');
    return stageScienceDeltaCommand(target.command, {
      title: target.title || "Continue lab chain",
      kind: target.kind || "lab-chain",
      source: "clear-lab-chain",
      color: "#bef264"
    });
  }

  runClearObjectiveQueueAction(priorityOrAction = 1) {
    const queue = Array.isArray(this.lastClearObjectiveQueue) ? this.lastClearObjectiveQueue : [];
    const item = typeof priorityOrAction === "number"
      ? queue.find(entry => entry && entry.priority === priorityOrAction)
      : queue.find(entry => entry && entry.action === priorityOrAction);
    if (!item || !item.action) return false;
    if (item.action === "replay") return this.runClearReplayContract(this.lastClearReplayContract);
    if (item.action === "explain") return this.runClearExplainPrompt({ preserveReflectionContext: !!item.preserveReflectionContext });
    if (item.action === "lab-chain") return this.runClearLabChainTarget(this.lastClearLabChainTarget);
    if (item.action === "ai-state") return this.runClearCadetAIAction(item.cardId || null);
    if (item.action === "story") {
      if (typeof switchMainMode === 'function') switchMainMode('notebook');
      return true;
    }
    return false;
  }

  runClearReplayContract(contract = this.lastClearReplayContract) {
    const action = contract && contract.action ? contract.action : "replay";
    if (action === "frontier" && typeof this.startFrontierChallenge === 'function') {
      if (typeof runFrontierChallengeAction === 'function') return runFrontierChallengeAction(this);
      return this.startFrontierChallenge();
    }
    if (action === "dark-matter-echo" && typeof this.startFrontierChallenge === 'function') {
      const options = { source: "dark-matter-echo" };
      if (typeof runFrontierChallengeAction === 'function') return runFrontierChallengeAction(this, options);
      return this.startFrontierChallenge(options);
    }
    if (action === "dark-matter-prep" && typeof this.startFrontierChallenge === 'function') {
      const options = { source: "dark-matter-prep" };
      if (typeof runFrontierChallengeAction === 'function') return runFrontierChallengeAction(this, options);
      return this.startFrontierChallenge(options);
    }
    if (action === "future-source" && typeof this.startFrontierChallenge === 'function') {
      const options = { source: "future-source" };
      if (typeof runFrontierChallengeAction === 'function') return runFrontierChallengeAction(this, options);
      return this.startFrontierChallenge(options);
    }
    if (action === "daily" && typeof this.startDailySignal === 'function') {
      if (typeof runDailySignalAction === 'function') return runDailySignalAction(this);
      return this.startDailySignal();
    }
    if (action === "launch" && typeof this.beginNextPlanetNavigation === 'function') {
      this.beginNextPlanetNavigation();
      return true;
    }
    if (action === "log") {
      if (typeof switchMainMode === 'function') switchMainMode('notebook');
      return true;
    }
    this.startLevel(this.currentPlanetIndex, true);
    return true;
  }

  runClearCadetAIAction(cardId = null) {
    const fallback = typeof getCadetIdentityPreview === 'function'
      ? (getCadetIdentityPreview(this).aiAction || {}).cardId
      : null;
    const id = cardId || fallback;
    if (!id || typeof runAIStateDeckAction !== 'function') return false;
    return runAIStateDeckAction(id, this);
  }

  runClearCadetLessonPathAction(missionId = null) {
    const fallback = typeof getCadetIdentityPreview === 'function'
      ? (getCadetIdentityPreview(this).lessonPathAction || {}).missionId
      : null;
    const id = missionId || fallback;
    if (!id || typeof runCadetLessonPathAction !== 'function') return false;
    return runCadetLessonPathAction(id, this);
  }

  getClearExplainMission() {
    if (typeof getActivePlatformerMission === 'function') {
      return getActivePlatformerMission(this);
    }
    const missions = this.currentPlanet && Array.isArray(this.currentPlanet.missions) ? this.currentPlanet.missions : [];
    return missions.find(mission => !(this.completedMissions && this.completedMissions.has(mission.id))) || missions[0] || null;
  }

  getClearExplainPrompt() {
    const activeMission = this.getClearExplainMission();
    const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
    const reflection = fullMission && Array.isArray(fullMission.reflection) ? fullMission.reflection : [];
    const lessonPhase = typeof getNotebookLessonPhaseReflection === 'function'
      ? getNotebookLessonPhaseReflection(this, activeMission)
      : null;
    const context = this.reflectionContext || null;
    const repairProof = context && context.kind === "repair-proof" && context.proofSourceKey ? context : null;
    const repairAlreadyExplained = repairProof && typeof hasRepairReflectionCredit === 'function'
      ? hasRepairReflectionCredit(this, repairProof.proofSourceKey)
      : false;
    const question = (lessonPhase && lessonPhase.question) || reflection[0] || "Explain what changed, what evidence you saw, and why the physics behaved that way.";
    const evidence = typeof buildReflectionEvidenceStarter === 'function'
      ? buildReflectionEvidenceStarter(this, activeMission)
      : "Evidence starter - describe the code you tried, what changed, and why the physics behaved that way.";
    if (repairProof && !repairAlreadyExplained) {
      const repairTitle = repairProof.title || "Crash repair proof";
      const repairCommand = repairProof.command ? ` Code: ${repairProof.command}.` : "";
      const prediction = repairProof.prediction ? ` Prediction: ${repairProof.prediction}.` : "";
      return {
        kicker: "EXPLAIN REPAIR PROOF",
        title: `Explain ${repairTitle}`,
        question: `What failed, what did the repair command change, and what evidence showed the next run improved?${repairCommand}${prediction}`,
        evidence,
        reward: "Reward: Repair Reflection Proof",
        cta: "WRITE REPAIR PROOF",
        preserveReflectionContext: true
      };
    }
    return {
      kicker: lessonPhase ? "EXPLAIN THE PHASE" : "EXPLAIN THE EVIDENCE",
      title: lessonPhase ? `Explain ${lessonPhase.title}` : "Finish the lab loop",
      question,
      evidence,
      reward: "Reward: notebook proof + Research XP",
      cta: "WRITE EXPLANATION"
    };
  }

  runClearExplainPrompt(options = {}) {
    if (!options || !options.preserveReflectionContext) this.reflectionContext = null;
    const activeMission = this.getClearExplainMission();
    if (typeof updateActiveQuestion === 'function') updateActiveQuestion(this);
    if (this.player && typeof updateNotebook === 'function') updateNotebook(this);
    if (typeof updateReflectionEvidenceStarter === 'function') {
      updateReflectionEvidenceStarter(this, activeMission);
    }
    if (typeof switchMainMode === 'function') switchMainMode('notebook');
    const response = typeof document !== 'undefined' ? document.getElementById("notebook-user-response") : null;
    if (response && typeof response.focus === 'function') response.focus();
    return true;
  }

  getClearSignalStoryPreview({ isDailyRun = false, isFrontierRun = false, nextIndex = null } = {}) {
    if (isDailyRun || isFrontierRun || nextIndex === null || typeof getSignalStoryProgress !== 'function') return null;
    const story = getSignalStoryProgress(this);
    const chapter = story && story.nextChapter ? story.nextChapter : null;
    if (!chapter) return null;
    const targetName = typeof PLANETS !== 'undefined' && PLANETS[nextIndex] ? PLANETS[nextIndex].name : "the next world";
    return {
      kicker: "NEXT SIGNAL CHAPTER",
      title: chapter.title,
      concept: chapter.concept,
      body: `Launch toward ${targetName} to decode the next science story.`,
      progress: `${story.unlocked.length}/${story.total} decoded`
    };
  }

  spawnSignalStoryUnlockEffect(chapter) {
    if (!chapter) return null;
    const story = typeof getSignalStoryProgress === 'function' ? getSignalStoryProgress(this) : null;
    const progress = story ? `${story.unlocked.length}/${story.total} decoded` : "";
    const px = this.player
      ? (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2
      : 0;
    const py = this.player
      ? (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2
      : 0;
    const monitorText = `SIGNAL DECODED: ${chapter.title || "new chapter"}`;
    const effect = {
      label: "SIGNAL DECODED!",
      chapterId: chapter.id || null,
      chapterTitle: chapter.title || "Signal chapter",
      concept: chapter.concept || "Science signal",
      progress,
      monitorText,
      x: px,
      y: py
    };
    this.lastSignalStoryEffect = effect;

    if (typeof ui_log_output === 'function') {
      ui_log_output(`Signal decoded: ${effect.chapterTitle} - ${effect.concept}.`, "success");
    }
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, py - 28, effect.label, "#67e8f9", 1.12);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 8, '#67e8f9', 18, 2.7, 2.6, 'glow');
      Particles.spawnBurst(px, py - 8, '#fef08a', 8, 2.0, 2.0, 'glow');
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(monitorText, {
        title: "STAR-MAP SIGNAL",
        color: "#67e8f9",
        timer: 300
      });
    }
    return effect;
  }

  getUnlockedSignalStoryIds() {
    if (typeof getSignalStoryProgress !== 'function') return new Set();
    const story = getSignalStoryProgress(this);
    const unlocked = story && Array.isArray(story.unlocked) ? story.unlocked : [];
    return new Set(unlocked.map(chapter => chapter && chapter.id).filter(Boolean));
  }

  getNewSignalStoryChapters(previousIds) {
    if (typeof getSignalStoryProgress !== 'function') return [];
    const before = previousIds instanceof Set
      ? previousIds
      : new Set(Array.isArray(previousIds) ? previousIds : []);
    const story = getSignalStoryProgress(this);
    const unlocked = story && Array.isArray(story.unlocked) ? story.unlocked : [];
    return unlocked.filter(chapter => chapter && chapter.id && !before.has(chapter.id));
  }

  getClearSignalStoryUnlock({ labStars = null, isDailyRun = false, isFrontierRun = false } = {}) {
    if (typeof getSignalStoryProgress !== 'function') return null;
    const story = getSignalStoryProgress(this);
    const unlocked = Array.isArray(this.lastSignalStoryUnlocks) && this.lastSignalStoryUnlocks.length
      ? this.lastSignalStoryUnlocks
      : [];
    let chapter = unlocked[0] || null;
    if (!chapter && !isDailyRun && !isFrontierRun) {
      const chapters = story && Array.isArray(story.chapters) ? story.chapters : [];
      const campaignIndex = Math.max(1, (Number(this.currentPlanetIndex) || 0) + 1);
      chapter = chapters.find(item => item && item.unlocked && item.index === campaignIndex) || null;
      if (!chapter && labStars && labStars.isNewMastery) {
        chapter = chapters.find(item => item && item.unlocked && item.id === "mastery-remix") || null;
      }
    }
    if (!chapter) return null;
    return {
      kicker: "SIGNAL DECODED",
      title: chapter.title,
      concept: chapter.concept,
      body: chapter.bodyText || "",
      progress: `${story.unlocked.length}/${story.total} decoded`
    };
  }

  getClearLabStarSummary({ isDailyRun = false, isFrontierRun = false } = {}) {
    const status = (typeof this.getLevelObjectiveStatus === 'function')
      ? this.getLevelObjectiveStatus()
      : { missionsTotal: 0, allMissionsComplete: false, collectiblesTotal: 0, allCollectiblesCollected: false };
    const missions = this.currentPlanet && Array.isArray(this.currentPlanet.missions) ? this.currentPlanet.missions : [];
    const missionIds = new Set();
    missions.forEach(mission => {
      if (!mission) return;
      if (mission.id) missionIds.add(mission.id);
      if (mission.fullMission && mission.fullMission.id) missionIds.add(mission.fullMission.id);
    });
    if (typeof PlatformerMissions !== 'undefined' && Array.isArray(PlatformerMissions)) {
      PlatformerMissions
        .filter(mission => mission && mission.planetId === this.currentPlanetIndex)
        .forEach(mission => missionIds.add(mission.id));
    }

    const confirmed = this.confirmedHypotheses instanceof Set
      ? this.confirmedHypotheses
      : new Set(Array.isArray(this.confirmedHypotheses) ? this.confirmedHypotheses : []);
    const passCounts = this.discoveryPassCounts && typeof this.discoveryPassCounts === 'object'
      ? this.discoveryPassCounts
      : {};
    const scienceProof = Array.from(missionIds).some(id =>
      confirmed.has(id) || Number(passCounts[id]) > 0
    );

    const checks = [
      { id: "missions", label: "Mission tasks", earned: status.missionsTotal > 0 && !!status.allMissionsComplete },
      { id: "gems", label: "Mission gems", earned: status.collectiblesTotal > 0 && !!status.allCollectiblesCollected },
      { id: "science", label: "Science proof", earned: scienceProof }
    ];
    const stars = checks.filter(check => check.earned).length;
    const key = this.getClearLabStarKey({ isDailyRun, isFrontierRun });
    const previousBest = Number(this.bestLabStars && this.bestLabStars[key]) || 0;
    return {
      key,
      stars,
      maxStars: checks.length,
      checks,
      previousBest,
      best: Math.max(previousBest, stars),
      isNewBest: stars > previousBest
    };
  }

  recordClearLabStars({ isDailyRun = false, isFrontierRun = false } = {}) {
    const summary = this.getClearLabStarSummary({ isDailyRun, isFrontierRun });
    this.bestLabStars = this.bestLabStars || {};
    const starGain = Math.max(0, summary.stars - summary.previousBest);
    let masteryMeter = null;
    if (summary.stars > summary.previousBest) {
      this.bestLabStars[summary.key] = summary.stars;
      if (!isDailyRun && starGain > 0) {
        masteryMeter = this.awardWorldMasteryXP(starGain * 20, "lab-star best", {
          sourceKey: `lab-stars:${summary.key}:${summary.stars}`,
          silent: true
        });
      }
    }
    const mastered = !isDailyRun && summary.maxStars > 0 && summary.stars >= summary.maxStars;
    const masteryKey = String(this.currentPlanetIndex || 0);
    const wasMastered = !!(this.masteryCleared && this.masteryCleared[masteryKey]);
    if (mastered) {
      this.masteryCleared = this.masteryCleared || {};
      this.masteryCleared[masteryKey] = true;
    }
    return {
      ...summary,
      best: Math.max(summary.previousBest, summary.stars),
      mastered,
      isNewMastery: mastered && !wasMastered,
      worldMastery: masteryMeter ? masteryMeter.progress : this.getWorldMasteryProgress(this.currentPlanetIndex),
      worldMasteryAddedXP: masteryMeter ? masteryMeter.addedXP : 0,
      worldMasteryTierAwards: masteryMeter ? masteryMeter.tierAwards : []
    };
  }

  grantMasteryClearReward(labStars) {
    if (!labStars || !labStars.isNewMastery) return labStars;
    const futureLabScene = this.discoveryPulse && this.discoveryPulse.futureLabScene
      ? this.discoveryPulse.futureLabScene
      : null;
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const xp = MASTERY_CLEAR_RESEARCH_XP;
    this.researchXP = Math.max(0, (this.researchXP || 0) + xp);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const pulse = {
      kind: "mastery",
      title: "Mastery Clear",
      formula: "3 stars = tasks + gems + science proof",
      insight: "A 3-star clear means the code worked, the samples were collected, and the experiment left evidence.",
      cue: "Replay a mastered world as a remix and compare what changed.",
      missionId: `mastery-${this.currentPlanetIndex}`,
      missionTitle: this.currentPlanet ? this.currentPlanet.name : "World",
      passed: labStars.maxStars || 3,
      total: labStars.maxStars || 3,
      openedGems: 0,
      rewardXP: xp,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      futureLabScene
    };
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);
    if (typeof ui_log_output === 'function') {
      ui_log_output(`🏅 Mastery clear: +${xp} Research XP${rankUp && afterRank ? ` — ${afterRank.title}` : ""}.`, "success");
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    return {
      ...labStars,
      masteryRewardXP: xp,
      masteryRankUp: rankUp,
      masteryRankTitle: afterRank ? afterRank.title : null
    };
  }

  checkLabStarProgress(reason = "progress") {
    const summary = this.getClearLabStarSummary();
    const current = Number(summary.stars) || 0;
    const previous = Number.isFinite(this._labStarPreviewCount) ? this._labStarPreviewCount : current;
    if (!Number.isFinite(this._labStarPreviewCount)) {
      this._labStarPreviewCount = current;
      return 0;
    }
    if (current <= previous) {
      this._labStarPreviewCount = Math.min(previous, current);
      return 0;
    }

    const gained = current - previous;
    this._labStarPreviewCount = current;
    const earnedGoals = summary.checks
      .filter(check => check && check.earned)
      .slice(previous, current)
      .map(check => {
        if (check.id === "missions") return "Tasks";
        if (check.id === "gems") return "Samples";
        if (check.id === "science") return "Proof";
        return check.label || "Goal";
      });
    const goalLabel = earnedGoals.length ? earnedGoals.join(" + ") : "Mastery goal";
    const label = gained > 1 ? `LAB STARS +${gained}` : "LAB STAR +1";
    const nextMissing = summary.checks.find(check => check && !check.earned);
    const nextLabel = nextMissing
      ? (nextMissing.id === "missions" ? "Tasks" : nextMissing.id === "gems" ? "Samples" : nextMissing.id === "science" ? "Proof" : (nextMissing.label || "Goal"))
      : null;
    const monitorText = nextLabel
      ? `LAB STARS ${current}/${summary.maxStars}: ${goalLabel}; next ${nextLabel}`
      : `LAB STARS ${current}/${summary.maxStars}: mastery proof ready`;
    this.lastLabStarPulse = { stars: current, gained, reason, goals: earnedGoals, goalLabel, nextGoal: nextLabel, monitorText };
    if (typeof ui_log_output === 'function') {
      ui_log_output(`${label}: ${goalLabel} (${current}/${summary.maxStars} mastery goals complete).`, "success");
    }
    const hasActiveMonitorCue = !!(this.missionBalloon && (this.missionBalloon.timer || 0) > 0 && this.missionBalloon.title !== "LAB STARS");
    if (!hasActiveMonitorCue && typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(monitorText, {
        title: "LAB STARS",
        color: "#facc15",
        timer: 260
      });
    }
    if (typeof SFX !== 'undefined' && SFX.playSuccess) SFX.playSuccess();
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(this.player.x + this.player.w / 2, this.player.y - 18, label, "#facc15", 1.12);
      ComicBubbles.pop(this.player.x + this.player.w / 2, this.player.y + 2, goalLabel.toUpperCase(), "#a7f3d0", 0.78);
    }
    if (this.player && typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#facc15', 16, 2.8, 2.8, 'glow');
    }
    return gained;
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

  getLockedRequiredCollectibles() {
    if (!Array.isArray(this.interactiveObjects)) return [];
    return this.interactiveObjects.filter(obj =>
      obj.type === 'coin'
      && obj.requiredCollectible
      && !obj.collected
      && !this.canCollectGem(obj)
    );
  }

  getLockedRequiredCollectibleCount() {
    return this.getLockedRequiredCollectibles().length;
  }

  spawnGemGateUnlockEffects(previouslyLocked) {
    const before = previouslyLocked instanceof Set
      ? previouslyLocked
      : new Set(Array.isArray(previouslyLocked) ? previouslyLocked : []);
    if (!before.size || !Array.isArray(this.interactiveObjects)) return { opened: 0, targets: [] };
    const targets = [];

    for (const obj of before) {
      if (!obj || obj.type !== 'coin' || !obj.requiredCollectible || obj.collected) continue;
      if (!this.interactiveObjects.includes(obj)) continue;
      if (obj.gateOpenEffectPlayed) continue;
      if (!this.canCollectGem(obj)) continue;
      targets.push(obj);
    }

    const limit = 5;
    for (const obj of targets) obj.gateOpenEffectPlayed = true;
    for (const obj of targets.slice(0, limit)) {
      const gem = obj.gem || this.getGemConfig();
      const color = gem && gem.color ? gem.color : "#facc15";
      const cx = (Number.isFinite(obj.x) ? obj.x : 0) + (Number.isFinite(obj.w) ? obj.w : 16) / 2;
      const cy = (Number.isFinite(obj.y) ? obj.y : 0) + (Number.isFinite(obj.h) ? obj.h : 16) / 2;
      obj.unlockPulse = 1;
      if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
        ComicBubbles.pop(cx, cy - 16, "OPEN!", color, 1.05);
      }
      if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
        Particles.spawnBurst(cx, cy, color, 12, 2.2, 2.0, 'glow');
        Particles.spawnBurst(cx, cy, '#bbf7d0', 6, 1.7, 1.6, 'glow');
      }
    }
    return { opened: targets.length, targets };
  }

  spawnMissionSampleCollectedEffect(obj, gem, collectedAllSamples = false) {
    if (!obj) return null;
    const color = gem && gem.color ? gem.color : "#facc15";
    const cx = (Number.isFinite(obj.x) ? obj.x : 0) + (Number.isFinite(obj.w) ? obj.w : 16) / 2;
    const cy = (Number.isFinite(obj.y) ? obj.y : 0) + (Number.isFinite(obj.h) ? obj.h : 16) / 2;
    const total = Math.max(0, Math.floor(Number(this.requiredCollectiblesTotal) || 0));
    const collected = Math.max(0, Math.floor(Number(this.requiredCollectiblesCollected) || 0));
    const label = collectedAllSamples
      ? "ALL SAMPLES!"
      : (total > 0 ? `SAMPLE ${collected}/${total}` : "SAMPLE");
    const popColor = collectedAllSamples ? "#4ade80" : color;

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(cx, cy - 16, label, popColor, collectedAllSamples ? 1.25 : 1.05);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(cx, cy, color, collectedAllSamples ? 16 : 10, collectedAllSamples ? 2.6 : 2.0, 2.4, 'glow');
      if (collectedAllSamples) Particles.spawnBurst(cx, cy, '#bbf7d0', 8, 1.8, 1.7, 'glow');
    }
    return { label, color: popColor, x: cx, y: cy, collected, total, complete: !!collectedAllSamples };
  }

  getNextMissionSampleTarget() {
    if (!this.player || !Array.isArray(this.interactiveObjects)) return null;
    const px = (Number.isFinite(this.player.x) ? this.player.x : 0) + (Number.isFinite(this.player.w) ? this.player.w : 24) / 2;
    const py = (Number.isFinite(this.player.y) ? this.player.y : 0) + (Number.isFinite(this.player.h) ? this.player.h : 32) / 2;
    let best = null;
    let bestDist = Infinity;

    for (const obj of this.interactiveObjects) {
      if (!obj || obj.type !== 'coin' || !obj.requiredCollectible || obj.collected) continue;
      if (!this.canCollectGem(obj)) continue;
      const ox = (Number.isFinite(obj.x) ? obj.x : 0) + (Number.isFinite(obj.w) ? obj.w : 16) / 2;
      const oy = (Number.isFinite(obj.y) ? obj.y : 0) + (Number.isFinite(obj.h) ? obj.h : 16) / 2;
      const dist = (ox - px) * (ox - px) + (oy - py) * (oy - py);
      if (dist < bestDist) {
        best = obj;
        bestDist = dist;
      }
    }
    return best;
  }

  getReadyPortalTarget() {
    if (!this.player || !Array.isArray(this.interactiveObjects)) return null;
    const status = typeof this.getLevelObjectiveStatus === 'function' ? this.getLevelObjectiveStatus() : null;
    if (!status || !status.readyForPortal) return null;
    return this.interactiveObjects.find(obj => obj && obj.type === 'portal' && !obj.collected) || null;
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
    this.showMissionBalloon(`REQ: ${obj.gemGate.short || obj.gemGate.label}`, { title: "GEM LOCK" });
    SFX.playError();
    updateMissionList(this);
  }

  // Screen-space mission monitor for requirements and tutorial messages. Important
  // information no longer depends on character speech bubbles being visible.
  showMissionBalloon(text, opts) {
    opts = opts || {};
    this.missionBalloon = {
      text: text,
      title: opts.title || "MISSION CRT",
      timer: opts.timer || 250,    // ~4.1s at 60fps
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
    const H = this.canvas ? this.canvas.height : 448;
    ctx.save();
    ctx.font = "9px 'Press Start 2P', monospace";
    // Word-wrap the FULL text to a max width so the box size is steady while typing.
    const maxW = Math.min(330, W - 28);
    const words = mb.text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW - 30 && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const shownLines = lines.slice(0, 5);
    const lineH = 14;
    const titleH = 18;
    const boxW = Math.min(maxW, Math.max(...shownLines.map(l => ctx.measureText(l).width), ctx.measureText(mb.title || "").width + 72) + 30);
    const boxH = titleH + shownLines.length * lineH + 18;
    const bx = W > 620 ? W - boxW - 14 : Math.max(12, (W - boxW) / 2);
    const by = Math.max(58, Math.min(H - boxH - 14, 68));

    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(34, 197, 94, 0.28)';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
    ctx.strokeStyle = '#0b1022';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, boxW + 8, boxH + 8, 7); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 5); ctx.fill(); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx + 3, by + 3, boxW - 6, boxH - 6, 4); ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = by + 5; y < by + boxH - 4; y += 4) ctx.fillRect(bx + 4, y, boxW - 8, 1);
    ctx.restore();

    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fillRect(bx + 3, by + 3, boxW - 6, titleH);
    ctx.fillStyle = '#facc15';
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(mb.title || "MISSION CRT", bx + 22, by + 12);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(bx + 9, by + 8, 7, 7);
    ctx.fillStyle = 'rgba(187, 247, 208, 0.72)';
    ctx.fillRect(bx + boxW - 34, by + 8, 6, 6);
    ctx.fillRect(bx + boxW - 22, by + 8, 6, 6);

    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = '#bbf7d0';
    ctx.textBaseline = 'middle';
    let used = 0;
    for (let i = 0; i < shownLines.length; i++) {
      const full = shownLines[i];
      const remain = Math.max(0, shown.length - used);
      const part = full.slice(0, remain);
      used += full.length + 1; // + the space
      ctx.fillText(part, bx + 14, by + titleH + 13 + i * lineH);
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
      this.showMissionBalloon(`REQ: ${this.formatObjectiveLockMessage(status)}`, { title: "PORTAL LOCK", timer: 320 });
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
        // Keep cosmetic timers ticking while paused so speech / onomatopoeia bubbles still
        // fade instead of freezing on screen (you can pause a long time to write code).
        this.tickPausedCosmetics();
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

  // Decay short-lived visual timers while the world is paused, so speech/onomatopoeia
  // bubbles, the hurt flash, etc. fade out instead of freezing on screen during a pause.
  tickPausedCosmetics() {
    if (this.player && typeof this.player.updateSpeech === 'function') this.player.updateSpeech();
    if (this.mobs) for (const m of this.mobs) { if (m.sayTimer > 0) m.sayTimer--; }
    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.update) ComicBubbles.update();
    this.updateFormulaCardEffects();
    if (this.hurtFlashTimer > 0) this.hurtFlashTimer--;
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

    // Health timers: i-frame blink window counts down; hurt red-flash fades.
    if (this.player && this.player.invulnerableFrames > 0) this.player.invulnerableFrames--;
    if (this.hurtFlashTimer > 0) this.hurtFlashTimer--;
    if (this.player && this.player.landSquash > 0) this.player.landSquash = Math.max(0, this.player.landSquash - 0.12);

    // 2. Run real-time mission completion validator
    this.checkMissions();

    // 3. Update character inputs and accelerations
    // Infinite tank: keep only the RESERVE topped up — the thruster still drains and refills
    // from it normally, so sustained mid-air rocketing is still limited, but the tank never
    // runs dry (no stranding, always refuels on the ground).
    if (this.infiniteFuel && this.player) {
      this.player.tank = this.player.maxTank;
    }
    this.player.update(this.keys, this.currentPlanet, this);

    // 4. Magnetic force application
    Physics.applyMagnetism(this.player, this.interactiveObjects, this.currentPlanet);

    // 5. Resolve rigid body collisions (capture pre-collision fall to detect a hard landing)
    const _preFallVy = this.player.vy;
    const _wasAirborne = !this.player.onGround;
    Physics.resolveWorldCollisions(this.player, this.getActiveMap(), this.spawnedBoxes, this);
    this.updateDrill();
    if (_wasAirborne && this.player.onGround) {
      // Soft "tick" on any real landing closes the jump loop; the bigger dust + bubble
      // only fire on a hard landing so light hops stay subtle.
      if (_preFallVy > 1.2 && typeof SFX !== 'undefined' && SFX.playLanding) SFX.playLanding();
      // Squash on impact, scaled by how hard you hit (drives the foot-anchored draw scale).
      this.player.landSquash = Math.min(1, Math.max(0.25, _preFallVy / 9));
      if (_preFallVy > 4 && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y + this.player.h, SPEECH.pick("land"), "rounded", "#d6d3d1", -0.3, { maxLife: 34, scale: 0.8 });
        Particles.spawnBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h, '#cbd5e1', 6, 1.4, 2);
      }
      if (_preFallVy > 7 && !this.reducedMotion) { this.shakeFrames = 6; this.shakeMag = 4; this.shakeMax = 6; }
    }
    if (this.player && typeof this.player.consumeJumpBuffer === 'function') {
      this.player.consumeJumpBuffer(this.currentPlanet, this);
    }

    // Run dust: little puffs kicked up when sprinting on the ground.
    if (this.player.onGround && Math.abs(this.player.vx) > 2.2 && Math.random() < 0.3) {
      Particles.spawn(this.player.x + this.player.w / 2 - (this.player.facing || 1) * 6, this.player.y + this.player.h - 2,
        'rgba(255,255,255,0.5)', 2, -(this.player.facing || 1) * 0.6, -0.4, 16, 'glow');
    }

    // 6. Terrain hazards (spikes) chip health + bounce the cadet off (i-frames prevent
    // a multi-hit drain in one touch). Death at 0 health routes through killPlayer.
    if (Physics.getHazardCollisions(this.player, this.getActiveMap()).length > 0) {
      this.damagePlayer(1, "hazard");
      if (this.state === 'gameover') return;
    }

    // 7. Check if player fell out of bounds (dead)
    if (this.player.y > 450) {
      this.killPlayer("fell out of bounds!", "fall");
      return;
    }

    // 7b. Stranded: thruster AND tank both bone-dry, so there's no way to recharge → restart
    // like a death. Normal jumps still work at empty, so this only bites after the whole
    // reserve is spent with no canister found.
    if (this.player.fuel <= 0 && (this.player.tank || 0) <= 0) {
      this.strandedTimer = (this.strandedTimer || 0) + 1;
      if (this.strandedTimer > 150) {
        this.killPlayer("stranded — out of fuel!", "fuel");
        return;
      }
    } else {
      this.strandedTimer = 0;
    }

    // 8. Update camera positioning (lerp horizontal viewport centering)
    // Look-ahead: bias the view toward where the cadet faces/moves, so the camera feels
    // alive and you can see what's coming.
    const lookAhead = (this.player.facing || 1) * 50 + this.player.vx * 6;
    const targetCamX = this.player.x - this.canvas.width / 2 + lookAhead;
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
            // Greet once per contact, not every overlapping frame — otherwise the uncapped
            // "HELLO!" bubbles (and the bounce SFX) machine-gun while the cadet stays in touch.
            if (!enemy._greeted) {
              enemy._greeted = true;
              SFX.playJump();
              if (typeof ComicBubbles !== 'undefined') {
                ComicBubbles.spawn(enemy.x + enemy.w/2, enemy.y, "HELLO!", "rounded", "#4ade80");
              }
            }
          } else {
            this.damagePlayer(1, "enemy", enemy.x);
            if (this.state === 'gameover') return;
          }
        }
      } else if (enemy._greeted) {
        enemy._greeted = false; // re-arm the greeting once the cadet steps away
      }
    }

    // 9b. Drifting space debris (ambient hazard on space-y worlds)
    this.updateDebris();
    if (this.state === 'gameover') return;

    // 9c. Meteor shower event (warning → falling meteors; shelter under overhangs)
    this.updateMeteors();
    if (this.state === 'gameover') return;

    // 10. Update objects and check collisions
    this.activeNPC = null;
    for (const obj of this.interactiveObjects) {
      obj.update(this);
      if (obj.collected) continue;

      if (typeof NPC !== 'undefined' && obj instanceof NPC) {
        this.damageNPCFromHazards(obj);
        const shelterSignal = this.getVillagerShelterSignal(obj);
        if (obj.proximity && this.canNPCTrade(obj, shelterSignal)) this.activeNPC = obj;
        else if (obj.proximity) obj.proximity = false;
      }

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
          const collectedAllSamples = obj.requiredCollectible && this.requiredCollectiblesTotal > 0 &&
            this.requiredCollectiblesCollected >= this.requiredCollectiblesTotal;
          if (obj.requiredCollectible) {
            this.spawnMissionSampleCollectedEffect(obj, gem, collectedAllSamples);
          } else {
            Particles.spawnBurst(obj.x + 8, obj.y + 8, gem.color, 10, 2, 2.5, 'glow');
            if (typeof ComicBubbles !== 'undefined') {
              // Bonus gems are frequent — keep them as the lighter small balloon.
              ComicBubbles.spawn(obj.x + 8, obj.y, SPEECH.pick("get"), "rounded", "#facc15");
            }
          }
          if (obj.requiredCollectible) {
            ui_log_output(`◆ ${gem.name} gem collected: ${this.requiredCollectiblesCollected}/${this.requiredCollectiblesTotal}`, "success");
            this.checkLabStarProgress("gems");
            updateMissionList(this);
            this.checkPortalReadyCue("gems");
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
        } else if (obj.type === 'weapon') {
          obj.collected = true;
          this.equipWeapon('blaster');
        } else if (obj.type === 'fuel') {
          // A fuel canister tops the TANK back to full (and a little thruster), so the finite
          // reserve can be replenished mid-level without dying.
          obj.collected = true;
          this.player.tank = this.player.maxTank || 200;
          this.player.fuel = Math.min(this.player.maxFuel || 100, (this.player.fuel || 0) + 40);
          if (typeof SFX !== 'undefined' && SFX.playCoin) SFX.playCoin();
          Particles.spawnBurst(obj.x + obj.w / 2, obj.y + obj.h / 2, '#f97316', 12, 2.2, 2.6, 'glow');
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(obj.x + obj.w / 2, obj.y - 4, "REFUEL!", "#f97316", 1.1);
          ui_log_output("⛽ Fuel canister — tank refilled!", "success");
        } else if (obj.type === 'food') {
          obj.collected = true;
          const before = this.player.health || 0;
          this.player.health = Math.min(this.player.maxHealth || 3, before + 1);
          if (typeof SFX !== 'undefined' && SFX.playCoin) SFX.playCoin();
          Particles.spawnBurst(obj.x + obj.w / 2, obj.y + obj.h / 2, '#fb7185', 12, 2.2, 2.6, 'glow');
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(obj.x + obj.w / 2, obj.y - 4, this.player.health > before ? "+HP" : "YUM!", "#fb7185", 1.05);
          ui_log_output(this.player.health > before ? "🍎 Snack restored one heart." : "🍎 Snack saved for morale — health already full.", "success");
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
    // Reveal the on-screen TRADE button (touch devices) only while a villager is in range.
    this.syncTradeTouchControls();

    // 11. Update spawned box boxes (AABB block pushes)
    for (const box of this.spawnedBoxes) {
      box.update();
    }

    // 12. Update particle systems
    Particles.update();
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.update();
    }
    this.updateFormulaCardEffects();

    // 12b. Idle banter: a quiet thought bubble after standing still a while (once per pause).
    this.updateIdleBanter();

    // 12c. Mob Survival mini-mode (mobs, score, rewards).
    if (this.survivalMode) this.updateSurvival();

    // 12d. Combat: firing + projectiles. Works in normal play once a weapon is found
    // (and always in survival). Projectiles hit campaign enemies AND survival mobs.
    this.updateCombat();

    // 12e. Mobs (survival spawns + block-woken) move and fight here.
    this.updateMobs();
    if (this.state === 'gameover') return;
    this.updateVillagerShelterStates();

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
    let shelterSync = null;
    const btn = document.getElementById('survival-btn');
    if (btn) btn.classList.toggle('survival-on', this.survivalMode);
    const touch = document.getElementById('touch-controls');
    if (touch) touch.classList.toggle('survival', this.survivalMode); // reveal the FIRE button
    if (this.survivalMode) {
      this.lastVillageShelterSync = null;
      if (typeof SFX !== 'undefined' && SFX.startSurvivalBGM) SFX.startSurvivalBGM(this.currentPlanetIndex);
      ui_log_output("👾 MOB SURVIVAL on! Jump on critters or press F to shoot. Score → bigger guns + a rave shield.", "success");
      if (this.player && typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 4, "SURVIVE!", "jagged", "#ef4444", -0.4, { maxLife: 75, scale: 1.4 });
      }
    } else {
      if (typeof SFX !== 'undefined' && SFX.stopSurvivalBGM) SFX.stopSurvivalBGM(this.currentPlanetIndex);
      if (typeof this.releaseVillagersFromCaves === 'function') {
        shelterSync = this.releaseVillagersFromCaves();
        this.lastVillageShelterSync = shelterSync;
      }
      ui_log_output("Mob Survival off — back to engineering.", "info");
    }
    if (typeof updateMissionList === 'function') updateMissionList(this);
    if (typeof updateHUD === 'function') updateHUD(this);
    return shelterSync;
  }

  // Flip the infinite-tank toggle. When on, update() keeps fuel topped so the cadet can fly
  // and experiment without running dry; persisted so it survives a reload.
  toggleInfiniteFuel() {
    this.infiniteFuel = !this.infiniteFuel;
    if (typeof localStorage !== 'undefined') localStorage.setItem('sh-infinite-fuel', this.infiniteFuel ? '1' : '0');
    this.syncInfiniteFuelButton();
    if (this.infiniteFuel && this.player) {
      this.player.tank = this.player.maxTank;   // fill only the reserve; the thruster still drains from it
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(this.infiniteFuel ? "♾️ Infinite tank ON — fuel never runs out." : "Infinite tank OFF — fuel is limited again.", this.infiniteFuel ? "success" : "info");
    }
    if (this.infiniteFuel && this.player && typeof ComicBubbles !== 'undefined') {
      ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 4, "FULL TANK!", "rounded", "#f97316", -0.3, { maxLife: 70, scale: 1.2 });
    }
  }

  // Reflect the persisted infinite-fuel state on its toggle button (called on toggle + init).
  syncInfiniteFuelButton() {
    const btn = document.getElementById('infinite-fuel-btn');
    if (btn) btn.classList.toggle('infinite-on', !!this.infiniteFuel);
  }

  spawnMob() {
    if (!this.currentPlanet || !this.currentPlanet.map) return;
    const theme = (typeof MOB_THEMES !== 'undefined' && MOB_THEMES[this.currentPlanetIndex]) || ["blob"];
    const species = theme[Math.floor(Math.random() * theme.length)];
    const accent = (this.currentPlanet && this.currentPlanet.color) || '#a78bfa';
    const aggro = [0.5, 0.65, 0.9, 0.75, 0.85, 0.8][this.currentPlanetIndex] || 0.7;
    const mapW = this.getActiveMap()[0].length * TILE_SIZE;
    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? this.cameraX - 20 : this.cameraX + this.canvas.width + 20;
    x = Math.max(0, Math.min(mapW - 30, x));
    const m = new Mob(x, 50, species, accent, aggro);
    m.say(SPEECH.pick('mobChatter'));
    this.mobs.push(m);
  }

  killMob(index, cause) {
    const m = this.mobs[index];
    if (!m) return;
    const wasPet = !!m.pet;
    this.mobs.splice(index, 1);
    if (!wasPet) {
      this.survivalScore += (cause === 'stomp' ? 15 : cause === 'shot' ? 10 : cause === 'pet' ? 12 : 8);
    }
    if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(m.x + m.w / 2, m.y - 4, wasPet ? "FRIEND!" : SPEECH.pick('mobDeath'), wasPet ? "#4ade80" : "#fb7185", 1.0);
    Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, wasPet ? '#4ade80' : '#ef4444', 10, 2.5, 2.5, 'glow');
    if (!wasPet) this.checkSurvivalRewards();
  }

  hasTamingLotion() {
    return !!(this.unlockedTools && this.unlockedTools.has('taming_lotion'));
  }

  isTamableMob(m) {
    return !!(m && !m.pet && (m.species === 'blob' || m.species === 'critter'));
  }

  entityCenter(entity) {
    return {
      x: entity.x + (entity.w || 0) / 2,
      y: entity.y + (entity.h || 0) / 2
    };
  }

  entityDistance(a, b) {
    const ac = this.entityCenter(a);
    const bc = this.entityCenter(b);
    return Math.hypot(ac.x - bc.x, ac.y - bc.y);
  }

  tryTameMob(index, force = false) {
    const m = this.mobs && this.mobs[index];
    if (!this.player || !this.hasTamingLotion() || !this.isTamableMob(m)) return false;
    if (!force && this.entityDistance(this.player, m) > 58) return false;
    this.tameMob(m);
    return true;
  }

  tameMob(m) {
    if (!m) return;
    m.pet = true;
    m.woken = false;
    m.scaredTimer = 0;
    m.attackCooldown = 24;
    m.hp = Math.max(typeof m.hp === 'number' ? m.hp : 1, 2);
    m.say(SPEECH.pick('mobPet'));
    if (typeof SFX !== 'undefined' && SFX.playSuccess) SFX.playSuccess();
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop(m.x + m.w / 2, m.y - 5, "PET!", "#4ade80", 1.05);
    }
    if (typeof Particles !== 'undefined') {
      Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#4ade80', 12, 2.2, 2.3, 'glow');
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output("🧴 Calming lotion worked — a small mob joined your crew!", "success");
    }
    this.grantPetBondProof('tame', m);
  }

  getPetBondProofSourceKey(kind, index = this.currentPlanetIndex) {
    const planetKey = Number.isFinite(index) ? index : 0;
    return `pet:${kind || 'tame'}:${planetKey}`;
  }

  grantPetBondProof(kind = 'tame', mob = null, options = {}) {
    const action = kind === 'guard' ? 'guard' : 'tame';
    const sourceKey = this.getPetBondProofSourceKey(action);
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    if (this.discoveryPassCounts[sourceKey]) return null;

    const rewardXP = action === 'guard' ? 4 : 3;
    const masteryXP = action === 'guard' ? 10 : 7;
    const label = action === 'guard' ? 'GUARD PROOF' : 'PET PACT';
    const species = mob && mob.species ? String(mob.species) : 'small mob';
    const guardedVillager = action === 'guard' && options && options.target === 'villager';
    const guardTargetLabel = guardedVillager ? 'a villager' : 'the cadet';
    const formula = action === 'guard' ? `pet state -> protect ${guardedVillager ? 'village' : 'cadet'}` : 'scared mob + lotion -> pet state';
    const insight = action === 'guard'
      ? `A trained ${species} protected ${guardTargetLabel}. That is game AI changing state from follow to guard when danger gets close.`
      : `Calming lotion changed a scared ${species} into a pet. The hidden rule is a state change: wild -> scared -> friend.`;
    const cue = action === 'guard'
      ? 'Keep pets near the cadet or villagers so they can intercept hostile mobs.'
      : 'Use rave mode to scare a small mob, then let calming lotion turn it into a helper.';
    const color = action === 'guard' ? '#22c55e' : '#4ade80';
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, action === 'guard' ? 'pet guard proof' : 'pet bond proof', { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }
    const villageTrust = action === 'guard'
      ? this.grantVillageTrust(3, sourceKey, 'pet guard', { color })
      : null;

    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const pulse = {
      kind: 'pet',
      title: action === 'guard' ? 'Pet Guard Proof' : 'Pet Pact',
      formula,
      insight,
      cue,
      missionId: sourceKey,
      missionTitle: this.currentPlanet ? this.currentPlanet.name : 'Pet Lab',
      passed: 1,
      total: 1,
      progressLabel: action === 'guard' ? (guardedVillager ? 'pet protected village' : 'pet protected cadet') : `${species} trained`,
      openedGems: 0,
      rewardXP,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      petProof: {
        label,
        rewardXP,
        action,
        sourceKey
      },
      villageTrust: villageTrust && villageTrust.added > 0 ? villageTrust : null
    };
    this.attachFormulaCardUnlock(pulse, 'state');
    this.completeActiveAIStateRun(action === 'guard' ? 'guard-mode' : 'pet-pact', pulse);
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);

    if (typeof ui_log_output === 'function') {
      ui_log_output(`${label}: +${rewardXP} Research XP, +${pulse.worldMasteryAddedXP} world mastery XP.`, 'success');
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
    const fx = mob || this.player;
    if (fx && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(fx.x + (fx.w || 24) / 2, fx.y - 24, label, color, 0.9);
      ComicBubbles.pop(fx.x + (fx.w || 24) / 2, fx.y - 6, `+${rewardXP} LAB XP`, '#a7f3d0', 0.72);
    }
    if (fx && typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(fx.x + (fx.w || 24) / 2, fx.y + (fx.h || 24) / 2, color, 12, 2.0, 2.1, 'glow');
      Particles.spawnBurst(fx.x + (fx.w || 24) / 2, fx.y + (fx.h || 24) / 2, '#a7f3d0', 8, 1.6, 1.7, 'glow');
    }
    if (rankUp && typeof showBadgeToast === 'function') {
      showBadgeToast({
        icon: 'P',
        label: `Research Rank: ${afterRank.title}`,
        description: `Pet lab unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
        title: 'PET LAB',
        color,
        timer: 230
      });
    }
    this.grantVillageGuardianPact(pulse, { npc: fx, color });
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === this) saveLocalProgress();
    return pulse;
  }

  petFollowTarget(pet) {
    const facing = Math.sign((this.player && this.player.vx) || (this.player && this.player.facing) || (pet && pet.dir) || 1) || 1;
    return {
      x: this.player.x - facing * 42,
      y: this.player.y,
      w: this.player.w || 28,
      h: this.player.h || 28
    };
  }

  findNearestHostileMob(pet, radius = 190) {
    if (!pet || !this.mobs || !this.player) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      if (!m || m === pet || m.pet) continue;
      const petDist = this.entityDistance(pet, m);
      const playerDist = this.entityDistance(this.player, m);
      const villageThreat = typeof this.findNPCForMobAttack === 'function'
        ? this.findNPCForMobAttack(m, 72)
        : null;
      if ((petDist <= radius || playerDist <= 120 || (villageThreat && petDist <= radius + 80)) && petDist < bestDist) {
        best = { index: i, mob: m, distance: petDist };
        bestDist = petDist;
      }
    }
    return best;
  }

  findProtectingPet(hostile, target = this.player) {
    if (!hostile || !this.mobs || !this.player) return null;
    for (const pet of this.mobs) {
      if (!pet || !pet.pet || (pet.attackCooldown || 0) > 0) continue;
      const nearThreat = this.entityDistance(pet, hostile) <= 84;
      const guardingTarget = target &&
        this.entityDistance(hostile, target) <= 76 &&
        (this.entityDistance(pet, target) <= 112 || this.entityDistance(pet, hostile) <= 112);
      if (nearThreat || guardingTarget) return pet;
    }
    return null;
  }

  petStrikeMob(index, pet, guardTarget = null) {
    const m = this.mobs && this.mobs[index];
    if (!m || m.pet || !pet || (pet.attackCooldown || 0) > 0) return null;
    const guardingVillager = !!(guardTarget && guardTarget.profession);
    pet.attackCooldown = 32;
    pet.dir = m.x > pet.x ? 1 : -1;
    pet.eyeDir = pet.dir;
    pet.say(SPEECH.pick('mobPet'));
    m.hp = (typeof m.hp === 'number' ? m.hp : 1) - 1;
    m.hitFlash = 8;
    m.scaredTimer = 14;
    m.vy = Math.min(m.vy || 0, -3.5);
    if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(m.x + m.w / 2, m.y - 4, "PROTECT!", "#4ade80", 0.85);
    if (guardingVillager && typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop(guardTarget.x + guardTarget.w / 2, guardTarget.y - 8, "GUARDED!", guardTarget.color || "#a7f3d0", 0.78);
    }
    if (typeof Particles !== 'undefined') Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#4ade80', 8, 2.0, 2.1, 'glow');
    this.grantPetBondProof('guard', pet, {
      target: guardingVillager ? 'villager' : 'cadet',
      targetName: guardingVillager ? guardTarget.name : null
    });
    if (m.hp <= 0) {
      const wasWoken = !!m.woken;
      this.killMob(index, 'pet');
      if (wasWoken) this.addXP(4);
      return index;
    }
    return null;
  }

  updatePetMob(index, tilemap, mapW) {
    const pet = this.mobs && this.mobs[index];
    if (!pet) return null;
    const targetInfo = this.findNearestHostileMob(pet);
    const target = targetInfo ? targetInfo.mob : this.petFollowTarget(pet);
    pet.update(tilemap, target, false);
    pet.pet = true;
    pet.scaredTimer = 0;
    if (pet.y > 470 || pet.x < -60 || pet.x > mapW + 60) {
      this.mobs.splice(index, 1);
      return index;
    }
    if (this.damageMobFromHazards(index)) return index;
    if (targetInfo && this.mobs[targetInfo.index] === targetInfo.mob) {
      const strikeRange = Math.max(pet.w || 24, targetInfo.mob.w || 24) + 12;
      if (targetInfo.distance <= strikeRange || this.entityDistance(pet, targetInfo.mob) <= strikeRange) {
        return this.petStrikeMob(targetInfo.index, pet);
      }
    }
    return null;
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
      if (!this.reducedMotion && typeof Compiler !== 'undefined' && Compiler.env) {
        Compiler.env.raveMode = true;
        setTimeout(() => { Compiler.env.raveMode = false; }, 7000);
      } else if (typeof Compiler !== 'undefined' && Compiler.env) {
        Compiler.env.raveMode = false;
      }
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 6, "RAVE SHIELD!", "jagged", "#ec4899", -0.5, { maxLife: 95, scale: 1.6 });
      ui_log_output("🌈 RAVE SHIELD! For 7s, just touching mobs zaps them!", "success");
    }
  }

  updateSurvival() {
    if (!this.survivalMode || !this.player || !this.currentPlanet) return;
    if (this.raveImmuneTimer > 0) this.raveImmuneTimer--;
    if (this.survivalHitCooldown > 0) this.survivalHitCooldown--;

    // Spawn cadence (ramps up with score). Mob movement/collision is in updateMobs() so
    // woken mobs (from broken blocks) move and fight in normal play too.
    if (--this.mobSpawnTimer <= 0 && this.mobs.length < 8) {
      this.mobSpawnTimer = Math.max(45, 120 - Math.floor(this.survivalScore / 40) * 8);
      this.spawnMob();
    }
  }

  // Unified mob update — runs every frame for ALL mobs (survival spawns AND block-woken).
  // Stomp/shots chip mob hp; a woken mob that touches the cadet chips health (i-frames +
  // knockback), while a survival mob just bonks for a score penalty (the mini-game's rule).
  updateMobs() {
    if (!this.player || !this.mobs || !this.mobs.length) return;
    const tilemap = this.getActiveMap();
    const mapW = tilemap[0].length * TILE_SIZE;
    const flee = this.raveImmuneTimer > 0;
    for (let j = this.mobs.length - 1; j >= 0; j--) {
      const m = this.mobs[j];
      if (m.pet) {
        const removedIndex = this.updatePetMob(j, tilemap, mapW);
        if (removedIndex !== null && removedIndex < j) j--;
        continue;
      }
      m.update(tilemap, this.player, flee);
      if (m.y > 470 || m.x < -60 || m.x > mapW + 60) { this.mobs.splice(j, 1); continue; }
      if (this.damageMobFromHazards(j)) continue;
      const npcVictim = (m.attackCooldown || 0) <= 0 ? this.findNPCForMobAttack(m) : null;
      if (npcVictim) {
        const villageProtector = this.findProtectingPet(m, npcVictim);
        if (villageProtector) {
          this.petStrikeMob(j, villageProtector, npcVictim);
          continue;
        }
      }
      if (npcVictim && this.damageNPCFromMob(npcVictim, m)) continue;
      if (flee && this.tryTameMob(j)) continue;
      if (!Physics.isOverlapping(this.player, m)) continue;
      const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= m.y + 9);
      if (isStomp) {
        this.player.vy = -7;
        m.hp = (typeof m.hp === 'number' ? m.hp : 1) - 1;
        if (m.hp <= 0) { const woken = m.woken; this.killMob(j, 'stomp'); if (woken) this.addXP(6); }
        else { m.hitFlash = 6; if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp(); }
      } else if (this.raveImmuneTimer > 0) {
        if (this.tryTameMob(j, true)) continue;
        this.killMob(j, 'rave');
      } else if (m.woken) {
        const protector = this.findProtectingPet(m);
        if (protector) {
          this.petStrikeMob(j, protector);
          continue;
        }
        this.damagePlayer(1, 'mob', m.x, m.attackPower || 1);
        if (this.state === 'gameover') return;
      } else if (this.survivalHitCooldown <= 0) {
        const protector = this.findProtectingPet(m);
        if (protector) {
          this.petStrikeMob(j, protector);
          continue;
        }
        this.survivalHitCooldown = 70;
        this.player.vy = -5;
        this.player.vx = (this.player.x < m.x ? -4 : 4);
        this.survivalScore = Math.max(0, this.survivalScore - 5);
        if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
        if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y, SPEECH.pick('bonk'), "jagged", "#ef4444", -0.3, { maxLife: 40 });
      }
    }
  }

  damageMobFromHazards(index) {
    const m = this.mobs && this.mobs[index];
    if (!m || (m.hazardCooldown || 0) > 0) return false;
    const onSpikes = this.entityTouchesHazard(m);
    const onCrate = this.entityOverlapsSpawnedBox(m);
    if (!onSpikes && !onCrate) return false;

    m.hazardCooldown = 36;
    m.hitFlash = 10;
    m.hp = (typeof m.hp === 'number' ? m.hp : 1) - 1;
    m.vy = -4;
    m.dir *= -1;
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof Particles !== 'undefined') {
      Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, onSpikes ? '#ef4444' : '#f97316', 7, 2.2, 2.2, 'glow');
    }
    if (m.hp <= 0) {
      const woken = !!m.woken;
      const wasPet = !!m.pet;
      this.killMob(index, onSpikes ? 'spikes' : 'crate');
      if (woken && !wasPet) this.addXP(4);
      return true;
    }
    return false;
  }

  relocateNPCToSafeSpot(npc) {
    if (!npc) return;
    const placed = this.placeNpcAwayFromCollectibles({
      id: npc.id,
      name: npc.name,
      profession: npc.profession,
      x: npc.x + 96,
      y: npc.y,
      type: npc.type,
      color: npc.color,
      roleMark: npc.roleMark,
      skinTone: npc.skinTone,
      stall: npc.stall,
      dialogue: npc.dialogue,
      trades: npc.trades
    });
    npc.x = placed.x;
    npc.y = placed.y;
    npc.homeX = placed.x;
    npc.homeY = placed.y;
    npc.caveX = placed.caveX;
    npc.caveY = placed.caveY;
    npc.hiddenInCave = false;
    npc.proximity = false;
    if (this.activeNPC === npc) this.activeNPC = null;
  }

  damageNPCFromHazards(npc) {
    if (!npc || (npc.hazardCooldown || 0) > 0) return;
    const onSpikes = this.entityTouchesHazard(npc);
    const onCrate = this.entityOverlapsSpawnedBox(npc);
    if (!onSpikes && !onCrate) return;

    npc.hazardCooldown = 60;
    npc.hitFlash = 14;
    npc.health = Math.max(0, (npc.health || npc.maxHealth || 3) - 1);
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof Particles !== 'undefined') {
      Particles.spawnBurst(npc.x + npc.w / 2, npc.y + npc.h / 2, onSpikes ? '#ef4444' : '#f97316', 8, 2.2, 2.2, 'glow');
    }
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop(npc.x + npc.w / 2, npc.y - 4, npc.health <= 0 ? "MEDIC!" : "OUCH!", onSpikes ? "#ef4444" : "#f97316", 0.9);
    }
    this.relocateNPCToSafeSpot(npc);
    if (npc.health <= 0) npc.health = npc.maxHealth || 3;
  }

  findThreateningMobForNPC(npc, radius = null) {
    if (!npc || !this.mobs) return null;
    const threatRadius = Number.isFinite(radius) ? radius : this.getVillagerThreatRadius();
    let best = null;
    let bestD = Infinity;
    const anchors = [];
    const addAnchor = (x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        anchors.push({ x, y });
      }
    };
    addAnchor(npc.x + npc.w / 2, npc.y + npc.h / 2);
    if (npc.hiddenInCave || npc.rescuePending || npc.shelterReason) {
      const homeX = Number.isFinite(npc.homeX) ? npc.homeX : npc.x;
      const homeY = Number.isFinite(npc.homeY) ? npc.homeY : npc.y;
      addAnchor(homeX + npc.w / 2, homeY + npc.h / 2);
    }
    if (npc.hiddenInCave) addAnchor(npc.caveX + 16, npc.caveY + 18);
    for (const m of this.mobs) {
      if (!m || m.pet) continue;
      const mx = m.x + m.w / 2;
      const my = m.y + m.h / 2;
      for (const anchor of anchors) {
        const d = Math.hypot(mx - anchor.x, my - anchor.y);
        if (d < threatRadius && d < bestD) {
          best = m;
          bestD = d;
        }
      }
    }
    return best;
  }

  findNPCForMobAttack(mob, radius = 34) {
    if (!mob || mob.pet || !this.interactiveObjects) return null;
    for (const obj of this.interactiveObjects) {
      if (!(typeof NPC !== 'undefined' && obj instanceof NPC) || obj.hiddenInCave) continue;
      if (Physics.isOverlapping(mob, obj) || this.entityDistance(mob, obj) <= radius) return obj;
    }
    return null;
  }

  damageNPCFromMob(npc, mob) {
    if (!npc || !mob || (npc.hazardCooldown || 0) > 0) return false;
    npc.hazardCooldown = 54;
    npc.hitFlash = 14;
    this.markNPCShelterThreat(npc, "mob attack", { panicTimer: 180, caveCooldown: 90 });
    npc.health = Math.max(0, (npc.health || npc.maxHealth || 3) - 1);
    mob.attackCooldown = 42;
    mob.say(SPEECH.pick('mobChatter'));
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof Particles !== 'undefined') Particles.spawnBurst(npc.x + npc.w / 2, npc.y + npc.h / 2, '#ef4444', 8, 2.2, 2.1, 'glow');
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(npc.x + npc.w / 2, npc.y - 5, "RUN!", "#facc15", 0.95);
    if (!npc.hiddenInCave && typeof npc.stepTowardCave === 'function') npc.stepTowardCave(3.2);
    if (npc.health <= 0) {
      npc.health = npc.maxHealth || 3;
      this.parkNPCInCave(npc, "mob attack");
    }
    if (this.activeNPC === npc) this.activeNPC = null;
    return true;
  }

  // ---- BREAKABLE BLOCKS + CRATERS --------------------------------------------
  // Carve a solid tile out of the world (block broken or meteor crater): clear the map
  // cell, drop the baked terrain so it visually disappears, and puff debris.
  carveTile(r, c) {
    const map = this.getActiveMap();
    if (!map[r] || (map[r][c] !== 1 && map[r][c] !== 10)) return false;
    map[r][c] = 0;
    if (typeof RenderCache !== 'undefined' && RenderCache.invalidateTile) RenderCache.invalidateTile();
    if (typeof Particles !== 'undefined') Particles.spawnBurst(c * TILE_SIZE + 16, r * TILE_SIZE + 16, '#cbd5e1', 10, 2.5, 2.5);
    return true;
  }

  // Bump a breakable block from below → open it. Seeded by (r,c,attempt) so a block is
  // consistent on a retry: hidden gem, a blaster, a woken mob, or just rubble.
  breakBlock(r, c, source) {
    const map = this.getActiveMap();
    if (!map[r] || map[r][c] !== 10) return;
    this.carveTile(r, c);
    if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
    const seed = ((r * 73856093) ^ (c * 19349663) ^ ((this.retryAttempt || 0) * 2654435761)) >>> 0;
    const rng = (typeof mulberry32 === 'function') ? mulberry32(seed) : Math.random;
    const roll = rng();
    const dropX = c * TILE_SIZE, dropY = (r - 1) * TILE_SIZE;
    // A meteor smashing a block shouldn't conjure a mob (felt like uncontrolled spawning) —
    // it drops a gem or just rubble. Only a deliberate head-bump can wake a mob.
    if (source === 'meteor') {
      if (roll < 0.5) {
        this.spawnItemAbovePlayer('coin', dropX, dropY);
        if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(dropX + 16, dropY, "GEM!", "#facc15", 1.0);
      } else if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.pop(dropX + 16, dropY, "POOF!", "#cbd5e1", 0.9);
      }
      return;
    }
    if (roll < 0.36) {
      this.spawnItemAbovePlayer('coin', dropX, dropY);
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(dropX + 16, dropY, "GEM!", "#facc15", 1.0);
    } else if (roll < 0.52) {
      this.interactiveObjects.push(new InteractiveObject(dropX, dropY, 'weapon'));
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(dropX + 16, dropY, "BLASTER!", "#facc15", 1.1);
    } else if (roll < 0.66) {
      this.interactiveObjects.push(new InteractiveObject(dropX, dropY, 'fuel'));
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(dropX + 16, dropY, "FUEL!", "#f97316", 1.1);
    } else if (roll < 0.78) {
      this.interactiveObjects.push(new InteractiveObject(dropX, dropY, 'food'));
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(dropX + 16, dropY, "SNACK!", "#fb7185", 1.0);
    } else if (roll < 0.90) {
      this.wakeMob(dropX, dropY);
    } else if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop(dropX + 16, dropY, "POOF!", "#cbd5e1", 0.9);
    }
  }

  // Scatter a few breakable blocks into open air above platforms (deterministic per attempt)
  // so every world has some to bump — without editing the hand-built maps.
  placeBreakableBlocks() {
    const map = this.getActiveMap();
    if (!map || !map.length) return;
    const rng = (typeof mulberry32 === 'function')
      ? mulberry32(((this.currentPlanetIndex * 2654435761) ^ ((this.retryAttempt || 0) * 40503)) >>> 0)
      : Math.random;
    const rows = map.length, cols = map[0].length;
    let placed = 0, guard = 0;
    while (placed < 4 && guard++ < 500) {
      const c = 3 + Math.floor(rng() * (cols - 6));
      const r = 3 + Math.floor(rng() * (rows - 6));
      if (map[r][c] !== 0) continue;                       // block cell must be air
      if (map[r + 1] && map[r + 1][c] !== 0) continue;     // air below (room to bump from beneath)
      if (map[r - 1] && map[r - 1][c] === 1) continue;     // not buried under a ceiling
      let groundBelow = false;
      for (let dr = 2; dr <= 4; dr++) { if (map[r + dr] && map[r + dr][c] === 1) { groundBelow = true; break; } }
      if (!groundBelow) continue;                          // reachable platform underneath
      map[r][c] = 10;
      placed++;
    }
  }

  // Place a couple of fuel canisters resting on solid ledges (deterministic per attempt) so
  // the finite tank can be topped up mid-level without breaking blocks.
  placeFuelCanisters() {
    const map = this.getActiveMap();
    if (!map || !map.length) return;
    const rng = (typeof mulberry32 === 'function')
      ? mulberry32(((this.currentPlanetIndex * 374761393) ^ ((this.retryAttempt || 0) * 668265263) ^ 0x9e3779b9) >>> 0)
      : Math.random;
    const rows = map.length, cols = map[0].length;
    let placed = 0, guard = 0;
    while (placed < 2 && guard++ < 500) {
      const c = 3 + Math.floor(rng() * (cols - 6));
      const r = 3 + Math.floor(rng() * (rows - 6));
      if (map[r][c] !== 0) continue;                         // canister cell must be air
      if (!(map[r + 1] && map[r + 1][c] === 1)) continue;    // solid ledge directly underneath
      if (map[r - 1] && map[r - 1][c] === 1) continue;       // headroom above
      this.interactiveObjects.push(new InteractiveObject(c * TILE_SIZE, r * TILE_SIZE, 'fuel'));
      placed++;
    }
  }

  placeFoodPickups() {
    const map = this.getActiveMap();
    if (!map || !map.length) return;
    const rng = (typeof mulberry32 === 'function')
      ? mulberry32(((this.currentPlanetIndex * 1103515245) ^ ((this.retryAttempt || 0) * 31337) ^ 0x51f15e) >>> 0)
      : Math.random;
    const rows = map.length, cols = map[0].length;
    let placed = 0, guard = 0;
    const target = this.currentPlanetIndex === 0 ? 1 : 2;
    while (placed < target && guard++ < 500) {
      const c = 3 + Math.floor(rng() * (cols - 6));
      const r = 3 + Math.floor(rng() * (rows - 6));
      if (map[r][c] !== 0) continue;
      if (!(map[r + 1] && map[r + 1][c] === 1)) continue;
      if (map[r - 1] && map[r - 1][c] === 1) continue;
      const px = c * TILE_SIZE;
      const py = r * TILE_SIZE;
      const tooClose = this.interactiveObjects.some(o => o && !o.collected && Math.abs(o.x - px) < 80 && Math.abs(o.y - py) < 40);
      if (tooClose) continue;
      this.interactiveObjects.push(new InteractiveObject(px, py, 'food'));
      placed++;
    }
  }

  wakeMob(x, y) {
    const theme = (typeof MOB_THEMES !== 'undefined' && MOB_THEMES[this.currentPlanetIndex]) || ["blob"];
    const species = theme[Math.floor(Math.random() * theme.length)];
    const accent = (this.currentPlanet && this.currentPlanet.color) || '#a78bfa';
    const aggro = [0.5, 0.65, 0.9, 0.75, 0.85, 0.8][this.currentPlanetIndex] || 0.7;
    const m = new Mob(x, y, species, accent, aggro);
    m.hp = (this.currentPlanetIndex >= 2 ? 2 : 1); // Earth/Moon: one hit; tougher worlds: two
    m.woken = true;
    this.mobs.push(m);
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(x + 13, y, "!", "#ef4444", 1.1);
  }

  drawSurvival(ctx) {
    if (!this.survivalMode) return;
    // (Projectiles + mobs are drawn in the main draw() now so they show in normal play too.)
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

  // ---- COMBAT (shooting, projectiles, weapons, XP) ----------------------------
  // Equip the blaster: unlocks shooting (hold F). Found as a pickup, broken out of a
  // block, or via the KidCode equip_blaster() command.
  equipWeapon(kind) {
    if (!this.player) return "No cadet to arm.";
    const wasUnarmed = !this.player.weapon;
    this.player.weapon = kind || 'blaster';
    if (!this.weaponLevel || this.weaponLevel < 1) this.weaponLevel = 1;
    if (wasUnarmed) {
      this._shootHintTimer = 360; // ~6s "hold F to shoot" prompt
      if (typeof SFX !== 'undefined' && SFX.playSuccess) SFX.playSuccess();
      if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 8, "BLASTER!", "jagged", "#facc15", -0.5, { maxLife: 90, scale: 1.4 });
      }
      if (typeof ui_log_output === 'function') ui_log_output("🔫 Blaster acquired! Hold F to shoot.", "success");
    }
    return "Blaster equipped — hold F to shoot!";
  }

  applyUnlockedTools() {
    if (!this.player) return;
    const tools = this.unlockedTools || new Set();
    if (tools.has('blaster') || tools.has('dual_blaster')) {
      this.player.weapon = 'blaster';
      this.weaponLevel = Math.max(this.weaponLevel || 1, tools.has('dual_blaster') ? 3 : 1);
    }
    if (tools.has('ice_spikes')) {
      this.player.spikes = true;
    }
    if (tools.has('storm_tank')) {
      const boostedTank = 320;
      if ((this.player.maxTank || 0) < boostedTank) {
        this.player.maxTank = boostedTank;
        this.player.tank = boostedTank;
      }
    }
    if (tools.has('forge_plating')) {
      const boostedHealth = 4;
      if ((this.player.maxHealth || 0) < boostedHealth) {
        const gained = boostedHealth - (this.player.maxHealth || boostedHealth);
        this.player.maxHealth = boostedHealth;
        this.player.health = Math.min(boostedHealth, (this.player.health || boostedHealth) + Math.max(0, gained));
      }
    }
  }

  spawnTradeRewardEffect(npc, trade) {
    if (!this.player || !trade || !trade.reward) return null;
    const reward = trade.reward;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const color = (npc && npc.color) || "#facc15";
    let label = "TRADE UP!";
    let detail = trade.desc || "Upgrade unlocked";

    if (reward.type === "cap") {
      label = "CAP UP!";
      const key = String(reward.key || "stat").toUpperCase();
      detail = `${key} ${reward.amount >= 0 ? "+" : ""}${reward.amount}`;
    } else if (reward.type === "tool") {
      label = "TOOL GET!";
      detail = reward.label || reward.key || "New tool";
    } else if (reward.type === "planet") {
      label = "MAP GET!";
      detail = "New coordinates";
    }

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 28, label, color, 1.05);
      ComicBubbles.pop(px, baseY - 10, String(detail).toUpperCase(), "#a7f3d0", 0.78);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py, color, 14, 2.5, 2.4, 'glow');
      Particles.spawnBurst(px, py, '#a7f3d0', 8, 1.8, 1.8, 'glow');
    }

    this.lastTradeRewardEffect = {
      label,
      detail,
      color,
      rewardType: reward.type || "",
      tradeId: trade.id || "",
      npcId: npc && npc.id ? npc.id : "",
      x: px,
      y: py
    };
    return this.lastTradeRewardEffect;
  }

  getVillageTradeProofSourceKey(npc, trade, index = this.currentPlanetIndex) {
    const planetKey = Number.isFinite(index) ? index : 0;
    const npcKey = npc && npc.id ? String(npc.id).replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : "villager";
    const tradeKey = trade && trade.id ? String(trade.id).replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : "trade";
    return `village-trade:${planetKey}:${npcKey}:${tradeKey}`;
  }

  grantVillageTradeProof(npc, trade) {
    if (!npc || !trade) return null;
    const sourceKey = this.getVillageTradeProofSourceKey(npc, trade);
    this.discoveryPassCounts = this.discoveryPassCounts || {};
    if (this.discoveryPassCounts[sourceKey]) return null;

    const reward = trade.reward || {};
    const rewardType = reward.type || "upgrade";
    const rewardXP = rewardType === "planet" ? 5 : 4;
    const masteryXP = rewardType === "planet" ? 12 : 8;
    const cost = trade.cost || {};
    const costAmount = Math.max(0, Math.floor(Number(cost.amount) || 0));
    const costType = String(cost.type || "gem").replace(/_/g, " ");
    const rewardLabel = rewardType === "cap"
      ? `${String(reward.key || "stat").replace(/_/g, " ")} upgrade`
      : (reward.label || reward.key || (rewardType === "planet" ? "map route" : "tool"));
    const label = rewardType === "planet" ? "MAP PACT" : (rewardType === "tool" ? "TOOL PACT" : "TRADE PACT");
    const mastery = typeof this.awardWorldMasteryXP === 'function'
      ? this.awardWorldMasteryXP(masteryXP, "village trade proof", { sourceKey, silent: true })
      : { addedXP: 0, duplicate: false };
    if (mastery && mastery.duplicate) {
      this.discoveryPassCounts[sourceKey] = 1;
      return null;
    }
    const villageTrust = this.grantVillageTrust(rewardType === "planet" ? 4 : 3, sourceKey, "trade", {
      npc,
      trade,
      color: npc.color || "#4ade80"
    });

    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    this.discoveryPassCounts[sourceKey] = 1;
    this.researchXP = Math.max(0, (this.researchXP || 0) + rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
    const villagerName = npc.name || "A villager";
    const planetName = this.currentPlanet && this.currentPlanet.name ? this.currentPlanet.name : "Village";
    const pulse = {
      kind: "village-trade",
      title: "Village Trade Proof",
      formula: "samples -> trade -> tool",
      insight: `${villagerName} turned ${costAmount} ${costType} sample${costAmount === 1 ? "" : "s"} into ${rewardLabel}. That is resource flow: collect evidence, spend it, unlock a new engineering option.`,
      cue: "Use the new upgrade in a replay, Daily Signal, or survival rescue.",
      missionId: sourceKey,
      missionTitle: planetName,
      passed: 1,
      total: 1,
      progressLabel: trade.desc || rewardLabel,
      openedGems: 0,
      rewardXP,
      combo: this.discoveryCombo || 0,
      rankUp,
      rankTitle: afterRank ? afterRank.title : null,
      rankPerk: rankUp && afterRank ? afterRank.perk : null,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      villageTradeProof: {
        label,
        rewardXP,
        sourceKey,
        tradeId: trade.id || "",
        npcId: npc.id || "",
        rewardType
      },
      villageTrust: villageTrust && villageTrust.added > 0 ? villageTrust : null
    };
    this.completeActiveAIStateRun("trade-flow", pulse);
    this.discoveryPulse = pulse;
    this.discoveryLog = [pulse].concat(Array.isArray(this.discoveryLog) ? this.discoveryLog : []).slice(0, 8);

    if (typeof ui_log_output === 'function') {
      ui_log_output(`${label}: +${rewardXP} Research XP, +${pulse.worldMasteryAddedXP} world mastery XP.`, "success");
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
    if (this.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      const px = this.player.x + this.player.w / 2;
      const py = this.player.y;
      ComicBubbles.pop(px, py - 44, label, npc.color || "#4ade80", 0.9);
      ComicBubbles.pop(px, py - 25, `+${rewardXP} LAB XP`, "#a7f3d0", 0.72);
    }
    if (this.player && typeof Particles !== 'undefined' && Particles.spawnBurst) {
      const px = this.player.x + this.player.w / 2;
      const py = this.player.y + this.player.h / 2;
      Particles.spawnBurst(px, py, npc.color || "#4ade80", 12, 2.1, 2.1, "glow");
      Particles.spawnBurst(px, py, "#a7f3d0", 8, 1.6, 1.7, "glow");
    }
    if (rankUp && typeof showBadgeToast === 'function') {
      showBadgeToast({
        icon: "V",
        label: `Research Rank: ${afterRank.title}`,
        description: `Village trade unlocked ${afterRank.perk.label}.`
      });
    }
    if (rankUp && typeof this.spawnResearchRankEffect === 'function') {
      pulse.rankEffect = this.spawnResearchRankEffect(pulse);
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
        title: "VILLAGE LAB",
        color: npc.color || "#4ade80",
        timer: 230
      });
    }
    this.grantVillageGuardianPact(pulse, { npc, color: npc.color || "#4ade80" });
    if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(this);
    if (typeof updateResearchProgress === 'function') updateResearchProgress(this);
    if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === this) saveLocalProgress();
    return pulse;
  }

  // Grant experience: fills the per-world mastery meter (persisted) and levels the blaster
  // at thresholds, so fighting woken mobs makes your gun stronger.
  addXP(n) {
    if (!n || !this.player) return;
    this.awardWorldMasteryXP(n, "combat practice", { silent: true });
    this.totalXP = (this.totalXP || 0) + n;
    if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(this.player.x + this.player.w / 2, this.player.y - 12, "+" + n + " XP", "#a3e635", 0.85);
    const lvl = this.totalXP >= 120 ? 3 : this.totalXP >= 45 ? 2 : 1;
    if (lvl > (this.weaponLevel || 1)) {
      this.weaponLevel = lvl;
      if (typeof ComicBubbles !== 'undefined') ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 6, "GUN UP!", "jagged", "#4ade80", -0.5, { maxLife: 80, scale: 1.4 });
      if (typeof ui_log_output === 'function') ui_log_output(`🔫 Weapon level ${lvl}! ${lvl >= 3 ? 'Double shot!' : 'Faster fire!'}`, "success");
    }
  }

  // Firing + projectile flight + hits. Runs every frame; fires only when armed (a weapon
  // found, or survival mode). Projectiles damage campaign enemies (via hp) and survival mobs.
  updateCombat() {
    if (!this.player) return;
    this.projectiles = this.projectiles || [];
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this._shootHintTimer > 0) this._shootHintTimer--;
    const armed = !!this.player.weapon || this.survivalMode;
    const lvl = this.weaponLevel || 1;

    if (armed && (this.keys['f'] || this.keys['F']) && this.shootCooldown <= 0) {
      const dir = this.player.facing || 1;
      this.shootCooldown = Math.max(6, 16 - lvl * 3);
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      this.projectiles.push(new Projectile(px, py, dir * 7));
      if (lvl >= 3) this.projectiles.push(new Projectile(px, py - 9, dir * 7));
      if (typeof SFX !== 'undefined' && SFX.playType) SFX.playType();
      if (typeof ComicBubbles !== 'undefined' && Math.random() < 0.25) ComicBubbles.spawn(px + dir * 16, py - 6, "PEW!", "jagged", "#facc15", -0.2, { maxLife: 22, scale: 0.7 });
    }

    if (!this.projectiles.length) return;
    const tilemap = this.getActiveMap();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(tilemap);
      if (p.dead) { this.projectiles.splice(i, 1); continue; }
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.abs(p.x - (e.x + e.w / 2)) < e.w / 2 + 5 && Math.abs(p.y - (e.y + e.h / 2)) < e.h / 2 + 6) {
          e.hp = (typeof e.hp === 'number' ? e.hp : 1) - 1;
          consumed = true;
          if (e.hp <= 0) {
            this.enemies.splice(j, 1);
            Particles.spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#ef4444', 11, 2.5, 3, 'glow');
            if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(e.x + e.w / 2, e.y - 4, SPEECH.pick('stomp'), "#fb7185", 1.0);
            this.addXP(e.xpValue || 8);
          } else {
            Particles.spawnBurst(p.x, p.y, '#f59e0b', 4, 1.5, 1.5);
          }
          break;
        }
      }
      if (!consumed) {
        for (let j = this.mobs.length - 1; j >= 0; j--) {
          const m = this.mobs[j];
          if (Math.abs(p.x - (m.x + m.w / 2)) < m.w / 2 + 5 && Math.abs(p.y - (m.y + m.h / 2)) < m.h / 2 + 6) {
            this.killMob(j, 'shot'); consumed = true; break;
          }
        }
      }
      // Shoot space debris to bust it apart (no damage to anyone — it just shatters).
      if (!consumed && this.debris) {
        for (let j = this.debris.length - 1; j >= 0; j--) {
          const d = this.debris[j];
          if (Math.abs(p.x - (d.x + d.w / 2)) < d.w / 2 + 5 && Math.abs(p.y - (d.y + d.h / 2)) < d.h / 2 + 6) {
            this.debris.splice(j, 1);
            Particles.spawnBurst(d.x + d.w / 2, d.y + d.h / 2, '#9ca3af', 10, 2.5, 2.5, 'glow');
            if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
            if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(d.x + d.w / 2, d.y - 4, SPEECH.pick('stomp'), '#cbd5e1', 0.9);
            consumed = true; break;
          }
        }
      }
      if (consumed) this.projectiles.splice(i, 1);
    }
  }

  // ---- METEOR SHOWER ---------------------------------------------------------
  // Is the cadet under a NEARBY overhang? Meteors fall from above, so a block a few tiles
  // overhead shelters you. We scan only a short reach (not the whole column) and skip the
  // top border row 0 — otherwise the level's solid ceiling border would make every spot
  // "sheltered" and meteors could never land a hit.
  isSheltered(p) {
    const map = this.getActiveMap();
    const col = Math.floor((p.x + p.w / 2) / TILE_SIZE);
    const topRow = Math.floor(p.y / TILE_SIZE);
    const SHELTER_REACH = 7;
    for (let r = topRow - 1; r >= Math.max(1, topRow - SHELTER_REACH); r--) {
      if (map[r] && map[r][col] === 1) return true;
    }
    return false;
  }

  // Kicks off the 3-second warning, then the shower. Used by the periodic timer and the
  // KidCode meteor_shower() command. No-op if a shower is already running.
  triggerMeteorShower() {
    if (this.meteorPhase && this.meteorPhase !== 'idle') return "A meteor shower is already underway!";
    this.meteorPhase = 'warning';
    this.meteorWarnTimer = 180; // 3s @ 60fps
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof ui_log_output === 'function') ui_log_output("☄️ Meteor shower incoming — take shelter under an overhang!", "error");
    if (this.player && typeof ComicBubbles !== 'undefined') {
      ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y - 8, "INCOMING!", "jagged", "#ef4444", -0.4, { maxLife: 90, scale: 1.4 });
    }
    return "Meteor shower incoming — take shelter!";
  }

  spawnMeteor() {
    const cw = (this.canvas && this.canvas.width) || 720;
    const x = this.cameraX + Math.random() * cw;
    // Enter the play area BELOW any solid ceiling border so meteors actually fall in
    // (levels have a solid row-0 border; spawning above it would just hit the ceiling).
    const map = this.getActiveMap();
    const col = Math.max(0, Math.min(map[0].length - 1, Math.floor(x / TILE_SIZE)));
    let spawnRow = 0;
    for (let r = 0; r < map.length; r++) { if (map[r] && map[r][col] === 1) spawnRow = r + 1; else break; }
    const y = spawnRow * TILE_SIZE - 12;
    const vx = (Math.random() - 0.5) * 1.6;
    const vy = 3 + Math.random() * 2;
    this.meteors.push(new Meteor(x, y, vx, vy));
  }

  updateMeteors() {
    if (!this.player || !this.currentPlanet) return;
    this.meteors = this.meteors || [];
    const tilemap = this.getActiveMap();

    // Phase machine: idle → warning(3s) → active(spawning ~7s) → cooldown → idle.
    if (this.meteorPhase === 'idle') {
      if (this.currentPlanetIndex !== 0) { // Earth base camp stays calm
        this.meteorIdleTimer = (this.meteorIdleTimer || 0) - 1;
        if (this.meteorIdleTimer <= 0) this.triggerMeteorShower();
      }
    } else if (this.meteorPhase === 'warning') {
      if (--this.meteorWarnTimer <= 0) { this.meteorPhase = 'active'; this.meteorActiveTimer = 420; this.meteorSpawnTimer = 0; }
    } else if (this.meteorPhase === 'active') {
      this.meteorActiveTimer--;
      if ((this.meteorSpawnTimer = (this.meteorSpawnTimer || 0) - 1) <= 0) {
        this.meteorSpawnTimer = 10 + Math.floor(Math.random() * 12);
        this.spawnMeteor();
      }
      if (this.meteorActiveTimer <= 0) { this.meteorPhase = 'cooldown'; this.meteorCooldownTimer = 120; }
    } else if (this.meteorPhase === 'cooldown') {
      if (--this.meteorCooldownTimer <= 0) { this.meteorPhase = 'idle'; this.meteorIdleTimer = 2100 + Math.floor(Math.random() * 1800); }
    }

    // The whole view rumbles during the warning + shower (gentle; yields to a bigger
    // damage shake; skipped under reduced-motion).
    if ((this.meteorPhase === 'warning' || this.meteorPhase === 'active') && !this.reducedMotion && (this.shakeFrames || 0) < 2) {
      this.shakeFrames = 2; this.shakeMag = 3; this.shakeMax = 2;
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.update(tilemap);
      if (m.dead) {
        if (m.impactR != null) {
          const im = this.getActiveMap();
          if (im[m.impactR] && im[m.impactR][m.impactC] === 10) {
            this.breakBlock(m.impactR, m.impactC, 'meteor'); // shatter a suspended block (gem/rubble, never a mob)
          } else if (Math.random() < 0.5) {
            this.carveTile(m.impactR, m.impactC);          // ground impacts sometimes leave a crater
          }
        }
        this.meteors.splice(i, 1);
        Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#f59e0b', 9, 2.5, 2.5, 'glow');
        continue;
      }
      if (this.mobs && this.mobs.length) {
        let mobHit = false;
        for (let j = this.mobs.length - 1; j >= 0; j--) {
          const mob = this.mobs[j];
          if (!Physics.isOverlapping(mob, m)) continue;
          const wasWoken = !!mob.woken;
          mob.hp = (typeof mob.hp === 'number' ? mob.hp : 1) - 2;
          if (mob.hp <= 0) {
            this.killMob(j, 'meteor');
            if (wasWoken) this.addXP(4);
          } else {
            mob.hitFlash = 8;
            Particles.spawnBurst(mob.x + mob.w / 2, mob.y + mob.h / 2, '#f59e0b', 8, 2, 2, 'glow');
          }
          mobHit = true;
          break;
        }
        if (mobHit) {
          this.meteors.splice(i, 1);
          Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#f59e0b', 12, 2.8, 2.8, 'glow');
          if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
          continue;
        }
      }
      if (Physics.isOverlapping(this.player, m) && !this.isSheltered(this.player)) {
        this.meteors.splice(i, 1);
        Particles.spawnBurst(m.x + m.w / 2, m.y + m.h / 2, '#f59e0b', 9, 2.5, 2.5, 'glow');
        this.damagePlayer(1, 'meteor', m.x);
        if (this.state === 'gameover') return;
      }
    }
  }

  drawMeteorBanner(ctx) {
    if (this.meteorPhase !== 'warning') return;
    const secs = Math.ceil((this.meteorWarnTimer || 0) / 60);
    ctx.save();
    const label = `☄️ METEOR SHOWER — TAKE SHELTER!  ${secs}`;
    ctx.font = "bold 16px 'Outfit', sans-serif";
    const tw = ctx.measureText(label).width;
    const cx = this.canvas.width / 2;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120);
    ctx.fillStyle = `rgba(239,68,68,${0.55 + 0.25 * pulse})`;
    ctx.beginPath(); ctx.roundRect(cx - tw / 2 - 16, 44, tw + 32, 30, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, 59);
    ctx.restore();
  }

  // ---- SPACE DEBRIS ("wonder pieces") ----------------------------------------
  spawnDebris() {
    if (!this.currentPlanet || !this.currentPlanet.map) return;
    const mapW = this.getActiveMap()[0].length * TILE_SIZE;
    const size = 16 + Math.random() * 18;
    const fromLeft = Math.random() < 0.5;
    const cw = (this.canvas && this.canvas.width) || 720;
    let x = fromLeft ? this.cameraX - 30 : this.cameraX + cw + 30;
    x = Math.max(-30, Math.min(mapW + 30, x));
    const y = 30 + Math.random() * 230;
    const vx = (fromLeft ? 1 : -1) * (0.6 + Math.random() * 1.0);
    const vy = (Math.random() - 0.5) * 0.5;
    this.debris.push(new Debris(x, y, vx, vy, size));
  }

  updateDebris() {
    if (!this.debris || !this.player) return;
    // Per-world drift rate (frames between chunks). Space-y worlds get more; Earth (base
    // camp) gets none so the intro world stays calm for beginners.
    const rates = { 1: 220, 2: 200, 3: 240, 4: 160, 5: 120 };
    const rate = rates[this.currentPlanetIndex];
    if (rate) {
      this.debrisTimer = (this.debrisTimer || 0) - 1;
      if (this.debrisTimer <= 0 && this.debris.length < 6) {
        this.debrisTimer = rate + Math.floor(Math.random() * 90);
        this.spawnDebris();
      }
    }
    const tilemap = this.getActiveMap();
    const mapW = tilemap[0].length * TILE_SIZE;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.update(tilemap);
      if (d.x < -80 || d.x > mapW + 80 || d.y > 480 || d.life <= 0) { this.debris.splice(i, 1); continue; }
      if (Physics.isOverlapping(this.player, d)) {
        const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= d.y + 8);
        this.debris.splice(i, 1);                 // the chunk shatters on impact
        Particles.spawnBurst(d.x + d.w / 2, d.y + d.h / 2, '#9ca3af', 12, 2.5, 3, 'glow');
        if (isStomp) {
          // Jump on it to smash it safely — a little bounce, no damage.
          this.player.vy = -7;
          if (typeof SFX !== 'undefined' && SFX.playStomp) SFX.playStomp();
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(d.x + d.w / 2, d.y - 4, SPEECH.pick('stomp'), '#cbd5e1', 1.0);
        } else {
          this.damagePlayer(1, 'debris', d.x);
          if (this.state === 'gameover') return;
        }
      }
    }
  }

  // Chip the cadet's health from a contact hazard (debris, meteor, spikes, enemy). Applies
  // i-frames + knockback so one touch can't drain multiple hearts, a hurt flash + (motion-safe)
  // screen shake, and routes to killPlayer at zero health. Falling out of bounds bypasses this
  // and stays an instant death.
  damagePlayer(amount, cause, sourceX, knockback) {
    if (!this.player || this.state !== 'playing') return;
    if (this.player.invulnerableFrames > 0) return;          // already inside the grace window
    this.player.health = Math.max(0, (this.player.health || 0) - (amount || 1));
    this.player.invulnerableFrames = 70;                     // ~1.2s grace + blink
    const away = (typeof sourceX === 'number')
      ? (this.player.x < sourceX ? -1 : 1)
      : (this.player.facing ? -this.player.facing : -1);
    // Knockback varies by source: a charging hog flings you far, a drifting blob barely nudges.
    const kb = (typeof knockback === 'number' && knockback > 0) ? knockback : 1;
    // Scale by the world's gravity so a hit travels a similar distance on every planet —
    // otherwise the same impulse hurls the cadet off-map in low/zero-G worlds (unfair deaths).
    const g = (typeof this.getCurrentGravity === 'function') ? this.getCurrentGravity() : 0.6;
    const gf = Math.max(0.45, Math.min(1, g / 0.6));
    let kx = away * 4 * kb * gf;
    kx = Math.sign(kx) * Math.min(Math.abs(kx), 8);          // bound the worst-case fling
    this.player.vx = kx;
    this.player.vy = (-5 - (kb - 1) * 2.2) * gf;             // harder hits pop you up more
    this.hurtFlashTimer = 12;
    if (!this.reducedMotion) { this.shakeMax = 14; this.shakeFrames = 14; this.shakeMag = 7; }
    if (typeof SFX !== 'undefined' && SFX.playError) SFX.playError();
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.spawn(this.player.x + this.player.w / 2, this.player.y, SPEECH.pick("bonk"), "jagged", "#ef4444", -0.3, { maxLife: 36 });
    }
    if (this.player.health <= 0) {
      this.killPlayer(cause || "out of health!", cause || "enemy");
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

  getGemKeyForPlanet(index) {
    const keys = ['emerald', 'quartz', 'amber', 'ice', 'flux', 'forge'];
    return keys[index] || 'emerald';
  }

  clearLevel() {
    this.state = 'clear';
    const storyBeforeIds = this.getUnlockedSignalStoryIds();

    // Award collected gems to the wallet — but only the NEW ones never banked from this planet
    // before, so replaying a level (or the Daily Signal) can't farm unlimited trade currency.
    let earnedGems = 0;
    const clearGemKey = this.getGemKeyForPlanet(this.currentPlanetIndex);
    if (this.requiredCollectiblesCollected > 0) {
      const gemKey = clearGemKey;
      this.gemsAwardedForPlanet = this.gemsAwardedForPlanet || {};
      const alreadyBanked = this.gemsAwardedForPlanet[this.currentPlanetIndex] || 0;
      const newGems = Math.max(0, this.requiredCollectiblesCollected - alreadyBanked);
      if (newGems > 0) {
        earnedGems = newGems;
        this.gemsWallet = this.gemsWallet || { emerald: 0, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
        this.gemsWallet[gemKey] = (this.gemsWallet[gemKey] || 0) + newGems;
        this.gemsAwardedForPlanet[this.currentPlanetIndex] = this.requiredCollectiblesCollected;
        if (typeof ui_log_output === 'function') {
          ui_log_output(`🎁 Earned ${newGems} ${gemKey} shards for your wallet!`, "success");
        }
      }
    }

    // A cleared run is an experiment too — log it with its telemetry.
    if (typeof attemptLogFinish === 'function') attemptLogFinish(this, 'cleared');
    const isDailyRun = this.remixContext === 'daily'
      && this.dailyInfo
      && this.dailyInfo.planetIndex === this.currentPlanetIndex;
    const isFrontierRun = isDailyRun && !!this.dailyInfo.isFrontier;

    if (isDailyRun) {
      // Daily Signal is a side challenge. It should persist its own clear count, but must
      // not mark campaign planets as cleared or unlock later worlds out of order.
      if (!isFrontierRun) this.dailySignalClears = (this.dailySignalClears || 0) + 1;
    } else {
      // Count the campaign clear (persisted): future fresh visits to this world start
      // REMIXED (mastery), and the Daily Signal pool can grow to the next world.
      this.planetClears = this.planetClears || {};
      this.planetClears[this.currentPlanetIndex] = (this.planetClears[this.currentPlanetIndex] || 0) + 1;
    }
    let labStars = this.recordClearLabStars({ isDailyRun, isFrontierRun });
    const frontierTier = isFrontierRun && this.dailyInfo ? Math.max(1, Number(this.dailyInfo.tier) || 1) : 0;
    const clearMasteryXP = isFrontierRun ? Math.max(12, 10 + frontierTier * 2) : (isDailyRun ? 8 : 12);
    const clearMasteryReason = isFrontierRun ? "frontier challenge clear" : (isDailyRun ? "daily signal clear" : "campaign clear");
    const clearMastery = this.awardWorldMasteryXP(clearMasteryXP, clearMasteryReason, {
      sourceKey: isFrontierRun
        ? `frontier-clear:${this.dailyInfo && this.dailyInfo.dateStr ? this.dailyInfo.dateStr : this.getTodayDateStr()}:t${frontierTier}:${this.currentPlanetIndex}`
        : (isDailyRun
          ? `daily-clear:${this.dailyInfo && this.dailyInfo.dateStr ? this.dailyInfo.dateStr : this.getTodayDateStr()}:${this.currentPlanetIndex}`
          : `campaign-clear:${this.currentPlanetIndex}:${this.planetClears && this.planetClears[this.currentPlanetIndex] ? this.planetClears[this.currentPlanetIndex] : 1}`),
      silent: true
    });
    labStars.worldMastery = clearMastery.progress;
    labStars.worldMasteryAddedXP = (labStars.worldMasteryAddedXP || 0) + clearMastery.addedXP;
    labStars.worldMasteryTierAwards = (labStars.worldMasteryTierAwards || []).concat(clearMastery.tierAwards || []);
    labStars = this.grantMasteryClearReward(labStars);
    const clearTime = this.recordClearTime({ isDailyRun, isFrontierRun });
    const frontierRivalResult = isFrontierRun ? this.getFrontierRivalClearResult({ labStars, clearTime }) : null;
    const frontierRecord = isFrontierRun ? this.recordFrontierClear({ labStars, clearTime }) : null;
    this.lastSignalStoryUnlocks = this.getNewSignalStoryChapters(storyBeforeIds);
    if (this.lastSignalStoryUnlocks.length) {
      this.spawnSignalStoryUnlockEffect(this.lastSignalStoryUnlocks[0]);
    }
    if (frontierRivalResult) {
      this.lastFrontierRivalResult = frontierRivalResult;
      const rivalProof = this.grantFrontierRivalProof(frontierRivalResult);
      if (rivalProof && labStars) {
        labStars.worldMastery = this.getWorldMasteryProgress(this.currentPlanetIndex);
        labStars.worldMasteryAddedXP = (labStars.worldMasteryAddedXP || 0) + (rivalProof.worldMasteryAddedXP || 0);
      }
      this.spawnFrontierRivalClearEffect(frontierRivalResult);
    } else {
      this.lastFrontierRivalResult = null;
    }
    this.refreshGalaxyMapProgress();
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
      if (clearTitle) clearTitle.textContent = isFrontierRun ? "FRONTIER CLEAR! ◆" : "DAILY SIGNAL CLEAR! 📡";
      if (clearSubtitle) {
        clearSubtitle.textContent = isFrontierRun
          ? `Tier ${this.dailyInfo && this.dailyInfo.tier ? this.dailyInfo.tier : 1} frontier solved: ${share}. Frontier runs keep campaign unlocks stable while pushing world mastery higher.`
          : `Signal solved: ${share}. This counts toward Daily Signal practice, while campaign planet unlocks stay on the main mission path.`;
        if (frontierRecord && frontierRecord.isNewBest) clearSubtitle.textContent += " Local Frontier record updated.";
      }
      if (nextBtn) nextBtn.textContent = "OPEN LOG";
      if (dailyBtn) dailyBtn.style.display = "none";
      this.clearAction = 'log';
    } else if (nextIndex === null) {
      // Final playable world cleared: the star-map is complete. Rather than dead-end on
      // "three worlds inbound", point the cadet at the Daily Signal — a fresh seeded
      // remix every day — so there's a real reason to come back tomorrow.
      const frontier = this.getFrontierChallenge();
      const daily = this.getDailySignal();
      const finale = this.getStarMapFinaleCopy({ frontier, payoff });
      if (clearTitle) clearTitle.textContent = finale.title;
      if (clearSubtitle) clearSubtitle.textContent = finale.subtitle;
      if (nextBtn) nextBtn.textContent = "OPEN LOG";
      if (dailyBtn) {
        dailyBtn.style.display = frontier || daily ? "inline-flex" : "none";
        if (frontier) {
          dailyBtn.textContent = `◆ FRONTIER T${frontier.tier}`;
          dailyBtn.style.background = "#facc15";
          dailyBtn.style.color = "#030712";
          dailyBtn.onclick = () => {
            if (typeof runFrontierChallengeAction === 'function') return runFrontierChallengeAction(this);
            return this.startFrontierChallenge();
          };
        } else if (daily) {
          dailyBtn.textContent = `📡 TODAY'S SIGNAL`;
          dailyBtn.style.background = "var(--neon-cyan)";
          dailyBtn.style.color = "#030712";
          dailyBtn.onclick = () => {
            if (typeof runDailySignalAction === 'function') return runDailySignalAction(this);
            return this.startDailySignal();
          };
        }
      }
    } else {
      const targetName = PLANETS[nextIndex] ? PLANETS[nextIndex].name : "next planet";
      if (clearTitle) clearTitle.textContent = "SHARD RECOVERED! 🚀";
      if (clearSubtitle) clearSubtitle.textContent = `${payoff ? payoff + " " : "Rover has returned to the spacecraft. "}Run a launch plan to reach ${targetName}.`;
      if (nextBtn) nextBtn.textContent = "RUN LAUNCH PLAN";
      if (dailyBtn) dailyBtn.style.display = "none";
    }
    this.renderClearLabReport({ isDailyRun, isFrontierRun, nextIndex, earnedGems, gemKey: clearGemKey, labStars, clearTime, frontierRivalResult });
    ui_log_output(`✓ Level cleared! Target coordinates secured.`, "success");
    ui_log_output(`Rover returning to spacecraft docking bay...`, "info");
    if (typeof updateCertificateState === 'function') updateCertificateState();
  }

  renderClearLabReport({ isDailyRun = false, isFrontierRun = false, nextIndex = null, earnedGems = 0, gemKey = "gem", labStars = null, clearTime = null, frontierRivalResult = null } = {}) {
    if (typeof document === 'undefined') return;
    const report = document.getElementById("clear-lab-report");
    if (!report) return;
    const safe = (typeof escapeHTML === 'function')
      ? escapeHTML
      : (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

    const rows = (typeof AttemptLog !== 'undefined' && AttemptLog.byPlanet)
      ? (AttemptLog.byPlanet[this.currentPlanetIndex] || [])
      : [];
    const lastAttempt = rows.length ? rows[rows.length - 1] : null;
    const maxH = lastAttempt && Number.isFinite(lastAttempt.maxH) ? lastAttempt.maxH : 0;
    const maxV = lastAttempt && Number.isFinite(lastAttempt.maxV) ? lastAttempt.maxV : 0;
    const formulas = (typeof getFormulaCollection === 'function') ? getFormulaCollection(this) : null;
    const formulaText = formulas ? `${formulas.unlocked.length}/${formulas.cards.length}` : `${this.discoveredFormulaKinds ? this.discoveredFormulaKinds.size : 0}`;
    const quest = (typeof getActiveLabQuest === 'function') ? getActiveLabQuest(this) : null;
    const rank = (typeof getResearchRank === 'function') ? getResearchRank(this.researchXP || 0) : null;
    const unlockPreview = rank && typeof getResearchUnlockPreview === 'function' ? getResearchUnlockPreview(rank) : null;
    const unlockPct = unlockPreview ? Math.max(0, Math.min(100, Math.round((Number(unlockPreview.progress) || 0) * 100))) : 0;
    const unlockBlock = unlockPreview ? `
      <div class="clear-research-unlock">
        <div class="clear-research-unlock-head">
          <span>${safe(unlockPreview.label)}</span>
          <strong>${safe(unlockPreview.title)}</strong>
        </div>
        <div class="clear-research-unlock-bar" aria-label="${safe(`${unlockPct}% toward next lab unlock`)}"><span style="width: ${unlockPct}%"></span></div>
        <p>${safe(unlockPreview.body)}</p>
      </div>
    ` : "";
    const cadetIdentity = typeof getCadetIdentityPreview === 'function' ? getCadetIdentityPreview(this) : null;
    const cadetIdentityPct = cadetIdentity ? Math.max(0, Math.min(100, Math.round((Number(cadetIdentity.progress) || 0) * 100))) : 0;
    const cadetAIAction = cadetIdentity && cadetIdentity.aiAction && cadetIdentity.aiAction.cardId
      ? cadetIdentity.aiAction
      : null;
    const cadetAIActionId = cadetAIAction ? String(cadetAIAction.cardId || "").replace(/[^a-z0-9_-]/gi, "") : "";
    const cadetAIActionBlock = cadetAIAction && cadetAIActionId ? `
      <button type="button" class="clear-cadet-ai-btn" onclick="if (window.Game) window.Game.runClearCadetAIAction('${safe(cadetAIActionId)}')">${safe(cadetAIAction.label || "RUN AI STATE")}</button>
    ` : "";
    const cadetLessonAction = cadetIdentity && cadetIdentity.lessonPathAction && cadetIdentity.lessonPathAction.missionId
      ? cadetIdentity.lessonPathAction
      : null;
    const cadetLessonActionId = cadetLessonAction ? String(cadetLessonAction.missionId || "").replace(/[^a-z0-9_-]/gi, "") : "";
    const cadetLessonActionBlock = cadetLessonAction && cadetLessonActionId ? `
      <button type="button" class="clear-cadet-ai-btn clear-cadet-lesson-btn" onclick="if (window.Game) window.Game.runClearCadetLessonPathAction('${safe(cadetLessonActionId)}')">${safe(cadetLessonAction.label || "RUN LESSON")}</button>
    ` : "";
    const cadetIdentityBlock = cadetIdentity ? `
      <div class="clear-cadet-record">
        <div class="clear-cadet-record-head">
          <span>${safe(cadetIdentity.label)}</span>
          <strong>${safe(cadetIdentity.title)}</strong>
        </div>
        <div class="clear-cadet-record-bar" aria-label="${safe(`${cadetIdentityPct}% toward next research rank`)}"><span style="width: ${cadetIdentityPct}%"></span></div>
        <p>${safe(cadetIdentity.body)}</p>
        ${cadetAIActionBlock}
        ${cadetLessonActionBlock}
      </div>
    ` : "";
    const starSummary = labStars || this.getClearLabStarSummary({ isDailyRun });
    const timeSummary = clearTime || this.lastClearTimeSummary || null;
    const elapsedText = timeSummary && Number.isFinite(timeSummary.elapsed) ? `${timeSummary.elapsed.toFixed(1)}s` : "--";
    const bestTimeText = timeSummary && Number.isFinite(timeSummary.best) ? `${timeSummary.best.toFixed(1)}s` : "--";
    const timeBadge = timeSummary && timeSummary.isNewBest
      ? `<div class="clear-lab-time new"><span>NEW LAB TIME</span><strong>${safe(elapsedText)} personal best</strong></div>`
      : (timeSummary ? `<div class="clear-lab-time"><span>LAB TIME</span><strong>${safe(elapsedText)} · best ${safe(bestTimeText)}</strong></div>` : "");
    const rivalResult = frontierRivalResult || (isFrontierRun ? this.lastFrontierRivalResult : null);
    const rivalLadder = isFrontierRun && typeof this.getFrontierRivalLadderProgress === 'function'
      ? this.getFrontierRivalLadderProgress()
      : null;
    const rivalLadderText = rivalLadder
      ? (rivalLadder.complete
        ? `Rival Ladder complete: ${rivalLadder.proofCount} proofs logged`
        : `Next ladder: ${rivalLadder.remaining} proof${rivalLadder.remaining === 1 ? "" : "s"} to ${rivalLadder.label} (+${rivalLadder.rewardXP} XP)`)
      : "";
    const rivalBlock = rivalResult && (rivalResult.state === "beaten" || rivalResult.state === "matched") ? `
      <div class="clear-frontier-rival ${rivalResult.state === "beaten" ? "beaten" : "matched"}">
        <div class="clear-frontier-rival-head">
          <span>FRONTIER RIVAL</span>
          <strong>${safe(rivalResult.label)}</strong>
        </div>
        <p>${safe(rivalResult.body)}</p>
        <em>${safe(`${rivalResult.shareCode || "Frontier share code ready"}${rivalResult.rivalProof ? ` · ${rivalResult.rivalProof.label} +${rivalResult.rivalProof.rewardXP} XP` : ""}`)}</em>
        ${rivalLadderText ? `<em class="clear-frontier-ladder">${safe(rivalLadderText)}</em>` : ""}
        <button type="button" class="clear-frontier-copy-btn" onclick="if (window.Game) window.Game.copyFrontierShareCode()">${safe(rivalResult.state === "beaten" ? "COPY WIN LINE" : "COPY MATCH LINE")}</button>
      </div>
    ` : "";
    const replayContract = this.getClearReplayContract({ labStars: starSummary, clearTime: timeSummary, isDailyRun, isFrontierRun, nextIndex, frontierRivalResult: rivalResult });
    this.lastClearReplayContract = replayContract;
    const replayContractBlock = replayContract ? `
      <div class="clear-lab-contract">
        <span>${safe(replayContract.kicker)}</span>
        <strong>${safe(replayContract.title)}</strong>
        <p>${safe(replayContract.body)}</p>
        <em>${safe(replayContract.reward)}</em>
        ${replayContract.cta ? `<button type="button" class="clear-lab-contract-btn" onclick="if (window.Game) window.Game.runClearReplayContract()">${safe(replayContract.cta)}</button>` : ""}
      </div>
    ` : "";
    const explainPrompt = this.getClearExplainPrompt();
    const explainAction = explainPrompt && explainPrompt.preserveReflectionContext
      ? "if (window.Game) window.Game.runClearExplainPrompt({ preserveReflectionContext: true })"
      : "if (window.Game) window.Game.runClearExplainPrompt()";
    const explainBlock = explainPrompt ? `
      <div class="clear-explain-card">
        <span>${safe(explainPrompt.kicker)}</span>
        <strong>${safe(explainPrompt.title)}</strong>
        <p>${safe(explainPrompt.question)}</p>
        <em>${safe(explainPrompt.evidence)}</em>
        ${explainPrompt.reward ? `<em class="clear-explain-reward">${safe(explainPrompt.reward)}</em>` : ""}
        <button type="button" class="clear-explain-btn" onclick="${explainAction}">${safe(explainPrompt.cta)}</button>
      </div>
    ` : "";
    const storyUnlock = this.getClearSignalStoryUnlock({ labStars: starSummary, isDailyRun, isFrontierRun });
    const storyUnlockBlock = storyUnlock ? `
      <div class="clear-story-unlock">
        <div class="clear-story-preview-head">
          <span>${safe(storyUnlock.kicker)}</span>
          <em>${safe(storyUnlock.progress)}</em>
        </div>
        <strong>${safe(storyUnlock.title)}</strong>
        <code>${safe(storyUnlock.concept)}</code>
        <p>${safe(storyUnlock.body)}</p>
      </div>
    ` : "";
    const storyPreview = this.getClearSignalStoryPreview({ isDailyRun, isFrontierRun, nextIndex });
    const storyPreviewBlock = storyPreview ? `
      <div class="clear-story-preview">
        <div class="clear-story-preview-head">
          <span>${safe(storyPreview.kicker)}</span>
          <em>${safe(storyPreview.progress)}</em>
        </div>
        <strong>${safe(storyPreview.title)}</strong>
        <code>${safe(storyPreview.concept)}</code>
        <p>${safe(storyPreview.body)}</p>
      </div>
    ` : "";
    const futureLabScene = this.discoveryPulse && this.discoveryPulse.futureLabScene ? this.discoveryPulse.futureLabScene : null;
    const futureLabSceneBlock = futureLabScene ? `
      <div class="clear-story-preview clear-future-lab-scene">
        <div class="clear-story-preview-head">
          <span>${safe(futureLabScene.label || "SOURCE SCENE")}</span>
          <em>${safe(futureLabScene.proofLabel || "future lab proof")}</em>
        </div>
        <strong>${safe(`${futureLabScene.speaker || "VECTOR"} // ${futureLabScene.title || "Source scene"}`)}</strong>
        <code>${safe(futureLabScene.lesson || "Science payoff logged")}</code>
        <p>${safe(futureLabScene.body || "The next lab seed is now connected to the story.")}</p>
      </div>
    ` : "";
    const villageTrust = typeof this.getVillageTrustProgress === 'function' ? this.getVillageTrustProgress(this.currentPlanetIndex) : null;
    const labChainTarget = typeof getLabChainTarget === 'function' ? getLabChainTarget(this) : null;
    this.lastClearLabChainTarget = labChainTarget;
    const objectiveQueue = this.getClearObjectiveQueue({
      replayContract,
      explainPrompt,
      storyUnlock,
      storyPreview,
      labChainTarget,
      villageTrust
    });
    this.lastClearObjectiveQueue = objectiveQueue;
    const objectiveQueueBlock = objectiveQueue.length ? `
      <div class="clear-objective-queue">
        <div class="clear-objective-queue-head">
          <span>NEXT OBJECTIVE QUEUE</span>
          <strong>${safe(objectiveQueue[0].cta || "ONE MORE RUN")}</strong>
        </div>
        ${objectiveQueue.map(item => `
          <div class="clear-objective-item">
            <span>#${item.priority} ${safe(item.label)}</span>
            <strong>${safe(item.title)}</strong>
            <p>${safe(item.body)}</p>
            ${(item.reward || item.cta) ? `<em>${safe(`${item.reward || "Reward ready"}${item.cta ? ` · ${item.cta}` : ""}`)}</em>` : ""}
            ${item.action ? `<button type="button" class="clear-objective-action-btn" onclick="if (window.Game) window.Game.runClearObjectiveQueueAction(${item.priority})">${safe(item.cta || "RUN")}</button>` : ""}
          </div>
        `).join("")}
      </div>
    ` : "";
    const starIcons = Array.from({ length: starSummary.maxStars }, (_, index) =>
      `<span class="clear-lab-star${index < starSummary.stars ? " earned" : ""}" aria-hidden="true">★</span>`
    ).join("");
    const starChecklist = starSummary.checks.map(check =>
      `<span class="${check.earned ? "earned" : ""}">${safe(`${check.earned ? "OK" : "NEXT"} ${check.label}`)}</span>`
    ).join("");
    const bestText = starSummary.isNewBest
      ? "NEW BEST"
      : (starSummary.best > starSummary.stars ? `BEST ${starSummary.best}/${starSummary.maxStars}` : "BEST MATCHED");
    const mastered = !!(starSummary.mastered || (starSummary.maxStars > 0 && starSummary.stars >= starSummary.maxStars && !isDailyRun));
    const masteryReward = starSummary.masteryRewardXP
      ? ` +${starSummary.masteryRewardXP} Research XP${starSummary.masteryRankUp && starSummary.masteryRankTitle ? ` · ${starSummary.masteryRankTitle}` : ""}`
      : "";
    const masteryRibbon = mastered ? `
      <div class="clear-lab-mastery${starSummary.isNewMastery ? " new" : ""}">
        <span>${safe(starSummary.isNewMastery ? "NEW MASTERY BADGE" : "MASTERY BADGE")}</span>
        <strong>${safe(starSummary.isNewMastery ? `3-star scientist clear unlocked${masteryReward}` : "World mastered")}</strong>
      </div>
    ` : "";
    const worldMastery = starSummary.worldMastery || this.getWorldMasteryProgress(this.currentPlanetIndex);
    const worldMasteryPct = worldMastery ? Math.max(0, Math.min(100, Number(worldMastery.pct) || 0)) : 0;
    const newWorldTiers = Array.isArray(starSummary.worldMasteryTierAwards) && starSummary.worldMasteryTierAwards.length
      ? starSummary.worldMasteryTierAwards.map(tier => tier.label).join(", ")
      : "";
    const worldMasteryNext = worldMastery && worldMastery.nextTier
      ? `${worldMastery.nextTier.label} at ${worldMastery.nextTier.xp} XP`
      : "Max world tier reached";
    const worldMasteryBlock = worldMastery ? `
      <div class="clear-world-mastery${newWorldTiers ? " new" : ""}">
        <div class="clear-world-mastery-head">
          <span>WORLD MASTERY</span>
          <strong>${safe(newWorldTiers || worldMastery.title)}</strong>
        </div>
        <div class="clear-world-mastery-bar" aria-label="${safe(`${worldMastery.xp} world mastery XP`)}"><span style="width: ${worldMasteryPct}%"></span></div>
        <p>${safe(`${worldMastery.xp} XP${starSummary.worldMasteryAddedXP ? ` · +${starSummary.worldMasteryAddedXP} this run` : ""} · ${worldMasteryNext}`)}</p>
      </div>
    ` : "";
    const villageTrustPct = villageTrust ? Math.max(0, Math.min(100, Number(villageTrust.pct) || 0)) : 0;
    const villageTrustNext = villageTrust && villageTrust.nextTier
      ? `${villageTrust.nextTier.label} at ${villageTrust.nextTier.points} trust`
      : "Max village trust reached";
    const villageTrustPact = villageTrust && villageTrust.nextPact ? villageTrust.nextPact : null;
    const villageTrustAction = villageTrust && villageTrust.nextTier && villageTrustPact
      ? `Next pact: ${villageTrustPact.title} - ${villageTrustPact.action} (${villageTrustPact.concept})`
      : "Village mentor status online";
    const villageTrustBlock = villageTrust ? `
      <div class="clear-village-trust">
        <div class="clear-village-trust-head">
          <span>VILLAGE TRUST</span>
          <strong>${safe(villageTrust.title)}</strong>
        </div>
        <div class="clear-village-trust-bar" aria-label="${safe(`${villageTrust.points} village trust`)}"><span style="width: ${villageTrustPct}%"></span></div>
        <p>${safe(`${villageTrust.points} trust · ${villageTrustNext} · ${villageTrustAction}`)}</p>
      </div>
    ` : "";
    const villageChain = typeof getVillageQuestChainPreview === 'function' ? getVillageQuestChainPreview(this) : null;
    const villageChainSteps = villageChain && Array.isArray(villageChain.steps)
      ? villageChain.steps.map(step => `<span class="${step.done ? "done" : ""}">${safe(`${step.done ? "OK" : "NEXT"} ${step.label}: ${step.concept}`)}</span>`).join("")
      : "";
    const villageChainBlock = villageChain ? `
      <div class="clear-village-chain ${safe(villageChain.stateClass || "new")}">
        <div class="clear-village-chain-head">
          <span>VILLAGE QUEST CHAIN</span>
          <strong>${safe(`${villageChain.doneCount}/${villageChain.total}`)}</strong>
        </div>
        <p>${safe(`${villageChain.title} · ${villageChain.formula} · ${villageChain.body}`)}</p>
        <div class="clear-village-chain-steps">${villageChainSteps}</div>
      </div>
    ` : "";
    const nextLabel = isFrontierRun
      ? "Open the log and compare this frontier tier."
      : (isDailyRun
        ? "Open the log and compare today's remix."
        : (nextIndex === null ? "Open the log or accept today's signal." : `Launch toward ${typeof PLANETS !== 'undefined' && PLANETS[nextIndex] ? PLANETS[nextIndex].name : "the next planet"}.`));
    const reportMode = isFrontierRun ? "Frontier Challenge solved" : (isDailyRun ? "Daily Signal solved" : "Shard experiment complete");

    report.innerHTML = `
      <div class="clear-lab-head">
        <span>CLEAR LAB REPORT</span>
        <strong>${safe(reportMode)}</strong>
      </div>
      <div class="clear-lab-stars" aria-label="${safe(`${starSummary.stars} of ${starSummary.maxStars} Lab Stars`)}">
        <div class="clear-lab-star-icons">${starIcons}</div>
        <strong>${safe(`${starSummary.stars}/${starSummary.maxStars} Lab Stars · ${bestText}`)}</strong>
      </div>
      ${cadetIdentityBlock}
      <div class="clear-lab-star-list">${starChecklist}</div>
      ${masteryRibbon}
      ${worldMasteryBlock}
      ${villageTrustBlock}
      ${villageChainBlock}
      ${unlockBlock}
      ${timeBadge}
      ${rivalBlock}
      ${objectiveQueueBlock}
      ${futureLabSceneBlock}
      ${storyUnlockBlock}
      ${storyPreviewBlock}
      ${explainBlock}
      ${replayContractBlock}
      <div class="clear-lab-grid">
        <div class="clear-lab-stat"><span>Max Height</span><strong>${safe(`${maxH}px`)}</strong></div>
        <div class="clear-lab-stat"><span>Max Speed</span><strong>${safe(`${maxV} px/f`)}</strong></div>
        <div class="clear-lab-stat"><span>Lab Time</span><strong>${safe(elapsedText)}</strong></div>
        <div class="clear-lab-stat"><span>Best Time</span><strong>${safe(bestTimeText)}</strong></div>
        <div class="clear-lab-stat"><span>Formula Cards</span><strong>${safe(formulaText)}</strong></div>
        <div class="clear-lab-stat"><span>Wallet Gain</span><strong>${safe(earnedGems > 0 ? `+${earnedGems} ${gemKey}` : "banked")}</strong></div>
      </div>
      <div class="clear-lab-next">
        <span>${safe(rank ? `${rank.title} · ${Math.round(rank.xp)} XP` : "Next step")}</span>
        <strong>${safe(quest ? `${quest.title} — ${quest.reward}` : nextLabel)}</strong>
      </div>
    `;
  }

  spawnFormulaCardEffect(pulse) {
    if (!pulse || !pulse.cardUnlocked || !this.player) return false;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y - 26;
    const collection = (typeof getFormulaCollection === 'function') ? getFormulaCollection(this) : null;
    const cardKind = pulse.formulaCardKind || pulse.kind;
    const cardRule = typeof DISCOVERY_RULES !== 'undefined' && Array.isArray(DISCOVERY_RULES)
      ? DISCOVERY_RULES.find(rule => rule && rule.kind === cardKind)
      : null;
    const discovered = this.discoveredFormulaKinds instanceof Set
      ? this.discoveredFormulaKinds.size
      : (Array.isArray(this.discoveredFormulaKinds) ? this.discoveredFormulaKinds.length : 0);
    const deckCount = collection ? collection.unlocked.length : discovered;
    const deckTotal = collection
      ? collection.cards.length
      : (typeof DISCOVERY_RULES !== 'undefined' && Array.isArray(DISCOVERY_RULES) ? DISCOVERY_RULES.length : Math.max(deckCount, 1));
    const deckLabel = `CARD ${deckCount}/${Math.max(1, deckTotal)}`;
    pulse.formulaDeckProgress = {
      count: deckCount,
      total: deckTotal,
      label: deckLabel
    };
    const effect = {
      x: px,
      y: py,
      vy: -0.55,
      life: 0,
      maxLife: 96,
      title: pulse.formulaCardTitle || (cardRule && cardRule.title) || pulse.title || "Formula Card",
      formula: pulse.formulaCardFormula || (cardRule && cardRule.formula) || pulse.formula || "",
      deckCount,
      deckTotal,
      deckLabel,
      color: "#facc15"
    };
    this.formulaCardEffects = (this.formulaCardEffects || []).slice(-2);
    this.formulaCardEffects.push(effect);
    if (typeof Particles !== 'undefined') {
      Particles.spawnBurst(px, py + 18, '#facc15', 14, 2.2, 2.3, 'glow');
      Particles.spawnBurst(px, py + 18, '#67e8f9', 8, 1.8, 1.9, 'glow');
    }
    if (typeof ComicBubbles !== 'undefined') {
      ComicBubbles.pop(px, py - 6, "CARD!", "#facc15", 1.0);
    }
    return true;
  }

  spawnScienceDeltaEffect(delta) {
    if (!this.player || !delta || !Array.isArray(delta.changes) || delta.changes.length === 0) return null;
    const first = delta.changes[0] || {};
    const label = String(first.label || "Science").slice(0, 14).toUpperCase();
    const color = first.direction === "down"
      ? "#93c5fd"
      : (first.direction === "swap" ? "#f0abfc" : "#86efac");
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 12, `${label}!`, color, 0.92);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py, color, 12, 2.1, 2.0, 'glow');
      Particles.spawnBurst(px, py, '#fef08a', 6, 1.5, 1.5, 'glow');
    }
    return { label, color, x: px, y: py };
  }

  spawnHypothesisEffect(pulse) {
    if (!this.player || !pulse || !pulse.hypothesisConfirmed) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = "HYPOTHESIS!";
    const color = "#a7f3d0";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 34, label, color, 1.02);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 2, color, 12, 2.1, 1.9, 'glow');
      Particles.spawnBurst(px, py - 2, '#67e8f9', 6, 1.7, 1.6, 'glow');
    }
    return { label, color, x: px, y: py };
  }

  spawnNotebookReflectionEffect(pulse) {
    if (!this.player || !pulse) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const title = String(pulse.title || "");
    const sourceKey = /Source Key Reflection/i.test(title) || /source\s*key/i.test(String(pulse.formula || ""));
    const darkMatter = !sourceKey && /Dark Matter Reflection/i.test(title);
    const signal = !sourceKey && !darkMatter && /Signal Reflection/i.test(title);
    const repair = !sourceKey && !darkMatter && !signal && /Repair Reflection/i.test(title);
    const strongProof = signal || sourceKey || darkMatter || repair;
    const label = sourceKey ? "SOURCE PROOF!" : (darkMatter ? "DARK PROOF!" : (signal ? "SIGNAL PROOF!" : (repair ? "REPAIR PROOF!" : "PROOF SAVED!")));
    const color = sourceKey ? "#fef08a" : (darkMatter ? "#818cf8" : (signal ? "#bef264" : (repair ? "#facc15" : "#a7f3d0")));
    const monitorLabel = sourceKey ? "SOURCE PROOF" : (darkMatter ? "DARK MATTER PROOF" : (signal ? "SIGNAL PROOF" : (repair ? "REPAIR EXPLAINED" : "EXPLAIN SAVED")));
    const rewardXP = Math.max(0, Math.floor(Number(pulse.rewardXP) || 0));

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 56, label, color, strongProof ? 1.05 : 0.96);
      ComicBubbles.pop(px, baseY - 38, "EXPLAINED", "#67e8f9", 0.78);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 8, color, strongProof ? 14 : 10, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 8, "#67e8f9", strongProof ? 8 : 5, 1.7, 1.6, "glow");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`${monitorLabel}: +${rewardXP} Research XP`, {
        title: "SCIENCE NOTEBOOK",
        color,
        timer: 240
      });
    }

    this.lastNotebookReflectionEffect = {
      label,
      color,
      signal,
      darkMatter,
      sourceKey,
      rewardXP,
      x: px,
      y: py
    };
    return this.lastNotebookReflectionEffect;
  }

  spawnReturnStreakEffect(pulse) {
    if (!this.player || !pulse) return null;
    const streak = Math.max(1, Math.floor(Number(pulse.streakCount) || 1));
    const rewardXP = Math.max(0, Math.floor(Number(pulse.rewardXP) || 0));
    if (rewardXP <= 0) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = `DAY ${Math.min(99, streak)} STREAK!`;
    const color = "#facc15";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 58, label, color, 1.02);
      ComicBubbles.pop(px, baseY - 39, `+${rewardXP} RESEARCH`, "#a7f3d0", 0.78);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 12, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 10, "#67e8f9", 7, 1.6, 1.5, "glow");
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon(`DAILY STREAK: +${rewardXP} Research XP`, {
        title: "DAILY LAB",
        color,
        timer: 240
      });
    }

    this.lastReturnStreakEffect = {
      label,
      color,
      streak,
      rewardXP,
      x: px,
      y: py
    };
    return this.lastReturnStreakEffect;
  }

  spawnResearchRankEffect(pulse) {
    if (!this.player || !pulse || !pulse.rankUp) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = "LAB RANK UP!";
    const color = "#facc15";
    const perkLabel = pulse.rankPerk && pulse.rankPerk.label ? pulse.rankPerk.label : null;

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 62, label, color, 1.12);
      if (perkLabel) ComicBubbles.pop(px, baseY - 42, perkLabel.toUpperCase(), "#a7f3d0", 0.82);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 12, color, 18, 2.4, 2.2, 'glow');
      Particles.spawnBurst(px, py - 12, '#a7f3d0', 10, 1.8, 1.8, 'glow');
    }
    return {
      label,
      color,
      rankTitle: pulse.rankTitle || "",
      perkLabel,
      x: px,
      y: py
    };
  }

  spawnWorldMasteryTierEffect(tier, xp = 0) {
    if (!this.player || !tier) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = "WORLD TIER!";
    const color = "#38bdf8";
    const tierLabel = tier.label || "World Mastery";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 72, label, color, 1.08);
      ComicBubbles.pop(px, baseY - 52, String(tierLabel).toUpperCase(), "#facc15", 0.86);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 14, color, 16, 2.4, 2.2, 'glow');
      Particles.spawnBurst(px, py - 14, '#facc15', 10, 1.8, 1.8, 'glow');
    }

    this.lastWorldMasteryTierEffect = {
      label,
      color,
      tierId: tier.id || "",
      tierLabel,
      xp: Math.max(0, Math.floor(Number(xp) || 0)),
      x: px,
      y: py
    };
    return this.lastWorldMasteryTierEffect;
  }

  spawnWorldMasteryXPEffect(amount = 0, reason = "practice", progress = null) {
    if (!this.player) return null;
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = `WORLD +${add} XP`;
    const color = "#67e8f9";
    const tierLabel = progress && progress.title ? progress.title : "World mastery";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 66, label, color, 0.88);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 8, 1.9, 1.8, 'glow');
    }

    this.lastWorldMasteryXPEffect = {
      label,
      color,
      addedXP: add,
      reason,
      tierLabel,
      xp: progress && Number.isFinite(Number(progress.xp)) ? Math.floor(Number(progress.xp)) : add,
      x: px,
      y: py
    };
    return this.lastWorldMasteryXPEffect;
  }

  spawnDiscoveryComboPrimerEffect(pulse) {
    const combo = pulse && Number.isFinite(pulse.combo) ? Math.floor(pulse.combo) : 0;
    if (!this.player || combo !== 1) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const label = "CHAIN READY!";
    const color = "#67e8f9";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 48, label, color, 0.94);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 8, color, 8, 1.9, 1.8, 'glow');
      Particles.spawnBurst(px, py - 8, '#fef08a', 5, 1.4, 1.4, 'glow');
    }
    if (typeof this.showMissionBalloon === 'function') {
      this.showMissionBalloon("CHAIN READY: make one new change", {
        title: "LAB CHAIN",
        color,
        timer: 220
      });
    }
    return { label, color, combo, x: px, y: py };
  }

  spawnDiscoveryComboEffect(pulse) {
    const combo = pulse && Number.isFinite(pulse.combo) ? Math.floor(pulse.combo) : 0;
    if (!this.player || combo < 2) return null;
    const baseX = Number.isFinite(this.player.x) ? this.player.x : 0;
    const baseY = Number.isFinite(this.player.y) ? this.player.y : 0;
    const width = Number.isFinite(this.player.w) ? this.player.w : 24;
    const height = Number.isFinite(this.player.h) ? this.player.h : 32;
    const px = baseX + width / 2;
    const py = baseY + height / 2;
    const boosted = !!(pulse.comboAmplifierBonusXP > 0);
    const label = `LAB CHAIN x${Math.min(99, combo)}`;
    const color = boosted ? "#facc15" : "#67e8f9";

    if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
      ComicBubbles.pop(px, baseY - 38, label, color, boosted ? 1.08 : 0.96);
    }
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 4, color, boosted ? 16 : 10, boosted ? 2.4 : 2.0, 2.0, 'glow');
      if (boosted) Particles.spawnBurst(px, py - 4, '#fef08a', 8, 1.8, 1.7, 'glow');
    }
    return { label, color, combo, boosted };
  }

  updateFormulaCardEffects() {
    if (!this.formulaCardEffects || !this.formulaCardEffects.length) return;
    for (const fx of this.formulaCardEffects) {
      fx.life++;
      fx.y += fx.vy || 0;
    }
    this.formulaCardEffects = this.formulaCardEffects.filter(fx => fx.life < fx.maxLife);
  }

  fitCardText(ctx, text, maxWidth) {
    let out = String(text || "");
    while (out.length > 4 && ctx.measureText(out).width > maxWidth) {
      out = out.slice(0, -2);
    }
    return out === String(text || "") ? out : out + ".";
  }

  drawFormulaCardEffects(ctx) {
    if (!ctx || !this.formulaCardEffects || !this.formulaCardEffects.length) return;
    for (const fx of this.formulaCardEffects) {
      const t = fx.life / Math.max(1, fx.maxLife);
      const alpha = t < 0.12 ? t / 0.12 : (t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1);
      const cx = fx.x - this.cameraX;
      const cy = fx.y - Math.sin(Math.min(1, t) * Math.PI) * 8;
      if (cx < -90 || cx > this.canvas.width + 90) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * Math.PI * 2) * 0.05);
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(250, 204, 21, 0.55)";
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = fx.color || "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-70, -28, 140, 56, 7);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("NEW FORMULA", -58, -17);
      ctx.fillStyle = "#67e8f9";
      ctx.textAlign = "right";
      ctx.fillText(this.fitCardText(ctx, fx.deckLabel || "CARD", 54), 58, -17);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 10px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.fitCardText(ctx, fx.title, 112), 0, 1);
      ctx.fillStyle = "#67e8f9";
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.fillText(this.fitCardText(ctx, fx.formula, 116), 0, 14);
      ctx.restore();
    }
  }

  drawMissionSampleBeacon(ctx) {
    if (!ctx || this.state !== 'playing') return null;
    let target = this.getNextMissionSampleTarget();
    let label = "SAMPLE";
    let kind = "sample";
    if (!target) {
      target = this.getReadyPortalTarget();
      label = "EXIT";
      kind = "portal";
    }
    if (!target) return null;
    const width = Number.isFinite(target.w) ? target.w : 16;
    const height = Number.isFinite(target.h) ? target.h : 16;
    const cx = (Number.isFinite(target.x) ? target.x : 0) + width / 2 - (this.cameraX || 0);
    const cy = (Number.isFinite(target.y) ? target.y : 0) + height / 2;
    const gem = target.gem || (typeof this.getGemConfig === 'function' ? this.getGemConfig() : null);
    const color = kind === "portal" ? "#bef264" : (gem && gem.color ? gem.color : "#facc15");
    if (this.canvas && (cx < -48 || cx > this.canvas.width + 48 || cy < -48 || cy > this.canvas.height + 48)) {
      return this.drawMissionSampleEdgeMarker(ctx, target, color, cx, cy, label, kind);
    }

    const t = this.reducedMotion ? 0 : Date.now() / 360;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t);
    const ring = (kind === "portal" ? 24 : 18) + pulse * 4;
    const bob = this.reducedMotion ? 0 : Math.sin(t * 1.4) * 2;

    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    if (ctx.setLineDash) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);

    ctx.globalAlpha = 0.62;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44 + bob);
    ctx.lineTo(cx - 7, cy - 31 + bob);
    ctx.lineTo(cx + 7, cy - 31 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.92;
    ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(3, 7, 18, 0.86)";
    ctx.fillStyle = "#f8fafc";
    ctx.strokeText(label, cx, cy - 52 + bob);
    ctx.fillText(label, cx, cy - 52 + bob);
    ctx.restore();
    return { target, visible: true, color, x: cx, y: cy, label, kind };
  }

  drawMissionSampleEdgeMarker(ctx, target, color, screenX, screenY, label = "SAMPLE", kind = "sample") {
    if (!ctx || !this.canvas) return { target, visible: false, offscreen: true, color };
    const margin = 24;
    const labelGap = 18;
    const markerX = Math.max(margin, Math.min(this.canvas.width - margin, screenX));
    const markerY = Math.max(margin + labelGap, Math.min(this.canvas.height - margin, screenY));
    const angle = Math.atan2(screenY - markerY, screenX - markerX);
    const bob = this.reducedMotion ? 0 : Math.sin(Date.now() / 260) * 1.5;

    ctx.save();
    ctx.translate(markerX, markerY + bob);
    ctx.rotate(Number.isFinite(angle) ? angle : 0);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = color || "#facc15";
    ctx.strokeStyle = "rgba(3, 7, 18, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color || "#facc15";
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(3, 7, 18, 0.88)";
    ctx.fillStyle = "#f8fafc";
    ctx.strokeText(label, markerX, markerY + labelGap + bob);
    ctx.fillText(label, markerX, markerY + labelGap + bob);
    ctx.restore();
    return { target, visible: false, offscreen: true, color, x: markerX, y: markerY, angle, label, kind };
  }

  getRunObjectiveCompassCue() {
    if (this.state !== 'playing' || typeof getRunObjectiveQueue !== 'function') return null;
    let queue = [];
    try {
      queue = getRunObjectiveQueue(this);
    } catch (err) {
      queue = [];
    }
    if (!Array.isArray(queue) || !queue.length) return null;
    const item = queue[0] || {};
    const trail = queue.slice(1, 4).map(next => ({
      priority: next && next.priority ? next.priority : 1,
      label: next && next.label ? String(next.label) : "NEXT",
      color: next && next.color ? next.color : "#94a3b8",
      disabled: !!(next && next.disabled)
    }));
    const commandLine = String(item.command || "")
      .split(/\n/)
      .map(line => line.trim())
      .find(Boolean) || "";
    const itemBody = String(item.body || "").trim();
    const reasonLine = commandLine && itemBody && itemBody !== commandLine ? itemBody : "";
    return {
      key: `${item.label || "NEXT"}:${item.title || "Next objective"}:${commandLine || item.body || item.reward || ""}:${item.source || "run-objective-queue"}`,
      priority: item.priority || 1,
      label: item.label || "NEXT",
      cta: item.cta || (commandLine ? "STAGE" : "CHECK"),
      title: item.title || "Next objective",
      body: commandLine || itemBody || item.reward || "Run the next focused experiment.",
      reasonLine,
      reward: item.reward || "",
      commandLine,
      kind: item.kind || "objective",
      source: item.source || "run-objective-queue",
      color: item.color || "#67e8f9",
      disabled: !!item.disabled,
      queueCount: queue.length,
      trail,
      trailLabel: trail.length
        ? `NEXT ${trail.map(next => `#${next.priority} ${next.label}`).join(" -> ")}`
        : ""
    };
  }

  drawRunObjectiveCompass(ctx) {
    const cue = this.getRunObjectiveCompassCue();
    if (!ctx || !cue || !this.canvas || !this.player) {
      this.lastRunObjectiveCompassKey = null;
      return null;
    }
    const W = this.canvas.width || 720;
    const H = this.canvas.height || 448;
    const p = this.player;
    const px = (Number.isFinite(p.x) ? p.x : 0) + (Number.isFinite(p.w) ? p.w : 24) / 2 - (this.cameraX || 0);
    const py = Number.isFinite(p.y) ? p.y : H / 2;
    const w = Math.max(124, Math.min(176, W - 24));
    const hasReason = !!cue.reasonLine;
    const hasTrail = !!(cue.trail && cue.trail.length);
    const h = 48 + (hasReason ? 12 : 0) + (hasTrail ? 12 : 0);
    const x = Math.max(12, Math.min(W - w - 12, px - w / 2));
    const y = Math.max(64, Math.min(H - h - 16, py - 62));
    const color = cue.color || "#67e8f9";
    const pulse = this.reducedMotion ? 0.45 : 0.45 + 0.35 * Math.sin(Date.now() / 480);
    const previousKey = this.lastRunObjectiveCompassKey || "";
    if (previousKey && previousKey !== cue.key) {
      this.runObjectiveCompassFlash = 24;
    }
    this.lastRunObjectiveCompassKey = cue.key;
    const flashFrames = Math.max(0, Math.floor(Number(this.runObjectiveCompassFlash) || 0));
    if (flashFrames > 0) this.runObjectiveCompassFlash = flashFrames - 1;
    const flash = Math.max(0, Math.min(1, flashFrames / 24));

    ctx.save();
    ctx.globalAlpha = Math.min(0.96, (cue.disabled ? 0.72 : 0.86) + flash * 0.08);
    ctx.strokeStyle = cue.disabled ? "rgba(203, 213, 225, 0.52)" : color;
    ctx.fillStyle = "rgba(2, 6, 23, 0.68)";
    ctx.shadowBlur = cue.disabled ? 0 : 8 + pulse * 4 + flash * 8;
    ctx.shadowColor = color;
    ctx.lineWidth = 1.3 + flash * 0.8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    if (flash > 0) {
      ctx.globalAlpha = 0.34 * flash;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 4 - flash * 4, y - 4 - flash * 3, w + 8 + flash * 8, h + 8 + flash * 6, 11);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    for (let lineY = y + 7; lineY < y + h - 5; lineY += 6) ctx.fillRect(x + 8, lineY, w - 16, 1);
    ctx.globalAlpha = cue.disabled ? 0.76 : 0.94;

    ctx.fillStyle = color;
    ctx.font = "bold 7px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.fitCardText(ctx, `#${cue.priority} ${cue.label}`, w - 72), x + 9, y + 10);
    ctx.textAlign = "right";
    ctx.fillText(this.fitCardText(ctx, cue.cta, 58), x + w - 9, y + 10);

    ctx.textAlign = "left";
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 9px 'Share Tech Mono', monospace";
    ctx.fillText(this.fitCardText(ctx, cue.title, w - 18), x + 9, y + 26);
    ctx.fillStyle = cue.disabled ? "#e2e8f0" : "#bbf7d0";
    ctx.font = "7px 'Share Tech Mono', monospace";
    ctx.fillText(this.fitCardText(ctx, cue.body, w - 18), x + 9, y + 39);
    if (hasReason) {
      ctx.fillStyle = cue.disabled ? "#cbd5e1" : "#fde68a";
      ctx.font = "6.5px 'Share Tech Mono', monospace";
      ctx.fillText(this.fitCardText(ctx, cue.reasonLine, w - 18), x + 9, y + 50);
    }

    if (hasTrail) {
      const trailY = y + h - 10;
      ctx.globalAlpha = 0.86;
      cue.trail.forEach((next, index) => {
        const dotX = x + 10 + index * 14;
        ctx.fillStyle = next.disabled ? "rgba(148, 163, 184, 0.52)" : (next.color || "#94a3b8");
        ctx.beginPath();
        ctx.roundRect(dotX, trailY - 3, 9, 5, 2);
        ctx.fill();
      });
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 6.5px 'Share Tech Mono', monospace";
      ctx.fillText(this.fitCardText(ctx, cue.trailLabel, w - 54), x + 52, trailY);
    }

    ctx.globalAlpha = cue.disabled ? 0.35 : 0.62;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.max(x + 18, Math.min(x + w - 18, px)), y + h);
    ctx.lineTo(px, Math.max(12, py - 8));
    ctx.stroke();
    ctx.restore();

    this.lastRunObjectiveCompassCue = { ...cue, x, y, w, h, flashFrames };
    return this.lastRunObjectiveCompassCue;
  }

  getFutureLabRunProgress(preferredStageId = null) {
    if (typeof getFutureLabRoadmapStages !== 'function') return null;
    let stages = null;
    try {
      stages = getFutureLabRoadmapStages(this);
    } catch (err) {
      stages = null;
    }
    if (!Array.isArray(stages) || !stages.length) return null;
    const done = stages.filter(stage => stage && stage.status === "done").length;
    const complete = done >= stages.length;
    const preferred = preferredStageId ? stages.find(stage => stage && stage.id === preferredStageId) : null;
    const next = complete ? null : (stages.find(stage => stage && stage.status === "next") || stages.find(stage => stage && stage.status !== "done") || stages[stages.length - 1]);
    const target = !complete && preferred && preferred.status === "next" ? preferred : next;
    return {
      done,
      total: stages.length,
      nextId: target ? target.id : "future-source-key",
      nextTitle: target ? target.title : "Source key ready",
      nextReward: target ? target.reward : "Reward: Future Lab source rehearsal",
      progressLine: `${done}/${stages.length} proofs -> ${target ? target.title : "Source key ready"}`,
      statuses: stages.map(stage => ({
        id: stage.id,
        status: stage.status,
        title: stage.title
      }))
    };
  }

  getFutureLabRunScene(sceneKey = null) {
    const key = sceneKey ? String(sceneKey) : "";
    if (key === "anomaly-trace") {
      return {
        label: "TRACE BRIEF",
        speaker: "VECTOR",
        title: "Field prototype",
        lesson: "Coding payoff: one touch event can reveal an invisible force."
      };
    }
    if (key === "future-source") {
      return {
        label: "SOURCE SCENE",
        speaker: "HOPPER-ZERO",
        title: "The source key hums",
        lesson: "Science payoff: hidden forces plus probability explain the source signal."
      };
    }
    if (typeof getSignalSourceScene === 'function') {
      let scene = null;
      try {
        scene = getSignalSourceScene(this);
      } catch (err) {
        scene = null;
      }
      if (scene) {
        return {
          label: scene.label || "SOURCE SCENE",
          speaker: scene.speaker || "VECTOR",
          title: scene.title || "Future lab source",
          lesson: scene.lesson || scene.body || "Science payoff: connect code evidence to the next source."
        };
      }
    }
    const fallback = {
      "dark-matter-echo": {
        label: "ECHO BRIEF",
        speaker: "VECTOR",
        title: "Anomaly triangulation",
        lesson: "Science payoff: repeated Frontier evidence can reveal an unseen cause."
      },
      "dark-matter-evidence": {
        label: "CASE FILE",
        speaker: "VECTOR",
        title: "Hidden-force case file",
        lesson: "Science payoff: infer an unseen force from visible motion."
      },
      "quantum-branch": {
        label: "GATE SCENE",
        speaker: "VECTOR",
        title: "Quantum Gate wakes",
        lesson: "Coding payoff: one condition can change the route."
      },
      "quantum-chance": {
        label: "SOURCE SCENE",
        speaker: "HOPPER-ZERO",
        title: "Two paths detected",
        lesson: "Coding payoff: chance measures how often a branch wins."
      }
    };
    return fallback[key] || null;
  }

  getFutureLabRunTransmission(cue) {
    if (!cue) return null;
    const label = cue.label ? String(cue.label) : "";
    const speaker = cue.scene && cue.scene.speaker
      ? cue.scene.speaker
      : (cue.mode === "chance" ? "HOPPER-ZERO" : "VECTOR");
    const stageKey = cue.progress && cue.progress.nextId ? cue.progress.nextId : label.toLowerCase();
    const variantsByStage = {
      "dark-matter-echo": [
        "Frontier evidence is the receiver; stars and time decode the echo.",
        "Same signal, harder remix: collect proof that the anomaly is real.",
        "The hidden force starts as a pattern before it becomes a field."
      ],
      "hidden-force-trace": [
        "Touch the magnet, watch motion bend, then name the unseen field.",
        "The event rule is your detector: contact first, force clue second.",
        "A field you cannot see still leaves a motion trail."
      ],
      "dark-matter-evidence": [
        "Do not guess the force; trap it with curve evidence.",
        "Same route, one variable, compare the bend.",
        "If motion bends without a visible push, log the hidden pull."
      ],
      "quantum-branch": [
        "A branch is a decision, not magic; prove which condition opens it.",
        "Set the state, run the if rule, then watch which path answers.",
        "One condition can split the same world into two testable routes."
      ],
      "quantum-chance": [
        "One chance call is a clue; repeated trials reveal the pattern.",
        "Random does not mean unknowable; count the wins and compare the rate.",
        "The source needs a measured pattern, not one lucky branch."
      ],
      "future-source-key": [
        "Hidden-force clues and probability now point at the same source.",
        "The key holds when force evidence and chance evidence agree.",
        "Run the rehearsal like a scientist: compare, explain, then lock the source."
      ]
    };
    const variants = variantsByStage[stageKey] || [
      "One fresh run, one clear variable, one stronger proof."
    ];
    const elapsed = typeof this.getRunTimeSeconds === 'function' ? this.getRunTimeSeconds() : 0;
    const bucket = Math.max(0, Math.floor((Number(elapsed) || 0) / 18));
    const index = variants.length ? bucket % variants.length : 0;
    const proofCount = cue.progress && Number.isFinite(cue.progress.done) && Number.isFinite(cue.progress.total)
      ? `${cue.progress.done}/${cue.progress.total} seeds`
      : "active proof";
    return {
      label: "CASE TRANSMISSION",
      speaker,
      line: variants[index] || variants[0],
      proofCount,
      variantIndex: index,
      variantTotal: variants.length
    };
  }

  withFutureLabTransmission(cue) {
    if (!cue) return null;
    return {
      ...cue,
      transmission: this.getFutureLabRunTransmission(cue)
    };
  }

  getFutureLabRunCue() {
    if (this.state !== 'playing') return null;
    const staged = this.lastStagedExperiment || null;
    const source = staged && staged.source ? String(staged.source) : "";
    if (this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.futureSourcePrep) {
      return this.withFutureLabTransmission({
        label: "SOURCE KEY",
        title: "Source rehearsal",
        body: "Compare hidden-force clues with branch and chance evidence.",
        formula: "hidden force + chance -> source key",
        color: "#facc15",
        mode: "chance",
        progress: this.getFutureLabRunProgress("future-source-key"),
        scene: this.getFutureLabRunScene("future-source")
      });
    }
    if (this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.darkMatterEcho) {
      return this.withFutureLabTransmission({
        label: "DARK MATTER ECHO",
        title: "Decode anomaly",
        body: "Use Frontier stars, time, and motion clues to prove the signal changed.",
        formula: "repeat evidence -> hidden clue",
        color: "#818cf8",
        mode: "curve",
        progress: this.getFutureLabRunProgress("dark-matter-echo"),
        scene: this.getFutureLabRunScene("dark-matter-echo")
      });
    }
    if (this.dailyInfo && this.dailyInfo.isFrontier && this.dailyInfo.darkMatterPrep) {
      return this.withFutureLabTransmission({
        label: "DARK MATTER PREP",
        title: "Curve evidence",
        body: "Compare path curve, speed, and force to infer an unseen pull.",
        formula: "motion clue -> hidden force",
        color: "#818cf8",
        mode: "curve",
        progress: this.getFutureLabRunProgress("dark-matter-evidence"),
        scene: this.getFutureLabRunScene("dark-matter-evidence")
      });
    }
    if (source === "start-anomaly-trace") {
      return this.withFutureLabTransmission({
        label: "ANOMALY TRACE",
        title: "Invisible field test",
        body: "Use the magnet event rule as a prototype for hidden forces.",
        formula: "event -> field response",
        color: "#a78bfa",
        mode: "field",
        progress: this.getFutureLabRunProgress("hidden-force-trace"),
        scene: this.getFutureLabRunScene("anomaly-trace")
      });
    }
    if (source === "start-quantum-branch") {
      return this.withFutureLabTransmission({
        label: "QUANTUM PREP",
        title: "Branch condition",
        body: "One game state chooses one code path.",
        formula: "if state -> path A/B",
        color: "#22d3ee",
        mode: "branch",
        progress: this.getFutureLabRunProgress("quantum-branch"),
        scene: this.getFutureLabRunScene("quantum-branch")
      });
    }
    if (source === "start-quantum-chance") {
      return this.withFutureLabTransmission({
        label: "QUANTUM CHANCE",
        title: "Probability seed",
        body: "Repeat chance trials and compare the observed rate.",
        formula: "chance p -> measured pattern",
        color: "#38bdf8",
        mode: "chance",
        progress: this.getFutureLabRunProgress("quantum-chance"),
        scene: this.getFutureLabRunScene("quantum-chance")
      });
    }
    return null;
  }

  drawFutureLabRunCue(ctx) {
    const cue = this.getFutureLabRunCue();
    if (!ctx || !cue || !this.canvas) return null;
    const W = this.canvas.width || 720;
    const H = this.canvas.height || 448;
    const x = Math.max(14, W - 238);
    const y = Math.max(110, H - 166);
    const w = 218;
    const h = 140;
    const t = this.reducedMotion ? 0 : Date.now() / 700;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t);
    const color = cue.color || "#67e8f9";

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 12 + pulse * 4;
    ctx.shadowColor = color;
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
    for (let lineY = y + 8; lineY < y + h - 6; lineY += 5) ctx.fillRect(x + 6, lineY, w - 12, 1);

    ctx.fillStyle = color;
    ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(cue.label, x + 10, y + 12);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px 'Share Tech Mono', monospace";
    ctx.fillText(cue.title, x + 10, y + 28);
    ctx.fillStyle = "#dbeafe";
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.fillText(this.fitCardText(ctx, cue.body, w - 20), x + 10, y + 44);
    ctx.fillStyle = "#bef264";
    ctx.fillText(this.fitCardText(ctx, cue.formula, w - 20), x + 10, y + 61);

    if (cue.scene) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 7px 'Share Tech Mono', monospace";
      const sceneLine = `${cue.scene.speaker || "VECTOR"}: ${cue.scene.title || cue.scene.label || "Source scene"}`;
      ctx.fillText(this.fitCardText(ctx, sceneLine, w - 20), x + 10, y + 76);
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText(this.fitCardText(ctx, cue.scene.lesson || "", w - 20), x + 10, y + 90);
    }

    if (cue.transmission) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 7px 'Share Tech Mono', monospace";
      const transmissionLine = `${cue.transmission.speaker || "VECTOR"}: ${cue.transmission.line || ""}`;
      ctx.fillText(this.fitCardText(ctx, transmissionLine, w - 20), x + 10, y + 105);
    }

    if (cue.progress) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#e0f2fe";
      ctx.font = "bold 7px 'Share Tech Mono', monospace";
      ctx.fillText(this.fitCardText(ctx, cue.progress.progressLine, w - 20), x + 10, y + 119);
      const pips = Array.isArray(cue.progress.statuses) ? cue.progress.statuses : [];
      const pipY = y + h - 13;
      for (let i = 0; i < pips.length; i++) {
        const status = pips[i] && pips[i].status;
        const px = x + 10 + i * 15;
        ctx.globalAlpha = status === "locked" ? 0.34 : 0.92;
        ctx.fillStyle = status === "done" ? color : (status === "next" ? "#fef08a" : "rgba(148, 163, 184, 0.7)");
        ctx.strokeStyle = status === "next" ? "#fef08a" : "rgba(226, 232, 240, 0.42)";
        ctx.lineWidth = status === "next" ? 1.4 : 1;
        ctx.beginPath();
        ctx.roundRect(px, pipY, 10, 5, 2);
        if (status === "done") ctx.fill();
        else ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.fillText(`${cue.progress.done}/${cue.progress.total}`, x + w - 36, pipY + 3);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.72;
    ctx.font = "bold 8px 'Share Tech Mono', monospace";
    if (cue.mode === "branch" || cue.mode === "chance") {
      const cx = x + w - 42;
      const cy = y + 27;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx - 16, cy + 24);
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx + 16, cy + 24);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.fillText(cue.mode === "chance" ? "%" : "IF", cx - 10, cy - 9);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w - 70, y + 23);
      ctx.bezierCurveTo(x + w - 50, y + 8, x + w - 32, y + 52, x + w - 12, y + 34);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 34, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    this.lastFutureLabRunCue = cue;
    return cue;
  }

  getLabChainRunCue() {
    if (this.state !== 'playing') return null;
    const combo = Math.max(0, Math.floor(Number(this.discoveryCombo) || 0));
    if (combo <= 0) return null;
    const target = typeof getActiveLabChainMilestone === 'function'
      ? getActiveLabChainMilestone(this)
      : (typeof this.getNextDiscoveryComboMilestone === 'function' ? this.getNextDiscoveryComboMilestone(combo) : null);
    const labTarget = typeof getLabChainTarget === 'function' ? getLabChainTarget(this) : null;
    const state = labTarget && labTarget.state ? labTarget.state : (combo > 1 ? "active" : "ready");
    const nextCombo = target && Number.isFinite(target.target)
      ? target.target
      : (target && Number.isFinite(target.combo) ? target.combo : Math.min(99, combo + 1));
    const reward = target && Number.isFinite(target.reward)
      ? target.reward
      : (target && Number.isFinite(target.rewardXP) ? target.rewardXP : 0);
    const remaining = target && Number.isFinite(target.remaining)
      ? Math.max(0, target.remaining)
      : Math.max(0, nextCombo - combo);
    const pipTotal = Math.max(2, Math.min(6, nextCombo));
    const pipFilled = Math.max(0, Math.min(pipTotal, combo));
    const milestoneLabel = target && target.label ? target.label : `x${nextCombo}`;
    const title = state === "paused"
      ? "Fresh evidence needed"
      : (combo > 1 ? `Experiment chain x${combo}` : "Chain ready");
    const body = state === "paused"
      ? "Change one new target to restart combo proof."
      : (remaining <= 1
        ? `One fresh proof reaches ${milestoneLabel}.`
        : `${remaining} fresh proofs to ${milestoneLabel}.`);
    const color = state === "paused" ? "#cbd5e1" : (combo >= 3 ? "#facc15" : "#67e8f9");
    return {
      label: state === "paused" ? "CHAIN PAUSED" : "LAB CHAIN",
      title,
      body,
      combo,
      state,
      color,
      nextCombo,
      milestoneLabel,
      reward,
      remaining,
      pipTotal,
      pipFilled
    };
  }

  drawLabChainRunCue(ctx) {
    const cue = this.getLabChainRunCue();
    if (!ctx || !cue || !this.canvas) return null;
    const W = this.canvas.width || 720;
    const x = Math.max(190, W - 196);
    const y = 10;
    const w = 182;
    const h = 58;
    const color = cue.color || "#67e8f9";
    const pulse = this.reducedMotion ? 0.45 : 0.45 + 0.35 * Math.sin(Date.now() / 520);

    ctx.save();
    ctx.globalAlpha = cue.state === "paused" ? 0.78 : 0.9;
    ctx.shadowBlur = cue.state === "paused" ? 0 : 8 + pulse * 4;
    ctx.shadowColor = color;
    ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
    ctx.strokeStyle = cue.state === "paused" ? "rgba(203, 213, 225, 0.42)" : color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const rewardText = cue.reward > 0 ? ` +${cue.reward} XP` : "";
    ctx.fillText(this.fitCardText(ctx, `${cue.label}${rewardText}`, w - 18), x + 10, y + 11);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 10px 'Share Tech Mono', monospace";
    ctx.fillText(this.fitCardText(ctx, cue.title, w - 18), x + 10, y + 27);
    ctx.fillStyle = cue.state === "paused" ? "#e2e8f0" : "#bbf7d0";
    ctx.font = "7px 'Share Tech Mono', monospace";
    ctx.fillText(this.fitCardText(ctx, cue.body, w - 18), x + 10, y + 41);

    const pipY = y + h - 10;
    const pipW = 13;
    for (let i = 0; i < cue.pipTotal; i++) {
      const px = x + 10 + i * (pipW + 4);
      const filled = i < cue.pipFilled;
      const next = i === cue.pipFilled && cue.state !== "paused";
      ctx.globalAlpha = filled || next ? 0.96 : 0.36;
      ctx.fillStyle = filled ? color : "rgba(148, 163, 184, 0.7)";
      ctx.strokeStyle = next ? "#fef08a" : "rgba(226, 232, 240, 0.38)";
      ctx.lineWidth = next ? 1.3 : 1;
      ctx.beginPath();
      ctx.roundRect(px, pipY, pipW, 4, 2);
      if (filled) ctx.fill();
      else ctx.stroke();
    }
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = color;
    ctx.font = "bold 7px 'Share Tech Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`x${cue.combo}->x${cue.nextCombo}`, x + w - 10, pipY + 2);
    ctx.restore();
    this.lastLabChainRunCue = cue;
    return cue;
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

    // Screen shake on damage (motion-safe): nudge the WORLD a few px for a few frames.
    // Restored before the screen-space overlays (vignette/HUD) so those stay stable.
    let _shaking = false;
    if (this.shakeFrames > 0) {
      this.shakeFrames--;
      if (!this.reducedMotion && this.shakeMag > 0) {
        const k = this.shakeMag * (this.shakeFrames / (this.shakeMax || 1));
        this.ctx.save();
        this.ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        _shaking = true;
      }
    }

    // 1. Draw Parallax Space Background
    this.drawSpaceBackground();

    // 1b. Draw Spacetime Warping Mesh
    this.drawSpacetimeMesh();

    // 2. Draw active platform level tilemap
    this.drawTilemap();

    // 3. Draw the next collectible mission sample beacon, then objects
    this.drawMissionSampleBeacon(this.ctx);
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

    // 4b. Draw drifting space debris ("wonder pieces")
    if (this.debris) for (const d of this.debris) d.draw(this.ctx, this.cameraX);

    // 4c. Draw falling meteors
    if (this.meteors) for (const m of this.meteors) m.draw(this.ctx, this.cameraX);

    // 4d. Draw player projectiles (works in normal play once armed)
    if (this.projectiles) for (const p of this.projectiles) p.draw(this.ctx, this.cameraX);

    // 4e. Draw mobs (survival + block-woken)
    if (this.mobs) for (const m of this.mobs) m.draw(this.ctx, this.cameraX);

    // 5. Draw Player Character — with foot-anchored squash & stretch for game-feel:
    // stretch tall when rising/falling fast, squash flat on a hard landing.
    {
      const p = this.player;
      let syS = 1, sxS = 1;
      if (!p.onGround) { const s = Math.max(-0.16, Math.min(0.22, -p.vy * 0.012)); syS = 1 + s; sxS = 1 - s * 0.7; }
      if (p.landSquash > 0) { const k = p.landSquash; syS = 1 - 0.28 * k; sxS = 1 + 0.30 * k; }
      const fx = p.x + p.w / 2 - this.cameraX, fy = p.y + p.h;
      this.ctx.save();
      this.ctx.translate(fx, fy); this.ctx.scale(sxS, syS); this.ctx.translate(-fx, -fy);
      p.draw(this.ctx, this.cameraX, this);
      this.ctx.restore();
    }

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
    this.drawFormulaCardEffects(this.ctx);

    // End screen shake before the screen-space overlays so they don't jitter.
    if (_shaking) { this.ctx.restore(); _shaking = false; }

    // 9c. Soft planet-tinted vignette over the world (cached; one drawImage),
    // under the screen-space balloon so UI text stays at full brightness.
    if (typeof RenderCache !== 'undefined') {
      const vig = RenderCache.vignette(this);
      if (vig) this.ctx.drawImage(vig, 0, 0);
    }

    // 9d. Hurt red-flash overlay (screen-space), fades over ~12 frames.
    if (this.hurtFlashTimer > 0) {
      this.ctx.save();
      this.ctx.fillStyle = `rgba(239, 68, 68, ${0.32 * (this.hurtFlashTimer / 12)})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // 9e. Heart health HUD + fuel gauge + weapon status (top-left).
    this.drawHealthHUD(this.ctx);
    this.drawFuelHUD(this.ctx);
    this.drawWeaponHUD(this.ctx);
    this.drawDrillHUD(this.ctx);
    this.drawLabChainRunCue(this.ctx);
    this.drawRunObjectiveCompass(this.ctx);

    // 9f. Meteor-shower "take shelter" warning banner (screen-space).
    this.drawMeteorBanner(this.ctx);

    // 9g. Future-lab prep cue: keep Dark Matter / Quantum teaser science visible in-run.
    this.drawFutureLabRunCue(this.ctx);

    // 10. Mission/objective speech balloon (screen-space, top-center)
    this.drawMissionBalloon(this.ctx);
  }

  drawHealthHUD(ctx) {
    if (!this.player || this.state !== 'playing') return;
    const max = this.player.maxHealth || 0;
    if (max <= 0) return;
    const hp = this.player.health || 0;
    const size = 20, gap = 7, padX = 12, padY = 8;
    const plateW = padX * 2 + max * size + (max - 1) * gap + 34;
    ctx.save();
    // Plate
    ctx.fillStyle = "rgba(11,16,34,0.55)";
    ctx.strokeStyle = "rgba(239,68,68,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(8, 8, plateW, size + padY * 2, 9); ctx.fill(); ctx.stroke();
    // "HP" label
    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 11px 'Outfit', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("HP", 8 + padX, 8 + padY + size / 2 + 1);
    // Drawn hearts (consistent across browsers — no emoji dependency)
    for (let i = 0; i < max; i++) {
      const cx = 8 + padX + 26 + i * (size + gap) + size / 2;
      const cy = 8 + padY + size / 2;
      this.drawHeart(ctx, cx, cy, size, i < hp);
    }
    ctx.restore();
  }

  drawHeart(ctx, x, y, size, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.beginPath();
    ctx.moveTo(0, 4.5);
    ctx.bezierCurveTo(-8, -3.5, -6.2, -11, 0, -6);
    ctx.bezierCurveTo(6.2, -11, 8, -3.5, 0, 4.5);
    ctx.closePath();
    ctx.fillStyle = filled ? "#ef4444" : "rgba(90,100,120,0.45)";
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#0b1224"; ctx.lineJoin = "round"; ctx.stroke();
    if (filled) { // tiny shine
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath(); ctx.ellipse(-2.4, -3, 1.5, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // The main fuel HUD shows the TOTAL TANK — the finite per-level reserve. The small live
  // gauge above the hopper shows the thruster (working pool) that this tank refills.
  drawFuelHUD(ctx) {
    if (!this.player || this.state !== 'playing') return;
    const mt = this.player.maxTank || 100;
    const t = Math.max(0, Math.min(mt, this.player.tank != null ? this.player.tank : mt));
    const x = 8, y = 52, w = 162, h = 16;
    ctx.save();
    ctx.fillStyle = "rgba(11,16,34,0.55)";
    ctx.strokeStyle = "rgba(56,189,248,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill(); ctx.stroke();
    const pct = t / mt;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#ef4444"); grad.addColorStop(0.5, "#f59e0b"); grad.addColorStop(1, "#22c55e");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x + 46, y + 3, Math.max(0, (w - 52) * pct), h - 6, 4); ctx.fill();
    ctx.fillStyle = "#bae6fd"; ctx.font = "bold 10px 'Outfit', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("TANK", x + 8, y + h / 2 + 0.5);
    // Infinite tank: badge the full bar with an ∞ so it's obvious the limit is off.
    if (this.infiniteFuel) {
      ctx.fillStyle = "#fff7ed"; ctx.font = "bold 12px 'Outfit', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("∞", x + w - 8, y + h / 2 + 0.5);
    }
    ctx.restore();
  }

  drawWeaponHUD(ctx) {
    if (!this.player || this.state !== 'playing') return;
    const armed = !!this.player.weapon || this.survivalMode;
    if (!armed) return;
    ctx.save();
    // Small blaster indicator below the fuel bar.
    ctx.fillStyle = "rgba(11,16,34,0.55)";
    ctx.beginPath(); ctx.roundRect(8, 74, 110, 16, 7); ctx.fill();
    ctx.fillStyle = "#facc15"; ctx.font = "bold 10px 'Outfit', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(`🔫 BLASTER L${this.weaponLevel || 1}`, 14, 74 + 8 + 0.5);
    // First-time "hold F to shoot" prompt, center-screen, fades out.
    if (this._shootHintTimer > 0) {
      ctx.globalAlpha = Math.min(1, this._shootHintTimer / 50);
      const label = "Hold  F  to shoot!";
      ctx.font = "bold 15px 'Outfit', sans-serif";
      const tw = ctx.measureText(label).width;
      const cx = this.canvas.width / 2;
      ctx.fillStyle = "rgba(11,16,34,0.75)";
      ctx.beginPath(); ctx.roundRect(cx - tw / 2 - 14, 84, tw + 28, 28, 9); ctx.fill();
      ctx.fillStyle = "#facc15"; ctx.textAlign = "center";
      ctx.fillText(label, cx, 98);
    }
    ctx.restore();
  }

  drawDrillHUD(ctx) {
    if (!this.player || this.state !== 'playing') return;
    const x = 8, y = 94, w = 162, h = 20;
    ctx.save();
    ctx.fillStyle = "rgba(11,16,34,0.55)";
    ctx.strokeStyle = "rgba(203,213,225,0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 10px 'Outfit', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`D DRILL   BLOCKS ${this.minedBlocks || 0}`, x + 10, y + h / 2 + 1);
    ctx.restore();
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
            let off = (this.reducedMotion ? 0 : this.cameraX * speed) % W;
            if (off < 0) off += W;
            this.ctx.drawImage(img, -off, 0);
            this.ctx.drawImage(img, W - off, 0);
          };
          wrap(layers.far, 0.06);
          wrap(layers.near, 0.16);
        }
        const tw = RenderCache.twinkles(W, H);
        const t = this.reducedMotion ? 0 : Date.now() / 700;
        for (const s of tw) {
          this.ctx.globalAlpha = this.reducedMotion ? 0.55 : 0.35 + Math.abs(Math.sin(t + s.ph)) * 0.6;
          this.ctx.fillStyle = '#f8fafc';
          this.ctx.beginPath();
          const sx = this.reducedMotion ? s.x : ((s.x - this.cameraX * 0.1) % W + W) % W;
          this.ctx.arc(sx, s.y, s.s, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.drawEarthDayNightOverlay();
        return;
      }
    }
    this.drawSpaceBackgroundDirect();
  }

  drawEarthDayNightOverlay() {
    if (this.currentPlanetIndex !== 0 || !this.canvas || !this.ctx) return;
    const phase = this.getEarthDayNightPhase();
    const W = this.canvas.width, H = this.canvas.height;
    const dayAlpha = Math.max(0, Math.min(1, phase.daylight));
    const nightAlpha = 1 - dayAlpha;
    const ctx = this.ctx;

    ctx.save();
    if (dayAlpha > 0.05) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `rgba(96, 165, 250, ${0.62 * dayAlpha})`);
      sky.addColorStop(0.58, `rgba(125, 211, 252, ${0.34 * dayAlpha})`);
      sky.addColorStop(1, `rgba(187, 247, 208, ${0.16 * dayAlpha})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      const sx = W * phase.sunX;
      const sy = H * phase.sunY;
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#fde68a';
      ctx.fillStyle = `rgba(254, 240, 138, ${0.85 * dayAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    if (nightAlpha > 0.08) {
      ctx.fillStyle = `rgba(2, 6, 23, ${0.5 * nightAlpha})`;
      ctx.fillRect(0, 0, W, H);
      const mx = W * (1 - phase.sunX);
      const my = H * (0.16 + Math.sin((phase.t + 0.5) * Math.PI) * 0.12);
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#cbd5e1';
      ctx.fillStyle = `rgba(226, 232, 240, ${0.75 * nightAlpha})`;
      ctx.beginPath();
      ctx.arc(mx, my, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(2, 6, 23, ${0.72 * nightAlpha})`;
      ctx.beginPath();
      ctx.arc(mx + 5, my - 3, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
    const t = this.reducedMotion ? 0 : Date.now() / 1000;

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
    this.drawEarthDayNightOverlay();

    this.ctx.save();
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillStyle = ["#86efac", "#67e8f9", "#fdba74", "#c4b5fd", "#f9a8d4"][this.currentPlanetIndex] || "#93c5fd";
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.canvas.width * 0.78 - ((this.reducedMotion ? 0 : this.cameraX) * 0.035 % 90),
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
    this.ctx.ellipse(this.canvas.width * 0.2 - ((this.reducedMotion ? 0 : this.cameraX) * 0.02 % 70), this.canvas.height * 0.26, 52, 18, 0.28, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Parallax stars
    for (const star of this.bgStars) {
      let sx = this.reducedMotion ? star.x : (star.x - this.cameraX * star.speed) % this.canvas.width;
      if (sx < 0) sx += this.canvas.width;

      const shimmer = this.reducedMotion ? 0.62 : 0.45 + Math.abs(Math.sin(Date.now() / 900 + star.x)) * 0.55;
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
  Game.syncInfiniteFuelButton();   // reflect the persisted infinite-tank toggle on its button
});
