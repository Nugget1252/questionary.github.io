

(function (window, document) {
  'use strict';

  // Polyfill WebRTC Constructors
  const RTCPeerConnection = window.RTCPeerConnection ||
                            window.webkitRTCPeerConnection ||
                            window.mozRTCPeerConnection ||
                            null;

  const RTCSessionDescription = window.RTCSessionDescription ||
                                window.webkitRTCSessionDescription ||
                                window.mozRTCSessionDescription ||
                                null;

  const RTCIceCandidate = window.RTCIceCandidate ||
                          window.webkitRTCIceCandidate ||
                          window.mozRTCIceCandidate ||
                          null;

  console.log('[StudyRoom] Booting Master Study Room Engine v26.0 (Live ScreenShare Stream Sync)...');

  /* =========================================================================
   * 1. CONSTANTS, CODECS & ICE SERVERS
   * ========================================================================= */
  const ROOM_CODE_LENGTH = 10;
  const BASE32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelay',
        credential: 'openrelay'
      }
    ],
    sdpSemantics: 'unified-plan',
    iceCandidatePoolSize: 4
  };

  /* ----------------------------------------------------------------
   * ROOM CODE NORMALIZER & GENERATOR
   * ---------------------------------------------------------------- */
  function normalizeRoomCode(raw) {
    if (!raw) return '';
    return raw
      .toUpperCase()
      .trim()
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/[^0-9A-Z]/g, '');
  }

  function generateRandomRoomCode() {
    let id = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      id += BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)];
    }
    return id;
  }

  function loadPeerJSLibrary() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve(window.Peer);
      const existingScript = document.querySelector(`script[src="${PEERJS_CDN}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.Peer));
        existingScript.addEventListener('error', () => reject(new Error('PeerJS load error')));
        return;
      }
      const script = document.createElement('script');
      script.src = PEERJS_CDN;
      script.async = true;
      script.onload = () => resolve(window.Peer);
      script.onerror = () => reject(new Error('Network failure loading PeerJS CDN'));
      document.head.appendChild(script);
    });
  }

  /* =========================================================================
   * 2. AUDIO SYNTHESIZER & SOUNDSCAPE ENGINE
   * ========================================================================= */
  const SoundFX = {
    ctx: null,
    ambienceNodes: {},

    init() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      } catch (e) {}
    },

    playTone(freq, type = 'sine', duration = 0.15, gain = 0.1) {
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(gain, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },

    playJoin() {
      this.playTone(440, 'sine', 0.1, 0.08);
      setTimeout(() => this.playTone(880, 'sine', 0.2, 0.08), 100);
    },

    playLeave() {
      this.playTone(660, 'sine', 0.1, 0.08);
      setTimeout(() => this.playTone(330, 'sine', 0.2, 0.08), 100);
    },

    playPop() {
      this.playTone(800, 'triangle', 0.06, 0.08);
    },

    playChime() {
      this.playTone(523.25, 'sine', 0.2, 0.1);
      setTimeout(() => this.playTone(659.25, 'sine', 0.3, 0.1), 120);
      setTimeout(() => this.playTone(783.99, 'sine', 0.4, 0.1), 240);
    },

    playHandRaise() {
      this.playTone(350, 'triangle', 0.1, 0.1);
      setTimeout(() => this.playTone(700, 'triangle', 0.25, 0.1), 100);
    },

    setAmbience(track, volume = 0.4) {
      this.stopAmbience();
      if (track === 'none') return;
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;

      try {
        if (track === 'binaural') {
          const oscL = ctx.createOscillator();
          const oscR = ctx.createOscillator();
          const merger = ctx.createChannelMerger(2);
          const gain = ctx.createGain();

          oscL.frequency.value = 216;
          oscR.frequency.value = 226;

          oscL.connect(merger, 0, 0);
          oscR.connect(merger, 0, 1);
          merger.connect(gain);
          gain.gain.value = volume * 0.25;
          gain.connect(ctx.destination);

          oscL.start();
          oscR.start();
          this.ambienceNodes = { oscL, oscR, gain };
          return;
        }

        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        if (track === 'rain') {
          filter.type = 'lowpass';
          filter.frequency.value = 850;
        } else if (track === 'campfire') {
          filter.type = 'bandpass';
          filter.frequency.value = 1200;
          filter.Q.value = 3.0;
        } else if (track === 'waves') {
          filter.type = 'lowpass';
          filter.frequency.value = 450;
        } else {
          filter.type = 'allpass';
        }

        const gain = ctx.createGain();
        gain.gain.value = volume;

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        whiteNoise.start();
        this.ambienceNodes = { whiteNoise, gain };
      } catch (e) {
        console.warn('[SoundFX] Ambience error:', e);
      }
    },

    setAmbienceVolume(volume) {
      if (this.ambienceNodes.gain) {
        this.ambienceNodes.gain.gain.value = volume;
      }
    },

    stopAmbience() {
      try {
        if (this.ambienceNodes.whiteNoise) {
          this.ambienceNodes.whiteNoise.stop();
          this.ambienceNodes.whiteNoise.disconnect();
        }
        if (this.ambienceNodes.oscL) {
          this.ambienceNodes.oscL.stop();
          this.ambienceNodes.oscR.stop();
          this.ambienceNodes.oscL.disconnect();
          this.ambienceNodes.oscR.disconnect();
        }
      } catch (e) {}
      this.ambienceNodes = {};
    }
  };

  /* =========================================================================
   * 3. APPLICATION STATE
   * ========================================================================= */
  let peerInstance = null;
  let peerDataConns = new Map();
  let peerMediaCalls = new Map();

  let myId = '';
  let roomAddress = '';
  let isHost = false;
  let nickname = '';
  let roomPassword = '';
  let handRaised = false;
  let sessionActive = false;
  let isSoloMode = false;
  let unreadChatCount = 0;
  let activeSidebarTab = 'chat';

  let peers = {};
  let remoteStreams = new Map();
  let screenShareOwnerId = null;

  let localAudioStream = null;
  let localVideoStream = null;
  let localScreenStream = null;
  let micActive = false;
  let camActive = false;
  let pttActive = false;

  let audioContext = null;
  let localAudioAnalyser = null;
  let localAudioSource = null;
  let speechInterval = null;
  let isSpeaking = false;

  let mainInterval = null;
  let timerMode = 'stopwatch';
  let timerRunning = false;
  let timerSeconds = 0;
  let timerDuration = 25 * 60;
  let timerRemaining = 25 * 60;
  let studyGoal = '';
  let totalUptimeSeconds = 0;

  let chatMessages = [];
  let wbQuestions = [];
  let wbNextQId = 1;

  let currentAmbienceTrack = 'none';
  let ambienceVolume = 0.4;

  let wbActive = false;
  let wbCanvas = null;
  let wbCtx = null;
  let wbOverlay = null;
  let wbOCtx = null;
  let wbDrawing = false;
  let wbPanning = false;
  let wbColor = '#ffffff';
  let wbPenSize = 3;
  let wbEraserSize = 28;
  let wbHighlighterSize = 22;
  let wbTool = 'pen';
  let wbGridStyle = 'dots';
  let wbStrokes = [];
  let wbRedoStrokes = [];
  let wbShapeStart = null;
  let wbRemoteCursors = {};
  const wbCanvasW = 3840;
  const wbCanvasH = 2160;
  let wbZoom = 1.0;
  let wbPanX = 0;
  let wbPanY = 0;
  let wbPanStart = null;
  let _liveStrokePoints = [];
  let _lastLiveBroadcast = 0;

  let abortController = new AbortController();

  /* =========================================================================
   * 4. UTILITIES
   * ========================================================================= */
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const remS = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  }

  function escapeHTML(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function notify(msg, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(msg, type);
    } else {
      console.log(`[StudyRoom - ${type.toUpperCase()}] ${msg}`);
    }
  }

  function safePlayMedia(el) {
    if (!el) return;
    try {
      const prom = el.play();
      if (prom && typeof prom.catch === 'function') {
        prom.catch(() => {});
      }
    } catch (e) {}
  }

  // Generates carrier fallback stream with both audio and video dummy tracks
  function createCarrierStream() {
    const stream = new MediaStream();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      stream.addTrack(dst.stream.getAudioTracks()[0]);

      // Add dummy black 2x2 video canvas track to pre-negotiate SDP video m-line
      const c = document.createElement('canvas');
      c.width = 2; c.height = 2;
      const cCtx = c.getContext('2d');
      cCtx.fillStyle = '#000000';
      cCtx.fillRect(0, 0, 2, 2);
      const vStream = c.captureStream(5);
      if (vStream.getVideoTracks().length > 0) {
        const vTrack = vStream.getVideoTracks()[0];
        vTrack.enabled = false;
        stream.addTrack(vTrack);
      }
    } catch (e) {}
    return stream;
  }

  /* =========================================================================
   * 5. BROADCAST & MESH RELAY ENGINE
   * ========================================================================= */
  function broadcastData(data) {
    let payload;
    try {
      payload = JSON.stringify({ action: 'relay', from: myId, data });
    } catch (err) {
      return;
    }

    peerDataConns.forEach((conn) => {
      if (conn && conn.open) {
        try { conn.send(payload); } catch (e) {}
      }
    });
  }

  function handleRelayData(fromId, data) {
    if (!data || typeof data !== 'object') return;

    if (isHost && fromId !== myId) {
      let payload;
      try {
        payload = JSON.stringify({ action: 'relay', from: fromId, data });
      } catch (e) { return; }

      peerDataConns.forEach((conn, peerId) => {
        if (peerId !== fromId && conn && conn.open) {
          try { conn.send(payload); } catch (e) {}
        }
      });
    }

    switch (data.type) {
      case 'room-mesh-sync':
        if (Array.isArray(data.peerList)) {
          data.peerList.forEach(p => {
            if (p.id !== myId && !peers[p.id]) {
              peers[p.id] = { nickname: p.nickname, goal: p.goal || '', seconds: p.seconds || 0, handRaised: false, isSpeaking: false };
              if (myId > p.id) {
                connectDirectPeer(p.id);
              }
            }
          });
          if (data.screenShareOwnerId) {
            setSpotlight(data.screenShareOwnerId, data.screenShareOwnerName);
          }
          updateParticipantsUI();
        }
        break;

      case 'screen-share-status':
        if (data.active) {
          setSpotlight(fromId, data.nickname || 'Participant');
        } else if (screenShareOwnerId === fromId) {
          setSpotlight(null);
        }
        break;

      case 'chat':
        chatMessages.push({
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          time: data.time,
          type: 'chat'
        });
        renderChatMessages();
        SoundFX.playPop();
        if (activeSidebarTab !== 'chat') {
          unreadChatCount++;
          updateUnreadBadge();
        }
        break;

      case 'reaction':
        spawnFloatingReaction(data.emoji);
        break;

      case 'hand-raise':
        if (peers[fromId]) {
          peers[fromId].handRaised = !!data.raised;
          updateParticipantsUI();
          if (data.raised) {
            SoundFX.playHandRaise();
            notify(`${peers[fromId].nickname} raised their hand.`, 'info');
          }
        }
        break;

      case 'speaking':
        if (peers[fromId]) {
          peers[fromId].isSpeaking = !!data.speaking;
          const tile = document.getElementById(`srTile_${fromId}`);
          if (tile) tile.classList.toggle('sr-speaking', !!data.speaking);
        }
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
        broadcastData({ type: 'info', nickname, goal: studyGoal, seconds: timerSeconds });
        if (localScreenStream) {
          broadcastData({ type: 'screen-share-status', active: true, nickname });
        }
        if (isHost) broadcastTimerSync();
        if (wbStrokes.length > 0 || wbQuestions.length > 0) {
          broadcastData({ type: 'wb-full-sync', strokes: wbStrokes, questions: wbQuestions, nextId: wbNextQId });
        }
        break;

      case 'timer-sync':
        timerMode = data.mode;
        timerRunning = data.running;
        timerSeconds = data.seconds;
        timerDuration = data.duration;
        timerRemaining = data.remaining;
        updateTimerDisplay();
        break;

      case 'mod-kick':
        if (data.targetId === myId) {
          notify('You were removed from the room by the host.', 'error');
          forceLeaveRoom();
        }
        break;

      case 'wb-live-draw':
        replayLivePoints(data.points, data.color, data.size, data.tool, data.alpha);
        break;

      case 'wb-stroke':
        replayStroke(data.points, data.color, data.size, data.tool, data.alpha);
        wbStrokes.push({ type: 'stroke', points: data.points, color: data.color, size: data.size, tool: data.tool, alpha: data.alpha });
        break;

      case 'wb-shape':
        drawShapeOnCanvas(data.shape, data.start, data.end, data.color, data.size);
        wbStrokes.push({ type: 'shape', shape: data.shape, start: data.start, end: data.end, color: data.color, size: data.size });
        break;

      case 'wb-text':
        drawTextOnCanvas(data.text, data.x, data.y, data.color, data.size);
        wbStrokes.push({ type: 'text', text: data.text, x: data.x, y: data.y, color: data.color, size: data.size });
        break;

      case 'wb-cursor':
        wbRemoteCursors[fromId] = { x: data.x, y: data.y, name: peers[fromId]?.nickname || 'Student', color: data.color || '#cf6215', lastSeen: Date.now() };
        renderRemoteCursors();
        break;

      case 'wb-clear':
        clearCanvasLocal();
        break;

      case 'wb-undo':
        undoCanvasLocal();
        break;

      case 'wb-redo':
        redoCanvasLocal();
        break;

      case 'wb-full-sync':
        wbStrokes = data.strokes || [];
        wbQuestions = data.questions || [];
        wbNextQId = data.nextId || (wbQuestions.length + 1);
        replayAllStrokes();
        renderQuestionsUI();
        break;

      case 'wb-questions':
        wbQuestions = data.questions || [];
        wbNextQId = data.nextId || (wbQuestions.length + 1);
        renderQuestionsUI();
        break;

      case 'study-material':
        receiveStudyMaterial(fromId, data.fileData, data.fileName);
        break;
    }
  }

  /* =========================================================================
   * 6. PEERJS DATA & REAL-TIME MEDIA CALL ENGINE
   * ========================================================================= */
  function setupPeerDataConnection(conn) {
    conn.on('open', () => {
      if (isHost && roomPassword) {
        const clientPass = conn.metadata?.password || '';
        if (clientPass !== roomPassword) {
          try {
            conn.send(JSON.stringify({ action: 'auth-fail', reason: 'Incorrect room password.' }));
          } catch (e) {}
          setTimeout(() => conn.close(), 500);
          return;
        }
      }

      peerDataConns.set(conn.peer, conn);
      const remoteNick = conn.metadata?.nickname || 'Student';
      peers[conn.peer] = { nickname: remoteNick, goal: '', seconds: 0, handRaised: false, isSpeaking: false };

      updateParticipantsUI();
      updateProgressUI();
      SoundFX.playJoin();
      addSystemMessage(`${remoteNick} joined the room.`);

      if (isHost) {
        const peerList = Object.entries(peers).map(([id, p]) => ({ id, nickname: p.nickname, goal: p.goal, seconds: p.seconds }));
        peerList.push({ id: myId, nickname, goal: studyGoal, seconds: timerSeconds });
        
        broadcastData({
          type: 'room-mesh-sync',
          peerList,
          screenShareOwnerId,
          screenShareOwnerName: screenShareOwnerId === 'self' ? nickname : (peers[screenShareOwnerId]?.nickname || '')
        });

        try {
          conn.send(JSON.stringify({
            action: 'relay',
            from: myId,
            data: {
              type: 'wb-full-sync',
              strokes: wbStrokes,
              questions: wbQuestions,
              nextId: wbNextQId
            }
          }));
        } catch (e) {}
      }

      // Initiate media call to peer
      callPeerMedia(conn.peer);
    });

    conn.on('data', (rawPayload) => {
      try {
        let payload = rawPayload;
        if (typeof rawPayload === 'string') {
          payload = JSON.parse(rawPayload);
        }
        if (payload && payload.action === 'auth-fail') {
          notify(payload.reason || 'Authentication failed.', 'error');
          forceLeaveRoom();
          return;
        }
        if (payload && payload.action === 'relay') {
          handleRelayData(payload.from || conn.peer, payload.data);
        }
      } catch (e) {
        console.warn('[StudyRoom] Parse note:', e);
      }
    });

    conn.on('close', () => {
      peerDataConns.delete(conn.peer);
      const leftNick = peers[conn.peer]?.nickname || 'Student';
      delete peers[conn.peer];
      delete wbRemoteCursors[conn.peer];
      clearRemoteMedia(conn.peer);
      if (screenShareOwnerId === conn.peer) {
        setSpotlight(null);
      }
      updateParticipantsUI();
      updateProgressUI();
      addSystemMessage(`${leftNick} left the room.`);
    });

    conn.on('error', () => {
      peerDataConns.delete(conn.peer);
    });
  }

  function connectDirectPeer(targetPeerId) {
    if (!peerInstance || peerDataConns.has(targetPeerId) || targetPeerId === myId) return;
    const conn = peerInstance.connect(targetPeerId, {
      reliable: true,
      metadata: { nickname, room: roomAddress }
    });
    setupPeerDataConnection(conn);
  }

  function getActiveCombinedStream() {
    const combined = new MediaStream();
    let hasAudio = false;
    let hasVideo = false;

    if (localAudioStream && micActive) {
      localAudioStream.getAudioTracks().forEach(t => {
        if (t.readyState === 'live') {
          t.enabled = true;
          combined.addTrack(t);
          hasAudio = true;
        }
      });
    }

    if (localScreenStream) {
      localScreenStream.getVideoTracks().forEach(t => {
        if (t.readyState === 'live') {
          t.enabled = true;
          combined.addTrack(t);
          hasVideo = true;
        }
      });
    } else if (localVideoStream && camActive) {
      localVideoStream.getVideoTracks().forEach(t => {
        if (t.readyState === 'live') {
          t.enabled = true;
          combined.addTrack(t);
          hasVideo = true;
        }
      });
    }

    // Fill missing tracks with pre-warmed carrier tracks
    if (!hasAudio || !hasVideo) {
      const carrier = createCarrierStream();
      if (!hasAudio && carrier.getAudioTracks().length > 0) {
        combined.addTrack(carrier.getAudioTracks()[0]);
      }
      if (!hasVideo && carrier.getVideoTracks().length > 0) {
        combined.addTrack(carrier.getVideoTracks()[0]);
      }
    }

    return combined;
  }

  function callPeerMedia(remotePeerId) {
    if (!peerInstance) return;
    const stream = getActiveCombinedStream();

    try {
      // Close previous call if open to force full WebRTC track renegotiation
      if (peerMediaCalls.has(remotePeerId)) {
        try { peerMediaCalls.get(remotePeerId).close(); } catch (e) {}
        peerMediaCalls.delete(remotePeerId);
      }

      const call = peerInstance.call(remotePeerId, stream);
      setupPeerCall(call);
    } catch (e) {
      console.warn('[PeerJS] Media call error:', e);
    }
  }

  function setupPeerCall(call) {
    if (!call) return;
    peerMediaCalls.set(call.peer, call);

    call.on('stream', (remoteStream) => {
      remoteStreams.set(call.peer, remoteStream);
      syncVideoTiles();
      renderRemoteMedia(call.peer, remoteStream);
    });

    call.on('close', () => {
      peerMediaCalls.delete(call.peer);
      clearRemoteMedia(call.peer);
    });

    call.on('error', () => {
      peerMediaCalls.delete(call.peer);
    });
  }

  function broadcastMediaToAllPeers() {
    peerDataConns.forEach((_, peerId) => {
      callPeerMedia(peerId);
    });
  }

  /* =========================================================================
   * 7. HARDWARE CONTROLLERS & AUDIO ANALYSIS (ELECTRON + WEB SAFE)
   * ========================================================================= */
  async function toggleMicrophone() {
    try {
      if (!localAudioStream) {
        localAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      }
      micActive = !micActive;
      localAudioStream.getAudioTracks().forEach(t => t.enabled = micActive);

      broadcastMediaToAllPeers();
      updateMediaButtons();
      setupAudioAnalysis();
      notify(micActive ? 'Microphone unmuted' : 'Microphone muted', 'info');
    } catch (err) {
      micActive = false;
      updateMediaButtons();
      notify('Microphone hardware access denied.', 'error');
    }
  }

  async function toggleCamera() {
    try {
      if (!localVideoStream) {
        localVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }
        });
      }
      camActive = !camActive;
      localVideoStream.getVideoTracks().forEach(t => t.enabled = camActive);

      broadcastMediaToAllPeers();
      updateMediaButtons();
      renderLocalCam(camActive ? localVideoStream : null);
      notify(camActive ? 'Camera turned on' : 'Camera turned off', 'info');
    } catch (err) {
      camActive = false;
      updateMediaButtons();
      notify('Camera hardware access denied.', 'error');
    }
  }

  // Universal Screen Share Controller (Supports Electron DesktopCapturer & Web)
  async function toggleScreenShare() {
    const btn = document.getElementById('srToggleScreenShare');
    if (localScreenStream) {
      stopScreenShare();
      return;
    }

    try {
      // 1. Electron Desktop Capturer Check
      if (window.electronAPI?.getDesktopSources) {
        try {
          const sources = await window.electronAPI.getDesktopSources({ types: ['screen', 'window'] });
          if (sources && sources.length > 0) {
            localScreenStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sources[0].id,
                  minWidth: 1280,
                  maxWidth: 1920,
                  minHeight: 720,
                  maxHeight: 1080
                }
              }
            });
          }
        } catch (e) {
          console.warn('[ElectronScreenCapture] Fallback to standard getDisplayMedia:', e);
        }
      }

      // 2. Standard Browser Fallback
      if (!localScreenStream) {
        localScreenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });
      }

      const vTrack = localScreenStream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.onended = () => stopScreenShare();
      }

      if (btn) btn.classList.add('sr-ctrl-active');
      setSpotlight('self');
      if (!isSoloMode) broadcastData({ type: 'screen-share-status', active: true, nickname });

      // Force full-mesh stream renegotiation to peers
      broadcastMediaToAllPeers();
      notify('Screen sharing active.', 'success');
    } catch (err) {
      console.error('[ScreenShare Error]', err);
      notify('Screen share cancelled or failed.', 'error');
    }
  }

  function stopScreenShare() {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      localScreenStream = null;
    }

    const btn = document.getElementById('srToggleScreenShare');
    if (btn) btn.classList.remove('sr-ctrl-active');

    if (screenShareOwnerId === 'self') {
      setSpotlight(null);
    }

    if (!isSoloMode) broadcastData({ type: 'screen-share-status', active: false });
    broadcastMediaToAllPeers();
  }

  function renderLocalCam(stream) {
    const localTile = document.getElementById('srTile_self');
    if (!localTile) return;
    const off = localTile.querySelector('.sr-video-off');
    let camVideo = localTile.querySelector('.sr-cam-video');

    if (!stream) {
      if (camVideo) {
        camVideo.pause();
        camVideo.srcObject = null;
        camVideo.remove();
      }
      if (off) off.style.display = 'flex';
      return;
    }
    if (off) off.style.display = 'none';
    if (!camVideo) {
      camVideo = document.createElement('video');
      camVideo.className = 'sr-cam-video';
      camVideo.autoplay = true;
      camVideo.playsInline = true;
      camVideo.muted = true;
      camVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;border-radius:12px;z-index:1;';
      localTile.appendChild(camVideo);
    }
    camVideo.srcObject = stream;
    safePlayMedia(camVideo);
  }

  function renderRemoteMedia(userId, stream) {
    let tile = document.getElementById(`srTile_${userId}`);
    if (!tile) {
      syncVideoTiles();
      tile = document.getElementById(`srTile_${userId}`);
    }
    if (!tile) return;

    // Filter out dummy black carrier tracks so we only treat REAL video as active
    const realVideoTracks = stream.getVideoTracks().filter(t => t.enabled && t.readyState === 'live');
    const hasVideo = realVideoTracks.length > 0;
    const off = tile.querySelector('.sr-video-off');

    let audio = tile.querySelector('.sr-remote-audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.className = 'sr-remote-audio';
      audio.autoplay = true;
      audio.style.display = 'none';
      tile.appendChild(audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    safePlayMedia(audio);

    let camVideo = tile.querySelector('.sr-cam-video');
    if (hasVideo) {
      if (off) off.style.display = 'none';
      if (!camVideo) {
        camVideo = document.createElement('video');
        camVideo.className = 'sr-cam-video';
        camVideo.autoplay = true;
        camVideo.playsInline = true;
        camVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;border-radius:12px;z-index:1;';
        tile.appendChild(camVideo);
      }
      if (camVideo.srcObject !== stream) {
        camVideo.srcObject = stream;
      }
      safePlayMedia(camVideo);

      // If this peer is the active screenshare owner, display stream in the Spotlight stage
      if (screenShareOwnerId === userId) {
        const spotVideo = document.getElementById('srSpotlightVideo');
        if (spotVideo) {
          if (spotVideo.srcObject !== stream) spotVideo.srcObject = stream;
          safePlayMedia(spotVideo);
        }
      }
    } else {
      if (camVideo) {
        camVideo.pause();
        camVideo.srcObject = null;
        camVideo.remove();
      }
      if (off) off.style.display = 'flex';
    }
  }

  function clearRemoteMedia(userId) {
    const stream = remoteStreams.get(userId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    remoteStreams.delete(userId);

    const tile = document.getElementById(`srTile_${userId}`);
    if (tile) {
      tile.querySelectorAll('video, audio').forEach(el => {
        el.pause();
        el.srcObject = null;
        el.remove();
      });
      const off = tile.querySelector('.sr-video-off');
      if (off) off.style.display = 'flex';
    }
  }

  function updateMediaButtons() {
    const mbtn = document.getElementById('srToggleMic');
    if (mbtn) {
      mbtn.innerHTML = `<i class="fas fa-${micActive ? 'microphone' : 'microphone-slash'}" style="${micActive ? '' : 'color: #ef4444;'}"></i>`;
      mbtn.classList.toggle('sr-ctrl-active', micActive);
    }
    const cbtn = document.getElementById('srToggleCamera');
    if (cbtn) {
      cbtn.innerHTML = `<i class="fas fa-${camActive ? 'video' : 'video-slash'}" style="${camActive ? '' : 'color: #ef4444;'}"></i>`;
      cbtn.classList.toggle('sr-ctrl-active', camActive);
    }
  }

  function setupAudioAnalysis() {
    try {
      if (localAudioSource) {
        try { localAudioSource.disconnect(); } catch (e) {}
        localAudioSource = null;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioContext && AudioCtx) audioContext = new AudioCtx();
      if (!audioContext) return;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      if (localAudioStream && localAudioStream.getAudioTracks().length > 0) {
        localAudioSource = audioContext.createMediaStreamSource(localAudioStream);
        if (!localAudioAnalyser) {
          localAudioAnalyser = audioContext.createAnalyser();
          localAudioAnalyser.fftSize = 256;
        }
        localAudioSource.connect(localAudioAnalyser);

        const dataArray = new Uint8Array(localAudioAnalyser.frequencyBinCount);
        if (speechInterval) clearInterval(speechInterval);

        speechInterval = setInterval(() => {
          if (!micActive || !localAudioAnalyser) {
            if (isSpeaking) {
              isSpeaking = false;
              document.getElementById('srTile_self')?.classList.remove('sr-speaking');
              if (!isSoloMode) broadcastData({ type: 'speaking', speaking: false });
            }
            return;
          }

          localAudioAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const nowSpeaking = avg > 22;

          if (nowSpeaking !== isSpeaking) {
            isSpeaking = nowSpeaking;
            document.getElementById('srTile_self')?.classList.toggle('sr-speaking', isSpeaking);
            if (!isSoloMode) broadcastData({ type: 'speaking', speaking: isSpeaking });
          }
        }, 200);
      }
    } catch (e) {}
  }

  function setupPushToTalk(signal) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !pttActive && !wbActive) {
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (localAudioStream && localAudioStream.getAudioTracks().length > 0 && !micActive) {
          pttActive = true;
          localAudioStream.getAudioTracks()[0].enabled = true;
          const mbtn = document.getElementById('srToggleMic');
          if (mbtn) mbtn.classList.add('sr-ctrl-active');
        }
      }
    }, { signal });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && pttActive) {
        pttActive = false;
        if (localAudioStream && localAudioStream.getAudioTracks().length > 0 && !micActive) {
          localAudioStream.getAudioTracks()[0].enabled = false;
          const mbtn = document.getElementById('srToggleMic');
          if (mbtn) mbtn.classList.remove('sr-ctrl-active');
        }
      }
    }, { signal });
  }

  /* =========================================================================
   * 8. UI — LOBBY
   * ========================================================================= */
  function renderStudyRoom() {
    const section = document.getElementById('studyRoomSection');
    if (!section) return;

    if (sessionActive || isSoloMode) {
      renderActiveSession();
      return;
    }

    const savedNick = localStorage.getItem('questionary-study-nickname') || '';
    section.innerHTML = `
      <div class="sr-lobby">
        <div class="sr-lobby-header">
          <h2 class="section-title"><i class="fas fa-users-class"></i>Study Room</h2>
          <span class="sr-exp-badge">experimental</span>
          <div class="sr-lobby-icon"><i class="fas fa-graduation-cap"></i></div>
          <p class="sr-lobby-subtitle">Collaborate live with multi-user video, screen sharing, infinite vector whiteboard, synchronized timers & audio ambience.</p>
        </div>

        <div class="sr-lobby-cards">
          <div class="sr-lobby-card">
            <h3><i class="fas fa-user-circle"></i> Display Name</h3>
            <input type="text" id="srNickname" class="sr-input" placeholder="Enter your display name…" maxlength="24" value="${escapeHTML(savedNick || window.currentUser?.username || '')}">
          </div>

          <div class="sr-lobby-card sr-card-create">
            <h3><i class="fas fa-plus-circle"></i> Create Room</h3>
            <p>Host a collaborative session and share your 10-digit code with peers.</p>
            <div class="sr-pw-row">
              <input type="password" id="srCreatePassword" class="sr-input" placeholder="Room password (optional)" maxlength="32" autocomplete="off">
              <button type="button" class="sr-pw-toggle" id="srCreatePwToggle" title="Toggle password"><i class="fas fa-eye"></i></button>
            </div>
            <button class="sr-btn sr-btn-primary" id="srCreateBtn"><i class="fas fa-door-open"></i> Create Live Room</button>
          </div>

          <div class="sr-lobby-card sr-card-join">
            <h3><i class="fas fa-sign-in-alt"></i> Join Room</h3>
            <p>Enter the 10-digit room code provided by the session host.</p>
            <div class="sr-join-row">
              <input type="text" id="srJoinAddress" class="sr-input sr-code-input" placeholder="4SNELCGW9X" spellcheck="false" autocomplete="off" maxlength="10">
              <button class="sr-btn sr-btn-accent" id="srJoinBtn"><i class="fas fa-arrow-right"></i> Join</button>
            </div>
            <div class="sr-pw-row" style="margin-top:0.5rem;">
              <input type="password" id="srJoinPassword" class="sr-input" placeholder="Password (if required)" maxlength="32" autocomplete="off">
              <button type="button" class="sr-pw-toggle" id="srJoinPwToggle" title="Toggle password"><i class="fas fa-eye"></i></button>
            </div>
          </div>
        </div>

        <div style="margin-top: 2rem; text-align: center;">
          <button class="sr-btn sr-btn-secondary" id="srSoloModeBtn" style="background: transparent; border: 1px dashed var(--border); color: var(--text-secondary);">
            <i class="fas fa-pencil-ruler"></i> Open Solo Offline Whiteboard (No Network)
          </button>
        </div>
      </div>
    `;

    document.getElementById('srCreateBtn')?.addEventListener('click', handleCreate);
    document.getElementById('srJoinBtn')?.addEventListener('click', handleJoin);
    document.getElementById('srSoloModeBtn')?.addEventListener('click', startSoloMode);
    document.getElementById('srJoinAddress')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleJoin(); });

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

  /* =========================================================================
   * 9. UI — ACTIVE SESSION
   * ========================================================================= */
  function renderActiveSession() {
    const section = document.getElementById('studyRoomSection');
    if (!section) return;

    section.innerHTML = `
      <div class="sr-session">
        <div class="sr-session-bar">
          <div class="sr-session-bar-left">
            <span class="sr-mode-badge ${isSoloMode ? '' : 'sr-mode-inet'}"><i class="fas fa-${isSoloMode ? 'user' : 'bolt'}"></i> ${isSoloMode ? 'Solo Mode' : 'Live Room'}</span>
            ${!isSoloMode ? `
              <span class="sr-room-code-badge" title="Click to copy room code" id="srCopyCode">
                <i class="fas fa-key"></i> ${escapeHTML(roomAddress)}
              </span>
              ${roomPassword ? `<span class="sr-pw-badge"><i class="fas fa-lock"></i> <span class="sr-pw-hidden" id="srPwReveal">••••••</span></span>` : `<span class="sr-pw-badge sr-pw-open"><i class="fas fa-lock-open"></i> Public</span>`}
            ` : ''}
          </div>

          <div class="sr-pomo-bar" id="srPomoBar">
            <button class="sr-pomo-mode-btn" id="srPomoToggleMode" title="Cycle Timer Mode">
              <i class="fas fa-stopwatch"></i>
            </button>
            <span class="sr-pomo-timer" id="srPomoTimer">00:00</span>
            <button class="sr-pomo-ctrl-btn" id="srPomoPlayPause" title="Start / Pause">
              <i class="fas fa-play"></i>
            </button>
            <button class="sr-pomo-ctrl-btn" id="srPomoReset" title="Reset">
              <i class="fas fa-redo"></i>
            </button>
          </div>

          <div class="sr-session-bar-right">
            ${!isSoloMode ? `
              <button class="sr-ctrl-btn ${handRaised ? 'sr-ctrl-active' : ''}" id="srRaiseHandBtn" title="Raise Hand">
                <i class="fas fa-hand-paper"></i>
              </button>
              <button class="sr-ctrl-btn" id="srToggleMic" title="Toggle Mic (Ctrl+M)">
                <i class="fas fa-microphone-slash" style="color: #ef4444;"></i>
              </button>
              <button class="sr-ctrl-btn" id="srToggleCamera" title="Toggle Video (Ctrl+V)">
                <i class="fas fa-video-slash" style="color: #ef4444;"></i>
              </button>
              <button class="sr-ctrl-btn" id="srToggleScreenShare" title="Share Screen">
                <i class="fas fa-desktop"></i>
              </button>
            ` : ''}
            <button class="sr-ctrl-btn ${wbActive ? 'sr-ctrl-active' : ''}" id="srToggleWB" title="Toggle Whiteboard">
              <i class="fas fa-chalkboard"></i>
            </button>
            <button class="sr-ctrl-btn sr-ctrl-danger" id="srLeaveBtn" title="Leave room">
              <i class="fas fa-phone-slash"></i>
            </button>
          </div>
        </div>

        <div class="sr-session-body">
          <div class="sr-video-area" id="srParticipantArea">
            <div class="sr-spotlight-stage" id="srSpotlightStage" style="display: none;">
              <video class="sr-spotlight-video" id="srSpotlightVideo" autoplay playsinline></video>
              <div class="sr-spotlight-overlay" id="srSpotlightOverlay">
                <span id="srSpotlightLabel">Screen Share Presentation</span>
                <button class="sr-btn sr-btn-sm sr-btn-secondary" id="srSpotlightFullscreen" title="Fullscreen"><i class="fas fa-expand"></i></button>
              </div>
            </div>

            <div class="sr-video-grid sr-grid-1" id="srParticipantsGrid"></div>

            <div class="sr-reactions-bar">
              <button class="sr-react-btn" data-emoji="👏" title="Clap">👏</button>
              <button class="sr-react-btn" data-emoji="🔥" title="Fire">🔥</button>
              <button class="sr-react-btn" data-emoji="💡" title="Idea">💡</button>
              <button class="sr-react-btn" data-emoji="👍" title="Thumbs Up">👍</button>
              <button class="sr-react-btn" data-emoji="❤️" title="Heart">❤️</button>
              <button class="sr-react-btn" data-emoji="☕" title="Coffee Break">☕</button>
            </div>
          </div>

          <div class="sr-wb-panel" id="srWhiteboardPanel" style="display:none;">
            <div class="sr-wb-toolbar">
              <div class="sr-wb-tools">
                <button class="sr-wb-tool-btn" data-tool="pan" title="Pan Canvas"><i class="fas fa-hand-paper"></i></button>
                <button class="sr-wb-tool-btn active" data-tool="pen" title="Pen"><i class="fas fa-pen"></i></button>
                <button class="sr-wb-tool-btn" data-tool="highlighter" title="Highlighter"><i class="fas fa-highlighter"></i></button>
                <button class="sr-wb-tool-btn" data-tool="line" title="Line"><i class="fas fa-slash"></i></button>
                <button class="sr-wb-tool-btn" data-tool="arrow" title="Arrow"><i class="fas fa-long-arrow-alt-right"></i></button>
                <button class="sr-wb-tool-btn" data-tool="rect" title="Rectangle"><i class="far fa-square"></i></button>
                <button class="sr-wb-tool-btn" data-tool="circle" title="Circle"><i class="far fa-circle"></i></button>
                <button class="sr-wb-tool-btn" data-tool="text" title="Text Box"><i class="fas fa-font"></i></button>
                <button class="sr-wb-tool-btn" data-tool="eraser" title="Eraser"><i class="fas fa-eraser"></i></button>

                <div class="sr-wb-sep"></div>
                <input type="color" id="srWbColor" class="sr-wb-color-pick" value="${wbColor}">
                <div class="sr-wb-range-group" id="srWbPenSizeGroup">
                  <label>Size</label>
                  <input type="range" id="srWbPenSize" min="1" max="40" value="${wbPenSize}" class="sr-wb-range">
                  <span id="srWbPenSizeVal">${wbPenSize}</span>
                </div>

                <div class="sr-wb-sep"></div>
                <button class="sr-wb-tool-btn" id="srWbGridToggle" title="Toggle Grid"><i class="fas fa-border-all"></i></button>
                <button class="sr-wb-tool-btn" id="srWbUndo" title="Undo (Ctrl+Z)"><i class="fas fa-undo"></i></button>
                <button class="sr-wb-tool-btn" id="srWbRedo" title="Redo (Ctrl+Y)"><i class="fas fa-redo"></i></button>
                <button class="sr-wb-tool-btn" id="srWbClear" title="Clear Board"><i class="fas fa-trash"></i></button>
              </div>

              <div class="sr-wb-actions">
                <div class="sr-wb-zoom-group">
                  <button class="sr-wb-tool-btn" id="srWbZoomOut"><i class="fas fa-search-minus"></i></button>
                  <span class="sr-wb-zoom-label" id="srWbZoomLabel">100%</span>
                  <button class="sr-wb-tool-btn" id="srWbZoomIn"><i class="fas fa-search-plus"></i></button>
                  <button class="sr-wb-tool-btn" id="srWbZoomReset" title="Reset View"><i class="fas fa-compress-arrows-alt"></i></button>
                </div>
                <div class="sr-wb-sep"></div>
                <button class="sr-wb-tool-btn" id="srWbFullscreen" title="Fullscreen"><i class="fas fa-expand"></i></button>
                <button class="sr-wb-tool-btn" id="srWbDownload" title="Download PNG"><i class="fas fa-download"></i></button>
              </div>
            </div>

            <div class="sr-wb-body">
              <div class="sr-wb-canvas-wrap" id="srWbCanvasWrap" style="touch-action: none !important;">
                <canvas id="srWbCanvas"></canvas>
                <canvas id="srWbOverlay"></canvas>
              </div>
              <div class="sr-wb-questions">
                <div class="sr-wb-q-header">
                  <h4><i class="fas fa-clipboard-list"></i> Questions & Notes</h4>
                  <button class="sr-btn sr-btn-primary sr-btn-sm" id="srWbAddQ"><i class="fas fa-plus"></i> Add</button>
                </div>
                <div class="sr-wb-q-list" id="srWbQList"></div>
              </div>
            </div>
          </div>

          <div class="sr-sidebar" id="srSidebar">
            <div class="sr-sidebar-tabs">
              <button class="sr-tab-btn active" data-tab="chat">
                <i class="fas fa-comments"></i> Chat
                <span class="sr-count" id="srUnreadBadge" style="display:none;">0</span>
              </button>
              <button class="sr-tab-btn" data-tab="participants">
                <i class="fas fa-users"></i> People
                <span class="sr-count" id="srPeopleCount">${1 + Object.keys(peers).length}</span>
              </button>
              <button class="sr-tab-btn" data-tab="progress"><i class="fas fa-tasks"></i> Goals</button>
              <button class="sr-tab-btn" data-tab="ambience"><i class="fas fa-music"></i> Audio</button>
            </div>

            <div class="sr-tab-panel active" id="srTabChat">
              <div class="sr-chat-messages" id="srChatMessages"></div>
              <div class="sr-chat-input-row">
                <input type="file" id="srMaterialFile" style="display:none;" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt" />
                <button class="sr-btn sr-btn-secondary sr-btn-icon" id="srShareMaterial" title="Share Document">
                   <i class="fas fa-paperclip"></i>
                </button>
                <input type="text" id="srChatInput" class="sr-input" placeholder="Type a message…" maxlength="500">
                <button class="sr-btn sr-btn-primary sr-btn-icon" id="srChatSend"><i class="fas fa-paper-plane"></i></button>
              </div>
            </div>

            <div class="sr-tab-panel" id="srTabParticipants">
              <div id="srParticipantsList">${buildParticipantsHTML()}</div>
            </div>

            <div class="sr-tab-panel" id="srTabProgress">
              <div class="sr-progress-self">
                <h4>Your Study Goal</h4>
                <input type="text" id="srGoalInput" class="sr-input" placeholder="What are you studying right now?" value="${escapeHTML(studyGoal)}" maxlength="80">
                <button class="sr-btn sr-btn-accent sr-btn-sm" id="srSetGoal" style="margin-top:0.4rem;width:100%;justify-content:center;">Set Goal</button>
              </div>
              <div class="sr-progress-list" id="srProgressList">
                ${buildProgressHTML()}
              </div>
            </div>

            <div class="sr-tab-panel" id="srTabAmbience">
              <div style="padding: 10px;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--text-primary);"><i class="fas fa-headphones" style="color: var(--accent);"></i> Focus Soundscapes</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
                  ${[
                    { id: 'rain', name: 'Rainfall', icon: 'cloud-showers-heavy' },
                    { id: 'waves', name: 'Ocean Waves', icon: 'water' },
                    { id: 'campfire', name: 'Campfire', icon: 'fire' },
                    { id: 'binaural', name: 'Alpha Beats', icon: 'brain' },
                    { id: 'whitenoise', name: 'White Noise', icon: 'wind' },
                    { id: 'none', name: 'Mute Audio', icon: 'volume-mute' }
                  ].map(t => `
                    <button class="sr-btn sr-btn-sm sr-amb-btn ${currentAmbienceTrack === t.id ? 'sr-btn-primary' : 'sr-btn-secondary'}" data-track="${t.id}" style="padding: 10px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                      <i class="fas fa-${t.icon}" style="font-size: 1.2rem;"></i>
                      <span style="font-size: 0.75rem;">${t.name}</span>
                    </button>
                  `).join('')}
                </div>
                <label style="font-size: 0.8rem; color: var(--text-secondary);">Ambience Volume</label>
                <input type="range" id="srAmbienceVol" min="0" max="1" step="0.05" value="${ambienceVolume}" style="width: 100%; margin-top: 4px; cursor: pointer;">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    attachSessionListeners();
    renderChatMessages();
    updateParticipantsUI();
    updateTimerDisplay();
  }

  function buildParticipantsHTML() {
    let html = `
      <div class="sr-participant-item">
        <div class="sr-participant-avatar"><i class="fas fa-user"></i></div>
        <div class="sr-participant-info">
          <span class="sr-participant-name">${escapeHTML(nickname)} (You)${isHost ? ' <i class="fas fa-crown sr-host-icon" title="Host"></i>' : ''}${handRaised ? ' <i class="fas fa-hand-paper" style="color:var(--accent,#cf6215);margin-left:4px;"></i>' : ''}</span>
          <span class="sr-participant-status"><i class="fas fa-circle sr-status-on"></i> Connected</span>
        </div>
      </div>`;
    Object.entries(peers).forEach(([id, p]) => {
      html += `
        <div class="sr-participant-item">
          <div class="sr-participant-avatar"><i class="fas fa-user"></i></div>
          <div class="sr-participant-info">
            <span class="sr-participant-name">${escapeHTML(p.nickname || 'Student')}${p.handRaised ? ' <i class="fas fa-hand-paper" style="color:var(--accent,#cf6215);margin-left:4px;"></i>' : ''}</span>
            <span class="sr-participant-status"><i class="fas fa-circle sr-status-on"></i> Connected</span>
          </div>
        </div>`;
    });
    return html;
  }

  function buildProgressHTML() {
    let html = `
      <div class="sr-progress-item">
        <div class="sr-progress-user"><i class="fas fa-user"></i> ${escapeHTML(nickname)} (You)</div>
        <div class="sr-progress-goal">${studyGoal ? escapeHTML(studyGoal) : '<em>No goal set</em>'}</div>
        <div class="sr-progress-time"><i class="fas fa-clock"></i> <span class="sr-my-goal-timer">${fmtTime(timerMode === 'stopwatch' ? timerSeconds : timerRemaining)}</span></div>
      </div>`;
    Object.values(peers).forEach(p => {
      html += `
        <div class="sr-progress-item">
          <div class="sr-progress-user"><i class="fas fa-user"></i> ${escapeHTML(p.nickname || 'Student')}</div>
          <div class="sr-progress-goal">${p.goal ? escapeHTML(p.goal) : '<em>No goal set</em>'}</div>
          <div class="sr-progress-time"><i class="fas fa-clock"></i> ${fmtTime(p.seconds || 0)}</div>
        </div>`;
    });
    return html;
  }

  function setSpotlight(ownerId, ownerName = '') {
    screenShareOwnerId = ownerId;
    const stage = document.getElementById('srSpotlightStage');
    const video = document.getElementById('srSpotlightVideo');
    const label = document.getElementById('srSpotlightLabel');
    const area = document.getElementById('srParticipantArea');

    if (!stage || !video || !area) return;

    if (!ownerId) {
      stage.style.display = 'none';
      video.pause();
      video.srcObject = null;
      area.classList.remove('sr-has-spotlight');
      return;
    }

    area.classList.add('sr-has-spotlight');
    stage.style.display = 'flex';

    if (ownerId === 'self') {
      video.srcObject = localScreenStream;
      video.muted = true;
      if (label) label.textContent = `${escapeHTML(nickname)} (Your Screen)`;
    } else {
      const stream = remoteStreams.get(ownerId);
      if (stream) {
        video.srcObject = stream;
        video.muted = true;
      }
      if (label) label.textContent = `${escapeHTML(ownerName || peers[ownerId]?.nickname || 'Participant')}'s Screen`;
    }

    safePlayMedia(video);
  }

  function syncVideoTiles() {
    const grid = document.getElementById('srParticipantsGrid');
    if (!grid) return;

    const currentTileIds = new Set(['srTile_self']);
    Object.keys(peers).forEach(uId => currentTileIds.add(`srTile_${uId}`));

    let selfTile = document.getElementById('srTile_self');
    if (!selfTile) {
      selfTile = document.createElement('div');
      selfTile.className = 'sr-video-tile sr-video-local';
      selfTile.id = 'srTile_self';
      selfTile.innerHTML = `
        <div class="sr-video-off"><i class="fas fa-user"></i></div>
        <div class="sr-video-label">${escapeHTML(nickname)} (You)${isHost ? ' <i class="fas fa-crown" style="color:#f59e0b;"></i>' : ''}</div>
        <div class="sr-tile-hand" style="display:${handRaised ? 'block' : 'none'};"><i class="fas fa-hand-paper"></i></div>
      `;
      grid.appendChild(selfTile);
    } else {
      const label = selfTile.querySelector('.sr-video-label');
      if (label) label.innerHTML = `${escapeHTML(nickname)} (You)${isHost ? ' <i class="fas fa-crown" style="color:#f59e0b;"></i>' : ''}`;
      const hand = selfTile.querySelector('.sr-tile-hand');
      if (hand) hand.style.display = handRaised ? 'block' : 'none';
    }

    Object.entries(peers).forEach(([uId, p]) => {
      const tileId = `srTile_${uId}`;
      let tile = document.getElementById(tileId);
      if (!tile) {
        tile = document.createElement('div');
        tile.className = 'sr-video-tile';
        tile.id = tileId;
        tile.innerHTML = `
          <div class="sr-video-off"><i class="fas fa-user"></i></div>
          <div class="sr-video-label">${escapeHTML(p.nickname || 'Student')}</div>
          <div class="sr-tile-hand" style="display:${p.handRaised ? 'block' : 'none'};"><i class="fas fa-hand-paper"></i></div>
        `;
        grid.appendChild(tile);

        const stream = remoteStreams.get(uId);
        if (stream) renderRemoteMedia(uId, stream);
      } else {
        const label = tile.querySelector('.sr-video-label');
        if (label) label.textContent = p.nickname || 'Student';
        const hand = tile.querySelector('.sr-tile-hand');
        if (hand) hand.style.display = p.handRaised ? 'block' : 'none';
        tile.classList.toggle('sr-speaking', !!p.isSpeaking);
      }
    });

    Array.from(grid.children).forEach(tile => {
      if (tile.id && !currentTileIds.has(tile.id)) {
        tile.remove();
      }
    });

    const totalTiles = grid.children.length;
    grid.classList.remove('sr-grid-1', 'sr-grid-2', 'sr-grid-3', 'sr-grid-4plus');
    if (totalTiles <= 1) grid.classList.add('sr-grid-1');
    else if (totalTiles === 2) grid.classList.add('sr-grid-2');
    else if (totalTiles <= 4) grid.classList.add('sr-grid-3');
    else grid.classList.add('sr-grid-4plus');
  }

  /* =========================================================================
   * 10. POMODORO ENGINE
   * ========================================================================= */
  function startStudyTimerEngine() {
    if (mainInterval) clearInterval(mainInterval);

    mainInterval = setInterval(() => {
      if (!sessionActive && !isSoloMode) return;
      totalUptimeSeconds++;

      if (timerRunning) {
        if (timerMode === 'stopwatch') {
          timerSeconds++;
        } else {
          if (timerRemaining > 0) {
            timerRemaining--;
            if (timerRemaining === 0) {
              timerRunning = false;
              SoundFX.playChime();
              notify(timerMode === 'focus' ? 'Focus session complete! Take a break.' : 'Break finished! Back to focus.', 'success');
              if (timerMode === 'focus') {
                timerMode = 'break';
                timerDuration = 5 * 60;
                timerRemaining = 5 * 60;
              } else {
                timerMode = 'focus';
                timerDuration = 25 * 60;
                timerRemaining = 25 * 60;
              }
            }
          }
        }
      }

      updateTimerDisplay();

      document.querySelectorAll('.sr-my-goal-timer').forEach(el => {
        el.textContent = fmtTime(timerMode === 'stopwatch' ? timerSeconds : timerRemaining);
      });

      if (!isSoloMode && totalUptimeSeconds % 8 === 0) {
        broadcastData({
          type: 'progress',
          goal: studyGoal,
          seconds: timerMode === 'stopwatch' ? timerSeconds : timerRemaining
        });
        updateProgressUI();
      }
    }, 1000);
  }

  function toggleTimerPlayPause() {
    timerRunning = !timerRunning;
    if (!isSoloMode) broadcastTimerSync();
    updateTimerDisplay();
  }

  function resetTimer() {
    timerRunning = false;
    if (timerMode === 'stopwatch') timerSeconds = 0;
    else timerRemaining = timerDuration;
    if (!isSoloMode) broadcastTimerSync();
    updateTimerDisplay();
  }

  function cycleTimerMode() {
    if (timerMode === 'stopwatch') {
      timerMode = 'focus';
      timerDuration = 25 * 60;
      timerRemaining = 25 * 60;
    } else if (timerMode === 'focus') {
      timerMode = 'break';
      timerDuration = 5 * 60;
      timerRemaining = 5 * 60;
    } else if (timerMode === 'break') {
      timerMode = 'long_break';
      timerDuration = 15 * 60;
      timerRemaining = 15 * 60;
    } else {
      timerMode = 'stopwatch';
      timerSeconds = 0;
    }

    timerRunning = false;
    if (!isSoloMode) broadcastTimerSync();
    updateTimerDisplay();
  }

  function broadcastTimerSync() {
    broadcastData({
      type: 'timer-sync',
      mode: timerMode,
      running: timerRunning,
      seconds: timerSeconds,
      duration: timerDuration,
      remaining: timerRemaining
    });
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById('srPomoTimer');
    const playBtn = document.getElementById('srPomoPlayPause');
    const modeBtn = document.getElementById('srPomoToggleMode');

    if (timerEl) {
      const displayVal = timerMode === 'stopwatch' ? timerSeconds : timerRemaining;
      timerEl.textContent = fmtTime(displayVal);
      timerEl.style.color = timerMode === 'focus' ? 'var(--accent, #cf6215)' : (timerMode.includes('break') ? '#10b981' : 'var(--fg)');
    }

    if (playBtn) {
      playBtn.innerHTML = `<i class="fas fa-${timerRunning ? 'pause' : 'play'}"></i>`;
    }

    if (modeBtn) {
      let icon = 'stopwatch';
      if (timerMode === 'focus') icon = 'brain';
      else if (timerMode === 'break') icon = 'coffee';
      else if (timerMode === 'long_break') icon = 'umbrella-beach';
      modeBtn.innerHTML = `<i class="fas fa-${icon}"></i>`;
    }
  }

  /* =========================================================================
   * 11. LISTENERS & CHAT PIPELINE
   * ========================================================================= */
  function attachSessionListeners() {
    abortController.abort();
    abortController = new AbortController();
    const { signal } = abortController;

    document.getElementById('srCopyCode')?.addEventListener('click', () => {
      navigator.clipboard.writeText(roomAddress).then(() => notify('Room code copied to clipboard!', 'success')).catch(() => {
        prompt('Room Code:', roomAddress);
      });
    }, { signal });

    const pwReveal = document.getElementById('srPwReveal');
    if (pwReveal && roomPassword) {
      pwReveal.style.cursor = 'pointer';
      pwReveal.addEventListener('click', () => {
        pwReveal.textContent = pwReveal.textContent === '••••••' ? roomPassword : '••••••';
      }, { signal });
    }

    document.getElementById('srSpotlightFullscreen')?.addEventListener('click', () => {
      const stage = document.getElementById('srSpotlightStage');
      try {
        if (!document.fullscreenElement) stage?.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }, { signal });

    document.getElementById('srRaiseHandBtn')?.addEventListener('click', toggleRaiseHand, { signal });
    document.getElementById('srLeaveBtn')?.addEventListener('click', leaveRoom, { signal });
    document.getElementById('srChatSend')?.addEventListener('click', sendChatMessage, { signal });
    document.getElementById('srChatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); }, { signal });
    document.getElementById('srShareMaterial')?.addEventListener('click', handleShareMaterial, { signal });

    document.getElementById('srToggleScreenShare')?.addEventListener('click', toggleScreenShare, { signal });
    document.getElementById('srToggleMic')?.addEventListener('click', toggleMicrophone, { signal });
    document.getElementById('srToggleCamera')?.addEventListener('click', toggleCamera, { signal });
    document.getElementById('srToggleWB')?.addEventListener('click', toggleWhiteboard, { signal });

    document.getElementById('srPomoToggleMode')?.addEventListener('click', cycleTimerMode, { signal });
    document.getElementById('srPomoPlayPause')?.addEventListener('click', toggleTimerPlayPause, { signal });
    document.getElementById('srPomoReset')?.addEventListener('click', resetTimer, { signal });

    document.querySelectorAll('.sr-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sr-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sr-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        activeSidebarTab = btn.dataset.tab;
        if (activeSidebarTab === 'chat') {
          unreadChatCount = 0;
          updateUnreadBadge();
        }
        const panel = document.getElementById('srTab' + capitalize(activeSidebarTab));
        if (panel) panel.classList.add('active');
      }, { signal });
    });

    document.querySelectorAll('.sr-react-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        spawnFloatingReaction(emoji);
        if (!isSoloMode) broadcastData({ type: 'reaction', emoji });
      }, { signal });
    });

    document.querySelectorAll('.sr-amb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sr-amb-btn').forEach(b => b.classList.remove('sr-btn-primary'));
        btn.classList.add('sr-btn-primary');
        currentAmbienceTrack = btn.dataset.track;
        SoundFX.setAmbience(currentAmbienceTrack, ambienceVolume);
      }, { signal });
    });

    document.getElementById('srAmbienceVol')?.addEventListener('input', (e) => {
      ambienceVolume = parseFloat(e.target.value);
      SoundFX.setAmbienceVolume(ambienceVolume);
    }, { signal });

    const applyGoal = () => {
      const input = document.getElementById('srGoalInput');
      studyGoal = input?.value.trim() || '';
      if (!isSoloMode) broadcastData({ type: 'progress', goal: studyGoal, seconds: timerSeconds });
      updateProgressUI();
      notify('Study goal updated.', 'success');
    };

    document.getElementById('srSetGoal')?.addEventListener('click', applyGoal, { signal });
    document.getElementById('srGoalInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') applyGoal(); }, { signal });

    setupPushToTalk(signal);
    initWhiteboardListeners(signal);
  }

  function updateUnreadBadge() {
    const badge = document.getElementById('srUnreadBadge');
    if (badge) {
      badge.style.display = unreadChatCount > 0 ? 'inline-block' : 'none';
      badge.textContent = unreadChatCount;
    }
  }

  function toggleRaiseHand() {
    handRaised = !handRaised;
    const btn = document.getElementById('srRaiseHandBtn');
    if (btn) btn.classList.toggle('sr-ctrl-active', handRaised);
    if (!isSoloMode) broadcastData({ type: 'hand-raise', raised: handRaised });
    updateParticipantsUI();
    if (handRaised) {
      SoundFX.playHandRaise();
      notify('Hand raised.', 'info');
    }
  }

  function spawnFloatingReaction(emoji) {
    SoundFX.playPop();
    const container = document.getElementById('srParticipantArea');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'sr-floating-reaction';
    el.textContent = emoji;
    el.style.left = `${20 + Math.random() * 60}%`;
    el.style.bottom = '80px';
    container.appendChild(el);

    setTimeout(() => el.remove(), 2000);
  }

  function sendChatMessage() {
    const input = document.getElementById('srChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const msg = {
      senderId: myId,
      senderName: nickname,
      text: text,
      time: Date.now(),
      type: 'chat'
    };

    chatMessages.push(msg);
    if (!isSoloMode) broadcastData(msg);
    renderChatMessages();
  }

  function handleShareMaterial() {
    const fileInput = document.getElementById('srMaterialFile');
    if (!fileInput) return;
    fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        notify('File exceeds 8MB sharing limit.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const base64Data = e.target.result;
        if (!isSoloMode) broadcastData({ type: 'study-material', fileName: file.name, fileData: base64Data });
        receiveStudyMaterial(myId, base64Data, file.name);
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    };
  }

  function receiveStudyMaterial(fromId, fileData, fileName) {
    const senderName = (fromId === myId) ? nickname : (peers[fromId]?.nickname || 'Someone');
    const safeName = escapeHTML(fileName);
    const safeUri = encodeURI(fileData);
    const msgHtml = `Shared a file: <br><a href="${safeUri}" download="${safeName}" class="sr-file-download-link"><i class="fas fa-file-download"></i> ${safeName}</a>`;
    chatMessages.push({ senderId: fromId, senderName: senderName, text: msgHtml, time: Date.now(), type: 'html' });
    renderChatMessages();
    SoundFX.playPop();
  }

  function renderChatMessages() {
    const container = document.getElementById('srChatMessages');
    if (!container) return;
    if (chatMessages.length === 0) {
      container.innerHTML = '<div class="sr-chat-empty"><i class="fas fa-comments"></i><p>No messages yet.</p></div>';
      return;
    }
    container.innerHTML = chatMessages.map(m => {
      const isMe = m.senderId === myId;
      const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (m.type === 'system') {
        return `<div class="sr-chat-msg sr-chat-system"><em>${escapeHTML(m.text)}</em></div>`;
      }
      return `
        <div class="sr-chat-msg ${isMe ? 'sr-chat-me' : 'sr-chat-other'}">
          <span class="sr-chat-sender">${escapeHTML(m.senderName)}</span>
          <span class="sr-chat-text">${m.type === 'html' ? m.text : escapeHTML(m.text)}</span>
          <span class="sr-chat-time">${timeStr}</span>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function addSystemMessage(text) {
    chatMessages.push({ senderId: '', senderName: '', text, time: Date.now(), type: 'system' });
    renderChatMessages();
  }

  /* =========================================================================
   * 12. VECTOR WHITEBOARD
   * ========================================================================= */
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

    renderCanvasGrid();

    wbZoom = 1;
    wbPanX = (wbCanvasW - getWrapSize().w) / 2;
    wbPanY = (wbCanvasH - getWrapSize().h) / 2;
    applyTransform();
    updateZoomLabel();
    replayAllStrokes();
  }

  function renderCanvasGrid() {
    if (!wbCtx) return;
    wbCtx.fillStyle = '#181824';
    wbCtx.fillRect(0, 0, wbCanvasW, wbCanvasH);

    if (wbGridStyle === 'dots') {
      wbCtx.fillStyle = '#2e2e42';
      for (let x = 20; x < wbCanvasW; x += 40) {
        for (let y = 20; y < wbCanvasH; y += 40) {
          wbCtx.fillRect(x, y, 2, 2);
        }
      }
    } else if (wbGridStyle === 'grid') {
      wbCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      wbCtx.lineWidth = 1;
      wbCtx.beginPath();
      for (let x = 0; x < wbCanvasW; x += 40) {
        wbCtx.moveTo(x, 0); wbCtx.lineTo(x, wbCanvasH);
      }
      for (let y = 0; y < wbCanvasH; y += 40) {
        wbCtx.moveTo(0, y); wbCtx.lineTo(wbCanvasW, y);
      }
      wbCtx.stroke();
    }
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

  function selectWbTool(tool) {
    wbTool = tool;
    document.querySelectorAll('.sr-wb-tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
  }

  function initWhiteboardListeners(signal) {
    const wrap = document.getElementById('srWbCanvasWrap');
    if (!wrap) return;

    document.querySelectorAll('.sr-wb-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => selectWbTool(btn.dataset.tool), { signal });
    });

    document.getElementById('srWbColor')?.addEventListener('input', e => { wbColor = e.target.value; }, { signal });
    document.getElementById('srWbPenSize')?.addEventListener('input', e => {
      wbPenSize = parseInt(e.target.value) || 3;
      const v = document.getElementById('srWbPenSizeVal');
      if (v) v.textContent = wbPenSize;
    }, { signal });

    document.getElementById('srWbGridToggle')?.addEventListener('click', () => {
      wbGridStyle = wbGridStyle === 'dots' ? 'grid' : (wbGridStyle === 'grid' ? 'none' : 'dots');
      renderCanvasGrid();
      replayAllStrokes();
    }, { signal });

    document.getElementById('srWbUndo')?.addEventListener('click', () => {
      undoCanvasLocal();
      if (!isSoloMode) broadcastData({ type: 'wb-undo' });
    }, { signal });

    document.getElementById('srWbRedo')?.addEventListener('click', () => {
      redoCanvasLocal();
      if (!isSoloMode) broadcastData({ type: 'wb-redo' });
    }, { signal });

    document.getElementById('srWbClear')?.addEventListener('click', () => {
      clearCanvasLocal();
      if (!isSoloMode) broadcastData({ type: 'wb-clear' });
    }, { signal });

    document.getElementById('srWbAddQ')?.addEventListener('click', addQuestion, { signal });

    document.getElementById('srWbZoomIn')?.addEventListener('click', () => {
      const r = wrap.getBoundingClientRect();
      zoomAtPoint(wbZoom * 1.25, r.left + r.width / 2, r.top + r.height / 2);
    }, { signal });
    document.getElementById('srWbZoomOut')?.addEventListener('click', () => {
      const r = wrap.getBoundingClientRect();
      zoomAtPoint(wbZoom / 1.25, r.left + r.width / 2, r.top + r.height / 2);
    }, { signal });
    document.getElementById('srWbZoomReset')?.addEventListener('click', () => {
      wbZoom = 1;
      wbPanX = (wbCanvasW - getWrapSize().w) / 2;
      wbPanY = (wbCanvasH - getWrapSize().h) / 2;
      applyTransform();
      updateZoomLabel();
    }, { signal });

    document.getElementById('srWbFullscreen')?.addEventListener('click', () => {
      const panel = document.getElementById('srWhiteboardPanel');
      try {
        if (!document.fullscreenElement) panel?.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }, { signal });

    document.getElementById('srWbDownload')?.addEventListener('click', downloadWhiteboard, { signal });

    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAtPoint(wbZoom * factor, e.clientX, e.clientY);
    }, { passive: false, signal });

    wrap.addEventListener('pointerdown', onPointerDown, { signal });
    wrap.addEventListener('pointermove', onPointerMove, { signal });
    wrap.addEventListener('pointerup', onPointerUp, { signal });
  }

  function zoomAtPoint(newZoom, screenX, screenY) {
    const wrap = document.getElementById('srWbCanvasWrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const sx = screenX - rect.left;
    const sy = screenY - rect.top;
    const vxBefore = sx / wbZoom + wbPanX;
    const vyBefore = sy / wbZoom + wbPanY;
    wbZoom = Math.max(0.1, Math.min(4, newZoom));
    wbPanX = vxBefore - sx / wbZoom;
    wbPanY = vyBefore - sy / wbZoom;
    applyTransform();
    updateZoomLabel();
  }

  function onPointerDown(e) {
    if (e.target !== wbCanvas && e.target !== wbOverlay) return;
    if (e.pointerType !== 'mouse') e.preventDefault();
    if (!wbCtx) setupCanvas();
    const { x, y } = canvasXY(e);

    if (e.button === 1 || wbTool === 'pan' || e.spaceKey) {
      wbPanning = true;
      wbPanStart = { mx: e.clientX, my: e.clientY, px: wbPanX, py: wbPanY };
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    wbDrawing = true;
    wbRedoStrokes = [];

    if (['line', 'arrow', 'rect', 'circle'].includes(wbTool)) {
      wbShapeStart = { x, y };
      return;
    }

    if (wbTool === 'text') {
      const text = prompt('Enter text for canvas:');
      if (text) {
        drawTextOnCanvas(text, x, y, wbColor, wbPenSize * 4 + 12);
        wbStrokes.push({ type: 'text', text, x, y, color: wbColor, size: wbPenSize * 4 + 12 });
        if (!isSoloMode) broadcastData({ type: 'wb-text', text, x, y, color: wbColor, size: wbPenSize * 4 + 12 });
      }
      wbDrawing = false;
      return;
    }

    _liveStrokePoints = [{ x, y }];
    wbCtx.beginPath();
    wbCtx.moveTo(x, y);
  }

  function onPointerMove(e) {
    if (e.target !== wbCanvas && e.target !== wbOverlay && !wbDrawing && !wbPanning) return;
    if (e.pointerType !== 'mouse') e.preventDefault();
    const { x, y } = canvasXY(e);

    if (!isSoloMode && Date.now() - _lastLiveBroadcast > 50) {
      broadcastData({ type: 'wb-cursor', x, y, color: wbColor });
      _lastLiveBroadcast = Date.now();
    }

    if (wbPanning && wbPanStart) {
      wbPanX = wbPanStart.px - (e.clientX - wbPanStart.mx) / wbZoom;
      wbPanY = wbPanStart.py - (e.clientY - wbPanStart.my) / wbZoom;
      applyTransform();
      return;
    }

    if (!wbDrawing || !wbCtx) return;

    if (wbShapeStart) {
      if (wbOCtx) {
        wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
        drawShapeOnContext(wbOCtx, wbTool, wbShapeStart, { x, y }, wbColor, wbPenSize);
      }
      return;
    }

    _liveStrokePoints.push({ x, y });

    if (!isSoloMode && _liveStrokePoints.length % 3 === 0) {
      broadcastData({
        type: 'wb-live-draw',
        points: _liveStrokePoints.slice(-4),
        color: wbTool === 'eraser' ? '#181824' : wbColor,
        size: wbTool === 'eraser' ? wbEraserSize : wbPenSize,
        tool: wbTool,
        alpha: wbTool === 'highlighter' ? 0.3 : 1
      });
    }

    wbCtx.save();
    wbCtx.strokeStyle = wbTool === 'eraser' ? '#181824' : wbColor;
    wbCtx.lineWidth = wbTool === 'eraser' ? wbEraserSize : (wbTool === 'highlighter' ? wbHighlighterSize : wbPenSize);
    wbCtx.globalAlpha = wbTool === 'highlighter' ? 0.3 : 1;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    wbCtx.lineTo(x, y);
    wbCtx.stroke();
    wbCtx.beginPath();
    wbCtx.moveTo(x, y);
    wbCtx.restore();
  }

  function onPointerUp(e) {
    if (wbPanning) { wbPanning = false; return; }
    if (!wbDrawing) return;
    wbDrawing = false;
    const { x, y } = canvasXY(e);

    if (wbShapeStart) {
      if (wbOCtx) wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);
      drawShapeOnCanvas(wbTool, wbShapeStart, { x, y }, wbColor, wbPenSize);
      wbStrokes.push({ type: 'shape', shape: wbTool, start: wbShapeStart, end: { x, y }, color: wbColor, size: wbPenSize });
      if (!isSoloMode) broadcastData({ type: 'wb-shape', shape: wbTool, start: wbShapeStart, end: { x, y }, color: wbColor, size: wbPenSize });
      wbShapeStart = null;
      return;
    }

    if (_liveStrokePoints.length > 1) {
      const strokeData = {
        type: 'stroke',
        points: _liveStrokePoints.slice(),
        color: wbTool === 'eraser' ? '#181824' : wbColor,
        size: wbTool === 'eraser' ? wbEraserSize : (wbTool === 'highlighter' ? wbHighlighterSize : wbPenSize),
        tool: wbTool,
        alpha: wbTool === 'highlighter' ? 0.3 : 1
      };
      wbStrokes.push(strokeData);
      if (!isSoloMode) broadcastData({ type: 'wb-stroke', ...strokeData });
    }
    _liveStrokePoints = [];
  }

  function drawShapeOnContext(ctx, shape, start, end, color, size) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (shape === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (shape === 'arrow') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = size * 3 + 8;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'rect') {
      ctx.strokeRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    } else if (shape === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = Math.min(start.x, end.x) + rx;
      const cy = Math.min(start.y, end.y) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShapeOnCanvas(shape, start, end, color, size) {
    if (!wbCtx) return;
    drawShapeOnContext(wbCtx, shape, start, end, color, size);
  }

  function drawTextOnCanvas(text, x, y, color, size) {
    if (!wbCtx) return;
    wbCtx.save();
    wbCtx.fillStyle = color;
    wbCtx.font = `600 ${size}px sans-serif`;
    wbCtx.fillText(text, x, y);
    wbCtx.restore();
  }

  function replayLivePoints(points, color, size, tool, alpha) {
    if (!wbCtx || !points || points.length < 2) return;
    wbCtx.save();
    wbCtx.strokeStyle = color;
    wbCtx.lineWidth = size;
    wbCtx.globalAlpha = alpha || 1;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    wbCtx.beginPath();
    wbCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      wbCtx.lineTo(points[i].x, points[i].y);
    }
    wbCtx.stroke();
    wbCtx.restore();
  }

  function replayStroke(points, color, size, tool, alpha) {
    replayLivePoints(points, color, size, tool, alpha);
  }

  function replayAllStrokes() {
    renderCanvasGrid();
    for (const cmd of wbStrokes) {
      if (cmd.type === 'stroke') replayStroke(cmd.points, cmd.color, cmd.size, cmd.tool, cmd.alpha);
      else if (cmd.type === 'shape') drawShapeOnCanvas(cmd.shape, cmd.start, cmd.end, cmd.color, cmd.size);
      else if (cmd.type === 'text') drawTextOnCanvas(cmd.text, cmd.x, cmd.y, cmd.color, cmd.size);
    }
  }

  function renderRemoteCursors() {
    if (!wbOCtx) return;
    wbOCtx.clearRect(0, 0, wbCanvasW, wbCanvasH);

    const now = Date.now();
    Object.entries(wbRemoteCursors).forEach(([uId, cur]) => {
      if (now - cur.lastSeen > 5000) return;
      wbOCtx.save();
      wbOCtx.fillStyle = cur.color;
      wbOCtx.beginPath();
      wbOCtx.arc(cur.x, cur.y, 5 / wbZoom, 0, Math.PI * 2);
      wbOCtx.fill();

      wbOCtx.fillStyle = 'rgba(0,0,0,0.7)';
      wbOCtx.fillRect(cur.x + 8 / wbZoom, cur.y - 12 / wbZoom, 80 / wbZoom, 18 / wbZoom);
      wbOCtx.fillStyle = '#fff';
      wbOCtx.font = `${11 / wbZoom}px sans-serif`;
      wbOCtx.fillText(cur.name, cur.x + 12 / wbZoom, cur.y);
      wbOCtx.restore();
    });
  }

  function undoCanvasLocal() {
    if (wbStrokes.length === 0 || !wbCtx) return;
    wbRedoStrokes.push(wbStrokes.pop());
    replayAllStrokes();
  }

  function redoCanvasLocal() {
    if (wbRedoStrokes.length === 0 || !wbCtx) return;
    wbStrokes.push(wbRedoStrokes.pop());
    replayAllStrokes();
  }

  function clearCanvasLocal() {
    if (!wbCtx || !wbCanvas) return;
    wbStrokes = [];
    wbRedoStrokes = [];
    renderCanvasGrid();
  }

  function downloadWhiteboard() {
    if (!wbCanvas) return;
    const a = document.createElement('a');
    a.href = wbCanvas.toDataURL('image/png');
    a.download = `Whiteboard-${Date.now()}.png`;
    a.click();
    notify('Whiteboard exported as image.', 'success');
  }

  /* =========================================================================
   * 13. QUESTIONS & NOTES
   * ========================================================================= */
  function addQuestion() {
    const id = wbNextQId++;
    wbQuestions.push({ id, question: '', answer: '' });
    renderQuestionsUI();
    if (!isSoloMode) broadcastData({ type: 'wb-questions', questions: wbQuestions, nextId: wbNextQId });
  }

  function renderQuestionsUI() {
    const list = document.getElementById('srWbQList');
    if (!list) return;

    if (wbQuestions.length === 0) {
      list.innerHTML = '<div class="sr-wb-q-empty"><i class="fas fa-clipboard-list"></i><p>No questions added yet.</p></div>';
      return;
    }

    list.innerHTML = wbQuestions.map((q, idx) => `
      <div class="sr-wb-q-item" data-qid="${q.id}">
        <div class="sr-wb-q-num">Q${idx + 1}
          <button class="sr-wb-q-del" data-qid="${q.id}" title="Remove"><i class="fas fa-times"></i></button>
        </div>
        <textarea class="sr-wb-q-textarea" data-field="question" data-qid="${q.id}" placeholder="Type question / topic…">${escapeHTML(q.question)}</textarea>
        <textarea class="sr-wb-q-textarea sr-wb-q-answer" data-field="answer" data-qid="${q.id}" placeholder="Type notes / solution…">${escapeHTML(q.answer)}</textarea>
      </div>
    `).join('');

    list.querySelectorAll('.sr-wb-q-textarea').forEach(ta => {
      ta.addEventListener('input', e => {
        const qid = parseInt(e.target.dataset.qid);
        const field = e.target.dataset.field;
        const q = wbQuestions.find(item => item.id === qid);
        if (q) {
          q[field] = e.target.value;
          if (!isSoloMode) broadcastData({ type: 'wb-questions', questions: wbQuestions, nextId: wbNextQId });
        }
      });
    });

    list.querySelectorAll('.sr-wb-q-del').forEach(btn => {
      btn.addEventListener('click', e => {
        const qid = parseInt(e.currentTarget.dataset.qid);
        wbQuestions = wbQuestions.filter(q => q.id !== qid);
        renderQuestionsUI();
        if (!isSoloMode) broadcastData({ type: 'wb-questions', questions: wbQuestions, nextId: wbNextQId });
      });
    });
  }

  function updateParticipantsUI() {
    const list = document.getElementById('srParticipantsList');
    if (list) list.innerHTML = buildParticipantsHTML();
    syncVideoTiles();
    updatePeopleCount();
  }

  function updateProgressUI() {
    const list = document.getElementById('srProgressList');
    if (list) list.innerHTML = buildProgressHTML();
  }

  function updatePeopleCount() {
    const badge = document.getElementById('srPeopleCount');
    if (badge) badge.textContent = 1 + Object.keys(peers).length;
  }

  /* =========================================================================
   * 14. SESSION FLOW (CREATION & JOINING)
   * ========================================================================= */
  async function handleCreate() {
    SoundFX.init();
    nickname = document.getElementById('srNickname')?.value.trim() || 'Host';
    localStorage.setItem('questionary-study-nickname', nickname);
    roomPassword = document.getElementById('srCreatePassword')?.value || '';
    isHost = true;

    try {
      showLoading('Creating room…');

      roomAddress = generateRandomRoomCode();
      await loadPeerJSLibrary();

      if (peerInstance) {
        try { peerInstance.destroy(); } catch (e) {}
        peerInstance = null;
      }

      const hostId = `qroom-${roomAddress}-host`;
      peerInstance = new window.Peer(hostId, { config: ICE_CONFIG });

      peerInstance.on('open', (id) => {
        myId = id;
        sessionActive = true;
        isSoloMode = false;
        startStudyTimerEngine();
        hideLoading();
        renderActiveSession();
        SoundFX.playJoin();
        notify(`Study Room live! Code: ${roomAddress}`, 'success');
      });

      peerInstance.on('connection', (conn) => {
        setupPeerDataConnection(conn);
      });

      peerInstance.on('call', (call) => {
        const stream = getActiveCombinedStream();
        call.answer(stream);
        setupPeerCall(call);
      });

      peerInstance.on('error', (err) => {
        hideLoading();
        if (err.type === 'unavailable-id') {
          handleCreate();
        } else {
          notify('Connection notice: ' + (err.type || err), 'warning');
        }
      });

    } catch (err) {
      hideLoading();
      cleanup();
      renderStudyRoom();
      notify('Could not start study room: ' + (err.message || err), 'error');
    }
  }

  async function handleJoin() {
    SoundFX.init();
    nickname = document.getElementById('srNickname')?.value.trim() || 'Student';
    localStorage.setItem('questionary-study-nickname', nickname);
    const rawInput = document.getElementById('srJoinAddress')?.value.trim();
    if (!rawInput) {
      notify('Please enter a 10-digit room code.', 'error');
      return;
    }
    roomPassword = document.getElementById('srJoinPassword')?.value || '';
    isHost = false;

    const cleanCode = normalizeRoomCode(rawInput);
    if (cleanCode.length !== ROOM_CODE_LENGTH) {
      notify('Invalid room code length (expected 10 characters).', 'error');
      return;
    }

    try {
      showLoading('Connecting to room…');
      roomAddress = cleanCode;
      await loadPeerJSLibrary();

      if (peerInstance) {
        try { peerInstance.destroy(); } catch (e) {}
        peerInstance = null;
      }

      const clientId = 'qclient-' + Math.random().toString(36).substring(2, 9);
      peerInstance = new window.Peer(clientId, { config: ICE_CONFIG });

      peerInstance.on('open', (id) => {
        myId = id;
        const hostId = `qroom-${cleanCode}-host`;
        const hostConn = peerInstance.connect(hostId, {
          reliable: true,
          metadata: { nickname, password: roomPassword }
        });

        setupPeerDataConnection(hostConn);

        hostConn.on('open', () => {
          sessionActive = true;
          isSoloMode = false;
          startStudyTimerEngine();
          hideLoading();
          renderActiveSession();
          SoundFX.playJoin();
          notify('Connected to Study Room.', 'success');
        });

        hostConn.on('error', () => {
          hideLoading();
          notify('Could not reach room host. Verify the code.', 'error');
          cleanup();
          renderStudyRoom();
        });
      });

      peerInstance.on('connection', (conn) => {
        setupPeerDataConnection(conn);
      });

      peerInstance.on('call', (call) => {
        const stream = getActiveCombinedStream();
        call.answer(stream);
        setupPeerCall(call);
      });

      peerInstance.on('error', (err) => {
        hideLoading();
        notify('Connection error: ' + (err.type || err), 'error');
        cleanup();
        renderStudyRoom();
      });
    } catch (err) {
      hideLoading();
      notify(err.message || 'Could not join room.', 'error');
    }
  }

  function startSoloMode() {
    isSoloMode = true;
    sessionActive = false;
    isHost = true;
    roomAddress = 'SOLO';
    nickname = document.getElementById('srNickname')?.value.trim() || 'Student';
    startStudyTimerEngine();
    renderActiveSession();
    notify('Opened Solo Offline Whiteboard.', 'info');
  }

  async function leaveRoom() {
    if (typeof window.showConfirm === 'function') {
      const ok = await window.showConfirm('Leave Study Room?');
      if (!ok) return;
    }
    doLeave();
    renderStudyRoom();
    notify('Left study session.', 'info');
  }

  function forceLeaveRoom() {
    doLeave();
    renderStudyRoom();
  }

  function doLeave() {
    abortController.abort();

    if (mainInterval) { clearInterval(mainInterval); mainInterval = null; }
    if (speechInterval) { clearInterval(speechInterval); speechInterval = null; }
    stopScreenShare();
    SoundFX.stopAmbience();

    if (localAudioStream) {
      localAudioStream.getTracks().forEach(t => t.stop());
      localAudioStream = null;
    }
    if (localVideoStream) {
      localVideoStream.getTracks().forEach(t => t.stop());
      localVideoStream = null;
    }

    remoteStreams.forEach((stream) => {
      stream.getTracks().forEach(t => t.stop());
    });
    remoteStreams.clear();
    peerDataConns.clear();
    peerMediaCalls.clear();

    if (peerInstance) {
      try { peerInstance.destroy(); } catch (_) {}
      peerInstance = null;
    }

    sessionActive = false;
    isSoloMode = false;
    isHost = false;
    myId = '';
    peers = {};
    screenShareOwnerId = null;
    roomAddress = '';
    roomPassword = '';
    chatMessages = [];
    studyGoal = '';
    timerSeconds = 0;
    timerRemaining = 25 * 60;
    timerRunning = false;
    timerMode = 'stopwatch';
    wbActive = false;
    unreadChatCount = 0;
    handRaised = false;
    micActive = false;
    camActive = false;
    isSpeaking = false;
  }

  function cleanup() {
    abortController.abort();
    if (peerInstance) { try { peerInstance.destroy(); } catch (_) {} peerInstance = null; }
    remoteStreams.forEach((stream) => {
      stream.getTracks().forEach(t => t.stop());
    });
    remoteStreams.clear();
    peerDataConns.clear();
    peerMediaCalls.clear();
    sessionActive = false;
    isSoloMode = false;
    isHost = false;
    myId = '';
    peers = {};
    screenShareOwnerId = null;
  }

  function showLoading(msg) {
    let overlay = document.getElementById('srLoadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'srLoadingOverlay';
      overlay.className = 'sr-loading-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="sr-loading-box"><div class="sr-spinner"></div><p>${msg || 'Connecting…'}</p></div>`;
    overlay.style.display = 'flex';
  }

  function hideLoading() {
    const overlay = document.getElementById('srLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* =========================================================================
   * 15. HARDWARE TESTING
   * ========================================================================= */
  async function testMicrophone() {
    try {
      const select = document.getElementById('audioInputSelect');
      const deviceId = select ? select.value : undefined;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      });

      const row = document.getElementById('micTestVolumeRow');
      const bar = document.getElementById('micTestVolumeBar');
      if (row) row.style.display = 'flex';

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let count = 0;
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const vol = Math.min(100, Math.round((sum / data.length) * 2));
        if (bar) bar.style.width = vol + '%';
        count++;
        if (count > 50) {
          clearInterval(interval);
          stream.getTracks().forEach(t => t.stop());
          ctx.close();
          if (row) row.style.display = 'none';
        }
      }, 100);
      notify('Testing microphone for 5 seconds… Speak now.', 'info');
    } catch (e) {
      notify('Microphone test failed: ' + e.message, 'error');
    }
  }

  function testSpeaker() {
    SoundFX.playChime();
    notify('Playing test chime…', 'info');
  }

  async function testCamera() {
    const container = document.getElementById('camTestContainer');
    const video = document.getElementById('camTestVideo');
    const select = document.getElementById('videoInputSelect');
    const deviceId = select ? select.value : undefined;

    if (!container || !video) return;

    if (container.style.display !== 'none' && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      container.style.display = 'none';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      });
      video.srcObject = stream;
      container.style.display = 'block';
      notify('Camera active. Click Test again to stop.', 'info');
    } catch (e) {
      notify('Camera test failed: ' + e.message, 'error');
    }
  }

  async function initStudyRoomMediaSettings() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioSelect = document.getElementById('audioInputSelect');
      const videoSelect = document.getElementById('videoInputSelect');
      const speakerSelect = document.getElementById('audioOutputSelect');

      if (audioSelect) {
        audioSelect.innerHTML = '<option value="">Default Microphone</option>';
        devices.filter(d => d.kind === 'audioinput').forEach((d, i) => {
          audioSelect.innerHTML += `<option value="${d.deviceId}">${d.label || `Microphone ${i + 1}`}</option>`;
        });
      }

      if (videoSelect) {
        videoSelect.innerHTML = '<option value="">Default Camera</option>';
        devices.filter(d => d.kind === 'videoinput').forEach((d, i) => {
          videoSelect.innerHTML += `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`;
        });
      }

      if (speakerSelect) {
        speakerSelect.innerHTML = '<option value="">Default Speaker</option>';
        devices.filter(d => d.kind === 'audiooutput').forEach((d, i) => {
          speakerSelect.innerHTML += `<option value="${d.deviceId}">${d.label || `Speaker ${i + 1}`}</option>`;
        });
      }
    } catch (e) {
      console.warn('[StudyRoom] Media enumeration note:', e);
    }
  }

  // Graceful browser shutdown handling
  window.addEventListener('beforeunload', () => {
    if (sessionActive) {
      doLeave();
    }
  });

  window.addEventListener('pagehide', () => {
    if (sessionActive) {
      doLeave();
    }
  });

  /* =========================================================================
   * 16. GLOBAL EXPORTS
   * ========================================================================= */
  window.renderStudyRoom = renderStudyRoom;
  window.leaveStudyRoom = leaveRoom;
  window.srToggleMicrophone = toggleMicrophone;
  window.srToggleCamera = toggleCamera;
  window.srToggleScreenShare = toggleScreenShare;
  window.srToggleWB = toggleWhiteboard;
  window.srToggleHand = toggleRaiseHand;
  window.srKickUser = (targetId) => {
    if (isHost) broadcastData({ type: 'mod-kick', targetId });
  };
  window.wbSelectTool = selectWbTool;
  window.wbUndo = () => {
    undoCanvasLocal();
    if (!isSoloMode) broadcastData({ type: 'wb-undo' });
  };
  window.wbRedo = () => {
    redoCanvasLocal();
    if (!isSoloMode) broadcastData({ type: 'wb-redo' });
  };
  window.isWhiteboardActive = () => wbActive && (sessionActive || isSoloMode);
  window.testMicrophone = testMicrophone;
  window.testSpeaker = testSpeaker;
  window.testCamera = testCamera;
  window.initStudyRoomMediaSettings = initStudyRoomMediaSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderStudyRoom);
  } else {
    renderStudyRoom();
  }

})(window, document);
