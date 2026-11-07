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

