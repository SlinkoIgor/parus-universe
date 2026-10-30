'use strict';
// Optimistic diffraction limit: a uniformly illuminated circular exit pupil,
// perfectly aimed/focused on a centred sail. This is NOT a passive-star-image
// or finite source/etendue model. Wavelengths and propagation are source-frame;
// the receding mirror's Doppler force reduction is applied once in physics.js.
const BeamOptics={
 model:1,workTolerance:1e-4,thermalCache:new Map(),
 bessel(n,x){
  if(x<=16){let t=n?x/2:1,sum=t;for(let k=1;k<100;k++){t*=-x*x/(4*k*(k+n));sum+=t;if(Math.abs(t)<1e-17)break;}return sum;}
  let p=1,q=0,t=1,previous=Infinity;
  for(let k=1;k<=20;k++){t*=(4*n*n-(2*k-1)**2)/(8*k*x);if(Math.abs(t)>previous)break;previous=Math.abs(t);if(k%2)q+=(k%4===1?1:-1)*t;else p+=(k%4===0?1:-1)*t;}
  const phase=x-(n/2+.25)*Math.PI;return Math.sqrt(2/(Math.PI*x))*(Math.cos(phase)*p-Math.sin(phase)*q);
 },
 encircled(x){
  if(!(x>0))return 0;
  if(x<.1){const z=x*x;return z*(1/4+z*(-1/32+z*(5/2304-z*7/73728)));}
  if(x>1e5)return 1-2/(Math.PI*x);
  const j0=this.bessel(0,x),j1=this.bessel(1,x);return Math.max(0,Math.min(1,1-j0*j0-j1*j1));
 },
 thermal(temperatureK){
  const T=Math.max(100,Math.min(1e6,Math.round(temperatureK||5772)));
  if(this.thermalCache.has(T))return this.thermalCache.get(T);
  // Gauss–Legendre integral of Planck energy x³/(exp(x)−1), x=hc/(λkT).
  const wavelengths=[],weights=[],N=40;
  for(let i=0;i<N;i++){
   let z=Math.cos(Math.PI*(i+.75)/(N+.5)),derivative;
   for(let j=0;j<12;j++){let a=1,b=0;for(let k=1;k<=N;k++){const c=b;b=a;a=((2*k-1)*z*b-(k-1)*c)/k;}derivative=N*(z*a-b)/(z*z-1);const next=z-a/derivative;if(Math.abs(next-z)<1e-15){z=next;break;}z=next;}
   const x=20*(1+z),quadrature=40/((1-z*z)*derivative**2);wavelengths.push(.014387768775039337/(T*x));weights.push(quadrature*x**3/Math.expm1(x));
  }
  const total=weights.reduce((a,b)=>a+b,0);for(let i=0;i<N;i++)weights[i]/=total;
  const result={wavelengths,weights};this.thermalCache.set(T,result);return result;
 },
 spectrum(setup,light){return setup.burst?{kind:'supernova',profile:setup.burstSpectrum||'iip'}:{kind:'thermal',temperatureK:light.temperatureK};},
 bands(spectrum,sourceYears=0){
  if(spectrum.kind==='thermal'){const q=this.thermal(spectrum.temperatureK);return{wavelengths:q.wavelengths,a:q.weights,b:q.weights,t:0};}
  const p=BeamSpectra.profiles[spectrum.profile]||BeamSpectra.profiles.iip,days=Math.max(0,sourceYears)*365.25;let hi=1;
  while(hi<p.days.length-1&&p.days[hi]<days)hi++;
  const lo=hi-1,t=Math.max(0,Math.min(1,(days-p.days[lo])/(p.days[hi]-p.days[lo])));
  return{wavelengths:BeamSpectra.wavelengths,a:p.weights[lo],b:p.weights[hi],t};
 },
 fraction(distanceM,sourceYears,spectrum,diameterM=1000,sailRadiusM=50,divergenceDeg=0,diffraction=true){
  if(!(distanceM>0))return 1;
  // With diffraction disabled only the configured uniform geometric cone
  // remains. A zero angle is the explicitly ideal, distance-independent beam.
  if(!diffraction){const radius=distanceM*Math.tan(divergenceDeg*Math.PI/360);return radius>0?Math.min(1,(sailRadiusM/radius)**2):1;}
  // Approximate additional geometric cone blur in quadrature with diffraction.
  // The far-cone limit is sail area / beam area, with no extra divergence at 0°.
  const blur=Math.PI*diameterM*Math.tan(divergenceDeg*Math.PI/360)/2;
  const bands=this.bands(spectrum,sourceYears),k=Math.PI*diameterM*sailRadiusM/distanceM;let power=0;
  for(let i=0;i<bands.wavelengths.length;i++)power+=((1-bands.t)*bands.a[i]+bands.t*bands.b[i])*this.encircled(k/Math.hypot(bands.wavelengths[i],blur));
  return Math.max(0,Math.min(1,power));
 },
 // E(x)<=x²/4 bounds the total future work even before Doppler losses.
 remainingWork(power,distanceM,spectrum,diameterM=1000,sailRadiusM=50,divergenceDeg=0,diffraction=true){
  if(!(distanceM>0))return Infinity;
  if(!diffraction){const angle=Math.tan(divergenceDeg*Math.PI/360);return angle>0?2*power/299792458*(sailRadiusM/angle)**2/distanceM:Infinity;}
  const b=this.bands(spectrum),k=Math.PI*diameterM*sailRadiusM;let moment=0;
  for(let i=0;i<b.wavelengths.length;i++)moment+=b.a[i]/b.wavelengths[i]**2;
  return 2*power/299792458*k*k*moment/(4*distanceM);
 },
 label(spectrum){return spectrum.kind==='supernova'?'Спектральный профиль '+(BeamSpectra.profiles[spectrum.profile]||BeamSpectra.profiles.iip).label:'Тепловой спектр ≈ '+Math.round(spectrum.temperatureK)+' K';}
};
