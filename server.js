const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── METERED TURN CONFIG ──────────────────────────────────────────────────────
// Sign up free at https://www.metered.ca/stun-turn
// Add your credentials to a .env file (never commit it):
//   METERED_API_KEY=your_api_key_here
//   METERED_APP_NAME=your-app-name   (the subdomain, e.g. "talky" → talky.metered.live)
//
// Free tier: 500 GB/month relay bandwidth — plenty for a side project.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const METERED_API_KEY  = process.env.METERED_API_KEY  || '';
const METERED_APP_NAME = process.env.METERED_APP_NAME || '';

// Cache TURN credentials for 1 hour (they expire every 24h from Metered)
let turnCredentialsCache = null;
let turnCacheExpiry = 0;

async function fetchTurnCredentials() {
  if (!METERED_API_KEY || !METERED_APP_NAME) {
    // No credentials configured — return only STUN so the app still works
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }

  // Return cached credentials if still valid
  if (turnCredentialsCache && Date.now() < turnCacheExpiry) {
    return turnCredentialsCache;
  }

  try {
    const url = `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Metered API returned ${res.status}`);
    const iceServers = await res.json();
    // Always prepend Google STUN as a fast fallback
    turnCredentialsCache = [
      { urls: 'stun:stun.l.google.com:19302' },
      ...iceServers
    ];
    turnCacheExpiry = Date.now() + 60 * 60 * 1000; // cache 1 hour
    console.log(`[TURN] Fetched ${iceServers.length} ICE servers from Metered`);
    return turnCredentialsCache;
  } catch (err) {
    console.error('[TURN] Failed to fetch Metered credentials:', err.message);
    // Graceful fallback to STUN only
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }
}

// Endpoint the frontend calls to get ICE server config
// Credentials are served from the server so the API key is never exposed
app.get('/api/turn', async (req, res) => {
  const iceServers = await fetchTurnCredentials();
  res.json({ iceServers });
});
// ─────────────────────────────────────────────────────────────────────────────

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Waiting queue: { socketId, interests, country }
let waitingQueue = [];

function findMatch(socket, interests, country) {
  // Try to find someone with overlapping interests + matching country first
  let idx = waitingQueue.findIndex(u =>
    u.socketId !== socket.id &&
    (country === '' || u.country === '' || u.country === country) &&
    u.interests.some(i => interests.includes(i))
  );
  // Fall back to anyone waiting
  if (idx === -1) {
    idx = waitingQueue.findIndex(u => u.socketId !== socket.id);
  }
  return idx;
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Client wants to find a match
  socket.on('find_match', ({ interests, country }) => {
    console.log(`[~] ${socket.id} looking for match | interests: ${interests} | country: ${country}`);

    const idx = findMatch(socket, interests, country);

    if (idx !== -1) {
      // Found a match
      const matched = waitingQueue.splice(idx, 1)[0];
      const roomId = `${socket.id}__${matched.socketId}`;

      socket.join(roomId);
      matched.socket.join(roomId);

      // Tell the initiator to create the WebRTC offer
      socket.emit('matched', {
        roomId,
        peerId: matched.socketId,
        isInitiator: true,
        peerCountry: matched.country,
        peerInterests: matched.interests
      });

      // Tell the other peer to wait for an offer
      matched.socket.emit('matched', {
        roomId,
        peerId: socket.id,
        isInitiator: false,
        peerCountry: country,
        peerInterests: interests
      });

      console.log(`[✓] Matched: ${socket.id} <-> ${matched.socketId} in room ${roomId}`);
    } else {
      // Add to waiting queue
      waitingQueue.push({ socketId: socket.id, socket, interests, country });
      socket.emit('waiting');
      console.log(`[…] ${socket.id} added to queue (queue size: ${waitingQueue.length})`);
    }
  });

  // Relay WebRTC signaling messages between peers
  socket.on('signal', ({ roomId, data }) => {
    socket.to(roomId).emit('signal', { from: socket.id, data });
  });

  // Client wants to skip / end call
  socket.on('skip', ({ roomId }) => {
    if (roomId) {
      socket.to(roomId).emit('peer_left');
      socket.leave(roomId);
    }
    // Remove from queue if still waiting
    waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
  });

  // Relay text chat messages
  socket.on('chat_message', ({ roomId, message }) => {
    socket.to(roomId).emit('chat_message', { message });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    // Remove from waiting queue
    waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
    // Notify any rooms this socket was in
    const rooms = [...socket.rooms];
    rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('peer_left');
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎙  Talky signaling server running on http://localhost:${PORT}\n`);

  // ── KEEP-ALIVE PING ────────────────────────────────────────────────────────
  // Render's free tier spins down after 15 min of inactivity.
  // Pinging ourselves every 14 min keeps the server awake 24/7 at no cost.
  // Set RENDER_EXTERNAL_URL in Render's environment variables to your live URL
  // e.g. https://talky-yhs1.onrender.com
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  if (SELF_URL) {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
      try {
        const res = await fetch(`${SELF_URL}/ping`);
        console.log(`[ping] kept alive — status ${res.status}`);
      } catch (e) {
        console.warn('[ping] self-ping failed:', e.message);
      }
    }, PING_INTERVAL);
    console.log(`[ping] keep-alive enabled → ${SELF_URL}/ping every 14 min`);
  } else {
    console.log('[ping] RENDER_EXTERNAL_URL not set — keep-alive disabled (OK for local dev)');
  }
  // ──────────────────────────────────────────────────────────────────────────
});

// Ping endpoint — just responds 200 OK so the keep-alive fetch succeeds
app.get('/ping', (req, res) => res.status(200).send('ok'));
