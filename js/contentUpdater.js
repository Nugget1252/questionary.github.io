
// Content Update System for Questionary
// This module handles incremental content updates without requiring full app reinstall

const CONTENT_MANIFEST_URL = 'https://raw.githubusercontent.com/Nugget1252/Questionarytauri/main/content-manifest.json';
const LOCAL_MANIFEST_KEY = 'questionary-local-manifest';
const DOWNLOADED_DOCS_KEY = 'questionary-downloaded-docs';


let contentUpdateState = {
    checking: false,
    downloading: false,
    available: false,
    remoteManifest: null,
    pendingDownloads: [],
    downloadProgress: 0,
    currentFile: '',
    totalFiles: 0,
    completedFiles: 0,
    totalBytes: 0,
    downloadedBytes: 0
};


async function getDownloadedDocsPath() {
    if (window.__TAURI__) {
        const { appDataDir, join } = window.__TAURI__.path;
        const baseDir = await appDataDir();
        return await join(baseDir, 'downloaded_documents');
    }
    return null;
}


async function ensureDownloadDir() {
    if (!window.__TAURI__) return false;
    
    try {
        const { mkdir, exists, BaseDirectory } = window.__TAURI__.fs;
        const dirPath = 'downloaded_documents';
        
        const dirExists = await exists(dirPath, { baseDir: BaseDirectory.AppData });
        if (!dirExists) {
            await mkdir(dirPath, { baseDir: BaseDirectory.AppData, recursive: true });
        }
        return true;
    } catch (error) {
        console.error('Error creating download directory:', error);
        return false;
    }
}


function getLocalManifest() {
    try {
        const data = localStorage.getItem(LOCAL_MANIFEST_KEY);
        return data ? JSON.parse(data) : { version: '0.0.0', documents: {} };
    } catch (e) {
        return { version: '0.0.0', documents: {} };
    }
}


function saveLocalManifest(manifest) {
    localStorage.setItem(LOCAL_MANIFEST_KEY, JSON.stringify(manifest));
}


function getDownloadedDocs() {
    try {
        const data = localStorage.getItem(DOWNLOADED_DOCS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}


function saveDownloadedDocs(docs) {
    localStorage.setItem(DOWNLOADED_DOCS_KEY, JSON.stringify(docs));
}


async function fetchRemoteManifest() {
    try {
        if (window.__TAURI__ && window.__TAURI__.http) {
            const response = await window.__TAURI__.http.fetch(CONTENT_MANIFEST_URL, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } else {
            
            const response = await fetch(CONTENT_MANIFEST_URL + '?t=' + Date.now());
            if (response.ok) {
                return await response.json();
            }
        }
    } catch (error) {
        console.error('Error fetching remote manifest:', error);
    }
    return null;
}


function findPendingDownloads(localManifest, remoteManifest) {
    const pending = [];
    const localDocs = getDownloadedDocs();
    
    
    function traverseDocs(remoteDocs, localDocsMap, pathPrefix = '', baseUrl = '') {
        for (const [key, value] of Object.entries(remoteDocs)) {
            if (value && typeof value === 'object') {
                if (value.file && value.hash !== undefined) {
                    
                    const docKey = pathPrefix + '/' + key;
                    const localDoc = localDocsMap[docKey];
                    
                    
                    if (!localDoc || localDoc.hash !== value.hash) {
                        pending.push({
                            key: docKey,
                            file: value.file,
                            hash: value.hash,
                            size: value.size || 0,
                            url: baseUrl + value.file
                        });
                    }
                } else {
                    
                    traverseDocs(value, localDocsMap, pathPrefix + '/' + key, baseUrl);
                }
            }
        }
    }
    
    if (remoteManifest.documents) {
        traverseDocs(remoteManifest.documents, localDocs, 'documents', remoteManifest.baseUrl || '');
    }
    
    if (remoteManifest.studyMaterials) {
        traverseDocs(remoteManifest.studyMaterials, localDocs, 'studyMaterials', remoteManifest.baseUrl || '');
    }
    
    return pending;
}


async function checkForContentUpdates(silent = false) {
    if (contentUpdateState.checking || contentUpdateState.downloading) {
        return null;
    }
    
    contentUpdateState.checking = true;
    updateContentUpdateUI('checking');
    
    try {
        if (!silent) {
            showNotification('Checking for new content...', 'info');
        }
        
        const remoteManifest = await fetchRemoteManifest();
        
        if (!remoteManifest) {
            contentUpdateState.checking = false;
            updateContentUpdateUI('idle');
            if (!silent) {
                showNotification('Could not check for content updates', 'warning');
            }
            return null;
        }
        
        const localManifest = getLocalManifest();
        const pendingDownloads = findPendingDownloads(localManifest, remoteManifest);
        
        contentUpdateState.remoteManifest = remoteManifest;
        contentUpdateState.pendingDownloads = pendingDownloads;
        
        if (pendingDownloads.length > 0) {
            contentUpdateState.available = true;
            contentUpdateState.totalFiles = pendingDownloads.length;
            contentUpdateState.totalBytes = pendingDownloads.reduce((sum, d) => sum + (d.size || 0), 0);
            
            const sizeText = formatBytesContent(contentUpdateState.totalBytes);
            showNotification(
                `${pendingDownloads.length} new document(s) available (${sizeText}). Click to download.`,
                'success'
            );
            updateContentUpdateUI('available', pendingDownloads.length);
        } else {
            if (!silent) {
                showNotification('All content is up to date!', 'success');
            }
            updateContentUpdateUI('idle');
        }
        
        contentUpdateState.checking = false;
        return pendingDownloads;
        
    } catch (error) {
        console.error('Content update check error:', error);
        contentUpdateState.checking = false;
        updateContentUpdateUI('idle');
        if (!silent) {
            showNotification('Error checking for content updates', 'error');
        }
        return null;
    }
}


async function downloadFile(url, filename) {
    if (!window.__TAURI__) {
        console.log('Downloads only work in Tauri app');
        return null;
    }
    
    try {
        const { writeBinaryFile, BaseDirectory } = window.__TAURI__.fs;
        
        
        const response = await window.__TAURI__.http.fetch(url, {
            method: 'GET',
            responseType: 3 
        });
        
        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
        }
        
        const data = response.data;
        
        
        const filePath = `downloaded_documents/${filename}`;
        await writeBinaryFile(filePath, data, { baseDir: BaseDirectory.AppData });
        
        return filePath;
    } catch (error) {
        console.error(`Error downloading ${filename}:`, error);
        throw error;
    }
}


async function downloadContentUpdates() {
    if (contentUpdateState.downloading || contentUpdateState.pendingDownloads.length === 0) {
        return;
    }
    
    contentUpdateState.downloading = true;
    contentUpdateState.completedFiles = 0;
    contentUpdateState.downloadedBytes = 0;
    
    updateContentUpdateUI('downloading');
    showNotification('Downloading new content...', 'info');
    
    
    await ensureDownloadDir();
    
    const downloadedDocs = getDownloadedDocs();
    const localManifest = getLocalManifest();
    const pending = [...contentUpdateState.pendingDownloads];
    
    for (const item of pending) {
        contentUpdateState.currentFile = item.file;
        updateContentDownloadProgress();
        
        try {
            const savedPath = await downloadFile(item.url, item.file);
            
            if (savedPath) {
                
                downloadedDocs[item.key] = {
                    file: item.file,
                    hash: item.hash,
                    localPath: savedPath,
                    downloadedAt: new Date().toISOString()
                };
                
                contentUpdateState.completedFiles++;
                contentUpdateState.downloadedBytes += item.size || 0;
                updateContentDownloadProgress();
            }
        } catch (error) {
            console.error(`Failed to download ${item.file}:`, error);
            
        }
    }
    
    
    saveDownloadedDocs(downloadedDocs);
    localManifest.version = contentUpdateState.remoteManifest?.version || localManifest.version;
    localManifest.lastUpdated = new Date().toISOString();
    saveLocalManifest(localManifest);
    
    
    contentUpdateState.downloading = false;
    contentUpdateState.available = false;
    contentUpdateState.pendingDownloads = [];
    
    
    mergeDownloadedDocuments();
    
    showNotification(
        `Downloaded ${contentUpdateState.completedFiles} new document(s)!`,
        'success'
    );
    updateContentUpdateUI('idle');
    
    
    if (typeof renderTiles === 'function' && path.length > 0) {
        let current = documents;
        for (const p of path) {
            if (current[p]) current = current[p];
        }
        renderTiles(current);
    }
}


async function mergeDownloadedDocuments() {
    const downloadedDocs = getDownloadedDocs();
    
    
    let appDataPath = '';
    if (window.__TAURI__ && window.__TAURI__.path) {
        try {
            appDataPath = await window.__TAURI__.path.appDataDir();
        } catch (e) {
            console.log('Could not get app data path:', e);
        }
    }
    
    for (const [key, doc] of Object.entries(downloadedDocs)) {
        const parts = key.split('/').filter(p => p);
        
        if (parts[0] === 'documents' && parts.length >= 5) {
            
            const [, year, cls, exam, subject] = parts;
            
            
            if (!documents[year]) documents[year] = {};
            if (!documents[year][cls]) documents[year][cls] = {};
            if (!documents[year][cls][exam]) documents[year][cls][exam] = {};
            
            
            if (window.__TAURI__ && window.__TAURI__.core && appDataPath) {
                const { convertFileSrc } = window.__TAURI__.core;
                const fullPath = appDataPath + 'downloaded_documents/' + doc.file;
                documents[year][cls][exam][subject] = convertFileSrc(fullPath);
            } else {
                documents[year][cls][exam][subject] = `downloaded_documents/${doc.file}`;
            }
        }
    }
}


function updateContentUpdateUI(state, count = 0) {
    const btn = document.getElementById('contentUpdateBtn');
    if (!btn) return;
    
    btn.classList.remove('checking', 'available', 'downloading');
    
    switch (state) {
        case 'checking':
            btn.classList.add('checking');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.title = 'Checking for new content...';
            break;
        case 'available':
            btn.classList.add('available');
            btn.innerHTML = `<i class="fas fa-cloud-download-alt"></i><span class="content-badge">${count}</span>`;
            btn.title = `${count} new document(s) available - click to download`;
            break;
        case 'downloading':
            btn.classList.add('downloading');
            btn.innerHTML = '<i class="fas fa-download"></i>';
            btn.title = 'Downloading content...';
            showContentProgressBar();
            break;
        default:
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i>';
            btn.title = 'Check for new content';
            hideContentProgressBar();
    }
}

function updateContentDownloadProgress() {
    const progressFill = document.getElementById('contentProgressFill');
    const progressText = document.getElementById('contentProgressText');
    
    const progress = contentUpdateState.totalFiles > 0 
        ? Math.round((contentUpdateState.completedFiles / contentUpdateState.totalFiles) * 100)
        : 0;
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${contentUpdateState.completedFiles}/${contentUpdateState.totalFiles} files (${contentUpdateState.currentFile})`;
    }
}

function showContentProgressBar() {
    const progressBar = document.getElementById('contentProgressBar');
    if (progressBar) {
        progressBar.style.display = 'block';
    }
}

function hideContentProgressBar() {
    const progressBar = document.getElementById('contentProgressBar');
    if (progressBar) {
        progressBar.style.display = 'none';
    }
    const progressFill = document.getElementById('contentProgressFill');
    if (progressFill) {
        progressFill.style.width = '0%';
    }
}

function formatBytesContent(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}


async function handleContentUpdateClick() {
    
    if (contentUpdateState.downloading) {
        const progress = contentUpdateState.totalFiles > 0 
            ? Math.round((contentUpdateState.completedFiles / contentUpdateState.totalFiles) * 100)
            : 0;
        showNotification(
            `Downloading: ${progress}% (${contentUpdateState.currentFile})`,
            'info'
        );
        return;
    }
    
    
    if (window.codeUpdateState && window.codeUpdateState.downloading) {
        showNotification('Downloading code updates...', 'info');
        return;
    }
    
    
    if (contentUpdateState.available && contentUpdateState.pendingDownloads.length > 0) {
        await downloadContentUpdates();
        return;
    }
    
    
    if (window.codeUpdateState && window.codeUpdateState.available && 
        window.codeUpdateState.pendingUpdates && window.codeUpdateState.pendingUpdates.length > 0) {
        if (window.hotCodeUpdater && typeof window.hotCodeUpdater.download === 'function') {
            await window.hotCodeUpdater.download();
        }
        return;
    }
    
    
    await checkForAllUpdates();
}


async function checkForAllUpdates(silent = false) {
    if (!silent) {
        showNotification('Checking for updates...', 'info');
    }
    updateContentUpdateUI('checking');
    
    let totalUpdates = 0;
    
    
    const contentUpdates = await checkForContentUpdates(true);
    if (contentUpdates && contentUpdates.length > 0) {
        totalUpdates += contentUpdates.length;
    }
    
    
    if (window.hotCodeUpdater && typeof window.hotCodeUpdater.check === 'function') {
        const codeUpdates = await window.hotCodeUpdater.check(true);
        if (codeUpdates && codeUpdates.length > 0) {
            totalUpdates += codeUpdates.length;
        }
    }
    
    
    if (totalUpdates > 0) {
        showNotification(
            `${totalUpdates} update(s) available! Click to download.`,
            'success'
        );
        updateContentUpdateUI('available', totalUpdates);
    } else {
        if (!silent) {
            showNotification('Everything is up to date!', 'success');
        }
        updateContentUpdateUI('idle');
    }
    
    return totalUpdates;
}


async function initContentUpdateSystem() {
    // Load any previously downloaded documents
    await mergeDownloadedDocuments();
    
    // Setup button handler
    const btn = document.getElementById('contentUpdateBtn');
    if (btn && !btn.dataset.contentInitialized) {
        btn.dataset.contentInitialized = 'true';
        btn.addEventListener('click', handleContentUpdateClick);
    }
    
    // Auto-check and auto-download after delay
    setTimeout(async () => {
        // Check for content updates
        const contentPending = await checkForContentUpdates(true);
        
        // Auto-download content if available
        if (contentPending > 0) {
            console.log(`[ContentUpdater] Auto-downloading ${contentPending} content files...`);
            if (typeof showNotification === 'function') {
                showNotification(`Downloading ${contentPending} content update(s)...`, 'info');
            }
            await downloadContentUpdates();
        }
        
        // Also check for code updates via hotUpdater
        if (window.hotCodeUpdater && typeof window.hotCodeUpdater.check === 'function') {
            const codeUpdates = await window.hotCodeUpdater.check(true);
            if (codeUpdates && codeUpdates.length > 0) {
                console.log(`[ContentUpdater] Triggering code updates download...`);
                await window.hotCodeUpdater.download();
            }
        }
    }, 12000); 
}


window.contentUpdateSystem = {
    check: checkForContentUpdates,
    checkAll: checkForAllUpdates,
    download: downloadContentUpdates,
    handleClick: handleContentUpdateClick,
    init: initContentUpdateSystem,
    getState: () => contentUpdateState,
    mergeDownloaded: mergeDownloadedDocuments
};
