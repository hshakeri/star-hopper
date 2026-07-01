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

const AI_STATE_DECK_CARDS = [
  {
    id: "trade-flow",
    title: "Trade Flow",
    state: "samples -> trade -> tool",
    concept: "Resource system",
    body: "A villager turns collected evidence into a tool or upgrade.",
    next: "Make one fair sample trade with a planet villager.",
    reward: "Logs when a village trade proof is earned.",
    prefixes: ["village-trade:"]
  },
  {
    id: "shelter-loop",
    title: "Shelter Loop",
    state: "patrol -> cave -> trade",
    concept: "State machine",
    body: "A villager changes behavior when danger appears, then returns when the world is safe.",
    next: "Clear mob danger so a villager leaves the cave.",
    reward: "Logs when a village rescue proof is earned.",
    prefixes: ["village-rescue:"]
  },
  {
    id: "pet-pact",
    title: "Pet Pact",
    state: "wild -> scared -> pet",
    concept: "Hidden behavior",
    body: "Rave mode and calming lotion can turn a small mob into a helper.",
    next: "Use calming lotion on a scared blob or critter.",
    reward: "Logs when a pet pact proof is earned.",
    prefixes: ["pet:tame:"]
  },
  {
    id: "guard-mode",
    title: "Guard Mode",
    state: "follow -> protect",
    concept: "Behavior switch",
    body: "A trained pet switches from following the cadet to intercepting danger.",
    next: "Let a trained pet stop a hostile mob near the cadet or a villager.",
    reward: "Logs when a pet guard proof is earned.",
    prefixes: ["pet:guard:"]
  },
  {
    id: "guardian-pact",
    title: "Guardian Pact",
    state: "trust -> guardian",
    concept: "Long arc",
    body: "Trades, rescues, and pet guards combine into one village relationship story.",
    next: "Reach the Village Guardian trust tier and trigger the pact.",
    reward: "Completes the village AI storyline.",
    prefixes: ["village-pact:"]
  }
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
  updateFutureLabRoadmap(game);
  updateSciencePassport(game);
  updateVillageAlmanac(game);
  updateAIStateDeck(game);

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
  if (!context || (context.kind !== "signal-lab" && context.kind !== "repair-proof")) return [];
  const out = [];
  const repairProof = context.kind === "repair-proof";
  if (repairProof && context.proofSourceKey && typeof hasRepairReflectionCredit === "function" && hasRepairReflectionCredit(game, context.proofSourceKey)) {
    return out;
  }
  const source = compactNotebookEvidenceValue(context.source || (repairProof ? "Crash Lab" : "Signal Lab"), 36);
  const title = compactNotebookEvidenceValue(context.title || (repairProof ? "Crash repair proof" : "Replay proof"), 44);
  if (source || title) out.push(`${repairProof ? "crash lab" : "signal lab"}: ${source}${title ? ` - ${title}` : ""}`);
  if (context.concept) out.push(`focus: ${compactNotebookEvidenceValue(context.concept, 52)}`);
  if (context.command) out.push(`code: ${compactNotebookEvidenceValue(context.command)}`);
  if (context.prediction) out.push(`repair prediction: ${compactNotebookEvidenceValue(context.prediction, 40)}`);
  if (context.proofLabel) out.push(`proof: ${compactNotebookEvidenceValue(context.proofLabel, 40)}`);
  return out;
}

function getNotebookLessonPhaseReflection(game, activeMission = null) {
  const phase = game && game.lastLessonPhaseAdvance;
  if (!phase || !phase.sourceKey) return null;
  const missionId = activeMission && activeMission.id
    ? activeMission.id
    : (activeMission && activeMission.fullMission && activeMission.fullMission.id ? activeMission.fullMission.id : "");
  if (missionId && phase.missionId && phase.missionId !== missionId) return null;
  if (missionId && !phase.missionId && !String(phase.sourceKey).startsWith(`${missionId}:`)) return null;
  const title = compactNotebookEvidenceValue(phase.title || "Lesson phase", 44);
  const formula = compactNotebookEvidenceValue(phase.formula || "", 44);
  const payoff = compactNotebookEvidenceValue(phase.payoff || "", 48);
  const question = formula
    ? `What evidence showed that ${formula} worked during ${title}?${payoff ? ` Explain the result: ${payoff}.` : ""}`
    : `What evidence showed that ${title} worked?${payoff ? ` Explain the result: ${payoff}.` : ""}`;
  return {
    title,
    formula,
    payoff,
    command: compactNotebookEvidenceValue(phase.command || "", 60),
    nextTitle: compactNotebookEvidenceValue(phase.nextTitle || "", 44),
    question
  };
}

function getNotebookLessonPhaseEvidence(game, activeMission = null) {
  const phase = getNotebookLessonPhaseReflection(game, activeMission);
  if (!phase) return [];
  const out = [];
  if (phase.title) out.push(`phase: ${phase.title}`);
  if (phase.formula) out.push(`formula: ${phase.formula}`);
  if (phase.command) out.push(`phase code: ${phase.command}`);
  if (phase.payoff) out.push(`phase result: ${phase.payoff}`);
  if (phase.nextTitle) out.push(`next phase: ${phase.nextTitle}`);
  return out;
}

function buildReflectionEvidenceStarter(game, activeMission = null) {
  const missionId = activeMission && activeMission.id ? activeMission.id : null;
  const parts = getNotebookReflectionContextEvidence(game);
  parts.push(...getNotebookLessonPhaseEvidence(game, activeMission));
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

function getRepairReflectionEntryKey(proofSourceKey) {
  const key = String(proofSourceKey || "").trim();
  return key ? `repair-reflection:${key}` : "";
}

function getRepairReflectionRewardSourceKey(proofSourceKey) {
  const entryKey = getRepairReflectionEntryKey(proofSourceKey);
  return entryKey ? `reflection-proof:${entryKey}` : "";
}

function sourceMapHasRepairReflection(sourceMap, proofSourceKey = "") {
  if (!sourceMap || typeof sourceMap !== "object") return false;
  const exact = getRepairReflectionRewardSourceKey(proofSourceKey);
  if (exact) return !!sourceMap[exact];
  return Object.keys(sourceMap).some(source => source.indexOf("reflection-proof:repair-reflection:") === 0 && !!sourceMap[source]);
}

function hasRepairReflectionCredit(game, proofSourceKey = "") {
  const entryKey = getRepairReflectionEntryKey(proofSourceKey);
  if (entryKey && typeof notebookEntries !== "undefined") {
    const entry = notebookEntries[entryKey];
    if (entry && (entry.reflectionRewardXP || entry.reflectionRewardLabel)) return true;
  }
  if (sourceMapHasRepairReflection(game && game.discoveryPassCounts, proofSourceKey)) return true;
  const meters = game && game.masteryMeters && typeof game.masteryMeters === "object" ? game.masteryMeters : {};
  return Object.keys(meters).some(key => sourceMapHasRepairReflection(meters[key] && meters[key].sources, proofSourceKey));
}

function getNotebookReflectionSaveContext(game, missionId, missionTitle) {
  const context = game && game.reflectionContext;
  if (context && context.kind === "repair-proof" && context.proofSourceKey) {
    const key = getRepairReflectionEntryKey(context.proofSourceKey);
    return {
      entryKey: key,
      rewardId: key,
      sourceKey: getRepairReflectionRewardSourceKey(context.proofSourceKey),
      missionTitle: context.title || missionTitle || "Crash repair proof",
      rewardTitle: "Repair Reflection Proof",
      rewardFormula: "fix = failure + prediction + evidence",
      rewardCue: "Use this proof to explain why the repair changed the next run.",
      rewardXP: 5,
      rewardMasteryXP: 9
    };
  }
  if (context && context.kind === "signal-lab" && context.proofSourceKey) {
    const key = `signal-reflection:${context.proofSourceKey}`;
    const proofText = `${context.source || ""} ${context.proofLabel || ""}`;
    const sourceKeyProof = /future\s*lab\s*source|source\s*key/i.test(proofText);
    const darkMatterPrep = !sourceKeyProof && /dark\s*matter/i.test(proofText);
    const frontier = !sourceKeyProof && !darkMatterPrep && /frontier/i.test(proofText);
    const rewardXP = sourceKeyProof ? 8 : (darkMatterPrep ? 7 : (frontier ? 6 : 5));
    const rewardMasteryXP = sourceKeyProof ? 14 : (darkMatterPrep ? 12 : (frontier ? 10 : 9));
    const rewardTitle = sourceKeyProof ? "Source Key Reflection Proof" : "Signal Reflection Proof";
    const rewardFormula = sourceKeyProof ? "source key = hidden force + chance + evidence" : "claim = signal + evidence + why";
    const rewardCue = sourceKeyProof
      ? "Use this proof to explain how hidden-force and probability evidence tune the source key."
      : (darkMatterPrep
        ? "Use this proof to compare the hidden-force prototype against a real replay."
        : (frontier
          ? "Use this proof to chase the next Frontier rival with evidence, not luck."
          : "Use this proof to compare the next Daily or Frontier signal."));
    return {
      entryKey: key,
      rewardId: key,
      sourceKey: `reflection-proof:${key}`,
      missionTitle: context.title || missionTitle || "Signal Lab proof",
      rewardTitle,
      rewardFormula,
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

function getPassportWorlds() {
  if (typeof PLANETS === 'undefined' || !Array.isArray(PLANETS)) return [];
  return PLANETS
    .map((planet, index) => ({ planet, index }))
    .filter(({ planet }) => planet && Array.isArray(planet.missions) && planet.missions.length > 0);
}

function isPassportWorldStamped(game, index) {
  if (!game) return false;
  if (typeof isWorldCleared === 'function' && isWorldCleared(game, index)) return true;
  const clears = game.planetClears || {};
  return Number(clears[index] || clears[String(index)] || 0) > 0;
}

function getPassportMission(planet) {
  if (!planet || !Array.isArray(planet.missions) || !planet.missions.length) return null;
  const mission = planet.missions[0];
  return mission.fullMission || mission;
}

function getPassportConcept(mission, planet) {
  if (!mission && !planet) return "Future science lesson";
  return (mission && (mission.concept || mission.beginnerConcept || mission.codingConcept))
    || (planet && planet.tagline)
    || "Science and coding";
}

function getPassportCodeCue(mission) {
  if (!mission) return "Run one focused experiment";
  if (mission.scaffold && mission.scaffold.codeIdea) return mission.scaffold.codeIdea;
  if (mission.starterCode) return mission.starterCode.split("\n")[0];
  return "Run one focused experiment";
}

function getSciencePassportAction(game = window.Game) {
  const worlds = getPassportWorlds();
  if (!worlds.length) return null;
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const nextWorld = worlds.find(({ index }) => !isPassportWorldStamped(game, index));
  const target = nextWorld || worlds.find(({ index }) => index === currentIndex) || worlds[0];
  const complete = !nextWorld;
  return {
    label: complete ? "CHASE MASTERY" : "RUN NEXT STAMP",
    levelIndex: target.index,
    title: complete ? `Replay ${target.planet.name}` : `Run ${target.planet.name}`,
    complete
  };
}

function runSciencePassportAction(levelIndex = null, game = window.Game) {
  const action = Number.isFinite(Number(levelIndex))
    ? { levelIndex: Number(levelIndex) }
    : getSciencePassportAction(game);
  if (!action || !game || typeof game.startLevel !== 'function') return false;
  game.startLevel(action.levelIndex);
  if (typeof switchMainMode === 'function') switchMainMode('terminal');
  return true;
}

function getFutureLabRoadmapStages(game = window.Game) {
  const fullMap = typeof hasClearedFullStarMap === 'function' ? hasClearedFullStarMap : null;
  const frontierCredit = typeof hasFrontierStoryCredit === 'function' ? hasFrontierStoryCredit : null;
  const traceCredit = typeof hasAnomalyTraceStoryCredit === 'function' ? hasAnomalyTraceStoryCredit : null;
  const darkMatterEvidence = typeof hasDarkMatterPrepEvidenceCredit === 'function' ? hasDarkMatterPrepEvidenceCredit : null;
  const quantumBranch = typeof hasQuantumBranchProofCredit === 'function' ? hasQuantumBranchProofCredit : null;
  const quantumChance = typeof hasQuantumChanceProofCredit === 'function' ? hasQuantumChanceProofCredit : null;
  const complete = {
    starMap: fullMap ? !!fullMap(game) : false,
    echo: frontierCredit ? !!frontierCredit(game) : false,
    trace: traceCredit ? !!traceCredit(game) : false,
    darkMatter: darkMatterEvidence ? !!darkMatterEvidence(game) : false,
    branch: quantumBranch ? !!quantumBranch(game) : false,
    chance: quantumChance ? !!quantumChance(game) : false
  };
  const stages = [
    {
      id: "star-map",
      title: "Restore the star-map",
      concept: "Six worlds combine into one science model.",
      action: "Clear each passport world to unlock future lab signals.",
      reward: "Reward: Frontier Challenge",
      complete: complete.starMap,
      actionType: "passport",
      cta: "RUN NEXT STAMP"
    },
    {
      id: "dark-matter-echo",
      title: "Decode Dark Matter Echo",
      concept: "Infer hidden forces from motion.",
      action: "Clear one Frontier Challenge and bank stars/time evidence.",
      reward: "Reward: Dark Matter Echo",
      complete: complete.echo,
      actionType: "frontier",
      cta: "RUN FRONTIER"
    },
    {
      id: "hidden-force-trace",
      title: "Trace hidden force",
      concept: "Prototype an invisible field with event code.",
      action: "Stage the Mag-Net touch rule and test the anomaly.",
      reward: "Reward: Hidden Force Trace",
      complete: complete.trace,
      actionType: "anomaly",
      levelIndex: 4,
      command: "use_hopper()\nwhen player.touching('magnet'): hopper.pole = 'south'",
      cta: "TRACE FORCE"
    },
    {
      id: "dark-matter-evidence",
      title: "Bank curve evidence",
      concept: "Compare path curve, speed, and force changes.",
      action: "Run a tagged Frontier prep remix for Dark Matter Lab.",
      reward: "Reward: hidden-force evidence",
      complete: complete.darkMatter,
      actionType: "dark-matter-prep",
      cta: "RUN PREP"
    },
    {
      id: "quantum-branch",
      title: "Seed a branch condition",
      concept: "One condition chooses one code path.",
      action: "Set fuel low, then let an if rule choose the warning path.",
      reward: "Reward: Branch Lab card",
      complete: complete.branch,
      actionType: "quantum-branch",
      levelIndex: 0,
      command: "player.fuel = 40\nif player.fuel < 50: player.say('branch A')",
      cta: "TEST BRANCH"
    },
    {
      id: "quantum-chance",
      title: "Seed chance probability",
      concept: "Probability is a branch measured over trials.",
      action: "Run chance(50) to make repeated code produce measurable outcomes.",
      reward: "Reward: Probability Lab card",
      complete: complete.chance,
      actionType: "quantum-chance",
      levelIndex: 0,
      command: "if chance(50): player.say('path A')",
      cta: "TEST CHANCE"
    }
  ];
  let unlocked = true;
  let nextAssigned = false;
  return stages.map((stage, index) => {
    const status = stage.complete ? "done" : (unlocked && !nextAssigned ? "next" : "locked");
    if (status === "next") nextAssigned = true;
    unlocked = unlocked && !!stage.complete;
    return {
      ...stage,
      index: index + 1,
      status
    };
  });
}

function getFutureLabSourceRoadmapTarget(game = window.Game, allSeedsDone = false) {
  if (!allSeedsDone) return null;
  const sourceTested = typeof hasFutureLabSourceProofCredit === 'function' && hasFutureLabSourceProofCredit(game);
  const sourceReflected = typeof hasFutureLabSourceReflectionCredit === 'function' && hasFutureLabSourceReflectionCredit(game);
  if (sourceReflected) {
    return {
      id: "future-source-key",
      status: "done",
      actionType: "complete",
      title: "Source key record complete",
      concept: "Source rehearsal and explanation are banked.",
      cta: ""
    };
  }
  if (sourceTested) {
    return {
      id: "future-source-key",
      status: "next",
      actionType: "notebook",
      title: "Explain source key",
      concept: "Save a notebook proof linking hidden-force clues with branch and chance evidence.",
      cta: "OPEN LOG"
    };
  }
  return {
    id: "future-source-key",
    status: "next",
    actionType: "future-source",
    title: "Run source rehearsal",
    concept: "Combine hidden-force clues with branch and chance evidence.",
    cta: "RUN SOURCE"
  };
}

function runFutureLabRoadmapAction(stageId = null, game = window.Game) {
  const stages = getFutureLabRoadmapStages(game);
  const allDone = stages.length > 0 && stages.every(stage => stage.status === "done");
  const sourceTarget = getFutureLabSourceRoadmapTarget(game, allDone);
  const target = (stageId && stages.find(stage => stage.id === stageId)) ||
    (stageId === "future-source-key" ? sourceTarget : null) ||
    stages.find(stage => stage.status === "next") ||
    sourceTarget;
  if (!target || target.status === "locked" || target.status === "done") return false;
  if (target.actionType === "passport" && typeof runSciencePassportAction === 'function') {
    return runSciencePassportAction(null, game);
  }
  if ((target.actionType === "frontier" || target.actionType === "dark-matter-prep") && game && typeof game.startFrontierChallenge === 'function') {
    return game.startFrontierChallenge(target.actionType === "dark-matter-prep" ? { source: "dark-matter-prep" } : undefined) !== false;
  }
  if (target.actionType === "future-source" && game && typeof game.startFrontierChallenge === 'function') {
    return game.startFrontierChallenge({ source: "future-source" }) !== false;
  }
  if (target.actionType === "notebook") {
    if (typeof switchMainMode === 'function') switchMainMode('notebook');
    return true;
  }
  const stageCommand = String(target.command || "").trim();
  const stageSource = target.actionType === "anomaly"
    ? "start-anomaly-trace"
    : (target.actionType === "quantum-branch" ? "start-quantum-branch" : "start-quantum-chance");
  if (stageCommand && typeof stageScienceDeltaCommand === 'function') {
    stageScienceDeltaCommand(stageCommand, {
      title: target.title,
      kind: target.actionType,
      source: stageSource,
      color: target.actionType === "anomaly" ? "#818cf8" : "#22d3ee"
    });
  }
  if (game && typeof game.startLevel === 'function') {
    game.startLevel(Number.isFinite(Number(target.levelIndex)) ? Number(target.levelIndex) : 0);
    return true;
  }
  return !!stageCommand;
}

function updateFutureLabRoadmap(game = window.Game) {
  const panel = document.getElementById("future-lab-roadmap-panel");
  if (!panel) return;
  const stages = getFutureLabRoadmapStages(game);
  const done = stages.filter(stage => stage.status === "done").length;
  const complete = stages.length > 0 && done >= stages.length;
  const sourceAction = getFutureLabSourceRoadmapTarget(game, complete);
  const next = sourceAction || stages.find(stage => stage.status === "next") || stages[stages.length - 1] || null;
  const action = (sourceAction && sourceAction.cta) ? sourceAction : (next && next.status !== "done" ? next : null);
  panel.innerHTML = `
    <div class="future-lab-roadmap-head">
      <div>
        <span>FUTURE LAB SEEDS</span>
        <strong>${escapeHTML(`${done}/${stages.length} proofs banked`)}</strong>
      </div>
      <div class="future-lab-roadmap-next">
        <em>${escapeHTML(next ? `${next.title}: ${next.concept}` : "Future lab record complete")}</em>
        ${action ? `<button type="button" class="future-lab-roadmap-btn" data-stage="${escapeHTML(action.id)}" onclick="runFutureLabRoadmapAction('${escapeHTML(action.id)}')">${escapeHTML(action.cta || "RUN NEXT")}</button>` : ""}
      </div>
    </div>
    <div class="future-lab-roadmap-track">
      ${stages.map(stage => `
        <div class="future-lab-roadmap-stage ${escapeHTML(stage.status)}">
          <span class="future-lab-roadmap-index">${stage.status === "done" ? "OK" : String(stage.index).padStart(2, "0")}</span>
          <div>
            <span class="future-lab-roadmap-state">${escapeHTML(stage.status === "done" ? "PROOF BANKED" : (stage.status === "next" ? "NEXT SEED" : "LOCKED"))}</span>
            <strong>${escapeHTML(stage.title)}</strong>
            <p>${escapeHTML(stage.concept)}</p>
            <code>${escapeHTML(stage.action)}</code>
            <em>${escapeHTML(stage.reward)}</em>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function updateSciencePassport(game = window.Game) {
  const panel = document.getElementById("science-passport-panel");
  if (!panel) return;
  const worlds = getPassportWorlds();
  if (!worlds.length) {
    panel.innerHTML = `<div class="science-passport-empty">Passport stamps load after the mission map is ready.</div>`;
    return;
  }

  const stamped = worlds.filter(({ index }) => isPassportWorldStamped(game, index));
  const nextWorld = worlds.find(({ index }) => !isPassportWorldStamped(game, index));
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const nextMission = nextWorld ? getPassportMission(nextWorld.planet) : null;
  const nextConcept = nextWorld ? getPassportConcept(nextMission, nextWorld.planet) : "Mastery remixes";
  const summary = nextWorld
    ? `Next stamp: ${nextWorld.planet.name} - ${nextConcept}`
    : "Passport complete - chase mastery remixes, Daily Signals, and Frontier records.";
  const action = getSciencePassportAction(game);

  panel.innerHTML = `
    <div class="science-passport-head">
      <div>
        <span>CADET SCIENCE PASSPORT</span>
        <strong>${stamped.length}/${worlds.length} planet stamps</strong>
      </div>
      <div class="science-passport-next">
        <em>${escapeHTML(summary)}</em>
        ${action ? `<button type="button" class="science-passport-run-btn" data-level="${escapeHTML(String(action.levelIndex))}" onclick="runSciencePassportAction(${escapeHTML(String(action.levelIndex))})">${escapeHTML(action.label)}</button>` : ""}
      </div>
    </div>
    <div class="science-passport-grid">
      ${worlds.map(({ planet, index }) => {
        const mission = getPassportMission(planet);
        const stampedWorld = isPassportWorldStamped(game, index);
        const priorStamped = index === 0 || isPassportWorldStamped(game, index - 1);
        const active = !stampedWorld && index === currentIndex;
        const locked = !stampedWorld && !active && !priorStamped;
        const bestStars = game && game.bestLabStars ? Number(game.bestLabStars[index] || game.bestLabStars[String(index)] || 0) : 0;
        const mastery = game && typeof game.getWorldMasteryProgress === 'function'
          ? game.getWorldMasteryProgress(index)
          : null;
        const state = stampedWorld ? "STAMPED" : (active ? "NOW" : (locked ? "LOCKED" : "NEXT"));
        const concept = getPassportConcept(mission, planet);
        const codeCue = getPassportCodeCue(mission);
        const icon = mission && mission.badge && mission.badge.icon ? mission.badge.icon : String(index + 1).padStart(2, "0");
        const masteryText = mastery ? `${mastery.title} · ${mastery.xp} XP` : "World mastery pending";
        const starsText = stampedWorld ? `${Math.max(1, bestStars)}/3 Lab Stars` : "Clear for stamp";
        return `
        <div class="science-passport-stamp ${stampedWorld ? "stamped" : ""} ${active ? "active" : ""} ${locked ? "locked" : ""}">
          <span class="science-passport-icon">${escapeHTML(icon)}</span>
          <div>
            <span class="science-passport-state">${escapeHTML(state)}</span>
            <strong>${escapeHTML(planet.name)}</strong>
            <p>${escapeHTML(concept)}</p>
            <code>${escapeHTML(codeCue)}</code>
            <em>${escapeHTML(`${starsText} · ${masteryText}`)}</em>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

function getVillageAlmanacWorlds() {
  if (typeof PLANETS === 'undefined' || !Array.isArray(PLANETS)) return [];
  return PLANETS
    .map((planet, index) => ({ planet, index }))
    .filter(({ planet }) => planet && Array.isArray(planet.npcs) && planet.npcs.length > 0);
}

function getVillageAlmanacRequest(game, planet) {
  const npcs = planet && Array.isArray(planet.npcs) ? planet.npcs : [];
  let completeRequest = null;
  for (const npc of npcs) {
    const request = typeof getVillageTradeRequest === 'function' ? getVillageTradeRequest(game, npc) : null;
    if (!request) continue;
    if (!request.complete) return { ...request, npc };
    completeRequest = completeRequest || { ...request, npc };
  }
  if (completeRequest) return completeRequest;
  const mentor = npcs[0] || {};
  return {
    kicker: "VILLAGE WATCH",
    title: "Keep the village safe",
    body: `${mentor.name || "Villagers"} trade again after danger clears. Rescue cave shelters, tame pets, and watch state changes.`,
    reward: "Payoff: AI state machine evidence",
    complete: false,
    npc: mentor
  };
}

function getVillageAlmanacTrust(game, index) {
  if (game && typeof game.getVillageTrustProgress === 'function') return game.getVillageTrustProgress(index);
  return {
    title: "New Arrival",
    points: 0,
    pct: 0,
    nextPact: { title: "First Trade Pact", action: "make one fair sample trade", concept: "Resource flow" }
  };
}

function updateVillageAlmanac(game = window.Game) {
  const panel = document.getElementById("village-almanac-panel");
  if (!panel) return;
  const worlds = getVillageAlmanacWorlds();
  if (!worlds.length) {
    panel.innerHTML = `<div class="village-almanac-empty">Village records appear after mentors load.</div>`;
    return;
  }
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const trustedWorlds = worlds.filter(({ index }) => getVillageAlmanacTrust(game, index).points > 0);
  const currentWorld = worlds.find(({ index }) => index === currentIndex);
  const nextWorld = currentWorld || worlds.find(({ planet, index }) => {
    const trust = getVillageAlmanacTrust(game, index);
    const request = getVillageAlmanacRequest(game, planet);
    return trust.points === 0 || (request && !request.complete);
  }) || worlds[0];
  const nextRequest = getVillageAlmanacRequest(game, nextWorld.planet);

  panel.innerHTML = `
    <div class="village-almanac-head">
      <div>
        <span>VILLAGE STORYLINE</span>
        <strong>${trustedWorlds.length}/${worlds.length} villages helped</strong>
      </div>
      <em>${escapeHTML(`${nextWorld.planet.name}: ${nextRequest.title}`)}</em>
    </div>
    <div class="village-almanac-grid">
      ${worlds.map(({ planet, index }) => {
        const trust = getVillageAlmanacTrust(game, index);
        const request = getVillageAlmanacRequest(game, planet);
        const pact = trust.nextPact || trust.currentPact || null;
        const active = index === currentIndex;
        const trusted = trust.points > 0;
        const npcList = (planet.npcs || []).map(npc => `${npc.name || "Villager"} // ${npc.profession || "Mentor"}`).join(" · ");
        const pactText = pact ? `${pact.title}: ${pact.action} (${pact.concept})` : "Village mentor status online";
        const chain = typeof getVillageQuestChainPreview === 'function' ? getVillageQuestChainPreview(game, index) : null;
        const chainSteps = chain && Array.isArray(chain.steps)
          ? chain.steps.map(step => `<span class="${step.done ? "done" : ""}">${escapeHTML(`${step.done ? "OK" : "NEXT"} ${step.label}`)}<em>${escapeHTML(step.concept)}</em></span>`).join("")
          : "";
        const chainBlock = chain ? `
          <div class="village-almanac-chain ${chain.stateClass || "new"}">
            <div><span>QUEST ${escapeHTML(String(chain.doneCount))}/${escapeHTML(String(chain.total))}</span><strong>${escapeHTML(chain.title)}</strong></div>
            <code>${escapeHTML(chain.formula)}</code>
            <div class="village-almanac-chain-steps">${chainSteps}</div>
          </div>
        ` : "";
        return `
        <div class="village-almanac-card ${trusted ? "trusted" : ""} ${active ? "active" : ""}">
          <div class="village-almanac-card-head">
            <span>${escapeHTML(active ? "CURRENT VILLAGE" : (trusted ? "TRUST LOGGED" : "REQUEST BOARD"))}</span>
            <strong>${escapeHTML(planet.name)}</strong>
          </div>
          <p class="village-almanac-roles">${escapeHTML(npcList)}</p>
          <div class="village-almanac-meter" aria-label="${escapeHTML(`${trust.points} village trust`)}"><span style="width: ${Math.max(0, Math.min(100, Number(trust.pct) || 0))}%"></span></div>
          <strong class="village-almanac-trust">${escapeHTML(`${trust.title} · ${trust.points} trust`)}</strong>
          <div class="village-almanac-request ${request.ready ? "ready" : ""} ${request.complete ? "complete" : ""}">
            <span>${escapeHTML(request.kicker || "VILLAGE REQUEST")}</span>
            <strong>${escapeHTML(request.title || "Village request")}</strong>
            <p>${escapeHTML(request.body || "Help this village with a trade, rescue, or pet guard.")}</p>
            <em>${escapeHTML(request.reward || "Payoff: relationship progress")}</em>
          </div>
          ${chainBlock}
          <code>${escapeHTML(pactText)}</code>
        </div>`;
      }).join("")}
    </div>
  `;
}

function collectAIStateDeckSources(game) {
  const sources = {};
  const addSourceMap = (sourceMap) => {
    if (!sourceMap || typeof sourceMap !== 'object') return;
    Object.keys(sourceMap).forEach(key => {
      if (sourceMap[key]) sources[String(key)] = true;
    });
  };

  if (!game) return sources;
  addSourceMap(game.discoveryPassCounts);

  const villageTrust = game.villageTrust && typeof game.villageTrust === 'object' ? game.villageTrust : {};
  Object.keys(villageTrust).forEach(key => addSourceMap(villageTrust[key] && villageTrust[key].sources));

  const masteryMeters = game.masteryMeters && typeof game.masteryMeters === 'object' ? game.masteryMeters : {};
  Object.keys(masteryMeters).forEach(key => addSourceMap(masteryMeters[key] && masteryMeters[key].sources));

  return sources;
}

function aiStateDeckHasProof(sources, prefixes) {
  if (!sources || !prefixes || !prefixes.length) return false;
  const keys = Object.keys(sources);
  return keys.some(key => prefixes.some(prefix => key.indexOf(prefix) === 0));
}

function getAIStateDeckCards(game = window.Game) {
  const sources = collectAIStateDeckSources(game);
  return AI_STATE_DECK_CARDS.map(card => ({
    ...card,
    earned: aiStateDeckHasProof(sources, card.prefixes)
  }));
}

function getAIStateDeckProgress(game = window.Game) {
  const cards = getAIStateDeckCards(game);
  const earned = cards.filter(card => card.earned);
  const nextCard = cards.find(card => !card.earned) || null;
  return {
    cards,
    earnedCount: earned.length,
    total: cards.length,
    nextCard,
    complete: earned.length === cards.length,
    pct: cards.length ? Math.round((earned.length / cards.length) * 100) : 0
  };
}

function getAIStateDeckTradeTarget(game) {
  const worlds = typeof getVillageAlmanacWorlds === 'function' ? getVillageAlmanacWorlds() : [];
  if (!worlds.length) return { index: 0, planet: null, request: null };
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const current = worlds.find(({ index }) => index === currentIndex);
  const incomplete = ({ planet }) => {
    const request = typeof getVillageAlmanacRequest === 'function' ? getVillageAlmanacRequest(game, planet) : null;
    return !!(request && !request.complete);
  };
  const target = (current && incomplete(current))
    ? current
    : (worlds.find(incomplete) || current || worlds[0]);
  return {
    ...target,
    request: target ? getVillageAlmanacRequest(game, target.planet) : null
  };
}

function getAIStateDeckVillageTarget(game, options = {}) {
  const worlds = typeof getVillageAlmanacWorlds === 'function' ? getVillageAlmanacWorlds() : [];
  if (!worlds.length) return { index: 0, planet: null };
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;
  const current = worlds.find(({ index }) => index === currentIndex);
  if (options.avoidEarth) {
    return worlds.find(({ index }) => index !== 0) || current || worlds[0];
  }
  return current || worlds[0];
}

function hasAIStateDeckTamingLotion(game) {
  if (!game) return false;
  if (typeof game.hasTamingLotion === 'function') return !!game.hasTamingLotion();
  return !!(game.unlockedTools && game.unlockedTools.has && game.unlockedTools.has('taming_lotion'));
}

function getAIStateDeckAction(game = window.Game, cardId = null) {
  const progress = getAIStateDeckProgress(game);
  const card = (cardId && progress.cards.find(item => item.id === cardId)) || progress.nextCard;
  if (!card || card.earned) return null;
  const currentIndex = game && Number.isFinite(Number(game.currentPlanetIndex)) ? Number(game.currentPlanetIndex) : 0;

  if (card.id === "trade-flow") {
    const target = getAIStateDeckTradeTarget(game);
    const request = target.request || {};
    return {
      cardId: card.id,
      action: "level",
      label: request.ready ? "MAKE TRADE" : "RUN TRADE",
      title: request.title ? `Trade goal: ${request.title}` : "Run a village trade",
      body: request.body || card.next,
      levelIndex: Number.isFinite(Number(target.index)) ? Number(target.index) : currentIndex
    };
  }

  if (card.id === "shelter-loop") {
    const target = getAIStateDeckVillageTarget(game, { avoidEarth: true });
    return {
      cardId: card.id,
      action: "survival",
      label: "RUN RESCUE",
      title: "Start Survival near a village",
      body: "Let danger trigger cave shelter, then clear the mob so the villager returns.",
      levelIndex: Number.isFinite(Number(target.index)) ? Number(target.index) : currentIndex,
      enableSurvival: true
    };
  }

  if (card.id === "pet-pact") {
    const hasLotion = hasAIStateDeckTamingLotion(game);
    return {
      cardId: card.id,
      action: hasLotion ? "survival" : "level",
      label: hasLotion ? "TAME PET" : "GET LOTION",
      title: hasLotion ? "Use lotion on a scared mob" : "Trade for calming lotion",
      body: hasLotion
        ? "Start Survival, trigger rave mode, then tame a small scared mob."
        : "Run Glacies, collect Violet Ice, and trade with Cryo for calming lotion.",
      levelIndex: 3,
      enableSurvival: hasLotion
    };
  }

  if (card.id === "guard-mode") {
    const target = getAIStateDeckVillageTarget(game, { avoidEarth: true });
    return {
      cardId: card.id,
      action: "survival",
      label: "RUN GUARD",
      title: "Let a pet protect someone",
      body: "Bring a trained pet into danger and let it intercept a hostile mob.",
      levelIndex: Number.isFinite(Number(target.index)) ? Number(target.index) : currentIndex,
      enableSurvival: true
    };
  }

  if (card.id === "guardian-pact") {
    const target = getAIStateDeckVillageTarget(game);
    return {
      cardId: card.id,
      action: "level",
      label: "BUILD TRUST",
      title: "Finish the village trust arc",
      body: "Use the next trade, rescue, or pet guard proof to reach Village Guardian.",
      levelIndex: Number.isFinite(Number(target.index)) ? Number(target.index) : currentIndex
    };
  }

  return null;
}

function runAIStateDeckAction(cardId = null, game = window.Game) {
  const action = getAIStateDeckAction(game, cardId);
  if (!action || !game || typeof game.startLevel !== 'function') return false;
  const levelIndex = Number.isFinite(Number(action.levelIndex)) ? Number(action.levelIndex) : 0;
  game.activeAIStateRun = {
    cardId: action.cardId,
    levelIndex,
    label: action.label || "RUN STATE",
    title: action.title || "AI state proof",
    body: action.body || "",
    enableSurvival: !!action.enableSurvival,
    startedAt: Date.now()
  };
  game.startLevel(levelIndex);
  if (action.enableSurvival && typeof game.toggleSurvival === 'function' && !game.survivalMode) {
    game.toggleSurvival();
  }
  if (typeof switchMainMode === 'function') switchMainMode('terminal');
  return true;
}

function updateAIStateDeck(game = window.Game) {
  const panel = document.getElementById("ai-state-deck-panel");
  if (!panel) return;
  const progress = getAIStateDeckProgress(game);
  const next = progress.nextCard;
  const action = getAIStateDeckAction(game, next ? next.id : null);
  const headerCue = next
    ? `Next: ${next.title} - ${next.next}`
    : "All village AI behavior cards logged. Use the system in remixes and Daily Signals.";

  panel.innerHTML = `
    <div class="ai-state-deck-head">
      <div>
        <span>BEHAVIOR COLLECTION</span>
        <strong>${escapeHTML(String(progress.earnedCount))}/${escapeHTML(String(progress.total))} AI states logged</strong>
      </div>
      <div class="ai-state-deck-next">
        <em>${escapeHTML(headerCue)}</em>
        ${action ? `<button type="button" class="ai-state-deck-btn" data-state="${escapeHTML(action.cardId)}" onclick="runAIStateDeckAction('${escapeHTML(action.cardId)}')">${escapeHTML(action.label || "RUN NEXT")}</button>` : ""}
      </div>
    </div>
    <div class="ai-state-deck-meter" aria-label="${escapeHTML(String(progress.pct))}% of AI state deck collected"><span style="width: ${escapeHTML(String(progress.pct))}%"></span></div>
    <div class="ai-state-deck-grid">
      ${progress.cards.map(card => {
        const isNext = next && card.id === next.id;
        const stateLabel = card.earned ? "LOGGED" : (isNext ? "NEXT STATE" : "LOCKED");
        return `
          <div class="ai-state-card ${card.earned ? "earned" : ""} ${isNext ? "next" : ""}">
            <div class="ai-state-card-head">
              <span>${escapeHTML(stateLabel)}</span>
              <strong>${escapeHTML(card.title)}</strong>
            </div>
            <code>${escapeHTML(`state = ${card.state}`)}</code>
            <p>${escapeHTML(card.body)}</p>
            <em>${escapeHTML(card.earned ? card.reward : card.next)}</em>
            <b>${escapeHTML(card.concept)}</b>
          </div>
        `;
      }).join("")}
    </div>
  `;
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
  if (typeof updateSciencePassport === 'function' && window.Game) {
    updateSciencePassport(window.Game);
  }
  if (typeof updateVillageAlmanac === 'function' && window.Game) {
    updateVillageAlmanac(window.Game);
  }
  if (typeof updateAIStateDeck === 'function' && window.Game) {
    updateAIStateDeck(window.Game);
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
