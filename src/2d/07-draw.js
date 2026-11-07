// ---------- draw ----------
let gridOff = 0;
function drawBG(t, dt){
  ctx.fillStyle = '#04050d'; ctx.fillRect(0,0,W,H);
  if (!stars){ stars = Array.from({length:120}, () => ({x:Math.random(), y:Math.random(), z:Math.random()})); }
  for (const s of stars){ ctx.fillStyle = `rgba(150,220,255,${0.15+s.z*0.5})`; const x = ((s.x*W - t*8*s.z) % W + W) % W; ctx.fillRect(x, s.y*H, 1+s.z, 1+s.z); }
  const sz = 56; gridOff = (t*14) % sz;
  ctx.strokeStyle = 'rgba(0,200,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -sz + gridOff; x < W; x += sz){ ctx.moveTo(x,0); ctx.lineTo(x,H); }
  for (let y = -sz + gridOff; y < H; y += sz){ ctx.moveTo(0,y); ctx.lineTo(W,y); }
  ctx.stroke();
  // binary rain
  ctx.fillStyle = 'rgba(0,255,200,0.05)'; ctx.font = '12px monospace';
  for (let i=0;i<28;i++){ const x = (i*137.5) % W, y = ((t*40 + i*91) % (H+40)) - 20; ctx.fillText(((i*7+Math.floor(t*3))%2)?'1':'0', x, y); }
}

function drawPickup(k, t){
  if (k.life < 3 && Math.floor(t*8) % 2) return;
  ctx.save(); ctx.translate(k.x, k.y);
  if (k.type === 'bit'){
    ctx.rotate(k.rot); ctx.shadowColor = '#0ff'; ctx.shadowBlur = 8; ctx.fillStyle = '#7ff';
    ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(4,0); ctx.lineTo(0,5); ctx.lineTo(-4,0); ctx.closePath(); ctx.fill();
  } else {
    const d = PICKUPS[k.type], r = 12 + Math.sin(t*5)*1.2;
    ctx.shadowColor = d.c; ctx.shadowBlur = 16; ctx.strokeStyle = d.c; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(5,12,25,.85)';
    ctx.beginPath(); for (let i=0;i<6;i++){ const a = i*Math.PI/3 + k.rot*0.3; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = d.c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${d.g.length > 1 ? 8 : 13}px Consolas,monospace`; ctx.fillText(d.g, 0, 1);
  }
  ctx.restore();
}

function drawShip(x,y,a,thrust,alpha=1,boosting=false,fw=0,t=0){
  if (fw > 0 && (fw > 1.5 || Math.floor(t*10)%2)){
    ctx.save(); ctx.strokeStyle = '#c084fc'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55 + Math.sin(t*10)*0.2;
    ctx.beginPath(); for (let i=0;i<8;i++){ const an = i*Math.PI/4 + t; ctx.lineTo(x+Math.cos(an)*28, y+Math.sin(an)*28); } ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.translate(x,y); ctx.rotate(a); ctx.globalAlpha = alpha;
  const sd = shipDef(), tl = SHIP_SHAPES[sd.id].tail;
  if (boosting){ ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.strokeStyle = '#dff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tl,-5); ctx.lineTo(tl-19-Math.random()*14,0); ctx.lineTo(tl,5); ctx.stroke(); }
  drawShipShape(ctx, sd.id, 0, 0, 0, 1, sd.color, sd.fill);
  if (thrust){ ctx.lineWidth = 2; ctx.strokeStyle='#fa3'; ctx.shadowColor='#f80'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(tl,-4); ctx.lineTo(tl-9-Math.random()*8,0); ctx.lineTo(tl,4); ctx.stroke(); }
  ctx.restore();
}

function drawVirus(v){
  ctx.save(); ctx.translate(v.x,v.y); ctx.rotate(v.rot);
  ctx.shadowColor = '#e040fb'; ctx.shadowBlur = 12; ctx.strokeStyle = '#f6f'; ctx.fillStyle = '#4a0a55'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i=0;i<16;i++){ const r = i%2 ? 7 : 13; const a = i*Math.PI/8; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,2.5,0,7); ctx.fill();
  ctx.restore();
}

function drawIcon(ic, t){
  const s = Math.round(50*Math.max(0.62, Math.min(1, H/520))), y = ic.y + Math.sin(ic.bob*2)*2;
  ctx.save(); ctx.translate(ic.x, y);
  if (ic.infected){
    const j = 1.5; ctx.translate((Math.random()-.5)*j, (Math.random()-.5)*j);
    ctx.shadowColor = '#f23'; ctx.shadowBlur = 18 + Math.sin(t*8)*6;
  } else { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10; }
  ctx.drawImage(ic.img, -s/2, -s/2, s, s);
  ctx.shadowBlur = 0;
  if (ic.infected){
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,20,60,${0.35+Math.sin(t*6)*0.1})`; ctx.fillRect(-s/2+6,-s/2+2,s-12,s-4);
    ctx.globalCompositeOperation = 'source-over';
    // hp pips
    for (let i=0;i<ic.hp;i++){ ctx.fillStyle='#f35'; ctx.fillRect(-9+i*7, s/2+12, 5, 3); }
  }
  if (ic.flash > 0){ ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(-s/2+8,-s/2+3,s-16,s-6); ctx.globalAlpha = 1; }
  ctx.font = '10px Consolas,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = ic.infected ? '#f8a' : '#bfe';
  ctx.fillText(short(ic.f.name), 0, s/2 + 8);
  ctx.restore();
}

function drawBoss(t){
  const b = boss, r = 46 + Math.sin(t*4)*4;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.shadowColor = '#f23'; ctx.shadowBlur = 40;
  ctx.fillStyle = b.flash > 0 ? '#fff' : '#3a0410'; ctx.strokeStyle = '#f35'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i=0;i<24;i++){ const rr = (i%2? r*0.72 : r) + Math.sin(t*6+i)*3; const a = i*Math.PI/12 + t*0.4; ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // eye
  const ex = P ? Math.max(-8,Math.min(8,(P.x-b.x)/40)) : 0, ey = P ? Math.max(-6,Math.min(6,(P.y-b.y)/40)) : 0;
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffd'; ctx.beginPath(); ctx.ellipse(0,0,20,13,0,0,7); ctx.fill();
  ctx.fillStyle = '#c00'; ctx.beginPath(); ctx.arc(ex,ey,8,0,7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex,ey,2.5,7,0,0,7); ctx.fill();
  ctx.restore();
  // hp bar
  const w = Math.min(420, W*0.6);
  ctx.fillStyle = '#300'; ctx.fillRect(W/2-w/2, H-34, w, 10);
  ctx.fillStyle = '#f35'; ctx.fillRect(W/2-w/2, H-34, w*b.hp/b.max, 10);
  ctx.fillStyle = '#f9a'; ctx.font = '12px Consolas,monospace'; ctx.textAlign = 'center'; ctx.fillText('INNER DEMON', W/2, H-40);
}


