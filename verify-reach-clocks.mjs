import fs from 'node:fs';import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
state=initial();Cosmology.sync(state);resize();
let previous=0;for(const beta of [.01,.6,.99,.999999995]){const reach=Cosmology.reach(beta);assert.ok(reach>previous&&reach<Cosmology.horizon());assert.ok(Math.abs(Cosmology.coast(beta,1e12,0,true).distance/reach-1)<1e-6);previous=reach;}
const whole=Cosmology.reach(.99),leg=Cosmology.coast(.99,2e9,0,true);assert.ok(Math.abs((leg.distance+Cosmology.reach(leg.beta,leg.earth))/whole-1)<1e-6);
assert.equal(Cosmology.reach(0),0);Cosmology.enabled=false;assert.equal(Cosmology.reach(.6),Infinity);Cosmology.sync(state);
assert.ok(shipReachability().radius>0);state.expansion=false;Cosmology.sync(state);assert.equal(shipReachability(),null);
state=initial();paused=false;Simulation.debt=0;Cosmology.sync(state);Simulation.tick(100);assert.equal(state.universeElapsed,100);assert.equal(state.earth,100);assert.equal(state.proper,100);
state.expansion=false;Simulation.tick(50);assert.equal(state.universeElapsed,150);assert.equal(state.earth,150);assert.equal(state.cosmicTime,100);renderUI();assert.equal($('universeElapsed').textContent,fmt(150,0));assert.equal($('universeClock').textContent,fmt(13800000150,0));
const old={...initial(),earth:1234,proper:100};delete old.universeElapsed;const migrated=restore(JSON.parse(JSON.stringify(old)));assert.equal(migrated.universeElapsed,1234);
state=initial();state.selected='alpha';launch(true);tickPhysics(state.flight.engine.burnProper);tickPhysics(1);assert.ok(state.earth>state.proper);assert.equal(state.universeElapsed,state.earth);
// Flyby must advance cosmic and Solar clocks by exactly the same coordinate dt.
const fake={proper:1,elapsedProper:0,beta:.5};state.flight={target:'sgr',encounter:{plan:fake,lastEarth:0,lastProper:0,lastPath:0}};state.phase='flyby';state.expansion=true;state.universeElapsed=state.earth=state.proper=0;state.cosmicTime=0;
const originalAt=Gravity.atProper;Gravity.atProper=()=>({earth:.4,proper:.2,path:0,offset:[0,0,0]});Route.tick(.2);Gravity.atProper=originalAt;assert.equal(state.universeElapsed,.4);assert.equal(state.earth,.4);assert.equal(state.proper,.2);assert.equal(state.cosmicTime,.4);
assert.equal(MapLabels.dynamic('ship-reach'),true);
const hostMatch={id:'andromeda',name:'Андромеда · M31',kind:'galaxy'},memberMatch={id:'lggs-a',name:'M31 · LGGS A',kind:'star',searchExact:true};
assert.ok(catalogMatchRank(hostMatch,MapDetails.searchKey('Андромеда'),()=>false)>catalogMatchRank(memberMatch,MapDetails.searchKey('Андромеда'),()=>false));
assert.ok(catalogMatchRank(hostMatch,'m31',()=>true)>catalogMatchRank(memberMatch,'m31',()=>true));
`);
const index=JSON.parse(fs.readFileSync('dist/catalog-data/search.json','utf8')),bulk=index.filter(r=>r[0].startsWith('lggs-')||r[0].startsWith('phat-ap-')||r[0].startsWith('m33-snr-'));
assert.equal(bulk.length,4924);const chosen=bulk.filter(r=>r[0].startsWith('lggs-m31-')).slice(0,6);const distances=new Set();
for(const r of chosen){const row=JSON.parse(fs.readFileSync('dist/catalog-data/'+r[5],'utf8')).find(q=>q[0]===r[0]);context.bulkRow=row;run(`{const o=ExtendedCatalog.decode(bulkRow);assert.ok(o.navigable&&o.p3.every(Number.isFinite));assert.equal(o.positionEstimate.method,'host-disk');assert.ok(ExtendedCatalog.background(o));ExtendedCatalog.focus(o);assert.ok(cameraGoal.span>=4*o.positionEstimate.localEnvelopeLy);assert.ok(Space.distance(o,object(o.parentGalaxy))<o.positionEstimate.referenceScaleLy/2);}`);distances.add(row[3]);}
assert.equal(distances.size,chosen.length,'inclined disk members do not receive one shared shell distance');
console.log('PASS finite ship reach, composition, frozen expansion, three clocks, flyby, save migration and streamed disk members');
