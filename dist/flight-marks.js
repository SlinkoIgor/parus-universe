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
  const labels={acceleration:'КОНЕЦ РАЗГОНА',brake:'МАГНИТНОЕ ТОРМОЖЕНИЕ',fine:'ТОЧНОЕ ТОРМОЖЕНИЕ'},offsets={acceleration:-20,brake:20,fine:36};
  const occupied=[];for(const m of f?.markers||[]){const p=screen(FlightView.at(f,FlightView.fraction(f,m.p3)));circle(p.x,p.y,4,'#666666',.9,m.actual?[]:[2,2]);let dy=offsets[m.kind];while(occupied.some(t=>Math.abs(t.x-p.x)<175&&Math.abs(t.y-(p.y+dy))<14))dy+=16;occupied.push({x:p.x,y:p.y+dy});line(p.x,p.y+Math.sign(dy)*6,p.x,p.y+dy-Math.sign(dy)*5,'#888888',.6);text(labels[m.kind]+(m.actual?'':' · ПРОГНОЗ'),p.x+8,p.y+dy,7,'#777777');}
 }
};
