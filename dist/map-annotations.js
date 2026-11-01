'use strict';
// World-space thresholds choose names; each name stays beside its object.
// Panels and canvas edges naturally cover text without changing its anchor.
const MapAnnotations={
 get active(){return typeof MAP_LABEL_BOOT!=='undefined'&&MAP_LABEL_BOOT.version===1&&MAP_LABEL_BOOT.catalogRevision===EXTENDED_BOOT.revision&&MAP_LABEL_BOOT.geometryVersion===MapLayout.version&&(!MapRadial.manifest||MAP_LABEL_BOOT.radialRevision===MapRadial.manifest.revision);},
 get entries(){return this.index??=(new Map(MAP_LABEL_BOOT.entries.map((q,i)=>[q.id,{...q,rank:i}])));},
 opacity(o){const q=this.entries.get(o.id);if(!q)return 0;const pixel=cam.span/width,limit=q.limits[MapSlice.mode==='radial'?1:0],t=Math.max(0,Math.min(1,(pixel/limit-.8)/.2)),start=q.minPixel||0,u=start?Math.max(0,Math.min(1,(pixel/start-1)/.25)):1;return (1-t*t*(3-2*t))*u*u*(3-2*u);},
 hit(x,y){return this.hits?.find(q=>x>=q.box.x&&x<=q.box.x+q.box.w&&y>=q.box.y&&y<=q.box.y+q.box.h)?.object;},
 flightLabel(q){return q.key==='ship'||q.key.startsWith('flight-mark-');},
 place(q,obstacles){
  const p=q.p||q.candidates?.[0];if(!p)return;const size=q.size||10;ctx.font=size+'px "Golos Text",Arial,sans-serif';
  const w=ctx.measureText(q.name).width,moving=this.flightLabel(q),y=q.p?p.y+(moving?18:-8):p.y;let x=q.p?p.x+16:p.x-(p.align==='center'?w/2:p.align==='right'?w:0);
  const boxAt=offset=>({x:x-4,y:y+offset-size-4,w:w+8,h:size+10});let offset=0,box=boxAt(0);
  if(moving){
   // Prefer the right edge of a nearby sail before moving text far below it.
   for(const obstacle of obstacles)if(MapLabels.overlaps(box,obstacle)){const right=obstacle.x+obstacle.w+8;if(right+w+4<=width-8){x=Math.max(x,right);box=boxAt(0);}}
   // Keep the atlas fixed. Nearby flight events share a column below their
   // anchors; retain a free row across frames instead of jumping back up.
   const previous=MapLabels.slots.get(q.key)??0,rows=[...new Set([previous,0,1,2,3,4,5,6,7])];
   const row=rows.find(row=>{const b=boxAt(row*24);return b.x>=8&&b.x+b.w<=width-8&&b.y>=8&&b.y+b.h<=height-8&&![...MapLabels.boxes,...obstacles].some(other=>MapLabels.overlaps(b,other));});
   if(row===undefined)return;MapLabels.slots.set(q.key,row);offset=row*24;box=boxAt(offset);
  }
  if(q.object)this.hits.push({object:q.object,box});MapLabels.boxes.push(box);MapLabels.placed.push({key:q.key,...box});
  ctx.save();ctx.globalAlpha=q.alpha;text(q.name,x,y+offset,size,q.color||'#454545','left','sans');ctx.restore();q.onPlace?.(box);
 },
 draw(){
  const queued=MapLabels.queue.filter(q=>!q.object||q.key.startsWith('galaxy-')&&!this.entries.has(q.object.id)&&MapDetails.mapLabelName(q.object)).map(q=>q.object?{...q,name:MapDetails.mapLabelName(q.object).toUpperCase(),object:null}:q),items=[];
  for(const [id,entry] of this.entries){const o=ExtendedCatalog.get(id);if(!o||!MapDetails.visible(o,cam.span)||!ExtendedCatalog.matchesMap(o))continue;
   const name=MapDetails.mapLabelName(o);if(!name)continue;
   const alpha=this.opacity(o)*ExtendedCatalog.opacity(o);if(alpha<=.03)continue;const p=screen(o);if(p.x<0||p.x>width||p.y<0||p.y>height)continue;
   items.push({key:'object-'+id,name:name===o.name?entry.name:name,object:o,p,rank:entry.rank,alpha});
  }
  items.sort((a,b)=>a.rank-b.rank);
  this.admitted=items.map(q=>q.object.id);this.overflow=[];this.hits=[];
  MapLabels.boxes=[];MapLabels.uiCount=0;MapLabels.placed=[];
  // Include the sail, braking field and thrust around the ship. This guard
  // affects only flight captions, never the fixed catalogue names.
  const ship=screen(state.ship),radius=state.flight&&['launch','brake'].includes(state.phase)?65:18,obstacles=[{x:ship.x-radius,y:ship.y-radius,w:radius*2,h:radius*2}];
  const fixed=queued.filter(q=>!this.flightLabel(q)),moving=queued.filter(q=>this.flightLabel(q)).sort((a,b)=>Number(b.key==='ship')-Number(a.key==='ship')||a.key.localeCompare(b.key));
  for(const q of [...items,...[...fixed,...moving].map(q=>({...q,alpha:q.opacity??1}))])this.place(q,obstacles);
 }
};
globalThis.MapAnnotations=MapAnnotations;
MapLabels.legacyDraw=MapLabels.draw;
MapLabels.draw=function(){return MapAnnotations.active?MapAnnotations.draw():this.legacyDraw();};
