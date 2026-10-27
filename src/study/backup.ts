import {highlightTarget,checkSelector} from './highlights.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {schemas,refSchema,blockSchema,language} from '../contracts.ts';
import {validateRef} from '../anchors.ts';
import {config} from '../config.ts';
import {ensure} from '../errors.ts';
import {digest} from './context.ts';
import {citationSchema} from './contracts.ts';
import {canonicalHash} from '../ingestion/quality.ts';
import {profileDefinition,parameterSchemas} from './preference-contracts.ts';
import {validateProfileDefinition} from './preferences.ts';

export const backupSections=['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts','reading_segments','references','perspectives','contexts','connections','reading_maps','profiles','preference_records'] as const;
const jsonFields=new Set(['genres','warnings','meta','opened','resume','covered','additions','provenance','ref','target_ref','study','study_selection','alignment','evidence_ids','dependencies','details','attribution','selection','materials','gaps','extraction','editorial','items','definition','value','anchor']);
const columns:Record<string,string[]>={
 works:['id','owner_id','title','author','created_at'],sources:['id','owner_id','work_id','edition','original_language','partial','genres','origin','captured_at','sha256','original','mime','filename','warnings','derives_from','original_available','canonical_sha256','extraction','storage_policy'],
 elements:['id','owner_id','source_id','ordinal','kind','text','locator','meta'],readings:['id','owner_id','source_id','revision','language','portion_size','opened','resume','covered','available_end','created_at','study'],
 reading_segments:['id','owner_id','reading_id','source_id','ordinal','created_at'],
 references:['id','owner_id','reading_id','title','author','year','edition','translation','url','doi','kind','locator','excerpt','sha256','consulted_at','access','license','created_at'],
 perspectives:['id','owner_id','reading_id','name','kind','scope','description','version','previous_id','evidence_ids','declared_author','usage_terms','created_at'],
 contexts:['id','owner_id','reading_id','source_id','ref','selection','signature','materials','gaps','language','guidance_version','created_at'],
 mediations:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','language','rewrite','additions','provenance','created_at','context_id','context_signature','representation','study_selection','alignment','evidence_ids','dependencies','supersedes','status','editorial'],
 notes:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','kind','text','origin','reply_to','resolved','created_at','selected','notebook_id','declared_author','related_mediation_id','evidence_ids','supersedes','attribution','pending_link','status','anchor'],
 terms:['id','owner_id','reading_id','source_id','element_id','start_offset','end_offset','language','term','definition','sense','origin','created_at','details','status'],
 events:['id','owner_id','reading_id','kind','ref','revision','created_at'],
 connections:['id','owner_id','reading_id','target_reading_id','ref','target_ref','kind','origin','problem','limits','evidence_ids','created_at'],
 reading_maps:['id','owner_id','reading_id','version','items','provenance','created_at'],
 profiles:['id','owner_id','name','version','previous_id','definition','provenance','active','created_at'],
 preference_records:['id','owner_id','scope','reading_id','session_id','key','value','state','provenance','created_at'],
};
const defaults:Record<string,any>={anchor:null,study:{},context_id:null,context_signature:null,representation:'rewrite',study_selection:{},alignment:[],evidence_ids:[],dependencies:[],supersedes:null,status:'unreviewed',selected:false,notebook_id:null,declared_author:'',related_mediation_id:null,attribution:{},pending_link:false,details:{},original_available:true,canonical_sha256:null,extraction:{},storage_policy:'retained',editorial:{}};
const row=z.record(z.string(),z.unknown());
const bundleSchema=z.object({format:z.enum(['araread/1','araread/2','araread/3']),snapshot:z.string().optional(),exported_at:z.iso.datetime().optional(),sections:z.object(Object.fromEntries(backupSections.map((s,i)=>[s,i<10?z.array(row).max(100000):z.array(row).max(100000).default([])])) as z.ZodRawShape)}).strict();

export async function restoreBackup(c:PoolClient,uid:string,input:any,quota:(n:number)=>Promise<unknown>){
 if(input?.format==='araread/2')ensure(backupSections.slice(0,15).every(s=>Array.isArray(input?.sections?.[s])),'INVALID_BACKUP','Backup v2 precisa das quinze seções.');
 if(input?.format==='araread/3')ensure(backupSections.every(s=>Array.isArray(input?.sections?.[s])),'INVALID_BACKUP','Backup v3 precisa de todas as seções declaradas.');
 const parsed=bundleSchema.safeParse(input);ensure(parsed.success,'INVALID_BACKUP','Backup incompleto ou inválido.');
 const data=parsed.data.sections as Record<string,any[]>;
 await c.query('set constraints all deferred');
 if(!data.reading_segments.length&&parsed.data.format==='araread/1')data.reading_segments=data.readings.map(r=>({id:randomUUID(),owner_id:uid,reading_id:r.id,source_id:r.source_id,ordinal:0,created_at:r.created_at}));
 let bytes=0;for(const s of data.sources)bytes+=Buffer.byteLength(String(s.original_base64||''),'base64');for(const s of data.elements)bytes+=Buffer.byteLength(String(s.text||''));for(const s of data.mediations)bytes+=Buffer.byteLength(String(s.rewrite||''))+Buffer.byteLength(JSON.stringify(s.additions||[]));for(const s of data.notes)bytes+=Buffer.byteLength(String(s.text||''))+Buffer.byteLength(JSON.stringify(s.anchor||{}));for(const s of data.terms)bytes+=Buffer.byteLength(String(s.definition||''));for(const section of ['references','perspectives','contexts','connections','reading_maps','profiles','preference_records'])for(const row of data[section])bytes+=Buffer.byteLength(JSON.stringify(row));await quota(bytes);
 const map:Record<string,string>={};for(const section of Object.keys(columns))for(const r of data[section]){ensure(z.uuid().safeParse(r.id).success&&!map[r.id],'INVALID_BACKUP','ID inválido ou duplicado.');map[r.id]=randomUUID();}
 const referenceIds=new Set(data.references.map(r=>r.id)),missingEvidence:Record<string,string>={};
 const evidence=(id:any)=>{ensure(z.uuid().safeParse(id).success,'INVALID_BACKUP','Identificador bibliográfico inválido.');if(referenceIds.has(id))return map[id];ensure(!map[id],'INVALID_BACKUP','Referência aponta para entidade de outra natureza.');return missingEvidence[id]??=randomUUID();};
 for(const section of ['mediations','notes','perspectives','connections','terms'])for(const row of data[section])for(const id of row.evidence_ids||row.details?.evidence_ids||[])evidence(id);
 for(const row of data.contexts)for(const ref of row.materials?.references||[])evidence(ref.id);
 for(const row of data.mediations)for(const claim of row.editorial?.review?.claims||[])for(const id of claim.evidence_ids||[])evidence(id);
 const known=(v:any)=>{ensure(typeof v==='string'&&map[v],'INVALID_BACKUP','Relação ausente no backup.');return map[v];};
 const sourceMap=new Map(data.sources.map(v=>[v.id,v])),elementMap=new Map(data.elements.map(v=>[v.id,v])),readingMap=new Map(data.readings.map(v=>[v.id,v])),noteMap=new Map(data.notes.map(v=>[v.id,v]));
 const allowed=(readingId:string,sourceId:string)=>data.reading_segments.some(g=>g.reading_id===readingId&&g.source_id===sourceId);
 const ref=(v:any,readingId?:string)=>{ensure(refSchema.safeParse(v).success,'INVALID_BACKUP','Referência inválida.');const e=elementMap.get(v.element_id);ensure(e&&e.source_id===v.source_id&&(!readingId||allowed(readingId,v.source_id)),'INVALID_BACKUP','Referência fora dos segmentos da leitura.');validateRef(v,e,v.source_id);return {...v,source_id:known(v.source_id),element_id:known(v.element_id)};};
 const remap=(v:any):any=>{
  if(typeof v==='string')return map[v]||missingEvidence[v]||v;
  if(Array.isArray(v))return v.map(remap);
  if(v&&typeof v==='object'){
   // A text selector contains literal quotes/context, even when they look like IDs.
   if(typeof v.exact==='string'&&typeof v.start==='number'&&typeof v.end==='number'&&v.representation)return {...v,...(v.mediation_id?{mediation_id:remap(v.mediation_id)}:{})};
   return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)]));
  }
  return v;
 };
 for(const g of data.reading_segments){const r=readingMap.get(g.reading_id),s=sourceMap.get(g.source_id);ensure(r&&s&&sourceMap.get(r.source_id)?.work_id===s.work_id,'INVALID_BACKUP','Segmento de outra obra.');}
 for(const old of data.elements)ensure(blockSchema.safeParse({kind:old.kind,text:old.text,locator:old.locator,meta:old.meta}).success&&Number.isInteger(old.ordinal)&&old.ordinal>=0,'INVALID_BACKUP','Elemento inválido.');
 for(const [section,cols]of Object.entries(columns))for(const old of data[section]){
  if(section==='preference_records'&&old.scope==='account'&&(await c.query("select id from araread.preference_records where scope='account' and key=$1",[old.key])).rows.length)continue;
  const r:any={...defaults,...old,id:known(old.id),owner_id:uid};
  for(const field of ['work_id','source_id','reading_id','element_id','reply_to','derives_from','context_id','supersedes','notebook_id','related_mediation_id','previous_id','target_reading_id'])if(r[field])r[field]=known(r[field]);
  ensure(Array.isArray(r.evidence_ids)&&Array.isArray(r.dependencies),'INVALID_BACKUP','Lista de referências inválida.');r.evidence_ids=r.evidence_ids.map(evidence);r.dependencies=r.dependencies.map(known);
  if(section==='sources'){
   if(r.original_available){ensure(typeof old.original_base64==='string','INVALID_BACKUP','Bytes originais retidos estão ausentes.');r.original=Buffer.from(old.original_base64.replace(/\s/g,''),'base64');ensure(r.original.length<=config.maxBytes&&digest(r.original)===old.sha256,'INVALID_BACKUP','Hash do original não confere.');}
   else {ensure(!old.original_base64&&r.canonical_sha256&&r.storage_policy==='text','INVALID_BACKUP','Fonte textual precisa de hash canônico e disponibilidade explícita.');r.original=null;}
   if(r.canonical_sha256){const elements=data.elements.filter(e=>e.source_id===old.id).sort((a,b)=>a.ordinal-b.ordinal);ensure(elements.length>0&&canonicalHash(elements)===r.canonical_sha256,'INVALID_BACKUP','Hash da estrutura textual canônica não confere.');}
   ensure(!old.derives_from||sourceMap.get(old.derives_from)?.work_id===old.work_id,'INVALID_BACKUP','Versões de obras diferentes.');
  }
  if(['sources','readings','mediations','terms','contexts'].includes(section)){const lang=section==='sources'?old.original_language:old.language;ensure(section==='readings'&&lang==null||language.safeParse(lang).success,'INVALID_BACKUP','Idioma inválido.');}
  if(section==='readings'){ensure(allowed(old.id,old.source_id),'INVALID_BACKUP','Manifesto da leitura incompleto.');r.opened=ref(old.opened,old.id);r.resume=ref(old.resume,old.id);ensure(Array.isArray(old.covered),'INVALID_BACKUP','Cobertura inválida.');r.covered=old.covered.map((v:any)=>ref(v,old.id));}
  if(['mediations','notes','terms'].includes(section)){
   ref({source_id:old.source_id,element_id:old.element_id,start:old.start_offset,end:old.end_offset},old.reading_id);
   if(section==='notes'&&old.kind==='highlight'){
    const {unavailable_version,...target}=old.anchor||{};ensure(highlightTarget.safeParse(target).success,'INVALID_BACKUP','Âncora de grifo inválida.');
    let body:string|undefined;
    if(target.representation==='original'){ensure(!target.mediation_id&&target.segment==='main'&&target.start>=old.start_offset&&target.end<=old.end_offset,'INVALID_BACKUP','Grifo original fora da passagem.');body=elementMap.get(old.element_id)?.text;}
    else {const m=data.mediations.find(v=>v.id===target.mediation_id);if(m){ensure(m.reading_id===old.reading_id&&m.source_id===old.source_id&&m.element_id===old.element_id&&m.start_offset===old.start_offset&&m.end_offset===old.end_offset&&m.representation===target.representation,'INVALID_BACKUP','Grifo ligado a outra passagem/representação.');body=target.segment==='main'?m.rewrite:m.additions[Number(target.segment.split(':')[1])]?.text;}
     else {ensure(unavailable_version===true&&!map[target.mediation_id],'INVALID_BACKUP','Versão de grifo ausente sem declaração de indisponibilidade.');target.mediation_id=randomUUID();}}
    if(body!==undefined)checkSelector(body,target);else ensure(unavailable_version===true,'INVALID_BACKUP','Segmento ausente no backup.');
    r.anchor={...target,...(unavailable_version?{unavailable_version:true}:{})};
   }
   if(section==='notes'){ensure(!old.reply_to||(noteMap.get(old.reply_to)?.reading_id===old.reading_id&&noteMap.get(old.reply_to)?.kind==='question'),'INVALID_BACKUP','Resposta sem pergunta da mesma leitura.');ensure(old.kind!=='answer'||old.reply_to,'INVALID_BACKUP','Resposta sem pergunta.');ensure(!['understood','favorite','review','doubt'].includes(old.kind)||old.origin==='user','INVALID_BACKUP','Marca pessoal com origem inválida.');}
   if(section==='mediations')r.alignment=r.alignment.map((v:any)=>ref(v,old.reading_id));
  }
  if(section==='references'){const checked=citationSchema.safeParse(Object.fromEntries(Object.keys(citationSchema.shape).map(k=>[k,old[k]??undefined])));ensure(checked.success&&digest(old.excerpt)===old.sha256,'INVALID_BACKUP','Referência inválida ou trecho adulterado.');ensure(!old.consulted_at||old.access==='available'&&old.excerpt&&old.locator,'INVALID_BACKUP','Consulta bibliográfica sem material disponível.');}
  if(section==='contexts'||section==='connections'||section==='events')if(old.ref)r.ref=ref(old.ref,old.reading_id);
  if(section==='connections')r.target_ref=ref(old.target_ref,old.target_reading_id);
  if(section==='reading_maps'){ensure(Array.isArray(old.items)&&old.items.length<=300,'INVALID_BACKUP','Mapa inválido.');r.items=old.items.map((i:any)=>({...i,ref:ref(i.ref,old.reading_id)}));}
  if(section==='profiles'){ensure(profileDefinition.safeParse(old.definition).success,'INVALID_BACKUP','Definição de perfil inválida.');validateProfileDefinition(old.definition);}
  if(section==='preference_records'){ensure(['account','reading'].includes(old.scope)&&old.session_id==null&&Object.hasOwn(parameterSchemas,old.key)&&['active','disabled','default'].includes(old.state),'INVALID_BACKUP','Preferência persistente inválida; sessões não são restauradas.');if(old.state!=='default')ensure(parameterSchemas[old.key as keyof typeof parameterSchemas].safeParse(old.value).success,'INVALID_BACKUP','Valor de preferência inválido.');if(old.key==='active_profile'&&old.value)ensure(data.profiles.some(p=>p.id===old.value),'INVALID_BACKUP','Perfil ausente no backup.');if(old.key==='perspective_id'&&old.value)ensure(data.perspectives.some(p=>p.id===old.value&&p.reading_id===old.reading_id),'INVALID_BACKUP','Perspectiva fora da leitura.');r.value=remap(old.value);}
  for(const field of ['study','study_selection','selection','materials','details','attribution','definition','editorial','anchor'])if(r[field])r[field]=remap(r[field]);
  await c.query(`insert into araread."${section}"(${cols.join(',')}) values(${cols.map((_,i)=>`$${i+1}`).join(',')})`,cols.map(k=>r[k]==null?null:jsonFields.has(k)?JSON.stringify(r[k]):r[k]));
 }
 const pref=data.preferences[0];if(pref){ensure(schemas.preferences_set.safeParse({operation_id:randomUUID(),expected_revision:0,language:pref.language,portion_size:pref.portion_size}).success,'INVALID_BACKUP','Preferências inválidas.');await c.query('insert into araread.preferences(owner_id,language,portion_size,study) values($1,$2,$3,$4) on conflict do nothing',[uid,pref.language,pref.portion_size,JSON.stringify(remap(pref.study||{}))]);}
 return {id_map:map,restored_readings:data.readings.length,archived_receipts:data.receipts,receipt_policy:'Recibos históricos são proveniência arquivada. Novas intenções usam novas identidades; contextos preservam sua assinatura histórica.'};
}
