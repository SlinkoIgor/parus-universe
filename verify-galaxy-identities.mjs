import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync('data-tools/cosmic-catalogs.json.gz')));
const original=source.objects.find(o=>o.id==='ungc-milkyway');assert.ok(original);
const audit=JSON.parse(fs.readFileSync('data-tools/cosmic-catalog-audit.json'));
assert.ok(audit.matches.some(q=>q[0]===original.id&&q[1]==='milkyway'));
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run,context};';
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#galaxy-identities');context.sourceGalaxy=original;context.messierSources=source.objects.filter(o=>/^MESSIER0*\d+$/.test(o.name));context.messierMatches=audit.matches.filter(m=>/^ungc-messier\d+$/.test(m[0]));
run(`{
state=initial();paused=true;state.expansion=false;Cosmology.sync(state);
assert.equal(messierSources.length,6);assert.equal(messierMatches.length,6);
for(const raw of messierSources){const match=messierMatches.find(m=>m[0]===raw.id);assert.ok(match,raw.id);assert.equal(ExtendedCatalog.get(raw.id)?.id,match[1],'zero-padded Messier identity resolves before streaming');}
const mw=object('milkyway');assert.equal(mw.kind,'galaxy');assert.equal(mw.name,'Млечный Путь');
assert.equal(mw.gravity,undefined);assert.deepEqual(mw.p3,object('sgr').p3);
assert.ok(mw.catalogMeasurements.some(m=>m.sourceId===sourceGalaxy.id&&m.distanceLy===sourceGalaxy.distanceLy),'source estimate retained as provenance');
assert.equal(ExtendedCatalog.get(sourceGalaxy.id),mw,'old raw ID resolves to the same galaxy');
for(const [raw,id] of Object.entries(EXTENDED_BOOT.identityRedirects)){
 const host=object(id);assert.ok(host&&host.kind==='galaxy','redirect only joins galaxy identities');assert.equal(ExtendedCatalog.get(raw),host);
}
for(const id of ['milkyway','andromeda','triangulum','lmc','smc'])assert.ok(object(id).catalogMeasurements.length,'cross-matched host '+id);
const old={id:sourceGalaxy.id,name:sourceGalaxy.name,kind:'galaxy',d:sourceGalaxy.distanceLy,...Space.point(Space.fromSky(sourceGalaxy.raDeg,sourceGalaxy.decDeg,sourceGalaxy.distanceLy)),navigable:true,mapGeometry:MapLayout.version};
old.mapPosition=MapLayout.place(old);old.mapOffset=[0,0];
state=initial();state.selected=old.id;state.catalogObjects=[{...old}];state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.selected,mw.id);assert.equal(ExtendedCatalog.get(old.id),mw,'selection cannot resurrect duplicate');
state=initial();state.current=old.id;state.selected=old.id;state.ship=Space.point(old.p3);state.catalogObjects=[{...old}];const parked=JSON.stringify(state.ship);
state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.ship),parked,'old parked estimate does not teleport');assert.ok(ExtendedCatalog.get(old.id).historicalNavigation);assert.equal(ExtendedCatalog.matchesMap(ExtendedCatalog.get(old.id)),false);
assert.equal(state.selected,state.current,'parked card stays on the preserved navigation stop');
ExtendedCatalog.pinned.delete(old.id);state=initial();const historical={...old,supersededBy:mw.id,historicalNavigation:true};ExtendedCatalog.pin(historical);state.selected=old.id;launch(true);paused=true;assert.ok(state.flight);
const frozen=JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]);persist();const saved=FlightHistory.snapshot();saved.catalogObjects=[historical];state=restore(JSON.parse(JSON.stringify(saved)));
assert.equal(JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]),frozen,'active legacy flight remains frozen');
assert.equal(FlightQueue.browsing(),false,'reload keeps the current-flight card active');
for(const field of ['flightHistory','itinerary','nextTargets']){
 state=initial();ExtendedCatalog.pinned.delete(old.id);state.catalogObjects=[{...old}];
 state[field]=field==='flightHistory'?[{fromId:old.id,target:'alpha'}]:[{id:old.id}];
 ExtendedCatalog.restore(state);assert.ok(ExtendedCatalog.get(old.id).historicalNavigation,'preserved identity referenced by '+field);
 assert.equal(ExtendedCatalog.matchesMap(ExtendedCatalog.get(old.id)),false);
}
state=initial();ExtendedCatalog.pinned.delete(old.id);
const local=ExtendedCatalog.arrivalStar(old);ExtendedCatalog.pin(local);state.current=local.id;state.selected=local.id;state.ship=Space.point(local.p3);state.catalogObjects=[{...old},local];
const localPosition=JSON.stringify(state.ship);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify(state.ship),localPosition,'a saved arrival star retains its old host estimate');
assert.ok(ExtendedCatalog.get(old.id).historicalNavigation,'preserve transitive host dependency');
console.log('PASS canonical galaxy hosts and all source-ID redirects, Milky Way source provenance, ordinary selection migration, no duplicate map point and preserved parked/active legacy navigation');
}`);
