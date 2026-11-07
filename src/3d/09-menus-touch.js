// ---------- overlays ----------
function hideAll(){ ['title','map','end','settings','pause','hangar'].forEach(id => $(id).classList.remove('show')); settingsOpen = null; setNav(null); }

// ---------- settings + pause menus ----------
const IN_APP = /IconPatrolApp/.test(navigator.userAgent);
if (IN_APP) document.body.classList.add('inapp');
var settingsOpen = null, pauseShown = false;   // var: read by renderSettings() during early setup
function settingItems(){
  const items = [];
  items.push({lab:'View', desc:'First person (cockpit) or chase camera. Key V · controller Y.', val:() => fpv ? 'First person' : 'Chase cam', act:toggleView});
  items.push({lab:'HUD detail', desc:'Clean (default): flight guides only while turning or drifting, faded near the crosshair. Full: every guide always. Minimal: crosshair, lock-on and navball. Key H · controller R3.', val:() => HUD_NAME[hudMode], act:cycleHud});
  items.push({lab:'Flight mode', desc:'Pure drift (default): no assists, real momentum. Assist and Coordinated are experimental. Key G.', val:() => FLIGHT_NAME[flightMode], act:cycleFlight});
  items.push({lab:'Thrust control', desc:'Throttle lever (default): W / RT / the touch lever set a throttle that stays put. Hold to thrust: classic, the ship only pushes while W / RT / the lever is held, and coasts when you let go. S / LT brake.', val:() => thrustMode === 'hold' ? 'Hold to thrust' : 'Throttle lever', act:() => { thrustMode = thrustMode === 'hold' ? 'lever' : 'hold'; lsSet('iconpatrol3d.thrust', thrustMode); throttle = 0; if (G.state === 'play') toast(thrustMode === 'hold' ? 'Thrust: HOLD · push only while held' : 'Thrust: LEVER · throttle stays put'); }});
  items.push({lab:'Invert pitch', desc:'Push up to dive (flight-sim style). Key I.', val:() => invert ? 'On' : 'Off', act:() => { invert = !invert; lsSet('iconpatrol3d.inv', invert?'1':'0'); showInv(); }});
  items.push({lab:'Auto-fire', desc:'Touch screens: fires when a virus or infected icon is lined up.', val:() => TC.auto ? 'On' : 'Off', act:() => { TC.auto = !TC.auto; lsSet('iconpatrol.autofire', TC.auto ? '1' : '0'); const ab = document.getElementById('tAuto'); if (ab) ab.textContent = 'AUTO-FIRE ' + (TC.auto ? 'ON' : 'OFF'); }});
  items.push({lab:'Sound', desc:'Key M.', val:() => muted ? 'Off' : 'On', act:() => { muted = !muted; lsSet('iconpatrol.muted', muted?'1':'0'); }});
  items.push({lab:'Show FPS', desc:'Frame rate and render resolution. Key F.', val:() => showFps ? 'On' : 'Off', act:() => { showFps = !showFps; }});
  return items;
}
function renderSettings(){
  const list = document.getElementById('setList'); if (!list || !settingsOpen) return;
  const focusedIdx = navEl ? [...list.querySelectorAll('button')].indexOf(navEl) : -1;
  list.innerHTML = '';
  for (const it of settingItems()){
    const row = document.createElement('div'); row.className = 'setrow';
    row.innerHTML = `<div class="lab">${it.lab}<small>${it.desc}</small></div>`;
    const b = document.createElement('button'); b.className = 'alt'; b.textContent = it.val();
    b.onclick = () => { it.act(); renderSettings(); beep(660,0.05,'triangle',0.04); };
    row.appendChild(b); list.appendChild(row);
  }
  if (focusedIdx >= 0){ const bs = list.querySelectorAll('button'); if (bs[focusedIdx]) setNav(bs[focusedIdx]); }
}
function openSettings(from){
  settingsOpen = from;
  if (from === 'title') $('title').classList.remove('show');
  $('pause').classList.remove('show');
  renderSettings(); $('settings').classList.add('show'); setNav(null); navFirst();
}
function closeSettings(){
  const from = settingsOpen; settingsOpen = null; $('settings').classList.remove('show'); setNav(null);
  if (from === 'title') showTitle();
  else pauseShown = false;   // pause menu comes back on the next sync
}
function syncMenus(){
  const want = G.state === 'play' && G.paused && !settingsOpen;
  if (want !== pauseShown){
    pauseShown = want; $('pause').classList.toggle('show', want);
    if (want){ setNav(null); navFirst(); unlockMouse(); }
  }
}
// Android back button (the app calls this): settings -> back, playing -> pause/resume, map -> title, title -> exit
window.onBack = () => {
  if (settingsOpen){ closeSettings(); return true; }
  if (G.state === 'play'){ G.paused = !G.paused; return true; }
  if (G.state === 'map' || G.state === 'end' || G.state === 'hangar'){ showTitle(); return true; }
  return false;
};
function abortToMap(){ if (G.state !== 'play' || G.lives < 0) return; if (G.cur && G.cur.free){ timers = []; showTitle(); return; } if (G.cur && G.cur._finish){ timers = []; G.cur._finish(); return; } timers = []; if (G.cur) G.cur._waiting = false; showMap(); }

// ---------- touch controls (Android / phones / tablets) ----------
const TOUCH_IS = !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window));
const TC = {active:false, x:0, y:0, mag:0, fire:false, boost:false, thrust:false, brake:false, rollL:false, rollR:false, auto:true, used:TOUCH_IS};
const CATNAME = {image:'Pictures', audio:'Music', video:'Videos', doc:'Documents', code:'Code', exe:'Apps', arch:'Archives', other:'Other'};
function buildFromPicked(list){
  const groups = {};
  for (const file of list){ const ext = extOf(file.name), k = (EXT2CAT[ext] || OTHER).k; (groups[k] = groups[k] || []).push({name:file.name, ext, file}); }
  const secs = [];
  for (const k in groups){ const arr = groups[k];
    for (let i=0; i<arr.length && secs.length<36; i+=12){ const n = Math.floor(i/12)+1; secs.push({path:'Phone\\' + CATNAME[k] + (arr.length > 12 ? ' ' + n : ''), files:arr.slice(i, i+12), cleared:false}); } }
  return secs;
}
(function(){
  if (TOUCH_IS) document.body.classList.add('touch');
  const a = lsGet('iconpatrol.autofire'); if (a !== null) TC.auto = a === '1';
  const root = $('touch'), zone = $('zoneL'), base = $('stickBase'), knob = $('stickKnob');
  let sid = null, ox = 0, oy = 0, RAD = 60;
  zone.addEventListener('pointerdown', e => { if (sid !== null) return; sid = e.pointerId; RAD = Math.max(32, Math.min(60, innerHeight*0.16)); try { zone.setPointerCapture(sid); } catch(_){}
    ox = e.clientX; oy = e.clientY; base.style.left = ox+'px'; base.style.top = oy+'px'; base.classList.add('on');
    knob.style.transform = 'translate(-50%,-50%)'; TC.active = true; TC.x = TC.y = TC.mag = 0; $('stickHint').style.display = 'none'; e.preventDefault(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX-ox, dy = e.clientY-oy; const d = Math.hypot(dx,dy);
    if (d > RAD){ dx *= RAD/d; dy *= RAD/d; } TC.x = dx/RAD; TC.y = dy/RAD; TC.mag = Math.min(1, d/RAD);
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; });
  const end = e => { if (e.pointerId !== sid) return; sid = null; TC.active = false; TC.x = TC.y = TC.mag = 0; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  root.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k;
    const on = e => { TC[k] = true; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch(_){} e.preventDefault(); };
    const off = () => { TC[k] = false; el.classList.remove('down'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  });
  $('tFlight').addEventListener('pointerdown', e => { e.preventDefault(); cycleFlight(); });
  $('tView').addEventListener('pointerdown', e => { e.preventDefault(); toggleView(); });
  document.querySelector('.tb[data-k="msl"]').addEventListener('pointerdown', () => { TC.mslTap = true; });
  $('tHud').addEventListener('pointerdown', e => { e.preventDefault(); cycleHud(); }); showHud();
  $('tPause').addEventListener('pointerdown', e => { e.preventDefault(); if (G.state === 'play') G.paused = !G.paused; });
  $('tMap').addEventListener('pointerdown', e => { e.preventDefault(); abortToMap(); });
  const ab = $('tAuto'), showAuto = () => ab.textContent = 'AUTO-FIRE ' + (TC.auto ? 'ON' : 'OFF'); showAuto();
  ab.addEventListener('pointerdown', e => { e.preventDefault(); TC.auto = !TC.auto; lsSet('iconpatrol.autofire', TC.auto ? '1' : '0'); showAuto(); });
  addEventListener('touchstart', () => { TC.used = true; document.body.classList.add('touch'); }, {passive:true});
  addEventListener('keydown', () => { TC.used = false; });
  document.addEventListener('touchmove', e => { if (G.state === 'play') e.preventDefault(); }, {passive:false});
  document.addEventListener('contextmenu', e => { if (G.state === 'play') e.preventDefault(); });
  setInterval(() => {
    const on = TC.used && G.state === 'play';
    root.classList.toggle('on', on); document.body.classList.toggle('tplay', on);
    $('tPause').textContent = on && G.paused ? '▶' : '❚❚';
    if (!on){ for (const k of ['fire','boost','thrust','brake','rollL','rollR']) TC[k] = false; TC.active = false; root.querySelectorAll('.down').forEach(x => x.classList.remove('down')); }
  }, 100);
  $('filesInput').onchange = e => {
    const list = [...e.target.files]; e.target.value = '';
    const secs = buildFromPicked(list);
    if (!secs.length){ $('hiNote').textContent = "Couldn't use those files. Try picking some photos or music."; return; }
    beep(1,0.01,'sine',0.0001); newRun(secs);
  };
  $('fsBtn').onclick = () => {
    try {
      const el = document.documentElement, r = el.requestFullscreen ? el.requestFullscreen({navigationUI:'hide'}) : null;
      if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(()=>{}); } catch(_){} }).catch(() => toast('Fullscreen isn’t allowed here. Open the downloaded file instead.'));
      else toast('Fullscreen isn’t supported in this browser.');
    } catch(_){ toast('Fullscreen isn’t allowed here.'); }
  };
})();

