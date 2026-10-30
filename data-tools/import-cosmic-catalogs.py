#!/usr/bin/env python3
"""Observed multi-scale catalog snapshots. Offline by default; --download refreshes CDS.

The coordinate reference follows the existing atlas (H0=70, Om=.3), distinct
from the game's future-expansion background. Preserve both source and target
cosmologies, distance types, selections, original identifiers and checksums.
"""
from pathlib import Path
import csv,json,gzip,hashlib,math,bisect,collections,sys,datetime
ROOT=Path(__file__).resolve().parent.parent;RAW=ROOT/'data-tools/raw';RAW.mkdir(exist_ok=True)
MPC=3261563.7771674336;PC=MPC/1e6;H=.7
MATRIX=[[-.0548755604162154,-.873437090234885,-.4838350155487132],[.4941094278755837,-.4448296299600112,.7469822444972189],[-.8676661490190047,-.1980763734312015,.4559837761750669]]
QUERIES={
 'mcxc':{'-source':'J/A+A/688/A187/mcxcii','-out':'**'},
 'superclusters':{'-source':'J/A+A/539/A80/mainadap','-out':'**'},
 'filaments':{'-source':'J/MNRAS/438/3465/table1','-out':'**'},
 'filament-points':{'-source':'J/MNRAS/438/3465/table2','-out':'**'},
 'filament-validation':{'-source':'J/MNRAS/438/3465/table3','-out':'**','ID':'1,500,15000'},
 'cf4':{'-source':'J/ApJ/944/94/table2','-out':'**'},
 'ungc':{'-source':'J/AJ/145/101/catalog','-out':'**'},
 'ungc-distances':{'-source':'J/AJ/145/101/table6','-out':'**'},
 'hunt':{'-source':'J/A+A/686/A42/clusters','-out':'**'},
 'glade-bright':{'-source':'VII/291/gladep','-out':'**','Type':'G','Bmag':'<=15.5','f_dL':'3','zhelio':'>0.002'},
 'void-dr7':{'-source':'J/MNRAS/440/1248','-out':'**'},
}
if '--download' in sys.argv:
 from urllib.request import urlopen
 from urllib.parse import urlencode
 import ssl,concurrent.futures
 def download(item):
  name,q=item;url='https://vizier.idia.ac.za/viz-bin/asu-tsv?'+urlencode({**q,'-out.max':'unlimited'})
  b=urlopen(url,context=ssl.create_default_context(cafile='/etc/ssl/cert.pem'),timeout=180).read()
  if b'#INFO\tError' in b or b'#Name:' not in b or b'#INFO\tQUERY_STATUS\tOVERFLOW' in b:raise RuntimeError('Invalid/incomplete CDS response '+name)
  (RAW/(name+'.tsv')).write_bytes(b);(RAW/(name+'-source.json')).write_text(json.dumps({'url':url,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'retrieved':datetime.datetime.now(datetime.UTC).date().isoformat(),'query':q},indent=2));return name,len(b)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for result in pool.map(download,QUERIES.items()):print(result,flush=True)
def tables(name):
 text=(RAW/(name+'.tsv')).read_text();result={};current=None;lines=[]
 def finish():
  if current and lines:
   assert len(lines)>=3,(name,current)
   result[current]=[{k:v.strip() for k,v in row.items()} for row in csv.DictReader([lines[0]]+lines[3:],delimiter='\t')]
 for line in text.splitlines():
  if line.startswith('#Table'):finish();current=None;lines=[]
  elif line.startswith('#Name: '):current=line[7:]
  elif line.strip() and not line.startswith('#'):lines.append(line)
 finish();return result
def rows(name):
 ts=tables(name);assert len(ts)==1,(name,list(ts));return next(iter(ts.values()))
def num(x):
 try:q=float(x);return q if math.isfinite(q) else None
 except (TypeError,ValueError):return None
def identity(s):return ''.join(c.lower() for c in str(s) if c.isalnum())
def sky(ra,dec,d):
 a,b=map(math.radians,[ra,dec]);v=[d*math.cos(b)*math.cos(a),d*math.cos(b)*math.sin(a),d*math.sin(b)]
 return [sum(x*y for x,y in zip(r,v)) for r in MATRIX]
def angles(p):
 # Galactic -> ICRS, transpose of the orthogonal IAU rotation.
 v=[sum(MATRIX[j][i]*p[j] for j in range(3)) for i in range(3)];return math.degrees(math.atan2(v[1],v[0]))%360,math.degrees(math.atan2(v[2],math.hypot(*v[:2])))
def survey_to_gal(p):
 x,y,z=p;a,b=map(math.radians,[185,32.5]);u=y*math.cos(b)-z*math.sin(b);v=-x;w=y*math.sin(b)+z*math.cos(b)
 equ=[u*math.cos(a)-v*math.sin(a),u*math.sin(a)+v*math.cos(a),w]
 return [sum(c*t for c,t in zip(row,equ)) for row in MATRIX]
class Distances:
 def __init__(self,om=.3,H0=70):
  self.dz=.0001;self.z=[i*self.dz for i in range(100001)];self.dc=[0.];previous=1.
  for z in self.z[1:]:
   value=1/math.sqrt(om*(1+z)**3+1-om);self.dc.append(self.dc[-1]+(previous+value)*self.dz/2*299792.458/H0);previous=value
  self.dl=[d*(1+z) for d,z in zip(self.dc,self.z)]
 def interp(self,axis,values,x):
  i=max(1,min(len(axis)-1,bisect.bisect_left(axis,x)));return values[i-1]+(values[i]-values[i-1])*(x-axis[i-1])/(axis[i]-axis[i-1])
 def distance(self,z):return self.interp(self.z,self.dc,z)
 def from_dl(self,d):return self.interp(self.dl,self.dc,d)
 def z_from_dc(self,d):return self.interp(self.dc,self.z,d)
REF=Distances();WMAP=Distances(.27);sources={name:json.loads((RAW/(name+'-source.json')).read_text()) for name in QUERIES}
for name,meta in sources.items():assert hashlib.sha256((RAW/(name+'.tsv')).read_bytes()).hexdigest()==meta['sha256'],name
objects=[];coverage={};decisions=[]
def add(source,ident,name,kind,ra,dec,d,aliases,extra=None):
 extra=extra or {};located=d is not None and d>0 and ra is not None and dec is not None
 o={'id':ident,'name':name,'kind':kind,'raDeg':ra,'decDeg':dec,'distanceLy':d,'aliases':list(dict.fromkeys(x for x in aliases if x and x!='-')),'catalogKey':source,**extra}
 if not located:o['atlasOnly']=True
 objects.append(o);return o
def source_url(path):return 'https://cdsarc.cds.unistra.fr/viz-bin/cat/'+path
mcxc=rows('mcxc');assert len(mcxc)==2221
for q in mcxc:
 z=num(q['z']);r500=num(q['R500']);mass=num(q['M500']);typ=q['zType'];ra=num(q['RAJ2000']);dec=num(q['DEJ2000'])
 aliases=[q['MCXC'],q['OName'],*q['AName'].split('|')]
 add('MCXC-II','mcxcii-'+identity(q['MCXC']),q['MCXC'],'cluster',ra,dec,REF.distance(z)*MPC,aliases,{
 'catalogClass':'galaxy-cluster','catalogTypeLabel':'СКОПЛЕНИЕ ГАЛАКТИК · MCXC-II','referenceURL':source_url('J/A+A/688/A187'),
 'distanceMethod':'Оценка сопутствующего расстояния по z MCXC-II; ΛCDM H₀=70, Ωm=0,3. Пекулярные скорости не учтены.',
 'redshift':z,'redshiftType':typ,'positionQuality':'approximate','catalogData':{'MCXC':q['MCXC'],'z':z,'zType':typ,'zReference':q['r_z'],'zFlag':q['f_z'],'M500_1e14Solar':mass,'R500Mpc':r500,'L500_1e44ErgS':num(q['L500'])},
 'xrayLuminosityW':num(q['L500'])*1e37 if num(q['L500']) is not None else None,'massSolar':mass*1e14 if mass else None,'massUncertaintySolar':num(q['e_M500'])*1e14 if num(q['e_M500']) is not None else None,'massIsSystem':True,'massBasis':'M500 · внутри R500, не точечная масса',
 'regionData':{'shape':'ellipse','major':2*r500*(1+z)*MPC,'minor':2*r500*(1+z)*MPC,'illustrative':True,'note':'Проекция сферы R500; модельный масштаб скопления, не измеренная форма границы. R500 переведён из собственного в сопутствующий размер.','url':source_url('J/A+A/688/A187')},
 'atlasOnly':typ not in ('S','SP') or z<.002,'positionReason':'Тип красного смещения '+typ+' или слишком малое z не проходит отбор карты.' if typ not in ('S','SP') or z<.002 else ''})
coverage['MCXC-II']={'rows':len(mcxc),'represented':len(mcxc),'selection':'All entries searchable; map only S/SP redshift types and z>=.002. M500 is an extended aperture mass, not a point mass.'}
# One adaptive main-sample catalogue, never multiple thresholds of the same structures.
superc=rows('superclusters');assert len(superc)==1313
for q in superc:
 d0=float(q['Dist2'])/H;z0=WMAP.z_from_dc(d0);d=REF.distance(z0);factor=d/d0;diam=float(q['Diam'])/H*factor*MPC
 add('SDSS-Superclusters','sdss-super-'+q['UID'], 'Сверхскопление SDSS · '+q['UID'],'structure',float(q['RA2deg']),float(q['DE2deg']),d*MPC,[q['UID'],'SDSS DR7 supercluster '+q['UID']],{
 'catalogTypeLabel':'СВЕРХСКОПЛЕНИЕ ГАЛАКТИК · SDSS DR7','cosmicSubtype':'supercluster','referenceURL':source_url('J/A+A/539/A80'),
 'distanceMethod':'Центр массы адаптивной выборки SDSS DR7: опубликованное сопутствующее расстояние в Мпк/h, h=0,7; радиальный пересчёт WMAP Ωm=0,27 → опорная ΛCDM Ωm=0,3.',
 'positionQuality':'approximate','arrivalAnchor':True,'catalogData':{'UID':q['UID'],'RA2deg':float(q['RA2deg']),'DE2deg':float(q['DE2deg']),'Dist2MpcH':float(q['Dist2']),'DiamMpcH':float(q['Diam']),'threshold':float(q['D']),'confidence':num(q['Conf']),'edge':q['Edge'],'Ngal':int(q['Ngal'])},
 'regionData':{'shape':'ellipse','major':diam,'minor':diam,'illustrative':True,'note':'Условная окружность опубликованного диаметра; ориентация и точная граница не восстановлены.'+(' Область касается маски обзора.' if q['Edge']=='1' else ''),'url':source_url('J/A+A/539/A80')}})
coverage['SDSS-Superclusters']={'rows':1313,'represented':1313,'selection':'Main sample adaptive threshold only; centre of mass RA2/DE2/Dist2. Edge/confidence retained.'}
# Filament source XYZ are SDSS survey coordinates, NOT ICRS or Galactic XYZ.
pts=rows('filament-points');assert len(pts)==275599
by_fil=collections.defaultdict(list);by_point={}
for q in pts:
 p=survey_to_gal([float(q[k]) for k in ('x','y','z')]);by_fil[int(q['ID'])].append((int(q['IDpt']),p));by_point[int(q['IDpt'])]=p
# Independent sky directions/distances in the galaxy table validate the rotation.
validation=[]
for q in rows('filament-validation'):
 d=float(q['Dcor']);p=sky(float(q['RAJ2000']),float(q['DEJ2000']),d);line=[v for _,v in by_fil[int(q['ID'])]]
 def segment_distance(a,b):
  v=[b[i]-a[i] for i in range(3)];w=[p[i]-a[i] for i in range(3)];t=max(0,min(1,sum(v[i]*w[i] for i in range(3))/sum(x*x for x in v)));return math.sqrt(sum((w[i]-t*v[i])**2 for i in range(3)))
 distance=min(segment_distance(a,b) for a,b in zip(line,line[1:]));validation.append({'id':q['IDgal'],'filamentId':int(q['ID']),'raDeg':float(q['RAJ2000']),'decDeg':float(q['DEJ2000']),'DcorMpcH':d,'distanceMpcH':distance,'publishedMpcH':float(q['Dfil'])})
assert validation and max(abs(v['distanceMpcH']-v['publishedMpcH']) for v in validation)<.03,validation
filaments=rows('filaments');assert len(filaments)==15421 and len(by_fil)==15421
for q in filaments:
 ident=int(q['ID']);line=sorted(by_fil[ident]);assert len(line)==int(q['Npts'])
 curve=[]
 for _,p in line:
  r=math.sqrt(sum(x*x for x in p))/H;factor=REF.distance(WMAP.z_from_dc(r))/r;curve.append([round(x/H*factor*MPC,3) for x in p])
 center=curve[len(curve)//2];ra,dec=angles(center);d=math.sqrt(sum(x*x for x in center));relative=[[round(p[0]-center[0],3),round(-(p[1]-center[1]),3)] for p in curve]
 major=2*max(abs(p[0]) for p in relative);minor=2*max(abs(p[1]) for p in relative);length=sum(math.dist(a,b) for a,b in zip(curve,curve[1:]))
 add('SDSS-Filaments','sdss-filament-'+str(ident),'Филамент SDSS · '+str(ident),'structure',ra,dec,d,['SDSS filament '+str(ident),'Tempel filament '+str(ident)],{
 'p3':center,'cosmicSubtype':'filament','catalogTypeLabel':'ГАЛАКТИЧЕСКИЙ ФИЛАМЕНТ · SDSS','referenceURL':source_url('J/MNRAS/438/3465'),
 'distanceMethod':'Ось Bisous по наблюдаемым галактикам SDSS: система survey XYZ → ICRS → Galactic XYZ. Мпк/h, h=0,7; радиальный пересчёт Ωm=0,27 → Ωm=0,3. Подавление «пальцев Бога» исходного каталога сохранено.',
 'positionQuality':'approximate','arrivalAnchor':True,'filamentLengthLy':length,'catalogData':{'ID':ident,'Npts':int(q['Npts']),'LenMpcH':float(q['Len']),'Ng1':int(q['Ng1'])},
 'regionData':{'shape':'polyline','major':max(1,major),'minor':max(1,minor),'points':relative,'illustrative':False,'note':'Опубликованная последовательность точек оси филамента; толщина линии условная. Точка прибытия — средний узел оси, не компактное тело.','url':source_url('J/MNRAS/438/3465')}})
coverage['SDSS-Filaments']={'rows':15421,'represented':15421,'spinePoints':len(pts),'selection':'All observed filaments and all source spine points; no mock galaxies/fictional geometry. Independent sky-coordinate validation stored in audit.'}
# Public archived DR7 fallback: DR11 author's old host no longer resolves.
void_tables=tables('void-dr7');shells={'dim1t1v':(0,.05),'dim2t1v':(.05,.1),'bri1t1v':(.1,.15),'bri2t1v':(.15,.2),'lrgdt1v':(.2,.36),'lrgbt1v':(.36,.45)};void_raw=0;void_added=0
for table,(lo,hi) in shells.items():
 for q in void_tables['J/MNRAS/440/1248/'+table]:
  void_raw+=1;z=float(q['z'])
  if not lo<z<=hi:continue
  r=float(q['Reff'])/H;factor=REF.distance(z)/WMAP.distance(z);radius=r*factor*MPC;void_added+=1
  add('SDSS-Voids','sdss-void-'+table+'-'+q['Zone'],'Войд SDSS DR7 · '+table.replace('t1v','')+' '+q['Zone'],'void',float(q['RAJ2000']),float(q['DEJ2000']),REF.distance(z)*MPC,['SDSS DR7 void '+table+' '+q['Zone']],{
   'catalogTypeLabel':'КОСМИЧЕСКИЙ ВОЙД · SDSS DR7','referenceURL':source_url('J/MNRAS/440/1248'),
   'distanceMethod':'Барицентр Type1 void в сопутствующей версии Надатура–Хотчкисса SDSS DR7. Непересекающиеся интервалы z выбирают одну трассирующую выборку для центра; Ωm=0,27 → Ωm=0,3, h=0,7.',
   'positionQuality':'approximate','arrivalAnchor':True,'redshift':z,'catalogData':{'sample':table,'Zone':int(q['Zone']),'z':z,'ReffMpcH':float(q['Reff']),'meanDensity':float(q['AvgDens']),'minimumDensity':float(q['MDens']),'edge':int(q['Flag']),'densityRatio':float(q['VDR'])},
   'regionData':{'shape':'ellipse','major':2*radius,'minor':2*radius,'illustrative':True,'note':'Эквивалентная по объёму сфера войда, не измеренная круговая граница.'+(' Область обрезана маской обзора.' if q['Flag']=='1' else ''),'url':source_url('J/MNRAS/440/1248')}})
coverage['SDSS-Voids']={'rows':void_raw,'represented':void_added,'selection':'Observed DR7 Type1 comoving catalogues, one tracer sample per nonoverlapping redshift interval; Type2/basic and other segmentation versions excluded. Edge flags retained. DR11 archive unavailable, not imported.'}
# Individual distance moduli, never the group distance for every member.
cf4=rows('cf4');assert len(cf4)==55877
for q in cf4:
 dm=num(q['DM']);err=num(q['e_DM']);dl=10**((dm-25)/5) if dm else None;d=REF.from_dl(dl) if dl else None;minus=d-REF.from_dl(dl*10**(-err/5)) if err is not None and d else None;plus=REF.from_dl(dl*10**(err/5))-d if err is not None and d else None
 pgc=str(int(q['PGC']));bad=not d or err is not None and max(minus,plus)/d>.5
 add('Cosmicflows-4','cf4-pgc-'+pgc,'PGC '+pgc,'galaxy',num(q['RAJ2000']),num(q['DEJ2000']),d*MPC if d else None,['PGC '+pgc],{
 'referenceURL':source_url('J/ApJ/944/94'),'positionQuality':'approximate','atlasOnly':bad,'redshiftIndependent':True,'distanceRank':2,
 'distanceMethod':'Индивидуальный модуль расстояния Cosmicflows-4 (исправленная публикация 2023): dL=10^((μ−25)/5) Мпк → dC в опорной ΛCDM. Групповая дальность не подставлялась.',
 'distanceErrorMinusLy':minus*MPC if minus is not None else None,'distanceErrorPlusLy':plus*MPC if plus is not None else None,'sizeUnknown':True,
 'catalogData':{'PGC':int(pgc),'DM':dm,'e_DM':err,'groupPGC':num(q['1PGC']),'VcmbKmS':num(q['Vcmb']),'methods':[k[2:] for k in ('DMsnIa','DMtf','DMfp','DMsbf','DMsnII','DMtrgb','DMceph','DMmas') if num(q[k]) is not None]}})
coverage['Cosmicflows-4']={'rows':55877,'represented':55877,'selection':'All individual table2 distance moduli; corrected 2023/CDS release, not flawed August 2022 tables. Relative upper/lower distance error >50% retained atlas-only.'}
ungc=rows('ungc');ungc_err={q['Name']:q for q in rows('ungc-distances')};assert len(ungc)==869
for q in ungc:
 d=num(q['Dist']);method=q['f_Dist'];e=ungc_err.get(q['Name'],{});bad=not d or method in ('mem','h',"h'",'txt');dc=REF.from_dl(d) if d else None;ra_values=[float(t) for t in q['RAJ2000'].split()];dec_values=q['DEJ2000'].split();ra=15*(ra_values[0]+ra_values[1]/60+ra_values[2]/3600);dec=(-1 if dec_values[0].startswith('-') else 1)*(abs(float(dec_values[0]))+float(dec_values[1])/60+float(dec_values[2])/3600);angular=num(q['a26']);err=num(e.get('e_DM'));bad=bad or err is not None and 10**(err/5)-1>.5
 add('Nearby-Galaxies','ungc-'+identity(q['Name']),q['Name'],'galaxy',ra,dec,dc*MPC if dc else None,[q['Name'],q['SimbadName'],q['NEDname']],{
 'referenceURL':source_url('J/AJ/145/101'),'positionQuality':'approximate','atlasOnly':bad,'redshiftIndependent':not bad,'distanceRank':3,'distanceMethod':'Принятое индивидуальное расстояние Updated Nearby Galaxy Catalog; метод '+method+'. '+('Нет независимой индивидуальной глубины: только атлас.' if bad else 'Пересчёт dL→dC в опорной ΛCDM; источник измерения сохранён.'),
 'diameterLy':2*dc*MPC*math.tan(math.radians(angular/120)) if dc and angular else None,'angularMajorArcmin':angular,'angularMinorArcmin':angular*num(q['b/a']) if angular and num(q['b/a']) else None,'sizeUnknown':not bool(angular),'hubbleType':q['Mcl'],'sizeOrientationUnknown':True,'apparentV':None,
 'catalogData':{'name':q['Name'],'distanceMpc':d,'method':method,'distanceModulus':num(e.get('DM')),'distanceModulusError':err,'distanceReference':e.get('r_DM'),'a26Arcmin':angular,'axisRatio':num(q['b/a']),'morphology':q['Mcl'],'individualDistance':not bad}})
coverage['Nearby-Galaxies']={'rows':869,'represented':869,'selection':'All objects searchable. Membership-only, Hubble-only and untyped txt distances atlas-only; individual measured/model distances eligible. Holmberg angular sizes retained.'}
# Bright spectroscopic subset makes the full GLADE+ selection explicit and bounded.
glade=rows('glade-bright');assert 40000<len(glade)<60000
for q in glade:
 z=num(q['zcmb']) or num(q['zhelio']);pgc=num(q['PGC']);ident=str(int(q['GLADE+']));aliases=[q['GWGC'],q['HyperLEDA']]+(['PGC '+str(int(pgc))] if pgc else [])+['2MASX '+q['2MASS']] if q['2MASS']!='-' else [q['GWGC'],q['HyperLEDA']]+(['PGC '+str(int(pgc))] if pgc else [])
 add('GLADE+','gladep-'+ident,next((q[k] for k in ('GWGC','HyperLEDA') if q[k] and q[k]!='-'),'GLADE+ '+ident),'galaxy',float(q['RAJ2000']),float(q['DEJ2000']),REF.distance(z)*MPC,aliases+['GLADE+ '+ident],{
 'referenceURL':source_url('VII/291'),'positionQuality':'approximate','atlasOnly':z<.002,'distanceRank':1,'sizeUnknown':True,'redshift':z,'distanceMethod':'GLADE+: яркая спектроскопическая выборка G, B≤15,5, f_dL=3, zhelio>0,002. dC по zcmb (иначе zhelio), ΛCDM H₀=70, Ωm=0,3; исходное dL не подставляется в p3.',
 'catalogData':{'GLADE+':int(ident),'PGC':int(pgc) if pgc else None,'Bmag':float(q['Bmag']),'zhelio':float(q['zhelio']),'zcmb':num(q['zcmb']),'e_zhelio':num(q['e_zhelio']),'distanceFlag':int(q['f_dL']),'sourceLuminosityDistanceMpc':num(q['dL']),'sourceLuminosityDistanceErrorMpc':num(q['e_dL']),'stellarMass1e10Solar':num(q['M*']),'stellarMassError1e10Solar':num(q['e_M*'])}})
coverage['GLADE+']={'rows':len(glade),'represented':len(glade),'selection':'Explicit subset of full 23-million-row source: Type G, B<=15.5, f_dL=3 (spectroscopic), zhelio>.002. Other rows not claimed imported; no photometric redshift placement.'}
hunt=rows('hunt');assert len(hunt)==7167;kept=0
for q in hunt:
 if q['Type'] not in ('o','m','g','d') or float(q['CST'])<5 or float(q['CMDCl50'])<.5:continue
 kept+=1;d=float(q['dist50']);lo=float(q['dist16']);hi=float(q['dist84']);bad=max(d-lo,hi-d)/d>.5;ra=float(q['RA_ICRS']);dec=float(q['DE_ICRS']);typ={'o':'Рассеянное звёздное скопление','g':'Шаровое звёздное скопление','m':'Движущаяся звёздная группа · ассоциация','d':'Далёкое звёздное скопление · тип связанности не определён'}[q['Type']];mass=num(q['MassTot'])
 add('Gaia-Clusters','hunt-reffert-'+q['ID'],q['Name'].replace('_',' '),'cluster',ra,dec,d*PC,[v.replace('_',' ') for v in q['AllNames'].split(',')],{
 'catalogClass':'stellar-cluster','catalogType':'GCl' if q['Type']=='g' else '*Ass' if q['Type']=='m' else 'Cl' if q['Type']=='d' else 'OCl','catalogTypeLabel':typ.upper()+' · GAIA DR3','referenceURL':source_url('J/A+A/686/A42'),
 'positionQuality':'approximate','atlasOnly':bad,'distanceRank':2,'distanceMethod':'Индивидуальная геометрическая дальность dist50 и 16/84-процентили Hunt–Reffert (Gaia DR3, обновлённая классификация 2024); высокая надёжность CST≥5 и CMDCl50≥0,5. Фиксированное каталожное направление ICRS, без интеграции собственного движения.',
 'distanceErrorMinusLy':(d-lo)*PC,'distanceErrorPlusLy':(hi-d)*PC,'massSolar':mass,'massUncertaintySolar':num(q['e_MassTot']),'massIsSystem':True,'massBasis':'Суммарная оценка звёздной группы, не масса одной звезды',
 'catalogData':{'name':q['Name'],'ID':int(q['ID']),'Type':q['Type'],'CST':float(q['CST']),'CMDCl50':float(q['CMDCl50']),'dist16Pc':lo,'dist50Pc':d,'dist84Pc':hi,'massTotalSolar':mass,'halfNumberRadiusPc':num(q['r50pc']),'plxMas':num(q['Plx']),'numberOfStars':int(q['N'])}})
coverage['Gaia-Clusters']={'rows':len(hunt),'represented':kept,'selection':'Updated 2024 J/A+A/686/A42, Type o/m/g/d only, CST>=5 and CMDCl50>=.5. Rejected r types excluded; distant d retained without a bound/unbound claim; reported distance error >50% atlas-only. Not all Gaia stars.'}
assert len({o['id'] for o in objects})==len(objects)
result={'retrieved':max(m['retrieved'] for m in sources.values()),'referenceCosmology':{'H0':70,'omegaM':.3,'omegaLambda':.7},'sources':sources,'coverage':coverage,'filamentRotationValidation':validation,'filamentFrameChecks':{str(i):{'spineSDSS':[[num(q[k]) for k in ('x','y','z')] for q in pts if int(q['ID'])==i],'galaxies':[q for q in validation if q['filamentId']==i]} for i in {q['filamentId'] for q in validation}},'objects':objects}
content=json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
with (ROOT/'data-tools/cosmic-catalogs.json.gz').open('wb') as f:
 with gzip.GzipFile(fileobj=f,mode='wb',mtime=0) as g:g.write(content)
print(json.dumps({'objects':len(objects),'coverage':coverage,'filamentValidationMaxMpcH':max(abs(v['distanceMpcH']-v['publishedMpcH']) for v in validation)},indent=2,ensure_ascii=False))
