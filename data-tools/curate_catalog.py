"""Reproducible display selection. No network unless --resolve is explicitly passed."""
import csv,json,math,re,hashlib,unicodedata,sys,time,urllib.request,urllib.parse,subprocess
from pathlib import Path
from html.parser import HTMLParser
P=Path(__file__).parent; ROOT=P.parent; RAW=P/'raw'; PC_LY=3.2615637771674336
IAU_URL='https://exopla.net/star-names/modern-iau-star-names/'
HYG_URL='https://github.com/astronexus/HYG-Database/tree/main/hyg'
class Table(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=[];self.cell=None
 def handle_starttag(self,t,a):
  if t=='tr':self.row=[]
  if t in ('td','th'):self.cell=''
 def handle_data(self,d):
  if self.cell is not None:self.cell+=d
 def handle_endtag(self,t):
  if t in ('td','th') and self.cell is not None:self.row.append(self.cell.strip());self.cell=None
  if t=='tr' and len(self.row)==17 and self.row[0]!='proper names':self.rows.append(self.row)
def num(x):
 try:
  v=float(str(x).replace('−','-'));return v if math.isfinite(v) else None
 except:return None
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',s).casefold() if c.isalnum())
def identifier(s):
 m=re.search(r'\d+',s or '');return str(int(m[0])) if m else None
stars=list(csv.DictReader((RAW/'hyg_v41.csv').open()))
t=Table();t.feed((RAW/'iau-names.html').read_text());t.rows=[[v if v not in ['-','_','–','—'] else '' for v in r] for r in t.rows];iau=[dict(name=r[0],designation=r[2],hip=r[3],bayer=r[4],simbad=r[5],constellation=r[6],adopted=r[10],raDeg=num(r[13]),decDeg=num(r[14]),magnitude=num(r[15]),band=r[16] or 'V') for r in t.rows]
with (P/'iau-names.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(iau[0]));w.writeheader();w.writerows(iau)
hip={q['hip']:q for q in stars if q['hip']};hd={q['hd']:q for q in stars if q['hd']};hr={q['hr']:q for q in stars if q['hr']};proper={norm(q['proper']):q for q in stars if q['proper']}
selected={};matches={};supplement=[];queries=set()
def add(q,reason):selected.setdefault(q['id'],{'row':q,'reasons':[],'names':[]})['reasons'].append(reason)
near=sorted([q for q in stars if 0<(num(q['dist']) or 0)<100000],key=lambda q:float(q['dist']))[:30]
bright=sorted([q for q in stars if q['id']!='0' and num(q['mag']) is not None],key=lambda q:(float(q['mag']),int(q['id'])))[:500]
for q in near:add(q,'nearest30')
for q in bright:add(q,'brightest500V')
for q in stars:
 if q['proper'] and q['id']!='0':add(q,'traditionalName')
for n in iau:
 q=hip.get(identifier(n['hip']))
 if not q:
  m=re.match(r'(HD|HR)\s*(\d+)',n['designation']);q=(hd if m and m[1]=='HD' else hr).get(m[2]) if m else None
 if not q:q=proper.get(norm(n['name']))
 if q:
  add(q,'iauName');selected[q['id']]['names'].append(n);matches[n['name']]=q['id']
 else:supplement.append(n)
for a in selected.values():
 q=a['row']
 if not(0<(num(q['dist']) or 0)<100000):queries.add('HIP '+q['hip'] if q['hip'] else 'HD '+q['hd'] if q['hd'] else q['proper'])
for n in supplement:queries.add(n['designation'] or n['simbad'] or n['name'])
cachepath=P/'named-astrometry.json';cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
if '--resolve' in sys.argv:
 missing=sorted(k for k in queries if k not in cache or cache[k] and 'otype' not in cache[k]);print('Resolve SIMBAD',len(missing),flush=True)
 for i in range(0,len(missing),40):
  ids=missing[i:i+40];escaped=','.join("'"+x.replace("'","''")+"'" for x in ids)
  query='SELECT i.id,b.main_id,b.ra,b.dec,b.plx_value,b.plx_err,b.plx_bibcode,b.sp_type,b.otype FROM basic AS b JOIN ident AS i ON b.oid=i.oidref WHERE i.id IN ('+escaped+')'
  url='https://simbad.cds.unistra.fr/simbad/sim-tap/sync?'+urllib.parse.urlencode(dict(request='doQuery',lang='adql',format='json',query=query))
  response=json.loads(subprocess.run(['curl','--fail','--silent','--show-error','--retry','2','--max-time','90',url],check=True,capture_output=True).stdout)
  cols=[x['name'] for x in response['metadata']];got={}
  for row in response['data']:
   q=dict(zip(cols,row));got[q['id']]=q
  for name in ids:cache[name]=got.get(name)
  cachepath.write_text(json.dumps(cache,ensure_ascii=False,indent=2));print('resolved batch',i,len(got),flush=True)
def astrometry(key):
 q=cache.get(key);plx=num(q.get('plx_value')) if q else None;err=num(q.get('plx_err')) if q else None
 distance=1000/plx*PC_LY if plx and plx>0 and err is not None and 0<=err/plx<=.2 else None
 return q,distance
RU={'Sirius':'Сириус','Canopus':'Канопус','Arcturus':'Арктур','Vega':'Вега','Capella':'Капелла','Rigel':'Ригель','Procyon':'Процион','Achernar':'Ахернар','Betelgeuse':'Бетельгейзе','Hadar':'Хадар','Altair':'Альтаир','Aldebaran':'Альдебаран','Antares':'Антарес','Spica':'Спика','Pollux':'Поллукс','Fomalhaut':'Фомальгаут','Deneb':'Денеб','Regulus':'Регул','Castor':'Кастор','Bellatrix':'Беллатрикс','Alnitak':'Альнитак','Alnilam':'Альнилам','Mintaka':'Минтака','Mizar':'Мицар','Alcor':'Алькор','Algol':'Алголь','Mira':'Мира','Dubhe':'Дубхе','Merak':'Мерак','Alioth':'Алиот','Alkaid':'Алькаид','Alpheratz':'Альферац','Mirach':'Мирах','Almach':'Аламак','Hamal':'Хамаль','Menkar':'Менкар','Rasalhague':'Расальхаге','Sadr':'Садр','Enif':'Эниф','Scheat':'Шеат','Markab':'Маркаб','Polaris':'Полярная звезда'}
objects=[]
for a in selected.values():
 q=a['row'];names=a['names'];official=names[0]['name'] if names else q['proper'];name=RU.get(official,official) or q['bf'].strip() or q['gl'] or ('HIP '+q['hip'] if q['hip'] else 'HD '+q['hd'] if q['hd'] else 'HYG '+q['id'])
 d=float(q['dist'])*PC_LY if 0<float(q['dist'])<100000 else None;method='Каталожное расстояние HYG 4.1; pc × 3.261563777.';ref=HYG_URL
 if d is None:
  key='HIP '+q['hip'] if q['hip'] else 'HD '+q['hd'] if q['hd'] else q['proper'];extra,d=astrometry(key)
  if d is not None:method='SIMBAD: 1/параллакс, относительная ошибка ≤20%; оценка без байесовского априора.';ref='https://simbad.cds.unistra.fr/simbad/sim-id?Ident='+urllib.parse.quote(key)
 aliases=list(dict.fromkeys([x for x in [official,q['proper'],q['bf'].strip(),q['gl'],'HIP '+q['hip'] if q['hip'] else '',*sum(([n['name'],n['designation'],n['bayer'],n['simbad']] for n in names),[])] if x]))
 objects.append(dict(id='hyg-'+q['id'],hygId=int(q['id']),name=name,aliases=aliases,iauNames=[n['name'] for n in names],selection=list(dict.fromkeys(a['reasons'])),kind='star',type='ЗВЕЗДА · '+(q['spect'] or 'СПЕКТР НЕ УКАЗАН'),d=d,raDeg=float(q['ra'])*15,decDeg=float(q['dec']),catalog='HYG 4.1 + IAU WGSN',source=ref,license='CC-BY-SA-4.0 (HYG); public domain (IAU names)',spectral=q['spect'] or None,hip=q['hip'] or None,hd=q['hd'] or None,gliese=q['gl'] or None,apparentV=num(q['mag']),absoluteV=num(q['absmag']) if d else None,visualLuminositySolar=num(q['lum']) if d else None,luminosityNote='Светимость в V; не болометрическая. Видимая величина V задаёт отбор ярких звёзд.',massSolar=None,radiusSolar=None,distanceMethod=method if d else 'Надёжное расстояние не определено: HYG содержит заглушку. Объект сохранён в атласе без точки полёта.',constellation=q['con'] or None))
for n in supplement:
 key=n['designation'] or n['simbad'] or n['name'];q,d=astrometry(key);ra=num(q.get('ra')) if q else n['raDeg'];dec=num(q.get('dec')) if q else n['decDeg']
 objects.append(dict(id='iau-'+norm(n['name']),name=RU.get(n['name'],n['name']),aliases=list(dict.fromkeys([x for x in [n['name'],n['designation'],n['simbad'],n['bayer']] if x])),iauNames=[n['name']],selection=['iauName'],kind='pulsar' if 'PSR' in key else 'nebula' if q and q.get('otype') in ['PN','PN?','SNR','HII','RNe','BNe'] else 'quasar' if q and q.get('otype')=='QSO' else 'star',type='ПУЛЬСАР / ИМЕНОВАННЫЙ ОБЪЕКТ' if 'PSR' in key else 'ИМЕНОВАННАЯ ЗВЕЗДА'+(' · '+q['sp_type'] if q and q.get('sp_type') else ''),d=d,raDeg=ra,decDeg=dec,catalog='IAU WGSN + SIMBAD',source='https://simbad.cds.unistra.fr/simbad/sim-id?Ident='+urllib.parse.quote(key),license='IAU names public domain; SIMBAD ODbL',apparentV=n['magnitude'] if n['band']=='V' else None,absoluteV=None,visualLuminositySolar=None,luminosityNote='Нет надёжной оценки абсолютной/болометрической светимости в этой выборке.',massSolar=None,radiusSolar=None,distanceMethod='SIMBAD: инверсия положительного параллакса с относительной ошибкой ≤20%.' if d else 'Расстояние неизвестно или параллакс недостаточно точен. Объект присутствует в атласе; физический маршрут недоступен.',constellation=n['constellation']))
# Retain the curated original non-stellar landmarks, not arbitrary numbered selections.
source=ROOT/'dist/catalog-import.js';old=json.loads(source.read_text()[source.read_text().index('{'):source.read_text().rfind('}')+1]);known=old['knownCoordinates']
metadata=json.loads((ROOT/'dist/catalog-sources.json').read_text());metadata['retrieved']='2026-10-24';metadata['selection']={'nearestStars':30,'apparentVBrightest':500,'iauNames':len(iau),'traditionalHYGNames':sum(bool(q['proper']) and q['id']!='0' for q in stars),'starsAreUnion':True,'brightness':'Apparent Johnson V magnitude as seen from Earth; smaller number is brighter; not absolute luminosity.','namedScope':'All current IAU WGSN CSN names plus HYG traditional proper names and curated named deep-sky landmarks. Not every informal name ever used.','unresolvedDistances':'Objects remain searchable but not navigable. HYG sentinel100000pc is never treated as a physical distance.'}
metadata['counts']={'stars':sum(o['kind']=='star' for o in objects),'namedRegistry':len(iau),'unresolvedDistances':sum(o['d'] is None for o in objects),'totalImported':len(objects)}
metadata['provenance']=[x for x in metadata['provenance'] if x['name'] not in ['IAU WGSN Catalog of Star Names','SIMBAD named-star astrometry','SIMBAD named deep-sky distances']]
metadata['provenance'][0]['changes']='Union of nearest30 finite-distance stars, brightest500 by apparent V, all HYG proper names and matched current IAU names. Invalid distances preserved as unknown; no sentinel positions.'
metadata['provenance'].append({'name':'IAU WGSN Catalog of Star Names','url':IAU_URL,'count':len(iau),'license':'Names public domain; etymology text not redistributed.','sha256':hashlib.sha256((P/'iau-names.csv').read_bytes()).hexdigest(),'snapshot':'data-tools/iau-names.csv'})
metadata['provenance'].append({'name':'SIMBAD named-star astrometry','url':'https://simbad.cds.unistra.fr/simbad/','license':'ODbL for SIMBAD data subset; names public domain','snapshot':'data-tools/named-astrometry.json','changes':'Identity lookup and positive parallax inversion only when relative error <=20%; no missing distance substitution.','citation':'Wenger et al. 2000 A&AS143,9. CDS Strasbourg.'})
# Complete named OpenNGC subset (not every numbered NGC). Distances are traceable literature records.
distances=json.loads((P/'galaxy-distances.json').read_text())
for o in objects:
 extra=distances['stars'].get(o['id'])
 if o['d'] is None and extra and extra.get('distanceMpc'):
  o['d']=extra['distanceMpc']*1e6*PC_LY;o['source']=extra.get('referenceUrl',o['source']);o['distanceMethod']='Литературная оценка SIMBAD: '+str(extra.get('method'))+'; '+str(extra.get('reference'))
 if o['name']=='Geminga':o['d']=.19*1000*PC_LY;o['distanceMethod']='ATNF 2.9.0 DIST_A=0,19 кпк; независимая оценка исходной выборки.';o['source']='https://www.atnf.csiro.au/research/pulsar/psrcat/'
 if o.get('hygId')==60731:o['legacyId']='3c273';o['kind']='quasar'
legacy={'NGC0224':'andromeda','NGC0253':'sculptor','NGC0292':'smc','NGC0598':'triangulum','NGC3031':'bode','NGC4486':'m87','NGC5128':'centaurus','NGC5194':'whirlpool','NGC1976':'orion','NGC5139':'omega'}
ru={'Cigar Galaxy':'Сигара','Sombrero Galaxy':'Сомбреро','Black Eye Galaxy':'Чёрный Глаз','Sunflower Galaxy':'Подсолнух','Southern Pinwheel Galaxy':'Южная Вертушка','Pinwheel Galaxy':'Вертушка','Whale Galaxy':'Кит','Needle Galaxy':'Игла','Antennae Galaxies':'Антенны','Mice Galaxy':'Мыши','Fireworks Galaxy':'Фейерверк',"Barnard's Galaxy":'Галактика Барнарда','Crab Nebula':'Крабовидная туманность','Tarantula Nebula':'Тарантул','Carina Nebula':'Туманность Киля','Ring Nebula':'Кольцо','Dumbbell Nebula':'Гантель','Helix Nebula':'Улитка',"Cat's Eye Nebula":'Кошачий Глаз','North America Nebula':'Северная Америка','Pelican Nebula':'Пеликан','Lagoon Nebula':'Лагуна','Trifid Nebula':'Тройная туманность','Eagle Nebula':'Орёл','Owl Nebula':'Сова','Iris Nebula':'Ирис','Bubble Nebula':'Пузырь','Rosette Nebula':'Розетка','Flame Nebula':'Пламя','California Nebula':'Калифорния','Beehive':'Ясли','Hercules Globular Cluster':'Скопление Геркулеса','Flaming Star Nebula':'Пылающая звезда','Crescent Nebula':'Полумесяц','Butterfly Nebula':'Бабочка','Christmas Tree Cluster':'Рождественская Ёлка',"Jupiter's Ghost Nebula":'Призрак Юпитера'}
def sex(value,ra=False):
 parts=value.split(':');sign=-1 if parts[0].startswith('-') else 1;v=abs(float(parts[0]))+sum(float(x)/60**i for i,x in enumerate(parts[1:],1));return sign*v*(15 if ra else 1)
for q in csv.DictReader((RAW/'NGC.csv').open(),delimiter=';'):
 if not q['Common names'] and q['Name']!='NGC5457':continue
 names=(q['Common names'] or 'Pinwheel Galaxy').split(',');label=next((ru[n] for n in names if n in ru),names[0]);ident=q['Name'];extra=distances['objects'].get(ident,{})
 d=extra.get('distanceMpc');d=d*1e6*PC_LY if d else None
 if ident in ['NGC4038','NGC4039']:d=68e6;extra={**extra,'referenceUrl':'https://svs.gsfc.nasa.gov/14504/','method':'Общая приближённая оценка расстояния пары Антенны NASA: 68 млн св. лет.'}
 kind='galaxy' if q['Type'] in ['G','GPair'] else 'cluster' if q['Type'] in ['OCl','GCl','*Ass'] else 'star' if q['Type']=='*' else 'nebula'
 major=num(q['MajAx']);minor=num(q['MinAx']);diameter=d*major*math.pi/10800 if d and major else None
 v=num(q['V-Mag']);av=v-5*math.log10(d/PC_LY/10) if v is not None and d else None
 o=dict(id='opengc-'+norm(ident),legacyId=legacy.get(ident),name=label+' · '+ident,aliases=names+[ident]+(['M '+str(int(q['M']))] if q['M'] else []),iauNames=[],selection=['namedOpenNGC'],kind=kind,type={'galaxy':'ГАЛАКТИКА','cluster':'ЗВЁЗДНОЕ СКОПЛЕНИЕ','nebula':'ТУМАННОСТЬ','star':'ЗВЕЗДА'}[kind]+' · '+(q['Hubble'] or q['Type']),d=d,raDeg=sex(q['RA'],True),decDeg=sex(q['Dec']),catalog='OpenNGC + SIMBAD literature distances',source=extra.get('referenceUrl','https://github.com/mattiaverga/OpenNGC'),license='OpenNGC CC-BY-SA-4.0; SIMBAD distance subset ODbL',ngc=ident,messier=q['M'] or None,apparentV=v,absoluteV=av,visualLuminositySolar=10**((4.85-av)/2.5) if av is not None else None,luminosityNote='Оценка собственной светимости в V, без поправки на поглощение; не болометрическая.',massSolar=None,radiusSolar=None,distanceMethod=('Литературное расстояние: '+str(extra.get('method'))+'; '+str(extra.get('reference') or extra.get('referenceUrl'))+' '+str(extra.get('associationNote') or '')) if d else 'Нет надёжной литературной оценки расстояния в выбранной выборке. Сохранено имя, направление и угловой размер; физическая точка не выдумывается.',angularMajorArcmin=major,angularMinorArcmin=minor,diameterLy=diameter,minorDiameterLy=diameter*minor/major if diameter and minor else diameter,positionAngleDeg=num(q['PosAng']),hubbleType=q['Hubble'] or None,sizeNote='Угловые размеры OpenNGC. Положение и оптический размер оценены по литературному расстоянию, не радиус гало.',constellation=q['Const'])
 objects.append(o)
metadata['counts']={'stars':sum(o['kind']=='star' for o in objects),'namedRegistry':len(iau),'namedOpenNGC':133,'unresolvedDistances':sum(o['d'] is None for o in objects),'totalImported':len(objects)}
metadata['selection']['namedDeepSky']='All OpenNGC Common names (132 rows) plus familiar M101; original famous landmarks retained; arbitrary nearest ATNF and numbered-galaxy filler removed.'
metadata['provenance'][1]['changes']='All132 Common names rows plus M101. Coordinates and angular extents from OpenNGC; distances from per-object literature/SIMBAD records, never a generic nearby Hubble-law estimate.'
metadata['provenance'][1]['sha256']=hashlib.sha256((RAW/'NGC.csv').read_bytes()).hexdigest()
metadata['provenance'][2]['changes']='Original Vela and Crab pulsar landmarks plus named Geminga distance retained; arbitrary20-nearest pulsar filler removed.'
metadata['provenance'].append({'name':'SIMBAD named deep-sky distances','url':'https://simbad.cds.unistra.fr/simbad/','license':'ODbL for distance subset; see per-object reference','snapshot':'data-tools/galaxy-distances.json','changes':'Traceable non-redshift distance selections. Unresolved objects remain in atlas without invented physical positions.'})
(ROOT/'dist/catalog-import.js').write_text('// Derived catalog: per-record source/licenses in catalog-sources.json.\nconst IMPORTED_CATALOG='+json.dumps({'objects':objects,'knownCoordinates':known},ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'dist/catalog-sources.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
(P/'selection-audit.json').write_text(json.dumps({'nearestHygIds':[int(q['id']) for q in near],'brightestHygIds':[int(q['id']) for q in bright],'iauNames':[n['name'] for n in iau],'missingDistances':[dict(name=o['name'],id=o['id']) for o in objects if o['d'] is None]},ensure_ascii=False,indent=2)+'\n')
print('Selected',len(objects),'objects,',len(iau),'IAU names;',sum(o['d'] is None for o in objects),'unknown distances;',len(supplement),'outside HYG')
print('Missing:',[o['name'] for o in objects if o['d'] is None])
