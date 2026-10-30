"""Offline compact snapshots for coherent astrometric errors and GC bounds.

Inputs are official I/311/hip2 HIP,Plx,e_Plx and the authors' combined_table.txt.
Keep raw files unchanged; this importer never mixes solutions or generates depth.
"""
from pathlib import Path
import json,hashlib,re,sys
ROOT=Path(__file__).resolve().parent.parent;raw=ROOT/'data-tools/raw'
if '--download' in sys.argv:
    from urllib.request import urlopen
    from urllib.parse import urlencode
    import ssl
    ctx=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    urls={'hip2-errors.tsv':'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?'+urlencode({'-source':'I/311/hip2','-out':'HIP,Plx,e_Plx','-out.max':'unlimited'}),'gc-combined.txt':'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/combined_table.txt'}
    for name,url in urls.items():(raw/name).write_bytes(urlopen(url,context=ctx,timeout=120).read())
rows={}
for line in (raw/'hip2-errors.tsv').read_text().splitlines():
    q=line.split('\t')
    if len(q)==3 and q[0].strip().isdigit():rows[str(int(q[0]))]=list(map(float,q[1:]))
assert len(rows)==117955,len(rows)
data={'source':'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311','catalog':'van Leeuwen 2007 Hipparcos I/311','units':'mas','columns':['Plx','e_Plx'],'rawSHA256':hashlib.sha256((raw/'hip2-errors.tsv').read_bytes()).hexdigest(),'rows':rows}
(ROOT/'data-tools/hipparcos-2007.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
clusters={}
for line in (raw/'gc-combined.txt').read_text().splitlines():
    if line.startswith('#') or not line.strip():continue
    q=line.split();key=re.sub('[^a-z0-9]','',q[0].lower())
    clusters[key]={'name':q[0].replace('_',' '),'raDeg':float(q[1]),'decDeg':float(q[2]),'distanceKpc':float(q[3]),'distanceErrorKpc':float(q[4]),'halfLightRadiusPc':float(q[16]),'tidalRadiusPc':float(q[18])}
assert len(clusters)>150
data={'source':'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/parameter.html','rawURL':'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/combined_table.txt','paper':'https://doi.org/10.1093/mnras/stab1474','note':'Author compilation, distances mostly Baumgardt & Vasiliev 2021; tidal radii from N-body models. These are host constraints, not individual pulsar depths.','rawSHA256':hashlib.sha256((raw/'gc-combined.txt').read_bytes()).hexdigest(),'clusters':clusters}
(ROOT/'data-tools/globular-cluster-models.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
print('HIP2007',len(rows),'GC models',len(clusters))
