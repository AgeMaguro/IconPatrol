
(() => {
const $ = id => document.getElementById(id);
const glCanvas = $('gl'), hud = $('hud'), hx = hud.getContext('2d');
let showFps = false; const perf = {acc:0, n:0, fps:60, low:0, high:0};
function perfTick(rd){
  if (rd <= 0 || rd > 0.5) return;
  perf.acc += rd; perf.n++;
  if (perf.acc >= 0.5){
    perf.fps = perf.n/perf.acc; perf.acc = 0; perf.n = 0;
    if (G.state === 'play' && !G.paused){
      // auto quality: drop resolution after ~1.5s under 50fps, raise it back after ~4s above 58fps
      if (perf.fps < 50){ perf.low++; perf.high = 0; } else if (perf.fps > 58){ perf.high++; perf.low = 0; } else { perf.low = perf.high = 0; }
      if (perf.low >= 3 && RSCALE > 0.5){ RSCALE = Math.max(0.5, RSCALE - 0.15); perf.low = 0; applyRenderScale(); }
      if (perf.high >= 8 && RSCALE < 1){ RSCALE = Math.min(1, RSCALE + 0.1); perf.high = 0; applyRenderScale(); }
    }
  }
}
const MAXDPR = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 1.5 : 2;
const PIX_BUDGET = 2.4e6;            // max 3D pixels per frame (~1080p-ish); big/high-DPI screens render a bit softer instead of lagging
let RSCALE = 1, glDPR = 0;          // adaptive render scale (auto quality)
let W = innerWidth, H = innerHeight, DPR = Math.min(MAXDPR, devicePixelRatio || 1);

let renderer;
try { renderer = new THREE.WebGLRenderer({canvas:glCanvas, antialias:true}); }
catch(e){ document.querySelector('#title .sub').textContent = "Your browser couldn't start 3D graphics (WebGL). Try Chrome or Edge with hardware acceleration turned on."; return; }
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040c);
scene.fog = new THREE.FogExp2(0x03040c, 0.0011);
const camera = new THREE.PerspectiveCamera(72, W/H, 0.5, 7000);
function applyRenderScale(){
  const budget = Math.sqrt(PIX_BUDGET/(W*H));
  const g = Math.max(0.5, Math.min(DPR, budget) * RSCALE);
  if (Math.abs(g - glDPR) > 0.01){ glDPR = g; renderer.setPixelRatio(g); renderer.setSize(W, H, false); }
}
function resize(){
  W = innerWidth; H = innerHeight; DPR = Math.min(MAXDPR, devicePixelRatio || 1);
  applyRenderScale(); renderer.setSize(W, H, false);
  glCanvas.style.width = W+'px'; glCanvas.style.height = H+'px';
  hud.width = W*DPR; hud.height = H*DPR; hud.style.width = W+'px'; hud.style.height = H+'px';
  hx.setTransform(DPR,0,0,DPR,0,0);
  camera.aspect = W/H; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

