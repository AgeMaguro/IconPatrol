// ---------- update ----------
function wrap(o, m=0){ if (o.x<-m) o.x+=W+2*m; else if (o.x>W+m) o.x-=W+2*m; if (o.y<-m) o.y+=H+2*m; else if (o.y>H+m) o.y-=H+2*m; }
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

function damage(n){
  if (!P.alive || P.inv > 0 || P.pw.firewall > 0) return;
  P.shield -= n; P.inv = 0.5; SFX.hurt(); rumble(120, 0.5);
  if (P.shield <= 0){
    P.alive = false; P.respawn = 1.8; rumble(400, 1); burst(P.x,P.y,'#5ff',40,260); SFX.boom();
    G.lives--;
    if (G.lives < 0) later(1.6, () => showEnd(false));
  }
}
function fireEnemy(x, y, a, sp=210){ bullets.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:3,enemy:true}); }

function update(dt){
  // timers
  for (const t of timers) t.s -= dt;
  const due = timers.filter(t => t.s <= 0); timers = timers.filter(t => t.s > 0); due.forEach(t => t.fn());
  if (G.state !== 'play') return;
  const diff = G.cleared;

  // player
  if (P.alive){
    let tTurn = 0, tThrust = false;
    if (TC.active && TC.mag > 0.25){ let d = Math.atan2(TC.y, TC.x) - P.a; d = Math.atan2(Math.sin(d), Math.cos(d)); tTurn = Math.max(-1, Math.min(1, d*2.5)); tThrust = TC.mag > 0.7; }
    const turn = (keys.right?1:0) - (keys.left?1:0) + pad.turn + tTurn;
    P.a += 4.2*shipDef().turn*Math.max(-1, Math.min(1, turn))*dt;
    const ca = Math.cos(P.a), sa = Math.sin(P.a);
    P.boosting = !!(keys.boost || pad.boost || TC.boost) && P.boost > 0;
    P.thrust = !!(keys.up || pad.up || tThrust) || P.boosting;
    if (P.boosting){
      if (!P.wasBoosting) beep(220,0.25,'sawtooth',0.035,400);
      P.boost = Math.max(0, P.boost - 45*dt); P.boostIdle = 0;
      P.vx += ca*S.thrust*1.8*dt; P.vy += sa*S.thrust*1.8*dt;
      for (let i=0;i<2;i++) parts.push({x:P.x-ca*12,y:P.y-sa*12,vx:-ca*220+(Math.random()-.5)*50,vy:-sa*220+(Math.random()-.5)*50,life:0.35,color:Math.random()<.5?'#9ff':'#fff'});
    } else {
      P.boostIdle += dt;
      if (P.boostIdle > 0.8) P.boost = Math.min(S.tank, P.boost + S.tankRegen*dt);
      if (P.thrust){ P.vx += ca*S.thrust*dt; P.vy += sa*S.thrust*dt;
        if (Math.random()<0.6) parts.push({x:P.x-ca*12,y:P.y-sa*12,vx:-ca*120+(Math.random()-.5)*60,vy:-sa*120+(Math.random()-.5)*60,life:0.25,color:'#fa3'}); }
    }
    P.wasBoosting = P.boosting;
    const drag = Math.pow(0.4, dt); P.vx *= drag; P.vy *= drag;
    const top = P.boosting ? S.top*1.7 : S.top, sp = Math.hypot(P.vx,P.vy);
    if (sp > top){ const ns = Math.max(top, sp - 600*dt); P.vx *= ns/sp; P.vy *= ns/sp; }
    P.x += P.vx*dt; P.y += P.vy*dt; wrap(P);
    P.cool -= dt; P.inv -= dt;
    for (const k in P.pw) P.pw[k] = Math.max(0, P.pw[k] - dt);
    P.shield = Math.min(S.maxShield, P.shield + S.regen*dt);
    if ((keys.fire || pad.fire || TC.fire || (TC.used && TC.auto && hostileAhead())) && P.cool <= 0){
      P.cool = S.cool * (P.pw.rapid > 0 ? 0.5 : 1) * (shipDef().volley ? 2 : 1);
      let shots = S.barrel === 0 ? [[0,0]] : S.barrel === 1 ? [[0,-5],[0,5]] : [[-0.12,0],[0,0],[0.12,0]];
      // Fighter: every barrel fires from both wingtip cannons at once (one volley)
      if (shipDef().volley) shots = shots.flatMap(([da, off]) => [[da, -15 + off*0.6], [da, 15 + off*0.6]]);
      // wide shot (pickup, or built into the Fighter): two to three pellets scattered at random in a cone each volley
      // Bulwark's built-in scatter is weaker (75% damage, 75% range); a W pickup is full strength
      const wide = P.pw.spread > 0 || shipDef().wide, wk = P.pw.spread > 0 ? 1 : 0.75;
      if (wide){ for (const side of [-1, 1]) shots.push([side*(0.1 + Math.random()*0.32), 0, 0.85 + Math.random()*0.25, wk]);
        if (Math.random() < 0.35) shots.push([(Math.random()*2 - 1)*0.42, 0, 0.85 + Math.random()*0.25, wk]); }
      for (const [da, off, spd = 1, wf = 1] of shots){
        const a = P.a + da, px = -sa*off, py = ca*off;
        bullets.push({x:P.x+ca*14+px, y:P.y+sa*14+py, vx:Math.cos(a)*560*spd+P.vx*0.4, vy:Math.sin(a)*560*spd+P.vy*0.4, life:0.9*wf, dmg:wf});
      }
      SFX.shoot();
    }
  } else if (G.lives >= 0){
    P.respawn -= dt;
    if (P.respawn <= 0){ Object.assign(P, {x:W/2,y:H/2,vx:0,vy:0,a:-Math.PI/2,shield:S.maxShield,boost:S.tank,inv:2.5,alive:true}); }
  }

  // bullets
  for (const b of bullets){ b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt; wrap(b); }

  // virus spawning
  const maxV = boss ? 6 : 2 + Math.min(5, diff);
  virusT -= dt;
  if (!boss && virusT <= 0 && viruses.length < maxV && icons.some(i=>!i.infected)){
    virusT = Math.max(1.4, 4.2 - diff*0.35) * (0.7+Math.random()*0.6);
    const side = Math.floor(Math.random()*4);
    const x = side===0?-10: side===1?W+10: Math.random()*W, y = side===2?-10: side===3?H+10: Math.random()*H;
    viruses.push({x,y,vx:0,vy:0,hp:2,rot:0});
  }

  // viruses
  for (const v of viruses){
    let tgt = null, best = 1e9;
    for (const ic of icons){ if (ic.infected) continue; const d = dist(v,ic); if (d<best){best=d;tgt=ic;} }
    if (!tgt && P.alive) tgt = P;
    const vs = 75 + diff*9;
    if (tgt){ const a = Math.atan2(tgt.y-v.y, tgt.x-v.x); v.vx += (Math.cos(a)*vs - v.vx)*1.6*dt; v.vy += (Math.sin(a)*vs - v.vy)*1.6*dt; }
    v.x += v.vx*dt; v.y += v.vy*dt; v.rot += dt*3; wrap(v, 20);
  }

  // icons
  for (const ic of icons){
    ic.bob += dt; ic.flash -= dt;
    if (ic.infected && P.alive){
      const a = Math.atan2(P.y-ic.y, P.x-ic.x), s = 40 + diff*5;
      ic.vx += (Math.cos(a)*s - ic.vx)*0.8*dt; ic.vy += (Math.sin(a)*s - ic.vy)*0.8*dt;
      ic.shootT -= dt;
      if (ic.shootT <= 0){ ic.shootT = Math.max(1.1, 2.8 - diff*0.2) + Math.random(); fireEnemy(ic.x, ic.y, a + (Math.random()-.5)*0.25); }
    }
    ic.x += ic.vx*dt; ic.y += ic.vy*dt; wrap(ic, 20);
  }

  // boss
  if (boss){
    boss.t += dt; boss.flash -= dt;
    boss.x = W/2 + Math.sin(boss.t*0.6)*W*0.3; boss.y = H*0.3 + Math.sin(boss.t*1.1)*H*0.12;
    boss.fireT -= dt; boss.spawnT -= dt;
    const rage = 1 - boss.hp/boss.max;
    if (boss.fireT <= 0){
      boss.fireT = 1.8 - rage*0.9;
      const n = 8 + Math.floor(rage*8), off = boss.t;
      for (let i=0;i<n;i++) fireEnemy(boss.x, boss.y, off + i*Math.PI*2/n, 170 + rage*60);
      beep(140,0.15,'sawtooth',0.04,-60);
    }
    if (boss.spawnT <= 0 && viruses.length < maxV){ boss.spawnT = 3.2 - rage*1.5; viruses.push({x:boss.x,y:boss.y,vx:0,vy:0,hp:2,rot:0}); }
  }

  // collisions: player bullets
  for (const b of bullets){
    if (b.enemy || b.life <= 0) continue;
    for (const v of viruses){ if (v.hp>0 && dist(b,v) < 15){ b.life=0; v.hp -= b.dmg || 1; SFX.hit(); if (v.hp<=0) killVirus(v); break; } }
    if (b.life <= 0) continue;
    for (const ic of icons){
      if (ic.dead || dist(b,ic) > 26) continue;
      b.life = 0;
      if (ic.infected){
        ic.hp -= b.dmg || 1; ic.flash = 0.1; SFX.hit();
        if (ic.hp <= 0){ ic.infected = false; ic.hp = 3; burst(ic.x,ic.y,'#4ade80',20); addScore(50); dropAt(ic.x, ic.y, 3, 0.25); msg('CLEANSED +50', ic.x, ic.y-26, '#4ade80'); SFX.cleanse(); ic.vx*=0.2; ic.vy*=0.2; }
      } else {
        ic.dead = true; burst(ic.x,ic.y,'#ffcc66',24); addScore(-25); msg('DELETED ' + short(ic.f.name) + '  −25', ic.x, ic.y-26, '#fc6'); SFX.del();
      }
      break;
    }
    if (b.life > 0 && boss && dist(b,boss) < 52){ b.life = 0; boss.hp -= b.dmg || 1; boss.flash = 0.08; SFX.hit(); addScore(10);
      if (boss.hp <= 0){ burst(boss.x,boss.y,'#f35',120,420); burst(boss.x,boss.y,'#fff',60,300); SFX.boom(); setTimeout(SFX.boom,200); setTimeout(SFX.boom,450);
        addScore(5000); boss = null; viruses.forEach(v=>{burst(v.x,v.y,'#e040fb',10); v.hp=0;}); bullets.forEach(b=>{ if (b.enemy) b.life=0; });
        setBanner('INNER DEMON DESTROYED', 3); later(3.2, () => showEnd(true)); } }
  }
  // enemy bullets vs player
  const fw = P.alive && P.pw.firewall > 0;
  if (P.alive) for (const b of bullets){ if (b.enemy && b.life>0 && dist(b,P) < (fw ? 30 : 12)){ b.life = 0; damage(12); burst(b.x,b.y,fw?'#c084fc':'#f55',6,90); } }
  // virus vs icons / player
  for (const v of viruses){
    if (v.hp <= 0) continue;
    for (const ic of icons){ if (!ic.dead && !ic.infected && dist(v,ic) < 28){ ic.infected = true; ic.hp = 3; ic.shootT = 1.5; v.hp = 0; burst(ic.x,ic.y,'#f35',14); msg('INFECTED: ' + short(ic.f.name), ic.x, ic.y-26, '#f57'); SFX.infect(); break; } }
    if (v.hp > 0 && P.alive && dist(v,P) < (fw ? 32 : 20)){
      if (P.boosting || fw){ v.hp = 0; killVirus(v, true); }
      else { v.hp = 0; burst(v.x,v.y,'#e040fb',14); damage(18); }
    }
  }
  // player vs icons
  if (P.alive) for (const ic of icons){
    if (ic.dead || dist(ic,P) > 42) continue;   // rescue radius (was 30)
    if (ic.infected){ damage(15); const a = Math.atan2(P.y-ic.y,P.x-ic.x); P.vx = Math.cos(a)*260; P.vy = Math.sin(a)*260; }
    else { ic.dead = true; ic.captured = true; addScore(100); dropAt(ic.x, ic.y, 2, 0); msg('RESCUED ' + short(ic.f.name) + '  +100', ic.x, ic.y-26, '#4ade80'); feedAdd(ic.img, ic.f.name, ic.f.file); burst(ic.x,ic.y,'#5ff',16,120); SFX.capture(); P.shield = Math.min(100, P.shield+8); }
  }

  // pickups
  cacheT -= dt;
  if (cacheT <= 0){ cacheT = 13+Math.random()*7; pickups.push({x:60+Math.random()*(W-120), y:80+Math.random()*(H-160), vx:0, vy:0, type:randPickup(), life:12, rot:0, cache:true}); msg('DATA CACHE DETECTED', W/2, 90, '#fbbf24'); }
  for (const k of pickups){
    k.life -= dt; k.rot += dt*3;
    k.vx *= Math.pow(0.3, dt); k.vy *= Math.pow(0.3, dt);
    if (P.alive){
      const d = dist(k, P), reach = S.magnet + (k.type==='bit' ? 30 : 0);
      if (d < reach && d > 1){ const pull = 320*(1 - d/(reach+40)); k.vx += (P.x-k.x)/d*pull*dt*6; k.vy += (P.y-k.y)/d*pull*dt*6; }
      if (d < 34){ collect(k); k.life = 0; }   // pickup radius (was 22)
    }
    k.x += k.vx*dt; k.y += k.vy*dt; wrap(k);
  }
  pickups = pickups.filter(k => k.life > 0);
  // Bit Magnet also tugs clean icons toward you (gentler than bits)
  if (P.alive && S.magnet > 0) for (const ic of icons){
    if (ic.infected || ic.dead) continue;
    const d = dist(ic, P), reach = S.magnet + 20;
    if (d < reach && d > 1){ const pull = 170*(1 - d/(reach+40)); ic.vx += (P.x-ic.x)/d*pull*dt; ic.vy += (P.y-ic.y)/d*pull*dt;
      const sp = Math.hypot(ic.vx, ic.vy); if (sp > 150){ ic.vx *= 150/sp; ic.vy *= 150/sp; } }
  }

  bullets = bullets.filter(b => b.life > 0);
  viruses = viruses.filter(v => v.hp > 0);
  icons = icons.filter(i => !i.dead);
  for (const p of parts){ p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const m of msgs){ m.y -= 28*dt; m.life -= dt; }
  feedTick(dt);
  msgs = msgs.filter(m => m.life > 0);
  if (banner){ banner.life -= dt; if (banner.life <= 0) banner = null; }

  // wave / sector completion
  if (!G.cur.boss && icons.length === 0 && !G.cur._waiting && G.lives >= 0){
    G.cur._waiting = true;
    if (queue.length){ later(1.2, () => { G.cur._waiting = false; nextWave(); }); }
    else {
      viruses.forEach(v => { burst(v.x,v.y,'#e040fb',10); v.hp = 0; });
      bullets.forEach(b => { if (b.enemy) b.life = 0; });
      addScore(500); G.bits += 10; setBanner('SECTOR CLEAN  +500  ◆10', 2.4); SFX.wave();
      pickups.forEach(k => { if (k.type === 'bit') G.bits++; }); pickups = [];
      const finish = () => { if (!G.cur._finish) return; G.cur._finish = null; G.cur._waiting = false; G.cur.cleared = true; G.cleared++; if (G.lives < 9 && G.cleared % 3 === 0){ G.lives++; } showMap(); };
      G.cur._finish = finish;
      later(2.4, finish);
    }
  }
}
function hostileAhead(){
  const chk = (x, y) => { const d = Math.hypot(x-P.x, y-P.y); if (d > 520) return false; let a = Math.atan2(y-P.y, x-P.x) - P.a; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < Math.max(0.12, 26/d); };
  for (const v of viruses) if (chk(v.x, v.y)) return true;
  for (const ic of icons) if (ic.infected && chk(ic.x, ic.y)) return true;
  return !!(boss && chk(boss.x, boss.y));
}
function killVirus(v, rammed){
  burst(v.x,v.y,'#e040fb',18); addScore(25);
  msg(rammed ? 'RAMMED +25' : '+25', v.x, v.y, '#e9f'); SFX.boom();
  dropAt(v.x, v.y, 1 + (Math.random() < 0.4 ? 1 : 0), 0.12);
}
let bitTick = 0;
function collect(k){
  const px = P.x, py = P.y - 24;
  switch (k.type){
    case 'bit': G.bits++; if (performance.now() - bitTick > 70){ beep(1400+Math.random()*300,0.04,'triangle',0.03); bitTick = performance.now(); } return;
    case 'patch': P.shield = Math.min(S.maxShield, P.shield + 40); msg('SHIELD PATCH', px, py, '#4ade80'); break;
    case 'ram': P.boost = S.tank; msg('BOOST REFILLED', px, py, '#fbbf24'); break;
    case 'spread': P.pw.spread = 10; msg('WIDE SHOT', px, py, '#60a5fa'); break;
    case 'rapid': P.pw.rapid = 10; msg('RAPID FIRE', px, py, '#fb923c'); break;
    case 'firewall': P.pw.firewall = 6; msg('FIREWALL UP', px, py, '#c084fc'); break;
    case 'life': G.lives++; msg('EXTRA LIFE', px, py, '#f9a8d4'); break;
  }
  [523,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.08,'triangle',0.05),i*55));
}
function short(n){ return n.length > 16 ? n.slice(0,13) + '…' : n; }

