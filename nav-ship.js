// nav-ship.js - Spacecraft status, command deck parsing, and flight action queue
// Manages the ship's telemetry, fuel limits, and interprets commands entered by the pilot.

window.Nav = window.Nav || {};

(function(Nav) {
  // Flight control state
  Nav.ship = null;
  Nav.commandQueue = [];
  Nav.currentAction = null;
  Nav.actionTimeRemaining = 0;
  Nav.timeWarpFactor = 1.0;
  Nav.lastCommandString = "";
  
  // Particles for exhaust flame
  Nav.exhaustParticles = [];

  /**
   * Initializes a spacecraft with specific orbital telemetry.
   */
  Nav.initShip = function(x, y, vx, vy, angle = 0, dryMass = 1.0, fuelMass = 1.5, burnRate = 0.15) {
    Nav.ship = {
      x: x,              // Position X (SU)
      y: y,              // Position Y (SU)
      vx: vx,            // Velocity X (SU/TU)
      vy: vy,            // Velocity Y (SU/TU)
      angle: angle,      // Orientation angle (radians)
      thrustActive: false,
      thrustPower: 0,
      dryMass: dryMass,  // Non-burnable weight (SMU)
      fuelMass: fuelMass,// Fuel supply weight (SMU)
      maxFuel: fuelMass, // Reference for fuel meter
      burnRate: burnRate,// Fuel consumed per TU of thruster firing
      timeElapsed: 0,    // Total mission duration (TU / days)
      trail: [],          // Positions trail array for rendering
      lastTrailTime: null,
      maxVelocityObserved: Math.sqrt(vx * vx + vy * vy),
      closestApproaches: { earth: Infinity, mars: Infinity, jupiter: Infinity },
      burnCount: 0,            // distinct thrust burns executed (mission gates on this)
      minApproach: Infinity    // closest the ship has come to the mission destination
    };
    
    Nav.commandQueue = [];
    Nav.currentAction = null;
    Nav.actionTimeRemaining = 0;
    Nav.timeWarpFactor = 1.0;
    Nav.cruising = false; // not yet arrived — set true on capture to coast the orbit
    Nav.lastCommandString = "";
    Nav.exhaustParticles = [];
  };

  /**
   * Helper parser that reads command strings and converts them to flight queue actions.
   * Does not modify actual ship state or log output.
   */
  Nav.parseCommands = function(commandString) {
    if (!commandString || !commandString.trim()) return [];

    const queue = [];
    const statements = commandString.split(";");

    statements.forEach(statement => {
      const cmd = statement.trim();
      if (!cmd) return;

      try {
        if (cmd.startsWith("point_at")) {
          const match = cmd.match(/point_at\(['"]?(\w+)['"]?\)/);
          const target = match ? match[1].toLowerCase() : 'sun';
          queue.push({ type: 'rotate', target });
        } else if (cmd.startsWith("thrust")) {
          let power = 2.0;
          let duration = 5.0;
          
          const namedPower = cmd.match(/power=([0-9.]+)/);
          const namedDuration = cmd.match(/seconds=([0-9.]+)/) || cmd.match(/duration=([0-9.]+)/);
          
          if (namedPower || namedDuration) {
            if (namedPower) power = parseFloat(namedPower[1]);
            if (namedDuration) duration = parseFloat(namedDuration[1]);
          } else {
            const params = cmd.match(/thrust\(([0-9.]+)(?:,\s*([0-9.]+))?\)/);
            if (params) {
              power = parseFloat(params[1]);
              if (params[2]) duration = parseFloat(params[2]);
            }
          }
          queue.push({ type: 'thrust', power, duration });
        } else if (cmd.startsWith("wait")) {
          const match = cmd.match(/wait\(([0-9.]+)\)/);
          const duration = match ? parseFloat(match[1]) : 10.0;
          queue.push({ type: 'wait', duration });
        } else if (cmd.startsWith("warp")) {
          const match = cmd.match(/warp\(([0-9.]+)\)/);
          const factor = match ? parseFloat(match[1]) : 5.0;
          queue.push({ type: 'warp', factor });
        }
      } catch (e) {
        // ignore parsing errors during typing
      }
    });

    return queue;
  };

  /**
   * Parses commands entered in the Pilot Console and builds the commandQueue.
   * Format supports commands split by Semicolon:
   * - point_at('body')
   * - thrust(power, days)
   * - wait(days)
   * - warp(factor)
   */
  Nav.runCommands = function(commandString) {
    if (!commandString.trim()) return;

    Nav.logConsole(`Executing flight instructions: ${commandString}`, "info");
    Nav.lastCommandString = commandString;

    const statements = commandString.split(";");
    Nav.commandQueue = [];

    statements.forEach(statement => {
      const cmd = statement.trim();
      if (!cmd) return;

      try {
        if (cmd.startsWith("point_at")) {
          const match = cmd.match(/point_at\(['"]?(\w+)['"]?\)/);
          const target = match ? match[1].toLowerCase() : 'sun';
          Nav.commandQueue.push({ type: 'rotate', target });
        } else if (cmd.startsWith("thrust")) {
          // Parses formats: thrust(power, duration) or thrust(power) or thrust(power=X, seconds=Y)
          let power = 2.0;
          let duration = 5.0;
          
          const namedPower = cmd.match(/power=([0-9.]+)/);
          const namedDuration = cmd.match(/seconds=([0-9.]+)/) || cmd.match(/duration=([0-9.]+)/);
          
          if (namedPower || namedDuration) {
            if (namedPower) power = parseFloat(namedPower[1]);
            if (namedDuration) duration = parseFloat(namedDuration[1]);
          } else {
            const params = cmd.match(/thrust\(([0-9.]+)(?:,\s*([0-9.]+))?\)/);
            if (params) {
              power = parseFloat(params[1]);
              if (params[2]) duration = parseFloat(params[2]);
            }
          }
          Nav.commandQueue.push({ type: 'thrust', power, duration });
        } else if (cmd.startsWith("wait")) {
          const match = cmd.match(/wait\(([0-9.]+)\)/);
          const duration = match ? parseFloat(match[1]) : 10.0; // Defaults to 10 days
          Nav.commandQueue.push({ type: 'wait', duration });
        } else if (cmd.startsWith("warp")) {
          const match = cmd.match(/warp\(([0-9.]+)\)/);
          const factor = match ? parseFloat(match[1]) : 5.0;
          Nav.commandQueue.push({ type: 'warp', factor });
        } else {
          Nav.logConsole(`Pilot OS syntax error: Unrecognized command '${cmd}'`, "error");
        }
      } catch (e) {
        Nav.logConsole(`Pilot OS compiler failed to parse: ${cmd}`, "error");
      }
    });

    Nav.currentAction = null;
    Nav.actionTimeRemaining = 0;
  };

  /**
   * Runs a flight plan written in KidCode (the SAME language as the platformer).
   * The point_at/thrust/wait/warp functions in the interpreter enqueue actions onto
   * Nav.commandQueue, which processFlightQueue then executes over simulation time — so
   * loops (`repeat`, `for`) and variables now plan multi-burn trajectories.
   *
   * Snapshots/restores Compiler.activeRules so a stray `when` rule typed into a flight
   * plan can't bleed into the platformer's per-frame rule loop.
   */
  Nav.runKidCodePlan = function(commandString) {
    if (!commandString || !commandString.trim()) return;

    Nav.logConsole(`Executing flight plan: ${commandString.replace(/\n/g, ' ⏎ ')}`, "info");
    Nav.lastCommandString = commandString;
    Nav.commandQueue = [];
    Nav.currentAction = null;
    Nav.actionTimeRemaining = 0;

    if (typeof Compiler === 'undefined') {
      Nav.logConsole("Pilot OS: code engine unavailable.", "error");
      return;
    }

    const savedRules = Array.isArray(Compiler.activeRules) ? Compiler.activeRules.slice() : [];
    const res = Compiler.runCommand(commandString, (typeof window !== 'undefined' && window.Game) ? window.Game : {});
    Compiler.activeRules = savedRules; // discard any when-rules registered during planning

    if (res && res.success === false) {
      Nav.logConsole(`Pilot OS: ${res.msg}`, "error");
    }
  };

  /**
   * Compiles a KidCode flight plan into a command queue WITHOUT touching the live
   * flight or the platformer's Compiler state. Used by the ghost-trajectory preview so
   * the dashed path reflects loop-based plans (repeat/for) typed in the Launch Plan box.
   * Cached on the plan text so it only recompiles when the text changes (the preview
   * runs every render frame). Returns fresh action copies the caller can consume.
   */
  Nav.planToQueue = function(text) {
    if (!text || !text.trim() || typeof Compiler === 'undefined' || !Nav.ship) return [];

    if (Nav._planCacheText === text && Nav._planCacheQueue) {
      return Nav._planCacheQueue.map(a => ({ ...a }));
    }

    // Snapshot everything the compile could disturb, run into a throwaway queue, restore.
    const liveQueue = Nav.commandQueue;
    const liveCurrent = Nav.currentAction;
    const liveRemaining = Nav.actionTimeRemaining;
    const savedRules = Array.isArray(Compiler.activeRules) ? Compiler.activeRules.slice() : null;
    const savedEnv = (Compiler.env && typeof Compiler.env === 'object') ? { ...Compiler.env } : null;

    Nav.commandQueue = [];
    try {
      Compiler.runCommand(text, (typeof window !== 'undefined' && window.Game) ? window.Game : {});
    } catch (e) { /* preview is best-effort; ignore parse errors mid-typing */ }
    const built = Nav.commandQueue;

    Nav.commandQueue = liveQueue;
    Nav.currentAction = liveCurrent;
    Nav.actionTimeRemaining = liveRemaining;
    if (savedRules) Compiler.activeRules = savedRules;
    if (savedEnv) Compiler.env = savedEnv;

    Nav._planCacheText = text;
    Nav._planCacheQueue = built;
    return built.map(a => ({ ...a }));
  };

  /**
   * Processes the command queue step-by-step.
   * @param {number} dt - Timestep in TU (days)
   * @param {number} t - Current time in TU (days)
   */
  Nav.processFlightQueue = function(dt, t) {
    if (!Nav.ship) return;

    // Load next action if queue is not empty and no active action
    if (!Nav.currentAction && Nav.commandQueue.length > 0) {
      Nav.currentAction = Nav.commandQueue.shift();
      
      if (Nav.currentAction.type === 'rotate') {
        const targetName = Nav.currentAction.target.toUpperCase();
        const targetBody = Nav.BODIES[targetName];
        if (targetBody) {
          const bState = Nav.bodyStateAt(targetBody, t);
          const targetAngle = Math.atan2(bState.y - Nav.ship.y, bState.x - Nav.ship.x);
          Nav.ship.angle = targetAngle;
          Nav.logConsole(`Thrusters aligned. Oriented pointing at ${targetBody.name}.`, "info");
          if (typeof SPEECH !== 'undefined') { Nav.ship.sayText = SPEECH.pick("navAim"); Nav.ship.sayTimer = 95; }
        } else {
          Nav.logConsole(`Steering error: body '${Nav.currentAction.target}' not found.`, "error");
        }
        Nav.currentAction = null; // Rotate is instantaneous in this simplified model
      } else if (Nav.currentAction.type === 'thrust') {
        if (Nav.ship.fuelMass <= 0) {
          Nav.logConsole(`Thrust failed: Fuel reserves empty!`, "error");
          Nav.currentAction = null;
        } else {
          Nav.ship.thrustActive = true;
          Nav.ship.thrustPower = (Nav.currentAction.power * 0.15) / 592.26; // Scaled for new physical year scale
          Nav.ship.burnCount = (Nav.ship.burnCount || 0) + 1; // a fresh burn started (loop missions gate on this)
          Nav.actionTimeRemaining = Nav.currentAction.duration;
          Nav.logConsole(`Thrust burn engaged: power=${Nav.currentAction.power}, duration=${Nav.currentAction.duration} days`, "info");
          if (typeof SPEECH !== 'undefined') { Nav.ship.sayText = SPEECH.pick("navThrust"); Nav.ship.sayTimer = 110; }
        }
      } else if (Nav.currentAction.type === 'wait') {
        Nav.actionTimeRemaining = Nav.currentAction.duration;
        Nav.logConsole(`Drifting: waiting for ${Nav.currentAction.duration} days`, "info");
        if (typeof SPEECH !== 'undefined') { Nav.ship.sayText = SPEECH.pick("navWait"); Nav.ship.sayTimer = 110; }
      } else if (Nav.currentAction.type === 'warp') {
        Nav.timeWarpFactor = Math.max(1.0, Math.min(20.0, Nav.currentAction.factor));
        Nav.logConsole(`Time warp factor updated to ${Nav.timeWarpFactor}x`, "info");
        if (typeof SPEECH !== 'undefined' && Nav.timeWarpFactor >= 4) { Nav.ship.sayText = SPEECH.pick("navLightspeed"); Nav.ship.sayTimer = 120; }
        Nav.currentAction = null;
      }
    }

    // Tick active action duration
    if (Nav.currentAction) {
      Nav.actionTimeRemaining -= dt;
      if (Nav.actionTimeRemaining <= 0) {
        if (Nav.currentAction.type === 'thrust') {
          Nav.ship.thrustActive = false;
          Nav.ship.thrustPower = 0;
          Nav.logConsole(`Thrust burn completed.`, "info");
        }
        Nav.currentAction = null;
      }
    }
  };

  /**
   * Helper logs for console element.
   */
  Nav.logConsole = function(msg, type = "info") {
    const history = document.getElementById("navigator-console-history");
    if (!history) return;

    const line = document.createElement("div");
    line.className = `console-line ${type}`;
    if (type === "success") {
      line.innerHTML = `<span style="color:var(--neon-green)">★ ${msg}</span>`;
    } else if (type === "error") {
      line.innerHTML = `<span style="color:var(--neon-pink)">⚠️ ${msg}</span>`;
    } else {
      line.innerHTML = `<span>> ${msg}</span>`;
    }
    history.appendChild(line);
    history.scrollTop = history.scrollHeight;
  };

  Nav.clearConsole = function() {
    const history = document.getElementById("navigator-console-history");
    if (history) {
      history.innerHTML = `<div class="console-line info">--- Pilot Command Deck OS v2.0 (Solar Core) ---</div>`;
    }
  };

})(window.Nav);
