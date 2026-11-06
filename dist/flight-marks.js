'use strict';
const FlightMarks={
 set(f,kind,p3,actual=false){
  if(!p3)return;f.markers??=[];const old=f.markers.find(m=>m.kind===kind);if(old?.actual&&!actual)return;
  const mark={kind,p3:[...p3],actual};if(old)Object.assign(old,mark);else f.markers.push(mark);
 },
 at(f,ds){return Space.mix(f.from,f.aim||object(f.target),ds/f.distance).p3;},
 plan(f=state.flight){
  if(!f)return;
  if(f.mission){const p=f.mission;this.set(f,'acceleration',this.at(f,p.accelerationEnd.comoving));if(!p.passage)this.set(f,'brake',this.at(f,p.accelerationEnd.comoving+p.coast.distance));return;}
  const accelerating=!!(f.wind||f.engine?.direction>0),end=f.wind?(f.wind.baseCovered||0)+f.wind.distance/Cosmology.factor(f):(f.engine?.baseCovered||0)+(f.engine?.burnDistance||0)/Cosmology.factor(f);
  if(accelerating)this.set(f,'acceleration',this.at(f,Math.min(f.distance,end)));
  if(Route.isFlyby(f)){f.markers=(f.markers||[]).filter(m=>m.kind==='acceleration');return;}
  const fuel=f.engine?.direction>0?state.matter-f.engine.budget:state.matter,stop=Magnetic.stopping(Math.max(0,fuel),f.maxBeta||state.beta,Math.max(1,Math.abs(state.controlG)||100));
  if(stop.magnetic){const brake=Math.max(0,f.distance-stop.distance/Cosmology.factor(f));this.set(f,'brake',this.at(f,brake));this.set(f,'fine',this.at(f,brake+stop.magnetic.distance/Cosmology.factor(f)));}
 },
 actual(kind){const f=state.flight;if(f)this.set(f,kind,state.ship.p3,true);},
 draw(f=state.flight){
  if(!f?.markers?.length)return;
  // Stage details belong to a close view of the route, never its overview.
  // Fade them in only after the full projected leg spans two screen widths.
  const a=FlightView.at(f,0),b=FlightView.at(f,1),zoom=Math.hypot(b.x-a.x,b.y-a.y)/cam.span,
   fade=Math.max(0,Math.min(1,zoom-2)),opacity=fade*fade*(3-2*fade);
  if(opacity<=.03)return;
  const labels={acceleration:'КОНЕЦ РАЗГОНА',brake:f?.mission?'ТОРМОЖЕНИЕ':'ТОРМОЖЕНИЕ ПАРУСОМ',fine:'ТОЧНОЕ ТОРМОЖЕНИЕ'};
  const groups=[];
  for(const m of f.markers){
   const p=screen(FlightView.at(f,FlightView.fraction(f,m.p3)));
   if(!Number.isFinite(p.x+p.y)||p.x<8||p.x>width-8||p.y<8||p.y>height-8)continue;
   const nearby=groups.find(g=>Math.hypot(g.p.x-p.x,g.p.y-p.y)<48);
   if(nearby)nearby.marks.push(m);else groups.push({p,marks:[m]});
  }
  for(const {p,marks} of groups){
   // Keep the first event's anchor instead of averaging two coincident stages.
   const actual=marks.every(m=>m.actual),kinds=marks.map(m=>m.kind),name=marks.length>1?(kinds.includes('acceleration')?'РАЗГОН → ТОРМОЖЕНИЕ':'ТОРМОЖЕНИЕ'):labels[kinds[0]];
   ctx.save();ctx.globalAlpha=opacity;circle(p.x,p.y,4,'#666666',.9,actual?[]:[2,2]);ctx.restore();
   MapLabels.point({key:'flight-mark-'+kinds.join('-'),name:name+(actual?'':' · ПРОГНОЗ'),p,priority:115,size:8,opacity});
  }
 }
};
