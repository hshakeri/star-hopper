// github-sync.js - Handles client-side GitHub Gist save/load sync operations (Session token only)

// Central state cache
let gitHubSync = {
  token: sessionStorage.getItem('github_sync_token') || '',
  gistId: localStorage.getItem('github_sync_gist_id') || '',
  username: localStorage.getItem('github_sync_username') || '',
  avatarUrl: localStorage.getItem('github_sync_avatar') || '',
  lastSyncedAt: parseInt(localStorage.getItem('github_sync_last_at') || '0', 10) || 0,
  status: 'disconnected' // 'disconnected', 'connected', 'syncing'
};

// Inline status message in the sync card (replaces blocking alert popups)
function setSyncMessage(msg, type = 'info') {
  const el = document.getElementById('sync-message');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'sync-message ' + type;
  el.style.display = msg ? 'block' : 'none';
  if (msg && type !== 'error') {
    clearTimeout(setSyncMessage._timer);
    setSyncMessage._timer = setTimeout(() => {
      if (el.textContent === msg) el.style.display = 'none';
    }, 4000);
  }
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return secs + 's ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function updateSyncMeta() {
  const el = document.getElementById('sync-last-synced');
  if (!el) return;
  el.textContent = gitHubSync.lastSyncedAt
    ? 'Saved ' + formatRelativeTime(gitHubSync.lastSyncedAt)
    : 'Not saved to cloud yet';
}

function markSynced() {
  gitHubSync.lastSyncedAt = Date.now();
  localStorage.setItem('github_sync_last_at', String(gitHubSync.lastSyncedAt));
  updateSyncMeta();
}

// Manual "Load from Cloud" — pull the latest cloud save and merge it in.
async function pullFromCloud() {
  if (!gitHubSync.token || !gitHubSync.gistId) return;
  const badge = document.getElementById('sync-status-badge');
  if (badge) { badge.textContent = 'Syncing...'; badge.className = 'badge-syncing'; }
  setSyncMessage('Loading your latest progress from the cloud…', 'info');
  const ok = await loadGistData();
  if (badge) { badge.textContent = 'Connected'; badge.className = 'badge-connected'; }
  if (ok) {
    setSyncMessage('Loaded your latest progress from the cloud.', 'success');
  } else {
    setSyncMessage('Could not load from the cloud — check your connection.', 'error');
  }
}

// Initial load check on boot
window.addEventListener('DOMContentLoaded', () => {
  // Load local storage save first (even if offline)
  loadLocalProgress();

  if (gitHubSync.token) {
    autoConnectSync();
  } else {
    updateSyncUI();
  }

  // Keep the "Saved X ago" label fresh while connected.
  setInterval(() => {
    if (gitHubSync.status === 'connected') updateSyncMeta();
  }, 30000);
});

// Load local storage progress
function loadLocalProgress() {
  try {
    const localDataRaw = localStorage.getItem('star_hopper_local_progress');
    if (localDataRaw) {
      const data = JSON.parse(localDataRaw);
      
      // Update Game completedMissions
      if (typeof Game !== 'undefined' && data.completedMissions) {
        Game.completedMissions = new Set(data.completedMissions);
      }
      
      // Update notebookEntries
      if (data.notebookEntries) {
        notebookEntries = data.notebookEntries;
        if (typeof renderNotebookHistory === 'function') {
          renderNotebookHistory();
        }
      }
      
      // Update UI missions list checkmarks
      if (typeof Game !== 'undefined' && typeof updateMissionList === 'function') {
        updateMissionList(Game);
      }
    }
  } catch (err) {
    console.error("Error loading local progress:", err);
  }
}

// Save local storage progress
function saveLocalProgress() {
  try {
    const completedList = typeof Game !== 'undefined' ? Array.from(Game.completedMissions) : [];
    const payload = {
      completedMissions: completedList,
      notebookEntries: typeof notebookEntries !== 'undefined' ? notebookEntries : {}
    };
    localStorage.setItem('star_hopper_local_progress', JSON.stringify(payload));
  } catch (err) {
    console.error("Error writing local progress:", err);
  }
}

// Export progress to a local JSON file
function exportLocalSave() {
  const completedList = typeof Game !== 'undefined' ? Array.from(Game.completedMissions) : [];
  const payload = {
    completedMissions: completedList,
    notebookEntries: typeof notebookEntries !== 'undefined' ? notebookEntries : {}
  };
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "star_hopper_save.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  
  if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
    SFX.playSuccess();
  }
}

// Import progress from a local JSON file
function importLocalSave() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        
        if (!importedData.completedMissions && !importedData.notebookEntries) {
          throw new Error("Invalid save file structure");
        }
        
        // Merge data
        if (typeof Game !== 'undefined' && importedData.completedMissions) {
          let localCompleted = Array.from(Game.completedMissions);
          let mergedCompleted = Array.from(new Set([...localCompleted, ...importedData.completedMissions]));
          Game.completedMissions = new Set(mergedCompleted);
        }
        
        if (importedData.notebookEntries && typeof notebookEntries !== 'undefined') {
          Object.assign(notebookEntries, importedData.notebookEntries);
        }
        
        // Save to local storage and update UI
        saveLocalProgress();
        
        if (typeof renderNotebookHistory === 'function') {
          renderNotebookHistory();
        }
        if (typeof Game !== 'undefined' && typeof updateMissionList === 'function') {
          updateMissionList(Game);
        }
        
        setSyncMessage('Imported your save file successfully.', 'success');
        if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
          SFX.playSuccess();
        }
      } catch (err) {
        setSyncMessage("Couldn't read that file — pick a valid star_hopper_save.json.", 'error');
        if (typeof SFX !== 'undefined' && typeof SFX.playError === 'function') {
          SFX.playError();
        }
      }
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

// Auto-connect on startup if token exists in session
async function autoConnectSync() {
  const badge = document.getElementById('sync-status-badge');
  if (badge) {
    badge.textContent = 'Connecting...';
    badge.className = 'badge-syncing';
  }
  
  try {
    const isValid = await verifyTokenAndUser(gitHubSync.token);
    if (isValid) {
      gitHubSync.status = 'connected';
      updateSyncUI();
      // Fetch Gist and merge data
      await loadGistData();
    } else {
      // Token expired or invalid
      disconnectGitHubSync();
    }
  } catch (e) {
    console.error("Failed to auto-connect cloud sync:", e);
    // Offline or network error: keep token in session but set UI to disconnected offline
    gitHubSync.status = 'disconnected';
    updateSyncUI();
    const badgeEl = document.getElementById('sync-status-badge');
    if (badgeEl) {
      badgeEl.textContent = 'Offline';
      badgeEl.className = 'badge-disconnected';
    }
  }
}

// Verify token by fetching user profile from GitHub
async function verifyTokenAndUser(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      gitHubSync.username = userData.login;
      gitHubSync.avatarUrl = userData.avatar_url;
      localStorage.setItem('github_sync_username', userData.login);
      localStorage.setItem('github_sync_avatar', userData.avatar_url);
      return true;
    }
    return false;
  } catch (e) {
    throw e;
  }
}

// Connect action from UI button
async function connectGitHubSync() {
  const tokenInput = document.getElementById('github-pat-input');
  if (!tokenInput) return;
  
  const token = tokenInput.value.trim();
  if (!token) {
    setSyncMessage('Paste your GitHub token above first.', 'error');
    return;
  }

  const badge = document.getElementById('sync-status-badge');
  if (badge) {
    badge.textContent = 'Connecting...';
    badge.className = 'badge-syncing';
  }
  setSyncMessage('Connecting to GitHub…', 'info');

  try {
    const isValid = await verifyTokenAndUser(token);
    if (isValid) {
      gitHubSync.token = token;
      sessionStorage.setItem('github_sync_token', token);
      gitHubSync.status = 'connected';

      // Look for the save Gist or create one
      await findOrCreateGist();

      updateSyncUI();
      markSynced();
      setSyncMessage('Connected as ' + gitHubSync.username + ' — your progress now syncs across devices.', 'success');
      if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
        SFX.playSuccess();
      }
    } else {
      disconnectGitHubSync();
      setSyncMessage("That token didn't work. Make sure it has 'gist' permission and try again.", 'error');
    }
  } catch (err) {
    console.error("Error connecting GitHub sync:", err);
    disconnectGitHubSync();
    setSyncMessage('Could not reach GitHub — check your internet connection.', 'error');
  }
}

// Disconnect from GitHub Sync
function disconnectGitHubSync() {
  gitHubSync.token = '';
  gitHubSync.gistId = '';
  gitHubSync.username = '';
  gitHubSync.avatarUrl = '';
  gitHubSync.status = 'disconnected';
  
  sessionStorage.removeItem('github_sync_token');
  localStorage.removeItem('github_sync_gist_id');
  localStorage.removeItem('github_sync_username');
  localStorage.removeItem('github_sync_avatar');
  
  const tokenInput = document.getElementById('github-pat-input');
  if (tokenInput) tokenInput.value = '';
  
  updateSyncUI();
  if (typeof SFX !== 'undefined' && typeof SFX.playError === 'function') {
    SFX.playError();
  }
}

// Update UI elements based on state
function updateSyncUI() {
  const loggedOutDiv = document.getElementById('sync-logged-out');
  const loggedInDiv = document.getElementById('sync-logged-in');
  const badge = document.getElementById('sync-status-badge');
  const usernameSpan = document.getElementById('sync-username');
  const avatarImg = document.getElementById('sync-user-avatar');
  
  if (gitHubSync.status === 'connected') {
    if (loggedOutDiv) loggedOutDiv.style.display = 'none';
    if (loggedInDiv) loggedInDiv.style.display = 'flex';
    
    if (badge) {
      badge.textContent = 'Connected';
      badge.className = 'badge-connected';
    }
    
    if (usernameSpan) usernameSpan.textContent = gitHubSync.username;
    if (avatarImg) avatarImg.src = gitHubSync.avatarUrl;
    updateSyncMeta();
  } else {
    if (loggedOutDiv) loggedOutDiv.style.display = 'flex';
    if (loggedInDiv) loggedInDiv.style.display = 'none';
    
    if (badge) {
      badge.textContent = 'Disconnected';
      badge.className = 'badge-disconnected';
    }
  }
}

// Find Gist or create a new one
async function findOrCreateGist() {
  try {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `Bearer ${gitHubSync.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (!response.ok) throw new Error("Could not fetch user Gists");
    
    const gists = await response.json();
    const starHopperGist = gists.find(gist => gist.description === "Star Hopper Space Laboratory Save Data");
    
    if (starHopperGist) {
      // Save Gist ID
      gitHubSync.gistId = starHopperGist.id;
      localStorage.setItem('github_sync_gist_id', starHopperGist.id);
      
      // Load gist content and merge
      await loadGistData();
    } else {
      // Create new secret Gist
      await createNewGist();
    }
  } catch (err) {
    console.error("Gist lookup failed:", err);
    throw err;
  }
}

// Create a new secret Gist on GitHub
async function createNewGist() {
  const completedList = typeof Game !== 'undefined' ? Array.from(Game.completedMissions) : [];
  const payload = {
    completedMissions: completedList,
    notebookEntries: typeof notebookEntries !== 'undefined' ? notebookEntries : {}
  };
  
  try {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gitHubSync.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        description: "Star Hopper Space Laboratory Save Data",
        public: false,
        files: {
          "star_hopper_save.json": {
            content: JSON.stringify(payload, null, 2)
          }
        }
      })
    });
    
    if (response.ok) {
      const gistData = await response.json();
      gitHubSync.gistId = gistData.id;
      localStorage.setItem('github_sync_gist_id', gistData.id);
      console.log("Created new secret Gist:", gistData.id);
    } else {
      throw new Error("Gist creation failed");
    }
  } catch (err) {
    console.error("Failed to create Gist:", err);
    throw err;
  }
}

// Load gist save content and merge with local progress
async function loadGistData() {
  if (!gitHubSync.token || !gitHubSync.gistId) return false;

  try {
    const response = await fetch(`https://api.github.com/gists/${gitHubSync.gistId}`, {
      headers: {
        'Authorization': `Bearer ${gitHubSync.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (response.ok) {
      const gistData = await response.json();
      const file = gistData.files["star_hopper_save.json"];
      if (file && file.content) {
        const cloudData = JSON.parse(file.content);
        
        // Merge completedMissions (Union of local and cloud)
        let localCompleted = typeof Game !== 'undefined' ? Array.from(Game.completedMissions) : [];
        let cloudCompleted = cloudData.completedMissions || [];
        let mergedCompleted = Array.from(new Set([...localCompleted, ...cloudCompleted]));
        
        if (typeof Game !== 'undefined') {
          Game.completedMissions = new Set(mergedCompleted);
        }
        
        // Merge notebookEntries
        let cloudNotebook = cloudData.notebookEntries || {};
        if (typeof notebookEntries !== 'undefined') {
          Object.keys(cloudNotebook).forEach(key => {
            if (!notebookEntries[key] || (cloudNotebook[key].answer && cloudNotebook[key].answer.length > (notebookEntries[key].answer || '').length)) {
              notebookEntries[key] = cloudNotebook[key];
            }
          });
        }
        
        // Save merged data locally
        saveLocalProgress();
        
        // Refresh UI components
        if (typeof renderNotebookHistory === 'function') {
          renderNotebookHistory();
        }
        if (typeof Game !== 'undefined' && typeof updateMissionList === 'function') {
          updateMissionList(Game);
        }
        
        console.log("Successfully synchronized progress from GitHub cloud.");
      }
      markSynced();
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to fetch/merge Gist save data:", err);
    return false;
  }
}

// Push local progress to GitHub Gist
async function syncGistData() {
  if (!gitHubSync.token || !gitHubSync.gistId) return;
  
  const badge = document.getElementById('sync-status-badge');
  if (badge) {
    badge.textContent = 'Syncing...';
    badge.className = 'badge-syncing';
  }
  
  const completedList = typeof Game !== 'undefined' ? Array.from(Game.completedMissions) : [];
  const payload = {
    completedMissions: completedList,
    notebookEntries: typeof notebookEntries !== 'undefined' ? notebookEntries : {}
  };
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gitHubSync.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gitHubSync.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        files: {
          "star_hopper_save.json": {
            content: JSON.stringify(payload, null, 2)
          }
        }
      })
    });
    
    if (response.ok) {
      if (badge) {
        badge.textContent = 'Synced! ✔';
        badge.className = 'badge-connected';
        setTimeout(() => {
          if (gitHubSync.status === 'connected' && badge.textContent === 'Synced! ✔') {
            badge.textContent = 'Connected';
          }
        }, 2000);
      }
      console.log("Pushed progress successfully to GitHub cloud.");
      markSynced();
      setSyncMessage('Progress saved to the cloud.', 'success');
    } else {
      throw new Error("Patch Gist failed");
    }
  } catch (err) {
    console.error("Failed to sync Gist data:", err);
    if (badge) {
      badge.textContent = 'Sync Error';
      badge.className = 'badge-disconnected';
    }
    setSyncMessage('Could not save to the cloud — check your connection.', 'error');
  }
}

// Background trigger when progress is saved locally
function triggerCloudSave() {
  // Save locally first
  saveLocalProgress();
  
  // If connected to cloud sync, push to Gist
  if (gitHubSync.token && gitHubSync.gistId) {
    syncGistData();
  }
}
