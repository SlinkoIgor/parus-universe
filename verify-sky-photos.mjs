import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sky-photos');
context.URL=URL;
const index=run('SKY_PHOTO_INDEX'),frozen=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-astropix.json'));
const webbFrozen=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-webb.json'));
const frozenPhotos=new Map([...frozen.records,...webbFrozen.records].map(p=>[p.id,p]));
const catalogueRoot='dist/'+JSON.parse(fs.readFileSync('dist/catalog-data/current.json')).dataRoot;
const streamEntry=JSON.parse(fs.readFileSync(catalogueRoot+'/search.json')).find(r=>r[0]==='hyg-102078');
context.photoStreamRow=JSON.parse(fs.readFileSync(catalogueRoot+'/'+streamEntry[5])).find(r=>r[0]===streamEntry[0]);
const phatSearch=JSON.parse(fs.readFileSync(catalogueRoot+'/search.json')).filter(r=>r[0].startsWith('phat-ap-'));
context.phatPhotoRows=[...new Set(phatSearch.map(r=>r[5]))].flatMap(file=>JSON.parse(fs.readFileSync(catalogueRoot+'/'+file))).filter(r=>r[0].startsWith('phat-ap-'));
const webbStreamEntry=JSON.parse(fs.readFileSync(catalogueRoot+'/search.json')).find(r=>r[0]==='opengc-ngc0628');
context.webbStreamRow=JSON.parse(fs.readFileSync(catalogueRoot+'/'+webbStreamEntry[5])).find(r=>r[0]===webbStreamEntry[0]);
assert.ok(index.photoCount>6000&&frozen.inputCount>=9000);
assert.equal(frozen.filterSummary.accepted,frozen.records.length);
assert.equal(frozen.inputCount,frozen.filterSummary.accepted+Object.values(frozen.filterSummary.rejected).reduce((a,b)=>a+b,0),'every imported record is retained or has a recorded rejection reason');
execFileSync('python3',['-c',`
import importlib.util,json,sys
sys.path.insert(0,'data-tools')
spec=importlib.util.spec_from_file_location('photos','data-tools/build-sky-photos.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
photos={p['id']:p for filename in ['media-astropix.json','media-webb.json'] for p in json.load(open('data-tools/sky-sources/'+filename))['records']}
spec=importlib.util.spec_from_file_location('photo_import','data-tools/fetch-astropix-media.py')
photo_import=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo_import)
checks=json.load(open('data-tools/sky-sources/photo-import-checks.json'))['cases']
for case in checks:
 row=case['input']
 assert photo_import.rejection_reason(row)==case['expectedRejection'],case['source']
 assert bool(photo_import.convert(row))==(case['expectedRejection'] is None),case['source']
spec=importlib.util.spec_from_file_location('webb_import','data-tools/fetch-webb-media.py')
webb_import=importlib.util.module_from_spec(spec);spec.loader.exec_module(webb_import)
for case in json.load(open('data-tools/sky-sources/webb-import-checks.json'))['cases']:
 record,reason=webb_import.extract(case['html'],case['imageId'])
 assert reason==case['expectedRejection'],(case['source'],reason)
 if record:
  assert record['identifiers']==case['expectedNames'],(case['source'],record['identifiers'])
  assert record['credit'] and record['rights']=='CC BY 4.0'
webb=json.load(open('data-tools/sky-sources/media-webb.json'))
assert webb['inputCount']==sum(p['count'] for p in webb['pages'])
assert webb['inputCount']==len(webb['records'])+len(webb['rejected'])
assert len(webb['records'])>=200 and not any(p['imageId']=='weic2421a' for p in webb['records'])
assert photo_import.survey_image(next(c['input'] for c in checks if c['input']['image_id']=='eso1837d'))
assert photos['astropix-eso-eso1837d']['identifiers']==["Barnard's Star b"], 'original wrong AVM tag is preserved, not silently rewritten'
assert photos['astropix-eso-eso1837d']['primaryStellarIdentifications'][0]['identifier']=="Barnard's Star"
assert photos['astropix-eso-eso1517c']['primaryStellarIdentifications'][0]['identifier']=='51 Pegasi'
assert not photos['astropix-eso-eso1324a']['primaryStellarIdentifications'], 'a direct planet photo cannot be reassigned to the star'
assert module.namespaces(photos['astropix-eso-eso1837d'],"Barnard's Star b")==[]
for a,b in [('Beta Pictoris','* bet Pic'),('π1 Gruis','* pi1 Gru'),('AU Microscopii','V* AU Mic'),('51 Pegasi','* 51 Peg'),('V2500 Ophiuchi','V* V2500 Oph')]:
 assert module.key(a)==module.key(b),(a,b)
assert module.key('MU Cephei')!=module.key('mu Cephei'), 'variable MU is not Bayer mu'
assert module.key('* alf Cen C')!=module.key('Alpha Centauri'), 'component is never erased'
for identifier,pid in [('LMC','astropix-noirlab-noao-02332'),('SMC','astropix-noirlab-noao-6051'),('WLM','astropix-stsci-2022-508b')]:
 assert 'deep-sky' in module.namespaces(photos[pid],identifier),(identifier,pid)
assert module.namespaces(photos['astropix-eso-brammer_5598'],'LMC')==[], 'SMC title/caption cannot confirm an erroneous LMC host tag'
assert module.namespaces(photos['astropix-noirlab-noao-02332'],'B')==[], 'single letters remain ambiguous'
assert module.short_name_evidence(photos['astropix-eso-eso1914a'],'LMC',title_only=True)
assert not module.short_name_evidence(photos['astropix-esahubble-opo0009c'],'LMC',title_only=True), 'a small region inside a host is not its primary overview'
from pathlib import Path
from photo_target_roles import catalogue_aliases, primary_identifiers, name_position
aliases,revision=catalogue_aliases(Path('.'),module.key,list(photos.values()))
cases=[
 ('astropix-noirlab-noao0001a',['M31','NGC 224'],['M32','NGC 221','M110','NGC 205']),
 ('astropix-spitzer-ssc2006-14a1',['M31','NGC 224'],['M32','Messier 32','M110','Messier 110']),
 ('astropix-wise-WISE2010-004c',['M31','NGC 224'],['M32','NGC 221','M110','NGC 205']),
 ('astropix-wise-WISE2010-004c1',['M31'],['M32','M110']),
 ('astropix-wise-WISE2010-004c2',['M31'],['M32','M110']),
 ('astropix-esahubble-heic0601a',['Messier 42'],['Messier 43']),
 ('astropix-esahubble-heic0601c',['Messier 43'],['Messier 42','Orion Nebula']),
 ('astropix-esahubble-heic1207a',['NGC 2366'],['NGC 2363']),
 ('astropix-spitzer-sig12-007',['M100','NGC 4321'],['NGC 4323','NGC 4328']),
 ('astropix-esahubble-heic0103d',['Messier 81','Messier 82','NGC 3031','NGC 3034'],[]),
 ('astropix-esahubble-heic0615a',['NGC4038','NGC4039'],[]),
 ('astropix-esahubble-heic1709b',[],['NGC 4298','NGC 4302']),
]
for pid,keep,exclude in cases:
 primary,evidence=primary_identifiers(photos[pid],aliases,module.key)
 assert all(n in primary for n in keep) and not any(n in primary for n in exclude),(pid,primary)
 assert evidence and evidence['sourceTitle']==photos[pid]['archiveTitle']
assert name_position('Spiral galaxy M101',['M10'],module.key) is None
assert name_position('NGC 4038/4039',['NGC 4039'],module.key) is not None
assert name_position('NGC 6769-71',['NGC 6770'],module.key) is not None
assert name_position('Arp 286 (NGC 5560, 5566 & 5569)',['NGC 5569'],module.key) is not None
audit=json.load(open('data-tools/sky-sources/photo-target-audit.json'))
assert audit['catalogueRevision']==revision and audit['reviewed']>250 and audit['restricted']>100
for review in audit['cases']:
 primary,evidence=primary_identifiers(photos[review['id']],aliases,module.key)
 assert review['primaryIdentifiers']==primary and review['otherIdentifiers']==evidence['otherIdentifiers']
`]);
const all={};for(const [publisher,entry] of Object.entries(index.files)){
 const bytes=fs.readFileSync('dist/'+entry.url.split('?')[0]),data=JSON.parse(bytes);
 assert.equal(Object.keys(data.photos).length,entry.count);
 for(const [id,p] of Object.entries(data.photos)){
  assert.equal(id,p.id);assert.ok(id.startsWith(publisher==='esawebb'?'esawebb-':'astropix-'+publisher+'-'));
  context.photoValidation={id,publisher,p};assert.ok(run('SkyPhotos.validPhoto(photoValidation.id,photoValidation.publisher,photoValidation.p)'));
  assert.ok(p.credit&&p.rights&&p.archive&&p.source.startsWith('https://'));
  if(publisher!=='esawebb')assert.equal(p.url,p.url.toLowerCase(),'IPAC paths are lowercase, including WISE and NRAO');
  assert.equal(p.title,frozenPhotos.get(id).archiveTitle,'caption comes from the source heading, never its first AVM tag');
  all[id]=p;
 }
}
assert.equal(Object.keys(all).length,index.photoCount);
for(const id of index.surveys)assert.equal(all[id].mediaKind,'survey','published survey fields retain their source type');
assert.ok(!index.targets['star:fomalhautb'],'planet b cannot become stellar component B');
assert.ok(index.targets['star:siriusb']?.includes('astropix-esahubble-heic0516a'),'actual uppercase stellar component remains usable');
for(const ids of Object.values(index.targets))for(const id of ids)assert.ok(all[id],'all index references resolve');
const targetAudit=JSON.parse(fs.readFileSync('data-tools/sky-sources/photo-target-audit.json'));
assert.equal(targetAudit.imageRevision,index.revision);
assert.equal(targetAudit.catalogueRevision,JSON.parse(fs.readFileSync('dist/catalog-data/current.json')).revision);
for(const review of targetAudit.cases)for(const name of review.otherIdentifiers){
 context.reviewedPhotoName=name;
 const suffix=':'+run('SkyPhotos.key(reviewedPhotoName)');
 for(const [target,ids] of Object.entries(index.targets))if(target.endsWith(suffix)){
  assert.ok(!ids.includes(review.id),'excluded/context-only AVM tag cannot remain indexed: '+review.id+' '+target);
 }
}
context.photoFixtures=all;
context.photoIdentityNames=Object.fromEntries([...frozenPhotos].map(([id,p])=>[id,p.identifiers]));
run(`
assert.equal(SkyPhotos.cache.size,0,'no metadata preloaded at startup');
for(const [a,b] of [['Beta Pictoris','* bet Pic'],['π1 Gruis','* pi1 Gru'],['AU Microscopii','V* AU Mic'],['51 Pegasi','* 51 Peg'],['V2500 Ophiuchi','V* V2500 Oph']])assert.equal(SkyPhotos.key(a),SkyPhotos.key(b));
assert.notEqual(SkyPhotos.key('MU Cephei'),SkyPhotos.key('mu Cephei'));
assert.notEqual(SkyPhotos.key('* alf Cen C'),SkyPhotos.key('Alpha Centauri'));
assert.deepEqual(SkyPhotos.ids(object('barnard')),['astropix-eso-eso1837d']);
assert.ok(SkyPhotos.ids(object('hyg-27253')).includes('astropix-esahubble-opo0625b'),'clean Hubble disk image matches own Bayer designation');
assert.ok(SkyPhotos.ids(ExtendedCatalog.decode(photoStreamRow)).includes('astropix-esahubble-opo0702b'),'unannotated AU Mic image retained for an actual streamed star');
assert.ok(SkyPhotos.ids(object('hyg-81130')).length>0,'own explicit Zeta Ophiuchi designation');
assert.ok(SkyPhotos.ids(object('hyg-112997')).includes('astropix-eso-eso1517c'),'51 Peg field repaired independently of Barnard');
assert.ok(!SkyPhotos.ids(object('hyg-27253')).includes('astropix-eso-eso1324a'),'planet around a different star cannot become a host photograph');
for(const id of ['lmc','smc']){
 const o=object(id),slides=[...SkyGuide.gallery(o).matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(SkyPhotos.ids(o).length>5,'short exact galaxy code: '+id);
 assert.deepEqual(slides.slice(0,2),['chart-wide','chart-close']);
 assert.ok(SkyGuide.observing(o).nakedEye&&SkyGuide.finder(o).includes('NOIRLab'),'published naked-eye evidence: '+id);
 const restored={...o,id:'restored-'+id,aliases:[id.toUpperCase()],ngc:null,messier:null};
 assert.ok(SkyPhotos.ids(restored).length>5&&SkyGuide.canChart(restored),'restored identity: '+id);
 for(const kind of ['star','nebula','cluster']){
  const member={id:'inside-'+id,kind,galaxyMember:true,parentGalaxy:id,aliases:[id.toUpperCase()]};
  assert.equal(SkyPhotos.ids(member).length,0,'members never acquire host photographs');
  assert.equal(SkyGuide.observingEvidence(member),null,'members never acquire host visibility');
 }
}
assert.ok(SkyPhotos.ids(object('lmc'))[0]==='astropix-eso-eso1914a','whole-galaxy VISTA view precedes small regions');
assert.equal(SkyGuide.magnitude(object('lmc')),null,'qualitative visibility does not fabricate V');
for(const [id,photo] of [['hyg-80519','astropix-eso-eso1726a'],['hyg-101767','astropix-eso-eso8908c'],['hyg-27253','astropix-esahubble-opo9602c'],['hyg-10800','astropix-eso-potw1447a']]){
 assert.ok(SkyPhotos.ids(object(id)).includes(photo),'new exact stellar photography: '+id);
}
for(const [id,aliases] of [['unrelated',['NGC224']],['host',['LMC','M31']],['single-letter',['B']],['other-component',['Fomalhaut B']]]){
 assert.equal(SkyPhotos.ids({...object('sirius'),id,hip:null,hd:null,iauNames:[],aliases}).length,0,id);
}
assert.equal(SkyPhotos.ids({...object('sirius'),synthetic:true}).length,0);
assert.equal(SkyPhotos.ids({...object('sirius'),unresolvedSourcePhotometry:true}).length,0);
assert.ok(!SkyPhotos.ids(object('proxima')).some(id=>/alpha/.test(id)),'Proxima cannot borrow Alpha AB');
assert.ok(!SkyPhotos.ids(object('hyg-112923')).some(id=>SkyPhotos.ids(object('hyg-113008')).includes(id)),'Fomalhaut B cannot borrow the A disc');
assert.ok(SkyPhotos.ids({...object('andromeda'),id:'restored',ngc:null,messier:null,aliases:['NGC 0224']}).length,'restored aliases/leading zeros');
const m32={id:'restored-m32',kind:'galaxy',ngc:'NGC0221',messier:'032',aliases:['M32','NGC 221']},
 m110={id:'restored-m110',kind:'galaxy',ngc:'NGC0205',messier:'110',aliases:['M110','NGC 205']};
assert.equal(SkyPhotos.ids(m32).length,4,'M32 retains four dedicated Hubble materials');
assert.equal(SkyPhotos.ids(m110).length,3,'M110 retains its own portraits');
for(const o of [m32,m110])for(const id of ['astropix-noirlab-noao0001a','astropix-spitzer-ssc2006-14a1','astropix-wise-WISE2010-004c','astropix-wise-WISE2010-004c1','astropix-wise-WISE2010-004c2']){
 assert.ok(!SkyPhotos.ids(o).includes(id),'satellite cannot borrow a whole Andromeda view: '+o.id);
 assert.ok(SkyPhotos.ids(object('andromeda')).includes(id),'whole Andromeda views remain available');
}
assert.ok(!SkyPhotos.ids({...object('sirius'),id:'wrong-class',hip:null,hd:null,iauNames:[],aliases:['NGC 0224']}).length);
assert.ok(!SkyPhotos.ids({...object('sgr'),id:'host-bh',ngc:'NGC224',aliases:[],messier:null}).length,'black hole cannot borrow host-galaxy photograph');
for(const kind of ['cluster','nebula','star']){
 const member={id:'host-member-'+kind,kind,galaxyMember:true,parentGalaxy:'andromeda',ngc:null,messier:null,aliases:['Андромеда · M31','Andromeda','M31']};
 assert.equal(SkyPhotos.ids(member).length,0,'all member classes exclude inherited host aliases');
 assert.equal(SkyGuide.media(member).length,0,'curated observations also exclude host aliases');
 assert.equal(SkyGuide.visualCollection(member),null,'host membership is not visual observability');
}
for(const [id,p] of Object.entries(photoFixtures)){const publisher=SkyPhotos.publisher(id);if(!SkyPhotos.cache.has(publisher))SkyPhotos.cache.set(publisher,{});SkyPhotos.cache.get(publisher)[id]=p;}
assert.equal(phatPhotoRows.length,2753,'audit the entire PHAT cluster class');
let ambiguousPhat=0;
for(const row of phatPhotoRows){
 const o=ExtendedCatalog.decode(row),before=JSON.stringify(o.aliases),ambiguous=o.aliases.filter(s=>/^M\\d+$/i.test(s));
 if(ambiguous.length){ambiguousPhat++;assert.ok(!SkyPhotos.keys(o).some(k=>/^deep-sky:m\\d+$/.test(k)),'PHAT alternate M label is not Messier: '+o.id);}
 assert.deepEqual(SkyPhotos.ids({...o,memberType:undefined}),SkyPhotos.ids(o),'old PHAT saves retain the source namespace even without a modern class label');
 for(const pid of SkyPhotos.ids(o))assert.ok(photoIdentityNames[pid].some(n=>/^AP\\s*\\d+$/.test(n)&&o.aliases.some(a=>SkyPhotos.key(a)===SkyPhotos.key(n))),'real PHAT portraits retain an explicit matching AP identity: '+o.id);
 assert.ok(!SkyGuide.media(o).some(p=>p.id.startsWith('esawebb-')),'PHAT cannot borrow Webb Messier images');
 assert.equal(JSON.stringify(o.aliases),before,'source aliases remain intact');
}
assert.ok(ambiguousPhat>5);
ExtendedCatalog.pin(ExtendedCatalog.decode(webbStreamRow));
for(const id of ['orion','whirlpool','opengc-ngc6611','opengc-ngc6720','opengc-ngc0628']){
 const o=object(id),gallery=SkyGuide.gallery(o),slides=[...gallery.matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]);
 if(SkyGuide.canChart(o))assert.deepEqual(slides.slice(0,2),['chart-wide','chart-close']);
 assert.ok(/Webb|JWST/i.test(SkyGuide.media(o)[0].instrument),'Webb is the first photographic frame');
 assert.ok(SkyPhotos.ids(o).some(p=>p.startsWith('esawebb-')),'direct ESA/Webb observations: '+id);
}
assert.ok(!SkyPhotos.ids(object('hyg-108526')).includes('esawebb-weic2421a'),'a coronagraph image of the exoplanet is not a photograph of the blocked star');
for(const id of ['hyg-80519','hyg-101767','hyg-27253','hyg-10800','andromeda','orion','lmc','smc']){
 const slides=[...SkyGuide.gallery(object(id)).matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(slides.slice(0,2),['chart-wide','chart-close']);assert.ok(slides.some(s=>s.startsWith('astropix-')));
 for(const p of SkyPhotos.media(object(id)))assert.ok(slides.includes(p.id),'distinct frames sharing a source page remain available');
 const kinds=SkyPhotos.media(object(id)).map(p=>p.mediaKind);
 assert.ok(kinds.lastIndexOf('observation')<0||kinds.indexOf('survey')<0||kinds.lastIndexOf('observation')<kinds.indexOf('survey'),'observatory photographs precede published DSS fields across all own aliases');
 assert.ok(['dss','survey'].includes(slides.at(-1)));assert.ok(!SkyGuide.gallery(object(id)).includes('<img src='),'images remain lazy');
}
assert.ok(SkyGuide.gallery(object('hyg-80519')).includes('Creative Commons Attribution'));
assert.equal(SkyPhotos.media(object('barnard'))[0].instrument,'Digitized Sky Survey 2');
assert.ok(SkyPhotos.media(object('barnard'))[0].description.includes('трёх положениях'),'proper motion is described, with no claim of a Hubble photograph');
assert.deepEqual([...SkyGuide.gallery(object('barnard')).matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]).slice(0,3),['chart-wide','chart-close','astropix-eso-eso1837d']);
SkyPhotos.cache.clear();
`);
console.log('PASS thousands of attributed external photographs, exact stellar/deep-sky identities, components/hosts, restored objects and gallery order');
// Exercise the real async loader, including a failed publisher and a retry.
let requests=[];
context.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url.split('?')[0]))};};
await Promise.all([run("SkyPhotos.ensure(object('hyg-80519'))"),run("SkyPhotos.ensure(object('hyg-101767'))")]);
assert.equal(requests.filter(u=>u.startsWith('sky-photos-eso.json')).length,1,'concurrent cards share publisher request');
assert.ok(run("SkyPhotos.media(object('hyg-80519')).length>0"));
requests=[];await run("SkyPhotos.ensure(object('hyg-80519'))");assert.equal(requests.length,0);
run('SkyPhotos.cache.clear()');context.fetch=async()=>({ok:false,status:503});
await run("SkyPhotos.ensure(object('hyg-80519'))");assert.ok(run("SkyPhotos.failed.has('eso')"));
assert.equal(await run("SkyPhotos.ensure(object('hyg-80519'))"),false,'failure cannot cause infinite retries');
run('SkyPhotos.failed.clear()');context.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url.split('?')[0]))});
await run("SkyPhotos.ensure(object('hyg-80519'))");assert.ok(run("SkyPhotos.media(object('hyg-80519')).length>0"));
console.log('PASS lazy loading, shared concurrent requests, caching, failed source and retry');
run('SkyPhotos.cache.clear();SkyPhotos.failed.clear()');
context.PARUS_CATALOG_FILES={'sky-photos-eso.json':'invalid JSON'};
context.fetch=async()=>{throw Error('Standalone metadata must not use the network');};
await run("SkyPhotos.ensure(object('hyg-80519'))");assert.equal(run('SkyPhotos.pending.size'),0);
context.PARUS_CATALOG_FILES['sky-photos-eso.json']=fs.readFileSync('dist/sky-photos-eso.json','utf8');
run('SkyPhotos.failed.clear()');await run("SkyPhotos.ensure(object('hyg-80519'))");
assert.ok(run("SkyPhotos.media(object('hyg-80519')).length>0"));assert.equal(run('SkyPhotos.pending.size'),0);
console.log('PASS standalone embedded metadata without network requests, failed embedded data and recovery');
run('SkyPhotos.cache.clear();SkyPhotos.failed.clear()');
context.PARUS_CATALOG_FILES=undefined;requests=[];
context.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url.split('?')[0]))};};
await Promise.all([run("SkyPhotos.ensure(object('orion'))"),run("SkyPhotos.ensure(object('whirlpool'))")]);
assert.equal(requests.filter(u=>u.startsWith('sky-photos-esawebb.json')).length,1,'Webb cards share one lazy publisher request');
assert.ok(run("SkyPhotos.media(object('whirlpool')).some(p=>p.id.startsWith('esawebb-'))"));
const webbPhoto=Object.values(all).find(p=>p.id.startsWith('esawebb-'));
context.webbBad={...webbPhoto,url:'https://cdn.esawebb.org.evil.invalid/archives/images/screen/test.jpg'};
assert.equal(run('!!SkyPhotos.validPhoto(webbBad.id,"esawebb",webbBad)'),false,'only the actual ESA CDN is accepted');
run('SkyPhotos.cache.clear();SkyPhotos.failed.clear()');
context.PARUS_CATALOG_FILES=Object.fromEntries(Object.values(index.files).map(e=>[e.url.split('?')[0],fs.readFileSync('dist/'+e.url.split('?')[0],'utf8')]));
context.fetch=async()=>{throw Error('Embedded Webb metadata must not use the network');};
await run("SkyPhotos.ensure(object('whirlpool'))");assert.ok(run("SkyPhotos.cache.has('esawebb')"));
console.log('PASS 2753 PHAT namespaces, direct Webb identities, chart order, shared lazy ESA loading, strict asset origin and embedded export');
const files=['dist/sky-photos-index.js','data-tools/sky-sources/photo-target-audit.json',...Object.values(index.files).map(e=>'dist/'+e.url.split('?')[0])];
const before=files.map(p=>fs.readFileSync(p));execFileSync('python3',['data-tools/build-sky-photos.py']);
files.forEach((p,i)=>assert.ok(before[i].equals(fs.readFileSync(p))));
console.log('PASS deterministic offline rebuild of the entire photo index and all metadata files');
