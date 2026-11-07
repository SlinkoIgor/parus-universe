import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sky-photos');
context.URL=URL;
const index=run('SKY_PHOTO_INDEX'),frozen=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-astropix.json'));
assert.ok(index.photoCount>6000&&frozen.inputCount>=9000);
execFileSync('python3',['-c',`
import importlib.util,json
spec=importlib.util.spec_from_file_location('photos','data-tools/build-sky-photos.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
photos={p['id']:p for p in json.load(open('data-tools/sky-sources/media-astropix.json'))['records']}
for identifier,pid in [('LMC','astropix-noirlab-noao-02332'),('SMC','astropix-noirlab-noao-6051'),('WLM','astropix-stsci-2022-508b')]:
 assert 'deep-sky' in module.namespaces(photos[pid],identifier),(identifier,pid)
assert module.namespaces(photos['astropix-eso-brammer_5598'],'LMC')==[], 'SMC title/caption cannot confirm an erroneous LMC host tag'
assert module.namespaces(photos['astropix-noirlab-noao-02332'],'B')==[], 'single letters remain ambiguous'
assert module.short_name_evidence(photos['astropix-eso-eso1914a'],'LMC',title_only=True)
assert not module.short_name_evidence(photos['astropix-esahubble-opo0009c'],'LMC',title_only=True), 'a small region inside a host is not its primary overview'
`]);
const all={};for(const [publisher,entry] of Object.entries(index.files)){
 const bytes=fs.readFileSync('dist/'+entry.url.split('?')[0]),data=JSON.parse(bytes);
 assert.equal(Object.keys(data.photos).length,entry.count);
 for(const [id,p] of Object.entries(data.photos)){
  assert.equal(id,p.id);assert.ok(id.startsWith('astropix-'+publisher+'-'));
  assert.ok(p.url.startsWith('https://www.astropix.org/archive/')&&p.credit&&p.rights&&p.archive&&p.source.startsWith('https://'));
  assert.equal(p.url,p.url.toLowerCase(),'IPAC paths are lowercase, including WISE and NRAO');
  all[id]=p;
 }
}
assert.equal(Object.keys(all).length,index.photoCount);
assert.ok(!index.targets['star:fomalhautb'],'planet b cannot become stellar component B');
assert.ok(index.targets['star:siriusb']?.includes('astropix-esahubble-heic0516a'),'actual uppercase stellar component remains usable');
for(const ids of Object.values(index.targets))for(const id of ids)assert.ok(all[id],'all index references resolve');
context.photoFixtures=all;
run(`
assert.equal(SkyPhotos.cache.size,0,'no metadata preloaded at startup');
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
assert.ok(!SkyPhotos.ids({...object('sirius'),id:'wrong-class',hip:null,hd:null,iauNames:[],aliases:['NGC 0224']}).length);
assert.ok(!SkyPhotos.ids({...object('sgr'),id:'host-bh',ngc:'NGC224',aliases:[],messier:null}).length,'black hole cannot borrow host-galaxy photograph');
for(const kind of ['cluster','nebula','star']){
 const member={id:'host-member-'+kind,kind,galaxyMember:true,parentGalaxy:'andromeda',ngc:null,messier:null,aliases:['Андромеда · M31','Andromeda','M31']};
 assert.equal(SkyPhotos.ids(member).length,0,'all member classes exclude inherited host aliases');
 assert.equal(SkyGuide.media(member).length,0,'curated observations also exclude host aliases');
 assert.equal(SkyGuide.visualCollection(member),null,'host membership is not visual observability');
}
for(const [id,p] of Object.entries(photoFixtures)){const publisher=SkyPhotos.publisher(id);if(!SkyPhotos.cache.has(publisher))SkyPhotos.cache.set(publisher,{});SkyPhotos.cache.get(publisher)[id]=p;}
for(const id of ['hyg-80519','hyg-101767','hyg-27253','hyg-10800','andromeda','orion','lmc','smc']){
 const slides=[...SkyGuide.gallery(object(id)).matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(slides.slice(0,2),['chart-wide','chart-close']);assert.ok(slides.some(s=>s.startsWith('astropix-')));
 for(const p of SkyPhotos.media(object(id)))assert.ok(slides.includes(p.id),'distinct frames sharing a source page remain available');
 assert.ok(['dss','survey'].includes(slides.at(-1)));assert.ok(!SkyGuide.gallery(object(id)).includes('<img src='),'images remain lazy');
}
assert.ok(SkyGuide.gallery(object('hyg-80519')).includes('Creative Commons Attribution'));
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
const files=['dist/sky-photos-index.js',...Object.values(index.files).map(e=>'dist/'+e.url.split('?')[0])];
const before=files.map(p=>fs.readFileSync(p));execFileSync('python3',['data-tools/build-sky-photos.py']);
files.forEach((p,i)=>assert.ok(before[i].equals(fs.readFileSync(p))));
console.log('PASS deterministic offline rebuild of the entire photo index and all metadata files');
