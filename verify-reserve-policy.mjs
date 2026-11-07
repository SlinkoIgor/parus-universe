import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled = true;
const reset = () => {
 state = initial(); state.expansion = false; paused = true; FlightQueue.reset();
 MissionPlanner.cache.clear(); MissionPlanner.fuelLimitCache.clear();
 QuickFlight.reserveNoticeKey = null; Simulation.debt = Simulation.wallDebt = 0; Cosmology.sync(state);
};
// Test the policy boundary independently of numerical trajectory tolerances.
const available = MissionPlanner.planAvailableReserve, rawPlan = MissionPlanner.plan;
try {
 const setup = FlightSetup.defaults(), args = [object('proxima'), object('alpha'), .5, Space.point(object('proxima').p3), 123, false, .001, {radius: 123, beta: .001}];
 let slow = {valid:true, proper:999, earth:1000, setup}, fast = {valid:true, proper:10, earth:11, setup:{...setup, arrivalFuelPercent:25}}, calls = 0;
 MissionPlanner.planAvailableReserve = () => slow;
 MissionPlanner.plan = (c, ...received) => { calls++; assert.deepEqual(received.slice(0,args.length), args); assert.equal(received[8],false); assert.deepEqual(received[9],state.destroyed); assert.equal(c.arrivalFuelPercent, 25); return fast; };
 assert.equal(MissionPlanner.planPreferred(setup, ...args), slow, '99.9 times faster is below the threshold');
 slow = {...slow, proper:1000};
 const exact = MissionPlanner.planPreferred(setup, ...args);
 assert.equal(exact.setup.arrivalFuelPercent, 25); assert.equal(exact.reserveComparison.speedup, 100);
 assert.ok(exact.reserveTimeLimited && exact.reserveLimited); assert.equal(exact.requestedArrivalFuelPercent, 50);
 slow = {...slow, proper:1e6, setup:{...setup, arrivalFuelPercent:49.99}, reserveLimited:true};
 assert.ok(MissionPlanner.planPreferred(setup, ...args).reserveTimeLimited, 'compare the attainable fallback near 50% too');
 for (const candidate of [{...fast, valid:false}, {...fast, proper:0}, {...fast, proper:Infinity}]) {
  fast = candidate; assert.equal(MissionPlanner.planPreferred(setup, ...args), slow, 'an unusable alternative never replaces the plan');
 }
 const before = calls;
 for (const percent of [0,25,35,65]) assert.equal(MissionPlanner.planPreferred({...setup, arrivalFuelPercent:percent}, ...args), slow);
 assert.equal(calls, before, 'custom reserves do not trigger the half-tank policy');
 slow = {...slow, valid:false}; assert.equal(MissionPlanner.planPreferred(setup, ...args), slow);
} finally { MissionPlanner.planAvailableReserve = available; MissionPlanner.plan = rawPlan; }
console.log('PASS inclusive 100x boundary, identical physical inputs, near-50% fallback, invalid alternatives and custom reserves');

const limited = percent => ({valid:true, reserveLimited:true, requestedArrivalFuelPercent:50, arrivalFuelKg:percent/100, setup:{capacityKg:1}});
assert.equal(FlightBuilder.reserveNote(limited(49.99)), '', 'rounded equal percentages must not produce a warning');
assert.equal(FlightBuilder.reserveNote(limited(50.000001)), '');
assert.ok(FlightBuilder.reserveNote(limited(49.94)).includes('49,9%'));
assert.ok(FlightBuilder.reserveNote(limited(12.3)).includes('12,3%'));
reset();
const originalToast = toast; let notices = [];
try {
 toast = (text, duration) => notices.push({text, duration});
 const p = {...limited(25), sourceId:'proxima', targetId:'alpha', reserveTimeLimited:true, reserveComparison:{slowProper:1000, fastProper:1, speedup:1000}};
 QuickFlight.notifyReserve(p); QuickFlight.notifyReserve(p); QuickFlight.notifyReserve({...p});
 assert.equal(notices.length, 1, 'repeated UI updates must not restart notifications');
 assert.ok(notices[0].text.includes('50% до 25%') && notices[0].text.includes('торможение'));
 assert.ok(notices[0].duration >= 10000);
 QuickFlight.notifyReserve(limited(49.99)); assert.equal(notices.length, 1);
 QuickFlight.notifyReserve({...p, targetId:'sirius'}); assert.equal(notices.length, 2);
} finally { toast = originalToast; }
console.log('PASS meaningful percentage precision and bottom notifications without repeated announcements');

// Follow the real default first trip, then depart from the actual saved orbit.
reset(); state.selected = 'proxima'; launch();
assert.equal(state.flight.mission.setup.arrivalFuelPercent, 50);
Simulation.tick(state.flight.mission.proper * 1.00001);
assert.equal(state.current, 'proxima'); assert.ok(state.orbit); assert.equal(state.matter * 1000, .5);
state.selected = 'alpha';
const before = JSON.stringify([state.matter, state.ship, state.orbit, state.proper, state.earth, state.flightSetup]);
const p = MissionPlanner.preview();
assert.ok(p.valid, p.reason); assert.ok(p.reserveTimeLimited); assert.equal(p.setup.arrivalFuelPercent, 25);
assert.ok(p.reserveComparison.slowProper >= 100 * p.proper); assert.equal(p.reserveComparison.fastProper, p.proper);
assert.ok(Math.abs(p.arrivalFuelKg - .25) < 1e-8);
assert.equal(JSON.stringify([state.matter, state.ship, state.orbit, state.proper, state.earth, state.flightSetup]), before, 'preview does not change the expedition');
renderUI(); assert.equal($('quickIssue').hidden, true); assert.equal($('quickSpeedRow').hidden, false);
assert.ok($('toast').textContent.includes('50% до 25%')); assert.equal($('infoDialog').open, false);
FlightBuilder.open(); assert.equal(FlightBuilder.draft.arrivalFuelPercent, 25); assert.equal($('setupReserve').value, '25');
FlightBuilder.apply(); assert.equal(FlightSetup.preferred().arrivalFuelPercent, 50, 'adjustment applies to this trip only');
launch(); assert.equal(state.flight.mission.setup.arrivalFuelPercent, 25); assert.ok(state.flight.mission.reserveTimeLimited);
Simulation.tick(state.flight.mission.proper * .2);
const active = JSON.stringify([state.flight, state.matter, state.proper, state.earth, state.ship]);
state = restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify([state.flight, state.matter, state.proper, state.earth, state.ship]), active);
Simulation.tick(FlightEstimate.get().proper * 1.00001);
assert.equal(state.current, 'alpha'); assert.ok(Math.abs(state.matter * 1000 - .25) < 1e-8);
assert.equal(FlightSetup.preferred().arrivalFuelPercent, 50);
console.log('PASS real Sun → Proxima → Alpha, actual departure orbit, coherent builder, exact launch/reload and quarter-tank arrival; ' + p.reserveComparison.slowProper + ' → ' + p.proper + ' onboard years');

reset(); state.current = 'proxima'; state.ship = Space.point(object('proxima').p3); state.selected = 'alpha'; state.matter = .00051;
const ordinary = MissionPlanner.preview();
assert.ok(ordinary.valid, ordinary.reason); assert.equal(ordinary.setup.arrivalFuelPercent, 50); assert.ok(!ordinary.reserveTimeLimited);
assert.ok(Math.abs(ordinary.arrivalFuelKg - .5) < 1e-5);
console.log('PASS attainable half-tank plan kept when reducing the reserve gains less than 100x');
}`);
