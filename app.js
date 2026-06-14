// ====== Sachistha App Logic ======

const ANNIVERSARY = new Date(2019, 4, 14); // 14 May 2019 (month is 0-indexed)

const QUOTES = [
  '"Every love story is beautiful, but ours is my favorite."',
  '"Home is wherever you are."',
  '"You are my today and all of my tomorrows."',
  '"Together is a beautiful place to be."',
  '"In your arms is where I belong."',
  '"You + Me = Forever."',
  '"Two hearts, one home."',
  '"Still falling for you, every single day."'
];

// ---------- Storage helpers (with localStorage fallback) ----------
const STORAGE_KEYS = {
  chat: 'sachistha:chat',
  notes: 'sachistha:notes'
};

function loadLocal(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function saveLocal(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
}

let chatMessages = loadLocal(STORAGE_KEYS.chat, []);
let loveNotes = loadLocal(STORAGE_KEYS.notes, []);

// ---------- View switching ----------
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('nav button').forEach(b=>{
    b.classList.toggle('active', b.dataset.view === name);
  });
  if(name === 'chat'){
    scrollChatToBottom();
  }
}

// ---------- Home: hero image + quote ----------
function initHome(){
  const heroIdx = Math.floor(Math.random() * PHOTOS.length);
  document.getElementById('hero-img').src = PHOTOS[heroIdx];
  document.getElementById('home-quote').textContent = QUOTES[Math.floor(Math.random()*QUOTES.length)];

  const years = Math.floor((Date.now() - ANNIVERSARY.getTime()) / (1000*60*60*24*365.25));
  document.getElementById('years-together').textContent =
    `Together since 14 May 2019 — celebrating ${years}+ wonderful years 💕`;
}

// ---------- Countdown ----------
function updateCountdown(){
  const now = new Date();
  let next = new Date(now.getFullYear(), 4, 14);
  if(now > next){
    next = new Date(now.getFullYear()+1, 4, 14);
  }
  const diff = next - now;
  const days = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff / (1000*60*60)) % 24);
  const mins = Math.floor((diff / (1000*60)) % 60);
  const secs = Math.floor((diff/1000) % 60);

  document.getElementById('cd-days').textContent = days;
  document.getElementById('cd-hours').textContent = String(hours).padStart(2,'0');
  document.getElementById('cd-mins').textContent = String(mins).padStart(2,'0');
  document.getElementById('cd-secs').textContent = String(secs).padStart(2,'0');
}
setInterval(updateCountdown, 1000);

// ---------- Chat ----------
let currentSender = 'sachin';

document.getElementById('chat-sender-toggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  currentSender = btn.dataset.sender;
  document.querySelectorAll('#chat-sender-toggle button').forEach(b=>b.classList.toggle('active', b===btn));
});

let noteSender = 'sachin';
document.getElementById('note-sender-toggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  noteSender = btn.dataset.sender;
  document.querySelectorAll('#note-sender-toggle button').forEach(b=>b.classList.toggle('active', b===btn));
});

function renderChat(){
  const container = document.getElementById('chat-messages');
  const empty = document.getElementById('chat-empty');
  if(chatMessages.length === 0){
    container.innerHTML = '';
    container.appendChild(empty);
    return;
  }
  container.innerHTML = '';
  chatMessages.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'msg ' + m.sender;
    const time = new Date(m.ts);
    const timeStr = time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.innerHTML = escapeHtml(m.text) + `<span class="meta">${timeStr}</span>`;
    container.appendChild(div);
  });
  scrollChatToBottom();
}

function scrollChatToBottom(){
  const container = document.getElementById('chat-messages');
  requestAnimationFrame(()=>{ container.scrollTop = container.scrollHeight; });
}

function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  chatMessages.push({ sender: currentSender, text, ts: Date.now() });
  saveLocal(STORAGE_KEYS.chat, chatMessages);
  input.value = '';
  renderChat();
}

document.getElementById('chat-input').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') sendMessage();
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Gallery ----------
function initGallery(){
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  PHOTOS.forEach((src, i)=>{
    const item = document.createElement('div');
    item.className = 'item';
    if(i === 0 || i === 4) item.classList.add('wide');
    const img = document.createElement('img');
    img.src = src;
    img.loading = 'lazy';
    img.onclick = ()=> openLightbox(i);
    item.appendChild(img);
    grid.appendChild(item);
  });
}

let lightboxIndex = 0;
function openLightbox(i){
  lightboxIndex = i;
  document.getElementById('lightbox-img').src = PHOTOS[i];
  document.getElementById('lightbox').classList.add('active');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('active');
}
function navLightbox(dir){
  lightboxIndex = (lightboxIndex + dir + PHOTOS.length) % PHOTOS.length;
  document.getElementById('lightbox-img').src = PHOTOS[lightboxIndex];
}
document.getElementById('lightbox').addEventListener('click', (e)=>{
  if(e.target.id === 'lightbox') closeLightbox();
});

function addPhotoFromHome(){
  switchView('gallery');
}

// ---------- Love Notes ----------
function renderNotes(){
  const list = document.getElementById('notes-list');
  if(loveNotes.length === 0){
    list.innerHTML = `<div class="notes-empty"><span class="big-icon">💌</span>No love notes yet — write the first one!</div>`;
    return;
  }
  list.innerHTML = '';
  // newest first
  [...loveNotes].reverse().forEach(n=>{
    const card = document.createElement('div');
    card.className = 'note-card ' + (n.sender === 'aastha' ? 'from-aastha' : 'from-sachin');
    const date = new Date(n.ts);
    const dateStr = date.toLocaleDateString([], {day:'numeric', month:'short', year:'numeric'}) +
      ' · ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const fromLabel = n.sender === 'aastha' ? '💗 From Aastha' : '💙 From Sachin';
    card.innerHTML = `
      <div class="note-from">${fromLabel}</div>
      <div class="note-text">${escapeHtml(n.text)}</div>
      <div class="note-date">${dateStr}</div>
    `;
    list.appendChild(card);
  });
}

function saveNote(){
  const input = document.getElementById('note-input');
  const text = input.value.trim();
  if(!text) return;
  loveNotes.push({ sender: noteSender, text, ts: Date.now() });
  saveLocal(STORAGE_KEYS.notes, loveNotes);
  input.value = '';
  renderNotes();
}

// ---------- Init ----------
initHome();
updateCountdown();
renderChat();
initGallery();
renderNotes();

// ---------- Service worker registration (for PWA install) ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
