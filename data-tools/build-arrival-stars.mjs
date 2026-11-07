// Full-catalogue 3D stellar search, independent of streamed map tiles.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readMapCatalog} from './map-radial-catalog.mjs';
const {core,objects,manifest,pointer}=await readMapCatalog();
const files=new Map();
for(const n of manifest.nodes.filter(n=>!n.children.length))
 for(const r of JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/'+n.file)))files.set(r[0],n.file);
const coreIds=new Set(core.map(o=>o.id));
const rows=objects.filter(o=>o.kind==='star'&&!coreIds.has(o.id)&&!o.synthetic&&!o.atlasOnly&&!o.invalidIdentification&&!o.supersededBy&&!o.historicalStellarNavigation&&o.navigable!==false&&o.p3?.every(Number.isFinite))
 .map(o=>[o.id,...o.p3,files.get(o.id),o.parentGalaxy||o.parentObject||null]);
if(rows.some(r=>!r[4]))throw Error('A stellar index entry has no source tile.');
// Median order gives an implicit balanced kd-tree, without per-node objects.
function tree(rows,depth=0){
 if(!rows.length)return [];
 const axis=depth%3+1;rows.sort((a,b)=>a[axis]-b[axis]||a[0].localeCompare(b[0]));
 const m=rows.length>>1;return [...tree(rows.slice(0,m),depth+1),rows[m],...tree(rows.slice(m+1),depth+1)];
}
const data={version:1,catalogRevision:pointer.revision,geometryVersion:manifest.geometryVersion,units:'light-year; reference-epoch Galactic Cartesian coordinates',rows:tree(rows)};
const payload=JSON.stringify(data),revision=crypto.createHash('sha256').update(payload).digest('hex').slice(0,12);
fs.writeFileSync('dist/arrival-stars-index.json',payload+'\n');
fs.writeFileSync('dist/arrival-stars-data.js',"'use strict';\nconst ARRIVAL_STARS_BOOT="+JSON.stringify({revision,catalogRevision:pointer.revision,count:rows.length})+';\n');
const htmlPath='dist/index.html',html=fs.readFileSync(htmlPath,'utf8'),bootHash=crypto.createHash('sha256').update(fs.readFileSync('dist/arrival-stars-data.js')).digest('hex').slice(0,12);
fs.writeFileSync(htmlPath,html.replace(/(src="arrival-stars-data\.js)(?:\?[^"]*)?"/,(_,prefix)=>prefix+'?v='+bootHash+'"'));
console.log(`${rows.length} streamed stars; ${(payload.length/1e6).toFixed(2)} MB; ${revision}`);
