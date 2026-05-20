// notebook.js - Manages the Science Notebook telemetry, journal, and certificate printing

// Memory storage for notebook entries
let notebookEntries = {};

// Keep track of peak flight metrics during play
let maxAltitudeObserved = 0;
let maxSpeedObserved = 0;
let flightStartTimestamp = null;
let currentFlightTime = 0;

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

  if (timeEl) timeEl.textContent = `${currentFlightTime.toFixed(1)}s`;
  if (heightEl) heightEl.textContent = `${Math.round(maxAltitudeObserved)}px`;
  if (speedEl) speedEl.textContent = `${maxSpeedObserved.toFixed(1)} px/f`;
  if (gravityEl) {
    const realWorldG = (currentG / 0.6) * 9.8;
    gravityEl.textContent = `${realWorldG.toFixed(1)} m/s²`;
  }

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

// Refresh the reflection prompt based on active mission
function updateActiveQuestion(game) {
  const qEl = document.getElementById("notebook-prompt-question");
  if (!qEl) return;

  const currentPlanet = game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) {
    qEl.textContent = "Take data observations of Star's movements!";
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
    }
  } else {
    qEl.textContent = "Write code to explore gravity boundaries!";
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
  const starterCode = qEl.dataset.starterCode || "custom variables";

  notebookEntries[missionId] = {
    title: missionTitle,
    question: qEl.textContent,
    answer: responseText,
    code: starterCode,
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
        <span>Mission: ${entry.title}</span>
        <span style="font-size: 0.65rem; color: var(--text-muted);">${entry.timestamp}</span>
      </div>
      <p style="color: var(--neon-cyan); font-size: 0.75rem; font-family: monospace; margin-bottom: 4px;">Code: ${entry.code.replace(/\n/g, '; ')}</p>
      <p style="color: var(--text-muted); font-style: italic; font-size: 0.72rem; margin-bottom: 4px;">Q: ${entry.question}</p>
      <p style="font-size: 0.78rem; color: var(--text-primary);">A: ${entry.answer}</p>
    `;
    historyContainer.appendChild(item);
  });
}

// Print notebook certificate
function printNotebook() {
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

function switchMainMode(mode) {
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
  const activeTab = document.getElementById(`mode-btn-${mode}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // Handle special mode transitions
  if (mode === 'navigator') {
    if (typeof initNavigatorMode === 'function') {
      initNavigatorMode();
    }
  } else {
    if (typeof stopNavigatorMode === 'function') {
      stopNavigatorMode();
    }
  }
}
