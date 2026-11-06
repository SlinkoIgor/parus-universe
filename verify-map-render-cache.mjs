import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);MapSlice.mode='full';width=1440;height=1000;dpr=2;filter='all';state.selected=null;hover=null;
MapLayers.active=false;MapLayers.visible=[];ExtendedCatalog.visible=[];ExtendedCatalog.pinned.clear();
const originalObjects=[...OBJECTS],make=(id,name,x,points)=>({id,name,kind:'structure',cosmicSubtype:'filament',cosmicLandmark:true,p3:[x,0,0],mapPosition:{x,y:0},region:{shape:'polyline',major:800,minor:240,points,offsets3:points.map(([x,y])=>[x,-y,0])}});
const a=make('cache-a','Тестовая нить',0,[[-200,-80],[0,0],[200,100]]),b=make('cache-b','Крайняя нить',865,[[0,-50],[80,30]]);
OBJECTS.splice(0,OBJECTS.length,a,b);cam={x:0,y:0,span:1440};
const scientific=JSON.stringify(OBJECTS),render=RegionMap.render;let renders=0;RegionMap.render=function(...args){renders++;return render.apply(this,args);};RegionMap.renderCache=null;
const draw=()=>{MapLabels.begin();RegionMap.draw();MapLabels.draw();};
draw();assert.equal(renders,1);const surface=RegionMap.renderCache.canvas,initialHit=RegionMap.hits.find(h=>h.o===a),before=initialHit.points.map(p=>({...p})),runBefore=initialHit.runs.flatMap(r=>r.points).map(p=>({...p})),label={...initialHit.label};assert.ok(initialHit.label,'named contour label is placed');
assert.equal(surface.width,(width+192)*dpr);assert.equal(surface.height,(height+192)*dpr);
cam.x=40;cam.y=-25;draw();assert.equal(renders,1,'small pan translates the cached raster');assert.equal(RegionMap.renderCache.canvas,surface);
const shifted=RegionMap.hits.find(h=>h.o===a);for(let i=0;i<before.length;i++){assert.ok(Math.abs(shifted.points[i].x-before[i].x+40)<1e-9);assert.ok(Math.abs(shifted.points[i].y-before[i].y-25)<1e-9);}
for(const [i,p] of shifted.runs.flatMap(r=>r.points).entries()){assert.ok(Math.abs(p.x-runBefore[i].x+40)<1e-9);assert.ok(Math.abs(p.y-runBefore[i].y-25)<1e-9,'cached hover paths translate exactly once with the clipped segments');}
assert.ok(Math.abs(shifted.label.x-label.x+40)<1e-9);assert.ok(Math.abs(shifted.label.y-label.y-25)<1e-9,'cached label callback follows its contour');
const p=shifted.points[1];assert.equal(RegionMap.hit(p.x,p.y)?.id,a.id,'picking uses translated screen coordinates');MapLandmarks.prepare();assert.equal(MapLandmarks.clear({x:p.x-2,y:p.y-2,w:4,h:4},null),false,'collision grid follows the same translated segment');
cam.x=80;draw();assert.equal(renders,1);const edge=RegionMap.hits.find(h=>h.o===b),e=edge.segments[0][0];assert.ok(e.x<width,'padded geometry enters the viewport');assert.equal(RegionMap.hit(e.x,e.y)?.id,b.id,'newly exposed edge is clickable without a rebuild');
let strokes=0;const stroke=ctx.stroke;ctx.stroke=()=>strokes++;hover=a;MapLabels.begin();RegionMap.draw();assert.equal(strokes,1,'hover draws one contour overlay');hover=b;MapLabels.begin();RegionMap.draw();assert.equal(strokes,2);assert.equal(renders,1,'changing hover cannot rebuild thousands of contours');ctx.stroke=stroke;
cam.x=130;draw();assert.equal(renders,2,'pan outside the padding rebuilds');assert.equal(RegionMap.renderCache.canvas,surface,'surface allocation is reused');
cam.span*=1.001;draw();assert.equal(renders,3,'zoom rebuilds at the exact scale');theme=theme==='dark'?'light':'dark';draw();assert.equal(renders,4,'theme invalidates raster');state.selected=a.id;draw();assert.equal(renders,5,'selection refreshes permanent style and labels');
filter='galaxy';draw();assert.equal(RegionMap.hits.length,0,'filters cannot leave cached click targets');filter='all';draw();assert.equal(RegionMap.hits.length,2);
assert.equal(JSON.stringify(OBJECTS),scientific,'pan, hover and zoom never alter world vertices or catalogue coordinates');
OBJECTS.splice(0,OBJECTS.length,...originalObjects);RegionMap.render=render;
console.log('PASS padded pan raster, entering edge spines, translated labels/picking/collision grid, hover overlay without rebuild, exact zoom/theme/selection/filter invalidation, unchanged source geometry and DPR2');
}`);
run(`{
 const originalSize=[width,height];width=200;height=100;
 const strokes=[];let points=[],closed=false,moves=0;
 const pen={lineDashOffset:1.25,getLineDash:()=>[3,6],beginPath(){points=[];closed=false;},moveTo(x,y){moves++;points.push([x,y]);},lineTo(x,y){points.push([x,y]);},closePath(){closed=true;},stroke(){strokes.push({points,closed,phase:this.lineDashOffset});}};
 const dense={closed:false,points:Array.from({length:161},(_,i)=>({x:20+i,y:50}))},source=JSON.stringify(dense);
 RegionMap.strokePaths(pen,RegionMap.clipPaths([dense],0).runs);
 assert.equal(strokes.length,1);assert.equal(moves,1,'subdividing a line must not restart its dash pattern');assert.equal(strokes[0].phase,1.25);assert.equal(JSON.stringify(dense),source);
 width=100;strokes.length=0;
 const excursion={closed:false,points:[{x:20,y:20},{x:150,y:20},{x:150,y:80},{x:20,y:80}]};
 RegionMap.strokePaths(pen,RegionMap.clipPaths([excursion],0).runs);
 assert.equal(strokes.length,2,'hidden segments must not introduce a screen-space bridge');assert.deepEqual(strokes[0].points,[[20,20],[100,20]]);assert.deepEqual(strokes[1].points,[[100,80],[20,80]]);
 assert.equal(strokes[1].phase,1.25+240%9,'visible reentry continues the pattern after the full offscreen distance');assert.equal(pen.lineDashOffset,1.25);
 strokes.length=0;RegionMap.strokePaths(pen,RegionMap.clipPaths([{closed:true,points:[{x:20,y:20},{x:80,y:20},{x:80,y:80},{x:20,y:80}]}],0).runs);
 assert.equal(strokes.length,1);assert.equal(strokes[0].closed,true,'a complete contour retains its closing join');
 [width,height]=originalSize;
 console.log('PASS screen-space dash subdivision invariance, offscreen phase continuity, separate clipped runs, closed joins and unchanged source vertices');
}`);
