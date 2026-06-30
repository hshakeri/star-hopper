// attempt-log.js — the Science Notebook's per-attempt EXPERIMENT TABLE.
//
// Every attempt at a planet becomes a row: which code you ran, your hypothesis,
// what the telemetry measured (max height / max speed), and how the run ended.
// Restarts stop feeling like failure and start reading like lab work: predict →
// code → measure → compare.
//
// Hypotheses are never graded harshly — a wrong prediction is marked "💡 surprise!"
// (that's science working), a right one "✓ confirmed", and unmeasurable ones "~".
//
// Data lives in memory for the session (window.AttemptLog), keyed by planet index.
// Hooks (all guarded, called from game.js / ui.js / the crash lab):
//   attemptLogStart(game)        — loadPlanet: open a fresh row, reset per-attempt maxes
//   attemptLogCode(game, cmd)    — shell: a command ran successfully this attempt
//   attemptLogFinish(game, res)  — killPlayer/clearLevel: close the row + measure
//   predictNextAttempt(choice)   — crash-lab hypothesis buttons ('higher'|'lower'|'same')

var AttemptLog = { byPlanet: {}, pendingPrediction: null };

function attemptLogRows(planetIndex) {
  if (!AttemptLog.byPlanet[planetIndex]) AttemptLog.byPlanet[planetIndex] = [];
  return AttemptLog.byPlanet[planetIndex];
}

// Open a new attempt row. Also resets the notebook's per-attempt telemetry maxima
// (maxAltitudeObserved/maxSpeedObserved were never reset before — they accumulated
// across attempts and planets, so "Max Altitude" could show a Moon jump on Earth).
function attemptLogStart(game) {
  if (!game) return;
  const rows = attemptLogRows(game.currentPlanetIndex);
  // A reload mid-run abandons the open row quietly (it measured nothing final).
  const open = rows[rows.length - 1];
  if (open && !open.result) open.result = "retried";
  rows.push({
    attempt: (game.retryAttempt || 0) + 1, // 1-based for kids
    remix: (game.currentVariant && game.currentVariant.isRemix) ? game.currentVariant.variantLabel : null,
    code: [],
    prediction: AttemptLog.pendingPrediction, // staged from the crash lab, if any
    verdict: null,
    maxH: 0,
    maxV: 0,
    result: null
  });
  AttemptLog.pendingPrediction = null;
  if (typeof resetNotebookStats === "function") resetNotebookStats();
  renderAttemptLog(game);
}

// Record a successfully-run shell command on the open row (the experiment's change).
function attemptLogCode(game, cmd) {
  if (!game || !cmd) return;
  const rows = attemptLogRows(game.currentPlanetIndex);
  const open = rows[rows.length - 1];
  if (!open || open.result) return;
  if (open.code.length < 8) open.code.push(String(cmd).trim());
  renderAttemptLog(game);
}

// Close the open row: measure the notebook maxima, stamp the outcome, and judge the
// hypothesis GENTLY against the previous attempt's measured height.
function attemptLogFinish(game, result) {
  if (!game) return;
  const rows = attemptLogRows(game.currentPlanetIndex);
  const open = rows[rows.length - 1];
  if (!open || open.result) return;
  open.result = result || "ended";
  open.maxH = (typeof maxAltitudeObserved !== "undefined") ? Math.round(maxAltitudeObserved) : 0;
  open.maxV = (typeof maxSpeedObserved !== "undefined") ? +maxSpeedObserved.toFixed(1) : 0;
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  open.verdict = attemptPredictionVerdict(open.prediction, prev ? prev.maxH : null, open.maxH);
  renderAttemptLog(game);
}

// 'higher'/'lower'/'same' vs the measured height change (±8px = "about the same").
// Returns null (no hypothesis), '✓ confirmed', '💡 surprise!', or '~' (no baseline).
function attemptPredictionVerdict(prediction, prevH, curH) {
  if (!prediction) return null;
  if (prevH === null || prevH === undefined) return "~";
  const delta = curH - prevH;
  const observed = delta > 8 ? "higher" : delta < -8 ? "lower" : "same";
  return observed === prediction ? "✓ confirmed" : "💡 surprise!";
}

// One-tap hypothesis from the crash lab: applies to the NEXT attempt.
function predictNextAttempt(choice) {
  AttemptLog.pendingPrediction = choice;
  const row = (typeof document !== "undefined") && document.getElementById("failure-hypothesis");
  if (row) {
    row.querySelectorAll(".hypothesis-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.choice === choice);
    });
  }
  if (typeof ui_log_output === "function") {
    ui_log_output(`🔮 Hypothesis logged: next jump will be ${choice.toUpperCase()}. Run the experiment!`, "info");
  }
}

const ATTEMPT_RESULT_LABELS = {
  cleared: "✅ cleared",
  hazard: "💥 spikes",
  fall: "🕳 fell",
  enemy: "👾 critter",
  retried: "🔁 retried",
  unknown: "💥 crashed"
};
const ATTEMPT_PREDICTION_LABELS = { higher: "⬆ higher", lower: "⬇ lower", same: "➡ same" };

function getAttemptLogActiveMission(game) {
  if (!game) return null;
  if (typeof getActivePlatformerMission === "function") {
    const active = getActivePlatformerMission(game);
    if (active) return active;
  }
  const missions = game.currentPlanet && Array.isArray(game.currentPlanet.missions)
    ? game.currentPlanet.missions
    : [];
  const completed = game.completedMissions;
  const isDone = (mission) => !!(mission && completed && typeof completed.has === "function" && completed.has(mission.id));
  return missions.find(mission => mission && !isDone(mission)) || missions[0] || null;
}

function getAttemptLogSelectedPrediction(game, mission) {
  if (!game || !mission || !game.coachPredictions) return null;
  return game.coachPredictions[mission.id] || null;
}

function getAttemptLogCommand(fullMission, failed = null) {
  if (!fullMission) return "";
  if (typeof buildNextExperimentCommand === "function") {
    return buildNextExperimentCommand(fullMission, failed);
  }
  if (fullMission.scaffold && fullMission.scaffold.template && typeof buildScaffoldCode === "function") {
    return buildScaffoldCode(fullMission.scaffold);
  }
  return fullMission.starterCode || "";
}

function getAttemptLogNextQuestion(game) {
  const mission = getAttemptLogActiveMission(game);
  const fullMission = mission && mission.fullMission ? mission.fullMission : null;
  if (!mission || !fullMission) return null;

  if (fullMission.prediction && !getAttemptLogSelectedPrediction(game, mission)) {
    return {
      label: "PREDICT",
      title: "Predict before code",
      body: fullMission.prediction.question,
      command: getAttemptLogCommand(fullMission),
      kind: "prediction"
    };
  }

  if (typeof evaluateMissionResultChecks === "function") {
    const state = evaluateMissionResultChecks(game, fullMission);
    const failed = state && Array.isArray(state.items) ? state.items.find(item => item && !item.passed) : null;
    if (failed) {
      return {
        label: "NEXT TEST",
        title: failed.label || "Fix the next check",
        body: failed.message || "Tune one value, run it, and watch what changes.",
        command: getAttemptLogCommand(fullMission, failed),
        kind: "check"
      };
    }
  }

  if (Array.isArray(fullMission.reflection) && fullMission.reflection.length) {
    return {
      label: "EXPLAIN",
      title: "Explain the evidence",
      body: fullMission.reflection[0],
      command: "",
      kind: "reflection"
    };
  }

  return {
    label: "NEXT TEST",
    title: fullMission.title || "Run one experiment",
    body: fullMission.beginnerConcept || fullMission.concept || "Change one thing, test, then compare the result.",
    command: getAttemptLogCommand(fullMission),
    kind: "mission"
  };
}

function stageAttemptLogQuestionCommand(cue) {
  if (!cue || !cue.command) return false;
  if (typeof stageScienceDeltaCommand === "function") {
    return stageScienceDeltaCommand(cue.command, {
      title: cue.title || "Next lab question",
      kind: cue.kind || "attempt-question",
      source: "attempt-log",
      color: "#67e8f9"
    });
  }
  if (typeof document === "undefined") return false;
  const input = document.getElementById("console-input");
  if (!input) return false;
  input.value = cue.command;
  if (typeof input.focus === "function") input.focus();
  if (typeof input.setSelectionRange === "function") {
    try { input.setSelectionRange(cue.command.length, cue.command.length); } catch (e) { /* noop */ }
  }
  return true;
}

function renderAttemptLogQuestion(box, game) {
  const cue = getAttemptLogNextQuestion(game);
  if (!cue) return null;
  const card = document.createElement("div");
  card.className = `attempt-question-card attempt-question-${cue.kind || "mission"}`;

  const top = document.createElement("div");
  top.className = "attempt-question-top";
  const label = document.createElement("span");
  label.textContent = cue.label || "NEXT";
  const title = document.createElement("strong");
  title.textContent = cue.title || "Next lab question";
  top.appendChild(label);
  top.appendChild(title);
  card.appendChild(top);

  const body = document.createElement("p");
  body.textContent = cue.body || "Run one focused experiment, then compare the evidence.";
  card.appendChild(body);

  if (cue.command) {
    const action = document.createElement("div");
    action.className = "attempt-question-action";
    const code = document.createElement("code");
    code.textContent = cue.command;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "STAGE";
    btn.addEventListener("click", () => stageAttemptLogQuestionCommand(cue));
    action.appendChild(code);
    action.appendChild(btn);
    card.appendChild(action);
  }

  box.appendChild(card);
  return card;
}

// Paint the log (newest attempt first) into the Science Notebook pane. Each attempt
// is a compact card (the pane is ~330px wide — a rigid 5-column table can't breathe):
//   #2 🌀  ⬆ higher ✓ confirmed          💥 spikes
//   hopper.mass = 1
//   measured 138px · 13.2 px/f
function renderAttemptLog(game) {
  const box = (typeof document !== "undefined") && document.getElementById("attempt-log-rows");
  if (!box || !game) return;
  const rows = attemptLogRows(game.currentPlanetIndex);
  box.innerHTML = "";
  renderAttemptLogQuestion(box, game);
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "attempt-log-empty";
    empty.textContent = "No attempts yet — every run lands here as an experiment.";
    box.appendChild(empty);
    return;
  }
  const mk = (parent, tag, cls, text, title) => {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = text;
    if (title) el.title = title;
    parent.appendChild(el);
    return el;
  };
  rows.slice().reverse().forEach((r) => {
    const card = document.createElement("div");
    card.className = "attempt-row" + (r.result === "cleared" ? " attempt-row-cleared" : "");

    const top = document.createElement("div");
    top.className = "attempt-row-top";
    mk(top, "span", "attempt-cell-num", "#" + r.attempt + (r.remix ? " 🌀" : ""), r.remix || "first try layout");
    const pred = r.prediction
      ? `🔮 ${ATTEMPT_PREDICTION_LABELS[r.prediction] || r.prediction}${r.verdict ? " " + r.verdict : ""}`
      : "";
    if (pred) mk(top, "span", "attempt-cell-pred", pred, "your hypothesis");
    mk(top, "span", "attempt-cell-result", ATTEMPT_RESULT_LABELS[r.result] || (r.result ? r.result : "🚀 in progress"));
    card.appendChild(top);

    mk(card, "div", "attempt-cell-code", r.code.length ? r.code.join("  ·  ") : "(no code changes)");
    if (r.result) mk(card, "div", "attempt-cell-stats", "measured " + r.maxH + "px · " + r.maxV + " px/f", "max height · max speed");
    box.appendChild(card);
  });
}

// Globals for the browser + node test harness.
if (typeof window !== "undefined") {
  window.AttemptLog = AttemptLog;
  window.attemptLogStart = attemptLogStart;
  window.attemptLogCode = attemptLogCode;
  window.attemptLogFinish = attemptLogFinish;
  window.attemptPredictionVerdict = attemptPredictionVerdict;
  window.predictNextAttempt = predictNextAttempt;
  window.renderAttemptLog = renderAttemptLog;
  window.getAttemptLogNextQuestion = getAttemptLogNextQuestion;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { AttemptLog, attemptLogStart, attemptLogCode, attemptLogFinish, attemptPredictionVerdict, predictNextAttempt, getAttemptLogNextQuestion };
}
