function drawHUD(){
  const hs = Math.max(0.6, Math.min(1, H/520)), WW = W/hs, HH = H/hs; ctx.save(); ctx.scale(hs, hs);
  ctx.textAlign = 'left'; ctx.font = 'bold 16px Consolas,monospace'; ctx.fillStyle = '#5ff';
  ctx.shadowColor = '#0ff'; ctx.shadowBlur = 6;
  ctx.fillText('SCORE ' + G.score, 16, 26);
  ctx.shadowBlur = 0;
  // shield bar
  const bw = 140 * S.maxShield/100;
  ctx.fillStyle = '#0a2433'; ctx.fillRect(16, 36, bw, 8);
  const sh = Math.max(0, P.shield)/S.maxShield;
  ctx.fillStyle = P.pw.firewall > 0 ? '#c084fc' : sh > 0.5 ? '#5ff' : sh > 0.25 ? '#fc4' : '#f45'; ctx.fillRect(16, 36, bw*sh, 8);
  ctx.font = '10px Consolas,monospace'; ctx.fillStyle = '#7ab'; ctx.fillText('SHIELD', bw+22, 44);
  const tw = 140 * S.tank/100;
  ctx.fillStyle = '#2a1f08'; ctx.fillRect(16, 49, tw, 5);
  ctx.fillStyle = P.boosting ? '#fff' : '#fbbf24'; ctx.fillRect(16, 49, tw*P.boost/S.tank, 5);
  ctx.fillStyle = '#7ab'; ctx.fillText('BOOST', tw+22, 55);
  for (let i=0;i<Math.max(0,G.lives);i++) drawShipShape(ctx, shipDef().id, 24+i*24, 76, -Math.PI/2, 0.7, shipDef().color, shipDef().fill, 0.8);
  ctx.font = 'bold 14px Consolas,monospace'; ctx.fillStyle = '#7ff'; ctx.fillText('◆ ' + G.bits, 16, 104);
  let px = 16;
  for (const [k, lab] of [['spread','WIDE'],['rapid','RAPID'],['firewall','FIREWALL']]){
    if (P.pw[k] > 0){ ctx.fillStyle = PICKUPS[k].c; ctx.font = 'bold 11px Consolas,monospace'; const s = `${lab} ${Math.ceil(P.pw[k])}s`; ctx.fillText(s, px, 124); px += ctx.measureText(s).width + 12; }
  }
  ctx.textAlign = 'right'; ctx.font = '13px Consolas,monospace'; ctx.fillStyle = '#9cd';
  ctx.fillText(G.cur.path, WW-16, 24);
  if (!G.cur.boss){ ctx.fillStyle = '#7ab'; ctx.fillText(`icons ${icons.length}  ·  queued ${queue.length}  ·  viruses ${viruses.length}`, WW-16, 42); }
  drawFeed(ctx, 16, 140, 192, HH - 20);
  if (false){ ctx.textAlign='center'; ctx.font='bold 34px Consolas,monospace'; ctx.fillStyle='#5ff'; ctx.fillText('PAUSED', WW/2, HH/2); ctx.font='14px Consolas,monospace'; ctx.fillText('press P to resume', WW/2, HH/2+26); }
  ctx.restore();
}

let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now; const t = now/1000;
  pollPad(dt);
  if (!G.paused || G.state !== 'play') update(dt);
  drawBG(t);
  if (P && (G.state === 'play' || G.state === 'end')){
    for (const ic of icons) drawIcon(ic, t);
    if (boss) drawBoss(t);
    for (const v of viruses) drawVirus(v);
    ctx.shadowBlur = 8;
    for (const b of bullets){ ctx.shadowColor = ctx.fillStyle = b.enemy ? '#f46' : '#bff'; ctx.beginPath(); ctx.arc(b.x,b.y,b.enemy?3.5:2.5,0,7); ctx.fill(); }
    ctx.shadowBlur = 0;
    for (const p of parts){ ctx.globalAlpha = Math.min(1,p.life*2); ctx.fillStyle = p.color; ctx.fillRect(p.x-1.5,p.y-1.5,3,3); }
    ctx.globalAlpha = 1;
    for (const k of pickups) drawPickup(k, t);
    if (P.alive) drawShip(P.x, P.y, P.a, P.thrust, P.inv > 0 ? (Math.floor(t*12)%2 ? 0.35 : 1) : 1, P.boosting, P.pw.firewall, t);
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Consolas,monospace';
    for (const m of msgs){ ctx.globalAlpha = Math.min(1, m.life*1.5); ctx.fillStyle = m.color; ctx.fillText(m.text, m.x, m.y); }
    ctx.globalAlpha = 1;
    if (banner){ const a = Math.min(1, banner.life*2, (banner.max-banner.life)*4); ctx.globalAlpha = a; ctx.font = `bold ${Math.round(30*Math.max(0.55, Math.min(1, H/520)))}px Consolas,monospace`; ctx.fillStyle = '#5ff'; ctx.shadowColor='#0ff'; ctx.shadowBlur = 18; ctx.fillText(banner.t, W/2, H*0.42); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
    if (G.state === 'play') drawHUD();
  }
  if (G.state === 'hangar') drawHangarPreview(t);
  syncMenus();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
