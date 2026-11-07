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
