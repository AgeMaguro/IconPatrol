# Icon Patrol

Personal project, shared publicly so the app can update itself.

A remake of Operation: Inner Space (Windows 3.1/95). Your real files become the levels: every folder is a sector,
every file is an icon. Viruses infect icons; you fly in, rescue clean icons and shoot infected ones clean.
Two modes in one game, switched on the title screen: **2D classic** and **3D space** (6-degree flight, navball radar,
first-person cockpit, throttle, flight assist modes).

## Play it
- **Android app (main way):** https://github.com/AgeMaguro/IconPatrol/releases/latest/download/IconPatrol.apk
  Download on the phone and open it to install (allow "install unknown apps" for the browser). After that, use the
  title screen's **⬆ Check for updates** button: it downloads and installs new versions in-app.
- **PC / browser:** `IconPatrol.html` (double-click; Chrome or Edge). It's the same game file the app uses.

Files you scan or pick never leave the device. The app has no internet permission.

## Editing (for Claude)
- Source is in `src/`. Never hand-edit `IconPatrol.html` or `app/src/main/assets/index.html`; edit the part files,
  then run `python3 src/build.py` (the only build command).
- **Start with `src/MAP.md`**: every part file, its line count and the functions/constants in it. Open only the
  part you're changing (grep, then read just that range). The build regenerates MAP.md each time.
  - `src/2d/` = 2D mode, `src/3d/` = 3D mode: `style-*.css`, `markup.html`, numbered `*.js` parts.
  - `src/shared/` = code that is textually identical in both modes (ship table and outlines, settings menu
    rendering, folder-scan/app-update/menu-button glue, collected-icons feed, menu CSS). Editing a shared file
    changes BOTH modes. If a change should only affect one mode, move that block back into the mode's own part
    at the same spot (and update `MODES` in build.py).
  - `MODES` in `build.py` lists each mode's parts in order. The JS parts are joined as plain text into ONE script
    per mode (no ES modules, no wrapper functions): the first part opens the game's `(() => {` scope and the last
    closes it, so all parts share one scope and order matters for `const`/`let`. New part files must be added to
    `MODES` (the build fails if a file in `2d/`, `3d/` or `shared/` isn't listed).
- Enemy ships (3D only) are in `src/3d/14b-enemies.js`: `EN_DEF` (types), `EN_GUN` (guns), `enemyScale()` / `enemyLevel()`
  (difficulty hook), `enemyDirector()` (spawning), `EN_UPDATE.<kind>` (one behaviour function per type). They are entries
  in `viruses` with `ai:true`; `v.hidden` keeps cloaked/disguised ones out of lock-on, aim assist, HUD and radar.
- The build combines both modes plus `src/vendor/three.min.js` (three.js r149, MIT) into one file and writes it to
  both places.
- One-file launcher (in `src/build.py`): only the chosen mode is mounted; switching mode tears the old one down
  in place (no page reload, because Android `content://` files and app previews can't reload).
- Android wrapper: `app/src/main/java/com/agemaguro/iconpatrol/MainActivity.java` (plain WebView, no AndroidX).
  Landscape, full screen, keeps the screen on, back button calls `window.onBack()`, app switch fires `blur` (pauses).
  File pickers: the game's folder input has `accept="inode/directory"`, which makes the app open Android's folder
  picker, walk it (limits: depth 5, 24 files per folder, 40 folders, 900 files) and pass folder paths in
  `window.__appPaths` (same order as the files). The other input opens the normal multi-file picker.
  The game detects the app by `IconPatrolApp` in the user agent (`body.inapp`, hides web-only buttons).
- Build: GitHub Actions `.github/workflows/apk.yml`. Any push to main (except `*.md` and `past-versions/`)
  rebuilds and replaces the `latest` release (title "Icon Patrol 1.0.N", N = run number + 10 = versionCode);
  the replaced APK is saved to `past-versions/`. A failed build publishes a pre-release `build-failed` with the
  build output attached.
- Updater: `app/.../Updater.java` reads `api.github.com/repos/AgeMaguro/IconPatrol/releases/latest`, compares N
  with the installed versionCode, downloads the APK and installs it with PackageInstaller (asks for "Install
  unknown apps" once; on Android 12+ later updates may skip the confirm screen). The page talks to it through
  `window.IconApp` (`checkForUpdate`, `installUpdate`, `version`) and gets `window.__updateStatus(...)` back.
  Internet is only used by the updater; the WebView blocks every http(s) request from the page.
- Signing: `iconpatrol.keystore` (password "android") is Icon Patrol's own key, committed on purpose so each build
  installs as an update. It's public on purpose: this is a personal hobby app, not for the Play Store. (Builds
  1.0.1-1.0.3 used a different key, so going from those to 1.0.11 needs one uninstall.)
- Saved data (localStorage): `iconpatrol.mode`, `iconpatrol.hi`, `iconpatrol3d.hi`, `iconpatrol3d.view`,
  `iconpatrol3d.flight2` (default drift), `iconpatrol3d.enemies` (gentle/all/off), `iconpatrol3d.inv`, `iconpatrol.autofire`, `iconpatrol.muted`.
- Testing: Playwright works for both modes in this repo's cloud sessions (`--use-gl=swiftshader` for 3D). In 3D,
  setting `window.__IPDEBUG = true` before load exposes `window.__ip` (player, icons, viruses...) for tests.
