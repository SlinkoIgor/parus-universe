"""Compact published stellar ages for Hipparcos stars.

Sources, all individual isochrone ages keyed by the authors' own HIP numbers:
Casagrande et al. 2011 (J/A+A/530/A138, Geneva-Copenhagen re-analysis, FGK
dwarfs and subgiants), David & Hillenbrand 2015 (J/ApJ/804/146, B-F stars) and
Luck 2015 (J/AJ/150/88, G and K giants). Only identifiers and the published age
statistics are kept; nothing is derived or averaged here. Offline by default,
`--download` refreshes the raw snapshots in `raw/`.
"""
import hashlib
import json
import ssl
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'data-tools/raw'
OUT = ROOT / 'data-tools/star-ages.json'
HOST = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?'
TABLES = {
    'casagrande2011': {
        'file': 'star-ages-casagrande2011.tsv',
        'query': {
            '-source': 'J/A+A/530/A138/catalog',
            '-out': 'HIP,Name,m_Name,pedig,ageEB,age16B,ageMB,age84B,ageEP,age16P,age84P',
            '-out.max': 'unlimited',
        },
    },
    'david2015': {
        'file': 'star-ages-david2015.tsv',
        'query': {
            '-source': 'J/ApJ/804/146/table5',
            '-out': 'HIP,Agemed,Age68lo,Age68up,Age68t,Agemod,Ageavg',
            '-out.max': 'unlimited',
        },
    },
    'luck2015': {
        'file': 'star-ages-luck2015.tsv',
        'query': {
            '-source': 'J/AJ/150/88/table2',
            '-out': 'Name,BAge,DAge,YAge,<Age>',
            '-out.max': 'unlimited',
        },
    },
    'luck2015names': {
        'file': 'star-ages-luck2015-names.tsv',
        'query': {
            '-source': 'J/AJ/150/88/table1',
            '-out': 'Name,HD,HIP,HR,SpT',
            '-out.max': 'unlimited',
        },
    },
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download():
    ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    for table in TABLES.values():
        path = RAW / table['file']
        url = HOST + urlencode(table['query'])
        body = urlopen(url, context=ctx, timeout=600).read()
        assert b'#END#' not in body[:200] and len(body) > 10000, (table['file'], len(body))
        path.write_bytes(body)
        meta = {'url': url, 'query': table['query'], 'sha256': sha(path), 'bytes': path.stat().st_size,
                'retrieved': date.today().isoformat()}
        path.with_suffix('.source.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')


def read(key):
    lines = [line for line in (RAW / TABLES[key]['file']).read_text().splitlines() if not line.startswith('#')]
    start = next(i for i, line in enumerate(lines) if line.strip())
    header = [name.strip() for name in lines[start].split('\t')]
    units = [unit.strip() for unit in lines[start + 1].split('\t')] + [''] * len(header)
    assert set(lines[start + 2].replace('\t', '')) == {'-'}, lines[start + 2]
    rows = []
    for line in lines[start + 3:]:
        if not line.strip():
            continue
        values = [value.strip() for value in line.split('\t')]
        assert len(values) == len(header), line
        rows.append(dict(zip(header, values)))
    return rows, dict(zip(header, units))


def number(value):
    return float(value) if value else None


def myr(value, unit):
    if value is None:
        return None
    return int(round(value * {'Gyr': 1000, 'Myr': 1}[unit]))


def main():
    if '--download' in sys.argv:
        download()
    casagrande, units = read('casagrande2011')
    assert all(units[k] == 'Gyr' for k in ('ageEB', 'age16B', 'ageMB', 'age84B', 'ageEP', 'age16P', 'age84P')), units
    c_rows = []
    c_skipped = {'noHip': 0, 'noAge': 0}
    for q in casagrande:
        if not q['HIP']:
            c_skipped['noHip'] += 1
            continue
        values = [number(q[k]) for k in ('ageEB', 'age16B', 'ageMB', 'age84B', 'ageEP', 'age16P', 'age84P')]
        if values[0] is None or values[1] is None or values[3] is None:
            c_skipped['noAge'] += 1
            continue
        c_rows.append([int(q['HIP']), *[myr(v, 'Gyr') for v in values], q['m_Name'], q['pedig']])
    david, units = read('david2015')
    assert all(units[k] == 'Myr' for k in ('Agemed', 'Age68lo', 'Age68up', 'Agemod', 'Ageavg')), units
    d_rows = []
    d_skipped = {'noAge': 0}
    for q in david:
        values = [number(q[k]) for k in ('Agemed', 'Age68lo', 'Age68up')]
        if None in values:
            d_skipped['noAge'] += 1
            continue
        d_rows.append([int(q['HIP']), *[myr(v, 'Myr') for v in values], int(q['Age68t'] or 0),
                       myr(number(q['Agemod']), 'Myr'), myr(number(q['Ageavg']), 'Myr')])
    luck, units = read('luck2015')
    assert all(units[k] == 'Gyr' for k in ('BAge', 'DAge', 'YAge', '<Age>')), units
    names, _ = read('luck2015names')
    hip_by_name = {}
    for q in names:
        hip_by_name.setdefault(q['Name'], set()).add(q['HIP'])
    l_rows = []
    l_skipped = {'noHip': 0, 'noAge': 0, 'ambiguousName': 0}
    for q in luck:
        hips = hip_by_name.get(q['Name'], set())
        if len(hips) != 1:
            l_skipped['ambiguousName'] += 1
            continue
        hip = next(iter(hips))
        if not hip:
            l_skipped['noHip'] += 1
            continue
        values = [number(q[k]) for k in ('<Age>', 'BAge', 'DAge', 'YAge')]
        if values[0] is None:
            l_skipped['noAge'] += 1
            continue
        l_rows.append([int(hip), *[myr(v, 'Gyr') for v in values]])
    for rows in (c_rows, d_rows, l_rows):
        rows.sort(key=lambda r: (r[0], r[1:3]))
    sources = {}
    for table in TABLES.values():
        path = RAW / table['file']
        meta = path.with_suffix('.source.json')
        sources[table['file']] = json.loads(meta.read_text()) if meta.exists() else {}
        sources[table['file']]['sha256'] = sha(path)
    data = {
        'units': 'Ages in Myr, converted from the published Gyr (Casagrande, Luck) or kept as published Myr (David).',
        'identity': 'Hipparcos numbers as published by each catalogue; no positional or name matching.',
        'sources': sources,
        'casagrande2011': {
            'catalog': 'Casagrande et al. 2011, A&A 530, A138: Geneva-Copenhagen survey re-analysis',
            'url': 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/530/A138',
            'bibcode': '2011A&A...530A.138C',
            'method': 'Bayesian isochrone ages from Hipparcos parallaxes, IRFM temperatures and photometric metallicities; BASTI and Padova isochrones.',
            'statistics': 'Expectation, 16%, median and 84% of the age probability distribution for BASTI (EB, 16B, MB, 84B) and expectation, 16%, 84% for Padova (EP, 16P, 84P).',
            'columns': ['hip', 'ageEB', 'age16B', 'ageMB', 'age84B', 'ageEP', 'age16P', 'age84P', 'photometryComponents', 'pedigree'],
            'input': len(casagrande),
            'skipped': c_skipped,
            'rows': c_rows,
        },
        'david2015': {
            'catalog': 'David & Hillenbrand 2015, ApJ 804, 146, table 5: nearby B-F field stars',
            'url': 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/804/146',
            'bibcode': '2015ApJ...804..146D',
            'method': 'Bayesian isochrone ages from uvby-beta effective temperature and surface gravity; solar composition assumed.',
            'statistics': 'Median and 68% interval of the 1D posterior; Age68t is the true probability contained in that interval, percent.',
            'columns': ['hip', 'median', 'lower68', 'upper68', 'interval68True', 'mode', 'mean'],
            'input': len(david),
            'skipped': d_skipped,
            'rows': d_rows,
        },
        'luck2015': {
            'catalog': 'Luck 2015, AJ 150, 88, tables 1-2: G and K giants of the local region',
            'url': 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/150/88',
            'bibcode': '2015AJ....150...88L',
            'method': 'Isochrone ages from temperature and luminosity with three isochrone sets (Bertelli 1994, Dotter 2008, Demarque 2004); no formal uncertainty is published.',
            'statistics': 'Published mean of the available determinations and the individual Bertelli, Dotter and Demarque ages.',
            'columns': ['hip', 'mean', 'bertelli', 'dotter', 'demarque'],
            'input': len(luck),
            'skipped': l_skipped,
            'rows': l_rows,
        },
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('casagrande', len(c_rows), c_skipped, 'david', len(d_rows), d_skipped, 'luck', len(l_rows), l_skipped)


main()
