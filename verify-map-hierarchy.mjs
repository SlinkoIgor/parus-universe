import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';

const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\n// Isolated hierarchy regression context.\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const boot=run('MAP_LAYER_BOOT');
const layers=new Map();
for(const n of boot.nodes)if(n.file)for(const row of JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file)))layers.set(row[0],row);
assert.deepEqual(JSON.parse(JSON.stringify(boot.counts)),{filament:15421,'galaxy-cluster':2161,nebula:250,'stellar-cluster':4094,supercluster:1313,void:635});
// Compare every complete-layer row against its independent canonical leaf.
const manifest=JSON.parse(fs.readFileSync(catalogPath('manifest.json')));let matched=0;
for(const n of manifest.nodes)if(!n.children.length)for(const row of JSON.parse(fs.readFileSync(catalogPath(n.file))))if(layers.has(row[0])){assert.deepEqual(layers.get(row[0]),row);matched++;}
assert.equal(matched,layers.size);
console.log('PASS complete structural census, all 15421 observed spines and exact source rows; no coordinate/catalog mutations');

context.labelSourceRows=[...layers.values()].filter(r=>r[11].catalogClass==='galaxy-cluster'||r[11].cosmicSubtype==='filament');
run(`{
 const snapshot=JSON.stringify(labelSourceRows),objects=labelSourceRows.map(r=>ExtendedCatalog.decode(r));
 const filaments=objects.filter(o=>o.cosmicSubtype==='filament'),clusters=objects.filter(o=>o.catalogClass==='galaxy-cluster');
 assert.equal(filaments.length,15421);assert.ok(filaments.every(o=>MapDetails.mapLabelName(o)===null));
 const named=clusters.map(o=>MapDetails.mapLabelName(o)).filter(Boolean).sort();
 assert.equal(named.join('|'),['Cygnus A','FORNAX','Her A','Ophiuchus','Pegasus II','Triangulum Australis'].sort().join('|'),'retain sourced proper aliases instead of the MCXC identifier');
 for(const id of ['virgo','coma'])assert.equal(MapDetails.mapLabelName(object(id)),object(id).name);
 for(const name of ['Abell 2744','Скопление галактик 123','SDSS filament 6656','Tempel filament 6656'])assert.equal(MapDetails.mapLabelName({kind:'cluster',catalogClass:'galaxy-cluster',name}),null);
 assert.equal(MapDetails.mapLabelName({kind:'structure',cosmicSubtype:'filament',name:'Нить в Волосах Вероники'}),'Нить в Волосах Вероники');
 assert.equal(MapDetails.mapLabelName({kind:'cluster',catalogClass:'stellar-cluster',name:'HSC 2515'}),null,'numbered stellar clusters follow the same policy');
 assert.equal(JSON.stringify(labelSourceRows),snapshot,'display names never mutate catalogue rows');
}`);

const sourceFiles=new Map();
for(const n of boot.nodes)if(n.file)sourceFiles.set(n.file,JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file)));
context.loadLayers=file=>sourceFiles.get(file);
run(`
state=initial();state.expansion=false;Cosmology.sync(state);filter='all';width=1280;height=720;MapLayers.active=true;
// Disk-fed cache uses the exact same runtime spatial query; network races are
// exercised separately below. No representative cut is supplied to rendering.
function settleLayers(){MapLayers.lastUpdate=-Infinity;for(const files of MapLayers.filesForView(cam,width,height).values())for(const file of files)if(!MapLayers.cache.has(file))MapLayers.cache.set(file,loadLayers(file).map(r=>ExtendedCatalog.decode(r)));MapLayers.update(performance.now());}
`);
const filaments=[...layers.values()].filter(r=>r[11].cosmicSubtype==='filament');
// Independent segment/rectangle intersection, without runtime simplification.
function crosses(a,b,box){
 const inside=p=>p[0]>=box[0]&&p[0]<=box[2]&&p[1]>=box[1]&&p[1]<=box[3];
 if(inside(a)||inside(b))return true;
 const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const corners=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]];
 return corners.some((c,i)=>{const d=corners[(i+1)%4];return Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.min(a[0],b[0])<=Math.max(c[0],d[0])&&Math.max(a[1],b[1])>=Math.min(c[1],d[1])&&Math.min(a[1],b[1])<=Math.max(c[1],d[1])&&orient(a,b,c)*orient(a,b,d)<=0&&orient(c,d,a)*orient(c,d,b)<=0;});
}
const summaries=[];
for(const [center,span] of [['sol',6.95e8],['sol',7e8],['coma',1e8],['sol',1.49e9]]){
 context.probeCenter=center;context.probeSpan=span;
 const view=run(`{const p=MapLayout.project(object(probeCenter));cam={x:p.x,y:p.y,span:probeSpan};settleLayers();MapLabels.begin();RegionMap.draw();}({...cam})`);
 const hits=new Set(run('RegionMap.hits.filter(h=>h.o.cosmicSubtype==="filament").map(h=>h.o.id)'));
 const px=span/1280,box=[view.x-.43*span+px,view.y-360*px+px,view.x+.57*span-px,view.y+360*px-px];
 const expected=filaments.filter(r=>{const p=r[11].regionData.points.map(([x,y])=>[r[12]+x,r[13]+y]);return p.slice(1).some((b,i)=>crosses(p[i],b,box));});
 for(const row of expected)assert.ok(hits.has(row[0]),row[0]+' missing at '+center+' '+span);
 summaries.push({center,span,visible:expected.length});
 if(center==='coma')assert.ok(expected.length>100,'Coma surroundings retain the published network');
 if(span===7e8)assert.ok(hits.has('sdss-filament-6656'),'the old 0.7% reverse-zoom regression');
}
console.log('PASS every source spine crossing viewport, including offscreen anchors, Coma and small zoom changes:',summaries);

run(`
// All stellar clusters/nebulae load before ordinary stars, and all spines and
// galaxy clusters load before ordinary galaxies. Filters have their own files.
MapLayers.ready.clear();filter='all';cam={x:0,y:0,span:1000};assert.equal(MapLayers.admits(object('alpha')),false);assert.equal(MapLayers.admits(object('andromeda')),false);
MapLayers.ready.set('stellar-cluster',true);MapLayers.ready.set('nebula',true);assert.equal(MapLayers.admits(object('alpha')),true);
MapLayers.ready.set('filament',true);MapLayers.ready.set('galaxy-cluster',true);assert.equal(MapLayers.admits(object('andromeda')),true);
filter='galaxy';assert.equal(MapLayers.admits(object('andromeda')),true,'explicit class filter has no hidden competitors');
filter='stellar-cluster';cam={x:0,y:0,span:130000};var files=MapLayers.filesForView(cam,width,height);assert.ok(files.get('stellar-cluster').length);for(const [category,rows] of files)if(category!=='stellar-cluster')assert.equal(rows.length,0);
filter='all';settleLayers();assert.equal(MapLayers.visible.filter(o=>MapDetails.group(o)==='stellar-cluster').length,4094);
MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();var clusterHits=new Set([...hitObjects.map(h=>h.o.id),...RegionMap.hits.map(h=>h.o.id)]);
for(const o of MapLayers.visible.filter(o=>MapDetails.group(o)==='stellar-cluster')){const p=screen(o);if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)assert.ok(clusterHits.has(o.id),'nearby symbols cannot drop complete clusters: '+o.id);}
assert.equal(MapDetails.visible({kind:'star'},2000),false);assert.equal(MapDetails.visible({kind:'pulsar'},2000),false);assert.equal(MapDetails.visible({kind:'cluster'},130000),true);assert.equal(MapDetails.visible({kind:'cluster'},300000),false);
assert.equal(MapDetails.visible({kind:'galaxy',d:1e12},3e8),false);assert.equal(MapDetails.visible({kind:'cluster',catalogClass:'galaxy-cluster'},3e8),true);assert.equal(MapDetails.visible({kind:'structure',cosmicSubtype:'filament'},1.4e11),false);
// Tiny and very large spines keep their visible segments. No point fallback,
// closed polygon, or hit-test connection across clipped-out portions.
const small={shape:'polyline',points:[[0,0],[1,1],[2,0]],major:4,minor:2};assert.deepEqual(RegionMap.curve(small,.01).map(p=>[p.x,p.y]),[[0,0],[2,0]]);assert.equal(RegionMap.asPoint({region:small}),false);
assert.equal(RegionMap.clip({x:-10,y:-20},{x:20,y:-20}),null);assert.ok(RegionMap.clip({x:-1e20,y:100},{x:1e20,y:100}));
// Coarse layer labels win conflicts with even an extremely massive star.
MapLabels.begin();MapLabels.add({key:'star-test',name:'STAR',level:0,mass:1e12,priority:100,candidates:[{x:550,y:300}]});MapLabels.add({key:'cluster-test',name:'CLUSTER',level:1,mass:null,priority:20,candidates:[{x:550,y:300}]});MapLabels.draw();assert.ok(MapLabels.placed.some(q=>q.key==='cluster-test'));assert.ok(!MapLabels.placed.some(q=>q.key==='star-test'));
// Draw cache preserves contours, labels and the same click targets.
filter='all';cam={x:0,y:0,span:7e8};settleLayers();MapLabels.begin();RegionMap.draw();var first=RegionMap.hits.map(h=>h.o.id).join('|');MapLabels.begin();RegionMap.draw();assert.equal(RegionMap.hits.map(h=>h.o.id).join('|'),first);assert.ok(RegionMap.renderCache.canvas);
var selected=RegionMap.hits.find(h=>h.o.cosmicSubtype==='filament').o;ExtendedCatalog.pin(selected);state.selected=selected.id;ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,selected.id);assert.ok(object(selected.id).p3.every(Number.isFinite));
// The ruler, rather than the full map width in light-years, defines the new
// boundary. Cached/selected spines and explicit filters cannot bypass it.
for(const mode of ['dark','light'])for(const viewport of [390,900,1280,1920])for(const category of ['all','structure']){
 theme=mode;filter=category;width=viewport;height=720;
 const boundary=150e6*viewport/128;
 cam={x:0,y:0,span:boundary*.999};settleLayers();MapLabels.begin();RegionMap.draw();
 assert.equal(gridMetrics().unit,1e8);assert.ok(RegionMap.hits.some(h=>h.o.cosmicSubtype==='filament'),'full network remains at the 100 million ruler');
 for(const span of [boundary,boundary*1.001,boundary*4,1.15e11]){
  cam.span=span;assert.ok(gridMetrics().unit>=2e8);assert.equal(MapLayers.enabled('filament'),false);
  assert.equal(MapLayers.filesForView(cam,width,height).get('filament').length,0,'hidden layer requests no tiles');
  MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
  assert.ok(!RegionMap.hits.some(h=>h.o.cosmicSubtype==='filament'),'no cached contour/hit zone');
  assert.ok(!hitObjects.some(h=>h.o.cosmicSubtype==='filament'),'no point or sparse landmark fallback');
  assert.ok(!MapLabels.queue.some(q=>q.key==='region-'+selected.id));
  assert.ok(!/нити/i.test(MapLayers.readout()));assert.equal(state.selected,selected.id);
 }
 cam.span=boundary*.999;settleLayers();MapLabels.begin();RegionMap.draw();assert.ok(RegionMap.hits.some(h=>h.o.cosmicSubtype==='filament'),'zooming in restores the full layer');
}
// Querying another viewport must use the supplied dimensions, even before resize.
filter='all';width=1280;cam={x:0,y:0,span:7e8};
assert.ok(MapLayers.filesForView(cam,1280,720).get('filament').length);assert.equal(MapLayers.filesForView(cam,390,720).get('filament').length,0);
// Observe actual canvas text and hit targets over the real Coma network. Hiding
// catalogue captions must not remove any spine, cluster symbol or selected card.
for(const mode of ['dark','light']){
 theme=mode;width=1440;height=1000;filter='all';const center=MapLayout.project(object('coma'));cam={x:center.x,y:center.y,span:1e8};settleLayers();
 const textCalls=[],originalFillText=ctx.fillText;ctx.fillText=value=>textCalls.push(String(value));
 MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();ctx.fillText=originalFillText;
 assert.ok(textCalls.includes('СКОПЛЕНИЕ ВОЛОС ВЕРОНИКИ'),'proper cluster name remains visible');
 assert.ok(!textCalls.some(s=>/MCXC|ФИЛАМЕНТ SDSS|ОСЬ ПО КАТАЛОГУ SDSS/i.test(s)),'no numeric title or orphan detail line reaches the canvas');
 assert.ok(RegionMap.hits.some(h=>h.o.cosmicSubtype==='filament'&&h.label===null));
 const target=MapLayers.visible.find(o=>o.catalogClass==='galaxy-cluster'&&MapDetails.mapLabelName(o)===null&&screen(o).x>100&&screen(o).x<width-350&&screen(o).y>150&&screen(o).y<height-100);
 assert.ok(target);ExtendedCatalog.pin(target);state.selected=target.id;
 MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
 assert.ok(hitObjects.some(h=>h.o.id===target.id)||RegionMap.hits.some(h=>h.o.id===target.id),'numbered selected cluster remains clickable');
 assert.ok(!MapLabels.placed.some(q=>q.key==='object-'+target.id||q.key==='region-'+target.id));
 showObject(target.id);assert.ok($('dialogContent').innerHTML.includes(target.name),'identifier remains available in the card');$('infoDialog').close();
}
`);
console.log('PASS class boundaries, full Milky Way cluster layer, category filters, coarse labels, subpixel curves, clipping, cached hits and selected-spine reload; 200 million ruler cutoff; only proper cluster/filament names reach canvas, sourced aliases and click targets preserved');

// Late network replies populate only the cache, never an obsolete visible cut.
await run(`(async()=>{
const originalRead=ExtendedCatalog.readJSON,originalFiles=MapLayers.filesForView;
MapLayers.cache.clear();MapLayers.inflight.clear();MapLayers.slices.clear();MapLayers.visible=[];MapLayers.visibleMap.clear();MapLayers.lastUpdate=-Infinity;
const pending=new Map();ExtendedCatalog.readJSON=path=>new Promise(resolve=>pending.set(path.split('/').at(-1),resolve));
let files=['old'];MapLayers.filesForView=()=>new Map([['filament',files]]);MapLayers.update(10000);files=['new'];MapLayers.lastUpdate=-Infinity;MapLayers.update(10200);
const row=loadLayers(Object.values(MAP_LAYER_BOOT.nodes).find(n=>n.category==='filament'&&n.file).file)[0];
pending.get('new')([row]);await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();MapLayers.lastUpdate=-Infinity;MapLayers.update(11000);assert.ok(MapLayers.visibleMap.has(row[0]));
pending.get('old')([]);await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();MapLayers.lastUpdate=-Infinity;MapLayers.update(12000);assert.ok(MapLayers.visibleMap.has(row[0]));assert.ok(MapLayers.inflight.size+ExtendedCatalog.inflight.size<=4);
ExtendedCatalog.readJSON=originalRead;MapLayers.filesForView=originalFiles;MapLayers.active=false;
})()`);
console.log('PASS stale structural downloads cannot replace current complete layers; shared request limit preserved');
