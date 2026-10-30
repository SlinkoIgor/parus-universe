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
  this.mode=mode==='slice'?'slice':'full';
  try{localStorage.setItem('parus-map-mode',this.mode);}catch{}
  hover=null;hitObjects=[];RegionMap.hits=[];RegionMap.renderCache=null;
  ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.cutKey=null;
  MapLayers.lastUpdate=-Infinity;
  if(this.mode==='slice')this.load();
  this.render();this.renderSelection();updateMapHeading();
 },
 renderSelection(){
  const target=object(state.flight?.target||state.selected);
  $('mapSliceTargetNotice').hidden=this.mode!=='slice'||this.includes(target);
 },
 render(){
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===this.mode)));
  $('mapControlsTitle').textContent=this.mode==='slice'?'Карта · срез':'Карта и время';
  const status=$('mapSliceStatus');
  status.hidden=this.mode!=='slice'||!this.error&&!this.loading;
  status.textContent=this.error?'Не удалось загрузить срез. Нажмите «Срез» ещё раз.':this.loading?'Загрузка среза…':'';
  status.title=this.error||'';
  // The complete atlas stays searchable. Only its map is sliced.
  $('mapModeNotice').hidden=this.mode!=='slice';
 },
 setup(){
  let mode='full';try{mode=localStorage.getItem('parus-map-mode');}catch{}
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.mapMode));
  this.setMode(mode);
 }
};
globalThis.MapSlice=MapSlice;
