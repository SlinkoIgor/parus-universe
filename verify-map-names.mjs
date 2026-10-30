import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';

const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const index=JSON.parse(fs.readFileSync(catalogPath('search.json'))),files=new Map();
const ids=['ungc-pegasus','ungc-tucana'];
const numbered=['star','galaxy','pulsar','cluster','nebula'].map(kind=>index.find(r=>r[2]===kind&&!r[7]&&/[0-9]/.test(r[1]))?.[0]).filter(Boolean);
context.nameSourceRows=[...ids,...numbered].map(id=>{
 const entry=index.find(r=>r[0]===id);assert.ok(entry,id);
 if(!files.has(entry[5]))files.set(entry[5],JSON.parse(fs.readFileSync(catalogPath(entry[5]))));
 return files.get(entry[5]).find(r=>r[0]===id);
});

run(`{
 const originals=[...OBJECTS],snapshot=JSON.stringify(nameSourceRows),samples=nameSourceRows.map(r=>ExtendedCatalog.decode(r));
 for(const kind of ['star','pulsar','blackhole','quasar','galaxy','cluster','nebula','structure']){
  const o={kind,name:'NGC 1234',aliases:['HIP 123','SDSS J1234']};assert.equal(MapDetails.mapLabelName(o),null);
 }
 for(const id of ['sol','polaris','orion','andromeda','omega','coma'])assert.ok(MapDetails.mapLabelName(object(id)),id+' has a proper name');
 assert.equal(MapDetails.mapLabelName(object('andromeda')),'Андромеда','catalogue suffix does not hide a proper name');
 assert.equal(MapDetails.mapLabelName(object('cfa')),object('cfa').name,'a descriptive wall name keeps its survey qualifier');
 assert.equal(MapDetails.mapLabelName({kind:'structure',cosmicSubtype:'filament',name:'Филамент SDSS · 123'}),null,'a generic prefix before a catalogue number is not a proper name');
 for(const hostFlag of ['galaxyMember','bulkGalaxyMember'])assert.equal(MapDetails.mapLabelName({name:'OGLE 123',aliases:['Андромеда'],[hostFlag]:true}),null,'a host alias never names its individual members');
 assert.equal(MapDetails.mapLabelName({name:'Неизвестная звезда',synthetic:true}),null);
 const renamed={name:'NGC 123',aliases:[]};assert.equal(MapDetails.mapLabelName(renamed),null);renamed.aliases=['Pegasus'];assert.equal(MapDetails.mapLabelName(renamed),'Pegasus');renamed.name='Tucana';assert.equal(MapDetails.mapLabelName(renamed),'Tucana','name cache follows record updates');

 state=initial();state.expansion=false;Cosmology.sync(state);state.selected=null;state.current=null;MapLayers.active=false;
 OBJECTS.splice(0,OBJECTS.length);ExtendedCatalog.pinned.clear();MapLayers.visible=[];MapLayers.visibleMap.clear();
 const textCalls=[],originalFillText=ctx.fillText;ctx.fillText=value=>textCalls.push(String(value));
 for(const mode of ['dark','light'])for(const o of samples){
  theme=mode;filter='all';width=1440;height=1000;const p=MapLayout.project(o);cam={x:p.x,y:p.y,span:MapDetails.maxSpan(o)*.5};
  ExtendedCatalog.visible=[o];ExtendedCatalog.visibleMap=new Map([[o.id,o]]);textCalls.length=0;
  MapLabels.begin();RegionMap.hits=[];drawObjects();ExtendedCatalog.draw();MapLabels.draw();
  assert.ok(hitObjects.some(h=>h.o.id===o.id),'source marker remains clickable: '+o.id);
  const name=MapDetails.mapLabelName(o),placed=MapLabels.placed.some(q=>q.key==='object-'+o.id);
  assert.equal(placed,name!==null,o.id+' follows the same naming policy in the normal range');
  if(name)assert.ok(textCalls.includes(name));else assert.equal(textCalls.length,0,'no orphan distance/type for a numbered object');
  if(['ungc-pegasus','ungc-tucana'].includes(o.id))assert.ok(ExtendedCatalog.background(o),'real named background galaxies retain labels');
  filter=o.kind==='star'?'galaxy':'star';textCalls.length=0;MapLabels.begin();drawObjects();ExtendedCatalog.draw();MapLabels.draw();assert.equal(textCalls.length,0,'a name cannot bypass the category filter');
 }
 ctx.fillText=originalFillText;
 console.log('PASS proper names across classes, real Pegasus/Tucana background captions, numeric source markers without text, host aliases, filters, both themes and cache updates');

 filter='all';width=1440;height=1000;const pegasus=samples[0],p={x:500,y:300};
 const title=MapDetails.mapLabelName(pegasus),longDetail='LONG DISTANCE '.repeat(30);
 textCalls.length=0;ctx.fillText=value=>textCalls.push(String(value));MapLabels.begin();
 MapLabels.point({key:'object-'+pegasus.id,object:pegasus,name:title,detail:longDetail,p});MapLabels.draw();
 assert.ok(textCalls.includes('Pegasus'),'a long secondary line cannot hide a fitting proper name');assert.ok(!textCalls.includes(longDetail));
 const placed=MapLabels.placed.find(q=>q.key==='object-'+pegasus.id);assert.ok(placed);assert.equal(placed.h,20);assert.equal(placed.x,p.x+15,'title fallback keeps the same anchor');
 textCalls.length=0;MapLabels.begin();MapLabels.boxes.push({...placed});MapLabels.point({key:'object-'+pegasus.id,object:pegasus,name:title,detail:longDetail,p});MapLabels.draw();assert.equal(textCalls.length,0,'an occupied name position stays hidden');ctx.fillText=originalFillText;

 OBJECTS.splice(0,OBJECTS.length,...originals);ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
 state=initial();state.selected=pegasus.id;ExtendedCatalog.pin(pegasus);ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),p3=JSON.stringify(pegasus.p3);state=restore(saved);assert.equal(state.selected,pegasus.id);assert.equal(JSON.stringify(object(pegasus.id).p3),p3);
 assert.equal(JSON.stringify(nameSourceRows),snapshot,'caption policy never changes catalogue source rows');
 console.log('PASS name-only fallback, fixed anchor and collision protection; catalogue and selected Pegasus physical coordinates survive unchanged');
}`);
