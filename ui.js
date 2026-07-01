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
  btn.title = enabled ? "High-contrast readable text mode on" : "High-contrast readable text mode";
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
  appendRunObjectiveQueueCard(listContainer, game);
  appendLessonLensCard(listContainer, game);
  appendMissionLabQuestionCard(listContainer, game);
  appendWorldMasteryCrtCard(listContainer, game);
  appendVillageTrustCrtCard(listContainer, game);
  appendVillageQuestChainCrtCard(listContainer, game);
  appendAIStateRunContractCard(listContainer, game);
  appendAIStateLoggedCard(listContainer, game);
  appendVillageStateCrtCard(listContainer, game);
  appendVillageRequestCrtCard(listContainer, game);
  appendSignalStoryCrtCard(listContainer, game);
  appendSignalLabContractCard(listContainer, game);
  appendFrontierRivalCrtCard(listContainer, game);
  appendMissionMentorSignal(listContainer, game);
  appendStagedExperimentCard(listContainer, game);
  appendScienceDeltaCard(listContainer, game);
  appendScienceCheckpointTargetCard(listContainer, game);
  appendLabChainTargetCard(listContainer, game);
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

function appendHTML(parent, html) {
  if (!parent || !html) return;
  if (typeof parent.insertAdjacentHTML === 'function') {
    parent.insertAdjacentHTML('beforeend', html);
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof parent.appendChild === 'function') {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    parent.appendChild(holder);
  } else {
    parent.innerHTML = `${parent.innerHTML || ""}${html}`;
  }
}

function addRunObjectiveQueueItem(queue, seen, item) {
  if (!queue || !seen || !item || !item.title) return;
  const commandKey = item.command ? String(item.command).trim() : "";
  const key = item.key || (commandKey ? `cmd:${commandKey}` : `${item.label || "goal"}:${item.title}`);
  if (seen.has(key)) return;
  seen.add(key);
  queue.push({
    label: item.label || "NEXT",
    title: item.title,
    body: item.body || "",
    reward: item.reward || "",
    cta: item.cta || "",
    command: commandKey,
    kind: item.kind || null,
    source: item.source || "run-objective-queue",
    color: item.color || "#67e8f9",
    prediction: item.prediction || null,
    progress: item.progress && typeof item.progress === "object" ? item.progress : null,
    disabled: !!item.disabled,
    priority: queue.length + 1
  });
}

function getRunObjectiveQueue(game) {
  const queue = [];
  const seen = new Set();
  if (!game) return queue;

  const staged = getActiveStagedExperiment(game);
  if (staged) {
    const isFailureLab = staged.source === "failure-lab";
    addRunObjectiveQueueItem(queue, seen, {
      key: `staged:${staged.command}`,
      label: isFailureLab ? "REPAIR READY" : "READY TO TEST",
      title: staged.title || "Experiment staged",
      body: getStagedExperimentBody(staged),
      reward: getStagedExperimentSourceLabel(staged.source),
      cta: "RESTAGE",
      command: staged.command,
      kind: staged.kind || null,
      source: staged.source || (isFailureLab ? "failure-lab" : "staged-reminder"),
      color: isFailureLab ? "#facc15" : "#a7f3d0",
      prediction: staged.prediction || null
    });
  }

  const labQuestion = typeof getAttemptLogNextQuestion === "function" ? getAttemptLogNextQuestion(game) : null;
  if (labQuestion) {
    const command = labQuestion.kind === "prediction" ? "" : (labQuestion.command || "");
    addRunObjectiveQueueItem(queue, seen, {
      key: `lab-question:${labQuestion.kind || "mission"}:${labQuestion.title || ""}`,
      label: labQuestion.label || (command ? "NEXT TEST" : "PREDICT"),
      title: labQuestion.title || "Next lab question",
      body: labQuestion.body || "Run one focused experiment, then compare the evidence.",
      reward: command ? "Predict -> code -> test" : "Choose a hypothesis first",
      cta: command ? "STAGE TEST" : "PREDICT FIRST",
      command,
      kind: labQuestion.kind || "mission",
      source: "mission-lab-question",
      color: labQuestion.kind === "prediction" ? "#facc15" : "#67e8f9",
      disabled: !command
    });
  }

  const activeMission = typeof getActivePlatformerMission === "function" ? getActivePlatformerMission(game) : null;
  const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
  const lessonRows = fullMission ? getMissionLessonPhaseRows(game, fullMission) : [];
  const activePhase = Array.isArray(lessonRows) ? lessonRows.find(row => row && row.status === "active" && row.command) : null;
  if (activePhase) {
    addRunObjectiveQueueItem(queue, seen, {
      key: `lesson:${activeMission && activeMission.id ? activeMission.id : fullMission.id}:${activePhase.index}`,
      label: "LESSON PATH",
      title: activePhase.label || fullMission.title || "Lesson phase",
      body: activePhase.formula || activePhase.payoff || "Stage the focused lesson command and test the result.",
      reward: `${lessonRows.filter(row => row.status === "complete").length}/${lessonRows.length} phases`,
      cta: "STAGE LESSON",
      command: activePhase.command,
      kind: "lesson-phase",
      source: "lesson-phase",
      color: "#fbbf24"
    });
  }

  const signal = game.dailyInfo && game.dailyInfo.labContract ? game.dailyInfo : null;
  const signalCommand = signal && signal.labContract && signal.labContract.command ? String(signal.labContract.command).trim() : "";
  const signalProof = signalCommand && typeof getSignalLabProofStatus === "function" ? getSignalLabProofStatus(game, signalCommand) : null;
  if (signal && signalCommand && !(signalProof && signalProof.claimed)) {
    addRunObjectiveQueueItem(queue, seen, {
      key: `signal:${signalCommand}`,
      label: signal.isFrontier ? "FRONTIER LAB" : "DAILY SIGNAL",
      title: signal.labContract.title || signal.concept || "Signal Lab proof",
      body: signal.labContract.body || signal.concept || "Run the signal command and compare what changed.",
      reward: signal.isFrontier ? "Frontier proof + share code" : "Daily proof + share code",
      cta: signal.isFrontier ? "STAGE FRONTIER" : "STAGE SIGNAL",
      command: signalCommand,
      kind: signal.isFrontier ? "frontier-signal" : "daily-signal",
      source: "signal-lab-contract",
      color: signal.isFrontier ? "#c4b5fd" : "#67e8f9"
    });
  }

  const checkpoint = typeof getScienceCheckpointPreview === "function" ? getScienceCheckpointPreview(game) : null;
  if (checkpoint && checkpoint.command && !checkpoint.claimed) {
    addRunObjectiveQueueItem(queue, seen, {
      key: `science-checkpoint:${checkpoint.sourceKey || checkpoint.checkpoint || checkpoint.command}`,
      label: checkpoint.label || "NEXT CHECKPOINT",
      title: checkpoint.title || checkpoint.checkpoint || "Science checkpoint",
      body: `${checkpoint.statLine || "Target progress"} · ${checkpoint.gapLine || "Run one focused test."}`,
      reward: `${checkpoint.reward || "Science proof"} · ${checkpoint.checkpoint || "checkpoint"}`,
      cta: "STAGE CHECKPOINT",
      command: checkpoint.command,
      kind: "science-checkpoint",
      source: "science-checkpoint",
      color: "#bef264",
      progress: {
        value: checkpoint.progress,
        target: checkpoint.checkpointProgress,
        label: checkpoint.checkpoint || "checkpoint"
      }
    });
  }

  const codeConceptTarget = typeof getActiveCodeConceptTarget === "function" ? getActiveCodeConceptTarget(game) : null;
  if (codeConceptTarget && codeConceptTarget.command) {
    addRunObjectiveQueueItem(queue, seen, {
      key: `code-concept:${codeConceptTarget.concept}`,
      label: "CODE CONCEPT",
      title: `Collect ${codeConceptTarget.title}`,
      body: `${codeConceptTarget.body} Try ${codeConceptTarget.command}.`,
      reward: codeConceptTarget.reward,
      cta: "STAGE IDEA",
      command: codeConceptTarget.command,
      kind: codeConceptTarget.concept,
      source: "code-concept-target",
      color: "#93c5fd",
      progress: {
        value: codeConceptTarget.count,
        target: codeConceptTarget.total,
        label: `${codeConceptTarget.count}/${codeConceptTarget.total} ideas`
      }
    });
  }

  const labChain = typeof getLabChainTarget === "function" ? getLabChainTarget(game) : null;
  if (labChain && labChain.command) {
    const progress = typeof getLabChainProgressMeta === "function" ? getLabChainProgressMeta(game, labChain) : null;
    addRunObjectiveQueueItem(queue, seen, {
      key: `lab-chain:${labChain.command}`,
      label: labChain.label || "LAB CHAIN",
      title: labChain.title || "Make one fresh change",
      body: labChain.body || "Change one variable, run it, and compare the new result.",
      reward: labChain.reward || "Next new progress keeps the chain alive",
      cta: "STAGE CHAIN",
      command: labChain.command,
      kind: labChain.kind || "lab-chain",
      source: "lab-chain-target",
      color: labChain.state === "paused" ? "#cbd5e1" : "#67e8f9",
      progress
    });
  }

  return queue.slice(0, 4).map((item, index) => ({
    ...item,
    priority: index + 1
  }));
}

function appendCodeConceptQueueCartridge(row, item) {
  if (!row || !item || item.source !== "code-concept-target") return;
  const progress = item.progress && typeof item.progress === "object" ? item.progress : null;
  const total = Math.max(1, Math.floor(Number(progress && progress.target) || 4));
  const value = Math.max(0, Math.min(total, Math.floor(Number(progress && progress.value) || 0)));
  const cartridge = document.createElement("div");
  cartridge.className = "code-concept-cartridge";

  const head = document.createElement("div");
  head.className = "code-concept-cartridge-head";
  const label = document.createElement("span");
  label.textContent = `IDEA ${value}/${total}`;
  const concept = document.createElement("strong");
  concept.textContent = item.kind || "CODE";
  head.appendChild(label);
  head.appendChild(concept);
  cartridge.appendChild(head);

  const pips = document.createElement("div");
  pips.className = "code-concept-cartridge-pips";
  for (let i = 0; i < total; i++) {
    const pip = document.createElement("i");
    pip.className = `code-concept-pip${i < value ? " filled" : (i === value ? " next" : "")}`;
    pips.appendChild(pip);
  }
  cartridge.appendChild(pips);

  const body = document.createElement("p");
  body.textContent = `Lesson cartridge: ${item.title || "collect the next coding idea"}`;
  cartridge.appendChild(body);
  row.appendChild(cartridge);
}

function appendRunObjectiveProgress(row, item) {
  if (!row || !item || item.source === "code-concept-target") return;
  const progress = item.progress && typeof item.progress === "object" ? item.progress : null;
  if (!progress) return;

  const rawTotal = Math.max(1, Math.floor(Number(progress.total || progress.target) || 1));
  const total = Math.max(1, Math.min(6, rawTotal));
  const rawValue = Math.max(0, Math.floor(Number(progress.value) || 0));
  const value = Math.max(0, Math.min(total, rawTotal > total ? Math.round((rawValue / rawTotal) * total) : rawValue));
  const mode = String(progress.mode || item.source || item.kind || "progress").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const labelText = progress.label || `${rawValue}/${rawTotal}`;

  const wrap = document.createElement("div");
  wrap.className = `run-objective-progress ${mode}`;
  wrap.title = labelText;
  if (typeof wrap.setAttribute === "function") wrap.setAttribute("aria-label", labelText);

  const label = document.createElement("span");
  label.textContent = labelText;
  wrap.appendChild(label);

  const pips = document.createElement("div");
  pips.className = "run-objective-progress-pips";
  for (let i = 0; i < total; i++) {
    const pip = document.createElement("i");
    pip.className = `run-objective-progress-pip${i < value ? " filled" : (i === value ? " next" : "")}`;
    pips.appendChild(pip);
  }
  wrap.appendChild(pips);
  row.appendChild(wrap);
}

function getObjectiveLearningContract(item) {
  if (!item) return "";
  const raw = `${item.source || ""} ${item.action || ""} ${item.kind || ""} ${item.label || ""}`.toLowerCase();
  if (/code-concept/.test(raw)) return "Code idea -> concept card";
  if (/lab-chain/.test(raw)) return "Fresh test -> combo";
  if (/science-checkpoint/.test(raw)) return "Measure -> checkpoint";
  if (/lesson-path/.test(raw)) return "Observe -> Code -> Test";
  if (/ai-state/.test(raw) || /ai state/.test(raw)) return "state + event -> next state";
  if (/resume/.test(raw)) return "Hypothesis -> compare";
  if (/daily/.test(raw)) return "Fresh remix -> share code";
  if (/frontier/.test(raw)) return "Remix proof -> share code";
  if (/replay|next run/.test(raw)) return "One tweak -> better evidence";
  if (/radar|lab quest|formula/.test(raw)) return "Science proof -> formula card";
  if (/story|signal/.test(raw)) return "Signal clue -> next chapter";
  if (/village/.test(raw)) return "Help -> trust pact";
  if (/log|explain/.test(raw)) return "Evidence -> explanation";
  return "";
}

function appendRunObjectiveContract(row, item) {
  if (!row || !item) return;
  const contract = getObjectiveLearningContract(item);
  if (!contract) return;
  const line = document.createElement("div");
  line.className = "run-objective-contract";
  line.textContent = contract;
  row.appendChild(line);
}

function appendRunObjectiveQueueCard(listContainer, game) {
  if (!listContainer || !game) return;
  const queue = getRunObjectiveQueue(game);
  if (!queue.length) return;

  const card = document.createElement("div");
  card.className = "run-objective-queue-card";
  const head = document.createElement("div");
  head.className = "run-objective-queue-head";
  const label = document.createElement("span");
  label.textContent = "RUN OBJECTIVE QUEUE";
  const action = document.createElement("strong");
  action.textContent = queue[0].cta || "RUN NEXT";
  head.appendChild(label);
  head.appendChild(action);
  card.appendChild(head);

  const list = document.createElement("div");
  list.className = "run-objective-queue-list";
  queue.forEach(item => {
    const row = document.createElement("div");
    row.className = `run-objective-queue-item${item.disabled ? " disabled" : ""}${item.source === "code-concept-target" ? " code-concept-queue-item" : ""}${item.source === "lab-chain-target" ? " lab-chain-queue-item" : ""}`;

    const itemLabel = document.createElement("span");
    itemLabel.textContent = `#${item.priority} ${item.label}`;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const body = document.createElement("p");
    body.textContent = item.body;
    row.appendChild(itemLabel);
    row.appendChild(title);
    row.appendChild(body);
    appendRunObjectiveContract(row, item);

    if (item.reward || item.cta) {
      const reward = document.createElement("em");
      reward.textContent = `${item.reward || "Reward ready"}${item.cta ? ` · ${item.cta}` : ""}`;
      row.appendChild(reward);
    }

    appendCodeConceptQueueCartridge(row, item);
    appendRunObjectiveProgress(row, item);

    if (item.command && !item.disabled) {
      const code = document.createElement("code");
      code.textContent = item.command;
      row.appendChild(code);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "run-objective-queue-action-btn";
      button.textContent = item.cta || "STAGE";
      if (typeof button.addEventListener === "function") {
        button.addEventListener("click", () => stageScienceDeltaCommand(item.command, {
          title: item.title,
          kind: item.kind || null,
          source: item.source || "run-objective-queue",
          prediction: item.prediction || null,
          color: item.color || "#67e8f9",
          game
        }));
      }
      row.appendChild(button);
    }

    list.appendChild(row);
  });
  card.appendChild(list);
  listContainer.appendChild(card);
}

function getMissionLessonPhaseRows(game, fullMission) {
  const phases = fullMission && Array.isArray(fullMission.lessonPhases) ? fullMission.lessonPhases : [];
  if (!phases.length) return [];
  const rows = phases.map((phase, index) => {
    const locked = !!(phase.unlockAfterCheck && !missionResultCheckPassed(game, fullMission, phase.unlockAfterCheck));
    const checkState = !locked && phase.checkId ? getMissionResultCheckState(game, fullMission, phase.checkId) : null;
    const complete = !!(checkState && checkState.passed);
    const status = locked ? "locked" : (complete ? "complete" : "active");
    return {
      ...phase,
      index,
      status,
      statusLabel: status === "complete" ? "DONE" : (status === "locked" ? "LOCKED" : "NOW"),
      cueLabel: status === "complete" ? "PAYOFF" : (status === "locked" ? "LOCKED" : "SCIENCE"),
      detail: status === "locked"
        ? (phase.lockedHint || "Finish the previous phase to reveal this code.")
        : (status === "complete" ? (phase.payoff || phase.formula || "") : (phase.formula || phase.payoff || "")),
      command: status === "locked" ? "" : (phase.command || ""),
      proofLabel: checkState && checkState.label ? checkState.label : "",
      proofText: checkState && checkState.message ? checkState.message : ""
    };
  });
  const lastCompleteIndex = rows.reduce((best, row) => row.status === "complete" ? row.index : best, -1);
  const pathComplete = rows.length > 0 && rows.every(row => row.status === "complete");
  return rows.map(row => {
    const nextActive = row.index === lastCompleteIndex
      ? rows.find(item => item.index > row.index && item.status === "active")
      : null;
    return {
      ...row,
      unlockLabel: nextActive
        ? `UNLOCKED: ${nextActive.label || `Phase ${nextActive.index + 1}`}`
        : (pathComplete && row.index === lastCompleteIndex ? "PATH COMPLETE" : "")
    };
  });
}

function renderMissionLessonPhaseLadder(game, fullMission, label = "LESSON PATH") {
  const rows = getMissionLessonPhaseRows(game, fullMission);
  if (!rows.length) return "";
  const completeCount = rows.filter(row => row.status === "complete").length;
  return `
    <div class="lesson-phase-ladder">
      <div class="lesson-phase-head">
        <span>${escapeHTML(label)}</span>
        <div class="lesson-phase-progress" aria-label="${escapeHTML(`${completeCount}/${rows.length} lesson phases complete`)}">
          <strong>${escapeHTML(String(completeCount))}/${escapeHTML(String(rows.length))}</strong>
          <div class="lesson-phase-pips">
            ${rows.map(row => `<i class="lesson-phase-pip ${escapeHTML(row.status)}" title="${escapeHTML(`${row.statusLabel}: ${row.label || `Phase ${row.index + 1}`}`)}" aria-hidden="true"></i>`).join("")}
          </div>
        </div>
      </div>
      <div class="lesson-phase-steps">
        ${rows.map(row => `
          <div class="lesson-phase-step ${escapeHTML(row.status)}">
            <span>${escapeHTML(row.statusLabel)}</span>
            <strong>${escapeHTML(row.label || `Phase ${row.index + 1}`)}</strong>
            <div class="lesson-phase-detail"><b>${escapeHTML(row.cueLabel || "SCIENCE")}</b><em>${escapeHTML(row.detail || "")}</em></div>
            ${row.unlockLabel ? `<div class="lesson-phase-unlock">${escapeHTML(row.unlockLabel)}</div>` : ""}
            ${row.proofText ? `<div class="lesson-phase-proof ${escapeHTML(row.status)}"><b>PROOF</b><span>${escapeHTML(row.proofText)}</span></div>` : ""}
            ${row.command ? `<code>${escapeHTML(row.command)}</code>` : ""}
            ${row.status === "active" && row.command ? `<button type="button" class="lesson-phase-stage-btn" data-lesson-phase-stage="${escapeHTML(String(row.index))}">STAGE</button>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function attachLessonPhaseStageButtons(root, game, fullMission) {
  if (!root || typeof root.querySelectorAll !== "function" || !game || !fullMission) return;
  const rows = getMissionLessonPhaseRows(game, fullMission);
  root.querySelectorAll("[data-lesson-phase-stage]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const index = button.dataset ? Number(button.dataset.lessonPhaseStage) : NaN;
      const row = Number.isFinite(index) ? rows[index] : null;
      const command = row && row.status === "active" ? String(row.command || "").trim() : "";
      if (!command || typeof stageScienceDeltaCommand !== "function") return false;
      return stageScienceDeltaCommand(command, {
        title: row.label || fullMission.title || "Lesson phase",
        kind: "lesson-phase",
        source: "lesson-phase",
        color: "#fbbf24"
      });
    });
  });
}

function getLessonPathMasterySourceKey(missionId) {
  return `lesson-path:${String(missionId || "mission").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`;
}

function grantLessonPathMastery(game, fullMission, phaseResult, rows, pulse = null) {
  if (!game || !fullMission || !phaseResult || !Array.isArray(rows) || !rows.length) return null;
  if (!rows.every(row => row && row.status === "complete")) return null;
  const missionId = phaseResult.missionId || fullMission.id || "mission";
  const sourceKey = getLessonPathMasterySourceKey(missionId);
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === "function") {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (game.discoveryPassCounts[sourceKey] || (masterySources && masterySources[sourceKey])) {
    game.discoveryPassCounts[sourceKey] = 1;
    return null;
  }

  const rewardXP = 8;
  const masteryXP = 16;
  const beforeRank = (typeof getResearchRank === "function") ? getResearchRank(game.researchXP || 0) : null;
  const mastery = typeof game.awardWorldMasteryXP === "function"
    ? game.awardWorldMasteryXP(masteryXP, "lesson path mastery", { sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[sourceKey] = 1;
    return null;
  }
  game.discoveryPassCounts[sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  const afterRank = (typeof getResearchRank === "function") ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const result = {
    label: "LESSON PATH COMPLETE",
    missionId,
    missionTitle: fullMission.title || "Lesson path",
    sourceKey,
    phases: rows.length,
    rewardXP,
    worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
    rankUp,
    rankTitle: afterRank ? afterRank.title : null,
    rankPerk: rankUp && afterRank ? afterRank.perk : null
  };
  phaseResult.lessonPathMastery = result;
  if (pulse) {
    pulse.lessonPathMastery = result;
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    if (rankUp) {
      pulse.rankUp = true;
      pulse.rankTitle = afterRank.title;
      pulse.rankPerk = afterRank.perk;
      if (typeof showBadgeToast === "function") {
        showBadgeToast({
          icon: "LP",
          label: `Research Rank: ${afterRank.title}`,
          description: `Lesson Path Mastery unlocked ${afterRank.perk.label}.`
        });
      }
      if (typeof game.spawnResearchRankEffect === "function") {
        pulse.rankEffect = game.spawnResearchRankEffect(pulse);
      }
    }
  }
  if (typeof ui_log_output === "function") {
    const masteryText = result.worldMasteryAddedXP > 0 ? `, +${result.worldMasteryAddedXP} world mastery XP` : "";
    ui_log_output(`Lesson path complete: +${rewardXP} Research XP${masteryText}.`, "success");
  }
  if (typeof game.showMissionBalloon === "function") {
    game.showMissionBalloon(`LESSON PATH COMPLETE: +${rewardXP} Research XP`, {
      title: "LESSON PATH",
      color: "#fbbf24",
      timer: 280
    });
  }
  if (game.player && typeof ComicBubbles !== "undefined" && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 72, "PATH COMPLETE!", "#fbbf24", 1.02);
    ComicBubbles.pop(px, py - 52, `+${rewardXP} LAB XP`, "#a7f3d0", 0.72);
    if (typeof Particles !== "undefined" && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 8, "#fbbf24", 16, 2.4, 2.1, "glow");
      Particles.spawnBurst(px, py - 8, "#a7f3d0", 8, 1.8, 1.7, "glow");
    }
  }
  if (typeof updateResearchProgress === "function") updateResearchProgress(game);
  if (typeof saveLocalProgress === "function" && typeof window !== "undefined" && window.Game === game) saveLocalProgress();
  return result;
}

function recordLessonPhaseAdvance(game, activeMission, resultState, pulse = null) {
  const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
  if (!game || !fullMission || !Array.isArray(fullMission.lessonPhases) || !resultState || !Array.isArray(resultState.items)) return null;
  const rows = getMissionLessonPhaseRows(game, fullMission);
  if (!rows.length) return null;
  const passedIds = new Set(resultState.items.filter(item => item && item.passed).map(item => item.id));
  const missionId = activeMission.id || fullMission.id || "mission";
  game.lessonPhaseNotices = game.lessonPhaseNotices || {};
  const completed = rows.find(row => {
    const key = `${missionId}:${row.id || row.checkId || row.index}`;
    return row.status === "complete" && row.checkId && passedIds.has(row.checkId) && !game.lessonPhaseNotices[key];
  });
  if (!completed) return null;

  const sourceKey = `${missionId}:${completed.id || completed.checkId || completed.index}`;
  game.lessonPhaseNotices[sourceKey] = 1;
  const next = rows.find(row => row.status === "active" && row.id !== completed.id) || null;
  const result = {
    label: "PHASE DONE",
    missionId,
    phaseId: completed.id || completed.checkId || String(completed.index),
    title: completed.label || "Lesson phase",
    nextTitle: next ? (next.label || "Next phase") : null,
    nextCommand: next ? (next.command || "") : "",
    nextFormula: next ? (next.formula || "") : "",
    command: completed.command || "",
    formula: completed.formula || "",
    payoff: completed.payoff || "",
    sourceKey
  };
  game.lastLessonPhaseAdvance = result;
  if (pulse) {
    pulse.lessonPhaseAdvance = result;
  }

  const nextText = result.nextTitle ? ` Next: ${result.nextTitle}.` : " Lesson path complete.";
  if (typeof ui_log_output === 'function') {
    ui_log_output(`Lesson phase complete: ${result.title}.${nextText}`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`PHASE DONE: ${result.title}${result.nextTitle ? ` -> ${result.nextTitle}` : ""}`, {
      title: "LESSON PATH",
      color: "#fbbf24",
      timer: 230
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 54, "PHASE DONE!", "#fbbf24", 0.94);
    if (result.nextTitle) ComicBubbles.pop(px, py - 36, `NEXT: ${String(result.nextTitle).replace(/^\d+\s*/, "").toUpperCase()}`, "#a7f3d0", 0.7);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 4, "#fbbf24", 10, 2.0, 1.8, "glow");
      Particles.spawnBurst(px, py - 4, "#67e8f9", 6, 1.5, 1.5, "glow");
    }
  }
  grantLessonPathMastery(game, fullMission, result, rows, pulse);
  if (pulse) updateDiscoveryPulse(game);
  return result;
}

function appendLessonLensCard(listContainer, game) {
  if (!listContainer || !game) return;
  const activeMission = getActivePlatformerMission(game);
  const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
  if (!fullMission) return;

  const card = document.createElement("div");
  card.className = "lesson-lens-card";

  const head = document.createElement("div");
  head.className = "lesson-lens-head";

  const label = document.createElement("span");
  label.textContent = "LESSON LENS";

  const concept = document.createElement("strong");
  concept.textContent = fullMission.codingConcept || fullMission.title || "Code + science";

  head.appendChild(label);
  head.appendChild(concept);
  card.appendChild(head);

  const body = document.createElement("p");
  body.textContent = fullMission.beginnerConcept || fullMission.concept || "Tune one idea, test the motion, then explain what changed.";
  card.appendChild(body);

  const scaffold = fullMission.scaffold || {};
  const cueText = scaffold.codeIdea || scaffold.physicsIdea || fullMission.objective || "";
  if (cueText) {
    const cue = document.createElement("code");
    cue.textContent = cueText;
    card.appendChild(cue);
  }

  appendHTML(card, renderMissionLessonPhaseLadder(game, fullMission));
  attachLessonPhaseStageButtons(card, game, fullMission);

  const selectedPrediction = game.coachPredictions ? game.coachPredictions[activeMission.id] : null;
  const needsPrediction = !!(fullMission.prediction && !selectedPrediction);
  const starterCode = buildNextExperimentCommand(fullMission, null, game);
  if (fullMission.prediction || starterCode) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "lesson-lens-stage-btn";
    action.textContent = needsPrediction ? "PREDICT FIRST" : "STAGE LESSON CODE";
    action.disabled = needsPrediction || !starterCode;
    if (!action.disabled && typeof action.addEventListener === "function") {
      action.addEventListener("click", () => stageScienceDeltaCommand(starterCode, {
        title: fullMission.title || "Lesson code",
        source: "lesson-lens",
        color: "#67e8f9"
      }));
    }
    card.appendChild(action);
  }

  listContainer.appendChild(card);
}

function appendMissionLabQuestionCard(listContainer, game) {
  if (!listContainer || !game || typeof getAttemptLogNextQuestion !== "function") return;
  const cue = getAttemptLogNextQuestion(game);
  if (!cue) return;

  const card = document.createElement("div");
  card.className = `mission-lab-question-card ${cue.kind || "mission"}`;

  const head = document.createElement("div");
  head.className = "mission-lab-question-head";
  const label = document.createElement("span");
  label.textContent = cue.label || "NEXT";
  const title = document.createElement("strong");
  title.textContent = cue.title || "Next lab question";
  head.appendChild(label);
  head.appendChild(title);
  card.appendChild(head);

  const body = document.createElement("p");
  body.textContent = cue.body || "Run one focused experiment, then compare the evidence.";
  card.appendChild(body);

  if (cue.command) {
    const code = document.createElement("code");
    code.textContent = cue.command;
    card.appendChild(code);

    const stage = document.createElement("button");
    stage.type = "button";
    stage.className = "mission-lab-question-stage-btn";
    stage.textContent = cue.kind === "prediction" ? "STAGE AFTER PREDICT" : "STAGE TEST";
    stage.disabled = cue.kind === "prediction";
    if (!stage.disabled && typeof stage.addEventListener === "function") {
      stage.addEventListener("click", () => stageScienceDeltaCommand(cue.command, {
        title: cue.title || "Lab question",
        kind: cue.kind || "mission",
        source: "mission-lab-question",
        color: "#67e8f9"
      }));
    }
    card.appendChild(stage);
  }

  listContainer.appendChild(card);
}

function appendWorldMasteryCrtCard(listContainer, game) {
  if (!listContainer || !game || typeof game.getWorldMasteryProgress !== "function") return;
  const progress = game.getWorldMasteryProgress(game.currentPlanetIndex);
  if (!progress) return;

  const currentXP = Math.max(0, Math.floor(Number(progress.xp) || 0));
  const currentTierXP = progress.currentTier ? Math.max(0, Number(progress.currentTier.xp) || 0) : 0;
  const nextTierXP = progress.nextTier ? Math.max(1, Number(progress.nextTier.xp) || 1) : Math.max(1, currentXP || 1);
  const span = Math.max(1, nextTierXP - currentTierXP);
  const tierPct = progress.nextTier ? Math.max(0, Math.min(100, Math.round(((currentXP - currentTierXP) / span) * 100))) : 100;
  const nextText = progress.nextTier
    ? `${Math.max(0, nextTierXP - currentXP)} XP to ${progress.nextTier.label}`
    : "Max world tier reached";

  const card = document.createElement("div");
  card.className = "world-mastery-crt-card";
  const planetName = game.currentPlanet && game.currentPlanet.name ? game.currentPlanet.name : "This world";
  card.innerHTML = `
    <div class="world-mastery-crt-head">
      <span>WORLD MASTERY</span>
      <strong>${escapeHTML(progress.title || "Unranked")} · ${currentXP} XP</strong>
    </div>
    <div class="world-mastery-crt-bar" aria-label="${escapeHTML(String(tierPct))}% toward next world mastery tier"><i style="width: ${tierPct}%"></i></div>
    <div class="world-mastery-crt-body">
      <strong>${escapeHTML(nextText)}</strong>
      <p>${escapeHTML(planetName)} mastery grows from new tasks, samples, science proof, rescues, and remixes.</p>
    </div>
  `;
  listContainer.appendChild(card);
}

function getVillageTrustCrtPreview(game) {
  if (!game || typeof game.getVillageTrustProgress !== "function") return null;
  const progress = game.getVillageTrustProgress(game.currentPlanetIndex);
  if (!progress) return null;
  const currentPoints = Math.max(0, Math.floor(Number(progress.points) || 0));
  const currentTierPoints = progress.currentTier ? Math.max(0, Number(progress.currentTier.points) || 0) : 0;
  const nextTierPoints = progress.nextTier ? Math.max(1, Number(progress.nextTier.points) || 1) : Math.max(1, currentPoints || 1);
  const span = Math.max(1, nextTierPoints - currentTierPoints);
  const tierPct = progress.nextTier ? Math.max(0, Math.min(100, Math.round(((currentPoints - currentTierPoints) / span) * 100))) : 100;
  const nextText = progress.nextTier
    ? `${Math.max(0, nextTierPoints - currentPoints)} trust to ${progress.nextTier.label}`
    : "Max village trust reached";
  const pact = progress.nextPact || null;
  let action = pact ? pact.title : "Mentor status online";
  let body = pact
    ? `${nextText}. ${pact.title}: ${pact.action}. ${pact.concept}.`
    : "The village trusts this cadet. Keep using trades, pets, and rescues as evidence for how game systems remember helpful choices.";
  if (!progress.nextTier) {
    action = "Mentor status online";
    body = "The village trusts this cadet. Keep using trades, pets, and rescues as evidence for how game systems remember helpful choices.";
  }
  return {
    title: progress.title || "New Arrival",
    points: currentPoints,
    tierPct,
    nextText,
    action,
    body
  };
}

function appendVillageTrustCrtCard(listContainer, game) {
  if (!listContainer || !game) return;
  const preview = getVillageTrustCrtPreview(game);
  if (!preview) return;

  const card = document.createElement("div");
  card.className = "village-trust-crt-card";
  card.innerHTML = `
    <div class="village-trust-crt-head">
      <span>VILLAGE TRUST</span>
      <strong>${escapeHTML(preview.title)} · ${escapeHTML(String(preview.points))}</strong>
    </div>
    <div class="village-trust-crt-bar" aria-label="${escapeHTML(String(preview.tierPct))}% toward next village trust tier"><i style="width: ${escapeHTML(String(preview.tierPct))}%"></i></div>
    <div class="village-trust-crt-body">
      <strong>${escapeHTML(preview.nextText)} · ${escapeHTML(preview.action)}</strong>
      <p>${escapeHTML(preview.body)}</p>
    </div>
  `;
  listContainer.appendChild(card);
}

function getVillageProofSources(game, index) {
  const key = String(Number.isFinite(index) ? index : 0);
  let trustSources = {};
  if (game && typeof game.normalizeVillageTrust === "function") {
    const meter = game.normalizeVillageTrust(Number(key));
    trustSources = meter && meter.sources && typeof meter.sources === "object" ? meter.sources : {};
  } else if (game && game.villageTrust) {
    const meter = game.villageTrust[key] || game.villageTrust[Number(key)] || {};
    trustSources = meter.sources && typeof meter.sources === "object" ? meter.sources : {};
  }
  const discovery = game && game.discoveryPassCounts && typeof game.discoveryPassCounts === "object"
    ? game.discoveryPassCounts
    : {};
  return Array.from(new Set(Object.keys(trustSources).concat(Object.keys(discovery))));
}

function getVillageQuestChainPreview(game, indexOverride = null) {
  if (!game || typeof game.getVillageTrustProgress !== "function") return null;
  const index = Number.isFinite(Number(indexOverride))
    ? Number(indexOverride)
    : (Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0);
  const progress = game.getVillageTrustProgress(index);
  if (!progress) return null;
  const hasActiveVillage = index === Number(game.currentPlanetIndex) && Array.isArray(game.interactiveObjects)
    ? game.interactiveObjects.some(obj => obj && (obj.profession || (Array.isArray(obj.trades) && obj.trades.length)))
    : false;
  const planetVillage = typeof PLANETS !== "undefined" && PLANETS[index] && Array.isArray(PLANETS[index].npcs) && PLANETS[index].npcs.length > 0;
  if (!hasActiveVillage && !planetVillage && !(progress.points > 0)) return null;

  const planetKey = String(index);
  const sources = getVillageProofSources(game, index);
  const hasSource = (prefix) => sources.some(source => String(source).indexOf(prefix) === 0);
  const steps = [
    {
      id: "trade",
      label: "Trade",
      concept: "Resource flow",
      formula: "samples -> trade -> tool",
      body: "Spend one local sample with a villager, then test the new tool or upgrade.",
      done: hasSource(`village-trade:${planetKey}:`)
    },
    {
      id: "rescue",
      label: "Rescue",
      concept: "State machine",
      formula: "danger -> cave -> safe",
      body: "Clear danger so a hidden villager can leave the cave and return to trading.",
      done: hasSource(`village-rescue:${planetKey}:`)
    },
    {
      id: "guard",
      label: "Guard",
      concept: "Pet AI",
      formula: "scared -> pet -> guard",
      body: "Train a pet or let a pet intercept a hostile mob to prove an AI state change.",
      done: hasSource(`pet:guard:${planetKey}`)
    }
  ];
  const doneCount = steps.filter(step => step.done).length;
  const next = steps.find(step => !step.done) || null;
  const guardianPactDone = hasSource(`village-pact:${planetKey}:guardian`);
  return {
    doneCount,
    total: steps.length,
    stateClass: doneCount >= steps.length ? "complete" : (doneCount > 0 ? "active" : "new"),
    title: next ? `Next: ${next.label} pact` : "Guardian village complete",
    body: next
      ? next.body
      : (guardianPactDone
        ? "This world has a complete village arc. Replay it in Daily Signals or mastery remixes."
        : "All three village proofs are ready. Build enough trust to trigger the Guardian Pact."),
    formula: next ? next.formula : "trade + rescue + guard",
    steps
  };
}

function appendVillageQuestChainCrtCard(listContainer, game) {
  if (!listContainer || !game) return;
  const preview = getVillageQuestChainPreview(game);
  if (!preview) return;

  const stepHTML = preview.steps.map(step => `
    <span class="${step.done ? "done" : "pending"}">
      <b>${step.done ? "OK" : "--"}</b>
      ${escapeHTML(step.label)}
      <em>${escapeHTML(step.concept)}</em>
    </span>
  `).join("");
  const card = document.createElement("div");
  card.className = `village-chain-crt-card ${preview.stateClass || "new"}`;
  card.innerHTML = `
    <div class="village-chain-crt-head">
      <span>VILLAGE QUEST CHAIN</span>
      <strong>${escapeHTML(String(preview.doneCount))}/${escapeHTML(String(preview.total))}</strong>
    </div>
    <div class="village-chain-crt-body">
      <strong>${escapeHTML(preview.title)}</strong>
      <code>${escapeHTML(preview.formula)}</code>
      <p>${escapeHTML(preview.body)}</p>
      <div class="village-chain-steps">${stepHTML}</div>
    </div>
  `;
  listContainer.appendChild(card);
}

function getActiveAIStateRunContract(game) {
  if (!game || !game.activeAIStateRun || typeof getAIStateDeckProgress !== 'function' || typeof getAIStateDeckAction !== 'function') return null;
  const route = game.activeAIStateRun;
  const progress = getAIStateDeckProgress(game);
  const card = progress && Array.isArray(progress.cards)
    ? progress.cards.find(item => item && item.id === route.cardId)
    : null;
  if (!card || card.earned) {
    game.activeAIStateRun = null;
    return null;
  }
  const action = getAIStateDeckAction(game, card.id);
  if (!action) {
    game.activeAIStateRun = null;
    return null;
  }
  const actionLevel = Number(action.levelIndex);
  const currentLevel = Number(game.currentPlanetIndex);
  if (Number.isFinite(actionLevel) && Number.isFinite(currentLevel) && actionLevel !== currentLevel) {
    game.activeAIStateRun = null;
    return null;
  }
  return { route, progress, card, action };
}

function appendAIStateRunContractCard(listContainer, game) {
  if (!listContainer || !game) return;
  const contract = getActiveAIStateRunContract(game);
  if (!contract) return;
  const { progress, card, action } = contract;
  const remaining = Math.max(0, Number(progress.total || 0) - Number(progress.earnedCount || 0));
  const cardEl = document.createElement("div");
  cardEl.className = "ai-state-run-crt-card";
  cardEl.innerHTML = `
    <div class="ai-state-run-crt-head">
      <span>AI PROOF RUN</span>
      <strong>${escapeHTML(String(progress.earnedCount))}/${escapeHTML(String(progress.total))} logged</strong>
    </div>
    <div class="ai-state-run-crt-body">
      <strong>${escapeHTML(card.title)} · ${escapeHTML(action.label || "RUN STATE")}</strong>
      <code>${escapeHTML(`state = ${card.state}`)}</code>
      <p>${escapeHTML(action.body || card.next || "Complete the visible behavior proof, then check the deck.")}</p>
      <em>${escapeHTML(`${card.concept || "State machine"} proof · ${remaining} state${remaining === 1 ? "" : "s"} left`)}</em>
    </div>
  `;
  listContainer.appendChild(cardEl);
}

function appendAIStateLoggedCard(listContainer, game) {
  if (!listContainer || !game || !game.lastAIStateRunProof) return;
  const proof = game.lastAIStateRunProof;
  const proofLevel = Number(proof.levelIndex);
  const currentLevel = Number(game.currentPlanetIndex);
  if (Number.isFinite(proofLevel) && Number.isFinite(currentLevel) && proofLevel !== currentLevel) return;
  const liveNextAction = !proof.complete && proof.nextCardId && typeof getAIStateDeckAction === 'function'
    ? getAIStateDeckAction(game, proof.nextCardId)
    : null;
  const nextTitle = proof.complete ? "Deck complete" : (proof.nextTitle || "Next state");
  const nextAction = proof.complete
    ? "All village behavior cards are logged. Replay them in Daily Signals or mastery runs."
    : ((liveNextAction && liveNextAction.body) || proof.nextActionBody || "Run the next behavior proof and watch the state change.");
  const nextActionLabel = (liveNextAction && liveNextAction.label) || proof.nextActionLabel || "RUN STATE";
  const codeLine = proof.complete
    ? "state deck = complete"
    : (proof.nextState ? `next state = ${proof.nextState}` : "state + event -> next state");

  const cardEl = document.createElement("div");
  cardEl.className = "ai-state-run-crt-card logged";
  cardEl.innerHTML = `
    <div class="ai-state-run-crt-head">
      <span>AI STATE LOGGED</span>
      <strong>${escapeHTML(proof.progress || "0/0 logged")}</strong>
    </div>
    <div class="ai-state-run-crt-body">
      <strong>${escapeHTML(proof.title || "AI state")} -> ${escapeHTML(nextTitle)}</strong>
      <code>${escapeHTML(codeLine)}</code>
      <p>${escapeHTML(nextAction)}</p>
      <em>${escapeHTML(proof.complete ? "Collection payoff complete" : `${nextActionLabel} · ${proof.concept || "State machine"}`)}</em>
    </div>
  `;
  if (!proof.complete && proof.nextCardId && typeof runAIStateDeckAction === 'function') {
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "ai-state-run-crt-action-btn";
    nextButton.textContent = nextActionLabel;
    if (typeof nextButton.addEventListener === "function") {
      nextButton.addEventListener("click", () => runAIStateDeckAction(proof.nextCardId, game));
    }
    cardEl.appendChild(nextButton);
  }
  listContainer.appendChild(cardEl);
}

function getVillageStateCrtPreview(game) {
  if (!game || !Array.isArray(game.interactiveObjects) || typeof NPC === 'undefined') return null;
  const villagers = game.interactiveObjects.filter(obj => obj instanceof NPC);
  if (!villagers.length) return null;

  let danger = 0;
  let night = 0;
  let hidden = 0;
  let rescueWait = 0;
  villagers.forEach(npc => {
    if (npc.hiddenInCave) hidden++;
    if (npc.rescuePending) rescueWait++;
    const signal = typeof game.getVillagerShelterSignal === 'function'
      ? game.getVillagerShelterSignal(npc)
      : null;
    const liveThreat = !!(signal && signal.threat);
    const nightShelter = !!((signal && signal.reason === "night") || npc.shelterReason === "night");
    const staleDanger = (npc.shelterReason === "nearby mob" || npc.shelterReason === "mob attack") && !nightShelter;
    if (liveThreat || staleDanger) danger++;
    else if (nightShelter) night++;
  });

  const petGuards = Array.isArray(game.mobs)
    ? game.mobs.filter(mob => mob && mob.pet).length
    : 0;
  const outside = Math.max(0, villagers.length - hidden);
  const countLine = `${hidden} cave · ${outside} outside · ${petGuards} pet guard${petGuards === 1 ? "" : "s"}`;

  if (danger > 0) {
    return {
      stateClass: "danger",
      label: "DANGER",
      title: `${danger}/${villagers.length} shelter signal${danger === 1 ? "" : "s"}`,
      transition: "mob.close -> cave",
      formula: "state + event -> next state",
      body: petGuards > 0
        ? "A pet can intercept the hostile mob; once danger clears, villagers return to trading."
        : "Clear mobs, tame a pet guard, or end Survival so villagers can safely return.",
      countLine
    };
  }
  if (night > 0) {
    return {
      stateClass: "night",
      label: "NIGHT",
      title: `${night}/${villagers.length} night shelter${night === 1 ? "" : "s"}`,
      transition: "night -> cave",
      formula: "state + event -> next state",
      body: "Earth villagers wait in caves during night, then switch back to trading at daylight.",
      countLine
    };
  }
  if (hidden > 0 || rescueWait > 0) {
    return {
      stateClass: "wait",
      label: "WAIT",
      title: `${hidden}/${villagers.length} checking safety`,
      transition: "danger.clear -> trade",
      formula: "state + event -> next state",
      body: "The cave and trading spot both need to be safe before the villager leaves shelter.",
      countLine
    };
  }
  return {
    stateClass: "safe",
    label: "SAFE",
    title: `${villagers.length}/${villagers.length} trading`,
    transition: "clear -> trade",
    formula: "state + event -> next state",
    body: "The village is open. Trades, rescues, and pet guards build the relationship state.",
    countLine
  };
}

function appendVillageStateCrtCard(listContainer, game) {
  if (!listContainer || !game) return;
  const preview = getVillageStateCrtPreview(game);
  if (!preview) return;

  const card = document.createElement("div");
  card.className = `village-state-crt-card ${preview.stateClass || "safe"}`;
  card.innerHTML = `
    <div class="village-state-crt-head">
      <span>VILLAGE STATE</span>
      <strong>${escapeHTML(preview.label)} · ${escapeHTML(preview.title)}</strong>
    </div>
    <div class="village-state-crt-body">
      <strong>${escapeHTML(preview.transition)}</strong>
      <code>${escapeHTML(preview.formula)}</code>
      <p>${escapeHTML(preview.body)}</p>
      <em>${escapeHTML(preview.countLine)}</em>
    </div>
  `;
  listContainer.appendChild(card);
}

function isVillageRequestVisible(game, npc) {
  if (!npc || npc.hiddenInCave || npc.rescuePending || npc.shelterReason) return false;
  const shelter = game && typeof game.getVillagerShelterSignal === 'function'
    ? game.getVillagerShelterSignal(npc)
    : null;
  return !(shelter && shelter.active);
}

function getVillageRequestCrtPreview(game) {
  if (!game || !Array.isArray(game.interactiveObjects)) return null;
  const playerX = game.player && Number.isFinite(game.player.x) ? game.player.x : null;
  const candidates = game.interactiveObjects
    .filter(npc => npc && Array.isArray(npc.trades) && npc.trades.length && isVillageRequestVisible(game, npc))
    .map(npc => {
      const request = getVillageTradeRequest(game, npc);
      if (!request) return null;
      const missing = Math.max(0, Math.floor(Number(request.missing) || 0));
      const distance = playerX === null || !Number.isFinite(npc.x) ? 0 : Math.abs(npc.x - playerX);
      const rank = request.ready ? 0 : (request.complete ? 20000 : 100 + missing);
      return { npc, request, missing, distance, rank };
    })
    .filter(Boolean)
    .sort((a, b) => (a.rank - b.rank) || (a.distance - b.distance));
  const best = candidates[0];
  if (!best) return null;

  const npcName = best.npc.name || "Village mentor";
  const request = best.request;
  const status = request.complete ? "COMPLETE" : (request.ready ? "READY TRADE" : "NEED SAMPLES");
  const stateClass = request.complete ? "complete" : (request.ready ? "ready" : "need");
  const formula = request.complete ? "sample -> tool -> replay" : "sample -> trade -> tool";
  return {
    stateClass,
    status,
    title: `${npcName}: ${request.title || "Village upgrade"}`,
    body: request.body || "Collect samples, trade with a villager, then test the new tool.",
    reward: request.reward || "Payoff: village upgrade",
    formula
  };
}

function appendVillageRequestCrtCard(listContainer, game) {
  if (!listContainer || !game) return;
  const preview = getVillageRequestCrtPreview(game);
  if (!preview) return;

  const card = document.createElement("div");
  card.className = `village-request-crt-card ${preview.stateClass || "need"}`;
  card.innerHTML = `
    <div class="village-request-crt-head">
      <span>VILLAGE REQUEST</span>
      <strong>${escapeHTML(preview.status)}</strong>
    </div>
    <div class="village-request-crt-body">
      <strong>${escapeHTML(preview.title)}</strong>
      <code>${escapeHTML(preview.formula)}</code>
      <p>${escapeHTML(preview.body)}</p>
      <em>${escapeHTML(preview.reward)}</em>
    </div>
  `;
  listContainer.appendChild(card);
}

function appendSignalStoryCrtCard(listContainer, game) {
  if (!listContainer || !game || typeof getSignalStoryProgress !== "function" || typeof getSignalStoryContract !== "function") return;
  const story = getSignalStoryProgress(game);
  const contract = getSignalStoryContract(game, story);
  if (!story || !contract) return;

  const next = story.nextChapter || null;
  const progressText = `${story.unlocked.length}/${story.total} decoded`;
  const signalTitle = next ? next.title : "Signal loop online";
  const concept = next ? next.concept : "Daily evidence keeps the lab alive";
  const body = contract.body ? `${contract.title} - ${contract.body}` : contract.title;
  const card = document.createElement("div");
  card.className = `signal-story-crt-card${next ? "" : " complete"}`;
  card.innerHTML = `
    <div class="signal-story-crt-head">
      <span>STAR-MAP SIGNAL</span>
      <strong>${escapeHTML(progressText)}</strong>
    </div>
    <div class="signal-story-crt-body">
      <strong>${escapeHTML(signalTitle)}</strong>
      <code>${escapeHTML(concept)}</code>
      <p>${escapeHTML(body)}</p>
      <em>${escapeHTML(contract.reward || "Reward: stronger science record")}</em>
    </div>
  `;
  listContainer.appendChild(card);
}

function setSignalLabReflectionContext(game, proofStatus) {
  if (!game || !proofStatus) return null;
  const contract = proofStatus.contract || {};
  const signal = proofStatus.signal || {};
  const darkMatterPrep = !!signal.darkMatterPrep;
  const darkMatterEcho = !!signal.darkMatterEcho;
  const futureSourcePrep = !!signal.futureSourcePrep;
  const context = {
    kind: "signal-lab",
    source: futureSourcePrep
      ? "Future Lab Source"
      : (darkMatterPrep
        ? "Dark Matter Prep"
        : (darkMatterEcho ? "Dark Matter Echo" : (proofStatus.isFrontier ? "Frontier Signal Lab" : "Daily Signal Lab"))),
    title: proofStatus.title || contract.title || "Signal Lab proof",
    concept: contract.concept || signal.concept || "Replay physics",
    command: proofStatus.command || contract.command || "",
    proofLabel: futureSourcePrep
      ? "SOURCE KEY TESTED"
      : (darkMatterPrep
        ? "DARK MATTER EVIDENCE"
        : (darkMatterEcho ? "DARK MATTER ECHO" : (proofStatus.isFrontier ? "FRONTIER LAB TESTED" : "SIGNAL LAB TESTED"))),
    proofSourceKey: proofStatus.sourceKey || ""
  };
  game.reflectionContext = context;
  return context;
}

function runSignalLabExplainAction(game, proofStatus = null) {
  const target = game || (typeof window !== 'undefined' ? window.Game : null);
  if (target && proofStatus) setSignalLabReflectionContext(target, proofStatus);
  if (target && typeof target.runClearExplainPrompt === 'function') {
    return target.runClearExplainPrompt({ preserveReflectionContext: true });
  }
  if (typeof switchMainMode === 'function') {
    switchMainMode('notebook');
    const response = typeof document !== 'undefined' ? document.getElementById("notebook-user-response") : null;
    if (response && typeof response.focus === 'function') response.focus();
    return true;
  }
  return false;
}

function appendSignalLabContractCard(listContainer, game) {
  if (!listContainer || !game || !game.dailyInfo || !game.dailyInfo.labContract) return;
  if (game.remixContext !== 'daily') return;
  const signal = game.dailyInfo;
  const contract = signal.labContract;
  const command = contract.command ? String(contract.command).trim() : "";
  if (!contract.title && !contract.body && !command) return;
  const isFrontier = !!signal.isFrontier;
  const futureSourcePrep = !!signal.futureSourcePrep;
  const darkMatterPrep = !!signal.darkMatterPrep;
  const proofStatus = command ? getSignalLabProofStatus(game, command) : null;
  const proofClaimed = !!(proofStatus && proofStatus.claimed);

  const card = document.createElement("div");
  card.className = `signal-lab-contract-card ${isFrontier ? "frontier" : "daily"}${proofClaimed ? " claimed" : ""}`;

  const head = document.createElement("div");
  head.className = "signal-lab-contract-head";
  const label = document.createElement("span");
  label.textContent = futureSourcePrep ? "SOURCE KEY" : (darkMatterPrep ? "DARK MATTER PREP" : (isFrontier ? "FRONTIER LAB" : "DAILY SIGNAL LAB"));
  const reward = document.createElement("strong");
  reward.textContent = futureSourcePrep
    ? "source rehearsal"
    : darkMatterPrep
    ? "curve evidence"
    : isFrontier
    ? `T${signal.tier || 1} · ${signal.shareCode || "frontier"}`
    : (signal.dateStr || signal.shareCode || "today");
  head.appendChild(label);
  head.appendChild(reward);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "signal-lab-contract-body";
  const title = document.createElement("strong");
  title.textContent = contract.title || "Replay lab focus";
  const copy = document.createElement("p");
  copy.textContent = contract.body || "Run one focused replay experiment and compare the evidence.";
  const concept = document.createElement("em");
  concept.textContent = contract.concept || signal.concept || "Physics remix";
  body.appendChild(title);
  body.appendChild(copy);
  body.appendChild(concept);
  if (proofClaimed) {
    const proof = document.createElement("div");
    proof.className = "signal-lab-contract-proof";
    proof.textContent = `${futureSourcePrep ? "SOURCE KEY PROOF LOGGED" : (isFrontier ? "FRONTIER PROOF LOGGED" : "PROOF LOGGED")} - explain the evidence in the Science Notebook.`;
    body.appendChild(proof);
  }
  card.appendChild(body);

  if (command) {
    const code = document.createElement("code");
    code.textContent = command;
    card.appendChild(code);

    if (proofClaimed) {
      const claimed = document.createElement("div");
      claimed.className = "signal-lab-contract-claimed";
      claimed.textContent = proofStatus && proofStatus.sourceKey ? "TESTED - proof saved" : "TESTED";
      card.appendChild(claimed);

      const explain = document.createElement("button");
      explain.type = "button";
      explain.className = "signal-lab-contract-explain-btn";
      explain.textContent = "EXPLAIN EVIDENCE";
      if (typeof explain.addEventListener === "function") {
        explain.addEventListener("click", () => runSignalLabExplainAction(game, proofStatus));
      }
      card.appendChild(explain);
    } else {
      const stage = document.createElement("button");
      stage.type = "button";
      stage.className = "signal-lab-contract-stage-btn";
      stage.textContent = "STAGE SIGNAL";
      if (typeof stage.addEventListener === "function") {
        stage.addEventListener("click", () => stageScienceDeltaCommand(command, {
          title: contract.title || "Signal lab",
          source: "signal-lab-contract",
          color: futureSourcePrep ? "#facc15" : (isFrontier ? "#c4b5fd" : "#67e8f9")
        }));
      }
      card.appendChild(stage);
    }
  }

  listContainer.appendChild(card);
}

function appendFrontierRivalCrtCard(listContainer, game) {
  if (!listContainer || !game || game.remixContext !== 'daily') return;
  const frontier = game.dailyInfo && game.dailyInfo.isFrontier ? game.dailyInfo : null;
  if (!frontier || typeof game.getFrontierRivalTarget !== 'function') return;
  const target = game.getFrontierRivalTarget(frontier);
  if (!target || target.state === "empty" || !target.entry) return;

  const entry = target.entry;
  const card = document.createElement("div");
  card.className = `frontier-rival-crt-card ${target.state === "leading" ? "leading" : "chase"}`;

  const head = document.createElement("div");
  head.className = "frontier-rival-crt-head";
  const label = document.createElement("span");
  label.textContent = "FRONTIER RIVAL";
  const title = document.createElement("strong");
  title.textContent = target.state === "leading"
    ? `You lead ${entry.pilot || "rival"}`
    : `Chase ${entry.pilot || "rival"}`;
  head.appendChild(label);
  head.appendChild(title);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "frontier-rival-crt-body";
  const copy = document.createElement("p");
  copy.textContent = target.label || "Beat the imported Frontier record.";
  const best = document.createElement("em");
  const timeText = Number.isFinite(entry.bestTime) ? ` · ${entry.bestTime.toFixed(1)}s` : "";
  best.textContent = `Target: ${entry.stars || 0}/3 Lab Stars${timeText} · ${entry.shareCode || frontier.shareCode || "Frontier"}`;
  body.appendChild(copy);
  body.appendChild(best);
  if (typeof game.getFrontierRivalLadderProgress === 'function') {
    const ladder = game.getFrontierRivalLadderProgress();
    if (ladder) {
      const ladderLine = document.createElement("em");
      ladderLine.textContent = ladder.complete
        ? `Ladder complete: ${ladder.proofCount} rival proofs logged`
        : `Next ladder: ${ladder.remaining} proof${ladder.remaining === 1 ? "" : "s"} to ${ladder.label} (+${ladder.rewardXP} XP)`;
      body.appendChild(ladderLine);
    }
  }
  card.appendChild(body);

  listContainer.appendChild(card);
}

const MENTOR_SIGNAL_PROFILES = {
  mass: {
    role: "Machinist Geary",
    mark: "E",
    line: "Less mass lets the same push accelerate Hopper harder; gravity still controls free fall.",
    reward: "Open lighter-build routes"
  },
  engine: {
    role: "Machinist Geary",
    mark: "E",
    line: "More engine force makes speed easier to earn, especially after mass drops.",
    reward: "Beat Agility gates"
  },
  jump: {
    role: "Springwright Selene",
    mark: "J",
    line: "Jump force launches better when the rover has less mass to lift.",
    reward: "Reach high samples"
  },
  antigravity: {
    role: "Magnetist Tesla",
    mark: "A",
    line: "Antigravity lowers felt weight so the same jump hangs longer.",
    reward: "Stretch jump arcs"
  },
  rocket: {
    role: "Booster Ion",
    mark: "R",
    line: "Rocket thrust must beat weight before Hopper can climb.",
    reward: "Climb gravity wells"
  },
  loop: {
    role: "Logician Bit-Byte",
    mark: "J",
    line: "A loop turns one command into a useful pattern.",
    reward: "Build bridges faster"
  },
  friction: {
    role: "Gripkeeper Cryo",
    mark: "G",
    line: "Friction turns sliding into control.",
    reward: "Stop on ice"
  },
  elasticity: {
    role: "Forgekeeper Anvil",
    mark: "F",
    line: "Mass starts the shove; elasticity decides how much rebound survives.",
    reward: "Keep bounce speed"
  },
  magnet: {
    role: "Magnetist Tesla",
    mark: "A",
    line: "Changing pole flips whether a magnetic field pulls or pushes.",
    reward: "Turn fields into lifts"
  },
  default: {
    role: "Vector",
    mark: "V",
    line: "Change one code idea, test the result, then explain the evidence.",
    reward: "Unlock the next lab signal"
  }
};

function getMissionMentorSignal(game) {
  if (!game) return null;
  const activeMission = getActivePlatformerMission(game);
  const target = getActiveFormulaTarget(game, activeMission);
  let rule = target || null;
  if (!rule) {
    const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
    const scaffold = fullMission && fullMission.scaffold ? scaffoldWithActiveSlots(fullMission.scaffold, game, fullMission) : null;
    const template = scaffold && scaffold.template ? scaffold.template : "";
    const missionRule = DISCOVERY_RULES
      .map(candidate => ({ candidate, index: patternIndexInText(candidate, template) }))
      .filter(item => item.index >= 0)
      .sort((a, b) => a.index - b.index)[0];
    rule = missionRule ? missionRule.candidate : null;
  }
  const profile = (rule && MENTOR_SIGNAL_PROFILES[rule.kind]) || MENTOR_SIGNAL_PROFILES.default;
  const title = rule ? rule.title : (activeMission && activeMission.fullMission ? activeMission.fullMission.title : "Current Lab");
  const move = rule && rule.move ? rule.move : "Run one focused code change";
  const payoff = rule && rule.payoff ? rule.payoff : profile.reward;
  return {
    kicker: "MENTOR SIGNAL",
    role: profile.role,
    mark: profile.mark,
    title,
    kind: rule && rule.kind ? rule.kind : null,
    body: `${profile.line} Code focus: ${move}.`,
    reward: `Payoff: ${payoff}`,
    sampleCode: rule && rule.sampleCode ? rule.sampleCode : ""
  };
}

function appendMissionMentorSignal(listContainer, game) {
  const signal = getMissionMentorSignal(game);
  if (!listContainer || !signal) return;

  const card = document.createElement("div");
  card.className = "mentor-signal-card";

  const head = document.createElement("div");
  head.className = "mentor-signal-head";
  const label = document.createElement("span");
  label.textContent = signal.kicker;
  const role = document.createElement("strong");
  role.textContent = signal.role;
  head.appendChild(label);
  head.appendChild(role);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "mentor-signal-body";
  const mark = document.createElement("span");
  mark.className = "mentor-signal-mark";
  mark.textContent = signal.mark;
  const copy = document.createElement("div");
  copy.className = "mentor-signal-copy";
  const title = document.createElement("strong");
  title.textContent = signal.title;
  const text = document.createElement("p");
  text.textContent = signal.body;
  const reward = document.createElement("em");
  reward.textContent = signal.reward;
  copy.appendChild(title);
  copy.appendChild(text);
  copy.appendChild(reward);
  if (signal.sampleCode) {
    const code = document.createElement("code");
    code.textContent = signal.sampleCode;
    copy.appendChild(code);
    const stage = document.createElement("button");
    stage.type = "button";
    stage.className = "mentor-signal-stage-btn";
    stage.textContent = "STAGE FOCUS";
    if (typeof stage.addEventListener === "function") {
      stage.addEventListener("click", () => stageScienceDeltaCommand(signal.sampleCode, {
        title: signal.title,
        kind: signal.kind,
        source: "mentor-signal",
        color: "#fdba74"
      }));
    }
    copy.appendChild(stage);
  }
  body.appendChild(mark);
  body.appendChild(copy);
  card.appendChild(body);

  listContainer.appendChild(card);
}

function getActiveStagedExperiment(game) {
  const staged = game && game.lastStagedExperiment;
  if (!staged || !staged.command) return null;
  const command = String(staged.command || "").trim();
  if (!command) return null;
  const lastRun = game && game.lastScienceDelta && game.lastScienceDelta.code
    ? String(game.lastScienceDelta.code || "").trim()
    : "";
  if (lastRun && lastRun === command) return null;
  return {
    title: staged.title || "Experiment staged",
    kind: staged.kind || null,
    source: staged.source || "stage-button",
    prediction: staged.prediction || null,
    command,
    time: staged.time || 0
  };
}

function getCompletedStagedExperiment(game) {
  const staged = game && game.lastStagedExperiment;
  const delta = game && game.lastScienceDelta;
  if (!staged || !delta || !staged.command || !delta.code) return null;
  const command = String(staged.command || "").trim();
  const code = String(delta.code || "").trim();
  if (!command || command !== code) return null;
  return {
    title: staged.title || "Experiment staged",
    kind: staged.kind || null,
    source: staged.source || "stage-button",
    prediction: staged.prediction || null,
    command,
    time: staged.time || 0
  };
}

function getStagedExperimentSourceLabel(source) {
  const labels = {
    "lesson-lens": "Lesson Lens",
    "lesson-phase": "Lesson phase",
    "phase-reward": "Phase reward",
    "cadet-lesson-path": "Cadet lesson",
    "run-objective-queue": "Objective queue",
    "mentor-signal": "Village mentor",
    "science-delta": "What Changed",
    "tested-result": "Tested result",
    "science-proof": "Science proof",
    "science-checkpoint": "Science checkpoint",
    "lab-chain-target": "Lab chain",
    "lab-chain-next": "Lab chain",
    "start-lab-chain": "Lab chain",
    "formula-focus": "Formula Deck",
    "formula-card-reward": "Formula reward",
    "formula-target": "Formula target",
    "code-concept-deck": "Code concept",
    "code-concept-target": "Code concept",
    "code-concept-reward": "Code concept",
    "clear-code-concept": "Code concept",
    "failure-lab": "Crash Lab",
    "signal-lab-contract": "Signal Lab",
    "start-anomaly-trace": "Anomaly Trace",
    "start-code-concept": "Code concept",
    "staged-reminder": "Mission CRT"
  };
  return labels[source] || "Mission CRT";
}

function getStagedExperimentBody(staged) {
  if (staged && staged.source === "failure-lab") {
    const prediction = staged.prediction ? ` Prediction: ${staged.prediction}.` : "";
    return `Press Enter to test this repair, then compare whether the telemetry matches the prediction.${prediction}`;
  }
  if (staged && staged.source === "signal-lab-contract") {
    return "Press Enter in Mission Coach to test this Signal Lab command, then compare what changed to bank proof.";
  }
  return "Press Enter in Mission Coach to run this experiment, then compare what changed.";
}

function getScienceDeltaChainBadge(game, delta) {
  const pulse = game && game.discoveryPulse;
  if (!pulse || !delta || !delta.code) return null;
  const pulseCode = String(pulse.code || "").trim();
  const deltaCode = String(delta.code || "").trim();
  if (!pulseCode || pulseCode !== deltaCode) return null;

  const combo = Math.max(0, Math.floor(Number(pulse.combo) || 0));
  const earned = (pulse.rewardXP || 0) > 0 || !!pulse.cardUnlocked || !!pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0;
  if (!earned) {
    return {
      state: "paused",
      label: "CHAIN PAUSED",
      title: "Repeat run logged",
      body: "New evidence needs one fresh checklist, sample gate, or formula change."
    };
  }
  if (combo > 1) {
    const bonus = (pulse.comboBonusXP || 0) + (pulse.comboAmplifierBonusXP || 0);
    return {
      state: "active",
      label: `LAB CHAIN x${combo}`,
      title: bonus > 0 ? `Combo evidence +${bonus} XP` : "New evidence added",
      body: "Keep the habit: stage one next variable, run it, compare the result."
    };
  }
  return {
    state: "ready",
    label: "CHAIN READY",
    title: "First evidence logged",
    body: "Change one variable next to turn this result into a lab chain."
  };
}

function getDiscoveryComboMilestoneStatus(game, combo = null) {
  const fallbackCombo = game && Number.isFinite(game.discoveryCombo) ? game.discoveryCombo : 0;
  const current = Math.max(0, Math.floor(Number(combo !== null && combo !== undefined ? combo : fallbackCombo) || 0));
  const milestone = game && typeof game.getNextDiscoveryComboMilestone === "function"
    ? game.getNextDiscoveryComboMilestone(current)
    : null;
  if (!milestone) return null;
  const label = milestone.label || "LAB CHAIN";
  const target = Math.max(1, Math.floor(Number(milestone.combo) || current + 1));
  const reward = Math.max(0, Math.floor(Number(milestone.rewardXP) || 0));
  const remaining = Math.max(0, Math.floor(Number(milestone.remaining) || (target - current)));
  const preview = remaining <= 1
    ? `Next milestone: ${label} at x${target} (+${reward} XP).`
    : `${remaining} fresh experiments to ${label} at x${target} (+${reward} XP).`;
  return { combo: current, label, target, reward, remaining, preview };
}

function getActiveLabChainMilestone(game) {
  const combo = Math.max(0, Math.floor(Number(game && game.discoveryCombo) || 0));
  if (combo <= 0) return null;
  return getDiscoveryComboMilestoneStatus(game, combo);
}

function getDiscoveryComboMilestonePreview(game, combo) {
  const status = getDiscoveryComboMilestoneStatus(game, combo);
  return status ? status.preview : "";
}

function getLabChainProgressMeta(game, labChain = null) {
  const pulseCombo = game && game.discoveryPulse ? Number(game.discoveryPulse.combo) : 0;
  const combo = Math.max(1, Math.floor(Number(game && game.discoveryCombo) || pulseCombo || Number(labChain && labChain.combo) || 1));
  const milestone = typeof getDiscoveryComboMilestoneStatus === "function"
    ? getDiscoveryComboMilestoneStatus(game, combo)
    : (typeof getActiveLabChainMilestone === "function" ? getActiveLabChainMilestone(game) : null);
  const targetCombo = Math.max(combo, Math.floor(Number(milestone && milestone.target) || combo + 1));
  const label = milestone && milestone.label ? `${combo}/${targetCombo} to ${milestone.label}` : `chain x${combo}`;
  return {
    mode: "lab-chain",
    value: combo,
    target: targetCombo,
    total: targetCombo,
    label
  };
}

function getLabChainTarget(game) {
  const pulse = game && game.discoveryPulse;
  const combo = Math.max(0, Math.floor(Number(pulse && pulse.combo) || 0));
  if (!pulse || combo <= 0) return null;

  const earned = (pulse.rewardXP || 0) > 0 || !!pulse.cardUnlocked || !!pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0;
  const activeMission = typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null;
  const fullMission = activeMission && activeMission.fullMission ? activeMission.fullMission : null;
  const delta = game && game.lastScienceDelta ? game.lastScienceDelta : null;
  const next = delta && delta.nextExperiment ? delta.nextExperiment : null;
  const formulaTarget = typeof getActiveFormulaTarget === 'function' ? getActiveFormulaTarget(game, activeMission) : null;
  const milestonePreview = getDiscoveryComboMilestonePreview(game, combo);

  let title = "Make one fresh change";
  let body = "Change one variable, run it, and compare the new result.";
  let command = "";
  let kind = null;

  if (next && (next.title || next.body || next.command)) {
    title = next.title || title;
    body = next.body || body;
    command = next.command || "";
  } else if (formulaTarget) {
    title = `Collect ${formulaTarget.title}`;
    body = formulaTarget.cue || formulaTarget.axis || body;
    command = formulaTarget.sampleCode || "";
    kind = formulaTarget.kind || null;
  } else if (fullMission) {
    title = fullMission.title || title;
    body = fullMission.scaffold && (fullMission.scaffold.codeIdea || fullMission.scaffold.physicsIdea)
      ? (fullMission.scaffold.codeIdea || fullMission.scaffold.physicsIdea)
      : (fullMission.beginnerConcept || body);
    command = typeof buildNextExperimentCommand === 'function' ? buildNextExperimentCommand(fullMission, null, game) : (fullMission.starterCode || "");
  }

  if (!earned) {
    return {
      state: "paused",
      label: "CHAIN PAUSED",
      reward: "Repeat logged - change one new target",
      title,
      body: `Repeat commands do not extend the chain. ${body}${milestonePreview ? ` ${milestonePreview}` : ""}`,
      command,
      kind
    };
  }

  if (combo > 1) {
    return {
      state: "active",
      label: `LAB CHAIN x${combo}`,
      reward: `Next new progress can reach x${Math.min(99, combo + 1)}`,
      title,
      body: milestonePreview ? `${body} ${milestonePreview}` : body,
      command,
      kind
    };
  }

  return {
    state: "ready",
    label: "CHAIN READY",
    reward: "Next new progress starts x2 combo",
    title,
    body: milestonePreview ? `${body} ${milestonePreview}` : body,
    command,
    kind
  };
}

function appendLabChainTargetCard(listContainer, game) {
  const target = getLabChainTarget(game);
  if (!listContainer || !target) return;

  const card = document.createElement("div");
  card.className = `lab-chain-target-card ${target.state || "ready"}`;

  const head = document.createElement("div");
  head.className = "lab-chain-target-head";
  const label = document.createElement("span");
  label.textContent = target.label;
  const reward = document.createElement("strong");
  reward.textContent = target.reward;
  head.appendChild(label);
  head.appendChild(reward);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "lab-chain-target-body";
  const title = document.createElement("strong");
  title.textContent = target.title;
  const copy = document.createElement("p");
  copy.textContent = target.body;
  body.appendChild(title);
  body.appendChild(copy);
  card.appendChild(body);

  if (target.command) {
    const code = document.createElement("code");
    code.textContent = target.command;
    card.appendChild(code);

    const stage = document.createElement("button");
    stage.type = "button";
    stage.className = "lab-chain-target-stage-btn";
    stage.textContent = "STAGE CHAIN";
    if (typeof stage.addEventListener === "function") {
      stage.addEventListener("click", () => stageScienceDeltaCommand(target.command, {
        title: target.title,
        kind: target.kind,
        source: "lab-chain-target",
        color: "#67e8f9"
      }));
    }
    card.appendChild(stage);
  }

  listContainer.appendChild(card);
}

function appendScienceCheckpointTargetCard(listContainer, game) {
  const target = getScienceCheckpointPreview(game);
  if (!listContainer || !target) return;

  const card = document.createElement("div");
  card.className = `science-checkpoint-target-card${target.claimed ? " claimed" : ""}`;

  const head = document.createElement("div");
  head.className = "science-checkpoint-target-head";
  const label = document.createElement("span");
  label.textContent = target.label;
  const reward = document.createElement("strong");
  reward.textContent = target.reward;
  head.appendChild(label);
  head.appendChild(reward);
  card.appendChild(head);

  const title = document.createElement("strong");
  title.className = "science-checkpoint-target-title";
  title.textContent = target.title;
  card.appendChild(title);

  const rail = document.createElement("div");
  rail.className = "science-checkpoint-target-rail";
  if (typeof rail.setAttribute === "function") {
    rail.setAttribute("aria-label", `${Math.round(target.progress * 100)}% toward ${target.checkpoint}`);
  }
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(target.progress * 100)}%`;
  const marker = document.createElement("i");
  marker.style.left = `${Math.round(target.checkpointProgress * 100)}%`;
  rail.appendChild(fill);
  rail.appendChild(marker);
  card.appendChild(rail);

  const body = document.createElement("p");
  body.textContent = `${target.statLine} · ${target.gapLine}`;
  card.appendChild(body);

  const checkpoint = document.createElement("em");
  checkpoint.textContent = `Checkpoint: ${target.checkpoint}`;
  card.appendChild(checkpoint);

  if (target.command) {
    const code = document.createElement("code");
    code.textContent = target.command;
    card.appendChild(code);

    const stage = document.createElement("button");
    stage.type = "button";
    stage.className = "science-checkpoint-target-stage-btn";
    stage.textContent = "STAGE CHECKPOINT";
    if (typeof stage.addEventListener === "function") {
      stage.addEventListener("click", () => stageScienceDeltaCommand(target.command, {
        title: target.commandTitle,
        kind: "science-checkpoint",
        source: "science-checkpoint",
        color: "#bef264"
      }));
    }
    card.appendChild(stage);
  }

  listContainer.appendChild(card);
}

function appendStagedExperimentCard(listContainer, game) {
  const staged = getActiveStagedExperiment(game);
  if (!listContainer || !staged) return;

  const card = document.createElement("div");
  const isFailureLab = staged.source === "failure-lab";
  card.className = `staged-experiment-card${isFailureLab ? " failure-lab" : ""}`;

  const head = document.createElement("div");
  head.className = "staged-experiment-head";
  const label = document.createElement("span");
  label.textContent = isFailureLab ? "REPAIR PROOF READY" : "READY TO TEST";
  const source = document.createElement("strong");
  source.textContent = getStagedExperimentSourceLabel(staged.source);
  head.appendChild(label);
  head.appendChild(source);
  card.appendChild(head);

  const title = document.createElement("strong");
  title.className = "staged-experiment-title";
  title.textContent = staged.title;
  card.appendChild(title);

  const body = document.createElement("p");
  body.textContent = getStagedExperimentBody(staged);
  card.appendChild(body);

  if (staged.prediction) {
    const prediction = document.createElement("em");
    prediction.className = "staged-experiment-prediction";
    prediction.textContent = `predict: ${staged.prediction}`;
    card.appendChild(prediction);
  }

  const code = document.createElement("code");
  code.textContent = staged.command;
  card.appendChild(code);

  const restage = document.createElement("button");
  restage.type = "button";
  restage.className = "staged-experiment-stage-btn";
  restage.textContent = "RESTAGE";
  if (typeof restage.addEventListener === "function") {
    restage.addEventListener("click", () => stageScienceDeltaCommand(staged.command, {
      title: staged.title,
      kind: staged.kind,
      source: isFailureLab ? "failure-lab" : "staged-reminder",
      prediction: staged.prediction || null,
      color: isFailureLab ? "#facc15" : "#a7f3d0"
    }));
  }
  card.appendChild(restage);

  listContainer.appendChild(card);
}

function appendScienceDeltaCard(listContainer, game) {
  const delta = game && game.lastScienceDelta;
  if (!listContainer || !delta || !Array.isArray(delta.changes) || delta.changes.length === 0) return;
  const tested = getCompletedStagedExperiment(game);

  const card = document.createElement("div");
  card.className = "science-delta-card";

  const head = document.createElement("div");
  head.className = "science-delta-head";

  const title = document.createElement("span");
  title.textContent = "WHAT CHANGED";

  const reward = document.createElement("strong");
  reward.textContent = delta.summary || "Code changed the experiment";

  head.appendChild(title);
  head.appendChild(reward);
  card.appendChild(head);

  if (tested) {
    const testedCard = document.createElement("div");
    testedCard.className = "science-delta-tested";
    const testedLabel = document.createElement("span");
    testedLabel.textContent = "TESTED EXPERIMENT";
    const testedTitle = document.createElement("strong");
    testedTitle.textContent = tested.title;
    const testedBody = document.createElement("p");
    testedBody.textContent = `Source: ${getStagedExperimentSourceLabel(tested.source)}. Compare these changes with the command you staged.`;
    testedCard.appendChild(testedLabel);
    testedCard.appendChild(testedTitle);
    testedCard.appendChild(testedBody);
    const chainBadge = getScienceDeltaChainBadge(game, delta);
    if (chainBadge) {
      const badge = document.createElement("div");
      badge.className = `science-delta-chain-badge ${chainBadge.state}`;
      const badgeLabel = document.createElement("span");
      badgeLabel.textContent = chainBadge.label;
      const badgeTitle = document.createElement("strong");
      badgeTitle.textContent = chainBadge.title;
      const badgeBody = document.createElement("p");
      badgeBody.textContent = chainBadge.body;
      badge.appendChild(badgeLabel);
      badge.appendChild(badgeTitle);
      badge.appendChild(badgeBody);
      testedCard.appendChild(badge);
    }
    if (delta.nextExperiment && delta.nextExperiment.command) {
      const nextStage = document.createElement("button");
      nextStage.type = "button";
      nextStage.className = "science-delta-tested-stage-btn";
      nextStage.textContent = "STAGE NEXT";
      if (typeof nextStage.addEventListener === "function") {
        nextStage.addEventListener("click", () => stageScienceDeltaCommand(delta.nextExperiment.command, {
          title: delta.nextExperiment.title || "Next experiment",
          source: "tested-result",
          color: "#a7f3d0"
        }));
      }
      testedCard.appendChild(nextStage);
    }
    card.appendChild(testedCard);
  }

  const list = document.createElement("div");
  list.className = "science-delta-list";
  delta.changes.slice(0, 4).forEach(change => {
    const row = document.createElement("div");
    row.className = `science-delta-row ${change.direction || "same"}`;
    const label = document.createElement("span");
    label.textContent = change.label;
    const value = document.createElement("strong");
    value.textContent = change.value;
    row.appendChild(label);
    row.appendChild(value);
    if (change.cue) {
      const cue = document.createElement("em");
      cue.textContent = change.cue;
      row.appendChild(cue);
    }
    list.appendChild(row);
  });
  card.appendChild(list);
  if (delta.nextExperiment) {
    const next = document.createElement("div");
    next.className = "science-delta-next";
    const kicker = document.createElement("span");
    kicker.textContent = "NEXT EXPERIMENT";
    const title = document.createElement("strong");
    title.textContent = delta.nextExperiment.title || "Try one more test";
    const body = document.createElement("p");
    body.textContent = delta.nextExperiment.body || "Change one value, run it, then watch the result.";
    next.appendChild(kicker);
    next.appendChild(title);
    next.appendChild(body);
    if (delta.nextExperiment.command) {
      const code = document.createElement("code");
      code.textContent = delta.nextExperiment.command;
      next.appendChild(code);
      const stage = document.createElement("button");
      stage.type = "button";
      stage.className = "science-delta-stage-btn";
      stage.textContent = "STAGE CODE";
      if (typeof stage.addEventListener === "function") {
        stage.addEventListener("click", () => stageScienceDeltaCommand(delta.nextExperiment.command, {
          title: delta.nextExperiment.title || "Next experiment",
          source: "science-delta",
          color: "#86efac"
        }));
      }
      next.appendChild(stage);
    }
    card.appendChild(next);
  }
  listContainer.appendChild(card);
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
    min: 115,
    perk: {
      label: "Combo Amplifier",
      description: "New checklist progress keeps a discovery combo moving."
    }
  },
  {
    level: 5,
    title: "Orbit Scientist",
    min: 190,
    perk: {
      label: "Daily Signal Lab",
      description: "Daily remixes turn practice into a fresh signal chase."
    }
  },
  {
    level: 6,
    title: "Star Mentor",
    min: 300,
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

function getResearchUnlockPreview(rank) {
  const current = rank || getResearchRank(0);
  if (current.nextPerk) {
    return {
      label: "NEXT LAB UNLOCK",
      title: `${current.nextPerk.label} in ${Math.round(current.remaining)} XP`,
      body: `Reach ${current.nextTitle}: ${current.nextPerk.description}`,
      progress: current.progress
    };
  }
  return {
    label: "LAB FULLY ONLINE",
    title: "All lab perks online",
    body: "Keep clearing Daily Signals and mastery remixes to strengthen the science record.",
    progress: 1
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
    id: "anomaly-echo",
    title: "Dark Matter Echo",
    concept: "Infer hidden forces from motion",
    unlock: (game) => hasClearedFullStarMap(game) && hasFrontierStoryCredit(game),
    body: "A Frontier record bends the restored map toward Dark Matter Lab and Quantum Gate. The next science is reading an invisible force from the way a path curves."
  },
  {
    id: "anomaly-trace",
    title: "Hidden Force Trace",
    concept: "Prototype invisible-force rules",
    unlock: (game) => hasClearedFullStarMap(game) && hasFrontierStoryCredit(game) && hasAnomalyTraceStoryCredit(game),
    body: "The Mag-Net prototype proves the cadet can test an invisible field with one focused event rule before Dark Matter Lab opens."
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

const SIGNAL_STORY_CONTRACTS = {
  "earth-signal": {
    title: "Clear Earth (Base Camp)",
    body: "Change one motion variable until the Emerald wall opens.",
    reward: "Reward: Emerald Wall Signal"
  },
  "moon-loop": {
    title: "Clear Moon (Luna Outpost)",
    body: "Use a repeatable spring loop to cross the canyon.",
    reward: "Reward: Moon Loop Echo"
  },
  "jupiter-thrust": {
    title: "Clear Jupiter (Gas Giant Core)",
    body: "Tune rocket power and mass until thrust beats heavy gravity.",
    reward: "Reward: Amber Gravity Well"
  },
  "glacies-grip": {
    title: "Clear Glacies (Ice Comet)",
    body: "Raise grip or friction and compare how control changes.",
    reward: "Reward: Violet Grip Code"
  },
  "magnet-field": {
    title: "Clear Mag-Net (Magnetic Nebula)",
    body: "Use event logic to react when objects touch.",
    reward: "Reward: Mag-Net Pulse"
  },
  "forge-collision": {
    title: "Clear Asteroid Forge",
    body: "Make mass move first, then test how much bounce keeps energy.",
    reward: "Reward: Forge Collision Map"
  },
  "star-map-finale": {
    title: "Restore all six shards",
    body: "Clear every story world so Vector can connect the full science model.",
    reward: "Reward: Star-Map Restored"
  },
  "anomaly-echo": {
    title: "Clear one Frontier Challenge",
    body: "Run a restored-world remix and bank a stars/time record so Vector can triangulate the hidden-force anomaly.",
    reward: "Reward: Dark Matter Echo"
  },
  "anomaly-trace": {
    title: "Run Trace hidden force",
    body: "Stage the Mag-Net touch-event prototype and run the exact hidden-force command.",
    reward: "Reward: Hidden Force Trace"
  },
  "mastery-remix": {
    title: "Earn one 3-star mastery",
    body: "Replay a cleared world with tasks, samples, and science proof all complete.",
    reward: "Reward: Remix Key"
  },
  "daily-beacon": {
    title: "Clear today's Daily Signal",
    body: "Use a date-seeded remix to prove the lesson still works today.",
    reward: "Reward: Daily Beacon"
  },
  "village-pact": {
    title: "Rescue a village",
    body: "Clear mob danger so villagers return from caves and trade again.",
    reward: "Reward: Village Pact"
  }
};

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

function hasFrontierStoryCredit(game) {
  if (!game) return false;
  if (typeof game.getFrontierRecordList === 'function') {
    try {
      return game.getFrontierRecordList().length > 0;
    } catch (err) {
      return false;
    }
  }
  return !!(game.frontierRecords && Object.keys(game.frontierRecords).length > 0);
}

function hasAnomalyTraceStoryCredit(game) {
  if (!game) return false;
  const hasTraceSource = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("anomaly-trace-proof:") === 0 && Number(sources[source]) > 0));
  if (hasTraceSource(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasTraceSource(meter && meter.sources));
  }
  return false;
}

function hasDarkMatterPrepEvidenceCredit(game) {
  if (!game) return false;
  const hasPrepSource = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("signal-lab-proof:") === 0 &&
      String(source).indexOf("dark-matter-prep") >= 0 &&
      Number(sources[source]) > 0));
  if (hasPrepSource(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasPrepSource(meter && meter.sources));
  }
  return false;
}

function hasQuantumBranchProofCredit(game) {
  if (!game) return false;
  const hasBranchSource = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("quantum-branch-proof:") === 0 && Number(sources[source]) > 0));
  if (hasBranchSource(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasBranchSource(meter && meter.sources));
  }
  return false;
}

function hasQuantumChanceProofCredit(game) {
  if (!game) return false;
  const hasChanceSource = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("quantum-chance-proof:") === 0 && Number(sources[source]) > 0));
  if (hasChanceSource(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasChanceSource(meter && meter.sources));
  }
  return false;
}

function hasFutureLabSourceReady(game) {
  return !!(game &&
    typeof hasClearedFullStarMap === 'function' && hasClearedFullStarMap(game) &&
    typeof hasFrontierStoryCredit === 'function' && hasFrontierStoryCredit(game) &&
    hasAnomalyTraceStoryCredit(game) &&
    hasDarkMatterPrepEvidenceCredit(game) &&
    hasQuantumBranchProofCredit(game) &&
    hasQuantumChanceProofCredit(game));
}

function hasFutureLabSourceProofCredit(game) {
  if (!game) return false;
  const hasSourceProof = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("signal-lab-proof:future-source:") === 0 && Number(sources[source]) > 0));
  if (hasSourceProof(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasSourceProof(meter && meter.sources));
  }
  return false;
}

function hasFutureLabSourceReflectionCredit(game) {
  if (!game) return false;
  const hasSourceReflection = (sources) => !!(sources && typeof sources === 'object' && Object.keys(sources)
    .some(source => String(source).indexOf("reflection-proof:signal-reflection:signal-lab-proof:future-source:") === 0 && Number(sources[source]) > 0));
  if (hasSourceReflection(game.discoveryPassCounts)) return true;
  if (game.masteryMeters && typeof game.masteryMeters === 'object') {
    return Object.values(game.masteryMeters).some(meter => hasSourceReflection(meter && meter.sources));
  }
  return false;
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

function getSignalStoryContract(game = window.Game, story = null) {
  const progress = story || getSignalStoryProgress(game);
  const next = progress.nextChapter;
  if (!next) {
    if (hasAnomalyTraceStoryCredit(game)) {
      if (hasDarkMatterPrepEvidenceCredit(game)) {
        if (hasQuantumBranchProofCredit(game)) {
          if (hasQuantumChanceProofCredit(game)) {
            if (typeof hasFutureLabSourceProofCredit === 'function' && hasFutureLabSourceProofCredit(game)) {
              if (typeof hasFutureLabSourceReflectionCredit === 'function' && hasFutureLabSourceReflectionCredit(game)) {
                return {
                  kicker: "SOURCE KEY COMPLETE",
                  title: "Source Key record complete",
                  body: "The source rehearsal and notebook explanation are both banked. Future Lab is ready for the next world.",
                  reward: "Reward: Future Lab launch-ready record"
                };
              }
              return {
                kicker: "SOURCE KEY TESTED",
                title: "Explain the source key",
                body: "The source rehearsal is tested. Save a Science Notebook explanation that connects hidden-force clues with branch and chance evidence.",
                reward: "Reward: Source Key Reflection Proof"
              };
            }
            return {
              kicker: "QUANTUM SOURCE",
              title: "Future Source Key ready",
              body: "Dark Matter evidence and Quantum probability are both logged. Run a Source Rehearsal Frontier remix to keep the source key tuned.",
              reward: "Reward: Source Key rehearsal"
            };
          }
          return {
            kicker: "QUANTUM CHANCE",
            title: "Test chance branch",
            body: "Run a chance rule so the same code can choose different branches. Probability turns branching into a pattern over many trials.",
            reward: "Reward: Quantum Probability Seed"
          };
        }
        return {
          kicker: "QUANTUM PREP",
          title: "Test a branch condition",
          body: "Stage a simple if rule: one game state chooses one code path. Quantum Gate will build probability from branches.",
          reward: "Reward: Quantum Branch Seed"
        };
      }
      return {
        kicker: "DARK MATTER PREP",
        title: "Bank curve evidence",
        body: "Run a Daily Signal, Frontier run, or mastery remix. Compare path curve, speed, and force changes so Dark Matter Lab starts with evidence.",
        reward: "Reward: stronger hidden-force record"
      };
    }
    return {
      kicker: "SIGNAL LOOP",
      title: "Keep the star-map alive",
      body: "Daily Signals, Frontier runs, and mastery remixes turn old lessons into fresh evidence.",
      reward: "Reward: stronger lab record"
    };
  }
  const contract = SIGNAL_STORY_CONTRACTS[next.id] || {
    title: `Decode ${next.title}`,
    body: next.concept,
    reward: "Reward: next Signal Story chapter"
  };
  return {
    kicker: "STORY CONTRACT",
    title: contract.title,
    body: contract.body,
    reward: contract.reward,
    chapter: next
  };
}

function getSignalSourceScene(game = window.Game, contract = null) {
  if (!game) return null;
  const active = contract || getSignalStoryContract(game);
  const kicker = active && active.kicker ? String(active.kicker) : "";
  if (kicker === "QUANTUM SOURCE" || kicker === "SOURCE KEY TESTED" || kicker === "SOURCE KEY COMPLETE" || hasQuantumChanceProofCredit(game)) {
    return {
      label: "SOURCE SCENE",
      speaker: "HOPPER-ZERO",
      title: "The waiting probe answers",
      body: "I split one command into possible paths. Your chance proof gives the gate a probability seed instead of a guess.",
      lesson: "Science payoff: probability is a pattern measured over many trials."
    };
  }
  if (kicker === "QUANTUM CHANCE" || hasQuantumBranchProofCredit(game)) {
    return {
      label: "SOURCE SCENE",
      speaker: "HOPPER-ZERO",
      title: "Two paths detected",
      body: "Your branch condition made code choose path A or path B. The next signal needs chance so uncertainty becomes measurable.",
      lesson: "Coding payoff: a branch chooses; probability tells how often."
    };
  }
  if (kicker === "QUANTUM PREP" || hasDarkMatterPrepEvidenceCredit(game)) {
    return {
      label: "GATE SCENE",
      speaker: "VECTOR",
      title: "Quantum Gate wakes",
      body: "Curve evidence is banked. A simple if rule can now tell the source when to open one path and when to hold.",
      lesson: "Coding payoff: one condition can change the route through the same world."
    };
  }
  if (kicker === "DARK MATTER PREP" || hasAnomalyTraceStoryCredit(game)) {
    return {
      label: "CASE FILE",
      speaker: "VECTOR",
      title: "Hidden-force case file",
      body: "The Mag-Net trace proved an invisible field can be tested. Now bank curve, speed, and force evidence before Dark Matter Lab opens.",
      lesson: "Science payoff: infer an unseen force from visible motion."
    };
  }
  return null;
}

function attachFutureLabProofScene(game, pulse, proofResult) {
  if (!proofResult || typeof getSignalSourceScene !== 'function') return null;
  const scene = getSignalSourceScene(game);
  if (!scene) return null;
  const payload = {
    ...scene,
    proofLabel: proofResult.label || ""
  };
  proofResult.futureLabScene = payload;
  if (pulse) pulse.futureLabScene = payload;
  return payload;
}

function appendSourceSceneToStoryBody(body, scene) {
  if (!scene) return body;
  return `${body} Scene: ${scene.speaker} - ${scene.title}. ${scene.lesson}`;
}

function getStartSignalStoryPreview(game = window.Game) {
  const story = getSignalStoryProgress(game);
  if (story.nextChapter) {
    const contract = getSignalStoryContract(game, story);
    const reward = contract && contract.reward ? String(contract.reward).replace(/^Reward:\s*/i, "") : story.nextChapter.title;
    return {
      label: "NEXT TRANSMISSION",
      title: story.nextChapter.title,
      body: `${story.nextChapter.concept}. Next: ${contract.title}. Reward: ${reward}.`,
      progress: `${story.unlocked.length}/${story.total} decoded`
    };
  }
  const contract = getSignalStoryContract(game, story);
  const sourceScene = getSignalSourceScene(game, contract);
  if (contract && contract.kicker === "DARK MATTER PREP") {
    return {
      label: "DARK MATTER PREP",
      title: "Source traced",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "QUANTUM PREP") {
    return {
      label: "QUANTUM PREP",
      title: "Branch source warming",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "QUANTUM SEED") {
    return {
      label: "QUANTUM SEED",
      title: "Branch seed logged",
      body: appendSourceSceneToStoryBody(contract.body, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "QUANTUM CHANCE") {
    return {
      label: "QUANTUM CHANCE",
      title: "Probability path warming",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "QUANTUM SOURCE") {
    return {
      label: "QUANTUM SOURCE",
      title: contract.title || "Future Source Key ready",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "SOURCE KEY TESTED") {
    return {
      label: "SOURCE KEY TESTED",
      title: contract.title || "Explain the source key",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  if (contract && contract.kicker === "SOURCE KEY COMPLETE") {
    return {
      label: "SOURCE KEY COMPLETE",
      title: contract.title || "Source Key record complete",
      body: appendSourceSceneToStoryBody(`${contract.title}. ${contract.body}`, sourceScene),
      progress: `${story.total}/${story.total} decoded`
    };
  }
  return {
    label: "SIGNAL COMPLETE",
    title: "Star-map restored",
    body: "Daily Signals and Frontier runs keep the science trail alive.",
    progress: `${story.total}/${story.total} decoded`
  };
}

function getCadetFutureLabPortfolioText(game = window.Game) {
  if (!game) return "Future Lab pending";
  if (typeof hasFutureLabSourceReflectionCredit === "function" && hasFutureLabSourceReflectionCredit(game)) {
    return "Future Lab: Source Key complete";
  }
  if (typeof hasFutureLabSourceProofCredit === "function" && hasFutureLabSourceProofCredit(game)) {
    return "Future Lab: explain Source Key";
  }
  if (typeof hasFutureLabSourceReady === "function" && hasFutureLabSourceReady(game)) {
    return "Future Lab: run Source Key";
  }
  if (typeof getFutureLabRoadmapStages === "function") {
    try {
      const stages = getFutureLabRoadmapStages(game);
      if (Array.isArray(stages) && stages.length) {
        const done = stages.filter(stage => stage && stage.status === "done").length;
        const next = stages.find(stage => stage && stage.status === "next");
        const nextLabel = next && next.title ? ` · next ${next.title}` : "";
        return `Future Lab ${done}/${stages.length} seeds${nextLabel}`;
      }
    } catch (err) {
      // The Cadet Record should still render if the optional Log roadmap is unavailable.
    }
  }
  return "Future Lab: seeds pending";
}

function getCadetLabChainPortfolioText(game = window.Game) {
  const combo = Math.max(0, Math.floor(Number(game && game.discoveryCombo) || 0));
  if (combo > 0) {
    const milestone = typeof getActiveLabChainMilestone === "function" ? getActiveLabChainMilestone(game) : null;
    if (milestone && milestone.label && Number.isFinite(Number(milestone.target))) {
      return `Lab Chain x${combo} -> ${milestone.label} x${Math.floor(Number(milestone.target))}`;
    }
    return `Lab Chain x${combo}`;
  }
  const nextExperiment = game && game.lastScienceDelta && game.lastScienceDelta.nextExperiment;
  if (nextExperiment && nextExperiment.title) {
    return `Lab Chain: next ${nextExperiment.title}`;
  }
  return "Lab Chain: start one fresh test";
}

function getCadetPassportPortfolioText(game = window.Game) {
  if (typeof getPassportWorlds !== "function" || typeof isPassportWorldStamped !== "function") {
    return "Passport pending";
  }
  const worlds = getPassportWorlds();
  if (!Array.isArray(worlds) || !worlds.length) return "Passport pending";
  const stamped = worlds.filter(({ index }) => isPassportWorldStamped(game, index));
  const next = worlds.find(({ index }) => !isPassportWorldStamped(game, index));
  if (!next) return `Passport complete · ${stamped.length}/${worlds.length} stamps`;
  const nextName = next.planet && next.planet.name ? next.planet.name : `World ${next.index + 1}`;
  return `Passport ${stamped.length}/${worlds.length} stamps · next ${nextName}`;
}

function hasLessonPathMasteryCredit(game, mission) {
  if (!game || !mission) return false;
  const sourceKey = getLessonPathMasterySourceKey(mission.id || mission.missionId || "mission");
  const discovery = game.discoveryPassCounts && typeof game.discoveryPassCounts === "object"
    ? game.discoveryPassCounts
    : {};
  if (discovery[sourceKey]) return true;
  const meters = game.masteryMeters && typeof game.masteryMeters === "object" ? game.masteryMeters : {};
  return Object.keys(meters).some(key => {
    const meter = meters[key];
    const sources = meter && meter.sources && typeof meter.sources === "object" ? meter.sources : {};
    return !!sources[sourceKey];
  });
}

function getLessonPathPortfolioProgress(game = window.Game) {
  const missions = (typeof PlatformerMissions !== "undefined" && Array.isArray(PlatformerMissions))
    ? PlatformerMissions.filter(mission => mission && Array.isArray(mission.lessonPhases) && mission.lessonPhases.length > 0)
    : [];
  const earned = missions.filter(mission => hasLessonPathMasteryCredit(game, mission));
  const next = missions.find(mission => !hasLessonPathMasteryCredit(game, mission)) || null;
  return {
    earned: earned.length,
    total: missions.length,
    next,
    complete: missions.length > 0 && earned.length >= missions.length
  };
}

function getCadetLessonPathPortfolioText(game = window.Game) {
  const progress = getLessonPathPortfolioProgress(game);
  if (!progress.total) return "Lesson Paths pending";
  if (progress.complete) return `Lesson Paths mastered ${progress.earned}/${progress.total}`;
  const nextTitle = progress.next && progress.next.title ? progress.next.title : "next lesson";
  return `Lesson Paths ${progress.earned}/${progress.total} · next ${nextTitle}`;
}

function getLessonPathMissionLevelIndex(mission) {
  if (mission && Number.isFinite(Number(mission.planetId))) return Number(mission.planetId);
  if (typeof PLANETS !== "undefined" && Array.isArray(PLANETS) && mission && mission.id) {
    const index = PLANETS.findIndex(planet =>
      planet && Array.isArray(planet.missions) && planet.missions.some(item => item && item.id === mission.id)
    );
    if (index >= 0) return index;
  }
  return 0;
}

function getLessonPathStageCommand(game, mission) {
  if (!mission || !Array.isArray(mission.lessonPhases) || !mission.lessonPhases.length) return "";
  const first = mission.lessonPhases.find(phase => phase && phase.command);
  const missionLevel = getLessonPathMissionLevelIndex(mission);
  const currentLevel = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : null;
  if (currentLevel === missionLevel && typeof getMissionLessonPhaseRows === "function") {
    const rows = getMissionLessonPhaseRows(game, mission);
    const active = Array.isArray(rows) ? rows.find(row => row && row.status === "active" && row.command) : null;
    if (active && active.command) return active.command;
  }
  return (first && first.command) || "";
}

function getCadetLessonPathAction(game = window.Game) {
  const progress = getLessonPathPortfolioProgress(game);
  const mission = progress && !progress.complete ? progress.next : null;
  if (!mission) return null;
  const levelIndex = getLessonPathMissionLevelIndex(mission);
  const command = getLessonPathStageCommand(game, mission);
  return {
    missionId: mission.id || "",
    levelIndex,
    label: "RUN LESSON",
    title: `Run ${mission.title || "next lesson path"}`,
    stageTitle: mission.title || "Lesson path",
    command
  };
}

function getCadetDailyHabitPortfolioText(game = window.Game) {
  const streak = Math.max(0, Math.floor(Number(game && game.streakCount) || 0));
  if (streak <= 0) return "Daily Lab: start streak";
  const focus = game && typeof game.getReturnStreakDailyFocus === "function"
    ? game.getReturnStreakDailyFocus()
    : null;
  const focusTitle = focus && focus.title ? ` · ${focus.title}` : "";
  return `Daily Streak d${streak}${focusTitle}`;
}

function getCadetIdentityPreview(game = window.Game) {
  const callsign = game && typeof game.getCadetCallsign === "function" ? game.getCadetCallsign() : "Cadet";
  const rank = typeof getResearchRank === "function"
    ? getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0)
    : { title: "Lab Rookie", progress: 0, xp: 0 };
  const collection = typeof getFormulaCollection === "function" ? getFormulaCollection(game) : null;
  const formulas = collection && Array.isArray(collection.cards)
    ? `${collection.unlocked.length}/${collection.cards.length} formulas`
    : `${game && game.discoveredFormulaKinds ? game.discoveredFormulaKinds.size : 0} formulas`;
  const story = typeof getSignalStoryProgress === "function" ? getSignalStoryProgress(game) : null;
  const transmissions = story ? `${story.unlocked.length}/${story.total} transmissions` : "0 transmissions";
  const labChain = getCadetLabChainPortfolioText(game);
  const dailyHabit = getCadetDailyHabitPortfolioText(game);
  const passport = getCadetPassportPortfolioText(game);
  const lessonPaths = getCadetLessonPathPortfolioText(game);
  const codeConcepts = getCadetCodeConceptPortfolioText(game);
  const futureLab = getCadetFutureLabPortfolioText(game);
  const village = game && typeof game.getVillageTrustProgress === "function" ? game.getVillageTrustProgress(game.currentPlanetIndex) : null;
  const trust = village ? `${village.title} · ${village.points} trust` : "Village trust pending";
  const aiDeck = typeof getAIStateDeckProgress === "function" ? getAIStateDeckProgress(game) : null;
  let aiStates = "AI states pending";
  let aiAction = null;
  if (aiDeck && Number.isFinite(Number(aiDeck.total))) {
    const earned = Math.max(0, Number(aiDeck.earnedCount) || 0);
    const total = Math.max(0, Number(aiDeck.total) || 0);
    if (aiDeck.complete) {
      aiStates = `AI Mastered ${earned}/${total} states`;
    } else {
      const next = aiDeck.nextCard || null;
      const action = next && typeof getAIStateDeckAction === "function"
        ? getAIStateDeckAction(game, next.id)
        : null;
      const nextTitle = next && next.title ? next.title : "next state";
      const actionLabel = action && action.label ? ` · ${action.label}` : "";
      aiStates = `${earned}/${total} AI states · next ${nextTitle}${actionLabel}`;
      if (action && next) {
        aiAction = {
          cardId: action.cardId || next.id,
          label: action.label || "RUN STATE",
          title: action.title || nextTitle
        };
      }
    }
  }
  const lessonPathAction = getCadetLessonPathAction(game);
  return {
    label: "CADET RECORD",
    title: `${callsign} // ${rank.title}`,
    body: `${Math.round(rank.xp || 0)} XP · ${dailyHabit} · ${labChain} · ${passport} · ${lessonPaths} · ${formulas} · ${codeConcepts} · ${transmissions} · ${futureLab} · ${aiStates} · ${trust}`,
    progress: Math.max(0, Math.min(1, Number(rank.progress) || 0)),
    aiAction,
    lessonPathAction
  };
}

function getStartWorldMasteryPreview(game = window.Game) {
  if (!game || typeof game.getWorldMasteryProgress !== "function") {
    return {
      label: "WORLD MASTERY",
      title: "World progress loading",
      body: "Tasks, samples, proof, rescues, and remixes fill this world ladder.",
      progress: 0
    };
  }
  const index = Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const progress = game.getWorldMasteryProgress(index);
  const xp = Math.max(0, Math.floor(Number(progress && progress.xp) || 0));
  const title = progress && progress.title ? progress.title : "Unranked";
  const planet = game.currentPlanet && game.currentPlanet.name ? game.currentPlanet.name : "This world";
  const next = progress && progress.nextTier ? progress.nextTier : null;
  const body = next
    ? `${Math.max(0, Math.floor(Number(next.xp) || 0) - xp)} XP to ${next.label} on ${planet}.`
    : `${planet} mastery ladder is maxed. Keep Daily Signals and Frontier runs alive.`;
  return {
    label: "WORLD MASTERY",
    title: `${title} · ${xp} XP`,
    body,
    progress: Math.max(0, Math.min(1, ((progress && Number(progress.pct)) || 0) / 100))
  };
}

function getStartVillageTrustPreview(game = window.Game) {
  if (!game || typeof game.getVillageTrustProgress !== "function") {
    return {
      label: "VILLAGE TRUST",
      title: "Village link loading",
      body: "Trades, rescues, and pet guards build relationship progress.",
      progress: 0
    };
  }
  const index = Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const progress = game.getVillageTrustProgress(index);
  const points = Math.max(0, Math.floor(Number(progress && progress.points) || 0));
  const title = progress && progress.title ? progress.title : "New Arrival";
  const planet = game.currentPlanet && game.currentPlanet.name ? game.currentPlanet.name : "this world";
  const next = progress && progress.nextTier ? progress.nextTier : null;
  const pact = progress && progress.nextPact ? progress.nextPact : null;
  const chain = (typeof getVillageQuestChainPreview === "function") ? getVillageQuestChainPreview(game) : null;
  const chainTitle = chain ? ` · Quest ${chain.doneCount}/${chain.total}` : "";
  const chainLead = chain
    ? `Village Quest ${chain.doneCount}/${chain.total}: ${chain.title} (${chain.formula}). `
    : "";
  const stateSignal = getStartVillageStateSignal(game);
  const stateLine = stateSignal ? ` Village State: ${stateSignal.body}` : "";
  const body = next
    ? `${Math.max(0, Math.floor(Number(next.points) || 0) - points)} trust to ${next.label} on ${planet}. ${pact ? `${pact.title}: ${pact.action}. ${pact.concept}.` : "Next: build village trust."}`
    : `${planet} trusts this cadet. Keep trades, rescues, and pet guards alive as relationship evidence.`;
  return {
    label: "VILLAGE TRUST",
    title: `${title} · ${points} trust${chainTitle}`,
    body: `${chainLead}${body}${stateLine}`,
    stateClass: stateSignal ? stateSignal.stateClass : "safe",
    progress: Math.max(0, Math.min(1, ((progress && Number(progress.pct)) || 0) / 100))
  };
}

function getStartVillageStateSignal(game = window.Game) {
  if (!game) return null;
  const index = Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const planet = game.currentPlanet || (typeof PLANETS !== "undefined" ? PLANETS[index] : null);
  const hasPlanetVillage = !!(planet && Array.isArray(planet.npcs) && planet.npcs.length);
  const liveVillagers = Array.isArray(game.interactiveObjects) && typeof NPC !== "undefined"
    ? game.interactiveObjects.filter(obj => obj instanceof NPC)
    : [];
  if (!hasPlanetVillage && liveVillagers.length === 0) return null;

  let danger = false;
  let night = false;
  let hidden = 0;
  for (const npc of liveVillagers) {
    if (npc.hiddenInCave || npc.shelterReason) hidden++;
    const signal = typeof game.getVillagerShelterSignal === "function"
      ? game.getVillagerShelterSignal(npc)
      : null;
    const liveThreat = !!(signal && signal.threat);
    const nightShelter = !!((signal && signal.reason === "night") || npc.shelterReason === "night");
    const staleDanger = (npc.shelterReason === "nearby mob" || npc.shelterReason === "mob attack") && !nightShelter;
    if (liveThreat || staleDanger) danger = true;
    if (nightShelter) night = true;
  }

  if (!liveVillagers.length) {
    night = typeof game.shouldVillagersShelterForNight === "function" && game.shouldVillagersShelterForNight();
    danger = Array.isArray(game.mobs) && game.mobs.some(mob => mob && !mob.pet);
  }

  if (danger) {
    return {
      stateClass: "danger",
      label: "DANGER",
      body: "DANGER -> cave; clear mobs -> trade. AI state machines keep villagers safe."
    };
  }
  if (night) {
    return {
      stateClass: "night",
      label: "NIGHT",
      body: "NIGHT -> cave; daylight -> trade. Earth time changes village behavior."
    };
  }
  if (hidden > 0) {
    return {
      stateClass: "wait",
      label: "WAIT",
      body: "WAIT -> safety check; clear cave + village -> trade."
    };
  }
  return {
    stateClass: "safe",
    label: "SAFE",
    body: "SAFE -> trade; event + state -> next behavior."
  };
}

function getStartLabStarProofPreview(game = window.Game) {
  if (!game || typeof game.getClearLabStarSummary !== "function") {
    return {
      label: "3-STAR PROOF",
      title: "Lab stars loading",
      body: "Finish tasks, bank samples, and leave science proof for mastery.",
      stars: 0,
      maxStars: 3
    };
  }
  const summary = game.getClearLabStarSummary();
  const checks = summary && Array.isArray(summary.checks) ? summary.checks : [];
  const maxStars = Math.max(1, Math.floor(Number(summary && summary.maxStars) || checks.length || 3));
  const stars = Math.max(0, Math.min(maxStars, Math.floor(Number(summary && summary.stars) || 0)));
  const next = checks.find(check => check && !check.earned) || null;
  let body = "3-star proof is ready. Clear the portal to bank mastery XP.";
  if (next && next.id === "missions") {
    body = "Next: finish mission tasks so the code proves it changes the world.";
  } else if (next && next.id === "gems") {
    body = "Next: collect mission samples so the experiment banks real evidence.";
  } else if (next && next.id === "science") {
    body = "Next: leave science proof with a prediction or formula card before clearing.";
  } else if (next) {
    body = `Next: ${next.label || "complete one mastery goal"}.`;
  }
  return {
    label: "3-STAR PROOF",
    title: `${stars}/${maxStars} Lab Stars ready`,
    body,
    stars,
    maxStars
  };
}

function updateSignalStoryPanel(game = window.Game) {
  const panel = document.getElementById("signal-story-panel");
  if (!panel) return;
  const story = getSignalStoryProgress(game);
  const next = story.nextChapter;
  const contract = getSignalStoryContract(game, story);
  const sourceScene = getSignalSourceScene(game, contract);
  panel.innerHTML = `
    <div class="signal-story-head">
      <div>
        <span>STAR-MAP CHAPTERS</span>
        <strong>${story.unlocked.length}/${story.total} decoded</strong>
      </div>
      <em>${next ? `Next: ${escapeHTML(next.title)}` : "Signal complete"}</em>
    </div>
    <div class="signal-story-contract">
      <span>${escapeHTML(contract.kicker)}</span>
      <strong>${escapeHTML(contract.title)}</strong>
      <p>${escapeHTML(contract.body)}</p>
      <em>${escapeHTML(contract.reward)}</em>
    </div>
    ${sourceScene ? `
    <div class="signal-story-scene">
      <span>${escapeHTML(sourceScene.label)}</span>
      <strong>${escapeHTML(sourceScene.speaker)} // ${escapeHTML(sourceScene.title)}</strong>
      <p>${escapeHTML(sourceScene.body)}</p>
      <em>${escapeHTML(sourceScene.lesson)}</em>
    </div>
    ` : ""}
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
  const codeDeck = document.getElementById("code-concept-deck-panel");
  const storyPanel = document.getElementById("signal-story-panel");
  const startRadar = document.getElementById("start-mission-radar");
  if (!rankCard && !deck && !codeDeck && !storyPanel && !startRadar) return;
  const xp = game && Number.isFinite(game.researchXP) ? game.researchXP : 0;
  const rank = getResearchRank(xp);

  if (startRadar) updateStartMissionRadar(game);

  if (rankCard) {
    const pct = Math.round(rank.progress * 100);
    const labQuest = getActiveLabQuest(game);
    const chainMilestone = getActiveLabChainMilestone(game);
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
      ${chainMilestone ? `
      <div class="lab-chain-rank-card">
        <span>LAB CHAIN x${escapeHTML(String(chainMilestone.combo))}</span>
        <strong>${escapeHTML(chainMilestone.label)} at x${escapeHTML(String(chainMilestone.target))}</strong>
        <p>${escapeHTML(chainMilestone.preview)}</p>
        <em>Make one fresh experiment to keep the streak alive.</em>
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
    const target = getActiveFormulaTarget(game);
    const focusCard = renderFormulaFocusCard(collection, target);
    if (!collection.unlocked.length) {
      deck.innerHTML = `
        ${focusCard}
        <div class="discovery-deck-empty">Run the focus command in Mission Coach, watch what changes, then explain it in the Log.</div>
      `;
    } else {
      deck.innerHTML = `
        <div class="formula-collection-head">
          <strong>Formula Cards ${collection.unlocked.length}/${collection.cards.length}</strong>
          <span>${target ? `Next: ${escapeHTML(target.title)}` : (collection.locked.length ? "Next formula appears after this step" : "Deck complete")}</span>
        </div>
        ${focusCard}
        ${collection.cards.map(card => `
        <div class="discovery-card formula-card ${card.unlocked ? "unlocked" : "locked"} ${target && target.kind === card.kind ? "next-goal" : ""}">
          <div class="discovery-card-head">
            <strong>${escapeHTML(card.title)}</strong>
            <span>${card.unlocked ? "collected" : (target && target.kind === card.kind ? "next goal" : "locked goal")}</span>
          </div>
          <code>${escapeHTML(card.unlocked ? card.formula : (card.sampleCode || card.move || "Run a matching code change"))}</code>
          <p>${escapeHTML(card.unlocked ? card.insight : card.cue)}</p>
          ${card.unlocked ? "" : `
          <div class="formula-card-preview">
            <span><b>LEARN</b>${escapeHTML(card.axis || card.formula)}</span>
            <span><b>CODE</b>${escapeHTML(card.move || card.sampleCode || "Change one value")}</span>
            <span><b>WIN</b>${escapeHTML(card.payoff || `Collect ${card.title}`)}</span>
          </div>`}
        </div>
        `).join("")}
      `;
    }
    bindFormulaFocusStage(deck, target);
  }

  if (codeDeck) updateCodeConceptDeck(game);

  if (storyPanel) updateSignalStoryPanel(game);
}

const DISCOVERY_RULES = [
  {
    kind: "mass",
    pattern: /\bhopper\.mass\s*=/i,
    title: "Mass Lab",
    formula: "a = F / m",
    insight: "Lower mass makes the same engine and jump force create more acceleration; it does not make free fall slower or faster.",
    cue: "Watch speed and jump height change when mass changes. Gravity still sets falling acceleration.",
    axis: "Mass controls acceleration",
    move: "Tune hopper.mass once",
    payoff: "Open lighter-build routes",
    sampleCode: "hopper.mass = 1.0"
  },
  {
    kind: "engine",
    pattern: /\bhopper\.engine\s*=/i,
    title: "Engine Lab",
    formula: "speed = engine / mass",
    insight: "More engine force raises top speed, especially when Hopper is light.",
    cue: "Use the Agility gauge to see the new speed.",
    axis: "Force changes speed",
    move: "Raise hopper.engine",
    payoff: "Beat Agility gates",
    sampleCode: "hopper.engine = 7"
  },
  {
    kind: "jump",
    pattern: /\b(?:hopper\.)?jump_power\s*=/i,
    title: "Jump Lab",
    formula: "jump = force / mass",
    insight: "Jump force lifts better when the rover has less mass to accelerate.",
    cue: "Try the same jump with two different masses.",
    axis: "Impulse launches mass",
    move: "Tune hopper.jump_power",
    payoff: "Reach high samples",
    sampleCode: "hopper.jump_power = 20"
  },
  {
    kind: "antigravity",
    pattern: /\bantigravity\s*=/i,
    title: "Gravity Lab",
    formula: "felt g = planet g - antigravity",
    insight: "Antigravity lowers the pull you feel, stretching hang time and jump arcs.",
    cue: "A smaller felt g makes the same jump stay airborne longer.",
    axis: "Felt gravity changes hang time",
    move: "Set antigravity",
    payoff: "Stretch jump arcs",
    sampleCode: "antigravity = 4.9"
  },
  {
    kind: "rocket",
    pattern: /\bhopper\.rocket_power\s*=/i,
    title: "Rocket Lab",
    formula: "thrust = rocket x 2.5 / mass",
    insight: "Rocket power fights gravity, but heavy builds spend more fuel to climb.",
    cue: "Watch Thrust and the fuel tank together.",
    axis: "Thrust must beat weight",
    move: "Tune hopper.rocket_power",
    payoff: "Climb gravity wells",
    sampleCode: "hopper.rocket_power = 75"
  },
  {
    kind: "loop",
    pattern: /\brepeat\s+(?:\d+|\{[^}]+\})/i,
    title: "Loop Lab",
    formula: "repeat n = command x n",
    insight: "A loop turns one instruction into a pattern, saving lines and building faster.",
    cue: "Count the spawned tools after the loop runs.",
    axis: "Loops build patterns",
    move: "Repeat one spawn command",
    payoff: "Build bridges faster",
    sampleCode: "repeat 3 { spawn_spring() }"
  },
  {
    kind: "branch",
    pattern: /\bif\s+[^:\n]+:/i,
    title: "Branch Lab",
    formula: "if condition -> branch",
    insight: "A conditional lets code choose a path from the current game state instead of always doing the same thing.",
    cue: "Change one value, then run an if rule and watch which path fires.",
    axis: "Conditions choose paths",
    move: "Write one if rule",
    payoff: "Prep Quantum Gate",
    sampleCode: "if player.fuel < 50: player.say('branch A')"
  },
  {
    kind: "probability",
    pattern: /\bchance\s*\(/i,
    title: "Probability Lab",
    formula: "chance p -> random branch",
    insight: "Probability code makes a branch that does not always pick the same path. More trials reveal the pattern.",
    cue: "Run a chance rule more than once and compare which path appears.",
    axis: "Probability controls outcomes",
    move: "Call chance(percent)",
    payoff: "Seed Quantum paths",
    sampleCode: "if chance(50): player.say('path A')"
  },
  {
    kind: "friction",
    pattern: /\bfriction\s*=/i,
    title: "Friction Lab",
    formula: "friction opposes sliding",
    insight: "Higher friction turns sliding motion into grip, helping the rover stop.",
    cue: "Compare how far the rover skids before and after the change.",
    axis: "Friction opposes motion",
    move: "Tune friction",
    payoff: "Stop on ice",
    sampleCode: "friction = 8"
  },
  {
    kind: "elasticity",
    pattern: /\belasticity\s*=/i,
    title: "Collision Lab",
    formula: "bounce kept = elasticity x speed",
    insight: "Elasticity decides how much speed survives a collision or springy bounce.",
    cue: "Mass gives the shove; elasticity preserves the rebound.",
    axis: "Elasticity preserves rebound",
    move: "Tune elasticity",
    payoff: "Keep bounce speed",
    sampleCode: "elasticity = 1.0"
  },
  {
    kind: "magnet",
    pattern: /\bhopper\.pole\s*=/i,
    title: "Magnet Lab",
    formula: "opposite poles attract",
    insight: "Changing pole flips whether the field pulls or pushes Hopper.",
    cue: "The same magnet becomes a lift or a barrier after the pole changes.",
    axis: "Polarity flips force",
    move: "Change hopper.pole",
    payoff: "Turn fields into lifts",
    sampleCode: "when player.touching('magnet'): hopper.pole = 'south'"
  },
  {
    kind: "state",
    pattern: /\b(?:rave_mode\s*\(|state\s*=|pet\s+state|player\.touching\()/i,
    title: "AI State Lab",
    formula: "state + event -> next state",
    insight: "Game characters can switch behavior when an event happens: wild, scared, pet, shelter, trade, or guard.",
    cue: "Watch a mob, pet, or villager change state after danger, night, trade, or a touch event.",
    axis: "Events change behavior state",
    move: "Trigger one AI event",
    payoff: "Grow Village Trust",
    sampleCode: "rave_mode()"
  }
];

const CODE_CONCEPT_CARDS = [
  {
    concept: "ASSIGN",
    title: "Assignment",
    body: "Store a new value in one game variable.",
    sampleCode: "hopper.mass = 1.2"
  },
  {
    concept: "LOOP",
    title: "Loop",
    body: "Repeat one instruction to build a pattern.",
    sampleCode: "repeat 3 { spawn_block() }"
  },
  {
    concept: "IF",
    title: "Conditional",
    body: "Choose behavior from the current game state.",
    sampleCode: "if player.touching('ice'): friction = 8"
  },
  {
    concept: "CALL",
    title: "Function Call",
    body: "Run a named action or helper.",
    sampleCode: "use_hopper()"
  }
];

function getCodeConceptCard(concept) {
  const key = String(concept || "").toUpperCase();
  return CODE_CONCEPT_CARDS.find(card => card.concept === key) || null;
}

function getCodeConceptSet(game) {
  const set = new Set();
  const addConcept = (concept) => {
    const key = String(concept || "").toUpperCase();
    if (getCodeConceptCard(key)) set.add(key);
  };
  if (game && game.codeConcepts) {
    const values = game.codeConcepts instanceof Set
      ? Array.from(game.codeConcepts)
      : (Array.isArray(game.codeConcepts) ? game.codeConcepts : []);
    values.forEach(addConcept);
  }
  if (game && Array.isArray(game.discoveryLog)) {
    game.discoveryLog.forEach(pulse => {
      if (pulse && pulse.codeConceptProof) addConcept(pulse.codeConceptProof.concept);
    });
  }
  return set;
}

function getCodeConceptProgress(game) {
  const collected = getCodeConceptSet(game);
  const cards = CODE_CONCEPT_CARDS.map(card => ({
    ...card,
    unlocked: collected.has(card.concept)
  }));
  return {
    cards,
    collected,
    count: cards.filter(card => card.unlocked).length,
    total: cards.length,
    next: cards.find(card => !card.unlocked) || null,
    complete: cards.every(card => card.unlocked)
  };
}

function getCadetCodeConceptPortfolioText(game = window.Game) {
  const progress = getCodeConceptProgress(game);
  if (!progress.total) return "Code Concepts pending";
  if (progress.complete) return `Code Concepts mastered ${progress.count}/${progress.total}`;
  const nextTitle = progress.next && progress.next.title ? progress.next.title : "next concept";
  return `Code Concepts ${progress.count}/${progress.total} · next ${nextTitle}`;
}

function getActiveCodeConceptTarget(game = window.Game) {
  const progress = getCodeConceptProgress(game);
  const next = progress && progress.next ? progress.next : null;
  const command = next && next.sampleCode ? String(next.sampleCode).trim() : "";
  if (!next || progress.complete || !command) return null;
  const finalCard = progress.count >= Math.max(0, progress.total - 1);
  return {
    concept: next.concept,
    title: next.title,
    body: next.body,
    command,
    progress: `${progress.count}/${progress.total}`,
    count: progress.count,
    total: progress.total,
    reward: finalCard ? "Reward: code deck mastery" : "Reward: code concept card",
    color: "#93c5fd"
  };
}

function bindCodeConceptDeckStage(panel, game, progress) {
  if (!panel || typeof panel.querySelectorAll !== "function" || !progress || !progress.next) return;
  const buttons = panel.querySelectorAll("[data-code-concept-command]");
  buttons.forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset ? String(button.dataset.codeConceptCommand || "").trim() : "";
      if (!command || typeof stageScienceDeltaCommand !== "function") return false;
      return stageScienceDeltaCommand(command, {
        title: progress.next.title || "Code concept",
        kind: progress.next.concept || "code-concept",
        source: "code-concept-deck",
        color: "#93c5fd",
        game
      });
    });
  });
}

function updateCodeConceptDeck(game = window.Game) {
  const panel = document.getElementById("code-concept-deck-panel");
  if (!panel) return;
  const progress = getCodeConceptProgress(game);
  const next = progress.next || null;
  const deckLabel = progress.complete
    ? "Deck complete"
    : (next ? `Next: ${next.title}` : "Next coding idea appears after a science proof");
  const nextCommand = next && next.sampleCode ? String(next.sampleCode).trim() : "";
  panel.innerHTML = `
    <div class="formula-collection-head code-concept-head">
      <strong>Code Concepts ${progress.count}/${progress.total}</strong>
      <span>${escapeHTML(deckLabel)}</span>
    </div>
    ${next ? `
    <div class="code-concept-next-card">
      <span>NEXT CODING IDEA</span>
      <strong>${escapeHTML(next.title)}</strong>
      <p>${escapeHTML(next.body)}</p>
      <code>${escapeHTML(next.sampleCode || "")}</code>
      ${nextCommand ? `<button type="button" class="code-concept-stage-btn" data-code-concept-command="${escapeHTML(nextCommand)}">STAGE NEXT</button>` : ""}
    </div>
    ` : `
    <div class="code-concept-next-card complete">
      <span>CODE DECK COMPLETE</span>
      <strong>Four core coding moves collected</strong>
      <p>Keep combining variables, loops, conditionals, and calls with science missions.</p>
    </div>
    `}
    <div class="code-concept-grid">
      ${progress.cards.map(card => `
      <div class="discovery-card code-concept-card ${card.unlocked ? "unlocked" : "locked"} ${next && next.concept === card.concept ? "next-goal" : ""}">
        <div class="discovery-card-head">
          <strong>${escapeHTML(card.title)}</strong>
          <span>${card.unlocked ? "collected" : (next && next.concept === card.concept ? "next concept" : "locked")}</span>
        </div>
        <code>${escapeHTML(card.concept)} · ${escapeHTML(card.sampleCode || "")}</code>
        <p>${escapeHTML(card.body)}</p>
      </div>
      `).join("")}
    </div>
  `;
  bindCodeConceptDeckStage(panel, game, progress);
}

function getCodeConceptForPulse(game, pulse) {
  if (!game || !pulse || typeof game.getCommandCodeSkillChip !== "function") return "";
  const candidates = [];
  if (pulse.scienceDeltaProof && pulse.scienceDeltaProof.codeLine) {
    candidates.push(pulse.scienceDeltaProof.codeLine);
  }
  const code = String(pulse.code || "").trim();
  if (code) {
    candidates.push(code);
    code.split(/\n/).map(line => line.trim()).filter(Boolean).forEach(line => candidates.push(line));
  }
  for (const candidate of candidates) {
    const concept = game.getCommandCodeSkillChip(candidate);
    if (getCodeConceptCard(concept)) return concept;
  }
  return "";
}

function grantCodeConceptProgress(game, pulse) {
  if (!game || !pulse) return null;
  const concept = getCodeConceptForPulse(game, pulse);
  const card = getCodeConceptCard(concept);
  if (!card) return null;
  const collected = getCodeConceptSet(game);
  if (collected.has(card.concept)) {
    game.codeConcepts = collected;
    return null;
  }
  collected.add(card.concept);
  game.codeConcepts = collected;
  const progress = getCodeConceptProgress(game);
  const proof = {
    label: "CODE CONCEPT",
    concept: card.concept,
    title: card.title,
    body: card.body,
    progress: `${progress.count}/${progress.total}`,
    complete: progress.complete,
    nextConcept: progress.next ? progress.next.concept : "",
    nextTitle: progress.next ? progress.next.title : "Code deck complete",
    nextBody: progress.next ? progress.next.body : "",
    nextCommand: progress.next && progress.next.sampleCode ? progress.next.sampleCode : ""
  };
  if (game.player && typeof ComicBubbles !== "undefined" && ComicBubbles.pop) {
    const baseX = Number.isFinite(game.player.x) ? game.player.x : 0;
    const baseY = Number.isFinite(game.player.y) ? game.player.y : 0;
    const width = Number.isFinite(game.player.w) ? game.player.w : 24;
    ComicBubbles.pop(baseX + width / 2, baseY - 84, `CODE ${card.concept}`, "#93c5fd", 0.82);
  }
  return proof;
}

function getPulseFormulaKind(pulse) {
  if (!pulse) return null;
  if (pulse.formulaCardKind && DISCOVERY_RULES.some(rule => rule.kind === pulse.formulaCardKind)) {
    return pulse.formulaCardKind;
  }
  if (!pulse.cardUnlocked) return null;
  if (pulse.kind && pulse.kind !== "mission" && DISCOVERY_RULES.some(rule => rule.kind === pulse.kind)) {
    return pulse.kind;
  }
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

function missionResultCheckPassed(game, fullMission, checkId) {
  if (!game || !fullMission || !checkId || !Array.isArray(fullMission.resultChecks)) return false;
  const check = fullMission.resultChecks.find(item => item && item.id === checkId);
  if (!check || typeof check.check !== 'function') return false;
  try {
    return !!check.check(game, Compiler);
  } catch (err) {
    return false;
  }
}

function getMissionResultCheckState(game, fullMission, checkId) {
  if (!game || !fullMission || !checkId || !Array.isArray(fullMission.resultChecks)) return null;
  const check = fullMission.resultChecks.find(item => item && item.id === checkId);
  if (!check || typeof check.check !== 'function') return null;
  let passed = false;
  try {
    passed = !!check.check(game, Compiler);
  } catch (err) {
    passed = false;
  }
  return {
    id: check.id,
    label: check.label || "",
    passed,
    message: passed ? (check.success || "") : (check.waiting || "")
  };
}

function getActiveScaffoldSlots(scaffold, game = null, fullMission = null) {
  const slots = scaffold && Array.isArray(scaffold.slots) ? scaffold.slots : [];
  if (!slots.length || !game || !fullMission) return slots.slice();
  const active = [];
  for (const slot of slots) {
    if (slot.unlockAfterCheck && !missionResultCheckPassed(game, fullMission, slot.unlockAfterCheck)) break;
    active.push(slot);
  }
  return active;
}

function scaffoldWithActiveSlots(scaffold, game = null, fullMission = null) {
  if (!scaffold) return scaffold;
  const activeSlots = getActiveScaffoldSlots(scaffold, game, fullMission);
  if (!Array.isArray(scaffold.slots) || activeSlots.length === scaffold.slots.length) {
    return scaffold;
  }
  const activeIds = new Set(activeSlots.map(slot => slot.id));
  const lines = String(scaffold.template || "").split("\n").filter(line => {
    const matches = Array.from(line.matchAll(/\{([^}]+)\}/g));
    return !matches.length || matches.some(match => activeIds.has(match[1]));
  });
  return {
    ...scaffold,
    template: lines.join("\n"),
    slots: activeSlots
  };
}

function getHiddenScaffoldTemplate(scaffold, activeScaffold) {
  if (!scaffold || !Array.isArray(scaffold.slots) || !activeScaffold || !Array.isArray(activeScaffold.slots)) return "";
  const activeIds = new Set(activeScaffold.slots.map(slot => slot.id));
  const slotsById = new Map(scaffold.slots.map(slot => [slot.id, slot]));
  return String(scaffold.template || "").split("\n").filter(line => {
    const matches = Array.from(line.matchAll(/\{([^}]+)\}/g));
    if (!matches.length) return false;
    const matchedSlots = matches.map(match => slotsById.get(match[1])).filter(Boolean);
    return matchedSlots.length === matches.length
      && matchedSlots.every(slot => !activeIds.has(slot.id) && slot.hideFormulaUntilCheck);
  }).join("\n");
}

function getActiveFormulaTarget(game, activeMission = null) {
  const collection = getFormulaCollection(game);
  if (!collection.locked.length) return null;
  const mission = activeMission || (typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null);
  const fullMission = mission && mission.fullMission ? mission.fullMission : null;
  const scaffold = fullMission && fullMission.scaffold ? scaffoldWithActiveSlots(fullMission.scaffold, game, fullMission) : null;
  const template = scaffold && scaffold.template ? scaffold.template : "";
  const hiddenTemplate = fullMission && fullMission.scaffold && scaffold
    ? getHiddenScaffoldTemplate(fullMission.scaffold, scaffold)
    : "";
  const missionCards = collection.locked
    .map(card => ({ card, index: patternIndexInText(card, template) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (missionCards.length) return missionCards[0].card;
  return collection.locked.find(card => patternIndexInText(card, hiddenTemplate) < 0) || null;
}

function renderFormulaFocusCard(collection, target) {
  if (!target || !collection || !collection.cards || !collection.cards.length) return "";
  const current = collection.unlocked ? collection.unlocked.length : 0;
  const total = collection.cards.length;
  const sample = target.sampleCode || target.cue || "";
  const axis = target.axis || target.formula || "One science idea";
  const move = target.move || "Change one code value";
  const payoff = target.payoff || `Collect ${target.title} + Research XP`;
  return `
    <div class="formula-focus-card">
      <div class="formula-focus-copy">
        <span>NEXT EXPERIMENT</span>
        <strong>${escapeHTML(target.title)}</strong>
        <p>${escapeHTML(target.cue)}</p>
        <div class="formula-focus-steps">
          <span><b>LEARN</b>${escapeHTML(axis)}</span>
          <span><b>CODE</b>${escapeHTML(move)}</span>
          <span><b>WIN</b>${escapeHTML(payoff)}</span>
        </div>
      </div>
      <div class="formula-focus-command">
        <span>${current}/${total} cards</span>
        <code>${escapeHTML(sample)}</code>
        ${sample ? `<button type="button" class="formula-focus-stage-btn" data-formula-focus-stage="1">STAGE FOCUS</button>` : ""}
      </div>
    </div>
  `;
}

function bindFormulaFocusStage(deck, target) {
  if (!deck || !target || typeof deck.querySelector !== 'function') return;
  const sample = target.sampleCode || target.cue || "";
  if (!sample) return;
  const stageBtn = deck.querySelector("[data-formula-focus-stage]");
  if (stageBtn && typeof stageBtn.addEventListener === "function") {
    stageBtn.addEventListener("click", () => stageScienceDeltaCommand(sample, {
      title: target.title,
      kind: target.kind,
      source: "formula-focus",
      color: "#a7f3d0"
    }));
  }
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

  const anomalyAlreadyTraced = typeof hasAnomalyTraceStoryCredit === 'function' && hasAnomalyTraceStoryCredit(game);
  const darkMatterEvidenceReady = typeof hasDarkMatterPrepEvidenceCredit === 'function' && hasDarkMatterPrepEvidenceCredit(game);
  const quantumBranchSeeded = typeof hasQuantumBranchProofCredit === 'function' && hasQuantumBranchProofCredit(game);
  const quantumChanceSeeded = typeof hasQuantumChanceProofCredit === 'function' && hasQuantumChanceProofCredit(game);
  const futureSourceReady = typeof hasFutureLabSourceReady === 'function' && hasFutureLabSourceReady(game);
  const futureSourceTested = typeof hasFutureLabSourceProofCredit === 'function' && hasFutureLabSourceProofCredit(game);
  const futureSourceReflected = typeof hasFutureLabSourceReflectionCredit === 'function' && hasFutureLabSourceReflectionCredit(game);
  if (typeof hasClearedFullStarMap === 'function' && typeof hasFrontierStoryCredit === 'function' &&
      hasClearedFullStarMap(game) && hasFrontierStoryCredit(game) && !anomalyAlreadyTraced) {
    return {
      kicker: "NEXT LAB QUEST",
      title: "Trace hidden force",
      body: "Dark Matter Echo is decoded. Use Mag-Net as a prototype: a touch event reveals how an unseen field bends motion.",
      reward: "Reward: Dark Matter prep + Frontier practice",
      action: "anomaly",
      levelIndex: 4,
      kind: "anomaly",
      command: "use_hopper()\nwhen player.touching('magnet'): hopper.pole = 'south'"
    };
  }

  if (anomalyAlreadyTraced && typeof hasClearedFullStarMap === 'function' && typeof hasFrontierStoryCredit === 'function' &&
      hasClearedFullStarMap(game) && hasFrontierStoryCredit(game) && !darkMatterEvidenceReady) {
    return {
      kicker: "DARK MATTER PREP",
      title: "Bank curve evidence",
      body: "Run a Frontier remix and compare path curve, speed, and force changes. Dark Matter Lab will need evidence, not guesses.",
      reward: "Reward: stronger hidden-force record",
      action: "dark-matter-prep",
      kind: "dark-matter-prep"
    };
  }

  if (anomalyAlreadyTraced && darkMatterEvidenceReady && !quantumBranchSeeded &&
      typeof hasClearedFullStarMap === 'function' && typeof hasFrontierStoryCredit === 'function' &&
      hasClearedFullStarMap(game) && hasFrontierStoryCredit(game)) {
    return {
      kicker: "QUANTUM PREP",
      title: "Test a branch condition",
      body: "Quantum Gate needs one branch proof. Set fuel low, then let an if rule choose the warning path.",
      reward: "Reward: Quantum Branch Seed + Branch Lab card",
      action: "quantum",
      levelIndex: 0,
      kind: "quantum-branch",
      command: "player.fuel = 40\nif player.fuel < 50: player.say('branch A')"
    };
  }

  if (anomalyAlreadyTraced && darkMatterEvidenceReady && quantumBranchSeeded && !quantumChanceSeeded &&
      typeof hasClearedFullStarMap === 'function' && typeof hasFrontierStoryCredit === 'function' &&
      hasClearedFullStarMap(game) && hasFrontierStoryCredit(game)) {
    return {
      kicker: "QUANTUM CHANCE",
      title: "Test chance branch",
      body: "Quantum Gate needs one probability proof. Run chance(50) so the same rule can pick different paths across trials.",
      reward: "Reward: Quantum Probability Seed + Probability Lab card",
      action: "quantum-chance",
      levelIndex: 0,
      kind: "quantum-chance",
      command: "if chance(50): player.say('path A')"
    };
  }

  if (futureSourceReady && futureSourceTested && !futureSourceReflected) {
    return {
      kicker: "SOURCE KEY TESTED",
      title: "Explain the source key",
      body: "Source rehearsal is tested. Open the Log and write how hidden-force clues plus branch/chance evidence tune the source key.",
      reward: "Reward: Source Key Reflection Proof",
      action: "log",
      kind: "source-reflection",
      cta: "WRITE PROOF"
    };
  }

  if (futureSourceReady && !futureSourceTested) {
    return {
      kicker: "FUTURE SOURCE",
      title: "Run source rehearsal",
      body: "All Future Lab seeds are banked. Run a Frontier remix as a source-key rehearsal and compare hidden-force evidence with branch and chance patterns.",
      reward: "Reward: Source Key record + share code",
      action: "future-source",
      kind: "future-source"
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

  const codeConceptTarget = getActiveCodeConceptTarget(game);
  if (codeConceptTarget) {
    return {
      kicker: "NEXT CODE CONCEPT",
      title: `Collect ${codeConceptTarget.title}`,
      body: `${codeConceptTarget.body} Try ${codeConceptTarget.command}.`,
      reward: codeConceptTarget.reward,
      action: "code-concept",
      kind: codeConceptTarget.concept,
      command: codeConceptTarget.command,
      stageTitle: `Code Concept: ${codeConceptTarget.title}`
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
    const focus = daily.labContract && daily.labContract.title
      ? ` Focus: ${daily.labContract.title}.`
      : "";
    return {
      kicker: "NEXT LAB QUEST",
      title: "Clear today's signal",
      body: `${daily.concept || "A fresh science remix"} on ${daily.planetName || "today's world"} is ready for another experiment run.${focus}`,
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

function getStartResumeTestCue() {
  const entries = (typeof notebookEntries !== 'undefined' && notebookEntries && typeof notebookEntries === 'object')
    ? notebookEntries
    : {};
  let best = null;
  let order = 0;
  Object.keys(entries).forEach(key => {
    order++;
    const entry = entries[key] || {};
    const cue = entry.nextExperiment || null;
    const command = cue && cue.command ? String(cue.command).trim() : "";
    if (!command) return;
    const updatedAt = Number(entry.updatedAtMs);
    const score = Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : order;
    if (best && score < best.score) return;
    best = {
      missionId: key,
      missionTitle: entry.title || "Science Notebook",
      title: cue.title || "Resume the next test",
      body: cue.body || "Stage the saved command, run it, and compare the new evidence.",
      command,
      kind: cue.kind || "reflection",
      score
    };
  });
  return best;
}

function updateStartResumeTestCard(cue = getStartResumeTestCue()) {
  const card = document.getElementById("start-resume-test");
  if (!card) return;
  const visible = !!(cue && cue.command);
  if (card.classList && typeof card.classList.toggle === "function") {
    card.classList.toggle("hidden", !visible);
  } else if (card.style) {
    card.style.display = visible ? "" : "none";
  }
  if (!visible) return;
  const label = document.getElementById("start-resume-test-label");
  const title = document.getElementById("start-resume-test-title");
  const body = document.getElementById("start-resume-test-body");
  const code = document.getElementById("start-resume-test-code");
  const button = document.getElementById("start-resume-test-btn");
  if (label) label.textContent = "RESUME LAB CHAIN";
  if (title) title.textContent = cue.title;
  if (body) body.textContent = `${cue.missionTitle}: ${cue.body}`;
  if (code) code.textContent = cue.command;
  if (button) {
    button.textContent = "STAGE NEXT TEST";
    button.title = "Put this saved next-test command into the terminal.";
    button.dataset.command = cue.command;
    button.dataset.title = cue.title;
    button.dataset.kind = cue.kind || "reflection";
  }
}

function compactStartObjectiveCommand(command) {
  return String(command || "")
    .split(/\n/)
    .map(line => line.trim())
    .find(Boolean) || "";
}

function getStartObjectiveQueue(game = window.Game, context = {}) {
  const quest = context.quest || getActiveLabQuest(game);
  const radarAction = context.action || getStartMissionRadarAction(game, quest);
  const resumeCue = context.resumeCue !== undefined ? context.resumeCue : getStartResumeTestCue();
  const cadetPreview = context.cadetPreview || getCadetIdentityPreview(game);
  const queue = [];
  const seen = new Set();
  const add = (item) => {
    if (!item || !item.title) return;
    const key = item.key || `${item.action || "note"}:${item.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({
      label: item.label || "NEXT",
      title: item.title,
      body: item.body || "",
      reward: item.reward || "",
      cta: item.cta || "",
      action: item.action || null,
      cardId: item.cardId || "",
      missionId: item.missionId || "",
      command: item.command || "",
      kind: item.kind || "",
      source: item.source || "",
      color: item.color || "",
      levelIndex: Number.isFinite(Number(item.levelIndex)) ? Number(item.levelIndex) : null,
      stageTitle: item.stageTitle || "",
      progress: item.progress && typeof item.progress === "object" ? item.progress : null,
      priority: queue.length + 1
    });
  };

  if (quest && radarAction) {
    add({
      key: "radar",
      label: String(quest.kicker || "LAB QUEST").replace(/^NEXT\s+/i, "") || "LAB QUEST",
      title: quest.title,
      body: quest.body,
      reward: quest.reward,
      cta: radarAction.label || "START",
      action: "radar"
    });
  }

  if (resumeCue && resumeCue.command) {
    add({
      key: `resume:${resumeCue.command}`,
      label: "RESUME LAB",
      title: resumeCue.title || "Resume the next test",
      body: `${resumeCue.missionTitle || "Science Notebook"}: ${resumeCue.body || "Stage the saved command and compare new evidence."}`,
      reward: `Saved proof loop${compactStartObjectiveCommand(resumeCue.command) ? ` · ${compactStartObjectiveCommand(resumeCue.command)}` : ""}`,
      cta: "STAGE TEST",
      action: "resume",
      command: resumeCue.command,
      kind: resumeCue.kind || "reflection"
    });
  }

  const lessonAction = cadetPreview && cadetPreview.lessonPathAction;
  if (lessonAction && lessonAction.missionId) {
    const progress = getLessonPathPortfolioProgress(game);
    const lessonCommand = compactStartObjectiveCommand(lessonAction.command);
    add({
      key: `lesson:${lessonAction.missionId}`,
      label: "LESSON PATH",
      title: lessonAction.stageTitle || lessonAction.title || "Next lesson path",
      body: lessonCommand ? `One focused tweak: ${lessonCommand}` : "Run the next focused coding and science lesson.",
      reward: progress && progress.total ? `Lesson Paths ${progress.earned}/${progress.total}` : "Lesson proof",
      cta: lessonAction.label || "RUN LESSON",
      action: "lesson-path",
      missionId: lessonAction.missionId,
      command: lessonAction.command || "",
      kind: "lesson-path"
    });
  }

  const aiAction = cadetPreview && cadetPreview.aiAction;
  if (aiAction && aiAction.cardId) {
    const deck = typeof getAIStateDeckProgress === "function" ? getAIStateDeckProgress(game) : null;
    const card = deck && Array.isArray(deck.cards)
      ? deck.cards.find(item => item && item.id === aiAction.cardId)
      : null;
    add({
      key: `ai:${aiAction.cardId}`,
      label: "AI STATE",
      title: card && card.title ? card.title : (aiAction.title || "Next behavior proof"),
      body: aiAction.body || (card && card.next) || "Run the next behavior proof and watch the state change.",
      reward: deck ? `${deck.earnedCount}/${deck.total} AI states logged` : "State machine proof",
      cta: aiAction.label || "RUN STATE",
      action: "ai-state",
      cardId: aiAction.cardId
    });
  }

  const codeConceptTarget = typeof getActiveCodeConceptTarget === "function" ? getActiveCodeConceptTarget(game) : null;
  const radarAlreadyCodeConcept = !!(radarAction && radarAction.action === "code-concept");
  const codeConceptCommand = codeConceptTarget && codeConceptTarget.command ? String(codeConceptTarget.command).trim() : "";
  if (codeConceptTarget && codeConceptCommand && !radarAlreadyCodeConcept) {
    add({
      key: `code-concept:${codeConceptTarget.concept}`,
      label: "CODE CONCEPT",
      title: `Collect ${codeConceptTarget.title}`,
      body: `${codeConceptTarget.body} Try ${codeConceptCommand}.`,
      reward: codeConceptTarget.reward,
      cta: "STAGE IDEA",
      action: "code-concept",
      command: codeConceptCommand,
      kind: codeConceptTarget.concept || "code-concept",
      source: "start-code-concept",
      color: codeConceptTarget.color || "#93c5fd",
      levelIndex: Number.isFinite(Number(game && game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0,
      stageTitle: `Code Concept: ${codeConceptTarget.title}`,
      progress: {
        mode: "code-concept",
        value: codeConceptTarget.count,
        total: codeConceptTarget.total,
        label: `${codeConceptTarget.count}/${codeConceptTarget.total} ideas`
      }
    });
  }

  const labChain = typeof getLabChainTarget === "function" ? getLabChainTarget(game) : null;
  const labChainCommand = labChain && labChain.command ? String(labChain.command).trim() : "";
  if (labChain && labChainCommand && labChainCommand !== codeConceptCommand) {
    const progress = typeof getLabChainProgressMeta === "function" ? getLabChainProgressMeta(game, labChain) : null;
    add({
      key: `lab-chain:${labChainCommand}`,
      label: labChain.label || "LAB CHAIN",
      title: labChain.title || "Make one fresh change",
      body: labChain.body || "Change one variable, run it, and compare the new result.",
      reward: labChain.reward || "Next new progress keeps the chain alive",
      cta: "STAGE CHAIN",
      action: "lab-chain",
      command: labChainCommand,
      kind: labChain.kind || "lab-chain",
      source: "start-lab-chain",
      color: labChain.state === "paused" ? "#cbd5e1" : "#67e8f9",
      levelIndex: Number.isFinite(Number(game && game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0,
      stageTitle: labChain.title || "Lab chain",
      progress
    });
  }

  const daily = game && typeof game.getDailySignal === "function" ? game.getDailySignal() : null;
  const dailyAlreadyPrimary = radarAction && radarAction.action === "daily";
  if (daily && !dailyAlreadyPrimary) {
    const focus = getDailySignalActionFocus(game);
    add({
      key: "daily",
      label: "DAILY SIGNAL",
      title: focus && focus.title ? focus.title : "Today's signal",
      body: daily.concept || "A fresh science remix is ready.",
      reward: "Daily clear + share code",
      cta: "ACCEPT",
      action: "daily"
    });
  }

  return queue.slice(0, 4).map((item, index) => ({
    ...item,
    priority: index + 1
  }));
}

function updateStartObjectiveQueue(game, queue) {
  const panel = document.getElementById("start-objective-queue");
  if (game) game.lastStartObjectiveQueue = Array.isArray(queue) ? queue : [];
  if (!panel) return;
  const items = Array.isArray(queue) ? queue : [];
  const visible = items.length > 0;
  if (panel.classList && typeof panel.classList.toggle === "function") {
    panel.classList.toggle("hidden", !visible);
  } else if (panel.style) {
    panel.style.display = visible ? "" : "none";
  }
  if (!visible) {
    panel.innerHTML = "";
    return;
  }
  const itemClass = (item) => {
    const raw = `${item.source || item.action || item.kind || "objective"}`.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    return raw ? ` ${raw}` : "";
  };
  panel.innerHTML = `
    <div class="start-objective-queue-head">
      <span>NEXT OBJECTIVE QUEUE</span>
      <strong>${escapeHTML(items[0].cta || "RUN NEXT")}</strong>
    </div>
    <div class="start-objective-queue-list">
      ${items.map(item => `
        <div class="start-objective-item${itemClass(item)}">
          <span>#${item.priority} ${escapeHTML(item.label)}</span>
          <strong>${escapeHTML(item.title)}</strong>
          <p>${escapeHTML(item.body)}</p>
          ${renderObjectiveLearningContract(item)}
          ${item.command ? `<code class="start-objective-code">${escapeHTML(compactStartObjectiveCommand(item.command))}</code>` : ""}
          ${renderStartObjectiveProgress(item)}
          ${(item.reward || item.cta) ? `<em>${escapeHTML(`${item.reward || "Reward ready"}${item.cta ? ` · ${item.cta}` : ""}`)}</em>` : ""}
          ${item.action ? `<button type="button" class="start-objective-action-btn" onclick="runStartObjectiveQueueAction(${item.priority})">${escapeHTML(item.cta || "RUN")}</button>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderObjectiveLearningContract(item, className = "start-objective-contract") {
  const contract = getObjectiveLearningContract(item);
  return contract ? `<div class="${escapeHTML(className)}">${escapeHTML(contract)}</div>` : "";
}

function renderStartObjectiveProgress(item) {
  const progress = item && item.progress && typeof item.progress === "object" ? item.progress : null;
  if (!progress) return "";
  const rawTotal = Math.max(1, Math.floor(Number(progress.total) || 1));
  const total = Math.max(1, Math.min(6, rawTotal));
  const rawValue = Math.max(0, Math.floor(Number(progress.value) || 0));
  const value = Math.max(0, Math.min(total, rawTotal > total ? Math.round((rawValue / rawTotal) * total) : rawValue));
  const mode = String(progress.mode || "progress").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const label = progress.label || `${rawValue}/${rawTotal}`;
  const pips = Array.from({ length: total }, (_, index) =>
    `<i class="${index < value ? "filled" : (index === value ? "next" : "")}" aria-hidden="true"></i>`
  ).join("");
  return `
    <div class="start-objective-progress ${escapeHTML(mode)}" aria-label="${escapeHTML(label)}">
      <span>${escapeHTML(label)}</span>
      <div>${pips}</div>
    </div>
  `;
}

function updateStartMissionRadar(game = window.Game) {
  const panel = document.getElementById("start-mission-radar");
  if (!panel) return;
  const quest = getActiveLabQuest(game);
  const collection = getFormulaCollection(game);
  const rank = getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0);
  const unlockPreview = getResearchUnlockPreview(rank);
  const cadetPreview = getCadetIdentityPreview(game);
  const storyPreview = getStartSignalStoryPreview(game);
  const worldPreview = getStartWorldMasteryPreview(game);
  const villagePreview = getStartVillageTrustPreview(game);
  const proofPreview = getStartLabStarProofPreview(game);
  const chainMilestone = getActiveLabChainMilestone(game);
  const action = getStartMissionRadarAction(game, quest);
  const resumeCue = getStartResumeTestCue();
  const objectiveQueue = getStartObjectiveQueue(game, { quest, action, cadetPreview, resumeCue });
  const kicker = panel.querySelector ? panel.querySelector(".start-mission-radar-head span") : null;
  const progress = document.getElementById("start-mission-radar-progress");
  const title = document.getElementById("start-mission-radar-title");
  const body = document.getElementById("start-mission-radar-body");
  const reward = document.getElementById("start-mission-radar-reward");
  const button = document.getElementById("start-mission-radar-btn");
  const cadetLabel = document.getElementById("start-cadet-identity-label");
  const cadetTitle = document.getElementById("start-cadet-identity-title");
  const cadetBody = document.getElementById("start-cadet-identity-body");
  const cadetBar = document.getElementById("start-cadet-identity-bar");
  const cadetAIButton = document.getElementById("start-cadet-ai-btn");
  const cadetLessonButton = document.getElementById("start-cadet-lesson-btn");
  const unlockLabel = document.getElementById("start-rank-preview-label");
  const unlockTitle = document.getElementById("start-rank-preview-title");
  const unlockBody = document.getElementById("start-rank-preview-body");
  const unlockBar = document.getElementById("start-rank-preview-bar");
  const worldLabel = document.getElementById("start-world-preview-label");
  const worldTitle = document.getElementById("start-world-preview-title");
  const worldBody = document.getElementById("start-world-preview-body");
  const worldBar = document.getElementById("start-world-preview-bar");
  const villageLabel = document.getElementById("start-village-preview-label");
  const villageTitle = document.getElementById("start-village-preview-title");
  const villageBody = document.getElementById("start-village-preview-body");
  const villageBar = document.getElementById("start-village-preview-bar");
  const proofLabel = document.getElementById("start-proof-preview-label");
  const proofTitle = document.getElementById("start-proof-preview-title");
  const proofBody = document.getElementById("start-proof-preview-body");
  const proofStars = document.getElementById("start-proof-preview-stars");
  const storyLabel = document.getElementById("start-story-preview-label");
  const storyTitle = document.getElementById("start-story-preview-title");
  const storyBody = document.getElementById("start-story-preview-body");
  const storyProgress = document.getElementById("start-story-preview-progress");
  updateStartResumeTestCard(resumeCue);
  updateStartObjectiveQueue(game, objectiveQueue);

  if (kicker) kicker.textContent = quest ? quest.kicker.replace(/^NEXT\s+/i, "") : "MISSION RADAR";
  if (progress) progress.textContent = `${collection.unlocked.length}/${collection.cards.length} formulas · ${Math.round(rank.xp)} XP`;
  if (title) title.textContent = quest ? quest.title : "Keep experimenting";
  if (body) body.textContent = quest ? quest.body : "Run Mission Coach code, collect formula cards, and improve your lab record.";
  if (reward) reward.textContent = quest ? quest.reward : "Reward: stronger science record";
  if (cadetLabel) cadetLabel.textContent = cadetPreview.label;
  if (cadetTitle) cadetTitle.textContent = cadetPreview.title;
  if (cadetBody) cadetBody.textContent = cadetPreview.body;
  if (cadetBar && cadetBar.style) cadetBar.style.width = `${Math.round(cadetPreview.progress * 100)}%`;
  if (cadetAIButton) {
    const aiAction = cadetPreview.aiAction;
    const visible = !!(aiAction && aiAction.cardId);
    if (cadetAIButton.classList && typeof cadetAIButton.classList.toggle === "function") {
      cadetAIButton.classList.toggle("hidden", !visible);
    } else if (cadetAIButton.style) {
      cadetAIButton.style.display = visible ? "" : "none";
    }
    cadetAIButton.textContent = visible ? aiAction.label : "RUN AI STATE";
    cadetAIButton.title = visible ? aiAction.title : "";
    if (cadetAIButton.dataset) {
      cadetAIButton.dataset.state = visible ? aiAction.cardId : "";
      cadetAIButton.dataset.label = visible ? aiAction.label : "";
    }
  }
  if (cadetLessonButton) {
    const lessonAction = cadetPreview.lessonPathAction;
    const visible = !!(lessonAction && lessonAction.missionId);
    if (cadetLessonButton.classList && typeof cadetLessonButton.classList.toggle === "function") {
      cadetLessonButton.classList.toggle("hidden", !visible);
    } else if (cadetLessonButton.style) {
      cadetLessonButton.style.display = visible ? "" : "none";
    }
    cadetLessonButton.textContent = visible ? lessonAction.label : "RUN LESSON";
    cadetLessonButton.title = visible ? lessonAction.title : "";
    if (cadetLessonButton.dataset) {
      cadetLessonButton.dataset.mission = visible ? lessonAction.missionId : "";
      cadetLessonButton.dataset.level = visible ? String(lessonAction.levelIndex) : "";
      cadetLessonButton.dataset.command = visible ? (lessonAction.command || "") : "";
      cadetLessonButton.dataset.stageTitle = visible ? (lessonAction.stageTitle || "") : "";
    }
  }
  if (unlockLabel) unlockLabel.textContent = unlockPreview.label;
  if (unlockTitle) unlockTitle.textContent = unlockPreview.title;
  if (unlockBody) {
    unlockBody.textContent = chainMilestone
      ? `${unlockPreview.body} Lab chain: ${chainMilestone.preview}`
      : unlockPreview.body;
  }
  if (unlockBar && unlockBar.style) unlockBar.style.width = `${Math.round(unlockPreview.progress * 100)}%`;
  if (worldLabel) worldLabel.textContent = worldPreview.label;
  if (worldTitle) worldTitle.textContent = worldPreview.title;
  if (worldBody) worldBody.textContent = worldPreview.body;
  if (worldBar && worldBar.style) worldBar.style.width = `${Math.round(worldPreview.progress * 100)}%`;
  if (villageLabel) villageLabel.textContent = villagePreview.label;
  if (villageTitle) villageTitle.textContent = villagePreview.title;
  if (villageBody) villageBody.textContent = villagePreview.body;
  if (villageBar && villageBar.style) villageBar.style.width = `${Math.round(villagePreview.progress * 100)}%`;
  const villagePanel = document.getElementById("start-village-preview");
  if (villagePanel && villagePanel.classList) {
    ["safe", "wait", "night", "danger"].forEach(state => villagePanel.classList.remove(`village-signal-${state}`));
    villagePanel.classList.add(`village-signal-${villagePreview.stateClass || "safe"}`);
  }
  if (proofLabel) proofLabel.textContent = proofPreview.label;
  if (proofTitle) proofTitle.textContent = proofPreview.title;
  if (proofBody) proofBody.textContent = proofPreview.body;
  if (proofStars) {
    if (typeof proofStars.setAttribute === "function") {
      proofStars.setAttribute("aria-label", `${proofPreview.stars} of ${proofPreview.maxStars} Lab Stars ready`);
    }
    proofStars.innerHTML = Array.from({ length: proofPreview.maxStars }, (_, index) =>
      `<span class="${index < proofPreview.stars ? "earned" : ""}">★</span>`
    ).join("");
  }
  if (storyLabel) storyLabel.textContent = storyPreview.label;
  if (storyTitle) storyTitle.textContent = storyPreview.title;
  if (storyBody) storyBody.textContent = storyPreview.body;
  if (storyProgress) storyProgress.textContent = storyPreview.progress;
  if (button) {
    button.textContent = action.label;
    button.title = action.title;
    button.dataset.action = action.action;
    button.dataset.level = String(action.levelIndex);
    button.dataset.command = action.command || "";
    button.dataset.kind = action.kind || "";
    button.dataset.stageTitle = action.stageTitle || "";
  }
}

function runStartCadetAIAction() {
  const game = window.Game || (typeof Game !== 'undefined' ? Game : null);
  const button = document.getElementById("start-cadet-ai-btn");
  const cardId = button && button.dataset ? String(button.dataset.state || "").trim() : "";
  if (!cardId || typeof runAIStateDeckAction !== 'function') return false;
  return runAIStateDeckAction(cardId, game);
}

function runCadetLessonPathAction(missionId = null, game = window.Game || (typeof Game !== 'undefined' ? Game : null)) {
  if (!game || typeof game.startLevel !== "function") return false;
  const fallback = typeof getCadetIdentityPreview === "function"
    ? (getCadetIdentityPreview(game).lessonPathAction || null)
    : null;
  const id = missionId || (fallback && fallback.missionId) || "";
  const mission = (typeof PlatformerMissions !== "undefined" && Array.isArray(PlatformerMissions))
    ? PlatformerMissions.find(item => item && item.id === id)
    : null;
  if (!mission) return false;
  const levelIndex = getLessonPathMissionLevelIndex(mission);
  const command = getLessonPathStageCommand(game, mission);
  game.startLevel(levelIndex);
  if (typeof switchMainMode === "function") switchMainMode("terminal");
  if (command && typeof stageScienceDeltaCommand === "function") {
    stageScienceDeltaCommand(command, {
      title: mission.title || "Lesson path",
      kind: "lesson-path",
      source: "cadet-lesson-path",
      game
    });
  }
  return true;
}

function runStartCadetLessonPathAction() {
  const game = window.Game || (typeof Game !== 'undefined' ? Game : null);
  const button = document.getElementById("start-cadet-lesson-btn");
  const missionId = button && button.dataset ? String(button.dataset.mission || "").trim() : "";
  return runCadetLessonPathAction(missionId, game);
}

function runStartResumeTestAction() {
  const button = document.getElementById("start-resume-test-btn");
  const command = button && button.dataset ? String(button.dataset.command || "").trim() : "";
  if (!command || typeof stageScienceDeltaCommand !== 'function') return false;
  return stageScienceDeltaCommand(command, {
    title: button.dataset.title || "Resume lab chain",
    kind: button.dataset.kind || "reflection",
    source: "start-resume-proof",
    color: "#bef264"
  });
}

function runStartObjectiveQueueAction(priority = 1) {
  const game = window.Game || (typeof Game !== 'undefined' ? Game : null);
  const queue = game && Array.isArray(game.lastStartObjectiveQueue) ? game.lastStartObjectiveQueue : [];
  const item = queue.find(entry => entry && entry.priority === Number(priority));
  if (!item || !item.action) return false;
  if (item.action === "radar") return runStartMissionRadarAction();
  if (item.action === "resume") {
    if (!item.command || typeof stageScienceDeltaCommand !== 'function') return false;
    return stageScienceDeltaCommand(item.command, {
      title: item.title || "Resume lab chain",
      kind: item.kind || "reflection",
      source: "start-objective-queue",
      color: "#bef264"
    });
  }
  if (item.action === "lesson-path") {
    return runCadetLessonPathAction(item.missionId || null, game);
  }
  if (item.action === "ai-state") {
    if (!item.cardId || typeof runAIStateDeckAction !== 'function') return false;
    return runAIStateDeckAction(item.cardId, game);
  }
  if (item.action === "code-concept" || item.action === "lab-chain") {
    const command = item.command ? String(item.command).trim() : "";
    if (game && typeof game.startLevel === "function") {
      const level = Number.isFinite(Number(item.levelIndex))
        ? Number(item.levelIndex)
        : (Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0);
      game.startLevel(level);
    }
    if (typeof switchMainMode === "function") switchMainMode("terminal");
    if (!command || typeof stageScienceDeltaCommand !== "function") return !!(game && typeof game.startLevel === "function");
    return stageScienceDeltaCommand(command, {
      title: item.stageTitle || item.title || (item.action === "lab-chain" ? "Lab chain" : "Code Concept"),
      kind: item.kind || (item.action === "lab-chain" ? "lab-chain" : "code-concept"),
      source: item.source || (item.action === "lab-chain" ? "start-lab-chain" : "start-code-concept"),
      color: item.color || (item.action === "lab-chain" ? "#67e8f9" : "#93c5fd"),
      game
    });
  }
  if (item.action === "daily") {
    return runDailySignalAction(game);
  }
  if (item.action === "log") {
    if (typeof switchMainMode === 'function') switchMainMode("notebook");
    return true;
  }
  return false;
}

function getDailySignalActionFocus(game = window.Game || (typeof Game !== 'undefined' ? Game : null)) {
  if (game && typeof game.getReturnStreakDailyFocus === 'function') {
    return game.getReturnStreakDailyFocus();
  }
  const daily = game && typeof game.getDailySignal === 'function' ? game.getDailySignal() : null;
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

function runDailySignalAction(game = window.Game || (typeof Game !== 'undefined' ? Game : null)) {
  if (game && typeof game.startDailySignal === 'function') {
    const focus = getDailySignalActionFocus(game);
    const started = game.startDailySignal();
    if (started === false) return false;
    const command = focus && focus.command ? String(focus.command).trim() : "";
    if (command && typeof stageScienceDeltaCommand === 'function') {
      stageScienceDeltaCommand(command, {
        title: focus.title || "Daily Signal",
        source: "signal-lab-contract",
        color: "#67e8f9",
        kind: "daily-signal"
      });
    }
    return true;
  }
  return false;
}

function getFrontierChallengeActionFocus(game = window.Game || (typeof Game !== 'undefined' ? Game : null)) {
  const frontier = game && game.dailyInfo && game.dailyInfo.isFrontier
    ? game.dailyInfo
    : (game && typeof game.getFrontierChallenge === 'function' ? game.getFrontierChallenge() : null);
  const contract = frontier && frontier.labContract ? frontier.labContract : null;
  const title = (contract && contract.title) || (frontier && frontier.concept) || (frontier && frontier.planetName) || "Frontier Challenge";
  const command = contract && contract.command ? String(contract.command).trim() : "";
  const firstCommand = command.split(/\n/).map(line => line.trim()).find(Boolean) || "";
  const kind = frontier && frontier.futureSourcePrep
    ? "future-source"
    : (frontier && frontier.darkMatterPrep
      ? "dark-matter-prep"
      : (frontier && frontier.darkMatterEcho ? "dark-matter-echo" : "frontier-signal"));
  return {
    title,
    command,
    firstCommand,
    kind
  };
}

function runFrontierChallengeAction(game = window.Game || (typeof Game !== 'undefined' ? Game : null), options = undefined) {
  if (game && typeof game.startFrontierChallenge === 'function') {
    const started = game.startFrontierChallenge(options);
    if (started === false) return false;
    const focus = getFrontierChallengeActionFocus(game);
    const command = focus && focus.command ? String(focus.command).trim() : "";
    if (command && typeof stageScienceDeltaCommand === 'function') {
      stageScienceDeltaCommand(command, {
        title: focus.title || "Frontier Challenge",
        source: "signal-lab-contract",
        color: "#c4b5fd",
        kind: focus.kind || "frontier-signal"
      });
    }
    return true;
  }
  return false;
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
  if (q && q.action === "anomaly") {
    return {
      action: "anomaly",
      label: "TRACE FORCE",
      title: "Stage the hidden-force event and launch Mag-Net.",
      levelIndex: Number.isFinite(Number(q.levelIndex)) ? Number(q.levelIndex) : 4,
      command: q.command || "",
      kind: q.kind || "anomaly",
      stageTitle: q.title || "Trace hidden force"
    };
  }
  if (q && q.action === "dark-matter-prep") {
    return {
      action: "frontier",
      label: "RUN PREP",
      title: "Start a Frontier remix to bank hidden-force curve evidence.",
      levelIndex: currentLevel,
      kind: q.kind || "frontier"
    };
  }
  if (q && q.action === "future-source") {
    return {
      action: "frontier",
      label: "RUN SOURCE",
      title: "Start a Frontier source-key rehearsal.",
      levelIndex: currentLevel,
      kind: q.kind || "future-source"
    };
  }
  if (q && q.action === "log") {
    return {
      action: "log",
      label: q.cta || "OPEN LOG",
      title: "Open the Log to save the current proof.",
      levelIndex: currentLevel,
      kind: q.kind || "log"
    };
  }
  if (q && q.action === "quantum") {
    return {
      action: "quantum",
      label: "TEST BRANCH",
      title: "Stage the conditional branch prototype and launch Earth.",
      levelIndex: Number.isFinite(Number(q.levelIndex)) ? Number(q.levelIndex) : 0,
      command: q.command || "",
      kind: q.kind || "quantum-branch",
      stageTitle: q.title || "Test a branch condition"
    };
  }
  if (q && q.action === "quantum-chance") {
    return {
      action: "quantum-chance",
      label: "TEST CHANCE",
      title: "Stage the probability branch prototype and launch Earth.",
      levelIndex: Number.isFinite(Number(q.levelIndex)) ? Number(q.levelIndex) : 0,
      command: q.command || "",
      kind: q.kind || "quantum-chance",
      stageTitle: q.title || "Test chance branch"
    };
  }
  if (q && q.action === "code-concept") {
    return {
      action: "code-concept",
      label: "STAGE IDEA",
      title: "Stage the next coding idea sample.",
      levelIndex: currentLevel,
      command: q.command || "",
      kind: q.kind || "code-concept",
      stageTitle: q.stageTitle || q.title || "Code Concept"
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
    return runDailySignalAction(game);
  }
  if (action === "frontier" && game && typeof game.startFrontierChallenge === 'function') {
    const kind = button && button.dataset ? String(button.dataset.kind || "") : "";
    const options = kind === "dark-matter-prep"
      ? { source: "dark-matter-prep" }
      : (kind === "future-source" ? { source: "future-source" } : undefined);
    return runFrontierChallengeAction(game, options);
  }
  if (action === "log") {
    if (typeof switchMainMode === 'function') switchMainMode('notebook');
    return true;
  }
  if (action === "anomaly") {
    const command = button && button.dataset ? String(button.dataset.command || "").trim() : "";
    const staged = command && typeof stageScienceDeltaCommand === 'function'
      ? stageScienceDeltaCommand(command, {
        title: button.dataset.stageTitle || "Trace hidden force",
        kind: button.dataset.kind || "anomaly",
        source: "start-anomaly-trace",
        color: "#818cf8"
      })
      : false;
    const level = button && button.dataset ? Number(button.dataset.level) : 4;
    if (game && typeof game.startLevel === 'function') {
      game.startLevel(Number.isFinite(level) ? level : 4);
      return true;
    }
    return !!staged;
  }
  if (action === "quantum") {
    const command = button && button.dataset ? String(button.dataset.command || "").trim() : "";
    const staged = command && typeof stageScienceDeltaCommand === 'function'
      ? stageScienceDeltaCommand(command, {
        title: button.dataset.stageTitle || "Test a branch condition",
        kind: button.dataset.kind || "quantum-branch",
        source: "start-quantum-branch",
        color: "#22d3ee"
      })
      : false;
    const level = button && button.dataset ? Number(button.dataset.level) : 0;
    if (game && typeof game.startLevel === 'function') {
      game.startLevel(Number.isFinite(level) ? level : 0);
      return true;
    }
    return !!staged;
  }
  if (action === "quantum-chance") {
    const command = button && button.dataset ? String(button.dataset.command || "").trim() : "";
    const staged = command && typeof stageScienceDeltaCommand === 'function'
      ? stageScienceDeltaCommand(command, {
        title: button.dataset.stageTitle || "Test chance branch",
        kind: button.dataset.kind || "quantum-chance",
        source: "start-quantum-chance",
        color: "#38bdf8"
      })
      : false;
    const level = button && button.dataset ? Number(button.dataset.level) : 0;
    if (game && typeof game.startLevel === 'function') {
      game.startLevel(Number.isFinite(level) ? level : 0);
      return true;
    }
    return !!staged;
  }
  if (action === "code-concept") {
    const command = button && button.dataset ? String(button.dataset.command || "").trim() : "";
    const level = button && button.dataset ? Number(button.dataset.level) : NaN;
    if (game && typeof game.startLevel === 'function') {
      game.startLevel(Number.isFinite(level) ? level : (Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0));
    }
    const staged = command && typeof stageScienceDeltaCommand === 'function'
      ? stageScienceDeltaCommand(command, {
        title: button.dataset.stageTitle || "Code Concept",
        kind: button.dataset.kind || "code-concept",
        source: "start-code-concept",
        color: "#93c5fd"
      })
      : false;
    return !!(staged || (game && typeof game.startLevel === 'function'));
  }
  if (game && typeof game.startLevel === 'function') {
    const level = button && button.dataset ? Number(button.dataset.level) : NaN;
    game.startLevel(Number.isFinite(level) ? level : (Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0));
    return true;
  }
  return false;
}

function runReturnStreakAction(game = window.Game || (typeof Game !== 'undefined' ? Game : null)) {
  return runDailySignalAction(game);
}

function updateFormulaTarget(game) {
  const panel = document.getElementById("formula-target");
  if (!panel) return;
  const collection = getFormulaCollection(game);
  const target = getActiveFormulaTarget(game);
  if (!target) {
    panel.classList.remove("hidden");
    const hasHiddenNext = collection.locked && collection.locked.length > 0;
    panel.innerHTML = `
      <div class="formula-target-head">
        <span>FORMULA DECK</span>
        <strong>${hasHiddenNext ? `${collection.unlocked.length}/${collection.cards.length}` : "Complete"}</strong>
      </div>
      <div class="formula-target-body">${hasHiddenNext ? "Finish the current mission step to reveal the next formula card." : "All formula cards collected. Keep experimenting for better ranks and mastery clears."}</div>
    `;
    return;
  }
  panel.classList.remove("hidden");
  const sample = target.sampleCode || target.cue || "";
  const axis = target.axis || target.formula || "One science idea";
  const move = target.move || "Change one code value";
  const payoff = target.payoff || `Collect ${target.title} + Research XP`;
  panel.innerHTML = `
    <div class="formula-target-head">
      <span>NEXT FORMULA CARD</span>
      <strong>${collection.unlocked.length}/${collection.cards.length}</strong>
    </div>
    <div class="formula-target-title">${escapeHTML(target.title)}</div>
    <div class="formula-target-body">${escapeHTML(target.cue)}</div>
    <div class="formula-target-steps">
      <span><b>LEARN</b>${escapeHTML(axis)}</span>
      <span><b>CODE</b>${escapeHTML(move)}</span>
      <span><b>WIN</b>${escapeHTML(payoff)}</span>
    </div>
    <code class="formula-target-code">${escapeHTML(sample)}</code>
    ${sample ? `<button type="button" class="formula-target-stage-btn" data-formula-stage="1">STAGE CODE</button>` : ""}
  `;
  const stageBtn = panel.querySelector ? panel.querySelector("[data-formula-stage]") : null;
  if (stageBtn && typeof stageBtn.addEventListener === "function") {
    stageBtn.addEventListener("click", () => stageScienceDeltaCommand(sample, {
      title: target.title,
      kind: target.kind,
      source: "formula-target",
      color: "#bef264"
    }));
  }
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
    code: String(code || "").trim().slice(0, 160),
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

function buildDiscoveryScienceDeltaProof(game, pulse) {
  const delta = game && game.lastScienceDelta ? game.lastScienceDelta : null;
  if (!game || !pulse || !delta || !Array.isArray(delta.changes) || !delta.changes.length) return null;
  const pulseCode = String(pulse.code || "").trim();
  const deltaCode = String(delta.code || "").trim();
  if (!pulseCode || !deltaCode || deltaCode.slice(0, pulseCode.length) !== pulseCode) return null;

  const primary = delta.changes.find(change => change && /Agility|Thrust|Mass|Felt gravity|Probability/.test(change.label || "")) || delta.changes[0];
  if (!primary) return null;
  const formulaChip = typeof game.getScienceDeltaFormulaChip === "function"
    ? game.getScienceDeltaFormulaChip(primary)
    : "code->evidence";
  const deltaChip = typeof game.getScienceDeltaValueDelta === "function"
    ? game.getScienceDeltaValueDelta(primary)
    : "";
  const codeLine = typeof game.getScienceDeltaCodeLine === "function"
    ? game.getScienceDeltaCodeLine(delta, primary)
    : `CODE ${pulseCode.split(/\n/).map(line => line.trim()).filter(Boolean)[0] || pulseCode}`;
  const targetCue = typeof game.getScienceDeltaTargetCue === "function"
    ? game.getScienceDeltaTargetCue(delta)
    : null;
  const next = delta.nextExperiment || null;
  const nextCommand = next && next.command ? String(next.command).trim() : "";
  const winLine = targetCue && targetCue.line
    ? targetCue.line
    : (next && next.title ? `NEXT ${next.title}` : "Bank evidence, then test the level");

  return {
    label: "SCIENCE PROOF",
    title: delta.summary || `${primary.label || "Value"} changed`,
    codeLine: codeLine.replace(/\s+/g, " ").trim(),
    valueLine: `${primary.label || "Value"}: ${primary.value || "changed"}`,
    relation: formulaChip,
    delta: deltaChip,
    reason: primary.cue || "",
    winLine,
    nextTitle: next && next.title ? next.title : "",
    nextCommand
  };
}

function getScienceCheckpointSourceKey(game, statKey, thresholdValue) {
  if (!statKey || !Number.isFinite(Number(thresholdValue))) return "";
  const index = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Math.floor(Number(game.currentPlanetIndex)) : 0;
  const threshold = Number(thresholdValue) >= 1 ? "ready" : String(Math.round(Number(thresholdValue) * 100));
  return `science-checkpoint:${index}:${String(statKey).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}:${threshold}`;
}

function getScienceCheckpointProofSourceKey(game, delta) {
  const target = delta && delta.missionTarget ? delta.missionTarget : null;
  if (!target || !target.key) return "";
  const rawThreshold = target.crossed ? 1 : (target.milestone && Number.isFinite(Number(target.milestone.threshold)) ? Number(target.milestone.threshold) : null);
  if (!Number.isFinite(rawThreshold)) return "";
  return getScienceCheckpointSourceKey(game, target.key, rawThreshold);
}

function getScienceCheckpointPreview(game) {
  const stat = game && typeof game.getMissionStat === "function" ? game.getMissionStat() : null;
  if (!stat || !stat.key || !Number.isFinite(Number(stat.value)) || !Number.isFinite(Number(stat.target)) || Number(stat.target) <= 0) return null;
  const value = Number(stat.value);
  const target = Number(stat.target);
  const progress = Math.max(0, Math.min(1, value / target));
  const passCounts = game && game.discoveryPassCounts && typeof game.discoveryPassCounts === "object" ? game.discoveryPassCounts : {};
  const steps = [
    { threshold: 0.5, label: "50% TARGET", title: "Halfway checkpoint", rewardXP: 3 },
    { threshold: 0.75, label: "75% TARGET", title: "Three-quarter checkpoint", rewardXP: 3 },
    { threshold: 0.9, label: "90% TARGET", title: "Almost-ready checkpoint", rewardXP: 3 },
    { threshold: 1, label: "TARGET READY", title: "Target ready proof", rewardXP: 5 }
  ];
  const next = steps.find(step => progress < step.threshold - 0.001) || null;
  if (!next) return null;
  const sourceKey = getScienceCheckpointSourceKey(game, stat.key, next.threshold);
  const claimed = !!(sourceKey && passCounts[sourceKey]);
  const checkpointValue = target * next.threshold;
  const gap = Math.max(0, checkpointValue - value);
  const fmt = typeof formatScienceDeltaValue === "function" ? formatScienceDeltaValue : (n => String(Math.round(Number(n) || 0)));
  const activeMission = typeof getActivePlatformerMission === "function" ? getActivePlatformerMission(game) : null;
  const resultState = activeMission && activeMission.fullMission && typeof evaluateMissionResultChecks === "function"
    ? evaluateMissionResultChecks(game, activeMission.fullMission)
    : null;
  const cue = typeof buildNextExperimentCue === "function" ? buildNextExperimentCue(game, resultState, activeMission) : null;
  return {
    label: claimed ? "CHECKPOINT LOGGED" : "NEXT CHECKPOINT",
    title: next.title,
    reward: claimed ? "Proof saved" : `+${next.rewardXP} XP proof`,
    statLabel: stat.label || "Target",
    statLine: `${stat.label || "Target"} ${fmt(value)}/${fmt(target)}`,
    checkpoint: next.label,
    gapLine: gap > 0.05 ? `Need +${fmt(gap)} to ${next.label}` : `Ready for ${next.label}`,
    progress,
    checkpointProgress: next.threshold,
    sourceKey,
    claimed,
    command: cue && cue.command ? String(cue.command).trim() : "",
    commandTitle: cue && cue.title ? cue.title : `Reach ${next.label}`
  };
}

function buildScienceCheckpointProof(game, delta) {
  const target = delta && delta.missionTarget ? delta.missionTarget : null;
  if (!target || (!target.crossed && !target.milestone)) return null;
  const sourceKey = getScienceCheckpointProofSourceKey(game, delta);
  if (!sourceKey) return null;
  const label = target.crossed ? "TARGET READY" : "TARGET CHECKPOINT";
  const checkpoint = target.crossed ? "100% TARGET" : (target.milestone && target.milestone.detail ? target.milestone.detail : "TARGET STEP");
  const title = target.crossed ? `${target.label || "Target"} ready` : (target.milestone && target.milestone.label ? target.milestone.label : "Target step");
  const fmt = typeof formatScienceDeltaValue === "function" ? formatScienceDeltaValue : (value => String(Math.round(Number(value) || 0)));
  const statLine = `${target.label || "Target"} ${fmt(target.after)}/${fmt(target.target)}`;
  const rewardXP = target.crossed ? 5 : 3;
  return {
    label,
    title,
    checkpoint,
    statLine,
    sourceKey,
    rewardXP,
    worldMasteryXP: target.crossed ? 7 : 4,
    code: String((delta && delta.code) || "").trim().slice(0, 160),
    progressLabel: target.crossed ? "target ready" : checkpoint.toLowerCase()
  };
}

function spawnScienceCheckpointProofEffect(game, proof) {
  if (!game || !proof || !game.player) return null;
  const baseX = Number.isFinite(game.player.x) ? game.player.x : 0;
  const baseY = Number.isFinite(game.player.y) ? game.player.y : 0;
  const width = Number.isFinite(game.player.w) ? game.player.w : 24;
  const height = Number.isFinite(game.player.h) ? game.player.h : 32;
  const px = baseX + width / 2;
  const py = baseY + height / 2;
  const color = proof.label === "TARGET READY" ? "#facc15" : "#67e8f9";
  if (typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    ComicBubbles.pop(px, baseY - 70, `+${proof.rewardXP} CHECKPOINT`, color, proof.label === "TARGET READY" ? 0.98 : 0.86);
  }
  if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
    Particles.spawnBurst(px, py - 12, color, proof.label === "TARGET READY" ? 12 : 8, 2.0, 1.9, "glow");
  }
  return { label: proof.label, color, rewardXP: proof.rewardXP, x: px, y: py };
}

function getMatchingScienceCheckpointProof(game, pulse) {
  const proof = game && game.lastScienceCheckpointProof ? game.lastScienceCheckpointProof : null;
  if (!proof || !pulse) return null;
  const pulseCode = String(pulse.code || "").trim();
  const proofCode = String(proof.code || "").trim();
  if (!pulseCode || !proofCode || proofCode.slice(0, pulseCode.length) !== pulseCode) return null;
  return proof;
}

function grantScienceCheckpointProof(game, delta) {
  const proof = buildScienceCheckpointProof(game, delta);
  if (!game || !proof) return null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  if (game.discoveryPassCounts[proof.sourceKey]) return null;

  game.discoveryPassCounts[proof.sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + proof.rewardXP);
  if (typeof game.awardWorldMasteryXP === "function") {
    const mastery = game.awardWorldMasteryXP(proof.worldMasteryXP, "science checkpoint", {
      sourceKey: proof.sourceKey,
      silent: true
    });
    proof.worldMasteryAddedXP = mastery && mastery.added > 0 ? mastery.added : 0;
  }
  proof.effect = spawnScienceCheckpointProofEffect(game, proof);
  game.lastScienceCheckpointProof = proof;
  if (delta) delta.scienceCheckpointProof = proof;

  const pulse = {
    kind: "science-checkpoint",
    title: proof.title || "Target Checkpoint",
    formula: "target progress -> proof",
    insight: `${proof.statLine} reached ${proof.checkpoint}. Partial target progress is evidence, not just setup.`,
    cue: "Keep one variable moving until the next checkpoint or the mission target.",
    missionId: "_science_checkpoint",
    missionTitle: "Science Target",
    code: proof.code,
    passed: 0,
    total: 0,
    openedGems: 0,
    rewardXP: proof.rewardXP,
    combo: game.discoveryCombo || 0,
    scienceCheckpointProof: proof
  };
  pulse.scienceDeltaProof = buildDiscoveryScienceDeltaProof(game, pulse);
  const codeConcept = grantCodeConceptProgress(game, pulse);
  if (codeConcept) pulse.codeConceptProof = codeConcept;
  if (codeConcept && codeConcept.complete && typeof game.grantCodeConceptDeckMastery === "function") {
    game.grantCodeConceptDeckMastery(pulse);
  }
  game.discoveryPulse = pulse;
  game.discoveryLog = [pulse].concat(Array.isArray(game.discoveryLog) ? game.discoveryLog : []).slice(0, 8);
  updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === "function") updateResearchProgress(game);
  const isLiveGame = typeof window !== "undefined" && window.Game === game;
  if (isLiveGame && typeof saveLocalProgress === "function") saveLocalProgress();
  return proof;
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
    pulse.scienceDeltaProof = buildDiscoveryScienceDeltaProof(game, pulse);
    const checkpointProof = getMatchingScienceCheckpointProof(game, pulse);
    if (checkpointProof) pulse.scienceCheckpointProof = checkpointProof;
    const codeConcept = grantCodeConceptProgress(game, pulse);
    if (codeConcept) pulse.codeConceptProof = codeConcept;
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
    if (pulse.hypothesisConfirmed && typeof game.spawnHypothesisEffect === 'function') {
      game.spawnHypothesisEffect(pulse);
    }
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      game.spawnDiscoveryComboEffect(pulse);
    }
    if (typeof game.grantDiscoveryComboMilestone === 'function') {
      game.grantDiscoveryComboMilestone(pulse, { deferResearchXP: true });
    }
    if (cardUnlocked && typeof game.spawnFormulaCardEffect === 'function') {
      game.spawnFormulaCardEffect(pulse);
    }
    if (typeof game.grantFormulaDeckMastery === 'function') {
      game.grantFormulaDeckMastery(pulse, { deferResearchXP: true });
    }
    if (codeConcept && codeConcept.complete && typeof game.grantCodeConceptDeckMastery === 'function') {
      game.grantCodeConceptDeckMastery(pulse, { deferResearchXP: true });
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
      if (typeof game.spawnResearchRankEffect === 'function') {
        pulse.rankEffect = game.spawnResearchRankEffect(pulse);
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
    if (afterRank && !pulse.nextLabUnlock && typeof getResearchUnlockPreview === 'function') {
      pulse.nextLabUnlock = getResearchUnlockPreview(afterRank);
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

function normalizeSignalLabProofPart(value) {
  return String(value || "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "signal";
}

function hashSignalLabCommand(command) {
  let hash = 2166136261;
  const text = String(command || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getSignalLabProofCandidate(game, code) {
  if (!game || game.remixContext !== 'daily' || !game.dailyInfo || !game.dailyInfo.labContract) return null;
  const signal = game.dailyInfo;
  const contract = signal.labContract;
  const runCode = String(code || "").trim();
  const contractCommand = String(contract.command || "").trim();
  if (!runCode || !contractCommand || runCode !== contractCommand) return null;

  const staged = game.lastStagedExperiment || null;
  const stagedMatch = !!(staged && staged.source === "signal-lab-contract" && String(staged.command || "").trim() === runCode);
  const sourceId = signal.futureSourcePrep
    ? "future-source"
    : (signal.darkMatterEcho ? "dark-matter-echo" : (signal.isFrontier ? "frontier" : "daily"));
  const identity = signal.shareCode || signal.dateStr || sourceId;
  const tier = signal.isFrontier ? `t${Math.max(1, Math.floor(Number(signal.tier) || 1))}` : "day";
  const planet = Number.isFinite(game.currentPlanetIndex) ? game.currentPlanetIndex : 0;
  const title = contract.title || (staged && staged.title) || "Signal Lab";
  const sourceKey = [
    "signal-lab-proof",
    sourceId,
    normalizeSignalLabProofPart(identity),
    tier,
    planet,
    normalizeSignalLabProofPart(title),
    hashSignalLabCommand(runCode)
  ].join(":");

  return {
    contract,
    signal,
    command: runCode,
    title,
    sourceKey,
    stagedMatch,
    isFrontier: !!signal.isFrontier
  };
}

function getSignalLabProofStatus(game, code) {
  const proof = getSignalLabProofCandidate(game, code);
  if (!proof) return null;
  let claimed = !!(game && game.discoveryPassCounts && game.discoveryPassCounts[proof.sourceKey]);
  if (!claimed && game && typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    claimed = !!(meter && meter.sources && meter.sources[proof.sourceKey]);
  }
  return {
    ...proof,
    claimed
  };
}

function awardSignalLabContractProof(game, code, pulse = null) {
  const proof = getSignalLabProofCandidate(game, code);
  if (!proof) return null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  const sourceKey = proof.sourceKey;
  if (game.discoveryPassCounts[sourceKey]) return null;

  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (masterySources && masterySources[sourceKey]) {
    game.discoveryPassCounts[sourceKey] = 1;
    return null;
  }

  const darkMatterPrep = !!(proof.signal && proof.signal.darkMatterPrep);
  const darkMatterEcho = !!(proof.signal && proof.signal.darkMatterEcho);
  const futureSourcePrep = !!(proof.signal && proof.signal.futureSourcePrep);
  const rewardXP = futureSourcePrep ? 8 : (darkMatterPrep ? 7 : (darkMatterEcho ? 6 : (proof.isFrontier ? 6 : 4)));
  const masteryXP = futureSourcePrep ? 12 : (darkMatterPrep ? 10 : (darkMatterEcho ? 9 : (proof.isFrontier ? 9 : 6)));
  const label = futureSourcePrep
    ? "SOURCE KEY TESTED"
    : (darkMatterPrep
      ? "DARK MATTER EVIDENCE"
      : (darkMatterEcho ? "DARK MATTER ECHO" : (proof.isFrontier ? "FRONTIER LAB TESTED" : "SIGNAL LAB TESTED")));
  const proofSource = futureSourcePrep
    ? "Future Lab Source"
    : (darkMatterPrep
      ? "Dark Matter Prep"
      : (darkMatterEcho ? "Dark Matter Echo" : (proof.isFrontier ? "Frontier Challenge" : "Daily Signal")));
  const color = futureSourcePrep ? "#facc15" : ((darkMatterPrep || darkMatterEcho) ? "#818cf8" : (proof.isFrontier ? "#c4b5fd" : "#67e8f9"));
  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const existingReward = !!(pulse && ((pulse.rewardXP || 0) > 0 || pulse.cardUnlocked || pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0));
  const mastery = typeof game.awardWorldMasteryXP === 'function'
    ? game.awardWorldMasteryXP(masteryXP, futureSourcePrep ? "future source proof" : (darkMatterPrep ? "dark matter prep proof" : (darkMatterEcho ? "dark matter echo proof" : "signal lab proof")), { sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[sourceKey] = 1;
    return null;
  }

  game.discoveryPassCounts[sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  let comboAdvanced = false;
  if (pulse && !existingReward) {
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    comboAdvanced = true;
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      pulse.signalLabComboEffect = game.spawnDiscoveryComboEffect(pulse);
    }
  }

  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  if (pulse) {
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    pulse.signalLabProof = {
      label,
      title: proof.title,
      source: proofSource,
      rewardXP,
      worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
      sourceKey,
      stagedMatch: proof.stagedMatch
    };
    if (darkMatterEcho || darkMatterPrep || futureSourcePrep) attachFutureLabProofScene(game, pulse, pulse.signalLabProof);
    pulse.rankUp = pulse.rankUp || rankUp;
    pulse.rankTitle = pulse.rankTitle || (afterRank ? afterRank.title : null);
    pulse.rankPerk = pulse.rankPerk || (rankUp && afterRank ? afterRank.perk : null);
    game.discoveryPulse = pulse;
    if (Array.isArray(game.discoveryLog) && game.discoveryLog[0] !== pulse) {
      game.discoveryLog = [pulse].concat(game.discoveryLog).slice(0, 8);
    }
  }

  if (rankUp && afterRank && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "SL",
      label: `Research Rank: ${afterRank.title}`,
      description: `${futureSourcePrep ? "Future source" : (darkMatterPrep ? "Dark Matter prep" : (darkMatterEcho ? "Dark Matter echo" : "Signal proof"))} unlocked ${afterRank.perk.label}.`
    });
  }
  if (rankUp && pulse && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    const masteryText = mastery && mastery.addedXP > 0 ? `, +${mastery.addedXP} world mastery XP` : "";
    ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
      title: futureSourcePrep ? "SOURCE KEY" : (darkMatterPrep ? "DARK MATTER PREP" : (darkMatterEcho ? "DARK MATTER ECHO" : "SIGNAL LAB")),
      color,
      timer: 240
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 52, label, color, proof.isFrontier ? 1.02 : 0.96);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, proof.isFrontier ? 14 : 10, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 10, "#fef08a", proof.isFrontier ? 7 : 5, 1.6, 1.5, "glow");
    }
  }
  if (comboAdvanced && typeof game.grantDiscoveryComboMilestone === 'function') {
    game.grantDiscoveryComboMilestone(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === game) saveLocalProgress();
  return pulse ? pulse.signalLabProof : null;
}

function getFailureRepairProofCandidate(game, code) {
  if (!game) return null;
  const staged = game.lastStagedExperiment || null;
  const runCode = String(code || "").trim();
  const stagedCode = String(staged && staged.command || "").trim();
  if (!runCode || !stagedCode || runCode !== stagedCode) return null;
  if (!staged || staged.source !== "failure-lab") return null;
  const planet = Number.isFinite(game.currentPlanetIndex) ? game.currentPlanetIndex : 0;
  const title = staged.title || "Crash repair";
  return {
    command: runCode,
    title,
    prediction: staged.prediction || null,
    sourceKey: [
      "failure-repair-proof",
      planet,
      normalizeSignalLabProofPart(title),
      hashSignalLabCommand(runCode)
    ].join(":"),
    planet
  };
}

function awardFailureRepairProof(game, code, pulse = null) {
  const proof = getFailureRepairProofCandidate(game, code);
  if (!proof) return null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  if (game.discoveryPassCounts[proof.sourceKey]) return null;

  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (masterySources && masterySources[proof.sourceKey]) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  const rewardXP = 5;
  const masteryXP = 7;
  const label = "REPAIR PROOF";
  const color = "#facc15";
  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const existingReward = !!(pulse && ((pulse.rewardXP || 0) > 0 || pulse.cardUnlocked || pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0));
  const mastery = typeof game.awardWorldMasteryXP === 'function'
    ? game.awardWorldMasteryXP(masteryXP, "crash repair proof", { sourceKey: proof.sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  game.discoveryPassCounts[proof.sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  let comboAdvanced = false;
  if (pulse && !existingReward) {
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    comboAdvanced = true;
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      pulse.repairComboEffect = game.spawnDiscoveryComboEffect(pulse);
    }
  }

  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const proofResult = {
    label,
    title: proof.title,
    source: "Crash Lab",
    prediction: proof.prediction,
    rewardXP,
    worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
    sourceKey: proof.sourceKey
  };
  if (pulse) {
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    pulse.repairProof = proofResult;
    pulse.rankUp = pulse.rankUp || rankUp;
    pulse.rankTitle = pulse.rankTitle || (afterRank ? afterRank.title : null);
    pulse.rankPerk = pulse.rankPerk || (rankUp && afterRank ? afterRank.perk : null);
    game.discoveryPulse = pulse;
    if (Array.isArray(game.discoveryLog) && game.discoveryLog[0] !== pulse) {
      game.discoveryLog = [pulse].concat(game.discoveryLog).slice(0, 8);
    }
  }
  game.reflectionContext = {
    kind: "repair-proof",
    source: "Crash Lab",
    title: proof.title,
    concept: "Failure diagnosis",
    command: proof.command,
    prediction: proof.prediction,
    proofLabel: label,
    proofSourceKey: proof.sourceKey
  };

  if (rankUp && afterRank && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "FIX",
      label: `Research Rank: ${afterRank.title}`,
      description: `Crash repair proof unlocked ${afterRank.perk.label}.`
    });
  }
  if (rankUp && pulse && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    const masteryText = mastery && mastery.addedXP > 0 ? `, +${mastery.addedXP} world mastery XP` : "";
    const predictionText = proof.prediction ? ` Prediction: ${proof.prediction}.` : "";
    ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.${predictionText}`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
      title: "CRASH LAB",
      color,
      timer: 250
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 52, label, color, 1.0);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 12, 2.1, 1.9, "glow");
      Particles.spawnBurst(px, py - 10, "#fef08a", 6, 1.5, 1.4, "glow");
    }
  }
  if (comboAdvanced && typeof game.grantDiscoveryComboMilestone === 'function') {
    game.grantDiscoveryComboMilestone(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === game) saveLocalProgress();
  return pulse ? pulse.repairProof : proofResult;
}

function getAnomalyTraceProofCandidate(game, code) {
  if (!game) return null;
  const staged = game.lastStagedExperiment || null;
  const runCode = String(code || "").trim();
  const stagedCode = String(staged && staged.command || "").trim();
  if (!runCode || !stagedCode || runCode !== stagedCode) return null;
  if (!staged || staged.source !== "start-anomaly-trace") return null;
  const planet = Number.isFinite(game.currentPlanetIndex) ? game.currentPlanetIndex : 0;
  return {
    command: runCode,
    title: staged.title || "Trace hidden force",
    sourceKey: [
      "anomaly-trace-proof",
      planet,
      normalizeSignalLabProofPart(staged.title || "hidden-force"),
      hashSignalLabCommand(runCode)
    ].join(":"),
    planet
  };
}

function awardAnomalyTraceProof(game, code, pulse = null) {
  const proof = getAnomalyTraceProofCandidate(game, code);
  if (!proof) return null;
  const storyBeforeIds = typeof game.getUnlockedSignalStoryIds === 'function'
    ? game.getUnlockedSignalStoryIds()
    : null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  if (game.discoveryPassCounts[proof.sourceKey]) return null;

  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (masterySources && masterySources[proof.sourceKey]) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  const rewardXP = 5;
  const masteryXP = 8;
  const label = "ANOMALY TRACED";
  const color = "#818cf8";
  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const existingReward = !!(pulse && ((pulse.rewardXP || 0) > 0 || pulse.cardUnlocked || pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0));
  const mastery = typeof game.awardWorldMasteryXP === 'function'
    ? game.awardWorldMasteryXP(masteryXP, "anomaly trace proof", { sourceKey: proof.sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  game.discoveryPassCounts[proof.sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  let comboAdvanced = false;
  if (pulse && !existingReward) {
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    comboAdvanced = true;
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      pulse.anomalyComboEffect = game.spawnDiscoveryComboEffect(pulse);
    }
  }

  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const proofResult = {
    label,
    title: proof.title,
    source: "Dark Matter Echo",
    rewardXP,
    worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
    sourceKey: proof.sourceKey
  };
  if (storyBeforeIds && typeof game.getNewSignalStoryChapters === 'function') {
    const storyUnlocks = game.getNewSignalStoryChapters(storyBeforeIds);
    const traceChapter = storyUnlocks.find(chapter => chapter && chapter.id === "anomaly-trace") || null;
    if (traceChapter && typeof game.spawnSignalStoryUnlockEffect === 'function') {
      game.lastSignalStoryUnlocks = storyUnlocks;
      proofResult.signalStoryUnlock = game.spawnSignalStoryUnlockEffect(traceChapter);
    }
  }
  if (pulse) {
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    pulse.anomalyTraceProof = proofResult;
    attachFutureLabProofScene(game, pulse, proofResult);
    pulse.rankUp = pulse.rankUp || rankUp;
    pulse.rankTitle = pulse.rankTitle || (afterRank ? afterRank.title : null);
    pulse.rankPerk = pulse.rankPerk || (rankUp && afterRank ? afterRank.perk : null);
    game.discoveryPulse = pulse;
    if (Array.isArray(game.discoveryLog) && game.discoveryLog[0] !== pulse) {
      game.discoveryLog = [pulse].concat(game.discoveryLog).slice(0, 8);
    }
  }

  if (rankUp && afterRank && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "DM",
      label: `Research Rank: ${afterRank.title}`,
      description: `Anomaly trace unlocked ${afterRank.perk.label}.`
    });
  }
  if (rankUp && pulse && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    const masteryText = mastery && mastery.addedXP > 0 ? `, +${mastery.addedXP} world mastery XP` : "";
    ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
      title: "ANOMALY TRACE",
      color,
      timer: 250
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 52, label, color, 1.0);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 12, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 10, "#67e8f9", 6, 1.6, 1.5, "glow");
    }
  }
  if (comboAdvanced && typeof game.grantDiscoveryComboMilestone === 'function') {
    game.grantDiscoveryComboMilestone(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === game) saveLocalProgress();
  return pulse ? pulse.anomalyTraceProof : proofResult;
}

function getQuantumBranchProofCandidate(game, code) {
  if (!game) return null;
  const staged = game.lastStagedExperiment || null;
  const runCode = String(code || "").trim();
  const stagedCode = String(staged && staged.command || "").trim();
  if (!runCode || !stagedCode || runCode !== stagedCode) return null;
  if (!staged || staged.source !== "start-quantum-branch") return null;
  const planet = Number.isFinite(game.currentPlanetIndex) ? game.currentPlanetIndex : 0;
  return {
    command: runCode,
    title: staged.title || "Test a branch condition",
    sourceKey: [
      "quantum-branch-proof",
      planet,
      normalizeSignalLabProofPart(staged.title || "branch-condition"),
      hashSignalLabCommand(runCode)
    ].join(":"),
    planet
  };
}

function awardQuantumBranchProof(game, code, pulse = null) {
  const proof = getQuantumBranchProofCandidate(game, code);
  if (!proof) return null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  if (game.discoveryPassCounts[proof.sourceKey]) return null;

  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (masterySources && masterySources[proof.sourceKey]) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  const rewardXP = 5;
  const masteryXP = 8;
  const label = "QUANTUM BRANCH";
  const color = "#22d3ee";
  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const existingReward = !!(pulse && ((pulse.rewardXP || 0) > 0 || pulse.cardUnlocked || pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0));
  const mastery = typeof game.awardWorldMasteryXP === 'function'
    ? game.awardWorldMasteryXP(masteryXP, "quantum branch proof", { sourceKey: proof.sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  game.discoveryPassCounts[proof.sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  let comboAdvanced = false;
  if (pulse && !existingReward) {
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    comboAdvanced = true;
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      pulse.quantumComboEffect = game.spawnDiscoveryComboEffect(pulse);
    }
  }

  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const proofResult = {
    label,
    title: proof.title,
    source: "Quantum Gate",
    rewardXP,
    worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
    sourceKey: proof.sourceKey
  };
  if (pulse) {
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    pulse.quantumBranchProof = proofResult;
    attachFutureLabProofScene(game, pulse, proofResult);
    pulse.rankUp = pulse.rankUp || rankUp;
    pulse.rankTitle = pulse.rankTitle || (afterRank ? afterRank.title : null);
    pulse.rankPerk = pulse.rankPerk || (rankUp && afterRank ? afterRank.perk : null);
    if (typeof game.attachFormulaCardUnlock === 'function') {
      game.attachFormulaCardUnlock(pulse, "branch");
    } else if (typeof unlockFormulaKind === 'function') {
      pulse.cardUnlocked = !!unlockFormulaKind(game, "branch");
      pulse.formulaCardKind = "branch";
    }
    game.discoveryPulse = pulse;
    if (Array.isArray(game.discoveryLog) && game.discoveryLog[0] !== pulse) {
      game.discoveryLog = [pulse].concat(game.discoveryLog).slice(0, 8);
    }
  }

  if (rankUp && afterRank && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "QG",
      label: `Research Rank: ${afterRank.title}`,
      description: `Quantum branch proof unlocked ${afterRank.perk.label}.`
    });
  }
  if (rankUp && pulse && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    const masteryText = mastery && mastery.addedXP > 0 ? `, +${mastery.addedXP} world mastery XP` : "";
    ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
      title: "QUANTUM PREP",
      color,
      timer: 250
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 52, label, color, 1.0);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 12, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 10, "#fef08a", 6, 1.6, 1.5, "glow");
    }
  }
  if (comboAdvanced && typeof game.grantDiscoveryComboMilestone === 'function') {
    game.grantDiscoveryComboMilestone(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === game) saveLocalProgress();
  return pulse ? pulse.quantumBranchProof : proofResult;
}

function getQuantumChanceProofCandidate(game, code) {
  if (!game) return null;
  const staged = game.lastStagedExperiment || null;
  const runCode = String(code || "").trim();
  const stagedCode = String(staged && staged.command || "").trim();
  if (!runCode || !stagedCode || runCode !== stagedCode) return null;
  if (!staged || staged.source !== "start-quantum-chance") return null;
  const planet = Number.isFinite(game.currentPlanetIndex) ? game.currentPlanetIndex : 0;
  return {
    command: runCode,
    title: staged.title || "Test chance branch",
    sourceKey: [
      "quantum-chance-proof",
      planet,
      normalizeSignalLabProofPart(staged.title || "chance-branch"),
      hashSignalLabCommand(runCode)
    ].join(":"),
    planet
  };
}

function awardQuantumChanceProof(game, code, pulse = null) {
  const proof = getQuantumChanceProofCandidate(game, code);
  if (!proof) return null;
  game.discoveryPassCounts = game.discoveryPassCounts || {};
  if (game.discoveryPassCounts[proof.sourceKey]) return null;

  let masterySources = null;
  if (typeof game.normalizeWorldMasteryMeter === 'function') {
    const meter = game.normalizeWorldMasteryMeter(game.currentPlanetIndex);
    masterySources = meter && meter.sources ? meter.sources : null;
  }
  if (masterySources && masterySources[proof.sourceKey]) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  const rewardXP = 5;
  const masteryXP = 8;
  const label = "QUANTUM CHANCE";
  const color = "#38bdf8";
  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const existingReward = !!(pulse && ((pulse.rewardXP || 0) > 0 || pulse.cardUnlocked || pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0));
  const mastery = typeof game.awardWorldMasteryXP === 'function'
    ? game.awardWorldMasteryXP(masteryXP, "quantum chance proof", { sourceKey: proof.sourceKey, silent: true })
    : { addedXP: 0, duplicate: false };
  if (mastery && mastery.duplicate) {
    game.discoveryPassCounts[proof.sourceKey] = 1;
    return null;
  }

  game.discoveryPassCounts[proof.sourceKey] = 1;
  game.researchXP = Math.max(0, (game.researchXP || 0) + rewardXP);
  let comboAdvanced = false;
  if (pulse && !existingReward) {
    game.discoveryCombo = Math.min(99, (game.discoveryCombo || 0) + 1);
    pulse.combo = game.discoveryCombo;
    comboAdvanced = true;
    if (pulse.combo === 1 && typeof game.spawnDiscoveryComboPrimerEffect === 'function') {
      pulse.comboPrimer = game.spawnDiscoveryComboPrimerEffect(pulse);
    } else if (pulse.combo > 1 && typeof game.spawnDiscoveryComboEffect === 'function') {
      pulse.quantumChanceComboEffect = game.spawnDiscoveryComboEffect(pulse);
    }
  }

  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const proofResult = {
    label,
    title: proof.title,
    source: "Quantum Gate",
    rewardXP,
    worldMasteryAddedXP: mastery && Number.isFinite(mastery.addedXP) ? mastery.addedXP : 0,
    sourceKey: proof.sourceKey
  };
  if (pulse) {
    pulse.rewardXP = Math.max(0, (pulse.rewardXP || 0) + rewardXP);
    pulse.quantumChanceProof = proofResult;
    attachFutureLabProofScene(game, pulse, proofResult);
    pulse.rankUp = pulse.rankUp || rankUp;
    pulse.rankTitle = pulse.rankTitle || (afterRank ? afterRank.title : null);
    pulse.rankPerk = pulse.rankPerk || (rankUp && afterRank ? afterRank.perk : null);
    if (typeof game.attachFormulaCardUnlock === 'function') {
      game.attachFormulaCardUnlock(pulse, "probability");
    } else if (typeof unlockFormulaKind === 'function') {
      pulse.cardUnlocked = !!unlockFormulaKind(game, "probability");
      pulse.formulaCardKind = "probability";
    }
    game.discoveryPulse = pulse;
    if (Array.isArray(game.discoveryLog) && game.discoveryLog[0] !== pulse) {
      game.discoveryLog = [pulse].concat(game.discoveryLog).slice(0, 8);
    }
  }

  if (rankUp && afterRank && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "Q%",
      label: `Research Rank: ${afterRank.title}`,
      description: `Quantum chance proof unlocked ${afterRank.perk.label}.`
    });
  }
  if (rankUp && pulse && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    const masteryText = mastery && mastery.addedXP > 0 ? `, +${mastery.addedXP} world mastery XP` : "";
    ui_log_output(`${label}: +${rewardXP} Research XP${masteryText}.`, "success");
  }
  if (typeof game.showMissionBalloon === 'function') {
    game.showMissionBalloon(`${label}: +${rewardXP} Research XP`, {
      title: "QUANTUM CHANCE",
      color,
      timer: 250
    });
  }
  if (game.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = (Number.isFinite(game.player.x) ? game.player.x : 0) + (game.player.w || 24) / 2;
    const py = Number.isFinite(game.player.y) ? game.player.y : 0;
    ComicBubbles.pop(px, py - 52, label, color, 1.0);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, py - 10, color, 12, 2.2, 2.0, "glow");
      Particles.spawnBurst(px, py - 10, "#fef08a", 6, 1.6, 1.5, "glow");
    }
  }
  if (comboAdvanced && typeof game.grantDiscoveryComboMilestone === 'function') {
    game.grantDiscoveryComboMilestone(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  if (typeof game.checkLabStarProgress === 'function') game.checkLabStarProgress("science");
  if (typeof saveLocalProgress === 'function' && typeof window !== 'undefined' && window.Game === game) saveLocalProgress();
  return pulse ? pulse.quantumChanceProof : proofResult;
}

function finishSuccessfulCodeRunDiscovery(game, activeMission, code, resultState, lockedBefore = 0, lockedBeforeList = []) {
  if (!game || !activeMission || !activeMission.fullMission || !resultState) return { opened: 0, pulse: null };
  const lockedAfter = typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : lockedBefore;
  let opened = 0;
  if (lockedBefore > lockedAfter) {
    const unlockPulse = typeof game.spawnGemGateUnlockEffects === 'function' ? game.spawnGemGateUnlockEffects(lockedBeforeList) : null;
    opened = unlockPulse && Number.isFinite(unlockPulse.opened) ? unlockPulse.opened : lockedBefore - lockedAfter;
    if (opened > 0) ui_log_output(`◆ Code unlocked ${opened} mission gem${opened === 1 ? "" : "s"}!`, "success");
    if (opened > 0 && typeof showDialogue === 'function') {
      showDialogue(`Nice engineering. ${opened} gem gate${opened === 1 ? "" : "s"} opened!`, "badge");
    }
  }
  const pulse = recordDiscoveryPulse(game, activeMission, code, resultState, opened);
  const lessonPhaseAdvance = recordLessonPhaseAdvance(game, activeMission, resultState, pulse);
  const lessonPathMastery = lessonPhaseAdvance && lessonPhaseAdvance.lessonPathMastery ? lessonPhaseAdvance.lessonPathMastery : null;
  const signalLabProof = awardSignalLabContractProof(game, code, pulse);
  const repairProof = awardFailureRepairProof(game, code, pulse);
  const anomalyTraceProof = awardAnomalyTraceProof(game, code, pulse);
  const quantumBranchProof = awardQuantumBranchProof(game, code, pulse);
  const quantumChanceProof = awardQuantumChanceProof(game, code, pulse);
  return { opened, pulse, lessonPhaseAdvance, lessonPathMastery, signalLabProof, repairProof, anomalyTraceProof, quantumBranchProof, quantumChanceProof, lockedAfter };
}

function getDiscoveryChainHint(pulse, game = null) {
  const combo = Math.max(0, Math.floor(Number(pulse && pulse.combo) || 0));
  if (!pulse || combo <= 0) return "";
  const milestonePreview = getDiscoveryComboMilestonePreview(game, combo);
  const earned = (pulse.rewardXP || 0) > 0 || !!pulse.cardUnlocked || !!pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0;
  const target = game && typeof getLabChainTarget === "function" ? getLabChainTarget(game) : null;
  const progress = game && typeof getLabChainProgressMeta === "function" ? getLabChainProgressMeta(game, target) : null;
  const rawCommand = target && target.command ? String(target.command).trim() : "";
  const pulseCode = pulse && pulse.code ? String(pulse.code).trim() : "";
  const command = rawCommand && rawCommand !== pulseCode ? rawCommand : "";
  const contract = target
    ? {
        title: target.title || "Make one fresh change",
        body: target.body || "Change one variable, run it, and compare the new result.",
        command,
        kind: target.kind || "lab-chain",
        cta: command ? (target.state === "paused" ? "STAGE FIX" : "STAGE CHAIN") : "",
        source: "lab-chain-next"
      }
    : null;
  if (!earned) {
    return {
      label: "CHAIN PAUSED",
      title: "Repeat commands do not count",
      body: `Make one new checklist item, sample gate, or formula card change to restart the lab chain.${milestonePreview ? ` ${milestonePreview}` : ""}`,
      progress,
      contract
    };
  }
  const nextCombo = combo + 1;
  const nextTarget = pulse.total > 0 && pulse.passed < pulse.total
    ? "Pass one new checklist item"
    : "Unlock a new sample gate, formula card, or mission check";
  const amplifier = pulse.comboAmplifierUnlocked ? " + amplifier XP" : "";
  return {
    label: `CHAIN NEXT x${nextCombo}`,
    title: `New progress can add combo XP${amplifier}`,
    body: milestonePreview ? `${nextTarget}. ${milestonePreview}` : nextTarget,
    progress,
    contract
  };
}

function renderDiscoveryChainProgress(progress) {
  if (!progress || typeof progress !== "object") return "";
  const rawTotal = Math.max(1, Math.floor(Number(progress.total || progress.target) || 1));
  const total = Math.max(1, Math.min(6, rawTotal));
  const rawValue = Math.max(0, Math.floor(Number(progress.value) || 0));
  const value = Math.max(0, Math.min(total, rawTotal > total ? Math.round((rawValue / rawTotal) * total) : rawValue));
  const mode = String(progress.mode || "lab-chain").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const label = progress.label || `${rawValue}/${rawTotal}`;
  const pips = Array.from({ length: total }, (_, index) =>
    `<i class="discovery-chain-progress-pip${index < value ? " filled" : (index === value ? " next" : "")}" aria-hidden="true"></i>`
  ).join("");
  return `
    <div class="discovery-chain-progress ${escapeHTML(mode)}" aria-label="${escapeHTML(label)}">
      <span>${escapeHTML(label)}</span>
      <div>${pips}</div>
    </div>
  `;
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
  const comboMilestone = pulse.comboMilestone
    ? `<div class="discovery-hypothesis discovery-combo-boost">${escapeHTML(pulse.comboMilestone.label || "LAB CHAIN")} +${escapeHTML(String(pulse.comboMilestone.rewardXP || 0))} XP · chain x${escapeHTML(String(pulse.comboMilestone.combo || pulse.combo || 0))}</div>`
    : "";
  const hypothesis = pulse.hypothesisConfirmed
    ? `<div class="discovery-hypothesis">HYPOTHESIS CONFIRMED +${escapeHTML(String(pulse.hypothesisBonusXP || 0))} XP</div>`
    : "";
  const lessonPhaseNextCommand = pulse.lessonPhaseAdvance && pulse.lessonPhaseAdvance.nextCommand
    ? String(pulse.lessonPhaseAdvance.nextCommand).trim()
    : "";
  const lessonPhaseNextCommandLabel = lessonPhaseNextCommand.replace(/\s+/g, " ");
  const lessonPhase = pulse.lessonPhaseAdvance
    ? `<div class="discovery-hypothesis discovery-phase">${escapeHTML(pulse.lessonPhaseAdvance.label || "PHASE DONE")} · ${escapeHTML(pulse.lessonPhaseAdvance.title || "Lesson phase")}${pulse.lessonPhaseAdvance.nextTitle ? ` · Next: ${escapeHTML(pulse.lessonPhaseAdvance.nextTitle)}` : ""}${lessonPhaseNextCommand ? ` · Try <code>${escapeHTML(lessonPhaseNextCommandLabel)}</code><button type="button" class="discovery-phase-stage-btn" data-phase-next-command="${escapeHTML(lessonPhaseNextCommand)}" data-phase-next-title="${escapeHTML(pulse.lessonPhaseAdvance.nextTitle || "Next phase")}">STAGE NEXT</button>` : ""}</div>`
    : "";
  const lessonPathMastery = pulse.lessonPathMastery
    ? `<div class="discovery-hypothesis discovery-phase-mastery">${escapeHTML(pulse.lessonPathMastery.label || "LESSON PATH COMPLETE")} +${escapeHTML(String(pulse.lessonPathMastery.rewardXP || 0))} XP · ${escapeHTML(String(pulse.lessonPathMastery.phases || 0))} phases</div>`
    : "";
  const passportStamp = pulse.passportStampProof
    ? `<div class="discovery-hypothesis discovery-passport-stamp"><strong>${escapeHTML(pulse.passportStampProof.label || "PASSPORT STAMP")} +${escapeHTML(String(pulse.passportStampProof.rewardXP || 0))} XP</strong><span>${escapeHTML(pulse.passportStampProof.planetName || "World")} · ${escapeHTML(String(pulse.passportStampProof.stampCount || 1))}/${escapeHTML(String(pulse.passportStampProof.total || 1))} stamps</span><em>${escapeHTML(pulse.passportStampProof.concept || "Science concept logged")} · ${escapeHTML(String(pulse.passportStampProof.stars || 0))}/${escapeHTML(String(pulse.passportStampProof.maxStars || 3))} Lab Stars</em></div>`
    : "";
  const formulaDeckMastery = pulse.formulaDeckMastery
    ? `<div class="discovery-hypothesis discovery-perk">${escapeHTML(pulse.formulaDeckMastery.label || "DECK MASTERED")} +${escapeHTML(String(pulse.formulaDeckMastery.rewardXP || 0))} XP · ${escapeHTML(String(pulse.formulaDeckMastery.count || 0))}/${escapeHTML(String(pulse.formulaDeckMastery.total || 0))} cards</div>`
    : "";
  const scienceProofData = pulse.scienceDeltaProof || null;
  const scienceProofCommand = scienceProofData && scienceProofData.nextCommand
    ? String(scienceProofData.nextCommand).trim()
    : "";
  const scienceProofCommandLabel = scienceProofCommand.replace(/\s+/g, " ");
  const scienceProofCode = scienceProofData && scienceProofData.codeLine
    ? String(scienceProofData.codeLine).replace(/^CODE\s+/i, "")
    : "";
  const scienceProofScience = scienceProofData
    ? `${scienceProofData.relation || "code->evidence"}${scienceProofData.delta ? ` · ${scienceProofData.delta}` : ""}`
    : "";
  const scienceProof = scienceProofData
    ? `<div class="discovery-hypothesis discovery-science-proof"><strong>${escapeHTML(scienceProofData.label || "SCIENCE PROOF")} · ${escapeHTML(scienceProofData.title || "What changed")}</strong><div class="discovery-science-proof-grid"><span><b>CODE</b>${escapeHTML(scienceProofCode || "latest command")}</span><span><b>SCIENCE</b>${escapeHTML(scienceProofScience)}</span><span><b>WIN</b>${escapeHTML(scienceProofData.winLine || "test the level")}</span></div>${scienceProofData.reason ? `<p>${escapeHTML(scienceProofData.reason)}</p>` : ""}${scienceProofCommand ? `<div class="discovery-science-proof-code">Next <code>${escapeHTML(scienceProofCommandLabel)}</code><button type="button" class="discovery-science-proof-stage-btn" data-science-proof-command="${escapeHTML(scienceProofCommand)}" data-science-proof-title="${escapeHTML(scienceProofData.nextTitle || "Next proof")}">STAGE NEXT</button></div>` : ""}</div>`
    : "";
  const scienceCheckpoint = pulse.scienceCheckpointProof
    ? `<div class="discovery-hypothesis discovery-science-checkpoint"><strong>${escapeHTML(pulse.scienceCheckpointProof.label || "TARGET CHECKPOINT")} +${escapeHTML(String(pulse.scienceCheckpointProof.rewardXP || 0))} XP</strong><span>${escapeHTML(pulse.scienceCheckpointProof.title || "Target step")} · ${escapeHTML(pulse.scienceCheckpointProof.statLine || "")}</span><em>${escapeHTML(pulse.scienceCheckpointProof.checkpoint || "science checkpoint")}${pulse.scienceCheckpointProof.worldMasteryAddedXP ? ` · +${escapeHTML(String(pulse.scienceCheckpointProof.worldMasteryAddedXP))} world XP` : ""}</em></div>`
    : "";
  const codeConceptProof = pulse.codeConceptProof || null;
  const codeConceptNextCommand = codeConceptProof && codeConceptProof.nextCommand
    ? String(codeConceptProof.nextCommand).trim()
    : "";
  const codeConceptNextCommandLabel = codeConceptNextCommand.replace(/\s+/g, " ");
  const codeConcept = pulse.codeConceptProof
    ? `<div class="discovery-hypothesis discovery-code-concept"><strong>${escapeHTML(pulse.codeConceptProof.label || "CODE CONCEPT")} · ${escapeHTML(pulse.codeConceptProof.concept || "")}</strong><span>${escapeHTML(pulse.codeConceptProof.title || "Coding idea")} · ${escapeHTML(pulse.codeConceptProof.progress || "")}${pulse.codeConceptProof.nextTitle ? ` · Next: ${escapeHTML(pulse.codeConceptProof.nextTitle)}` : ""}</span>${codeConceptNextCommand ? `<div class="discovery-code-concept-next">Try <code>${escapeHTML(codeConceptNextCommandLabel)}</code><button type="button" class="discovery-code-concept-stage-btn" data-code-concept-next-command="${escapeHTML(codeConceptNextCommand)}" data-code-concept-next-title="${escapeHTML(pulse.codeConceptProof.nextTitle || "Next coding idea")}" data-code-concept-next-kind="${escapeHTML(pulse.codeConceptProof.nextConcept || "code-concept")}">STAGE IDEA</button></div>` : ""}</div>`
    : "";
  const codeConceptDeckMastery = pulse.codeConceptDeckMastery
    ? `<div class="discovery-hypothesis discovery-code-concept">${escapeHTML(pulse.codeConceptDeckMastery.label || "CODE DECK MASTERED")} +${escapeHTML(String(pulse.codeConceptDeckMastery.rewardXP || 0))} XP · ${escapeHTML(String(pulse.codeConceptDeckMastery.count || 0))}/${escapeHTML(String(pulse.codeConceptDeckMastery.total || 0))} ideas</div>`
    : "";
  const formulaProgress = pulse.cardUnlocked && pulse.formulaDeckProgress ? pulse.formulaDeckProgress : null;
  const formulaNextCommand = formulaProgress && formulaProgress.nextCommand
    ? String(formulaProgress.nextCommand).trim()
    : "";
  const formulaNextCommandLabel = formulaNextCommand.replace(/\s+/g, " ");
  const formulaNextAxis = formulaProgress && formulaProgress.nextAxis ? String(formulaProgress.nextAxis) : "";
  const formulaNextPayoff = formulaProgress && formulaProgress.nextPayoff ? String(formulaProgress.nextPayoff) : "";
  const formulaNextWhy = !formulaProgress || formulaProgress.complete
    ? ""
    : `<span><b>LEARN</b>${escapeHTML(formulaNextAxis || "Next science idea")}</span><span><b>WIN</b>${escapeHTML(formulaNextPayoff || "Collect the next formula card")}</span>`;
  const formulaDeckNext = formulaProgress
    ? `<div class="discovery-hypothesis discovery-formula-next"><strong>${escapeHTML(formulaProgress.label || "FORMULA CARD")} · ${formulaProgress.complete ? "Deck complete" : `Next: ${escapeHTML(formulaProgress.nextTitle || "Formula Deck")}`}</strong>${formulaNextWhy ? `<div class="discovery-formula-next-why">${formulaNextWhy}</div>` : ""}${formulaNextCommand ? `<div class="discovery-formula-next-code">Try <code>${escapeHTML(formulaNextCommandLabel)}</code><button type="button" class="discovery-formula-stage-btn" data-formula-next-command="${escapeHTML(formulaNextCommand)}" data-formula-next-title="${escapeHTML(formulaProgress.nextTitle || "Next formula")}">STAGE CARD</button></div>` : ""}</div>`
    : "";
  const aiStateDeckMastery = pulse.aiStateDeckMastery
    ? `<div class="discovery-hypothesis discovery-ai-state">${escapeHTML(pulse.aiStateDeckMastery.label || "AI DECK MASTERED")} +${escapeHTML(String(pulse.aiStateDeckMastery.rewardXP || 0))} XP · ${escapeHTML(String(pulse.aiStateDeckMastery.count || 0))}/${escapeHTML(String(pulse.aiStateDeckMastery.total || 0))} states</div>`
    : "";
  const signalLabProof = pulse.signalLabProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.signalLabProof.label)} +${escapeHTML(String(pulse.signalLabProof.rewardXP || 0))} XP</div>`
    : "";
  const repairPrediction = pulse.repairProof && pulse.repairProof.prediction
    ? ` · predict ${escapeHTML(pulse.repairProof.prediction)}`
    : "";
  const repairProof = pulse.repairProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.repairProof.label)} +${escapeHTML(String(pulse.repairProof.rewardXP || 0))} XP${repairPrediction}</div>`
    : "";
  const anomalyTraceProof = pulse.anomalyTraceProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.anomalyTraceProof.label)} +${escapeHTML(String(pulse.anomalyTraceProof.rewardXP || 0))} XP</div>`
    : "";
  const quantumBranchProof = pulse.quantumBranchProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.quantumBranchProof.label)} +${escapeHTML(String(pulse.quantumBranchProof.rewardXP || 0))} XP</div>`
    : "";
  const quantumChanceProof = pulse.quantumChanceProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.quantumChanceProof.label)} +${escapeHTML(String(pulse.quantumChanceProof.rewardXP || 0))} XP</div>`
    : "";
  const futureLabScene = pulse.futureLabScene
    ? `<div class="discovery-hypothesis discovery-source-scene">${escapeHTML(pulse.futureLabScene.speaker || "VECTOR")} // ${escapeHTML(pulse.futureLabScene.title || "Source scene")} · ${escapeHTML(pulse.futureLabScene.lesson || "")}</div>`
    : "";
  const drillProof = pulse.drillProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.drillProof.label)} +${escapeHTML(String(pulse.drillProof.rewardXP || 0))} XP</div>`
    : "";
  const villageTradeProof = pulse.villageTradeProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.villageTradeProof.label)} +${escapeHTML(String(pulse.villageTradeProof.rewardXP || 0))} XP</div>`
    : "";
  const petProof = pulse.petProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.petProof.label)} +${escapeHTML(String(pulse.petProof.rewardXP || 0))} XP</div>`
    : "";
  const aiStateRunProof = pulse.aiStateRunProof
    ? `<div class="discovery-hypothesis discovery-ai-state">${escapeHTML(pulse.aiStateRunProof.label || "AI PROOF LOGGED")} · ${escapeHTML(pulse.aiStateRunProof.title || "AI state")} · ${escapeHTML(pulse.aiStateRunProof.progress || "")} · Next: ${escapeHTML(pulse.aiStateRunProof.nextTitle || "Deck complete")}</div>`
    : "";
  const frontierRivalProof = pulse.frontierRivalProof
    ? `<div class="discovery-hypothesis discovery-signal-lab">${escapeHTML(pulse.frontierRivalProof.label || "RIVAL PROOF")} +${escapeHTML(String(pulse.frontierRivalProof.rewardXP || 0))} XP · T${escapeHTML(String(pulse.frontierRivalProof.tier || 1))} · ${escapeHTML(pulse.frontierRivalProof.pilot || "classmate")}</div>`
    : "";
  const frontierRivalMilestone = pulse.frontierRivalMilestone
    ? `<div class="discovery-hypothesis discovery-combo-boost">${escapeHTML(pulse.frontierRivalMilestone.label || "RIVAL LADDER")} +${escapeHTML(String(pulse.frontierRivalMilestone.rewardXP || 0))} XP · ${escapeHTML(String(pulse.frontierRivalMilestone.proofCount || 0))} proofs</div>`
    : "";
  const villageTrustNext = pulse.villageTrust && pulse.villageTrust.nextPact
    ? ` · Next: ${escapeHTML(pulse.villageTrust.nextPact)}`
    : "";
  const villageTrust = pulse.villageTrust
    ? `<div class="discovery-hypothesis discovery-village-trust">${escapeHTML(pulse.villageTrust.label || "TRUST")} +${escapeHTML(String(pulse.villageTrust.added || 0))} · ${escapeHTML(pulse.villageTrust.title || "Village Trust")} (${escapeHTML(String(pulse.villageTrust.points || 0))})${villageTrustNext}</div>`
    : "";
  const villagePact = pulse.villagePactProof
    ? `<div class="discovery-hypothesis discovery-village-trust">${escapeHTML(pulse.villagePactProof.label || "VILLAGE PACT")} +${escapeHTML(String(pulse.villagePactProof.rewardXP || 0))} XP · ${escapeHTML(pulse.villagePactProof.tier || "Village Guardian")}</div>`
    : "";
  const rankPerk = pulse.rankPerk
    ? `<div class="discovery-hypothesis discovery-perk">LAB PERK UNLOCKED: ${escapeHTML(pulse.rankPerk.label)}</div>`
    : "";
  const unlockCue = pulse.nextLabUnlock || ((pulse.rewardXP || 0) > 0 && typeof getResearchUnlockPreview === 'function' && typeof getResearchRank === 'function'
    ? getResearchUnlockPreview(getResearchRank(game && Number.isFinite(game.researchXP) ? game.researchXP : 0))
    : null);
  const unlockPct = unlockCue ? Math.max(0, Math.min(100, Math.round((Number(unlockCue.progress) || 0) * 100))) : 0;
  const unlockCard = unlockCue
    ? `<div class="discovery-next-unlock"><span>${escapeHTML(unlockCue.label)}</span><strong>${escapeHTML(unlockCue.title)}</strong><p>${escapeHTML(unlockCue.body)}</p><div class="discovery-next-unlock-bar" aria-label="${escapeHTML(String(unlockPct))}% toward next lab unlock"><i style="width: ${unlockPct}%"></i></div></div>`
    : "";
  const chainHint = getDiscoveryChainHint(pulse, game);
  const chainContract = chainHint && chainHint.contract ? chainHint.contract : null;
  const chainCommand = chainContract && chainContract.command ? String(chainContract.command).trim() : "";
  const chainCommandLabel = chainCommand.replace(/\s+/g, " ");
  const chainProgress = chainHint ? renderDiscoveryChainProgress(chainHint.progress) : "";
  const chainHintCard = chainHint
    ? `<div class="discovery-chain-next"><span>${escapeHTML(chainHint.label)}</span><strong>${escapeHTML(chainHint.title)}</strong><p>${escapeHTML(chainHint.body)}</p>${chainProgress}${chainContract ? `<div class="discovery-chain-contract"><span><b>NEXT</b>${escapeHTML(chainContract.title || "Make one fresh change")}</span><span><b>WHY</b>${escapeHTML(chainContract.body || "Compare one changed result.")}</span></div>` : ""}${chainCommand ? `<div class="discovery-chain-code">Try <code>${escapeHTML(chainCommandLabel)}</code><button type="button" class="discovery-chain-stage-btn" data-chain-next-command="${escapeHTML(chainCommand)}" data-chain-next-title="${escapeHTML(chainContract.title || "Lab chain")}">${escapeHTML(chainContract.cta || "STAGE CHAIN")}</button></div>` : ""}</div>`
    : "";
  panel.innerHTML = `
    <div class="discovery-pulse-head">
      <span>DISCOVERY PULSE</span>
      <strong>${escapeHTML(reward)}${escapeHTML(combo)}</strong>
    </div>
    <div class="discovery-pulse-formula">${escapeHTML(pulse.formula)}</div>
    ${comboChip}
    ${comboAmplifier}
    ${comboMilestone}
    ${hypothesis}
    ${scienceCheckpoint}
    ${scienceProof}
    ${codeConcept}
    ${codeConceptDeckMastery}
    ${lessonPhase}
    ${lessonPathMastery}
    ${passportStamp}
    ${formulaDeckMastery}
    ${formulaDeckNext}
    ${aiStateDeckMastery}
    ${signalLabProof}
    ${repairProof}
    ${anomalyTraceProof}
    ${quantumBranchProof}
    ${quantumChanceProof}
    ${futureLabScene}
    ${drillProof}
    ${villageTradeProof}
    ${petProof}
    ${aiStateRunProof}
    ${frontierRivalProof}
    ${frontierRivalMilestone}
    ${villageTrust}
    ${villagePact}
    ${rankPerk}
    ${unlockCard}
    <div class="discovery-pulse-body">${escapeHTML(pulse.insight)}</div>
    ${chainHintCard}
    <div class="discovery-pulse-foot">${escapeHTML(pulse.missionTitle)} · ${escapeHTML(progress)}${pulse.openedGems ? ` · ${escapeHTML(String(pulse.openedGems))} gem gate${pulse.openedGems === 1 ? "" : "s"}` : ""}</div>
  `;
  attachDiscoveryPulseStageButtons(panel, game, pulse);
}

function attachDiscoveryPulseStageButtons(panel, game, pulse) {
  if (!panel || typeof panel.querySelectorAll !== "function" || typeof stageScienceDeltaCommand !== "function") return;
  const chainHint = getDiscoveryChainHint(pulse, game);
  const chainContract = chainHint && chainHint.contract ? chainHint.contract : null;
  panel.querySelectorAll("[data-chain-next-command]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset && button.dataset.chainNextCommand
        ? button.dataset.chainNextCommand
        : (chainContract && chainContract.command ? chainContract.command : "");
      if (!String(command || "").trim()) return false;
      const title = button.dataset && button.dataset.chainNextTitle
        ? button.dataset.chainNextTitle
        : (chainContract && chainContract.title ? chainContract.title : "Lab chain");
      return stageScienceDeltaCommand(command, {
        title,
        kind: chainContract && chainContract.kind ? chainContract.kind : "lab-chain",
        source: "lab-chain-next",
        color: "#67e8f9"
      });
    });
  });
  const phase = pulse && pulse.lessonPhaseAdvance ? pulse.lessonPhaseAdvance : null;
  panel.querySelectorAll("[data-phase-next-command]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset && button.dataset.phaseNextCommand
        ? button.dataset.phaseNextCommand
        : (phase && phase.nextCommand ? phase.nextCommand : "");
      if (!String(command || "").trim()) return false;
      const title = button.dataset && button.dataset.phaseNextTitle
        ? button.dataset.phaseNextTitle
        : (phase && phase.nextTitle ? phase.nextTitle : "Next lesson phase");
      return stageScienceDeltaCommand(command, {
        title,
        kind: "lesson-phase",
        source: "phase-reward",
        color: "#fbbf24"
      });
    });
  });
  const formulaProgress = pulse && pulse.formulaDeckProgress ? pulse.formulaDeckProgress : null;
  panel.querySelectorAll("[data-formula-next-command]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset && button.dataset.formulaNextCommand
        ? button.dataset.formulaNextCommand
        : (formulaProgress && formulaProgress.nextCommand ? formulaProgress.nextCommand : "");
      if (!String(command || "").trim()) return false;
      const title = button.dataset && button.dataset.formulaNextTitle
        ? button.dataset.formulaNextTitle
        : (formulaProgress && formulaProgress.nextTitle ? formulaProgress.nextTitle : "Next formula");
      return stageScienceDeltaCommand(command, {
        title,
        kind: "formula-card",
        source: "formula-card-reward",
        color: "#facc15"
      });
    });
  });
  const scienceProof = pulse && pulse.scienceDeltaProof ? pulse.scienceDeltaProof : null;
  panel.querySelectorAll("[data-science-proof-command]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset && button.dataset.scienceProofCommand
        ? button.dataset.scienceProofCommand
        : (scienceProof && scienceProof.nextCommand ? scienceProof.nextCommand : "");
      if (!String(command || "").trim()) return false;
      const title = button.dataset && button.dataset.scienceProofTitle
        ? button.dataset.scienceProofTitle
        : (scienceProof && scienceProof.nextTitle ? scienceProof.nextTitle : "Next proof");
      return stageScienceDeltaCommand(command, {
        title,
        kind: "science-proof",
        source: "science-proof",
        color: "#67e8f9"
      });
    });
  });
  const codeConcept = pulse && pulse.codeConceptProof ? pulse.codeConceptProof : null;
  panel.querySelectorAll("[data-code-concept-next-command]").forEach(button => {
    if (!button || typeof button.addEventListener !== "function") return;
    button.addEventListener("click", () => {
      const command = button.dataset && button.dataset.codeConceptNextCommand
        ? button.dataset.codeConceptNextCommand
        : (codeConcept && codeConcept.nextCommand ? codeConcept.nextCommand : "");
      if (!String(command || "").trim()) return false;
      const title = button.dataset && button.dataset.codeConceptNextTitle
        ? button.dataset.codeConceptNextTitle
        : (codeConcept && codeConcept.nextTitle ? codeConcept.nextTitle : "Next coding idea");
      const kind = button.dataset && button.dataset.codeConceptNextKind
        ? button.dataset.codeConceptNextKind
        : (codeConcept && codeConcept.nextConcept ? codeConcept.nextConcept : "code-concept");
      return stageScienceDeltaCommand(command, {
        title,
        kind,
        source: "code-concept-reward",
        color: "#93c5fd"
      });
    });
  });
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

function getCoachStepParts(step, index = 0) {
  const prompt = step && step.prompt ? String(step.prompt) : `Step ${index + 1}`;
  const parts = prompt.match(/^([A-Za-z]+):\s*([\s\S]*)$/);
  return {
    tag: parts ? parts[1] : `Step ${index + 1}`,
    body: parts ? parts[2] : prompt
  };
}

function getCoachProofHook(game, activeMission) {
  if (!game || !activeMission || !activeMission.fullMission) return null;
  const fullMission = activeMission.fullMission;
  const missionDone = game.completedMissions && game.completedMissions.has(activeMission.id);
  if (missionDone) {
    return {
      label: "PROOF BANKED",
      title: "Explain the evidence",
      body: "Write what your code changed so the test turns into a saved lab proof.",
      reward: "Reward: stronger lab record"
    };
  }

  const labChain = typeof getLabChainTarget === "function" ? getLabChainTarget(game) : null;
  if (labChain) {
    return {
      label: labChain.label || "LAB CHAIN",
      title: labChain.title || "Make one fresh change",
      body: labChain.reward || labChain.body || "Fresh progress keeps the experiment chain alive.",
      command: labChain.command || ""
    };
  }

  const formulaTarget = typeof getActiveFormulaTarget === "function" ? getActiveFormulaTarget(game, activeMission) : null;
  if (formulaTarget) {
    return {
      label: "FORMULA CARD",
      title: `Collect ${formulaTarget.title || "science proof"}`,
      body: formulaTarget.cue || formulaTarget.axis || "Run the matching code and compare what changed.",
      command: formulaTarget.sampleCode || ""
    };
  }

  const codeConceptTarget = typeof getActiveCodeConceptTarget === "function" ? getActiveCodeConceptTarget(game) : null;
  if (codeConceptTarget && codeConceptTarget.command) {
    return {
      label: "CODE CONCEPT",
      title: `Collect ${codeConceptTarget.title || "coding idea"}`,
      body: codeConceptTarget.reward || codeConceptTarget.body || "Practice one programming idea and save it to the deck.",
      command: codeConceptTarget.command
    };
  }

  const command = typeof buildNextExperimentCommand === "function"
    ? buildNextExperimentCommand(fullMission, null, game)
    : (fullMission.starterCode || "");
  const badge = fullMission.badge || null;
  return {
    label: "NEXT PROOF",
    title: badge ? `Unlock ${badge.label}` : "Run one clean test",
    body: badge && badge.description ? badge.description : "Make one obvious tweak, test the result, then compare the evidence.",
    command
  };
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
  const rootScaffold = fullMission ? fullMission.scaffold : null;
  const scaffold = rootScaffold ? scaffoldWithActiveSlots(rootScaffold, game, fullMission) : null;
  if (!scaffold) { container.innerHTML = ""; return; }
  container.innerHTML = "";
  appendHTML(container, renderMissionLessonPhaseLadder(game, fullMission, "MISSION PHASES"));
  attachLessonPhaseStageButtons(container, game, fullMission);

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
  if (state.index > slots.length) state.index = slots.length;

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
    if (isSlotAlreadySet(game, varName, Number(slot.value), slot)) state.index += 1;
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

  const lockedBeforeList = typeof game.getLockedRequiredCollectibles === 'function' ? game.getLockedRequiredCollectibles() : [];
  const lockedBefore = lockedBeforeList.length || (typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : 0);
  const scienceBefore = captureScienceDeltaSnapshot(game);
  ui_log_input(trimmed);
  const res = Compiler.runCommand(trimmed, game);
  if (res.success) {
    recordScienceDelta(game, scienceBefore, captureScienceDeltaSnapshot(game), trimmed);
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
    attachScienceDeltaNextExperiment(game, resultState, activeMission);
    finishSuccessfulCodeRunDiscovery(game, activeMission, trimmed, resultState, lockedBefore, lockedBeforeList);
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

function scienceDeltaNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function scienceDeltaCount(game, type) {
  if (!game || !Array.isArray(game.interactiveObjects)) return 0;
  return game.interactiveObjects.filter(obj => obj && !obj.collected && obj.type === type).length;
}

function captureScienceDeltaSnapshot(game) {
  if (!game) return null;
  const player = game.player || {};
  const stat = typeof game.getMissionStat === 'function' ? game.getMissionStat() : null;
  const chanceStats = game.chanceTrialStats && typeof game.chanceTrialStats === 'object' ? game.chanceTrialStats : {};
  const lastChance = game.lastChanceResult && typeof game.lastChanceResult === 'object' ? game.lastChanceResult : null;
  return {
    suit: player.charType || null,
    mass: typeof game.getActiveMass === 'function' ? game.getActiveMass() : (Number.isFinite(player.mass) ? player.mass : null),
    engine: typeof game.getEngineForce === 'function' ? game.getEngineForce() : null,
    jump: typeof game.getJumpForce === 'function' ? game.getJumpForce() : (Number.isFinite(player.jumpPower) ? player.jumpPower : null),
    rocket: Number.isFinite(player.rocketPower) ? player.rocketPower : null,
    gravity: typeof game.getDesignGravity === 'function' ? game.getDesignGravity() : (typeof game.getCurrentGravity === 'function' ? game.getCurrentGravity() : null),
    friction: typeof game.getCurrentFriction === 'function' ? game.getCurrentFriction() : null,
    missionStat: stat ? { key: stat.key, label: stat.label, value: stat.value, target: stat.target } : null,
    springs: scienceDeltaCount(game, 'spring') + scienceDeltaCount(game, 'trampoline'),
    boxes: game && Array.isArray(game.spawnedBoxes) ? game.spawnedBoxes.length : scienceDeltaCount(game, 'box'),
    gems: scienceDeltaCount(game, 'coin'),
    rules: (typeof Compiler !== 'undefined' && Array.isArray(Compiler.activeRules)) ? Compiler.activeRules.length : 0,
    chanceTrials: Math.max(0, Math.floor(Number(chanceStats.trials) || 0)),
    chancePasses: Math.max(0, Math.floor(Number(chanceStats.passes) || 0)),
    chanceFails: Math.max(0, Math.floor(Number(chanceStats.fails) || 0)),
    lastChance: lastChance ? {
      percent: Number.isFinite(Number(lastChance.percent)) ? Number(lastChance.percent) : null,
      roll: Number.isFinite(Number(lastChance.roll)) ? Number(lastChance.roll) : null,
      passed: !!lastChance.passed
    } : null
  };
}

function formatScienceDeltaValue(value) {
  if (typeof value === "string") return value;
  const rounded = scienceDeltaNumber(value);
  if (rounded === null) return "?";
  return Math.abs(rounded) >= 10 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

function makeScienceDeltaChange(label, before, after, cueUp, cueDown, options = {}) {
  const b = scienceDeltaNumber(before);
  const a = scienceDeltaNumber(after);
  if (b === null || a === null || Math.abs(a - b) < (options.epsilon || 0.05)) return null;
  const up = a > b;
  const delta = a - b;
  return {
    label,
    value: `${formatScienceDeltaValue(b)} -> ${formatScienceDeltaValue(a)} (${delta > 0 ? "+" : ""}${formatScienceDeltaValue(delta)})`,
    direction: up ? "up" : "down",
    cue: up ? cueUp : cueDown
  };
}

function getScienceDeltaTargetMilestone(progressBefore, progressAfter) {
  if (!Number.isFinite(progressBefore) || !Number.isFinite(progressAfter) || progressAfter <= progressBefore) return null;
  const milestones = [
    { threshold: 0.9, label: "ALMOST THERE!", detail: "90% TARGET" },
    { threshold: 0.75, label: "THREE-QUARTERS!", detail: "75% TARGET" },
    { threshold: 0.5, label: "HALFWAY!", detail: "50% TARGET" }
  ];
  return milestones.find(item => progressBefore < item.threshold && progressAfter >= item.threshold) || null;
}

function buildScienceDelta(game, before, after, code) {
  if (!game || !before || !after) return null;
  const changes = [];
  const add = (change) => { if (change) changes.push(change); };
  let missionTarget = null;

  if (before.suit !== after.suit && after.suit) {
    changes.push({
      label: "Suit",
      value: `${before.suit || "none"} -> ${after.suit}`,
      direction: "swap",
      cue: after.suit === "hopper" ? "Hopper uses the heavy engineering knobs." : "Rover is lighter and nimble."
    });
  }

  add(makeScienceDeltaChange(
    "Mass",
    before.mass,
    after.mass,
    "More inertia: harder to speed up; gravity still sets falling acceleration.",
    "Less mass: same force makes more acceleration; gravity still sets falling acceleration."
  ));
  add(makeScienceDeltaChange("Engine force", before.engine, after.engine, "More force raises top speed.", "Less force lowers top speed."));
  add(makeScienceDeltaChange("Jump force", before.jump, after.jump, "Bigger upward impulse.", "Smaller upward impulse."));
  add(makeScienceDeltaChange("Rocket power", before.rocket, after.rocket, "More thrust for heavy worlds.", "Less thrust saves fuel but lifts less."));
  add(makeScienceDeltaChange("Felt gravity", before.gravity, after.gravity, "Stronger pull shortens airtime.", "Lower pull gives longer airtime."));
  add(makeScienceDeltaChange("Friction", before.friction, after.friction, "More grip, less sliding.", "Less grip, more sliding."));

  if (before.missionStat && after.missionStat && before.missionStat.key === after.missionStat.key) {
    add(makeScienceDeltaChange(after.missionStat.label, before.missionStat.value, after.missionStat.value, `Target ${Math.round(after.missionStat.target)} is closer.`, "The target moved farther away.", { epsilon: 0.4 }));
    const beforeValue = scienceDeltaNumber(before.missionStat.value);
    const afterValue = scienceDeltaNumber(after.missionStat.value);
    const targetValue = scienceDeltaNumber(after.missionStat.target);
    if (beforeValue !== null && afterValue !== null && targetValue !== null && targetValue > 0) {
      const progressBefore = Math.max(0, Math.min(1, beforeValue / targetValue));
      const progressAfter = Math.max(0, Math.min(1, afterValue / targetValue));
      const milestone = getScienceDeltaTargetMilestone(progressBefore, progressAfter);
      missionTarget = {
        key: after.missionStat.key || "",
        label: after.missionStat.label || "Target",
        before: beforeValue,
        after: afterValue,
        target: targetValue,
        progressBefore,
        progressAfter,
        milestone,
        ready: afterValue >= targetValue,
        crossed: beforeValue < targetValue && afterValue >= targetValue
      };
    }
  }

  const countSpecs = [
    { key: "springs", label: "Springs", cue: "Loop-built tools change the level." },
    { key: "boxes", label: "Blocks", cue: "Mined or spawned blocks reshape the path." },
    { key: "gems", label: "Gems", cue: "Spawned samples can support experiments." },
    { key: "rules", label: "Event rules", cue: "Automation is now watching the game state." }
  ];
  countSpecs.forEach(spec => {
    const b = Number(before[spec.key]) || 0;
    const a = Number(after[spec.key]) || 0;
    if (a !== b) {
      changes.push({
        label: spec.label,
        value: `${b} -> ${a} (${a > b ? "+" : ""}${a - b})`,
        direction: a > b ? "up" : "down",
        cue: spec.cue
      });
    }
  });

  const beforeChanceTrials = Math.max(0, Math.floor(Number(before.chanceTrials) || 0));
  const afterChanceTrials = Math.max(0, Math.floor(Number(after.chanceTrials) || 0));
  if (afterChanceTrials > beforeChanceTrials) {
    const trials = afterChanceTrials - beforeChanceTrials;
    const passes = Math.max(0, Math.floor(Number(after.chancePasses) || 0) - Math.floor(Number(before.chancePasses) || 0));
    const observedRate = trials > 0 ? Math.round((passes / trials) * 100) : 0;
    const targetPercent = after.lastChance && Number.isFinite(after.lastChance.percent)
      ? formatScienceDeltaValue(after.lastChance.percent)
      : "?";
    changes.push({
      label: "Probability",
      value: `${passes}/${trials} passed (${observedRate}%)`,
      direction: passes > 0 ? "up" : "same",
      cue: `Target chance ${targetPercent}%. More trials reveal the pattern.`
    });
  }

  if (!changes.length) return null;
  const strongest = changes.find(change => /Agility|Thrust/.test(change.label)) || changes[0];
  return {
    title: "What changed",
    summary: strongest ? `${strongest.label} changed` : "Experiment changed",
    changes,
    missionTarget,
    code: String(code || "").slice(0, 160),
    time: Date.now()
  };
}

function buildNextExperimentCommand(fullMission, failed = null, game = null) {
  if (!fullMission) return "";
  const scaffold = fullMission.scaffold ? scaffoldWithActiveSlots(fullMission.scaffold, game, fullMission) : null;
  if (scaffold && scaffold.template) {
    const setupLines = coachSetupLines(scaffold);
    const failedText = `${failed && failed.id ? failed.id : ""} ${failed && failed.label ? failed.label : ""} ${failed && failed.message ? failed.message : ""}`;
    if (/activate|active|use_hopper|use_rover/i.test(failedText) && setupLines.length) {
      return setupLines.join("\n");
    }
    if (failed && failed.id && Array.isArray(scaffold.slots)) {
      const slot = scaffold.slots.find(item => item && item.resultCheckId === failed.id);
      if (slot) {
        const assignment = coachAssignment(scaffold, slot, slot.correctValue !== undefined ? slot.correctValue : slot.value);
        if (setupLines.length && scaffold.slots.indexOf(slot) === 0) return `${setupLines.join("\n")}\n${assignment}`;
        return assignment;
      }
      const values = typeof getCorrectedScaffoldValues === 'function' ? getCorrectedScaffoldValues(scaffold) : {};
      return buildScaffoldCode(scaffold, values);
    }
    if (game && Array.isArray(scaffold.slots)) {
      const nextSlot = scaffold.slots.find(slot => slot && slot.resultCheckId && !missionResultCheckPassed(game, fullMission, slot.resultCheckId));
      if (nextSlot) {
        const assignment = coachAssignment(scaffold, nextSlot, nextSlot.correctValue !== undefined ? nextSlot.correctValue : nextSlot.value);
        if (setupLines.length && scaffold.slots.indexOf(nextSlot) === 0) return `${setupLines.join("\n")}\n${assignment}`;
        return assignment;
      }
    }
    const values = typeof getCorrectedScaffoldValues === 'function' ? getCorrectedScaffoldValues(scaffold) : {};
    return buildScaffoldCode(scaffold, values);
  }
  return fullMission.starterCode || "";
}

function formatStagedExperimentLabel(title) {
  const clean = String(title || "Code")
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  return `${clean || "CODE"} READY`.toUpperCase();
}

function stageScienceDeltaCommand(command, options = {}) {
  const code = String(command || "").trim();
  if (!code || typeof document === 'undefined') return false;
  const input = document.getElementById("console-input");
  if (!input) return false;
  input.value = code;
  if (typeof autoGrowConsoleInput === 'function') autoGrowConsoleInput(input);
  if (typeof input.focus === 'function') input.focus();
  if (typeof input.setSelectionRange === 'function') {
    try { input.setSelectionRange(code.length, code.length); } catch (e) { /* noop */ }
  }
  const meta = options && typeof options === 'object' ? options : {};
  const liveGame = meta.game || ((typeof window !== 'undefined' && window.Game) ? window.Game : null);
  const stagedTitle = meta.title || "Code staged";
  if (liveGame) {
    liveGame.lastStagedExperiment = {
      command: code,
      title: stagedTitle,
      kind: meta.kind || null,
      source: meta.source || "stage-button",
      prediction: meta.prediction || null,
      time: Date.now()
    };
  }
  if (liveGame && typeof liveGame.showMissionBalloon === 'function') {
    liveGame.showMissionBalloon("CODE STAGED: press Enter to test", {
      title: "MISSION CRT",
      color: "#a7f3d0",
      timer: 220
    });
  }
  if (liveGame && meta.title && liveGame.player && typeof ComicBubbles !== 'undefined' && ComicBubbles.pop) {
    const px = liveGame.player.x + (liveGame.player.w || 24) / 2;
    const py = liveGame.player.y - 18;
    const color = meta.color || "#a7f3d0";
    ComicBubbles.pop(px, py, formatStagedExperimentLabel(meta.title), color, 0.92);
    if (typeof Particles !== 'undefined' && Particles.spawnBurst) {
      Particles.spawnBurst(px, liveGame.player.y + (liveGame.player.h || 32) / 2, color, 9, 1.8, 1.7, 'glow');
    }
  }
  if (liveGame && liveGame.currentPlanet && typeof updateMissionList === 'function') updateMissionList(liveGame);
  if (typeof ui_log_output === 'function') ui_log_output("Next experiment staged in the terminal.", "info");
  return true;
}

function buildNextExperimentCue(game, resultState = null, activeMission = null) {
  if (!game) return null;
  const mission = activeMission || getActivePlatformerMission(game);
  const fullMission = mission && mission.fullMission ? mission.fullMission : null;
  let state = resultState;
  if (!state && fullMission) state = evaluateMissionResultChecks(game, fullMission);

  const failed = state && Array.isArray(state.items) ? state.items.find(item => !item.passed) : null;
  if (failed) {
    return {
      kind: "check",
      title: failed.label || "Fix the next check",
      body: failed.message || "Tune one value, run it, and watch what changes.",
      command: buildNextExperimentCommand(fullMission, failed, game)
    };
  }

  const locked = typeof game.getLockedRequiredCollectibleCount === 'function'
    ? game.getLockedRequiredCollectibleCount()
    : 0;
  if (locked > 0) {
    const gate = typeof game.getFirstLockedGemGate === 'function' ? game.getFirstLockedGemGate() : null;
    return {
      kind: "gems",
      title: `Unlock ${locked} mission gem${locked === 1 ? "" : "s"}`,
      body: gate && gate.label ? gate.label : "Run one focused code tweak, then collect the samples.",
      command: buildNextExperimentCommand(fullMission, null, game)
    };
  }

  const status = typeof game.getLevelObjectiveStatus === 'function' ? game.getLevelObjectiveStatus() : null;
  if (status && !status.readyForPortal) {
    const body = typeof game.formatObjectiveLockMessage === 'function'
      ? game.formatObjectiveLockMessage(status)
      : "Finish the checklist and collect the mission gems.";
    return {
      kind: "requirements",
      title: "Finish the active requirement",
      body,
      command: buildNextExperimentCommand(fullMission, null, game)
    };
  }

  return {
    kind: "portal",
    title: "Test the portal",
    body: "The experiment is ready. Drive to the portal and prove it in the level."
  };
}

function attachScienceDeltaNextExperiment(game, resultState = null, activeMission = null) {
  if (!game || !game.lastScienceDelta) return null;
  const cue = buildNextExperimentCue(game, resultState, activeMission);
  if (!cue) return null;
  game.lastScienceDelta.nextExperiment = cue;
  if (typeof game.syncScienceBreadcrumbNextExperiment === 'function') {
    game.syncScienceBreadcrumbNextExperiment(game.lastScienceDelta, cue);
  }
  return cue;
}

function recordScienceDelta(game, before, after, code) {
  const delta = buildScienceDelta(game, before, after, code);
  if (!game || !delta) return null;
  game.lastScienceDelta = delta;
  if (typeof game.spawnScienceDeltaEffect === 'function') {
    game.spawnScienceDeltaEffect(delta);
  }
  if (typeof grantScienceCheckpointProof === 'function') {
    grantScienceCheckpointProof(game, delta);
  }
  if (typeof ui_log_output === 'function') {
    const first = delta.changes[0];
    ui_log_output(`🔬 What changed: ${first.label} ${first.value}${first.cue ? ` — ${first.cue}` : ""}`, "info");
  }
  return delta;
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
          const scienceBefore = captureScienceDeltaSnapshot(game);
          const lockedBeforeList = typeof game.getLockedRequiredCollectibles === 'function' ? game.getLockedRequiredCollectibles() : [];
          const lockedBefore = lockedBeforeList.length || (typeof game.getLockedRequiredCollectibleCount === 'function' ? game.getLockedRequiredCollectibleCount() : 0);
          const res = Compiler.runCommand(val, game);
          if (res.success) {
            recordScienceDelta(game, scienceBefore, captureScienceDeltaSnapshot(game), val);
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
          if (res.success) {
            const activeMission = getActivePlatformerMission(game);
            const resultState = activeMission && activeMission.fullMission ? evaluateMissionResultChecks(game, activeMission.fullMission) : null;
            attachScienceDeltaNextExperiment(game, resultState, activeMission);
            finishSuccessfulCodeRunDiscovery(game, activeMission, val, resultState, lockedBefore, lockedBeforeList);
            logMissionStat(game);
            updateMissionList(game);
          }
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
  let activeIndex = steps.length ? steps.length - 1 : 0;
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

  // Show ONLY the current step plus a labeled lab-loop strip, not the whole wall
  // of checklist text.
  const loop = document.createElement("div");
  loop.className = "coach-lab-loop";
  steps.forEach((s, i) => {
    const done = game.currentMissionSteps[keys[i]];
    const chip = document.createElement("span");
    const parts = getCoachStepParts(s, i);
    chip.className = "coach-loop-chip" + (done ? " done" : (i === activeIndex ? " active" : ""));
    chip.textContent = parts.tag;
    chip.title = parts.body;
    loop.appendChild(chip);
  });
  stepsContainer.appendChild(loop);

  const activeStep = steps[activeIndex];
  if (activeStep) {
    // Split a "Observe: do the thing" prompt into a chip + friendly sentence.
    const parts = getCoachStepParts(activeStep, activeIndex);
    const item = document.createElement("div");
    item.className = "coach-active-step";
    item.innerHTML = `
      <div class="coach-step-num">Step ${activeIndex + 1} of ${steps.length} · <span class="coach-step-tag">${escapeHTML(parts.tag)}</span></div>
      <div class="coach-step-text">${escapeHTML(parts.body)}</div>
    `;
    stepsContainer.appendChild(item);
  }

  const proofHook = getCoachProofHook(game, activeMission);
  if (proofHook) {
    const hook = document.createElement("div");
    hook.className = "coach-proof-hook";
    const command = proofHook.command ? `<code>${escapeHTML(proofHook.command)}</code>` : "";
    hook.innerHTML = `
      <span>${escapeHTML(proofHook.label || "NEXT PROOF")}</span>
      <strong>${escapeHTML(proofHook.title || "Run one clean test")}</strong>
      <p>${escapeHTML(proofHook.body || "Run the code, compare the result, and save the evidence.")}</p>
      ${command}
    `;
    stepsContainer.appendChild(hook);
  }

  renderScaffoldEditor(game, activeMission);
}

function getTradeGemSymbol(type) {
  if (type === 'quartz') return "🤍";
  if (type === 'amber') return "🧡";
  if (type === 'ice') return "💜";
  if (type === 'flux') return "💖";
  if (type === 'forge') return "🟧";
  return "💚";
}

function getTradeGemLabel(type) {
  const labels = {
    emerald: "Emerald",
    quartz: "Quartz",
    amber: "Amber",
    ice: "Violet Ice",
    flux: "Flux",
    forge: "Forge"
  };
  return labels[type] || String(type || "gem");
}

function getTradeRewardSummary(trade) {
  const reward = trade && trade.reward ? trade.reward : {};
  if (reward.type === 'cap') {
    const key = String(reward.key || "stat").replace(/_/g, " ");
    const amount = Number(reward.amount) || 0;
    return `${key.toUpperCase()} +${amount} upgrade`;
  }
  if (reward.type === 'tool') {
    return `${reward.label || reward.key || "tool"} unlocked`;
  }
  if (reward.type === 'planet') {
    return "new world route unlocked";
  }
  return "village upgrade";
}

function getVillageTradeRequest(game, npc) {
  if (!npc || !Array.isArray(npc.trades) || !npc.trades.length) return null;
  const wallet = game && game.gemsWallet ? game.gemsWallet : {};
  const purchased = game && game.purchasedTrades ? game.purchasedTrades : new Set();
  const openTrades = npc.trades.filter(trade => trade && !(purchased.has && purchased.has(trade.id)));
  if (!openTrades.length) {
    return {
      kicker: "VILLAGE COMPLETE",
      title: "All local trades unlocked",
      body: `${npc.name || "This villager"} has no more requests. Use the tools in mastery remixes or Daily Signals.`,
      reward: "Payoff: stronger replay kit",
      complete: true
    };
  }
  const ranked = openTrades.slice().sort((a, b) => {
    const aCost = a.cost || {};
    const bCost = b.cost || {};
    const aMissing = Math.max(0, (Number(aCost.amount) || 0) - (Number(wallet[aCost.type]) || 0));
    const bMissing = Math.max(0, (Number(bCost.amount) || 0) - (Number(wallet[bCost.type]) || 0));
    if (aMissing === 0 && bMissing > 0) return -1;
    if (bMissing === 0 && aMissing > 0) return 1;
    return aMissing - bMissing;
  });
  const trade = ranked[0];
  const cost = trade.cost || {};
  const costType = cost.type || "emerald";
  const costAmount = Number(cost.amount) || 0;
  const have = Number(wallet[costType]) || 0;
  const missing = Math.max(0, costAmount - have);
  const gemLabel = getTradeGemLabel(costType);
  const gemSymbol = getTradeGemSymbol(costType);
  const villagerName = npc.name || "this villager";
  return {
    kicker: missing === 0 ? "READY TRADE" : "VILLAGE REQUEST",
    title: trade.desc || "Village upgrade",
    body: missing === 0
      ? `${villagerName} can craft this now. Spend ${costAmount} ${gemLabel} ${gemSymbol} to turn samples into an upgrade.`
      : `Collect ${missing} more ${gemLabel} ${gemSymbol} for ${villagerName}. The next sample has a tool payoff.`,
    reward: `Payoff: ${getTradeRewardSummary(trade)}`,
    ready: missing === 0,
    tradeId: trade.id,
    costType,
    costAmount,
    have,
    missing,
    gemSymbol
  };
}

function getVillageTradeMarker(game, npc) {
  if (!npc || npc.hiddenInCave || npc.rescuePending || npc.shelterReason) return null;
  const shelter = game && typeof game.getVillagerShelterSignal === 'function'
    ? game.getVillagerShelterSignal(npc)
    : null;
  if (shelter && shelter.active) return null;

  const request = getVillageTradeRequest(game, npc);
  if (!request) return null;
  if (request.complete) {
    return {
      tone: "complete",
      label: "DONE",
      detail: "ALL SET",
      color: "#a7f3d0"
    };
  }
  if (request.ready) {
    return {
      tone: "ready",
      label: "READY",
      detail: "TRADE",
      color: (npc && npc.color) || "#a7f3d0",
      tradeId: request.tradeId || ""
    };
  }
  const missing = Math.max(0, Math.floor(Number(request.missing) || 0));
  return {
    tone: "need",
    label: `NEED ${missing > 99 ? "99+" : String(missing)}`,
    detail: String(getTradeGemLabel(request.costType)).toUpperCase(),
    color: "#facc15",
    tradeId: request.tradeId || "",
    missing
  };
}

function renderVillageTradeRequestHTML(request) {
  if (!request) return "";
  return `
    <span>${escapeHTML(request.kicker)}</span>
    <strong>${escapeHTML(request.title)}</strong>
    <p>${escapeHTML(request.body)}</p>
    <em>${escapeHTML(request.reward)}</em>
  `;
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

  const tradeRequest = getVillageTradeRequest(window.Game, npc);
  const requestEl = document.getElementById("trade-request-card");
  if (requestEl) {
    if (tradeRequest) {
      requestEl.className = `trade-request-card${tradeRequest.ready ? " ready" : ""}${tradeRequest.complete ? " complete" : ""}`;
      requestEl.innerHTML = renderVillageTradeRequestHTML(tradeRequest);
    } else {
      requestEl.className = "trade-request-card hidden";
      requestEl.innerHTML = "";
    }
  }

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
        tradeRow.className = `trade-row${tradeRequest && tradeRequest.tradeId === trade.id ? " requested" : ""}`;
        
        const gemSymbol = getTradeGemSymbol(costType);

        let btnHtml = "";
        if (purchased) {
          btnHtml = `<button class="trade-btn completed" disabled>TRADED</button>`;
        } else {
          btnHtml = `<button class="trade-btn" ${hasEnough ? "" : "disabled"} onclick="executeNPCTrade('${npc.id}', '${trade.id}')">TRADE</button>`;
        }

        tradeRow.innerHTML = `
          <div class="trade-info">
            <span class="trade-desc">${escapeHTML(trade.desc)}</span>
            <span class="trade-cost">Cost: ${escapeHTML(costAmount)} ${escapeHTML(costType)} ${gemSymbol} (Have: ${escapeHTML(playerBalance)})</span>
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

  const rewardEffect = typeof window.Game.spawnTradeRewardEffect === 'function'
    ? window.Game.spawnTradeRewardEffect(npc, trade)
    : null;
  if (typeof window.Game.grantVillageTradeProof === 'function') {
    window.Game.grantVillageTradeProof(npc, trade);
  }

  // Older game objects fall back to the generic starburst above the player.
  if (!rewardEffect && window.Game.player && typeof Particles !== 'undefined') {
    Particles.spawnBurst(window.Game.player.x + window.Game.player.w / 2, window.Game.player.y + window.Game.player.h / 2, npc.color, 12, 3, 3, 'glow');
  }

  // Re-save progress
  if (typeof saveLocalProgress === 'function') saveLocalProgress();

  // Refresh Trade Screen UI
  openTradeScreen(npc);
}
