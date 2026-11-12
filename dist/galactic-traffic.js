'use strict';
// Cosmetic traffic: seeded worldlines in a static Galactic frame. No trails,
// catalogue entries, collision queries or per-frame numerical integration.
const GalacticTraffic = {
  count: 40, generations: new Map(), hits: [],
  random(seed) { let n = seed >>> 0; return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  // c = 1 ly/year; alpha = a/c in inverse Julian years.
  plan(from, to, beta, g) {
    const d = Space.distance(from, to), alpha = g * G0 * Rocket.year / Rocket.c;
    const eta = Math.min(Math.atanh(beta), Math.acosh(1 + alpha * d / 2));
    const ta = Math.sinh(eta) / alpha, xa = (Math.cosh(eta) - 1) / alpha, peak = Math.tanh(eta);
    const tc = Math.max(0, (d - 2 * xa) / peak);
    return {from, to, d, alpha, eta, ta, xa, tc, peak, duration: 2 * ta + tc, proper: 2 * eta / alpha + tc / Math.cosh(eta), direction: V3.unit(V3.sub(to.p3, from.p3))};
  },
  sample(p, t) {
    const age = clamp(t, 0, p.duration), a = p.alpha;
    let x, beta, proper;
    if (age < p.ta) {
      const eta = Math.asinh(a * age);
      x = (Math.cosh(eta) - 1) / a; beta = Math.tanh(eta); proper = eta / a;
    } else if (age < p.ta + p.tc) {
      x = p.xa + (age-p.ta) * p.peak; beta = p.peak; proper = p.eta/a + (age-p.ta)/Math.cosh(p.eta);
    } else {
      const left = p.duration-age, eta = Math.asinh(a * left);
      x = p.d - (Math.cosh(eta)-1)/a; beta = Math.tanh(eta); proper = p.proper-eta/a;
    }
    return {point: Space.mix(p.from,p.to,x/p.d), beta, proper, velocity: V3.mul(p.direction,beta)};
  },
  generation(seed = state.trafficSeed) {
    if (this.generations.has(seed)) return this.generations.get(seed);
    const random = this.random(0x70617275 + seed), center = object('sgr').p3;
    const disk = () => { const r = 47000*Math.sqrt(random()), phi = random()*Math.PI*2; return Space.point([center[0]+r*Math.cos(phi),center[1]+r*Math.sin(phi),(random()-.5)*1400]); };
    const names = ['Вектор','Зенит','Кассини','Спектр','Импульс','Кеплер','Горизонт','Арго','Пионер','Сигнал','Квант','Меридиан'];
    const rows = Array.from({length:this.count},(_,i) => {
      const from = disk(), outside = random() < .05;
      const to = outside ? Space.point(V3.add(center,V3.mul(V3.unit([random()-.5,random()-.5,(random()-.5)*.8]),130000+random()*170000))) : disk();
      const p = this.plan(from,to,.25+.72*random(),.2+.8*random());
      const lifetime = p.duration*(.35+.65*random()), gap = p.duration*(.12+.6*random()), cycle = lifetime+gap;
      return {id:'traffic-'+i,traffic:true,name:names[i%names.length]+' '+String(100+seed*3+i),plan:p,outside,lifetime,cycle,offset:random()*cycle};
    });
    // Only the chosen generation is retained; the seed selects one of 100 fleets.
    this.generations.clear(); this.generations.set(seed,rows); return rows;
  },
  relativeGamma(a, b) {
    const aa=V3.dot(a,a), bb=V3.dot(b,b);
    return Math.max(1,(1-V3.dot(a,b))/Math.sqrt(Math.max(Number.EPSILON,1-aa)*Math.max(Number.EPSILON,1-bb)));
  },
  playerVelocity() {
    const f=state.flight;
    if (!f) {
      const o=state.orbit;
      if (!o) return [0,0,0];
      return V3.mul(V3.add(V3.mul(o.radial,-Math.sin(o.angle||0)),V3.mul(o.tangent,Math.cos(o.angle||0))),state.beta);
    }
    if (state.phase==='flyby' && f.encounter?.plan) {
      const p=f.encounter.plan,t=p.elapsedProper||0,dt=Math.min(.0001,p.proper/1000),a=Gravity.atProper(p,Math.max(0,t-dt)),b=Gravity.atProper(p,Math.min(p.proper,t+dt));
      return V3.mul(V3.unit(V3.sub(b.offset,a.offset)),state.beta);
    }
    return V3.mul(V3.unit(V3.sub((f.aim||object(f.target)).p3,f.from.p3)),state.beta);
  },
  visible() {
    if (!state.multiplayer) return false;
    // Hide an unresolved Milky Way, including radial/universe overviews.
    const galaxy=GALAXIES.find(g=>g.id==='milkyway');
    return !!galaxy && galaxyProjection(galaxy).r >= 65;
  },
  active(time = state.earth) {
    return this.generation().flatMap(row => {
      const age=((time+row.offset)%row.cycle+row.cycle)%row.cycle;
      return age < row.lifetime ? [{...row,...this.sample(row.plan,age)}] : [];
    });
  },
  draw() {
    this.hits=[];
    if (!this.visible()) return;
    const ships=this.active(), own=this.playerVelocity();
    for (const q of ships) {
      const p=screen(q.point);
      if (p.x < -12 || p.x > width+12 || p.y < -12 || p.y > height+12) continue;
      const next=screen(Space.point(V3.add(q.point.p3,V3.mul(q.plan.direction,Math.max(1,cam.span*.0001))))),angle=Math.atan2(next.y-p.y,next.x-p.x);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.strokeStyle=paint('#777777');ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-4,-3);ctx.lineTo(-2,0);ctx.lineTo(-4,3);ctx.closePath();ctx.stroke();ctx.restore();
      q.p=p;q.relativeGamma=this.relativeGamma(own,q.velocity);this.hits.push(q);
      if (hover?.id===q.id) {
        text(q.name,p.x+11,p.y-8,9,'#454545');
        text(percentC(q.beta)+' · γ отн. '+fmt(q.relativeGamma,3),p.x+11,p.y+6,8,'#666666');
      }
    }
  },
  hit(x,y) { return this.visible() ? this.hits.find(q=>Math.hypot(x-q.p.x,y-q.p.y)<10) : null; },
  show(q) {
    const rate=1/q.relativeGamma;
    showDialog('<div class="modal-eyebrow">МУЛЬТИПЛЕЕР / КОРАБЛЬ-БОТ</div><h2>'+q.name+'</h2><p>'+ (q.outside?'Курс за пределы Млечного Пути.':'Перелёт в Млечном Пути.')+'</p><dl class="source-specs"><div><dt>Скорость относительно Галактики</dt><dd>'+percentC(q.beta)+'</dd></div><div><dt>Бортовой возраст рейса</dt><dd>'+durationText(q.proper)+'</dd></div><div><dt>Лоренц-фактор относительно нас</dt><dd>'+fmt(q.relativeGamma,4)+'</dd></div><div><dt>За один год в нашей мгновенной системе</dt><dd>'+fmt(rate,4)+' года на боте</dd></div></dl><p>γₒₜₙ = γ₁ γ₂ (1 − v₁·v₂/c²). Одинаковые векторы скорости дают γₒₜₙ = 1; встречный курс увеличивает относительную скорость. Это локальное сравнение часов инерциальных систем, а не темп принимаемого светового сигнала.</p><p class="object-note">Игровой трафик: аналитический разгон и торможение с постоянным собственным ускорением, между ними инерционный полёт. Карта показывает одновременные положения в системе Галактики; задержка света, галактическая гравитация и расход топлива ботов не моделируются. Повторяемый сценарий не меняет физику вашего корабля.</p>');
  },
  renderControl() {
    UIPatch.set($('multiplayerToggle'), 'checked', state.multiplayer);
    UIContent.text($('trafficCount'), !state.multiplayer?'выкл.':!this.visible()?'скрыты в этом масштабе':this.hits.length+' на экране');
  },
};
