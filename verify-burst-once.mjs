import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled = true;
const message = 'Вы уже взорвали эту звезду. Здесь только звёздный остаток.';
const reset = id => {
 state = initial(); state.expansion = false; state.current = id;
 state.ship = Space.point(object(id).p3); state.selected = 'sgr';
 state.flightSetup = {...FlightSetup.defaults(), burst:true};
 paused = true; FlightQueue.reset(); Simulation.debt = Simulation.wallDebt = 0; Cosmology.sync(state);
};
const finish = () => { for(let i=0;state.flight&&i<6;i++) Simulation.tick(FlightEstimate.get().proper * 1.00001); assert.equal(state.flight,null); };
const blocked = fn => { const before=JSON.stringify(state); fn(); assert.equal(JSON.stringify(state),before,'a refused flash cannot change fuel, clocks, history, preferences or queue'); };
for (const id of ['alpha','proxima']) {
 reset(id);
 const setup = FlightSetup.preferred(), prepared = MissionPlanner.preview();
 assert.ok(prepared.valid, prepared.reason); assert.ok(MissionPlanner.burstScheduled(prepared));
 MissionPlanner.launch(prepared);
 const b = prepared.acceleration.preboost;
 Simulation.tick(b.preparationEnd.proper + 1e-7);
 assert.ok(state.destroyed.includes(id), 'the first actual flash must destroy its source');
 const active = JSON.stringify(state.flight);
 state = restore(JSON.parse(JSON.stringify(state)));
 assert.equal(JSON.stringify(state.flight), active, 'reload preserves the executing flash');

 // Forecast a return to the spent source while its first flight is still running.
 const engine = {...FlightSetup.defaults(), sail:false, collector:false, burst:false};
 FlightQueue.setSetup(id, engine); select(id); Route.add(id);
 assert.equal(Route.future()[0]?.id,id);
 select('sirius');
 const context = FlightQueue.context();
 assert.equal(context.current,id); assert.ok(context.destroyed.includes(id));
 blocked(() => QuickFlight.toggle('burst'));
 assert.ok($('infoDialog').open); assert.ok($('dialogContent').innerHTML.includes(message));
 $('infoDialog').close(); FlightQueue.dismiss();
 // The route really returns to the remnant, without creating another flash.
 finish();
 assert.equal(state.current,id); assert.equal(JSON.stringify(state.destroyed),JSON.stringify([id]));
 assert.ok(Math.abs(state.matter*1000-.5)<1e-9);
 ExtendedCatalog.capture(state);
 state = restore(JSON.parse(JSON.stringify(state)));
 assert.equal(state.current,id); assert.equal(JSON.stringify(state.destroyed),JSON.stringify([id]));
 state.selected = 'sirius'; state.flightSetup = setup; FlightSetup.sync(); renderUI();
 assert.ok(!FlightSetup.read().burst && FlightSetup.read().engine);

 blocked(() => QuickFlight.toggle('burst'));
 assert.ok($('infoDialog').open); assert.ok($('dialogContent').innerHTML.includes(message));
 $('infoDialog').close();
 for(const calculate of [
  () => MissionPlanner.plan(setup,object(id),object('sirius')),
  () => MissionPlanner.planPreferred(setup,object(id),object('sirius'),state.matter*1000,state.ship,0,false),
  () => MissionPlanner.preview(setup),
  () => MissionPlanner.passage(setup,object(id),object('sgr'),object('m87'),state.matter*1000,state.ship,0,false),
 ]) blocked(() => { const p=calculate(); assert.equal(p.valid,false); assert.equal(p.reason,message); });
 blocked(() => MissionPlanner.launch(prepared));
 assert.equal($('toast').textContent,message);

 FlightBuilder.open();
 assert.equal($('setupBurst').disabled,true); assert.equal($('burstHelp').textContent,message);
 $('flightBuilder').close();
 // Older non-composed launch commands must reject the same source too.
 OrbitalArrival.enabled=false; const preferred=state.flightSetup; state.flightSetup=null; state.departureMode='burst';
 state.controlG=3;
 blocked(() => launch()); assert.equal($('toast').textContent,message);
 OrbitalArrival.enabled=true; state.flightSetup=preferred; FlightSetup.sync();
 // A spent source remains a valid stop and permits an ordinary engine departure.
 const ordinary=MissionPlanner.preview(); assert.ok(ordinary.valid,ordinary.reason); assert.ok(!ordinary.setup.burst&&!ordinary.setup.sail&&ordinary.setup.engine);
 launch(); assert.ok(state.flight&&!state.flight.mission.setup.burst); finish();
 assert.equal(state.current,'sirius'); assert.equal(JSON.stringify(state.destroyed),JSON.stringify([id]));
}
console.log('PASS two real first flashes, active reload, queued returns, remnant reload, explicit/stale/legacy repeat rejection without state changes, accessible warning and engine departures');

// Generated arrival stars obey the same per-star rule; another star has another ID.
state=initial(); state.expansion=false; FlightQueue.reset();
const source=ExtendedCatalog.revealArrival(object('andromeda'));
state.current=source.id; state.ship=Space.point(source.p3); state.selected='triangulum'; Cosmology.sync(state);
const setup={...FlightSetup.defaults(),burst:true}, prepared=MissionPlanner.preview(setup);
assert.ok(prepared.valid,prepared.reason); MissionPlanner.launch(prepared);
Simulation.tick(prepared.acceleration.preboost.preparationEnd.proper+1e-7);
assert.ok(state.destroyed.includes(source.id));
finish(); state.selected=source.id; state.flightSetup={...setup,sail:false,collector:false,burst:false};
launch(); finish(); assert.equal(state.current,source.id);
ExtendedCatalog.capture(state); state=restore(JSON.parse(JSON.stringify(state))); state.selected='triangulum';
blocked(()=>QuickFlight.toggle('burst')); assert.ok($('dialogContent').innerHTML.includes(message)); $('infoDialog').close();
blocked(()=>MissionPlanner.launch(prepared)); assert.equal($('toast').textContent,message);
assert.equal(JSON.stringify(state.destroyed),JSON.stringify([source.id]));
console.log('PASS a generated star remains spent on return/reload and cannot reuse its original prepared flash');
}`);
