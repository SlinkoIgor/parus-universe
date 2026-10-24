'use strict';
const FlightMarks={
 set(f,kind,p3,actual=false){
  if(!p3)return;f.markers??=[];const old=f.markers.find(m=>m.kind===kind);if(old?.actual&&!actual)return;
  const mark={kind,p3:[...p3],actual};if(old)Object.assign(old,mark);else f.markers.push(mark);
 },
 at(f,ds){return Space.mix(f.from,f.aim||object(f.target),ds/f.distance).p3;},
 plan(f=state.flight){
  if(!f)return;const accelerating=!!(f.wind||f.engine?.direction>0),end=f.wind?(f.wind.baseCovered||0)+f.wind.distance:(f.engine?.baseCovered||0)+(f.engine?.burnDistance||0);
  if(accelerating)this.set(f,'acceleration',this.at(f,Math.min(f.distance,end)));
  if(Route.isFlyby(f)){f.markers=(f.markers||[]).filter(m=>m.kind==='acceleration');return;}
  const fuel=f.engine?.direction>0?state.matter-f.engine.budget:state.matter,stop=Magnetic.stopping(Math.max(0,fuel),f.maxBeta||state.beta,Math.max(1,Math.abs(state.controlG)||100));
  if(stop.magnetic){const brake=Math.max(0,f.distance-stop.distance);this.set(f,'brake',this.at(f,brake));this.set(f,'fine',this.at(f,brake+stop.magnetic.distance));}
 },
 actual(kind){const f=state.flight;if(f)this.set(f,kind,state.ship.p3,true);},
 draw(f=state.flight){
  const labels={acceleration:'КОНЕЦ РАЗГОНА',brake:'ТОРМОЖЕНИЕ ПАРУСОМ',fine:'ТОЧНОЕ ТОРМОЖЕНИЕ'};
  for(const m of f?.markers||[]){const p=screen(FlightView.at(f,FlightView.fraction(f,m.p3)));circle(p.x,p.y,4,'#666666',.9,m.actual?[]:[2,2]);MapLabels.point({key:'flight-mark-'+m.kind,name:labels[m.kind]+(m.actual?'':' · ПРОГНОЗ'),p,priority:115,size:8});}

 }
};
