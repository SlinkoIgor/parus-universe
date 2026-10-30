// One projection implementation for offline indexes, runtime and save migration.
// Input/output are temporary build snapshots, never scientific source catalogs.
import fs from 'node:fs';
import vm from 'node:vm';
const [input,output]=process.argv.slice(2),data=JSON.parse(fs.readFileSync(input));
const context=vm.createContext({console});
vm.runInContext(['catalog','astronomy','catalog-import','catalog-retired','coordinates','cosmic-catalog','layout-data','map-layout'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),context);
const layout=context.MapLayout,sky=vm.runInContext('Space.fromSky.bind(Space)',context),objects=new Map(),coreIds=new Set(data.core.map(o=>o.id));
for(const o of data.core){const p=data.patches[o.id],policy=data.policies[o.id];objects.set(o.id,{...o,...p,...policy,p3:p?.p3||(p?sky(p.raDeg,p.decDeg,p.d):o.p3),mapPosition:p?{x:p.display[0],y:p.display[1]}:o.display});}
for(const r of [...data.records,...data.members])objects.set(r[0],{id:r[0],kind:r[2],d:r[3],...r[11],p3:r[11].p3||(r[3]>0?sky(r[4],r[5],r[3]):null),mapPosition:{x:r[12],y:r[13]}});
const resolve=id=>objects.get(id),offsets=new Map();
for(const o of objects.values())if(o.p3&&Number.isFinite(o.mapPosition.x)&&Number.isFinite(o.mapPosition.y))offsets.set(o.id,layout.displacement(o,o.mapPosition,resolve));
let shifted=0;
for(const [id,d] of offsets){if(!d.x&&!d.y)continue;shifted++;if(coreIds.has(id)){
 data.policies[id]={...data.policies[id],mapOffset:[d.x,d.y],mapGeometry:layout.version};const p=data.patches[id];if(p){p.display[0]+=d.x;p.display[1]+=d.y;}
}}
for(const r of [...data.records,...data.members]){const d=offsets.get(r[0]);if(d&&(d.x||d.y)){r[12]+=d.x;r[13]+=d.y;r[11].mapOffset=[d.x,d.y];}}
fs.writeFileSync(output,JSON.stringify({patches:data.patches,policies:data.policies,records:data.records,members:data.members,geometryVersion:layout.version}));
console.log('Display-only Milky Way lift:',shifted,'objects; layout',layout.version);
