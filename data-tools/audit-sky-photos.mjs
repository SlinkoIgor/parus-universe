// Count actual catalogue matches separately from the size of the image archive.
// Read-only: uses the installed snapshot; never rebuilds science or saves.
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({console,Math,URL});
for(const name of ['catalog','astronomy','catalog-import','catalog-retired','coordinates',
  'cosmic-catalog','layout-data','map-layout','map-radial-data','map-radial','map-slice',
  'cosmology','map-details','catalog-extended','catalog-stream','nuclear-stars-data',
  'nuclear-stars','orbital-motion','sky-photos-index','sky-photos']) {
  vm.runInContext(fs.readFileSync('dist/'+name+'.js','utf8'),context);
}
const run=s=>vm.runInContext(s,context),objects=new Map(run('OBJECTS').map(o=>[o.id,o]));
const dir='dist/'+JSON.parse(fs.readFileSync('dist/catalog-data/current.json')).dataRoot;
context.photoSearch=JSON.parse(fs.readFileSync(dir+'/search.json'));
const candidates=run(`photoSearch.filter(r=>{
 const kind=['galaxy','nebula','cluster'].includes(r[2])?'deep-sky':r[2];
 return r[6].split('|').some(w=>SKY_PHOTO_INDEX.targets[kind+':'+SkyPhotos.key(w)]);
}).map(r=>[r[0],r[5]])`),wanted=new Set(candidates.map(r=>r[0]));
for(const file of new Set(candidates.map(r=>r[1]))) {
  context.photoRows=JSON.parse(fs.readFileSync(dir+'/'+file));
  for(const o of run('photoRows.map(r=>ExtendedCatalog.decode(r))'))if(wanted.has(o.id)&&!objects.has(o.id))objects.set(o.id,o);
}
context.photoAuditObjects=[...objects.values()];
const matches=run(`photoAuditObjects.map(o=>({id:o.id,name:o.name,kind:o.kind,photos:SkyPhotos.ids(o)})).filter(o=>o.photos.length)`);
const classes={};for(const o of matches)classes[o.kind]=(classes[o.kind]||0)+1;
const result={catalogue:JSON.parse(fs.readFileSync('dist/catalog-data/current.json')).revision,
  imageRevision:run('SKY_PHOTO_INDEX.revision'),archiveImages:run('SKY_PHOTO_INDEX.photoCount'),
  matchedImages:new Set(matches.flatMap(o=>o.photos)).size,objects:matches.length,classes,matches};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,matches:undefined},null,2));
