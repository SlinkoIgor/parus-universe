'use strict';
// A research calculator only. Jet fractions/geometry and sail coupling are
// scenario inputs; they are not added as measured fields to pulsar catalogues.
const PulsarResearch = {
  presets: {
    vela: {name:'Вела',period:.0893,pdot:1.25e-13},
    crab: {name:'Краб',period:.0331,pdot:4.21e-13},
  },
  plasmaIntegral(eta, jetEta) {
    const s = Math.sinh(jetEta);
    if (eta < .01 * jetEta) {
      // Positive quadrature avoids cancellation of the closed form near rest.
      const h = eta / 2, f = x => Math.sinh(x) * (s / Math.sinh(jetEta-x)) ** 2;
      return h * (.3478548451374538 * (f(h*(1-.8611363115940526))+f(h*(1+.8611363115940526))) +
        .6521451548625461 * (f(h*(1-.3399810435848563))+f(h*(1+.3399810435848563))));
    }
    const left = jetEta-eta;
    return s*s * (s/Math.sinh(left)-1 + Math.cosh(jetEta)*Math.log(Math.tanh(left/2)/Math.tanh(jetEta/2)));
  },
  calculate({powerW, fraction=.01, halfAngleDeg=5, radiusAu=1, massKg=2, diameterM=100, flowBeta=.7}) {
    const c=Rocket.c, r=radiusAu*149597870700, area=Math.PI*(diameterM/2)**2;
    const omega=4*Math.PI*Math.sin(halfAngleDeg*Math.PI/360)**2;
    const flux=powerW*fraction/(omega*r*r), intercepted=flux*area;
    const gamma=1/Math.sqrt(1-flowBeta*flowBeta);
    const photonA=2*intercepted/(massKg*c);
    // Cold mono-energetic particles, kinetic luminosity excluding rest mass,
    // perfect reversal by an ideal magnetic sail, initially stationary craft.
    const plasmaA=2*gamma*flowBeta/(gamma-1)*intercepted/(massKg*c);
    // Radial photon sail escaping a 1/r² cone. e^(3η)/6-e^η/2+1/3 = a(r0)r0/c².
    // This is a separate all-photon scenario, never added to plasma thrust.
    const budget=photonA*r/(c*c); let lo=0,hi=20;
    for(let i=0;i<100;i++){const eta=(lo+hi)/2,u=Math.expm1(eta),integral=u*u*(u+3)/6;if(integral>budget)hi=eta;else lo=eta;}
    const photonTerminalBeta=Math.tanh((lo+hi)/2),jetEta=Math.atanh(flowBeta),plasmaBudget=plasmaA*r/(c*c);
    lo=0;hi=jetEta*(1-Number.EPSILON);
    for(let i=0;i<100;i++){const eta=(lo+hi)/2;if(this.plasmaIntegral(eta,jetEta)>plasmaBudget)hi=eta;else lo=eta;}
    return {omega,flux,intercepted,photonA,plasmaA,photonTerminalBeta,plasmaTerminalBeta:Math.min(flowBeta,Math.tanh((lo+hi)/2)),gravity:6.67430e-11*1.4*1.98847e30/(r*r)};
  },
  power(p) { return 4*Math.PI*Math.PI*1e38*p.pdot/p.period**3; },
  show() {
    showDialog('<div class="modal-eyebrow">ИССЛЕДОВАНИЕ / ВНЕШНЯЯ ЭНЕРГИЯ</div><h2>Парус в джете пульсара.</h2><p>Передача импульса физически возможна. Реалистичный кандидат для плазмы — магнитный парус; обычная отражающая плёнка не является зеркалом для релятивистских частиц. Нагрев, радиация и устойчивость здесь не решены.</p><div class="pulsar-inputs" id="pulsarInputs"><label>Источник<select id="jetSource"><option value="vela">Вела</option><option value="crab">Краб</option></select></label><label>Доля мощности в одном джете, %<input id="jetFraction" type="number" min=".000001" max="100" value="1" step="any"></label><label>Полуугол конуса, °<input id="jetAngle" type="number" min=".01" max="90" value="5" step="any"></label><label>Расстояние от пульсара, а.е.<input id="jetRadius" type="number" min=".01" max="1000000000" value="1" step="any"></label><label>Масса корабля, кг<input id="jetMass" type="number" min=".001" max="1000000000" value="2" step="any"></label><label>Эффективный диаметр паруса, м<input id="jetDiameter" type="number" min=".001" max="1000000" value="100" step="any"></label></div><div id="jetResults" aria-live="polite"></div><p>Доля 1% и угол 5° — выбранный сценарий, не измерения этих пульсаров. Мощность потери вращательной энергии оценена по периоду и его производной при моменте инерции I = 10³⁸ кг·м². Она задаёт энергетический бюджет, но не известную мощность конкретного джета.</p><h3>Вернуться к Земле?</h3><p>Радиопульсы видны, когда вращающийся радиолуч пересекает наше направление. Джет обычно связан с осью вращения; это другой поток с другой геометрией. Радиовидимость не означает, что джет направлен на Землю. Есть и пульсары, обнаруженные вне радиодиапазона. Для маршрута нужны измерения ориентации и ширины конкретного джета; каталог сам по себе их не даёт.</p><p>Поток разгоняет наружу от пульсара. Идеальный плазменный парус, увлекаемый потоком 0,7 c, не пересечёт эту скорость за счёт такого потока: относительный напор стремится к нулю. Скорость 0,7 c наблюдалась в джете Велы и не является общей скоростью всех пульсарных джетов.</p><p class="object-note">Карта не получает нового двигателя: это верхние оценки идеального взаимодействия. Не учтены нагрев и разрушение паруса, спектр частиц, магнитное поле и требуемая сверхпроводящая система, меняющаяся коллимация, потери, конечная длина джета и эволюция пульсара.</p><p><a href="https://chandra.harvard.edu/photo/2013/vela/" target="_blank" rel="noopener">Chandra: джет Велы, ≈0,7 c</a> · <a href="https://chandra.harvard.edu/photo/2008/crab/" target="_blank" rel="noopener">Chandra: джеты и экваториальный ветер Краба</a> · <a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noopener">ATNF: периоды и производные</a> · <a href="pulsar-research.md" target="_blank">Формулы и ограничения расчёта</a></p>');
    $('pulsarInputs').oninput=()=>this.render();
    $('pulsarInputs').onchange=()=>this.render();
    this.render();
  },
  render() {
    const p=this.presets[$('jetSource').value||'vela'];
    const inputs=['jetFraction','jetAngle','jetRadius','jetMass','jetDiameter'];
    if(inputs.some(id=>!$(id).checkValidity()||$(id).value==='')){$('jetResults').textContent='Введите значения в допустимых пределах.';return;}
    const powerW=this.power(p),q=this.calculate({powerW,fraction:+$('jetFraction').value/100,halfAngleDeg:+$('jetAngle').value,radiusAu:+$('jetRadius').value,massKg:+$('jetMass').value,diameterM:+$('jetDiameter').value});
    $('jetResults').innerHTML='<dl class="source-specs"><div><dt>Потеря вращательной энергии</dt><dd>'+quantity(powerW)+' Вт</dd></div><div><dt>Плотность мощности в конусе</dt><dd>'+quantity(q.flux)+' Вт/м²</dd></div><div><dt>Плазма 0,7 c · начальное ускорение</dt><dd>'+quantity(q.plasmaA/G0)+' g</dd></div><div><dt>Плазма · предельная скорость при удалении</dt><dd>'+percentC(q.plasmaTerminalBeta)+'</dd></div><div><dt>Отдельно: весь поток — фотоны</dt><dd>'+quantity(q.photonA/G0)+' g</dd></div><div><dt>Фотоны · предельная скорость при удалении</dt><dd>'+percentC(q.photonTerminalBeta)+'</dd></div><div><dt>Притяжение 1,4 M☉ на старте</dt><dd>'+quantity(q.gravity/G0)+' g</dd></div></dl><p class="object-note">Два отдельных сценария одной и той же мощности: идеальное отражение холодной плазмы или идеальное отражение фотонов. Ускорения не складываются. Оба предела скорости учитывают спад 1/r²; для фотонов — доплеровское ослабление, для плазмы — исчезновение относительного напора. Гравитация и ограничение перегрузки не включены. Ускорения — в начальный момент; они не сохраняются на всём пути.</p>';
  },
};
