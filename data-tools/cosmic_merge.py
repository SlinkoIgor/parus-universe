"""Cross-identify added source rows without moving existing usable atlas positions."""
import gzip,json,re,math,collections

def key(s):
 s=''.join(c.lower() for c in str(s) if c.isalnum())
 # Only established catalogue prefixes: never strip zeroes from sky-coordinate IDs.
 return re.sub(r'^(ngc|ic|ugc|pgc|aco|abell|a)0*(\d+)$',lambda m:('aco' if m[1] in ('aco','abell','a') else m[1])+str(int(m[2])),s)
def family(kind,extra):
 if kind=='galaxy' and extra.get('catalogType') in ('GPair','GTrpl','GGroup'):return 'galaxy-system'
 if kind=='cluster':return extra.get('catalogClass') or ('galaxy-cluster' if 'галактик' in ' '.join(str(extra.get(k,'')) for k in ('type','catalogTypeLabel','name')).lower() else 'stellar-cluster')
 return 'structure' if kind in ('structure','wall','ring','arc') else kind

def merge_catalogs(root,core,records,patches,coverage,projection):
 data=json.loads(gzip.decompress((root/'data-tools/cosmic-catalogs.json.gz').read_bytes()));members={};aliases=collections.defaultdict(set);grid=collections.defaultdict(set);core_patches={};merged=[];conflicts=[];upgraded=[];new_ids=[]
 def position(ra,dec):
  if ra is None or dec is None:return None
  a,b=math.radians(ra),math.radians(dec);return math.cos(b)*math.cos(a),math.cos(b)*math.sin(a),math.sin(b)
 def gridkey(v):return tuple(math.floor(x/.0005) for x in v)
 def register(m):
  members[m['id']]=m
  for name in m['aliases']:
   k=key(name)
   if k:aliases[(m['family'],k)].add(m['id'])
  v=position(m['ra'],m['dec'])
  if v:
   m['unit']=v;grid[(m['family'],*gridkey(v))].add(m['id'])
 def angular(a,b):return math.degrees(2*math.asin(min(1,math.dist(a,b)/2)))
 for o in core:
  extra={**o,'type':o.get('type','')+' '+o.get('facts',{}).get('class','')};register({'id':o['id'],'family':family(o['kind'],extra),'aliases':[o['id'],o['name'],*o.get('aliases',[]),o.get('ngc','')],'ra':o.get('raDeg'),'dec':o.get('decDeg'),'d':o.get('d'),'core':o})
 for r in records:
  register({'id':r[0],'family':family(r[2],r[11]),'aliases':[r[0],r[1],*r[8],r[11].get('ngc','')],'ra':r[4],'dec':r[5],'d':r[3],'row':r})
 for source,c in data['coverage'].items():coverage[source]={**c,'added':0,'merged':0,'promotedFromAtlas':0}
 # Named catalogues provide cross-IDs before the PGC-only distance table.
 order={'MCXC-II':0,'SDSS-Superclusters':1,'SDSS-Filaments':2,'SDSS-Voids':3,'GLADE+':4,'Nearby-Galaxies':5,'Cosmicflows-4':6,'Gaia-Clusters':7}
 for o in sorted(data['objects'],key=lambda o:(order[o['catalogKey']],o['id'])):
  conflict_start=len(conflicts);source=o['catalogKey'];kind=o['kind'];extra={k:v for k,v in o.items() if k not in ('id','name','kind','distanceLy','raDeg','decDeg','aliases') and v is not None};extra['cosmicCatalog']=True
  fam=family(kind,{**extra,'name':o['name']});names=[o['name'],*o['aliases']];source_pgc={key(n) for n in names if re.fullmatch(r'pgc0*\d+',key(n))};ra=o['raDeg'];dec=o['decDeg'];v=position(ra,dec);candidates=set()
  for name in names:candidates.update(aliases.get((fam,key(name)),()))
  exact=[]
  for ident in candidates:
   m=members[ident]
   sep=angular(v,m['unit']) if v and 'unit' in m else None
   target_pgc={key(n) for n in m['aliases'] if re.fullmatch(r'pgc0*\d+',key(n))}
   if source_pgc and target_pgc and source_pgc.isdisjoint(target_pgc):
    conflicts.append({'sourceId':o['id'],'candidate':ident,'reason':'conflicting PGC identifiers'});continue
   if source in m.get('claimedCatalogs',set()) or m.get('row',[])[10:11]==[source]:
    # The GLADE list can repeat one PGC through different input catalogues;
    # do not confuse this with distinct Abell subclusters or Gaia subgroups.
    if not(source=='GLADE+' and source_pgc&target_pgc and sep is not None and sep<1/3600 and m['d'] and abs(m['d']/o['distanceLy']-1)<.1):continue
   # Extended cluster centres can differ within the object; galaxies cannot.
   if sep is None or sep<(.2 if fam.endswith('cluster') else .03):exact.append(ident)
   else:conflicts.append({'sourceId':o['id'],'candidate':ident,'reason':'same alias but incompatible direction','separationDeg':sep})
  if len(exact)>1:
   # Prefer the established object, but never silently fuse several existing IDs.
   exact.sort(key=lambda ident:(not bool(members[ident].get('core')),ident));conflicts.append({'sourceId':o['id'],'candidates':exact,'reason':'multiple identity candidates; kept separate'});exact=[]
  basis='identifier+direction'
  if not exact and v and fam in ('galaxy','stellar-cluster'):
   near=set();g=gridkey(v)
   for x in (-1,0,1):
    for y in (-1,0,1):
     for z in (-1,0,1):near.update(grid.get((fam,g[0]+x,g[1]+y,g[2]+z),()))
   near=[ident for ident in near if source not in members[ident].get('claimedCatalogs',set()) and members[ident].get('row',[])[10:11]!=[source] and 'unit' in members[ident] and angular(v,members[ident]['unit'])<1/3600 and members[ident]['d'] and o['distanceLy'] and abs(members[ident]['d']/o['distanceLy']-1)<.1]
   # Conflicting PGC identifiers prohibit a positional merge.
   pgc={key(n) for n in names if re.fullmatch(r'pgc0*\d+',key(n))}
   near=[ident for ident in near if not (pgc and (oldpgc:={key(n) for n in members[ident]['aliases'] if re.fullmatch(r'pgc0*\d+',key(n))}) and pgc.isdisjoint(oldpgc))]
   if len(near)==1:exact=near;basis='unique <1 arcsec + compatible distance + no conflicting PGC'
  if exact:
   ident=exact[0];m=members[ident];m.setdefault('claimedCatalogs',set()).add(source);coverage[source]['merged']+=1;merged.append([o['id'],ident,basis]);m['aliases']=list(dict.fromkeys([*m['aliases'],*names]))
   for name in names:aliases[(fam,key(name))].add(ident)
   if 'core' in m:
    p=core_patches.setdefault(ident,{'aliases':[],'catalogMeasurements':[]});p['aliases']=list(dict.fromkeys([*p['aliases'],*names]));p['catalogMeasurements'].append({'catalog':source,'sourceId':o['id'],'source':extra['referenceURL'],'distanceLy':o['distanceLy'],'data':extra.get('catalogData',{})})
    # Existing core coordinates, classification and curated region remain intact.
    if not m['core'].get('massSolar') and (re.search(r'нет|неизвест|не задан|не измерен|не установлен',m['core'].get('facts',{}).get('mass',''),re.I) or not re.search(r'\d.*M☉',m['core'].get('facts',{}).get('mass',''))) and extra.get('massSolar'):
     for field in ('massSolar','massUncertaintySolar','massIsSystem','massBasis'):p[field]=extra.get(field)
     p['massSource']=extra['referenceURL']
    continue
   r=m['row'];r[8]=list(dict.fromkeys([*r[8],*names]));r[11].setdefault('catalogMeasurements',[]).append({'catalog':source,'sourceId':o['id'],'source':extra['referenceURL'],'distanceLy':o['distanceLy'],'data':extra.get('catalogData',{})})
   # Fill unavailable positions for every matched record with a usable individual
   # distance. Keep established usable positions and their save/route anchors.
   if r[11].get('atlasOnly') and not r[11].get('invalidIdentification') and not r[11].get('identityConflict') and not extra.get('atlasOnly') and o['distanceLy']:
    old={'d':r[3],'raDeg':r[4],'decDeg':r[5],'reason':r[11].get('positionReason')};r[3:8]=[o['distanceLy'],ra,dec,o.get('positionQuality','approximate'),extra['distanceMethod']];r[11].update({k:v for k,v in extra.items() if k not in ('cosmicCatalog','catalogData')});r[11].update(atlasOnly=False,catalogPositionUpdated=True,previousCatalogPosition=old);r[11].pop('positionReason',None);r[12:14]=projection(ra,dec,r[3],kind,ident);m.update(ra=ra,dec=dec,d=r[3]);coverage[source]['promotedFromAtlas']+=1;upgraded.append(ident)
   if extra.get('diameterLy') and (r[11].get('sizeEstimated') or r[11].get('sizeUnknown')):r[11].update(diameterLy=extra['diameterLy'],sizeEstimated=False,sizeUnknown=False)
   for field in ('massSolar','massUncertaintySolar','massIsSystem','massBasis','diameterLy','angularMajorArcmin','angularMinorArcmin','hubbleType','sizeOrientationUnknown'):
    if not r[11].get(field) and extra.get(field) is not None:r[11][field]=extra[field]
   if extra.get('massSolar') and not r[11].get('massSource'):r[11]['massSource']=extra['referenceURL']
   if r[1].startswith(('PGC ','GLADE+ ')) and not o['name'].startswith(('PGC ','GLADE+ ')):r[1]=o['name']
   continue
  if len(conflicts)>conflict_start:
   extra['identityConflict']=True;extra['atlasOnly']=True;extra['positionReason']='Противоречие межкаталожной идентификации: несовместимые координаты, разные PGC или несколько кандидатов. Только атлас до проверки.'
  ident=o['id'];quality=o.get('positionQuality','approximate');located=o['distanceLy'] and ra is not None and dec is not None and not extra.get('atlasOnly');x,y=projection(ra,dec,o['distanceLy'],kind,ident) if located else (None,None)
  if extra.get('p3') and located:x,y=extra['p3'][0],-extra['p3'][1]
  if extra.get('massSolar'):extra['massSource']=extra['referenceURL']
  r=[ident,o['name'],kind,o['distanceLy'],ra,dec,quality if o['distanceLy'] and ra is not None and dec is not None else 'unknown',extra.get('distanceMethod',''),names,None,source,extra,x,y]
  if not located:extra['atlasOnly']=True
  records.append(r);coverage[source]['added']+=1;new_ids.append(ident);register({'id':ident,'family':fam,'aliases':names,'ra':ra,'dec':dec,'d':o['distanceLy'],'row':r})
 result={'retrieved':data['retrieved'],'sources':data['sources'],'referenceCosmology':data['referenceCosmology'],'coverage':{k:coverage[k] for k in data['coverage']},'inputObjects':len(data['objects']),'added':len(new_ids),'merged':len(merged),'promotedFromAtlas':len(upgraded),'matches':merged,'conflicts':conflicts,'upgradedIds':upgraded,'filamentRotationValidation':data['filamentRotationValidation'],'filamentFrameChecks':data['filamentFrameChecks'],'positionPolicy':'Existing usable positions/IDs stay fixed. Missing/unusable distances are filled by usable individual data; no host shell, random depth or brightness-based radius. Conflicting catalogue IDs/directions are not silently merged.'}
 (root/'data-tools/cosmic-catalog-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 return core_patches,result
