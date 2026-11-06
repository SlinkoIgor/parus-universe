#!/usr/bin/env node
// Batch photographic astrometry. Opening a card never runs this pipeline.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DSSAstrometry as dss} from './sky-dss-astrometry.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
const offline=process.argv.includes('--offline'), all=process.argv.includes('--calibrate-all'),
  raw='data-tools/raw/sky-dss', frozen='data-tools/sky-sources/dss-prepared-measurements.json';
fs.mkdirSync(raw,{recursive:true});
const inputs=raw+'/inputs.json';
execFileSync('python3',['data-tools/prepare-sky-dss-inputs.py',inputs]);
const input=JSON.parse(fs.readFileSync(inputs)), stars=input.objects,
  cache=fs.existsSync(frozen)?JSON.parse(fs.readFileSync(frozen)):{version:1,astrometry:{},plates:{},calibrations:{}},
  sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex'),
  write=(file,value)=>{const bytes=typeof value==='string'?value:JSON.stringify(value);if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===bytes)return;const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);},
  checkpoint=()=>write(frozen,cache), core=new Set(input.coreIds), priority=new Set(input.priority),
  motion=o=>Math.hypot(o.photographicAstrometry?.pmRaCosDec||0,o.photographicAstrometry?.pmDec||0),
  needsExact=o=>all||core.has(o.id)||motion(o)>=1000||o.photographicAstrometry?.motionCapped,
  targets=stars.filter(needsExact).sort((a,b)=>Number(priority.has(b.id))-Number(priority.has(a.id))||motion(b)-motion(a)),
  ids=[...new Set(targets.map(o=>dss.identifier(o)).filter(Boolean))].filter(id=>!Object.hasOwn(cache.astrometry,id));
let networkErrors=0;
// Match identifiers in batches, retaining each requested component separately.
// A missing/ambiguous row is not a zero proper motion and not a primary match.
if(!offline) for(let start=0;start<ids.length;start+=64){
  const batch=ids.slice(start,start+64), fields='b.main_id,b.ra,b.dec,b.pmra,b.pmdec,b.plx_value,b.rvz_radvel,b.coo_bibcode,b.pm_bibcode,b.pm_err_maj,b.pm_err_min,b.coo_err_maj,b.coo_err_min,b.plx_err,b.rvz_err,b.plx_bibcode,b.rvz_bibcode',
    query='SELECT i.id AS requested_id,'+fields+' FROM basic b JOIN ident i ON i.oidref=b.oid WHERE i.id IN ('+batch.map(id=>"'"+id.replace(/'/g,"''")+"'").join(',')+')';
  try{
    const response=await fetch('https://simbad.cfa.harvard.edu/simbad/sim-tap/sync',{
      method:'POST',body:new URLSearchParams({request:'doQuery',lang:'adql',format:'json',query}),signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('SIMBAD '+response.status);
    const data=await response.json(), at=data.metadata.findIndex(m=>m.name==='requested_id');
    if(at<0||!Array.isArray(data.data))throw Error('SIMBAD schema');
    for(const id of batch)cache.astrometry[id]=dss.decodeAstrometry({...data,data:data.data.filter(row=>row[at]===id)},id);
    checkpoint();console.log('SIMBAD batch '+Math.min(start+64,ids.length)+' / '+ids.length);
  }catch(error){networkErrors++;console.error('SIMBAD batch deferred: '+error.message);}
}
const sourceFor=o=>cache.astrometry[dss.identifier(o)]||o.photographicAstrometry||null;
dss.resolve=async o=>sourceFor(o);
dss.remember=(map,key,value)=>map.set(key,value);
const readPlate=dss.readPlate.bind(dss), keep=['DATE-OBS','PLATEID','SURVEY','REGION','NAXIS1','NAXIS2','EQUINOX',
  'CTYPE1','CTYPE2','CRPIX1','CRPIX2','CRVAL1','CRVAL2','CD1_1','CD1_2','CD2_1','CD2_2'];
dss.readPlate=async(p,signal)=>{
  const url=dss.url(p,'fits'), saved=cache.plates[url];
  if(saved)return dss.plate(saved.header);
  if(offline)throw Error('uncached plate in offline build');
  const plate=await readPlate(p,signal), header=Object.fromEntries(keep.filter(k=>Object.hasOwn(plate.header,k)).map(k=>[k,plate.header[k]]));
  cache.plates[url]={header,originalHeaderSHA256:sha(plate.header)};
  return dss.plate(header);
};
const inputKey=o=>[dss.direction(o).raDeg,dss.direction(o).decDeg,dss.identifier(o)],
  calibrationKey=o=>sha({algorithm:1,input:inputKey(o),source:sourceFor(o)});
let cursor=0, completed=0, calibrated=0;
const worker=async()=>{
  for(;;){
    const i=cursor++;if(i>=targets.length)return;
    const o=targets[i], source=sourceFor(o), key=calibrationKey(o);
    if(cache.calibrations[o.id]?.key===key){completed++;calibrated++;continue;}
    if(!source||![source.pmRaCosDec,source.pmDec].every(Number.isFinite)){completed++;continue;}
    try{
      const result=await dss.calibrate(o,AbortSignal.timeout(25000));
      if(result.marker){
        const url=new URL(result.url);
        cache.calibrations[o.id]={key,position:[+url.searchParams.get('r'),+url.searchParams.get('d')],
          plate:result.plate.id,date:result.plate.date,timeKnown:result.plate.timeKnown,
          size:[result.plate.width,result.plate.height],marker:[result.marker.x,result.marker.y],
          northAngle:dss.northAngle(result.plate),source};calibrated++;
      }
    }catch(error){if(!offline){networkErrors++;console.error(o.id+': '+error.message);}}
    completed++;if(completed%50===0){checkpoint();console.log('DSS '+completed+' / '+targets.length+'; calibrated '+calibrated);}
  }
};
await Promise.all(Array.from({length:4},worker));checkpoint();

const xml=zlib.gunzipSync(fs.readFileSync('data-tools/sky-sources/dss2-red-plates.xml.gz')).toString(),rad=Math.PI/180,
  plates=[...xml.matchAll(/<Image>\s*(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*<\/Image>/g)].map(m=>{
    const a=+m[2]*rad,d=+m[3]*rad;return{id:m[1],year:+m[4],u:[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)]};
  });
if(plates.length!==1907)throw Error('DSS plate source changed; re-audit coverage');
const nearest=p=>{
  const a=p.raDeg*rad,d=p.decDeg*rad,u=[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
  let best=null,similarity=-Infinity;
  for(const q of plates){const dot=q.u[0]*u[0]+q.u[1]*u[1]+q.u[2]*u[2];if(dot>similarity){best=q;similarity=dot;}}
  return best;
};
const shards=Array.from({length:128},()=>({})), bootstrap={},counts={calibrated:0,'plate-epoch-estimate':0,'catalogue-direction':0},
  hash=id=>{let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return(h>>>0)%128;};
for(const o of stars){
  const source=sourceFor(o), saved=cache.calibrations[o.id], ready=saved?.key===calibrationKey(o)?saved:null;
  let record;
  if(ready){const {key,...data}=ready;record={...data,status:'calibrated'};}
  else if(source&&[source.pmRaCosDec,source.pmDec].every(Number.isFinite)){
    const plate=nearest(source),p=dss.at(source,plate.year);
    record={position:[p.raDeg,p.decDeg],status:'plate-epoch-estimate',epoch:plate.year,plate:plate.id,
      source:{identifier:source.identifier,coordinateSource:source.coordinateSource,motionSource:source.motionSource}};
  }else{
    const p=dss.direction(o);record={position:[p.raDeg,p.decDeg],status:'catalogue-direction',
      reason:o.photographicAstrometry?.motionCapped?'capped-motion':'missing-motion'};
  }
  record.input=inputKey(o);counts[record.status]++;
  shards[hash(o.id)][o.id]=record;if(core.has(o.id))bootstrap[o.id]=record;
}
const sources={...input.sources,'sky-sources/dss2-red-plates.xml.gz':sha(fs.readFileSync('data-tools/sky-sources/dss2-red-plates.xml.gz')),
  measurements:sha(cache)},revision=sha({algorithm:1,sources,shards}).slice(0,12),dataRoot='sky-dss-data/'+revision,
  out='dist/'+dataRoot;
fs.mkdirSync(out,{recursive:true});
for(const [i,shard]of shards.entries())write(out+'/'+i+'.json',shard);
const units={position:'ICRS/J2000 degrees',epoch:'Julian year',motion:'mas/yr; pmRA includes cos(dec)',
  parallax:'mas',radialVelocity:'km/s',marker:'GIF pixels; origin top-left',
  hygUncertainty:'not supplied; never replaced with zero',plateEpoch:'published SkyView epoch; not a verified STScI exposure'};
const motionTargets=targets.filter(o=>{const p=sourceFor(o);return p&&[p.pmRaCosDec,p.pmDec].every(Number.isFinite);}),
  deferred=motionTargets.filter(o=>cache.calibrations[o.id]?.key!==calibrationKey(o)).map(o=>o.id);
const audit={version:1,revision,catalogRevision:input.catalogRevision,total:stars.length,core:core.size,counts,units,coverage:input.coverage,
  exactCoverage:{knownMotion:motionTargets.length,missingMotion:targets.length-motionTargets.length,deferred},
  exactTargets:targets.length,networkErrors,sourceSHA256:sources,
  policy:'All stellar input directions are prepared offline. Calibrated means actual final DSS DATE-OBS/TAN WCS. Plate-epoch estimates use the published epoch of the nearest SkyView DSS2-red plate; actual STScI plate selection is unverified and no exact marker/date is claimed. Missing motion remains unknown. No orbital motion or annual parallax correction.',
  sources:{hyg:'https://github.com/astronexus/HYG-Database',plates:'https://skyview.gsfc.nasa.gov/current/jar/surveys/xml/dss2r.xml.gz',
    astrometry:'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync',images:'https://archive.stsci.edu/cgi-bin/dss_search'}};
write('data-tools/sky-dss-audit.json',audit);
write('dist/sky-dss-data.js','// Generated by data-tools/build-sky-dss.mjs; presentation data only.\nconst SKY_DSS_DATA='+JSON.stringify({version:1,revision,dataRoot,shardCount:128,total:stars.length,counts,units,core:bootstrap})+';\n');
const html=fs.readFileSync('dist/index.html','utf8');
write('dist/index.html',html.replace(/(sky-dss-data\.js\?v=)[^\"]+/,(_,prefix)=>prefix+sha(fs.readFileSync('dist/sky-dss-data.js')).slice(0,12)));
console.log(JSON.stringify(audit,null,2));
