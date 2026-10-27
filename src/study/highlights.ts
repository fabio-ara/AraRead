import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {highlightTarget} from './selection-schema.ts';
export {highlightTarget} from './selection-schema.ts';
import type {PoolClient} from 'pg';
import {cp,sameRef} from '../anchors.ts';
import {AppError,ensure} from '../errors.ts';
import {memberElement,one} from './context.ts';

const ref=z.object({source_id:z.uuid(),element_id:z.uuid(),start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict();
const write={operation_id:z.uuid(),reading_id:z.uuid(),expected_revision:z.number().int().nonnegative()};
export const highlightSchemas={
 highlight_save:z.object({...write,ref,target:highlightTarget}).strict(),
 highlight_remove:z.object({...write,highlight_id:z.uuid()}).strict(),
 highlight_list:z.object({reading_id:z.uuid(),ref:ref.optional(),offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(50).default(30)}).strict(),
};
export const highlightReadTools=['highlight_list'] as const;
export const highlightDescriptions={
 highlight_save:'Guarda grifo por ação do leitor. Original usa pontos de código do elemento; tradução/explicação usam offsets próprios na versão mediation_id e segmento main/addition:N. Citação e contexto devem conferir. Não avança.',
 highlight_remove:'Remove somente o grifo escolhido. Preserva notas, versões, original e cobertura. Exige revisão, sessão e recibo.',
 highlight_list:'Consulta grifos persistidos, inclusive versões antigas e órfãs, sem reancorar por semelhança. ref filtra o elemento da passagem; paginação inclui todas as representações.',
};
const out=z.object({reading_id:z.uuid(),revision:z.number().int().nonnegative()}).passthrough();
export const highlightOutputs={highlight_save:out,highlight_remove:out,highlight_list:out};
export function quoteSelector(text:string,start:number,end:number){const chars=cp(text);return {start,end,exact:chars.slice(start,end).join(''),prefix:chars.slice(Math.max(0,start-32),start).join(''),suffix:chars.slice(end,end+32).join('')};}
export function checkSelector(text:string,target:any){
 const chars=cp(text);ensure(target.end>target.start&&target.end<=chars.length&&target.end-target.start<=4000,'INVALID_ANCHOR','Selecione de 1 a 4.000 pontos de código dentro deste texto.');
 const expected=quoteSelector(text,target.start,target.end);
 ensure(['exact','prefix','suffix'].every(k=>target[k]===expected[k as keyof typeof expected]),'ANCHOR_MISMATCH','Texto ou contexto da seleção não coincide com esta versão. Selecione novamente; nenhum vínculo foi aproximado.');
 const boundaries=new Set([0]);let offset=0;for(const item of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)){offset+=cp(item.segment).length;boundaries.add(offset);}
 ensure(boundaries.has(target.start)&&boundaries.has(target.end),'INVALID_ANCHOR','A seleção interrompe um caractere composto. Selecione o grafema inteiro.');
}
export async function targetText(c:PoolClient,readingId:string,at:any,target:any){
 const e=await memberElement(c,readingId,at);
 if(target.representation==='original'){
  ensure(!target.mediation_id&&target.segment==='main'&&target.start>=at.start&&target.end<=at.end,'INVALID_ANCHOR','O grifo original deve pertencer à passagem canônica.');return e.text;
 }
 ensure(target.mediation_id,'INVALID_ANCHOR','Uma representação exige a versão da mediação.');
 const m=await one(c,'select * from araread.mediations where id=$1 and reading_id=$2',[target.mediation_id,readingId]);
 ensure(m&&m.representation===target.representation&&sameRef(at,{source_id:m.source_id,element_id:m.element_id,start:m.start_offset,end:m.end_offset}),'INVALID_ANCHOR','Mediação fora da leitura, referência ou representação.');
 const text=target.segment==='main'?m.rewrite:m.additions[Number(target.segment.split(':')[1])]?.text;
 ensure(typeof text==='string','INVALID_ANCHOR','Segmento ausente nesta versão.');return text as string;
}
export async function listHighlights(c:PoolClient,readingId:string,at?:any,offset=0,limit=30){
 if(at)await memberElement(c,readingId,at);
 const where="reading_id=$1 and kind='highlight' and ($2::uuid is null or element_id=$2)",args=[readingId,at?.element_id||null];
 const rows=(await c.query(`select * from araread.notes where ${where} order by created_at,id limit $3 offset $4`,[...args,limit,offset])).rows;
 const items=[];for(const h of rows){
  let state='anchored';const canonical={source_id:h.source_id,element_id:h.element_id,start:h.start_offset,end:h.end_offset};
  try{checkSelector(await targetText(c,readingId,canonical,h.anchor),h.anchor);if(h.anchor.mediation_id&&await one(c,'select id from araread.mediations where supersedes=$1 and reading_id=$2',[h.anchor.mediation_id,readingId]))state='version_superseded';}catch(error){if(!(error instanceof AppError)||!['INVALID_ANCHOR','ANCHOR_MISMATCH','INVALID_REF'].includes(error.code))throw error;state='orphaned';}
  items.push({id:h.id,ref:canonical,target:h.anchor,state,language:h.anchor.mediation_id?(await one(c,'select language from araread.mediations where id=$1 and reading_id=$2',[h.anchor.mediation_id,readingId]))?.language:null,created_at:h.created_at});
 }
 const total=Number((await one(c,`select count(*) from araread.notes where ${where}`,args)).count);
 return {items,pagination:{offset,limit,total,next_offset:offset+limit<total?offset+limit:null}};
}
export async function dispatchHighlights(name:string,a:any,c:PoolClient,r:any,uid:string){
 if(!Object.hasOwn(highlightSchemas,name))return undefined;
 r??=await one(c,'select * from araread.readings where id=$1',[a.reading_id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);
 if(name==='highlight_list')return {reading_id:r.id,revision:r.revision,...await listHighlights(c,r.id,a.ref,a.offset,a.limit)};
 if(name==='highlight_remove'){
  const h=await one(c,"select id from araread.notes where id=$1 and reading_id=$2 and kind='highlight'",[a.highlight_id,r.id]);ensure(h,'NOT_FOUND','Grifo não encontrado.',404);
  await c.query('delete from araread.notes where id=$1',[h.id]);await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
  return {reading_id:r.id,revision:r.revision+1,highlight_id:h.id,removed:true,notes_preserved:true};
 }
 checkSelector(await targetText(c,r.id,a.ref,a.target),a.target);
 const id=randomUUID();await c.query("insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,anchor) values($1,$2,$3,$4,$5,$6,$7,'highlight',$8,'user',$9)",[id,uid,r.id,a.ref.source_id,a.ref.element_id,a.ref.start,a.ref.end,a.target.exact,JSON.stringify(a.target)]);
 await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
 return {reading_id:r.id,revision:r.revision+1,highlight_id:id,ref:a.ref,target:a.target};
}
