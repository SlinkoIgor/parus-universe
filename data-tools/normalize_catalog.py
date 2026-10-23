import csv,json,math,re,hashlib
from pathlib import Path
from datetime import date
P=Path(__file__).parent
PC_LY=3.2615637771674336
HYG_URL='https://github.com/astronexus/HYG-Database/tree/main/hyg'
NGC_URL='https://github.com/mattiaverga/OpenNGC'
PSR_URL='https://www.atnf.csiro.au/research/pulsar/psrcat/'
stars=list(csv.DictReader((P/'hyg_v41.csv').open()))
ngc=list(csv.DictReader((P/'NGC.csv').open(),delimiter=';'))
def num(x):
 try:return float(x)
 except:return None
def sex(s,ra=False):
 a=s.strip().split(':'); sign=-1 if a[0].startswith('-') else 1
 val=abs(float(a[0]))+sum(float(v)/60**i for i,v in enumerate(a[1:],1))
 return sign*val*(15 if ra else 1)
def coord(row): return {'raDeg':float(row['ra'])*15,'decDeg':float(row['dec'])}
def base(row):
 name=row['proper'] or row['bf'] or row['gl'] or ('HIP '+row['hip'] if row['hip'] else 'HD '+row['hd'] if row['hd'] else 'HYG '+row['id'])
 a={'id':'hyg-'+row['id'],'hygId':int(row['id']),'name':name,'kind':'star','type':'ЗВЕЗДА · '+(row['spect'] or 'СПЕКТР НЕ УКАЗАН'),'d':float(row['dist'])*PC_LY,**coord(row),'catalog':'HYG 4.1','source':HYG_URL,'license':'CC-BY-SA-4.0','spectral':row['spect'] or None,'hip':row['hip'] or None,'hd':row['hd'] or None,'gliese':row['gl'] or None,'absoluteV':num(row['absmag']),'visualLuminositySolar':num(row['lum']),'luminosityNote':'Визуальная светимость из абсолютной звёздной величины V; нормировка M_V(Солнце)=4.85 в HYG. Не болометрическая.','massSolar':None,'radiusSolar':None,'distanceMethod':'Каталожное расстояние HYG, pc × 3.261563777. Отрицательные/неизвестные параллаксы с dist≥100000 pc исключены.','constellation':row['con'] or None}
 return a
finite=[q for q in stars if 0<float(q['dist'])<100000]
selectedStars=sorted(finite,key=lambda q:float(q['dist']))[:450]
objects=[base(q) for q in selectedStars]
# Flat LCDM with explicit, fixed model parameters. The per-object d is comoving today.
def distances(z):
 n=256;h=z/n
 f=lambda x:1/math.sqrt(.3*(1+x)**3+.7)
 integral=h/3*(f(0)+f(z)+4*sum(f(h*i) for i in range(1,n,2))+2*sum(f(h*i) for i in range(2,n,2)))
 dc=299792.458/70*integral*1e6*PC_LY
 return dc,dc/(1+z),dc*(1+z)
galaxies=[q for q in ngc if q['Type']=='G' and q['RA'] and q['Dec'] and q['MajAx'] and q['V-Mag'] and q['Redshift'] and .01<=float(q['Redshift'])<=.03]
for q in sorted(galaxies,key=lambda q:-float(q['MajAx']))[:80]:
 z=float(q['Redshift']);dc,da,dl=distances(z);av=float(q['V-Mag'])-5*math.log10(dl/PC_LY)+5
 name=q['Name']+(' · '+q['Common names'].split(',')[0] if q['Common names'] else '')
 objects.append({'id':'opengc-'+q['Name'].lower(),'name':name,'kind':'galaxy','type':'ГАЛАКТИКА · '+(q['Hubble'] or 'морфология не указана'),'raDeg':sex(q['RA'],True),'decDeg':sex(q['Dec']),'d':dc,'angularDiameterDistanceLy':da,'luminosityDistanceLy':dl,'redshift':z,'catalog':'OpenNGC','source':NGC_URL,'license':'CC-BY-SA-4.0','absoluteV':av,'visualLuminositySolar':10**((4.85-av)/2.5),'luminosityNote':'Приближённая M_V и L_V из видимой V и модельного luminosity distance; без поправок на поглощение и K-коррекции. Не болометрическая.','diameterLy':da*float(q['MajAx'])*math.pi/10800,'minorDiameterLy':da*float(q['MinAx'])*math.pi/10800 if q['MinAx'] else None,'positionAngleDeg':num(q['PosAng']),'angularMajorArcmin':float(q['MajAx']),'angularMinorArcmin':num(q['MinAx']),'sizeNote':'Оптические оси OpenNGC (обычно HyperLEDA D25 в B; где нет данных — SIMBAD/2MASS в ИК). Пересчёт угла через угловое расстояние, не размер тёмного гало.','massSolar':None,'radiusSolar':None,'hubbleType':q['Hubble'] or None,'ngc':q['Name'],'messier':q['M'] or None,'distanceMethod':'Модельная комовинговая дистанция по z (гел. OpenNGC): плоская ΛCDM H₀=70 км/с/Мпк, Ωm=0.3, ΩΛ=0.7. Не независимое измерение; пекулярная скорость даёт неопределённость.','rawSources':q['Sources']})
psr=[]
for block in (P/'psrcat.db').read_text().split('@'):
 row={}
 for line in block.splitlines():
  if not line or line.startswith(('#','-')):continue
  a=line.split()
  if len(a)>1:row[a[0]]=a[1:]
 if all(k in row for k in ['PSRJ','RAJ','DECJ']):psr.append(row)
get=lambda q,k:num(q[k][0]) if k in q else None
selectedPsr=sorted([q for q in psr if (get(q,'DIST_A') or 0)>0],key=lambda q:get(q,'DIST_A'))[:20]
for q in selectedPsr:
 f=get(q,'F0');period=get(q,'P0') or (1/f if f else None)
 objects.append({'id':'atnf-'+q['PSRJ'][0].lower(),'name':'PSR '+q['PSRJ'][0]+(' / '+q['PSRB'][0] if 'PSRB'in q else ''),'kind':'pulsar','type':'НЕЙТРОННАЯ ЗВЕЗДА / ПУЛЬСАР','raDeg':sex(q['RAJ'][0],True),'decDeg':sex(q['DECJ'][0]),'d':get(q,'DIST_A')*1000*PC_LY,'catalog':'ATNF 2.9.0','source':PSR_URL,'license':'ATNF catalogue acknowledgement; Manchester et al. 2005','periodSeconds':period,'periodDerivative':get(q,'P1') or (-get(q,'F1')/f**2 if f and get(q,'F1') is not None else None),'distanceKpc':get(q,'DIST_A'),'distanceMethod':'Каталожная независимая оценка DIST_A ATNF; метод и неопределённость зависят от исходной публикации.','distanceReference':q['DIST_A'][-1],'massSolar':None,'radiusSolar':None,'absoluteV':None,'visualLuminositySolar':None,'luminosityNote':'Болометрическая светимость не указана в этой выборке. Мощность торможения вращения не подменяет фотонную светимость.','psrJ':q['PSRJ'][0],'psrB':q.get('PSRB',[None])[0],'parallaxMas':get(q,'PX')})
known={}
matchNames={'proxima':'Proxima Centauri','alpha':'Rigil Kentaurus','barnard':"Barnard's Star",'wolf':'Wolf 359','lalande':'Lalande 21185','sirius':'Sirius','epsilon':'Ran','vega':'Vega','polaris':'Polaris','betelgeuse':'Betelgeuse','procyon':'Procyon'}
for key,name in matchNames.items():
 q=next(x for x in stars if x['proper']==name);known[key]={**coord(q),'hygId':int(q['id']),'hip':q['hip'] or None,'hd':q['hd'] or None,'source':HYG_URL}
for key,gl in {'luyten':'Gl 65A','tau':'Gl 71','ross':'Gl 729'}.items():
 q=next(x for x in stars if x['gl']==gl);known[key]={**coord(q),'hygId':int(q['id']),'hip':q['hip'] or None,'hd':q['hd'] or None,'source':HYG_URL}
sm=list(csv.DictReader((P/'known-simbad.csv').open()))
matchSimbad={'trappist':'TRAPPIST-1','cygnus':'X Cyg X-1','sgr':'NAME Sgr A*','omega':'* ome Cen','3c273':'3C 273','andromeda':'M  31','triangulum':'M  33','bode':'M  81','whirlpool':'M  51','m87':'M  87','sculptor':'NGC   253','centaurus':'NGC  5128','lmc':'NAME LMC','smc':'NAME SMC','orion':'M  42','attractor':'NAME Great Attractor'}
for key,name in matchSimbad.items():
 q=next(x for x in sm if x['id']==name);known[key]={'raDeg':float(q['ra']),'decDeg':float(q['dec']),'source':'https://simbad.cds.unistra.fr/simbad/sim-id?Ident='+q['id'].replace(' ','%20'),'identifier':q['main_id']}
for key,name in {'vela':'J0835-4510','crab':'J0534+2200'}.items():
 q=next(x for x in psr if x['PSRJ'][0]==name);known[key]={'raDeg':sex(q['RAJ'][0],True),'decDeg':sex(q['DECJ'][0]),'source':PSR_URL,'psrJ':name}
for key,ident in {'virgo':'NAME Virgo Cluster','coma':'ACO  1656','bootes':'NAME Bootes Void'}.items():
 q=next(x for x in csv.DictReader((P/'known-clusters-simbad.csv').open()) if x['id']==ident)
 known[key]={'raDeg':float(q['ra']),'decDeg':float(q['dec']),'source':'https://simbad.cds.unistra.fr/simbad/sim-id?Ident='+q['id'].replace(' ','%20'),'identifier':q['main_id'],'coordinateNote':'Каталожный центр протяжённой области; не компактное тело.'}
metadata={'retrieved':'2026-10-23','counts':{'stars':450,'galaxies':80,'pulsars':20,'totalImported':len(objects)},'coordinateFrame':'Equatorial J2000, raDeg and decDeg in degrees. All distances light-years. No proper motion propagation.','galaxyModel':{'H0_km_s_Mpc':70,'omegaM':.3,'omegaLambda':.7,'d':'Dcom=(c/H0) integral_0^z dz/sqrt(Ωm(1+z)^3+ΩΛ)','DA':'Dcom/(1+z)','DL':'Dcom*(1+z)','reference':'https://ned.ipac.caltech.edu/level5/Hogg/Hogg_contents.html'},'provenance':[{'name':'HYG 4.1, David Nash / Astronexus','url':HYG_URL,'download':'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv','license':'CC-BY-SA-4.0','licenseURL':'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/LICENSE','changes':'450 nearest positive finite-distance rows selected; coordinates and distances converted to degrees / ly; lum labeled visual; missing masses/radii retained null.','sha256':hashlib.sha256((P/'hyg_v41.csv').read_bytes()).hexdigest()},{'name':'OpenNGC, Mattia Verga and contributors','url':NGC_URL,'download':'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv','license':'CC-BY-SA-4.0','changes':'80 largest angular galaxies with V and .01≤z≤.03; cosmological distances, optical extents and V luminosities estimated as documented; missing masses retained null.','sha256':hashlib.sha256((P/'NGC.csv').read_bytes()).hexdigest()},{'name':'ATNF Pulsar Catalogue 2.9.0, Manchester et al. 2005 AJ129 1993','url':PSR_URL,'download':'https://www.atnf.csiro.au/research/pulsar/psrcat/downloads/psrcat_pkg.tar.gz','citation':'Manchester, R.N., Hobbs, G.B., Teoh, A. & Hobbs, M. (2005), AJ 129, 1993–2006. DOI:10.1086/428488','changes':'20 nearest entries with independent distance DIST_A; no canonical masses or radii inserted as measurements.','sha256':hashlib.sha256((P/'psrcat.db').read_bytes()).hexdigest()},{'name':'SIMBAD / CDS Strasbourg','url':'https://simbad.cds.unistra.fr/simbad/','query':'J2000 positions of original named objects via sim-tap/sync.','acknowledgement':'This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.'}]}
(P/'import-catalog.json').write_text(json.dumps({'metadata':metadata,'objects':objects,'knownCoordinates':known},ensure_ascii=False,indent=2))
print(metadata['counts']);print('knownCoordinates',len(known));print('max stellar distance ly',objects[449]['d']);print('bytes',(P/'import-catalog.json').stat().st_size)
