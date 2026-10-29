#!/usr/bin/env python3
"""Independent published-coordinate, distance and cross-ID regressions (offline)."""
from pathlib import Path
import collections, gzip, json, math, sys, tempfile

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'data-tools'))
from cosmic_merge import merge_catalogs

data = json.loads(gzip.decompress((ROOT/'data-tools/cosmic-catalogs.json.gz').read_bytes()))
audit = json.loads((ROOT/'data-tools/cosmic-catalog-audit.json').read_text())
objects = data['objects']
groups = collections.defaultdict(list)
for o in objects:
    groups[o['catalogKey']].append(o)
    assert o['referenceURL'].startswith('https://cdsarc.cds.unistra.fr/'), o['id']
    assert o['distanceLy'] is None or math.isfinite(o['distanceLy']) and o['distanceLy'] > 0, o['id']
assert len(objects) == 126163
expected = {'MCXC-II':2221, 'SDSS-Superclusters':1313, 'SDSS-Filaments':15421,
            'SDSS-Voids':635, 'Cosmicflows-4':55877, 'Nearby-Galaxies':869,
            'GLADE+':45727, 'Gaia-Clusters':4100}
assert {k:len(v) for k,v in groups.items()} == expected
assert sum(len(o['regionData']['points']) for o in groups['SDSS-Filaments']) == 275599
for o in groups['Gaia-Clusters']:
    q = o['catalogData']
    assert q['Type'] in 'omgd' and q['CST'] >= 5 and q['CMDCl50'] >= .5
    assert o['massIsSystem'] and o['catalogClass'] == 'stellar-cluster'
    assert abs(o['distanceLy']/q['dist50Pc']-3.2615637771674336)<1e-12
assert sum(o['catalogData']['Type']=='d' for o in groups['Gaia-Clusters']) == 6
for o in groups['GLADE+']:
    q=o['catalogData']
    assert q['Bmag'] <= 15.5 and q['distanceFlag']==3 and q['zhelio']>.002
    assert not o.get('massSolar'), 'stellar mass must not become orbital point mass'
for o in groups['MCXC-II']:
    assert o['massIsSystem'] and o['catalogClass']=='galaxy-cluster'
    assert o['atlasOnly'] == (o['redshiftType'] not in ('S','SP') or o['redshift']<.002)
assert all(o['hubbleType']==o['catalogData']['morphology'] and o['sizeOrientationUnknown'] for o in groups['Nearby-Galaxies'])
print('PASS source counts, strict 2024 cluster types, spectroscopic selection and aggregate-mass semantics')

# Independent sky distances to the source spine, before any cosmology remap.
# RA185/Dec32.5 is the +survey-Y direction; +survey-X points to RA95/Dec0.
def equ(p):
    x,y,z=p; inc=math.radians(32.5); node=math.radians(185)
    u=y*math.cos(inc)-z*math.sin(inc)
    return [u*math.cos(node)+x*math.sin(node),
            u*math.sin(node)-x*math.cos(node), y*math.sin(inc)+z*math.cos(inc)]
def sky(ra,dec,d):
    a,b=map(math.radians,(ra,dec))
    return [d*math.cos(b)*math.cos(a),d*math.cos(b)*math.sin(a),d*math.sin(b)]
assert math.dist(equ([0,1,0]),sky(185,32.5,1))<1e-14
assert math.dist(equ([1,0,0]),sky(95,0,1))<1e-14
def distance_to_segment(p,a,b):
    v=[y-x for x,y in zip(a,b)]; w=[y-x for x,y in zip(a,p)]
    t=max(0,min(1,sum(x*y for x,y in zip(v,w))/sum(x*x for x in v)))
    return math.sqrt(sum((x-t*y)**2 for x,y in zip(w,v)))
residual=[]
for sample in audit['filamentFrameChecks'].values():
    line=[equ(p) for p in sample['spineSDSS']]
    for g in sample['galaxies']:
        p=sky(g['raDeg'],g['decDeg'],g['DcorMpcH'])
        d=min(distance_to_segment(p,a,b) for a,b in zip(line,line[1:]))
        residual.append(abs(d-g['publishedMpcH']))
assert len(residual)==120 and max(residual)<.0012, max(residual)
print('PASS 120 independent published galaxy-to-filament distances; no mirrored SDSS axis')

# Different integration algorithm and inverse solve from the importer's lookup.
MPC=3261563.7771674336
def dc(z,om=.3):
    n=2048; h=z/n
    f=lambda t:1/math.sqrt(om*(1+t)**3+1-om)
    return 299792.458/70*h/3*(f(0)+f(z)+sum((4 if i%2 else 2)*f(i*h) for i in range(1,n)))
def inverse(value,luminosity=False,om=.3):
    lo,hi=0.,10.
    for _ in range(52):
        mid=(lo+hi)/2; d=dc(mid,om)*(1+mid if luminosity else 1)
        if d<value:lo=mid
        else:hi=mid
    return (lo+hi)/2
for o in groups['MCXC-II'][::251]+groups['GLADE+'][::7001]:
    assert abs(o['distanceLy']/MPC-dc(o['redshift']))<.00003
for o in groups['Cosmicflows-4'][::7001]:
    dl=10**((o['catalogData']['DM']-25)/5)
    expected=dc(inverse(dl,True))
    assert abs(o['distanceLy']/MPC-expected)<.00007
    assert o['sizeUnknown'] and not o.get('regionData')
    if o['catalogData']['e_DM'] is not None:
        assert o['atlasOnly'] == (max(o['distanceErrorPlusLy'],o['distanceErrorMinusLy'])/o['distanceLy']>.5)
for o in groups['SDSS-Superclusters'][::151]:
    q=o['catalogData']; z=inverse(q['Dist2MpcH']/.7,om=.27)
    assert abs(o['distanceLy']/MPC-dc(z))<.00005
print('PASS independent Simpson integrals, luminosity/comoving inversion, source h and cosmology conversion')

# Exercise the real merge with several independent IDs; not one exceptional object.
def row(i,name,ra,d,aliases=None,atlas=False,kind='galaxy',extra=None):
    return [i,name,kind,d,ra,0,'approximate','old',aliases or [name],None,'Old',
            {'atlasOnly':atlas,**(extra or {})},None if atlas else d,None if atlas else 0]
def obj(i,name,ra,d,source='Cosmicflows-4',kind='galaxy',aliases=None,extra=None):
    return {'id':i,'name':name,'raDeg':ra,'decDeg':0,'distanceLy':d,'kind':kind,
            'aliases':aliases or [name],'catalogKey':source,'referenceURL':'https://example.org/source',
            'distanceMethod':'individual measured distance',**(extra or {})}
fixture=[obj('new-'+str(i),'PGC '+str(i),i,100+i) for i in (1,2,3)]
fixture += [obj('bad-pgc','PGC 99',4,110,aliases=['NGC 44','PGC 99']),
            obj('bad-sky','PGC 4',180,110),
            obj('mcxc-a','MCXC A',30,1000,'MCXC-II','cluster',['Abell 100'],{'catalogClass':'galaxy-cluster'}),
            obj('mcxc-b','MCXC B',30.01,1000,'MCXC-II','cluster',['Abell 100'],{'catalogClass':'galaxy-cluster'})]
records=[row('old-'+str(i),'PGC '+str(i),i,0,atlas=True) for i in (1,2,3)]
records += [row('old-4','NGC 44',4,100,['NGC 44','PGC 4'])]
with tempfile.TemporaryDirectory() as folder:
    root=Path(folder);(root/'data-tools').mkdir()
    snapshot={**data,'objects':fixture,'coverage':{k:{'rows':sum(o['catalogKey']==k for o in fixture),'represented':sum(o['catalogKey']==k for o in fixture)} for k in ('Cosmicflows-4','MCXC-II')}}
    (root/'data-tools/cosmic-catalogs.json.gz').write_bytes(gzip.compress(json.dumps(snapshot).encode()))
    _,result=merge_catalogs(root,[],records,{}, {},lambda ra,dec,d,kind,i:(d,0))
    assert result['promotedFromAtlas']==3
    assert all(not r[11]['atlasOnly'] and r[3]==101+i for i,r in enumerate(records[:3]))
    assert records[3][3]==100, 'existing usable anchor must not move'
    assert all(next(r for r in records if r[0]==i)[11]['atlasOnly'] for i in ('bad-pgc','bad-sky'))
    assert {r[0] for r in records} >= {'mcxc-a','mcxc-b'}, 'shared Abell is not proof of one cluster'
assert audit['coverage']['MCXC-II']['added']==2219 and audit['coverage']['MCXC-II']['merged']==2
assert len(audit['upgradedIds'])==379 and len(set(audit['upgradedIds']))==379
print('PASS systemic missing-distance enrichment, preserved anchors, conflicting PGC/sky and distinct same-source clusters')
