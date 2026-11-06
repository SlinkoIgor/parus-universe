'use strict';
// A zoom-dependent, uniform slice in physical Galactic XYZ. Display coordinates and
// cartographic Milky Way offsets never participate in this selection.
const MapSlice={
 mode:'full',centerZ:0,profile:{type:'uniform-zoom',thicknessToSpan:.5},manifest:null,loading:null,error:null,
 halfThicknessAt(p3,view=cam){return Cosmology.referenceView(view).span*this.profile.thicknessToSpan/2;},
 treeForView(view){const m=this.manifest;if(!m)return null;const half=Math.abs(this.centerZ)+this.halfThicknessAt(null,view),band=m.bands.find(b=>b.halfThicknessLy>=half)||m.bands.at(-1);return{nodes:m.nodes,roots:band.roots,band:band.halfThicknessLy};},
 position3D(o){return globalThis.OrbitalMotion?.snapshot3D(o)||o?.p3;},
 focus(o){if(o?.p3?.every(Number.isFinite)&&!o.atlasOnly){this.centerZ=this.position3D(o)[2];if(typeof ExtendedCatalog!=='undefined'){ExtendedCatalog.cutKey=null;ExtendedCatalog.lastUpdate=-Infinity;}}},
 opacity(o){if(this.mode!=='slice'||!o?.p3)return 1;const t=Math.max(0,Math.min(1,(1-Math.abs(this.position3D(o)[2]-this.centerZ)/this.halfThicknessAt())/.1));return t*t*(3-2*t);},
 includes(o){
  if(this.mode!=='slice')return true;
  if(!o||o.atlasOnly||o.positionQuality==='unknown')return false;
  // Some historical regions have only a made-up 2D arrival anchor. It cannot
  // establish membership of a physical 3D slab.
  if(globalThis.MapGeometry?.unlocated(o))return false;
  const p=this.position3D(o);return p?.length===3&&p.every(Number.isFinite)&&Math.abs(p[2]-this.centerZ)<=this.halfThicknessAt(p);
 },
 async load(){
  if(this.manifest||this.loading)return this.loading;
  this.error=null;
  this.loading=Promise.resolve().then(async()=>{
   try{
    const pointer=await ExtendedCatalog.readJSON('map-slices/current.json');
    const manifest=await ExtendedCatalog.readJSON(pointer.dataRoot+'/manifest.json');
    if(manifest.version!==3||!manifest.bands?.length||manifest.catalogRevision!==EXTENDED_BOOT.revision||manifest.geometryVersion!==MapLayout.version||Object.entries(this.profile).some(([key,value])=>manifest.profile?.[key]!==value))throw Error('Индекс среза не соответствует каталогу и форме');
    this.manifest=manifest;ExtendedCatalog.lastUpdate=-Infinity;
   }catch(e){this.error=e.message;}
   finally{this.loading=null;this.render();}
  });
  this.render();return this.loading;
 },
 setMode(mode){
  this.mode=['full','slice','radial'].includes(mode)?mode:'full';
  if(this.mode==='slice'){const anchor=followShip?state.ship:object(state.selected);if(anchor?.p3){const p=screen(anchor);if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)this.focus(anchor);}}
  Cosmology.cache.clear();
  globalThis.MapLayers?.admitted?.clear();
  ExtendedCatalog.cancelViewLoads([]);
  ExtendedCatalog.transitions.clear();ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
  MapLayers.setGeometry(this.mode==='radial'?globalThis.MapRadial?.layers:null);
  try{localStorage.setItem('parus-map-mode',this.mode);}catch{}
  hover=null;hitObjects=[];RegionMap.hits=[];RegionMap.renderCache=null;
  ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.cutKey=null;
  MapLayers.lastUpdate=-Infinity;
  if(this.mode==='slice')this.load();
  if(this.mode==='radial')MapRadial.load();
  if(followShip){const c=shipCamera();goCamera(c.x,c.y,c.span,true,true);}
  this.render();this.renderSelection();updateMapHeading();
 },
 renderSelection(){
  const target=object(state.flight?.target||state.selected);
  $('mapSliceTargetNotice').hidden=this.mode!=='slice'||this.includes(target);
 },
 render(){
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===this.mode)));
  $('mapControlsTitle').textContent=this.mode==='slice'?'Карта · срез':this.mode==='radial'?'Карта · радиальная':'Карта и время';
  const status=$('mapSliceStatus');
  const index=this.mode==='radial'?MapRadial:this,label=this.mode==='radial'?'Радиальная':'Срез';
  status.hidden=this.mode==='full'||!index.error&&!index.loading;
  status.textContent=index.error?'Не удалось загрузить карту. Нажмите «'+label+'» ещё раз.':index.loading?'Загрузка карты…':'';
  status.title=index.error||'';
  // The complete atlas stays searchable. Only its map is sliced.
  $('mapModeNotice').hidden=this.mode!=='slice';
  $('mapModeNotice').textContent=this.mode==='slice'?'Срез параллелен плоскости Млечного Пути. Толщина везде одинакова — половина ширины карты. При фокусировке срез проходит через выбранный объект; перемещение карты его высоту не меняет. Атлас показывает весь каталог.':'';
 },
 setup(){
  let mode='full';try{mode=localStorage.getItem('parus-map-mode');}catch{}
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.mapMode));
  // Retire the saved slice choice; the public switch offers full/radial.
  this.setMode(mode==='radial'?'radial':'full');
 }
};
globalThis.MapSlice=MapSlice;
