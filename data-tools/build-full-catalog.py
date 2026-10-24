"""Build local, bounded spatial tiles and a lazy worker search index from full snapshots.

No network. HYG sentinel distances are never used. Unknown objects receive ONLY a
schematic 2D position; approximate measured/model distances remain navigable.
"""
import csv, json, math, re, hashlib, unicodedata, collections, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT/'data-tools/raw'
OUT = ROOT/'dist/catalog-data'
PC = 3.2615637771674336
MATRIX = [[-.0548755604162154,-.873437090234885,-.4838350155487132],[.4941094278755837,-.4448296299600112,.7469822444972189],[-.8676661490190047,-.1980763734312015,.4559837761750669]]
def number(v):
    try:
        n=float(v); return n if math.isfinite(n) else None
    except (ValueError,TypeError): return None
def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD',str(s)).casefold() if c.isalnum())
def sky(ra,dec,d):
    a,b=math.radians(ra),math.radians(dec)
    v=[d*math.cos(a)*math.cos(b),d*math.sin(a)*math.cos(b),d*math.sin(b)]
    return [sum(x*y for x,y in zip(row,v)) for row in MATRIX]
def sex(v,ra=False):
    try:
        p=v.split(':'); sign=-1 if p[0].startswith('-') else 1
        return sign*(abs(float(p[0]))+sum(float(x)/60**i for i,x in enumerate(p[1:],1)))*(15 if ra else 1)
    except (ValueError,AttributeError): return None
def dump(p,v):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False))

# Export only the original physical and display layers, never the extension itself.
js="""const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','layout-data','map-layout'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\\n'),c);process.stdout.write(vm.runInContext('JSON.stringify(OBJECTS.map(o=>({...o,display:MapLayout.project(o)})))',c));"""
node='/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'
core=json.loads(subprocess.check_output([node,'-e',js],cwd=ROOT))
byid={o['id']:o for o in core}
byhyg={str(o['hygId']):o for o in core if o.get('hygId') is not None}
byngc={o['ngc']:o for o in core if o.get('ngc')}
hyg=list(csv.DictReader((RAW/'hyg_v41.csv').open()))
ngc=list(csv.DictReader((RAW/'NGC.csv').open(),delimiter=';'))
cache=json.loads((ROOT/'data-tools/named-astrometry.json').read_text())
literature=json.loads((ROOT/'data-tools/galaxy-distances.json').read_text())
patches={}; records=[]; rawmap={}; systems=[]; coverage={}

# A coarse field of the existing t-SNE offsets keeps extra stars in its vicinity
# without extending the quadratic layout optimizer to 140,000 objects.
anchors=collections.defaultdict(list)
for o in core:
    p=o.get('p3'); d=o.get('d')
    if p and d and d>0:
        a=math.atan2(-p[1],p[0]); off=math.atan2(o['display']['y'],o['display']['x'])-a
        off=math.atan2(math.sin(off),math.cos(off))
        anchors[int(math.log2(d))].append((p,off))
def projection(ra,dec,d,kind,ident):
    if ra is None or dec is None:
        angle=int(hashlib.sha256(ident.encode()).hexdigest()[:8],16)/2**32*math.tau
        radius=60000 if kind in ('star','pulsar') else 5e7
        return [radius*math.cos(angle),radius*math.sin(angle)]
    if not d:
        radius=60000 if kind in ('star','pulsar') else 180000 if kind in ('nebula','cluster') else 5e7
        p=sky(ra,dec,radius);a=math.atan2(-p[1],p[0]);return [radius*math.cos(a),radius*math.sin(a)]
    p=sky(ra,dec,d); band=int(math.log2(d)); candidates=[v for k in range(band-1,band+2) for v in anchors[k]]
    near=sorted(((sum((p[i]-v[0][i])**2 for i in range(3)),v[1]) for v in candidates),key=lambda x:x[0])[:4]
    weights=[(1/max(1e-20,s),off) for s,off in near]
    offset=sum(w*a for w,a in weights)/sum(w for w,a in weights) if weights else 0
    limit=math.pi/3*abs(p[2])/d;offset=max(-limit,min(limit,offset));a=math.atan2(-p[1],p[0])+offset
    return [d*math.cos(a),d*math.sin(a)]

# Tuple schema keeps individual tiles and the search worker small.
# id,name,kind,d,ra,dec,quality,method,aliases,V,source,extra,mapX,mapY
def add(ident,name,kind,d,ra,dec,quality,method,aliases,mag,source,extra):
    x,y=projection(ra,dec,d,kind,ident)
    row=[ident,name,kind,d,ra,dec,quality,method,list(dict.fromkeys(a for a in aliases if a)),mag,source,extra,x,y]
    records.append(row);return row

for q in hyg:
    if q['id']=='0':rawmap['hyg:0']='sol';continue
    ident=byhyg.get(q['id'],{}).get('id','hyg-'+q['id']);rawmap['hyg:'+q['id']]=ident
    ra,dec=float(q['ra'])*15,float(q['dec']);pc=float(q['dist']);d=pc*PC if 0<pc<100000 else None
    quality='catalog' if d else 'unknown';method='HYG 4.1: каталожное расстояние, пк × 3,261563777.'
    key='HIP '+q['hip'] if q['hip'] else 'HD '+q['hd'] if q['hd'] else q['proper']
    ast=cache.get(key) or {};plx=number(ast.get('plx_value'))
    if not d and plx and plx>0:
        d=1000/plx*PC;quality='approximate';method='Приблизительно: положительный параллакс SIMBAD; большая или неизвестная погрешность.'
    aliases=[q['proper'],q['bf'].strip(),q['gl'],'HIP '+q['hip'] if q['hip'] else '', 'HD '+q['hd'] if q['hd'] else '', 'HR '+q['hr'] if q['hr'] else '', 'HYG '+q['id']]
    extra={'hygId':int(q['id']),'spectral':q['spect'],'hip':q['hip'],'hd':q['hd'],'gliese':q['gl']}
    if ident in byid:
        o=byid[ident]
        if o.get('p3'):continue
        if o.get('d') and o['d']<100000*PC:d=o['d'];quality='approximate'
        patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,o['kind'],ident)}
        continue
    add(ident,q['proper'] or q['bf'].strip() or q['gl'] or ('HIP '+q['hip'] if q['hip'] else 'HYG '+q['id']),'star',d,ra,dec,quality,method if d else 'Расстояние неизвестно. Показано направление на условной оболочке; её радиус не является расстоянием.',aliases,number(q['mag']),'HYG',extra)
coverage['HYG']={'rows':len(hyg),'represented':len(hyg),'sunIncluded':True}

def hubble(z):
    # Simpson integral in the same flat LCDM as the original atlas.
    n=128;h=z/n
    return 299792.458/70*h/3*sum((1 if i in (0,n) else 4 if i%2 else 2)/math.sqrt(.3*(1+i*h)**3+.7) for i in range(n+1))*1e6*PC
for q in ngc:
    if q['Name']=='NGC5866':q={**q,'M':'102'}
    ident=byngc.get(q['Name'],{}).get('id','opengc-'+norm(q['Name']));rawmap['ngc:'+q['Name']]=ident
    kind='galaxy' if q['Type'] in ('G','GPair','GTrpl','GGroup') else 'cluster' if q['Type'] in ('OCl','GCl','*Ass','Cl+N') else 'star' if q['Type'] in ('*','**','Nova') else 'nebula'
    ra,dec=sex(q['RA'],True),sex(q['Dec']);extraDist=literature['objects'].get(q['Name'],{});d=extraDist.get('distanceMpc');d=d*1e6*PC if d else None
    quality='catalog' if d else 'unknown';method='Индивидуальное литературное расстояние SIMBAD.' if d else 'Расстояние неизвестно; направление показано схематически.'
    if q['Name']=='NGC5866':d=44e6;quality='approximate';method='NASA Hubble Messier 102: округлённая оценка 44 млн св. лет. M102 принято отождествлять с NGC 5866; историческая идентификация обсуждалась.'
    z=number(q['Redshift']);px=number(q['Pax'])
    if not d and kind=='galaxy' and z and z>0:
        d=hubble(z);quality='approximate';method='Приблизительное сопутствующее расстояние по z в ΛCDM (H₀=70, Ωm=0,3). Пекулярные скорости не учтены; для близких галактик ошибка может быть большой.'
    elif not d and kind=='star' and px and px>0:
        d=1000/px*PC;quality='approximate';method='Приблизительно: положительный параллакс OpenNGC без индивидуальной оценки ошибки.'
    major=number(q['MajAx']);minor=number(q['MinAx']);ext={'ngc':q['Name'],'messier':q['M'],'angularMajorArcmin':major,'angularMinorArcmin':minor,'hubbleType':q['Hubble'],'catalogType':q['Type']}
    if q['Name']=='NGC5866':ext['referenceURL']='https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/'
    if kind=='galaxy' and d:ext['diameterLy']=d*major*math.pi/10800 if major else 30000;ext['sizeEstimated']=not bool(major)
    if ident in byid:
        o=byid[ident]
        if not o.get('p3'):
            patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,kind,ident),**ext}
        continue
    aliases=[q['Name'],q['Name'].replace('NGC0','NGC ').replace('IC0','IC '),*q['Common names'].split(','),*q['Identifiers'].split(',')]
    if q['M']:aliases+=['M'+str(int(q['M'])),'M '+str(int(q['M'])),'Мессье '+str(int(q['M']))]
    name=q['Common names'].split(',')[0] or ('M'+str(int(q['M'])) if q['M'] else q['Name'])
    add(ident,name,kind,d,ra,dec,quality,method,aliases,number(q['V-Mag']),'OpenNGC',ext)
coverage['OpenNGC']={'rows':len(ngc),'represented':len(ngc),'nonexistent':sum(q['Type']=='NonEx' for q in ngc),'duplicateRows':sum(q['Type']=='Dup' for q in ngc)}

# The NGC/IC snapshot omits M40 and M45. Complete the Messier index with
# source-backed landmarks, never label a line-of-sight pair as a bound binary.
add('messier-40','M40 · Виннеке 4','star',None,185.55,58+5/60,'unknown','SIMBAD: направление M40 (12h22m12s, +58°05′). У записи нет единой физической дальности; схема, не точка полёта.',['M40','M 40','Мессье 40','Messier 40','Winnecke 4','WNC 4'],None,'SIMBAD',{'messier':'40','referenceURL':'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M%2040'})
members=[q for q in hyg if q['proper'] in ['Alcyone','Atlas','Electra','Maia','Merope','Taygeta','Celaeno','Pleione']]
ra=sum(float(q['ra'])*15 for q in members)/len(members);dec=sum(float(q['dec']) for q in members)/len(members)
add('messier-45','Плеяды · M45','cluster',445,ra,dec,'approximate','NASA Hubble: около 445 св. лет. Направление — приблизительный центр ярких членов скопления из HYG.',['M45','M 45','Мессье 45','Messier 45','Плеяды','Pleiades','Seven Sisters'],1.6,'NASA',{'messier':'45','referenceURL':'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/'})
coverage['Messier']={'rows':110,'represented':110}

# Keep rows marked duplicate/nonexistent searchable and drawn, but never navigable
# when identification itself is invalid, even if a historical distance is present.
for row in records:
    if row[11].get('catalogType') in ('NonEx','Dup'):
        row[11]['identificationNote']='Запись OpenNGC: '+('исторический несуществующий объект' if row[11]['catalogType']=='NonEx' else 'дублирующее обозначение; см. идентификаторы')
        row[11]['invalidIdentification']=True

psr_path=RAW/'psrcat.db'
if not psr_path.exists():psr_path=ROOT.parent/'research-data/psrcat.db'
pulsars=[];current={}
for line in psr_path.read_text().splitlines():
    if line.startswith('@'):
        if current:pulsars.append(current);current={}
    elif line and not line.startswith('#'):
        parts=line.split()
        if len(parts)>1:current[parts[0]]=parts[1]
if current:pulsars.append(current)
knownpsr={'J0835-4510':'vela','J0534+2200':'crab','J0633+1746':'iau-geminga','J1300+1240':'iau-lich','J1412+7922':'iau-calvera'}
for q in pulsars:
    name=q['PSRJ'];ident=knownpsr.get(name,'atnf-'+name.lower());rawmap['atnf:'+name]=ident
    ra,dec=sex(q.get('RAJ'),True),sex(q.get('DECJ'));d=None;quality='unknown';method='Расстояние неизвестно; положение на карте условное.'
    for field in ('DIST_A','DIST_DM','DIST_DM1'):
        v=number(q.get(field))
        if v and v>0:d=v*1000*PC;quality='approximate';method='ATNF 2.9.0: '+field+', кпк × 3261,563777. '+('Независимая оценка.' if field=='DIST_A' else 'Модельное расстояние по дисперсии; существенная неопределённость.');break
    if d is None:
        px=number(q.get('PX'))
        if px and px>0:d=1000/px*PC;quality='approximate';method='ATNF: приблизительная инверсия положительного параллакса.'
    if (ra is None or dec is None) and number(q.get('ELONG')) is not None and number(q.get('ELAT')) is not None:
        l,b=math.radians(float(q['ELONG'])),math.radians(float(q['ELAT']));e=math.radians(23.4392911)
        x=math.cos(b)*math.cos(l);y=math.cos(b)*math.sin(l)*math.cos(e)-math.sin(b)*math.sin(e);z=math.cos(b)*math.sin(l)*math.sin(e)+math.sin(b)*math.cos(e)
        ra=math.degrees(math.atan2(y,x))%360;dec=math.degrees(math.asin(z))
    if ident in byid:
        if not byid[ident].get('p3'):patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,'pulsar',ident)}
        continue
    ext={'periodSeconds':number(q.get('P0')),'binaryModel':q.get('BINARY'),'association':q.get('ASSOC')}
    add(ident,'PSR '+name,'pulsar',d,ra,dec,quality,method,['PSR '+name,name,q.get('PSRB','')],None,'ATNF',ext)
coverage['ATNF']={'rows':len(pulsars),'represented':len(pulsars)}

# The IAU snapshot has a few stars not in HYG. Relax the old error cut-off, but
# explicitly call those distances approximate. Keep genuinely absent values absent.
for o in core:
    if o.get('p3') or o['id'] in patches or o.get('region') or o['kind'] in ('structure','wall','ring','arc','horizon'):continue
    ast=None
    for name in o.get('aliases',[]):
        if cache.get(name):ast=cache[name];break
    ra=number((ast or {}).get('ra'));dec=number((ast or {}).get('dec'))
    if ra is None:ra=number(o.get('raDeg'))
    if dec is None:dec=number(o.get('decDeg'))
    px=number((ast or {}).get('plx_value'));d=o.get('d')
    if not d and px and px>0:d=1000/px*PC
    patches[o['id']]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':'approximate' if d else 'unknown','distanceMethod':'Приблизительно: положительный параллакс SIMBAD с большой или неизвестной ошибкой.' if d else 'Положение неизвестно. Только схематическая точка, без физического расстояния.','display':projection(ra,dec,d,o['kind'],o['id'])}

# Rank the existing local foreground first: official/traditional names, famous
# original landmarks, then apparent brightness. Background stars never reserve labels.
near=[o for o in core if o['kind']=='star' and o.get('d') and o['d']<=50]
def rank(o):return (0 if o['id'] in ('alpha','alpha-b','proxima','sirius','barnard','vega') else 1 if o.get('iauNames') else 2 if 'traditionalName' in o.get('selection',[]) else 3, o.get('apparentV') if o.get('apparentV') is not None else 99,o['d'],o['id'])
foreground=[o['id'] for o in sorted(near,key=rank)[:100]]

# Multiplicity comes from HYG's explicit component fields, never sky proximity.
groups=collections.defaultdict(list)
for q in hyg:
    if q['base']:groups[q['base']].append(q)
for base,rows in sorted(groups.items()):
    if len(rows)<2:continue
    rows.sort(key=lambda q:(int(q['comp'] or '1'),int(q['id'])))
    ids=[rawmap['hyg:'+q['id']] for q in rows]
    systems.append({'id':'system-'+norm(base),'name':base,'members':ids,'primary':ids[0],'links':[[ids[0],s] for s in ids[1:]],'schematic':True,'source':'https://github.com/astronexus/HYG-Database/blob/main/hyg/README.md','note':'Компоненты системы указаны в HYG. Эллипсы показывают связь; размеры, ориентация и иерархия условные, движение не моделируется.'})
alpha=[rawmap['hyg:'+s] for s in ('71456','71453','70666')]
systems=[s for s in systems if not any(i in alpha for i in s['members'])]
systems.append({'id':'system-alpha-centauri','name':'Альфа Центавра','members':alpha,'primary':alpha[0],'links':[[alpha[0],alpha[1]],[alpha[0],alpha[2]]],'schematic':True,'source':'https://doi.org/10.1051/0004-6361/201629930','note':'A–B: около 80 лет; Проксима (C) обращается вокруг пары AB примерно за 550 000 лет. Внешний эллипс относится к барицентру AB. Контуры на карте — схема связи, не орбитальный расчёт.'})
# Documented non-stellar systems use the same rendering model.
for q in ngc:
    if q['Type']=='GPair':
        ids=[rawmap.get('ngc:'+q['Name']+suffix) for suffix in ('A','B','C')]
        ids=[i for i in ids if i]
        if len(ids)>1:systems.append({'id':'system-'+norm(q['Name']),'name':q['Name'],'members':ids,'primary':ids[0],'links':[[ids[0],s] for s in ids[1:]],'schematic':True,'source':'https://github.com/mattiaverga/OpenNGC','note':'OpenNGC обозначает эту группу как пару галактик (GPair). Эллипсы показывают связь компонентов, а не вычисленные орбиты.'})
systems.append({'id':'system-antennae','name':'Антенны','members':[rawmap['ngc:NGC4038'],rawmap['ngc:NGC4039']],'primary':rawmap['ngc:NGC4038'],'links':[[rawmap['ngc:NGC4038'],rawmap['ngc:NGC4039']]],'schematic':True,'source':'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-60-61/','note':'NGC 4038 и NGC 4039 — взаимодействующие галактики Антенны. Эллипс обозначает взаимодействие, не измеренную орбиту.'})
systems.append({'id':'system-cygnus-x1','name':'Лебедь X-1','members':['cygnus',rawmap['hyg:97987']],'primary':'cygnus','links':[['cygnus',rawmap['hyg:97987']]],'schematic':True,'source':'https://imagine.gsfc.nasa.gov/features/yba/CygX1_mass/cygX1_more.html','note':'Чёрная дыра Лебедь X-1 и звезда-сверхгигант HDE 226868 — компоненты двойной системы. Эллипс схематический; аккреция и движение не моделируются.'})
renames={rawmap['hyg:97987']:'HDE 226868 · звезда Лебедя X-1',alpha[0]:'Альфа Центавра A',alpha[1]:'Альфа Центавра B',alpha[2]:'Альфа Центавра C · Проксима'}

OUT.mkdir(exist_ok=True)
for f in OUT.glob('*.json'):f.unlink()
nodes=[];index=[];locations={}; serial=0
def tile(rows,depth=0):
    global serial
    ident=len(nodes);node={'box':[min(r[12] for r in rows),min(r[13] for r in rows),max(r[12] for r in rows),max(r[13] for r in rows)],'count':len(rows),'children':[],'file':str(ident)+'.json'};nodes.append(node)
    if len(rows)>256:
        axis=12 if node['box'][2]-node['box'][0]>=node['box'][3]-node['box'][1] else 13
        ordered=sorted(rows,key=lambda r:(r[axis],r[0]));mid=len(rows)//2
        node['children']=[tile(ordered[:mid],depth+1),tile(ordered[mid:],depth+1)]
        # Deterministic actual catalog representatives; every row occurs in a leaf.
        sample=sorted(rows,key=lambda r:hashlib.sha256(r[0].encode()).digest())[:48]
        dump(OUT/node['file'],sample)
    else:
        dump(OUT/node['file'],rows)
        for r in rows:locations[r[0]]=node['file']
    return ident
# Radius bands prevent the nearby sky disappearing into a single huge bounding box.
bands=collections.defaultdict(list)
for r in records:bands[int(math.log10(max(1,math.hypot(r[12],r[13]))))].append(r)
roots=[tile(rows) for _,rows in sorted(bands.items())]
for r in records:
    key=re.sub(r'(ngc|ic)0+(?=\d)',r'\1','|'+'|'.join(norm(v) for v in [r[0],r[1],*r[8],r[11].get('ngc','')])+'|')
    index.append([r[0],r[1],r[2],r[3],r[6],locations[r[0]],key])
dump(OUT/'search.json',index)
revision=hashlib.sha256(Path(__file__).read_bytes()+b''.join(hashlib.sha256(p.read_bytes()).digest() for p in [RAW/'hyg_v41.csv',RAW/'NGC.csv',psr_path])+json.dumps(core,ensure_ascii=False).encode()).hexdigest()[:12]
summary={'version':1,'revision':revision,'total':len(core)+len(records),'core':len(core),'extra':len(records),'sourceCoverage':coverage,'unknownExtra':sum(r[6]=='unknown' for r in records),'approximateExtra':sum(r[6]=='approximate' for r in records),'nodes':nodes,'roots':roots,'search':'search.json','systems':len(systems),'foregroundWithin50':len(foreground)}
dump(OUT/'manifest.json',summary)
boot={'revision':revision,'total':summary['total'],'patches':patches,'foreground':foreground,'systems':systems,'renames':renames,'sourceCoverage':coverage,'systemTiles':{i:locations[i] for s in systems for i in s['members'] if i in locations},'rawMap':{k:v for k,v in rawmap.items() if k.startswith('atnf:') and v in byid}}
(ROOT/'dist/catalog-extended.js').write_text('// Generated from complete local source snapshots.\nconst EXTENDED_BOOT='+json.dumps(boot,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n')
dump(ROOT/'data-tools/full-catalog-audit.json',{'total':summary['total'],'core':len(core),'extra':len(records),'sourceCoverage':coverage,'mappedRows':len(records),'leafRecords':len(locations),'foreground':foreground,'systems':len(systems),'unknownExtra':summary['unknownExtra'],'approximateExtra':summary['approximateExtra'],'sourceSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [RAW/'hyg_v41.csv',RAW/'NGC.csv',psr_path]}})
html=ROOT/'dist/index.html';html.write_text(re.sub(r'(catalog-extended\.js\?v=)[^\"]+',lambda m:m[1]+revision,html.read_text()))
print(json.dumps({k:v for k,v in summary.items() if k not in ('nodes','roots')},ensure_ascii=False,indent=2))
