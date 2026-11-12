"""Build an additive, sourced catalogue; never rewrite existing IDs or positions.

The checked-in JADES excerpt is extracted from Obs_info in DR4 v1.2 FITS.
Use --extract-from DIR to reproduce it from the two original FITS snapshots.
Normal builds need only Python's standard library and Node.
"""
from pathlib import Path
import argparse, collections, csv, gzip, hashlib, json, math, subprocess

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'data-tools/distant-sources'
NODE = '/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'
PC = 3.2615637771674336
MATRIX = [[-.0548755604162154,-.873437090234885,-.4838350155487132], [.4941094278755837,-.4448296299600112,.7469822444972189], [-.8676661490190047,-.1980763734312015,.4559837761750669]]

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')

def unit(ra, dec):
    a, b = map(math.radians, (ra, dec))
    return math.cos(b)*math.cos(a), math.cos(b)*math.sin(a), math.sin(b)

def separation(a, b):
    return 2*math.asin(min(1, math.dist(unit(a['raDeg'], a['decDeg']), unit(b['raDeg'], b['decDeg']))/2))*206264.806247

def compatible(a, b):
    # Identity tolerance, NOT an uncertainty on either measurement.
    return abs(a['redshift']-b['redshift']) <= .005*(1+max(a['redshift'], b['redshift']))

def cosmology(z):
    # Identical to CosmicCatalog.cosmology: preserve the established atlas model.
    n = 4096; h = z/n; dc = lb = 0
    for i in range(n+1):
        x = i*h; w = 1 if i in (0,n) else 4 if i%2 else 2
        e = math.sqrt(.3*(1+x)**3+.7)
        dc += w/e; lb += w/((1+x)*e)
    return {'distanceLy':299792.458/70*dc*h/3*1e6*PC, 'lookbackYears':3.085677581e19/70/31557600*lb*h/3, 'H0':70, 'omegaM':.3, 'omegaLambda':.7}

def extract(directory):
    from astropy.io import fits
    rows = []
    for field in ('gs', 'gn'):
        path = directory/f'jades-{field}-dr4.fits'
        meta = json.loads((SOURCES/f'jades-{field}-dr4.json').read_text())
        assert hashlib.sha256(path.read_bytes()).hexdigest() == meta['sha256']
        with fits.open(path) as hdus:
            table = hdus['Obs_info']
            assert not any('z' in n.lower() and ('err' in n.lower() or 'sigma' in n.lower()) for n in table.columns.names)
            for r in table.data:
                flag = str(r['z_Spec_flag']).strip(); z = float(r['z_Spec'])
                rows.append({'field':field, 'observationID':str(r['Unique_ID']).strip(), 'programID':int(r['PID']), 'tier':str(r['TIER']).strip(), 'targetID':str(r['NIRSpec_ID']).strip(), 'photometryDR5ID':int(r['NIRCam_DR5_ID']), 'raDeg':float(r['RA_TARG']), 'decDeg':float(r['DEC_TARG']), 'redshift':z, 'quality':flag})
    dump(SOURCES/'jades-observations.json', {'table':'Obs_info', 'positionColumns':['RA_TARG','DEC_TARG'], 'positionUnit':'deg J2000', 'redshiftUnit':'dimensionless', 'redshiftUncertainty':'Not supplied in Obs_info; quality flags are not sigma.', 'qualityFlags':{'A':'Highly robust: S/N>5 emission lines in R~1000 data','B':'Highly robust: S/N>5 emission lines in Prism/Clear','C':'Secure: visually identified spectral breaks and/or low S/N emission lines','D':'Tentative redshift; not used for map distance','E':'No redshift; raw sentinel retained only in observations'}, 'observations':rows})

def build():
    js = "const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','map-layout','cosmology','map-details','catalog-extended','catalog-stream'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\\n'),c);process.stdout.write(vm.runInContext('JSON.stringify(OBJECTS)',c));"
    core = json.loads(subprocess.check_output([NODE,'-e',js], cwd=ROOT))
    existing = [{'id':o['id'],'kind':o['kind'],'raDeg':o.get('raDeg'),'decDeg':o.get('decDeg'),'d':o.get('d'),'redshift':o.get('redshift')} for o in core]
    base = json.loads(gzip.decompress((ROOT/'data-tools/cosmic-catalogs.json.gz').read_bytes()))
    existing += [{'id':o['id'],'kind':o['kind'],'raDeg':o.get('raDeg'),'decDeg':o.get('decDeg'),'d':o.get('distanceLy'),'redshift':o.get('redshift')} for o in base['objects']]
    grid = collections.defaultdict(list)
    def cell(v): return tuple(math.floor(x/1e-5) for x in v)
    for o in existing:
        if o['kind'] not in ('galaxy','cluster') or not all(isinstance(o[k], (int,float)) for k in ('raDeg','decDeg','d')): continue
        grid[(o['kind'],*cell(unit(o['raDeg'],o['decDeg'])))].append(o)

    observations = json.loads((SOURCES/'jades-observations.json').read_text())['observations']
    groups = collections.defaultdict(list)
    for o in observations:
        key = str(o['photometryDR5ID']) if o['photometryDR5ID'] > 0 else o['observationID']
        groups[(o['field'],key)].append(o)
    candidates = []; conflicts = []
    for (field, key), rows in sorted(groups.items()):
        rows.sort(key=lambda o:('ABCDE'.index(o['quality']),o['observationID']))
        usable = [r for r in rows if r['quality'] in 'ABC' and r['redshift']>0]
        conflict = any(separation(a,b)>1 or not compatible(a,b) for a in usable for b in usable)
        ident = f'jades-dr4-{field}-{key}'
        if conflict: conflicts.append({'id':ident,'observations':[r['observationID'] for r in rows],'reason':'Same photometric source, incompatible z or target position. Retained only in Atlas.'})
        r = usable[0] if usable else rows[0]
        reason = 'Incompatible reliable redshifts or target coordinates.' if conflict else 'No accepted positive A/B/C spectroscopic redshift.' if not usable else None
        candidates.append({'id':ident,'name':f'JADES {field.upper()} DR5 {key}' if r['photometryDR5ID']>0 else 'JADES '+key,'kind':'galaxy' if usable else 'unknown', 'raDeg':r['raDeg'],'decDeg':r['decDeg'],**({'redshift':r['redshift']} if usable else {}), 'atlasOnly':conflict or not usable, **({'positionReasonCode':'conflicting-observations' if conflict else 'unreliable-redshift','sourcePositionReason':reason} if reason else {}),'catalog':'JADES DR4','quality':r['quality'],'field':field,'observations':rows,'referenceURL':'https://archive.stsci.edu/hlsp/jades'})

    raw = (SOURCES/'ccpc-tables.raw').read_text()
    def table_rows(name):
        table = raw.split('#Name: J/ApJ/833/15/'+name+'\n',1)[1].split('#Table',1)[0]
        lines = [s for s in table.splitlines() if s and not s.startswith('#')]
        return [{k:v.strip() for k,v in row.items()} for row in csv.DictReader([lines[0]]+lines[3:],delimiter='\t')]
    for r in table_rows('ccpc2'):
        candidates.append({'id':r['Name'],'name':r['Name'],'kind':'cluster','raDeg':float(r['RAJ2000']),'decDeg':float(r['DEJ2000']),'redshift':float(r['z']),'redshiftStatistic':'median','redshiftError':float(r['e_z']),'members':int(r['o_z']),'best':r['f_Name']=='B','quality':int(r['Q']),'effectiveRadiusMpc':float(r['Re']),'candidate':True,'sourceTable':'ccpc2','catalogData':r,'catalogUnits':{'Re':'Mpc','sigma':'km/s','Mass':'1e14 solar masses; virial model estimate','OME':'1e14 solar masses; overdensity model estimate','Vol':'comoving Mpc^3','CProb':'percent','redshift':'dimensionless'},'catalog':'CCPC-II','referenceURL':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/833/15'})
    interest = collections.defaultdict(list)
    for r in table_rows('table6'): interest[r['Name']].append(r)
    for name, rows in sorted(interest.items()):
        assert all({k:v for k,v in r.items() if k!='recno'}=={k:v for k,v in rows[0].items() if k!='recno'} for r in rows), name
        r=rows[0]
        candidates.append({'id':name,'name':name,'kind':'cluster','raDeg':float(r['RAJ2000']),'decDeg':float(r['DEJ2000']),'redshift':float(r['<z>']),'redshiftStatistic':'mean','members':int(r['o_<z>']),'effectiveRadiusMpc':float(r['Re']),'objectOfInterest':True,'sourceTable':'table6','catalogData':r,'catalogRows':rows,'catalogUnits':{'Re':'Mpc','redshift':'dimensionless'},'catalog':'CCPC-II','referenceURL':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/833/15'})
    added = []; matches = []
    for o in candidates:
        if 'redshift' not in o:
            added.append(o);continue
        o['cosmology'] = cosmology(o['redshift']); o['d'] = o['cosmology']['distanceLy']
        v = unit(o['raDeg'],o['decDeg']); o['p3'] = [sum(x*y for x,y in zip(row,v))*o['d'] for row in MATRIX]
        c = cell(v); near = []
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for dz in (-1,0,1):
                    for old in grid.get((o['kind'],c[0]+dx,c[1]+dy,c[2]+dz),()):
                        if separation(o,old)<.3 and abs(old['d']/o['d']-1)<.03: near.append(old)
        targets = sorted({a['id'] for a in near})
        if len(targets)==1 and not o.get('atlasOnly'):
            matches.append({'sourceId':o['id'],'targetId':targets[0],'measurement':o,'basis':'same class, unique <0.3 arcsec and <3% comoving-distance difference; existing position preserved'})
        else:
            if len(targets)>1:
                o['atlasOnly']=True;conflicts.append({'id':o['id'],'targets':targets,'reason':'Ambiguous existing identities. Atlas only.'})
            added.append(o)
    counts = {'inputObservations':len(observations),'photometricTargets':len(groups),'ccpcCandidates':sum(bool(o.get('candidate')) for o in candidates),'ccpcInterestObjects':len(interest),'ccpcInterestRows':sum(map(len,interest.values())),'added':len(added),'mergedExisting':len(matches),'atlasOnly':sum(bool(o.get('atlasOnly')) for o in added),'located':sum(not o.get('atlasOnly') for o in added),'withoutReliableRedshift':sum('redshift' not in o for o in added),'existingRecordsChecked':len(existing)}
    source_meta = {name:json.loads((SOURCES/name).read_text()) for name in ('ccpc-tables.json','jades-gs-dr4.json','jades-gn-dr4.json')}
    content = {'version':1,'counts':counts,'sources':source_meta,'objects':added,'matches':matches}
    content['revision'] = hashlib.sha256(json.dumps(content,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:12]
    (ROOT/'dist/distant-catalog-data.js').write_text('const DISTANT_CATALOG_DATA='+json.dumps(content,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n')
    dump(ROOT/'data-tools/distant-catalog-audit.json', {'revision':content['revision'],'counts':counts,'qualityFlags':dict(collections.Counter(r['quality'] for r in observations)),'duplicateInterestRows':{k:[r['recno'] for r in v] for k,v in interest.items() if len(v)>1},'conflicts':conflicts,'matches':[{'sourceId':r['sourceId'],'targetId':r['targetId'],'basis':r['basis']} for r in matches],'identityPolicy':'Group by field + positive NIRCam_DR5_ID, never by program-local NIRSpec_ID. Missing photometric IDs retain independent observation IDs. All 5190 grouped observations retained. Only positive A/B/C redshifts determine map positions or conflicts; D/E stay in provenance, never disqualifying a reliable A/B/C measurement. Groups without an accepted z remain unclassified and Atlas-only, with no invented distance. A/B/C priority and stable observation ID choose a representative, never invent a sigma. CCPC table6 duplicate source rows retained under one Name; source mean z is distinguished from main-table median. Full original cosmic source catalogue and final core checked for overlaps.'})
    print(json.dumps({'revision':content['revision'],**counts},ensure_ascii=False))

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--extract-from',type=Path);args=p.parse_args()
    if args.extract_from: extract(args.extract_from)
    build()
