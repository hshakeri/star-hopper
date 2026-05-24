// nav-transfer.js - Analytical Hohmann Transfer orbital calculator
// Computes transfer windows, delta-v requirements, and phase alignment angles.

window.Nav = window.Nav || {};

(function(Nav) {
  /**
   * Computes Hohmann transfer telemetry between two circular orbits around the Sun.
   * @param {Object} fromBody - Origin body (e.g. Earth)
   * @param {Object} toBody - Destination body (e.g. Mars)
   * @returns {Object} Hohmann transfer telemetry details
   */
  Nav.computeTransfer = function(fromBody, toBody) {
    const r1 = fromBody.orbitRadius;
    const r2 = toBody.orbitRadius;
    const mu = Nav.G * Nav.BODIES.SUN.mass;

    // 1. Semi-major axis of the elliptical transfer orbit
    const a = (r1 + r2) / 2;

    // 2. Circular velocities at origin and destination
    const vCircular1 = Math.sqrt(mu / r1);
    const vCircular2 = Math.sqrt(mu / r2);

    // 3. Velocities at periapsis and apoapsis of the transfer orbit
    const vPeriapsis = Math.sqrt(mu * (2 / r1 - 1 / a));
    const vApoapsis = Math.sqrt(mu * (2 / r2 - 1 / a));

    // 4. Burn requirements
    const deltaV1 = Math.abs(vPeriapsis - vCircular1);
    const deltaV2 = Math.abs(vCircular2 - vApoapsis);
    const totalDeltaV = deltaV1 + deltaV2;

    // 5. Time of flight (half the period of the transfer ellipse)
    // T = 2 * pi * sqrt(a^3 / mu)
    const timeOfFlight = Math.PI * Math.sqrt(Math.pow(a, 3) / mu);

    // 6. Target phase angle at launch (radians)
    // Destination angular velocity: omega = 2 * pi / T
    const omega2 = (2 * Math.PI) / toBody.period;
    
    // Angle swept by destination during flight
    const sweptAngle = omega2 * timeOfFlight;
    
    // Required phase angle (destination lead angle relative to origin)
    // For outer planets: phi = pi - sweptAngle
    // For inner planets: phi = pi + sweptAngle (or lead in direction of rotation)
    const targetPhaseAngleRad = Nav.Angle.normalize(Math.PI - sweptAngle);
    const targetPhaseAngleDeg = (targetPhaseAngleRad * 180) / Math.PI;

    return {
      r1,
      r2,
      a,
      vCircular1,
      vCircular2,
      deltaV1,
      deltaV2,
      totalDeltaV,
      timeOfFlight,
      targetPhaseAngleRad,
      targetPhaseAngleDeg
    };
  };

  /**
   * Calculates the current alignment phase angle between two bodies.
   * @param {Object} fromBody
   * @param {Object} toBody
   * @param {number} t - Current simulation time in TU
   * @returns {Object} { rad, deg } current phase angle
   */
  Nav.getCurrentPhaseAngle = function(fromBody, toBody, t) {
    const stateFrom = Nav.bodyStateAt(fromBody, t);
    const stateTo = Nav.bodyStateAt(toBody, t);

    const angleFrom = Math.atan2(stateFrom.y, stateFrom.x);
    const angleTo = Math.atan2(stateTo.y, stateTo.x);

    // Angle of target relative to origin (destination leading origin)
    const diffRad = Nav.Angle.normalize(angleTo - angleFrom);
    const diffDeg = (diffRad * 180) / Math.PI;

    return {
      rad: diffRad,
      deg: diffDeg
    };
  };

})(window.Nav);
