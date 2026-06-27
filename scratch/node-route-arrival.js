// node-route-arrival.js — Phase-A gate test for the KidCode→ship bridge.
//
// Proves every Navigator route mission (and the loop-only Spiral Climb) is WINNABLE:
// its starter flight plan, compiled through KidCode and flown through the real
// Velocity-Verlet physics, must actually bring the ship near the destination and burn
// real fuel — within each mission's arrivalTolerance. This is the gate for the
// real-physics validation in nav-missions.js: if a route can't arrive, it would
// soft-lock the campaign (route completion is the only path between planets).
//
// Faithfully mirrors updateNavigator(): physics + validate() run ONLY while the command
// queue is active, so the closest approach must happen during the plan (the final wait
// is the coast). Usage: node scratch/node-route-arrival.js
'use strict';
const fs = require('fs');
const path = require('path');
const basePath = path.resolve(__dirname, '..');

// --- Minimal browser-ish globals (no canvas/DOM needed — pure physics) ---
global.window = global;
global.window.addEventListener = () => {};
global.performance = { now: () => 0 };          // keeps the interpreter wall-clock guard inert
global.document = { getElementById: () => null }; // Nav.logConsole guards a null element
global.SFX = new Proxy({}, { get: () => () => {} });
// SPEECH intentionally left undefined — nav code guards `typeof SPEECH !== 'undefined'`.

const files = [
  'interpreter.js', 'nav-core.js', 'nav-bodies.js', 'nav-physics.js',
  'nav-ship.js', 'nav-missions.js',
];
const bundle = files.map((f) => fs.readFileSync(path.join(basePath, f), 'utf8')).join('\n');
eval(bundle);

const Nav = global.Nav;

function distToBody(body, t) {
  const s = Nav.bodyStateAt(body, t);
  return Nav.Vector.distance(Nav.ship, s);
}

// Fly one mission exactly as updateNavigator would, returning measured telemetry.
function flyMission(mission) {
  mission.setup();
  Nav.runKidCodePlan(mission.starterCode);

  const dest = Nav.BODIES[mission.destinationId.toUpperCase()];
  const soi = Nav.SOI_RADII[dest.id] || 0.22;

  let passed = false;
  let crashedOn = null;
  let safety = 0;
  const SAFETY_MAX = 2000000;

  while (safety < SAFETY_MAX) {
    // Block condition checked BEFORE processing — mirrors updateNavigator so validate()
    // still fires on the frame the final action drains the queue.
    const active = (Nav.commandQueue.length > 0 || Nav.currentAction || Nav.cruising);
    if (!active) break; // plan done and not cruising → in-game the ship would freeze here

    const dt = 0.1 * Nav.timeWarpFactor;
    Nav.processFlightQueue(dt, Nav.ship.timeElapsed);
    Nav.ship.timeElapsed = Nav.stepSolarShip(Nav.ship, dt, Nav.ship.timeElapsed);

    // Collision with a star/planet body = burn-up (the real loop reloads the mission).
    for (const key in Nav.BODIES) {
      const body = Nav.BODIES[key];
      if (distToBody(body, Nav.ship.timeElapsed) < body.radius) { crashedOn = body.name; break; }
    }
    if (crashedOn) break;

    if (mission.validate(Nav.ship, Nav.ship.timeElapsed)) { passed = true; Nav.cruising = true; break; }
    safety++;
  }

  const fuelUsed = Nav.ship.maxFuel - Nav.ship.fuelMass;
  return {
    title: mission.title,
    dest: dest.name,
    soi,
    minApproach: Nav.ship.minApproach,
    ratio: Nav.ship.minApproach / soi,
    tolerance: mission.arrivalTolerance || 3.0,
    burnCount: Nav.ship.burnCount || 0,
    minBurns: mission.minBurns || 0,
    fuelUsed,
    timeElapsed: Nav.ship.timeElapsed,
    passed,
    crashedOn,
  };
}

console.log('\n--- Route Arrival Gate (KidCode flight plans → real physics) ---\n');

let allPass = true;
Nav.Missions.forEach((m) => {
  // Only route bridges + the loop-only spiral are gated here (advanced Mars/Jupiter
  // missions already use bespoke real-physics validation and aren't campaign gates).
  const isGated = typeof m.targetPlanetIndex === 'number' || m.id === 'sol-spiral-climb';
  if (!isGated) return;

  const r = flyMission(m);
  const ok = r.passed && !r.crashedOn && (r.minBurns === 0 || r.burnCount >= r.minBurns);
  if (!ok) allPass = false;

  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  const crash = r.crashedOn ? ` CRASHED on ${r.crashedOn}` : '';
  console.log(
    `${tag} ${r.title.padEnd(30)} → ${r.dest.padEnd(8)} ` +
    `ratio=${r.ratio.toFixed(2)}× (tol ${r.tolerance}×)  ` +
    `burns=${r.burnCount}${r.minBurns ? '/' + r.minBurns : ''}  ` +
    `fuel=${r.fuelUsed.toFixed(3)}  t=${Math.round(r.timeElapsed)}d  ` +
    `validate=${r.passed}${crash}`
  );
});

console.log('');
console.log(allPass ? '\x1b[32mAll gated routes arrive ✓\x1b[0m' : '\x1b[31mSome routes do not arrive — tune starterCode/arrivalTolerance.\x1b[0m');
process.exit(allPass ? 0 : 1);
