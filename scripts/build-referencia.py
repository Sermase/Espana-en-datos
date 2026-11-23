"""Construye public/agua/data/referencia.json: el plano de referencia de Caudal para las capas sin ríos.

Autovías y carreteras principales, manchas urbanas y ciudades de Natural Earth (escala 1:10 millones,
dominio público), recortadas a España con las provincias del IGN de src/provincias.json.

Uso:  python3 scripts/build-referencia.py [carpeta]
(si en la carpeta no están los .geojson de Natural Earth, se descargan del repositorio oficial)
"""
import json, sys, urllib.request, tempfile
from pathlib import Path
from shapely.geometry import shape, mapping, LineString, MultiLineString, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

APP = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / 'natural-earth'
SRC.mkdir(parents=True, exist_ok=True)
URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

def load(name):
    p = SRC / f'{name}.geojson'
    if not p.exists():
        print('Descargando', name)
        urllib.request.urlretrieve(URL + p.name, p)
    return json.load(open(p))

# España: unión de las provincias (con un margen para no cortar autovías en la costa)
prov = json.load(open(APP / 'src/provincias.json'))
espana = unary_union([orient(shape(f['geometry']).buffer(0)) if f['geometry']['type'] == 'Polygon' else shape(f['geometry']).buffer(0) for f in prov['features']])
borde = espana.buffer(0.02)

def r(v, d=3): return round(v, d)
def linea(g):
    return [[r(x), r(y)] for x, y in g.coords]

# Carreteras: 1 autovía, 2 nacional, 3 otra principal
TIPO = {'Major Highway': 1, 'Secondary Highway': 2, 'Road': 3}
carreteras = []
for f in load('ne_10m_roads')['features']:
    t = TIPO.get(f['properties'].get('type'))
    if not t: continue
    g = shape(f['geometry'])
    if not g.intersects(borde): continue
    g = g.intersection(borde).simplify(0.004)
    partes = [g] if isinstance(g, LineString) else list(getattr(g, 'geoms', []))
    for p in partes:
        if isinstance(p, LineString) and p.length > 0.01:
            carreteras.append({'t': t, 'l': linea(p)})

# Manchas urbanas
urbano = []
for f in load('ne_10m_urban_areas')['features']:
    g = shape(f['geometry'])
    if not g.intersects(borde): continue
    g = g.intersection(borde).simplify(0.003)
    for p in ([g] if isinstance(g, Polygon) else list(getattr(g, 'geoms', []))):
        if isinstance(p, Polygon) and p.area > 2e-4:
            urbano.append([[r(x), r(y)] for x, y in orient(p, -1).exterior.coords])

# Ciudades, con el nombre oficial cuando Natural Earth usa el castellano antiguo
OFICIAL = {'La Coruña': 'A Coruña', 'Orense': 'Ourense', 'Castellón de la Plana': 'Castellón', 'Las Palmas de Gran Canaria': 'Las Palmas',
           'Palma de Mallorca': 'Palma', 'Vitoria': 'Vitoria-Gasteiz', 'San Sebastián': 'Donostia-San Sebastián'}
ciudades = []
for f in load('ne_10m_populated_places')['features']:
    p = f['properties']
    if p.get('ADM0_A3') != 'ESP': continue
    n = (p.get('NAME_ES') or p['NAME']).replace('‎', '').strip()
    ciudades.append({'n': OFICIAL.get(n, n), 'x': r(p['LONGITUDE'], 4), 'y': r(p['LATITUDE'], 4), 'pob': int(p['POP_MAX']),
                     'cap': 1 if 'capital' in p['FEATURECLA'] else 0})
ciudades.sort(key=lambda c: -c['pob'])

out = APP / 'public/agua/data/referencia.json'
json.dump({'fuente': 'Natural Earth 1:10m (dominio público) · recorte con provincias del IGN', 'carreteras': carreteras, 'urbano': urbano, 'ciudades': ciudades},
          open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{out.relative_to(APP)}: {len(carreteras)} tramos, {len(urbano)} manchas urbanas, {len(ciudades)} ciudades, {out.stat().st_size // 1024} KB')
