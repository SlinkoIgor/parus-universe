// Read the final imported/merged catalogue, including current core policies.
import fs from 'node:fs';import vm from 'node:vm';
export async function readMapCatalog(){
 const c=vm.createContext({console});
 vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','layout-data','map-layout','cosmology','map-details','catalog-extended','catalog-stream'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
 const core=vm.runInContext('OBJECTS',c),sky=vm.runInContext('Space.fromSky.bind(Space)',c),pointer=JSON.parse(fs.readFileSync('dist/catalog-data/current.json')),manifest=JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/manifest.json'));
 // Bound open files and buffers without changing the manifest's row order.
 const leaves=manifest.nodes.filter(n=>!n.children.length),parts=new Array(leaves.length);let cursor=0;
 await Promise.all(Array.from({length:16},async()=>{for(;;){const i=cursor++;if(i>=leaves.length)return;parts[i]=JSON.parse(await fs.promises.readFile('dist/'+pointer.dataRoot+'/'+leaves[i].file,'utf8'));}}));
 const rows=parts.flat();
 const objects=[...core,...rows.map(r=>({id:r[0],name:r[1],kind:r[2],d:r[3],aliases:r[8],distanceMethod:r[7],positionQuality:r[6],source:r[10],...r[11],p3:r[11].p3||sky(r[4],r[5],r[3]),mapPosition:{x:r[12],y:r[13]}}))];
 return{c,core,rows,objects,manifest,pointer};
}
