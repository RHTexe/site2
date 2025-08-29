require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();

// Frontend static dosyaları
app.use(express.static(path.join(__dirname, 'frontend')));

// CORS (gerekirse)
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : '*',
}));

app.get('/health', (req,res) => res.json({ok:true}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : '*',
    methods: ['GET','POST']
  }
});

// ---- Oda ve kullanıcı yönetimi ----
const rooms = {}; // rooms[roomId] = { users: Map(socketId->{name,isHost}), videoId, isPlaying, playbackTime }

function getRoomState(roomId){
  const r = rooms[roomId];
  if(!r) return null;
  return {
    videoId: r.videoId || null,
    isPlaying: !!r.isPlaying,
    playbackTime: r.playbackTime || 0,
    users: [...r.users.entries()].map(([id,u])=>({id,name:u.name,isHost:u.isHost}))
  };
}

io.on('connection', (socket) => {
  let joinedRoom = null;

  // Odaya katıl
  socket.on('joinRoom', ({ roomId, name }) => {
    if(!roomId || !name){
      socket.emit('errorMsg','Eksik oda veya isim.');
      return;
    }

    if(!rooms[roomId]){
      rooms[roomId] = {
        users: new Map(),
        videoId: null,
        isPlaying: false,
        playbackTime: 0
      };
    }

    const room = rooms[roomId];

    if(room.users.size >=2){
      socket.emit('roomFull');
      return;
    }

    const isHost = room.users.size===0;
    room.users.set(socket.id,{name,isHost});
    joinedRoom = roomId;
    socket.join(roomId);

    // Katılana mevcut durum gönder
    socket.emit('roomJoined', {
      you: { id: socket.id, name, isHost },
      state: getRoomState(roomId)
    });

    // Odaya bildirim
    socket.to(roomId).emit('userJoined',{id:socket.id,name,isHost});
  });

  // Chat
  socket.on('chatMsg', ({ roomId, name, text }) => {
    if(!roomId || !text) return;
    io.to(roomId).emit('chatMsg', {id:socket.id, name, text, at:Date.now()});
  });

  // Video işlemleri (sadece host)
  socket.on('loadVideo', ({ roomId, videoId, time=0 })=>{
    const room = rooms[roomId]; if(!room) return;
    const user = room.users.get(socket.id);
    if(!user || !user.isHost) return;

    room.videoId = videoId;
    room.playbackTime = time;
    room.isPlaying = false;
    io.to(roomId).emit('loadVideo',{videoId,time});
  });

  socket.on('play', ({ roomId, time })=>{
    const room = rooms[roomId]; if(!room) return;
    const user = room.users.get(socket.id);
    if(!user || !user.isHost) return;

    room.isPlaying = true;
    room.playbackTime = time || room.playbackTime;
    io.to(roomId).emit('play',{time: room.playbackTime});
  });

  socket.on('pause', ({ roomId, time })=>{
    const room = rooms[roomId]; if(!room) return;
    const user = room.users.get(socket.id);
    if(!user || !user.isHost) return;

    room.isPlaying = false;
    room.playbackTime = time || room.playbackTime;
    io.to(roomId).emit('pause',{time: room.playbackTime});
  });

  socket.on('seek', ({ roomId, time })=>{
    const room = rooms[roomId]; if(!room) return;
    const user = room.users.get(socket.id);
    if(!user || !user.isHost) return;

    if(typeof time==='number'){
      room.playbackTime = time;
      io.to(roomId).emit('seek',{time});
    }
  });

  // Disconnect
  socket.on('disconnect', ()=>{
    if(!joinedRoom) return;
    const room = rooms[joinedRoom]; if(!room) return;

    const leaving = room.users.get(socket.id);
    room.users.delete(socket.id);
    io.to(joinedRoom).emit('userLeft',{id:socket.id});

    // Host değiştir
    if(leaving && leaving.isHost){
      const next = [...room.users.entries()][0];
      if(next){
        const [nextId,nextUser] = next;
        nextUser.isHost = true;
        io.to(joinedRoom).emit('hostChanged',{id:nextId});
      }
    }

    // Oda boşsa sil
    if(room.users.size===0) delete rooms[joinedRoom];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>console.log('Server running on port '+PORT));
