import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\n// Class glyph and nebula source regression context.\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const boot=run('MAP_LAYER_BOOT'),tiles=new Map(),rows=[];
for(const n of boot.nodes)if(n.file){const r=JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file));tiles.set(n.file,r);if(n.category==='nebula')rows.push(...r);}
context.nebulaRows=rows;context.readNebulaTile=file=>tiles.get(file);
const ngc=JSON.parse(execFileSync('python3',['-c',"import csv,json; print(json.dumps({r['Name']:[r['MajAx'],r['MinAx']] for r in csv.DictReader(open('data-tools/raw/NGC.csv'),delimiter=';')}))"],{encoding:'utf8'}));
const snr=new Map(fs.readFileSync('data-tools/raw/m33-snr.dat','utf8').trimEnd().split('\n').filter(l=>l.slice(79,82).trim()==='yes').map(l=>['m33-snr-'+l.slice(0,8).trim().toLowerCase(),Number(l.slice(33,36))]));
const core=run('OBJECTS.filter(o=>o.kind==="nebula"&&!o.atlasOnly)'),decoded=run('nebulaRows.map(r=>ExtendedCatalog.decode(r))');
assert.equal(core.length,45);assert.equal(decoded.length,250);
for(const o of core){const source=ngc[o.ngc];assert.ok(source,o.id+' optical source');assert.equal(o.angularMajorArcmin,Number(source[0]));const expected=2*o.d*Math.tan(Number(source[0])*Math.PI/21600);assert.ok(Math.abs(o.region.major/expected-1)<1e-12,o.id+' angular size');assert.match(o.region.note,/Погрешность/);assert.match(o.region.url,/OpenNGC/);}
let measured=0,unknown=0;
for(const o of decoded){
 if(snr.has(o.id)){assert.ok(o.region,o.id+' must use its imported diameter');assert.ok(Math.abs(o.region.major/(snr.get(o.id)*3.2615637771674336)-1)<1e-12);assert.match(o.region.url,/855\/140/);measured++;}
 else{assert.equal(o.catalogType,'HII');assert.equal(o.region,undefined,'no fabricated extent for LGGS spectroscopy without size');assert.equal(o.diameterLy,undefined);unknown++;}
}
assert.equal(measured,178);assert.equal(unknown,72);
// Every new spatial leaf includes measured extents, not just source centres.
for(const n of boot.nodes.filter(n=>n.file&&n.category==='nebula'))for(const r of tiles.get(n.file)){
 context.nebulaToCheck=r;const o=run('ExtendedCatalog.decode(nebulaToCheck)'),rx=(o.region?.major||0)/2,ry=(o.region?.minor||0)/2;
 assert.ok(n.box[0]<=r[12]-rx&&n.box[2]>=r[12]+rx&&n.box[1]<=r[13]-ry&&n.box[3]>=r[13]+ry,r[0]+' extent outside spatial index');
}
console.log('PASS every nebula size against original OpenNGC/Long2018: 45 named optical areas, 178 published SNR diameters, 72 honestly unknown HII extents; full spatial bounds');
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=1000;filter='nebula';MapLayers.active=true;
function settleNebula(){for(const files of MapLayers.filesForView(cam,width,height).values())for(const file of files)MapLayers.cache.set(file,readNebulaTile(file).map(r=>ExtendedCatalog.decode(r)));MapLayers.lastUpdate=-Infinity;MapLayers.update(performance.now());}
function nebulaFrame(){MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();}
const orion=object('orion'),position=JSON.stringify(orion.p3),raw=IMPORTED_CATALOG.objects.find(o=>o.legacyId==='orion');assert.equal(orion.d,1344);assert.equal(orion.angularMajorArcmin,raw.angularMajorArcmin);assert.ok(Math.abs(orion.region.major-raw.diameterLy)>5,'size is recomputed at adopted landmark distance');
// The duplicate import fix is class-wide and cannot override accepted raw axes.
for(const d of [100,1000]){const target={kind:'nebula',d,p3:[d,0,0]};mergeNebulaSize(target,{angularMajorArcmin:90,angularMinorArcmin:60});Nebulae.prepare(target);assert.ok(Math.abs(target.region.major/(2*d*Math.tan(Math.PI/240)) -1)<1e-12);mergeNebulaSize(target,{angularMajorArcmin:180});assert.equal(target.angularMajorArcmin,90);}
for(const id of ['orion','opengc-ngc1952','opengc-ngc6720']){
 const o=object(id),p=MapLayout.project(o),diameter=o.region.major;let previous;
 for(const span of [diameter*10,diameter*20]){cam={x:p.x,y:p.y,span};settleNebula();nebulaFrame();const hit=RegionMap.hits.find(h=>h.o.id===id);assert.ok(hit,id+' scaled contour');const width=Math.max(...hit.points.map(p=>p.x))-Math.min(...hit.points.map(p=>p.x));if(previous)assert.ok(Math.abs(width/previous-.5)<1e-10);previous=width;}
 for(const radius of [1.9,2,2.5,3,3.5,4,4.1]){cam={x:p.x,y:p.y,span:diameter*.5*width/radius};settleNebula();nebulaFrame();const v=Nebulae.view(o);assert.ok(Math.abs(v.area+v.point-1)<1e-12);assert.ok(hitObjects.some(h=>h.o.id===id)||RegionMap.hits.some(h=>h.o.id===id),'no contour/icon gap');}
}
assert.equal(JSON.stringify(orion.p3),position);
const sample=nebulaRows.filter(r=>r[11].diameterLy>0).sort((a,b)=>b[11].diameterLy-a[11].diameterLy)[0],o=ExtendedCatalog.decode(sample),p=MapLayout.project(o),r=o.region.major/2;cam={x:p.x+r*.5+r*2*.43,y:p.y,span:r*2};settleNebula();nebulaFrame();assert.ok(screen(o).x<0);assert.ok(RegionMap.hits.some(h=>h.o.id===o.id),'offscreen centre keeps visible SNR edge');
ExtendedCatalog.pin(o);state.selected=o.id;ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),physical=JSON.stringify(o.p3);delete saved.catalogObjects.find(q=>q.id===o.id).region;ExtendedCatalog.pinned.clear();state=restore(saved);assert.ok(object(o.id).region);assert.equal(JSON.stringify(object(o.id).p3),physical);
const unknown=ExtendedCatalog.decode(nebulaRows.find(r=>r[11].catalogType==='HII'));ExtendedCatalog.pin(unknown);showObject(unknown.id);assert.ok($('dialogContent').innerHTML.includes('Индивидуальный размер в исходной выборке не приведён'));assert.equal(unknown.region,undefined);assert.equal(Nebulae.view(unknown).point,1);
console.log('PASS adopted-distance duplicate imports, scaled contours, continuous 2–4px transition, visible offscreen edges, old-save source restoration and explicit unknown sizes');
}`);
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);MapLayers.active=true;for(const c of MapLayers.categories)MapLayers.ready.set(c,true);filter='all';width=1440;height=1000;cam={x:1e14,y:1e14,span:1000};
const fixtures=[{kind:'cluster',catalogClass:'stellar-cluster'},{kind:'cluster',catalogClass:'galaxy-cluster'},{kind:'nebula'}].map((fields,i)=>({...fields,id:'symbol-fixture-'+i,name:'CLASS '+i,p3:[100+i,0,0],d:100+i,mapPosition:{x:cam.x+(i-1)*100,y:cam.y},facts:{mass:'Не измерена',class:'Test'},navigable:true}));
const before=OBJECTS.length;OBJECTS.push(...fixtures);for(const o of fixtures)ExtendedCatalog.coreIndex.set(o.id,o);RegionMap.hits=[];const original=MapSymbols.draw,calls=[];MapSymbols.draw=function(o,p,ink){if(o.id.startsWith('symbol-fixture'))calls.push(MapDetails.group(o));return original.call(this,o,p,ink);};
const expected=['galaxy-cluster','nebula','stellar-cluster'].sort();function assertClasses(){assert.deepEqual([...new Set(calls)].sort(),expected);calls.length=0;}
for(const mode of ['dark','light']){
 theme=mode;fixtures.forEach((o,i)=>{o.streamed=false;delete o.messier;o.mapPosition={x:cam.x+(i-1)*100,y:cam.y};});MapLabels.begin();drawObjects();assertClasses();
 // Crowding uses the same glyph, never a generic dot for another class.
 for(const o of fixtures)o.mapPosition={x:cam.x,y:cam.y};MapLabels.begin();drawObjects();assertClasses();
 // Selected streamed objects return through the foreground path.
 fixtures.forEach((o,i)=>{o.streamed=true;o.mapPosition={x:cam.x+(i-1)*100,y:cam.y};});for(const o of fixtures){state.selected=o.id;MapLabels.begin();drawObjects();assert.ok(calls.includes(MapDetails.group(o)));calls.length=0;}
 state.selected='alpha';MapLayers.visible=fixtures;MapLayers.visibleMap=new Map(fixtures.map(o=>[o.id,o]));ExtendedCatalog.draw();assertClasses();
 // Explicit class filters retain the same icon in the background path.
 for(const o of fixtures){filter=MapDetails.group(o);ExtendedCatalog.draw();assert.deepEqual([...new Set(calls)],[filter]);calls.length=0;}filter='all';
 // Known sparse objects beyond each class cutoff use the common glyph too.
 cam.span=3e9;fixtures.forEach((o,i)=>{o.streamed=false;o.messier='test';o.mapPosition={x:cam.x+(i-1)*cam.span*.2,y:cam.y};});MapLayers.visible=[];MapLayers.visibleMap.clear();MapLabels.begin();drawObjects();MapLabels.draw();assertClasses();cam.span=1000;
}
MapSymbols.draw=original;OBJECTS.length=before;for(const o of fixtures)ExtendedCatalog.coreIndex.delete(o.id);
// Compare actual vector output in each theme. The three classes have distinct
// paths; selecting a class cannot change its underlying glyph or pixel scale.
const methods=['arc','moveTo','lineTo','bezierCurveTo','closePath','fill','stroke'],originals=new Map(methods.map(k=>[k,ctx[k]]));
for(const mode of ['dark','light']){theme=mode;const traces=[];for(const o of fixtures){const trace=[];for(const k of methods)ctx[k]=(...args)=>trace.push([k,...args]);MapSymbols.draw(o,{x:0,y:0});traces.push(JSON.stringify(trace));}assert.equal(new Set(traces).size,3);}
for(const [k,v] of originals)ctx[k]=v;
console.log('PASS distinct class vector glyphs throughout foreground/background/crowding/selection/sparse/filter paths and both themes; no generic-dot fallback');
}`);
