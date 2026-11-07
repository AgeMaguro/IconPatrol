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
