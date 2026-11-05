import fs from 'node:fs';
import vm from 'node:vm';
// Catalogue build/audit tools load map metadata without a browser.
vm.runInNewContext(fs.readFileSync('dist/map-details.js','utf8'),{OBJECTS:[]});
console.log('PASS map metadata loads in catalogue tools without a browser DOM');
// Isolate these mutations from the physics and map regressions.
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] +
  '\nexport {context,run};\n// Runtime performance regression context';
const { run } = await import('data:text/javascript,' + encodeURIComponent(harness));

run(`{
  for(const d of [0,1,2,3,6,14])for(const n of [0,-0,NaN,Infinity,-Infinity,-1234.56789,1e-12,.99999999999999,13.8e9]){
    assert.equal(fmt(n,d),Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}));
  }
  theme='dark';assert.equal(paint('#424242'),'#bdbdbd');assert.equal(paint('#aaa'),'#555555');
  assert.equal(paint('rgba(37,38,32,0.5)'),'rgba(218,218,218,0.5)');
  theme='light';assert.equal(paint('#424242'),'#424242');theme='dark';assert.equal(paint('#424242'),'#bdbdbd');
  for(let i=0;i<1000;i++)paint('#'+i.toString(16).padStart(6,'0'));
  assert.ok(darkInk.size<=128,'color cache stays bounded');
  const measure=ctx.measureText;let calls=0;
  ctx.measureText=value=>{calls++;return measure(value);};MapLabels.metrics.clear();
  const font='10px "Golos Text",Arial,sans-serif',value=MapLabels.measure('Ковчег',font);
  for(let i=0;i<100;i++)assert.equal(MapLabels.measure('Ковчег',font),value);
  assert.equal(calls,1,'fixed names do not remeasure every frame');
  MapLabels.measure('Ковчег','12px "Golos Text",Arial,sans-serif');assert.equal(calls,2,'font size has separate metrics');
  for(let i=0;i<10000;i++)MapLabels.measure('Полёт '+i,font);
  assert.ok(MapLabels.metrics.size<=2048,'changing flight captions cannot grow the text cache forever');
  ctx.measureText=measure;
  console.log('PASS unchanged number formatting, theme switching and bounded text/color caches');
}`);

run(`{
  state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
  width=1440;height=1000;cam={x:0,y:0,span:24};MapSlice.mode='full';filter='all';
  const sol=object('sol');
  const bg={id:'background-performance',kind:'star',name:'HYG 123456',aliases:[],p3:[0,0,0],mapPosition:{x:0,y:0},
    streamed:true,bulkGalaxyMember:true,galaxyMember:false,massSolar:null,gravity:null,facts:{mass:'Нет индивидуальной оценки.'}};
  const scientific=JSON.stringify(bg);
  OBJECTS.splice(0,OBJECTS.length,sol);ExtendedCatalog.visible=[bg,bg];ExtendedCatalog.pinned.clear();
  ExtendedCatalog.pinned.set(bg.id,bg);MapLayers.active=false;MapLayers.visible=[bg];
  const draw=()=>{hitObjects=[];MapLabels.begin();ExtendedCatalog.draw();return hitObjects.map(h=>h.o.id);};
  assert.deepEqual(draw(),[],'unnamed legacy background respects the foreground guard');
  bg.name='Надежда';assert.deepEqual(draw(),[bg.id],'named background survives overlap and is deduplicated');bg.name='HYG 123456';
  globalThis.MapVisibility={active:true,limit(){return Infinity;},overviewPoint(){return false;}};
  const visible=MapDetails.visible;let foregroundChecks=0;
  MapDetails.visible=function(o,...args){if(o===sol)foregroundChecks++;return visible.call(this,o,...args);};
  assert.deepEqual(draw(),[bg.id],'fixed hierarchy retains its already admitted background point');
  assert.equal(foregroundChecks,0,'fixed hierarchy skips the unused foreground grid');
  state.selected=bg.id;assert.deepEqual(draw(),[],'selection belongs to the foreground pass');state.selected='sol';
  state.current=bg.id;assert.deepEqual(draw(),[],'station belongs to the foreground pass');state.current='sol';
  ExtendedCatalog.pinned.clear();ExtendedCatalog.transitions.set(bg.id,{alpha:0});
  assert.deepEqual(draw(),[],'newly loaded invisible points cannot be picked');
  ExtendedCatalog.transitions.set(bg.id,{alpha:.5});assert.deepEqual(draw(),[bg.id],'fading points remain clickable once visible');
  filter='blackhole';assert.deepEqual(draw(),[],'class filtering removes background hits');
  assert.equal(JSON.stringify(bg),scientific,'rendering preserves source coordinates and properties');
  MapDetails.visible=visible;
  console.log('PASS legacy overlap, fixed visibility, foreground exclusion, deduplication, fade, filter and unchanged source data');
}`);
