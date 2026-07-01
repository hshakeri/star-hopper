// diagnostics.js — Attempt diagnostics: crash → lab report, not "game over".
//
// When the cadet dies, instead of a generic "adjust physics constants" screen we
// diagnose WHY this attempt failed from the live telemetry (mission stat vs target,
// jump-arc estimate, friction, death cause) and offer one-tap fixes. Each fix button
// respawns the level (tunings preserved → Retry Remix kicks in) with the suggested
// command STAGED in the shell — the cadet just presses Enter to run it. Failure
// becomes the next experiment.
//
// Physics used for the jump estimate (game units; gravity is per-frame):
//   v0 = J / m          (launch velocity = jump impulse over mass)
//   h  = v0² / (2g)     (max height when vertical velocity reaches zero)
// so h ≈ J² / (2·g·m²) — mass hurts TWICE (squared), the key Earth insight.
//
// diagnoseFailure(game) is PURE (no DOM): returns
//   { title, message, formula|null, choices: [{label, command, prediction?}] }
// renderFailureLab(game) paints it into the #gameover-screen overlay.
// Exposed as globals (no modules), mirroring the rest of the codebase.

function diagnosisPredictionForCommand(command) {
  const text = String(command || "");
  if (/hopper\.mass\s*=/.test(text)) return "higher";
  if (/hopper\.jump_power\s*=/.test(text)) return "higher";
  if (/antigravity\s*=/.test(text)) return "higher";
  if (/hopper\.rocket_power\s*=/.test(text)) return "higher";
  if (/spawn_spring/.test(text)) return "higher";
  if (/friction\s*=/.test(text) || /player\.touching\('ice'\)/.test(text)) return "same";
  if (/hopper\.engine\s*=/.test(text)) return "same";
  return null;
}

function enrichDiagnosisChoices(choices) {
  return (choices || []).map(choice => ({
    ...choice,
    prediction: choice.prediction || diagnosisPredictionForCommand(choice.command)
  }));
}

function diagnosisEscapeHTML(value) {
  if (typeof escapeHTML === "function") return escapeHTML(value);
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
}

function diagnosisFirstCommand(choices) {
  const first = (choices || []).find((choice) => choice && String(choice.command || "").trim());
  return first ? String(first.command).trim() : "";
}

function getFailureRetryLadder(diagnosis) {
  const choices = diagnosis && Array.isArray(diagnosis.choices) ? diagnosis.choices : [];
  const command = diagnosisFirstCommand(choices);
  const prediction = choices
    .map((choice) => choice && (choice.prediction || diagnosisPredictionForCommand(choice.command)))
    .find(Boolean);
  return [
    {
      label: "1 PREDICT",
      value: prediction ? `${prediction} result` : "route/timing",
      state: prediction || "route"
    },
    {
      label: "2 STAGE",
      value: command || "choose a route fix",
      state: command ? "code" : "route"
    },
    {
      label: "3 TEST",
      value: command ? "press Enter -> repair proof" : "retry -> compare",
      state: "test"
    }
  ];
}

function diagnoseFailure(game) {
  const f = (game && game.lastFailure) || {};
  const tag = f.tag || "unknown";
  const cv = game && game.currentVariant;
  const constraint = cv && cv.constraint;
  const noAntigrav = !!(constraint && constraint.banAntigravity);
  const noJumpPower = !!(constraint && constraint.banJumpPower);
  const noMassLower = !!(constraint && constraint.banMassLower);
  const engineOnly = !!(constraint && constraint.engineOnly);
  const planet = game ? game.currentPlanetIndex : 0;
  const cap = (k, fallback) =>
    (game && typeof game.getUpgradeCap === "function" && Number.isFinite(game.getUpgradeCap(k)))
      ? game.getUpgradeCap(k) : fallback;

  // Live telemetry at the moment of the report.
  const m = (game && typeof game.getActiveMass === "function") ? game.getActiveMass() : 1;
  const J = (game && typeof game.getJumpForce === "function") ? game.getJumpForce() : 10;
  const g = Math.max(0.05, (game && typeof game.getCurrentGravity === "function") ? game.getCurrentGravity() : 0.6);
  const v0 = J / Math.max(0.1, m);
  const jumpHeightPx = (v0 * v0) / (2 * g);
  const tile = (typeof TILE_SIZE !== "undefined") ? TILE_SIZE : 32;
  const stat = (game && typeof game.getMissionStat === "function") ? game.getMissionStat() : null;

  // 1) The engineering number is below target — that IS the blocker on stat worlds.
  if (stat && stat.value < stat.target) {
    const isHopper = game.player && game.player.charType === "hopper";
    const choices = [];
    if (!isHopper) choices.push({ label: "Suit up first", command: "use_hopper()" });
    if (stat.key === "agility") {
      const engineTarget = (engineOnly && Number.isFinite(constraint.engineMin)) ? constraint.engineMin : cap("engine", 8);
      if (!engineOnly && !noMassLower) choices.push({ label: "Lower mass (squared payoff!)", command: `hopper.mass = ${cap("mass", 1.0)}` });
      choices.push({ label: "Stronger engine", command: `hopper.engine = ${engineTarget}` });
      if (!engineOnly && !noJumpPower) choices.push({ label: "Stronger jump", command: `hopper.jump_power = ${cap("jump", 22)}` });
      if (!engineOnly && !noAntigrav) choices.push({ label: "Push back gravity", command: `antigravity = ${Math.min(cap("antigravity", 6), 5)}` });
    } else {
      choices.push({ label: "Bigger rockets", command: `hopper.rocket_power = ${cap("rocket", 80)}` });
      if (!noMassLower) choices.push({ label: "Lower mass", command: `hopper.mass = ${cap("mass", 1.0)}` });
      choices.push({ label: "Stronger engine", command: `hopper.engine = ${cap("engine", 8)}` });
    }
    return {
      title: `${stat.label} ${stat.value.toFixed(1)} / ${stat.target} — below target`,
      message: `${stat.label} is what unlocks this world's gems, and it isn't there yet. `
        + `Change exactly ONE variable, predict which way ${stat.label} moves, then run and compare the telemetry. `
        + (engineOnly ? `⚙️ This remix is engine-only — leave mass, jump_power, gravity, and antigravity stock.`
          : noAntigrav ? `🚫 This remix bans antigravity — engineer it with mass, engine and jump only.`
          : noJumpPower ? `🚫 This remix bans stronger jump_power — keep jump stock and engineer it with mass, engine and gravity.`
          : noMassLower ? `🚫 This remix bans lowering hopper.mass — keep Hopper heavy and engineer it with engine, jump and gravity.`
          : `Any mix works — there's no single right answer.`),
      formula: stat.key === "agility" ? "Agility = (speed + jumpV) × 0.6 ÷ felt-gravity" : "Thrust = rocket × (2.5 ÷ mass) + speed",
      choices: enrichDiagnosisChoices(choices)
    };
  }

  // 2) Moon remix: prove the springs came from a repeat loop, not one-off commands.
  if (planet === 1 && constraint && constraint.id === "moon-strict-spring") {
    const n = Number.isFinite(constraint.springCount) ? constraint.springCount : 5;
    const springCount = (game && Array.isArray(game.spawnedSprings)) ? game.spawnedSprings.length : 0;
    const repeated = !!(game && typeof game.hasRepeatSpawned === "function" && game.hasRepeatSpawned('spring', n));
    if (springCount < n || !repeated || !(game.player && game.player.jumpPower >= 18)) {
      return {
        title: `Spring loop ${Math.min(springCount, n)} / ${n} — repeat missing`,
        message: `This remix checks the coding idea, not just the pile of springs. Use one repeat loop so the pattern is generated by code, then tune jump_power to clear the canyon.`,
        formula: "repeat n = one command pattern × n",
        choices: enrichDiagnosisChoices([
          { label: `Repeat ${n} springs`, command: `repeat ${n}: spawn_spring()` },
          { label: "Tune jump", command: "hopper.jump_power = 18" }
        ])
      };
    }
  }

  // 3) Glacies remix: the target is a specific friction value, not generic spikes.
  if (planet === 3 && constraint && constraint.id === "glacies-friction-target"
      && game && typeof game.getCurrentFriction === "function") {
    const minFriction = Number.isFinite(constraint.minFriction) ? constraint.minFriction : 7;
    if (game.getCurrentFriction() < minFriction) {
      return {
        title: `Friction ${game.getCurrentFriction().toFixed(1)} / ${minFriction} — target missing`,
        message: `This remix is measuring the friction variable directly. Spikes help in normal Glacies runs, but this target needs a number you can compare before and after.`,
        formula: "more friction → shorter slide distance",
        choices: enrichDiagnosisChoices([
          { label: `Set friction ${minFriction}`, command: `friction = ${minFriction}` },
          { label: "Over-test grip", command: `friction = ${minFriction + 1}` }
        ])
      };
    }
  }

  // 4) Glacies: died sliding on ice with weak grip — friction/conditionals lesson first.
  if (planet === 3 && (tag === "hazard" || tag === "fall")
      && game && typeof game.getCurrentFriction === "function"
      && game.getCurrentFriction() < 5 && !(game.player && game.player.spikes)) {
    return {
      title: "You slid — grip is too low for ice",
      message: `Friction is ${game.getCurrentFriction().toFixed(1)} and ice barely pushes back, so the rover keeps its momentum into the hazard. `
        + `Raise friction to brake, or write an event rule that reacts the instant you touch ice. Predict: which stops you sooner?`,
      formula: "slide distance ≈ v² ÷ (2 · friction)",
      choices: enrichDiagnosisChoices([
        { label: "More grip", command: "friction = 8" },
        { label: "React to ice (event rule)", command: "when player.touching('ice'): friction = 8" }
      ])
    };
  }

  // 5) Jump arc too short to clear what killed you (hazard hit / fell in a gap).
  if ((tag === "hazard" || tag === "fall") && jumpHeightPx < 120) {
    const choices = [];
    if (!noMassLower) choices.push({ label: "Lower mass (squared payoff!)", command: `hopper.mass = ${cap("mass", 1.0)}` });
    if (!noJumpPower) choices.push({ label: "Stronger jump", command: `hopper.jump_power = ${cap("jump", 22)}` });
    if (!noAntigrav) choices.push({ label: "Less felt gravity", command: `antigravity = ${Math.min(cap("antigravity", 6), 5)}` });
    if (engineOnly) {
      choices.length = 0;
      choices.push({ label: "Engine only", command: `hopper.engine = ${Number.isFinite(constraint.engineMin) ? constraint.engineMin : cap("engine", 8)}` });
    }
    return {
      title: "Jump arc too short",
      message: `Your jump tops out around ${Math.round(jumpHeightPx)}px (~${(jumpHeightPx / tile).toFixed(1)} tiles): vertical speed hits zero before you're over the obstacle. `
        + `Because h ≈ J²/(2·g·m²), mass is SQUARED — halving mass quadruples height, while jump force only squares once. Predict which lever lifts you most, then test it.`
        + (noAntigrav ? ` 🚫 Antigravity is banned this remix.` : ``)
        + (noJumpPower ? ` 🚫 Stronger jump_power is banned this remix.` : ``)
        + (noMassLower ? ` 🚫 Lowering hopper.mass is banned this remix.` : ``)
        + (engineOnly ? ` ⚙️ Only the engine knob counts this remix.` : ``),
      formula: `h ≈ J²/(2·g·m²)  →  ${J.toFixed(0)}²/(2·${g.toFixed(2)}·${m.toFixed(1)}²) ≈ ${Math.round(jumpHeightPx)}px`,
      choices: enrichDiagnosisChoices(choices)
    };
  }

  // 6) Eaten by a critter — that's timing, not physics.
  if (tag === "enemy") {
    return {
      title: "Critter contact — timing, not physics",
      message: "Your build is fine; the route wasn't. Land on TOP of a critter to stomp it (falling, not rising), or change your approach so you pass it mid-hop. In Mob Survival, F fires.",
      formula: null,
      choices: []
    };
  }

  // 7) Physics looks strong enough — route/timing/event problem.
  return {
    title: "Control or timing issue",
    message: "The numbers look strong enough for this world. Try a different route or jump timing — or solve it with code: an event rule can react faster than thumbs.",
    formula: null,
    choices: []
  };
}

// Paint the diagnosis into the game-over overlay. Safe to call headless (no-ops).
function renderFailureLab(game) {
  const d = diagnoseFailure(game);
  const titleEl = (typeof document !== "undefined") && document.getElementById("failure-title");
  if (!titleEl) return d;
  const causeEl = document.getElementById("failure-cause");
  const msgEl = document.getElementById("failure-msg");
  const formulaEl = document.getElementById("failure-formula");
  const ladderEl = document.getElementById("failure-retry-ladder");
  const choicesEl = document.getElementById("failure-choices");
  const hypothesisEl = document.getElementById("failure-hypothesis");

  titleEl.textContent = `⚗️ ${d.title}`;
  if (causeEl) causeEl.textContent = `💥 ${(game.lastFailure && game.lastFailure.cause) || "rover damage"}`;
  if (msgEl) msgEl.textContent = d.message;
  if (formulaEl) {
    formulaEl.textContent = d.formula || "";
    formulaEl.style.display = d.formula ? "block" : "none";
  }
  if (ladderEl) {
    const ladder = getFailureRetryLadder(d);
    ladderEl.innerHTML = ladder.map((step) => `
      <span class="${diagnosisEscapeHTML(step.state || "")}">
        <b>${diagnosisEscapeHTML(step.label)}</b>
        <em>${diagnosisEscapeHTML(step.value)}</em>
      </span>
    `).join("");
    ladderEl.style.display = ladder.length ? "grid" : "none";
  }
  if (choicesEl) {
    choicesEl.innerHTML = "";
    d.choices.forEach((ch) => {
      const prediction = ch.prediction || diagnosisPredictionForCommand(ch.command);
      const btn = document.createElement("button");
      btn.className = "failure-choice-btn";
      btn.type = "button";
      if (prediction) btn.dataset.prediction = prediction;
      const lab = document.createElement("span");
      lab.className = "failure-choice-label";
      lab.textContent = ch.label;
      const code = document.createElement("code");
      code.className = "failure-choice-code";
      code.textContent = ch.command;
      btn.appendChild(lab);
      btn.appendChild(code);
      if (prediction) {
        const pred = document.createElement("span");
        pred.className = "failure-choice-prediction";
        pred.textContent = `predict: ${prediction}`;
        btn.appendChild(pred);
      }
      const reward = document.createElement("span");
      reward.className = "failure-choice-reward";
      reward.textContent = prediction ? "RETRY PROOF" : "ROUTE RETRY";
      btn.appendChild(reward);
      btn.addEventListener("click", () => stageDiagnosisFix(ch.command, prediction, ch.label));
      choicesEl.appendChild(btn);
    });
    choicesEl.style.display = d.choices.length ? "flex" : "none";
  }
  if (hypothesisEl) {
    const label = hypothesisEl.querySelector && hypothesisEl.querySelector(".hypothesis-label");
    if (label) label.textContent = d.choices.length
      ? "🔮 Hypothesis — next run's max height:"
      : "🔮 Hypothesis — next run:";
    const recommended = d.choices.map(ch => ch.prediction || diagnosisPredictionForCommand(ch.command)).find(Boolean);
    if (hypothesisEl.querySelectorAll) {
      hypothesisEl.querySelectorAll(".hypothesis-btn").forEach((btn) => {
        btn.classList.toggle("recommended", !!recommended && btn.dataset.choice === recommended);
        btn.title = btn.dataset.choice === recommended ? "Suggested by the staged fix" : "";
      });
    }
  }
  return d;
}

// One-tap fix: respawn (tunings preserved → the retry remixes) with the suggested
// command staged in the shell. The cadet reads it, can edit it, and presses Enter.
function stageDiagnosisFix(command, prediction = null, label = "Failure lab retry") {
  const code = String(command || "").trim();
  if (!code) return false;
  if (prediction && typeof predictNextAttempt === "function") {
    predictNextAttempt(prediction);
  }
  const liveGame = (typeof window !== "undefined" && window.Game) ? window.Game : null;
  if (liveGame && typeof liveGame.resetLevel === "function") {
    liveGame.resetLevel();
  }
  let staged = false;
  if (typeof stageScienceDeltaCommand === "function") {
    staged = stageScienceDeltaCommand(code, {
      title: label || "Failure lab retry",
      kind: "failure-diagnosis",
      source: "failure-lab",
      prediction: prediction || null,
      color: "#facc15"
    });
  }
  if (!staged) {
    const input = (typeof document !== "undefined") && document.getElementById("console-input");
    if (input) {
      input.value = code;
      if (typeof autoGrowConsoleInput === "function") autoGrowConsoleInput(input);
      input.focus();
      try { input.setSelectionRange(code.length, code.length); } catch (_) {}
      staged = true;
    }
    if (liveGame) {
      liveGame.lastStagedExperiment = {
        command: code,
        title: label || "Failure lab retry",
        kind: "failure-diagnosis",
        source: "failure-lab",
        time: Date.now()
      };
    }
  }
  if (liveGame) {
    liveGame.lastFailureFix = {
      command: code,
      prediction: prediction || null,
      title: label || "Failure lab retry",
      time: Date.now()
    };
    if (liveGame.lastStagedExperiment && liveGame.lastStagedExperiment.command === code) {
      liveGame.lastStagedExperiment.prediction = prediction || null;
    }
  }
  if (typeof ui_log_output === "function") {
    ui_log_output(`🧪 Staged fix: ${code} — press Enter to run the experiment.`, "info");
  }
  return staged;
}

// Globals for browser + node test harness.
if (typeof window !== "undefined") {
  window.diagnoseFailure = diagnoseFailure;
  window.renderFailureLab = renderFailureLab;
  window.stageDiagnosisFix = stageDiagnosisFix;
  window.getFailureRetryLadder = getFailureRetryLadder;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { diagnoseFailure, renderFailureLab, stageDiagnosisFix, diagnosisPredictionForCommand, getFailureRetryLadder };
}
