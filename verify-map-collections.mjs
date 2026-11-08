import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context,run} = await import('data:text/javascript,'+encodeURIComponent(harness)+'#map-collections');
run(['distant-catalog-data','distant-catalog'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`
assert.equal(Object.keys(MapFilters.collections).length-1,16,'historical and photographic collections');
assert.equal(SkyPhotos.cache.size,0,'photo collection works before lazy publisher metadata');
for(const id of ['sirius','proxima','hyg-27253','lmc','andromeda','orion','sgr'])
 assert.ok(MapFilters.matchesCollection(object(id),'photos'),'own observatory image: '+id);
assert.ok(!MapFilters.matchesCollection(object('barnard'),'photos'),'a published DSS field alone is not a beautiful observatory image');
assert.ok(!MapFilters.matchesCollection({...object('sirius'),synthetic:true},'photos'));
for(const kind of ['star','nebula','cluster'])assert.ok(!MapFilters.matchesCollection({id:'photo-host-member',kind,galaxyMember:true,parentGalaxy:'andromeda',aliases:['M31','Andromeda']},'photos'),'host membership is not an own photograph');
assert.equal(MapFilters.selectionLimit(),300,'ordinary collection budget stays bounded');
for(const id of ['andromeda','lmc','smc','opengc-ngc2632','opengc-ngc6475','opengc-ngc0869','opengc-ngc0884','opengc-ic2391'])
 assert.ok(MapFilters.matchesCollection(object(id),'pre-telescope'),id);
for(const id of ['orion','opengc-ngc1952','crab','bh-andromeda','bh-m87','sirius'])
 assert.ok(!MapFilters.matchesCollection(object(id),'pre-telescope'),'discovery dates do not come from supernova dates, brightness or host identity: '+id);
assert.ok(MapFilters.matchesCollection(object('opengc-ngc2632'),'galileo'));
assert.ok(!MapFilters.matchesCollection(object('orion'),'galileo'),'Galileo did not discover M42');
assert.ok(MapFilters.matchesCollection(object('opengc-ngc6205'),'before-herschel'));
assert.ok(!MapFilters.matchesCollection(object('opengc-ngc6205'),'messier-discoveries'),'M13 was discovered by Halley');
assert.ok(MapFilters.matchesCollection(object('whirlpool'),'messier-discoveries'));
assert.ok(!MapFilters.matchesCollection(object('andromeda'),'messier-discoveries'),'catalogue inclusion is not discovery by Messier');
assert.ok(MapFilters.matchesCollection(object('sirius'),'brightest-stars'));
for(const apparentV of [null,undefined,NaN,Infinity,'1',1.51])assert.ok(!MapFilters.matchesCollection({kind:'star',apparentV},'brightest-stars'));
assert.ok(MapFilters.matchesCollection({kind:'star',apparentV:1.5},'brightest-stars'));
assert.ok(!MapFilters.matchesCollection({kind:'star',apparentV:1,unresolvedSourcePhotometry:true},'brightest-stars'));
for(const [collection,yes,no] of [['planetary-nebulae','opengc-ngc6720','orion'],['supernova-remnants','opengc-ngc1952','crab'],['globular-clusters','omega','virgo'],['nearby-galaxies','andromeda','m87'],['early-universe','mom-z14','andromeda']]) {
 assert.ok(MapFilters.matchesCollection(object(yes),collection),collection);
 assert.ok(!MapFilters.matchesCollection(object(no),collection),collection);
}
for(const d of [null,NaN,'100',-1,15e6+1])assert.ok(!MapFilters.matchesCollection({kind:'galaxy',d},'nearby-galaxies'));
assert.ok(MapFilters.matchesCollection({kind:'galaxy',d:15e6},'nearby-galaxies'));
for(const redshift of [null,NaN,Infinity,'7',5.999])assert.ok(!MapFilters.matchesCollection({kind:'galaxy',redshift},'early-universe'));
assert.ok(MapFilters.matchesCollection({kind:'quasar',redshift:6},'early-universe'));
assert.ok(!MapFilters.matchesCollection({kind:'galaxy',redshift:7,synthetic:true},'early-universe'));
const highZ=DistantCatalog.objects.filter(o=>!o.atlasOnly&&o.kind==='galaxy'&&o.redshift>=6);
assert.ok(highZ.length>100,'the full high-redshift survey is covered, not just two famous landmarks');
assert.ok(highZ.every(o=>MapFilters.matchesCollection(o,'early-universe')));
assert.ok(!MapFilters.matchesCollection({kind:'nebula',type:'Туманность',desc:'PN SNR'},'planetary-nebulae'),'descriptive mentions cannot classify the object');
assert.ok(!MapFilters.matchesCollection({id:'unknown',kind:'galaxy',facts:{discoveryYear:1000}},'pre-telescope'),'unknown discovery dates stay unknown');
assert.ok(!MAP_COLLECTION_HISTORY.members.M102.includes('before-herschel'),'dubious M102 identity excluded');
console.log('PASS ten new collections: sourced historical coverage, own identities, exact magnitude/distance/redshift boundaries and full distant survey');
`);
const pointer=JSON.parse(fs.readFileSync('dist/catalog-data/current.json','utf8'));
const search=JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/search.json','utf8'));
const file=search.find(r=>r[0]==='messier-45')[5];
context.pleiadesRow=JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/'+file,'utf8')).find(r=>r[0]==='messier-45');
run(`const pleiades=ExtendedCatalog.decode(pleiadesRow);assert.ok(MapFilters.matchesCollection(pleiades,'galileo'));assert.ok(MapFilters.matchesCollection(pleiades,'pre-telescope'));console.log('PASS actual streamed Pleiades identity matches both historical collections');`);
