// ---------- game state ----------
const G = { state:'title', sectors:[], cur:null, score:0, lives:3, cleared:0, paused:false, bits:0, up:{} };
// ---------- ship types ----------
const SHIPS = [
  {id:'patrol', hull:60, ammo:200, fuel:100, msl:4, aim:0.6,  name:'Patrol',  tag:'Balanced all-rounder',      desc:'The standard patrol craft. Even speed, handling, firepower and shields: good at everything, best at nothing.', speed:1,    turn:1,    fire:1,    shield:1,    barrels:0, color:'#77ffff', fill:'#063445'},
  {id:'racer', hull:40, ammo:120, fuel:70, msl:3, aim:0.4,   name:'Racer',   tag:'Very fast and nimble, fragile', desc:"A stripped-down needle. Much faster, with quick, tight handling, but thin shields and light guns. Dodge, don't tank.", speed:1.38, turn:1.35, fire:0.7,  shield:0.6,  barrels:0, color:'#fbbf24', fill:'#3a2a05'},
  {id:'fighter', hull:50, ammo:160, fuel:90, msl:5, aim:0.78, name:'Fighter', tag:'Hits hard, moves quick',     desc:'Swept wings with wingtip cannons that fire together in one volley at half the usual rate. Hits harder and moves quicker, paid for with a weaker shield.', speed:1.15, turn:1.12, fire:1.35, shield:0.75, barrels:0, volley:true, color:'#f472b6', fill:'#3a0a28'},
  {id:'bulwark', hull:100, ammo:180, fuel:150, msl:4, aim:0.52, name:'Bulwark', tag:'Heavy shields, slow',        desc:'A flying fortress. A huge shield that also recharges faster, and a short-range scatter gun alongside its main gun, but slow and heavy to turn.', speed:0.78, turn:0.78, fire:1,    shield:1.65, barrels:0, wide:true, color:'#4ade80', fill:'#06301a'},
  {id:'gunship', hull:75, ammo:260, fuel:120, msl:6, aim:0.68, name:'Gunship', tag:'Maximum firepower, slow',    desc:'Four forward barrels on a reinforced hull. Starts with twin shots and the fastest fire rate, but takes its time getting anywhere.', speed:0.84, turn:0.82, fire:1.6,  shield:1.1,  barrels:1, color:'#fb923c', fill:'#3a1a05'},
];
let shipId = SHIPS.some(x => x.id === lsGet('iconpatrol.ship')) ? lsGet('iconpatrol.ship') : 'patrol';
const shipDef = () => SHIPS.find(x => x.id === (G.ship || shipId)) || SHIPS[0];
// top-down outlines, nose toward +x (units = 2D pixels)
const SHIP_SHAPES = {
  patrol:  {poly:[[16,0],[-11,-10],[-6,0],[-11,10]], tail:-7},
  racer:   {poly:[[24,0],[4,-3],[-6,-4],[-13,-8],[-10,0],[-13,8],[-6,4],[4,3]], tail:-10, lines:[[[-2,-4],[-12,-12]],[[-2,4],[-12,12]]]},
  fighter: {poly:[[16,0],[5,-4],[-3,-15],[-9,-15],[-6,-4],[-9,0],[-6,4],[-9,15],[-3,15],[5,4]], tail:-8, guns:[[-3,-15,9],[-3,15,9]]},
  bulwark: {poly:[[12,0],[8,-9],[-4,-13],[-13,-9],[-13,9],[-4,13],[8,9]], tail:-13, inner:[[6,0],[2,-6],[-7,-6],[-7,6],[2,6]]},
  gunship: {poly:[[10,-6],[6,-11],[-12,-11],[-14,-5],[-14,5],[-12,11],[6,11],[10,6]], tail:-14, guns:[[10,-8,10],[10,-3,13],[10,3,13],[10,8,10]]},
};
function drawShipShape(g, id, x, y, a, scale, color, fill, alpha=1){
  const sh = SHIP_SHAPES[id] || SHIP_SHAPES.patrol;
  g.save(); g.translate(x, y); g.rotate(a); g.scale(scale, scale); g.globalAlpha *= alpha;
  g.lineWidth = 2/scale; g.strokeStyle = color; g.fillStyle = fill; g.shadowColor = color; g.shadowBlur = 14;
  g.beginPath(); sh.poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fill(); g.stroke();
  g.shadowBlur = 0;
  if (sh.inner){ g.beginPath(); sh.inner.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.stroke(); }
  if (sh.lines) for (const [[x1, y1], [x2, y2]] of sh.lines){ g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  if (sh.guns){ g.lineWidth = 3/scale; for (const [gx, gy, len] of sh.guns){ g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + len, gy); g.stroke(); } }
  g.restore();
}

const UPGRADES = [
  {k:'engine',  name:'Engine',          desc:'Stronger thrust and higher top speed.', costs:[15,30,45]},
  {k:'shield',  name:'Shield Capacity', desc:'Max shield 100 → 130 → 160 → 200.',     costs:[15,30,45]},
  {k:'regen',   name:'Auto-Repair',     desc:'Shield regenerates faster.',            costs:[12,25,40]},
  {k:'blaster', name:'Blaster Coils',   desc:'Faster fire rate.',                     costs:[20,35,50]},
  {k:'barrel',  name:'Multi-Barrel',    desc:'Twin shot, then triple spread.',        costs:[40,70]},
  {k:'tank',    name:'Boost Tank',      desc:'Bigger boost meter that refills faster.', costs:[12,24,36]},
  {k:'magnet',  name:'Bit Magnet',      desc:'Pull range 70 → 150 → 230 → 310 for bits, pickups and clean icons.', costs:[10,20,30]},
];
function freshUpgrades(){ const u = {}; UPGRADES.forEach(x => u[x.k] = 0); return u; }
function stats(){
  const u = G.up, sd = shipDef();
  return {
    thrust: 360*(1+0.18*u.engine)*sd.speed, top: 400*(1+0.12*u.engine)*sd.speed,
    maxShield: Math.round([100,130,160,200][u.shield]*sd.shield), regen: [2.5,5,7.5,10][u.regen]*sd.shield,
    cool: [0.16,0.13,0.11,0.09][u.blaster]/sd.fire, barrel: Math.min(2, u.barrel + sd.barrels),
    tank: [100,140,180,220][u.tank], tankRegen: [11,14,17,20][u.tank],
    magnet: [70,150,230,310][u.magnet],
  };
}
const PICKUPS = {
  patch:    {c:'#4ade80', g:'+',   w:30},
  ram:      {c:'#fbbf24', g:'»',   w:20},
  spread:   {c:'#60a5fa', g:'W',   w:18},
  rapid:    {c:'#fb923c', g:'R',   w:18},
  firewall: {c:'#c084fc', g:'F',   w:10},
  life:     {c:'#f9a8d4', g:'1UP', w:4},
};
function randPickup(){ let tot = 0; for (const k in PICKUPS) tot += PICKUPS[k].w; let r = Math.random()*tot; for (const k in PICKUPS){ r -= PICKUPS[k].w; if (r <= 0) return k; } return 'patch'; }
let S = stats(), pickups = [], cacheT = 14;
function dropAt(x, y, bits, pChance){
  for (let i=0;i<bits;i++){ const a = Math.random()*7, s = 40+Math.random()*80; pickups.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,type:'bit',life:10,rot:Math.random()*6}); }
  if (Math.random() < pChance) pickups.push({x,y,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,type:randPickup(),life:11,rot:0});
}
let P, bullets=[], icons=[], viruses=[], parts=[], msgs=[], timers=[], boss=null, banner, waveNo, queue, virusT, stars;

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
    + (typeof THREE !== 'undefined' ? `<div class="statrow"><span>Auto-aim</span><div class="statbar"><i style="width:${sd.aim*100}%;background:#ffd400"></i></div><span class="v">${Math.round(sd.aim*100)}%</span></div>` : '')
    + (sd.volley ? '<div class="statrow"><span>Guns</span><span style="grid-column:2/4;color:#fde68a">Twin wingtip volley, half fire rate</span></div>' : '')
    + (sd.wide ? '<div class="statrow"><span>Bonus</span><span style="grid-column:2/4;color:#fde68a">Built-in scatter shot (never runs out; 75% damage, 75% range)</span></div>' : '');
}
function launchRun(){ shipId = hangarSel; lsSet('iconpatrol.ship', shipId); const sec = pendingSectors; pendingSectors = null; startRun(sec); }
function newRun(sectors){ showHangar(sectors); }
function startRun(sectors){
  G.ship = shipId; G.sectors = sectors; G.score = 0; G.lives = 3; G.cleared = 0; G.bits = 0; G.up = freshUpgrades();
  showMap();
}
function drawHangarPreview(t){
  const c = $('shipPrev'); if (!c) return; const g = c.getContext('2d'), w = c.width, h = c.height;
  const sd = SHIPS.find(x => x.id === hangarSel), sh = SHIP_SHAPES[sd.id];
  g.clearRect(0,0,w,h);
  g.strokeStyle = 'rgba(0,200,255,.08)'; g.lineWidth = 1; g.beginPath();
  const off = (t*30) % 30; for (let y = -30 + off; y < h; y += 30){ g.moveTo(0,y); g.lineTo(w,y); } for (let x = 0; x < w; x += 30){ g.moveTo(x,0); g.lineTo(x,h); } g.stroke();
  const a = -Math.PI/2 + Math.sin(t*0.9)*0.25, sc = 4.2;
  g.save(); g.translate(w/2, h/2 + 10); g.rotate(a); g.strokeStyle = '#fa3'; g.shadowColor = '#f80'; g.shadowBlur = 12; g.lineWidth = 3;
  g.beginPath(); g.moveTo(sh.tail*sc, -4*sc); g.lineTo((sh.tail - 10 - Math.random()*6)*sc, 0); g.lineTo(sh.tail*sc, 4*sc); g.stroke(); g.restore();
  drawShipShape(g, sd.id, w/2, h/2 + 10, a, sc, sd.color, sd.fill);
}


function resetField(){
  feedClear();
  S = stats();
  P = {x:W/2, y:H/2, a:-Math.PI/2, vx:0, vy:0, shield:S.maxShield, inv:2, cool:0, alive:true, respawn:0, thrust:false,
       boost:S.tank, boostIdle:0, boosting:false, pw:{spread:0, rapid:0, firewall:0}};
  pickups=[]; cacheT = 12+Math.random()*6;
  bullets=[]; icons=[]; viruses=[]; parts=[]; msgs=[]; timers=[]; boss=null; banner=null; waveNo=0; virusT=2.5;
}

function startSector(sec){
  G.cur = sec; sec._waiting = false; resetField(); queue = sec.files.slice();
  hideAll(); G.state = 'play'; G.paused = false;
  nextWave();
}
function startBoss(){
  G.cur = {path:"DEMON'S GATE", boss:true, files:[]}; resetField(); queue = [];
  hideAll(); G.state='play'; G.paused=false;
  boss = {x:W/2, y:H*0.28, hp:90, max:90, t:0, fireT:2, spawnT:3, flash:0};
  setBanner("THE INNER DEMON AWAKENS"); SFX.wave();
}

function nextWave(){
  const batch = queue.splice(0, 8);
  waveNo++;
  for (const f of batch){
    let x, y, tries = 0;
    do { x = 60+Math.random()*(W-120); y = 80+Math.random()*(H-140); tries++; } while (Math.hypot(x-P.x,y-P.y) < 170 && tries < 30);
    const ang = Math.random()*Math.PI*2, sp = 10+Math.random()*20;
    icons.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,f,img:makeIcon(f),infected:false,hp:3,shootT:2+Math.random()*2,bob:Math.random()*6,flash:0});
  }
  const total = Math.ceil(G.cur.files.length/8);
  setBanner(total > 1 ? `WAVE ${waveNo}/${total}` : 'SECTOR BREACHED');
  SFX.wave();
}

function setBanner(t, dur=2){ banner = {t, life:dur, max:dur}; }
function later(s, fn){ timers.push({s, fn}); }
function msg(text, x, y, color='#5ff'){ msgs.push({text, x, y, life:1.2, color}); }
function burst(x, y, color, n=16, sp=160){
  for (let i=0;i<n;i++){ const a=Math.random()*7, s=sp*(0.3+Math.random()); parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.5,color}); }
}
function addScore(n){ G.score = Math.max(0, G.score + n); }

