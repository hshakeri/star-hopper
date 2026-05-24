// nav-physics.js - N-body gravity integration and state update rules
// Simulates the spaceship flight under the gravitational influence of the Sun, Earth, Mars, and Jupiter.

window.Nav = window.Nav || {};

(function(Nav) {
  // Define Sphere of Influence (SOI) boundaries in SU
  Nav.SOI_RADII = {
    earth: 0.28,
    mars: 0.18,
    jupiter: 0.50
  };

  /**
   * Sums the gravitational acceleration vectors acting on a position from all active celestial bodies.
   * @param {Object} pos - Current position { x, y } of the ship in SU
   * @param {number} t - Simulation time in TU (days)
   * @returns {Object} { x: ax, y: ay } acceleration in SU/TU^2
   */
  Nav.getGravityAcceleration = function(pos, t) {
    let ax = 0;
    let ay = 0;

    for (const key in Nav.BODIES) {
      const body = Nav.BODIES[key];
      const bState = Nav.bodyStateAt(body, t);

      const dx = bState.x - pos.x;
      const dy = bState.y - pos.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      // Prevent division by zero / singularity
      if (dist > 0.01) {
        // a = G * M / r^2
        const accelMag = (Nav.G * body.mass) / distSq;
        ax += (dx / dist) * accelMag;
        ay += (dy / dist) * accelMag;
      }
    }

    return { x: ax, y: ay };
  };

  /**
   * Detects the dominant gravity source (SOI) for a given position.
   * @param {Object} pos - Ship position in SU
   * @param {number} t - Current simulation time in TU
   * @returns {Object} The body { name, id, ... } matching the active SOI
   */
  Nav.detectSOI = function(pos, t) {
    let dominantBody = Nav.BODIES.SUN;
    let minDistanceRatio = Infinity; // Normalize by SOI size

    for (const key in Nav.BODIES) {
      const body = Nav.BODIES[key];
      if (body.id === "sun") continue;

      const bState = Nav.bodyStateAt(body, t);
      const dist = Nav.Vector.distance(pos, bState);
      const limit = Nav.SOI_RADII[body.id] || 0.2;

      if (dist < limit) {
        const ratio = dist / limit;
        if (ratio < minDistanceRatio) {
          minDistanceRatio = ratio;
          dominantBody = body;
        }
      }
    }

    return dominantBody;
  };

  /**
   * Performs a single numerical integration step (Velocity Verlet) for the spaceship.
   * Stability is preserved during time warp by subdividing large steps into smaller substeps.
   * @param {Object} ship - The spacecraft state object
   * @param {number} dt - Full timestep size
   * @param {number} t - Current time in TU
   * @returns {number} The updated time (t + dt)
   */
  Nav.stepSolarShip = function(ship, dt, t) {
    // Substep calculation to ensure numerical stability at high time warps
    // If dt is large, we run multiple smaller steps
    const maxSubstep = 0.05; // Maximum stable timestep size
    const stepsCount = Math.ceil(dt / maxSubstep);
    const subDt = dt / stepsCount;

    for (let step = 0; step < stepsCount; step++) {
      const currentT = t + step * subDt;
      const shipMass = ship.dryMass + ship.fuelMass;

      // 1. Acceleration at current state (gravity + thrust)
      const grav = Nav.getGravityAcceleration(ship, currentT);
      let ax = grav.x;
      let ay = grav.y;

      if (ship.thrustActive && ship.fuelMass > 0) {
        const thrustAcc = ship.thrustPower / shipMass;
        ax += Math.cos(ship.angle) * thrustAcc;
        ay += Math.sin(ship.angle) * thrustAcc;

        // Consume fuel: Fuel rate is proportional to thrust power
        const fuelBurn = ship.burnRate * subDt;
        ship.fuelMass = Math.max(0, ship.fuelMass - fuelBurn);
        if (ship.fuelMass <= 0) {
          ship.thrustActive = false;
          ship.thrustPower = 0;
        }
      }

      // 2. Velocity Verlet Position Step: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
      const nextX = ship.x + ship.vx * subDt + 0.5 * ax * subDt * subDt;
      const nextY = ship.y + ship.vy * subDt + 0.5 * ay * subDt * subDt;

      // 3. Acceleration at next state (gravity + thrust)
      const nextGrav = Nav.getGravityAcceleration({ x: nextX, y: nextY }, currentT + subDt);
      let nextAx = nextGrav.x;
      let nextAy = nextGrav.y;

      if (ship.thrustActive && ship.fuelMass > 0) {
        const thrustAcc = ship.thrustPower / shipMass;
        nextAx += Math.cos(ship.angle) * thrustAcc;
        nextAy += Math.sin(ship.angle) * thrustAcc;
      }

      // 4. Velocity Verlet Velocity Step: v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
      ship.vx += 0.5 * (ax + nextAx) * subDt;
      ship.vy += 0.5 * (ay + nextAy) * subDt;

      ship.x = nextX;
      ship.y = nextY;
    }

    return t + dt;
  };

  /**
   * Computes Specific Orbital Energy (c = v^2 / 2 - G * M / r) relative to a parent body.
   * Used for capture validation: energy < 0 implies orbit is elliptical/circular (captured).
   * @param {Object} ship - Ship state { x, y, vx, vy }
   * @param {Object} parent - Celestial body { mass, ... }
   * @param {Object} parentState - Parent state { x, y, vx, vy }
   * @returns {number} Specific orbital energy
   */
  Nav.calcSpecificEnergy = function(ship, parent, parentState) {
    const rx = ship.x - parentState.x;
    const ry = ship.y - parentState.y;
    const r = Math.sqrt(rx * rx + ry * ry);
    
    const rvx = ship.vx - parentState.vx;
    const rvy = ship.vy - parentState.vy;
    const v2 = rvx * rvx + rvy * rvy;

    if (r === 0) return Infinity;
    
    // E = v^2 / 2 - mu / r
    const mu = Nav.G * parent.mass;
    return v2 / 2 - mu / r;
  };

})(window.Nav);
