import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled=true;state=initial();state.expansion=false;paused=true;state.current='bode';state.ship=Space.point(object('bode').p3);state.selected='alpha';state.matter=.000980099;state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,arrivalFuelPercent:98});state.departureMode='burst';
const origin=JSON.stringify(state.ship),proper=state.proper,earth=state.earth,fuel=state.matter;
renderUI();assert.equal($('findDepartureStar').hidden,false);assert.equal($('findDepartureStarCard').hidden,false);
findDepartureStar();const star=object(state.selected);assert.ok(star&&star.kind==='star');assert.ok(!state.destroyed.includes(star.id));assert.equal(state.current,'bode');assert.equal(JSON.stringify(state.ship),origin);assert.equal(state.proper,proper);assert.equal(state.earth,earth);assert.equal(state.matter,fuel);assert.equal(FlightSetup.read().engine,true);assert.equal(FlightSetup.read().dump,false);assert.equal(FlightSetup.read().sail,false);assert.equal(FlightSetup.read().burst,false);assert.equal(state.flightSetup.sail,true);assert.equal(state.flightSetup.burst,true);assert.equal(state.transferSetup,undefined);
const p=MissionPlanner.preview();assert.ok(p.valid,p.reason);MissionPlanner.launch();Simulation.tick(p.proper);assert.equal(state.current,star.id);assert.equal(state.flightSetup.sail,true);assert.equal(state.flightSetup.burst,true);assert.ok(canBoost('burst'));
state.selected='alpha';const next=MissionPlanner.preview();assert.ok(next.valid,next.reason);
console.log('PASS galaxy → find star after selecting another target → engine transfer → restored stellar departure; no teleport, free fuel or clock jump');
state=initial();state.current='bode';state.ship=Space.point(object('bode').p3);state.selected='alpha';state.matter=0;state.flightSetup=FlightSetup.normalize({sail:true,burst:true,collector:true});findDepartureStar();assert.ok(object(state.selected).kind==='star');assert.equal(state.matter,0);assert.equal(state.current,'bode');assert.equal(MissionPlanner.preview().valid,false);
console.log('PASS empty-tank search still finds a star without enabling a physically impossible launch');
const cluster=object('opengc-ngc6405'),nebula=object('opengc-ngc6302');assert.notEqual(cluster.id,nebula.id);assert.equal(cluster.kind,'cluster');assert.equal(nebula.kind,'nebula');assert.ok(cluster.aliases.some(a=>/Butterfly Cluster/.test(a)));assert.ok(nebula.aliases.some(a=>/Butterfly Nebula/.test(a)));
assert.equal(OBJECTS.filter(o=>o.ngc==='NGC6405').length,1);assert.equal(OBJECTS.filter(o=>o.ngc==='NGC6302').length,1);
console.log('PASS M6/NGC6405 and NGC6302 have distinct identities and types; original catalogue aliases retained');
}`);
