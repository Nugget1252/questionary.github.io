/* Top of js/app.js */
if (window._HOT_APP_JS_LOADED && document.currentScript && !document.currentScript.id?.startsWith('hot-js-')) {
    console.log('[App] Stored hot-updated app.js is already running. Skipping base bundle.');
} else {



    // ================================================================
    // LIVE GLOBAL SCOPE PATCHER (Forces updates into window scope)
    // ================================================================
    (function applyLiveModuleOverrides() {
        try {
            const raw = localStorage.getItem('questionary-code-files');
            if (raw) {
                const files = JSON.parse(raw);
                if (files['js/studyRoom.js']) {
                    window.eval(files['js/studyRoom.js']);
                    console.log('[HotUpdate] Force-evaluated latest js/studyRoom.js into global scope');
                }
                if (files['js/features.js']) {
                    window.eval(files['js/features.js']);
                    console.log('[HotUpdate] Force-evaluated latest js/features.js into global scope');
                }
            }
        } catch (err) {
            console.error('[HotUpdate] Module override error:', err);
        }
    })();

    // Top-level variables use var/window scope to allow safe hot-update re-evaluation
    var currentUser = window.currentUser || null;
    var path = window.path || [];
    var currentView = window.currentView || 'home';
    var editMode = window.editMode || false;
    var favorites = window.favorites || [];
    var notes = window.notes || [];
    var flashcardDecks = window.flashcardDecks || [];
    var studySessions = window.studySessions || [];
    var documentProgress = window.documentProgress || {};
    var quickLinks = window.quickLinks || [];
    var documents = window.documents || {}; // Deprecated: Kept empty strictly to prevent legacy errors
    window.documents = documents;
    var studyStats = window.studyStats || { totalTime: 0, streak: 0, lastStudyDate: null, hourlyActivity: {} };
    var currentCalendarDate = window.currentCalendarDate || new Date();
    var currentEditingNote = window.currentEditingNote || null;
    var currentEditingDeck = window.currentEditingDeck || null;
    var currentStudyDeck = window.currentStudyDeck || null;
    var currentCardIndex = window.currentCardIndex || 0;
    var accessibilitySettings = window.accessibilitySettings || {
        highContrast: localStorage.getItem('accessibility-high-contrast') === 'true',
        largeText: localStorage.getItem('accessibility-large-text') === 'true',
        reducedMotion: localStorage.getItem('accessibility-reduced-motion') === 'true',
        enhancedFocus: localStorage.getItem('accessibility-enhanced-focus') === 'true'
    }
    // PREVENT ACCIDENTAL UI TEXT SELECTION ENGINE
    // ================================================================
    function preventAccidentalSelection() {
      if (!document.getElementById('prevent-selection-styles')) {
        const style = document.createElement('style');
        style.id = 'prevent-selection-styles';
        style.textContent = `
          body, header, .header, .logo, .nav-links, .user-badge, .user-dropdown-menu,
          .dashboard-header, .stat-card, .breadcrumb-container, .section-header, .tile,
          .btn, .btn-sm, .modal-header, .modal-footer, .timer-panel, .quick-links-panel,
          .accessibility-panel, .sr-lobby, .sr-lobby-header, .sr-lobby-card,
          .sr-feature-item, .sr-session-bar, .sr-sidebar, .sr-sidebar-tabs, .sr-ctrl-btn,
          .sr-wb-toolbar, .sr-exp-badge, .alarm-notification, .login-screen, .login-card,
          .card-editor, .session-item, .deck-card, .note-card, .quick-link-item,
          .search-result-item, .page-bookmark-item, .print-queue-item, .timer-preset-btn,
          .dialog-box, .dialog-overlay, #dbUploadOverlay, #dbDropZone, .mobile-bottom-nav {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }

          input, textarea, select, code, pre, [contenteditable="true"],
          .note-card-content, .note-card-title, .flashcard-front, .flashcard-back,
          .quiz-question, .sr-chat-msg, .sr-wb-q-textarea, .selectable-text {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      }

      document.addEventListener('selectstart', (e) => {
        const isSelectable = e.target.closest && e.target.closest(
          'input, textarea, select, code, pre, [contenteditable="true"], .note-card-content, .note-card-title, .flashcard-front, .flashcard-back, .quiz-question, .sr-chat-msg, .sr-wb-q-textarea, .selectable-text, iframe, #pdfViewer'
        );
        if (!isSelectable) {
          e.preventDefault();
        }
      }, false);

      document.addEventListener('dragstart', (e) => {
        const isDraggable = e.target.closest && e.target.closest(
          'a, img, [draggable="true"]'
        );
        if (!isDraggable) {
          e.preventDefault();
        }
      }, false);
    }

    preventAccidentalSelection();

    // ================================================================
    // DUAL-ENGINE SQLITE & INDEXEDDB DATABASE SERVICE (Android Unbreakable)
    // ================================================================
    const LocalNodeStore = {
      getNodes() {
        try {
          const data = localStorage.getItem('questionary-local-nodes');
          return data ? JSON.parse(data) : [];
        } catch (e) {
          return [];
        }
      },

      saveNodes(nodes) {
        localStorage.setItem('questionary-local-nodes', JSON.stringify(nodes));
      },

      seedDefaultLibrary() {
        const starterNodes = [
          { id: 1, parent_id: null, name: 'Physics', is_folder: 1, file_path: '#' },
          { id: 2, parent_id: null, name: 'Chemistry', is_folder: 1, file_path: '#' },
          { id: 3, parent_id: null, name: 'Mathematics', is_folder: 1, file_path: '#' },
          { id: 4, parent_id: null, name: 'Biology', is_folder: 1, file_path: '#' },
          { id: 5, parent_id: 1, name: 'Mechanics & Motion', is_folder: 1, file_path: '#' },
          { id: 6, parent_id: 1, name: 'Thermodynamics', is_folder: 1, file_path: '#' },
          { id: 7, parent_id: 1, name: 'Electromagnetism', is_folder: 1, file_path: '#' },
          { id: 8, parent_id: 2, name: 'Organic Chemistry', is_folder: 1, file_path: '#' },
          { id: 9, parent_id: 2, name: 'Inorganic Chemistry', is_folder: 1, file_path: '#' },
          { id: 10, parent_id: 3, name: 'Calculus & Vectors', is_folder: 1, file_path: '#' },
          { id: 11, parent_id: 3, name: 'Algebra & Matrices', is_folder: 1, file_path: '#' },
          { id: 12, parent_id: 4, name: 'Genetics & Cell Biology', is_folder: 1, file_path: '#' }
        ];
        this.saveNodes(starterNodes);
        return starterNodes;
      },

      getChildren(pathArray) {
        let nodes = this.getNodes();
        if (nodes.length === 0) {
          nodes = this.seedDefaultLibrary();
        }

        if (!pathArray || pathArray.length === 0) {
          return nodes.filter(n => n.parent_id === null);
        }

        let currentParentId = null;
        for (const segment of pathArray) {
          const match = nodes.find(n => n.parent_id === currentParentId && n.name === segment);
          if (!match) return [];
          currentParentId = match.id;
        }

        return nodes.filter(n => n.parent_id === currentParentId);
      },

      search(keyword) {
        const nodes = this.getNodes();
        const cleanKw = keyword.toLowerCase();
        const matches = nodes.filter(n => n.name.toLowerCase().includes(cleanKw));
        
        return matches.map(m => {
          const pathArray = [];
          let cur = m;
          while (cur && cur.parent_id !== null) {
            const parent = nodes.find(n => n.id === cur.parent_id);
            if (parent) { pathArray.unshift(parent.name); cur = parent; }
            else break;
          }
          pathArray.push(m.name);
          return {
            name: m.name,
            path: pathArray,
            isFolder: m.is_folder === 1,
            url: m.file_path
          };
        });
      },

      countDocuments() {
        const nodes = this.getNodes();
        return nodes.filter(n => n.is_folder === 0 && n.file_path && n.file_path !== '#').length;
      }
    };

    const DbService = {
      db: null,
      SQL: null,
      isFallback: false,

      async init() {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DbService init timeout')), 2000)
        );

        try {
          await Promise.race([this._internalInit(), timeoutPromise]);
          return true;
        } catch (err) {
          console.warn('[SQLite] WASM DB Init timed out or failed. Activating LocalNodeStore fallback engine:', err);
          this.isFallback = true;
          LocalNodeStore.seedDefaultLibrary();
          return true;
        }
      },

      async _internalInit() {
        if (!window.SQL_INSTANCE) {
          if (typeof window.initSqlJs === 'undefined') {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }

          window.SQL_INSTANCE = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
          });
        }

        this.SQL = window.SQL_INSTANCE;

        // Check IndexedDB
        let savedDb = await this.loadFromIndexedDB();
        if (savedDb) {
          this.db = new this.SQL.Database(savedDb);
          savedDb = null;

          if (await this.isValidDatabase()) {
            console.log('[SQLite] Valid DB loaded from IndexedDB cache');
            return true;
          } else {
            await this.clearIndexedDB();
            this.db = null;
          }
        }

        // Candidate asset paths for cross-platform / Tauri / WebViews
        const candidatePaths = [
          'questionary.db',
          '/questionary.db',
          'assets/questionary.db',
          (window.location.origin || '') + '/questionary.db'
        ];

        for (const path of candidatePaths) {
          try {
            const response = await fetch(path + '?v=' + Date.now());
            if (response.ok) {
              let arrayBuffer = await response.arrayBuffer();
              let uInt8Array = new Uint8Array(arrayBuffer);
              const tempDb = new this.SQL.Database(uInt8Array);
              
              arrayBuffer = null;
              uInt8Array = null;

              this.db = tempDb;
              if (await this.isValidDatabase()) {
                await this.saveToIndexedDB();
                console.log(`[SQLite] Loaded questionary.db from: ${path}`);
                return true;
              }
            }
          } catch (fetchErr) {}
        }

        // Fresh WASM Schema Fallback
        console.log('[SQLite] Populating default schema...');
        this.db = new this.SQL.Database();
        await this.createDefaultSchema();
        return true;
      },

      async createDefaultSchema() {
        if (!this.db) return;
        try {
          this.db.run(`
            CREATE TABLE IF NOT EXISTS nodes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              parent_id INTEGER DEFAULT NULL,
              name TEXT NOT NULL,
              is_folder INTEGER DEFAULT 1,
              file_path TEXT DEFAULT '#'
            );
          `);

          const countCheck = await this.query("SELECT COUNT(*) as count FROM nodes");
          if (!countCheck || countCheck.length === 0 || countCheck[0].count === 0) {
            this.db.run(`
              INSERT INTO nodes (id, parent_id, name, is_folder, file_path) VALUES
              (1, NULL, 'Physics', 1, '#'),
              (2, NULL, 'Chemistry', 1, '#'),
              (3, NULL, 'Mathematics', 1, '#'),
              (4, NULL, 'Biology', 1, '#'),
              (5, 1, 'Mechanics & Motion', 1, '#'),
              (6, 1, 'Thermodynamics', 1, '#'),
              (7, 1, 'Electromagnetism', 1, '#'),
              (8, 2, 'Organic Chemistry', 1, '#'),
              (9, 2, 'Inorganic Chemistry', 1, '#'),
              (10, 3, 'Calculus & Vectors', 1, '#'),
              (11, 3, 'Algebra & Matrices', 1, '#'),
              (12, 4, 'Genetics & Cell Biology', 1, '#');
            `);
          }
          await this.saveToIndexedDB();
        } catch (e) {
          console.error('[SQLite] Schema creation error:', e);
        }
      },

      async isValidDatabase() {
        if (!this.db) return false;
        try {
          const tableCheck = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'");
          if (tableCheck.length === 0) return false;
          const countCheck = await this.query("SELECT COUNT(*) as count FROM nodes");
          return countCheck.length > 0 && countCheck[0].count > 0;
        } catch (e) {
          return false;
        }
      },

      async query(sql, params = []) {
        if (this.isFallback || !this.db) return [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },

      async saveToIndexedDB() {
        if (this.isFallback || !this.db) return;
        let data = this.db.export();
        return new Promise((resolve, reject) => {
          const request = indexedDB.open('QuestionarySQLiteDB', 1);
          request.onupgradeneeded = e => e.target.result.createObjectStore('db_store');
          request.onsuccess = e => {
            const idb = e.target.result;
            const tx = idb.transaction('db_store', 'readwrite');
            const putReq = tx.objectStore('db_store').put(data, 'questionary.db');
            putReq.onsuccess = () => { data = null; resolve(); };
            putReq.onerror = () => { data = null; reject(putReq.error); };
          };
          request.onerror = () => { data = null; reject(request.error); };
        });
      },

      async loadFromIndexedDB() {
        return new Promise(resolve => {
          const request = indexedDB.open('QuestionarySQLiteDB', 1);
          request.onupgradeneeded = e => e.target.result.createObjectStore('db_store');
          request.onsuccess = e => {
            const idb = e.target.result;
            const tx = idb.transaction('db_store', 'readonly');
            const getReq = tx.objectStore('db_store').get('questionary.db');
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => resolve(null);
          };
          request.onerror = () => resolve(null);
        });
      },

      async clearIndexedDB() {
        return new Promise(resolve => {
          const req = indexedDB.deleteDatabase('QuestionarySQLiteDB');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      },

      async getNodeIdByPath(pathArray) {
        if (this.isFallback) return null;
        let currentId = null;
        for (const segment of pathArray) {
          const sql = currentId === null
          ? "SELECT id FROM nodes WHERE parent_id IS NULL AND name = ?"
          : "SELECT id FROM nodes WHERE parent_id = ? AND name = ?";
          const params = currentId === null ? [segment] : [currentId, segment];
          const res = await this.query(sql, params);
          if (res.length === 0) return null;
          currentId = res[0].id;
        }
        return currentId;
      },

      async getChildren(pathArray) {
        if (this.isFallback || !this.db) {
          return LocalNodeStore.getChildren(pathArray);
        }
        const parentId = await this.getNodeIdByPath(pathArray);
        if (parentId === null && pathArray.length > 0) {
          return LocalNodeStore.getChildren(pathArray);
        }
        const res = await this.query(
          parentId === null 
          ? "SELECT * FROM nodes WHERE parent_id IS NULL ORDER BY name ASC" 
          : "SELECT * FROM nodes WHERE parent_id = ? ORDER BY name ASC", 
          parentId === null ? [] : [parentId]
        );
        return (res && res.length > 0) ? res : LocalNodeStore.getChildren(pathArray);
      },

      async search(keyword) {
        if (this.isFallback || !this.db) {
          return LocalNodeStore.search(keyword);
        }
        const res = await this.query("SELECT * FROM nodes WHERE name LIKE ?", [`%${keyword}%`]);
        const results = [];
        for (const item of res) {
          const pathArray = await this.buildPath(item.parent_id);
          pathArray.push(item.name);
          results.push({
            name: item.name,
            path: pathArray,
            isFolder: item.is_folder === 1,
            url: item.file_path
          });
        }
        return results.length > 0 ? results : LocalNodeStore.search(keyword);
      },

      async buildPath(parentId) {
        const path = [];
        let currentId = parentId;
        while (currentId !== null) {
          const res = await this.query("SELECT parent_id, name FROM nodes WHERE id = ?", [currentId]);
          if (res.length === 0) break;
          path.unshift(res[0].name);
          currentId = res[0].parent_id;
        }
        return path;
      },

      async countDocuments() {
        if (this.isFallback || !this.db) {
          return LocalNodeStore.countDocuments();
        }
        const res = await this.query("SELECT COUNT(*) as count FROM nodes WHERE is_folder = 0 AND file_path != '#' AND file_path != ''");
        return res.length > 0 ? res[0].count : LocalNodeStore.countDocuments();
      }
    };

    // Global Reset Function for easy debugging / manual reset
    window.resetDatabase = async function() {
      if (confirm('Reset database cache? This will purge the cached DB and reload from questionary.db or let you select a new file.')) {
        await DbService.clearIndexedDB();
        location.reload();
      }
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
          } catch (e) {}
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

    var timerState = window.timerState || {
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

    function createRipple(event) {}

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
      bottom: calc(75px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      padding: 12px 22px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      background: ${bgColor};
      font-size: 0.9rem;
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

    // ============================================
    // STYLED DIALOG SYSTEM
    // ============================================
    function _createDialogOverlay() {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));
      return overlay;
    }

    function _closeDialog(overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    }

    function showConfirm(message, opts = {}) {
      const { title = 'Confirm', confirmText = 'OK', cancelText = 'Cancel', type = 'warning' } = opts;
      return new Promise(resolve => {
        const overlay = _createDialogOverlay();
        const iconMap = { warning: 'fa-exclamation-triangle', danger: 'fa-trash-alt', info: 'fa-info-circle', question: 'fa-question-circle' };
        const colorMap = { warning: 'var(--yellow, #f59e0b)', danger: 'var(--red, #ef4444)', info: 'var(--accent)', question: 'var(--accent)' };
        const icon = iconMap[type] || iconMap.question;
        const color = colorMap[type] || colorMap.question;

        overlay.innerHTML = `
        <div class="dialog-box">
        <div class="dialog-icon" style="color: ${color}"><i class="fas ${icon}"></i></div>
        <h3 class="dialog-title">${title}</h3>
        <p class="dialog-message">${message}</p>
        <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-cancel">${cancelText}</button>
        <button class="dialog-btn dialog-btn-confirm" style="background: ${type === 'danger' ? 'var(--red, #ef4444)' : 'var(--accent)'}">${confirmText}</button>
        </div>
        </div>
        `;

        const close = (val) => { _closeDialog(overlay); resolve(val); };
        overlay.querySelector('.dialog-btn-cancel').onclick = () => close(false);
        overlay.querySelector('.dialog-btn-confirm').onclick = () => close(true);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
        overlay.querySelector('.dialog-btn-confirm').focus();
      });
    }
    window.showConfirm = showConfirm;

    function showPrompt(message, opts = {}) {
      const { title = 'Input', defaultValue = '', placeholder = '', confirmText = 'Save', cancelText = 'Cancel' } = opts;
      return new Promise(resolve => {
        const overlay = _createDialogOverlay();

        overlay.innerHTML = `
        <div class="dialog-box">
        <div class="dialog-icon" style="color: var(--accent)"><i class="fas fa-pen"></i></div>
        <h3 class="dialog-title">${title}</h3>
        <p class="dialog-message">${message}</p>
        <input class="dialog-input" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" placeholder="${placeholder}" spellcheck="false" />
        <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-cancel">${cancelText}</button>
        <button class="dialog-btn dialog-btn-confirm">${confirmText}</button>
        </div>
        </div>
        `;

        const input = overlay.querySelector('.dialog-input');
        const close = (val) => { _closeDialog(overlay); resolve(val); };
        overlay.querySelector('.dialog-btn-cancel').onclick = () => close(null);
        overlay.querySelector('.dialog-btn-confirm').onclick = () => {
          const v = input.value.trim();
          close(v || null);
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { const v = input.value.trim(); close(v || null); }
          if (e.key === 'Escape') close(null);
        });
        overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
        requestAnimationFrame(() => { input.focus(); input.select(); });
      });
    }
    window.showPrompt = showPrompt;

    function showInfoDialog(message, opts = {}) {
      const { title = 'Info', buttonText = 'OK', type = 'info' } = opts;
      return new Promise(resolve => {
        const overlay = _createDialogOverlay();
        const iconMap = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        const colorMap = { info: 'var(--accent)', success: 'var(--green, #22c55e)', warning: 'var(--yellow, #f59e0b)', error: 'var(--red, #ef4444)' };

        overlay.innerHTML = `
        <div class="dialog-box">
        <div class="dialog-icon" style="color: ${colorMap[type] || colorMap.info}"><i class="fas ${iconMap[type] || iconMap.info}"></i></div>
        <h3 class="dialog-title">${title}</h3>
        <div class="dialog-message dialog-message-scrollable">${message}</div>
        <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-confirm">${buttonText}</button>
        </div>
        </div>
        `;

        const close = () => { _closeDialog(overlay); resolve(); };
        overlay.querySelector('.dialog-btn-confirm').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.dialog-btn-confirm').focus();
      });
    }
    window.showInfoDialog = showInfoDialog;

    async function initializeAppAfterLogin() {
      const usernameDisplay = document.getElementById('username-display');
      if (usernameDisplay && currentUser) {
        usernameDisplay.textContent = currentUser.username;
      }

      const adminBadge = document.getElementById('adminBadge');
      if (adminBadge && currentUser && currentUser.role === 'admin') {
        adminBadge.style.display = 'inline-block';
      }

      initSettingsDropdown();

      if (typeof initializeNewFeatures === 'function') {
        initializeNewFeatures();
      }

      const nodes = await DbService.getChildren(path);
      renderTilesFromDb(nodes);
      updateBreadcrumb();
      await updateDashboardStats();
    }

    function showAutoLoginNotification(username) {
      console.log('Auto-logging in as:', username);
      showNotification(`Welcome back, ${username}!`, 'success');
    }

    async function performSearch(e) {
      const query = typeof e === 'string' ? e : (e?.target?.value || '');
      const searchResults = document.getElementById('searchResults');

      if (!query || query.length < 2) {
        if (searchResults) searchResults.style.display = 'none';
        return;
      }

      if (typeof addToSearchHistory === 'function') addToSearchHistory(query);

      const results = [];
      const sqlResults = await DbService.search(query.toLowerCase());
      results.push(...sqlResults);

      if (notes && notes.length > 0) {
        notes.forEach(note => {
          if (note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase())) {
            results.push({ name: note.title, path: ['Notes'], isFolder: false, isNote: true, noteId: note.id, url: null });
          }
        });
      }

      if (flashcardDecks && flashcardDecks.length > 0) {
        flashcardDecks.forEach(deck => {
          if (deck.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({ name: deck.name, path: ['Flashcards'], isFolder: false, isFlashcard: true, deckId: deck.id, url: null });
          }
          deck.cards.forEach(card => {
            if (card.front.toLowerCase().includes(query.toLowerCase()) || card.back.toLowerCase().includes(query.toLowerCase())) {
              const alreadyAdded = results.some(r => r.deckId === deck.id);
              if (!alreadyAdded) {
                results.push({ name: `${deck.name} (card match)`, path: ['Flashcards'], isFolder: false, isFlashcard: true, deckId: deck.id, url: null });
              }
            }
          });
        });
      }

      if (studySessions && studySessions.length > 0) {
        studySessions.forEach(session => {
          if (session.subject.toLowerCase().includes(query.toLowerCase())) {
            results.push({ name: session.subject, path: ['Study Planner', session.date], isFolder: false, isSession: true, sessionId: session.id, url: null });
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
            if (r.isNote) onclickHandler = `navigateToNote('${r.noteId}')`;
            else if (r.isFlashcard) onclickHandler = `navigateToFlashcard('${r.deckId}')`;
            else if (r.isSession) onclickHandler = `navigateToSession('${r.sessionId}')`;
            else onclickHandler = `navigateToSearchResult(${JSON.stringify(r.path).replace(/"/g, '&quot;')}, '${r.url || ''}')`;

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

    async function navigateToSearchResult(pathArray, url) {
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
          if (typeof window.openAnyDocument === 'function') {
            window.openAnyDocument(url, title);
          } else {
            showPDF(url);
          }
        }, 100);
      } else {
        path = [...pathArray];
        await navigateToPath(path);
      }
    }

    function escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showConfirmModal(title, message, onConfirm, onCancel) {
      showConfirm(message, { title, type: 'danger', confirmText: 'Delete' }).then(res => {
        if (res && onConfirm) onConfirm();
        else if (!res && onCancel) onCancel();
      });
    }

    function setActiveNav(navId) {
      document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
      const activeNav = document.getElementById(navId);
      if (activeNav) activeNav.classList.add('active');
    }

    function loadDocuments() { console.log('loadDocuments called'); }
    function trackDailyAccess() {
      const today = new Date().toISOString().split('T')[0];
      const accessData = JSON.parse(localStorage.getItem('questionary-daily-access') || '{}');
      accessData[today] = (accessData[today] || 0) + 1;
      localStorage.setItem('questionary-daily-access', JSON.stringify(accessData));
    }

    function saveUserPreferences() {
      const settings = JSON.parse(localStorage.getItem('questionary-settings') || '{}');
      if (settings.rememberLocation !== false) {
        localStorage.setItem('questionary-last-view', currentView);
        localStorage.setItem('questionary-last-path', JSON.stringify(path));
      }
    }

    async function restoreLastLocation() {
      const settings = JSON.parse(localStorage.getItem('questionary-settings') || '{}');
      if (settings.rememberLocation !== false) {
        const lastView = localStorage.getItem('questionary-last-view');
        const lastPath = JSON.parse(localStorage.getItem('questionary-last-path') || '[]');

        if (lastView && lastView !== 'home') {
          showView(lastView);
          const navMap = {
            'home': 'homeNav', 'favorites': 'favoritesNav', 'recent': 'recentNav',
            'analytics': 'analyticsNav', 'planner': 'plannerNav', 'flashcards': 'flashcardsNav',
            'notes': 'notesNav', 'progress': 'progressNav', 'reminders': 'remindersNav',
            'settings': 'settingsNav', 'tags': 'tagsNav'
          };
          if (navMap[lastView]) setActiveNav(navMap[lastView]);
        } else {
          showView('home');
          setActiveNav('homeNav');
          if (lastPath && lastPath.length > 0) await navigateToPath(lastPath);
        }
      } else {
        showView('home');
        setActiveNav('homeNav');
      }
    }

    async function getCurrentDocumentsLevel() {
      return await DbService.getChildren(path);
    }

    function renderTilesFromDb(items) {
      const container = document.getElementById('tilesContainer');
      if (!container) return;

      const importedSection = document.getElementById('importedSection');
      if (importedSection) {
        importedSection.style.display = path.length === 0 ? 'block' : 'none';
      }
      if (path.length === 0) showHomeTagsPanels();
      else hideHomeTagsPanels();

      container.innerHTML = '';

      if (!items || items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No documents available.</p>';
        return;
      }

      const sortOrder = localStorage.getItem('questionary-sort-order') || 'asc';
      items.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

      items.forEach(item => {
        const key = item.name;
        const isFolder = item.is_folder === 1;
        const value = item.file_path;

        const tile = document.createElement('div');
        tile.className = 'tile';

        const isMissingPdf = !isFolder && (!value || value === '#' || value === '');
        const isImportedPdf = !isFolder && typeof value === 'string' && value.startsWith('blob-id:');
        const isCustomItem = false;

        const itemPath = [...path, key];
        const itemPathJson = JSON.stringify(itemPath).replace(/"/g, '&quot;');
        const itemId = isFolder ? `folder_${itemPath.join('/')}` : `doc_${itemPath.join('/')}`;

        tile.innerHTML = `
        <div class="tile-top-bar">
        <button onclick="event.stopPropagation(); openTagItemModal('${escapeHtml(itemId)}', '${escapeHtml(key)}', '${isFolder ? 'folder' : 'document'}')" title="Tags"><i class="fas fa-tag"></i></button>
        ${isFolder ? `<button onclick="event.stopPropagation(); addFolderToQuickLinks('${escapeHtml(key)}', ${itemPathJson})" title="Quick Link"><i class="fas fa-link"></i></button>` : ''}
        ${!isFolder && !isMissingPdf ? `<button onclick="event.stopPropagation(); toggleFavorite('${escapeHtml(key)}', ${itemPathJson}, '${escapeHtml(value)}')" title="Favorite"><i class="fas fa-star"></i></button>` : ''}
        ${isImportedPdf || (isFolder && isCustomItem) ? `<button onclick="event.stopPropagation(); moveDocumentItemToLibrary('${escapeHtml(key)}')" title="Move to Library"><i class="fas fa-book-open"></i></button>` : ''}
        </div>
        <div class="tile-icon">
        <i class="fas ${isFolder ? 'fa-folder' : (key.endsWith('.png') ? 'fa-image' : 'fa-file-pdf')}"></i>
        </div>
        <div class="tile-text">${escapeHtml(key)}</div>
        ${isMissingPdf ? `<div class="pdf-missing-badge"><i class="fas fa-exclamation-triangle"></i> Not Available</div>` : ''}
        `;

        if (isMissingPdf) tile.classList.add('pdf-missing');

        tile.onclick = async () => {
          if (isFolder) {
            path.push(key);
            await navigateToPath(path);
          } else if (isMissingPdf) {
            showNotification('This file is not available', 'warning');
          } else {
            addToRecent(key, [...path, key], value);
            if (typeof window.openAnyDocument === 'function') {
              window.openAnyDocument(value, key);
            } else if (key.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
              showImage(value, key);
            } else {
              showPDF(value);
            }
          }
        };

        container.appendChild(tile);
      });

      updateDashboardStats();
    }

    window.renderTiles = async function(ignoredDocs) {
      const nodes = await DbService.getChildren(path);
      renderTilesFromDb(nodes);
    };

    function updateBreadcrumb() {
      const breadcrumb = document.getElementById('breadcrumb');
      const backBtn = document.getElementById('backBtn');

      if (!breadcrumb) return;
      breadcrumb.innerHTML = '';

      const homeSpan = document.createElement('span');
      homeSpan.className = 'breadcrumb-item';
      homeSpan.textContent = 'Home';
      homeSpan.onclick = function() { navigateToPath([]); };
      breadcrumb.appendChild(homeSpan);

      let currentPath = [];
      path.forEach((segment) => {
        currentPath.push(segment);
        const pathCopy = [...currentPath];

        const separator = document.createElement('i');
        separator.className = 'fas fa-chevron-right';
        separator.style.cssText = 'font-size: 0.7rem; opacity: 0.5; margin: 0 0.5rem;';
        breadcrumb.appendChild(separator);

        const segmentSpan = document.createElement('span');
        segmentSpan.className = 'breadcrumb-item';
        segmentSpan.textContent = segment;
        segmentSpan.onclick = function() { navigateToPath(pathCopy); };
        breadcrumb.appendChild(segmentSpan);
      });

      if (backBtn) backBtn.style.display = path.length > 0 ? 'flex' : 'none';
    }

    async function navigateToPath(newPath) {
      if (!Array.isArray(newPath)) newPath = [];
      newPath = newPath.filter(segment => segment && segment.trim() !== '');

      const pdfViewer = document.getElementById('pdfViewer');
      if (pdfViewer) { pdfViewer.classList.remove('active'); pdfViewer.src = ''; }
      const pdfViewerContainer = document.getElementById('pdfViewerContainer');
      if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
      const bookmarksPanel = document.getElementById('pdfBookmarksPanel');
      if (bookmarksPanel) bookmarksPanel.style.display = 'none';

      const tilesContainer = document.getElementById('tilesContainer');
      const sectionHeader = document.querySelector('#tilesSection .section-header');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const tilesSection = document.getElementById('tilesSection');

      if (tilesSection) tilesSection.style.display = 'block';
      if (tilesContainer) {
        const isListView = tilesContainer.classList.contains('list-view');
        tilesContainer.style.display = isListView ? 'flex' : 'grid';
      }
      if (sectionHeader) sectionHeader.style.display = 'flex';
      if (dashboardHeader) dashboardHeader.style.display = newPath.length === 0 ? (window.innerWidth <= 768 ? 'grid' : 'flex') : 'none';

      if (typeof hideTimerCompletely === 'function') hideTimerCompletely();

      path = newPath;
      const nodes = await DbService.getChildren(path);
      renderTilesFromDb(nodes);
      updateBreadcrumb();
    }
    window.navigateToPath = navigateToPath;

    async function getCurrentLevel() {
      return await DbService.getChildren(path);
    }

    async function updateDashboardStats() {
      const totalDocs = await DbService.countDocuments();
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

    // ================================================================
    // FULL-SCREEN MAXIMIZED PDF & DOCUMENT VIEWERS
    // ================================================================
/* ================================================================
   RELIABLE PDF VIEWER CONTROLLERS (Supports Normal Papers + User Library)
   ================================================================ */
    function showPDF(url, customName = null) {
      if (!url || url === '' || url === '#') return;

      const pdfViewer = document.getElementById('pdfViewer');
      const pdfViewerContainer = document.getElementById('pdfViewerContainer');
      const tilesContainer = document.getElementById('tilesContainer');
      const sectionHeader = document.querySelector('#tilesSection .section-header');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const breadcrumbContainer = document.querySelector('.breadcrumb-container');
      const tilesSection = document.getElementById('tilesSection');

      document.body.classList.add('pdf-view-active');

      // Compute clean display title
      let filename = customName;
      if (!filename) {
        if (url.startsWith('blob:') || url.startsWith('data:')) {
          filename = 'Document';
        } else {
          filename = url.split('/').pop().replace('.pdf', '').replace(/%20/g, ' ');
        }
      }

      if (typeof window.setCurrentPDF === 'function') {
        window.setCurrentPDF(url, filename);
      }

      if (pdfViewer) {
        // Resolve absolute URL for local files or keep raw blob: URL
        const targetUrl = (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http'))
            ? url
            : new URL(url, window.location.href).href;

        const viewerUrl = 'pdfviewer.html?file=' + encodeURIComponent(targetUrl);

        pdfViewer.src = viewerUrl;
        pdfViewer.classList.add('active');

        pdfViewer.onload = function () {
          pdfViewer.contentWindow.postMessage({ type: 'loadPdf', url: targetUrl }, '*');
          pdfViewer.onload = null;
        };
      }

      if (tilesSection) tilesSection.style.display = 'block';
      if (tilesContainer) tilesContainer.style.display = 'none';
      if (sectionHeader) sectionHeader.style.display = 'none';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumbContainer) breadcrumbContainer.style.display = 'none';

      const importedSection = document.getElementById('importedSection');
      if (importedSection) importedSection.style.display = 'none';
      if (typeof hideHomeTagsPanels === 'function') hideHomeTagsPanels();

      if (pdfViewerContainer) {
        pdfViewerContainer.style.display = 'flex';
        const pdfNameEl = document.getElementById('currentPdfName');
        if (pdfNameEl) pdfNameEl.textContent = filename;

        if (typeof renderPdfBookmarks === 'function') renderPdfBookmarks(url);
        if (typeof window.setCurrentPdfForBookmarks === 'function') window.setCurrentPdfForBookmarks(url);
        else window.currentPdfUrlForBookmarks = url;
      }

      const timerPanel = document.getElementById('timerPanel');
      if (timerPanel) timerPanel.style.display = 'flex';
      if (typeof initializeTimer === 'function') initializeTimer();
      if (typeof trackPdfViewStart === 'function') trackPdfViewStart();
    }

    function closePDF() {
      const pdfViewer = document.getElementById('pdfViewer');
      const pdfViewerContainer = document.getElementById('pdfViewerContainer');
      const tilesContainer = document.getElementById('tilesContainer');
      const sectionHeader = document.querySelector('#tilesSection .section-header');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const breadcrumbContainer = document.querySelector('.breadcrumb-container');

      // Remove full-bleed width override
      document.body.classList.remove('pdf-view-active');

      if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
      if (pdfViewer) {
        pdfViewer.src = '';
        pdfViewer.classList.remove('active');
      }

      if (tilesContainer) {
        const isListView = tilesContainer.classList.contains('list-view');
        tilesContainer.style.display = isListView ? 'flex' : 'grid';
      }
      if (sectionHeader) sectionHeader.style.display = 'flex';
      if (dashboardHeader) dashboardHeader.style.display = 'flex';
      if (breadcrumbContainer) breadcrumbContainer.style.display = 'flex';

      window.currentPdfUrlForBookmarks = null;
    }

    window.showPDF = showPDF;
    window.closePDF = closePDF;

    /* --- Image Viewer --- */
    var _currentImageBlobUrl = window._currentImageBlobUrl || null;
    var _currentImageName = window._currentImageName || '';
    function showImage(url, name) {
      if (!url) return;
      _currentImageName = name || 'Image';
      if (typeof url === 'string' && url.startsWith('blob-id:')) {
        const blobId = url.replace('blob-id:', '');
        if (typeof getPdfBlob === 'function') {
          getPdfBlob(blobId).then(blob => {
            if (blob) {
              _currentImageBlobUrl = URL.createObjectURL(blob);
              _displayImageViewer(_currentImageBlobUrl, name);
            }
          });
        }
        return;
      }
      _currentImageBlobUrl = url;
      _displayImageViewer(url, name);
    }
    function _displayImageViewer(imgSrc, name) {
      const container = document.getElementById('imageViewerContainer');
      const img = document.getElementById('imageViewerImg');
      const nameEl = document.getElementById('currentImageName');
      const tilesContainer = document.getElementById('tilesContainer');
      const sectionHeader = document.querySelector('#tilesSection .section-header');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const breadcrumbContainer = document.querySelector('.breadcrumb-container');
      if (img) img.src = imgSrc;
      if (nameEl) nameEl.textContent = name || 'Image';
      if (container) container.style.display = 'block';
      if (tilesContainer) tilesContainer.style.display = 'none';
      if (sectionHeader) sectionHeader.style.display = 'none';
      if (dashboardHeader) dashboardHeader.style.display = 'none';
      if (breadcrumbContainer) breadcrumbContainer.style.display = 'none';
      updateBreadcrumb();
    }
    function closeImageViewer() {
      const container = document.getElementById('imageViewerContainer');
      const img = document.getElementById('imageViewerImg');
      const tilesContainer = document.getElementById('tilesContainer');
      const sectionHeader = document.querySelector('#tilesSection .section-header');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const breadcrumbContainer = document.querySelector('.breadcrumb-container');
      if (container) container.style.display = 'none';
      if (img) img.src = '';
      if (_currentImageBlobUrl && _currentImageBlobUrl.startsWith('blob:')) URL.revokeObjectURL(_currentImageBlobUrl);
      _currentImageBlobUrl = null;
      if (breadcrumbContainer) breadcrumbContainer.style.display = 'flex';
      if (tilesContainer) {
        const isListView = tilesContainer.classList.contains('list-view');
        tilesContainer.style.display = isListView ? 'flex' : 'grid';
      }
      if (sectionHeader) sectionHeader.style.display = 'flex';
      if (dashboardHeader && path.length === 0) dashboardHeader.style.display = window.innerWidth <= 768 ? 'grid' : 'flex';
    }
    function downloadCurrentImage() {
      if (!_currentImageBlobUrl) return;
      const a = document.createElement('a');
      a.href = _currentImageBlobUrl;
      a.download = _currentImageName || 'whiteboard.png';
      a.click();
    }

    window.showImage = showImage;
    window.closeImageViewer = closeImageViewer;
    window.downloadCurrentImage = downloadCurrentImage;
    window.showPDF = showPDF;
    window.closePDF = closePDF;

    function renderAnalytics() {
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
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No study sessions scheduled.</p>';
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

    function renderNotes() {
      const container = document.getElementById('notesGrid');
      if (!container) return;
      if (notes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No notes yet.</p>';
        return;
      }
      container.innerHTML = notes.map(note => `
      <div class="note-card" onclick="editNote('${note.id}')">
      <h4>${escapeHtml(note.title)}</h4>
      <p>${escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</p>
      <small>${new Date(note.updatedAt).toLocaleDateString()}</small>
      <div class="note-actions">
      <button class="btn-icon tag" onclick="event.stopPropagation(); openTagItemModal('note_${note.id}', '${escapeHtml(note.title)}', 'note')" title="Add Tags">
      <i class="fas fa-tag"></i>
      </button>
      <button class="btn-icon delete" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete note">
      <i class="fas fa-trash"></i>
      </button>
      </div>
      </div>
      `).join('');
    }

    function updateProgressDisplay() {}

    function renderQuickLinks() {
      const container = document.getElementById('quickLinksList');
      if (!container) return;
      quickLinks = quickLinks.filter(ql => ql && ql.pathArray && Array.isArray(ql.pathArray));

      if (quickLinks.length === 0) {
        container.innerHTML = `
        <div class="quick-links-empty">
        <i class="fas fa-link"></i>
        <p>No quick links yet</p>
        <span>Navigate to a folder or file and click "Add Current Location"</span>
        </div>
        `;
        return;
      }

      container.innerHTML = quickLinks.map(ql => {
        const isFile = ql.isFile || false;
        const icon = isFile ? 'fa-file-pdf' : 'fa-folder';
        const iconColor = isFile ? 'style="color: #ef4444;"' : '';
        return `
        <div class="quick-link-item" data-id="${ql.id}" data-path="${ql.pathArray.join('|')}" data-is-file="${isFile}" data-url="${ql.url || ''}">
        <i class="fas ${icon}" ${iconColor}></i>
        <span class="quick-link-name">${ql.name || ql.pathArray[ql.pathArray.length - 1] || 'Unknown'}</span>
        <button class="quick-link-delete" title="Remove" onclick="event.stopPropagation(); removeQuickLink('${ql.id}')">
        <i class="fas fa-times"></i>
        </button>
        </div>
        `;
      }).join('');

      container.querySelectorAll('.quick-link-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          if (e.target.closest('.quick-link-delete')) return;
          const pathStr = item.dataset.path;
          const pathArray = pathStr.split('|');
          const isFile = item.dataset.isFile === 'true';
          const url = item.dataset.url;

          if (isFile && url) {
            const parentPath = pathArray.slice(0, -1);
            await navigateToPath(parentPath);
            setTimeout(() => showPDF(url), 100);
          } else {
            await navigateToPath(pathArray);
          }
          document.getElementById('quickLinksPanel')?.classList.remove('active');
        });
      });
    }

    var currentOpenPDF = window.currentOpenPDF || null;
    window.setCurrentPDF = function(url, name) { currentOpenPDF = { url, name }; };
    window.clearCurrentPDF = function() { currentOpenPDF = null; };

    function removeQuickLink(id) {
      quickLinks = quickLinks.filter(ql => ql.id !== id);
      saveQuickLinks();
      renderQuickLinks();
      if (typeof showNotification === 'function') showNotification('Quick link removed', 'info');
    }

    function saveQuickLinks() { localStorage.setItem('questionary-quick-links', JSON.stringify(quickLinks)); }
    function loadQuickLinks() { quickLinks = JSON.parse(localStorage.getItem('questionary-quick-links') || '[]'); }

    function addFolderToQuickLinks(folderName, folderPath) {
      const pathStr = folderPath.join('|');
      if (quickLinks.some(ql => ql.pathArray.join('|') === pathStr)) {
        showNotification('This folder is already in quick links', 'info');
        return;
      }
      quickLinks.push({ id: Date.now().toString(), name: folderName, pathArray: [...folderPath], isFile: false });
      saveQuickLinks();
      renderQuickLinks();
      showNotification(`Folder "${folderName}" added to quick links!`, 'success');
    }
    window.addFolderToQuickLinks = addFolderToQuickLinks;

    function addCurrentFolderToQuickLinks() {
      if (path.length === 0) {
        showNotification('Navigate to a folder first to add it as a quick link', 'info');
        return;
      }
      const pathStr = path.join('|');
      if (quickLinks.some(ql => ql.pathArray.join('|') === pathStr)) {
        showNotification('This folder is already in quick links', 'info');
        return;
      }
      const folderName = path[path.length - 1];
      quickLinks.push({ id: Date.now().toString(), name: folderName, pathArray: [...path], isFile: false });
      saveQuickLinks();
      renderQuickLinks();
      showNotification(`Folder "${folderName}" added to quick links!`, 'success');
    }

    function addCurrentPdfToQuickLinks() {
      if (!currentOpenPDF) return;
      const pathStr = [...path, currentOpenPDF.name].join('|');
      if (quickLinks.some(ql => ql.pathArray.join('|') === pathStr)) {
        showNotification('This file is already in quick links', 'info');
        return;
      }
      quickLinks.push({ id: Date.now().toString(), name: currentOpenPDF.name, pathArray: [...path, currentOpenPDF.name], isFile: true, url: currentOpenPDF.url });
      saveQuickLinks();
      renderQuickLinks();
      showNotification('PDF added to quick links!', 'success');
    }

    function showQuickLinkChoiceDialog() {
      const existing = document.getElementById('quickLinkChoiceDialog');
      if (existing) existing.remove();

      const folderName = path.length > 0 ? path[path.length - 1] : 'Home';
      const pdfName = currentOpenPDF ? currentOpenPDF.name : '';

      const dialog = document.createElement('div');
      dialog.id = 'quickLinkChoiceDialog';
      dialog.className = 'quicklink-choice-dialog-overlay';
      dialog.innerHTML = `
      <div class="quicklink-choice-dialog">
      <h3><i class="fas fa-link"></i> Add Quick Link</h3>
      <p>What would you like to add?</p>
      <div class="quicklink-choice-options">
      <button class="quicklink-choice-btn" id="addPdfQuickLink">
      <i class="fas fa-file-pdf"></i>
      <span>Current PDF</span>
      <small>${pdfName}</small>
      </button>
      ${path.length > 0 ? `
        <button class="quicklink-choice-btn" id="addFolderQuickLink">
        <i class="fas fa-folder"></i>
        <span>Current Folder</span>
        <small>${folderName}</small>
        </button>
        ` : ''}
        </div>
        <button class="quicklink-choice-cancel" id="cancelQuickLinkChoice">Cancel</button>
        </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('addPdfQuickLink').onclick = () => { addCurrentPdfToQuickLinks(); dialog.remove(); };
        const folderBtn = document.getElementById('addFolderQuickLink');
        if (folderBtn) folderBtn.onclick = () => { addCurrentFolderToQuickLinks(); dialog.remove(); };
        document.getElementById('cancelQuickLinkChoice').onclick = () => dialog.remove();
        dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
    }

    function trackStudyTime(minutes) {
      studyStats.totalTime = (studyStats.totalTime || 0) + minutes;
      localStorage.setItem('questionary-study-stats', JSON.stringify(studyStats));
    }

    function updateDocProgress(docPath, progress) {
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
        days.push({ date: dateStr, day: dayName, count: accessData[dateStr] || 0 });
      }
      const maxCount = Math.max(...days.map(d => d.count), 5);
      container.innerHTML = `
      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 140px; gap: 8px; padding: 10px 0;">
      ${days.map(d => `
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
        <div style="width: 100%; max-width: 40px; height: ${Math.max((d.count / maxCount) * 100, 8)}px; background: ${d.count > 0 ? 'var(--primary-color)' : 'var(--border)'}; border-radius: 4px 4px 0 0; transition: height 0.3s ease;" title="${d.count} sessions"></div>
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
      const subjects = Object.entries(subjectAccess).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (subjects.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);"><p>No subject data yet. Browse some documents!</p></div>';
        return;
      }
      const maxCount = subjects[0][1];
      const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b'];
      container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px;">${subjects.map(([name, count], i) => `
        <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${escapeHtml(name)}</span>
        <span style="font-size: 0.8rem; color: var(--text-secondary);">${count} views</span>
        </div>
        <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
        <div style="width: ${(count / maxCount) * 100}%; height: 100%; background: ${colors[i % colors.length]}; border-radius: 4px;"></div>
        </div>
        </div>
        `).join('')}</div>`;
    }

    function renderRecentActivity(recent) {
      const container = document.getElementById('recentActivityList');
      if (!container) return;
      const recentItems = recent.slice(0, 10);
      if (recentItems.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);"><p>No recent activity yet.</p></div>';
        return;
      }
      container.innerHTML = recentItems.map(item => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; background: var(--surface-hover); margin-bottom: 8px;">
      <i class="fas fa-file-pdf" style="color: var(--primary-color); font-size: 1.1rem;"></i>
      <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.title)}</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary);">${getTimeAgo(item.timestamp)}</div>
      </div>
      </div>
      `).join('');
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
      setTimeout(() => { if (typeof editNote === 'function') editNote(noteId); }, 100);
    }

    function navigateToFlashcard(deckId) {
      const searchResults = document.getElementById('searchResults');
      if (searchResults) searchResults.style.display = 'none';
      document.getElementById('globalSearch').value = '';
      showView('flashcards');
      setActiveNav('flashcardsNav');
      setTimeout(() => { if (typeof startStudyDeck === 'function') startStudyDeck(deckId); }, 100);
    }

    function navigateToSession(sessionId) {
      const searchResults = document.getElementById('searchResults');
      if (searchResults) searchResults.style.display = 'none';
      document.getElementById('globalSearch').value = '';
      showView('planner');
      setActiveNav('studyPlannerNav');
      setTimeout(() => {
        const session = studySessions.find(s => s.id === sessionId);
        if (session) showNotification(`Session: ${session.subject} on ${session.date} at ${session.time}`, 'info');
      }, 100);
    }

    window.navigateToNote = navigateToNote;
    window.navigateToFlashcard = navigateToFlashcard;
    window.navigateToSession = navigateToSession;

    // ================================================================
    // NOTES SYSTEM
    // ================================================================
    function loadNotes() { notes = JSON.parse(localStorage.getItem('questionary-notes') || '[]'); }
    function saveNotes() { localStorage.setItem('questionary-notes', JSON.stringify(notes)); }

    function openNoteModal(noteId = null) {
      const modal = document.getElementById('noteModal');
      const titleInput = document.getElementById('noteTitle');
      const contentInput = document.getElementById('noteContent');
      const modalTitle = document.getElementById('noteModalTitle');
      if (!modal) return;
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
      const title = document.getElementById('noteTitle')?.value.trim();
      const content = document.getElementById('noteContent')?.value.trim();
      const modal = document.getElementById('noteModal');
      if (!title) { showNotification('Please enter a title', 'error'); return; }

      if (currentEditingNote) {
        currentEditingNote.title = title;
        currentEditingNote.content = content;
        currentEditingNote.updatedAt = Date.now();
      } else {
        notes.push({ id: Date.now().toString(), title, content, createdAt: Date.now(), updatedAt: Date.now() });
      }
      saveNotes();
      renderNotes();
      modal?.classList.remove('active');
      showNotification(currentEditingNote ? 'Note updated!' : 'Note created!', 'success');
      currentEditingNote = null;
    }

    function editNote(noteId) { openNoteModal(noteId); }

    function deleteNote(noteId) {
      const note = notes.find(n => n.id === noteId);
      showConfirmModal('Delete Note', `Are you sure you want to delete "${note ? note.title : ''}"?`, () => {
        notes = notes.filter(n => n.id !== noteId);
        saveNotes();
        renderNotes();
        showNotification('Note deleted', 'info');
      });
    }

    // ================================================================
    // FLASHCARD ENGINE — BULLETPROOF SYNC & SAFE DELETION
    // ================================================================
    function loadFlashcardDecks() {
      try {
        const raw = localStorage.getItem('questionary-flashcards');
        flashcardDecks = raw ? JSON.parse(raw) : [];
        
        let needsSave = false;
        flashcardDecks.forEach((deck, idx) => {
          if (!deck.id) {
            deck.id = 'deck_' + Date.now() + '_' + idx;
            needsSave = true;
          }
          if (!Array.isArray(deck.cards)) {
            deck.cards = [];
            needsSave = true;
          }
        });
        
        if (needsSave) saveFlashcardDecks();
      } catch (e) {
        console.error('Error parsing flashcards:', e);
        flashcardDecks = [];
      }
      return flashcardDecks;
    }

    function saveFlashcardDecks() {
      localStorage.setItem('questionary-flashcards', JSON.stringify(flashcardDecks));
      window.flashcardDecks = flashcardDecks;
    }

    function renderFlashcardDecks() {
      loadFlashcardDecks();
      const container = document.getElementById('flashcardsGrid');
      if (!container) return;

      if (flashcardDecks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No flashcard decks yet. Click "New Deck" to create one!</p>';
        return;
      }

      container.innerHTML = flashcardDecks.map(deck => `
        <div class="deck-card" data-deck-id="${deck.id}">
          <div class="deck-card-header">
            <h4 class="deck-card-title">${escapeHtml(deck.name)}</h4>
            <div class="deck-card-actions">
              <button class="btn-icon tag" onclick="event.stopPropagation(); openTagItemModal('deck_${deck.id}', '${escapeHtml(deck.name)}', 'flashcard')" title="Add Tags">
                <i class="fas fa-tag"></i>
              </button>
              <button class="btn-icon delete" onclick="event.stopPropagation(); deleteDeck('${deck.id}')" title="Delete deck">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p style="font-size: 0.82rem; color: var(--fg3); margin: 6px 0 12px 0;">${deck.cards.length} ${deck.cards.length === 1 ? 'card' : 'cards'}</p>
          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            <button type="button" class="btn btn-primary btn-sm" onclick="startStudyDeck('${deck.id}')" style="flex: 1;">
              <i class="fas fa-play"></i> Study
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="startQuiz('${deck.id}')" style="flex: 1;">
              <i class="fas fa-question-circle"></i> Quiz
            </button>
          </div>
        </div>
      `).join('');
    }

    function openFlashcardModal(deckId = null) {
      const modal = document.getElementById('flashcardModal');
      const nameInput = document.getElementById('deckName');
      const cardsContainer = document.getElementById('cardsContainer');
      const modalTitle = document.getElementById('flashcardModalTitle');
      if (!modal) return;
      if (deckId) {
        const deck = flashcardDecks.find(d => String(d.id) === String(deckId));
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
      if (!name) { showNotification('Please enter a deck name', 'error'); return; }

      const cards = [];
      document.querySelectorAll('.card-editor').forEach(editor => {
        const front = editor.querySelector('.card-front')?.value.trim();
        const back = editor.querySelector('.card-back')?.value.trim();
        if (front && back) cards.push({ front, back });
      });

      if (cards.length === 0) { showNotification('Please add at least one valid card', 'error'); return; }

      if (currentEditingDeck) {
        currentEditingDeck.name = name;
        currentEditingDeck.cards = cards;
      } else {
        flashcardDecks.push({ id: 'deck_' + Date.now(), name, cards });
      }
      saveFlashcardDecks();
      renderFlashcardDecks();
      modal?.classList.remove('active');
      showNotification(currentEditingDeck ? 'Deck updated!' : 'Deck created!', 'success');
      currentEditingDeck = null;
    }

    function deleteDeck(deckId) {
      loadFlashcardDecks();
      const targetId = String(deckId);
      const deck = flashcardDecks.find(d => String(d.id) === targetId);

      if (!deck) {
        showNotification('Deck not found', 'warning');
        return;
      }

      showConfirm(`Are you sure you want to delete the deck "${deck.name}"?`, {
        title: 'Delete Deck',
        type: 'danger',
        confirmText: 'Delete'
      }).then(confirmed => {
        if (confirmed) {
          flashcardDecks = flashcardDecks.filter(d => String(d.id) !== targetId);
          saveFlashcardDecks();
          renderFlashcardDecks();
          showNotification('Deck deleted', 'info');
        }
      });
    }

    function startStudyDeck(deckId) {
      loadFlashcardDecks();
      const targetId = String(deckId);
      const deck = flashcardDecks.find(d => String(d.id) === targetId);

      if (!deck || !deck.cards || deck.cards.length === 0) {
        showNotification('This deck has no cards yet! Edit it to add some cards.', 'warning');
        return;
      }

      currentStudyDeck = deck;
      currentCardIndex = 0;

      const modal = document.getElementById('studyModal');
      if (modal) {
        modal.classList.add('active');
        showCurrentCard();
      }
    }

    function showCurrentCard() {
      if (!currentStudyDeck || !currentStudyDeck.cards || currentStudyDeck.cards.length === 0) return;
      
      const card = currentStudyDeck.cards[currentCardIndex];
      if (!card) return;

      const activeCard = document.getElementById('activeFlashcard');
      const cardFront = document.getElementById('cardFront');
      const cardBack = document.getElementById('cardBack');
      const cardProgress = document.getElementById('cardProgress');

      if (activeCard) activeCard.classList.remove('flipped');
      if (cardFront) cardFront.textContent = card.front || 'Empty Question';
      if (cardBack) cardBack.textContent = card.back || 'Empty Answer';
      if (cardProgress) cardProgress.textContent = `${currentCardIndex + 1} / ${currentStudyDeck.cards.length}`;
    }

    function flipCard() {
      const card = document.getElementById('activeFlashcard');
      if (card) card.classList.toggle('flipped');
    }

    function nextCard() {
      if (currentStudyDeck && currentStudyDeck.cards.length > 0) {
        currentCardIndex = (currentCardIndex + 1) % currentStudyDeck.cards.length;
        showCurrentCard();
      }
    }

    function prevCard() {
      if (currentStudyDeck && currentStudyDeck.cards.length > 0) {
        currentCardIndex = (currentCardIndex - 1 + currentStudyDeck.cards.length) % currentStudyDeck.cards.length;
        showCurrentCard();
      }
    }

    function closeStudyModal() {
      const modal = document.getElementById('studyModal');
      if (modal) modal.classList.remove('active');
      const activeCard = document.getElementById('activeFlashcard');
      if (activeCard) activeCard.classList.remove('flipped');
      currentStudyDeck = null;
      currentCardIndex = 0;
    }

    // ================================================================
    // STUDY SESSIONS SYSTEM
    // ================================================================
    function loadStudySessions() { studySessions = JSON.parse(localStorage.getItem('questionary-sessions') || '[]'); }
    function saveStudySessions() { localStorage.setItem('questionary-sessions', JSON.stringify(studySessions)); }

    function openSessionModal() {
      const modal = document.getElementById('sessionModal');
      if (!modal) return;
      document.getElementById('sessionSubject').value = '';
      document.getElementById('sessionDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('sessionTime').value = '09:00';
      modal.classList.add('active');
    }

    function saveSession() {
      const subject = document.getElementById('sessionSubject')?.value.trim();
      const date = document.getElementById('sessionDate')?.value;
      const time = document.getElementById('sessionTime')?.value;
      if (!subject || !date) { showNotification('Subject and date are required', 'error'); return; }

      const session = { id: Date.now().toString(), subject, date, time: time || '09:00' };
      studySessions.push(session);
      scheduleSessionNotification(session);
      saveStudySessions();
      renderCalendar();
      renderSessions();
      document.getElementById('sessionModal')?.classList.remove('active');
      showNotification('Session added!', 'success');
    }

    function scheduleSessionNotification(session) {
      const sessionDateTime = new Date(`${session.date}T${session.time}`);
      const now = new Date();
      if (sessionDateTime > now) {
        setTimeout(() => {
          if (typeof window.playAlarmSound === 'function') window.playAlarmSound();
          showNotification(`📚 Time for: ${session.subject}`, 'info');
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Questionary - Study Session', { body: `Time for: ${session.subject}`, icon: 'assets/logo.png' });
          }
        }, sessionDateTime - now);
      }
    }

    function deleteSession(sessionId) {
      showConfirmModal('Delete Session', 'Are you sure?', () => {
        studySessions = studySessions.filter(s => s.id !== sessionId);
        saveStudySessions();
        renderCalendar();
        renderSessions();
        showNotification('Session deleted', 'info');
      });
    }

    function showDaySessions(dateStr) {
      const sessionsOnDay = studySessions.filter(s => s.date === dateStr);
      if (sessionsOnDay.length === 0) showNotification(`No sessions on ${dateStr}`, 'info');
      else showInfoDialog(sessionsOnDay.map(s => `• ${s.subject} at ${s.time}`).join('\n'), { title: `Sessions on ${dateStr}`, type: 'info' });
    }

    function loadStudyStats() { studyStats = JSON.parse(localStorage.getItem('questionary-study-stats') || '{"totalTime":0,"streak":0,"lastStudyDate":null,"hourlyActivity":{}}'); }
    function loadDocumentProgress() { documentProgress = JSON.parse(localStorage.getItem('questionary-doc-progress') || '{}'); }

    // Export to global scope
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
    window.closeStudyModal = closeStudyModal;
    window.openSessionModal = openSessionModal;
    window.saveSession = saveSession;
    window.deleteSession = deleteSession;
    window.showDaySessions = showDaySessions;

    // ================================================================
    // MOBILE BOTTOM NAVIGATION & DRAWER
    // ================================================================
    function initializeMobileBottomNav() {
      const bottomNav = document.getElementById('mobileBottomNav');
      if (!bottomNav) return;

      bottomNav.addEventListener('click', (e) => {
        const item = e.target.closest('.mobile-bottom-nav-item');
        if (!item) return;

        const view = item.dataset.view;
        if (view === 'more') {
          const navLinks = document.getElementById('navLinks');
          const sidebarOverlay = document.getElementById('sidebarOverlay');
          if (navLinks) {
            const isOpen = navLinks.classList.toggle('sidebar-open');
            sidebarOverlay?.classList.toggle('active', isOpen);
          }
        } else {
          closeSidebar();
          showView(view);
          const navMap = {
            'home': 'homeNav',
            'favorites': 'favoritesNav',
            'recent': 'recentNav',
            'planner': 'studyPlannerNav'
          };
          if (navMap[view]) setActiveNav(navMap[view]);
        }
        updateMobileBottomNavActive(view);
      });
    }

    function updateMobileBottomNavActive(viewName) {
      document.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
        if (item.dataset.view === viewName) {
          item.classList.add('active');
        } else if (viewName !== 'more') {
          item.classList.remove('active');
        }
      });
    }

    function closeSidebar() {
      document.getElementById('navLinks')?.classList.remove('sidebar-open');
      document.getElementById('sidebarOverlay')?.classList.remove('active');
    }

    function initHamburgerMenu() {
      const hamburgerBtn = document.getElementById('hamburgerMenu');
      const mobileMenuToggle = document.getElementById('mobileMenuToggle');
      const navLinks = document.getElementById('navLinks');
      const sidebarOverlay = document.getElementById('sidebarOverlay');
      const sidebarClose = document.getElementById('sidebarClose');

      if (!navLinks) return;

      closeSidebar();

      const toggleSidebar = (e) => {
        if (e) e.stopPropagation();
        const isOpen = navLinks.classList.toggle('sidebar-open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
      };

      if (hamburgerBtn) hamburgerBtn.onclick = toggleSidebar;
      if (mobileMenuToggle) mobileMenuToggle.onclick = toggleSidebar;
      if (sidebarClose) sidebarClose.onclick = closeSidebar;
      if (sidebarOverlay) sidebarOverlay.onclick = closeSidebar;

      navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          closeSidebar();
        });
      });
    }

    async function initializeApp() {
      console.log('[App] Starting initialization...');
      preventAccidentalSelection();

      const overlayTimeout = setTimeout(() => {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay && loadingOverlay.classList.contains('active')) {
          console.warn('[App] Fail-safe timer triggered: Force removing stuck loading overlay.');
          loadingOverlay.classList.remove('active');
          checkSavedLogin();
        }
      }, 1500);

      if (window.__TAURI__ && window.__TAURI__.window) {
        try {
          const currentWindow = window.__TAURI__.window.getCurrentWindow();
          await currentWindow.show();
          await currentWindow.setFocus();
          console.log('[App] Window shown');
        } catch (e) {
          console.log('Could not show window:', e);
        }
      }

      await initializeFavorites();
      await DbService.init();

      initializeMobileBottomNav();
      applyAccessibilitySettings();

      if (typeof initializeNewFeatures === 'function') {
        initializeNewFeatures();
      }

      const themeToggle = document.getElementById('themeToggle');
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
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
          const newTheme = currentTheme === 'light' ? 'dark' : 'light';
          if (typeof window.setTheme === 'function') {
            window.setTheme(newTheme);
          } else {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
          }
        });
      }

      const accessibilityToggle = document.getElementById('accessibilityToggle');
      const accessibilityPanel = document.getElementById('accessibilityPanel');
      if (accessibilityToggle && accessibilityPanel) {
        accessibilityToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          accessibilityPanel.classList.toggle('active');
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

      clearTimeout(overlayTimeout);
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

      setTimeout(() => {
        restoreLastLocation();
      }, 100);

      if (window.contentUpdateSystem && typeof window.contentUpdateSystem.init === 'function') {
        window.contentUpdateSystem.init();
      }

      window.addEventListener('beforeunload', () => {
        saveUserPreferences();
      });
      setInterval(saveUserPreferences, 30000);
      window.addEventListener('error', e => {
        console.error('Application error:', e.error);
      });

      window.renderTiles = renderTiles;
      window.getCurrentDocumentsLevel = getCurrentDocumentsLevel;

      if (typeof window.loadCustomDocuments === 'function') {
        window.loadCustomDocuments();
      }

      const nodes = await DbService.getChildren(path);
      renderTilesFromDb(nodes);

      console.log('Questionary application initialized successfully');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }

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
      const loadingOverlay = document.getElementById('loadingOverlay');

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

      if (loadingOverlay) loadingOverlay.classList.remove('active');
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
      const remindersNav = document.getElementById('remindersNav');
      const settingsNav = document.getElementById('settingsNav');
      const backBtn = document.getElementById('backBtn');

      if (backBtn) backBtn.addEventListener('click', handleBackButton);

      const closeMenuOnClick = () => {
        closeSidebar();
      };

      homeNav && homeNav.addEventListener('click', async () => {
        showView('home');
        path = [];
        await navigateToPath([]);
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
        if (typeof renderVoiceNotesGrid === 'function') renderVoiceNotesGrid();
      });

      const tagsNav = document.getElementById('tagsNav');
      tagsNav && tagsNav.addEventListener('click', () => {
        showView('tags');
        setActiveNav('tagsNav');
        closeMenuOnClick();
        if (typeof renderTagsMain === 'function') renderTagsMain();
        if (typeof renderTaggedItems === 'function') renderTaggedItems();
      });

      progressNav && progressNav.addEventListener('click', () => {
        showView('progress');
        setActiveNav('progressNav');
        closeMenuOnClick();
      });

      remindersNav && remindersNav.addEventListener('click', () => {
        showView('reminders');
        setActiveNav('remindersNav');
        closeMenuOnClick();
      });

      const studyRoomNav = document.getElementById('studyRoomNav');
      studyRoomNav && studyRoomNav.addEventListener('click', () => {
        showView('studyRoom');
        setActiveNav('studyRoomNav');
        closeMenuOnClick();
      });

      settingsNav && settingsNav.addEventListener('click', () => {
        showView('settings');
        setActiveNav('settingsNav');
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
      if (!toggle) return;
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
        if (toggle && accessibilitySettings[key]) toggle.classList.add('active');
      });
    }

    function initializeKeyboardNavigation() {
      document.addEventListener('keydown', async (e) => {
        const isInputFocused = e.target.closest('input, textarea, [contenteditable]');

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

          const pdfViewerContainer = document.getElementById('pdfViewerContainer');
          if (pdfViewerContainer && pdfViewerContainer.style.display !== 'none') {
            closePDF();
            return;
          }

          if (path.length > 0) {
            await handleBackButton();
            return;
          }

          if (currentView !== 'home') {
            showView('home');
            path = [];
            await navigateToPath([]);
            setActiveNav('homeNav');
            return;
          }
        }

        if (!isInputFocused && keybindMatches(e, 'focusSearch')) {
          e.preventDefault();
          document.getElementById('globalSearch')?.focus();
        }

        if (!isInputFocused && keybindMatches(e, 'goBack') && path.length > 0) {
          await handleBackButton();
        }

        if (!isInputFocused && keybindMatches(e, 'navBack')) {
          e.preventDefault();
          const pdfViewerContainer = document.getElementById('pdfViewerContainer');
          if (pdfViewerContainer && pdfViewerContainer.style.display !== 'none') {
            closePDF();
          } else if (path.length > 0) {
            await handleBackButton();
          } else if (currentView !== 'home') {
            showView('home');
            path = [];
            await navigateToPath([]);
            setActiveNav('homeNav');
          }
        }

        if (!isInputFocused && keybindMatches(e, 'goHome')) {
          e.preventDefault();
          const pdfViewerContainer = document.getElementById('pdfViewerContainer');
          if (pdfViewerContainer) {
            pdfViewerContainer.style.display = 'none';
            const pdfViewer = document.getElementById('pdfViewer');
            if (pdfViewer) { pdfViewer.classList.remove('active'); pdfViewer.src = ''; }
          }
          hideTimerCompletely();
          showView('home');
          path = [];
          await navigateToPath([]);
          setActiveNav('homeNav');
        }
      });
    }

    function showHomeTagsPanels() {
      const homeTagsSection = document.getElementById('homeTagsSection');
      const homeTaggedItemsSection = document.getElementById('homeTaggedItemsSection');
      if (homeTagsSection) {
        homeTagsSection.style.display = 'block';
        renderHomeTagsList();
      }
      if (homeTaggedItemsSection) {
        homeTaggedItemsSection.style.display = 'block';
        renderHomeTaggedItemsList();
      }
    }

    function hideHomeTagsPanels() {
      const homeTagsSection = document.getElementById('homeTagsSection');
      const homeTaggedItemsSection = document.getElementById('homeTaggedItemsSection');
      if (homeTagsSection) homeTagsSection.style.display = 'none';
      if (homeTaggedItemsSection) homeTaggedItemsSection.style.display = 'none';
    }

    function renderHomeTagsList() {
      const container = document.getElementById('homeTagsList');
      if (!container) return;
      const tags = JSON.parse(localStorage.getItem('questionary-tags') || '[]');
      const itemTags = JSON.parse(localStorage.getItem('questionary-item-tags') || '{}');

      if (tags.length === 0) {
        container.innerHTML = '<span class="empty-hint">No tags created yet</span>';
        return;
      }

      container.innerHTML = tags.map(tag => {
        const count = Object.values(itemTags).filter(arr => arr.includes(tag.id)).length;
        return `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15); background: ${tag.color}; color: white;" onclick="filterByTagHome('${tag.id}')">${escapeHtml(tag.name)} <small style="opacity: 0.85;">(${count})</small></span>`;
      }).join('');
    }

    function renderHomeTaggedItemsList() {
      const container = document.getElementById('homeTaggedItemsList');
      if (!container) return;

      const tags = JSON.parse(localStorage.getItem('questionary-tags') || '[]');
      const itemTags = JSON.parse(localStorage.getItem('questionary-item-tags') || '{}');

      const items = Object.entries(itemTags)
      .filter(([_, tagIds]) => tagIds.length > 0 && tagIds.some(tid => tags.find(t => t.id === tid)))
      .slice(0, 8);

      if (items.length === 0) {
        container.innerHTML = '<span class="empty-hint">No tagged items yet</span>';
        return;
      }

      container.innerHTML = items.map(([itemId, tagIds]) => {
        const tagBadges = tagIds.slice(0, 2).map(tid => {
          const tag = tags.find(t => t.id === tid);
          return tag ? `<span class="tag-mini" style="background: ${tag.color}">${escapeHtml(tag.name)}</span>` : '';
        }).join(' ');

        const isFolder = itemId.startsWith('folder_');
        const isDoc = itemId.startsWith('doc_');
        let displayName = itemId;
        let icon = 'fa-file';

        if (isFolder) {
          displayName = itemId.replace('folder_', '').split('/').pop();
          icon = 'fa-folder';
        } else if (isDoc) {
          displayName = itemId.replace('doc_', '').split('/').pop();
          icon = 'fa-file-pdf';
        }

        return `<div class="home-tagged-item" onclick="navigateToTaggedItem('${escapeHtml(itemId)}')" style="cursor:pointer;"><span><i class="fas ${icon}" style="color: var(--primary-color); margin-right: 0.4rem;"></i>${escapeHtml(displayName)}</span><span>${tagBadges}</span></div>`;
      }).join('');
    }

    function filterByTagHome(tagId) {
      showView('tags');
      if (typeof window.filterByTag === 'function') {
        window.filterByTag(tagId);
      }
    }

    window.renderHomeTagsList = renderHomeTagsList;
    window.renderHomeTaggedItemsList = renderHomeTaggedItemsList;
    window.showView = showView;

    function showView(viewName) {
      currentView = viewName;
      saveUserPreferences();
      updateMobileBottomNavActive(viewName);

      const pdfViewerContainer = document.getElementById('pdfViewerContainer');
      if (pdfViewerContainer && pdfViewerContainer.style.display !== 'none') {
        if (typeof closePDF === 'function') closePDF();
      }

      const tilesSection = document.getElementById('tilesSection');
      const favoritesSection = document.getElementById('favoritesSection');
      const recentSection = document.getElementById('recentSection');
      const analyticsSection = document.getElementById('analyticsSection');
      const plannerSection = document.getElementById('plannerSection');
      const flashcardsSection = document.getElementById('flashcardsSection');
      const notesSection = document.getElementById('notesSection');
      const progressSection = document.getElementById('progressSection');
      const remindersSection = document.getElementById('remindersSection');
      const settingsSection = document.getElementById('settingsSection');
      const tagsSection = document.getElementById('tagsSection');
      const importedSection = document.getElementById('importedSection');
      const studyRoomSection = document.getElementById('studyRoomSection');
      const searchResults = document.getElementById('searchResults');
      const dashboardHeader = document.querySelector('.dashboard-header');
      const breadcrumb = document.getElementById('breadcrumb');
      const backBtn = document.getElementById('backBtn');
      const pdfViewer = document.getElementById('pdfViewer');

      const allSections = [tilesSection, favoritesSection, recentSection, analyticsSection,
      plannerSection, flashcardsSection, notesSection, progressSection,
      remindersSection, settingsSection, tagsSection, importedSection, studyRoomSection];
      allSections.forEach(section => {
        if (section) section.style.display = 'none';
      });
      if (searchResults) searchResults.style.display = 'none';
      if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
      if (pdfViewer) { pdfViewer.classList.remove('active'); pdfViewer.src = ''; }
      hideHomeTagsPanels();

      switch(viewName) {
        case 'home':
          if (tilesSection) tilesSection.style.display = 'block';
          const tc = document.getElementById('tilesContainer');
          if (tc) {
            const isListView = tc.classList.contains('list-view');
            tc.style.display = isListView ? 'flex' : 'grid';
          }
          const sh = document.querySelector('#tilesSection .section-header');
          if (sh) sh.style.display = 'flex';

          if (importedSection) importedSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = path.length === 0 ? (window.innerWidth <= 768 ? 'grid' : 'flex') : 'none';
          if (breadcrumb) breadcrumb.style.display = 'flex';
          if (backBtn) backBtn.style.display = path.length > 0 ? 'flex' : 'none';
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          navigateToPath(path);
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
        case 'reminders':
          if (remindersSection) remindersSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = 'none';
          if (breadcrumb) breadcrumb.style.display = 'none';
          if (backBtn) backBtn.style.display = 'none';
          if (typeof window.renderReminders === 'function') window.renderReminders();
          break;
        case 'settings':
          if (settingsSection) settingsSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = 'none';
          if (breadcrumb) breadcrumb.style.display = 'none';
          if (backBtn) backBtn.style.display = 'none';
          if (typeof window.renderSettings === 'function') window.renderSettings();
          break;
        case 'studyRoom':
          if (studyRoomSection) studyRoomSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = 'none';
          if (breadcrumb) breadcrumb.style.display = 'none';
          if (backBtn) backBtn.style.display = 'none';
          if (typeof window.renderStudyRoom === 'function') window.renderStudyRoom();
          break;
        case 'tags':
          if (tagsSection) tagsSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = 'none';
          if (breadcrumb) breadcrumb.style.display = 'none';
          if (backBtn) backBtn.style.display = 'none';
          if (typeof window.renderTagsMain === 'function') window.renderTagsMain();
          if (typeof window.renderTaggedItems === 'function') window.renderTaggedItems();
          break;
        default:
          if (tilesSection) tilesSection.style.display = 'block';
          if (importedSection) importedSection.style.display = 'block';
          if (dashboardHeader) dashboardHeader.style.display = window.innerWidth <= 768 ? 'grid' : 'flex';
          if (breadcrumb) breadcrumb.style.display = 'flex';
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
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
            const parentPath = (Array.isArray(fav.path) ? fav.path : []).slice(0, -1);
            showView('home');
            navigateToPath(parentPath);
            setTimeout(() => showPDF(fav.url), 100);
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
            const parentPath = (Array.isArray(doc.path) ? doc.path : []).slice(0, -1);
            showView('home');
            navigateToPath(parentPath);
            setTimeout(() => showPDF(doc.url), 100);
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

      sortToggleBtn && sortToggleBtn.addEventListener('click', async () => {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        localStorage.setItem('questionary-sort-order', currentSortOrder);
        const nodes = await DbService.getChildren(path);
        renderTilesFromDb(nodes);
      });
    }

    async function handleBackButton() {
      if (path.length > 0) {
        path.pop();
        const pdfViewer = document.getElementById('pdfViewer');
        if (pdfViewer) {
          pdfViewer.classList.remove('active');
          pdfViewer.src = '';
        }
        const pdfViewerContainer = document.getElementById('pdfViewerContainer');
        if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        const bookmarksPanel = document.getElementById('pdfBookmarksPanel');
        if (bookmarksPanel) bookmarksPanel.style.display = 'none';

        const tilesContainer = document.getElementById('tilesContainer');
        if (tilesContainer) {
          const isListView = tilesContainer.classList.contains('list-view');
          tilesContainer.style.display = isListView ? 'flex' : 'grid';
        }

        const nodes = await DbService.getChildren(path);
        renderTilesFromDb(nodes);
        updateBreadcrumb();
        hideTimerCompletely();
      }
    }

    // ================================================================
    // TIMER SYSTEM
    // ================================================================
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
        newBtn.addEventListener('click', () => { selectTimerPreset(newBtn, duration); });
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
      const timerControls = document.getElementById('timerControls');
      if (!timerPanel) return;

      timerPanel.classList.toggle('minimized');
      const isMinimized = timerPanel.classList.contains('minimized');

      if (timerControls && isMinimized) {
        timerControls.style.display = 'flex';
      }

      if (minimizeBtn) {
        const icon = minimizeBtn.querySelector('i');
        if (icon) {
          if (isMinimized) {
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
      if (!duration || isNaN(duration) || duration <= 0) return;

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

    function timerFinished() {
      clearInterval(timerState.interval);
      timerState.isRunning = false;
      timerState.isPaused = false;

      if (typeof window.playAlarmSound === 'function') {
        window.playAlarmSound();
      }

      showNotification('⏰ Timer Complete! Time\'s up!', 'success');

      document.getElementById('timerStart').style.display = 'flex';
      document.getElementById('timerPause').style.display = 'none';
      document.getElementById('timerResume').style.display = 'none';
      document.getElementById('timerLap').style.display = 'none';

      const timerDisplay = document.getElementById('timerDisplay');
      if (timerDisplay) {
        timerDisplay.textContent = '00:00:00';
        timerDisplay.classList.add('danger');
      }

      updateTimerStatus('Timer complete!', 'complete');
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
      if (timerPanel) timerPanel.style.display = 'flex';
      if (reopenBtn) reopenBtn.style.display = 'none';
    }

    function hideTimer() {
      const timerPanel = document.getElementById('timerPanel');
      const reopenBtn = document.getElementById('timerReopenBtn');
      if (timerPanel) timerPanel.style.display = 'none';

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
      if (timerPanel) timerPanel.style.display = 'none';
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
      if (!timerState.isRunning || timerState.remaining <= 0) return;
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
      timerState.laps.forEach((lap, i) => { lap.number = i + 1; });
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

    var customTimerPresets = JSON.parse(localStorage.getItem('questionary-timer-presets') || '[]');

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

        btn.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const ok = await showConfirm(`Delete "${preset.label}" preset?`, { title: 'Delete Preset', type: 'danger', confirmText: 'Delete' });
          if (ok) removeCustomPreset(preset.id);
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
      const preset = { id: Date.now().toString(), label: label, duration: durationInSeconds };

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

    var darkModeSchedule = JSON.parse(localStorage.getItem('questionary-darkmode-schedule') || '{"enabled":false,"darkStart":19,"darkEnd":7}');

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

    var pageBookmarks = JSON.parse(localStorage.getItem('questionary-page-bookmarks') || '{}');

    function savePageBookmarks() {
      localStorage.setItem('questionary-page-bookmarks', JSON.stringify(pageBookmarks));
    }

    function addPageBookmark(docPath, pageNumber, label = '') {
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

    function generateShareLink(docPath) {
      const readablePath = docPath.join(' > ');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(readablePath).then(() => {
          showNotification('Document path copied to clipboard!', 'success');
        }).catch(() => {
          showInfoDialog(readablePath, { title: 'Document Path', type: 'info' });
        });
      } else {
        showInfoDialog(readablePath, { title: 'Document Path', type: 'info' });
      }
      return readablePath;
    }

    window.generateShareLink = generateShareLink;

    var printQueue = [];

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

    var pdfViewStartTime = null;

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

    // ================================================================
    // KEYBOARD SHORTCUTS ENGINE
    // ================================================================
    const DEFAULT_KEYBINDS = {
      focusSearch:   { key: '/', ctrl: false, alt: false, shift: false, label: 'Focus Search' },
      newNote:       { key: 'n', ctrl: false, alt: false, shift: false, label: 'New Note' },
      newFlashcard:  { key: 'f', ctrl: false, alt: false, shift: false, label: 'New Flashcard' },
      shareLocation: { key: 's', ctrl: false, alt: false, shift: false, label: 'Share Location' },
      quickLinks:    { key: 'q', ctrl: false, alt: false, shift: false, label: 'Toggle Quick Links' },
      goBack:        { key: 'Backspace', ctrl: false, alt: false, shift: false, label: 'Go Back' },
      goHome:        { key: 'Home', ctrl: false, alt: true, shift: false, label: 'Go Home' },
      navBack:       { key: 'ArrowLeft', ctrl: false, alt: true, shift: false, label: 'Navigate Back' },
      wbUndo:        { key: 'z', ctrl: true, alt: false, shift: false, label: 'Whiteboard Undo' },
      wbRedo:        { key: 'y', ctrl: true, alt: false, shift: false, label: 'Whiteboard Redo' },
      wbPen:         { key: 'p', ctrl: false, alt: false, shift: false, label: 'Whiteboard Pen' },
      wbEraser:      { key: 'e', ctrl: false, alt: false, shift: false, label: 'Whiteboard Eraser' },
      wbHighlighter: { key: 'h', ctrl: false, alt: false, shift: false, label: 'Whiteboard Highlighter' },
      toggleMic:     { key: 'm', ctrl: true, alt: false, shift: false, label: 'Toggle Microphone' },
      toggleCam:     { key: 'v', ctrl: true, alt: false, shift: false, label: 'Toggle Camera' },
      pushToTalk:    { key: 't', ctrl: false, alt: false, shift: false, label: 'Push to Talk (Hold)' },
    };

    function loadKeybinds() {
      const saved = localStorage.getItem('questionary-keybinds');
      const binds = saved ? JSON.parse(saved) : {};
      const merged = {};
      for (const id in DEFAULT_KEYBINDS) {
        merged[id] = binds[id] ? { ...DEFAULT_KEYBINDS[id], ...binds[id] } : { ...DEFAULT_KEYBINDS[id] };
      }
      window._keybinds = merged;
      return merged;
    }

    function saveKeybinds(binds) {
      localStorage.setItem('questionary-keybinds', JSON.stringify(binds));
      window._keybinds = binds;
    }

    function resetKeybinds() {
      localStorage.removeItem('questionary-keybinds');
      const binds = loadKeybinds();
      renderKeybindsSettings();
      if (typeof showNotification === 'function') showNotification('Keyboard shortcuts reset to defaults.', 'info');
      return binds;
    }

    function formatKeybindDisplay(b) {
      let parts = [];
      if (b.ctrl) parts.push('Ctrl');
      if (b.alt) parts.push('Alt');
      if (b.shift) parts.push('Shift');
      let keyName = b.key;
      if (keyName === ' ') keyName = 'Space';
      else if (keyName.length === 1) keyName = keyName.toUpperCase();
      parts.push(keyName);
      return parts.join(' + ');
    }

    function keybindMatches(e, bindId) {
      const binds = window._keybinds || loadKeybinds();
      const b = binds[bindId];
      if (!b) return false;
      const keyMatch = e.key.toLowerCase() === b.key.toLowerCase() || e.key === b.key;
      return keyMatch && e.ctrlKey === !!b.ctrl && e.altKey === !!b.alt && e.shiftKey === !!b.shift;
    }

    function renderKeybindsSettings() {
      const container = document.getElementById('keybindsList');
      if (!container) return;
      const binds = window._keybinds || loadKeybinds();
      const categories = {
        'General': ['focusSearch', 'newNote', 'newFlashcard', 'shareLocation', 'quickLinks', 'goBack', 'goHome', 'navBack'],
        'Whiteboard': ['wbUndo', 'wbRedo', 'wbPen', 'wbEraser', 'wbHighlighter'],
        'Study Room': ['toggleMic', 'toggleCam', 'pushToTalk']
      };
      let html = '';
      for (const [cat, ids] of Object.entries(categories)) {
        html += `<div class="kb-category"><span class="kb-cat-label">${cat}</span></div>`;
        for (const id of ids) {
          const b = binds[id];
          if (!b) continue;
          html += `<div class="kb-row">
          <span class="kb-action">${b.label}</span>
          <button class="kb-key-btn" data-bind-id="${id}" title="Click to change">${formatKeybindDisplay(b)}</button>
          </div>`;
        }
      }
      container.innerHTML = html;
      container.querySelectorAll('.kb-key-btn').forEach(btn => {
        btn.addEventListener('click', () => startKeybindCapture(btn));
      });
    }

    var _capturingBind = null;
    function startKeybindCapture(btn) {
      if (_capturingBind) {
        _capturingBind.classList.remove('kb-listening');
        _capturingBind.textContent = _capturingBind._prevText;
      }
      _capturingBind = btn;
      btn._prevText = btn.textContent;
      btn.textContent = 'Press a key…';
      btn.classList.add('kb-listening');

      function onKey(e) {
        e.preventDefault();
        e.stopPropagation();
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
        document.removeEventListener('keydown', onKey, true);
        btn.classList.remove('kb-listening');

        const bindId = btn.dataset.bindId;
        const binds = window._keybinds || loadKeybinds();
        binds[bindId] = {
          ...binds[bindId],
          key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey
        };
        saveKeybinds(binds);
        btn.textContent = formatKeybindDisplay(binds[bindId]);
        _capturingBind = null;
        if (typeof showNotification === 'function') showNotification(`Shortcut updated: ${binds[bindId].label}`, 'success');
      }
      document.addEventListener('keydown', onKey, true);
    }

    loadKeybinds();
    window.renderKeybindsSettings = renderKeybindsSettings;
    window.resetKeybinds = resetKeybinds;

    document.addEventListener('keydown', (e) => {
      const isInputFocused = e.target.closest('input, textarea, [contenteditable]');

      if (typeof window.isWhiteboardActive === 'function' && window.isWhiteboardActive()) {
        if (keybindMatches(e, 'wbUndo')) { e.preventDefault(); if (typeof window.wbUndo === 'function') window.wbUndo(); return; }
        if (keybindMatches(e, 'wbRedo')) { e.preventDefault(); if (typeof window.wbRedo === 'function') window.wbRedo(); return; }
        if (!isInputFocused) {
          if (keybindMatches(e, 'wbPen')) { e.preventDefault(); if (typeof window.wbSelectTool === 'function') window.wbSelectTool('pen'); return; }
          if (keybindMatches(e, 'wbEraser')) { e.preventDefault(); if (typeof window.wbSelectTool === 'function') window.wbSelectTool('eraser'); return; }
          if (keybindMatches(e, 'wbHighlighter')) { e.preventDefault(); if (typeof window.wbSelectTool === 'function') window.wbSelectTool('highlighter'); return; }
        }
      }

      if (isInputFocused) return;

      if (keybindMatches(e, 'newNote')) {
        if (typeof openNoteModal === 'function') { e.preventDefault(); openNoteModal(); }
      }
      if (keybindMatches(e, 'newFlashcard')) {
        if (typeof openFlashcardModal === 'function') { e.preventDefault(); openFlashcardModal(); }
      }
      if (keybindMatches(e, 'shareLocation')) {
        if (path.length > 0 && typeof generateShareLink === 'function') { e.preventDefault(); generateShareLink(path); }
      }
      if (keybindMatches(e, 'quickLinks')) {
        e.preventDefault();
        document.getElementById('quickLinksPanel')?.classList.toggle('active');
      }
      if (keybindMatches(e, 'toggleMic')) {
        e.preventDefault();
        if (typeof window.srToggleMicrophone === 'function') window.srToggleMicrophone();
      }
      if (keybindMatches(e, 'toggleCam')) {
        e.preventDefault();
        if (typeof window.srToggleCamera === 'function') window.srToggleCamera();
      }
    });

    // ================================================================
    // SETTINGS DROPDOWN & CONFIGURATION
    // ================================================================
    function initSettingsDropdown() {
      let userBadge = document.getElementById('userBadge') || document.querySelector('.user-badge');
      if (!userBadge) return;

      let userDropdown = document.getElementById('userDropdownMenu') || userBadge.querySelector('.user-dropdown-menu');

      if (!userDropdown) {
        userDropdown = document.createElement('div');
        userDropdown.className = 'user-dropdown-menu';
        userDropdown.id = 'userDropdownMenu';
        userDropdown.innerHTML = `
          <div class="user-dropdown-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));">
            <strong id="dropdownUsername" style="display: block; color: var(--text-primary); font-size: 0.95rem;">User</strong>
            <small style="color: var(--text-secondary); font-size: 0.75rem;">Account Settings</small>
          </div>
          <div class="user-dropdown-items" style="padding: 6px 0;">
            <a class="dropdown-item" id="openSettingsBtn" href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem;">
              <i class="fas fa-cog" style="width: 16px; text-align: center;"></i> Settings
            </a>
            <a class="dropdown-item" id="resetCodeCacheBtn" href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: var(--accent, #cf6215); text-decoration: none; font-size: 0.85rem;">
              <i class="fas fa-sync-alt" style="width: 16px; text-align: center;"></i> Force Sync / Clear Cache
            </a>
            <a class="dropdown-item" id="logoutBtn" href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 0.85rem;">
              <i class="fas fa-sign-out-alt" style="width: 16px; text-align: center;"></i> Logout
            </a>
          </div>
        `;
        userBadge.appendChild(userDropdown);
      }

      const toggleDropdown = (e) => {
        if (e.target.closest('#userDropdownMenu')) return;
        e.preventDefault();
        e.stopPropagation();
        userBadge.classList.toggle('active');

        const usernameDisplay = document.getElementById('username-display');
        const dropdownUsername = document.getElementById('dropdownUsername');
        if (usernameDisplay && dropdownUsername) {
          dropdownUsername.textContent = usernameDisplay.textContent;
        }
      };

      userBadge.onclick = toggleDropdown;

      if (!window._userDropdownGlobalClickListener) {
        window._userDropdownGlobalClickListener = true;
        document.addEventListener('click', (e) => {
          if (!e.target.closest('#userBadge') && !e.target.closest('.user-badge')) {
            document.querySelectorAll('.user-badge, #userBadge').forEach(el => el.classList.remove('active'));
          }
        });
      }

      loadSettingsState();
      setupSettingsToggles();
      setupSettingsActions();
    }

    function loadSettingsState() {
      const settings = JSON.parse(localStorage.getItem('questionary-settings') || '{}');

      const verticalNavToggle = document.getElementById('verticalNavbarToggle');
      if (verticalNavToggle) {
        verticalNavToggle.checked = settings.verticalNavbar || false;
        if (settings.verticalNavbar) {
          document.body.classList.add('vertical-navbar-mode');
        } else {
          document.body.classList.remove('vertical-navbar-mode');
        }
      } else {
        document.body.classList.remove('vertical-navbar-mode');
      }

      const compactToggle = document.getElementById('compactModeToggle');
      if (compactToggle) {
        compactToggle.checked = settings.compactMode || false;
        if (settings.compactMode) document.body.classList.add('compact-mode');
        else document.body.classList.remove('compact-mode');
      }

      const animationsToggle = document.getElementById('animationsToggle');
      if (animationsToggle) {
        animationsToggle.checked = settings.animations !== false;
        if (settings.animations === false) document.body.classList.add('reduced-animations');
      }

      const autoPlayToggle = document.getElementById('autoPlayToggle');
      if (autoPlayToggle) autoPlayToggle.checked = settings.autoOpenPdfs || false;

      const focusModeToggle = document.getElementById('focusModeToggle');
      if (focusModeToggle) {
        focusModeToggle.checked = settings.focusMode || false;
        if (settings.focusMode) document.body.classList.add('focus-mode');
      }

      const rememberLocationToggle = document.getElementById('rememberLocationToggle');
      if (rememberLocationToggle) rememberLocationToggle.checked = settings.rememberLocation !== false;
    }

    function saveSettingsState() {
      const settings = {
        verticalNavbar: document.getElementById('verticalNavbarToggle')?.checked || false,
        compactMode: document.getElementById('compactModeToggle')?.checked || false,
        animations: document.getElementById('animationsToggle')?.checked !== false,
        autoOpenPdfs: document.getElementById('autoPlayToggle')?.checked || false,
        focusMode: document.getElementById('focusModeToggle')?.checked || false,
        rememberLocation: document.getElementById('rememberLocationToggle')?.checked !== false
      };
      localStorage.setItem('questionary-settings', JSON.stringify(settings));
    }

    function setupSettingsToggles() {
      function setupToggleRow(toggleId, onToggle) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;
        const toggleItem = toggle.closest('.toggle-item');

        toggle.addEventListener('change', (e) => {
          e.stopPropagation();
          onToggle(toggle.checked);
          saveSettingsState();
        });

        if (toggleItem) {
          toggleItem.style.cursor = 'pointer';
          toggleItem.addEventListener('click', (e) => {
            if (e.target === toggle) return;
            e.preventDefault();
            e.stopPropagation();
            toggle.checked = !toggle.checked;
            onToggle(toggle.checked);
            saveSettingsState();
          });
        }
      }

      setupToggleRow('verticalNavbarToggle', (checked) => {
        if (checked) {
          document.body.classList.add('vertical-navbar-mode');
          if (typeof showNotification === 'function') showNotification('Vertical navbar enabled', 'success');
        } else {
          document.body.classList.remove('vertical-navbar-mode');
          closeSidebar();
          if (typeof showNotification === 'function') showNotification('Horizontal navbar restored', 'info');
        }
      });

      setupToggleRow('compactModeToggle', (checked) => {
        document.body.classList.toggle('compact-mode', checked);
        if (typeof showNotification === 'function') showNotification(checked ? 'Compact mode enabled' : 'Compact mode disabled', 'info');
      });

      setupToggleRow('animationsToggle', (checked) => {
        document.body.classList.toggle('reduced-animations', !checked);
        if (typeof showNotification === 'function') showNotification(checked ? 'Animations enabled' : 'Animations reduced', 'info');
      });

      setupToggleRow('autoPlayToggle', (checked) => {
        if (typeof showNotification === 'function') showNotification(checked ? 'PDFs will auto-open on click' : 'PDF preview mode', 'info');
      });

      setupToggleRow('focusModeToggle', (checked) => {
        document.body.classList.toggle('focus-mode', checked);
        if (typeof showNotification === 'function') showNotification(checked ? 'Focus mode enabled' : 'Focus mode disabled', 'info');
      });

      setupToggleRow('rememberLocationToggle', (checked) => {
        if (typeof showNotification === 'function') showNotification(checked ? 'Will remember your last location' : 'Will start at home on launch', 'info');
      });
    }

    function setupSettingsActions() {
      const clearDataBtn = document.getElementById('clearDataBtn');
      if (clearDataBtn) {
        clearDataBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showConfirmModal(
            'Clear Local Data',
            'Are you sure you want to clear all local data? This will reset favorites, notes, flashcards, quick links, and settings.',
            async () => {
              const keysToKeep = ['questionary-login'];
              const allKeys = Object.keys(localStorage).filter(k => k.startsWith('questionary-'));
              allKeys.forEach(key => {
                if (!keysToKeep.includes(key)) localStorage.removeItem(key);
              });
              await DbService.clearIndexedDB();
              showNotification('Local data cleared', 'success');
              document.getElementById('userBadge')?.classList.remove('active');
              setTimeout(() => location.reload(), 1000);
            }
          );
        });
      }

      const exportDataBtn = document.getElementById('exportDataBtn');
      if (exportDataBtn) {
        exportDataBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const exportData = {};
          Object.keys(localStorage).filter(k => k.startsWith('questionary-')).forEach(key => {
            exportData[key] = localStorage.getItem(key);
          });

          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `questionary-backup-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);

          showNotification('Data exported successfully', 'success');
          document.getElementById('userBadge')?.classList.remove('active');
        });
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showConfirmModal(
            'Logout',
            'Are you sure you want to logout?',
            () => {
              localStorage.removeItem('questionary-login');
              showNotification('Logged out successfully', 'info');
              setTimeout(() => location.reload(), 500);
            }
          );
        });
      }

      const openSettingsBtn = document.getElementById('openSettingsBtn');
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('userBadge')?.classList.remove('active');
          showView('settings');
          setActiveNav('settingsNav');
        });
      }
    }

    // ================================================================
    // COMPREHENSIVE INITIALIZATION ROUTINE
    // ================================================================
    function initializeNewFeatures() {
      try { if (typeof loadNotes === 'function') loadNotes(); } catch(e){}
      try { if (typeof loadFlashcardDecks === 'function') loadFlashcardDecks(); } catch(e){}
      try { if (typeof loadStudySessions === 'function') loadStudySessions(); } catch(e){}
      try { if (typeof loadDocumentProgress === 'function') loadDocumentProgress(); } catch(e){}
      try { if (typeof loadQuickLinks === 'function') loadQuickLinks(); } catch(e){}
      try { if (typeof loadStudyStats === 'function') loadStudyStats(); } catch(e){}

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
      if (addCardBtn && typeof addCardEditor === 'function') addCardBtn.onclick = () => addCardEditor();

      const closeStudyModalBtn = document.getElementById('closeStudyModal');
      const flipCardBtn = document.getElementById('flipCardBtn');
      const nextCardBtn = document.getElementById('nextCardBtn');
      const prevCardBtn = document.getElementById('prevCardBtn');
      const activeFlashcard = document.getElementById('activeFlashcard');
      const studyModal = document.getElementById('studyModal');

      if (closeStudyModalBtn && typeof closeStudyModal === 'function') closeStudyModalBtn.onclick = closeStudyModal;
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
          if (currentOpenPDF) {
            showQuickLinkChoiceDialog();
            return;
          }
          if (path.length === 0) {
            if (typeof showNotification === 'function') showNotification('Navigate to a folder first to add it as a quick link', 'info');
            return;
          }
          addCurrentFolderToQuickLinks();
        };
      }

      if (typeof renderQuickLinks === 'function') renderQuickLinks();
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

    var searchHistory = JSON.parse(localStorage.getItem('questionary-search-history') || '[]');

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

    // ================================================================
    // UPDATER INTEGRATION
    // ================================================================
    var updateState = window.updateState || {
      available: false,
      version: null,
      update: null,
      downloading: false,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0
    };

    async function checkForUpdatesManual() {
      const btn = document.getElementById('checkUpdatesBtn');
      if (updateState.downloading) {
        showNotification('Download in progress...', 'info');
        return;
      }

      if (btn) btn.classList.add('checking');

      let nativeUpdateFound = false;

      if (window.__TAURI__ && (window.__TAURI__.updater || window.__TAURI_PLUGIN_UPDATER__)) {
        try {
          showNotification('Checking for native app binary updates...', 'info');
          const updater = window.__TAURI__.updater || window.__TAURI_PLUGIN_UPDATER__;
          const update = await updater.check();

          if (update && update.available) {
            nativeUpdateFound = true;
            updateState.available = true;
            updateState.version = update.version;
            updateState.update = update;
            showNotification(`Native update ${update.version} available! Installing...`, 'success');
            await downloadAndInstallUpdate();
            return;
          }
        } catch (tauriErr) {
          console.warn('[Tauri Native Updater]: Native check skipped/unconfigured. Falling back to Hot-Code Updater:', tauriErr.message || tauriErr);
        }
      }

      if (window.hotCodeUpdater && typeof window.hotCodeUpdater.check === 'function') {
        try {
          showNotification('Checking for GitHub code updates...', 'info');
          const updates = await window.hotCodeUpdater.check(false);
          if (updates && updates.length > 0) {
            showNotification(`Downloading ${updates.length} hot update file(s)...`, 'info');
            await window.hotCodeUpdater.download();
          } else {
            showNotification('App code is completely up to date!', 'success');
            resetUpdateButton();
          }
        } catch (hotErr) {
          console.error('[Hot Code Updater Error]:', hotErr);
          showNotification('Update check failed: ' + (hotErr.message || 'Network error'), 'error');
          resetUpdateButton();
        }
      } else {
        if (!nativeUpdateFound) {
          showNotification('No updater available in this environment.', 'warning');
          resetUpdateButton();
        }
      }

      if (btn) btn.classList.remove('checking');
    }

    async function downloadAndInstallUpdate() {
      if (!updateState.update) return;
      updateState.downloading = true;
      updateButtonToProgressMode();

      try {
        showNotification('Downloading & installing update...', 'info');

        await updateState.update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            updateState.totalBytes = event.data.contentLength || 0;
          } else if (event.event === 'Progress') {
            updateState.downloadedBytes += event.data.chunkLength || 0;
            if (updateState.totalBytes > 0) {
              updateState.downloadProgress = Math.round((updateState.downloadedBytes / updateState.totalBytes) * 100);
            }
            updateProgressButton();
          } else if (event.event === 'Finished') {
            updateState.downloadProgress = 100;
            updateProgressButton();
          }
        });

        showNotification('Update installed! Restarting app...', 'success');
        updateButtonToRestartMode();

        setTimeout(async () => {
          try {
            if (window.__TAURI__?.process?.relaunch) {
              await window.__TAURI__.process.relaunch();
            } else if (window.__TAURI__?.core?.invoke) {
              await window.__TAURI__.core.invoke('plugin:process|relaunch');
            } else {
              location.reload();
            }
          } catch (e) {
            console.error('Relaunch failed:', e);
            location.reload();
          }
        }, 1500);

      } catch (error) {
        console.error('[Install Error]:', error);
        showNotification('Failed to install update: ' + error.message, 'error');
        resetUpdateButton();
      } finally {
        updateState.downloading = false;
      }
    }

    function updateButtonToDownloadMode(version) {
      const btn = document.getElementById('checkUpdatesBtn');
      if (btn) {
        btn.innerHTML = `<i class="fas fa-download"></i>`;
        btn.title = `Download update ${version}`;
        btn.classList.add('update-available');
      }
    }

    function updateButtonToProgressMode() {
      const btn = document.getElementById('checkUpdatesBtn');
      if (btn) {
        btn.innerHTML = `<i class="fas fa-download"></i>`;
        btn.title = 'Downloading...';
        btn.classList.add('downloading');
        btn.classList.remove('update-available');
      }
      showDownloadProgressBar();
    }

    function updateProgressButton() {
      const progressFill = document.getElementById('downloadProgressFill');
      const progressPercent = document.getElementById('downloadProgressPercent');
      const progressText = document.getElementById('downloadProgressText');
      if (progressFill) progressFill.style.width = `${updateState.downloadProgress}%`;
      if (progressPercent) progressPercent.textContent = `${updateState.downloadProgress}%`;
      if (progressText) progressText.textContent = `${formatBytes(updateState.downloadedBytes)} / ${formatBytes(updateState.totalBytes)}`;
    }

    function showDownloadProgressBar() {
      const progressBar = document.getElementById('downloadProgressBar');
      if (progressBar) progressBar.style.display = 'block';
    }

    function hideDownloadProgressBar() {
      const progressBar = document.getElementById('downloadProgressBar');
      if (progressBar) progressBar.style.display = 'none';
      const progressFill = document.getElementById('downloadProgressFill');
      if (progressFill) progressFill.style.width = '0%';
    }

    function updateButtonToRestartMode() {
      const btn = document.getElementById('checkUpdatesBtn');
      if (btn) {
        btn.innerHTML = `<i class="fas fa-redo"></i>`;
        btn.title = 'Restarting...';
        btn.classList.remove('downloading');
        btn.classList.add('restarting');
      }
      hideDownloadProgressBar();
    }

    function resetUpdateButton() {
      const btn = document.getElementById('checkUpdatesBtn');
      if (btn) {
        btn.innerHTML = `<i class="fas fa-sync-alt"></i>`;
        btn.title = 'Check for Updates';
        btn.classList.remove('update-available', 'downloading', 'restarting');
      }
      hideDownloadProgressBar();
      updateState.available = false;
      updateState.update = null;
      updateState.downloading = false;
    }

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    (function initUpdateButton() {
      function setupButton() {
        const btn = document.getElementById('checkUpdatesBtn');
        if (btn && !btn.dataset.initialized) {
          btn.dataset.initialized = 'true';
          btn.addEventListener('click', checkForUpdatesManual);
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupButton);
      } else {
        setupButton();
      }
      setTimeout(setupButton, 1000);
      setTimeout(setupButton, 3000);
    })();

    async function checkForUpdatesOnStartup() {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (window.hotCodeUpdater && typeof window.hotCodeUpdater.check === 'function') {
        try {
          console.log('[HotUpdate] Running startup code check...');
          const updates = await window.hotCodeUpdater.check(true);
          if (updates && updates.length > 0) {
            console.log('[HotUpdate] Startup updates found, downloading...');
            await window.hotCodeUpdater.download();
          }
        } catch (e) {
          console.log('[HotUpdate] Startup check notice:', e.message);
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkForUpdatesOnStartup);
    } else {
      checkForUpdatesOnStartup();
    }

    document.addEventListener('DOMContentLoaded', () => {
      initSettingsDropdown();
      initHamburgerMenu();
    });

    window.addEventListener('message', async function(e) {
        if (e.data && e.data.type === 'openInNewWindow' && e.data.url) {
            openUrlInExternalWindow(e.data.url);
        }
    });

    async function openUrlInExternalWindow(url) {
        if (!url) return;
        
        try {
            if (window.__TAURI__ && window.__TAURI__.shell && typeof window.__TAURI__.shell.open === 'function') {
                await window.__TAURI__.shell.open(url);
                showNotification('Opening PDF in external application...', 'info');
                return;
            } else if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                await window.__TAURI__.core.invoke('plugin:shell|open', { href: url });
                showNotification('Opening PDF in external application...', 'info');
                return;
            }
        } catch (err) {
            console.warn('[Tauri Shell Open Error]:', err);
        }

        try {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 100);
            showNotification('Opened PDF in new window', 'info');
        } catch (e) {
            window.open(url, '_blank');
        }
    }
    window.openUrlInExternalWindow = openUrlInExternalWindow;

    document.addEventListener('click', (e) => {
      const resetBtn = e.target.closest('#resetCodeCacheBtn, #resetCodeCacheBtnSettings, .reset-cache-btn');
      if (resetBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const doReset = () => {
          if (window.hotCodeUpdater && typeof window.hotCodeUpdater.resetCache === 'function') {
            window.hotCodeUpdater.resetCache();
          } else {
            localStorage.removeItem('questionary-code-files');
            localStorage.removeItem('questionary-installed-commit-sha');
            location.reload();
          }
        };

        if (typeof showConfirm === 'function') {
          showConfirm('Clear stored hot-code updates and re-sync directly from GitHub?', {
            title: 'Reset Code Cache',
            confirmText: 'Reset & Sync',
            type: 'warning'
          }).then(yes => { if (yes) doReset(); });
        } else if (confirm('Clear stored hot-code updates and re-sync directly from GitHub?')) {
          doReset();
        }
      }
    });

    function initHomeSyncButton() {
      const syncBtn = document.getElementById('homeSyncBtn');
      if (syncBtn && !syncBtn.dataset.initialized) {
        syncBtn.dataset.initialized = 'true';
        syncBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const doReset = () => {
            if (window.hotCodeUpdater && typeof window.hotCodeUpdater.resetCache === 'function') {
              window.hotCodeUpdater.resetCache();
            } else {
              localStorage.removeItem('questionary-code-files');
              localStorage.removeItem('questionary-installed-commit-sha');
              delete window._HOT_APP_JS_LOADED;
              location.reload();
            }
          };

          if (typeof window.showConfirm === 'function') {
            window.showConfirm('Force re-sync code from GitHub and clear local cache?', {
              title: 'Force Re-sync Code',
              confirmText: 'Sync Now',
              type: 'warning'
            }).then(yes => { if (yes) doReset(); });
          } else if (confirm('Force re-sync code from GitHub and clear local cache?')) {
            doReset();
          }
        });
      }
    }
    document.addEventListener('DOMContentLoaded', initHomeSyncButton);
    setTimeout(initHomeSyncButton, 1000);
}
// ================================================================
// DELEGATED THEME & ACCESSIBILITY CONTROLLER
// ================================================================
document.addEventListener('click', (e) => {
    // 1. THEME TOGGLE BUTTON
    const themeBtn = e.target.closest('#themeToggle');
    if (themeBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        document.body.classList.toggle('dark-theme', currentTheme === 'dark');
        localStorage.setItem('theme', currentTheme);
        
        const icon = document.getElementById('themeIcon') || themeBtn.querySelector('i');
        if (icon) {
            icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        return;
    }

    // 2. ACCESSIBILITY PANEL TOGGLE BUTTON
    const a11yToggle = e.target.closest('#accessibilityToggle');
    if (a11yToggle) {
        e.preventDefault();
        e.stopPropagation();
        const panel = document.getElementById('accessibilityPanel');
        if (panel) panel.classList.toggle('active');
        return;
    }

    // 3. ACCESSIBILITY TOGGLE SWITCHES (High Contrast, Large Text, etc.)
    const a11yItem = e.target.closest('#highContrastToggle, #largeTextToggle, #reducedMotionToggle, #enhancedFocusToggle');
    if (a11yItem) {
        e.preventDefault();
        e.stopPropagation();

        const configMap = {
            'highContrastToggle': { key: 'accessibility-high-contrast', cls: 'high-contrast' },
            'largeTextToggle': { key: 'accessibility-large-text', cls: 'large-text' },
            'reducedMotionToggle': { key: 'accessibility-reduced-motion', cls: 'reduced-motion' },
            'enhancedFocusToggle': { key: 'accessibility-enhanced-focus', cls: 'enhanced-focus' }
        };

        const config = configMap[a11yItem.id];
        if (config) {
            const isActive = a11yItem.classList.toggle('active');
            const switchEl = a11yItem.querySelector('.accessibility-switch');
            if (switchEl) switchEl.classList.toggle('active', isActive);

            document.body.classList.toggle(config.cls, isActive);
            localStorage.setItem(config.key, isActive ? 'true' : 'false');
        }
        return;
    }

    // 4. CLOSE ACCESSIBILITY PANEL ON OUTSIDE CLICK
    const panel = document.getElementById('accessibilityPanel');
    if (panel && panel.classList.contains('active')) {
        if (!e.target.closest('#accessibilityPanel') && !e.target.closest('#accessibilityToggle')) {
            panel.classList.remove('active');
        }
    }
});

