import type { Ref } from './contracts.ts';
import { ensure } from './errors.ts';
export type Element = {id:string;source_id:string;ordinal:number;kind:string;text:string;locator:string;meta:Record<string,unknown>};
export const cp = (s:string) => Array.from(s);
export const sameRef = (a:Ref|null,b:Ref|null)=>a===b||!!a&&!!b&&a.source_id===b.source_id&&a.element_id===b.element_id&&a.start===b.start&&a.end===b.end;
export function validateRef(ref:Ref,element:Element,sourceId:string){
 ensure(ref.source_id===sourceId&&element.source_id===sourceId&&ref.element_id===element.id,'INVALID_REF','Referência de outra fonte ou elemento.');
 ensure(ref.start>=0&&ref.end>ref.start&&ref.end<=cp(element.text).length,'INVALID_REF','Intervalo fora do texto original.');
}
export function portion(element:Element,start=0,size='medium'):Ref {
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
export function mergeIntervals(intervals:Ref[],ref:Ref):Ref[]{
 const related=[...intervals.filter(x=>x.element_id===ref.element_id),ref].sort((a,b)=>a.start-b.start),merged:Ref[]=[];
 for(const v of related){const last=merged.at(-1);if(last&&v.start<=last.end)last.end=Math.max(last.end,v.end);else merged.push({...v});}
 return [...intervals.filter(x=>x.element_id!==ref.element_id),...merged];
}
