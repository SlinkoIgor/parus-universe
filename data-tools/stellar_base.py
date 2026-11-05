"""Validate a stellar source selection against a newly built scientific base."""
import math
import re


def identifiers(o):
    return {re.sub(r'[^a-z0-9+.-]', '', a.lower().replace('gl ', 'gj '))
            for a in [o.get('name', ''), *o.get('aliases', [])] if a}


def position(o):
    if o.get('p3'):
        return o['p3']
    if any(o.get(k) is None for k in ('raDeg', 'decDeg', 'd')):
        return None
    a, b, d = math.radians(o['raDeg']), math.radians(o['decDeg']), o['d']
    v = [d * math.cos(a) * math.cos(b), d * math.sin(a) * math.cos(b), d * math.sin(b)]
    matrix = [[-.0548755604162154, -.873437090234885, -.4838350155487132],
              [.4941094278755837, -.4448296299600112, .7469822444972189],
              [-.8676661490190047, -.1980763734312015, .4559837761750669]]
    return [sum(x * y for x, y in zip(row, v)) for row in matrix]


def validate(selection, fresh):
    old = {o['id']: o for o in selection['targets']}
    for r in selection['catalogRows']:
        old.setdefault(r[0], dict(id=r[0], name=r[1], kind=r[2], d=r[3], raDeg=r[4], decDeg=r[5], aliases=r[8], **r[11]))
    positions = set(selection['localTargets']) | {r[0] for r in selection['catalogRows']}
    for s in selection['originalSystems']:
        positions.update(s['members'])
    for id, o in old.items():
        if id in selection.get('externalLayerIds', []):
            continue  # Separately generated layer, not a row of this base.
        q = fresh.get(id)
        if not q or q.get('kind') != 'star' or not identifiers(o).intersection(identifiers(q)):
            raise ValueError('Stellar identity changed; re-audit source selection: ' + id)
        if id not in positions:
            continue
        for key in ('d', 'raDeg', 'decDeg'):
            if o.get(key) is not None and (q.get(key) is None or abs(o[key] - q[key]) > 1e-9):
                raise ValueError('Stellar astrometry changed; re-audit source selection: ' + id + '/' + key)
        p, current = position(o), position(q)
        if p and (not current or math.dist(p, current) > 1e-9):
            raise ValueError('Stellar position changed; re-audit source selection: ' + id)
