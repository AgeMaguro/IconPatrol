// ---------- upgrades & pickups ----------
const G = { state:'title', sectors:[], cur:null, score:0, lives:3, cleared:0, paused:false, bits:0, up:{} };
// ---------- ship types ----------
const FUEL_MULT = 3;   // every ship's fuel tank is 3x its listed size (2026-11-06)
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
  {k:'engine',  name:'Engine',          desc:'Stronger thrust, higher top speed, burns less fuel.', costs:[15,30,45]},
  {k:'shield',  name:'Shield Capacity', desc:'Max shield 100 → 130 → 160 → 200, and a tougher hull.',     costs:[15,30,45]},
  {k:'regen',   name:'Auto-Repair',     desc:'Shield regenerates faster; patches up some hull at the start of each sector.',            costs:[12,25,40]},
  {k:'blaster', name:'Blaster Coils',   desc:'Faster fire rate and more ammo.',                     costs:[20,35,50]},
  {k:'barrel',  name:'Multi-Barrel',    desc:'Twin shot, then quad spread.',          costs:[40,70]},
  {k:'tank',    name:'Boost Tank',      desc:'Bigger boost meter that refills faster, and a bigger fuel tank.', costs:[12,24,36]},
  {k:'magnet',  name:'Bit Magnet',      desc:'Pull range 60 → 130 → 200 → 280 for bits, pickups and clean icons.', costs:[10,20,30]},
  {k:'radar',   name:'Radar Range',     desc:'Navball sees farther and shows pickups; missiles lock from farther out, +1 missile.', costs:[10,25]},
];
function freshUpgrades(){ const u = {}; UPGRADES.forEach(x => u[x.k] = 0); return u; }
function stats(){
  const u = G.up, sd = shipDef();
  return {
    thrust: 150*(1+0.18*u.engine)*sd.speed, top: 109*(1+0.12*u.engine)*sd.speed,   // 109 = the Fighter's comfortable 70% cruise (135 x 1.15 x 0.7) as everyone's 100%
    maxShield: Math.round([100,130,160,200][u.shield]*sd.shield), regen: [2.5,5,7.5,10][u.regen]*sd.shield,
    cool: [0.15,0.12,0.10,0.085][u.blaster]/sd.fire, barrel: Math.min(2, u.barrel + sd.barrels),
    tank: [100,140,180,220][u.tank], tankRegen: [11,14,17,20][u.tank],
    magnet: [60,130,200,280][u.magnet], radar: [700,1000,1400][u.radar], radarPick: u.radar > 0,
    maxHull: Math.round(sd.hull*[1,1.1,1.2,1.35][u.shield]), hullFix: [0,10,20,30][u.regen],
    maxAmmo: Math.round(sd.ammo*[1,1.15,1.3,1.5][u.blaster]),
    maxFuel: Math.round(sd.fuel*FUEL_MULT*[1,1.15,1.3,1.5][u.tank]), burn: [1.6,1.45,1.3,1.15][u.engine],   // fuel per second at full throttle
    maxMsl: sd.msl + u.radar, mslRange: [600,750,900][u.radar],
  };
}
const PICKUPS = {
  patch:    {c:'#4ade80', name:'SHIELD PATCH', w:30},
  ram:      {c:'#fbbf24', name:'BOOST REFILL', w:20},
  spread:   {c:'#60a5fa', name:'WIDE SHOT',    w:18},
  rapid:    {c:'#fb923c', name:'RAPID FIRE',   w:18},
  firewall: {c:'#c084fc', name:'FIREWALL',     w:10},
  life:     {c:'#f9a8d4', name:'EXTRA LIFE',   w:4},
  // resources: only from the resource roll (w:0 keeps them out of the power-up roll)
  ammo:     {c:'#e2e8f0', name:'AMMO',         w:0},
  fuel:     {c:'#22d3ee', name:'FUEL CELL',    w:0},
  hull:     {c:'#a3e635', name:'HULL REPAIR',  w:0},
  missile:  {c:'#f97316', name:'MISSILES +2',  w:0},
};
// resource drops lean toward whatever you're shortest on
function randResource(){
  const need = k => ({ammo: 1.35 - P.ammo/S.maxAmmo, fuel: 1.35 - P.fuel/S.maxFuel, hull: 1.2 - P.hull/S.maxHull, missile: 1.2 - P.msl/Math.max(1, S.maxMsl)})[k];
  const w = {ammo:40*need('ammo'), fuel:35*need('fuel'), hull:15*need('hull'), missile:12*need('missile')};
  let tot = 0; for (const k in w) tot += w[k]; let r = Math.random()*tot; for (const k in w){ r -= w[k]; if (r <= 0) return k; } return 'ammo';
}
function dropResource(at, chance){ if (P && Math.random() < chance) spawnPickup(at, randResource(), randDir().multiplyScalar(8)); }
function randPickup(){ let tot = 0; for (const k in PICKUPS) tot += PICKUPS[k].w; let r = Math.random()*tot; for (const k in PICKUPS){ r -= PICKUPS[k].w; if (r <= 0) return k; } return 'patch'; }

