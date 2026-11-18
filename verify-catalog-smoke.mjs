import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {catalogPath, catalogRoot} from './catalog-path.mjs';

// Representative real tiles and the real search worker, without a census of
// every immutable catalogue file. The exhaustive audit is verify-stream.mjs.
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#catalog-smoke');
context.fetch = async url => {
  const file = 'dist/' + url.split('?')[0];
  return {ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
};
const manifest = JSON.parse(fs.readFileSync(catalogPath('manifest.json'), 'utf8'));
const search = JSON.parse(fs.readFileSync(catalogPath('search.json'), 'utf8'));
assert.equal(manifest.revision, run('EXTENDED_BOOT.revision'));
assert.equal(search.length, manifest.extra);
const leaves = manifest.nodes.filter(node => !node.children.length);
assert.ok(leaves.length > 3);
for (const index of [0, Math.floor(leaves.length / 2), leaves.length - 1]) {
  const rows = JSON.parse(fs.readFileSync(catalogPath(leaves[index].file), 'utf8'));
  assert.ok(rows.length > 0 && rows.length <= 256, 'bounded spatial tile');
  for (const row of rows) assert.ok(Number.isFinite(row[12]) && Number.isFinite(row[13]), row[0]);
}
context.sampleEntries = [search.find(row => row[0] === 'hyg-100000'), search.find(row => row[4] === 'unknown')];
assert.ok(context.sampleEntries.every(Boolean));
await run(`(async()=>{
  assert.equal(EXTENDED_BOOT.dataRoot, ${JSON.stringify(catalogRoot)});
  for(const entry of sampleEntries){
    const o=await ExtendedCatalog.resolve({id:entry[0],tile:entry[5]});
    assert.ok(o&&o.id===entry[0]);
    if(entry[4]==='unknown'){
      assert.equal(o.navigable,false);assert.equal(o.p3,null);assert.ok(o.atlasOnly);
      assert.equal(MapDetails.visible(o,24),false);
    }else assert.ok(o.navigable&&o.p3.every(Number.isFinite));
    state=initial();state.selected=o.id;ExtendedCatalog.capture(state);
    const saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();ExtendedCatalog.cache.clear();
    state=restore(saved);assert.equal(state.selected,o.id);assert.ok(object(o.id));
    assert.ok(state.catalogObjects.length<10,'saves retain only referenced catalogue objects');
  }
})();`);

let receive;
const worker = vm.createContext({fetch: context.fetch, self: {postMessage: value => receive(value)}, console});
vm.runInContext(fs.readFileSync('dist/catalog-search-worker.js', 'utf8'), worker);
const query = (term, filter = 'all') => new Promise(resolve => {
  receive = resolve;
  worker.self.onmessage({data: {seq: 1, term, filter, limit: 5, dataRoot: catalogRoot}});
});
for (const [term, id] of [['HYG 100000', 'hyg-100000'], ['NGC 1', 'opengc-ngc0001']]) {
  const result = await query(term);
  assert.equal(result.items[0].id, id);
  assert.ok(result.items.length <= 5 && result.total >= result.items.length);
}
const all = await query('');
assert.equal(all.total, manifest.extra);
assert.equal(all.items.length, 5);
assert.ok((await query('J0002+6216', 'pulsar')).items.length > 0);
console.log('PASS current catalogue revision, representative tiles, lazy lookup, unknown positions, saved references and real worker search');
