$('pResume').onclick = () => { G.paused = false; relockIfWanted(); };
$('pInf').onclick = () => { freeInf = !freeInf; if (freeInf && P){ P.ammo = S.maxAmmo; P.fuel = S.maxFuel; P.msl = S.maxMsl; P.hull = S.maxHull; } lsSet('iconpatrol3d.freeInf', freeInf ? '1' : '0'); showInf(); toast(freeInf ? 'Infinite resources ON (free flight only)' : 'Infinite resources OFF: ammo, fuel and missiles are used up'); };
$('pSettings').onclick = () => openSettings('pause');
$('pMap').onclick = () => { G.paused = false; abortToMap(); };
$('pQuit').onclick = () => { G.paused = false; timers = []; showTitle(); };
$('againBtn').onclick = showTitle;

