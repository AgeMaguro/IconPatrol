// ---------- gameplay ----------
// ---------- asteroids: drifting rocks that bounce you around and chip your shield (2026-11-06) ----------
// Bullets (yours and enemy fire) stop on them, so they work as cover. Shooting one breaks it; big ones split.
// Redline boost smashes small ones. Free flight: they still bounce you but do no damage (damage() rule).
const ROCK_COUNT = 50, ROCK_EDGE = new THREE.LineBasicMaterial({color:0xd6a35c, transparent:true, opacity:0.8});
const ROCK_FILL = new THREE.MeshBasicMaterial({color:0x08060a, transparent:true, opacity:0.9});
let rocks = [], rockT = 0;
function rockGeo(r){
  const g = new THREE.IcosahedronGeometry(1, r > 18 ? 1 : 0), p = g.attributes.position, seen = new Map();
  for (let i=0;i<p.count;i++){   // lumpy: push each corner in or out (shared corners move together)
    const key = p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);
    let k = seen.get(key); if (k === undefined){ k = 0.7 + Math.random()*0.55; seen.set(key, k); }
    p.setXYZ(i, p.getX(i)*k, p.getY(i)*k, p.getZ(i)*k);
  }
  return g;
}
function spawnRock(at, r, vel){
  const geo = rockGeo(r), edges = new THREE.EdgesGeometry(geo, 1), g = new THREE.Group();
  g.add(new THREE.Mesh(geo, ROCK_FILL), new THREE.LineSegments(edges, ROCK_EDGE));
  g.scale.set(r, r*(0.75 + Math.random()*0.4), r); g.position.copy(at); g.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6); scene.add(g);
  const sp = (r < 12 ? 6 : 3) + Math.random()*(r < 12 ? 14 : 8);
  rocks.push({g, r, geo, edges, vel: vel || randDir().multiplyScalar(sp), spin: V((Math.random()-.5)*0.9, (Math.random()-.5)*0.9, (Math.random()-.5)*0.9), hp: Math.ceil(r/3.5)});
}
function dropRock(k){ scene.remove(k.g); k.geo.dispose(); k.edges.dispose(); }
function rockSpot(minD){ let p, t = 0; do { p = randInSphere(R*0.92); t++; } while (P && p.distanceTo(P.pos) < minD && t < 40); return p; }
function newRock(minD){ const big = Math.random() < 0.22; spawnRock(rockSpot(minD), big ? 22 + Math.random()*24 : 4 + Math.random()*11); }
function seedRocks(){
  for (const k of rocks) dropRock(k); rocks = []; rockT = 0;
  seedHazards();
  if (G.cur && G.cur.boss) return;   // the boss arena stays clear
  for (let i=0;i<ROCK_COUNT;i++) newRock(160);
}
function breakRock(k){
  if (k.hp < -50) return; k.hp = -99;
  burst(k.g.position, '#d6a35c', Math.min(40, 8 + k.r*1.2), 25 + k.r, 0.9); SFX.boom(); addScore(Math.max(1, Math.round(k.r/4)));
  if (k.r >= 12){
    const n = k.r > 28 ? 3 : 2;
    for (let i=0;i<n;i++){ const d = randDir(); spawnRock(_t2.copy(k.g.position).addScaledVector(d, k.r*0.45), k.r*0.5, d.multiplyScalar(6 + Math.random()*12).add(k.vel)); }
  } else if (Math.random() < 0.3) dropAt(k.g.position, 1, 0.12);
}
function updateRocks(dt){
  P.rockCd = Math.max(0, (P.rockCd || 0) - dt);
  for (const k of rocks){
    if (k.hp <= 0) continue;
    const kp = k.g.position;
    kp.addScaledVector(k.vel, dt); k.g.rotation.x += k.spin.x*dt; k.g.rotation.y += k.spin.y*dt; k.g.rotation.z += k.spin.z*dt;
    const d = kp.length(); if (d > R - k.r){ const vn = k.vel.dot(_t.copy(kp).divideScalar(d)); if (vn > 0) k.vel.addScaledVector(_t, -2*vn); }   // bounce off the sector shell
    if (!P.alive) continue;
    const rr = k.r*0.85 + 3.5, dd = kp.distanceToSquared(P.pos);
    if (dd >= rr*rr) continue;
    const n = _t2.copy(P.pos).sub(kp).divideScalar(Math.sqrt(dd) || 1);
    P.pos.copy(kp).addScaledVector(n, rr + 0.2);   // push the ship back out of the rock
    const vn = _t.copy(P.vel).sub(k.vel).dot(n);
    if (vn >= 0) continue;
    P.vel.addScaledVector(n, -vn*1.5);             // bounce, losing some speed
    if (k.r < 20) k.vel.addScaledVector(n, vn*0.5*(10/k.r));   // small rocks get knocked away
    const hit = -vn;
    if (hit > 6 && P.rockCd <= 0){
      P.rockCd = 0.35; rumble(160, Math.min(1, hit/60)); burst(_t.copy(P.pos).addScaledVector(n, -3), '#fc8', 10, 25, 0.4);
      if (P.boosting && k.r < 14){ breakRock(k); msg('SMASHED', kp, '#fc8'); }
      else { SFX.hit(); damage(Math.min(45, Math.round(4 + hit*0.3*(k.r > 20 ? 1.3 : 1)))); }
    }
  }
  rocks = rocks.filter(k => { if (k.hp <= 0){ dropRock(k); return false; } return true; });
  // the field slowly refills, out of sight
  if (!(G.cur && G.cur.boss) && rocks.length < ROCK_COUNT*0.7){ rockT -= dt; if (rockT <= 0){ rockT = 3; newRock(500); } }
}
function rockBlocks(b){   // any bullet that hits a rock stops there
  const bp = b.g.position;
  for (const k of rocks){ if (k.hp > 0 && bp.distanceToSquared(k.g.position) < k.r*k.r*0.75){
    b.life = 0; burst(bp, '#fc8', 3, 15, 0.25);
    if (!b.enemy){ k.hp -= b.dmg || 1; if (k.hp <= 0) breakRock(k); }
    return true; } }
  return false;
}

