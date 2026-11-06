// Standalone tree: use the actual radial rules, with no spatial-index dependency.
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {readMapCatalog} from './map-radial-catalog.mjs';

const {c,objects,manifest}=await readMapCatalog({supplement:true});
vm.runInContext(['map-radial-data','map-radial','nuclear-stars-data','nuclear-stars','black-hole-catalog-data','black-hole-catalog'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const all=new Map([...objects,...vm.runInContext('OBJECTS',c)].map(o=>[o.id,o]));
c.MapLayout.resolve=id=>all.get(id);
const radial=c.MapRadial,rules=[...radial.profile.rules,'unlocated'],entries=[],lookup=new Map();
function add(o,registry=false){
 if(lookup.has(o.id))return;
 lookup.set(o.id,entries.length);entries.push({o,registry,p:radial.placement(o)});
}
for(const o of all.values())add(o);
for(let i=0;i<entries.length;i++){
 const {p}=entries[i];if(!p.parent)continue;
 const host=radial.resolve(p.parent);assert.ok(host,'missing host '+p.parent);add(host,true);
 const shown=entries[lookup.get(p.parent)].p,expected=radial.placement(host);
 assert.equal(shown.parent,expected.parent,'frozen/runtime host parent '+host.id);
 assert.equal(shown.rule,expected.rule,'frozen/runtime host rule '+host.id);
}
const nodes=entries.map(({o,p,registry})=>{
 assert.ok(rules.includes(p.rule),'unrecognised rule '+p.rule);
 return[o.id,o.name||o.id,p.parent?lookup.get(p.parent):-1,rules.indexOf(p.rule),registry?1:0];
});
const states=new Uint8Array(nodes.length);
function visit(i){if(states[i]===2)return;assert.notEqual(states[i],1,'parent cycle '+nodes[i][0]);states[i]=1;const p=nodes[i][2];if(p>=0)visit(p);states[i]=2;}
nodes.forEach((_,i)=>visit(i));
assert.equal(nodes.filter(n=>!n[4]).length,all.size);
const data={version:2,profileKey:radial.key,catalogRevision:manifest.revision,actualCount:all.size,registryCount:nodes.length-all.size,rules,nodes};
const json=JSON.stringify(data),file='dist/hierarchy-data/tree.json.gz';
if(process.argv.includes('--check'))assert.equal(zlib.gunzipSync(fs.readFileSync(file)).toString(),json,'hierarchy data matches the current radial rules');
else{fs.mkdirSync('dist/hierarchy-data',{recursive:true});fs.writeFileSync(file+'.tmp',zlib.gzipSync(json,{level:9}));fs.renameSync(file+'.tmp',file);}
console.log(JSON.stringify({check:process.argv.includes('--check'),objects:all.size,registry:data.registryCount,bytes:fs.statSync(file).size}));
