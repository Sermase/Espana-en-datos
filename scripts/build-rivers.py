"""Construye public/data/rios.json: los ríos con nombre de la red del IGN (SIANE 1:3M),
con su longitud en España, cuenca, embalses, aforos y un perfil de altitud aproximado.

El perfil se saca cruzando el cauce con las curvas hipsométricas del IGN
(0, 200, 400, 700, 1000, 1500, 2000… m), así que es orientativo, no topográfico.

Uso:  python3 scripts/build-rivers.py fuentes/siane
(los .json, guardados comprimidos en .json.gz, salen de los shapefiles con: mapshaper fichero.shp -o format=geojson)
"""
import gzip, json, math, sys, unicodedata, re
from collections import defaultdict, Counter
from pathlib import Path
from shapely.geometry import shape, Point, LineString, MultiLineString
from shapely.ops import linemerge, unary_union, nearest_points
from shapely.strtree import STRtree

SRC = Path(sys.argv[1])
def load(name):
    p = SRC / name
    return json.load(open(p)) if p.exists() else json.load(gzip.open(SRC / (name + '.gz'), 'rt'))
APP = Path(__file__).resolve().parent.parent
snap = json.load(open(APP / 'src/agua/data/snapshot.json'))
land = unary_union([shape(f['geometry']) for f in json.load(open(APP / 'src/agua/data/land.json'))['features']]).buffer(0.01)
basins = [(f['properties']['id'], shape(f['geometry'])) for f in json.load(open(APP / 'src/agua/data/basins.json'))['features']]

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)

ALIAS = {"l'Ebre": 'Ebro', "Río Ebro/l'Ebre": 'Ebro', 'Río Júcar/Riu Xúquer': 'Júcar', 'Rio Douro': 'Duero', 'Rio Tejo': 'Tajo',
         'la Noguera Pallaresa': 'Noguera Pallaresa', 'la Noguera Ribagorçana': 'Noguera Ribagorzana', 'el Llobregat': 'Llobregat',
         'el Ter': 'Ter', 'el Fluvià': 'Fluvià', 'Rio Vinalopó': 'Vinalopó', "Riu d'Alcoi": 'Serpis', 'Riu Magre': 'Magro',
         'Rivera de Chanza': 'Chanza', 'Canal del Transvase Tajo-Segura': 'Trasvase Tajo-Segura'}
def canon(raw):
    if raw in ALIAS: return ALIAS[raw]
    return re.sub(r"^(Río|Rio|Riu|Rivera de|Ribeira de|el|la|l')\s*", '', raw.split('/')[0]).strip()

def km(line):
    c = list(line.coords)
    return sum(math.hypot((b[0] - a[0]) * math.cos(math.radians(a[1])) * 111.32, (b[1] - a[1]) * 110.57) for a, b in zip(c, c[1:]))

# --- tramos dentro de España ---
segs = []
for f in load('rios_full.json')['features']:
    g = shape(f['geometry']).intersection(land)
    if g.is_empty: continue
    parts = [g] if g.geom_type == 'LineString' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'LineString']
    for p in parts:
        if p.length > 0: segs.append({'g': p, 't': f['properties']['t_rio'], 'n': canon(f['properties']['rotulo']) if f['properties']['rotulo'] else None})

# --- nombres para tramos principales sin rótulo: votan embalses y aforos cercanos y los tramos vecinos ---
res_pts = [(Point(r['x'], r['y']), r['riv']) for r in snap['reservoirs'] if r.get('riv')]
flo_pts = [(Point(f['x'], f['y']), f['r']) for f in snap['flows'] if f.get('r')]
display = {}
for s in segs:
    if s['n']: display.setdefault(norm(s['n']), s['n'])
key = lambda p: (round(p[0], 5), round(p[1], 5))
for _ in range(3):
    ends = defaultdict(list)
    for i, s in enumerate(segs):
        c = list(s['g'].coords); ends[key(c[0])].append(i); ends[key(c[-1])].append(i)
    # componentes de tramos sin nombre del mismo tipo, unidos por sus extremos
    seen, comps = set(), []
    for i, s in enumerate(segs):
        if s['n'] or s['t'] not in (1, 2) or i in seen: continue
        stack, comp = [i], []
        while stack:
            j = stack.pop()
            if j in seen: continue
            seen.add(j); comp.append(j)
            for e in (key(segs[j]['g'].coords[0]), key(segs[j]['g'].coords[-1])):
                stack += [k for k in ends[e] if not segs[k]['n'] and segs[k]['t'] == s['t'] and k not in seen]
        comps.append(comp)
    changed = False
    for comp in comps:
        geom = unary_union([segs[j]['g'] for j in comp])
        votes = Counter()
        for p, n in res_pts:
            if geom.distance(p) < 0.03: votes[n] += 1
        for p, n in flo_pts:
            if geom.distance(p) < 0.02: votes[n] += 2
        t = segs[comp[0]]['t']
        nb = {segs[k]['n'] for j in comp for e in (key(segs[j]['g'].coords[0]), key(segs[j]['g'].coords[-1])) for k in ends[e] if segs[k]['n'] and segs[k]['t'] == t}
        if len(nb) == 1: votes[nb.pop()] += 3
        if votes:
            n, v = votes.most_common(1)[0]
            if v >= 2:
                n = display.get(norm(n), n)
                display.setdefault(norm(n), n)
                for j in comp: segs[j]['n'] = n
                changed = True
    if not changed: break

# --- curvas y bandas de altitud ---
cont = [(shape(f['geometry']), f['properties']['valor']) for f in load('hipso_l.json')['features'] if f['properties']['valor'] >= 0]
cont_tree = STRtree([g for g, _ in cont])
bands = [(shape(f['geometry']), f['properties']['val_inf'], f['properties']['val_sup']) for f in load('hipso_a.json')['features']]
bands = [(g if g.is_valid else g.buffer(0), a, b) for g, a, b in bands]
band_tree = STRtree([g for g, _, _ in bands])
def band(p):
    for i in band_tree.query(p):
        g, a, b = bands[i]
        if g.contains(p): return max(a, 0), max(b, 0)
    return None

def main_stem(lines):
    """El tramo más largo de la red del río: diámetro del grafo de sus líneas."""
    merged = linemerge(lines)
    parts = [merged] if merged.geom_type == 'LineString' else list(merged.geoms)
    adj = defaultdict(list)
    for i, p in enumerate(parts):
        a, b = key(p.coords[0]), key(p.coords[-1])
        adj[a].append((b, i)); adj[b].append((a, i))
    def far(start):
        dist, prev, stack = {start: 0}, {start: None}, [start]
        while stack:
            u = stack.pop()
            for v, i in adj[u]:
                if v not in dist:
                    dist[v] = dist[u] + km(parts[i]); prev[v] = (u, i); stack.append(v)
        end = max(dist, key=dist.get)
        return end, dist[end], prev
    if not adj: return None
    best = None
    for comp_start in list(adj):
        a, _, _ = far(comp_start)
        b, d, prev = far(a)
        if best is None or d > best[0]: best = (d, b, prev)
        if len(adj) > 400: break
    d, node, prev = best
    coords = []
    while prev[node]:
        u, i = prev[node]
        c = list(parts[i].coords)
        if key(c[0]) != node: c = c[::-1]
        coords += c if not coords else c[1:]
        node = u
    return LineString(coords) if len(coords) > 1 else max(parts, key=km)

def profile(line, n=140):
    L = km(line)
    if L < 1: return None
    # cruces con curvas de nivel, en km desde el inicio de la línea
    deg2km = L / line.length
    anchors = []
    for i in cont_tree.query(line):
        g, v = cont[i]
        x = line.intersection(g)
        pts = [x] if x.geom_type == 'Point' else [q for q in getattr(x, 'geoms', []) if q.geom_type == 'Point']
        anchors += [(line.project(q) * deg2km, v) for q in pts]
    anchors.sort()
    samples = []
    for k in range(n + 1):
        d = L * k / n
        p = line.interpolate(d / deg2km)
        samples.append([d, band(p), p])
    zs = []
    for d, bd, _ in samples:
        lo, hi = bd if bd else (0, 3000)
        before = [a for a in anchors if a[0] <= d]; after = [a for a in anchors if a[0] > d]
        if before and after:
            (d0, z0), (d1, z1) = before[-1], after[0]
            z = z0 + (z1 - z0) * ((d - d0) / (d1 - d0) if d1 > d0 else 0)
        elif before or after:
            z = (before[-1] if before else after[0])[1]
            z = (z + (lo + hi) / 2) / 2 if bd else z
        else:
            z = (lo + hi) / 2
        zs.append(min(max(z, lo), hi if hi > lo else z))
    flip = zs[0] < zs[-1]
    if flip: zs = zs[::-1]
    # el agua no sube: se allana cualquier repecho del perfil
    for i in range(1, len(zs)): zs[i] = min(zs[i], zs[i - 1])
    return [[round(L * k / n, 1), round(z)] for k, z in enumerate(zs)], flip

# --- ríos ---
groups = defaultdict(list)
for s in segs:
    if s['n']: groups[norm(s['n'])].append(s)
rivers = []
for k, ss in groups.items():
    name = display[k]
    lines = [s['g'] for s in ss]
    total = sum(km(l) for l in lines)
    if total < 15: continue
    stem = main_stem(lines)
    if stem is None: continue
    pr = profile(stem)
    if not pr: continue
    prof, flip = pr
    if flip: stem = LineString(list(stem.coords)[::-1])
    geom = unary_union(lines)
    L = km(stem); deg2km = L / stem.length
    # embalses del río: por el cauce del inventario de presas o, si no lo tiene, por cercanía
    res = []
    for r in snap['reservoirs']:
        p = Point(r['x'], r['y'])
        same = r.get('riv') and norm(r['riv']) == k
        if same or (not r.get('riv') and geom.distance(p) < 0.015):
            if stem.distance(p) < 0.06: res.append([r['id'], round(stem.project(p) * deg2km, 1)])
            elif same: res.append([r['id'], None])
    # Por nombre de estación, no por posición: el orden de los aforos cambia en cada boletín.
    fl = [f['n'] for i, f in enumerate(snap['flows']) if (f.get('r') and norm(f['r']) == k) or (not f.get('r') and geom.distance(Point(f['x'], f['y'])) < 0.01)]
    cnt = Counter()
    for q in [stem.interpolate(t / 20, normalized=True) for t in range(21)]:
        for bid, bg in basins:
            if bg.contains(q): cnt[bid] += 1; break
    # ¿desemboca en otro río con nombre?
    end = Point(stem.coords[-1])
    into = None
    for k2, ss2 in groups.items():
        if k2 == k: continue
        if any(s2['g'].distance(end) < 0.004 for s2 in ss2): into = display[k2]; break
    simp = stem.simplify(0.004)
    gl = [l.simplify(0.003) for l in lines]
    rivers.append({
        'n': name, 't': min(s['t'] for s in ss), 'km': round(L), 'kmt': round(total), 'b': cnt.most_common(1)[0][0] if cnt else None,
        'into': into, 'res': sorted(res, key=lambda x: (x[1] is None, x[1] or 0)), 'fl': fl, 'prof': prof,
        'line': [[round(x, 4), round(y, 4)] for x, y in simp.coords],
        'g': [[[round(x, 4), round(y, 4)] for x, y in l.coords] for l in gl if len(l.coords) > 1],
    })
# Longitud total y desembocadura según el anexo de ríos de España (CEDEX), cuando está.
OFF = {}
lp = APP / 'fuentes/longitudes.txt'
if lp.exists():
    for line in lp.read_text().splitlines():
        n, l, m = line.split('|'); OFF[norm(n)] = (float(l), m)
for r in rivers:
    o = OFF.get(norm(r['n']))
    if o: r['L'], r['m'] = round(o[0]), o[1]
rivers.sort(key=lambda r: -(r.get('L') or r['km']))
for i, r in enumerate(rivers): r['id'] = i
out = APP / 'public/agua/data/rios.json'
json.dump({'rivers': rivers}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rivers), 'ríos ·', out.stat().st_size // 1024, 'KB')
for r in rivers[:25]: print(f"{r['n']:<22} {r.get('L')} {r['km']:>4} km  t{r['t']}  {r['prof'][0][1]:>5}→{r['prof'][-1][1]:<4} m  emb {len(r['res']):>2}  aforos {len(r['fl'])}  → {r['into']}")
