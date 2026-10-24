import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('dist/physics.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('dist/catalog.js','utf8'),ctx);
const sails=vm.runInContext('SAILS',ctx);
for(const s of sails){const w=vm.runInContext('Stellar.plan(1e-6,'+s.areaM2+',0,Stellar.r0,100,Stellar.pulseYears,'+s.targetBeta+')',ctx);if(Math.abs(w.beta-s.targetBeta)>2e-15)throw Error('Insufficient impulse '+s.name);console.log(s.name,w.beta*100,w.proper*365.25+' ship days',w.distance+' ly');}
// Verify the checked-in, rounded design areas without rewriting them.
