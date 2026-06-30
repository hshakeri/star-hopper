// notebook.js - Manages the Science Notebook telemetry, journal, and certificate printing

// Memory storage for notebook entries
let notebookEntries = {};

// Keep track of peak flight metrics during play
let maxAltitudeObserved = 0;
let maxSpeedObserved = 0;
let flightStartTimestamp = null;
let currentFlightTime = 0;

const BEGINNER_CONCEPT_PROGRESS = [
  { id: "variables", label: "Variables", missionId: "earth-gravity-wall" },
  { id: "loops", label: "Loops", missionId: "moon-canyon-jump" },
  { id: "force", label: "Force/Mass", missionId: "jupiter-rocket-heavy" },
  { id: "friction", label: "Friction", missionId: "glacies-friction-loop" },
  { id: "events", label: "Events", missionId: "magnet-field-event" },
  { id: "navigation", label: "Navigation", navigation: true }
];

// Updates the Science Notebook UI with telemetry from the active game
function updateNotebook(game) {
  if (!game) return;

  const player = game.player;
  const planet = game.currentPlanet;

  // 1. Calculate values
  const mass = player.charType === 'star' ? 1.0 : 2.5;
  const velocitySq = (player.vx * player.vx) + (player.vy * player.vy);
  const currentSpeed = Math.sqrt(velocitySq);
  
  if (currentSpeed > maxSpeedObserved) {
    maxSpeedObserved = currentSpeed;
  }

  // Height: distance from floor level
  const floorY = 384;
  const heightVal = Math.max(0, floorY - (player.y + player.h));
  if (heightVal > maxAltitudeObserved) {
    maxAltitudeObserved = heightVal;
  }

  // Flight time tracking
  if (!player.onGround) {
    if (flightStartTimestamp === null) {
      flightStartTimestamp = Date.now();
    }
    currentFlightTime = (Date.now() - flightStartTimestamp) / 1000;
  } else {
    flightStartTimestamp = null;
  }

  // Current gravity
  const currentG = Compiler.env.gravity !== null ? Compiler.env.gravity : (planet ? planet.physics.gravity : 0.6);

  // Mechanical energy calculations
  let ke = 0.5 * mass * velocitySq;
  let pe = mass * Math.abs(currentG) * heightVal * 0.05;
  if (pe < 0) pe = 0;
  let te = ke + pe;

  // Render text telemetry
  const timeEl = document.getElementById("notebook-stat-time");
  const heightEl = document.getElementById("notebook-stat-height");
  const speedEl = document.getElementById("notebook-stat-speed");
  const gravityEl = document.getElementById("notebook-stat-gravity");
  const researchEl = document.getElementById("notebook-stat-research");

  if (timeEl) timeEl.textContent = `${currentFlightTime.toFixed(1)}s`;
  if (heightEl) heightEl.textContent = `${Math.round(maxAltitudeObserved)}px`;
  if (speedEl) speedEl.textContent = `${maxSpeedObserved.toFixed(1)} px/f`;
  if (gravityEl) {
    const realWorldG = (currentG / 0.6) * 9.8;
    gravityEl.textContent = `${realWorldG.toFixed(1)} m/s²`;
  }
  if (researchEl) {
    researchEl.textContent = `${Math.round(game.researchXP || 0)} XP`;
  }
  updateResearchProgress(game);

  // Render Mini Energy Bars
  const maxKE = 100;
  const maxPE = 150;
  const maxTE = 200;

  const kePercent = Math.min(100, Math.max(10, (ke / maxKE) * 100));
  const pePercent = Math.min(100, Math.max(10, (pe / maxPE) * 100));
  const tePercent = Math.min(100, Math.max(10, (te / maxTE) * 100));

  const miniKeBar = document.getElementById("mini-ke-bar");
  const miniPeBar = document.getElementById("mini-pe-bar");
  const miniTeBar = document.getElementById("mini-te-bar");

  if (miniKeBar) {
    miniKeBar.style.height = `${kePercent}%`;
    const miniKeVal = document.getElementById("mini-ke-val");
    if (miniKeVal) miniKeVal.textContent = `${Math.round(ke)}J`;
  }
  if (miniPeBar) {
    miniPeBar.style.height = `${pePercent}%`;
    const miniPeVal = document.getElementById("mini-pe-val");
    if (miniPeVal) miniPeVal.textContent = `${Math.round(pe)}J`;
  }
  if (miniTeBar) {
    miniTeBar.style.height = `${tePercent}%`;
    const miniTeVal = document.getElementById("mini-te-val");
    if (miniTeVal) miniTeVal.textContent = `${Math.round(te)}J`;
  }

  updateCertificateState();
  updateLearningConceptProgress(game);
  updateBadgeShelf(game);

  // Periodically refresh current question based on active mission
  updateActiveQuestion(game);
}

// Reset stats when changing planet
function resetNotebookStats() {
  maxAltitudeObserved = 0;
  maxSpeedObserved = 0;
  currentFlightTime = 0;
  flightStartTimestamp = null;
}

function compactNotebookEvidenceValue(value, maxLen = 60) {
  const raw = Array.isArray(value) ? value.join("; ") : String(value || "");
  const compact = raw.replace(/\s+/g, " ").trim();
  return compact.length > maxLen ? compact.slice(0, maxLen - 1) + "..." : compact;
}

function getLastNotebookAttemptEvidence(game) {
  if (typeof AttemptLog === "undefined" || !AttemptLog.byPlanet || !game) return null;
  const rows = AttemptLog.byPlanet[game.currentPlanetIndex] || [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) continue;
    const hasCode = Array.isArray(row.code) ? row.code.length > 0 : !!row.code;
    if (row.result || hasCode || Number.isFinite(row.maxH) || Number.isFinite(row.maxV)) return row;
  }
  return null;
}

function buildReflectionEvidenceStarter(game, activeMission = null) {
  const missionId = activeMission && activeMission.id ? activeMission.id : null;
  const parts = [];
  const code = missionId && game && game.lastCoachCodeByMission
    ? game.lastCoachCodeByMission[missionId]
    : "";
  const codeSnippet = compactNotebookEvidenceValue(code);
  if (codeSnippet) parts.push(`code: ${codeSnippet}`);

  const prediction = missionId && game && typeof getCoachPredictionOption === "function"
    ? getCoachPredictionOption(game, missionId)
    : null;
  if (prediction && prediction.label) parts.push(`prediction: ${prediction.label}`);

  const attempt = getLastNotebookAttemptEvidence(game);
  if (attempt) {
    if (attempt.result) parts.push(`result: ${attempt.result}`);
    if (Number.isFinite(attempt.maxH)) parts.push(`height: ${Math.round(attempt.maxH)}px`);
    if (Number.isFinite(attempt.maxV)) parts.push(`speed: ${Math.round(attempt.maxV)}px/f`);
  }

  if (!parts.length && activeMission && activeMission.fullMission && activeMission.fullMission.starterCode) {
    const starterSnippet = compactNotebookEvidenceValue(activeMission.fullMission.starterCode);
    if (starterSnippet) parts.push(`try: ${starterSnippet}`);
  }

  return parts.length
    ? `Evidence starter - ${parts.join(" | ")}. Explain what changed and why.`
    : "Evidence starter - describe the code you tried, what changed, and why the physics behaved that way.";
}

function updateReflectionEvidenceStarter(game, activeMission = null) {
  const evidence = buildReflectionEvidenceStarter(game, activeMission);
  const starterEl = document.getElementById("notebook-reflection-starter");
  const textEl = document.getElementById("notebook-user-response");
  const qEl = document.getElementById("notebook-prompt-question");
  if (starterEl) starterEl.textContent = evidence;
  if (qEl) qEl.dataset.evidenceStarter = evidence;
  if (textEl && !textEl.value) textEl.placeholder = evidence;
  return evidence;
}

// Refresh the reflection prompt based on active mission
function updateActiveQuestion(game) {
  const qEl = document.getElementById("notebook-prompt-question");
  if (!qEl) return;

  const currentPlanet = game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) {
    qEl.textContent = "Take data observations of Rover's movements!";
    updateReflectionEvidenceStarter(game, null);
    return;
  }

  // Find first uncompleted mission or active mission
  const activeMission = currentPlanet.missions.find(m => !game.completedMissions.has(m.id)) || currentPlanet.missions[0];
  if (activeMission && activeMission.fullMission) {
    const questions = activeMission.fullMission.reflection;
    if (questions && questions.length > 0) {
      qEl.textContent = questions[0];
      qEl.dataset.missionId = activeMission.id;
      qEl.dataset.missionTitle = activeMission.fullMission.title;
      qEl.dataset.starterCode = activeMission.fullMission.starterCode;
      qEl.dataset.badgeId = activeMission.fullMission.badge ? activeMission.fullMission.badge.id : "";
      updateReflectionEvidenceStarter(game, activeMission);
    }
  } else {
    qEl.textContent = "Write code to explore gravity boundaries!";
    updateReflectionEvidenceStarter(game, activeMission);
  }
}

// Save reflection entry
function saveNotebookReflection() {
  const textEl = document.getElementById("notebook-user-response");
  const qEl = document.getElementById("notebook-prompt-question");
  if (!textEl || !qEl) return;

  const responseText = textEl.value.trim();
  if (!responseText) {
    alert("Please write something before saving!");
    return;
  }

  const missionId = qEl.dataset.missionId || "general-reflection";
  const missionTitle = qEl.dataset.missionTitle || "General Exploration";
  const mission = typeof PlatformerMissions !== 'undefined'
    ? PlatformerMissions.find(item => item.id === missionId)
    : null;
  const starterCode = (window.Game && window.Game.lastCoachCodeByMission && window.Game.lastCoachCodeByMission[missionId])
    || qEl.dataset.starterCode
    || "custom variables";
  const prediction = window.Game && typeof getCoachPredictionOption === 'function'
    ? getCoachPredictionOption(window.Game, missionId)
    : null;
  const evidence = qEl.dataset.evidenceStarter || ((document.getElementById("notebook-reflection-starter") || {}).textContent || "");
  const badge = mission && mission.badge && window.Game && window.Game.earnedBadges && window.Game.earnedBadges.has(mission.badge.id)
    ? mission.badge
    : null;

  notebookEntries[missionId] = {
    title: missionTitle,
    question: qEl.textContent,
    answer: responseText,
    code: starterCode,
    prediction: prediction ? prediction.label : "",
    evidence,
    badge: badge ? `${badge.icon} ${badge.label}` : "",
    timestamp: new Date().toLocaleTimeString()
  };

  textEl.value = "";
  renderNotebookHistory();
  if (typeof handleGuidedSaveHook === 'function') handleGuidedSaveHook();
  if (typeof triggerCloudSave === 'function') triggerCloudSave();
  if (typeof Game !== 'undefined' && Game.currentMissionSteps) {
    Game.currentMissionSteps.explain = true;
    if (typeof updatePedagogicalGuide === 'function') {
      updatePedagogicalGuide(Game);
    }
  }
  if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
    SFX.playSuccess();
  }
}

// Render history entries
function renderNotebookHistory() {
  const historyContainer = document.getElementById("notebook-history");
  if (!historyContainer) return;

  const keys = Object.keys(notebookEntries);
  if (keys.length === 0) {
    historyContainer.innerHTML = '<div class="no-missions" style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">No journal entries yet. Complete a mission objective to log data.</div>';
    return;
  }

  historyContainer.innerHTML = "";
  keys.forEach(key => {
    const entry = notebookEntries[key];
    const item = document.createElement("div");
    item.className = "notebook-entry";
    item.style.marginBottom = "10px";

    item.innerHTML = `
      <div class="notebook-entry-header">
        <span>Mission: ${entry.title || "Mission"}</span>
        <span style="font-size: 0.65rem; color: var(--text-muted);">${entry.timestamp || ""}</span>
      </div>
      <p style="color: var(--neon-cyan); font-size: 0.75rem; font-family: monospace; margin-bottom: 4px;">Code: ${(entry.code || "").replace(/\n/g, '; ')}</p>
      ${entry.prediction ? `<p style="color: var(--neon-orange); font-size: 0.72rem; margin-bottom: 4px;">Prediction: ${entry.prediction}</p>` : ""}
      ${entry.evidence ? `<p class="notebook-entry-evidence">Evidence: ${entry.evidence}</p>` : ""}
      ${entry.badge ? `<p style="color: var(--neon-green); font-size: 0.72rem; margin-bottom: 4px;">Badge: ${entry.badge}</p>` : ""}
      <p style="color: var(--text-muted); font-style: italic; font-size: 0.72rem; margin-bottom: 4px;">Q: ${entry.question || ""}</p>
      <p style="font-size: 0.78rem; color: var(--text-primary);">A: ${entry.answer || ""}</p>
    `;
    historyContainer.appendChild(item);
  });
}

// Print notebook certificate
function printNotebook() {
  if (!isScientistCertificateUnlocked()) {
    alert("Complete a Play mission or a spacecraft route to unlock the Scientist Certificate.");
    return;
  }

  const name = prompt("Enter student name for Space Academy Certificate:", "Space Cadet");
  if (!name) return;

  const nameEl = document.getElementById("cert-student-name");
  if (nameEl) nameEl.textContent = name;

  const dateEl = document.getElementById("cert-print-date");
  if (dateEl) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString(undefined, options);
  }

  printArtifact('certificate');
  
  // Show polite sponsorship reminder after print dialog completes
  setTimeout(() => {
    alert("🚀 Cadet Academy runs on community contributions!\n\nIf Star Hopper helped you learn physics today, please consider sponsoring our next open STEM mission at:\nhttps://www.buymeacoffee.com/hshakeri");
  }, 1000);
}

function isScientistCertificateUnlocked() {
  const codeComplete = !!(window.Game && window.Game.state === 'clear');
  const navComplete = !!(window.Nav && window.Nav.orbitalMissionsCompleted && window.Nav.orbitalMissionsCompleted.size > 0);
  return codeComplete || navComplete;
}

function updateCertificateState() {
  const btn = document.getElementById("certificate-btn");
  if (!btn) return;

  const unlocked = isScientistCertificateUnlocked();
  btn.disabled = !unlocked;
  btn.classList.toggle("certificate-locked", !unlocked);
  btn.textContent = unlocked ? "🖨️ Print Scientist Certificate" : "🔒 Scientist Certificate Locked";
}

function updateLearningConceptProgress(game = window.Game) {
  const list = document.getElementById("concept-progress-list");
  if (!list) return;

  const completedMissions = game && game.completedMissions ? game.completedMissions : new Set();
  const activeMission = typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null;
  const activeMissionId = activeMission ? activeMission.id : null;
  const navComplete = !!(window.Nav && window.Nav.orbitalMissionsCompleted && window.Nav.orbitalMissionsCompleted.size > 0);

  list.innerHTML = "";
  BEGINNER_CONCEPT_PROGRESS.forEach(concept => {
    const complete = concept.navigation ? navComplete : completedMissions.has(concept.missionId);
    const active = !complete && concept.missionId === activeMissionId;
    const item = document.createElement("div");
    item.className = `concept-progress-item ${complete ? "complete" : ""} ${active ? "active" : ""}`;
    item.innerHTML = `
      <span>${complete ? "✓" : (active ? "▶" : "○")}</span>
      <strong>${concept.label}</strong>
    `;
    list.appendChild(item);
  });
}

function updateBadgeShelf(game = window.Game) {
  const list = document.getElementById("badge-shelf-list");
  if (!list || typeof PlatformerMissions === 'undefined') return;

  const completedMissions = game && game.completedMissions ? game.completedMissions : new Set();
  const earnedBadges = game && game.earnedBadges ? game.earnedBadges : new Set();
  list.innerHTML = "";

  PlatformerMissions.filter(mission => mission.badge).forEach(mission => {
    const earned = earnedBadges.has(mission.badge.id) || completedMissions.has(mission.id);
    const item = document.createElement("div");
    item.className = `badge-shelf-item ${earned ? "earned" : ""}`;
    item.innerHTML = `
      <span class="badge-shelf-icon">${escapeHTML(mission.badge.icon)}</span>
      <div>
        <strong>${escapeHTML(mission.badge.label)}</strong>
        <p>${escapeHTML(earned ? mission.badge.description : "Locked")}</p>
      </div>
    `;
    list.appendChild(item);
  });

  const worldTiers = (typeof WORLD_MASTERY_TIERS !== 'undefined' && Array.isArray(WORLD_MASTERY_TIERS)) ? WORLD_MASTERY_TIERS : [];
  const planets = (typeof PLANETS !== 'undefined' && Array.isArray(PLANETS)) ? PLANETS : [];
  const meters = game && game.masteryMeters && typeof game.masteryMeters === 'object' ? game.masteryMeters : {};
  Object.keys(meters).sort((a, b) => Number(a) - Number(b)).forEach(key => {
    const index = Number(key);
    if (!Number.isFinite(index)) return;
    const progress = typeof game.getWorldMasteryProgress === 'function'
      ? game.getWorldMasteryProgress(index)
      : { xp: Number(meters[key] && meters[key].xp) || 0, earnedTiers: [] };
    const earnedTiers = progress.earnedTiers && progress.earnedTiers.length
      ? progress.earnedTiers
      : worldTiers.filter(tier => progress.xp >= tier.xp);
    earnedTiers.forEach(tier => {
      const item = document.createElement("div");
      item.className = "badge-shelf-item earned world-mastery-badge";
      const planetName = planets[index] ? planets[index].name : `World ${index + 1}`;
      item.innerHTML = `
        <span class="badge-shelf-icon">🏅</span>
        <div>
          <strong>${escapeHTML(`${planetName}: ${tier.label}`)}</strong>
          <p>${escapeHTML(`${progress.xp} XP world mastery`)}</p>
        </div>
      `;
      list.appendChild(item);
    });
  });
}

// Print specific student/parent/teacher sheets selectively
function printArtifact(type) {
  document.body.className = '';
  document.body.classList.add('print-' + type);
  setTimeout(() => {
    window.print();
  }, 100);
}

window.onafterprint = () => {
  document.body.className = '';
};

// Inflate a side pane, or collapse it if it's already the open one (slim-rail UX).
function toggleMainPane(mode) {
  const app = document.getElementById('app-container');
  const expanded = app && !app.classList.contains('right-collapsed');
  const btn = document.getElementById('mode-btn-' + mode);
  const isActive = btn && btn.classList.contains('active');
  if (expanded && isActive) {
    switchMainMode('terminal'); // collapse back to the game view
  } else {
    switchMainMode(mode);
  }
}

function switchMainMode(mode) {
  // The right column is a slim icon rail by default; only Log/Parent/Navigator inflate it.
  const app = document.getElementById('app-container');
  if (app) {
    if (mode === 'terminal') app.classList.add('right-collapsed');
    else app.classList.remove('right-collapsed');
  }

  // Hide dialogue bubble if switching away from terminal
  if (mode !== 'terminal' && typeof closeDialogue === 'function') {
    closeDialogue();
  }

  // Hide all contents
  document.querySelectorAll('.mode-content').forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });
  // Deactivate all tabs
  document.querySelectorAll('.mode-tab').forEach(el => {
    el.classList.remove('active');
  });

  // Activate selected content and tab
  const activeContent = document.getElementById(`main-content-${mode}`);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'flex';
  }
  const activeTabId = mode === 'navigator' ? 'mode-btn-terminal' : `mode-btn-${mode}`;
  const activeTab = document.getElementById(activeTabId);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  if (typeof updateCertificateState === 'function') {
    updateCertificateState();
  }
  if (mode === 'engineer' && typeof renderEngineerPanel === 'function' && window.Game) {
    renderEngineerPanel(window.Game);
  }
  if (typeof updateParentMissionSummary === 'function' && window.Game) {
    updateParentMissionSummary(window.Game);
  }
  if (typeof updateLearningConceptProgress === 'function' && window.Game) {
    updateLearningConceptProgress(window.Game);
  }
  if (typeof updateBadgeShelf === 'function' && window.Game) {
    updateBadgeShelf(window.Game);
  }
  if (typeof updateResearchProgress === 'function' && window.Game) {
    updateResearchProgress(window.Game);
  }

  // Handle special mode transitions
  if (mode === 'navigator') {
    // Hide all canvas overlays
    const startScr = document.getElementById("start-screen");
    const clearScr = document.getElementById("clear-screen");
    const goScr = document.getElementById("gameover-screen");
    if (startScr) startScr.classList.add("hidden");
    if (clearScr) clearScr.classList.add("hidden");
    if (goScr) goScr.classList.add("hidden");

    if (typeof initNavigatorMode === 'function') {
      initNavigatorMode();
    }
  } else {
    // Restore canvas overlays based on game state
    if (window.Game) {
      const startScr = document.getElementById("start-screen");
      const clearScr = document.getElementById("clear-screen");
      const goScr = document.getElementById("gameover-screen");
      
      if (startScr) startScr.classList.add("hidden");
      if (clearScr) clearScr.classList.add("hidden");
      if (goScr) goScr.classList.add("hidden");

      if (window.Game.state === 'start' && startScr) {
        startScr.classList.remove("hidden");
      } else if (window.Game.state === 'clear' && clearScr) {
        clearScr.classList.remove("hidden");
      } else if (window.Game.state === 'gameover' && goScr) {
        goScr.classList.remove("hidden");
      }
    }

    if (typeof stopNavigatorMode === 'function') {
      stopNavigatorMode();
    }
  }
}
