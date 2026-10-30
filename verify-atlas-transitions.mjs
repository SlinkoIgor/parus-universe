import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
context.testHTML=fs.readFileSync('dist/index.html','utf8');
await run(`(async()=>{
state=initial();Cosmology.sync(state);resize();
const originalObjects=OBJECTS.slice(),originalGalaxies=GALAXIES.slice(),originalCache=ExtendedCatalog.cache;
const samples=['star','pulsar','blackhole','quasar','nebula','galaxy','cluster','cluster','wall','void','ring','arc','horizon'].map((kind,i)=>({id:'filter-probe-'+i,name:'Probe '+i,kind,streamed:true,d:1000,p3:[-330+i*50,80,0],mapPosition:{x:-330+i*50,y:80},navigable:true,facts:{mass:'Нет индивидуальной оценки',class:i===7?'Скопление галактик':''},type:i===7?'СКОПЛЕНИЕ ГАЛАКТИК':'ЗВЁЗДНОЕ СКОПЛЕНИЕ'}));
OBJECTS.splice(0,OBJECTS.length);GALAXIES.splice(0,GALAXIES.length);ExtendedCatalog.visible=samples;ExtendedCatalog.pinned.clear();ExtendedCatalog.pinned.set(samples[0].id,samples[0]);ExtendedCatalog.pinned.set(samples[1].id,samples[1]);cam={x:0,y:0,span:1000};
for(const [f,expected] of [['star',[0]],['pulsar',[1]],['blackhole',[2]],['quasar',[3]],['nebula',[4]],['galaxy',[5]],['stellar-cluster',[6]],['galaxy-cluster',[7]],['structure',[8,10,11]],['void',[9]],['horizon',[12]],['all',samples.map((_,i)=>i)]]){
 filter=f;state.current=samples[0].id;state.selected=samples[1].id;MapLabels.begin();drawObjects();ExtendedCatalog.draw();
 const ids=new Set(hitObjects.map(h=>h.o.id));assert.deepEqual([...ids].sort(),expected.map(i=>samples[i].id).sort(),'foreground, selected/current and streamed map filter '+f);
 assert.equal(state.selected,samples[1].id,'filter changes display, not navigation');
}
OBJECTS.splice(0,OBJECTS.length,...originalObjects);GALAXIES.splice(0,GALAXIES.length,...originalGalaxies);ExtendedCatalog.visible=[];ExtendedCatalog.pinned.clear();
for(const f of ['star','pulsar','blackhole','quasar','galaxy','stellar-cluster','galaxy-cluster','structure','void']){
 filter=f;cam={x:0,y:0,span:7e8};MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();ExtendedCatalog.draw();
 assert.ok(hitObjects.every(h=>ExtendedCatalog.matchesMap(h.o)));assert.ok(RegionMap.hits.every(h=>ExtendedCatalog.matchesMap(h.o)));
 if(f!=='galaxy')assert.ok(!MapLabels.queue.some(q=>q.key.startsWith('galaxy-')));
}
filter='all';ExtendedCatalog.transitions.clear();ExtendedCatalog.cache=new Map();
const a=samples[0],b=samples[1],c=samples[2];ExtendedCatalog.adoptCut([a,b],0);ExtendedCatalog.advanceVisibility(1000);assert.equal(ExtendedCatalog.transitions.get(a.id).alpha,1);
ExtendedCatalog.adoptCut([a,c],1000);assert.equal(ExtendedCatalog.transitions.get(a.id).alpha,1,'shared representative never blinks');assert.equal(ExtendedCatalog.transitions.get(b.id).alpha,1,'old point retained');assert.equal(ExtendedCatalog.transitions.get(c.id).alpha,0,'new point fades in');
ExtendedCatalog.advanceVisibility(1250);const oldAlpha=ExtendedCatalog.transitions.get(b.id).alpha;assert.ok(oldAlpha>0&&oldAlpha<1);assert.ok(ExtendedCatalog.transitions.get(c.id).alpha>0&&ExtendedCatalog.transitions.get(c.id).alpha<1);
ExtendedCatalog.adoptCut([a,b],1250);assert.equal(ExtendedCatalog.transitions.get(b.id).alpha,oldAlpha,'reverse zoom starts from current opacity');ExtendedCatalog.advanceVisibility(2500);assert.equal(ExtendedCatalog.transitions.get(b.id).alpha,1);assert.ok(!ExtendedCatalog.transitions.has(c.id));assert.ok(new Set(samples.map(o=>ExtendedCatalog.stagger(o.id))).size>6,'fade order is distributed among objects');
// Network completion is independent of camera order. A late obsolete request
// must never replace the complete current cut or blank its existing points.
ExtendedCatalog.adoptCut([c],2600);ExtendedCatalog.adoptCut([a],2600);ExtendedCatalog.advanceVisibility(3600);assert.ok(!ExtendedCatalog.transitions.has(c.id),'a point reversed before its fade-in must still be collected');
const originalRead=ExtendedCatalog.readJSON,originalNodes=ExtendedCatalog.nodesForView;
const pending=new Map();ExtendedCatalog.readJSON=path=>new Promise(resolve=>pending.set(path.replace('catalog-data/',''),resolve));
let desired=['ready'];ExtendedCatalog.nodesForView=()=>desired;ExtendedCatalog.manifest={};ExtendedCatalog.cache.set('ready',[a,b]);ExtendedCatalog.cutKey=null;ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.update(3000);ExtendedCatalog.update(4000);
const encode=o=>[o.id,o.name,o.kind,100,20,30,'catalog','test',[],1,'HYG',{},o.mapPosition.x,o.mapPosition.y];
desired=['late'];ExtendedCatalog.update(5000);assert.ok(ExtendedCatalog.visibleMap.has(b.id),'hold loaded cut while waiting');
desired=['new'];ExtendedCatalog.update(5200);pending.get('new')([encode(c)]);await Promise.resolve();await Promise.resolve();await Promise.resolve();ExtendedCatalog.update(5500);ExtendedCatalog.advanceVisibility(6500);assert.ok(ExtendedCatalog.visibleMap.has(c.id));
pending.get('late')([encode(samples[3])]);await Promise.resolve();await Promise.resolve();await Promise.resolve();ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.update(7000);assert.ok(ExtendedCatalog.visibleMap.has(c.id));assert.ok(!ExtendedCatalog.visibleMap.has(samples[3].id),'stale download cannot become visible');
ExtendedCatalog.readJSON=originalRead;ExtendedCatalog.nodesForView=originalNodes;ExtendedCatalog.manifest=null;ExtendedCatalog.cache=originalCache;ExtendedCatalog.transitions.clear();ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
state=initial();Cosmology.sync(state);width=390;cam.span=1.15e11;renderReachability();assert.equal($('reachReadout').hidden,false);assert.ok($('reachReadout').textContent.includes('Свет ·'));cam.span=24;renderReachability();assert.equal($('reachReadout').hidden,true);
const html=globalThis.testHTML;assert.ok(!html.includes('class="scale-picker"'));assert.ok(!html.includes('data-scale='));
console.log('PASS all atlas categories across foreground/background/regions/galaxies; navigation retained; per-object fades, reverse zoom, retained cut and stale-response immunity');
})()`);
