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
