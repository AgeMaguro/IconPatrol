$('pResume').onclick = () => { G.paused = false; };
$('pSettings').onclick = () => openSettings('pause');
$('pMap').onclick = () => { G.paused = false; abortToMap(); };
$('pQuit').onclick = () => { G.paused = false; timers = []; showTitle(); };
$('againBtn').onclick = showTitle;

