// Offline trees use the same source models and vertex projection as the game.
import fs from 'node:fs';
import vm from 'node:vm';
import {readMapCatalog} from './map-radial-catalog.mjs';
const {c,objects}=await readMapCatalog();
vm.runInContext(['map-radial-data','map-radial','regions','map-geometry-data','map-geometry'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const byId=new Map(objects.map(o=>[o.id,o]));c.MapLayout.resolve=id=>byId.get(id);
const bounds={};
for(const o of objects){o.region??=o.regionData;c.StellarClusters.prepare(o);c.Nebulae.prepare(o);const b=c.MapGeometry.indexBounds(o,'full');if(!b)continue;const p=c.MapLayout.ordinaryProject(o);bounds[o.id]=b.map((v,i)=>v+(i%2?p.y:p.x));}
fs.writeFileSync(process.argv[2],JSON.stringify(bounds));
console.log('Projected source geometry bounds:',Object.keys(bounds).length);
