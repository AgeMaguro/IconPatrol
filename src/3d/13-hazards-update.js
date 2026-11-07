const PK_EDGE = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 3.4, 7));
function makeStream(){
  const C = randInSphere(R*0.45), D = randDir(), L = 1500, A = C.clone().addScaledVector(D, -L/2), N = 34, blocks = [];
  const g = new THREE.Group(), mat = new THREE.LineBasicMaterial({color:0x4dffa0, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false});
  const lane = new THREE.BufferGeometry().setFromPoints([A, A.clone().addScaledVector(D, L)]);
  g.add(new THREE.Line(lane, new THREE.LineBasicMaterial({color:0x22ff88, transparent:true, opacity:0.22})));
  for (let i=0;i<N;i++){ const b = new THREE.LineSegments(PK_EDGE, mat); b.quaternion.setFromUnitVectors(V(0,0,1), D); g.add(b); blocks.push(b); }
  hazGroup.add(g);
  haz.streams.push({g, A, D, L, sp:230, blocks, spacing:L/N, off:Math.random()*L, cd:0});
}
// pop-up mine: a "You've won!" window that arms when you get close, then blows up. Shoot it from range.
let POPUP_TEX = null;
function popupTex(){
  if (POPUP_TEX) return POPUP_TEX;
  const c = document.createElement('canvas'); c.width = 256; c.height = 168; const x = c.getContext('2d');
  x.fillStyle = '#c0c0c0'; x.fillRect(0,0,256,168); x.fillStyle = '#fff'; x.fillRect(0,0,256,3); x.fillRect(0,0,3,168); x.fillStyle = '#404040'; x.fillRect(253,0,3,168); x.fillRect(0,165,256,3);
  const gr = x.createLinearGradient(0,0,256,0); gr.addColorStop(0,'#000080'); gr.addColorStop(1,'#1084d0'); x.fillStyle = gr; x.fillRect(5,5,246,26);
  x.font = 'bold 17px Arial,sans-serif'; x.fillStyle = '#fff'; x.fillText('Congratulations!!', 12, 24);
  x.fillStyle = '#c0c0c0'; x.fillRect(226,9,20,18); x.fillStyle = '#000'; x.font = 'bold 15px Arial'; x.fillText('×', 231, 24);
  x.fillStyle = '#ffd400'; x.beginPath(); x.arc(36, 74, 18, 0, 7); x.fill(); x.fillStyle = '#000'; x.font = 'bold 24px Arial'; x.fillText('!', 31, 83);
  x.font = 'bold 16px Arial,sans-serif'; x.fillText("You've WON a FREE", 66, 66); x.fillText('Pentium III !!!', 66, 88);
  x.fillStyle = '#c0c0c0'; x.fillRect(88,112,80,32); x.strokeStyle = '#000'; x.lineWidth = 2; x.strokeRect(88,112,80,32); x.fillStyle = '#000'; x.font = 'bold 16px Arial'; x.fillText('OK', 116, 134);
  return POPUP_TEX = new THREE.CanvasTexture(c);
}
function makeMine(minD){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:popupTex(), transparent:true, depthWrite:false})); s.scale.set(30, 19.7, 1);
  const base = hazSpot(minD, R*0.85); s.position.copy(base); hazGroup.add(s);
  haz.mines.push({s, base, ph:Math.random()*6, arm:-1, dead:false});
}
function seedHazards(){
  if (hazGroup){ scene.remove(hazGroup); hazGroup.traverse(o => { if (o.geometry && o.geometry !== PK_EDGE) o.geometry.dispose(); }); }
  hazGroup = new THREE.Group(); scene.add(hazGroup);
  haz = {t:0, grids:[], clouds:[], bins:[], streams:[], mines:[], sweep:null, sweepT:35 + Math.random()*20, mineT:0};
  if (G.cur && G.cur.boss) return;
  for (let i=0;i<HZ.grids;i++) makeGrid();
  for (let i=0;i<HZ.clouds;i++) makeCloud();
  for (let i=0;i<HZ.bins;i++) makeBin();   // every sector gets one (was a 70% chance)
  for (let i=0;i<HZ.streams;i++) makeStream();
  for (let i=0;i<HZ.mines;i++) makeMine(220);
}
// defrag sweep: every 45-75 s a huge disc of light crosses the sector near you, carrying everything it touches and lining rocks up in rows
function startSweep(){
  const axis = randDir(), rad = 520, g = new THREE.Group();
  const lat = randDir(); lat.addScaledVector(axis, -lat.dot(axis)).normalize();
  const through = P.pos.clone().addScaledVector(lat, Math.random()*220);
  const mat = new THREE.LineBasicMaterial({color:0x38bdf8, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false});
  g.add(new THREE.LineSegments(gridLines(rad*2, 26), mat));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), new THREE.MeshBasicMaterial({color:0x38bdf8, transparent:true, opacity:0.07, side:THREE.DoubleSide, depthWrite:false}));
  g.add(fill); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(rad, 64)), new THREE.LineBasicMaterial({color:0x9be7ff})));
  g.quaternion.setFromUnitVectors(V(0,0,1), axis);
  const u = V(1,0,0).applyQuaternion(g.quaternion), v = V(0,1,0).applyQuaternion(g.quaternion);
  hazGroup.add(g);
  haz.sweep = {g, mat, axis, u, v, rad, through, s:-1250, sp:150, warn:5, cd:0, told:false, rocks:new Set()};
  toast('DEFRAG SCHEDULED · a sweep crosses the sector in 5 s');
  beep(300,0.2,'square',0.03); setTimeout(()=>beep(300,0.2,'square',0.03),300);
}
function explodeMine(m){
  if (m.dead) return; m.dead = true; hazGroup.remove(m.s);
  const at = m.s.position; burst(at, '#ffd400', 40, 60, 0.8); burst(at, '#ff4444', 20, 40, 0.6); SFX.boom(); rumble(200, 0.6);
  const d = P.alive ? at.distanceTo(P.pos) : 999;
  if (d < 60){ damage(Math.round(32*(1 - d/70))); P.vel.addScaledVector(hzA.copy(P.pos).sub(at).normalize(), 90*(1 - d/70)); }
  for (const k of rocks) if (k.hp > 0 && k.g.position.distanceTo(at) < 40 + k.r) breakRock(k);
}
function hazBullet(b){   // your shots set off pop-up mines
  if (b.enemy) return false;
  for (const m of haz.mines){ if (!m.dead && b.g.position.distanceToSquared(m.s.position) < 15*15){ b.life = 0; addScore(15); msg('POP-UP CLOSED +15', m.s.position, '#ffd400'); explodeMine(m); return true; } }
  return false;
}
function updateHazards(dt){
  haz.t += dt; const T = haz.t;
  P.inCloud = false; P.binPull = 0; P.well = null; P.nearBin = null; P.nearD = 1e9; P.riding = false; P.mineArmed = false; P.inSweep = false;
  // firewall grids
  for (const gr of haz.grids){
    gr.cyc = (gr.cyc + dt) % 5.5; gr.on = gr.cyc < 4; gr.cd -= dt;
    const soon = !gr.on && gr.cyc > 4.9;
    gr.mat.opacity = gr.on ? 0.7 + Math.random()*0.25 : soon ? (Math.random() < 0.5 ? 0.6 : 0.1) : 0.08;
    gr.g.position.copy(gr.base).addScaledVector(gr.n, Math.sin(T*gr.w + gr.ph)*gr.amp);
    if (!P.alive){ gr.side = null; continue; }
    hzA.copy(P.pos).sub(gr.g.position); const z = hzA.dot(gr.n);
    hzA.applyQuaternion(hzQ.copy(gr.g.quaternion).invert());
    const inside = Math.abs(hzA.x) < gr.half && Math.abs(hzA.y) < gr.half, side = z >= 0 ? 1 : -1;
    if (gr.side !== null && side !== gr.side && gr.on && inside){
      P.pos.addScaledVector(gr.n, gr.side*(Math.abs(z) + 2.5));           // the laser sheet stops you on your side
      const vn = P.vel.dot(gr.n); if (vn*gr.side < 0) P.vel.addScaledVector(gr.n, -vn*1.6);
      if (gr.cd <= 0){ gr.cd = 0.5; damage(16); SFX.hit(); burst(P.pos, '#ff3040', 14, 35, 0.5); msg('FIREWALL', null, '#ff5060'); rumble(150, 0.6); }
    } else gr.side = side;
  }
  // corrupted data clouds
  for (const c of haz.clouds){
    c.g.rotation.y += dt*0.15;
    const p = c.geo.attributes.position;
    for (let k=0;k<12;k++){ const i = (Math.random()*p.count)|0; p.setXYZ(i, c.base[i*3] + (Math.random()-.5)*8, c.base[i*3+1] + (Math.random()-.5)*8, c.base[i*3+2] + (Math.random()-.5)*8); }
    p.needsUpdate = true;
    if (P.alive && P.pos.distanceToSquared(c.g.position) < c.r*c.r) P.inCloud = true;
  }
  if (P.inCloud){ TGT = null; MS.tgt = null; MS.t = 0; MS.locked = false; }   // targeting offline inside the static
  // Recycle Bin: pulls in you, rocks, viruses, icons, pickups and the other hazards. Everything it eats adds mass,
  // and the Bin grows: its core and look up to 3.5x, its pull range up to 1.8x.
  for (const b of haz.bins){
    b.spin += dt*0.7; b.rings[0].rotation.z = b.spin; b.rings[1].rotation.z = -b.spin*0.3;
    b.halo.quaternion.copy(camera.quaternion); b.halo.rotateZ(b.spin*0.8);   // the lensed arc always faces you
    b.photon.quaternion.copy(camera.quaternion);
    // no size limit, but each meal adds a little less (square-root growth); left unfed it slowly evaporates
    // (Hawking radiation): after 5 s without eating it loses mass, a bit faster the bigger it is
    b.idle = (b.idle || 0) + dt;
    if (b.idle > 5 && b.mass > 0) b.mass = Math.max(0, b.mass - dt*(0.12 + b.mass*0.004));
    const sq = Math.sqrt(b.mass), gf = 1 + 0.35*sq;   // mass 42 -> 3.3x, 100 -> 4.5x, 400 -> 8x
    b.range = BIN_RANGE*(1 + 0.12*sq); b.core = BIN_CORE*gf; b.horizon = b.core*HORIZON_K;
    { const dd = b.g.position.distanceTo(P.pos); if (dd < b.range*1.6 && (!P.nearBin || dd < P.nearD)){ P.nearBin = b; P.nearD = dd; } }
    b.vis += (BIN_VIS*gf - b.vis)*Math.min(1, dt*2); b.g.scale.setScalar(b.vis);   // grows smoothly
    const pull = (pos, mul) => { hzA.copy(b.g.position).sub(pos); const d = hzA.length(); if (d > b.range || d < 0.1) return -1; hzA.divideScalar(d).multiplyScalar(mul*binAcc(b, d)); return d; };
    // things without their own velocity (or whose AI keeps resetting it) get a separate drift toward the Bin
    const drag = (o, pos, mul) => { const d = pull(pos, mul); if (!o.binV) o.binV = V();
      if (d < 0){ o.binV.multiplyScalar(Math.pow(0.4, dt)); if (o.binV.lengthSq() > 0.01) pos.addScaledVector(o.binV, dt); return -1; }
      o.binV.addScaledVector(hzA, dt); pos.addScaledVector(o.binV, dt); return d; };
    const eat = (pos, mass, color, n) => { b.mass += mass; b.idle = 0; burst(pos, color || '#c084fc', n || 14, 30, 0.6);
      if (Math.floor(b.mass/6) > b.told){ b.told = Math.floor(b.mass/6); msg('THE RECYCLE BIN GROWS', null, '#e9d5ff'); beep(110,0.4,'sawtooth',0.04,60); } };
    if (P.alive){ const d = pull(P.pos, 1);
      if (d >= 0){ P.vel.addScaledVector(hzA, dt); P.binPull = Math.max(P.binPull, 1 - d/b.range); P.well = b; P.wellD = d;
        if (d < b.horizon){   // past the event horizon: every path leads inward, no thrust or boost gets you out
          const n = hzB.copy(P.pos).sub(b.g.position).divideScalar(d || 1), vr = P.vel.dot(n);
          if (vr > 0) P.vel.addScaledVector(n, -vr); P.vel.addScaledVector(n, -60*dt);
        }
        if (d < b.core + 3){
          burst(b.g.position, '#ff9a3d', 60, 80, 1.2); SFX.boom(); rumble(500, 1);
          const out = randDir();
          if (G.cur && G.cur.free){   // free flight does no damage, so the Bin just spits you back out
            P.pos.copy(b.g.position).addScaledVector(out, b.core + 70); P.vel.copy(out).multiplyScalar(150); msg('RECYCLED · restored from the Bin', null, '#ffedd5');
          } else {                    // sectors: the ship is deleted (one life); you respawn safely outside the well
            P.pos.copy(b.g.position).addScaledVector(out, b.range + 150); if (P.pos.length() > R*0.9) P.pos.copy(b.g.position).setLength(R*0.85).negate();   // far side of the sector if the well is huge
            P.vel.set(0,0,0);
            msg('SHIP DELETED · lost to the Recycle Bin', null, '#ff6680'); P.inv = 0; P.pw.firewall = 0; damage(Math.max(0, P.shield) + Math.max(0, P.hull) + 1);
          }
        } } }
    for (const k of rocks){ if (k.hp <= 0) continue; const d = pull(k.g.position, 1); if (d < 0) continue; k.vel.addScaledVector(hzA, dt); if (d < b.core + k.r*0.5){ k.hp = 0; eat(k.g.position, k.r/8, '#d6a35c'); } }
    for (const v of viruses){ if (v.hp <= 0) continue; const d = drag(v, v.g.position, 0.9); if (d < 0) continue;
      if (d < b.core + 6){ v.hp = 0; eat(v.g.position, 1.5, '#e040fb', 20); addScore(10); msg('VIRUS RECYCLED +10', v.g.position, '#e9f'); } }
    for (const ic of icons){ if (ic.dead) continue; const d = pull(ic.g.position, 0.6); if (d < 0) continue; ic.vel.addScaledVector(hzA, dt*3);
      if (d < b.core + 6){ ic.dead = true; eat(ic.g.position, 1, '#c084fc', 24); SFX.del();
        if (!ic.infected) addScore(-25); msg('RECYCLED ' + short(ic.f.name) + (ic.infected ? '' : ' −25'), ic.g.position, '#e9d5ff'); } }
    for (const k of pickups){ const d = pull(k.g.position, 1.2); if (d < 0) continue; k.vel.addScaledVector(hzA, dt*3); if (d < b.core){ k.life = 0; b.mass += 0.1; b.idle = 0; } }
    // other hazards drift in too and get eaten whole
    for (const m of haz.mines){ if (m.dead) continue; const d = drag(m, m.base, 0.8); if (d >= 0 && d < b.core + 8){ m.dead = true; hazGroup.remove(m.s); eat(m.base, 2, '#ffd400', 20); } }
    for (const c of haz.clouds){ if (c.dead) continue; const d = drag(c, c.g.position, 0.35); if (d >= 0) c.g.scale.setScalar(Math.max(0.15, Math.min(1, (d - b.core)/c.r)));   // squeezed as it falls in
      if (d >= 0 && d < b.core + 4){ c.dead = true; hazGroup.remove(c.g); eat(c.g.position, 5, '#e879f9', 40); } }
    for (const gr of haz.grids){ if (gr.dead) continue; const d = drag(gr, gr.base, 0.3); if (d >= 0 && d < b.core + gr.half*0.5){ gr.dead = true; hazGroup.remove(gr.g); eat(gr.base, 5, '#ff3040', 40); } }
  }
  haz.clouds = haz.clouds.filter(c => !c.dead); haz.grids = haz.grids.filter(g => !g.dead);
  // packet streams
  for (const st of haz.streams){
    st.off = (st.off + st.sp*dt) % st.L; st.cd -= dt;
    st.blocks.forEach((m,i) => m.position.copy(st.A).addScaledVector(st.D, (i*st.spacing + st.off) % st.L));
    if (!P.alive) continue;
    hzA.copy(P.pos).sub(st.A); const s = hzA.dot(st.D); if (s < 0 || s > st.L) continue;
    const lat = hzA.addScaledVector(st.D, -s).length(); if (lat > 16) continue;
    const vD = P.vel.dot(st.D);
    if (vD > 15){ P.riding = true; if (vD < st.sp) P.vel.addScaledVector(st.D, Math.min(st.sp - vD, 150*dt)); }
    else if (st.cd <= 0) for (const m of st.blocks){ if (m.position.distanceToSquared(P.pos) < 36){
      st.cd = 0.6; damage(10); SFX.hit(); burst(P.pos, '#4dffa0', 12, 30, 0.4); msg('PACKET HIT', null, '#4dffa0');
      P.vel.addScaledVector(st.D, (st.sp - vD)*0.45); break; } }
  }
  // pop-up mines
  for (const m of haz.mines){
    if (m.dead) continue;
    m.s.position.copy(m.base); m.s.position.y += Math.sin(T*1.3 + m.ph)*3;
    if (m.arm < 0){ if (P.alive && m.s.position.distanceToSquared(P.pos) < 55*55){ m.arm = 0.9; beep(880,0.06,'square',0.04); } }
    else { m.arm -= dt; P.mineArmed = true; const fl = Math.floor(m.arm*12) % 2; m.s.material.color.set(fl ? 0xff4040 : 0xffffff); if (fl && Math.random() < 0.2) beep(1200,0.03,'square',0.03); if (m.arm <= 0) explodeMine(m); }
  }
  haz.mines = haz.mines.filter(m => !m.dead);
  if (!(G.cur && G.cur.boss) && haz.mines.length < HZ.mines){ haz.mineT -= dt; if (haz.mineT <= 0){ haz.mineT = 18; makeMine(500); } }
  // defrag sweep
  if (!(G.cur && G.cur.boss) && hazGroup){
    if (!haz.sweep){ haz.sweepT -= dt; if (haz.sweepT <= 0 && P.alive) startSweep(); }
    const w = haz.sweep;
    if (w){
      if (w.warn > 0){ w.warn -= dt; w.mat.opacity = 0.15 + 0.15*Math.sin(T*10); }
      else { w.s += w.sp*dt; w.mat.opacity = 0.5; }
      w.g.position.copy(w.through).addScaledVector(w.axis, w.s);
      const carry = (pos, vel, isShip) => {
        hzA.copy(pos).sub(w.g.position); const a = hzA.dot(w.axis); if (a < -6 || a > 8) return false;
        if (hzA.addScaledVector(w.axis, -a).length() > w.rad) return false;
        pos.addScaledVector(w.axis, 8 - a);
        const va = vel.dot(w.axis); if (va < w.sp) vel.addScaledVector(w.axis, w.sp - va);
        return true; };
      if (w.warn <= 0){
        if (P.alive && carry(P.pos, P.vel, true)){ P.inSweep = true; w.cd -= dt;
          if (!w.told){ w.told = true; msg('CAUGHT IN DEFRAG', null, '#7dd3fc'); }
          if (w.cd <= 0){ w.cd = 1; damage(6); } }
        for (const k of rocks){ if (k.hp <= 0 || !carry(k.g.position, k.vel)) continue;
          if (!w.rocks.has(k)){ w.rocks.add(k);   // snap into neat rows on the sweep's grid
            hzA.copy(k.g.position).sub(w.g.position); const cu = Math.round(hzA.dot(w.u)/40)*40, cv = Math.round(hzA.dot(w.v)/40)*40;
            k.g.position.copy(w.g.position).addScaledVector(w.u, cu).addScaledVector(w.v, cv).addScaledVector(w.axis, 8); k.vel.copy(w.axis).multiplyScalar(w.sp); k.spin.multiplyScalar(0.2); } }
      }
      if (w.s > 1250){ hazGroup.remove(w.g); w.g.traverse(o => o.geometry && o.geometry.dispose());
        for (const k of w.rocks) if (k.hp > 0) k.vel.copy(randDir()).multiplyScalar(4 + Math.random()*8);
        haz.sweep = null; haz.sweepT = 45 + Math.random()*30; }
    }
  }
}
function drawGravPanel(){
  const b = P.well || P.nearBin; if (!b || !P.alive) return;
  const d = P.well ? P.wellD : P.nearD, outside = d >= b.range, ve = binVesc(b, d), cLight = binVesc(b, b.horizon), spd = P.vel.length(), top = S.top, topB = S.top*REDLINE;
  const inside = d < b.horizon, flash = Math.floor(performance.now()/220) % 2;
  const lvl = outside ? -1 : inside ? 4 : ve > topB ? 3 : ve > top ? 2 : ve > top*0.6 ? 1 : 0;
  const LV = lvl < 0 ? ['NONE','#7dd3fc','outside the well'] : [['LOW','#4ade80','thrust away to leave'],['MODERATE','#facc15','full throttle to escape'],['HIGH','#fb923c','BOOST TO ESCAPE'],['CRITICAL','#f43f5e','escape barely possible'],['EVENT HORIZON','#ff2050','NO ESCAPE']][lvl];
  // above the cockpit SYSTEMS panel in first person, bottom-left corner in chase view
  let pw = 262, ph = 122, x = 16, y;
  if (fpv){ const {nx, nr, dh} = cockpitGeo(); const cph = Math.max(H < 320 ? 40 : 54, Math.min(118, dh - (H < 320 ? 8 : 18))); const cpw = Math.max(120, Math.min(250, W/2 - nr - 36));
    pw = Math.max(cpw, 220); x = nx - nr - 18 - cpw; y = H - cph - (H < 320 ? 4 : 8) - ph - 10; }
  else y = H - ph - (TC.used ? 120 : 16);
  if (x < 4) x = 4;
  hx.save();
  hx.fillStyle = 'rgba(14,4,6,.72)'; hx.fillRect(x, y, pw, ph);
  hx.strokeStyle = lvl >= 3 && flash ? LV[1] : 'rgba(251,146,60,.6)'; hx.lineWidth = lvl >= 3 ? 2 : 1; hx.strokeRect(x, y, pw, ph);
  hx.fillStyle = 'rgba(251,146,60,.16)'; hx.fillRect(x+1, y+1, pw-2, 17);
  hx.font = 'bold 11px Consolas,monospace'; hx.textAlign = 'left'; hx.fillStyle = '#fdba74'; hx.fillText('GRAVITY WELL · RECYCLE BIN', x + 8, y + 13);
  const M = 10 + b.mass, f = '11px Consolas,monospace';
  const row = (txt, yy, col) => { hx.font = f; hx.fillStyle = col || '#fed7aa'; hx.fillText(txt, x + 8, y + yy); };
  row(`M ${M.toFixed(1)} PB   r_s = 2GM/c² = ${Math.round(b.horizon)} m`, 32);
  row(`DIST ${Math.round(d)} m   ${inside ? 'INSIDE HORIZON' : outside ? 'pull ' + Math.round(b.range) + ' m' : 'to horizon ' + Math.round(d - b.horizon) + ' m'}`, 47, inside ? '#ff6680' : null);
  row(`v_esc ${inside ? '> c' : outside ? 0 : Math.round(ve)}   you ${Math.round(spd)}   max ${Math.round(topB)}`, 62, ve > topB || inside ? '#ff8090' : null);
  // threat bar
  const bx = x + 8, by = y + 72, bw = pw - 16 - 54, frac = inside ? 1 : Math.min(1, ve/(topB*1.15));
  hx.fillStyle = 'rgba(60,20,20,.8)'; hx.fillRect(bx, by, bw, 9);
  const gr = hx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#4ade80'); gr.addColorStop(0.45, '#facc15'); gr.addColorStop(0.75, '#fb923c'); gr.addColorStop(1, '#f43f5e');
  hx.fillStyle = gr; hx.fillRect(bx, by, bw*frac, 9);
  [top/(topB*1.15), 1/1.15].forEach(m => { hx.fillStyle = 'rgba(255,255,255,.7)'; hx.fillRect(bx + bw*m - 1, by - 2, 2, 13); });   // throttle-max and boost-max marks
  hx.font = 'bold 12px Consolas,monospace'; hx.fillStyle = lvl >= 3 && !flash ? '#fff' : LV[1];
  hx.fillText(`THREAT ${LV[0]}`, bx, y + 98); hx.font = f; hx.fillStyle = '#fca5a5'; hx.fillText(LV[2], bx, y + 113);
  // little radial map: pull range, horizon, you
  const cx = x + pw - 29, cy = y + 97, rr = 20;
  hx.strokeStyle = 'rgba(251,146,60,.5)'; hx.lineWidth = 1; hx.beginPath(); hx.arc(cx, cy, rr, 0, 7); hx.stroke();
  hx.fillStyle = 'rgba(244,63,94,.35)'; hx.beginPath(); hx.arc(cx, cy, Math.max(2, rr*b.horizon/b.range), 0, 7); hx.fill();
  hx.fillStyle = '#000'; hx.beginPath(); hx.arc(cx, cy, Math.max(1.5, rr*b.core/b.range), 0, 7); hx.fill();
  const sr = rr*Math.min(1, d/b.range); hx.fillStyle = '#5ff'; hx.beginPath(); hx.arc(cx + sr*0.7071, cy - sr*0.7071, 2.6, 0, 7); hx.fill();
  hx.restore();
}
function drawHazHUD(){
  drawGravPanel();
  for (const b of haz.bins){ const p = project(b.g.position); if (!p) continue; const d = Math.round(b.g.position.distanceTo(P.pos));
    if (d < b.range*0.35) continue;
    hx.font = 'bold 12px Consolas,monospace'; hx.textAlign = 'center'; hx.fillStyle = 'rgba(0,6,14,.55)'; const t = `RECYCLE BIN · ${d}m`, tw = hx.measureText(t).width + 12;
    hx.fillRect(p.x - tw/2, p.y - 46, tw, 17); hx.fillStyle = '#fdba74'; hx.fillText(t, p.x, p.y - 33); }
  const lines = [], fl = Math.floor(performance.now()/250) % 2;
  if (P.inCloud){
    for (let i=0;i<7;i++){ hx.fillStyle = Math.random() < 0.5 ? 'rgba(220,60,255,.16)' : 'rgba(60,255,140,.13)'; hx.fillRect(0, Math.random()*H, W, 2 + Math.random()*7); }
    lines.push(['▒ SIGNAL CORRUPTED · targeting offline ▒', fl ? '#e879f9' : '#4ade80']);
  }
  if (P.well && P.wellD < P.well.horizon) lines.push(['⚠ PAST THE EVENT HORIZON · NO ESCAPE', fl ? '#ff2050' : '#fff']);
  else if (P.binPull > 0.3) lines.push([P.binPull > 0.75 ? '⚠ RECYCLE BIN · BOOST TO ESCAPE' : '⚠ RECYCLE BIN GRAVITY', fl ? '#fb923c' : '#ffedd5']);
  if (haz.sweep && haz.sweep.warn > 0) lines.push([`⚠ DEFRAG SWEEP INCOMING · ${Math.ceil(haz.sweep.warn)}`, fl ? '#38bdf8' : '#e0f2fe']);
  else if (P.inSweep) lines.push(['DEFRAG SWEEP · move aside or ride it', '#7dd3fc']);
  if (P.riding) lines.push(['PACKET STREAM ▶▶ speed boost', '#4dffa0']);
  if (P.mineArmed) lines.push(['⚠ POP-UP ARMED', fl ? '#ff4040' : '#ffd400']);
  hx.font = 'bold 15px Consolas,monospace'; hx.textAlign = 'center';
  lines.forEach(([txt, col], i) => { hx.fillStyle = 'rgba(0,6,14,.6)'; const w = hx.measureText(txt).width + 18; hx.fillRect(W/2 - w/2, H*0.2 + i*24 - 15, w, 21); hx.fillStyle = col; hx.fillText(txt, W/2, H*0.2 + i*24); });
}

