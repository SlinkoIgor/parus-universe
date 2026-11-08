'use strict';
// Earth-facing J2000 finding charts. Independent of expedition time, map
// projection, navigation coordinates and photographic plate/image selection.
const SkyGuide = {
  rad: Math.PI / 180,
  escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  hasDirection(o) {
    return !!o && !o.synthetic && Number.isFinite(o.raDeg) && o.raDeg >= 0 && o.raDeg < 360 &&
      Number.isFinite(o.decDeg) && Math.abs(o.decDeg) <= 90;
  },
  eligible(o) { return this.hasDirection(o) && o.kind === 'star'; },
  catalogueKey(s) { return String(s).toLowerCase().replace(/messier/g,'m').replace(/\b(ngc|ic|m)\s*0*(\d+)/g,'$1$2').replace(/[^a-z0-9*+.-]/g,''); },
  identityKeys(o) {
    return SkyPhotos.ownNames(o).map(s=>this.catalogueKey(s));
  },
  visualCollection(o) {
    if (!['nebula','cluster','galaxy'].includes(o.kind)) return null;
    for (const id of this.identityKeys(o)) {
      if (/^m([1-9]\d?|10\d|110)$/.test(id)) return 'Мессье';
      if (SKY_GUIDE_DATA.visualTargets?.some(q=>this.catalogueKey(q[0])===id)) return 'Колдуэлла';
    }
    return null;
  },
  observingEvidence(o) {
    const identifiers=this.identityKeys(o);
    return SKY_GUIDE_DATA.observingEvidence?.find(q=>q.kind===o.kind&&q.identifiers.some(id=>identifiers.includes(this.catalogueKey(id))))||null;
  },
  observing(o) {
    if (!this.hasDirection(o)) return null;
    // Finding charts are for naked-eye targets and the Sun's stellar neighbours.
    // The 25 ly radius matches the existing nearby-stars collection.
    // Never borrow a host galaxy's brightness for its black hole/pulsar.
    if (!['star','nebula','cluster','galaxy','quasar'].includes(o.kind)) return null;
    const v=this.magnitude(o), stellar=o.kind==='star'||o.kind==='quasar',
      major=o.angularMajorArcmin, minor=o.angularMinorArcmin,
      surface=v!==null&&major>0&&minor>0 ? v+2.5*Math.log10(Math.PI*major*minor*900) : null;
    const collection=this.visualCollection(o),evidence=this.observingEvidence(o),
      nakedEye=!!evidence?.nakedEye || v!==null && v<=6.5 && (stellar || surface===null || surface<=23),
      nearby=o.kind==='star' && Number.isFinite(o.d) && o.d>=0 && o.d<=25;
    if (!nakedEye && !nearby) return null;
    return {v, surface, collection, evidence, nakedEye, nearby,
      text:evidence?.nakedEye?'Видно глазом на тёмном небе':stellar ? this.visibility(o).text : 'Видно глазом на тёмном небе'};
  },
  canChart(o) { return !!this.observing(o); },
  constellation(ra, dec) {
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90) return null;
    // IAU 1976 precession, J2000 -> B1875 (the epoch of Roman's boundaries).
    // This small independent transform is verified against Astropy; a star's
    // historical Bayer/Flamsteed designation is not a boundary assignment.
    const r = this.rad, t = (2415020.31352 - 25 * 365.242198781 - 2451545) / 36525,
      zeta = (2306.2181*t + .30188*t*t + .017998*t*t*t) / 3600*r,
      z = (2306.2181*t + 1.09468*t*t + .018203*t*t*t) / 3600*r,
      theta = (2004.3109*t - .42665*t*t - .041833*t*t*t) / 3600*r,
      a = ra*r + zeta, b = dec*r,
      A = Math.cos(b)*Math.sin(a),
      B = Math.cos(theta)*Math.cos(b)*Math.cos(a) - Math.sin(theta)*Math.sin(b),
      C = Math.sin(theta)*Math.cos(b)*Math.cos(a) + Math.cos(theta)*Math.sin(b),
      hour = ((Math.atan2(A,B)+z)/r % 360 + 360) % 360 / 15,
      latitude = Math.asin(Math.max(-1,Math.min(1,C)))/r;
    return SKY_GUIDE_DATA.boundaries.find(q => hour >= q[0] && hour < q[1] && latitude >= q[2])?.[3] || null;
  },
  separation(a, b) {
    const r = this.rad, x = a[1]*r, y = b[1]*r, d = (a[0]-b[0])*r;
    return 2*Math.asin(Math.min(1,Math.sqrt(Math.sin((x-y)/2)**2 + Math.cos(x)*Math.cos(y)*Math.sin(d/2)**2)))/r;
  },
  latitudeLimits(decMin, decMax = decMin) {
    if (![decMin,decMax].every(Number.isFinite) || decMin < -90 || decMax > 90 || decMin > decMax) return null;
    // At upper culmination h = 90° - |latitude - declination|. "Whole"
    // means every part can rise, each at its own sidereal time, not all at once.
    return {whole:[Math.max(-90,decMax-90),Math.min(90,decMin+90)],
      partial:[Math.max(-90,decMin-90),Math.min(90,decMax+90)]};
  },
  latitudeText(range) {
    if (!range) return 'Диапазон пока неизвестен';
    const [south,north]=range, latitude=n=>n===0?'экватора':'≈ '+Math.abs(n).toLocaleString('ru-RU',{maximumFractionDigits:0})+'° '+(n>0?'с. ш.':'ю. ш.');
    if (south===-90 && north===90) return 'С любых широт';
    if (south===-90) return 'Южнее '+latitude(north);
    if (north===90) return 'Севернее '+latitude(south);
    return 'От '+latitude(south)+' до '+latitude(north);
  },
  magnitude(o) {
    if (Number.isFinite(o.apparentV)) return o.apparentV;
    if (o.kind!=='star' || o.unresolvedSourcePhotometry) return null;
    const hip = Number(o.hip);
    return hip ? SKY_GUIDE_DATA.stars.find(s => s[0] === hip)?.[3] ?? null : null;
  },
  visibility(o) {
    const v = this.magnitude(o);
    return {v, text:v === null ? 'Яркость пока неизвестна' : v <= 3 ? 'Хорошо видна глазом' : v <= 6 ? 'Видна глазом на тёмном небе' : v <= 6.5 ? 'На пределе видимости глазом' : 'Для наблюдения нужна оптика'};
  },
  near(o) {
    return SKY_GUIDE_DATA.stars.filter(s => s[3] <= 2.5 && s[4]).map(s => ({star:s,angle:this.separation([o.raDeg,o.decDeg],[s[1],s[2]])}))
      .filter(s => s.angle > 1 && s.angle < 45).sort((a,b) => a.angle-b.angle).slice(0,2);
  },
  chart(o, close = false) {
    if (!this.canChart(o)) return '';
    const con = this.constellation(o.raDeg,o.decDeg), c = SKY_GUIDE_DATA.constellations[con];
    if (!c) return '';
    const esc = this.escape, r = this.rad,
      compact = window.matchMedia ? window.matchMedia('(max-width: 700px)').matches : typeof width === 'number' && width < 700,
      v = this.magnitude(o), limit = SKY_GUIDE_DATA.magnitudeLimit,
      faint = o.kind === 'star' && v !== null && v > limit,
      plotBottom = faint ? 290 : 350,
      center = [o.raDeg,o.decDeg],
      a = center[0]*r, d = center[1]*r,
      project = (ra,dec) => {
        const x = ra*r-a, y = dec*r, cos = Math.sin(d)*Math.sin(y)+Math.cos(d)*Math.cos(y)*Math.cos(x), den = 1+cos;
        return den < .12 ? null : [-2*Math.cos(y)*Math.sin(x)/den, -2*(Math.cos(d)*Math.sin(y)-Math.sin(d)*Math.cos(y)*Math.cos(x))/den];
      },
      target = project(o.raDeg,o.decDeg),
      scale = close ? Math.min(510/.21,270/.134)/1.2 : 510/(4*Math.tan(150*r/4)),
      cx = 0, cy = 0,
      screen = p => [300+(p[0]-cx)*scale,(faint?170:200)+(p[1]-cy)*scale],
      inside = (p,pad=0) => p && p[0]>28+pad && p[0]<572-pad && p[1]>45+pad && p[1]<plotBottom-pad,
      pos = screen(target), occupied = [], shapes = [], labels = [], neighbours = [];
    const addLabel = (p, name, selected = false) => {
      const text = esc(name), w = name.length*(compact?10:6.6)+10;
      for (const [dx,dy] of [[12,-10],[12,compact?26:17],[-w-10,-10],[-w-10,compact?26:17],[-w/2,-22],[-w/2,compact?34:28]]) {
        const b = [p[0]+dx,p[1]+dy-(compact?20:12),p[0]+dx+w,p[1]+dy+4];
        if (b[0]<30 || b[2]>570 || b[1]<45 || b[3]>plotBottom+1) continue;
        if (!selected && occupied.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1])) continue;
        occupied.push(b);
        labels.push('<text x="'+b[0].toFixed(2)+'" y="'+(p[1]+dy).toFixed(2)+'" class="'+(selected?'sky-target-label':'sky-star-label')+'">'+text+'</text>');
        return;
      }
    };
    addLabel(pos,o.name,true);
    // Constellation names take priority over individual star labels on the overview.
    const path = (line) => {
      let out='', last=null;
      for (const point of line) {
        const raw=project(...point), p=raw&&screen(raw);
        // Never join across the back of the sky/projection singularity.
        if (!p || Math.abs(p[0])>2000 || Math.abs(p[1])>2000) {last=null;continue;}
        out+=(last?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2);last=p;
      }
      return out;
    };
    for (const [id,q] of Object.entries(SKY_GUIDE_DATA.constellations)) {
      for (const line of q.lines) {
        const pts=line.map(p=>{const a=project(...p);return a&&screen(a);});
        if (!pts.some(p=>inside(p))) continue;
        shapes.push('<path class="'+(id===con?'sky-figure':'sky-neighbour-figure')+'" d="'+path(line)+'"/>');
      }
      if (id!==con) for(const center of q.centers) {
        const p=project(...center), s=p&&screen(p);
        if(inside(s,28)&&Math.hypot(s[0]-pos[0],s[1]-pos[1])>70) neighbours.push({p:s,name:q.name,id});
      }
    }
    if (!close) {
      for (const center of c.centers) {
        const p=project(...center), q=p&&screen(p);
        if (inside(q,12)&&Math.hypot(q[0]-pos[0],q[1]-pos[1])>35) addLabel(q,c.name);
      }
      for (const q of neighbours.sort((a,b)=>Math.hypot(...a.p.map((v,i)=>v-pos[i]))-Math.hypot(...b.p.map((v,i)=>v-pos[i])))) addLabel(q.p,q.name);
    }
    const stars = SKY_GUIDE_DATA.stars.map(s=>{const p=project(s[1],s[2]);return {s,p:p&&screen(p)};})
      .filter(q=>inside(q.p)).sort((a,b)=>a.s[3]-b.s[3]);
    for (const {s,p} of stars) {
      const radius = Math.max(.65,3.8-.49*(s[3]+1.5));
      shapes.push('<circle cx="'+p[0].toFixed(2)+'" cy="'+p[1].toFixed(2)+'" r="'+radius.toFixed(2)+'" class="sky-star"><title>'+esc(s[4]||'HIP '+s[0])+' · V '+s[3]+'</title></circle>');
      if(s[4]&&s[3]<=3.5&&Math.hypot(p[0]-pos[0],p[1]-pos[1])>22&&labels.length<(close?(compact?8:15):(compact?13:24))) addLabel(p,s[4]);
    }
    if (close) for (const q of neighbours.slice(0,4)) addLabel(q.p,q.name);
    const span = 4*Math.atan(510/(4*scale))/r,
      clipId = 'skyChartClip-'+(close?'close-':'wide-')+String(o.id||'star').replace(/[^\w-]/g,'-');
    return '<svg class="sky-finding-chart'+(compact?' compact':'')+'" viewBox="0 0 600 390" role="img" aria-label="'+esc('Поисковая карта: '+o.name+', '+c.name)+'">'+
      '<defs><clipPath id="'+clipId+'"><rect x="24" y="42" width="552" height="'+(plotBottom-37)+'" rx="2"/></clipPath></defs>'+
      '<text x="30" y="26" class="sky-chart-heading">'+esc(c.name)+'</text><text x="570" y="26" text-anchor="end" class="sky-orientation">СЕВЕР ↑ · ВОСТОК ←</text>'+
      '<g clip-path="url(#'+clipId+')">'+shapes.join('')+labels.join('')+
      '<g class="sky-target" transform="translate('+pos[0].toFixed(2)+' '+pos[1].toFixed(2)+')"><circle r="9"/><path d="M-15 0h4m22 0h4M0-15v4m0 22v4"/></g></g>'+
      (faint?'<g class="sky-faint-notice"><text x="30" y="328">Выбранная звезда: V = '+v.toLocaleString('ru-RU',{maximumFractionDigits:2})+'</text><text x="30" y="353">Слабее всех фоновых звёзд (V ≤ '+limit+')</text></g>':'')+
      '<text x="30" y="376" class="sky-orientation">ФОНОВЫЕ ЗВЁЗДЫ ДО V = '+limit+' · ШИРИНА ПОЛЯ ≈ '+Math.round(span)+'°</text><text x="570" y="376" text-anchor="end" class="sky-orientation">ВИД С ЗЕМЛИ</text></svg>';
  },
  finder(o) {
    if (!this.canChart(o)) return '';
    const esc=this.escape, con=this.constellation(o.raDeg,o.decDeg), c=SKY_GUIDE_DATA.constellations[con], v=this.observing(o),
      latitudes=this.latitudeLimits(...(c.decRangeDeg||[])), starLatitudes=this.latitudeLimits(o.decDeg),
      near=this.near(o).map(q=>esc(q.star[4])+' — '+q.angle.toLocaleString('ru-RU',{maximumFractionDigits:1})+'°').join('; '),
      system=ExtendedCatalog.systemByMember.get(o.id),
      close=system?.members.some(id=>{const p=object(id);return id!==o.id&&p&&this.eligible(p)&&this.separation([o.raDeg,o.decDeg],[p.raDeg,p.decDeg])<1/60;});
    return '<section class="sky-guide" id="stellarSkyGuide" aria-labelledby="skyGuideTitle"><h3 id="skyGuideTitle">Где искать на небе</h3>'+
      '<div class="sky-guide-facts"><div><span>Созвездие</span><strong>'+esc(c.name)+'</strong><small>'+esc(c.latin)+' · '+con+'</small></div>'+
      '<div><span>Наблюдение с Земли</span><strong>'+v.text+'</strong><small>'+(v.v===null?'В каталоге нет видимой звёздной величины':'Видимая величина V = '+v.v.toLocaleString('ru-RU',{maximumFractionDigits:2})+' · меньше — ярче')+'</small></div></div>'+
      '<div class="sky-guide-facts sky-guide-latitudes"><div><span>Все области созвездия</span><strong>'+this.latitudeText(latitudes?.whole)+'</strong><small>Хотя бы часть: '+this.latitudeText(latitudes?.partial).toLocaleLowerCase('ru-RU')+'</small></div>'+
      '<div><span>'+ (o.kind==='star'?'Выбранная звезда':'Выбранный объект')+' — широты</span><strong>'+this.latitudeText(starLatitudes.whole)+'</strong><small>с. ш. — северная широта · ю. ш. — южная</small></div></div>'+
      '<p class="sky-guide-note">Широты показывают, где каждая область может подниматься над горизонтом в течение суток. У границы диапазона объекты едва достигают горизонта. Для наблюдения нужны подходящие сезон, время ночи и открытый горизонт.</p>'+
      (near?'<p class="sky-guide-landmarks">Яркие ориентиры: '+near+'. Указаны угловые расстояния на небе.</p>':'')+
      (close?'<p class="sky-guide-note">Тесные компоненты этой системы глазом сливаются в одну точку. Яркость компонента сама по себе не означает, что его можно различить отдельно.</p>':'')+
      '<p class="sky-guide-note">На схеме — взаимное положение звёзд. Высота над горизонтом и поворот созвездия зависят от места, даты и времени. Слабые ближайшие звёзды требуют оптики. Для туманностей и галактик важна также поверхностная яркость; фотографические детали и цвета в окуляре обычно не видны.</p>'+
      '<details class="sky-guide-source"><summary>Координаты и данные</summary>'+(v.evidence?'<p>Видимость глазом подтверждена <a href="'+esc(v.evidence.source)+'" target="_blank" rel="noopener">'+esc(v.evidence.publisher)+' ↗</a>. Нужны тёмное небо и подходящая широта наблюдения.</p>':'')+(v.collection?'<p>Цель каталога '+v.collection+'. Доступность для любительского наблюдения: <a href="https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-'+(v.collection==='Мессье'?'messier':'caldwell')+'-catalog/" target="_blank" rel="noopener">NASA ↗</a>. Некоторые цели требуют очень тёмного неба, фильтров или большого телескопа.</p>':'')+'<p>J2000 · RA '+o.raDeg.toFixed(5)+'° · Dec '+o.decDeg.toFixed(5)+'°. Звёзды: <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D" target="_blank" rel="noopener">XHIP</a>; названия и линии: <a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noopener">d3-celestial</a>; границы созвездий: <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/42" target="_blank" rel="noopener">IAU / Roman 1987</a>. Соединительные линии — традиционная схема созвездия.</p></details></section>';
  },
  hasObservatoryPhoto(o) {
    if (!o || o.synthetic) return false;
    // The identity index is available before publisher metadata or image pixels.
    if (SkyPhotos.ids(o).some(id=>!SkyPhotos.surveys.has(id))) return true;
    if (!this.curatedPhotoTargets) {
      this.curatedPhotoTargets=new Set(SKY_GUIDE_DATA.media.flatMap(p=>[
        ...p.objects.map(id=>'id:'+id),
        ...(p.identifiers||[]).flatMap(id=>(p.kind==='deep-sky'?['nebula','cluster','galaxy']:[p.kind])
          .map(kind=>kind+':'+this.catalogueKey(id)))
      ]));
    }
    return this.curatedPhotoTargets.has('id:'+o.id) ||
      this.identityKeys(o).some(id=>this.curatedPhotoTargets.has(o.kind+':'+id));
  },
  media(o) {
    if (!o || o.synthetic) return [];
    const identifiers=this.identityKeys(o);
    const curated=SKY_GUIDE_DATA.media.filter(p=>p.objects.includes(o.id) ||
      (p.kind===o.kind || p.kind==='deep-sky'&&['nebula','cluster','galaxy'].includes(o.kind)) && p.identifiers?.some(id=>identifiers.includes(this.catalogueKey(id))));
    // One release page can contain several distinct observations. Deduplicate
    // actual image URLs, never the source article shared by those images.
    const seen=new Set(curated.map(p=>p.url));
    return [...curated,...SkyPhotos.media(o).filter(p=>{if(seen.has(p.url))return false;seen.add(p.url);return true;})];
  },
  survey(o) {
    if (!this.hasDirection(o)) return null;
    if (o.kind==='star') {
      const url=SkyDSS.preview(o);
      return {id:'dss',title:'Звёздное поле вокруг '+o.name,instrument:'DSS / STScI',band:'Красная полоса · 10′ × 10′',date:'Архивный снимок',url,source:url,credit:'Digitized Sky Survey · POSS-II / UK Schmidt Telescope',
        description:'Звёздное поле из архива DSS. Яркие звёзды бывают пересвечены, тесные и далёкие объекты могут сливаться.'};
    }
    if (!['nebula','cluster','galaxy','quasar'].includes(o.kind) || (!Number.isFinite(o.apparentV)&&o.d>1e9)) return null;
    // Field size is angular, independent of navigation/display geometry. Large
    // targets are explicitly cropped; photographic coverage is not visibility.
    const size=Math.max(10,Math.min(60,(o.angularMajorArcmin||15)*1.4)),
      url='https://archive.stsci.edu/cgi-bin/dss_search?v=poss2ukstu_red&r='+encodeURIComponent(o.raDeg)+'&d='+encodeURIComponent(o.decDeg)+'&e=J2000&h='+size+'&w='+size+'&f=gif&c=none';
    return {id:'survey',title:o.name+' — архивное поле',instrument:'DSS / STScI',band:'Красная полоса · '+Number(size.toFixed(1))+'′ × '+Number(size.toFixed(1))+'′',date:'Архивный снимок',url,source:url,
      credit:'Digitized Sky Survey · POSS-II / UK Schmidt Telescope',
      description:(o.angularMajorArcmin>size?'Показана центральная часть объекта. ':'')+'Реальное фотографическое поле по каталожным координатам. Слабые детали могут не проявиться; это не вид невооружённым глазом.'};
  },
  photos(o) {
    const survey=this.survey(o);
    return [...this.media(o),...(survey?[survey]:[])];
  },
  gallery(o) {
    const photos=this.photos(o), chartable=this.canChart(o), missing=SkyPhotos.missing(o);
    if(!photos.length&&!chartable&&!missing.length)return '';
    const esc=this.escape, chart=close=>
      '<figure class="stellar-photo stellar-chart" data-photo="'+(close?'chart-close':'chart-wide')+'"><div class="stellar-photo-field stellar-chart-field">'+this.chart(o,close)+'</div>'+
      '<figcaption><strong>'+(close?'Ближе к объекту':'Положение на ночном небе')+'</strong><span>Поисковая схема · вид с Земли · J2000</span><p>'+
      (close?'Выбранный объект в центре поля. Сопоставьте ближайшие звёзды с архивным снимком.':'Широкий обзор неба: найдите знакомые созвездия и проследите линии до отмеченного объекта.')+
      '</p><small>Звёзды: XHIP · названия и линии: d3-celestial</small></figcaption></figure>',
      photo=p=>'<figure class="stellar-photo" data-photo="'+esc(p.id)+'"><div class="stellar-photo-field"><img '+(p.id==='dss'?'id="stellarSkyImage" data-dss-src="':'data-photo-src="')+esc(p.url)+'" alt="'+esc(p.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">'+
        '<p class="stellar-photo-loading" role="status">Загрузка снимка…</p>'+
        '<p class="stellar-photo-error" hidden>Снимок сейчас недоступен. Его можно открыть в архиве по ссылке ниже.</p></div>'+
        '<figcaption><strong>'+esc(p.title)+'</strong><span>'+esc(p.instrument)+' · '+esc(p.band)+' · <span class="stellar-photo-date">'+esc(p.date)+'</span></span><p'+(p.id==='dss'?' class="stellar-dss-description"':'')+'>'+esc(p.description)+'</p>'+
        '<a class="stellar-photo-source" href="'+esc(p.source)+'" target="_blank" rel="noopener">Источник и полный снимок ↗</a><small>Фото: '+esc(p.credit)+'</small>'+
        (p.rights?'<small>Права: '+esc(p.rights)+' · <a href="'+esc(p.archive)+'" target="_blank" rel="noopener">AstroPix ↗</a></small>':'')+'</figcaption></figure>',
      failed=missing.some(p=>SkyPhotos.failed.has(p)),
      pending=missing.length?'<figure class="stellar-photo" data-photo="archive-pending"><div class="stellar-photo-field"><p class="'+(failed?'stellar-photo-error':'stellar-photo-loading')+'" role="status">'+(failed?'Архив сейчас недоступен. <button data-photo-retry>Повторить загрузку</button>':'Загрузка снимков обсерваторий…')+'</p></div><figcaption><strong>Снимки обсерваторий</strong><span>Hubble, Webb, ESO и другие телескопы</span><p>Фотографии и подписи из общего архива обсерваторий.</p><a class="stellar-photo-source" href="https://www.astropix.org/" target="_blank" rel="noopener">Архив AstroPix ↗</a></figcaption></figure>':'',
      // Keep both available finding charts together before any photographs.
      slides=[...(chartable?[chart(false),chart(true)]:[]),...photos.filter(p=>!['dss','survey'].includes(p.id)).map(photo),...(pending?[pending]:[]),...photos.filter(p=>['dss','survey'].includes(p.id)).map(photo)];
    return '<section class="stellar-gallery" id="stellarMedia" aria-label="Небо и снимки" aria-roledescription="карусель">'+
      '<div class="stellar-gallery-viewport"><div class="stellar-gallery-track" id="stellarGallery" tabindex="0" role="region" aria-label="Карты неба и фотографии. Листайте горизонтально">'+slides.join('')+'</div>'+
      '<div class="stellar-gallery-nav"><button id="stellarGalleryPrev" aria-label="Предыдущий кадр" aria-controls="stellarGallery" disabled>←</button><button id="stellarGalleryNext" aria-label="Следующий кадр" aria-controls="stellarGallery">→</button></div></div><div class="stellar-gallery-heading"><h3 id="stellarGalleryTitle">Небо и снимки</h3><span id="stellarGalleryPosition" aria-live="polite" aria-atomic="true">1 / '+slides.length+'</span></div></section>';
  },
  mount(o) {
    this.photoAbort?.abort();
    const track=document.getElementById('stellarGallery');
    if(!track)return;
    let active=-1;
    const cards=[...track.querySelectorAll('figure')],prev=document.getElementById('stellarGalleryPrev'),next=document.getElementById('stellarGalleryNext'),
      current=()=>cards.reduce((best,c,i)=>Math.abs(c.offsetLeft-track.scrollLeft)<Math.abs(cards[best].offsetLeft-track.scrollLeft)?i:best,0),
      update=()=>{const i=current();if(i===active)return;active=i;prev.disabled=i===0;next.disabled=i===cards.length-1;document.getElementById('stellarGalleryPosition').textContent=(i+1)+' / '+cards.length;
        for(const [j,card] of cards.entries()){card.inert=j!==i;card.setAttribute('aria-hidden',String(j!==i));card.setAttribute('aria-label',(j+1)+' из '+cards.length);card.querySelector('figcaption').hidden=j!==i;if(j===i){const img=card.querySelector('img[data-photo-src]');if(img&&!img.getAttribute('src'))img.src=img.dataset.photoSrc;}}},
      move=delta=>{const i=Math.max(0,Math.min(cards.length-1,current()+delta));track.scrollTo({left:cards[i].offsetLeft,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    prev.onclick=()=>move(-1);next.onclick=()=>move(1);track.addEventListener('scroll',update,{passive:true});
    document.getElementById('stellarMedia').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
    for(const photo of track.querySelectorAll('img')) {
      const settled=failed=>{photo.hidden=failed;const p=photo.parentElement;p.querySelector('.stellar-photo-loading').hidden=true;p.querySelector('.stellar-photo-error').hidden=!failed;p.classList.toggle('unavailable',failed);};
      photo.onload=()=>settled(false);photo.onerror=()=>settled(true);if(photo.getAttribute?.('src')&&photo.complete)settled(!photo.naturalWidth);
    }
    if(typeof fetch==='function'&&typeof AbortController==='function') {
      this.photoAbort=new AbortController();
      const signal=this.photoAbort.signal,dss=track.querySelector('figure[data-photo="dss"]');
      if(!this.photoDialogClose) {
        this.photoDialogClose=()=>this.photoAbort?.abort();
        document.getElementById('infoDialog').addEventListener('close',this.photoDialogClose);
      }
      if(dss)SkyDSS.mount(o,dss,signal);
    }
    if(cards.length)update();
    const refresh=async retry=>{
      if(retry)for(const p of SkyPhotos.missing(o))SkyPhotos.failed.delete(p);
      const changed=await SkyPhotos.ensure(o);
      // Closing/switching cards during a request must not reopen an old card.
      if(!changed||document.getElementById('stellarGallery')!==track||!track.isConnected)return;
      const selected=cards[current()]?.dataset.photo;
      document.getElementById('stellarMedia').outerHTML=this.gallery(o);
      const replacement=document.getElementById('stellarGallery'),figures=[...replacement.querySelectorAll('figure')],
        target=figures.find(c=>c.dataset.photo===selected)||
          (selected==='archive-pending'&&figures.find(c=>c.dataset.photo.startsWith('astropix-')))||figures[0];
      replacement.scrollLeft=target.offsetLeft;
      this.mount(o);
    };
    const retry=track.querySelector('[data-photo-retry]');if(retry)retry.onclick=()=>refresh(true);
    if(typeof fetch==='function')refresh(false);
  },
};
globalThis.SkyGuide=SkyGuide;
