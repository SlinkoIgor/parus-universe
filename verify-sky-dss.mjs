import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({URL, TextDecoder, AbortController, console});
vm.runInContext(fs.readFileSync('data-tools/sky-dss-astrometry.mjs', 'utf8').replace('export const DSSAstrometry', 'const SkyDSS')+'\nglobalThis.SkyDSS=SkyDSS;', context);
const dss = context.SkyDSS, fixture = JSON.parse(fs.readFileSync('data-tools/sky-sources/dss-centering-checks.json'));
for (const q of fixture.cases) {
  const source = dss.decodeAstrometry(q.astrometry, q.identifier), plate = dss.plate(q.header),
    position = dss.at(source, plate.year), pixel = dss.pixel(plate, position), before = JSON.stringify(source);
  const errorArcsec = Math.hypot((position.raDeg-q.expected.raDeg)*Math.cos(position.decDeg*Math.PI/180), position.decDeg-q.expected.decDeg)*3600;
  assert.ok(errorArcsec < .001, q.id+' independent Astropy space motion: '+errorArcsec);
  assert.ok(Math.hypot(pixel.x-q.expected.x,pixel.y-q.expected.y) < .001, q.id+' independent TAN WCS, FITS origin and GIF vertical flip');
  assert.equal(plate.date.slice(0,10),q.header['DATE-OBS'].slice(0,10));
  assert.ok(plate.year < 2000,'exposure date, not the 2026 download/creation date');
  assert.ok(Math.abs(dss.northAngle(plate)) < 5,'north is up, not flipped by the negative WCS determinant');
  dss.at(source,1900);dss.at(source,2100);assert.equal(JSON.stringify(source),before,'astrometry is immutable');
  assert.ok(source.coordinateSource && source.motionSource && source.motionErrorMajorMasYr !== null);
}
const alpha = fixture.cases[0], source = dss.decodeAstrometry(alpha.astrometry,alpha.identifier);
assert.equal(dss.plate(fixture.cases[2].header).timeKnown,false,'DSS 07:80 is an unknown clock time within a known exposure day');
assert.equal(dss.plate({...alpha.header,'DATE-OBS':'1997-02-31T12:00:00'}),null,'invalid exposure day cannot become another date');
assert.equal(dss.plate({...alpha.header,'DATE-OBS':null}),null);
assert.equal(dss.plate({...alpha.header,CTYPE1:'RA---SIN'}),null);
assert.equal(dss.plate({...alpha.header,CD1_1:0,CD1_2:0}),null);
assert.equal(dss.at({...source,pmDec:null},1997),null,'missing motion is never zero');
assert.equal(dss.at({...source,pmRaCosDec:null},1997),null);
assert.ok(dss.at({...source,raDeg:359.999,decDeg:89.999,pmRaCosDec:10000},2100).raDeg < 360);
assert.equal(dss.pixel(dss.plate(alpha.header),{raDeg:0,decDeg:0}),null);
const wrong = structuredClone(alpha.astrometry);
wrong.metadata.find(m=>m.name==='ra').utype='mango:EpochPosition.longitude[CT.epoch=J2016]';
assert.equal(dss.decodeAstrometry(wrong,alpha.identifier),null,'a different epoch cannot be labelled J2000');
const wrongUnit = structuredClone(alpha.astrometry);
wrongUnit.metadata.find(m=>m.name==='pm_err_maj').unit='arcsec.yr-1';
assert.equal(dss.decodeAstrometry(wrongUnit,alpha.identifier).motionErrorMajorMasYr,null,'uncertainties keep their verified units');
wrongUnit.metadata.find(m=>m.name==='pmra').unit='arcsec.yr-1';
assert.equal(dss.decodeAstrometry(wrongUnit,alpha.identifier),null,'unknown motion units cannot be propagated');
assert.equal(dss.decodeAstrometry({...alpha.astrometry,data:[...alpha.astrometry.data,...alpha.astrometry.data]},'ambiguous'),null);
assert.equal(dss.identifier({name:'Sirius B',aliases:['GJ 244 B','HIP 32349']}),'GJ 244 B','no primary identity is borrowed');
assert.equal(dss.identifier({name:'Unresolved companion',parentObject:'sirius'}),null);
assert.equal(dss.identifier({aliases:['Gl 244B']}),'GJ 244 B');
assert.equal(dss.identifier({gliese:'Gliese 280B'}),'GJ 280 B');
assert.equal(dss.identifier({hd:'48915'}),'HD 48915');
assert.equal(dss.identifier({source:'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=WASP-121'}),'WASP-121');
assert.equal(dss.identifier({referenceURL:'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RMC%20136a1'}),'RMC 136a1');
assert.equal(dss.identifier({aliases:['Host galaxy','OGLE-LMC-CEP-1838']}),'OGLE-LMC-CEP-1838');
assert.equal(dss.identifier({stellarNameSource:'https://simbad.harvard.edu/simbad/sim-id?Ident=NAME%20Barnard%27s%20star'}),"NAME Barnard's star");
assert.equal(dss.identifier({stellarNameSource:'https://simbad.harvard.edu.evil.invalid/?Ident=wrong'}),null);
const direction={raDeg:219.84351330716495,decDeg:-60.83145660927171,catalogAstrometry:{hyg:{raDeg:219.911475,decDeg:-60.833976}}};
assert.equal(dss.direction(direction),direction.catalogAstrometry.hyg,'simulation epoch 2026 is not the photographic J2000 fallback');
console.log('PASS three observed DSS plates against independent Astropy motion/WCS, exposure dates, invalid DSS clock, RA/poles, source identities/units, unknown motion and northern orientation');

const encode = h => new TextEncoder().encode(Object.entries(h).map(([k,v])=>(k.padEnd(8)+'= '+(typeof v==='string'?"'"+v.replace(/'/g,"''")+"'":v)).padEnd(80)).join('')+'END'.padEnd(80));
let calls=0,cancelled=false;
context.fetch=async()=>({ok:true,body:new ReadableStream({start(controller){const bytes=encode(alpha.header);for(let n=0;n<bytes.length;n+=117)controller.enqueue(bytes.slice(n,n+117));},cancel(){cancelled=true;}})});
const plate=await dss.readPlate(source,new AbortController().signal);
assert.equal(plate.id,alpha.header.PLATEID);assert.equal(cancelled,true,'stop at the FITS header, before the image array');
context.fetch=async(url)=>{calls++;assert.ok(new URL(url).searchParams.get('query').includes("NAME Barnard''s star"));return{ok:true,json:async()=>alpha.astrometry};};
const object={stellarNameSource:'https://simbad.harvard.edu/simbad/sim-id?Ident=NAME%20Barnard%27s%20star'};
await dss.resolve(object,new AbortController().signal);await dss.resolve(object,new AbortController().signal);
assert.equal(calls,1,'in-memory source cache prevents duplicate lookups');
const cache=new Map();for(let i=0;i<1000;i++)dss.remember(cache,i,i);assert.equal(cache.size,256);

const resolve=dss.resolve,readPlate=dss.readPlate;
try {
  dss.resolve=async()=>source;
  const make=(year)=>({...plate,date:year+'-01-01',year});
  let requests=[];
  dss.readPlate=async p=>{requests.push(p);return make(requests.length===1?1980:1990);};
  const result=await dss.calibrate({},new AbortController().signal);
  assert.equal(requests.length,3,'a plate boundary requires recomputation for the final exposure');
  assert.equal(result.plate.year,1990);
  assert.equal(result.url,dss.url(dss.at(source,1990)));assert.ok(result.marker);
  dss.resolve=async()=>({...source,pmDec:null});
  assert.equal((await dss.calibrate({},new AbortController().signal)).marker,null);
  dss.resolve=async()=>{throw Error('offline');};
  const unknown=await dss.calibrate(direction,new AbortController().signal);
  assert.equal(unknown.marker,null);assert.equal(unknown.url,dss.url(direction.catalogAstrometry.hyg));
  dss.resolve=async()=>source;let n=0;dss.readPlate=async()=>make(1980+n++);
  assert.equal((await dss.calibrate({},new AbortController().signal)).marker,null,'unstable plate dates cannot produce a precise marker');
} finally {dss.resolve=resolve;dss.readPlate=readPlate;}
console.log('PASS streamed FITS headers, bounded caches, escaped exact identity, final-plate epoch iteration and honest missing/offline/unstable astrometry');

// The shipped path must use ready local values, never SIMBAD/FITS or space motion.
const runtime=vm.createContext({URL,console});
vm.runInContext(fs.readFileSync('dist/sky-dss-data.js','utf8')+'\n'+fs.readFileSync('dist/sky-dss.js','utf8'),runtime);
const shipped=runtime.SkyDSS, manifest=vm.runInContext('SKY_DSS_DATA',runtime), audit=JSON.parse(fs.readFileSync('data-tools/sky-dss-audit.json'));
assert.equal(manifest.total,audit.total);assert.ok(manifest.total>130000);
for(const method of ['resolve','at','header','plate','readPlate','pixel','calibrate','northAngle'])assert.equal(shipped[method],undefined,'no runtime '+method);
let localRequests=0;
runtime.fetch=async url=>{
 assert.ok(String(url).startsWith(manifest.dataRoot+'/'),'only the prepared local index may be requested');
 localRequests++;return{ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+url))};
};
const rows=new Map(),counts={};
for(let i=0;i<manifest.shardCount;i++)for(const [id,record]of Object.entries(JSON.parse(fs.readFileSync('dist/'+manifest.dataRoot+'/'+i+'.json')))){
 assert.equal(shipped.shard(id),i);assert.ok(!rows.has(id));rows.set(id,record);
 assert.ok(record.position.every(Number.isFinite)&&record.position[0]>=0&&record.position[0]<360&&Math.abs(record.position[1])<=90);
 counts[record.status]=(counts[record.status]||0)+1;
 if(record.status==='calibrated'){
  assert.ok(record.date&&record.plate&&record.source.motionSource);
  assert.ok(record.marker[0]>=0&&record.marker[0]<record.size[0]&&record.marker[1]>=0&&record.marker[1]<record.size[1]);
 }else assert.equal(record.marker,undefined,'an unverified field cannot display a precise marker');
}
assert.equal(rows.size,manifest.total);assert.deepEqual(counts,JSON.parse(JSON.stringify(manifest.counts)));
const published=JSON.parse(fs.readFileSync('dist/catalog-data/current.json')),
  indexed=JSON.parse(fs.readFileSync('dist/'+published.dataRoot+'/search.json')),
  expected=new Set([...indexed.filter(row=>row[2]==='star').map(row=>row[0]),...Object.keys(manifest.core)]);
for(const id of audit.coverage.withoutDirections)expected.delete(id);
assert.deepEqual(new Set(rows.keys()),expected,'all photographic stars in the complete published index and registered layers, without unused source duplicates');
for(const [id,row]of Object.entries(manifest.core))assert.deepEqual(JSON.parse(JSON.stringify(row)),rows.get(id),'same prepared data for core and stream');
for(const id of ['alpha','proxima','sirius']){
 const row=rows.get(id);assert.equal(row.status,'calibrated',id+' actual plate prepared');
 const o={id,raDeg:row.input[0],decDeg:row.input[1],stellarNameSource:'https://simbad.cfa.harvard.edu/simbad/sim-id?Ident='+encodeURIComponent(row.input[2])};
 assert.ok(await shipped.record(o));assert.equal(localRequests,0,'registered stars use embedded ready values');
 assert.equal(shipped.match({...o,raDeg:o.raDeg+.1},row),null,'reject stale saved coordinates');
 assert.equal(shipped.match({...o,stellarNameSource:'https://simbad.cfa.harvard.edu/simbad/sim-id?Ident=WRONG'},row),null,'reject another component');
}
const sample=[...rows].find(([id,row])=>!manifest.core[id]&&row.input[2]?.startsWith('HIP ')),[sampleId,row]=sample,
  streamed={id:sampleId,raDeg:row.input[0],decDeg:row.input[1],hip:row.input[2].slice(4)};
assert.ok(await shipped.record(streamed));await shipped.record(streamed);assert.equal(localRequests,1,'reuse the bounded local shard');
assert.ok(shipped.shards.size<=8);
console.log('PASS '+rows.size+' ready photographic directions, honest status/markers, exact prepared Alpha/Proxima/Sirius, stale identity checks, local-only streamed lookups and no browser astrometry');
