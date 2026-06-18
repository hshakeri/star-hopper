// profiles.js - "Cadet profiles": no-login, privacy-safe local save slots.
//
// Each cadet is a named save slot stored only in this browser's localStorage.
// No account, no email, no age, no PII. Progress auto-saves on every change
// (routed through saveLocalProgress in github-sync.js), and a one-click backup
// file lets a cadet move between devices.

const SH_PROFILES_KEY = 'star_hopper_profiles';
const SH_LEGACY_KEY = 'star_hopper_local_progress';
const SH_CADET_EMOJIS = ['🚀', '🛰️', '🪐', '⭐', '🌙', '☄️', '🛸', '🌟', '👩‍🚀', '🧑‍🚀'];

function shGenProfileId() {
  // Browser context: Date.now()/Math.random() are fine here.
  return 'cadet_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e5).toString(36);
}

function shPickEmoji(store) {
  const used = new Set(Object.values(store.profiles || {}).map(p => p.emoji));
  return SH_CADET_EMOJIS.find(e => !used.has(e)) || SH_CADET_EMOJIS[0];
}

function shBlankProgress() {
  return { completedMissions: [], notebookEntries: {}, earnedBadges: [] };
}

// Build the initial store, migrating any existing single-slot save into "Cadet 1".
function shMigrateOrInit() {
  const progress = shBlankProgress();
  try {
    const legacy = JSON.parse(localStorage.getItem(SH_LEGACY_KEY));
    if (legacy) {
      progress.completedMissions = Array.isArray(legacy.completedMissions) ? legacy.completedMissions : [];
      progress.notebookEntries = legacy.notebookEntries || {};
    }
  } catch (e) { /* no/!valid legacy save */ }
  const id = shGenProfileId();
  return {
    activeId: id,
    profiles: { [id]: { name: 'Cadet 1', emoji: '🚀', createdAt: Date.now(), progress } }
  };
}

function shLoadStore() {
  let store = null;
  try { store = JSON.parse(localStorage.getItem(SH_PROFILES_KEY)); } catch (e) { store = null; }
  if (!store || !store.profiles || !store.activeId || !store.profiles[store.activeId]) {
    store = shMigrateOrInit();
    shWriteStore(store);
  }
  return store;
}

function shWriteStore(store) {
  try { localStorage.setItem(SH_PROFILES_KEY, JSON.stringify(store)); }
  catch (e) { console.error('Cadet profile save failed:', e); }
}

// Snapshot the live game state into a progress object.
function shCaptureProgress() {
  return {
    completedMissions: (window.Game && Game.completedMissions) ? Array.from(Game.completedMissions) : [],
    notebookEntries: (typeof notebookEntries !== 'undefined' && notebookEntries) ? notebookEntries : {},
    earnedBadges: (window.Game && Game.earnedBadges) ? Array.from(Game.earnedBadges) : [],
    unlockedUpgrades: (window.Game && Game.unlockedUpgrades) ? Array.from(Game.unlockedUpgrades) : [],
    upgradeLevels: (window.Game && Game.upgradeLevels) ? { ...Game.upgradeLevels } : {},
    planetClears: (window.Game && Game.planetClears) ? { ...Game.planetClears } : {},
    // Phase-2 progression fields. All additive + backward-compatible (old saves simply lack
    // them and shApplyProgress defaults them). NOT sent to the github-sync flat payload —
    // the local profile store is authoritative (matches existing planetClears behavior).
    bestClearTimes: (window.Game && Game.bestClearTimes) ? { ...Game.bestClearTimes } : {},
    masteryCleared: (window.Game && Game.masteryCleared) ? { ...Game.masteryCleared } : {},
    masteryMeters: (window.Game && Game.masteryMeters) ? { ...Game.masteryMeters } : {},
    dailySignalClears: (window.Game && Game.dailySignalClears) || 0,
    lastPlayedDate: (window.Game && Game.lastPlayedDate) ? Game.lastPlayedDate : null,
    streakCount: (window.Game && Game.streakCount) || 0
  };
}

// Load a progress object into the live game and refresh every dependent panel.
function shApplyProgress(progress) {
  if (!window.Game) return;
  Game.completedMissions = new Set(progress.completedMissions || []);
  Game.earnedBadges = new Set(progress.earnedBadges || []);
  Game.unlockedUpgrades = new Set(progress.unlockedUpgrades || []);
  Game.upgradeLevels = progress.upgradeLevels ? { ...progress.upgradeLevels } : {};
  Game.planetClears = progress.planetClears ? { ...progress.planetClears } : {};
  // Phase-2 fields — default for old saves that predate them.
  Game.bestClearTimes = (progress.bestClearTimes && typeof progress.bestClearTimes === 'object') ? { ...progress.bestClearTimes } : {};
  Game.masteryCleared = (progress.masteryCleared && typeof progress.masteryCleared === 'object') ? { ...progress.masteryCleared } : {};
  Game.masteryMeters = (progress.masteryMeters && typeof progress.masteryMeters === 'object') ? { ...progress.masteryMeters } : {};
  Game.dailySignalClears = progress.dailySignalClears || 0;
  Game.lastPlayedDate = progress.lastPlayedDate || null;
  Game.streakCount = progress.streakCount || 0;
  try {
    if (typeof notebookEntries !== 'undefined' && notebookEntries) {
      Object.keys(notebookEntries).forEach(k => delete notebookEntries[k]);
      Object.assign(notebookEntries, progress.notebookEntries || {});
    }
  } catch (e) { /* notebook store not ready yet */ }

  // Roll the return-streak now that this cadet's lastPlayedDate/streakCount are loaded.
  // (Must run AFTER the fields above are restored — Game.init ran before this apply, so
  // doing it in init() would compute from defaults and then be overwritten here.)
  if (typeof Game.updateReturnStreak === 'function') {
    try { Game.updateReturnStreak(); } catch (e) { /* streak is non-critical */ }
  }

  // Refresh each dependent panel independently — at startup some (e.g. the mission
  // list) may not be ready (no planet loaded yet), so one failure must not abort the rest.
  [
    () => typeof updateMissionList === 'function' && updateMissionList(Game),
    () => typeof renderNotebookHistory === 'function' && renderNotebookHistory(),
    () => typeof updateBadgeShelf === 'function' && updateBadgeShelf(Game),
    () => typeof updateLearningConceptProgress === 'function' && updateLearningConceptProgress(Game),
    () => typeof updateCertificateState === 'function' && updateCertificateState(),
    () => Game.refreshDailySignalBanner && Game.refreshDailySignalBanner(),
    () => Game.refreshStreakBanner && Game.refreshStreakBanner()
  ].forEach(fn => { try { fn(); } catch (e) { /* panel not ready at this stage */ } });
}

// Persist current game state into the active cadet (called from saveLocalProgress).
let shSavedFlashTimer = null;
function shAutoSave() {
  const store = shLoadStore();
  store.profiles[store.activeId].progress = shCaptureProgress();
  shWriteStore(store);
  shFlashSaved();
}

function shFlashSaved() {
  const el = document.getElementById('cadet-save-status');
  if (!el) return;
  el.textContent = '✓ Saved';
  el.classList.add('saved-pulse');
  if (shSavedFlashTimer) clearTimeout(shSavedFlashTimer);
  shSavedFlashTimer = setTimeout(() => {
    el.textContent = 'Auto-saving on';
    el.classList.remove('saved-pulse');
  }, 1600);
}

function shGetActive() {
  const store = shLoadStore();
  return store.profiles[store.activeId];
}

function shSwitchProfile(id) {
  const store = shLoadStore();
  if (!store.profiles[id] || id === store.activeId) return;
  // Save the cadet we are leaving, then load the new one.
  store.profiles[store.activeId].progress = shCaptureProgress();
  store.activeId = id;
  shWriteStore(store);
  shApplyProgress(store.profiles[id].progress);
  if (typeof saveLocalProgress === 'function') saveLocalProgress(); // keep legacy key + cloud in sync
  shRenderUI();
}

function shCreateProfile() {
  const store = shLoadStore();
  const name = (prompt('Name your new cadet:', 'Cadet ' + (Object.keys(store.profiles).length + 1)) || '').trim();
  if (!name) return;
  store.profiles[store.activeId].progress = shCaptureProgress(); // save current first
  const id = shGenProfileId();
  store.profiles[id] = {
    name: name.slice(0, 24),
    emoji: shPickEmoji(store),
    createdAt: Date.now(),
    progress: shBlankProgress()
  };
  store.activeId = id;
  shWriteStore(store);
  shApplyProgress(store.profiles[id].progress);
  if (typeof saveLocalProgress === 'function') saveLocalProgress();
  shRenderUI();
}

function shRenameActive() {
  const store = shLoadStore();
  const active = store.profiles[store.activeId];
  const name = (prompt('Rename this cadet:', active.name) || '').trim();
  if (!name) return;
  active.name = name.slice(0, 24);
  shWriteStore(store);
  shRenderUI();
}

function shDeleteActive() {
  const store = shLoadStore();
  const ids = Object.keys(store.profiles);
  if (ids.length <= 1) {
    alert("This is your only cadet — create another one before deleting this profile.");
    return;
  }
  const active = store.profiles[store.activeId];
  if (!confirm(`Delete cadet "${active.name}" and its progress on this device? This cannot be undone.`)) return;
  delete store.profiles[store.activeId];
  store.activeId = Object.keys(store.profiles)[0];
  shWriteStore(store);
  shApplyProgress(store.profiles[store.activeId].progress);
  if (typeof saveLocalProgress === 'function') saveLocalProgress();
  shRenderUI();
}

function shRenderUI() {
  const body = document.getElementById('cadet-profiles-body');
  if (!body) return;
  const store = shLoadStore();
  const active = store.profiles[store.activeId];
  const ids = Object.keys(store.profiles);

  const options = ids.map(id => {
    const p = store.profiles[id];
    const sel = id === store.activeId ? ' selected' : '';
    return `<option value="${id}"${sel}>${p.emoji} ${escapeHTMLSafe(p.name)}</option>`;
  }).join('');

  body.innerHTML = `
    <div class="cadet-active-row">
      <span class="cadet-active-emoji">${active.emoji}</span>
      <select class="cadet-select" id="cadet-select" onchange="StarHopperProfiles.switchProfile(this.value)" aria-label="Switch cadet">
        ${options}
      </select>
    </div>
    <div class="cadet-actions">
      <button class="cadet-btn" onclick="StarHopperProfiles.createProfile()">➕ New cadet</button>
      <button class="cadet-btn" onclick="StarHopperProfiles.renameActive()">✏️ Rename</button>
      <button class="cadet-btn cadet-btn-danger" onclick="StarHopperProfiles.deleteActive()">🗑 Delete</button>
    </div>
    <div class="cadet-actions">
      <button class="cadet-btn cadet-btn-backup" onclick="exportLocalSave()">⬇ Download backup</button>
      <button class="cadet-btn cadet-btn-backup" onclick="importLocalSave()">⬆ Restore backup</button>
    </div>`;
}

// escapeHTML is defined in ui.js; provide a safe fallback if profiles renders first.
function escapeHTMLSafe(value) {
  if (typeof escapeHTML === 'function') return escapeHTML(value);
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Boot on `load` (not DOMContentLoaded): game.js creates `Game` in its own `load`
// handler, and listeners fire in registration order, so by the time this runs the
// game exists and the active cadet's progress can be applied to it.
window.addEventListener('load', () => {
  const store = shLoadStore();         // migrates legacy -> Cadet 1 on first run
  try { shApplyProgress(store.profiles[store.activeId].progress); } catch (e) { console.error('Cadet apply failed:', e); }
  try { shRenderUI(); } catch (e) { console.error('Cadet UI render failed:', e); }
});

window.StarHopperProfiles = {
  autoSave: shAutoSave,
  switchProfile: shSwitchProfile,
  createProfile: shCreateProfile,
  renameActive: shRenameActive,
  deleteActive: shDeleteActive,
  renderUI: shRenderUI,
  getActive: shGetActive,
  captureProgress: shCaptureProgress,
  applyProgress: shApplyProgress
};
