import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {buildCatalogRegistry} from './data-tools/build-catalog-registry.mjs';

const policy=JSON.parse(fs.readFileSync('data-tools/deep-sky-identities.json'));
// Review the whole source class, including atlas-only nebulae. Shared names
// reveal candidates, never permission to merge separate physical regions.
const repeated=JSON.parse(execFileSync('python3',['-c',`
import csv,json,collections
groups=collections.defaultdict(list)
types={'Neb','HII','Cl+N','PN','SNR','RfN','EmN'}
for row in csv.DictReader(open('data-tools/raw/NGC.csv'),delimiter=';'):
 if row['Type'] not in types:continue
 for name in row['Common names'].split(','):
  if name:groups[name.casefold()].append('opengc-'+row['Name'].lower())
print(json.dumps({k:v for k,v in groups.items() if len(v)>1}))
`],{encoding:'utf8'}));
for(const [name,ids] of Object.entries(repeated))assert.ok([...policy.groups,...policy.distinct].some(g=>ids.every(id=>g.members.includes(id))),'unreviewed repeated nebula name: '+name);
assert.deepEqual(Object.keys(repeated).sort(),['eagle nebula','eastern veil','network nebula']);

const {c,objects,data}=await buildCatalogRegistry({check:true});
const group=policy.groups[0],source=JSON.parse(/const IMPORTED_CATALOG=(.*);\s*$/s.exec(fs.readFileSync('dist/catalog-import.js','utf8'))[1]);
assert.deepEqual(source.identityPolicy,policy,'offline builder and curator embed the reviewed source policy');
const target=objects.find(o=>o.id===group.target),removed=group.members.find(id=>id!==target.id);
assert.ok(target);
assert.equal(objects.filter(o=>o.kind==='nebula'&&o.aliases?.includes('Eagle Nebula')).length,1);
assert.equal(objects.some(o=>o.id===removed),false);
assert.equal(target.kind,'nebula');assert.equal(target.type,group.type);
assert.deepEqual(JSON.parse(JSON.stringify(target.catalogComponents)),group.members.map(id=>source.objects.find(o=>o.id===id)),'preserve all original component measurements, sources, units and unknown values');
for(const field of ['d','raDeg','decDeg','diameterLy','angularMajorArcmin','angularMinorArcmin'])assert.equal(target[field],source.objects.find(o=>o.id===target.id)[field],'keep canonical physical estimate: '+field);
for(const name of ['IC4703','NGC6611','M 16','Star Queen','Eagle Nebula'])assert.ok(target.aliases.includes(name),name);
const veil=objects.filter(o=>['opengc-ngc6992','opengc-ngc6995'].includes(o.id));
assert.equal(veil.length,2);assert.notEqual(veil[0].name,veil[1].name);
const reflection=objects.filter(o=>['opengc-ngc6726','opengc-ngc6727'].includes(o.id));
assert.equal(reflection.length,2,'shared IRAS field is not an identity');
console.log('PASS all repeated source nebula names reviewed; one M16 complex; distinct Veil and reflection nebula regions preserved; full component provenance');

const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#nebula-identities');
context.rawMembers=source.objects.filter(o=>group.members.includes(o.id));
for(const [publisher,entry]of Object.entries(run('SKY_PHOTO_INDEX.files'))){
 context.photoPublisher=publisher;context.photoData=JSON.parse(fs.readFileSync('dist/'+entry.url.split('?')[0])).photos;
 run('SkyPhotos.cache.set(photoPublisher,photoData)');
}
run(`{
 const canonical=object('opengc-ngc6611'),oldId='opengc-ic4703';
 assert.equal(MapDetails.typeName(canonical),'Туманность и звёздное скопление');
 assert.equal(ExtendedCatalog.get(oldId),canonical);
 const originalMedia=rawMembers.flatMap(o=>SkyGuide.media(o));
 const expected=new Map(originalMedia.map(p=>[p.url,p])),merged=SkyGuide.media(canonical);
 assert.ok(merged.length>=41,'all 41 original frames survive alongside later archive additions');
 assert.equal(merged.length,expected.size,'canonical gallery retains the unique union of component photographs');
 assert.equal(new Set(merged.map(p=>p.url)).size,merged.length,'no repeated image URLs');
 for(const [url,p]of expected){const actual=merged.find(q=>q.url===url);assert.ok(actual,'lost frame '+p.id);assert.equal(actual.source,p.source);assert.equal(actual.credit,p.credit);assert.equal(actual.rights,p.rights);}
 for(const id of ['hubble-heic1501a','nasa-messier-16'])assert.ok(merged.some(p=>p.id===id),'curated photo of either former record: '+id);
 assert.ok(SkyGuide.hasObservatoryPhoto(canonical));
 assert.equal(MAP_FILTER_DATA.photoIds.includes(oldId),false);assert.ok(MAP_FILTER_DATA.photoIds.includes(canonical.id));
 for(const mode of ['full','radial']){
  state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=1000;MapSlice.setMode(mode);const p=MapLayout.project(canonical);cam={x:p.x,y:p.y,span:800};
  MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
  const targets=[...new Set([...hitObjects,...RegionMap.hits].filter(h=>[oldId,canonical.id].includes(h.o.id)).map(h=>h.o.id))];
  assert.deepEqual(targets,[canonical.id],'one clickable M16 on the '+mode+' map');
 }
 MapSlice.setMode('full');
 // Ordinary old selection migrates, including old core saves without records.
 state=initial();state.selected=oldId;state.visited.push(oldId);state=restore(JSON.parse(JSON.stringify(state)));
 assert.equal(state.selected,canonical.id);assert.equal(object(oldId),canonical);
 assert.ok(state.visited.includes(canonical.id));assert.equal(state.visited.includes(oldId),false,'exploration progress follows the canonical destination');
 const raw=rawMembers.find(o=>o.id===oldId),old={...raw,...Space.point(Space.fromSky(raw.raDeg,raw.decDeg,raw.d)),navigable:true,mapGeometry:MapLayout.version};
 old.mapPosition=MapLayout.place(old);old.mapOffset=[0,0];
 for(const withRecord of [false,true]){
  ExtendedCatalog.pinned.clear();state=initial();state.current=oldId;state.selected=oldId;state.ship=Space.point(old.p3);state.catalogObjects=withRecord?[{...old}]:[];
  const ship=JSON.stringify(state.ship);state=restore(JSON.parse(JSON.stringify(state)));
  assert.equal(JSON.stringify(state.ship),ship,'parked old core position survives');
  assert.ok(object(oldId).historicalNavigation);assert.equal(ExtendedCatalog.matchesMap(object(oldId)),false);
  assert.deepEqual(SkyGuide.media(object(oldId)).map(p=>p.url),merged.map(p=>p.url),'historical card retains whole gallery');
  $('catalog').hidden=false;$('search').value='Eagle Nebula';searchFilter='all';renderCatalog();
  assert.ok($('catalogCount').textContent.startsWith('1 /'),'private old navigation must not appear in search');
 }
 ExtendedCatalog.pinned.clear();state=initial();ExtendedCatalog.pin({...old,supersededBy:canonical.id,historicalNavigation:true});state.selected=oldId;launch(true);paused=true;assert.ok(state.flight);
 const frozen=JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]);
 const saved=JSON.parse(JSON.stringify(state));saved.catalogObjects=[];state=restore(saved);
 assert.equal(JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]),frozen,'active old core plan and fuel remain exact without a saved core record');
 for(const field of ['flightHistory','itinerary','nextTargets']){
  ExtendedCatalog.pinned.clear();state=initial();state[field]=field==='flightHistory'?[{fromId:oldId,target:'alpha'}]:[{id:oldId}];
  ExtendedCatalog.restore(state);assert.ok(object(oldId).historicalNavigation,'preserved old endpoint referenced by '+field);assert.equal(ExtendedCatalog.matchesMap(object(oldId)),false);
 }
 ExtendedCatalog.pinned.clear();state=initial();state.flight={fromId:'sol',target:'alpha',requestedTarget:oldId};
 ExtendedCatalog.restore(state);assert.ok(object(oldId).historicalNavigation,'old flights without a route retain their requested nebula independently of the actual stopping star');
 ExtendedCatalog.pinned.clear();
}`);
assert.equal(data.entries.find(e=>e.id==='opengc').total,13969);
console.log('PASS merged gallery retains all original and added frames with credits/rights; one photo-filter/search result; ordinary/parked/active/queued historical saves retain coordinates, clocks, fuel and photos');
