let _hudLast = 0, bossBarBottom = 0; const XH = {x:0, y:0, r:10, on:false};
function drawHUD(t){
  if (!boss) bossBarBottom = 0;
  hudDt = _hudLast ? Math.min(0.05, Math.max(0.001, t - _hudLast)) : 0.016; _hudLast = t;
  hx.clearRect(0,0,W,H);
  if (!P || G.state !== 'play') return;
  if (hitFlash > 0){ hx.fillStyle = `rgba(255,30,60,${hitFlash*0.5})`; hx.fillRect(0,0,W,H); }
  if (fpv && P.alive){
    if (P.pw.firewall > 0){ const g = hx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7); g.addColorStop(0,'rgba(168,85,247,0)'); g.addColorStop(1,'rgba(168,85,247,.35)'); hx.fillStyle = g; hx.fillRect(0,0,W,H); }
    if (P.boosting){ hx.strokeStyle = 'rgba(200,255,255,.18)'; hx.lineWidth = 1.5; hx.beginPath();
      for (let i=0;i<14;i++){ const a = i/14*Math.PI*2 + t*3, r0 = Math.min(W,H)*(0.35+Math.random()*0.1), r1 = r0 + 40 + Math.random()*60; hx.moveTo(W/2+Math.cos(a)*r0, H/2+Math.sin(a)*r0); hx.lineTo(W/2+Math.cos(a)*r1, H/2+Math.sin(a)*r1); } hx.stroke(); }
    drawCockpitFrame(t);
  }
  // targets
  for (const ic of icons){
    const p = project(ic.g.position); if (!p) continue;
    const d = ic.g.position.distanceTo(camera.position), s = Math.max(9, Math.min(40, 900/d));
    bracket(p.x, p.y, s, ic.infected ? '#ff4466' : ic.held ? '#fbbf24' : '#4ade80', d < 260 ? short(ic.f.name) + (ic.infected ? ' ⚠' : ic.held ? ' ⚑ STOLEN' : '') : (d < 600 ? Math.round(d)+'m' : null));
  }
  for (const v of viruses){ if (!v.disguised) continue;   // a Trojan draws exactly like a clean icon
    const p = project(v.g.position); if (!p) continue;
    const d = v.g.position.distanceTo(camera.position), s = Math.max(9, Math.min(40, 900/d));
    bracket(p.x, p.y, s, '#4ade80', d < 260 ? short(v.fname) : (d < 600 ? Math.round(d)+'m' : null)); }
  for (const v of viruses){ if (v.hidden) continue; const p = project(v.g.position); if (!p) continue; const d = v.g.position.distanceTo(camera.position); if (d > 500) continue;
    hx.strokeStyle = v.col || '#e040fb'; hx.lineWidth = 1.5; const s = Math.max(6, Math.min(26, 500/d)); hx.beginPath(); hx.moveTo(p.x, p.y-s); hx.lineTo(p.x+s, p.y); hx.lineTo(p.x, p.y+s); hx.lineTo(p.x-s, p.y); hx.closePath(); hx.stroke();
    if (v.ai && v.kind !== 'bot' && v.kind !== 'popup' && d < 420){ hx.fillStyle = v.col; hx.font = 'bold 10px Consolas,monospace'; hx.textAlign = 'center'; hx.fillText(v.label + (v.max > 3 ? ' ' + Math.max(0, v.hp) + '/' + v.max : ''), p.x, p.y - s - 5); } }
  for (const k of pickups){ if (k.type === 'bit') continue; const p = project(k.g.position); if (!p) continue; const d = k.g.position.distanceTo(camera.position); if (d > 300) continue;
    hx.fillStyle = PICKUPS[k.type].c; hx.font = 'bold 10px Consolas,monospace'; hx.textAlign = 'center'; hx.fillText(PICKUPS[k.type].name, p.x, p.y - Math.max(10, 300/d)); }
  if (boss){ const p = project(boss.g.position); if (p) bracket(p.x, p.y, Math.max(30, Math.min(120, 6000/boss.g.position.distanceTo(camera.position))), '#ff3355', 'INNER DEMON'); }
  // where the nose points (320m out) - the crosshair lives here unless it's locked onto a target
  const ap = P.alive ? project(_t2.copy(P.pos).addScaledVector(fwd, 320)) : null;
  const apPt = ap ? {x:ap.x, y:ap.y} : null;
  // lead gates: solid = coasting path (no thrust), faint ghosts = path with (smoothed) thrust
  if (P.alive && P.vel.length() > 6 && hudMode !== 'minimal'){
    const kpos = 1 - Math.exp(-hudDt/0.1);           // gates glide to new positions
    const coast = forecast(0, 0), ghost = forecast(P.thrSm, P.brkSm);
    const fade = Math.min(1, P.thrSm/0.3);
    gateSm.coast = smoothGates(gateSm.coast, coast, kpos);
    gateSm.ghost = smoothGates(gateSm.ghost, ghost, kpos);
    // (5) usefulness: drifting off the nose, or turning
    const slip = _t.copy(P.vel).normalize().angleTo(fwd), turnR = Math.hypot(P.rate.x, P.rate.y, P.rate.z);
    const useNow = Math.max(Math.min(1, Math.max(0, (slip - 0.05)/0.12)), Math.min(1, Math.max(0, (turnR - 0.12)/0.45)));
    gateSm.use = (gateSm.use || 0) + (useNow - (gateSm.use || 0)) * (1 - Math.exp(-hudDt/(useNow > (gateSm.use || 0) ? 0.08 : 0.5)));
    if (fade > 0.04) drawGates(gateSm.ghost, true, fade, apPt, gateSm.use);
    drawGates(gateSm.coast, false, 1, apPt, gateSm.use);
  } else { gateSm.coast = gateSm.ghost = null; }
  if (P.alive && P.vel.length() > 6 && hudMode !== 'minimal'){
    // if the travel direction itself is off-screen, point to it
    const fp = project(_pp.copy(P.pos).addScaledVector(_pv.copy(P.vel).normalize(), 400));
    const onScreen = fp && fp.x > 20 && fp.x < W-20 && fp.y > 20 && fp.y < H-20;
    if (!onScreen){
      _pv.copy(P.vel).normalize().transformDirection(camera.matrixWorldInverse);
      const back = _pv.z > 0, ang = Math.atan2(-_pv.y, _pv.x) , rx = Math.min(W, H)*0.36, ry = rx*0.85;
      const ax = W/2 + Math.cos(ang)*rx, ay = H/2 + Math.sin(ang)*ry;
      hx.save(); hx.translate(ax, ay); hx.rotate(ang);
      hx.fillStyle = 'rgba(190,255,150,.8)'; hx.beginPath(); hx.moveTo(10,0); hx.lineTo(-6,-7); hx.lineTo(-3,0); hx.lineTo(-6,7); hx.closePath(); hx.fill();
      hx.restore();
      hx.font = 'bold 9px Consolas,monospace'; hx.textAlign = 'center'; hx.fillStyle = 'rgba(190,255,150,.7)';
      hx.fillText(back ? 'DRIFT (BEHIND)' : 'DRIFT', ax - Math.cos(ang)*22, ay - Math.sin(ang)*18 + 3);
    }
  }
  // gun pipper: where your shots will be 320m out, including the drift they inherit from the ship
  if (P.alive && hudMode !== 'minimal'){
    const pip = project(_apV.copy(P.pos).addScaledVector(fwd, 320).addScaledVector(P.vel, 320/520));
    const off = pip && ap ? Math.hypot(pip.x-ap.x, pip.y-ap.y) : 0;
    if (pip && (hudMode === 'full' || off > 16)){
      const pa = hudMode === 'full' ? 0.8 : Math.min(0.8, (off - 16)/30 + 0.2);
      hx.strokeStyle = `rgba(255,230,140,${pa})`; hx.lineWidth = 1.4; hx.beginPath();
      hx.moveTo(pip.x, pip.y-6); hx.lineTo(pip.x+6, pip.y); hx.lineTo(pip.x, pip.y+6); hx.lineTo(pip.x-6, pip.y); hx.closePath(); hx.stroke();
      if (ap && off > 8){ hx.strokeStyle = `rgba(255,230,140,${pa*0.35})`; hx.beginPath(); hx.moveTo(ap.x, ap.y); hx.lineTo(pip.x, pip.y); hx.stroke(); }
    }
  }
  // targeting: amber brackets while closing in; once locked the crosshair snaps onto the LEAD point and light brackets mark the enemy (4)
  let tp = null, lockR = 12, leadP = null;
  if (P.alive && TGT){
    tp = project(TGT.pos);
    if (tp){ const lt = TGT.d/520; leadP = project(_apV.copy(TGT.pos).addScaledVector(TGT.vel, lt).addScaledVector(P.vel, -lt)); }
    if (tp){
      const d = TGT.pos.distanceTo(camera.position), base = Math.max(14, Math.min(46, 1200/d)); lockR = 13;
      if (TGT.locked){
        // light corner brackets on the enemy itself, so you can see what the lead reticle belongs to
        const b = base*1.05 + 8, c = Math.max(6, b*0.38);
        const brk = () => { hx.beginPath();
          for (const [sx, sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ const cx = tp.x + sx*b, cy = tp.y + sy*b; hx.moveTo(cx - sx*c, cy); hx.lineTo(cx, cy); hx.lineTo(cx, cy - sy*c); } };
        hx.strokeStyle = 'rgba(0,8,16,.55)'; hx.lineWidth = 3.5; brk(); hx.stroke();
        hx.strokeStyle = 'rgba(255,190,200,.75)'; hx.lineWidth = 1.4; brk(); hx.stroke();
        if (hudMode !== 'minimal'){ hx.font = '10px Consolas,monospace'; hx.textAlign = 'center'; hx.fillStyle = 'rgba(255,200,210,.85)'; hx.fillText(`${TGT.label} · ${Math.round(TGT.d)}m`, tp.x, tp.y + b + 13); }
      }
      if (!TGT.locked){
        const f = Math.max(0, Math.min(1, (TGT.ang - LOCK_ANG())/(NEAR_ANG - LOCK_ANG()))), r = base*1.2 + 12 + f*46, rot = Math.PI/4;
        hx.strokeStyle = `rgba(251,191,36,${0.85 - f*0.45})`; hx.lineWidth = 1.6; hx.beginPath();
        for (let i=0;i<4;i++){ const a = rot + i*Math.PI/2; const cx = tp.x + Math.cos(a)*r, cy = tp.y + Math.sin(a)*r;
          hx.moveTo(cx - Math.cos(a)*10 + Math.cos(a+Math.PI/2)*8, cy - Math.sin(a)*10 + Math.sin(a+Math.PI/2)*8); hx.lineTo(cx, cy); hx.lineTo(cx - Math.cos(a)*10 - Math.cos(a+Math.PI/2)*8, cy - Math.sin(a)*10 - Math.sin(a+Math.PI/2)*8); }
        hx.stroke();
        if (ap && hudMode !== 'minimal'){ hx.strokeStyle = 'rgba(251,191,36,.3)'; hx.setLineDash([4,6]); hx.beginPath(); hx.moveTo(ap.x, ap.y); hx.lineTo(tp.x, tp.y); hx.stroke(); hx.setLineDash([]); }
        hx.font = '10px Consolas,monospace'; hx.textAlign = 'center'; hx.fillStyle = 'rgba(253,230,138,.85)'; hx.fillText('TRACKING', tp.x, tp.y - r - 6);
      }
    }
  }
  // missile seeker: orange diamond, shrinks while the lock builds, solid + MSL LOCK when ready
  if (P.alive && MS.tgt){
    const mp = project(MS.tgt.pos);
    if (mp){
      const f = Math.min(1, MS.t/MSL_LOCK_T), sz = MS.locked ? 20 : 44 - f*22, col = MS.locked ? '#fb923c' : `rgba(251,146,60,${0.45 + f*0.4})`;
      hx.strokeStyle = 'rgba(0,8,16,.6)'; hx.lineWidth = 4; hx.beginPath(); hx.moveTo(mp.x, mp.y-sz); hx.lineTo(mp.x+sz, mp.y); hx.lineTo(mp.x, mp.y+sz); hx.lineTo(mp.x-sz, mp.y); hx.closePath(); hx.stroke();
      hx.strokeStyle = col; hx.lineWidth = MS.locked ? 2.4 : 1.6; if (!MS.locked) hx.setLineDash([5,4]);
      hx.beginPath(); hx.moveTo(mp.x, mp.y-sz); hx.lineTo(mp.x+sz, mp.y); hx.lineTo(mp.x, mp.y+sz); hx.lineTo(mp.x-sz, mp.y); hx.closePath(); hx.stroke(); hx.setLineDash([]);
      hx.font = 'bold 10px Consolas,monospace'; hx.textAlign = 'left'; hx.fillStyle = col;
      hx.fillText(MS.locked ? ((INF() || P.msl > 0) ? 'MSL LOCK' : 'MSL LOCK · EMPTY') : 'MSL', mp.x + sz + 6, mp.y + 4);
    }
  }
  // missile status panel (fixed, just above the navball): LOCKING with a fill bar, then a big flashing LOCKED · FIRE
  if (P.alive && MS.tgt){
    const f = Math.min(1, MS.t/MSL_LOCK_T), have = INF() || P.msl > 0, ready = MS.locked && have && MS.cool <= 0;
    const keyHint = TC.used ? '' : (padGp ? ' (X)' : ' (R / RMB)');
    const label = !MS.locked ? `MISSILE LOCKING ${Math.round(f*100)}%` : !have ? 'MISSILE LOCKED · NO MISSILES' : MS.cool > 0 ? 'MISSILE LOCKED · RELOADING' : `◆ MISSILE LOCKED · FIRE${keyHint}`;
    hx.font = 'bold 14px Consolas,monospace';
    const bw = Math.max(230, hx.measureText(label).width + 30), bh = 30, bx = W/2 - bw/2, by = H - (H > 360 ? 14 : 6) - NB - bh - 10,   // just above the navball
       flash = Math.floor(performance.now()/180) % 2;
    hx.fillStyle = 'rgba(2,8,16,.72)'; hx.fillRect(bx, by, bw, bh);
    hx.lineWidth = MS.locked ? 2.5 : 1.5; hx.strokeStyle = MS.locked ? (have ? (flash ? '#ffb347' : '#fb923c') : '#f45') : 'rgba(251,146,60,.55)'; hx.strokeRect(bx, by, bw, bh);
    if (!MS.locked){ hx.fillStyle = 'rgba(251,146,60,.35)'; hx.fillRect(bx + 2, by + 2, (bw - 4)*f, bh - 4); }
    else if (ready){ hx.fillStyle = flash ? 'rgba(251,146,60,.5)' : 'rgba(251,146,60,.32)'; hx.fillRect(bx + 2, by + 2, bw - 4, bh - 4); }
    hx.font = 'bold 14px Consolas,monospace'; hx.textAlign = 'center';
    hx.fillStyle = MS.locked ? (have ? '#fff4e0' : '#f88') : '#fcd9b0';
    hx.fillText(label, W/2, by + 20);
  }
  // aim-lead marker: where to point so shots meet the target (its motion and your drift included).
  // Shown while tracking AND locked, in its own color (white core, gold ring) so it never reads as an enemy.
  if (P.alive && TGT && tp){
    const lead = leadP;
    if (lead){
      const sep = Math.hypot(lead.x - tp.x, lead.y - tp.y), la = TGT.locked ? 1 : 0.85;
      if (sep > 3){ hx.strokeStyle = `rgba(255,212,0,${0.45*la})`; hx.lineWidth = 1; hx.setLineDash([3,3]); hx.beginPath(); hx.moveTo(tp.x, tp.y); hx.lineTo(lead.x, lead.y); hx.stroke(); hx.setLineDash([]); }
      hx.fillStyle = 'rgba(0,8,16,.7)'; hx.beginPath(); hx.arc(lead.x, lead.y, 6.5, 0, 7); hx.fill();
      hx.strokeStyle = `rgba(255,212,0,${la})`; hx.lineWidth = 2; hx.beginPath(); hx.arc(lead.x, lead.y, 5, 0, 7); hx.stroke();
      hx.fillStyle = `rgba(255,255,255,${la})`; hx.beginPath(); hx.arc(lead.x, lead.y, 2, 0, 7); hx.fill();
    }
  }
  // (3)(4) crosshair: drawn last, bright with a dark outline; slides onto a locked target and turns red
  if (ap){
    const locked = !!(TGT && TGT.locked && tp), want = locked ? (leadP || tp) : ap, ks = 1 - Math.exp(-hudDt/0.06);
    if (!XH.on){ XH.x = want.x; XH.y = want.y; XH.r = 10; XH.on = true; }
    XH.x += (want.x - XH.x)*ks; XH.y += (want.y - XH.y)*ks; XH.r += ((locked ? lockR : 10) - XH.r)*ks;
    const x = XH.x, y = XH.y, r = XH.r, col = locked ? '#ff4d6d' : '#aaffff';
    const shape = () => { hx.beginPath(); hx.arc(x, y, r, 0, 7);
      if (locked){ const spin = t*2.5; for (let i=0;i<4;i++){ const a = spin + i*Math.PI/2; hx.moveTo(x + Math.cos(a)*(r+4), y + Math.sin(a)*(r+4)); hx.lineTo(x + Math.cos(a)*(r+12), y + Math.sin(a)*(r+12)); } }
      else { hx.moveTo(x-r-9, y); hx.lineTo(x-r-2, y); hx.moveTo(x+r+2, y); hx.lineTo(x+r+9, y); hx.moveTo(x, y-r-9); hx.lineTo(x, y-r-2); hx.moveTo(x, y+r+2); hx.lineTo(x, y+r+9); }
      hx.moveTo(x-2.5, y); hx.lineTo(x+2.5, y); hx.moveTo(x, y-2.5); hx.lineTo(x, y+2.5); };
    hx.lineCap = 'round';
    hx.strokeStyle = 'rgba(0,8,16,.75)'; hx.lineWidth = 5; shape(); hx.stroke();
    hx.strokeStyle = col; hx.lineWidth = 2.2; hx.shadowColor = col; hx.shadowBlur = locked ? 10 : 6; shape(); hx.stroke(); hx.shadowBlur = 0;
    hx.lineCap = 'butt';
    if (locked){
      // true nose stays marked with a small dot; the reticle itself sits on the lead point
      hx.fillStyle = 'rgba(0,8,16,.7)'; hx.beginPath(); hx.arc(ap.x, ap.y, 4, 0, 7); hx.fill();
      hx.fillStyle = '#aaffff'; hx.beginPath(); hx.arc(ap.x, ap.y, 2.2, 0, 7); hx.fill();
      hx.font = 'bold 11px Consolas,monospace'; hx.textAlign = 'center'; hx.fillStyle = Math.floor(t*6)%2 ? '#ff6680' : '#ffb3c0';
      hx.fillText('LOCK', x, y - r - 16);
    }
  } else XH.on = false;
  // floating messages
  hx.textAlign = 'center'; hx.font = 'bold 12px Consolas,monospace';
  let stackY = H*0.30;
  for (const m of msgs){
    hx.globalAlpha = Math.min(1, m.life*1.5); hx.fillStyle = m.color;
    let p = m.pos ? project(m.pos) : null;
    if (p) hx.fillText(m.text, p.x, p.y - 26 - (1.3-m.life)*30);
    else { hx.fillText(m.text, W/2, stackY); stackY += 18; }
  }
  hx.globalAlpha = 1;
  if (banner){ const a = Math.min(1, banner.life*2, (banner.max-banner.life)*4); hx.globalAlpha = a; hx.font = `bold ${Math.round(30*Math.max(0.55, Math.min(1, H/560)))}px Consolas,monospace`; hx.fillStyle = '#5ff'; hx.shadowColor = '#0ff'; hx.shadowBlur = 18; hx.fillText(banner.t, W/2, Math.max(H*0.22, 78, bossBarBottom + 34)); hx.shadowBlur = 0; hx.globalAlpha = 1; }
  // boundary warning
  drawHazHUD(); drawExitMarker();
  if (P.pos.length() > R*0.92){ hx.font = 'bold 16px Consolas,monospace'; hx.fillStyle = Math.floor(t*4)%2 ? '#fc4' : '#f84'; hx.fillText('⚠ SECTOR BOUNDARY', W/2, H*0.16); }
  const hs = Math.max(0.58, Math.min(1, H/560)), WW = W/hs; hx.save(); hx.scale(hs, hs);
  // top-left stats
  hx.textAlign = 'left'; hx.font = 'bold 16px Consolas,monospace'; hx.fillStyle = '#5ff'; hx.shadowColor = '#0ff'; hx.shadowBlur = 6;
  hx.fillText('SCORE ' + G.score, 16, 26); hx.shadowBlur = 0;
  const bw = 140 * S.maxShield/100, sh = Math.max(0, P.shield)/S.maxShield;
  if (!fpv){
  hx.fillStyle = '#0a2433'; hx.fillRect(16, 36, bw, 8);
  hx.fillStyle = P.pw.firewall > 0 ? '#c084fc' : sh > 0.5 ? '#5ff' : sh > 0.25 ? '#fc4' : '#f45'; hx.fillRect(16, 36, bw*sh, 8);
  hx.font = '10px Consolas,monospace'; hx.fillStyle = '#7ab'; hx.fillText('SHIELD', bw+22, 44);
  const inf = INF(), mini = (y, w, frac, bg, fg, lab) => { hx.fillStyle = bg; hx.fillRect(16, y, w, 5); hx.fillStyle = fg; hx.fillRect(16, y, w*Math.max(0, Math.min(1, frac)), 5); hx.fillStyle = '#7ab'; hx.fillText(lab, w+22, y+6); };
  const hlw = 140 * S.maxHull/100, hl = Math.max(0, P.hull)/S.maxHull;
  mini(48, hlw, hl, '#1b2a0a', hl > 0.5 ? '#a3e635' : hl > 0.3 ? '#fc4' : '#f45', 'HULL');
  const tw = 140 * S.tank/100;
  mini(58, tw, P.boost/S.tank, '#2a1f08', P.boosting ? '#fff' : '#fbbf24', 'BOOST');
  const fw2 = Math.min(200, 140 * S.maxFuel/(100*FUEL_MULT));   // grows with tank upgrades, capped
  mini(68, fw2, inf ? 1 : P.fuel/S.maxFuel, '#082a33', !inf && P.fuel/S.maxFuel < 0.25 ? '#f45' : '#22d3ee', inf ? 'FUEL ∞' : 'FUEL');
  hx.font = 'bold 13px Consolas,monospace'; hx.fillStyle = !inf && P.ammo < S.maxAmmo*0.15 ? '#fc4' : '#9ff';
  hx.fillText(inf ? 'AMMO ∞   MSL ∞' : `AMMO ${P.ammo}   MSL ${P.msl}`, 16, 90);
  hx.fillStyle = '#9ff';
  hx.fillText('LIVES ' + '▲'.repeat(Math.max(0, Math.min(9, G.lives))) + '   ◆ ' + G.bits, 16, 108);
  const warn = hl < 0.3 ? '⚠ HULL CRITICAL' : (!inf && P.fuel <= 0) ? '⚠ FUEL EMPTY · IMPULSE ONLY' : (!inf && P.ammo <= 0) ? '⚠ AMMO EMPTY · BACKUP GUN' : '';
  if (warn && Math.floor(t*4)%2){ hx.fillStyle = '#f67'; hx.fillText(warn, 16, 144); }
  let px = 16;
  for (const [k, lab] of [['spread','WIDE'],['rapid','RAPID'],['firewall','FIREWALL']]){
    if (P.pw[k] > 0){ hx.fillStyle = PICKUPS[k].c; hx.font = 'bold 11px Consolas,monospace'; const s = `${lab} ${Math.ceil(P.pw[k])}s`; hx.fillText(s, px, 126); px += hx.measureText(s).width + 12; }
  }
  }
  // top-right
  hx.textAlign = 'right'; hx.font = '13px Consolas,monospace'; hx.fillStyle = '#9cd';
  if (!fpv || TC.used){
  hx.fillText(G.cur.path, WW-16, 24);
  if (!G.cur.boss){ hx.fillStyle = '#7ab'; hx.fillText(G.cur.free ? `practice targets ${viruses.length} · no damage` : `icons ${icons.length} · queued ${queue.length} · viruses ${viruses.length}`, WW-16, 42); }
  hx.fillText('SPEED ' + Math.round(P.vel.length()) + '   THROTTLE ' + Math.round(Math.max(throttle, effThr)*100) + '%', WW-16, 60);
  hx.fillText('FLIGHT ' + FLIGHT_NAME[flightMode].toUpperCase() + ' (G)', WW-16, 78);
  }
  if (boss){
    const w = Math.min(420, WW*0.6);
    // sit below the touch buttons' top bar when it's showing
    const tt = TC.used && document.querySelector('#touch.on .ttop'), by = tt ? (tt.getBoundingClientRect().bottom + 22)/hs : 30;
    hx.fillStyle = '#300'; hx.fillRect(WW/2-w/2, by, w, 10); hx.fillStyle = '#f35'; hx.fillRect(WW/2-w/2, by, w*boss.hp/boss.max, 10);
    hx.fillStyle = '#f9a'; hx.font = '12px Consolas,monospace'; hx.textAlign = 'center'; hx.fillText('INNER DEMON  ' + Math.ceil(boss.hp/boss.max*100) + '%', WW/2, by - 6);
    bossBarBottom = (by + 10)*hs;
  }
  hx.restore();
  if (!mouse.locked && !TC.used && t - (G.startT||0) < 8){ hx.textAlign = 'center'; hx.fillStyle = 'rgba(160,220,255,.6)'; hx.font = '12px Consolas,monospace'; hx.fillText('Click the game to steer with the mouse · Esc releases it', W/2, H - NB - 38); }
  {
    const fsz = Math.round(Math.max(110, Math.min(216, H*0.27)));
    const top = fpv ? 44 : Math.round(132*Math.max(0.58, Math.min(1, H/560)));
    const bottom = fpv ? H - Math.max(64, Math.min(150, NB*0.72 + 26)) - 10 : H - NB - 30;
    drawFeed(hx, 16, top, fsz, bottom);
  }
  if (fpv && P.alive) drawCockpitPanels(t);
  // navball frame
  const sw = fpv && P.alive, nx = W/2 + (sw ? CK.x : 0), ny = H - NB/2 - (H > 360 ? 14 : 6) + (sw ? CK.y : 0);
  hx.strokeStyle = 'rgba(90,240,255,.65)'; hx.lineWidth = 2; hx.beginPath(); hx.arc(nx, ny, NB/2*0.9+4, 0, 7); hx.stroke();
  hx.strokeStyle = '#fc4'; hx.lineWidth = 2.5; hx.beginPath(); hx.moveTo(nx-16, ny); hx.lineTo(nx-6, ny); hx.lineTo(nx, ny+6); hx.lineTo(nx+6, ny); hx.lineTo(nx+16, ny); hx.stroke();
  hx.fillStyle = 'rgba(160,220,255,.7)'; hx.font = '10px Consolas,monospace'; hx.textAlign = 'center';
  if (H > 360 && !fpv){
  hx.fillText('● ahead   ○ behind', nx, ny + NB/2 + 10);
  hx.textAlign = 'left'; hx.fillText('RADAR ' + S.radar + 'm', nx + NB/2 + 8, ny + NB/2 - 4);
  }
  if (showFps){ hx.textAlign = 'left'; hx.font = '11px Consolas,monospace'; hx.fillStyle = perf.fps < 45 ? '#f67' : perf.fps < 58 ? '#fc4' : '#4ade80';
    hx.fillText(`FPS ${Math.round(perf.fps)} · render ${Math.round(glDPR*W)}×${Math.round(glDPR*H)} (${Math.round(RSCALE*100)}%)`, 16, H - (fpv ? 150 : 12)); }
  if (false){ hx.textAlign = 'center'; hx.font = 'bold 34px Consolas,monospace'; hx.fillStyle = '#5ff'; hx.fillText('PAUSED', W/2, H/2-40); hx.font = '14px Consolas,monospace'; hx.fillText('press P or Start to resume', W/2, H/2-14); }
}

function updateNavball(){
  qInv.copy(P.q).invert();
  nbInner.quaternion.copy(qInv);
  let i = 0;
  const add = (pos, color, big, always) => {
    _t.copy(pos).sub(P.pos); let d = _t.length(); if (d < 0.5 || (d > S.radar && !always)) return; if (d > S.radar) d = S.radar;
    _t.applyQuaternion(qInv).divideScalar(d);
    const s = nbBlip(i++); s.visible = true;
    s.position.copy(_t).multiplyScalar(1.0);
    const behind = _t.z > 0;
    s.material.map = behind ? RING : DOT; s.material.color.set(color); s.material.opacity = behind ? 0.75 : 1;
    const sz = (big ? 0.2 : 0.085) + (1 - d/S.radar)*0.07; s.scale.set(sz, sz, 1);
  };
  for (const ic of icons) add(ic.g.position, ic.infected ? 0xff3355 : 0x4ade80);
  for (const v of viruses){ if (v.disguised) add(v.g.position, 0x4ade80); else if (!v.hidden) add(v.g.position, v.nb || 0xe040fb); }   // Trojans pose as clean icons; cloaked Rootkits don't show
  if (S.radarPick) for (const k of pickups) if (k.type !== 'bit') add(k.g.position, PICKUPS[k.type].c);
  if (boss) add(boss.g.position, 0xff2244, true);
  for (const k of rocks) if (k.hp > 0 && k.g.position.distanceToSquared(P.pos) < 260*260) add(k.g.position, 0x9a7448);   // only nearby rocks
  for (const b of haz.bins) add(b.g.position, 0xff7a2a, true, true);   // always on the navball, even beyond radar range
  for (const g of haz.grids) add(g.g.position, g.on ? 0xff2a3a : 0x662030);
  if (haz.exit) add(haz.exit.g.position, haz.exit.open ? 0xffffff : 0xb8860b, haz.exit.open, haz.exit.open);   // the gate: white once open, always shown then
  if (P.inCloud) for (let j=0;j<i;j++) nbBlips[j].position.copy(randDir());   // static scrambles the navball
  if (P.vel.length() > 6){ // prograde: direction you're drifting
    _t.copy(P.vel).normalize().applyQuaternion(qInv);
    const s = nbBlip(i++); s.visible = true; s.position.copy(_t);
    const behind = _t.z > 0; s.material.map = RING; s.material.color.set(0xbfff96); s.material.opacity = behind ? 0.45 : 1;
    const sz = behind ? 0.13 : 0.19; s.scale.set(sz, sz, 1);
  }
  for (let j=i;j<nbBlips.length;j++) nbBlips[j].visible = false;
}

