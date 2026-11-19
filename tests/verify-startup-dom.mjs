import fs from 'node:fs';
import assert from 'node:assert/strict';

// The general map harness invents every requested element. At startup, require
// actual HTML IDs (or elements created by setup), as getElementById does in a browser.
const html = fs.readFileSync('dist/index.html', 'utf8');
let harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0];
harness = harness
  .replace('const el=id=>', `
const htmlIds = new Set(${JSON.stringify([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))});
Object.defineProperty(Element.prototype, 'id', {
 get(){return this._id;},
 set(id){this._id=id;els.set(id,this);},
});
const el=id=>`)
  .replace('getElementById:el', 'getElementById:id=>htmlIds.has(id)?el(id):els.get(id)||null')
  .replace('requestAnimationFrame(){}', 'requestAnimationFrame(fn){context.raf.push(fn);}')
  .replace('vm.runInContext([', 'context.raf=[];\nvm.runInContext([');
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness + '\nexport {context,run};') + '#startup-dom');
assert.equal(context.raf.length, 1, 'startup reaches the animation loop');
context.raf.shift()(performance.now());
run(`assert.ok(hitObjects.length > 0, 'the first frame draws selectable catalogue objects');`);
assert.equal(context.raf.length, 1, 'drawing schedules the next frame');
console.log('PASS startup binds real HTML elements and draws catalogue objects');
