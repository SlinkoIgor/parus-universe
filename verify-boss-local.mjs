import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
function localReset(epoch,expansion=true){state=initial();state.expansion=expansion;state.cosmicTime=epoch;state.universeElapsed=epoch;state.proper=10119;state.earth=epoch;state.current='boss-wall';state.ship=Space.point(object('boss-wall').p3);state.selected='alpha';state.matter=.0005383;state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,arrivalFuelPercent:53.83});paused=false;Simulation.debt=0;Simulation.wallDebt=0;Cosmology.sync(state);}
function localNear(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);}
for(const epoch of [0,7.342773063e9,14e9])for(const expansion of [true,false]){
 localReset(epoch,expansion);const host=object('boss-wall');for(const id of [...ExtendedCatalog.pinned.keys()])if(id.startsWith('game-star:boss-wall:'))ExtendedCatalog.pinned.delete(id);delete host.departureStar;
 findDepartureStar();const star=object(state.selected),offset=V3.sub(star.p3,host.p3),map=MapLayout.project(star),parent=MapLayout.project(host),d=Space.distance(host,star);
 assert.ok(star.synthetic);assert.equal(Cosmology.group(star).id,Cosmology.group(host).id);localNear(map.x-parent.x,offset[0]);localNear(map.y-parent.y,-offset[1]);localNear(Cosmology.physicalDistance(state.ship,star),d,1e-12);
 const p=MissionPlanner.preview();assert.ok(p.valid,p.reason);assert.equal(p.cosmic,false);localNear(p.distance,d,1e-12);const start={proper:state.proper,earth:state.earth,fuel:state.matter};MissionPlanner.launch();
 const f=state.flight,a=FlightView.at(f,0),b=FlightView.at(f,1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.2,'local route cannot stretch into billions of map light-years');
 Simulation.tick(p.proper*.45);assert.ok(state.flight);assert.ok(state.flight.covered>0&&state.flight.covered<state.flight.distance);assert.ok(Cosmology.physicalDistance(state.ship,star)<d);
 const saved=JSON.parse(JSON.stringify(state));saved.flight.view={a:{x:123,y:456},b:{x:1e20,y:2e20},geometryVersion:MapLayout.version,referenceEpoch:true};
 const record=saved.catalogObjects.find(o=>o.id===star.id);assert.ok(record);record.mapPosition={x:1e20,y:1e20};
 state=restore(saved);assert.ok(!state.flight.view,'stale expanded endpoints are discarded');const repaired=object(star.id);localNear(MapLayout.baseProject(repaired).x-MapLayout.baseProject(host).x,offset[0]);
 const remaining=FlightEstimate.get();Simulation.tick(remaining.proper);assert.equal(state.flight,null);assert.equal(state.current,star.id);assert.equal(state.beta,0);assert.ok(canBoost('burst'));localNear(state.proper-start.proper,p.proper,1e-8);localNear(state.earth-start.earth,p.earth,5e-6);localNear(state.matter*1000,p.arrivalFuelKg,1e-8);assert.ok(state.matter>=0&&state.matter<=start.fuel+1e-6);
 console.log('PASS BOSS → synthetic star: local map, distance, motion, corrupt-old-view migration, clocks/fuel and actual arrival:',epoch,expansion);
}
// A child across the arbitrary local-group distance threshold still uses its host.
const edge={id:'test-edge-host',kind:'structure',p3:[4e6+.01,0,0]},child={id:'test-edge-star',kind:'star',synthetic:true,parentObject:edge.id,p3:[4e6-.01,0,0]};ExtendedCatalog.pinned.set(edge.id,edge);ExtendedCatalog.pinned.set(child.id,child);assert.equal(Cosmology.group(child).id,edge.id);
// The same local frame keeps a parked orbit physical after a cosmological leg.
state=initial();state.current='3c273';state.cosmicTime=7.34e9;Cosmology.sync(state);const hostOrbit=object('3c273'),bodyOrbit=OrbitalArrival.target(hostOrbit);state.orbit={model:1,targetId:hostOrbit.id,body:bodyOrbit,radial:[1,0,0],tangent:[0,1,0],angle:0,radius:bodyOrbit.radius,speed:bodyOrbit.speed,beta:bodyOrbit.beta};state.ship=Space.point(V3.add(hostOrbit.p3,[bodyOrbit.radius/(LY*Cosmology.scale()),0,0]));state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);localNear(Cosmology.physicalDistance(state.ship,hostOrbit)*LY,bodyOrbit.radius,1e-5);Simulation.tick(.1);localNear(Cosmology.physicalDistance(state.ship,hostOrbit)*LY,bodyOrbit.radius,1e-5);
console.log('PASS old parked orbit offsets migrate to a physical host-relative radius and remain constant while orbiting');

}`);
