// nav-renderer.js - Premium canvas render pipeline for Star Hopper Solar Navigator
// Renders planetary orbits, SOI boundaries, Hohmann phase helper lines, ship status HUD, and fuel reserves.

window.Nav = window.Nav || {};

(function(Nav) {
  
  // Predicts path under gravity (N-body) for showing the pilot a preview line
  function getPredictedTrajectory() {
    if (!Nav.ship) return [];

    let px = Nav.ship.x;
    let py = Nav.ship.y;
    let pvx = Nav.ship.vx;
    let pvy = Nav.ship.vy;
    let shipAngle = Nav.ship.angle;
    let fuelMass = Nav.ship.fuelMass;
    let dryMass = Nav.ship.dryMass;
    let burnRate = Nav.ship.burnRate;

    // Check if simulation is currently idle (paused at Earth)
    const isIdle = !(window.Nav.commandQueue.length > 0 || window.Nav.currentAction);
    let actions = [];
    let currentAction = null;
    let actionTimeRemaining = 0;

    if (isIdle) {
      const inputEl = document.getElementById("navigator-console-input");
      const codeText = inputEl ? inputEl.value : "";
      actions = Nav.parseCommands ? Nav.parseCommands(codeText) : [];
    } else {
      actions = window.Nav.commandQueue.map(a => ({...a}));
      if (window.Nav.currentAction) {
        currentAction = {...window.Nav.currentAction};
        actionTimeRemaining = window.Nav.actionTimeRemaining;
      }
    }

    let totalDuration = 0;
    if (isIdle) {
      actions.forEach(a => {
        if (a.duration) totalDuration += a.duration;
      });
    } else {
      if (currentAction && actionTimeRemaining > 0) {
        totalDuration += actionTimeRemaining;
      }
      actions.forEach(a => {
        if (a.duration) totalDuration += a.duration;
      });
    }

    if (totalDuration === 0) totalDuration = 100; // default to 100 days of drift if empty

    const simDt = 0.25; // Integration step size (days) for preview path
    const maxPredDuration = Math.min(300, totalDuration);
    const maxSteps = Math.ceil(maxPredDuration / simDt);
    const points = [];

    for (let step = 0; step < maxSteps; step++) {
      const currentT = Nav.ship.timeElapsed + step * simDt;

      // Process actions
      if (!currentAction && actions.length > 0) {
        currentAction = actions.shift();
        if (currentAction.type === 'rotate') {
          const targetName = currentAction.target.toUpperCase();
          const targetBody = Nav.BODIES[targetName];
          if (targetBody) {
            const bState = Nav.bodyStateAt(targetBody, currentT);
            shipAngle = Math.atan2(bState.y - py, bState.x - px);
          }
          currentAction = null; // Rotate is instantaneous
        } else if (currentAction.type === 'thrust') {
          actionTimeRemaining = currentAction.duration;
        } else if (currentAction.type === 'wait') {
          actionTimeRemaining = currentAction.duration;
        } else if (currentAction.type === 'warp') {
          currentAction = null; // Warp does not change path
        }
      }

      let ax_thrust = 0;
      let ay_thrust = 0;
      let thrustActive = false;

      if (currentAction) {
        if (currentAction.type === 'thrust' && fuelMass > 0) {
          thrustActive = true;
          const thrustPower = (currentAction.power * 0.15) / 592.26;
          const shipMass = dryMass + fuelMass;
          const thrustAcc = thrustPower / shipMass;
          ax_thrust = Math.cos(shipAngle) * thrustAcc;
          ay_thrust = Math.sin(shipAngle) * thrustAcc;

          // Consume fuel
          const fuelBurn = burnRate * simDt;
          fuelMass = Math.max(0, fuelMass - fuelBurn);
        }
        
        actionTimeRemaining -= simDt;
        if (actionTimeRemaining <= 0) {
          currentAction = null;
        }
      }

      // Gravity acceleration at predicted state
      const grav = Nav.getGravityAcceleration({ x: px, y: py }, currentT);
      let ax = grav.x + ax_thrust;
      let ay = grav.y + ay_thrust;

      // Position update (Verlet step)
      const nextX = px + pvx * simDt + 0.5 * ax * simDt * simDt;
      const nextY = py + pvy * simDt + 0.5 * ay * simDt * simDt;

      // Next acceleration
      let nextAx_thrust = ax_thrust;
      let nextAy_thrust = ay_thrust;
      if (!thrustActive || fuelMass <= 0) {
        nextAx_thrust = 0;
        nextAy_thrust = 0;
      }
      
      const nextGrav = Nav.getGravityAcceleration({ x: nextX, y: nextY }, currentT + simDt);
      const nextAx = nextGrav.x + nextAx_thrust;
      const nextAy = nextGrav.y + nextAy_thrust;

      pvx += 0.5 * (ax + nextAx) * simDt;
      pvy += 0.5 * (ay + nextAy) * simDt;

      px = nextX;
      py = nextY;

      // Add path point
      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pvx) || !Number.isFinite(pvy)) {
        break;
      }
      points.push({ x: px, y: py });

      // Check if predicted position collides with Sun or planets
      let hit = false;
      for (const key in Nav.BODIES) {
        const body = Nav.BODIES[key];
        const bState = Nav.bodyStateAt(body, currentT);
        const dist = Math.sqrt((px - bState.x) * (px - bState.x) + (py - bState.y) * (py - bState.y));
        if (dist < body.radius) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }

    return points;
  }

  /**
   * Draws the entire solar simulator screen.
   * @param {Object} game - StarHopperGame wrapper
   */
  Nav.drawSolarSimulation = function(game) {
    const ctx = game.ctx;
    const canvas = game.canvas;

    // 1. Deep space background clear
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center coordinates include the user-panned solar viewport offset.
    const sunScreen = Nav.worldToScreen({ x: 0, y: 0 }, canvas);
    const cx = sunScreen.x;
    const cy = sunScreen.y;

    // Draw coordinate grids
    ctx.strokeStyle = "rgba(56, 189, 248, 0.03)";
    ctx.lineWidth = 1;
    const gridSpacing = 50;
    const gridStartX = ((cx % gridSpacing) + gridSpacing) % gridSpacing;
    const gridStartY = ((cy % gridSpacing) + gridSpacing) % gridSpacing;
    for (let x = gridStartX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = gridStartY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const t = Nav.ship ? Nav.ship.timeElapsed : 0;

    // 2. Draw planet circular orbits around Sun
    for (const key in Nav.BODIES) {
      const body = Nav.BODIES[key];
      if (body.id === "sun") continue;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.arc(cx, cy, Nav.suToPx(body.orbitRadius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Draw Hohmann Alignment Phase Helper Line (Sun -> Earth -> Target)
    const activeMission = Nav.Missions[Nav.activeMissionIndex];
    if (activeMission && Nav.ship) {
      const destBody = Nav.BODIES[activeMission.destinationId.toUpperCase()];
      const earthBody = Nav.BODIES.EARTH;
      
      if (destBody && destBody.id !== "sun") {
        const eState = Nav.bodyStateAt(earthBody, t);
        const dState = Nav.bodyStateAt(destBody, t);

        const earthScreen = Nav.worldToScreen(eState, canvas);
        const destScreen = Nav.worldToScreen(dState, canvas);
        const ex = earthScreen.x;
        const ey = earthScreen.y;
        const dx = destScreen.x;
        const dy = destScreen.y;

        // Draw line Sun to Earth
        ctx.beginPath();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Draw line Sun to Destination
        ctx.beginPath();
        ctx.strokeStyle = "rgba(244, 63, 94, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx, cy);
        ctx.lineTo(dx, dy);
        ctx.stroke();

        // Draw phase angle sweep arc
        const eAngle = Math.atan2(eState.y, eState.x);
        const dAngle = Math.atan2(dState.y, dState.x);
        
        ctx.beginPath();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
        ctx.lineWidth = 2.5;
        ctx.arc(cx, cy, 35, Math.min(eAngle, dAngle), Math.max(eAngle, dAngle));
        ctx.stroke();
      }
    }

    // 4. Draw Celestial Bodies (Sun + Planets)
    for (const key in Nav.BODIES) {
      const body = Nav.BODIES[key];
      const state = Nav.bodyStateAt(body, t);
      const bodyScreen = Nav.worldToScreen(state, canvas);
      const bx = bodyScreen.x;
      const by = bodyScreen.y;
      const rPx = Nav.suToPx(body.radius);

      // Draw Sphere of Influence boundary ring (excluding Sun)
      if (body.id !== "sun") {
        const soiLimit = Nav.SOI_RADII[body.id];
        if (soiLimit) {
          const soiPx = Nav.suToPx(soiLimit);
          ctx.beginPath();
          // Glow if inside SOI
          const isInside = Nav.ship && (Nav.detectSOI(Nav.ship, t).id === body.id);
          ctx.strokeStyle = isInside ? "rgba(34, 197, 94, 0.25)" : "rgba(148, 163, 184, 0.06)";
          ctx.lineWidth = isInside ? 2 : 1;
          ctx.setLineDash([2, 4]);
          ctx.arc(bx, by, soiPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          
          if (isInside) {
            ctx.fillStyle = "rgba(34, 197, 94, 0.05)";
            ctx.arc(bx, by, soiPx, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw Body
      ctx.beginPath();
      let grad;
      if (body.id === "sun") {
        grad = ctx.createRadialGradient(bx, by, rPx * 0.1, bx, by, rPx);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#fef08a');
        grad.addColorStop(0.7, '#f59e0b');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
      } else {
        grad = ctx.createRadialGradient(bx - rPx * 0.3, by - rPx * 0.3, rPx * 0.1, bx, by, rPx);
        grad.addColorStop(0, body.color);
        grad.addColorStop(0.8, body.color);
        grad.addColorStop(1, '#020617'); // shadow side
      }
      ctx.fillStyle = grad;
      ctx.arc(bx, by, rPx, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric/Corona glow ring
      ctx.beginPath();
      ctx.strokeStyle = body.id === "sun" ? "rgba(251, 191, 36, 0.35)" : `${body.color}40`;
      ctx.lineWidth = body.id === "sun" ? 4 : 2;
      ctx.arc(bx, by, rPx + (body.id === "sun" ? 3 : 1.5), 0, Math.PI * 2);
      ctx.stroke();

      // Draw Name tag
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.font = "bold 9px 'Share Tech Mono'";
      ctx.fillText(body.name.toUpperCase(), bx - (body.name.length * 2.8), by - rPx - 6);
    }

    // 5. Draw Spacecraft & Path Telemetry
    if (Nav.ship) {
      const shipScreen = Nav.worldToScreen(Nav.ship, canvas);
      const sx = shipScreen.x;
      const sy = shipScreen.y;

      // Record trail coordinates in real-time
      if (Nav.ship.lastTrailTime === null || Nav.ship.timeElapsed - Nav.ship.lastTrailTime >= 0.5) {
        Nav.ship.trail.push({ x: Nav.ship.x, y: Nav.ship.y });
        if (Nav.ship.trail.length > 150) Nav.ship.trail.shift();
        Nav.ship.lastTrailTime = Nav.ship.timeElapsed;
      }

      // Draw Spacecraft flight path history
      ctx.beginPath();
      ctx.strokeStyle = "rgba(249, 115, 22, 0.28)";
      ctx.lineWidth = 2;
      for (let i = 0; i < Nav.ship.trail.length; i++) {
        const pt = Nav.ship.trail[i];
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        const trailScreen = Nav.worldToScreen(pt, canvas);
        const tx = trailScreen.x;
        const ty = trailScreen.y;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();

      // Draw predicted path preview
      const predPath = getPredictedTrajectory();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 4]);
      for (let i = 0; i < predPath.length; i++) {
        const pt = predPath[i];
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        const predScreen = Nav.worldToScreen(pt, canvas);
        const px = predScreen.x;
        const py = predScreen.y;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw active thrust fuel engine flame particles
      if (Nav.ship.thrustActive && Math.random() < 0.5) {
        Nav.exhaustParticles.push({
          x: Nav.ship.x - Math.cos(Nav.ship.angle) * 0.05,
          y: Nav.ship.y - Math.sin(Nav.ship.angle) * 0.05,
          vx: -Math.cos(Nav.ship.angle) * 0.02 + (Math.random() - 0.5) * 0.01,
          vy: -Math.sin(Nav.ship.angle) * 0.02 + (Math.random() - 0.5) * 0.01,
          life: 1.0
        });
      }
      
      Nav.exhaustParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.08;
      });
      Nav.exhaustParticles = Nav.exhaustParticles.filter(p => p.life > 0);

      Nav.exhaustParticles.forEach(p => {
        ctx.fillStyle = "#ef4444";
        ctx.globalAlpha = p.life;
        const particleScreen = Nav.worldToScreen(p, canvas);
        ctx.fillRect(particleScreen.x, particleScreen.y, 2.5, 2.5);
      });
      ctx.globalAlpha = 1.0;

      // Draw Ship body orientation
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Nav.ship.angle);

      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-7, -5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fillStyle = Nav.ship.thrustActive ? "#ef4444" : "#f8fafc";
      ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.restore();

      // 6. Draw HUD Panels on Canvas (Left Side Telemetry, Right Side Hohmann Helpers)
      // HUD Left: Telemetry
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1;
      ctx.fillRect(15, 15, 230, 115);
      ctx.strokeRect(15, 15, 230, 115);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "11px 'Share Tech Mono'";

      // Current SOI Detections
      const activeSOI = Nav.detectSOI(Nav.ship, t);
      ctx.fillText(`GRAVITY WELL: ${activeSOI.name.toUpperCase()}`, 25, 32);

      // Ship speeds
      const currentSpeed = Nav.Vector.magnitude({ x: Nav.ship.vx, y: Nav.ship.vy });
      ctx.fillText(`VELOCITY    : ${currentSpeed.toFixed(3)} SU/day`, 25, 48);

      // Relative distances
      let distanceText = "";
      if (activeMission) {
        const dest = Nav.BODIES[activeMission.destinationId.toUpperCase()];
        const destState = Nav.bodyStateAt(dest, t);
        const dist = Nav.Vector.distance(Nav.ship, destState);
        distanceText = `DIST TO DEST: ${dist.toFixed(3)} SU`;
        ctx.fillText(distanceText, 25, 64);
      }

      // Orbital Energy
      const parentState = Nav.bodyStateAt(activeSOI, t);
      const specificEnergy = Nav.calcSpecificEnergy(Nav.ship, activeSOI, parentState);
      ctx.fillStyle = specificEnergy < 0 ? "var(--neon-green)" : "var(--text-muted)";
      ctx.fillText(`SPEC ENERGY : ${specificEnergy.toFixed(3)} SU²/d²`, 25, 80);

      // Mission Elapsed Time
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(`MISSION TIME: ${Math.round(Nav.ship.timeElapsed)} days`, 25, 96);
      ctx.fillText(`WARP SPEED  : ${Nav.timeWarpFactor}x`, 25, 112);

      // HUD Right: Hohmann Launch Window Indicator & Fuel Gauge
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.strokeStyle = "rgba(251, 113, 133, 0.25)";
      ctx.fillRect(canvas.width - 245, 15, 230, 115);
      ctx.strokeRect(canvas.width - 245, 15, 230, 115);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(`LAUNCH PAD & FUEL CONTROL`, canvas.width - 235, 32);

      // Fuel reserve visual meter
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(`FUEL RESERVES`, canvas.width - 235, 48);
      
      const fuelPercentage = Nav.ship.fuelMass / Nav.ship.maxFuel;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(canvas.width - 150, 40, 120, 10);
      
      // Fuel bar gradient
      const fuelGrad = ctx.createLinearGradient(canvas.width - 150, 0, canvas.width - 30, 0);
      fuelGrad.addColorStop(0, "#ef4444");
      fuelGrad.addColorStop(0.5, "#eab308");
      fuelGrad.addColorStop(1, "#22c55e");
      ctx.fillStyle = fuelGrad;
      ctx.fillRect(canvas.width - 150, 40, 120 * fuelPercentage, 10);

      // Draw Hohmann Alignment comparison
      if (activeMission) {
        const origin = Nav.BODIES[activeMission.originId.toUpperCase()];
        const destination = Nav.BODIES[activeMission.destinationId.toUpperCase()];
        
        if (origin && destination && destination.id !== "sun") {
          const currentAngles = Nav.getCurrentPhaseAngle(origin, destination, t);
          const transfers = Nav.computeTransfer(origin, destination);
          
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fillText(`CURRENT ANGLE: ${currentAngles.deg.toFixed(1)}°`, canvas.width - 235, 75);
          ctx.fillText(`TARGET ANGLE : ${transfers.targetPhaseAngleDeg.toFixed(1)}°`, canvas.width - 235, 90);

          const diff = Math.abs(Nav.Angle.difference(currentAngles.rad, transfers.targetPhaseAngleRad));
          const aligned = diff < (5 * Math.PI) / 180; // Within 5 degrees
          
          ctx.fillStyle = aligned ? "var(--neon-green)" : "var(--neon-pink)";
          ctx.fillText(aligned ? "WINDOW OPEN: STEER & LAUNCH NOW" : "WAITING FOR PROPER ALIGNMENT...", canvas.width - 235, 110);
        }
      }
    }

    // 7. Mission Verified overlay if mission is verified success
    if (activeMission && Nav.orbitalMissionsCompleted && Nav.orbitalMissionsCompleted.has(activeMission.id)) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.fillRect(canvas.width / 2 - 160, canvas.height - 75, 320, 45);
      ctx.strokeStyle = "var(--neon-green)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(canvas.width / 2 - 160, canvas.height - 75, 320, 45);

      ctx.fillStyle = "var(--neon-green)";
      ctx.font = "14px 'Outfit'";
      ctx.textAlign = "center";
      ctx.fillText("MISSION VERIFIED • CODES LOCKED", canvas.width / 2, canvas.height - 48);
      ctx.textAlign = "left";
    }
  };

})(window.Nav);
