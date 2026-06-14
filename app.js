// ====== Sachistha App Logic ======

const ANNIVERSARY = new Date(2019, 4, 14); // 14 May 2019

// ---------- Storage helpers ----------
const STORAGE_KEYS = {
  chat: 'sachistha:chat',
  notes: 'sachistha:notes',
  mood: 'sachistha:mood',
  qotdIndex: 'sachistha:qotdIndex',
  cqIndex: 'sachistha:cqIndex',
  cqOrder: 'sachistha:cqOrder',
  wyrIndex: 'sachistha:wyrIndex',
  wyrOrder: 'sachistha:wyrOrder',
  score: 'sachistha:score',
  ttt: 'sachistha:ttt'
};

function loadLocal(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
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
  if(name === 'chat') scrollChatToBottom();
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ================= HOME =================
function initHome(){
  const heroIdx = Math.floor(Math.random() * PHOTOS.length);
  document.getElementById('hero-img').src = PHOTOS[heroIdx];

  const years = Math.floor((Date.now() - ANNIVERSARY.getTime()) / (1000*60*60*24*365.25));
  document.getElementById('years-together').textContent =
    `Together since 14 May 2019 — celebrating ${years}+ wonderful years 💕`;

  loadQuestionOfDay();
  initMood();
}

// ---- Question of the day (rotates based on date, shuffleable) ----
function getDayIndex(){
  const start = new Date(2024,0,1);
  const diffDays = Math.floor((new Date() - start) / (1000*60*60*24));
  return diffDays % QOTD.length;
}
function loadQuestionOfDay(){
  let idx = loadLocal(STORAGE_KEYS.qotdIndex, null);
  const todayIdx = getDayIndex();
  // if no manual override stored for today, use today's rotation
  if(idx === null || idx.day !== todayIdx){
    idx = { day: todayIdx, qIndex: todayIdx };
    saveLocal(STORAGE_KEYS.qotdIndex, idx);
  }
  document.getElementById('qotd-text').textContent = QOTD[idx.qIndex % QOTD.length];
}
function newQuestionOfDay(){
  let idx = loadLocal(STORAGE_KEYS.qotdIndex, {day:getDayIndex(), qIndex:getDayIndex()});
  idx.qIndex = (idx.qIndex + 1) % QOTD.length;
  saveLocal(STORAGE_KEYS.qotdIndex, idx);
  document.getElementById('qotd-text').textContent = QOTD[idx.qIndex];
}

// ---- Mood check-in ----
function initMood(){
  const todayKey = new Date().toISOString().slice(0,10);
  const moods = loadLocal(STORAGE_KEYS.mood, {});
  const todayMood = moods[todayKey];

  document.querySelectorAll('.mood-btn').forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.mood === todayMood);
    btn.onclick = ()=>{
      const moods = loadLocal(STORAGE_KEYS.mood, {});
      moods[todayKey] = btn.dataset.mood;
      saveLocal(STORAGE_KEYS.mood, moods);
      document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected', b===btn));
      updateMoodToday();
    };
  });
  updateMoodToday();
}
function updateMoodToday(){
  const todayKey = new Date().toISOString().slice(0,10);
  const moods = loadLocal(STORAGE_KEYS.mood, {});
  const el = document.getElementById('mood-today');
  if(moods[todayKey]){
    el.textContent = `You're feeling ${moods[todayKey]} today`;
  } else {
    el.textContent = 'Tap an emoji to log your mood';
  }
}

// ---------- Countdown ----------
function updateCountdown(){
  const now = new Date();
  let next = new Date(now.getFullYear(), 4, 14);
  if(now > next) next = new Date(now.getFullYear()+1, 4, 14);
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

// ================= CHAT =================
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

// ================= GALLERY =================
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
function closeLightbox(){ document.getElementById('lightbox').classList.remove('active'); }
function navLightbox(dir){
  lightboxIndex = (lightboxIndex + dir + PHOTOS.length) % PHOTOS.length;
  document.getElementById('lightbox-img').src = PHOTOS[lightboxIndex];
}
document.getElementById('lightbox').addEventListener('click', (e)=>{
  if(e.target.id === 'lightbox') closeLightbox();
});

// ================= LOVE NOTES =================
function renderNotes(){
  const list = document.getElementById('notes-list');
  if(loveNotes.length === 0){
    list.innerHTML = `<div class="notes-empty"><span class="big-icon">💌</span>No love notes yet — write the first one!</div>`;
    return;
  }
  list.innerHTML = '';
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

// ================= GAMES =================
function openGame(name){
  document.getElementById('game-'+name).classList.add('active');
  if(name === 'couple-questions') cqInit();
  if(name === 'wyr') wyrInit();
  if(name === 'ttt') tttInit();
  if(name === 'truth-dare') tdInit();
  if(name === 'score') scoreInit();
}
function closeGame(){
  document.querySelectorAll('.game-overlay').forEach(g=>g.classList.remove('active'));
}

// ---- Couple Questions ----
let cqOrder = [];
let cqPos = 0;
function shuffleArray(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function cqInit(){
  cqOrder = shuffleArray(COUPLE_QUESTIONS.map((_,i)=>i));
  cqPos = 0;
  cqRender();
}
function cqRender(){
  const item = COUPLE_QUESTIONS[cqOrder[cqPos]];
  document.getElementById('cq-cat').textContent = item.cat;
  document.getElementById('cq-question').textContent = item.q;
  document.getElementById('cq-progress').textContent = `Card ${cqPos+1} of ${cqOrder.length}`;
}
function cqNext(){
  cqPos = (cqPos+1) % cqOrder.length;
  cqRender();
}
function cqShuffle(){
  cqOrder = shuffleArray(COUPLE_QUESTIONS.map((_,i)=>i));
  cqPos = 0;
  cqRender();
}

// ---- Would You Rather ----
let wyrOrder = [];
let wyrPos = 0;
function wyrInit(){
  wyrOrder = shuffleArray(WYR.map((_,i)=>i));
  wyrPos = 0;
  wyrRender();
}
function wyrRender(){
  const item = WYR[wyrOrder[wyrPos]];
  document.getElementById('wyr-a-text').textContent = item.a;
  document.getElementById('wyr-b-text').textContent = item.b;
  document.getElementById('wyr-a').classList.remove('picked');
  document.getElementById('wyr-b').classList.remove('picked');
  document.getElementById('wyr-progress').textContent = `Question ${wyrPos+1} of ${wyrOrder.length}`;
}
function wyrPick(which){
  document.getElementById('wyr-a').classList.toggle('picked', which==='a');
  document.getElementById('wyr-b').classList.toggle('picked', which==='b');
}
function wyrNext(){
  wyrPos = (wyrPos+1) % wyrOrder.length;
  wyrRender();
}

// ---- Tic Tac Toe ----
let tttBoard = Array(9).fill('');
let tttCurrent = 'X'; // X = Aastha, O = Sachin
let tttWinner = null;
function tttInit(){
  tttBoard = Array(9).fill('');
  tttCurrent = 'X';
  tttWinner = null;
  const board = document.getElementById('ttt-board');
  board.innerHTML = '';
  for(let i=0;i<9;i++){
    const cell = document.createElement('div');
    cell.className = 'ttt-cell';
    cell.dataset.i = i;
    cell.onclick = ()=> tttMove(i);
    board.appendChild(cell);
  }
  tttUpdateStatus();
}
function tttMove(i){
  if(tttBoard[i] || tttWinner) return;
  tttBoard[i] = tttCurrent;
  const cell = document.querySelector(`#ttt-board .ttt-cell[data-i="${i}"]`);
  cell.textContent = tttCurrent;
  cell.classList.add(tttCurrent.toLowerCase());

  const win = tttCheckWin();
  if(win){
    tttWinner = tttCurrent;
    tttUpdateStatus(true);
    return;
  }
  if(tttBoard.every(c=>c)){
    tttWinner = 'draw';
    tttUpdateStatus(true);
    return;
  }
  tttCurrent = tttCurrent === 'X' ? 'O' : 'X';
  tttUpdateStatus();
}
function tttCheckWin(){
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.some(line=> line.every(i=> tttBoard[i] && tttBoard[i]===tttBoard[line[0]]));
}
function tttUpdateStatus(ended){
  const status = document.getElementById('ttt-status');
  const tagX = document.getElementById('ttt-tag-x');
  const tagO = document.getElementById('ttt-tag-o');
  if(ended){
    if(tttWinner === 'draw'){
      status.textContent = "It's a draw! 🤝";
    } else {
      const name = tttWinner === 'X' ? 'Aastha' : 'Sachin';
      status.textContent = `${name} wins! 🎉`;
    }
    tagX.classList.remove('active');
    tagO.classList.remove('active');
    return;
  }
  const name = tttCurrent === 'X' ? 'Aastha' : 'Sachin';
  status.textContent = `${name}'s turn`;
  tagX.classList.toggle('active', tttCurrent==='X');
  tagO.classList.toggle('active', tttCurrent==='O');
}
function tttReset(){ tttInit(); }

// ---- Truth or Dare ----
function tdInit(){
  tdPick('truth');
}
function tdPick(type){
  const list = type === 'truth' ? TRUTH : DARE;
  const item = list[Math.floor(Math.random()*list.length)];
  document.getElementById('td-cat').textContent = type === 'truth' ? 'Truth' : 'Dare';
  document.getElementById('td-question').textContent = item;
}

// ---- Score Keeper ----
function scoreInit(){
  const score = loadLocal(STORAGE_KEYS.score, {sachin:0, aastha:0});
  document.getElementById('score-sachin').textContent = score.sachin;
  document.getElementById('score-aastha').textContent = score.aastha;
}
function scoreChange(who, delta){
  const score = loadLocal(STORAGE_KEYS.score, {sachin:0, aastha:0});
  score[who] = Math.max(0, score[who] + delta);
  saveLocal(STORAGE_KEYS.score, score);
  document.getElementById('score-'+who).textContent = score[who];
}
function scoreReset(){
  saveLocal(STORAGE_KEYS.score, {sachin:0, aastha:0});
  scoreInit();
}

// ---------- Init ----------
initHome();
updateCountdown();
renderChat();
initGallery();
renderNotes();

// ---------- Service worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
