// retry-variants.js — "Retry Remix": same lesson, new instance.
//
// Design rule: a restart should change the *instance*, not the *lesson*. The target
// concept (the gem gate / mission stat) stays fixed, while geometry, data, the numeric
// target, AND sometimes the required *solution method* vary per attempt. This kills the
// "I'm replaying the exact same screen" feeling without invalidating the physics taught.
//
// First exposure (attempt 0) is always the CANONICAL, hand-designed layout — so the
// tutorial, mission prose, and guided walkthrough match. Remixing only kicks in on a
// RETRY (attempt >= 1). Each retry cycles a deterministic FLAVOR for that planet:
//   • geometry/target flavors — move collectibles, retune the numeric goal
//   • constraint flavors      — same gate, but a new rule on HOW you may clear it
//     (Earth: no antigravity / no jump-power / no mass-cut / engine-only · Moon: loop a spring budget / strict springs · Glacies: event rule / friction target)
// Seeded by (planetIndex, attemptNumber) so a given retry is reproducible/shareable.
//
// A flavor returns { map, variantLabel, targetOverrides, constraint }. The game reads
// targetOverrides via getAgilityTarget()/getThrustTarget() and `constraint` inside
// getGemGateForCollectible() — one place each, so HUD/gauge/gate/label stay consistent.
//
// Exposes globals (no modules): mulberry32, cloneMap, buildPlanetVariant.

// Small, fast, seedable PRNG (Tommy Ettinger's mulberry32). Deterministic per seed.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneMap(map) {
  return map.map((row) => row.slice());
}

function rvPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function rvCountTiles(map, val) {
  let n = 0;
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++) if (map[r][c] === val) n++;
  return n;
}

// Shift every tile equal to `tileVal` horizontally by `dx`, but ONLY into empty (0)
// cells and within bounds — a blocked tile stays put. Keeps collectibles in open air
// (reachable), never overlapping walls, and PRESERVES the tile count (so required-gem
// totals and saved progress stay valid).
function rvShiftTilesH(map, tileVal, dx) {
  if (!dx) return map;
  const pos = [];
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++)
      if (map[r][c] === tileVal) pos.push([r, c]);
  for (const [r, c] of pos) map[r][c] = 0; // lift them out first
  for (const [r, c] of pos) {
    const nc = c + dx;
    if (nc >= 0 && nc < map[r].length && map[r][nc] === 0) map[r][nc] = tileVal;
    else map[r][c] = tileVal; // out of bounds or occupied — restore original
  }
  return map;
}

// Shift every tile equal to `tileVal` VERTICALLY by `dy`, but ONLY into empty (0) cells
// and within bounds — a blocked tile stays put. Mirrors rvShiftTilesH: keeps collectibles
// in open air (reachable) and PRESERVES the tile count (so required-gem totals stay valid;
// any collision/out-of-bounds just restores the original cell).
function rvShiftTilesV(map, tileVal, dy) {
  if (!dy) return map;
  const pos = [];
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++)
      if (map[r][c] === tileVal) pos.push([r, c]);
  for (const [r, c] of pos) map[r][c] = 0; // lift them out first
  for (const [r, c] of pos) {
    const nr = r + dy;
    if (nr >= 0 && nr < map.length && map[nr][c] === 0) map[nr][c] = tileVal;
    else map[r][c] = tileVal; // out of bounds or occupied — restore original
  }
  return map;
}

// Swap all `a` tiles with `b` tiles (e.g. flip +/- magnetic poles).
function rvSwapTiles(map, a, b) {
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === a) map[r][c] = b;
      else if (map[r][c] === b) map[r][c] = a;
    }
  return map;
}

function rvPlaceTiles(map, tileVal, positions) {
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++)
      if (map[r][c] === tileVal) map[r][c] = 0;
  for (const [r, c] of positions) {
    if (map[r] && map[r][c] === 0) map[r][c] = tileVal;
  }
  return map;
}

const rvSign = (n) => (n > 0 ? "+" : "");

// ---- Per-planet remix flavors. Each is (planet, rng) -> partial variant. ----
// Tile legend (game.js loadPlanet): 3=gem, 4=trampoline, 5=+pole, 6=-pole.

// EARTH — mass/force/antigravity/jump arc.
function earthGeometry(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-2, -1, 1, 2]);
  rvShiftTilesH(map, 3, dx);
  const target = 28 + Math.floor(rng() * 7); // 28..34
  return {
    map,
    variantLabel: `gems shifted ${rvSign(dx)}${dx} · Agility target ${target}`,
    targetOverrides: { agility: target },
    constraint: null
  };
}
function earthNoAntigrav(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  const target = 26; // reachable with engine+jump at mass floor (≈30) — leaves margin
  return {
    map,
    variantLabel: `🚫 No antigravity — reach Agility ${target} with mass/engine/jump only`,
    targetOverrides: { agility: target },
    constraint: { id: "earth-no-antigravity", banAntigravity: true }
  };
}
function earthNoJumpPower(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  const target = 30; // reachable with stock jump by combining mass, engine, and gravity.
  return {
    map,
    variantLabel: `🚫 No jump_power — reach Agility ${target} with mass, engine, and gravity`,
    targetOverrides: { agility: target },
    constraint: { id: "earth-no-jump-power", banJumpPower: true }
  };
}
function earthNoMassCut(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  const target = 26; // stock mass can still pass with engine, jump, and lower felt gravity.
  return {
    map,
    variantLabel: `🚫 No mass cut — keep Hopper heavy and reach Agility ${target}`,
    targetOverrides: { agility: target },
    constraint: { id: "earth-no-mass-cut", banMassLower: true, minMass: 2.5 }
  };
}
function earthEngineOnly(planet, rng) {
  const map = cloneMap(planet.map);
  rvPlaceTiles(map, 3, [[6, 5], [6, 6], [6, 7], [6, 31], [6, 34], [6, 37]]);
  const target = 7; // stock Hopper + hopper.engine = 8 reaches about 7.2 Agility.
  return {
    map,
    variantLabel: `⚙️ Engine-only — set hopper.engine = 8 and leave mass/jump/gravity stock`,
    targetOverrides: { agility: target },
    constraint: {
      id: "earth-engine-only",
      engineOnly: true,
      engineMin: 8,
      banAntigravity: true,
      banJumpPower: true,
      banMassLower: true,
      banGravityOverride: true,
      minMass: 2.5
    }
  };
}

// MOON — loops & springs.
function moonGeometry(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-2, -1, 1, 2]);
  rvShiftTilesH(map, 3, dx);
  rvShiftTilesH(map, 4, rvPick(rng, [-1, 1]));
  return { map, variantLabel: `canyon gems shifted ${rvSign(dx)}${dx}`, targetOverrides: {}, constraint: null };
}
function moonSpringBudget(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  const n = 4; // a bigger loop than the standard 3
  return {
    map,
    variantLabel: `🔁 Loop budget — spawn ${n} springs with a repeat loop`,
    targetOverrides: {},
    constraint: { id: "moon-spring-budget", springCount: n }
  };
}

// JUPITER — force/mass/thrust.
function jupiterGeometry(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-2, -1, 1, 2]);
  rvShiftTilesH(map, 3, dx);
  const target = 42 + Math.floor(rng() * 7); // 42..48
  return {
    map,
    variantLabel: `crates shifted ${rvSign(dx)}${dx} · Thrust target ${target}`,
    targetOverrides: { thrust: target },
    constraint: null
  };
}

// GLACIES — friction & conditionals.
function glaciesGeometry(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-2, -1, 1, 2]);
  rvShiftTilesH(map, 3, dx);
  return { map, variantLabel: `ice gems shifted ${rvSign(dx)}${dx}`, targetOverrides: {}, constraint: null };
}
function glaciesEventOnly(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  return {
    map,
    variantLabel: `❄️ Event-only — recover grip with a when player.touching('ice') rule`,
    targetOverrides: {},
    constraint: { id: "glacies-event-only", requireIceRule: true }
  };
}

// MAG-NET — events & polarity.
function magnetPoleFlip(planet, rng) {
  const map = cloneMap(planet.map);
  rvSwapTiles(map, 5, 6);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "poles flipped — re-check attraction vs repulsion!", targetOverrides: {}, constraint: null };
}

// ---- Phase 2: additional GEOMETRY/TARGET flavors (constraint: null) ----
// These add deep run-to-run variety with ZERO new enforcement code (they only move
// collectibles and/or retune the numeric target), so they can never soft-lock a level.
// They specifically give Jupiter and Mag-Net (previously 1 flavor each = identical
// retries) a real rotation. All preserve the gem count via the buildPlanetVariant safety net.

// EARTH — vertical + mixed gem drift, and harder/easier Agility targets.
function earthVerticalShift(planet, rng) {
  const map = cloneMap(planet.map);
  const dy = rvPick(rng, [-1, 1]);
  rvShiftTilesV(map, 3, dy);
  const target = 29 + Math.floor(rng() * 5); // 29..33
  return { map, variantLabel: `gems drift ${dy < 0 ? "up" : "down"} · Agility target ${target}`, targetOverrides: { agility: target }, constraint: null };
}
function earthMixedShift(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-1, 1]);
  const dy = rvPick(rng, [-1, 1]);
  rvShiftTilesH(map, 3, dx);
  rvShiftTilesV(map, 3, dy);
  const target = 27 + Math.floor(rng() * 8); // 27..34
  return { map, variantLabel: `gems shifted ${rvSign(dx)}${dx}h ${rvSign(dy)}${dy}v · Agility ${target}`, targetOverrides: { agility: target }, constraint: null };
}

// MOON — vertical gem drift and a trampoline+gem reshuffle.
function moonVerticalGems(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "canyon gems re-floated · new heights", targetOverrides: {}, constraint: null };
}
function moonTrampolineMixer(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-2, -1, 1, 2]));
  rvShiftTilesH(map, 4, rvPick(rng, [-1, 1]));
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "gems and launchpads scattered · plan a new route", targetOverrides: {}, constraint: null };
}
function moonStrictSpringLoop(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesH(map, 4, rvPick(rng, [-1, 1]));
  const n = 5;
  return {
    map,
    variantLabel: `🔁 Strict spring loop — repeat-spawn ${n} springs, then tune jump`,
    targetOverrides: {},
    constraint: { id: "moon-strict-spring", springCount: n, requireRepeatSpring: true }
  };
}

// JUPITER — was a single flavor. Add vertical drift + a tougher thrust push.
function jupiterVerticalCrates(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  const target = 43 + Math.floor(rng() * 6); // 43..48
  return { map, variantLabel: `samples re-stacked · Thrust target ${target}`, targetOverrides: { thrust: target }, constraint: null };
}
function jupiterThrustPush(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-2, -1, 1, 2]));
  const target = 49 + Math.floor(rng() * 4); // 49..52 — a real engineering stretch
  return { map, variantLabel: `⚡ Heavy haul — push Thrust to ${target} (lighter mass + more rocket)`, targetOverrides: { thrust: target }, constraint: null };
}
function jupiterRocketRule(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  const target = 46 + Math.floor(rng() * 4); // 46..49 — feasible, with an event-rule twist
  return {
    map,
    variantLabel: `🚀 Rocket timing — reach Thrust ${target} and add a when hopper.rocket_on rule`,
    targetOverrides: { thrust: target },
    constraint: { id: "jupiter-rocket-rule", requireRocketRule: true }
  };
}

// GLACIES — vertical drift on the slippery slopes.
function glaciesVerticalSlide(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "ice gems re-placed · re-read the slide", targetOverrides: {}, constraint: null };
}
function glaciesFrictionTarget(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  const minFriction = rvPick(rng, [7, 8]);
  return {
    map,
    variantLabel: `🧊 Friction target — set friction = ${minFriction}+ before crossing ice`,
    targetOverrides: {},
    constraint: { id: "glacies-friction-target", minFriction }
  };
}

// MAG-NET — was a single flavor. Add a maybe-flip and a gem drift (poles stay put so the
// magnetic puzzle structure remains solvable).
function magnetDoubleFlip(planet, rng) {
  const map = cloneMap(planet.map);
  if (rvPick(rng, [true, false])) rvSwapTiles(map, 5, 6);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "field may be inverted — re-check attraction vs repulsion", targetOverrides: {}, constraint: null };
}
function magnetGemDrift(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  return { map, variantLabel: "magenta shard relocated along the tracks", targetOverrides: {}, constraint: null };
}
function magnetPolarityEvent(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
  return {
    map,
    variantLabel: "🧲 Polarity event — switch pole with when player.touching('magnet')",
    targetOverrides: {},
    constraint: { id: "magnet-polarity-event", requireMagnetTouchRule: true }
  };
}

// ASTEROID FORGE — momentum first, elasticity second. These stay geometry-only:
// moving Forge cores and asteroids keeps the same two-variable lesson without adding
// a third rule that would muddy the onboarding sequence.
function forgeCoreDrift(planet, rng) {
  const map = cloneMap(planet.map);
  const dx = rvPick(rng, [-2, -1, 1, 2]);
  rvShiftTilesH(map, 3, dx);
  rvShiftTilesH(map, 8, rvPick(rng, [-1, 1]));
  return { map, variantLabel: `Forge cores drifted ${rvSign(dx)}${dx} · redo the mass shove`, targetOverrides: {}, constraint: null };
}
function forgeBounceMixer(planet, rng) {
  const map = cloneMap(planet.map);
  rvShiftTilesV(map, 3, rvPick(rng, [-1, 1]));
  rvShiftTilesH(map, 8, rvPick(rng, [-2, -1, 1, 2]));
  return { map, variantLabel: "asteroids re-stacked · test mass first, then elasticity", targetOverrides: {}, constraint: null };
}

// Flavor rotation per planet. Retry N (1-based) uses flavor (N-1) % flavors.length, so
// consecutive retries deal out DIFFERENT challenge types, then cycle. Ordering: hand-tuned
// constraint flavors stay early (they match existing tutorial prose); pure procedural
// geometry/target flavors fill out the rotation for depth.
const PLANET_FLAVORS = {
  0: [earthGeometry, earthNoAntigrav, earthVerticalShift, earthMixedShift, earthNoJumpPower, earthNoMassCut, earthEngineOnly],
  1: [moonGeometry, moonSpringBudget, moonVerticalGems, moonTrampolineMixer, moonStrictSpringLoop],
  2: [jupiterGeometry, jupiterVerticalCrates, jupiterThrustPush, jupiterRocketRule],
  3: [glaciesGeometry, glaciesEventOnly, glaciesVerticalSlide, glaciesFrictionTarget],
  4: [magnetPoleFlip, magnetDoubleFlip, magnetGemDrift, magnetPolarityEvent],
  5: [forgeCoreDrift, forgeBounceMixer]
};

// Build the variant for a given planet + attempt.
//   { map, variantLabel, targetOverrides, constraint, isRemix }
function buildPlanetVariant(planet, planetIndex, attemptNumber) {
  const standard = {
    map: cloneMap(planet.map),
    variantLabel: "standard",
    targetOverrides: {},
    constraint: null,
    isRemix: false
  };
  // First exposure stays canonical so the tutorial/mission text lines up.
  if (!attemptNumber || attemptNumber < 1) return standard;

  const flavors = PLANET_FLAVORS[planetIndex];
  if (!flavors || !flavors.length) return standard;

  const seed = (planetIndex + 1) * 10007 + attemptNumber * 7919;
  const rng = mulberry32(seed);
  const flavor = flavors[(attemptNumber - 1) % flavors.length];
  const baseGems = rvCountTiles(planet.map, 3);
  const r = flavor(planet, rng);

  // Safety net: a remix must never change the required-gem count (else progress/gates
  // could soft-lock). Fall back to the canonical layout if a transform ever miscounts.
  if (rvCountTiles(r.map, 3) !== baseGems) return standard;

  return {
    map: r.map,
    variantLabel: r.variantLabel,
    targetOverrides: r.targetOverrides || {},
    constraint: r.constraint || null,
    isRemix: true
  };
}

// ---- Daily Signal: one seeded remix per real-world day, same for everyone. ----
// No servers needed: the date hashes to a seed, the seed picks a playable world and
// an attempt number, and buildPlanetVariant does the rest. Deterministic, shareable.

// FNV-1a over 'YYYY-MM-DD' — stable across sessions and machines.
function dateSeed(dateStr) {
  const s = String(dateStr);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build today's signal. `planets` = PLANETS array; `maxPlanetIndex` = the highest
// world this cadet can play (0 until they clear Earth), so the daily is never locked.
function getDailySignal(planets, dateStr, maxPlanetIndex) {
  const seed = dateSeed(dateStr);
  const pool = Math.max(0, Math.min(4, maxPlanetIndex == null ? 0 : maxPlanetIndex));
  const planetIndex = seed % (pool + 1);
  const attempt = 1 + (seed % 97); // >= 1, so it's always a remix
  const planet = planets[planetIndex];
  const variant = buildPlanetVariant(planet, planetIndex, attempt);
  const codeName = (planet.name || "WORLD").split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "");
  const concept = planet.tagline || "Physics remix";
  return {
    dateStr,
    seed,
    planetIndex,
    attempt,
    variant,
    planetName: planet.name || "World",
    concept,
    labGoal: "3 Lab Stars: tasks + samples + proof",
    shareCode: `${codeName}-${seed % 10000}`,
    label: `${planet.name} remix #${seed % 10000}: ${variant.variantLabel}`
  };
}

// Make available to the non-module browser globals + node test harness.
if (typeof window !== "undefined") {
  window.mulberry32 = mulberry32;
  window.cloneMap = cloneMap;
  window.buildPlanetVariant = buildPlanetVariant;
  window.dateSeed = dateSeed;
  window.getDailySignal = getDailySignal;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { mulberry32, cloneMap, buildPlanetVariant, dateSeed, getDailySignal };
}
