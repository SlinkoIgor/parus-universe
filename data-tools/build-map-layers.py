"""Complete structural layers derived offline from the current, immutable catalog.

No new objects or positions. Published cluster radii also bound their display
footprints. Point LOD remains in catalog-data; these
independent trees have no representative samples and cannot drop a visible spine.
"""
from pathlib import Path
import collections
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
catalog = json.loads((DIST / 'catalog-data/current.json').read_text())
source = DIST / catalog['dataRoot']
manifest = json.loads((source / 'manifest.json').read_text())
revision = hashlib.sha256(Path(__file__).read_bytes() + manifest['revision'].encode()).hexdigest()[:12]
data_root = 'map-layers/' + revision
out = DIST / data_root
out.mkdir(parents=True, exist_ok=True)


def write(path, value):
    content = json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'
    if path.exists() and path.read_text() == content:
        return
    if path.parent == out and path.exists():
        raise RuntimeError('Immutable map layer differs: ' + str(path))
    path.write_text(content)


groups = collections.defaultdict(list)
for node in manifest['nodes']:
    if node['children']:
        continue
    for row in json.loads((source / node['file']).read_text()):
        extra = row[11]
        category = extra.get('cosmicSubtype') or extra.get('catalogClass') or row[2]
        if category == 'cluster':
            category = 'stellar-cluster'
        if category in ('filament', 'galaxy-cluster', 'stellar-cluster', 'nebula', 'supercluster', 'void'):
            groups[category].append(row)

nodes = []


def bounds(row):
    region = row[11].get('regionData')
    rx = region['major'] / 2 if region else 0
    ry = region['minor'] / 2 if region else 0
    extra = row[11]
    if not region and row[2] == 'nebula':
        if extra.get('angularMajorArcmin') and extra['angularMajorArcmin'] > 0 and row[3] > 0:
            rx = row[3] * math.tan(extra['angularMajorArcmin'] * math.pi / 21600)
            ry = row[3] * math.tan((extra.get('angularMinorArcmin') or extra['angularMajorArcmin']) * math.pi / 21600)
        elif (extra.get('diameterLy') or 0) > 0 and not extra.get('sizeEstimated') and not extra.get('sizeUnknown'):
            rx = extra['diameterLy'] / 2
            ry = (extra.get('minorDiameterLy') or extra['diameterLy']) / 2
    if not region and row[2] == 'cluster' and extra.get('catalogClass') != 'galaxy-cluster':
        diameter = extra.get('diameterLy')
        measurement = next((m for m in extra.get('catalogMeasurements', []) if (m.get('data', {}).get('halfNumberRadiusPc') or 0) > 0), None)
        radius = extra.get('catalogData', {}).get('halfNumberRadiusPc') or (measurement['data']['halfNumberRadiusPc'] if measurement else None)
        if diameter and diameter > 0 and not extra.get('sizeEstimated') and not extra.get('sizeUnknown'):
            rx = diameter / 2
            ry = (extra.get('minorDiameterLy') or diameter) / 2
        elif radius and radius > 0:
            rx = ry = radius * 3.261563777
        elif extra.get('angularMajorArcmin') and extra['angularMajorArcmin'] > 0 and row[3] > 0:
            rx = row[3] * math.tan(extra['angularMajorArcmin'] * math.pi / 21600)
            ry = row[3] * math.tan((extra.get('angularMinorArcmin') or extra['angularMajorArcmin']) * math.pi / 21600)
    return [row[12] - rx, row[13] - ry, row[12] + rx, row[13] + ry]


def tree(rows, category):
    ident = len(nodes)
    boxes = [bounds(row) for row in rows]
    box = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
    node = {'box': box, 'count': len(rows), 'children': [], 'category': category}
    nodes.append(node)
    if len(rows) > 128:
        axis = 12 if max(r[12] for r in rows) - min(r[12] for r in rows) >= max(r[13] for r in rows) - min(r[13] for r in rows) else 13
        ordered = sorted(rows, key=lambda r: (r[axis], r[0]))
        middle = len(rows) // 2
        node['children'] = [tree(ordered[:middle], category), tree(ordered[middle:], category)]
    else:
        node['file'] = str(ident) + '.json'
        write(out / node['file'], rows)
    return ident


roots = {category: tree(rows, category) for category, rows in sorted(groups.items())}
boot = {'version': 1, 'revision': revision, 'catalogRevision': manifest['revision'], 'dataRoot': data_root,
        'roots': roots, 'nodes': nodes, 'counts': {k: len(v) for k, v in sorted(groups.items())}}
write(out / 'manifest.json', boot)
write(DIST / 'map-layers/current.json', {'dataRoot': data_root, 'revision': revision})
js = "'use strict';\n// Full, sourced structural geometry; independent of point representatives.\nconst MAP_LAYER_BOOT=" + json.dumps(boot, ensure_ascii=False, separators=(',', ':')) + ';\n'
target = DIST / 'map-layer-data.js'
if not target.exists() or target.read_text() != js:
    target.write_text(js)
print(json.dumps({'revision': revision, 'counts': boot['counts'], 'tiles': sum('file' in n for n in nodes)}, ensure_ascii=False))
