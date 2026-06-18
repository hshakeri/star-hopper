// Headless test runner for Star Hopper — runs all 8 browser suites under node.
// Path-independent (unlike scratch/run_tests.js) and provides a canvas mock so the
// render-cache suite can run. Usage: node scratch/node-tests.js
const fs = require('fs');
const path = require('path');
const basePath = path.resolve(__dirname, '..');

// --- Mock 2D canvas context: every method is a no-op; gradients/patterns are stubs. ---
function makeCtx() {
  const grad = { addColorStop: () => {} };
  const ctx = {
    canvas: null,
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '',
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', shadowBlur: 0,
    shadowColor: '', globalCompositeOperation: 'source-over', filter: 'none',
    imageSmoothingEnabled: true, miterLimit: 10, lineDashOffset: 0,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: () => {}, drawImage: () => {}, measureText: () => ({ width: 10 }),
    setLineDash: () => {}, getLineDash: () => [],
  };
  for (const m of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'arc', 'arcTo', 'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'translate',
    'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'fillText',
    'strokeText', 'createImageData', 'scrollPathIntoView']) ctx[m] = () => {};
  return ctx;
}
function makeCanvas() {
  const c = { width: 300, height: 150, style: {} };
  const ctx = makeCtx();
  ctx.canvas = c;
  c.getContext = () => ctx;
  c.toDataURL = () => '';
  return c;
}

global.window = global;
global.window.addEventListener = () => {};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.performance = { now: () => 0 };
global.OffscreenCanvas = function (w, h) { const c = makeCanvas(); c.width = w; c.height = h; return c; };

function makeStyle() {
  return { setProperty: () => {}, getPropertyValue: () => '', removeProperty: () => {} };
}
function makeEl() {
  return {
    appendChild: () => {}, removeChild: () => {}, append: () => {}, remove: () => {},
    setAttribute: () => {}, getAttribute: () => null, addEventListener: () => {},
    removeEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
    insertBefore: () => {}, getContext: () => makeCtx(),
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: makeStyle(), dataset: {}, textContent: '', innerHTML: '', value: '',
    scrollTop: 0, scrollHeight: 0, width: 720, height: 448, children: [], focus: () => {},
  };
}
global.document = {
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: (tag) => (String(tag).toLowerCase() === 'canvas' ? makeCanvas() : makeEl()),
  addEventListener: () => {}, body: makeEl(), documentElement: makeEl(),
};
global.getComputedStyle = () => makeStyle();

const __ls = new Map();
global.localStorage = {
  getItem: (k) => (__ls.has(k) ? __ls.get(k) : null),
  setItem: (k, v) => __ls.set(k, String(v)),
  removeItem: (k) => __ls.delete(k), clear: () => __ls.clear(),
};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };

global.SFX = new Proxy({}, { get: () => () => {} });
global.Particles = { spawn: () => {}, spawnBurst: () => {}, clear: () => {}, update: () => {}, draw: () => {} };
global.ComicBubbles = { spawn: () => {}, update: () => {}, draw: () => {}, clear: () => {} };
global.ui_log_output = () => {};
global.ui_log_input = () => {};
global.updateMissionList = () => {};
global.renderNotebookHistory = () => {};
global.notebookEntries = {};

const results = [];
global.__logResult = (suiteId, name, success, errorMsg = '') => {
  results.push({ suiteId, name, success, errorMsg });
  const tag = success ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${tag} [${suiteId}] ${name}${success ? '' : ' -> ' + errorMsg}`);
};
global.renderTestResult = global.__logResult;

const files = [
  'interpreter.js', 'missions.js', 'planets.js', 'render-cache.js', 'entities.js',
  'physics.js', 'ui.js', 'nav-core.js', 'nav-bodies.js', 'nav-physics.js', 'nav-ship.js',
  'nav-transfer.js', 'nav-renderer.js', 'nav-missions.js', 'navigator.js', 'retry-variants.js',
  'diagnostics.js', 'attempt-log.js', 'github-sync.js', 'profiles.js', 'game.js', 'guided-mode.js', 'test-runner.js',
];
const bundle = files.map((f) => fs.readFileSync(path.join(basePath, f), 'utf8')).join('\n');

// Suite functions are `function` declarations in test-runner.js — eval'd here they are
// LOCAL to this eval scope (not global), so the run calls must share that scope.
console.log('\n--- Running All Suites ---');
const suites = ['runCompilerTests', 'runSafetyTests', 'runEngineTests', 'runSolarTests',
  'runRetryRemixTests', 'runDiagnosticsTests', 'runExperimentLogTests', 'runRenderCacheTests'];
// test-runner.js declares its own `function renderTestResult` which, under sloppy-mode
// direct eval, shadows our global. Reassign that binding inside the eval scope so our
// logger captures results.
const runnerCode = 'renderTestResult = global.__logResult;\n' + suites.map((s) =>
  `try { if (typeof ${s} === 'function') ${s}(); else console.log('(skip ${s} — not defined)'); }
   catch (e) { console.log('\\x1b[31mSUITE ERROR\\x1b[0m ${s}: ' + e.message); }`
).join('\n');
eval(bundle + '\n' + runnerCode);

const failed = results.filter((r) => !r.success);
console.log(`\nSummary: ${results.length} tests, ${results.length - failed.length} passed, ${failed.length} failed.`);
process.exit(failed.length > 0 ? 1 : 0);
