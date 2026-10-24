'use strict';
let indexPromise, lastKey, lastRows;
const normalize=s=>s.normalize('NFKD').toLocaleLowerCase('ru').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').replace(/(ngc|ic)0+(?=\d)/g,'$1');
const matches=(kind,filter)=>filter==='all'||filter==='star'&&['star','home','pulsar','blackhole','nebula'].includes(kind)||filter==='galaxy'&&kind==='galaxy'||filter==='structure'&&['cluster','structure','wall','void','quasar','ring','arc','horizon'].includes(kind);
self.onmessage=async({data})=>{
 try{
  indexPromise ||= fetch('catalog-data/search.json?v='+encodeURIComponent(data.version||'28')).then(r=>{if(!r.ok)throw Error('Не удалось открыть индекс');return r.json();}).catch(e=>{indexPromise=null;throw e;});
  const rows=await indexPromise,key=data.term+'|'+data.filter;
  if(key!==lastKey){const term=normalize(data.term);lastRows=rows.filter(r=>matches(r[2],data.filter)&&r[6].includes(term)).sort((a,b)=>(term?Number(b[6].includes('|'+term+'|'))-Number(a[6].includes('|'+term+'|')):0)||(a[3]??Infinity)-(b[3]??Infinity)||a[0].localeCompare(b[0]));lastKey=key;}
  const limit=data.limit||100;
  self.postMessage({seq:data.seq,total:lastRows.length,items:lastRows.slice(0,limit).map(r=>({id:r[0],name:r[1],kind:r[2],d:r[3],positionQuality:r[4],tile:r[5],streamed:true,searchExact:!!normalize(data.term)&&r[6].includes('|'+normalize(data.term)+'|')}))});
 }catch(e){self.postMessage({seq:data.seq,error:e.message});}
};
