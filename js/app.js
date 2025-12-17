let currentUser = null;
let path = [];
let currentView = 'home';
let editMode = false;
let favorites = [];
let notes = [];
let flashcardDecks = [];
let studySessions = [];
let documentProgress = {};
let quickLinks = [];
let studyStats = { totalTime: 0, streak: 0, lastStudyDate: null, hourlyActivity: {} };
let currentCalendarDate = new Date();
let currentEditingNote = null;
let currentEditingDeck = null;
let currentStudyDeck = null;
let currentCardIndex = 0;
let accessibilitySettings = {
  highContrast: localStorage.getItem('accessibility-high-contrast') === 'true',
  largeText: localStorage.getItem('accessibility-large-text') === 'true',
  reducedMotion: localStorage.getItem('accessibility-reduced-motion') === 'true',
  enhancedFocus: localStorage.getItem('accessibility-enhanced-focus') === 'true'
};




async function initializeFavorites() {
  try {
    
    if (window.__TAURI__) {
      const loaded = await loadFavoritesFromTauri();
      if (loaded) return;
    }
    
    favorites = JSON.parse(localStorage.getItem('questionary-favorites') || '[]');
  } catch (e) {
    console.error('Error loading favorites:', e);
    favorites = [];
  }
}


async function saveFavorites() {
  try {
    
    localStorage.setItem('questionary-favorites', JSON.stringify(favorites));
    
    
    if (window.__TAURI__) {
      await saveFavoritesToTauri();
    }
  } catch (e) {
    console.error('Error saving favorites:', e);
  }
}


async function loadFavoritesFromTauri() {
  try {
    const { readTextFile, BaseDirectory } = window.__TAURI__.fs || {};
    const { appDataDir } = window.__TAURI__.path || {};
    
    if (readTextFile && appDataDir) {
      const data = await readTextFile('favorites.json', { dir: BaseDirectory.AppData });
      favorites = JSON.parse(data);
      
      localStorage.setItem('questionary-favorites', JSON.stringify(favorites));
      return true;
    }
  } catch (e) {
    
    console.log('Loading favorites from localStorage instead');
  }
  return false;
}

async function saveFavoritesToTauri() {
  try {
    const { writeTextFile, createDir, BaseDirectory } = window.__TAURI__.fs || {};
    
    if (writeTextFile && createDir) {
      
      try {
        await createDir('', { dir: BaseDirectory.AppData, recursive: true });
      } catch (e) {
        
      }
      
      await writeTextFile('favorites.json', JSON.stringify(favorites, null, 2), { 
        dir: BaseDirectory.AppData 
      });
    }
  } catch (e) {
    console.error('Error saving favorites to Tauri:', e);
  }
}


async function loadRecentFromTauri() {
  try {
    const { readTextFile, BaseDirectory } = window.__TAURI__.fs || {};
    
    if (readTextFile) {
      const data = await readTextFile('recent.json', { dir: BaseDirectory.AppData });
      const recent = JSON.parse(data);
      localStorage.setItem('questionary-recent', JSON.stringify(recent));
      return recent;
    }
  } catch (e) {
    console.log('Loading recent from localStorage');
  }
  return null;
}

async function saveRecentToStorage(recent) {
  try {
    localStorage.setItem('questionary-recent', JSON.stringify(recent));
    
    if (window.__TAURI__) {
      const { writeTextFile, createDir, BaseDirectory } = window.__TAURI__.fs || {};
      if (writeTextFile && createDir) {
        try {
          await createDir('', { dir: BaseDirectory.AppData, recursive: true });
        } catch (e) {}
        await writeTextFile('recent.json', JSON.stringify(recent, null, 2), { 
          dir: BaseDirectory.AppData 
        });
      }
    }
  } catch (e) {
    console.error('Error saving recent:', e);
  }
}


let timerState = {
  duration: 0,
  remaining: 0,
  interval: null,
  isRunning: false,
  isPaused: false,
  laps: [],
  lastLapTime: 0
};

function applyAccessibilitySettings() {
  document.body.classList.toggle('high-contrast', accessibilitySettings.highContrast);
  document.body.classList.toggle('large-text', accessibilitySettings.largeText);
  document.body.classList.toggle('reduced-motion', accessibilitySettings.reducedMotion);
  document.body.classList.toggle('enhanced-focus', accessibilitySettings.enhancedFocus);
}

function createRipple(event) {
  
}

const users = {
  "DPSNTRVMP": { password: "DPSNTRVMP@123", role: "user" },
  "ADMIN": { password: "DPSNTCLASSLOGIN@@", role: "admin" }
};


function showApp() {
  const loginScreen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  if (loginScreen) loginScreen.style.display = 'none';
  if (app) app.style.display = 'block';
  if (loadingOverlay) loadingOverlay.classList.remove('active');
  
  console.log('App displayed');
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `notification-toast notification-${type}`;
  
    let icon = 'fa-info-circle';
  let bgColor = '#3b82f6';
  if (type === 'success') {
    icon = 'fa-check-circle';
    bgColor = '#22c55e';
  } else if (type === 'error') {
    icon = 'fa-exclamation-circle';
    bgColor = '#ef4444';
  } else if (type === 'warning') {
    icon = 'fa-exclamation-triangle';
    bgColor = '#f59e0b';
  }
  
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    padding: 14px 24px;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    background: ${bgColor};
    font-size: 0.95rem;
    max-width: 90%;
    animation: slideUpToast 0.3s ease forwards;
  `;
  
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
  
    if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideUpToast {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes slideDownToast {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(100px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDownToast 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initializeAppAfterLogin() {
    const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay && currentUser) {
    usernameDisplay.textContent = currentUser.username;
  }
  
    const adminBadge = document.getElementById('adminBadge');
  if (adminBadge && currentUser && currentUser.role === 'admin') {
    adminBadge.style.display = 'inline-block';
  }
  
    if (typeof initializeNewFeatures === 'function') {
    initializeNewFeatures();
  }
  
    if (typeof renderTiles === 'function' && typeof documents !== 'undefined') {
    renderTiles(documents);
  }
  
    if (typeof updateBreadcrumb === 'function') {
    updateBreadcrumb();
  }
  
    if (typeof updateDashboardStats === 'function') {
    updateDashboardStats();
  }
}

function showAutoLoginNotification(username) {
  console.log('Auto-logging in as:', username);
  showNotification(`Welcome back, ${username}!`, 'success');
}

function performSearch(e) {
  const query = typeof e === 'string' ? e : (e?.target?.value || '');
  const searchResults = document.getElementById('searchResults');
  
  if (!query || query.length < 2) {
    if (searchResults) searchResults.style.display = 'none';
    return;
  }
  
    if (typeof addToSearchHistory === 'function') {
    addToSearchHistory(query);
  }
  
    const results = [];
  if (typeof documents !== 'undefined') {
    searchInDocuments(documents, [], query.toLowerCase(), results);
  }
  
    if (notes && notes.length > 0) {
    notes.forEach(note => {
      if (note.title.toLowerCase().includes(query.toLowerCase()) || 
          note.content.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          name: note.title,
          path: ['Notes'],
          isFolder: false,
          isNote: true,
          noteId: note.id,
          url: null
        });
      }
    });
  }
  
    if (flashcardDecks && flashcardDecks.length > 0) {
    flashcardDecks.forEach(deck => {
      if (deck.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          name: deck.name,
          path: ['Flashcards'],
          isFolder: false,
          isFlashcard: true,
          deckId: deck.id,
          url: null
        });
      }
            deck.cards.forEach(card => {
        if (card.front.toLowerCase().includes(query.toLowerCase()) || 
            card.back.toLowerCase().includes(query.toLowerCase())) {
          const alreadyAdded = results.some(r => r.deckId === deck.id);
          if (!alreadyAdded) {
            results.push({
              name: `${deck.name} (card match)`,
              path: ['Flashcards'],
              isFolder: false,
              isFlashcard: true,
              deckId: deck.id,
              url: null
            });
          }
        }
      });
    });
  }
  
    if (studySessions && studySessions.length > 0) {
    studySessions.forEach(session => {
      if (session.subject.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          name: session.subject,
          path: ['Study Planner', session.date],
          isFolder: false,
          isSession: true,
          sessionId: session.id,
          url: null
        });
      }
    });
  }
  
  if (searchResults) {
    if (results.length === 0) {
      searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No results found</div>';
    } else {
      searchResults.innerHTML = results.slice(0, 15).map(r => {
                let icon = r.isFolder ? 'fa-folder' : 'fa-file-pdf';
        if (r.isNote) icon = 'fa-sticky-note';
        if (r.isFlashcard) icon = 'fa-layer-group';
        if (r.isSession) icon = 'fa-calendar-alt';
        
                let onclickHandler = '';
        if (r.isNote) {
          onclickHandler = `navigateToNote('${r.noteId}')`;
        } else if (r.isFlashcard) {
          onclickHandler = `navigateToFlashcard('${r.deckId}')`;
        } else if (r.isSession) {
          onclickHandler = `navigateToSession('${r.sessionId}')`;
        } else {
          onclickHandler = `navigateToSearchResult(${JSON.stringify(r.path).replace(/"/g, '&quot;')}, '${r.url || ''}')`;
        }
        
        return `
          <div class="search-result-item" onclick="${onclickHandler}">
            <i class="fas ${icon}"></i>
            <div class="search-result-info">
              <span class="search-result-name">${escapeHtml(r.name)}</span>
              <span class="search-result-path">${r.path.join(' > ')}</span>
            </div>
          </div>
        `;
      }).join('');
    }
    searchResults.style.display = 'block';
  }
}

function searchInDocuments(obj, currentPath, query, results) {
  for (const key in obj) {
    const newPath = [...currentPath, key];
    const value = obj[key];
    
    if (key.toLowerCase().includes(query)) {
      results.push({
        name: key,
        path: newPath,
        isFolder: typeof value === 'object',
        url: typeof value === 'string' ? value : null
      });
    }
    
    if (typeof value === 'object' && value !== null) {
      searchInDocuments(value, newPath, query, results);
    }
  }
}

function navigateToSearchResult(pathArray, url) {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.style.display = 'none';
  
  document.getElementById('globalSearch').value = '';
  
    showView('home');
  setActiveNav('homeNav');
  
  if (url && url !== '#' && url !== '') {
        path = pathArray.slice(0, -1);
    updateBreadcrumb();
    
        const title = pathArray[pathArray.length - 1];
    addToRecent(title, pathArray, url);
    
        setTimeout(() => {
      showPDF(url);
    }, 100);
  } else {
        path = [...pathArray];
    renderTiles(getCurrentLevel());
    updateBreadcrumb();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showConfirmModal(title, message, onConfirm, onCancel) {
    const existing = document.querySelector('.confirm-modal-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-modal-icon">
        <i class="fas fa-trash-alt"></i>
      </div>
      <h3 class="confirm-modal-title">${escapeHtml(title)}</h3>
      <p class="confirm-modal-message">${escapeHtml(message)}</p>
      <div class="confirm-modal-actions">
        <button class="btn btn-cancel" id="confirmModalCancel">Cancel</button>
        <button class="btn btn-danger" id="confirmModalConfirm">Delete</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
    const cancelBtn = document.getElementById('confirmModalCancel');
  cancelBtn.onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };
  
    const confirmBtn = document.getElementById('confirmModalConfirm');
  confirmBtn.onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };
  
    overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  };
  
    const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
      if (onCancel) onCancel();
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function setActiveNav(navId) {
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeNav = document.getElementById(navId);
  if (activeNav) activeNav.classList.add('active');
}

function loadDocuments() { console.log('loadDocuments called'); }
function trackDailyAccess() { 
  console.log('trackDailyAccess called');
  const today = new Date().toISOString().split('T')[0];
  const accessData = JSON.parse(localStorage.getItem('questionary-daily-access') || '{}');
  accessData[today] = (accessData[today] || 0) + 1;
  localStorage.setItem('questionary-daily-access', JSON.stringify(accessData));
}
function saveUserPreferences() {  }

function renderTiles(docs) {
  const container = document.getElementById('tilesContainer');
  if (!container) {
    console.error('tilesContainer not found');
    return;
  }
  
  container.innerHTML = '';
  
  if (!docs || Object.keys(docs).length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No documents available.</p>';
    return;
  }
  
    const sortOrder = localStorage.getItem('questionary-sort-order') || 'asc';
  const keys = Object.keys(docs).sort((a, b) => {
    return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  });
  
  keys.forEach(key => {
    const value = docs[key];
    const isFolder = typeof value === 'object';
    
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `
      <div class="tile-icon">
        <i class="fas ${isFolder ? 'fa-folder' : 'fa-file-pdf'}"></i>
      </div>
      <div class="tile-text">${escapeHtml(key)}</div>
      ${!isFolder ? `<button class="tile-favorite" onclick="event.stopPropagation(); toggleFavorite('${escapeHtml(key)}', ${JSON.stringify([...path, key]).replace(/"/g, '&quot;')}, '${escapeHtml(value)}')" title="Toggle Favorite"><i class="fas fa-star"></i></button>` : ''}
    `;
    
    tile.onclick = () => {
      if (isFolder) {
        path.push(key);
        renderTiles(value);
        updateBreadcrumb();
      } else {
                addToRecent(key, [...path, key], value);
        showPDF(value);
      }
    };
    
    container.appendChild(tile);
  });
  
    updateDashboardStats();
}

function updateBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  const backBtn = document.getElementById('backBtn');
  
  if (!breadcrumb) return;
  
    breadcrumb.innerHTML = '';
  
    const homeSpan = document.createElement('span');
  homeSpan.className = 'breadcrumb-item';
  homeSpan.textContent = 'Home';
  homeSpan.onclick = function() {
    navigateToPath([]);
  };
  breadcrumb.appendChild(homeSpan);
  
    let currentPath = [];
  path.forEach((segment, index) => {
    currentPath.push(segment);
    const pathCopy = [...currentPath];
    
        const separator = document.createElement('i');
    separator.className = 'fas fa-chevron-right';
    separator.style.cssText = 'font-size: 0.7rem; opacity: 0.5; margin: 0 0.5rem;';
    breadcrumb.appendChild(separator);
    
        const segmentSpan = document.createElement('span');
    segmentSpan.className = 'breadcrumb-item';
    segmentSpan.textContent = segment;
    segmentSpan.onclick = function() {
      navigateToPath(pathCopy);
    };
    breadcrumb.appendChild(segmentSpan);
  });
  
  if (backBtn) {
    backBtn.style.display = path.length > 0 ? 'flex' : 'none';
  }
}

function navigateToPath(newPath) {
  console.log('navigateToPath called with:', newPath);
  
    const pdfViewer = document.getElementById('pdfViewer');
  if (pdfViewer) {
    pdfViewer.style.cssText = 'display: none !important;';
    pdfViewer.classList.remove('active');
    pdfViewer.src = '';
  }
  
    const tilesContainer = document.getElementById('tilesContainer');
  const sectionHeader = document.querySelector('#tilesSection .section-header');
  const dashboardHeader = document.querySelector('.dashboard-header');
  const tilesSection = document.getElementById('tilesSection');
  
  if (tilesSection) tilesSection.style.display = 'block';
  if (tilesContainer) tilesContainer.style.display = 'grid';
  if (sectionHeader) sectionHeader.style.display = 'flex';
  if (dashboardHeader) dashboardHeader.style.display = newPath.length === 0 ? 'flex' : 'none';
  
    if (typeof hideTimerCompletely === 'function') hideTimerCompletely();
  
    path = newPath;
  
    let level = documents;
  for (const segment of path) {
    if (level && typeof level === 'object' && level[segment]) {
      level = level[segment];
    } else {
            path = [];
      level = documents;
      break;
    }
  }
  
  renderTiles(level);
  updateBreadcrumb();
}

window.navigateToPath = navigateToPath;

function getCurrentLevel() {
  let current = documents;
  for (const segment of path) {
    if (current && typeof current === 'object' && current[segment]) {
      current = current[segment];
    } else {
      return documents;
    }
  }
  return current;
}

function updateDashboardStats() {
    let totalDocs = 0;
  function countDocs(obj) {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'string') {
                if (value && value !== '#' && value.trim() !== '') {
          totalDocs++;
        }
      } else if (typeof value === 'object' && value !== null) {
        countDocs(value);
      }
    }
  }
  countDocs(documents);
  
  const totalDocsEl = document.getElementById('totalDocuments');
  if (totalDocsEl) totalDocsEl.textContent = totalDocs;
  
  const favoriteCountEl = document.getElementById('favoriteCount');
  if (favoriteCountEl) favoriteCountEl.textContent = favorites.length;
  
  const recent = JSON.parse(localStorage.getItem('questionary-recent') || '[]');
  const recentCountEl = document.getElementById('recentCount');
  if (recentCountEl) recentCountEl.textContent = recent.length;
  
  const streakEl = document.getElementById('dashboardStreak');
  if (streakEl) streakEl.textContent = studyStats.streak || 0;
}

function showPDF(url) { 
  console.log('showPDF called with:', url);
  
  if (!url || url === '' || url === '#') {
    console.error('Invalid PDF URL');
    return;
  }
  
  const pdfViewer = document.getElementById('pdfViewer');
  const tilesContainer = document.getElementById('tilesContainer');
  const sectionHeader = document.querySelector('#tilesSection .section-header');
  const dashboardHeader = document.querySelector('.dashboard-header');
  const breadcrumbContainer = document.querySelector('.breadcrumb-container');
  const tilesSection = document.getElementById('tilesSection');
  
    if (pdfViewer) {
    pdfViewer.src = url;
    pdfViewer.classList.add('active');
    pdfViewer.style.cssText = '';     console.log('PDF viewer should now be visible, src:', url);
  } else {
    console.error('PDF viewer element not found!');
    return;
  }
  
    if (tilesSection) tilesSection.style.display = 'block';
  
    if (tilesContainer) tilesContainer.style.display = 'none';
  if (sectionHeader) sectionHeader.style.display = 'none';
  if (dashboardHeader) dashboardHeader.style.display = 'none';
  
    if (breadcrumbContainer) breadcrumbContainer.style.display = 'flex';
  
    updateBreadcrumb();
  
    const timerPanel = document.getElementById('timerPanel');
  if (timerPanel) timerPanel.style.display = 'flex';
  
    if (typeof initializeTimer === 'function') initializeTimer();
  
    if (typeof trackPdfViewStart === 'function') trackPdfViewStart();
}

function closePDF() {
  const pdfViewer = document.getElementById('pdfViewer');
  const tilesContainer = document.getElementById('tilesContainer');
  const sectionHeader = document.querySelector('#tilesSection .section-header');
  const dashboardHeader = document.querySelector('.dashboard-header');
  
  if (pdfViewer) {
    pdfViewer.style.cssText = 'display: none !important;';
    pdfViewer.classList.remove('active');
    pdfViewer.src = '';
  }
  
  if (tilesContainer) tilesContainer.style.display = 'grid';
  if (sectionHeader) sectionHeader.style.display = 'flex';
  if (dashboardHeader && path.length === 0) dashboardHeader.style.display = 'flex';
  
  if (typeof hideTimerCompletely === 'function') hideTimerCompletely();
  
    if (typeof trackPdfViewEnd === 'function') trackPdfViewEnd(path.join('/'));
}

function renderAnalytics() {
  console.log('renderAnalytics called');
  
    const accessData = JSON.parse(localStorage.getItem('questionary-daily-access') || '{}');
  const recent = JSON.parse(localStorage.getItem('questionary-recent') || '[]');
  const subjectAccess = JSON.parse(localStorage.getItem('questionary-subject-access') || '{}');
  
    const totalSessions = Object.values(accessData).reduce((sum, count) => sum + count, 0);
  const totalDocsViewed = recent.length;
  const daysActive = Object.keys(accessData).length;
  const avgSessionsPerDay = daysActive > 0 ? (totalSessions / daysActive).toFixed(1) : 0;
  
    const totalSessionsEl = document.getElementById('totalSessions');
  const totalDocsViewedEl = document.getElementById('totalDocsViewed');
  const daysActiveEl = document.getElementById('daysActive');
  const avgSessionsEl = document.getElementById('avgSessions');
  
  if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
  if (totalDocsViewedEl) totalDocsViewedEl.textContent = totalDocsViewed;
  if (daysActiveEl) daysActiveEl.textContent = daysActive;
  if (avgSessionsEl) avgSessionsEl.textContent = avgSessionsPerDay;
  
    renderAccessChart(accessData);
  renderSubjectChart(subjectAccess);
  renderRecentActivity(recent);
}
function renderCalendar() { 
  const calendarGrid = document.getElementById('calendarDays') || document.getElementById('calendarGrid');
  const currentMonthEl = document.getElementById('currentMonth');
  if (!calendarGrid) return;
  
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  if (currentMonthEl) {
    currentMonthEl.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const dateStr = date.toISOString().split('T')[0];
    const sessionsOnDay = studySessions.filter(s => s.date === dateStr);
    
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${sessionsOnDay.length > 0 ? 'has-session' : ''}" 
           onclick="showDaySessions('${dateStr}')">
        <span class="day-number">${day}</span>
        ${sessionsOnDay.length > 0 ? `<span class="session-dot">${sessionsOnDay.length}</span>` : ''}
      </div>
    `;
  }
  
  calendarGrid.innerHTML = html;
}
function renderSessions() { 
  const container = document.getElementById('sessionsList') || document.getElementById('sessionsContainer');
  if (!container) return;
  
  if (studySessions.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No study sessions scheduled. Click "Add Session" to create one.</p>';
    return;
  }
  
  const sorted = [...studySessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  container.innerHTML = sorted.map(session => `
    <div class="session-item">
      <div class="session-info">
        <strong>${escapeHtml(session.subject)}</strong>
        <span>${session.date} at ${session.time}</span>
      </div>
      <button class="btn-icon" onclick="deleteSession('${session.id}')" title="Delete session">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}
function renderFlashcardDecks() { 
  const container = document.getElementById('flashcardsGrid') || document.getElementById('flashcardDecksContainer');
  if (!container) return;
  
  if (flashcardDecks.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No flashcard decks yet. Click "New Deck" to create one.</p>';
    return;
  }
  
  container.innerHTML = flashcardDecks.map(deck => `
    <div class="deck-card">
      <h4>${escapeHtml(deck.name)}</h4>
      <p>${deck.cards.length} cards</p>
      <button class="btn-icon delete" onclick="event.stopPropagation(); deleteDeck('${deck.id}')" title="Delete deck">
        <i class="fas fa-trash"></i>
      </button>
      <button class="btn btn-primary btn-sm" onclick="startStudyDeck('${deck.id}')" style="margin-top: 1rem;">
        <i class="fas fa-play"></i> Study
      </button>
    </div>
  `).join('');
}
function renderNotes() { 
  const container = document.getElementById('notesGrid') || document.getElementById('notesContainer');
  if (!container) return;
  
  if (notes.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No notes yet. Click "New Note" to create one.</p>';
    return;
  }
  
  container.innerHTML = notes.map(note => `
    <div class="note-card" onclick="editNote('${note.id}')">
      <h4>${escapeHtml(note.title)}</h4>
      <p>${escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</p>
      <small>${new Date(note.updatedAt).toLocaleDateString()}</small>
      <button class="btn-icon delete" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete note">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}
function updateProgressDisplay() { console.log('updateProgressDisplay called'); }
function renderQuickLinks() { console.log('renderQuickLinks called'); }
function saveQuickLinks() { localStorage.setItem('questionary-quick-links', JSON.stringify(quickLinks)); }
function loadQuickLinks() { quickLinks = JSON.parse(localStorage.getItem('questionary-quick-links') || '[]'); }
function trackStudyTime(minutes) { 
  console.log('Tracked study time:', minutes);
  studyStats.totalTime = (studyStats.totalTime || 0) + minutes;
  localStorage.setItem('questionary-study-stats', JSON.stringify(studyStats));
}

function updateDocProgress(docPath, progress) { 
  console.log('Updated progress:', docPath, progress);
  documentProgress[docPath] = { progress, lastAccessed: Date.now() };
  localStorage.setItem('questionary-doc-progress', JSON.stringify(documentProgress));
}

function trackSubjectAccess(subjectName) {
  if (!subjectName) return;
  const subjectAccess = JSON.parse(localStorage.getItem('questionary-subject-access') || '{}');
  subjectAccess[subjectName] = (subjectAccess[subjectName] || 0) + 1;
  localStorage.setItem('questionary-subject-access', JSON.stringify(subjectAccess));
}

function renderAccessChart(accessData) {
  const container = document.getElementById('accessChart');
  if (!container) return;
  
    const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({
      date: dateStr,
      day: dayName,
      count: accessData[dateStr] || 0
    });
  }
  
  const maxCount = Math.max(...days.map(d => d.count), 1);
  
  container.innerHTML = `
    <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 140px; gap: 8px; padding: 10px 0;">
      ${days.map(d => `
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
          <div style="
            width: 100%;
            max-width: 40px;
            height: ${Math.max((d.count / maxCount) * 100, 8)}px;
            background: ${d.count > 0 ? 'var(--primary-color)' : 'var(--border)'};
            border-radius: 4px 4px 0 0;
            transition: height 0.3s ease;
          " title="${d.count} sessions"></div>
          <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 6px;">${d.day}</span>
          <span style="font-size: 0.7rem; color: var(--text-primary); font-weight: 600;">${d.count}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSubjectChart(subjectAccess) {
  const container = document.getElementById('subjectChart');
  if (!container) return;
  
  const subjects = Object.entries(subjectAccess)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (subjects.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <i class="fas fa-chart-pie" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
        <p style="margin: 0;">No subject data yet. Browse some documents!</p>
      </div>
    `;
    return;
  }
  
  const maxCount = subjects[0][1];
  const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b'];
  
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${subjects.map(([name, count], i) => `
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${escapeHtml(name)}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${count} views</span>
          </div>
          <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
            <div style="
              width: ${(count / maxCount) * 100}%;
              height: 100%;
              background: ${colors[i % colors.length]};
              border-radius: 4px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentActivity(recent) {
  const container = document.getElementById('recentActivityList');
  if (!container) return;
  
  const recentItems = recent.slice(0, 10);
  
  if (recentItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <i class="fas fa-clock" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
        <p style="margin: 0;">No recent activity yet.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = recentItems.map(item => {
    const timeAgo = getTimeAgo(item.timestamp);
    return `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; background: var(--surface-hover); margin-bottom: 8px;">
        <i class="fas fa-file-pdf" style="color: var(--primary-color); font-size: 1.1rem;"></i>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.title)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

window.navigateToSearchResult = navigateToSearchResult;

function navigateToNote(noteId) {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.style.display = 'none';
  document.getElementById('globalSearch').value = '';
  
  showView('notes');
  setActiveNav('notesNav');
  
    setTimeout(() => {
    if (typeof editNote === 'function') {
      editNote(noteId);
    }
  }, 100);
}

function navigateToFlashcard(deckId) {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.style.display = 'none';
  document.getElementById('globalSearch').value = '';
  
  showView('flashcards');
  setActiveNav('flashcardsNav');
  
    setTimeout(() => {
    if (typeof startStudyDeck === 'function') {
      startStudyDeck(deckId);
    }
  }, 100);
}

function navigateToSession(sessionId) {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.style.display = 'none';
  document.getElementById('globalSearch').value = '';
  
  showView('planner');
  setActiveNav('studyPlannerNav');
  
    setTimeout(() => {
    const session = studySessions.find(s => s.id === sessionId);
    if (session) {
      showNotification(`Session: ${session.subject} on ${session.date} at ${session.time}`, 'info');
    }
  }, 100);
}

window.navigateToNote = navigateToNote;
window.navigateToFlashcard = navigateToFlashcard;
window.navigateToSession = navigateToSession;





function loadNotes() {
  notes = JSON.parse(localStorage.getItem('questionary-notes') || '[]');
}

function saveNotes() {
  localStorage.setItem('questionary-notes', JSON.stringify(notes));
}

function openNoteModal(noteId = null) {
  const modal = document.getElementById('noteModal');
  const titleInput = document.getElementById('noteTitle');
  const contentInput = document.getElementById('noteContent');
  const modalTitle = document.getElementById('noteModalTitle');
  
  if (!modal) { console.error('Note modal not found'); return; }
  
  if (noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      currentEditingNote = note;
      if (titleInput) titleInput.value = note.title;
      if (contentInput) contentInput.value = note.content;
      if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-sticky-note"></i> Edit Note';
    }
  } else {
    currentEditingNote = null;
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-sticky-note"></i> Create Note';
  }
  
  modal.classList.add('active');
}

function saveNote() {
  const titleInput = document.getElementById('noteTitle');
  const contentInput = document.getElementById('noteContent');
  const modal = document.getElementById('noteModal');
  
  const title = titleInput?.value.trim();
  const content = contentInput?.value.trim();
  
  if (!title) {
    showNotification('Please enter a title', 'error');
    return;
  }
  
  if (currentEditingNote) {
    currentEditingNote.title = title;
    currentEditingNote.content = content;
    currentEditingNote.updatedAt = Date.now();
  } else {
    notes.push({
      id: Date.now().toString(),
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  
  saveNotes();
  renderNotes();
  modal?.classList.remove('active');
  showNotification(currentEditingNote ? 'Note updated!' : 'Note created!', 'success');
  currentEditingNote = null;
}

function editNote(noteId) {
  openNoteModal(noteId);
}

function deleteNote(noteId) {
  const note = notes.find(n => n.id === noteId);
  const noteTitle = note ? note.title : 'this note';
  
  showConfirmModal(
    'Delete Note',
    `Are you sure you want to delete "${noteTitle}"? This action cannot be undone.`,
    () => {
      notes = notes.filter(n => n.id !== noteId);
      saveNotes();
      renderNotes();
      showNotification('Note deleted', 'info');
    }
  );
}
let documents = {
    "Study Material Class 9": {
        "Physics FT": {
            "Upthrust in Fluids, Archimedes' Principle and Floatation": "https://drive.google.com/file/d/1A5IbecU77W4krqBj2zaiahZh46Q8Je6E/preview", "Heat and Energy": "https://drive.google.com/file/d/1pyvt2igU8prlMty5nwhhi6woR6a3RSeJ/preview", "Reflection of Light": "https://drive.google.com/file/d/1Fo6DpHIp658q9JiFfzf4I8puPhph0WoA/preview", "Propagation of Sound Waves": "https://drive.google.com/file/d/1uxLKeXoP5LOP-kI9B4EhHmvKrpka5A6M/preview", "Current Electricity": "https://drive.google.com/file/d/1a8oXvkZPDJpTZKRO8-lYcvk1uuLB39I8/preview", "Magnetism": "https://drive.google.com/file/d/1ijJWkhghtNb2I5Z1bOeClcA9Mg8l4Qf7/preview"},
        "Biology Class 10 Book PDFS": {
            "Excretory System": "https://drive.google.com/file/d/16b4aqhobYQm_XqXgadk5383J-Mkq6bNm/preview", "Full Book": "https://drive.google.com/file/d/1NCj_IUP8Kss0gQ3uj6cUBtLMNqKvkIRI/preview", "Endocrine System": "https://drive.google.com/file/d/1REKQFiPyzOvM9n7GB1hnoThTSkrpePT4/preview"

		}
    },
    "2025-26": {
        "CL 9": {
            "MT 1": {
                "Bengali": "https://drive.google.com/file/d/1yjjRkhDJhZVd1FHWV82ez2_GAoFji_cZ/preview", "English Language": "https://drive.google.com/file/d/1CowuymNfNqICaN-Yk9HG_P1KjoiDfdJ2/preview", "English Literature": "https://drive.google.com/file/d/1CowuymNfNqICaN-Yk9HG_P1KjoiDfdJ2/preview", "French": "https://drive.google.com/file/d/13W1vnNvhdVZi9m1b8V412Y-smnMyrLMM/preview", "German": "https://drive.google.com/file/d/1qh80OY4hSuqowBAAw7Ip2tlwSJxdWtcW/preview",
                "Hindi": "https://drive.google.com/file/d/1FZ3fUHkvI_U30Xv7AxgeVm4G0y2G1Hpk/preview", "History": "https://drive.google.com/file/d/FILE_ID/preview", "Geography": "https://drive.google.com/file/d/FILE_ID/preview", "Commerce": "https://drive.google.com/file/d/1VWtKb02OAPqvJbOModwQg1q5QcvfiCYa/preview", "EVS": "https://drive.google.com/file/d/1Uzzwu2zEHv6az5C_zMcTPaviToSg9Ck9/preview", "Home Science": "https://drive.google.com/file/d/1gxfzcZ0ULG1zGfALpVTiz5kFFuWrGtv8/preview",
                "Math": "https://drive.google.com/file/d/1GdK4fATuaKY5gjdtAwdoAlwbRxjClX9o/preview", "Physics": "https://drive.google.com/file/d/19FH5N__eOoYng5niWrRPbUIwrGv8fqE4/preview", "Chemistry": "https://drive.google.com/file/d/1-zc_ySK3_VChlX6UtyIVsZj4Rwp7Tutd/preview", "Biology": "https://drive.google.com/file/d/1je9WRmONUAUEPIdXbtKnHfRq__uUQ2LL/preview", "Computer": "https://drive.google.com/file/d/1oCeM3QDLBHcBu5r6lr4z-Z0p-6O4NNpZ/preview", "RAI": "https://drive.google.com/file/d/1oJYFlEOD7F1qgYeGpdyM7rHLP1tzqlss/preview",
                "Economics": "https://drive.google.com/file/d/1zb5I5BngNEIe2UaWWNmsgktUsnVUa-_4/preview", "EVA": "https://drive.google.com/file/d/1kJuxbztbd-9eGV11psKlNDEWyfb8L-Xr/preview", "PE": "https://drive.google.com/file/d/1mDjZY3bi5TM6kRT8OEJzsuwPcdpaNUat/preview"
            },
            "MT 2": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "HY": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "FT": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            }
        },
        "CL 10": {
            "MT 1": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "MT 2": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "HY": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "FT": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            }
        },
        "CL 11": {
            "MT 1": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "MT 2": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "HY": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "FT": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            }
        },
        "CL 12": {
            "MT 1": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "MT 2": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "HY": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            },
            "FT": {
                "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#",
                "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#",
                "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#",
                "Economics": "#", "EVA": "#", "PE": "#"
            }
        }
    },
    "2024-25": {
        "CL 9": {
            "MT 1": { "Bengali": "https://drive.google.com/file/d/1cIYGqG4UCVHo4s-tEZ2D59aLyQ6sxlCM/preview", "English Language": "https://drive.google.com/file/d/14aPyDYCpIRBPMqcnxndFkzzs8tenRVRh/preview", "English Literature": "https://drive.google.com/file/d/1LslhWbv0H_4MZLzWAU-4KX223T7RcO4V/preview", "French": "https://drive.google.com/file/d/1nzwSNFO9baR0GrT1urCmNMUGJqJizRWH/preview", "German": "#", "Hindi": "https://drive.google.com/file/d/1Xg-2sxfwZIvfP3j4kg2VTiP9SRO6lVib/preview", "History": "https://drive.google.com/file/d/1fFE6NSeLQl-tm4FMuHz72686A6p1-oZ2/preview", "Geography": "https://drive.google.com/file/d/1FGi6dQLs5jK6EsftRIIjrBK2EluvktYg/preview", "Commerce": "https://drive.google.com/file/d/1cvP7Dn00dNBMmwQmUtj2n5puCfacCQ6R/preview", "EVS": "https://drive.google.com/file/d/1ZvjRuneUyioDHXeC7PnH7yuG8dPinMpr/preview", "Home Science": "https://drive.google.com/file/d/1gOIwAbJqtrHSaXtwygVQQPpcgBoUZugJ/preview", "Math": "https://drive.google.com/file/d/1BogiVeOYHykB8-m_osdnAtdUIJTdprwF/preview", "Physics": "https://docs.google.com/document/d/1LoZ8DVr6TWjBwHF4osfuVmxn521jjACV/export?format=pdf", "Chemistry": "https://drive.google.com/file/d/1PBqrFh6XqItUcjAtlhLQ208cn0F5Q6iV/preview", "Biology": "https://drive.google.com/file/d/19BpXVTP3gxDVzChEb6wDm4F6GLlzpNqT/preview", "Computer": "https://drive.google.com/file/d/1yXuEl8ZwlfaWhR5kx-nQvmRH5LHL2Y5w/preview", "RAI": "https://drive.google.com/file/d/1w0kfCiKP4ALiq1fQy9fZVg0Ey1Fpw3II/preview", "Economics": "https://drive.google.com/file/d/1oidrgY15uBtvN8fQNmrDxO__Lfnfpui/preview", "EVA": "https://drive.google.com/file/d/1DZ_sL0vomeqY9HDpgi6YamlRg0nD1sa-/preview", "PE": "https://drive.google.com/file/d/1M_kg2_nN6JnYQROcS3rNUjaYNgXX9LXn/preview" },
            "MT 2": { "Bengali": "https://drive.google.com/file/d/10DtfWHt396FVG4t_7oIAa1jk9Y11-cFZ/preview", "English Language": "https://drive.google.com/file/d/1j9XrQ7TFUnmkxSXk8lA-xQr_2IIkoP72/preview", "English Literature": "https://drive.google.com/file/d/13jX8zYM9SMLQN-szoZfZI6pnjbuh64ro/preview", "French": "https://drive.google.com/file/d/12fEF2VtcZ-dNpVb4MgrF33jt6SPF9Ycf/preview", "German": "https://drive.google.com/file/d/1cxFdBoI3p3Lnj1gjp1chxhkQ5Sl_mXLP/preview", "Hindi": "https://drive.google.com/file/d/1eRiAOqDmCKYskpZvmu2co3Z4UaYywUxU/preview", "History": "https://drive.google.com/file/d/1pp7cTB33KIissIppMoEkDx9grFWIoZNm/preview", "Geography": "https://drive.google.com/file/d/15891P9LXYPaf5P6kbEp1CMTJNbw7HIDv/preview", "Commerce": "https://drive.google.com/file/d/1npz0e7qxiCafKUWLitoGm_tolrHO5Jdy/preview", "EVS": "https://drive.google.com/file/d/1n1HjjD2b-h76ra_gEu-rus01rWcCfx8-/preview", "Home Science": "https://drive.google.com/file/d/1WEpX2gw1x2aekhFQ4NKBs2_1rFTd9zMx/preview", "Math": "https://drive.google.com/file/d/1FIlm-AXJ2AK9ILH_xcoUF1YDe3EY92M9/preview", "Physics": "https://drive.google.com/file/d/1OCG4erOJrkHTcHlJPGT1wOMmh-sIY6_M/preview", "Chemistry": "https://drive.google.com/file/d/1VOAoCBiBGyXhIJXt1jAYDaxMJCn-nO-E/preview", "Biology": "https://drive.google.com/file/d/18MVLcSHliFMXzY8mekZn46u-Jd1yJP2Q/preview", "Computer": "https://drive.google.com/file/d/1SdUvZDAW6GJes3EZhSTHkPygYwKz1X0Z/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1HLzvCm_b5XqIYgezey7tRN9AW5uLdy23/preview", "EVA": "https://drive.google.com/file/d/1gjPmZzpz3FPskyp91f2gcpLyoQjO-7ji/preview", "PE": "https://drive.google.com/file/d/133c-aWy3UCsaeS044nABj500z6IFioWz/preview" },
            "HY": { "English Language": "https://drive.google.com/file/d/1zmUPYKbHbymDx5RmTj47O9P-K4YZNnDH/preview", "English Literature": "https://drive.google.com/file/d/18a1dSMXeOTGDA4l-BWfUwDIJB8iqAVyY/preview", "French": "https://drive.google.com/file/d/1sntn898IFgaeOuY77NHfkS8qg4uDHpUt/preview", "German": "https://drive.google.com/file/d/1nKMb5kxN5fQRdrhrFfGaETIZsKWnSSgC/preview", "Hindi": "https://drive.google.com/file/d/1OXnsKkqLpuks_Wq6wtj3wDCqGR69Z1CU/preview", "History": "https://drive.google.com/file/d/12LvFdtJMYeMSG3eb5mIiVONur2gq5SWa/preview", "Geography": "https://drive.google.com/file/d/1ScozekGSAoHu7Eexhm55Z0kE1hkb4Rlg/preview", "Commerce": "https://drive.google.com/file/d/1Uc2mB6JZN6gm7TyBK-JXhfAPfFmUNkYI/preview", "EVS": "https://drive.google.com/file/d/1vFwI2f0n1A3-aXQWCYRfGXxAD7WN0PUg/preview", "Home Science": "https://drive.google.com/file/d/1lcPxelAdqXUbg6vI6zC_AIypcvPaoOj3/preview", "Math": "https://drive.google.com/file/d/1Z-qYXEB5gxGOZx91sTAiKun33hGit8nP/preview", "Physics": "https://drive.google.com/file/d/1ptuhY6EuhLq-nLkXJeILBOr4J6xHtHqQ/preview", "Chemistry": "https://drive.google.com/file/d/1zDnKoQlTl7qqaIRj9FuEWBLTBNstISRK/preview", "Biology": "https://drive.google.com/file/d/1YQeAzNUjgFu6D5sQ6khdaIduiSar5knC/preview", "Computer": "https://drive.google.com/file/d/1ybGbb-JGwGmYz2Bvj1wSGbbt-QWAXPP5/preview", "RAI": "https://drive.google.com/file/d/1R5FhCBZiZ4touw2rTnYFQ6j7XsPtfmr3/preview", "Economics": "https://drive.google.com/file/d/1yUh1SGsXY43pBdngmQaTmTTKHZDF0SF7/preview", "EVA": "https://drive.google.com/file/d/1kNmheEUvq7Uq_GJ68RLwFzxfIGNZ3x2x/preview", "PE": "https://drive.google.com/file/d/16Id1gxjYTsQ9LY-n6W21rA67obGuldvi/preview" },
            "FT": { "Bengali": "https://drive.google.com/file/d/1HgLAkHfKdHABjEoqL74c1lpPE1RkNCZn/preview", "English Language": "https://drive.google.com/file/d/1G2CrnFbyocuTMAmNWNd0RmUt_cg-iP7I/preview", "English Literature": "https://drive.google.com/file/d/1AjiRg37wZSd9eFw2mgLY0FRm69eayW15/preview", "French Literature": "https://drive.google.com/file/d/1FDjJ84Llb7w9u79a8SbjY0llBbqr_aUV/preview", "French Language": "https://drive.google.com/file/d/1f7SNYZTSTShlgDUlXqjrrvatRZ0dpYQg/preview", "German": "https://drive.google.com/file/d/1pR2h7YFD2raqDAGiSxLY84JP77_FP8l2/preview", "Hindi": "https://drive.google.com/file/d/1_AEp8S9JC0gVDHV0gXuXhhuQLZxuYUow/preview", "History": "https://drive.google.com/file/d/1vu6UgCqBGKJk0SnQDudVuXwTYVBbb_zc/preview", "Geography": "https://drive.google.com/file/d/1pRP6NyHvgkM1z97MbbS1VJ4JTs0nBqUE/preview", "Commerce": "https://drive.google.com/file/d/1nfg_owhPyIppRFLL5HZJ__wAxJEqbT15/preview", "EVS": "https://drive.google.com/file/d/1T4m1pUK8oGgrzqJA5GRy6Vpl5Vwr8P_J/preview", "Home Science": "https://drive.google.com/file/d/1FaF2WXejrgLfJb26Kb9cqXWZVi1aJj4i/preview", "Math": "https://drive.google.com/file/d/1xCUXZ1SYV0D0mSaShs5Bcc_W-tP8cOZV/preview", "Physics": "https://drive.google.com/file/d/19ahVLGkZyGo-vjATSBqCyxOQ__kEPBMT/preview", "Chemistry": "https://drive.google.com/file/d/1WC9-hLU78E1ORWm3FQ-I7z1Yhoag2-YG/preview", "Biology": "https://drive.google.com/file/d/1ro72l8Ir5GFl1uLYG89kJ1nPoAIjxV_l/preview", "Computer": "https://drive.google.com/file/d/1arhoEIO0xNtwKT78qznijpUDTMnMGf64/preview", "RAI": "https://drive.google.com/file/d/1re9cS9an8eOVfThxvJqRmL1t2C2tqnHG/preview", "Economics": "https://drive.google.com/file/d/1Xxi4ZQR4fUDH6lnlq5_wovUdWzvRU5VW/preview", "EVA": "https://drive.google.com/file/d/1IPkgrMQz-xr2dW3b82Bng4UINxkWyis4/preview", "PE": "https://drive.google.com/file/d/1ywJAJyHxpYfVxzYqOlnVf0TWI318SfwT/preview" }
        },
        "CL 10": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 11": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 12": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        }
    },
    "2023-24": {
        "CL 9": {
            "MT 1": { "Bengali": "https://drive.google.com/file/d/1c-vK0rN4aK7WB2FwcQBXwDRQtmQrxoY1/preview", "English Language": "https://drive.google.com/file/d/1XRxkJ51D0WQlGZtspAN-2GDdFnuRWLoh/preview", "English Literature": "https://drive.google.com/file/d/1eKaHOmhH43gLa4Smqn-XkV_0R51SQw1i/preview", "French": "https://drive.google.com/file/d/1olQzT5DMAx7AUq4IfihYS8OfjDeVfNnY/preview", "German": "https://drive.google.com/file/d/1cuKc32YbOVz34eU_exQBgML_jtzc7eAb/preview", "Hindi": "https://drive.google.com/file/d/1yCt_8iK_LyDBUWYkPf5YQ1F3RbKRhuMX/preview", "History": "https://drive.google.com/file/d/1K6ID-rFDy4iP7UfqM2emBzfM09jqiiSK/preview", "Geography": "https://drive.google.com/file/d/1sh4Yr3vd50zqSz3rbkuoHK48eikEjcpl/preview", "Commerce": "https://drive.google.com/file/d/1Zdf-0wnp-9rAIj4Ak4e1vRgeFMUXC_gZ/preview", "EVS": "https://drive.google.com/file/d/1zHNZU9V7NkJt2qiNNLxNvcIDFXJTfTqo/preview", "Home Science": "https://drive.google.com/file/d/1hkAyDM1cJxitJ9YlO5ix1kAbKZ8Oirgx/preview", "Math": "https://drive.google.com/file/d/1BTzi6LrA7quOc7LeexAlhhxmyy5Jaquk/preview", "Physics": "#", "Chemistry": "https://drive.google.com/file/d/1bMH502lr-FTOX1eH6zDsMvjKpYOunDkw/preview", "Biology": "https://drive.google.com/file/d/1u-iuo3q4JEKzduxYbsJE4FspIPCBNOzx/preview", "Computer": "https://drive.google.com/file/d/1MQQmJ1if1samEQC5s2LMuaRCLZ2sUjkX/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1GUn4kcW8QTtac2w4-S1vKksQE4cfIDvj/preview", "EVA": "https://drive.google.com/file/d/1xt74vn5dV41lqmtv_75iFF0_nvDO5KfM/preview", "PE": "https://drive.google.com/file/d/1xOQkK1dIsylZcO7K58ZqVvryO9ASHJ5t/preview" },
            "MT 2": {"Bengali": "https://drive.google.com/file/d/1WCHQoAxzRksILhdInch_tR7dSxKIMIz9/preview", "English Language": "https://drive.google.com/file/d/1sE3Lo75N7zCqOHkJnLKK82wv_2E3kBe1/preview", "English Literature": "https://drive.google.com/file/d/1yCHslM7CzHo4sU7C0ibDCl55N85dZ5ZX/preview", "French": "https://drive.google.com/file/d/1ZCVtreQAp63dDhAQ-IQWfI3NgAz3nzBA/preview", "German": "https://drive.google.com/file/d/1FbbMryztQXUyuePl64ugeKMytxoXt0q6/preview", "Hindi": "https://drive.google.com/file/d/1BR0gmTov1tUORXDfQ8Kyymw4VbnfglHZ/preview", "History": "https://drive.google.com/file/d/1TV7bE8O7RC4nGXlNtLombletNFMd9I0E/preview", "Geography": "https://drive.google.com/file/d/1qyA2Nmwy2-yuCpYtOaI3Kx-XayB5BJPL/preview", "Commerce": "https://drive.google.com/file/d/1Es7zC2_IKImREuSfD8rvoMgdUTqPBdIX/preview", "EVS": "https://drive.google.com/file/d/1USZqKLQ7NLjokqpqeNlFseLDykYtF-ih/preview", "Home Science": "https://drive.google.com/file/d/1oXUkrsyYtZNhsbckE2qtkmZGjy8989h2/preview", "Math": "https://drive.google.com/file/d/1ceaETINVcvCPfJ9700A5uRwkbF-o8_Mk/preview", "Physics": "https://drive.google.com/file/d/1Q3XHlixrIOoYMW9TAQ5jDwSfBHsCxLPF/preview", "Chemistry": "https://drive.google.com/file/d/1V36J2SFONwq-NEiJmkwkSXnmmYA5m7s_/preview", "Biology": "https://drive.google.com/file/d/1YvRAf7AaV_y2nmDrs8F-AzqCBUhLhCZ0/preview", "Computer": "https://drive.google.com/file/d/1cb2NryP4B7ZZjhwwNIFTkzgUZG-Mwqz6/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/12xJ0_Y-B-LiZxfCZqyT_mfcFYbn9flP2/preview", "EVA": "https://drive.google.com/file/d/1eijwwhQGRrij0BUEXfRqz5SHRg4FsYLN/preview", "PE": "https://drive.google.com/file/d/1HpJ6gby6l8qlAZrj_lQ-aQKhwlj37bwg/preview"},
            "HY": { "Bengali": "https://drive.google.com/file/d/1d8nCWMSYo6zUMglYguVQA5NJAPzCb4C_/preview", "English Language": "https://drive.google.com/file/d/1Yp25i8XvutlaS4lKxhec2BhAFu0EacoM/preview", "English Literature": "https://drive.google.com/file/d/1MYoMc6VkXnJCaKlhuZo1ZOISfY-7gwBT/preview", "French": "https://drive.google.com/file/d/1SUwPGGJ7ty-kNsVKgKlcdPoh9QYOvTFD/preview", "German": "https://drive.google.com/file/d/1Rg2M7P6LybuxJB_Eb64vlfwqKtwN4qlX/preview", "Hindi": "https://drive.google.com/file/d/19tZwMXTVziAhVMeK4uuNIrkdR6AyO1tt/preview", "History": "https://drive.google.com/file/d/14O0K9dENROEq8UQqQ743bxMob4rIr85o/preview", "Geography": "https://drive.google.com/file/d/1_ZWDxYTTYsXdzBQx9VCdsNcNpls8TEtV/preview", "Commerce": "https://drive.google.com/file/d/11Vrxv_WU6AmwWCaj_Ucsx30yvuUFR1RQ/preview", "EVS": "https://drive.google.com/file/d/1gWIpzZpanMhZl2iS9vR-2Z1_ABJ5liJG/preview", "Home Science": "https://drive.google.com/file/d/1_BMZ03SK1jX4Uhy7QqaiSMevYX8i290k/preview", "Math": "https://drive.google.com/file/d/1BbRYZCMyK448XuIaQrDHgl-73qUFmCIo/preview", "Physics": "https://drive.google.com/file/d/1R84xR6jJqh1WF5mDlmleosHkbbR1hWV3/preview", "Chemistry": "https://drive.google.com/file/d/1mhX9m9f0-Q__qp4ZKz9xdxZy_f69mqmI/preview", "Biology": "https://drive.google.com/file/d/1bdM4NCl16qTan5-NISHFIl0Dl5_kMqPj/preview", "Computer": "https://drive.google.com/file/d/19RADs3dzRcuo8eNnESnhFpYkBwKYn4Ho/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1Xi-vqOqPG4LWnufwns7-gv85NFO_SxcP/preview", "EVA": "https://drive.google.com/file/d/1vgPwG7wFneEMduhAgRyKuUJFwCjNATXc/preview", "PE": "https://drive.google.com/file/d/1hS29MnH1lMMZkdvaXsVuvCeyTKmdN6FK/preview" },
            "FT": {"Bengali": "https://drive.google.com/file/d/1ztnO_qBHt1dx7bXZKN5ROrRIOV8uOJfX/preview", "English Language": "https://drive.google.com/file/d/13QeeEGYSZT4-eKx7jZWJR_-E57vzlywH/preview", "English Literature": "https://drive.google.com/file/d/13KWXa3uqR-0BB_dA5H3RPrNyMosBMAG8/preview", "French": "https://drive.google.com/file/d/18qTTCazjDY0PLCej-3GfxrLMOclcf3Fq/preview", "German": "https://drive.google.com/file/d/1-eRNfpD4XHhRDShcFB3_TjbwBizD0bvt/preview", "Hindi": "https://drive.google.com/file/d/1p3S4yKEU7u4CTffpgHJ_tDx7z-1dhacC/preview", "History": "https://drive.google.com/file/d/17JS7IWmoVZ7BgQGiUi_bEAk31h5YmgGW/preview", "Geography": "https://drive.google.com/file/d/19PxTLnJOlYKY35cv7TDYeTAfCNDao0H4/preview", "Commerce": "https://drive.google.com/file/d/1dPlotdh2xbS20t4kkNBipzrRdVfnZ9NL/preview", "EVS": "https://drive.google.com/file/d/1TMajKcpIiqo2u9cJTm-sZRfz-aqGYl3f/preview", "Home Science": "https://drive.google.com/file/d/1xi8yjOFMUQraLUgB8yE6ToP5I_DPaVRn/preview", "Math": "https://drive.google.com/file/d/1gSe9E9iELORlfB13bGV9p1KqnIq42XKl/preview", "Physics": "https://drive.google.com/file/d/1gZQjzXbMgyqC5Ufb9hHVIxxL5B1UOqs0/preview", "Chemistry": "https://drive.google.com/file/d/1KUQyOabuMmHSb3Q8U7y6nGo13cpfGQPt/preview", "Biology": "https://drive.google.com/file/d/1eBICf8zK8jCnYQU7oyEmGq0MNRs1f4_R/preview", "Computer": "https://drive.google.com/file/d/1oUubC4mQM9E0xFimeYbMhkmeonYseLox/preview", "RAI": "https://drive.google.com/file/d/11OafyEIWJUhjIGaX8hAeTLv1jl7qRSdI/preview", "Economics": "https://drive.google.com/file/d/1kVikKts1Q-rvuCmeir54MI5XIO6ChjLF/preview", "EVA": "https://drive.google.com/file/d/1DbpECUc9f_SK60Enlz2WtA02zQ4J7BGu/preview", "PE": "https://drive.google.com/file/d/1eI60zBGBxFi2ZJ2gzvWrQwSqDlFr5t79/preview"}
        },
        "CL 10": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 11": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 12": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        }
    },
    "2022-23": {
        "CL 9": {
            "MT 1": { "Bengali":"https://drive.google.com/file/d/1uevDlzrhnTWz4lbp4iyKqFLeLHZ9pA6m/preview","English Language":"https://drive.google.com/file/d/1mMZwD6LZuHRoWYz3euxCCHRu0IkpAsEf/preview","English Literature":"https://drive.google.com/file/d/1DYsf7sGFburjV2BZfdwN8qucw6Fq9jWf/preview","French":"https://drive.google.com/file/d/1Wqwyvvi1Jax0uTyyIrTm7I0NtZtISfJw/preview","German":"https://drive.google.com/file/d/1YYyC32MVua1zNTrg0lgtBc0UpZEo7qWT/preview","Hindi":"https://docs.google.com/document/d/1n5eB_cZItHvhmtx_8trylpMSZd5Fk-x5/preview","History":"https://drive.google.com/file/d/1NKKcdcrndSsv0j8-Cpz9CKJ1KMrLm37R/preview","Geography":"https://docs.google.com/document/d/1K7zse0w-xp716jJhfGYP_d7VWF8Ik1NS/preview","Commerce":"https://drive.google.com/file/d/1aqgsVegPbi3NqUc5S1CXwdY9cNdo44nP/preview","EVS":"https://drive.google.com/file/d/1buDuTs7ygNjECQKdfsuNJYPnyH-r7IUa/preview","Home Science":"https://docs.google.com/document/d/1k8fqBsUl64mG8ZdrzIR-SKBolToImK8v/preview","Math":"https://drive.google.com/file/d/1VmJHEBOBg_BnYmMKbxhLiJX6vOMn1G3C/preview","Physics":"https://drive.google.com/file/d/1MMvdgs3M0-VatygCurcXZwIWoeSHFm8C/preview","Chemistry":"https://drive.google.com/file/d/1J2ijVwbneFop6pk-1fv0pxR2prO_s5KA/preview","Biology":"https://drive.google.com/file/d/15bcZBxTwlVEwPsVhLfukxKkrxbuL06Xo/preview","Computer":"https://drive.google.com/file/d/1JV6QXL-HxgBhDayTSDpxID0BAI5HsLXZ/preview","RAI":"#","Economics":"https://docs.google.com/document/d/123Hc3hCtNga0y96Y9lChZlVqVvCyVb8k/preview","EVA":"https://drive.google.com/file/d/1zftl8OFWSv5hQE6NDfa-eIBXArw8tjxN/preview","PE":"https://drive.google.com/file/d/1Hk3b-AIwpS01WEY2KuxWvc8Sc7GM0LS6/preview"},
            "MT2":{"Bengali":"https://drive.google.com/file/d/1zoM0oTMVMqMZaTHZHF7N-8Rne_Rs1tg_/preview","EnglishLanguage":"https://drive.google.com/file/d/1D3RF7Mzn44VWVCqW-q7WeCK22wSvhUYj/preview","EnglishLiterature":"https://drive.google.com/file/d/1HxoGvfbJ1u0BrsVKLte8EDw9Z3jgssaM/preview","French":"https://drive.google.com/file/d/1DGtyNun2ouFzngCV7JbRyqnbCpbFz0wl/preview","German":"https://drive.google.com/file/d/1Vf6t75XTEGdICFnzktQFUEzKx_Ztr4Lg/preview","Hindi":"https://drive.google.com/file/d/11zapNSzsaM2hnYRAZ5sP3oIpBSXf6v9f/preview","History":"https://drive.google.com/file/d/1pZVkTt-Y6B7Qj11wfxOaAjtJdzrlwScw/preview","Geography":"https://drive.google.com/file/d/1KirMqPxFq6T-uV0Iwc1DGHMTtqNmY--P/preview","Commerce":"https://drive.google.com/file/d/1A7dp04R6VyWioeB8PsZzVrOmR7SGysox/preview","EVS":"https://drive.google.com/file/d/1HPKNgoRb2Hb_2r2MJ0CYUchci0rTjt_k/preview","HomeScience":"https://drive.google.com/file/d/1XoDMVG1k7PKeCK6g9Z8eJRXyq_DSqlR6/preview","Math":"https://drive.google.com/file/d/1yQADSQdxWKWQfrNPHQbx-8AvUKG31oLG/preview","Physics":"https://drive.google.com/file/d/1zQ9VRlKfyyYJbrEcSpVJ1NLjfD2YF-sQ/preview","Chemistry":"https://drive.google.com/file/d/1FqE_1Wrqexb5uEHF9i5S1dp85qWixczr/preview","Biology":"https://drive.google.com/file/d/1F0DxDxlyGwAWbcgE4XW7uu9T8_Cpjz38/preview","Computer":"https://drive.google.com/document/d/1z4tPKxzcdspPejJK6yoasR1cflavTDEp/preview","RAI":"#","Economics":"https://drive.google.com/file/d/1mYeodINWSul_cFrfAeTFD3lCSYKXP5Y9/preview","EVA":"https://drive.google.com/document/d/1kMrOMWAKEWKN_U6kslpYRc2qbbo6ozMZ/preview","PE":"https://drive.google.com/file/d/1MoL7JeFh23J8jEzsooQG9qzvA5caHJC9/preview"},
            "HY":{"Bengali":"https://drive.google.com/file/d/180_ukzNQACowFghDlU5E6Pw1JPibIlHy/preview","English Language":"https://drive.google.com/file/d/14Z_ZLI7WKDiRFfV3FxlBvQgzv2f2xKaO/preview","English Literature":"https://drive.google.com/file/d/1V6AbIcgxtyYzuolkdoHyqyMvn7iqx50O/preview","French":"https://drive.google.com/file/d/1inV9vWpQRsZFkPlB7d1CWHLo4oQHUKOL/preview","German":"https://docs.google.com/document/d/1iZDhL1Hccgqu6iJm3AML-D1d7e5QYQn7/preview","Hindi":"https://drive.google.com/file/d/1qS6w4n_wBMufTomlNCKbtIxTIpPkEVxa/preview","History":"https://drive.google.com/file/d/1EvVjDc2gVwpcparLnB-7agi6hdt9jENR/preview","Geography":"https://drive.google.com/file/d/1wzJyOnEHI0OjI_TlHTT9-7ibLq0dFHUU/preview","Commerce":"https://drive.google.com/file/d/13lpTDor0enLHwZpjfVfa-USHk9HuPnvJ/preview","EVS":"https://drive.google.com/file/d/1jR96m_skfTYit0TWAR-JNNoFuFP8fO4C/preview","Home Science":"https://docs.google.com/document/d/1dYhjtSukLoc3cCcys8yMCMIZtbS7b0Jw/preview","Math":"https://drive.google.com/file/d/1F8ULAi1KBxsBzmi_ezgW27Kmi7-5PDUL/preview","Physics":"https://drive.google.com/file/d/1triKi2IkAhHwozomBrV7AYQ5CzWsEN4s/preview","Chemistry":"https://drive.google.com/file/d/18aXCuli8Q0x7rdJQdI9bsU5OJ3wpcGDR/preview","Biology":"https://drive.google.com/file/d/1zDC_CCliE6WdUuijG4NJxmGEgFm_IQ3m/preview","Computer":"https://docs.google.com/document/d/1D1ksUViso2E1rTb2keSX92Tj_gkqNqaf/preview","RAI":"#","Economics":"https://drive.google.com/file/d/11CjLIudX1KnqgHyleuyWIl_cGKrmKayg/preview","EVA":"https://drive.google.com/file/d/1MvQQCPwdChyZDZ275m76Sh4uf-r3FSx8/preview","PE":"https://drive.google.com/file/d/1QOOvyjqiIeySDEz717FXvVE4zU1UMPJf/preview"},
            "FT": { "Bengali": "https://drive.google.com/file/d/1iarbhFXhAXL5t_5HT9DGBqPmpKVVd9R0/preview", "English Language": "https://drive.google.com/file/d/1RU16me8aOVjdUZUNdoflhYwmg6LQAGyt/preview", "English Literature": "https://drive.google.com/file/d/1DbBKeSIppwh78JehJq0sWq6r8RV6Ey3z/preview", "French": "https://drive.google.com/file/d/1432tVesY7o6CLB64kXcUk076LxqebOFA/preview", "German": "https://drive.google.com/file/d/1gHaj8z5AOkEEslLtxXoryflhSJKXvCZu/preview", "Hindi": "https://drive.google.com/file/d/1qVs46C9DDnls9sztPJ02IpoBiEh3S_dJ/preview", "History": "https://drive.google.com/file/d/1-P-X8L9jjgX_6-uEK2NAIV8cuiueGFxc/preview", "Geography": "https://drive.google.com/file/d/1OTZgvO-5B2aNQo92QIulvRKvaRMHUENC/preview", "Commerce": "https://drive.google.com/file/d/1hYIlzm7y8PS9cozjJfcRd1TKNe09Sivy/preview", "EVS": "https://drive.google.com/file/d/1mUFXBPa23TmIFdLJ2hBEenFbhqnrFWIk/preview", "Home Science": "https://drive.google.com/file/d/1Q4Bvv36UdNIVCMlEXRnvqoO8nHXhGLGg/preview", "Math": "https://drive.google.com/file/d/1oKFXEj0Cf9WJILuLxdhyGBfM3prUZyJh/preview", "Physics": "https://drive.google.com/file/d/1eB5EDhHYtx4JAqdRIDFRUYG7TG5-ZQ0R/preview", "Chemistry": "https://drive.google.com/file/d/154oho0qQ8AjJ2nBe9HHekvb9qQ4EZ4b2/preview", "Biology": "https://drive.google.com/file/d/1o8_gsyux77HnZUvisbKVYNinaoiSEyUX/preview", "Computer": "https://drive.google.com/file/d/1v9aQY1VJPQGtNoiM1CtfATZPoPi_k7o4/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1zROpJecB-Wovww4JokhJoMvktU69ArP2/preview", "EVA": "https://drive.google.com/file/d/1CLg76i8RiOoSNoNmdzB8brZTKxIJvlPw/preview", "PE": "https://drive.google.com/file/d/1kYnMM88OZthJbzHgy66G_t9e0Bcaaaxl/preview" }
        },
        "CL 10": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 11": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 12": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        }
    },
    "2021-22": {
        "CL 9": {
            "MT 1": { "Bengali": "https://drive.google.com/file/d/1NfeNNMIFH3IP-XgSk2YHrEtMPjcsK-Yl/preview", "English Language": "https://drive.google.com/file/d/1LDs5ZAQz5s5zksR2O5nUA3urKqrrYVD3/preview", "English Literature": "https://drive.google.com/file/d/1SY_04lbSEnIVdCKlM-CTr9XlsTIadEkM/preview", "French": "https://drive.google.com/file/d/1kcEcRR1gkdKgUwPFm0KIOzw_rtfuh7PE/preview", "German": "https://drive.google.com/file/d/1bXZOzzWotzCT179rIZxbnzVpkd4fRGjc/preview", "Hindi": "https://drive.google.com/file/d/1C56GtxOJRA8VPGkvbe8YqyM21PN1UyHq/preview", "History": "https://docs.google.com/document/d/11HHXidfE60sbhZO7VpiocHg8hS6ol--Y/preview", "Geography": "https://drive.google.com/file/d/18bIHFprMlT-muvdQD-0fcdNK3wjl8s68/preview", "Commerce": "https://drive.google.com/file/d/1GZOLl_1jI9_FYUhl2pE4lEKo7ywcNkpN/preview", "EVS": "https://drive.google.com/file/d/13YL22cjIdh9pJc3NXH2JydBDXty5mGWE/preview", "Home Science": "https://drive.google.com/file/d/1qc1g7Xi2oR2A4Zytz53_juiivf0mdOf-/preview", "Math": "https://drive.google.com/file/d/1qSKZ14-aonHReaViBJbg3OcZ5oOY_BUV/preview", "Physics": "https://drive.google.com/file/d/1zLyz6qrMhis4es20KcqsrNlD7h1bmcm6/preview", "Chemistry": "https://drive.google.com/file/d/15SY1AYbUbAo9QDgPUz7yecWq_5phgcnu/preview", "Biology": "https://drive.google.com/file/d/1S-E3wVK09D8BIvhDhldMnrAyxeTyWraq/preview", "Computer": "https://drive.google.com/file/d/1aowhaHWLMK1WHPYJ3wPUj6n1JjqRd6rZ/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1DsGo0CrGce-lQGpm58vHQAJz9c7VLake/preview", "EVA": "https://drive.google.com/file/d/1dA-KRNe7MSghTWgmvGBR5S4-4u0P5uB1/preview", "PE": "https://drive.google.com/file/d/1yhh7-Im4TEaTPVVjKR1dkqZVUtOIGBwC/preview" },
            "MT 2": { "Bengali": "https://drive.google.com/file/d/1hkid5QWTZkdim524kN5iYQTg16Hdt3p9/preview", "English Language": "https://drive.google.com/file/d/1MtpPmTt2kfKKLopeRkldiSeC8cKMSYxi/preview", "English Literature": "https://drive.google.com/file/d/1WMG59BaT2DopyFpGzChtqi3NqNsdIfih/preview", "French": "https://drive.google.com/file/d/1X46ADDXb6C26M9TreBF1Jos-x9-rPaGZ/preview", "German": "https://drive.google.com/file/d/137lmNstBMrnWyunr3wMbkyAvQcKnh5w3/preview", "Hindi": "https://drive.google.com/file/d/15L613OoeSA6M59w9yfqeDKyOdIg-RVCO/preview", "History": "https://docs.google.com/document/d/1xCxdcVDPhTYA8Hg-zJWx06B6FcT7A7ND/preview", "Geography": "https://drive.google.com/file/d/1NhWS7VI-ocTmPMTYh2BZlEpaOSm8xwlT/preview", "Commerce": "https://drive.google.com/file/d/1wWT6yw5orxMt16ecn_Dxf5B9WsPal9nw/preview", "EVS": "https://drive.google.com/file/d/1fytG2EB6NO47chSY_sf1kuEJ0i5AVLCB/preview", "Home Science": "https://drive.google.com/file/d/1oMiKYdpA_3k-kYgMW8ZCg1Eh_hd6mVhF/preview", "Math": "https://drive.google.com/file/d/11D-n_SRuoSsM9B5Z4PJHYYQzmg2Ctywp/preview", "Physics": "https://drive.google.com/file/d/1J-yqacYjch2p44hBOXJBT5dA8tR4EAd7/preview", "Chemistry": "https://drive.google.com/file/d/1K0sgiSuFHcEK23MrJnQWm1Wrq_cQa_xN/preview", "Biology": "https://drive.google.com/file/d/1yzt7PwAf7BVo4B4DUHVsfi2aSB8MTqAf/preview", "Computer": "https://drive.google.com/file/d/1jMsR4BtFMuTyc1lZ9S1nuz8Kwr1QI2DZ/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1Ahe_YwZkqlHOBjMgM92cPoF_wovtGKVa/preview", "EVA": "https://drive.google.com/file/d/1aRG7UlnDiCiQh-jBtmmbbQJskpwik-9V/preview", "PE": "https://drive.google.com/file/d/1bOqP62HgiLr7KyzeY05ve2Kihgg2Qtxy/preview" },
            "HY": {"Bengali I": "https://drive.google.com/file/d/1PVAJ5IrZgoLMqCkL7H5tpuDY5P3EGOAd/preview", "Bengali II": "https://drive.google.com/file/d/1c9DzHUy7Ifu-OZKBB67cudE3dxkY7I3C/preview", "English Language I": "https://drive.google.com/file/d/1KWnxXsqHzgbovap9billuDpK4Z6rCD50/preview", "English Language II": "https://drive.google.com/file/d/1M088r7m_5O4pYZznwsk44S5FxMBn1Rru/preview", "English Literature I": "#", "English Literature II": "https://drive.google.com/file/d/1VqyNEfTQ4W20UJ5abaS95NfVUBoWZWxZ/preview", "French I": "#", "French II": "#", "German I": "https://drive.google.com/file/d/1TINdyEt3ewbCtmezsY8KDU9a9i7rTlb7/preview", "German II": "https://drive.google.com/file/d/1T-vT9i21iIupTemNphGUswO9mqxKU5jq/preview", "Hindi": "https://drive.google.com/file/d/1lkNIyprpIwrsrtwtyzIR6wXYu6vX-7YV/preview", "History": "https://drive.google.com/file/d/1rC13XWvgZih5nySm8EPvJ16HOmt0LCAc/preview", "Geography I": "https://drive.google.com/file/d/1Bs-cQeZEHER2jcNyg7xkusXaE3khgZjQ/preview", "Geography II": "https://drive.google.com/file/d/1HBZJQNELdgDd3WttNGTnhAp6U2-pRysJ/preview", "Commerce I": "https://drive.google.com/file/d/1bD2OphMehl0mI6DLYreOcuSym4AduHrU/preview", "Commerce II": "https://drive.google.com/file/d/1qhu_CAYNaylTa5L71dO-2RBaMdFBjDUO/preview", "EVS I": "https://drive.google.com/file/d/1sg1aVS1AT8XohhSPFuelHVCLJznxI--9/preview", "EVS II": "https://drive.google.com/file/d/1_a2lzByB7MPinf-sJoAbs1FgG-n8YNn6/preview", "Home Science I": "https://drive.google.com/file/d/1dynutnlAVTfl_sjW6QU4hR-dGbRsZ9sW/preview", "Home Science II": "https://drive.google.com/file/d/1e8epIWR7bWftJLXjySxRBxFPs8-0m5SX/preview", "Math I": "https://docs.google.com/document/d/1v89xOIhUKgZ-lYBgikdpIX73e2O7SHyS/preview", "Math II": "https://drive.google.com/file/d/1obEMhFRsAD6F7TVLkrU1sPlRzq5JKuXw/preview", "Physics I": "https://drive.google.com/file/d/1NOZ-Hv8MiP-aGr2t69fAiZMKJ5GlBIs7/preview", "Physics II": "https://drive.google.com/file/d/1CZwbplozNkw8ybYI1AcjuggEH1-h4Mga/preview", "Chemistry I": "https://drive.google.com/file/d/1GKKh2CkyoAt8PIh7hzsX9UwZ1dYLYBb0/preview", "Chemistry II": "https://drive.google.com/file/d/1o52aAON2XDSR8WbjYV2Yzi5bJPjN-pGx/preview", "Biology I": "https://drive.google.com/file/d/1spgMMNAAWpFSEHVVE76oI1uRkBC7_R9t/preview", "Biology II": "https://drive.google.com/file/d/1oVNvMpR-csqaJfGHxTinuLCl0UFtT4sd/preview", "Computer I": "https://drive.google.com/file/d/1Sl4XRnvgVt9MsRWYtT7XflXZhx2D--QN/preview", "Computer II": "https://drive.google.com/file/d/1WePyfXx05BOi410J_tvFpiAZU5Md5X5r/preview", "Economics I": "https://drive.google.com/file/d/1LkPLzX4BXZfkcLM7Lulr1knb8CP5xDTV/preview", "Economics II": "https://drive.google.com/file/d/1IcaZZyQBZe_DagaTAXc4Ah7cxyWCeMgR/preview", "EVA I": "https://drive.google.com/file/d/1rZKySw5CheCUOi2FcHS4qSchI4WP0tlM/preview", "EVA II": "https://drive.google.com/file/d/1yyyF5wScLKuvj4Buk9MQwoOu8Hczud1P/preview", "PE I": "https://drive.google.com/file/d/1A_piB4P5KCxFBdqPOz3AJVNKyw-186bz/preview", "PE II": "https://drive.google.com/file/d/17DQowiuoLcz3mUF3aeGpeHZr5aUwt4OA/preview"},
            "FT": {"Bengali": "https://drive.google.com/file/d/1iiopQI3krzojjgT7LRFL0oZE4pAq4DVA/preview","English Language": "https://drive.google.com/file/d/1Pn2-aHeCZK7ybPUs3YUUl_bdmCoE8ZE5/preview","English Literature": "https://drive.google.com/file/d/19VNYTeM1GPqgcJuxK_Mg2LeBJ7p3g6sw/preview","French": "https://drive.google.com/file/d/1EiRI9UZ8g_R3oqtSzaBh7BeBv_Q_qUNW/preview","German": "https://drive.google.com/file/d/16w96HNz6tQiCOAacjAAe0_vVz18ljQzs/preview","Hindi": "https://drive.google.com/file/d/1Me8Nx56xVCHGxlTzYMJ8A5Zkb6eWaVIX/preview","History": "https://drive.google.com/file/d/1apOKVKNqi0eJqzsCffH7PQglg0ZeJ4Bg/preview","Geography": "https://drive.google.com/file/d/1-mgqNpS3-Xl0wKCWLs_AJWFawcvxLwwU/preview","Commerce": "https://drive.google.com/file/d/1Iv3LDXI1VFyE8HEAOtnKOtK2ch2jS96n/preview","EVS": "https://drive.google.com/file/d/1iATAngU9sVJ11RRnubf4TA_awgLkbmNe/preview","Home Science": "https://drive.google.com/file/d/1HiKp8Uv_lYbhjTlI0YsszDMjVcrqCxmE/preview","Math": "https://drive.google.com/file/d/1Ipszd_VzJN4xQrBt724JNx31anCONvaP/preview","Physics": "https://drive.google.com/file/d/1Jc07C1xZH95nkxuHtUmtKnZ0vvgukz0y/preview","Chemistry": "https://drive.google.com/file/d/1sF9BqJB2jZ0x2k_A5fDlZ46R7fKqaj9T/preview","Biology": "https://drive.google.com/file/d/1dLMr2PLDJ9sFWFfWcfMI8jNGKaGysLxl/preview","Computer": "https://drive.google.com/file/d/1UW6LkCcliw4om2Gh0e2Pqsp_3mueSx8g/preview","RAI": "#","Economics": "https://drive.google.com/file/d/1Y-1WoP0Y3i8JfmXZODZbFQeXqCCjLfuk/preview","EVA": "https://drive.google.com/file/d/1husCrl4Mdgo4n85TGo2rt5bdQDA5915_/preview","PE": "https://drive.google.com/file/d/1mw5aXAhVmcCywBuXfCkk8WyRfRssecNJ/preview"}
        },
        "CL 10": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 11": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 12": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        }
    },
    "2020-21": {
        "CL 9": {
            "MT 1": { "Bengali I": "https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1yPmBziwEl6u0Y608jliQtkKwlmuO9S56/preview", "Bengali II":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1M84nB9dLJm2HcQ2h_N6iGb2lIYH8Xkq8/preview", "English Language":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1Mg0EUnUjfQ_gSn4GxJWI4SnMSFgn07O0/preview", "English Literature":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/12kN3EzSOXtlHpufWHYvguFQoj91PvDES/preview", "French I":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1Gy9G-ZX1ogWwvPgm6fU4TuSFme5AnO0w/edit/preview", "French II":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1F3RIfH0LaXJxI80lRUtsptdzYiEgxiW1/edit/preview", "German I":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1OzQg7Pc6i1h153mrdZbAgrUhQJ4xpRSC/edit/preview", "German II":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1Q9WhEIYn3dnr0XxH7xvfItdT4p-NQN9d/edit/preview", "Hindi":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1UFrmFdZgirh-OsaJ7dPmYTuG3G1foHLA/preview", "History":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1U0luNmjh217mdJtSzxpIc64CimwErvYH/preview", "Geography":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1xjIIZEyd7NUoOo9pmItzMx0R7rrgWXu-/preview", "Commerce I":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1AtBvLnk5TXnpBp2kTvb99dsHzZOSQ-Ga/preview", "Commerce II":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1T_K32oS6qXhjnWlben3aRkGx3TWRWICD/preview", "EVS":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/13nhSn4gbvv1jm44vqh7vBb5HJpBYZJE6/preview", "Home Science":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1NjTswLzsPAyfeqt0WqfABV59hQoMf1jf/edit/preview", "Math":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1hMM5PmN0nDtkyiFlcNgQyPuOakZ9XxG8/preview", "Physics":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1lmN49BbfKyE_EMfRuyfAvDBlyE5ipu0z/edit/preview", "Chemistry":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/176tTWRW80m9RAn1hEYldaBXpUba_5zRa/preview", "Biology I":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/15pjyyUgyHgKTtvr39rypoY5LFVciTSgT/preview", "Biology II":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/168xg6gWbyt6iNJWEgB8WbNH_90U4Xzu9/preview", "Computer":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1J7tq_aXiT7JmFOrJsaJl0f_3c_SgfREN/edit/preview", "RAI":"#","Economics":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/1zOoTEmA5SaTLmORh-y0nbBk6o87mpWko/preview", "EVA":"https://docs.google.com/gview?embedded=true&url=https://drive.google.com/file/d/14VCRZHqaNPEBT9Ve2KGV-qJrM3oe7OOQ/preview", "PE":"https://docs.google.com/gview?embedded=true&url=https://docs.google.com/document/d/1ItBqBGcQHsez_xWvYC2j8KUWDBvhJGZt/edit/preview"},
            "MT 2": { "Bengali": "https://drive.google.com/file/d/14mY-LrRpFrN8o_U_RMbvsDS_zrosJPXJ/preview", "English Language": "https://drive.google.com/file/d/1kA5oesYn9hGJotIIwzqaJafrk2tPJVic/preview", "English Literature": "https://drive.google.com/file/d/1mAOpJs7sLTfuxZmOrbrpXx8H0Oqznmvp/preview", "French": "https://drive.google.com/file/d/1tX1d3MF_sFmnIYERnzlsJJfIz0AIPV2o/preview", "German": "https://drive.google.com/file/d/1KilyFCKUsSV1eoH3CtEhfvci3xlruG98/preview", "Hindi": "#", "History": "https://drive.google.com/file/d/1dxN3AyUeBq_-o9f7B1G3Z8OOge4YCApE/preview", "Geography": "https://drive.google.com/file/d/1bmqhOyhTRgNHs3gh5EModQNs3-c5Pddi/preview", "Commerce": "https://drive.google.com/file/d/1bdw9KrohVVAyNhbW_PJ9QNhH-pr8OP0e/preview", "EVS": "https://drive.google.com/file/d/1Wvnmc0hk7GidsQf2DxS59PjGAORf4rKo/preview", "Home Science": "https://drive.google.com/file/d/1bgdSvoaAsxpgE6Ua6IWNtdWuqtMjrk5N/preview", "Math": "https://drive.google.com/file/d/1UzgpSnPUVi_c3Q2TfuDvMb0ewbDcL7NI/preview", "Physics": "https://drive.google.com/file/d/1snpjk6pH4-bz-WEaWwmHPWIlc2a5vdb_/preview", "Chemistry": "https://drive.google.com/file/d/19qecxzeTAt8tWE5DPSEzs9XoW_L6UUTa/preview", "Biology": "https://drive.google.com/file/d/1pzo7bjZy3ZqfV6acPBH_ahcs0k6RexRY/preview", "Computer": "https://drive.google.com/file/d/1jC8LCRPtYnssy8yBQ-6d51e8A3HkP2Xm/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1gPOYcWKVWMI8V1PDV6Os54ffwkR8rZCl/preview", "EVA": "https://drive.google.com/file/d/1CMKp45nCykBp-NupHZanvmSHKqnJHCB3/preview", "PE": "https://drive.google.com/file/d/1gg3xi5Wn6RkmTQEUerdhtbYoB2IPzJZ0/preview" },
            "HY": { "Bengali I":"https://drive.google.com/file/d/1xZpPngzxqteXTcAKUCuQL78AsB474d-B/preview","Bengali II":"https://drive.google.com/file/d/1RNpsilUMUAYtNHkWca4dWDT_uZrAESMg/preview","English Language":"https://drive.google.com/file/d/14yFynYabbJaqniTSP7ZWTgSRQmxcRs56/preview","English Literature I":"https://drive.google.com/file/d/1mBFqsEurJxICr74akHQroeKBdSJoMyyM/preview","English Literature II":"https://drive.google.com/file/d/1JIOoF7evwYgxkHqPxXbwY9nVByPGczPO/preview","French":"https://docs.google.com/document/d/1faITvq7LN04keCwsq3Vz8DaBqOH3ILwp/preview","German":"https://drive.google.com/file/d/1slV1GjX2no6s67V-ZtGfqPEkpYAXmcYi/preview","Hindi":"https://drive.google.com/file/d/1WEpRiaSi546jPL5cyfoLc4YVmG5HExyE/preview","History":"https://drive.google.com/file/d/1f8zrAZYi3ESTm-PIOfVv_a2OuyxWX8lY/preview","Geography":"https://drive.google.com/file/d/13cvA5Ql--mq4Y7qCfwuctVkX2iNJOI9_/preview","Commerce I":"https://drive.google.com/file/d/1IeZ_HN-_0EnIdwlS12UgqManmt_kV0Lz/preview","Commerce II":"https://drive.google.com/file/d/1642aWaaHtIxYHxQkwQbdi_TzxRzgNUSh/preview","EVS":"https://drive.google.com/file/d/15DVihC3p_D72u2cfPfoFgi7i3My9xYG9/preview","Home Science":"https://drive.google.com/file/d/1OMSt0630fOvLwehlROlfEpOi34LWY5vK/preview","Math":"https://drive.google.com/file/d/1MxJQZgR32_d7oYiaISPscLCDK8E3R7Ls/preview","Physics":"https://drive.google.com/file/d/1e9EEZYidTghMRYSNBf_8eWQlQETYSz5V/preview","Chemistry":"https://drive.google.com/file/d/1nQ3KaX9klAySq7JdRqw2_3-P32Pgn66F/preview","Biology":"https://drive.google.com/file/d/1fsanciNj6INEUqWyHjDKQUvrqV629rWa/preview","Computer":"https://drive.google.com/file/d/1GWEorPUZ-FQZoA4EtYU3uX6Avht3Erk1/preview","RAI":"#","Economics":"#","EVA":"https://drive.google.com/file/d/1XrNv_TjKLxAKbp99-AfxhwMabVqoKRcj/preview","PE":"https://drive.google.com/file/d/1ui-11_IOatXKW7im1qXDgkzyjNVgMCp8/preview"},
            "FT": {"Bengali": "https://drive.google.com/file/d/1ElmIlCN-DPjQbEDG9SDeWfyc67jOvOpn/preview", "English Language I": "https://drive.google.com/file/d/1shtifFOaNyUjVwWqVjh7VytrOy3vcjOa/preview", "English Language II": "https://drive.google.com/file/d/117aPZ8J-P9cc2-FGr7Ao3pC5n2dibD85/preview", "English Literature I": "https://drive.google.com/file/d/1kDUbP0QggCPWPkBaJy4IzHgXU4Yjd_tC/preview", "English Literature II": "https://drive.google.com/file/d/14oduNsq9XhiBlrUSEYfukq4JtUZxqo0U/preview", "French ": "https://drive.google.com/file/d/1ggr0MwuJGp1wx17fdiSlJWgw29gn-iDA/preview", "German": "https://drive.google.com/file/d/1NiSTCnlvfn0OB5w9C14nYXJqi_QMpmrg/preview", "Hindi": "https://drive.google.com/file/d/1HLaF5gqcrZdA5vn9a276hueu-SvlpwpY/preview", "History I": "https://drive.google.com/file/d/1ISVI2jZerEA1ThhBomkY8ALxTKy4ItCC/preview", "History II": "https://drive.google.com/file/d/1xVdHMXmvVvF7B2Y8JAR92Uh0Gc9VZOTA/preview", "Geography": "https://drive.google.com/file/d/1VYggaky6JNinWkP0DigCcuvbmLznC1UM/preview", "Commerce": "https://docs.google.com/document/d/1GKgCSj_Ep56E6Cs34DF43wWra-MZc-uJ/preview", "EVS": "https://drive.google.com/file/d/16ToWQl4YER37Ym-mixFrm8aB9MbVGpwO/preview", "Home Science": "https://drive.google.com/file/d/1ahdis1tz7r8p6zUh3Tcwjz4zjIqYDLlY/preview", "Math": "https://drive.google.com/file/d/1Mju9pnATL9Mw6qI53Hv0QO_InW6sid5X/preview", "Physics I": "https://drive.google.com/file/d/1YMK-UvuOKzeER5BxD52pgzkpCUdWuQPB/preview", "Physics II": "https://drive.google.com/file/d/1dKkqLfMH-67Z0_cS_n2oR7rlzKQvl1Eb/preview", "Chemistry": "https://drive.google.com/file/d/1he9dmLXmhiCEWTCqDjbuf_Z83uXbL51N/preview", "Biology": "https://drive.google.com/file/d/1us5APdxt9NQ3nVRCaxNAv5sseLEGZXCv/preview", "Computer": "https://drive.google.com/file/d/1qFBmJoqjjBDVWm1RN6_3BfbaCgVrjRBs/preview", "RAI": "#", "Economics": "https://drive.google.com/file/d/1kuZ2b2I1Q-WYOW2xmKGhMWVAoXtHMZhw/preview", "EVA": "https://drive.google.com/file/d/1SmRaZbbVdK5CJR5WmjWiWRgpR7HNwNIx/preview", "PE": "https://drive.google.com/file/d/19CwkqRgnPadYqSU49dSg6AzC4SKlR687/preview"}
        },
        "CL 10": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 11": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        },
        "CL 12": {
            "MT 1": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "MT 2": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "HY": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" },
            "FT": { "Bengali": "#", "English Language": "#", "English Literature": "#", "French": "#", "German": "#", "Hindi": "#", "History": "#", "Geography": "#", "Commerce": "#", "EVS": "#", "Home Science": "#", "Math": "#", "Physics": "#", "Chemistry": "#", "Biology": "#", "Computer": "#", "RAI": "#", "Economics": "#", "EVA": "#", "PE": "#" }
        }
    }
};

function loadFlashcardDecks() {
  flashcardDecks = JSON.parse(localStorage.getItem('questionary-flashcards') || '[]');
}

function saveFlashcardDecks() {
  localStorage.setItem('questionary-flashcards', JSON.stringify(flashcardDecks));
}

function openFlashcardModal(deckId = null) {
  const modal = document.getElementById('flashcardModal');
  const nameInput = document.getElementById('deckName');
  const cardsContainer = document.getElementById('cardsContainer');
  const modalTitle = document.getElementById('flashcardModalTitle');
  
  if (!modal) { console.error('Flashcard modal not found'); return; }
  
  if (deckId) {
    const deck = flashcardDecks.find(d => d.id === deckId);
    if (deck) {
      currentEditingDeck = deck;
      if (nameInput) nameInput.value = deck.name;
      if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-layer-group"></i> Edit Deck';
      renderCardEditors(deck.cards);
    }
  } else {
    currentEditingDeck = null;
    if (nameInput) nameInput.value = '';
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-layer-group"></i> Create Flashcard Deck';
    if (cardsContainer) cardsContainer.innerHTML = '';
    addCardEditor();
  }
  
  modal.classList.add('active');
}

function addCardEditor(front = '', back = '') {
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card-editor';
  cardDiv.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
  cardDiv.innerHTML = `
    <input type="text" class="card-front form-input" placeholder="Front (question)" value="${escapeHtml(front)}" style="flex:1;">
    <input type="text" class="card-back form-input" placeholder="Back (answer)" value="${escapeHtml(back)}" style="flex:1;">
    <button type="button" class="btn btn-secondary" onclick="this.parentElement.remove()" style="padding:8px 12px;"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(cardDiv);
}

function renderCardEditors(cards) {
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  container.innerHTML = '';
  cards.forEach(card => addCardEditor(card.front, card.back));
}

function saveDeck() {
  const nameInput = document.getElementById('deckName');
  const modal = document.getElementById('flashcardModal');
  const name = nameInput?.value.trim();
  
  if (!name) {
    showNotification('Please enter a deck name', 'error');
    return;
  }
  
  const cardEditors = document.querySelectorAll('.card-editor');
  const cards = [];
  cardEditors.forEach(editor => {
    const front = editor.querySelector('.card-front')?.value.trim();
    const back = editor.querySelector('.card-back')?.value.trim();
    if (front && back) {
      cards.push({ front, back });
    }
  });
  
  if (cards.length === 0) {
    showNotification('Please add at least one card with both front and back', 'error');
    return;
  }
  
  if (currentEditingDeck) {
    currentEditingDeck.name = name;
    currentEditingDeck.cards = cards;
  } else {
    flashcardDecks.push({
      id: Date.now().toString(),
      name,
      cards
    });
  }
  
  saveFlashcardDecks();
  renderFlashcardDecks();
  modal?.classList.remove('active');
  showNotification(currentEditingDeck ? 'Deck updated!' : 'Deck created!', 'success');
  currentEditingDeck = null;
}

function deleteDeck(deckId) {
  const deck = flashcardDecks.find(d => d.id === deckId);
  const deckName = deck ? deck.name : 'this deck';
  
  showConfirmModal(
    'Delete Flashcard Deck',
    `Are you sure you want to delete "${deckName}"? All cards in this deck will be lost.`,
    () => {
      flashcardDecks = flashcardDecks.filter(d => d.id !== deckId);
      saveFlashcardDecks();
      renderFlashcardDecks();
      showNotification('Deck deleted', 'info');
    }
  );
}

function startStudyDeck(deckId) {
  const deck = flashcardDecks.find(d => d.id === deckId);
  if (!deck || deck.cards.length === 0) return;
  
  currentStudyDeck = deck;
  currentCardIndex = 0;
  
  const modal = document.getElementById('studyModal');
  if (modal) {
    modal.classList.add('active');
    showCurrentCard();
  }
}

function showCurrentCard() {
  if (!currentStudyDeck) return;
  
  const card = currentStudyDeck.cards[currentCardIndex];
  const flashcard = document.getElementById('activeFlashcard');
  const counter = document.getElementById('cardProgress');
  const frontEl = document.getElementById('cardFront');
  const backEl = document.getElementById('cardBack');
  
  if (flashcard) {
    flashcard.classList.remove('flipped');
  }
  if (frontEl) frontEl.textContent = card.front;
  if (backEl) backEl.textContent = card.back;
  
  if (counter) {
    counter.textContent = `${currentCardIndex + 1} / ${currentStudyDeck.cards.length}`;
  }
}

function flipCard() {
  const flashcard = document.getElementById('activeFlashcard');
  flashcard?.classList.toggle('flipped');
}

function nextCard() {
  if (!currentStudyDeck) return;
  currentCardIndex = (currentCardIndex + 1) % currentStudyDeck.cards.length;
  showCurrentCard();
}

function prevCard() {
  if (!currentStudyDeck) return;
  currentCardIndex = (currentCardIndex - 1 + currentStudyDeck.cards.length) % currentStudyDeck.cards.length;
  showCurrentCard();
}

function loadStudySessions() {
  studySessions = JSON.parse(localStorage.getItem('questionary-sessions') || '[]');
}

function saveStudySessions() {
  localStorage.setItem('questionary-sessions', JSON.stringify(studySessions));
}

function openSessionModal() {
  const modal = document.getElementById('sessionModal');
  const subjectInput = document.getElementById('sessionSubject');
  const dateInput = document.getElementById('sessionDate');
  const timeInput = document.getElementById('sessionTime');
  
  if (!modal) { console.error('Session modal not found'); return; }
  
  if (subjectInput) subjectInput.value = '';
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (timeInput) timeInput.value = '09:00';
  
  modal.classList.add('active');
}

function saveSession() {
  const subjectInput = document.getElementById('sessionSubject');
  const dateInput = document.getElementById('sessionDate');
  const timeInput = document.getElementById('sessionTime');
  const modal = document.getElementById('sessionModal');
  
  const subject = subjectInput?.value.trim();
  const date = dateInput?.value;
  const time = timeInput?.value;
  
  if (!subject) {
    showNotification('Please enter a subject', 'error');
    return;
  }
  
  if (!date) {
    showNotification('Please select a date', 'error');
    return;
  }
  
  studySessions.push({
    id: Date.now().toString(),
    subject,
    date,
    time: time || '09:00'
  });
  
  saveStudySessions();
  renderCalendar();
  renderSessions();
  modal?.classList.remove('active');
  showNotification('Session added!', 'success');
}

function deleteSession(sessionId) {
  const session = studySessions.find(s => s.id === sessionId);
  const sessionSubject = session ? session.subject : 'this session';
  
  showConfirmModal(
    'Delete Study Session',
    `Are you sure you want to delete the "${sessionSubject}" session?`,
    () => {
      studySessions = studySessions.filter(s => s.id !== sessionId);
      saveStudySessions();
      renderCalendar();
      renderSessions();
      showNotification('Session deleted', 'info');
    }
  );
}

function showDaySessions(dateStr) {
  const sessionsOnDay = studySessions.filter(s => s.date === dateStr);
  if (sessionsOnDay.length === 0) {
    showNotification(`No sessions on ${dateStr}`, 'info');
  } else {
    const list = sessionsOnDay.map(s => `• ${s.subject} at ${s.time}`).join('\n');
    alert(`Sessions on ${dateStr}:\n\n${list}`);
  }
}

function loadStudyStats() {
  studyStats = JSON.parse(localStorage.getItem('questionary-study-stats') || '{"totalTime":0,"streak":0,"lastStudyDate":null,"hourlyActivity":{}}');
}

function loadDocumentProgress() {
  documentProgress = JSON.parse(localStorage.getItem('questionary-doc-progress') || '{}');
}

window.openNoteModal = openNoteModal;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.editNote = editNote;
window.openFlashcardModal = openFlashcardModal;
window.addCardEditor = addCardEditor;
window.saveDeck = saveDeck;
window.deleteDeck = deleteDeck;
window.startStudyDeck = startStudyDeck;
window.flipCard = flipCard;
window.nextCard = nextCard;
window.prevCard = prevCard;
window.openSessionModal = openSessionModal;
window.saveSession = saveSession;
window.deleteSession = deleteSession;
window.showDaySessions = showDaySessions;


document.addEventListener('DOMContentLoaded', async () => {
  
  await initializeFavorites();
  
  applyAccessibilitySettings();
  
  
  if (typeof initializeNewFeatures === 'function') {
    initializeNewFeatures();
  }
  
  
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  
  let savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      savedTheme = 'dark';
    } else {
      savedTheme = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  
  
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateThemeIcon(newTheme);
      }
    });
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }
  
  
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  if (accessibilityToggle && accessibilityPanel) {
    accessibilityToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      accessibilityPanel.classList.toggle('active');
      console.log('Accessibility panel toggled:', accessibilityPanel.classList.contains('active'));
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#accessibilityPanel') && !e.target.closest('#accessibilityToggle')) {
        accessibilityPanel.classList.remove('active');
      }
    });
  }
  
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  
  checkSavedLogin();
  
  document.addEventListener('click', e => {
    e.target.closest('.btn') && createRipple(e);
  });
  initializeNavigation();
  initializeGlobalSearch();
  initializeAccessibility();
  initializeViewControls();
  initializeKeyboardNavigation();
  loadDocuments();
  trackDailyAccess();
  window.addEventListener('beforeunload', () => {
    saveUserPreferences();
  });
  setInterval(saveUserPreferences, 30000);
  window.addEventListener('error', e => {
    console.error('Application error:', e.error);
  });
  console.log('Questionary application initialized successfully');
});

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('themeIcon');
  if (!themeIcon) return;
  if (theme === 'dark') {
    themeIcon.className = 'fas fa-sun';
  } else {
    themeIcon.className = 'fas fa-moon';
  }
}

function handleLogin(e) {
  if (e) e.preventDefault();
  console.log('Login form submitted');
  
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const rememberMeEl = document.getElementById('rememberMe');
  
  if (!usernameEl || !passwordEl) {
    showNotification('Login form elements not found', 'error');
    return;
  }
  
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  const rememberMe = rememberMeEl ? rememberMeEl.checked : false;
  
  console.log('Attempting login for:', username);
  
  if (!username || !password) {
    showNotification('Please enter both username and password', 'warning');
    return;
  }
  
  if (users[username] && users[username].password === password) {
    currentUser = { username, role: users[username].role };
    
    if (rememberMe) {
      localStorage.setItem('revamp-dpsnt-remember', JSON.stringify({ username, role: users[username].role }));
    }
    sessionStorage.setItem('revamp-dpsnt-session', JSON.stringify({ username, role: users[username].role }));
    
    showNotification(`Welcome, ${username}!`, 'success');
    
        setTimeout(() => {
      showApp();
      initializeAppAfterLogin();
    }, 500);
  } else {
    showNotification('Invalid username or password', 'error');
  }
}

function checkSavedLogin() {
  const savedLogin = localStorage.getItem('revamp-dpsnt-remember');
  if (savedLogin) {
    try {
      currentUser = JSON.parse(savedLogin);
      showApp();
      initializeAppAfterLogin();
      setTimeout(() => showAutoLoginNotification(currentUser.username), 300);
      return true;
    } catch (e) {
      localStorage.removeItem('revamp-dpsnt-remember');
    }
  }
  
  const previousLogin = sessionStorage.getItem('revamp-dpsnt-session');
  if (previousLogin) {
    try {
      currentUser = JSON.parse(previousLogin);
      showApp();
      initializeAppAfterLogin();
      return true;
    } catch (e) {
      sessionStorage.removeItem('revamp-dpsnt-session');
    }
  }
  return false;
}


function initializeNavigation() {
  const homeNav = document.getElementById('homeNav');
  const favoritesNav = document.getElementById('favoritesNav');
  const recentNav = document.getElementById('recentNav');
  const analyticsNav = document.getElementById('analyticsNav');
  const studyPlannerNav = document.getElementById('studyPlannerNav');
  const flashcardsNav = document.getElementById('flashcardsNav');
  const notesNav = document.getElementById('notesNav');
  const progressNav = document.getElementById('progressNav');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  const backBtn = document.getElementById('backBtn');
  
  
  if (backBtn) {
    backBtn.addEventListener('click', handleBackButton);
  }
  
  
  mobileMenuToggle && mobileMenuToggle.addEventListener('click', () => {
    navLinks && navLinks.classList.toggle('active');
    
    const icon = mobileMenuToggle.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
    }
  });
  
  
  document.addEventListener('click', (e) => {
    if (navLinks && navLinks.classList.contains('active')) {
      if (!e.target.closest('.nav-links') && !e.target.closest('.mobile-menu-toggle')) {
        navLinks.classList.remove('active');
        const icon = mobileMenuToggle?.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-times');
        }
      }
    }
  });
  
  
  const closeMenuOnClick = () => {
    if (navLinks && window.innerWidth <= 768) {
      navLinks.classList.remove('active');
      const icon = mobileMenuToggle?.querySelector('i');
      if (icon) {
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
      }
    }
  };
  
  homeNav && homeNav.addEventListener('click', () => {
    showView('home');
    path = [];
    renderTiles(documents);
    updateBreadcrumb();
    setActiveNav('homeNav');
    closeMenuOnClick();
  });
  
  favoritesNav && favoritesNav.addEventListener('click', () => {
    showView('favorites');
    setActiveNav('favoritesNav');
    closeMenuOnClick();
  });
  
  recentNav && recentNav.addEventListener('click', () => {
    showView('recent');
    setActiveNav('recentNav');
    closeMenuOnClick();
  });
  
  analyticsNav && analyticsNav.addEventListener('click', () => {
    showView('analytics');
    setActiveNav('analyticsNav');
    closeMenuOnClick();
  });
  
  studyPlannerNav && studyPlannerNav.addEventListener('click', () => {
    showView('planner');
    setActiveNav('studyPlannerNav');
    closeMenuOnClick();
  });
  
  flashcardsNav && flashcardsNav.addEventListener('click', () => {
    showView('flashcards');
    setActiveNav('flashcardsNav');
    closeMenuOnClick();
  });
  
  notesNav && notesNav.addEventListener('click', () => {
    showView('notes');
    setActiveNav('notesNav');
    closeMenuOnClick();
  });
  
  progressNav && progressNav.addEventListener('click', () => {
    showView('progress');
    setActiveNav('progressNav');
    closeMenuOnClick();
  });
}


function initializeGlobalSearch() {
  const searchInput = document.getElementById('globalSearch');
  const searchResults = document.getElementById('searchResults');
  
  searchInput && searchInput.addEventListener('input', performSearch);
  searchInput && searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) performSearch();
  });
  
  document.addEventListener('click', (e) => {
    if (searchResults && !e.target.closest('.search-container')) {
      searchResults.style.display = 'none';
    }
  });
}


function initializeAccessibility() {
  setupAccessibilityToggle('highContrastToggle', 'highContrast', 'high-contrast');
  setupAccessibilityToggle('largeTextToggle', 'largeText', 'large-text');
  setupAccessibilityToggle('reducedMotionToggle', 'reducedMotion', 'reduced-motion');
  setupAccessibilityToggle('enhancedFocusToggle', 'enhancedFocus', 'enhanced-focus');
  
  
  applyAccessibilitySettings();
  
  
  updateAccessibilityToggleStates();
}

function setupAccessibilityToggle(toggleId, settingKey, className) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) {
    console.log('Toggle not found:', toggleId);
    return;
  }
  
  
  const switchEl = toggle.querySelector('.accessibility-switch');
  
  
  if (accessibilitySettings[settingKey]) {
    toggle.classList.add('active');
    if (switchEl) switchEl.classList.add('active');
  }
  
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    accessibilitySettings[settingKey] = !accessibilitySettings[settingKey];
    const storageKey = 'accessibility-' + settingKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    localStorage.setItem(storageKey, accessibilitySettings[settingKey]);
    toggle.classList.toggle('active', accessibilitySettings[settingKey]);
    if (switchEl) switchEl.classList.toggle('active', accessibilitySettings[settingKey]);
    document.body.classList.toggle(className, accessibilitySettings[settingKey]);
    console.log('Toggled', settingKey, 'to', accessibilitySettings[settingKey]);
  });
}

function updateAccessibilityToggleStates() {
  const toggleMappings = [
    { id: 'highContrastToggle', key: 'highContrast' },
    { id: 'largeTextToggle', key: 'largeText' },
    { id: 'reducedMotionToggle', key: 'reducedMotion' },
    { id: 'enhancedFocusToggle', key: 'enhancedFocus' }
  ];
  
  toggleMappings.forEach(({ id, key }) => {
    const toggle = document.getElementById(id);
    if (toggle && accessibilitySettings[key]) {
      toggle.classList.add('active');
    }
  });
}

function initializeKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    
    const isInputFocused = e.target.closest('input, textarea');
    
    if (e.key === 'Escape') {
      
      const searchResults = document.getElementById('searchResults');
      if (searchResults && searchResults.style.display !== 'none') {
        searchResults.style.display = 'none';
        return;
      }
      
      
      const accessibilityPanel = document.getElementById('accessibilityPanel');
      if (accessibilityPanel && accessibilityPanel.classList.contains('active')) {
        accessibilityPanel.classList.remove('active');
        return;
      }
      
      
      const pdfViewer = document.getElementById('pdfViewer');
      if (pdfViewer && pdfViewer.style.display === 'block') {
        pdfViewer.style.display = 'none';
        pdfViewer.src = '';
        const tilesSection = document.getElementById('tilesSection');
        const dashboardHeader = document.querySelector('.dashboard-header');
        tilesSection && (tilesSection.style.display = 'block');
        dashboardHeader && (dashboardHeader.style.display = 'flex');
        hideTimerCompletely();
        return;
      }
      
      
      if (path.length > 0) {
        handleBackButton();
        return;
      }
      
      
      if (currentView !== 'home') {
        showView('home');
        path = [];
        renderTiles(documents);
        updateBreadcrumb();
        setActiveNav('homeNav');
        return;
      }
    }
    
    if (e.key === '/' && !isInputFocused) {
      e.preventDefault();
      document.getElementById('globalSearch')?.focus();
    }
    
    if (e.key === 'Backspace' && !isInputFocused && path.length > 0) {
      handleBackButton();
    }
    
    
    if (e.altKey && e.key === 'ArrowLeft' && !isInputFocused) {
      e.preventDefault();
      const pdfViewer = document.getElementById('pdfViewer');
      if (pdfViewer && pdfViewer.style.display === 'block') {
        pdfViewer.style.display = 'none';
        pdfViewer.src = '';
        const tilesSection = document.getElementById('tilesSection');
        const dashboardHeader = document.querySelector('.dashboard-header');
        tilesSection && (tilesSection.style.display = 'block');
        dashboardHeader && (dashboardHeader.style.display = 'flex');
        hideTimerCompletely();
      } else if (path.length > 0) {
        handleBackButton();
      } else if (currentView !== 'home') {
        showView('home');
        path = [];
        renderTiles(documents);
        updateBreadcrumb();
        setActiveNav('homeNav');
      }
    }
    
    
    if (e.altKey && e.key === 'Home' && !isInputFocused) {
      e.preventDefault();
      const pdfViewer = document.getElementById('pdfViewer');
      if (pdfViewer) {
        pdfViewer.style.display = 'none';
        pdfViewer.src = '';
      }
      hideTimerCompletely();
      showView('home');
      path = [];
      renderTiles(documents);
      updateBreadcrumb();
      setActiveNav('homeNav');
    }
  });
}


function showView(viewName) {
  currentView = viewName;
  
  
  const tilesSection = document.getElementById('tilesSection');
  const favoritesSection = document.getElementById('favoritesSection');
  const recentSection = document.getElementById('recentSection');
  const analyticsSection = document.getElementById('analyticsSection');
  const plannerSection = document.getElementById('plannerSection');
  const flashcardsSection = document.getElementById('flashcardsSection');
  const notesSection = document.getElementById('notesSection');
  const progressSection = document.getElementById('progressSection');
  const searchResults = document.getElementById('searchResults');
  const dashboardHeader = document.querySelector('.dashboard-header');
  const breadcrumb = document.getElementById('breadcrumb');
  const backBtn = document.getElementById('backBtn');
  const pdfViewer = document.getElementById('pdfViewer');
  
  
  const allSections = [tilesSection, favoritesSection, recentSection, analyticsSection, 
                       plannerSection, flashcardsSection, notesSection, progressSection];
  allSections.forEach(section => {
    if (section) section.style.display = 'none';
  });
  if (searchResults) searchResults.style.display = 'none';
  if (pdfViewer) pdfViewer.style.display = 'none';
  
  
  switch(viewName) {
    case 'home':
      if (tilesSection) tilesSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'flex';
      if (breadcrumb) breadcrumb.style.display = 'flex';
      if (backBtn) backBtn.style.display = path.length > 0 ? 'flex' : 'none';
      break;
    case 'favorites':
      if (favoritesSection) favoritesSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderFavorites();
      break;
    case 'recent':
      if (recentSection) recentSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderRecent();
      break;
    case 'analytics':
      if (analyticsSection) analyticsSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderAnalytics();
      break;
    case 'planner':
      if (plannerSection) plannerSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderCalendar();
      renderSessions();
      break;
    case 'flashcards':
      if (flashcardsSection) flashcardsSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderFlashcardDecks();
      break;
    case 'notes':
      if (notesSection) notesSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      renderNotes();
      break;
    case 'progress':
      if (progressSection) progressSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumb) breadcrumb.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      updateProgressDisplay();
      break;
    default:
      if (tilesSection) tilesSection.style.display = 'block';
      if (dashboardHeader) dashboardHeader.style.display = 'flex';
      if (breadcrumb) breadcrumb.style.display = 'flex';
      break;
  }
}


function addToRecent(title, docPath, url) {
  if (!url || url === '#') return;
  const recent = JSON.parse(localStorage.getItem('questionary-recent') || '[]');
  const existing = recent.findIndex(r => r.title === title && r.url === url);
  if (existing > -1) recent.splice(existing, 1);
  recent.unshift({ title, path: docPath, url, timestamp: Date.now() });
  const updatedRecent = recent.slice(0, 20);
  
  saveRecentToStorage(updatedRecent);
  
    if (docPath && docPath.length > 0) {
    trackSubjectAccess(docPath[0]);
    if (docPath.length > 1) {
      trackSubjectAccess(docPath[1]);
    }
  }
}


function toggleFavorite(title, docPath, url) {
  const pathString = Array.isArray(docPath) ? docPath.join('|') : docPath;
  const index = favorites.findIndex(f => f.title === title && (Array.isArray(f.path) ? f.path.join('|') : f.path) === pathString);
  if (index > -1) {
    favorites.splice(index, 1);
    showNotification('Removed from favorites', 'info');
  } else {
    favorites.push({ title, path: docPath, url });
    showNotification('Added to favorites', 'success');
  }
  
  saveFavorites();
  updateDashboardStats();
}


function renderFavorites() {
  const container = document.getElementById('favoritesContainer');
  if (!container) return;
  container.innerHTML = '';
  if (favorites.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-secondary);"><i class="fas fa-star" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;"></i><p>No favorites yet. Click the star on any document to add it here.</p></div>';
    return;
  }
  favorites.forEach(fav => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<div class="tile-icon"><i class="fas fa-file-pdf"></i></div><div class="tile-text">${fav.title}</div>`;
    tile.onclick = () => {
      if (fav.url && fav.url !== '#') {
        showPDF(fav.url);
        showView('home');
      }
    };
    container.appendChild(tile);
  });
}


function renderRecent() {
  const container = document.getElementById('recentContainer');
  if (!container) return;
  container.innerHTML = '';
  const recent = JSON.parse(localStorage.getItem('questionary-recent') || '[]');
  if (recent.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-secondary);"><i class="fas fa-history" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;"></i><p>No recent documents. Start browsing to see your history here.</p></div>';
    return;
  }
  recent.forEach(doc => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<div class="tile-icon"><i class="fas fa-file-pdf"></i></div><div class="tile-text">${doc.title}</div>`;
    tile.onclick = () => {
      if (doc.url && doc.url !== '#') {
        showPDF(doc.url);
        showView('home');
      }
    };
    container.appendChild(tile);
  });
}


function initializeViewControls() {
  const gridViewBtn = document.getElementById('gridView');
  const listViewBtn = document.getElementById('listView');
  const sortToggleBtn = document.getElementById('sortToggle');
  const tilesContainer = document.getElementById('tilesContainer');
  
  if (!tilesContainer) return;
  
  let currentSortOrder = localStorage.getItem('questionary-sort-order') || 'asc';
  
  gridViewBtn && gridViewBtn.addEventListener('click', () => {
    tilesContainer.classList.remove('list-view');
    gridViewBtn.classList.add('active');
    listViewBtn && listViewBtn.classList.remove('active');
    localStorage.setItem('questionary-view-mode', 'grid');
  });
  
  listViewBtn && listViewBtn.addEventListener('click', () => {
    tilesContainer.classList.add('list-view');
    listViewBtn.classList.add('active');
    gridViewBtn && gridViewBtn.classList.remove('active');
    localStorage.setItem('questionary-view-mode', 'list');
  });
  
  sortToggleBtn && sortToggleBtn.addEventListener('click', () => {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    localStorage.setItem('questionary-sort-order', currentSortOrder);
    renderTiles(getCurrentLevel());
  });
}


function handleBackButton() {
  if (path.length > 0) {
    path.pop();
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
      pdfViewer.style.cssText = 'display: none !important;';
      pdfViewer.classList.remove('active');
      pdfViewer.src = '';
    }
    renderTiles(getCurrentLevel());
    updateBreadcrumb();
    hideTimerCompletely();
  }
}


function initializeTimer() {
  const timerPanel = document.getElementById('timerPanel');
  const timerClose = document.getElementById('timerClose');
  const timerMinimize = document.getElementById('timerMinimize');
  const timerPresets = document.querySelectorAll('.timer-preset-btn');
  const timerStart = document.getElementById('timerStart');
  const timerPause = document.getElementById('timerPause');
  const timerResume = document.getElementById('timerResume');
  const timerReset = document.getElementById('timerReset');
  const timerLap = document.getElementById('timerLap');
  const timerMiniLap = document.getElementById('timerMiniLap');
  const timerReopenBtn = document.getElementById('timerReopenBtn');

  
  initializeTimerDrag();
  
  
  initializeTimerResize();

  
  if (timerReopenBtn) {
    const newReopen = timerReopenBtn.cloneNode(true);
    timerReopenBtn.parentNode.replaceChild(newReopen, timerReopenBtn);
    newReopen.addEventListener('click', () => {
      showTimer();
      newReopen.classList.remove('pulse');
    });
  }

  
  timerPresets.forEach(btn => {
    
    if (btn.dataset.presetId || btn.id === 'addPresetBtn' || btn.classList.contains('custom-preset') || btn.classList.contains('add-custom')) return;
    
    
    if (btn.dataset.initialized === 'true') return;
    
    
    const durationAttr = btn.getAttribute('data-duration');
    if (!durationAttr) return;
    
    
    const duration = parseInt(durationAttr, 10);
    if (!duration || isNaN(duration) || duration <= 0) return;
    
    
    btn.dataset.initialized = 'true';
    
    
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
      selectTimerPreset(newBtn, duration);
    });
  });

  
  if (timerClose) {
    const newClose = timerClose.cloneNode(true);
    timerClose.parentNode.replaceChild(newClose, timerClose);
    newClose.addEventListener('click', () => hideTimer());
  }

  
  if (timerMinimize) {
    const newMinimize = timerMinimize.cloneNode(true);
    timerMinimize.parentNode.replaceChild(newMinimize, timerMinimize);
    newMinimize.addEventListener('click', () => toggleTimerMinimize());
  }

  
  if (timerStart) {
    const newStart = timerStart.cloneNode(true);
    timerStart.parentNode.replaceChild(newStart, timerStart);
    newStart.addEventListener('click', () => startTimer());
  }

  
  if (timerPause) {
    const newPause = timerPause.cloneNode(true);
    timerPause.parentNode.replaceChild(newPause, timerPause);
    newPause.addEventListener('click', () => pauseTimer());
  }

  
  if (timerResume) {
    const newResume = timerResume.cloneNode(true);
    timerResume.parentNode.replaceChild(newResume, timerResume);
    newResume.addEventListener('click', () => resumeTimer());
  }

  
  if (timerReset) {
    const newReset = timerReset.cloneNode(true);
    timerReset.parentNode.replaceChild(newReset, timerReset);
    newReset.addEventListener('click', () => resetTimer());
  }

  
  if (timerLap) {
    const newLap = timerLap.cloneNode(true);
    timerLap.parentNode.replaceChild(newLap, timerLap);
    newLap.addEventListener('click', () => addLap());
  }

  
  if (timerMiniLap) {
    const newMiniLap = timerMiniLap.cloneNode(true);
    timerMiniLap.parentNode.replaceChild(newMiniLap, timerMiniLap);
    newMiniLap.addEventListener('click', () => addLap());
  }
}

function initializeTimerDrag() {
  const timerPanel = document.getElementById('timerPanel');
  const dragHandle = document.getElementById('timerDragHandle');
  
  if (!timerPanel || !dragHandle) return;
  
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  
  dragHandle.addEventListener('mousedown', startDrag);
  dragHandle.addEventListener('touchstart', startDrag, { passive: false });
  
  function startDrag(e) {
    
    if (e.target.closest('button')) return;
    
    isDragging = true;
    timerPanel.style.transition = 'none';
    
    const rect = timerPanel.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }
    
    
    timerPanel.style.bottom = 'auto';
    timerPanel.style.right = 'auto';
    timerPanel.style.left = initialLeft + 'px';
    timerPanel.style.top = initialTop + 'px';
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    e.preventDefault();
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    let currentX, currentY;
    if (e.type === 'touchmove') {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else {
      currentX = e.clientX;
      currentY = e.clientY;
    }
    
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    
    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;
    
    
    const panelRect = timerPanel.getBoundingClientRect();
    const maxLeft = window.innerWidth - panelRect.width;
    const maxTop = window.innerHeight - panelRect.height;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    timerPanel.style.left = newLeft + 'px';
    timerPanel.style.top = newTop + 'px';
    
    e.preventDefault();
  }
  
  function stopDrag() {
    isDragging = false;
    timerPanel.style.transition = '';
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function initializeTimerResize() {
  const timerPanel = document.getElementById('timerPanel');
  const resizeHandle = document.getElementById('timerResizeHandle');
  
  if (!timerPanel || !resizeHandle) return;
  
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener('mousedown', startResize);
  resizeHandle.addEventListener('touchstart', startResize, { passive: false });
  
  function startResize(e) {
    isResizing = true;
    timerPanel.style.transition = 'none';
    
    const rect = timerPanel.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    
    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }
    
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', resize, { passive: false });
    document.addEventListener('touchend', stopResize);
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function resize(e) {
    if (!isResizing) return;
    
    let currentX, currentY;
    if (e.type === 'touchmove') {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else {
      currentX = e.clientX;
      currentY = e.clientY;
    }
    
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    
    const newWidth = Math.max(280, Math.min(window.innerWidth - 20, startWidth + deltaX));
    const newHeight = Math.max(200, Math.min(window.innerHeight - 20, startHeight + deltaY));
    
    timerPanel.style.width = newWidth + 'px';
    timerPanel.style.height = newHeight + 'px';
    
    e.preventDefault();
  }
  
  function stopResize() {
    isResizing = false;
    timerPanel.style.transition = '';
    
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', resize);
    document.removeEventListener('touchend', stopResize);
  }
}

function toggleTimerMinimize() {
  const timerPanel = document.getElementById('timerPanel');
  const minimizeBtn = document.getElementById('timerMinimize');
  
  if (!timerPanel) return;
  
  timerPanel.classList.toggle('minimized');
  
  if (!timerPanel) return;
  
  timerPanel.classList.toggle('minimized');
  
  if (minimizeBtn) {
    const icon = minimizeBtn.querySelector('i');
    if (icon) {
      if (timerPanel.classList.contains('minimized')) {
        icon.className = 'fas fa-expand';
        minimizeBtn.title = 'Expand Timer';
      } else {
        icon.className = 'fas fa-minus';
        minimizeBtn.title = 'Minimize Timer';
      }
    }
  }
}

function selectTimerPreset(btn, duration) {
  
  if (!duration || isNaN(duration) || duration <= 0) {
    console.error('Invalid timer duration:', duration);
    return;
  }
  
  
  document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  
  timerState.duration = duration;
  timerState.remaining = duration;
  
  
  updateTimerDisplay();
  
  
  const timerControls = document.getElementById('timerControls');
  timerControls && (timerControls.style.display = 'flex');
  
  
  const startBtn = document.getElementById('timerStart');
  const pauseBtn = document.getElementById('timerPause');
  const resumeBtn = document.getElementById('timerResume');
  
  if (startBtn) startBtn.style.display = 'flex';
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (resumeBtn) resumeBtn.style.display = 'none';
  
  
  updateTimerStatus('Ready to start');
  
  
  const progressBar = document.getElementById('timerProgressBar');
  progressBar && (progressBar.style.width = '100%');
  progressBar && progressBar.classList.remove('warning', 'danger');
  
  
  const timerDisplay = document.getElementById('timerDisplay');
  timerDisplay && timerDisplay.classList.remove('warning', 'danger');
}

function startTimer() {
  if (timerState.duration === 0) return;
  
  timerState.isRunning = true;
  timerState.isPaused = false;
  timerState.lastLapTime = timerState.duration;
  
  
  document.getElementById('timerStart').style.display = 'none';
  document.getElementById('timerPause').style.display = 'flex';
  document.getElementById('timerResume').style.display = 'none';
  document.getElementById('timerLap').style.display = 'flex';
  
  
  const miniLap = document.getElementById('timerMiniLap');
  if (miniLap) {
    miniLap.disabled = false;
    miniLap.style.opacity = '1';
  }
  
  updateTimerStatus('Timer running', 'active');
  
  
  timerState.interval = setInterval(() => {
    if (timerState.remaining > 0) {
      timerState.remaining--;
      updateTimerDisplay();
      updateTimerProgress();
    } else {
      timerFinished();
    }
  }, 1000);
}

function pauseTimer() {
  timerState.isRunning = false;
  timerState.isPaused = true;
  
  clearInterval(timerState.interval);
  
  
  document.getElementById('timerPause').style.display = 'none';
  document.getElementById('timerResume').style.display = 'flex';
  
  updateTimerStatus('Timer paused', 'paused');
}

function resumeTimer() {
  timerState.isRunning = true;
  timerState.isPaused = false;
  
  
  document.getElementById('timerPause').style.display = 'flex';
  document.getElementById('timerResume').style.display = 'none';
  
  updateTimerStatus('Timer running', 'active');
  
  
  timerState.interval = setInterval(() => {
    if (timerState.remaining > 0) {
      timerState.remaining--;
      updateTimerDisplay();
      updateTimerProgress();
    } else {
      timerFinished();
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerState.interval);
  
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.remaining = timerState.duration;
  timerState.laps = [];
  timerState.lastLapTime = timerState.duration;
  
  
  document.getElementById('timerStart').style.display = 'flex';
  document.getElementById('timerPause').style.display = 'none';
  document.getElementById('timerResume').style.display = 'none';
  document.getElementById('timerLap').style.display = 'none';
  
  
  const miniLap = document.getElementById('timerMiniLap');
  if (miniLap) {
    miniLap.disabled = true;
    miniLap.style.opacity = '0.5';
  }
  
  updateTimerDisplay();
  renderLaps();
  
    const progressBar = document.getElementById('timerProgressBar');
  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.classList.remove('warning', 'danger');
  }
  
    const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) timerDisplay.classList.remove('warning', 'danger');
  
  updateTimerStatus('Timer reset');
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  const timerTitle = document.querySelector('.timer-title');
  if (!display) return;
  
  
  const remaining = timerState.remaining || 0;
  const duration = timerState.duration || 1; 
  
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  display.textContent = timeStr;
  
  
  if (timerTitle) {
    timerTitle.setAttribute('data-time', timeStr);
  }
  
  
  const percentRemaining = (remaining / duration) * 100;
  
  display.classList.remove('warning', 'danger');
  
  if (percentRemaining <= 10) {
    display.classList.add('danger');
  } else if (percentRemaining <= 25) {
    display.classList.add('warning');
  }
}

function updateTimerProgress() {
  const progressBar = document.getElementById('timerProgressBar');
  if (!progressBar) return;
  
  const percentRemaining = (timerState.remaining / timerState.duration) * 100;
  progressBar.style.width = `${percentRemaining}%`;
  
  progressBar.classList.remove('warning', 'danger');
  if (percentRemaining <= 10) {
    progressBar.classList.add('danger');
  } else if (percentRemaining <= 25) {
    progressBar.classList.add('warning');
  }
}

function updateTimerStatus(message, statusClass = '') {
  const status = document.getElementById('timerStatus');
  if (!status) return;
  
  status.textContent = message;
  status.className = 'timer-status';
  if (statusClass) {
    status.classList.add(statusClass);
  }
}

function showTimer() {
  const timerPanel = document.getElementById('timerPanel');
  const reopenBtn = document.getElementById('timerReopenBtn');
  if (timerPanel) {
    timerPanel.style.display = 'flex';
  }
  if (reopenBtn) {
    reopenBtn.style.display = 'none';
  }
}

function hideTimer() {
  const timerPanel = document.getElementById('timerPanel');
  const reopenBtn = document.getElementById('timerReopenBtn');
  if (timerPanel) {
    timerPanel.style.display = 'none';
  }
  
  const pdfViewer = document.getElementById('pdfViewer');
    const isPdfVisible = pdfViewer && (pdfViewer.classList.contains('active') || (pdfViewer.src && pdfViewer.src !== '' && pdfViewer.src !== 'about:blank'));
  
  if (reopenBtn && isPdfVisible) {
    reopenBtn.style.display = 'flex';
    
    if (timerState.isRunning) {
      reopenBtn.classList.add('pulse');
    }
  }
}

function hideTimerCompletely() {
  const timerPanel = document.getElementById('timerPanel');
  const reopenBtn = document.getElementById('timerReopenBtn');
  if (timerPanel) {
    timerPanel.style.display = 'none';
  }
  if (reopenBtn) {
    reopenBtn.style.display = 'none';
    reopenBtn.classList.remove('pulse');
  }
  
  
  if (timerState.isRunning) {
    clearInterval(timerState.interval);
    timerState.isRunning = false;
  }
}

function playTimerAlert() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    
    const beepDuration = 0.2;
    const beepCount = 3;
    
    for (let i = 0; i < beepCount; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.4 + beepDuration);
      
      oscillator.start(audioContext.currentTime + i * 0.4);
      oscillator.stop(audioContext.currentTime + i * 0.4 + beepDuration);
    }
  } catch (e) {
    console.log('Audio alert not supported');
  }
}


function addLap() {
  if (!timerState.isRunning || timerState.remaining <= 0) {
    console.log('Cannot add lap - timer not running or no time remaining');
    return;
  }
  
  const lapTime = timerState.remaining;
  const elapsed = timerState.lastLapTime - lapTime;
  
  timerState.laps.push({
    number: timerState.laps.length + 1,
    time: lapTime,
    elapsed: elapsed
  });
  
  timerState.lastLapTime = lapTime;
  renderLaps();
  
  
  showNotification(`Lap ${timerState.laps.length} recorded`, 'success');
}

function deleteLap(index) {
  timerState.laps.splice(index, 1);
  
  timerState.laps.forEach((lap, i) => {
    lap.number = i + 1;
  });
  renderLaps();
}

function clearAllLaps() {
  timerState.laps = [];
  timerState.lastLapTime = timerState.duration;
  renderLaps();
}

function formatLapTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function renderLaps() {
  const lapsContainer = document.getElementById('timerLaps');
  if (!lapsContainer) return;
  
  if (timerState.laps.length === 0) {
    lapsContainer.innerHTML = '';
    return;
  }
  
  let html = `
    <div class="timer-laps-header">
      <span class="timer-laps-title">Laps (${timerState.laps.length})</span>
      <button class="timer-laps-clear" onclick="clearAllLaps()" title="Clear all laps">
        <i class="fas fa-trash"></i> Clear All
      </button>
    </div>
  `;
  
  
  const reversedLaps = [...timerState.laps].reverse();
  reversedLaps.forEach((lap, i) => {
    const actualIndex = timerState.laps.length - 1 - i;
    html += `
      <div class="timer-lap-item">
        <div class="timer-lap-info">
          <span class="timer-lap-number">#${lap.number}</span>
          <span class="timer-lap-time">${formatLapTime(lap.time)}</span>
          <span class="timer-lap-elapsed">+${formatLapTime(lap.elapsed)}</span>
        </div>
        <button class="timer-lap-delete" onclick="deleteLap(${actualIndex})" title="Delete lap">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });
  
  lapsContainer.innerHTML = html;
}

window.addEventListener('contextmenu', e => {
  
  if (e.target.closest('.custom-preset')) return;
  e.preventDefault();
});

(function initDownloadDropdown() {
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadDropdown = document.getElementById('downloadDropdown');
    
    if (downloadBtn && downloadDropdown) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDropdown.classList.toggle('active');
      });
      
            document.addEventListener('click', (e) => {
        if (!downloadDropdown.contains(e.target) && e.target !== downloadBtn) {
          downloadDropdown.classList.remove('active');
        }
      });
      
            const downloadExe = document.getElementById('downloadExe');
      const downloadMsi = document.getElementById('downloadMsi');
      
      if (downloadExe) {
        downloadExe.href = 'https://github.com/Nugget1252/Questionarytauri/releases/download/v0.2.1/Questionary_0.2.1_x64-setup.exe'; // Replace with actual .exe download URL
        downloadExe.addEventListener('click', () => {
          showNotification('Download started for .exe installer', 'info');
        });
      }
      
      if (downloadMsi) {
        downloadMsi.href = 'https://github.com/Nugget1252/Questionarytauri/releases/download/v0.2.1/Questionary_0.2.1_x64_en-US.msi'; // Replace with actual .msi download URL
        downloadMsi.addEventListener('click', () => {
          showNotification('Download started for .msi installer', 'info');
        });
      }
    }
  });
})();


function initializeNewFeatures() {
    try { if (typeof loadNotes === 'function') loadNotes(); } catch(e) { console.log('loadNotes not available'); }
  try { if (typeof loadFlashcardDecks === 'function') loadFlashcardDecks(); } catch(e) { console.log('loadFlashcardDecks not available'); }
  try { if (typeof loadStudySessions === 'function') loadStudySessions(); } catch(e) { console.log('loadStudySessions not available'); }
  try { if (typeof loadDocumentProgress === 'function') loadDocumentProgress(); } catch(e) { console.log('loadDocumentProgress not available'); }
  try { if (typeof loadQuickLinks === 'function') loadQuickLinks(); } catch(e) { console.log('loadQuickLinks not available'); }
  try { if (typeof loadStudyStats === 'function') loadStudyStats(); } catch(e) { console.log('loadStudyStats not available'); }
  
  
  const createNoteBtn = document.getElementById('createNoteBtn');
  const closeNoteModal = document.getElementById('closeNoteModal');
  const cancelNoteBtn = document.getElementById('cancelNoteBtn');
  const saveNoteBtn = document.getElementById('saveNoteBtn');
  const noteModal = document.getElementById('noteModal');
  
  if (createNoteBtn && typeof openNoteModal === 'function') createNoteBtn.onclick = () => openNoteModal();
  if (closeNoteModal && noteModal) closeNoteModal.onclick = () => noteModal.classList.remove('active');
  if (cancelNoteBtn && noteModal) cancelNoteBtn.onclick = () => noteModal.classList.remove('active');
  if (saveNoteBtn && typeof saveNote === 'function') saveNoteBtn.onclick = saveNote;
  
  
  const createDeckBtn = document.getElementById('createDeckBtn');
  const closeFlashcardModal = document.getElementById('closeFlashcardModal');
  const cancelFlashcardBtn = document.getElementById('cancelFlashcardBtn');
  const saveDeckBtn = document.getElementById('saveDeckBtn');
  const addCardBtn = document.getElementById('addCardBtn');
  const flashcardModal = document.getElementById('flashcardModal');
  
  if (createDeckBtn && typeof openFlashcardModal === 'function') createDeckBtn.onclick = () => openFlashcardModal();
  if (closeFlashcardModal && flashcardModal) closeFlashcardModal.onclick = () => flashcardModal.classList.remove('active');
  if (cancelFlashcardBtn && flashcardModal) cancelFlashcardBtn.onclick = () => flashcardModal.classList.remove('active');
  if (saveDeckBtn && typeof saveDeck === 'function') saveDeckBtn.onclick = saveDeck;
  if (addCardBtn && typeof addCardEditor === 'function') addCardBtn.onclick = addCardEditor;
  
  
  const closeStudyModal = document.getElementById('closeStudyModal');
  const flipCardBtn = document.getElementById('flipCardBtn');
  const nextCardBtn = document.getElementById('nextCardBtn');
  const prevCardBtn = document.getElementById('prevCardBtn');
  const activeFlashcard = document.getElementById('activeFlashcard');
  const studyModal = document.getElementById('studyModal');
  
  if (closeStudyModal && studyModal) closeStudyModal.onclick = () => studyModal.classList.remove('active');
  if (flipCardBtn && typeof flipCard === 'function') flipCardBtn.onclick = flipCard;
  if (nextCardBtn && typeof nextCard === 'function') nextCardBtn.onclick = nextCard;
  if (prevCardBtn && typeof prevCard === 'function') prevCardBtn.onclick = prevCard;
  if (activeFlashcard && typeof flipCard === 'function') activeFlashcard.onclick = flipCard;
  
  
  const addStudySessionBtn = document.getElementById('addStudySessionBtn');
  const closeSessionModal = document.getElementById('closeSessionModal');
  const cancelSessionBtn = document.getElementById('cancelSessionBtn');
  const saveSessionBtn = document.getElementById('saveSessionBtn');
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');
  const sessionModal = document.getElementById('sessionModal');
  
  if (addStudySessionBtn && typeof openSessionModal === 'function') addStudySessionBtn.onclick = () => openSessionModal();
  if (closeSessionModal && sessionModal) closeSessionModal.onclick = () => sessionModal.classList.remove('active');
  if (cancelSessionBtn && sessionModal) cancelSessionBtn.onclick = () => sessionModal.classList.remove('active');
  if (saveSessionBtn && typeof saveSession === 'function') saveSessionBtn.onclick = saveSession;
  
  if (prevMonth && typeof renderCalendar === 'function') {
    prevMonth.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    };
  }
  
  if (nextMonth && typeof renderCalendar === 'function') {
    nextMonth.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    };
  }
  
  
  document.querySelectorAll('.progress-filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.progress-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProgress(btn.dataset.filter);
    };
  });
  
  
  const quickLinksToggle = document.getElementById('quickLinksToggle');
  const quickLinksPanel = document.getElementById('quickLinksPanel');
  const quickLinksClose = document.getElementById('quickLinksClose');
  const addQuickLinkBtn = document.getElementById('addQuickLinkBtn');
  
  if (quickLinksToggle && quickLinksPanel) {
    quickLinksToggle.onclick = () => quickLinksPanel.classList.toggle('active');
  }
  
  
  if (quickLinksClose && quickLinksPanel) {
    quickLinksClose.onclick = () => quickLinksPanel.classList.remove('active');
  }
  
  
  document.addEventListener('click', (e) => {
    if (quickLinksPanel && quickLinksPanel.classList.contains('active')) {
      if (!e.target.closest('.quick-links-panel') && !e.target.closest('.quick-links-toggle')) {
        quickLinksPanel.classList.remove('active');
      }
    }
  });
  
  
  if (addQuickLinkBtn) {
    addQuickLinkBtn.onclick = (e) => {
      e.stopPropagation();
      if (path.length === 0) {
        if (typeof showNotification === 'function') showNotification('Navigate to a folder first', 'info');
        return;
      }
      
      
      const pathStr = path.join('|');
      if (quickLinks.some(ql => ql.pathArray.join('|') === pathStr)) {
        if (typeof showNotification === 'function') showNotification('This location is already in quick links', 'info');
        return;
      }
      
      quickLinks.push({ 
        id: Date.now().toString(), 
        name: path[path.length - 1], 
        pathArray: [...path] 
      });
      if (typeof saveQuickLinks === 'function') saveQuickLinks();
      if (typeof renderQuickLinks === 'function') renderQuickLinks();
      if (typeof showNotification === 'function') showNotification('Added to quick links!', 'success');
    };
  }
  
  
  if (typeof renderQuickLinks === 'function') renderQuickLinks();
  
  console.log('New features initialized');
}

function filterProgress(filter) {
  const items = document.querySelectorAll('.progress-item');
  items.forEach(item => {
    const status = item.dataset.status;
    if (filter === 'all' || status === filter) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}


let searchHistory = JSON.parse(localStorage.getItem('questionary-search-history') || '[]');

function saveSearchHistory() {
  localStorage.setItem('questionary-search-history', JSON.stringify(searchHistory));
}

function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  searchHistory = searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());
  searchHistory.unshift(query);
  searchHistory = searchHistory.slice(0, 10);
  saveSearchHistory();
}

function initSearchHistory() {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;
  
  
  const container = searchInput.parentElement;
  let dropdown = document.getElementById('searchHistoryDropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'searchHistoryDropdown';
    dropdown.className = 'search-history-dropdown';
    container.appendChild(dropdown);
  }
  
  searchInput.addEventListener('focus', showSearchHistory);
  searchInput.addEventListener('input', (e) => {
    if (e.target.value === '') showSearchHistory();
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      dropdown.classList.remove('active');
    }
  });
}

function showSearchHistory() {
  const dropdown = document.getElementById('searchHistoryDropdown');
  const searchInput = document.getElementById('globalSearch');
  if (!dropdown || searchHistory.length === 0 || searchInput.value) return;
  
  dropdown.innerHTML = `
    <div class="search-history-header">
      <span>Recent Searches</span>
      <button onclick="clearSearchHistory()" class="clear-history-btn">Clear</button>
    </div>
    ${searchHistory.map(q => `
      <div class="search-history-item" onclick="useSearchHistory('${escapeHtml(q)}')">
        <i class="fas fa-history"></i>
        <span>${escapeHtml(q)}</span>
      </div>
    `).join('')}
  `;
  dropdown.classList.add('active');
}

function useSearchHistory(query) {
  const searchInput = document.getElementById('globalSearch');
  searchInput.value = query;
  document.getElementById('searchHistoryDropdown')?.classList.remove('active');
  performSearch(query);
}

function clearSearchHistory() {
  searchHistory = [];
  saveSearchHistory();
  document.getElementById('searchHistoryDropdown')?.classList.remove('active');
}

window.useSearchHistory = useSearchHistory;
window.clearSearchHistory = clearSearchHistory;


let customTimerPresets = JSON.parse(localStorage.getItem('questionary-timer-presets') || '[]');

function saveCustomPresets() {
  localStorage.setItem('questionary-timer-presets', JSON.stringify(customTimerPresets));
}

function initCustomPresets() {
  
  customTimerPresets = customTimerPresets.filter(p => {
    const duration = parseInt(p.duration, 10);
    return duration && duration > 0;
  });
  saveCustomPresets();
  
  renderTimerPresets();
  addCustomPresetButton();
  
  
  const display = document.getElementById('timerDisplay');
  if (display) display.textContent = '00:00:00';
  
  
  timerState.duration = 0;
  timerState.remaining = 0;
}

function renderTimerPresets() {
  const container = document.getElementById('timerPresets');
  if (!container) return;
  
  
  container.querySelectorAll('[data-preset-id]').forEach(el => el.remove());
  
  
  customTimerPresets.forEach(preset => {
    
    const duration = parseInt(preset.duration, 10);
    if (!duration || duration <= 0) return;
    
    const btn = document.createElement('button');
    btn.className = 'timer-preset-btn custom-preset';
    btn.dataset.duration = duration.toString();
    btn.dataset.presetId = preset.id;
    btn.title = `${preset.label} (${formatPresetTime(duration)}) - Right-click to delete`;
    btn.innerHTML = `
      <span>${preset.label}</span>
      <small>${formatPresetTime(duration)}</small>
    `;
    
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectTimerPreset(btn, duration);
    });
    
    
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm(`Delete "${preset.label}" preset?`)) {
        removeCustomPreset(preset.id);
      }
    });
    
    
    const addBtn = document.getElementById('addPresetBtn');
    if (addBtn) {
      container.insertBefore(btn, addBtn);
    } else {
      container.appendChild(btn);
    }
  });
}

function addCustomPresetButton() {
  const container = document.getElementById('timerPresets');
  if (!container || document.getElementById('addPresetBtn')) return;
  
  const addBtn = document.createElement('button');
  addBtn.id = 'addPresetBtn';
  addBtn.className = 'timer-preset-btn add-custom';
  addBtn.title = 'Add Custom Preset';
  addBtn.innerHTML = '<i class="fas fa-plus"></i>';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    showAddPresetForm();
  };
  container.appendChild(addBtn);
}

function showAddPresetForm() {
  
  const existingForm = document.getElementById('addPresetForm');
  if (existingForm) {
    existingForm.remove();
    return;
  }
  
  
  const overlay = document.createElement('div');
  overlay.id = 'addPresetForm';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;';
  
  overlay.innerHTML = `
    <div style="background:var(--card-bg, #fff);padding:20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2);min-width:280px;">
      <h3 style="margin:0 0 15px 0;font-size:1.1rem;"><i class="fas fa-clock"></i> Add Custom Timer</h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <input type="text" id="presetLabel" placeholder="Label (e.g., Quiz)" maxlength="15" style="padding:10px;border:1px solid var(--border-color, #ddd);border-radius:6px;font-size:1rem;">
        <input type="number" id="presetMinutes" placeholder="Duration (minutes)" min="1" max="480" style="padding:10px;border:1px solid var(--border-color, #ddd);border-radius:6px;font-size:1rem;">
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button onclick="document.getElementById('addPresetForm').remove()" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:6px;background:transparent;cursor:pointer;">Cancel</button>
          <button onclick="addCustomPreset()" style="flex:1;padding:10px;border:none;border-radius:6px;background:#f97316;color:white;cursor:pointer;font-weight:600;">Add</button>
        </div>
      </div>
    </div>
  `;
  
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
  document.getElementById('presetLabel').focus();
}

function addCustomPreset() {
  const label = document.getElementById('presetLabel')?.value.trim();
  const minutesInput = document.getElementById('presetMinutes')?.value;
  const minutes = parseInt(minutesInput, 10);
  
  if (!label) {
    showNotification('Please enter a label', 'error');
    return;
  }
  
  if (!minutes || isNaN(minutes) || minutes < 1) {
    showNotification('Please enter a valid duration (minutes)', 'error');
    return;
  }
  
  const durationInSeconds = minutes * 60;
  
  const preset = {
    id: Date.now().toString(),
    label: label,
    duration: durationInSeconds
  };
  
  customTimerPresets.push(preset);
  saveCustomPresets();
  
  document.getElementById('addPresetForm')?.remove();
  renderTimerPresets();
  showNotification(`Timer preset "${label}" added (${minutes} min)`, 'success');
}

function removeCustomPreset(id) {
  customTimerPresets = customTimerPresets.filter(p => p.id !== id);
  saveCustomPresets();
  const btn = document.querySelector(`[data-preset-id="${id}"]`);
  btn?.remove();
  showNotification('Preset removed', 'info');
}

function formatPresetTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}



window.addCustomPreset = addCustomPreset;
window.removeCustomPreset = removeCustomPreset;


document.addEventListener('DOMContentLoaded', () => setTimeout(initCustomPresets, 100));


let darkModeSchedule = JSON.parse(localStorage.getItem('questionary-darkmode-schedule') || '{"enabled":false,"darkStart":19,"darkEnd":7}');

function saveDarkModeSchedule() {
  localStorage.setItem('questionary-darkmode-schedule', JSON.stringify(darkModeSchedule));
}

function checkDarkModeSchedule() {
  if (!darkModeSchedule.enabled) return;
  
  const hour = new Date().getHours();
  const shouldBeDark = (hour >= darkModeSchedule.darkStart || hour < darkModeSchedule.darkEnd);
  const isDark = document.body.classList.contains('dark-theme');
  
  if (shouldBeDark !== isDark) {
    document.body.classList.toggle('dark-theme', shouldBeDark);
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.className = shouldBeDark ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
}


setInterval(checkDarkModeSchedule, 60000);
document.addEventListener('DOMContentLoaded', checkDarkModeSchedule);


let pageBookmarks = JSON.parse(localStorage.getItem('questionary-page-bookmarks') || '{}');

function savePageBookmarks() {
  localStorage.setItem('questionary-page-bookmarks', JSON.stringify(pageBookmarks));
}

function addToPrintQueue(docPath, pageNumber, label = '') {
  if (!pageBookmarks[docPath]) {
    pageBookmarks[docPath] = [];
  }
  
  const existing = pageBookmarks[docPath].find(b => b.page === pageNumber);
  if (existing) {
    showNotification('Page already bookmarked', 'info');
    return;
  }
  
  pageBookmarks[docPath].push({
    id: Date.now().toString(),
    page: pageNumber,
    label: label || `Page ${pageNumber}`,
    createdAt: Date.now()
  });
  
  savePageBookmarks();
  showNotification(`Bookmarked page ${pageNumber}`, 'success');
  renderPageBookmarks(docPath);
}

function removePageBookmark(docPath, bookmarkId) {
  if (!pageBookmarks[docPath]) return;
  pageBookmarks[docPath] = pageBookmarks[docPath].filter(b => b.id !== bookmarkId);
  savePageBookmarks();
  renderPageBookmarks(docPath);
}

function renderPageBookmarks(docPath) {
  const container = document.getElementById('pageBookmarksList');
  if (!container) return;
  
  const bookmarks = pageBookmarks[docPath] || [];
  
  if (bookmarks.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 1rem;">No page bookmarks yet</p>';
    return;
  }
  
  container.innerHTML = bookmarks.map(b => `
    <div class="page-bookmark-item" onclick="goToPage(${b.page})">
      <i class="fas fa-bookmark"></i>
      <span>${escapeHtml(b.label)}</span>
      <button class="note-action-btn delete" onclick="event.stopPropagation(); removePageBookmark('${docPath}', '${b.id}')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function goToPage(pageNumber) {
  const pdfViewer = document.getElementById('pdfViewer');
  if (pdfViewer && pdfViewer.src) {
    
    
    showNotification(`Navigate to page ${pageNumber}`, 'info');
  }
}

window.addPageBookmark = addPageBookmark;
window.removePageBookmark = removePageBookmark;
window.goToPage = goToPage;



function initDocumentPreview() {
  
  const existingTooltip = document.getElementById('previewTooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
}

let previewTimeout = null;

function showPreviewTooltip(element, url, name) {
  
  return;
}

function hidePreviewTooltip() {
  clearTimeout(previewTimeout);
  const tooltip = document.getElementById('previewTooltip');
  if (tooltip) {
    tooltip.remove();
  }
}

document.addEventListener('DOMContentLoaded', initDocumentPreview);


function generateShareLink(docPath) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ path: docPath.join('/') });
  const shareUrl = `${baseUrl}?${params.toString()}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showNotification('Share link copied to clipboard!', 'success');
    });
  } else {
    prompt('Copy this link:', shareUrl);
  }
  
  return shareUrl;
}

function handleShareLink() {
  const params = new URLSearchParams(window.location.search);
  const pathParam = params.get('path');
  
  if (pathParam) {
    const pathArr = pathParam.split('/');
    path = pathArr;
    const level = getCurrentLevel();
    
    if (typeof level === 'string' && level !== '#') {
      showPDF(level);
    } else {
      renderTiles(level);
    }
    updateBreadcrumb();
  }
}

window.generateShareLink = generateShareLink;
document.addEventListener('DOMContentLoaded', handleShareLink);


let printQueue = [];

function addToPrintQueue(docPath, url) {
  if (printQueue.some(d => d.url === url)) {
    showNotification('Already in queue', 'info');
    return;
  }
  
  printQueue.push({ path: docPath, url, name: docPath[docPath.length - 1] });
  showNotification(`Added to print queue (${printQueue.length} items)`, 'success');
  updatePrintQueueBadge();
}

function removeFromPrintQueue(url) {
  printQueue = printQueue.filter(d => d.url !== url);
  updatePrintQueueBadge();
  renderPrintQueue();
}

function clearPrintQueue() {
  printQueue = [];
  updatePrintQueueBadge();
  renderPrintQueue();
  showNotification('Queue cleared', 'info');
}

function updatePrintQueueBadge() {
  let badge = document.getElementById('printQueueBadge');
  if (printQueue.length > 0) {
    if (!badge) {
      const compareBtn = document.getElementById('compareBtn');
      if (compareBtn) {
        badge = document.createElement('span');
        badge.id = 'printQueueBadge';
        badge.className = 'queue-badge';
        compareBtn.parentElement.appendChild(badge);
      }
    }
    if (badge) badge.textContent = printQueue.length;
  } else if (badge) {
    badge.remove();
  }
}

function renderPrintQueue() {
  const container = document.getElementById('printQueueList');
  if (!container) return;
  
  if (printQueue.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Queue is empty</p>';
    return;
  }
  
  container.innerHTML = printQueue.map(doc => `
    <div class="print-queue-item">
      <i class="fas fa-file-pdf"></i>
      <span>${escapeHtml(doc.name)}</span>
      <button onclick="removeFromPrintQueue('${doc.url}')" title="Remove"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

window.addToPrintQueue = addToPrintQueue;
window.removeFromPrintQueue = removeFromPrintQueue;
window.clearPrintQueue = clearPrintQueue;


function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}





let pdfViewStartTime = null;

function trackPdfViewStart() {
  pdfViewStartTime = Date.now();
}

function trackPdfViewEnd(docPath) {
  if (pdfViewStartTime) {
    const viewedMinutes = Math.round((Date.now() - pdfViewStartTime) / 60000);
    if (viewedMinutes >= 1) {
      trackStudyTime(viewedMinutes);
      
      
      const currentProgress = documentProgress[docPath]?.progress || 0;
      const newProgress = Math.min(100, currentProgress + Math.min(viewedMinutes * 5, 25));
      updateDocProgress(docPath, newProgress);
    }
    pdfViewStartTime = null;
  }
}

window.trackPdfViewStart = trackPdfViewStart;
window.trackPdfViewEnd = trackPdfViewEnd;


document.addEventListener('keydown', (e) => {
  
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  
  if (e.key === 'n' || e.key === 'N') {
    if (typeof openNoteModal === 'function') {
      e.preventDefault();
      openNoteModal();
    }
  }
  
  
  if (e.key === 'f' || e.key === 'F') {
    if (typeof openFlashcardModal === 'function') {
      e.preventDefault();
      openFlashcardModal();
    }
  }
  
  
  if (e.key === 's' || e.key === 'S') {
    if (path.length > 0 && typeof generateShareLink === 'function') {
      e.preventDefault();
      generateShareLink(path);
    }
  }
  
  
  if (e.key === 'q' || e.key === 'Q') {
    e.preventDefault();
    const panel = document.getElementById('quickLinksPanel');
    panel?.classList.toggle('active');
  }
});

