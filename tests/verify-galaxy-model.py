"""Check geometric constraints and the policy at its actual boundaries."""
import sys,json,math
from pathlib import Path
sys.dont_write_bytecode=True;sys.path.insert(0,str(Path('data-tools').resolve()))
from disk_geometry import intersection,locate,unit,dot,PC
policy=json.loads(Path('data-tools/coordinate-policy.json').read_text());models=json.loads(Path('data-tools/galaxy-disk-models.json').read_text());catalog=json.loads(Path('data-tools/galaxy-disk-objects.json').read_text())
assert len(catalog['objects'])==4925
assert sum(o['id'].startswith('phat-ap-') for o in catalog['objects'])==2753
for member in catalog['objects']:
 assert math.isfinite(member['raDeg']) and math.isfinite(member['decDeg'])
 if member['id'].startswith('lggs-'):assert 'Mm=1' in member['membership']
 if member['id'].startswith('m33-snr-'):assert 'Conf=yes' in member['membership']
for ra,dec in [(10.7,41.3),(10,41.0),(11.0,41.5)]:
 p=intersection(ra,dec,10.6847,41.26875,2.5e6,77,38)
 assert abs(dot(p['normal'],p['delta']))<1e-8
 v=unit(ra,dec);assert max(abs(p['point'][j]/p['distance']-v[j]) for j in range(3))<1e-14
# Positive minor-axis direction is the known near side for M31.
near=intersection(10.6747,41.27875,10.6847,41.26875,2.5e6,77,38)
assert near['distance']<2.5e6
host={'raDeg':10.6847,'decDeg':41.26875,'d':2.5e6};member={'raDeg':10.7,'decDeg':41.3,'placement':'disk'}
p=locate(member,host,models['andromeda'],policy);assert p['accepted'] and p['mode']=='host-disk'
strict={**policy,'hostMaxLocalEnvelopeFraction':p['localEnvelopeLy']/p['referenceScaleLy']*.99}
assert not locate(member,host,models['andromeda'],strict)['accepted']
unresolved=locate({**member,'placement':'host-envelope'},host,models['andromeda'],policy)
assert unresolved['localEnvelopeLy']==35000*PC and not unresolved['accepted']
outside=locate({**member,'raDeg':30},host,models['andromeda'],policy);assert outside is None or not outside['accepted']
print('PASS observed membership selection, inclined-plane geometry, near side and policy boundaries')
