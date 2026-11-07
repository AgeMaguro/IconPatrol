// ---------- input ----------
const keys = {};
const KEYMAP = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',Space:'fire',ShiftLeft:'boost',ShiftRight:'boost'};
addEventListener('keydown', e => {
  if (e.code==='Escape' && settingsOpen && G.state !== 'play'){ closeSettings(); return; }
  if (KEYMAP[e.code]){ keys[KEYMAP[e.code]] = true; if (G.state==='play') e.preventDefault(); }
  if (G.state==='play'){
    if (e.code==='KeyP' || e.code==='Escape'){ if (settingsOpen) closeSettings(); else G.paused = !G.paused; }
  }
  if (e.code==='KeyM'){ muted = !muted; lsSet('iconpatrol.muted', muted?'1':'0'); renderSettings(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k]=false; if (G.state==='play') G.paused = true; });

// ---------- overlays ----------
const $ = id => document.getElementById(id);
function hideAll(){ ['title','map','end','settings','pause','hangar'].forEach(id => $(id).classList.remove('show')); settingsOpen = null; setNav(null); }

// ---------- settings + pause menus ----------
const IN_APP = /IconPatrolApp/.test(navigator.userAgent);
if (IN_APP) document.body.classList.add('inapp');
var settingsOpen = null, pauseShown = false;   // var: read by renderSettings() during early setup
function settingItems(){
  const items = [];
  items.push({lab:'Auto-fire', desc:'Touch screens: fires when a virus or infected icon is lined up.', val:() => TC.auto ? 'On' : 'Off', act:() => { TC.auto = !TC.auto; lsSet('iconpatrol.autofire', TC.auto ? '1' : '0'); const ab = document.getElementById('tAuto'); if (ab) ab.textContent = 'AUTO-FIRE ' + (TC.auto ? 'ON' : 'OFF'); }});
  items.push({lab:'Sound', desc:'Key M.', val:() => muted ? 'Off' : 'On', act:() => { muted = !muted; lsSet('iconpatrol.muted', muted?'1':'0'); }});
  return items;
}
