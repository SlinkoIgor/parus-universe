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
