// Render smoke test — exercises the NEW draw paths (start backdrop, ink outlines,
// pop-text, locked-gem reject ring) through a canvas mock to catch runtime errors that
// the logic tests don't (draw() is never called in the unit suites). Not pixel-accurate;
// it only asserts "drawing these does not throw". Usage: node scratch/node-smoke.js
const fs = require('fs');
const path = require('path');
const basePath = path.resolve(__dirname, '..');

function makeCtx() {
  const grad = { addColorStop: () => {} };
  const ctx = {
    canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '',
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    globalCompositeOperation: 'source-over', filter: 'none', imageSmoothingEnabled: true,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: () => {}, drawImage: () => {}, measureText: () => ({ width: 24 }),
    setLineDash: () => {}, getLineDash: () => [],
  };
  for (const m of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo',
    'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'clip',
    'fillRect', 'strokeRect', 'clearRect', 'translate', 'rotate', 'scale', 'transform', 'setTransform',
    'resetTransform', 'fillText', 'strokeText', 'createImageData']) ctx[m] = () => {};
  return ctx;
}
function makeCanvas() { const c = { width: 720, height: 448, style: {} }; const x = makeCtx(); x.canvas = c; c.getContext = () => x; c.toDataURL = () => ''; return c; }
function makeStyle() { return { setProperty: () => {}, getPropertyValue: () => '', removeProperty: () => {} }; }
function makeEl() {
  return { appendChild: () => {}, removeChild: () => {}, append: () => {}, remove: () => {}, setAttribute: () => {},
    getAttribute: () => null, addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null,
    querySelectorAll: () => [], insertBefore: () => {}, getContext: () => makeCtx(),
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: makeStyle(), dataset: {}, textContent: '', innerHTML: '', value: '', scrollTop: 0, scrollHeight: 0,
    width: 720, height: 448, children: [], focus: () => {} };
}
global.window = global;
global.window.addEventListener = () => {};
global.requestAnimationFrame = () => 0;
global.performance = { now: () => 0 };
global.OffscreenCanvas = function (w, h) { const c = makeCanvas(); c.width = w; c.height = h; return c; };
global.document = { getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
  createElement: (t) => (String(t).toLowerCase() === 'canvas' ? makeCanvas() : makeEl()), addEventListener: () => {}, body: makeEl(), documentElement: makeEl() };
global.getComputedStyle = () => makeStyle();
const __ls = new Map();
global.localStorage = { getItem: (k) => (__ls.has(k) ? __ls.get(k) : null), setItem: (k, v) => __ls.set(k, String(v)), removeItem: (k) => __ls.delete(k), clear: () => __ls.clear() };
global.SFX = new Proxy({}, { get: () => () => {} });
global.ui_log_output = () => {};
global.ui_log_input = () => {};
global.updateMissionList = () => {};
global.renderNotebookHistory = () => {};
global.updateCertificateState = () => {};
global.notebookEntries = {};

const files = ['interpreter.js','missions.js','planets.js','render-cache.js','entities.js','physics.js','ui.js',
  'nav-core.js','nav-bodies.js','nav-physics.js','nav-ship.js','nav-transfer.js','nav-renderer.js','nav-missions.js',
  'navigator.js','retry-variants.js','diagnostics.js','attempt-log.js','profiles.js','game.js','guided-mode.js'];
const bundle = files.map((f) => fs.readFileSync(path.join(basePath, f), 'utf8')).join('\n');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`\x1b[32mOK\x1b[0m   ${name}`); pass++; }
  catch (e) { console.log(`\x1b[31mTHROW\x1b[0m ${name}: ${e.message}`); fail++; }
}

const smoke = `
  const ctx = makeCtx();
  // 1. Comic impact pop-text draw (new 'pop' style)
  ComicBubbles.clear();
  ComicBubbles.pop(100, 100, 'POW!', '#fb7185', 1.5);
  ComicBubbles.pop(120, 90, 'GET!', '#facc15', 1.4);
  for (let i = 0; i < 70; i++) { ComicBubbles.update(); ComicBubbles.draw(ctx, 0); }
  global.__popCap = (ComicBubbles.pop(1,1,'A','#fff',1), ComicBubbles.pop(2,2,'B','#fff',1), ComicBubbles.pop(3,3,'C','#fff',1), ComicBubbles.pop(4,4,'D','#fff',1), ComicBubbles.bubbles.filter(b=>b.type==='pop').length);

  // 2. Player draw with ink outlines — both suits, grounded + airborne
  const pStar = new Player(64, 200); pStar.charType = 'star';
  const pHop = new Player(64, 200); pHop.charType = 'hopper';
  const fakeGame = { player: pStar, cameraX: 0 };
  pStar.draw(ctx, 0, fakeGame); pStar.onGround = false; pStar.draw(ctx, 0, fakeGame);
  pHop.draw(ctx, 0, { player: pHop, cameraX: 0 });

  // 3. Locked-gem reject ring draw
  const gem = new InteractiveObject(100, 100, 'coin');
  gem.requiredCollectible = true; gem.gemGate = { id: 'g', label: 'x' }; gem.rejectPulse = 1;
  const lockGame = { canCollectGem: () => false, getGemConfig: () => ({ color:'#facc15', glow:'#facc15', shortName:'X', name:'X' }) };
  for (let i = 0; i < 20; i++) { gem.update(); gem.draw(ctx, 0, lockGame); }

  // 4. Game start backdrop + space background
  const g = new StarHopperGame();
  g.canvas = makeCanvas(); g.ctx = g.canvas.getContext('2d');
  g.loadPlanet(0);
  g.state = 'start';
  g.draw();             // exercises start-state branch -> drawSpaceBackground + drawStartBackdrop
  g.drawStartBackdrop();

  // 5. Wave 4 playing-state draw: debris + meteors + hurt flash + screen shake + heart HUD
  const gp = new StarHopperGame();
  gp.canvas = makeCanvas(); gp.ctx = gp.canvas.getContext('2d');
  gp.loadPlanet(1);     // Moon — a space-y world with debris
  gp.state = 'playing';
  gp.spawnDebris(); gp.spawnDebris();
  gp.triggerMeteorShower();
  gp.meteorPhase = 'active'; gp.meteorActiveTimer = 60; gp.meteorSpawnTimer = 0; gp.spawnMeteor();
  gp.hurtFlashTimer = 8; gp.shakeFrames = 10; gp.shakeMag = 7; gp.shakeMax = 10; gp.reducedMotion = false;
  // Wave 5: arm the blaster + fire so projectiles, weapon HUD, and fuel gauge draw too.
  gp.equipWeapon('blaster'); gp.keys = { f: true }; gp.shootCooldown = 0;
  // Wave 5: break a placed block (carves terrain → rebake) and wake a mob.
  const mm = gp.getActiveMap();
  for (let r = 0; r < mm.length && !global.__broke; r++) for (let c = 0; c < mm[r].length; c++) { if (mm[r][c] === 10) { gp.breakBlock(r, c); global.__broke = true; break; } }
  gp.wakeMob(220, 120);
  for (let i = 0; i < 5; i++) { gp.updateDebris(); gp.updateMeteors(); gp.updateCombat(); gp.updateMobs(); gp.draw(); }
  gp.drawMeteorBanner(gp.ctx); gp.drawHealthHUD(gp.ctx); gp.drawFuelHUD(gp.ctx); gp.drawWeaponHUD(gp.ctx);
  global.__wave4ok = true;

  // Every drawn mob species renders without throwing (incl. blink + hit-flash + squash).
  ['hog', 'snake', 'critter', 'blob', 'bot', 'floater'].forEach((sp, i) => {
    const mob = new Mob(50 + i * 30, 100, sp, '#a78bfa');
    mob.eyeDir = 1; mob.animTime = 1.3; mob.vy = -3;
    mob.draw(ctx, 0);
    mob.blinkTimer = 3; mob.hitFlash = 4; mob.draw(ctx, 0);
  });
  global.__mobsok = true;

  global.__ok = true;
`;
eval(bundle + '\n' + smoke);

check('pop-text draws without throwing and caps at 2', () => { if (global.__popCap !== 2) throw new Error('pop cap was ' + global.__popCap + ', expected 2'); });
check('player + gem + start backdrop drew without throwing', () => { if (!global.__ok) throw new Error('smoke did not complete'); });
check('Wave 4 hazards (debris/meteors/flash/shake/hearts) draw without throwing', () => { if (!global.__wave4ok) throw new Error('wave4 draw did not complete'); });
check('all drawn mob species render without throwing', () => { if (!global.__mobsok) throw new Error('mob species draw did not complete'); });

console.log(`\nSmoke: ${pass} ok, ${fail} threw.`);
process.exit(fail > 0 ? 1 : 0);
