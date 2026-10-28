"""Build local, bounded spatial tiles and a lazy worker search index from full snapshots.

No network. HYG sentinel distances are never used. Unknown objects receive only
an atlas-only record; approximate measured/model distances remain navigable.
"""
import csv, json, math, re, hashlib, unicodedata, collections, subprocess
from disk_geometry import locate as locate_disk, basis as sky_basis, unit as sky_unit, dot as sky_dot
from astrometry_policy import match_hyg
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
lowz=json.loads((ROOT/'data-tools/low-z-galaxy-distances.json').read_text());literature['objects'].update(lowz['objects'])
patches={}; records=[]; rawmap={}; systems=[]; coverage={}; policies={}; member_rows=[]
hip_errors=json.loads((ROOT/'data-tools/hipparcos-errors.json').read_text())['rows']
hip2007=json.loads((ROOT/'data-tools/hipparcos-2007.json').read_text())['rows']
astrometry_audit=[]
COORDINATE_POLICY=json.loads((ROOT/'data-tools/coordinate-policy.json').read_text())
MAX_RELATIVE_ERROR=COORDINATE_POLICY['maxReportedRelativeError']

# Orthographic projection, identical for the core, stream and free points.
# No fixed heliocentric map radius and no independently interpolated angles.
def projection(ra,dec,d,kind,ident):
    if ra is None or dec is None or not d:return [None,None]
    p=sky(ra,dec,d)
    return [p[0],-p[1]]

# Tuple schema keeps individual tiles and the search worker small.
# id,name,kind,d,ra,dec,quality,method,aliases,V,source,extra,mapX,mapY
def add(ident,name,kind,d,ra,dec,quality,method,aliases,mag,source,extra):
    if d is None or ra is None or dec is None:extra['atlasOnly']=True
    x,y=projection(ra,dec,d,kind,ident) if not extra.get('atlasOnly') else [None,None]
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
    solution=match_hyg(pc,q['hip'],hip2007,hip_errors,COORDINATE_POLICY['hygDistanceMatchTolerancePc']) if 0<pc<100000 else {'astrometrySource':'No HYG distance','distanceRelativeError':None,'uncertaintyMatched':False}
    rel=solution['distanceRelativeError']
    if ast and plx and plx>0 and not 0<pc<100000:
        err=number(ast.get('plx_err'));rel=err/plx if err is not None else None
        solution={'astrometrySource':'SIMBAD matched parallax','parallaxMas':plx,'parallaxErrorMas':err,'distanceRelativeError':rel,'uncertaintyMatched':rel is not None}
    bad=(rel is not None and rel>MAX_RELATIVE_ERROR) or (not 0<pc<100000 and d is not None and rel is None)
    original=byid.get(ident)
    independent_original=bool(original and original.get('p3') and d and abs(original['d']-d)/d>.01)
    if independent_original:
        bad=False;solution={'astrometrySource':'Preserved independent core distance','distanceRelativeError':None,'uncertaintyMatched':False}
    extra.update(solution)
    astrometry_audit.append({'id':ident,**solution,'atlasOnly':bad or d is None,'distancePc':pc if 0<pc<100000 else None})
    if bad:extra.update(atlasOnly=True,positionReason='Погрешность параллакса того же астрометрического решения превышает 50%, либо новая инверсия не имеет погрешности. Только атлас.')
    if original:policies[ident]={**solution,'atlasOnly':bad or not bool(original.get('p3') or d),'positionReason':extra.get('positionReason','Недостаточно данных для положения на карте.')}

    if ident in byid:
        o=byid[ident]
        if o.get('p3'):continue
        if o.get('d') and o['d']<100000*PC:d=o['d'];quality='approximate'
        patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,o['kind'],ident)}
        continue
    add(ident,q['proper'] or q['bf'].strip() or q['gl'] or ('HIP '+q['hip'] if q['hip'] else 'HYG '+q['id']),'star',d,ra,dec,quality,method if d else 'Расстояние неизвестно. Запись доступна только в атласе.',aliases,number(q['mag']),'HYG',extra)
coverage['HYG']={'rows':len(hyg),'represented':len(hyg),'sunIncluded':True,'matchedUncertainties':sum(q['uncertaintyMatched'] for q in astrometry_audit)}
dump(ROOT/'data-tools/hyg-astrometry-audit.json',{'policy':'Only matching parallax-distance solutions supply sigma; adopted/manual distances retain unknown sigma.','rows':astrometry_audit})

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
    if extraDist.get('distanceMpc'):
        method='Независимая опубликованная дальность SIMBAD mesDistance; метод '+str(extraDist.get('method','catalog'))+', '+str(extraDist.get('reference',''))+'.'
        ext.update(referenceURL=extraDist.get('referenceUrl','https://simbad.cds.unistra.fr/'),distanceReference=extraDist.get('reference'),distanceErrorMinusLy=extraDist.get('errorMinusMpc')*1e6*PC if extraDist.get('errorMinusMpc') is not None else None,distanceErrorPlusLy=extraDist.get('errorPlusMpc')*1e6*PC if extraDist.get('errorPlusMpc') is not None else None,redshiftIndependent=True)
    elif kind=='galaxy' and z and 0<z<COORDINATE_POLICY['redshiftOnlyMinZ']:
        ext.update(atlasOnly=True,positionReason='Малое красное смещение без независимой дальности: пекулярная скорость сопоставима с cz. Только атлас.')
    if q['Name']=='NGC5866':ext['referenceURL']='https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/'
    if kind=='galaxy' and d:ext['diameterLy']=d*major*math.pi/10800 if major else 30000;ext['sizeEstimated']=not bool(major)
    if ident in byid:
        o=byid[ident]
        if ext.get('atlasOnly'):policies[ident]={'atlasOnly':True,'positionReason':ext['positionReason']}
        if not o.get('p3') or q['Name'] in lowz['objects'] and extraDist.get('distanceMpc'):
            patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,kind,ident),**ext}
        continue
    aliases=[q['Name'],q['Name'].replace('NGC0','NGC ').replace('IC0','IC '),*q['Common names'].split(','),*q['Identifiers'].split(',')]
    if q['M']:aliases+=['M'+str(int(q['M'])),'M '+str(int(q['M'])),'Мессье '+str(int(q['M']))]
    name=q['Common names'].split(',')[0] or ('M'+str(int(q['M'])) if q['M'] else q['Name'])
    add(ident,name,kind,d,ra,dec,quality,method,aliases,number(q['V-Mag']),'OpenNGC',ext)
coverage['LowZIndependent']={'rows':len(lowz['objects']),'represented':len(lowz['objects']),'measured':sum(v['status']=='measured' for v in lowz['objects'].values()),'atlasOnly':sum(v['status']=='unresolved' for v in lowz['objects'].values())}
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
        row[11]['invalidIdentification']=True;row[11]['atlasOnly']=True;row[12]=row[13]=None

psr_path=RAW/'psrcat.db'
if not psr_path.exists():psr_path=ROOT.parent/'research-data/psrcat.db'
pulsars=[];current={};pulsar_audit=[];parameter_errors={}
for line in psr_path.read_text().splitlines():
    if line.startswith('@'):
        if current:pulsars.append(current);current={}
    elif line and not line.startswith('#'):
        parts=line.split()
        if len(parts)>1:
            current[parts[0]]=parts[1]
            if parts[0]=='PX' and len(parts)>2 and number(parts[2]) is not None:
                parameter_errors[current.get('PSRJ','')]=number(parts[2])*10**(int(parts[1].lower().split('e')[1]) if 'e' in parts[1].lower() else 0)/10**(len(parts[1].lower().split('e')[0].split('.')[1]) if '.' in parts[1].lower().split('e')[0] else 0)
if current:pulsars.append(current)
# Use one documented compact host model for every associated GC pulsar. Individual
# DM/DIST_A values remain provenance, not contradictory depths inside one cluster.
gc_data=json.loads((ROOT/'data-tools/globular-cluster-models.json').read_text())
gc_hosts={};gc_audit=[]
for name in sorted(set(m[1] for q in pulsars if (m:=re.search(r'(?:^|,)GC:([^,\[]+)',q.get('ASSOC',''))))):
    keys=[norm(name).replace('terzan','ter')]+[norm(t) for t in re.findall(r'(?:NGC|IC)\s*\d+',name,re.I)]
    messier=re.fullmatch(r'M(\d+)',name,re.I)
    if messier:keys += [norm(r['Name']) for r in ngc if r['M'] and int(r['M'])==int(messier[1])]
    old=next((o for o in core if o['kind']=='cluster' and any(k in [norm(v) for v in [o['name'],*o.get('aliases',[]),'M'+str(o.get('messier',''))]] for k in keys)),None)
    if old and old.get('ngc'):keys.append(norm(old['ngc']))
    model=next((gc_data['clusters'][k] for k in keys if k in gc_data['clusters']),None)
    if not model or '?' in name:continue
    d=model['distanceKpc']*1000*PC;radius=model['tidalRadiusPc']*PC
    if not 0<radius<=COORDINATE_POLICY['compactHostMaxRadiusPc']*PC or model['distanceErrorKpc']/model['distanceKpc']>COORDINATE_POLICY['compactHostMaxRelativeDistanceError']:continue
    catname=model['name'].replace(' ','').upper();ident=old['id'] if old else rawmap.get('ngc:'+catname,'gc-'+norm(model['name']))
    p3=sky(model['raDeg'],model['decDeg'],d);display=[p3[0],-p3[1]]
    host={'id':ident,'name':model['name'],'d':d,'raDeg':model['raDeg'],'decDeg':model['decDeg'],'p3':p3,'display':{'x':display[0],'y':display[1]},'model':model}
    note='Общая дальность скопления '+model['name']+' по авторской компиляции Baumgardt: '+str(model['distanceKpc'])+' ± '+str(model['distanceErrorKpc'])+' кпк. Это оценка центра, не индивидуальная глубина звёзд.'
    if ident in byid:
        previous=byid[ident]['d'];patches[ident]={'d':d,'raDeg':model['raDeg'],'decDeg':model['decDeg'],'positionQuality':'approximate','distanceMethod':note,'distanceSource':gc_data['source'],'display':display};policies[ident]={'atlasOnly':False};byid[ident].update(host)
    else:
        row=next((r for r in records if r[0]==ident),None)
        if row:
            previous=row[3];row[3:8]=[d,model['raDeg'],model['decDeg'],'approximate',note];row[11].update(atlasOnly=False,referenceURL=gc_data['source'],distanceErrorLy=model['distanceErrorKpc']*1000*PC);row[12:14]=display
        else:
            previous=None;add(ident,model['name'],'cluster',d,model['raDeg'],model['decDeg'],'approximate',note,[name],None,'GlobularModels',{'referenceURL':gc_data['source'],'diameterLy':2*model['halfLightRadiusPc']*PC,'catalogType':'GCl'})
    gc_hosts[name]=host
    gc_audit.append({'host':ident,'association':name,'oldDistanceLy':previous,'distanceLy':d,'tidalRadiusLy':radius,'distanceErrorLy':model['distanceErrorKpc']*1000*PC,'source':gc_data['source']})
dump(ROOT/'data-tools/globular-host-audit.json',{'source':gc_data['source'],'rows':gc_audit})
coverage['GlobularModels']={'rows':len(gc_data['clusters']),'represented':len(gc_audit),'selection':'Only ATNF-associated compact hosts with tidal radius <=500 pc and relative distance error <=0.2'}
knownpsr={'J0835-4510':'vela','J0534+2200':'crab','J0633+1746':'iau-geminga','J1300+1240':'iau-lich','J1412+7922':'iau-calvera'}
for q in pulsars:
    name=q['PSRJ'];ident=knownpsr.get(name,'atnf-'+name.lower());rawmap['atnf:'+name]=ident
    ra,dec=sex(q.get('RAJ'),True),sex(q.get('DECJ'));d=None;quality='unknown';method='Расстояние неизвестно; положение на карте условное.'
    ext={'periodSeconds':number(q.get('P0')),'binaryModel':q.get('BINARY'),'association':q.get('ASSOC')}
    independent=number(q.get('DIST_A'));px=number(q.get('PX'));pxerr=parameter_errors.get(name)
    dm=number(q.get('DIST_DM'));dm1=number(q.get('DIST_DM1'))
    # 25 kpc in YMW16 and ~50 kpc in NE2001 are model boundaries, not distances.
    saturated=(dm is not None and dm>=COORDINATE_POLICY['forbiddenDMModelKpc']['YMW16']) or (dm1 is not None and dm1>=COORDINATE_POLICY['forbiddenDMModelKpc']['NE2001'])
    conflict=bool(dm and dm1 and max(dm,dm1)/min(dm,dm1)>COORDINATE_POLICY['maxDMModelRatio'])
    host=None
    association=re.search(r'(?:^|,)GC:([^,\[]+)',q.get('ASSOC',''))
    if association:host=gc_hosts.get(association[1])
    if re.search(r'(?:^|,)EXGAL:',q.get('ASSOC','')):
        d=independent*1000*PC if independent and independent>0 else None;quality='approximate' if d else 'unknown'
        method='ATNF: принадлежность другой галактике не измеряет индивидуальную глубину пульсара. Общая дальность хозяина не используется как точка полёта. Только атлас.'
        ext.update(atlasOnly=True,positionReason=method,unresolvedHostDepth=True)
    elif association:
        ext.update(catalogDistanceAKpc=independent,distanceHost=host['id'] if host else None)
        if host and ra is not None and dec is not None:
            u,major,minor=sky_basis(host['raDeg'],host['decDeg'],0);v=sky_unit(ra,dec);den=sky_dot(u,v);d=host['d']/den if den>0 else None
            offset=math.sqrt(max(0,d*d-host['d']**2)) if d else math.inf;radius=host['model']['tidalRadiusPc']*PC
            accepted=offset<=radius
            method='ATNF GC: '+host['name']+'. Общее расстояние центра по Baumgardt; направление пульсара измерено. Номинальная глубина — плоскость центра, допустимый диапазон ограничен модельным приливным радиусом ±'+str(round(radius))+' св. лет. Это не измеренная глубина и не точная внутренняя 3D-карта.'
            quality='approximate';ext.update(referenceURL=gc_data['source'],positionEstimate={'method':'bounded-compact-host','anchor':host['id'],'anchorName':host['name'],'localEnvelopeLy':radius,'referenceScaleLy':2*radius,'sharedDistanceErrorLy':host['model']['distanceErrorKpc']*1000*PC,'envelopeMeaning':'Приливный радиус ограничивает неизвестную глубину; общая ошибка расстояния центра коррелирована.'},placementNote=method)
            if not accepted:ext.update(atlasOnly=True,positionReason='Направление не попадает в ограниченную область ассоциированного скопления. Только атлас.')
        else:
            d=independent*1000*PC if independent else None;quality='approximate' if d else 'unknown';method='ATNF GC: нет проверенного компактного хозяина и локального диапазона глубины. Только атлас.';ext.update(atlasOnly=True,positionReason=method)
    elif independent and independent>0:
        d=independent*1000*PC;quality='approximate';method='ATNF 2.9.0 DIST_A: независимая оценка расстояния.'
    elif px and pxerr is not None and px>3*pxerr and pxerr>0:
        d=1000/px*PC;quality='approximate';method='ATNF: параллакс с отношением сигнал/ошибка >3; расстояние ≈1/PX.';ext['distanceRelativeError']=pxerr/px
    elif host:
        d=host['d'];quality='approximate';method='Оценка по принадлежности к '+host['name']+' (ASSOC ATNF); индивидуальная глубина в скоплении неизвестна.';ext.update(distanceHost=host['id'],referenceURL=host.get('source') or 'https://www.atnf.csiro.au/research/pulsar/psrcat/')
    elif saturated or conflict:
        d=(dm or dm1)*1000*PC if dm or dm1 else None;quality='approximate';method='ATNF: '+('предел электронной модели вместо расстояния.' if saturated else 'оценки двух электронных моделей расходятся более чем вдвое.')+' Только атлас; пригодного расстояния нет.';ext.update(atlasOnly=True,positionReason=method)
    elif dm and dm>0 or dm1 and dm1>0:
        d=(dm or dm1)*1000*PC;quality='approximate';method='ATNF: модельное расстояние по дисперсии '+('YMW16' if dm else 'NE2001')+'; индивидуальная погрешность не измерена.'
    else:
        ext.update(atlasOnly=True,positionReason='Нет независимой или пригодной модельной оценки расстояния. Только атлас.')
    ext.update(distanceModelKpc=dm,distanceModel1Kpc=dm1)
    pulsar_audit.append({'id':ident,'distanceLy':d,'atlasOnly':bool(ext.get('atlasOnly')),'host':host['id'] if host else None,'modelBoundary':saturated,'modelConflict':conflict,'method':method})
    if (ra is None or dec is None) and number(q.get('ELONG')) is not None and number(q.get('ELAT')) is not None:
        l,b=math.radians(float(q['ELONG'])),math.radians(float(q['ELAT']));e=math.radians(23.4392911)
        x=math.cos(b)*math.cos(l);y=math.cos(b)*math.sin(l)*math.cos(e)-math.sin(b)*math.sin(e);z=math.cos(b)*math.sin(l)*math.sin(e)+math.sin(b)*math.cos(e)
        ra=math.degrees(math.atan2(y,x))%360;dec=math.degrees(math.asin(z))
    if ident in byid:
        # Named landmark distances have independent sources; preserve them.
        if name not in knownpsr:
            policies[ident]={**ext,'atlasOnly':bool(ext.get('atlasOnly'))}
            patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,'pulsar',ident)}
        elif not byid[ident].get('p3'):patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':quality,'distanceMethod':method,'display':projection(ra,dec,d,'pulsar',ident)}
        continue
    row=add(ident,'PSR '+name,'pulsar',d,ra,dec,quality,method,['PSR '+name,name,q.get('PSRB','')],None,'ATNF',ext)
    if association and host and not ext.get('atlasOnly'):
        # Local sky view avoids edge-on collapse of an unresolved depth model.
        row[12]=host['display']['x']+d*sky_dot(v,major)
        row[13]=host['display']['y']-d*sky_dot(v,minor)
coverage['ATNF']={'rows':len(pulsars),'represented':len(pulsars),'unreliableAtlasOnly':sum(q['atlasOnly'] for q in pulsar_audit),'modelBoundary':sum(q['modelBoundary'] for q in pulsar_audit),'hostDistance':sum(q['host'] is not None and not q['atlasOnly'] for q in pulsar_audit)}
dump(ROOT/'data-tools/pulsar-distance-audit.json',{'policy':'EXGAL atlas-only; GC membership uses a verified bounded compact host before individual DIST_A/DM; otherwise DIST_A > PX significance >3 > nonsaturated DM. Shared nominal host depth is explicitly bounded and never randomized.','sources':['https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html','https://doi.org/10.3847/1538-4357/835/1/29'],'rows':pulsar_audit})

# Measured directions of individually known members of nearby galaxies.
# Use justified M31/LMC disk models; unresolved SMC depth remains atlas-only.
disk_models=json.loads((ROOT/'data-tools/galaxy-disk-models.json').read_text())
for member in json.loads((ROOT/'data-tools/nearby-galaxy-stars.json').read_text())['stars']:
    host=byid[member['host']];d=host['d'];p3=sky(member['raDeg'],member['decDeg'],d)
    note='Измеренное направление отдельной звезды. Расстояние принято по '+host['name']+'; глубина внутри галактики не определена. Это не индивидуальный параллакс.'
    row=add('member-'+member['id'],member['name'],'star',d,member['raDeg'],member['decDeg'],'approximate',note,[*member['aliases'],host['name'],member['host']],None,'SIMBAD',{'galaxyMember':True,'parentGalaxy':host['id'],'referenceURL':member['source'],'membershipSource':member.get('membershipSource',member['source']),'memberType':member['type'],'hostDiameterLy':host.get('galaxy',{}).get('diameterLy',30000)})
    # Anchor the measured local offset to the existing galaxy drawing; never
    # impose a global projection independently across a resolved small galaxy.
    row[12]=host['display']['x']+p3[0]-host['p3'][0]
    row[13]=host['display']['y']-(p3[1]-host['p3'][1])
    if host['id'] in disk_models:
        model=disk_models[host['id']];position=locate_disk({**member,'placement':'disk'},host,model,COORDINATE_POLICY)
        if position and position['accepted']:
            row[3]=position['distance'];note='Измеренное направление звезды; глубина оценена пересечением луча с наклонным диском '+host['name']+'. '+model['note'];row[7]=note
            row[11].update(placementNote=note,geometrySource=model['reference'],positionEstimate={'method':'host-disk','anchor':host['id'],'localEnvelopeLy':position['localEnvelopeLy'],'referenceScaleLy':position['referenceScaleLy'],'localEnvelopeFraction':position['localEnvelopeLy']/position['referenceScaleLy'],'sharedDistanceErrorLy':None,'envelopeMeaning':'Модельный диапазон глубины и чувствительности к углам; не индивидуальный параллакс.','inclinationDeg':model['inclinationDeg'],'positionAngleDeg':model['positionAngleDeg'],'nearSideKnown':True})
            g=host['galaxy'];angle=g['rotation'];u,v=position['major'],position['minor']*g['axisRatio'];row[12]=host['display']['x']+u*math.cos(angle)-v*math.sin(angle);row[13]=host['display']['y']+u*math.sin(angle)+v*math.cos(angle)
    if not row[11].get('positionEstimate'):
        row[11].update(atlasOnly=True,positionReason='Принадлежность галактике известна, индивидуальная глубина не измерена и обоснованной дисковой модели для этой звезды нет. Только атлас.')
        row[12]=row[13]=None
    records.pop();member_rows.append(row)
coverage['NearbyGalaxyStars']={'rows':len(member_rows),'represented':len(member_rows)}

# Observed members of nearby galaxies. Disk intersection is used only for
# spectroscopically identified massive stars / gas; unaged PHAT clusters remain atlas-only.
disk_models=json.loads((ROOT/'data-tools/galaxy-disk-models.json').read_text());disk_audit=[]
disk_rows=json.loads((ROOT/'data-tools/galaxy-disk-objects.json').read_text())['objects']
for member in disk_rows:
    host=byid[member['host']];model=disk_models[host['id']];position=locate_disk(member,host,model,COORDINATE_POLICY)
    duplicates=[r for r in member_rows if r[11].get('parentGalaxy')==host['id'] and math.hypot((r[4]-member['raDeg'])*math.cos(math.radians(member['decDeg'])),r[5]-member['decDeg'])<1.5/3600]
    if duplicates:
        duplicates[0][8]=list(dict.fromkeys(duplicates[0][8]+member['aliases']+[member['name']]))
        disk_audit.append({'id':member['id'],'action':'alias-of-existing-member','target':duplicates[0][0]});continue
    if not position:disk_audit.append({'id':member['id'],'action':'invalid-intersection'});continue
    local=position['localEnvelopeLy'];mode=position['mode'];valid=position['accepted']
    note=('Пересечение измеренного луча зрения с моделью наклонного диска '+host['name']+'. ' if mode=='host-disk' else 'Членство в '+host['name']+' по каталогу PHAT; принята общая дальность, индивидуальная глубина не измерена. Это не модель тонкого диска для старых/неизвестных скоплений; запись доступна только в атласе. ')+model['note']
    estimate={'method':mode,'anchor':host['id'],'localEnvelopeLy':local,'referenceScaleLy':position['referenceScaleLy'],'localEnvelopeFraction':local/position['referenceScaleLy'],'sharedDistanceErrorLy':None,'sharedDistanceNote':'Неопределённость общей дальности галактики не задана; коррелирована для всех её членов.','envelopeMeaning':'Модельный диапазон по толщине, чувствительности к углам ±3° и неоднозначности наклона; не измеренная индивидуальная sigma.','inclinationDeg':model['inclinationDeg'],'positionAngleDeg':model['positionAngleDeg'],'nearSideKnown':model['nearSideKnown']}
    extra={'galaxyMember':True,'bulkGalaxyMember':True,'parentGalaxy':host['id'],'referenceURL':member['source'],'membershipSource':member['source'],'memberType':member['type'],'hostDiameterLy':host.get('galaxy',{}).get('diameterLy',30000),'positionEstimate':estimate,'placementNote':note,'membershipNote':member['membership'],'geometrySource':model['reference']}
    if member['kind']=='nebula':extra['catalogType']='SNR' if member['id'].startswith('m33-snr-') else 'HII'
    if member.get('diameterPc'):extra['diameterLy']=member['diameterPc']*PC
    if member.get('halfLightRadiusArcsec') and member['halfLightRadiusArcsec']>0:extra['halfLightRadiusLy']=member['halfLightRadiusArcsec']*math.pi/648000*position['distance']
    if member.get('crowding'):extra['crowding']=member['crowding']
    if not valid:extra.update(atlasOnly=True,positionReason='Нет модели индивидуальной глубины: известна только принадлежность хозяину. Только атлас.' if mode=='host-envelope' else 'Модель выходит за принятый радиус галактики либо локальный диапазон превышает половину модельного диаметра. Только атлас.')
    row=add(member['id'],member['name'],member['kind'],position['distance'],member['raDeg'],member['decDeg'],'approximate',note,member['aliases']+[host['name']],member.get('magV'),'GalaxyDisks',extra)
    # Rotate the host-local inferred disk coordinates into its existing schematic optical outline.
    g=host.get('galaxy',{});angle=g.get('rotation',0);u,v=position['major'],position['minor']*g.get('axisRatio',math.cos(math.radians(model['inclinationDeg'])))
    row[12]=host['display']['x']+u*math.cos(angle)-v*math.sin(angle);row[13]=host['display']['y']+u*math.sin(angle)+v*math.cos(angle)
    disk_audit.append({'id':member['id'],'host':host['id'],'action':'map' if valid else 'atlas-only','method':mode,'radiusLy':position['radius'],'localEnvelopeLy':local,'localEnvelopeFraction':local/position['referenceScaleLy']})
coverage['GalaxyDisks']={'rows':len(disk_rows),'represented':len(disk_rows),'added':sum(q['action'] in ('map','atlas-only') for q in disk_audit),'mapped':sum(q['action']=='map' for q in disk_audit),'merged':sum(q['action']=='alias-of-existing-member' for q in disk_audit)}
dump(ROOT/'data-tools/galaxy-disk-audit.json',{'policy':COORDINATE_POLICY,'rows':disk_audit})

# OGLE publishes distances for the individual Cepheids, including the deep,
# non-planar SMC. Do not flatten them onto either a host shell or a disk.
ogle=json.loads((ROOT/'data-tools/magellanic-cepheids.json').read_text())
population_scales={}
for location in ('LMC','SMC','MBR'):
    group=[m for m in ogle['objects'] if m['location']==location]
    points=[sky(m['raDeg'],m['decDeg'],m['distanceKpc']*1000*PC) for m in group]
    center=[sum(p[i] for p in points)/len(points) for i in range(3)]
    radii=sorted(math.dist(p,center) for p in points)
    population_scales[location]=2*radii[min(len(radii)-1,int(.95*len(radii))) ]
# The map looks at each resolved galaxy along its line of sight, as a sky image.
# Infer only a 2D position angle from the observed population to align that image
# with the existing schematic outline. This angle never supplies physical depth.
population_frames={}
for host_id in ('lmc','smc'):
    host=byid[host_id];u,east,north=sky_basis(host['raDeg'],host['decDeg'],90)
    directions=[sky_unit(m['raDeg'],m['decDeg']) for m in ogle['objects'] if m['host']==host_id]
    xy=[(sky_dot(v,east),-sky_dot(v,north)) for v in directions]
    mx=sum(x for x,y in xy)/len(xy);my=sum(y for x,y in xy)/len(xy)
    xx=sum((x-mx)**2 for x,y in xy);yy=sum((y-my)**2 for x,y in xy);cross=sum((x-mx)*(y-my) for x,y in xy)
    theta=.5*math.atan2(2*cross,xx-yy)
    population_frames[host_id]=(u,east,north,host['galaxy']['rotation']-theta)
ogle_audit=[];ogle_rows=[]
for member in ogle['objects']:
    host=byid.get(member['host']);d=member['distanceKpc']*1000*PC;error=member['distanceErrorKpc']*1000*PC
    scale=population_scales[member['location']]
    valid=error/d<=MAX_RELATIVE_ERROR and error/scale<=COORDINATE_POLICY['hostMaxLocalEnvelopeFraction']
    note='OGLE 2016, Table 3: индивидуальная дальность цефеиды по периоду и величине Wesenheit; '+str(member['distanceKpc'])+' ± '+str(member['distanceErrorKpc'])+' кпк. Глубина не заменена дальностью галактики и не рандомизирована.'
    extra={'galaxyMember':bool(host),'bulkGalaxyMember':True,'referenceURL':ogle['paper'],'memberType':'Звезда · классическая цефеида','periodDays':member['periodDays'],'pulsationMode':member['mode'],'distanceRelativeError':error/d,'distanceErrorLy':error,'placementNote':note,
           'positionEstimate':{'method':'individual-period-Wesenheit','anchor':member['host'],'localEnvelopeLy':error,'referenceScaleLy':scale,'localEnvelopeFraction':error/scale,'envelopeMeaning':'Опубликованная ошибка индивидуальной дальности; опорный размер — диаметр, содержащий 95% опубликованной популяции вокруг её среднего 3D-положения. Это не доверительный интервал дисковой модели.'}}
    aliases=[member['name'],member['location']+' Cepheid']
    if host:extra['parentGalaxy']=host['id'];extra['hostDiameterLy']=scale;aliases.append(host['name'])
    else:aliases+=['Магелланов мост','Magellanic Bridge']
    if not valid:extra.update(atlasOnly=True,positionReason='Индивидуальная погрешность превышает допустимую долю размера популяции. Только атлас.')
    row=add(member['id'],member['name'],'star',d,member['raDeg'],member['decDeg'],'approximate',note,aliases,member['magV'],'OGLE',extra)
    if host and valid:
        # Orthographic sky view of the true 3D point; depth is preserved in p3
        # and flight distances, not turned into spurious transverse displacement.
        u,east,north,angle=population_frames[host['id']]
        ray=sky_unit(member['raDeg'],member['decDeg']);x=d*sky_dot(ray,east);y=-d*sky_dot(ray,north)
        row[12]=host['display']['x']+x*math.cos(angle)-y*math.sin(angle)
        row[13]=host['display']['y']+x*math.sin(angle)+y*math.cos(angle)
    ogle_rows.append(row)
    ogle_audit.append({'id':row[0],'host':member['host'],'action':'map' if valid else 'atlas-only','distanceLy':d,'errorLy':error,'referenceScaleLy':scale})
# Keep a few real departure candidates in the small bootstrap, so arriving before
# the spatial tiles finish loading does not create a fictional replacement star.
for host_id in ('lmc','smc'):
    host=byid[host_id]
    choices=sorted((r for r in ogle_rows if r[11].get('parentGalaxy')==host_id and not r[11].get('atlasOnly')),key=lambda r:math.dist(sky(r[4],r[5],r[3]),host['p3']))[:3]
    for row in choices:records.remove(row);member_rows.append(row)
coverage['OGLE']={'rows':len(ogle_rows),'represented':len(ogle_rows),'mapped':sum(r['action']=='map' for r in ogle_audit),'counts':ogle['counts'],'bootstrap':6}
dump(ROOT/'data-tools/magellanic-cepheid-audit.json',{'source':ogle['source'],'paper':ogle['paper'],'rawSHA256':ogle['rawSHA256'],'populationScalesLy':population_scales,'rows':ogle_audit})
host_coverage={}
for host_id in sorted(set(m['host'] for m in disk_rows)|set(m['host'] for m in ogle['objects'] if m['host'])):
    decisions=[q for q in disk_audit+ogle_audit if q.get('host')==host_id]
    host_coverage[host_id]={'mappedBulk':sum(q['action']=='map' for q in decisions),'atlasOnlyBulk':sum(q['action']=='atlas-only' for q in decisions),'diskModel':disk_models.get(host_id),'individualDistanceCatalog':ogle['source'] if any(m['host']==host_id for m in ogle['objects']) else None}
host_coverage['opengc-ngc6822']={'mappedBulk':0,'status':'Needs population-specific geometry or usable individual depths, not a common host distance. No claim that suitable observations do not exist.','reference':'https://academic.oup.com/mnras/article/508/2/2098/6370601','reason':'Young stars / HI disk and old spheroid differ in orientation; a single plane for every resolved member is unsupported.'}
dump(ROOT/'data-tools/galaxy-population-coverage.json',{'selection':'Hosts come from imported observed-member tables, not from a galaxy-name whitelist. A resolved image alone does not determine depth. Coverage is incomplete; unimported galaxies are not claimed to have been screened.','hosts':host_coverage,'bridgeMapped':sum(q['host'] is None and q['action']=='map' for q in ogle_audit)})


# Apply the same uncertainty ceiling to non-HYG named stars using SIMBAD.
for o in core:
    if o.get('p3') or o['id'] in patches or o.get('region') or o['kind'] in ('structure','wall','ring','arc','horizon'):continue
    ast=None
    for name in o.get('aliases',[]):
        if cache.get(name):ast=cache[name];break
    ra=number((ast or {}).get('ra'));dec=number((ast or {}).get('dec'))
    if ra is None:ra=number(o.get('raDeg'))
    if dec is None:dec=number(o.get('decDeg'))
    px=number((ast or {}).get('plx_value'));d=o.get('d')
    if not d and px and px>0:
        d=1000/px*PC;err=number(ast.get('plx_err'));rel=err/px if err is not None else None
        policies[o['id']]={'atlasOnly':rel is None or rel>MAX_RELATIVE_ERROR,'distanceRelativeError':rel,'positionReason':'Погрешность параллакса превышает 50% либо не определена. Только атлас.'}
    patches[o['id']]={'d':d,'raDeg':ra,'decDeg':dec,'positionQuality':'approximate' if d else 'unknown','distanceMethod':'Приблизительно: положительный параллакс SIMBAD с большой или неизвестной ошибкой.' if d else 'Положение неизвестно. Только атлас.','display':projection(ra,dec,d,o['kind'],o['id'])}

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
systems.append({'id':'system-alpha-centauri','name':'Альфа Центавра','confirmed':True,'relationship':'bound','members':alpha,'primary':alpha[0],'links':[[alpha[0],alpha[1]],[alpha[0],alpha[2]]],'schematic':True,'source':'https://doi.org/10.1051/0004-6361/201629930','note':'A–B: около 80 лет; Проксима (C) обращается вокруг пары AB примерно за 550 000 лет. Внешний эллипс относится к барицентру AB. Контуры на карте — схема связи, не орбитальный расчёт.'})
# Documented non-stellar systems use the same rendering model.
for q in ngc:
    if q['Type']=='GPair':
        ids=[rawmap.get('ngc:'+q['Name']+suffix) for suffix in ('A','B','C')]
        ids=[i for i in ids if i]
        if len(ids)>1:systems.append({'id':'system-'+norm(q['Name']),'name':q['Name'],'members':ids,'primary':ids[0],'links':[[ids[0],s] for s in ids[1:]],'schematic':True,'source':'https://github.com/mattiaverga/OpenNGC','note':'OpenNGC обозначает эту группу как пару галактик (GPair). Эллипсы показывают связь компонентов, а не вычисленные орбиты.'})
systems.append({'id':'system-antennae','name':'Антенны','confirmed':True,'relationship':'interacting','members':[rawmap['ngc:NGC4038'],rawmap['ngc:NGC4039']],'primary':rawmap['ngc:NGC4038'],'links':[[rawmap['ngc:NGC4038'],rawmap['ngc:NGC4039']]],'schematic':True,'source':'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-60-61/','note':'NGC 4038 и NGC 4039 — взаимодействующие галактики Антенны. Эллипс обозначает взаимодействие, не измеренную орбиту.'})
systems.append({'id':'system-cygnus-x1','name':'Лебедь X-1','members':['cygnus',rawmap['hyg:97987']],'primary':'cygnus','links':[['cygnus',rawmap['hyg:97987']]],'schematic':True,'source':'https://imagine.gsfc.nasa.gov/features/yba/CygX1_mass/cygX1_more.html','note':'Чёрная дыра Лебедь X-1 и звезда-сверхгигант HDE 226868 — компоненты двойной системы. Эллипс схематический; аккреция и движение не моделируются.'})
renames={rawmap['hyg:97987']:'HDE 226868 · звезда Лебедя X-1',alpha[0]:'Альфа Центавра A',alpha[1]:'Альфа Центавра B',alpha[2]:'Альфа Центавра C · Проксима'}

# Reconcile component distances only when a catalog explicitly groups the stars
# and a more reliable component supplies the shared distance. Keep a full audit.
confirmed_systems=json.loads((ROOT/'data-tools/confirmed-systems.json').read_text())['systems']
record_byid={row[0]:row for row in records};system_audit=[]
def component(ident):
    if ident in byid:
        o=byid[ident];patch=patches.get(ident,{})
        return {'id':ident,'d':patch.get('d',o.get('d')),'ra':patch.get('raDeg',o.get('raDeg')),'dec':patch.get('decDeg',o.get('decDeg')),'rel':policies.get(ident,{}).get('distanceRelativeError'),'hip':o.get('hip')}
    row=record_byid[ident]
    return {'id':ident,'d':row[3],'ra':row[4],'dec':row[5],'rel':row[11].get('distanceRelativeError'),'hip':row[11].get('hip')}
def update_component(q,d,note,display=None,p3=None):
    ident=q['id'];ra=q['ra'];dec=q['dec'];pos=p3 or sky(ra,dec,d)
    display=display or projection(ra,dec,d,'star',ident)
    if ident in byid:
        patches[ident]={'d':d,'raDeg':ra,'decDeg':dec,'p3':pos,'positionQuality':'approximate','distanceMethod':note,'display':display,'catalogDistanceLy':q['d']}
        policies[ident]={'atlasOnly':False,'distanceRelativeError':None,'astrometrySource':'Documented system membership estimate','uncertaintyMatched':False,'positionReason':''}
    else:
        row=record_byid[ident];row[11].update(catalogDistanceLy=q['d'],atlasOnly=False,distanceRelativeError=None,uncertaintyMatched=False,astrometrySource='Documented system membership estimate');row[11].pop('parallaxMas',None);row[11].pop('parallaxErrorMas',None);row[11].pop('positionReason',None);row[3]=d;row[6]='approximate';row[7]=note;row[12],row[13]=display
for system in systems:
    members=[component(i) for i in system['members']]
    valid=[q for q in members if q['d'] and q['ra'] is not None and q['dec'] is not None]
    if len(valid)<2:continue
    if system['id']=='system-cygnus-x1':
        bh=byid['cygnus'];q=component(rawmap['hyg:97987']);period=5.6/365.25
        separation=(61.8*period**2)**(1/3)/63241.077
        # Relative orbital phase is not in the catalog: choose a labelled snapshot.
        ra=math.radians(bh['raDeg']);tangent=[-math.sin(ra),math.cos(ra),0]
        tangent=[sum(x*y for x,y in zip(row,tangent)) for row in MATRIX]
        pos=[v+separation*tangent[i] for i,v in enumerate(bh['p3'])]
        display=[bh['display']['x']+separation*tangent[0],bh['display']['y']-separation*tangent[1]]
        note='Расстояние двойной системы Лебедь X-1 ≈7200 св. лет (Miller-Jones et al. 2021). Масштаб разделения ≈0,24 а.е. из периода 5,6 суток и суммарной массы ≈61,8 M☉; ориентация и фаза игровой схемы условны.'
        update_component(q,math.hypot(*pos),note,display,pos)
        system.update(source='https://doi.org/10.1126/science.abb3363',note=note,separationLy=separation,confirmed=True,relationship='bound')
        system_audit.append({'system':system['id'],'action':'published-system-distance','member':q['id'],'oldDistanceLy':q['d'],'distanceLy':bh['d'],'separationLy':separation})
        continue
    confirmed=confirmed_systems.get(system['id'])
    if confirmed:
        system.update(confirmed=True,relationship=confirmed['relationship'],source=confirmed['membershipSource'],note=confirmed['note'])
        for q in valid:
            update_component(q,confirmed['distanceLy'],confirmed['note'])
            primary=valid[0];anchor=sky(primary['ra'],primary['dec'],confirmed['distanceLy'])
            if q['id'] in record_byid:record_byid[q['id']][11].update(boundSystemPrimary=primary['id'],systemAnchorP3=anchor)
            else:policies[q['id']].update(boundSystemPrimary=primary['id'],systemAnchorP3=anchor)
            if q['id'] in record_byid:record_byid[q['id']][11]['referenceURL']=confirmed['source']
            else:patches[q['id']]['distanceSource']=confirmed['source']
            system_audit.append({'system':system['id'],'action':'confirmed-membership-distance','member':q['id'],'oldDistanceLy':q['d'],'distanceLy':confirmed['distanceLy'],'source':confirmed['source']})
        valid=[component(q['id']) for q in valid]
    if system.get('confirmed'):
        primary=next((q for q in valid if q['id']==system['primary']),valid[0]);anchor=sky(primary['ra'],primary['dec'],primary['d'])
        for q in valid:
            if q['id'] in record_byid:record_byid[q['id']][11].update(boundSystemPrimary=primary['id'],systemAnchorP3=anchor)
            else:policies.setdefault(q['id'],{}).update(boundSystemPrimary=primary['id'],systemAnchorP3=anchor)
    spread=max(q['d'] for q in valid)/min(q['d'] for q in valid)-1
    is_hyg='HYG' in system['source']
    anchor=min(valid,key=lambda q:q['rel'] if q['rel'] is not None else 99)
    if spread>.1 and is_hyg and anchor['rel'] is not None and anchor['rel']<=.2:
        precise=[q for q in valid if q['rel'] is not None and q['rel']<=.2]
        conflict=any(abs(q['d']-anchor['d'])>3*math.hypot(q['d']*q['rel'],anchor['d']*anchor['rel']) for q in precise)
        if not conflict:
            for q in valid:
                angle=math.hypot((q['ra']-anchor['ra'])*math.cos(math.radians(anchor['dec'])),q['dec']-anchor['dec'])
                if q['id']==anchor['id'] or angle>.1:continue
                if q['rel'] is not None and q['rel']<=anchor['rel']:continue
                note='Оценка расстояния по компоненту '+anchor['id']+' той же группы HYG; собственная глубина не измерена. Исходное каталожное расстояние сохранено отдельно.'
                update_component(q,anchor['d'],note)
                system_audit.append({'system':system['id'],'action':'shared-component-distance-estimate','member':q['id'],'anchor':anchor['id'],'oldDistanceLy':q['d'],'distanceLy':anchor['d']})
            valid=[component(q['id']) for q in valid];spread=max(q['d'] for q in valid)/min(q['d'] for q in valid)-1
    if spread>.2 and not system.get('confirmed'):
        system['links']=[];system['associationOnly']=True
        system['note']='Каталожная группа обозначений; физическая связь не подтверждается согласованными расстояниями. Орбитальные эллипсы не показаны. Возможна оптическая пара либо ошибка расстояния.'
        system_audit.append({'system':system['id'],'action':'distance-conflict-no-orbit','members':valid})
        continue
    # One local display transform keeps close components together.
    primary=component(system['primary']);base=patches.get(primary['id'],{}).get('display') or (byid[primary['id']]['display'].values() if primary['id'] in byid else record_byid[primary['id']][12:14])
    base=list(base)
    if any(v is None for v in base):base=projection(primary['ra'],primary['dec'],primary['d'],'star',primary['id'])
    center=sky(primary['ra'],primary['dec'],primary['d'])
    for q in valid:
        pos=sky(q['ra'],q['dec'],q['d']);offset=math.hypot(*[pos[i]-center[i] for i in range(3)])
        if offset>primary['d']*.1:continue
        display=[base[0]+pos[0]-center[0],base[1]-pos[1]+center[1]]
        if q['id'] in byid:
            # A display patch doesn't alter a component's independent 3D position.
            o=byid[q['id']];old=patches.get(q['id'],{})
            patches[q['id']]={**old,'d':q['d'],'raDeg':q['ra'],'decDeg':q['dec'],'distanceMethod':old.get('distanceMethod',o.get('coordinateNote','Каталожная позиция.')),'positionQuality':old.get('positionQuality','catalog'),'display':display}
        else:record_byid[q['id']][12:14]=display

dump(ROOT/'data-tools/system-position-audit.json',system_audit)

# Explicit published system estimates can override an unresolved individual low-z record.
coverage['LowZIndependent']['documentedSystemEstimates']=sum(v['status']=='unresolved' and not (policies.get(rawmap.get('ngc:'+name),{}).get('atlasOnly',False) if rawmap.get('ngc:'+name) in byid else record_byid[rawmap['ngc:'+name]][11].get('atlasOnly',False)) for name,v in lowz['objects'].items())
coverage['LowZIndependent']['atlasOnly']-=coverage['LowZIndependent']['documentedSystemEstimates']
OUT.mkdir(exist_ok=True)
for f in OUT.glob('*.json'):
    if re.fullmatch(r'(?:\d+|atlas-\d+|search|manifest)\.json',f.name):f.unlink()
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
# One spatial hierarchy, never radial bands. Parent hash samples are subsets of
# the union of child samples, so refining preserves already visible representatives.
atlas_only=[];mapped=[]
for r in records:
    if r[11].get('atlasOnly') or r[6]=='unknown':r[11]['atlasOnly']=True;r[12]=r[13]=None;atlas_only.append(r)
    else:mapped.append(r)
roots=[tile(mapped)] if mapped else []
for i in range(0,len(atlas_only),256):
    file='atlas-'+str(i//256)+'.json';rows=atlas_only[i:i+256];dump(OUT/file,rows)
    for r in rows:locations[r[0]]=file
for r in records:
    key=re.sub(r'(ngc|ic)0+(?=\d)',r'\1','|'+'|'.join(norm(v) for v in [r[0],r[1],*r[8],r[11].get('ngc','')])+'|')
    index.append([r[0],r[1],r[2],r[3],r[6],locations[r[0]],key,bool(r[11].get('atlasOnly'))])
dump(OUT/'search.json',index)
revision=hashlib.sha256(Path(__file__).read_bytes()+b''.join(hashlib.sha256(p.read_bytes()).digest() for p in [RAW/'hyg_v41.csv',RAW/'NGC.csv',psr_path,ROOT/'data-tools/hipparcos-errors.json',ROOT/'data-tools/low-z-galaxy-distances.json',ROOT/'data-tools/hipparcos-2007.json',ROOT/'data-tools/astrometry_policy.py',ROOT/'data-tools/globular-cluster-models.json',ROOT/'data-tools/nearby-galaxy-stars.json',ROOT/'data-tools/confirmed-systems.json',ROOT/'data-tools/coordinate-policy.json',ROOT/'data-tools/galaxy-disk-models.json',ROOT/'data-tools/galaxy-disk-objects.json',ROOT/'data-tools/magellanic-cepheids.json',ROOT/'data-tools/disk_geometry.py'])+json.dumps(core,ensure_ascii=False).encode()).hexdigest()[:12]
summary={'version':2,'mapProjection':'orthographic-galactic-xy','revision':revision,'total':len(core)+len(member_rows)+len(records),'core':len(core)+len(member_rows),'extra':len(records),'sourceCoverage':coverage,'mapRows':len(records)-len(atlas_only),'atlasOnlyRows':len(atlas_only),'unknownExtra':sum(r[6]=='unknown' for r in records),'approximateExtra':sum(r[6]=='approximate' for r in records),'nodes':nodes,'roots':roots,'search':'search.json','systems':len(systems),'foregroundWithin50':len(foreground)}
dump(OUT/'manifest.json',summary)
boot={'geometryVersion':2,'coordinateCorrections':[r for r in records if r[11].get('boundSystemPrimary') or r[11].get('redshiftIndependent') or r[11].get('distanceHost') or r[11].get('catalogDistanceLy') is not None or r[10]=='GlobularModels'],'revision':revision,'members':member_rows,'policies':policies,'hiddenIds':[r[0] for r in atlas_only+member_rows if r[11].get('atlasOnly')],'total':summary['total'],'patches':patches,'foreground':foreground,'systems':systems,'renames':renames,'sourceCoverage':coverage,'pulsarCorrections':[r for r in records if r[10]=='ATNF' and (r[11].get('distanceHost') or 'параллакс' in r[7]) and not r[11].get('atlasOnly')],'systemTiles':{i:locations[i] for s in systems for i in s['members'] if i in locations},'rawMap':{k:v for k,v in rawmap.items() if k.startswith('atnf:') and v in byid}}
(ROOT/'dist/catalog-extended.js').write_text('// Generated from complete local source snapshots.\nconst EXTENDED_BOOT='+json.dumps(boot,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n')
dump(ROOT/'data-tools/full-catalog-audit.json',{'total':summary['total'],'core':len(core)+len(member_rows),'extra':len(records),'sourceCoverage':coverage,'mappedRows':summary['mapRows'],'atlasOnlyRows':summary['atlasOnlyRows'],'leafRecords':len(locations),'foreground':foreground,'systems':len(systems),'unknownExtra':summary['unknownExtra'],'approximateExtra':summary['approximateExtra'],'sourceSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [RAW/'hyg_v41.csv',RAW/'NGC.csv',psr_path]}})
html=ROOT/'dist/index.html';html.write_text(re.sub(r'(catalog-extended\.js\?v=)[^\"]+',lambda m:m[1]+revision,html.read_text()))
# Keep the public provenance index in sync with the actual generated catalog.
source_path=ROOT/'dist/catalog-sources.json';source_info=json.loads(source_path.read_text());full=source_info.setdefault('fullCatalog',{})
full.update(records=summary['total'],coordinatePolicy='data-tools/coordinate-policy.json',diskModels='data-tools/galaxy-disk-models.json',diskSelection='data-tools/galaxy-disk-objects.json',diskAudit='data-tools/galaxy-disk-audit.json',pulsarAudit='data-tools/pulsar-distance-audit.json')
full['coverage'].update({key:value['represented'] for key,value in coverage.items()})
full['search']='Lazy '+str(round((OUT/'search.json').stat().st_size/1e6,1))+' MB compact worker index; 100 results initially'
full['map']='Orthographic Galactic XY plus explicit host-local views; one spatial binary tree (no radial bands); max256 leaf rows, 48 cached tiles, 32 view nodes, 4 concurrent loads, 8000 streamed points'
full['uncertainty']='Formal policy v4: HYG sigma is attached only to the matching HIP2007/HIP1997 solution; unmatched adopted distances retain unknown sigma. Bounded compact GC hosts use published distance/error and tidal radius; galaxy membership alone never supplies depth.  bounded point estimates only; no sentinels or model bounds. Field reported relative error <=0.5, ATNF PX significance >3 and DM-model ratio <=2. Host-local model envelope <=0.5 of its reference diameter; common host-distance error is correlated, not independent scatter. Full definitions in docs/catalog.md.'
full['nearbyGalaxyStars']['distance']='M31 V1/AF and LMC R136a1: justified inclined-disk model. HD5980: atlas-only, unresolved depth. OGLE Clouds: individual period-Wesenheit distances.'
full['galaxyMembers']={'inputRows':len(disk_rows),'added':coverage['GalaxyDisks']['added'],'selection':'LGGS Mm=1; PHAT main table2 only; M33 SNR Conf=yes','model':'Measured directions; disk-ray intersections for massive stars/gas; unaged PHAT clusters atlas-only, no individual depth; M33 mirror ambiguity included.'}
full['magellanicCepheids']={'inputRows':len(ogle_rows),'mapped':coverage['OGLE']['mapped'],'counts':ogle['counts'],'method':'Individual published period-Wesenheit distances and errors; no common host shell or disk approximation. Host-local display uses an orthographic sky view of true 3D coordinates, rotated to align the observed population with its schematic outline; physical depth remains in p3.'}
full['galaxyPopulationCoverage']='data-tools/galaxy-population-coverage.json'
source_info['provenance']=[q for q in source_info['provenance'] if q.get('url')!=ogle['source']]
source_info['provenance'].append({'name':'OGLE, Jacyszyn-Dobrzeniecka et al. 2016, Acta Astronomica 66,149, Table 3','url':ogle['source'],'paper':ogle['paper'],'changes':'All 8885 published individual distances, reported errors and measured RA/Dec. Original magnitudes, periods and pulsation modes retained.','access':'Public author table; credited to OGLE and authors. Original data rights are not relicensed under the game code license.'})
for name,catalog,changes in [('LGGS, Massey et al. 2016','J/AJ/152/62','Spectroscopic membership Mm=1; original measured directions, spectral types and Rgc preserved.'),('PHAT/AP, Johnson et al. 2015','J/ApJ/802/127','Main cluster table2 only (2753 observed clusters), no synthetic/ancillary/background tables.'),('M33 SNRs, Long et al. 2018','J/ApJ/855/140','Conf=yes in table1; observed directions and diameters, no random positions.')]:
    url='https://cdsarc.cds.unistra.fr/viz-bin/cat/'+catalog
    source_info['provenance']=[q for q in source_info['provenance'] if q.get('url')!=url]
    source_info['provenance'].append({'name':name,'url':url,'changes':changes,'access':'CDS/VizieR; originating author/publisher rights apply; see THIRD_PARTY_NOTICES.md'})
source_info['provenance']=[q for q in source_info['provenance'] if q.get('url') not in ['https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311',gc_data['source']]]
source_info['provenance']=[q for q in source_info['provenance'] if q.get('name')!='Low-z independent galaxy distances']
source_info['provenance'].append({'name':'Low-z independent galaxy distances','url':lowz['endpoint'],'changes':lowz['selection'],'snapshot':'data-tools/low-z-galaxy-distances.json','license':'ODbL'})
source_info['provenance'] += [{'name':'Hipparcos new reduction, van Leeuwen 2007','url':'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311','changes':'HIP, parallax and formal error. Error attached only when the same solution reproduces the adopted HYG distance; explicit 1997/manual exceptions preserved.'},{'name':'Baumgardt Galactic globular-cluster compilation','url':gc_data['source'],'changes':'Only ATNF-associated hosts; measured sky coordinates, cluster distance/error and model tidal-radius bound. Individual depths remain unknown.'}]
source_path.write_text(json.dumps(source_info,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ('nodes','roots')},ensure_ascii=False,indent=2))
