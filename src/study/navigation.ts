import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {cp,mergeIntervals,portion,passageInfo} from '../anchors.ts';
import {ensure} from '../errors.ts';
import {memberElement,one} from './context.ts';
import type {Identity} from '../db.ts';
import {resolvePreferences} from './preferences.ts';

const ref=z.object({source_id:z.uuid(),element_id:z.uuid(),start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict();
const write={reading_id:z.uuid(),expected_revision:z.number().int().nonnegative(),operation_id:z.uuid()};
export const navigationSchemas={
 reading_repair_preview:z.object({reading_id:z.uuid()}).strict(),
 reading_repair:z.object({...write,preview_token:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 reading_progress:z.object({reading_id:z.uuid()}).strict(),
 reading_outline:z.object({reading_id:z.uuid(),query:z.string().max(200).default(''),offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(50).default(30)}).strict(),
 reading_seek:z.object({...write,ref:ref.optional(),query:z.string().trim().min(1).max(200).optional()}).strict().refine(a=>Boolean(a.ref)!==Boolean(a.query),'Informe uma referência ou um assunto, não ambos.'),
 reading_map_save:z.object({...write,items:z.array(z.object({title:z.string().min(1).max(300),ref,level:z.number().int().min(1).max(8),nature:z.literal('organizational_interpretation')}).strict()).min(1).max(300),provenance:z.object({agent:z.string().min(1).max(200),limits:z.string().min(1).max(2000)}).strict()}).strict(),
};
export const navigationReadTools=['reading_progress','reading_outline','reading_repair_preview'] as const;
export const navigationDescriptions={
 reading_repair_preview:'Prévia sem escrita da recomposição do elemento aberto inteiro. Expõe escopo, revisão e token; original, retomada, notas, preferências e cobertura permanecem intactos.',
 reading_repair:'Aplica a prévia conferida, abrindo o elemento inteiro e registrando reparo de apresentação. Exige revisão e preview_token atuais. Não altera retomada, original, variantes ou cobertura; prepare representações novas neste escopo.',
 reading_progress:'Mostra cobertura real de unidades e parágrafos, posição aberta e retomada principal. Cobertura não comprova compreensão; porcentagem de fonte parcial refere-se apenas ao disponível.',
 reading_outline:'Recupera hierarquia original paginada e mapa interpretativo previamente preparado, com referências reais. query busca texto, títulos ou mapa; títulos gerados são interpretações organizacionais.',
 reading_seek:'Abre referência ou assunto inequívoco, sem cobrir lacunas nem alterar retomada principal. Depois continue da posição aberta; reading_move resume retorna ao percurso principal.',
 reading_map_save:'Guarda versão de mapa interpretativo com títulos explicitamente gerados, referências verificadas e limites. Não altera ordem, original ou progresso.',
};
const navigationOutput=z.object({reading_id:z.uuid(),revision:z.number().int().nonnegative()}).passthrough();
export const navigationOutputs={reading_repair_preview:navigationOutput,reading_repair:navigationOutput,reading_progress:navigationOutput,reading_outline:navigationOutput,reading_seek:navigationOutput,reading_map_save:navigationOutput};
export function validReadingUnit(e:any){return !['navigation','figure','unknown'].includes(e.kind)&&!['missing','uncertain'].includes(e.meta?.extraction);}
export async function dispatchNavigation(name:string,a:any,c:PoolClient,r:any,identity:Identity){
 if(!Object.hasOwn(navigationSchemas,name))return undefined;
 r??=await one(c,'select * from araread.readings where id=$1',[a.reading_id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);
 const uid=identity.id,size=(await resolvePreferences(c,r,identity)).values.portion_size;
 if(name==='reading_repair_preview'||name==='reading_repair'){
  const e=await memberElement(c,r.id,r.opened),target={...r.opened,start:0,end:cp(e.text).length};
  const passage=passageInfo(e,target,size);
  const token=createHash('sha256').update(JSON.stringify({policy:passage.policy,reading:r.id,revision:r.revision,opened:r.opened,resume:r.resume,covered:r.covered,target})).digest('hex');
  const result={reading_id:r.id,revision:r.revision,previous_ref:r.opened,target_ref:target,preview_token:token,passage,preserved:['original','resume','coverage','notes','mediations','preferences'],notice:'Recompõe somente a apresentação. Prepare novas representações do elemento completo; variantes anteriores continuam no histórico.'};
  if(name==='reading_repair_preview')return result;
  ensure(a.preview_token===token,'PREVIEW_CHANGED','A prévia mudou. Consulte novamente antes de recompor.',409);
  await c.query('update araread.readings set opened=$2,revision=revision+1 where id=$1',[r.id,JSON.stringify(target)]);
  await c.query('insert into araread.events(id,owner_id,reading_id,kind,ref,revision) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,r.id,'presentation_repair',JSON.stringify(target),r.revision+1]);
  return {...result,revision:r.revision+1,coverage_changed:false};
 }
 const all=(await c.query('select e.*,g.ordinal segment_ordinal from araread.elements e join araread.reading_segments g on g.source_id=e.source_id where g.reading_id=$1 order by g.ordinal,e.ordinal',[r.id])).rows;
 const locate=(v:any)=>{const e=all.find(e=>e.id===v.element_id);return {ref:v,label:e?.locator||'Passagem',page:e?.meta?.page??null,ordinal:e?all.indexOf(e)+1:null};};
 if(name==='reading_progress'){
  const units=all.filter(validReadingUnit),coverage=new Map<string,number>();
  for(const e of units){const refs=r.covered.filter((v:any)=>v.element_id===e.id),merged=refs.reduce((a:any[],v:any)=>mergeIntervals(a,v),[]);coverage.set(e.id,Math.min(cp(e.text).length,merged.reduce((n:number,v:any)=>n+v.end-v.start,0)));}
  const total=units.reduce((n,e)=>n+cp(e.text).length,0),covered=[...coverage.values()].reduce((n,v)=>n+v,0),paragraphs=units.filter(e=>['paragraph','quote','list','note','verse'].includes(e.kind)),complete=(e:any)=>coverage.get(e.id)===cp(e.text).length;
  const partial=(await one(c,'select s.partial from araread.sources s join araread.reading_segments g on g.source_id=s.id where g.reading_id=$1 order by g.ordinal desc limit 1',[r.id])).partial||all.some(e=>e.meta?.extraction==='missing');
  return {reading_id:r.id,revision:r.revision,opened:locate(r.opened),resume:locate(r.resume),units:{total:units.length,covered:units.filter(complete).length},paragraphs:{total:paragraphs.length,remaining:paragraphs.filter(e=>!complete(e)).length},characters:{total,covered},percent:total?Math.round(covered/total*10000)/100:0,partial,scope:partial?'available_content':'edition',gaps:all.filter(e=>e.meta?.extraction==='missing').map(e=>e.locator),notice:'Percorrido não comprova compreensão. Abrir uma passagem não cobre anteriores.'};
 }
 if(name==='reading_outline'){
  const map=await one(c,'select id,version,items,provenance from araread.reading_maps where reading_id=$1 order by version desc limit 1',[r.id]),query=a.query.toLocaleLowerCase();
  const hierarchy:{title:string;level:number;ref:any}[]=[];
  const items=all.map(e=>{const p=portion(e,0,size),level=e.kind==='heading'?Number(e.meta?.level||1):null;if(level){while(hierarchy.at(-1)&&hierarchy.at(-1)!.level>=level)hierarchy.pop();hierarchy.push({title:e.text,level,ref:p});}return {title:e.kind==='heading'?e.text:cp(e.text).slice(0,120).join(''),nature:'source',kind:e.kind,level:level||((hierarchy.at(-1)?.level||0)+1),parents:hierarchy.filter(v=>v.ref.element_id!==e.id),ref:p,locator:e.locator,page:e.meta?.page??null,valid_unit:validReadingUnit(e)};}).filter(e=>!query||e.title.toLocaleLowerCase().includes(query)||all.find(v=>v.id===e.ref.element_id).text.toLocaleLowerCase().includes(query));
  return {reading_id:r.id,revision:r.revision,items:items.slice(a.offset,a.offset+a.limit),map:map?{...map,items:map.items.filter((i:any)=>!query||i.title.toLocaleLowerCase().includes(query))}:null,pagination:{offset:a.offset,limit:a.limit,total:items.length,next_offset:a.offset+a.limit<items.length?a.offset+a.limit:null}};
 }
 if(name==='reading_seek'){
  let target=a.ref;
  if(!target){const hits=all.filter(e=>validReadingUnit(e)&&e.text.toLocaleLowerCase().includes(a.query.toLocaleLowerCase()));ensure(hits.length===1,'AMBIGUOUS_LOCATION',hits.length?'Há várias passagens com esse assunto. Consulte o mapa e escolha uma referência.':'Esse assunto não foi localizado no texto disponível. Consulte o mapa.',409);target=portion(hits[0],0,size);}
  await memberElement(c,r.id,target);
  await c.query('update araread.readings set opened=$2,revision=revision+1 where id=$1',[r.id,JSON.stringify(target)]);
  await c.query('insert into araread.events(id,owner_id,reading_id,kind,ref,revision) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,r.id,'seek',JSON.stringify(target),r.revision+1]);
  return {reading_id:r.id,revision:r.revision+1,opened:target,resume:r.resume,coverage_changed:false};
 }
 for(const item of a.items)await memberElement(c,r.id,item.ref);
 const version=Number((await one(c,'select coalesce(max(version),0)+1 n from araread.reading_maps where reading_id=$1',[r.id])).n),id=randomUUID();
 await c.query('insert into araread.reading_maps(id,owner_id,reading_id,version,items,provenance) values($1,$2,$3,$4,$5,$6)',[id,uid,r.id,version,JSON.stringify(a.items),JSON.stringify(a.provenance)]);
 await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
 return {reading_id:r.id,revision:r.revision+1,map_id:id,version,original_changed:false};
}
