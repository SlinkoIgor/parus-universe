"""Offline geometry/provenance diagnostics. Does not alter catalog coordinates.

Usage: python3 data-tools/audit-map-geometry.py [--root REPOSITORY]
The report records suspicious shapes, not automatic astronomical exclusions.
Only leaf tiles are counted; parent samples deliberately repeat their children.
"""
import argparse,collections,csv,hashlib,json,math,re,shutil,subprocess
from pathlib import Path

PC=3.2615637771674336
def span(angles):
    a=sorted(x%(2*math.pi) for x in angles)
    return 0 if len(a)<2 else 2*math.pi-max(b-a for a,b in zip(a,a[1:]+[a[0]+2*math.pi]))
def xyz(r):
    a,b=map(math.radians,r[4:6]);d=r[3]
    return [d*math.cos(a)*math.cos(b),d*math.sin(a)*math.cos(b),d*math.sin(b)]
def diameter(points):
    return max((math.dist(a,b) for i,a in enumerate(points) for b in points[i+1:]),default=0)
def aspect(points):
    n=len(points);mx=sum(p[0] for p in points)/n;my=sum(p[1] for p in points)/n
    xx=sum((p[0]-mx)**2 for p in points)/n;yy=sum((p[1]-my)**2 for p in points)/n;xy=sum((p[0]-mx)*(p[1]-my) for p in points)/n
    delta=math.hypot(xx-yy,2*xy);large=(xx+yy+delta)/2;small=max(0,(xx+yy-delta)/2)
    return math.sqrt(small/large) if large else 0
def scan(root):
    pointer=root/'dist/catalog-data/current.json';folder=root/'dist'/(json.loads(pointer.read_text())['dataRoot'] if pointer.exists() else 'catalog-data');manifest=json.loads((folder/'manifest.json').read_text());rows=[]
    psr_path=root/'data-tools/raw/psrcat.db'
    if not psr_path.exists():psr_path=root.parent/'research-data/psrcat.db'
    for node in manifest['nodes']:
        if not node['children']:rows+=json.loads((folder/node['file']).read_text())
    assert len(rows)==manifest['mapRows'] and len({r[0] for r in rows})==len(rows)
    assert all(not r[11].get('atlasOnly') and all(math.isfinite(v) for v in (r[3],r[4],r[5],r[12],r[13])) for r in rows)
    byid={r[0]:r for r in rows};groups=collections.defaultdict(list)
    node=shutil.which('node') or '/opt/homebrew/bin/node'
    js="""const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','layout-data','map-layout','map-details','catalog-extended','catalog-stream'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\\n'),c);process.stdout.write(vm.runInContext('JSON.stringify({objects:OBJECTS.filter(o=>!o.atlasOnly&&o.p3).map(o=>({id:o.id,kind:o.kind,d:o.d,p3:o.p3,map:MapLayout.project(o)})),systems:EXTENDED_BOOT.systems})',c));"""
    core=json.loads(subprocess.check_output([node,'-e',js],cwd=root));core_byid={o['id']:o for o in core['objects']}
    assert all(abs(math.hypot(*o['p3'])/o['d']-1)<1e-10 for o in core['objects'] if o.get('d'))
    systems=[];confirmed_geometry=[]
    for system in core['systems']:
        if system.get('associationOnly'):continue
        members=[]
        for ident in system['members']:
            if ident in core_byid:
                o=core_byid[ident];members.append((ident,o['p3'],[o['map']['x'],o['map']['y']]))
            elif ident in byid:
                r=byid[ident]
                # Streamed sky() vectors are rotated into Galactic coordinates
                # to compare to core p3 in the same orthonormal frame.
                p=xyz(r);matrix=[[-.0548755604162154,-.873437090234885,-.4838350155487132],[.4941094278755837,-.4448296299600112,.7469822444972189],[-.8676661490190047,-.1980763734312015,.4559837761750669]]
                members.append((ident,[sum(a*b for a,b in zip(axis,p)) for axis in matrix],r[12:14]))
        if len(members)<2:continue
        real=diameter([m[1] for m in members]);drawn=diameter([m[2] for m in members]);ratio=drawn/max(1e-15,real)
        if system.get('confirmed'):confirmed_geometry.append(dict(id=system['id'],physicalDiameterLy=real,mapDiameterLy=drawn,radialRangeLy=max(math.hypot(*m[1]) for m in members)-min(math.hypot(*m[1]) for m in members),members=[m[0] for m in members]))
        if real>1e-8 and (ratio>5 or ratio<.2):systems.append(dict(id=system['id'],physicalDiameterLy=real,mapDiameterLy=drawn,ratio=ratio,members=[m[0] for m in members],note='A 2D projection may compress a genuine 3D separation; review, not proof of wrong physical positions.'))
    for r in rows:groups[(r[10],round(r[3],5))].append(r)
    shells=[]
    for (source,d),rr in groups.items():
        if len(rr)<8:continue
        annular=[r for r in rr if abs(math.hypot(r[12],r[13])/r[3]-1)<1e-8]
        shells.append(dict(source=source,distanceLy=d,count=len(rr),radiusPreservedCount=len(annular),angularSpanDeg=math.degrees(span(math.atan2(r[13],r[12]) for r in annular)),examples=[r[0] for r in rr[:8]]))
    shells.sort(key=lambda q:(-q['count'],q['source'],q['distanceLy']))
    # Hough candidates across scales. Adjacent-bin contrast limits responses to
    # smooth dense fields. Counts/aspect alone never prove a physical filament.
    bands=collections.defaultdict(list)
    for r in rows:bands[math.floor(math.log10(r[3]))].append(r)
    lines=[]
    for exponent,rr in sorted(bands.items()):
        if len(rr)<20:continue
        scale=10**(exponent+.5);width=scale*.003;best=None
        for degree in range(0,180,5):
            c,s=math.cos(math.radians(degree)),math.sin(math.radians(degree));bins=collections.defaultdict(list)
            for r in rr:bins[round((r[12]*c+r[13]*s)/width)].append(r)
            for key,subset in bins.items():
                count=len(subset)
                if count<20:continue
                neighbor=sum(len(bins.get(key+i,[])) for i in [-3,-2,-1,1,2,3])/6
                contrast=count/max(1,neighbor)
                if contrast<3:continue
                points=[r[12:14] for r in subset];ratio=aspect(points)
                if ratio>.03:continue
                candidate=dict(distanceDecade=exponent,normalAngleDeg=degree,binWidthLy=width,count=count,neighborContrast=contrast,minorMajorRmsRatio=ratio,sources=dict(collections.Counter(r[10] for r in subset)),hosts=dict(collections.Counter(r[11].get('parentGalaxy','field') for r in subset)),examples=[r[0] for r in subset[:12]])
                if best is None or candidate['count']>best['count']:best=candidate
        if best:lines.append(best)
    # ATNF associations are independent of projected shape: common membership
    # with contradictory radial estimates creates a false line in actual p3.
    cluster_groups=collections.defaultdict(list)
    for block in psr_path.read_text().split('@'):
        q={p[0]:p[1] for line in block.splitlines() if not line.startswith('#') and len(p:=line.split())>1}
        match=re.search(r'(?:^|,)GC:([^,\[]+)',q.get('ASSOC',''));ident='atnf-'+q.get('PSRJ','').lower()
        if match and ident in byid:cluster_groups[match[1]].append(byid[ident])
    cluster_checks=[]
    for host,rr in sorted(cluster_groups.items()):
        if len(rr)<2:continue
        actual=diameter([xyz(r) for r in rr]);display=diameter([r[12:14] for r in rr]);dmin=min(r[3] for r in rr);dmax=max(r[3] for r in rr)
        cluster_checks.append(dict(host=host,count=len(rr),radialRangeLy=dmax-dmin,physicalDiameterLy=actual,mapDiameterLy=display,displayStretch=display/max(1e-12,actual),minorMajorRmsRatio=aspect([r[12:14] for r in rr]),status='radial-conflict-review' if dmax-dmin>100 else 'projection-stretch-review' if display/max(1e-12,actual)>3 else 'compact',members=[dict(id=r[0],distanceLy=r[3],method=r[7]) for r in rr]))
    cluster_checks.sort(key=lambda q:-q['radialRangeLy'])
    # Check that the uncertainty belongs to the distance's astrometric solution.
    errors=json.loads((root/'data-tools/hipparcos-errors.json').read_text())['rows'];checked=0;mismatch=[];quantized=0
    for q in csv.DictReader((root/'data-tools/raw/hyg_v41.csv').open()):
        d=float(q['dist']);hip=q['hip']
        if not 0<d<100000:continue
        pi=1000/d
        if abs(pi-round(pi,2))<1e-4:quantized+=1
        if hip not in errors:continue
        checked+=1;oldpi,error=errors[hip]
        if abs(pi-oldpi)>.02:mismatch.append(dict(id='hyg-'+q['id'],hip=hip,hygDistancePc=d,impliedParallaxMas=pi,hip1997ParallaxMas=oldpi,hip1997ErrorMas=error))
    active=[];wrong=[]
    for r in rows:
        if r[10]!='HYG':continue
        e=r[11]
        if not e.get('uncertaintyMatched'):continue
        active.append(r)
        if e.get('parallaxMas') is None or abs(r[3]/PC-1000/e['parallaxMas'])>.00006 or e['parallaxErrorMas']/e['parallaxMas']>.5:wrong.append(r[0])
    sky_only=[r for r in rows if r[10]=='OpenNGC' and 'по z' in r[7] and r[3]<1e7]
    # Physical coordinates and local map coordinates are separate. For Clouds,
    # describe the actual data footprint instead of calling every hole a void.
    populations=[]
    for host in ('andromeda','triangulum','lmc','smc'):
        rr=[r for r in rows if r[11].get('parentGalaxy')==host]
        populations.append(dict(host=host,streamedMapped=len(rr),uniqueDistances=len({r[3] for r in rr}),mapMinorMajorRmsRatio=aspect([r[12:14] for r in rr]),note='Bootstrap foreground/departure stars are excluded from these leaf counts. Observed sample, not a complete population or density map.'))
    return dict(schemaVersion=1,revision=manifest['revision'],mappedLeafRows=len(rows),coreGeometry=dict(mapped=len(core['objects']),heliocentricNormMatches=True,distortedSystems=systems,confirmedSystems=confirmed_geometry,note='Static catalog/bootstrap only; 40 animated nuclear-star orbits are covered by verify-lod.mjs, not this source snapshot.'),checks=dict(uniqueLeafIds=True,finiteMapCoordinates=True,atlasOnlyInMap=0),thresholds=dict(equalDistanceRoundDecimals=5,shellMinRows=8,annulusRelativeTolerance=1e-8,clusterRadialReviewLy=100,clusterDisplayStretchReview=3,houghDistanceDecades=True,houghAngleStepDeg=5,houghWidthFraction=.003,houghMinRows=20,houghMinNeighborContrast=3,houghMaxMinorMajorRms=.03),
                shellSummary={source:dict(groups=len([g for g in shells if g['source']==source]),rows=sum(g['count'] for g in shells if g['source']==source),annularRows=sum(g['radiusPreservedCount'] for g in shells if g['source']==source)) for source in sorted({g['source'] for g in shells})},shells=shells,houghCandidates=lines,clusterGroups=cluster_checks,legacy1997Comparison=dict(checked=checked,mismatchAbove002mas=len(mismatch),examples=mismatch[:12],hygPositiveDistancesOn001masGrid=quantized,note='Historical comparison of raw HYG and I/239 only, not the active corrected sigma filter. Actual matched solutions are tested in activeAstrometry; exceptions retain unknown sigma.'),nearbyRedshiftOnly=dict(count=len(sky_only),examples=[r[0] for r in sky_only[:12]],note='d<10 million ly is a review heuristic, not an automatic rejection or an individual error estimate.'),populations=populations,
                activeAstrometry=dict(mappedMatched=len(active),invalidMatchedIds=wrong,status='fixed' if not wrong else 'failed'),
                sources=['https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/version-info.md','https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html?highlight=om&type=normal','https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_str/'],inputSHA256={**{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in [str((folder/'manifest.json').relative_to(root)),'data-tools/hipparcos-errors.json','data-tools/raw/hyg_v41.csv']},'psrcat.db':hashlib.sha256(psr_path.read_bytes()).hexdigest(),'staticCoreGeometry':hashlib.sha256(json.dumps(core,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'auditTool':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},limitations=['Hough candidates are alerts, not proofs of artifacts or physical structures.','No unknown depths are synthesized and no coordinates are changed.','GC association parsing uses the ATNF string; membership confidence and host radii need a scientific follow-up.','The 100 ly cluster radial spread threshold is only a triage threshold, not a universal cluster diameter.','legacy1997Comparison is a retained legacy-1997 comparison, not the active corrected uncertainty policy; activeAstrometry tests the actual mapped rows.','Complete 3D relative geometry is not preserved by the radial map or its interpolated angular corrections.'])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parent);args=parser.parse_args();report=scan(args.root)
    path=args.root/'data-tools/map-geometry-audit.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['revision','mappedLeafRows','shellSummary','houghCandidates']},ensure_ascii=False,indent=2))
    print('GC radial conflicts:',sum(q['status']=='radial-conflict-review' for q in report['clusterGroups']))
    print('Historical raw HYG vs HIP1997 differences (not active errors):',report['legacy1997Comparison']['mismatchAbove002mas'])
    print('Active mapped uncertainty mismatches:',len(report['activeAstrometry']['invalidMatchedIds']))
