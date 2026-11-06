import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sky-guide');
context.URL=URL;
context.skyChecks=JSON.parse(fs.readFileSync('data-tools/sky-sources/constellation-checks.json'));
context.latitudeChecks=JSON.parse(fs.readFileSync('data-tools/sky-sources/latitude-checks.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
assert.equal(SKY_GUIDE_DATA.stars.length,5044);assert.equal(Object.keys(SKY_GUIDE_DATA.constellations).length,88);
for(const q of skyChecks.cases) assert.equal(SkyGuide.constellation(q.raDeg,q.decDeg),q.constellation,'independent Astropy constellation: '+q.id);
for(const [id,con] of [['sirius','CMa'],['hyg-113008','PsA'],['vega','Lyr'],['proxima','Cen'],['betelgeuse','Ori']]){
 const o=object(id);assert.equal(SkyGuide.constellation(o.raDeg,o.decDeg),con);
 const card=SkyGuide.finder(o);assert.ok(card.includes(SKY_GUIDE_DATA.constellations[con].name)&&card.includes('d3-celestial'));
}
assert.equal(SkyGuide.constellation(0,90),'UMi');assert.equal(SkyGuide.constellation(0,-90),'Oct');
assert.equal(SkyGuide.constellation(-.1,29),SkyGuide.constellation(359.9,29),'RA wrap');
assert.equal(SkyGuide.constellation(NaN,0),null);assert.equal(SkyGuide.constellation(0,91),null);
assert.ok(Math.abs(SkyGuide.separation([359,0],[1,0])-2)<1e-10);
assert.equal(latitudeChecks.cases.length,88);
for(const q of latitudeChecks.cases){
 const range=SKY_GUIDE_DATA.constellations[q.id].decRangeDeg;
 assert.ok(range.every(Number.isFinite)&&range[0]>=-90&&range[1]<=90&&range[0]<range[1],q.id);
 assert.ok(range[0]<=q.declinationRangeDeg[0]+.002&&range[1]>=q.declinationRangeDeg[1]-.002,'contains independent boundary vertices '+q.id);
 // The reference contains vertices only; the most extreme interior edge
 // point (Chamaeleon) extends another 0.076 degrees towards the pole.
 assert.ok(range.every((v,i)=>Math.abs(v-q.declinationRangeDeg[i])<.1),'independent boundary extrema '+q.id);
 const limits=SkyGuide.latitudeLimits(...range);assert.ok(limits.whole[0]>=limits.partial[0]&&limits.whole[1]<=limits.partial[1]);
}
const cen=SkyGuide.latitudeLimits(...SKY_GUIDE_DATA.constellations.Cen.decRangeDeg);
assert.ok(Math.abs(cen.whole[1]-25.3042)<.002);assert.ok(Math.abs(cen.partial[1]-60.0051)<.002);
assert.equal(SkyGuide.latitudeLimits(...SKY_GUIDE_DATA.constellations.UMi.decRangeDeg).whole[0],0,'north pole belongs to Ursa Minor');
assert.equal(SkyGuide.latitudeLimits(...SKY_GUIDE_DATA.constellations.Oct.decRangeDeg).whole[1],0,'south pole belongs to Octans');
assert.ok(SKY_GUIDE_DATA.constellations.Ser.decRangeDeg[0]<-16&&SKY_GUIDE_DATA.constellations.Ser.decRangeDeg[1]>25,'both Serpens regions included');
for(const dec of [-90,-70,-30,0,20,65,90])for(const latitude of [-89,-60,-20,0,15,40,70,89]){
 const limits=SkyGuide.latitudeLimits(dec),sin=Math.sin,cos=Math.cos,r=Math.PI/180,
   maxAltitude=sin(latitude*r)*sin(dec*r)+cos(latitude*r)*cos(dec*r);
 if(Math.abs(maxAltitude)<1e-10)continue;
 assert.equal(latitude>limits.whole[0]&&latitude<limits.whole[1],maxAltitude>0,'independent horizon projection '+latitude+' '+dec);
}
assert.equal(SkyGuide.latitudeLimits(NaN),null);assert.equal(SkyGuide.latitudeLimits(91),null);assert.equal(SkyGuide.latitudeLimits(20,-20),null);
assert.equal(SkyGuide.latitudeText(null),'Диапазон пока неизвестен');
const alphaFinder=SkyGuide.finder(object('alpha'));
assert.ok(alphaFinder.includes('Все области созвездия')&&alphaFinder.includes('Выбранная звезда — широты')&&alphaFinder.includes('25°')&&alphaFinder.includes('29°')&&alphaFinder.includes('60°'));
console.log('PASS all 88 constellation latitude ranges against independent boundary vertices, polar caps, both Serpens regions, selected-star latitude/horizon geometry and honest unknowns');
assert.equal(SkyGuide.visibility(object('sirius')).text,'Хорошо видна глазом');
assert.equal(SkyGuide.visibility(object('proxima')).text,'Для наблюдения нужна оптика');
assert.equal(SkyGuide.visibility({...object('sirius'),apparentV:null,hip:null}).v,null,'unknown magnitude is not zero');
assert.equal(SkyGuide.visibility({...object('sirius'),apparentV:6.25}).text,'На пределе видимости глазом');
assert.equal(SkyGuide.finder({...object('sirius'),synthetic:true}),'');
assert.equal(SkyGuide.finder(object('sol')),'');assert.equal(SkyGuide.finder(object('andromeda')),'');
assert.equal(SkyGuide.finder({...object('sirius'),raDeg:360}),'');
const immutable=JSON.stringify([state.flight,state.ship,state.matter,state.earth,state.proper,state.universeElapsed,OBJECTS.map(o=>[o.id,o.p3])]);
for(const mode of ['full','radial','slice']){
 MapSlice.setMode(mode);
 for(const id of ['sirius','hyg-118441','proxima','hyg-113008','vega','betelgeuse','hyg-82565','trappist']){
  const o=object(id),wide=SkyGuide.chart(o),close=SkyGuide.chart(o,true);
  for(const chart of [wide,close]){
   assert.ok(!/NaN|Infinity|undefined/.test(chart),'finite spherical projection '+id);
   const m=chart.match(/class="sky-target" transform="translate\\(([-.0-9]+) ([-.0-9]+)\\)"/);assert.ok(m);
   assert.ok(+m[1]>24&&+m[1]<576&&+m[2]>42&&+m[2]<355,'selected marker fits '+id);
   assert.ok(chart.includes(SkyGuide.escape(o.name)),'selected label present '+id);
  }
  assert.notEqual(wide,close,'two useful chart scales');
 }
}
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.earth,state.proper,state.universeElapsed,OBJECTS.map(o=>[o.id,o.p3])]),immutable,'sky guide cannot move navigation stars, fuel or clocks');
console.log('PASS '+skyChecks.cases.length+' independent Astropy constellation assignments, poles/RA wrap, actual apparent magnitude, unknown values and both chart scales across all map modes');
for(const p of SKY_GUIDE_DATA.media){
 assert.ok(p.credit&&p.source.startsWith('https://')&&p.description&&p.url.startsWith('https://'));
 for(const id of p.objects){const photos=SkyGuide.photos(object(id));assert.equal(photos[0].id,p.id);assert.equal(photos.at(-1).id,'dss');}
}
assert.equal(SkyGuide.photos(object('sirius'))[0].id,SkyGuide.photos(object('hyg-118441'))[0].id,'source really shows both Sirius components');
assert.ok(!SkyGuide.photos(object('proxima')).some(p=>p.id==='hubble-alpha'),'Proxima is not in the Alpha AB image');
assert.ok(!SkyGuide.photos(object('hyg-112923')).some(p=>p.id==='webb-fomalhaut'),'Fomalhaut B is not in the A disc image');
assert.ok(SkyGuide.photos(object('hyg-113008'))[0].band.includes('условные цвета'));
for(const id of ['betelgeuse','hyg-101767','member-r136a1']){
 const p=SkyGuide.photos(object(id)).at(-1);assert.equal(p.id,'dss');assert.equal(p.url,SkyDSS.preview(object(id)));
}
const photographicStars=OBJECTS.filter(o=>SkyGuide.eligible(o));
for(const o of photographicStars){
 const dss=SkyGuide.photos(o).filter(p=>p.id==='dss');assert.equal(dss.length,1,'one automatic DSS path for '+o.id);
 assert.equal(dss[0].url,SkyDSS.preview(o));
}
for(const alias of ['Gl 244B','HD 48915','WASP-121','2MASS J23062928-0502285','OGLE-LMC-CEP-1838']){
 const streamed=ExtendedCatalog.decode(['dss-stream-test',alias,'star',20,120,-10,'catalog','test',[alias],8,'HYG',{},1,2]);
 assert.ok(SkyDSS.identifier(streamed),'streamed exact identity '+alias);assert.equal(SkyGuide.photos(streamed).at(-1).id,'dss');
}
const gallery=SkyGuide.gallery(object('sirius'));
assert.equal((gallery.match(/id="stellarGallery"/g)||[]).length,1);
assert.equal((gallery.match(/id="stellarGalleryPrev"/g)||[]).length,1);
assert.equal((gallery.match(/id="stellarGalleryNext"/g)||[]).length,1);
assert.ok(gallery.indexOf('data-photo="chart-wide"')<gallery.indexOf('data-photo="chart-close"'));
assert.ok(gallery.indexOf('data-photo="chart-close"')<gallery.indexOf('data-photo="hubble-sirius"'));
const clipIds=[...gallery.matchAll(/<clipPath id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(clipIds.length,2);assert.equal(new Set(clipIds).size,2,'two independent SVG clipping regions');
showObject('sirius');const html=$('dialogContent').innerHTML;
assert.ok(html.indexOf('</h2>')<html.indexOf('stellarMedia'));
assert.ok(html.indexOf('stellarMedia')<html.indexOf('object-type'));
assert.ok(html.indexOf('stellarMedia')<html.indexOf('Где искать на небе'));
assert.ok(gallery.indexOf('stellar-photo-field')<gallery.indexOf('stellar-gallery-heading'),'images precede all gallery headings');
assert.ok(html.includes('stellarGallery')&&html.includes('hubble-sirius')&&html.includes('dss')&&html.includes('H. Bond'));
assert.ok(SkyGuide.gallery({...object('sirius'),name:'<script>bad</script>'}).includes('&lt;script&gt;bad&lt;/script&gt;'));
console.log('PASS exact observed-image identities, no companion misassignment, visible credits/bands, preferred Hubble/Webb/ESO plus DSS gallery, distant objects, escaped labels and native card integration');
console.log('PASS automatic DSS for all '+photographicStars.length+' eligible stars and streamed identities; one carousel with two chart scales and unique SVG clips');
`);
const before=fs.readFileSync('dist/sky-guide-data.js');
execFileSync('python3',['data-tools/build-sky-guide.py']);
assert.ok(before.equals(fs.readFileSync('dist/sky-guide-data.js')));
console.log('PASS offline sky-guide rebuild reproduces identical bytes without changing the scientific catalogue');
