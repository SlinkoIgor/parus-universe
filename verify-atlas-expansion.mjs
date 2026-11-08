import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#atlas-expansion');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations','universe-map'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
const audit=JSON.parse(fs.readFileSync('data-tools/black-hole-catalog-audit.json'));
assert.equal(audit.objects,133);assert.equal(audit.mapped,88);assert.equal(audit.atlasOnly,45);
context.audit=audit;
context.massConstraints=[
 ['SWIFT J1357.2-0933','> 8,9'],
 ['XTE J1650-500','≤ 7,3'],
 ['XTE J1118+480','6,9–8,2'],
 ['XTE J1859+226','> 5,42'],
 ['XTE J1550-564','7,81–15,6'],
 ['GRS 1009-45','≳ 4,4'],
 ['GRO J0422+32','2–15'],
 ['GRS 1124-684','3,8–7,5'],
 ['GS 2000+251','5,5–8,8'],
 ['GS 1354-64','≥ (7,6 ± 0,7)'],
 ['H 1705-250','4,9–7,9'],
 ['1H 1659-487','> 6'],
 ['4U 1543-475','8,4–10,4'],
];
context.blackcatSource=JSON.parse(fs.readFileSync('data-tools/black-hole-sources/blackcat-2015.json'));
run('UniverseMap.renderCard=()=>{};');
run(`{
state=initial();state.expansion=false;paused=true;Cosmology.sync(state);MapLayers.active=false;filter='all';width=1440;height=1000;
const bh=BlackHoleCatalog.objects,science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar,o.gravity]));
assert.equal(bh.length,audit.objects);assert.equal(bh.filter(o=>!o.atlasOnly).length,audit.mapped);
assert.equal(bh.filter(o=>o.population==='stellar').length,62);assert.equal(bh.filter(o=>o.population==='supermassive').length,71);
const supermassive=OBJECTS.filter(o=>o.kind==='blackhole'&&o.blackHolePopulation==='supermassive');
assert.equal(supermassive.length,72,'all sourced supermassive identities, including Sgr A*');
for(const o of supermassive){assert.equal(MapDetails.typeName(o),'Сверхмассивная чёрная дыра',o.id);assert.equal(objectTypeText(o),'Сверхмассивная чёрная дыра');}
assert.equal(MapDetails.typeName({...object('sgr'),type:'Чёрная дыра',facts:{class:'Центр Галактики'}}),'Сверхмассивная чёрная дыра','old descriptive text cannot hide the known population');
assert.ok(MapDetails.typeName({...object('sgr'),confirmed:false}).includes('Кандидат'),'preserve an explicit candidate status');
assert.equal(MapDetails.typeName({kind:'blackhole',massSolar:1e9}),'Чёрная дыра','unknown population is not inferred from a mass alone');
assert.equal(MapDetails.typeName(object('m87')),'Галактика','the host is not its nucleus');
const denseOffsets=Array.from({length:130001},(_,i)=>[i,0,0]),denseSpine={id:'dense-spine-regression',kind:'filament',p3:[0,0,0],region:{shape:'polyline',major:130000,minor:1,offsets3:denseOffsets,points:denseOffsets.map(p=>p.slice(0,2))}};
assert.deepEqual(MapGeometry.projected(denseSpine,{mode:'full',slice:false}).bounds.map(n=>n||0),[0,0,130000,0],'dense path bounds do not exhaust the JavaScript argument stack');
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
assert.equal(ExtendedCatalog.total,EXTENDED_BOOT.total+(EXTENDED_BOOT.stellarCatalog?.newObjectCount||0)+BlackHoleCatalog.objects.length+NuclearStars.rows.length+UniverseMap.areas.length);
for(const o of bh){
 assert.ok(o.source.startsWith('https://'));assert.ok(o.facts.refs.length);assert.equal(o.massSource,o.massSource||o.source);
 if(o.atlasOnly){assert.equal(o.p3,null);assert.equal(o.navigable,false);assert.equal(MapDetails.visible(o,1),false);assert.equal(o.gravity,null);}
 else {assert.ok(o.confirmed);assert.ok(o.p3.every(Number.isFinite));assert.ok(o.navigable);assert.ok(MapDetails.mapLabelName(o,true));assert.ok(Math.abs(Math.hypot(...o.p3)/o.d-1)<1e-8);}
 if(o.population==='stellar'&&!o.atlasOnly){assert.ok(Math.hypot(...Space.fromSky(o.raDeg,o.decDeg,o.d).map((v,i)=>v-o.p3[i]))/o.d<1e-12);}
 if(o.population==='stellar'&&o.sourceRecord?.distanceKpcRaw?.startsWith('>'))assert.ok(o.atlasOnly,'a lower bound is never a point');
 if(!o.confirmed)assert.ok(MapDetails.typeName(o).includes('кандидат'),'search/card must retain the candidate status');
 assert.equal(o.bolometricLuminositySolar,undefined,'no invented stellar light for black holes');
}
const m87=object('bh-m87'),m31=object('bh-andromeda'),gaia=object('gaia-bh3');
assert.equal(m87.parentGalaxy,'m87');assert.equal(m31.parentGalaxy,'andromeda');assert.equal(m87.massSolar,6.5e9);assert.equal(m87.massUncertaintySolar,null);
assert.equal(gaia.massSolar,32.7);assert.equal(gaia.massUncertaintySolar,.82);assert.equal(gaia.coordinateEpoch,'J2017.5');assert.ok(Math.abs(gaia.d/(1000/1.6933*3.2615637771674336)-1)<1e-12);
const suffix=bh.find(o=>o.mapLabel?.startsWith('NGC 4486A '));assert.ok(suffix);assert.notEqual(suffix.parentGalaxy,'m87');assert.ok(Space.distance(suffix,m87)>1000,'NGC4486A is not NGC4486');
const conflicting=bh.find(o=>o.estimates?.[0]?.sourceRow[0].startsWith('N1399'));assert.equal(conflicting.estimates.length,2);assert.equal(conflicting.massSolar,null);assert.equal(MapDetails.mass(conflicting),null);assert.equal(conflicting.gravity,null);
const v404=bh.find(o=>o.sourceRecord?.name==='GS 2023+338');assert.equal(v404.massSolar,9);assert.equal(v404.massErrorPlusSolar,.2);assert.equal(v404.massErrorMinusSolar,.6);
const gx339=bh.find(o=>o.sourceRecord?.name==='1H 1659-487');assert.equal(gx339.massRaw,'>6');assert.equal(gx339.massSolar,null);assert.ok(gx339.atlasOnly);
const constrained=bh.filter(o=>!o.massSolar&&o.massRaw);
assert.equal(constrained.length,massConstraints.length,'audit every mass interval and bound, including atlas-only records');
for(const [name,text] of massConstraints){
 const o=constrained.find(o=>o.sourceRecord.name===name),source=blackcatSource.records.find(r=>r.name===name);
 assert.ok(o,name);assert.equal(JSON.stringify(o.sourceRecord),JSON.stringify(source),'preserve the complete source row: '+name);
 assert.equal(o.massRaw,source.massSolarRaw);assert.equal(o.facts.mass,text+' M☉ · чёрная дыра',name);
 assert.equal(o.massSolar,null);assert.equal(o.massUncertaintySolar,null);
 assert.equal(MapDetails.massInfo(o),null,'displayed constraints must not create a point mass: '+name);
 assert.equal(o.gravity,null);assert.equal(OrbitalArrival.target(o),null,'no orbit computed from a bound or interval: '+name);
 showObject(o.id);assert.ok($('dialogContent').innerHTML.includes('<dt>Масса</dt><dd>'+o.facts.mass+'</dd>'),'actual mass row: '+name);$('infoDialog').close();
 const stale={...o,facts:{...o.facts,mass:'Индивидуальная точечная масса не установлена.'}};
 ExtendedCatalog.restore({catalogObjects:[stale],catalogGeometry:MapLayout.version,catalogRevision:EXTENDED_BOOT.revision});
 assert.equal(stale.facts.mass,o.facts.mass,'old saves adopt the current mass display: '+name);assert.equal(MapDetails.mass(stale),null);
}
const unknown=bh.filter(o=>!o.massSolar&&!o.massRaw&&!(o.estimates?.length>1));
assert.equal(unknown.length,41);for(const o of unknown){assert.equal(o.facts.mass,'Индивидуальная точечная масса не установлена.');assert.equal(MapDetails.mass(o),null);}
assert.ok(conflicting.facts.mass.includes('несовместимые оценки'),'conflicting measurements remain distinct from an interval');
assert.equal(object('sgr').gravity.massSolar,4.3e6);assert.equal(object('cygnus').gravity.massSolar,21.2);
assert.equal(MapDetails.mapLabelName(object('cygnus')),null,'a numbered legacy source follows the common policy');
assert.ok(MapDetails.mapLabelName(object('cygnus'),true).includes('X-1'));
assert.equal(MapDetails.typeName(object('cygnus')),'Чёрная дыра');
for(const id of ['sgr','bh-andromeda','bh-m87']){
 select(id);assert.equal($('targetType').textContent,'Сверхмассивная чёрная дыра');showObject(id);
 assert.ok($('dialogContent').innerHTML.includes('<dt>Класс</dt><dd>Сверхмассивная чёрная дыра</dd>'),'detail class: '+id);$('infoDialog').close();
}
$('catalog').hidden=false;$('search').value='сверхмассивная';renderCatalog();
assert.equal($('catalogList').children.length,72,'population search includes every sourced SMBH, including the legacy core');
$('catalog').hidden=true;$('search').value='';state.selected='alpha';
assert.equal(MapDetails.mapLabelName({kind:'blackhole',name:'NGC 1234'}),null,'scope does not change ordinary catalogue name policy');
for(const mode of ['full','slice','radial'])for(const epoch of [0,15e9,100e9]){
 MapSlice.mode=mode;state.cosmicTime=epoch;Cosmology.sync(state);
 for(const o of bh.filter(o=>o.parentGalaxy&&!o.atlasOnly)){
  const host=BlackHoleCatalog.hosts.get(o.parentGalaxy),a=MapLayout.project(o),b=MapLayout.project(host),pa=Cosmology.position(o),pb=Cosmology.position(host);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<Math.max(1,Math.hypot(b.x,b.y))*1e-12,'nucleus follows host in '+mode+' '+o.id);
  assert.deepEqual(pa,pb,'physical expansion shares the host translation: '+o.id);assert.equal(Cosmology.group(o).id,Cosmology.group(host).id);
 }
}
state.cosmicTime=0;Cosmology.sync(state);
for(const mode of ['full','radial'])for(const o of [m31,m87,object('cygnus'),gaia]){
 MapSlice.mode=mode;cam={...MapLayout.project(o),span:Math.min(o.population==='supermassive'?1e6:1000,MapDetails.maxSpan(o)*.5)};cameraGoal=null;
 MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();MapLabels.draw();
 assert.ok(hitObjects.some(h=>h.o.id===o.id),'visible glyph: '+mode+'/'+o.id);
 const hasCaption=MapLabels.placed.some(q=>q.key==='object-'+o.id);
 if(MapDetails.mapLabelName(o,o.id===state.selected))assert.ok(hasCaption,'proper-name/selection caption: '+mode+'/'+o.id);
 // Sparse numeric captions still yield to collisions, including the host name.
 else if(hasCaption)assert.ok(MapAnnotations.sparseView(),'numeric captions require a clear sparse view: '+mode+'/'+o.id);
 if(o.parentGalaxy){const p=screen(o),first=hitObjects.find(h=>Math.hypot(h.p.x-p.x,h.p.y-p.y)<1e-8);assert.equal(first.o.id,o.id,'nucleus wins picking at the shared centre');}
 const span=MapDetails.maxSpan(o)*width/1440,limits=[1.05,1,.95,.85,.75,.3].map(f=>MapDetails.opacity(o,span*f));assert.equal(limits[0],0);assert.equal(limits.at(-1),1);
 for(let i=1;i<limits.length;i++)assert.ok(limits[i]>=limits[i-1]);
 const alpha=MapDetails.opacity(o,span*.9);state.selected=o.id;cam.x+=1000;assert.equal(MapDetails.opacity(o,span*.9),alpha);
}
// Restoring old metadata adopts current provenance and does not rewrite a live plan.
state=initial();state.current=m31.id;state.selected=m31.id;state.catalogGeometry=MapLayout.version;state.catalogRevision='old';state.ship=Space.point([8,9,10]);state.catalogObjects=[{...m31,p3:[8,9,10],mapPosition:{x:8,y:9},massSolar:1,gravity:{massSolar:1}}];state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(state.ship.p3,m31.p3);assert.equal(object(m31.id).massSolar,m31.massSolar);
const stale={...conflicting,massSolar:1,gravity:{massSolar:1}};ExtendedCatalog.restore({catalogObjects:[stale],catalogGeometry:MapLayout.version,catalogRevision:EXTENDED_BOOT.revision});assert.equal(stale.massSolar,null);assert.equal(stale.gravity,null);
state=initial();state.selected='alpha';launch(true);assert.ok(state.flight);const before=JSON.stringify([state.flight,state.ship,state.earth,state.proper,state.matter]);const saved=JSON.parse(JSON.stringify(state));saved.catalogObjects=[{...m87,p3:[1,2,3],massSolar:1}];state=restore(saved);assert.equal(JSON.stringify([state.flight,state.ship,state.earth,state.proper,state.matter]),before);
state=initial();state.expansion=false;Cosmology.sync(state);cameraGoal=null;
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar,o.gravity])),science);
console.log('PASS 133 sourced BH records, 88 mapped, all 7 mass intervals and 6 bounds displayed without invented point masses, unknowns/conflicts, identity suffixes, Gaia joint solution, host co-location in three modes and expansion epochs, glyphs/names, old-save authority and frozen flights; canonical host identities and source provenance');
}`);
