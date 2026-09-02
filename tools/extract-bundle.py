"""元のビルド(reference/v47-build.html)から、画像・CSS・アプリコードを取り出す。
復元の出発点。ここから rename → dejsx → split と流す。
"""
import re, os, base64, json, sys

SRC = "reference/v47-build.html"
OUT = "."
s = open(SRC, encoding="utf-8", errors="replace").read()

def w(path, data, binary=False):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb" if binary else "w", **({} if binary else {"encoding": "utf-8"})) as f:
        f.write(data)
    return p

# ---------- 1. images ----------
DATA_RE = r'data:image/webp;base64,([A-Za-z0-9+/=]+)'
uri2name = {}   # full data uri -> asset path

def save(b64, path):
    w(path, base64.b64decode(b64), binary=True)

def grab_map(varname, outdir, kind):
    m = re.search(r'\b%s=\{' % re.escape(varname), s)
    if not m:
        sys.exit("map not found: " + varname)
    i = m.end(); depth = 1
    while depth:
        if s[i] == '{': depth += 1
        elif s[i] == '}': depth -= 1
        i += 1
    body = s[m.end():i-1]
    entries = re.findall(r'"?([A-Z0-9]{1,3})"?:"(%s)"' % DATA_RE, body)
    out = {}
    for key, uri, b64 in entries:
        path = "%s/%s.webp" % (outdir, key)
        save(b64, path)
        uri2name[uri] = path
        out[key] = path
    print("%-8s %2d images -> %s" % (kind, len(out), outdir))
    return out

normal  = grab_map("q1", "assets/cards/normal",  "normal")
captain = grab_map("Z1", "assets/cards/captain", "captain")

singles = {"j1": "assets/ui/card-back.webp",
           "Q1": "assets/ui/title-bg.webp",
           "O1": "assets/ui/die.webp",
           "B1": "assets/ui/win-king-card.webp"}
for var, path in singles.items():
    m = re.search(r'\b%s="(%s)"' % (re.escape(var), DATA_RE), s)
    if not m: sys.exit("single not found: " + var)
    save(m.group(2), path)
    uri2name[m.group(1)] = path
    print("%-8s -> %s" % (var, path))

all_uris = set(re.findall(r'(%s)' % DATA_RE, s))
print("total data URIs in file: %d, mapped: %d" % (len({u for u, _ in [(a, b) for a, b in re.findall(r'(%s)' % DATA_RE, s)]}), len(uri2name)))

# ---------- 2. CSS ----------
m = re.search(r'var v9=`', s)
i = m.end(); j = s.index('`', i)
css_raw = s[i:j]
assert '${' not in css_raw, "CSS has interpolation"
css = css_raw.encode().decode('unicode_escape')
w("src/styles.css", css)
print("css -> src/styles.css (%d bytes)" % len(css))

# ---------- 3. app JS ----------
start = s.index('var c=rt(Zl(),1),s0="v47')
end = s.index('</script>')
# trim the trailing license comment block
tail = s[start:end]
lic = tail.find('/*!')
if lic == -1: lic = tail.find('/*\n')
app = tail[:lic] if lic > 0 else tail

# replace data URIs with readable placeholders
def sub_uri(mo):
    uri = mo.group(1)
    return '__ASSET__' + uri2name.get(uri, 'UNKNOWN')
app_sym = re.sub(r'(%s)' % DATA_RE, sub_uri, app)
w("reference/app.min.js", app_sym)
print("app  -> reference/app.min.js (%d bytes)" % len(app_sym))

# vendor + icons for reference
icons_start = s.index('function ge({size:e=24')
w("reference/icons.min.js", s[icons_start:start])
print("icons-> reference/icons.min.js (%d bytes)" % (start - icons_start))

json.dump({"normal": normal, "captain": captain, "ui": singles},
          open(os.path.join(OUT, "assets/asset-map.json"), "w"), ensure_ascii=False, indent=2)
print("done")
import re, os, base64, json, sys

SRC = "reference/v47-build.html"
OUT = "."
s = open(SRC, encoding="utf-8", errors="replace").read()

def w(path, data, binary=False):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb" if binary else "w", **({} if binary else {"encoding": "utf-8"})) as f:
        f.write(data)
    return p

# ---------- 1. images ----------
DATA_RE = r'data:image/webp;base64,([A-Za-z0-9+/=]+)'
uri2name = {}   # full data uri -> asset path

def save(b64, path):
    w(path, base64.b64decode(b64), binary=True)

def grab_map(varname, outdir, kind):
    m = re.search(r'\b%s=\{' % re.escape(varname), s)
    if not m:
        sys.exit("map not found: " + varname)
    i = m.end(); depth = 1
    while depth:
        if s[i] == '{': depth += 1
        elif s[i] == '}': depth -= 1
        i += 1
    body = s[m.end():i-1]
    entries = re.findall(r'"?([A-Z0-9]{1,3})"?:"(%s)"' % DATA_RE, body)
    out = {}
    for key, uri, b64 in entries:
        path = "%s/%s.webp" % (outdir, key)
        save(b64, path)
        uri2name[uri] = path
        out[key] = path
    print("%-8s %2d images -> %s" % (kind, len(out), outdir))
    return out

normal  = grab_map("q1", "assets/cards/normal",  "normal")
captain = grab_map("Z1", "assets/cards/captain", "captain")

singles = {"j1": "assets/ui/card-back.webp",
           "Q1": "assets/ui/title-bg.webp",
           "O1": "assets/ui/die.webp",
           "B1": "assets/ui/win-king-card.webp"}
for var, path in singles.items():
    m = re.search(r'\b%s="(%s)"' % (re.escape(var), DATA_RE), s)
    if not m: sys.exit("single not found: " + var)
    save(m.group(2), path)
    uri2name[m.group(1)] = path
    print("%-8s -> %s" % (var, path))

all_uris = set(re.findall(r'(%s)' % DATA_RE, s))
print("total data URIs in file: %d, mapped: %d" % (len({u for u, _ in [(a, b) for a, b in re.findall(r'(%s)' % DATA_RE, s)]}), len(uri2name)))

# ---------- 2. CSS ----------
m = re.search(r'var v9=`', s)
i = m.end(); j = s.index('`', i)
css_raw = s[i:j]
assert '${' not in css_raw, "CSS has interpolation"
css = css_raw.encode().decode('unicode_escape')
w("src/styles.css", css)
print("css -> src/styles.css (%d bytes)" % len(css))

# ---------- 3. app JS ----------
start = s.index('var c=rt(Zl(),1),s0="v47')
end = s.index('</script>')
# trim the trailing license comment block
tail = s[start:end]
lic = tail.find('/*!')
if lic == -1: lic = tail.find('/*\n')
app = tail[:lic] if lic > 0 else tail

# replace data URIs with readable placeholders
def sub_uri(mo):
    uri = mo.group(1)
    return '__ASSET__' + uri2name.get(uri, 'UNKNOWN')
app_sym = re.sub(r'(%s)' % DATA_RE, sub_uri, app)
w("reference/app.min.js", app_sym)
print("app  -> reference/app.min.js (%d bytes)" % len(app_sym))

# vendor + icons for reference
icons_start = s.index('function ge({size:e=24')
w("reference/icons.min.js", s[icons_start:start])
print("icons-> reference/icons.min.js (%d bytes)" % (start - icons_start))

json.dump({"normal": normal, "captain": captain, "ui": singles},
          open(os.path.join(OUT, "assets/asset-map.json"), "w"), ensure_ascii=False, indent=2)
print("done")
