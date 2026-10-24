import { createHash,randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { schemas,readTools,refSchema,blockSchema,language,type ToolName,type Ref } from './contracts.ts';
import { transaction,type Identity } from './db.ts';
import { AppError,ensure } from './errors.ts';
import { cp,portion,sameRef,mergeIntervals,validateRef,type Element } from './anchors.ts';
import { config } from './config.ts';
import { guidance,guidanceVersion } from './guidance.ts';
import { extract } from './importers.ts';
import {memberElement,ownEvidence,ownPerspective,prepareStudy} from './study/context.ts';
import {dispatchStudy} from './study/service.ts';
import {restoreBackup} from './study/backup.ts';
import {withdrawEvidence} from './study/evidence.ts';

const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const paging=(offset:number,limit:number,total:number)=>({offset,limit,total,next_offset:offset+limit<total?offset+limit:null});
const json=(v:unknown)=>JSON.stringify(v);
function legacyHash(name:string,a:any,input:any){
 const added:Record<string,string[]>={mediation_save:['context_id','representation','alignment','evidence_ids','dependencies','supersedes'],note_save:['selected','notebook_id','declared_author','related_mediation_id','evidence_ids','supersedes']};
 const keys=added[name];if(!keys||keys.some(k=>Object.hasOwn(input||{},k)))return null;
 const old={...a};for(const key of keys)delete old[key];return hash(name+json(old));
}
export const sections=['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts','reading_segments','references','perspectives','contexts','connections'] as const;
async function one(c:PoolClient,sql:string,args:unknown[]=[]){return (await c.query(sql,args)).rows[0];}
async function preferences(c:PoolClient){return await one(c,'select * from araread.preferences')||{language:'pt-BR',portion_size:'medium',revision:0};}
async function reading(c:PoolClient,id:string,lock=false){const r=await one(c,`select * from araread.readings where id=$1${lock?' for update':''}`,[id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);return r;}
async function element(c:PoolClient,ref:Ref,readingId:string){return memberElement(c,readingId,ref);}
async function quota(c:PoolClient,additional:number){
 const usage=await one(c,`select coalesce((select sum(octet_length(original)) from araread.sources),0)+coalesce((select sum(octet_length(text)) from araread.elements),0)+coalesce((select sum(octet_length(rewrite)+octet_length(additions::text)+octet_length(study_selection::text)+octet_length(provenance::text)) from araread.mediations),0)+coalesce((select sum(octet_length(text)+octet_length(attribution::text)) from araread.notes),0)+coalesce((select sum(octet_length(definition)+octet_length(details::text)) from araread.terms),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread."references" t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.perspectives t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.contexts t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.connections t),0) as bytes`);
  ensure(Number(usage.bytes)+additional<=config.maxAccountBytes,'QUOTA',`A biblioteca atingiu a cota de ${config.maxAccountBytes/1024/1024} MiB. Exporte e remova material explicitamente antes de importar mais.`,413);
 return Number(usage.bytes);
}
async function receiptResult(c:PoolClient,result:any){
 if(!result.context_receipt_only)return result;
 const stored=await one(c,'select * from araread.contexts where id=$1',[result.context_id]);
 if(!stored)return {operation_id:result.operation_id,status:'confirmed',reading_id:result.reading_id,revision:result.revision,privacy_redacted:true,message:'O contexto foi excluído com sua memória derivada; o recibo conserva somente a confirmação.'};
 const materials:any={};for(const key of ['notes','terms','references'])materials[key]=(await c.query(`select * from araread."${key}" where id=any($1::uuid[]) order by array_position($1::uuid[],id)`,[(stored.materials[key]||[]).map((x:any)=>x.id)])).rows;
 materials.perspective=stored.materials.perspective?await ownPerspective(c,stored.materials.perspective.id,stored.reading_id):null;
 const e=await memberElement(c,stored.reading_id,stored.ref),{context_receipt_only,...rest}=result;
 return {...rest,materials,original:cp(e.text).slice(stored.ref.start,stored.ref.end).join('')};
}
async function neighbor(c:PoolClient,e:Element,ref:Ref,size:string,direction:'next'|'previous',readingId:string):Promise<Ref|null>{
 if(direction==='next'&&ref.end<cp(e.text).length)return portion(e,ref.end,size);
 if(direction==='previous'&&ref.start>0){let cur=portion(e,0,size),prev=cur;while(cur.end<ref.start){prev=cur;cur=portion(e,cur.end,size);}return cur.end===ref.start?cur:prev;}
 const sort=direction==='next'?'asc':'desc',op=direction==='next'?'>':'<';
 const n=await one(c,`select n.* from araread.elements n join araread.reading_segments g on g.source_id=n.source_id join araread.reading_segments prev on prev.reading_id=g.reading_id and prev.source_id=$1 where g.reading_id=$3 and (g.ordinal,n.ordinal) ${op} (prev.ordinal,$2) order by g.ordinal ${sort},n.ordinal ${sort} limit 1`,[e.source_id,e.ordinal,readingId]);
 if(!n)return null;
 let p=portion(n,0,size);if(direction==='previous')while(p.end<cp(n.text).length)p=portion(n,p.end,size);
 return p;
}

export async function execute(name:ToolName,input:unknown,identity:Identity):Promise<any>{
 ensure(Object.hasOwn(schemas,name),'TOOL_NOT_FOUND','Operação inexistente.',404);const schema=schemas[name];
 const parsed=schema.safeParse(input);if(!parsed.success)throw new AppError('VALIDATION','Confira os campos da operação.',400,parsed.error.issues.map(x=>({path:x.path,message:x.message})));
 const a:any=parsed.data,write=!readTools.has(name);
 for(const key of ['language','original_language'])if(typeof a[key]==='string')a[key]=Intl.getCanonicalLocales(a[key])[0];
 ensure(!write||identity.permissions==='write','FORBIDDEN','Esta conexão tem permissão apenas de leitura.',403);
 return transaction(identity,async c=>{
  ensure((await one(c,'select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).active,'SESSION_REVOKED','A sessão expirou ou foi revogada. Entre novamente.',401);
  if(write){
   await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[identity.id]);
   const previous=await one(c,'select * from araread.receipts where operation_id=$1',[a.operation_id]);
   if(previous){ensure(previous.request_hash===hash(name+json(a))||previous.request_hash===legacyHash(name,a,input),'IDEMPOTENCY_MISMATCH','Essa identidade de operação já foi usada para outra intenção.',409);return receiptResult(c,previous.result);}
   if(name!=='work_delete'&&name!=='data_restore'&&!(name==='note_manage'&&a.action==='delete'))await quota(c,Buffer.byteLength(json(a)));
  }
  let r:any;
  if(write&&'reading_id'in a&&a.reading_id){r=await reading(c,a.reading_id,true);ensure(r.revision===a.expected_revision,'CONFLICT','Outra sessão alterou esta leitura. Recarregue e confira sua intenção.',409);}
  const result=await dispatch(name,a,identity,c,r);
  if(!write)return result;
  const receipt={...result,operation_id:a.operation_id,status:'confirmed'};
  const storedReceipt=name==='context_prepare'?{...receipt,materials:undefined,original:undefined,context_receipt_only:true}:receipt;
  await c.query('insert into araread.receipts(owner_id,operation_id,request_hash,result) values($1,$2,$3,$4)',[identity.id,a.operation_id,hash(name+json(a)),json(storedReceipt)]);
  await c.query('insert into araread.export_clock(owner_id,generation) values($1,1) on conflict(owner_id) do update set generation=araread.export_clock.generation+1',[identity.id]);
  return receipt;
 });
}

async function dispatch(name:ToolName,a:any,identity:Identity,c:PoolClient,r?:any):Promise<any>{
 const uid=identity.id;
 const studyResult=await dispatchStudy(name,a,uid,c,r,n=>quota(c,n));if(studyResult!==undefined)return studyResult;
 if(name==='assistant_guidance')return {version:guidanceVersion,instructions:guidance};
 if(name==='account_context')return {account:{id:uid},preferences:await preferences(c),guidance_version:guidanceVersion,capabilities:{model_key_required:false,formats:['text','markdown','html','pdf','url','structured'],ocr:false,max_import_bytes:config.maxBytes,max_account_bytes:config.maxAccountBytes,used_bytes:await quota(c,0),mcp_protocol:'2026-07-28',max_context_support_bytes:65536,quota_basis:'Conteúdo lógico antes da compressão; não equivale ao disco PostgreSQL nem inclui todos os índices/recibos.',offline:'Até 12 porções/2 MiB preparadas e 40 alterações/1 MiB em fila local, com confirmação posterior e conflitos explícitos.'}};
 if(name==='library_list'){
  const filter=`from araread.readings r join araread.sources s on s.id=r.source_id join araread.works w on w.id=s.work_id where w.title ilike $1 or w.author ilike $1`;
  const total=Number((await one(c,`select count(*) ${filter}`,[`%${a.query}%`])).count);
  const pref=await preferences(c);
  const items=(await c.query(`select r.id as reading_id,r.source_id,s.work_id,w.title,w.author,s.edition,s.original_language,coalesce(r.language,$4) as language,r.revision,r.resume,r.opened,(select ss.partial from araread.reading_segments g join araread.sources ss on ss.id=g.source_id where g.reading_id=r.id order by g.ordinal desc limit 1) as partial,r.available_end ${filter} order by r.created_at desc,r.id limit $2 offset $3`,[`%${a.query}%`,a.limit,a.offset,pref.language])).rows;
  return {items,pagination:paging(a.offset,a.limit,total)};
 }
 if(name==='source_import'){
  const x=await extract(a);ensure(x.blocks.length>0,'EMPTY_SOURCE','Nenhum elemento foi extraído.');
  ensure(x.original.length<=config.maxBytes,'TOO_LARGE','O original excede 8 MiB.',413);
  ensure(x.blocks.length<=20000,'TOO_MANY_ELEMENTS','Limite de 20 mil elementos por fonte.');
  await quota(c,x.original.length+x.blocks.reduce((n,b)=>n+Buffer.byteLength(b.text),0));
  const workId=a.work_id||randomUUID(),sourceId=randomUUID(),readingId=randomUUID();
  if(a.work_id)ensure(await one(c,'select id from araread.works where id=$1',[workId]),'NOT_FOUND','Obra não encontrada.',404);
  else await c.query('insert into araread.works(id,owner_id,title,author) values($1,$2,$3,$4)',[workId,uid,a.title,a.author]);
  if(a.derives_from)ensure(await one(c,'select id from araread.sources where id=$1 and work_id=$2',[a.derives_from,workId]),'INVALID_VERSION','A transcrição corrigida precisa apontar para uma versão da mesma obra.');
  await c.query('insert into araread.sources(id,owner_id,work_id,edition,original_language,partial,genres,origin,sha256,original,mime,filename,warnings,derives_from) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[sourceId,uid,workId,a.edition,a.original_language,a.partial,json(a.genres),a.url||'user_provided',hash(x.original),x.original,x.mime,x.filename,json(x.warnings),a.derives_from||null]);
  const elements=x.blocks.map((b,i)=>({id:randomUUID(),owner_id:uid,source_id:sourceId,ordinal:i,kind:b.kind,text:b.text,locator:b.locator||`elemento ${i+1}`,meta:b.meta}));
  await c.query(`insert into araread.elements select * from jsonb_to_recordset($1::jsonb) as x(id uuid,owner_id uuid,source_id uuid,ordinal integer,kind text,text text,locator text,meta jsonb)`,[json(elements)]);
  const first=portion(elements[0]);
  await c.query('insert into araread.readings(id,owner_id,source_id,opened,resume) values($1,$2,$3,$4,$4)',[readingId,uid,sourceId,json(first)]);
  await c.query('insert into araread.reading_segments(id,owner_id,reading_id,source_id,ordinal) values($1,$2,$3,$4,0)',[randomUUID(),uid,readingId,sourceId]);
  return {work_id:workId,source_id:sourceId,reading_id:readingId,revision:0,ref:first,warnings:x.warnings};
 }
 if(name==='reading_context'){
  r=await reading(c,a.reading_id);const pref=await preferences(c),lang=a.language||r.language||pref.language,size=a.size||r.portion_size||pref.portion_size;
  const storedRef=a.ref||r[a.position],e=await element(c,storedRef,r.id),ref=a.ref?storedRef:portion(e,storedRef.start,size);
  const source=await one(c,'select id,work_id,edition,original_language,partial,warnings,mime,filename,sha256,genres,origin,captured_at,derives_from from araread.sources where id=$1',[ref.source_id]);
  const work=await one(c,'select id,title,author from araread.works where id=$1',[source.work_id]);
  const values=[r.id,ref.element_id,ref.start,ref.end,lang];
  const study=await prepareStudy(c,r,ref,lang,a.selection);
  const variants=(await c.query('select * from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5 order by created_at desc,id desc limit 30',values)).rows;
  const matches=(m:any)=>m.representation===study.selection.representation&&(m.study_selection?.support_mode||'standard')===study.selection.support_mode&&(m.study_selection?.perspective_id||null)===(study.selection.perspective_id||null);
  const mediation=(a.variant_id?await one(c,'select * from araread.mediations where id=$1 and reading_id=$2 and element_id=$3 and start_offset=$4 and end_offset=$5 and language=$6',[a.variant_id,...values]):variants.find(m=>matches(m)&&m.context_signature===study.signature)||variants.find(matches))||null;
  ensure(!a.variant_id||mediation,'NOT_FOUND','Variante não encontrada nesta porção/idioma.',404);
  const other=(await c.query('select distinct language from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4',values.slice(0,4))).rows;
  const next=await neighbor(c,e,ref,size,'next',r.id),previous=await neighbor(c,e,ref,size,'previous',r.id);
  return {work,source,reading:r,ref,element:{id:e.id,kind:e.kind,locator:e.locator,meta:e.meta,ordinal:e.ordinal},original:cp(e.text).slice(ref.start,ref.end).join(''),mediation,other_languages:other.map(x=>x.language),effective_language:lang,
   next_ref:next,previous_ref:previous,study:{selection:study.selection,signature:study.signature,materials:study.materials,gaps:study.gaps,variants:variants.map(m=>({id:m.id,language:m.language,representation:m.representation,study_selection:m.study_selection,context_id:m.context_id,context_signature:m.context_signature,status:m.status,created_at:m.created_at,provenance:m.provenance,context_recorded:!!m.context_id})),stale:!!mediation?.context_id&&mediation.context_signature!==study.signature,legacy_context_unknown:!!mediation&&!mediation.context_id},
   terms:(await c.query('select * from araread.terms where reading_id=$1 and language=$2 and element_id=$3 order by created_at desc limit 25',[r.id,lang,e.id])).rows,
   notes:(await c.query('select * from araread.notes where reading_id=$1 and element_id=$2 and not pending_link order by created_at desc limit 25',[r.id,e.id])).rows,
   pending_questions:(await c.query("select n.* from araread.notes n where n.reading_id=$1 and n.kind='question' and not n.resolved and not exists(select 1 from araread.notes answer where answer.reply_to=n.id and answer.kind='answer') order by n.created_at limit 15",[r.id])).rows,
   ...(next?{}:{end_message:source.partial?'Fim do material disponível. Forneça a próxima passagem; a obra foi importada parcialmente.':'Fim desta versão da fonte. Isso não comprova leitura nem compreensão de todos os intervalos.'})};
 }
 if(name==='source_elements'){
  r=await reading(c,a.reading_id);const pref=await preferences(c),size=r.portion_size||pref.portion_size;
  const items=(await c.query('select e.*,g.ordinal segment_ordinal from araread.elements e join araread.reading_segments g on g.source_id=e.source_id where g.reading_id=$1 order by g.ordinal,e.ordinal limit $2 offset $3',[r.id,a.limit,a.offset])).rows;
  return {reading_id:r.id,source_id:r.source_id,revision:r.revision,items:items.map(e=>({id:e.id,kind:e.kind,locator:e.locator,ordinal:e.ordinal,segment_ordinal:e.segment_ordinal,preview:cp(e.text).slice(0,160).join(''),ref:portion(e,0,size)})),pagination:paging(a.offset,a.limit,Number((await one(c,'select count(*) from araread.elements e join araread.reading_segments g on g.source_id=e.source_id where g.reading_id=$1',[r.id])).count))};
 }
 if(name==='reading_history'){
  r=await reading(c,a.reading_id);
  const items=(await c.query(`select * from araread.${a.kind} where reading_id=$1 order by created_at desc,id desc limit $2 offset $3`,[r.id,a.limit,a.offset])).rows;
  return {reading_id:r.id,source_id:r.source_id,revision:r.revision,items,pagination:paging(a.offset,a.limit,Number((await one(c,`select count(*) from araread.${a.kind} where reading_id=$1`,[r.id])).count))};
 }
 if(name==='operation_get'){
  const receipt=await one(c,'select result from araread.receipts where operation_id=$1',[a.operation_id]);
  return receipt?receiptResult(c,receipt.result):{operation_id:a.operation_id,status:'unknown',message:'Recibo não encontrado nesta conta. Consulte novamente ou repita a mesma intenção com a mesma chave.'};
 }
 if(name==='preferences_set'){
  if(r){if(a.study?.perspective_id)await ownPerspective(c,a.study.perspective_id,r.id);await c.query('update araread.readings set language=case when $2 then $3 else language end,portion_size=coalesce($4,portion_size),study=study||$5::jsonb,revision=revision+1 where id=$1',[r.id,a.language!==undefined,a.language||null,a.portion_size||null,json(a.study||{})]);return {reading_id:r.id,revision:r.revision+1};}
  const pref=await preferences(c);ensure(pref.revision===a.expected_revision,'CONFLICT','Preferências alteradas em outra sessão. Recarregue.',409);ensure(a.language!==null,'VALIDATION','A conta precisa ter um idioma padrão.');
  ensure(!a.study||!a.study.perspective_id&&!a.study.note_ids&&!a.study.repertoire&&!a.study.goal,'INVALID_SCOPE','Perspectiva, notas, repertório e objetivo pertencem a uma leitura.');
  await c.query('insert into araread.preferences(owner_id,language,portion_size,revision,study) values($1,$2,$3,$4,$5) on conflict(owner_id) do update set language=excluded.language,portion_size=excluded.portion_size,revision=excluded.revision,study=araread.preferences.study||excluded.study',[uid,a.language||pref.language,a.portion_size||pref.portion_size,pref.revision+1,json(a.study||{})]);return {revision:pref.revision+1};
 }
 if(name==='mediation_save'||name==='term_save'||name==='note_save'){
  await element(c,a.ref,r.id);const pref=await preferences(c),lang=a.language||r.language||pref.language,id=randomUUID();
  await ownEvidence(c,a.evidence_ids||a.details?.evidence_ids||[]);
  const fields=[id,uid,r.id,a.ref.source_id,a.ref.element_id,a.ref.start,a.ref.end];
  if(name==='mediation_save'){
   ensure(a.additions.every((x:any)=>x.kind!=='critical_note'||x.support),'MISSING_SUPPORT','Toda nota crítica deve declarar afirmação, situação de verificação, fontes e limites.');
   for(const addition of a.additions)if(addition.support)await ownEvidence(c,addition.support.evidence_ids||[]);
   const prepared=a.context_id?await one(c,'select * from araread.contexts where id=$1 and reading_id=$2',[a.context_id,r.id]):null;
   ensure(!a.context_id||prepared&&sameRef(prepared.ref,a.ref)&&prepared.language===lang,'INVALID_CONTEXT','Contexto não corresponde à leitura, porção ou idioma.');
   ensure(a.representation==='rewrite'||prepared,'MISSING_CONTEXT','Tradução exige contexto preparado, separado da reescrita.');
   if(prepared){const current=await prepareStudy(c,r,a.ref,lang,prepared.selection);ensure(current.signature===prepared.signature,'CONTEXT_CHANGED','Notas, fontes ou seleção mudaram. Prepare novo contexto antes de gerar.',409);ensure(prepared.selection.representation===a.representation,'INVALID_CONTEXT','Representação difere do contexto preparado.');for(const key of ['provider','model'])ensure(!prepared.selection[key]||prepared.selection[key]===a.provenance[key],'INVALID_CONTEXT','Provedor/modelo declarado difere do contexto preparado.');}
   const existing=await one(c,'select id from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5 and representation=$6 and context_signature is not distinct from $7',[r.id,a.ref.element_id,a.ref.start,a.ref.end,lang,a.representation,prepared?.signature||null]);
   ensure(!existing||a.regenerate,'EXISTS','Já existe explicação nesta passagem e idioma. Recupere-a ou use regenerate explicitamente.',409);
   for(const dep of [...a.dependencies,...(a.supersedes?[a.supersedes]:[])])ensure(await one(c,'select id from araread.mediations where id=$1 and reading_id=$2',[dep,r.id]),'INVALID_RELATION','Mediação de origem indisponível.');
   if(a.supersedes){const prior=await one(c,'select * from araread.mediations where id=$1',[a.supersedes]);ensure(prior.source_id===a.ref.source_id&&prior.element_id===a.ref.element_id&&prior.start_offset===a.ref.start&&prior.end_offset===a.ref.end&&prior.language===lang&&prior.representation===a.representation,'INVALID_RELATION','Uma correção conserva porção, idioma e representação da versão anterior.');}
   const alignment=a.alignment||[a.ref];for(const ref of alignment)await element(c,ref,r.id);
   await c.query('insert into araread.mediations(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,rewrite,additions,provenance,context_id,context_signature,representation,study_selection,alignment,evidence_ids,dependencies,supersedes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',[...fields,lang,a.rewrite,json(a.additions),json(a.provenance),a.context_id||null,prepared?.signature||null,a.representation,json(prepared?.selection||{}),json(alignment),json(a.evidence_ids),json(a.dependencies),a.supersedes||null]);
  } else if(name==='term_save'){
   if(a.details?.derived_from)ensure(await one(c,'select id from araread.mediations where id=$1 and reading_id=$2',[a.details.derived_from,r.id]),'INVALID_RELATION','Mediação de origem indisponível.');
   const termEvidence=await ownEvidence(c,a.details?.evidence_ids||[]);
   ensure(!a.details?.etymology||termEvidence.some(v=>v.access==='available'&&v.consulted_at&&v.excerpt),'MISSING_EVIDENCE','Etimologia exige fonte disponível e consulta declarada; sem fonte, registre a consulta como pendente em vez de inventá-la.');
   await c.query('insert into araread.terms(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,term,definition,sense,origin,details) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[...fields,lang,a.term,a.definition,a.sense,a.origin,json(a.details||{})]);
  }
  else {
   if(a.reply_to)ensure(await one(c,'select id from araread.notes where id=$1 and reading_id=$2 and kind=$3',[a.reply_to,r.id,'question']),'INVALID_RELATION','A resposta deve apontar para uma pergunta da mesma leitura.');
   ensure(a.kind!=='answer'||a.reply_to,'INVALID_RELATION','Uma resposta precisa apontar para sua pergunta.');
   ensure(!['understood','favorite','review','doubt'].includes(a.kind)||a.origin==='user','INVALID_ORIGIN','Marcas pessoais exigem origem do usuário.');
   if(a.notebook_id)ensure((await ownPerspective(c,a.notebook_id,r.id)).kind==='notebook','INVALID_NOTEBOOK','Escolha um caderno.');
   if(a.related_mediation_id)ensure(await one(c,'select id from araread.mediations where id=$1 and reading_id=$2',[a.related_mediation_id,r.id]),'INVALID_RELATION','Mediação indisponível.');
   const previous=a.supersedes?await one(c,'select * from araread.notes where id=$1 and reading_id=$2',[a.supersedes,r.id]):null;ensure(!a.supersedes||previous,'INVALID_RELATION','Nota anterior indisponível.');
   await c.query('insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,reply_to,resolved,selected,notebook_id,declared_author,related_mediation_id,evidence_ids,supersedes,attribution) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',[...fields,a.kind,a.text,a.origin,a.reply_to||null,a.resolved,a.selected,a.notebook_id||null,a.declared_author,a.related_mediation_id||null,json(a.evidence_ids),a.supersedes||null,json(previous?.attribution?.imported?{...previous.attribution,adaptation:true,adapted_from:previous.id}:{})]);
  }
  await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
  return {reading_id:r.id,source_id:r.source_id,ref:a.ref,revision:r.revision+1,entity_id:id,...(name==='note_save'?{}:{effective_language:lang})};
 }
 if(name==='reading_move'){
  const pref=await preferences(c),size=r.portion_size||pref.portion_size;
  let ref=a.ref||r.resume,covered=r.covered,opened=r.opened,resume=r.resume,atEnd=r.available_end;
  const e=await element(c,ref,r.id);
  if(a.action==='open'){ensure(a.ref,'INVALID_REF','Informe a porção a abrir.');opened=ref;}
  if(a.action==='resume')opened=resume;
  if(a.action==='mark_read'){ensure(a.ref,'INVALID_REF','Informe exatamente o intervalo percorrido.');covered=mergeIntervals(covered,ref);}
  if(a.action==='continue'){
   ensure(a.ref,'INVALID_REF','Continuar exige confirmar a porção apresentada.');
   ensure(ref.source_id===r.resume.source_id&&ref.element_id===r.resume.element_id&&ref.start===r.resume.start,'NOT_AT_RESUME','Retome o percurso principal antes de continuar.',409);
   // Permite a preferência de tamanho mudar sem apagar âncoras; aceita só porções emitidas pelos tamanhos válidos.
   ensure(['short','medium','long'].some(s=>sameRef(portion(e,ref.start,s),ref)),'INVALID_REF','Use uma porção de continuidade emitida pelo servidor.');
   covered=mergeIntervals(covered,ref);const next=await neighbor(c,e,ref,size,'next',r.id);
   if(next){resume=next;opened=next;atEnd=false;}else{resume=ref;opened=ref;atEnd=true;}
  }
  await c.query('update araread.readings set opened=$2,resume=$3,covered=$4,available_end=$5,revision=revision+1 where id=$1',[r.id,json(opened),json(resume),json(covered),atEnd]);
  await c.query('insert into araread.events(id,owner_id,reading_id,kind,ref,revision) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,r.id,a.action,json(ref),r.revision+1]);
  return {reading_id:r.id,source_id:r.source_id,ref:opened,resume,revision:r.revision+1,available_end:atEnd};
 }
 if(name==='data_export'){
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[uid]);
  const snapshot=String((await one(c,'select generation from araread.export_clock'))?.generation||0);
  ensure(!a.snapshot||a.snapshot===snapshot,'EXPORT_CHANGED','A biblioteca mudou entre páginas. Reinicie a exportação; nenhum backup consistente foi confirmado.',409);
  const limit=a.section==='sources'&&a.include_original?1:a.limit,select=a.section==='sources'?(a.include_original?'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,encode(original,\'base64\') as original_base64,mime,filename,warnings,derives_from':'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,mime,filename,warnings,derives_from'):'*';
  const items=(await c.query(`select ${a.section==='references'?'*,consulted_at::text as consulted_at':select} from araread."${a.section}" order by ${a.section==='preferences'?'owner_id':a.section==='receipts'?'operation_id':'id'} limit $1 offset $2`,[limit,a.offset])).rows;
  return {format:'araread/2',snapshot,sections,section:a.section,items,pagination:paging(a.offset,limit,Number((await one(c,`select count(*) from araread."${a.section}"`)).count))};
 }
 if(name==='data_restore')return restoreBackup(c,uid,a.bundle,n=>quota(c,n));
 if(name==='work_delete'){
  const w=await one(c,'select title from araread.works where id=$1',[a.work_id]);ensure(w,'NOT_FOUND','Obra não encontrada.',404);ensure(w.title===a.confirm_title,'CONFIRMATION_REQUIRED','O título de confirmação não confere.');
  const references=(await c.query('select b.id from araread."references" b join araread.readings r on r.id=b.reading_id join araread.sources s on s.id=r.source_id where s.work_id=$1',[a.work_id])).rows.map(x=>x.id);await withdrawEvidence(c,references);
  // Relação entre versões é retirada apenas na exclusão explícita da obra inteira.
  await c.query('delete from araread.works where id=$1',[a.work_id]);return {work_id:a.work_id,deleted:true};
 }
 throw new AppError('TOOL_NOT_FOUND','Operação inexistente.',404);
}
