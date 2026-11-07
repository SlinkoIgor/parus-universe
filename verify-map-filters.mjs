import './verify-map-collections.mjs';
import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#map-filters');
// These catalogues are ordinary browser scripts, outside the harness's data-app list.
run(['distant-catalog-data','distant-catalog'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
context.savedPreferences = new Map();
context.localStorage = {
  getItem: key => context.savedPreferences.get(key) ?? null,
  setItem: (key, value) => context.savedPreferences.set(key, value),
};
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
MapLayers.active=false;MapSlice.mode='full';width=1440;height=1000;cam={x:0,y:0,span:24};
const physical=JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]);
const draw=()=>{hitObjects=[];MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();return hitObjects.map(h=>h.o.id).sort().join('|');};
MapFilters.change('all','all','all');const initialHits=draw();
for(const kind of MapFilters.classes){
 searchFilter=kind;assert.equal(draw(),initialHits,'search class cannot change map points or labels: '+kind);
 assert.equal(filter,'all');
}
searchFilter='galaxy';$('catalog').hidden=false;$('search').value='';renderCatalog();
const rows=$('catalogList').children.filter(e=>e.className==='catalog-item');
assert.ok(rows.length>5);assert.ok(rows.every(e=>OBJECTS.some(o=>o.name===e.children[0].children[0].textContent&&o.kind==='galaxy')),'search class selects only galaxies');
MapFilters.change('pulsar','all','all');assert.equal(searchFilter,'galaxy','map class leaves search unchanged');
const searchRows=JSON.stringify(rows.map(e=>e.children[0].children[0].textContent));renderCatalog();
assert.equal(JSON.stringify($('catalogList').children.filter(e=>e.className==='catalog-item').map(e=>e.children[0].children[0].textContent)),searchRows);
console.log('PASS independent map/search classes and real atlas row rendering');
MapFilters.change('all','naked-eye','all');
assert.ok(ExtendedCatalog.matchesMap(object('sirius')));assert.ok(ExtendedCatalog.matchesMap(object('alpha')));
assert.ok(!ExtendedCatalog.matchesMap(object('proxima')));assert.ok(!ExtendedCatalog.matchesMap(object('andromeda')));
for(const v of [null,undefined,NaN,Infinity,'0',6.01])assert.ok(!MapFilters.matches({...object('sirius'),apparentV:v}),'unknown or faint magnitude cannot pass');
assert.ok(MapFilters.matches({...object('sirius'),apparentV:6}));assert.ok(!MapFilters.matches({...object('sirius'),unresolvedSourcePhotometry:true}));
MapFilters.change('all','messier','all');
for(const id of ['andromeda','triangulum','orion','opengc-ngc1952','opengc-ngc6205'])assert.ok(MapFilters.matches(object(id)),id);
for(const id of ['bh-m87','bh-andromeda','crab','sirius'])assert.ok(!MapFilters.matches(object(id)),'distinct identity is not a Messier object: '+id);
const m2=ExtendedCatalog.decode(['opengc-ngc7089','M2','cluster',55000,323.36,-.82,'catalog','published',['M2'],6.3,'OpenNGC',{messier:'002',catalogClass:'stellar-cluster'},1,2]);
assert.ok(MapFilters.matches(m2),'streamed catalogue record has the same Messier selection');
MapFilters.change('all','nearby','all');
for(const id of ['sol','alpha','proxima','sirius'])assert.ok(MapFilters.matches(object(id)));
assert.ok(!MapFilters.matches(object('betelgeuse')));assert.ok(MapFilters.matches({...object('alpha'),d:25}));assert.ok(!MapFilters.matches({...object('alpha'),d:25.01}));assert.ok(!MapFilters.matches({...object('alpha'),d:null}));
assert.ok(!MapFilters.matches({...object('alpha'),d:1,synthetic:true}));
MapFilters.change('all','multiple','all');
assert.ok(MapFilters.matches(object('sirius')));assert.ok(MapFilters.matches(object('alpha')));assert.ok(!MapFilters.matches(object('barnard')));
MapFilters.change('all','remnants','all');
for(const id of ['crab','sgr','hyg-118441','hyg-118493','hyg-118527'])assert.ok(MapFilters.matches(object(id)),id);
for(const id of ['sirius','procyon'])assert.ok(!MapFilters.matches(object(id)),'system facts mentioning a white-dwarf companion cannot classify its primary as a remnant');
console.log('PASS educational selections, actual brightness/unknown values, Messier identities and streamed records');
for(const [catalog,yes,no] of [['hyg','sirius','andromeda'],['opengc','andromeda','sirius'],['atnf','crab','sirius'],['nearby','andromeda','sirius'],['cf4','andromeda','sirius'],['blackholes','bh-m87','m87']]){
 MapFilters.change('all','all',catalog);assert.ok(MapFilters.matches(object(yes)),catalog);assert.ok(!MapFilters.matches(object(no)),catalog);
}
MapFilters.change('galaxy','messier','cf4');
assert.ok(ExtendedCatalog.matchesMap(object('andromeda'),true));assert.ok(!ExtendedCatalog.matchesMap(object('sirius'),true));
assert.equal(MapFilters.count,3);assert.equal($('mapFilterCount').textContent,3);
assert.equal(MapFilters.allowsCategory('nebula'),false);assert.equal(MapFilters.allowsCategory('galaxy'),true);
MapFilters.change('all','naked-eye','atnf');assert.ok(OBJECTS.every(o=>MapFilters.anchor(o)||!ExtendedCatalog.matchesMap(o,true)),'incompatible conditions leave only permanent anchors');
MapFilters.change('__proto__','constructor',null);assert.ok(!MapFilters.values('classes').includes('void'));
MapFilters.change('star','nearby','hyg');MapFilters.setup();assert.equal(MapFilters.key,'star|nearby|hyg','separate preference survives setup/reload');
assert.equal(JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]),physical,'filters cannot alter coordinates, catalogue values, expedition, clocks or fuel');
MapFilters.change('all','all','all');searchFilter='all';assert.equal(draw(),initialHits,'reset restores original map');
console.log('PASS sourced catalogue selection, intersecting conditions, reset, invalid preferences and separate persistence without changing flight data');
for(const mode of ['full','radial','slice']){
 MapSlice.mode=mode;MapFilters.change('all','all','all');
 for(const c of Object.keys(MapFilters.collections)){
  MapFilters.change('all',c,'all');draw();
  assert.ok(hitObjects.every(h=>MapFilters.matches(h.o)),'foreground/background hit filter: '+mode+' '+c);
  assert.ok(RegionMap.hits.every(h=>MapFilters.matches(h.o)),'contour filter: '+mode+' '+c);
 }
}
MapSlice.mode='full';MapFilters.change('all','all','all');
console.log('PASS map points, hit targets, background and cached contours obey all selections across three map modes');

MapFilters.change(['star','galaxy'],['naked-eye','messier'],['hyg','opengc']);
for(const id of ['sirius','andromeda']) assert.ok(ExtendedCatalog.matchesMap(object(id),true),'OR within each tab: '+id);
assert.ok(!ExtendedCatalog.matchesMap(object('orion'),true),'class restrictions still intersect collection unions');
for(const group of ['classes','collections','catalogs']) {
 MapFilters.change('all','all','all');MapFilters.setGroup(group,[]);
 if(group==='classes')assert.ok(OBJECTS.every(o=>MapFilters.anchor(o)||!ExtendedCatalog.matchesMap(o,true)),'empty classes leave only anchors');
 else assert.equal(draw(),initialHits,'empty optional facet clears its restriction: '+group);
 for(const id of ['sol','milkyway']) assert.ok(ExtendedCatalog.matchesMap(object(id),true),'persistent anchor: '+id);
 assert.ok(MapFilters.matches({id:'planet-test',kind:'planet'}));
 MapFilters.setGroup(group,MapFilters.options(group));
 if(group==='classes')assert.equal(MapFilters.key,'all|all|all');
 else {
  const predicate=group==='collections'?'matchesCollection':'matchesCatalog';
  assert.ok(!MapFilters.unrestricted(group),'every selected value still applies its actual membership');
  const outside=OBJECTS.find(o=>!MapFilters.anchor(o)&&MapFilters.classOf(o)&&!MapFilters.options(group).some(k=>MapFilters[predicate](o,k)));
  assert.ok(outside);assert.ok(!MapFilters.matches(outside),'selecting the last facet never admits unrelated records');
  const full=MapFilters.options(group);MapFilters.setGroup(group,full.slice(0,-1));const before=OBJECTS.filter(o=>MapFilters.matches(o));
  MapFilters.setGroup(group,full);assert.ok(before.every(o=>MapFilters.matches(o)),'adding a value only expands its union');
 }
}
MapFilters.change(['star','galaxy'],['nearby','messier'],['hyg','opengc']);const multiKey=MapFilters.key;
MapFilters.setup();assert.equal(MapFilters.key,multiKey,'multiple values survive reload');
MapFilters.open();assert.equal(MapFilters.tab,'classes','first tab opens by default');
MapFilters.setTab('catalogs');MapFilters.open();assert.equal(MapFilters.tab,'classes');
MapFilters.change(MapFilters.defaults('classes'),'all','all');
assert.ok(!MapFilters.values('classes').includes('void'));
assert.ok(OBJECTS.filter(o=>o.kind==='void').every(o=>!ExtendedCatalog.matchesMap(o,true)),'all void populations are off by default');
assert.equal($('mapFilterAll').checked,false);assert.equal($('mapFilterAll').indeterminate,true,'master reflects partial class selection');
$('mapFilterAll').checked=true;$('mapFilterAll').onchange();assert.ok(MapFilters.all('classes'));assert.equal($('mapFilterAll').indeterminate,false);
$('mapFilterAll').checked=false;$('mapFilterAll').onchange();assert.equal(MapFilters.values('classes').length,0);
MapFilters.change(MapFilters.defaults('classes'),[],[]);assert.ok(MapFilters.unrestricted('collections')&&MapFilters.unrestricted('catalogs'));
MapFilters.setGroup('collections',['messier']);assert.equal(MapFilters.values('collections').join(),'messier','one optional value immediately isolates the selection');
for(const group of ['collections','catalogs']) {
 MapFilters.setTab(group);MapFilters.setGroup(group,[MapFilters.options(group)[0]]);
 const otherKey=MapFilters.values('classes').join(),otherGroup=group==='collections'?'catalogs':'collections',otherValues=MapFilters.values(otherGroup).join();
 assert.equal($('mapFilterAll').checked,false);assert.equal($('mapFilterAll').indeterminate,true);
 $('mapFilterAll').checked=true;$('mapFilterAll').onchange();assert.ok(MapFilters.all(group));assert.equal($('mapFilterAll').indeterminate,false);
 $('mapFilterAll').checked=false;$('mapFilterAll').onchange();assert.equal(MapFilters.values(group).length,0);assert.ok(MapFilters.unrestricted(group));
 assert.equal(MapFilters.values('classes').join(),otherKey);assert.equal(MapFilters.values(otherGroup).join(),otherValues,'master only changes the active tab');
}
console.log('PASS native three-state master in every tab, optional facet defaults, unions including all selected values and independent v3 preferences');
`);

context.savedPreferences.delete('parus-map-filters-v3');
context.savedPreferences.set('parus-map-filters-v2',JSON.stringify({classes:['star'],collections:['naked-eye','messier','nearby','multiple','remnants'],catalogs:[]}));
run(`MapFilters.setup();assert.equal(MapFilters.values('collections').length,0,'old five-value v2 unrestricted set stays unrestricted after adding collections');`);
context.savedPreferences.set('parus-map-filters-v2',run(`JSON.stringify({classes:MapFilters.defaults('classes'),collections:MapFilters.options('collections'),catalogs:MapFilters.options('catalogs')})`));
run(`MapFilters.setup();assert.equal(MapFilters.values('collections').length,0);assert.equal(MapFilters.values('catalogs').length,0);assert.ok(!MapFilters.values('classes').includes('void'));`);
context.savedPreferences.set('parus-map-filters-v2',JSON.stringify({classes:['star','galaxy'],collections:['nearby','messier'],catalogs:['hyg','opengc']}));
run(`MapFilters.setup();assert.equal(MapFilters.key,'star,galaxy|messier,nearby|hyg,opengc');console.log('PASS v2 migration preserves active subsets and converts formerly unrestricted full selections to empty optional facets');`);

// Test real small-selection references independently of current map tiles.
context.readFilterJSON = file => JSON.parse(fs.readFileSync('dist/'+file.replace(/^catalog-data\//,'catalog-data/'+JSON.parse(fs.readFileSync('dist/catalog-data/current.json','utf8')).revision+'/'),'utf8'));
context.fetch = () => { throw Error('unexpected network access'); };
run(fs.readFileSync('dist/map-visibility-data.js','utf8')+'\n'+fs.readFileSync('dist/map-visibility.js','utf8'));
await run(`(async()=>{
ExtendedCatalog.readJSON=async file=>readFilterJSON(file);
const pins=JSON.stringify([...ExtendedCatalog.pinned.keys()]),physical=JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]);
MapFilters.change('all','messier','all');await MapFilters.pending;
assert.ok(MapFilters.narrow&&MapFilters.total>80&&MapFilters.total<=110);
assert.ok(MapFilters.objects.has('opengc-ngc7089'),'M2 loads even outside the camera coverage');
assert.equal(MapFilters.objects.size,MAP_FILTER_DATA.buckets.filter(b=>MapFilters.bucketMatches(b)).reduce((n,b)=>n+b[3],0),'all referenced records load');
for(const o of MapFilters.objects.values())assert.equal(o,ExtendedCatalog.coreIndex.get(o.id)||o,'canonical host identity is preserved');
for(const mode of ['full','radial','slice']) {
 MapSlice.mode=mode;
 for(const span of [24,130000,7e6,1e8,1.15e11]) {
  cam={x:0,y:0,span};MapDetails.beginFrame();
  for(const id of ['andromeda','opengc-ngc7089']) assert.equal(MapDetails.opacity(object(id),span),1,'small selection bypasses ordinary cutoff');
  hitObjects=[];MapLabels.begin();drawObjects();MapLabels.draw();
  assert.ok(hitObjects.every(h=>MapFilters.anchor(h.o)||MapFilters.matches(h.o)));
  for(let i=0;i<hitObjects.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(hitObjects[i].p.x-hitObjects[j].p.x,hitObjects[i].p.y-hitObjects[j].p.y)>=16,'filtered glyphs cannot overlap');
  MapDetails.endFrame();
 }
}
MapSlice.mode='full';MapFilters.change('all','nearby','all');await MapFilters.pending;
assert.ok(MapFilters.narrow);assert.ok(MapFilters.objects.size>0,'unloaded neighbouring stars are included');
for(const o of MapFilters.objects.values())assert.ok(MapDetails.mapLabelName(o),'catalogue neighbours get names too');
MapFilters.change('all','naked-eye','all');assert.ok(!MapFilters.narrow,'large sample keeps ordinary density hierarchy');
cam={x:0,y:0,span:130000};hitObjects=[];MapLabels.begin();drawObjects();
assert.equal(hitObjects.filter(h=>['home','star'].includes(h.o.kind)).length,1,'galactic scale has one stellar icon');
MapFilters.change('all','messier','all');const obsolete=MapFilters.pending;MapFilters.change('all','nearby','all');await Promise.all([obsolete,MapFilters.pending]);
assert.ok([...MapFilters.objects.values()].every(o=>MapFilters.matchesCollection(o,'nearby')),'stale load cannot pollute the new selection');
MapFilters.change('all','galileo','all');await MapFilters.pending;
assert.equal(MapFilters.total,2);assert.ok(MapFilters.narrow);
assert.ok(MapFilters.objects.has('messier-45'),'Pleiades load from their actual catalogue tile');
assert.ok(MapFilters.matches(object('opengc-ngc2632')),'Praesepe and Pleiades form the same selection');
for(const collection of ['pre-telescope','messier-discoveries','before-herschel','brightest-stars','planetary-nebulae','supernova-remnants','globular-clusters']) {
 MapFilters.change('all',collection,'all');await MapFilters.pending;
 assert.ok(MapFilters.total>0&&MapFilters.narrow,'complete new small selection: '+collection);
 assert.equal(MapFilters.objects.size,MAP_FILTER_DATA.buckets.filter(b=>MapFilters.bucketMatches(b)).reduce((n,b)=>n+b[3],0),'all new streamed members load: '+collection);
 assert.ok([...MapFilters.objects.values()].every(o=>MapFilters.matchesCollection(o,collection)));
}
assert.equal(JSON.stringify([...ExtendedCatalog.pinned.keys()]),pins,'filter references never pin expedition objects');
assert.equal(JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]),physical,'complete selection loading preserves physical catalogue and flight');
console.log('PASS complete streamed selections, every scale/projection, glyph collisions, neighbour names, one galactic stellar icon and stale-load protection without expedition changes');
})()`);
