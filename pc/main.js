// Icon Patrol for Windows: a small Electron shell around the same game file the Android app uses.
// Build: see pc/README.md (CI builds IconPatrol-PC.exe into the "latest" GitHub release).
//
// Launch: a small splash window checks GitHub for a newer IconPatrol-PC.exe first. If there is one, it downloads
// it, swaps it in and restarts, and the game window never opens on the old version. With no update, no internet,
// or after 8 s with no answer, the game opens as normal. The title screen's ⬆ button still checks by hand.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REPO = 'AgeMaguro/IconPatrol';
const ASSET = 'IconPatrol-PC.exe';
const STARTUP_CHECK_TIMEOUT = 8000;    // ms to wait for GitHub before opening the game anyway
let win = null, splash = null, pending = null;   // pending = {latest, url} once an update is found

// one copy at a time
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { const w = win || splash; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#02060c', title: 'Icon Patrol', show: false,
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); closeSplash(); });
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  // F11 toggles fullscreen; Esc stays free for the game's pause menu
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.alt && input.key === 'Enter') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // links open in the real browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

// ---------- startup splash ----------
const SPLASH_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#02060c;color:#bff;font:14px Consolas,monospace;overflow:hidden;-webkit-app-region:drag;user-select:none}
  .box{position:absolute;inset:0;border:2px solid #22d3ee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  h1{margin:0;font-size:26px;letter-spacing:6px;color:#67e8f9;text-shadow:0 0 12px #0ff8}
  #msg{color:#9cd;min-height:18px;text-align:center;padding:0 16px}
  .bar{width:300px;height:10px;border:1px solid #22d3ee88;border-radius:5px;overflow:hidden;visibility:hidden}
  .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#a5f3fc)}
  .ver{position:absolute;bottom:8px;right:12px;color:#4a7a8a;font-size:11px}
</style></head><body><div class="box"><h1>ICON PATROL</h1><div id="msg">Checking for updates…</div><div class="bar" id="bar"><i id="fill"></i></div></div><div class="ver" id="ver"></div></body></html>`;
function openSplash() {
  splash = new BrowserWindow({ width: 460, height: 230, frame: false, resizable: false, center: true, show: false, backgroundColor: '#02060c',
    title: 'Icon Patrol', icon: path.join(__dirname, 'icon.png'), webPreferences: { contextIsolation: true, nodeIntegration: false } });
  splash.once('ready-to-show', () => splash && splash.show());
  splash.on('closed', () => { splash = null; });
  return splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML))
    .then(() => splashSay(null, null, 'v' + app.getVersion())).catch(() => {});
}
function splashSay(msg, pct, ver) {
  if (!splash || splash.isDestroyed()) return;
  const js = [];
  if (msg != null) js.push(`document.getElementById('msg').textContent = ${JSON.stringify(msg)};`);
  if (pct != null) js.push(`document.getElementById('bar').style.visibility = 'visible'; document.getElementById('fill').style.width = '${Math.max(0, Math.min(100, pct))}%';`);
  if (ver != null) js.push(`document.getElementById('ver').textContent = ${JSON.stringify(ver)};`);
  splash.webContents.executeJavaScript(js.join('')).catch(() => {});
}
function closeSplash() { if (splash && !splash.isDestroyed()) splash.close(); splash = null; }

let gameOpened = false;
function openGame() { if (gameOpened) return; gameOpened = true; createWindow(); }

app.whenReady().then(async () => {
  await openSplash();
  // a dev run (npm start) can't replace itself, so it skips straight to the game
  if (!process.env.PORTABLE_EXECUTABLE_FILE) { splashSay('Starting…'); return setTimeout(openGame, 300); }
  let decided = false;
  const timer = setTimeout(() => { if (!decided){ decided = true; splashSay('Update check timed out, starting…'); openGame(); } }, STARTUP_CHECK_TIMEOUT);
  fetchLatest((err, info) => {
    if (decided) return; decided = true; clearTimeout(timer);
    if (err || !info.newer) { splashSay(err ? 'Offline, starting…' : 'Up to date, starting…'); return openGame(); }
    pending = info;
    splashSay(`Updating to ${info.latest}…`, 0);
    install({
      progress: pct => splashSay(pct >= 0 ? `Downloading ${info.latest}… ${pct}%` : `Downloading ${info.latest}…`, pct >= 0 ? pct : null),
      done: () => splashSay('Update installed, restarting…', 100),
      fail: msg => { splashSay('Update failed (' + msg + '), starting…'); setTimeout(openGame, 1500); },
    });
  });
});
app.on('window-all-closed', () => { if (!splash) app.quit(); });

// ---------- updates: same release the Android app uses ----------
const status = st => { if (win && !win.isDestroyed()) win.webContents.send('update-status', { current: app.getVersion(), ...st }); };
const verNum = v => (String(v).match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

function get(url, onRes, redirects = 0) {
  const req = https.get(url, { headers: { 'User-Agent': 'IconPatrol-PC', Accept: url.includes('api.github.com') ? 'application/vnd.github+json' : 'application/octet-stream' } }, res => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 6) { res.resume(); return get(res.headers.location, onRes, redirects + 1); }
    onRes(res);
  });
  req.on('error', err => onRes(null, err));
  req.setTimeout(30000, () => req.destroy(new Error('timed out')));
}

// cb(err, {latest, url, newer})
function fetchLatest(cb) {
  let called = false; const once = (e, r) => { if (!called) { called = true; cb(e, r); } };
  get(`https://api.github.com/repos/${REPO}/releases/latest`, (res, err) => {
    if (!res) return once(err || new Error('no connection'));
    let body = ''; res.setEncoding('utf8'); res.on('data', d => body += d);
    res.on('error', e => once(e));
    res.on('end', () => {
      try {
        if (res.statusCode !== 200) throw new Error('GitHub said ' + res.statusCode);
        const j = JSON.parse(body), latest = (String(j.name || '').match(/\d+\.\d+\.\d+/) || [''])[0];
        const asset = (j.assets || []).find(a => a.name === ASSET);
        once(null, { latest: latest || app.getVersion(), url: asset && asset.browser_download_url, newer: !!(latest && asset && newer(latest, app.getVersion())) });
      } catch (e) { once(e); }
    });
  });
}

function check(userAsked) {
  status({ state: 'checking' });
  fetchLatest((err, info) => {
    if (err) return status({ state: userAsked ? 'error' : 'idle', msg: err.message });
    if (info.newer) { pending = info; status({ state: 'available', latest: info.latest }); }
    else status({ state: 'current', latest: info.latest });
  });
}

// downloads pending.url next to the running exe, then swaps it in after this app quits and relaunches it
function install(ui) {
  ui = ui || {
    progress: pct => status({ state: 'downloading', pct }),
    done: () => status({ state: 'done' }),
    fail: msg => status({ state: 'error', msg }),
  };
  if (!pending) return check(true);
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!exe) { shell.openExternal(pending.url); return ui.fail('not running from IconPatrol-PC.exe, opened the download in your browser'); }
  const tmp = exe + '.download';
  ui.progress(0);
  get(pending.url, (res, err) => {
    if (!res || res.statusCode !== 200) { if (res) res.resume(); return ui.fail(err ? err.message : 'download failed (' + (res && res.statusCode) + ')'); }
    const total = +res.headers['content-length'] || 0; let got = 0, lastPct = -2;
    const out = fs.createWriteStream(tmp);
    res.on('data', d => { got += d.length; const pct = total ? Math.floor(got * 100 / total) : -1; if (pct !== lastPct) { lastPct = pct; ui.progress(pct); } });
    res.on('error', e => { out.destroy(); ui.fail(e.message); });
    res.pipe(out);
    out.on('error', e => ui.fail(e.message));
    out.on('finish', () => {
      if (total && got !== total) return ui.fail('download was cut short');
      ui.done();
      const bat = path.join(os.tmpdir(), 'iconpatrol-update.cmd');
      fs.writeFileSync(bat, [
        '@echo off',
        'ping -n 3 127.0.0.1 >nul',
        ':retry',
        `move /y "${exe}" "${exe}.old" >nul 2>&1`,
        `if exist "${exe}" ( ping -n 2 127.0.0.1 >nul & goto retry )`,
        `move /y "${tmp}" "${exe}" >nul`,
        `start "" "${exe}"`,
        `del "${exe}.old" >nul 2>&1`,
        'del "%~f0"',
      ].join('\r\n'));
      let failed = false;
      const ch = spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true });
      ch.on('error', e => { failed = true; try { fs.unlinkSync(tmp); } catch (_) {} ui.fail('could not start the updater: ' + e.message); });
      ch.unref();
      setTimeout(() => { if (!failed) app.quit(); }, 700);
    });
  });
}

ipcMain.on('upd-check', (e, userAsked) => check(!!userAsked));
ipcMain.on('upd-install', () => install());
ipcMain.on('upd-browser', () => shell.openExternal(`https://github.com/${REPO}/releases/latest/download/${ASSET}`));
ipcMain.on('quit', () => app.quit());
ipcMain.on('toggle-fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on('sync-version', e => { e.returnValue = app.getVersion(); });
