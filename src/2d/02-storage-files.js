// ---------- storage ----------
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
let hiScore = +(lsGet('iconpatrol.hi')||0);
function showHi(){ document.getElementById('hiNote').textContent = hiScore ? 'High score: ' + hiScore : ''; }
showHi();

// ---------- audio ----------
let actx = null, muted = lsGet('iconpatrol.muted') === '1';
function beep(f, dur=0.08, type='square', vol=0.05, slide=0){
  if (muted) return;
  try {
    if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide), t+dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+dur);
  } catch(e){}
}
const SFX = {
  shoot:()=>beep(880,0.05,'square',0.025,-400),
  capture:()=>{beep(660,0.07,'triangle',0.06);setTimeout(()=>beep(990,0.09,'triangle',0.06),60);},
  cleanse:()=>beep(520,0.12,'sine',0.07,500),
  hit:()=>beep(200,0.05,'sawtooth',0.04),
  boom:()=>beep(120,0.35,'sawtooth',0.08,-90),
  hurt:()=>beep(90,0.2,'square',0.07,-40),
  infect:()=>beep(300,0.18,'sawtooth',0.04,-200),
  del:()=>beep(160,0.25,'triangle',0.06,-100),
  wave:()=>{[440,554,659,880].forEach((f,i)=>setTimeout(()=>beep(f,0.1,'triangle',0.05),i*90));},
};

// ---------- file categories & icons ----------
const CATS = [
  {k:'image', c:'#4ade80', e:'png jpg jpeg gif bmp webp svg ico tif tiff heic psd'},
  {k:'audio', c:'#f472b6', e:'mp3 wav ogg flac m4a wma mid midi aac m3u'},
  {k:'video', c:'#a78bfa', e:'mp4 mkv avi mov wmv webm flv mpg'},
  {k:'doc',   c:'#60a5fa', e:'txt md doc docx pdf rtf odt xls xlsx csv ppt pptx log'},
  {k:'code',  c:'#facc15', e:'js ts py c cpp h cs java html htm css json xml bat ps1 sh lua ini cfg yml yaml kt gradle'},
  {k:'exe',   c:'#fb923c', e:'exe dll msi com sys apk jar drv lnk'},
  {k:'arch',  c:'#94a3b8', e:'zip rar 7z tar gz iso cab'},
];
const EXT2CAT = {};
CATS.forEach(c => c.e.split(' ').forEach(x => EXT2CAT[x] = c));
const OTHER = {k:'other', c:'#67e8f9'};
function extOf(n){ const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i+1).toLowerCase() : ''; }

function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

function makeIcon(f){
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cat = EXT2CAT[f.ext] || OTHER;
  // page with folded corner
  g.fillStyle = '#e8f1ff';
  g.beginPath(); g.moveTo(18,6); g.lineTo(62,6); g.lineTo(80,24); g.lineTo(80,90); g.lineTo(18,90); g.closePath(); g.fill();
  g.fillStyle = '#b9c8e0'; g.beginPath(); g.moveTo(62,6); g.lineTo(62,24); g.lineTo(80,24); g.closePath(); g.fill();
  g.fillStyle = cat.c; g.fillRect(18,58,62,22);
  if (cat.k === 'exe'){ // little window glyph
    g.fillStyle='#1e293b'; rr(g,28,22,40,28,3); g.fill(); g.fillStyle=cat.c; g.fillRect(28,22,40,7);
  } else if (cat.k === 'audio'){
    g.fillStyle='#1e293b'; g.beginPath(); g.arc(40,46,7,0,7); g.fill(); g.fillRect(45,20,4,27); g.fillRect(45,20,14,5);
  } else if (cat.k === 'image'){
    g.fillStyle='#bfe3ff'; g.fillRect(26,20,46,32); g.fillStyle='#22a35a'; g.beginPath(); g.moveTo(26,52); g.lineTo(42,32); g.lineTo(54,46); g.lineTo(62,38); g.lineTo(72,52); g.fill(); g.fillStyle='#ffd34d'; g.beginPath(); g.arc(62,28,5,0,7); g.fill();
  } else if (cat.k === 'video'){
    g.fillStyle='#1e293b'; g.fillRect(26,22,46,30); g.fillStyle=cat.c; g.beginPath(); g.moveTo(43,29); g.lineTo(57,37); g.lineTo(43,45); g.fill();
  } else if (cat.k === 'arch'){
    g.fillStyle='#64748b'; for(let y=12;y<56;y+=8){ g.fillRect(44,y,5,4); g.fillRect(49,y+4,5,4);}
  } else {
    g.fillStyle='#9fb0c8'; for(let y=22;y<54;y+=7) g.fillRect(26,y,(y%14?44:34),3);
  }
  g.fillStyle = '#06101f'; g.font = 'bold 15px Consolas,monospace'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText((f.ext||'file').slice(0,4).toUpperCase(), 49, 70);
  // real thumbnail for small images
  if (cat.k === 'image' && f.file && f.file.size < 12e6 && window.createImageBitmap){
    createImageBitmap(f.file).then(b => {
      const s = Math.min(b.width, b.height);
      g.save(); g.beginPath(); g.rect(22,10,54,46); g.clip();
      g.drawImage(b, (b.width-s)/2, (b.height-s)/2, s, s, 22, 10, 54, 54);
      g.restore(); b.close && b.close();
    }).catch(()=>{});
  }
  return c;
}

// ---------- drives ----------
const DEMO = {
  'C:\\WINDOWS': 'explorer.exe notepad.exe calc.exe sol.exe winmine.exe win.ini system.ini clouds.bmp tada.wav chimes.wav setup.log',
  'C:\\WINDOWS\\SYSTEM': 'user.dll gdi.dll kernel32.dll shell32.dll vga.drv mouse.drv comdlg32.dll',
  'C:\\My Documents': 'resume.doc budget.xls vacation.jpg dog.jpg letter.txt homework.doc mixtape.mp3 notes.txt grandma.jpg',
  'C:\\GAMES': 'doom.exe doom.wad skifree.exe pinball.exe savegame.sav highscores.dat',
  'C:\\Program Files\\WinAmp': 'winamp.exe skin.zip playlist.m3u plugin.dll llama.wav',
  'C:\\Program Files\\Paint': 'mspaint.exe brushes.dll palette.cfg sunset.bmp',
  'C:\\Downloads': 'setup.exe drivers.zip funny.gif movie.avi patch.rar readme.txt song.mp3 screensaver.exe',
};
function buildDemo(){
  return Object.entries(DEMO).map(([path, s]) => ({path, cleared:false, files: s.split(' ').map(n => ({name:n, ext:extOf(n)}))}));
}
function buildFromFiles(list){
  const appPaths = Array.isArray(window.__appPaths) && window.__appPaths.length === list.length ? window.__appPaths : null; window.__appPaths = null;
  if (list.length && !appPaths && !list.some(f => f.webkitRelativePath)) return buildFromPicked(list);
  const dirs = new Map();
  for (let fi = 0; fi < list.length; fi++){
    const file = list[fi];
    const rel = file.webkitRelativePath || (appPaths && appPaths[fi]) || file.name;
    const parts = rel.split('/');
    if (parts.some(p => p.startsWith('.') || p === 'node_modules' || p === '__pycache__')) continue;
    const dir = parts.slice(0,-1).join('\\') || '(root)';
    if (!dirs.has(dir)) dirs.set(dir, []);
    const arr = dirs.get(dir);
    if (arr.length < 24) arr.push({name:file.name, ext:extOf(file.name), file});
  }
  let secs = [...dirs.entries()].map(([path, files]) => ({path, files, cleared:false}));
  secs.sort((a,b)=>a.path.localeCompare(b.path));
  if (secs.length > 36){ // keep a spread of the biggest folders
    secs = secs.sort((a,b)=>b.files.length-a.files.length).slice(0,36).sort((a,b)=>a.path.localeCompare(b.path));
  }
  return secs;
}

