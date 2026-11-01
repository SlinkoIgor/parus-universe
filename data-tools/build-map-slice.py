#!/usr/bin/env python3
"""Build immutable LOD trees for uniform, zoom-dependent Galactic slabs.
Dyadic supersets cover every continuous thickness. Runtime applies the exact
boundary and soft interior edge. All source rows and leaf tiles stay unchanged.
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
profile = {'type': 'uniform-zoom', 'thicknessToSpan': .5}
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


def height(row):
    extra = row[11]
    if extra.get('atlasOnly') or row[6] == 'unknown':
        return math.inf
    p = extra.get('p3')
    if not p:
        d, ra, dec = row[3:6]
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (d, ra, dec)) or d <= 0:
            return math.inf
        a, b = math.radians(ra), math.radians(dec)
        v = [d * math.cos(b) * math.cos(a), d * math.cos(b) * math.sin(a), d * math.sin(b)]
        p = [sum(x * y for x, y in zip(r, v)) for r in matrix]
    if len(p) != 3 or not all(math.isfinite(v) for v in p):
        return math.inf
    return abs(p[2])


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
reuse = {}
samples = {}


def read_leaf(node):
    rows = json.loads((source / node['file']).read_text())
    return node['file'], [(height(r), r) for r in rows]


with ThreadPoolExecutor(max_workers=8) as pool:
    leaves = dict(pool.map(read_leaf, [n for n in original['nodes'] if not n['children']]))


def visit(index, half):
    old = original['nodes'][index]
    if old['children']:
        children = [v for i in old['children'] if (v := visit(i, half)) is not None]
        if not children:
            return None
        if len(children) == 1:
            return children[0]
        signature = tuple(children)
        if signature in reuse:
            return reuse[signature]
        sample = sorted([r for child in children for r in samples[child]], key=rank)[:48]
        box = nodes[children[0]]['box']
        geometry = {}
        for child in children:
            n = nodes[child]
            box = union(box, n['box'])
            for size, *b in n.get('geometryBoxes', []):
                geometry[size] = union(geometry[size], b) if size in geometry else b
        content = json.dumps(sample, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
        name = hashlib.sha256(content.encode()).hexdigest()[:20] + '.json'
        write(out / name, sample)
        node = {'children': children, 'count': sum(nodes[i]['count'] for i in children), 'zMaxLy': max(nodes[i]['zMaxLy'] for i in children), 'file': data_root + '/' + name}
    else:
        rows = [r for z, r in leaves[old['file']] if z <= half]
        if not rows:
            return None
        # Nested slabs: an unchanged count means exactly the same source rows.
        signature = (old['file'], len(rows))
        if signature in reuse:
            return reuse[signature]
        sample = sorted(rows, key=rank)[:48]
        box, geometry = envelope(rows)
        node = {'children': [], 'count': len(rows), 'zMaxLy': max(z for z, r in leaves[old['file']] if z <= half), 'file': old['file']}
    node['box'] = box
    if geometry:
        node['geometryBoxes'] = [[size, *b] for size, b in sorted(geometry.items())]
    ident = len(nodes)
    nodes.append(node)
    samples[ident] = sample
    reuse[signature] = ident
    return ident


bands = []
for exponent in range(-16, 37):
    half = 2.0**exponent
    roots = [v for i in original['roots'] if (v := visit(i, half)) is not None]
    bands.append({'halfThicknessLy': half, 'roots': roots,
                  'mapRows': sum(nodes[i]['count'] for i in roots)})
manifest = {'version': 3, 'revision': revision, 'catalogRevision': original['revision'],
            'geometryVersion': original['geometryVersion'], 'profile': profile,
            'selection': 'abs(Zg) <= reference viewport span / 4; uniform everywhere; dyadic index supersets, exact runtime filter',
            'sampling': original['sampling'], 'dataRoot': data_root,
            'mapRows': bands[-1]['mapRows'], 'bands': bands, 'nodes': nodes,
            'roots': bands[-1]['roots']}
write(out / 'manifest.json', manifest)
write(DIST / 'map-slices/current.json', {'revision': revision, 'dataRoot': data_root})
print(json.dumps({'revision': revision, 'bands': len(bands), 'nodes': len(nodes),
                  'mapRows': manifest['mapRows']}, ensure_ascii=False))
