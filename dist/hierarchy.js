// A small expandable tree. The standalone data never depends on map tile revisions.
'use strict';
(() => {
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',BATCH=8,H=50,ROW=62;
 const rules={'protected-anchor':'Начало карты','declared-host':'Принятый хозяин из каталога','distance-domain':'Ближайшее радиальное окружение','local-cartographic-domain':'Локальная картографическая опора','published-cf4-group':'Опубликованная группа CF4','independent-anchor':'Самостоятельная опора','unlocated':'Без пространственной привязки'};
 const opened=new Set(),limits=new Map(),pinned=new Map(),children=new Map(),byId=new Map();
 let data,nodes,totals,positions=new Map(),bounds={w:264,h:50},mobile=innerWidth<600,W=264,view={x:0,y:0,k:1},suppressUntil=0;
 const number=n=>n.toLocaleString('ru-RU');
 const label=id=>id===-1?'Объекты':id===-2?'Без координат':nodes[id][1];
 const list=id=>children.get(id)||[];
 const descendants=id=>id===-1?data.actualCount:id===-2?list(-2).length:Math.max(0,totals[id]-(nodes[id][4]?0:1));
 const svg=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 function transform(){$('scene').setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.k})`);}
 function scaleToFit(){return Math.min(1.1,(innerWidth-40)/bounds.w,(innerHeight-140)/bounds.h);}
 function fit(){view.k=Math.max(.12,scaleToFit());view.x=(innerWidth-bounds.w*view.k)/2;view.y=65+(innerHeight-140-bounds.h*view.k)/2;transform();}
 function frame(id){
  if(scaleToFit()>=.8){fit();return;}
  const p=positions.get(id);if(!p){fit();return;}
  view.k=Math.max(.8,Math.min(1.1,view.k));
  view.x=mobile?18-p.x*view.k:Math.min(24,innerWidth*.35-(p.x+W/2)*view.k);
  view.y=mobile?82-p.y*view.k:innerHeight/2-(p.y+H/2)*view.k;transform();
 }
 function zoom(factor,x,y){const k=Math.max(.12,Math.min(3,view.k*factor)),r=k/view.k;view.x=x-(x-view.x)*r;view.y=y-(y-view.y)*r;view.k=k;transform();}
 function branch(id){
  const kids=[];
  if(opened.has(id)){
   const all=list(id),n=limits.get(id)||BATCH,shown=all.slice(0,n);
   for(const p of pinned.get(id)||[])if(!shown.includes(p))shown.push(p);
   for(const child of shown)kids.push(branch(child));
   if(all.length>shown.length)kids.push({id:'more:'+id,moreFor:id,remaining:all.length-shown.length,kids:[],height:ROW});
  }
  return{id,kids,height:Math.max(ROW,kids.reduce((sum,c)=>sum+c.height,0))};
 }
 function layout(tree){
  const out=[];let cursor=0;
  function place(t,depth,top,parent){
   const x=mobile?depth*22:depth*(W+68),y=mobile?cursor:top+(t.height-ROW)/2;
   if(mobile)cursor+=ROW;
   const p={...t,x,y,parent};out.push(p);
   let next=top;for(const child of t.kids){place(child,depth+1,next,p);next+=child.height;}
  }
  place(tree,0,0,null);bounds={w:Math.max(...out.map(p=>p.x+W)),h:Math.max(...out.map(p=>p.y+H))};return out;
 }
 function toggle(id){
  if(opened.has(id))opened.delete(id);else opened.add(id);
  render();frame(id);
 }
 function card(p){
  const more=p.moreFor!==undefined,expandable=more||list(p.id).length>0,isOpen=opened.has(p.id);
  const title=more?'Ещё '+number(p.remaining):label(p.id),n=more?0:descendants(p.id);
  const g=svg('g',{class:'branch'+(expandable?' expandable':' leaf')+(isOpen?' open':'')+(more?' more':''),transform:`translate(${p.x} ${p.y})`,...(more?{'data-more':p.moreFor}:{'data-id':p.id<0?String(p.id):nodes[p.id][0]}),...(expandable?{tabindex:0,role:'button','aria-label':title,'aria-expanded':String(isOpen)}:{role:'img','aria-label':title})});
  let tip=title;if(!more&&p.id>=0)tip+='\n'+(rules[data.rules[nodes[p.id][3]]]||'')+(nodes[p.id][4]?' · замороженная опора':'');
  if(!more&&p.id===-1)tip+='\nКаталог объектов и опор радиальной проекции. Раздел каталога не является физическим родителем.';
  if(!more&&n)tip+='\nВнутри: '+number(n);
  g.append(svg('title',{},tip),svg('rect',{width:W,height:H,rx:9}));
  const text=svg('text',{x:14,y:!more&&n?21:30,class:'name'},title);g.append(text);
  if(!more&&n)g.append(svg('text',{x:14,y:38,class:'count'},number(n)+' внутри'));
  if(expandable)g.append(svg('text',{x:W-20,y:31,'text-anchor':'middle',class:'toggle'},more?'+':isOpen?'−':'+'));
  $('scene').append(g);
  const max=W-(expandable?48:28);while(text.getComputedTextLength()>max&&text.textContent.length>2){text.textContent=text.textContent.replace(/…$/,'').slice(0,-1)+'…';}
  if(expandable){
   const activate=()=>{if(more){limits.set(p.moreFor,(limits.get(p.moreFor)||BATCH)+BATCH);render();frame(p.moreFor);}else toggle(p.id);};
   g.addEventListener('click',()=>{if(performance.now()>=suppressUntil)activate();});
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
  }
 }
 function render(){
  const scene=$('scene');scene.replaceChildren();positions=new Map();
  const rows=layout(branch(-1));
  for(const p of rows){
   positions.set(p.id,p);const parent=p.parent;if(!parent)continue;
   const x1=parent.x+W,y1=parent.y+H/2,x2=p.x,y2=p.y+H/2,mid=(x1+x2)/2;
   const d=mobile?`M${parent.x+11},${parent.y+H} V${y2} H${x2}`:`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
   const r=typeof p.id==='number'&&p.id>=0?data.rules[nodes[p.id][3]]:'';
   scene.append(svg('path',{d,class:'edge'+(['distance-domain','local-cartographic-domain'].includes(r)?' cartographic':'')}));
  }
  for(const p of rows)card(p);
  transform();
 }
 function reset(){opened.clear();limits.clear();pinned.clear();history.replaceState(null,'',location.pathname+location.search);render();fit();}
 function openLink(){
  const id=new URLSearchParams(location.hash.slice(1)).get('object'),target=byId.get(id);
  if(target===undefined)return;
  let current=target;
  for(let parent=nodes[current][2];;parent=nodes[current][2]){
   const key=parent<0?(data.rules[nodes[current][3]]==='unlocated'?-2:-1):parent;
   opened.add(key);if(!pinned.has(key))pinned.set(key,new Set());pinned.get(key).add(current);
   if(key===-1)break;if(key===-2){opened.add(-1);break;}current=parent;
  }
  if(list(target).length)opened.add(target);render();frame(target);
 }
 $('fit').onclick=fit;$('reset').onclick=()=>{if(data)reset();};
 $('tree').addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);},{passive:false});
 const pointers=new Map();let drag=null,pinch=null;
 $('tree').addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,moved:false};else{pinch=[...pointers.values()];suppressUntil=performance.now()+400;}});
 $('tree').addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){
   const ps=[...pointers.values()];if(pinch){const old=Math.hypot(pinch[0].x-pinch[1].x,pinch[0].y-pinch[1].y),now=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(old>0)zoom(now/old,(ps[0].x+ps[1].x)/2,(ps[0].y+ps[1].y)/2);}pinch=ps;suppressUntil=performance.now()+400;return;
  }
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;
  if(drag.moved){$('tree').setPointerCapture(e.pointerId);view.x=drag.vx+dx;view.y=drag.vy+dy;transform();$('tree').classList.add('dragging');suppressUntil=performance.now()+250;}
 });
 function end(e){pointers.delete(e.pointerId);pinch=null;drag=null;$('tree').classList.remove('dragging');}
 $('tree').addEventListener('pointerup',end);$('tree').addEventListener('pointercancel',end);
 window.addEventListener('resize',()=>{const next=innerWidth<600;if(next!==mobile){mobile=next;if(data)render();}fit();});
 window.addEventListener('hashchange',()=>{if(data)openLink();});
 async function start(){
  try{
   const res=await fetch('hierarchy-data/tree.json.gz?v=2',{cache:'no-store'});if(!res.ok)throw Error('load');
   data=await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).json();
   if(data.version!==2||!Array.isArray(data.nodes))throw Error('format');nodes=data.nodes;
   totals=new Uint32Array(nodes.length);const depth=new Uint16Array(nodes.length);
   nodes.forEach((n,i)=>{byId.set(n[0],i);const key=n[2]<0&&data.rules[n[3]]==='unlocated'?-2:n[2];if(!children.has(key))children.set(key,[]);children.get(key).push(i);totals[i]=n[4]?0:1;});
   const d=i=>{const p=nodes[i][2];return p<0?0:depth[i]||(depth[i]=d(p)+1);};
   const order=nodes.map((_,i)=>i).sort((a,b)=>d(b)-d(a));for(const i of order){const p=nodes[i][2];if(p>=0)totals[p]+=totals[i];}
   if(children.has(-2))children.get(-1).push(-2);
   const size=i=>i===-2?list(-2).length:totals[i];
   for(const all of children.values())all.sort((a,b)=>size(b)-size(a)||label(a).localeCompare(label(b),'ru'));
   $('status').replaceChildren();render();fit();openLink();
  }catch{
   $('status').textContent='Не удалось загрузить объекты.';
   const retry=document.createElement('button');retry.textContent='Повторить';retry.onclick=()=>location.reload();$('status').append(retry);document.body.classList.add('error');
  }
 }
 start();
})();
