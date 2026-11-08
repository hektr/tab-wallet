// Constant
const MAX_SESSIONS = 50;

// DOM Elements
const mainView = document.getElementById('mainView');
const sessionDetailView = document.getElementById('sessionDetailView');
const tabCount = document.getElementById('tabCount');
const saveBtn = document.getElementById('saveBtn');
const sessionList = document.getElementById('sessionList');
const saveModal = document.getElementById('saveModal');
const sessionNameInput = document.getElementById('sessionNameInput');
const closeTabsCheckbox = document.getElementById('closeTabsCheckbox');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
const backBtn = document.getElementById('backBtn');
const sessionTitle = document.getElementById('sessionTitle');
const sessionMeta = document.getElementById('sessionMeta');
const tabList = document.getElementById('tabList');
const restoreBtn = document.getElementById('restoreBtn');
const deleteBtn = document.getElementById('deleteBtn');

let currentSessionId = null;

// Initialize
async function init() {
  await updateStats();
  await renderSessions();
}

// Update open tabs count and RAM estimate for the current window
async function updateStats() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const validTabs = tabs.filter(tab => !isSystemTab(tab.url) && !tab.pinned);
  
  tabCount.textContent = validTabs.length;
}

// Check if URL is a system tab
function isSystemTab(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') || 
         url.startsWith('edge://') ||
         url.startsWith('about:');
}

// Render sessions list
async function renderSessions() {
  const data = await chrome.storage.local.get('sessions');
  const sessions = data.sessions || [];

  sessionList.innerHTML = '';

  if (sessions.length === 0) {
    sessionList.innerHTML = '<div class="empty-msg">No saved sessions yet</div>';
    return;
  }

  // Sort by date (newest first)
  sessions.sort((a, b) => b.savedAt - a.savedAt);

  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.onclick = () => openSessionDetail(session.id);

    const info = document.createElement('div');
    info.className = 'session-info';

    const name = document.createElement('div');
    name.className = 'session-name';
    name.textContent = session.name;

    const meta = document.createElement('div');
    meta.className = 'session-meta';
    meta.textContent = formatDate(session.savedAt);

    info.appendChild(name);
    info.appendChild(meta);

    const count = document.createElement('div');
    count.className = 'session-count';
    count.textContent = session.tabs.length;

    item.appendChild(info);
    item.appendChild(count);
    sessionList.appendChild(item);
  });
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Open session detail view
async function openSessionDetail(sessionId) {
  const data = await chrome.storage.local.get('sessions');
  const sessions = data.sessions || [];
  const session = sessions.find(s => s.id === sessionId);

  if (!session) return;

  currentSessionId = sessionId;
  sessionTitle.textContent = session.name;

  const tabCountVal = session.tabs.length;
  const timeAgo = formatDate(session.savedAt);
  sessionMeta.textContent = `${tabCountVal} tab${tabCountVal !== 1 ? 's' : ''} · ${timeAgo}`;

  tabList.innerHTML = '';
  session.tabs.forEach((tab, index) => {
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.title = tab.title || tab.url;
  
    item.onclick = () => openSingleTab(tab.url, tab.title);

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    
    // Manifest V3 compliant favicon retrieval
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", tab.url);
    faviconUrl.searchParams.set("size", "16");
    favicon.src = faviconUrl.toString();
    
    favicon.onerror = () => { favicon.style.display = 'none'; };

    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = tab.title || tab.url;
    url.title = tab.url;

    const deleteTabBtn = document.createElement('button');
    deleteTabBtn.className = 'remove-btn';
    deleteTabBtn.innerHTML = '&times;';
    deleteTabBtn.title = 'Remove from session';
    deleteTabBtn.onclick = (e) => {
      e.stopPropagation();
      removeTabFromSession(sessionId, index);
    };

    item.appendChild(favicon);
    item.appendChild(url);
    item.appendChild(deleteTabBtn);
    tabList.appendChild(item);
  });

  mainView.classList.add('hidden');
  sessionDetailView.classList.remove('hidden');
}

// Open a single tab from session
function openSingleTab(url, title) {
  chrome.tabs.create({ url, active: true });
}

/**
 * Removes a specific tab from a saved session.
 * If the removed tab was the last one in the session, the entire session 
 * is automatically deleted to prevent empty "ghost" sessions in storage and UI.
 */
async function removeTabFromSession(sessionId, tabIndex) {
  const data = await chrome.storage.local.get('sessions');
  let sessions = data.sessions || [];
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) return;

  sessions[sessionIndex].tabs.splice(tabIndex, 1);

  if (sessions[sessionIndex].tabs.length === 0) {
    sessions.splice(sessionIndex, 1);
    await chrome.storage.local.set({ sessions });
    closeSessionDetail();
  } else {
    await chrome.storage.local.set({ sessions });
    await openSessionDetail(sessionId);
  }

  await renderSessions();
}

// Close session detail view
function closeSessionDetail() {
  sessionDetailView.classList.add('hidden');
  mainView.classList.remove('hidden');
  currentSessionId = null;
}

// Show save modal with a clean, locale-independent default name
function showSaveModal() {
  const now = new Date();
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const defaultName = `Session ${day} ${month} ${year}, ${hours}:${minutes}`;
  
  sessionNameInput.value = defaultName;
  closeTabsCheckbox.checked = true;
  saveModal.style.display = 'flex';
  
  sessionNameInput.focus();
  sessionNameInput.select();
}

// Hide save modal
function hideSaveModal() {
  saveModal.style.display = 'none';
  sessionNameInput.value = '';
}

// Save session
async function saveSession() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const validTabs = tabs.filter(tab => !isSystemTab(tab.url) && !tab.pinned);

  if (validTabs.length === 0) {
    alert('No tabs to save');
    return;
  }

  const sessionName = sessionNameInput.value.trim() || sessionNameInput.placeholder;
  const shouldCloseTabs = closeTabsCheckbox.checked;

  const session = {
    id: Date.now().toString(),
    name: sessionName,
    savedAt: Date.now(),
    tabs: validTabs.map(tab => ({
      url: tab.url,
      title: tab.title
    }))
  };

  const data = await chrome.storage.local.get('sessions');
  let sessions = data.sessions || [];

  sessions.push(session);

  if (sessions.length > MAX_SESSIONS) {
    sessions.sort((a, b) => b.savedAt - a.savedAt);
    sessions = sessions.slice(0, MAX_SESSIONS);
  }

  await chrome.storage.local.set({ sessions });

  hideSaveModal();

  if (shouldCloseTabs) {
    const tabIds = validTabs.map(tab => tab.id);
    chrome.runtime.sendMessage({ action: 'closeTabs', tabIds });
  }

  await renderSessions();
}

// Restore session
async function restoreSession() {
  const data = await chrome.storage.local.get('sessions');
  const sessions = data.sessions || [];
  const session = sessions.find(s => s.id === currentSessionId);

  if (!session) return;

  // Open all tabs asynchronously to prevent UI blocking
  session.tabs.forEach(tab => {
    chrome.tabs.create({ url: tab.url, active: false });
  });

  alert(`Restored ${session.tabs.length} tabs`);
  closeSessionDetail();
}

// Delete session
async function deleteSession() {
  if (!confirm('Are you sure you want to delete this session?')) return;

  const data = await chrome.storage.local.get('sessions');
  let sessions = data.sessions || [];
  sessions = sessions.filter(s => s.id !== currentSessionId);

  await chrome.storage.local.set({ sessions });

  closeSessionDetail();
  await renderSessions();
}

// Event Listeners
saveBtn.addEventListener('click', showSaveModal);
cancelSaveBtn.addEventListener('click', hideSaveModal);
confirmSaveBtn.addEventListener('click', saveSession);
backBtn.addEventListener('click', closeSessionDetail);
restoreBtn.addEventListener('click', restoreSession);
deleteBtn.addEventListener('click', deleteSession);

// Allow saving by pressing Enter in the input field
sessionNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveSession();
  }
});

// Close modal on overlay click
saveModal.addEventListener('click', (e) => {
  if (e.target === saveModal) hideSaveModal();
});

// Initialize on load
init();

// Debounced stats update to avoid multiple rapid calls
let statsUpdateTimeout = null;

function debouncedUpdateStats() {
  if (statsUpdateTimeout) {
    clearTimeout(statsUpdateTimeout);
  }
  statsUpdateTimeout = setTimeout(() => {
    updateStats();
  }, 300);
}

// Listen for tab changes to keep stats in sync
chrome.tabs.onRemoved.addListener(debouncedUpdateStats);
chrome.tabs.onCreated.addListener(debouncedUpdateStats);
