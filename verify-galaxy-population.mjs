import {catalogPath} from './catalog-path.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const input=JSON.parse(fs.readFileSync('data-tools/magellanic-cepheids.json','utf8'));
const index=JSON.parse(fs.readFileSync(catalogPath('search.json'),'utf8'));
const entries=new Map(index.map(r=>[r[0],r]));
const files=new Map();
const read=id=>{
 const e=entries.get(id);if(!e)return run('EXTENDED_BOOT.members').find(r=>r[0]===id);
 if(!files.has(e[5]))files.set(e[5],JSON.parse(fs.readFileSync(catalogPath(e[5]),'utf8')));
 return files.get(e[5]).find(r=>r[0]===id);
};
assert.deepEqual(input.counts,{LMC:4222,MBR:9,SMC:4654});
for(const m of input.objects){
 const r=read(m.id);assert.ok(r,m.id);
 assert.equal(r[4],m.raDeg);assert.equal(r[5],m.decDeg);
 assert.equal(r[3],m.distanceKpc*1000*3.2615637771674336);
 assert.ok(!r[11].atlasOnly);assert.equal(r[11].positionEstimate.method,'individual-period-Wesenheit');
 assert.equal(r[11].distanceErrorLy,m.distanceErrorKpc*1000*3.2615637771674336);
 assert.equal(r[11].parentGalaxy,m.host??undefined);
}
// Display policy must retain every sourced extragalactic stellar population,
// including the same bulk flag used by the Clouds, M31, M33 and the Bridge.
const diskInput=JSON.parse(fs.readFileSync('data-tools/galaxy-disk-objects.json','utf8')).objects;
const diskAudit=new Map(JSON.parse(fs.readFileSync('data-tools/galaxy-disk-audit.json','utf8')).rows.map(q=>[q.id,q]));
const diskStars=diskInput.filter(m=>m.kind==='star').map(m=>{const q=diskAudit.get(m.id),r=read(q?.action==='alias-of-existing-member'?q.target:m.id);assert.ok(r,m.id);return r;});
context.populationDisplayRows=[...input.objects.map(m=>read(m.id)),...diskStars];
run(`{
 const snapshot=JSON.stringify(populationDisplayRows),stars=populationDisplayRows.map(r=>ExtendedCatalog.decode(r));
 for(const o of stars){
  const scale=o.hostDiameterLy||o.positionEstimate.referenceScaleLy;
  assert.equal(MapDetails.maxSpan(o),scale*5,o.id+' uses its host/population scale');
  for(const span of [2000,5000,scale,scale*2])assert.ok(MapDetails.visible(o,span),o.id+' disappeared on resolved view '+span);
  assert.equal(MapDetails.visible(o,scale*5),false,'population still disappears on the wider overview');
  if(o.bulkGalaxyMember)assert.equal(MapDetails.landmark(o),false,'bulk stars cannot bypass their class limit');
 }
 assert.equal(MapDetails.visible({kind:'star'},2000),false,'ordinary Milky Way cutoff stays in force');
 assert.equal(MapDetails.maxSpan({kind:'star',synthetic:true,galaxyMember:true,hostDiameterLy:100000}),2000,'game stars retain their own cutoff');
 assert.equal(JSON.stringify(populationDisplayRows),snapshot,'rendering does not change catalogue rows, source distances or errors');
 state=initial();state.expansion=false;Cosmology.sync(state);MapLayers.active=false;MapLayers.visible=[];MapLayers.visibleMap.clear();width=1440;height=1000;
 for(const mode of ['dark','light'])for(const host of ['lmc','smc','andromeda','triangulum']){
  theme=mode;filter='all';const g=object(host),p=MapLayout.project(g);cam={x:p.x,y:p.y,span:g.galaxy.diameterLy*2};
  ExtendedCatalog.visible=stars.filter(o=>o.parentGalaxy===host);state.selected=host;
  MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
  assert.ok(hitObjects.filter(h=>h.o.kind==='star'&&h.o.parentGalaxy===host).length>100,host+' must contain visible stars on the whole-galaxy view');
 }
}`);
console.log('PASS every OGLE/LGGS star retains host/population-scale visibility, resolved Cloud/M31/M33 rendering in both themes, ordinary/game-star cutoffs and unchanged source rows');
for(const host of ['lmc','smc']){
 const group=input.objects.filter(m=>m.host===host),rows=group.map(m=>read(m.id));
 assert.ok(new Set(rows.map(r=>r[3])).size>500,'individual distances do not form a shared shell');
 // The rendered population must occupy an area, not a line or one angular ray.
 const n=rows.length,mx=rows.reduce((s,r)=>s+r[12],0)/n,my=rows.reduce((s,r)=>s+r[13],0)/n;
 let xx=0,yy=0,xy=0;for(const r of rows){const x=r[12]-mx,y=r[13]-my;xx+=x*x;yy+=y*y;xy+=x*y;}
 assert.ok((xx*yy-xy*xy)/(xx*yy)>.01,'two-dimensional Cloud population');
 context.hostUnderTest=host;
 run(`{state=initial();const g=object(hostUnderTest),star=ExtendedCatalog.ensureGalaxy(g);assert.ok(star.galaxyMember&&!star.synthetic&&star.navigable);assert.equal(star.positionEstimate.method,'individual-period-Wesenheit');assert.ok(ExtendedCatalog.background(star));}`);
}
const psr=JSON.parse(fs.readFileSync('data-tools/pulsar-distance-audit.json','utf8')).rows;
const extragalactic=psr.filter(r=>r.method.includes('индивидуальную глубину пульсара'));
assert.equal(extragalactic.length,59);
for(const q of extragalactic){const r=read(q.id);assert.ok(q.atlasOnly&&r[11].atlasOnly);assert.equal(r[12],null);assert.equal(r[13],null);assert.ok(entries.get(q.id)[7]);}
const phat=index.filter(r=>r[0].startsWith('phat-ap-'));assert.equal(phat.length,2753);assert.ok(phat.every(r=>r[7]));
context.oldPoint={id:extragalactic[0].id,name:'Legacy shared-host point',kind:'pulsar',positionQuality:'approximate',p3:[1,2,3],mapPosition:{x:1,y:2},navigable:true};
run(`{ExtendedCatalog.restore({catalogObjects:[oldPoint]});const o=ExtendedCatalog.get(oldPoint.id);assert.ok(o.atlasOnly&&!o.navigable);assert.equal(MapDetails.visible(o,1e6),false);assert.ok(!Number.isFinite(MapLayout.project(o).x));assert.ok(object('member-hd5980').atlasOnly);}`);
console.log('PASS 8885 original individual distances/errors, Cloud area and depth, real departure stars, EXGAL/PHAT atlas-only and old-save migration');
