// ---------- free flight: no enemies, no damage, endless icons and practice drones ----------
let freeInf = lsGet('iconpatrol3d.freeInf') === '1';
const INF = () => !!(G.cur && G.cur.free && freeInf);
function showInf(){ const b = $('pInf'); b.textContent = '∞ Infinite resources: ' + (freeInf ? 'ON' : 'OFF'); b.style.display = G.cur && G.cur.free ? '' : 'none'; }
const FREE_DRONES = 6, TARGET_HP = {patrol:3, racer:2, fighter:3, bulwark:6, gunship:5};
function startFree(){
  G.res = null; G.ship = shipId; applyShipMesh(); G.sectors = []; G.score = 0; G.lives = 3; G.cleared = 0; G.bits = 0; G.up = freshUpgrades();
  G.cur = {path:'FREE FLIGHT', free:true, files:[]}; resetField(); queue = [];
  hideAll(); G.state = 'play'; G.paused = false; G.startT = performance.now()/1000; relockIfWanted();
  $('pMap').textContent = 'Leave free flight'; showInf();
  for (let i = 0; i < FREE_DRONES; i++) spawnDrone(true);
  setBanner('FREE FLIGHT', 2.5); toast('Free flight: no damage. Enemy ships fly around as practice targets (they don\'t shoot). Pause to leave.');
}
function spawnDrone(ahead){
  const at = ahead ? P.pos.clone().add(V((Math.random()*2-1)*180, (Math.random()*2-1)*90, -(180 + Math.random()*320))) : randInSphere(R*0.7);
  if (at.length() > R*0.9) at.setLength(R*0.9);
  // a red copy of one of the five ship classes, flying at its class's speed
  const sd = SHIPS[Math.floor(Math.random()*SHIPS.length)], g = buildShipMesh(sd.id);
  g.traverse(o => { if (o.material){ o.material = o.material.clone(); const lum = o.material.color.getHSL({}).l; o.material.color.setHSL(0.98, 0.85, Math.max(0.12, Math.min(0.62, lum))); } });
  g.add(glowSprite(0xff3355, 26, 0.35));
  g.position.copy(at); scene.add(g);
  const sp = 45*sd.speed;
  viruses.push({g, vel:randDir().multiplyScalar(sp), hp:TARGET_HP[sd.id], dummy:true, ship:sd, sp, turn:0.5*sd.turn, wp:randInSphere(R*0.6), wpT:4 + Math.random()*5, spin:V(), label:'TARGET · ' + sd.name.toUpperCase()});
}
function startSector(sec){
  $('pMap').textContent = 'Leave sector (drive map)'; $('pInf').style.display = 'none';
  G.cur = sec; sec._waiting = false; resetField(); makeExitGate(); queue = sec.files.slice();
  hideAll(); G.state = 'play'; G.paused = false; G.startT = performance.now()/1000; relockIfWanted(); nextWave();
}
function startBoss(){
  $('pMap').textContent = 'Leave sector (drive map)'; $('pInf').style.display = 'none';
  G.cur = {path:"DEMON'S GATE", boss:true, files:[]}; resetField(); queue = [];
  hideAll(); G.state = 'play'; G.paused = false; G.startT = performance.now()/1000; relockIfWanted();
  const g = new THREE.Group();
  const core = new THREE.IcosahedronGeometry(26, 1);
  g.add(new THREE.Mesh(core, basic(0x3a0410)));
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(34, 1)), lineMat(0xff3355)); g.add(shell);
  const spikes = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(46, 0)), lineMat(0xff6680)); g.add(spikes);
  const eye = new THREE.Group(); g.add(eye);
  const white = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 14), basic(0xffffdd)); white.scale.z = 0.6; white.position.z = 22; eye.add(white);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), basic(0xcc0000)); iris.position.z = 28; eye.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), basic(0x000000)); pupil.scale.set(0.45,1.3,1); pupil.position.z = 31.5; eye.add(pupil);
  g.add(glowSprite(0xff2244, 160, 0.5));
  g.position.set(0, 0, -150); scene.add(g);
  boss = {g, shell, spikes, eye, core:g.children[0], hp:120, max:120, t:0, fireT:2.5, spawnT:3, flash:0, vel:V()};
  setBanner('THE INNER DEMON AWAKENS'); SFX.wave();
}

function nextWave(){
  const batch = queue.splice(0, 8); waveNo++;
  for (const f of batch){
    let p, tries = 0;
    do { p = randInSphere(R*0.7); tries++; } while ((p.distanceTo(P.pos) < 160 || p.distanceTo(P.pos) > 650) && tries < 60);   // spread out, but within reach
    let tex;
    const cv = makeIcon(f, () => { if (tex) tex.needsUpdate = true; });
    tex = new THREE.CanvasTexture(cv);
    const g = new THREE.Group();
    const glow = glowSprite(0x4ade80, 46, 0.35); g.add(glow);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, alphaTest:0.05})); spr.scale.set(24,24,1); g.add(spr);
    g.position.copy(p); scene.add(g);
    icons.push({g, spr, glow, tex, vel:randDir().multiplyScalar(4+Math.random()*8), f, infected:false, hp:3, shootT:2+Math.random()*2, flash:0, bob:Math.random()*6});
  }
  const total = Math.ceil(G.cur.files.length/8);
  if (!G.cur.free){ setBanner(total > 1 ? `WAVE ${waveNo}/${total}` : 'SECTOR BREACHED'); SFX.wave(); }
}
function spawnVirus(at){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(VG_IN, basic(0x3a0848)));
  g.add(new THREE.LineSegments(VG_OUT, lineMat(0xff55ff)));
  g.add(new THREE.LineSegments(VG_MID, lineMat(0xffaaff)));
  g.add(glowSprite(0xe040fb, 28, 0.7));
  g.position.copy(at); scene.add(g);
  viruses.push({g, vel:V(), hp:2, spin:V(Math.random()*2, Math.random()*2, Math.random()*2)});
}
function spawnPickup(at, type, vel){
  const g = new THREE.Group();
  if (type === 'bit'){ g.add(new THREE.Mesh(BIT_G, BIT_M)); g.add(glowSprite(0x00ffff, 8, 0.6)); }
  else { const c = PICKUPS[type].c; g.add(new THREE.Mesh(PK_G, basic(c, {transparent:true, opacity:0.35}))); g.add(new THREE.LineSegments(PK_E, lineMat(c))); g.add(glowSprite(c, 26, 0.7)); }
  g.position.copy(at); scene.add(g);
  pickups.push({g, type, vel:vel || V(), life: type==='bit' ? 10 : 12});
}
function dropAt(at, bits, pChance){
  for (let i=0;i<bits;i++) spawnPickup(at, 'bit', randDir().multiplyScalar(15+Math.random()*25));
  if (Math.random() < pChance) spawnPickup(at, randPickup(), randDir().multiplyScalar(8));
}
function setBanner(t, dur=2){ banner = {t, life:dur, max:dur}; }
function later(s, fn){ timers.push({s, fn}); }
function msg(text, pos, color='#5ff'){ msgs.push({text, pos:pos ? pos.clone() : null, life:1.3, color}); }
function addScore(n){ G.score = Math.max(0, G.score + n); }
function short(n){ return n.length > 18 ? n.slice(0,15) + '…' : n; }

