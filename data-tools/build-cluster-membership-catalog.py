"""Apply published open-cluster membership depths to the installed snapshot, offline.

Only Hipparcos stars with a cluster-membership estimate change; every other
row must stay byte-identical to the base. Spatial/search indexes, boot data
and dependent map layers are rebuilt from the result.
"""
import copy
import gzip
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

from cluster_membership import apply

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
BASE = '3f5a9b416717'
NODE = '/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'
MATRIX = [[-.0548755604162154, -.873437090234885, -.4838350155487132], [.4941094278755837, -.4448296299600112, .7469822444972189], [-.8676661490190047, -.1980763734312015, .4559837761750669]]


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False))


def projection(ra, dec, d, kind, ident):
    a, b = math.radians(ra), math.radians(dec)
    v = [d * math.cos(a) * math.cos(b), d * math.sin(a) * math.cos(b), d * math.sin(b)]
    p = [sum(x * y for x, y in zip(row, v)) for row in MATRIX]
    return [p[0], -p[1]]


def read_boot(path):
    return json.loads(path.read_text().split('=', 1)[1].rstrip(';\n'))


def write_boot(path, boot):
    path.write_text('// Generated from complete local source snapshots.\nconst EXTENDED_BOOT=' + json.dumps(boot, ensure_ascii=False, separators=(',', ':')) + ';\n')


def export_core():
    js = """const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','map-layout'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\\n'),c);process.stdout.write(vm.runInContext('JSON.stringify(OBJECTS.map(o=>({...o,display:o.p3?MapLayout.base(o.p3):{x:o.x,y:o.y}})))',c));"""
    return json.loads(subprocess.check_output([NODE, '-e', js], cwd=ROOT))


def project(rows, hosts, core, patches, policies):
    with tempfile.TemporaryDirectory(prefix='parus-cluster-members-') as tmp:
        source, target = Path(tmp) / 'input.json', Path(tmp) / 'output.json'
        dump(source, {'core': core, 'patches': copy.deepcopy(patches), 'policies': copy.deepcopy(policies), 'records': copy.deepcopy(rows + hosts), 'members': []})
        subprocess.run([NODE, str(ROOT / 'data-tools/project-map-layout.mjs'), str(source), str(target)], cwd=ROOT, check=True)
        placed = {r[0]: r for r in json.loads(target.read_text())['records']}
    return [placed[r[0]] for r in rows]


def rank(row):
    category = row[11].get('catalogClass', row[2])
    weights = dict(void=100, structure=20, wall=20, ring=20, arc=20, galaxy=1, cluster=.03, pulsar=.02, star=.001)
    weights.update({'galaxy-cluster': 5, 'stellar-cluster': .03})
    weight = 2 if row[11].get('cosmicSubtype') == 'filament' else weights.get(category, 1)
    value = (int.from_bytes(hashlib.sha256(row[0].encode()).digest()[:8], 'big') + .5) / 2**64
    return -math.log(value) / weight, row[0]


def build_tiles(rows, out):
    nodes, locations = [], {}

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
            b = [r[12] - major / 2, r[13] - minor / 2, r[12] + major / 2, r[13] + minor / 2]
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
        dump(out / file, atlas[i:i + 256])
        locations.update({r[0]: file for r in atlas[i:i + 256]})
    return nodes, roots, locations, mapped, atlas


def main():
    source = DIST / 'catalog-data' / BASE
    manifest = json.loads((source / 'manifest.json').read_text())
    search = json.loads((source / 'search.json').read_text())
    records = {}
    for file in dict.fromkeys(r[5] for r in search):
        for row in json.loads((source / file).read_text()):
            records[row[0]] = row
    rows = [records[r[0]] for r in search]
    before = copy.deepcopy(rows)
    boot_path = DIST / 'catalog-extended.js'
    boot = read_boot(boot_path)
    assert boot.get('clusterMembershipBaseRevision', boot['revision']) == BASE, 'Incompatible scientific base'
    core = export_core()
    matches = json.loads((ROOT / 'data-tools/cosmic-catalog-audit.json').read_text())['matches']
    system_members = {i for s in boot['systems'] for i in s['members']}
    audit = apply(ROOT, rows, core, boot['patches'], boot['policies'], system_members, matches, projection)
    changed = {q['star'] for q in audit['rows'] if q['action'] == 'membership-distance'}
    assert all(a == b for a, b in zip(before, rows) if a[0] not in changed)
    by_id = {r[0]: r for r in rows}
    hosts = [by_id[i] for i in sorted({q['cluster'] for q in audit['rows'] if q['action'] == 'membership-distance'}) if i in by_id]
    projected = {r[0]: r for r in project([by_id[i] for i in sorted(changed)], hosts, core, boot['patches'], boot['policies'])}
    rows = [projected.get(r[0], r) for r in rows]
    selection = json.loads((ROOT / 'data-tools/stellar-sources/catalog-selection.json').read_text())
    stellar_ids = {o['id'] for o in selection['targets']} | {r[0] for r in selection['catalogRows']}
    assert not stellar_ids.intersection(changed), 'Stellar-system layer endpoints must not move'

    dependencies = [Path(__file__), ROOT / 'data-tools/cluster_membership.py', ROOT / 'data-tools/cluster-members.json',
                    ROOT / 'data-tools/cosmic-catalog-audit.json', ROOT / 'data-tools/project-map-layout.mjs',
                    DIST / 'map-layout.js', source / 'manifest.json']
    revision = hashlib.sha256(b''.join(p.read_bytes() for p in dependencies)).hexdigest()[:12]
    data_root = 'catalog-data/' + revision
    out = Path(tempfile.mkdtemp(prefix='.' + revision + '-', dir=DIST / 'catalog-data'))
    nodes, roots, locations, mapped, atlas = build_tiles(rows, out)
    index = []
    for old in search:
        row = projected.get(old[0], records[old[0]])
        item = [row[0], row[1], row[2], row[3], row[6], locations[row[0]], old[6], bool(row[11].get('atlasOnly'))]
        if row[11].get('catalogClass'):
            item.append(row[11]['catalogClass'])
        index.append(item)
    dump(out / 'search.json', index)
    actions = Counter(q['action'] for q in audit['rows'])
    coverage = copy.deepcopy(manifest['sourceCoverage'])
    coverage['ClusterMembership'] = {'rows': len(audit['rows']), 'represented': len(changed), 'actions': dict(actions)}
    manifest.update(revision=revision, dataRoot=data_root, nodes=nodes, roots=roots,
                    mapRows=len(mapped), atlasOnlyRows=len(atlas), sourceCoverage=coverage,
                    unknownExtra=sum(r[6] == 'unknown' for r in rows), approximateExtra=sum(r[6] == 'approximate' for r in rows),
                    clusterMembershipBaseRevision=BASE)
    dump(out / 'manifest.json', manifest)
    target = DIST / data_root
    if target.exists():
        assert {p.name: p.read_bytes() for p in out.iterdir()} == {p.name: p.read_bytes() for p in target.iterdir()}, 'Immutable revision collision'
        shutil.rmtree(out)
    else:
        out.rename(target)

    boot.update(revision=revision, dataRoot=data_root, clusterMembershipBaseRevision=BASE, sourceCoverage=coverage)
    boot['hiddenIds'] = [i for i in boot['hiddenIds'] if i not in changed]
    boot['coordinateCorrections'] = [r for r in boot['coordinateCorrections'] if r[0] not in changed] + [projected[i] for i in sorted(changed)]
    boot['systemTiles'] = {i: locations.get(i, file) for i, file in boot['systemTiles'].items()}
    boot['identityTargetRows'] = [projected.get(r[0], r) for r in boot.get('identityTargetRows', [])]
    stellar = boot['stellarCatalog']
    stellar['baseCatalogRevision'] = revision
    stellar['baseValidation'] = dict(revision=revision, selectionSha256=hashlib.sha256((ROOT / 'data-tools/stellar-sources/catalog-selection.json').read_bytes()).hexdigest(),
                                     policy='Exact source identities and unchanged adopted astrometry of all modelled systems')
    stellar.pop('revision')
    stellar['revision'] = hashlib.sha256(json.dumps(stellar, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    write_boot(boot_path, boot)
    (ROOT / 'data-tools/stellar-catalog.json').write_text(json.dumps(stellar, ensure_ascii=False, indent=2) + '\n')
    stellar_audit_path = ROOT / 'data-tools/stellar-catalog-audit.json'
    stellar_audit = json.loads(stellar_audit_path.read_text())
    stellar_audit['revision'] = stellar['revision']
    stellar_audit_path.write_text(json.dumps(stellar_audit, ensure_ascii=False, indent=2) + '\n')
    dump(DIST / 'catalog-data/current.json', dict(revision=revision, dataRoot=data_root, total=manifest['total'], manifest=data_root + '/manifest.json'))
    dump(ROOT / 'data-tools/cluster-membership-audit.json', dict(baseRevision=BASE, revision=revision, **audit))
    base_rows = json.dumps(dict(revision=BASE, rows=[r for r in before if r[0] in changed]), ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    (ROOT / 'data-tools/cluster-membership-base.json.gz').write_bytes(gzip.compress(base_rows.encode(), mtime=0))
    audit_path = ROOT / 'data-tools/full-catalog-audit.json'
    full = json.loads(audit_path.read_text())
    full.update(sourceCoverage=coverage, mappedRows=len(mapped), atlasOnlyRows=len(atlas),
                unknownExtra=manifest['unknownExtra'], approximateExtra=manifest['approximateExtra'])
    dump(audit_path, full)

    members = json.loads((ROOT / 'data-tools/cluster-members.json').read_text())
    sources_path = DIST / 'catalog-sources.json'
    sources = json.loads(sources_path.read_text())
    sources['provenance'] = [q for q in sources['provenance'] if not q.get('clusterMembership')]
    sources['provenance'] += [
        {'name': 'Hunt & Reffert 2024 open-cluster members, table 2', 'url': members['membershipURL'],
         'changes': 'Gaia DR3 IDs, membership probabilities and Gaia parallaxes of members with G<13; only Hipparcos stars are used to estimate depth of existing HYG rows. Snapshot data-tools/cluster-members.json, audit data-tools/cluster-membership-audit.json.',
         'access': 'CDS/VizieR; credit CDS and the original authors, original data rights apply.', 'clusterMembership': True},
        {'name': 'Gaia DR3 hipparcos2_best_neighbour', 'url': members['crossmatchURL'],
         'changes': 'Official Gaia DR3 to Hipparcos-2 identifier cross-match; a HIP assigned to several members is excluded.',
         'access': 'ESA/Gaia/DPAC, CC BY-SA 3.0 IGO.', 'clusterMembership': True}]
    sources['fullCatalog']['clusterMembershipAudit'] = 'data-tools/cluster-membership-audit.json'
    sources_path.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')

    subprocess.run([sys.executable, str(ROOT / 'data-tools/build-map-layers.py')], check=True)
    subprocess.run([sys.executable, str(ROOT / 'data-tools/build-map-slice.py')], check=True)
    layer_revision = json.loads((DIST / 'map-layers/current.json').read_text())['revision']
    extended_revision = hashlib.sha256(boot_path.read_bytes()).hexdigest()[:12]
    html = DIST / 'index.html'
    text = re.sub(r'(catalog-extended\.js\?v=)[^"]+', lambda m: m[1] + extended_revision, html.read_text())
    html.write_text(re.sub(r'(map-layer-data\.js\?v=)[^"]+', lambda m: m[1] + layer_revision, text))
    subprocess.run([sys.executable, str(ROOT / 'data-tools/build-map-radial.py')], check=True)
    steps = ['build-map-visibility.mjs', 'build-map-labels.mjs', 'build-black-hole-catalog.mjs', 'build-map-filter-index.mjs',
             'build-sky-imaging.py', 'build-sky-photos.py', 'build-map-filter-index.mjs', 'build-arrival-stars.mjs']
    for script in steps:
        runner = sys.executable if script.endswith('.py') else NODE
        subprocess.run([runner, str(ROOT / 'data-tools' / script)], cwd=ROOT, check=True)
    print(json.dumps(dict(revision=revision, membershipDistances=len(changed), mapped=len(mapped), atlasOnly=len(atlas), actions=actions)))


main()
