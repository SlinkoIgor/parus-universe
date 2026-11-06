'use strict';
// Earth-facing J2000 finding charts. Independent of expedition time, map
// projection, navigation coordinates and photographic plate/image selection.
const SkyGuide = {
  rad: Math.PI / 180,
  escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  eligible(o) {
    return !!o && o.kind === 'star' && !o.synthetic && Number.isFinite(o.raDeg) && o.raDeg >= 0 && o.raDeg < 360 &&
      Number.isFinite(o.decDeg) && Math.abs(o.decDeg) <= 90;
  },
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
    if (o.unresolvedSourcePhotometry) return null;
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
    const con = this.constellation(o.raDeg,o.decDeg), c = SKY_GUIDE_DATA.constellations[con];
    if (!c) return '';
    const esc = this.escape, r = this.rad,
      compact = window.matchMedia ? window.matchMedia('(max-width: 700px)').matches : typeof width === 'number' && width < 700,
      center = close ? [o.raDeg,o.decDeg] : c.centers.slice().sort((a,b) => this.separation(a,[o.raDeg,o.decDeg])-this.separation(b,[o.raDeg,o.decDeg]))[0],
      a = center[0]*r, d = center[1]*r,
      project = (ra,dec) => {
        const x = ra*r-a, y = dec*r, cos = Math.sin(d)*Math.sin(y)+Math.cos(d)*Math.cos(y)*Math.cos(x), den = 1+cos;
        return den < .12 ? null : [-2*Math.cos(y)*Math.sin(x)/den, -2*(Math.cos(d)*Math.sin(y)-Math.sin(d)*Math.cos(y)*Math.cos(x))/den];
      },
      target = project(o.raDeg,o.decDeg), samples = [target, ...c.lines.flat().map(p => project(...p)).filter(Boolean)];
    let box = close ? [-.105,-.067,.105,.067] : [Math.min(...samples.map(p=>p[0])),Math.min(...samples.map(p=>p[1])),Math.max(...samples.map(p=>p[0])),Math.max(...samples.map(p=>p[1]))];
    const scale = Math.min(510/Math.max(.15,box[2]-box[0]),270/Math.max(.1,box[3]-box[1])) / (close ? 1.2 : 1.45),
      cx = (box[0]+box[2])/2, cy = (box[1]+box[3])/2,
      screen = p => [300+(p[0]-cx)*scale,200+(p[1]-cy)*scale],
      inside = (p,pad=0) => p && p[0]>28+pad && p[0]<572-pad && p[1]>45+pad && p[1]<350-pad,
      pos = screen(target), occupied = [], shapes = [], labels = [], neighbours = [];
    const addLabel = (p, name, selected = false) => {
      const text = esc(name), w = name.length*(compact?10:6.6)+10;
      for (const [dx,dy] of [[12,-10],[12,compact?26:17],[-w-10,-10],[-w-10,compact?26:17],[-w/2,-22],[-w/2,compact?34:28]]) {
        const b = [p[0]+dx,p[1]+dy-(compact?20:12),p[0]+dx+w,p[1]+dy+4];
        if (b[0]<30 || b[2]>570 || b[1]<45 || b[3]>351) continue;
        if (!selected && occupied.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1])) continue;
        occupied.push(b);
        labels.push('<text x="'+b[0].toFixed(2)+'" y="'+(p[1]+dy).toFixed(2)+'" class="'+(selected?'sky-target-label':'sky-star-label')+'">'+text+'</text>');
        return;
      }
    };
    addLabel(pos,o.name,true);
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
        if(inside(s,28)&&Math.hypot(s[0]-pos[0],s[1]-pos[1])>70) neighbours.push({p:s,name:q.name});
      }
    }
    const stars = SKY_GUIDE_DATA.stars.map(s=>{const p=project(s[1],s[2]);return {s,p:p&&screen(p)};})
      .filter(q=>inside(q.p)).sort((a,b)=>a.s[3]-b.s[3]);
    for (const {s,p} of stars) {
      const radius = Math.max(.65,3.8-.49*(s[3]+1.5));
      shapes.push('<circle cx="'+p[0].toFixed(2)+'" cy="'+p[1].toFixed(2)+'" r="'+radius.toFixed(2)+'" class="sky-star"><title>'+esc(s[4]||'HIP '+s[0])+' · V '+s[3]+'</title></circle>');
      if(s[4]&&s[3]<=3.5&&Math.hypot(p[0]-pos[0],p[1]-pos[1])>22&&labels.length<(compact?8:15)) addLabel(p,s[4]);
    }
    for (const q of neighbours.slice(0,4)) addLabel(q.p,q.name);
    const span = 4*Math.atan(510/(4*scale))/r,
      clipId = 'skyChartClip-'+(close?'close-':'wide-')+String(o.id||'star').replace(/[^\w-]/g,'-');
    return '<svg class="sky-finding-chart'+(compact?' compact':'')+'" viewBox="0 0 600 390" role="img" aria-label="'+esc('Поисковая карта: '+o.name+', '+c.name)+'">'+
      '<defs><clipPath id="'+clipId+'"><rect x="24" y="42" width="552" height="313" rx="2"/></clipPath></defs>'+
      '<text x="30" y="26" class="sky-chart-heading">'+esc(c.name)+'</text><text x="570" y="26" text-anchor="end" class="sky-orientation">СЕВЕР ↑ · ВОСТОК ←</text>'+
      '<g clip-path="url(#'+clipId+')">'+shapes.join('')+labels.join('')+
      '<g class="sky-target" transform="translate('+pos[0].toFixed(2)+' '+pos[1].toFixed(2)+')"><circle r="9"/><path d="M-15 0h4m22 0h4M0-15v4m0 22v4"/></g></g>'+
      '<text x="30" y="376" class="sky-orientation">ЗВЁЗДЫ ДО V = 6 · ШИРИНА ПОЛЯ ≈ '+Math.round(span)+'°</text><text x="570" y="376" text-anchor="end" class="sky-orientation">ВИД С ЗЕМЛИ</text></svg>';
  },
  finder(o) {
    if (!this.eligible(o)) return '';
    const esc=this.escape, con=this.constellation(o.raDeg,o.decDeg), c=SKY_GUIDE_DATA.constellations[con], v=this.visibility(o),
      latitudes=this.latitudeLimits(...(c.decRangeDeg||[])), starLatitudes=this.latitudeLimits(o.decDeg),
      near=this.near(o).map(q=>esc(q.star[4])+' — '+q.angle.toLocaleString('ru-RU',{maximumFractionDigits:1})+'°').join('; '),
      system=ExtendedCatalog.systemByMember.get(o.id),
      close=system?.members.some(id=>{const p=object(id);return id!==o.id&&p&&this.eligible(p)&&this.separation([o.raDeg,o.decDeg],[p.raDeg,p.decDeg])<1/60;});
    return '<section class="sky-guide" id="stellarSkyGuide" aria-labelledby="skyGuideTitle"><h3 id="skyGuideTitle">Где искать на небе</h3>'+
      '<div class="sky-guide-facts"><div><span>Созвездие</span><strong>'+esc(c.name)+'</strong><small>'+esc(c.latin)+' · '+con+'</small></div>'+
      '<div><span>Наблюдение с Земли</span><strong>'+v.text+'</strong><small>'+(v.v===null?'В каталоге нет видимой звёздной величины':'Видимая величина V = '+v.v.toLocaleString('ru-RU',{maximumFractionDigits:2})+' · меньше — ярче')+'</small></div></div>'+
      '<div class="sky-guide-facts sky-guide-latitudes"><div><span>Все области созвездия</span><strong>'+this.latitudeText(latitudes?.whole)+'</strong><small>Хотя бы часть: '+this.latitudeText(latitudes?.partial).toLocaleLowerCase('ru-RU')+'</small></div>'+
      '<div><span>Выбранная звезда — широты</span><strong>'+this.latitudeText(starLatitudes.whole)+'</strong><small>с. ш. — северная широта · ю. ш. — южная</small></div></div>'+
      '<p class="sky-guide-note">Широты показывают, где каждая область может подниматься над горизонтом в течение суток. У границы диапазона объекты едва достигают горизонта. Для наблюдения нужны подходящие сезон, время ночи и открытый горизонт.</p>'+
      (near?'<p class="sky-guide-landmarks">Яркие ориентиры: '+near+'. Указаны угловые расстояния на небе.</p>':'')+
      (close?'<p class="sky-guide-note">Тесные компоненты этой системы глазом сливаются в одну точку. Яркость компонента сама по себе не означает, что его можно различить отдельно.</p>':'')+
      '<p class="sky-guide-note">На схеме — взаимное положение звёзд. Высота над горизонтом и поворот созвездия зависят от места, даты и времени. Предел видимости глазом около V = 6 относится к тёмному небу.</p>'+
      '<details class="sky-guide-source"><summary>Координаты и данные</summary><p>J2000 · RA '+o.raDeg.toFixed(5)+'° · Dec '+o.decDeg.toFixed(5)+'°. Звёзды: <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D" target="_blank" rel="noopener">XHIP</a>; названия и линии: <a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noopener">d3-celestial</a>; границы созвездий: <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/42" target="_blank" rel="noopener">IAU / Roman 1987</a>. Соединительные линии — традиционная схема созвездия.</p></details></section>';
  },
  photos(o) {
    if (!this.eligible(o)) return [];
    const url=SkyDSS.preview(o);
    return [...SKY_GUIDE_DATA.media.filter(p=>p.objects.includes(o.id)),{
      id:'dss',title:'Звёздное поле вокруг '+o.name,instrument:'DSS / STScI',band:'Красная полоса · 10′ × 10′',date:'Архивный снимок',url,source:url,credit:'Digitized Sky Survey · POSS-II / UK Schmidt Telescope',
      description:'Звёздное поле из архива DSS. Яркие звёзды бывают пересвечены, тесные и далёкие объекты могут сливаться.'}];
  },
  gallery(o) {
    const photos=this.photos(o);if(!photos.length)return '';
    const esc=this.escape, charts=[false,true].map(close=>
      '<figure class="stellar-photo stellar-chart" data-photo="'+(close?'chart-close':'chart-wide')+'"><div class="stellar-photo-field stellar-chart-field">'+this.chart(o,close)+'</div>'+
      '<figcaption><strong>'+(close?'Ближе к звезде':'Созвездие целиком')+'</strong><span>Поисковая схема · вид с Земли · J2000</span><p>'+
      (close?'Выбранная звезда в центре поля. Сопоставьте ближайшие звёзды со снимком DSS.':'Найдите созвездие по ярким звёздам и проследите линии до отмеченной звезды.')+
      '</p><small>Звёзды: XHIP · названия и линии: d3-celestial</small></figcaption></figure>').join('');
    return '<section class="stellar-gallery" id="stellarMedia" aria-label="Небо и снимки" aria-roledescription="карусель">'+
      '<div class="stellar-gallery-viewport"><div class="stellar-gallery-track" id="stellarGallery" tabindex="0" role="region" aria-label="Карты неба и фотографии. Листайте горизонтально">'+charts+photos.map(p=>
        '<figure class="stellar-photo" data-photo="'+esc(p.id)+'"><div class="stellar-photo-field"><img '+(p.id==='dss'?'id="stellarSkyImage" data-dss-src="':'src="')+esc(p.url)+'" alt="'+esc(p.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">'+
        '<p class="stellar-photo-loading" role="status">Загрузка снимка…</p>'+
        '<p class="stellar-photo-error" hidden>Снимок сейчас недоступен. Его можно открыть в архиве по ссылке ниже.</p></div>'+
        '<figcaption><strong>'+esc(p.title)+'</strong><span>'+esc(p.instrument)+' · '+esc(p.band)+' · <span class="stellar-photo-date">'+esc(p.date)+'</span></span><p'+(p.id==='dss'?' class="stellar-dss-description"':'')+'>'+esc(p.description)+'</p>'+
        '<a class="stellar-photo-source" href="'+esc(p.source)+'" target="_blank" rel="noopener">Источник и полный снимок ↗</a><small>Фото: '+esc(p.credit)+'</small></figcaption></figure>').join('')+'</div>'+
      '<div class="stellar-gallery-nav"><button id="stellarGalleryPrev" aria-label="Предыдущий кадр" aria-controls="stellarGallery" disabled>←</button><button id="stellarGalleryNext" aria-label="Следующий кадр" aria-controls="stellarGallery">→</button></div></div><div class="stellar-gallery-heading"><h3 id="stellarGalleryTitle">Небо и снимки</h3><span id="stellarGalleryPosition" aria-live="polite" aria-atomic="true">1 / '+(photos.length+2)+'</span></div></section>';
  },
  mount(o) {
    this.photoAbort?.abort();
    const track=document.getElementById('stellarGallery');
    if(!track)return;
    let active=-1;
    const cards=[...track.querySelectorAll('figure')],prev=document.getElementById('stellarGalleryPrev'),next=document.getElementById('stellarGalleryNext'),
      current=()=>cards.reduce((best,c,i)=>Math.abs(c.offsetLeft-track.scrollLeft)<Math.abs(cards[best].offsetLeft-track.scrollLeft)?i:best,0),
      update=()=>{const i=current();if(i===active)return;active=i;prev.disabled=i===0;next.disabled=i===cards.length-1;document.getElementById('stellarGalleryPosition').textContent=(i+1)+' / '+cards.length;
        for(const [j,card] of cards.entries()){card.inert=j!==i;card.setAttribute('aria-hidden',String(j!==i));card.setAttribute('aria-label',(j+1)+' из '+cards.length);card.querySelector('figcaption').hidden=j!==i;}},
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
  },
};
globalThis.SkyGuide=SkyGuide;
