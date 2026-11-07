// ---------- input ----------
const keys = {};
const KEYMAP = {ArrowUp:'pu',ArrowDown:'pd',ArrowLeft:'yl',ArrowRight:'yr',KeyA:'rl',KeyQ:'rl',KeyD:'rr',KeyE:'rr',KeyW:'th',KeyS:'br',Space:'fire',KeyR:'msl',ShiftLeft:'boost',ShiftRight:'boost'};
addEventListener('keydown', e => {
  if (e.code === 'Escape' && settingsOpen && G.state !== 'play'){ closeSettings(); return; }
  if (KEYMAP[e.code]){ keys[KEYMAP[e.code]] = true; if (G.state==='play') e.preventDefault(); }
  if (G.state === 'play'){
    if (e.code === 'KeyP' || (e.code === 'Escape' && performance.now() - lockLostAt > 400)){ if (settingsOpen) closeSettings(); else { G.paused = !G.paused; if (!G.paused) relockIfWanted(); } mouse.dx = mouse.dy = 0; }
  }
  if (e.code === 'KeyM'){ muted = !muted; lsSet('iconpatrol.muted', muted?'1':'0'); renderSettings(); }
  if (e.code === 'KeyV') toggleView();
  if (e.code === 'KeyG') cycleFlight();
  if (e.code === 'KeyH') cycleHud();
  if (e.code === 'KeyF'){ showFps = !showFps; renderSettings(); }
  if (e.code === 'KeyX' && G.state === 'play'){ throttle = 0; toast('Throttle cut'); }
  if (e.code === 'KeyI'){ invert = !invert; lsSet('iconpatrol3d.inv', invert?'1':'0'); showInv(); toast('Invert pitch: ' + (invert?'ON':'OFF')); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.fire = false; if (G.state==='play') G.paused = true; });
let lockLostAt = -1e9;
const mouse = {dx:0, dy:0, sx:0, sy:0, fire:false, msl:false, locked:false, skip:0, wanted:false, selfUnlock:false};
hud.style.pointerEvents = 'none';
glCanvas.addEventListener('mousedown', e => {
  if (G.state !== 'play' || TC.used) return;
  if (!mouse.locked){ lockMouse(); return; }
  if (e.button === 0) mouse.fire = true;
  if (e.button === 2) mouse.msl = true;
});
glCanvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 0) mouse.fire = false; if (e.button === 2) mouse.msl = false; });
document.addEventListener('pointerlockchange', () => {
  mouse.locked = document.pointerLockElement === glCanvas;
  if (mouse.locked) mouse.wanted = true;                       // remember the player likes mouse steering
  else { mouse.fire = false; if (!mouse.selfUnlock && G.state === 'play'){ mouse.wanted = true; G.paused = true; lockLostAt = performance.now(); } } // Esc during play = pause (mouse re-locks on Resume)
  mouse.selfUnlock = false; mouse.dx = mouse.dy = 0; mouse.skip = 2;
});
addEventListener('mousemove', e => {
  if (!mouse.locked) return;
  // only count movement while actually flying, so nothing piles up during pause / death / menus
  if (G.state !== 'play' || G.paused || !P || !P.alive){ mouse.dx = mouse.dy = 0; return; }
  if (mouse.skip > 0){ mouse.skip--; return; }                    // first events after locking can be bogus
  const mx = e.movementX, my = e.movementY;
  if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;              // Chrome/Windows pointer-lock spike: ignore
  mouse.dx += mx; mouse.dy += my;
});
addEventListener('wheel', e => { if (G.state !== 'play') return; throttle = Math.max(0, Math.min(1, Math.min(1, throttle) - Math.sign(e.deltaY)*0.05)); e.preventDefault(); }, {passive:false});
function unlockMouse(){ try { if (document.pointerLockElement){ mouse.selfUnlock = true; document.exitPointerLock(); } } catch(e){} }
function lockMouse(){ if (TC.used || mouse.locked) return; try { const r = glCanvas.requestPointerLock(); if (r && r.catch) r.catch(()=>{}); } catch(err){} }
function relockIfWanted(){ if (mouse.wanted) lockMouse(); }   // called from the click that starts a sector (counts as a user action)

// gamepad
let pad = {pitch:0, yaw:0, roll:0, thrust:0, brake:0, fire:false, boost:false}, padPrev = [], padGp = null, navCool = 0, navEl = null, padUsed = false;
function rumble(ms, str){ try { padGp && padGp.vibrationActuator && padGp.vibrationActuator.playEffect('dual-rumble', {duration:ms, strongMagnitude:str, weakMagnitude:str*0.6}); } catch(e){} }
function focusables(){ const ov = document.querySelector('.overlay.show'); return ov ? [...ov.querySelectorAll('button:not(:disabled)')] : []; }
function setNav(el){ if (navEl) navEl.classList.remove('gpf'); navEl = el; if (el){ el.classList.add('gpf'); el.scrollIntoView({block:'nearest'}); } }
function navFirst(){ if (padUsed) setNav(focusables()[0] || null); }
function navMove(dir){
  const els = focusables(); if (!els.length) return;
  if (!navEl || !els.includes(navEl)){ setNav(els[0]); return; }
  const r = navEl.getBoundingClientRect(), cx = r.left+r.width/2, cy = r.top+r.height/2, vert = dir==='up'||dir==='down';
  let best = null, bs = 1e9;
  for (const e of els){
    if (e === navEl) continue;
    const q = e.getBoundingClientRect(), dx = q.left+q.width/2-cx, dy = q.top+q.height/2-cy;
    const ok = dir==='up' ? dy < -5 : dir==='down' ? dy > 5 : dir==='left' ? dx < -5 : dx > 5;
    if (!ok) continue;
    const sc = vert ? Math.abs(dy) + Math.abs(dx)*2.5 : Math.abs(dx) + Math.abs(dy)*2.5;
    if (sc < bs){ bs = sc; best = e; }
  }
  if (best){ setNav(best); beep(700,0.03,'triangle',0.03); }
}
function navActivate(){
  const els = focusables();
  if (!navEl || !els.includes(navEl)){ setNav(els[0] || null); return; }
  const i = els.indexOf(navEl); navEl.click();
  if (!document.body.contains(navEl) || navEl.disabled || !focusables().includes(navEl)){ const now = focusables(); setNav(now[Math.min(i, now.length-1)] || null); }
}
let padBlocked = false;
function pollPad(dt){
  let gps = [];
  if (padBlocked) return;
  try { gps = navigator.getGamepads ? (navigator.getGamepads() || []) : []; } catch(e){ padBlocked = true; return; }
  let gp = null; for (const g of gps) if (g && g.connected){ gp = g; break; }
  padGp = gp;
  if (!gp){ pad = {pitch:0, yaw:0, roll:0, thrust:0, brake:0, fire:false, boost:false}; padPrev = []; return; }
  const bv = i => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0;
  const b = i => bv(i) > 0.4;
  const ax = i => gp.axes[i] || 0;
  const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v)*0.15)/0.85;
  let yaw = -dz(ax(0)), pitch = -dz(ax(1)), roll = gp.mapping === 'standard' ? -dz(ax(2)) : 0;
  if (b(12)) pitch = 1; if (b(13)) pitch = -1; if (b(14)) yaw = 1; if (b(15)) yaw = -1;
  if (b(4)) roll = 1; if (b(5)) roll = -1;
  pad = {pitch, yaw, roll, thrust: bv(7), brake: bv(6), fire: b(0), msl: b(2), boost: b(1)||b(10)};
  const pressed = i => b(i) && !padPrev[i];
  if (gp.buttons.some((_,i)=>b(i)) || Math.abs(ax(0))>0.5 || Math.abs(ax(1))>0.5) padUsed = true;
  if (G.state === 'play' && !G.paused && !settingsOpen){
    if (pressed(9)) G.paused = true;
    if (pressed(8)) abortToMap();
    if (pressed(3)) toggleView();
    if (pressed(11)) cycleHud();
  } else {
    if (pressed(1) && settingsOpen){ closeSettings(); padPrev = gp.buttons.map((_,i) => b(i)); return; }
    if (pressed(9) && G.state === 'play'){ if (settingsOpen) closeSettings(); G.paused = false; padPrev = gp.buttons.map((_,i) => b(i)); return; }
    if (pressed(1) && G.state === 'play' && G.paused){ G.paused = false; padPrev = gp.buttons.map((_,i) => b(i)); return; }
    navCool -= dt;
    let dir = null;
    if (b(12) || ax(1) < -0.6) dir = 'up'; else if (b(13) || ax(1) > 0.6) dir = 'down';
    else if (b(14) || ax(0) < -0.6) dir = 'left'; else if (b(15) || ax(0) > 0.6) dir = 'right';
    if (dir && navCool <= 0){ navMove(dir); navCool = 0.22; }
    if (!dir) navCool = 0;
    if (pressed(0) || (pressed(9) && G.state !== 'play')) navActivate();
  }
  padPrev = gp.buttons.map((_,i) => b(i));
}
let toastT = null;
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>el.classList.remove('show'), 2600); }
addEventListener('gamepadconnected', e => { padUsed = true; toast('🎮 ' + (e.gamepad.id||'Controller').replace(/\(.*\)/,'').trim().slice(0,40) + ' connected'); navFirst(); });
addEventListener('gamepaddisconnected', () => { toast('Controller disconnected'); if (G.state==='play') G.paused = true; });

