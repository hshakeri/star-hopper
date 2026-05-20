// ui.js - Orchestrates HUD telemetry, energy bars, Space Terminal logs, Code Deck clicks, and Robot chat

// Logging utility to print user input
function ui_log_input(cmd) {
  const history = document.getElementById("console-history");
  if (!history) return;

  const line = document.createElement("div");
  line.className = "console-line input-echo";
  line.textContent = `hopper> ${cmd}`;
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

// Telemetry visual updates (runs every frame)
function updateHUD(game) {
  const player = game.player;
  const planet = game.currentPlanet;

  // 1. Gravity Gauge
  const gravityElement = document.getElementById("hud-gravity");
  if (gravityElement) {
    const isCustomG = Compiler.env.gravity !== null;
    const currentG = isCustomG ? Compiler.env.gravity : planet.physics.gravity;
    
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
    speedElement.textContent = `X: ${vxVal} | Y: ${vyVal}`;
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

  if (kBar) kBar.style.height = `${kePercent}%`;
  if (pBar) pBar.style.height = `${pePercent}%`;
  if (tBar) tBar.style.height = `${tePercent}%`;

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

  const listContainer = document.getElementById("mission-list");
  if (!listContainer) return;

  const currentPlanet = game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) {
    listContainer.innerHTML = '<div class="no-missions">No active missions. Reach the goal portal!</div>';
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

// Binds UI controls, terminal input, and cards
function setupUIBindings(game) {
  const input = document.getElementById("console-input");
  const suggestBox = document.getElementById("autocomplete-box");
  
  // 1. Code editor input submission
  if (input) {
    input.addEventListener("keydown", (e) => {
      // Allow enter to submit
      if (e.key === "Enter") {
        const val = input.value;
        if (val) {
          ui_log_input(val);
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
          if (suggestBox) suggestBox.style.display = "none";
          
          // Re-validate missions immediately on run
          game.checkMissions();
        }
      }
    });

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
    muteBtn.addEventListener("click", () => {
      const isMuted = SFX.toggleMute();
      muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
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

// 6-Step Pedagogical Guide renderer
function updatePedagogicalGuide(game) {
  const panel = document.getElementById("pedagogical-mission-panel");
  const stepsContainer = document.getElementById("pedagogical-steps");
  if (!panel || !stepsContainer) return;

  const currentPlanet = game.currentPlanet;
  if (!currentPlanet || !currentPlanet.missions) {
    panel.style.display = "none";
    return;
  }

  // Find first uncompleted mission
  const activeMission = currentPlanet.missions.find(m => !game.completedMissions.has(m.id)) || currentPlanet.missions[0];
  if (!activeMission || !activeMission.fullMission) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  const titleEl = document.getElementById("pedagogical-mission-title");
  if (titleEl) titleEl.textContent = activeMission.fullMission.title;

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
  const steps = activeMission.fullMission.steps;
  
  // Determine current active step index
  let activeIndex = 0;
  const keys = ["observe", "predict", "code", "test", "explain", "challenge"];
  for (let i = 0; i < keys.length; i++) {
    if (!game.currentMissionSteps[keys[i]]) {
      activeIndex = i;
      break;
    }
  }
  if (game.completedMissions.has(activeMission.id)) {
    activeIndex = 5; // Challenge
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
}
