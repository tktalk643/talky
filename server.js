const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

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
});
