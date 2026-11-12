'use strict';
// Canvas drawing and picking geometry; catalogue coordinates stay unchanged.
function line(x1, y1, x2, y2, color = '#cecece', lw = 1, dash = []) {
  ctx.beginPath();
  ctx.setLineDash(dash);
  ctx.strokeStyle = paint(color);
  ctx.lineWidth = lw;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}
function circle(x, y, r, color = '#cccccc', lw = 1, dash = []) {
  if (r < 0 || r > 1e6) return;
  ctx.beginPath();
  ctx.setLineDash(dash);
  ctx.strokeStyle = paint(color);
  ctx.lineWidth = lw;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
function text(s, x, y, size = 9, color = '#808080', align = 'left', font = 'mono') {
  ctx.fillStyle = paint(color);
  ctx.font = `${size}px ${font === 'mono' ? '"IBM Plex Mono",monospace' : '"Golos Text",Arial,sans-serif'}`;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}
function nice(n) {
  const pow = 10 ** Math.floor(Math.log10(n)),
    a = n / pow;
  return (a < 1.5 ? 1 : a < 3.5 ? 2 : a < 7.5 ? 5 : 10) * pow;
}
function drawGrid() {
  const { unit, majorPixels: pixels, minorPixels: minor } = gridMetrics();
  const origin = screen({ x: 0, y: 0 });
  ctx.fillStyle = paint('#f8f8f8');
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = paint('#e8e8e8');
  ctx.lineWidth = 0.5;
  for (let x = ((origin.x % minor) + minor) % minor; x < width; x += minor) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = ((origin.y % minor) + minor) % minor; y < height; y += minor) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = paint('#dddddd');
  ctx.lineWidth = 0.6;
  for (let x = ((origin.x % pixels) + pixels) % pixels; x < width; x += pixels) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = ((origin.y % pixels) + pixels) % pixels; y < height; y += pixels) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  if (origin.x > -20 && origin.x < width + 20)
    line(origin.x, 0, origin.x, height, '#c9c9c9', 0.7, [3, 7]);
  if (origin.y > -20 && origin.y < height + 20)
    line(0, origin.y, width, origin.y, '#c9c9c9', 0.7, [3, 7]);
  if (width > 500 && cam.span < 200 && cam.span > 0.15) {
    for (let r = unit; r < cam.span * 1.1; r += unit) {
      let rp = (r * width) / cam.span;
      if (rp < 12) continue;
      circle(origin.x, origin.y, rp, '#d1d1d1', 0.5, [2, 5]);
      if (rp < Math.min(width, height) * 0.8)
        text(
          compact(r) + ' св. л.',
          origin.x + rp * 0.707 + 5,
          origin.y - rp * 0.707 - 5,
          7,
          '#9f9f9f',
        );
    }
  }
}
function galaxyProjection(g) {
  const center = screen(g);
  return { center, r: (g.diameterLy * 0.5 * width) / cam.span };
}
// Decorative morphology restored from the original chart. These strokes are
// schematic, separate from sourced outlines, catalogue positions and picking.
const GalaxyStructure = {
  cache: new WeakMap(),
  curves(g) {
    const curves=[],ring=(radius,wave=null)=>curves.push({closed:true,speed:14,at:t=>{
      const a=t*Math.PI*2,r=radius*(wave?1+.13*Math.sin(a*3+wave.ring)+.09*Math.cos(a*5):1);
      return[Math.cos(a)*r,Math.sin(a)*r];
    }}),line=(a,b)=>curves.push({speed:2,at:t=>a.map((v,i)=>v+(b[i]-v)*t)});
    if(g.shape==='spiral'){
      ring(.17);ring(.06);
      const count=g.id==='milkyway'?4:2;
      for(let arm=0;arm<count;arm++)curves.push({speed:6,at:t=>{
        const r=.1+t*.9,a=t*5+arm*Math.PI*2/count;
        return[Math.cos(a)*r,Math.sin(a)*r];
      }});
    }else if(g.shape==='elliptical'){
      for(const radius of [.1,.22,.4,.65,.84])ring(radius);
      if(g.id==='centaurus'){line([-.8,-.08],[.8,-.08]);line([-.8,.04],[.8,.04]);}
    }else if(g.shape==='irregular'){
      for(let i=0;i<3;i++)ring(.35+i*.2,{ring:i});
      line([-.45,0],[.35,0]);
    }
    return curves;
  },
  projected(o,{mode=MapSlice.mode,centerZ=MapSlice.centerZ,halfThickness=MapSlice.halfThicknessAt(),tolerance=cam.span/width*.2,viewport=null}={}) {
    const m=MapGeometry.model(o),g=o.galaxy;
    if(!m||!g||!['disk','footprint','sphere'].includes(m.kind))return[];
    // Unknown-depth size envelopes get a chart symbol at the catalogue plane.
    // Known disk/optical axes use the very same XYZ basis as their outline.
    const a=m.a||[1,0,0],b=m.b||[0,1,0],R=m.radius,S=m.minorRadius||R;
    const lo=mode==='slice'?centerZ-halfThickness-o.p3[2]:-Infinity,hi=mode==='slice'?centerZ+halfThickness-o.p3[2]:Infinity;
    if(m.kind==='sphere'&&(lo>0||hi<0))return[];
    const level=Math.floor(Math.log2(Math.max(1e-20,tolerance))),key=JSON.stringify([g.shape,g.id,R,S,a,b,lo,hi,level,viewport]);
    let cache=this.cache.get(o);if(!cache)this.cache.set(o,cache=new Map());
    if(cache.has(key))return cache.get(key);
    const paths=[];
    for(const curve of this.curves(g)){
      const at=t=>{const [x,y]=curve.at(t);return a.map((v,i)=>v*x*R+b[i]*y*S);};
      const bounds=(l,h)=>{const v=at((l+h)/2),r=Math.max(R,S)*curve.speed*(h-l)/2;return[v[0]-r,-v[1]-r,v[0]+r,-v[1]+r];};
      const times=MapGeometry.tessellate(t=>{const v=at(t);return{x:v[0],y:-v[1]};},0,1,32,2**level,viewport,bounds),vertices=times.map(at);
      if(mode!=='slice')paths.push({closed:!!curve.closed,points:vertices.map(v=>({x:v[0],y:-v[1]}))});
      else{
        let path=null;
        for(const pair of MapGeometry.clip3(vertices,lo,hi,false)){
          const points=pair.map(v=>({x:v[0],y:-v[1]})),tail=path?.points.at(-1);
          if(tail&&Math.hypot(tail.x-points[0].x,tail.y-points[0].y)<R*1e-10)path.points.push(points[1]);
          else{path={closed:false,points};paths.push(path);}
        }
      }
    }
    cache.set(key,paths);while(cache.size>2)cache.delete(cache.keys().next().value);
    return paths;
  },
  draw(o,center,scale,selected) {
    // Avoid unreadable internal marks when the whole galaxy is only a glyph.
    if(MapGeometry.model(o).radius*scale<12)return;
    const pad=2,viewport=[(-pad-center.x)/scale,(-pad-center.y)/scale,(width+pad-center.x)/scale,(height+pad-center.y)/scale];
    const paths=this.projected(o,{tolerance:.2/scale,viewport}).map(path=>({...path,points:path.points.map(p=>({x:center.x+p.x*scale,y:center.y+p.y*scale}))}));
    ctx.save();ctx.setLineDash([]);ctx.strokeStyle=paint(selected?'#969696':'#b6b6b6');ctx.lineWidth=.85;
    RegionMap.strokePaths(ctx,RegionMap.clipPaths(paths,2,false).runs);ctx.restore();
  },
};
function drawGalaxyBackground() {
  for (const g of GALAXIES) {
    const body=object(g.id);if(!body||!MapDetails.visible(body,cam.span)||!ExtendedCatalog.matchesMap(body,true)||!MapGeometry.intersectsView(body,0,2))continue;
    const geometry=MapGeometry.view(body),center=screen(body),scale=width/cam.span*Cosmology.regionScale(body);
    if(!geometry.points.length)continue;
    const points=geometry.points.map(p=>({x:center.x+p.x*scale,y:center.y+p.y*scale}));
    const box=MapLandmarks.box(points);if(box.w<2&&box.h<2||box.x+box.w<0||box.x>width||box.y+box.h<0||box.y>height)continue;
    const selected=g.id===state.selected||(g.id==='milkyway'&&state.selected==='sgr'),opacity=MapDetails.opacity(body,cam.span);
    ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=paint(selected?'#555555':'#777777');ctx.lineWidth=1.1;ctx.setLineDash([3,5]);ctx.beginPath();
    const paths=geometry.paths.map(path=>({...path,points:path.points.map(p=>({x:center.x+p.x*scale,y:center.y+p.y*scale}))}));
    RegionMap.strokePaths(ctx,RegionMap.clipPaths(paths,2).runs);
    GalaxyStructure.draw(body,center,scale,selected);ctx.restore();
    MapLabels.contours.push({id:g.id,object:body,points,paths,closed:true,container:true});
    if(Math.max(box.w,box.h)>36&&Math.max(box.w,box.h)<Math.max(width,height)*6){
      const anchor=geometry.points.reduce((a,p)=>p.y>a.y?p:a,geometry.points[0]);
      MapLabels.add({key:'galaxy-'+g.id,object:body,name:g.name.toUpperCase(),detail:geometry.model.kind==='disk'?'МОДЕЛЬ ДИСКА':'ОБЛАСТЬ КАТАЛОЖНОГО РАЗМЕРА',mass:MapDetails.mass(body),level:2,priority:selected?100:55,size:9,opacity,color:selected?'#454545':'#747474',candidates:[{x:center.x+anchor.x*scale,y:center.y+anchor.y*scale+22,align:'center'}]});
    }
  }
}
function shipReachability() {
  if (state.expansion === false) return null;
  const active = !!state.flight,
    q = active ? MissionReach.active() : MissionReach.idle();
  return {
    ...q,
    radius: q.comoving * Cosmology.scale(),
    mode: active ? 'ОСТАВШИЙСЯ ПОЛЁТ С ТОРМОЖЕНИЕМ' : 'С РАЗГОНОМ И ТОРМОЖЕНИЕМ',
    active,
  };
}
const ReachDisplay = {
  memo: null,
  interval: 1000,
  ship() {
    const f = state.flight;
    if (!f?.mission || (f.missionStage || 0) !== 2 || state.expansion === false) {
      this.memo = null;
      return shipReachability();
    }
    const now = performance.now(), memo = this.memo;
    if (memo && memo.flight === f && memo.mission === f.mission && now - memo.at < this.interval)
      return memo.value;
    const value = shipReachability();
    this.memo = { flight: f, mission: f.mission, at: now, value };
    return value;
  },
};
function lightReachability() {
  if (state.expansion === false) return null;
  const comoving = Cosmology.horizon();
  return { comoving, radius: comoving * Cosmology.scale() };
}
function renderReachability() {
  const c = state.flight?.mission?.setup || FlightSetup.read(),
    out = $('reachReadout');
  out.hidden = !(width < 700 && cam.span >= 1e9 && state.expansion !== false);
  if (!out.hidden) {
    const ship = ReachDisplay.ship(),
      light = lightReachability();
    UIContent.text(out, 'Полёт · ' +
      (ship.radius > 0 ? distanceText(ship.radius) : '0 св. лет') +
      '\nСвет · ' +
      distanceText(light.radius));
  }
  out.title =
    state.expansion !== false
      ? 'Текущие настройки и запас топлива на финише ' +
        Math.round(c.arrivalFuelPercent || 0) +
        '%. Разгон и полная остановка у протяжённой цели; для орбиты расчёт индивидуален. Проекция трёхмерной сферы: положение цели внутри круга не гарантирует достижимость; учитывается и глубина.'
      : '';
}

function circleLabel(key, name, detail, p, r, priority = 25) {
  const anchor = { x: p.x, y: p.y - r + (key === 'ship-reach' ? 18 : -10), align: 'center' };
  if (r >= 5) MapLabels.add({ key, name, detail, priority, size: 9, candidates: [anchor] });
}
function drawReachability() {
  // Cosmological envelopes are a large-scale overlay. Do not run a range solve
  // on every braking frame while the player is looking at nearby stars.
  if (cam.span < 1e6) return;
  const light = lightReachability(),
    p = screen(state.ship);
  if (light && cam.span >= 1e9) {
    const r = (light.radius * width) / cam.span;
    if (r > 0 && r < 20000) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      circle(p.x, p.y, r, '#888888', 1, [3, 7]);
      ctx.restore();
      circleLabel(
        'light-reach',
        'ПРЕДЕЛ СВЕТА · ' + distanceText(light.radius),
        'СВЕТ, ИСПУЩЕННЫЙ СЕЙЧАС · ПРОЕКЦИЯ СФЕРЫ В 3D',
        p,
        r,
        35,
      );
    }
  }
  const q = ReachDisplay.ship();
  if (!q || !(q.radius > 0)) return;
  const r = (q.radius * width) / cam.span;
  if (r > 20000) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  circle(p.x, p.y, r, '#454545', 1.2, [10, 5, 2, 5]);
  ctx.restore();
  const name = 'ПРЕДЕЛ ПОЛЁТА · ' + distanceText(q.radius),
    detail =
      'ТОПЛИВНЫЙ БАК НА ФИНИШЕ ≥ ' +
      Math.round(q.setup.arrivalFuelPercent || 0) +
      '% · ПРОЕКЦИЯ СФЕРЫ В 3D';
  if (r >= 5 || cam.span >= 1e9) circleLabel('ship-reach', name, detail, p, r, 40);
}
function drawHorizonBoundary() {
  if (globalThis.UniverseMap) {
    UniverseMap.draw();
    return;
  }
  if (cam.span > 4e10) {
    const p = screen({ x: 0, y: 0 }),
      r = (465e8 * Cosmology.scale() * width) / cam.span;
    circle(p.x, p.y, r, '#a7a7a7', 0.8, [7, 5]);
    circleLabel(
      'observable-boundary',
      'НАБЛЮДАЕМАЯ ВСЕЛЕННАЯ',
      'ГРАНИЦА В ИСХОДНУЮ ЭПОХУ · НЕ ДАЛЬНОСТЬ ПОЛЁТА',
      p,
      r,
      15,
    );
  }
}
function drawSymbol(o, p, selected = false) {
  const destroyed = state.destroyed.includes(o.id) && o.kind === 'star';
  const ink = selected || o.notableLandmark ? '#171717' : '#424242';
  if (!selected) {
    if (globalThis.MapVisibility?.active && MapDetails.level(o) >= 3) {
      circle(p.x, p.y, globalThis.MapFilters?.promotes(o) ? 3.5 : 1.2, ink, 0.7);
      return;
    }
    if (
      !destroyed &&
      !o.nuclearStar &&
      o.kind !== 'home' &&
      o.kind !== 'star' &&
      o.kind !== 'galaxy' &&
      o.kind !== 'pulsar' &&
      o.kind !== 'quasar' &&
      o.kind !== 'blackhole' &&
      MapSymbols.handles(o)
    ) {
      MapSymbols.draw(o, p, ink);
      return;
    }
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = paint(ink);
  ctx.lineWidth = 1.25;
  if (globalThis.MapVisibility?.active && MapDetails.level(o) >= 3) {
    circle(0, 0, globalThis.MapFilters?.promotes(o) ? 3.5 : 1.2, ink, 0.7);
  } else if (destroyed) {
    circle(0, 0, 9, ink, 0.7, [2, 3]);
    line(-5, -5, 5, 5, ink, 0.8);
    line(-5, 5, 5, -5, ink, 0.8);
  } else if (o.kind === 'home') {
    circle(0, 0, 14, ink, 0.8);
    circle(0, 0, 8, ink, 1);
    ctx.fillStyle = paint(ink);
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 22, Math.sin(a) * 22, ink, 0.7);
    }
  } else if (o.nuclearStar) {
    circle(0, 0, 2.8, ink, 1.2);
    ctx.fillStyle = paint(ink);
    ctx.fillRect(-0.8, -0.8, 1.6, 1.6);
  } else if (o.kind === 'star') {
    const r = o.id === 'sirius' ? 6 : 4;
    circle(0, 0, r, ink, 0.8);
    ctx.fillStyle = paint(ink);
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    line(-r - 5, 0, -r - 2, 0, ink, 0.7);
    line(r + 2, 0, r + 5, 0, ink, 0.7);
    line(0, -r - 5, 0, -r - 2, ink, 0.7);
    line(0, r + 2, 0, r + 5, ink, 0.7);
  } else if (o.kind === 'galaxy') {
    const r = o.galaxy ? galaxyProjection(o.galaxy).r : 1.5;
    if (r >= 5) {
      line(-2, 0, 2, 0, ink, 0.8);
      line(0, -2, 0, 2, ink, 0.8);
    } else {
      circle(0, 0, Math.max(globalThis.MapFilters?.promotes(o) ? 3.5 : 0.8, r), ink, 0.9);
    }
  } else if (o.kind === 'pulsar' || o.kind === 'quasar') {
    circle(0, 0, 5, ink);
    circle(0, 0, 10, ink, 0.5);
    line(-5, 18, 5, -18, ink, 0.9);
    line(-8, 18, 0, 18, ink, 0.7);
    line(0, -18, 8, -18, ink, 0.7);
  } else if (o.kind === 'blackhole') {
    circle(0, 0, 8, ink, 0.8);
    ctx.fillStyle = paint(ink);
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 4, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (MapSymbols.handles(o)) MapSymbols.draw(o, { x: 0, y: 0 }, ink);
  else if (o.kind === 'void' || o.kind === 'ring' || o.kind === 'horizon') {
    const r = o.kind === 'void' ? 23 : o.kind === 'ring' ? 21 : 13;
    circle(0, 0, r, ink, 0.8, o.kind === 'void' ? [2, 4] : []);
    if (o.kind === 'ring') {
      circle(0, 0, r + 4, ink, 0.4, [1, 5]);
      for (let i = 0; i < 12; i++) {
        const a = i * 0.54;
        ctx.fillStyle = paint(ink);
        ctx.fillRect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2, 2);
      }
    } else {
      line(-r - 5, 0, r + 5, 0, ink, 0.5, [2, 4]);
      line(0, -r - 5, 0, r + 5, ink, 0.5, [2, 4]);
    }
  } else if (o.kind === 'wall' || o.kind === 'arc') {
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const x = (i - 5.5) * 5,
        y = Math.sin(i * 0.5) * 9;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      ctx.fillStyle = paint(ink);
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
    }
    ctx.stroke();
  } else {
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        r = 4 + Math.sqrt(i) * 3;
      circle(Math.cos(a) * r, Math.sin(a) * r, 1.4, ink, 0.7);
    }
    circle(0, 0, 18, ink, 0.4, [2, 4]);
  }
  if (selected) {
    for (let a = 0; a < 4; a++) {
      ctx.save();
      ctx.rotate((a * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(21, -16);
      ctx.lineTo(21, -21);
      ctx.lineTo(16, -21);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}
function routeLabelDistance(o) {
  const start = state.flight?.from || state.ship;
  return o.p3 ? distanceText(Cosmology.physicalDistance(start, o)) : 'расстояние неизвестно';
}
function drawObjects() {
  hitObjects = [];
  const departure = state.flight?.fromId || state.current,
    occupied = new Map();
  const glyphRadius = o => o.kind === 'home' ? 23 : ['pulsar','quasar'].includes(o.kind) ? 20 : o.kind === 'blackhole' ? 18 : o.kind === 'star' ? 10 : 8;
  const nearby = (p, radius = 12) => {
    const x = Math.floor(p.x / 48),
      y = Math.floor(p.y / 48);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const cell = occupied.get((x + dx) * 65536 + y + dy);
        if (cell)
          for (const q of cell)
            if (Math.hypot(p.x - q.x, p.y - q.y) < radius + q.radius) return true;
      }
    return false;
  };
  const reserve = (p, radius = 12) => {
    const key = Math.floor(p.x / 48) * 65536 + Math.floor(p.y / 48),
      cell = occupied.get(key);
    if (cell) cell.push({ x: p.x, y: p.y, radius });
    else occupied.set(key, [{ x: p.x, y: p.y, radius }]);
  };
  const inView = (p) => p.x > -40 && p.x < width + 40 && p.y > -40 && p.y < height + 40;
  const wide = cam.span > 1e6;
  const priority = (o) =>
    o.id === 'sgr' && cam.span < 2
      ? 90
      : ExtendedCatalog.background(o)
        ? 10
        : o.id === state.selected
          ? 100
          : o.id === departure
            ? 85
            : o.cosmicLandmark
              ? 70
              : o.galaxy
                ? 50
                : o.id === 'sol'
                  ? 40
                  : 20;
  const queueLabel = (o, p, opacity) => {
    if (
      (StellarClusters.is(o)
        ? StellarClusters.view(o).area < 0.5
        : o.kind === 'nebula'
          ? Nebulae.view(o).area < 0.5
          : true) &&
      (!o.galaxy || galaxyProjection(o.galaxy).r <= 18)
    )
      MapLabels.point({
        key: 'object-' + o.id,
        object: o,
        name: o.id === 'sol' ? 'СОЛНЦЕ' : o.name,
        detail: () =>
          (o.id === (state.flight?.target || state.selected) ? 'ЦЕЛЬ · ' : '') +
          routeLabelDistance(o),
        p,
        mass: MapDetails.mass(o),
        level: MapDetails.level(o),
        priority: priority(o),
        selected: o.id === state.selected,
        opacity,
      });
  };
  // Classify each point once. Contours cannot become glyphs, and sorting
  // compares precomputed ranks rather than repeatedly parsing catalogue fields.
  const pointView = (o) => {
    // Complete filament contours already have their own pass. Reject them
    // before point metadata/mass/opacity work, retaining legacy sparse points.
    if (o.region?.shape === 'polyline' && !MapDetails.sparse(o, cam.span) && !RegionMap.asPoint(o))
      return null;
    const sparse = MapDetails.sparse(o, cam.span), bg = ExtendedCatalog.background(o);
    // Background points have their own pass. Do not prepare their foreground
    // geometry, except when the station/selection or legacy sparse mode needs it.
    if (bg && !sparse && o.id !== state.selected && o.id !== state.current) return null;
    if (!wide && o.p3 && !inView(screenOf(o))) return null;
    if (!(sparse || MapDetails.visible(o, cam.span)) || (!sparse && !RegionMap.asPoint(o)))
      return null;
    if (wide && o.p3 && !inView(screenOf(o))) return null;
    return { o, sparse, bg };
  };
  const candidates = new Map(),
    views = new Map();
  for (const source of [OBJECTS, ExtendedCatalog.pinned.values(), globalThis.MapFilters?.objects.values() || []])
    for (const o of source) candidates.set(o.id, o);
  for (const source of [ExtendedCatalog.visible, MapLayers.visible])
    for (const o of source) {
      const q = pointView(o);
      if (q && (!q.bg || q.sparse)) {
        candidates.set(o.id, o);
        views.set(o.id, q);
      }
    }
  const visible = [];
  for (const [id, candidate] of candidates) {
    if (candidate.cosmicEpoch) continue;
    const q = views.get(id) || pointView(candidate);
    if (!q) continue;
    const { o, sparse, bg } = q;
    if (
      (bg && !sparse && o.id !== state.selected && o.id !== state.current) ||
      (o.kind === 'horizon' && cam.span <= 3e10) ||
      !ExtendedCatalog.matchesMap(o) ||
      ExtendedCatalog.opacity(o, !sparse) <= 0.015
    )
      continue;
    const p = screenOf(o);
    if (!inView(p)) continue;
    visible.push({
      ...q,
      p,
      level: MapDetails.level(o),
      mass: MapDetails.mass(o),
      rank: priority(o),
    });
  }
  visible.sort(
    (a, b) =>
      (globalThis.MapFilters?.narrow || globalThis.MapFilters?.promoted.size ? Number(MapDetails.origin(b.o)) - Number(MapDetails.origin(a.o)) : 0) ||
      (globalThis.MapFilters?.narrow ? Number(MapFilters.anchor(b.o)) - Number(MapFilters.anchor(a.o)) : 0) ||
      Number(!!b.o.notableLandmark) - Number(!!a.o.notableLandmark) ||
      (b.o.landmarkPriority||0) - (a.o.landmarkPriority||0) ||
      b.level - a.level ||
      (a.mass !== null && b.mass !== null
        ? b.mass - a.mass
        : a.mass !== null
          ? -1
          : b.mass !== null
            ? 1
            : 0) ||
      b.rank - a.rank ||
      (a.o.apparentV ?? 20) - (b.o.apparentV ?? 20) ||
      a.o.id.localeCompare(b.o.id),
  );
  // Keep the host's resolved contour, but let its nucleus own the coincident
  // point and click target. No anonymous galaxy dot covers the black-hole ring.
  const nuclearHosts=new Set(visible.filter(q=>q.o.kind==='blackhole').map(q=>MapDetails.blackHoleHost(q.o)?.id).filter(Boolean));
  if(globalThis.BlackHoleCatalog)BlackHoleCatalog.renderedHosts=nuclearHosts;
  for (const { o, p, sparse, bg, mass, level, rank } of visible) {
    // Complete small classes also survive inside a large photographic selection.
    // Their glyphs share one collision grid, independent of whether text fits.
    if (globalThis.MapFilters?.promotes(o) || globalThis.MapFilters?.narrow && MapFilters.anchor(o)) {
      if (nearby(p, glyphRadius(o))) continue;
    }
    if(nuclearHosts.has(o.id)){
      // One shared centre glyph represents both identities. Retain the host's
      // spatial hit record through zoom; the preceding nucleus wins a tie.
      hitObjects.push({o,p,r:7,background:bg,coincidentNucleus:true});
      queueLabel(o,p,ExtendedCatalog.opacity(o));continue;
    }
    if (sparse) {
      if (nearby(p)) continue;
      const selected = o.id === state.selected,
        opacity = (0.7 + 0.3 * MapDetails.opacity(o, cam.span)) * ExtendedCatalog.opacity(o, false);
      MapLabels.point({
        key: 'object-' + o.id,
        object: o,
        name: o.id === 'sol' ? 'СОЛНЦЕ' : o.name,
        detail: () =>
          (o.id === (state.flight?.target || state.selected) ? 'ЦЕЛЬ · ' : '') +
          routeLabelDistance(o),
        p,
        mass,
        level,
        priority: rank,
        selected,
        opacity,
        sparse: true,
        onPlace: () => {
          ctx.save();
          ctx.globalAlpha = opacity;
          if (bg && !MapSymbols.handles(o)) {
            ctx.fillStyle = paint(o.kind === 'star' ? '#858585' : '#555555');
            ctx.beginPath();
            ctx.arc(p.x, p.y, o.kind === 'star' ? 1.6 : 1.85, 0, Math.PI * 2);
            ctx.fill();
            if (selected) circle(p.x, p.y, 7, '#646464', 0.8, [2, 3]);
          } else drawSymbol(o, p, selected);
          ctx.restore();
          const hit = {
            o,
            p,
            r: bg ? 5 : MapSymbols.handles(o) ? 7 : 23,
            background: bg,
            sparse: true,
          };
          hitObjects.push(hit);
          MapLandmarks.reserve(hit);
        },
      });
      continue;
    }
    if (!globalThis.MapVisibility?.active && !bg && nearby(p)) {
      if ((!MapLayers.active || !MapLayers.manages(o)) && MapDetails.mapLabelName(o) === null)
        continue;
      reserve(p);
      ctx.save();
      ctx.globalAlpha = ExtendedCatalog.opacity(o) * RegionMap.pointOpacity(o);
      if (MapSymbols.handles(o)) drawSymbol(o, p, o.id === state.selected);
      else circle(p.x, p.y, 2.2, '#777777', 0.8);
      ctx.restore();
      hitObjects.push({ o, p, r: 5, background: false });
      queueLabel(o, p, ExtendedCatalog.opacity(o) * RegionMap.pointOpacity(o));
      continue;
    }
    if (!bg) reserve(p, globalThis.MapFilters?.narrow || globalThis.MapFilters?.promotes(o) ? glyphRadius(o) : 12);
    const selected = o.id === state.selected,
      opacity = ExtendedCatalog.opacity(o) * RegionMap.pointOpacity(o);
    ctx.save();
    ctx.globalAlpha = opacity;
    if (bg && !MapSymbols.handles(o)) {
      circle(p.x, p.y, 3, '#969696', 1);
      if (selected) circle(p.x, p.y, 7, '#646464', 0.8, [2, 3]);
    } else drawSymbol(o, p, selected);
    ctx.restore();
    hitObjects.push({ o, p, r: MapSymbols.handles(o) ? 7 : bg ? 7 : 23, background: bg });
    // Large galaxy contours already queued their own label.
    queueLabel(o, p, opacity);
  }
}
// Clip around a nearby point before handing coordinates to Canvas. Extremely distant
// endpoints otherwise exceed the renderer's precision at stellar zoom while following.
function routeScreenSegment(from, to, start = 0, end = 1) {
  const f = state.flight && from === state.flight.from ? state.flight : null,
    a = f ? FlightView.at(f, 0) : from === state.ship ? FlightView.ship() : MapLayout.project(from),
    b = f ? FlightView.at(f, 1) : MapLayout.project(to),
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const t = f ? f.covered / f.distance : 0,
    p = f ? screen(state.ship) : screen(from),
    ux = dx / length,
    uy = dy / length,
    scale = width / cam.span;
  let lo = (start - t) * length * scale,
    hi = (end - t) * length * scale;
  for (const [origin, direction, min, max] of [
    [p.x, ux, -2, width + 2],
    [p.y, uy, -2, height + 2],
  ]) {
    if (Math.abs(direction) < 1e-15) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const v = (min - origin) / direction,
      w = (max - origin) / direction;
    lo = Math.max(lo, Math.min(v, w));
    hi = Math.min(hi, Math.max(v, w));
    if (lo > hi) return null;
  }
  return { a: { x: p.x + ux * lo, y: p.y + uy * lo }, b: { x: p.x + ux * hi, y: p.y + uy * hi } };
}
function drawPhysicalSegment(from, to, color = '#767676', lw = 0.8, dash = [5, 6]) {
  const segment = routeScreenSegment(from, to);
  if (segment) line(segment.a.x, segment.a.y, segment.b.x, segment.b.y, color, lw, dash);
}
function drawSegmentDistance(from, target, d) {
  const middle = routeScreenSegment(from, target, 0.5, 0.5),
    segment = middle && routeScreenSegment(from, target);
  if (!segment) return;
  if (!Number.isFinite(d)) return;
  let angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  ctx.save();
  ctx.translate(middle.a.x, middle.a.y);
  ctx.rotate(angle);
  ctx.font = '11px "Golos Text",Arial,sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  const caption = distanceText(d),
    bounds = ctx.measureText(caption),
    left = bounds.actualBoundingBoxLeft ?? bounds.width / 2,
    right = bounds.actualBoundingBoxRight ?? bounds.width / 2,
    ascent = bounds.actualBoundingBoxAscent ?? 11,
    descent = bounds.actualBoundingBoxDescent ?? 0;
  ctx.fillStyle = paint('#f8f8f8');
  ctx.fillRect(-left - 1, -6 - ascent - 1, left + right + 2, ascent + descent + 2);
  text(caption, 0, -6, 11, '#555555', 'center', 'sans');
  ctx.restore();
}
function drawRouteDistance() {
  const legs=Route.legs();
  if(legs.length){for(const leg of legs)drawSegmentDistance(leg.from,leg.to,leg.distance);return;}
  const target=object(state.selected);
  if(!target?.navigable||target.id===state.current)return;
  drawSegmentDistance(state.ship,target,Cosmology.physicalDistance(state.ship,target));
}
function drawRoute() {
  FlightHistory.draw();
  const f = state.flight;
  if (!f && state.itinerary.length) return;
  const target = object(f ? f.target : state.selected);
  if (!target || target.id === state.current || !target.navigable) return;
  const from = f ? f.from : state.ship;
  if (f) {
    const t = Math.max(0, Math.min(1, f.covered / f.distance));
    for (const [start, end, dash] of [
      [0, t, []],
      [t, 1, [5, 6]],
    ]) {
      const segment = routeScreenSegment(f.from, target, start, end);
      if (segment) line(segment.a.x, segment.a.y, segment.b.x, segment.b.y, '#767676', 1, dash);
    }
  } else drawPhysicalSegment(from, target);
  FlightMarks.draw(f);
}
function sailGeometry(radius, braking = false) {
  const side = braking ? -1 : 1;
  return { side, radius, rim: 30 * side, belly: 54 * side, tether: side * 4 };
}
function drawShip(time) {
  const p = screen(state.ship),
    f = state.flight,
    target = f ? object(f.target) : Route.endpoint(state.itinerary[0]) || object(state.selected),
    ahead = f ? screen(FlightView.at(f, f.covered / f.distance + 1)) : screen(target),
    angle =
      Number.isFinite(ahead.x) && Number.isFinite(ahead.y)
        ? Math.atan2(ahead.y - p.y, ahead.x - p.x)
        : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle + (state.phase === 'dock' ? Math.PI : 0));
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = paint('#252525');
  const braking =
      state.phase === 'brake' &&
      (!f?.mission || (f.mission.setup.brakeSail && f.mission.setup.densityCm3 > 0)),
    composedOpening = f?.mission ? MissionPlanner.sailOpening(f) : 1,
    sailOpen = !!f && (state.phase === 'launch' || braking) && composedOpening > 0;
  if (sailOpen) {
    const g = sailGeometry(21, braking);
    let opening = 1;
    if (state.phase === 'launch')
      opening = Math.max(
        0.035,
        Math.sqrt(
          f.mission
            ? composedOpening
            : Stellar.sampleProper(f.wind, f.wind.elapsedProper || 0).opening,
        ),
      );
    const r = g.radius * opening;
    ctx.beginPath();
    ctx.moveTo(g.rim, -r);
    ctx.quadraticCurveTo(g.belly, 0, g.rim, r);
    ctx.stroke();
    line(g.tether, 0, g.rim, -r, '#555', 0.75);
    line(g.tether, 0, g.rim, r, '#555', 0.75);
    line(g.tether, 0, (g.rim + g.belly) / 2, 0, '#777', 0.6);
    for (let i = 1; i < 4; i++) {
      const y = r * (i / 4);
      const x = g.rim + (g.belly - g.rim) * 0.45 * (1 - (y / r) ** 2);
      line(g.tether, 0, x, y, '#aaa', 0.4);
      line(g.tether, 0, x, -y, '#aaa', 0.4);
    }
  }
  ctx.beginPath();
  ctx.fillStyle = paint('#252525');
  ctx.moveTo(11, 0);
  ctx.lineTo(-3, -4);
  ctx.lineTo(0, 0);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();
  if (state.phase === 'thrust' || state.phase === 'dock') {
    const len = 13 + Math.sin(time * 0.025) * 3;
    line(-5, -2, -len, 0, '#555', 0.8);
    line(-5, 2, -len, 0, '#555', 0.8);
    line(-8, 0, -len - 6, 0, '#999', 0.6);
  }
  if (
    state.phase === 'brake' &&
    f?.mission?.setup.brakeEngine &&
    (f.mission.brake.kind === 'engine' || f.missionSample?.burnRate > 0)
  ) {
    const len = 15 + Math.sin(time * 0.025) * 3;
    line(13, -2, len + 8, 0, '#555', 0.8);
    line(13, 2, len + 8, 0, '#555', 0.8);
  }
  if (braking) {
    for (let i = 0; i < 15; i++) {
      const t = (time / 1000 + i / 15) % 1,
        x = 65 - t * 105,
        y = ((i % 5) - 2) * 10;
      ctx.fillStyle = paint('#888');
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.beginPath();
    ctx.ellipse(-24, 0, 28, 35, 0, 1.5, 4.8);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = paint('#aaa');
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  if (cam.span < 60000 && (!f || Math.hypot(p.x - screen(target).x, p.y - screen(target).y) > 65))
    MapLabels.point({ key: 'ship', name: SHIP_NAME.toUpperCase(), p, priority: 35 });
}
function drawEffects(dt) {
  effects = effects.filter((e) => e.age < 8);
  for (const e of effects) {
    e.age += paused ? 0 : dt * speed;
    const p = screen(e);
    for (let k = 0; k < 3; k++) {
      const r = (e.age * 48 + k * 24) % 370;
      circle(
        p.x,
        p.y,
        r,
        `rgba(37,38,32,${Math.max(0, 0.38 - r / 980)})`,
        0.7,
        k === 1 ? [2, 6] : [],
      );
    }
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399,
        r = e.age * 25 + (i % 5) * 9;
      ctx.fillStyle = paint('#8b8b8b');
      ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1, 1);
    }
  }
}
function drawHover() {
  if (hover?.cosmicEpoch || hover?.traffic) return;
  if (!hover || !ExtendedCatalog.matchesMap(hover)) return;
  if (hover.kind === 'blackhole' && !MapDetails.visible(hover, cam.span)) return;
  const p = screen(hover);
  if (MapSymbols.handles(hover) && RegionMap.asPoint(hover)) {
    circle(p.x, p.y, 7, '#969696', 0.6, [2, 4]);
    return;
  }
  if (hover.region || ['structure', 'wall', 'void', 'ring', 'arc', 'horizon'].includes(hover.kind))
    return;
  circle(p.x, p.y, 27, '#969696', 0.6, [2, 4]);
}
