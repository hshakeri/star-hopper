const fs = require('fs');
const path = require('path');

// Mock browser globals
global.window = global;
global.window.addEventListener = () => {};
global.document = {
  getElementById: (id) => {
    return {
      appendChild: () => {},
      textContent: "",
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {}
      },
      querySelectorAll: () => [],
      style: {},
      scrollTop: 0,
      scrollHeight: 0,
      value: ""
    };
  },
  createElement: () => {
    return {
      appendChild: () => {},
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {}
      },
      querySelectorAll: () => [],
      style: {}
    };
  },
  addEventListener: () => {}
};

// Map-backed localStorage so guided-mode tests behave like a real browser
// (getItem/setItem/removeItem), instead of being undefined under node.
const __lsStore = new Map();
global.localStorage = {
  getItem: (k) => (__lsStore.has(k) ? __lsStore.get(k) : null),
  setItem: (k, v) => { __lsStore.set(k, String(v)); },
  removeItem: (k) => { __lsStore.delete(k); },
  clear: () => { __lsStore.clear(); }
};

global.SFX = {
  playJump: () => {},
  playSuccess: () => {},
  playError: () => {},
  playCoin: () => {},
  startBGM: () => {},
  stopBGM: () => {},
  currentBgm: 0
};

global.Particles = {
  spawn: () => {},
  spawnBurst: () => {},
  clear: () => {}
};

global.ui_log_output = (msg, type) => {
  console.log(`[UI LOG - ${type}]: ${msg}`);
};

global.ui_log_input = (msg) => {
  console.log(`[UI INPUT]: ${msg}`);
};

global.updateMissionList = () => {};
global.renderNotebookHistory = () => {};
global.notebookEntries = {};

// Override test rendering to show output in terminal
const testResults = [];
global.renderTestResult = (suiteId, name, success, errorMsg = "") => {
  testResults.push({ suiteId, name, success, errorMsg });
  if (success) {
    console.log(`\x1b[32mPASS\x1b[0m: [${suiteId}] ${name}`);
  } else {
    console.log(`\x1b[31mFAIL\x1b[0m: [${suiteId}] ${name} -> ${errorMsg}`);
  }
};

// Files to load in order
const files = [
  'interpreter.js',
  'missions.js',
  'planets.js',
  'entities.js',
  'physics.js',
  'ui.js',
  'nav-core.js',
  'nav-bodies.js',
  'nav-physics.js',
  'nav-ship.js',
  'nav-transfer.js',
  'nav-renderer.js',
  'nav-missions.js',
  'navigator.js',
  'retry-variants.js',
  'diagnostics.js',
  'game.js',
  'guided-mode.js',
  'test-runner.js'
];

const basePath = '/Users/hs9hd/Documents/star-hopper';
const bundle = files.map(file => fs.readFileSync(path.join(basePath, file), 'utf8')).join('\n');
eval(bundle);
renderTestResult = global.renderTestResult;

console.log("\n--- Running Tests ---");
runCompilerTests();
runSafetyTests();
runEngineTests();
runSolarTests();

const failed = testResults.filter(r => !r.success);
console.log(`\nSummary: ${testResults.length} tests, ${testResults.length - failed.length} passed, ${failed.length} failed.`);
if (failed.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
