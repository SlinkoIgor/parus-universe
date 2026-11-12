'use strict';
let indexPromise, lastKey, lastResult;
const normalize=s=>s.normalize('NFKD').toLocaleLowerCase('ru').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').replace(/(ngc|ic)0+(?=\d)/g,'$1');
const matches=(kind,filter)=>filter==='all'||filter==='star'&&['star','home'].includes(kind)||filter==='stellar-cluster'&&kind==='cluster'||filter==='structure'&&['structure','wall','ring','arc'].includes(kind)||filter===kind&&['pulsar','blackhole','quasar','nebula','galaxy','void','horizon','galaxy-cluster','stellar-cluster'].includes(kind);
const order=(a,b)=>(a[3]??Infinity)-(b[3]??Infinity)||a[0].localeCompare(b[0]);
const wide=/[^\u0000-\u00ff]/;
const WIDE=0x80000000;
function textColumn(rows,column){
 const size=rows.length,at=new Uint32Array(size),parts=[[],[]],used=[0,0];
 let longest=0;
 for(let i=0;i<size;i++){
  const raw=rows[i][column],value=typeof raw==='string'?raw:String(raw??''),side=wide.test(value)?1:0;
  at[i]=side?(used[1]|WIDE)>>>0:used[0];
  parts[side].push(value);used[side]+=value.length;
  if(value.length>longest)longest=value.length;
 }
 const lengths=new(longest<65536?Uint16Array:Uint32Array)(size);
 for(let i=0;i<size;i++)lengths[i]=rows[i][column]?.length??String(rows[i][column]??'').length;
 return{at,lengths,text:[parts[0].join(''),parts[1].join('')]};
}
const readText=(column,row)=>{const at=column.at[row];return column.text[at>=WIDE?1:0].substr(at&0x7fffffff,column.lengths[row]);};
function valueColumn(rows,read,Store){
 const values=[],known=new Map(),index=new Store(rows.length);
 let previous,id=-1;
 for(let i=0;i<rows.length;i++){
  const value=read(rows[i]);
  if(id<0||value!==previous){
   id=known.get(value);
   if(id===undefined){id=values.length;values.push(value);known.set(value,id);}
   previous=value;
  }
  index[i]=id;
 }
 if(values.length>(Store===Uint8Array?256:65536))throw Error('Слишком много значений в индексе');
 return{values,index};
}
function compactKey(key){
 if(typeof key!=='string')key=String(key??'');
 if(key.length<2||key[0]!=='|'||key[key.length-1]!=='|')return key;
 const unique=[];
 for(const part of key.split('|'))if(part&&!unique.includes(part))unique.push(part);
 return'|'+unique.join('|')+'|';
}
function keyColumn(rows){
 const sides=[{parts:[],rows:[],used:0,starts:[]},{parts:[],rows:[],used:0,starts:[]}];
 for(let i=0;i<rows.length;i++){
  const key=compactKey(rows[i][6]),side=sides[wide.test(key)?1:0];
  side.starts.push(side.used);side.parts.push(key);side.rows.push(i);side.used+=key.length+1;
 }
 return sides.map(side=>({text:side.parts.join('\n'),starts:Uint32Array.from(side.starts),rows:Uint32Array.from(side.rows)}));
}
function build(rows){
 rows.sort(order);
 const distance=new Float64Array(rows.length),atlasOnly=new Uint8Array(rows.length);
 for(let i=0;i<rows.length;i++){distance[i]=rows[i][3]??NaN;atlasOnly[i]=rows[i][7]?1:0;}
 return{
  size:rows.length,distance,atlasOnly,flags:new Uint8Array(rows.length),
  ids:textColumn(rows,0),names:textColumn(rows,1),keys:keyColumn(rows),
  kind:valueColumn(rows,r=>r[2],Uint8Array),quality:valueColumn(rows,r=>r[4],Uint8Array),
  tile:valueColumn(rows,r=>r[5],Uint16Array),catalogClass:valueColumn(rows,r=>r[8]||null,Uint8Array),
  group:valueColumn(rows,r=>r[8]||r[2],Uint8Array)
 };
}
function scan(side,needle,visit){
 const{text,starts,rows}=side,last=rows.length-1;
 if(last<0)return;
 let entry=0,position=text.indexOf(needle);
 while(position>=0){
  let low=entry,high=last;
  if(low<last&&starts[low+1]>position)high=low;
  while(low<high){const middle=(low+high+1)>>>1;if(starts[middle]<=position)low=middle;else high=middle-1;}
  visit(rows[low]);
  if(low>=last)return;
  entry=low+1;position=text.indexOf(needle,starts[entry]);
 }
}
function merge(a,b){
 if(!b.length)return a;
 if(!a.length)return b;
 const out=[];let i=0,j=0;
 while(i<a.length&&j<b.length)out.push(a[i]<b[j]?a[i++]:b[j++]);
 while(i<a.length)out.push(a[i++]);
 while(j<b.length)out.push(b[j++]);
 return out;
}
function search(index,term,filter){
 const allowed=index.group.values.map(kind=>matches(kind,filter)),group=index.group.index;
 if(!term){
  const all=[];
  for(let row=0;row<index.size;row++)if(allowed[group[row]])all.push(row);
  return{rows:Uint32Array.from(all),exact:0};
 }
 const found=index.keys.map(side=>{const hits=[];scan(side,term,row=>{if(allowed[group[row]])hits.push(row);});return hits;}),
  ordered=merge(found[0],found[1]),flags=index.flags,marked=[],rows=new Uint32Array(ordered.length);
 for(const side of index.keys)scan(side,'|'+term+'|',row=>{flags[row]=1;marked.push(row);});
 let count=0;
 for(const row of ordered)if(flags[row])rows[count++]=row;
 const exact=count;
 for(const row of ordered)if(!flags[row])rows[count++]=row;
 for(const row of marked)flags[row]=0;
 return{rows,exact};
}
function item(index,row,exact){
 const d=index.distance[row];
 return{id:readText(index.ids,row),name:readText(index.names,row),kind:index.kind.values[index.kind.index[row]],d:Number.isNaN(d)?null:d,positionQuality:index.quality.values[index.quality.index[row]],tile:index.tile.values[index.tile.index[row]],atlasOnly:!!index.atlasOnly[row],catalogClass:index.catalogClass.values[index.catalogClass.index[row]],streamed:true,searchExact:exact};
}
self.onmessage=async({data})=>{
 try{
  indexPromise ||= fetch((data.dataRoot||'catalog-data')+'/search.json?v='+encodeURIComponent(data.version||'28'),{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Не удалось открыть индекс');return r.json();}).then(build).catch(e=>{indexPromise=null;throw e;});
  const index=await indexPromise,key=data.term+'|'+data.filter;
  if(key!==lastKey){lastResult=search(index,normalize(data.term),data.filter);lastKey=key;}
  const{rows,exact}=lastResult,count=Math.min(rows.length,data.limit||100),items=[];
  for(let i=0;i<count;i++)items.push(item(index,rows[i],i<exact));
  self.postMessage({seq:data.seq,total:rows.length,items});
 }catch(e){self.postMessage({seq:data.seq,error:e.message});}
};
