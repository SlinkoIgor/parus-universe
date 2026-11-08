import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));

run(`{
  const idle=OrbitalArrival.idle;let calls=0;
  OrbitalArrival.idle=function(...args){calls++;return idle.apply(this,args);};
  try{
    for(const rate of [.5,1,1000]){
      state=initial();paused=false;speed=rate;Simulation.wallDebt=0;calls=0;
      Simulation.advance(12*3600,0);
      assert.equal(calls,1,'an idle night is one analytic clock update');
      assert.equal(state.proper,12*3600*rate);assert.equal(state.earth,state.proper);
      assert.equal(state.cosmicTime,state.proper);assert.equal(state.universeElapsed,state.proper);
      assert.equal(Simulation.wallDebt,0);assert.equal(Simulation.wallQueue.length,0);
      const saved=JSON.stringify(state);paused=true;Simulation.advance(24*3600,0);assert.equal(JSON.stringify(state),saved);
    }
  }finally{OrbitalArrival.idle=idle;}
  state=initial();paused=false;speed=10;Simulation.wallDebt=0;
  const body=OrbitalArrival.target(object('sol'));
  state.orbit={targetId:'sol',radius:body.radius,speed:body.speed,beta:body.beta,angle:0,radial:[1,0,0],tangent:[0,1,0]};
  const saved=JSON.parse(JSON.stringify(state));
  for(let i=0;i<600;i++)Simulation.advance(1/60);
  const fine={angle:state.orbit.angle,proper:state.proper,earth:state.earth,ship:[...state.ship.p3]};
  state=restore(saved);Simulation.wallDebt=0;Simulation.advance(10);
  assert.ok(Math.abs(state.orbit.angle-fine.angle)<1e-10);
  assert.ok(Math.abs(state.proper-fine.proper)<1e-9);assert.ok(Math.abs(state.earth-fine.earth)<1e-9);
  assert.ok(Math.hypot(...state.ship.p3.map((v,i)=>v-fine.ship[i]))<1e-12);
  const before=state.proper,fuel=state.matter;Simulation.advance(12*3600,0);
  assert.equal(Simulation.wallDebt,0);assert.equal(state.proper-before,12*3600*speed);
  assert.equal(state.matter,fuel);assert.equal(state.current,'sol');assert.equal(state.beta,body.beta);
  console.log('PASS 12-hour idle catch-up at every tempo, pause, circular orbit, clocks, position and fuel');
}`);

run(`{
  state=initial();paused=false;speed=1;Simulation.wallDebt=0;state.flight={noticeElapsed:0};
  const originalStep=Simulation.step,originalPerformance=performance;let calls=0,clock=0;
  globalThis.performance={now(){return clock+=2;}};
  Simulation.step=years=>{calls++;state.proper+=years;state.earth+=years;return years;};
  try{
    Simulation.advance(10*3600,6);
    assert.ok(calls>0&&calls<=3,'catch-up yields after the work budget');
    assert.ok(Math.abs(state.proper+Simulation.wallDebt-10*3600)<1e-8,'all unprocessed time is retained');
    speed=10;Simulation.advance(2,0);
    assert.equal(Simulation.wallQueue.length,2,'a rate change cannot rescale earlier time');
    Simulation.captureClock(state);const saved=restore(JSON.parse(JSON.stringify(state)));
    Simulation.wallDebt=0;Simulation.wallQueue=[];Simulation.restoreClock(saved);state=saved;
    const pending=JSON.stringify(Simulation.wallQueue);paused=true;Simulation.advance(100,0);
    assert.equal(JSON.stringify(Simulation.wallQueue),pending,'pause retains pending work without adding paused time');
    paused=false;state.flight=null;Simulation.advance(0,0);
    assert.ok(Math.abs(state.proper-(10*3600+2*10))<1e-8,'old and new rates survive reload and drain exactly');
    assert.equal(Simulation.wallDebt,0);Simulation.captureClock(state);assert.equal(state.pendingRealTime,undefined);
    Simulation.restoreClock({pendingRealTime:[null,{seconds:-1,rate:1},{seconds:1,rate:NaN}]});assert.equal(Simulation.wallDebt,0);
    Simulation.restoreClock({});assert.equal(Simulation.wallDebt,0,'older saves need no new field');
  }finally{Simulation.step=originalStep;globalThis.performance=originalPerformance;}
  console.log('PASS bounded flight catch-up, preserved time/rates, pause, reload, malformed and legacy saves');
}`);

run(`{
  state=initial();paused=false;speed=1;Simulation.wallDebt=0;FlightQueue.reset();
  MissionPlanner.launch();const saved=JSON.parse(JSON.stringify(state));assert.ok(state.flight);
  const sample=()=>JSON.stringify([state.proper,state.earth,state.matter,state.beta,state.ship,state.phase,
    state.flight?.missionStage,state.flight?.stageElapsed,state.flight?.noticeElapsed]);
  Simulation.advance(2);const reference=sample();
  state=restore(saved);Simulation.wallDebt=0;Simulation.advance(2,0);
  let frames=0;while(Simulation.wallDebt>1e-12&&frames++<130)Simulation.advance(0,0);
  assert.ok(frames>1&&frames<130);assert.equal(sample(),reference,'yielding preserves the exact physical slice sequence and notice clock');
  console.log('PASS a real flight produces identical physics, fuel, both clocks and tip timing across yielded frames');
}`);

run(`{
  state=initial();state.expansion=false;paused=false;speed=1;Simulation.wallDebt=0;Cosmology.sync(state);
  cameraGoal=null;pointer.down=false;effects=[];Route.feedbackPending=false;document.hidden=false;
  const start=performance.now();lastFrame=start;lastUI=saveTick=start;
  RuntimeLoop.lastInteraction=start-31000;RuntimeLoop.lastDraw=start-1000;
  const grid=drawGrid;let draws=0;drawGrid=()=>{draws++;};
  try{
    for(let i=1;i<=120;i++)frame(start+i*1000/60);
    assert.ok(draws>=17&&draws<=21,'idle map draws at most ten times per second, not every rAF');
    assert.ok(Math.abs(state.proper-2)<1e-9,'render throttling never changes the simulation rate');
    RuntimeLoop.wake();const before=draws;frame(performance.now());assert.equal(draws,before+1,'input wakes the next frame');
    document.hidden=true;frame(lastFrame+1000);assert.equal(draws,before+1,'hidden tabs do not render');document.hidden=false;
    RuntimeLoop.lastInteraction=start-31000;RuntimeLoop.lastDraw=start;state.flight={};paused=false;
    assert.ok(RuntimeLoop.shouldDraw(start+1),'flight keeps full animation');paused=true;
    assert.ok(!RuntimeLoop.shouldDraw(start+1),'a paused flight also saves rendering work');
    cameraGoal={...cam};assert.ok(RuntimeLoop.shouldDraw(start+1),'camera animation stays smooth');cameraGoal=null;
  }finally{drawGrid=grid;document.hidden=false;}
  console.log('PASS idle rendering limit, immediate interaction, active/paused flight, camera animation and hidden tab');
}`);

run(`{
  state=initial();state.cosmicTime=100000;Cosmology.sync(state);Cosmology.cache.clear();
  const rows=OBJECTS.filter(o=>o.p3),baseline=rows.map(o=>Cosmology.group(o));
  const find=OBJECTS.find;let scans=0;MapDetails.beginFrame();
  OBJECTS.find=function(...args){scans++;return find.apply(this,args);};
  try{
    for(let i=0;i<rows.length;i++)assert.deepEqual(Cosmology.group(rows[i]),baseline[i],rows[i].id);
    assert.equal(scans,0,'warm projection uses the frame index for parents, station and virial clusters');
    for(let i=0;i<1000;i++)assert.equal(Cosmology.group(object('sol')),Cosmology.localGroup);
  }finally{OBJECTS.find=find;MapDetails.endFrame();}
  const index=OBJECTS.findIndex(o=>o.id==='sol'),sun=OBJECTS[index];OBJECTS[index]={...sun,name:'Fresh station'};
  try{assert.equal(Cosmology.catalogObject('sol'),OBJECTS[index],'outside a draw replacements stay fresh');}
  finally{OBJECTS[index]=sun;}
  console.log('PASS identical cosmological groups with indexed draw lookups, reused local frame and fresh external lookups');
}`);
