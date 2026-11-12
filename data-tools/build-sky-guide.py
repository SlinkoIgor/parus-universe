#!/usr/bin/env python3
"""Build the independent Earth sky guide from frozen, attributed source files.

No scientific/navigation catalogue or map index is rebuilt by this command.
Stars/figures are J2000 XHIP data distributed by d3-celestial. Constellation
membership uses Roman (1987) B1875 boundaries, not the star's traditional name.
"""
import hashlib
import json
import math
from bisect import bisect_left
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data-tools/sky-sources'
read = lambda name: json.loads((SRC / name).read_text())
names = read('starnames.json')
stars = []
for f in read('stars.6.json')['features']:
    n = names.get(str(f['id']), {})
    ra, dec = f['geometry']['coordinates']
    label = n.get('ru') or n.get('name') or ''
    stars.append([f['id'], ra % 360, dec, f['properties']['mag'], label])
constellations = {}
for f in read('constellations.json')['features']:
    p = f['properties']
    c = constellations.setdefault(f['id'], dict(name=p['ru'], latin=p['name'], centers=[], lines=[]))
    c['centers'].append(f['geometry']['coordinates'])
for f in read('constellations.lines.json')['features']:
    constellations[f['id']]['lines'].extend(f['geometry']['coordinates'])
boundaries = []
for line in (SRC / 'roman87.dat').read_text().splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    lo, hi, dec, con = line.split()
    boundaries.append([float(lo), float(hi), float(dec), con])
assert len(constellations) == 88 and len(boundaries) == 357
assert len(stars) == 5044 and all(s[3] <= 6 for s in stars)

# Recover the full sky regions from Roman's ordered decision table, rather
# than using the much smaller stick figures or just their labelled stars.
# On each RA/Dec cell the first matching row is constant. Rotate its extrema
# from B1875 to J2000 with the same IAU 1976 frame convention as the finder.
ra_edges = sorted({q[i] for q in boundaries for i in [0, 1]})
dec_edges = sorted({-90., 90., *(q[2] for q in boundaries)})
t = (2415020.31352 - 25 * 365.242198781 - 2451545) / 36525
z = math.radians((2306.2181*t + 1.09468*t*t + .018203*t*t*t) / 3600)
theta = math.radians((2004.3109*t - .42665*t*t - .041833*t*t*t) / 3600)
# J2000 declination is the projection onto its pole, expressed in B1875.
pole = [-math.sin(theta)*math.cos(z), -math.sin(theta)*math.sin(z), math.cos(theta)]
ranges = {key: [90., -90.] for key in constellations}

def rectangle_declinations(ra_lo, ra_hi, dec_lo, dec_hi):
    a, b = math.radians(ra_lo*15), math.radians(ra_hi*15)
    d0, d1 = math.radians(dec_lo), math.radians(dec_hi)
    critical_ra = math.atan2(pole[1], pole[0])
    angles = [a, b] + [critical_ra + k*math.pi for k in range(-2, 4)
                       if a <= critical_ra + k*math.pi <= b]
    values = []
    for angle in angles:
        horizontal = pole[0]*math.cos(angle) + pole[1]*math.sin(angle)
        critical_dec = math.atan2(pole[2], horizontal)
        declinations = [d0, d1] + [critical_dec + k*math.pi for k in range(-2, 3)
                                   if d0 <= critical_dec + k*math.pi <= d1]
        for dec in declinations:
            v = horizontal*math.cos(dec) + pole[2]*math.sin(dec)
            values.append(math.degrees(math.asin(max(-1., min(1., v)))))
    return min(values), max(values)

for dec_lo, dec_hi in zip(dec_edges, dec_edges[1:]):
    assigned = [None] * (len(ra_edges)-1)
    for lo, hi, dec, con in boundaries:
        if (dec_lo+dec_hi)/2 < dec:
            continue
        for i in range(bisect_left(ra_edges, lo), bisect_left(ra_edges, hi)):
            if assigned[i] is None:
                assigned[i] = con
    assert all(assigned), 'Roman must cover the entire sky'
    start = 0
    for end in range(1, len(assigned)+1):
        if end == len(assigned) or assigned[end] != assigned[start]:
            low, high = rectangle_declinations(ra_edges[start], ra_edges[end], dec_lo, dec_hi)
            limits = ranges[assigned[start]]
            limits[0], limits[1] = min(limits[0], low), max(limits[1], high)
            start = end
for con, limits in ranges.items():
    assert -90 <= limits[0] < limits[1] <= 90, con
    constellations[con]['decRangeDeg'] = [round(v, 6) for v in limits]
media = read('media.json') + read('media-hubble.json') + read('media-cosmic.json')
ids = set()
for photo in media:
    assert photo['id'] not in ids
    ids.add(photo['id'])
    assert (photo['objects'] or photo.get('identifiers')) and photo['credit'] and photo['description']
    assert photo['url'].startswith('https://') and photo['source'].startswith('https://')
    assert photo.get('format', 'image') in ('image', 'video')
    if photo.get('format') == 'video':
        assert photo['url'].endswith('.mp4') and photo['poster'].startswith('https://')
        assert photo['mediaType'] in ('observation', 'reconstruction', 'diagram', 'composite')
visual_targets = read('visual-targets.json')
observing_evidence = read('observing-evidence.json')['entries']
for evidence in observing_evidence:
    assert evidence['kind'] == 'galaxy' and evidence['nakedEye'] is True
    assert evidence['identifiers'] and evidence['source'].startswith('https://') and evidence['quote']
# Source evidence stays in the source files, outside the browser payload.
media = [{k: v for k, v in p.items() if k not in ['identification', 'sourceCaption', 'archiveTitle']} for p in media]
data = dict(version=3, epoch='J2000', magnitudeLimit=6, stars=stars,
            declinationRangeSource='Roman 1987 VI/42 B1875 regions; IAU 1976 to J2000; degrees',
            constellations=constellations, boundaries=boundaries, media=media,
            visualTargets=[[identifier.strip(), p['caldwell']] for p in visual_targets['entries']
                           for identifier in p['identifier'].split(',')],
            observingEvidence=observing_evidence)
encode = lambda d: json.dumps(d, ensure_ascii=False, separators=(',', ':'))
data['revision'] = hashlib.sha256(encode(data).encode()).hexdigest()[:12]
out = ROOT / 'dist/sky-guide-data.js'
licenses = '\n\n'.join((SRC / name).read_text() for name in ['LICENSE-d3-celestial.txt', 'LICENSE-astropy.txt'])
content = '// Generated by data-tools/build-sky-guide.py; sources: docs/sky-guide.md.\n/*\n' + licenses + '\n*/\nconst SKY_GUIDE_DATA=' + encode(data) + ';\n'
if not out.exists() or out.read_text() != content:
    out.write_text(content)
print(f"Sky guide {data['revision']}: {len(stars)} stars, 88 constellations, {len(media)} images, videos and visualizations")
