/**
 * server.js — Phuebus Engine Host
 *
 * Responsibilities:
 *   • Express static server  → serves /public
 *   • Socket.IO (WebSocket)  → bidirectional control events between /display and /remote
 *   • PeerServer (embedded)  → WebRTC signaling relay at /peerjs for camera streaming
 *
 * Phase 1: LAN-only, zero cloud dependencies.
 * Socket events: join_room, register_peer, preset_change, slider_update,
 *                engine_switch, prompt_update, audio_source_change, fps_cap_change
 *
 * Latency budget: Socket.IO control events < 10ms on LAN (SPEC.md §2)
 */

'use strict';

require('dotenv').config();

const https       = require('node:https');
const fs          = require('node:fs');
const path        = require('node:path');
const os          = require('node:os');
const express     = require('express');
const { Server }  = require('socket.io');
const { ExpressPeerServer } = require('peer');
const selfsigned  = require('selfsigned');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const IS_DEV = (process.env.NODE_ENV ?? 'development') !== 'production';

// ── LAN IP helper (for startup banner & QR target URL) ───────────────────────
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

// ── SSL / Secure Context setup ───────────────────────────────────────────────
const { execSync } = require('node:child_process');
const certsDir = path.join(__dirname, 'certs');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  try {
    execSync(`node "${path.join(__dirname, 'generate-certs.js')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('[Server] Failed to generate SSL certificates:', err);
  }
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// ── Room code generator ───────────────────────────────────────────────────────
// Omits confusable characters: 0/O, 1/I/L
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(length = 4) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// Auto-generated default code for this server session
const DEFAULT_ROOM_CODE = generateCode();

// ── App setup ─────────────────────────────────────────────────────────────────
const app        = express();
const httpServer = https.createServer(sslOptions, app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
// Force WebSocket transport — eliminates HTTP polling overhead for <10ms LAN latency
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// ── PeerServer (embedded) ─────────────────────────────────────────────────────
// Mounted at /peerjs — same port, same process, no external signaling dependency
const peerServer = ExpressPeerServer(httpServer, {
  debug: IS_DEV,
  path: '/',
});
app.use('/peerjs', peerServer);

// PeerServer lifecycle logging
peerServer.on('connection', (client) => {
  if (IS_DEV) console.log(`[PeerServer] client connected: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
  if (IS_DEV) console.log(`[PeerServer] client disconnected: ${client.getId()}`);
});

// ── Static assets ─────────────────────────────────────────────────────────────
// Serve compiled client bundle assets from the Vite output dir 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to React index.html for all page requests
app.get(['/', '/display', '/remote'], (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});



// ── Room state ────────────────────────────────────────────────────────────────
/**
 * rooms: Map<roomCode, RoomState>
 *
 * RoomState = {
 *   displayPeerId: string | null,   ← PeerJS ID of the display host
 *   remotePeerIds: string[],        ← PeerJS IDs of connected remotes
 *   socketIds: Set<string>,         ← Socket.IO socket IDs in this room
 * }
 */
const rooms = new Map();

function getOrCreateRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      displayPeerId: null,
      remotePeerIds: [],
      socketIds: new Set(),
    });
  }
  return rooms.get(code);
}

function roomSnapshot(code) {
  const room = rooms.get(code);
  if (!room) return { roomCode: code, displayPeerId: null, remotePeerIds: [] };
  return {
    roomCode:      code,
    displayPeerId: room.displayPeerId,
    remotePeerIds: [...room.remotePeerIds],
  };
}

// ── HTTP API routes ───────────────────────────────────────────────────────────

/**
 * GET /api/session
 * Returns the server's auto-generated room code + LAN URL.
 * Called by index.html and display.html on load to pre-fill the code.
 */
app.get('/api/session', (_req, res) => {
  const lanIP = getLanIP();
  res.json({
    roomCode:   DEFAULT_ROOM_CODE,
    port:       PORT,
    remoteUrl:  `https://${lanIP}:${PORT}/remote?code=${DEFAULT_ROOM_CODE}`,
    displayUrl: `https://${lanIP}:${PORT}/display?code=${DEFAULT_ROOM_CODE}`,
  });
});

/**
 * GET /api/session/new
 * Generates a fresh room code on demand (for the manual-override flow).
 * Does NOT replace the server's DEFAULT_ROOM_CODE.
 */
app.get('/api/session/new', (_req, res) => {
  res.json({ roomCode: generateCode() });
});

// ── Socket.IO event handlers ──────────────────────────────────────────────────

/**
 * Control events that are relayed verbatim to all other sockets in the same room.
 * Payloads must always include { roomCode: string }.
 * See AGENTS.md Quick Reference for canonical event names and payload shapes.
 */
const RELAY_EVENTS = [
  'preset_change',       // { roomCode, presetId }
  'slider_update',       // { roomCode, param, value }
  'engine_switch',       // { roomCode, mode: 'shader'|'diffusion'|'cloud' }
  'prompt_update',       // { roomCode, prompt }
  'audio_source_change', // { roomCode, deviceId }
  'fps_cap_change',      // { roomCode, fps: 15|30|60 }
];

io.on('connection', (socket) => {
  let activeRoomCode = null;

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode } = {}) => {
    if (!roomCode || typeof roomCode !== 'string') return;
    const code = roomCode.toUpperCase().trim();

    // Leave any previous room
    if (activeRoomCode && activeRoomCode !== code) {
      socket.leave(activeRoomCode);
      const prev = rooms.get(activeRoomCode);
      if (prev) prev.socketIds.delete(socket.id);
    }

    activeRoomCode = code;
    socket.join(code);

    const room = getOrCreateRoom(code);
    room.socketIds.add(socket.id);

    // Send current room state back to the joining socket immediately
    socket.emit('room_state', roomSnapshot(code));

    if (IS_DEV) console.log(`[Socket] ${socket.id} joined room ${code}`);
  });

  // ── register_peer ──────────────────────────────────────────────────────────
  // Called by display.js (role: 'display') and remote.js (role: 'remote')
  // after PeerJS peer.on('open') fires with a peerId.
  socket.on('register_peer', ({ roomCode, peerId, role } = {}) => {
    if (!roomCode || !peerId || !role) return;
    const code = roomCode.toUpperCase().trim();
    const room = getOrCreateRoom(code);

    if (role === 'display') {
      room.displayPeerId = peerId;
    } else if (role === 'remote') {
      if (!room.remotePeerIds.includes(peerId)) {
        room.remotePeerIds.push(peerId);
      }
    }

    // Broadcast updated room state to everyone in the room so
    // display.js can initiate the WebRTC call to the new remote peer.
    io.to(code).emit('room_state', roomSnapshot(code));

    if (IS_DEV) console.log(`[Socket] peer registered — room:${code} role:${role} id:${peerId}`);
  });

  // ── relay control events ───────────────────────────────────────────────────
  // Each event is forwarded to all OTHER sockets in the same room.
  // The sender is excluded via socket.to() (not io.to()).
  // Latency target: < 10ms on LAN (SPEC.md §2)
  RELAY_EVENTS.forEach((event) => {
    socket.on(event, (data) => {
      if (!data?.roomCode) return;
      const code = data.roomCode.toUpperCase().trim();
      socket.to(code).emit(event, data);
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (activeRoomCode) {
      const room = rooms.get(activeRoomCode);
      if (room) {
        room.socketIds.delete(socket.id);
        // Clean up empty rooms to prevent memory growth in long sessions
        if (room.socketIds.size === 0) {
          rooms.delete(activeRoomCode);
          if (IS_DEV) console.log(`[Socket] room ${activeRoomCode} cleaned up (empty)`);
        }
      }
    }
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
if (require.main === module) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    const lanIP = getLanIP();
    const remoteUrl = `https://${lanIP}:${PORT}/remote?code=${DEFAULT_ROOM_CODE}`;

    console.log('');
    console.log('┌──────────────────────────────────────────────────────┐');
    console.log('│            Phuebus Engine  ·  Phase 1                │');
    console.log('├──────────────────────────────────────────────────────┤');
    console.log(`│  Display  →  https://localhost:${PORT}/display         │`);
    console.log(`│  Remote   →  ${remoteUrl.padEnd(40)} │`);
    console.log(`│  Session Code: ${DEFAULT_ROOM_CODE}                              │`);
    console.log('│  (scan QR on /display or enter code on /remote)      │');
    console.log('└──────────────────────────────────────────────────────┘');
    console.log('');
  });
}

module.exports = { app, httpServer, io, rooms, DEFAULT_ROOM_CODE };

