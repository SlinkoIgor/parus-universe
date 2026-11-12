import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCatalogRegistry} from './data-tools/build-catalog-registry.mjs';

const {c,objects,rows,data} = await buildCatalogRegistry({check:true});
const registry = c.CatalogRegistry, entries = new Map(data.entries.map(e=>[e.id,e]));
const byId = new Map(objects.map(o=>[o.id,o]));
assert.equal(entries.size,data.entries.length);
assert.equal(data.total,byId.size);
assert.equal(vm.runInContext('ExtendedCatalog.total',c),byId.size,'search and library share the complete source census, including added quasars');
for (const o of objects) {
  const memberships = registry.memberships(o);
  assert.ok(memberships.length,'uncovered object: '+o.id);
  for (const id of memberships) assert.ok(entries.has(id),'unregistered source '+id+': '+o.id);
}
// Every primary imported source is accounted for, even when its distance URL
// refers to a host compilation, or an identity was promoted into the core.
for (const row of rows) {
  const o = byId.get(row[0]);
  if (!o) continue;
  const expected = row[10]==='GalaxyDisks' ? registry.key(registry.primary(o)) : registry.key(row[10]);
  assert.ok(registry.matches(o,expected),row[0]+' lost its original '+row[10]+' source');
}
for (const [source,ids] of Object.entries({
  blackholes:['sgr','cygnus','bh-m87','bh-andromeda'],
  'nuclear-stars':['s2','s29'],
  'mcxc-ii':['virgo','coma'],
  'jades-dr4':['jades-z14'],
  simbad:['trappist'],
  literature:['quipu','boss-wall'],
})) for (const id of ids) assert.ok(registry.matches(byId.get(id),source),id+' / '+source);
assert.equal(entries.get('nearby').total,869,'all UNGC identities, without unrelated CF4 members');
assert.equal(entries.get('opengc').total,13969,'OpenNGC destinations: both M16 components share one reviewed complex');
assert.equal(entries.get('phat-ap').total,2753,'atlas-only PHAT clusters are in the same census');
assert.equal(entries.get('phat-ap').mapped,0,'unknown depths remain unknown');
for (const id of ['bh-andromeda','bh-m87']) {
  assert.ok(!registry.matches(byId.get(id),'nearby'),'black hole cannot inherit its host catalogue');
  assert.ok(!registry.matches(byId.get(id),'opengc'),'black hole cannot inherit its host designation');
}
assert.ok(!registry.matches({id:'host-distance-pulsar',kind:'pulsar',catalog:'ATNF',distanceHost:'gc-ter5',
  source:'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/parameter.html'},'globularmodels'));
assert.deepEqual([...registry.memberships({id:'arrival-star:test:1',kind:'star',synthetic:true,parentGalaxy:'andromeda'})],['game']);
assert.equal(registry.key('Future survey 2030'),'future-survey-2030');
assert.ok(registry.matches({id:'future-object',catalog:'Future survey 2030'},'future-survey-2030'),'new named sources need no predicate or UI list');

// The library and filter options are views of exactly the same discovered entries.
const html = registry.libraryHTML();
const listed = [...html.matchAll(/data-catalog-source="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(listed,data.entries.map(e=>e.id));
assert.deepEqual(Object.keys(registry.filters).filter(id=>id!=='all'),listed);
assert.ok(html.includes('на карте: 0'),'atlas-only sources retain their coverage limits');
vm.runInContext("ExtendedCatalog.pinned.set('arrival-star:registry-check:1',{id:'arrival-star:registry-check:1',kind:'star',synthetic:true})",c);
assert.equal(registry.stats(entries.get('game')).total,1,'expedition sources are counted dynamically');
assert.equal(registry.total,data.total+1,'the library heading includes the current expedition');
vm.runInContext("ExtendedCatalog.pinned.delete('arrival-star:registry-check:1')",c);

const census = new Map(data.entries.map(e=>[e.id,{total:0,mapped:0}]));
for (const o of objects) for (const id of registry.memberships(o)) {
  census.get(id).total++;
  if (o.cosmicEpoch || !o.atlasOnly&&!c.MapGeometry.unlocated(o)) census.get(id).mapped++;
}
for (const e of data.entries) {
  assert.deepEqual(census.get(e.id),{total:e.total,mapped:e.mapped},e.id);
  const expected = e.id === 'game' || objects.some(o=>registry.matches(o,e.id) &&
    o.kind !== 'void' && !(o.cosmicCatalog && !o.cosmicLandmark && o.cosmicSubtype === 'supercluster'));
  assert.equal(e.defaultSelected,expected,'default source selection derives from actual records: '+e.id);
}
assert.deepEqual(data.entries.filter(e=>!e.defaultSelected).map(e=>e.id).sort(),['sdss-superclusters','sdss-voids']);
assert.ok(entries.get('phat-ap').defaultSelected,'atlas-only source stays enabled despite having no mapped rows');
vm.runInContext(['sky-guide-data','sky-photos-index','sky-photos','sky-imaging-index','sky-imaging','sky-guide','map-filter-data','map-filters'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const filterData = vm.runInContext('MAP_FILTER_DATA',c);
const coreIds = new Set(vm.runInContext('OBJECTS.map(o=>o.id)',c));
const photoMask=1<<filterData.collections.indexOf('photos');
const expectedPhotoIds=objects.filter(o=>!coreIds.has(o.id)&&!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&c.SkyGuide.hasObservatoryPhoto(o)).map(o=>o.id).sort();
const photoBuckets=filterData.buckets.filter(b=>b[1]&photoMask);
const allPhotoIds=objects.filter(o=>!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&!c.MapFilters.anchor(o)&&c.SkyGuide.hasObservatoryPhoto(o)).map(o=>o.id).sort();
assert.deepEqual([...filterData.photoIds],allPhotoIds,'the exact full photo domain is independent of viewport tiles and display density');
assert.equal(photoBuckets.reduce((n,b)=>n+b[3],0),expectedPhotoIds.length);
// Audit promotion against the full decoded catalogue, independently of the
// bucket/reference selection used by the browser. Every small class survives
// the addition of thousands of galaxy photographs.
const photoClassCounts=new Map();
for(const id of allPhotoIds){const kind=c.MapFilters.classOf(byId.get(id));photoClassCounts.set(kind,(photoClassCounts.get(kind)||0)+1);}
const smallPhotoClasses=new Set([...photoClassCounts].filter(([,n])=>n<=c.MapFilters.limit).map(([k])=>k));
const completePhotoDetails=allPhotoIds.filter(id=>smallPhotoClasses.has(c.MapFilters.classOf(byId.get(id))));
assert.ok(completePhotoDetails.length<=c.MapFilters.collectionLimits.photos);
c.MapFilters.activeGroup='collections';c.MapFilters.selection={collections:['photos']};c.MapFilters.refreshSelection();
assert.equal(c.MapFilters.narrow,false,'bulk galaxies retain normal spatial loading');
assert.deepEqual([...c.MapFilters.promoted].sort(),completePhotoDetails,'every photographic object of every small class has a complete original reference');
for(const id of ['sgr','bh-m87','gaia-bh3','betelgeuse','orion','crab'])assert.ok(c.MapFilters.promoted.has(id),id);
console.log('PASS complete photographic classes: '+JSON.stringify({promoted:completePhotoDetails.length,classes:Object.fromEntries(photoClassCounts)}));
const sgaFrozen=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-sga.json'));
const realImagingHas=c.SkyImaging.has;
c.SkyImaging.has=()=>false;
const oldPhotoIds=objects.filter(o=>!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&!c.MapFilters.anchor(o)&&c.SkyGuide.hasObservatoryPhoto(o)).map(o=>o.id);
c.SkyImaging.has=realImagingHas;
assert.ok(oldPhotoIds.every(id=>filterData.photoIds.includes(id)),'all previously photographed objects remain in the collection');
const oldPhotoSet=new Set(oldPhotoIds),overlap=sgaFrozen.records.filter(p=>oldPhotoSet.has(p.targetId)).length;
assert.equal(allPhotoIds.length,oldPhotoIds.length+sgaFrozen.records.length-overlap,'distinct objects, not a sum of overlapping photographs');
console.log('PASS photo object census: '+JSON.stringify({before:oldPhotoIds.length,sga:sgaFrozen.records.length,overlap,added:allPhotoIds.length-oldPhotoIds.length,total:allPhotoIds.length}));
for(const p of sgaFrozen.records){
 const o=byId.get(p.targetId);assert.ok(o&&!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&o.kind==='galaxy',p.targetId);
 const ownPGC=new Set((o.aliases||[]).flatMap(n=>{const m=/^PGC\s*0*(\d+)$/i.exec(n);return m?[Number(m[1])]:[];}));
 if(p.method==='exact own PGC')assert.deepEqual([...ownPGC],[p.pgc],'photo uses the current object own PGC, never its host: '+o.id);
 else assert.equal(String(o.ngc).replace(/^(NGC|IC)0*(\d+)$/i,(_,prefix,n)=>prefix.toUpperCase()+Number(n)),p.galaxy.replace(/^(NGC|IC)0*(\d+)$/i,(_,prefix,n)=>prefix.toUpperCase()+Number(n)));
 const rad=Math.PI/180,delta=2*Math.asin(Math.min(1,Math.sqrt(Math.sin((o.decDeg-p.decDeg)*rad/2)**2+Math.cos(o.decDeg*rad)*Math.cos(p.decDeg*rad)*Math.sin((o.raDeg-p.raDeg)*rad/2)**2)))/rad*3600;
 assert.ok(delta<=p.toleranceArcsec+1e-8,'same named galaxy also agrees in sky direction: '+o.id);
 assert.ok(Math.abs(delta-p.separationArcsec)<1e-6,'stored angular match evidence: '+o.id);
}
for (const e of data.entries) {
  const expected = objects.filter(o=>!coreIds.has(o.id)&&!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&registry.matches(o,e.id)).length;
  const actual = filterData.buckets.filter(b=>b[2].includes(e.id)).reduce((n,b)=>n+b[3],0);
  assert.equal(actual,expected,'complete streamed filter count for '+e.id);
}
// Audit default visibility against every original mapped record, independent of
// the shared predicate used to generate flags. The default is a map policy;
// source census/library counts continue to describe the complete catalogues.
assert.equal(filterData.version,3);
const expectedDefault=objects.filter(o=>!coreIds.has(o.id)&&!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&
 o.kind!=='void'&&!(o.cosmicCatalog&&!o.cosmicLandmark&&o.cosmicSubtype==='supercluster')).length;
const indexedDefault=filterData.buckets.filter(b=>!b[5]).reduce((n,b)=>n+b[3],0);
assert.equal(indexedDefault,expectedDefault,'all default-hidden records are classified correctly in the selection index');
for(const b of filterData.buckets) {
  assert.equal(typeof b[5],'boolean','every bucket declares its default visibility');
  if (!b[5]) assert.ok(b[2].some(id=>entries.get(id).defaultSelected),'default sources cover every ordinarily visible bucket');
}
assert.equal(filterData.buckets.filter(b=>!b[5]&&b[2].some(id=>entries.get(id).defaultSelected)).reduce((n,b)=>n+b[3],0),expectedDefault,'explicit defaults preserve the ordinary overview count');
c.MapFilters.activeGroup = 'catalogs';
c.MapFilters.selection = {classes:['star'],collections:[],catalogs:['future-source-64']};
assert.ok(c.MapFilters.bucketMatches(['star',0,['future-source-64'],1,[]]),'sources past the 32-bit boundary stay distinct');
assert.ok(!c.MapFilters.bucketMatches(['star',0,['future-source-32'],1,[]]),'source membership cannot wrap at bit 32');
console.log('PASS generated source census is reproducible and complete for '+objects.length+' records / '+entries.size+' groups; own provenance, atlas-only coverage and shared library/filter lists');
