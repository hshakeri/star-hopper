// nav-bodies.js - Deterministic circular orbits for Solar System bodies
// Contains the Sun, Earth, Moon, Mars, Jupiter, and fictional mission worlds.

window.Nav = window.Nav || {};

(function(Nav) {
  // Define Solar System Bodies
  Nav.BODIES = {
    SUN: {
      name: "Sun",
      id: "sun",
      mass: 400.0,       // Large mass for central potential
      radius: 0.28,      // in SU (Space Units)
      color: "#fbbf24",  // Glowing yellow
      orbitRadius: 0.0,
      period: 1.0,
      initialAngle: 0
    },
    EARTH: {
      name: "Earth",
      id: "earth",
      mass: 1.0,         // Base Earth Mass Unit (EMU)
      radius: 0.08,      // in SU
      color: "#38bdf8",  // Clean cyber blue
      orbitRadius: 1.1,  // SU
      period: 240.0,     // 240 mission days (TU) for a full orbit
      initialAngle: 0.0  // Start at positive x-axis
    },
    MOON: {
      name: "Moon",
      id: "moon",
      mass: 0.25,
      radius: 0.055,
      color: "#94a3b8",
      orbitRadius: 1.35,
      period: 315.0,
      initialAngle: 0.55
    },
    MARS: {
      name: "Mars",
      id: "mars",
      mass: 0.15,
      radius: 0.06,      // in SU
      color: "#f87171",  // Rusty neon red
      orbitRadius: 1.7,  // SU
      period: 450.0,     // 450 mission days (TU)
      initialAngle: 1.0  // Out of phase to require transfer calculation
    },
    JUPITER: {
      name: "Jupiter",
      id: "jupiter",
      mass: 15.0,        // High mass for slingshot effects
      radius: 0.14,      // in SU
      color: "#fb923c",  // Gas giant orange
      orbitRadius: 2.5,  // SU
      period: 900.0,     // 900 mission days (TU)
      initialAngle: 2.2  // Starts far away
    },
    GLACIES: {
      name: "Glacies",
      id: "glacies",
      mass: 0.7,
      radius: 0.065,
      color: "#a78bfa",
      orbitRadius: 3.05,
      period: 1180.0,
      initialAngle: 3.1
    },
    MAGNET: {
      name: "Mag-Net",
      id: "magnet",
      mass: 0.9,
      radius: 0.07,
      color: "#ec4899",
      orbitRadius: 3.55,
      period: 1460.0,
      initialAngle: 4.0
    }
  };

  /**
   * Deterministically calculates the state (position, velocity) of a body at simulation time t.
   * @param {Object} body - One of the BODIES configs
   * @param {number} t - Current simulation time in Time Units (TU/days)
   * @returns {Object} { x, y, vx, vy } in Space Units (SU) and SU/TU
   */
  Nav.bodyStateAt = function(body, t) {
    if (body.id === "sun") {
      return { x: 0, y: 0, vx: 0, vy: 0 };
    }

    const angle = body.initialAngle + (2 * Math.PI * t) / body.period;
    const x = body.orbitRadius * Math.cos(angle);
    const y = body.orbitRadius * Math.sin(angle);

    // Circular orbit velocity magnitude: v = 2 * pi * r / T
    const v = (2 * Math.PI * body.orbitRadius) / body.period;
    
    // Velocity vector is perpendicular to position vector (counter-clockwise)
    const vx = -v * Math.sin(angle);
    const vy = v * Math.cos(angle);

    return { x, y, vx, vy };
  };

})(window.Nav);
