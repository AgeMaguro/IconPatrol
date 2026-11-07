function update(dt){
  for (const t of timers) t.s -= dt;
  const due = timers.filter(t => t.s <= 0); timers = timers.filter(t => t.s > 0); due.forEach(t => t.fn());
  if (G.state !== 'play') return;
  const diff = G.cleared;
  hitFlash = Math.max(0, hitFlash - dt);

  // ---- player ----
  if (P.alive){
    const kb = (a,b) => (keys[a]?1:0) - (keys[b]?1:0);
    const inv = invert ? -1 : 1;
    const tcP = TC.active ? -TC.y*Math.abs(TC.y)**0.4 : 0, tcY = TC.active ? -TC.x*Math.abs(TC.x)**0.4 : 0;
    // mouse acts as a virtual stick: moving it deflects the stick, which eases back to center
    const mdx = Math.max(-120, Math.min(120, mouse.dx)), mdy = Math.max(-120, Math.min(120, mouse.dy));
    mouse.dx = 0; mouse.dy = 0;
    mouse.sx = Math.max(-1, Math.min(1, mouse.sx*Math.exp(-dt/0.22) + mdx*0.012));
    mouse.sy = Math.max(-1, Math.min(1, mouse.sy*Math.exp(-dt/0.22) + mdy*0.012));
    const inPitch = Math.max(-1, Math.min(1, kb('pu','pd') + pad.pitch + tcP - mouse.sy)) * inv;
    const inYaw   = Math.max(-1, Math.min(1, kb('yl','yr') + pad.yaw + tcY - mouse.sx));
    const inRoll  = Math.max(-1, Math.min(1, kb('rl','rr') + pad.roll + (TC.rollL?1:0) - (TC.rollR?1:0)));
    // rotational inertia: turn rate accelerates/decelerates instead of snapping; boosting makes the ship stiffer
    const agil = (P.boosting ? 0.7 : 1) * shipDef().turn;
    let tgtX = inPitch*1.45*agil, tgtY = inYaw*1.3*agil, tgtZ = inRoll*2.3*agil;
    const bankNow = Math.asin(Math.max(-1, Math.min(1, right.y)));  // + = left wing down (vs. the navball horizon)
    if (flightMode === 'coord' && Math.abs(inRoll) < 0.05 && Math.abs(up.y) > 0.2){
      tgtZ = Math.max(-2.3, Math.min(2.3, (inYaw*1.0 - bankNow)*3.5)) * agil;   // bank ~57° into the turn, auto-level when you stop
    }
    const accel = (cur, tgt, a) => cur + Math.max(-a*dt, Math.min(a*dt, tgt - cur));
    P.ang.x = accel(P.ang.x, tgtX, 4.2*agil); P.ang.y = accel(P.ang.y, tgtY, 3.8*agil); P.ang.z = accel(P.ang.z, tgtZ, 7*agil);
    _e.set(P.ang.x*dt, P.ang.y*dt, P.ang.z*dt, 'XYZ');
    P.q.multiply(_q.setFromEuler(_e)).normalize();
    if (flightMode === 'assist'){
      // banked = turning: heading swings around the navball's vertical, stronger with speed
      const spF = Math.min(1.3, P.vel.length()/S.top), turn = bankNow*1.15*spF*Math.sign(up.y || 1);
      if (Math.abs(turn) > 1e-4){ P.q.premultiply(_q.setFromAxisAngle(_wUp, turn*dt)).normalize(); _bankRate = turn; } else _bankRate = 0;
    } else _bankRate = 0;
    if (dt > 0) P.rate.lerp(_rate.set(_e.x/dt, _e.y/dt, _e.z/dt), Math.min(1, dt*6));
    fwd.set(0,0,-1).applyQuaternion(P.q); up.set(0,1,0).applyQuaternion(P.q); right.set(1,0,0).applyQuaternion(P.q);
    scanTarget(); scanMissile(dt);

    // throttle: a setting that stays where you put it. 0..1 normal, 1..REDLINE burns boost
    let brakeAmt;
    if (thrustMode === 'hold'){
      // classic: W / RT / lever pushes only while held; let go and you coast. S / LT brake.
      if (!leverHeld) throttle = Math.max(keys.th ? 1 : 0, pad.thrust > 0.05 ? Math.min(1, pad.thrust) : 0);
      brakeAmt = Math.max(TC.brake ? 1 : 0, keys.br ? 1 : 0, pad.brake > 0.05 ? pad.brake : 0);
    } else {
      if (keys.th && throttle < 1) throttle = Math.min(1, throttle + 0.8*dt);
      if (keys.br && throttle > 0) throttle = Math.max(0, Math.min(throttle, 1) - 0.9*dt);
      if (pad.thrust > 0.05 && throttle < 1) throttle = Math.min(1, throttle + pad.thrust*0.9*dt);
      if (pad.brake > 0.05 && throttle > 0) throttle = Math.max(0, Math.min(throttle, 1) - pad.brake*0.9*dt);
      brakeAmt = Math.max(TC.brake ? 1 : 0, keys.br && throttle <= 0.001 ? 1 : 0, throttle <= 0.001 ? pad.brake : 0);
    }
    const holdBoost = !!(keys.boost || pad.boost);
    let want = holdBoost ? REDLINE : throttle;
    if (want > 1 && P.boost <= 0) want = 1;                    // redline needs boost
    // out of fuel: main engine off, impulse thrusters still push at up to IMPULSE (25%) of normal thrust, no boost
    P.impulse = P.fuel <= 0 && !INF();
    if (P.impulse){ want = Math.min(1, want)*IMPULSE; if (!P.warned.fuel){ P.warned.fuel = true; toast('FUEL EMPTY · impulse thrusters only (25% thrust). Grab a fuel cell.'); } } else P.warned.fuel = false;
    effThr = want;
    P.boosting = want > 1.02;
    P.thrust = want > (P.impulse ? 0.005 : 0.03);
    // engine spool: thrust ramps toward the requested level instead of switching instantly
    P.spool += Math.sign(want - P.spool) * Math.min(Math.abs(want - P.spool), (want > P.spool ? 2.6 : 3.2)*dt);
    if (P.spool > 0.005) P.vel.addScaledVector(fwd, S.top*0.7*P.spool*dt);   // steady speed ≈ throttle × top speed
    if (P.spool > 0.005 && !INF()) P.fuel = Math.max(0, P.fuel - S.burn*Math.min(1, P.spool)*dt);
    if (P.boosting){
      if (!P.wasBoosting) beep(220,0.25,'sawtooth',0.035,400);
      P.boost = Math.max(0, P.boost - 45*Math.min(1, (want-1)/(REDLINE-1))*dt); P.boostIdle = 0;
      for (let i=0;i<2;i++) trail(_t.copy(P.pos).addScaledVector(fwd,-3), _t2.copy(fwd).multiplyScalar(-60).add(randDir().multiplyScalar(8)), Math.random()<.5?'#9ff':'#fff', 0.45);
    } else {
      P.boostIdle += dt;
      if (P.boostIdle > 0.8 && (P.fuel > 0 || INF())){ const add = Math.min(S.tank - P.boost, S.tankRegen*dt); P.boost += add; if (!INF()) P.fuel = Math.max(0, P.fuel - add*0.3); }   // boost recharges from fuel
      if (P.spool > 0.05){ if (Math.random()<0.6*Math.min(1,P.spool)) trail(_t.copy(P.pos).addScaledVector(fwd,-3), _t2.copy(fwd).multiplyScalar(-35).add(randDir().multiplyScalar(6)), '#fa3', 0.3); }
    }
    P.wasBoosting = P.boosting; P.thrAmt = P.spool; P.brkAmt = brakeAmt;
    // smoothed copies used only by the lead-gate forecast (1)
    const kf = 1 - Math.exp(-dt/0.35); P.thrSm += (P.spool - P.thrSm)*kf; P.brkSm += (brakeAmt - P.brkSm)*kf;
    if (brakeAmt > 0.05) P.vel.multiplyScalar(Math.pow(0.08, dt*brakeAmt));
    P.vel.multiplyScalar(Math.pow(0.5, dt));
    if (flightMode === 'assist'){ const sp2 = P.vel.length(); if (sp2 > 1){ _t.copy(fwd).multiplyScalar(sp2); P.vel.lerp(_t, 1 - Math.exp(-dt*2.2)); } }
    const top = S.top*Math.max(1, P.spool), sp = P.vel.length();
    if (sp > top){ P.vel.multiplyScalar(Math.max(top, sp - 220*dt)/sp); }
    softWall(P.pos, P.vel, 2);
    P.pos.addScaledVector(P.vel, dt);
    P.cool -= dt; P.inv -= dt;
    for (const kk in P.pw) P.pw[kk] = Math.max(0, P.pw[kk] - dt);
    P.shield = Math.min(S.maxShield, P.shield + S.regen*dt);
    const autoOn = TC.used && TC.auto; if (autoOn) aimDir(P.pos, fwd);
    if ((keys.fire || pad.fire || mouse.fire || TC.fire || (autoOn && aimHit)) && P.cool <= 0){
      P.cool = S.cool * (P.pw.rapid > 0 ? 0.5 : 1) * (shipDef().volley ? 2 : 1);
      // guns fire straight out of the nose, except while the reticle shows LOCK: then they converge on the lead
      // point (where the reticle sits), with a little scatter that shrinks with the ship's Auto-aim stat.
      // Touch keeps its light assist for auto-fire when not locked.
      const gunLock = !!(TGT && TGT.locked);
      let base;
      if (gunLock){ const tt = TGT.d/520, acc = shipDef().aim || 0.6;
        base = _t.copy(TGT.pos).addScaledVector(TGT.vel, tt).addScaledVector(P.vel, -tt).sub(P.pos).normalize().clone();
        base.addScaledVector(randDir(), (1 - acc)*0.02).normalize(); aimDir(P.pos, fwd); }
      else base = TC.used ? aimDir(P.pos, fwd) : (aimDir(P.pos, fwd), fwd.clone());
      let shots = S.barrel === 0 ? [[0,0,0]] : S.barrel === 1 ? [[0,0,-1.8],[0,0,1.8]] : [[0.05,0,-1.8],[-0.05,0,1.8],[0,0.05,0],[0,-0.05,0]];
      // Fighter: every barrel fires from both wingtip cannons at once (one volley)
      if (shipDef().volley) shots = shots.flatMap(([dy, dp, off]) => [[dy, dp, -5.1 + off*0.4], [dy, dp, 5.1 + off*0.4]]);
      // wide shot (pickup, or built into the Fighter): 3-5 pellets scattered at random around the nose each volley
      // Bulwark's built-in scatter is weaker (75% damage, 75% range); a W pickup is full strength
      if (P.pw.spread > 0 || shipDef().wide){
        const n = 3 + Math.floor(Math.random()*3), a0 = Math.random()*Math.PI*2, wk = P.pw.spread > 0 ? 1 : 0.75;
        for (let i = 0; i < n; i++){ const az = a0 + i*Math.PI*2/n + (Math.random() - 0.5)*0.9, r = 0.05 + Math.random()*0.13;
          shots.push([Math.cos(az)*r, Math.sin(az)*r, 0, wk]); }
      }
      if (!INF()){
        if (P.ammo <= 0){ shots = [[0,0,0]]; P.cool *= 3; }      // out of ammo: slow backup gun, single shot, free
        else { P.ammo = Math.max(0, P.ammo - shots.filter(s => (s[3] || 1) >= 1).length);   // Bulwark's built-in scatter pellets are free
          if (P.ammo <= 0) toast('AMMO EMPTY · backup gun only. Grab ammo drops.'); }
      }
      P.gunSide = -(P.gunSide || 1);
      for (const [dy, dp, off, wf = 1] of shots){
        const g = new THREE.Mesh(fpv ? BG_T : BG_P, BM_P);
        let d;
        if (fpv){
          // wing guns under the cockpit (single gun alternates sides), boresighted to meet 320m straight ahead of the nose
          const side = off === 0 ? P.gunSide*4.6 : Math.sign(off)*4.6 + off*0.4;
          _muz.copy(P.pos).addScaledVector(fwd, 7).addScaledVector(up, -3.2).addScaledVector(right, side);
          _aimPt.copy(P.pos).addScaledVector(base, gunLock ? TGT.d : TC.used ? aimDist : 320);
          d = _aimPt.sub(_muz).normalize().addScaledVector(right, -dy).addScaledVector(up, dp).normalize().clone();
          g.position.copy(_muz);
        } else {
          g.position.copy(P.pos).addScaledVector(fwd, 5).addScaledVector(right, off);
          // locked: each barrel (wingtips too) converges on the lead point instead of firing parallel
          d = (gunLock ? _aimPt.copy(P.pos).addScaledVector(base, TGT.d).sub(g.position).normalize().clone() : base.clone()).addScaledVector(right, -dy).addScaledVector(up, dp).normalize();
        }
        scene.add(g);
        d.addScaledVector(randDir(), 0.006).normalize();
        const bv = d.multiplyScalar(520).add(P.vel);             // shots carry the ship's momentum
        if (fpv){ g.lookAt(_t.copy(g.position).add(bv)); burst(g.position, '#bff', 3, 12, 0.1); }
        bullets.push({g, vel:bv, life:1.4*wf, dmg:wf});
      }
      SFX.shoot();
    }
  } else if (G.lives >= 0){
    P.respawn -= dt;
    if (P.respawn <= 0){ Object.assign(P, {shield:S.maxShield, boost:S.tank, hull:S.maxHull, ammo:Math.max(P.ammo, S.maxAmmo*0.6), fuel:Math.max(P.fuel, S.maxFuel*0.6), msl:Math.max(P.msl, Math.ceil(S.maxMsl/2)), inv:2.5, alive:true, spool:0, thrSm:0, brkSm:0}); gateSm.coast = gateSm.ghost = null; throttle = 0; mouse.dx = mouse.dy = mouse.sx = mouse.sy = 0; P.ang.set(0,0,0); P.rate.set(0,0,0); P.vel.set(0,0,0); ship.visible = true; }
  }
  ship.position.copy(P.pos);
  {
    // visual bank: the model leans into turns (up to ~60°) based on turn rate and sideways slip; physics/aim unaffected
    const slip = P.alive ? _t.copy(P.vel).dot(right) / Math.max(40, S.top) : 0;
    const want = P.alive ? Math.max(-1.05, Math.min(1.05, P.rate.y*0.75 - slip*0.35 + _bankRate*0.4)) : 0;
    P.visBank = (P.visBank || 0) + (want - (P.visBank || 0))*Math.min(1, dt*5);
    ship.quaternion.copy(P.q).multiply(_q.setFromAxisAngle(_zAx, P.visBank));
  }
  flame.scale.setScalar(2.5 + P.spool*(P.boosting ? 4.6 : 3.2) + (P.spool > 0.1 ? Math.random()*1.5*P.spool : 0));
  flame.material.color.set(P.boosting ? 0xccffff : P.impulse ? 0x66aaff : 0xffaa33);
  fwShell.visible = P.alive && P.pw.firewall > 0 && (P.pw.firewall > 1.5 || Math.floor(performance.now()/90)%2);
  fwShell.rotation.y += dt*2; fwShell.rotation.x += dt;
  ship.visible = !fpv && P.alive && !(P.inv > 0 && Math.floor(performance.now()/80)%2);

  // ---- bullets ----
  for (const b of bullets){ b.g.position.addScaledVector(b.vel, dt); b.life -= dt; if (b.g.position.lengthSq() > (R+80)*(R+80)) b.life = 0; }
  updateRocks(dt); updateHazards(dt); updateExitGate(dt);
  for (const b of bullets) if (b.life > 0 && !rockBlocks(b)) hazBullet(b);

  updateMissiles(dt);
  // ---- virus spawning ----
  const maxV = boss ? 7 : 2 + Math.min(6, diff), nV = viruses.reduce((n, v) => n + (v.ai ? 0 : 1), 0);   // enemy ships (ai) have their own budget
  virusT -= dt;
  if (G.cur.free){ if (viruses.length < FREE_DRONES && virusT <= 0){ virusT = 2.5; spawnDrone(false); } }
  else if (!boss && virusT <= 0 && nV < maxV && icons.some(i => !i.infected)){
    virusT = Math.max(1.3, 4 - diff*0.33) * (0.7+Math.random()*0.6);
    // spawn a little way off from a random clean icon, so the fight stays where the files are
    const clean = icons.filter(i => !i.infected); const anchor = clean[Math.floor(Math.random()*clean.length)];
    const at = anchor.g.position.clone().add(randDir().multiplyScalar(260 + Math.random()*140));
    if (at.length() > R*0.95) at.setLength(R*0.95);
    spawnVirus(at);
  }
  enemyDirector(dt);
  // ---- viruses ----
  for (const v of viruses){
    if (v.ai){ updateEnemyAI(v, dt); continue; }
    if (v.dummy){
      // practice ship: wander between random waypoints, banking gently toward each
      v.wpT -= dt; if (v.wpT <= 0 || v.g.position.distanceToSquared(v.wp) < 2500){ v.wp = randInSphere(R*0.6); v.wpT = 4 + Math.random()*6; }
      _t.copy(v.wp).sub(v.g.position).normalize().multiplyScalar(v.sp);
      v.vel.lerp(_t, Math.min(1, v.turn*dt)).setLength(v.sp);
      softWall(v.g.position, v.vel); v.g.position.addScaledVector(v.vel, dt);
      v.g.lookAt(_t2.copy(v.g.position).sub(v.vel));
      continue;
    }
    let tgt = null, best = 1e12;
    for (const ic of icons){ if (ic.infected) continue; const d = v.g.position.distanceToSquared(ic.g.position); if (d < best){ best = d; tgt = ic.g.position; } }
    if (!tgt && P.alive) tgt = P.pos;
    const vs = 42 + diff*6;
    if (tgt){ _t.copy(tgt).sub(v.g.position).normalize().multiplyScalar(vs); v.vel.lerp(_t, Math.min(1, 1.4*dt)); }
    softWall(v.g.position, v.vel);
    v.g.position.addScaledVector(v.vel, dt);
    v.g.rotation.x += v.spin.x*dt; v.g.rotation.y += v.spin.y*dt; v.g.rotation.z += v.spin.z*dt;
  }
  // ---- icons ----
  for (const ic of icons){
    ic.bob += dt; ic.flash -= dt;
    if (ic.infected && P.alive){
      _t.copy(P.pos).sub(ic.g.position); const d = _t.length();
      _t.divideScalar(d || 1);
      ic.vel.lerp(_t2.copy(_t).multiplyScalar(24 + diff*3), Math.min(1, 0.7*dt));
      ic.shootT -= dt;
      if (ic.shootT <= 0 && d < 450){ ic.shootT = Math.max(1.1, 2.8 - diff*0.2) + Math.random(); fireEnemy(ic.g.position, _t2.copy(P.pos).addScaledVector(P.vel, d/120*0.5).sub(ic.g.position).add(randDir().multiplyScalar(d*0.04))); }
      const j = 0.6; ic.spr.position.set((Math.random()-.5)*j, (Math.random()-.5)*j, 0);
      ic.glow.material.opacity = 0.65 + Math.sin(ic.bob*8)*0.2;
    } else { ic.spr.position.set(0, Math.sin(ic.bob*2)*0.8, 0); }
    ic.spr.material.color.set(ic.flash > 0 ? 0xffffff : ic.infected ? 0xff7080 : 0xffffff);
    softWall(ic.g.position, ic.vel);
    ic.g.position.addScaledVector(ic.vel, dt);
  }
  // ---- boss ----
  if (boss){
    boss.t += dt; boss.flash -= dt;
    const bPrev = _t.copy(boss.g.position).clone();
    boss.g.position.set(Math.sin(boss.t*0.35)*300, Math.sin(boss.t*0.6)*170, Math.cos(boss.t*0.45)*300 - 40);
    boss.vel.copy(boss.g.position).sub(bPrev).divideScalar(Math.max(dt, 1e-3));   // real movement, used for leading shots
    boss.shell.rotation.y += dt*0.5; boss.spikes.rotation.x += dt*0.7; boss.spikes.rotation.z += dt*0.4;
    boss.eye.lookAt(P.pos);
    boss.core.material.color.set(boss.flash > 0 ? 0xffffff : 0x3a0410);
    boss.fireT -= dt; boss.spawnT -= dt;
    const rage = 1 - boss.hp/boss.max;
    if (boss.fireT <= 0){
      boss.fireT = 2.2 - rage*1.1;
      const n = 22 + Math.floor(rage*26), off = Math.random()*6, ga = Math.PI*(3-Math.sqrt(5));
      for (let i=0;i<n;i++){ const y = 1 - (i+0.5)/n*2, r = Math.sqrt(1-y*y), th = ga*i + off; fireEnemy(boss.g.position, V(Math.cos(th)*r, y, Math.sin(th)*r), 85 + rage*45); }
      for (let i=0;i<3;i++) fireEnemy(boss.g.position, _t.copy(P.pos).sub(boss.g.position).add(randDir().multiplyScalar(20)), 150 + rage*40);
      beep(140,0.15,'sawtooth',0.04,-60);
    }
    if (boss.spawnT <= 0 && viruses.length < maxV){ boss.spawnT = 3.2 - rage*1.5; spawnVirus(boss.g.position.clone().add(randDir().multiplyScalar(40))); }
  }

  // ---- collisions ----
  for (const b of bullets){
    if (b.enemy || b.life <= 0) continue;
    const bp = b.g.position;
    for (const v of viruses){ if (v.hp > 0 && bp.distanceToSquared(v.g.position) < (v.r2 || 81)){ b.life = 0; v.hp -= b.dmg || 1; SFX.hit(); burst(bp,'#f9f',4,20,0.3); if (v.hp <= 0) killVirus(v); break; } }
    if (b.life <= 0) continue;
    for (const ic of icons){
      if (ic.dead || bp.distanceToSquared(ic.g.position) > 196) continue;
      b.life = 0;
      if (ic.infected){
        ic.hp -= b.dmg || 1; ic.flash = 0.1; SFX.hit();
        if (ic.hp <= 0) cleanseIcon(ic);
      } else {
        ic.dead = true; burst(ic.g.position, '#ffcc66', 30, 40); addScore(-25); msg('DELETED ' + short(ic.f.name) + ' −25', ic.g.position, '#fc6'); SFX.del();
      }
      break;
    }
    if (b.life > 0 && boss && bp.distanceToSquared(boss.g.position) < 38*38){
      b.life = 0; boss.hp -= b.dmg || 1; boss.flash = 0.06; SFX.hit(); addScore(10); burst(bp,'#f56',6,30,0.4);
      if (boss.hp <= 0) killBoss();
    }
  }
  const fw = P.alive && P.pw.firewall > 0;
  if (P.alive) for (const b of bullets){ if (b.enemy && b.life > 0 && b.g.position.distanceToSquared(P.pos) < (fw ? 121 : (b.hr2 || 25))){ b.life = 0; damage(b.dmg || 12); burst(b.g.position, fw ? '#c084fc' : '#f55', 8, 25, 0.4); } }
  for (const v of viruses){
    if (v.hp <= 0 || v.dummy || v.ai) continue;
    for (const ic of icons){ if (!ic.dead && !ic.infected && v.g.position.distanceToSquared(ic.g.position) < 256){
      ic.infected = true; ic.hp = 3; ic.shootT = 1.5; v.hp = 0; ic.glow.material.color.set(0xff2040);
      burst(ic.g.position, '#f35', 20, 35); msg('INFECTED: ' + short(ic.f.name), ic.g.position, '#f57'); SFX.infect(); break; } }
    if (v.hp > 0 && P.alive && v.g.position.distanceToSquared(P.pos) < (fw ? 196 : 100)){
      v.hp = 0;
      if (P.boosting || fw) killVirus(v, true); else { burst(v.g.position, '#e040fb', 16, 30); damage(18); }
    }
  }
  if (P.alive) for (const ic of icons){
    if (ic.dead || ic.g.position.distanceToSquared(P.pos) > 26*26) continue;   // rescue radius (was 15)
    if (ic.infected){ damage(15); _t.copy(P.pos).sub(ic.g.position).normalize(); P.vel.copy(_t.multiplyScalar(90)); }
    else { ic.dead = true; addScore(100); dropAt(ic.g.position, 2, 0); msg('RESCUED ' + short(ic.f.name) + ' +100', ic.g.position, '#4ade80'); feedAdd(ic.tex.image, ic.f.name, ic.f.file); burst(ic.g.position, '#5ff', 24, 30); SFX.capture(); P.shield = Math.min(S.maxShield, P.shield + 8); }
  }

  // ---- pickups ----
  cacheT -= dt;
  if (cacheT <= 0){ cacheT = 13 + Math.random()*7; const at = P.pos.clone().add(randDir().multiplyScalar(120 + Math.random()*220)); if (at.length() > R*0.9) at.setLength(R*0.9); spawnPickup(at, randPickup()); msg('DATA CACHE DETECTED', null, '#fbbf24'); }
  for (const k of pickups){
    k.life -= dt;
    k.g.rotation.y += dt*2; k.g.rotation.x += dt;
    k.vel.multiplyScalar(Math.pow(0.3, dt));
    if (P.alive){
      _t.copy(P.pos).sub(k.g.position); const d = _t.length(), reach = S.magnet + (k.type === 'bit' ? 22 : 0);
      if (d < reach && d > 0.5) k.vel.addScaledVector(_t.divideScalar(d), 260*(1 - d/(reach+30))*dt*5);
      if (d < 17){ collect(k); k.life = 0; }   // pickup radius (was 9)
    }
    k.g.visible = !(k.life < 3 && Math.floor(performance.now()/120) % 2);
    softWall(k.g.position, k.vel);
    k.g.position.addScaledVector(k.vel, dt);
  }
  // Bit Magnet also tugs clean icons toward you (gentler than bits)
  if (P.alive && S.magnet > 0) for (const ic of icons){
    if (ic.infected || ic.dead) continue;
    _t.copy(P.pos).sub(ic.g.position); const d = _t.length(), reach = S.magnet + 15;
    if (d < reach && d > 0.5){ ic.vel.addScaledVector(_t.divideScalar(d), 180*(1 - d/(reach+30))*dt); const sp = ic.vel.length(); if (sp > 110) ic.vel.multiplyScalar(110/sp); }
  }

  // ---- cleanup ----
  const sweep = (arr, dead) => arr.filter(o => { if (dead(o)){ scene.remove(o.g); if (o.tex){ o.tex.dispose(); o.spr.material.dispose(); o.glow.material.dispose(); } return false; } return true; });
  bullets = sweep(bullets, b => b.life <= 0);
  viruses = sweep(viruses, v => v.hp <= 0);
  icons = sweep(icons, i => i.dead);
  pickups = sweep(pickups, k => k.life <= 0);
  for (const m of msgs) m.life -= dt;
  feedTick(dt);
  msgs = msgs.filter(m => m.life > 0);
  if (banner){ banner.life -= dt; if (banner.life <= 0) banner = null; }

  // ---- wave / sector completion ----
  if (!G.cur.free && !G.cur.boss && icons.length === 0 && !G.cur._waiting && G.lives >= 0){
    G.cur._waiting = true;
    if (queue.length){ later(1.2, () => { G.cur._waiting = false; nextWave(); }); }
    else {
      viruses.forEach(v => { burst(v.g.position, '#e040fb', 12, 30); v.hp = 0; });
      bullets.forEach(b => { if (b.enemy) b.life = 0; });
      addScore(500); G.bits += 10; setBanner('SECTOR CLEAN  +500  ◆10', 2.4); SFX.wave();
      pickups.forEach(k => { if (k.type === 'bit') G.bits++; k.life = 0; });
      const finish = () => { if (!G.cur._finish) return; G.cur._finish = null; G.cur._waiting = false;
        P.ammo = Math.min(S.maxAmmo, P.ammo + S.maxAmmo*0.25); P.fuel = Math.min(S.maxFuel, P.fuel + S.maxFuel*0.25); P.msl = Math.min(S.maxMsl, P.msl + 1);   /* resupply for clearing */
        G.cur.cleared = true; G.cleared++; if (G.lives < 9 && G.cleared % 3 === 0) G.lives++; showMap(); };
      G.cur._finish = finish;
      if (haz.exit) later(2.4, () => { if (openExitGate()){ setBanner('RETURN TO THE SECTOR GATE', 3); beep(660,0.15,'triangle',0.05); } });
      else later(2.4, finish);
    }
  }
}

function updateParticles(dt){
  let n = 0;
  for (const p of plist){ p.life -= dt; if (p.life <= 0) continue; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.97;
    const f = Math.min(1, p.life/p.max*1.5); pPos[n*3]=p.x; pPos[n*3+1]=p.y; pPos[n*3+2]=p.z; pCol[n*3]=p.r*f; pCol[n*3+1]=p.g*f; pCol[n*3+2]=p.b*f; n++; }
  plist = plist.filter(p => p.life > 0);
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

