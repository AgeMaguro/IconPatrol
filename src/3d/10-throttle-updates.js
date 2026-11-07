// ---------- throttle lever ----------
let throttle = 0, effThr = 0, leverHeld = false;
// thrust control: 'lever' = throttle stays where you set it (default); 'hold' = classic, thrust only while the button is held
let thrustMode = lsGet('iconpatrol3d.thrust') === 'hold' ? 'hold' : 'lever';
const REDLINE = 1.7, LEVER_100 = 0.76; const IMPULSE = 0.25;   // thrust left when the fuel tank is empty
const leverVal = f => f <= LEVER_100 ? f/LEVER_100 : 1 + (f-LEVER_100)/(1-LEVER_100)*(REDLINE-1);
const leverFrac = v => v <= 1 ? v*LEVER_100 : LEVER_100 + (v-1)/(REDLINE-1)*(1-LEVER_100);
(function(){
  const lv = $('tThr'); if (!lv) return; let pid = null;
  const set = e => { const r = lv.getBoundingClientRect(); throttle = leverVal(Math.max(0, Math.min(1, (r.bottom - e.clientY)/r.height))); };
  const release = () => { pid = null; leverHeld = false; lv.classList.remove('down'); if (throttle > 1) throttle = 1; if (thrustMode === 'hold') throttle = 0; };
  lv.addEventListener('pointerdown', e => { pid = e.pointerId; leverHeld = true; try { lv.setPointerCapture(pid); } catch(_){} lv.classList.add('down'); set(e); e.preventDefault(); });
  lv.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e); });
  lv.addEventListener('pointerup', e => { if (e.pointerId === pid) release(); });
  lv.addEventListener('pointercancel', e => { if (e.pointerId === pid) release(); });
  lv.addEventListener('lostpointercapture', () => { if (pid !== null) release(); });
  setInterval(() => {
    if (G.state !== 'play') return;
    const v = P ? Math.max(throttle, effThr) : 0, f = leverFrac(v) * 100, red = v > 1.001;
    lv.querySelector('.tlFill').style.height = f + '%'; lv.querySelector('.tlFill').classList.toggle('red', red);
    lv.querySelector('.tlKnob').style.bottom = f + '%'; lv.querySelector('.tlKnob').classList.toggle('red', red);
    lv.querySelector('.tlLab').textContent = Math.round(v*100) + '%';
    lv.querySelector('.tlRed').classList.toggle('dead', !!(P && P.boost <= 0));
  }, 50);
})();
function showTitle(){ hideAll(); unlockMouse(); G.state = 'title'; showHi(); $('title').classList.add('show'); navFirst(); }
function showMap(){
  if (G.state === 'play' && P) G.res = {hull:Math.max(1, P.hull), ammo:P.ammo, fuel:P.fuel, msl:P.msl};   // carry resources to the next sector
  feedClear();
  hideAll(); unlockMouse(); G.state = 'map';
  $('mShip').textContent = shipDef().name; $('mShip').style.color = shipDef().color;
  $('mScore').textContent = G.score; $('mLives').textContent = G.lives; $('mClean').textContent = G.cleared + ' / ' + G.sectors.length;
  const box = $('sectors'); box.innerHTML = '';
  const need = gateNeed();
  for (const s of G.sectors){
    const b = document.createElement('button'); b.className = 'sector' + (s.cleared ? ' done' : '');
    b.innerHTML = `<span class="f"></span>${esc(s.path)}<br><span class="n">${s.files.length} file${s.files.length>1?'s':''}</span>`;
    if (!s.cleared) b.onclick = () => startSector(s);
    box.appendChild(b);
  }
  const gate = document.createElement('button'); gate.className = 'sector gate';
  if (G.cleared >= need){ gate.innerHTML = "<b>☠ DEMON'S GATE</b><br><span class='n'>The source of the infection. Enter if you dare.</span>"; gate.onclick = startBoss; }
  else { gate.disabled = true; gate.innerHTML = `<b>☠ DEMON'S GATE</b><br><span class='n'>Sealed. Clean ${need-G.cleared} more sector${need-G.cleared>1?'s':''}.</span>`; }
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
  hideAll(); unlockMouse(); G.state = 'end';
  if (G.score > hiScore){ hiScore = G.score; lsSet('iconpatrol3d.hi', hiScore); }
  $('endTitle').textContent = win ? 'DRIVE CLEAN' : 'GAME OVER';
  $('endText').textContent = win
    ? `The Inner Demon is gone and your files are safe. Final score: ${G.score}. Sectors cleaned: ${G.cleared}.`
    : `Your ship was lost in ${G.cur ? G.cur.path : 'cyberspace'}. Final score: ${G.score}. Sectors cleaned: ${G.cleared}.`;
  $('end').classList.add('show'); navFirst();
}
function esc(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
$('demoBtn').onclick = () => { beep(1,0.01,'sine',0.0001); newRun(buildDemo()); };
$('freeBtn').onclick = () => { beep(1,0.01,'sine',0.0001); showHangar(null); pendingFree = true; };
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
$('pResume').onclick = () => { G.paused = false; relockIfWanted(); };
$('pInf').onclick = () => { freeInf = !freeInf; if (freeInf && P){ P.ammo = S.maxAmmo; P.fuel = S.maxFuel; P.msl = S.maxMsl; P.hull = S.maxHull; } lsSet('iconpatrol3d.freeInf', freeInf ? '1' : '0'); showInf(); toast(freeInf ? 'Infinite resources ON (free flight only)' : 'Infinite resources OFF: ammo, fuel and missiles are used up'); };
$('pSettings').onclick = () => openSettings('pause');
$('pMap').onclick = () => { G.paused = false; abortToMap(); };
$('pQuit').onclick = () => { G.paused = false; timers = []; showTitle(); };
$('againBtn').onclick = showTitle;

