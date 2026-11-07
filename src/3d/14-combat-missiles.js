function damage(n){
  if (G.cur && G.cur.free) return;   // free flight: no damage
  if (!P.alive || P.inv > 0 || P.pw.firewall > 0) return;
  // shields soak damage first; whatever gets through hits the hull, which doesn't regenerate
  const over = Math.max(0, n - Math.max(0, P.shield));
  P.shield = Math.max(0, P.shield - n); if (over > 0){ P.hull -= over; hitFlash = 0.6; }
  P.inv = 0.5; SFX.hurt(); rumble(120, 0.5); hitFlash = Math.max(hitFlash, 0.35);
  if (P.hull <= 0){
    P.alive = false; P.respawn = 2; burst(P.pos, '#5ff', 80, 60, 1.4); SFX.boom(); rumble(400, 1);
    ship.visible = false; G.lives--;
    if (G.lives < 0) later(1.8, () => showEnd(false));
  }
}
let hitFlash = 0;
function fireEnemy(from, dir, sp=120){
  const g = new THREE.Mesh(BG_E, BM_E); g.position.copy(from); scene.add(g);
  bullets.push({g, vel:dir.clone().normalize().multiplyScalar(sp), life:5, enemy:true});
}
function cleanseIcon(ic){
  ic.infected = false; ic.hp = 3; ic.glow.material.color.set(0x4ade80); ic.glow.material.opacity = 0.35; burst(ic.g.position, '#4ade80', 26, 35); addScore(50);
  dropAt(ic.g.position, 3, 0.25); dropResource(ic.g.position, 0.45); msg('CLEANSED +50', ic.g.position, '#4ade80'); SFX.cleanse(); ic.vel.multiplyScalar(0.2);
}
function killBoss(){
  if (!boss) return;
  burst(boss.g.position, '#f35', 400, 140, 2.2); burst(boss.g.position, '#fff', 200, 90, 1.6); SFX.boom(); setTimeout(SFX.boom,200); setTimeout(SFX.boom,450); rumble(900, 1);
  addScore(5000); scene.remove(boss.g); boss = null;
  viruses.forEach(v => { burst(v.g.position, '#e040fb', 12, 30); v.hp = 0; }); bullets.forEach(x => { if (x.enemy) x.life = 0; });
  setBanner('INNER DEMON DESTROYED', 3); later(3.4, () => showEnd(true));
}

// ---------- missiles: own wide-cone targeting (lock takes ~0.7s), homing, splash damage ----------
let missiles = [];
const MS = {tgt:null, t:0, locked:false, cool:0, prev:false}, MSL_ANG = 0.75, MSL_LOCK_T = 0.7;
const MG = new THREE.ConeGeometry(0.7, 3.2, 6); MG.rotateX(-Math.PI/2);
function hostiles(){
  const out = [];
  for (const v of viruses) if (v.hp > 0 && !v.hidden) out.push({obj:v, pos:v.g.position, vel:v.vel, r:v.r || 10});
  for (const ic of icons) if (ic.infected && !ic.dead) out.push({obj:ic, pos:ic.g.position, vel:ic.vel, r:14});
  if (boss) out.push({obj:boss, pos:boss.g.position, vel:boss.vel, r:38});
  return out;
}
const alive = o => o === boss ? !!boss : o.hp !== undefined && (o.infected === undefined ? o.hp > 0 : (o.infected && !o.dead));
function scanMissile(dt){
  let best = null, bestAng = MSL_ANG;
  for (const h of hostiles()){
    _t.copy(h.pos).sub(P.pos); const d = _t.length(); if (d > S.mslRange || d < 8) continue;
    const ang = _t.divideScalar(d).angleTo(fwd); if (ang < bestAng){ bestAng = ang; best = h; best.d = d; }
  }
  // keep the current target while it stays in the cone, so the lock can build
  if (MS.tgt && alive(MS.tgt.obj)){ _t.copy(MS.tgt.pos).sub(P.pos); const d = _t.length(); if (d <= S.mslRange && _t.divideScalar(d || 1).angleTo(fwd) < MSL_ANG*1.1){ best = MS.tgt; best.d = d; } }
  if (!best){ MS.tgt = null; MS.t = 0; MS.locked = false; return; }
  if (!MS.tgt || MS.tgt.obj !== best.obj){ MS.tgt = best; MS.t = 0; MS.locked = false; }
  MS.t += dt;
  if (!MS.locked && MS.t >= MSL_LOCK_T){ MS.locked = true; beep(660,0.05,'square',0.03); setTimeout(()=>beep(990,0.08,'square',0.03),60); }
}
function fireMissile(){
  if (!INF() && P.msl <= 0){ toast('NO MISSILES · grab missile drops'); beep(160,0.08,'square',0.03); return; }
  if (!INF()) P.msl--;
  const g = new THREE.Group(); g.add(new THREE.Mesh(MG, basic(0xffd8b0))); g.add(glowSprite(0xff8a3d, 10, 0.9));
  g.position.copy(P.pos).addScaledVector(fwd, 4).addScaledVector(up, -1.6);
  missiles.push({g, vel:P.vel.clone().addScaledVector(fwd, 110), life:5, tgt: MS.locked && MS.tgt ? MS.tgt : null});
  scene.add(g); beep(300,0.18,'sawtooth',0.04,500); MS.cool = 0.45;
}
function hurt(h, dmg){
  const o = h.obj;
  if (o === boss){ boss.hp -= dmg; boss.flash = 0.1; addScore(10); if (boss.hp <= 0) killBoss(); }
  else if (o.infected !== undefined){ o.hp -= dmg; o.flash = 0.1; if (o.hp <= 0) cleanseIcon(o); }
  else { o.hp -= dmg; if (o.hp <= 0) killVirus(o); }
}
function explodeMissile(m, direct){
  const at = m.g.position; burst(at, '#fb923c', 40, 55, 0.7); burst(at, '#fff3c4', 14, 30, 0.4); SFX.boom(); rumble(80, 0.3);
  if (direct) hurt(direct, direct.obj === boss ? 6 : 4);
  for (const h of hostiles()) if (h.obj !== (direct && direct.obj) && h.pos.distanceTo(at) < 22 + h.r*0.5) hurt(h, 2);   // splash
  m.life = 0;
}
function updateMissiles(dt){
  MS.cool -= dt;
  const want = !!(keys.msl || mouse.msl || pad.msl || TC.msl || TC.mslTap); TC.mslTap = false;
  if (want && !MS.prev && P.alive && MS.cool <= 0) fireMissile();
  MS.prev = want;
  for (const m of missiles){
    if (m.life <= 0) continue;
    m.life -= dt;
    const sp = Math.min(330, m.vel.length() + 260*dt);
    if (m.tgt && alive(m.tgt.obj)){
      const tt = m.g.position.distanceTo(m.tgt.pos)/Math.max(sp, 1);
      _t.copy(m.tgt.pos).addScaledVector(m.tgt.vel || V(), tt*0.8).sub(m.g.position).normalize();
      _t2.copy(m.vel).normalize();
      const ang = _t2.angleTo(_t), maxTurn = 2.6*dt;
      if (ang > 1e-4) _t2.lerp(_t, Math.min(1, maxTurn/ang)).normalize();
      m.vel.copy(_t2).multiplyScalar(sp);
    } else m.vel.setLength(sp);
    m.g.position.addScaledVector(m.vel, dt);
    m.g.lookAt(_t.copy(m.g.position).sub(m.vel));
    if (Math.random() < 0.8) trail(_t.copy(m.g.position), _t2.copy(m.vel).multiplyScalar(-0.15).add(randDir().multiplyScalar(5)), Math.random() < 0.5 ? '#fb923c' : '#fde68a', 0.35);
    let hit = null;
    for (const h of hostiles()){ if (m.g.position.distanceToSquared(h.pos) < (h.r + 2)*(h.r + 2)){ hit = h; break; } }
    if (hit) explodeMissile(m, hit);
    else if (m.life <= 0 || m.g.position.lengthSq() > (R+60)*(R+60)) explodeMissile(m, null);
  }
  missiles = missiles.filter(m => { if (m.life <= 0){ scene.remove(m.g); return false; } return true; });
}
function killVirus(v, rammed){
  if (v.ai) return killEnemy(v);
  burst(v.g.position, '#e040fb', 22, 40); addScore(25);
  msg(rammed ? 'RAMMED +25' : '+25', v.g.position, '#e9f'); SFX.boom();
  dropAt(v.g.position, 1 + (Math.random() < 0.4 ? 1 : 0), 0.12);
  dropResource(v.g.position, v.dummy ? 0.5 : 0.4);
}
let bitTick = 0;
function collect(k){
  if (k.type === 'bit'){ G.bits++; if (performance.now() - bitTick > 70){ beep(1400+Math.random()*300,0.04,'triangle',0.03); bitTick = performance.now(); } return; }
  switch (k.type){
    case 'patch': P.shield = Math.min(S.maxShield, P.shield + 40); break;
    case 'ram': P.boost = S.tank; break;
    case 'spread': P.pw.spread = 10; break;
    case 'rapid': P.pw.rapid = 10; break;
    case 'firewall': P.pw.firewall = 6; break;
    case 'life': G.lives++; break;
    case 'ammo': P.ammo = Math.min(S.maxAmmo, P.ammo + Math.ceil(S.maxAmmo*0.35)); break;
    case 'fuel': P.fuel = Math.min(S.maxFuel, P.fuel + S.maxFuel*0.35); break;
    case 'hull': P.hull = Math.min(S.maxHull, P.hull + Math.ceil(S.maxHull*0.25)); break;
    case 'missile': P.msl = Math.min(S.maxMsl, P.msl + 2); break;
  }
  msg(PICKUPS[k.type].name, null, PICKUPS[k.type].c);
  [523,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.08,'triangle',0.05),i*55));
}
function softWall(pos, vel, k=1){
  const d = pos.length();
  if (d > R){ const n = pos.clone().divideScalar(d); const vn = vel.dot(n); if (vn > 0) vel.addScaledVector(n, -vn*(k>1?1.6:1)); vel.addScaledVector(n, -(d-R)*3*k); }
}

