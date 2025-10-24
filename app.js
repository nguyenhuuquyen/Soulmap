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
  if (b){ hide(introSec); show(loadingSec); hide(resultSec); }
  else  { hide(loadingSec); }
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
function normalize(raw){
  // outputs có thể nằm ở data.outputs
  const outputs = pick(raw,'data.outputs') || raw?.data?.outputs || raw || {};
  const result  = outputs.result || {};

  // core & interpretation: hỗ trợ cả object và chuỗi JSON
  const coreCandidate = result.core || outputs.core || parseMaybeJson(outputs.core_str, {});
  const core = (coreCandidate && typeof coreCandidate === 'object') ? coreCandidate : {};

  const mediaSpec = parseMaybeJson(outputs.media_spec_str, parseMaybeJson(outputs.media_spec, {}));
  const inter = result.interpretation || outputs.interpretation || mediaSpec.interpretation || {};

  // image url: ưu tiên outputs.image_url, sau đó siliconflow images[0].url / data[0].url
  const imageObj = parseMaybeJson(outputs.image, {});
  const imageUrlCandidate =
    outputs.image_url ||
    imageObj?.images?.[0]?.url ||
    imageObj?.data?.[0]?.url ||
    pick(raw,'images.0.url') ||
    pick(raw,'data.0.url') ||
    '';
  const imageUrl = sanitizeUrl(imageUrlCandidate);

  const share = result.share || outputs.share || {};
  const personalYear = result.personal_year ?? core.personal_year ?? outputs.personal_year ?? mediaSpec.personal_year ?? undefined;
  const personalYearAdvice = result.personal_year_advice ?? inter.personal_year_advice ?? outputs.personal_year_advice ?? mediaSpec.personal_year_advice ?? '';

  // core_details nằm trong outputs/result, hỗ trợ chuỗi JSON
  const coreDetails = result.core_details || outputs.core_details || parseMaybeJson(outputs.core_details_str, {});
  return { core, interpretation: inter, imageUrl, share, personalYear, personalYearAdvice, core_details: coreDetails };
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
    btn.className = 'chip-btn';
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
let hasPlayedOpen = false;
function tryPlayOpen(){
  if (hasPlayedOpen) return;
  audio.open.currentTime = 0;
  audio.open.play().then(()=>{ hasPlayedOpen = true; }).catch(()=>{});
}
// attempt on load; fallback to first user interaction
setTimeout(tryPlayOpen, 300);
document.addEventListener('pointerdown', tryPlayOpen, { once: true });

function render({ core, interpretation, imageUrl, share, personalYear, personalYearAdvice, fullName, core_details, lang }){
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
  try { audio.result.currentTime = 0; audio.result.play(); } catch {}
  listStr.innerHTML = '';
  (interpretation?.strengths || interpretation?.key_points || []).forEach(s => listStr.appendChild(li(s)));

  listChal.innerHTML = '';
  (interpretation?.challenges || []).forEach(c => listChal.appendChild(li(c)));

  // cập nhật state dùng cho export (compose khi Share/Download)
  window.soulmapImageUrl = imageUrl || imgHero.src || '';
  window.soulmapData = {
    core: { ...(core||{}), full_name: fullName || (core?.full_name || '') },
    interpretation: interpretation || {},
    share: { ...(share||{}), caption: captionClean },
    meta: { lang: (lang || currentLang || 'en') }
  };

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
  // audio: start loading sound
  try { audio.result.pause(); audio.result.currentTime = 0; } catch {}
  try { audio.open.pause(); } catch {}
  try { audio.loading.currentTime = 0; audio.loading.play(); } catch {}
  // increment and show visit count
  const current = getVisitCount() + 1;
  setVisitCount(current);
  showVisitCount(current);
  const full_name = inputName.value.trim();
  const yyyy = selYear.value, mm = selMonth.value, dd = selDay.value;
  if (!full_name || !yyyy || !mm || !dd) return alert('Please fill all fields.');

  const dob = `${yyyy}-${mm}-${dd}`;

  try{
    setBusy(true);
    const rawLang = (inputLang?.value || currentLang || 'en').trim();
    const lang = normalizeLang(rawLang);
    const raw = await callDify(full_name, dob, lang);
    const data = normalize(raw);

    lastState = { ...data, fullName: full_name, lang }; // lưu cho share/download
    render({ ...data, fullName: full_name, lang });
  }catch(err){
    console.error(err);
    alert('Something went wrong. Please try again.');
    hide(resultSec); show(introSec);
  }finally{
    setBusy(false);
  }
});

/* ========== Try again ========== */
tryAgain.addEventListener('click', (e)=>{
  e.preventDefault();
  hide(resultSec); show(introSec);
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ========== Share & Download (tối thiểu) ========== */
btnShare.addEventListener('click', async ()=>{
  if (!window.soulmapImageUrl || !window.soulmapData){
    alert('No image to share yet.'); return;
  }
  // compose + share hệ thống
  await handleExport('share');
});

btnDownload.addEventListener('click', async ()=>{
  if (!window.soulmapImageUrl || !window.soulmapData){
    alert('Chưa có ảnh để tải.'); return;
  }
  await handleExport('download');
});

// ===== Share handlers =====
function closeShare(){ shareModal.classList.add('hidden'); }
shareClose.addEventListener('click', closeShare);

async function getImageFile(){
  const url = imgHero.src; if (!url) throw new Error('No image URL');
  const { blob, type } = await fetchImageBlob(url);
  return new File([blob], 'soulmap.png', {type: type || 'image/png'});
}

shareSystem.addEventListener('click', async ()=>{
  try{
    const file = await getImageFile();
    if (navigator.canShare?.({files:[file]})){
      await navigator.share({ files:[file], title: 'Soul Map' });
      closeShare();
    }else if (navigator.share){
      await navigator.share({ url: imgHero.src, title: 'Soul Map' });
      closeShare();
    }else{
      // fallback to download
      const a=document.createElement('a'); a.href=imgHero.src; a.download='soulmap.png'; a.click();
    }
  }catch(e){ console.error(e); }
});

shareFacebook.addEventListener('click', ()=>{
  const url = encodeURIComponent(imgHero.src);
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  window.open(fb, '_blank', 'noopener');
  closeShare();
});

shareTwitter.addEventListener('click', ()=>{
  const url = encodeURIComponent(imgHero.src);
  const text = encodeURIComponent(lastState.share?.caption || 'Soul Map');
  const tags = (lastState.share?.hashtags || []).map(h=>h.replace(/^#/, '')).join(',');
  const tw = `https://twitter.com/intent/tweet?url=${url}&text=${text}` + (tags? `&hashtags=${encodeURIComponent(tags)}`:'');
  window.open(tw, '_blank', 'noopener');
  closeShare();
});

shareInstagram.addEventListener('click', async ()=>{
  try{
    const file = await getImageFile();
    if (navigator.canShare?.({files:[file]})){
      await navigator.share({ files:[file], title: 'Soul Map' });
      // On mobile, this typically offers IG as a target
    }else{
      alert('Instagram web không hỗ trợ share trực tiếp ảnh. Ảnh sẽ được tải về để bạn đăng lên IG.');
      try{
        const { blob } = await fetchImageBlob(imgHero.src);
        const blobUrl = URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href = blobUrl;
        a.download = 'soulmap-instagram.png';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=> URL.revokeObjectURL(blobUrl), 2000);
      }catch(e){
        console.error(e);
        window.open(imgHero.src, '_blank', 'noopener');
      }
    }
  }catch(e){ console.error(e); }
  closeShare();
});

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

shareCopy.addEventListener('click', async ()=>{
  try{
    await navigator.clipboard.writeText(imgHero.src);
    alert('Đã copy link ảnh vào clipboard.');
  }catch(e){ console.error(e); }
  closeShare();
});
// Initialize visit count on load
showVisitCount(getVisitCount());

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
  ctx.font = "700 52px 'Playfair Display'";
  h += 52 + 8;
  // Caption under name
  ctx.font = '400 26px Inter';
  h += measureWrapHeightLang(ctx, caption, textMaxW, 36, lang) + 16;

  // Section 1
  ctx.font = "700 40px 'Playfair Display'";
  h += 40 + 18;
  ctx.font = '400 28px Inter';
  h += measureWrapHeightLang(ctx, yourCore, textMaxW, 38, lang) + 18;

  // Section 2
  ctx.font = "700 36px 'Playfair Display'";
  h += 36 + 14;
  ctx.font = '400 28px Inter';
  h += measureWrapHeightLang(ctx, mission, textMaxW, 38, lang) + 16;

  // Section 3
  ctx.font = "700 36px 'Playfair Display'";
  h += 36 + 14;
  ctx.font = '400 28px Inter';
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
  ctx.font = "700 52px 'Playfair Display'";
  ctx.fillText(name, W / 2, y);
  y += 52 + 8;

  // Caption
  ctx.font = '400 26px Inter';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  y = wrapTextLang(ctx, caption, W / 2, y, textMaxW, 36, lang) + 16;

  // Core meaning
  ctx.font = "700 40px 'Playfair Display'";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Your Core Meaning' : 'Your Core Meaning', W / 2, y);
  y += 40 + 18;
  ctx.font = '400 28px Inter';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, yourCore, W / 2, y, textMaxW, 38, lang) + 18;

  // Life Mission
  ctx.font = "700 36px 'Playfair Display'";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Life Mission' : 'Life Mission', W / 2, y);
  y += 36 + 14;
  ctx.font = '400 28px Inter';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapTextLang(ctx, mission, W / 2, y, textMaxW, 38, lang) + 16;

  // Personal Year
  ctx.font = "700 36px 'Playfair Display'";
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(lang === 'vi' ? 'Personal Year' : 'Personal Year', W / 2, y);
  y += 36 + 14;
  ctx.font = '400 28px Inter';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  wrapTextLang(ctx, advice, W / 2, y, textMaxW, 38, lang);

  // 6) brand layer at bottom
  const brandMargin = 32;
  const brandH = 90;
  const brandX = brandMargin;
  const brandW = W - brandMargin * 2;
  const brandY = H - brandMargin - brandH;

  // brand background (frosted/glass)
  drawRoundedRect(ctx, brandX, brandY, brandW, brandH, 22);
  const brandGrad = ctx.createLinearGradient(brandX, brandY, brandX, brandY + brandH);
  brandGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  brandGrad.addColorStop(1, 'rgba(6,8,18,0.55)');
  ctx.fillStyle = brandGrad;
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(190,160,255,0.18)';
  ctx.stroke();

  // left: QR code + hint text
  try {
    const qr = await loadImage('image/QRcode.png');
    const qrSize = 72;
    const qrPad = 16;
    const qrX = brandX + qrPad;
    const qrY = brandY + (brandH - qrSize) / 2;
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '500 22px Inter';
    ctx.fillStyle = 'rgba(220,203,122,0.92)'; // pale gold
    ctx.fillText('🔮 Scan to reveal yours', qrX + qrSize + 12, brandY + brandH / 2);
  } catch {}

  // right: logo + powered by
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const rightX = brandX + brandW - 16;
  ctx.font = "700 26px 'Playfair Display'";
  ctx.fillStyle = 'rgba(220,203,122,0.95)';
  ctx.fillText('Soul Map', rightX, brandY + brandH / 2 - 10);
  ctx.font = '500 18px Inter';
  ctx.fillStyle = 'rgba(209,213,219,0.95)'; // soft silver
  ctx.fillText('Inspired by the timeless wisdom of Pythagoras.', rightX, brandY + brandH / 2 + 18);

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