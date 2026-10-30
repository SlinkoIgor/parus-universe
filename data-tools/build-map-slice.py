#!/usr/bin/env python3
"""Build point LOD samples *after* selecting a flared Galactic slice.

Existing immutable leaf tiles are shared with the full atlas. Only internal
representatives are new; every admitted row survives in a reachable leaf.
No positions, measurements, uncertainties or original catalog rows are changed.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
pointer = json.loads((DIST / 'catalog-data/current.json').read_text())
source = DIST / pointer['dataRoot']
original = json.loads((source / 'manifest.json').read_text())
profile = {'type': 'linear-galactic-xy', 'centerThicknessLy': 1e8,
           'edgeThicknessLy': 1e10, 'radiusLy': 46.5e9}
matrix = [[-.0548755604162154, -.873437090234885, -.4838350155487132],
          [.4941094278755837, -.4448296299600112, .7469822444972189],
          [-.8676661490190047, -.1980763734312015, .4559837761750669]]
revision = hashlib.sha256(Path(__file__).read_bytes() + original['revision'].encode()).hexdigest()[:12]
data_root = 'map-slices/' + revision
out = DIST / data_root
out.mkdir(parents=True, exist_ok=True)


def write(path, value):
    content = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    if path.exists():
        if path.read_text() == content:
            return
        if path.parent == out:
            raise RuntimeError('Immutable slice differs: ' + str(path))
    path.write_text(content)


def contains(row):
    extra = row[11]
    if extra.get('atlasOnly') or row[6] == 'unknown':
        return False
    p = extra.get('p3')
    if not p:
        d, ra, dec = row[3:6]
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (d, ra, dec)) or d <= 0:
            return False
        a, b = math.radians(ra), math.radians(dec)
        v = [d * math.cos(b) * math.cos(a), d * math.cos(b) * math.sin(a), d * math.sin(b)]
        p = [sum(x * y for x, y in zip(r, v)) for r in matrix]
    if len(p) != 3 or not all(math.isfinite(v) for v in p):
        return False
    t = min(1, math.hypot(p[0], p[1]) / profile['radiusLy'])
    half = (profile['centerThicknessLy'] + (profile['edgeThicknessLy'] - profile['centerThicknessLy']) * t) / 2
    return abs(p[2]) <= half


def rank(row):
    category = row[11].get('catalogClass', row[2])
    weights = {'void': 100, 'structure': 20, 'wall': 20, 'ring': 20, 'arc': 20,
               'galaxy-cluster': 5, 'galaxy': 1, 'cluster': .03,
               'stellar-cluster': .03, 'pulsar': .02, 'star': .001}
    weight = 2 if row[11].get('cosmicSubtype') == 'filament' else weights.get(category, 1)
    value = (int.from_bytes(hashlib.sha256(row[0].encode()).digest()[:8], 'big') + .5) / 2**64
    return -math.log(value) / weight, row[0]


def envelope(rows):
    box = [min(r[12] for r in rows), min(r[13] for r in rows), max(r[12] for r in rows), max(r[13] for r in rows)]
    geometry = {}
    for row in rows:
        area = row[11].get('regionData')
        if not area:
            continue
        x, y = row[12:14]
        major, minor = area['major'], area['minor']
        size = 2**math.floor(math.log2(max(major, minor, 1)))
        b = [x-major/2, y-minor/2, x+major/2, y+minor/2]
        geometry[size] = union(geometry[size], b) if size in geometry else b
    return box, geometry


def union(a, b):
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


nodes = []
counts = {}


def read_leaf(node):
    return node['file'], [r for r in json.loads((source / node['file']).read_text()) if contains(r)]


# Independent immutable files can be read together; ordering and sampling below
# remain deterministic regardless of file-provider/IO completion order.
with ThreadPoolExecutor(max_workers=8) as pool:
    leaves = dict(pool.map(read_leaf, [n for n in original['nodes'] if not n['children']]))


def visit(index):
    old = original['nodes'][index]
    if old['children']:
        children = [v for i in old['children'] if (v := visit(i)) is not None]
        if not children:
            return None
        if len(children) == 1:
            return children[0]
        sample = sorted([r for c in children for r in c['sample']], key=rank)[:48]
        box = children[0]['box']
        geometry = {}
        for c in children:
            box = union(box, c['box'])
            for size, b in c['geometry'].items():
                geometry[size] = union(geometry[size], b) if size in geometry else b
        node = {'children': [c['id'] for c in children], 'count': sum(c['count'] for c in children)}
    else:
        rows = leaves.pop(old['file'])
        if not rows:
            return None
        for row in rows:
            key = row[11].get('cosmicSubtype') or row[11].get('catalogClass') or row[2]
            counts[key] = counts.get(key, 0) + 1
        sample = sorted(rows, key=rank)[:48]
        box, geometry = envelope(rows)
        node = {'children': [], 'count': len(rows), 'file': old['file']}
    ident = len(nodes)
    node['box'] = box
    if geometry:
        node['geometryBoxes'] = [[size, *b] for size, b in sorted(geometry.items())]
    if node['children']:
        node['file'] = data_root + '/' + str(ident) + '.json'
        write(DIST / node['file'], sample)
    nodes.append(node)
    return {**node, 'id': ident, 'sample': sample, 'geometry': geometry}


roots = [v['id'] for i in original['roots'] if (v := visit(i)) is not None]
manifest = {'version': 2, 'revision': revision, 'catalogRevision': original['revision'],
            'geometryVersion': original['geometryVersion'], 'profile': profile,
            'selection': 'abs(Zg) <= 0.5 * (1e8 + (1e10 - 1e8) * min(hypot(Xg,Yg)/46.5e9, 1)) ly; nominal reference-epoch catalog position',
            'sampling': original['sampling'], 'dataRoot': data_root,
            'counts': counts, 'mapRows': sum(nodes[i]['count'] for i in roots), 'nodes': nodes, 'roots': roots}
write(out / 'manifest.json', manifest)
write(DIST / 'map-slices/current.json', {'revision': revision, 'dataRoot': data_root})
print(json.dumps({'revision': revision, 'mapRows': manifest['mapRows'], 'counts': counts}, ensure_ascii=False))
