// One implementation for offline indexes, runtime, search and restored objects.
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import {readMapCatalog} from './map-radial-catalog.mjs';
const [output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const current=read('data-tools/map-radial-current.json'),profile=read(current.profile),seed=read(current.anchors);
const data={profile,profileRevision:crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0,16),anchorRevision:crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex').slice(0,16),anchors:seed.anchors,groups:seed.groups};
for(const d of profile.distanceDomains||[])if(!seed.anchors[d.origin]?.p3||!(d.radiusLy>0)||!d.kinds.includes(d.countKind))throw Error('Invalid fixed distance domain '+d.id);
const {c,objects,manifest}=await readMapCatalog();
vm.runInContext('const RADIAL_DATA='+JSON.stringify(data)+';\n'+fs.readFileSync('dist/map-radial.js','utf8'),c);
const layout=c.MapRadial;
const byid=new Map(objects.map(o=>[o.id,o]));c.MapLayout.resolve=id=>byid.get(id);
const placements={},counts={},warnings={},parents={};
for(const o of objects){if(o.atlasOnly)continue;const p=layout.placement(o);if(!Number.isFinite(p.position.x)||!Number.isFinite(p.position.y))throw Error('Invalid placement '+o.id);placements[o.id]=p;counts[p.rule]=(counts[p.rule]||0)+1;if(p.warning)warnings[p.warning]=(warnings[p.warning]||0)+1;if(p.parent)parents[p.parent]=(parents[p.parent]||0)+1;}
const domains={};
for(const d of profile.distanceDomains||[]){
 const host=layout.resolve(d.origin),centre=layout.placement(host).position;
 const members=[...byid.values()].filter(o=>!o.atlasOnly&&!o.synthetic&&o.positionQuality!=='unknown'&&o.p3?.every(Number.isFinite)&&d.kinds.includes(layout.category(o))&&o.id!==d.origin);
 const radii=members.map(o=>({id:o.id,kind:o.kind,rigid:placements[o.id].frame==='rigid-xy',r:Math.hypot(...o.p3.map((v,i)=>v-host.p3[i])),m:Math.hypot(placements[o.id].position.x-centre.x,placements[o.id].position.y-centre.y)}));
 const nearest=radii.filter(o=>o.kind===d.countKind).sort((a,b)=>a.r-b.r||a.id.localeCompare(b.id));
 if(nearest.length<d.minimumCount||nearest[d.minimumCount-1].r>d.radiusLy)throw Error('Nearest '+d.minimumCount+' no longer fit fixed distance domain '+d.id+'; review a new profile, do not refit automatically');
 for(const o of radii.filter(o=>!o.rigid))if(o.r<=d.radiusLy?Math.abs(o.r-o.m)>Math.max(1e-6,o.r*1e-12):o.m<d.radiusLy)throw Error('Distance invariant failed for '+o.id);
 domains[d.id]={origin:d.origin,radiusLy:d.radiusLy,exactRecords:radii.filter(o=>!o.rigid&&o.r<=d.radiusLy).length,rigidMemberExceptions:radii.filter(o=>o.rigid).length,nearestCount:d.minimumCount,lastNearestRadiusLy:nearest[d.minimumCount-1].r,violations:0};
 if(d.coverageCatalog){
  const coverage=nearest.filter(o=>o.id.startsWith(d.coverageCatalog.prefix)),n=d.coverageCatalog.minimumCount;
  if(coverage.length<n||coverage[n-1].r>d.radiusLy)throw Error('Independent single-catalogue coverage no longer fits '+d.id+'; review a new profile');
  domains[d.id].coverageCatalog={...d.coverageCatalog,inside:coverage.filter(o=>o.r<=d.radiusLy).length,lastRequiredRadiusLy:coverage[n-1].r};
 }
}
vm.runInContext(['regions','map-geometry-data','map-geometry'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const geometryBounds={};
for(const o of objects){o.region??=o.regionData;c.StellarClusters.prepare(o);c.Nebulae.prepare(o);const b=c.MapGeometry.indexBounds(o,'radial');if(!b)continue;const p=placements[o.id]?.position;if(p)geometryBounds[o.id]=b.map((v,i)=>v+(i%2?p.y:p.x));}
fs.writeFileSync(output,JSON.stringify({runtimeData:data,profileKey:layout.key,catalogRevision:manifest.revision,geometryVersion:c.MapLayout.version,counts,warnings,parents,domains,placements,geometryBounds}));
console.log(JSON.stringify({profileKey:layout.key,counts,warnings}));
