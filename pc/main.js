// Icon Patrol for Windows: a small Electron shell around the same game file the Android app uses.
// Build: see pc/README.md (CI builds IconPatrol-PC.exe into the "latest" GitHub release).
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REPO = 'AgeMaguro/IconPatrol';
const ASSET = 'IconPatrol-PC.exe';
let win = null, pending = null;   // pending = {latest, url} once an update is found

// one copy at a time
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#02060c', title: 'Icon Patrol', show: false,
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  // F11 toggles fullscreen; Esc stays free for the game's pause menu
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.alt && input.key === 'Enter') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // links open in the real browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

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

function check(userAsked) {
  status({ state: 'checking' });
  get(`https://api.github.com/repos/${REPO}/releases/latest`, (res, err) => {
    if (!res) return status({ state: userAsked ? 'error' : 'idle', msg: err ? err.message : 'no connection' });
    let body = ''; res.setEncoding('utf8'); res.on('data', d => body += d);
    res.on('end', () => {
      try {
        if (res.statusCode !== 200) throw new Error('GitHub said ' + res.statusCode);
        const j = JSON.parse(body), latest = (String(j.name || '').match(/\d+\.\d+\.\d+/) || [''])[0];
        const asset = (j.assets || []).find(a => a.name === ASSET);
        if (latest && asset && newer(latest, app.getVersion())) { pending = { latest, url: asset.browser_download_url }; status({ state: 'available', latest }); }
        else status({ state: 'current', latest: latest || app.getVersion() });
      } catch (e) { status({ state: userAsked ? 'error' : 'idle', msg: e.message }); }
    });
  });
}

function install() {
  if (!pending) return check(true);
  // the portable exe tells us where it lives; a dev run (npm start) can't replace itself
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!exe) { shell.openExternal(pending.url); return status({ state: 'error', msg: 'not running from IconPatrol-PC.exe, opened the download in your browser' }); }
  const tmp = exe + '.download';
  status({ state: 'downloading', pct: 0 });
  get(pending.url, (res, err) => {
    if (!res || res.statusCode !== 200) return status({ state: 'error', msg: err ? err.message : 'download failed (' + (res && res.statusCode) + ')' });
    const total = +res.headers['content-length'] || 0; let got = 0, lastPct = -1;
    const out = fs.createWriteStream(tmp);
    res.on('data', d => { got += d.length; const pct = total ? Math.floor(got * 100 / total) : -1; if (pct !== lastPct) { lastPct = pct; status({ state: 'downloading', pct }); } });
    res.pipe(out);
    out.on('error', e => status({ state: 'error', msg: e.message }));
    out.on('finish', () => {
      if (total && got !== total) return status({ state: 'error', msg: 'download was cut short' });
      status({ state: 'done' });
      // after this app closes: swap the new exe in (keeping the old one as .old) and start it again
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
      spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      setTimeout(() => app.quit(), 700);
    });
  });
}

ipcMain.on('upd-check', (e, userAsked) => check(!!userAsked));
ipcMain.on('upd-install', () => install());
ipcMain.on('upd-browser', () => shell.openExternal(`https://github.com/${REPO}/releases/latest/download/${ASSET}`));
ipcMain.on('quit', () => app.quit());
ipcMain.on('toggle-fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on('sync-version', e => { e.returnValue = app.getVersion(); });
