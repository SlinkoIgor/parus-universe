#!/usr/bin/env python3
"""Export photographic directions for every stellar source, never rebuild p3/tiles.

HYG retains J2000 proper motions in its raw file, although the navigation import
does not. RV=0 and joint PM=(0,0) can be missing-value padding: keep them unknown.
The HYG 9999.99 motion cap is not a measurement (notably Barnard's star).
"""
import ast
import csv
import hashlib
import json
import math
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE = '/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).casefold() if c.isalnum())


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None


def sex(value, ra=False):
    try:
        parts = value.split(':')
        sign = -1 if parts[0].startswith('-') else 1
        return sign * sum(abs(float(x)) / 60**i for i, x in enumerate(parts)) * (15 if ra else 1)
    except (AttributeError, ValueError):
        return None


def constant(node):
    """Literal catalogue additions, including degree/minute arithmetic."""
    if isinstance(node, ast.BinOp):
        left, right = constant(node.left), constant(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
    return ast.literal_eval(node)


def prepare():
    exported = json.loads(subprocess.check_output([NODE, 'data-tools/export-sky-dss-objects.mjs'], cwd=ROOT))
    objects = {o['id']: o for o in exported['objects']}
    by_hyg = {str(o['hygId']): o for o in objects.values() if o.get('hygId') is not None}
    by_ngc = {o['ngc']: o for o in objects.values() if o.get('ngc')}
    sources = {}

    def read(name):
        path = ROOT / 'data-tools' / name
        sources[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return json.loads(path.read_text())

    raw = ROOT / 'data-tools/raw/hyg_v41.csv'
    sources['raw/hyg_v41.csv'] = hashlib.sha256(raw.read_bytes()).hexdigest()
    for q in csv.DictReader(raw.open()):
        if q['id'] == '0':
            continue
        ident = by_hyg.get(q['id'], {}).get('id', 'hyg-' + q['id'])
        o = objects.setdefault(ident, dict(id=ident, raDeg=float(q['ra'])*15, decDeg=float(q['dec']),
            kind='star', hip=q['hip'], hd=q['hd'], gliese=q['gl'], hygId=int(q['id']),
            aliases=[q['gl'], 'HIP '+q['hip']] if q['hip'] else [q['gl']], source='HYG'))
        pmra, pmdec, rv, pc = map(number, [q['pmra'], q['pmdec'], q['rv'], q['dist']])
        clipped = any(v is not None and abs(v) >= 9999.99 for v in [pmra, pmdec])
        if clipped or (pmra == 0 and pmdec == 0):
            pmra = pmdec = None
        o['photographicAstrometry'] = dict(identifier='HYG '+q['id'], name=q['proper'] or 'HYG '+q['id'],
            raDeg=float(q['ra'])*15, decDeg=float(q['dec']), epoch=2000,
            pmRaCosDec=pmra, pmDec=pmdec, radialKmS=rv if rv else None,
            parallaxMas=1000/pc if pc and 0 < pc < 100000 else None,
            coordinateSource='HYG 4.1', motionSource='HYG 4.1', uncertaintyKnown=False,
            motionCapped=clipped, radialSource='HYG 4.1' if rv else None)

    raw = ROOT / 'data-tools/raw/NGC.csv'
    sources['raw/NGC.csv'] = hashlib.sha256(raw.read_bytes()).hexdigest()
    for q in csv.DictReader(raw.open(), delimiter=';'):
        if q['Type'] not in ['*', '**', 'Nova']:
            continue
        ident = by_ngc.get(q['Name'], {}).get('id', 'opengc-'+norm(q['Name']))
        objects.setdefault(ident, dict(id=ident, kind='star', raDeg=sex(q['RA'], True), decDeg=sex(q['Dec']),
            name=q['Name'], aliases=q['Identifiers'].split(','), source='OpenNGC'))

    for q in read('nearby-galaxy-stars.json')['stars']:
        ident = 'member-'+q['id']
        objects.setdefault(ident, dict(q, id=ident, kind='star'))
    for q in read('galaxy-disk-objects.json')['objects']:
        if q['kind'] == 'star':
            objects.setdefault(q['id'], q)
    for q in read('magellanic-cepheids.json')['objects']:
        objects.setdefault(q['id'], dict(q, kind='star', aliases=[q['name']], source='OGLE'))

    # Literal stellar additions have no raw source table (e.g. the direction
    # of an optical pair). Read their authoritative source declaration, rather
    # than inventing individual motions or executing the scientific builder.
    additions = ROOT / 'data-tools/build-full-catalog.py'
    sources['build-full-catalog.py'] = hashlib.sha256(additions.read_bytes()).hexdigest()
    for call in ast.walk(ast.parse(additions.read_text())):
        if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Name)
                and call.func.id == 'add' and len(call.args) == 12):
            continue
        try:
            row = [constant(arg) for arg in call.args]
        except (ValueError, TypeError):
            continue
        if row[2] == 'star':
            objects.setdefault(row[0], dict(id=row[0], name=row[1], kind=row[2], raDeg=row[4], decDeg=row[5],
                                             aliases=row[8], source=row[10], **row[11]))

    # Check the complete published index, including manually added catalogue
    # rows and future stellar sources. Read only missing identities' tiles;
    # do not rescan all science tiles or change their import/navigation data.
    current = json.loads((ROOT / 'dist/catalog-data/current.json').read_text())
    if current['revision'] != exported['catalogRevision']:
        raise ValueError('Catalogue changed during export; retry on one consistent snapshot')
    search_path = ROOT / 'dist' / current['dataRoot'] / 'search.json'
    search_bytes = search_path.read_bytes()
    sources[current['dataRoot']+'/search.json'] = hashlib.sha256(search_bytes).hexdigest()
    search = [row for row in json.loads(search_bytes) if row[2] == 'star']
    expected = {o['id'] for o in exported['objects']} | {row[0] for row in search}
    missing = {row[0] for row in search} - objects.keys()
    for tile in sorted({row[5] for row in search if row[0] in missing}):
        for row in json.loads((ROOT / 'dist' / current['dataRoot'] / tile).read_text()):
            if row[0] in missing:
                objects[row[0]] = dict(id=row[0], name=row[1], kind=row[2], raDeg=row[4], decDeg=row[5],
                                       aliases=row[8], source=row[10], **row[11])
    if expected - objects.keys():
        raise ValueError('Unrepresented stellar identities: '+str(sorted(expected - objects.keys())))

    valid = [o for o in objects.values() if o['id'] in expected
             and all(number(o.get(k)) is not None for k in ['raDeg', 'decDeg'])
             and 0 <= o['raDeg'] < 360 and abs(o['decDeg']) <= 90]
    return dict(objects=valid, coreIds=[o['id'] for o in exported['objects']], priority=exported['priority'],
                catalogRevision=exported['catalogRevision'], sources=sources,
                coverage=dict(indexedStars=len(search), registeredStars=len(exported['objects']),
                              photographicStars=len(valid), withoutDirections=sorted(expected-{o['id'] for o in valid})))


if __name__ == '__main__':
    Path(sys.argv[1]).write_text(json.dumps(prepare(), ensure_ascii=False, separators=(',', ':'), allow_nan=False))
