// nav-missions.js - Planetary transfer missions for Solar Navigator mode
// Outlines Hohmann Transfer and gravity assist challenges to verify ship achievements.

window.Nav = window.Nav || {};

(function(Nav) {
  Nav.activeMissionIndex = 0;
  Nav.orbitalMissionsCompleted = new Set();

  function getLaunchStateNearBody(body, offsetX, offsetY) {
    const bodyState = Nav.bodyStateAt(body, 0);
    const offsetDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const localMu = Nav.G * body.mass;
    const localSpeed = offsetDistance > 0 ? Math.sqrt(localMu / offsetDistance) : 0;
    const tangentX = offsetDistance > 0 ? -offsetY / offsetDistance : 0;
    const tangentY = offsetDistance > 0 ? offsetX / offsetDistance : 1;

    return {
      x: bodyState.x + offsetX,
      y: bodyState.y + offsetY,
      vx: bodyState.vx + tangentX * localSpeed,
      vy: bodyState.vy + tangentY * localSpeed
    };
  }

  function makeRouteMission(config) {
    return {
      id: config.id,
      title: config.title,
      concept: config.concept,
      objective: config.objective,
      originId: config.originId,
      destinationId: config.destinationId,
      targetPlanetIndex: config.targetPlanetIndex,
      arrivalTolerance: config.arrivalTolerance,
      maxFuelFor3Star: config.maxFuelFor3Star,
      maxLinesFor3Star: config.maxLinesFor3Star,
      starterCode: config.starterCode,
      setup: function() {
        const origin = Nav.BODIES[config.originId.toUpperCase()];
        const launch = getLaunchStateNearBody(origin, 0.12, 0.12);

        Nav.initShip(
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
          Math.atan2(launch.vy, launch.vx),
          1.0,
          config.fuelMass || 2.2,
          config.burnRate || 0.045
        );
        Nav.ship.routeOriginId = config.originId;
        Nav.ship.routeTargetId = config.destinationId;
        Nav.ship.routeMinimumTime = config.minimumTime || 20;
        Nav.ship.minApproach = Infinity;
        Nav.ship.enteredDestinationSOI = false;
      },
      // Real-physics validation: the plan's SIMULATED trajectory must actually carry the
      // ship near the destination and burn real fuel. (Replaces the old text-match that
      // passed if the command string merely contained the destination word — spoofable.)
      validate: function(ship, t) {
        const destination = Nav.BODIES[config.destinationId.toUpperCase()];
        const dState = Nav.bodyStateAt(destination, t);
        const dist = Nav.Vector.distance(ship, dState);
        const soi = Nav.SOI_RADII[destination.id] || 0.22;

        ship.minApproach = Math.min(ship.minApproach !== undefined ? ship.minApproach : Infinity, dist);
        if (dist < soi) ship.enteredDestinationSOI = true;

        const commandFinished = Nav.commandQueue.length === 0 && !Nav.currentAction;
        const flightLongEnough = t >= (config.minimumTime || 20);
        const realBurn = (ship.maxFuel - ship.fuelMass) > (config.minFuelBurn || 0.05);
        const arrived = ship.enteredDestinationSOI || ship.minApproach < soi * (config.arrivalTolerance || 3.0);

        return commandFinished && flightLongEnough && realBurn && arrived;
      }
    };
  }

  Nav.Missions = [
    makeRouteMission({
      id: "route-earth-moon",
      title: "Earth to Moon Transfer",
      concept: "Simple route bridge: point, thrust, coast",
      objective: "Run the short launch plan so the spacecraft carries Rover from Earth to Moon.",
      originId: "earth",
      destinationId: "moon",
      targetPlanetIndex: 1,
      minimumTime: 18,
      arrivalTolerance: 2.1,
      maxFuelFor3Star: 0.80,
      maxLinesFor3Star: 6,
      starterCode: "warp(3)\nrepeat 4:\n  point_at('moon')\n  thrust(12, 5)\n  wait(6)"
    }),
    makeRouteMission({
      id: "route-moon-jupiter",
      title: "Moon to Jupiter Transfer",
      concept: "Simple route bridge: aim, burn, time warp",
      objective: "Run the launch plan to carry Rover from Moon orbit to Jupiter.",
      originId: "moon",
      destinationId: "jupiter",
      targetPlanetIndex: 2,
      minimumTime: 45,
      arrivalTolerance: 2.7,
      maxFuelFor3Star: 1.55,
      maxLinesFor3Star: 6,
      starterCode: "warp(3)\nrepeat 8:\n  point_at('jupiter')\n  thrust(8, 5)\n  wait(6)"
    }),
    makeRouteMission({
      id: "route-jupiter-glacies",
      title: "Jupiter to Glacies Transfer",
      concept: "Simple route bridge: aim, burn, coast",
      objective: "Run the launch plan to carry Rover from Jupiter to the icy Glacies survey zone.",
      originId: "jupiter",
      destinationId: "glacies",
      targetPlanetIndex: 3,
      minimumTime: 55,
      arrivalTolerance: 1.2,
      maxFuelFor3Star: 1.25,
      maxLinesFor3Star: 6,
      starterCode: "warp(3)\nrepeat 8:\n  point_at('glacies')\n  thrust(10, 4)\n  wait(12)"
    }),
    makeRouteMission({
      id: "route-glacies-magnet",
      title: "Glacies to Mag-Net Transfer",
      concept: "Simple route bridge: final approach",
      objective: "Run the launch plan to carry Rover from Glacies to the Mag-Net field.",
      originId: "glacies",
      destinationId: "magnet",
      targetPlanetIndex: 4,
      minimumTime: 45,
      arrivalTolerance: 5.3,
      fuelMass: 3.5,
      maxFuelFor3Star: 2.40,
      maxLinesFor3Star: 6,
      starterCode: "warp(3)\nrepeat 12:\n  point_at('magnet')\n  thrust(12, 5)\n  wait(6)"
    }),
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
        const launch = getLaunchStateNearBody(earth, 0.12, 0.12);
        
        Nav.initShip(
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
          Math.atan2(launch.vy, launch.vx),
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
        const launch = getLaunchStateNearBody(earth, 0.12, 0.12);

        Nav.initShip(
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
          Math.atan2(launch.vy, launch.vx),
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
    },
    {
      // The payoff of unifying the two modes: this mission can ONLY be solved with a
      // loop. A single big burn can't satisfy burnCount >= 4 — you must `repeat` small
      // burns to spiral out to Jupiter, the same loop kids first learned on the Moon.
      id: "sol-spiral-climb",
      title: "Spiral Climb (Loop Required)",
      concept: "Loops & Iteration — repeated burns raise an orbit",
      objective: "One giant burn won't be enough on its own. Use a repeat loop to fire several small burns and spiral out to Jupiter — the same loop you learned on the Moon.",
      originId: "earth",
      destinationId: "jupiter",
      arrivalTolerance: 4.0,
      minBurns: 4,
      maxFuelFor3Star: 0.52,
      maxLinesFor3Star: 5,
      starterCode: "point_at('jupiter')\nrepeat 5:\n  point_at('jupiter')\n  thrust(4, 3)\n  wait(14)",
      setup: function() {
        const earth = Nav.BODIES.EARTH;
        const launch = getLaunchStateNearBody(earth, 0.12, 0.12);

        Nav.initShip(
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
          Math.atan2(launch.vy, launch.vx),
          1.0,  // dryMass
          3.0,  // fuelMass (plenty for several small burns)
          0.04  // burnRate
        );
        Nav.ship.minApproach = Infinity;
        Nav.ship.enteredDestinationSOI = false;
      },
      validate: function(ship, t) {
        const dest = Nav.BODIES.JUPITER;
        const dState = Nav.bodyStateAt(dest, t);
        const dist = Nav.Vector.distance(ship, dState);
        const soi = Nav.SOI_RADII.jupiter;

        ship.minApproach = Math.min(ship.minApproach !== undefined ? ship.minApproach : Infinity, dist);
        if (dist < soi) ship.enteredDestinationSOI = true;

        const commandFinished = Nav.commandQueue.length === 0 && !Nav.currentAction;
        const flightLongEnough = t >= 40;
        const usedLoop = (ship.burnCount || 0) >= 4; // a single thrust() can't reach this
        const arrived = ship.enteredDestinationSOI || ship.minApproach < soi * 4.0;

        return commandFinished && flightLongEnough && usedLoop && arrived;
      }
    }
  ];

  Nav.RouteMissionByTargetPlanet = {};
  Nav.Missions.forEach((mission, index) => {
    if (typeof mission.targetPlanetIndex === "number") {
      Nav.RouteMissionByTargetPlanet[mission.targetPlanetIndex] = index;
    }
  });

  // Grades a completed flight on efficiency: 1★ for arriving, +1★ for beating the fuel
  // par, +1★ for beating the line-count par (which rewards a loop over hardcoded burns).
  // Counts non-empty plan lines from the last executed flight plan.
  Nav.missionStars = {};
  Nav.computeStars = function(mission) {
    const fuelUsed = Nav.ship ? (Nav.ship.maxFuel - Nav.ship.fuelMass) : 0;
    const lines = String(Nav.lastCommandString || "")
      .split("\n").map(s => s.trim()).filter(s => s.length > 0).length;
    let stars = 1; // reached the destination safely
    if (mission && mission.maxFuelFor3Star && fuelUsed <= mission.maxFuelFor3Star) stars++;
    if (mission && mission.maxLinesFor3Star && lines > 0 && lines <= mission.maxLinesFor3Star) stars++;
    return {
      stars,
      fuelUsed,
      lines,
      fuelPar: mission ? mission.maxFuelFor3Star : null,
      linePar: mission ? mission.maxLinesFor3Star : null,
    };
  };

  Nav.loadRouteToPlanet = function(originPlanetIndex, targetPlanetIndex) {
    const missionIndex = Nav.RouteMissionByTargetPlanet[targetPlanetIndex];
    if (typeof missionIndex !== "number") return false;

    Nav.activeMissionIndex = missionIndex;
    if (typeof loadNavigatorMissionSolar === "function") {
      loadNavigatorMissionSolar(missionIndex);
    }

    const mission = Nav.Missions[missionIndex];
    Nav.logConsole(`Rover secured. Navigation handoff: planet ${originPlanetIndex + 1} → planet ${targetPlanetIndex + 1}.`, "info");
    Nav.logConsole(`Run or edit the flight plan to reach ${Nav.BODIES[mission.destinationId.toUpperCase()].name}.`, "info");
    return true;
  };

})(window.Nav);
