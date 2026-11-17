import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const PC=3.2615637771674336;
const current=JSON.parse(fs.readFileSync('dist/catalog-data/current.json','utf8'));
assert.equal(run('EXTENDED_BOOT.revision'),current.revision,'boot and spatial tiles belong to one snapshot');
const search=JSON.parse(fs.readFileSync('dist/'+current.dataRoot+'/search.json','utf8'));
const rows=new Map([...new Set(search.map(r=>r[5]))].flatMap(f=>JSON.parse(fs.readFileSync('dist/'+current.dataRoot+'/'+f,'utf8'))).map(r=>[r[0],r]));
const members=JSON.parse(fs.readFileSync('data-tools/cluster-members.json','utf8'));
const audit=JSON.parse(fs.readFileSync('data-tools/cluster-membership-audit.json','utf8')).rows;
const base=JSON.parse(zlib.gunzipSync(fs.readFileSync('data-tools/cluster-membership-base.json.gz')));
const original=new Map(base.rows.map(r=>[r[0],r]));
assert.equal(run('EXTENDED_BOOT.clusterMembershipBaseRevision'),base.revision);
assert.equal(audit.length,members.rows.length,'every published Hipparcos member has an audit decision');
const applied=audit.filter(e=>e.action==='membership-distance');
assert.deepEqual([...original.keys()].sort(),applied.map(e=>e.star).sort(),'base rows are retained exactly for the changed stars');
const messier=JSON.parse(fs.readFileSync('data-tools/messier-base.json','utf8')),messierIds=new Set(JSON.parse(fs.readFileSync('data-tools/messier-distance-audit.json','utf8')).rows.map(q=>q.id));
const restored=[...rows.values()].filter(r=>!messierIds.has(r[0])).map(r=>original.get(r[0])||r).sort((a,b)=>a[0]<b[0]?-1:1);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(restored)).digest('hex'),messier.preservedSHA256,'every other row is identical to the validated base');
assert.ok(applied.length>1500,'membership distances: '+applied.length);
for(const e of audit.filter(e=>e.probability<.5))assert.notEqual(e.action,'membership-distance','authors discard members with probability <0.5');
const checked=new Set();
for(const e of applied){
 const r=rows.get(e.star);assert.ok(r,e.star+' streamed');
 const x=r[11],est=x.positionEstimate;
 assert.equal(est.method,'cluster-membership');assert.equal(est.anchor,e.cluster);assert.equal(x.clusterMembership.huntId,e.huntId);
 assert.equal(x.atlasOnly,false);assert.ok(Number.isFinite(r[12])&&Number.isFinite(r[13]));
 const o=original.get(e.star);
 assert.deepEqual([r[1],r[2],r[4],r[5],r[10]],[o[1],o[2],o[4],o[5],o[10]],e.star+' keeps identity and observed direction');
 assert.equal(x.clusterMembership.catalogDistanceLy,o[3]===null?null:Math.round(o[3]*1000)/1000,e.star+' keeps the original catalogue distance');
 const plx=1000*PC/r[3],lo=Math.min(e.priorParallaxMas,e.starParallaxMas??e.priorParallaxMas),hi=Math.max(e.priorParallaxMas,e.starParallaxMas??e.priorParallaxMas);
 assert.ok(plx>=lo-1e-9&&plx<=hi+1e-9,e.star+' combined parallax lies between star and cluster');
 assert.ok(e.tension===undefined||e.tension<=3);
 checked.add(e.cluster);
}
for(const e of audit.filter(e=>['parallax-conflict-kept','low-probability'].includes(e.action))){
 const r=rows.get(e.star);if(!r)continue;
 assert.ok(!r[11].positionEstimate&&!r[11].clusterMembership&&!original.has(e.star),e.star+' keeps its individual estimate');
}
for(const e of audit.filter(e=>e.action==='curated-core-position-kept'))assert.ok(!rows.has(e.star),e.star+' remains a curated core object');
const corrected=new Set(run('EXTENDED_BOOT.coordinateCorrections.filter(r=>r[11].clusterMembership).map(r=>r[0])'));
for(const e of applied)assert.ok(corrected.has(e.star),e.star+' restores its new position in old saves');
const stats={ordinary:[0,0,0],radial:[0,0,0]};
const examples={'messier-45':0,'hunt-reffert-281':0,'opengc-ngc2516':0,'opengc-ngc2547':0};
for(const e of applied){
 context.starRow=rows.get(e.star);context.clusterRow=rows.get(e.cluster);if(!context.clusterRow)continue;
 const out=run(`(()=>{const s=ExtendedCatalog.decode(starRow),c=ExtendedCatalog.decode(clusterRow);ExtendedCatalog.pin(c);const R=Math.max(c.region?.major||0,c.region?.minor||0)/2;if(!R)return null;
  if(MapLayout.anchorId(s)!==c.id)throw new Error(s.id+' does not inherit its cluster frame');
  const a=MapLayout.ordinaryProject(s),b=MapLayout.ordinaryProject(c),ra=MapRadial.project(s),rb=MapRadial.project(c);
  return [Math.hypot(a.x-b.x,a.y-b.y)/R,Math.hypot(ra.x-rb.x,ra.y-rb.y)/R];})()`);
 if(!out)continue;
 out.forEach((v,i)=>stats[i?'radial':'ordinary'][v<=1?0:v<=2?1:2]++);
 if(e.cluster in examples&&out[0]<=2)examples[e.cluster]++;
}
for(const [mode,[inside,near,far]] of Object.entries(stats)){const n=inside+near+far;assert.ok(n>1500);assert.ok(inside/n>.6,mode+' members inside r50: '+inside+'/'+n);assert.ok((inside+near)/n>.85,mode+' members within 2 r50');}
for(const [id,count] of Object.entries(examples))assert.ok(count>=3,id+' shows members inside its contour');
context.memberRow=rows.get(applied[0].star);
run(`(()=>{const o=ExtendedCatalog.decode(memberRow);ExtendedCatalog.pin(o);state=initial();state.selected=o.id;ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),old=saved.catalogObjects.find(q=>q.id===o.id);old.d=1;old.p3=[1,0,0];old.positionEstimate=null;ExtendedCatalog.pinned.clear();state=restore(saved);const r=object(o.id);if(Math.abs(r.d-o.d)>1e-9||r.positionEstimate?.method!=='cluster-membership')throw new Error('old save keeps a stale member position');})()`);
console.log('PASS cluster membership depths:',applied.length,'stars in',checked.size,'clusters; map placement',JSON.stringify(stats),'; conflicts, low-probability and curated stars unchanged; old saves adopt the estimate');
