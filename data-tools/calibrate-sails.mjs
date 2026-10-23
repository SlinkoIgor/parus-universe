import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('dist/physics.js','utf8'),ctx);
const targets=[.999,.99999,.9999999],areas=[];
for(const target of targets){let lo=1,hi=1e18;for(let i=0;i<65;i++){const area=Math.sqrt(lo*hi),beta=vm.runInContext('Stellar.plan(1.5,'+area+').beta',ctx);if(beta<target)lo=area;else hi=area;}areas.push((lo+hi)/2);}
const p='dist/catalog.js';let source=fs.readFileSync(p,'utf8');source=source.replace(/const SAILS=\[[^\n]+/, 'const SAILS='+JSON.stringify(areas.map((areaM2,i)=>({name:['S','M','L'][i],areaM2,referenceMassKg:1.5,targetBeta:targets[i]})))+';');fs.writeFileSync(p,source);console.log(areas);
