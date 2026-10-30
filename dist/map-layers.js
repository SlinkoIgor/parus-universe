'use strict';
// Coarser structures are complete spatial layers, never point-LOD samples.
const MapLayers={
 active:false,boot:MAP_LAYER_BOOT,categories:Object.keys(MAP_LAYER_BOOT.roots),cache:new Map(),inflight:new Map(),errors:new Map(),slices:new Map(),ready:new Map(),visible:[],visibleMap:new Map(),wanted:new Set(),lastUpdate:-Infinity,
 category(o){return MapDetails.group(o);},
 manages(o){return Object.hasOwn(this.boot.roots,this.category(o));},
 get(id){return this.visibleMap.get(id);},
 start(){if(this.boot.catalogRevision!==EXTENDED_BOOT.revision){this.error='Версии слоёв карты и каталога различаются';return;}if(typeof fetch==='function'||globalThis.PARUS_CATALOG_FILES)this.active=true;},
 sample(category){return{kind:category==='filament'||category==='supercluster'?'structure':category==='stellar-cluster'||category==='galaxy-cluster'?'cluster':category,cosmicSubtype:category,catalogClass:category,cosmicCatalog:true,type:category==='galaxy-cluster'?'Скопление галактик':''};},
 enabled(category,view=cam,viewportWidth=width){const o=this.sample(category);return ExtendedCatalog.matchesMap(o,true)&&MapDetails.visible(o,view.span,viewportWidth);},
 filesForView(view,w,h){
  const v=Cosmology.referenceView(view),pixel=v.span/Math.max(1,w),cy=h*(w<700?.39:.5),box=[v.x-.43*w*pixel,v.y-cy*pixel,v.x+.57*w*pixel,v.y+(h-cy)*pixel],result=new Map();
  const intersects=b=>b[0]<=box[2]&&b[2]>=box[0]&&b[1]<=box[3]&&b[3]>=box[1];
  for(const [category,root] of Object.entries(this.boot.roots)){
   const files=[];if(this.enabled(category,view,w)){const visit=id=>{const n=this.boot.nodes[id];if(!intersects(n.box))return;if(n.file)files.push(n.file);else n.children.forEach(visit);};visit(root);}result.set(category,files);
  }return result;
 },
 load(file){
  if(this.cache.has(file)){const rows=this.cache.get(file);this.cache.delete(file);this.cache.set(file,rows);return Promise.resolve(rows);}
  if(this.inflight.has(file))return this.inflight.get(file);
  const promise=ExtendedCatalog.readJSON(this.boot.dataRoot+'/'+file).then(rows=>{const objects=rows.map(r=>ExtendedCatalog.decode(r));this.cache.set(file,objects);this.errors.delete(file);return objects;}).catch(e=>{this.errors.set(file,performance.now());this.error=e.message;throw e;}).finally(()=>{this.inflight.delete(file);this.lastUpdate=-Infinity;});
  this.inflight.set(file,promise);return promise;
 },
 update(now){
  if(!this.active||now-this.lastUpdate<180)return;this.lastUpdate=now;
  const groups=this.filesForView(cam,width,height);this.wanted=new Set([...groups.values()].flat());
  // Load the structural context before its smaller objects. A pending larger
  // cut keeps the previous complete one, while newly exposed detail waits.
  const ordered=['filament','galaxy-cluster','stellar-cluster','nebula','supercluster','void'];
  for(const category of ordered)for(const file of groups.get(category)||[])if(!this.cache.has(file)&&this.inflight.size+ExtendedCatalog.inflight.size<4&&now-(this.errors.get(file)??-Infinity)>3000)this.load(file).catch(()=>{});
  let changed=false;
  for(const [category,files] of groups){
   const key=files.join('|'),ready=files.every(file=>this.cache.has(file));this.ready.set(category,ready);
   if(ready&&this.slices.get(category)?.key!==key){this.slices.set(category,{key,objects:files.flatMap(file=>this.cache.get(file))});changed=true;}
  }
  if(changed){this.visible=[...this.slices.values()].flatMap(q=>q.objects);this.visibleMap=new Map(this.visible.map(o=>[o.id,o]));}
  // Full visible layers are protected. Only old, offscreen tiles are evicted.
  if(this.cache.size>this.wanted.size+16)for(const file of this.cache.keys()){if(!this.wanted.has(file))this.cache.delete(file);if(this.cache.size<=this.wanted.size+16)break;}
 },
 completeAbove(level){
  // Readiness and filters are shared by every landmark in the same view.
  // Include the ready bits so a completed download (or retry) invalidates it.
  let mask=0;for(let i=0;i<this.categories.length;i++)if(this.ready.get(this.categories[i])===true)mask|=1<<i;
  const chosen=typeof filter==='string'?filter:'all',cached=this.landmarkContext;
  if(!cached||cached.span!==cam.span||cached.width!==width||cached.filter!==chosen||cached.mask!==mask){let blocked=-1;for(const category of this.categories)if(this.ready.get(category)!==true&&this.enabled(category))blocked=Math.max(blocked,MapDetails.level(this.sample(category)));this.landmarkContext={span:cam.span,width,filter:chosen,mask,blocked};}
  return this.landmarkContext.blocked<=level;
 },
 admits(o){
  if(!this.active)return true;
  // Beyond a complete layer's range, the bounded point catalogue may still
  // supply host-scale members or isolated representatives of that category.
  if(this.manages(o)&&this.enabled(this.category(o))&&!MapDetails.sparse(o,cam.span)&&!ExtendedCatalog.coreIndex?.has(o.id)&&!ExtendedCatalog.pinned.has(o.id)&&!this.visibleMap.has(o.id))return false;
  const level=MapDetails.level(o);
  // A small landmark can survive far past its own class. Wait for every
  // enabled coarser layer there, so an unloaded structure is never a gap.
  if(MapDetails.sparse(o,cam.span))return this.completeAbove(level);
  const dependencies=level===0?['stellar-cluster','nebula']:level===2?['filament','galaxy-cluster']:level===3?['filament']:[];
  return dependencies.every(category=>!this.enabled(category)||this.ready.get(category)===true);
 },
 readout(){
  const s=cam.span,filaments=this.enabled('filament'),level=s<.01?'Планетные системы':s<2000?'Звёзды · звёздные скопления':s<300000?'Звёздные скопления · туманности':s<3e8?'Галактики · скопления галактик':s<2e9?'Скопления галактик'+(filaments?' · нити':' · крупные структуры'):filaments?'Нити · крупные структуры':'Крупные структуры';
  const chosen=typeof filter==='string'?filter:'all',text=chosen==='all'?level:({star:'Звёзды',pulsar:'Пульсары',blackhole:'Чёрные дыры',quasar:'Квазары',nebula:'Туманности',galaxy:'Галактики','stellar-cluster':'Звёздные скопления','galaxy-cluster':'Скопления галактик',structure:'Мегаструктуры',void:'Войды',horizon:'Горизонт'})[chosen]||level;
  return this.active&&Object.keys(this.boot.roots).some(c=>this.enabled(c)&&this.ready.get(c)!==true)?text+' · загрузка':text;
 }
};
globalThis.MapLayers=MapLayers;
