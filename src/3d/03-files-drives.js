// ---------- file categories & icon textures ----------
const CATS = [
  {k:'image', c:'#4ade80', e:'png jpg jpeg gif bmp webp svg ico tif tiff heic psd'},
  {k:'audio', c:'#f472b6', e:'mp3 wav ogg flac m4a wma mid midi aac m3u'},
  {k:'video', c:'#a78bfa', e:'mp4 mkv avi mov wmv webm flv mpg'},
  {k:'doc',   c:'#60a5fa', e:'txt md doc docx pdf rtf odt xls xlsx csv ppt pptx log'},
  {k:'code',  c:'#facc15', e:'js ts py c cpp h cs java html htm css json xml bat ps1 sh lua ini cfg yml yaml kt gradle'},
  {k:'exe',   c:'#fb923c', e:'exe dll msi com sys apk jar drv lnk'},
  {k:'arch',  c:'#94a3b8', e:'zip rar 7z tar gz iso cab'},
];
const EXT2CAT = {}; CATS.forEach(c => c.e.split(' ').forEach(x => EXT2CAT[x] = c));
const OTHER = {k:'other', c:'#67e8f9'};
function extOf(n){ const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i+1).toLowerCase() : ''; }
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function makeIcon(f, onUpdate){
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cat = EXT2CAT[f.ext] || OTHER;
  g.scale(S/96, S/96);
  g.fillStyle = '#e8f1ff';
  g.beginPath(); g.moveTo(18,6); g.lineTo(62,6); g.lineTo(80,24); g.lineTo(80,90); g.lineTo(18,90); g.closePath(); g.fill();
  g.fillStyle = '#b9c8e0'; g.beginPath(); g.moveTo(62,6); g.lineTo(62,24); g.lineTo(80,24); g.closePath(); g.fill();
  g.fillStyle = cat.c; g.fillRect(18,58,62,22);
  if (cat.k === 'exe'){ g.fillStyle='#1e293b'; rr(g,28,22,40,28,3); g.fill(); g.fillStyle=cat.c; g.fillRect(28,22,40,7); }
  else if (cat.k === 'audio'){ g.fillStyle='#1e293b'; g.beginPath(); g.arc(40,46,7,0,7); g.fill(); g.fillRect(45,20,4,27); g.fillRect(45,20,14,5); }
  else if (cat.k === 'image'){ g.fillStyle='#bfe3ff'; g.fillRect(26,20,46,32); g.fillStyle='#22a35a'; g.beginPath(); g.moveTo(26,52); g.lineTo(42,32); g.lineTo(54,46); g.lineTo(62,38); g.lineTo(72,52); g.fill(); g.fillStyle='#ffd34d'; g.beginPath(); g.arc(62,28,5,0,7); g.fill(); }
  else if (cat.k === 'video'){ g.fillStyle='#1e293b'; g.fillRect(26,22,46,30); g.fillStyle=cat.c; g.beginPath(); g.moveTo(43,29); g.lineTo(57,37); g.lineTo(43,45); g.fill(); }
  else if (cat.k === 'arch'){ g.fillStyle='#64748b'; for(let y=12;y<56;y+=8){ g.fillRect(44,y,5,4); g.fillRect(49,y+4,5,4);} }
  else { g.fillStyle='#9fb0c8'; for(let y=22;y<54;y+=7) g.fillRect(26,y,(y%14?44:34),3); }
  g.fillStyle = '#06101f'; g.font = 'bold 15px Consolas,monospace'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText((f.ext||'file').slice(0,4).toUpperCase(), 49, 70);
  if (cat.k === 'image' && f.file && f.file.size < 12e6 && window.createImageBitmap){
    createImageBitmap(f.file).then(b => {
      const s = Math.min(b.width, b.height);
      g.save(); g.beginPath(); g.rect(22,10,54,46); g.clip();
      g.drawImage(b, (b.width-s)/2, (b.height-s)/2, s, s, 22, 10, 54, 54);
      g.restore(); b.close && b.close(); onUpdate && onUpdate();
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
function buildDemo(){ return Object.entries(DEMO).map(([path, s]) => ({path, cleared:false, files: s.split(' ').map(n => ({name:n, ext:extOf(n)}))})); }
function buildFromFiles(list){
  const appPaths = Array.isArray(window.__appPaths) && window.__appPaths.length === list.length ? window.__appPaths : null; window.__appPaths = null;
  if (list.length && !appPaths && !list.some(f => f.webkitRelativePath)) return buildFromPicked(list);
  const dirs = new Map();
  for (let fi = 0; fi < list.length; fi++){
    const file = list[fi];
    const parts = (file.webkitRelativePath || (appPaths && appPaths[fi]) || file.name).split('/');
    if (parts.some(p => p.startsWith('.') || p === 'node_modules' || p === '__pycache__')) continue;
    const dir = parts.slice(0,-1).join('\\') || '(root)';
    if (!dirs.has(dir)) dirs.set(dir, []);
    const arr = dirs.get(dir); if (arr.length < 24) arr.push({name:file.name, ext:extOf(file.name), file});
  }
  let secs = [...dirs.entries()].map(([path, files]) => ({path, files, cleared:false}));
  secs.sort((a,b)=>a.path.localeCompare(b.path));
  if (secs.length > 36) secs = secs.sort((a,b)=>b.files.length-a.files.length).slice(0,36).sort((a,b)=>a.path.localeCompare(b.path));
  return secs;
}

