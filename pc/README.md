# Icon Patrol for Windows

A small Electron shell around the same `IconPatrol.html` the Android app uses. It ships as one portable file, `IconPatrol-PC.exe`, with no installer.

- **Download:** https://github.com/AgeMaguro/IconPatrol/releases/latest/download/IconPatrol-PC.exe
- **Built by CI:** `.github/workflows/apk.yml` builds it on every push to `main`, next to the APK, with the same version number.
- **Updates:** the title screen's ⬆ Check for updates button reads the same GitHub release, downloads the new exe next to the old one, swaps the two after the app closes, and restarts the app.
- **Saves** (settings, chosen ship, progress) live in `%APPDATA%\Icon Patrol` and survive updates.
- **Keys:** F11 or Alt+Enter toggles fullscreen. Esc still opens the game's pause menu.
- **Windows SmartScreen:** the exe isn't code-signed, so the first run may show "Windows protected your PC". Click More info, then Run anyway.

## Build it yourself
```
cd pc
mkdir game && copy ..\IconPatrol.html game\index.html
npm install
npm start          # run it
npm run dist       # makes dist\IconPatrol-PC.exe
```
