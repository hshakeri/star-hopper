// navigator-classic.js - Handles Spaceship Orbital Navigation simulation (Velocity Verlet) for Classic mode

window.navigatorModeActive = false;

// Orbital Physics State
let ship = null;
let earth = { x: 0, y: 0, r: 24, mass: 2200 };
let jupiter = { x: 260, y: -60, r: 35, mass: 9000 }; // Placed for slingshot
let timeWarpFactor = 1.0;
let orbitalMissionsCompleted = new Set();
let activeNavMissionIndex = 0;

// Command Queue State
let commandQueue = [];
let currentAction = null;
let actionTimeRemaining = 0;

// Trail particles
let orbitalParticles = [];

// Initialize orbital mode
function initNavigatorModeClassic() {
  window.navigatorModeActive = true;
  loadNavigatorMissionClassic(activeNavMissionIndex);
  renderNavigatorMissionsClassic();
}

function stopNavigatorModeClassic() {
  window.navigatorModeActive = false;
}

// Load a specific navigator mission
function loadNavigatorMissionClassic(index) {
  activeNavMissionIndex = index;
  commandQueue = [];
  currentAction = null;
  actionTimeRemaining = 0;
  orbitalParticles = [];
  timeWarpFactor = 1.0;

  const mission = NavigatorMissions[index];
  const objEl = document.getElementById("navigator-mission-objective");
  if (objEl) {
    objEl.innerHTML = `<strong>Objective:</strong> ${mission.objective}<br><span style="font-size:0.7rem; color:var(--text-muted);">Concept: ${mission.concept}</span>`;
  }

  // Setup initial ship states based on mission requirements
  if (mission.id === "nav-orbit-school") {
    ship = {
      x: 0,
      y: -180,
      vx: 3.5,
      vy: 0,
      angle: 0,
      thrustActive: false,
      thrustPower: 0,
      maxVelocityObserved: 3.5,
      closestApproachJupiter: 1000,
      timeDilationFactor: 1.0,
      timeElapsed: 0,
      trail: []
    };
  } else if (mission.id === "nav-escape") {
    ship = {
      x: 0,
      y: -140,
      vx: 2.8,
      vy: 0,
      angle: 0,
      thrustActive: false,
      thrustPower: 0,
      maxVelocityObserved: 2.8,
      closestApproachJupiter: 1000,
      timeDilationFactor: 1.0,
      timeElapsed: 0,
      trail: []
    };
  } else if (mission.id === "nav-slingshot") {
    // Start far left, heading near Earth towards Jupiter
    ship = {
      x: -240,
      y: -180,
      vx: 3.2,
      vy: 0.8,
      angle: 0,
      thrustActive: false,
      thrustPower: 0,
      maxVelocityObserved: 3.2,
      closestApproachJupiter: 1000,
      timeDilationFactor: 1.0,
      timeElapsed: 0,
      trail: []
    };
  } else if (mission.id === "nav-time-dilation") {
    // High starting speed
    ship = {
      x: 0,
      y: -190,
      vx: 2.0,
      vy: 0,
      angle: 0,
      thrustActive: false,
      thrustPower: 0,
      maxVelocityObserved: 2.0,
      closestApproachJupiter: 1000,
      timeDilationFactor: 1.0,
      timeElapsed: 0,
      trail: []
    };
  }

  // Log to navigator console
  clearNavigatorConsoleClassic();
  logNavigatorConsoleClassic(`Loaded Mission: ${mission.title}`, "success");
  logNavigatorConsoleClassic(`Starter command loaded. Click 'Enter' or type to execute.`, "info");
  
  // Set starter code in the input console
  const inputEl = document.getElementById("navigator-console-input");
  if (inputEl) {
    inputEl.value = mission.starterCode.replace(/\n/g, "; ");
  }

  renderNavigatorMissionsClassic();
}

function renderNavigatorMissionsClassic() {
  const container = document.getElementById("navigator-mission-list");
  if (!container) return;

  container.innerHTML = "";
  NavigatorMissions.forEach((mission, idx) => {
    const isCompleted = orbitalMissionsCompleted.has(mission.id);
    const isActive = idx === activeNavMissionIndex;

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
      loadNavigatorMissionClassic(idx);
    });

    container.appendChild(item);
  });
}

// Add shortcut code to command input
function addNavigatorConsoleClassic(code) {
  const inputEl = document.getElementById("navigator-console-input");
  if (!inputEl) return;
  if (inputEl.value) {
    inputEl.value += "; " + code;
  } else {
    inputEl.value = code;
  }
}

// Log utility for orbital simulator
function logNavigatorConsoleClassic(msg, type = "info") {
  const history = document.getElementById("navigator-console-history");
  if (!history) return;

  const line = document.createElement("div");
  line.className = `console-line ${type}`;
  if (type === "success") {
    line.textContent = `★ ${msg}`;
    line.style.color = "var(--neon-green)";
  } else if (type === "error") {
    line.textContent = `⚠️ ${msg}`;
    line.style.color = "var(--neon-pink)";
  } else {
    line.textContent = `> ${msg}`;
  }
  history.appendChild(line);
  history.scrollTop = history.scrollHeight;
}

function clearNavigatorConsoleClassic() {
  const history = document.getElementById("navigator-console-history");
  if (history) {
    history.innerHTML = `<div class="console-line info">--- Orbit Command Deck OS v1.0 ---</div>`;
  }
}

// Simple Parser & Queue execution
function runNavigatorCommandsClassic(commandString) {
  if (!commandString.trim()) return;

  logNavigatorConsoleClassic(`Executing: ${commandString}`, "info");

  // Parse commands separated by semicolon
  const parts = commandString.split(";");
  commandQueue = [];

  parts.forEach(part => {
    const cmd = part.trim();
    if (!cmd) return;

    try {
      if (cmd.startsWith("point_at")) {
        const match = cmd.match(/point_at\(['"]?(\w+)['"]?\)/);
        const target = match ? match[1] : 'earth';
        commandQueue.push({ type: 'rotate', target });
      } else if (cmd.startsWith("thrust")) {
        // Parse power and seconds
        const powMatch = cmd.match(/power=([0-9.]+)/) || cmd.match(/thrust\(([0-9.]+)/);
        const secMatch = cmd.match(/seconds=([0-9.]+)/) || cmd.match(/,\s*([0-9.]+)\)/) || cmd.match(/thrust\([^,]+,\s*([0-9.]+)\)/);
        
        const power = powMatch ? parseFloat(powMatch[1]) : 4.0;
        const seconds = secMatch ? parseFloat(secMatch[1]) : 2.0;
        commandQueue.push({ type: 'thrust', power, duration: seconds });
      } else if (cmd.startsWith("wait")) {
        const match = cmd.match(/wait\(([0-9.]+)\)/);
        const duration = match ? parseFloat(match[1]) : 3.0;
        commandQueue.push({ type: 'wait', duration });
      } else if (cmd.startsWith("warp")) {
        const match = cmd.match(/warp\(([0-9.]+)\)/);
        const factor = match ? parseFloat(match[1]) : 5.0;
        commandQueue.push({ type: 'warp', factor });
      } else {
        logNavigatorConsoleClassic(`Syntax error: Unknown command '${cmd}'`, "error");
      }
    } catch (e) {
      logNavigatorConsoleClassic(`Syntax error in: ${cmd}`, "error");
    }
  });

  currentAction = null;
  actionTimeRemaining = 0;
}

// Calculate Gravity Acceleration
function calcGravityAccel(sx, sy, target) {
  const dx = target.x - sx;
  const dy = target.y - sy;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  if (dist < 10) return { ax: 0, ay: 0 }; // Inside body boundary

  const force = target.mass / (distSq * dist);
  return {
    ax: dx * force,
    ay: dy * force
  };
}

// Physics simulation loop (Velocity Verlet)
function updateNavigatorClassic(game) {
  if (!ship) return;

  const dt = 0.05 * timeWarpFactor;

  // Process Command Queue
  if (!currentAction && commandQueue.length > 0) {
    currentAction = commandQueue.shift();
    if (currentAction.type === 'rotate') {
      const targetBody = currentAction.target === 'jupiter' ? jupiter : earth;
      const targetAngle = Math.atan2(targetBody.y - ship.y, targetBody.x - ship.x);
      ship.angle = targetAngle;
      logNavigatorConsoleClassic(`Ship oriented towards ${currentAction.target}.`, "info");
      currentAction = null; // Completed instantly
    } else if (currentAction.type === 'thrust') {
      ship.thrustActive = true;
      ship.thrustPower = currentAction.power * 0.15;
      actionTimeRemaining = currentAction.duration;
      logNavigatorConsoleClassic(`Firing thrusters: power=${currentAction.power}, duration=${currentAction.duration}s`, "info");
    } else if (currentAction.type === 'wait') {
      actionTimeRemaining = currentAction.duration;
    } else if (currentAction.type === 'warp') {
      timeWarpFactor = currentAction.factor;
      logNavigatorConsoleClassic(`Time warp multiplier set to ${timeWarpFactor}x`, "info");
      currentAction = null;
    }
  }

  if (currentAction) {
    actionTimeRemaining -= dt;
    if (actionTimeRemaining <= 0) {
      if (currentAction.type === 'thrust') {
        ship.thrustActive = false;
        ship.thrustPower = 0;
      }
      currentAction = null;
    }
  }

  // 1. Calculate Acceleration at current state
  const gravEarth = calcGravityAccel(ship.x, ship.y, earth);
  let ax = gravEarth.ax;
  let ay = gravEarth.ay;

  // Add Jupiter gravity if slingshot mission
  if (activeNavMissionIndex === 2) {
    const gravJup = calcGravityAccel(ship.x, ship.y, jupiter);
    ax += gravJup.ax;
    ay += gravJup.ay;

    // Track closest approach to Jupiter
    const distJup = Math.sqrt((ship.x - jupiter.x) * (ship.x - jupiter.x) + (ship.y - jupiter.y) * (ship.y - jupiter.y));
    if (distJup < ship.closestApproachJupiter) {
      ship.closestApproachJupiter = distJup;
    }
  }

  // Engine Thrust
  if (ship.thrustActive) {
    ax += Math.cos(ship.angle) * ship.thrustPower;
    ay += Math.sin(ship.angle) * ship.thrustPower;

    // Emit exhaust particles
    if (Math.random() < 0.4) {
      orbitalParticles.push({
        x: ship.x - Math.cos(ship.angle) * 10,
        y: ship.y - Math.sin(ship.angle) * 10,
        vx: -Math.cos(ship.angle) * 2 + (Math.random() - 0.5),
        vy: -Math.sin(ship.angle) * 2 + (Math.random() - 0.5),
        life: 1.0,
        color: '#f97316'
      });
    }
  }

  // 2. Velocity Verlet Position Step
  const next_x = ship.x + ship.vx * dt + 0.5 * ax * dt * dt;
  const next_y = ship.y + ship.vy * dt + 0.5 * ay * dt * dt;

  // 3. Acceleration at next state
  const nextGravEarth = calcGravityAccel(next_x, next_y, earth);
  let next_ax = nextGravEarth.ax;
  let next_ay = nextGravEarth.ay;

  if (activeNavMissionIndex === 2) {
    const nextGravJup = calcGravityAccel(next_x, next_y, jupiter);
    next_ax += nextGravJup.ax;
    next_ay += nextGravJup.ay;
  }

  if (ship.thrustActive) {
    next_ax += Math.cos(ship.angle) * ship.thrustPower;
    next_ay += Math.sin(ship.angle) * ship.thrustPower;
  }

  // 4. Velocity Verlet Velocity Step
  ship.vx += 0.5 * (ax + next_ax) * dt;
  ship.vy += 0.5 * (ay + next_ay) * dt;

  ship.x = next_x;
  ship.y = next_y;

  // Max Velocity observation
  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
  if (speed > ship.maxVelocityObserved) {
    ship.maxVelocityObserved = speed;
  }

  // Relativistic Time Dilation Factor calculation
  const c = 6.0; // Simulated speed of light
  const beta = Math.min(0.99, speed / c);
  ship.timeDilationFactor = 1.0 / Math.sqrt(1.0 - beta * beta);

  ship.timeElapsed += dt;

  // Record trail coordinates
  if (Math.round(ship.timeElapsed * 10) % 2 === 0) {
    ship.trail.push({ x: ship.x, y: ship.y });
    if (ship.trail.length > 100) ship.trail.shift();
  }

  // Update particles
  orbitalParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.05;
  });
  orbitalParticles = orbitalParticles.filter(p => p.life > 0);

  // Check verification
  const activeMission = NavigatorMissions[activeNavMissionIndex];
  if (!orbitalMissionsCompleted.has(activeMission.id)) {
    if (activeMission.validate(ship)) {
      orbitalMissionsCompleted.add(activeMission.id);
      logNavigatorConsoleClassic(`Mission Success: ${activeMission.title}! Coordinates locked!`, "success");
      renderNavigatorMissionsClassic();
      if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
        SFX.playSuccess();
      }
    }
  }

  // Crashing check
  const distEarth = Math.sqrt(ship.x * ship.x + ship.y * ship.y);
  if (distEarth < earth.r) {
    logNavigatorConsoleClassic("COLLISION ALERT: Ship crashed into Earth!", "error");
    loadNavigatorMissionClassic(activeNavMissionIndex);
  }
}

// Predict trajectory for dotted preview line
function getPredictedTrajectoryClassic(stepsCount = 150) {
  if (!ship) return [];

  let px = ship.x;
  let py = ship.y;
  let pvx = ship.vx;
  let pvy = ship.vy;

  const points = [];
  const simDt = 0.08;

  for (let i = 0; i < stepsCount; i++) {
    const gravEarth = calcGravityAccel(px, py, earth);
    let ax = gravEarth.ax;
    let ay = gravEarth.ay;

    if (activeNavMissionIndex === 2) {
      const gravJup = calcGravityAccel(px, py, jupiter);
      ax += gravJup.ax;
      ay += gravJup.ay;
    }

    const next_x = px + pvx * simDt + 0.5 * ax * simDt * simDt;
    const next_y = py + pvy * simDt + 0.5 * ay * simDt * simDt;

    const nextGravEarth = calcGravityAccel(next_x, next_y, earth);
    let next_ax = nextGravEarth.ax;
    let next_ay = nextGravEarth.ay;

    if (activeNavMissionIndex === 2) {
      const nextGravJup = calcGravityAccel(next_x, next_y, jupiter);
      next_ax += nextGravJup.ax;
      next_ay += nextGravJup.ay;
    }

    pvx += 0.5 * (ax + next_ax) * simDt;
    pvy += 0.5 * (ay + next_ay) * simDt;

    px = next_x;
    py = next_y;

    if (i % 2 === 0) {
      points.push({ x: px, y: py });
    }

    // Stop prediction if hit central body
    const distEarth = Math.sqrt(px * px + py * py);
    if (distEarth < earth.r) break;
  }

  return points;
}

// Draw orbital simulator onto game canvas
function drawNavigatorClassic(game) {
  const ctx = game.ctx;
  const canvas = game.canvas;

  // Clear Canvas
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Center coordinate transformation
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Draw Space Grid Layout
  ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Earth central body
  ctx.beginPath();
  const earthGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, earth.r);
  earthGrad.addColorStop(0, '#38bdf8');
  earthGrad.addColorStop(0.8, '#0284c7');
  earthGrad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = earthGrad;
  ctx.arc(cx, cy, earth.r, 0, Math.PI * 2);
  ctx.fill();

  // Earth Atmosphere atmosphere glow
  ctx.beginPath();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
  ctx.lineWidth = 4;
  ctx.arc(cx, cy, earth.r + 3, 0, Math.PI * 2);
  ctx.stroke();

  // Label Earth
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 9px 'Share Tech Mono'";
  ctx.fillText("EARTH", cx - 13, cy + 3);

  // Draw Jupiter if slingshot mission
  if (activeNavMissionIndex === 2) {
    const jx = cx + jupiter.x;
    const jy = cy + jupiter.y;

    ctx.beginPath();
    const jupGrad = ctx.createRadialGradient(jx, jy, 3, jx, jy, jupiter.r);
    jupGrad.addColorStop(0, '#fb923c');
    jupGrad.addColorStop(0.8, '#ea580c');
    jupGrad.addColorStop(1, '#7c2d12');
    ctx.fillStyle = jupGrad;
    ctx.arc(jx, jy, jupiter.r, 0, Math.PI * 2);
    ctx.fill();

    // Jupiter rings/glow
    ctx.beginPath();
    ctx.strokeStyle = "rgba(249, 115, 22, 0.25)";
    ctx.lineWidth = 3;
    ctx.arc(jx, jy, jupiter.r + 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.fillText("JUPITER (SLINGSHOT TARGET)", jx - 50, jy + jupiter.r + 14);
  }

  // Draw Dotted Trajectory Prediction
  const path = getPredictedTrajectoryClassic();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    if (i === 0) {
      ctx.moveTo(cx + pt.x, cy + pt.y);
    } else {
      ctx.lineTo(cx + pt.x, cy + pt.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // Draw recorded ship trail path
  ctx.beginPath();
  ctx.strokeStyle = "rgba(249, 115, 22, 0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < ship.trail.length; i++) {
    const pt = ship.trail[i];
    if (i === 0) {
      ctx.moveTo(cx + pt.x, cy + pt.y);
    } else {
      ctx.lineTo(cx + pt.x, cy + pt.y);
    }
  }
  ctx.stroke();

  // Draw exhaust engine flame particles
  orbitalParticles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(cx + p.x, cy + p.y, 3, 3);
  });
  ctx.globalAlpha = 1.0;

  // Draw Spacecraft Ship
  const sx = cx + ship.x;
  const sy = cy + ship.y;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ship.angle);

  // Ship triangle body
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fillStyle = ship.thrustActive ? '#f97316' : '#f8fafc';
  ctx.shadowColor = "rgba(56, 189, 248, 0.8)";
  ctx.shadowBlur = 10;
  ctx.fill();

  ctx.restore();

  // Draw Vector Speed HUD overlays on upper-left canvas
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.fillRect(15, 15, 220, 95);
  ctx.strokeRect(15, 15, 220, 95);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "11px 'Share Tech Mono'";
  const speedVal = Math.sqrt(ship.vx*ship.vx + ship.vy*ship.vy);
  ctx.fillText(`VELOCITY VECTOR : ${speedVal.toFixed(2)} px/frame`, 25, 32);
  ctx.fillText(`VX: ${ship.vx.toFixed(2)} | VY: ${ship.vy.toFixed(2)}`, 25, 48);
  ctx.fillText(`APPROACH JUPITER: ${Math.round(ship.closestApproachJupiter)}px`, 25, 64);
  
  // Einstein Time gauge
  ctx.fillStyle = ship.timeDilationFactor > 1.5 ? "var(--neon-pink)" : "rgba(255,255,255,0.9)";
  ctx.fillText(`EINSTEIN DILATION: ${ship.timeDilationFactor.toFixed(2)}x`, 25, 80);
  ctx.fillText(`WARP MULTIPLIER : ${timeWarpFactor.toFixed(1)}x`, 25, 96);

  // Success text overlay if current mission is passed
  const activeMission = NavigatorMissions[activeNavMissionIndex];
  if (orbitalMissionsCompleted.has(activeMission.id)) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(canvas.width / 2 - 150, canvas.height - 60, 300, 40);
    ctx.strokeStyle = "var(--neon-green)";
    ctx.strokeRect(canvas.width / 2 - 150, canvas.height - 60, 300, 40);

    ctx.fillStyle = "var(--neon-green)";
    ctx.font = "14px 'Outfit'";
    ctx.textAlign = "center";
    ctx.fillText("MISSION VERIFIED • CODES LOCKED", canvas.width / 2, canvas.height - 35);
    ctx.textAlign = "left"; // Restore
  }
}
