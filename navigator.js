// navigator.js - Orchestration layer coordinating Classic and Solar orbital simulators

window.navigatorModeActive = false;
window.navigatorMode = 'solar'; // Default to the new Solar Simulator

/**
 * Initializes the current navigation mode panel.
 */
function initNavigatorMode() {
  window.navigatorModeActive = true;
  
  // Keep dropdown UI updated
  const selector = document.getElementById("navigator-mode-select");
  if (selector) {
    selector.value = window.navigatorMode;
  }

  // Update zoom control visibility
  const zoomCtrl = document.getElementById("navigator-zoom-controls");
  if (zoomCtrl) {
    zoomCtrl.style.display = (window.navigatorMode === 'solar') ? 'flex' : 'none';
  }

  if (window.navigatorMode === 'classic') {
    if (typeof initNavigatorModeClassic === 'function') {
      initNavigatorModeClassic();
    }
  } else {
    loadNavigatorMissionSolar(window.Nav.activeMissionIndex);
  }
}

/**
 * Disables the navigation simulator loops.
 */
function stopNavigatorMode() {
  window.navigatorModeActive = false;
  const zoomCtrl = document.getElementById("navigator-zoom-controls");
  if (zoomCtrl) {
    zoomCtrl.style.display = 'none';
  }
}

/**
 * Event handler triggered when the user switches modes from the dropdown.
 */
function switchNavigatorMode(mode) {
  window.navigatorMode = mode;
  
  // Reset the input console to clean the screen
  const inputEl = document.getElementById("navigator-console-input");
  if (inputEl) inputEl.value = "";

  // Update zoom control visibility
  const zoomCtrl = document.getElementById("navigator-zoom-controls");
  if (zoomCtrl) {
    zoomCtrl.style.display = (mode === 'solar') ? 'flex' : 'none';
  }

  if (mode === 'classic') {
    if (typeof initNavigatorModeClassic === 'function') {
      initNavigatorModeClassic();
    }
  } else {
    loadNavigatorMissionSolar(0);
  }
}

/**
 * Loads a mission from either the Classic or Solar mission lists.
 */
function loadNavigatorMission(index) {
  if (window.navigatorMode === 'classic') {
    if (typeof loadNavigatorMissionClassic === 'function') {
      loadNavigatorMissionClassic(index);
    }
  } else {
    loadNavigatorMissionSolar(index);
  }
}

/**
 * Loads a solar interplanetary mission setup.
 */
function loadNavigatorMissionSolar(index) {
  window.Nav.activeMissionIndex = index;
  const mission = window.Nav.Missions[index];
  if (!mission) return;

  // Display objective instruction
  const objEl = document.getElementById("navigator-mission-objective");
  if (objEl) {
    objEl.innerHTML = `<strong>Objective:</strong> ${mission.objective}<br><span style="font-size:0.7rem; color:var(--text-muted);">Concept: ${mission.concept}</span>`;
  }

  // Set up the spacecraft starting configuration
  mission.setup();

  // Reset console and load command shortcut
  window.Nav.clearConsole();
  window.Nav.logConsole(`Systems Online: Interplanetary Flight Path Engine v2.0`, "info");
  window.Nav.logConsole(`Loaded Mission: ${mission.title}`, "success");
  window.Nav.logConsole(`Press Enter to fire autopilot deck sequence.`, "info");

  const inputEl = document.getElementById("navigator-console-input");
  if (inputEl) {
    inputEl.value = mission.starterCode;
  }
  updateNavigatorBridgeCard(mission);

  renderNavigatorMissionsSolar();
}

function updateNavigatorBridgeCard(mission) {
  const summary = document.getElementById("navigator-bridge-summary");
  const code = document.getElementById("navigator-bridge-code");
  if (!mission || !summary || !code) return;

  const destination = mission.destinationId && window.Nav.BODIES
    ? window.Nav.BODIES[mission.destinationId.toUpperCase()]
    : null;
  const destinationName = destination ? destination.name : "the next planet";
  const isRouteBridge = typeof mission.targetPlanetIndex === "number";

  summary.textContent = isRouteBridge
    ? `Rover is docked. Run this short launch plan to travel to ${destinationName}, then the next surface mission begins.`
    : `Advanced orbit challenge: edit the launch plan and test the spacecraft path.`;
  code.value = mission.starterCode || "";
}

function runNavigatorBridgePlan() {
  const code = document.getElementById("navigator-bridge-code");
  const input = document.getElementById("navigator-console-input");
  if (!code) return;

  const plan = code.value.trim();
  if (!plan) return;
  if (input) input.value = plan;
  runNavigatorCommands(plan);
}

/**
 * Renders the mission list items for the Solar Interplanetary simulator.
 */
function renderNavigatorMissionsSolar() {
  const container = document.getElementById("navigator-mission-list");
  if (!container) return;

  container.innerHTML = "";
  window.Nav.Missions.forEach((mission, idx) => {
    const isCompleted = window.Nav.orbitalMissionsCompleted.has(mission.id);
    const isActive = idx === window.Nav.activeMissionIndex;

    const item = document.createElement("div");
    item.className = `notebook-entry ${isActive ? 'active-nav-item' : ''}`;
    item.style.border = isActive ? "1px solid var(--neon-orange)" : "1px solid var(--panel-border)";
    item.style.background = isActive ? "rgba(249, 115, 22, 0.05)" : "rgba(255, 255, 255, 0.01)";
    item.style.cursor = "pointer";
    item.style.padding = "8px";
    item.style.marginBottom = "5px";
    item.style.borderRadius = "8px";

    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:bold; color:${isActive ? 'var(--neon-orange)' : 'var(--text-primary)'};">${mission.title}</span>
        <span style="font-size:0.75rem; color:${isCompleted ? 'var(--neon-green)' : 'var(--text-muted)'};">${isCompleted ? '★ Passed' : '○ Pending'}</span>
      </div>
      <p style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${mission.concept}</p>
    `;

    item.addEventListener("click", () => {
      loadNavigatorMissionSolar(idx);
    });

    container.appendChild(item);
  });
}

/**
 * Adds quick-button shortcut inputs into the console deck input.
 */
function addNavigatorConsole(code) {
  if (window.navigatorMode === 'classic') {
    if (typeof addNavigatorConsoleClassic === 'function') {
      addNavigatorConsoleClassic(code);
    }
  } else {
    const inputEl = document.getElementById("navigator-console-input");
    if (!inputEl) return;
    if (inputEl.value) {
      inputEl.value += "; " + code;
    } else {
      inputEl.value = code;
    }
  }
}

/**
 * Parses and queues commands when clicking Enter or running autopilot.
 */
function runNavigatorCommands(commandString) {
  if (window.navigatorMode === 'classic') {
    if (typeof runNavigatorCommandsClassic === 'function') {
      runNavigatorCommandsClassic(commandString);
    }
  } else {
    const activeMission = window.Nav.Missions[window.Nav.activeMissionIndex];
    if (activeMission) {
      activeMission.setup();
    }
    window.Nav.runCommands(commandString);
  }
}

/**
 * Runs updates for either Classic or Solar spaceflight solvers.
 */
function updateNavigator(game) {
  if (window.navigatorMode === 'classic') {
    if (typeof updateNavigatorClassic === 'function') {
      updateNavigatorClassic(game);
    }
  } else {
    if (!window.Nav.ship) return;

    // Only update physics and time if there are commands in the queue or an action is currently executing
    if (window.Nav.commandQueue.length > 0 || window.Nav.currentAction) {
      // Calculate timestep size dt
      const dt = 0.1 * window.Nav.timeWarpFactor;

      // Execute flight instruction queue
      window.Nav.processFlightQueue(dt, window.Nav.ship.timeElapsed);

      // Step physics Verlet math integration
      window.Nav.ship.timeElapsed = window.Nav.stepSolarShip(window.Nav.ship, dt, window.Nav.ship.timeElapsed);

      // Validate if current mission goals have been met
      const activeMission = window.Nav.Missions[window.Nav.activeMissionIndex];
      if (activeMission && !window.Nav.orbitalMissionsCompleted.has(activeMission.id)) {
        if (activeMission.validate(window.Nav.ship, window.Nav.ship.timeElapsed)) {
          window.Nav.orbitalMissionsCompleted.add(activeMission.id);
          window.Nav.logConsole(`MISSION ACCOMPLISHED: ${activeMission.title}!`, "success");
          renderNavigatorMissionsSolar();
          if (typeof updateCertificateState === 'function') {
            updateCertificateState();
          }
          if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
            SFX.playSuccess();
          }
          if (window.Game && typeof window.Game.completeNavigationToNextPlanet === 'function') {
            window.Game.completeNavigationToNextPlanet(activeMission);
          }
        }
      }

      // Safety checks: collision with central stars or planets
      for (const key in window.Nav.BODIES) {
        const body = window.Nav.BODIES[key];
        const state = window.Nav.bodyStateAt(body, window.Nav.ship.timeElapsed);
        const dist = window.Nav.Vector.distance(window.Nav.ship, state);

        if (dist < body.radius) {
          window.Nav.logConsole(`FATAL COLLISION: Spacecraft burned up/crashed on ${body.name}!`, "error");
          loadNavigatorMissionSolar(window.Nav.activeMissionIndex);
          break;
        }
      }
    }
  }
}

/**
 * Renders the space simulator view onto the game canvas.
 */
function drawNavigator(game) {
  if (window.navigatorMode === 'classic') {
    if (typeof drawNavigatorClassic === 'function') {
      drawNavigatorClassic(game);
    }
  } else {
    window.Nav.drawSolarSimulation(game);
  }
}

function getNavigatorCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

// Hook Keyboard console inputs and zoom wheel
document.addEventListener("DOMContentLoaded", () => {
  const navInput = document.getElementById("navigator-console-input");
  if (navInput) {
    navInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = navInput.value;
        runNavigatorCommands(val);
      }
    });
  }

  // Scroll wheel zoom for Solar Simulator canvas
  const canvas = document.getElementById("game-canvas");
  if (canvas) {
    let isDraggingNavigator = false;
    let lastDragPoint = null;

    canvas.addEventListener("wheel", (e) => {
      if (window.navigatorModeActive && window.navigatorMode === 'solar') {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        const anchor = getNavigatorCanvasPoint(canvas, e.clientX, e.clientY);
        window.Nav.setZoom(window.Nav.SU_TO_PX * zoomFactor, anchor, canvas);
      }
    }, { passive: false });

    canvas.addEventListener("pointerdown", (e) => {
      if (!window.navigatorModeActive || window.navigatorMode !== 'solar' || e.button !== 0) return;
      isDraggingNavigator = true;
      lastDragPoint = getNavigatorCanvasPoint(canvas, e.clientX, e.clientY);
      canvas.style.cursor = "grabbing";
      if (canvas.setPointerCapture) {
        canvas.setPointerCapture(e.pointerId);
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDraggingNavigator || !lastDragPoint) return;
      e.preventDefault();
      const point = getNavigatorCanvasPoint(canvas, e.clientX, e.clientY);
      window.Nav.viewOffsetX += point.x - lastDragPoint.x;
      window.Nav.viewOffsetY += point.y - lastDragPoint.y;
      lastDragPoint = point;
    });

    window.addEventListener("pointerup", (e) => {
      if (!isDraggingNavigator) return;
      isDraggingNavigator = false;
      lastDragPoint = null;
      canvas.style.cursor = "";
      if (canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Pointer capture may already be released by the browser.
        }
      }
    });
  }
});

/**
 * Zooms the Solar simulator canvas dynamically by scaling SU_TO_PX.
 */
function zoomNavigator(factor) {
  if (window.Nav) {
    const canvas = document.getElementById("game-canvas");
    const anchor = canvas ? { x: canvas.width / 2, y: canvas.height / 2 } : null;
    window.Nav.setZoom(window.Nav.SU_TO_PX * factor, anchor, canvas);
  }
}
