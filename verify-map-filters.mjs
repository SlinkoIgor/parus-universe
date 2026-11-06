import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#map-filters');
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
MapFilters.change('all','naked-eye','atnf');assert.ok(OBJECTS.every(o=>!ExtendedCatalog.matchesMap(o,true)),'incompatible conditions intersect, never expand the selection');
MapFilters.change('__proto__','constructor',null);assert.equal(MapFilters.key,'all|all|all');
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
`);
