// A separate, global hierarchy for names. No view, UI state or load history.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {readMapCatalog} from './map-radial-catalog.mjs';
const {c,objects:catalog,manifest}=await readMapCatalog({supplement:true});
console.log('Read immutable catalogue');
vm.runInContext(['map-radial-data','map-radial','map-visibility-data','map-visibility','regions'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
c.MapSlice={mode:'full'};
const details=vm.runInContext('MapDetails',c),byId=new Map(catalog.map(o=>[o.id,o]));c.MapLayout.resolve=id=>byId.get(id);
// Apply the same proper-name rule to every class, including distant points.
const mapName=o=>details.mapLabelName(o);
const named=[...new Map(catalog.filter(o=>!o.atlasOnly&&o.kind!=='horizon'&&o.p3?.every(Number.isFinite)&&mapName(o)).reverse().map(o=>[o.id,o])).values()];
for(const o of named){o.region??=o.regionData;c.StellarClusters.prepare(o);c.Nebulae.prepare(o);}
const rank=o=>[details.level(o),details.mass(o)??-1,Number(!!o.cosmicLandmark),Number(!!o.messier),-(o.apparentV??99)];
const ranks=new Map(named.map(o=>[o.id,rank(o)]));
named.sort((a,b)=>{const x=ranks.get(a.id),y=ranks.get(b.id);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]-x[i];return a.id<b.id?-1:a.id>b.id?1:0;});
const entries=named.map(o=>({id:o.id,name:o.id==='sol'?'СОЛНЦЕ / ЗЕМЛЯ':mapName(o),minPixel:Math.max(o.region?.major||0,o.region?.minor||0,o.galaxy?.diameterLy||0)/1800,limits:[],positions:[]}));
for(const mode of ['full','radial']){
 c.MapSlice.mode=mode;
 const accepted=[];
 for(let i=0;i<named.length;i++){
  const o=named[i],entry=entries[i],p=mode==='radial'?c.MapRadial.placement(o).position:c.MapLayout.ordinaryProject(o);
  // Generous fixed footprints keep adjacent names apart in world space.
  // A higher-priority name blocks a lower one only while it is itself eligible.
  const captionW=[...entry.name].length*7.5+24,w=Math.max(120,captionW+2)*1.8,point=c.MapVisibility.overviewPoint(o);
  let limit=Math.min(1e30,c.MapVisibility.limit(o));if(!Number.isFinite(c.MapVisibility.limit(o))&&['stellar-cluster','nebula'].includes(details.group(o)))limit=Math.min(limit,details.maxSpan(o)/1440);
  if(!Number.isFinite(limit))limit=1e30;
  // These sparse point captions are one 10px line, without wrapped detail.
  // Use its compact footprint against nearby regions and other distant points.
  for(const q of accepted){const dx=p.x-q.x,dy=p.y-q.y,compact=point||q.point,collision=Math.max(entry.minPixel,q.minPixel,Math.abs(dx)/(dx>=0?(compact?q.captionW:q.w):(compact?captionW:w)),Math.abs(dy)/(compact?18:90));if(collision<q.limit&&collision<limit)limit=collision;}
  limit=Math.max(1e-6,limit);accepted.push({x:p.x,y:p.y,w,captionW,point,minPixel:entry.minPixel,limit});entry.limits.push(limit);entry.positions.push([p.x,p.y]);
 }
}
const radialRevision=JSON.parse(fs.readFileSync('dist/map-radial/current.json')).revision;
const dependencies=['data-tools/build-map-labels.mjs','data-tools/map-radial-catalog.mjs','dist/map-layout.js','dist/map-details.js','dist/catalog-extended.js','dist/catalog-stream.js','dist/regions.js','dist/map-visibility.js','dist/map-visibility-data.js','dist/map-radial.js','dist/map-radial-data.js','dist/distant-catalog.js','dist/distant-catalog-data.js'];
const revision=crypto.createHash('sha256').update(manifest.revision+radialRevision+dependencies.map(p=>fs.readFileSync(p)).join('')).digest('hex').slice(0,12);
const boot={version:1,revision,catalogRevision:manifest.revision,geometryVersion:c.MapLayout.version,radialRevision,entries};
const path='dist/map-label-data.js',temp=path+'.'+process.pid+'.tmp';fs.writeFileSync(temp,"'use strict';\n// Fixed per-name upper scales in ly/CSSpx; independent of viewport and panels.\nconst MAP_LABEL_BOOT="+JSON.stringify(boot)+';\n');fs.renameSync(temp,path);
const html='dist/index.html';fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace(/(map-label-data\.js\?v=)[^" ]+/,(_,prefix)=>prefix+revision));
console.log(JSON.stringify({revision,names:entries.length}));
