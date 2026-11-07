// ---------- sector hazards (2026-11-06) ----------
// Firewall grids, corrupted data clouds, the Recycle Bin, defrag sweeps, packet streams and pop-up mines.
// Seeded with the rocks (seedRocks); none in the boss arena. damage() already skips free flight.
let haz = {t:0, grids:[], clouds:[], bins:[], streams:[], mines:[], sweep:null, sweepT:50, mineT:0}, hazGroup = null;
const hzA = V(), hzB = V(), hzQ = new THREE.Quaternion();
const HZ = {grids:2, clouds:3, bins:1, streams:2, mines:7};
function canvasSprite(w, h, draw, height){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c), s = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
  s.scale.set(height*w/h, height, 1); return s;
}
function hazSpot(minD, maxR){ let p, t = 0; do { p = randInSphere(maxR); t++; } while (P && p.distanceTo(P.pos) < minD && t < 50); return p; }
function gridLines(size, n){ const h = size/2, pts = []; for (let i=0;i<=n;i++){ const u = -h + i*size/n; pts.push(-h,u,0, h,u,0, u,-h,0, u,h,0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3)); return g; }

// firewall grid: a red laser sheet that slides back and forth; 4 s on, 1.5 s off (flickers just before it comes back)
function makeGrid(){
  const size = 170 + Math.random()*130, g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({color:0xff2a3a, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false});
  g.add(new THREE.LineSegments(gridLines(size, 12), mat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)), new THREE.LineBasicMaterial({color:0xff7080})));
  const base = hazSpot(300, R*0.75); g.position.copy(base); g.lookAt(hzA.copy(base).add(randDir())); hazGroup.add(g);
  haz.grids.push({g, mat, half:size/2, base, n:V(0,0,1).applyQuaternion(g.quaternion), amp:50 + Math.random()*110, w:0.2 + Math.random()*0.25, ph:Math.random()*6, cyc:Math.random()*5.5, on:true, side:null, cd:0});
}
// corrupted data cloud: flickering glitch specks; inside it the HUD scrambles and targeting goes offline
function makeCloud(){
  const r = 80 + Math.random()*70, n = 260, pos = new Float32Array(n*3), col = new Float32Array(n*3);
  for (let i=0;i<n;i++){ const p = randInSphere(r); pos.set([p.x,p.y,p.z], i*3); col.set(Math.random() < 0.55 ? [0.85,0.25,1] : [0.25,1,0.55], i*3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setAttribute('color', new THREE.BufferAttribute(col,3));
  const g = new THREE.Group();
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({size:6, sizeAttenuation:false, map:DOT, vertexColors:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false})));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r, 1)), new THREE.LineBasicMaterial({color:0xc040ff, transparent:true, opacity:0.16})));
  g.position.copy(hazSpot(240, R*0.8)); hazGroup.add(g);
  haz.clouds.push({g, r, geo, base:pos.slice()});
}
// the Recycle Bin: a black hole that pulls in you, rocks, icons and pickups. Whatever reaches the core is deleted.
// black-hole look: an accretion disk of hot streaks, plus the "lensed" far side of the disk that gravity bends up and
// over (and under) the shadow, which always faces you, and a thin photon ring. Both disks spin.
function diskTex(inner, seed){
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), m = N/2;
  const g = x.createRadialGradient(m, m, inner*m, m, m, m);
  g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(0.18, 'rgba(255,170,60,.85)'); g.addColorStop(0.55, 'rgba(235,90,20,.45)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, m, 0, 7); x.arc(m, m, inner*m, 0, 7, true); x.fill();
  x.globalCompositeOperation = 'lighter';
  for (let i=0;i<520;i++){   // streaks: short arcs, brighter and denser near the inner edge
    const t = Math.pow(Math.random(), 1.8), r = (inner + (1 - inner)*t)*m, a = Math.random()*7, len = 0.25 + Math.random()*2.2;
    x.strokeStyle = `hsla(${18 + Math.random()*26},100%,${55 + (1 - t)*30}%,${0.08 + (1 - t)*0.35})`; x.lineWidth = 0.6 + Math.random()*2.4;
    x.beginPath(); x.arc(m, m, r, a, a + len); x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
const BIN_RANGE = 650, BIN_CORE = 28, BIN_VIS = 1.6;   // starting size (was range 480, core 18, look 1x)
const HORIZON_K = 2.6;   // event horizon ("Schwarzschild radius") = 2.6 x the core: inside it nothing gets out
function makeBin(){
  const g = new THREE.Group(), rings = [];
  const addMat = map => new THREE.MeshBasicMaterial({map, transparent:true, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false});
  g.add(new THREE.Mesh(new THREE.SphereGeometry(16, 28, 20), basic(0x000000)));   // the shadow
  g.add(glowSprite(0xff7a2a, 150, 0.28));
  const disk = new THREE.Mesh(new THREE.RingGeometry(20, 78, 128, 1), addMat(diskTex(20/78)));
  disk.rotation.x = -Math.PI/2 + 0.18; g.add(disk); rings.push(disk);
  const halo = new THREE.Mesh(new THREE.RingGeometry(18.5, 50, 128, 1), addMat(diskTex(18.5/50))); halo.material.opacity = 0.8; g.add(halo);
  const photon = new THREE.Mesh(new THREE.RingGeometry(17, 17.9, 96, 1), new THREE.MeshBasicMaterial({color:0xffe0b0, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false})); g.add(photon);
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(96, 0.8, 3, 72)), new THREE.LineBasicMaterial({color:0xa855f7, transparent:true, opacity:0.22}));
  wire.rotation.x = Math.PI/2 + 0.18; g.add(wire); rings.push(wire);   // a faint wireframe edge so it still fits the game's look
  const lab = canvasSprite(300, 64, (x, w, h) => {
    x.strokeStyle = '#fdba74'; x.lineWidth = 4; x.strokeRect(14, 14, 28, 38); x.beginPath(); x.moveTo(8, 14); x.lineTo(48, 14); x.moveTo(22, 8); x.lineTo(34, 8); x.stroke();
    x.font = 'bold 30px Consolas,monospace'; x.fillStyle = '#ffedd5'; x.fillText('RECYCLE BIN', 62, 44); }, 14);
  lab.position.y = 62; g.add(lab);
  { let p, t = 0; do { p = P.pos.clone().addScaledVector(randDir(), 500 + Math.random()*350); t++; } while (p.length() > R*0.78 && t < 60);
    if (p.length() > R*0.78) p.setLength(R*0.6); g.position.copy(p); }   // 500-850 m from you: findable, but not on top of you
  g.traverse(o => { if (o.material) o.material.fog = false; });   // shows through the fog from across the sector
  hazGroup.add(g);
  haz.bins.push({g, rings, halo, photon, spin:0, range:BIN_RANGE, core:BIN_CORE, mass:0, told:0, vis:BIN_VIS}); g.scale.setScalar(BIN_VIS);
}
// Bin gravity is inverse-square, like a real black hole: a(d) = BIN_AH * (horizon/d)^2, so it's BIN_AH right at the
// event horizon, 4x weaker at twice that distance, and barely there at the edge of its range. Capped at BIN_AMAX
// (only reached inside the horizon) so nothing goes infinite at the core.
const BIN_AH = 290, BIN_AMAX = 600;
function binAcc(b, d){ return Math.min(BIN_AMAX, BIN_AH*b.horizon*b.horizon/(d*d)); }
// escape velocity from distance d: v_esc = sqrt(2 * integral from d to range of a(x)).
// Uncapped part: BIN_AH h^2 (1/d - 1/range). Inside the cap radius dc the pull is flat BIN_AMAX.
function binVesc(b, d){ if (d >= b.range) return 0; const h2 = BIN_AH*b.horizon*b.horizon, dc = Math.sqrt(h2/BIN_AMAX);
  const I = d >= dc ? h2*(1/d - 1/b.range) : BIN_AMAX*(dc - d) + h2*(1/dc - 1/b.range); return Math.sqrt(2*Math.max(0, I)); }
// sector gate: every sector starts inside it, and once the sector is clean you have to fly back through it to finish.
// It sits on the far side of the arena from the Recycle Bin (as far away as the arena allows). Amber = locked, green = open.
const EXIT_R = 46, EXIT_LOCK = 0xfbbf24, EXIT_OPEN = 0x4ade80;
function exitLabel(open){ return canvasSprite(360, 64, (x, w, h) => {
  x.font = 'bold 30px Consolas,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = open ? '#bbf7d0' : '#fde68a'; x.fillText(open ? 'EXIT GATE · OPEN' : 'SECTOR GATE', w/2, h/2); }, 24); }
function makeExitGate(){
  const b = haz.bins[0], dir = b && b.g.position.lengthSq() > 1 ? b.g.position.clone().normalize().negate() : randDir();
  const pos = dir.multiplyScalar(R*0.8);   // the point in the arena farthest from the Bin
  const g = new THREE.Group(); g.position.copy(pos); g.lookAt(0, 0, 0);   // faces the middle of the sector
  const ringMat = new THREE.MeshBasicMaterial({color:EXIT_LOCK}), lineM = new THREE.LineBasicMaterial({color:EXIT_LOCK, transparent:true, opacity:0.8});
  g.add(new THREE.Mesh(new THREE.TorusGeometry(EXIT_R, 2.2, 8, 72), ringMat));
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(EXIT_R*0.82, 1.2, 3, 12)), lineM); g.add(inner);
  const chev = new THREE.Group(); g.add(chev);   // eight marker blocks around the rim that spin
  for (let i=0;i<8;i++){ const a = i/8*Math.PI*2, m = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 3), ringMat); m.position.set(Math.cos(a)*(EXIT_R + 6), Math.sin(a)*(EXIT_R + 6), 0); m.rotation.z = a; chev.add(m); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(EXIT_R*0.96, 64), new THREE.MeshBasicMaterial({color:EXIT_LOCK, transparent:true, opacity:0.06, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false})); g.add(disc);
  const glow = glowSprite(EXIT_LOCK, 190, 0.22); g.add(glow);
  let lab = exitLabel(false); lab.position.y = EXIT_R + 26; g.add(lab);
  g.traverse(o => { if (o.material) o.material.fog = false; });
  hazGroup.add(g);
  haz.exit = {g, ringMat, lineM, disc, glow, chev, inner, lab, open:false, spin:0, pulse:0};
  // start inside the gate, nose toward the middle of the sector but angled ~30° off the Bin (it's straight across the middle)
  P.pos.copy(pos); P.vel.set(0, 0, 0);
  const side = randDir(); side.addScaledVector(dir.clone().normalize(), -side.dot(dir.clone().normalize())).setLength(R*0.45);
  P.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, side, V(0, 1, 0)));
  ship.position.copy(P.pos); ship.quaternion.copy(P.q); camera.position.copy(P.pos).add(V(0,4,16).applyQuaternion(P.q)); camera.quaternion.copy(P.q);
  // clear the doorway: rocks, mines, clouds and firewall grids that spawned near the gate move elsewhere
  const away = (o, d) => o.distanceTo(pos) < d;
  for (const k of rocks) if (away(k.g.position, 170)) k.g.position.copy(hazSpot(320, R*0.85));
  for (const m of haz.mines) if (away(m.base, 260)){ m.base.copy(hazSpot(360, R*0.85)); m.s.position.copy(m.base); }
  for (const c of haz.clouds) if (away(c.g.position, c.r + 120)) c.g.position.copy(hazSpot(c.r + 300, R*0.8));
  for (const gr of haz.grids) if (away(gr.base, 260)){ gr.base.copy(hazSpot(400, R*0.8)); gr.g.position.copy(gr.base); }
}
function openExitGate(){
  const e = haz.exit; if (!e || e.open) return false;
  e.open = true; e.pulse = 1;
  e.ringMat.color.setHex(EXIT_OPEN); e.lineM.color.setHex(EXIT_OPEN); e.disc.material.color.setHex(EXIT_OPEN); e.glow.material.color.setHex(EXIT_OPEN);
  e.g.remove(e.lab); e.lab.material.map.dispose(); e.lab = exitLabel(true); e.lab.position.y = EXIT_R + 26; e.lab.material.fog = false; e.g.add(e.lab);
  return true;
}
function updateExitGate(dt){
  const e = haz.exit; if (!e) return;
  e.spin += dt*(e.open ? 1.4 : 0.35); e.chev.rotation.z = e.spin; e.inner.rotation.z = -e.spin*0.6;
  e.pulse = Math.max(0, e.pulse - dt*0.6);
  e.disc.material.opacity = e.open ? 0.16 + 0.08*Math.sin(e.spin*3) + e.pulse*0.3 : 0.05;
  e.glow.material.opacity = e.open ? 0.4 + e.pulse*0.4 : 0.18;
  if (!P.alive) return;
  const d = P.pos.distanceTo(e.g.position);
  if (d > EXIT_R*2.5) e.left = true;   // you have to fly out of the doorway before going back through counts
  if (e.open && e.left && d < EXIT_R*0.9 && G.cur && G.cur._finish){
    burst(e.g.position, '#4ade80', 60, 70, 1); SFX.wave(); setBanner('SECTOR EXITED', 1.4); haz.exit = null;
    const f = G.cur._finish; later(0.6, f);   // a short beat so you see yourself go through
    return;
  }
  if (!e.open){ if (e.left && d < EXIT_R && !e.told){ e.told = 1; msg('GATE LOCKED · clean the sector first', null, '#fde68a'); } }
}
// HUD: where the gate is (always once it's open; only when on screen while locked)
function drawExitMarker(){
  const e = haz.exit; if (!e || !P.alive || hudMode === 'minimal' && !e.open) return;
  const d = Math.round(P.pos.distanceTo(e.g.position)), col = e.open ? '#4ade80' : 'rgba(253,230,138,.7)';
  const sp = project(e.g.position), on = sp && sp.x > 30 && sp.x < W-30 && sp.y > 30 && sp.y < H-30;
  hx.save(); hx.font = 'bold 11px Consolas,monospace'; hx.textAlign = 'center';
  if (on){
    if (d < 70) { hx.restore(); return; }
    const s = 9; hx.strokeStyle = col; hx.lineWidth = 2; hx.beginPath(); hx.moveTo(sp.x, sp.y-s); hx.lineTo(sp.x+s, sp.y); hx.lineTo(sp.x, sp.y+s); hx.lineTo(sp.x-s, sp.y); hx.closePath(); hx.stroke();
    hx.fillStyle = col; hx.fillText((e.open ? 'EXIT ' : 'GATE ') + d + ' m', sp.x, sp.y + s + 14);
  } else if (e.open){
    _pv.copy(e.g.position).sub(P.pos).normalize().transformDirection(camera.matrixWorldInverse);
    const back = _pv.z > 0, ang = Math.atan2(-_pv.y, _pv.x), rx = Math.min(W, H)*0.42, ry = rx*0.85;
    const ax = W/2 + Math.cos(ang)*rx, ay = H/2 + Math.sin(ang)*ry;
    hx.save(); hx.translate(ax, ay); hx.rotate(ang); hx.fillStyle = col; hx.beginPath(); hx.moveTo(12,0); hx.lineTo(-7,-8); hx.lineTo(-3,0); hx.lineTo(-7,8); hx.closePath(); hx.fill(); hx.restore();
    hx.fillStyle = col;
    hx.fillText('EXIT ' + d + ' m' + (back ? ' (BEHIND)' : ''), ax - Math.cos(ang)*30, ay - Math.sin(ang)*22 + 4);
  }
  hx.restore();
}
// packet stream: a lane of fast data blocks. Crossing it hurts; flying along it gives you a speed boost.
