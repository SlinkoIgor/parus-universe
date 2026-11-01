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
assert.equal(DISTANT_CATALOG_DATA.counts.inputObservations,3298);
assert.equal(DistantCatalog.objects.length,3399);
assert.equal(DistantCatalog.objects.filter(o=>o.candidate).length,173);
assert.equal(DistantCatalog.objects.filter(o=>o.atlasOnly).length,5);
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
const observations=[...DistantCatalog.objects.flatMap(o=>o.observations||[]),...DISTANT_CATALOG_DATA.matches.flatMap(m=>m.measurement.observations||[])];
assert.equal(observations.length,3298);assert.equal(new Set(observations.map(o=>o.observationID)).size,3298);
assert.equal(DISTANT_CATALOG_DATA.matches.length,1);assert.equal(DISTANT_CATALOG_DATA.matches[0].targetId,'jades-z14');
assert.ok(object('jades-z14').catalogMeasurements.some(m=>m.catalog==='JADES DR4'));
assert.ok(!object(DISTANT_CATALOG_DATA.matches[0].sourceId),'no duplicate of the existing JADES galaxy');
for(const o of DistantCatalog.objects){
 assert.equal(o.p3.length,3);assert.ok(o.p3.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...o.p3)/o.d-1)<1e-12);
 assert.equal(o.cosmology.H0,70);assert.ok(o.source.startsWith('https://'));assert.ok(o.facts.refs.length);
 assert.equal(o.massSolar,undefined);assert.equal(o.galaxy,undefined,'no invented galaxy size');assert.equal(o.region,undefined,'no invented cluster boundary');
 if(o.candidate){assert.ok(o.d>Cosmology.horizon(0));assert.ok(o.redshiftError>0);assert.ok(o.catalogData.Mass!==undefined);assert.equal(MapDetails.mass(o),null,'model cluster estimates are not a compact point mass');}
 if(o.atlasOnly){assert.equal(o.navigable,false);assert.equal(MapAnnotations.entries.has(o.id),false);}
 else assert.ok(MapAnnotations.entries.has(o.id));
}
for(const id of ['CCPC-z20-002','CCPC-z65-005',DistantCatalog.objects.find(o=>o.catalog==='JADES DR4'&&!o.atlasOnly).id]){
 const o=object(id),q=CosmicCatalog.cosmology(o.redshift);assert.ok(Math.abs(q.distanceLy/o.d-1)<1e-12);
 state=initial();state.selected=id;paused=true;const saved=FlightHistory.snapshot(),fresh=restore(saved);assert.equal(fresh.selected,id);assert.equal(fresh.matter,state.matter);assert.equal(fresh.earth,state.earth);assert.equal(fresh.flight,null);
}
for(const mode of ['full','slice','radial']){MapSlice.mode=mode;MapSlice.centerZ=0;for(const o of DistantCatalog.objects.filter(o=>!o.atlasOnly).slice(0,5)){assert.equal(MapDetails.opacity(o,1.15e11),1);assert.ok(Number.isFinite(MapLayout.project(o).x));}}
state=initial();Cosmology.sync(state);width=1440;height=855;const overview=UniverseMap.overview();goCamera(overview.x,overview.y,overview.span,true);
assert.ok(mapContext(overview)[1].includes(distanceText(2*UniverseMap.radius)),'heading and boundary share the same reference horizon');
const g=UniverseMap.geometry();assert.ok(g.y-g.r>80);assert.ok(g.y+g.r<height-20);assert.equal(UniverseMap.hit(g.x,g.y),null,'no inner galaxies-and-clusters region');
for(const area of UniverseMap.areas){assert.equal(area.navigable,false);assert.equal(area.p3,undefined);}
for(const q of UniverseMap.areas.slice(0,3)){const r=(q.r0+q.r1)/2*g.k;assert.equal(UniverseMap.hit(g.x-r,g.y).id,q.id);}
assert.equal(UniverseMap.hit(g.x+g.r+30,g.y).id,'epoch-beyond');
cam.span=24;assert.equal(UniverseMap.active(),false);assert.equal(UniverseMap.hit(0,0),null);
`);
assert.equal(run('OBJECTS.length'),counts.core+3406);
assert.equal(run('ExtendedCatalog.total'),counts.total+3406);
console.log('PASS universe epochs: reference light cone, selectable retained rings and exterior, no inner region, viewport fit and no navigation coordinates');
console.log('PASS distant sources: 173 candidates, 3226 new JADES targets, all 3298 observation rows retained, five conflicts Atlas-only, existing galaxy merged without moving it, source units/model masses/unknown sizes and save restoration');
