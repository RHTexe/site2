require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// Statik frontend dosyaları
app.use(express.static(path.join(__dirname, 'frontend')));

// API ve health check
app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

function getRoomState(roomId) {
  const r = rooms[roomId];
  if (!r) return null;
  return {
    videoId: r.videoId || null,
    isPlaying: !!r.isPlaying,
    playbackTime: r.playbackTime || 0,
    users: [...r.users.entries()].map(([id, u]) => ({ id, name: u.name, isHost: !!u.isHost })),
  };
}

// Socket.IO
io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('joinRoom', ({ roomId, name }) => {
    if (!roomId || !name) return socket.emit('errorMsg', 'Eksik oda veya isim.');
    if (!rooms[roomId]) rooms[roomId] = { users: new Map(), videoId: null, isPlaying: false, playbackTime: 0 };
    const room = rooms[roomId];
    if (room.users.size >= 2) return socket.emit('roomFull');

    const isHost = room.users.size === 0;
    room.users.set(socket.id, { name, isHost });
    joinedRoom = roomId;
    socket.join(roomId);

    socket.emit('roomJoined', { you: { id: socket.id, name, isHost }, state: getRoomState(roomId) });
    socket.to(roomId).emit('userJoined', { id: socket.id, name, isHost });
  });

  socket.on('chatMsg', ({ roomId, name, text }) => {
    if (!roomId || !text) return;
    io.to(roomId).emit('chatMsg', { id: socket.id, name, text, at: Date.now() });
  });

  socket.on('loadVideo', ({ roomId, videoId, time = 0 }) => {
    const room = rooms[roomId]; if (!room) return;
    const user = room.users.get(socket.id); if (!user || !user.isHost) return;
    room.videoId = videoId; room.playbackTime = time; room.isPlaying = false;
    io.to(roomId).emit('loadVideo', { videoId, time });
  });

  socket.on('play', ({ roomId, time }) => {
    const room = rooms[roomId]; if (!room) return;
    const user = room.users.get(socket.id); if (!user || !user.isHost) return;
    room.isPlaying = true; room.playbackTime = time || room.playbackTime;
    socket.to(roomId).emit('play', { time: room.playbackTime });
  });

  socket.on('pause', ({ roomId, time }) => {
    const room = rooms[roomId]; if (!room) return;
    const user = room.users.get(socket.id); if (!user || !user.isHost) return;
    room.isPlaying = false; room.playbackTime = time || room.playbackTime;
    socket.to(roomId).emit('pause', { time: room.playbackTime });
  });

  socket.on('seek', ({ roomId, time }) => {
    const room = rooms[roomId]; if (!room) return;
    const user = room.users.get(socket.id); if (!user || !user.isHost) return;
    room.playbackTime = time;
    io.to(roomId).emit('seek', { time });
  });

  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const room = rooms[joinedRoom]; if (!room) return;
    const leaving = room.users.get(socket.id);
    room.users.delete(socket.id);
    io.to(joinedRoom).emit('userLeft', { id: socket.id });

    if (leaving && leaving.isHost) {
      const next = [...room.users.entries()][0];
      if (next) { const [nextId, nextUser] = next; nextUser.isHost = true; io.to(joinedRoom).emit('hostChanged', { id: nextId }); }
    }
    if (room.users.size === 0) delete rooms[joinedRoom];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
