// nav-missions.js - Planetary transfer missions for Solar Navigator mode
// Outlines Hohmann Transfer and gravity assist challenges to verify ship achievements.

window.Nav = window.Nav || {};

(function(Nav) {
  Nav.activeMissionIndex = 0;
  Nav.orbitalMissionsCompleted = new Set();

  Nav.Missions = [
    {
      id: "sol-hohmann-mars",
      title: "Hohmann Transfer to Mars",
      concept: "Heliocentric Transfers & Orbit Insertion",
      objective: "Calculate planetary alignment, launch from Earth orbit, fly to Mars, and burn retro to insert into Mars orbit (stable orbit energy < 0).",
      originId: "earth",
      destinationId: "mars",
      starterCode: "wait(35); point_at('mars'); thrust(3.5, 6.0); wait(65); point_at('sun'); thrust(2.0, 4.0); wait(40);",
      setup: function() {
        const earth = Nav.BODIES.EARTH;
        const eState = Nav.bodyStateAt(earth, 0);
        // Circular orbit velocity around the Sun
        const r = earth.orbitRadius;
        const vCirc = Math.sqrt((Nav.G * Nav.BODIES.SUN.mass) / r);
        
        // Start in orbit around Earth (small offset and orbital velocity relative to Sun)
        const vx = -vCirc * Math.sin(earth.initialAngle);
        const vy = vCirc * Math.cos(earth.initialAngle);
        
        Nav.initShip(
          eState.x + 0.12, 
          eState.y + 0.12, 
          vx + 0.08, 
          vy + 0.08, 
          Math.atan2(vy, vx), 
          1.0,  // dryMass
          2.0,  // fuelMass
          0.04  // burnRate (fuel consumed per day of full thrust)
        );
        Nav.ship.passedTargetSOI = false;
      },
      validate: function(ship, t) {
        const mars = Nav.BODIES.MARS;
        const mState = Nav.bodyStateAt(mars, t);
        const dist = Nav.Vector.distance(ship, mState);
        const energy = Nav.calcSpecificEnergy(ship, mars, mState);

        // Captured in Mars SOI with negative relative energy (stable closed orbit)
        return dist < Nav.SOI_RADII.mars && energy < 0;
      }
    },
    {
      id: "sol-jupiter-slingshot",
      title: "Jupiter Gravity Assist",
      concept: "Slingshot Acceleration & Heliocentric Escape",
      objective: "Burn to target Jupiter, fly through Jupiter's massive gravity field, and slingshot to solar escape velocity (speed > 2.5 SU/day).",
      originId: "earth",
      destinationId: "jupiter",
      starterCode: "wait(12); point_at('jupiter'); thrust(4.5, 8.0); wait(150);",
      setup: function() {
        const earth = Nav.BODIES.EARTH;
        const eState = Nav.bodyStateAt(earth, 0);
        const r = earth.orbitRadius;
        const vCirc = Math.sqrt((Nav.G * Nav.BODIES.SUN.mass) / r);
        const vx = -vCirc * Math.sin(earth.initialAngle);
        const vy = vCirc * Math.cos(earth.initialAngle);

        Nav.initShip(
          eState.x + 0.12,
          eState.y + 0.12,
          vx + 0.1,
          vy + 0.1,
          Math.atan2(vy, vx),
          1.0,  // dryMass
          2.5,  // fuelMass
          0.05  // burnRate
        );
        Nav.ship.passedJupiterSOI = false;
      },
      validate: function(ship, t) {
        const jupiter = Nav.BODIES.JUPITER;
        const jState = Nav.bodyStateAt(jupiter, t);
        const dist = Nav.Vector.distance(ship, jState);

        if (dist < Nav.SOI_RADII.jupiter) {
          ship.passedJupiterSOI = true;
        }

        const sunSpeed = Nav.Vector.magnitude({ x: ship.vx, y: ship.vy });
        
        // Success if they entered Jupiter SOI and exited with high speed
        return ship.passedJupiterSOI && dist > Nav.SOI_RADII.jupiter && sunSpeed > 2.5;
      }
    }
  ];

})(window.Nav);
