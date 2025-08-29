const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default';
const displayName = urlParams.get('name') || 'Anon';

document.getElementById('roomDisplay').textContent = `Oda: ${roomId}`;

const socket = io(window.location.origin);

let player;
let isHost = false;

// Katıl
socket.emit('joinRoom', { roomId, name: displayName });

socket.on('roomJoined', ({ you, state }) => {
  isHost = you.isHost;
  updateHostUI();
  updateUserList(state.users);
  if(state.videoId) loadVideoById(state.videoId, state.playbackTime);
});

socket.on('userJoined', ({ id, name, isHost: h }) => updateUserListDisplay());
socket.on('userLeft', ({ id }) => updateUserListDisplay());
socket.on('hostChanged', ({ id }) => {
  isHost = id === socket.id;
  updateHostUI();
});

function updateHostUI(){
  const badge = document.getElementById('hostBadge');
  const buttons = document.querySelectorAll('#btnLoad, #btnPlay, #btnPause, #btnSeekBack, #btnSeekFwd');
  if(isHost){
    badge.classList.remove('hidden');
    buttons.forEach(b=>b.disabled=false);
  } else {
    badge.classList.add('hidden');
    buttons.forEach(b=>b.disabled=true);
  }
}

function updateUserList(users){
  const ul = document.getElementById('userList');
  ul.innerHTML = '';
  users.forEach(u=>{
    const li = document.createElement('li');
    li.textContent = u.name + (u.isHost ? ' (Host)' : '');
    ul.appendChild(li);
  });
}

// Video URL → ID çıkar
function getYouTubeId(url){
  const reg = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([\w-]+)/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

document.getElementById('btnLoad').onclick = ()=>{
  if(!isHost) return alert("Sadece host yükleyebilir");
  const url = document.getElementById('videoUrl').value;
  const vid = getYouTubeId(url);
  if(!vid) return alert("Geçersiz YouTube URL");
  socket.emit('loadVideo', { roomId, videoId: vid, time:0 });
};

// Socket events: load/play/pause/seek
socket.on('loadVideo', ({ videoId, time })=>loadVideoById(videoId, time));
socket.on('play', ({ time })=>player.seekTo(time,true) && player.playVideo());
socket.on('pause', ({ time })=>player.seekTo(time,true) && player.pauseVideo());
socket.on('seek', ({ time })=>player.seekTo(time,true));

// Play/pause/seek buttons
document.getElementById('btnPlay').onclick = ()=>isHost && socket.emit('play',{ roomId, time: player.getCurrentTime() });
document.getElementById('btnPause').onclick = ()=>isHost && socket.emit('pause',{ roomId, time: player.getCurrentTime() });
document.getElementById('btnSeekBack').onclick = ()=>{ const t = player.getCurrentTime()-5; if(isHost) socket.emit('seek',{roomId,time:t}); };
document.getElementById('btnSeekFwd').onclick = ()=>{ const t = player.getCurrentTime()+5; if(isHost) socket.emit('seek',{roomId,time:t}); };

// YouTube player
function onYouTubeIframeAPIReady(){
  player = new YT.Player('player',{height:'360',width:'640',videoId:''});
}

function loadVideoById(id, time=0){
  if(!player) return;
  player.loadVideoById(id, time);
}
