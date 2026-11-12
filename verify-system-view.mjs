import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#system-view');
context.systemRadial=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
context.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0],'utf8'))});
await run(`(async()=>{
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);MapRadial.manifest=systemRadial;
const systems=ExtendedCatalog.systems.filter(s=>s.members.every(id=>ExtendedCatalog.get(id)?.p3)),fixed=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3]));
assert.ok(systems.length>=43,'nearby hierarchies, Alpha Cen, compact binary and interacting galaxies');
let cases=0;
function inside(p,b,label){assert.ok(p.x>=b[0]-1e-8&&p.x<=b[2]+1e-8&&p.y>=b[1]-1e-8&&p.y<=b[3]+1e-8,label);}
for(const years of [0,50,200000])for(const mode of ['full','radial']){
 state.universeElapsed=years;MapSlice.setMode(mode);
 for(const system of systems){
  const members=system.members.map(id=>object(id));
  for(const id of system.members){
   state.selected=id;showObject(id);
   const html=$('dialogContent').innerHTML;
   assert.equal((html.match(/id="viewSystem"/g)||[]).length,1,'one common action for '+id);
   assert.ok(!/viewStellarOrbits|viewStellarInnerOrbits|Приблизить орбиты A–B/.test(html),'no duplicate or Alpha-specific action');
   const saved=JSON.stringify(state),bounds=await $('viewSystem').onclick();
   assert.ok(bounds&&!$('infoDialog').open);cam={...cameraGoal};cameraGoal=null;
   assert.deepEqual(bounds.box,relatedSystemBounds(members).box,'same system bounds from every member');
   assert.equal(JSON.stringify(state),saved,'system view changes no expedition data');
   for(const member of members){
    const p=MapLayout.project(member);inside(p,bounds.box,'include component without an orbit: '+member.id);
    const screenPoint=screen(member);assert.ok(screenPoint.x>=0&&screenPoint.x<=width&&screenPoint.y>=0&&screenPoint.y<=height,'member in viewport: '+member.id);
    const extent=MapGeometry.indexBounds(member),scale=Cosmology.regionScale(member);
    if(extent){inside({x:p.x+extent[0]*scale,y:p.y+extent[1]*scale},bounds.box,'include entire component extent');inside({x:p.x+extent[2]*scale,y:p.y+extent[3]*scale},bounds.box,'include entire component extent');}
    const orbit=stellarOrbitBounds(member);if(orbit){inside({x:orbit.box[0],y:orbit.box[1]},bounds.box,'include complete known orbit');inside({x:orbit.box[2],y:orbit.box[3]},bounds.box,'include complete known orbit');}
    assert.ok(ExtendedCatalog.matchesMap(member)&&MapDetails.visible(member,cam.span),'component is admitted at the common scale');
   }
   cases++;
  }
 }
}
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3])),fixed,'view cannot change source positions');
// Regression for the general defect: remote unmodelled branches must expand
// the view beyond the one close pair whose orbit is known.
state.universeElapsed=0;MapSlice.setMode('full');
const gl=ExtendedCatalog.systemByMember.get('hyg-82565'),glMembers=gl.members.map(id=>object(id)),whole=relatedSystemBounds(glMembers).box,inner=stellarOrbitBounds(glMembers[0]).box;
for(const o of glMembers.slice(-2)){const p=MapLayout.project(o);assert.ok(p.x<inner[0]||p.x>inner[2]||p.y<inner[1]||p.y>inner[3],'remote Gl 644 branch lies outside the known close orbit');inside(p,whole,'Gl 644 includes remote '+o.id);}
MapFilters.change('star','naked-eye','all',false);showObject('alpha');await $('viewSystem').onclick();assert.equal(MapFilters.key,'all|all|all','incompatible map selections cannot hide C');
MapFilters.change('star','nearby','all',false);showObject('alpha');await $('viewSystem').onclick();assert.equal(MapFilters.key,'all|nearby|all','compatible map selections are retained');MapFilters.change('all','all','all',false);
assert.equal(relatedSystemBounds([{id:'unknown',atlasOnly:true,p3:null}]),null);
assert.equal(relatedSystemBounds([{id:'incomplete',p3:[1,2]}]),null);
// Whole-system selection must survive the ordinary density and layer cutoffs;
// choosing another object or changing filters restores ordinary map selection.
const admits=MapLayers.admits,classOpacity=MapDetails.classOpacity;
MapLayers.admits=()=>false;MapDetails.classOpacity=()=>0;
showObject('alpha');await $('viewSystem').onclick();
for(const id of ['alpha','hyg-71453','proxima'])assert.ok(ExtendedCatalog.isSystemMember(object(id))&&ExtendedCatalog.matchesMap(object(id))&&MapDetails.visible(object(id),cam.span),'density cannot drop requested member '+id);
select('proxima');assert.ok(ExtendedCatalog.isSystemMember(object('alpha')),'clicking another component retains the system');
MapFilters.change('all','all','all',false);assert.equal(ExtendedCatalog.systemView,null);assert.equal(MapDetails.visible(object('alpha'),cam.span),false);
MapLayers.admits=admits;MapDetails.classOpacity=classOpacity;
showObject('alpha');await $('viewSystem').onclick();select('sol');assert.equal(ExtendedCatalog.systemView,null,'selection outside the system ends its visibility override');
// Actual tile-backed companions must survive autosave and tile eviction while
// being viewed, without adding the whole viewed system to expedition saves.
await ExtendedCatalog.resolve({id:'hyg-8481'});select('hyg-8481');showObject('hyg-8481');await $('viewSystem').onclick();
const streamedIds=ExtendedCatalog.systemByMember.get('hyg-8481').members;
ExtendedCatalog.cache.clear();ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
for(let n=0;n<3;n++)ExtendedCatalog.capture(state);
assert.ok(streamedIds.every(id=>ExtendedCatalog.get(id)?.p3),'autosave and tile eviction retain all viewed components');
assert.ok(!state.catalogObjects.some(o=>o.id==='hyg-8470'),'view-only companion does not enter the expedition save');
select('sol');ExtendedCatalog.capture(state);assert.ok(!ExtendedCatalog.pinned.has('hyg-8470'),'the view does not retain old systems indefinitely');
// Resolve every component before framing; a failed/unknown row must not erase
// the available view or fabricate coordinates. Test late responses separately.
const resolve=ExtendedCatalog.resolve,toastBefore=toast;let notices=[];toast=s=>notices.push(s);
ExtendedCatalog.resolve=async entry=>['hyg-71453','proxima'].includes(entry.id)?Promise.reject(Error('offline')):resolve.call(ExtendedCatalog,entry);
showObject('alpha');const partial=await $('viewSystem').onclick();assert.equal(partial.members.length,1);assert.ok(notices.some(s=>s.includes('1 из 3')));
ExtendedCatalog.resolve=resolve;let release;
ExtendedCatalog.resolve=async entry=>{await new Promise(r=>release=r);return resolve.call(ExtendedCatalog,entry);};
// One member avoids coupling deferred resolution to a particular hierarchy.
const system=ExtendedCatalog.systemByMember.get('alpha'),originalMembers=system.members;system.members=['alpha'];
showObject('alpha');cameraGoal=null;const pending=$('viewSystem').onclick();showObject('sirius');release();await pending;assert.equal(cameraGoal,null,'late response cannot steal another card view');
system.members=originalMembers;ExtendedCatalog.resolve=resolve;toast=toastBefore;
console.log('PASS '+systems.length+' systems / '+cases+' component actions: all members, remote branches, full orbits and galaxy extents, both projections and three epochs; one button, filters, unknowns, load failure, stale response and unchanged expedition');
})()`);
