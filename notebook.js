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

function getNotebookLabChainEvidence(game, delta = null) {
  const pulse = game && game.discoveryPulse;
  if (!pulse) return "";
  if (delta && delta.code) {
    const pulseCode = String(pulse.code || "").trim();
    const deltaCode = String(delta.code || "").trim();
    if (!pulseCode || pulseCode !== deltaCode) return "";
  }
  const combo = Math.max(0, Math.floor(Number(pulse.combo) || 0));
  const earned = (pulse.rewardXP || 0) > 0 || !!pulse.cardUnlocked || !!pulse.hypothesisConfirmed || (pulse.openedGems || 0) > 0;
  if (!earned && combo > 0) return "paused repeat run";
  if (combo > 1) return `active x${combo}`;
  if (combo === 1) return "ready for one new change";
  return "";
}

function getNotebookScienceDeltaEvidence(game) {
  const delta = game && game.lastScienceDelta;
  if (!delta || !Array.isArray(delta.changes) || !delta.changes.length) return [];
  const first = delta.changes[0] || {};
  const out = [];
  if (first.label && first.value) {
    out.push(`changed: ${first.label} ${compactNotebookEvidenceValue(first.value, 56)}`);
  }
  if (first.cue) out.push(`why: ${compactNotebookEvidenceValue(first.cue, 52)}`);
  const chain = getNotebookLabChainEvidence(game, delta);
  if (chain) out.push(`lab chain: ${chain}`);
  return out;
}

function getNotebookReflectionContextEvidence(game) {
  const context = game && game.reflectionContext;
  if (!context || context.kind !== "signal-lab") return [];
  const out = [];
  const source = compactNotebookEvidenceValue(context.source || "Signal Lab", 36);
  const title = compactNotebookEvidenceValue(context.title || "Replay proof", 44);
  if (source || title) out.push(`signal lab: ${source}${title ? ` - ${title}` : ""}`);
  if (context.concept) out.push(`focus: ${compactNotebookEvidenceValue(context.concept, 52)}`);
  if (context.command) out.push(`code: ${compactNotebookEvidenceValue(context.command)}`);
  if (context.proofLabel) out.push(`proof: ${compactNotebookEvidenceValue(context.proofLabel, 40)}`);
  return out;
}

function buildReflectionEvidenceStarter(game, activeMission = null) {
  const missionId = activeMission && activeMission.id ? activeMission.id : null;
  const parts = getNotebookReflectionContextEvidence(game);
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

  parts.push(...getNotebookScienceDeltaEvidence(game));

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

function getNotebookReflectionNextExperiment(game, mission = null) {
  const lastCue = game && game.lastScienceDelta && game.lastScienceDelta.nextExperiment
    ? game.lastScienceDelta.nextExperiment
    : null;
  if (lastCue && (lastCue.title || lastCue.body || lastCue.command)) return { ...lastCue };

  if (typeof buildNextExperimentCue === 'function') {
    const cue = buildNextExperimentCue(game, null, mission);
    if (cue && (cue.title || cue.body || cue.command)) return { ...cue };
  }

  const fullMission = mission && mission.fullMission ? mission.fullMission : null;
  if (!fullMission) return null;
  const command = typeof buildNextExperimentCommand === 'function'
    ? buildNextExperimentCommand(fullMission)
    : (fullMission.starterCode || "");
  return {
    kind: "reflection",
    title: "Try one fresh test",
    body: (fullMission.scaffold && (fullMission.scaffold.codeIdea || fullMission.scaffold.physicsIdea))
      || fullMission.beginnerConcept
      || "Change one value, run it, and compare the evidence.",
    command
  };
}

function encodeNotebookStageArg(value) {
  return encodeURIComponent(String(value || ""));
}

function decodeNotebookStageArg(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (e) {
    return String(value || "");
  }
}

function buildNotebookStageCall(cue) {
  if (!cue || !cue.command) return "";
  const command = encodeNotebookStageArg(cue.command);
  const title = encodeNotebookStageArg(cue.title || "Next test");
  const kind = encodeNotebookStageArg(cue.kind || "reflection");
  return `stageScienceDeltaCommand(decodeNotebookStageArg('${command}'), { title: decodeNotebookStageArg('${title}'), kind: decodeNotebookStageArg('${kind}'), source: 'reflection-proof', color: '#bef264' })`;
}

function getNotebookReflectionSaveContext(game, missionId, missionTitle) {
  const context = game && game.reflectionContext;
  if (context && context.kind === "signal-lab" && context.proofSourceKey) {
    const key = `signal-reflection:${context.proofSourceKey}`;
    const proofText = `${context.source || ""} ${context.proofLabel || ""}`;
    const darkMatterPrep = /dark\s*matter/i.test(proofText);
    const frontier = !darkMatterPrep && /frontier/i.test(proofText);
    const rewardXP = darkMatterPrep ? 7 : (frontier ? 6 : 5);
    const rewardMasteryXP = darkMatterPrep ? 12 : (frontier ? 10 : 9);
    const rewardCue = darkMatterPrep
      ? "Use this proof to compare the hidden-force prototype against a real replay."
      : (frontier
        ? "Use this proof to chase the next Frontier rival with evidence, not luck."
        : "Use this proof to compare the next Daily or Frontier signal.");
    return {
      entryKey: key,
      rewardId: key,
      sourceKey: `reflection-proof:${key}`,
      missionTitle: context.title || missionTitle || "Signal Lab proof",
      rewardTitle: "Signal Reflection Proof",
      rewardFormula: "claim = signal + evidence + why",
      rewardCue,
      rewardXP,
      rewardMasteryXP
    };
  }
  return {
    entryKey: missionId,
    rewardId: missionId,
    sourceKey: `reflection-proof:${missionId}`,
    missionTitle,
    rewardTitle: "Reflection Proof",
    rewardFormula: "claim = evidence + why",
    rewardCue: "Use this proof to compare your next code change."
  };
}

function awardNotebookReflectionReward(game, missionId, missionTitle, alreadyRewarded = false, mission = null, options = {}) {
  if (!game || !missionId || alreadyRewarded) return null;
  const sourceKey = options.sourceKey || `reflection-proof:${missionId}`;
  const title = options.rewardTitle || "Reflection Proof";
  const xp = Math.max(1, Math.floor(Number(options.rewardXP) || 4));
  const masteryXP = Math.max(1, Math.floor(Number(options.rewardMasteryXP) || 8));
  let masteryAward = null;
  if (typeof game.awardWorldMasteryXP === 'function') {
    masteryAward = game.awardWorldMasteryXP(masteryXP, "evidence explanation", {
      sourceKey,
      silent: true
    });
    if (masteryAward && masteryAward.duplicate) return null;
  }

  const beforeRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  game.researchXP = Math.max(0, (game.researchXP || 0) + xp);
  const afterRank = (typeof getResearchRank === 'function') ? getResearchRank(game.researchXP || 0) : null;
  const rankUp = !!(beforeRank && afterRank && afterRank.level > beforeRank.level);
  const pulse = {
    kind: "reflection",
    title,
    formula: options.rewardFormula || "claim = evidence + why",
    insight: `${missionTitle || "Mission"} explanation saved. The win now has a claim, evidence, and a reason.`,
    cue: options.rewardCue || "Use this proof to compare your next code change.",
    missionId,
    missionTitle: missionTitle || "Science Notebook",
    passed: 1,
    total: 1,
    progressLabel: "explanation saved",
    openedGems: 0,
    rewardXP: xp,
    combo: game.discoveryCombo || 0,
    worldMasteryAddedXP: masteryAward ? (masteryAward.addedXP || 0) : 0,
    rankUp,
    rankTitle: afterRank ? afterRank.title : null,
    rankPerk: rankUp && afterRank ? afterRank.perk : null,
    nextExperiment: getNotebookReflectionNextExperiment(game, mission)
  };
  if (afterRank && typeof getResearchUnlockPreview === 'function') {
    pulse.nextLabUnlock = getResearchUnlockPreview(afterRank);
  }
  game.discoveryPulse = pulse;
  game.discoveryLog = [pulse].concat(Array.isArray(game.discoveryLog) ? game.discoveryLog : []).slice(0, 8);
  if (typeof game.spawnNotebookReflectionEffect === 'function') {
    pulse.reflectionEffect = game.spawnNotebookReflectionEffect(pulse);
  }
  if (typeof ui_log_output === 'function') {
    ui_log_output(`${title}: +${xp} Research XP for explaining evidence.`, "success");
  }
  if (typeof logMissionBriefing === 'function') {
    logMissionBriefing(`${pulse.title}: ${pulse.insight}`);
  }
  if (rankUp && typeof showBadgeToast === 'function') {
    showBadgeToast({
      icon: "🔬",
      label: `Research Rank: ${afterRank.title}`,
      description: `Lab Perk: ${afterRank.perk.label} (${Math.round(game.researchXP || 0)} XP)`
    });
  }
  if (rankUp && typeof game.spawnResearchRankEffect === 'function') {
    pulse.rankEffect = game.spawnResearchRankEffect(pulse);
  }
  if (typeof updateDiscoveryPulse === 'function') updateDiscoveryPulse(game);
  if (typeof updateResearchProgress === 'function') updateResearchProgress(game);
  return pulse;
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
  const game = (typeof window !== 'undefined' && window.Game) ? window.Game : (typeof Game !== 'undefined' ? Game : null);
  const saveContext = getNotebookReflectionSaveContext(game, missionId, missionTitle);
  const badge = mission && mission.badge && window.Game && window.Game.earnedBadges && window.Game.earnedBadges.has(mission.badge.id)
    ? mission.badge
    : null;
  const previousEntry = notebookEntries[saveContext.entryKey] || null;
  const alreadyRewarded = !!(previousEntry && previousEntry.reflectionRewardXP > 0);

  const entry = {
    title: saveContext.missionTitle || missionTitle,
    question: qEl.textContent,
    answer: responseText,
    code: starterCode,
    prediction: prediction ? prediction.label : "",
    evidence,
    badge: badge ? `${badge.icon} ${badge.label}` : "",
    timestamp: new Date().toLocaleTimeString(),
    updatedAtMs: Date.now()
  };
  const reward = awardNotebookReflectionReward(game, saveContext.rewardId, saveContext.missionTitle, alreadyRewarded, mission, saveContext);
  const nextExperiment = reward && reward.nextExperiment
    ? reward.nextExperiment
    : (previousEntry && previousEntry.nextExperiment ? previousEntry.nextExperiment : getNotebookReflectionNextExperiment(game, mission));
  if (reward) {
    entry.reflectionRewardXP = reward.rewardXP || 0;
    entry.reflectionRewardLabel = reward.title || "Reflection Proof";
  } else if (previousEntry && previousEntry.reflectionRewardXP) {
    entry.reflectionRewardXP = previousEntry.reflectionRewardXP;
    entry.reflectionRewardLabel = previousEntry.reflectionRewardLabel || "Reflection Proof";
  }
  if (nextExperiment) entry.nextExperiment = nextExperiment;
  notebookEntries[saveContext.entryKey] = entry;

  textEl.value = "";
  renderNotebookHistory();
  if (typeof handleGuidedSaveHook === 'function') handleGuidedSaveHook();
  if (typeof triggerCloudSave === 'function') triggerCloudSave();
  if (game && game.currentMissionSteps) {
    game.currentMissionSteps.explain = true;
    if (typeof updatePedagogicalGuide === 'function') {
      updatePedagogicalGuide(game);
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
  const safe = (typeof escapeHTML === 'function')
    ? escapeHTML
    : (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  keys.forEach(key => {
    const entry = notebookEntries[key];
    const item = document.createElement("div");
    item.className = "notebook-entry";
    item.style.marginBottom = "10px";
    const nextCue = entry.nextExperiment || null;
    const stageCall = buildNotebookStageCall(nextCue);
    const nextExperimentBlock = nextCue ? `
      <div class="notebook-entry-next">
        <span>NEXT TEST</span>
        <strong>${safe(nextCue.title || "Try one fresh test")}</strong>
        <p>${safe(nextCue.body || "Change one value, run it, and compare the evidence.")}</p>
        ${nextCue.command ? `<code>${safe(nextCue.command)}</code>` : ""}
        ${stageCall ? `<button type="button" class="notebook-entry-next-btn" onclick="${stageCall}">STAGE NEXT TEST</button>` : ""}
      </div>
    ` : "";

    item.innerHTML = `
      <div class="notebook-entry-header">
        <span>Mission: ${entry.title || "Mission"}</span>
        <span style="font-size: 0.65rem; color: var(--text-muted);">${entry.timestamp || ""}</span>
      </div>
      <p style="color: var(--neon-cyan); font-size: 0.75rem; font-family: monospace; margin-bottom: 4px;">Code: ${(entry.code || "").replace(/\n/g, '; ')}</p>
      ${entry.prediction ? `<p style="color: var(--neon-orange); font-size: 0.72rem; margin-bottom: 4px;">Prediction: ${entry.prediction}</p>` : ""}
      ${entry.evidence ? `<p class="notebook-entry-evidence">Evidence: ${entry.evidence}</p>` : ""}
      ${entry.reflectionRewardXP ? `<p class="notebook-entry-reward">${entry.reflectionRewardLabel || "Reflection Proof"}: +${entry.reflectionRewardXP} Research XP</p>` : ""}
      ${entry.badge ? `<p style="color: var(--neon-green); font-size: 0.72rem; margin-bottom: 4px;">Badge: ${entry.badge}</p>` : ""}
      ${nextExperimentBlock}
      <p style="color: var(--text-muted); font-style: italic; font-size: 0.72rem; margin-bottom: 4px;">Q: ${entry.question || ""}</p>
      <p style="font-size: 0.78rem; color: var(--text-primary);">A: ${entry.answer || ""}</p>
    `;
    historyContainer.appendChild(item);
  });
}

// Print notebook certificate
function printNotebook() {
  if (!isScientistCertificateUnlocked()) {
    alert("Complete either one Play mission or one spacecraft route to unlock the Scientist Certificate.");
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

function getScientistCertificateProgress(game = window.Game, nav = window.Nav) {
  const completedMissions = game && game.completedMissions instanceof Set ? game.completedMissions : new Set();
  const playMissionComplete = !!(game && game.state === 'clear') || completedMissions.size > 0;
  const navComplete = !!(nav && nav.orbitalMissionsCompleted && nav.orbitalMissionsCompleted.size > 0);
  const tasks = [
    {
      id: "play",
      label: "Clear one Play mission",
      detail: playMissionComplete ? "Physics proof logged" : "Use code to finish any planet objective",
      complete: playMissionComplete
    },
    {
      id: "nav",
      label: "Complete one Navigator route",
      detail: navComplete ? "Space route logged" : "Fly any spacecraft route",
      complete: navComplete
    }
  ];
  return {
    unlocked: playMissionComplete || navComplete,
    completed: tasks.filter(task => task.complete).length,
    required: 1,
    tasks,
    next: tasks.find(task => !task.complete) || null
  };
}

function renderCertificateProgress(game = window.Game, nav = window.Nav) {
  const card = document.getElementById("certificate-progress-card");
  if (!card) return;

  const progress = getScientistCertificateProgress(game, nav);
  const safe = (typeof escapeHTML === 'function')
    ? escapeHTML
    : (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  card.className = `certificate-progress-card ${progress.unlocked ? "unlocked" : "locked"}`;
  const itemHTML = progress.tasks.map(task => `
    <span class="${task.complete ? "complete" : ""}">
      <b>${task.complete ? "OK" : "NEXT"}</b>
      ${safe(task.label)}
      <em>${safe(task.detail)}</em>
    </span>
  `).join("");
  card.innerHTML = `
    <div class="certificate-progress-head">
      <span>${progress.unlocked ? "CERTIFICATE READY" : "CERTIFICATE PATH"}</span>
      <strong>${progress.unlocked ? "Scientist proof unlocked" : `${progress.required} proof needed`}</strong>
    </div>
    <p>${progress.unlocked ? "Print a certificate from the Log to celebrate the completed science proof." : "Complete either path to prove coding or navigation skill."}</p>
    <div class="certificate-progress-list">${itemHTML}</div>
  `;
}

function isScientistCertificateUnlocked() {
  return getScientistCertificateProgress().unlocked;
}

function updateCertificateState() {
  const progress = getScientistCertificateProgress();
  renderCertificateProgress(window.Game, window.Nav);

  const btn = document.getElementById("certificate-btn");
  if (!btn) return;

  const unlocked = progress.unlocked;
  btn.disabled = !unlocked;
  btn.classList.toggle("certificate-locked", !unlocked);
  btn.textContent = unlocked ? "🖨️ Print Scientist Certificate" : "🔒 Complete 1 Proof to Print";
  btn.title = unlocked ? "Print the Scientist Certificate" : (progress.next ? progress.next.detail : "Complete one proof path");
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
  const activeMission = typeof getActivePlatformerMission === 'function' ? getActivePlatformerMission(game) : null;
  const activeMissionId = activeMission && activeMission.id ? activeMission.id : null;
  list.innerHTML = "";

  PlatformerMissions.filter(mission => mission.badge).forEach(mission => {
    const earned = earnedBadges.has(mission.badge.id) || completedMissions.has(mission.id);
    const active = !earned && mission.id === activeMissionId;
    const stateLabel = earned ? "EARNED" : (active ? "NEXT BADGE" : "LOCKED GOAL");
    const body = earned ? mission.badge.description : getBadgeShelfLockedPreview(mission, active);
    const item = document.createElement("div");
    item.className = `badge-shelf-item ${earned ? "earned" : ""} ${active ? "active" : ""}`;
    item.innerHTML = `
      <span class="badge-shelf-icon">${escapeHTML(mission.badge.icon)}</span>
      <div>
        <span class="badge-shelf-state">${escapeHTML(stateLabel)}</span>
        <strong>${escapeHTML(mission.badge.label)}</strong>
        <p>${escapeHTML(body)}</p>
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

function getBadgeShelfLockedPreview(mission, active = false) {
  if (!mission) return active ? "Next mission concept" : "Future mission concept";
  const title = mission.title || "Mission";
  const concept = mission.beginnerConcept || mission.concept || mission.codingConcept || "";
  const codeCue = mission.scaffold && (mission.scaffold.codeIdea || mission.scaffold.physicsIdea || mission.scaffold.explain);
  const parts = [`${active ? "Next" : "Goal"}: ${title}`];
  if (concept) parts.push(concept);
  if (codeCue) parts.push(codeCue);
  return parts.join(" - ");
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
