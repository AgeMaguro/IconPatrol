const _t = V(), _t2 = V(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
let aimHit = false, aimDist = 320, _bankRate = 0; const _zAx = new THREE.Vector3(0,0,1); const _wUp = new THREE.Vector3(0,1,0), _wq = new THREE.Quaternion();
const CK = {x:0, y:0, r:0}, _rate = V();
const LOCK_ANG = () => TC.used ? 0.17 : 0.11, NEAR_ANG = 0.42;
let TGT = null, wasLocked = false; const _apV = V();
const gateSm = {coast:null, ghost:null}; let hudDt = 0.016;
function forecast(thr, brk){
  const pp = _pp.copy(P.pos), pv = _pv.copy(P.vel), pq = _pq.copy(P.q), st = 0.1;
  const dq = _pdq.setFromEuler(_pe.set(P.rate.x*st, P.rate.y*st, P.rate.z*st, 'XYZ'));
  const out = [];
  for (let i=1;i<=15;i++){
    pq.multiply(dq); if (_bankRate) pq.premultiply(_wq.setFromAxisAngle(_wUp, _bankRate*st)); _pf.set(0,0,-1).applyQuaternion(pq);
    if (thr > 0.01) pv.addScaledVector(_pf, S.top*0.7*thr*st);
    if (brk > 0.05) pv.multiplyScalar(Math.pow(0.08, st*brk));
    pv.multiplyScalar(Math.pow(0.5, st));
    if (flightMode === 'assist'){ const s3 = pv.length(); if (s3 > 1) pv.lerp(_pc.copy(_pf).multiplyScalar(s3), 1 - Math.exp(-st*2.2)); }
    const top = S.top*Math.max(1, thr), spd = pv.length();
    if (spd > top) pv.multiplyScalar(Math.max(top, spd - 220*st)/spd);
    pp.addScaledVector(pv, st);
    if (i % 5 === 0){
      const vd = _pc.copy(pv).normalize(); _pu.set(0,1,0).applyQuaternion(pq);
      _pr.crossVectors(vd, _pu); if (_pr.lengthSq() < 1e-4) _pr.set(1,0,0).applyQuaternion(pq); _pr.normalize();
      _pu.crossVectors(_pr, vd).normalize();
      out.push({p:pp.clone(), r:_pr.clone(), u:_pu.clone()});
    }
  }
  return out;
}
function smoothGates(prev, next, k){
  if (!prev) return next;
  for (let i=0;i<next.length;i++){ prev[i].p.lerp(next[i].p, k); prev[i].r.lerp(next[i].r, k).normalize(); prev[i].u.lerp(next[i].u, k).normalize(); }
  return prev;
}
function drawGates(gates, isGhost, fade, ap, use){
  for (let g = gates.length-1; g >= 0; g--){
    const G2 = gates[g], hw = 7, hh = 4.5, corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
    const pts = [];
    for (const [cx, cy] of corners){ const sp = project(_pc.copy(G2.p).addScaledVector(G2.r, cx*hw).addScaledVector(G2.u, cy*hh)); if (!sp){ pts.length = 0; break; } pts.push(sp); }
    if (pts.length !== 4) continue;
    let a = [0.75, 0.52, 0.34][g] * fade * (isGhost ? 0.5 : 1);
    if (hudMode === 'clean'){
      // (1) fade out near the crosshair, (5) only while turning/drifting
      const mx = (pts[0].x+pts[1].x+pts[2].x+pts[3].x)/4, my = (pts[0].y+pts[1].y+pts[2].y+pts[3].y)/4;
      const near = ap ? Math.max(0, Math.min(1, (Math.hypot(mx - ap.x, my - ap.y) - 14)/40)) : 1;
      a *= use * (0.3 + 0.7*near);
    }
    if (a < 0.02) continue;
    const col = isGhost ? `rgba(160,225,255,${a})` : `rgba(190,255,150,${a})`;
    // (2) corner brackets only, no full box
    hx.strokeStyle = col; hx.lineWidth = isGhost ? 1.2 : (g === 0 ? 2.2 : 1.7); hx.beginPath();
    const k = isGhost ? 0.16 : 0.24;
    for (let q=0;q<4;q++){ const c = pts[q], nx2 = pts[(q+1)%4], pv2 = pts[(q+3)%4];
      hx.moveTo(c.x + (nx2.x-c.x)*k, c.y + (nx2.y-c.y)*k); hx.lineTo(c.x, c.y); hx.lineTo(c.x + (pv2.x-c.x)*k, c.y + (pv2.y-c.y)*k); }
    hx.stroke();
    if (!isGhost && g === 0 && hudMode === 'full'){ const w = Math.abs(pts[1].x - pts[0].x); if (w > 40){ hx.fillStyle = col; hx.font = '9px Consolas,monospace'; hx.textAlign = 'center'; hx.fillText('0.5s', (pts[2].x+pts[3].x)/2, Math.max(pts[2].y, pts[3].y) + 11); } }
  }
}
const _pp = V(), _pv = V(), _pf = V(), _pr = V(), _pu = V(), _pc = V(), _pq = new THREE.Quaternion(), _pdq = new THREE.Quaternion(), _pe = new THREE.Euler();
if (window.__IPDEBUG) window.__ip = { startBoss:()=>startBoss(), boss:()=>boss, aim:()=>({TGT, aimHit}), icons:()=>icons, S:()=>S, mouse:()=>mouse, G:()=>G, P:()=>P, viruses:()=>viruses, bullets:()=>bullets, rocks:()=>rocks, haz:()=>haz, startSweep, makeBin, seedHazards, binVesc, spawnVirus, damage, MS:()=>MS, missiles:()=>missiles, pickups:()=>pickups, V, fwd:()=>fwd, right:()=>right, up:()=>up };
function scanTarget(){
  // nearest hostile by angle from the nose: 'near' inside a wide cone, 'locked' inside the firing cone
  let best = null, bestAng = NEAR_ANG;
  const consider = (pos, vel, label) => {
    _t.copy(pos).sub(P.pos); const d = _t.length(); if (d > 650 || d < 5) return;
    const tt = d/520; _t2.copy(pos).addScaledVector(vel, tt).addScaledVector(P.vel, -tt).sub(P.pos);
    // aiming at the target OR at its lead point both count as on target
    const ang = Math.min(_t.divideScalar(d).angleTo(fwd), _t2.lengthSq() > 1 ? _t2.angleTo(fwd) : 9);
    if (ang < bestAng){ bestAng = ang; best = {pos, vel, d, ang, label}; }
  };
  for (const v of viruses) consider(v.g.position, v.vel, v.label || 'VIRUS');
  for (const ic of icons) if (ic.infected) consider(ic.g.position, ic.vel, short(ic.f.name));
  if (boss) consider(boss.g.position, boss.vel, 'INNER DEMON');
  if (best) best.locked = best.ang < LOCK_ANG();
  TGT = best;
  const locked = !!(best && best.locked);
  if (locked && !wasLocked){ beep(1320,0.06,'square',0.03); setTimeout(()=>beep(1760,0.07,'square',0.03),55); }
  wasLocked = locked;
}
const _muz = V(), _aimPt = V();
function aimDir(origin, baseDir){
  // gentle aim assist toward hostile targets inside a narrow cone
  let best = null, bestAng = LOCK_ANG();
  const consider = (pos, vel) => {
    _t.copy(pos).sub(origin); const d = _t.length(); if (d > 650 || d < 5) return;
    const tt = d/520; _t2.copy(pos).addScaledVector(vel, tt).addScaledVector(P.vel, -tt).sub(origin);
    const ang = Math.min(_t.divideScalar(d).angleTo(baseDir), _t2.lengthSq() > 1 ? _t2.angleTo(baseDir) : 9);
    if (ang < bestAng){ bestAng = ang; best = {pos, vel, d}; }
  };
  for (const v of viruses) consider(v.g.position, v.vel);
  for (const ic of icons) if (ic.infected) consider(ic.g.position, ic.vel);
  if (boss) consider(boss.g.position, boss.vel);
  aimHit = !!best; aimDist = best ? best.d : 320;
  if (!best) return baseDir.clone();
  // aim toward the lead marker (target motion minus your drift, since shots carry your velocity), but only
  // part of the way, by the ship's auto-aim accuracy, plus a little scatter that shrinks as accuracy rises
  const acc = shipDef().aim || 0.6, tt = best.d / 520;
  const lead = _t2.copy(best.pos).addScaledVector(best.vel, tt).addScaledVector(P.vel, -tt).sub(origin).normalize();
  const dir = baseDir.clone().lerp(lead, acc).normalize();
  return dir.addScaledVector(randDir(), (1 - acc)*0.025).normalize();
}

