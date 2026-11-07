// ---------- collected-icons feed (left side) ----------
let feed = [];
function feedAdd(img, name, file){
  const e = {img, name, t:0, life:4.5, real:false}; feed.unshift(e);
  while (feed.length > 5) feedDrop(feed.pop());
  if (!file) return;
  makeThumb(file).then(c => { if (c){ e.img = c; e.real = true; } }).catch(()=>{});
}
function drawFinalVideo(g, w, h){
  const f = feed.find(x => x.final); if (!f) return;
  if (f.ft === undefined) f.ft = 0; f.ft += 1/60;
  const live = f.video && f.video.readyState >= 2 && f.video.videoWidth, src = live ? f.video : f.img;
  const iw = (live ? f.video.videoWidth : f.img.width) || 16, ih = (live ? f.video.videoHeight : f.img.height) || 9;
  const grow = Math.min(1, f.ft/0.35), ease = 1 - Math.pow(1 - grow, 3), fade = Math.min(1, f.life/0.6);
  const k = Math.min(w*0.75/iw, h*0.75/ih) * (0.6 + 0.4*ease), dw = iw*k, dh = ih*k, x = (w - dw)/2, y = (h - dh)/2 - h*0.02;
  g.save(); g.globalAlpha = fade;
  g.fillStyle = `rgba(2,4,12,${0.55*ease})`; g.fillRect(0, 0, w, h);
  g.shadowColor = '#4ade80'; g.shadowBlur = 30; g.fillStyle = '#000'; g.fillRect(x, y, dw, dh); g.shadowBlur = 0;
  try { g.drawImage(src, x, y, dw, dh); } catch(_){}
  g.strokeStyle = 'rgba(74,222,128,.85)'; g.lineWidth = 2; g.strokeRect(x, y, dw, dh);
  const fs = Math.max(12, Math.min(20, Math.round(h*0.025)));
  g.textAlign = 'left'; g.font = `bold ${fs}px Consolas,monospace`; g.fillStyle = '#4ade80';
  g.fillText('▶ NOW PLAYING  ' + f.name, x, y - fs*0.6);
  g.textAlign = 'right'; g.fillStyle = '#fbbf24'; g.fillText('♪ ' + Math.ceil(f.life) + 's  ·  ' + (typeof TC !== 'undefined' && TC.used ? 'tap MAP to skip' : 'Esc to skip'), x + dw, y + dh + fs*1.4);
  if (live){ g.fillStyle = 'rgba(255,60,80,.9)'; g.beginPath(); g.arc(x + 14, y + 14, 6, 0, 7); g.fill(); }
  // progress bar
  const total = f.total || (f.total = f.life + f.t), pr = Math.max(0, Math.min(1, 1 - f.life/Math.max(1, total - (f.t0 || 0))));
  g.fillStyle = 'rgba(74,222,128,.25)'; g.fillRect(x, y + dh + 4, dw, 4); g.fillStyle = '#4ade80'; g.fillRect(x, y + dh + 4, dw*pr, 4);
  g.restore();
}
function feedDrop(e){ if (e && e.video){ try { e.video.pause(); e.video.removeAttribute('src'); e.video.load(); } catch(_){} URL.revokeObjectURL(e.url); e.video = null; } }
function feedClear(){ feed.forEach(feedDrop); feed = []; }
// real preview of the file itself (photo, video frame, or first lines of text); null if there's nothing to show
const TEXTY = /^(txt|md|log|csv|json|xml|html?|css|js|ts|py|c|cpp|h|cs|java|ini|cfg|ya?ml|bat|ps1|sh|lua|kt|gradle|rtf)$/;
function makeThumb(file){
  const ext = extOf(file.name), cat = (EXT2CAT[ext] || OTHER).k;
  const box = (w, h) => { const c = document.createElement('canvas'); const k = Math.min(1, 320/Math.max(w, h)); c.width = Math.max(1, Math.round(w*k)); c.height = Math.max(1, Math.round(h*k)); return c; };
  if (cat === 'image' && window.createImageBitmap && file.size < 40e6){
    return createImageBitmap(file).then(b => { const c = box(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close && b.close(); return c; });
  }
  if (cat === 'video' && file.size < 2e9){
    return new Promise(res => {
      const v = document.createElement('video'), url = URL.createObjectURL(file); let done = false;
      const finish = c => { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute('src'); res(c); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(1.5, (v.duration || 3)/3); } catch(_){ finish(null); } };
      v.onseeked = () => { try { const c = box(v.videoWidth || 320, v.videoHeight || 180); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); finish(c); } catch(_){ finish(null); } };
      v.onerror = () => finish(null); setTimeout(() => finish(null), 4000);
    });
  }
  if (TEXTY.test(ext) && file.size < 50e6){
    return file.slice(0, 3000).text().then(txt => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d');
      g.fillStyle = '#0b1424'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#a5f3fc'; g.font = '13px Consolas,monospace';
      const lines = txt.replace(/\r/g, '').replace(/\t/g, '  ').split('\n').slice(0, 19);
      lines.forEach((ln, i) => g.fillText(ln.slice(0, 36), 10, 22 + i*15));
      return c;
    });
  }
  return Promise.resolve(null);
}
function feedTick(dt){ for (const f of feed){ f.t += dt; f.life -= dt; if (f.life <= 0) feedDrop(f); } feed = feed.filter(f => f.life > 0); }
function drawFeed(g, x0, y0, size, maxBottom){
  let y = y0;
  for (const f of feed){
    if (f.final) continue;
    const a = Math.min(1, f.life/1.0) * Math.min(1, f.t/0.2);        // quick fade-in, 1s fade-out
    const slide = (1 - Math.min(1, f.t/0.25)) * -40;
    const cw = size + 12 + Math.max(110, Math.min(200, size*0.95)), ch = size + 10;
    if (y + ch > maxBottom) break;
    g.save(); g.globalAlpha = a; g.translate(x0 + slide, y);
    g.fillStyle = 'rgba(4,22,40,.6)'; g.strokeStyle = 'rgba(74,222,128,.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(6,0); g.lineTo(cw-6,0); g.quadraticCurveTo(cw,0,cw,6); g.lineTo(cw,ch-6); g.quadraticCurveTo(cw,ch,cw-6,ch); g.lineTo(6,ch); g.quadraticCurveTo(0,ch,0,ch-6); g.lineTo(0,6); g.quadraticCurveTo(0,0,6,0); g.closePath(); g.fill(); g.stroke();
    { // fit the preview inside the square, keeping its proportions
      const live = f.video && f.video.readyState >= 2 && f.video.videoWidth;
      const src = live ? f.video : f.img, real = live || f.real;
      const iw = (live ? f.video.videoWidth : f.img.width) || size, ih = (live ? f.video.videoHeight : f.img.height) || size, k = Math.min(size/iw, size/ih), dw = iw*k, dh = ih*k;
      g.shadowColor = '#4ade80'; g.shadowBlur = 10;
      if (real){ g.fillStyle = '#000'; g.fillRect(5 + (size-dw)/2, 5 + (size-dh)/2, dw, dh); }
      try { g.drawImage(src, 5 + (size-dw)/2, 5 + (size-dh)/2, dw, dh); } catch(_){}
      g.shadowBlur = 0;
      if (real){ g.strokeStyle = 'rgba(74,222,128,.7)'; g.strokeRect(5 + (size-dw)/2, 5 + (size-dh)/2, dw, dh); }
      if (live){ g.fillStyle = 'rgba(255,60,80,.9)'; g.beginPath(); g.arc(5 + (size-dw)/2 + 10, 5 + (size-dh)/2 + 10, 4, 0, 7); g.fill(); }
    }
    g.textAlign = 'left'; g.fillStyle = '#4ade80'; g.font = `bold ${Math.max(9, Math.min(17, Math.round(size*0.17)))}px Consolas,monospace`;
    g.fillText('RESCUED', size + 12, 5 + Math.min(size*0.32, 26));
    g.fillStyle = '#cfeaff'; g.font = `${Math.max(9, Math.min(15, Math.round(size*0.17)))}px Consolas,monospace`;
    let nm = f.name; const mw = cw - size - 18; while (nm.length > 4 && g.measureText(nm).width > mw) nm = nm.slice(0, -2) + '…';
    g.fillText(nm, size + 12, 5 + Math.min(size*0.62, 48));
    if (f.final){ g.fillStyle = '#fbbf24'; g.fillText('♪ ' + Math.ceil(f.life) + 's · Esc to skip', size + 12, 5 + Math.min(size*0.9, 68)); }
    else { g.fillStyle = '#7ab'; g.fillText('+100', size + 12, 5 + Math.min(size*0.9, 68)); }
    g.restore();
    y += ch + 6;
  }
}
