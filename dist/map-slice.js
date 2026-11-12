'use strict';
const MapSlice={
 mode:'full',
 setMode(mode){
  this.mode=mode==='radial'?'radial':'full';
  Cosmology.cache.clear();
  globalThis.MapLayers?.admitted?.clear();
  ExtendedCatalog.cancelViewLoads([]);
  ExtendedCatalog.transitions.clear();ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();
  MapLayers.setGeometry(this.mode==='radial'?globalThis.MapRadial?.layers:null);
  try{localStorage.setItem('parus-map-mode',this.mode);}catch{}
  hover=null;hitObjects=[];RegionMap.hits=[];RegionMap.renderCache=null;
  ExtendedCatalog.lastUpdate=-Infinity;ExtendedCatalog.cutKey=null;
  MapLayers.lastUpdate=-Infinity;
  if(this.mode==='radial')MapRadial.load();
  if(followShip){const c=shipCamera();goCamera(c.x,c.y,c.span,true,true);}
  this.render();updateMapHeading();
 },
 render(){
  const radial=this.mode==='radial';
  document.querySelectorAll('[data-map-mode]').forEach(input=>{input.checked=input.dataset.mapMode===this.mode;});
  $('mapControlsTitle').textContent=radial?'Карта · радиальная':'Карта и время';
  const status=$('mapSliceStatus');
  status.hidden=!radial||!MapRadial.error&&!MapRadial.loading;
  status.textContent=!radial?'':MapRadial.error?'Не удалось загрузить карту. Нажмите «Радиальная» ещё раз.':MapRadial.loading?'Загрузка карты…':'';
  status.title=radial&&MapRadial.error||'';
 },
 setup(){
  let mode='full';try{mode=localStorage.getItem('parus-map-mode');}catch{}
  document.querySelectorAll('[data-map-mode]').forEach(input=>{
   input.onchange=()=>{if(input.checked)this.setMode(input.dataset.mapMode);};
   // A selected radio can retry a failed radial download without changing modes.
   input.onclick=()=>{if(input.checked&&input.dataset.mapMode==='radial'&&this.mode==='radial'&&MapRadial.error)this.setMode('radial');};
  });
  // Retire the saved slice choice; the public switch offers full/radial.
  this.setMode(mode==='radial'?'radial':'full');
 }
};
globalThis.MapSlice=MapSlice;
