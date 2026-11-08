import './verify-map-collections.mjs';
import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0].replace('setAttribute(){}','setAttribute(k,v){(this.attributes ||= {})[k]=v}getAttribute(k){return this.attributes?.[k]}') + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#map-filters');
// These catalogues are ordinary browser scripts, outside the harness's data-app list.
run(['distant-catalog-data','distant-catalog'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
context.savedPreferences = new Map();
context.localStorage = {
  getItem: key => context.savedPreferences.get(key) ?? null,
  setItem: (key, value) => context.savedPreferences.set(key, value),
};
run(`
const queryAll=document.querySelectorAll;
document.querySelectorAll=selector=>selector==='#mapFilters input[data-filter-group]' ? ['classes','collections','catalogs'].flatMap(g=>$('filterPanel-'+g).children.map(label=>label.children[0])) : queryAll(selector);
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
MapLayers.active=false;MapSlice.mode='full';width=1440;height=1000;cam={x:0,y:0,span:24};
const physical=JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]);
const draw=()=>{hitObjects=[];MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();return hitObjects.map(h=>h.o.id).sort().join('|');};
MapFilters.change(MapFilters.defaults('classes'),[],[]);const defaultHits=draw();
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
assert.equal(MapFilters.activeGroup,'collections');assert.equal(MapFilters.count,1);assert.equal($('mapFilterCount').textContent,1);
assert.equal(MapFilters.allowsCategory('nebula'),true);assert.equal(MapFilters.allowsCategory('galaxy'),true);
MapFilters.change('all','naked-eye','atnf');assert.ok(ExtendedCatalog.matchesMap(object('sirius'),true),'legacy combinations retain one collection without source intersections');
MapFilters.change('__proto__','constructor',null);assert.ok(!MapFilters.values('classes').includes('void'));
MapFilters.change('pulsar','all','invalid-source');assert.equal(MapFilters.activeGroup,'classes');assert.equal(MapFilters.values('classes').join(),'pulsar','invalid sources cannot activate catalogue defaults over an explicit class');
MapFilters.setGroup('catalogs',['hyg']);MapFilters.setup();assert.equal(MapFilters.key,'all|all|hyg','active source preference survives setup/reload');
assert.equal(JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]),physical,'filters cannot alter coordinates, catalogue values, expedition, clocks or fuel');
MapFilters.change('all','all','all');searchFilter='all';assert.equal(draw(),initialHits,'reset restores original map');
console.log('PASS sourced catalogue selection, exclusive modes, reset, invalid preferences and separate persistence without changing flight data');
const sourceCamera={...cam};
for(const mode of ['full','radial','slice'])for(const span of [24,130000,3e7,5e9,1.15e11]) {
 MapSlice.mode=mode;cam={x:0,y:0,span};MapFilters.change('all',[],[]);
 const points=draw(),areas=RegionMap.hits.map(h=>h.o.id).sort().join('|');
 MapFilters.setGroup('catalogs',MapFilters.options('catalogs'));
 assert.equal(draw(),points,'all sources equal no restriction: '+mode+' '+span);
 assert.equal(RegionMap.hits.map(h=>h.o.id).sort().join('|'),areas,'contours also agree: '+mode+' '+span);
}
cam=sourceCamera;MapFilters.change('all','all','all');
console.log('PASS full source union and unrestricted map agree at five scales in all projections');
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
assert.equal(MapFilters.values('collections').join(),'naked-eye','old collection unions keep only their first valid choice');
assert.ok(ExtendedCatalog.matchesMap(object('sirius'),true));
assert.ok(!ExtendedCatalog.matchesMap(object('andromeda'),true),'second collection is not silently combined');
MapFilters.setGroup('collections',[]);
for(const id of ['sirius','andromeda']) assert.ok(ExtendedCatalog.matchesMap(object(id),true),'clearing a collection removes every optional restriction: '+id);
for(const group of ['classes','collections','catalogs']) {
 MapFilters.change('all','all','all');MapFilters.setGroup(group,[]);
 if(group!=='collections')assert.ok(OBJECTS.every(o=>MapFilters.anchor(o)||!ExtendedCatalog.matchesMap(o,true)),'empty classes/catalogues leave only anchors: '+group);
 else assert.equal(draw(),defaultHits,'empty collection restores the ordinary overview');
 for(const id of ['sol','milkyway']) assert.ok(ExtendedCatalog.matchesMap(object(id),true),'persistent anchor: '+id);
 assert.ok(MapFilters.matches({id:'planet-test',kind:'planet'}));
 MapFilters.setGroup(group,MapFilters.options(group));
 if(group==='classes')assert.equal(MapFilters.key,'all|all|all');
 else if(group==='collections') assert.ok(MapFilters.unrestricted(group),'old complete collection set migrates to no selection');
 else {
  const predicate='matchesCatalog';
  assert.ok(MapFilters.unrestricted(group),'the complete source union is unrestricted');
  assert.ok(OBJECTS.every(o=>MapFilters.options(group).some(k=>MapFilters[predicate](o,k))), 'generated source union covers every core object');
  assert.equal(draw(),initialHits,'complete source union preserves the unrestricted map');
  const full=MapFilters.options(group);MapFilters.setGroup(group,full.slice(0,-1));const before=OBJECTS.filter(o=>MapFilters.matches(o));
  MapFilters.setGroup(group,full);assert.ok(before.every(o=>MapFilters.matches(o)),'adding a value only expands its union');
 }
}
MapFilters.change(['star','galaxy'],['nearby','messier'],['hyg','opengc']);const multiKey=MapFilters.key;
MapFilters.setup();assert.equal(MapFilters.key,multiKey,'active mode survives reload');
assert.equal(MapFilters.activeGroup,'collections');
MapFilters.open();assert.equal(MapFilters.tab,'collections','reopening preserves the active filter');
MapFilters.setTab('catalogs');MapFilters.open();assert.equal(MapFilters.tab,'catalogs');
assert.equal(MapFilters.values('collections').length,0,'switching tabs clears previous selections');
assert.equal(MapFilters.values('catalogs').join(),MapFilters.defaults('catalogs').join(),'catalogue mode displays its explicit default selection');
assert.ok(MapFilters.isDefault());
for(const from of ['classes','collections','catalogs'])for(const to of ['classes','collections','catalogs'])if(from!==to){
 const selections={classes:['star'],collections:['messier'],catalogs:['sdss-voids']};
 MapFilters.setGroup(from,selections[from]);MapFilters.setTab(to);
 assert.equal(MapFilters.activeGroup,to);assert.equal(MapFilters.tab,to);
 for(const group of ['classes','collections','catalogs'])assert.equal(MapFilters.values(group).join(),MapFilters.defaults(group).join(),'tab transition resets defaults: '+from+' → '+to+' '+group);
 MapFilters.setGroup(to,selections[to]);
 for(const group of ['classes','collections','catalogs'])if(group!==to){
  assert.ok(MapFilters.unrestricted(group),'inactive mode has no effect');
  assert.equal(MapFilters.values(group).join(),MapFilters.defaults(group).join());
 }
 assert.equal(MapFilters.count,1);assert.equal(filter,to==='classes'?'star':'all','streaming legacy class hint follows the active mode');
}
MapFilters.setGroup('catalogs',['sdss-voids']);
assert.ok(!MapFilters.values('classes').includes('void'),'inactive classes retain their visual default');
assert.ok(MapFilters.allowsCategory('void'),'inactive class defaults do not hide the source category');
assert.ok(OBJECTS.filter(o=>o.kind==='void'&&MapFilters.matchesCatalog(o,'sdss-voids')).every(o=>MapFilters.matches(o)));
assert.ok(MapFilters.bucketMatches(['void',0,['sdss-voids'],1,[]]),'streaming and small-selection counts also ignore inactive classes');
MapFilters.setGroup('classes',['star']);
for(const id of ['sirius','s2'])assert.ok(MapFilters.matches(object(id)),'stars from every source: '+id);
for(const label of $('filterPanel-catalogs').children){
 const input=label.children[0],text=label.children[1],description=text.children[1];
 assert.ok(description.textContent.length>15,'each discovered source has visible contents');
 assert.equal(description.className,'map-filter-description');assert.equal(input.getAttribute('aria-describedby'),description.id);
 assert.equal(description.textContent,MapFilters.catalogs[input.value][1],'shared registry supplies visible descriptions');
}

// The native preset checkbox restores defaults and reflects their actual state.
MapFilters.setGroup('classes',MapFilters.options('classes'));
assert.ok(MapFilters.values('classes').includes('void'));
const fullKey=MapFilters.key;
assert.equal($('mapFilterDefault').checked,false,'custom values clear the preset checkmark');
$('mapFilterDefault').onchange();
assert.equal($('mapFilterDefault').checked,true,'reset checks the default preset');
assert.ok(MapFilters.isDefault());assert.equal(MapFilters.count,0);
assert.ok(!MapFilters.values('classes').includes('void'));
assert.ok(OBJECTS.filter(o=>o.kind==='void').every(o=>!ExtendedCatalog.matchesMap(o,true)),'all void populations are off after the actual default action');
assert.notEqual(MapFilters.key,fullKey,'default overview cannot reuse an unrestricted render cache');
assert.equal($('filterPanel-classes').children.find(label=>label.children[0].value==='void').children[1].children.length,1,'void row has no obsolete default-off note');
const classDefaults=MapFilters.values('classes').join(),defaultKey=MapFilters.key;
$('mapFilterDefault').checked=false;$('mapFilterDefault').onchange();assert.equal(MapFilters.key,defaultKey,'repeat reset is idempotent');assert.equal($('mapFilterDefault').checked,true,'preset remains checked while defaults apply');
MapFilters.setup();assert.equal(MapFilters.values('classes').join(),classDefaults,'the default reset survives reload without enabling voids');
const mappedCore=OBJECTS.filter(o=>!o.atlasOnly&&!o.supersededBy&&!MapGeometry.unlocated(o));
const normalObjects=new Set(mappedCore.filter(o=>MapFilters.matches(o)).map(o=>o.id));
const normalTotal=MapFilters.total;
for(const group of ['classes','collections','catalogs']){
 MapFilters.setGroup(group,MapFilters.defaults(group));
 assert.ok(MapFilters.isDefault());assert.equal(MapFilters.count,0);
 assert.equal(MapFilters.total,normalTotal,'default sources preserve the complete ordinary overview count: '+group);
 assert.deepEqual(mappedCore.filter(o=>MapFilters.matches(o)!==normalObjects.has(o.id)).map(o=>[o.id,o.kind,MapFilters.classOf(o)]),[],'every default mode has the same baseline: '+group);
 assert.ok(!MapFilters.allowsCategory('void'));assert.ok(!MapFilters.allowsCategory('supercluster'));
 assert.ok(MapFilters.allowsCategory('filament'),'default overview retains cosmic filaments');
 assert.ok(!MapFilters.bucketMatches(['void',0,['sdss-voids'],635,null,true]));
 assert.ok(!MapFilters.bucketMatches(['structure',0,['sdss-superclusters'],1313,null,true]));
 for(const id of ['sirius','s2','andromeda','shapley','laniakea','quipu'])assert.ok(MapFilters.matches(object(id)),'ordinary objects and named structures remain: '+id+' / '+group);
 const bulk={id:'bulk-structure',kind:'structure',cosmicSubtype:'supercluster',cosmicCatalog:true};
 assert.ok(!MapFilters.matches(bulk));assert.ok(MapFilters.matches({...bulk,cosmicLandmark:true}),'named landmark exception survives');
}
MapFilters.setGroup('classes',['void']);
assert.ok(OBJECTS.filter(o=>o.kind==='void').every(o=>MapFilters.matches(o)),'voids remain explicitly selectable');
MapFilters.setGroup('classes',['structure']);assert.ok(MapFilters.matches({id:'bulk-structure',kind:'structure',cosmicSubtype:'supercluster',cosmicCatalog:true}),'explicit megastructures retain their full layer');
MapFilters.change(MapFilters.defaults('classes'),[],[]);assert.ok(MapFilters.unrestricted('collections')&&MapFilters.unrestricted('catalogs'));
MapFilters.setGroup('collections',['messier']);assert.equal(MapFilters.values('collections').join(),'messier','one optional value immediately isolates the selection');
MapFilters.setTab('collections');assert.equal($('mapFilterToolbar').hidden,true,'collections have no master control');
const collectionInputs=$('filterPanel-collections').children.map(label=>label.children[0]);
assert.ok(collectionInputs.every(input=>input.type==='radio'&&input.name==='map-collection'));
collectionInputs.find(input=>input.value==='nearby').onclick();assert.equal(MapFilters.values('collections').join(),'nearby');
collectionInputs.find(input=>input.value==='messier').onclick();assert.equal(MapFilters.values('collections').join(),'messier','new radio replaces the old selection');
collectionInputs.find(input=>input.value==='messier').onclick();assert.ok(MapFilters.unrestricted('collections'),'repeat activation clears the collection');
MapFilters.setTab('catalogs');MapFilters.setGroup('catalogs',MapFilters.options('catalogs'));
assert.equal($('mapFilterToolbar').hidden,false);assert.ok(!MapFilters.isDefault());
assert.ok(MapFilters.matches({id:'bulk-structure',kind:'structure',cosmicSubtype:'supercluster',cosmicCatalog:true,catalog:'SDSS-superclusters'}),'explicit complete source union includes all survey records');
const allSourceKey=MapFilters.key;
$('mapFilterDefault').onchange();
assert.ok(MapFilters.isDefault());assert.equal(MapFilters.values('catalogs').join(),MapFilters.defaults('catalogs').join(),'default catalogue action selects its actual source set');
assert.equal(MapFilters.values('catalogs').length,28);
const checkedCatalogs=$('filterPanel-catalogs').children.filter(label=>label.children[0].checked).map(label=>label.children[0].value);
assert.equal(checkedCatalogs.join(),MapFilters.defaults('catalogs').join(),'every enabled default source has a visible checkmark');
assert.ok(!checkedCatalogs.includes('sdss-voids')&&!checkedCatalogs.includes('sdss-superclusters'));
assert.ok(checkedCatalogs.includes('phat-ap')&&checkedCatalogs.includes('game')&&checkedCatalogs.includes('sdss-filaments'));
assert.equal($('filterCount-catalogs').hidden,true,'default sources do not count as an extra filter');
assert.notEqual(MapFilters.key,allSourceKey,'source default has a distinct rendering policy');
assert.equal(MapFilters.values('classes').join(),classDefaults,'inactive classes remain at defaults');
assert.equal(MapFilters.values('collections').length,0);
MapFilters.setup();assert.equal(MapFilters.activeGroup,'catalogs');assert.ok(MapFilters.isDefault(),'catalogue reset survives reload');
console.log('PASS six tab transitions, inactive defaults, source voids, visible source contents, native radios, real default actions and exclusive v5 preferences');
`);

const oldCatalogs=['hyg','opengc','atnf','nearby','cf4','blackholes'];
const migrate=(version,value)=>{
 context.savedPreferences.clear();context.savedPreferences.set('parus-map-filters-'+version,JSON.stringify(value));
 run('MapFilters.setup()');
};
migrate('v2',{classes:['star'],collections:[],catalogs:oldCatalogs});
run(`assert.equal(MapFilters.key,'star|all|all','the former six-value v2 unrestricted set stays unrestricted');`);
migrate('v3',{classes:['star'],collections:[],catalogs:oldCatalogs});
run(`assert.equal(MapFilters.key,'all|all|hyg,opengc,atnf,nearby,cf4,blackholes','v3 preserves its explicitly restricted six-source union, resetting classes');`);
migrate('v2',{classes:['star'],collections:['naked-eye','messier','nearby','multiple','remnants'],catalogs:[]});
run(`assert.equal(MapFilters.key,'star|all|all','old five-value v2 unrestricted set stays unrestricted after adding collections');`);
migrate('v2',run(`({classes:MapFilters.defaults('classes'),collections:MapFilters.options('collections'),catalogs:MapFilters.options('catalogs')})`));
run(`assert.equal(MapFilters.activeGroup,'classes');assert.equal(MapFilters.values('collections').length,0);assert.equal(MapFilters.values('catalogs').join(),MapFilters.defaults('catalogs').join());assert.ok(!MapFilters.values('classes').includes('void'));`);
migrate('v2',{classes:['star','galaxy'],collections:['nearby','messier'],catalogs:['hyg','opengc']});
run(`assert.equal(MapFilters.key,'all|nearby|all');`);
migrate('v3',{classes:['star','galaxy'],collections:['invalid','messier','nearby'],catalogs:['hyg','opengc']});
run(`assert.equal(MapFilters.key,'all|messier|all','legacy unions keep their first valid collection and reset other modes');`);
migrate('v1',{classFilter:'galaxy',catalog:'opengc'});
run(`assert.equal(MapFilters.key,'all|all|opengc');`);
migrate('v4',{activeGroup:'catalogs',classes:['star'],collections:['messier'],catalogs:[]});
run(`assert.equal(MapFilters.activeGroup,'catalogs');assert.ok(MapFilters.isDefault(),'an old empty source mode becomes the explicit default set');assert.equal(MapFilters.values('catalogs').length,28);MapFilters.open();assert.equal(MapFilters.tab,'catalogs');`);
migrate('v4',{activeGroup:'classes',classes:['galaxy'],collections:['messier'],catalogs:['hyg']});
run(`assert.equal(MapFilters.key,'galaxy|all|all','explicit saved mode wins over inactive stale selections');`);
migrate('v4',run(`({activeGroup:'catalogs',catalogs:MapFilters.options('catalogs')})`));
run(`assert.ok(MapFilters.all('catalogs')&&!MapFilters.isDefault(),'old explicit complete source union remains complete');`);
migrate('v1',{classFilter:'pulsar',catalog:'all'});
run(`assert.equal(MapFilters.activeGroup,'classes');assert.equal(MapFilters.values('classes').join(),'pulsar','legacy all sources cannot activate catalogue mode');`);
migrate('v5',{activeGroup:'catalogs',catalogs:[]});
run(`assert.equal(MapFilters.activeGroup,'catalogs');assert.equal(MapFilters.values('catalogs').length,0);assert.equal(MapFilters.total,0);assert.ok(!MapFilters.isDefault());MapFilters.setup();assert.equal(MapFilters.values('catalogs').length,0,'genuinely empty v5 catalogues persist');`);
context.savedPreferences.set('parus-map-filters-v4',JSON.stringify({activeGroup:'catalogs',catalogs:[]}));
run(`MapFilters.setup();assert.equal(MapFilters.values('catalogs').length,0,'v5 empty selection wins over an older default');MapFilters.setGroup('catalogs',MapFilters.defaults('catalogs'));MapFilters.setup();assert.equal(MapFilters.values('catalogs').length,28);`);
console.log('PASS v1–v4 migration, former unrestricted sets, explicit full source sets, v5 defaults/empty selections and reopening');

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
MapFilters.change('all','photos','all');await MapFilters.pending;
assert.ok(MapFilters.total>300&&MapFilters.narrow,'the complete photo collection exceeds the ordinary small-selection budget');
assert.ok(!MapFilters.loadError);
assert.equal(MapFilters.promoted.size,MapFilters.total,'every mapped photo identity is retained regardless of currently visible tiles');
assert.equal(MapFilters.objects.size,MAP_FILTER_DATA.buckets.filter(b=>MapFilters.bucketMatches(b)).reduce((n,b)=>n+b[3],0));
assert.ok([...MapFilters.objects.values()].every(o=>SkyGuide.hasObservatoryPhoto(o)&&!o.atlasOnly));
assert.ok(MapFilters.objects.has('opengc-ngc1365'),'unloaded photograph-bearing galaxy comes from its original tile');
assert.ok(MapFilters.promoted.has('lmc')&&!MapFilters.promoted.has('barnard'),'actual observatory shots qualify, survey-only records do not');
assert.equal(SkyPhotos.cache.size,0,'selecting the photo collection never fetches image metadata or pixels');
const realPhotoPredicate=SkyGuide.hasObservatoryPhoto;
SkyGuide.hasObservatoryPhoto=()=>{throw Error('Per-frame photo catalogue join');};
for(const o of [...OBJECTS,...MapFilters.objects.values()])assert.equal(MapFilters.matches(o),MapFilters.anchor(o)||MapFilters.promoted.has(o.id));
SkyGuide.hasObservatoryPhoto=realPhotoPredicate;
const photoRevision=MAP_FILTER_DATA.photoRevision;MAP_FILTER_DATA.photoRevision='stale-photo-index';
MapFilters.refreshSelection();assert.ok(!MapFilters.narrow,'a stale photo membership index cannot claim completeness');
MAP_FILTER_DATA.photoRevision=photoRevision;
MapFilters.change('all','photos','all');const obsoletePhotos=MapFilters.pending;
MapFilters.change('all','galileo','all');await Promise.all([obsoletePhotos,MapFilters.pending]);
assert.ok([...MapFilters.objects.values()].every(o=>MapFilters.matchesCollection(o,'galileo')),'late photo tile responses cannot repopulate another collection');
assert.equal(JSON.stringify([...ExtendedCatalog.pinned.keys()]),pins,'filter references never pin expedition objects');
assert.equal(JSON.stringify([state,OBJECTS.map(o=>[o.id,o.p3,o.d,o.apparentV])]),physical,'complete selection loading preserves physical catalogue and flight');
console.log('PASS complete streamed selections, every scale/projection, glyph collisions, neighbour names, one galactic stellar icon and stale-load protection without expedition changes');
})()`);
