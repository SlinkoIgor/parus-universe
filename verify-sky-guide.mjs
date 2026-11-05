import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sky-guide');
context.skyChecks=JSON.parse(fs.readFileSync('data-tools/sky-sources/constellation-checks.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
assert.equal(SKY_GUIDE_DATA.stars.length,5044);assert.equal(Object.keys(SKY_GUIDE_DATA.constellations).length,88);
for(const q of skyChecks.cases) assert.equal(SkyGuide.constellation(q.raDeg,q.decDeg),q.constellation,'independent Astropy constellation: '+q.id);
for(const [id,con] of [['sirius','CMa'],['hyg-113008','PsA'],['vega','Lyr'],['proxima','Cen'],['betelgeuse','Ori']]){
 const o=object(id);assert.equal(SkyGuide.constellation(o.raDeg,o.decDeg),con);
 const card=SkyGuide.finder(o);assert.ok(card.includes(SKY_GUIDE_DATA.constellations[con].name)&&card.includes('ВИД С ЗЕМЛИ'));
}
assert.equal(SkyGuide.constellation(0,90),'UMi');assert.equal(SkyGuide.constellation(0,-90),'Oct');
assert.equal(SkyGuide.constellation(-.1,29),SkyGuide.constellation(359.9,29),'RA wrap');
assert.equal(SkyGuide.constellation(NaN,0),null);assert.equal(SkyGuide.constellation(0,91),null);
assert.ok(Math.abs(SkyGuide.separation([359,0],[1,0])-2)<1e-10);
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
 const p=SkyGuide.photos(object(id)).at(-1);assert.equal(p.id,'dss');assert.ok(p.url.includes('r='+encodeURIComponent(object(id).raDeg)));
}
showObject('sirius');const html=$('dialogContent').innerHTML;
assert.ok(html.indexOf('Где искать на небе')<html.indexOf('Снимки и наблюдения'));
assert.ok(html.includes('stellarGallery')&&html.includes('hubble-sirius')&&html.includes('dss')&&html.includes('H. Bond'));
assert.ok(SkyGuide.gallery({...object('sirius'),name:'<script>bad</script>'}).includes('&lt;script&gt;bad&lt;/script&gt;'));
console.log('PASS exact observed-image identities, no companion misassignment, visible credits/bands, preferred Hubble/Webb/ESO plus DSS gallery, distant objects, escaped labels and native card integration');
`);
const before=fs.readFileSync('dist/sky-guide-data.js');
execFileSync('python3',['data-tools/build-sky-guide.py']);
assert.ok(before.equals(fs.readFileSync('dist/sky-guide-data.js')));
console.log('PASS offline sky-guide rebuild reproduces identical bytes without changing the scientific catalogue');
