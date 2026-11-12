import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const frozen=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-sga.json'));
const pointer=JSON.parse(fs.readFileSync('dist/catalog-data/current.json'));
const context=vm.createContext({Map,Set,console,EXTENDED_BOOT:{revision:pointer.revision}});
vm.runInContext(['sky-imaging-index','sky-imaging'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),context);
const run=s=>vm.runInContext(s,context),index=run('SKY_IMAGING_INDEX'),imaging=context.SkyImaging;
assert.equal(index.catalogueRevision,pointer.revision);
assert.equal(index.photoCount,frozen.records.length);
assert.ok(index.photoCount>=12000,'twelve thousand distinct photographed catalogue objects');
assert.equal(Object.keys(index.targets).length,index.photoCount);
assert.equal(new Set(frozen.records.map(p=>p.sgaId)).size,index.photoCount);
assert.equal(new Set(frozen.records.map(p=>p.sourceUrl)).size,index.photoCount);
assert.equal(frozen.source.license,'CC BY 4.0');
assert.equal(frozen.source.credit,'Legacy Surveys / D. Lang (Perimeter Institute)');
assert.equal(frozen.source.queries.length,6);
assert.equal(frozen.source.queries.reduce((n,q)=>n+q.rows,0),frozen.sourceRows);
for(const q of frozen.source.queries){
  assert.match(q.sha256,/^[a-f0-9]{64}$/);
  assert.match(q.query,/ellipsebit=0 and group_mult=1/);
}
const shards=new Map(),byId=new Map(frozen.records.map(p=>[p.targetId,p]));
let count=0;
for(const [part,entry] of Object.entries(index.files)){
  const path='dist/'+entry.url.split('?')[0],bytes=fs.readFileSync(path),data=JSON.parse(bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),entry.url.split('?v=')[1]);
  assert.equal(data.version,1);assert.equal(Object.keys(data.photos).length,entry.count);
  shards.set(Number(part),data);
  for(const [id,p] of Object.entries(data.photos)){
    const r=byId.get(id);assert.ok(r,id);
    assert.equal(index.targets[id],Number(part));assert.equal(p.targetId,id);
    assert.equal(p.id,'sga-grz-'+r.sgaId);
    const expected='https://portal.nersc.gov/project/cosmo/data/sga/2020/data/'+String(Math.floor(r.groupRaDeg)).padStart(3,'0')+'/'+r.groupName+'/'+r.groupName+'-largegalaxy-image-grz.jpg';
    assert.equal(p.url,expected);assert.equal(p.url,r.sourceUrl);assert.equal(p.source,p.url);
    assert.equal(r.availability.url,p.url);assert.equal(r.availability.status,200);
    assert.equal(r.availability.contentType.split(';')[0],'image/jpeg');
    assert.ok(r.availability.bytes>1000&&r.availability.bytes<=5e6);
    assert.ok(Number.isFinite(Date.parse(r.availability.checked)));
    assert.ok(r.d26Arcmin>0);assert.ok(r.separationArcsec<=r.toleranceArcsec);
    assert.equal(r.toleranceArcsec,Math.max(3,Math.min(30,r.d26Arcmin*60*.05)));
    assert.equal(p.credit,frozen.source.credit);assert.equal(p.creditUrl,frozen.source.rights);
    assert.equal(p.rights,'CC BY 4.0');assert.equal(p.mediaKind,'observation');
    assert.equal(p.identification.sgaId,r.sgaId);assert.equal(p.identification.method,r.method);
    count++;
  }
}
assert.equal(count,index.photoCount);
console.log('PASS 12000 distinct verified observational JPEGs, exact identities, availability, provenance, source rights and shard hashes');

// Small independent examples exercise matching decisions rather than repeating
// the import against its own output. A nearby galaxy cannot override a wrong ID.
execFileSync('python3',['-c',`
import importlib.util
spec=importlib.util.spec_from_file_location('sga','data-tools/fetch-sga-photos.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
r=dict(sga_id='42',pgc='123',galaxy='NGC0001',ra='10',dec='20',d26='2',d25_leda='1',group_name='NGC0001',group_ra='10')
def obj(id='a',aliases=['PGC 000123'],ngc='NGC0001',raDeg=10):
 return dict(id=id,aliases=aliases,ngc=ngc,raDeg=raDeg,decDeg=20)
matches,rejected=m.match_objects([obj()],[r]);assert len(matches)==1 and matches[0]['method']=='exact own PGC'
assert m.match_objects([obj(aliases=[],ngc='NGC 0001')],[r])[0][0]['method']=='exact own NGC/IC'
assert not m.match_objects([obj(aliases=['PGC 999'])],[r])[0], 'do not fall back from a contradictory PGC to NGC or coordinates'
assert not m.match_objects([obj(aliases=['PGC 123','PGC 456'])],[r])[0], 'ambiguous own identifiers'
assert not m.match_objects([obj(aliases=['host PGC 123'],ngc=None)],[r])[0], 'inherited host labels are not exact own IDs'
assert not m.match_objects([obj(raDeg=11)],[r])[0], 'same identifier with discordant coordinates'
assert not m.match_objects([obj()],[r,dict(r,sga_id='43')])[0], 'ambiguous atlas identifier'
matches,rejected=m.match_objects([obj(id='canonical'),obj(id='duplicate',ngc=None)],[r])
assert len(matches)==1 and matches[0]['targetId']=='canonical' and rejected['duplicate-physical-galaxy']==1
assert m.ngc_key('NGC 0001A')=='NGC1A' and m.ngc_key('host NGC 1')==''
assert 0<m.separation(359.999,20,.001,20)<10, 'RA wrap'
`]);
console.log('PASS import rejects wrong, ambiguous, inherited and discordant identities; duplicate physical galaxies are merged');

const objects=Object.keys(index.targets).map(id=>({id,kind:'galaxy'}));
for(const o of objects)assert.ok(imaging.has(o));
const first=objects[0],part=imaging.part(first),same=objects.find(o=>o.id!==first.id&&imaging.part(o)===part);
for(const o of [{...first,kind:'star'},{...first,synthetic:true},{...first,atlasOnly:true},{...first,id:'unrelated',aliases:[first.id]}])assert.equal(imaging.has(o),false);
context.EXTENDED_BOOT.revision='stale';assert.equal(imaging.has(first),false);context.EXTENDED_BOOT.revision=pointer.revision;
let requests=[];
context.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url.split('?')[0]))};};
assert.equal(requests.length,0);assert.equal(imaging.cache.size,0);
await Promise.all([imaging.ensure(first),imaging.ensure(same)]);
assert.equal(requests.length,1);assert.equal(imaging.media(first).length,1);assert.equal(imaging.media(same).length,1);
await imaging.ensure(first);assert.equal(requests.length,1);
// Bounded cache, including asynchronous loads across all thirty-two parts.
for(const n of Object.keys(index.files))await imaging.ensure(objects.find(o=>imaging.part(o)===Number(n)));
assert.equal(imaging.cache.size,8);assert.equal(imaging.pending.size,0);
imaging.cache.clear();context.fetch=async()=>({ok:false,status:503});
await imaging.ensure(first);assert.ok(imaging.failed.has(part));assert.equal(imaging.pending.size,0);
assert.equal(await imaging.ensure(first),false,'a failed source cannot trigger an endless request loop');
imaging.failed.clear();context.PARUS_CATALOG_FILES=Object.fromEntries(Object.values(index.files).map(e=>[e.url.split('?')[0],fs.readFileSync('dist/'+e.url.split('?')[0],'utf8')]));
context.fetch=async()=>{throw Error('embedded metadata must not use a network request');};
await imaging.ensure(first);assert.equal(imaging.media(first).length,1);
imaging.cache.clear();context.PARUS_CATALOG_FILES[index.files[part].url.split('?')[0]]='invalid JSON';
await imaging.ensure(first);assert.ok(imaging.failed.has(part));assert.equal(imaging.pending.size,0);
imaging.failed.clear();const wrong=structuredClone(shards.get(part));wrong.photos[first.id].url=wrong.photos[first.id].url.replace('-image-grz','-model-grz');
context.PARUS_CATALOG_FILES[index.files[part].url.split('?')[0]]=JSON.stringify(wrong);
await imaging.ensure(first);assert.ok(imaging.failed.has(part));assert.equal(imaging.cache.size,0);
console.log('PASS lazy metadata, shared requests, bounded eight-part cache, failures/retry, standalone and rejection of model images');

const files=['dist/sky-imaging-index.js',...Object.values(index.files).map(e=>'dist/'+e.url.split('?')[0])],before=files.map(p=>fs.readFileSync(p));
execFileSync('python3',['data-tools/build-sky-imaging.py']);
files.forEach((p,i)=>assert.ok(before[i].equals(fs.readFileSync(p)),p));
console.log('PASS deterministic offline rebuild of the entire imaging index and all metadata shards');
