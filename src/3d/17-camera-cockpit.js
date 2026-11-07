// ---------- camera ----------
const camOff = V(0, 3.8, 21), fpOff = V(0, 0.8, -2), _camTarget = V();
function updateCamera(dt){
  if (!P) return;
  {
    // cockpit sway: dashboard lags opposite to the turn, scaled by turn speed
    const k = Math.min(1, dt*8), sc = Math.min(1.4, Math.max(0.6, H/650));
    const shake = P.boosting ? (Math.random()-0.5)*2.2 : 0;
    const tx = P.alive ? Math.max(-48, Math.min(48, P.rate.y*26))*sc + shake : 0;
    const ty = P.alive ? Math.max(-30, Math.min(30, P.rate.x*16))*sc + shake*0.6 : 0;
    // tilt follows the turn (reversed in 1.0.22: it used to lean the other way)
    const tr = P.alive ? Math.max(-0.16, Math.min(0.16, P.rate.z*0.018 - (P.visBank || 0)*0.14)) : 0;
    CK.x += (tx - CK.x)*k; CK.y += (ty - CK.y)*k; CK.r += (tr - CK.r)*k;
  }
  if (fpv){
    camera.position.copy(fpOff).applyQuaternion(P.q).add(P.pos);
    camera.quaternion.copy(P.q);
  } else {
    const k = 1 - Math.exp(-dt*9);
    _camTarget.copy(camOff).applyQuaternion(P.q).add(P.pos);
    camera.position.lerp(_camTarget, k);
    camera.quaternion.slerp(P.q, 1 - Math.exp(-dt*11));
  }
  const targetFov = fpv ? (P.boosting ? 92 : 80) : (P.boosting ? 84 : 72);
  if (Math.abs(camera.fov - targetFov) > 0.1){ camera.fov += (targetFov - camera.fov)*Math.min(1, dt*5); camera.updateProjectionMatrix(); }
}

// ---------- HUD ----------
let NB = 190; // navball size (px)
function project(pos){
  _t.copy(pos).applyMatrix4(camera.matrixWorldInverse);
  if (_t.z > -1) return null;
  _t.copy(pos).project(camera);
  return {x:(_t.x+1)/2*W, y:(1-_t.y)/2*H};
}
function bracket(x, y, s, color, label){
  hx.strokeStyle = color; hx.lineWidth = 1.5; hx.beginPath();
  const c = s*0.35;
  hx.moveTo(x-s, y-s+c); hx.lineTo(x-s, y-s); hx.lineTo(x-s+c, y-s);
  hx.moveTo(x+s-c, y-s); hx.lineTo(x+s, y-s); hx.lineTo(x+s, y-s+c);
  hx.moveTo(x+s, y+s-c); hx.lineTo(x+s, y+s); hx.lineTo(x+s-c, y+s);
  hx.moveTo(x-s+c, y+s); hx.lineTo(x-s, y+s); hx.lineTo(x-s, y+s-c);
  hx.stroke();
  if (label){ hx.fillStyle = color; hx.font = '11px Consolas,monospace'; hx.textAlign = 'center'; hx.fillText(label, x, y+s+13); }
}
// ---------- first-person cockpit ----------
function cockpitGeo(){
  const nx = W/2 + CK.x, ny = H - NB/2 - (H > 360 ? 14 : 6) + CK.y, nr = NB/2*0.9 + 6;
  const dh = H < 320 ? Math.max(44, NB*0.62 + 10) : Math.max(64, Math.min(150, NB*0.72 + 26));
  return {nx, ny, nr, dh};
}
function rrect(x, y, w, h, r){ hx.beginPath(); hx.moveTo(x+r,y); hx.arcTo(x+w,y,x+w,y+h,r); hx.arcTo(x+w,y+h,x,y+h,r); hx.arcTo(x,y+h,x,y,r); hx.arcTo(x,y,x+w,y,r); hx.closePath(); }
function drawCockpitFrame(t){
  const {nx, ny, nr, dh} = cockpitGeo(), top = H - dh + CK.y;
  // canopy struts and top arch (move half as much as the dash)
  hx.save(); hx.translate(CK.x*0.5, CK.y*0.5); hx.translate(W/2, H/2); hx.rotate(CK.r*0.6); hx.translate(-W/2, -H/2);
  hx.strokeStyle = 'rgba(90,240,255,.20)'; hx.lineWidth = 3; hx.beginPath();
  hx.moveTo(0, H*0.12); hx.quadraticCurveTo(W*0.06, H*0.02, W*0.22, 0);
  hx.moveTo(W, H*0.12); hx.quadraticCurveTo(W*0.94, H*0.02, W*0.78, 0);
  hx.moveTo(0, H*0.12); hx.lineTo(W*0.07, top + dh*0.1);
  hx.moveTo(W, H*0.12); hx.lineTo(W*0.93, top + dh*0.1);
  hx.stroke();
  hx.strokeStyle = 'rgba(90,240,255,.08)'; hx.lineWidth = 1; hx.beginPath(); hx.moveTo(W*0.22, 0); hx.quadraticCurveTo(W/2, H*0.05, W*0.78, 0); hx.stroke();
  hx.restore();
  // dashboard with a cutout so the navball shows through (sways with turns; pivots on the navball)
  hx.save(); hx.translate(nx, ny); hx.rotate(CK.r); hx.translate(-nx, -ny);
  const ox = CK.x, ext = 70;
  hx.beginPath();
  hx.moveTo(-ext, H+ext); hx.lineTo(-ext, top + dh*0.42); hx.lineTo(W*0.14 + ox, top); hx.lineTo(W*0.86 + ox, top); hx.lineTo(W+ext, top + dh*0.42); hx.lineTo(W+ext, H+ext); hx.closePath();
  hx.moveTo(nx + nr, ny); hx.arc(nx, ny, nr, 0, Math.PI*2, true);
  const g = hx.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(10,40,64,.30)'); g.addColorStop(1, 'rgba(4,14,26,.55)');
  hx.fillStyle = g; hx.fill('evenodd');
  hx.strokeStyle = 'rgba(90,240,255,.35)'; hx.lineWidth = 1.5; hx.beginPath();
  hx.moveTo(-ext, top + dh*0.42); hx.lineTo(W*0.14 + ox, top); hx.lineTo(nx - nr - 10, top); hx.moveTo(nx + nr + 10, top); hx.lineTo(W*0.86 + ox, top); hx.lineTo(W+ext, top + dh*0.42); hx.stroke();
  // little status lights along the dash edge
  for (let i=0;i<6;i++){
    const on = (Math.floor(t*(1.3+i*0.37)) + i) % 3 !== 0;
    const lx = W*0.17 + ox + i*10, rx = W*0.83 + ox - i*10;
    hx.fillStyle = on ? ['#5ff','#4ade80','#fbbf24'][i%3] : 'rgba(90,140,160,.3)';
    hx.fillRect(lx, top + 5, 5, 3); hx.fillRect(rx - 5, top + 5, 5, 3);
  }
  hx.restore();
}
function drawCockpitPanels(t){
  const {nx, ny, nr, dh} = cockpitGeo();
  const ph = Math.max(H < 320 ? 40 : 54, Math.min(118, dh - (H < 320 ? 8 : 18))), y = H - ph - (H < 320 ? 4 : 8) + CK.y;
  const pw = Math.max(120, Math.min(250, W/2 - nr - 36));
  hx.save(); hx.translate(nx, ny); hx.rotate(CK.r); hx.translate(-nx, -ny);
  const fs = ph < 80 ? 9 : 11, lh = fs + (ph < 80 ? 3 : 6), pad = ph < 80 ? 6 : 10;
  const panel = (x, title, rows) => {
    rrect(x, y, pw, ph, 6); hx.fillStyle = 'rgba(4,22,40,.45)'; hx.fill();
    hx.strokeStyle = 'rgba(90,240,255,.45)'; hx.lineWidth = 1; hx.stroke();
    hx.fillStyle = 'rgba(90,240,255,.12)'; hx.fillRect(x+1, y+1, pw-2, lh+2);
    hx.font = `bold ${fs}px Consolas,monospace`; hx.textAlign = 'left'; hx.fillStyle = '#7ff'; hx.fillText(title, x + pad, y + lh - 1);
    for (let i=0;i<3;i++){ hx.fillStyle = (Math.floor(t*2 + i) % 3) ? 'rgba(90,240,255,.25)' : '#5ff'; hx.beginPath(); hx.arc(x + pw - pad - i*8, y + lh/2 + 1, 2, 0, 7); hx.fill(); }
    let ry = y + lh*2 + 4;
    for (const r of rows){ if (ry > y + ph - 3) break; r(x + pad, ry, pw - pad*2); ry += lh + 2; }
  };
  const bar = (label, frac, color, extra) => (x, yy, w) => {
    hx.font = `${fs}px Consolas,monospace`; hx.fillStyle = '#8bd'; hx.textAlign = 'left'; hx.fillText(label, x, yy);
    const bx = x + fs*4.2, bwid = w - fs*4.2 - (extra ? fs*3.6 : 0);
    hx.fillStyle = 'rgba(20,50,70,.8)'; hx.fillRect(bx, yy - fs*0.7, bwid, fs*0.6);
    hx.fillStyle = color; hx.fillRect(bx, yy - fs*0.7, bwid*Math.max(0, Math.min(1, frac)), fs*0.6);
    if (extra){ hx.fillStyle = '#bff'; hx.textAlign = 'right'; hx.fillText(extra, x + w, yy); }
  };
  const text = (str, color='#9cd') => (x, yy, w) => { hx.font = `${fs}px Consolas,monospace`; hx.fillStyle = color; hx.textAlign = 'left';
    let s2 = str; while (s2.length > 3 && hx.measureText(s2).width > w) s2 = '…' + s2.slice(2); hx.fillText(s2, x, yy); };
  const sh = Math.max(0, P.shield)/S.maxShield;
  const pwList = [['spread','WIDE'],['rapid','RAPID'],['firewall','FW']].filter(([k]) => P.pw[k] > 0).map(([k,l]) => `${l} ${Math.ceil(P.pw[k])}s`).join(' ');
  // two half-width bars on one row
  const bar2 = (l1, f1, c1, l2, f2, c2) => (x, yy, w) => {
    const half = (w - fs)/2;
    for (const [l, f, c, ox] of [[l1, f1, c1, 0], [l2, f2, c2, half + fs]]){
      hx.font = `${fs}px Consolas,monospace`; hx.fillStyle = '#8bd'; hx.textAlign = 'left'; hx.fillText(l, x + ox, yy);
      const bx = x + ox + fs*2.9, bwid = half - fs*2.9;
      hx.fillStyle = 'rgba(20,50,70,.8)'; hx.fillRect(bx, yy - fs*0.7, bwid, fs*0.6);
      hx.fillStyle = c; hx.fillRect(bx, yy - fs*0.7, bwid*Math.max(0, Math.min(1, f)), fs*0.6);
    }
  };
  const hl = Math.max(0, P.hull)/S.maxHull, fu = P.fuel/S.maxFuel, inf = INF();
  const warn = hl < 0.3 ? '⚠ HULL CRITICAL' : (!inf && P.fuel <= 0) ? '⚠ FUEL EMPTY · IMPULSE' : (!inf && P.ammo <= 0) ? '⚠ AMMO EMPTY' : sh < 0.25 ? '⚠ SHIELD LOW' : '';
  const status = warn ? (Math.floor(t*4)%2 ? warn : '') : pwList || (inf ? '∞ INFINITE RESOURCES' : 'ALL SYSTEMS NOMINAL');
  panel(nx - nr - 18 - pw, 'SYSTEMS', [
    bar2('SHD', sh, P.pw.firewall > 0 ? '#c084fc' : sh > 0.5 ? '#5ff' : sh > 0.25 ? '#fc4' : '#f45', 'HUL', hl, hl > 0.5 ? '#a3e635' : hl > 0.3 ? '#fc4' : '#f45'),
    bar2('FUE', inf ? 1 : fu, fu > 0.25 || inf ? '#22d3ee' : '#f45', 'BST', P.boost/S.tank, P.boosting ? '#fff' : '#fbbf24'),
    text((inf ? 'AMMO ∞  MSL ∞' : `AMMO ${P.ammo}  MSL ${P.msl}`) + '  ▲' + Math.max(0, G.lives) + '  ◆' + G.bits, !inf && (P.ammo <= 0 || P.ammo < S.maxAmmo*0.15) ? '#fc4' : '#9ff'),
    text(status, warn ? '#f67' : pwList ? '#fde68a' : '#4ade80'),
  ]);
  if (TC.used){ hx.restore(); return; } // touch buttons own the right side on phones
  const spd = P.vel.length(), edge = Math.max(0, Math.round(R - P.pos.length()));
  const tv = Math.max(throttle, effThr);
  panel(nx + nr + 18, 'NAV', [
    bar('THR', leverFrac(tv), tv > 1.001 ? '#ff5577' : '#5ff', Math.round(tv*100) + '%'),
    bar('SPD', spd/(S.top*REDLINE), P.boosting ? '#fff' : '#9cf', Math.round(spd) + ''),
    text(G.cur.boss ? `DEMON ${Math.ceil(boss ? boss.hp/boss.max*100 : 0)}%  VIRUS ${viruses.length}` : (G.cur.free ? `TARGETS ${viruses.length}  FREE FLIGHT` : `ICONS ${icons.length}  VIRUS ${viruses.length}  Q ${queue.length}`), '#9cd'),
    text(`EDGE ${edge}m  RADAR ${S.radar}m`, edge < 60 ? '#fc4' : '#7ab'),
    text('FLT ' + FLIGHT_NAME[flightMode].toUpperCase() + ' · ' + G.cur.path),
  ]);
  hx.restore();
}

