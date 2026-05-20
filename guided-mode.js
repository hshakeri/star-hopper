// guided-mode.js - Guided learning tutorial for first-time Star Hopper cadets

let guidedModeActive = false;
let currentGuidedStep = 1;

// Initialize guided tutorial on Earth load
function checkStartGuidedMode(planetIndex) {
  if (planetIndex === 0 && localStorage.getItem('star_hopper_guided_completed') !== 'true') {
    guidedModeActive = true;
    currentGuidedStep = 1;
    const hud = document.getElementById('guided-mode-hud');
    if (hud) {
      hud.style.display = 'flex';
      hud.classList.remove('hidden');
    }
    updateGuidedUI();
  } else {
    // If not Earth, hide guided mode
    guidedModeActive = false;
    const hud = document.getElementById('guided-mode-hud');
    if (hud) hud.style.display = 'none';
  }
}

// Update instruction texts and glowing visual outlines
function updateGuidedUI() {
  const labelEl = document.getElementById('guided-step-label');
  const descEl = document.getElementById('guided-step-desc');
  const nextBtn = document.getElementById('guided-next-btn');
  
  if (!labelEl || !descEl || !nextBtn) return;

  // Update dots status indicators
  const dotsContainer = document.getElementById('guided-dots');
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
      if (idx < currentGuidedStep) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  clearHighlights();

  switch(currentGuidedStep) {
    case 1:
      labelEl.textContent = "Step 1 of 5: Observe (Jump)";
      descEl.textContent = "Press UP Arrow or W key to jump and observe Earth's heavy gravity field.";
      nextBtn.style.display = 'none';
      highlightElement('game-canvas');
      break;
    case 2:
      labelEl.textContent = "Step 2 of 5: Predict (Journal)";
      descEl.textContent = "Click the 'Notebook' tab at the top right, write your hypothesis in the journal, and click Save Entry.";
      nextBtn.style.display = 'none';
      highlightElement('mode-btn-notebook');
      break;
    case 3:
      labelEl.textContent = "Step 3 of 5: Code (Program)";
      descEl.textContent = "Click the 'Code' tab, type 'gravity = 0.2' in the console terminal, and press Enter to compile.";
      nextBtn.style.display = 'none';
      highlightElement('mode-btn-terminal');
      break;
    case 4:
      labelEl.textContent = "Step 4 of 5: Experiment (Leap)";
      descEl.textContent = "Try jumping again! With lower gravity, Star can soar over the wall. Reach the green portal on the right.";
      nextBtn.style.display = 'none';
      highlightElement('game-canvas');
      break;
    case 5:
      labelEl.textContent = "Step 5 of 5: Explain (Graduation)";
      descEl.textContent = "Awesome! Switch to 'Notebook' tab and print your Space Science Cadet Certificate!";
      nextBtn.style.display = 'block';
      nextBtn.textContent = "Complete Tutorial ✔";
      highlightElement('mode-btn-notebook');
      break;
  }
}

// Highlight targets with outline style
function highlightElement(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.outline = "2px solid var(--neon-cyan)";
    el.style.boxShadow = "0 0 15px rgba(6, 182, 212, 0.4)";
    el.style.borderRadius = "4px";
  }
}

// Clear active tutorial highlights
function clearHighlights() {
  ['game-canvas', 'mode-btn-notebook', 'mode-btn-terminal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.outline = "";
      el.style.boxShadow = "";
    }
  });
}

// Skip tutorial
function skipGuidedMode() {
  completeGuidedMode();
}

// Next button graduation trigger
function nextGuidedStep() {
  if (currentGuidedStep === 5) {
    completeGuidedMode();
  }
}

// Mark tutorial as completed
function completeGuidedMode() {
  guidedModeActive = false;
  clearHighlights();
  const hud = document.getElementById('guided-mode-hud');
  if (hud) hud.style.display = 'none';
  localStorage.setItem('star_hopper_guided_completed', 'true');
  if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
    SFX.playSuccess();
  }
}

// Trigger hooks called from code events
function handleGuidedJumpHook() {
  if (guidedModeActive && currentGuidedStep === 1) {
    currentGuidedStep = 2;
    updateGuidedUI();
    if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
      SFX.playSuccess();
    }
  }
}

function handleGuidedSaveHook() {
  if (guidedModeActive && currentGuidedStep === 2) {
    currentGuidedStep = 3;
    updateGuidedUI();
    // Automatically switch them back to terminal tab for convenience!
    if (typeof switchMainMode === 'function') {
      switchMainMode('terminal');
    }
  }
}

function handleGuidedCodeHook(command) {
  if (guidedModeActive && currentGuidedStep === 3) {
    const cleaned = command.replace(/\s+/g, '');
    if (cleaned.includes('gravity=') && parseFloat(cleaned.split('gravity=')[1]) <= 0.25) {
      currentGuidedStep = 4;
      updateGuidedUI();
    }
  }
}

function handleGuidedClearHook() {
  if (guidedModeActive && currentGuidedStep === 4) {
    currentGuidedStep = 5;
    updateGuidedUI();
  }
}
