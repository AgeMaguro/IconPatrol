# Icon Patrol changelog

Version = `1.0.<build number + 10>`. The newest APK is always the `latest` GitHub release of this repo:
https://github.com/AgeMaguro/IconPatrol/releases/latest/download/IconPatrol.apk (or use the in-game update button)
When a new build replaces it, the old APK is saved automatically to `past-versions/IconPatrol-<version>.apk`.

## Things to keep stable
- localStorage keys (see README) so settings and high scores survive updates.
- Release title "Icon Patrol 1.0.N" and the APK asset name `IconPatrol.apk`: the in-app updater reads them.
- Signing key `iconpatrol.keystore` (changing it means uninstalling first, which wipes saved data).
- `window.onBack()`, `window.__appPaths`, the `inode/directory` accept marker and `IconPatrolApp` user agent:
  the Android wrapper depends on them.

## 1.0.11 - 2026-11-03 (moved to its own public repo)
- In-app updates: title screen "⬆ Check for updates" (app only). Checks quietly on start; when a newer version is out the button turns gold ("Install update 1.0.N"); tap to download and install. First time, Android asks you to allow "Install unknown apps" for Icon Patrol (once). On Android 12+ later updates may install without the confirm screen.
- The app now has internet permission, used only by the updater; the game page can't load anything from the web.
- Moved from Claude-HQ (private) to AgeMaguro/IconPatrol (public) so the app can download updates without a login. Version numbers continue at 1.0.11. New signing key (its own, not shared with any other app): uninstall 1.0.1-1.0.3 once before installing 1.0.11; updates after that install normally.

## 1.0.3 - 2026-11-03
- 3D: the Inner Demon's health bar moves below the touch buttons' top bar on phones (it was hidden behind VIEW/FLT/AUTO-FIRE/MAP/pause), shows a percentage, and the "awakens" banner sits below it instead of on top.

## 1.0.2 - 2026-11-03
- 3D: Pure drift is now the default flight mode (Assist and Coordinated stay in Settings as experimental, to refine later). Saved under a new key `iconpatrol3d.flight2` so everyone starts on drift once.
- 3D: the Inner Demon's lead dot (and aim assist) now account for how it actually moves (it used to be treated as standing still, so the dot sat too close). Test: aiming at the dot hit a moving boss 35 times vs 14 aiming straight at it.
- Bigger pickup radius: 3D icons 15 -> 26, power-ups/bits 9 -> 17; 2D icons 30 -> 42, power-ups/bits 22 -> 34.
- Bit Magnet now pulls a little from the start, with bigger upgrades: 3D 60 / 130 / 200 / 280 (was 0 / 70 / 120 / 180), 2D 70 / 150 / 230 / 310 (was 0 / 90 / 150 / 220). Shop text shows the ranges.

## 1.0.1 - 2026-11-03 (first app build)
- Android app: the game in a full-screen landscape app (offline, no ads, no internet permission). Keeps the
  screen on. Back button: opens/closes the pause menu in a sector, goes back from Settings, map -> title,
  closes the app from the title screen. Switching apps pauses the game.
- File picking in the app: "Pick files from phone…" (several files, sorted into sectors by type) and
  "Scan a real folder…" (Android folder picker; each subfolder becomes a sector, like on PC).
- New Settings screen (title screen button and the pause menu): 3D view, flight mode, invert pitch,
  auto-fire, sound (now remembered), show FPS. The view/flight/invert buttons moved off the title screen.
- New pause menu (P, Esc, controller Start, the ❚❚ touch button, or Android back): Resume, Settings,
  Leave sector (drive map), Quit to title. Replaces the old "tap to resume" screen. In 3D, pressing Esc
  to release the mouse also pauses; Resume re-locks the mouse.
- Everything from the web version up to this point: 2D and 3D modes in one file, controller and touch
  controls, throttle with redline boost, flight modes (Assist / Coordinated / Pure drift), cockpit view,
  navball, lead gates, gun pipper, lock-on reticle, rescued-file preview cards, bigger 3D arena.
