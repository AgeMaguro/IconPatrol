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

## 1.0.31 - 2026-11-06
- New 3D hazards in every sector and free flight (none in the boss arena):
  - **Firewall grids:** red laser sheets that slide back and forth. They're on for 4 s and off for 1.5 s, and flicker just before switching back on. Flying into a live one stops you and costs 16 shield. Pass while it's off.
  - **Corrupted data clouds:** glitchy magenta and green static. Inside, the HUD scrambles, the navball shows noise, and lock-on and missile lock go offline. Good for ambushes.
  - **Recycle Bin:** a black hole (70% of sectors) that pulls in you, rocks, icons and pickups. Inside about 100 m you need boost to escape. Reaching the core costs 35 and spits you back out. Icons that fall in are deleted (−25 if clean), and so are pickups and rocks. It shows as a big purple dot on the navball.
  - **Defrag sweeps:** every 45-75 s you get a 5-second warning, then a huge glowing disc crosses the sector near you. It carries anything it touches (6 damage a second while you're on it) and lines rocks up in rows. Move aside or ride it.
  - **Packet streams:** lanes of fast green data blocks. Crossing one gets you hit for 10. Flying along one pulls you up to 230 speed.
  - **Pop-up mines:** fake "Congratulations!! You've WON a FREE Pentium III" windows. They arm when you come within 55 m and blow up 0.9 s later (up to 32 damage, plus knockback). Shoot them from range for +15.
  - Warnings for each appear at the top center of the HUD.
- New setting, **Thrust control** (title screen ⚙ Settings and the pause menu): Throttle lever (default) or Hold to thrust, the classic way. With Hold, the ship only pushes while W, RT or the touch lever is held, and coasts when you let go; S or LT brakes.
- New missile lock panel just above the navball. "MISSILE LOCKING n%" fills up, then a solid, flashing "◆ MISSILE LOCKED · FIRE (R / RMB)" (X on a controller), or "NO MISSILES" / "RELOADING".

## 1.0.30 - 2026-11-06
- 3D arena is bigger: radius 1600, up from 1000, with more scenery cubes and data rings. Background stars are dimmer and smaller.
- New hazard, asteroids: 50 lumpy amber wireframe rocks drift and spin through every sector and free flight, but not the boss arena. Hitting one bounces you off and chips your shield, harder the faster you hit (no damage in free flight). Redline boost smashes small ones. Shots break them, big rocks split into smaller ones, and small ones sometimes drop a bit. They block enemy fire, so they work as cover. Nearby rocks (within 260 m) show on the navball as brown dots, and the field slowly refills out of sight.
- Fixed: the chase-view FUEL bar grew 3x long after the fuel change. Its width is now capped.

## 1.0.29 - 2026-11-06
- PC app: ⏻ Exit button on the title screen (only shows in the PC app).
- 3D fuel: every ship's tank is 3x bigger (`FUEL_MULT = 3`; the hangar Loadout row shows the new size), and impulse thrusters on an empty tank now give 25% thrust instead of 5%.

## 1.0.27 - 2026-11-06
- New: Windows PC app. `IconPatrol-PC.exe` is a portable file in each release with no install; it's an Electron shell in `pc/`, built by the same workflow as the APK. It opens maximized, F11 or Alt+Enter toggles fullscreen, and "Scan a real folder" works. The title screen's ⬆ Check for updates button downloads the new exe, swaps it in and restarts.
- Game: the update button also appears in the PC app (`body.pcapp`), and the PC bridge pushes update status to the game through `IconApp.onUpdateStatus`.

## 1.0.26 - 2026-11-04
- 3D: running out of fuel no longer strands you. The main engine cuts out and impulse thrusters take over at up to 5% of normal thrust (throttle still scales it; about 5% of top speed). No boost and no boost recharge until you grab a fuel cell. The engine glow turns blue, and the warnings read "FUEL EMPTY · IMPULSE".

## 1.0.25 - 2026-11-03
- 3D lock-on: the red LOCK reticle now snaps onto the gold lead point (where to aim) instead of the enemy's body. Light pink corner brackets and the name/distance label mark the enemy itself.
- Lock and aim assist count the lead point as on target, so the lock no longer drops while you aim ahead of a fast crossing ship.

## 1.0.24 - 2026-11-03
- Ship hangar fits on a phone screen without scrolling (both modes). Launch/Back moved under the ship list; on short screens the preview sits beside the ship name and the stat rows are tighter. Tested at 740x340 to 900x415 landscape and 1280x720 with every ship.

## 1.0.23 - 2026-11-03
- 3D ship resources. Each ship has its own loadout (shown in the hangar):

  | Ship | Hull | Ammo | Fuel | Missiles |
  |---|---|---|---|---|
  | Patrol | 60 | 200 | 100 | 4 |
  | Racer | 40 | 120 | 70 | 3 |
  | Fighter | 50 | 160 | 90 | 5 |
  | Bulwark | 100 | 180 | 150 | 4 |
  | Gunship | 75 | 260 | 120 | 6 |

  - Hull: shields soak damage first, and what gets through hits the hull, which doesn't regenerate. Death is now at 0 hull.
  - Ammo: 1 per bullet (a Fighter volley costs 2; the Bulwark's built-in scatter pellets are free; W-pickup pellets cost ammo). When empty, a free backup gun fires single shots at 1/3 rate.
  - Fuel: thrust burns it in proportion to throttle (1.6/s at 100%). At 0 the engine cuts out and you drift. Boost only recharges by drawing from fuel.
  - Missiles: their own seeker with a much wider cone (~43°) than the guns. The orange diamond shrinks while it locks (0.7s), then shows MSL LOCK. Fire with R / right-click / controller X / touch MSL. Homing, 4 damage (6 on the Inner Demon) plus splash; unlocked shots fly straight.
  - Drops: destroyed viruses (40%), cleansed icons (45%) and practice targets (50%) drop AMMO, FUEL CELL, HULL REPAIR or MISSILES +2, weighted toward what you're lowest on. The Bit Magnet pulls them in.
  - Resources carry over between sectors. Clearing a sector resupplies 25% ammo and fuel plus 1 missile. A new life refills hull and tops ammo/fuel/missiles up to at least 60%.
  - Upgrades follow their intent: Engine burns less fuel, Shield Capacity toughens the hull, Auto-Repair patches 10/20/30 hull at each sector start, Blaster Coils add ammo, Boost Tank adds fuel, and Radar extends missile lock range (600/750/900) and adds +1 missile.
  - Free flight uses resources by default; the pause menu has "∞ Infinite resources" (it refills you when turned on).
  - Controller: X is now missile (fire is A).
- 3D touch auto-fire aims at the lead point with per-ship accuracy: Fighter 78%, Gunship 68%, Patrol 60%, Bulwark 52%, Racer 40% (plus a little scatter). Shown in the hangar as Auto-aim.

## 1.0.22 - 2026-11-03
- 3D first person: the cockpit HUD tilt is reversed, so it now leans into the turn (turn left, the left side dips). The sideways sway is unchanged.

## 1.0.21 - 2026-11-03
- 3D: the aim-lead marker now shows as soon as a target is being tracked (amber brackets), not only once locked, and has its own look: a gold ring with a white center on a dark backing, with a dashed gold line back to the target. Aim the crosshair at it so shots meet a moving target.

## 1.0.20 - 2026-11-03
- 3D: new "🛰 Free flight" mode on the title screen (pick a ship, then fly). No damage and no infection; six practice targets fly around: red copies of the five ship classes, wandering at their class's speed and handling, not shooting back. HP by class (Racer 2, Patrol/Fighter 3, Gunship 5, Bulwark 6); lock-on names the class. Destroyed targets respawn. Leave via pause -> "Leave free flight". Upgrades are the base levels (tests the ship's own stats).
- Android app: "Scan a real folder…" is hidden (use "Pick files from phone…"). Still available in the browser version.

## 1.0.19 - 2026-11-03
- Updater: Android blocked in-app updates with "INSTALL_FAILED_ABORTED: Self update is blocked by unknown source package" (apps installed from a browser download may not replace themselves). When Android refuses, the app now automatically hands the downloaded APK to Android's own installer ("Do you want to update this app?" -> Update), the same as installing from the browser. New `ApkProvider` serves the downloaded APK to the installer, read-only.
- No longer asks Android to skip the confirm screen (it requires the app to be its own installer, which a sideloaded app isn't).
- 1.0.18 and older still have the old updater: install 1.0.19 once from the browser link.

## 1.0.18 - 2026-11-03
- 3D HUD declutter, so the crosshair is easy to find:
  - Crosshair is drawn last, bright with a dark outline and a center dot.
  - Lock-on is merged into the crosshair: inside the firing angle it slides onto the target and turns red (no second reticle). A small dot keeps marking your true nose, plus the lead dot.
  - Lead gates are corner brackets only (no full boxes).
  - Clean mode: gates show only while turning or drifting off the nose, and fade near the crosshair; the gun pipper only shows once it separates from the crosshair.
  - New HUD detail setting: Clean (default) / Full (every guide always, plus the 0.5s label) / Minimal (crosshair, lock-on, navball). Key H, controller R3 (flight mode moved off R3: key G or Settings), touch "HUD" button, or Settings. Saved as `iconpatrol3d.hud`.

## 1.0.17 - 2026-11-03
- 3D: slower standard flight speed. The base top speed (100% throttle) is now 109, which was the Fighter's comfortable 70% cruise (was 135); each ship still scales by its Speed stat: Racer 150, Fighter 125, Patrol 109, Gunship 92, Bulwark 85. Engine upgrades and redline boost (x1.7) still stack on top. 2D unchanged.

## 1.0.16 - 2026-11-03
- Fighter: both wingtip cannons fire together in one volley (no more alternating), at half the fire rate. Multi-Barrel upgrades fire their full pattern from each wing.

## 1.0.15 - 2026-11-03
- The built-in scatter moves from the Fighter to the Bulwark, and the Bulwark's version is weaker: each pellet does 75% damage and flies 75% as far (2D 0.68s vs 0.9s; 3D 1.05s vs 1.4s). The Fighter is back to plain guns.
- A W pickup's scatter stays full strength, on any ship (the Bulwark's pellets are full strength while a W pickup is active).
- Bullets now carry a damage value, so hit points can be fractional (e.g. a 1-HP virus takes two weak pellets).

## 1.0.14 - 2026-11-03
- Fighter: built-in wide shot (always on, no timer), shown as a Bonus line in the hangar.
- Wide shot is now a random scatter instead of a fixed pattern, for the pickup too. 2D: two side pellets at random angles (about 6-24 degrees) plus a 35% chance of a third anywhere in the cone, each at a slightly random speed. 3D: 3-5 pellets at random spots in a cone around the nose (about 3-10 degrees off).

## 1.0.13 - 2026-11-03
- Updater fix: the in-app update was being cancelled before Android's "Update this app?" screen could appear (the confirm screen was opened in a new task). It now opens inside the app's own task.
- Update errors now say why (blocked by Play Protect, signing conflict, storage, etc. plus Android's code), the button becomes "Try again", and there's a "download it in the browser instead" link as a fallback.
- Note: 1.0.11/1.0.12 still have the old updater, so install 1.0.13 once from the browser link; updates after that use the fixed in-app button.

## 1.0.12 - 2026-11-03
- Ship hangar: before each run (scan or demo) a "Choose your ship" screen shows five ships with stat bars, a description and a preview (rotating 3D model in 3D mode). Your pick is remembered (`iconpatrol.ship`) and shown on the drive map.
  - Patrol: the original ship, balanced (100% across the board).
  - Racer: slim needle. Speed 138%, handling 135%, firepower 70%, shield 60%.
  - Fighter: swept wings with wingtip cannons. Speed 115%, handling 112%, firepower 135%, shield 75%.
  - Bulwark: armored hexagon with a shield ring. Shield 165% (and faster recharge), firepower 100%, speed and handling 78%.
  - Gunship: four forward barrels. Firepower 160% and starts with twin shots, shield 110%, speed 84%, handling 82%.
- Speed scales thrust and top speed; handling scales turn rate (2D) and pitch/yaw/roll rates (3D); firepower scales fire rate; shield scales max shield and recharge. Upgrades stack on top.
- Each ship has its own shape when flying in both modes (2D outline, 3D extruded model) and in the 2D lives icons.

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
