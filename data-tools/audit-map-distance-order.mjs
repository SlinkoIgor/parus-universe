// Read-only catalogue census and bounded production-render checks.
// Run from any directory: node data-tools/audit-map-distance-order.mjs OUTPUT_DIR
// No user browser, save, scientific field or geometry profile is changed.
import fs from 'node:fs';import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const outputDir=path.resolve(process.argv[2]||'/tmp/parus-map-distance-audit');
process.chdir(fileURLToPath(new URL('..',import.meta.url)));fs.mkdirSync(outputDir,{recursive:true});
const catalogReport=await(async()=>{
const root=process.cwd(),prefix=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(prefix)+'#distance-audit');
const read=p=>JSON.parse(fs.readFileSync(p));
const pointer=read('dist/catalog-data/current.json'),manifest=read('dist/'+pointer.dataRoot+'/manifest.json');
const rows=(await Promise.all(manifest.nodes.filter(n=>!n.children.length).map(n=>fs.promises.readFile('dist/'+pointer.dataRoot+'/'+n.file,'utf8').then(JSON.parse)))).flat();
const core=run('OBJECTS');const radialPlacement=run('MapRadial.placement.bind(MapRadial)');const decoded=[];
for(let i=0;i<rows.length;i+=2000){context.batch=rows.slice(i,i+2000);decoded.push(...run('batch.map(r=>ExtendedCatalog.decode(r))'));}
const all=[...new Map([...core,...decoded].map(o=>[o.id,o])).values()].filter(o=>!o.atlasOnly&&!o.synthetic&&o.positionQuality!=='unknown'&&o.p3?.every(Number.isFinite));
const byid=new Map(all.map(o=>[o.id,o]));context.auditAll=all;context.auditById=byid;
run(`globalThis.auditOldResolve=MapLayout.resolve;MapLayout.resolve=id=>auditById.get(id);state=initial();paused=true;state.expansion=false;Cosmology.sync(state);`);
const radialPointer=read('dist/map-radial/current.json'),slicePointer=read('dist/map-slices/current.json');
context.auditRadialManifest=read('dist/'+radialPointer.dataRoot+'/manifest.json');context.auditRadialLayers=read('dist/'+radialPointer.dataRoot+'/layers.json');context.auditSliceManifest=read('dist/'+slicePointer.dataRoot+'/manifest.json');context.auditManifest=manifest;
run(`MapRadial.manifest=auditRadialManifest;MapRadial.layers=auditRadialLayers;MapSlice.manifest=auditSliceManifest;ExtendedCatalog.manifest=auditManifest;`);
const summary={catalogRevision:pointer.revision,profileKey:run('MapRadial.key'),counts:{all:all.length,stars:all.filter(o=>o.kind==='star').length,galaxies:all.filter(o=>o.kind==='galaxy').length},modes:{}};
const d3=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const compact=(o,p,c=[0,0,0],q={x:0,y:0})=>({id:o.id,name:o.name,kind:o.kind,dLy:o.d,trueRadiusLy:d3(o.p3,c),mapRadiusLy:Math.hypot(p.x-q.x,p.y-q.y),zLy:o.p3[2],source:o.catalog||o.source,galaxyMember:!!o.galaxyMember,parentGalaxy:o.parentGalaxy||null,positionQuality:o.positionQuality,radial:radialPlacement(o)});
for(const mode of ['full','slice','radial']){
 run(`MapSlice.setMode('${mode}');`);
 const project=run('MapLayout.project.bind(MapLayout)'),includes=run('MapSlice.includes.bind(MapSlice)'),eligible=all.filter(includes),mw=byid.get('sgr'),sun=byid.get('sol'),m31=byid.get('andromeda'),qmw=project(mw),qsun=project(sun),q31=project(m31),geometry=run("GALAXIES.find(g=>g.id==='milkyway')");
 const inside=(p,ellipse=true)=>{const x=p.x-qmw.x,y=p.y-qmw.y,a=geometry.rotation,u=x*Math.cos(a)+y*Math.sin(a),v=-x*Math.sin(a)+y*Math.cos(a);return ellipse?(u/(geometry.diameterLy/2))**2+(v/(geometry.diameterLy*geometry.axisRatio/2))**2<=1:Math.hypot(x,y)<=geometry.diameterLy/2;};
 const starPoints=eligible.filter(o=>o.kind==='star'||o.kind==='pulsar').map(o=>({o,p:project(o)}));
 const starReport={};
 for(const domain of ['ellipse','circle']){
  const points=starPoints.filter(({p})=>inside(p,domain==='ellipse'));
  const high=points.filter(({o})=>Math.abs(o.p3[2])>3000),foreign=points.filter(({o})=>o.galaxyMember&&o.parentGalaxy&&o.parentGalaxy!=='milkyway'),beyondHalo=points.filter(({o})=>d3(o.p3,mw.p3)>1e6);
  starReport[domain]={all:points.length,absZOver3000Ly:high.length,highZKinds:Object.fromEntries([...new Set(high.map(v=>v.o.kind))].map(kind=>[kind,high.filter(v=>v.o.kind===kind).length])),absZOver30000Ly:points.filter(({o})=>Math.abs(o.p3[2])>30000).length,foreignGalaxyMembers:foreign.length,maxAbsZLy:Math.max(...points.map(({o})=>Math.abs(o.p3[2]))),examples:high.sort((a,b)=>Math.abs(b.o.p3[2])-Math.abs(a.o.p3[2])).slice(0,12).map(({o,p})=>compact(o,p,mw.p3,qmw)),highZStarExamples:high.filter(v=>v.o.kind==='star').slice(0,20).map(({o,p})=>compact(o,p,mw.p3,qmw)),foreignExamples:foreign.slice(0,5).map(({o,p})=>compact(o,p,mw.p3,qmw))};
  starReport[domain].outsideConservativeHalo={boundaryLy:1e6,count:beyondHalo.length,examples:beyondHalo.slice(0,12).map(({o,p})=>compact(o,p,mw.p3,qmw))};
 }
 const galaxyReport={};
 for(const [label,c,q] of [['milkyway',mw.p3,qmw],['sun',sun.p3,qsun]]){
  const trueLimit=d3(m31.p3,c),mapLimit=Math.hypot(q31.x-q.x,q31.y-q.y),points=eligible.filter(o=>o.kind==='galaxy').map(o=>({o,p:project(o)})).filter(({p})=>Math.hypot(p.x-q.x,p.y-q.y)<=mapLimit+1e-6),far=points.filter(({o})=>d3(o.p3,c)>trueLimit+1e-6);
  galaxyReport[label]={trueLimitLy:trueLimit,mapLimitLy:mapLimit,inside:points.length,fartherThanAndromeda:far.length,maxTrueDistanceLy:Math.max(...far.map(({o})=>d3(o.p3,c))),examples:far.sort((a,b)=>d3(b.o.p3,c)-d3(a.o.p3,c)).map(({o,p})=>compact(o,p,c,q))};
 }
 const nearStars=eligible.filter(o=>o.kind==='star').map(o=>compact(o,project(o),sun.p3,qsun));
 const nearest100={};
 for(const [kind,origin,q] of [['star',sun,qsun],['galaxy',mw,qmw]]){
  const records=eligible.filter(o=>o.kind===kind&&o.id!==origin.id).map(o=>compact(o,project(o),origin.p3,q));
  const physical=records.slice().sort((a,b)=>a.trueRadiusLy-b.trueRadiusLy||a.id.localeCompare(b.id)).slice(0,100),mapped=records.slice().sort((a,b)=>a.mapRadiusLy-b.mapRadiusLy||a.id.localeCompare(b.id)).slice(0,100);
  nearest100[kind]={orderMatches:physical.every((o,i)=>o.id===mapped[i]?.id),lastPhysicalRadiusLy:physical.at(-1)?.trueRadiusLy??null,physical:physical.map(o=>({id:o.id,trueRadiusLy:o.trueRadiusLy,mapRadiusLy:o.mapRadiusLy})),mapped:mapped.map(o=>o.id)};
  const prefix=run('MapRadial.profile.distanceDomains?.find(d=>d.countKind==="galaxy")?.coverageCatalog?.prefix');
  if(kind==='galaxy'&&prefix){const p=records.filter(o=>o.id.startsWith(prefix)).sort((a,b)=>a.trueRadiusLy-b.trueRadiusLy||a.id.localeCompare(b.id)).slice(0,100),m=records.filter(o=>o.id.startsWith(prefix)).sort((a,b)=>a.mapRadiusLy-b.mapRadiusLy||a.id.localeCompare(b.id)).slice(0,100);nearest100[kind].singleCatalog={prefix,orderMatches:p.every((o,i)=>o.id===m[i]?.id),lastPhysicalRadiusLy:p.at(-1)?.trueRadiusLy??null,physical:p.map(o=>({id:o.id,trueRadiusLy:o.trueRadiusLy,mapRadiusLy:o.mapRadiusLy})),mapped:m.map(o=>o.id)};}
 }
 summary.modes[mode]={stars:starReport,galaxies:galaxyReport,nearest100,nearestTrue:nearStars.slice().sort((a,b)=>a.trueRadiusLy-b.trueRadiusLy).slice(0,12),nearestMap:nearStars.slice().sort((a,b)=>a.mapRadiusLy-b.mapRadiusLy).slice(0,15)};
 console.log(mode,JSON.stringify({stars:Object.fromEntries(Object.entries(starReport).map(([k,v])=>[k,{all:v.all,highZ:v.absZOver3000Ly,veryHighZ:v.absZOver30000Ly,foreign:v.foreignGalaxyMembers,maxZ:v.maxAbsZLy}])),galaxies:Object.fromEntries(Object.entries(galaxyReport).map(([k,v])=>[k,{inside:v.inside,far:v.fartherThanAndromeda,maxTrue:v.maxTrueDistanceLy}]))}));
}
summary.alphaAB=run(`(()=>{const a=object('alpha'),b=object('hyg-71453'),q=OrbitalMotion.alphaAB;return{catalogSeparationLy:Space.distance(a,b),orbitalApastronLy:q.a*(1+q.e)*OrbitalMotion.AU,sourceA:a.source,sourceB:b.source,catalogDistanceA:a.d,catalogDistanceB:b.d};})()`);
fs.writeFileSync(outputDir+'/catalog.json',JSON.stringify(summary,null,2)+'\n');
console.log('nearest true',summary.modes.radial.nearestTrue.map(o=>[o.id,o.name,o.trueRadiusLy,o.mapRadiusLy]));
console.log('nearest map',summary.modes.radial.nearestMap.map(o=>[o.id,o.name,o.trueRadiusLy,o.mapRadiusLy]));

return summary;
})();
const frameReport=await(async()=>{
const prefix=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(prefix)+'#distance-frames');
const read=p=>JSON.parse(fs.readFileSync(p));
const fullPointer=read('dist/catalog-data/current.json'),radialPointer=read('dist/map-radial/current.json'),slicePointer=read('dist/map-slices/current.json');
context.auditRead=async path=>{if(path.startsWith('catalog-data/'))path=fullPointer.dataRoot+'/'+path.slice(13);return JSON.parse(await fs.promises.readFile('dist/'+path,'utf8'));};
context.auditFull=read('dist/'+fullPointer.dataRoot+'/manifest.json');context.auditRadial=read('dist/'+radialPointer.dataRoot+'/manifest.json');context.auditLayers=read('dist/'+radialPointer.dataRoot+'/layers.json');context.auditSlice=read('dist/'+slicePointer.dataRoot+'/manifest.json');
run(`ExtendedCatalog.readJSON=path=>auditRead(path);ExtendedCatalog.manifest=auditFull;MapRadial.manifest=auditRadial;MapRadial.layers=auditLayers;MapSlice.manifest=auditSlice;MapLayers.active=true;state=initial();state.expansion=false;Cosmology.sync(state);paused=true;width=1440;height=1000;dpr=1;cameraGoal=null;`);
const audit=catalogReport;const results=[];
async function frame(mode,view,label){
 context.auditView=view;run(`MapSlice.setMode('${mode}');cam={...auditView};cameraGoal=null;filter='all';`);
 let loaded=false;
 for(let cycle=0;cycle<180;cycle++){
  run(`ExtendedCatalog.lastUpdate=-Infinity;MapLayers.lastUpdate=-Infinity;ExtendedCatalog.update(${1e6+cycle*1000});MapLayers.update(${1e6+cycle*1000});`);
  const promises=run('[...ExtendedCatalog.inflight.values(),...MapLayers.inflight.values()]');if(promises.length)await Promise.all(promises);
  loaded=run(`ExtendedCatalog.wanted.every(f=>ExtendedCatalog.cache.has(f))&&[...MapLayers.filesForView(cam,width,height).values()].flat().every(f=>MapLayers.cache.has(f))`);
  if(loaded){run(`ExtendedCatalog.lastUpdate=-Infinity;MapLayers.lastUpdate=-Infinity;ExtendedCatalog.update(2e6);MapLayers.update(2e6);ExtendedCatalog.advanceVisibility(3e6);`);break;}
 }
 assert.ok(loaded,'complete bounded production cut');
 const result=run(`(()=>{
  hitObjects=[];RegionMap.hits=[];RegionMap.renderCache=null;MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
  const mw=object('sgr'),sun=object('sol'),m31=object('andromeda'),g=GALAXIES.find(g=>g.id==='milkyway'),qmw=MapLayout.project(mw),q31=MapLayout.project(m31),qsun=MapLayout.project(sun),trueLimit=Space.distance(mw,m31),mapLimit=Math.hypot(q31.x-qmw.x,q31.y-qmw.y);
  const compact=o=>{const p=MapLayout.project(o);return{id:o.id,name:o.name,kind:o.kind,dLy:o.d,zLy:o.p3[2],trueRadiusLy:Space.distance(mw,o),mapRadiusLy:Math.hypot(p.x-qmw.x,p.y-qmw.y),parentGalaxy:o.parentGalaxy||null,distanceHost:o.distanceHost||null};};
  const drawn=[...new Map(hitObjects.map(h=>[h.o.id,h.o])).values()];
  const inMW=drawn.filter(o=>['star','pulsar'].includes(o.kind)).filter(o=>{const p=MapLayout.project(o),dx=p.x-qmw.x,dy=p.y-qmw.y,u=dx*Math.cos(g.rotation)+dy*Math.sin(g.rotation),v=-dx*Math.sin(g.rotation)+dy*Math.cos(g.rotation);return(u/(g.diameterLy/2))**2+(v/(g.diameterLy*g.axisRatio/2))**2<=1;});
  const inM31=drawn.filter(o=>o.kind==='galaxy'&&Math.hypot(MapLayout.project(o).x-qmw.x,MapLayout.project(o).y-qmw.y)<=mapLimit);
  const starRadii=drawn.filter(o=>o.kind==='star').map(o=>({...compact(o),solarMapRadiusLy:Math.hypot(MapLayout.project(o).x-qsun.x,MapLayout.project(o).y-qsun.y)})).sort((a,b)=>a.solarMapRadiusLy-b.solarMapRadiusLy);
  return{pointCut:ExtendedCatalog.visible.length,structuralCut:MapLayers.visible.length,drawn:drawn.length,starsInsideMW:inMW.length,highZStars:inMW.filter(o=>Math.abs(o.p3[2])>3000).map(compact),foreignGalaxyStars:inMW.filter(o=>o.galaxyMember&&o.parentGalaxy&&o.parentGalaxy!=='milkyway').map(compact),galaxiesInsideM31:inM31.length,farGalaxies:inM31.filter(o=>Space.distance(mw,o)>trueLimit).map(compact),nearestDrawnStars:starRadii.slice(0,15)};
 })()`);
 results.push({label,mode,view,result});console.log(label,mode,JSON.stringify({points:result.pointCut,structural:result.structuralCut,drawn:result.drawn,starsInsideMW:result.starsInsideMW,highZ:result.highZStars.length,foreign:result.foreignGalaxyStars.length,insideM31:result.galaxiesInsideM31,farM31:result.farGalaxies.length}));
}
const mw=run("MapLayout.ordinaryProject(object('sgr'))");
for(const mode of ['full','slice','radial']){
 await frame(mode,{...mw,span:130000},'MW overview');
 await frame(mode,{x:0,y:0,span:7e6},'Local Group overview');
 await frame(mode,{x:0,y:0,span:24},'Solar neighbourhood');
}
const candidate=audit.modes.radial.stars.ellipse.examples[0],search=read('dist/'+fullPointer.dataRoot+'/search.json'),entry=search.find(r=>r[0]===candidate.id);
context.auditEntry={id:entry[0],tile:entry[5]};await run(`(async()=>{const o=await ExtendedCatalog.resolve(auditEntry);globalThis.auditTarget=o;})();`);
const p=run(`MapSlice.setMode('radial');MapLayout.project(auditTarget)`);await frame('radial',{...p,span:1200},'High Z star close-up');
console.log('high Z candidate',candidate.id,run('JSON.stringify({id:auditTarget.id,name:auditTarget.name,kind:auditTarget.kind,p3:auditTarget.p3,distanceHost:auditTarget.distanceHost,positionEstimate:auditTarget.positionEstimate})'));
console.log('alpha objects',run(`JSON.stringify(['sol','proxima','hyg-71453','alpha'].map(id=>{const o=object(id);return{id,name:o.name,d:o.d,p3:o.p3,boundSystemPrimary:o.boundSystemPrimary,distanceMethod:o.distanceMethod,catalog:o.catalog,source:o.source,coordinateNote:o.coordinateNote,facts:o.facts};}))`));
fs.writeFileSync(outputDir+'/frames.json',JSON.stringify(results,null,2)+'\n');
return results;
})();

const radial=catalogReport.modes.radial,frames=frameReport.filter(f=>f.mode==='radial');
const firstThree=radial.nearestTrue.slice(0,3).map(o=>o.id),alphaIds=['proxima','alpha','hyg-71453'];
assert.equal(new Set(firstThree).size,3);assert.ok(firstThree.every(id=>alphaIds.includes(id)),'the three Alpha components are physically nearest catalogued stars, excluding the Sun');
const report={catalogRevision:catalogReport.catalogRevision,profileKey:catalogReport.profileKey,
 definitions:{epoch:'reference epoch; cosmological time zero',milkyWay:'actual displayed ellipse: diameter 100000 ly, axis ratio 0.55, rotation -0.5; centred on Sgr A*',height:'abs(heliocentric Galactic Z) > 3000 ly is a cartographic disk threshold, NOT a test for membership of the Milky Way halo',galaxyOrder:'object centres; 3D and 2D radii both measured from Sgr A*; true M31 radius '+radial.galaxies.milkyway.trueLimitLy+' ly',counts:'catalogue records, not deduplicated physical objects or simultaneous frame counts',frame:'1440 x 1000; all filter; real point-tree cuts, complete structural layers, fades settled; canvas stub font metrics, actual hit-producing render paths; not the user camera/save'},
 findings:{allowedOffDiskStarRecordsInsideMW:radial.stars.ellipse.absZOver3000Ly,highZKinds:radial.stars.ellipse.highZKinds,confirmedForeignGalaxyStarRecordsInsideMW:radial.stars.ellipse.foreignGalaxyMembers,beyondConservativeHaloInsideMW:radial.stars.ellipse.outsideConservativeHalo.count,fartherGalaxyRecordsInsideM31:radial.galaxies.milkyway.fartherThanAndromeda,nearest100StarsMatch:radial.nearest100.star.orderMatches,nearest100GalaxiesMatch:radial.nearest100.galaxy.orderMatches,nearest100GalaxiesSingleCatalogMatch:radial.nearest100.galaxy.singleCatalog?.orderMatches??null,physicallyNearestThreeAreAlpha:true,screenNearestThreeAreAlpha:radial.nearestMap.slice(0,3).every(o=>alphaIds.includes(o.id)),alphaABDataConsistentWithOrbit:catalogReport.alphaAB.catalogSeparationLy<=catalogReport.alphaAB.orbitalApastronLy},
 frames:frames.map(f=>({label:f.label,view:f.view,highZ:f.result.highZStars.length,farGalaxies:f.result.farGalaxies.length,foreign:f.result.foreignGalaxyStars.length})),alphaAB:catalogReport.alphaAB,
 notes:['Galactic halo overlap with the disc is allowed. Only explicit foreign-galaxy membership or a galactocentric distance beyond a conservative cartographic 1 million ly halo boundary is flagged; this does not infer membership for unknown records.','The v3 frozen exact-distance spheres cover 1000 ly around the Sun for stellar objects and 15 million ly around Sgr A* for galaxy centres. Farther objects cannot enter those spheres on the map.','Nearest-100 checks compare actual public render positions at the reference epoch, including rigid XY orbital display frames; individual component radii are an explicit exception while nearest-object order must remain correct. Mixed counts can include cross-catalogue aliases. A second nearest-100 check in the single UNGC catalogue independently verifies distinct-object coverage without spatial deduplication.','Alpha A/B/C use the adopted joint reference configuration and shared 3D orbital animation in every mode. Navigation remains at the reference epoch; no interception is claimed.']};
fs.writeFileSync(outputDir+'/summary.json',JSON.stringify(report,null,2)+'\n');console.log('Audit summary',JSON.stringify(report.findings));console.log('Reports:',outputDir);
