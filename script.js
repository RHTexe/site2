const socket = io(window.BACKEND_URL);

const roomIdInput = document.getElementById('roomId');
const nameInput = document.getElementById('displayName');
const btnJoin = document.getElementById('btnJoin');
const videoIdInput = document.getElementById('videoId');
const btnLoad = document.getElementById('btnLoad');
const btnPlay = document.getElementById('btnPlay');
const btnPause = document.getElementById('btnPause');

let player;
let isHost = false;

btnJoin.onclick = () => {
  const roomId = roomIdInput.value;
  const name = nameInput.value;
  if(!roomId || !name) return alert("Oda ID ve isim gerekli");
  socket.emit('joinRoom', { roomId, name });
};

socket.on('roomJoined', ({ you, state }) => {
  isHost = you.isHost;
  alert(`Odaya katıldınız. Host musunuz? ${isHost}`);
});

btnLoad.onclick = () => {
  if(!isHost) return alert("Sadece host yükleyebilir");
  const videoId = videoIdInput.value;
  socket.emit('loadVideo', { roomId: roomIdInput.value, videoId, time:0 });
};

btnPlay.onclick = () => socket.emit('play', { roomId: roomIdInput.value, time:0 });
btnPause.onclick = () => socket.emit('pause', { roomId: roomIdInput.value, time:0 });

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', { height:'360', width:'640', videoId:'' });
}
