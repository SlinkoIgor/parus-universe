import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#universe');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
const original=run('JSON.stringify(OBJECTS.map(o=>({id:o.id,d:o.d,p3:o.p3,cosmology:o.cosmology,navigable:o.navigable,region:o.region})))');
const counts=JSON.parse(run('JSON.stringify({core:OBJECTS.length,total:ExtendedCatalog.total})'));
run(['distant-catalog-data','distant-catalog','universe-map'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
assert.equal(run('JSON.stringify(OBJECTS.filter(o=>!o.distantCatalog&&!o.cosmicEpoch).map(o=>({id:o.id,d:o.d,p3:o.p3,cosmology:o.cosmology,navigable:o.navigable,region:o.region})))'),original);
run(`
assert.equal(DISTANT_CATALOG_DATA.counts.inputObservations,5190);
assert.equal(DistantCatalog.objects.length,5282);
assert.equal(DistantCatalog.objects.filter(o=>o.candidate).length,173);
assert.equal(DistantCatalog.objects.filter(o=>o.atlasOnly).length,1873);
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
const observations=[...DistantCatalog.objects.flatMap(o=>o.observations||[]),...DISTANT_CATALOG_DATA.matches.flatMap(m=>m.measurement.observations||[])];
assert.equal(observations.length,5190);assert.equal(new Set(observations.map(o=>o.observationID)).size,5190);
assert.equal(DISTANT_CATALOG_DATA.matches.length,1);assert.equal(DISTANT_CATALOG_DATA.matches[0].targetId,'jades-z14');
assert.ok(object('jades-z14').catalogMeasurements.some(m=>m.catalog==='JADES DR4'));
assert.ok(!object(DISTANT_CATALOG_DATA.matches[0].sourceId),'no duplicate of the existing JADES galaxy');
for(const o of DistantCatalog.objects){
 if(o.atlasOnly){assert.equal(o.p3,null);assert.equal(o.navigable,false);assert.equal(MapDetails.visible(o,1),false);}
 else{assert.equal(MapGeometry.unlocated(o),false,'sourced survey centres retain their coordinates even without an extent');assert.equal(o.p3.length,3);assert.ok(o.p3.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...o.p3)/o.d-1)<1e-12);
 assert.ok(Math.hypot(...Space.fromSky(o.raDeg,o.decDeg,o.d).map((v,i)=>v-o.p3[i]))/o.d<1e-12,'map directions preserve the source sky coordinates');
 assert.equal(o.cosmology.H0,70);}
 assert.ok(o.source.startsWith('https://'));assert.ok(o.facts.refs.length);assert.equal(o.cosmicLandmark,undefined,'survey membership does not confer landmark rank');
 assert.equal(o.massSolar,undefined);assert.equal(o.galaxy,undefined,'no invented galaxy size');assert.equal(o.region,undefined,'no invented cluster boundary');
 if(o.candidate){assert.ok(o.d>Cosmology.horizon(0));assert.ok(o.redshiftError>0);assert.ok(o.catalogData.Mass!==undefined);assert.equal(MapDetails.mass(o),null,'model cluster estimates are not a compact point mass');}
 if(o.atlasOnly)assert.equal(o.navigable,false);
 assert.equal(MapAnnotations.entries.has(o.id),!o.atlasOnly&&!!MapDetails.mapLabelName(o),'the common name filter also applies to the supplement');
 if(o.catalog==='JADES DR4'){assert.ok(o.observations.some(r=>r.raDeg===o.raDeg&&r.decDeg===o.decDeg),'the narrow field directions come from the source observations');if(!o.atlasOnly)assert.ok(o.observations.some(r=>r.redshift===o.redshift&&'ABC'.includes(r.quality)),'only reliable source z determines distance');}
 if(o.objectOfInterest){assert.equal(o.sourceTable,'table6');assert.equal(o.redshiftStatistic,'mean');assert.equal(o.redshiftError,undefined);assert.equal(o.candidate,undefined);assert.equal(MapDetails.mass(o),null);assert.ok(o.catalogRows.length>0);}
 if(o.kind==='unknown'){assert.equal(o.d,undefined);assert.equal(o.redshift,undefined);assert.equal(o.cosmology,undefined);assert.ok(o.atlasOnly);assert.equal(MapDetails.typeName(o),'Спектроскопическая цель · JADES DR4');}
}
assert.equal(DistantCatalog.objects.filter(o=>MapAnnotations.entries.has(o.id)).length,0,'numeric catalogue IDs do not become captions, including the former overview anchors');
for(const id of ['CCPC-z20-002','CCPC-z65-005',DistantCatalog.objects.find(o=>o.catalog==='JADES DR4'&&!o.atlasOnly).id]){
 const o=object(id),q=CosmicCatalog.cosmology(o.redshift);assert.ok(Math.abs(q.distanceLy/o.d-1)<1e-12);
 state=initial();state.selected=id;paused=true;const saved=FlightHistory.snapshot(),fresh=restore(saved);assert.equal(fresh.selected,id);assert.equal(fresh.matter,state.matter);assert.equal(fresh.earth,state.earth);assert.equal(fresh.flight,null);
}
for(const mode of ['full','radial']){MapSlice.mode=mode;for(const o of DistantCatalog.objects.filter(o=>!o.atlasOnly).slice(0,5)){assert.ok(MapVisibility.limit(o)>0&&Number.isFinite(MapVisibility.limit(o)));assert.ok(Number.isFinite(MapLayout.project(o).x));}}

assert.equal(DistantCatalog.objects.filter(o=>o.objectOfInterest).length,15);
assert.equal(DistantCatalog.objects.filter(o=>o.objectOfInterest).flatMap(o=>o.catalogRows).length,17);
assert.equal(DistantCatalog.objects.filter(o=>o.kind==='unknown').length,1868);
assert.equal(MAP_VISIBILITY_BOOT.supplementRevision,DISTANT_CATALOG_DATA.revision);
const mapped=DistantCatalog.objects.filter(o=>!o.atlasOnly),near=mapped.filter(o=>o.d<Cosmology.horizon(0)),far=mapped.filter(o=>o.d>Cosmology.horizon(0));
assert.ok(near.length>700&&far.length>2500,'same source coverage on both sides of the light horizon');
assert.equal(typeof DistantCatalog.draw,'undefined','no separate rendering or horizon filter');
for(const o of mapped)for(const p of MAP_VISIBILITY_BOOT.pixels[o.id])assert.ok(p>0,'all supplement points compete in the density hierarchy, including cluster centres with unknown extent');
for(const mode of ['full','radial']){
 MapSlice.mode=mode;state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=855;filter='all';MapLayers.active=false;
 for(const o of [...near.slice(0,5),...far.slice(0,5)]){
  const p=MapLayout.project(o),limit=MapVisibility.limit(o);let last=0;
  for(const factor of [1.1,1,.95,.85,.75,.5,.1]){cam={x:p.x,y:p.y,span:limit*width*factor};const alpha=MapDetails.opacity(o,cam.span);assert.ok(alpha>=last);last=alpha;cam.x+=cam.span*.02;state.selected=o.id;assert.equal(MapDetails.opacity(o,cam.span),alpha,'selection/panning cannot change source hierarchy');}
  cam={x:p.x,y:p.y,span:limit*width*.5};MapLabels.begin();drawObjects();assert.ok(hitObjects.some(h=>h.o.id===o.id),'native renderer includes near and far catalogue points');
  MapLabels.draw();assert.ok(!MapLabels.placed.some(q=>q.key==='object-'+o.id),'catalogue numbers do not acquire labels');
  const expected=mode==='radial'?MapRadial.placement(o).position:MapLayout.ordinaryProject(o);assert.ok(Math.hypot(p.x-expected.x,p.y-expected.y)<1e-5,'ordinary projection, no survey offset');
 }
 cam={x:0,y:0,span:1.15e11};state.selected='alpha';MapLabels.begin();drawObjects();
 const shown=hitObjects.filter(h=>h.o.distantCatalog).map(h=>h.o);assert.ok(shown.length>0&&shown.length<mapped.length/2,'overview uses sparse common density');assert.ok(shown.some(o=>o.d<Cosmology.horizon(0))&&shown.some(o=>o.d>Cosmology.horizon(0)),'overview remains populated on both sides of the light horizon');
 const ids=shown.map(o=>o.id);cam.x+=cam.span*.001;MapLabels.begin();drawObjects();for(const id of ids){const p=screen(object(id));if(p.x>50&&p.x<width-50&&p.y>50&&p.y<height-50)assert.ok(hitObjects.some(h=>h.o.id===id),'pan retains catalogue representatives');}
}
state=initial();Cosmology.sync(state);width=1440;height=855;const overview=UniverseMap.overview();goCamera(overview.x,overview.y,overview.span,true);
assert.ok(mapContext(overview)[1].includes(distanceText(UniverseMap.radius)),'heading and ruler share the same radius');
const g=UniverseMap.geometry();assert.ok(g.y-g.r>80);assert.ok(g.y+g.r<height-20);assert.equal(UniverseMap.hit(g.x,g.y),null,'no inner galaxies-and-clusters region');
for(const area of UniverseMap.areas){assert.equal(area.navigable,false);assert.equal(area.p3,undefined);}
for(const q of UniverseMap.areas.slice(0,3))for(let i=0;i<12;i++){UniverseMap.labels=[];const r=(q.r0+q.r1)/2*g.k,a=i*Math.PI/6;assert.equal(UniverseMap.hit(g.x+r*Math.cos(a),g.y+r*Math.sin(a)).id,q.id);}
assert.equal(UniverseMap.hit(g.x+g.r+30,g.y).id,'epoch-beyond');
const originalCanvas={beginPath:ctx.beginPath,arc:ctx.arc,fill:ctx.fill};let ringPath=[],fills=[];
ctx.beginPath=()=>{ringPath=[];};ctx.arc=(...args)=>ringPath.push(args);ctx.fill=()=>fills.push({alpha:ctx.globalAlpha,path:ringPath.slice()});
for(const [i,q] of UniverseMap.areas.slice(0,3).entries()){
 state.selected=q.id;hover=UniverseMap.areas[(i+1)%3];fills=[];UniverseMap.draw();
 const selectedFill=fills.filter(f=>f.alpha===.07);assert.equal(selectedFill.length,1,'selection remains highlighted while another ring is hovered');
 assert.deepEqual(selectedFill[0].path.map(a=>a[2]),[q.r1*g.k,q.r0*g.k]);
 for(const f of fills)for(const arc of f.path)assert.ok(Math.abs(Math.abs(arc[4]-arc[3])-2*Math.PI)<1e-12,'all highlighted paths cover complete rings');
}
Object.assign(ctx,originalCanvas);hover=null;
// The ruler spans the projected diameter with a radius on each half, and its reading measures the same expanding
// reference sphere as the outline. Disabling expansion freezes its reached size.
for(const size of [[1440,855],[900,620],[390,562]])for(const mode of ['full','radial']){
 [width,height]=size;MapSlice.mode=mode;state=initial();Cosmology.sync(state);
 const originalState=JSON.stringify(state);cam=UniverseMap.overview();cameraGoal=null;UniverseMap.draw();
 const first=UniverseMap.ruler;assert.ok(first,'ruler fits overview '+size+'/'+mode);
 assert.equal(first.radius,UniverseMap.radius);assert.ok(first.label.includes('46,1 млрд св. лет'));assert.equal(first.center.x,(first.from.x+first.to.x)/2);
 assert.ok(Math.abs(first.to.x-first.from.x-2*UniverseMap.geometry().r)<1e-10,'dimension line spans the full diameter');
 assert.equal(first.labels.length,2);assert.equal(first.labels[0].text,first.labels[1].text);
 assert.ok(first.box.y>UniverseMap.geometry().y+UniverseMap.geometry().r,'ruler below circle');
 assert.ok(first.box.y+first.box.h<=height-8);assert.equal(JSON.stringify(state),originalState,'drawing never edits the expedition');
 Cosmology.elapse(state,15e9);cam=UniverseMap.overview();UniverseMap.draw();const later=UniverseMap.ruler;
 assert.ok(later.radius>first.radius);assert.ok(Math.abs(later.radius/first.radius/Cosmology.scale()-1)<1e-14);
 assert.ok(Math.abs(later.to.x-later.from.x-first.to.x+first.from.x)<1e-10,'overview fitting keeps the same visual ruler length');
 state.expansion=false;Cosmology.elapse(state,15e9);cam=UniverseMap.overview();UniverseMap.draw();assert.equal(UniverseMap.ruler.label,later.label);assert.equal(UniverseMap.ruler.radius,later.radius);
 state.expansion=true;Cosmology.elapse(state,15e9);cam=UniverseMap.overview();UniverseMap.draw();assert.ok(UniverseMap.ruler.radius>later.radius);
 cam.span=24;UniverseMap.draw();assert.equal(UniverseMap.active(),false);assert.equal(UniverseMap.hit(0,0),null);assert.equal(UniverseMap.ruler,null);
}
`);
assert.equal(run('OBJECTS.length'),counts.core+5289);
assert.equal(run('ExtendedCatalog.total'),counts.total+5289);
console.log('PASS universe epochs: whole-ring selection at every angle, retained selection during hover, reference light cone, exterior, viewport fit and no navigation coordinates');
console.log('PASS universe radius ruler: exact projected diameter with two radius captions below the circle, three viewport sizes and map modes, live expansion, frozen/resumed size and unchanged expedition');
console.log('PASS distant sources: all 5190 JADES observations, 5095 targets, 173 CCPC candidates +15 OOIs (17 source rows), 3409 mapped, 1873 Atlas-only, source positions/units/quality and existing IDs preserved');
