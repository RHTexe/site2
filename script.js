const WS_URL = "https://site2-y94d.onrender.com";

const socket = io(WS_URL);

let player, currentRoom='', displayName='', isHost=false;

// YouTube Player
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height:'360', width:'640', videoId:'',
    events:{'onStateChange': onPlayerStateChange}
  });
}

function onPlayerStateChange(event){
  if(!isHost) return;
  const time = player.getCurrentTime();
  if(event.data===YT.PlayerState.PLAYING) socket.emit('play',{roomId:currentRoom,time});
  if(event.data===YT.PlayerState.PAUSED) socket.emit('pause',{roomId:currentRoom,time});
}

// DOM Elements
const roomInput=document.getElementById('roomId');
const nameInput=document.getElementById('displayName');
const btnJoin=document.getElementById('btnJoin');
const status=document.getElementById('status');
const videoInput=document.getElementById('videoId');
const btnLoad=document.getElementById('btnLoad');
const btnPlay=document.getElementById('btnPlay');
const btnPause=document.getElementById('btnPause');
const btnSeekBack=document.getElementById('btnSeekBack');
const btnSeekFwd=document.getElementById('btnSeekFwd');
const hostBadge=document.getElementById('hostBadge');
const userList=document.getElementById('userList');
const chatText=document.getElementById('chatText');
const chatLog=document.getElementById('chatLog');
const btnSend=document.getElementById('btnSend');

// Join Room
btnJoin.onclick=()=>{
  currentRoom=roomInput.value.trim();
  displayName=nameInput.value.trim();
  if(!currentRoom||!displayName){ alert('Oda ID ve isim gerekli'); return; }
  socket.emit('joinRoom',{roomId:currentRoom,name:displayName});
};

socket.on('roomJoined',({you,state})=>{
  isHost=you.isHost;
  hostBadge.classList.toggle('hidden',!isHost);
  updateUsers(state.users);
  status.textContent=`Odaya katıldınız. Host: ${isHost}`;
});

socket.on('userJoined',({id,name,isHost})=>{
  addUser({id,name,isHost});
});

socket.on('userLeft',({id})=>{
  removeUser(id);
});

socket.on('hostChanged',({id})=>{
  if(socket.id===id){ isHost=true; hostBadge.classList.remove('hidden'); }
  updateUserHost(id);
});

// Chat
btnSend.onclick=()=>{ 
  const text=chatText.value.trim(); 
  if(!text) return;
  socket.emit('chatMsg',{roomId:currentRoom,name:displayName,text}); 
  chatText.value=''; 
};

socket.on('chatMsg',({id,name,text,at})=>{
  const div=document.createElement('div');
  div.textContent=`[${new Date(at).toLocaleTimeString()}] ${name}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop=chatLog.scrollHeight;
});

// Video Controls
btnLoad.onclick=()=>{
  if(!videoInput.value.trim()||!isHost) return;
  socket.emit('loadVideo',{roomId:currentRoom,videoId:videoInput.value.trim()});
};

btnPlay.onclick=()=>{ if(isHost) socket.emit('play',{roomId:currentRoom,time:player.getCurrentTime()}); };
btnPause.onclick=()=>{ if(isHost) socket.emit('pause',{roomId:currentRoom,time:player.getCurrentTime()}); };
btnSeekBack.onclick=()=>{ if(isHost) { const t=Math.max(player.getCurrentTime()-5,0); player.seekTo(t,true); socket.emit('seek',{roomId:currentRoom,time:t}); } };
btnSeekFwd.onclick=()=>{ if(isHost) { const t=player.getCurrentTime()+5; player.seekTo(t,true); socket.emit('seek',{roomId:currentRoom,time:t}); } };

// Socket Video Events
socket.on('loadVideo',({videoId,time})=>{ player.loadVideoById(videoId,time); });
socket.on('play',({time})=>{ player.seekTo(time,true); player.playVideo(); });
socket.on('pause',({time})=>{ player.seekTo(time,true); player.pauseVideo(); });
socket.on('seek',({time})=>{ player.seekTo(time,true); });

// Helpers
function updateUsers(users){ userList.innerHTML=''; users.forEach(u=>addUser(u)); }
function addUser(u){ const li=document.createElement('li'); li.textContent=u.name + (u.isHost?' (HOST)':''); li.id='user-'+u.id; userList.appendChild(li);}
function removeUser(id){ const el=document.getElementById('user-'+id); if(el) el.remove();}
function updateUserHost(id){ [...userList.children].forEach(li=>{ if(li.id==='user-'+id) li.textContent=li.textContent.replace('(HOST)','')+' (HOST)'; }); }
