import os, re
SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
def parts(html):
    style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    scripts = re.findall(r'<script>(.*?)</script>', body, re.S)
    markup = re.sub(r'<script>.*?</script>', '', body, flags=re.S)
    return style, markup, scripts
d2 = open(os.path.join(SRC,'game2d.html')).read()
d3 = open(os.path.join(SRC,'game3d.html')).read()
three = open(os.path.join(SRC,'vendor','three.min.js')).read().replace('</script', '<\\/script')
s2, m2, sc2 = parts(d2)
s3, m3, sc3 = parts(d3)
assert len(sc2) == 1 and len(sc3) == 2 and sc3[0].strip() == '/*THREE*/'
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
for x in (sc2[0], sc3[1]): assert '</script' not in x
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
<script type="text/plain" id="code2d">{sc2[0]}</script>
<script type="text/plain" id="code3dlib">{three}</script>
<script type="text/plain" id="code3d">{sc3[1]}</script>
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
# web/desktop copy and the Android app's page are the same file
open(os.path.join(ROOT, 'IconPatrol.html'), 'w').write(out)
assets = os.path.join(ROOT, 'app', 'src', 'main', 'assets'); os.makedirs(assets, exist_ok=True)
open(os.path.join(assets, 'index.html'), 'w').write(out)
print('built', len(out), 'bytes -> IconPatrol.html and app/src/main/assets/index.html')
