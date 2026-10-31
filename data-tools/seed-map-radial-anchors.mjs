// Explicit one-time creation of a NEW registry. Never run by normal builds.
// Existing files are protected; adopting new anchors is a profile revision.
import fs from 'node:fs';import {readMapCatalog} from './map-radial-catalog.mjs';
const [output]=process.argv.slice(2);if(!output||fs.existsSync(output))throw Error('Provide a NEW output path; existing anchor registries are immutable');
const current=JSON.parse(fs.readFileSync('data-tools/map-radial-current.json'));
const {c,objects,manifest}=await readMapCatalog(),profile=JSON.parse(fs.readFileSync(current.profile));
const byid=new Map(objects.map(o=>[o.id,o])),refs=new Set([...profile.protected,...profile.localDomains.map(d=>d.host)]),groups=new Map(),pgcs=new Map();
for(const o of objects){
 for(const d of [o.catalogData,...(o.catalogMeasurements||[]).map(m=>m.data)].filter(Boolean)){
  if(d.PGC&&!pgcs.has(String(d.PGC)))pgcs.set(String(d.PGC),o);
  if(d.groupPGC){const key=String(d.groupPGC),members=groups.get(key)||new Set();members.add(o.id);groups.set(key,members);}
 }
 const host=c.MapLayout.anchorId(o);if(host)refs.add(host);
}
byid.set('milkyway',{...byid.get('sgr'),id:'milkyway',name:'Млечный Путь',kind:'galaxy'});
const fields=['id','name','kind','p3','mapPosition','mapOffset','synthetic','parentObject','positionEstimate','distanceHost','boundSystemPrimary','galaxyMember','parentGalaxy','catalogData','catalogMeasurements'];
const anchors=Object.fromEntries([...refs].sort().filter(k=>byid.get(k)?.p3).map(k=>[k,Object.fromEntries(fields.filter(f=>byid.get(k)[f]!==undefined).map(f=>[f,byid.get(k)[f]]))])),groupmap={};
for(const [key,members] of [...groups].sort((a,b)=>+a[0]-b[0])){
 if(members.size<2||!pgcs.has(key))continue;
 const o=pgcs.get(key),id='cf4-group:'+key;
 anchors[id]={id,name:'CF4 · PGC '+key,kind:'group-anchor',p3:o.p3,primaryId:o.id,source:'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94',sourceField:'1PGC',catalogRevision:manifest.revision,positionSource:o.referenceURL||o.source||o.catalog||null,positionDistanceMethod:o.distanceMethod||null,...(o.distanceRelativeError!=null?{distanceRelativeError:o.distanceRelativeError}:{}),...(o.distanceUncertaintyLy!=null?{distanceUncertaintyLy:o.distanceUncertaintyLy}:{})};
 groupmap[key]=id;
}
const seed={version:1,catalogRevision:manifest.revision,note:'Frozen reference-epoch anchors. Builders must not refit this registry. New groups require a new profile/registry revision.',anchors,groups:groupmap};
fs.writeFileSync(output,JSON.stringify(seed)+'\n');console.log(JSON.stringify({anchors:Object.keys(anchors).length,groups:Object.keys(groupmap).length,output}));
