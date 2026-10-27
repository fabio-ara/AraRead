import type { Ref } from './contracts.ts';
import { ensure } from './errors.ts';
export type Element = {id:string;source_id:string;ordinal:number;kind:string;text:string;locator:string;meta:Record<string,unknown>};
export const cp = (s:string) => Array.from(s);
export const sameRef = (a:Ref|null,b:Ref|null)=>a===b||!!a&&!!b&&a.source_id===b.source_id&&a.element_id===b.element_id&&a.start===b.start&&a.end===b.end;
export function validateRef(ref:Ref,element:Element,sourceId:string){
 ensure(ref.source_id===sourceId&&element.source_id===sourceId&&ref.element_id===element.id,'INVALID_REF','Referência de outra fonte ou elemento.');
 ensure(ref.start>=0&&ref.end>ref.start&&ref.end<=cp(element.text).length,'INVALID_REF','Intervalo fora do texto original.');
}
/** Frozen only for recognizing/testing the historical policy; never used for new passages. */
export function legacyPortion(element:Element,start=0,size='medium'):Ref {
 const text=cp(element.text), target=({short:550,medium:1050,long:1800} as Record<string,number>)[size]||1050;
 let end=text.length;
 if(['paragraph','quote','verse','note'].includes(element.kind)&&text.length-start>target*1.25){
  // Nunca salta espaços ou pontuação: a próxima porção começa exatamente no fim desta.
  const min=start+Math.floor(target*.65),max=Math.min(start+Math.floor(target*1.25),text.length);
  end=-1;
  for(let i=Math.min(start+target,max);i>=min;i--)if(/[.!?;。！？]/u.test(text[i-1])&&/\s/u.test(text[i]||'')){end=i;break;}
  if(end<0)for(let i=Math.min(start+target,max);i<max;i++)if(/\s/u.test(text[i])){end=i+1;break;}
  if(end<0)end=max; // Limite explícito; equações, provas, tabelas e código nunca são subdivididos.
 }
 return {source_id:element.source_id,element_id:element.id,start,end};
}
export const segmentationPolicy='paragraph-sentence/2';
const splittable=new Set(['paragraph','quote','note']);
const word=(c:string)=>!!c&&/[\p{L}\p{N}\p{M}]/u.test(c);
const opening:Record<string,string>={'(':')','[':']','{':'}','“':'”','‘':'’','«':'»','‹':'›','「':'」','『':'』','（':'）','【':'】'};
const closing=new Set(Object.values(opening));
// Conservative, explicit multilingual policy. Unrecognized language is not a semantic guarantee.
const abbreviations=new Set(['sr','sra','srta','dr','dra','prof','profa','mr','mrs','ms','st','saint','jr','sr','etc','ex','p','pp','vol','cap','fig','cf','vs','approx','ca','jan','fev','mar','abr','jun','jul','ago','set','out','nov','dez','feb','apr','aug','sep','oct','dec','mme','mlle','m','bce','ce','bc','ad']);
export function sentenceBoundaries(text:string){
 const chars=cp(text),stack:string[]=[],boundaries=[0];let pending=false,unbalanced=false;
 const graph=new Set<number>([0,chars.length]);let count=0;
 for(const segment of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)){count+=cp(segment.segment).length;graph.add(count);}
 for(let i=0;i<chars.length;i++){
  const char=chars[i],prev=chars[i-1]||'',next=chars[i+1]||'';
  const apostrophe=(char==='\''||char==='’')&&word(prev)&&word(next);
  let closes=false;
  if(!apostrophe){
   if(char==='"'||char==='\''){
    if(prev!=='\\'){if(stack.at(-1)===char){stack.pop();closes=true;}else {stack.push(char);pending=false;}}
   }else if(opening[char]){stack.push(opening[char]);pending=false;}
   else if(closing.has(char)){closes=true;if(stack.at(-1)===char)stack.pop();else unbalanced=true;}
  }
  if(/[.!?。！？]/u.test(char)){
   let terminal=true;
   if(char==='.'){
    const token=chars.slice(Math.max(0,i-24),i).join('').match(/([\p{L}]+)$/u)?.[1]||'';
    terminal=!(prev==='.'||next==='.'||/\d/u.test(prev)&&/\d/u.test(next)||abbreviations.has(token.toLowerCase())||/^\p{L}$/u.test(token)||word(next));
   }
   pending=terminal;
  }else if(!closes&&!/\s/u.test(char))pending=false;
  if(pending&&!stack.length&&!unbalanced){
   // A sentence includes its closing marks and following spaces, never the next word.
   if(!next||/\s/u.test(next)||/[。！？]/u.test(char)&&!closing.has(next)&&next!=='"'&&next!=="'"){
    let end=i+1;while(end<chars.length&&/\s/u.test(chars[end]))end++;
    if(graph.has(end)&&boundaries.at(-1)!==end)boundaries.push(end);
    pending=false;
   }
  }
 }
 if(boundaries.at(-1)!==chars.length)boundaries.push(chars.length);
 return {boundaries,unclosed_structure:stack.length>0||unbalanced};
}
function chooseEnd(length:number,boundaries:number[],start:number,size:string,atomic:boolean){
 if(atomic||size!=='short'&&length-start<=6000)return length;
 const target=({short:550,medium:3500,long:5500} as Record<string,number>)[size]||3500;
 const candidates=boundaries.filter(v=>v>start),before=candidates.filter(v=>v>=start+target*.65&&v<=start+target);
 return before.at(-1)||candidates.find(v=>v>=start+target)||length;
}
export function portion(element:Element,start=0,size='medium'):Ref {
 const length=cp(element.text).length;ensure(Number.isInteger(start)&&start>=0&&start<length,'INVALID_REF','Início fora do elemento.');
 const end=chooseEnd(length,sentenceBoundaries(element.text).boundaries,start,size,!splittable.has(element.kind));
 return {source_id:element.source_id,element_id:element.id,start,end};
}
export function passageInfo(element:Element,ref:Ref,size='medium'){
 validateRef(ref,element,element.source_id);
 const length=cp(element.text).length,atomic=!splittable.has(element.kind),structure=sentenceBoundaries(element.text),parts:Ref[]=[];
 let start=0;while(start<length){const end=chooseEnd(length,structure.boundaries,start,size,atomic);parts.push({source_id:element.source_id,element_id:element.id,start,end});start=end;}
 const index=parts.findIndex(p=>sameRef(p,ref)),fragment=ref.start!==0||ref.end!==length;
 const starts=ref.start>0&&(atomic||!structure.boundaries.includes(ref.start)),ends=ref.end<length&&(atomic||!structure.boundaries.includes(ref.end));
 const label=element.locator||`Elemento ${element.ordinal+1}`;
 const reason=!fragment?(length>6000?'protected_or_unsplittable_unit':'whole_element'):index<0?'existing_or_explicit_interval':size==='short'?'short_reading':'long_element';
 return {policy:segmentationPolicy,full_ref:{source_id:element.source_id,element_id:element.id,start:0,end:length},is_fragment:fragment,starts_mid_unit:starts,ends_mid_unit:ends,continues_before:ref.start>0,continues_after:ref.end<length,part:index<0?null:index+1,parts:index<0?null:parts.length,reason,unclosed_source_structure:structure.unclosed_structure,
  label:!fragment?label:index>=0?`${label} · parte ${index+1} de ${parts.length}`:`${label} · trecho ${ref.start>0?'em continuação':'inicial'}${ref.end<length?' · continua':''}`,
  notice:starts||ends?'Este intervalo interrompe uma construção original. Recomponha o elemento ou explicite sua continuidade.':fragment?'Parte do mesmo elemento original; parágrafos didáticos não mudam esse escopo.':length>6000?'Unidade excede o alvo; preservada inteira por ausência de fronteira segura ou estrutura protegida.':''};
}
export function mergeIntervals(intervals:Ref[],ref:Ref):Ref[]{
 const related=[...intervals.filter(x=>x.element_id===ref.element_id),ref].sort((a,b)=>a.start-b.start),merged:Ref[]=[];
 for(const v of related){const last=merged.at(-1);if(last&&v.start<=last.end)last.end=Math.max(last.end,v.end);else merged.push({...v});}
 return [...intervals.filter(x=>x.element_id!==ref.element_id),...merged];
}
