import os, re
SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
# Each mode is built from small part files, joined in this order (see src/MAP.md).
# The JS parts are glued back into ONE script per mode (plain text join: no modules, no wrappers),
# so the game's scope and the launcher below work exactly as with the old single-file sources.
MODES = {
  '2d': dict(css=['2d/style-a.css', 'shared/menus.css', '2d/style-b.css'], markup='2d/markup.html', js=[
    '2d/01-setup.js', '2d/02-storage-files.js', '2d/03a-state.js', 'shared/ships.js', '2d/03b-upgrades-hangar.js',
    '2d/04a-input-settings.js', 'shared/settings.js', '2d/04b-menus-touch.js',
    '2d/05a-gamepad-map.js', 'shared/buttons-updates.js', '2d/05b-pause-buttons.js',
    '2d/06-update.js', '2d/07-draw.js', 'shared/feed.js', '2d/09-hud-loop.js']),
  '3d': dict(css=['3d/style-a.css', 'shared/menus.css', '3d/style-b.css'], markup='3d/markup.html', js=[
    '3d/01-setup.js', '3d/02-storage-audio.js', '3d/03-files-drives.js',
    '3d/04a-state.js', 'shared/ships.js', '3d/04b-upgrades.js',
    '3d/05-helpers-navball.js', '3d/06-state-hangar.js', '3d/07-freeflight.js', '3d/08-input.js',
    '3d/09a-overlays-settings.js', 'shared/settings.js', '3d/09b-menus-touch.js',
    '3d/10a-throttle-map.js', 'shared/buttons-updates.js', '3d/10b-pause-buttons.js',
    '3d/11-asteroids.js', '3d/12-hazards.js', '3d/13-hazards-update.js', '3d/14-combat-missiles.js', '3d/14b-enemies.js',
    '3d/15-flight-aim.js', '3d/16-update.js', '3d/17-camera-cockpit.js', 'shared/feed.js',
    '3d/19-hud.js', '3d/20-loop.js']),
}
read = lambda p: open(os.path.join(SRC, p)).read()
def mode_parts(m):
    spec = MODES[m]
    for p in spec['css'] + [spec['markup']] + spec['js']: assert os.path.isfile(os.path.join(SRC, p)), 'missing part ' + p
    style = ''.join(read(p) for p in spec['css'])
    markup = read(spec['markup'])
    js = ''.join(read(p) for p in spec['js'])
    assert '<script' not in markup and '</style' not in style, m
    return style, markup, js
three = read(os.path.join('vendor', 'three.min.js')).replace('</script', '<\\/script')
used = {p for m in MODES.values() for p in m['css'] + [m['markup']] + m['js']}
on_disk = {d + '/' + f for d in ('2d', '3d', 'shared') for f in os.listdir(os.path.join(SRC, d))}
assert on_disk <= used, 'part file not in MODES: ' + str(sorted(on_disk - used))
s2, m2, js2 = mode_parts('2d')
s3, m3, js3 = mode_parts('3d')
SW = lambda cur: ('<div class="modeSw">GAME MODE '
  f'<button class="{"" if cur=="2d" else "alt"}" data-mode="2d">2D classic</button>'
  f'<button class="{"" if cur=="3d" else "alt"}" data-mode="3d">3D space</button></div>')
m2 = m2.replace('<h1>ICON PATROL</h1>', '<h1>ICON PATROL</h1>\n    ' + SW('2d'), 1)
m3 = m3.replace('<h1>ICON PATROL<small>3D</small></h1>', '<h1>ICON PATROL<small>3D</small></h1>\n    ' + SW('3d'), 1)
assert m2.count('modeSw') == 1 and m3.count('modeSw') == 1
SWCSS = """
  .modeSw{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 16px;font-size:12px;color:#7ab;letter-spacing:1px}
  .modeSw button{font-size:13px;padding:7px 14px}
"""
for x in (js2, js3): assert '</script' not in x
out = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Icon Patrol</title>
<style>html,body{{margin:0;height:100%;background:#03040c}}</style>
</head>
<body>
<template id="tpl2d"><style>{s2}{SWCSS}</style>{m2}</template>
<template id="tpl3d"><style>{s3}{SWCSS}</style>{m3}</template>
<script type="text/plain" id="code2d">{js2}</script>
<script type="text/plain" id="code3dlib">{three}</script>
<script type="text/plain" id="code3d">{js3}</script>
<script>
(() => {{
  // One file, two games. Switching tears the current game down and mounts the other in place (no page reload,
  // because Android "content://" files and some app previews can't be reloaded).
  const KEY = 'iconpatrol.mode';
  const get = () => {{ try {{ return localStorage.getItem(KEY); }} catch(e) {{ return null; }} }};
  const set = v => {{ try {{ localStorage.setItem(KEY, v); }} catch(e) {{}} }};
  const add = EventTarget.prototype.addEventListener;
  let gen = 0, listeners = [], intervals = [], app = null, mode = null, threeLoaded = false;
  // track global listeners and timers so a game can be fully stopped
  for (const tgt of [window, document]){{
    tgt.addEventListener = function(type, fn, opts){{ listeners.push([this, type, fn, opts]); return add.call(this, type, fn, opts); }};
  }}
  const oRAF = window.requestAnimationFrame.bind(window), oST = window.setTimeout.bind(window), oSI = window.setInterval.bind(window);
  window.requestAnimationFrame = cb => {{ const g = gen; return oRAF(t => {{ if (g === gen) cb(t); }}); }};
  window.setTimeout = (cb, ms, ...a) => {{ const g = gen; return oST(() => {{ if (g === gen && typeof cb === 'function') cb(...a); }}, ms); }};
  window.setInterval = (cb, ms, ...a) => {{ const id = oSI(cb, ms, ...a); intervals.push(id); return id; }};
  const run = id => {{ const s = document.createElement('script'); s.textContent = document.getElementById(id).textContent; app.appendChild(s); }};
  function unmount(){{
    gen++;
    for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts);
    listeners = []; intervals.forEach(clearInterval); intervals = [];
    try {{ if (document.pointerLockElement) document.exitPointerLock(); }} catch(e) {{}}
    if (app){{
      app.querySelectorAll('canvas').forEach(c => {{ try {{ const gl = c.getContext('webgl2') || c.getContext('webgl'); const x = gl && gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); }} catch(e) {{}} }});
      app.remove();
    }}
    document.body.className = '';
  }}
  function mount(m){{
    unmount();
    mode = m; set(m);
    document.title = m === '3d' ? 'Icon Patrol 3D' : 'Icon Patrol';
    app = document.createElement('div'); app.id = 'app'; document.body.appendChild(app);
    app.appendChild(document.getElementById('tpl' + m).content.cloneNode(true));
    if (m === '3d' && !threeLoaded){{ run('code3dlib'); threeLoaded = true; }}
    run('code' + m);
  }}
  add.call(document, 'click', e => {{
    const b = e.target.closest && e.target.closest('[data-mode]');
    if (!b || b.dataset.mode === mode) return;
    e.stopPropagation(); mount(b.dataset.mode);
  }}, true);
  mount(get() === '3d' ? '3d' : '2d');
}})();
</script>
</body>
</html>
"""
# ---- src/MAP.md: regenerated on every build so it never goes stale ----
def top_names(text):
    names = []
    for line in text.split('\n'):
        m = re.match(r'(?:async\s+)?function\s*\*?\s*([\w$]+)', line)
        if m: names.append(m.group(1) + '()'); continue
        m = re.match(r"(?:if \(\$\('\w+'\)\) )?\$\('(\w+)'\)\.(on\w+)\s*=|window\.([\w$]+)\s*=(?!=)|(?:document\.)?addEventListener\('(\w+)'", line)
        if m: names.append(f'#{m.group(1)}.{m.group(2)}' if m.group(1) else f'window.{m.group(3)}' if m.group(3) else f'on {m.group(4)}'); continue
        m = re.match(r'(?:const|let|var)\s+(.*)', line)
        if not m: continue
        depth, cur, out = 0, '', m.group(1)
        for i, ch in enumerate(out):   # names before "=" at bracket depth 0 (handles "const a = 1, b = 2")
            if ch in '([{': depth += 1
            elif ch in ')]}': depth -= 1
            elif depth == 0 and ch == ';': break
            elif depth == 0 and ch == '=' and out[i+1:i+2] not in ('=', '>'):
                n = re.findall(r'([\w$]+)\s*$', cur); n and names.append(n[0]); cur = ''; continue
            elif depth == 0 and ch == ',': cur = ''; continue
            cur += ch
    return names
def sections(text): return re.findall(r'^// -{4,} (.*?) -{4,}', text, re.M)
rows = ['# Icon Patrol source map', '',
  'Generated by `python3 src/build.py` (do not edit by hand). Open only the part you need.',
  'Each mode = its parts joined in this order into ONE script (no modules, no wrappers): the first JS part opens',
  'the game\'s `(() => {` scope and the last one closes it, so every part shares one scope. `shared/` parts are',
  'textually identical in both modes and sit at the same spot in each; editing one changes BOTH modes.',
  'Not listed: `vendor/three.min.js` (three.js r149, 3D only) and the launcher template inside `build.py`.', '']
for m in ('2d', '3d'):
    spec = MODES[m]
    rows += [f'## {m.upper()} mode', '', '| part | lines | sections / key names |', '|---|---|---|']
    for p in spec['css'] + [spec['markup']] + spec['js']:
        t = read(p); n = t.count('\n')
        if p.endswith('.js'):
            sec = sections(t); nm = top_names(t)
            desc = ('**' + ' · '.join(sec) + '**: ' if sec else '') + ', '.join(f'`{x}`' for x in nm)
        else: desc = 'CSS' if p.endswith('.css') else 'HTML markup (screens, HUD, touch buttons)'
        rows.append(f'| `{p}` | {n} | {desc} |')
    rows.append('')
open(os.path.join(SRC, 'MAP.md'), 'w').write('\n'.join(rows))
# web/desktop copy and the Android app's page are the same file
open(os.path.join(ROOT, 'IconPatrol.html'), 'w').write(out)
assets = os.path.join(ROOT, 'app', 'src', 'main', 'assets'); os.makedirs(assets, exist_ok=True)
open(os.path.join(assets, 'index.html'), 'w').write(out)
print('built', len(out), 'bytes -> IconPatrol.html and app/src/main/assets/index.html')
