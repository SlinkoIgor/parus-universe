import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const els=new Map();
class Element{constructor(){this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.value='';this.checked=true;this.children=[];this.open=false;}querySelector(s){return this.child||(this.child=new Element)}querySelectorAll(){return []}setAttribute(){}addEventListener(){}getBoundingClientRect(){return{width:900,height:620,left:0,top:0}}getContext(){return new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})})}append(e){this.children.push(e)}replaceChildren(){this.children=[]}focus(){}showModal(){this.open=true}close(){this.open=false}}
const el=id=>els.get(id)||(els.set(id,new Element),els.get(id));
const context=vm.createContext({console,performance,Math,JSON,Number,Array,String,Set,Map,Date,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},document:{documentElement:{dataset:{theme:'dark'}},querySelector:()=>null,getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element,hidden:false},window:{devicePixelRatio:1,addEventListener(){},open(){}},localStorage:{getItem(){return null},setItem(){}},assert});


vm.runInContext(['dist/catalog.js','dist/astronomy.js','dist/catalog-import.js','dist/catalog-retired.js','dist/coordinates.js','dist/cosmic-catalog.js','dist/layout-data.js','dist/map-layout.js','dist/cosmology.js','dist/map-details.js','dist/catalog-extended.js','dist/catalog-stream.js','dist/map-layer-data.js','dist/map-layers.js','dist/nuclear-stars-data.js','dist/nuclear-stars.js','dist/regions.js','dist/flight-view.js','dist/flight-marks.js','dist/beam-spectra.js','dist/beam-optics.js','dist/physics.js','dist/orbital-motion.js','dist/flyby.js','dist/navigation.js','dist/simulation.js','dist/app.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n'),context);
context.CATALOG_AUDIT=JSON.parse(fs.readFileSync('data-tools/selection-audit.json','utf8'));
const run=s=>vm.runInContext(s,context);
run(`
resize();
assert.equal(MapDetails.visible(object('alpha'),130000),false);
assert.equal(MapDetails.visible(object('sol'),130000),false);
assert.equal(MapDetails.visible(object('alpha'),24),true);
for(const o of OBJECTS.filter(o=>o.ngc))assert.ok(!/\\b(?:NGC|IC)\\s*\\d/.test(o.name),'catalog code on map: '+o.name);
assert.ok(object('andromeda').name.includes('M31'));
assert.ok(MapDetails.searchKey('NGC 6822')===MapDetails.searchKey('NGC6822'));
assert.ok(MapDetails.searchKey('Añañuca')===MapDetails.searchKey('Ananuca'));
const before=JSON.stringify(object('alpha').p3);
for(const span of [24,200,1000,130000,7e6,5e8,5e9,3e10,1.15e11]){
 cam={x:0,y:0,span};MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();drawShip(0);MapLabels.draw();
 for(let i=0;i<MapLabels.placed.length;i++)for(let j=0;j<i;j++)assert.ok(!MapLabels.overlaps(MapLabels.placed[i],MapLabels.placed[j]),'overlap at '+span);
 if(span>=130000)assert.ok(!hitObjects.some(h=>h.o.id==='alpha'||h.o.id==='sol'));
 assert.ok(galaxyProjection(object('andromeda').galaxy).r>galaxyProjection(object('triangulum').galaxy).r);
}
assert.equal(JSON.stringify(object('alpha').p3),before);
assert.ok(object('mom-z14').d>3e10);assert.ok(object('mom-z14').cosmology.lookbackYears<14e9);
assert.ok(object('hyperion').d>object('ring').d);
assert.ok(object('boss-wall').region);assert.ok(object('eridanus-supervoid').region);
assert.equal(object('local-void').navigable,true);
assert.equal(new Set(OBJECTS.map(o=>o.id)).size,OBJECTS.length);
assert.equal(new Set(OBJECTS.flatMap(o=>o.iauNames||[])).size,652);
assert.equal(CATALOG_COUNTS.all,1066+EXTENDED_BOOT.members.length+NuclearStars.rows.length);

// Sample actual animation frames with a fixed camera. Moving ship/flight labels
// must never move stars, displace an atlas label or introduce a trajectory caption.
state=initial();state.selected='alpha';launch(true);cam={x:0,y:0,span:24};cameraGoal=null;
function chartFrame(){MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawRoute();drawObjects();drawShip(0);MapLabels.draw();return{symbols:JSON.stringify(hitObjects.filter(h=>!['alpha','hyg-71453','proxima'].includes(h.o.id)&&!h.o.nuclearStar).map(h=>[h.o.id,h.p])),labels:JSON.stringify(MapLabels.placed.filter(q=>!MapLabels.dynamic(q.key)&&!['object-alpha','object-hyg-71453','object-proxima'].includes(q.key)))};}
const fixed=chartFrame();for(let i=0;i<1500&&state.flight;i++){Simulation.advance(1/60);if(!state.flight)break;const current=chartFrame();assert.equal(current.symbols,fixed.symbols,'star symbols remain fixed');assert.equal(current.labels,fixed.labels,'atlas labels remain fixed throughout flight');assert.ok(!MapLabels.queue.some(q=>q.key==='course'));}
// Changing card height when engines switch off must not reflow the atlas.
// Restore the same flight view for the independent card-height regression.
state=initial();state.selected='alpha';launch(true);cam={x:0,y:0,span:24};cameraGoal=null;chartFrame();
const rect=$('flightCard').getBoundingClientRect;$('flightCard').getBoundingClientRect=()=>({left:580,top:200,width:300,height:400});assert.equal(chartFrame().labels,fixed.labels);$('flightCard').getBoundingClientRect=rect;

// Browsing a different object in flight opens its own facts and leaves navigation intact.
state=initial();state.selected='andromeda';launch(true);tickPhysics(state.flight.engine.burnProper*1.01);paused=true;
const expedition=JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,phase:state.phase,proper:state.proper,earth:state.earth}),course=state.flight.target;
for(const id of ['sirius','laniakea',OBJECTS.find(o=>!o.p3).id]){
 select(id);assert.equal(state.selected,id);assert.ok($('infoDialog').open);assert.ok($('dialogContent').innerHTML.includes('<h2>'+object(id).name+'</h2>'));
 assert.equal($('targetName').textContent,object(course).name);assert.equal(state.flight.target,course);
 assert.equal(JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,phase:state.phase,proper:state.proper,earth:state.earth}),expedition);
 $('infoDialog').close();
}
$('objectInfo').onclick();assert.ok($('dialogContent').innerHTML.includes('<h2>'+object(course).name+'</h2>'));$('infoDialog').close();
// Hover follows a region's true outline; no unrelated circle at its catalog centre.
const originalCircle=circle;let hoverRings=0;circle=()=>hoverRings++;
for(const id of ['laniakea','sloan','bootes','ring']){hover=object(id);drawHover();}assert.equal(hoverRings,0);
hover=object('sirius');drawHover();assert.equal(hoverRings,1);circle=originalCircle;hover=null;
console.log('PASS in-flight object browsing preserves course and clocks; superstructures have no hover circles');
console.log('PASS animation frames preserve star positions and atlas labels, including card-height changes');
console.log('PASS scale hierarchy, non-overlapping atlas labels, galaxy sizes, clean names, search, cosmic distances and unchanged 3D');
`);
