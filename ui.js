// ui.js - Orchestrates HUD telemetry, energy bars, Space Terminal logs, Code Deck clicks, and Robot chat

// Logging utility to print user input
function ui_log_input(cmd) {
  const history = document.getElementById("console-history");
  if (!history) return;

  const line = document.createElement("div");
  line.className = "console-line input-echo";
  line.textContent = `cadet@star-hopper:~$ ${cmd}`;
  history.appendChild(line);
  scrollToBottom(history);
}

// Logging utility to print compile/eval results
function ui_log_output(msg, type = "info") {
  const history = document.getElementById("console-history");
  if (!history) return;

  const line = document.createElement("div");
  line.className = `console-line ${type}`;
  
  if (type === "success") {
    line.textContent = `${msg}`;
  } else if (type === "error") {
    line.textContent = `${msg}`;
  } else {
    line.textContent = `i: ${msg}`;
  }

  history.appendChild(line);
  scrollToBottom(history);
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

function updatePauseControls() {
  const game = window.Game || Game;
  const paused = !!(game && game.isPaused);
  const pauseButtons = [
    document.getElementById("pause-btn"),
    document.getElementById("canvas-pause-btn")
  ].filter(Boolean);
  const pauseOverlay = document.getElementById("pause-overlay");

  pauseButtons.forEach((pauseBtn) => {
    pauseBtn.textContent = paused ? "▶" : "⏸";
    pauseBtn.title = paused ? "Resume simulation" : "Pause simulation";
    pauseBtn.classList.toggle("paused", paused);
  });

  if (pauseOverlay) {
    pauseOverlay.classList.toggle("hidden", !paused);
  }
}

function toggleGamePause() {
  const game = window.Game || Game;
  if (!game || (game.state !== 'playing' && !window.navigatorModeActive)) return;

  game.isPaused = !game.isPaused;
  game.physicsAccumulator = 0;
  updatePauseControls();

  if (typeof SFX !== 'undefined' && typeof SFX.playType === 'function') {
    SFX.playType();
  }
}

function syncReadableTextButton(enabled) {
  const btn = document.getElementById("readable-text-btn");
  if (!btn) return;
  btn.classList.toggle("readable-on", !!enabled);
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.title = enabled ? "Readable text mode on" : "Readable text mode";
}

function applyReadableTextPreference(enabled) {
  const on = !!enabled;
  if (document.body && document.body.classList) {
    document.body.classList.toggle("readable-text-mode", on);
  }
  syncReadableTextButton(on);
  return on;
}

function setReadableTextPreference(enabled, persist = true) {
  const on = applyReadableTextPreference(enabled);
  if (persist && typeof localStorage !== "undefined") {
    localStorage.setItem("starHopper.readableText", on ? "1" : "0");
  }
  return on;
}

function toggleReadableTextMode() {
  const on = !(document.body && document.body.classList && document.body.classList.contains("readable-text-mode"));
  setReadableTextPreference(on, true);
  if (typeof SFX !== 'undefined' && typeof SFX.playType === 'function') SFX.playType();
  return on;
}

function initReadableTextPreference() {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("starHopper.readableText") : null;
  return setReadableTextPreference(saved === "1", false);
}

function isTradeScreenOpen() {
  const tradeScreen = document.getElementById("trade-screen");
  return !!(tradeScreen && !tradeScreen.classList.contains("hidden"));
}

function setCodingPause(active) {
  const game = window.Game || Game;
  if (!game || game.state !== 'playing') return;
  if (active) {
    if (!game._codingPauseActive) {
      game._wasPausedBeforeCoding = !!game.isPaused;
      game._codingPauseActive = true;
    }
    game.isPaused = true;
    game.physicsAccumulator = 0;
    updatePauseControls();
    return;
  }

  if (!game._codingPauseActive) return;
  const shouldRemainPaused = !!game._wasPausedBeforeCoding || isTradeScreenOpen();
  game._codingPauseActive = false;
  game._wasPausedBeforeCoding = false;
  if (!shouldRemainPaused) {
    game.isPaused = false;
    game.physicsAccumulator = 0;
  }
  updatePauseControls();
}

function setupResizablePanes() {
  const app = document.getElementById("app-container");
  const mainResizer = document.getElementById("main-pane-resizer");
  const deckResizer = document.getElementById("deck-pane-resizer");
  const root = document.documentElement;

  if (!app || app.dataset.resizersBound === "true") return;
  app.dataset.resizersBound = "true";

  const savedGameWidth = localStorage.getItem("starHopper.gamePaneWidth");
  const savedDeckHeight = localStorage.getItem("starHopper.codeDeckHeight");
  if (savedGameWidth) root.style.setProperty("--game-pane-width", savedGameWidth);
  if (savedDeckHeight) root.style.setProperty("--code-deck-height", savedDeckHeight);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  if (mainResizer) {
    mainResizer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      mainResizer.classList.add("dragging");
      document.body.classList.add("resizing-panes");
      document.body.style.cursor = "col-resize";

      const onMove = (moveEvent) => {
        const rect = app.getBoundingClientRect();
        const minGameWidth = 520;
        const minTerminalWidth = 320;
        const reserved = mainResizer.offsetWidth + 20;
        const maxGameWidth = Math.max(minGameWidth, rect.width - minTerminalWidth - reserved);
        const nextWidth = clamp(moveEvent.clientX - rect.left, minGameWidth, maxGameWidth);
        const cssValue = `${Math.round(nextWidth)}px`;

        root.style.setProperty("--game-pane-width", cssValue);
        localStorage.setItem("starHopper.gamePaneWidth", cssValue);
      };

      const onUp = () => {
        mainResizer.classList.remove("dragging");
        document.body.classList.remove("resizing-panes");
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  if (deckResizer) {
    deckResizer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      deckResizer.classList.add("dragging");
      document.body.classList.add("resizing-panes");
      document.body.style.cursor = "row-resize";

      const onMove = (moveEvent) => {
        const appRect = app.getBoundingClientRect();
        const nextHeight = clamp(appRect.bottom - moveEvent.clientY - 150, 90, 260);
        const cssValue = `${Math.round(nextHeight)}px`;

        root.style.setProperty("--code-deck-height", cssValue);
        localStorage.setItem("starHopper.codeDeckHeight", cssValue);
      };

      const onUp = () => {
        deckResizer.classList.remove("dragging");
        document.body.classList.remove("resizing-panes");
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
}

// Telemetry visual updates (runs every frame)
function updateHUD(game) {
  const player = game.player;
  const planet = game.currentPlanet;

  // 0. Engineering gauges — Agility AND Thrust are ALWAYS shown (consistent dashboard),
  //    with the current world's gate gauge highlighted.
  const hudRow = document.getElementById("hud-row");
  const gauges = (typeof game.getGauges === "function") ? game.getGauges() : [];
  if (hudRow && gauges.length) {
    hudRow.classList.add("has-mission-stat");
    let anyActivePassed = false;
    gauges.forEach((gz) => {
      const el = document.getElementById("gauge-" + gz.key);
      if (!el) return;
      const onHopper = !game.player || game.player.charType === "hopper";
      const passed = gz.value >= gz.target;
      // Only the current world's gate gauge shows the ✓ / green, so the off-duty
      // gauge (e.g. Thrust on Earth) reads as informational, not "already won".
      el.textContent = `${gz.label} ${Math.round(gz.value)}/${gz.target}${(passed && gz.active) ? " ✓" : ""}`;
      el.classList.toggle("gauge-passed", passed && onHopper && gz.active);
      el.classList.toggle("gauge-active", gz.active);
      if (gz.active && passed) anyActivePassed = true;
    });
    const card = document.getElementById("card-mission-stat");
    if (card) card.classList.toggle("stat-passed", anyActivePassed);
  }

  // 1. Gravity Gauge — show the gravity the rover actually FEELS (after antigravity)
  const gravityElement = document.getElementById("hud-gravity");
  if (gravityElement) {
    const isCustomG = Compiler.env.gravity !== null || (Compiler.env.antigravity || 0) !== 0;
    const currentG = (typeof game.getCurrentGravity === 'function')
      ? game.getCurrentGravity()
      : (Compiler.env.gravity !== null ? Compiler.env.gravity : planet.physics.gravity);

    // Scale visual gravity: standard Earth 0.6 matches 9.8 m/s2
    const realWorldG = (currentG / 0.6) * 9.8;
    gravityElement.textContent = `${realWorldG.toFixed(1)} m/s²`;
    
    if (isCustomG) {
      gravityElement.style.color = "var(--neon-purple)";
      const card = document.getElementById("card-gravity");
      if (card) card.style.borderColor = "rgba(167, 139, 250, 0.4)";
    } else {
      gravityElement.style.color = "var(--active-neon)";
      const card = document.getElementById("card-gravity");
      if (card) card.style.borderColor = "var(--panel-border)";
    }
  }

  // 2. Velocity Telemetries
  const speedElement = document.getElementById("hud-velocity");
  if (speedElement) {
    const vxVal = player.vx.toFixed(1);
    const vyVal = player.vy.toFixed(1);
    speedElement.textContent = `↔ ${vxVal}  ↕ ${vyVal}`;
  }

  // 3. Friction Index
  const frictionElement = document.getElementById("hud-friction");
  if (frictionElement) {
    const isCustomF = Compiler.env.friction !== null;
    let visualFriction = 0;
    if (isCustomF) {
      visualFriction = Compiler.env.friction;
    } else {
      visualFriction = (10 - ((planet.physics.friction - 0.7) / 0.299) * 10);
    }
    
    frictionElement.textContent = `${Math.max(0, Math.min(10, visualFriction)).toFixed(1)}`;
    if (isCustomF) {
      frictionElement.style.color = "var(--neon-purple)";
      const card = document.getElementById("card-friction");
      if (card) card.style.borderColor = "rgba(167, 139, 250, 0.4)";
    } else {
      frictionElement.style.color = "var(--active-neon)";
      const card = document.getElementById("card-friction");
      if (card) card.style.borderColor = "var(--panel-border)";
    }
  }

  // 4. Energy Chart calculations
  const mass = player.charType === 'star' ? 1.0 : 2.5;
  const velocitySq = (player.vx * player.vx) + (player.vy * player.vy);
  
  // Kinetic Energy = 0.5 * m * v^2
  let ke = 0.5 * mass * velocitySq;
  
  // Height: distance from floor level (floor is around row 12 = 384px)
  const floorY = 384;
  const heightVal = Math.max(0, floorY - (player.y + player.h));
  
  // Gravity constant (custom or default)
  const currentG = Compiler.env.gravity !== null ? Compiler.env.gravity : planet.physics.gravity;
  
  // Potential Energy = m * g * h
  let pe = mass * Math.abs(currentG) * heightVal * 0.05; // 0.05 scaling factor
  if (pe < 0) pe = 0;
  
  // Total Energy = KE + PE
  const te = ke + pe;

  const maxKE = 100;
  const maxPE = 150;
  const maxTE = 200;

  const kePercent = Math.min(100, (ke / maxKE) * 100);
  const pePercent = Math.min(100, (pe / maxPE) * 100);
  const tePercent = Math.min(100, (te / maxTE) * 100);

  const kBar = document.getElementById("bar-kinetic");
  const pBar = document.getElementById("bar-potential");
  const tBar = document.getElementById("bar-total");

  if (kBar) kBar.style.width = `${kePercent}%`;
  if (pBar) pBar.style.width = `${pePercent}%`;
  if (tBar) tBar.style.width = `${tePercent}%`;

  // Health (hearts) and Fuel (tank) are drawn on the canvas HUD now — see Game.drawHealthHUD
  // and Game.drawFuelHUD. They were removed from this DOM telemetry panel so it no longer
  // duplicates them or grows tall enough to cover the on-canvas hearts on narrow screens.

  const energySummary = document.getElementById("hud-energy-summary");
  if (energySummary) {
    energySummary.textContent = `K ${Math.round(ke)} | P ${Math.round(pe)}`;
  }

  const objectiveSummary = document.getElementById("hud-objectives");
  if (objectiveSummary && typeof game.getLevelObjectiveStatus === 'function') {
    const status = game.getLevelObjectiveStatus();
    objectiveSummary.textContent = `✓ ${status.missionsComplete}/${status.missionsTotal} | ◆ ${status.collectiblesCollected}/${status.collectiblesTotal}`;
    objectiveSummary.style.color = status.readyForPortal ? "var(--neon-green)" : "var(--neon-yellow)";
  }

  const gemBar = document.getElementById("hud-gem-bar");
  if (gemBar && typeof game.getLevelObjectiveStatus === 'function') {
    const status = game.getLevelObjectiveStatus();
    const gem = typeof game.getGemConfig === 'function' ? game.getGemConfig() : { color: "var(--neon-yellow)", glow: "rgba(250, 204, 21, 0.65)" };
    gemBar.innerHTML = "";
    for (let i = 0; i < status.collectiblesTotal; i++) {
      const slot = document.createElement("span");
      slot.className = `gem-slot ${i < status.collectiblesCollected ? "filled" : ""}`;
      slot.style.setProperty("--gem-color", gem.color);
      slot.style.setProperty("--gem-glow", gem.glow);
      slot.title = `${gem.name || "Mission gem"} ${i + 1}`;
      gemBar.appendChild(slot);
    }
  }

  const musicTrack = document.getElementById("hud-music-track");
  if (musicTrack) {
    const trackName = SFX.getTrackName ? SFX.getTrackName(SFX.currentBgm) : "No Music";
    const volume = SFX.getMasterVolumePercent ? SFX.getMasterVolumePercent() : 100;
    musicTrack.textContent = SFX.isMuted ? "Muted" : `${trackName} ${volume}%`;
  }
  syncMasterVolumeControl();

  // 5. Active Character Indicators
  const starCard = document.getElementById("char-card-star");
  const hopperCard = document.getElementById("char-card-hopper");
  
  if (starCard && hopperCard) {
    if (player.charType === 'star') {
      starCard.classList.add("active");
      hopperCard.classList.remove("active");
    } else {
      starCard.classList.remove("active");
      hopperCard.classList.add("active");
    }
  }
}

function syncMasterVolumeControl() {
  if (typeof document === 'undefined' || typeof SFX === 'undefined') return;
  const slider = document.getElementById("volume-slider");
  const value = document.getElementById("volume-value");
  const percent = SFX.getMasterVolumePercent ? SFX.getMasterVolumePercent() : 100;
  if (slider && String(slider.value) !== String(percent)) slider.value = String(percent);
  if (value) value.textContent = `${percent}%`;
}

// Update Mission Checklist UI
function updateMissionList(game) {
  updatePedagogicalGuide(game);
  updateParentMissionSummary(game);
  if (typeof updateLearningConceptProgress === 'function') {
    updateLearningConceptProgress(game);
  }
  updateDiscoveryPulse(game);
  updateFormulaTarget(game);

  const listContainer = document.getElementById("mission-list");
  if (!listContainer) return;

  const currentPlanet = game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) {
    listContainer.innerHTML = '<div class="no-missions">No active missions. Collect required gems, then reach the portal.</div>';
    return;
  }

  listContainer.innerHTML = "";
  currentPlanet.missions.forEach(mission => {
    const isCompleted = game.completedMissions.has(mission.id);
    
    const item = document.createElement("div");
    item.className = `mission-item ${isCompleted ? 'completed' : ''}`;
    
    const checkbox = document.createElement("span");
    checkbox.className = "mission-checkbox";
    checkbox.textContent = isCompleted ? "✓" : "○";
    
    const label = document.createElement("span");
    label.className = "mission-label";
    label.textContent = mission.prompt;
    
    item.appendChild(checkbox);
    item.appendChild(label);
    listContainer.appendChild(item);
  });

  if (typeof game.getLevelObjectiveStatus === 'function') {
    const status = game.getLevelObjectiveStatus();
    const collectibleItem = document.createElement("div");
    collectibleItem.className = `mission-item ${status.allCollectiblesCollected ? 'completed' : ''}`;

    const collectibleCheckbox = document.createElement("span");
    collectibleCheckbox.className = "mission-checkbox";
    collectibleCheckbox.textContent = status.allCollectiblesCollected ? "✓" : "○";

    const collectibleLabel = document.createElement("span");
    collectibleLabel.className = "mission-label";
    const gem = typeof game.getGemConfig === 'function' ? game.getGemConfig() : { name: "mission gems" };
    const lockedGemCount = typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : 0;
    const lockedCopy = lockedGemCount > 0 ? ` (${lockedGemCount} locked by code)` : "";
    collectibleLabel.textContent = `Collect ${gem.name} gems: ${status.collectiblesCollected}/${status.collectiblesTotal}${lockedCopy}`;

    collectibleItem.appendChild(collectibleCheckbox);
    collectibleItem.appendChild(collectibleLabel);
    listContainer.appendChild(collectibleItem);

    const portalItem = document.createElement("div");
    portalItem.className = `mission-item ${status.readyForPortal ? 'completed' : ''}`;

    const portalCheckbox = document.createElement("span");
    portalCheckbox.className = "mission-checkbox";
    portalCheckbox.textContent = status.readyForPortal ? "✓" : "○";

    const portalLabel = document.createElement("span");
    portalLabel.className = "mission-label";
    portalLabel.textContent = status.readyForPortal ? "Portal unlocked" : `Portal locked: ${game.formatObjectiveLockMessage(status)} remaining`;

    portalItem.appendChild(portalCheckbox);
    portalItem.appendChild(portalLabel);
    listContainer.appendChild(portalItem);
  }

  appendRunReplayContract(listContainer, game);
  appendLabStarContract(listContainer, game);
}

function appendRunReplayContract(listContainer, game) {
  if (!listContainer || !game || typeof game.getClearReplayContract !== 'function') return;
  const isReplayContext = game.remixContext === 'mastery' || game.remixContext === 'retry' || game.remixContext === 'daily';
  if (!isReplayContext) return;
  const isDailyRun = game.remixContext === 'daily';
  const isFrontierRun = isDailyRun && !!(game.dailyInfo && game.dailyInfo.isFrontier);
  const contractData = game.getClearReplayContract({
    labStars: typeof game.getClearLabStarSummary === 'function' ? game.getClearLabStarSummary({ isDailyRun, isFrontierRun }) : null,
    clearTime: null,
    isDailyRun,
    isFrontierRun,
    nextIndex: typeof game.getNextPlanetIndex === 'function' ? game.getNextPlanetIndex() : null
  });
  if (!contractData) return;

  const card = document.createElement("div");
  card.className = "run-replay-contract";

  const head = document.createElement("div");
  head.className = "run-replay-contract-head";

  const title = document.createElement("span");
  title.textContent = "RUN CONTRACT";

  const reward = document.createElement("strong");
  reward.textContent = contractData.reward || "Replay reward";

  head.appendChild(title);
  head.appendChild(reward);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "run-replay-contract-body";
  const bodyTitle = document.createElement("strong");
  bodyTitle.textContent = contractData.title || "Replay with one clear goal";
  const bodyCopy = document.createElement("p");
  bodyCopy.textContent = contractData.body || "Use the lab report to decide what to test next.";
  body.appendChild(bodyTitle);
  body.appendChild(bodyCopy);
  card.appendChild(body);

  listContainer.appendChild(card);
}

function appendLabStarContract(listContainer, game) {
  if (!listContainer || !game || typeof game.getClearLabStarSummary !== 'function') return;
  const summary = game.getClearLabStarSummary();
  if (!summary || !Array.isArray(summary.checks) || summary.checks.length === 0) return;

  const contract = document.createElement("div");
  contract.className = "lab-star-contract";

  const head = document.createElement("div");
  head.className = "lab-star-contract-head";

  const title = document.createElement("span");
  title.textContent = "LAB STARS";

  const score = document.createElement("strong");
  score.textContent = `${summary.stars}/${summary.maxStars}`;

  const meter = document.createElement("span");
  meter.className = "lab-star-contract-meter";
  for (let i = 0; i < summary.maxStars; i++) {
    const star = document.createElement("span");
    star.className = i < summary.stars ? "earned" : "";
    star.textContent = "★";
    meter.appendChild(star);
  }

  head.appendChild(title);
  head.appendChild(meter);
  head.appendChild(score);
  contract.appendChild(head);

  const goals = document.createElement("div");
  goals.className = "lab-star-goals";
  summary.checks.forEach(check => {
    const goal = document.createElement("span");
    goal.className = `lab-star-goal ${check.earned ? "earned" : ""}`;
    goal.textContent = `${check.earned ? "OK" : "NEXT"} ${check.label}`;
    goals.appendChild(goal);
  });
  contract.appendChild(goals);
  listContainer.appendChild(contract);
}

function getActivePlatformerMission(game) {
  const currentPlanet = game && game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) return null;
  return currentPlanet.missions.find(mission => !game.completedMissions.has(mission.id)) || currentPlanet.missions[0] || null;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getScaffoldValues(scaffoldRoot) {
  const values = {};
  if (!scaffoldRoot) return values;
  scaffoldRoot.querySelectorAll("[data-scaffold-slot]").forEach(input => {
    values[input.dataset.scaffoldSlot] = input.value;
  });
  return values;
}

function getScaffoldModeLabel(mode) {
  const labels = {
    "fill-values": "Fill the numbers",
    "pattern-fill": "Complete the pattern",
    "choose-tune": "Choose and tune",
    "debug-fix": "Debug the line",
    "assemble-events": "Assemble events"
  };
  return labels[mode] || "Try this code";
}

function getCoachPredictionOption(game, missionId) {
  const selectedId = game && game.coachPredictions ? game.coachPredictions[missionId] : null;
  const fullMission = PlatformerMissions.find(mission => mission.id === missionId);
  if (!fullMission || !fullMission.prediction || !selectedId) return null;
  return fullMission.prediction.options.find(option => option.id === selectedId) || null;
}

const RESEARCH_RANKS = [
  {
    level: 1,
    title: "Lab Rookie",
    min: 0,
    perk: {
      label: "Prediction Gate",
      description: "Guess before code so every mission starts like a real experiment."
    }
  },
  {
    level: 2,
    title: "Variable Scout",
    min: 20,
    perk: {
      label: "Hypothesis Bonus",
      description: "Correct mission predictions can pay one-time Research XP."
    }
  },
  {
    level: 3,
    title: "Physics Tinkerer",
    min: 55,
    perk: {
      label: "Formula Deck",
      description: "Collected formulas become a visible science card set."
    }
  },
  {
    level: 4,
    title: "Loop Engineer",
    min: 100,
    perk: {
      label: "Combo Amplifier",
      description: "New checklist progress keeps a discovery combo moving."
    }
  },
  {
    level: 5,
    title: "Orbit Scientist",
    min: 170,
    perk: {
      label: "Daily Signal Lab",
      description: "Daily remixes turn practice into a fresh signal chase."
    }
  },
  {
    level: 6,
    title: "Star Mentor",
    min: 260,
    perk: {
      label: "Mastery Mentor",
      description: "A complete lab record points toward mastery clears."
    }
  }
];

function getResearchRank(xp = 0) {
  const score = Math.max(0, Number(xp) || 0);
  let current = RESEARCH_RANKS[0];
  for (const rank of RESEARCH_RANKS) {
    if (score >= rank.min) current = rank;
  }
  const next = RESEARCH_RANKS.find(rank => rank.min > score) || null;
  const span = next ? Math.max(1, next.min - current.min) : 1;
  const progress = next ? Math.max(0, Math.min(1, (score - current.min) / span)) : 1;
  return {
    ...current,
    xp: score,
    nextTitle: next ? next.title : "Max Rank",
    nextMin: next ? next.min : current.min,
    nextPerk: next ? next.perk : null,
    remaining: next ? Math.max(0, next.min - score) : 0,
    progress
  };
}

const SIGNAL_STORY_CHAPTERS = [
  {
    id: "earth-signal",
    title: "Emerald Wall Signal",
    concept: "Variables change motion",
    unlock: (game) => hasClearedStoryPlanet(game, 0),
    body: "The first shard proves that changing mass, thrust, and gravity can turn a blocked path into a solvable experiment."
  },
  {
    id: "moon-loop",
    title: "Moon Loop Echo",
    concept: "Loops build repeatable patterns",
    unlock: (game) => hasClearedStoryPlanet(game, 1),
    body: "The signal repeats across the canyon. A loop lets one idea become a bridge without rewriting the same command."
  },
  {
    id: "jupiter-thrust",
    title: "Amber Gravity Well",
    concept: "Thrust must beat gravity",
    unlock: (game) => hasClearedStoryPlanet(game, 2),
    body: "Jupiter's shard teaches that rockets, mass, and fuel form one system: every climb has a cost."
  },
  {
    id: "glacies-grip",
    title: "Violet Grip Code",
    concept: "Friction changes control",
    unlock: (game) => hasClearedStoryPlanet(game, 3),
    body: "The frozen signal shows how one surface variable can change the whole feel of movement."
  },
  {
    id: "magnet-field",
    title: "Mag-Net Pulse",
    concept: "Events react to contact",
    unlock: (game) => hasClearedStoryPlanet(game, 4),
    body: "The magnetic shard turns code into a field rule: touch, compare, flip, and watch the force change."
  },
  {
    id: "forge-collision",
    title: "Forge Collision Map",
    concept: "Mass comes before bounce",
    unlock: (game) => hasClearedStoryPlanet(game, 5),
    body: "The Forge shard makes the lesson explicit: first make the boulder move, then tune how much energy the collision keeps."
  },
  {
    id: "star-map-finale",
    title: "Star-Map Restored",
    concept: "Six ideas form one model",
    unlock: (game) => hasClearedFullStarMap(game),
    body: (game) => {
      const name = game && typeof game.getCadetStoryName === 'function' ? game.getCadetStoryName() : "the cadet";
      return `Vector records ${name} as the scientist who connected all six shards: variables, loops, force, friction, events, and collisions.`;
    }
  },
  {
    id: "mastery-remix",
    title: "Remix Key",
    concept: "Evidence survives a new layout",
    unlock: (game) => !!(game && game.masteryCleared && Object.values(game.masteryCleared).some(Boolean)),
    body: "A 3-star mastery means the idea was not luck. The same concept works again when the world changes shape."
  },
  {
    id: "daily-beacon",
    title: "Daily Beacon",
    concept: "One fresh experiment per day",
    unlock: (game) => !!(game && (game.dailySignalClears || 0) > 0),
    body: "The signal keeps broadcasting new remixes. Returning to test one variable each day builds a real lab habit."
  },
  {
    id: "village-pact",
    title: "Village Pact",
    concept: "Game AI uses states",
    unlock: (game) => hasVillageRescueStoryCredit(game),
    body: "The villagers now trust the cadet because danger became a readable state: patrol, shelter, then return to trade when the threat clears."
  }
];

function hasClearedStoryPlanet(game, index) {
  if (!game || !game.planetClears) return false;
  return Number(game.planetClears[index] || game.planetClears[String(index)] || 0) > 0;
}

function hasClearedFullStarMap(game) {
  if (!game || !game.planetClears) return false;
  const count = (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) ? PLANETS.length : 6;
  for (let i = 0; i < count; i++) {
    if (!hasClearedStoryPlanet(game, i)) return false;
  }
  return true;
}

function hasVillageRescueStoryCredit(game) {
  if (!game || !game.masteryMeters) return false;
  return Object.values(game.masteryMeters).some(meter =>
    !!(meter && meter.sources && Object.keys(meter.sources).some(source => String(source).indexOf("village-rescue:") === 0))
  );
}

function getSignalChapterBody(chapter, game) {
  if (!chapter) return "";
  return typeof chapter.body === 'function' ? chapter.body(game) : chapter.body;
}

function getSignalStoryProgress(game = window.Game) {
  const chapters = SIGNAL_STORY_CHAPTERS.map((chapter, index) => {
    const unlocked = !!chapter.unlock(game);
    return {
      ...chapter,
      index: index + 1,
      unlocked,
      bodyText: getSignalChapterBody(chapter, game)
    };
  });
  const unlocked = chapters.filter(chapter => chapter.unlocked);
  return {
    chapters,
    unlocked,
    total: chapters.length,
    nextChapter: chapters.find(chapter => !chapter.unlocked) || null
  };
}

function updateSignalStoryPanel(game = window.Game) {
  const panel = document.getElementById("signal-story-panel");
  if (!panel) return;
  const story = getSignalStoryProgress(game);
  const next = story.nextChapter;
  panel.innerHTML = `
    <div class="signal-story-head">
      <div>
        <span>STAR-MAP CHAPTERS</span>
        <strong>${story.unlocked.length}/${story.total} decoded</strong>
      </div>
      <em>${next ? `Next: ${escapeHTML(next.title)}` : "Signal complete"}</em>
    </div>
    <div class="signal-story-track">
      ${story.chapters.map(chapter => `
      <div class="signal-chapter ${chapter.unlocked ? "unlocked" : "locked"}">
        <span class="signal-chapter-index">${chapter.unlocked ? String(chapter.index).padStart(2, "0") : "--"}</span>
        <div>
          <strong>${escapeHTML(chapter.unlocked ? chapter.title : "Locked transmission")}</strong>
          <code>${escapeHTML(chapter.concept)}</code>
          <p>${escapeHTML(chapter.unlocked ? chapter.bodyText : `Decode ${chapter.title} by pushing the mission path farther.`)}</p>
        </div>
      </div>
      `).join("")}
    </div>
  `;
}

function updateResearchProgress(game = window.Game) {
  const rankCard = document.getElementById("research-rank-card");
  const deck = document.getElementById("discovery-deck");
  const storyPanel = document.getElementById("signal-story-panel");
  const startRadar = document.getElementById("start-mission-radar");
  if (!rankCard && !deck && !storyPanel && !startRadar) return;
  const xp = game && Number.isFinite(game.researchXP) ? game.researchXP : 0;
  const rank = getResearchRank(xp);

  if (startRadar) updateStartMissionRadar(game);

  if (rankCard) {
    const pct = Math.round(rank.progress * 100);
    const labQuest = getActiveLabQuest(game);
    rankCard.innerHTML = `
      <div class="research-rank-top">
        <div>
          <span class="research-rank-kicker">Rank ${rank.level}</span>
          <strong>${escapeHTML(rank.title)}</strong>
        </div>
        <span class="research-rank-xp">${Math.round(rank.xp)} XP</span>
      </div>
      <div class="research-rank-bar" aria-label="Research rank progress">
        <span style="width: ${pct}%"></span>
      </div>
      ${labQuest ? `
      <div class="lab-quest-card">
        <span>${escapeHTML(labQuest.kicker)}</span>
        <strong>${escapeHTML(labQuest.title)}</strong>
        <p>${escapeHTML(labQuest.body)}</p>
        <em>${escapeHTML(labQuest.reward)}</em>
      </div>` : ""}
      <div class="research-rank-perks">
        <div class="research-perk current">
          <span>Lab Perk</span>
          <strong>${escapeHTML(rank.perk.label)}</strong>
          <p>${escapeHTML(rank.perk.description)}</p>
        </div>
        ${rank.nextPerk ? `
        <div class="research-perk next">
          <span>Next Perk</span>
          <strong>${escapeHTML(rank.nextPerk.label)}</strong>
          <p>${escapeHTML(rank.nextPerk.description)}</p>
        </div>` : ""}
      </div>
      <div class="research-rank-next">${rank.remaining > 0 ? `${Math.round(rank.remaining)} XP to ${escapeHTML(rank.nextTitle)}` : "Max rank reached"}</div>
    `;
  }

  if (deck) {
    const collection = getFormulaCollection(game);
    if (!collection.unlocked.length) {
      deck.innerHTML = `<div class="discovery-deck-empty">Run Mission Coach code to collect formula cards here.</div>`;
    } else {
      deck.innerHTML = `
        <div class="formula-collection-head">
          <strong>Formula Cards ${collection.unlocked.length}/${collection.cards.length}</strong>
          <span>${collection.nextLocked ? `Next: ${escapeHTML(collection.nextLocked.title)}` : "Deck complete"}</span>
        </div>
        ${collection.cards.map(card => `
        <div class="discovery-card formula-card ${card.unlocked ? "unlocked" : "locked"}">
          <div class="discovery-card-head">
            <strong>${escapeHTML(card.title)}</strong>
            <span>${card.unlocked ? "collected" : "locked"}</span>
          </div>
          <code>${escapeHTML(card.unlocked ? card.formula : "???")}</code>
          <p>${escapeHTML(card.unlocked ? card.insight : card.cue)}</p>
        </div>
        `).join("")}
      `;
    }
  }

  if (storyPanel) updateSignalStoryPanel(game);
}

const DISCOVERY_RULES = [
  {
    kind: "mass",
    pattern: /\bhopper\.mass\s*=/i,
    title: "Mass Lab",
    formula: "a = F / m",
    insight: "Lower mass makes the same engine and jump force create more acceleration.",
    cue: "Watch speed and jump height change when mass changes."
  },
  {
    kind: "engine",
    pattern: /\bhopper\.engine\s*=/i,
    title: "Engine Lab",
    formula: "speed = engine / mass",
    insight: "More engine force raises top speed, especially when Hopper is light.",
    cue: "Use the Agility gauge to see the new speed."
  },
  {
    kind: "jump",
    pattern: /\b(?:hopper\.)?jump_power\s*=/i,
    title: "Jump Lab",
    formula: "jump = force / mass",
    insight: "Jump force lifts better when the rover has less mass to accelerate.",
    cue: "Try the same jump with two different masses."
  },
  {
    kind: "antigravity",
    pattern: /\bantigravity\s*=/i,
    title: "Gravity Lab",
    formula: "felt g = planet g - antigravity",
    insight: "Antigravity lowers the pull you feel, stretching hang time and jump arcs.",
    cue: "A smaller felt g makes the same jump stay airborne longer."
  },
  {
    kind: "rocket",
    pattern: /\bhopper\.rocket_power\s*=/i,
    title: "Rocket Lab",
    formula: "thrust = rocket x 2.5 / mass",
    insight: "Rocket power fights gravity, but heavy builds spend more fuel to climb.",
    cue: "Watch Thrust and the fuel tank together."
  },
  {
    kind: "loop",
    pattern: /\brepeat\s+(?:\d+|\{[^}]+\})/i,
    title: "Loop Lab",
    formula: "repeat n = command x n",
    insight: "A loop turns one instruction into a pattern, saving lines and building faster.",
    cue: "Count the spawned tools after the loop runs."
  },
  {
    kind: "friction",
    pattern: /\bfriction\s*=/i,
    title: "Friction Lab",
    formula: "friction opposes sliding",
    insight: "Higher friction turns sliding motion into grip, helping the rover stop.",
    cue: "Compare how far the rover skids before and after the change."
  },
  {
    kind: "elasticity",
    pattern: /\belasticity\s*=/i,
    title: "Collision Lab",
    formula: "bounce kept = elasticity x speed",
    insight: "Elasticity decides how much speed survives a collision or springy bounce.",
    cue: "Mass gives the shove; elasticity preserves the rebound."
  },
  {
    kind: "magnet",
    pattern: /\bhopper\.pole\s*=/i,
    title: "Magnet Lab",
    formula: "opposite poles attract",
    insight: "Changing pole flips whether the field pulls or pushes Hopper.",
    cue: "The same magnet becomes a lift or a barrier after the pole changes."
  }
];

function getPulseFormulaKind(pulse) {
  if (!pulse) return null;
  if (pulse.kind && pulse.kind !== "mission") return pulse.kind;
  const title = String(pulse.title || "").toLowerCase();
  const formula = String(pulse.formula || "").toLowerCase();
  const match = DISCOVERY_RULES.find(rule =>
    title === rule.title.toLowerCase() ||
    formula === rule.formula.toLowerCase()
  );
  return match ? match.kind : null;
}

function getDiscoveredFormulaSet(game) {
  const set = new Set();
  if (game && game.discoveredFormulaKinds) {
    const values = game.discoveredFormulaKinds instanceof Set
      ? Array.from(game.discoveredFormulaKinds)
      : (Array.isArray(game.discoveredFormulaKinds) ? game.discoveredFormulaKinds : []);
    values.forEach(kind => {
      if (DISCOVERY_RULES.some(rule => rule.kind === kind)) set.add(kind);
    });
  }
  if (game && Array.isArray(game.discoveryLog)) {
    game.discoveryLog.forEach(pulse => {
      const kind = getPulseFormulaKind(pulse);
      if (kind) set.add(kind);
    });
  }
  return set;
}

function getFormulaCollection(game) {
  const discovered = getDiscoveredFormulaSet(game);
  const cards = DISCOVERY_RULES.map(rule => ({
    ...rule,
    unlocked: discovered.has(rule.kind)
  }));
  return {
    cards,
    unlocked: cards.filter(card => card.unlocked),
    locked: cards.filter(card => !card.unlocked),
    nextLocked: cards.find(card => !card.unlocked) || null
  };
}

function patternIndexInText(rule, text) {
  if (!rule || !text) return -1;
  const m = String(text).match(rule.pattern);
  return m && Number.isFinite(m.index) ? m.index : -1;
}

function getActiveFormulaTarget(game, activeMission = null) {
  const collection = getFormulaCollection(game);
  if (!collection.locked.length) return null;
  const mission = activeMission || (typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null);
  const scaffold = mission && mission.fullMission && mission.fullMission.scaffold ? mission.fullMission.scaffold : null;
  const template = scaffold && scaffold.template ? scaffold.template : "";
  const missionCards = collection.locked
    .map(card => ({ card, index: patternIndexInText(card, template) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  return missionCards.length ? missionCards[0].card : collection.nextLocked;
}

function getActiveLabQuest(game) {
  const mission = typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null;
  const fullMission = mission && mission.fullMission ? mission.fullMission : null;
  const selectedPrediction = mission && game && game.coachPredictions ? game.coachPredictions[mission.id] : null;
  if (fullMission && fullMission.prediction && !selectedPrediction) {
    return {
      kicker: "NEXT LAB QUEST",
      title: "Make a prediction",
      body: fullMission.prediction.question,
      reward: "Reward: Mission Coach unlock + hypothesis XP"
    };
  }

  if (game && game.currentPlanet && Array.isArray(game.currentPlanet.npcs) &&
      (game.survivalMode || (Array.isArray(game.mobs) && game.mobs.length > 0)) &&
      !(typeof game.hasVillageRescueCredit === 'function' && game.hasVillageRescueCredit(game.currentPlanetIndex))) {
    return {
      kicker: "NEXT LAB QUEST",
      title: "Keep a village safe",
      body: "When mobs make villagers shelter, clear the threat so they return to trade. Watch the AI state change.",
      reward: "Reward: Village Rescue XP + world mastery"
    };
  }

  const target = getActiveFormulaTarget(game, mission);
  if (target) {
    return {
      kicker: "NEXT LAB QUEST",
      title: `Collect ${target.title}`,
      body: target.cue,
      reward: "Reward: formula card + Research XP"
    };
  }

  const rank = getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0);
  if (rank.nextPerk) {
    return {
      kicker: "NEXT LAB QUEST",
      title: `Reach ${rank.nextTitle}`,
      body: `${Math.round(rank.remaining)} Research XP until ${rank.nextPerk.label}.`,
      reward: `Reward: Lab Perk - ${rank.nextPerk.label}`
    };
  }

  const daily = game && typeof game.getDailySignal === 'function' ? game.getDailySignal() : null;
  if (daily) {
    return {
      kicker: "NEXT LAB QUEST",
      title: "Clear today's signal",
      body: `${daily.label || "A fresh remix"} is ready for another experiment run.`,
      reward: "Reward: daily clear + share code"
    };
  }

  return {
    kicker: "NEXT LAB QUEST",
    title: "Master a remix",
    body: "Replay a cleared world, compare the new layout, and beat it with cleaner code.",
    reward: "Reward: mastery clear + stronger lab record"
  };
}

function updateStartMissionRadar(game = window.Game) {
  const panel = document.getElementById("start-mission-radar");
  if (!panel) return;
  const quest = getActiveLabQuest(game);
  const collection = getFormulaCollection(game);
  const rank = getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0);
  const action = getStartMissionRadarAction(game, quest);
  const kicker = panel.querySelector ? panel.querySelector(".start-mission-radar-head span") : null;
  const progress = document.getElementById("start-mission-radar-progress");
  const title = document.getElementById("start-mission-radar-title");
  const body = document.getElementById("start-mission-radar-body");
  const reward = document.getElementById("start-mission-radar-reward");
  const button = document.getElementById("start-mission-radar-btn");

  if (kicker) kicker.textContent = quest ? quest.kicker.replace(/^NEXT\s+/i, "") : "MISSION RADAR";
  if (progress) progress.textContent = `${collection.unlocked.length}/${collection.cards.length} formulas · ${Math.round(rank.xp)} XP`;
  if (title) title.textContent = quest ? quest.title : "Keep experimenting";
  if (body) body.textContent = quest ? quest.body : "Run Mission Coach code, collect formula cards, and improve your lab record.";
  if (reward) reward.textContent = quest ? quest.reward : "Reward: stronger science record";
  if (button) {
    button.textContent = action.label;
    button.title = action.title;
    button.dataset.action = action.action;
    button.dataset.level = String(action.levelIndex);
  }
}

function getStartMissionRadarAction(game = window.Game, quest = null) {
  const q = quest || getActiveLabQuest(game);
  const currentLevel = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  if (q && /^Clear today's signal$/i.test(q.title)) {
    return {
      action: "daily",
      label: "ACCEPT SIGNAL",
      title: "Start today's date-seeded remix.",
      levelIndex: currentLevel
    };
  }
  if (q && /^Reach\s+/i.test(q.title)) {
    return {
      action: "log",
      label: "OPEN LOG",
      title: "Open the Log to inspect rank progress and formula cards.",
      levelIndex: currentLevel
    };
  }
  return {
    action: "quest",
    label: q && /^Master a remix$/i.test(q.title) ? "START REMIX" : "START QUEST",
    title: "Launch the current world for this lab quest.",
    levelIndex: currentLevel
  };
}

function runStartMissionRadarAction() {
  const game = window.Game || (typeof Game !== 'undefined' ? Game : null);
  const button = document.getElementById("start-mission-radar-btn");
  const action = button && button.dataset ? button.dataset.action : "quest";
  if (action === "daily" && game && typeof game.startDailySignal === 'function') {
    game.startDailySignal();
    return true;
  }
  if (action === "log") {
    if (typeof switchMainMode === 'function') switchMainMode('notebook');
    return true;
  }
  if (game && typeof game.startLevel === 'function') {
    const level = button && button.dataset ? Number(button.dataset.level) : NaN;
    game.startLevel(Number.isFinite(level) ? level : (Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0));
    return true;
  }
  return false;
}

function updateFormulaTarget(game) {
  const panel = document.getElementById("formula-target");
  if (!panel) return;
  const collection = getFormulaCollection(game);
  const target = getActiveFormulaTarget(game);
  if (!target) {
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="formula-target-head">
        <span>FORMULA DECK</span>
        <strong>Complete</strong>
      </div>
      <div class="formula-target-body">All formula cards collected. Keep experimenting for better ranks and mastery clears.</div>
    `;
    return;
  }
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="formula-target-head">
      <span>NEXT FORMULA CARD</span>
      <strong>${collection.unlocked.length}/${collection.cards.length}</strong>
    </div>
    <div class="formula-target-title">${escapeHTML(target.title)}</div>
    <div class="formula-target-body">${escapeHTML(target.cue)}</div>
  `;
}

function unlockFormulaKind(game, kind) {
  if (!game || !DISCOVERY_RULES.some(rule => rule.kind === kind)) return false;
  const discovered = getDiscoveredFormulaSet(game);
  if (discovered.has(kind)) {
    game.discoveredFormulaKinds = discovered;
    return false;
  }
  discovered.add(kind);
  game.discoveredFormulaKinds = discovered;
  return true;
}

function countPassedResultChecks(resultState) {
  if (!resultState || !Array.isArray(resultState.items)) return 0;
  return resultState.items.filter(item => item && item.passed).length;
}

function getConfirmedHypothesisSet(game) {
  const set = new Set();
  if (!game || !game.confirmedHypotheses) return set;
  const values = game.confirmedHypotheses instanceof Set
    ? Array.from(game.confirmedHypotheses)
    : (Array.isArray(game.confirmedHypotheses) ? game.confirmedHypotheses : []);
  values.forEach(id => {
    if (id) set.add(id);
  });
  return set;
}

function confirmHypothesisForPulse(game, activeMission, earned) {
  if (!game || !activeMission || !earned) return null;
  const missionId = activeMission.id;
  const option = getCoachPredictionOption(game, missionId);
  if (!option || !option.correct) return null;
  const confirmed = getConfirmedHypothesisSet(game);
  if (confirmed.has(missionId)) {
    game.confirmedHypotheses = confirmed;
    return null;
  }
  confirmed.add(missionId);
  game.confirmedHypotheses = confirmed;
  return {
    xp: 6,
    label: "Hypothesis confirmed"
  };
}

function inferDiscoveryPulse(game, activeMission, code, resultState, openedGems = 0) {
  const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
  const rule = DISCOVERY_RULES.find(item => item.pattern.test(String(code || ""))) || null;
  const passed = countPassedResultChecks(resultState);
  const total = resultState && Array.isArray(resultState.items) ? resultState.items.length : 0;
  const fallbackConcept = fullMission && (fullMission.beginnerConcept || fullMission.concept || fullMission.codingConcept);
  const missionTitle = fullMission ? fullMission.title : "Mission";

  return {
    kind: rule ? rule.kind : "mission",
    title: rule ? rule.title : "Mission Lab",
    formula: rule ? rule.formula : (fullMission && fullMission.codingConcept ? fullMission.codingConcept : "predict -> code -> test"),
    insight: rule ? rule.insight : (fallbackConcept || "Run code, measure the result, then improve one idea at a time."),
    cue: rule ? rule.cue : "Use the checklist to decide what to test next.",
    missionId: activeMission ? activeMission.id : null,
    missionTitle,
    passed,
    total,
    openedGems: Math.max(0, openedGems || 0),
    rewardXP: 0,
    combo: game && game.discoveryCombo ? game.discoveryCombo : 0
  };
}

function getDiscoveryComboBonus(game, comboCount, rank = null) {
  const combo = Math.max(0, Math.floor(Number(comboCount) || 0));
  const researchRank = rank || (typeof getResearchRank === 'function'
    ? getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0)
    : null);
  const base = Math.min(8, combo);
  const amplifierUnlocked = !!(researchRank && researchRank.level >= 4);
  const amplifier = amplifierUnlocked && combo > 1 ? Math.min(12, (combo - 1) * 2) : 0;
  return {
    base,
    amplifier,
    total: base + amplifier,
    amplifierUnlocked
  };
}

function recordDiscoveryPulse(game, activeMission, code, resultState, openedGems = 0) {
  if (!game) return null;
  const pulse = inferDiscoveryPulse(game, activeMission, code, resultState, openedGems);
  const missionId = pulse.missionId || "_freeplay";
  const total = pulse.total || 0;
  const passed = pulse.passed || 0;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  const previousPassed = game.discoveryPassCounts[missionId] || 0;
  const newPasses = Math.max(0, passed - previousPassed);
  const finalPassBonus = total > 0 && passed >= total && previousPassed < total;
  const opened = Math.max(0, openedGems || 0);
  const earned = newPasses > 0 || opened > 0;

  if (earned) {
    const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
    const cardUnlocked = unlockFormulaKind(game, pulse.kind);
    const hypothesis = confirmHypothesisForPulse(game, activeMission, earned);
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    pulse.cardUnlocked = cardUnlocked;
    pulse.hypothesisConfirmed = !!hypothesis;
    pulse.hypothesisBonusXP = hypothesis ? hypothesis.xp : 0;
    const comboBonus = getDiscoveryComboBonus(game, game.discoveryCombo, beforeRank);
    pulse.comboBonusXP = comboBonus.base;
    pulse.comboAmplifierBonusXP = comboBonus.amplifier;
    pulse.comboAmplifierUnlocked = comboBonus.amplifierUnlocked;
    pulse.rewardXP = 5 + newPasses * 4 + opened * 3 + (finalPassBonus ? 6 : 0) + (cardUnlocked ? 5 : 0) + comboBonus.total + pulse.hypothesisBonusXP;
    if (cardUnlocked && typeof game.spawnFormulaCardEffect === 'function') {
      game.spawnFormulaCardEffect(pulse);
    }
    if (typeof game.awardWorldMasteryXP === 'function') {
      game.awardWorldMasteryXP(6 + newPasses * 3 + opened * 2 + (cardUnlocked ? 6 : 0), "science proof", {
        sourceKey: `concept:${missionId}:${pulse.kind}:${passed}:${opened}:${cardUnlocked ? "card" : "progress"}`,
        silent: true
      });
    }
    game.researchXP = Math.max(0, (game.researchXP || 0) + pulse.rewardXP);
    const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
    if (beforeRank && afterRank && afterRank.level > beforeRank.level) {
      pulse.rankUp = true;
      pulse.rankTitle = afterRank.title;
      pulse.rankPerk = afterRank.perk;
      if (typeof showBadgeToast === 'function') {
        showBadgeToast({
          icon: "🔬",
          label: `Research Rank: ${afterRank.title}`,
          description: `Lab Perk: ${afterRank.perk.label} (${Math.round(game.researchXP || 0)} XP)`
        });
      }
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(`Research +${pulse.rewardXP} XP: ${pulse.formula}`, "success");
      if (pulse.hypothesisConfirmed) {
        ui_log_output(`Hypothesis confirmed +${pulse.hypothesisBonusXP} XP.`, "success");
      }
      if (pulse.comboAmplifierBonusXP > 0) {
        ui_log_output(`Combo Amplifier +${pulse.comboAmplifierBonusXP} XP for chaining new lab progress.`, "success");
      }
      if (pulse.rankPerk) {
        ui_log_output(`Lab Perk unlocked: ${pulse.rankPerk.label}.`, "success");
      }
    }
    if (typeof logMissionBriefing === 'function') {
      logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
    }
  } else {
    pulse.combo = game.discoveryCombo || 0;
  }

  game.discoveryPassCounts[missionId] = Math.max(previousPassed, passed);
  game.discoveryPulse = pulse;
  game.discoveryLog = [pulse].concat(Array.isArray(game.discoveryLog) ? game.discoveryLog : []).slice(0, 8);
  updateDiscoveryPulse(game);
  updateFormulaTarget(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  const isLiveGame = typeof window !== 'undefined' && window.Game === game;
  if (earned && isLiveGame && typeof saveLocalProgress === 'function') saveLocalProgress();
  return pulse;
}

function updateDiscoveryPulse(game) {
  const panel = document.getElementById("discovery-pulse");
  if (!panel) return;
  const pulse = game && game.discoveryPulse ? game.discoveryPulse : null;
  if (!pulse) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  const progress = pulse.progressLabel || (pulse.total > 0 ? `${pulse.passed}/${pulse.total} checks` : "free test");
  const reward = pulse.rankUp ? `Rank Up: ${pulse.rankTitle}` : (pulse.rewardXP > 0 ? `+${pulse.rewardXP} Research XP` : "insight logged");
  const combo = pulse.combo > 1 ? ` x${pulse.combo} combo` : "";
  const hasComboReward = (pulse.comboBonusXP || 0) > 0 || (pulse.comboAmplifierBonusXP || 0) > 0;
  const comboChip = hasComboReward && pulse.combo > 1
    ? `<div class="discovery-hypothesis discovery-combo">COMBO CHAIN x${escapeHTML(String(pulse.combo))}${pulse.comboBonusXP ? ` +${escapeHTML(String(pulse.comboBonusXP))} XP` : ""}</div>`
    : "";
  const comboAmplifier = pulse.comboAmplifierBonusXP > 0
    ? `<div class="discovery-hypothesis discovery-combo-boost">COMBO AMPLIFIER +${escapeHTML(String(pulse.comboAmplifierBonusXP))} XP</div>`
    : "";
  const hypothesis = pulse.hypothesisConfirmed
    ? `<div class="discovery-hypothesis">HYPOTHESIS CONFIRMED +${escapeHTML(String(pulse.hypothesisBonusXP || 0))} XP</div>`
    : "";
  const rankPerk = pulse.rankPerk
    ? `<div class="discovery-hypothesis discovery-perk">LAB PERK UNLOCKED: ${escapeHTML(pulse.rankPerk.label)}</div>`
    : "";
  panel.innerHTML = `
    <div class="discovery-pulse-head">
      <span>DISCOVERY PULSE</span>
      <strong>${escapeHTML(reward)}${escapeHTML(combo)}</strong>
    </div>
    <div class="discovery-pulse-formula">${escapeHTML(pulse.formula)}</div>
    ${comboChip}
    ${comboAmplifier}
    ${hypothesis}
    ${rankPerk}
    <div class="discovery-pulse-body">${escapeHTML(pulse.insight)}</div>
    <div class="discovery-pulse-foot">${escapeHTML(pulse.missionTitle)} · ${escapeHTML(progress)}${pulse.openedGems ? ` · ${escapeHTML(String(pulse.openedGems))} gem gate${pulse.openedGems === 1 ? "" : "s"}` : ""}</div>
  `;
}

function evaluateMissionResultChecks(game, fullMission) {
  const checks = fullMission && Array.isArray(fullMission.resultChecks) ? fullMission.resultChecks : [];
  const items = checks.map(check => {
    let passed = false;
    try {
      passed = !!check.check(game, Compiler);
    } catch (err) {
      passed = false;
    }
    return {
      id: check.id,
      label: check.label,
      passed,
      message: passed ? check.success : check.waiting
    };
  });

  return {
    allPassed: items.length > 0 && items.every(item => item.passed),
    items
  };
}

function renderResultFeedback(container, mission, resultState) {
  const fullMission = mission && mission.fullMission;
  const resultBox = document.createElement("div");
  resultBox.className = "coach-result-box";

  if (!resultState || !Array.isArray(resultState.items) || resultState.items.length === 0) {
    resultBox.innerHTML = `
      <div class="coach-mini-title">What changed?</div>
      <p>Run the code to see what changed in the mission.</p>
    `;
    container.appendChild(resultBox);
    return;
  }

  const badge = fullMission && fullMission.badge ? fullMission.badge : null;
  resultBox.innerHTML = `
    <div class="coach-mini-title">What changed?</div>
    <div class="coach-result-list">
      ${resultState.items.map(item => `
        <div class="coach-result-item ${item.passed ? "passed" : ""}">
          <span>${item.passed ? "✓" : "○"}</span>
          <strong>${escapeHTML(item.label)}</strong>
          <p>${escapeHTML(item.message)}</p>
        </div>
      `).join("")}
    </div>
    ${badge && resultState.allPassed ? `<div class="coach-badge-inline">${escapeHTML(badge.icon)} ${escapeHTML(badge.label)} ready for your Log.</div>` : ""}
  `;
  container.appendChild(resultBox);
}

function showBadgeToast(badge) {
  if (!badge) return;
  let toast = document.getElementById("badge-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "badge-toast";
    toast.className = "badge-toast hidden";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <span class="badge-toast-icon">${escapeHTML(badge.icon)}</span>
    <span><strong>${escapeHTML(badge.label)}</strong><br>${escapeHTML(badge.description)}</span>
  `;
  toast.classList.remove("hidden");
  clearTimeout(showBadgeToast.timer);
  showBadgeToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function unlockCoachBadge(game, fullMission) {
  if (!game || !fullMission || !fullMission.badge) return false;
  game.earnedBadges = game.earnedBadges || new Set();
  if (game.earnedBadges.has(fullMission.badge.id)) return false;

  game.earnedBadges.add(fullMission.badge.id);
  showBadgeToast(fullMission.badge);
  ui_log_output(`Badge unlocked: ${fullMission.badge.icon} ${fullMission.badge.label}`, "success");
  if (typeof showDialogue === 'function') {
    showDialogue(`${fullMission.badge.icon} Badge unlocked: ${fullMission.badge.label}!`, "badge");
  }
  if (typeof updateBadgeShelf === 'function') {
    updateBadgeShelf(game);
  }
  return true;
}

function getCoachFocusText(game, activeMission) {
  const fullMission = activeMission.fullMission;
  if (game.completedMissions.has(activeMission.id)) {
    return "Explain what worked in the Log, then collect any remaining gems.";
  }

  const selectedPrediction = game.coachPredictions && game.coachPredictions[activeMission.id];
  if (fullMission.prediction && !selectedPrediction) {
    return fullMission.prediction.question;
  }

  if (!game.currentMissionSteps || !game.currentMissionSteps.code) {
    return fullMission.scaffold && fullMission.scaffold.codeIdea
      ? fullMission.scaffold.codeIdea
      : "Run the coach code, then test the mission.";
  }

  const resultState = game.coachLastResults ? game.coachLastResults[activeMission.id] : null;
  if (resultState && !resultState.allPassed) {
    const waiting = resultState.items.find(item => !item.passed);
    return waiting ? waiting.message : "Adjust the code and run it again.";
  }

  if (resultState && resultState.allPassed) {
    return "Great. Test it in the level and collect the unlocked gems.";
  }

  return "Move in the level and watch what changed.";
}

// Direction + live reading for the numeric tuners, so the coach can detect an
// assignment the cadet has already made and skip past it.
const COACH_SLOT_RULES = {
  "antigravity":         { dir: ">=", live: (g) => (Compiler.env.antigravity || 0) * (9.8 / 0.6) },
  "hopper.engine":       { dir: ">=", live: (g) => g.getEngineForce() },
  "hopper.jump_power":   { dir: ">=", live: (g) => (g.player ? g.player.jumpPower : 0) },
  "hopper.rocket_power": { dir: ">=", live: (g) => (g.player && Number.isFinite(g.player.rocketPower)) ? g.player.rocketPower : 0 },
  "hopper.mass":         { dir: "<=", live: (g) => g.hopperMass },
  "elasticity":          { dir: ">=", live: () => (Compiler.env && Compiler.env.elasticity !== null) ? Compiler.env.elasticity : 0 }
};

function coachLineForSlot(scaffold, slotId) {
  return (scaffold.template || "").split("\n").find(l => l.includes("{" + slotId + "}")) || "";
}
function coachVarName(scaffold, slotId) {
  const line = coachLineForSlot(scaffold, slotId);
  const eq = line.indexOf("=");
  return eq > 0 ? line.slice(0, eq).trim() : "";
}
function coachAssignment(scaffold, slot, value) {
  return coachLineForSlot(scaffold, slot.id).replace(new RegExp("\\{" + slot.id + "\\}", "g"), String(value));
}
function coachSetupLines(scaffold) {
  return (scaffold.template || "").split("\n").filter(l => l.trim() && !/\{[^}]+\}/.test(l));
}
function isSlotAlreadySet(game, varName, target, slot) {
  const rule = COACH_SLOT_RULES[varName];
  if (!rule || !Number.isFinite(target)) return false;
  const live = rule.live(game);
  if (!Number.isFinite(live)) return false;
  const dir = (slot && slot.dir) || rule.dir;
  if (dir === ">=") return live >= target - 0.05;
  if (dir === "<=") return live <= target + 0.05;
  return Math.abs(live - target) < 0.05;
}

// Live value + cap text for a tunable command — powers the Tab-completion hints and
// the Command Dictionary cards so they show the CURRENT value and the material cap.
function getTunableInfo(game, cmd) {
  if (!game) return null;
  const G = 9.8 / 0.6;
  const r1 = (n) => Math.round(n * 10) / 10;
  const defs = {
    "antigravity":         { live: () => (Compiler.env.antigravity || 0) * G, key: 'antigravity' },
    "hopper.mass":         { live: () => game.hopperMass, key: 'mass' },
    "hopper.engine":       { live: () => game.getEngineForce(), key: 'engine' },
    "hopper.jump_power":   { live: () => (game.player ? game.player.jumpPower : 0), key: 'jump' },
    "player.jump_power":   { live: () => (game.player ? game.player.jumpPower : 0), key: 'jump' },
    "jump_power":          { live: () => (game.player ? game.player.jumpPower : 0), key: 'jump' },
    "hopper.rocket_power": { live: () => (game.player && Number.isFinite(game.player.rocketPower) ? game.player.rocketPower : 0), key: 'rocket' },
    "player.speed":        { live: () => game.getCurrentSpeed(), key: null },
    "speed":               { live: () => game.getCurrentSpeed(), key: null },
    "friction":            { live: () => game.getCurrentFriction(), key: null },
    "gravity":             { live: () => game.getCurrentGravity() * G, key: null },
    "elasticity":          { live: () => (Compiler.env && Compiler.env.elasticity !== null) ? Compiler.env.elasticity : 0, key: null }
  };
  const d = defs[cmd];
  if (!d) return null;
  let cur = null;
  try { const v = d.live(); cur = Number.isFinite(v) ? r1(v) : null; } catch (e) { cur = null; }
  let capText = "";
  if (d.key && typeof game.getUpgradeCap === 'function' && typeof HOPPER_UPGRADES !== 'undefined' && HOPPER_UPGRADES[d.key]) {
    const cap = r1(game.getUpgradeCap(d.key));
    capText = HOPPER_UPGRADES[d.key].isFloor ? `min ${cap}` : `max ${cap}`;
  }

  // Fuel cost of the CURRENT setting, as a share of a full tank — so the cadet sees that
  // cranking jump/rocket/antigravity drains fuel (and a lighter mass makes it cheaper).
  let fuelText = "";
  const mass = (game.player && game.player.mass) ? game.player.mass : (game.hopperMass || 2.5);
  const maxFuel = (game.player && game.player.maxFuel) ? game.player.maxFuel : 100;
  if (cur !== null) {
    if (d.key === 'jump') {
      const jp = game.player ? game.player.jumpPower : 0;
      const cost = Math.max(0, jp - 14) * mass * 0.45;
      if (cost > 0.5) fuelText = `⛽${Math.round(cost / maxFuel * 100)}%/jump`;
    } else if (d.key === 'rocket') {
      const rp = (game.player && Number.isFinite(game.player.rocketPower)) ? game.player.rocketPower : 0;
      const perFrame = Math.max(0.5, 1.5 * (rp / 40) * (mass / 2.5));
      fuelText = `⛽${Math.round(perFrame * 60 / maxFuel * 100)}%/s`;
    } else if (d.key === 'antigravity') {
      const agUnits = Math.abs(Compiler.env.antigravity || 0);
      const perFrame = agUnits * mass;
      if (perFrame > 0.001) fuelText = `⛽${Math.round(perFrame * 60 / maxFuel * 100)}%/s`;
    } else if (d.key === 'mass') {
      fuelText = "lighter = less fuel";
    }
  }
  return { cur, capText, fuelText };
}

// Refresh the Physics Constants cards to show each tuner's CURRENT value + cap
// (instead of a fixed default), so clicking one loads where you actually are.
function refreshDictionaryCards(game) {
  if (!game) return;
  document.querySelectorAll('#pane-physics .code-card').forEach(card => {
    const code = card.getAttribute('data-code') || "";
    const m = code.match(/^([\w.]+)\s*=\s*-?[\d.]+\s*$/);
    if (!m) return;
    const varName = m[1];
    if (varName === 'friction') return; // keep the slick/brake friction presets distinct
    const info = getTunableInfo(game, varName);
    if (!info || info.cur === null) return;
    card.setAttribute('data-code', `${varName} = ${info.cur}`);
    const kw = card.querySelector('.keyword');
    if (kw) kw.textContent = info.cur;
    let capEl = card.querySelector('.card-cap');
    if (info.capText) {
      if (!capEl) { capEl = document.createElement('span'); capEl.className = 'card-cap'; card.appendChild(capEl); }
      capEl.textContent = ` ${info.capText}`;
    } else if (capEl) {
      capEl.remove();
    }
    card.title = `Now ${varName} = ${info.cur}${info.capText ? ' · ' + info.capText : ''}. Click to load it into the shell.`;
  });
}

// Mission Coach scaffold — friendly and ONE assignment at a time. The cadet picks
// the prediction first, then tunes a single number, sees it run, and moves on. An
// assignment already satisfied in the live game flashes "already set" and is skipped.
function renderScaffoldEditor(game, mission) {
  const container = document.getElementById("mission-scaffold");
  if (!container) return;
  const fullMission = mission && mission.fullMission;
  const scaffold = fullMission ? fullMission.scaffold : null;
  if (!scaffold) { container.innerHTML = ""; return; }
  container.innerHTML = "";

  // 1. Prediction gate — show ONLY the guess until it's picked.
  const selectedPrediction = game.coachPredictions ? game.coachPredictions[mission.id] : null;
  if (fullMission.prediction && !selectedPrediction) {
    const prediction = document.createElement("div");
    prediction.className = "coach-prediction-card coach-kid";
    prediction.innerHTML = `
      <div class="coach-mini-title">🤔 Guess first</div>
      <p>${escapeHTML(fullMission.prediction.question)}</p>
      <div class="prediction-options">
        ${fullMission.prediction.options.map(option => `
          <button type="button" class="prediction-option" data-prediction-id="${escapeHTML(option.id)}">${escapeHTML(option.label)}</button>
        `).join("")}
      </div>`;
    prediction.querySelectorAll("[data-prediction-id]").forEach(button => {
      button.addEventListener("click", () => {
        game.coachPredictions = game.coachPredictions || {};
        game.coachPredictions[mission.id] = button.dataset.predictionId;
        if (game.currentMissionSteps) game.currentMissionSteps.predict = true;
        const option = fullMission.prediction.options.find(item => item.id === button.dataset.predictionId);
        if (option && typeof showDialogue === 'function') showDialogue(option.feedback, "predict");
        updatePedagogicalGuide(game);
        updateParentMissionSummary(game);
      });
    });
    container.appendChild(prediction);
    return;
  }

  const slots = scaffold.slots || [];

  // Fallback for scaffolds without tunable number slots: one simple Run button.
  if (!slots.length) {
    const simple = document.createElement("div");
    simple.className = "try-code-card coach-kid";
    simple.innerHTML = `<div class="coach-one-num">Try this code</div><pre class="try-code-preview">${escapeHTML(scaffold.template || "")}</pre>`;
    const run = document.createElement("button");
    run.className = "notebook-btn run-scaffold-btn";
    run.textContent = "Run it!";
    run.addEventListener("click", () => runCoachCode(game, scaffold.template || ""));
    simple.appendChild(run);
    container.appendChild(simple);
    return;
  }

  // 2. One assignment at a time.
  if (!game.coachSlot || game.coachSlot.missionId !== mission.id) {
    game.coachSlot = { missionId: mission.id, index: 0, setupDone: false, advancing: false };
  }
  const state = game.coachSlot;

  const makeDots = () => {
    const dots = document.createElement("div");
    dots.className = "coach-step-dots";
    slots.forEach((s, i) => {
      const dot = document.createElement("span");
      dot.className = "coach-dot" + (i < state.index ? " done" : (i === state.index ? " active" : ""));
      dots.appendChild(dot);
    });
    return dots;
  };

  // 2a. Already satisfied? Flash "already set" and auto-skip to the next tweak.
  if (state.index < slots.length) {
    const cur = slots[state.index];
    if (isSlotAlreadySet(game, coachVarName(scaffold, cur.id), Number(cur.value), cur)) {
      const skip = document.createElement("div");
      skip.className = "try-code-card coach-kid coach-skip";
      skip.appendChild(makeDots());
      const note = document.createElement("div");
      note.className = "coach-skip-note";
      note.innerHTML = `✓ <code>${escapeHTML(coachVarName(scaffold, cur.id))}</code> is already set — skipping!`;
      skip.appendChild(note);
      container.appendChild(skip);
      if (!state.advancing) {
        state.advancing = true;
        setTimeout(() => { state.advancing = false; state.index += 1; updatePedagogicalGuide(game); }, 850);
      }
      return;
    }
  }

  // 2b. All tweaks done.
  if (state.index >= slots.length) {
    const done = document.createElement("div");
    done.className = "try-code-card coach-kid coach-done";
    done.appendChild(makeDots());
    const msg = document.createElement("div");
    msg.className = "coach-done-msg";
    msg.textContent = "🎉 All tuned! Watch your gauge climb, then collect the gems.";
    done.appendChild(msg);
    const actions = document.createElement("div");
    actions.className = "try-code-actions";
    const again = document.createElement("button");
    again.className = "notebook-btn";
    again.textContent = "↺ Start over";
    again.addEventListener("click", () => { state.index = 0; state.setupDone = false; updatePedagogicalGuide(game); });
    const edit = document.createElement("button");
    edit.className = "notebook-btn edit-scaffold-btn";
    edit.textContent = "Edit in terminal";
    edit.addEventListener("click", () => {
      const inp = document.getElementById("console-input");
      if (inp) { inp.value = buildScaffoldCode(scaffold, getCorrectedScaffoldValues(scaffold)); autoGrowConsoleInput(inp); inp.focus(); }
    });
    actions.appendChild(again); actions.appendChild(edit);
    done.appendChild(actions);
    container.appendChild(done);
    return;
  }

  // 2c. The current single assignment.
  const slot = slots[state.index];
  const varName = coachVarName(scaffold, slot.id);
  const card = document.createElement("div");
  card.className = "try-code-card coach-kid coach-one";
  card.appendChild(makeDots());

  const num = document.createElement("div");
  num.className = "coach-one-num";
  num.textContent = `Tweak ${state.index + 1} of ${slots.length}`;
  card.appendChild(num);

  const line = document.createElement("div");
  line.className = "coach-one-line";
  const varSpan = document.createElement("span");
  varSpan.className = "coach-one-var";
  varSpan.textContent = varName + " = ";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "coach-one-input";
  input.value = slot.value;
  input.autocomplete = "off";
  input.spellcheck = false;
  line.appendChild(varSpan);
  line.appendChild(input);
  card.appendChild(line);

  if (slot.hint) {
    const hint = document.createElement("p");
    hint.className = "coach-one-hint";
    hint.textContent = slot.hint;
    card.appendChild(hint);
  }

  const actions = document.createElement("div");
  actions.className = "try-code-actions";
  const setBtn = document.createElement("button");
  setBtn.className = "notebook-btn run-scaffold-btn";
  setBtn.textContent = "Set it! →";
  setBtn.addEventListener("click", () => {
    let code = coachAssignment(scaffold, slot, input.value);
    if (!state.setupDone) {
      const setup = coachSetupLines(scaffold);
      if (setup.length) code = setup.join("\n") + "\n" + code;
      state.setupDone = true;
    }
    runCoachCode(game, code);
    state.index += 1;
    updatePedagogicalGuide(game);
  });
  const editBtn = document.createElement("button");
  editBtn.className = "notebook-btn edit-scaffold-btn";
  editBtn.textContent = "Edit in terminal";
  editBtn.addEventListener("click", () => {
    const inp = document.getElementById("console-input");
    if (inp) { inp.value = coachAssignment(scaffold, slot, input.value); autoGrowConsoleInput(inp); inp.focus(); }
  });
  actions.appendChild(editBtn);
  actions.appendChild(setBtn);
  card.appendChild(actions);
  container.appendChild(card);

  renderResultFeedback(container, mission, game.coachLastResults ? game.coachLastResults[mission.id] : null);
}

function runCoachCode(game, code) {
  const trimmed = code.trim();
  if (!trimmed) return;
  const activeMission = getActivePlatformerMission(game);
  if (activeMission && activeMission.fullMission && activeMission.fullMission.prediction) {
    const hasPrediction = game.coachPredictions && game.coachPredictions[activeMission.id];
    if (!hasPrediction) {
      ui_log_output("Pick a prediction before running Mission Coach code.", "error");
      SFX.playError();
      return;
    }
  }

  const lockedBefore = typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : 0;
  ui_log_input(trimmed);
  const res = Compiler.runCommand(trimmed, game);
  if (res.success) {
    ui_log_output(res.msg, "success");
    SFX.playSuccess();
    if (activeMission) {
      game.lastCoachCodeByMission = game.lastCoachCodeByMission || {};
      game.lastCoachCodeByMission[activeMission.id] = trimmed;
    }
    if (typeof handleGuidedCodeHook === 'function') {
      handleGuidedCodeHook(trimmed);
    }
    if (game.currentMissionSteps) {
      game.currentMissionSteps.code = true;
    }
    if (typeof showDialogue === 'function') {
      showDialogue("Code ran. Check What changed, then test it in the level.", "code");
    }
  } else {
    ui_log_output(res.msg, "error");
    SFX.playError();
  }

  game.checkMissions();
  if (res.success) logMissionStat(game);
  if (res.success && activeMission && activeMission.fullMission) {
    game.coachLastResults = game.coachLastResults || {};
    const resultState = evaluateMissionResultChecks(game, activeMission.fullMission);
    game.coachLastResults[activeMission.id] = resultState;
    const lockedAfter = typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : lockedBefore;
    let opened = 0;
    if (lockedBefore > lockedAfter) {
      opened = lockedBefore - lockedAfter;
      ui_log_output(`◆ Code unlocked ${opened} mission gem${opened === 1 ? "" : "s"}!`, "success");
      if (typeof showDialogue === 'function') {
        showDialogue(`Nice engineering. ${opened} gem gate${opened === 1 ? "" : "s"} opened!`, "badge");
      }
    }
    recordDiscoveryPulse(game, activeMission, trimmed, resultState, opened);
    if (resultState.allPassed || game.completedMissions.has(activeMission.id)) {
      unlockCoachBadge(game, activeMission.fullMission);
    }
  }
  updatePedagogicalGuide(game);
  updateMissionList(game);
}

function updateParentMissionSummary(game) {
  const summary = document.getElementById("parent-mission-summary");
  if (!summary) return;

  const mission = getActivePlatformerMission(game);
  if (!mission || !mission.fullMission || !mission.fullMission.scaffold) {
    summary.innerHTML = "<p>Launch a mission to see the parent coaching summary.</p>";
    return;
  }

  const full = mission.fullMission;
  const scaffold = full.scaffold;
  const status = game && typeof game.getLevelObjectiveStatus === 'function' ? game.getLevelObjectiveStatus() : null;
  const progress = status ? `Tasks ${status.missionsComplete}/${status.missionsTotal}, gems ${status.collectiblesCollected}/${status.collectiblesTotal}` : "Mission not started";
  const prediction = full.prediction ? full.prediction.question : "Watch first, then make a prediction.";
  const badge = full.badge ? `${full.badge.icon} ${full.badge.label}: ${full.badge.description}` : "Complete the mission to unlock a concept badge.";

  summary.innerHTML = `
    <span class="guide-card-title">${escapeHTML(full.title)}</span>
    <p><strong>Concept:</strong> ${escapeHTML(full.beginnerConcept)}</p>
    <p><strong>Prediction:</strong> ${escapeHTML(prediction)}</p>
    <p><strong>Code idea:</strong> ${escapeHTML(scaffold.codeIdea)}</p>
    <p><strong>Physics idea:</strong> ${escapeHTML(scaffold.physicsIdea)}</p>
    <p><strong>Ask your child:</strong> ${escapeHTML(scaffold.parentPrompt)}</p>
    <p><strong>Badge:</strong> ${escapeHTML(badge)}</p>
    <p><strong>Success:</strong> ${escapeHTML(scaffold.success)}</p>
    <p class="parent-progress-line">${escapeHTML(progress)}</p>
  `;
}

// Typing effect helper for robot dialogues
let currentDialogueTimer = null;

// Tiny 16x16 CSS/SVG pixel-art faces per speaker (crisp-edged, retro JRPG avatars).
const PORTRAIT_ART = {
  VECTOR: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="7" y="1" width="2" height="2" fill="#94a3b8"/><rect x="3" y="3" width="10" height="10" fill="#64748b"/><rect x="4" y="5" width="8" height="4" fill="#0b1022"/><rect x="5" y="6" width="2" height="2" fill="#38bdf8"/><rect x="9" y="6" width="2" height="2" fill="#38bdf8"/><rect x="5" y="11" width="6" height="1" fill="#0b1022"/></svg>`,
  STAR: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="2" width="8" height="2" fill="#38bdf8"/><rect x="3" y="3" width="10" height="9" fill="#0e7490"/><rect x="4" y="5" width="3" height="3" fill="#e0f2fe"/><rect x="9" y="5" width="3" height="3" fill="#e0f2fe"/><rect x="5" y="6" width="1" height="1" fill="#0b1022"/><rect x="10" y="6" width="1" height="1" fill="#0b1022"/><rect x="6" y="10" width="4" height="1" fill="#38bdf8"/></svg>`,
  HOPPER: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="3" width="10" height="10" fill="#9a3412"/><rect x="2" y="5" width="1" height="3" fill="#f97316"/><rect x="13" y="5" width="1" height="3" fill="#f97316"/><rect x="4" y="4" width="8" height="6" fill="#fdba74"/><rect x="5" y="6" width="2" height="2" fill="#0b1022"/><rect x="9" y="6" width="2" height="2" fill="#0b1022"/><rect x="6" y="9" width="4" height="1" fill="#9a3412"/></svg>`,
  BRIDGE: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="6" y="6" width="4" height="7" fill="#64748b"/><rect x="3" y="3" width="6" height="6" fill="#94a3b8"/><rect x="5" y="5" width="2" height="2" fill="#38bdf8"/><rect x="10" y="4" width="3" height="2" fill="#facc15"/><rect x="10" y="9" width="3" height="2" fill="#facc15"/></svg>`,
  ENGINEER: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="3" width="10" height="2" fill="#f97316"/><rect x="2" y="5" width="12" height="1" fill="#ea580c"/><rect x="4" y="6" width="8" height="6" fill="#fcd34d"/><rect x="5" y="8" width="2" height="2" fill="#0b1022"/><rect x="9" y="8" width="2" height="2" fill="#0b1022"/></svg>`,
  SYSTEM: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="6" y="2" width="4" height="12" fill="#94a3b8"/><rect x="2" y="6" width="12" height="4" fill="#94a3b8"/><rect x="4" y="4" width="8" height="8" fill="#94a3b8"/><rect x="6" y="6" width="4" height="4" fill="#0b1022"/></svg>`
};

// Vector speaks through the mission CRT monitor and Mission box log. Important
// directions do not depend on a character speech bubble that can hide behind the scene.
function showDialogue(text, trigger = "start") {
  if (!text) return;
  const game = (typeof window !== 'undefined') ? window.Game : null;
  const raw = String(text).replace(/^\s*Vector here\s*[—–-]\s*/i, "");
  const line = game && typeof game.formatVectorTransmission === 'function'
    ? game.formatVectorTransmission(raw, trigger)
    : `VECTOR // ${raw.trim()}`;
  if (!line) return;
  // The arrival line on each planet starts a fresh briefing and lingers a bit longer.
  if (trigger === "start") {
    const log = document.getElementById("mission-briefing-log");
    if (log) { log.innerHTML = ""; log._last = null; }
  }
  if (game && typeof game.showMissionBalloon === "function") {
    game.showMissionBalloon(line, {
      title: trigger === "start" ? "VECTOR LINK" : "VECTOR TIP",
      timer: trigger === "start" ? 420 : 300,
      color: "#22c55e"
    });
  }
  // The complete message is kept in the Mission monitor for re-reading.
  logMissionBriefing(line);
}

// Keep every narration line in the Mission box (newest on top), so the transient
// CRT monitor is just a heads-up and the full text is always there to refer back to.
function logMissionBriefing(text) {
  const log = document.getElementById("mission-briefing-log");
  if (!log || !text) return;
  if (log._last === text) return; // skip consecutive duplicates
  log._last = text;
  const item = document.createElement("div");
  item.className = "mission-briefing-item";
  item.textContent = text;
  log.insertBefore(item, log.firstChild);
  while (log.children.length > 8) log.removeChild(log.lastChild);
}

function closeDialogue() {
  if (window.Game && window.Game.player) window.Game.player.sayTimer = 0;
}

// Resize the console textarea to fit its content (capped, then it scrolls).
function autoGrowConsoleInput(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 132) + "px";
}

// --- Console command history (shell-style Up/Down recall) ---
let consoleCmdHistory = [];
let consoleHistoryPos = 0;   // index into history; === length means "live draft"
let consoleLiveDraft = "";

function consoleHistoryAdd(cmd) {
  const c = (cmd || "").trim();
  if (c && consoleCmdHistory[consoleCmdHistory.length - 1] !== c) consoleCmdHistory.push(c);
  consoleHistoryPos = consoleCmdHistory.length;
  consoleLiveDraft = "";
}
function consoleHistoryPrev(currentValue) {
  if (consoleCmdHistory.length === 0) return null;
  if (consoleHistoryPos === consoleCmdHistory.length) {
    consoleLiveDraft = currentValue;                 // remember what was being typed
    consoleHistoryPos = consoleCmdHistory.length - 1;
  } else if (consoleHistoryPos > 0) {
    consoleHistoryPos--;
  }
  return consoleCmdHistory[consoleHistoryPos];
}
function consoleHistoryNext() {
  if (consoleHistoryPos >= consoleCmdHistory.length) return null; // already at the live draft
  consoleHistoryPos++;
  if (consoleHistoryPos >= consoleCmdHistory.length) return consoleLiveDraft || "";
  return consoleCmdHistory[consoleHistoryPos];
}
function consoleCursorOnFirstLine(el) {
  return el.value.lastIndexOf("\n", el.selectionStart - 1) === -1;
}
function consoleCursorOnLastLine(el) {
  return el.value.indexOf("\n", el.selectionStart) === -1;
}
function consoleRecall(input, value, suggestBox) {
  input.value = value;
  autoGrowConsoleInput(input);
  try { input.setSelectionRange(value.length, value.length); } catch (e) { /* noop */ }
  if (suggestBox) suggestBox.style.display = "none";
}

function getAutocompleteAcceptIndex(matches, activeIdx) {
  if (!matches || !matches.length) return -1;
  return activeIdx >= 0 && activeIdx < matches.length ? activeIdx : 0;
}

function completeAutocompleteText(text, cur, suggestion) {
  const idx = cur ? text.lastIndexOf(cur) : -1;
  return (idx >= 0 ? text.slice(0, idx) : text) + suggestion;
}

// After a property is entered, echo the world's composite stat so the player can
// watch one number climb toward the target instead of guessing four thresholds.
function logMissionStat(game) {
  if (!game) return;

  // 1. Composite stat line (Earth/Jupiter); other worlds have no stat, so skip it.
  const s = (typeof game.getMissionStat === "function") ? game.getMissionStat() : null;
  const onHopper = !game.player || game.player.charType === "hopper";
  if (s) {
    if (!onHopper) {
      ui_log_output(`🎯 ${s.label} is measured on the Hopper suit — run use_hopper() first, then tune.`, "info");
    } else if (s.value >= s.target) {
      ui_log_output(`🎯 ${s.label}: ${Math.round(s.value)} / ${s.target} ✓`, "success");
    } else {
      const tip = s.key === "thrust"
        ? "raise hopper.rocket_power or hopper.engine, or lower hopper.mass"
        : "lower hopper.mass, add antigravity, or raise hopper.engine or hopper.jump_power";
      ui_log_output(`🎯 ${s.label}: ${Math.round(s.value)} / ${s.target} — ${tip} to push it up.`, "info");
    }
    // Show the equation with live numbers so the cadet sees HOW each tuner moves the score.
    if (onHopper) {
      const f = (n) => (Math.round(n * 10) / 10).toFixed(1);
      const m = game.getActiveMass();
      if (s.key === "agility") {
        // Use design gravity so the printed formula matches getAgility() (which ignores the
        // fuel gate) — otherwise the arithmetic wouldn't reconcile when the thruster is empty.
        const S = game.getCurrentSpeed(), J = game.getJumpVelocity(), g = (typeof game.getDesignGravity === 'function') ? game.getDesignGravity() : game.getCurrentGravity();
        ui_log_output(`   speed = engine ${f(game.getEngineForce())} ÷ mass ${f(m)} = ${f(S)} · jump = force ${f(game.getJumpForce())} ÷ mass ${f(m)} = ${f(J)}`, "info");
        ui_log_output(`   Agility = (speed ${f(S)} + jump ${f(J)}) × 0.6 ÷ gravity ${f(g)} = ${Math.round(s.value)}`, "info");
      } else if (s.key === "thrust") {
        const R = Number.isFinite(game.player.rocketPower) ? game.player.rocketPower : 40;
        ui_log_output(`   Thrust = rocket ${f(R)} × (2.5 ÷ mass ${f(m)}) + speed ${f(game.getCurrentSpeed())} = ${Math.round(s.value)}`, "info");
      }
    }
  }

  // 2. REAL gem status (every world). The stat is often only PART of a gem's gate,
  //    so report the actual lock count — and only when it CHANGES, so it never spams.
  if (typeof game.getLockedRequiredCollectibleCount !== "function") return;
  const locked = game.getLockedRequiredCollectibleCount();
  const statMet = !!(s && onHopper && s.value >= s.target);
  const key = locked + "|" + statMet;
  if (game._lastGemLogKey === key) return;
  game._lastGemLogKey = key;
  if (locked === 0) {
    ui_log_output(`◆ All mission gems unlocked — go collect them!`, "success");
  } else {
    const gate = (typeof game.getFirstLockedGemGate === "function") ? game.getFirstLockedGemGate() : null;
    ui_log_output(`◆ ${locked} gem${locked === 1 ? "" : "s"} still locked${gate ? ` — ${gate.label}.` : "."}`, "info");
  }
}

// ---- Engineering Bench: linked design sliders -------------------------------
// Input sliders set the real game values; the derived OUTPUT bars (speed, jump,
// agility, thrust, gravity, fuel burn) animate in response — showing F = m·a live.
const ENG_G = 9.8 / 0.6; // m/s² per game-unit of gravity

const ENG_INPUTS = [
  { key: 'mass',     label: 'Mass',        lower: true, step: 0.1, min: (g) => g.getUpgradeCap('mass'), max: () => 10,
    get: (g) => g.hopperMass, set: (g, v) => { g.hopperMass = v; if (g.player && g.player.charType === 'hopper') g.player.mass = v; } },
  { key: 'engine',   label: 'Engine force', step: 0.5, min: () => 1, max: (g) => g.getUpgradeCap('engine'),
    get: (g) => g.getEngineForce(), set: (g, v) => { Compiler.env.engine = v; } },
  { key: 'jump',     label: 'Jump force',   step: 0.5, min: () => 1, max: (g) => g.getUpgradeCap('jump'),
    get: (g) => (g.player ? g.player.jumpPower : 10), set: (g, v) => { if (g.player) g.player.jumpPower = v; } },
  { key: 'rocket',   label: 'Rocket power', step: 1, min: () => 0, max: (g) => g.getUpgradeCap('rocket'),
    get: (g) => (g.player && Number.isFinite(g.player.rocketPower)) ? g.player.rocketPower : 40, set: (g, v) => { if (g.player) g.player.rocketPower = v; } },
  { key: 'antigrav', label: 'Antigravity',  step: 0.1, min: () => 0, max: (g) => g.getUpgradeCap('antigravity'),
    get: () => (Compiler.env.antigravity || 0) * ENG_G, set: (g, v) => { Compiler.env.antigravity = v / ENG_G; } }
];

function engStats(g) {
  const m = Math.max(0.05, g.hopperMass || 1);
  const eng = g.getEngineForce();
  const jf = g.player ? g.player.jumpPower : 10;
  const rocket = (g.player && Number.isFinite(g.player.rocketPower)) ? g.player.rocketPower : 40;
  const felt = g.getCurrentGravity();
  const speed = eng / m, jumpV = jf / m;
  return {
    speed, jumpV,
    agility: (speed + jumpV) * 0.6 / Math.max(0.05, felt),
    thrust: rocket * (2.5 / m) + speed,
    gravity: felt * ENG_G,
    fuel: Math.max(0.7, 1.5 * (rocket / 40))
  };
}

const ENG_OUTPUTS = [
  { key: 'speed',   label: 'Top speed',    pick: (s) => s.speed,   maxRef: 24,  fmt: (v) => v.toFixed(1) },
  { key: 'jumpV',   label: 'Jump height',  pick: (s) => s.jumpV,   maxRef: 40,  fmt: (v) => v.toFixed(1) },
  { key: 'agility', label: 'Agility',      pick: (s) => s.agility, maxRef: 60,  fmt: (v) => String(Math.round(v)), goal: 30 },
  { key: 'thrust',  label: 'Thrust',       pick: (s) => s.thrust,  maxRef: 220, fmt: (v) => String(Math.round(v)), goal: 45 },
  { key: 'gravity', label: 'Felt gravity', pick: (s) => s.gravity, maxRef: 30,  fmt: (v) => v.toFixed(1) + ' m/s²' },
  { key: 'fuel',    label: 'Fuel burn',    pick: (s) => s.fuel,    maxRef: 5,   fmt: (v) => v.toFixed(1) + '/f', warn: true }
];

function refreshEngOutputs(game) {
  const s = engStats(game);
  ENG_OUTPUTS.forEach((o) => {
    const v = o.pick(s);
    const fill = document.getElementById('eng-out-' + o.key);
    const val = document.getElementById('eng-val-' + o.key);
    if (fill) fill.style.width = Math.max(2, Math.min(100, (v / o.maxRef) * 100)) + '%';
    if (val) {
      val.textContent = o.fmt(v) + (o.goal ? ' / ' + o.goal : '');
      if (o.goal) val.classList.toggle('eng-met', v >= o.goal);
    }
  });
}

function renderEngineerPanel(game) {
  if (!game) return;
  const inWrap = document.getElementById('eng-inputs');
  const outWrap = document.getElementById('eng-outputs');
  if (!inWrap || !outWrap) return;

  inWrap.innerHTML = '';
  ENG_INPUTS.forEach((cfg) => {
    const lo = cfg.min(game), hi = cfg.max(game);
    const cur = Math.max(lo, Math.min(hi, cfg.get(game)));
    const row = document.createElement('div');
    row.className = 'eng-slider';
    row.innerHTML = `<div class="eng-slider-head"><span>${cfg.label}</span><span class="eng-slider-val" id="eng-in-${cfg.key}">${Math.round(cur * 10) / 10}</span></div>`;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = lo; range.max = hi; range.step = cfg.step; range.value = cur;
    range.className = 'eng-range' + (cfg.lower ? ' eng-range-lower' : '');
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      cfg.set(game, v);
      const lab = document.getElementById('eng-in-' + cfg.key);
      if (lab) lab.textContent = Math.round(v * 10) / 10;
      refreshEngOutputs(game);
      if (typeof updateHUD === 'function') updateHUD(game);
    });
    row.appendChild(range);
    inWrap.appendChild(row);
  });

  outWrap.innerHTML = ENG_OUTPUTS.map((o) => `
    <div class="eng-output${o.warn ? ' eng-warn' : ''}">
      <div class="eng-out-head"><span>${o.label}</span><span class="eng-out-val" id="eng-val-${o.key}">–</span></div>
      <div class="eng-bar"><div class="eng-bar-fill" id="eng-out-${o.key}"></div></div>
    </div>`).join('');
  refreshEngOutputs(game);
}

// Binds UI controls, terminal input, and cards
function setupUIBindings(game) {
  setupResizablePanes();
  updatePauseControls();
  initReadableTextPreference();

  const readableBtn = document.getElementById("readable-text-btn");
  if (readableBtn && readableBtn.dataset.bound !== "true") {
    readableBtn.dataset.bound = "true";
    readableBtn.addEventListener("click", toggleReadableTextMode);
  }

  const input = document.getElementById("console-input");
  const suggestBox = document.getElementById("autocomplete-box");

  // Tab-completion cycle state: tabLast is the last value we wrote programmatically,
  // so a repeated Tab keeps cycling the same base prefix while any real typing resets.
  let tabBase = null, tabIdx = -1, tabLast = null;
  let suggestMatches = [];
  let suggestCur = "";

  // Render the autocomplete dropdown with EVERY match (so the cadet sees all the
  // options, e.g. all hopper.* names), highlighting activeIdx and letting a click
  // insert a choice by replacing the trailing word `cur`.
  function renderSuggestBox(matches, activeIdx, cur) {
    if (!suggestBox) return;
    if (!matches || !matches.length) {
      suggestMatches = [];
      suggestCur = "";
      suggestBox.style.display = "none";
      return;
    }
    suggestMatches = matches.slice();
    suggestCur = cur || "";
    suggestBox.innerHTML = "";
    suggestBox.style.display = "flex";
    matches.forEach((s, i) => {
      const opt = document.createElement("div");
      opt.className = "autocomplete-item" + (i === activeIdx ? " active" : "");
      const nameEl = document.createElement("span");
      nameEl.className = "ac-name";
      nameEl.textContent = s;
      opt.appendChild(nameEl);
      // Show the live value + material cap for tunable commands (hopper.mass, etc).
      const info = (typeof getTunableInfo === "function") ? getTunableInfo(game, s) : null;
      if (info && (info.cur !== null || info.capText)) {
        const hintEl = document.createElement("span");
        hintEl.className = "ac-hint";
        const parts = [];
        if (info.cur !== null) parts.push(`now ${info.cur}`);
        if (info.capText) parts.push(info.capText);
        if (info.fuelText) parts.push(info.fuelText);
        hintEl.textContent = parts.join(" · ");
        opt.appendChild(hintEl);
      }
      opt.addEventListener("mousedown", (ev) => {
        input.value = completeAutocompleteText(input.value, cur, s);
        input.focus();
        suggestBox.style.display = "none";
        tabLast = input.value;
        autoGrowConsoleInput(input);
        ev.preventDefault();
      });
      suggestBox.appendChild(opt);
    });
  }

  // 1. Code editor input submission
  if (input) {
    const pauseForCoding = () => setCodingPause(true);
    input.addEventListener("pointerdown", pauseForCoding);
    input.addEventListener("mousedown", pauseForCoding);
    input.addEventListener("focus", pauseForCoding);
    input.addEventListener("focusin", pauseForCoding);
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (document.activeElement !== input) setCodingPause(false);
      }, 80);
    });

    input.addEventListener("keydown", (e) => {
      // Tab completes the word under the caret; pressing Tab again cycles matches.
      if (e.key === "Tab") {
        e.preventDefault();
        const text = input.value;
        const m = text.match(/[\w\.]+$/);
        const cur = m ? m[0] : "";
        if (!cur) return;
        const continuing = (text === tabLast && tabBase !== null);
        const base = continuing ? tabBase : cur;
        const sugg = Compiler.autocomplete.suggest(base);
        if (!sugg.length) return;
        tabBase = base;
        if (!continuing && tabIdx >= 0 && tabIdx < sugg.length) {
          // Keep tabIdx selected by arrow keys
        } else {
          tabIdx = continuing ? (tabIdx + 1) % sugg.length : 0;
        }
        const pick = sugg[tabIdx];
        const idx = text.lastIndexOf(cur);
        input.value = text.slice(0, idx) + pick;
        tabLast = input.value;
        autoGrowConsoleInput(input);
        // Keep the dropdown open showing ALL matches with the current pick highlighted.
        renderSuggestBox(sugg, tabIdx, pick);
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
        return;
      }

      // Autocomplete arrow navigation
      if (e.key === "ArrowDown" && suggestBox && suggestBox.style.display !== "none" && suggestMatches.length > 0) {
        e.preventDefault();
        const text = input.value;
        const m = text.match(/[\w\.]+$/);
        const cur = m ? m[0] : "";
        tabIdx = (tabIdx + 1) % suggestMatches.length;
        tabBase = cur || tabBase;
        renderSuggestBox(suggestMatches, tabIdx, cur);
        const activeEl = suggestBox.querySelector(".autocomplete-item.active");
        if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "ArrowUp" && suggestBox && suggestBox.style.display !== "none" && suggestMatches.length > 0) {
        e.preventDefault();
        const text = input.value;
        const m = text.match(/[\w\.]+$/);
        const cur = m ? m[0] : "";
        tabIdx = tabIdx <= 0 ? suggestMatches.length - 1 : tabIdx - 1;
        tabBase = cur || tabBase;
        renderSuggestBox(suggestMatches, tabIdx, cur);
        const activeEl = suggestBox.querySelector(".autocomplete-item.active");
        if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
        return;
      }

      // Shell-style history: Up/Down recall previous commands, but only at the
      // text edges so they still move the caret within multi-line code.
      if (e.key === "ArrowUp" && consoleCursorOnFirstLine(input)) {
        const recalled = consoleHistoryPrev(input.value);
        if (recalled !== null) { e.preventDefault(); consoleRecall(input, recalled, suggestBox); }
        return;
      }
      if (e.key === "ArrowDown" && consoleCursorOnLastLine(input)) {
        const recalled = consoleHistoryNext();
        if (recalled !== null) { e.preventDefault(); consoleRecall(input, recalled, suggestBox); }
        return;
      }

      // Enter runs the program; Shift+Enter inserts a newline so kids can enter
      // multi-line code (e.g. the whole Mission Coach block) in one go.
      if (e.key === "Enter" && !e.shiftKey) {
        // If the autocomplete dropdown is open with a Tab-chosen suggestion, the first
        // Enter ACCEPTS it (just like clicking the row) instead of running — so the cadet
        // can keep editing (e.g. add " = 2.0"). The dropdown closes; a second Enter runs.
        const boxOpen = suggestBox && suggestBox.style.display !== "none";
        if (boxOpen && suggestMatches.length) {
          const acceptIdx = getAutocompleteAcceptIndex(suggestMatches, tabIdx);
          if (acceptIdx >= 0) {
            e.preventDefault();
            input.value = completeAutocompleteText(input.value, suggestCur, suggestMatches[acceptIdx]);
            suggestBox.style.display = "none";
            tabBase = null; tabIdx = -1; tabLast = input.value;
            autoGrowConsoleInput(input);
            try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
            return;
          }
        }
        e.preventDefault();
        const val = input.value;
        if (val.trim()) {
          ui_log_input(val);
          consoleHistoryAdd(val);
          // Navigator commands (point_at/thrust/warp/wait) only work in the launch-plan
          // console during a flight between planets — redirect instead of "not defined".
          if (/^\s*(point_at|thrust|warp|wait)\s*\(/.test(val)) {
            ui_log_output("That's a Navigator command — use it in the launch-plan console while flying between planets (Run Launch Plan), not here in the surface shell.", "info");
            input.value = "";
            autoGrowConsoleInput(input);
            if (suggestBox) suggestBox.style.display = "none";
            return;
          }
          const res = Compiler.runCommand(val, game);
          if (res.success) {
            ui_log_output(res.msg, "success");
            SFX.playSuccess();
            // Record the change on this attempt's experiment-log row.
            if (typeof attemptLogCode === 'function') attemptLogCode(game, val);
            if (typeof handleGuidedCodeHook === 'function') {
              handleGuidedCodeHook(val);
            }
            if (game.currentMissionSteps) {
              game.currentMissionSteps.code = true;
              updatePedagogicalGuide(game);
            }
          } else {
            ui_log_output(res.msg, "error");
            SFX.playError();
          }
          input.value = "";
          autoGrowConsoleInput(input);
          if (suggestBox) suggestBox.style.display = "none";

          // Re-validate missions immediately on run, then echo the composite stat
          game.checkMissions();
          if (res.success) logMissionStat(game);
        }
      }
    });

    // Grow the console textarea to fit multi-line code as it's typed/pasted.
    // Real typing also breaks any active Tab-completion cycle.
    input.addEventListener("input", () => {
      autoGrowConsoleInput(input);
      if (input.value !== tabLast) { tabBase = null; tabIdx = -1; }
    });

    // The textarea is only the bottom strip of the shell box, so clicking the
    // prompt, the banner, or the padding should still focus it. (Clicks inside the
    // output history are left alone so log text stays selectable/copyable.)
    const shellBox = input.closest(".console-area");
    if (shellBox) {
      shellBox.addEventListener("mousedown", (e) => {
        if (e.target === input) return;
        if (e.target.closest && e.target.closest("#console-history")) return;
        e.preventDefault();
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
      });
    }

    // Autocomplete dynamic input watcher — lists every match as you type.
    if (suggestBox) {
      input.addEventListener("input", () => {
        const lastWordMatch = input.value.match(/[\w\.]+$/);
        const prefix = lastWordMatch ? lastWordMatch[0] : "";
        renderSuggestBox(Compiler.autocomplete.suggest(prefix), -1, prefix);
      });

      input.addEventListener("blur", () => {
        setTimeout(() => {
          suggestBox.style.display = "none";
        }, 150);
      });
    }
  }

  // 2. Click-to-Type cards binding
  const cards = document.querySelectorAll(".code-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const code = card.getAttribute("data-code");
      if (input && code) {
        input.value = code;
        input.focus();
        SFX.playType();
        if (game.currentMissionSteps) {
          game.currentMissionSteps.code = true;
          updatePedagogicalGuide(game);
        }
      }
    });
  });

  // 3. Dialogue close
  const closeBtn = document.getElementById("dialogue-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeDialogue);
  }

  // 3b. Mission Coach + Mission objectives bubbles — click the header to collapse / inflate.
  [["coach-bubble-toggle", "pedagogical-mission-panel"], ["mission-bubble-toggle", "mission-bubble"]].forEach(([togId, bubId]) => {
    const tog = document.getElementById(togId);
    const bub = document.getElementById(bubId);
    if (tog && bub) {
      tog.addEventListener("click", () => {
        const collapsed = bub.classList.toggle("collapsed");
        tog.setAttribute("aria-expanded", String(!collapsed));
      });
    }
  });
  
  // 4. Mute toggle
  const muteBtn = document.getElementById("mute-btn");
  const updateMuteButton = () => {
    if (!muteBtn) return;
    const volume = SFX.getMasterVolumePercent ? SFX.getMasterVolumePercent() : 100;
    muteBtn.innerHTML = SFX.isMuted ? '🔇' : '🔊';
    muteBtn.title = SFX.isMuted ? `Sound muted · volume ${volume}%` : `Sound on · volume ${volume}%`;
  };
  if (muteBtn) {
    updateMuteButton();
    muteBtn.addEventListener("click", () => {
      SFX.toggleMute();
      updateMuteButton();
      syncMasterVolumeControl();
    });
  }

  const volumeSlider = document.getElementById("volume-slider");
  if (volumeSlider) {
    syncMasterVolumeControl();
    volumeSlider.addEventListener("input", () => {
      const pct = Math.max(0, Math.min(100, Number(volumeSlider.value) || 0));
      if (SFX.setMasterVolume) SFX.setMasterVolume(pct / 100);
      syncMasterVolumeControl();
      updateMuteButton();
      if (game && game.player && game.currentPlanet) updateHUD(game);
    });
  }

  // 5. Code deck tabs
  const tabPhysics = document.getElementById("tab-btn-physics");
  const tabRules = document.getElementById("tab-btn-rules");
  const panePhysics = document.getElementById("pane-physics");
  const paneRules = document.getElementById("pane-rules");

  // Refresh the Physics cards to current values whenever the dictionary opens.
  const dictDeck = document.getElementById("more-command-deck");
  if (dictDeck) {
    dictDeck.addEventListener("toggle", () => { if (dictDeck.open) refreshDictionaryCards(game); });
  }

  if (tabPhysics && tabRules && panePhysics && paneRules) {
    tabPhysics.addEventListener("click", () => {
      tabPhysics.classList.add("active");
      tabRules.classList.remove("active");
      panePhysics.classList.remove("hidden");
      paneRules.classList.add("hidden");
      refreshDictionaryCards(game);
      SFX.playType();
    });

    tabRules.addEventListener("click", () => {
      tabRules.classList.add("active");
      tabPhysics.classList.remove("active");
      paneRules.classList.remove("hidden");
      panePhysics.classList.add("hidden");
      SFX.playType();
    });
  }

  // 6. Music dropdown menu
  const musicMenuBtn = document.getElementById("music-menu-btn");
  const musicDropdown = document.getElementById("music-dropdown");
  const musicItems = document.querySelectorAll(".music-dropdown-item");

  if (musicMenuBtn && musicDropdown) {
    musicMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      musicDropdown.classList.toggle("show");
      SFX.playType();
    });

    document.addEventListener("click", () => {
      musicDropdown.classList.remove("show");
    });

    musicItems.forEach(item => {
      item.addEventListener("click", () => {
        const trackId = parseInt(item.getAttribute("data-track"));
        const game = window.Game || null;
        if (game && game.survivalMode && SFX.startSurvivalBGM) {
          SFX.startSurvivalBGM(trackId);
        } else {
          SFX.startBGM(trackId);
        }

        const trackName = SFX.getTrackName ? SFX.getTrackName(trackId) : `Track ${trackId + 1}`;
        ui_log_output(`Music set to: ${trackName}${game && game.survivalMode ? " under Survival Rush" : ""}`, "success");
        
        updateMusicMenuState();
        musicDropdown.classList.remove("show");
      });
    });

    function updateMusicMenuState() {
      const activeTrack = SFX.currentBgm === 'survival' ? SFX.preSurvivalBgm : SFX.currentBgm;
      musicItems.forEach(item => {
        const trackId = parseInt(item.getAttribute("data-track"));
        if (trackId === activeTrack) {
          item.classList.add("active");
          const indicator = item.querySelector(".track-active-indicator");
          if (indicator) indicator.textContent = " ●";
        } else {
          item.classList.remove("active");
          const indicator = item.querySelector(".track-active-indicator");
          if (indicator) indicator.textContent = "";
      }
    });
  }

  const gameCanvas = document.getElementById("game-canvas");
  if (gameCanvas && input) {
    gameCanvas.addEventListener("pointerdown", () => {
      if (document.activeElement === input) {
        input.blur();
        setCodingPause(false);
      }
    });
  }

    // Export so audio.js can sync state
    window.updateMusicMenuState = updateMusicMenuState;
    updateMusicMenuState();

    // 6. Observe & Test steps keyboard watcher
    window.addEventListener("keydown", (e) => {
      if (document.activeElement && document.activeElement.id === "console-input") return; // typing code, not playing
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w', 's'].includes(e.key)) {
        if (game.currentMissionSteps) {
          if (!game.currentMissionSteps.observe) {
            game.currentMissionSteps.observe = true;
            updatePedagogicalGuide(game);
          } else if (game.currentMissionSteps.code && !game.currentMissionSteps.test) {
            game.currentMissionSteps.test = true;
            updatePedagogicalGuide(game);
          }
        }
      }
    });

    const responseArea = document.getElementById("notebook-user-response");
    if (responseArea) {
      responseArea.addEventListener("focus", () => {
        if (game.currentMissionSteps && !game.currentMissionSteps.predict) {
          game.currentMissionSteps.predict = true;
          updatePedagogicalGuide(game);
        }
      });
    }
  }
}

// Mission Coach renderer
function updatePedagogicalGuide(game) {
  const panel = document.getElementById("pedagogical-mission-panel");
  const stepsContainer = document.getElementById("pedagogical-steps");
  if (!panel || !stepsContainer) return;

  const activeMission = getActivePlatformerMission(game);
  if (!activeMission || !activeMission.fullMission) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "flex"; // .coach-bubble is a flex column (head + scrolling body)
  const titleEl = document.getElementById("pedagogical-mission-title");
  if (titleEl) titleEl.textContent = activeMission.fullMission.title;
  const summaryEl = document.getElementById("mission-coach-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span>${escapeHTML(activeMission.fullMission.beginnerConcept)}</span>
      <span>${escapeHTML(activeMission.fullMission.scaffold ? activeMission.fullMission.scaffold.codeIdea : activeMission.fullMission.codingConcept)}</span>
    `;
  }

  // Ensure steps state is initialized
  if (!game.currentMissionSteps || game.currentMissionId !== activeMission.id) {
    game.currentMissionId = activeMission.id;
    game.currentMissionSteps = {
      observe: false,
      predict: false,
      code: false,
      test: false,
      explain: false,
      challenge: false
    };
  }

  // Auto-complete Challenge if mission validated
  if (game.completedMissions.has(activeMission.id)) {
    game.currentMissionSteps.challenge = true;
    game.currentMissionSteps.observe = true;
    game.currentMissionSteps.predict = true;
    game.currentMissionSteps.code = true;
    game.currentMissionSteps.test = true;
    game.currentMissionSteps.explain = true;
  }

  stepsContainer.innerHTML = "";
  const steps = activeMission.fullMission.steps.filter(step => step.id !== "challenge");
  
  // Determine current active step index
  let activeIndex = 0;
  const keys = ["observe", "predict", "code", "test", "explain"];
  for (let i = 0; i < keys.length; i++) {
    if (!game.currentMissionSteps[keys[i]]) {
      activeIndex = i;
      break;
    }
  }
  if (game.completedMissions.has(activeMission.id)) {
    activeIndex = steps.length - 1;
  }

  const focusEl = document.getElementById("mission-coach-focus");
  if (focusEl) {
    focusEl.innerHTML = `<span>Next action</span><strong>${escapeHTML(getCoachFocusText(game, activeMission))}</strong>`;
  }

  // Show ONLY the current step (not the whole wall of 5) with a row of progress
  // dots — much friendlier for an 8-year-old than the full checklist.
  const dots = document.createElement("div");
  dots.className = "coach-step-dots";
  steps.forEach((s, i) => {
    const done = game.currentMissionSteps[keys[i]];
    const dot = document.createElement("span");
    dot.className = "coach-dot" + (done ? " done" : (i === activeIndex ? " active" : ""));
    dots.appendChild(dot);
  });
  stepsContainer.appendChild(dots);

  const activeStep = steps[activeIndex];
  if (activeStep) {
    // Split a "Observe: do the thing" prompt into a chip + friendly sentence.
    const parts = activeStep.prompt.match(/^([A-Za-z]+):\s*([\s\S]*)$/);
    const tag = parts ? parts[1] : `Step ${activeIndex + 1}`;
    const body = parts ? parts[2] : activeStep.prompt;
    const item = document.createElement("div");
    item.className = "coach-active-step";
    item.innerHTML = `
      <div class="coach-step-num">Step ${activeIndex + 1} of ${steps.length} · <span class="coach-step-tag">${escapeHTML(tag)}</span></div>
      <div class="coach-step-text">${escapeHTML(body)}</div>
    `;
    stepsContainer.appendChild(item);
  }

  renderScaffoldEditor(game, activeMission);
}

function openTradeScreen(npc) {
  if (!npc || !window.Game) return;
  
  // Pause the game while trading
  const alreadyOpen = isTradeScreenOpen();
  if (!alreadyOpen) window.Game._wasPausedBeforeTrade = !!window.Game.isPaused;
  window.Game.isPaused = true;
  if (typeof updatePauseControls === 'function') updatePauseControls();

  const tradeScreen = document.getElementById("trade-screen");
  if (!tradeScreen) return;

  // Set NPC details
  const nameEl = document.getElementById("trade-npc-name");
  if (nameEl) nameEl.textContent = npc.name;
  
  const profEl = document.getElementById("trade-npc-profession");
  if (profEl) profEl.textContent = `// ${npc.profession}`;
  
  // Set dialogue (random line from NPC dialogue pool)
  const dialogueText = document.getElementById("trade-dialogue-text");
  if (dialogueText && npc.dialogue && npc.dialogue.length) {
    dialogueText.textContent = npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)];
  }

  // Populate wallet balances
  const wallet = window.Game.gemsWallet || { emerald: 0, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
  const emEl = document.getElementById("wallet-emerald");
  if (emEl) emEl.textContent = wallet.emerald || 0;
  const qzEl = document.getElementById("wallet-quartz");
  if (qzEl) qzEl.textContent = wallet.quartz || 0;
  const amEl = document.getElementById("wallet-amber");
  if (amEl) amEl.textContent = wallet.amber || 0;
  const icEl = document.getElementById("wallet-ice");
  if (icEl) icEl.textContent = wallet.ice || 0;
  const flEl = document.getElementById("wallet-flux");
  if (flEl) flEl.textContent = wallet.flux || 0;
  const fgEl = document.getElementById("wallet-forge");
  if (fgEl) fgEl.textContent = wallet.forge || 0;

  // Render trade offers
  const tradeList = document.getElementById("trade-list");
  if (tradeList) {
    tradeList.innerHTML = "";
    
    if (!npc.trades || npc.trades.length === 0) {
      tradeList.innerHTML = `<div style="font-family: var(--font-sans); color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px 0;">No trades available.</div>`;
    } else {
      npc.trades.forEach(trade => {
        const costType = trade.cost.type;
        const costAmount = trade.cost.amount;
        const playerBalance = wallet[costType] || 0;
        const hasEnough = playerBalance >= costAmount;
        
        const purchased = window.Game.purchasedTrades && window.Game.purchasedTrades.has(trade.id);
        
        const tradeRow = document.createElement("div");
        tradeRow.className = "trade-row";
        
        let gemSymbol = "💚";
        if (costType === 'quartz') gemSymbol = "🤍";
        else if (costType === 'amber') gemSymbol = "🧡";
        else if (costType === 'ice') gemSymbol = "💜";
        else if (costType === 'flux') gemSymbol = "💖";
        else if (costType === 'forge') gemSymbol = "🟧";

        let btnHtml = "";
        if (purchased) {
          btnHtml = `<button class="trade-btn completed" disabled>TRADED</button>`;
        } else {
          btnHtml = `<button class="trade-btn" ${hasEnough ? "" : "disabled"} onclick="executeNPCTrade('${npc.id}', '${trade.id}')">TRADE</button>`;
        }

        tradeRow.innerHTML = `
          <div class="trade-info">
            <span class="trade-desc">${trade.desc}</span>
            <span class="trade-cost">Cost: ${costAmount} ${costType} ${gemSymbol} (Have: ${playerBalance})</span>
          </div>
          ${btnHtml}
        `;
        tradeList.appendChild(tradeRow);
      });
    }
  }

  // Show overlay
  tradeScreen.classList.remove("hidden");
}

function closeTradeScreen() {
  const tradeScreen = document.getElementById("trade-screen");
  if (tradeScreen) {
    tradeScreen.classList.add("hidden");
  }
  
  // Unpause the game
  if (window.Game) {
    const shouldRemainPaused = !!window.Game._wasPausedBeforeTrade || !!window.Game._codingPauseActive;
    window.Game._wasPausedBeforeTrade = false;
    window.Game.isPaused = shouldRemainPaused;
    if (typeof updatePauseControls === 'function') updatePauseControls();
  }
}

function executeNPCTrade(npcId, tradeId) {
  if (!window.Game) return;
  const npc = window.Game.interactiveObjects.find(o => o.id === npcId);
  if (!npc) return;
  const trade = npc.trades.find(t => t.id === tradeId);
  if (!trade) return;

  const wallet = window.Game.gemsWallet || { emerald: 0, quartz: 0, amber: 0, ice: 0, flux: 0, forge: 0 };
  const costType = trade.cost.type;
  const costAmount = trade.cost.amount;

  if ((wallet[costType] || 0) < costAmount) {
    if (typeof ui_log_output === 'function') ui_log_output("❌ You do not have enough gems for this trade!", "error");
    return;
  }

  // Deduct cost
  wallet[costType] -= costAmount;
  window.Game.gemsWallet = wallet;

  // Mark trade as purchased
  window.Game.purchasedTrades = window.Game.purchasedTrades || new Set();
  window.Game.purchasedTrades.add(tradeId);

  // Apply Reward!
  const reward = trade.reward;
  if (reward.type === 'cap') {
    const key = reward.key;
    window.Game.upgradeCapBonuses = window.Game.upgradeCapBonuses || { engine: 0, jump: 0, rocket: 0, mass: 0, antigravity: 0 };
    window.Game.upgradeCapBonuses[key] = (window.Game.upgradeCapBonuses[key] || 0) + reward.amount;
    
    if (typeof ui_log_output === 'function') {
      ui_log_output(`⚙ Trade Successful! Reinforced ${key} capability by +${reward.amount}.`, "success");
    }
  } else if (reward.type === 'tool') {
    window.Game.unlockedTools = window.Game.unlockedTools || new Set();
    window.Game.unlockedTools.add(reward.key);
    if (typeof window.Game.applyUnlockedTools === 'function') window.Game.applyUnlockedTools();

    if (typeof ui_log_output === 'function') {
      ui_log_output(`🧰 Trade Successful! Equipped ${reward.label || reward.key}.`, "success");
    }
  } else if (reward.type === 'planet') {
    // Actually unlock the galaxy-map node the trade paid for (was a no-op that only set
    // planetClears[5]=0, which never touches the node's locked/disabled state).
    if (window.Game && typeof window.Game.unlockNextPlanetNode === 'function') {
      window.Game.unlockNextPlanetNode(reward.key);
    }
    if (typeof ui_log_output === 'function') {
      ui_log_output(`🛰️ Trade Successful! Astro-Navigator revealed Asteroid Forge coordinates!`, "success");
    }
  }

  // Play success sound
  if (typeof SFX !== 'undefined' && SFX.playSuccess) {
    SFX.playSuccess();
  }

  // Spawn starburst particles above player
  if (window.Game.player && typeof Particles !== 'undefined') {
    Particles.spawnBurst(window.Game.player.x + window.Game.player.w / 2, window.Game.player.y + window.Game.player.h / 2, npc.color, 12, 3, 3, 'glow');
  }

  // Re-save progress
  if (typeof saveLocalProgress === 'function') saveLocalProgress();

  // Refresh Trade Screen UI
  openTradeScreen(npc);
}
