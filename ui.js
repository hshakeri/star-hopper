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

  // 0. Mission composite stat (Agility/Thrust) — one forgiving target, shown live.
  const hudRow = document.getElementById("hud-row");
  const stat = (typeof game.getMissionStat === "function") ? game.getMissionStat() : null;
  if (hudRow) {
    if (stat) {
      hudRow.classList.add("has-mission-stat");
      const labelEl = document.getElementById("hud-mission-stat-label");
      const valEl = document.getElementById("hud-mission-stat");
      const card = document.getElementById("card-mission-stat");
      if (labelEl) labelEl.textContent = stat.label;
      if (valEl) valEl.textContent = `${Math.round(stat.value)} / ${stat.target}`;
      if (card) card.classList.toggle("stat-passed", stat.value >= stat.target);
    } else {
      hudRow.classList.remove("has-mission-stat");
    }
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
    const trackNames = ["Earth Base", "Moon Orbit", "Jupiter Core", "Glacies Ice", "Mag Field", "Tears"];
    musicTrack.textContent = SFX.isMuted ? "Muted" : (trackNames[SFX.currentBgm] || "No Music");
  }

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

// Update Mission Checklist UI
function updateMissionList(game) {
  updatePedagogicalGuide(game);
  updateParentMissionSummary(game);
  if (typeof updateLearningConceptProgress === 'function') {
    updateLearningConceptProgress(game);
  }

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

function renderScaffoldEditor(game, mission) {
  const container = document.getElementById("mission-scaffold");
  if (!container) return;

  const scaffold = mission && mission.fullMission ? mission.fullMission.scaffold : null;
  if (!scaffold) {
    container.innerHTML = "";
    return;
  }
  const fullMission = mission.fullMission;
  const selectedPrediction = game.coachPredictions ? game.coachPredictions[mission.id] : null;

  container.innerHTML = "";

  const card = document.createElement("div");
  card.className = "try-code-card";

  if (fullMission.prediction) {
    const prediction = document.createElement("div");
    prediction.className = "coach-prediction-card";
    const selectedOption = getCoachPredictionOption(game, mission.id);
    prediction.innerHTML = `
      <div class="coach-mini-title">Predict first</div>
      <p>${escapeHTML(fullMission.prediction.question)}</p>
      <div class="prediction-options">
        ${fullMission.prediction.options.map(option => `
          <button type="button" class="prediction-option ${selectedPrediction === option.id ? "selected" : ""}" data-prediction-id="${escapeHTML(option.id)}">
            ${escapeHTML(option.label)}
          </button>
        `).join("")}
      </div>
      <div class="prediction-feedback ${selectedOption ? "" : "hidden"}">${selectedOption ? escapeHTML(selectedOption.feedback) : ""}</div>
    `;
    prediction.querySelectorAll("[data-prediction-id]").forEach(button => {
      button.addEventListener("click", () => {
        game.coachPredictions = game.coachPredictions || {};
        game.coachPredictions[mission.id] = button.dataset.predictionId;
        if (game.currentMissionSteps) game.currentMissionSteps.predict = true;
        const option = fullMission.prediction.options.find(item => item.id === button.dataset.predictionId);
        if (option && typeof showDialogue === 'function') {
          showDialogue(option.feedback, "predict");
        }
        updatePedagogicalGuide(game);
        updateParentMissionSummary(game);
      });
    });
    container.appendChild(prediction);
  }

  const header = document.createElement("div");
  header.className = "try-code-header";
  header.innerHTML = `<span>Try this code</span><span>${escapeHTML(getScaffoldModeLabel(scaffold.mode))}</span>`;
  card.appendChild(header);

  if (scaffold.commandChoices && scaffold.commandChoices.length) {
    const choices = document.createElement("div");
    choices.className = "command-choice-row";
    choices.innerHTML = scaffold.commandChoices.map(choice => `<span>${escapeHTML(choice)}</span>`).join("");
    card.appendChild(choices);
  }

  const slots = document.createElement("div");
  slots.className = "scaffold-slot-grid";
  scaffold.slots.forEach(slot => {
    const label = document.createElement("label");
    label.className = "scaffold-slot";
    label.title = slot.hint || "";

    const name = document.createElement("span");
    name.textContent = slot.label;

    const input = document.createElement("input");
    input.type = "text";
    input.value = slot.value;
    input.dataset.scaffoldSlot = slot.id;
    input.autocomplete = "off";
    input.spellcheck = false;

    label.appendChild(name);
    label.appendChild(input);
    slots.appendChild(label);
  });
  card.appendChild(slots);

  const explanation = document.createElement("p");
  explanation.className = "try-code-explain";
  explanation.textContent = scaffold.explain;
  card.appendChild(explanation);

  const preview = document.createElement("pre");
  preview.className = "try-code-preview";
  const refreshPreview = () => {
    preview.textContent = buildScaffoldCode(scaffold, getScaffoldValues(card));
  };
  refreshPreview();
  card.appendChild(preview);

  slots.addEventListener("input", refreshPreview);

  const actions = document.createElement("div");
  actions.className = "try-code-actions";

  const runBtn = document.createElement("button");
  runBtn.className = "notebook-btn run-scaffold-btn";
  runBtn.type = "button";
  const predictionRequired = !!fullMission.prediction && !selectedPrediction;
  runBtn.disabled = predictionRequired;
  runBtn.textContent = predictionRequired ? "Pick Prediction First" : "Run Code";
  runBtn.addEventListener("click", () => {
    const code = buildScaffoldCode(scaffold, getScaffoldValues(card));
    runCoachCode(game, code);
  });

  const editBtn = document.createElement("button");
  editBtn.className = "notebook-btn edit-scaffold-btn";
  editBtn.type = "button";
  editBtn.textContent = "Edit in terminal";
  editBtn.addEventListener("click", () => {
    const input = document.getElementById("console-input");
    if (input) {
      input.value = buildScaffoldCode(scaffold, getScaffoldValues(card));
      autoGrowConsoleInput(input);
      input.focus();
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(runBtn);
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
    if (lockedBefore > lockedAfter) {
      const opened = lockedBefore - lockedAfter;
      ui_log_output(`◆ Code unlocked ${opened} mission gem${opened === 1 ? "" : "s"}!`, "success");
      if (typeof showDialogue === 'function') {
        showDialogue(`Nice engineering. ${opened} gem gate${opened === 1 ? "" : "s"} opened!`, "badge");
      }
    }
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

function showDialogue(text, trigger = "start") {
  const bubble = document.getElementById("dialogue-bubble");
  const textContainer = document.getElementById("dialogue-text");
  if (!bubble || !textContainer) return;

  bubble.style.display = "flex";
  bubble.style.borderColor = trigger === "start" ? "var(--active-neon)" : "var(--neon-pink)";
  
  // Clear previous typing intervals
  if (currentDialogueTimer) {
    clearInterval(currentDialogueTimer);
  }

  textContainer.textContent = "";
  let i = 0;
  
  currentDialogueTimer = setInterval(() => {
    if (i < text.length) {
      textContainer.textContent += text.charAt(i);
      i++;
      if (Math.random() < 0.25) SFX.playType(); // ticking sound
    } else {
      clearInterval(currentDialogueTimer);
      currentDialogueTimer = null;
    }
  }, 25);
}

function closeDialogue() {
  const bubble = document.getElementById("dialogue-bubble");
  if (bubble) bubble.style.display = "none";
  if (currentDialogueTimer) {
    clearInterval(currentDialogueTimer);
    currentDialogueTimer = null;
  }
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
        : "lower hopper.mass or gravity, or raise hopper.engine or player.jump_power";
      ui_log_output(`🎯 ${s.label}: ${Math.round(s.value)} / ${s.target} — ${tip} to push it up.`, "info");
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

// Binds UI controls, terminal input, and cards
function setupUIBindings(game) {
  setupResizablePanes();
  updatePauseControls();

  const input = document.getElementById("console-input");
  const suggestBox = document.getElementById("autocomplete-box");

  // Tab-completion cycle state: tabLast is the last value we wrote programmatically,
  // so a repeated Tab keeps cycling the same base prefix while any real typing resets.
  let tabBase = null, tabIdx = -1, tabLast = null;

  // 1. Code editor input submission
  if (input) {
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
        tabIdx = continuing ? (tabIdx + 1) % sugg.length : 0;
        const pick = sugg[tabIdx];
        const idx = text.lastIndexOf(cur);
        input.value = text.slice(0, idx) + pick;
        tabLast = input.value;
        autoGrowConsoleInput(input);
        if (suggestBox) suggestBox.style.display = "none";
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
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

    // Autocomplete dynamic input watcher
    if (suggestBox) {
      input.addEventListener("input", () => {
        const text = input.value;
        
        // Find trailing word/segment matching identifiers
        const lastWordMatch = text.match(/[\w\.]+$/);
        const prefix = lastWordMatch ? lastWordMatch[0] : "";
        
        const suggestions = Compiler.autocomplete.suggest(prefix);
        
        if (suggestions.length > 0) {
          suggestBox.innerHTML = "";
          suggestBox.style.display = "flex";
          
          suggestions.forEach(s => {
            const opt = document.createElement("div");
            opt.className = "autocomplete-item";
            opt.textContent = s;
            opt.addEventListener("mousedown", (ev) => {
              const index = text.lastIndexOf(prefix);
              input.value = text.slice(0, index) + s;
              input.focus();
              suggestBox.style.display = "none";
              ev.preventDefault();
            });
            suggestBox.appendChild(opt);
          });
        } else {
          suggestBox.style.display = "none";
        }
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
  
  // 4. Mute toggle
  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) {
    muteBtn.innerHTML = SFX.isMuted ? '🔇' : '🔊';
    muteBtn.title = SFX.isMuted ? "Sound muted" : "Toggle Sound";
    muteBtn.addEventListener("click", () => {
      const isMuted = SFX.toggleMute();
      muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
      muteBtn.title = isMuted ? "Sound muted" : "Toggle Sound";
    });
  }

  // 5. Code deck tabs
  const tabPhysics = document.getElementById("tab-btn-physics");
  const tabRules = document.getElementById("tab-btn-rules");
  const panePhysics = document.getElementById("pane-physics");
  const paneRules = document.getElementById("pane-rules");

  if (tabPhysics && tabRules && panePhysics && paneRules) {
    tabPhysics.addEventListener("click", () => {
      tabPhysics.classList.add("active");
      tabRules.classList.remove("active");
      panePhysics.classList.remove("hidden");
      paneRules.classList.add("hidden");
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
        SFX.startBGM(trackId);
        
        const trackNames = ["Earth Base", "Moon Orbit", "Jupiter Core", "Glacies Ice", "Magnet Field", "Tears (Jazz)"];
        ui_log_output(`Music set to: ${trackNames[trackId]}`, "success");
        
        updateMusicMenuState();
        musicDropdown.classList.remove("show");
      });
    });

    function updateMusicMenuState() {
      const activeTrack = SFX.currentBgm;
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

  panel.style.display = "block";
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

  steps.forEach((step, index) => {
    const isDone = game.currentMissionSteps[step.id];
    const isActive = index === activeIndex;

    const item = document.createElement("div");
    item.className = `step-checklist-item ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`;
    
    const icon = isDone ? "✓" : (isActive ? "▶" : "○");
    
    item.innerHTML = `
      <span class="bullet" style="color: ${isDone ? 'var(--neon-green)' : (isActive ? 'var(--neon-cyan)' : 'var(--text-muted)')}; font-weight:bold;">${icon} ${index + 1}.</span>
      <div style="flex-grow:1;">
        <span class="step-text" style="color: ${isActive ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight: ${isActive ? 'bold' : 'normal'};">${step.prompt}</span>
      </div>
    `;

    stepsContainer.appendChild(item);
  });

  renderScaffoldEditor(game, activeMission);
}
