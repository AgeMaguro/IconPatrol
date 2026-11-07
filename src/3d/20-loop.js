// ---------- loop ----------
let last = performance.now();
function loop(now){
  const rawDt = (now-last)/1000; const dt = Math.min(0.05, rawDt); last = now; const t = now/1000;
  perfTick(rawDt);
  NB = Math.round(Math.max(54, Math.min(156, H*0.27)));
  pollPad(dt);
  if (!G.paused || G.state !== 'play') update(dt);
  if (!G.paused) updateParticles(dt);
  if (G.state !== 'play' && G.state !== 'end'){ // idle drift behind menus
    camera.position.set(Math.sin(t*0.05)*300, Math.sin(t*0.07)*80, Math.cos(t*0.05)*300); camera.lookAt(0,0,0); ship.visible = false;
  } else updateCamera(dt);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.render(scene, camera);
  if (P && G.state === 'play'){
    updateNavball();
    renderer.autoClear = false; renderer.clearDepth();
    const sw = fpv && P.alive, x = W/2 - NB/2 + (sw ? CK.x : 0), y = (H > 360 ? 14 : 6) - (sw ? CK.y : 0);
    renderer.setViewport(x, y, NB, NB); renderer.setScissor(x, y, NB, NB); renderer.setScissorTest(true);
    renderer.render(nbScene, nbCam);
    renderer.setScissorTest(false); renderer.autoClear = true;
  }
  drawHUD(t);
  if (G.state === 'hangar') drawHangarPreview(t);
  syncMenus();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// remember when a sector started (for the mouse hint)
const origHide = hideAll;
})();
