#!/usr/bin/env python3
"""Build an independent spatial index from immutable rows and a frozen profile.
Rows retain their ordinary coordinates and science fields byte-for-byte in JSON
value. Only index boxes/splits use the alternate anchor positions. Runtime uses
the same JS projection, even for original atlas tiles and saved/pinned objects.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import collections, gzip, hashlib, json, math, os, shutil, subprocess, tempfile
ROOT=Path(__file__).resolve().parent.parent
os.chdir(ROOT)
DIST=ROOT/'dist'
def read(p): return json.loads(p.read_text())
def text(v): return json.dumps(v,ensure_ascii=False,separators=(',', ':'),allow_nan=False)+'\n'
source=DIST/read(DIST/'catalog-data/current.json')['dataRoot']
original=read(source/'manifest.json')
current=read(ROOT/'data-tools/map-radial-current.json')
dependencies=['data-tools/build-map-radial.py','data-tools/project-radial-layout.mjs','data-tools/map-radial-catalog.mjs','data-tools/map-radial-current.json',current['profile'],current['anchors'],'dist/map-radial.js','dist/map-layout.js']
revision=hashlib.sha256(original['revision'].encode()+b''.join((ROOT/p).read_bytes() for p in dependencies)).hexdigest()[:12]
root='map-radial/'+revision
final=DIST/root
with tempfile.TemporaryDirectory(prefix='parus-radial-') as tmp:
    placement=Path(tmp)/'positions.json'
    node='/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'
    subprocess.run([node,'data-tools/project-radial-layout.mjs',str(placement)],check=True)
    result=read(placement)
positions=result['placements']
DIST.joinpath('map-radial').mkdir(exist_ok=True)
out=Path(tempfile.mkdtemp(prefix='.'+revision+'-',dir=DIST/'map-radial'))
def write(file,v): (out/file).write_text(text(v))
with ThreadPoolExecutor(max_workers=8) as pool:
    rows=[r for batch in pool.map(lambda n:read(source/n['file']),[n for n in original['nodes'] if not n['children']]) for r in batch]
def xy(r):
    p=positions[r[0]]['position'];return p['x'],p['y']
def extent(r):
    e=r[11];area=e.get('regionData')
    if area:return max(area['major'],area['minor'])/2
    if (e.get('diameterLy') or 0)>0 and not e.get('sizeEstimated') and not e.get('sizeUnknown'):return e['diameterLy']/2
    if (e.get('angularMajorArcmin') or 0)>0:return r[3]*math.tan(e['angularMajorArcmin']*math.pi/21600)
    radii=[(d.get('halfNumberRadiusPc') or 0) for d in [e.get('catalogData',{})]+[m.get('data',{}) for m in e.get('catalogMeasurements',[])]]
    return max(radii,default=0)*3.261563777
# Stable hash sampling of actual rows, as in the ordinary catalogue.
def rank(r):
    category=r[11].get('catalogClass',r[2]);weights={'void':100,'structure':20,'wall':20,'ring':20,'arc':20,'galaxy-cluster':5,'galaxy':1,'cluster':.03,'stellar-cluster':.03,'pulsar':.02,'star':.001}
    weight=2 if r[11].get('cosmicSubtype')=='filament' else weights.get(category,1)
    value=(int.from_bytes(hashlib.sha256(r[0].encode()).digest()[:8],'big')+.5)/2**64
    return -math.log(value)/weight,r[0]
coords={r[0]:xy(r) for r in rows}
footprints={r[0]:extent(r) for r in rows}
def tree(batch,nodes,structural=False):
    ident=len(nodes);points=[coords[r[0]] for r in batch]
    if structural:
        boxes=[(x-footprints[r[0]],y-footprints[r[0]],x+footprints[r[0]],y+footprints[r[0]]) for r,(x,y) in zip(batch,points)]
        box=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
    else:box=[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]
    n={'box':box,'count':len(batch),'children':[]};nodes.append(n)
    if not structural:
        envelopes={}
        for r,(x,y) in zip(batch,points):
            radius=footprints[r[0]]
            if not radius:continue
            size=2**math.floor(math.log2(max(1,2*radius)));b=[x-radius,y-radius,x+radius,y+radius]
            if size in envelopes:
                a=envelopes[size];b=[min(a[0],b[0]),min(a[1],b[1]),max(a[2],b[2]),max(a[3],b[3])]
            envelopes[size]=b
        if envelopes:n['geometryBoxes']=[[s,*b] for s,b in sorted(envelopes.items())]
    if len(batch)>(128 if structural else 256):
        axis=0 if box[2]-box[0]>=box[3]-box[1] else 1
        ordered=sorted(batch,key=lambda r:(coords[r[0]][axis],r[0]));mid=len(batch)//2
        n['children']=[tree(ordered[:mid],nodes,structural),tree(ordered[mid:],nodes,structural)]
    if not structural or not n['children']:
        name=('layer-' if structural else 'point-')+str(ident)+'.json'
        n['file']=name if structural else root+'/'+name
        write(name,sorted(batch,key=rank)[:48] if n['children'] else batch)
    return ident
nodes=[];roots=[tree(rows,nodes)]
base={'version':1,'revision':revision,'catalogRevision':original['revision'],'geometryVersion':result['geometryVersion'],'profileKey':result['profileKey'],'dataRoot':root}
write('manifest.json',{**base,'mapRows':len(rows),'nodes':nodes,'roots':roots,'sampling':original['sampling']})
groups=collections.defaultdict(list)
for r in rows:
    category=r[11].get('cosmicSubtype') or r[11].get('catalogClass') or r[2]
    if category=='cluster':category='stellar-cluster'
    if category in ['filament','galaxy-cluster','stellar-cluster','nebula','supercluster','void']:groups[category].append(r)
layers=[];layerroots={k:tree(v,layers,True) for k,v in sorted(groups.items())}
write('layers.json',{**base,'nodes':layers,'roots':layerroots,'counts':{k:len(v) for k,v in sorted(groups.items())}})
write('audit-summary.json',{**base,'rules':result['counts'],'warnings':result['warnings'],'anchorChildren':result['parents'],'distanceDomains':result.get('domains',{}),'sourceSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in dependencies}})
with (out/'placements.json.gz').open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as gz:gz.write(text(positions).encode())
if final.exists():
    def hashes(folder):return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.iterdir()}
    if hashes(final)!=hashes(out):raise RuntimeError('Immutable radial revision collision '+revision)
    shutil.rmtree(out)
else:os.replace(out,final)
runtime="'use strict';\n// Generated from versioned profile and frozen anchors. Do not edit.\nconst RADIAL_DATA="+text(result['runtimeData']).rstrip()+';\n'
for target,content in [(DIST/'map-radial-data.js',runtime),(DIST/'map-radial/current.json',text({'revision':revision,'dataRoot':root}))]:
    temporary=target.with_suffix(target.suffix+'.tmp')
    temporary.write_text(content);os.replace(temporary,target)
print(text({'revision':revision,'mapRows':len(rows),'layers':{k:len(v) for k,v in groups.items()}}))
