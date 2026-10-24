'use strict';
// Display envelopes only. Physical routes never use these polygons.
const REGION_DATA={
 omega:{shape:'ellipse',major:150,minor:150,note:'Диаметр ≈150 св. лет.',url:'https://www.eso.org/public/news/eso0844/'},
 virgo:{shape:'ellipse',major:10.1e6,minor:10.1e6,note:'Вириальный диаметр ≈3,1 Мпк (10,1 млн св. лет).',url:'https://doi.org/10.1088/0067-0049/200/1/4'},
 coma:{shape:'ellipse',major:20.2e6,minor:20.2e6,note:'Вириальный диаметр ≈20,2 ±4,6 млн св. лет.',url:'https://doi.org/10.1093/mnras/stw305'},
 bootes:{shape:'ellipse',major:300e6,minor:300e6,note:'Приближённый диаметр ≈300 млн св. лет; граница разрежения условная.',url:'https://www.cambridge.org/core/journals/symposium-international-astronomical-union/article/survey-of-the-bootes-void/6F39377E63896D57AC817C29885A21D1'},
 laniakea:{shape:'basin',major:522e6,minor:522e6,note:'Масштаб бассейна ≈160 Мпк (522 млн св. лет). Область включает Млечный Путь; контур иллюстративный.',url:'https://www.nature.com/articles/nature13674'},
 attractor:{shape:'basin',major:150e6,minor:90e6,illustrative:true,note:'Единой измеренной границы нет. Показанная область иллюстративна, её размер не является измерением.',url:'https://arxiv.org/abs/astro-ph/0503647'},
 cfa:{shape:'ribbon',major:792e6,minor:280e6,note:'Обследованная протяжённость ≈170 ×60 h⁻¹ Мпк; при h=0,7 это ≈792 ×280 млн св. лет. Ориентация и толщина условные.',url:'https://pubmed.ncbi.nlm.nih.gov/17812575/'},
 sloan:{shape:'ribbon',major:1.412e9,minor:1.412e9*.08,note:'Длина ≈433 Мпк (1,41 млрд св. лет). Ширина ленты и ориентация иллюстративны.',url:'https://doi.org/10.1088/0004-637X/736/1/51'},
 ring:{shape:'ring',major:1.305e9,minor:1.305e9,note:'Кандидат: диаметр ≈400 Мпк (1,3 млрд св. лет). Толщина кольца условная.',url:'https://arxiv.org/abs/2402.07591'},
 arc:{shape:'arc',major:3.262e9,minor:1.2e9,note:'Кандидат: размах ≈1 Гпк (3,26 млрд св. лет). Кривизна и ширина рисунка условные.',url:'https://arxiv.org/abs/2201.06875'}
};
for(const o of OBJECTS){
 const r=o.regionData||REGION_DATA[o.id]||(o.p3&&['nebula','cluster'].includes(o.kind)&&o.diameterLy?{shape:'ellipse',major:o.diameterLy,minor:o.minorDiameterLy||o.diameterLy,note:'Оптические оси ≈'+o.diameterLy.toPrecision(3)+' × '+(o.minorDiameterLy||o.diameterLy).toPrecision(3)+' св. лет; угловые размеры OpenNGC.',url:o.source}:null);
 if(r){o.region=r;if(r.url&&!o.facts.refs.some(a=>a[0]===r.url))o.facts.refs.push([r.url,'Размер области']);}
}
const RegionMap={
 hits:[],
 center(o){return o.id==='laniakea'?{x:0,y:0}:MapLayout.project(o);},
 focus(o){const r=o.region,p=this.center(o);goCamera(p.x,p.y,Math.max(r.major,r.minor)*Cosmology.regionScale(o)*Math.max(1.7,width/Math.max(height*.6,1)));toast(r.note);},
 outline(r){const p=[];for(let i=0;i<=96;i++){const t=i/96,a=t*Math.PI*2;let x,y;
  if(r.shape==='ribbon'){const u=t<=.5?t*2:2-t*2;x=(u-.5)*r.major;y=Math.sin(u*Math.PI*3)*r.minor*.18+(t<=.5?-1:1)*r.minor*.28;}
  else if(r.shape==='arc'){x=(t-.5)*r.major;y=(4*(t-.5)**2-.5)*r.minor;}
  else{const f=r.shape==='basin'?1+.09*Math.sin(3*a)+.045*Math.cos(5*a):1;x=Math.cos(a)*r.major*.5*f;y=Math.sin(a)*r.minor*.5*f;}p.push({x,y});}return p;},
 draw(){this.hits=[];for(const o of OBJECTS.filter(o=>o.region&&!o.atlasOnly).sort((a,b)=>b.region.major-a.region.major)){const r=o.region,c=screen(this.center(o)),scale=width/cam.span*Cosmology.regionScale(o),rx=r.major*.5*scale,ry=r.minor*.5*scale;
  if(rx<4||rx>20000||c.x+rx*1.2<0||c.x-rx*1.2>width||c.y+ry*1.2<0||c.y-ry*1.2>height)continue;
  const points=this.outline(r).map(p=>({x:c.x+p.x*scale,y:c.y+p.y*scale})),selected=o.id===state.selected,highlighted=selected||hover?.id===o.id;
  ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(r.shape!=='arc')ctx.closePath();ctx.strokeStyle=paint(highlighted?'#454545':'#777777');ctx.lineWidth=highlighted?1.25:.7;ctx.setLineDash(r.shape==='ring'?[7,5]:[3,6]);ctx.stroke();ctx.restore();
  // Labels follow visible edges. A containing region never gets clamped onto the map centre.
  const edge=points.filter(p=>p.x>30&&p.x<width-30&&p.y>120&&p.y<height-65).sort((a,b)=>b.y-a.y||Math.abs(a.x-c.x)-Math.abs(b.x-c.x));
  const hit={o,points,label:null,closed:r.shape!=='arc'};this.hits.push(hit);
  if(rx>=18)MapLabels.add({key:'region-'+o.id,name:o.name.toUpperCase(),detail:r.illustrative?'ГРАНИЦА УСЛОВНАЯ':'ПРИБЛИЖЁННАЯ ОБЛАСТЬ',priority:selected?100:30,size:9,color:selected?'#454545':'#757575',candidates:edge.map(p=>({x:p.x,y:p.y-9,align:'center'})),onPlace:box=>{hit.label=box;}});
 }},
 hit(x,y){for(const h of [...this.hits].reverse()){if(h.label&&x>=h.label.x&&x<=h.label.x+h.label.w&&y>=h.label.y&&y<=h.label.y+h.label.h)return h.o;const p=h.points;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<9)return h.o;}}return null;}
};
