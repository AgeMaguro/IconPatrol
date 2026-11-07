
// ---------- enemy ships: nine AI types that fight back (3D only, 2026-11-06) ----------
// Every enemy is an entry in `viruses` with ai:true and a `kind`, so shots, missiles, lock-on, radar, the Recycle Bin and
// the sector-clear sweep already handle them. Per-frame behaviour: updateEnemyAI() (called from 16-update.js), spawning:
// enemyDirector(). TUNING: EN_DEF (types), EN_GUN (guns), enemyScale() (difficulty). To scale difficulty later, make
// enemyLevel() return something other than 0 (e.g. from G.cleared); everything reads enemyScale().
const eA = V(), eB = V(), eC = V(), eD = V(), eObj = new THREE.Object3D();
function enemyLevel(){ return 0; }   // 0 = gentle start. Later: e.g. G.cleared*0.5 or a Settings difficulty.
function enemyScale(){
  const L = enemyLevel();
  return {hp:1 + 0.15*L, dmg:1 + 0.1*L, err:Math.max(0.25, 1 - 0.1*L), fire:1 + 0.12*L, spd:1 + 0.05*L, budget:1 + 0.12*L, rate:1 + 0.1*L};
}
// "heat" decides which types have joined the fight (Gentle mode); All types = everything from the start (for testing)
function enemyHeat(){ return enemyMode === 'all' ? 99 : G.cleared*1.5 + Math.max(0, waveNo - 1)*0.5; }

// heat: unlock level · cost: threat points to spawn the whole group · unit: threat points per living ship · max: ships of this kind at once
// w: spawn weight · pts/bits/pk: kill reward · fx: effect colour · nb: navball blip colour
const EN_DEF = {
  worm:    {name:'WORM FIGHTER', heat:0,   cost:1,   unit:1,    max:2, w:5, pts:60,  bits:2, pk:0.15, fx:'#ff6a3d', nb:0xff6a3d},
  trojan:  {name:'TROJAN',       heat:0.5, cost:0.8, unit:0.8,  max:2, w:3, pts:40,  bits:2, pk:0.15, fx:'#ff5533', nb:0xff5533},
  bot:     {name:'BOT',          heat:1,   cost:1.3, unit:0.26, max:8, w:3, pts:15,  bits:1, pk:0.03, fx:'#44ffcc', nb:0x44ffcc},
  lancer:  {name:'LANCER',       heat:1.5, cost:1.5, unit:1.5,  max:1, w:3, pts:90,  bits:3, pk:0.2,  fx:'#ff55cc', nb:0xff55cc},
  carrier: {name:'ADWARE CARRIER', heat:2, cost:2.2, unit:2.2,  max:1, w:2, pts:200, bits:5, pk:0.5,  fx:'#ffcc22', nb:0xffcc22},
  sniper:  {name:'SNIPER',       heat:2.5, cost:1.5, unit:1.5,  max:1, w:3, pts:100, bits:3, pk:0.25, fx:'#ffaa33', nb:0xffaa33},
  rootkit: {name:'ROOTKIT',      heat:3,   cost:1.5, unit:1.5,  max:1, w:3, pts:120, bits:3, pk:0.25, fx:'#9966ff', nb:0x9966ff},
  defender:{name:'DEFENDER',     heat:3.5, cost:1,   unit:1,    max:1, w:3, pts:80,  bits:3, pk:0.2,  fx:'#33ccff', nb:0x33ccff},
  wing:    {name:'WINGMAN',      heat:4,   cost:2,   unit:1,    max:2, w:3, pts:70,  bits:2, pk:0.15, fx:'#ffaa22', nb:0xffaa22},
  popup:   {name:'POPUP',        heat:99,  cost:0,   unit:0,    max:99, w:0, pts:10, bits:0, pk:0,    fx:'#c0c0c0', nb:0xc0c0c0},
};
// guns: n shots per burst, gap between them, cd = [min,max] seconds between bursts, sp = shot speed, dmg = shield damage,
// err = aim error, lead = how much of the player's motion it leads, cone = how closely the nose must point at you, range
const EN_GUN = {
  worm:    {n:3, gap:0.22, cd:[3.0, 4.4], sp:170, dmg:6, err:0.035, lead:0.6,  cone:0.5, range:480},
  wing:    {n:2, gap:0.20, cd:[2.2, 3.2], sp:175, dmg:5, err:0.035, lead:0.65, cone:0.5, range:480},
  defender:{n:1, gap:0.10, cd:[3.0, 4.2], sp:150, dmg:5, err:0.05, lead:0.5,  cone:0.6, range:260},
  rootkit: {n:2, gap:0.28, cd:[9, 9],     sp:190, dmg:7, err:0.03, lead:0.7,  cone:9,   range:600},
};
const EN_SNIPE_G = new THREE.CylinderGeometry(0.9, 0.9, 12, 6); EN_SNIPE_G.rotateX(Math.PI/2);
const EN_SNIPE_M = basic(0xffaa33);
let enFlock = 0;

// ---------- helpers ----------
function enTint(g, hue, sat){
  g.traverse(o => { if (o.material){ o.material = o.material.clone(); const lum = o.material.color.getHSL({}).l; o.material.color.setHSL(hue, sat, Math.max(0.12, Math.min(0.62, lum))); } });
}
function enWire(g, geo, fill, line){ g.add(new THREE.Mesh(geo, basic(fill))); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(line))); }
function enLine(g, color){   // a thin beam out of the nose (local -z); scale.z sets its length
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,-1], 3));
  const l = new THREE.LineSegments(geo, lineMat(color)); l.visible = false; l.frustumCulled = false; g.add(l); return l;
}
function enMake(kind, g, at, o){
  const sc = enemyScale(), D = EN_DEF[kind];
  const v = Object.assign({g, vel:V(), ai:true, kind, hp:1, r:10, r2:100, spin:V(), t:0, state:'new', st:0, fireT:2 + Math.random()*2, burst:0, burstT:0,
    dist:999, label:D.name, col:D.fx, nb:D.nb, hidden:false, sd:Math.random() < 0.5 ? -1 : 1, axis:randDir(), jinkCd:0, sp:60}, o);
  v.hp = Math.max(1, Math.round(v.hp*sc.hp)); v.max = v.hp;
  g.position.copy(at); scene.add(g); viruses.push(v); return v;
}
function enemyCount(kind){ let n = 0; for (const v of viruses) if (v.ai && v.kind === kind && v.hp > 0) n++; return n; }
function enNose(v){ return eD.set(0, 0, -1).applyQuaternion(v.g.quaternion).clone(); }
function enFace(v, dir, dt, rate){   // turn the nose (-z) toward dir, smoothly
  eObj.position.copy(v.g.position); eObj.up.set(0, 1, 0);
  eObj.lookAt(eD.copy(v.g.position).sub(dir));
  v.g.quaternion.slerp(eObj.quaternion, 1 - Math.exp(-rate*dt));
}
function enSeek(v, dest, speed, turn, dt){
  eA.copy(dest).sub(v.g.position); const d = eA.length(); if (d > 0.01) eA.multiplyScalar(speed/d);
  v.vel.lerp(eA, Math.min(1, turn*dt)); return d;
}
// a point on a ring round the player, a bit further along the ring than the ship is now (so it circles)
function enOrbit(v, radius, sd){
  eA.copy(v.g.position).sub(P.pos).normalize();
  eB.crossVectors(eA, v.axis); if (eB.lengthSq() < 0.01) eB.crossVectors(eA, eD.set(0, 1, 0));
  eB.normalize();
  return eC.copy(eA).addScaledVector(eB, sd*0.55).normalize().multiplyScalar(radius).add(P.pos);
}
function enMove(v, dt, free){   // stay clear of rocks and the Recycle Bin, stay inside the arena, then move
  if (!free){
    for (const k of rocks){ if (k.hp <= 0) continue; eA.copy(v.g.position).sub(k.g.position); const d = eA.length(), lim = k.r + 40; if (d < lim && d > 0.1) v.vel.addScaledVector(eA.divideScalar(d), (1 - d/lim)*160*dt); }
    for (const b of haz.bins){ eA.copy(v.g.position).sub(b.g.position); const d = eA.length(), lim = b.range*0.55; if (d < lim && d > 0.1) v.vel.addScaledVector(eA.divideScalar(d), (1 - d/lim)*220*dt); }
  }
  softWall(v.g.position, v.vel);
  v.g.position.addScaledVector(v.vel, dt);
}
// direction from `from` to the player, leading the player's motion by `lead`, plus random error
function enAim(from, sp, lead, err){
  const t = P.pos.distanceTo(from)/sp;
  return eC.copy(P.pos).addScaledVector(P.vel, t*lead).sub(from).normalize().addScaledVector(randDir(), err).normalize();
}
function enShot(from, dir, sp, dmg, o = {}){
  const d = dir.clone().normalize(), m = new THREE.Mesh(o.big ? EN_SNIPE_G : BG_E, o.mat || BM_E);
  m.position.copy(from); if (o.big) m.lookAt(from.clone().add(d)); scene.add(m);
  bullets.push({g:m, vel:d.multiplyScalar(sp), life:o.life || 5, enemy:true, dmg, hr2:o.hr2 || 36});   // hr2 = hit radius² vs the player (default 6 units)
}
function enShoot(v, sc, g){
  const from = v.g.position.clone().addScaledVector(enNose(v), 8);
  enShot(from, enAim(from, g.sp, g.lead, g.err*sc.err), g.sp, g.dmg*sc.dmg);
  if (v.dist < 520) beep(520 + Math.random()*80, 0.05, 'square', 0.012, -200);
}
// burst gun: only starts a burst when in range and the nose is on the player
function enGun(v, dt, sc, g, canFire){
  v.fireT -= dt;
  if (v.burst > 0){
    v.burstT -= dt;
    if (v.burstT <= 0 && P.alive){ v.burstT = g.gap; v.burst--; enShoot(v, sc, g); }
    return;
  }
  if (v.fireT <= 0 && canFire && P.alive){ v.burst = g.n; v.burstT = 0; v.fireT = (g.cd[0] + Math.random()*(g.cd[1] - g.cd[0]))/(sc.fire*(v.enraged ? 1.4 : 1)); }
}
const enOnTarget = (v, dirP, cone) => enNose(v).angleTo(dirP) < cone;

// ---------- ship models ----------
function meshShip(id, hue, sat, glow){ const g = buildShipMesh(id); enTint(g, hue, sat); g.add(glowSprite(glow, 26, 0.35)); return g; }
function meshSniper(){
  const g = new THREE.Group(); enWire(g, new THREE.BoxGeometry(2.4, 2.4, 26), 0x2a1400, 0xffaa33);
  const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(6, 0.7, 4, 12)), lineMat(0xffcc66)); g.add(ring);
  g.add(glowSprite(0xffaa33, 24, 0.4)); return g;
}
function meshLancer(){
  const g = new THREE.Group(), cone = new THREE.ConeGeometry(5, 28, 4); cone.rotateX(-Math.PI/2); enWire(g, cone, 0x300820, 0xff55cc);
  const bl = new THREE.BoxGeometry(14, 0.6, 6); bl.translate(0, 0, 6); enWire(g, bl, 0x300820, 0xff88dd);
  const glow = glowSprite(0xff44cc, 34, 0.5); g.add(glow); g.userData.glow = glow; return g;
}
function meshBot(){ const g = new THREE.Group(), core = new THREE.Group(); enWire(core, new THREE.OctahedronGeometry(3.4), 0x102a2a, 0x44ffcc); g.add(core); g.add(glowSprite(0x33ffcc, 14, 0.5)); g.userData.core = core; return g; }
function meshCarrier(){
  const g = new THREE.Group(); enWire(g, new THREE.BoxGeometry(26, 11, 42), 0x2a2208, 0xffcc22);
  for (const sx of [-1, 1]){ const pod = new THREE.BoxGeometry(7, 7, 24); pod.translate(sx*18, 0, 4); enWire(g, pod, 0x2a2208, 0xffaa11); }
  g.add(glowSprite(0xffbb00, 80, 0.4)); return g;
}
function meshPopup(){
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), basic(0xffffff, {map:popupTex(), side:THREE.DoubleSide})));
  g.add(glowSprite(0xff3322, 24, 0.35)); return g;
}
const enFakeIcon = () => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#e8eef5'; x.beginPath(); x.moveTo(28, 10); x.lineTo(78, 10); x.lineTo(100, 32); x.lineTo(100, 118); x.lineTo(28, 118); x.closePath(); x.fill();
  x.fillStyle = '#b7c4d4'; x.beginPath(); x.moveTo(78, 10); x.lineTo(78, 32); x.lineTo(100, 32); x.closePath(); x.fill();
  x.fillStyle = '#6b7f99'; for (let i = 0; i < 5; i++) x.fillRect(38, 48 + i*12, 52 - (i % 2)*14, 5);
  return new THREE.CanvasTexture(c);
};

// ---------- spawning ----------
function enemySpawnPoint(kind){
  if (kind === 'trojan'){
    const clean = icons.filter(i => !i.infected && !i.dead && !i.held);
    if (clean.length){ const a = clean[Math.floor(Math.random()*clean.length)]; return a.g.position.clone().add(randDir().multiplyScalar(70 + Math.random()*60)); }
  }
  const lo = kind === 'carrier' ? 650 : kind === 'sniper' ? 600 : 480;
  for (let i = 0; i < 24; i++){
    const p = P.pos.clone().add(randDir().multiplyScalar(lo + Math.random()*180));
    if (p.length() > R*0.88) continue;
    let ok = true; for (const b of haz.bins) if (b.g.position.distanceTo(p) < b.range*1.1) ok = false;
    if (ok) return p;
  }
  return randInSphere(R*0.5);
}
function spawnEnemy(kind, at){
  at = at ? at.clone() : enemySpawnPoint(kind);
  const out = [];
  switch (kind){
    case 'worm': out.push(enMake('worm', meshShip('fighter', 0.02, 0.9, 0xff5533), at, {hp:3, sp:64, stand:240, gun:EN_GUN.worm})); break;
    case 'wing': {
      const a = enMake('wing', meshShip('racer', 0.09, 0.95, 0xffaa22), at, {hp:3, sp:74, stand:220, gun:EN_GUN.wing, role:'lead'});
      const b = enMake('wing', meshShip('racer', 0.09, 0.95, 0xffaa22), at.clone().add(randDir().multiplyScalar(40)), {hp:3, sp:74, stand:220, gun:EN_GUN.wing, role:'flank', fireT:1.8});
      a.partner = b; b.partner = a; out.push(a, b); break;
    }
    case 'bot': {
      const fl = ++enFlock;
      for (let i = 0; i < 6; i++) out.push(enMake('bot', meshBot(), at.clone().add(randDir().multiplyScalar(30)), {hp:1, sp:80, r:7, r2:49, fl, fireT:2 + Math.random()*4}));
      break;
    }
    case 'lancer': out.push(enMake('lancer', meshLancer(), at, {hp:4, sp:62, r:12, r2:144})); out[0].line = enLine(out[0].g, 0xff55cc); break;
    case 'sniper': out.push(enMake('sniper', meshSniper(), at, {hp:3, sp:55})); out[0].line = enLine(out[0].g, 0xff4422); break;
    case 'carrier': out.push(enMake('carrier', meshCarrier(), at, {hp:12, sp:24, r:22, r2:484, fireT:3})); break;
    case 'rootkit': {
      const g = meshShip('patrol', 0.76, 0.6, 0x9966ff), v = enMake('rootkit', g, at, {hp:3, sp:72, cloak:1, gun:EN_GUN.rootkit, shim:0, mats:[]});
      g.traverse(o => { const m = o.material; if (m){ m.transparent = true; v.mats.push([m, m.opacity]); } });
      v.hidden = true; out.push(v); break;
    }
    case 'defender': out.push(enMake('defender', meshShip('bulwark', 0.52, 0.8, 0x33ccff), at, {hp:5, sp:66, gun:EN_GUN.defender, r:12, r2:144})); break;
    case 'trojan': {
      const src = icons.filter(i => !i.infected && !i.dead && !i.held)[0], tex = src ? src.tex : enFakeIcon();
      const g = new THREE.Group(), disg = new THREE.Group();
      disg.add(glowSprite(0x4ade80, 46, 0.35));
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, alphaTest:0.05})); spr.scale.set(24, 24, 1); disg.add(spr);
      const shell = new THREE.Group(); enWire(shell, new THREE.OctahedronGeometry(9), 0x3a0810, 0xff3355); shell.add(glowSprite(0xff2244, 40, 0.6)); shell.visible = false;
      g.add(disg); g.add(shell);
      const v = enMake('trojan', g, at, {hp:2, sp:95, disg, shell, disguised:true, hidden:true, fname:src ? src.f.name : 'notes.txt', life:14, bob:Math.random()*6, r:12, r2:196});
      v.vel.copy(randDir()).multiplyScalar(4 + Math.random()*8); out.push(v); break;
    }
  }
  return out;
}
function spawnPopup(owner){
  const p = enMake('popup', meshPopup(), owner.g.position, {hp:1, sp:70, r:9, r2:100, owner, life:16});
  p.vel.copy(randDir()).multiplyScalar(40); burst(p.g.position, '#c0c0c0', 10, 30, 0.4); beep(700, 0.08, 'square', 0.02, 300);
}
function enemyDirector(dt){
  for (const ic of icons) if (ic.held && ic.held.hp <= 0) ic.held = null;   // thief gone: the icon is free again
  if (enemyMode === 'off' || G.state !== 'play' || !G.cur || G.cur.free || G.cur.boss || !P.alive || G.cur._finish || !icons.length) return;
  enT += dt; if (enT < enNext) return;
  const sc = enemyScale(), heat = enemyHeat(), all = enemyMode === 'all';
  enNext = enT + (all ? 5 : 9 + Math.random()*5)/sc.rate;
  const budget = (all ? 6 : 1.5 + 0.5*Math.min(heat, 6))*sc.budget;
  let used = 0; for (const v of viruses) if (v.ai && v.hp > 0) used += EN_DEF[v.kind].unit;
  const room = budget - used; if (room < 0.8) return;
  const opts = []; let tot = 0;
  for (const k in EN_DEF){ const d = EN_DEF[k]; if (!d.cost || heat < d.heat || d.cost > room + 0.01 || enemyCount(k) + (k === 'bot' ? 6 : k === 'wing' ? 2 : 1) > d.max) continue; opts.push(k); tot += d.w; }
  if (!opts.length) return;
  let r = Math.random()*tot, pick = opts[0]; for (const k of opts){ r -= EN_DEF[k].w; if (r <= 0){ pick = k; break; } }
  spawnEnemy(pick);
  if (pick !== 'trojan'){ msg(EN_DEF[pick].name + ' INBOUND', null, '#fa5'); beep(240, 0.25, 'sawtooth', 0.03, 200); }
}

// ---------- behaviours ----------
const EN_UPDATE = {};
function updateEnemyAI(v, dt){
  const sc = enemyScale();
  v.t += dt; v.dist = v.g.position.distanceTo(P.pos);
  if (!P.alive && v.kind !== 'defender' && v.kind !== 'carrier'){ v.vel.multiplyScalar(Math.pow(0.5, dt)); enMove(v, dt); return; }
  EN_UPDATE[v.kind](v, dt, sc);
}

// Worm Fighter + Wingmen: approach, then circle at standoff range and fire bursts; jinks when you lock a missile on it
// and breaks off to recover once at 1 HP. Wingmen: one circles, the other swings round behind you; they fire out of step,
// and the survivor gets angrier when its partner dies.
EN_UPDATE.worm = EN_UPDATE.wing = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1);
  const locked = MS.locked && MS.tgt && MS.tgt.obj === v, sp = v.sp*sc.spd*(v.enraged ? 1.15 : 1);
  v.st -= dt; v.jinkCd -= dt;
  if (v.state === 'new'){ v.state = 'approach'; }
  if (v.state === 'approach'){
    enSeek(v, enOrbit(v, v.stand, v.sd), sp, 1.4, dt);
    enFace(v, v.vel.lengthSq() > 1 ? v.vel.clone().normalize() : dirP, dt, 3);
    if (d < v.stand*1.25){ v.state = 'strafe'; v.st = 3 + Math.random()*3; }
  } else if (v.state === 'strafe'){
    const dest = v.role === 'flank' ? P.pos.clone().addScaledVector(fwd, -v.stand*0.9).addScaledVector(right, v.sd*70).addScaledVector(up, 25) : enOrbit(v, v.stand, v.sd).clone();
    enSeek(v, dest, sp, 1.7, dt); enFace(v, dirP, dt, 4);
    if (v.st <= 0){ v.sd = -v.sd; v.st = 3 + Math.random()*3; }
    enGun(v, dt, sc, v.gun, d < v.gun.range && enOnTarget(v, dirP, v.gun.cone));
    if (locked && v.jinkCd <= 0){ v.state = 'jink'; v.st = 1.0; v.jdir = new THREE.Vector3().crossVectors(dirP, randDir()).normalize(); }
    else if (v.hp <= 1 && !v.fled && v.kind === 'worm'){ v.state = 'retreat'; v.st = 5; v.fled = true; }
  } else if (v.state === 'jink'){
    v.vel.lerp(v.jdir.clone().multiplyScalar(sp*2.2), Math.min(1, 4*dt)); enFace(v, dirP, dt, 4);
    if (v.st <= 0){ v.state = 'strafe'; v.st = 2; v.jinkCd = 4; }
  } else if (v.state === 'retreat'){
    enSeek(v, P.pos.clone().addScaledVector(dirP, -700), sp*1.1, 1.5, dt); enFace(v, v.vel.clone().normalize(), dt, 3);
    if (v.st <= 0) v.state = 'approach';
  }
  enMove(v, dt);
};

// Trojan: sits among the icons looking like one (same picture and name as a real file). Flips into a bomb when you get
// close, shoot it, or after a while; then it rushes you and blows up on contact.
EN_UPDATE.trojan = function(v, dt, sc){
  if (v.disguised){
    v.bob += dt; v.g.position.addScaledVector(v.vel, dt); softWall(v.g.position, v.vel);
    if (v.hp < v.max || v.dist < 95 || v.t > 45){
      v.disguised = false; v.hidden = false; v.disg.visible = false; v.shell.visible = true; v.state = 'rush'; v.t = 0;
      burst(v.g.position, '#ff5533', 24, 50, 0.6); beep(520, 0.3, 'sawtooth', 0.05, -400); msg('TROJAN!', v.g.position, '#f55'); toast('TROJAN · it was a bomb');
    }
    return;
  }
  enSeek(v, P.pos, v.sp*sc.spd, 3.2, dt); enFace(v, v.vel.clone().normalize(), dt, 6); v.shell.rotation.z += dt*6; v.shell.rotation.x += dt*3;
  if (v.dist < 17 || v.t > v.life){
    if (P.alive && v.dist < 24){ damage(14*sc.dmg); P.vel.add(P.pos.clone().sub(v.g.position).normalize().multiplyScalar(60)); }
    burst(v.g.position, '#ff5533', 40, 70, 0.8); SFX.boom(); v.hp = 0; return;
  }
  enMove(v, dt);
};

// Botnet drone: boids flocking (stay together, don't collide) around you; weak popgun, and they pop on contact for a little damage
EN_UPDATE.bot = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1), sp = v.sp*sc.spd;
  const coh = V(), ali = V(), sep = V(); let n = 0;
  for (const o of viruses){
    if (o === v || o.kind !== 'bot' || o.fl !== v.fl || o.hp <= 0) continue;
    const dd = o.g.position.distanceTo(v.g.position); if (dd > 150) continue;
    n++; coh.add(o.g.position); ali.add(o.vel);
    if (dd < 26) sep.addScaledVector(v.g.position.clone().sub(o.g.position), 1/Math.max(dd, 1));
  }
  const goal = enOrbit(v, 230, v.sd).clone().sub(v.g.position).normalize().multiplyScalar(sp);
  if (n){ coh.divideScalar(n).sub(v.g.position).normalize().multiplyScalar(sp*0.5); ali.normalize().multiplyScalar(sp*0.25); goal.add(coh).add(ali); }
  goal.addScaledVector(sep.normalize(), sp*2.5 * (sep.lengthSq() > 0 ? 1 : 0));
  v.vel.lerp(goal.setLength(sp), Math.min(1, 2.2*dt));
  enFace(v, v.vel.lengthSq() > 1 ? v.vel.clone().normalize() : dirP, dt, 5); v.g.userData.core.rotation.x += dt*3; v.g.userData.core.rotation.y += dt*2;
  v.fireT -= dt;
  if (v.fireT <= 0 && d < 330 && P.alive && enOnTarget(v, dirP, 0.9)){
    v.fireT = (4 + Math.random()*3)/sc.fire;
    const from = v.g.position.clone().addScaledVector(enNose(v), 5);
    enShot(from, enAim(from, 150, 0.5, 0.06*sc.err), 150, 3*sc.dmg);
  }
  if (P.alive && d < 10){ damage(4*sc.dmg); burst(v.g.position, '#44ffcc', 14, 40, 0.4); v.hp = 0; return; }
  enMove(v, dt);
};

// Ransomware Lancer: cruises, then stops and charges (a warning beam shows where it will go), then dashes in a straight
// line through where you were heading, then drifts helpless for a couple of seconds.
EN_UPDATE.lancer = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1), sp = v.sp*sc.spd, glow = v.g.userData.glow;
  v.st -= dt;
  if (v.state === 'new'){ v.state = 'cruise'; v.st = 2.5 + Math.random()*2; }
  if (v.state === 'cruise'){
    enSeek(v, enOrbit(v, 330, v.sd), sp, 1.2, dt); enFace(v, dirP, dt, 3); glow.scale.set(34, 34, 1);
    if (v.st <= 0 && d < 650 && P.alive){ v.state = 'wind'; v.st = 1.8; v.line.visible = true; v.lockDir = dirP.clone(); toast('LANCER CHARGING · MOVE'); beep(300, 0.5, 'sawtooth', 0.04, 500); }
  } else if (v.state === 'wind'){
    v.vel.multiplyScalar(Math.pow(0.05, dt));
    if (v.st > 0.35) v.lockDir = P.pos.clone().addScaledVector(P.vel, 0.3).sub(v.g.position).normalize();   // locks 0.35 s before the dash
    enFace(v, v.lockDir, dt, 8); glow.scale.set(40 + Math.sin(v.t*22)*12, 40 + Math.sin(v.t*22)*12, 1);
    v.line.scale.z = 700; v.line.material.opacity = v.st > 0.35 ? 0.4 + 0.3*Math.sin(v.t*14) : 1;
    if (v.st <= 0){ v.state = 'dash'; v.st = 0.95; v.vel.copy(v.lockDir).multiplyScalar(300*sc.spd); v.hit = false; v.line.visible = false; beep(180, 0.5, 'sawtooth', 0.06, -100); }
  } else if (v.state === 'dash'){
    enFace(v, v.vel.clone().normalize(), dt, 20); trail(v.g.position.clone(), randDir().multiplyScalar(10), '#ff55cc', 0.4);
    if (!v.hit && P.alive && v.dist < 16){ v.hit = true; damage(16*sc.dmg); P.vel.addScaledVector(v.lockDir, 70); burst(P.pos, '#ff55cc', 30, 60, 0.6); }
    if (v.st <= 0){ v.state = 'recover'; v.st = 2.4; }
    enMove(v, dt, true); return;
  } else if (v.state === 'recover'){
    v.vel.multiplyScalar(Math.pow(0.3, dt)); glow.scale.set(18, 18, 1); if (v.vel.lengthSq() > 4) enFace(v, v.vel.clone().normalize(), dt, 3);
    if (v.st <= 0){ v.state = 'cruise'; v.st = 3 + Math.random()*2; }
  }
  enMove(v, dt);
};

// Spyware Sniper: sits far away, then aims with a red beam that brightens (the shot goes where the beam points at the
// end), fires one fast heavy bolt, reloads. Keep moving and it misses.
EN_UPDATE.sniper = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1), sp = v.sp*sc.spd, SHOT = 260;
  v.st -= dt;
  if (v.state === 'new'){ v.state = 'move'; v.st = 2 + Math.random()*2; }
  if (v.state === 'move' || v.state === 'reload'){
    enSeek(v, enOrbit(v, Math.max(450, Math.min(650, d)), v.sd), sp, 1.2, dt); enFace(v, dirP, dt, 3);
    if (v.state === 'move' && v.st <= 0 && d < 780 && P.alive){ v.state = 'aim'; v.st = 2.2; v.line.visible = true; v.aimDir = dirP.clone(); v.tick = 0; toast('SNIPER LOCKING · KEEP MOVING'); beep(900, 0.12, 'square', 0.03); }
    if (v.state === 'reload' && v.st <= 0){ v.state = 'move'; v.st = 1.5 + Math.random()*1.5; }
  } else if (v.state === 'aim'){
    v.vel.multiplyScalar(Math.pow(0.2, dt));
    if (v.st > 0.35) v.aimDir = P.pos.clone().addScaledVector(P.vel, (d/SHOT)*0.7).sub(v.g.position).normalize();   // freezes 0.35 s before the shot
    enFace(v, v.aimDir, dt, 10);
    const prog = 1 - v.st/2.2;
    v.line.scale.z = d + 80; v.line.material.opacity = v.st > 0.35 ? 0.2 + prog*0.6 : 1;
    v.tick -= dt; if (v.tick <= 0){ beep(700 + prog*700, 0.05, 'square', 0.02); v.tick = 0.45 - prog*0.3; }
    if (v.st <= 0){
      const from = v.g.position.clone().addScaledVector(v.aimDir, 16);
      enShot(from, v.aimDir, SHOT, 16*sc.dmg, {big:true, hr2:64, life:4, mat:EN_SNIPE_M});
      beep(1200, 0.25, 'sawtooth', 0.05, -900); v.line.visible = false; v.state = 'reload'; v.st = (3.5 + Math.random())/sc.fire;
    }
  }
  enMove(v, dt);
};

// Adware Carrier: big, slow, tough; wanders at long range and launches pop-up drones (up to 3) that chase you and burst
// on contact. Destroy it and its pop-ups go with it.
EN_UPDATE.carrier = function(v, dt, sc){
  const d = v.dist, dirP = P.pos.clone().sub(v.g.position).normalize(), sp = v.sp*sc.spd;
  v.st -= dt;
  if (!v.wp || v.st <= 0){ v.wp = P.pos.clone().add(randDir().multiplyScalar(520 + Math.random()*180)); if (v.wp.length() > R*0.85) v.wp.setLength(R*0.85); v.st = 8 + Math.random()*5; }
  enSeek(v, v.wp, sp, 0.7, dt); enFace(v, v.vel.lengthSq() > 1 ? v.vel.clone().normalize() : dirP, dt, 1.2);
  v.fireT -= dt;
  if (v.fireT <= 0 && d < 1000 && P.alive){
    let mine = 0; for (const o of viruses) if (o.owner === v && o.hp > 0) mine++;
    v.fireT = (5.5 + Math.random()*2)/sc.fire;
    if (mine < 3) spawnPopup(v);
  }
  enMove(v, dt);
};
EN_UPDATE.popup = function(v, dt, sc){
  if (v.owner.hp <= 0 || v.t > v.life){ burst(v.g.position, '#c0c0c0', 8, 25, 0.3); v.hp = 0; return; }
  enSeek(v, P.pos, v.sp*sc.spd, 2.2, dt); v.g.lookAt(camera.position);
  if (P.alive && v.dist < 13){ damage(8*sc.dmg); burst(v.g.position, '#ffffff', 16, 40, 0.4); SFX.hit(); v.hp = 0; return; }
  enMove(v, dt);
};

// Rootkit Hunter: cloaked (no lock-on, no radar, almost invisible) while it circles close; every few seconds it fades in
// for a burst of fire. A faint sparkle gives away where it is; bullets still hit it while cloaked.
EN_UPDATE.rootkit = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1), sp = v.sp*sc.spd;
  v.st -= dt;
  if (v.state === 'new'){ v.state = 'stalk'; v.st = 3 + Math.random()*2; }
  if (v.state === 'stalk'){
    enSeek(v, enOrbit(v, 190, v.sd), sp, 1.6, dt); enFace(v, dirP, dt, 4); v.cloak = Math.min(1, v.cloak + dt*2.5);
    v.shim -= dt; if (v.shim <= 0){ v.shim = 0.4; trail(v.g.position.clone(), randDir().multiplyScalar(6), '#99ccff', 0.4); }
    if (v.st <= 0 && d < 420 && P.alive){ v.state = 'reveal'; v.st = 0.9; }
  } else if (v.state === 'reveal'){
    enSeek(v, enOrbit(v, 190, v.sd), sp*0.6, 1.6, dt); enFace(v, dirP, dt, 6); v.cloak = Math.max(0, v.cloak - dt*3);
    if (v.st <= 0){ v.state = 'fire'; v.st = 1.5; v.burst = v.gun.n; v.burstT = 0; }
  } else if (v.state === 'fire'){
    enSeek(v, enOrbit(v, 190, v.sd), sp*0.6, 1.6, dt); enFace(v, dirP, dt, 6); v.cloak = 0;
    if (v.burst > 0){ v.burstT -= dt; if (v.burstT <= 0 && P.alive){ v.burstT = v.gun.gap; v.burst--; enShoot(v, sc, v.gun); } }
    if (v.st <= 0){ v.state = 'fade'; v.st = 0.6; }
  } else if (v.state === 'fade'){
    enSeek(v, enOrbit(v, 190, v.sd), sp, 1.6, dt); v.cloak = Math.min(1, v.cloak + dt*2.2);
    if (v.st <= 0){ v.state = 'stalk'; v.st = (3.5 + Math.random()*2)/sc.fire; v.sd = -v.sd; }
  }
  v.hidden = v.cloak > 0.6;
  const vis = 1 - v.cloak*0.95; for (const [m, base] of v.mats) m.opacity = base*vis;
  enMove(v, dt);
};

// Defender: an anti-virus gone rogue. Flies to the nearest clean icon, grabs it and hauls it to the edge of the sector
// (it is deleted if it gets there). Shoot the Defender to drop the icon; or touch the icon yourself to rescue it. Dodges,
// and pops off a shot when you are close.
EN_UPDATE.defender = function(v, dt, sc){
  const toP = P.pos.clone().sub(v.g.position), d = toP.length(), dirP = toP.clone().divideScalar(d || 1), sp = v.sp*sc.spd;
  if (v.cargo && (v.cargo.dead || v.cargo.held !== v)){ if (v.cargo.held === v) v.cargo.held = null; v.cargo = null; v.state = 'hunt'; }
  v.st -= dt;
  if (v.state === 'new') v.state = 'hunt';
  if (v.state === 'hunt'){
    let tgt = null, best = 1e12;
    for (const ic of icons){ if (ic.dead || ic.infected || ic.held) continue; const dd = ic.g.position.distanceToSquared(v.g.position); if (dd < best){ best = dd; tgt = ic; } }
    if (!tgt){ burst(v.g.position, '#33ccff', 12, 30, 0.4); v.hp = 0; return; }   // nothing left to steal: gone, no reward
    enSeek(v, tgt.g.position, sp, 1.5, dt); enFace(v, v.vel.lengthSq() > 1 ? v.vel.clone().normalize() : dirP, dt, 3);
    if (best < 28*28){
      tgt.held = v; v.cargo = tgt; v.state = 'haul'; v.dest = v.g.position.clone().setLength(R*0.93);
      msg('ICON STOLEN: ' + short(tgt.f.name), v.g.position, '#fc6'); toast('DEFENDER STOLE AN ICON · shoot it or touch the icon'); beep(400, 0.2, 'triangle', 0.05, -200);
    }
  } else if (v.state === 'haul'){
    enSeek(v, v.dest, sp*0.85, 1.2, dt); enFace(v, v.vel.clone().normalize(), dt, 3);
    if (d < 300 && v.st <= 0){ v.st = 1.2 + Math.random(); v.vel.addScaledVector(new THREE.Vector3().crossVectors(dirP, randDir()).normalize(), sp*0.9); }   // jink
    if (v.g.position.length() > R*0.9){
      const ic = v.cargo; ic.dead = true; ic.held = null; addScore(-25); burst(ic.g.position, '#ffcc66', 24, 40); SFX.del();
      msg('LOST ' + short(ic.f.name) + ' −25', ic.g.position, '#fc6'); v.cargo = null; v.hp = 0; return;
    }
  }
  if (v.cargo){ v.cargo.g.position.copy(v.g.position); v.cargo.g.position.y -= 16; v.cargo.vel.set(0, 0, 0); }
  enGun(v, dt, sc, v.gun, d < v.gun.range && enOnTarget(v, dirP, v.gun.cone));
  enMove(v, dt);
};

// ---------- death ----------
function killEnemy(v){
  const D = EN_DEF[v.kind];
  burst(v.g.position, D.fx, 26, 45); addScore(D.pts); msg(D.name + ' +' + D.pts, v.g.position, D.fx); SFX.boom();
  if (D.bits) dropAt(v.g.position, D.bits, D.pk); dropResource(v.g.position, v.kind === 'popup' ? 0 : 0.4);
  if (v.kind === 'defender' && v.cargo && !v.cargo.dead){ v.cargo.held = null; v.cargo.vel.copy(randDir()).multiplyScalar(8); msg('ICON RECOVERED', v.g.position, '#4ade80'); v.cargo = null; }
  if (v.kind === 'carrier') for (const o of viruses) if (o.owner === v && o.hp > 0){ o.hp = 0; burst(o.g.position, '#c0c0c0', 10, 30, 0.4); }
  if (v.kind === 'wing' && v.partner && v.partner.hp > 0){ v.partner.enraged = true; msg('WINGMAN ENRAGED', v.partner.g.position, '#fa5'); }
}
