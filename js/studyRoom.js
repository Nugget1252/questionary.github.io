/* ============================================================
   Study Room — Live Collaborative Study Sessions
   ────────────────────────────────────────────────
   Supports TWO networking modes:
     1) LAN — host starts a local relay server (Rust/Tauri)
     2) Internet — both parties connect to a public relay server

   NO WebRTC / PeerJS required — works on every OS & webview.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- constants ---------- */
  const MAX_PARTICIPANTS = 8;
  const PROGRESS_SYNC_INTERVAL = 10000; // 10 s
  const ROOM_CODE_LENGTH = 10;
  const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const DEFAULT_RELAY_URL = normalizeRelayUrl(
    (window.QUESTIONARY_RELAY_URL || '').trim() ||
    localStorage.getItem('questionary-relay-url') ||
    'peerjs-server' // Replace this with your production WebSocket URL (e.g. wss://relay.yourdomain.com)
  );

  /* ---------- state ---------- */
  let ws = null;              // WebSocket connection
  let myId = '';              // client-id assigned by the relay server
  let peers = {};             // peerId → { nickname, goal, seconds }
  let serverPort = 0;        // port the relay is running on (host only)
  let roomAddress = '';       // "ip:port" displayed to the host for sharing
  let isHost = false;
  let nickname = '';
  let roomPassword = '';
  let studyTimer = null;
  let studySeconds = 0;
  let studyGoal = '';
  let chatMessages = [];
  let sessionActive = false;
  let internetMode = false;   // true when using a public relay server
  let relayUrl = '';           // full relay WS URL, e.g. wss://relay.example.com
  let internetRoomId = '';     // room id on the public relay

  /* ---------- webrtc state ---------- */
  let localScreenStream = null;
  let localMediaStream = null;
  let micActive = false;
  let camActive = false;
  let peerMediaConnections = {}; 
  let peerConnections = {}; 
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  /* ---------- whiteboard state ---------- */
  let wbActive = false;
  let wbCanvas = null;
  let wbCtx = null;
  let wbOverlay = null;
  let wbOCtx = null;
  let wbDrawing = false;
  let wbPanning = false;
  let wbColor = '#ffffff';
  let wbPenSize = 3;
  let wbEraserSize = 20;
  let wbHighlighterSize = 18;
  let wbTool = 'pen';
  let wbStrokes = [];     // stroke commands for undo (lightweight, no pixel data)
  let wbRedoStrokes = [];
  let wbQuestions = [];
  let wbNextQId = 1;
  let wbBlockStart = null;
  let wbBlockRect = null;
  let wbFullscreen = false;

  /* --- infinite canvas: pan & zoom --- */
  let wbCanvasW = 4096;   // dynamic — grows as needed
  let wbCanvasH = 4096;
  let wbZoom = 1;
  let wbPanX = 0;
  let wbPanY = 0;
  let wbPanStart = null;
  let wbSpaceDown = false;

  /* ================================================================
     HELPERS
     ================================================================ */
  function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- room code encoding ---------- */

  /* Legacy LAN codes (kept for backward parsing only): XXXX-XXXX-XX */
  function encodeRoomCode(ip, port) {
    const o = ip.split('.').map(Number);
    const n = (BigInt(o[0]) << 40n) | (BigInt(o[1]) << 32n) |
              (BigInt(o[2]) << 24n) | (BigInt(o[3]) << 16n) | BigInt(port);
    let code = n.toString(36).toUpperCase();
    while (code.length < 10) code = '0' + code;
    // Format: XXXX-XXXX-XX
    return code.slice(0, 4) + '-' + code.slice(4, 8) + '-' + code.slice(8);
  }

  function decodeRoomCode(code) {
    const clean = code.replace(/[-\s]/g, '').toLowerCase();
    if (!/^[0-9a-z]{6,12}$/.test(clean)) return null;
    let num = 0n;
    for (const ch of clean) {
      const d = parseInt(ch, 36);
      if (isNaN(d)) return null;
      num = num * 36n + BigInt(d);
    }
    const port = Number(num & 0xFFFFn);
    num >>= 16n;
    const ip = [
      Number((num >> 24n) & 0xFFn),
      Number((num >> 16n) & 0xFFn),
      Number((num >> 8n) & 0xFFn),
      Number(num & 0xFFn)
    ].join('.');
    if (port === 0 || port > 65535) return null;
    return { ip, port };
  }

  /* Internet room codes: 10-character alphanumeric code */
  function generateRoomId() {
    let id = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      id += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return id;
  }

  function normalizeRoomCode(raw) {
    if (!raw) return '';
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== ROOM_CODE_LENGTH) return '';
    return code;
  }

  /** Build a valid WebSocket URL from a relay host string.
      Accepts: "host", "host:port", "ws://host:port", "wss://host:port" */
  function normalizeRelayUrl(input) {
    let s = input.trim();
    if (!s) return '';
    if (!/^wss?:\/\//i.test(s)) {
      // Default to wss:// for security; use ws:// only if port 80 or explicit
      s = 'wss://' + s;
    }
    // Strip trailing slash
    return s.replace(/\/+$/, '');
  }

  /* ================================================================
     TAURI INVOKE HELPER
     ================================================================ */
  async function tauriInvoke(cmd, args) {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    throw new Error('Tauri runtime not available');
  }

  /* ================================================================
     WEBSOCKET LAYER
     ================================================================ */
  /** Connect to a WebSocket server.
   *  @param {string} address  — either "ip:port" (LAN) or full "wss://..." URL (Internet) */

  class PeerJSRoomHub {
    constructor() {
      this.readyState = WebSocket.CONNECTING;
      this.peers = new Map(); // client connections for data
      this.hostId = null;
      this.localPeerId = null;
      this.isServer = isHost;
      this.nextServerId = 1;
      this.serverClients = new Map(); // id -> { nickname, peerJsId }
      this.calls = [];
    }
    
    init(address) {
      return new Promise((resolve, reject) => {
        const pOpts = {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        };
        
        if (isHost) {
          const expectedHostId = 'qroom-' + internetRoomId.toLowerCase();
          console.log("Starting host PeerJS id:", expectedHostId);
          console.log("RTCPeerConnection:", typeof window.RTCPeerConnection); console.log("navigator.mediaDevices:", typeof (navigator.mediaDevices)); if (navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) { navigator.mediaDevices.getUserMedia = () => Promise.resolve(null); }
          this.peer = new Peer(expectedHostId, pOpts);
          this.localPeerId = expectedHostId;
        } else {
          this.peer = new Peer(pOpts);
        }
        
        this.peer.on('open', (id) => {
          this.localPeerId = id;
          if (isHost) {
            this.readyState = WebSocket.OPEN;
            resolve();
          } else {
            console.log("Client connecting to host...", 'qroom-' + internetRoomId.toLowerCase());
            this.hostConn = this.peer.connect('qroom-' + internetRoomId.toLowerCase(), { reliable: true });
            this.hostConn.on('open', () => {
              this.readyState = WebSocket.OPEN;
              resolve();
            });
            this.hostConn.on('data', (raw) => {
               if(this.onmessage) this.onmessage({ data: String(raw) });
            });
            this.hostConn.on('error', (err) => {
               if(this.onerror) this.onerror(err);
               reject(err);
            });
          }
        });
        
        this.peer.on('connection', (conn) => {
          if (isHost) {
             conn.on('data', (raw) => {
                this.mockServerHandle(conn, JSON.parse(raw));
             });
             conn.on('close', () => {
                this.mockServerDisconnect(conn.peer);
             });
          } else {
             // client to client data?
          }
        });
        
        // Handle incoming screen-share calls without manual WebRTC SDP logic!
        this.peer.on('call', (call) => {
           call.answer(); // answer without mic/video for viewing only
           call.on('stream', (remoteStream) => {
              // Find who called by searching peerJsId in peers state
              let callerId = 'host';
              for(let id in peers) {
                 if (peers[id].peerJsId === call.peer) {
                    callerId = id; break;
                 }
              }
              if (call.peer === ('qroom-' + internetRoomId.toLowerCase())) callerId = 'host'; // or whoever is host internal ID
              // Wait, who is host relative to me? 
              // We'll just pass callerId to renderRemoteVideo
              renderRemoteVideo(call.peer, remoteStream); // we use their peerJsId as DOM id!
           });
        });
        
        this.peer.on('error', (err) => {
          console.error("PeerJS Error:", err);
          if (this.onerror) this.onerror(err);
          reject(err);
        });
      });
    }
    
    send(str) {
      if (!isHost) {
         if (this.hostConn && this.hostConn.open) {
             const obj = JSON.parse(str);
             obj._clientPeerId = this.localPeerId;
             this.hostConn.send(JSON.stringify(obj));
         }
         return;
      }
      const msg = JSON.parse(str);
      const hostConnMock = { peer: 'host-self' };
      msg._clientPeerId = this.localPeerId;
      this.mockServerHandle(hostConnMock, msg);
    }
    
    close() {
      if (this.peer) this.peer.destroy();
      this.readyState = WebSocket.CLOSED;
      if(this.onclose) this.onclose();
    }
    
    // ----------- HOST RELAY -----------
    mockServerHandle(conn, msg) {
       const sendToClient = (peerId, obj) => {
          if (peerId === 'host-self') {
             if(this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
             return;
          }
          if (this.peers.has(peerId)) this.peers.get(peerId).send(JSON.stringify(obj));
       };
       const broadcast = (obj, excludePeerId) => {
          const strMsg = JSON.stringify(obj);
          for (const [pId, pConn] of this.peers.entries()) {
             if (pId !== excludePeerId) pConn.send(strMsg);
          }
          if (excludePeerId !== 'host-self') {
             if(this.onmessage) this.onmessage({ data: strMsg });
          }
       };
       
       switch(msg.action) {
          case 'host':
             const hId = "usr_" + this.nextServerId++;
             this.serverClients.set('host-self', { id: hId, nickname: msg.nickname, peerJsId: this.localPeerId });
             sendToClient('host-self', { action: 'welcome', id: hId });
             sendToClient('host-self', { action: 'hosted' });
             break;
          case 'join':
             if (this.password && msg.password !== this.password) {
                 conn.send(JSON.stringify({ action: 'auth-fail', reason: 'Incorrect password.' }));
                 //conn.close();
                 return;
             }
             this.peers.set(conn.peer, conn);
             const clId = "usr_" + this.nextServerId++;
             const cPjId = msg._clientPeerId;
             this.serverClients.set(conn.peer, { id: clId, nickname: msg.nickname, peerJsId: cPjId });
             sendToClient(conn.peer, { action: 'welcome', id: clId });
             // list peers
             const peerList = Array.from(this.serverClients.values()).filter(c => c.id !== clId);
             sendToClient(conn.peer, { action: 'joined', peers: peerList });
             broadcast({ action: 'peer-joined', id: clId, nickname: msg.nickname, peerJsId: cPjId }, conn.peer);
             break;
          case 'relay':
             const snd = this.serverClients.get(conn.peer);
             if(snd) broadcast({ action: 'relay', from: snd.id, data: msg.data }, conn.peer);
             break;
          case 'dm':
             const dSnd = this.serverClients.get(conn.peer);
             if(dSnd) {
                let tPeer = null;
                for (const [pId, cl] of this.serverClients.entries()) {
                   if (cl.id === msg.to) { tPeer = pId; break; }
                }
                if (tPeer) sendToClient(tPeer, { action: 'dm', from: dSnd.id, data: msg.data });
             }
             break;
       }
    }
    
    mockServerDisconnect(peerId) {
       this.peers.delete(peerId);
       const cl = this.serverClients.get(peerId);
       if (cl) {
          this.serverClients.delete(peerId);
          const strMsg = JSON.stringify({ action: 'peer-left', id: cl.id });
          for (const pc of this.peers.values()) pc.send(strMsg);
          if (this.onmessage) this.onmessage({ data: strMsg });
       }
    }
  }

  function connectWebSocket(address) {
    if (window.navigator && window.navigator.mediaDevices && !window.navigator.mediaDevices.getUserMedia) {
        window.navigator.mediaDevices.getUserMedia = () => Promise.resolve(null);
    }
    
    ws = new PeerJSRoomHub();
    ws.onopen = () => {};
    ws.onclose = () => handleDisconnect();
    ws.onerror = () => {};
    ws.onmessage = (event) => {
        try { handleServerMessage(JSON.parse(event.data)); }
        catch(e) {}
    };
    return ws.init(address);
  }
  function sendToServer(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function broadcastData(data) {
    sendToServer({ action: 'relay', data });
  }

  function sendToTarget(to, data) {
    sendToServer({ action: 'relay-to', to, data });
  }

  /* ================================================================
     SERVER MESSAGE HANDLING
     ================================================================ */
  function handleServerMessage(msg) {
    switch (msg.action) {
      case 'welcome':
        myId = msg.id;
        break;

      case 'hosted':
        sessionActive = true;
        startStudyTimer();
        hideLoading();
        renderActiveSession();
        if (typeof showNotification === 'function') {
          const pwNote = roomPassword ? ' \uD83D\uDD12 Password protected.' : '';
          showNotification(`Room created! Share code: ${roomAddress}${pwNote}`, 'success');
        }
        break;

      case 'joined':
        if (Array.isArray(msg.peers)) {
          msg.peers.forEach(p => {
            peers[p.id] = { nickname: p.nickname, goal: '', seconds: 0, peerJsId: p.peerJsId };
          });
        }
        sessionActive = true;
        startStudyTimer();
        hideLoading();
        renderActiveSession();
        // ask existing peers for their current info
        broadcastData({ type: 'info-request' });
        if (typeof showNotification === 'function')
          showNotification(`Joined room!`, 'success');
        break;

      case 'auth-fail':
        hideLoading();
        cleanup();
        renderStudyRoom();
        if (typeof showNotification === 'function')
          showNotification(msg.reason || 'Authentication failed.', 'error');
        break;

      case 'peer-joined':
        peers[msg.id] = { nickname: msg.nickname, goal: '', seconds: 0, peerJsId: msg.peerJsId };
        addSystemMessage(`${msg.nickname} joined the room`);
        updateParticipantsUI();
        updateProgressUI();
        updatePeopleCount();
        break;

      case 'peer-left': {
        const leftNick = peers[msg.id]?.nickname || 'A participant';
        addSystemMessage(`${leftNick} left the room`);
        delete peers[msg.id];
        updateParticipantsUI();
        updateProgressUI();
        updatePeopleCount();
        break;
      }

      case 'room-closed':
        addSystemMessage('The host has closed the room.');
        setTimeout(() => forceLeaveRoom(), 1500);
        break;

      case 'relay':
        handleRelayData(msg.from, msg.data);
        break;
    }
  }

  /* ---------- relay data dispatcher ---------- */
  function handleRelayData(fromId, data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'chat':
        chatMessages.push({ sender: data.sender, text: data.text, time: data.time, type: 'chat' });
        renderChatMessages();
        break;
      case 'progress':
        if (peers[fromId]) {
          peers[fromId].goal = data.goal || '';
          peers[fromId].seconds = data.seconds || 0;
        }
        updateProgressUI();
        break;
      case 'info':
        if (peers[fromId]) {
          peers[fromId].nickname = data.nickname || peers[fromId].nickname;
          peers[fromId].goal = data.goal || '';
          peers[fromId].seconds = data.seconds || 0;
        }
        updateParticipantsUI();
        updateProgressUI();
        break;
      case 'info-request':
        broadcastData({ type: 'info', nickname, goal: studyGoal, seconds: studySeconds });
        break;
      case 'wb-stroke':
        replayStroke(data.points, data.color, data.size, data.tool, data.alpha);
        wbStrokes.push({ type: 'stroke', points: data.points, color: data.color, size: data.size, tool: data.tool, alpha: data.alpha });
        if (data.points) maybeGrowCanvas(data.points);
        break;
      case 'wb-clear':
        clearCanvasLocal();
        break;
      case 'wb-block-erase':
        replayBlockErase(data.rect);
        wbStrokes.push({ type: 'block-erase', rect: data.rect });
        break;
      case 'wb-questions':
        wbQuestions = data.questions || [];
        wbNextQId = data.nextId || wbQuestions.length + 1;
        renderQuestionsUI();
        break;
      case 'webrtc-offer':
        handleRTCReceiveOffer(fromId, data.sdp);
        break;
      case 'webrtc-answer':
        handleRTCReceiveAnswer(fromId, data.sdp);
        break;
      case 'webrtc-ice':
        handleRTCReceiveIce(fromId, data.candidate);
        break;
      case 'study-material':
        receiveStudyMaterial(fromId, data.fileData, data.fileName);
        break;
      case 'webrtc-stop':
        // A peer stopped sharing
        const grid = document.getElementById('srParticipantsGrid');
        if (grid) {
            const tiles = grid.querySelectorAll('.sr-video-tile:not(.sr-video-local)');
            tiles.forEach(t => {
               const lbl = t.querySelector('.sr-video-label');
               if (lbl && lbl.textContent.includes(peers[fromId]?.nickname)) {
                   const v = t.querySelector('.sr-screen-video');
                   if (v) {
                       v.pause();
                       v.srcObject = null;
                       v.removeAttribute('src');
                       v.load();
                       v.remove();
                   }
                   const off = t.querySelector('.sr-video-off');
                   if(off && !t.querySelector('.sr-cam-video')) {
                       off.style.display = 'flex';
                       off.innerHTML = '<i class="fas fa-user"></i>';
                   }
               }
            });
        }
        break;
      case 'webrtc-media-offer':
        handleMediaRTCReceiveOffer(fromId, data.sdp);
        break;
      case 'webrtc-media-answer':
        handleMediaRTCReceiveAnswer(fromId, data.sdp);
        break;
      case 'webrtc-media-ice':
        handleMediaRTCReceiveIce(fromId, data.candidate);
        break;
      case 'webrtc-media-stop':
        const mgrid = document.getElementById('srParticipantsGrid');
        if (mgrid) {
            const mtiles = mgrid.querySelectorAll('.sr-video-tile:not(.sr-video-local)');
            mtiles.forEach(t => {
               const lbl = t.querySelector('.sr-video-label');
               if (lbl && lbl.textContent.includes(peers[fromId]?.nickname)) {
                   const cv = t.querySelector('.sr-cam-video');
                   if (cv) {
                       cv.pause();
                       cv.srcObject = null;
                       cv.removeAttribute('src');
                       cv.load();
                       cv.remove();
                   }
                   const off = t.querySelector('.sr-video-off');
                   if(off && !t.querySelector('.sr-screen-video')) {
                       off.style.display = 'flex';
                       off.innerHTML = '<i class="fas fa-user"></i>';
                   }
               }
            });
        }
        break;
    }
  }

  /* ---------- disconnect handler ---------- */
  function handleDisconnect() {
    if (!sessionActive) return;
    addSystemMessage('Connection lost.');
    setTimeout(() => forceLeaveRoom(), 1500);
  }

  /* ================================================================
     UI — LOBBY
     ================================================================ */
  function renderStudyRoom() {
    const section = document.getElementById('studyRoomSection');
    if (!section) return;

    if (sessionActive) { renderActiveSession(); return; }

    const savedNick = localStorage.getItem('questionary-study-nickname') || '';
    section.innerHTML = `
      <div class="sr-lobby">
        <div class="sr-lobby-header">
          <h2 class="section-title">Study Room</h2>
          <span class="sr-exp-badge">experimental</span>
          <div class="sr-lobby-icon"><i class="fas fa-users"></i></div>
          <p class="sr-lobby-subtitle">Study together with friends in real-time across the internet via a relay server.</p>
        </div>

        <div class="sr-lobby-cards">
          <!-- Nickname -->
          <div class="sr-lobby-card">
            <h3><i class="fas fa-user-edit"></i> Your Display Name</h3>
            <input type="text" id="srNickname" class="sr-input" placeholder="Enter your name…" maxlength="24" value="${savedNick}">
          </div>

          <!-- Create -->
          <div class="sr-lobby-card sr-card-create">
            <h3><i class="fas fa-plus-circle"></i> Create a Room</h3>
            <p>Create an internet room and share the 10-character code.</p>

            <div class="sr-pw-row">
              <input type="password" id="srCreatePassword" class="sr-input" placeholder="Room password (optional)" maxlength="32" autocomplete="off">
              <button type="button" class="sr-pw-toggle" id="srCreatePwToggle" title="Show password"><i class="fas fa-eye"></i></button>
            </div>
            <button class="sr-btn sr-btn-primary" id="srCreateBtn"><i class="fas fa-door-open"></i> Create Room</button>
          </div>

          <!-- Join -->
          <div class="sr-lobby-card sr-card-join">
            <h3><i class="fas fa-sign-in-alt"></i> Join a Room</h3>
            <p>Enter the room code shared by the host.</p>
            <div class="sr-join-row">
              <input type="text" id="srJoinAddress" class="sr-input" placeholder="10-character room code" spellcheck="false" autocomplete="off" style="flex:1;letter-spacing:0.08em;">
              <button class="sr-btn sr-btn-accent" id="srJoinBtn"><i class="fas fa-sign-in-alt"></i> Join</button>
            </div>
            <div class="sr-pw-row" style="margin-top:0.5rem;">
              <input type="password" id="srJoinPassword" class="sr-input" placeholder="Room password (if required)" maxlength="32" autocomplete="off">
              <button type="button" class="sr-pw-toggle" id="srJoinPwToggle" title="Show password"><i class="fas fa-eye"></i></button>
            </div>
            <small class="sr-join-hint"><b>Internet:</b> <code>10-character alphanumeric code</code> &nbsp;|&nbsp; <b>LAN:</b> unavailable</small>
          </div>
        </div>

        <!-- Features overview -->
        <div class="sr-features-grid">
          <div class="sr-feature-item"><i class="fas fa-comments"></i><span>Text Chat</span></div>
          <div class="sr-feature-item"><i class="fas fa-chalkboard"></i><span>Shared Whiteboard</span></div>
          <div class="sr-feature-item"><i class="fas fa-stopwatch"></i><span>Study Timer</span></div>
          <div class="sr-feature-item"><i class="fas fa-tasks"></i><span>Progress Tracking</span></div>
          <div class="sr-feature-item"><i class="fas fa-network-wired"></i><span>LAN Disabled</span></div>
          <div class="sr-feature-item"><i class="fas fa-globe"></i><span>Cross-Region Internet</span></div>
          <div class="sr-feature-item"><i class="fas fa-shield-alt"></i><span>Password Rooms</span></div>
        </div>
      </div>
    `;

    /* listeners */
    const createBtn = document.getElementById('srCreateBtn');
    const joinBtn = document.getElementById('srJoinBtn');
    const joinInput = document.getElementById('srJoinAddress');

    createBtn && createBtn.addEventListener('click', () => handleCreate());
    joinBtn && joinBtn.addEventListener('click', () => handleJoin());
    joinInput && joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleJoin(); });

    setupPwToggle('srCreatePwToggle', 'srCreatePassword');
    setupPwToggle('srJoinPwToggle', 'srJoinPassword');
  }

  function setupPwToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''}"></i>`;
    });
  }

  /* ================================================================
     UI — ACTIVE SESSION
     ================================================================ */
  function renderActiveSession() {
    const section = document.getElementById('studyRoomSection');
    if (!section) return;

    const participantsList = buildParticipantsHTML();

    section.innerHTML = `
      <div class="sr-session">
        <!-- Top bar -->
        <div class="sr-session-bar">
          <div class="sr-session-bar-left">
            <span class="sr-mode-badge sr-mode-inet" title="Connected via internet relay">
              <i class="fas fa-globe"></i> Internet
            </span>
            <span class="sr-room-code-badge" title="Click to copy room code" id="srCopyCode">
              <i class="fas fa-key"></i> ${escapeHTML(roomAddress)}
            </span>
            ${roomPassword ? `<span class="sr-pw-badge" title="Room is password-protected"><i class="fas fa-lock"></i> Password: <span class="sr-pw-hidden" id="srPwReveal">••••••</span></span>` : `<span class="sr-pw-badge sr-pw-open" title="No password"><i class="fas fa-lock-open"></i> No password</span>`}
            <span class="sr-session-timer" id="srSessionTimer">${fmtTime(studySeconds)}</span>
          </div>
          <div class="sr-session-bar-right">
            <button class="sr-ctrl-btn" id="srToggleMic" title="Toggle Microphone">
              <i class="fas fa-microphone-slash" style="color: #ef4444;"></i>
            </button>
            <button class="sr-ctrl-btn" id="srToggleCamera" title="Toggle Camera">
              <i class="fas fa-video-slash" style="color: #ef4444;"></i>
            </button>
            <button class="sr-ctrl-btn" id="srToggleScreenShare" title="Share Screen">
              <i class="fas fa-desktop"></i>
            </button>
            <button class="sr-ctrl-btn ${wbActive ? 'sr-ctrl-active' : ''}" id="srToggleWB" title="${wbActive ? 'Close Whiteboard' : 'Open Whiteboard'}">
              <i class="fas fa-chalkboard"></i>
            </button>
            <button class="sr-ctrl-btn sr-ctrl-danger" id="srLeaveBtn" title="Leave room">
              <i class="fas fa-phone-slash"></i>
            </button>
          </div>
        </div>

        <!-- Main layout -->
        <div class="sr-session-body">
          <!-- Participant cards area (replaces video grid) -->
          <div class="sr-video-area" id="srParticipantArea">
            <div class="sr-video-grid" id="srParticipantsGrid">
              ${buildParticipantCardsHTML()}
            </div>
          </div>

          <!-- Whiteboard (hidden by default) -->
          <div class="sr-wb-panel" id="srWhiteboardPanel" style="display:none;">
            <div class="sr-wb-toolbar">
              <div class="sr-wb-tools">
                <button class="sr-wb-tool-btn" data-tool="pan" title="Pan (drag to move)"><i class="fas fa-hand-paper"></i></button>
                <button class="sr-wb-tool-btn active" data-tool="pen" title="Pen"><i class="fas fa-pen"></i></button>
                <button class="sr-wb-tool-btn" data-tool="highlighter" title="Highlighter"><i class="fas fa-highlighter"></i></button>
                <button class="sr-wb-tool-btn" data-tool="eraser" title="Eraser"><i class="fas fa-eraser"></i></button>
                <button class="sr-wb-tool-btn" data-tool="block-erase" title="Block Erase"><i class="fas fa-vector-square"></i></button>
                <div class="sr-wb-sep"></div>
                <input type="color" id="srWbColor" class="sr-wb-color-pick" value="${wbColor}" title="Brush color">
                <div class="sr-wb-range-group" id="srWbPenSizeGroup">
                  <label>Size</label>
                  <input type="range" id="srWbPenSize" min="1" max="30" value="${wbPenSize}" class="sr-wb-range">
                  <span id="srWbPenSizeVal">${wbPenSize}</span>
                </div>
                <div class="sr-wb-range-group" id="srWbEraserSizeGroup" style="display:none;">
                  <label>Size</label>
                  <input type="range" id="srWbEraserSize" min="5" max="80" value="${wbEraserSize}" class="sr-wb-range">
                  <span id="srWbEraserSizeVal">${wbEraserSize}</span>
                </div>
                <div class="sr-wb-range-group" id="srWbHlSizeGroup" style="display:none;">
                  <label>Size</label>
                  <input type="range" id="srWbHlSize" min="5" max="50" value="${wbHighlighterSize}" class="sr-wb-range">
                  <span id="srWbHlSizeVal">${wbHighlighterSize}</span>
                </div>
                <div class="sr-wb-sep"></div>
                <button class="sr-wb-tool-btn" id="srWbUndo" title="Undo (Ctrl+Z)"><i class="fas fa-undo"></i></button>
                <button class="sr-wb-tool-btn" id="srWbRedo" title="Redo (Ctrl+Y)"><i class="fas fa-redo"></i></button>
                <button class="sr-wb-tool-btn" id="srWbClear" title="Clear board"><i class="fas fa-trash"></i></button>
              </div>
              <div class="sr-wb-actions">
                <div class="sr-wb-zoom-group">
                  <button class="sr-wb-tool-btn" id="srWbZoomOut" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
                  <span class="sr-wb-zoom-label" id="srWbZoomLabel">100%</span>
                  <button class="sr-wb-tool-btn" id="srWbZoomIn" title="Zoom In"><i class="fas fa-search-plus"></i></button>
                  <button class="sr-wb-tool-btn" id="srWbZoomReset" title="Reset View"><i class="fas fa-compress-arrows-alt"></i></button>
                </div>
                <div class="sr-wb-sep"></div>
                <button class="sr-wb-tool-btn" id="srWbFullscreen" title="Fullscreen"><i class="fas fa-expand"></i></button>
                <button class="sr-wb-tool-btn" id="srWbDownload" title="Download as PNG"><i class="fas fa-download"></i></button>
                <button class="sr-wb-tool-btn" id="srWbSaveLib" title="Save to Library"><i class="fas fa-save"></i></button>
              </div>
            </div>
            <div class="sr-wb-body">
              <div class="sr-wb-canvas-wrap" id="srWbCanvasWrap">
                <canvas id="srWbCanvas"></canvas>
                <canvas id="srWbOverlay"></canvas>
              </div>
              <div class="sr-wb-questions">
                <div class="sr-wb-q-header">
                  <h4><i class="fas fa-clipboard-list"></i> Questions</h4>
                  <button class="sr-btn sr-btn-primary sr-btn-sm" id="srWbAddQ"><i class="fas fa-plus"></i> Add</button>
                </div>
                <div class="sr-wb-q-list" id="srWbQList"></div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="sr-sidebar" id="srSidebar">
            <div class="sr-sidebar-tabs">
              <button class="sr-tab-btn active" data-tab="chat"><i class="fas fa-comments"></i> Chat</button>
              <button class="sr-tab-btn" data-tab="participants"><i class="fas fa-users"></i> People <span class="sr-count" id="srPeopleCount">${1 + Object.keys(peers).length}</span></button>
              <button class="sr-tab-btn" data-tab="progress"><i class="fas fa-tasks"></i> Progress</button>
            </div>

            <!-- Chat panel -->
            <div class="sr-tab-panel active" id="srTabChat">
              <div class="sr-chat-messages" id="srChatMessages"></div>
              <div class="sr-chat-input-row" style="position:relative;">
                <input type="file" id="srMaterialFile" style="display:none;" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />
                <button class="sr-btn sr-btn-secondary sr-btn-icon" id="srShareMaterial" title="Share Material" style="margin-right: 0.25rem;">
                   <i class="fas fa-paperclip"></i>
                </button>
                <input type="text" id="srChatInput" class="sr-input" placeholder="Type a message…" maxlength="500">
                <button class="sr-btn sr-btn-primary sr-btn-icon" id="srChatSend"><i class="fas fa-paper-plane"></i></button>
              </div>
            </div>

            <!-- Participants panel -->
            <div class="sr-tab-panel" id="srTabParticipants">
              <div id="srParticipantsList">${participantsList}</div>
            </div>

            <!-- Progress panel -->
            <div class="sr-tab-panel" id="srTabProgress">
              <div class="sr-progress-self">
                <h4>Your study goal</h4>
                <input type="text" id="srGoalInput" class="sr-input" placeholder="What are you studying?" value="${escapeHTML(studyGoal)}" maxlength="80">
                <button class="sr-btn sr-btn-accent sr-btn-sm" id="srSetGoal">Set Goal</button>
              </div>
              <div class="sr-progress-list" id="srProgressList">
                ${buildProgressHTML()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    attachSessionListeners();
    renderChatMessages();
    updateVideoGridLayout();
  }

  /* ---------- build helpers ---------- */
  function buildParticipantsHTML() {
    let html = `<div class="sr-participant-item">
      <div class="sr-participant-avatar"><i class="fas fa-user"></i></div>
      <div class="sr-participant-info">
        <span class="sr-participant-name">${escapeHTML(nickname)} (You)${isHost ? ' <i class="fas fa-crown sr-host-icon" title="Host"></i>' : ''}</span>
        <span class="sr-participant-status"><i class="fas fa-circle sr-status-on"></i> Connected</span>
      </div>
    </div>`;
    Object.values(peers).forEach(p => {
      html += `<div class="sr-participant-item">
        <div class="sr-participant-avatar"><i class="fas fa-user"></i></div>
        <div class="sr-participant-info">
          <span class="sr-participant-name">${escapeHTML(p.nickname || 'Participant')}</span>
          <span class="sr-participant-status"><i class="fas fa-circle sr-status-on"></i> Connected</span>
        </div>
      </div>`;
    });
    return html;
  }

  function buildParticipantCardsHTML() {
    let html = `
      <div class="sr-video-tile sr-video-local" style="display:flex;align-items:center;justify-content:center;flex-direction:column;">
        <div class="sr-video-off" style="position:relative;display:flex;"><i class="fas fa-user"></i></div>
        <div class="sr-video-label">${escapeHTML(nickname)} (You)${isHost ? ' <i class="fas fa-crown" style="color:#f5c842;margin-left:4px;" title="Host"></i>' : ''}</div>
      </div>`;
    Object.entries(peers).forEach(([pid, p]) => {
      html += `
        <div class="sr-video-tile" style="display:flex;align-items:center;justify-content:center;flex-direction:column;">
          <div class="sr-video-off" style="position:relative;display:flex;"><i class="fas fa-user"></i></div>
          <div class="sr-video-label">${escapeHTML(p.nickname || 'Participant')}</div>
        </div>`;
    });
    return html;
  }

  function buildProgressHTML() {
    let html = '';
    html += `<div class="sr-progress-item">
      <div class="sr-progress-user"><i class="fas fa-user"></i> ${escapeHTML(nickname)} (You)</div>
      <div class="sr-progress-goal">${studyGoal ? escapeHTML(studyGoal) : '<em>No goal set</em>'}</div>
      <div class="sr-progress-time"><i class="fas fa-clock"></i> ${fmtTime(studySeconds)}</div>
    </div>`;
    Object.values(peers).forEach(p => {
      html += `<div class="sr-progress-item">
        <div class="sr-progress-user"><i class="fas fa-user"></i> ${escapeHTML(p.nickname || 'Participant')}</div>
        <div class="sr-progress-goal">${p.goal ? escapeHTML(p.goal) : '<em>No goal set</em>'}</div>
        <div class="sr-progress-time"><i class="fas fa-clock"></i> ${fmtTime(p.seconds || 0)}</div>
      </div>`;
    });
    return html;
  }

  /* ---------- attach listeners in session ---------- */
  function attachSessionListeners() {
    // Copy room code
    const copyCodeBtn = document.getElementById('srCopyCode');
    copyCodeBtn && copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(roomAddress).then(() => {
        if (typeof showNotification === 'function') showNotification('Room code copied!', 'success');
      });
    });

    // Password reveal on click
    const pwReveal = document.getElementById('srPwReveal');
    if (pwReveal && roomPassword) {
      pwReveal.style.cursor = 'pointer';
      pwReveal.title = 'Click to toggle visibility';
      pwReveal.addEventListener('click', () => {
        const hidden = pwReveal.textContent === '••••••';
        pwReveal.textContent = hidden ? roomPassword : '••••••';
      });
    }

    // Leave
    document.getElementById('srLeaveBtn')?.addEventListener('click', leaveRoom);

    // Chat
    document.getElementById('srChatSend')?.addEventListener('click', sendChatMessage);
    document.getElementById('srChatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });
    document.getElementById('srShareMaterial')?.addEventListener('click', handleShareMaterial);

    // Screenshare & Media
    document.getElementById('srToggleScreenShare')?.addEventListener('click', toggleScreenShare);
    document.getElementById('srToggleMic')?.addEventListener('click', toggleMicrophone);
    document.getElementById('srToggleCamera')?.addEventListener('click', toggleCamera);

    // Sidebar tabs
    document.querySelectorAll('.sr-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sr-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sr-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('srTab' + capitalize(btn.dataset.tab));
        if (panel) panel.classList.add('active');
      });
    });

    // Study goal
    document.getElementById('srSetGoal')?.addEventListener('click', () => {
      const input = document.getElementById('srGoalInput');
      studyGoal = input?.value.trim() || '';
      broadcastData({ type: 'progress', goal: studyGoal, seconds: studySeconds });
      updateProgressUI();
      if (typeof showNotification === 'function') showNotification('Study goal updated!', 'success');
    });

    // Whiteboard toggle
    document.getElementById('srToggleWB')?.addEventListener('click', toggleWhiteboard);

    // Whiteboard listeners
    initWhiteboardListeners();
  }

      /* ================================================================
     CHAT & FILE SHARE
     ================================================================ */
  function sendChatMessage() {
    const input = document.getElementById('srChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const msg = { sender: nickname, text, time: Date.now(), type: 'chat' };
    chatMessages.push(msg);
    broadcastData(msg);
    renderChatMessages();
    const container = document.getElementById('srChatMessages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  function handleShareMaterial() {
    const fileInput = document.getElementById('srMaterialFile');
    if (!fileInput) return;
    fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if(!file) return;
        
        // Ensure file isn't too huge for websocket payload (cap at ~2MB for safety)
        if (file.size > 2 * 1024 * 1024) {
          if (typeof showNotification === 'function') 
            showNotification('File exceeds 2MB limit for direct relay share.', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const base64Data = e.target.result;
            broadcastData({ type: 'study-material', fileName: file.name, fileData: base64Data });
            receiveStudyMaterial(myId, base64Data, file.name); 
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; // reset
    };
  }

  function receiveStudyMaterial(fromId, fileData, fileName) {
    const senderName = (fromId === myId) ? nickname : (peers[fromId]?.nickname || 'Someone');
    const msgHtml = `Shared a file: <br><a href="${fileData}" download="${escapeHTML(fileName)}" class="sr-file-download-link"><i class="fas fa-file-download"></i> ${escapeHTML(fileName)}</a>`;
    chatMessages.push({ 
      sender: senderName, 
      text: msgHtml, 
      time: Date.now(), 
      type: 'html' 
    });
    renderChatMessages();
  }

  function renderChatMessages() {
    const container = document.getElementById('srChatMessages');
    if (!container) return;
    if (chatMessages.length === 0) {
      container.innerHTML = '<div class="sr-chat-empty"><i class="fas fa-comments"></i><p>No messages yet</p></div>';
      return;
    }
    container.innerHTML = chatMessages.map(m => {
      const isMe = m.sender === nickname;
      const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (m.type === 'system') {
        return `<div class="sr-chat-msg sr-chat-system"><em>${m.text}</em></div>`;
      }
      if (m.type === 'html') {
        return `<div class="sr-chat-msg ${isMe ? 'sr-chat-me' : 'sr-chat-other'}">
          <span class="sr-chat-sender">${escapeHTML(m.sender)}</span>
          <span class="sr-chat-text" style="word-break:break-all;">${m.text}</span>
          <span class="sr-chat-time">${timeStr}</span>
        </div>`;
      }
      return `<div class="sr-chat-msg ${isMe ? 'sr-chat-me' : 'sr-chat-other'}">
        <span class="sr-chat-sender">${escapeHTML(m.sender)}</span>
        <span class="sr-chat-text">${escapeHTML(m.text)}</span>
        <span class="sr-chat-time">${timeStr}</span>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function addSystemMessage(text) {
    chatMessages.push({ sender: '', text, time: Date.now(), type: 'system' });
    renderChatMessages();
  }

  /* ================================================================
     WEBRTC SCREENSHARING
     ================================================================ */
  async function toggleScreenShare() {
    const btn = document.getElementById('srToggleScreenShare');
    
    if (localScreenStream) {
      stopScreenShare();
      return;
    }
    try {
      // Small delay allows slow Linux GC to close the backend PipeWire handle before opening a new one
      // Removing the delay ensures WebKit keeps the user gesture token, preventing UI blocks
      localScreenStream = await window.navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" } });
      
      const vTrack = localScreenStream.getVideoTracks()[0];
      if (vTrack) {
          vTrack.onended = () => {
              if (localScreenStream) stopScreenShare();
          };
      }
      
      Object.keys(peers).forEach(peerId => {
         createRTCPeerConnection(peerId, true);
      });
      
      if(btn) btn.classList.add('sr-ctrl-active');
      renderLocalVideo(localScreenStream); 
    } catch (err) {
      console.error("Failed to share screen", err);
      if (typeof showNotification === 'function') showNotification(`Screenshare failed: ${err.message}`, 'error');
    }
  }

  function stopScreenShare() {
    if (localScreenStream) {
        if (ws && ws.calls) {
            ws.calls.forEach(call => {
                try { 
                    if (call.peerConnection) {
                        call.peerConnection.getSenders().forEach(sender => {
                            if (sender.track) {
                                try { call.peerConnection.removeTrack(sender); } catch(x) {}
                            }
                        });
                        call.peerConnection.close();
                    }
                    call.close(); 
                } catch(e) {}
            });
            ws.calls = [];
        }

        Object.values(peerConnections).forEach(pc => {
            try {
                pc.getSenders().forEach(sender => {
                    try { pc.removeTrack(sender); } catch(x) {}
                });
                pc.close();
            } catch(e) {}
        });
        peerConnections = {};

        const localTile = document.querySelector('.sr-video-local');
        if (localTile) {
            const video = localTile.querySelector('.sr-screen-video');
            if (video) {
                video.pause();
                video.srcObject = null;
                video.removeAttribute('src');
                video.load();
                video.remove();
            }
            const off = localTile.querySelector('.sr-video-off');
            if (!localTile.querySelector('.sr-cam-video') && off) {
                 off.style.display = 'flex';
                 off.innerHTML = '<i class="fas fa-user"></i>';
            }
        }

        const streamToKill = localScreenStream;
        localScreenStream = null;
        
        setTimeout(() => {
            if (streamToKill) {
                const tracks = streamToKill.getTracks();
                tracks.forEach(t => {
                    t.onended = null;
                    try { 
                        t.enabled = false;
                        t.stop(); 
                    } catch(e) {}
                });
            }
        }, 50);
    }

    const btn = document.getElementById('srToggleScreenShare');
    if(btn) btn.classList.remove('sr-ctrl-active');
    
    broadcastData({ type: 'webrtc-stop' });
  }


  function createRTCPeerConnection(targetId, isOffer) {
    if (!ws || !ws.peer || !localScreenStream) return;
    const destPeerJsId = (peers[targetId] && peers[targetId].peerJsId) ? peers[targetId].peerJsId : ('qroom-' + internetRoomId.toLowerCase());
    
    // Call them directly via PeerJS to avoid GStreamer Linux crashes with manual WebRTC SDPs
    const call = ws.peer.call(destPeerJsId, localScreenStream);
    ws.calls.push(call);
    
    // Fallback: If someone else calls us, we already bound ws.peer.on('call') in connectWebSocket.
  }
  function renderLocalVideo(stream) {
    const localTile = document.querySelector('.sr-video-local');
    if (!localTile) return;
    const off = localTile.querySelector('.sr-video-off');
    
    let video = localTile.querySelector('.sr-screen-video');
    
    // If stopping stream
    if (!stream) {
       if (video) {
           video.pause();
           video.srcObject = null;
           video.removeAttribute('src');
           video.load();
           video.remove();
       }
       if (!localTile.querySelector('.sr-cam-video') && off) {
           off.innerHTML = '<i class="fas fa-user"></i>';
           off.style.display = 'flex';
       }
       return;
    }
    
    if (off) off.style.display = 'none';
    if (!video) {
        video = document.createElement('video');
        video.className = 'sr-screen-video';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.zIndex = '3';
        localTile.insertBefore(video, localTile.firstChild);
    }
    video.srcObject = stream;
    video.play().catch(e => console.warn('Screenshare preview play prevented:', e));
    
    // Attempt triggering a reflow if cam is also rendering
    const cam = localTile.querySelector('.sr-cam-video');
    if (cam) {
       cam.style.position = 'absolute';
       cam.style.width = '30%';
       cam.style.height = 'auto';
       cam.style.bottom = '10px';
       cam.style.right = '10px';
       cam.style.zIndex = '5';
       cam.style.border = '2px solid rgba(255,255,255,0.5)';
       cam.style.borderRadius = '8px';
    }
  }

  function renderRemoteVideo(peerId, stream) {
    const grid = document.getElementById('srParticipantsGrid');
    if (!grid) return;
    // Find peer tile
    const tiles = grid.querySelectorAll('.sr-video-tile:not(.sr-video-local)');
    let targetTile = null;
    tiles.forEach(t => {
       const lbl = t.querySelector('.sr-video-label');
       if (lbl && lbl.textContent.includes(peers[peerId]?.nickname)) {
           targetTile = t;
       }
    });
    
    if (targetTile) {
        const off = targetTile.querySelector('.sr-video-off');
        
        if (!stream) {
             const sv = targetTile.querySelector('.sr-screen-video');
             if (sv) {
                 sv.pause();
                 sv.srcObject = null;
                 sv.removeAttribute('src');
                 sv.load();
                 sv.remove();
             }
             if (!targetTile.querySelector('.sr-cam-video') && off) {
                 off.innerHTML = '<i class="fas fa-user"></i>';
                 off.style.display = 'flex';
             }
             return;
        }

        if (off) off.style.display = 'none';
        let video = targetTile.querySelector('.sr-screen-video');
        if (!video) {
            video = document.createElement('video');
            video.className = 'sr-screen-video';
            video.autoplay = true;
            video.playsInline = true;
            video.style.position = 'absolute';
            video.style.top = '0';
            video.style.left = '0';
            video.style.zIndex = '3';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            
            const savedAudioOut = localStorage.getItem('questionary-audio-out-id');
            if (savedAudioOut && typeof video.setSinkId === 'function') {
                video.setSinkId(savedAudioOut).catch(console.error);
            }

            targetTile.insertBefore(video, targetTile.firstChild);
        }
        video.srcObject = stream;
        video.play().catch(e => console.warn('Screenshare stream play prevented:', e));
        
        // Check for cam overlap
        const cam = targetTile.querySelector('.sr-cam-video');
        if (cam) {
           cam.style.position = 'absolute';
           cam.style.width = '30%';
           cam.style.height = 'auto';
           cam.style.bottom = '10px';
           cam.style.right = '10px';
           cam.style.zIndex = '5';
           cam.style.border = '2px solid rgba(255,255,255,0.5)';
           cam.style.borderRadius = '8px';
        }
    }
  }

  /* ================================================================
     UI UPDATES
     ================================================================ */
  function updateParticipantsUI() {
    const list = document.getElementById('srParticipantsList');
    if (list) list.innerHTML = buildParticipantsHTML();
    const grid = document.getElementById('srParticipantsGrid');
    if (grid) grid.innerHTML = buildParticipantCardsHTML();
    updatePeopleCount();
    updateVideoGridLayout();
  }

  function updateProgressUI() {
    const list = document.getElementById('srProgressList');
    if (list) list.innerHTML = buildProgressHTML();
  }

  function updatePeopleCount() {
    const badge = document.getElementById('srPeopleCount');
    if (badge) badge.textContent = 1 + Object.keys(peers).length;
  }

  function updateVideoGridLayout() {
    const grid = document.getElementById('srParticipantsGrid');
    if (!grid) return;
    const count = grid.children.length;
    grid.classList.remove('sr-grid-1', 'sr-grid-2', 'sr-grid-3', 'sr-grid-4plus');
    if (count <= 1) grid.classList.add('sr-grid-1');
    else if (count === 2) grid.classList.add('sr-grid-2');
    else if (count <= 4) grid.classList.add('sr-grid-3');
    else grid.classList.add('sr-grid-4plus');
  }

  /* ================================================================
     SESSION FLOW — CREATE / JOIN / LEAVE
     ================================================================ */
  async function handleCreate() {
    nickname = document.getElementById('srNickname')?.value.trim() || 'Student';
    localStorage.setItem('questionary-study-nickname', nickname);
    roomPassword = document.getElementById('srCreatePassword')?.value || '';
    isHost = true;

    internetMode = true;

    /* ── Internet mode only: connect to a public relay server ── */
    relayUrl = DEFAULT_RELAY_URL;
    internetRoomId = generateRoomId();

    try {
      showLoading('Connecting to relay server…');
      if (relayUrl.includes('localhost') || relayUrl.includes('127.0.0.1')) {
         try { await tauriInvoke('start_study_server', { password: roomPassword || '' }); } catch(e) { console.warn('Could not start local relay', e); }
         await new Promise(r => setTimeout(r, 1000));
      }
      await connectWebSocket(relayUrl);
      sendToServer({ action: 'host', nickname, password: roomPassword, room: internetRoomId });
      roomAddress = internetRoomId;
    } catch (err) {
      hideLoading();
      cleanup();
      renderStudyRoom();
      if (typeof showNotification === 'function')
        showNotification('Failed to connect to relay: ' + err.message, 'error');
    }
  }

  async function handleJoin() {
    nickname = document.getElementById('srNickname')?.value.trim() || 'Student';
    localStorage.setItem('questionary-study-nickname', nickname);
    const rawInput = document.getElementById('srJoinAddress')?.value.trim();
    if (!rawInput) {
      if (typeof showNotification === 'function')
        showNotification('Please enter a room code.', 'error');
      return;
    }
    roomPassword = document.getElementById('srJoinPassword')?.value || '';
    isHost = false;

    const parsedCode = normalizeRoomCode(rawInput);
    if (!parsedCode) {
      if (typeof showNotification === 'function')
        showNotification('Enter a valid 10-character alphanumeric room code.', 'error');
      return;
    }

    internetMode = true;
    internetRoomId = parsedCode;
    relayUrl = DEFAULT_RELAY_URL;
    roomAddress = parsedCode;

    try {
      showLoading('Connecting to relay…');
      await connectWebSocket(relayUrl);
      sendToServer({ action: 'join', nickname, password: roomPassword, room: internetRoomId });
    } catch (err) {
      hideLoading();
      cleanup();
      renderStudyRoom();
      if (typeof showNotification === 'function')
        showNotification('Failed to join via relay: ' + err.message, 'error');
    }
  }

  async function leaveRoom() {
    if (typeof window.showConfirm === 'function') {
      const ok = await window.showConfirm('Leave Study Room', 'Are you sure you want to leave the study session?');
      if (!ok) return;
    }
    doLeave();
    renderStudyRoom();
    if (typeof showNotification === 'function')
      showNotification('You have left the study room.', 'info');
  }

  function forceLeaveRoom() {
    doLeave();
    renderStudyRoom();
    if (typeof showNotification === 'function')
      showNotification('The study room has been closed.', 'info');
  }

  function doLeave() {
    stopStudyTimer();
    saveSessionStats();

    // Close WebSocket
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch (_) {}
      ws = null;
    }

    // If we were the host (LAN mode), stop the local relay server
    if (isHost && !internetMode) {
      tauriInvoke('stop_study_server', {}).catch(() => {});
    }

    // Reset all state
    sessionActive = false;
    isHost = false;
    myId = '';
    peers = {};
    roomAddress = '';
    roomPassword = '';
    serverPort = 0;
    internetMode = false;
    relayUrl = '';
    internetRoomId = '';
    chatMessages = [];
    studyGoal = '';
    studySeconds = 0;
    wbActive = false;
    wbCanvas = null;
    wbCtx = null;
    wbOverlay = null;
    wbOCtx = null;
    wbStrokes = [];
    wbRedoStrokes = [];
    wbQuestions = [];
    wbNextQId = 1;
    wbCanvasW = 4096;
    wbCanvasH = 4096;
    wbZoom = 1;
    wbPanX = 0;
    wbPanY = 0;
    wbSpaceDown = false;
    wbFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  /** Cleanup on error (no notification / re-render) */
  function cleanup() {
    if (ws) { try { ws.onclose = null; ws.close(); } catch (_) {} ws = null; }
    if (isHost && !internetMode) { tauriInvoke('stop_study_server', {}).catch(() => {}); }
    sessionActive = false;
    isHost = false;
    myId = '';
    peers = {};
    roomAddress = '';
    roomPassword = '';
    serverPort = 0;
    internetMode = false;
    relayUrl = '';
    internetRoomId = '';
  }

  /* ---------- study timer ---------- */
  function startStudyTimer() {
    studySeconds = 0;
    studyTimer = setInterval(() => {
      studySeconds++;
      const el = document.getElementById('srSessionTimer');
      if (el) el.textContent = fmtTime(studySeconds);
      if (studySeconds % (PROGRESS_SYNC_INTERVAL / 1000) === 0) {
        broadcastData({ type: 'progress', goal: studyGoal, seconds: studySeconds });
        updateProgressUI();
      }
    }, 1000);
  }

  function stopStudyTimer() {
    if (studyTimer) { clearInterval(studyTimer); studyTimer = null; }
  }

  /* ---------- session stats ---------- */
  function saveSessionStats() {
    if (studySeconds < 30) return;
    const sessions = JSON.parse(localStorage.getItem('questionary-study-sessions') || '[]');
    sessions.push({
      date: new Date().toISOString(),
      duration: studySeconds,
      goal: studyGoal,
      participants: 1 + Object.keys(peers).length,
      roomAddress
    });
    if (sessions.length > 100) sessions.splice(0, sessions.length - 100);
    localStorage.setItem('questionary-study-sessions', JSON.stringify(sessions));
  }

  /* ---------- loading overlay ---------- */
  function showLoading(msg) {
    let overlay = document.getElementById('srLoadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'srLoadingOverlay';
      overlay.className = 'sr-loading-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="sr-loading-box"><div class="sr-spinner"></div><p>${msg || 'Loading…'}</p></div>`;
    overlay.style.display = 'flex';
  }

  function hideLoading() {
    const overlay = document.getElementById('srLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ================================================================
     WHITEBOARD — infinite canvas with pan, zoom, drawing tools
     ================================================================ */
  function toggleWhiteboard() {
    wbActive = !wbActive;
    const panel = document.getElementById('srWhiteboardPanel');
    const participantArea = document.getElementById('srParticipantArea');
    const btn = document.getElementById('srToggleWB');
    if (panel) panel.style.display = wbActive ? 'flex' : 'none';
    if (participantArea) participantArea.style.display = wbActive ? 'none' : 'block';
    if (btn) btn.classList.toggle('sr-ctrl-active', wbActive);
    if (wbActive) {
      setupCanvas();
      renderQuestionsUI();
    }
  }

  function setupCanvas() {
    wbCanvas = document.getElementById('srWbCanvas');
    wbOverlay = document.getElementById('srWbOverlay');
    if (!wbCanvas || !wbOverlay) return;
    wbCtx = wbCanvas.getContext('2d');
    wbOCtx = wbOverlay.getContext('2d');

    wbCanvas.width = wbCanvasW;
    wbCanvas.height = wbCanvasH;
    wbOverlay.width = wbCanvasW;
    wbOverlay.height = wbCanvasH;

    wbCtx.fillStyle = '#1e1e2e';
    wbCtx.fillRect(0, 0, wbCanvasW, wbCanvasH);

    wbZoom = 1;
    wbPanX = (wbCanvasW - getWrapSize().w) / 2;
    wbPanY = (wbCanvasH - getWrapSize().h) / 2;
    wbStrokes = [];
    wbRedoStrokes = [];
    applyTransform();
    updateZoomLabel();
  }

  function getWrapSize() {
    const wrap = document.getElementById('srWbCanvasWrap');
    return wrap ? { w: wrap.clientWidth, h: wrap.clientHeight } : { w: 960, h: 540 };
  }

  function applyTransform() {
    if (!wbCanvas || !wbOverlay) return;
    const tx = -wbPanX * wbZoom;
    const ty = -wbPanY * wbZoom;
    const t = `translate(${tx}px, ${ty}px) scale(${wbZoom})`;
    wbCanvas.style.transformOrigin = '0 0';
    wbCanvas.style.transform = t;
    wbOverlay.style.transformOrigin = '0 0';
    wbOverlay.style.transform = t;
  }

  function updateZoomLabel() {
    const lbl = document.getElementById('srWbZoomLabel');
    if (lbl) lbl.textContent = Math.round(wbZoom * 100) + '%';
  }

  function canvasXY(e) {
    const wrap = document.getElementById('srWbCanvasWrap');
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { x: sx / wbZoom + wbPanX, y: sy / wbZoom + wbPanY };
  }

  function zoomAtPoint(newZoom, screenX, screenY) {
    const wrap = document.getElementById('srWbCanvasWrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const sx = screenX - rect.left;
    const sy = screenY - rect.top;
    const vxBefore = sx / wbZoom + wbPanX;
    const vyBefore = sy / wbZoom + wbPanY;
    wbZoom = Math.max(0.02, Math.min(5, newZoom));
    wbPanX = vxBefore - sx / wbZoom;
    wbPanY = vyBefore - sy / wbZoom;
    ensureCanvasCoversView();
    applyTransform();
    updateZoomLabel();
  }

  function zoomByDelta(delta, screenX, screenY) {
    const factor = delta > 0 ? 0.9 : 1.1;
    zoomAtPoint(wbZoom * factor, screenX, screenY);
  }

  function getActiveSize() {
    if (wbTool === 'eraser') return wbEraserSize;
    if (wbTool === 'highlighter') return wbHighlighterSize;
    return wbPenSize;
  }

  function selectWbTool(tool) {
    wbTool = tool;
    document.querySelectorAll('.sr-wb-tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    const penG = document.getElementById('srWbPenSizeGroup');
    const erG = document.getElementById('srWbEraserSizeGroup');
    const hlG = document.getElementById('srWbHlSizeGroup');
    if (penG) penG.style.display = (tool === 'pen') ? 'flex' : 'none';
    if (erG) erG.style.display = (tool === 'eraser' || tool === 'block-erase') ? 'flex' : 'none';
    if (hlG) hlG.style.display = (tool === 'highlighter') ? 'flex' : 'none';
    const wrap = document.getElementById('srWbCanvasWrap');
    if (wrap) {
      if (wbSpaceDown || tool === 'pan') wrap.style.cursor = 'grab';
      else if (tool === 'block-erase') wrap.style.cursor = 'crosshair';
      else if (tool === 'eraser') wrap.style.cursor = 'cell';
      else wrap.style.cursor = 'crosshair';
    }
  }

  /* --- canvas drawing (pointer events) --- */
  let _strokePoints = [];
  let _rafPending = false;
  let _pendingMoveEvent = null;
  let _strokeBBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  function _updateBBox(x, y, size) {
    const half = (size || 30) / 2 + 2;
    if (x - half < _strokeBBox.minX) _strokeBBox.minX = x - half;
    if (y - half < _strokeBBox.minY) _strokeBBox.minY = y - half;
    if (x + half > _strokeBBox.maxX) _strokeBBox.maxX = x + half;
    if (y + half > _strokeBBox.maxY) _strokeBBox.maxY = y + half;
  }

  function _resetBBox() {
    _strokeBBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }

  function initWhiteboardListeners() {
    const wrap = document.getElementById('srWbCanvasWrap');
    if (!wrap) return;

    // Tool buttons
    document.querySelectorAll('.sr-wb-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => selectWbTool(btn.dataset.tool));
    });
    document.getElementById('srWbColor')?.addEventListener('input', e => { wbColor = e.target.value; });
    document.getElementById('srWbPenSize')?.addEventListener('input', e => {
      wbPenSize = parseInt(e.target.value) || 3;
      const v = document.getElementById('srWbPenSizeVal');
      if (v) v.textContent = wbPenSize;
    });
    document.getElementById('srWbEraserSize')?.addEventListener('input', e => {
      wbEraserSize = parseInt(e.target.value) || 20;
      const v = document.getElementById('srWbEraserSizeVal');
      if (v) v.textContent = wbEraserSize;
    });
    document.getElementById('srWbHlSize')?.addEventListener('input', e => {
      wbHighlighterSize = parseInt(e.target.value) || 18;
      const v = document.getElementById('srWbHlSizeVal');
      if (v) v.textContent = wbHighlighterSize;
    });
    document.getElementById('srWbUndo')?.addEventListener('click', undoCanvas);
    document.getElementById('srWbRedo')?.addEventListener('click', redoCanvas);
    document.getElementById('srWbClear')?.addEventListener('click', () => {
      clearCanvasLocal();
      broadcastData({ type: 'wb-clear' });
    });
    document.getElementById('srWbAddQ')?.addEventListener('click', addQuestion);

    // Zoom controls
    document.getElementById('srWbZoomIn')?.addEventListener('click', () => {
      const wrap2 = document.getElementById('srWbCanvasWrap');
      if (!wrap2) return;
      const r = wrap2.getBoundingClientRect();
      zoomAtPoint(wbZoom * 1.2, r.left + r.width / 2, r.top + r.height / 2);
    });
    document.getElementById('srWbZoomOut')?.addEventListener('click', () => {
      const wrap2 = document.getElementById('srWbCanvasWrap');
      if (!wrap2) return;
      const r = wrap2.getBoundingClientRect();
      zoomAtPoint(wbZoom / 1.2, r.left + r.width / 2, r.top + r.height / 2);
    });
    document.getElementById('srWbZoomReset')?.addEventListener('click', () => {
      wbZoom = 1;
      wbPanX = (wbCanvasW - getWrapSize().w) / 2;
      wbPanY = (wbCanvasH - getWrapSize().h) / 2;
      applyTransform();
      updateZoomLabel();
    });

    // Fullscreen
    document.getElementById('srWbFullscreen')?.addEventListener('click', toggleWbFullscreen);

    // Download
    document.getElementById('srWbDownload')?.addEventListener('click', downloadWhiteboard);

    // Save to library
    document.getElementById('srWbSaveLib')?.addEventListener('click', saveWhiteboardToLibrary);

    // Mouse wheel → zoom
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      zoomByDelta(e.deltaY, e.clientX, e.clientY);
    }, { passive: false });

    // Pointer events (setPointerCapture in onPointerDown ensures we get pointerup even outside)
    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerup', onPointerUp);

    // Middle-click pan
    wrap.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });

    // Spacebar for pan mode
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && wbActive && !wbSpaceDown) {
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        wbSpaceDown = true;
        const w = document.getElementById('srWbCanvasWrap');
        if (w) w.style.cursor = wbPanning ? 'grabbing' : 'grab';
      }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space' && wbSpaceDown) {
        wbSpaceDown = false;
        selectWbTool(wbTool);
      }
    });

    // Listen for fullscreen change
    document.addEventListener('fullscreenchange', () => {
      wbFullscreen = !!document.fullscreenElement;
      const btn = document.getElementById('srWbFullscreen');
      if (btn) btn.innerHTML = `<i class="fas fa-${wbFullscreen ? 'compress' : 'expand'}"></i>`;
    });
  }

  function onPointerDown(e) {
    if (!wbCtx) setupCanvas();
    const { x, y } = canvasXY(e);

    // Capture pointer so we get pointerup even if cursor leaves the element
    const wrap = document.getElementById('srWbCanvasWrap');
    if (wrap) { try { wrap.setPointerCapture(e.pointerId); } catch (_) {} }

    if (e.button === 1 || (wbSpaceDown && e.button === 0) || (wbTool === 'pan' && e.button === 0)) {
      wbPanning = true;
      wbPanStart = { mx: e.clientX, my: e.clientY, px: wbPanX, py: wbPanY };
      if (wrap) wrap.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    wbDrawing = true;
    wbRedoStrokes = [];

    if (wbTool === 'block-erase') {
      wbBlockStart = { x, y };
      wbBlockRect = null;
      _resetBBox();
      return;
    }

    _strokePoints = [{ x, y }];
    _resetBBox();
    _updateBBox(x, y, getActiveSize());

    if (wbTool === 'highlighter') {
      wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
      wbOCtx.beginPath();
      wbOCtx.moveTo(x, y);
    } else {
      wbCtx.beginPath();
      wbCtx.moveTo(x, y);
    }
  }

  function onPointerMove(e) {
    if (wbPanning && wbPanStart) {
      const dx = (e.clientX - wbPanStart.mx) / wbZoom;
      const dy = (e.clientY - wbPanStart.my) / wbZoom;
      wbPanX = wbPanStart.px - dx;
      wbPanY = wbPanStart.py - dy;
      ensureCanvasCoversView();
      applyTransform();
      return;
    }

    if (!wbDrawing || !wbCtx) return;

    // rAF throttle: batch move draws to next animation frame
    _pendingMoveEvent = e;
    if (!_rafPending) {
      _rafPending = true;
      requestAnimationFrame(_processMove);
    }
  }

  function _processMove() {
    _rafPending = false;
    const e = _pendingMoveEvent;
    if (!e || !wbDrawing || !wbCtx) return;
    const { x, y } = canvasXY(e);

    if (wbTool === 'block-erase' && wbBlockStart) {
      const rx = Math.min(wbBlockStart.x, x);
      const ry = Math.min(wbBlockStart.y, y);
      const rw = Math.abs(x - wbBlockStart.x);
      const rh = Math.abs(y - wbBlockStart.y);
      wbBlockRect = { x: rx, y: ry, w: rw, h: rh };
      // Only clear the area we previously drew + new area
      const clearX = Math.max(0, Math.floor(_strokeBBox.minX) - 4);
      const clearY = Math.max(0, Math.floor(_strokeBBox.minY) - 4);
      const clearW = Math.min(wbCanvasW, Math.ceil(_strokeBBox.maxX - _strokeBBox.minX) + 8);
      const clearH = Math.min(wbCanvasH, Math.ceil(_strokeBBox.maxY - _strokeBBox.minY) + 8);
      if (isFinite(clearX) && isFinite(clearY)) {
        wbOCtx.clearRect(clearX, clearY, clearW, clearH);
      } else {
        wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
      }
      wbOCtx.save();
      wbOCtx.strokeStyle = '#ef4444';
      wbOCtx.lineWidth = 2 / wbZoom;
      wbOCtx.setLineDash([6 / wbZoom, 4 / wbZoom]);
      wbOCtx.strokeRect(rx, ry, rw, rh);
      wbOCtx.restore();
      _resetBBox();
      _updateBBox(rx, ry, 4 / wbZoom);
      _updateBBox(rx + rw, ry + rh, 4 / wbZoom);
      return;
    }

    // Downsample: skip points too close together
    if (_strokePoints.length > 0) {
      const last = _strokePoints[_strokePoints.length - 1];
      const dist = Math.abs(x - last.x) + Math.abs(y - last.y);
      if (dist < 1.5) return;
    }

    _strokePoints.push({ x, y });

    if (wbTool === 'highlighter') {
      // Clear only the previous stroke bounding box, not the entire canvas
      const clearX = Math.max(0, Math.floor(_strokeBBox.minX) - 2);
      const clearY = Math.max(0, Math.floor(_strokeBBox.minY) - 2);
      const clearW = Math.min(wbCanvasW, Math.ceil(_strokeBBox.maxX - _strokeBBox.minX) + 4);
      const clearH = Math.min(wbCanvasH, Math.ceil(_strokeBBox.maxY - _strokeBBox.minY) + 4);
      if (isFinite(clearX) && isFinite(clearY)) {
        wbOCtx.clearRect(clearX, clearY, clearW, clearH);
      } else {
        wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
      }
      _resetBBox();
      wbOCtx.save();
      wbOCtx.globalAlpha = 0.3;
      wbOCtx.strokeStyle = wbColor;
      wbOCtx.lineWidth = wbHighlighterSize;
      wbOCtx.lineCap = 'round';
      wbOCtx.lineJoin = 'round';
      wbOCtx.beginPath();
      wbOCtx.moveTo(_strokePoints[0].x, _strokePoints[0].y);
      for (let i = 1; i < _strokePoints.length; i++) {
        wbOCtx.lineTo(_strokePoints[i].x, _strokePoints[i].y);
        _updateBBox(_strokePoints[i].x, _strokePoints[i].y, wbHighlighterSize);
      }
      _updateBBox(_strokePoints[0].x, _strokePoints[0].y, wbHighlighterSize);
      wbOCtx.stroke();
      wbOCtx.restore();
    } else if (wbTool === 'eraser') {
      wbCtx.globalAlpha = 1;
      wbCtx.globalCompositeOperation = 'source-over';
      wbCtx.strokeStyle = '#1e1e2e';
      wbCtx.lineWidth = wbEraserSize;
      wbCtx.lineCap = 'round';
      wbCtx.lineJoin = 'round';
      wbCtx.lineTo(x, y);
      wbCtx.stroke();
      wbCtx.beginPath();
      wbCtx.moveTo(x, y);
    } else {
      wbCtx.globalAlpha = 1;
      wbCtx.globalCompositeOperation = 'source-over';
      wbCtx.strokeStyle = wbColor;
      wbCtx.lineWidth = wbPenSize;
      wbCtx.lineCap = 'round';
      wbCtx.lineJoin = 'round';
      wbCtx.lineTo(x, y);
      wbCtx.stroke();
      wbCtx.beginPath();
      wbCtx.moveTo(x, y);
    }
  }

  function onPointerUp(e) {
    // Release pointer capture
    const wrap = document.getElementById('srWbCanvasWrap');
    if (wrap) { try { wrap.releasePointerCapture(e.pointerId); } catch (_) {} }

    // Cancel any pending rAF draw so strokes don't continue after release
    _rafPending = false;
    _pendingMoveEvent = null;

    if (wbPanning) {
      wbPanning = false;
      wbPanStart = null;
      if (wrap) wrap.style.cursor = (wbSpaceDown || wbTool === 'pan') ? 'grab' : '';
      selectWbTool(wbTool);
      return;
    }

    if (!wbDrawing) return;
    wbDrawing = false;

    if (wbTool === 'block-erase' && wbBlockRect) {
      wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
      wbCtx.fillStyle = '#1e1e2e';
      wbCtx.fillRect(wbBlockRect.x, wbBlockRect.y, wbBlockRect.w, wbBlockRect.h);
      wbStrokes.push({ type: 'block-erase', rect: { ...wbBlockRect } });
      broadcastData({ type: 'wb-block-erase', rect: wbBlockRect });
      wbBlockStart = null;
      wbBlockRect = null;
      _resetBBox();
      return;
    }

    if (wbTool === 'highlighter' && _strokePoints.length > 1) {
      wbCtx.save();
      wbCtx.globalAlpha = 0.3;
      wbCtx.strokeStyle = wbColor;
      wbCtx.lineWidth = wbHighlighterSize;
      wbCtx.lineCap = 'round';
      wbCtx.lineJoin = 'round';
      wbCtx.beginPath();
      wbCtx.moveTo(_strokePoints[0].x, _strokePoints[0].y);
      for (let i = 1; i < _strokePoints.length; i++) {
        wbCtx.lineTo(_strokePoints[i].x, _strokePoints[i].y);
      }
      wbCtx.stroke();
      wbCtx.restore();
      wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
    }

    wbCtx.beginPath();
    wbCtx.globalAlpha = 1;
    wbCtx.globalCompositeOperation = 'source-over';
    _resetBBox();

    // Record stroke command for undo
    if (_strokePoints.length > 1) {
      const cmd = {
        type: 'stroke',
        points: _strokePoints.slice(),
        color: wbTool === 'eraser' ? '#1e1e2e' : wbColor,
        size: getActiveSize(),
        tool: wbTool,
        alpha: wbTool === 'highlighter' ? 0.3 : 1
      };
      wbStrokes.push(cmd);
      maybeGrowCanvas(_strokePoints);
    }

    // Downsample stroke points for network broadcast (skip every other point if > 80)
    let broadcastPoints = _strokePoints;
    if (broadcastPoints.length > 80) {
      const sampled = [broadcastPoints[0]];
      const step = Math.ceil(broadcastPoints.length / 60);
      for (let i = step; i < broadcastPoints.length - 1; i += step) {
        sampled.push(broadcastPoints[i]);
      }
      sampled.push(broadcastPoints[broadcastPoints.length - 1]);
      broadcastPoints = sampled;
    }

    if (broadcastPoints.length > 1) {
      broadcastData({
        type: 'wb-stroke',
        points: broadcastPoints,
        color: wbTool === 'eraser' ? '#1e1e2e' : wbColor,
        size: getActiveSize(),
        tool: wbTool,
        alpha: wbTool === 'highlighter' ? 0.3 : 1
      });
    }
    _strokePoints = [];
  }

  function replayStroke(points, color, size, tool, alpha) {
    if (!wbCtx || !points || points.length < 2) return;
    wbCtx.save();
    wbCtx.beginPath();
    wbCtx.strokeStyle = color;
    wbCtx.lineWidth = size;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    wbCtx.globalAlpha = alpha || 1;
    wbCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      wbCtx.lineTo(points[i].x, points[i].y);
    }
    wbCtx.stroke();
    wbCtx.restore();
    wbCtx.beginPath();
  }

  function replayBlockErase(rect) {
    if (!wbCtx || !rect) return;
    wbCtx.fillStyle = '#1e1e2e';
    wbCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  /** Replay all stored strokes (used after undo or canvas resize) */
  function replayAllStrokes() {
    if (!wbCtx) return;
    wbCtx.fillStyle = '#1e1e2e';
    wbCtx.fillRect(0, 0, wbCanvasW, wbCanvasH);
    for (const cmd of wbStrokes) {
      if (cmd.type === 'stroke') {
        replayStroke(cmd.points, cmd.color, cmd.size, cmd.tool, cmd.alpha);
      } else if (cmd.type === 'block-erase') {
        replayBlockErase(cmd.rect);
      } else if (cmd.type === 'clear') {
        wbCtx.fillStyle = '#1e1e2e';
        wbCtx.fillRect(0, 0, wbCanvasW, wbCanvasH);
      }
    }
  }

  /** Grow canvas when strokes approach its edges */
  function maybeGrowCanvas(points) {
    let needW = wbCanvasW;
    let needH = wbCanvasH;
    const PAD = 512;
    for (const p of points) {
      if (p.x + PAD > needW) needW = Math.ceil((p.x + PAD) / 1024) * 1024;
      if (p.y + PAD > needH) needH = Math.ceil((p.y + PAD) / 1024) * 1024;
    }
    if (needW > wbCanvasW || needH > wbCanvasH) {
      growCanvas(Math.max(needW, wbCanvasW), Math.max(needH, wbCanvasH));
    }
  }

  /** Resize canvas to new dimensions and replay all strokes */
  function growCanvas(newW, newH) {
    // Cap at 16384 to stay within browser limits
    newW = Math.min(newW, 16384);
    newH = Math.min(newH, 16384);
    if (newW <= wbCanvasW && newH <= wbCanvasH) return;
    wbCanvasW = newW;
    wbCanvasH = newH;
    if (wbCanvas) { wbCanvas.width = wbCanvasW; wbCanvas.height = wbCanvasH; }
    if (wbOverlay) { wbOverlay.width = wbCanvasW; wbOverlay.height = wbCanvasH; }
    replayAllStrokes();
  }

  /** Called when zooming out — ensure canvas covers visible area */
  function ensureCanvasCoversView() {
    const vs = getWrapSize();
    const neededW = Math.ceil(vs.w / wbZoom + Math.abs(wbPanX)) + 512;
    const neededH = Math.ceil(vs.h / wbZoom + Math.abs(wbPanY)) + 512;
    if (neededW > wbCanvasW || neededH > wbCanvasH) {
      growCanvas(
        Math.max(neededW, wbCanvasW),
        Math.max(neededH, wbCanvasH)
      );
    }
  }

  function undoCanvas() {
    if (wbStrokes.length === 0 || !wbCtx) return;
    const removed = wbStrokes.pop();
    wbRedoStrokes.push(removed);
    if (wbRedoStrokes.length > 200) wbRedoStrokes.shift();
    replayAllStrokes();
  }

  function redoCanvas() {
    if (wbRedoStrokes.length === 0 || !wbCtx) return;
    const cmd = wbRedoStrokes.pop();
    wbStrokes.push(cmd);
    // Just replay the one command on top (faster than full replay)
    if (cmd.type === 'stroke') {
      replayStroke(cmd.points, cmd.color, cmd.size, cmd.tool, cmd.alpha);
    } else if (cmd.type === 'block-erase') {
      replayBlockErase(cmd.rect);
    } else if (cmd.type === 'clear') {
      wbCtx.fillStyle = '#1e1e2e';
      wbCtx.fillRect(0, 0, wbCanvasW, wbCanvasH);
    }
  }

  function clearCanvasLocal() {
    if (!wbCtx || !wbCanvas) return;
    wbCtx.fillStyle = '#1e1e2e';
    wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
    wbStrokes.push({ type: 'clear' });
    wbRedoStrokes = [];
  }

  /* --- Fullscreen --- */
  function toggleWbFullscreen() {
    const panel = document.getElementById('srWhiteboardPanel');
    if (!panel) return;
    if (!document.fullscreenElement) {
      panel.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* --- Download whiteboard as PNG --- */
  function downloadWhiteboard() {
    if (!wbCanvas) return;
    const { x, y, w, h } = getContentBounds();
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(wbCanvas, x, y, w, h, 0, 0, w, h);
    tmp.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof showNotification === 'function') showNotification('Whiteboard downloaded!', 'success');
    }, 'image/png');
  }

  /* --- Save whiteboard to library --- */
  async function saveWhiteboardToLibrary() {
    if (!wbCanvas) return;
    let name = 'Whiteboard';
    if (typeof window.showPrompt === 'function') {
      const input = await window.showPrompt('Save Whiteboard', 'Enter a name for this whiteboard:', 'Whiteboard ' + new Date().toLocaleDateString());
      if (!input) return;
      name = input;
    }
    const { x, y, w, h } = getContentBounds();
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(wbCanvas, x, y, w, h, 0, 0, w, h);
    tmp.toBlob(async blob => {
      if (!blob) return;
      try {
        const id = 'wb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        if (typeof window.savePdfBlob === 'function') {
          await window.savePdfBlob(id, blob);
        }
        if (!window.documents) window.documents = {};
        if (!window.documents['Whiteboards']) window.documents['Whiteboards'] = {};
        const safeName = name.replace(/[<>"'&]/g, '').trim() || 'Whiteboard';
        window.documents['Whiteboards'][safeName + '.png'] = 'blob-id:' + id;
        if (typeof window.saveCustomDocuments === 'function') window.saveCustomDocuments();
        if (typeof window.renderTiles === 'function' && typeof window.getCurrentDocumentsLevel === 'function') {
          window.renderTiles(window.getCurrentDocumentsLevel());
        }
        if (typeof showNotification === 'function') showNotification(`"${safeName}" saved to Library → Whiteboards!`, 'success');
      } catch (err) {
        console.error('Failed to save whiteboard:', err);
        if (typeof showNotification === 'function') showNotification('Failed to save whiteboard', 'error');
      }
    }, 'image/png');
  }

  /* --- Get bounding box from stroke commands (fast, no pixel scan) --- */
  function getContentBounds() {
    if (!wbCtx || !wbCanvas) return { x: 0, y: 0, w: wbCanvasW, h: wbCanvasH };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;
    for (const cmd of wbStrokes) {
      if (cmd.type === 'clear') { found = false; minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity; continue; }
      if (cmd.points) {
        for (const p of cmd.points) {
          found = true;
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }
      if (cmd.rect) {
        found = true;
        // block-erase might not contribute visible content, skip
      }
    }
    if (!found) {
      const vs = getWrapSize();
      const cx = Math.max(0, Math.floor(wbPanX));
      const cy = Math.max(0, Math.floor(wbPanY));
      return { x: cx, y: cy, w: Math.min(vs.w, wbCanvasW - cx), h: Math.min(vs.h, wbCanvasH - cy) };
    }
    const pad = 60;
    minX = Math.max(0, Math.floor(minX) - pad);
    minY = Math.max(0, Math.floor(minY) - pad);
    maxX = Math.min(wbCanvasW - 1, Math.ceil(maxX) + pad);
    maxY = Math.min(wbCanvasH - 1, Math.ceil(maxY) + pad);
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /* --- question / answer text areas --- */
  function addQuestion() {
    const id = wbNextQId++;
    wbQuestions.push({ id, question: '', answer: '' });
    renderQuestionsUI();
    syncQuestions();
  }

  function renderQuestionsUI() {
    const list = document.getElementById('srWbQList');
    if (!list) return;
    if (wbQuestions.length === 0) {
      list.innerHTML = '<div class="sr-wb-q-empty"><i class="fas fa-clipboard-list"></i><p>No questions yet. Click <b>Add</b> to create one.</p></div>';
      return;
    }
    list.innerHTML = wbQuestions.map((q, idx) => `
      <div class="sr-wb-q-item" data-qid="${q.id}">
        <div class="sr-wb-q-num">Q${idx + 1}
          <button class="sr-wb-q-del" data-qid="${q.id}" title="Remove"><i class="fas fa-times"></i></button>
        </div>
        <textarea class="sr-wb-q-textarea" data-field="question" data-qid="${q.id}" placeholder="Type your question…" rows="2">${escapeHTML(q.question)}</textarea>
        <textarea class="sr-wb-q-textarea sr-wb-q-answer" data-field="answer" data-qid="${q.id}" placeholder="Type your answer…" rows="3">${escapeHTML(q.answer)}</textarea>
      </div>
    `).join('');
    list.querySelectorAll('.sr-wb-q-textarea').forEach(ta => {
      ta.addEventListener('input', e => {
        const qid = parseInt(e.target.dataset.qid);
        const field = e.target.dataset.field;
        const q = wbQuestions.find(q => q.id === qid);
        if (q) { q[field] = e.target.value; syncQuestions(); }
      });
    });
    list.querySelectorAll('.sr-wb-q-del').forEach(btn => {
      btn.addEventListener('click', e => {
        const qid = parseInt(e.currentTarget.dataset.qid);
        wbQuestions = wbQuestions.filter(q => q.id !== qid);
        renderQuestionsUI();
        syncQuestions();
      });
    });
  }

  let _qSyncTimer = null;
  function syncQuestions() {
    clearTimeout(_qSyncTimer);
    _qSyncTimer = setTimeout(() => {
      broadcastData({ type: 'wb-questions', questions: wbQuestions, nextId: wbNextQId });
    }, 400);
  }

  /* ================================================================
     WEBRTC MEDIA (MIC/CAMERA)
     ================================================================ */
  async function toggleMicrophone() {
     micActive = !micActive;
     await updateLocalMediaStream();
     updateMediaButtons();
  }

  async function toggleCamera() {
     camActive = !camActive;
     await updateLocalMediaStream();
     updateMediaButtons();
  }

  async function setMicrophoneState(state) {
     if (micActive === state) return;
     micActive = state;
     await updateLocalMediaStream();
     updateMediaButtons();
  }
  
  function updateMediaButtons() {
     const mbtn = document.getElementById('srToggleMic');
     if(mbtn) {
       mbtn.innerHTML = `<i class="fas fa-${micActive ? 'microphone' : 'microphone-slash'}" style="${micActive ? '' : 'color: #ef4444;'}"></i>`;
       mbtn.classList.toggle('sr-ctrl-active', micActive);
     }
     const cbtn = document.getElementById('srToggleCamera');
     if(cbtn) {
       cbtn.innerHTML = `<i class="fas fa-${camActive ? 'video' : 'video-slash'}" style="${camActive ? '' : 'color: #ef4444;'}"></i>`;
       cbtn.classList.toggle('sr-ctrl-active', camActive);
     }
  }

  async function updateLocalMediaStream() {
    if (!micActive && !camActive) {
      if (localMediaStream) {
        const tracks = localMediaStream.getTracks();
        tracks.forEach(t => { try { t.stop() } catch(e) {} });
        localMediaStream = null;
      }
      Object.values(peerMediaConnections).forEach(pc => pc.close());
      peerMediaConnections = {};
      renderLocalCam(null);
      broadcastData({ type: 'webrtc-media-stop' });
      return;
    }

    try {
       const savedVideoId = localStorage.getItem('questionary-video-id') || undefined;
       const savedAudioId = localStorage.getItem('questionary-audio-id') || undefined;
       
       const videoConstraints = camActive ? (savedVideoId ? { deviceId: { exact: savedVideoId } } : true) : false;
       const audioConstraints = micActive ? (savedAudioId ? { deviceId: { exact: savedAudioId } } : true) : false;

       // Pre-stop any existing stream natively so WebKitGTK releases device handles cleanly
       if (localMediaStream) {
          const oldTracks = localMediaStream.getTracks();
          oldTracks.forEach(t => { try { t.stop() } catch(e) {} });
          localMediaStream = null;
       }

       const stream = await navigator.mediaDevices.getUserMedia({ 
           video: videoConstraints, 
           audio: audioConstraints 
       });
       
       localMediaStream = stream;
       
       Object.keys(peers).forEach(peerId => {
          createRTCPeerMediaConnection(peerId, true);
       });
       renderLocalCam(localMediaStream);
    } catch(err) {
       console.error("Failed media access", err);
       micActive = false; camActive = false;
       const mbtn = document.getElementById('srToggleMic');
       if(mbtn) mbtn.innerHTML = '<i class="fas fa-microphone-slash" style="color: #ef4444;"></i>';
       const cbtn = document.getElementById('srToggleCamera');
       if(cbtn) cbtn.innerHTML = '<i class="fas fa-video-slash" style="color: #ef4444;"></i>';
       if (typeof showNotification === 'function') showNotification('Media access denied', 'error');
    }
  }

  function createRTCPeerMediaConnection(targetId, isOffer) {
    if (peerMediaConnections[targetId]) peerMediaConnections[targetId].close();
    const pc = new RTCPeerConnection(rtcConfig);
    peerMediaConnections[targetId] = pc;

    pc.onicecandidate = e => {
      if (e.candidate) {
        sendToTarget(targetId, { type: 'webrtc-media-ice', candidate: e.candidate });
      }
    };

    pc.ontrack = e => renderRemoteCam(targetId, e.streams[0]);

    if (localMediaStream) {
      localMediaStream.getTracks().forEach(track => pc.addTrack(track, localMediaStream));
    }

    if (isOffer) {
      pc.createOffer().then(sdp => {
        pc.setLocalDescription(sdp);
        sendToTarget(targetId, { type: 'webrtc-media-offer', sdp });
      });
    }
  }

  async function handleMediaRTCReceiveOffer(fromId, sdp) {
    if (!peerMediaConnections[fromId]) createRTCPeerMediaConnection(fromId, false);
    const pc = peerMediaConnections[fromId];
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendToTarget(fromId, { type: 'webrtc-media-answer', sdp: answer });
  }

  async function handleMediaRTCReceiveAnswer(fromId, sdp) {
    if(peerMediaConnections[fromId]) {
      await peerMediaConnections[fromId].setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async function handleMediaRTCReceiveIce(fromId, candidate) {
    if(peerMediaConnections[fromId]) {
      await peerMediaConnections[fromId].addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  function renderLocalCam(stream) {
    const localTile = document.querySelector('.sr-video-local');
    if (!localTile) return;
    const off = localTile.querySelector('.sr-video-off');
    
    let camVideo = localTile.querySelector('.sr-cam-video');
    if (!stream) {
       if (camVideo) {
           camVideo.pause();
           camVideo.srcObject = null;
           camVideo.removeAttribute('src');
           camVideo.load();
           camVideo.remove();
       }
       if (!localTile.querySelector('.sr-screen-video') && off) off.style.display = 'flex';
       return;
    }
    
    if (off) off.style.display = 'none';
    if (!camVideo) {
        camVideo = document.createElement('video');
        camVideo.className = 'sr-cam-video';
        camVideo.autoplay = true;
        camVideo.playsInline = true;
        camVideo.muted = true;
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.objectFit = 'cover';
        camVideo.style.borderRadius = '8px';
        localTile.insertBefore(camVideo, localTile.firstChild);
    }
    camVideo.srcObject = stream;
    camVideo.play().catch(e => console.warn('Cam play prevented', e));
    
    // Style adjustments if screen share is also active
    if (localTile.querySelector('.sr-screen-video')) {
        camVideo.style.position = 'absolute';
        camVideo.style.width = '30%';
        camVideo.style.height = 'auto';
        camVideo.style.bottom = '10px';
        camVideo.style.right = '10px';
        camVideo.style.zIndex = '5';
        camVideo.style.border = '2px solid rgba(255,255,255,0.5)';
    } else {
        camVideo.style.position = 'absolute';
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.bottom = '0';
        camVideo.style.right = '0';
        camVideo.style.border = 'none';
        camVideo.style.zIndex = '1';
    }
  }

  function renderRemoteCam(targetId, stream) {
    const grid = document.getElementById('srParticipantsGrid');
    if (!grid) return;
    const tiles = grid.querySelectorAll('.sr-video-tile:not(.sr-video-local)');
    let targetTile = null;
    tiles.forEach(t => {
       const lbl = t.querySelector('.sr-video-label');
       if (lbl && lbl.textContent.includes(peers[targetId]?.nickname)) {
           targetTile = t;
       }
    });
    if (!targetTile) return;

    const off = targetTile.querySelector('.sr-video-off');
    if (off) off.style.display = 'none';

    let camVideo = targetTile.querySelector('.sr-cam-video');
    if (!camVideo) {
        camVideo = document.createElement('video');
        camVideo.className = 'sr-cam-video';
        camVideo.autoplay = true;
        camVideo.playsInline = true;
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.objectFit = 'cover';
        
        const savedAudioOut = localStorage.getItem('questionary-audio-out-id');
        if (savedAudioOut && typeof camVideo.setSinkId === 'function') {
            camVideo.setSinkId(savedAudioOut).catch(console.error);
        }

        targetTile.insertBefore(camVideo, targetTile.firstChild);
    }
    camVideo.srcObject = stream;
    camVideo.play().catch(e => console.warn('Cam play prevented', e));

    // Adjust style if screenshare is also open
    if (targetTile.querySelector('.sr-screen-video')) {
        camVideo.style.position = 'absolute';
        camVideo.style.width = '30%';
        camVideo.style.height = 'auto';
        camVideo.style.bottom = '10px';
        camVideo.style.right = '10px';
        camVideo.style.zIndex = '5';
        camVideo.style.border = '2px solid rgba(255,255,255,0.5)';
        camVideo.style.borderRadius = '8px';
    } else {
        camVideo.style.position = 'absolute';
        camVideo.style.width = '100%';
        camVideo.style.height = '100%';
        camVideo.style.bottom = '0';
        camVideo.style.right = '0';
        camVideo.style.border = 'none';
        camVideo.style.zIndex = '1';
    }
  }

  /* ================================================================
     EXPOSE
     ================================================================ */
  window.srUpdateAudioOutput = function(deviceId) {
     const videos = document.querySelectorAll('#srParticipantsGrid video');
     videos.forEach(v => {
         if (typeof v.setSinkId === 'function') {
             v.setSinkId(deviceId).catch(console.error);
         }
     });
  };

  window.renderStudyRoom = renderStudyRoom;
  window.leaveStudyRoom = leaveRoom;
  window.srToggleMicrophone = toggleMicrophone;
  window.srToggleCamera = toggleCamera;
  window.srSetMicrophoneState = setMicrophoneState;
  window.wbSelectTool = selectWbTool;
  window.wbUndo = undoCanvas;
  window.wbRedo = redoCanvas;
  window.isWhiteboardActive = () => wbActive && sessionActive;

})();
