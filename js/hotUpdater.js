

(function() {
    'use strict';
    
    const CODE_MANIFEST_URL = 'https://raw.githubusercontent.com/Nugget1252/Questionarytauri/main/code-manifest.json';
    const CODE_MANIFEST_KEY = 'questionary-code-manifest';
    const CODE_FILES_KEY = 'questionary-code-files';
    
    // Bundled file versions - must match paths in code-manifest.json
    // Set to 0.4.0 so manifest version 0.4.1+ will trigger auto-download
    const BUNDLED_VERSIONS = {
        'js/app.js': '0.4.0',
        'css/styles.css': '0.4.0',
        'js/contentUpdater.js': '0.4.0',
        'js/hotUpdater.js': '0.4.0'
    };
    

    window.codeUpdateState = {
        checking: false,
        downloading: false,
        available: false,
        pendingUpdates: [],
        remoteManifest: null
    };
    

    function getLocalCodeManifest() {
        try {
            const data = localStorage.getItem(CODE_MANIFEST_KEY);
            return data ? JSON.parse(data) : { version: '0.0.0', files: {} };
        } catch (e) {
            return { version: '0.0.0', files: {} };
        }
    }
    

    function saveLocalCodeManifest(manifest) {
        localStorage.setItem(CODE_MANIFEST_KEY, JSON.stringify(manifest));
    }
    

    function getStoredCodeFiles() {
        try {
            const data = localStorage.getItem(CODE_FILES_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }
    
    function saveStoredCodeFiles(files) {
        localStorage.setItem(CODE_FILES_KEY, JSON.stringify(files));
    }
    
 
    function hasNewerVersion(filename) {
        const stored = getStoredCodeFiles();
        const localManifest = getLocalCodeManifest();
        
        if (stored[filename] && localManifest.files && localManifest.files[filename]) {
            const storedVersion = localManifest.files[filename].version;
            const bundledVersion = BUNDLED_VERSIONS[filename] || '0.0.0';
            return compareVersions(storedVersion, bundledVersion) > 0;
        }
        return false;
    }
    
    
    function compareVersions(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
        }
        return 0;
    }
    
    function loadStoredCSS(filename) {
        // Disabled: let the actual CSS files load from disk/server instead of localStorage cache
        console.log(`[HotUpdate] Skipping stored CSS for ${filename} — using live file`);
        return false;
    }
    
    function loadStoredJS(filename) {
        const stored = getStoredCodeFiles();
        if (stored[filename]) {
            console.log(`[HotUpdate] Loading updated JS: ${filename}`);
            try {
                const blob = new Blob([stored[filename]], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const script = document.createElement('script');
                script.src = url;
                script.id = `hotupdate-${filename.replace('.', '-')}`;
                document.body.appendChild(script);
                return true;
            } catch (e) {
                console.error(`[HotUpdate] Error loading ${filename}:`, e);
            }
        }
        return false;
    }
    
    async function fetchCodeManifest() {
        try {
            const response = await fetch(CODE_MANIFEST_URL + '?t=' + Date.now());
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log('[HotUpdate] Could not fetch code manifest:', error.message);
        }
        return null;
    }
    
    async function fetchCodeFile(url) {
        try {
            const response = await fetch(url + '?t=' + Date.now());
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.error('[HotUpdate] Error fetching file:', error);
        }
        return null;
    }
    
    async function checkForCodeUpdates(silent = false) {
        if (window.codeUpdateState.checking || window.codeUpdateState.downloading) {
            return null;
        }
        
        window.codeUpdateState.checking = true;
        
        try {
            const remoteManifest = await fetchCodeManifest();
            
            if (!remoteManifest || !remoteManifest.files) {
                window.codeUpdateState.checking = false;
                return null;
            }
            
            const localManifest = getLocalCodeManifest();
            const pendingUpdates = [];
            
            for (const [filename, fileInfo] of Object.entries(remoteManifest.files)) {
                const localVersion = localManifest.files?.[filename]?.version || BUNDLED_VERSIONS[filename] || '0.0.0';
                const remoteVersion = fileInfo.version;
                
                if (compareVersions(remoteVersion, localVersion) > 0) {
                    pendingUpdates.push({
                        filename,
                        version: remoteVersion,
                        url: fileInfo.url || `${remoteManifest.baseUrl}${filename}`,
                        hash: fileInfo.hash,
                        size: fileInfo.size || 0,
                        type: fileInfo.type || (filename.endsWith('.css') ? 'css' : 'js')
                    });
                }
            }
            
            window.codeUpdateState.remoteManifest = remoteManifest;
            window.codeUpdateState.pendingUpdates = pendingUpdates;
            
            if (pendingUpdates.length > 0) {
                window.codeUpdateState.available = true;
                console.log(`[HotUpdate] ${pendingUpdates.length} code update(s) available`);
                
                if (!silent && typeof showNotification === 'function') {
                    showNotification(
                        `${pendingUpdates.length} code update(s) available. Click the update button to apply.`,
                        'info'
                    );
                }
                
                updateCodeUpdateUI('available', pendingUpdates.length);
            } else {
                if (!silent) {
                    console.log('[HotUpdate] Code is up to date');
                }
            }
            
            window.codeUpdateState.checking = false;
            return pendingUpdates;
            
        } catch (error) {
            console.error('[HotUpdate] Error checking for updates:', error);
            window.codeUpdateState.checking = false;
            return null;
        }
    }
    
    async function downloadCodeUpdates() {
        if (window.codeUpdateState.downloading || window.codeUpdateState.pendingUpdates.length === 0) {
            return;
        }
        
        window.codeUpdateState.downloading = true;
        updateCodeUpdateUI('downloading');
        
        const storedFiles = getStoredCodeFiles();
        const localManifest = getLocalCodeManifest();
        if (!localManifest.files) localManifest.files = {};
        
        let successCount = 0;
        let requiresReload = false;
        
        for (const update of window.codeUpdateState.pendingUpdates) {
            console.log(`[HotUpdate] Downloading ${update.filename}...`);
            
            try {
                const content = await fetchCodeFile(update.url);
                
                if (content) {
                    storedFiles[update.filename] = content;
                    localManifest.files[update.filename] = {
                        version: update.version,
                        hash: update.hash,
                        updatedAt: new Date().toISOString()
                    };
                    successCount++;
                    
                    if (update.type === 'css') {
                        applyHotCSS(update.filename, content);
                    } else {
                        requiresReload = true;
                    }
                }
            } catch (error) {
                console.error(`[HotUpdate] Failed to download ${update.filename}:`, error);
            }
        }
        
        saveStoredCodeFiles(storedFiles);
        localManifest.version = window.codeUpdateState.remoteManifest?.version || localManifest.version;
        saveLocalCodeManifest(localManifest);
        
        window.codeUpdateState.downloading = false;
        window.codeUpdateState.available = false;
        window.codeUpdateState.pendingUpdates = [];
        
        updateCodeUpdateUI('idle');

    
    function applyHotCSS(filename, content) {
        // Disabled: let the actual CSS files load from disk/server
        console.log(`[HotUpdate] Skipping hot CSS apply for ${filename} — using live file`);
    }
    

    
    function updateCodeUpdateUI(state, count = 0) {
        const btn = document.getElementById('contentUpdateBtn');
        if (!btn) return;
        
        btn.classList.remove('checking', 'available', 'downloading');
        
        switch (state) {
            case 'checking':
                btn.classList.add('checking');
                btn.title = 'Checking for updates...';
                break;
            case 'available':
                btn.classList.add('available');
                btn.title = `${count} update(s) available - click to download`;
                let badge = btn.querySelector('.content-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'content-badge';
                    btn.appendChild(badge);
                }
                badge.textContent = count;
                break;
            case 'downloading':
                btn.classList.add('downloading');
                btn.title = 'Downloading updates...';
                break;
            default:
                btn.title = 'Check for updates';
                const existingBadge = btn.querySelector('.content-badge');
                if (existingBadge) existingBadge.remove();
        }
    }
    
    function applyStoredUpdates() {
        const storedFiles = getStoredCodeFiles();
        const localManifest = getLocalCodeManifest();
        
        for (const [filename, content] of Object.entries(storedFiles)) {
            const storedVersion = localManifest.files?.[filename]?.version || '0.0.0';
            const bundledVersion = BUNDLED_VERSIONS[filename] || '0.0.0';
            
            if (compareVersions(storedVersion, bundledVersion) > 0) {
                if (filename.endsWith('.css')) {
                    loadStoredCSS(filename);
                }
            }
        }
    }
    
    // Initialize and auto-check/download updates
    async function initHotUpdater() {
        applyStoredUpdates();
        
        // Auto-check and auto-download after delay
        setTimeout(async () => {
            const updates = await checkForCodeUpdates(true);
            // Auto-download if updates found
            if (updates && updates.length > 0) {
                console.log('[HotUpdate] Auto-downloading code updates...');
                await downloadCodeUpdates();
            }
        }, 10000);
    }
    
    window.hotCodeUpdater = {
        check: checkForCodeUpdates,
        download: downloadCodeUpdates,
        applyStored: applyStoredUpdates,
        init: initHotUpdater,
        getState: () => window.codeUpdateState,
        hasNewerVersion,
        getStoredCodeFiles,
        BUNDLED_VERSIONS
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHotUpdater);
    } else {
        initHotUpdater();
    }
})();
