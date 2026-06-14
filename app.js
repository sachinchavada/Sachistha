// ====== Sachistha App Logic (Synced via Supabase) ======

const ANNIVERSARY = new Date(2019, 4, 14); // 14 May 2019

// ---------- Supabase client ----------
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Local-only storage (per-device prefs like login, mood, qotd) ----------
const LKEYS = {
  user: 'sachistha:user',
  qotdIndex: 'sachistha:qotdIndex'
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

let currentUser = loadLocal(LKEYS.user, null); // 'sachin' | 'aastha'

// ---------- Login ----------
function loginAs(name){
  currentUser = name;
  saveLocal(LKEYS.user, name);
  document.getElementById('login-screen').classList.add('hidden');
  const label = name === 'sachin' ? '🤵 Sachin · tap to switch' : '👰 Aastha · tap to switch';
  document.getElementById('logged-in-as').textContent = label;
  document.getElementById('note-sender-label').textContent =
    'Posting as ' + (name === 'sachin' ? '💙 Sachin' : '💗 Aastha');
  startApp();
}
function logout(){
  if(!confirm('Switch user on this device?')) return;
  currentUser = null;
  saveLocal(LKEYS.user, null);
  document.getElementById('login-screen').classList.remove('hidden');
}

// ---------- Connection status ----------
function setConnStatus(connected){
  const el = document.getElementById('conn-status');
  const text = document.getElementById('conn-text');
  el.classList.toggle('offline', !connected);
  text.textContent = connected ? 'Live' : 'Connecting...';
}

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

// ---- Question of the day ----
function getDayIndex(){
  const start = new Date(2024,0,1);
  const diffDays = Math.floor((new Date() - start) / (1000*60*60*24));
  return diffDays % QOTD.length;
}
function loadQuestionOfDay(){
  let idx = loadLocal(LKEYS.qotdIndex, null);
  const todayIdx = getDayIndex();
  if(idx === null || idx.day !== todayIdx){
    idx = { day: todayIdx, qIndex: todayIdx };
    saveLocal(LKEYS.qotdIndex, idx);
  }
  document.getElementById('qotd-text').textContent = QOTD[idx.qIndex % QOTD.length];
}
function newQuestionOfDay(){
  let idx = loadLocal(LKEYS.qotdIndex, {day:getDayIndex(), qIndex:getDayIndex()});
  idx.qIndex = (idx.qIndex + 1) % QOTD.length;
  saveLocal(LKEYS.qotdIndex, idx);
  document.getElementById('qotd-text').textContent = QOTD[idx.qIndex];
}

// ---- Mood check-in (synced via game_state table, key = mood:YYYY-MM-DD:user) ----
function initMood(){
  document.querySelectorAll('.mood-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected', b===btn));
      const todayKey = new Date().toISOString().slice(0,10);
      await upsertGameState(`mood:${todayKey}:${currentUser}`, btn.dataset.mood);
      updateMoodToday();
    };
  });
  updateMoodToday();
}
async function updateMoodToday(){
  const todayKey = new Date().toISOString().slice(0,10);
  const mine = await getGameState(`mood:${todayKey}:${currentUser}`);
  const otherUser = currentUser === 'sachin' ? 'aastha' : 'sachin';
  const theirs = await getGameState(`mood:${todayKey}:${otherUser}`);
  const el = document.getElementById('mood-today');
  let parts = [];
  if(mine) {
    parts.push(`You: ${mine}`);
    document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected', b.dataset.mood===mine));
  }
  if(theirs) {
    const otherName = otherUser === 'sachin' ? 'Sachin' : 'Aastha';
    parts.push(`${otherName}: ${theirs}`);
  }
  el.textContent = parts.length ? parts.join('   ·   ') : 'Tap an emoji to log your mood';
}

// ================= GAME STATE (shared key-value via Supabase) =================
async function getGameState(key){
  const { data, error } = await supa.from('game_state').select('value').eq('key', key).maybeSingle();
  if(error || !data) return null;
  return data.value;
}
async function upsertGameState(key, value){
  await supa.from('game_state').upsert({ key, value, updated_at: new Date().toISOString() });
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

// ================= CHAT (synced via Supabase 'messages' table) =================
let chatMessages = [];

async function loadChatMessages(){
  const { data, error } = await supa.from('messages').select('*').order('created_at', { ascending: true }).limit(200);
  if(!error && data){
    chatMessages = data;
    renderChat();
  }
}

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
    const time = new Date(m.created_at);
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
async function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  const { error } = await supa.from('messages').insert({ sender: currentUser, text });
  if(error){
    alert('Could not send message. Check your connection.');
  }
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

// ================= LOVE NOTES (synced via Supabase 'love_notes' table) =================
let loveNotes = [];

async function loadLoveNotes(){
  const { data, error } = await supa.from('love_notes').select('*').order('created_at', { ascending: false }).limit(100);
  if(!error && data){
    loveNotes = data;
    renderNotes();
  }
}

function renderNotes(){
  const list = document.getElementById('notes-list');
  if(loveNotes.length === 0){
    list.innerHTML = `<div class="notes-empty"><span class="big-icon">💌</span>No love notes yet — write the first one!</div>`;
    return;
  }
  list.innerHTML = '';
  loveNotes.forEach(n=>{
    const card = document.createElement('div');
    card.className = 'note-card ' + (n.sender === 'aastha' ? 'from-aastha' : 'from-sachin');
    const date = new Date(n.created_at);
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
async function saveNote(){
  const input = document.getElementById('note-input');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  const { error } = await supa.from('love_notes').insert({ sender: currentUser, text });
  if(error){
    alert('Could not save note. Check your connection.');
  }
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
  if(tttChannel){ tttChannel.unsubscribe(); tttChannel = null; }
}

function shuffleArray(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

// ---- Couple Questions (synced order/position so both see the same card) ----
let cqOrder = [];
let cqPos = 0;
async function cqInit(){
  const state = await getGameState('couple_questions');
  if(state && state.order){
    cqOrder = state.order;
    cqPos = state.pos || 0;
  } else {
    cqOrder = shuffleArray(COUPLE_QUESTIONS.map((_,i)=>i));
    cqPos = 0;
    await upsertGameState('couple_questions', { order: cqOrder, pos: cqPos });
  }
  cqRender();
}
function cqRender(){
  const item = COUPLE_QUESTIONS[cqOrder[cqPos]];
  document.getElementById('cq-cat').textContent = item.cat;
  document.getElementById('cq-question').textContent = item.q;
  document.getElementById('cq-progress').textContent = `Card ${cqPos+1} of ${cqOrder.length}`;
}
async function cqNext(){
  cqPos = (cqPos+1) % cqOrder.length;
  await upsertGameState('couple_questions', { order: cqOrder, pos: cqPos });
  cqRender();
}
async function cqShuffle(){
  cqOrder = shuffleArray(COUPLE_QUESTIONS.map((_,i)=>i));
  cqPos = 0;
  await upsertGameState('couple_questions', { order: cqOrder, pos: cqPos });
  cqRender();
}

// ---- Would You Rather (synced) ----
let wyrOrder = [];
let wyrPos = 0;
async function wyrInit(){
  const state = await getGameState('wyr');
  if(state && state.order){
    wyrOrder = state.order;
    wyrPos = state.pos || 0;
  } else {
    wyrOrder = shuffleArray(WYR.map((_,i)=>i));
    wyrPos = 0;
    await upsertGameState('wyr', { order: wyrOrder, pos: wyrPos });
  }
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
async function wyrNext(){
  wyrPos = (wyrPos+1) % wyrOrder.length;
  await upsertGameState('wyr', { order: wyrOrder, pos: wyrPos });
  wyrRender();
}

// ---- Tic Tac Toe (live synced via realtime) ----
let tttBoard = Array(9).fill('');
let tttCurrent = 'X'; // X = Aastha, O = Sachin
let tttWinner = null;
let tttChannel = null;

async function tttInit(){
  const board = document.getElementById('ttt-board');
  board.innerHTML = '';
  for(let i=0;i<9;i++){
    const cell = document.createElement('div');
    cell.className = 'ttt-cell';
    cell.dataset.i = i;
    cell.onclick = ()=> tttMove(i);
    board.appendChild(cell);
  }

  const state = await getGameState('ttt');
  if(state && state.board){
    tttBoard = state.board;
    tttCurrent = state.current;
    tttWinner = state.winner;
    tttRenderBoard();
  } else {
    await tttResetState();
  }

  // subscribe to realtime updates
  tttChannel = supa.channel('ttt-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: 'key=eq.ttt' }, (payload)=>{
      const v = payload.new && payload.new.value;
      if(v){
        tttBoard = v.board;
        tttCurrent = v.current;
        tttWinner = v.winner;
        tttRenderBoard();
        tttUpdateStatus(!!tttWinner);
      }
    })
    .subscribe();
}
function tttRenderBoard(){
  for(let i=0;i<9;i++){
    const cell = document.querySelector(`#ttt-board .ttt-cell[data-i="${i}"]`);
    cell.textContent = tttBoard[i] || '';
    cell.classList.remove('x','o');
    if(tttBoard[i]) cell.classList.add(tttBoard[i].toLowerCase());
  }
  tttUpdateStatus(!!tttWinner);
}
async function tttMove(i){
  if(tttBoard[i] || tttWinner) return;
  // Enforce turn order: X = Aastha, O = Sachin
  const myMark = currentUser === 'aastha' ? 'X' : 'O';
  if(tttCurrent !== myMark){
    return; // not your turn
  }
  tttBoard[i] = tttCurrent;
  const win = tttCheckWin();
  if(win){
    tttWinner = tttCurrent;
  } else if(tttBoard.every(c=>c)){
    tttWinner = 'draw';
  } else {
    tttCurrent = tttCurrent === 'X' ? 'O' : 'X';
  }
  tttRenderBoard();
  await upsertGameState('ttt', { board: tttBoard, current: tttCurrent, winner: tttWinner });
}
function tttCheckWin(){
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.some(line=> line.every(idx=> tttBoard[idx] && tttBoard[idx]===tttBoard[line[0]]));
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
async function tttResetState(){
  tttBoard = Array(9).fill('');
  tttCurrent = 'X';
  tttWinner = null;
  tttRenderBoard();
  await upsertGameState('ttt', { board: tttBoard, current: tttCurrent, winner: tttWinner });
}
async function tttReset(){ await tttResetState(); }

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

// ---- Score Keeper (synced) ----
async function scoreInit(){
  const score = (await getGameState('score')) || {sachin:0, aastha:0};
  document.getElementById('score-sachin').textContent = score.sachin;
  document.getElementById('score-aastha').textContent = score.aastha;
}
async function scoreChange(who, delta){
  const score = (await getGameState('score')) || {sachin:0, aastha:0};
  score[who] = Math.max(0, score[who] + delta);
  await upsertGameState('score', score);
  document.getElementById('score-'+who).textContent = score[who];
}
async function scoreReset(){
  await upsertGameState('score', {sachin:0, aastha:0});
  scoreInit();
}

// ================= APP START =================
function startApp(){
  initHome();
  updateCountdown();
  initGallery();

  loadChatMessages();
  loadLoveNotes();

  // Realtime subscriptions
  supa.channel('messages-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload)=>{
      chatMessages.push(payload.new);
      renderChat();
    })
    .subscribe();

  supa.channel('notes-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'love_notes' }, (payload)=>{
      loveNotes.unshift(payload.new);
      renderNotes();
    })
    .subscribe();

  // connection status
  supa.channel('status-check')
    .subscribe((status)=>{
      setConnStatus(status === 'SUBSCRIBED');
    });
}

// ---------- Init on load ----------
if(currentUser){
  document.getElementById('login-screen').classList.add('hidden');
  const label = currentUser === 'sachin' ? '🤵 Sachin · tap to switch' : '👰 Aastha · tap to switch';
  document.getElementById('logged-in-as').textContent = label;
  document.getElementById('note-sender-label').textContent =
    'Posting as ' + (currentUser === 'sachin' ? '💙 Sachin' : '💗 Aastha');
  startApp();
}

// ---------- Service worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
