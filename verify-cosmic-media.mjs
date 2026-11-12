import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#cosmic-media');
context.quasarSource=JSON.parse(fs.readFileSync('data-tools/sky-sources/quasars.json'));
context.cosmicMedia=JSON.parse(fs.readFileSync('data-tools/sky-sources/media-cosmic.json'));
run(['map-visibility-data','map-visibility','map-label-data','map-annotations','universe-map'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
const nuclei=OBJECTS.filter(o=>o.quasarCatalog);
assert.equal(nuclei.length,15);assert.equal(OBJECTS.filter(o=>o.kind==='quasar').length,16);
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
for(const q of quasarSource.objects){
 const o=object(q.id),e=q.sourceEvidence;
 const m=e.coordinates.match(/:\\s*(\\d+) (\\d+) ([\\d.]+)\\s+([+-])(\\d+) (\\d+) ([\\d.]+)/);
 const ra=15*(+m[1]+m[2]/60+m[3]/3600),dec=(+m[5]+m[6]/60+m[7]/3600)*(m[4]==='-'?-1:1);
 assert.equal(o.raDeg,ra);assert.equal(o.decDeg,dec);assert.equal(o.redshift,+e.redshift.split(/\\s+/)[1]);
 assert.equal(o.redshiftError,q.redshiftError);assert.equal(o.redshiftQuality,q.redshiftQuality);
 assert.equal(o.kind,'quasar');assert.ok(o.source.includes('simbad.'));assert.ok(o.coordinateSource.endsWith(q.coordinateBibcode));assert.ok(o.redshiftSource.endsWith(q.redshiftBibcode));
 assert.equal(MapDetails.mass(o),null);assert.equal(o.apparentV,undefined);assert.equal(o.region,undefined,'no invented extent');
 // Independent midpoint quadrature: source redshift becomes comoving distance,
 // never lookback time in light years or the image publisher's rounded value.
 let integral=0;const n=32768,step=q.z/n;
 for(let i=0;i<n;i++)integral+=step/Math.sqrt(.3*(1+(i+.5)*step)**3+.7);
 const distance=299792.458/70*integral*3261563.7771674336;
 assert.ok(Math.abs(o.d/distance-1)<2e-9);assert.ok(Math.abs(Math.hypot(...o.p3)/o.d-1)<1e-12);
 assert.ok(SkyGuide.media(o).length>0);assert.ok(SkyGuide.hasObservatoryPhoto(o));assert.equal(SkyGuide.canChart(o),false);
 assert.equal(MapVisibility.overviewPoint(o),false,'ordinary quasar hierarchy outside explicit selections');
 for(const p of SkyGuide.media(o).filter(p=>p.id.startsWith('cosmic-')))assert.ok(p.objects.includes(o.id),'own nucleus, not a neighbouring or foreground galaxy');
 for(const mode of ['full','radial']){MapSlice.mode=mode;const p=MapLayout.project(o);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
 state=initial();state.selected=q.id;const saved=FlightHistory.snapshot(),restored=restore(saved);assert.equal(restored.selected,q.id);assert.equal(restored.matter,state.matter);assert.equal(object(q.id).redshiftError,q.redshiftError);
}
assert.equal(object('qso-apm08279').redshiftError,null,'unknown error stays unknown');
for(const id of ['qso-pg1115','qso-he0435','qso-he1104'])assert.ok(object(id).coordinateNote.includes('линзированного'));
assert.ok(SkyGuide.media(object('qso-gb1428'))[0].description.includes('отличается'),'published redshift disagreement remains visible');
const mega=['attractor','laniakea','cfa','bootes','sloan','ring','arc','quipu','shapley','serpens-corona','hercules-supercluster','sculptor-pegasus','boss-wall','huge-lqg','hyperion','local-void','eridanus-supervoid'];
const schemeIds=['epoch-qgp','epoch-particles','epoch-plasma','epoch-dark','epoch-beyond'];
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.redshift,o.massSolar,o.region]));
for(const o of [...UniverseMap.areas,...mega.map(id=>object(id))]){
 assert.ok(SkyGuide.hasObservatoryPhoto(o),'visual index includes '+o.id);
 const gallery=SkyGuide.gallery(o);assert.ok(gallery.includes('stellarMedia'));assert.ok(!gallery.includes('data-photo="chart-'),'no finding charts for epochs/structures');
 assert.equal(gallery.includes('data-photo="epoch-scheme"'),schemeIds.includes(o.id));
 if(o.cosmicEpoch){assert.equal(o.navigable,false);assert.equal(o.p3,undefined);}
 for(const p of SkyGuide.media(o)){assert.ok(p.objects.includes(o.id));assert.ok(p.description&&p.credit&&p.mediaType);}
 showObject(o.id);assert.ok($('dialogContent').innerHTML.includes('stellarGallery'),'native card shows imagery '+o.id);
}
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.redshift,o.massSolar,o.region])),science,'media never changes science');
for(const p of cosmicMedia){
 assert.equal(p.availability.status,200);assert.ok(p.availability.contentType.startsWith('image/'));
 assert.ok(p.url.startsWith('https://'));assert.ok(p.source.startsWith('https://'));assert.ok(p.credit&&p.description);
 for(const id of p.objects)assert.ok(object(id),'explicit target exists: '+id);
}
assert.ok(SkyGuide.gallery(object('eridanus-supervoid')).includes('не фотография его границы'));
assert.ok(SkyGuide.gallery(object('ring')).includes('не светящееся кольцо'));
assert.ok(SkyGuide.gallery(object('qso-apm08279')).includes('Наблюдение и иллюстрация'));
assert.equal(SkyGuide.media(object('qso-j0100')).length,new Set(SkyGuide.media(object('qso-j0100')).map(p=>p.url)).size,'no duplicate EIGER portrait');
MapFilters.change('all','photos','all');
for(const id of [...nuclei.map(o=>o.id),...UniverseMap.areas.map(o=>o.id),...mega]){
 if(MapGeometry.unlocated(object(id)))continue; // Existing schematic areas have no adopted physical position.
 assert.ok(MapFilters.matches(object(id)),'photo collection contains '+id);assert.ok(MapFilters.promotes(object(id)),'small visual classes remain complete '+id);
}
for(const category of ['quasar','structure','wall','ring','arc','void','horizon'])assert.ok(MapFilters.allowsCategory(category));
`);
const before=['dist/cosmic-catalog.js','dist/sky-guide-data.js'].map(p=>fs.readFileSync(p));
execFileSync('python3',['data-tools/build-quasar-catalog.py']);
execFileSync('python3',['data-tools/build-sky-guide.py']);
for(const [i,p] of ['dist/cosmic-catalog.js','dist/sky-guide-data.js'].entries())assert.ok(before[i].equals(fs.readFileSync(p)),'deterministic offline build '+p);
console.log('PASS 15 added quasars: independent source coordinates/comoving distances, redshift errors, own photographs, ordinary density, projections and save restoration');
console.log('PASS seven epoch galleries, 17 named megastructures/voids, honest diagram/map/reconstruction captions, all visual classes in filters and deterministic offline builds');
