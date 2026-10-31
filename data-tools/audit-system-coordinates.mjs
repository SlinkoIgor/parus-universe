// Read-only audit of catalogue merges and relative system geometry.
// node data-tools/audit-system-coordinates.mjs OUTPUT_DIR [--check]
// Review flags are not assertions of gravitational binding or wrong measurements.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readMapCatalog} from './map-radial-catalog.mjs';

process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const output=path.resolve(process.argv[2]||'/tmp/parus-system-coordinates');
fs.mkdirSync(output,{recursive:true});
const {c,core,objects,manifest}=await readMapCatalog();
const boot=vm.runInContext('EXTENDED_BOOT',c);
const byid=new Map(objects.map(o=>[o.id,o]));
const AU=63241.077;
const distance=(a,b)=>Math.hypot(...a.p3.map((n,i)=>n-b.p3[i]));
const located=o=>o?.p3?.every(Number.isFinite)&&!o.atlasOnly;
const systems=[];
for(const s of boot.systems){
 const members=s.members.map(id=>byid.get(id)).filter(located),pairs=[];
 for(const [aId,bId] of s.links){
  const a=byid.get(aId),b=byid.get(bId);if(!located(a)||!located(b))continue;
  const r=distance(a,b),radial=Math.abs(a.d-b.d),mean=(a.d+b.d)/2;
  const cosine=a.p3.reduce((sum,n,i)=>sum+n*b.p3[i],0)/Math.hypot(...a.p3)/Math.hypot(...b.p3);
  const angle=Math.acos(Math.max(-1,Math.min(1,cosine))),transverse=mean*angle;
  pairs.push({a:a.id,b:b.id,separationLy:r,separationAu:r*AU,radialDifferenceLy:radial,radialDifferenceAu:radial*AU,relativeDistanceDifference:radial/mean,angularSeparationArcsec:angle*180/Math.PI*3600,radialToSkyRatio:transverse>0?radial/transverse:null,
   review:radial>100*transverse?'depth-dominates-projected-separation-100x':null});
 }
 systems.push({id:s.id,name:s.name,confirmed:!!s.confirmed,relationship:s.relationship||null,associationOnly:!!s.associationOnly,source:s.source,totalMembers:s.members.length,locatedMembers:members.length,pairs});
}

// Capture actual pre-merge/imported values rather than attributing the adopted
// core distance to HYG. CSV rows are parsed by Python's standard CSV reader.
const hyg=JSON.parse(execFileSync('python3',['-c',
 "import csv,json; print(json.dumps({r['id']:{k:r[k] for k in ['id','hip','proper','ra','dec','dist','base','comp','comp_primary']} for r in csv.DictReader(open('data-tools/raw/hyg_v41.csv'))}))"
],{encoding:'utf8',maxBuffer:50*1024*1024}));
const stage=vm.createContext({console});
vm.runInContext(['catalog','astronomy','catalog-import'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),stage);
const original=vm.runInContext('OBJECTS',stage),imported=vm.runInContext('IMPORTED_CATALOG',stage);
const adoptedDifferences=[];
for(const o of core){
 if(o.hygId==null)continue;const row=hyg[String(o.hygId)];if(!row||!(+row.dist>0&&+row.dist<100000))continue;
 const importedDistance=+row.dist*3.2615637771674336;
 if(Math.abs(o.d-importedDistance)>1e-6)adoptedDifferences.push({id:o.id,name:o.name,hygId:o.hygId,adoptedDistanceLy:o.d,hygDistanceLy:importedDistance,relativeDifference:(o.d-importedDistance)/importedDistance,astrometrySource:o.astrometrySource||null,uncertaintyMatched:!!o.uncertaintyMatched});
}
const alphaIds=['alpha','hyg-71453','proxima'];
const policy=JSON.parse(fs.readFileSync('data-tools/coordinate-policy.json','utf8'));
const uncertaintyMismatches=core.filter(o=>o.uncertaintyMatched&&o.parallaxMas>0&&o.d>0&&Math.abs(o.d/3.2615637771674336-1000/o.parallaxMas)>policy.hygDistanceMatchTolerancePc).map(o=>({id:o.id,name:o.name,adoptedDistanceLy:o.d,solutionDistanceLy:1000/o.parallaxMas*3.2615637771674336,parallaxMas:o.parallaxMas,distanceRelativeError:o.distanceRelativeError,astrometrySource:o.astrometrySource,note:'The claimed matched formal error belongs to a different nominal distance solution. Legacy rounding may explain the numerical difference but does not preserve full-precision astrometry provenance.'}));
const alphaStages=alphaIds.map(id=>{
 const o=byid.get(id),row=hyg[String(o.hygId)],entry=imported.objects.find(q=>q.hygId===o.hygId),old=original.find(q=>q.id===id);
 return{id,name:o.name,hyg:row,originalCore:old?{distanceLy:old.d}:null,imported:entry?{distanceLy:entry.d,raDeg:entry.raDeg,decDeg:entry.decDeg,source:entry.source}:null,final:{distanceLy:o.d,p3:o.p3,astrometrySource:o.astrometrySource||null,uncertaintyMatched:!!o.uncertaintyMatched,boundSystemPrimary:o.boundSystemPrimary||null}};
});
vm.runInContext(fs.readFileSync('dist/orbital-motion.js','utf8'),c);
const orbit=vm.runInContext('({aAu:OrbitalMotion.alphaAB.a,e:OrbitalMotion.alphaAB.e,source:OrbitalMotion.sources.alphaAB})',c);
const alphaSystem=systems.find(s=>s.id==='system-alpha-centauri'),ab=alphaSystem.pairs.find(p=>[p.a,p.b].includes('hyg-71453'));
const maxOrbitAu=orbit.aAu*(1+orbit.e),conflict=ab.separationAu>maxOrbitAu;
const currentAudit=JSON.parse(fs.readFileSync('data-tools/system-position-audit.json','utf8'));
const confirmedStellar=systems.filter(s=>s.confirmed&&s.relationship==='bound'&&s.pairs.some(p=>[p.a,p.b].some(id=>byid.get(id)?.kind==='star')));
const report={catalogRevision:manifest.revision,
 summary:{systems:systems.length,linkedPairs:systems.reduce((n,s)=>n+s.pairs.length,0),confirmedStellarSystems:confirmedStellar.length,adoptedCoreDistancesDifferentFromHYG:adoptedDifferences.length,formalUncertaintyDistanceMismatches:uncertaintyMismatches.length,depthDominatedPairsForReview:systems.reduce((n,s)=>n+s.pairs.filter(p=>p.review).length,0),alphaCatalogueConflictsWithAdoptedOrbit:conflict},
 alpha:{stages:alphaStages,catalogueSeparationAu:ab.separationAu,adoptedOrbitMaxSeparationAu:maxOrbitAu,excessFactor:ab.separationAu/maxOrbitAu,orbitSource:orbit.source,existingReconciliationActions:currentAudit.filter(q=>q.system==='system-alpha-centauri')},
 confirmedStellar,adoptedDifferences,uncertaintyMismatches,systems,
 limitations:[
  'HYG multiplicity is not itself proof of binding. Depth-to-sky flags identify candidates for review, never automatic distance corrections.',
  'Different adopted and HYG distances are not automatically errors: a documented independent measurement can be preferable.',
  'Only Alpha AB has an orbital size constraint checked here, from the already adopted published model. No orbit sizes or individual uncertainties are invented for other systems.',
  'The defect reproduces on a fresh catalogue load, without browser saves or projection. Restore code can only be certified by separate save-migration tests.',
  'Equal component distances alone do not provide measured orbital depths. A joint astrometric/orbital solution and common epoch are needed for physical component XYZ.'
 ]};
fs.writeFileSync(path.join(output,'system-coordinates.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,alpha:{separationAu:ab.separationAu,maxOrbitAu,excessFactor:ab.separationAu/maxOrbitAu},confirmedStellar:confirmedStellar.map(s=>({id:s.id,pairs:s.pairs})),output},null,2));
if(process.argv.includes('--check')&&(conflict||uncertaintyMismatches.length))process.exitCode=2;
