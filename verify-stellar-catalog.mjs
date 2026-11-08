import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#stellar-catalog');
context.stellarRadial=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);MapRadial.manifest=stellarRadial;
const data=EXTENDED_BOOT.stellarCatalog;
assert.equal(data.auditTargets.length,99);assert.equal(data.systems.length,37);
assert.equal(OrbitalMotion.stellarOrbits.length,31);
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
for(const [id,name] of [['hyg-118441','Сириус B'],['hyg-118493','Процион B'],['wolf','Вольф 359'],['hyg-103879','61 Лебедя A']]){
 assert.equal(object(id).name,name);assert.equal(MapDetails.mapLabelName(object(id)),name);
 assert.ok(object(id).stellarNameSource);assert.ok(object(id).aliases.length);
}
assert.ok(object('hyg-118441').aliases.includes('Gl 244B'));
assert.ok(object('hyg-118493').aliases.includes('Gl 280B'));
const gl=ExtendedCatalog.systemByMember.get('hyg-82565');
assert.equal(gl.members.length,5);
assert.deepEqual(gl.members.map(id=>object(id).stellarComponent),['A','Ba','Bb','C','F']);
assert.equal(object('hyg-82557').name,'Вольф 629');assert.equal(object('hyg-119113').name,'Ван Бисбрук 8');
const inner=gl.pairs.find(p=>p.primary==='Ba');assert.equal(inner.orbit,null);
assert.ok(inner.missingElements.includes('node')&&inner.missingElements.includes('aArcsec'));
assert.equal(inner.partialOrbit.period,'2.965509');
assert.ok(gl.pairs.find(p=>p.primary==='A').orbit);
assert.equal(ExtendedCatalog.systemByMember.has('hyg-57767'),false,'unconfirmed HYG association of Groombridge 1830 is not a confirmed binary');
assert.equal(ExtendedCatalog.systemByMember.get('hyg-119518').members.length,3,'EZ Aqr exact-ID match without HIP');
for(const id of ['hyg-67711','hyg-107213']){
 const s=ExtendedCatalog.systemByMember.get(id);assert.equal(s.members.length,2,'spectroscopic companion retained');
 assert.equal(s.pairs[0].orbit,null);assert.ok(s.pairs[0].missingElements.includes('node'));
}
for(const id of ['stellar-22034-5647-Ba','stellar-22034-5647-Bb','stellar-11182+3132-D'])assert.ok(/Коричневый карлик/.test(object(id).type));
assert.ok(/не установлена/.test(object('stellar-11182+3132-Bb').type));
assert.equal(object('hyg-119112').facts.lum,null,'combined photometry is not assigned to a resolved leaf');
showObject('hyg-119112');
assert.ok($('dialogContent').innerHTML.includes('индивидуальная светимость неизвестна'),'the card reports unknown individual luminosity instead of zero');
$('infoDialog').close();
for(const s of data.systems)for(const p of s.pairs){
 assert.ok(p.primaryMembers.every(id=>s.members.includes(id))&&p.secondaryMembers.every(id=>s.members.includes(id)));
 if(!p.orbit)continue;
 const q=p.orbit;assert.notEqual(q.grade,9,'photocentre or planet orbit is not a relative stellar orbit');
 for(const key of ['a','e','i','node','omega','period','peri','raDeg','decDeg'])assert.ok(Number.isFinite(q[key]));
 assert.ok(q.original&&q.uncertainty&&q.source);
 const r0=OrbitalMotion.vector(q,0),r1=OrbitalMotion.vector(q,Math.PI),AU=OrbitalMotion.AU;
 assert.ok(Math.abs(Math.hypot(...r0)/AU-q.a*(1-q.e))<1e-8,'periastron');
 assert.ok(Math.abs(Math.hypot(...r1)/AU-q.a*(1+q.e))<1e-8,'apastron');
 const a=OrbitalMotion.vector(q,OrbitalMotion.phase(q,2026.81)),b=OrbitalMotion.vector(q,OrbitalMotion.phase(q,2026.81+q.period));
 assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-10,'orbital period closure');
}
const fixed=JSON.stringify(data.objects.map(o=>[o.id,object(o.id).p3]));
let cases=0;
for(const years of [0,1.5,50])for(const mode of ['full','radial']){
 state.universeElapsed=years;MapSlice.setMode(mode);
 for(const track of OrbitalMotion.stellarOrbits)for(const branch of track.branches){
  if(!branch.factor)continue;const id=branch.ids[0],o=object(id),curve=OrbitalMotion.stellarCurve(track,id,branch.factor),p=curve.pointAt(curve.current),marker=MapLayout.project(o);
  assert.ok(Math.hypot(p.x-marker.x,p.y-marker.y)<1e-10,'marker on published orbit '+id+'/'+mode);
  const first=curve.pointAt(0),last=curve.pointAt(2*Math.PI);assert.ok(Math.hypot(first.x-last.x,first.y-last.y)<1e-10);
  const current=OrbitalMotion.stellarPositions().get(id);
  const model=mode==='radial'?MapRadial.placement(o).position:MapLayout.base(o.p3);
  assert.ok(Math.hypot(marker.x-model.x-current[0]+o.p3[0],marker.y-model.y+current[1]-o.p3[1])<1e-10,'metadata and animated rigid frame agree');
  cases++;
 }
}
assert.equal(JSON.stringify(data.objects.map(o=>[o.id,object(o.id).p3])),fixed,'animation cannot mutate navigation coordinates');
// Test independent published mass ratios and barycentric recoil in 3D.
for(const id of ['sirius','procyon']){
 const pair=ExtendedCatalog.systemByMember.get(id).pairs[0],a=pair.primaryMembers[0],b=pair.secondaryMembers[0],f=pair.massFraction;
 assert.ok(f>0&&f<1&&pair.massRatioBasis.source);
 const p0=OrbitalMotion.stellarPositions(2026.81),p1=OrbitalMotion.stellarPositions(2030.81);
 for(let j=0;j<3;j++)assert.ok(Math.abs((1-f)*(p1.get(a)[j]-p0.get(a)[j])+f*(p1.get(b)[j]-p0.get(b)[j]))<1e-12);
}
// The old HYG association renderer must never connect an audited system.
const oldSystems=ExtendedCatalog.systemList,oldLine=ctx.lineTo;let links=0;
ExtendedCatalog.systemList=[...data.systems,{id:'audit-no-orbit',members:['wolf','ross'],primary:'wolf'}];ctx.lineTo=()=>links++;
ExtendedCatalog.drawSystems();assert.equal(links,0);ctx.lineTo=oldLine;ExtendedCatalog.systemList=oldSystems;
const photoObject=object('hyg-118493'),photo=stellarSkyPhoto(photoObject),preparedPhoto=SKY_DSS_DATA.core[photoObject.id];
const photoURL=new URL(photo.match(/data-dss-src="([^"]+)"/)[1].replace(/&amp;/g,'&'));
assert.equal(photoURL.hostname,'archive.stsci.edu');assert.equal(photoURL.pathname,'/cgi-bin/dss_search');
assert.equal(SkyDSS.identifier(photoObject),preparedPhoto.input[2],'the photographic record belongs to this stellar component');
assert.equal(Number(photoURL.searchParams.get('r')),preparedPhoto.position[0],'DSS uses the prepared photographic direction');
assert.equal(Number(photoURL.searchParams.get('d')),preparedPhoto.position[1],'the simulation epoch cannot recenter an archival plate');
assert.ok(photo.includes('J2000')&&photo.includes('10′ × 10′')&&photo.includes('Снимок сейчас недоступен'));
assert.equal(stellarSkyPhoto({...object('sirius'),synthetic:true}),'');
assert.ok(stellarOrbitFacts(gl).includes('долгота узла'));
// Published binaries must move under the actual idle simulation clock, just
// like Alpha Cen; pausing and restoring cannot introduce a separate orbit clock.
let movingTracks=0;
for(const track of OrbitalMotion.stellarOrbits){
 state=initial();state.expansion=false;Cosmology.sync(state);
 const branch=track.branches.find(b=>b.factor),o=object(branch.ids[0]),before=MapLayout.project(o);
 Simulation.tick(track.q.period/8);
 assert.ok(Math.abs(state.universeElapsed-track.q.period/8)<1e-10);
 const after=MapLayout.project(o);assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>1e-13,'real simulation advances '+o.name);
 const save=JSON.parse(JSON.stringify(state));state=restore(save);
 assert.deepEqual(MapLayout.project(object(o.id)),after,'reload retains orbital phase: '+o.id);
 movingTracks++;
}
state=initial();state.expansion=false;Cosmology.sync(state);paused=true;
const stopped=JSON.stringify([...OrbitalMotion.stellarPositions()]);Simulation.advance(.2);
assert.equal(state.universeElapsed,0);assert.equal(JSON.stringify([...OrbitalMotion.stellarPositions()]),stopped);
paused=false;speed=1;Simulation.advance(.2);paused=true;
assert.ok(Math.abs(state.universeElapsed-.2)<1e-12);
for(const mode of ['full','radial']){
 MapSlice.setMode(mode);
 for(const s of data.systems){
  const bounds=stellarOrbitBounds(object(s.primary));
  assert.equal(!!bounds,s.pairs.some(p=>p.orbit));
  if(!bounds)continue;
  for(const t of OrbitalMotion.stellarOrbits.filter(t=>t.system===s.id))for(const b of t.branches){
   if(!b.factor)continue;const curve=OrbitalMotion.stellarCurve(t,b.ids[0],b.factor);
   for(let i=0;i<64;i++){const p=curve.pointAt(i/64*2*Math.PI),box=bounds.box;
    assert.ok(p.x>=box[0]-1e-10&&p.x<=box[2]+1e-10&&p.y>=box[1]-1e-10&&p.y<=box[3]+1e-10,'camera bounds contain every published ellipse');}
  }
 }
}
assert.equal(stellarOrbitBounds(object('wolf')),null);
assert.equal(stellarOrbitBounds({...object('sirius'),historicalStellarNavigation:true}),null);
for(const id of ['betelgeuse','hyg-101767','member-r136a1']){
 const o=object(id);assert.ok(o&&!data.auditTargets.includes(id),'real star beyond nearby selection');
 assert.ok(stellarSkyPhoto(o).includes('archive.stsci.edu'),'DSS is not restricted to nearby selection');
}
for(const bad of [{raDeg:360},{raDeg:-1},{decDeg:91},{decDeg:NaN}]){
 const gallery=stellarSkyPhoto({...object('sirius'),...bad});
 assert.ok(!/data-photo="(?:dss|chart-wide|chart-close)"/.test(gallery),'invalid directions cannot create a sky chart or DSS field');
}
console.log('PASS '+movingTracks+' published tracks under the real simulation clock, pause/reload, whole-ellipse camera bounds in both modes and DSS outside the nearby selection');
state=initial();state.selected='hyg-82565';state.catalogGeometry=MapLayout.version;state.catalogRevision='old';
state.catalogObjects=[{id:'hyg-82565',kind:'galaxy',name:'Gl 644A',d:27000,p3:[27000,0,0],mapPosition:{x:27000,y:0},mapGeometry:MapLayout.version}];
state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(object('hyg-82565').kind,'star');assert.ok(object('hyg-82565').d>20&&object('hyg-82565').d<21,'stale selection is refreshed from sourced system');
// Old streamed components may become core. Preserve actual frozen endpoints,
// including the old versions which did not serialize core-star records.
state=initial();state.selected='sirius';launch(true);paused=true;
const oldTarget={...object('sirius'),kind:'galaxy',...Space.point([6,-6,-2])};
state.flight.aim=Space.point(oldTarget.p3);state.catalogObjects=[oldTarget];state.catalogGeometry=MapLayout.version;state.catalogRevision=EXTENDED_BOOT.revision;
const frozen=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);
state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),frozen);
assert.equal(JSON.stringify(object('sirius').p3),JSON.stringify(oldTarget.p3));assert.equal(object('sirius').historicalStellarNavigation,true);assert.equal(object('sirius').kind,'star');assert.equal(object('sirius').name,'Сириус A');
ExtendedCatalog.capture(state);assert.ok(state.catalogObjects.some(o=>o.id==='sirius'&&o.historicalStellarNavigation));
ExtendedCatalog.pinned.delete('sirius');state=initial();state.selected='procyon';launch(true);paused=true;
state.flight.aim=Space.point([8,-8,-3]);state.catalogObjects=[];state.catalogGeometry=MapLayout.version;state.catalogRevision='old';
const oldFlight=JSON.stringify([state.flight.from,state.flight.aim,state.flight.distance,state.flight.covered,state.ship,state.matter,state.proper,state.earth]);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify([state.flight.from,state.flight.aim,state.flight.distance,state.flight.covered,state.ship,state.matter,state.proper,state.earth]),oldFlight);assert.equal(JSON.stringify(object('procyon').p3),'[8,-8,-3]');
ExtendedCatalog.pinned.delete('procyon');state=initial();
ExtendedCatalog.capture(state);assert.equal(OrbitalMotion.isOrbiting(object('sirius')),true,'fresh state keeps orbital animation');
console.log('PASS sourced stellar identities, 99-target audit, 37 hierarchies, Gl 644 quintuple, honest missing elements, 31 relative orbits, '+cases+' projection/phase cases, barycentres, no association sticks, sky-photo fields and frozen old saves');
`);
const paths=['data-tools/stellar-catalog.json','dist/catalog-extended.js'];
const before=paths.map(p=>fs.readFileSync(p));
execFileSync('python3',['data-tools/build-stellar-catalog.py'],{stdio:'pipe'});
for(let i=0;i<paths.length;i++)assert.ok(fs.readFileSync(paths[i]).equals(before[i]),'offline reproducible '+paths[i]);
console.log('PASS offline stellar catalogue rebuild reproduces identical bytes');
execFileSync('python3',['-c',`
import copy,json,sys
sys.path.insert(0,'data-tools')
from stellar_base import validate
s=json.load(open('data-tools/stellar-sources/catalog-selection.json'))
fresh={o['id']:dict(o,kind='star') for o in s['targets']}
for r in s['catalogRows']:
 fresh.setdefault(r[0],dict(id=r[0],name=r[1],kind=r[2],d=r[3],raDeg=r[4],decDeg=r[5],aliases=r[8],**r[11]))
validate(s,fresh)
for field,value in [('d',27000),('kind','galaxy'),('p3',[27000,0,0])]:
 changed=copy.deepcopy(fresh);changed['hyg-82565'][field]=value
 try:validate(s,changed)
 except ValueError:pass
 else:raise AssertionError('Changed stellar source accepted: '+field)
`],{stdio:'pipe'});
console.log('PASS full-build rebinding accepts unchanged source rows and rejects revised distances, positions or identities');
