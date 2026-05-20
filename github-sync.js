// github-sync.js - Handles client-side GitHub Gist save/load sync operations (Session token only)

// Central state cache
let gitHubSync = {
  token: sessionStorage.getItem('github_sync_token') || '',
  gistId: localStorage.getItem('github_sync_gist_id') || '',
  username: localStorage.getItem('github_sync_username') || '',
  avatarUrl: localStorage.getItem('github_sync_avatar') || '',
  status: 'disconnected' // 'disconnected', 'connected', 'syncing'
};

// Initial load check on boot
window.addEventListener('DOMContentLoaded', () => {
  // Load local storage save first (even if offline)
  loadLocalProgress();

  if (gitHubSync.token) {
    autoConnectSync();
  } else {
    updateSyncUI();
  }
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
        
        alert("Successfully imported progress!");
        if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
          SFX.playSuccess();
        }
      } catch (err) {
        alert("Failed to parse save file. Please make sure it is a valid star_hopper_save.json.");
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
    alert("Please paste a GitHub Personal Access Token (PAT) first.");
    return;
  }
  
  const badge = document.getElementById('sync-status-badge');
  if (badge) {
    badge.textContent = 'Connecting...';
    badge.className = 'badge-syncing';
  }
  
  try {
    const isValid = await verifyTokenAndUser(token);
    if (isValid) {
      gitHubSync.token = token;
      sessionStorage.setItem('github_sync_token', token);
      gitHubSync.status = 'connected';
      
      // Look for Gist or create one
      await findOrCreateGist();
      
      updateSyncUI();
      if (typeof SFX !== 'undefined' && typeof SFX.playSuccess === 'function') {
        SFX.playSuccess();
      }
    } else {
      alert("Invalid Personal Access Token. Please make sure it has 'gist' access permissions.");
      disconnectGitHubSync();
    }
  } catch (err) {
    console.error("Error connecting GitHub sync:", err);
    alert("Could not reach GitHub API. Check your internet connection.");
    disconnectGitHubSync();
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
  if (!gitHubSync.token || !gitHubSync.gistId) return;
  
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
    }
  } catch (err) {
    console.error("Failed to fetch/merge Gist save data:", err);
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
    } else {
      throw new Error("Patch Gist failed");
    }
  } catch (err) {
    console.error("Failed to sync Gist data:", err);
    if (badge) {
      badge.textContent = 'Sync Error';
      badge.className = 'badge-disconnected';
    }
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
