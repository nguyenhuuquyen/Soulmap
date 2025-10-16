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
langEN.addEventListener('click', ()=>setLang('en'));
langVI.addEventListener('click', ()=>setLang('vi'));
function setLang(l){
  currentLang = l;
  langEN.classList.toggle('active', l==='en');
  langVI.classList.toggle('active', l==='vi');
  langEN.setAttribute('aria-pressed', l==='en');
  langVI.setAttribute('aria-pressed', l==='vi');
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
  return { core, interpretation: inter, imageUrl, share, personalYear, personalYearAdvice };
}

function render({ core, interpretation, imageUrl, share, personalYear, personalYearAdvice, fullName }){
  // ảnh
  if (imageUrl){ imgHero.src = imageUrl; }

  // chips
  chipLife.textContent = `Life Path ${core?.life_path ?? ''}`;
  chipExp.textContent  = `Expression ${core?.expression ?? ''}`;
  chipSoul.textContent = `Soul Urge ${core?.soul_urge ?? ''}`;
  chipPers.textContent = `Personality ${core?.personality ?? ''}`;
  chipPYear.textContent = `Personal Year ${personalYear ?? ''}`;

  // blocks
  // Replace Share title with user's full name (hide the word 'Share')
  if (secShare) secShare.textContent = fullName || '';
  txtCaption.textContent   = share?.caption || '';
  txtShareText.textContent = share?.share_text || '';
  txtCore.textContent    = interpretation?.your_core_meaning || '';
  txtMission.textContent = interpretation?.life_mission || '';
  txtPYearAdvice.textContent = personalYearAdvice || '';

  listStr.innerHTML = '';
  (interpretation?.strengths || interpretation?.key_points || []).forEach(s => listStr.appendChild(li(s)));

  listChal.innerHTML = '';
  (interpretation?.challenges || []).forEach(c => listChal.appendChild(li(c)));

  // hiển thị result
  show(resultSec);
}

/* ========== Submit ========== */
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const full_name = inputName.value.trim();
  const yyyy = selYear.value, mm = selMonth.value, dd = selDay.value;
  if (!full_name || !yyyy || !mm || !dd) return alert('Please fill all fields.');

  const dob = `${yyyy}-${mm}-${dd}`;

  try{
    setBusy(true);
    const raw = await callDify(full_name, dob, currentLang);
    const data = normalize(raw);

    lastState = { ...data, fullName: full_name }; // lưu cho share/download
    render({ ...data, fullName: full_name });
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
  // Open modal to choose platform
  if (!imgHero.src){ alert('No image to share yet.'); return; }
  shareModal.classList.remove('hidden');
});

btnDownload.addEventListener('click', async ()=>{
  try{
    if (!imgHero.src){ alert('Chưa có ảnh để tải.'); return; }
    const { blob } = await fetchImageBlob(imgHero.src);
    const blobUrl = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href = blobUrl;
    a.download = 'soulmap.png';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(blobUrl), 2000);
  }catch(e){
    console.error(e);
    // fallback: mở ảnh trong tab mới (mobile có thể long-press để lưu)
    window.open(imgHero.src, '_blank', 'noopener');
  }
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