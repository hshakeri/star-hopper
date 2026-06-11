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
//     (Earth: no antigravity · Moon: loop a spring budget · Glacies: event-rule only)
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

// Swap all `a` tiles with `b` tiles (e.g. flip +/- magnetic poles).
function rvSwapTiles(map, a, b) {
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === a) map[r][c] = b;
      else if (map[r][c] === b) map[r][c] = a;
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

// Flavor rotation per planet. Retry N (1-based) uses flavor (N-1) % flavors.length, so
// consecutive retries deal out DIFFERENT challenge types, then cycle.
const PLANET_FLAVORS = {
  0: [earthGeometry, earthNoAntigrav],
  1: [moonGeometry, moonSpringBudget],
  2: [jupiterGeometry],
  3: [glaciesGeometry, glaciesEventOnly],
  4: [magnetPoleFlip]
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

// Make available to the non-module browser globals + node test harness.
if (typeof window !== "undefined") {
  window.mulberry32 = mulberry32;
  window.cloneMap = cloneMap;
  window.buildPlanetVariant = buildPlanetVariant;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { mulberry32, cloneMap, buildPlanetVariant };
}
