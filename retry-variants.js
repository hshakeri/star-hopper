// retry-variants.js — "Retry Remix": same lesson, new instance.
//
// Design rule: a restart should change the *instance*, not the *lesson*. The target
// concept (the gem gate / mission stat) stays fixed, while geometry, data, and the
// numeric target vary a little per attempt. This kills the "I'm replaying the exact
// same screen" feeling without ever invalidating the physics being taught.
//
// First exposure (attempt 0) is always the CANONICAL, hand-designed layout — so the
// tutorial, mission prose, and guided walkthrough match. Remixing only kicks in on a
// RETRY (attempt >= 1), seeded by (planetIndex, attemptNumber) so it's deterministic:
// the same retry always yields the same world, and a shared seed is shareable.
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

// Pick one element of arr using rng.
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
// cells and within bounds — a blocked tile stays put. This guarantees collectibles
// stay in open air (reachable) and never overlap walls, and the tile COUNT is
// preserved (so required-gem totals and saved progress stay valid).
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

// Build the variant for a given planet + attempt. Returns:
//   { map, variantLabel, targetOverrides }
// targetOverrides may carry { agility } (Earth) or { thrust } (Jupiter) to retune the
// numeric goal — the game reads these via getAgilityTarget()/getThrustTarget().
function buildPlanetVariant(planet, planetIndex, attemptNumber) {
  const standard = {
    map: cloneMap(planet.map),
    variantLabel: "standard",
    targetOverrides: {},
    isRemix: false
  };
  // First exposure stays canonical so the tutorial/mission text lines up.
  if (!attemptNumber || attemptNumber < 1) return standard;

  // Tile legend (from game.js loadPlanet): 3=gem, 4=trampoline, 5=+pole, 6=-pole.
  const seed = (planetIndex + 1) * 10007 + attemptNumber * 7919;
  const rng = mulberry32(seed);
  const baseGems = rvCountTiles(planet.map, 3);
  const map = cloneMap(planet.map);
  let variantLabel = "remix";
  let targetOverrides = {};

  if (planetIndex === 0) {
    // Earth — mass/force/antigravity/jump arc. Slide the Emerald ridge and retune the
    // Agility goal so the same engineering has a slightly different bar to clear.
    const dx = rvPick(rng, [-2, -1, 1, 2]);
    rvShiftTilesH(map, 3, dx);
    const target = 28 + Math.floor(rng() * 7); // 28..34
    targetOverrides = { agility: target };
    variantLabel = `gems shifted ${rvSign(dx)}${dx} · Agility target ${target}`;
  } else if (planetIndex === 1) {
    // Moon — loops & springs. Move the canyon gems and the trampolines a touch.
    const dx = rvPick(rng, [-2, -1, 1, 2]);
    rvShiftTilesH(map, 3, dx);
    rvShiftTilesH(map, 4, rvPick(rng, [-1, 1]));
    variantLabel = `canyon gems shifted ${rvSign(dx)}${dx}`;
  } else if (planetIndex === 2) {
    // Jupiter — force/mass/thrust. Shift the crate gems and retune the Thrust goal.
    const dx = rvPick(rng, [-2, -1, 1, 2]);
    rvShiftTilesH(map, 3, dx);
    const target = 42 + Math.floor(rng() * 7); // 42..48
    targetOverrides = { thrust: target };
    variantLabel = `crates shifted ${rvSign(dx)}${dx} · Thrust target ${target}`;
  } else if (planetIndex === 3) {
    // Glacies — friction & conditionals. Slide the ice-shelf gems.
    const dx = rvPick(rng, [-2, -1, 1, 2]);
    rvShiftTilesH(map, 3, dx);
    variantLabel = `ice gems shifted ${rvSign(dx)}${dx}`;
  } else if (planetIndex === 4) {
    // Mag-Net — events & polarity. FLIP the poles so the learner must re-predict which
    // way Hopper is pulled before running, plus nudge the gems.
    rvSwapTiles(map, 5, 6);
    rvShiftTilesH(map, 3, rvPick(rng, [-1, 1]));
    variantLabel = "poles flipped — re-check attraction vs repulsion!";
  } else {
    return standard;
  }

  // Safety net: if any transform changed the required-gem count, fall back to the
  // canonical layout rather than risk a soft-lock.
  if (rvCountTiles(map, 3) !== baseGems) return standard;

  return { map, variantLabel, targetOverrides, isRemix: true };
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
