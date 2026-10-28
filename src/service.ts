import {dispatchHighlights,listHighlights,checkSelector,targetText} from './study/highlights.ts';
import { createHash,randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { schemas,readTools,refSchema,blockSchema,language,type ToolName,type Ref } from './contracts.ts';
import { transaction,type Identity } from './db.ts';
import { AppError,ensure } from './errors.ts';
import { cp,portion,passageInfo,sameRef,mergeIntervals,validateRef,type Element } from './anchors.ts';
import { config } from './config.ts';
import { guidance,guidanceVersion } from './guidance.ts';
import { extract } from './importers.ts';
import {memberElement,ownEvidence,ownPerspective,prepareStudy} from './study/context.ts';
import {dispatchStudy} from './study/service.ts';
import {restoreBackup,backupSections} from './study/backup.ts';
import {withdrawEvidence} from './study/evidence.ts';
import {requireReadable} from './ingestion/quality.ts';
import {dispatchNavigation,validReadingUnit} from './study/navigation.ts';
import {dispatchPreferences,resolvePreferences} from './study/preferences.ts';
import {editorialAssessment} from './study/editorial.ts';
import {dispatchEditions} from './editions/service.ts';
import {editionBackupSections} from './editions/backup-contracts.ts';
import {exportEditionSection,editionSnapshot} from './editions/backup.ts';
import {editionDisplay} from './editions/presentation.ts';

const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const paging=(offset:number,limit:number,total:number)=>({offset,limit,total,next_offset:offset+limit<total?offset+limit:null});
const json=(v:unknown)=>JSON.stringify(v);
function legacyHash(name:string,a:any,input:any){
 const added:Record<string,string[]>={source_import:['retain_original','ocr'],preferences_set:['explicit_request','values','scope'],mediation_save:['context_id','representation','alignment','evidence_ids','dependencies','supersedes','editorial_review'],note_save:['selected','notebook_id','declared_author','related_mediation_id','evidence_ids','supersedes']};
 const keys=added[name];if(!keys||keys.some(k=>Object.hasOwn(input||{},k)))return null;
 const old=name==='preferences_set'?{operation_id:a.operation_id,reading_id:a.reading_id,expected_revision:a.expected_revision,language:a.language,portion_size:a.portion_size,study:a.study}:{...a};for(const key of keys)delete old[key];return hash(name+json(old));
}
export const sections=backupSections;
async function one(c:PoolClient,sql:string,args:unknown[]=[]){return (await c.query(sql,args)).rows[0];}
async function preferences(c:PoolClient,identity?:Identity,r?:any){const legacy=await one(c,'select * from araread.preferences')||{revision:0};return {...legacy,...(await resolvePreferences(c,r,identity)).values};}
async function reading(c:PoolClient,id:string,lock=false){const r=await one(c,`select * from araread.readings where id=$1${lock?' for update':''}`,[id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);return r;}
async function element(c:PoolClient,ref:Ref,readingId:string){return memberElement(c,readingId,ref);}
async function quota(c:PoolClient,additional:number,enforce=true){
 const usage=await one(c,`select coalesce((select sum(octet_length(original)) from araread.sources),0)+coalesce((select sum(octet_length(text)) from araread.elements),0)+coalesce((select sum(octet_length(rewrite)+octet_length(additions::text)+octet_length(study_selection::text)+octet_length(provenance::text)) from araread.mediations),0)+coalesce((select sum(octet_length(text)+octet_length(attribution::text)+coalesce(octet_length(anchor::text),0)) from araread.notes),0)+coalesce((select sum(octet_length(definition)+octet_length(details::text)) from araread.terms),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread."references" t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.perspectives t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.contexts t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.connections t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.profiles t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.preference_records t),0)+coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.reading_maps t),0)+coalesce((select sum(octet_length(extraction::text)) from araread.sources),0)+coalesce((select sum(octet_length(editorial::text)) from araread.mediations),0) as bytes`);
 const editionTables=['edition_projects','edition_passages','edition_versions','edition_settings','edition_reviews','edition_annotations','edition_readers','edition_groups','edition_comments','edition_archives'];
 const editorial=await one(c,`select (${editionTables.map(t=>`coalesce((select sum(octet_length(row_to_json(t)::text)) from araread.${t} t where owner_id=(select araread.owner())),0)`).join('+')})+coalesce((select sum(octet_length(metadata::text)+octet_length(blocks::text)+coalesce(octet_length(original),0)) from araread.edition_sources where owner_id=(select araread.owner())),0) bytes`);
 const bytes=Number(usage.bytes)+Number(editorial.bytes);
 if(enforce)ensure(bytes+additional<=config.maxAccountBytes,'QUOTA',`A biblioteca atingiu a cota de ${config.maxAccountBytes/1024/1024} MiB. Exporte e remova material explicitamente antes de importar mais.`,413);
 return bytes;
}
async function receiptResult(c:PoolClient,result:any){
 if(!result.context_receipt_only)return result;
 const stored=await one(c,'select * from araread.contexts where id=$1',[result.context_id]);
 if(!stored)return {operation_id:result.operation_id,status:'confirmed',reading_id:result.reading_id,revision:result.revision,privacy_redacted:true,message:'O contexto foi excluído com sua memória derivada; o recibo conserva somente a confirmação.'};
 const materials:any={};for(const key of ['notes','terms','references'])materials[key]=(await c.query(`select * from araread."${key}" where id=any($1::uuid[]) order by array_position($1::uuid[],id)`,[(stored.materials[key]||[]).map((x:any)=>x.id)])).rows;
 materials.perspective=stored.materials.perspective?await ownPerspective(c,stored.materials.perspective.id,stored.reading_id):null;
 materials.profile=stored.materials.profile?await one(c,'select * from araread.profiles where id=$1 and version=$2',[stored.materials.profile.id,stored.materials.profile.version]):null;
 const e=await memberElement(c,stored.reading_id,stored.ref),{context_receipt_only,...rest}=result;
 return {...rest,materials,...(stored.materials.profile&&!materials.profile?{gaps:[...(rest.gaps||[]),'O perfil registrado neste contexto foi excluído. Seu conteúdo não foi reconstruído.']}:{}),original:cp(e.text).slice(stored.ref.start,stored.ref.end).join('')};
}
async function neighbor(c:PoolClient,e:Element,ref:Ref,size:string,direction:'next'|'previous',readingId:string):Promise<Ref|null>{
 if(direction==='next'&&ref.end<cp(e.text).length)return portion(e,ref.end,size);
 if(direction==='previous'&&ref.start>0){let cur=portion(e,0,size);while(cur.end<ref.start)cur=portion(e,cur.end,size);return {...cur,end:ref.start};}
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
 const cleanup=name==='work_delete'||name==='highlight_remove'||name==='note_manage'&&a.action==='delete'||name==='edition_annotate'&&a.action==='delete'||name==='edition_publish'&&a.action==='withdraw'||name==='edition_group'&&['leave','revoke','remove_comment'].includes(a.action)||name==='edition_plan'&&a.action==='reset';
 for(const key of ['language','original_language'])if(typeof a[key]==='string')a[key]=Intl.getCanonicalLocales(a[key])[0];
 ensure(!write||identity.permissions==='write','FORBIDDEN','Esta conexão tem permissão apenas de leitura.',403);
 return transaction(identity,async c=>{
  ensure((await one(c,'select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).active,'SESSION_REVOKED','A sessão expirou ou foi revogada. Entre novamente.',401);
  if(write){
   await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[identity.id]);
   const previous=await one(c,'select * from araread.receipts where operation_id=$1',[a.operation_id]);
   if(previous){ensure(previous.request_hash===hash(name+json(a))||previous.request_hash===legacyHash(name,a,input),'IDEMPOTENCY_MISMATCH','Essa identidade de operação já foi usada para outra intenção.',409);return receiptResult(c,previous.result);}
   if(!cleanup&&!['source_import','source_append','data_restore'].includes(name))await quota(c,Buffer.byteLength(json(a)));
  }
  let r:any;
  if(write&&'reading_id'in a&&a.reading_id){r=await reading(c,a.reading_id,true);ensure(r.revision===a.expected_revision,'CONFLICT','Outra sessão alterou esta leitura. Recarregue e confira sua intenção.',409);}
  const result=await dispatch(name,a,identity,c,r);
  if(!write)return result;
  if(!cleanup&&(name==='highlight_save'||name.startsWith('edition_')))await quota(c,0);
  const receipt={...result,operation_id:a.operation_id,status:'confirmed'};
  const storedReceipt=name==='context_prepare'?{...receipt,materials:undefined,original:undefined,context_receipt_only:true}:receipt;
  await c.query('insert into araread.receipts(owner_id,operation_id,request_hash,result) values($1,$2,$3,$4)',[identity.id,a.operation_id,hash(name+json(a)),json(storedReceipt)]);
  await c.query('insert into araread.export_clock(owner_id,generation) values($1,1) on conflict(owner_id) do update set generation=araread.export_clock.generation+1',[identity.id]);
  return receipt;
 });
}

async function dispatch(name:ToolName,a:any,identity:Identity,c:PoolClient,r?:any):Promise<any>{
 const uid=identity.id;
 if(name==='reading_display'&&!a.reading_id){
  const context=await dispatchEditions('edition_context',{...a,batch_limit:1},c,identity,n=>quota(c,n));
  ensure(context?.passage?.assessment?.ready,'EDITORIAL_PENDING','Prepare e confira a passagem antes de anunciar o painel.');
  if(!context.version)context.version={id:context.project.id,title:context.project.title,version:0,state:'sample'};
  const personal=a.version_id?await dispatchEditions('edition_reader',{version_id:a.version_id},c,identity,n=>quota(c,n)):null;
  const display=editionDisplay(context,personal,!!a.version_id&&context.version.state!=='withdrawn'&&identity.permissions==='write');
  return {...display,reading:{...display.reading,owner_id:uid},reader_preferences:personal?.preferences?.values||context.config.values};
 }
 const editionResult=await dispatchEditions(name,a,c,identity,n=>quota(c,n));if(editionResult!==undefined)return editionResult;
 const highlightResult=await dispatchHighlights(name,a,c,r,uid);if(highlightResult!==undefined)return highlightResult;
 if(name==='note_manage'&&(await one(c,'select kind from araread.notes where id=$1 and reading_id=$2',[a.note_id,r.id]))?.kind==='highlight'){
  ensure(a.action==='delete','INVALID_NOTE_KIND','Use a gestão de grifos para esta marca; ela não é uma nota interpretativa.');
  return dispatchHighlights('highlight_remove',{...a,highlight_id:a.note_id},c,r,uid);
 }
 const preferenceResult=await dispatchPreferences(name,a,identity,c,r);if(preferenceResult!==undefined)return preferenceResult;
 const navigationResult=await dispatchNavigation(name,a,c,r,identity);if(navigationResult!==undefined)return navigationResult;
 const studyResult=await dispatchStudy(name,a,uid,c,r,n=>quota(c,n),identity);if(studyResult!==undefined)return studyResult;
 if(name==='assistant_guidance')return {version:guidanceVersion,instructions:guidance};
 if(name==='account_context')return {account:{id:uid},preferences:await preferences(c,identity,r),guidance_version:guidanceVersion,capabilities:{model_key_required:false,formats:['text','markdown','html','pdf','epub','docx','pptx','url','structured'],local_conversion:['doc','mobi'],ocr:'local_tesseract_preparation',storage_policy:'text_first',backup_format:'araread/4',backup_legacy_formats:['araread/1','araread/2','araread/3'],max_import_bytes:config.maxBytes,max_account_bytes:config.maxAccountBytes,used_bytes:await quota(c,0,false),mcp_protocol:'2026-07-28',max_context_support_bytes:65536,quota_basis:'Conteúdo lógico antes da compressão; não equivale ao disco PostgreSQL nem inclui todos os índices/recibos.',offline:'Edições: capítulos completos preparados até a cota local de 8 MiB (teto 16 MiB) e 80 intenções/1 MiB. Biblioteca anterior: 12 porções/2 MiB e 40 alterações/1 MiB. Confirmação por recibos; conflitos explícitos.'}};
 if(name==='library_list'){
  const filter=`from araread.readings r join araread.sources s on s.id=r.source_id join araread.works w on w.id=s.work_id where w.title ilike $1 or w.author ilike $1`;
  const total=Number((await one(c,`select count(*) ${filter}`,[`%${a.query}%`])).count);
  const pref=await preferences(c,identity,r);
  const items=(await c.query(`select row_to_json(r) preference_reading,r.id as reading_id,r.source_id,s.work_id,w.title,w.author,s.edition,s.original_language,coalesce(r.language,$4) as language,r.revision,r.resume,r.opened,(select ss.partial from araread.reading_segments g join araread.sources ss on ss.id=g.source_id where g.reading_id=r.id order by g.ordinal desc limit 1) as partial,r.available_end ${filter} order by r.created_at desc,r.id limit $2 offset $3`,[`%${a.query}%`,a.limit,a.offset,pref.language])).rows;
  for(const item of items){item.language=(await resolvePreferences(c,item.preference_reading,identity)).values.language;delete item.preference_reading;}
  return {items,pagination:paging(a.offset,a.limit,total)};
 }
 if(name==='source_preview'){const x=await extract(a);return {quality:x.quality,metadata:x.metadata,canonical_hash:x.canonical_hash,preview:x.blocks.slice(0,8),total_elements:x.blocks.length,original_bytes:x.original.length};}
 if(name==='source_import'){
  const x=await extract(a);requireReadable(x.quality);ensure(x.blocks.length>0,'EMPTY_SOURCE','Nenhum elemento foi extraído.');
  ensure(x.original.length<=config.maxBytes,'TOO_LARGE','O original excede 8 MiB.',413);
  ensure(x.blocks.length<=20000,'TOO_MANY_ELEMENTS','Limite de 20 mil elementos por fonte.');
  const retain=a.retain_original||x.quality.original_required,original=retain?x.original:null,partial=a.partial||x.quality.status==='partial';
  const duplicate=await one(c,`select s.id source_id,s.work_id,r.id reading_id,r.revision,r.opened ref,s.warnings from araread.sources s join araread.works w on w.id=s.work_id join araread.readings r on r.source_id=s.id where s.canonical_sha256=$1 and s.edition=$2 and s.original_language=$3 and w.title=$4 and w.author=$5 and s.partial=$6 and ($7::uuid is null or s.work_id=$7) and ($8::uuid is null or s.derives_from=$8) and (not $9 or s.original_available and s.sha256=$10) order by r.created_at limit 1`,[x.canonical_hash,a.edition,a.original_language,a.title,a.author,partial,a.work_id||null,a.derives_from||null,retain,hash(x.original)]);
  if(duplicate)return {...duplicate,deduplicated:true};
  await quota(c,(original?.length||0)+x.blocks.reduce((n,b)=>n+Buffer.byteLength(b.text)+Buffer.byteLength(json(b.meta)),0)+Buffer.byteLength(json(x.quality)));
  const workId=a.work_id||randomUUID(),sourceId=randomUUID(),readingId=randomUUID();
  if(a.work_id)ensure(await one(c,'select id from araread.works where id=$1',[workId]),'NOT_FOUND','Obra não encontrada.',404);
  else await c.query('insert into araread.works(id,owner_id,title,author) values($1,$2,$3,$4)',[workId,uid,a.title,a.author]);
  if(a.derives_from)ensure(await one(c,'select id from araread.sources where id=$1 and work_id=$2',[a.derives_from,workId]),'INVALID_VERSION','A transcrição corrigida precisa apontar para uma versão da mesma obra.');
  await c.query('insert into araread.sources(id,owner_id,work_id,edition,original_language,partial,genres,origin,sha256,original,mime,filename,warnings,derives_from,original_available,canonical_sha256,extraction,storage_policy) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',[sourceId,uid,workId,a.edition,a.original_language,partial,json(a.genres),a.url||'user_provided',hash(x.original),original,x.mime,x.filename,json(x.warnings),a.derives_from||null,retain,x.canonical_hash,json({quality:x.quality,metadata:x.metadata}),retain?'retained':'text']);
  const elements=x.blocks.map((b,i)=>({id:randomUUID(),owner_id:uid,source_id:sourceId,ordinal:i,kind:b.kind,text:b.text,locator:b.locator||`elemento ${i+1}`,meta:b.meta}));
  await c.query(`insert into araread.elements select * from jsonb_to_recordset($1::jsonb) as x(id uuid,owner_id uuid,source_id uuid,ordinal integer,kind text,text text,locator text,meta jsonb)`,[json(elements)]);
  const first=portion(elements.find(validReadingUnit)||elements[0]);
  await c.query('insert into araread.readings(id,owner_id,source_id,opened,resume) values($1,$2,$3,$4,$4)',[readingId,uid,sourceId,json(first)]);
  await c.query('insert into araread.reading_segments(id,owner_id,reading_id,source_id,ordinal) values($1,$2,$3,$4,0)',[randomUUID(),uid,readingId,sourceId]);
  return {work_id:workId,source_id:sourceId,reading_id:readingId,revision:0,ref:first,warnings:x.warnings,deduplicated:false,quality:x.quality,original_available:retain};
 }
 if(name==='reading_context'){
  r=await reading(c,a.reading_id);const pref=await preferences(c,identity,r),lang=a.language||pref.language,size=a.size||pref.portion_size;
  const storedRef=a.ref||r[a.position],e=await element(c,storedRef,r.id),ref=a.ref||!a.size?storedRef:portion(e,storedRef.start,size);
  const source=await one(c,'select id,work_id,edition,original_language,partial,warnings,mime,filename,sha256,genres,origin,captured_at,derives_from,original_available,canonical_sha256,extraction,storage_policy from araread.sources where id=$1',[ref.source_id]);
  const work=await one(c,'select id,title,author from araread.works where id=$1',[source.work_id]);
  const values=[r.id,ref.element_id,ref.start,ref.end,lang];
  const study=await prepareStudy(c,r,ref,lang,a.selection,identity);
  const variants=(await c.query('select * from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5 order by created_at desc,id desc limit 30',values)).rows;
  const matches=(m:any)=>m.representation===study.selection.representation&&(m.study_selection?.support_mode||'standard')===study.selection.support_mode&&(m.study_selection?.perspective_id||null)===(study.selection.perspective_id||null);
  const mediation=(a.variant_id?await one(c,'select * from araread.mediations where id=$1 and reading_id=$2 and element_id=$3 and start_offset=$4 and end_offset=$5 and language=$6',[a.variant_id,...values]):variants.find(m=>matches(m)&&m.context_signature===study.signature)||variants.find(matches))||null;
  ensure(!a.variant_id||mediation,'NOT_FOUND','Variante não encontrada nesta porção/idioma.',404);
  const other=(await c.query('select distinct language from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4',values.slice(0,4))).rows;
  const next=await neighbor(c,e,ref,size,'next',r.id),previous=await neighbor(c,e,ref,size,'previous',r.id);
  return {work,source,reading:r,ref,selection_context:{prefix:cp(e.text).slice(Math.max(0,ref.start-32),ref.start).join(''),suffix:cp(e.text).slice(ref.end,ref.end+32).join('')},passage:passageInfo(e,ref,size),element:{id:e.id,kind:e.kind,locator:e.locator,meta:e.meta,ordinal:e.ordinal},original:cp(e.text).slice(ref.start,ref.end).join(''),mediation,other_languages:other.map(x=>x.language),effective_language:lang,
   next_ref:next,previous_ref:previous,study:{selection:study.selection,signature:study.signature,materials:study.materials,gaps:study.gaps,variants:variants.map(m=>({id:m.id,language:m.language,representation:m.representation,study_selection:m.study_selection,context_id:m.context_id,context_signature:m.context_signature,status:m.status,created_at:m.created_at,provenance:m.provenance,context_recorded:!!m.context_id})),stale:!!mediation?.context_id&&mediation.context_signature!==study.signature,legacy_context_unknown:!!mediation&&!mediation.context_id},
   terms:(await c.query('select * from araread.terms where reading_id=$1 and language=$2 and element_id=$3 order by created_at desc limit 25',[r.id,lang,e.id])).rows,
   notes:(await c.query('select * from araread.notes where reading_id=$1 and element_id=$2 and not pending_link order by created_at desc limit 25',[r.id,e.id])).rows,
   pending_questions:(await c.query("select n.* from araread.notes n where n.reading_id=$1 and n.kind='question' and not n.resolved and not exists(select 1 from araread.notes answer where answer.reply_to=n.id and answer.kind='answer') order by n.created_at limit 15",[r.id])).rows,
   ...(next?{}:{end_message:source.partial?'Fim do material disponível. Forneça a próxima passagem; a obra foi importada parcialmente.':'Fim desta versão da fonte. Isso não comprova leitura nem compreensão de todos os intervalos.'})};
 }
 if(name==='reading_display'){
  const ctx=await dispatch('reading_context',{...a,position:'opened',selection:{...a.selection,representation:'rewrite'}},identity,c);
  const explanation=ctx.mediation;
  const interrupted=ctx.passage.starts_mid_unit||ctx.passage.ends_mid_unit;
  ensure(!interrupted||explanation?.editorial?.review?.continuity_acknowledged,'PREPARATION_REQUIRED','A passagem interrompe uma construção original. Recomponha o parágrafo ou confira e declare a continuidade antes de apresentar.',409);
  ensure(explanation?.context_id&&explanation.context_signature&&!ctx.study.stale&&explanation.status!=='needs_review'&&explanation.editorial?.ready_to_present,'PREPARATION_REQUIRED','Prepare e confira a leitura facilitada desta passagem antes de apresentá-la.',409);
  const sameLanguage=ctx.source.original_language.split('-')[0].toLowerCase()===ctx.effective_language.split('-')[0].toLowerCase();
  const translated=sameLanguage?null:await dispatch('reading_context',{...a,ref:ctx.ref,position:'opened',selection:{representation:'translation',support_mode:'standard',perspective_id:null,include_notes:false}},identity,c);
  ensure(sameLanguage||translated?.mediation?.context_id&&translated.mediation.context_signature&&!translated.study.stale&&translated.mediation.status!=='needs_review'&&translated.mediation.editorial?.ready_to_present,'PREPARATION_REQUIRED','Prepare e confira a tradução fiel da mesma passagem antes de apresentar o painel.',409);
  ensure(sameLanguage||!interrupted||translated.mediation.editorial?.review?.continuity_acknowledged,'PREPARATION_REQUIRED','A tradução precisa preservar e identificar a interrupção, sem completar a frase por conta própria.',409);
  const text=[explanation.rewrite,...explanation.additions.map((v:any)=>v.text)].join('\n\n');
  const segment=(body:string,representation:string,id?:string,key='main',kind='main')=>({text:body,representation,...(id?{mediation_id:id}:{}),segment:key,kind,base_offset:representation==='original'?ctx.ref.start:0,selector_prefix:representation==='original'?ctx.selection_context.prefix:'',selector_suffix:representation==='original'?ctx.selection_context.suffix:''});
  const originalSegments=[segment(ctx.original,'original')];
  const translation={id:translated?.mediation?.id,text:sameLanguage?ctx.original:translated.mediation.rewrite,status:sameLanguage?'same_language':'saved',segments:sameLanguage?originalSegments:[segment(translated.mediation.rewrite,'translation',translated.mediation.id)]};
  const facilitatedSegments=[segment(explanation.rewrite,'rewrite',explanation.id),...explanation.additions.map((v:any,i:number)=>segment(v.text,'rewrite',explanation.id,`addition:${i}`,v.kind))];
  return {ready:true,terms:ctx.terms,passage:ctx.passage,permissions:{write:identity.permissions==='write'},highlights:await listHighlights(c,ctx.reading.id,ctx.ref),work:ctx.work,source:ctx.source,reading:ctx.reading,ref:ctx.ref,element:ctx.element,original:ctx.original,effective_language:ctx.effective_language,representations:{facilitated:{id:explanation.id,text,status:explanation.status,segments:facilitatedSegments},translation,original:{text:ctx.original,segments:originalSegments}},location:{label:ctx.passage.label},fallback_text:`${ctx.work.title} · ${ctx.passage.label}\n\nLeitura facilitada\n${text}\n\nTradução${sameLanguage?' — original já no idioma de leitura':''}\n${translation.text}\n\nOriginal\n${ctx.original}`};
 }
 if(name==='source_elements'){
  r=await reading(c,a.reading_id);const pref=await preferences(c,identity,r),size=pref.portion_size;
  const items=(await c.query('select e.*,g.ordinal segment_ordinal from araread.elements e join araread.reading_segments g on g.source_id=e.source_id where g.reading_id=$1 order by g.ordinal,e.ordinal limit $2 offset $3',[r.id,a.limit,a.offset])).rows;
  return {reading_id:r.id,source_id:r.source_id,revision:r.revision,items:items.map(e=>({id:e.id,kind:e.kind,locator:e.locator,ordinal:e.ordinal,segment_ordinal:e.segment_ordinal,preview:cp(e.text).slice(0,160).join(''),ref:portion(e,0,size),full_ref:{source_id:e.source_id,element_id:e.id,start:0,end:cp(e.text).length},passage:passageInfo(e,portion(e,0,size),size)})),pagination:paging(a.offset,a.limit,Number((await one(c,'select count(*) from araread.elements e join araread.reading_segments g on g.source_id=e.source_id where g.reading_id=$1',[r.id])).count))};
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
 if(name==='mediation_save'||name==='term_save'||name==='note_save'){
  await element(c,a.ref,r.id);const pref=await preferences(c,identity,r),lang=a.language||pref.language,id=randomUUID();
  await ownEvidence(c,a.evidence_ids||a.details?.evidence_ids||[]);
  const fields=[id,uid,r.id,a.ref.source_id,a.ref.element_id,a.ref.start,a.ref.end];
  if(name==='mediation_save'){
   ensure(a.additions.every((x:any)=>x.kind!=='critical_note'||x.support),'MISSING_SUPPORT','Toda nota crítica deve declarar afirmação, situação de verificação, fontes e limites.');
   for(const addition of a.additions)if(addition.support)await ownEvidence(c,addition.support.evidence_ids||[]);
   const prepared=a.context_id?await one(c,'select * from araread.contexts where id=$1 and reading_id=$2',[a.context_id,r.id]):null;
   ensure(!a.context_id||prepared&&sameRef(prepared.ref,a.ref)&&prepared.language===lang,'INVALID_CONTEXT','Contexto não corresponde à leitura, porção ou idioma.');
   ensure(a.representation==='rewrite'||prepared,'MISSING_CONTEXT','Tradução exige contexto preparado, separado da reescrita.');
   if(prepared){const current=await prepareStudy(c,r,a.ref,lang,prepared.selection,identity);ensure(current.signature===prepared.signature,'CONTEXT_CHANGED','Notas, fontes ou seleção mudaram. Prepare novo contexto antes de gerar.',409);ensure(prepared.selection.representation===a.representation,'INVALID_CONTEXT','Representação difere do contexto preparado.');for(const key of ['provider','model'])ensure(!prepared.selection[key]||prepared.selection[key]===a.provenance[key],'INVALID_CONTEXT','Provedor/modelo declarado difere do contexto preparado.');}
   const existing=await one(c,'select id from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5 and representation=$6 and context_signature is not distinct from $7',[r.id,a.ref.element_id,a.ref.start,a.ref.end,lang,a.representation,prepared?.signature||null]);
   ensure(!existing||a.regenerate,'EXISTS','Já existe explicação nesta passagem e idioma. Recupere-a ou use regenerate explicitamente.',409);
   for(const dep of [...a.dependencies,...(a.supersedes?[a.supersedes]:[])])ensure(await one(c,'select id from araread.mediations where id=$1 and reading_id=$2',[dep,r.id]),'INVALID_RELATION','Mediação de origem indisponível.');
   if(a.supersedes){const prior=await one(c,'select * from araread.mediations where id=$1',[a.supersedes]);ensure(prior.source_id===a.ref.source_id&&prior.element_id===a.ref.element_id&&prior.start_offset===a.ref.start&&prior.end_offset===a.ref.end&&prior.language===lang&&prior.representation===a.representation,'INVALID_RELATION','Uma correção conserva porção, idioma e representação da versão anterior.');}
   const alignment=a.alignment||[a.ref];for(const ref of alignment){await element(c,ref,r.id);ensure(sameRef(ref,a.ref),'INVALID_ALIGNMENT','Cada representação deve corresponder exatamente à passagem, sem referências adicionais silenciosas.');}
   const originalElement=await element(c,a.ref,r.id),originalSource=await one(c,'select original_language from araread.sources where id=$1',[a.ref.source_id]);
   for(const claim of a.editorial_review?.claims||[]){const evidence=await ownEvidence(c,claim.evidence_ids);ensure(claim.status!=='documented'||evidence.some(v=>v.access==='available'&&v.consulted_at&&v.excerpt),'MISSING_EVIDENCE','Afirmação documentada exige fonte consultada disponível.');}
   const structural=passageInfo(originalElement,a.ref,pref.portion_size);
   const editorial={...editorialAssessment(cp(originalElement.text).slice(a.ref.start,a.ref.end).join(''),a.rewrite,a.representation,a.editorial_review,originalSource.original_language,lang),structural};
   if((structural.starts_mid_unit||structural.ends_mid_unit)&&!a.editorial_review?.continuity_acknowledged){editorial.ready_to_present=false;editorial.findings.push({code:'STRUCTURAL_CONTINUITY',detail:'Intervalo interrompe unidade original; recomponha ou declare a continuidade após conferência.',severity:'problem'});}
   const evidenceIds=[...new Set([...a.evidence_ids,...(a.editorial_review?.claims||[]).flatMap((claim:any)=>claim.evidence_ids),...a.additions.flatMap((addition:any)=>addition.support?.evidence_ids||[])])];
   await c.query('insert into araread.mediations(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,rewrite,additions,provenance,context_id,context_signature,representation,study_selection,alignment,evidence_ids,dependencies,supersedes,editorial,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)',[...fields,lang,a.rewrite,json(a.additions),json(a.provenance),a.context_id||null,prepared?.signature||null,a.representation,json(prepared?.selection||{}),json(alignment),json(evidenceIds),json(a.dependencies),a.supersedes||null,json(editorial),editorial.findings.length?'needs_review':'unreviewed']);
  } else if(name==='term_save'){
   if(a.details?.selection)checkSelector(await targetText(c,r.id,a.ref,a.details.selection),a.details.selection);
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
  const pref=await preferences(c,identity,r),size=pref.portion_size;
  let ref=a.ref||r.resume,covered=r.covered,opened=r.opened,resume=r.resume,atEnd=r.available_end;
  const e=await element(c,ref,r.id);
  if(a.action==='open'){ensure(a.ref,'INVALID_REF','Informe a porção a abrir.');opened=ref;}
  if(a.action==='resume')opened=resume;
  if(a.action==='mark_read'){ensure(a.ref,'INVALID_REF','Informe exatamente o intervalo percorrido.');covered=mergeIntervals(covered,ref);}
  if(a.action==='continue'){
   ensure(a.ref,'INVALID_REF','Continuar exige confirmar a porção apresentada.');
   const at=(v:Ref)=>ref.source_id===v.source_id&&ref.element_id===v.element_id&&ref.start===v.start;
   ensure(at(r.opened)||at(r.resume),'POSITION_CHANGED','A posição mudou. Consulte a passagem atual ou abra novamente a passagem desejada antes de continuar.',409);
   const principal=at(r.resume);
   // Permite a preferência de tamanho mudar sem apagar âncoras; aceita só porções emitidas pelos tamanhos válidos.
   ensure(sameRef(ref,r.opened)||sameRef(ref,r.resume)||['short','medium','long'].some(s=>sameRef(portion(e,ref.start,s),ref)),'INVALID_REF','Use uma porção atual emitida pelo servidor ou a referência exata já aberta/salva.');
   covered=mergeIntervals(covered,ref);const next=await neighbor(c,e,ref,size,'next',r.id);
   opened=next||ref;if(principal){resume=opened;atEnd=!next;}
  }
  await c.query('update araread.readings set opened=$2,resume=$3,covered=$4,available_end=$5,revision=revision+1 where id=$1',[r.id,json(opened),json(resume),json(covered),atEnd]);
  await c.query('insert into araread.events(id,owner_id,reading_id,kind,ref,revision) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,r.id,a.action,json(ref),r.revision+1]);
  return {reading_id:r.id,source_id:r.source_id,ref:opened,resume,revision:r.revision+1,available_end:atEnd};
 }
 if(name==='data_export'){
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[uid]);
  const snapshot=String((await one(c,'select generation from araread.export_clock'))?.generation||0)+(a.format==='araread/4'?':'+await editionSnapshot(c):'');
  ensure(!a.snapshot||a.snapshot===snapshot,'EXPORT_CHANGED','A biblioteca mudou entre páginas. Reinicie a exportação; nenhum backup consistente foi confirmado.',409);
  const exportSections=a.format==='araread/4'?[...sections,...editionBackupSections]:sections;
  ensure((exportSections as readonly string[]).includes(a.section),'INVALID_BACKUP','Use araread/4 para exportar edições.');
  if((editionBackupSections as readonly string[]).includes(a.section)){
   const limit=a.section==='edition_sources'&&a.include_original?1:a.limit,{items,total}=await exportEditionSection(c,a.section,a.offset,limit,a.include_original);
   return {format:a.format,snapshot,sections:exportSections,section:a.section,items,pagination:paging(a.offset,limit,total)};
  }
  const limit=a.section==='sources'&&a.include_original?1:a.limit,select=a.section==='sources'?(a.include_original?'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,encode(original,\'base64\') as original_base64,mime,filename,warnings,derives_from,original_available,canonical_sha256,extraction,storage_policy':'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,mime,filename,warnings,derives_from,original_available,canonical_sha256,extraction,storage_policy'):'*';
  const exportFilter=a.section==='preference_records'?" where scope<>'session'":'';
  const items=(await c.query(`select ${a.section==='references'?'*,consulted_at::text as consulted_at':select} from araread."${a.section}"${exportFilter} order by ${a.section==='preferences'?'owner_id':a.section==='receipts'?'operation_id':'id'} limit $1 offset $2`,[limit,a.offset])).rows;
  if(a.section==='notes')for(const note of items)if(note.anchor?.mediation_id&&!await one(c,'select id from araread.mediations where id=$1 and reading_id=$2',[note.anchor.mediation_id,note.reading_id]))note.anchor={...note.anchor,unavailable_version:true};
  return {format:a.format,snapshot,sections:exportSections,section:a.section,items,pagination:paging(a.offset,limit,Number((await one(c,`select count(*) from araread."${a.section}"${exportFilter}`)).count))};
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
