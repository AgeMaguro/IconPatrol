
(() => {
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize(){
  const d = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W*d; cv.height = H*d; cv.style.width = W+'px'; cv.style.height = H+'px';
  ctx.setTransform(d,0,0,d,0,0);
}
addEventListener('resize', resize); resize();

