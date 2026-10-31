'use strict';
// A reference-epoch flared slice in physical Galactic XYZ. Display coordinates and
// cartographic Milky Way offsets never participate in this selection.
const MapSlice={
 mode:'full',profile:{type:'linear-galactic-xy',centerThicknessLy:1e8,edgeThicknessLy:1e10,radiusLy:46.5e9},manifest:null,loading:null,error:null,
 halfThicknessAt(p3){const p=this.profile,t=Math.min(1,Math.hypot(p3[0],p3[1])/p.radiusLy);return(p.centerThicknessLy+(p.edgeThicknessLy-p.centerThicknessLy)*t)/2;},
 includes(o){
  if(this.mode!=='slice')return true;
  if(!o||o.atlasOnly||o.positionQuality==='unknown')return false;
  // The Milky Way outline has no separate catalog point; its centre is Sgr A*.
  if(o.id==='milkyway')o=OBJECTS.find(q=>q.id==='sgr');
  // Some historical regions have only a made-up 2D arrival anchor. It cannot
  // establish membership of a physical 3D slab.
  if(o?.arrivalAnchor&&!Number.isFinite(o.raDeg)&&!Number.isFinite(o.decDeg))return false;
  return o?.p3?.length===3&&o.p3.every(Number.isFinite)&&Math.abs(o.p3[2])<=this.halfThicknessAt(o.p3);
 },
 async load(){
  if(this.manifest||this.loading)return this.loading;
  this.error=null;
  this.loading=Promise.resolve().then(async()=>{
   try{
    const pointer=await ExtendedCatalog.readJSON('map-slices/current.json');
    const manifest=await ExtendedCatalog.readJSON(pointer.dataRoot+'/manifest.json');
    if(manifest.version!==2||manifest.catalogRevision!==EXTENDED_BOOT.revision||manifest.geometryVersion!==MapLayout.version||Object.entries(this.profile).some(([key,value])=>manifest.profile?.[key]!==value))throw Error('Индекс среза не соответствует каталогу и форме');
    this.manifest=manifest;ExtendedCatalog.lastUpdate=-Infinity;
   }catch(e){this.error=e.message;}
   finally{this.loading=null;this.render();}
  });
  this.render();return this.loading;
 },
 setMode(mode){
  this.mode=['full','slice','radial'].includes(mode)?mode:'full';
  Cosmology.cache.clear();
  ExtendedCatalog.transitions.clear();ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
  MapLayers.setGeometry(this.mode==='radial'?globalThis.MapRadial?.layers:null);
  try{localStorage.setItem('parus-map-mode',this.mode);}catch{}
  hover=null;hitObjects=[];RegionMap.hits=[];RegionMap.renderCache=null;
  ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.cutKey=null;
  MapLayers.lastUpdate=-Infinity;
  if(this.mode==='slice')this.load();
  if(this.mode==='radial')MapRadial.load();
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
  $('mapModeNotice').hidden=this.mode==='full';
  $('mapModeNotice').textContent=this.mode==='radial'?'Звёзды до 1000 св. лет размещаются от Солнца, галактики до 15 млн св. лет — от центра Млечного Пути. Остальные объекты — от своих опор. Размеры контуров сохранены; полёты рассчитаны в 3D.':'Атлас показывает весь каталог. На карте — срез толщиной от 100 млн св. лет у Солнца до 10 млрд на краю обозримой Вселенной; отбор по каталожным 3D-позициям.';
 },
 setup(){
  let mode='full';try{mode=localStorage.getItem('parus-map-mode');}catch{}
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.mapMode));
  this.setMode(mode);
 }
};
globalThis.MapSlice=MapSlice;
