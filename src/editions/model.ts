import {editionDefaults,type editionPassage,type editionSelector} from './contracts.ts';
import {z} from 'zod';
import {editorialAssessment} from '../study/editorial.ts';
import {ensure} from '../errors.ts';

export type Passage=z.infer<typeof editionPassage>;
export type Selector=z.infer<typeof editionSelector>;
export const points=(s:string)=>Array.from(s);
export const sameRef=(a:any,b:any)=>a.source_id===b.source_id&&a.element_id===b.element_id&&a.start===b.start&&a.end===b.end;
const contains=(a:any,b:any)=>a.source_id===b.source_id&&a.element_id===b.element_id&&a.start<=b.start&&a.end>=b.end;
export const readingKinds=(b:any)=>!['navigation','gap','page_break'].includes(b.kind)&&!!b.text?.trim();
export function configuration(records:any[],projectId?:string,profileId?:string,sessionId?:string,readerId?:string){
 const values:Record<string,any>={...editionDefaults},origins:Record<string,any>=Object.fromEntries(Object.keys(values).map(k=>[k,{scope:'default',revision:0}]));
 for(const scope of ['account','profile','project','session','reader']){
  const r=records.find(r=>r.scope===scope&&(scope==='account'||scope==='profile'&&r.scope_id===profileId||scope==='project'&&r.scope_id===projectId||scope==='session'&&r.scope_id===sessionId||scope==='reader'&&r.scope_id===readerId));
  if(r)for(const [key,value]of Object.entries(r.values)){values[key]=value;origins[key]={scope,revision:r.revision,record_id:r.id};}
 }
 return {values,origins,records:records.map(({id,scope,scope_id,revision,values})=>({id,scope,scope_id,revision,values})),precedence:['session','project','profile','account','default']};
}
export function publishedConfiguration(config:any){
 const keys=['language','objective','explanation','definitions','examples','mnemonics','humor','activities','translation_style'];
 return {values:Object.fromEntries(keys.map(k=>[k,config.values[k]])),origins:Object.fromEntries(keys.map(k=>[k,{scope:config.origins[k].scope,revision:config.origins[k].revision}])),precedence:config.precedence,private_fields_omitted:Object.keys(config.values).filter(k=>!keys.includes(k)),notice:'Configuração pública limitada. Conhecimentos prévios, textos livres e preferências pessoais permanecem no projeto privado.'};
}
export function sourceElement(sources:any[],ref:any){
 const source=sources.find(s=>s.id===ref.source_id),element=source?.blocks.find((b:any)=>b.id===ref.element_id);
 ensure(element&&Number.isInteger(ref.start)&&ref.start>=0&&ref.end>ref.start&&ref.end<=points(element.text).length,'INVALID_REF','O intervalo não pertence à fonte canônica desta edição.');
 return {source,element,text:points(element.text).slice(ref.start,ref.end).join('')};
}
export function originalSegments(p:Passage,sources:any[]){return p.refs.map(ref=>{const e=sourceElement(sources,ref);return {id:ref.element_id,representation:'original',language:e.source.metadata.original_language,text:e.text,refs:[ref],base_offset:ref.start,kind:e.element.kind,locator:e.element.locator,meta:e.element.meta};});}
export function segmentFor(p:Passage,sources:any[],target:Pick<Selector,'representation'|'segment_id'>){
 return target.representation==='original'?originalSegments(p,sources).find(s=>s.id===target.segment_id):p.segments.find(s=>s.id===target.segment_id&&s.representation===target.representation);
}
export function checkSelection(p:Passage,sources:any[],target:Omit<Selector,'passage_id'>){
 const segment=segmentFor(p,sources,target);ensure(segment,'INVALID_SELECTION','O segmento não pertence a esta representação.');
 const chars=points(segment.text),base='base_offset'in segment?segment.base_offset:0,start=target.start-base,end=target.end-base;
 ensure(start>=0&&end>start&&end<=chars.length&&chars.slice(start,end).join('')===target.exact,'INVALID_SELECTION','A seleção não corresponde ao texto exato desta versão.');
 const bounds=new Set([0]);let n=0;for(const part of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(segment.text)){n+=points(part.segment).length;bounds.add(n);}
 ensure(bounds.has(start)&&bounds.has(end),'INVALID_SELECTION','O intervalo deve respeitar caracteres completos.');
 ensure(target.prefix===chars.slice(Math.max(0,start-32),start).join('')&&target.suffix===chars.slice(end,end+32).join(''),'INVALID_SELECTION','O contexto adjacente não corresponde a esta versão.');
 return segment;
}
function unionCovers(ref:any,refs:any[]){
 let at=ref.start;for(const r of refs.filter(r=>r.source_id===ref.source_id&&r.element_id===ref.element_id).sort((a,b)=>a.start-b.start)){if(r.start>at)break;if(r.end>at)at=r.end;}
 return at>=ref.end;
}
export function assessPassage(p:Passage,sources:any[],language:string){
 ensure(new Set(p.refs.map(r=>r.element_id)).size===p.refs.length,'INVALID_ALIGNMENT','Cada elemento aparece uma vez no intervalo original da passagem.');
 for(const r of p.refs)sourceElement(sources,r);
 ensure(new Set(p.segments.map(s=>s.id)).size===p.segments.length,'INVALID_ALIGNMENT','Os segmentos precisam de identidades distintas.');
 for(const s of p.segments){ensure(s.language===language,'INVALID_LANGUAGE','O segmento deve usar o idioma configurado.');for(const r of s.refs)ensure(p.refs.some(parent=>contains(parent,r)),'INVALID_ALIGNMENT','O alinhamento precisa pertencer ao intervalo original desta passagem.');}
 for(const kind of ['facilitated','translation']){
  const needed=kind==='facilitated'||p.refs.some(r=>sourceElement(sources,r).source.metadata.original_language.split('-')[0]!==language.split('-')[0]);
  if(needed)for(const r of p.refs)ensure(unionCovers(r,p.segments.filter(s=>s.representation===kind).flatMap(s=>s.refs)),'INCOMPLETE_ALIGNMENT','Prepare as representações de toda a passagem, sem transferir índices entre idiomas.');
 }
 const findings:any[]=[];
 const completeOriginal=p.refs.map(r=>sourceElement(sources,r).text).join('\n\n');
 for(const claim of p.review.claims){
  if(claim.source_quote&&!completeOriginal.includes(claim.source_quote))findings.push({code:'QUOTE_NOT_IN_PASSAGE',detail:'O excerto declarado não corresponde ao original desta passagem.',severity:'problem'});
  if(claim.status==='documented')ensure(claim.evidence_ids.length>0&&claim.evidence_ids.every(id=>p.evidence.some(e=>e.id===id&&e.kind==='documented')),'MISSING_EVIDENCE','Atribuição documentada exige evidências consultadas disponíveis nesta passagem.');
 }
 for(const s of p.segments){
  const text=s.refs.map(r=>sourceElement(sources,r).text).join('\n\n'),langs=new Set(s.refs.map(r=>sourceElement(sources,r).source.metadata.original_language));
  const localReview={...p.review,claims:p.review.claims.filter(claim=>!claim.source_quote||text.includes(claim.source_quote))};
  const result=editorialAssessment(text,s.text,s.representation==='facilitated'?'rewrite':'translation',localReview,langs.size===1?[...langs][0] as string:'und',language);
  findings.push(...result.findings);
 }
 for(const e of p.evidence)ensure(e.kind!=='documented'||e.consulted_at&&e.excerpt.trim()&&e.locator.trim(),'MISSING_EVIDENCE','Uma fonte documentada exige data, trecho consultado e localizador.');
 for(const s of p.supports){
  checkSelection(p,sources,s.target);ensure(s.evidence_ids.every(id=>p.evidence.some(e=>e.id===id)),'MISSING_EVIDENCE','O apoio referencia evidência indisponível.');
  if(s.nature==='documented')ensure(s.evidence_ids.some(id=>p.evidence.find(e=>e.id===id)?.kind==='documented')&&s.attribution&&s.limits,'MISSING_EVIDENCE','Interpretação documentada exige fonte consultada, atribuição e limites.');
  if(s.kind==='correction')ensure(s.original_claim&&s.corrected_claim&&s.evaluated_at&&s.limits&&s.evidence_ids.length,'MISSING_EVIDENCE','Correção deve distinguir afirmação original, formulação corrigida, evidência, data e limites.');
 }
 for(const a of p.activities){ensure(a.answer.trim()&&a.feedback.trim(),'INVALID_ACTIVITY','A atividade precisa de resposta de referência e devolutiva.');if(a.kind==='open')ensure(a.criteria.trim(),'INVALID_ACTIVITY','Resposta aberta exige critérios para autoavaliação.');if(a.kind==='choice')ensure(a.options.includes(a.answer),'INVALID_ACTIVITY','A resposta deve pertencer às opções.');}
 return {ready:findings.length===0,findings,verification:'Confrontação declarada e verificações estruturais não comprovam fidelidade perfeita nem revisão acadêmica humana.'};
}
export function editionCoverage(passages:Passage[],sources:any[]){
 const missing:any[]=[],overlap:any[]=[];let total=0,covered=0;
 const ranges=new Map<string,Passage['refs']>();
 for(const p of passages)for(const ref of p.refs){const key=`${ref.source_id}:${ref.element_id}`,list=ranges.get(key)||[];list.push(ref);ranges.set(key,list);}
 for(const s of sources)for(const b of s.blocks.filter(readingKinds)){
  const length=points(b.text).length;total+=length;let at=0;
  for(const r of (ranges.get(`${s.id}:${b.id}`)||[]).sort((a,b)=>a.start-b.start)){
   if(r.start<at)overlap.push(r);if(r.start>at)missing.push({source_id:s.id,element_id:b.id,start:at,end:r.start});covered+=Math.max(0,r.end-Math.max(at,r.start));at=Math.max(at,r.end);
  }
  if(at<length)missing.push({source_id:s.id,element_id:b.id,start:at,end:length});
 }
 return {total,covered,complete:missing.length===0&&overlap.length===0&&total>0,missing,overlap,meaning:'Cobertura de texto canônico, não compreensão nem fidelidade intelectual.'};
}
export function activityFeedback(activity:Passage['activities'][number],answer:string,self?:string){
 const normalize=(s:string)=>s.trim().toLocaleLowerCase().normalize('NFC');
 return {mode:activity.kind==='open'?'self_assessment':'exact_reference',correct:activity.kind==='open'?null:normalize(answer)===normalize(activity.answer),answer:activity.answer,feedback:activity.feedback,criteria:activity.criteria,self_assessment:self||null,generative_call:false};
}
