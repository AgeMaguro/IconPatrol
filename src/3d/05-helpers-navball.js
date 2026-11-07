// ---------- 3D helpers ----------
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const R = 1600; // arena radius (was 480, then 1000)
function randInSphere(r){ const v = V(); do { v.set(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01); return v.multiplyScalar(r); }
function randDir(){ return randInSphere(1).normalize(); }
function glowTex(){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
function ringTex(){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(32,32,24,0,7); g.stroke(); return new THREE.CanvasTexture(c); }
function dotTex(){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32,32,26,0,7); g.fill(); return new THREE.CanvasTexture(c); }
const GLOW = glowTex(), RING = ringTex(), DOT = dotTex();
function glowSprite(color, size, opacity=1){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, opacity})); s.scale.set(size,size,1); return s; }
const lineMat = c => new THREE.LineBasicMaterial({color:c, transparent:true, opacity:1});
const basic = (c, o={}) => new THREE.MeshBasicMaterial(Object.assign({color:c}, o));

// environment
(function buildEnv(){
  const n = 2500, pos = new Float32Array(n*3);
  for (let i=0;i<n;i++){ const d = randDir().multiplyScalar(3300 + Math.random()*2000); pos.set([d.x,d.y,d.z], i*3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0x7fb8d6, size:1.8, sizeAttenuation:false, fog:false, transparent:true, opacity:0.42})));
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R+40, 3)), new THREE.LineBasicMaterial({color:0x0b6f94, transparent:true, opacity:0.35}));
  scene.add(shell);
  const cubeEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1));
  const cubeMats = [new THREE.LineBasicMaterial({color:0x7a3cff, transparent:true, opacity:0.45}), new THREE.LineBasicMaterial({color:0x1aa7d6, transparent:true, opacity:0.45})];
  for (let i=0;i<320;i++){
    const m = new THREE.LineSegments(cubeEdges, cubeMats[Math.random()<0.25 ? 0 : 1]);
    const s = 8 + Math.random()*(Math.random()<0.15 ? 120 : 45); m.scale.set(s, s*(0.5+Math.random()*2), s);
    m.position.copy(randInSphere(R*0.95)); m.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    scene.add(m);
  }
  // data rings
  for (let i=0;i<26;i++){
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(60+Math.random()*160, 0.6, 3, 48)), new THREE.LineBasicMaterial({color:0x22d3ee, transparent:true, opacity:0.25}));
    ring.position.copy(randInSphere(R*0.7)); ring.lookAt(randInSphere(R)); scene.add(ring);
  }
})();

// ship
const ship = new THREE.Group();
const flame = glowSprite(0xffaa33, 6, 0.9); flame.position.set(0,0,3.2); ship.add(flame);
const fwShell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(9,1)), new THREE.LineBasicMaterial({color:0xc084fc, transparent:true, opacity:0.6}));
ship.add(fwShell); fwShell.visible = false;
// (ship body is added by applyShipMesh() once the ship types are defined)
scene.add(ship);

// shared geometry
const VG_IN = new THREE.IcosahedronGeometry(5,0), VG_OUT = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(8.5,0)), VG_MID = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(5.5,0));
const BG_P = new THREE.SphereGeometry(0.9, 6, 4), BG_E = new THREE.SphereGeometry(1.7, 8, 6), BG_T = new THREE.BoxGeometry(0.4, 0.4, 4.5);
const BM_P = basic(0xbfffff), BM_E = basic(0xff4466);
const PK_G = new THREE.OctahedronGeometry(3.6, 0), PK_E = new THREE.EdgesGeometry(PK_G), BIT_G = new THREE.OctahedronGeometry(1.4, 0), BIT_M = basic(0x77ffff);

// particles
const PMAX = 3000, pPos = new Float32Array(PMAX*3), pCol = new Float32Array(PMAX*3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol,3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({size:5, sizeAttenuation:false, map:GLOW, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
pts.frustumCulled = false; scene.add(pts);
let plist = [];
const _c = new THREE.Color();
function burst(p, color, n=16, sp=40, life=0.8){
  _c.set(color);
  for (let i=0;i<n && plist.length<PMAX;i++){ const d = randDir().multiplyScalar(sp*(0.3+Math.random())); plist.push({x:p.x,y:p.y,z:p.z,vx:d.x,vy:d.y,vz:d.z,life:life*(0.5+Math.random()*0.6),max:life,r:_c.r,g:_c.g,b:_c.b}); }
}
function trail(p, v, color, life=0.3){ if (plist.length >= PMAX) return; _c.set(color); plist.push({x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z,life,max:life,r:_c.r,g:_c.g,b:_c.b}); }

// ---------- navball ----------
const nbScene = new THREE.Scene(), nbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); nbCam.position.set(0,0,4.25);
const nbOuter = new THREE.Group(); nbOuter.scale.z = -1; nbScene.add(nbOuter);
const nbInner = new THREE.Group(); nbOuter.add(nbInner);
(function buildNavball(){
  const hemi = (start, color, op) => new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI*2, start, Math.PI/2), new THREE.MeshBasicMaterial({color, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false}));
  nbInner.add(hemi(0, 0x0e5a7c, 0.45), hemi(Math.PI/2, 0x3a2208, 0.45));
  const pts = [];
  const seg = 64;
  for (let lat = -60; lat <= 60; lat += 30){
    const phi = lat*Math.PI/180, y = Math.sin(phi), r = Math.cos(phi);
    for (let i=0;i<seg;i++){ const a0 = i/seg*Math.PI*2, a1 = (i+1)/seg*Math.PI*2; pts.push(r*Math.cos(a0)*1.002, y, r*Math.sin(a0)*1.002, r*Math.cos(a1)*1.002, y, r*Math.sin(a1)*1.002); }
  }
  for (let lon = 0; lon < 360; lon += 30){
    const t = lon*Math.PI/180;
    for (let i=0;i<seg/2;i++){ const p0 = -Math.PI/2 + i/(seg/2)*Math.PI, p1 = -Math.PI/2 + (i+1)/(seg/2)*Math.PI;
      pts.push(Math.cos(p0)*Math.cos(t), Math.sin(p0), Math.cos(p0)*Math.sin(t), Math.cos(p1)*Math.cos(t), Math.sin(p1), Math.cos(p1)*Math.sin(t)); }
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  nbInner.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({color:0x66ddff, transparent:true, opacity:0.28, depthWrite:false})));
  const eq = [];
  for (let i=0;i<seg;i++){ const a0 = i/seg*Math.PI*2, a1 = (i+1)/seg*Math.PI*2; eq.push(Math.cos(a0)*1.004,0,Math.sin(a0)*1.004, Math.cos(a1)*1.004,0,Math.sin(a1)*1.004); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(eq,3));
  nbInner.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.7, depthWrite:false})));
})();
const nbBlips = [];
function nbBlip(i){
  while (nbBlips.length <= i){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map:DOT, transparent:true, depthTest:false, depthWrite:false})); s.renderOrder = 5; nbOuter.add(s); nbBlips.push(s); }
  return nbBlips[i];
}

