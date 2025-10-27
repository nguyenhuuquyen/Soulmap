// app.js
/* ========== CONFIG ========== */
const DIFY_API_URL = "/api/workflow";  // gọi qua proxy nội bộ, không lộ key

/* ========== DOM refs ========== */
const el = (id) => document.getElementById(id);

const form       = el('form');
const inputName  = el('full-name');
const selYear    = el('year');
const selMonth   = el('month');
const selDay     = el('day');
const btnCalc    = el('calculate');
const inputLang  = el('lang');

const langEN     = el('lang-en');
const langVI     = el('lang-vi');

const introSec   = el('intro');
const loadingSec = el('loading');
const resultSec  = el('result');

const imgHero    = el('result-image');

const chipLife   = el('chip-life');
const chipExp    = el('chip-exp');
const chipSoul   = el('chip-soul');
const chipPers   = el('chip-pers');
const chipPYear  = el('chip-pyear');

const txtCore    = el('text-core');
const listStr    = el('list-strengths');
const listChal   = el('list-challenges');
const txtMission = el('text-mission');
const txtCaption = el('text-caption');
const txtShareText = el('text-share-text');
const txtPYearAdvice = el('text-personal-year-advice');
const secShare = el('sec-share');

const btnShare   = el('share');
const btnDownload= el('download');
const tryAgain   = el('try-again');

// Name + Caption under hero
const displayName = el('display-name');
const displayCaption = el('display-caption');

// Share modal refs
const shareModal   = el('share-modal');
const shareSystem  = el('share-system');
const shareInstagram = el('share-instagram');
const shareFacebook  = el('share-facebook');
const shareTwitter   = el('share-twitter');
const shareCopy      = el('share-copy');
const shareClose     = el('share-close');

/* ========== STATE ========== */
let currentLang = 'en';
let lastState   = { core:null, interpretation:null, imageUrl:'', share:{}, personalYear: undefined, personalYearAdvice: '', fullName: '' };

/* ========== Loading Quotes ========== */
const LOADING_QUOTES = [
  "Numbers are the language of the soul — a quiet geometry that reveals why we are here.",
  "Pythagoras believed that each number carries a vibration — a silent rhythm that connects the stars, the mind, and the human heart.",
  "While your chart is being calculated, remember: every number has a story, and every story begins with self-discovery.",
  "The harmony of the universe is found in the rhythm of numbers. Let’s listen to what yours will say.",
  "Even Pythagoras said: learn the numbers, and you will learn yourself."
];
const loadingQuoteEl = document.getElementById('loading-quote');
let _loadingQuoteTimer = null;
function startLoadingQuotes(){
  if (!loadingQuoteEl) return;
  let i = 0;
  loadingQuoteEl.textContent = LOADING_QUOTES[i % LOADING_QUOTES.length];
  _loadingQuoteTimer = setInterval(()=>{
    i++;
    loadingQuoteEl.textContent = LOADING_QUOTES[i % LOADING_QUOTES.length];
  }, 9000);
}
function stopLoadingQuotes(){
  if (_loadingQuoteTimer){
    clearInterval(_loadingQuoteTimer);
    _loadingQuoteTimer = null;
  }
  if (loadingQuoteEl) loadingQuoteEl.textContent = '';
}

/* ========== INIT selects (YYYY/MM/DD) ========== */
(function initDateSelectors(){
  const now = new Date();
  const yMin = 1900, yMax = now.getFullYear();
  for(let y=yMax; y>=yMin; y--){
    const o = document.createElement('option'); o.value=o.textContent=String(y);
    selYear.appendChild(o);
  }
  for(let m=1; m<=12; m++){
    const o = document.createElement('option'); o.value=String(m).padStart(2,'0');
    o.textContent = String(m);
    selMonth.appendChild(o);
  }
  updateDays();
  selYear.addEventListener('change', updateDays);
  selMonth.addEventListener('change', updateDays);
  function updateDays(){
    const y = Number(selYear.value || yMax), m = Number(selMonth.value || 1);
    const days = new Date(y, m, 0).getDate();
    selDay.innerHTML = '';
    for(let d=1; d<=days; d++){
      const o = document.createElement('option'); o.value=String(d).padStart(2,'0');
      o.textContent = String(d);
      selDay.appendChild(o);
    }
  }
})();

/* ========== Lang toggle ========== */
langEN?.addEventListener('click', ()=>setLang('en'));
langVI?.addEventListener('click', ()=>setLang('vi'));
function setLang(l){
  currentLang = l;
  langEN?.classList.toggle('active', l==='en');
  langVI?.classList.toggle('active', l==='vi');
  langEN?.setAttribute('aria-pressed', l==='en');
  langVI?.setAttribute('aria-pressed', l==='vi');
  if (inputLang) inputLang.value = l;
  // (tuỳ chọn) đổi label UI theo lang nếu bạn có bảng i18n
}

/* ========== Helpers ========== */
const pick = (obj, path) =>
  path.split('.').reduce((o,k)=> (o && o[k]!==undefined)? o[k] : undefined, obj);

function parseMaybeJson(x, fallback = {}){
  if (x === undefined || x === null) return fallback;
  if (typeof x === 'string') {
    try { return JSON.parse(x); } catch { return fallback; }
  }
  if (typeof x === 'object') return x;
  return fallback;
}

function sanitizeUrl(u){
  if (!u) return '';
  let s = String(u).trim();
  // remove stray backticks or quotes that may wrap the URL
  s = s.replace(/^`+|`+$/g, '');
  s = s.replace(/^"+|"+$/g, '');
  s = s.replace(/^'+|'+$/g, '');
  return s;
}

// Helper: remove leading full name from caption, e.g. "Name — Caption"
function escapeRegExp(s){ return String(s||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripNameFromCaption(caption, fullName){
  const c = String(caption || '').trim();
  const name = String(fullName || '').trim();
  if (!c || !name) return c;
  const lc = c.toLowerCase();
  const ln = name.toLowerCase();
  if (lc.startsWith(ln)){
    return c.slice(name.length).replace(/^[\s]*[—–\-:]+\s*/,'').trim();
  }
  const re = new RegExp('^\\s*' + escapeRegExp(name) + '\\s*[—–\\-:]\\s*', 'i');
  return c.replace(re, '').trim();
}

function show(sec){ sec.classList.remove('hidden'); }
function hide(sec){ sec.classList.add('hidden'); }

function setBusy(b){
  btnCalc.disabled = b;
  btnCalc.setAttribute('aria-busy', b? 'true':'false');
  if (b){
    hide(introSec);
    hide(form); // ẩn phần input khi bắt đầu tính toán
    show(loadingSec);
    hide(resultSec);
  }
  else  { hide(loadingSec); }
  if (b) startLoadingQuotes(); else stopLoadingQuotes();
}

function li(text){
  const li=document.createElement('li'); li.textContent=text; return li;
}

// Normalize language codes for workflow API
function normalizeLang(code){
  const c = String(code || '').trim().toLowerCase();
  if (c === 'zh' || c === 'zh-cn' || c === 'cn') return 'cn';
  if (c === 'vi' || c === 'vn') return 'vi';
  if (c === 'en') return 'en';
  return c || 'en';
}

// Simple local cache for workflow results to reduce upstream load
function wfCacheKey(full_name, dob, lang){
  return `wf:${full_name}|${dob}|${lang}`;
}
function loadWFCache(full_name, dob, lang, ttlMs = 30 * 60 * 1000){
  try{
    const key = wfCacheKey(full_name, dob, lang);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts || !obj.data) return null;
    if (Date.now() - obj.ts > ttlMs){
      localStorage.removeItem(key);
      return null;
    }
    return obj.data;
  }catch(e){ return null; }
}
function saveWFCache(full_name, dob, lang, data){
  try{
    const key = wfCacheKey(full_name, dob, lang);
    const obj = { ts: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(obj));
  }catch(e){}
}

/* ========== Fetch Dify ========== */
async function callDify(full_name, date_of_birth, lang){
  const r = await fetch(DIFY_API_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ full_name, date_of_birth, lang })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ========== Normalize & Render ========== */
function normalize(result) {
  try {
    const mediaSpec = result?.outputs?.media?.soul_map_spec || {};
    const outputs = result?.outputs || {};

    const core = outputs.core || mediaSpec.core || result.core || {};
    const interpretation = outputs.interpretation || mediaSpec.interpretation || result.interpretation || {};
    const imageUrl = outputs.image_url || mediaSpec.image_url || result.image_url || '';
    const share = outputs.share || mediaSpec.share || result.share || {};
    const personalYearObj = outputs.personal_year || mediaSpec.personal_year || result.personal_year || {};
    const personalYearAdvice = outputs.personal_year_advice
      || mediaSpec.personal_year_advice
      || result.personal_year_advice
      || (interpretation?.personal_year_advice || interpretation?.personalYearAdvice)
      || personalYearObj.advice
      || personalYearObj.meaning
      || personalYearObj.general_meaning
      || '';
    const personalYear = personalYearObj;
    const coreDetails = outputs.core_details || mediaSpec.core_details || result.core_details || {};
    const chatPrompts = outputs.chat_prompts || mediaSpec.chat_prompts || result.chat_prompts || null;

    return { core, interpretation, imageUrl, share, personalYear, personalYearAdvice, core_details: coreDetails, chatPrompts };
  } catch (e) {
    console.error('normalize error', e);
    return result;
  }
}

// Validate workflow response before using cache
function isValidWFResponse(raw){
  try{
    if (!raw) return false;
    const outputs = raw.outputs || {};
    const hasCore   = !!(outputs.core || raw.core);
    const hasInterp = !!(outputs.interpretation || raw.interpretation);
    const hasShare  = !!(outputs.share || raw.share);
    const hasImage  = !!(outputs.image_url || raw.image_url);
    return hasCore || hasInterp || hasShare || hasImage;
  }catch(e){ return false; }
}

// Render chips + mở panel chi tiết
// Helper: extract detail fields with aliases
function extractDetailFields(d = {}, { isPYear = false, personalYearAdvice = '' } = {}){
  const title = d.label || d.title || d.name || '';
  const method = d.calculation_method ?? d.calc_method ?? '';
  const generalBase = d.general_meaning ?? d.general ?? d.meaning ?? '';
  const general = isPYear ? (personalYearAdvice || generalBase) : generalBase;
  const personal = d.personal_meaning ?? d.personal ?? d.personal_meaning_text ?? '';
  return { title, method, general, personal };
}

function renderCoreChips(core, core_details, lang='en', personalYear, personalYearAdvice){
  const map = [
    { key: 'life_path',     label: 'Life Path',     value: core?.life_path },
    { key: 'expression',    label: 'Expression',    value: core?.expression },
    { key: 'soul_urge',     label: 'Soul Urge',     value: core?.soul_urge },
    { key: 'personality',   label: 'Personality',   value: core?.personality },
    { key: 'maturity',      label: 'Maturity',      value: core?.maturity }
    // Personal Year intentionally not shown as chip (displayed in info section)
  ];

  const wrap = document.getElementById('core-chips');
  if (!wrap) return;
  wrap.innerHTML = '';

  map.forEach(item => {
    if (item.value == null) return;
    const d = core_details?.[item.key] || {};
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = `${d.label || item.label}: ${item.value}`;

    btn.addEventListener('click', () => {
      const detail = extractDetailFields(d, { isPYear: false, personalYearAdvice });
      openDetailPanel(detail, lang);
    });

    wrap.appendChild(btn);
  });
}

function openDetailPanel(data, lang='en'){
  const map = {
    en: { method: 'Calculation method', meaning:'Meaning', personal:'Personal meaning' },
    vi: { method: 'Cách tính',          meaning:'Ý nghĩa', personal:'Ý nghĩa con số của bạn' },
    zh: { method: '计算方法',             meaning:'含义',     personal:'个人意义' },
    cn: { method: '计算方法',             meaning:'含义',     personal:'个人意义' }
  };
  const i18n = map[lang] || map.en;

  el('core-detail-title').textContent = data.title || '';
  el('detail-method').textContent     = data.method || '';
  el('detail-general').textContent    = data.general || '';
  el('detail-personal').textContent   = data.personal || '';

  const kvs = document.querySelectorAll('#core-detail-panel .kv .k');
  if (kvs[0]) kvs[0].textContent = i18n.method;
  if (kvs[1]) kvs[1].textContent = i18n.meaning;
  if (kvs[2]) kvs[2].textContent = i18n.personal;

  const panel = el('core-detail-panel');
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
}

// Đóng panel khi click overlay
const panelEl = document.getElementById('core-detail-panel');
panelEl?.addEventListener('click', (e) => {
  if (e.target === panelEl){
    panelEl.classList.add('hidden');
    panelEl.setAttribute('aria-hidden', 'true');
  }
});

document.getElementById('detail-close').addEventListener('click', () => {
  const panel = document.getElementById('core-detail-panel');
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
});

// ... Audio init =====
const audio = {
  open: new Audio('sound/open.mp3'),
  loading: new Audio('sound/loading.mp3'),
  result: new Audio('sound/result.mp3'),
};
audio.loading.loop = true;
// Safely play audio, swallowing AbortError rejections from interrupted play()
function playSafe(media){
  try{
    const p = media?.play();
    if (p && typeof p.catch === 'function') p.catch(()=>{});
    return p;
  }catch(e){ /* ignore */ }
}
let hasPlayedOpen = false;
function tryPlayOpen(){
  if (hasPlayedOpen) return;
  audio.open.currentTime = 0;
  const p = audio.open.play();
  if (p && typeof p.then === 'function') p.then(()=>{ hasPlayedOpen = true; }).catch(()=>{});
}
// attempt on load; fallback to first user interaction
setTimeout(tryPlayOpen, 300);
document.addEventListener('pointerdown', tryPlayOpen, { once: true });

function render({ core, interpretation, imageUrl, share, personalYear, personalYearAdvice, fullName, core_details, lang, chatPrompts }){
  // ảnh
  if (imageUrl){ imgHero.src = imageUrl; }
 
  // render chips từ core_details
  renderCoreChips(core, core_details, lang || core?.lang || 'en', personalYear, personalYearAdvice);

  // name + caption under hero
  const captionClean = stripNameFromCaption(share?.caption || '', fullName || '');
  if (displayName) displayName.textContent = fullName || '';
  if (displayCaption) displayCaption.textContent = captionClean;

  // blocks
  if (secShare) secShare.textContent = fullName || 'Share';
  txtCaption.textContent   = captionClean;
  txtShareText.textContent = share?.share_text || '';
  txtCore.textContent    = interpretation?.your_core_meaning || '';
  txtMission.textContent = interpretation?.life_mission || '';
  txtPYearAdvice.textContent = personalYearAdvice || '';
  // audio: stop loading, play result
  try { audio.loading.pause(); } catch {}
  try { audio.result.currentTime = 0; } catch {}
  playSafe(audio.result);
  listStr.innerHTML = '';
  (interpretation?.strengths || interpretation?.key_points || []).forEach(s => listStr.appendChild(li(s)));

  listChal.innerHTML = '';
  (interpretation?.challenges || []).forEach(c => listChal.appendChild(li(c)));

  // cập nhật state dùng cho export (compose khi Share/Download)
  window.soulmapImageUrl = imageUrl || imgHero.src || '';
  window.soulmapData = {
    core: { ...(core||{}), full_name: fullName || (core?.full_name || '') },
    interpretation: { ...(interpretation||{}), personal_year_advice: (personalYearAdvice || interpretation?.personal_year_advice || '') },
    share: { ...(share||{}), caption: captionClean },
    meta: { lang: (lang || currentLang || 'en') }
  };

  // Lưu vào sessionStorage để dùng cho chatbot
  try { sessionStorage.setItem('soul_core', JSON.stringify(core||{})); } catch {}
  try { sessionStorage.setItem('soul_interpretation', JSON.stringify(interpretation||{})); } catch {}
  const sessionLang = lang || core?.lang || 'en';
  try { sessionStorage.setItem('soul_lang', sessionLang); } catch {}
  try {
    const uid = getOrCreateUserId();
    sessionStorage.setItem('soul_user', uid);
  } catch {}

  // render chip cố định từ suggested_questions (không reset khi gửi/nhận tin)
  if (chatPrompts) {
    const suggested = Array.isArray(chatPrompts)
      ? chatPrompts
      : (chatPrompts?.suggested_questions || []);
    // Chỉ hiển thị 5 chip mới từ kết quả và giữ cố định
    renderFixedChips(suggested);
    renderChatHook({ chatPrompts, fullName, lang, core });
  }

  // Xóa nội dung chat cũ trước khi mở lại Chatbot
  try {
    if (chatMessages) chatMessages.innerHTML = '';
  } catch {}

  // mở khối Chatbot bên dưới (giữ mạch hội thoại)
  openChat();

  // hiển thị result
  show(resultSec);
}

/* ========== Submit ========== */
function getVisitCount(){
  try { return parseInt(localStorage.getItem('visit_count') || '0', 10) || 0; } catch(e){ return 0; }
}
function setVisitCount(n){
  try { localStorage.setItem('visit_count', String(n)); } catch(e){}
}
function showVisitCount(n){
  const elVC = document.getElementById('visit-count');
  if (elVC) elVC.textContent = `Visits: ${n}`;
}
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  // Nếu đang submit thì bỏ qua để tránh trùng
  if (window.__submitting) return;

  // Lấy và kiểm tra dữ liệu trước khi đặt cờ
  const full_name = inputName.value.trim();
  const yyyy = selYear.value, mm = selMonth.value, dd = selDay.value;
  if (!full_name || !yyyy || !mm || !dd) {
    alert('Please fill all fields.');
    // Đảm bảo không kẹt cờ nếu validate fail
    window.__handledSubmit = false;
    window.__submitting = false;
    return;
  }

  // Đánh dấu bắt đầu một lượt submit (chỉ chạy một listener)
  if (window.__handledSubmit) return; // đảm bảo chỉ một listener chạy mỗi lần
  window.__handledSubmit = true;
  window.__submitting = true;

  // audio: start loading sound
  try { audio.result.pause(); audio.result.currentTime = 0; } catch {}
  try { audio.open.pause(); } catch {}
  try { audio.loading.currentTime = 0; } catch {}
  playSafe(audio.loading);

  const dob = `${yyyy}-${mm}-${dd}`;

  try{
    setBusy(true);
    const rawLang = (inputLang?.value || currentLang || 'en').trim();
    const lang = normalizeLang(rawLang);
    let raw = loadWFCache(full_name, dob, lang);
    if (!isValidWFResponse(raw)) {
      raw = await callDify(full_name, dob, lang);
      saveWFCache(full_name, dob, lang, raw);
    }
    const data = normalize(raw);

    lastState = { ...data, fullName: full_name, lang, dob };
    render({ ...data, fullName: full_name, lang });
    try {
      const r = await fetch('/api/visit', { method: 'POST' });
      const j = await r.json();
      showVisitCount(parseInt(j.visits || 0, 10));
    } catch (e) { /* ignore */ }
  }catch(err){
    console.error(err);
    const msg = /504|timeout|Gateway/i.test(err?.message || '')
      ? 'Hệ thống quá tải hoặc kết nối chậm (504). Vui lòng thử lại sau.'
      : 'Đã xảy ra lỗi. Vui lòng thử lại.';
    alert(msg);
    hide(resultSec); show(introSec);
  }finally{
    setBusy(false);
    window.__submitting = false;
    window.__handledSubmit = false; // reset guard sau mỗi submit
  }
});

/* ========== Try again ========== */
tryAgain.addEventListener('click', (e)=>{
  e.preventDefault();
  hide(resultSec);
  show(introSec);
  show(form); // hiện lại phần input khi bấm Retry
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ========== Share & Download (tối thiểu) ========== */
// Share UI removed

if (btnDownload && !window.__downloadBound) {
  window.__downloadBound = true;
  btnDownload.addEventListener('click', async ()=>{
    if (!window.soulmapImageUrl || !window.soulmapData){
      alert('Chưa có ảnh để tải.'); return;
    }
    if (window.__downloading) return;
    window.__downloading = true;
    try {
      await handleExport('download');
    } finally {
      window.__downloading = false;
    }
  });
}

// ===== Share handlers =====
// Share UI removed: closeShare and related listeners disabled

async function getImageFile(){
  const url = imgHero.src; if (!url) throw new Error('No image URL');
  const { blob, type } = await fetchImageBlob(url);
  return new File([blob], 'soulmap.png', {type: type || 'image/png'});
}

// Share UI removed: shareSystem handler disabled

// Share UI removed: Facebook share disabled

// Share UI removed: Twitter/X share disabled

// Share UI removed: Instagram share disabled

// ===== Image fetch with proxy fallback =====
async function fetchImageBlob(url){
  if (!url) throw new Error('No image URL');
  // Try direct fetch (may fail due to CORS)
  try{
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('Content-Type') || 'image/png';
    const blob = await res.blob();
    return { blob, type };
  }catch(err){
    // Fallback to server proxy to bypass CORS
    const proxy = `/proxy_image?url=${encodeURIComponent(url)}`;
    const res2 = await fetch(proxy);
    if (!res2.ok) throw new Error(`Proxy HTTP ${res2.status}`);
    const type2 = res2.headers.get('Content-Type') || 'image/png';
    const blob2 = await res2.blob();
    return { blob: blob2, type: type2 };
  }
}

// Share UI removed: copy link disabled
// Initialize visit count on load
try{
  fetch('/api/visit')
    .then(r=>r.json())
    .then(j=>{
      showVisitCount(parseInt(j.visits || 0, 10));
    })
    .catch(()=>{
      showVisitCount(getVisitCount());
    });
}catch(e){
  showVisitCount(getVisitCount());
}

// Global state for export
window.soulmapData = null;
window.soulmapImageUrl = '';

// Restore fonts loader for Inter and Playfair
async function ensureFonts(){
  await document.fonts?.ready;
  try{
    await Promise.all([
      document.fonts.load("400 26px Inter"),
      document.fonts.load("400 28px Inter"),
      document.fonts.load("700 52px 'Playfair Display'"),
      document.fonts.load("700 40px 'Playfair Display'"),
      document.fonts.load("700 36px 'Playfair Display'")
    ]);
  }catch(e){}
}

// Harden image loader with proxy fallback to avoid CORS-tainted canvas
async function loadImage(url){
  const tryLoad = (u) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = u;
  });
  try{
    return await tryLoad(url);
  }catch(err){
    try{
      const { blob } = await fetchImageBlob(url);
      const objUrl = URL.createObjectURL(blob);
      const img = await tryLoad(objUrl);
      URL.revokeObjectURL(objUrl);
      return img;
    }catch(e){ throw e; }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  if (!text) return y;
  ctx.textAlign = 'center';
  const words = String(text).split(/\s+/);
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

// Helpers: rounded rect + measure wrapped text height
function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function measureWrapHeight(ctx, text, maxWidth, lineHeight) {
  if (!text) return 0;
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lines++; line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return lines * lineHeight;
}

// Advanced wrapping for CJK (Chinese/Japanese/Korean)
function containsCJK(text){
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(text));
}
function segmentUnits(text, lang){
  const t = String(text);
  try{
    const gran = containsCJK(t) ? 'grapheme' : 'word';
    const seg = new Intl.Segmenter(lang || 'en', { granularity: gran });
    const iterable = seg.segment(t);
    const units = [];
    for (const s of iterable){
      const u = s.segment;
      if (gran === 'word'){
        if (s.isWordLike) units.push(u + ' '); // preserve spaces
      } else {
        units.push(u);
      }
    }
    return units.length ? units : Array.from(t);
  }catch(e){
    return containsCJK(t) ? Array.from(t) : t.split(/\s+/).map(w=>w+' ');
  }
}
function measureWrapHeightLang(ctx, text, maxWidth, lineHeight, lang){
  if (!text) return 0;
  const units = segmentUnits(text, lang);
  let line = '', lines = 0;
  for (let i = 0; i < units.length; i++){
    const test = line + units[i];
    if (ctx.measureText(test).width > maxWidth && i > 0){
      lines++; line = units[i];
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return lines * lineHeight;
}
function wrapTextLang(ctx, text, x, y, maxWidth, lineHeight, lang){
  if (!text) return y;
  ctx.textAlign = 'center';
  const units = segmentUnits(text, lang);
  let line = '';
  for (let i = 0; i < units.length; i++){
    const test = line + units[i];
    if (ctx.measureText(test).width > maxWidth && i > 0){
      ctx.fillText(line, x, y);
      line = units[i];
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

async function composeSoulMapImage({
  imageUrl,
  data,
  mode = 'story' // 'story': 1080x1920; 'square': 1080x1350
}){
  const W = mode === 'story' ? 1080 : 1080;
  const H = mode === 'story' ? 1920 : 1350;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  await ensureFonts();

  // 1) background image (cover)
  const bg = await loadImage(imageUrl);
  const ratio = Math.max(W / bg.width, H / bg.height);
  const bw = bg.width * ratio, bh = bg.height * ratio;
  const bx = (W - bw) / 2, by = (H - bh) / 2;
  ctx.drawImage(bg, bx, by, bw, bh);

  // 2) text content area
  const contentTop = H * 0.60;      // panel starts ~60% height
  const cardMargin = 44;
  const panelX = cardMargin;
  const panelW = W - cardMargin * 2;
  const panelPadX = 40;
  const panelPadY = 32;
  const textMaxW = panelW - panelPadX * 2;

  const name = (data?.core?.full_name || '').toUpperCase();
  const captionRaw = data?.share?.caption || '';
  const caption = stripNameFromCaption(captionRaw, data?.core?.full_name || '');
  const yourCore = data?.interpretation?.your_core_meaning || '';
  const mission = data?.interpretation?.life_mission || '';
  const advice = data?.interpretation?.personal_year_advice || '';
  const lang = (data?.meta?.lang || data?.core?.lang || 'en').toLowerCase();

  // 3) measure height needed for panel
  let h = panelPadY; // accumulate
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';

  // Name
  ctx.font = "700 52px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 52 + 8;
  // Caption under name
  ctx.font = '400 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, caption, textMaxW, 36, lang) + 16;

  // Section 1
  ctx.font = "700 40px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 40 + 18;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, yourCore, textMaxW, 38, lang) + 18;

  // Section 2
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, mission, textMaxW, 38, lang) + 16;

  // Section 3
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, advice, textMaxW, 38, lang) + panelPadY;

  const panelH = Math.min(h, H * 0.35); // cap height to avoid covering too much
  const panelY = contentTop;

  // 4) draw glass panel with rounded corners and subtle border
  // backdrop gradient to separate from background
  const grad = ctx.createLinearGradient(0, panelY - 60, 0, panelY + panelH);
  grad.addColorStop(0, 'rgba(0,0,0,0.66)'); // ~#000A
  grad.addColorStop(1, 'rgba(0,0,0,0.95)'); // ~#000F
  ctx.fillStyle = grad;
  ctx.fillRect(0, panelY - 60, W, panelH + 60);

  // glass frame
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.fillStyle = 'rgba(10,12,26,0.72)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(170,130,255,0.18)'; // subtle purple glow
  ctx.stroke();

  // subtle outer shadow to lift panel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.strokeStyle = 'rgba(0,0,0,0.001)';
  ctx.stroke();
  ctx.restore();

  // 5) draw text inside panel
  let y = panelY + panelPadY;

  // Name
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = "700 52px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillText(name, W / 2, y);
  y += 52 + 8;

  // Caption
  ctx.font = '400 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  y = wrapTextLang(ctx, caption, W / 2, y, textMaxW, 36, lang) + 16;

  // Core meaning
  ctx.font = "700 40px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Your Core Meaning' : 'Your Core Meaning', W / 2, y);
  y += 40 + 18;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, yourCore, W / 2, y, textMaxW, 38, lang) + 18;

  // Life Mission
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Life Mission' : 'Life Mission', W / 2, y);
  y += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, mission, W / 2, y, textMaxW, 38, lang) + 16;

  // Personal Year (only render if advice exists)
  if (advice && advice.trim()) {
    ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillText(lang === 'vi' ? 'Personal Year' : 'Personal Year', W / 2, y);
    y += 36 + 14;
    ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    y = wrapTextLang(ctx, advice, W / 2, y, textMaxW, 38, lang);
  }

  // === Header overlays per spec ===
  const topSafe = Math.round(H * 0.09);   // 8–10% of height
  const sideSafe = Math.round(W * 0.055); // 5–6% of width
  const minPad = 40;                      // minimum padding

  // QR at top-left in safe zone; size ~9–10% width
  try {
    const qr = await loadImage('image/QRcode.png');
    const qrSize = Math.round(W * 0.095);
    const qrX = Math.max(sideSafe, minPad);
    const qrY = Math.max(topSafe, minPad);
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

    // caption (optional)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '300 14px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(232,215,164,0.85)'; // #E8D7A4 at 0.85 opacity
    ctx.fillText('Scan to reveal yours', qrX, qrY + qrSize + 8);
  } catch {}

  return canvas;
}

async function handleExport(action = 'download'){
  try{
    const canvas = await composeSoulMapImage({
      imageUrl: window.soulmapImageUrl,
      data: window.soulmapData,
      mode: 'story'
    });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const file = new File([blob], 'SoulMap.png', { type: 'image/png' });
    if (action === 'share' && navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], title: 'Soul Map', text: window.soulmapData?.share?.caption || 'Soul Map' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'SoulMap.png';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  }catch(e){ console.error(e); alert('Could not export image. Please try again.'); }
}
// Chat UI refs
const chatBox = document.getElementById('chat-box');
const chatTitle = document.getElementById('chat-title');
const chatChips = document.getElementById('chat-chips');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');
const askCoachBtn = document.getElementById('ask-coach');

// Reset toàn bộ chat khi bắt đầu Calculate
function resetChatForCalculation(){
  try {
    // Xóa toàn bộ nội dung chat
    if (chatMessages) chatMessages.innerHTML = '';
    // Xóa nội dung ô nhập
    if (chatInput) chatInput.value = '';
    // Xóa tất cả chips (bao gồm cả cố định); sẽ render lại sau khi có kết quả
    if (chatChips) chatChips.querySelectorAll('.topic-chip').forEach(el => el.remove());
    // Reset hội thoại
    if (typeof coachState !== 'undefined') {
      coachState.conversationId = null;
      coachState.memory.pending_action = null;
      coachState.memory.last_question_id = null;
    }
    try { sessionStorage.removeItem('soul_convo'); } catch {}
    try { localStorage.removeItem('soul_coach_convo'); } catch {}
    try {
      const uid = sessionStorage.getItem('soul_user') || getOrCreateUserId();
      const flagKey = 'soulmap_init_' + uid;
      localStorage.removeItem(flagKey);
    } catch {}
  } catch (e) {
    console.error('resetChatForCalculation error', e);
  }
}

function getUserId() {
  const KEY = 'soulmap_uid';
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    const rnd = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    uid = 'soul_' + rnd;
    localStorage.setItem(KEY, uid);
  }
  return uid;
}

// Dùng sessionStorage cho user (device/account id)
function getOrCreateUserId(){
  const KEY = 'soul_user';
  let uid = sessionStorage.getItem(KEY);
  if (!uid){
    uid = getUserId();
    try { sessionStorage.setItem(KEY, uid); } catch {}
  }
  return uid;
}

// Chip cố định: Career, 30-day plan, Missing numbers, Personal year, Love/Communication
const CHIP_INTENTS = [
  'career', 'growth_30d', 'missing_numbers', 'personal_year', 'love_comm'
];

function createChip({ text, onClick }){
  if (!chatChips) return;
  const btn = document.createElement('button');
  btn.className = 'chip-btn';
  btn.type = 'button';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  chatChips.appendChild(btn);
}

function renderFixedChips(suggestedQuestions) {
  if (!chatChips) return;
  // Xoá toàn bộ chips cũ (cố định và không cố định)
  chatChips.querySelectorAll('.chip-btn').forEach(el => el.remove());
  const lang = normalizeLang(window.soulmapData?.meta?.lang || window.currentLang || 'en');
  let suggestions = [];
  if (Array.isArray(suggestedQuestions)) {
    suggestions = suggestedQuestions;
  } else if (suggestedQuestions?.suggested_questions) {
    suggestions = suggestedQuestions.suggested_questions;
  } else if (suggestedQuestions && suggestedQuestions[lang]) {
    suggestions = suggestedQuestions[lang];
  }
  // Fallback: nếu không có dữ liệu, dùng 5 gợi ý tiếng Anh chuẩn
  if (!suggestions || suggestions.length === 0) {
    const EN_FALLBACK = [
      { label: 'Career direction', prompt: 'What career path fits my core numbers?' },
      { label: '30-day growth plan', prompt: 'Give me a 30-day growth plan based on my chart.' },
      { label: 'Missing numbers', prompt: 'Which numbers are missing in my chart and what do they mean?' },
      { label: 'Personal year', prompt: 'What is my personal year and advice for it?' },
      { label: 'Love & communication', prompt: 'How can I improve love and communication according to my numbers?' },
    ];
    suggestions = EN_FALLBACK;
  }
  // Chỉ render đúng 5 chip mới và đánh dấu là cố định
  suggestions.slice(0, 5).forEach((q) => {
    const label = q.label || q.intent || 'Question';
    const promptText = q.prompt || q.label || '';
    createChip({ text: label, onClick: () => sendChat(promptText) });
  });
}

// === Soul Coach state & helpers ===
let coachState = {
  conversationId: (sessionStorage.getItem('soul_convo') || localStorage.getItem('soul_coach_convo') || null),
  userId: getOrCreateUserId(),
  memory: {
    lang: normalizeLang(sessionStorage.getItem('soul_lang') || window.soulmapData?.meta?.lang || window.currentLang || 'vi'),
    core: (function(){ try{ return JSON.parse(sessionStorage.getItem('soul_core')||'{}'); }catch{ return (window.soulmapData?.core || lastState.core || {}); } })(),
    last_question_id: null,
    pending_action: null,
    breadcrumbs: ['entered_coach']
  },
  lastInteractionTs: Date.now(),
};
function genConvoId(){
  return 'convo_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function pushBreadcrumb(tag){
  const b = coachState.memory.breadcrumbs || [];
  b.push(tag);
  coachState.memory.breadcrumbs = b.slice(-5);
}
const YES_DICT = {
  vi: ['có','ok','tiếp','đúng rồi','ừ','rồi','y','👍','👌'],
  en: ['yes','y','ok','sure','👍','👌'],
  zh: ['是','好','可以','行','👍','👌'],
  ja: ['はい','うん','ok','👍','👌'],
};
const NO_DICT = {
  vi: ['không','thôi','để sau','chưa','no','❌'],
  en: ['no','nah','later','not yet','❌'],
  zh: ['不','不要','以后','还没','❌'],
  ja: ['いいえ','やめる','後で','まだ','❌'],
};
function isYes(text, lang){
  const l = normalizeLang(lang || coachState.memory.lang || 'vi');
  const t = (text || '').trim().toLowerCase();
  return (YES_DICT[l] || []).some(x => t === x || t.includes(x));
}
function isNo(text, lang){
  const l = normalizeLang(lang || coachState.memory.lang || 'vi');
  const t = (text || '').trim().toLowerCase();
  return (NO_DICT[l] || []).some(x => t === x || t.includes(x));
}
function parseNextActionFromText(text){
  if (!text) return null;
  const re = /(Biểu đạt|Expression)/i;
  return re.test(text) ? 'explain_expression' : null;
}
function renderQuickReplies(list){
  // Disabled per yêu cầu: chỉ giữ 5 chip cố định, không thêm quick replies
  return;
}

// Render suggested chat questions
function renderChatChips(chatPrompts) {
  if (!chatChips) return;
  // Chỉ xoá các chip không cố định, giữ nguyên 5 chip đầu
  chatChips.querySelectorAll('.topic-chip:not(.fixed)').forEach(el => el.remove());
  const lang = normalizeLang(window.soulmapData?.meta?.lang || window.currentLang || 'vi');
  if (chatTitle) {
    chatTitle.textContent = lang === 'vi' ? 'Hỏi Soul Coach ✨' : lang === 'cn' ? '咨询 Soul Coach ✨' : 'Ask Soul Coach ✨';
  }
  let suggestions = [];
  if (Array.isArray(chatPrompts)) {
    suggestions = chatPrompts;
  } else if (chatPrompts?.suggested_questions) {
    suggestions = chatPrompts.suggested_questions;
  } else if (chatPrompts && chatPrompts[lang]) {
    suggestions = chatPrompts[lang];
  }
  // Fallback: default five topics with icon and color
  if (!suggestions || suggestions.length === 0) {
    suggestions = [
      { label: '💼✨ Sự nghiệp & sáng tạo', prompt: 'Soul Coach ơi, hãy gợi ý định hướng sự nghiệp và sáng tạo theo bản đồ linh hồn của tôi?' , cat: 'career' },
      { label: '📆🌱 Kế hoạch 30 ngày', prompt: 'Trong 30 ngày tới, tôi nên tập trung vào điều gì để phát huy năng lượng linh hồn?' , cat: 'thirty' },
      { label: '🔮💫 Bài học từ số thiếu', prompt: 'Các con số thiếu của tôi nói lên bài học gì và cách chuyển hóa?' , cat: 'missing' },
      { label: '☀️🌀 Năm cá nhân', prompt: 'Năng lượng năm cá nhân hiện tại gợi ý điều gì cho tôi?' , cat: 'pyear' },
      { label: '💖🌸 Tình yêu & giao tiếp', prompt: 'Phong cách yêu thương và giao tiếp của tôi là gì? Tôi cần lưu ý điều gì?' , cat: 'love' },
    ];
  }
  suggestions.forEach((q) => {
    const btn = document.createElement('button');
    btn.className = `topic-chip ${q.cat || ''}`.trim();
    btn.type = 'button';
    const label = q.label || q.intent || 'Câu hỏi';
    const promptText = q.prompt || q.label || '';
    btn.innerHTML = `<span class="icon"></span>${label}`;
    btn.title = promptText;
    btn.addEventListener('click', () => {
      if (!chatInput) return;
      chatInput.value = promptText || label;
      chatInput.focus();
    });
    chatChips.appendChild(btn);
  });
}

// Message renderer with bubbles
function appendMessage(role, text, meta = {}) {
  if (!chatMessages) return;
  const item = document.createElement('div');
  item.className = `chat-msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  if (meta.next_action_id) {
    item.dataset.nextAction = meta.next_action_id;
    bubble.dataset.nextAction = meta.next_action_id;
  }
  if (role === 'assistant') {
    const icon = document.createElement('span');
    icon.className = 'bubble-icon';
    icon.textContent = '✨';
    bubble.appendChild(icon);
  }
  item.appendChild(bubble);
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Call chat API via server proxy (Dify-compatible payload)
async function callChat(payload = {}) {
  const body = {
    inputs: {
      lang: coachState.memory.lang,
      core_json: (() => { try { return JSON.stringify(coachState.memory.core || {}); } catch { return ''; } })(),
      interpretation: (() => {
        const itp = coachState.memory.interpretation;
        if (typeof itp === 'string') return itp;
        try { return JSON.stringify(itp || {}); } catch { return ''; }
      })(),
      memory: coachState.memory,
      ...(payload.inputs || {})
    },
    query: payload.query || '',
    response_mode: payload.response_mode || 'blocking',
    conversation_id: coachState.conversationId || '',
    user: coachState.userId
  };
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API error ${res.status}: ${text}`);
  }
  return res.json();
}

// API tiện ích: gọi từ chip cố định, luôn đính kèm core/lang + extraInputs
async function sendChat(query, extraInputs = {}) {
  return sendChatMessage(query, false, extraInputs);
}

function extractAnswerAndMeta(resp) {
  const answer = resp?.answer || resp?.data?.answer || resp?.message || '';
  const conversationId = resp?.conversation_id || resp?.data?.conversation_id || null;
  const nextActionId = resp?.next_action?.id || parseNextActionFromText(answer);
  const quickReplies = resp?.quick_replies || resp?.data?.quick_replies || null;
  return { answer, conversationId, nextActionId, quickReplies };
}

// Send chat message with memory, conversation and YES/NO intents
async function sendChatMessage(text, isFirst = false, extraInputs = {}) {
  try {
    const now = Date.now();
    if (now - (coachState.lastInteractionTs || 0) > 20 * 60 * 1000) {
      coachState.memory.pending_action = null; // timeout reset pending_action, keep conversation_id
    }
    coachState.lastInteractionTs = now;

    const raw = (text != null ? String(text) : (chatInput?.value || '')).trim();
    if (!raw) return;
    // Đồng bộ core/lang từ session trước mỗi lượt
    try { coachState.memory.core = JSON.parse(sessionStorage.getItem('soul_core') || '{}'); } catch {}
    try { coachState.memory.interpretation = JSON.parse(sessionStorage.getItem('soul_interpretation') || '{}'); } catch {}
    coachState.memory.lang = normalizeLang(sessionStorage.getItem('soul_lang') || coachState.memory.lang || window.currentLang || 'vi');
    coachState.userId = sessionStorage.getItem('soul_user') || getOrCreateUserId();
    const savedConvo = sessionStorage.getItem('soul_convo');
    if (savedConvo) coachState.conversationId = savedConvo;

    const lang = normalizeLang(coachState.memory.lang || window.currentLang || 'vi');
    coachState.memory.lang = lang;
    const firstFlagKey = 'soulmap_init_' + coachState.userId;

    const query = raw; // luôn gửi nội dung người dùng
    const inputsPayload = isFirst ? { init: true, ...extraInputs } : { ...extraInputs };
    // Nếu người dùng trả lời YES cho một hành động đang chờ, đính kèm intent vào inputs thay vì thay thế query
    if (isYes(raw, lang) && coachState.memory.pending_action) {
      inputsPayload.intent = coachState.memory.pending_action;
    }

    appendMessage('user', raw);
    chatSend && (chatSend.disabled = true);

    const payload = {
      query,
      inputs: inputsPayload
    };

    const resp = await callChat(payload);
    const meta = extractAnswerAndMeta(resp);

    if (meta.conversationId && !coachState.conversationId) {
      coachState.conversationId = meta.conversationId;
    }
    if (coachState.conversationId) {
      try { sessionStorage.setItem('soul_convo', coachState.conversationId); } catch {}
      try { localStorage.setItem('soul_coach_convo', coachState.conversationId); } catch {}
    }

    if (meta.nextActionId) {
      coachState.memory.pending_action = meta.nextActionId;
      coachState.memory.last_question_id = meta.nextActionId;
      pushBreadcrumb(`offered_${meta.nextActionId}`);
    } else if (query.startsWith('[[INTENT:')) {
      const handled = query.slice(9, -2);
      coachState.memory.pending_action = null;
      pushBreadcrumb(`handled_${handled}`);
    }

    appendMessage('assistant', meta.answer || '...', { next_action_id: meta.nextActionId || undefined });

    renderQuickReplies(meta.quickReplies);

    if (isFirst) {
      localStorage.setItem(firstFlagKey, '1');
    }

  } catch (err) {
    console.error('sendChatMessage error', err);
    appendMessage('assistant', `Đã xảy ra lỗi: ${err.message}`);
  } finally {
    chatSend && (chatSend.disabled = false);
    // Luôn xóa nội dung trường nhập sau khi gửi, dù gửi qua chip hay gõ tay
    if (chatInput) chatInput.value = '';
  }
}

if (chatSend) {
  chatSend.addEventListener('click', (e) => {
    e.preventDefault();
    sendChatMessage();
  });
}

if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

const chatVoice = document.getElementById('chat-voice');
if (chatVoice) {
  chatVoice.addEventListener('click', () => {
    appendMessage('assistant', '🎤 Tính năng giọng nói sẽ sớm ra mắt.');
  });
}

function openChat() {
  if (chatBox) {
    chatBox.classList.remove('hidden');
    chatBox.style.display = 'block';
  }
  playSafe(audio.open);

  // Ensure conversation_id persists via sessionStorage
  const existing = sessionStorage.getItem('soul_convo') || localStorage.getItem('soul_coach_convo');
  if (existing) {
    coachState.conversationId = existing;
  } else {
    coachState.conversationId = genConvoId();
    try { sessionStorage.setItem('soul_convo', coachState.conversationId); } catch {}
    try { localStorage.setItem('soul_coach_convo', coachState.conversationId); } catch {}
  }

  const flagKey = 'soulmap_init_' + coachState.userId;
  const alreadyInit = localStorage.getItem(flagKey) === '1';
  if (!alreadyInit) {
    sendChatMessage('Hello Soul Map!', true);
  }
}

if (askCoachBtn) {
  askCoachBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openChat();
  });
}

// Hook chat chips rendering into main render flow
function renderChatHook(state) {
  try {
    // Không render thêm chip gợi ý động; giữ nguyên 5 chip cố định
    // (chips cố định đã được render trong renderFixedChips ở bước Calculate)
  } catch (e) {
    console.error('renderChatHook error', e);
  }
}

/* ========== Submit ========== */
function getVisitCount(){
  try { return parseInt(localStorage.getItem('visit_count') || '0', 10) || 0; } catch(e){ return 0; }
}
function setVisitCount(n){
  try { localStorage.setItem('visit_count', String(n)); } catch(e){}
}
function showVisitCount(n){
  const elVC = document.getElementById('visit-count');
  if (elVC) elVC.textContent = `Visits: ${n}`;
}
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  // Nếu đang submit thì bỏ qua để tránh trùng
  if (window.__submitting) return;

  // Lấy và kiểm tra dữ liệu trước khi đặt cờ
  const full_name = inputName.value.trim();
  const yyyy = selYear.value, mm = selMonth.value, dd = selDay.value;
  if (!full_name || !yyyy || !mm || !dd) {
    alert('Please fill all fields.');
    // Đảm bảo không kẹt cờ nếu validate fail
    window.__handledSubmit = false;
    window.__submitting = false;
    return;
  }

  // Đánh dấu bắt đầu một lượt submit (chỉ chạy một listener)
  if (window.__handledSubmit) return; // đảm bảo chỉ một listener chạy mỗi lần
  window.__handledSubmit = true;
  window.__submitting = true;

  // audio: start loading sound
  try { audio.result.pause(); audio.result.currentTime = 0; } catch {}
  try { audio.open.pause(); } catch {}
  try { audio.loading.currentTime = 0; } catch {}
  playSafe(audio.loading);

  // Reset chat để bắt đầu phiên mới, chips sẽ render lại sau khi có kết quả
  resetChatForCalculation();

  const dob = `${yyyy}-${mm}-${dd}`;

  try{
    setBusy(true);
    const rawLang = (inputLang?.value || currentLang || 'en').trim();
    const lang = normalizeLang(rawLang);
    let raw = loadWFCache(full_name, dob, lang);
    if (!isValidWFResponse(raw)) {
      raw = await callDify(full_name, dob, lang);
      saveWFCache(full_name, dob, lang, raw);
    }
    const data = normalize(raw);

    lastState = { ...data, fullName: full_name, lang, dob };
    render({ ...data, fullName: full_name, lang });
    try {
      const r = await fetch('/api/visit', { method: 'POST' });
      const j = await r.json();
      showVisitCount(parseInt(j.visits || 0, 10));
    } catch (e) { /* ignore */ }
  }catch(err){
    console.error(err);
    const msg = /504|timeout|Gateway/i.test(err?.message || '')
      ? 'Hệ thống quá tải hoặc kết nối chậm (504). Vui lòng thử lại sau.'
      : 'Đã xảy ra lỗi. Vui lòng thử lại.';
    alert(msg);
    hide(resultSec); show(introSec);
  }finally{
    setBusy(false);
    window.__submitting = false;
    window.__handledSubmit = false; // reset guard sau mỗi submit
  }
});

/* ========== Try again ========== */
tryAgain.addEventListener('click', (e)=>{
  e.preventDefault();
  hide(resultSec); show(introSec);
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ========== Share & Download (tối thiểu) ========== */
// Share UI removed

if (btnDownload && !window.__downloadBound) {
  window.__downloadBound = true;
  btnDownload.addEventListener('click', async ()=>{
    if (!window.soulmapImageUrl || !window.soulmapData){
      alert('Chưa có ảnh để tải.'); return;
    }
    if (window.__downloading) return;
    window.__downloading = true;
    try {
      await handleExport('download');
    } finally {
      window.__downloading = false;
    }
  });
}

// ===== Share handlers =====
// Share UI removed: closeShare and related listeners disabled

async function getImageFile(){
  const url = imgHero.src; if (!url) throw new Error('No image URL');
  const { blob, type } = await fetchImageBlob(url);
  return new File([blob], 'soulmap.png', {type: type || 'image/png'});
}

// Share UI removed: shareSystem handler disabled

// Share UI removed: Facebook share disabled

// Share UI removed: Twitter/X share disabled

// Share UI removed: Instagram share disabled

// ===== Image fetch with proxy fallback =====
async function fetchImageBlob(url){
  if (!url) throw new Error('No image URL');
  // Try direct fetch (may fail due to CORS)
  try{
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('Content-Type') || 'image/png';
    const blob = await res.blob();
    return { blob, type };
  }catch(err){
    // Fallback to server proxy to bypass CORS
    const proxy = `/proxy_image?url=${encodeURIComponent(url)}`;
    const res2 = await fetch(proxy);
    if (!res2.ok) throw new Error(`Proxy HTTP ${res2.status}`);
    const type2 = res2.headers.get('Content-Type') || 'image/png';
    const blob2 = await res2.blob();
    return { blob: blob2, type: type2 };
  }
}

// Share UI removed: shareCopy handler disabled
// Initialize visit count on load
try{
  fetch('/api/visit')
    .then(r=>r.json())
    .then(j=>{
      showVisitCount(parseInt(j.visits || 0, 10));
    })
    .catch(()=>{
      showVisitCount(getVisitCount());
    });
}catch(e){
  showVisitCount(getVisitCount());
}

// Global state for export
window.soulmapData = null;
window.soulmapImageUrl = '';

// Restore fonts loader for Inter and Playfair
async function ensureFonts(){
  await document.fonts?.ready;
  try{
    await Promise.all([
      document.fonts.load("400 26px Inter"),
      document.fonts.load("400 28px Inter"),
      document.fonts.load("700 52px 'Playfair Display'"),
      document.fonts.load("700 40px 'Playfair Display'"),
      document.fonts.load("700 36px 'Playfair Display'")
    ]);
  }catch(e){}
}

// Harden image loader with proxy fallback to avoid CORS-tainted canvas
async function loadImage(url){
  const tryLoad = (u) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = u;
  });
  try{
    return await tryLoad(url);
  }catch(err){
    try{
      const { blob } = await fetchImageBlob(url);
      const objUrl = URL.createObjectURL(blob);
      const img = await tryLoad(objUrl);
      URL.revokeObjectURL(objUrl);
      return img;
    }catch(e){ throw e; }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  if (!text) return y;
  ctx.textAlign = 'center';
  const words = String(text).split(/\s+/);
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

// Helpers: rounded rect + measure wrapped text height
function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function measureWrapHeight(ctx, text, maxWidth, lineHeight) {
  if (!text) return 0;
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lines++; line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return lines * lineHeight;
}

// Advanced wrapping for CJK (Chinese/Japanese/Korean)
function containsCJK(text){
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(text));
}
function segmentUnits(text, lang){
  const t = String(text);
  try{
    const gran = containsCJK(t) ? 'grapheme' : 'word';
    const seg = new Intl.Segmenter(lang || 'en', { granularity: gran });
    const iterable = seg.segment(t);
    const units = [];
    for (const s of iterable){
      const u = s.segment;
      if (gran === 'word'){
        if (s.isWordLike) units.push(u + ' '); // preserve spaces
      } else {
        units.push(u);
      }
    }
    return units.length ? units : Array.from(t);
  }catch(e){
    return containsCJK(t) ? Array.from(t) : t.split(/\s+/).map(w=>w+' ');
  }
}
function measureWrapHeightLang(ctx, text, maxWidth, lineHeight, lang){
  if (!text) return 0;
  const units = segmentUnits(text, lang);
  let line = '', lines = 0;
  for (let i = 0; i < units.length; i++){
    const test = line + units[i];
    if (ctx.measureText(test).width > maxWidth && i > 0){
      lines++; line = units[i];
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return lines * lineHeight;
}
function wrapTextLang(ctx, text, x, y, maxWidth, lineHeight, lang){
  if (!text) return y;
  ctx.textAlign = 'center';
  const units = segmentUnits(text, lang);
  let line = '';
  for (let i = 0; i < units.length; i++){
    const test = line + units[i];
    if (ctx.measureText(test).width > maxWidth && i > 0){
      ctx.fillText(line, x, y);
      line = units[i];
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

async function composeSoulMapImage({
  imageUrl,
  data,
  mode = 'story' // 'story': 1080x1920; 'square': 1080x1350
}){
  const W = mode === 'story' ? 1080 : 1080;
  const H = mode === 'story' ? 1920 : 1350;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  await ensureFonts();

  // 1) background image (cover)
  const bg = await loadImage(imageUrl);
  const ratio = Math.max(W / bg.width, H / bg.height);
  const bw = bg.width * ratio, bh = bg.height * ratio;
  const bx = (W - bw) / 2, by = (H - bh) / 2;
  ctx.drawImage(bg, bx, by, bw, bh);

  // 2) text content area
  const contentTop = H * 0.60;      // panel starts ~60% height
  const cardMargin = 44;
  const panelX = cardMargin;
  const panelW = W - cardMargin * 2;
  const panelPadX = 40;
  const panelPadY = 32;
  const textMaxW = panelW - panelPadX * 2;

  const name = (data?.core?.full_name || '').toUpperCase();
  const captionRaw = data?.share?.caption || '';
  const caption = stripNameFromCaption(captionRaw, data?.core?.full_name || '');
  const yourCore = data?.interpretation?.your_core_meaning || '';
  const mission = data?.interpretation?.life_mission || '';
  const advice = data?.interpretation?.personal_year_advice || '';
  const lang = (data?.meta?.lang || data?.core?.lang || 'en').toLowerCase();

  // 3) measure height needed for panel
  let h = panelPadY; // accumulate
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';

  // Name
  ctx.font = "700 52px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 52 + 8;
  // Caption under name
  ctx.font = '400 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, caption, textMaxW, 36, lang) + 16;

  // Section 1
  ctx.font = "700 40px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 40 + 18;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, yourCore, textMaxW, 38, lang) + 18;

  // Section 2
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, mission, textMaxW, 38, lang) + 16;

  // Section 3
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  h += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  h += measureWrapHeightLang(ctx, advice, textMaxW, 38, lang) + panelPadY;

  const panelH = Math.min(h, H * 0.35); // cap height to avoid covering too much
  const panelY = contentTop;

  // 4) draw glass panel with rounded corners and subtle border
  // backdrop gradient to separate from background
  const grad = ctx.createLinearGradient(0, panelY - 60, 0, panelY + panelH);
  grad.addColorStop(0, 'rgba(0,0,0,0.66)'); // ~#000A
  grad.addColorStop(1, 'rgba(0,0,0,0.95)'); // ~#000F
  ctx.fillStyle = grad;
  ctx.fillRect(0, panelY - 60, W, panelH + 60);

  // glass frame
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.fillStyle = 'rgba(10,12,26,0.72)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(170,130,255,0.18)'; // subtle purple glow
  ctx.stroke();

  // subtle outer shadow to lift panel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.strokeStyle = 'rgba(0,0,0,0.001)';
  ctx.stroke();
  ctx.restore();

  // 5) draw text inside panel
  let y = panelY + panelPadY;

  // Name
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = "700 52px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillText(name, W / 2, y);
  y += 52 + 8;

  // Caption
  ctx.font = '400 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  y = wrapTextLang(ctx, caption, W / 2, y, textMaxW, 36, lang) + 16;

  // Core meaning
  ctx.font = "700 40px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Your Core Meaning' : 'Your Core Meaning', W / 2, y);
  y += 40 + 18;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, yourCore, W / 2, y, textMaxW, 38, lang) + 18;

  // Life Mission
  ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Life Mission' : 'Life Mission', W / 2, y);
  y += 36 + 14;
  ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, mission, W / 2, y, textMaxW, 38, lang) + 16;

  // Personal Year (only render if advice exists)
  if (advice && advice.trim()) {
    ctx.font = "700 36px 'Playfair Display', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillText(lang === 'vi' ? 'Personal Year' : 'Personal Year', W / 2, y);
    y += 36 + 14;
    ctx.font = '400 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    y = wrapTextLang(ctx, advice, W / 2, y, textMaxW, 38, lang);
  }

  // === Header overlays per spec ===
  const topSafe = Math.round(H * 0.09);   // 8–10% of height
  const sideSafe = Math.round(W * 0.055); // 5–6% of width
  const minPad = 40;                      // minimum padding

  // QR at top-left in safe zone; size ~9–10% width
  try {
    const qr = await loadImage('image/QRcode.png');
    const qrSize = Math.round(W * 0.095);
    const qrX = Math.max(sideSafe, minPad);
    const qrY = Math.max(topSafe, minPad);
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

    // caption (optional)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '300 14px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(232,215,164,0.85)'; // #E8D7A4 at 0.85 opacity
    ctx.fillText('Scan to reveal yours', qrX, qrY + qrSize + 8);
  } catch {}

  return canvas;
}

async function handleExport(action = 'download'){
  try{
    const canvas = await composeSoulMapImage({
      imageUrl: window.soulmapImageUrl,
      data: window.soulmapData,
      mode: 'story'
    });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const file = new File([blob], 'SoulMap.png', { type: 'image/png' });
    if (action === 'share' && navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], title: 'Soul Map', text: window.soulmapData?.share?.caption || 'Soul Map' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'SoulMap.png';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  }catch(e){ console.error(e); alert('Could not export image. Please try again.'); }
}