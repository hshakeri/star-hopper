// guided-mode.js - Guided learning tutorial for first-time Star Hopper cadets

let guidedModeActive = false;
let currentGuidedStep = 1;

const MissionCoachGuidedCopy = [
  {
    label: "Step 1 of 5: Observe",
    text: "📡 Vector here — a coded signal is repeating from deep space, and we'll trace it world by world. First, try moving and jumping; watch what blocks the rover before changing any code.",
    highlight: "game-canvas"
  },
  {
    label: "Step 2 of 5: Predict",
    text: "Open Log and write what you think will happen before the code changes.",
    highlight: "mode-btn-notebook"
  },
  {
    label: "Step 3 of 5: Code",
    text: "Return to Play and use Mission Coach. Change the blanks in Try this code, then run it.",
    highlight: "mode-btn-terminal"
  },
  {
    label: "Step 4 of 5: Test",
    text: "Move again and collect the unlocked gems. Compare the jump path with your prediction.",
    highlight: "game-canvas"
  },
  {
    label: "Step 5 of 5: Explain",
    text: "Open Log and explain which code change helped most.",
    highlight: "mode-btn-notebook",
    button: "Got it"
  }
];

function getGuidedStepCopy() {
  return MissionCoachGuidedCopy.map(step => `${step.label} ${step.text}`);
}

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

  const step = MissionCoachGuidedCopy[currentGuidedStep - 1];
  if (step) {
    labelEl.textContent = step.label;
    descEl.textContent = step.text;
    nextBtn.style.display = step.button ? 'block' : 'none';
    nextBtn.textContent = step.button || "Next";
    highlightElement(step.highlight);
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
    if (cleaned.includes('=')) {
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
