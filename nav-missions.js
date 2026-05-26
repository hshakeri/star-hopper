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

  function commandPlanTargetsDestination(destinationId) {
    const commandText = (Nav.lastCommandString || "").toLowerCase();
    return commandText.includes(destinationId) &&
      commandText.includes("thrust") &&
      commandText.includes("wait");
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
      },
      validate: function(ship, t) {
        const destination = Nav.BODIES[config.destinationId.toUpperCase()];
        const dState = Nav.bodyStateAt(destination, t);
        const dist = Nav.Vector.distance(ship, dState);
        const soi = Nav.SOI_RADII[destination.id] || 0.22;

        if (dist < soi) {
          ship.enteredDestinationSOI = true;
        }

        const commandFinished = Nav.commandQueue.length === 0 && !Nav.currentAction;
        const routePlanComplete = commandPlanTargetsDestination(config.destinationId);
        const flightLongEnough = t >= (config.minimumTime || 20);

        return commandFinished && routePlanComplete && flightLongEnough &&
          (ship.enteredDestinationSOI || dist < soi * 2.5 || config.planCertificationOnly);
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
      planCertificationOnly: true,
      starterCode: "point_at('moon'); thrust(4.0, 4.0); wait(24);"
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
      planCertificationOnly: true,
      starterCode: "point_at('jupiter'); thrust(5.0, 7.0); warp(5); wait(60);"
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
      planCertificationOnly: true,
      starterCode: "point_at('glacies'); thrust(4.5, 6.0); warp(5); wait(70);"
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
      planCertificationOnly: true,
      starterCode: "point_at('magnet'); thrust(3.8, 5.0); warp(5); wait(55);"
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
    }
  ];

  Nav.RouteMissionByTargetPlanet = {};
  Nav.Missions.forEach((mission, index) => {
    if (typeof mission.targetPlanetIndex === "number") {
      Nav.RouteMissionByTargetPlanet[mission.targetPlanetIndex] = index;
    }
  });

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
