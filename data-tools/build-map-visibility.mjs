// Cartographic metadata only: source rows, physical positions and projections stay intact.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {readMapCatalog} from './map-radial-catalog.mjs';

const {c,rows,objects:catalogObjects,manifest,pointer}=await readMapCatalog({supplement:true});
vm.runInContext(['map-radial-data','map-radial','map-geometry-data','map-geometry'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const details=vm.runInContext('MapDetails',c);
const radialPointer=JSON.parse(fs.readFileSync('dist/map-radial/current.json'));
const radialManifest=JSON.parse(fs.readFileSync('dist/'+radialPointer.dataRoot+'/manifest.json'));
console.log('Read immutable catalogue');
const objects=catalogObjects.filter(o=>!o.atlasOnly&&!c.MapGeometry.unlocated(o)&&o.p3?.every(Number.isFinite));
const byId=new Map(objects.map(o=>[o.id,o]));c.MapLayout.resolve=id=>byId.get(id);
const complete=new Set(['filament','galaxy-cluster','stellar-cluster','nebula','supercluster','void']);
// Same deterministic importance in both projections; selection and load order
// never enter it. Unknown mass stays unknown, rather than receiving a typical mass.
const completeObject=o=>(complete.has(details.group(o))||details.group(o)==='galaxy'&&!!c.MapGeometry.model(o))&&!details.cosmologicalPoint(o);
const groups=new Map(objects.map(o=>[o.id,details.group(o)]));
const hostRange=new Map(objects.filter(o=>completeObject(o)&&details.maxSpan(o)>({'stellar-cluster':300000,nebula:300000,'galaxy-cluster':2e9}[groups.get(o.id)]??Infinity)).map(o=>[o.id,details.maxSpan(o)/1440]));
const ranks=new Map(objects.map(o=>[o.id,[details.level(o),details.mass(o)??-1,Number(!!o.cosmicLandmark),Number(!!o.messier),Number(!!details.mapLabelName(o)),-(o.apparentV??99)]]));
const compare=(a,b)=>{const x=ranks.get(a),y=ranks.get(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]-x[i];return a<b?-1:a>b?1:0;};
objects.sort((a,b)=>compare(a.id,b.id));
const positionsByMode={},pixels={},spacing=18,minLevel=-30,maxLevel=38;
for(const mode of ['full','radial']){
 console.log('Rank fixed cells:',mode);
 const positions=positionsByMode[mode]=new Map(objects.map(o=>[o.id,mode==='radial'?c.MapRadial.placement(o).position:c.MapLayout.ordinaryProject(o)]));
 // Dyadic cells nest exactly. A winner of a parent is also the winner of its
 // child, so every record has one upper scale threshold and no visibility holes.
 const limits=new Map(objects.map(o=>[o.id,0]));
 for(let level=minLevel;level<=maxLevel;level++){
  const size=2**level,occupied=new Set();
  for(const o of objects){
   // Full sourced contour layers have their own fixed class cutoff. They must
   // not crowd compact contents out of the point hierarchy.
   if(completeObject(o))continue;
   const p=positions.get(o.id),key=Math.floor(p.x/size)+','+Math.floor(p.y/size);
   if(occupied.has(key))continue;occupied.add(key);limits.set(o.id,size/spacing);
  }
 }
 for(const o of objects){const diameter=!o.sizeEstimated&&!o.sizeUnknown?(o.diameterLy||o.galaxy?.diameterLy||0):0;const p=Math.max(1e-6,limits.get(o.id),diameter/8);(pixels[o.id]??=[]).push(completeObject(o)?(hostRange.get(o.id)??-1):p);}
}
const dependencies=['data-tools/build-map-visibility.mjs','data-tools/map-radial-catalog.mjs','dist/map-details.js','dist/map-layout.js','dist/map-geometry.js','dist/map-geometry-data.js','dist/map-radial.js','dist/map-radial-data.js','dist/catalog-extended.js','dist/catalog-stream.js','dist/distant-catalog.js','dist/distant-catalog-data.js'];
dependencies.push('dist/cosmic-catalog.js');
const revision=crypto.createHash('sha256').update(manifest.revision+radialManifest.revision+dependencies.map(p=>fs.readFileSync(p)).join('')).digest('hex').slice(0,12);
const root='map-visibility/'+revision,out='dist/'+root;fs.mkdirSync(out,{recursive:true});
function write(file,value){const content=JSON.stringify(value)+'\n',path='dist/'+file;if(fs.existsSync(path)){if(fs.readFileSync(path,'utf8')!==content)throw Error('Immutable visibility index differs: '+file);return;}fs.writeFileSync(path,content);}
const modes={};
for(const [mode,source] of [['full',manifest],['radial',radialManifest]]){
 const axis=mode==='full'?0:1,nodes=[];
 function visit(id,sourceRows){
  const original=source.nodes[id],index=nodes.length,node={box:original.box,children:[],maxPixel:0,splitPixel:0};nodes.push(node);
  let batch;
  if(original.children.length){
   const axis=original.box[2]-original.box[0]>=original.box[3]-original.box[1]?'x':'y',position=r=>mode==='full'?{x:r[12],y:r[13]}:positionsByMode.radial.get(r[0]);
   sourceRows.sort((a,b)=>position(a)[axis]-position(b)[axis]||(a[0]<b[0]?-1:a[0]>b[0]?1:0));
   const middle=source.nodes[original.children[0]].count,children=[visit(original.children[0],sourceRows.slice(0,middle)),visit(original.children[1],sourceRows.slice(middle))];
   node.children=children.map(q=>q.index);batch=children.flatMap(q=>q.rows);
  }
  else{const file=mode==='full'?pointer.dataRoot+'/'+original.file:original.file;batch=sourceRows.filter(r=>pixels[r[0]]?.[axis]>=0);node.file=mode==='full'?original.file:file;}
  batch.sort((a,b)=>pixels[b[0]][axis]-pixels[a[0]][axis]||compare(a[0],b[0]));
  node.maxPixel=batch.length?pixels[batch[0][0]][axis]:-1;
  if(original.children.length){node.splitPixel=batch.length>48?pixels[batch[48][0]][axis]:-1;node.file=root+'/'+mode+'-'+index+'.json';write(node.file,batch.slice(0,48));}
  // The highest 49 thresholds suffice for all ancestors' omission bounds.
  return{index,rows:batch.slice(0,49)};
 }
 modes[mode]={nodes,roots:source.roots.map(id=>visit(id,rows.slice()).index)};
}
const boot={version:1,revision,supplementRevision:c.DistantCatalog.data.revision,catalogRevision:manifest.revision,radialRevision:radialManifest.revision,geometryVersion:c.MapLayout.version,spacing,modes,pixels};
write(root+'/manifest.json',boot);
function publish(path,content){const temp=path+'.'+process.pid+'.tmp';fs.writeFileSync(temp,content);fs.renameSync(temp,path);}
publish('dist/map-visibility-data.js',"'use strict';\n// Generated fixed per-object cartographic thresholds, in ly per CSS pixel.\nconst MAP_VISIBILITY_BOOT="+JSON.stringify(boot)+';\n');
const html=fs.readFileSync('dist/index.html','utf8').replace(/(map-visibility-data\.js\?v=)[^" ]+/,(_,prefix)=>prefix+revision);publish('dist/index.html',html);
publish('dist/map-visibility/current.json',JSON.stringify({dataRoot:root,revision})+'\n');
console.log(JSON.stringify({revision,records:objects.length,streamed:rows.length,hostScale:hostRange.size,nodes:Object.fromEntries(Object.entries(modes).map(([k,v])=>[k,v.nodes.length]))}));
