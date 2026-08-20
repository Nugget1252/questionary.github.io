
// ============================================
// QUESTIONARY ENHANCED FEATURES MODULE
// Complete Local-First Desktop & Web Engine
// ============================================

// Global Drop Target Tracker for Tauri Native Drop Events
window.activeDropTargetFolderId = null;

// Utility & Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatBytesContent(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime12Hour(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

function showConfirm(message, opts = {}) {
    if (typeof window.showConfirm === 'function') {
        return window.showConfirm(message, opts);
    }
    return Promise.resolve(window.confirm(message));
}

function showPrompt(message, opts = {}) {
    if (typeof window.showPrompt === 'function') {
        return window.showPrompt(message, opts);
    }
    return Promise.resolve(window.prompt(message, opts.defaultValue || ''));
}

// Convert any Blob / File object to Uint8Array safely across all WebViews
function fileToUint8Array(file) {
    return new Promise((resolve, reject) => {
        if (file instanceof Uint8Array) {
            resolve(file);
            return;
        }
        if (file && typeof file.arrayBuffer === 'function') {
            file.arrayBuffer()
                .then(buf => resolve(new Uint8Array(buf)))
                .catch(() => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(new Uint8Array(reader.result));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(file);
                });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

function clearDragHoverStyles() {
    document.querySelectorAll('.drag-target-hover, .drag-over, .is-dragging').forEach(el => {
        el.classList.remove('drag-target-hover', 'drag-over', 'is-dragging');
    });
}

// Injected styles for In-App Drag and Drop & Multi-Document Reader
(function injectLibraryDragStyles() {
    if (document.getElementById('library-drag-styles')) return;
    const style = document.createElement('style');
    style.id = 'library-drag-styles';
    style.textContent = `
        .library-item.is-dragging {
            opacity: 0.45;
            transform: scale(0.96);
        }
        .library-item.drag-target-hover,
        .breadcrumb-item.drag-target-hover {
            outline: 2px dashed var(--accent, #cf6215) !important;
            outline-offset: 3px;
            background: rgba(207, 98, 21, 0.15) !important;
            border-radius: 8px;
        }
        .library-drop-zone.drag-over {
            border-color: var(--accent, #cf6215) !important;
            background: rgba(207, 98, 21, 0.1) !important;
        }
        .doc-viewer-body {
            background: var(--surface, #ffffff);
            color: var(--fg, #18181b);
            padding: 2rem;
            border-radius: 12px;
            border: 1px solid var(--line, #e4e4e7);
            max-height: calc(100vh - 200px);
            overflow-y: auto;
            font-size: 0.95rem;
            line-height: 1.6;
        }
        .doc-viewer-body pre {
            background: var(--bg, #f7f7f8);
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'JetBrains Mono', monospace;
        }
        .docx-rendered-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }
        .docx-rendered-content th, .docx-rendered-content td {
            border: 1px solid var(--line, #e4e4e7);
            padding: 8px 12px;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
})();

// Helper to determine file category
function getFileTypeCategory(fileName) {
    if (!fileName) return 'other';
    const ext = fileName.toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['md', 'markdown', 'txt', 'json', 'csv', 'log', 'js', 'py', 'html', 'css', 'xml', 'yaml', 'yml'].includes(ext)) return 'text';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    return 'other';
}

// ============================================
// 1. PDF BOOKMARKS & PAGE TRACKING
// ============================================
var pdfBookmarks = window.pdfBookmarks || JSON.parse(localStorage.getItem('questionary-pdf-bookmarks') || '{}');
window.pdfBookmarks = pdfBookmarks;
var currentPdfUrl = window.currentPdfUrl || null;

function savePdfBookmarks() {
    localStorage.setItem('questionary-pdf-bookmarks', JSON.stringify(pdfBookmarks));
}

function addPdfBookmark(pdfUrl, pageNumber, title = '') {
    if (!pdfUrl) return null;
    if (!pdfBookmarks[pdfUrl]) {
        pdfBookmarks[pdfUrl] = [];
    }
    
    const bookmark = {
        id: Date.now().toString(),
        page: pageNumber,
        title: title || `Page ${pageNumber}`,
        createdAt: new Date().toISOString()
    };
    
    pdfBookmarks[pdfUrl].push(bookmark);
    savePdfBookmarks();
    showNotification(`Bookmark added: ${bookmark.title}`, 'success');
    renderPdfBookmarks(pdfUrl);
    
    const panel = document.getElementById('pdfBookmarksPanel');
    if (panel) panel.style.display = 'block';
    return bookmark;
}

function removePdfBookmark(pdfUrl, bookmarkId) {
    if (pdfBookmarks[pdfUrl]) {
        pdfBookmarks[pdfUrl] = pdfBookmarks[pdfUrl].filter(b => b.id !== bookmarkId);
        savePdfBookmarks();
        renderPdfBookmarks(pdfUrl);
        showNotification('Bookmark removed', 'info');
    }
}

function getPdfBookmarks(pdfUrl) {
    return pdfBookmarks[pdfUrl] || [];
}

function renderPdfBookmarks(pdfUrl) {
    const container = document.getElementById('pdfBookmarksList');
    if (!container) return;
    
    const bookmarks = getPdfBookmarks(pdfUrl);
    
    if (bookmarks.length === 0) {
        container.innerHTML = '<p class="empty-state">No bookmarks yet. Click "Add Bookmark" while viewing a PDF.</p>';
        return;
    }
    
    container.innerHTML = bookmarks.map(b => `
        <div class="bookmark-item" data-page="${b.page}">
            <i class="fas fa-bookmark"></i>
            <span class="bookmark-title">${escapeHtml(b.title)}</span>
            <span class="bookmark-page">Page ${b.page}</span>
            <button class="bookmark-delete" onclick="event.stopPropagation(); removePdfBookmark('${pdfUrl}', '${b.id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    container.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-delete')) {
                const page = parseInt(item.dataset.page, 10);
                goToPdfPage(page);
            }
        });
    });
}

function goToPdfPage(pageNumber) {
    const iframe = document.getElementById('pdfViewer');
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'goToPage', page: pageNumber }, '*');
    showNotification(`Navigating to page ${pageNumber}`, 'info');
}

function openBookmarkModal() {
    const modal = document.getElementById('bookmarkModal');
    if (modal) {
        modal.classList.add('active');
        const titleInput = document.getElementById('bookmarkTitleInput');
        const pageInput = document.getElementById('bookmarkPageInput');
        if (titleInput) titleInput.value = '';
        if (pageInput) pageInput.value = '1';
    }
}

function closeBookmarkModal() {
    const modal = document.getElementById('bookmarkModal');
    if (modal) modal.classList.remove('active');
}

function saveBookmarkFromModal() {
    const title = document.getElementById('bookmarkTitleInput')?.value.trim();
    const page = parseInt(document.getElementById('bookmarkPageInput')?.value, 10) || 1;
    
    if (!title) {
        showNotification('Please enter a bookmark title', 'warning');
        return;
    }
    
    const pdfUrl = currentPdfUrl || window.currentPdfUrlForBookmarks;
    if (pdfUrl) {
        addPdfBookmark(pdfUrl, page, title);
        closeBookmarkModal();
    } else {
        showNotification('No PDF currently open', 'error');
    }
}

function toggleBookmarksPanel() {
    const panel = document.getElementById('pdfBookmarksPanel');
    if (panel) {
        const isHidden = panel.style.display === 'none' || !panel.style.display;
        panel.style.display = isHidden ? 'block' : 'none';
    }
}

function openPdfViewer(pdfUrl, pdfName) {
    currentPdfUrl = pdfUrl;
    window.currentPdfUrlForBookmarks = pdfUrl;
    
    const container = document.getElementById('pdfViewerContainer');
    const tilesContainer = document.getElementById('tilesContainer');
    const pdfViewer = document.getElementById('pdfViewer');
    const pdfNameEl = document.getElementById('currentPdfName');
    
    if (container && pdfViewer) {
        if (tilesContainer) tilesContainer.style.display = 'none';
        container.style.display = 'block';
        const absoluteUrl = new URL(pdfUrl, window.location.href).href;
        pdfViewer.src = 'pdfviewer.html?file=' + encodeURIComponent(absoluteUrl);
        pdfViewer.onload = function() {
            pdfViewer.contentWindow.postMessage({ type: 'loadPdf', url: absoluteUrl }, '*');
            pdfViewer.onload = null;
        };
        if (pdfNameEl) pdfNameEl.textContent = pdfName || 'Document';
        renderPdfBookmarks(pdfUrl);
    }
}

function closePdfViewer() {
    const container = document.getElementById('pdfViewerContainer');
    const tilesContainer = document.getElementById('tilesContainer');
    const pdfViewer = document.getElementById('pdfViewer');
    
    if (container && pdfViewer) {
        container.style.display = 'none';
        if (tilesContainer) tilesContainer.style.display = 'grid';
        pdfViewer.src = '';
        currentPdfUrl = null;
        window.currentPdfUrlForBookmarks = null;
    }
}

// ============================================
// 2. TEXT, MARKDOWN, DOCX & IMAGE VIEWERS
// ============================================
var _currentTextRaw = window._currentTextRaw || '';
var _currentTextName = window._currentTextName || '';
var _currentDocxBlob = window._currentDocxBlob || null;
var _currentDocxName = window._currentDocxName || '';

async function showTextFile(urlOrBlob, fileName) {
    _currentTextName = fileName || 'Document.txt';
    const container = document.getElementById('textViewerContainer');
    const body = document.getElementById('textViewerBody');
    const nameEl = document.getElementById('currentTextName');
    const tilesContainer = document.getElementById('tilesContainer');
    const sectionHeader = document.querySelector('#tilesSection .section-header');

    if (nameEl) nameEl.textContent = _currentTextName;

    try {
        let text = '';
        if (typeof urlOrBlob === 'string' && urlOrBlob.startsWith('blob-id:')) {
            const blobId = urlOrBlob.replace('blob-id:', '');
            const blob = await UserLibraryFileStore.getFileBlob(blobId);
            text = await blob.text();
        } else if (urlOrBlob instanceof Blob) {
            text = await urlOrBlob.text();
        } else if (typeof urlOrBlob === 'string') {
            const res = await fetch(urlOrBlob);
            text = await res.text();
        }

        _currentTextRaw = text;
        const ext = _currentTextName.toLowerCase().split('.').pop();

        if ((ext === 'md' || ext === 'markdown') && typeof window.marked !== 'undefined') {
            body.innerHTML = window.marked.parse(text);
        } else if (ext === 'json') {
            try {
                const parsed = JSON.parse(text);
                body.innerHTML = `<pre><code>${escapeHtml(JSON.stringify(parsed, null, 2))}</code></pre>`;
            } catch (e) {
                body.innerHTML = `<pre><code>${escapeHtml(text)}</code></pre>`;
            }
        } else {
            body.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(text)}</pre>`;
        }

        if (container) container.style.display = 'block';
        if (tilesContainer) tilesContainer.style.display = 'none';
        if (sectionHeader) sectionHeader.style.display = 'none';
    } catch (err) {
        showNotification('Failed to read text file', 'error');
        console.error(err);
    }
}

function closeTextViewer() {
    const container = document.getElementById('textViewerContainer');
    const tilesContainer = document.getElementById('tilesContainer');
    const sectionHeader = document.querySelector('#tilesSection .section-header');
    if (container) container.style.display = 'none';
    if (tilesContainer) {
        const isListView = tilesContainer.classList.contains('list-view');
        tilesContainer.style.display = isListView ? 'flex' : 'grid';
    }
    if (sectionHeader) sectionHeader.style.display = 'flex';
}

function copyTextViewerContent() {
    if (_currentTextRaw) {
        navigator.clipboard.writeText(_currentTextRaw).then(() => {
            showNotification('Content copied to clipboard!', 'success');
        });
    }
}

function downloadTextContent() {
    if (!_currentTextRaw) return;
    const blob = new Blob([_currentTextRaw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _currentTextName || 'document.txt';
    a.click();
    URL.revokeObjectURL(url);
}

async function showDocxFile(urlOrBlob, fileName) {
    _currentDocxName = fileName || 'Document.docx';
    const container = document.getElementById('docxViewerContainer');
    const body = document.getElementById('docxViewerBody');
    const nameEl = document.getElementById('currentDocxName');
    const tilesContainer = document.getElementById('tilesContainer');
    const sectionHeader = document.querySelector('#tilesSection .section-header');

    if (nameEl) nameEl.textContent = _currentDocxName;

    try {
        let arrayBuffer = null;
        if (typeof urlOrBlob === 'string' && urlOrBlob.startsWith('blob-id:')) {
            const blobId = urlOrBlob.replace('blob-id:', '');
            const blob = await UserLibraryFileStore.getFileBlob(blobId);
            _currentDocxBlob = blob;
            arrayBuffer = await blob.arrayBuffer();
        } else if (urlOrBlob instanceof Blob) {
            _currentDocxBlob = urlOrBlob;
            arrayBuffer = await urlOrBlob.arrayBuffer();
        } else if (typeof urlOrBlob === 'string') {
            const res = await fetch(urlOrBlob);
            const blob = await res.blob();
            _currentDocxBlob = blob;
            arrayBuffer = await blob.arrayBuffer();
        }

        if (typeof window.mammoth !== 'undefined') {
            body.innerHTML = '<p class="empty-state">Rendering Word Document...</p>';
            const result = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            body.innerHTML = result.value || '<p class="empty-state">Document is empty.</p>';
        } else {
            body.innerHTML = '<p class="empty-state">Mammoth.js library unavailable. Download the file to view.</p>';
        }

        if (container) container.style.display = 'block';
        if (tilesContainer) tilesContainer.style.display = 'none';
        if (sectionHeader) sectionHeader.style.display = 'none';
    } catch (err) {
        showNotification('Failed to render Word document', 'error');
        console.error(err);
    }
}

function closeDocxViewer() {
    const container = document.getElementById('docxViewerContainer');
    const tilesContainer = document.getElementById('tilesContainer');
    const sectionHeader = document.querySelector('#tilesSection .section-header');
    if (container) container.style.display = 'none';
    if (tilesContainer) {
        const isListView = tilesContainer.classList.contains('list-view');
        tilesContainer.style.display = isListView ? 'flex' : 'grid';
    }
    if (sectionHeader) sectionHeader.style.display = 'flex';
}

function downloadDocxContent() {
    if (!_currentDocxBlob) return;
    const url = URL.createObjectURL(_currentDocxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _currentDocxName || 'document.docx';
    a.click();
    URL.revokeObjectURL(url);
}

/* Top/Middle of js/features.js */
async function openAnyDocument(urlOrBlob, fileName) {
    const category = getFileTypeCategory(fileName);
    if (category === 'image') {
        let src = urlOrBlob;
        if (typeof urlOrBlob === 'string' && urlOrBlob.startsWith('blob-id:')) {
            const blobId = urlOrBlob.replace('blob-id:', '');
            const blob = await UserLibraryFileStore.getFileBlob(blobId);
            src = URL.createObjectURL(blob);
        } else if (urlOrBlob instanceof Blob) {
            src = URL.createObjectURL(urlOrBlob);
        }
        if (typeof window.showImage === 'function') window.showImage(src, fileName);
    } else if (category === 'text') {
        await showTextFile(urlOrBlob, fileName);
    } else if (category === 'docx') {
        await showDocxFile(urlOrBlob, fileName);
    } else {
        // PDF handler
        let pdfSrc = urlOrBlob;
        if (typeof urlOrBlob === 'string' && urlOrBlob.startsWith('blob-id:')) {
            const blobId = urlOrBlob.replace('blob-id:', '');
            const blob = await UserLibraryFileStore.getFileBlob(blobId);
            if (blob) {
                pdfSrc = URL.createObjectURL(blob);
            }
        } else if (urlOrBlob instanceof Blob) {
            pdfSrc = URL.createObjectURL(urlOrBlob);
        }
        
        // Pass the actual fileName to showPDF so it displays properly!
        if (typeof window.showPDF === 'function') {
            await window.showPDF(pdfSrc, fileName);
        }
    }
}

function closePdfViewer() {
    // Sync with closePDF
    if (typeof window.closePDF === 'function') {
        window.closePDF();
    } else {
        document.body.classList.remove('pdf-view-active');
        const container = document.getElementById('pdfViewerContainer');
        const tilesContainer = document.getElementById('tilesContainer');
        const pdfViewer = document.getElementById('pdfViewer');
        if (container) container.style.display = 'none';
        if (tilesContainer) tilesContainer.style.display = 'grid';
        if (pdfViewer) pdfViewer.src = '';
    }
}
// ============================================
// 3. PDF ANNOTATIONS & HIGHLIGHTING
// ============================================
var pdfAnnotations = window.pdfAnnotations || JSON.parse(localStorage.getItem('questionary-pdf-annotations') || '{}');
window.pdfAnnotations = pdfAnnotations;

function savePdfAnnotations() {
    localStorage.setItem('questionary-pdf-annotations', JSON.stringify(pdfAnnotations));
}

function addPdfAnnotation(pdfUrl, annotation) {
    if (!pdfAnnotations[pdfUrl]) {
        pdfAnnotations[pdfUrl] = [];
    }
    
    const newAnnotation = {
        id: Date.now().toString(),
        type: annotation.type || 'highlight',
        color: annotation.color || '#ffeb3b',
        text: annotation.text || '',
        note: annotation.note || '',
        page: annotation.page,
        position: annotation.position,
        createdAt: new Date().toISOString()
    };
    
    pdfAnnotations[pdfUrl].push(newAnnotation);
    savePdfAnnotations();
    return newAnnotation;
}

function getPdfAnnotations(pdfUrl) {
    return pdfAnnotations[pdfUrl] || [];
}

function deletePdfAnnotation(pdfUrl, annotationId) {
    if (pdfAnnotations[pdfUrl]) {
        pdfAnnotations[pdfUrl] = pdfAnnotations[pdfUrl].filter(a => a.id !== annotationId);
        savePdfAnnotations();
    }
}

// ============================================
// 4. QUIZ MODE FROM FLASHCARDS
// ============================================
var quizState = window.quizState || {
    active: false,
    deckId: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    answers: [],
    mode: 'multiple-choice',
    startTime: null,
    timeLimit: null
};
window.quizState = quizState;

function startQuiz(deckId, mode = 'multiple-choice', timeLimit = null) {
    const decks = window.flashcardDecks || JSON.parse(localStorage.getItem('questionary-flashcards') || '[]');
    const deck = decks.find(d => d.id === deckId);
    if (!deck || !deck.cards || deck.cards.length < 2) {
        showNotification('Need at least 2 cards to start a quiz', 'warning');
        return;
    }
    
    quizState = {
        active: true,
        deckId: deckId,
        questions: shuffleArray([...deck.cards]),
        currentIndex: 0,
        score: 0,
        answers: [],
        mode: mode,
        startTime: Date.now(),
        timeLimit: timeLimit
    };
    
    showQuizModal();
    renderQuizQuestion();
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function renderQuizQuestion() {
    const container = document.getElementById('quizContent');
    if (!container || !quizState.active) return;
    
    const question = quizState.questions[quizState.currentIndex];
    const progress = ((quizState.currentIndex + 1) / quizState.questions.length) * 100;
    
    let answersHtml = '';
    
    if (quizState.mode === 'multiple-choice') {
        const questionKey = question.front + '|||' + question.back;
        const otherCards = quizState.questions.filter(q => (q.front + '|||' + q.back) !== questionKey);
        const wrongAnswers = otherCards.slice(0, 3).map(q => q.back);
        const allAnswers = shuffleArray([question.back, ...wrongAnswers]);
        
        answersHtml = `
            <div class="quiz-options">
                ${allAnswers.map((answer, i) => `
                    <button class="quiz-option" data-answer="${escapeHtml(answer)}">
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(answer)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    } else if (quizState.mode === 'type-answer') {
        answersHtml = `
            <div class="quiz-type-answer">
                <input type="text" id="quizAnswerInput" class="quiz-answer-input" placeholder="Type your answer..." autofocus>
                <button class="btn btn-primary" onclick="submitTypedAnswer()">
                    <i class="fas fa-check"></i> Submit
                </button>
            </div>
        `;
    } else if (quizState.mode === 'true-false') {
        answersHtml = `
            <div class="quiz-options quiz-true-false">
                <button class="quiz-option" data-answer="true">
                    <i class="fas fa-check"></i> True
                </button>
                <button class="quiz-option" data-answer="false">
                    <i class="fas fa-times"></i> False
                </button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="quiz-progress">
            <div class="quiz-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="quiz-header">
            <span class="quiz-counter">Question ${quizState.currentIndex + 1} of ${quizState.questions.length}</span>
            <span class="quiz-score">Score: ${quizState.score}</span>
        </div>
        <div class="quiz-question">
            <h3>${escapeHtml(question.front)}</h3>
        </div>
        ${answersHtml}
    `;
    
    container.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedAnswer = btn.dataset.answer;
            checkQuizAnswer(selectedAnswer);
        });
    });

    const typedInput = document.getElementById('quizAnswerInput');
    if (typedInput) {
        typedInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitTypedAnswer();
        });
    }
}

function checkQuizAnswer(selectedAnswer) {
    const question = quizState.questions[quizState.currentIndex];
    const isCorrect = selectedAnswer.toLowerCase().trim() === question.back.toLowerCase().trim();
    
    quizState.answers.push({
        question: question.front,
        correctAnswer: question.back,
        userAnswer: selectedAnswer,
        isCorrect: isCorrect
    });
    
    if (isCorrect) {
        quizState.score++;
        showNotification('Correct! 🎉', 'success');
    } else {
        showNotification(`Wrong! The answer was: ${question.back}`, 'error');
    }
    
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => {
        opt.disabled = true;
        if (opt.dataset.answer === question.back) {
            opt.classList.add('correct');
        } else if (opt.dataset.answer === selectedAnswer && !isCorrect) {
            opt.classList.add('wrong');
        }
    });
    
    setTimeout(() => {
        quizState.currentIndex++;
        if (quizState.currentIndex < quizState.questions.length) {
            renderQuizQuestion();
        } else {
            showQuizResults();
        }
    }, 1500);
}

function submitTypedAnswer() {
    const input = document.getElementById('quizAnswerInput');
    if (input && input.value.trim()) {
        checkQuizAnswer(input.value.trim());
    }
}

function showQuizResults() {
    const container = document.getElementById('quizContent');
    if (!container) return;
    const timeTaken = Math.round((Date.now() - quizState.startTime) / 1000);
    const percentage = Math.round((quizState.score / quizState.questions.length) * 100);
    
    let grade = 'F';
    let gradeClass = 'grade-f';
    if (percentage >= 90) { grade = 'A+'; gradeClass = 'grade-a'; }
    else if (percentage >= 80) { grade = 'A'; gradeClass = 'grade-a'; }
    else if (percentage >= 70) { grade = 'B'; gradeClass = 'grade-b'; }
    else if (percentage >= 60) { grade = 'C'; gradeClass = 'grade-c'; }
    else if (percentage >= 50) { grade = 'D'; gradeClass = 'grade-d'; }
    
    container.innerHTML = `
        <div class="quiz-results">
            <div class="quiz-results-header">
                <i class="fas fa-trophy"></i>
                <h2>Quiz Complete!</h2>
            </div>
            <div class="quiz-grade ${gradeClass}">${grade}</div>
            <div class="quiz-stats">
                <div class="quiz-stat">
                    <span class="stat-value">${quizState.score}/${quizState.questions.length}</span>
                    <span class="stat-label">Correct</span>
                </div>
                <div class="quiz-stat">
                    <span class="stat-value">${percentage}%</span>
                    <span class="stat-label">Score</span>
                </div>
                <div class="quiz-stat">
                    <span class="stat-value">${formatQuizTime(timeTaken)}</span>
                    <span class="stat-label">Time</span>
                </div>
            </div>
            <div class="quiz-review">
                <h4>Review Answers</h4>
                ${quizState.answers.map((a, i) => `
                    <div class="review-item ${a.isCorrect ? 'correct' : 'wrong'}">
                        <span class="review-num">${i + 1}</span>
                        <div class="review-content">
                            <p class="review-question">${escapeHtml(a.question)}</p>
                            <p class="review-answer">Your answer: <strong>${escapeHtml(a.userAnswer)}</strong></p>
                            ${!a.isCorrect ? `<p class="review-correct">Correct: <strong>${escapeHtml(a.correctAnswer)}</strong></p>` : ''}
                        </div>
                        <i class="fas ${a.isCorrect ? 'fa-check' : 'fa-times'}"></i>
                    </div>
                `).join('')}
            </div>
            <div class="quiz-actions">
                <button class="btn btn-primary" onclick="startQuiz('${quizState.deckId}', '${quizState.mode}')">
                    <i class="fas fa-redo"></i> Retry Quiz
                </button>
                <button class="btn btn-secondary" onclick="closeQuizModal()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    saveQuizResult(quizState.deckId, percentage, timeTaken);
}

function formatQuizTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function saveQuizResult(deckId, score, timeTaken) {
    let quizHistory = JSON.parse(localStorage.getItem('questionary-quiz-history') || '[]');
    quizHistory.push({
        deckId,
        score,
        timeTaken,
        date: new Date().toISOString()
    });
    if (quizHistory.length > 100) quizHistory = quizHistory.slice(-100);
    localStorage.setItem('questionary-quiz-history', JSON.stringify(quizHistory));
}

function showQuizModal() {
    let modal = document.getElementById('quizModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quizModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h2><i class="fas fa-question-circle"></i> Quiz Mode</h2>
                    <button class="modal-close" onclick="closeQuizModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="quizContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
}

function closeQuizModal() {
    const modal = document.getElementById('quizModal');
    if (modal) modal.classList.remove('active');
    quizState.active = false;
}

// ============================================
// 5. STUDY REMINDERS WITH NOTIFICATIONS
// ============================================
var studyReminders = window.studyReminders || JSON.parse(localStorage.getItem('questionary-reminders') || '[]');
window.studyReminders = studyReminders;

function saveReminders() {
    localStorage.setItem('questionary-reminders', JSON.stringify(studyReminders));
}

function addStudyReminder(title, time, days) {
    const newReminder = {
        id: Date.now().toString(),
        title: title,
        message: '',
        time: time,
        days: days || [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        createdAt: new Date().toISOString()
    };
    
    studyReminders.push(newReminder);
    saveReminders();
    scheduleReminder(newReminder);
    showNotification('Reminder added!', 'success');
    renderReminders();
    return newReminder;
}

function deleteReminder(id) {
    studyReminders = studyReminders.filter(r => r.id !== id);
    saveReminders();
    renderReminders();
    showNotification('Reminder deleted', 'info');
}

function toggleReminder(id, enabled) {
    const reminder = studyReminders.find(r => r.id === id);
    if (reminder) {
        reminder.enabled = enabled;
        saveReminders();
        renderReminders();
    }
}

function scheduleReminder(reminder) {
    if (!reminder.enabled || !reminder.time) return;
    
    const [hours, minutes] = reminder.time.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const delay = scheduledTime - now;
    
    setTimeout(() => {
        if (reminder.days.includes(new Date().getDay())) {
            showStudyNotification(reminder);
        }
        scheduleReminder(reminder);
    }, delay);
}

function showStudyNotification(reminder) {
    if (typeof window.playAlarmSound === 'function') {
        window.playAlarmSound();
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Questionary - Study Reminder', {
            body: reminder.title + (reminder.message ? '\n' + reminder.message : ''),
            icon: 'assets/logo.png'
        });
    }
    
    showNotification(`⏰ ${reminder.title}`, 'info');
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification('Notifications enabled!', 'success');
            }
        });
    }
}

function renderReminders() {
    const container = document.getElementById('remindersList');
    if (!container) return;
    
    if (studyReminders.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="fas fa-bell-slash"></i> No reminders set. Add one to get started!</p>';
        return;
    }
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    container.innerHTML = studyReminders.map(r => `
        <div class="reminder-item ${r.enabled ? '' : 'disabled'}">
            <label class="switch">
                <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleReminder('${r.id}', this.checked)">
                <span class="slider"></span>
            </label>
            <div class="reminder-info">
                <span class="reminder-title">${escapeHtml(r.title)}</span>
                <span class="reminder-time">${formatTime12Hour(r.time)}</span>
                <span class="reminder-days">${r.days.map(d => dayNames[d]).join(', ')}</span>
            </div>
            <div class="reminder-actions">
                <button class="reminder-tag-btn" onclick="event.stopPropagation(); openTagItemModal('reminder_${r.id}', '${escapeHtml(r.title)}', 'reminder')" title="Add Tags">
                    <i class="fas fa-tag"></i>
                </button>
                <button class="reminder-delete" onclick="deleteReminder('${r.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function initReminders() {
    requestNotificationPermission();
    studyReminders.forEach(r => {
        if (r.enabled) scheduleReminder(r);
    });
}

// ============================================
// 6. THEMES — Light / Dark + Custom Theme Builder
// ============================================
// ============================================
// 6. THEMES — Light / Dark + Custom Theme Builder (Unified Engine)
// ============================================
var defaultCustomTheme = window.defaultCustomTheme || {
    bg: '#f7f7f8', surface: '#ffffff', fg: '#18181b', accent: '#cf6215',
    navbar: '#ffffff', btnIcon: '#cf6215', line: '#e4e4e7',
    folder1: '#cf6215', folder2: '#0891b2', folder3: '#16a34a',
    folder4: '#ea580c', folder5: '#db2777', folder6: '#7c3aed', folder7: '#0d9488',
    font: "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
};

function isCustomThemeActive() {
    return localStorage.getItem('questionary-custom-theme-active') === 'true';
}

function clearInlineThemeVars() {
    const root = document.documentElement;
    const props = [
        '--bg','--background','--surface','--surface-hover','--fg','--text-primary',
        '--fg2','--text-secondary','--accent','--accent-hover','--accent-light',
        '--primary-color','--primary-hover','--primary-light','--line','--border','--hover',
        '--folder-1','--folder-2','--folder-3','--folder-4','--folder-5','--folder-6','--folder-7',
        '--btn-icon-color','font-family'
    ];
    props.forEach(p => root.style.removeProperty(p));
    document.body.style.fontFamily = '';
    const header = document.querySelector('.header');
    if (header) header.style.background = '';
}

function getCurrentTheme() {
    return localStorage.getItem('questionary-theme') || localStorage.getItem('theme') || 'dark';
}

function updateModeSwitcher() {
    const current = getCurrentTheme();
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === current);
    });
}

function setTheme(themeName) {
    if (themeName !== 'light' && themeName !== 'dark') themeName = 'dark';
    
    // 1. Save preferences
    localStorage.setItem('questionary-theme', themeName);
    localStorage.setItem('theme', themeName);
    
    // 2. Set root attribute for CSS styles
    document.documentElement.setAttribute('data-theme', themeName);
    
    // 3. Clear custom inline styles if custom theme is disabled so stylesheet styles apply
    if (!isCustomThemeActive()) {
        clearInlineThemeVars();
    }
    
    // 4. Update Header Toggle Icon (Moon for light mode, Sun for dark mode)
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = (themeName === 'dark') ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // 5. Update settings modal buttons
    updateModeSwitcher();
}

function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    setTheme(newTheme);
    if (typeof showNotification === 'function') {
        showNotification(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} mode`, 'info');
    }
}

function toggleCustomTheme(enabled) {
    localStorage.setItem('questionary-custom-theme-active', enabled ? 'true' : 'false');
    const panel = document.getElementById('customThemePanel');
    if (panel) panel.style.display = enabled ? 'block' : 'none';
    
    if (enabled) {
        applyCustomTheme();
    } else {
        clearInlineThemeVars();
        setTheme(getCurrentTheme());
    }
}

function getCustomThemeValues() {
    const saved = localStorage.getItem('questionary-custom-theme');
    if (saved) {
        try { return { ...defaultCustomTheme, ...JSON.parse(saved) }; } catch(e) {}
    }
    return { ...defaultCustomTheme };
}

function applyCustomTheme() {
    const t = getCustomThemeValues();
    const root = document.documentElement;
    
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--background', t.bg);
    root.style.setProperty('--surface', t.surface);
    root.style.setProperty('--surface-hover', t.surface);
    root.style.setProperty('--fg', t.fg);
    root.style.setProperty('--text-primary', t.fg);
    root.style.setProperty('--fg2', t.fg);
    root.style.setProperty('--text-secondary', t.fg);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-hover', t.accent);
    root.style.setProperty('--accent-light', t.accent + '12');
    root.style.setProperty('--primary-color', t.accent);
    root.style.setProperty('--primary-hover', t.accent);
    root.style.setProperty('--primary-light', t.accent + '12');
    root.style.setProperty('--line', t.line);
    root.style.setProperty('--border', t.line);
    root.style.setProperty('--hover', t.line + '44');
    root.style.setProperty('--folder-1', t.folder1);
    root.style.setProperty('--folder-2', t.folder2);
    root.style.setProperty('--folder-3', t.folder3);
    root.style.setProperty('--folder-4', t.folder4);
    root.style.setProperty('--folder-5', t.folder5);
    root.style.setProperty('--folder-6', t.folder6);
    root.style.setProperty('--folder-7', t.folder7);
    
    const header = document.querySelector('.header');
    if (header) header.style.background = t.navbar;
    root.style.setProperty('--btn-icon-color', t.btnIcon);
    
    if (t.font) {
        root.style.setProperty('font-family', t.font);
        document.body.style.fontFamily = t.font;
    }
}

function updateCustomTheme() {
    const ids = {
        bg: 'customBg', surface: 'customSurface', fg: 'customFg', accent: 'customAccent',
        navbar: 'customNavbar', btnIcon: 'customBtnIcon', line: 'customLine'
    };
    const t = {};
    for (const [key, id] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) {
            t[key] = el.value;
            const hexEl = document.getElementById(id + 'Hex');
            if (hexEl) hexEl.textContent = el.value;
        }
    }
    for (let i = 1; i <= 7; i++) {
        const el = document.getElementById('customFolder' + i);
        if (el) t['folder' + i] = el.value;
    }
    const fontEl = document.getElementById('customFont');
    if (fontEl) t.font = fontEl.value;
    
    if (isCustomThemeActive()) {
        localStorage.setItem('questionary-custom-theme', JSON.stringify(t));
        applyCustomTheme();
    }
}

function saveCustomTheme() {
    updateCustomTheme();
    const t = {};
    const ids = {
        bg: 'customBg', surface: 'customSurface', fg: 'customFg', accent: 'customAccent',
        navbar: 'customNavbar', btnIcon: 'customBtnIcon', line: 'customLine'
    };
    for (const [key, id] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) t[key] = el.value;
    }
    for (let i = 1; i <= 7; i++) {
        const el = document.getElementById('customFolder' + i);
        if (el) t['folder' + i] = el.value;
    }
    const fontEl = document.getElementById('customFont');
    if (fontEl) t.font = fontEl.value;
    
    localStorage.setItem('questionary-custom-theme', JSON.stringify(t));
    localStorage.setItem('questionary-custom-theme-active', 'true');
    showNotification('Custom theme saved!', 'success');
}

function resetCustomTheme() {
    localStorage.removeItem('questionary-custom-theme');
    populateCustomThemePickers(defaultCustomTheme);
    if (isCustomThemeActive()) {
        applyCustomTheme();
    }
    showNotification('Theme reset to defaults', 'success');
}

function populateCustomThemePickers(t) {
    const ids = {
        bg: 'customBg', surface: 'customSurface', fg: 'customFg', accent: 'customAccent',
        navbar: 'customNavbar', btnIcon: 'customBtnIcon', line: 'customLine'
    };
    for (const [key, id] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) {
            el.value = t[key] || defaultCustomTheme[key];
            const hexEl = document.getElementById(id + 'Hex');
            if (hexEl) hexEl.textContent = el.value;
        }
    }
    for (let i = 1; i <= 7; i++) {
        const el = document.getElementById('customFolder' + i);
        if (el) el.value = t['folder' + i] || defaultCustomTheme['folder' + i];
    }
    const fontEl = document.getElementById('customFont');
    if (fontEl) {
        fontEl.value = t.font || defaultCustomTheme.font;
    }
}

function initThemeOnLoad() {
    const stored = getCurrentTheme();
    setTheme(stored);
    
    const toggle = document.getElementById('customThemeToggle');
    const panel = document.getElementById('customThemePanel');
    if (isCustomThemeActive()) {
        if (toggle) toggle.checked = true;
        if (panel) panel.style.display = 'block';
        populateCustomThemePickers(getCustomThemeValues());
        applyCustomTheme();
    } else {
        if (toggle) toggle.checked = false;
        if (panel) panel.style.display = 'none';
        populateCustomThemePickers(getCustomThemeValues());
        clearInlineThemeVars();
    }
}

function renderThemeSelector() {
    updateModeSwitcher();
}


// ============================================
// 7. TAGGING SYSTEM
// ============================================
var tags = window.tags || JSON.parse(localStorage.getItem('questionary-tags') || '[]');
window.tags = tags;
var itemTags = window.itemTags || JSON.parse(localStorage.getItem('questionary-item-tags') || '{}');
window.itemTags = itemTags;

(function cleanupOrphanedItemTags() {
    const validTagIds = new Set(tags.map(t => t.id));
    let changed = false;
    Object.keys(itemTags).forEach(key => {
        itemTags[key] = itemTags[key].filter(id => validTagIds.has(id));
        if (itemTags[key].length === 0) {
            delete itemTags[key];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('questionary-item-tags', JSON.stringify(itemTags));
    }
})();

function saveTags() {
    localStorage.setItem('questionary-tags', JSON.stringify(tags));
    localStorage.setItem('questionary-item-tags', JSON.stringify(itemTags));
}

function createTag(name, color = '#cf6215') {
    const cleanName = name.toLowerCase().trim();
    const tag = {
        id: Date.now().toString(),
        name: cleanName,
        color: color
    };
    
    if (!tags.find(t => t.name === tag.name)) {
        tags.push(tag);
        saveTags();
        renderTagsList();
        renderTagsMain();
        renderTaggedItems();
        if (typeof window.renderHomeTagsList === 'function') window.renderHomeTagsList();
        if (typeof window.renderHomeTaggedItemsList === 'function') window.renderHomeTaggedItemsList();
        showNotification(`Tag "${tag.name}" created`, 'success');
    }
    return tag;
}

function deleteTag(tagId) {
    tags = tags.filter(t => t.id !== tagId);
    Object.keys(itemTags).forEach(key => {
        itemTags[key] = itemTags[key].filter(id => id !== tagId);
        if (itemTags[key].length === 0) {
            delete itemTags[key];
        }
    });
    saveTags();
    renderTagsList();
    renderTagsMain();
    renderTaggedItems();
    if (typeof window.renderHomeTagsList === 'function') window.renderHomeTagsList();
    if (typeof window.renderHomeTaggedItemsList === 'function') window.renderHomeTaggedItemsList();
    showNotification('Tag deleted', 'info');
}

function addTagToItem(itemId, tagId) {
    if (!itemTags[itemId]) {
        itemTags[itemId] = [];
    }
    if (!itemTags[itemId].includes(tagId)) {
        itemTags[itemId].push(tagId);
        saveTags();
    }
}

function removeTagFromItem(itemId, tagId) {
    if (itemTags[itemId]) {
        itemTags[itemId] = itemTags[itemId].filter(id => id !== tagId);
        saveTags();
    }
}

function getItemTags(itemId) {
    const tagIds = itemTags[itemId] || [];
    return tagIds.map(id => tags.find(t => t.id === id)).filter(Boolean);
}

function getItemsByTag(tagId) {
    return Object.entries(itemTags)
        .filter(([_, tagIds]) => tagIds.includes(tagId))
        .map(([itemId]) => itemId);
}

function countItemsWithTag(tagId) {
    return Object.values(itemTags).filter(t => t.includes(tagId)).length;
}

function renderTagsList() {
    const container = document.getElementById('tagsList');
    if (!container) return;
    
    if (tags.length === 0) {
        container.innerHTML = '<p class="empty-state">No tags created yet.</p>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-item" style="--tag-color: ${tag.color}">
            <div class="tag-color" style="background: ${tag.color}"></div>
            <span class="tag-name">${escapeHtml(tag.name)}</span>
            <span class="tag-count">${countItemsWithTag(tag.id)} items</span>
            <button class="tag-delete" onclick="deleteTag('${tag.id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function renderTagsManager() {
    renderTagsList();
}

// ============================================
// 8. VOICE NOTES RECORDER
// ============================================
var mediaRecorder = window.mediaRecorder || null;
var audioChunks = window.audioChunks || [];
var voiceNotes = window.voiceNotes || JSON.parse(localStorage.getItem('questionary-voice-notes') || '[]');
window.voiceNotes = voiceNotes;
var currentAudio = window.currentAudio || null;
var recordingStartTime = window.recordingStartTime || null;
var recordingTimerInterval = window.recordingTimerInterval || null;

function saveVoiceNotes() {
    localStorage.setItem('questionary-voice-notes', JSON.stringify(voiceNotes));
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                saveVoiceNote(reader.result);
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        startRecordingTimer();
        updateRecordingUI(true);
        showNotification('Recording started...', 'info');
    } catch (err) {
        showNotification('Could not access microphone', 'error');
        console.error('Recording error:', err);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        stopRecordingTimer();
        updateRecordingUI(false);
        updateRecordingUINotes(false);
        showNotification('Recording saved!', 'success');
    }
}

async function startRecordingNotes() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                saveVoiceNote(reader.result);
                renderVoiceNotesGrid();
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        startRecordingTimerNotes();
        updateRecordingUINotes(true);
        showNotification('Recording started...', 'info');
    } catch (err) {
        showNotification('Could not access microphone', 'error');
        console.error('Recording error:', err);
    }
}

function startRecordingTimerNotes() {
    const timerEl = document.getElementById('recordingTimeNotes');
    if (!timerEl) return;
    
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function updateRecordingUINotes(isRecording) {
    const btn = document.getElementById('recordBtnNotes');
    if (btn) {
        btn.classList.toggle('recording', isRecording);
        btn.innerHTML = isRecording ? '<i class="fas fa-stop"></i><span>Stop</span>' : '<i class="fas fa-microphone"></i><span>Record</span>';
    }
}

function startRecordingTimer() {
    const timerEl = document.getElementById('recordingTime');
    if (!timerEl) return;
    
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopRecordingTimer() {
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }
    const timerEl = document.getElementById('recordingTime');
    if (timerEl) timerEl.textContent = '00:00';
    const timerNotesEl = document.getElementById('recordingTimeNotes');
    if (timerNotesEl) timerNotesEl.textContent = '00:00';
}

function saveVoiceNote(audioData) {
    const voiceNote = {
        id: Date.now().toString(),
        title: `Voice Note ${voiceNotes.length + 1}`,
        audio: audioData,
        duration: '0:00',
        createdAt: new Date().toISOString(),
        linkedTo: null
    };
    
    voiceNotes.push(voiceNote);
    saveVoiceNotes();
    renderVoiceNotes();
    renderVoiceNotesGrid();
}

function deleteVoiceNote(id) {
    voiceNotes = voiceNotes.filter(v => v.id !== id);
    saveVoiceNotes();
    renderVoiceNotes();
    renderVoiceNotesGrid();
    showNotification('Voice note deleted', 'info');
}

function playVoiceNote(id) {
    const note = voiceNotes.find(v => v.id === id);
    if (note) {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        
        currentAudio = new Audio(note.audio);
        currentAudio.onended = () => {
            currentAudio = null;
            document.querySelectorAll('.voice-play i, .play-voice-note i').forEach(i => {
                i.className = 'fas fa-play';
            });
        };
        
        currentAudio.play();
        showNotification(`Playing: ${note.title}`, 'info');
    }
}

function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}

function updateRecordingUI(isRecording) {
    const btn = document.getElementById('recordBtn');
    if (btn) {
        btn.classList.toggle('recording', isRecording);
        btn.innerHTML = isRecording ? '<i class="fas fa-stop"></i> Stop' : '<i class="fas fa-microphone"></i> Record';
    }
}

function renderVoiceNotes() {
    const container = document.getElementById('voiceNotesList');
    if (!container) return;
    
    if (voiceNotes.length === 0) {
        container.innerHTML = '<p class="empty-state">No voice notes yet. Click Record to create one.</p>';
        return;
    }
    
    container.innerHTML = voiceNotes.map(v => `
        <div class="voice-note-item" data-id="${v.id}">
            <button class="voice-play" onclick="playVoiceNote('${v.id}')">
                <i class="fas fa-play"></i>
            </button>
            <div class="voice-info">
                <span class="voice-title">${escapeHtml(v.title)}</span>
                <span class="voice-date">${new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
            <button class="voice-delete" onclick="deleteVoiceNote('${v.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    if (btn && btn.classList.contains('recording')) {
        stopRecording();
    } else {
        startRecording();
    }
}

function toggleRecordingNotes() {
    const btn = document.getElementById('recordBtnNotes');
    if (btn && btn.classList.contains('recording')) {
        stopRecording();
    } else {
        startRecordingNotes();
    }
}

// ============================================
// 9. EXPORT/IMPORT DATA
// ============================================
function exportAllData() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        favorites: JSON.parse(localStorage.getItem('questionary-favorites') || '[]'),
        notes: JSON.parse(localStorage.getItem('questionary-notes') || '[]'),
        flashcards: JSON.parse(localStorage.getItem('questionary-flashcards') || '[]'),
        studySessions: JSON.parse(localStorage.getItem('questionary-sessions') || '[]'),
        quickLinks: JSON.parse(localStorage.getItem('questionary-quick-links') || '[]'),
        studyStats: JSON.parse(localStorage.getItem('questionary-study-stats') || '{}'),
        reminders: JSON.parse(localStorage.getItem('questionary-reminders') || '[]'),
        tags: JSON.parse(localStorage.getItem('questionary-tags') || '[]'),
        itemTags: JSON.parse(localStorage.getItem('questionary-item-tags') || '{}'),
        pdfBookmarks: JSON.parse(localStorage.getItem('questionary-pdf-bookmarks') || '{}'),
        voiceNotes: JSON.parse(localStorage.getItem('questionary-voice-notes') || '[]'),
        quizHistory: JSON.parse(localStorage.getItem('questionary-quiz-history') || '[]'),
        theme: localStorage.getItem('questionary-theme') || 'light'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionary-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully!', 'success');
}

function importData(data) {
    try {
        if (data && (data.version || data.favorites || data.notes)) {
            if (data.favorites) localStorage.setItem('questionary-favorites', JSON.stringify(data.favorites));
            if (data.notes) localStorage.setItem('questionary-notes', JSON.stringify(data.notes));
            if (data.flashcards) localStorage.setItem('questionary-flashcards', JSON.stringify(data.flashcards));
            if (data.studySessions) localStorage.setItem('questionary-sessions', JSON.stringify(data.studySessions));
            if (data.quickLinks) localStorage.setItem('questionary-quick-links', JSON.stringify(data.quickLinks));
            if (data.studyStats) localStorage.setItem('questionary-study-stats', JSON.stringify(data.studyStats));
            if (data.reminders) localStorage.setItem('questionary-reminders', JSON.stringify(data.reminders));
            if (data.tags) localStorage.setItem('questionary-tags', JSON.stringify(data.tags));
            if (data.itemTags) localStorage.setItem('questionary-item-tags', JSON.stringify(data.itemTags));
            if (data.pdfBookmarks) localStorage.setItem('questionary-pdf-bookmarks', JSON.stringify(data.pdfBookmarks));
            if (data.voiceNotes) localStorage.setItem('questionary-voice-notes', JSON.stringify(data.voiceNotes));
            if (data.quizHistory) localStorage.setItem('questionary-quiz-history', JSON.stringify(data.quizHistory));
            if (data.theme) localStorage.setItem('questionary-theme', data.theme);
            
            showNotification('Data imported successfully! Refreshing...', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('Invalid backup file', 'error');
        }
    } catch (err) {
        showNotification('Error reading backup file', 'error');
        console.error('Import error:', err);
    }
}

// ============================================
// 10. CUSTOMIZABLE DASHBOARD
// ============================================
var dashboardLayout = window.dashboardLayout || JSON.parse(localStorage.getItem('questionary-dashboard-layout') || '{"widgets":["documents","favorites","recent","streak"],"visible":{"documents":true,"favorites":true,"recent":true,"streak":true}}');
window.dashboardLayout = dashboardLayout;

function saveDashboardLayout() {
    localStorage.setItem('questionary-dashboard-layout', JSON.stringify(dashboardLayout));
}

function toggleWidgetVisibility(widgetId, isVisible) {
    if (!dashboardLayout.visible) {
        dashboardLayout.visible = {};
    }
    dashboardLayout.visible[widgetId] = isVisible;
    saveDashboardLayout();
    applyDashboardLayout();
    showNotification(`Widget ${isVisible ? 'shown' : 'hidden'}`, 'info');
}

function reorderWidget(widgetId, direction) {
    if (!dashboardLayout.widgets) return;
    
    const index = dashboardLayout.widgets.indexOf(widgetId);
    if (index === -1) return;
    
    if (direction === -1 && index > 0) {
        [dashboardLayout.widgets[index], dashboardLayout.widgets[index - 1]] = 
        [dashboardLayout.widgets[index - 1], dashboardLayout.widgets[index]];
    } else if (direction === 1 && index < dashboardLayout.widgets.length - 1) {
        [dashboardLayout.widgets[index], dashboardLayout.widgets[index + 1]] = 
        [dashboardLayout.widgets[index + 1], dashboardLayout.widgets[index]];
    }
    
    saveDashboardLayout();
    renderDashboardWidgets();
    applyDashboardLayout();
}

function applyDashboardLayout() {
    if (!dashboardLayout.widgets) return;
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (!dashboardHeader) return;
    
    const widgetMap = {
        'documents': dashboardHeader.querySelector('.stat-card:nth-child(1)'),
        'favorites': dashboardHeader.querySelector('.stat-card:nth-child(2)'),
        'recent': dashboardHeader.querySelector('.stat-card:nth-child(3)'),
        'streak': dashboardHeader.querySelector('.stat-card:nth-child(4)')
    };
    
    Object.entries(widgetMap).forEach(([id, el]) => {
        if (el) {
            el.style.display = dashboardLayout.visible[id] !== false ? 'flex' : 'none';
        }
    });
    
    dashboardLayout.widgets.forEach((widgetId, idx) => {
        const el = widgetMap[widgetId];
        if (el) {
            el.style.order = idx;
        }
    });
}

function renderDashboardWidgets() {
    const container = document.getElementById('dashboardWidgets');
    if (!container) return;
    
    if (!dashboardLayout.widgets || dashboardLayout.widgets.length === 0) {
        dashboardLayout = {
            widgets: ['documents', 'favorites', 'recent', 'streak'],
            visible: { documents: true, favorites: true, recent: true, streak: true }
        };
        saveDashboardLayout();
    }
    
    const widgetInfo = [
        { id: 'documents', name: 'Documents', icon: 'fa-file-alt' },
        { id: 'favorites', name: 'Favorites', icon: 'fa-star' },
        { id: 'recent', name: 'Recent', icon: 'fa-history' },
        { id: 'streak', name: 'Day Streak', icon: 'fa-fire' }
    ];
    
    container.innerHTML = dashboardLayout.widgets.map((widgetId, idx) => {
        const info = widgetInfo.find(w => w.id === widgetId) || { name: widgetId, icon: 'fa-cube' };
        const isVisible = dashboardLayout.visible[widgetId] !== false;
        
        return `
            <div class="widget-setting-item">
                <i class="fas ${info.icon}"></i>
                <span class="widget-name">${info.name}</span>
                <div class="widget-reorder">
                    <button onclick="reorderWidget('${widgetId}', -1)" ${idx === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button onclick="reorderWidget('${widgetId}', 1)" ${idx === dashboardLayout.widgets.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <label class="switch">
                    <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleWidgetVisibility('${widgetId}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

// ============================================
// 11. ENHANCED ANALYTICS
// ============================================
function renderEnhancedAnalytics() {
    const container = document.getElementById('enhancedAnalytics');
    if (!container) return;
    
    const stats = JSON.parse(localStorage.getItem('questionary-study-stats') || '{}');
    const quizHistory = JSON.parse(localStorage.getItem('questionary-quiz-history') || '[]');
    const sessions = JSON.parse(localStorage.getItem('questionary-sessions') || '[]');
    
    const totalStudyTime = stats.totalTime || 0;
    const currentStreak = stats.streak || 0;
    const avgQuizScore = quizHistory.length > 0 
        ? Math.round(quizHistory.reduce((sum, q) => sum + q.score, 0) / quizHistory.length)
        : 0;
    
    const weeklyActivity = calculateWeeklyActivity(sessions);
    const subjectStats = calculateSubjectStats();
    
    container.innerHTML = `
        <div class="analytics-grid">
            <div class="analytics-card">
                <i class="fas fa-clock"></i>
                <div class="analytics-value">${Math.round(totalStudyTime / 60)}h</div>
                <div class="analytics-label">Total Study Time</div>
            </div>
            <div class="analytics-card">
                <i class="fas fa-fire"></i>
                <div class="analytics-value">${currentStreak}</div>
                <div class="analytics-label">Day Streak</div>
            </div>
            <div class="analytics-card">
                <i class="fas fa-trophy"></i>
                <div class="analytics-value">${avgQuizScore}%</div>
                <div class="analytics-label">Avg Quiz Score</div>
            </div>
            <div class="analytics-card">
                <i class="fas fa-layer-group"></i>
                <div class="analytics-value">${quizHistory.length}</div>
                <div class="analytics-label">Quizzes Taken</div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h4><i class="fas fa-chart-bar"></i> Weekly Activity</h4>
            <div class="weekly-chart">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => `
                    <div class="chart-bar">
                        <div class="bar-fill" style="height: ${weeklyActivity[i] || 0}%"></div>
                        <span class="bar-label">${day}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="analytics-section">
            <h4><i class="fas fa-book"></i> Most Studied</h4>
            <div class="subject-stats">
                ${subjectStats.slice(0, 5).map(s => `
                    <div class="subject-stat-item">
                        <span class="subject-name">${escapeHtml(s.name)}</span>
                        <div class="subject-bar">
                            <div class="subject-bar-fill" style="width: ${s.percentage}%"></div>
                        </div>
                        <span class="subject-count">${s.count}</span>
                    </div>
                `).join('') || '<p class="empty-state">No study data yet</p>'}
            </div>
        </div>
    `;
}

function calculateWeeklyActivity(sessions) {
    const activity = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    sessions.filter(s => new Date(s.date) >= weekAgo).forEach(s => {
        const day = new Date(s.date).getDay();
        activity[day] += s.duration || 30;
    });
    
    const max = Math.max(...activity, 1);
    return activity.map(a => (a / max) * 100);
}

function calculateSubjectStats() {
    const recent = JSON.parse(localStorage.getItem('questionary-recent') || '[]');
    const subjectCounts = {};
    
    recent.forEach(r => {
        const subject = r.path?.[r.path.length - 2] || 'General';
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    
    const sorted = Object.entries(subjectCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    
    const max = sorted[0]?.count || 1;
    return sorted.map(s => ({ ...s, percentage: (s.count / max) * 100 }));
}

// ================================================================
// 12. FILE IMPORT & TAURI DEV FILE DROP HANDLING
// WebKitGTK Safe File Drop Engine (Prevents GLib-GIO assertion crashes)
// ================================================================

async function importFileFromAnySource(fileOrPath, folderId = null) {
    if (!fileOrPath) return;
    
    const validFolderId = (folderId !== null && folderId !== undefined && folderId !== 'null' && folderId !== 'undefined') ? Number(folderId) : null;
    let fileObj = null;

    // Case A: File / Blob object
    if (fileOrPath instanceof File || fileOrPath instanceof Blob || (typeof fileOrPath === 'object' && (fileOrPath.name || fileOrPath.size !== undefined))) {
        fileObj = fileOrPath;
    } 
    // Case B: Native file path string from Tauri
    else if (typeof fileOrPath === 'string') {
        const fileName = fileOrPath.split(/[/\\]/).pop() || 'imported_file.pdf';
        const ext = fileName.toLowerCase();
        const mimeType = ext.endsWith('.pdf') ? 'application/pdf' :
                         ext.endsWith('.png') ? 'image/png' :
                         ext.endsWith('.jpg') || ext.endsWith('.jpeg') ? 'image/jpeg' :
                         ext.endsWith('.webp') ? 'image/webp' :
                         ext.endsWith('.gif') ? 'image/gif' :
                         ext.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                         ext.endsWith('.txt') || ext.endsWith('.md') ? 'text/plain' : 'application/octet-stream';

        const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

        if (isTauri) {
            try {
                const fs = window.__TAURI__?.fs;
                let binaryData = null;
                if (fs && typeof fs.readBinaryFile === 'function') {
                    binaryData = await fs.readBinaryFile(fileOrPath);
                } else if (fs && typeof fs.readFile === 'function') {
                    binaryData = await fs.readFile(fileOrPath);
                }
                
                if (binaryData) {
                    fileObj = new File([binaryData], fileName, { type: mimeType });
                }
            } catch (fsErr) {
                console.warn('[Tauri FS Read Failed, trying convertFileSrc]:', fsErr);
            }

            if (!fileObj) {
                try {
                    let convertFileSrc = null;
                    if (window.__TAURI__?.tauri && typeof window.__TAURI__.tauri.convertFileSrc === 'function') {
                        convertFileSrc = window.__TAURI__.tauri.convertFileSrc;
                    } else if (window.__TAURI__?.core && typeof window.__TAURI__.core.convertFileSrc === 'function') {
                        convertFileSrc = window.__TAURI__.core.convertFileSrc;
                    } else if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.convertFileSrc === 'function') {
                        convertFileSrc = window.__TAURI_INTERNALS__.convertFileSrc;
                    }

                    if (convertFileSrc) {
                        const assetUrl = convertFileSrc(fileOrPath);
                        const res = await fetch(assetUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        fileObj = new File([arrayBuffer], fileName, { type: mimeType });
                    }
                } catch (fetchErr) {
                    console.error('[Tauri Asset Fetch Failed]:', fetchErr);
                }
            }
        }

        if (!fileObj && (fileOrPath.startsWith('http') || fileOrPath.startsWith('blob:') || fileOrPath.startsWith('data:'))) {
            try {
                const res = await fetch(fileOrPath);
                const arrayBuffer = await res.arrayBuffer();
                fileObj = new File([arrayBuffer], fileName, { type: mimeType });
            } catch (e) {}
        }
    }

    if (fileObj) {
        await UserLibraryDbService.importFile(fileObj, validFolderId);
    } else {
        console.error('[Import Error]: Could not process file:', fileOrPath);
        throw new Error('Failed to read file');
    }
}

async function processAndImportFiles(filesOrPaths, folderId = null) {
    if (!filesOrPaths || filesOrPaths.length === 0) return;
    
    if (!UserLibraryDbService.db) {
        await UserLibraryDbService.init();
    }

    const targetFolder = (folderId !== null && folderId !== undefined) ? folderId : UserLibraryDbService.currentFolderId;
    
    showNotification(`Importing ${filesOrPaths.length} file(s)...`, 'info');
    let importedCount = 0;

    for (const item of filesOrPaths) {
        try {
            await importFileFromAnySource(item, targetFolder);
            importedCount++;
        } catch (err) {
            console.error('[Import Error]:', err);
        }
    }

    clearDragHoverStyles();

    if (importedCount > 0) {
        await renderLibrary();
        showNotification(`Successfully imported ${importedCount} file(s) to Library!`, 'success');
    } else {
        showNotification('Failed to import files. Check console for details.', 'error');
    }
}

function setupTauriNativeDropListener() {
    try {
        const listenFn = window.__TAURI__?.event?.listen || window.__TAURI_INTERNALS__?.listen;

        const handleDropPayload = async (payload) => {
            let paths = [];
            if (Array.isArray(payload)) {
                paths = payload;
            } else if (payload && Array.isArray(payload.paths)) {
                paths = payload.paths;
            }

            if (paths.length > 0) {
                const targetFolder = (window.activeDropTargetFolderId !== undefined && window.activeDropTargetFolderId !== null)
                    ? window.activeDropTargetFolderId
                    : UserLibraryDbService.currentFolderId;

                window.activeDropTargetFolderId = null;
                clearDragHoverStyles();

                await processAndImportFiles(paths, targetFolder);
            }
        };

        if (typeof listenFn === 'function') {
            listenFn('tauri://file-drop', (event) => {
                handleDropPayload(event.payload);
            });
            listenFn('tauri://drag-drop', (event) => {
                handleDropPayload(event.payload);
            });
            listenFn('tauri://file-drop-cancelled', () => {
                clearDragHoverStyles();
                window.activeDropTargetFolderId = null;
            });
        } else if (window.__TAURI__?.webviewWindow) {
            const appWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
            if (appWindow && typeof appWindow.onDragDropEvent === 'function') {
                appWindow.onDragDropEvent((event) => {
                    if (event.payload && (event.payload.type === 'drop' || event.payload.paths)) {
                        handleDropPayload(event.payload.paths || event.payload);
                    }
                });
            }
        }
    } catch (err) {
        console.warn('[Tauri Native Drop Listener Warning]:', err);
    }
}

function initDragDropImport() {
    const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

    window.addEventListener('dragover', (e) => {
        if (!draggedLibraryItem) {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        }
    }, false);

    window.addEventListener('drop', async (e) => {
        if (draggedLibraryItem) return;

        e.preventDefault();
        clearDragHoverStyles();

        if (!isTauri) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await processAndImportFiles(Array.from(e.dataTransfer.files));
            }
        }
    }, false);

    if (isTauri) {
        setupTauriNativeDropListener();
    }
}

async function handleFilesSelect(files) {
    if (files && files.length > 0) {
        await processAndImportFiles(Array.from(files));
    }
}

async function importPdfFile(file) {
    await importPdfToLibrary(file);
}

// ============================================
// 13. ALARM SOUND SYSTEM (Web Audio API)
// ============================================
var alarmSettings = window.alarmSettings || JSON.parse(localStorage.getItem('questionary-alarm-settings') || '{}');
window.alarmSettings = alarmSettings;
if (!alarmSettings.sound) alarmSettings.sound = 'classic';
if (!alarmSettings.volume) alarmSettings.volume = 70;

var currentAlarmAudio = window.currentAlarmAudio || null;
var alarmAudioContext = window.alarmAudioContext || null;
var alarmIntervalId = window.alarmIntervalId || null;

var alarmPatterns = window.alarmPatterns || {
    classic: { frequencies: [880, 0, 880, 0, 880, 0, 0], durations: [120, 80, 120, 80, 120, 80, 400], type: 'square' },
    gentle: { frequencies: [392, 440, 523, 587, 659, 784, 880], durations: [250, 250, 250, 250, 300, 300, 500], type: 'sine' },
    urgent: { frequencies: [1047, 0, 1047, 0, 1319, 0, 1319, 0, 1568, 0], durations: [60, 60, 60, 60, 60, 60, 60, 60, 60, 300], type: 'square' },
    chime: { frequencies: [659, 523, 0, 659, 523, 0, 784, 659, 523], durations: [300, 450, 200, 300, 450, 200, 250, 250, 600], type: 'sine' },
    digital: { frequencies: [1200, 0, 1200, 0, 800, 0], durations: [150, 75, 150, 75, 200, 350], type: 'square' },
    bell: { frequencies: [659, 0, 523, 0, 659, 784, 659], durations: [350, 50, 350, 50, 200, 200, 500], type: 'triangle' }
};

function saveAlarmSettings() {
    localStorage.setItem('questionary-alarm-settings', JSON.stringify(alarmSettings));
}

function setAlarmSound(soundName) {
    alarmSettings.sound = soundName;
    saveAlarmSettings();
    
    document.querySelectorAll('.alarm-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sound === soundName);
    });
    
    const customUpload = document.getElementById('customSoundUpload');
    if (customUpload) {
        customUpload.style.display = soundName === 'custom' ? 'block' : 'none';
    }
}

function setAlarmVolume(volume) {
    alarmSettings.volume = parseInt(volume, 10);
    saveAlarmSettings();
    const volumeDisplay = document.getElementById('alarmVolumeValue');
    if (volumeDisplay) volumeDisplay.textContent = alarmSettings.volume + '%';
}

async function playPatternOnce(pattern, volume) {
    return new Promise((resolve) => {
        try {
            if (!alarmAudioContext) {
                alarmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const { frequencies, durations, type } = pattern;
            let currentTime = alarmAudioContext.currentTime;
            
            frequencies.forEach((freq, i) => {
                if (freq > 0) {
                    const osc = alarmAudioContext.createOscillator();
                    const gain = alarmAudioContext.createGain();
                    
                    osc.type = type;
                    osc.frequency.value = freq;
                    
                    gain.gain.setValueAtTime(0, currentTime);
                    gain.gain.linearRampToValueAtTime(volume, currentTime + 0.01);
                    gain.gain.setValueAtTime(volume, currentTime + (durations[i] / 1000) - 0.02);
                    gain.gain.linearRampToValueAtTime(0, currentTime + (durations[i] / 1000));
                    
                    osc.connect(gain);
                    gain.connect(alarmAudioContext.destination);
                    
                    osc.start(currentTime);
                    osc.stop(currentTime + (durations[i] / 1000));
                }
                currentTime += durations[i] / 1000;
            });
            
            const totalDuration = durations.reduce((a, b) => a + b, 0);
            setTimeout(resolve, totalDuration);
        } catch (e) {
            console.warn('Audio Context error:', e);
            resolve();
        }
    });
}

function previewAlarmSound(soundName) {
    stopAlarmSound();
    
    if (soundName === 'custom' && alarmSettings.customSound) {
        currentAlarmAudio = new Audio(alarmSettings.customSound);
        currentAlarmAudio.volume = alarmSettings.volume / 100;
        currentAlarmAudio.play().catch(e => console.log('Audio play failed:', e));
    } else if (alarmPatterns[soundName]) {
        playPatternOnce(alarmPatterns[soundName], alarmSettings.volume / 100);
    }
}

async function playAlarmSound() {
    stopAlarmSound();
    
    const soundName = alarmSettings.sound || 'classic';
    const volume = alarmSettings.volume / 100;
    
    if (soundName === 'custom' && alarmSettings.customSound) {
        currentAlarmAudio = new Audio(alarmSettings.customSound);
        currentAlarmAudio.volume = volume;
        currentAlarmAudio.loop = true;
        currentAlarmAudio.play().catch(e => console.log('Audio play failed:', e));
    } else if (alarmPatterns[soundName]) {
        alarmIntervalId = true;
        const playLoop = async () => {
            while (alarmIntervalId !== null) {
                await playPatternOnce(alarmPatterns[soundName], volume);
                await new Promise(r => setTimeout(r, 200));
            }
        };
        playLoop();
    }
    
    setTimeout(() => stopAlarmSound(), 30000);
    showAlarmNotification();
}

function stopAlarmSound() {
    alarmIntervalId = null;
    
    if (currentAlarmAudio) {
        currentAlarmAudio.pause();
        currentAlarmAudio.currentTime = 0;
        currentAlarmAudio = null;
    }
    
    if (alarmAudioContext) {
        alarmAudioContext.close().catch(() => {});
        alarmAudioContext = null;
    }
    
    const alarmNotif = document.getElementById('alarmNotification');
    if (alarmNotif) alarmNotif.remove();
}

function showAlarmNotification() {
    const existing = document.getElementById('alarmNotification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.id = 'alarmNotification';
    notif.className = 'alarm-notification';
    notif.innerHTML = `
        <div class="alarm-notification-content">
            <i class="fas fa-bell alarm-bell-icon"></i>
            <span class="alarm-notification-text">Timer Complete!</span>
            <button class="alarm-dismiss-btn" onclick="stopAlarmSound()">
                <i class="fas fa-times"></i> Dismiss
            </button>
        </div>
    `;
    document.body.appendChild(notif);
}

function handleCustomSoundUpload(file) {
    if (!file || !file.type.startsWith('audio/')) {
        showNotification('Please select an audio file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        alarmSettings.customSound = e.target.result;
        alarmSettings.customSoundName = file.name;
        saveAlarmSettings();
        
        const nameEl = document.getElementById('customSoundName');
        if (nameEl) nameEl.textContent = file.name;
        
        showNotification('Custom sound uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function initAlarmUI() {
    document.querySelectorAll('.alarm-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sound === alarmSettings.sound);
    });
    
    const volumeSlider = document.getElementById('alarmVolume');
    const volumeDisplay = document.getElementById('alarmVolumeValue');
    if (volumeSlider) volumeSlider.value = alarmSettings.volume;
    if (volumeDisplay) volumeDisplay.textContent = alarmSettings.volume + '%';
    
    const customUpload = document.getElementById('customSoundUpload');
    if (customUpload) {
        customUpload.style.display = alarmSettings.sound === 'custom' ? 'block' : 'none';
    }
    
    if (alarmSettings.customSoundName) {
        const nameEl = document.getElementById('customSoundName');
        if (nameEl) nameEl.textContent = alarmSettings.customSoundName;
    }
}

// ================================================================
// 14. PDF & MULTI-DOC LIBRARY MANAGEMENT SYSTEM ('userlibrary.db')
// Stores custom library metadata in 'userlibrary.db'
// Stores PDF/Doc binary files in IndexedDB / AppData 'user_library_files/'
// ================================================================
// ================================================================
// USER LIBRARY FILE STORE & DB SERVICE (HOT-RELOAD SAFE)
// ================================================================

var UserLibraryFileStore = window.UserLibraryFileStore || {
    async saveBytes(blobId, uInt8Array) {
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('QuestionaryUserLibraryFiles', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('files_store');
            request.onsuccess = e => {
                const idb = e.target.result;
                const tx = idb.transaction('files_store', 'readwrite');
                const putReq = tx.objectStore('files_store').put(uInt8Array, blobId);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            request.onerror = () => reject(request.error);
        });

        if (window.__TAURI__ && window.__TAURI__.fs) {
            try {
                const fs = window.__TAURI__.fs;
                const writeBinaryFile = fs.writeBinaryFile || fs.writeFile;
                const mkdir = fs.mkdir || fs.createDir;
                const exists = fs.exists;
                const BaseDirectory = fs.BaseDirectory || 1;
                
                if (exists && mkdir && writeBinaryFile) {
                    const dirExists = await exists('user_library_files', { baseDir: BaseDirectory.AppData });
                    if (!dirExists) {
                        await mkdir('user_library_files', { baseDir: BaseDirectory.AppData, recursive: true });
                    }
                    await writeBinaryFile(`user_library_files/${blobId}.bin`, uInt8Array, { baseDir: BaseDirectory.AppData });
                }
            } catch (e) {
                console.warn('[UserLibraryFileStore] Tauri file save warning:', e);
            }
        }
    },

    async saveFile(blobId, fileOrBlob) {
        const uInt8Array = await fileToUint8Array(fileOrBlob);
        await this.saveBytes(blobId, uInt8Array);
    },

    async getFileBlob(blobId) {
        if (window.__TAURI__ && window.__TAURI__.fs) {
            try {
                const fs = window.__TAURI__.fs;
                const readBinaryFile = fs.readBinaryFile || fs.readFile;
                const BaseDirectory = fs.BaseDirectory || 1;
                const data = await readBinaryFile(`user_library_files/${blobId}.bin`, { baseDir: BaseDirectory.AppData });
                if (data) return new Blob([data]);
            } catch (e) {}
        }

        return new Promise(resolve => {
            const request = indexedDB.open('QuestionaryUserLibraryFiles', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('files_store');
            request.onsuccess = e => {
                const idb = e.target.result;
                const tx = idb.transaction('files_store', 'readonly');
                const getReq = tx.objectStore('files_store').get(blobId);
                getReq.onsuccess = () => {
                    if (getReq.result) resolve(new Blob([getReq.result]));
                    else resolve(null);
                };
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    },

    async removeFile(blobId) {
        await new Promise(resolve => {
            const request = indexedDB.open('QuestionaryUserLibraryFiles', 1);
            request.onsuccess = e => {
                const idb = e.target.result;
                const tx = idb.transaction('files_store', 'readwrite');
                tx.objectStore('files_store').delete(blobId);
                resolve();
            };
            request.onerror = () => resolve();
        });

        if (window.__TAURI__ && window.__TAURI__.fs) {
            try {
                const fs = window.__TAURI__.fs;
                const removeFile = fs.removeFile || fs.remove;
                const BaseDirectory = fs.BaseDirectory || 1;
                await removeFile(`user_library_files/${blobId}.bin`, { baseDir: BaseDirectory.AppData });
            } catch (e) {}
        }
    }
};
window.UserLibraryFileStore = UserLibraryFileStore;

var UserLibraryDbService = window.UserLibraryDbService || {
    db: null,
    SQL: null,
    currentFolderId: null,
    pathStack: [],

    async init() {
        try {
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

            let savedDb = await this.loadDbFromIndexedDB();
            if (savedDb) {
                this.db = new this.SQL.Database(savedDb);
                savedDb = null;
            } else {
                this.db = new this.SQL.Database();
            }

            this.db.run(`
                CREATE TABLE IF NOT EXISTS folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    parent_id INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    color TEXT DEFAULT '#3b82f6',
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );

                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    folder_id INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    blob_id TEXT NOT NULL,
                    file_size INTEGER DEFAULT 0,
                    added_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
            `);

            await this.saveDbToIndexedDB();
            console.log('[UserLibraryDB] Initialized userlibrary.db successfully');
            return true;
        } catch (err) {
            console.error('[UserLibraryDB] Critical init error:', err);
            return false;
        }
    },

    async query(sql, params = []) {
        if (!this.db) return [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    async execute(sql, params = []) {
        if (!this.db) return;
        this.db.run(sql, params);
        await this.saveDbToIndexedDB();
    },

    async saveDbToIndexedDB() {
        if (!this.db) return;
        let data = this.db.export();
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('QuestionaryUserLibraryDB', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('db_store');
            request.onsuccess = e => {
                const idb = e.target.result;
                const tx = idb.transaction('db_store', 'readwrite');
                const putReq = tx.objectStore('db_store').put(data, 'userlibrary.db');
                putReq.onsuccess = () => {
                    data = null;
                    resolve();
                };
                putReq.onerror = () => {
                    data = null;
                    reject(putReq.error);
                };
            };
            request.onerror = () => {
                data = null;
                reject(request.error);
            };
        });
    },

    async loadDbFromIndexedDB() {
        return new Promise(resolve => {
            const request = indexedDB.open('QuestionaryUserLibraryDB', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('db_store');
            request.onsuccess = e => {
                const idb = e.target.result;
                const tx = idb.transaction('db_store', 'readonly');
                const getReq = tx.objectStore('db_store').get('userlibrary.db');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    },

    async getFolders(parentId = null) {
        const validParentId = (parentId !== null && parentId !== undefined && parentId !== 'null' && parentId !== 'undefined') ? Number(parentId) : null;
        const sql = validParentId === null
            ? "SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC"
            : "SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC";
        return await this.query(sql, validParentId === null ? [] : [validParentId]);
    },

    async createFolder(name, color = '#3b82f6', parentId = null) {
        const validParentId = (parentId !== null && parentId !== undefined && parentId !== 'null' && parentId !== 'undefined') ? Number(parentId) : null;
        await this.execute("INSERT INTO folders (name, color, parent_id) VALUES (?, ?, ?)", [name, color, validParentId]);
    },

    async deleteFolder(folderId) {
        const files = await this.query("SELECT * FROM files WHERE folder_id = ?", [folderId]);
        for (const f of files) await this.deleteFile(f.id);
        const subfolders = await this.query("SELECT * FROM folders WHERE parent_id = ?", [folderId]);
        for (const sub of subfolders) await this.deleteFolder(sub.id);
        await this.execute("DELETE FROM folders WHERE id = ?", [folderId]);
    },

    async renameFolder(folderId, newName) {
        await this.execute("UPDATE folders SET name = ? WHERE id = ?", [newName, folderId]);
    },

    async getFiles(folderId = null) {
        const validFolderId = (folderId !== null && folderId !== undefined && folderId !== 'null' && folderId !== 'undefined') ? Number(folderId) : null;
        const sql = validFolderId === null
            ? "SELECT * FROM files WHERE folder_id IS NULL ORDER BY name ASC"
            : "SELECT * FROM files WHERE folder_id = ? ORDER BY name ASC";
        return await this.query(sql, validFolderId === null ? [] : [validFolderId]);
    },

    async importFile(file, folderId = null) {
        const validFolderId = (folderId !== null && folderId !== undefined && folderId !== 'null' && folderId !== 'undefined') ? Number(folderId) : null;
        const blobId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const name = file.name || 'Imported_File';
        const fileType = getFileTypeCategory(name);

        let uInt8Array = await fileToUint8Array(file);
        await UserLibraryFileStore.saveBytes(blobId, uInt8Array);
        
        const fileSize = uInt8Array.byteLength || 0;
        uInt8Array = null;

        await this.execute(
            "INSERT INTO files (folder_id, name, file_type, blob_id, file_size) VALUES (?, ?, ?, ?, ?)", 
            [validFolderId, name, fileType, blobId, fileSize]
        );
        console.log(`[UserLibraryDB] Inserted file "${name}" (${fileSize} bytes, type: ${fileType}) into folder_id:`, validFolderId);
    },

    async deleteFile(fileId) {
        const res = await this.query("SELECT * FROM files WHERE id = ?", [fileId]);
        if (res.length > 0) {
            await UserLibraryFileStore.removeFile(res[0].blob_id);
            await this.execute("DELETE FROM files WHERE id = ?", [fileId]);
        }
    },

    async renameFile(fileId, newName) {
        await this.execute("UPDATE files SET name = ? WHERE id = ?", [newName, fileId]);
    },

    async moveItem(itemId, itemType, targetFolderId) {
        const validTargetId = (targetFolderId !== null && targetFolderId !== undefined && targetFolderId !== 'null' && targetFolderId !== 'undefined') ? Number(targetFolderId) : null;
        if (itemType === 'folder') {
            if (itemId === validTargetId) return;
            await this.execute("UPDATE folders SET parent_id = ? WHERE id = ?", [validTargetId, itemId]);
        } else {
            await this.execute("UPDATE files SET folder_id = ? WHERE id = ?", [validTargetId, itemId]);
        }
    }
};
window.UserLibraryDbService = UserLibraryDbService;

var libraryEditMode = window.libraryEditMode || false;
var moveItemState = window.moveItemState || { itemId: null, itemType: null };
var selectedFolderColor = window.selectedFolderColor || '#3b82f6';
var selectedMoveDestinationId = window.selectedMoveDestinationId || null;

var draggedLibraryItem = window.draggedLibraryItem || null;

function toggleLibraryEditMode() {
    libraryEditMode = !libraryEditMode;
    const btn = document.getElementById('libraryEditBtn');
    const controls = document.getElementById('libraryEditControls');
    if (btn) btn.innerHTML = libraryEditMode ? '<i class="fas fa-check"></i> Done' : '<i class="fas fa-edit"></i> Edit';
    if (controls) controls.style.display = libraryEditMode ? 'block' : 'none';
    renderLibrary();
}

async function renderLibrary() {
    const container = document.getElementById('libraryContents');
    if (!container) return;

    if (!UserLibraryDbService.db) {
        await UserLibraryDbService.init();
    }

    const currentFolderId = UserLibraryDbService.currentFolderId;
    const folders = await UserLibraryDbService.getFolders(currentFolderId);
    const files = await UserLibraryDbService.getFiles(currentFolderId);

    renderLibraryBreadcrumb();

    container.innerHTML = '';
    const isEmpty = folders.length === 0 && files.length === 0;
    const emptyState = document.getElementById('libraryEmptyState');
    if (emptyState) emptyState.style.display = isEmpty ? 'flex' : 'none';

    const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

    folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'library-item library-folder';
        item.style.borderColor = folder.color || '#3b82f6';
        item.setAttribute('draggable', 'true');

        item.innerHTML = `
            <div class="library-item-icon" style="color: ${folder.color || '#3b82f6'}">
                <i class="fas fa-folder"></i>
            </div>
            <div class="library-item-name">${escapeHtml(folder.name)}</div>
            ${libraryEditMode ? `
                <div class="library-item-actions">
                    <button class="lib-action-btn" onclick="event.stopPropagation(); renameLibraryFolder(${folder.id}, '${escapeHtml(folder.name)}')"><i class="fas fa-edit"></i></button>
                    <button class="lib-action-btn" onclick="event.stopPropagation(); openMoveLibraryItemModal(${folder.id}, 'folder')"><i class="fas fa-arrows-alt"></i></button>
                    <button class="lib-action-btn danger" onclick="event.stopPropagation(); deleteLibraryFolder(${folder.id}, '${escapeHtml(folder.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            ` : ''}
        `;

        item.addEventListener('dragstart', (e) => {
            draggedLibraryItem = { id: folder.id, type: 'folder' };
            item.classList.add('is-dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedLibraryItem));
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            clearDragHoverStyles();
            draggedLibraryItem = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            item.classList.add('drag-target-hover');
            if (!draggedLibraryItem) {
                window.activeDropTargetFolderId = folder.id;
            }
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            item.classList.add('drag-target-hover');
        });

        item.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-target-hover');
                if (!draggedLibraryItem && window.activeDropTargetFolderId === folder.id) {
                    window.activeDropTargetFolderId = null;
                }
            }
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearDragHoverStyles();

            if (draggedLibraryItem) {
                if (draggedLibraryItem.type === 'folder' && draggedLibraryItem.id === folder.id) {
                    showNotification("Cannot move a folder into itself", "warning");
                    return;
                }
                await UserLibraryDbService.moveItem(draggedLibraryItem.id, draggedLibraryItem.type, folder.id);
                draggedLibraryItem = null;
                await renderLibrary();
                showNotification(`Moved into "${folder.name}"`, 'success');
                return;
            }

            if (!isTauri && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                await processAndImportFiles(Array.from(e.dataTransfer.files), folder.id);
            }
        });

        item.onclick = () => {
            UserLibraryDbService.currentFolderId = folder.id;
            UserLibraryDbService.pathStack.push({ id: folder.id, name: folder.name });
            renderLibrary();
        };

        container.appendChild(item);
    });

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'library-item library-pdf';
        item.setAttribute('draggable', 'true');
        
        const category = getFileTypeCategory(file.name);
        let icon = 'fa-file-alt';
        let iconColor = '#cf6215';
        
        if (category === 'image') { icon = 'fa-file-image'; iconColor = '#22c55e'; }
        else if (category === 'pdf') { icon = 'fa-file-pdf'; iconColor = '#ef4444'; }
        else if (category === 'text') { icon = 'fa-file-code'; iconColor = '#0891b2'; }
        else if (category === 'docx') { icon = 'fa-file-word'; iconColor = '#2563eb'; }

        item.innerHTML = `
            <div class="library-item-icon" style="color: ${iconColor}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="library-item-name">${escapeHtml(file.name)}</div>
            <div class="library-item-meta">${formatBytesContent(file.file_size || 0)}</div>
            ${libraryEditMode ? `
                <div class="library-item-actions">
                    <button class="lib-action-btn" onclick="event.stopPropagation(); renameLibraryFile(${file.id}, '${escapeHtml(file.name)}')"><i class="fas fa-edit"></i></button>
                    <button class="lib-action-btn" onclick="event.stopPropagation(); openMoveLibraryItemModal(${file.id}, 'file')"><i class="fas fa-arrows-alt"></i></button>
                    <button class="lib-action-btn danger" onclick="event.stopPropagation(); deleteLibraryFile(${file.id}, '${escapeHtml(file.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            ` : ''}
        `;

        item.addEventListener('dragstart', (e) => {
            draggedLibraryItem = { id: file.id, type: 'file' };
            item.classList.add('is-dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedLibraryItem));
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            clearDragHoverStyles();
            draggedLibraryItem = null;
        });

        item.onclick = async () => {
            await openAnyDocument(`blob-id:${file.blob_id}`, file.name);
        };

        container.appendChild(item);
    });
}

function renderLibraryBreadcrumb() {
    const breadcrumb = document.getElementById('libraryBreadcrumb');
    if (!breadcrumb) return;

    if (UserLibraryDbService.pathStack.length === 0) {
        breadcrumb.style.display = 'none';
        return;
    }

    breadcrumb.style.display = 'flex';
    breadcrumb.innerHTML = '';

    const rootBtn = document.createElement('button');
    rootBtn.className = 'breadcrumb-item';
    rootBtn.innerHTML = '<i class="fas fa-home"></i> Library';
    rootBtn.onclick = () => navigateToLibraryRoot();

    attachBreadcrumbDropHandler(rootBtn, null, 'Root Library');
    breadcrumb.appendChild(rootBtn);

    UserLibraryDbService.pathStack.forEach((crumb, index) => {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.innerHTML = '<i class="fas fa-chevron-right"></i>';
        breadcrumb.appendChild(sep);

        const crumbBtn = document.createElement('button');
        crumbBtn.className = `breadcrumb-item ${index === UserLibraryDbService.pathStack.length - 1 ? 'active' : ''}`;
        crumbBtn.textContent = crumb.name;
        crumbBtn.onclick = () => navigateToLibraryStackIndex(index);

        attachBreadcrumbDropHandler(crumbBtn, crumb.id, crumb.name);
        breadcrumb.appendChild(crumbBtn);
    });
}

function attachBreadcrumbDropHandler(element, targetFolderId, label) {
    element.addEventListener('dragover', (e) => {
        if (draggedLibraryItem) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('drag-target-hover');
        }
    });

    element.addEventListener('dragleave', (e) => {
        if (!element.contains(e.relatedTarget)) {
            element.classList.remove('drag-target-hover');
        }
    });

    element.addEventListener('drop', async (e) => {
        if (draggedLibraryItem) {
            e.preventDefault();
            e.stopPropagation();
            clearDragHoverStyles();

            await UserLibraryDbService.moveItem(draggedLibraryItem.id, draggedLibraryItem.type, targetFolderId);
            draggedLibraryItem = null;
            await renderLibrary();
            showNotification(`Moved to ${label}`, 'success');
        }
    });
}

function navigateToLibraryRoot() {
    UserLibraryDbService.currentFolderId = null;
    UserLibraryDbService.pathStack = [];
    renderLibrary();
}

function navigateToLibraryStackIndex(index) {
    UserLibraryDbService.pathStack = UserLibraryDbService.pathStack.slice(0, index + 1);
    const current = UserLibraryDbService.pathStack[UserLibraryDbService.pathStack.length - 1];
    UserLibraryDbService.currentFolderId = current ? current.id : null;
    renderLibrary();
}

function openCreateLibraryFolderModal() {
    const modal = document.getElementById('libraryFolderModal');
    const input = document.getElementById('libraryFolderName');
    if (input) input.value = '';
    if (modal) modal.classList.add('active');
}

function closeLibraryFolderModal() {
    document.getElementById('libraryFolderModal')?.classList.remove('active');
}

function selectLibraryFolderColor(color) {
    selectedFolderColor = color;
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });
}

async function saveLibraryFolder() {
    const input = document.getElementById('libraryFolderName');
    const name = input?.value.trim();
    if (!name) {
        showNotification('Please enter a folder name', 'error');
        return;
    }

    await UserLibraryDbService.createFolder(name, selectedFolderColor, UserLibraryDbService.currentFolderId);
    closeLibraryFolderModal();
    await renderLibrary();
    showNotification(`Folder "${name}" created!`, 'success');
}

async function renameLibraryFolder(folderId, oldName) {
    const newName = await showPrompt('Enter new folder name:', { defaultValue: oldName, title: 'Rename Folder' });
    if (newName && newName !== oldName) {
        await UserLibraryDbService.renameFolder(folderId, newName);
        await renderLibrary();
        showNotification('Folder renamed', 'success');
    }
}

async function renameLibraryFile(fileId, oldName) {
    const newName = await showPrompt('Enter new file name:', { defaultValue: oldName, title: 'Rename File' });
    if (newName && newName !== oldName) {
        await UserLibraryDbService.renameFile(fileId, newName);
        await renderLibrary();
        showNotification('File renamed', 'success');
    }
}

async function deleteLibraryFolder(folderId, name) {
    const ok = await showConfirm(`Delete folder "${name}" and all its contents?`, { title: 'Delete Folder', type: 'danger' });
    if (ok) {
        await UserLibraryDbService.deleteFolder(folderId);
        await renderLibrary();
        showNotification('Folder deleted', 'info');
    }
}

async function deleteLibraryFile(fileId, name) {
    const ok = await showConfirm(`Delete file "${name}" from Library?`, { title: 'Delete File', type: 'danger' });
    if (ok) {
        await UserLibraryDbService.deleteFile(fileId);
        await renderLibrary();
        showNotification('File deleted', 'info');
    }
}

async function openMoveLibraryItemModal(itemId, itemType) {
    moveItemState = { itemId, itemType };
    const modal = document.getElementById('moveItemModal');
    const container = document.getElementById('moveDestinationList');
    if (!modal || !container) return;

    const allFolders = await UserLibraryDbService.query("SELECT * FROM folders ORDER BY name ASC");
    
    container.innerHTML = `
        <div class="move-destination ${UserLibraryDbService.currentFolderId === null ? 'selected' : ''}" onclick="selectMoveDestination(null, this)">
            <i class="fas fa-home"></i> Root Library
        </div>
        ${allFolders.map(f => `
            <div class="move-destination ${UserLibraryDbService.currentFolderId === f.id ? 'selected' : ''}" onclick="selectMoveDestination(${f.id}, this)">
                <i class="fas fa-folder" style="color: ${f.color || '#3b82f6'}"></i> ${escapeHtml(f.name)}
            </div>
        `).join('')}
    `;

    modal.classList.add('active');
}

function selectMoveDestination(folderId, element) {
    selectedMoveDestinationId = folderId;
    document.querySelectorAll('.move-destination').forEach(el => el.classList.remove('selected'));
    if (element) element.classList.add('selected');
}

function closeMoveItemModal() {
    document.getElementById('moveItemModal')?.classList.remove('active');
}

async function confirmMoveItem() {
    if (moveItemState.itemId !== null) {
        await UserLibraryDbService.moveItem(moveItemState.itemId, moveItemState.itemType, selectedMoveDestinationId);
        closeMoveItemModal();
        await renderLibrary();
        showNotification('Item moved successfully', 'success');
    }
}

function openPdfFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.txt,.md,.markdown,.json,.csv,.docx';
    input.multiple = true;
    input.onchange = async (e) => {
        if (e.target.files.length) {
            await processAndImportFiles(Array.from(e.target.files));
        }
    };
    input.click();
}

async function importPdfToLibrary(file) {
    if (!file) return;
    await processAndImportFiles([file]);
}

function handleLibraryDragOver(e) {
    e.preventDefault();
}

function handleLibraryDragLeave(e) {
    e.preventDefault();
}

async function handleLibraryDrop(e) {
    e.preventDefault();
    const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
    if (!isTauri && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        await processAndImportFiles(Array.from(e.dataTransfer.files));
    }
}

function initLibraryDragDrop() {
    const dropZone = document.getElementById('libraryDropZone');
    const settingsDropZone = document.getElementById('dropZone');
    const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

    [dropZone, settingsDropZone].forEach(el => {
        if (!el) return;

        el.addEventListener('dragenter', (e) => {
            if (!draggedLibraryItem) {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add('drag-over');
            }
        }, false);

        el.addEventListener('dragover', (e) => {
            if (!draggedLibraryItem) {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'copy';
                }
                el.classList.add('drag-over');
            }
        }, false);

        el.addEventListener('dragleave', (e) => {
            if (!draggedLibraryItem) {
                e.preventDefault();
                e.stopPropagation();
                if (!el.contains(e.relatedTarget)) {
                    el.classList.remove('drag-over');
                }
            }
        }, false);
        
        el.addEventListener('drop', async (e) => {
            if (!draggedLibraryItem) {
                e.preventDefault();
                e.stopPropagation();
                clearDragHoverStyles();
                if (!isTauri && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    await processAndImportFiles(Array.from(e.dataTransfer.files));
                }
            }
        }, false);
    });
}

// ============================================
// 15. TAGS SECTION & TAGGING ITEMS
// ============================================
var currentTaggingItem = window.currentTaggingItem || null;

function openTagItemModal(itemId, itemName, itemType) {
    currentTaggingItem = { id: itemId, name: itemName, type: itemType };
    
    const modal = document.getElementById('tagItemModal');
    const nameEl = document.getElementById('tagItemName');
    
    if (nameEl) nameEl.textContent = `Tagging: ${itemName}`;
    
    renderAvailableTags();
    renderCurrentItemTags();
    
    if (modal) modal.classList.add('active');
}

function closeTagItemModal() {
    const modal = document.getElementById('tagItemModal');
    if (modal) modal.classList.remove('active');
    currentTaggingItem = null;
}

function renderAvailableTags() {
    const container = document.getElementById('availableTagsList');
    if (!container) return;
    
    if (tags.length === 0) {
        container.innerHTML = '<p class="empty-state">No tags available. Create some tags first!</p>';
        return;
    }
    
    const itemId = currentTaggingItem?.id;
    const currentTags = itemId ? (itemTags[itemId] || []) : [];
    
    container.innerHTML = tags.map(tag => {
        const isApplied = currentTags.includes(tag.id);
        return `
            <button class="tag-chip ${isApplied ? 'applied' : ''}" 
                    style="--tag-color: ${tag.color}" 
                    onclick="toggleTagOnItem('${tag.id}')">
                <span class="tag-dot" style="background: ${tag.color}"></span>
                ${escapeHtml(tag.name)}
                ${isApplied ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}
            </button>
        `;
    }).join('');
}

function renderCurrentItemTags() {
    const container = document.getElementById('currentItemTags');
    if (!container || !currentTaggingItem) return;
    
    const currentTags = itemTags[currentTaggingItem.id] || [];
    
    if (currentTags.length === 0) {
        container.innerHTML = '<p class="empty-state">No tags applied</p>';
        return;
    }
    
    container.innerHTML = currentTags.map(tagId => {
        const tag = tags.find(t => t.id === tagId);
        if (!tag) return '';
        return `
            <span class="tag-badge" style="background: ${tag.color}20; border-color: ${tag.color}">
                <span class="tag-dot" style="background: ${tag.color}"></span>
                ${escapeHtml(tag.name)}
                <button onclick="toggleTagOnItem('${tag.id}')" class="tag-remove"><i class="fas fa-times"></i></button>
            </span>
        `;
    }).join('');
}

function toggleTagOnItem(tagId) {
    if (!currentTaggingItem) return;
    
    const itemId = currentTaggingItem.id;
    if (!itemTags[itemId]) itemTags[itemId] = [];
    
    const idx = itemTags[itemId].indexOf(tagId);
    if (idx === -1) {
        itemTags[itemId].push(tagId);
    } else {
        itemTags[itemId].splice(idx, 1);
    }
    
    saveTags();
    renderAvailableTags();
    renderCurrentItemTags();
    renderTagsMain();
}

function renderTagsMain() {
    const container = document.getElementById('tagsListMain');
    if (!container) return;
    
    if (tags.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="fas fa-tags"></i> No tags created yet. Create your first tag!</p>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-card" style="--tag-color: ${tag.color}">
            <div class="tag-card-header">
                <span class="tag-dot-lg" style="background: ${tag.color}"></span>
                <span class="tag-card-name">${escapeHtml(tag.name)}</span>
                <span class="tag-card-count">${countItemsWithTag(tag.id)} items</span>
            </div>
            <div class="tag-card-actions">
                <button onclick="filterByTag('${tag.id}')" class="btn btn-sm btn-secondary">
                    <i class="fas fa-filter"></i> View Items
                </button>
                <button onclick="deleteTag('${tag.id}')" class="btn btn-sm btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderTaggedItems(tagId = null) {
    const container = document.getElementById('taggedItemsList');
    if (!container) return;
    
    const items = [];
    
    Object.entries(itemTags).forEach(([itemId, tagIds]) => {
        if (tagIds.length === 0) return;
        if (!tagId || tagIds.includes(tagId)) {
            items.push({ id: itemId, tags: tagIds });
        }
    });
    
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="fas fa-folder-open"></i> No tagged items yet.</p>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const itemTagBadges = item.tags.map(tid => {
            const tag = tags.find(t => t.id === tid);
            return tag ? `<span class="tag-mini" style="background: ${tag.color}">${escapeHtml(tag.name)}</span>` : '';
        }).join('');
        
        const isFolder = item.id.startsWith('folder_');
        const isDoc = item.id.startsWith('doc_');
        let displayName = item.id;
        let icon = 'fa-file';
        if (isFolder) {
            displayName = item.id.replace('folder_', '').split('/').pop();
            icon = 'fa-folder';
        } else if (isDoc) {
            displayName = item.id.replace('doc_', '').split('/').pop();
            icon = 'fa-file-pdf';
        }
        
        return `
            <div class="tagged-item" data-item-id="${escapeHtml(item.id)}" onclick="navigateToTaggedItem('${escapeHtml(item.id)}')">
                <span class="tagged-item-id"><i class="fas ${icon}" style="margin-right: 6px; opacity: 0.5;"></i>${escapeHtml(displayName)}</span>
                <div class="tagged-item-tags">${itemTagBadges}</div>
            </div>
        `;
    }).join('');
}

function filterByTag(tagId) {
    renderTaggedItems(tagId);
    const section = document.querySelector('.tagged-items-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const tag = tags.find(t => t.id === tagId);
    const tagName = tag ? tag.name : 'selected tag';
    showNotification(`Showing items tagged "${tagName}"`, 'info');
}

function navigateToTaggedItem(itemId) {
    if (itemId.startsWith('folder_')) {
        const pathStr = itemId.replace('folder_', '');
        const pathArray = pathStr.split('/').filter(s => s);
        if (typeof window.navigateToPath === 'function') {
            if (typeof window.showView === 'function') window.showView('home');
            window.navigateToPath(pathArray);
        }
    } else if (itemId.startsWith('doc_')) {
        const pathStr = itemId.replace('doc_', '');
        const segments = pathStr.split('/').filter(s => s);
        const fileName = segments.pop();
        if (typeof window.navigateToPath === 'function' && fileName) {
            if (typeof window.showView === 'function') window.showView('home');
            window.navigateToPath(segments);
            setTimeout(() => {
                let level = window.documents || {};
                for (const seg of segments) {
                    if (level && typeof level === 'object') level = level[seg];
                    else { level = null; break; }
                }
                const value = level ? level[fileName] : null;
                if (value && typeof value === 'string') {
                    openAnyDocument(value, fileName);
                } else {
                    showNotification('Could not open file — it may have been moved or deleted.', 'warning');
                }
            }, 100);
        }
    } else {
        showNotification('Item type not recognized', 'info');
    }
}

// ============================================
// 16. PDF POSITION MEMORY
// ============================================
var pdfPositions = window.pdfPositions || JSON.parse(localStorage.getItem('questionary-pdf-positions') || '{}');
window.pdfPositions = pdfPositions;

function savePdfPosition(pdfUrl, position) {
    pdfPositions[pdfUrl] = {
        scrollTop: position.scrollTop || 0,
        page: position.page || 1,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('questionary-pdf-positions', JSON.stringify(pdfPositions));
}

function getPdfPosition(pdfUrl) {
    return pdfPositions[pdfUrl] || null;
}

function restorePdfPosition(pdfUrl) {
    const position = getPdfPosition(pdfUrl);
    if (!position) return;
    
    const iframe = document.getElementById('pdfViewer');
    if (iframe && iframe.contentWindow) {
        setTimeout(() => {
            iframe.contentWindow.postMessage({ 
                type: 'restorePosition', 
                scrollTop: position.scrollTop,
                page: position.page 
            }, '*');
        }, 1000);
        showNotification(`Restored to page ${position.page}`, 'info');
    }
}

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'pdfScroll') {
        const pdfUrl = window.currentPdfUrlForBookmarks;
        if (pdfUrl) {
            savePdfPosition(pdfUrl, {
                scrollTop: event.data.scrollTop,
                page: event.data.page
            });
        }
    }
});

// ============================================
// 17. VOICE NOTES GRID FOR NOTES SECTION
// ============================================
function renderVoiceNotesGrid() {
    const container = document.getElementById('voiceNotesGrid');
    if (!container) return;
    
    if (voiceNotes.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="fas fa-microphone-slash"></i> No voice notes yet. Record your first one!</p>';
        return;
    }
    
    container.innerHTML = voiceNotes.map(note => `
        <div class="voice-note-card" data-id="${note.id}">
            <div class="voice-note-header">
                <span class="voice-note-date">${new Date(note.createdAt).toLocaleString()}</span>
                <span class="voice-note-duration">${note.duration || '0:00'}</span>
            </div>
            <div class="voice-note-actions">
                <button class="btn btn-primary btn-sm play-voice-note" data-id="${note.id}">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openTagItemModal('voicenote_${note.id}', '${escapeHtml(note.title || 'Voice Note')}', 'voicenote')">
                    <i class="fas fa-tag"></i>
                </button>
                <button class="btn btn-danger btn-sm delete-voice-note" data-id="${note.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// 18. INITIALIZATION & SETTINGS UI
// ============================================
function renderSettings() {
    initThemeOnLoad();
    renderTagsList();
    renderVoiceNotes();
    renderDashboardWidgets();
    if (typeof window.renderKeybindsSettings === 'function') window.renderKeybindsSettings();
    if (typeof window.initStudyRoomMediaSettings === 'function') window.initStudyRoomMediaSettings();
}

function initSettingsUI() {
    const exportBtn = document.getElementById('exportAllDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAllData);
    }
    
    const importInput = document.getElementById('importDataInput');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const data = JSON.parse(evt.target.result);
                        importData(data);
                    } catch (err) {
                        showNotification('Invalid backup file', 'error');
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        const themeOption = e.target.closest('.theme-option');
        if (themeOption && themeOption.dataset.theme) {
            e.preventDefault();
            setTheme(themeOption.dataset.theme);
            return;
        }
        
        if (e.target.closest('#recordBtn')) {
            e.preventDefault();
            toggleRecording();
            return;
        }
        
        if (e.target.closest('#createTagBtn')) {
            e.preventDefault();
            openTagModal();
            return;
        }
        
        if (e.target.closest('#saveTagBtn')) {
            e.preventDefault();
            saveTag();
            return;
        }
        
        if (e.target.closest('#cancelTagBtn') || e.target.closest('#closeTagModal')) {
            closeTagModal();
            return;
        }
        
        if (e.target.closest('#addReminderBtn')) {
            e.preventDefault();
            openReminderModal();
            return;
        }
        
        if (e.target.closest('#saveReminderBtn')) {
            e.preventDefault();
            saveReminderFromModal();
            return;
        }
        
        if (e.target.closest('#cancelReminderBtn') || e.target.closest('#closeReminderModal')) {
            closeReminderModal();
            return;
        }
        
        if (e.target.closest('#closeQuizModal')) {
            closeQuizModal();
            return;
        }
        
        if (e.target.closest('.play-voice-note')) {
            const btn = e.target.closest('.play-voice-note');
            const id = btn.dataset.id;
            if (id) playVoiceNote(id);
            return;
        }
        
        if (e.target.closest('.delete-voice-note')) {
            const btn = e.target.closest('.delete-voice-note');
            const id = btn.dataset.id;
            if (id) deleteVoiceNote(id);
            return;
        }
        
        if (e.target.closest('#addBookmarkBtn')) {
            e.preventDefault();
            openBookmarkModal();
            return;
        }
        
        if (e.target.closest('#toggleBookmarksBtn')) {
            e.preventDefault();
            toggleBookmarksPanel();
            return;
        }
        
        if (e.target.closest('#backToDocumentsBtn')) {
            e.preventDefault();
            closePdfViewer();
            return;
        }
        
        if (e.target.closest('#saveBookmarkBtn')) {
            e.preventDefault();
            saveBookmarkFromModal();
            return;
        }
        
        if (e.target.closest('#cancelBookmarkBtn') || e.target.closest('#closeBookmarkModal')) {
            closeBookmarkModal();
            return;
        }
        
        if (e.target.closest('#closeTagItemModal') || e.target.closest('#closeTagItemModalBtn')) {
            closeTagItemModal();
            return;
        }
        
        if (e.target.closest('#createTagBtnMain')) {
            e.preventDefault();
            openTagModal();
            return;
        }
        
        if (e.target.closest('#importPdfBtn')) {
            e.preventDefault();
            openPdfFilePicker();
            return;
        }
        
        if (e.target.closest('.alarm-option')) {
            const option = e.target.closest('.alarm-option');
            const sound = option.dataset.sound;
            if (sound) setAlarmSound(sound);
            return;
        }
        
        if (e.target.closest('.preview-sound')) {
            e.stopPropagation();
            const btn = e.target.closest('.preview-sound');
            const sound = btn.dataset.sound;
            if (sound) previewAlarmSound(sound);
            return;
        }
        
        if (e.target.closest('#recordBtnNotes')) {
            e.preventDefault();
            toggleRecordingNotes();
            return;
        }
    });
    
    const customAlarmInput = document.getElementById('customAlarmInput');
    if (customAlarmInput) {
        customAlarmInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleCustomSoundUpload(file);
        });
    }
    
    const volumeSlider = document.getElementById('alarmVolume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            setAlarmVolume(e.target.value);
        });
    }
}

function openTagModal() {
    const modal = document.getElementById('tagModal');
    if (modal) {
        modal.classList.add('active');
        const nameInput = document.getElementById('tagNameInput');
        const colorInput = document.getElementById('tagColorInput');
        if (nameInput) nameInput.value = '';
        if (colorInput) colorInput.value = '#cf6215';
    }
}

function closeTagModal() {
    const modal = document.getElementById('tagModal');
    if (modal) modal.classList.remove('active');
}

function saveTag() {
    const name = document.getElementById('tagNameInput')?.value.trim();
    const color = document.getElementById('tagColorInput')?.value || '#cf6215';
    if (name) {
        createTag(name, color);
        closeTagModal();
    } else {
        showNotification('Please enter a tag name', 'warning');
    }
}

function openReminderModal() {
    const modal = document.getElementById('reminderModal');
    if (modal) {
        modal.classList.add('active');
        const titleEl = document.getElementById('reminderTitle');
        const timeEl = document.getElementById('reminderTime');
        if (titleEl) titleEl.value = '';
        if (timeEl) timeEl.value = '';
        document.querySelectorAll('#reminderDays input').forEach(cb => cb.checked = false);
    }
}

function closeReminderModal() {
    const modal = document.getElementById('reminderModal');
    if (modal) modal.classList.remove('active');
}

function saveReminderFromModal() {
    const title = document.getElementById('reminderTitle')?.value.trim();
    const time = document.getElementById('reminderTime')?.value;
    const days = Array.from(document.querySelectorAll('#reminderDays input:checked'))
                      .map(cb => parseInt(cb.value, 10));
    
    if (!title || !time) {
        showNotification('Please fill in title and time', 'warning');
        return;
    }
    
    if (days.length === 0) {
        showNotification('Please select at least one day', 'warning');
        return;
    }
    
    addStudyReminder(title, time, days);
    closeReminderModal();
}

async function initEnhancedFeatures() {
    console.log('[Features] Initializing enhanced features...');
    await UserLibraryDbService.init();
    
    initReminders();
    initDragDropImport();
    initLibraryDragDrop();
    initThemeOnLoad();
    initAlarmUI();
    initSettingsUI();
    
    if (dashboardLayout.widgets) {
        applyDashboardLayout();
    }
    
    renderVoiceNotesGrid();
    renderTagsMain();
    renderTaggedItems();
    renderLibrary();
    
    console.log('[Features] Enhanced features initialized successfully');
}

// Backward Compatibility Aliases
function renderImportedPdfs() { renderLibrary(); }
function openLibraryFolder(index) { navigateToLibraryStackIndex(index); }
function goBackInLibrary() { navigateToLibraryRoot(); }
function navigateToLibraryPath() { navigateToLibraryRoot(); }
function moveLibraryFolderToDocuments() {}
function openLibraryPdf() {}
function movePdfToFolder() {}
function handleFolderDragOver(e) { e.preventDefault(); }
function handleFolderDragLeave() {}
function handleFolderDrop(e) { e.preventDefault(); }
function handlePdfDragStart() {}
function handlePdfDragEnd() {}

// Global Exports
window.UserLibraryDbService = UserLibraryDbService;
window.getPdfBlob = async function(blobId) {
    return await UserLibraryFileStore.getFileBlob(blobId);
};
window.savePdfBlob = async function(id, blob) {
    return await UserLibraryFileStore.saveFile(id, blob);
};
window.deletePdfBlob = async function(id) {
    return await UserLibraryFileStore.removeFile(id);
};

window.openAnyDocument = openAnyDocument;
window.showTextFile = showTextFile;
window.closeTextViewer = closeTextViewer;
window.copyTextViewerContent = copyTextViewerContent;
window.downloadTextContent = downloadTextContent;
window.showDocxFile = showDocxFile;
window.closeDocxViewer = closeDocxViewer;
window.downloadDocxContent = downloadDocxContent;

window.addPdfBookmark = addPdfBookmark;
window.removePdfBookmark = removePdfBookmark;
window.getPdfBookmarks = getPdfBookmarks;
window.renderPdfBookmarks = renderPdfBookmarks;
window.goToPdfPage = goToPdfPage;
window.openBookmarkModal = openBookmarkModal;
window.closeBookmarkModal = closeBookmarkModal;
window.saveBookmarkFromModal = saveBookmarkFromModal;
window.toggleBookmarksPanel = toggleBookmarksPanel;

window.addPdfAnnotation = addPdfAnnotation;
window.getPdfAnnotations = getPdfAnnotations;
window.deletePdfAnnotation = deletePdfAnnotation;

window.startQuiz = startQuiz;
window.closeQuizModal = closeQuizModal;
window.submitTypedAnswer = submitTypedAnswer;

window.addStudyReminder = addStudyReminder;
window.deleteReminder = deleteReminder;
window.toggleReminder = toggleReminder;
window.renderReminders = renderReminders;

window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.getCurrentTheme = getCurrentTheme;
window.initThemeOnLoad = initThemeOnLoad;
window.toggleCustomTheme = toggleCustomTheme;
window.updateCustomTheme = updateCustomTheme;
window.saveCustomTheme = saveCustomTheme;
window.resetCustomTheme = resetCustomTheme;
window.clearInlineThemeVars = clearInlineThemeVars;

window.createTag = createTag;
window.deleteTag = deleteTag;
window.addTagToItem = addTagToItem;
window.removeTagFromItem = removeTagFromItem;
window.getItemTags = getItemTags;
window.getItemsByTag = getItemsByTag;
window.openTagModal = openTagModal;
window.closeTagModal = closeTagModal;
window.saveTag = saveTag;
window.openTagItemModal = openTagItemModal;
window.closeTagItemModal = closeTagItemModal;
window.toggleTagOnItem = toggleTagOnItem;
window.renderTagsMain = renderTagsMain;
window.renderTaggedItems = renderTaggedItems;
window.filterByTag = filterByTag;
window.navigateToTaggedItem = navigateToTaggedItem;

window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.startRecordingNotes = startRecordingNotes;
window.toggleRecording = toggleRecording;
window.toggleRecordingNotes = toggleRecordingNotes;
window.playVoiceNote = playVoiceNote;
window.deleteVoiceNote = deleteVoiceNote;
window.renderVoiceNotesGrid = renderVoiceNotesGrid;

window.exportAllData = exportAllData;
window.importData = importData;

window.toggleWidgetVisibility = toggleWidgetVisibility;
window.reorderWidget = reorderWidget;
window.applyDashboardLayout = applyDashboardLayout;
window.renderDashboardWidgets = renderDashboardWidgets;

window.renderEnhancedAnalytics = renderEnhancedAnalytics;

window.setAlarmSound = setAlarmSound;
window.setAlarmVolume = setAlarmVolume;
window.previewAlarmSound = previewAlarmSound;
window.playAlarmSound = playAlarmSound;
window.stopAlarmSound = stopAlarmSound;
window.initAlarmUI = initAlarmUI;

window.renderLibrary = renderLibrary;
window.toggleLibraryEditMode = toggleLibraryEditMode;
window.openLibraryFolder = openLibraryFolder;
window.goBackInLibrary = goBackInLibrary;
window.navigateToLibraryRoot = navigateToLibraryRoot;
window.navigateToLibraryStackIndex = navigateToLibraryStackIndex;
window.navigateToLibraryPath = navigateToLibraryPath;
window.openCreateLibraryFolderModal = openCreateLibraryFolderModal;
window.closeLibraryFolderModal = closeLibraryFolderModal;
window.selectLibraryFolderColor = selectLibraryFolderColor;
window.saveLibraryFolder = saveLibraryFolder;
window.renameLibraryFolder = renameLibraryFolder;
window.renameLibraryFile = renameLibraryFile;
window.deleteLibraryFolder = deleteLibraryFolder;
window.deleteLibraryFile = deleteLibraryFile;
window.openMoveLibraryItemModal = openMoveLibraryItemModal;
window.selectMoveDestination = selectMoveDestination;
window.closeMoveItemModal = closeMoveItemModal;
window.confirmMoveItem = confirmMoveItem;
window.openPdfFilePicker = openPdfFilePicker;
window.importPdfToLibrary = importPdfToLibrary;
window.handleLibraryDragOver = handleLibraryDragOver;
window.handleLibraryDragLeave = handleLibraryDragLeave;
window.handleLibraryDrop = handleLibraryDrop;
window.renderImportedPdfs = renderImportedPdfs;
window.moveLibraryFolderToDocuments = moveLibraryFolderToDocuments;
window.openLibraryPdf = openLibraryPdf;
window.movePdfToFolder = movePdfToFolder;
window.handleFolderDragOver = handleFolderDragOver;
window.handleFolderDragLeave = handleFolderDragLeave;
window.handleFolderDrop = handleFolderDrop;
window.handlePdfDragStart = handlePdfDragStart;
window.handlePdfDragEnd = handlePdfDragEnd;

window.savePdfPosition = savePdfPosition;
window.getPdfPosition = getPdfPosition;
window.restorePdfPosition = restorePdfPosition;

window.openReminderModal = openReminderModal;
window.closeReminderModal = closeReminderModal;
window.saveReminderFromModal = saveReminderFromModal;

window.renderSettings = renderSettings;
window.initEnhancedFeatures = initEnhancedFeatures;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedFeatures);
} else {
    initEnhancedFeatures();
}
