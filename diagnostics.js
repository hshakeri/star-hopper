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
//   { title, message, formula|null, choices: [{label, command}] }
// renderFailureLab(game) paints it into the #gameover-screen overlay.
// Exposed as globals (no modules), mirroring the rest of the codebase.

function diagnoseFailure(game) {
  const f = (game && game.lastFailure) || {};
  const tag = f.tag || "unknown";
  const cv = game && game.currentVariant;
  const constraint = cv && cv.constraint;
  const noAntigrav = !!(constraint && constraint.banAntigravity);
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
      choices.push({ label: "Lower mass (squared payoff!)", command: `hopper.mass = ${cap("mass", 1.0)}` });
      choices.push({ label: "Stronger engine", command: `hopper.engine = ${cap("engine", 8)}` });
      choices.push({ label: "Stronger jump", command: `hopper.jump_power = ${cap("jump", 22)}` });
      if (!noAntigrav) choices.push({ label: "Push back gravity", command: `antigravity = ${Math.min(cap("antigravity", 6), 5)}` });
    } else {
      choices.push({ label: "Bigger rockets", command: `hopper.rocket_power = ${cap("rocket", 80)}` });
      choices.push({ label: "Lower mass", command: `hopper.mass = ${cap("mass", 1.0)}` });
      choices.push({ label: "Stronger engine", command: `hopper.engine = ${cap("engine", 8)}` });
    }
    return {
      title: `${stat.label} ${stat.value.toFixed(1)} / ${stat.target} — below target`,
      message: `${stat.label} is what unlocks this world's gems, and it isn't there yet. `
        + `Change exactly ONE variable, predict which way ${stat.label} moves, then run and compare the telemetry. `
        + (noAntigrav ? `🚫 This remix bans antigravity — engineer it with mass, engine and jump only.` : `Any mix works — there's no single right answer.`),
      formula: stat.key === "agility" ? "Agility = (speed + jumpV) × 0.6 ÷ felt-gravity" : "Thrust = rocket × (2.5 ÷ mass) + speed",
      choices
    };
  }

  // 2) Glacies remix: the target is a specific friction value, not generic spikes.
  if (planet === 3 && constraint && constraint.id === "glacies-friction-target"
      && game && typeof game.getCurrentFriction === "function") {
    const minFriction = Number.isFinite(constraint.minFriction) ? constraint.minFriction : 7;
    if (game.getCurrentFriction() < minFriction) {
      return {
        title: `Friction ${game.getCurrentFriction().toFixed(1)} / ${minFriction} — target missing`,
        message: `This remix is measuring the friction variable directly. Spikes help in normal Glacies runs, but this target needs a number you can compare before and after.`,
        formula: "more friction → shorter slide distance",
        choices: [
          { label: `Set friction ${minFriction}`, command: `friction = ${minFriction}` },
          { label: "Over-test grip", command: `friction = ${minFriction + 1}` }
        ]
      };
    }
  }

  // 3) Glacies: died sliding on ice with weak grip — friction/conditionals lesson first.
  if (planet === 3 && (tag === "hazard" || tag === "fall")
      && game && typeof game.getCurrentFriction === "function"
      && game.getCurrentFriction() < 5 && !(game.player && game.player.spikes)) {
    return {
      title: "You slid — grip is too low for ice",
      message: `Friction is ${game.getCurrentFriction().toFixed(1)} and ice barely pushes back, so the rover keeps its momentum into the hazard. `
        + `Raise friction to brake, or write an event rule that reacts the instant you touch ice. Predict: which stops you sooner?`,
      formula: "slide distance ≈ v² ÷ (2 · friction)",
      choices: [
        { label: "More grip", command: "friction = 8" },
        { label: "React to ice (event rule)", command: "when player.touching('ice'): friction = 8" }
      ]
    };
  }

  // 4) Jump arc too short to clear what killed you (hazard hit / fell in a gap).
  if ((tag === "hazard" || tag === "fall") && jumpHeightPx < 120) {
    const choices = [
      { label: "Lower mass (squared payoff!)", command: `hopper.mass = ${cap("mass", 1.0)}` },
      { label: "Stronger jump", command: `hopper.jump_power = ${cap("jump", 22)}` }
    ];
    if (!noAntigrav) choices.push({ label: "Less felt gravity", command: `antigravity = ${Math.min(cap("antigravity", 6), 5)}` });
    return {
      title: "Jump arc too short",
      message: `Your jump tops out around ${Math.round(jumpHeightPx)}px (~${(jumpHeightPx / tile).toFixed(1)} tiles): vertical speed hits zero before you're over the obstacle. `
        + `Because h ≈ J²/(2·g·m²), mass is SQUARED — halving mass quadruples height, while jump force only squares once. Predict which lever lifts you most, then test it.`
        + (noAntigrav ? ` 🚫 Antigravity is banned this remix.` : ``),
      formula: `h ≈ J²/(2·g·m²)  →  ${J.toFixed(0)}²/(2·${g.toFixed(2)}·${m.toFixed(1)}²) ≈ ${Math.round(jumpHeightPx)}px`,
      choices
    };
  }

  // 5) Eaten by a critter — that's timing, not physics.
  if (tag === "enemy") {
    return {
      title: "Critter contact — timing, not physics",
      message: "Your build is fine; the route wasn't. Land on TOP of a critter to stomp it (falling, not rising), or change your approach so you pass it mid-hop. In Mob Survival, F fires.",
      formula: null,
      choices: []
    };
  }

  // 6) Physics looks strong enough — route/timing/event problem.
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
  const choicesEl = document.getElementById("failure-choices");

  titleEl.textContent = `⚗️ ${d.title}`;
  if (causeEl) causeEl.textContent = `💥 ${(game.lastFailure && game.lastFailure.cause) || "rover damage"}`;
  if (msgEl) msgEl.textContent = d.message;
  if (formulaEl) {
    formulaEl.textContent = d.formula || "";
    formulaEl.style.display = d.formula ? "block" : "none";
  }
  if (choicesEl) {
    choicesEl.innerHTML = "";
    d.choices.forEach((ch) => {
      const btn = document.createElement("button");
      btn.className = "failure-choice-btn";
      btn.type = "button";
      const lab = document.createElement("span");
      lab.className = "failure-choice-label";
      lab.textContent = ch.label;
      const code = document.createElement("code");
      code.className = "failure-choice-code";
      code.textContent = ch.command;
      btn.appendChild(lab);
      btn.appendChild(code);
      btn.addEventListener("click", () => stageDiagnosisFix(ch.command));
      choicesEl.appendChild(btn);
    });
    choicesEl.style.display = d.choices.length ? "flex" : "none";
  }
  return d;
}

// One-tap fix: respawn (tunings preserved → the retry remixes) with the suggested
// command staged in the shell. The cadet reads it, can edit it, and presses Enter.
function stageDiagnosisFix(command) {
  if (typeof window !== "undefined" && window.Game && typeof window.Game.resetLevel === "function") {
    window.Game.resetLevel();
  }
  const input = (typeof document !== "undefined") && document.getElementById("console-input");
  if (input) {
    input.value = command;
    if (typeof autoGrowConsoleInput === "function") autoGrowConsoleInput(input);
    input.focus();
    try { input.setSelectionRange(command.length, command.length); } catch (_) {}
  }
  if (typeof ui_log_output === "function") {
    ui_log_output(`🧪 Staged fix: ${command} — press Enter to run the experiment.`, "info");
  }
}

// Globals for browser + node test harness.
if (typeof window !== "undefined") {
  window.diagnoseFailure = diagnoseFailure;
  window.renderFailureLab = renderFailureLab;
  window.stageDiagnosisFix = stageDiagnosisFix;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { diagnoseFailure, renderFailureLab, stageDiagnosisFix };
}
