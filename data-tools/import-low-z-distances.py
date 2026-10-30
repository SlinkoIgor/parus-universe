"""Select explicit redshift-independent measurements from the SIMBAD snapshot.

No network. Unknown methods, galaxy parallaxes and flow/kinematic/redshift
distances do not establish an independent point. Retain every decision.
"""
from pathlib import Path
import json,re,collections,hashlib,sys
ROOT=Path(__file__).resolve().parent.parent;path=ROOT/'data-tools/raw/low-z-galaxy-distances.json';raw=json.loads(path.read_text())
if '--download' in sys.argv:
    from urllib.request import urlopen,Request
    from urllib.parse import urlencode
    import ssl
    body=urlencode(dict(request='doQuery',lang='adql',format='json',query=raw['adql'])).encode()
    fresh=json.loads(urlopen(Request('https://simbad.cds.unistra.fr/simbad/sim-tap/sync',data=body),context=ssl.create_default_context(cafile='/etc/ssl/cert.pem'),timeout=120).read())
    fresh.update(requestedTargets=raw['requestedTargets'],adql=raw['adql']);raw=fresh;path.write_text(json.dumps(raw))
def key(s):return re.sub(r'^(ngc|ic)0+',r'\1',re.sub('[^a-z0-9]','',s.lower()))
rank={'EB':0,'Cep':1,'Ceph':1,'T-RGB':2,'TRGB':2,'SBF':3,'SN':4,'PNLF':5,'T-F':6}
groups=collections.defaultdict(list)
for row in raw['data']:groups[key(row[0])].append(row)
objects={}
for target in raw['requestedTargets']:
    candidates=[]
    for r in groups[key(target)]:
        name,value,unit,method,bib,minus,plus,quality=r;unit=unit.strip();method=(method or '').strip()
        if method not in rank or unit not in ('Mpc','kpc','pc') or value is None or value<=0:continue
        factor={'Mpc':1,'kpc':.001,'pc':.000001}[unit];d=value*factor;errors=[abs(v)*factor for v in [minus,plus] if v is not None]
        if errors and max(errors)/d>.5:continue
        candidates.append((rank[method],-int(bib[:4]),bib,dict(lookup=target,status='measured',measurementsAvailable=len(groups[key(target)]),distanceMpc=d,method=method,reference=bib,referenceUrl='https://ui.adsabs.harvard.edu/abs/'+bib+'/abstract',sourceIdentifier=name,originalValue=value,originalUnit=unit,errorMinusMpc=abs(minus)*factor if minus is not None else None,errorPlusMpc=abs(plus)*factor if plus is not None else None,redshiftIndependent=True)))
    objects[target]=min(candidates,key=lambda r:r[:3])[3] if candidates else dict(lookup=target,status='unresolved',measurementsAvailable=len(groups[key(target)]),reason='No explicit accepted redshift-independent measurement with usable range. Do not turn a low redshift into a reliable distance.')
data=dict(source='CDS/SIMBAD mesDistance',endpoint='https://simbad.cds.unistra.fr/simbad/sim-tap/sync',license='ODbL',selection='All unresolved OpenNGC galaxy entries with 0<z<0.002. Explicit EB/Cepheid/TRGB/SBF/SN/PNLF/T-F only; method tier then latest bibcode; published relative errors <=0.5 when available. No galaxy parallax, flow, redshift, unknown method or unverified T-RDB abbreviation.',rawSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),adql=raw['adql'],objects=objects)
(ROOT/'data-tools/low-z-galaxy-distances.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(collections.Counter(v['status'] for v in objects.values()))
