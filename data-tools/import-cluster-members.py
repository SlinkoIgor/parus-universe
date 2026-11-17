"""Compact published open-cluster membership for Hipparcos stars.

Inputs: Hunt & Reffert 2024 member table (J/A+A/686/A42/members) and the
official Gaia DR3 hipparcos2_best_neighbour cross-match. Only identifiers,
membership probabilities and Gaia parallaxes are kept; depths are not derived
here. Offline by default, `--download` refreshes the raw snapshots.
"""
import csv
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
OUT = ROOT / 'data-tools/cluster-members.json'
MEMBERS = RAW / 'hunt-members-bright.tsv'
CROSSMATCH = RAW / 'gaia-dr3-hip2-best-neighbour.csv'
G_LIMIT = 13.0
MEMBERS_QUERY = {
    '-source': 'J/A+A/686/A42/members',
    '-out': 'Name,ID,GaiaDR3,Prob,Plx,e_Plx,Gmag',
    '-out.max': 'unlimited',
    'Gmag': '<%g' % G_LIMIT,
}
MEMBERS_URL = 'https://vizier.idia.ac.za/viz-bin/asu-tsv?' + urlencode(MEMBERS_QUERY)
CROSSMATCH_QUERY = (
    'SELECT source_id, original_ext_source_id, angular_distance, '
    'number_of_neighbours, xm_flag FROM gaiadr3.hipparcos2_best_neighbour'
)
CROSSMATCH_URL = 'https://gea.esac.esa.int/tap-server/tap/sync'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download():
    ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    MEMBERS.write_bytes(urlopen(MEMBERS_URL, context=ctx, timeout=600).read())
    body = urlencode({
        'REQUEST': 'doQuery',
        'LANG': 'ADQL',
        'FORMAT': 'csv',
        'MAXREC': '200000',
        'QUERY': CROSSMATCH_QUERY,
    }).encode()
    CROSSMATCH.write_bytes(urlopen(CROSSMATCH_URL, body, context=ctx, timeout=600).read())
    for path, url, query in [(MEMBERS, MEMBERS_URL, MEMBERS_QUERY), (CROSSMATCH, CROSSMATCH_URL, CROSSMATCH_QUERY)]:
        meta = {'url': url, 'query': query, 'sha256': sha(path), 'bytes': path.stat().st_size, 'retrieved': date.today().isoformat()}
        path.with_suffix('.source.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')


def read_members():
    rows = []
    for line in MEMBERS.read_text().splitlines():
        if line.startswith('#') or not line.strip():
            continue
        q = [v.strip() for v in line.split('\t')]
        if len(q) < 7 or not q[2].isdigit():
            continue
        rows.append({
            'clusterName': q[0].replace('_', ' '),
            'clusterId': int(q[1]),
            'gaia': q[2],
            'probability': float(q[3]),
            'gaiaParallaxMas': float(q[4]),
            'gaiaParallaxErrorMas': float(q[5]),
            'gmag': float(q[6]),
        })
    return rows


def read_crossmatch():
    best = {}
    with CROSSMATCH.open() as f:
        for q in csv.DictReader(f):
            best[q['source_id']] = {
                'hip': str(int(q['original_ext_source_id'])),
                'angularDistanceMas': float(q['angular_distance']),
                'neighbours': int(q['number_of_neighbours']),
                'xmFlag': int(q['xm_flag']),
            }
    return best


def main():
    if '--download' in sys.argv:
        download()
    members = read_members()
    best = read_crossmatch()
    assert len(best) == 99525, len(best)
    assert len(members) > 7000, len(members)
    joined = [{**m, **best[m['gaia']]} for m in members if m['gaia'] in best]
    per_hip = {}
    for m in joined:
        per_hip.setdefault(m['hip'], []).append(m)
    rows = sorted((m for group in per_hip.values() if len(group) == 1 for m in group), key=lambda m: int(m['hip']))
    ambiguous = sorted(hip for hip, group in per_hip.items() if len(group) > 1)
    sources = {}
    for path in (MEMBERS, CROSSMATCH):
        meta = path.with_suffix('.source.json')
        sources[path.name] = json.loads(meta.read_text()) if meta.exists() else {'sha256': sha(path)}
        sources[path.name]['sha256'] = sha(path)
    data = {
        'membershipCatalog': 'Hunt & Reffert 2024, A&A 686, A42, table 2 (members)',
        'membershipURL': 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/686/A42',
        'crossmatch': 'Gaia DR3 hipparcos2_best_neighbour (Marrese et al. 2019 algorithm)',
        'crossmatchURL': 'https://gea.esac.esa.int/archive/documentation/GDR3/Gaia_archive/chap_datamodel/sec_dm_crossmatches/ssec_dm_hipparcos2_best_neighbour.html',
        'selection': 'Members with Gaia G<%g (covers the Hipparcos magnitude range) that have a Hipparcos-2 best neighbour. A HIP assigned to several Gaia sources or clusters is excluded as ambiguous.' % G_LIMIT,
        'units': {'gaiaParallaxMas': 'mas', 'angularDistanceMas': 'mas', 'gmag': 'mag'},
        'sources': sources,
        'inputMembers': len(members),
        'withHipparcos': len(joined),
        'ambiguousHip': ambiguous,
        'columns': ['hip', 'gaia', 'clusterId', 'clusterName', 'probability', 'gaiaParallaxMas', 'gaiaParallaxErrorMas', 'gmag', 'angularDistanceMas', 'neighbours', 'xmFlag'],
        'rows': [[m[k] for k in ('hip', 'gaia', 'clusterId', 'clusterName', 'probability', 'gaiaParallaxMas', 'gaiaParallaxErrorMas', 'gmag', 'angularDistanceMas', 'neighbours', 'xmFlag')] for m in rows],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('members', len(members), 'with HIP', len(joined), 'kept', len(rows), 'ambiguous HIP', len(ambiguous))


main()
