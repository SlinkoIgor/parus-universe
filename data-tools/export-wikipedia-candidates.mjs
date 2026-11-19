// Read the source union, including streamed objects; never rewrite science.
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCatalogRegistry} from './build-catalog-registry.mjs';
const {objects,manifest,c} = await buildCatalogRegistry({check:true});
vm.runInContext(['sky-photos-index','sky-photos'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const photos=vm.runInContext('SkyPhotos',c);
const details=vm.runInContext('MapDetails',c);
const ownNames=o=>(o.kind==='star'?photos.keys(o).map(k=>k.slice(k.indexOf(':')+1)):photos.ownNames(o))
  .filter(name=>o.kind!=='blackhole'||!/^(?:NGC|IC|M|Messier)\s*\d+[a-z]?$/i.test(name.trim()));
const candidates=objects.filter(o=>!o.synthetic).map(o=>({
  id:o.id,name:o.name,kind:o.kind,catalogClass:o.kind==='cluster'?details.group(o):o.catalogClass,
  opticalGroup:o.opticalGroup||undefined,
  mapped:!o.atlasOnly&&!c.MapGeometry.unlocated(o),
  // Use the photograph identity rules to exclude inherited host identifiers,
  // unqualified Bayer names of components, and PHAT's alternate M### names.
  names:[...new Set([o.name,...(o.iauNames||[]),
    ...ownNames(o),
    ...(o.kind==='home'?['Sun']:[])].filter(Boolean))],
  raDeg:o.raDeg,decDeg:o.decDeg,
}));
fs.writeFileSync(process.argv[2],JSON.stringify({catalogueRevision:manifest.revision,objects:candidates}));
console.log(candidates.length+' Wikipedia candidates (including atlas-only cards)');
