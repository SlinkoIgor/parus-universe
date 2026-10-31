#!/usr/bin/env python3
"""Compare two placements.json.gz snapshots; optionally require additive stability."""
import argparse, gzip, json, math
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('old',type=Path);p.add_argument('new',type=Path)
p.add_argument('--require-stable-existing',action='store_true')
p.add_argument('--output',type=Path)
a=p.parse_args()
def read(path):
    if path.is_dir():path=path/'placements.json.gz'
    with (gzip.open(path,'rt') if path.suffix=='.gz' else path.open()) as f:return json.load(f)
old,new=read(a.old),read(a.new);common=old.keys()&new.keys();moves=[];changed_rules=[]
for k in sorted(common):
    x,y=old[k],new[k];distance=math.hypot(x['position']['x']-y['position']['x'],x['position']['y']-y['position']['y'])
    if distance>1e-6:moves.append({'id':k,'shiftLy':distance,'oldParent':x.get('parent'),'newParent':y.get('parent')})
    if any(x.get(f)!=y.get(f) for f in ['parent','frame','rule','warning']):changed_rules.append(k)
report={'common':len(common),'added':len(new.keys()-old.keys()),'removed':len(old.keys()-new.keys()),'moved':len(moves),'changedDecisions':len(changed_rules),'largestShifts':sorted(moves,key=lambda r:(-r['shiftLy'],r['id']))[:30],'changedDecisionExamples':changed_rules[:30]}
content=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
if a.output:a.output.write_text(content)
print(content)
if a.require_stable_existing and (moves or changed_rules):raise SystemExit('Existing placements changed; review profile or measurement revision')
