// ---------- storage / audio ----------
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
let hiScore = +(lsGet('iconpatrol3d.hi')||0), invert = lsGet('iconpatrol3d.inv') === '1', fpv = lsGet('iconpatrol3d.view') !== 'chase';
function showHi(){ $('hiNote').textContent = hiScore ? 'High score: ' + hiScore : ''; }
function showInv(){ renderSettings(); }
function showView(){ renderSettings(); const t = document.getElementById('tView'); if (t) t.textContent = fpv ? 'VIEW: 1ST' : 'VIEW: 3RD'; }
const FLIGHT_MODES = ['assist','coord','drift'], FLIGHT_NAME = {assist:'Assist', coord:'Coordinated', drift:'Pure drift'};
let flightMode = FLIGHT_MODES.includes(lsGet('iconpatrol3d.flight2')) ? lsGet('iconpatrol3d.flight2') : 'drift';   // default: pure drift (assist/coordinated need more tuning)
function showFlight(){ renderSettings(); const t = document.getElementById('tFlight'); if (t) t.textContent = 'FLT: ' + FLIGHT_NAME[flightMode].split(' ').pop().toUpperCase(); }
function cycleFlight(){ flightMode = FLIGHT_MODES[(FLIGHT_MODES.indexOf(flightMode)+1) % 3]; lsSet('iconpatrol3d.flight2', flightMode); showFlight();
  if (G.state === 'play') toast({assist:'Flight: ASSIST · bank to turn, momentum follows the nose', coord:'Flight: COORDINATED · turns bank automatically, ship drifts', drift:'Flight: PURE DRIFT · no assists'}[flightMode]); }
// HUD detail: full = every guide always; clean = guides only when useful and faded near the crosshair; minimal = crosshair, lock-on, navball
const HUD_MODES = ['full','clean','minimal'], HUD_NAME = {full:'Full', clean:'Clean', minimal:'Minimal'};
let hudMode = HUD_MODES.includes(lsGet('iconpatrol3d.hud')) ? lsGet('iconpatrol3d.hud') : 'clean';
function showHud(){ renderSettings(); const t = document.getElementById('tHud'); if (t) t.textContent = 'HUD: ' + HUD_NAME[hudMode].toUpperCase(); }
function cycleHud(){ hudMode = HUD_MODES[(HUD_MODES.indexOf(hudMode) + 1) % HUD_MODES.length]; lsSet('iconpatrol3d.hud', hudMode); showHud();
  if (G.state === 'play') toast({full:'HUD: FULL · every flight guide shown', clean:'HUD: CLEAN · guides only while turning or drifting', minimal:'HUD: MINIMAL · crosshair, lock-on and navball'}[hudMode]); }
function toggleView(){ fpv = !fpv; lsSet('iconpatrol3d.view', fpv ? 'fp' : 'chase'); showView(); if (G.state === 'play') toast(fpv ? 'First-person view' : 'Chase camera'); }
showHi(); showInv(); showView(); showFlight();
let actx = null, muted = lsGet('iconpatrol.muted') === '1';
function beep(f, dur=0.08, type='square', vol=0.05, slide=0){
  if (muted) return;
  try {
    if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide), t+dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+dur);
  } catch(e){}
}
const SFX = {
  shoot:()=>beep(880,0.05,'square',0.022,-400),
  capture:()=>{beep(660,0.07,'triangle',0.06);setTimeout(()=>beep(990,0.09,'triangle',0.06),60);},
  cleanse:()=>beep(520,0.12,'sine',0.07,500),
  hit:()=>beep(200,0.05,'sawtooth',0.04),
  boom:()=>beep(120,0.35,'sawtooth',0.08,-90),
  hurt:()=>beep(90,0.2,'square',0.07,-40),
  infect:()=>beep(300,0.18,'sawtooth',0.04,-200),
  del:()=>beep(160,0.25,'triangle',0.06,-100),
  wave:()=>{[440,554,659,880].forEach((f,i)=>setTimeout(()=>beep(f,0.1,'triangle',0.05),i*90));},
};

