import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('tests/verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#wikipedia');
const index=run('WIKIPEDIA_INDEX');
assert.ok(Object.keys(index.targets).length>1000,'whole-catalogue enrichment, not a few manually selected cards');
assert.ok(Object.keys(index.mediaTargets).length>500);
const all={};
for(const [shard,entry] of Object.entries(index.files)){
 const data=JSON.parse(fs.readFileSync('dist/'+entry.url.split('?')[0]));
 assert.equal(Object.keys(data.photos).length,entry.count);
 for(const [id,p] of Object.entries(data.photos)){
  assert.equal(index.shards[id],shard);context.wikiValidation={id,p};
  assert.ok(run('Wikipedia.valid(wikiValidation.id,wikiValidation.p)'),id);
  assert.ok(p.source.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.equal(decodeURIComponent(new URL(p.source).pathname.slice('/wiki/'.length)).replaceAll('_',' ').normalize('NFC'),p.fileTitle.replaceAll('_',' ').normalize('NFC'),'file identity and attribution stay together');
  assert.ok(p.credit&&p.rights&&p.description);all[id]=p;
 }
}
const source=JSON.parse(fs.readFileSync('data-tools/sky-sources/wikipedia.json'));
assert.ok(source.articleCount>5000);
for(const r of source.records){
 assert.ok(r.pageId&&r.revision&&r.url.startsWith('https://'));
 for(const [id,names] of Object.entries(r.matches))assert.ok(id&&names.length,'preserved identity evidence');
 if(r.title==='Alpha Centauri')assert.ok(!r.matches.proxima,'Proxima has its own identity');
 if(r.matches['bh-m87'])assert.ok(r.matches['bh-m87'].every(n=>!/^(NGC|IC|M|Messier)\s*\d+[a-z]?$/i.test(n)),'host designations do not identify a nucleus');
}
context.wikipediaFixtures=all;
run(`
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.d,o.facts,o.source]));
for(const id of ['local-void','bootes','sloan','shapley','andromeda','milkyway','sol','proxima']){
 const o=object(id),article=Wikipedia.article(o);assert.ok(article,'verified article for '+id);
 assert.ok(/^https:\\/\\/(ru|en)\\.wikipedia\\.org\\/wiki\\//.test(article.url));
 assert.equal(Wikipedia.article(JSON.parse(JSON.stringify(o))).url,article.url,'restored identity: '+id);
 showObject(id);assert.ok($('dialogContent').innerHTML.includes('class="object-wikipedia"'));
 assert.ok($('dialogContent').innerHTML.indexOf('object-wikipedia')<$('dialogContent').innerHTML.indexOf('stellarMedia'),'link beside the heading: '+id);
 $('infoDialog').close();
}
assert.equal(Wikipedia.article({id:'arrival-star:test',synthetic:true}),null);
assert.equal(Wikipedia.article({id:'not-a-real-id',name:'Андромеда'}),null,'no guessed link based on a display label');
assert.equal(Wikipedia.article({id:'not-a-real-id',parentGalaxy:'andromeda'}),null,'no host inheritance');
for(const [id,p] of Object.entries(wikipediaFixtures)){
 const shard=Wikipedia.shard(id);if(!Wikipedia.cache.has(shard))Wikipedia.cache.set(shard,{});Wikipedia.cache.get(shard)[id]=p;
}
for(const id of ['local-void','bootes','shapley','sloan']){
 const o=object(id),photos=Wikipedia.media(o);assert.ok(photos.length,'gallery images: '+id);
 const gallery=SkyGuide.gallery(o);for(const p of photos)assert.ok(gallery.includes(SkyGuide.escape(p.url)),'the image remains present when an existing archive has the same URL');
 assert.equal(SkyGuide.media(o).length,new Set(SkyGuide.media(o).map(p=>p.url)).size,'no duplicate URLs: '+id);
}
assert.ok(Wikipedia.media(object('local-void')).some(p=>p.fileTitle==='File:The Local Void.gif'));
assert.ok(Wikipedia.media(object('bootes')).some(p=>p.fileTitle==='File:Superclusters atlasoftheuniverse rus.gif'));
assert.ok(Wikipedia.media(object('shapley')).some(p=>p.fileTitle==='File:2MASS LSS chart-NEW Nasa rus.jpg'));
assert.ok(!Wikipedia.hasObservation(object('bootes')),'a void map is not an observatory photograph');
assert.ok(Wikipedia.media(object('bh-m87')).every(p=>/black.?hole|eht|event.horizon/i.test(p.fileTitle)),'a nucleus cannot borrow a host galaxy portrait');
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.d,o.facts,o.source])),science,'media never changes science');
Wikipedia.cache.clear();
`);
const requests=[];
context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url.split('?')[0]))};};
await run("Promise.all([Wikipedia.ensure(object('local-void')),Wikipedia.ensure(object('local-void'))])");
assert.equal(new Set(requests).size,requests.length,'concurrent galleries share each shard request');
assert.ok(run("Wikipedia.media(object('local-void')).length>0"));
assert.equal(run('Wikipedia.pending.size'),0);
run('Wikipedia.cache.clear();Wikipedia.failed.clear();');
context.fetch=async()=>({ok:true,json:async()=>({version:1,photos:{corrupt:{}}})});
await run("Wikipedia.ensure(object('local-void'))");
assert.ok(run('Wikipedia.failed.size>0'));assert.equal(run('Wikipedia.cache.size'),0,'invalid shards fail closed');
context.PARUS_CATALOG_FILES=Object.fromEntries(Object.values(index.files).map(e=>[e.url.split('?')[0],fs.readFileSync('dist/'+e.url.split('?')[0],'utf8')]));
run('Wikipedia.failed.clear();');
await run("Wikipedia.ensure(object('local-void'))");
assert.ok(run("Wikipedia.media(object('local-void')).length>0"),'retry and standalone embedded metadata');
execFileSync('python3',['-c',String.raw`
import importlib.util
spec=importlib.util.spec_from_file_location('wiki','data-tools/fetch-wikipedia-media.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.key('NGC 0001')==m.key('NGC1')
assert m.key('Abell 3627')==m.key('A3627')
assert m.key('Quipu (cosmic structure)')==m.key('Quipu')
assert m.key('M87*')!=m.key('M87')
assert m.file_key('NGC001.jpg')!=m.file_key('NGC1.jpg')
assert m.file_key('Field.jpg')!=m.file_key('Field.JPG')
assert m.file_key('The_Local_Void.gif')==m.file_key('The Local Void.gif')
assert m.key('Barnard’s Star')!=m.key('Barnard 1')
lookup={('deep-sky',m.key('M87')):{'galaxy'},('blackhole',m.key('M87*')):{'nucleus'},('star',m.key('Alpha Cen')):{'a','b'}}
assert not m.match(['M87'],['blackhole'],lookup)
assert not m.match(['Alpha Cen'],['star'],lookup)
assert set(m.match(['M87*'],['blackhole'],lookup))=={'nucleus'}
assert m.name_keys('Ophiuchus Cluster','galaxy-cluster') & m.name_keys('Ophiuchus','galaxy-cluster')
assert m.name_keys('Ophiuchus Cluster','star') != m.name_keys('Ophiuchus','star')
info={'url':'https://upload.wikimedia.org/wikipedia/commons/5/54/The_Local_Void.gif','descriptionurl':'https://commons.wikimedia.org/wiki/File:The_Local_Void.gif','width':800,'height':750,'extmetadata':{'Artist':{'value':'Richard Powell'},'LicenseShortName':{'value':'CC BY-SA 2.5'}}}
a=m.image_record({'pageimage':'The_Local_Void.gif','title':'Local Void','family':'void'},info)
b=m.image_record({'pageimage':'The Local Void.gif','title':'Map','family':'void'},info)
assert a['id']==b['id'], 'one Commons file cannot acquire two identities through spaces and underscores'
info['extmetadata']['ImageDescription']={'value':'Hubble photograph of Proxima Centauri in the constellation of Centaurus, captured in the visible spectrum.'}
assert m.image_record({'pageimage':'Proxima Centauri.jpg','title':'Proxima Centauri','family':'star'},info)['mediaType']=='observation', 'a photograph does not become a locator map because the caption names a constellation'
class Categories:
 def category(self,title):
  return [{'ns':14,'title':'Category:Milky Way Subgroup'},{'ns':0,'title':'Local Group'}] if title=='Local Group' else [{'ns':0,'title':'A satellite'},{'ns':14,'title':'Category:Milky Way'}]
assert m.subgroup_articles(Categories())=={'Milky Way':{'deep-sky'},'A satellite':{'deep-sky'}}, 'subgroup members and their main category topics must be discovered alongside direct category members'
`]);
const paths=['dist/wikipedia-index.js',...Object.values(index.files).map(e=>'dist/'+e.url.split('?')[0]),'data-tools/sky-sources/wikipedia-audit.json'];
const before=paths.map(p=>fs.readFileSync(p));
execFileSync('python3',['data-tools/build-wikipedia-media.py']);
paths.forEach((p,i)=>assert.ok(before[i].equals(fs.readFileSync(p)),'deterministic offline build: '+p));
console.log('PASS Wikipedia: exact typed identities, attributed images, requested maps, links, restored cards, lazy loading, failure/retry, standalone and deterministic rebuild');
