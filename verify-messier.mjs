import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#messier');
const pointer=JSON.parse(fs.readFileSync('dist/catalog-data/current.json'));
const manifest=JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/manifest.json'));
const base=JSON.parse(fs.readFileSync('data-tools/messier-base.json'));
const search=JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/search.json'));
const readRows=(root,index)=>new Map([...new Set(index.map(r=>r[5]))].flatMap(file=>JSON.parse(fs.readFileSync(root+'/'+file))).map(r=>[r[0],r]));
const rows=readRows('dist/'+pointer.dataRoot,search),original=new Map(base.rows.map(r=>[r[0],r]));
const audit=JSON.parse(fs.readFileSync('data-tools/messier-distance-audit.json'));
const changed=new Set(audit.rows.map(q=>q.id));
assert.equal(rows.size,base.preservedRows+original.size,'enrichment creates no duplicate identities');
assert.equal(manifest.messierBaseRevision,base.revision);
const membershipBase=new Map(JSON.parse(zlib.gunzipSync(fs.readFileSync('data-tools/cluster-membership-base.json.gz'))).rows.map(r=>[r[0],r]));
const unchanged=[...rows.values()].filter(r=>!changed.has(r[0])).map(r=>membershipBase.get(r[0])||r).sort((a,b)=>a[0]<b[0]?-1:1);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(unchanged)).digest('hex'),base.preservedSHA256,'all unrelated science/display rows are identical to the validated base');
let preserved=0,enriched=0;
for(const [id,row] of rows){
 if(!changed.has(id)){preserved++;}
 else {assert.equal(original.get(id)[3],null);assert.ok(row[3]>0);assert.equal(row[11].atlasOnly,false);enriched++;}
}
assert.equal(enriched,16,'sixteen streamed targets plus three existing core targets');
assert.equal(changed.size,19);
assert.equal(manifest.total,260892,'the catalogue population is unchanged');
context.messierRows=[...rows.values()].filter(r=>Number(r[11].messier)>=1&&Number(r[11].messier)<=110);
context.messierAudit=audit;
context.messierTiles=Object.fromEntries(search.map(r=>[r[0],r[5]]));
context.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0]))});
await run(`(async()=>{
 const indexed=messierRows.map(r=>ExtendedCatalog.decode(r));
 const all=[...new Map([...indexed,...OBJECTS].map(o=>[o.id,o])).values()]
  .filter(o=>MapFilters.matchesCollection(o,'messier')&&!o.supersededBy);
 assert.equal(all.length,110);
 assert.equal(all.map(o=>Number(o.messier)).sort((a,b)=>a-b).join(),Array.from({length:110},(_,i)=>i+1).join());
 for(const o of all){assert.ok(o.p3?.every(Number.isFinite),o.id);assert.ok(o.navigable&&!o.atlasOnly&&!MapGeometry.unlocated(o),o.id);}
 MapFilters.change('all','messier','all');await MapFilters.pending;
 assert.equal(MapFilters.total,110,'complete selection, independent of loaded viewport tiles');
 assert.equal(MapFilters.promoted.size,110);
 assert.ok(MapFilters.narrow&&!MapFilters.loadError);
 for(const o of all){
  const resolved=await ExtendedCatalog.resolve({id:o.id,tile:messierTiles[o.id]});
  assert.ok(resolved?.navigable,o.id+' resolves to a physical anchor');
  assert.ok(SkyGuide.hasObservatoryPhoto(resolved),o.id+' has an identified observatory photograph');
  await Promise.all([SkyPhotos.ensure(resolved),SkyImaging.ensure(resolved)]);
  assert.ok(SkyGuide.media(resolved).some(p=>p.mediaKind!=='survey'&&p.credit&&p.source.startsWith('https://')),
   o.id+' resolves real photo metadata, beyond the automatic DSS fallback');
  if(Number(o.messier)===37){const photo=SkyGuide.media(resolved).find(p=>p.id==='noirlab-m37');assert.ok(photo?.rights);assert.equal(photo.archive,photo.source,'direct NOIRLab attribution link is usable');}
  for(const mode of ['full','radial']){MapSlice.mode=mode;const p=MapLayout.project(resolved);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),o.id+' '+mode);}
  const p=MapLayout.ordinaryProject(resolved),raw=MapLayout.base(resolved.p3),d=resolved.mapOffset||[0,0];
  assert.ok(Math.hypot(p.x-raw.x-d[0],p.y-raw.y-d[1])<1e-5,o.id+' retains its generated cartographic offset');
 }
 for(const q of messierAudit.rows){
  const o=object(q.id);assert.ok(o.distanceSource&&o.distanceMethod,q.id+' distance provenance');
  assert.equal(ExtendedCatalog.hiddenIds.has(q.id),false,q.id+' removed from obsolete atlas-only policy');
 }
 for(const id of ['messier-40','opengc-ngc6994']){
  const o=object(id);assert.ok(o.opticalGroup&&o.coordinateAnchor);assert.ok(!o.region,'optical alignment has no physical cluster radius');
  const anchor=o.opticalComponents.find(q=>q.name===o.coordinateAnchor);
  assert.equal(o.d,anchor.distanceLy);assert.equal(o.raDeg,anchor.raDeg);assert.equal(o.decDeg,anchor.decDeg);
  assert.ok(o.opticalComponents.every(q=>q.distanceErrorLy>0));
  assert.ok(new Set(o.opticalComponents.map(q=>q.distanceLy)).size>1,'components never acquire a common distance');
  showObject(o.id);assert.ok($('dialogContent').innerHTML.includes('До опорной звезды от Солнца'));assert.ok($('dialogContent').innerHTML.includes(anchor.name));
 }
 assert.equal(object('opengc-ngc6994').kind,'cluster','M73 is an optical stellar group, not a nebula');
 assert.ok(!object('opengc-ic4715').region,'M24 is not assigned a spherical cluster size');
 assert.equal(object('opengc-ic4715').distanceRangeLy.join(),[10000,16000].join());
 for(const id of ['opengc-ngc6333','opengc-ngc6273','opengc-ngc6171'])assert.ok(object(id).distanceErrorLy>0,'published globular-cluster uncertainty');
 for(const id of ['opengc-ngc6523','opengc-ngc1982','opengc-ngc4406'])assert.equal(object(id).distanceErrorLy,null,'rounded NASA estimates retain unknown formal uncertainty');
 const saved=initial();saved.catalogGeometry=MapLayout.version;saved.catalogRevision=EXTENDED_BOOT.revision;
 saved.catalogObjects=messierAudit.rows.map(q=>({...object(q.id),d:null,p3:null,positionQuality:'unknown',atlasOnly:true,navigable:false}));
 const clocks=JSON.stringify([saved.ship,saved.matter,saved.proper,saved.earth]);
 ExtendedCatalog.restore(saved);
 for(const q of messierAudit.rows){const o=ExtendedCatalog.get(q.id);assert.ok(o.navigable&&!o.atlasOnly&&o.p3?.every(Number.isFinite),q.id+' old save adopts enriched coordinates');}
 assert.equal(JSON.stringify([saved.ship,saved.matter,saved.proper,saved.earth]),clocks,'catalogue migration preserves expedition state');
 MapSlice.mode='full';
})();`);
console.log('PASS all 110 Messier targets and identified observatory photographs, 19 sourced distance/anchor repairs, optical-group semantics, both projections and old-save migration; '+preserved+' unrelated streamed records unchanged');
