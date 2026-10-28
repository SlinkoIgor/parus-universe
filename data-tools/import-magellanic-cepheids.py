"""Reproducible OGLE 2016 Table 3 import; --download refreshes the snapshot."""
from pathlib import Path
import collections, hashlib, json, math, sys

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_str/table3.dat'
path = ROOT / 'data-tools/raw/ogle-magellanic-table3.dat'
if '--download' in sys.argv:
    from urllib.request import urlopen
    import ssl
    path.write_bytes(urlopen(URL, context=ssl.create_default_context(cafile='/etc/ssl/cert.pem'), timeout=120).read())

def sex(value, hours=False):
    a,b,c = map(float,value.split(':'))
    return (-1 if value.startswith('-') else 1)*(abs(a)+b/60+c/3600)*(15 if hours else 1)

rows = []
for line in path.read_text().splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    q = line.split()
    if len(q) != 19 or q[0] not in ('LMC','SMC','MBR'):
        raise ValueError('Unexpected OGLE Table 3 schema')
    d,error = map(float,q[9:11])
    assert math.isfinite(d) and math.isfinite(error) and d>0 and error>0
    rows.append(dict(id=q[1].lower(),name=q[1],location=q[0],host={'LMC':'lmc','SMC':'smc','MBR':None}[q[0]],
                     raDeg=sex(q[7],True),decDeg=sex(q[8]),distanceKpc=d,distanceErrorKpc=error,
                     mode=q[2],periodDays=float(q[3]),magV=float(q[5]),ageMyr=float(q[17])))
assert len({r['id'] for r in rows}) == len(rows)
result = dict(source=URL,paper='https://arxiv.org/abs/1602.09141',
              selection='All published Table 3 distances: 4222 LMC, 4654 SMC, 9 Bridge; no host-distance substitution or random depths.',
              rawSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),counts=dict(collections.Counter(r['location'] for r in rows)),objects=rows)
(ROOT/'data-tools/magellanic-cepheids.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(result['counts'])
