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

const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const paging=(offset:number,limit:number,total:number)=>({offset,limit,total,next_offset:offset+limit<total?offset+limit:null});
const json=(v:unknown)=>JSON.stringify(v);
const sections=['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts'] as const;
async function one(c:PoolClient,sql:string,args:unknown[]=[]){return (await c.query(sql,args)).rows[0];}
async function preferences(c:PoolClient){return await one(c,'select * from araread.preferences')||{language:'pt-BR',portion_size:'medium',revision:0};}
async function reading(c:PoolClient,id:string,lock=false){const r=await one(c,`select * from araread.readings where id=$1${lock?' for update':''}`,[id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);return r;}
async function element(c:PoolClient,ref:Ref,sourceId:string){const e=await one(c,'select * from araread.elements where id=$1 and source_id=$2',[ref.element_id,sourceId]);ensure(e,'INVALID_REF','Referência não encontrada nesta leitura.');validateRef(ref,e,sourceId);return e as Element;}
async function quota(c:PoolClient,additional:number){
 const usage=await one(c,`select coalesce((select sum(octet_length(original)) from araread.sources),0)+coalesce((select sum(octet_length(text)) from araread.elements),0)+coalesce((select sum(octet_length(rewrite)+octet_length(additions::text)) from araread.mediations),0)+coalesce((select sum(octet_length(text)) from araread.notes),0)+coalesce((select sum(octet_length(definition)) from araread.terms),0) as bytes`);
 ensure(Number(usage.bytes)+additional<=config.maxAccountBytes,'QUOTA','A biblioteca atingiu a cota de 80 MiB. Exporte e remova material explicitamente antes de importar mais.',413);
 return Number(usage.bytes);
}
async function neighbor(c:PoolClient,e:Element,ref:Ref,size:string,direction:'next'|'previous'):Promise<Ref|null>{
 if(direction==='next'&&ref.end<cp(e.text).length)return portion(e,ref.end,size);
 if(direction==='previous'&&ref.start>0){let cur=portion(e,0,size),prev=cur;while(cur.end<ref.start){prev=cur;cur=portion(e,cur.end,size);}return cur.end===ref.start?cur:prev;}
 const n=await one(c,`select * from araread.elements where source_id=$1 and ordinal ${direction==='next'?'>':'<'} $2 order by ordinal ${direction==='next'?'asc':'desc'} limit 1`,[e.source_id,e.ordinal]);
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
   if(previous){ensure(previous.request_hash===hash(name+json(a)),'IDEMPOTENCY_MISMATCH','Essa identidade de operação já foi usada para outra intenção.',409);return previous.result;}
   if(name!=='work_delete'&&name!=='data_restore')await quota(c,Buffer.byteLength(json(a)));
  }
  let r:any;
  if(write&&'reading_id'in a&&a.reading_id){r=await reading(c,a.reading_id,true);ensure(r.revision===a.expected_revision,'CONFLICT','Outra sessão alterou esta leitura. Recarregue e confira sua intenção.',409);}
  const result=await dispatch(name,a,identity,c,r);
  if(!write)return result;
  const receipt={...result,operation_id:a.operation_id,status:'confirmed'};
  await c.query('insert into araread.receipts(owner_id,operation_id,request_hash,result) values($1,$2,$3,$4)',[identity.id,a.operation_id,hash(name+json(a)),json(receipt)]);
  return receipt;
 });
}

async function dispatch(name:ToolName,a:any,identity:Identity,c:PoolClient,r?:any):Promise<any>{
 const uid=identity.id;
 if(name==='assistant_guidance')return {version:guidanceVersion,instructions:guidance};
 if(name==='account_context')return {account:{id:uid},preferences:await preferences(c),guidance_version:guidanceVersion,capabilities:{model_key_required:false,formats:['text','markdown','html','pdf','url','structured'],ocr:false,max_import_bytes:config.maxBytes,max_account_bytes:config.maxAccountBytes,used_bytes:await quota(c,0),mcp_protocol:'2026-07-28',offline:'Última biblioteca e porções carregadas; alterações exigem rede.'}};
 if(name==='library_list'){
  const filter=`from araread.readings r join araread.sources s on s.id=r.source_id join araread.works w on w.id=s.work_id where w.title ilike $1 or w.author ilike $1`;
  const total=Number((await one(c,`select count(*) ${filter}`,[`%${a.query}%`])).count);
  const pref=await preferences(c);
  const items=(await c.query(`select r.id as reading_id,r.source_id,s.work_id,w.title,w.author,s.edition,s.original_language,coalesce(r.language,$4) as language,r.revision,r.resume,r.opened,s.partial,r.available_end ${filter} order by r.created_at desc,r.id limit $2 offset $3`,[`%${a.query}%`,a.limit,a.offset,pref.language])).rows;
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
  return {work_id:workId,source_id:sourceId,reading_id:readingId,revision:0,ref:first,warnings:x.warnings};
 }
 if(name==='reading_context'){
  r=await reading(c,a.reading_id);const pref=await preferences(c),lang=a.language||r.language||pref.language,size=a.size||r.portion_size||pref.portion_size;
  const storedRef=a.ref||r[a.position],e=await element(c,storedRef,r.source_id),ref=a.ref?storedRef:portion(e,storedRef.start,size);
  const source=await one(c,'select id,work_id,edition,original_language,partial,warnings,mime,filename,sha256,genres,origin,captured_at,derives_from from araread.sources where id=$1',[r.source_id]);
  const work=await one(c,'select id,title,author from araread.works where id=$1',[source.work_id]);
  const values=[r.id,ref.element_id,ref.start,ref.end,lang];
  const mediation=await one(c,'select * from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5 order by created_at desc,id desc limit 1',values)||null;
  const other=(await c.query('select distinct language from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4',values.slice(0,4))).rows;
  const next=await neighbor(c,e,ref,size,'next'),previous=await neighbor(c,e,ref,size,'previous');
  return {work,source,reading:r,ref,element:{id:e.id,kind:e.kind,locator:e.locator,meta:e.meta,ordinal:e.ordinal},original:cp(e.text).slice(ref.start,ref.end).join(''),mediation,other_languages:other.map(x=>x.language),effective_language:lang,
   next_ref:next,previous_ref:previous,
   terms:(await c.query('select * from araread.terms where reading_id=$1 and language=$2 and element_id=$3 order by created_at desc limit 25',[r.id,lang,e.id])).rows,
   notes:(await c.query('select * from araread.notes where reading_id=$1 and element_id=$2 order by created_at desc limit 25',[r.id,e.id])).rows,
   pending_questions:(await c.query("select n.* from araread.notes n where n.reading_id=$1 and n.kind='question' and not n.resolved and not exists(select 1 from araread.notes answer where answer.reply_to=n.id and answer.kind='answer') order by n.created_at limit 15",[r.id])).rows,
   ...(next?{}:{end_message:source.partial?'Fim do material disponível. Forneça a próxima passagem; a obra foi importada parcialmente.':'Fim desta versão da fonte. Isso não comprova leitura nem compreensão de todos os intervalos.'})};
 }
 if(name==='source_elements'){
  r=await reading(c,a.reading_id);const pref=await preferences(c),size=r.portion_size||pref.portion_size;
  const items=(await c.query('select * from araread.elements where source_id=$1 order by ordinal limit $2 offset $3',[r.source_id,a.limit,a.offset])).rows;
  return {reading_id:r.id,source_id:r.source_id,revision:r.revision,items:items.map(e=>({id:e.id,kind:e.kind,locator:e.locator,ordinal:e.ordinal,preview:cp(e.text).slice(0,160).join(''),ref:portion(e,0,size)})),pagination:paging(a.offset,a.limit,Number((await one(c,'select count(*) from araread.elements where source_id=$1',[r.source_id])).count))};
 }
 if(name==='reading_history'){
  r=await reading(c,a.reading_id);
  const items=(await c.query(`select * from araread.${a.kind} where reading_id=$1 order by created_at desc,id desc limit $2 offset $3`,[r.id,a.limit,a.offset])).rows;
  return {reading_id:r.id,source_id:r.source_id,revision:r.revision,items,pagination:paging(a.offset,a.limit,Number((await one(c,`select count(*) from araread.${a.kind} where reading_id=$1`,[r.id])).count))};
 }
 if(name==='operation_get'){
  const receipt=await one(c,'select result from araread.receipts where operation_id=$1',[a.operation_id]);
  return receipt?receipt.result:{operation_id:a.operation_id,status:'unknown',message:'Recibo não encontrado nesta conta. Consulte novamente ou repita a mesma intenção com a mesma chave.'};
 }
 if(name==='preferences_set'){
  if(r){await c.query('update araread.readings set language=case when $2 then $3 else language end,portion_size=coalesce($4,portion_size),revision=revision+1 where id=$1',[r.id,a.language!==undefined,a.language||null,a.portion_size||null]);return {reading_id:r.id,revision:r.revision+1};}
  const pref=await preferences(c);ensure(pref.revision===a.expected_revision,'CONFLICT','Preferências alteradas em outra sessão. Recarregue.',409);ensure(a.language!==null,'VALIDATION','A conta precisa ter um idioma padrão.');
  await c.query('insert into araread.preferences(owner_id,language,portion_size,revision) values($1,$2,$3,$4) on conflict(owner_id) do update set language=excluded.language,portion_size=excluded.portion_size,revision=excluded.revision',[uid,a.language||pref.language,a.portion_size||pref.portion_size,pref.revision+1]);return {revision:pref.revision+1};
 }
 if(name==='mediation_save'||name==='term_save'||name==='note_save'){
  await element(c,a.ref,r.source_id);const pref=await preferences(c),lang=a.language||r.language||pref.language,id=randomUUID();
  const fields=[id,uid,r.id,r.source_id,a.ref.element_id,a.ref.start,a.ref.end];
  if(name==='mediation_save'){
   ensure(a.additions.every((x:any)=>x.kind!=='critical_note'||x.support),'MISSING_SUPPORT','Toda nota crítica deve declarar afirmação, situação de verificação, fontes e limites.');
   const existing=await one(c,'select id from araread.mediations where reading_id=$1 and element_id=$2 and start_offset=$3 and end_offset=$4 and language=$5',[r.id,a.ref.element_id,a.ref.start,a.ref.end,lang]);
   ensure(!existing||a.regenerate,'EXISTS','Já existe explicação nesta passagem e idioma. Recupere-a ou use regenerate explicitamente.',409);
   await c.query('insert into araread.mediations(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,rewrite,additions,provenance) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[...fields,lang,a.rewrite,json(a.additions),json(a.provenance)]);
  } else if(name==='term_save')await c.query('insert into araread.terms(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,term,definition,sense,origin) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[...fields,lang,a.term,a.definition,a.sense,a.origin]);
  else {
   if(a.reply_to)ensure(await one(c,'select id from araread.notes where id=$1 and reading_id=$2 and kind=$3',[a.reply_to,r.id,'question']),'INVALID_RELATION','A resposta deve apontar para uma pergunta da mesma leitura.');
   ensure(a.kind!=='answer'||a.reply_to,'INVALID_RELATION','Uma resposta precisa apontar para sua pergunta.');
   ensure(!['understood','favorite','review','doubt'].includes(a.kind)||a.origin==='user','INVALID_ORIGIN','Marcas pessoais exigem origem do usuário.');
   await c.query('insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,reply_to,resolved) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[...fields,a.kind,a.text,a.origin,a.reply_to||null,a.resolved]);
  }
  await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
  return {reading_id:r.id,source_id:r.source_id,ref:a.ref,revision:r.revision+1,entity_id:id,...(name==='note_save'?{}:{effective_language:lang})};
 }
 if(name==='reading_move'){
  const pref=await preferences(c),size=r.portion_size||pref.portion_size;
  let ref=a.ref||r.resume,covered=r.covered,opened=r.opened,resume=r.resume,atEnd=r.available_end;
  const e=await element(c,ref,r.source_id);
  if(a.action==='open'){ensure(a.ref,'INVALID_REF','Informe a porção a abrir.');opened=ref;}
  if(a.action==='resume')opened=resume;
  if(a.action==='mark_read'){ensure(a.ref,'INVALID_REF','Informe exatamente o intervalo percorrido.');covered=mergeIntervals(covered,ref);}
  if(a.action==='continue'){
   ensure(a.ref,'INVALID_REF','Continuar exige confirmar a porção apresentada.');
   ensure(ref.source_id===r.resume.source_id&&ref.element_id===r.resume.element_id&&ref.start===r.resume.start,'NOT_AT_RESUME','Retome o percurso principal antes de continuar.',409);
   // Permite a preferência de tamanho mudar sem apagar âncoras; aceita só porções emitidas pelos tamanhos válidos.
   ensure(['short','medium','long'].some(s=>sameRef(portion(e,ref.start,s),ref)),'INVALID_REF','Use uma porção de continuidade emitida pelo servidor.');
   covered=mergeIntervals(covered,ref);const next=await neighbor(c,e,ref,size,'next');
   if(next){resume=next;opened=next;atEnd=false;}else{resume=ref;opened=ref;atEnd=true;}
  }
  await c.query('update araread.readings set opened=$2,resume=$3,covered=$4,available_end=$5,revision=revision+1 where id=$1',[r.id,json(opened),json(resume),json(covered),atEnd]);
  await c.query('insert into araread.events(id,owner_id,reading_id,kind,ref,revision) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,r.id,a.action,json(ref),r.revision+1]);
  return {reading_id:r.id,source_id:r.source_id,ref:opened,resume,revision:r.revision+1,available_end:atEnd};
 }
 if(name==='data_export'){
  const limit=a.section==='sources'&&a.include_original?1:a.limit,select=a.section==='sources'?(a.include_original?'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,encode(original,\'base64\') as original_base64,mime,filename,warnings,derives_from':'id,owner_id,work_id,edition,original_language,partial,genres,origin,captured_at,sha256,mime,filename,warnings,derives_from'):'*';
  const items=(await c.query(`select ${select} from araread.${a.section} order by ${a.section==='preferences'?'owner_id':a.section==='receipts'?'operation_id':'id'} limit $1 offset $2`,[limit,a.offset])).rows;
  return {format:'araread/1',section:a.section,items,pagination:paging(a.offset,limit,Number((await one(c,`select count(*) from araread.${a.section}`)).count))};
 }
 if(name==='data_restore')return restore(c,uid,a.bundle);
 if(name==='work_delete'){
  const w=await one(c,'select title from araread.works where id=$1',[a.work_id]);ensure(w,'NOT_FOUND','Obra não encontrada.',404);ensure(w.title===a.confirm_title,'CONFIRMATION_REQUIRED','O título de confirmação não confere.');
  // Relação entre versões é retirada apenas na exclusão explícita da obra inteira.
  await c.query('delete from araread.works where id=$1',[a.work_id]);return {work_id:a.work_id,deleted:true};
 }
 throw new AppError('TOOL_NOT_FOUND','Operação inexistente.',404);
}

const backupSchema=z.object({format:z.literal('araread/1'),exported_at:z.iso.datetime().optional(),sections:z.object(Object.fromEntries(sections.map(s=>[s,z.array(z.record(z.string(),z.unknown())).max(100000)])) as Record<typeof sections[number],z.ZodArray<z.ZodRecord<z.ZodString,z.ZodUnknown>>>)}).strict();
async function restore(c:PoolClient,uid:string,input:unknown){
 await c.query('set constraints all deferred');
 const parsed=backupSchema.safeParse(input);ensure(parsed.success,'INVALID_BACKUP','Backup incompleto ou inválido. Exporte todas as seções.');
 const data=parsed.data.sections as Record<string,any[]>,map:Record<string,string>={};
 let restoredBytes=0;for(const s of data.sources)restoredBytes+=typeof s.original_base64==='string'?Buffer.byteLength(s.original_base64.replace(/\s/g,''),'base64'):0;for(const s of data.elements)restoredBytes+=Buffer.byteLength(String(s.text||''));for(const s of data.mediations)restoredBytes+=Buffer.byteLength(String(s.rewrite||''))+Buffer.byteLength(json(s.additions||[]));for(const s of data.notes)restoredBytes+=Buffer.byteLength(String(s.text||''));for(const s of data.terms)restoredBytes+=Buffer.byteLength(String(s.definition||''));await quota(c,restoredBytes);
 const id=(old:unknown)=>{ensure(typeof old==='string'&&z.uuid().safeParse(old).success,'INVALID_BACKUP','ID inválido no backup.');return map[old]??=randomUUID();};
 const known=(old:unknown)=>{ensure(typeof old==='string'&&map[old],'INVALID_BACKUP','Relação ausente no backup.');return map[old];};
 const cols:Record<string,string[]>={
  works:['id','owner_id','title','author','created_at'],sources:['id','owner_id','work_id','edition','original_language','partial','genres','origin','captured_at','sha256','original','mime','filename','warnings','derives_from'],
  elements:['id','owner_id','source_id','ordinal','kind','text','locator','meta'],readings:['id','owner_id','source_id','revision','language','portion_size','opened','resume','covered','available_end','created_at'],
  mediations:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','language','rewrite','additions','provenance','created_at'],
  notes:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','kind','text','origin','reply_to','resolved','created_at'],
  terms:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','language','term','definition','sense','origin','created_at'],events:['id','owner_id','reading_id','kind','ref','revision','created_at']};
 // Primeiro define identidades; nenhuma relação pode criar entidades implicitamente.
 for(const section of Object.keys(cols))for(const row of data[section]){ensure(!map[row.id],'INVALID_BACKUP','ID duplicado no backup.');id(row.id);}
 const sourceMap=new Map(data.sources.map(x=>[x.id,x])),elementMap=new Map(data.elements.map(x=>[x.id,x])),readingMap=new Map(data.readings.map(x=>[x.id,x])),noteMap=new Map(data.notes.map(x=>[x.id,x]));
 for(const old of data.elements)ensure(blockSchema.safeParse({kind:old.kind,text:old.text,locator:old.locator,meta:old.meta}).success&&Number.isInteger(old.ordinal)&&old.ordinal>=0,'INVALID_BACKUP','Elemento inválido no backup.');
 for(const section of ['sources','readings','mediations','terms'])for(const old of data[section]){const lang=section==='sources'?old.original_language:old.language;ensure(lang==null&&section==='readings'||language.safeParse(lang).success,'INVALID_BACKUP','Idioma inválido no backup.');}
 const remapRef=(ref:any,source:string):Ref=>{ensure(refSchema.safeParse(ref).success&&ref.source_id===source,'INVALID_BACKUP','Referência inválida ou de outra versão.');const e=elementMap.get(ref.element_id);ensure(e&&e.source_id===source,'INVALID_BACKUP','Elemento ausente ou de outra fonte.');validateRef(ref,e,source);return {source_id:known(ref.source_id),element_id:known(ref.element_id),start:ref.start,end:ref.end};};
 for(const section of Object.keys(cols))for(const old of data[section]){
  const row={...old,id:known(old.id),owner_id:uid};
  for(const field of ['work_id','source_id','reading_id','element_id','reply_to','derives_from'])if(row[field])row[field]=known(row[field]);
  if(section==='sources'){
   ensure(typeof old.original_base64==='string','INVALID_BACKUP','O backup precisa incluir os bytes originais.');row.original=Buffer.from(old.original_base64.replace(/\s/g,''),'base64');ensure(row.original.length<=config.maxBytes&&hash(row.original)===old.sha256,'INVALID_BACKUP','Hash do original não confere.');
   ensure(!old.derives_from||sourceMap.get(old.derives_from)?.work_id===old.work_id,'INVALID_BACKUP','Relação de versões inválida.');
  }
  if(section==='readings'){ensure(sourceMap.has(old.source_id),'INVALID_BACKUP','Fonte da leitura ausente.');row.opened=remapRef(old.opened,old.source_id);row.resume=remapRef(old.resume,old.source_id);ensure(Array.isArray(old.covered),'INVALID_BACKUP','Cobertura inválida.');row.covered=old.covered.map((x:any)=>remapRef(x,old.source_id));}
  if(['mediations','notes','terms'].includes(section)){
   ensure(readingMap.get(old.reading_id)?.source_id===old.source_id,'INVALID_BACKUP','Relação de leitura inválida.');
   remapRef({source_id:old.source_id,element_id:old.element_id,start:old.start_offset,end:old.end_offset},old.source_id);
   if(section==='notes'){ensure(!old.reply_to||(noteMap.get(old.reply_to)?.reading_id===old.reading_id&&noteMap.get(old.reply_to)?.kind==='question'),'INVALID_BACKUP','Resposta sem pergunta da mesma leitura.');ensure(old.kind!=='answer'||old.reply_to,'INVALID_BACKUP','Resposta sem pergunta.');ensure(!['understood','favorite','review','doubt'].includes(old.kind)||old.origin==='user','INVALID_BACKUP','Marca pessoal com origem inválida.');}
  }
  if(section==='events'){ensure(readingMap.has(old.reading_id),'INVALID_BACKUP','Leitura do evento ausente.');if(old.ref)row.ref=remapRef(old.ref,readingMap.get(old.reading_id).source_id);}
  const columns=cols[section],jsonFields=['genres','warnings','meta','opened','resume','covered','additions','provenance','ref'];
  await c.query(`insert into araread.${section}(${columns.join(',')}) values(${columns.map((_,i)=>`$${i+1}`).join(',')})`,columns.map(key=>row[key]==null?null:jsonFields.includes(key)?json(row[key]):row[key]));
 }
 // Preferências existentes nunca são sobrescritas por uma restauração.
 const p=data.preferences[0];if(p){const valid=schemas.preferences_set.safeParse({operation_id:randomUUID(),expected_revision:0,language:p.language,portion_size:p.portion_size});ensure(valid.success,'INVALID_BACKUP','Preferências inválidas.');await c.query('insert into araread.preferences(owner_id,language,portion_size) values($1,$2,$3) on conflict do nothing',[uid,p.language,p.portion_size]);}
 // Recibos antigos ficam como proveniência arquivada; não são reexecutados nem falsificados como recibos desta conta.
 return {id_map:map,restored_readings:data.readings.length,archived_receipts:data.receipts,receipt_policy:'Recibos originais retornados como arquivo de proveniência; novos comandos usam novas identidades.'};
}
