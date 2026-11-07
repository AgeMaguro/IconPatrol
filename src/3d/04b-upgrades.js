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

