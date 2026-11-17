"""Apply distance enrichment to the installed scientific snapshot, offline.

Rebuild spatial/search indexes without reimporting unrelated source catalogues.
The immutable input remains installed; repeated builds reproduce the same bytes.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile

from messier_distances import enrich, unresolved_core_rows

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
BASE = 'c240a9fdd8f7'
NODE = '/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False))


source = DIST / 'catalog-data' / BASE
manifest = json.loads((source / 'manifest.json').read_text())
search = json.loads((source / 'search.json').read_text())
records = {}
for file in dict.fromkeys(r[5] for r in search):
    for row in json.loads((source / file).read_text()):
        records[row[0]] = row
rows = [records[r[0]] for r in search]
before = copy.deepcopy(rows)
imported = json.JSONDecoder().raw_decode((DIST / 'catalog-import.js').read_text().split('const IMPORTED_CATALOG=', 1)[1])[0]
core_rows = unresolved_core_rows(imported['objects'])
audit = enrich(rows + core_rows, ROOT, lambda *args: [0, 0])
changed = {q['id'] for q in audit}
assert len(changed) == 19, 'Re-audit the base snapshot before changing the enrichment scope'
assert all(a == b for a, b in zip(before, rows) if a[0] not in changed)

boot_path = DIST / 'catalog-extended.js'
boot = json.loads(boot_path.read_text().split('=', 1)[1].rstrip(';\n'))
assert boot.get('messierBaseRevision', boot['revision']) == BASE, 'Incompatible scientific base'
with tempfile.TemporaryDirectory(prefix='parus-messier-') as tmp:
    tmp = Path(tmp)
    dump(tmp / 'rows.json', [r for r in rows if r[0] in changed] + core_rows)
    js = """const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});
vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','map-layout','cosmology','map-details','catalog-extended','catalog-stream'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\\n'),c);
const rows=JSON.parse(fs.readFileSync(process.argv[1]));c.rows=rows;
vm.runInContext('for(const r of rows){const o=ExtendedCatalog.decode(r);const p=MapLayout.place(o),raw=MapLayout.base(o.p3);r[12]=p.x;r[13]=p.y;delete r[11].mapOffset;if(p.x!==raw.x||p.y!==raw.y)r[11].mapOffset=[p.x-raw.x,p.y-raw.y];}',c);
fs.writeFileSync(process.argv[1],JSON.stringify(rows));fs.writeFileSync(process.argv[2],vm.runInContext('JSON.stringify(OBJECTS)',c));"""
    subprocess.run([NODE, '-e', js, str(tmp / 'rows.json'), str(tmp / 'core.json')], cwd=ROOT, check=True)
    projected = {r[0]: r for r in json.loads((tmp / 'rows.json').read_text())}
    rows = [projected.get(r[0], r) for r in rows]
    core = json.loads((tmp / 'core.json').read_text())

dependencies = [Path(__file__), ROOT / 'data-tools/messier_distances.py',
                ROOT / 'data-tools/messier-distances.json', ROOT / 'data-tools/globular-cluster-models.json',
                DIST / 'map-layout.js', source / 'manifest.json']
revision = hashlib.sha256(b''.join(p.read_bytes() for p in dependencies)).hexdigest()[:12]
data_root = 'catalog-data/' + revision
out = Path(tempfile.mkdtemp(prefix='.' + revision + '-', dir=DIST / 'catalog-data'))
nodes, locations = [], {}


def rank(row):
    category = row[11].get('catalogClass', row[2])
    weights = dict(void=100, structure=20, wall=20, ring=20, arc=20, galaxy=1, cluster=.03, pulsar=.02, star=.001)
    weights.update({'galaxy-cluster': 5, 'stellar-cluster': .03})
    weight = 2 if row[11].get('cosmicSubtype') == 'filament' else weights.get(category, 1)
    value = (int.from_bytes(hashlib.sha256(row[0].encode()).digest()[:8], 'big') + .5) / 2**64
    return -math.log(value) / weight, row[0]


def tile(part):
    ident = len(nodes)
    box = [min(r[12] for r in part), min(r[13] for r in part), max(r[12] for r in part), max(r[13] for r in part)]
    node = dict(box=box, count=len(part), children=[], file=str(ident) + '.json')
    geometry = {}
    for r in part:
        area = r[11].get('regionData')
        if not area:
            continue
        major, minor = area['major'], area['minor']
        size = 2**math.floor(math.log2(max(major, minor, 1)))
        b = [r[12] - major/2, r[13] - minor/2, r[12] + major/2, r[13] + minor/2]
        old = geometry.get(size, b)
        geometry[size] = [min(old[0], b[0]), min(old[1], b[1]), max(old[2], b[2]), max(old[3], b[3])]
    if geometry:
        node['geometryBoxes'] = [[size, *b] for size, b in sorted(geometry.items())]
    nodes.append(node)
    if len(part) > 256:
        axis = 12 if box[2] - box[0] >= box[3] - box[1] else 13
        ordered = sorted(part, key=lambda r: (r[axis], r[0]))
        mid = len(part) // 2
        node['children'] = [tile(ordered[:mid]), tile(ordered[mid:])]
        sample = sorted(part, key=rank)[:48]
    else:
        sample = part
        locations.update({r[0]: node['file'] for r in part})
    dump(out / node['file'], sample)
    return ident


mapped = [r for r in rows if not r[11].get('atlasOnly')]
atlas = [r for r in rows if r[11].get('atlasOnly')]
roots = [tile(mapped)]
for i in range(0, len(atlas), 256):
    file = 'atlas-' + str(i // 256) + '.json'
    dump(out / file, atlas[i:i+256])
    locations.update({r[0]: file for r in atlas[i:i+256]})
index = []
for old in search:
    row = records[old[0]]
    item = [row[0], row[1], row[2], row[3], row[6], locations[row[0]], old[6], bool(row[11].get('atlasOnly'))]
    if row[11].get('catalogClass'):
        item.append(row[11]['catalogClass'])
    index.append(item)
dump(out / 'search.json', index)
coverage = copy.deepcopy(manifest['sourceCoverage'])
coverage['Messier'].update(mapped=110, distanceEnriched=19, opticalGroupAnchors=2)
manifest.update(revision=revision, dataRoot=data_root, nodes=nodes, roots=roots,
                mapRows=len(mapped), atlasOnlyRows=len(atlas), sourceCoverage=coverage,
                unknownExtra=sum(r[6] == 'unknown' for r in rows), approximateExtra=sum(r[6] == 'approximate' for r in rows),
                messierBaseRevision=BASE)
dump(out / 'manifest.json', manifest)
target = DIST / data_root
if target.exists():
    assert {p.name: p.read_bytes() for p in out.iterdir()} == {p.name: p.read_bytes() for p in target.iterdir()}, 'Immutable revision collision'
    shutil.rmtree(out)
else:
    out.rename(target)
boot.update(revision=revision, dataRoot=data_root, messierBaseRevision=BASE, sourceCoverage=coverage)
boot['hiddenIds'] = [id for id in boot['hiddenIds'] if id not in changed]
boot['coordinateCorrections'] = [r for r in boot['coordinateCorrections'] if r[0] not in changed] + [projected[id] for id in sorted(changed)]
boot['systemTiles'] = {id: locations.get(id, file) for id, file in boot['systemTiles'].items()}
for row in core_rows:
    row = projected[row[0]]
    boot['patches'][row[0]] = dict(d=row[3], raDeg=row[4], decDeg=row[5],
        positionQuality=row[6], distanceMethod=row[7], display=row[12:14], **row[11])
    boot['policies'].setdefault(row[0], {}).update(**row[11], positionReason='')
boot_path.write_text('// Generated from complete local source snapshots.\nconst EXTENDED_BOOT=' + json.dumps(boot, ensure_ascii=False, separators=(',', ':')) + ';\n')
dump(DIST / 'catalog-data/current.json', dict(revision=revision, dataRoot=data_root, total=manifest['total'], manifest=data_root + '/manifest.json'))
dump(ROOT / 'data-tools/messier-distance-audit.json', dict(baseRevision=BASE, revision=revision, policy='Only missing Messier distances; optical groups use named reference stars.', rows=audit))
audit_path = ROOT / 'data-tools/full-catalog-audit.json'
full = json.loads(audit_path.read_text())
full.update(sourceCoverage=coverage, mappedRows=len(mapped), atlasOnlyRows=len(atlas),
            unknownExtra=manifest['unknownExtra'], approximateExtra=manifest['approximateExtra'])
dump(audit_path, full)

# Every input row outside the audited Messier set is identical to the validated
# base. None of the stellar layer's selected identities or endpoints is touched.
selection = json.loads((ROOT / 'data-tools/stellar-sources/catalog-selection.json').read_text())
ids = {o['id'] for o in selection['targets']} | {r[0] for r in selection['catalogRows']}
assert not ids.intersection(changed)
stellar = boot['stellarCatalog']
stellar['baseCatalogRevision'] = revision
stellar['baseValidation'] = dict(revision=revision, selectionSha256=hashlib.sha256((ROOT / 'data-tools/stellar-sources/catalog-selection.json').read_bytes()).hexdigest(),
    policy='Exact source identities and unchanged adopted astrometry of all modelled systems')
stellar.pop('revision')
stellar['revision'] = hashlib.sha256(json.dumps(stellar, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
boot_path.write_text('// Generated from complete local source snapshots.\nconst EXTENDED_BOOT=' + json.dumps(boot, ensure_ascii=False, separators=(',', ':')) + ';\n')
(ROOT / 'data-tools/stellar-catalog.json').write_text(json.dumps(stellar, ensure_ascii=False, indent=2) + '\n')
stellar_audit_path = ROOT / 'data-tools/stellar-catalog-audit.json'
stellar_audit = json.loads(stellar_audit_path.read_text())
stellar_audit['revision'] = stellar['revision']
stellar_audit_path.write_text(json.dumps(stellar_audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(revision=revision, enriched=len(changed), mapped=len(mapped), atlasOnly=len(atlas))))
