// ---------- game state ----------
let S = stats(), P, bullets=[], icons=[], viruses=[], pickups=[], msgs=[], timers=[], boss=null, banner=null, waveNo=0, queue=[], virusT=2.5, cacheT=14;
const fwd = V(), up = V(), right = V(), qInv = new THREE.Quaternion();

function clearField(){
  for (const a of [bullets, icons, viruses, pickups]) for (const o of a) scene.remove(o.g);
  if (boss) scene.remove(boss.g);
  for (const m of missiles) scene.remove(m.g);
  bullets=[]; icons=[]; viruses=[]; pickups=[]; missiles=[]; msgs=[]; timers=[]; boss=null; banner=null; plist=[];
}
function resetField(){
  feedClear();
  clearField(); S = stats();
  P = {pos:V(0,0,R*0.35), vel:V(), q:new THREE.Quaternion(), ang:V(), shield:S.maxShield, inv:2, cool:0, alive:true, respawn:0,
       thrust:false, boost:S.tank, boostIdle:0, boosting:false, wasBoosting:false, pw:{spread:0, rapid:0, firewall:0}, rate:V(), spool:0, thrAmt:0, brkAmt:0, thrSm:0, brkSm:0};
  // ship resources carry over between sectors (G.res); a new run or new life starts full
  const R0 = G.res;
  P.hull = R0 ? Math.min(S.maxHull, R0.hull + S.hullFix) : S.maxHull; P.ammo = R0 ? Math.min(S.maxAmmo, R0.ammo) : S.maxAmmo;
  P.fuel = R0 ? Math.min(S.maxFuel, R0.fuel) : S.maxFuel; P.msl = R0 ? Math.min(S.maxMsl, R0.msl) : S.maxMsl;
  MS.tgt = null; MS.t = 0; MS.locked = false; MS.cool = 0; MS.prev = false; P.warned = {};
  waveNo = 0; virusT = 2.5; cacheT = 12 + Math.random()*6; gateSm.coast = gateSm.ghost = null; throttle = 0; mouse.dx = mouse.dy = mouse.sx = mouse.sy = 0; effThr = 0; TGT = null; wasLocked = false; CK.x = CK.y = CK.r = 0;
  ship.position.copy(P.pos); ship.quaternion.copy(P.q); camera.position.copy(P.pos).add(V(0,4,16)); camera.quaternion.copy(P.q);
  seedRocks();
}
function gateNeed(){ return Math.min(5, G.sectors.length); }

// ---------- hangar (pick a ship before each run) ----------
let pendingSectors = null, hangarSel = shipId;
const STAT_ROWS = [['Speed','speed'],['Handling','turn'],['Firepower','fire'],['Shield','shield']];
function showHangar(sectors){ pendingSectors = sectors; hideAll(); G.state = 'hangar'; hangarSel = shipId; renderHangar(); $('hangar').classList.add('show'); navFirst(); }
function renderHangar(){
  const list = $('shipList'), focusedIdx = navEl ? [...list.querySelectorAll('button')].indexOf(navEl) : -1;
  list.innerHTML = '';
  for (const sd of SHIPS){
    const b = document.createElement('button'); b.className = 'shipCard' + (sd.id === hangarSel ? ' sel' : '');
    const c = document.createElement('canvas'); c.width = 168; c.height = 96; b.appendChild(c);
    const g = c.getContext('2d'); drawShipShape(g, sd.id, 84, 48, -Math.PI/2, 2.1, sd.color, sd.fill);
    const t = document.createElement('div'); t.innerHTML = `<b style="color:${sd.color}">${sd.name}</b><small>${sd.tag}</small>`; b.appendChild(t);
    b.onclick = () => { hangarSel = sd.id; renderHangar(); beep(700,0.04,'triangle',0.04); };
    list.appendChild(b);
  }
  if (focusedIdx >= 0){ const bs = list.querySelectorAll('button'); if (bs[focusedIdx]) setNav(bs[focusedIdx]); }
  const sd = SHIPS.find(x => x.id === hangarSel);
  $('shipName').textContent = sd.name; $('shipName').style.color = sd.color; $('shipTag').textContent = sd.tag; $('shipDesc').textContent = sd.desc;
  $('shipStats').innerHTML = STAT_ROWS.map(([lab, k]) => `<div class="statrow"><span>${lab}</span><div class="statbar"><i style="width:${Math.min(100, sd[k]/1.7*100)}%;background:${sd[k] > 1.05 ? '#4ade80' : sd[k] < 0.95 ? '#f87171' : '#5ff'}"></i></div><span class="v">${Math.round(sd[k]*100)}%</span></div>`).join('')
    + (sd.barrels ? '<div class="statrow"><span>Bonus</span><span style="grid-column:2/4;color:#fde68a">Starts with twin shots (Multi-Barrel level 1)</span></div>' : '')
    + (typeof THREE !== 'undefined' ? `<div class="statrow"><span>Loadout</span><span style="grid-column:2/4;color:#cfeaff">Hull ${sd.hull} · Ammo ${sd.ammo} · Fuel ${sd.fuel*FUEL_MULT} · Missiles ${sd.msl}</span></div>` : '')
    + (typeof THREE !== 'undefined' ? `<div class="statrow"><span>Auto-aim</span><div class="statbar"><i style="width:${sd.aim*100}%;background:#ffd400"></i></div><span class="v">${Math.round(sd.aim*100)}%</span></div>` : '')
    + (sd.volley ? '<div class="statrow"><span>Guns</span><span style="grid-column:2/4;color:#fde68a">Twin wingtip volley, half fire rate</span></div>' : '')
    + (sd.wide ? '<div class="statrow"><span>Bonus</span><span style="grid-column:2/4;color:#fde68a">Built-in scatter shot (never runs out; 75% damage, 75% range)</span></div>' : '');
}
let pendingFree = false;
function launchRun(){ shipId = hangarSel; lsSet('iconpatrol.ship', shipId); if (pendingFree){ pendingFree = false; startFree(); return; } const sec = pendingSectors; pendingSectors = null; startRun(sec); }
function newRun(sectors){ showHangar(sectors); pendingFree = false; }
function startRun(sectors){ G.res = null; G.ship = shipId; applyShipMesh(); G.sectors = sectors; G.score = 0; G.lives = 3; G.cleared = 0; G.bits = 0; G.up = freshUpgrades(); showMap(); }

// 3D ship models: the 2D outline extruded into a hull, plus fins / barrels / shield ring per type
function buildShipMesh(id){
  const sd = SHIPS.find(x => x.id === id) || SHIPS[0], sh = SHIP_SHAPES[sd.id], g = new THREE.Group();
  const k = 0.34, depth = {patrol:1.3, racer:0.8, fighter:1.0, bulwark:2.6, gunship:2.0}[sd.id];
  const shape = new THREE.Shape(sh.poly.map(([px, py]) => new THREE.Vector2(py*k, px*k)));
  const geo = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelThickness:0.3, bevelSize:0.3, bevelSegments:1});
  geo.rotateX(-Math.PI/2); geo.translate(0, -depth/2, 0);
  const col = new THREE.Color(sd.color), fill = new THREE.Color(sd.fill);
  g.add(new THREE.Mesh(geo, basic(fill)));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lineMat(col)));
  const rearZ = -sh.tail*k, top = depth/2 + 0.3;
  const fin = (x, h, len) => {
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute([x,top,rearZ-len, x,top+h,rearZ+0.4, x,top,rearZ+0.4],3));
    g.add(new THREE.Mesh(fg, basic(fill, {side:THREE.DoubleSide}))); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(fg), lineMat(col)));
  };
  if (sd.id === 'patrol') fin(0, 1.4, 2.2);
  if (sd.id === 'racer'){ fin(-1.1, 1.1, 2.6); fin(1.1, 1.1, 2.6); }
  if (sd.id === 'fighter') fin(0, 1.0, 2.0);
  if (sh.guns) for (const [gx, gy, len] of sh.guns){
    const cg = new THREE.CylinderGeometry(sd.id === 'gunship' ? 0.3 : 0.22, sd.id === 'gunship' ? 0.3 : 0.22, len*k, 8); cg.rotateX(Math.PI/2);
    const m = new THREE.Mesh(cg, basic(col)); m.position.set(gy*k, sd.id === 'gunship' ? 0.15 : 0, -(gx + len/2)*k); g.add(m);
  }
  if (sd.id === 'gunship'){ const tb = new THREE.BoxGeometry(2.2, 0.9, 2.4); const tm = new THREE.Mesh(tb, basic(fill)); tm.position.set(0, top + 0.3, 0.6); g.add(tm); const te = new THREE.LineSegments(new THREE.EdgesGeometry(tb), lineMat(col)); te.position.copy(tm.position); g.add(te); }
  if (sd.id === 'bulwark'){ const rg = new THREE.TorusGeometry(4.6, 0.12, 6, 40); rg.rotateX(Math.PI/2); const r = new THREE.Mesh(rg, basic(col, {transparent:true, opacity:0.7})); r.position.y = 0; g.add(r); }
  g.userData.tailZ = rearZ + 0.8;
  return g;
}
function applyShipMesh(){
  if (ship.userData.body) ship.remove(ship.userData.body);
  const body = buildShipMesh(shipDef().id); ship.add(body); ship.userData.body = body;
  flame.position.set(0, 0, body.userData.tailZ);
}
applyShipMesh();
let prevR = null, prevScene = null, prevCam = null, prevShip = null, prevId = null;
function drawHangarPreview(t){
  const c = $('shipPrev'); if (!c) return;
  try {
    if (!prevR){
      prevR = new THREE.WebGLRenderer({canvas:c, antialias:true, alpha:true});
      prevScene = new THREE.Scene(); prevCam = new THREE.PerspectiveCamera(32, 36/20, 0.1, 200);
      prevCam.position.set(0, 8, 20); prevCam.lookAt(0, -0.5, 0);
      const grid = new THREE.GridHelper(40, 20, 0x0b6f94, 0x0b3a52); grid.position.y = -3; prevScene.add(grid);
    }
    const w = c.clientWidth, h = c.clientHeight;
    if (w && h && (prevR._w !== w || prevR._h !== h)){ prevR._w = w; prevR._h = h; prevR.setPixelRatio(DPR); prevR.setSize(w, h, false); prevCam.aspect = w/h; prevCam.updateProjectionMatrix(); }
    if (prevId !== hangarSel){ if (prevShip) prevScene.remove(prevShip); prevShip = buildShipMesh(hangarSel); prevScene.add(prevShip); prevId = hangarSel; }
    prevShip.rotation.y = t*0.7; prevShip.rotation.z = Math.sin(t*0.9)*0.18; prevShip.position.y = Math.sin(t*1.3)*0.3;
    prevR.render(prevScene, prevCam);
  } catch(e){}
}


