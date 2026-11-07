// ---------- gamepad ----------
let pad = {turn:0, up:false, fire:false, boost:false}, padPrev = [], padGp = null, navCool = 0, navEl = null, padUsed = false;
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
  if (!gp){ pad = {turn:0, up:false, fire:false, boost:false}; padPrev = []; return; }
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const dz = v => Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v)*0.2)/0.8;
  let turn = dz(ax); if (b(14)) turn = -1; if (b(15)) turn = 1;
  // A / RT / D-pad up / stick up = thrust · X / Y / RB = fire · B / LT / LB = boost
  pad = {turn, up: b(0)||b(7)||b(12)||ay < -0.6, fire: b(2)||b(3)||b(5), boost: b(1)||b(4)||b(6)};
  const pressed = i => b(i) && !padPrev[i];
  if (gp.buttons.some((_,i)=>b(i)) || Math.abs(ax)>0.5 || Math.abs(ay)>0.5) padUsed = true;
  if (G.state === 'play' && !G.paused && !settingsOpen){
    if (pressed(9)) G.paused = true;
    if (pressed(8)) abortToMap();
  } else {
    if (pressed(1) && settingsOpen){ closeSettings(); padPrev = gp.buttons.map((_,i) => b(i)); return; }
    if (pressed(9) && G.state === 'play'){ if (settingsOpen) closeSettings(); G.paused = false; padPrev = gp.buttons.map((_,i) => b(i)); return; }
    if (pressed(1) && G.state === 'play' && G.paused){ G.paused = false; padPrev = gp.buttons.map((_,i) => b(i)); return; }
    navCool -= dt;
    let dir = null;
    if (b(12) || ay < -0.6) dir = 'up'; else if (b(13) || ay > 0.6) dir = 'down';
    else if (b(14) || ax < -0.6) dir = 'left'; else if (b(15) || ax > 0.6) dir = 'right';
    if (dir && navCool <= 0){ navMove(dir); navCool = 0.22; }
    if (!dir) navCool = 0;
    if (pressed(0) || (pressed(9) && G.state !== 'play')) navActivate();
  }
  padPrev = gp.buttons.map((_,i) => b(i));
}
let padToast = null;
addEventListener('gamepadconnected', e => { padUsed = true; const n = (e.gamepad.id||'Controller').replace(/\(.*\)/,'').trim().slice(0,40); toast('🎮 ' + n + ' connected'); navFirst(); });
addEventListener('gamepaddisconnected', () => { toast('Controller disconnected'); if (G.state==='play') G.paused = true; });
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(padToast); padToast = setTimeout(()=>el.classList.remove('show'), 2600); }
function showTitle(){ hideAll(); G.state='title'; showHi(); $('title').classList.add('show'); navFirst(); }
function showMap(){
  feedClear();
  hideAll(); G.state='map';
  $('mShip').textContent = shipDef().name; $('mShip').style.color = shipDef().color;
  $('mScore').textContent = G.score; $('mLives').textContent = G.lives; $('mClean').textContent = G.cleared + ' / ' + G.sectors.length;
  const box = $('sectors'); box.innerHTML = '';
  const need = gateNeed();
  const gate = document.createElement('button'); gate.className = 'sector gate';
  if (G.cleared >= need){ gate.innerHTML = "<b>☠ DEMON'S GATE</b><br><span class='n'>The source of the infection. Enter if you dare.</span>"; gate.onclick = startBoss; }
  else { gate.disabled = true; gate.innerHTML = `<b>☠ DEMON'S GATE</b><br><span class='n'>Sealed. Clean ${need-G.cleared} more sector${need-G.cleared>1?'s':''}.</span>`; }
  for (const s of G.sectors){
    const b = document.createElement('button'); b.className = 'sector' + (s.cleared?' done':'');
    b.innerHTML = `<span class="f"></span>${esc(s.path)}<br><span class="n">${s.files.length} file${s.files.length>1?'s':''}</span>`;
    if (!s.cleared) b.onclick = () => startSector(s); else b.disabled = false;
    box.appendChild(b);
  }
  box.appendChild(gate);
  renderShop();
  $('map').classList.add('show'); navFirst();
}
function renderShop(){
  $('mBits').textContent = G.bits;
  const shop = $('shop'); shop.innerHTML = '';
  for (const u of UPGRADES){
    const lvl = G.up[u.k], max = u.costs.length, cost = u.costs[lvl];
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<div class="nm">${u.name}</div><div class="pips">${Array.from({length:max},(_,i)=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</div><div class="ds">${u.desc}</div>`;
    const b = document.createElement('button');
    if (lvl >= max){ b.textContent = 'MAXED'; b.disabled = true; b.className = 'alt'; }
    else { b.textContent = `Upgrade · ◆${cost}`; b.disabled = G.bits < cost;
      b.onclick = () => { if (G.bits < cost) return; G.bits -= cost; G.up[u.k]++; [440,660,880].forEach((f,i)=>setTimeout(()=>beep(f,0.08,'triangle',0.05),i*60)); renderShop(); }; }
    card.appendChild(b); shop.appendChild(card);
  }
}
function showEnd(win){
  hideAll(); G.state='end';
  if (G.score > hiScore){ hiScore = G.score; lsSet('iconpatrol.hi', hiScore); }
  $('endTitle').textContent = win ? 'DRIVE CLEAN' : 'GAME OVER';
  $('endText').textContent = win
    ? `The Inner Demon is gone and your files are safe. Final score: ${G.score}. Sectors cleaned: ${G.cleared}.`
    : `Your ship was lost in ${G.cur ? G.cur.path : 'cyberspace'}. Final score: ${G.score}. Sectors cleaned: ${G.cleared}.`;
  $('end').classList.add('show'); navFirst();
}
function esc(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

$('demoBtn').onclick = () => { beep(1,0.01,'sine',0.0001); newRun(buildDemo()); };
$('dirInput').onchange = e => {
  const list = [...e.target.files]; e.target.value = '';
  const secs = buildFromFiles(list);
  if (!secs.length){ $('hiNote').textContent = "That folder didn't have any files I could use. Try another one."; return; }
  beep(1,0.01,'sine',0.0001); newRun(secs);
};
$('quitBtn').onclick = showTitle;
$('setBtn').onclick = () => openSettings('title');
// ---------- app updates (the Android app provides window.IconApp) ----------
window.__updateStatus = st => {
  window.__lastUpdate = st;
  const n = document.getElementById('updNote'), b = document.getElementById('updBtn'); if (!n || !b) return;
  const cur = st.current ? ' (you have ' + st.current + ')' : '';
  n.classList.toggle('hot', st.state === 'available'); b.classList.toggle('hot', st.state === 'available');
  b.disabled = ['checking','downloading','installing'].includes(st.state);
  b.textContent = st.state === 'available' ? '⬆ Install update ' + st.latest : '⬆ Check for updates';
  n.textContent = {
    idle: 'Version ' + (st.current || ''),
    checking: 'Checking for updates…',
    current: 'You have the newest version' + (st.latest ? ' (' + st.latest + ')' : '') + '.',
    available: 'Update available: ' + st.latest + cur + '.',
    downloading: 'Downloading update… ' + (st.pct >= 0 ? st.pct + '%' : ''),
    installing: 'Installing… if Android asks, tap Update.',
    done: 'Updated! Restarting…',
    permission: 'One-time step: allow "Install unknown apps" for Icon Patrol, come back, then tap the button again.',
    error: 'Update problem: ' + (st.msg || 'unknown') + '.',
  }[st.state] || '';
  if (st.state === 'error' && window.IconApp && IconApp.openUpdateInBrowser){
    b.textContent = '⬆ Try again';
    const a = document.createElement('a'); a.href = '#'; a.textContent = ' Or download it in the browser instead'; a.style.color = '#fde68a';
    a.onclick = e => { e.preventDefault(); IconApp.openUpdateInBrowser(); }; n.appendChild(a);
  }
};
if ($('exitBtn')) $('exitBtn').onclick = () => { if (window.IconApp && IconApp.quit) IconApp.quit(); };   // PC app only
if (window.IconApp && IconApp.onUpdateStatus) IconApp.onUpdateStatus(st => window.__updateStatus(st));   // PC app
if (window.IconApp){
  $('updBtn').onclick = () => { const st = window.__lastUpdate || {}; if (st.state === 'available' || st.state === 'error') IconApp.installUpdate(); else IconApp.checkForUpdate(true); };
  if (window.__lastUpdate) window.__updateStatus(window.__lastUpdate);
  else { window.__updateStatus({state:'idle', current: IconApp.version()}); setTimeout(() => IconApp.checkForUpdate(false), 1200); }
}
$('sBack').onclick = closeSettings;
$('launchBtn').onclick = launchRun;
$('hangarBack').onclick = showTitle;
$('pResume').onclick = () => { G.paused = false; };
$('pSettings').onclick = () => openSettings('pause');
$('pMap').onclick = () => { G.paused = false; abortToMap(); };
$('pQuit').onclick = () => { G.paused = false; timers = []; showTitle(); };
$('againBtn').onclick = showTitle;

