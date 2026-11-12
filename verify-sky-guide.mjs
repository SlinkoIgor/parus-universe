import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sky-guide');
context.URL=URL;
run(fs.readFileSync('dist/universe-map.js','utf8'));
context.skyChecks=JSON.parse(fs.readFileSync('data-tools/sky-sources/constellation-checks.json'));
context.latitudeChecks=JSON.parse(fs.readFileSync('data-tools/sky-sources/latitude-checks.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
assert.equal(MAP_FILTER_DATA.guideRevision,SKY_GUIDE_DATA.revision,'gallery changes require the matching complete photo-filter index');
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
assert.equal(SkyGuide.finder(object('sol')),'');assert.ok(SkyGuide.finder(object('andromeda')).includes('Андромеда'));
assert.ok(SkyGuide.canChart(object('proxima')));
for(const id of ['opengc-ngc3372','opengc-ngc4755','opengc-ngc7000','opengc-ngc6960'])assert.ok(!SkyGuide.canChart(object(id)),'Caldwell membership alone does not establish naked-eye visibility: '+id);
assert.equal(SkyGuide.magnitude(object('opengc-ngc3372')),null,'Caldwell membership never fabricates a magnitude');assert.ok(!SkyGuide.canChart(object('trappist')));
assert.equal(SkyGuide.chart(object('trappist')),'');
for(const o of [{...object('sirius'),d:26,apparentV:6.51},{...object('sirius'),d:26,apparentV:null,hip:null},object('sgr'),object('crab'),object('bh-m87'),object('jades-z14'),object('opengc-ngc6720'),object('3c273'),{...object('andromeda'),apparentV:6.51},{...object('andromeda'),id:'diffuse',ngc:null,messier:null,aliases:[],apparentV:5,angularMajorArcmin:400,angularMinorArcmin:300}]) {assert.equal(SkyGuide.canChart(o),false);assert.equal(SkyGuide.finder(o),'');assert.ok(!SkyGuide.gallery(o).includes('data-photo="chart-'));}
assert.ok(SkyGuide.canChart({...object('sirius'),d:26,apparentV:6.5}),'naked-eye threshold includes V=6.5');
for(const id of ['andromeda','orion','omega','lmc','smc'])assert.ok(SkyGuide.observing(object(id)).nakedEye,id+' retains naked-eye charts');
for(const id of ['barnard','proxima','wolf','lalande','hyg-118441','hyg-82565','hyg-118541','hyg-119113']){
 const o=object(id),view=SkyGuide.observing(o);
 assert.ok(view.nearby&&!view.nakedEye,'faint stellar neighbour: '+id);
 assert.ok(SkyGuide.finder(o).includes('Для наблюдения нужна оптика'));
 assert.ok(SkyGuide.gallery(o).includes('data-photo="chart-wide"')&&SkyGuide.gallery(o).includes('data-photo="chart-close"'));
 const restored=ExtendedCatalog.decode([o.id,o.name,'star',o.d,o.raDeg,o.decDeg,'catalog','test',[],SkyGuide.magnitude(o),'HYG',{}]);
 assert.ok(SkyGuide.canChart(restored),'streamed/restored neighbour retains charts: '+id);
 assert.equal(SkyGuide.canChart({...restored,d:25.001}),false,'same faint star outside neighbourhood: '+id);
}
const unknownNeighbour={...object('barnard'),apparentV:null,hip:null};
assert.ok(SkyGuide.canChart(unknownNeighbour),'unknown photometry does not exclude a measured stellar neighbour');
assert.equal(SkyGuide.observing(unknownNeighbour).nakedEye,false,'unknown magnitude is never naked-eye evidence');
assert.ok(SkyGuide.finder(unknownNeighbour).includes('Яркость пока неизвестна'));
for(const d of [0,25])assert.ok(SkyGuide.canChart({...unknownNeighbour,d}),'inclusive neighbourhood boundary '+d);
for(const d of [-1,25.001,null,undefined,NaN])assert.equal(SkyGuide.canChart({...unknownNeighbour,d}),false,'unknown/outside distance cannot grant exception: '+d);
assert.equal(SkyGuide.canChart({...object('3c273'),d:1}),false,'nearby exception is only for stars');
assert.equal(SkyGuide.canChart({...object('andromeda'),d:1,apparentV:null,hip:null}),false,'nearby galaxies still need naked-eye evidence');
for(const id of ['3c273','opengc-ngc6720','trappist'])assert.ok(SkyGuide.gallery(object(id)).includes('stellarMedia'),'filtered charts keep photographs: '+id);
console.log('PASS naked-eye stars/deep-sky targets, published Magellanic evidence, faint 25 ly neighbours, streamed/restored identities, unknowns, boundaries and photographs without charts');
assert.equal(SkyGuide.finder({...object('sirius'),raDeg:360}),'');
for(const id of ['proxima','hyg-118441','hyg-82565'])for(const close of [false,true]){
 const o=object(id),v=SkyGuide.magnitude(o),chart=SkyGuide.chart(o,close);
 assert.ok(v>6&&chart.includes('class="sky-faint-notice"'),'fainter selected star explained on both charts: '+id);
 assert.ok(chart.includes('Выбранная звезда: V = '+v.toLocaleString('ru-RU',{maximumFractionDigits:2})));
 assert.ok(chart.includes('Слабее всех фоновых звёзд (V ≤ 6)'));
 assert.ok(!chart.includes('светимость'),'apparent brightness is not intrinsic luminosity');
}
assert.ok(!SkyGuide.chart({...object('sirius'),apparentV:6}).includes('sky-faint-notice'),'V=6 belongs to the background range');
assert.ok(SkyGuide.chart({...object('sirius'),apparentV:6.01}).includes('sky-faint-notice'),'just above V=6 needs an explanation');
for(const id of ['alpha','sirius','m87'])assert.ok(!SkyGuide.chart(object(id)).includes('sky-faint-notice'),'no false stellar comparison for '+id);
const immutable=JSON.stringify([state.flight,state.ship,state.matter,state.earth,state.proper,state.universeElapsed,OBJECTS.map(o=>[o.id,o.p3])]);
for(const mode of ['full','radial']){
 MapSlice.setMode(mode);
 for(const id of ['sirius','hyg-118441','proxima','hyg-113008','vega','betelgeuse','hyg-82565','andromeda','orion','omega']){
  const o=object(id),wide=SkyGuide.chart(o),close=SkyGuide.chart(o,true);
  for(const chart of [wide,close]){
   assert.ok(!/NaN|Infinity|undefined/.test(chart),'finite spherical projection '+id);
   const m=chart.match(/class="sky-target" transform="translate\\(([-.0-9]+) ([-.0-9]+)\\)"/);assert.ok(m);
   assert.ok(+m[1]>24&&+m[1]<576&&+m[2]>42&&+m[2]<355,'selected marker fits '+id);
   assert.ok(chart.includes(SkyGuide.escape(o.name)),'selected label present '+id);
  }
  assert.notEqual(wide,close,'two useful chart scales');
  assert.ok(wide.includes('150°'),'overview covers a broad sky region');
  assert.ok((wide.match(/sky-neighbour-figure/g)||[]).length>=8,'many neighbouring constellation lines');
 }
}
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.earth,state.proper,state.universeElapsed,OBJECTS.map(o=>[o.id,o.p3])]),immutable,'sky guide cannot move navigation stars, fuel or clocks');
console.log('PASS '+skyChecks.cases.length+' independent Astropy constellation assignments, poles/RA wrap, actual apparent magnitude, unknown values and both chart scales across all map modes');
for(const p of SKY_GUIDE_DATA.media){
 assert.ok(p.credit&&p.source.startsWith('https://')&&p.description&&p.url.startsWith('https://'));
 for(const id of p.objects){assert.ok(object(id),'known registry object '+id);const photos=SkyGuide.photos(object(id));assert.ok(photos.some(q=>q.id===p.id),'exact observed object '+id);if(object(id).kind==='star')assert.equal(photos.at(-1).id,'dss');}
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
for(const id of ['orion','andromeda','omega','opengc-ngc6720','opengc-ic4604','3c273']){
 const o=object(id),g=SkyGuide.gallery(o),survey=SkyGuide.survey(o);
 assert.ok(g.includes('stellarMedia')&&survey&&survey.id==='survey','nonstellar photographic field '+id);
 assert.ok(survey.url.includes('r='+encodeURIComponent(o.raDeg))&&survey.url.includes('d='+encodeURIComponent(o.decDeg)),'actual sky direction, not navigation x/y');
 assert.ok(!g.includes('stellarSkyImage'),'nonstellar fields never receive stellar proper-motion markers');
}
for(const o of [{...object('andromeda'),id:'stream-photo',aliases:['NGC 0224'],ngc:null,messier:null},{...object('andromeda'),id:'stream-photo',aliases:['Messier 31'],ngc:null,messier:null}])assert.ok(SkyGuide.media(o).length,'exact NGC/Messier aliases support streamed and restored records');
assert.ok(!SkyGuide.media({...object('sirius'),id:'unrelated-star',aliases:['NGC 224']}).length,'no picture inheritance across physical classes');
assert.equal(SkyGuide.gallery({...object('andromeda'),synthetic:true}),'');
for(const id of ['horizon','bootes']){assert.ok(SkyGuide.gallery(object(id)).includes('stellarMedia'),'published context imagery: '+id);assert.equal(SkyGuide.canChart(object(id)),false);}
for(const id of ['sgr','bh-m87','vela','crab','jades-z14','mom-z14']){
 assert.ok(SkyGuide.media(object(id)).length,'verified professional observation '+id);
 assert.equal(SkyGuide.canChart(object(id)),false,'invisible target has pictures without a map '+id);
}
assert.ok(!SkyGuide.media(object('m87')).some(p=>p.id==='eso-eso1907a'),'EHT black-hole picture is not inherited by the host galaxy');
const orbits=SKY_GUIDE_DATA.media.find(p=>p.id==='eso-eso1825e-orbits');
assert.deepEqual(orbits.objects,['sgr']);assert.equal(orbits.format,'video');assert.equal(orbits.mediaType,'observation');
assert.equal(orbits.availability.status,200);assert.equal(orbits.availability.contentType,'video/mp4');
assert.ok(orbits.credit==='ESO/MPE'&&orbits.poster.startsWith('https://cdn.eso.org/videos/'));
const orbitGallery=SkyGuide.gallery(object('sgr')),orbitSlide=orbitGallery.split('data-photo="eso-eso1825e-orbits"')[1].split('</figure>')[0];
assert.ok(orbitSlide.includes('<video controls playsinline loop preload="none" data-video-src="'+orbits.url+'"'));
assert.ok(!orbitSlide.includes('<img')&&!orbitSlide.includes('autoplay'),'video is user initiated and never treated as a still image');
assert.ok(orbitSlide.includes('почти двадцать лет')&&orbitSlide.includes('Сама чёрная дыра в этих кадрах не видна'));
assert.ok(orbitGallery.indexOf('data-photo="eht-eso2208-eht-mwa"')<orbitGallery.indexOf('data-photo="eso-eso1825e-orbits"'),'orbit movie follows Sgr A EHT portrait');
for(const id of ['bh-m87','m87','milkyway','s2']){assert.ok(object(id));assert.ok(!SkyGuide.media(object(id)).includes(orbits),'central-star sequence is not inherited by other identities: '+id);}
assert.equal(object('bh-m87').kind,'blackhole');assert.ok(object('bh-m87').massSolar>1e9);
assert.ok(SkyGuide.media(object('bh-m87')).some(p=>p.id==='eso-eso1907a'),'M87* retains its first EHT image');
assert.ok(SkyGuide.hasObservatoryPhoto(object('sgr'))&&SkyGuide.hasObservatoryPhoto(object('bh-m87')),'both EHT black holes remain in the photo collection');
console.log('PASS observed Sgr A* star-orbit movie: exact target, lazy native player, no autoplay, provenance and separate M87* EHT image');
assert.ok(!SkyGuide.media({...object('andromeda'),id:'other-galaxy',ngc:'NGC2244',messier:null,aliases:[]}).some(p=>p.objects.includes('andromeda')),'no substring catalogue matches');
assert.ok(SKY_GUIDE_DATA.media.length>=200,'broad observed-image catalogue');
const gallery=SkyGuide.gallery(object('sirius'));
assert.equal((gallery.match(/id="stellarGallery"/g)||[]).length,1);
assert.equal((gallery.match(/id="stellarGalleryPrev"/g)||[]).length,1);
assert.equal((gallery.match(/id="stellarGalleryNext"/g)||[]).length,1);
assert.ok(gallery.indexOf('data-photo="chart-wide"')<gallery.indexOf('data-photo="chart-close"'));
assert.ok(gallery.indexOf('data-photo="chart-wide"')<gallery.indexOf('data-photo="hubble-sirius"'));
assert.ok(gallery.indexOf('data-photo="chart-close"')<gallery.indexOf('data-photo="hubble-sirius"'),'both charts precede photographs');
for(const id of ['alpha','sirius','proxima','andromeda','orion','omega']){
 const slides=[...SkyGuide.gallery(object(id)).matchAll(/<figure[^>]+data-photo="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(slides[0],'chart-wide','first slide is the overview: '+id);
 assert.equal(slides[1],'chart-close','second slide is the close chart: '+id);
 assert.ok(!slides.slice(2).some(s=>s.startsWith('chart-')),'charts are never split by a photo: '+id);
}
const clipIds=[...gallery.matchAll(/<clipPath id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(clipIds.length,2);assert.equal(new Set(clipIds).size,2,'two independent SVG clipping regions');
showObject('sirius');const html=$('dialogContent').innerHTML;
assert.ok(html.indexOf('</h2>')<html.indexOf('stellarMedia'));
assert.ok(html.indexOf('stellarMedia')<html.indexOf('object-type'));
assert.ok(html.indexOf('stellarMedia')<html.indexOf('Где искать на небе'));
assert.ok(gallery.indexOf('stellar-photo-field')<gallery.indexOf('stellar-gallery-heading'),'images precede all gallery headings');
assert.ok(html.includes('stellarGallery')&&html.includes('hubble-sirius')&&html.includes('dss')&&html.includes('H. Bond'));
assert.ok(SkyGuide.gallery({...object('sirius'),name:'<script>bad</script>'}).includes('&lt;script&gt;bad&lt;/script&gt;'));
for(const [id,visible] of [['barnard',true],['proxima',true],['andromeda',true],['opengc-ngc6720',false],['3c273',false],['opengc-ngc6960',false]]){
 showObject(id);const card=$('dialogContent').innerHTML;
 assert.equal(card.includes('Направление J2000'),visible,'numeric sky direction follows the same visibility rule: '+id);
 assert.equal(card.includes('Где искать на небе'),visible,'finder follows the same visibility rule: '+id);
 assert.ok(card.includes('stellarMedia'),'photos remain available: '+id);
}
console.log('PASS exact observed-image identities, no companion misassignment, visible credits/bands, preferred Hubble/Webb/ESO plus DSS gallery, distant objects, escaped labels and native card integration');
console.log('PASS automatic DSS for all '+photographicStars.length+' eligible stars and streamed identities; one carousel with two chart scales and unique SVG clips');
`);
const before=fs.readFileSync('dist/sky-guide-data.js');
execFileSync('python3',['data-tools/build-sky-guide.py']);
assert.ok(before.equals(fs.readFileSync('dist/sky-guide-data.js')));
console.log('PASS offline sky-guide rebuild reproduces identical bytes without changing the scientific catalogue');
