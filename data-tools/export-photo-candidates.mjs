// Read-only export of located galaxies for exact external image identification.
import fs from 'node:fs';
import {buildCatalogRegistry} from './build-catalog-registry.mjs';
const {objects, manifest} = await buildCatalogRegistry({check:true});
const galaxies=objects.filter(o=>o.kind==='galaxy'&&!o.atlasOnly&&!o.supersededBy&&!o.synthetic&&
  Number.isFinite(o.d)&&o.d>0&&Number.isFinite(o.raDeg)&&Number.isFinite(o.decDeg));
const payload={catalogueRevision:manifest.revision,objects:galaxies.map(o=>({
  id:o.id,name:o.name,raDeg:o.raDeg,decDeg:o.decDeg,ngc:o.ngc,messier:o.messier,aliases:o.aliases
}))};
fs.writeFileSync(process.argv[2],JSON.stringify(payload));
console.log(galaxies.length+' located galaxy candidates');
