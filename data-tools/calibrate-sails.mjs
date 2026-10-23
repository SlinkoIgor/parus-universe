import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('dist/physics.js','utf8'),ctx);
const sails=[['S',1e-4,.99999],['M',1,.9999999],['L',1e4,.999999999]].map(([name,f,targetBeta])=>({name,areaM2:4719276145413.182*f,referenceMassKg:1e-6,targetBeta}));
for(const s of sails){const w=vm.runInContext('Stellar.plan(1e-6,'+s.areaM2+',0,Stellar.r0,100,Stellar.pulseYears,'+s.targetBeta+')',ctx);if(Math.abs(w.beta-s.targetBeta)>2e-15)throw Error('Insufficient impulse '+s.name);console.log(s.name,w.beta*100,w.proper*365.25+' ship days',w.distance+' ly');}
const p='dist/catalog.js';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/const SAILS=\[[^\n]+/,'const SAILS='+JSON.stringify(sails)+';'));
