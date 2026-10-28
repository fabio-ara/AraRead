import {randomUUID,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {editionConfig,editionRights,editionPassage,editionSelector} from './contracts.ts';
import {editionBackupSections} from './backup-contracts.ts';
import {assessPassage,checkSelection,activityFeedback} from './model.ts';
import {canonicalHash,contentHash as hash} from '../ingestion/quality.ts';
import {ensure} from '../errors.ts';
import {config} from '../config.ts';

const uuid=z.uuid(),digest=z.string().regex(/^[a-f0-9]{64}$/),nat=z.number().int().nonnegative(),ids=z.array(uuid).max(100000);
const json=JSON.stringify;
const timestamp=(v:any)=>{if(v instanceof Date)v=v.toISOString();ensure(typeof v==='string'&&Number.isFinite(Date.parse(v)),'INVALID_BACKUP','Data histórica inválida.');return v;};
const relevantVersions=`select v.* from araread.edition_versions v where v.owner_id=(select araread.owner()) or exists(select 1 from araread.edition_readers r where r.version_id=v.id and r.owner_id=(select araread.owner()))`;

/** All queries run under the same ordinary authenticated role as the reader. */
export async function exportEditionSection(c:PoolClient,section:string,offset:number,limit:number,original:boolean){
 ensure((editionBackupSections as readonly string[]).includes(section),'INVALID_BACKUP','Seção editorial desconhecida.');
 const own='owner_id=(select araread.owner())';let query:string;
 if(section==='edition_versions')query=relevantVersions;
 else if(section==='edition_sources')query=`select id,owner_id,metadata,blocks,canonical_sha256,created_at${original?",encode(original,'base64') original_base64":''} from araread.edition_sources where ${own} or id in(select unnest(source_ids) from relevant_versions)`;
 else if(section==='edition_passages')query=`select * from araread.edition_passages where ${own} or id in(select unnest(manifest) from relevant_versions)`;
 else if(section==='edition_projects')query=`select to_jsonb(p) payload from araread.edition_projects p where ${own} union all select jsonb_build_object('id',v.project_id,'title',v.title,'author',v.author,'topics',v.topics,'traditions',v.traditions,'rights',v.rights,'synthetic',coalesce((v.review->>'synthetic')::boolean,false),'revision',0,'source_ids',(select array_agg(distinct x) from relevant_versions v2 cross join unnest(v2.source_ids) x where v2.project_id=v.project_id),'manifest','[]'::jsonb,'stage','sources','sample',null,'profile_id',null,'created_at',v.created_at,'shared_snapshot',true) payload from (select distinct on(project_id) * from relevant_versions where owner_id<>(select araread.owner()) order by project_id,version desc) v`;
 else if(section==='edition_invites')query=`select id,owner_id,group_id,version_id,expires_at,claimed_by,revoked from araread.edition_invites where ${own}`;
 else if(['edition_groups','edition_members','edition_comments'].includes(section))query=`select * from araread.${section}`;
 else query=`select * from araread.${section} where ${own}${section==='edition_settings'?" and scope<>'session'":''}`;
 const cte=`with relevant_versions as (${relevantVersions}), exported as (${query}) `;
 const order=section==='edition_projects'?"payload->>'id'":section==='edition_readers'?'version_id':section==='edition_members'?'group_id,member_id':'id';
 const items=(await c.query(`${cte}select * from exported order by ${order} limit $1 offset $2`,[limit,offset])).rows.map(r=>section==='edition_projects'?r.payload:r);
 const total=Number((await c.query(`${cte}select count(*) n from exported`)).rows[0].n);
 return {items,total};
}
export async function editionSnapshot(c:PoolClient){
 const versions=(await c.query(`select id,state,revision,sha256 from (${relevantVersions}) v order by id`)).rows;
 const groups=(await c.query('select id,revision from araread.edition_groups order by id')).rows;
 return hash({versions,groups});
}

/** Restored sharing is deliberately inert. Explicit ID maps preserve historical identity. */
export async function restoreEditions(c:PoolClient,uid:string,input:any,legacyMap:Record<string,string>,quota:(n:number)=>Promise<unknown>){
 const data:Record<string,any[]>={};
 for(const key of editionBackupSections){ensure(Array.isArray(input[key])&&input[key].length<=100000,'INVALID_BACKUP','Backup v4 requer todas as seções editoriais.');data[key]=input[key];}
 const logical={...data,edition_sources:data.edition_sources.map(({original_base64,...source})=>source)};
 const originalBytes=data.edition_sources.reduce((sum,source)=>sum+(typeof source.original_base64==='string'?Buffer.byteLength(source.original_base64,'base64'):0),0);
 await quota(Buffer.byteLength(json(logical))+originalBytes);
 const map={...legacyMap},kinds=new Map<string,string>(),known=(id:any)=>{ensure(typeof id==='string'&&map[id],'INVALID_BACKUP','Relação ausente no backup editorial.');return map[id];};
 const register=(id:any,kind:string)=>{ensure(uuid.safeParse(id).success&&(!kinds.has(id)||kinds.get(id)===kind),'INVALID_BACKUP','Identidade editorial inválida ou usada para entidades diferentes.');kinds.set(id,kind);return map[id]??=randomUUID();};
 const availableVersions=new Set(data.edition_versions.map(v=>v.id));
 for(const section of editionBackupSections.filter(s=>!['edition_readers','edition_members','edition_invites','edition_comments','edition_groups'].includes(s)))for(const row of data[section]){
  if(section==='edition_annotations'&&!availableVersions.has(row.version_id)||section==='edition_settings'&&row.scope==='reader'&&!availableVersions.has(row.scope_id))continue;
  register(row.id,section);
 }
 const projects=new Map(data.edition_projects.map(r=>[r.id,r])),sources=new Map(data.edition_sources.map(r=>[r.id,r])),passages=new Map(data.edition_passages.map(r=>[r.id,r])),versions=new Map(data.edition_versions.map(r=>[r.id,r]));
 for(const section of ['edition_projects','edition_sources','edition_passages','edition_versions'])ensure(new Set(data[section].map(r=>r.id)).size===data[section].length,'INVALID_BACKUP','Identidade duplicada em uma seção.');
 for(const s of sources.values())for(const b of s.blocks||[])register(b.id,'element');
 for(const p of passages.values()){
  ensure(editionPassage.safeParse(p.content).success&&hash(p.content)===p.sha256&&p.key===p.content.key&&projects.has(p.project_id)&&nat.safeParse(p.revision).success,'INVALID_BACKUP','Passagem editorial inválida ou adulterada.');
  register(p.content.key,'key');for(const name of ['segments','supports','activities','evidence'])for(const r of p.content[name])register(r.id,name);
 }
 for(const s of data.edition_settings)if(s.scope==='profile')register(s.scope_id,'profile');
 const ref=(r:any)=>({...r,source_id:known(r.source_id),element_id:known(r.element_id)});
 const target=(r:any)=>({...r,...(r.passage_id?{passage_id:known(r.passage_id)}:{}),segment_id:known(r.segment_id)});
 const restoredSources:any[]=[];
 for(const s of sources.values()){
  ensure(Array.isArray(s.blocks)&&s.blocks.length<=20000&&digest.safeParse(s.canonical_sha256).success&&canonicalHash(s.blocks)===s.canonical_sha256,'INVALID_BACKUP','Hash canônico da fonte editorial não confere.');
  for(const b of s.blocks)ensure(typeof b.text==='string'&&b.text.length>0&&typeof b.kind==='string'&&nat.safeParse(b.ordinal).success&&b.source_id===s.id,'INVALID_BACKUP','Elemento editorial inválido.');
  let original:Buffer|null=null;
  if(s.metadata?.original_available){ensure(typeof s.original_base64==='string','INVALID_BACKUP','Bytes originais retidos estão ausentes.');original=Buffer.from(s.original_base64,'base64');ensure(original.length<=config.maxBytes&&createHash('sha256').update(original).digest('hex')===s.metadata.sha256,'INVALID_BACKUP','Original editorial alterado.');}
  else ensure(!s.original_base64&&s.metadata?.storage_policy==='text','INVALID_BACKUP','Política textual da fonte não foi declarada.');
  const blocks=s.blocks.map((b:any)=>({...b,id:known(b.id),source_id:known(s.id)})),metadata={...s.metadata,id:known(s.id),derives_from:s.metadata.derives_from?map[s.metadata.derives_from]||null:null};
  await c.query('insert into araread.edition_sources(id,owner_id,metadata,blocks,canonical_sha256,original,created_at) values($1,$2,$3,$4,$5,$6,$7)',[known(s.id),uid,json(metadata),json(blocks),s.canonical_sha256,original,timestamp(s.created_at)]);restoredSources.push({id:known(s.id),metadata,blocks,canonical_sha256:s.canonical_sha256});
 }
 for(const p of projects.values()){
  ensure(typeof p.title==='string'&&p.title.length>0&&p.title.length<=300&&editionRights.safeParse(p.rights).success&&ids.safeParse(p.source_ids).success&&p.source_ids.every((id:string)=>sources.has(id))&&Array.isArray(p.topics)&&Array.isArray(p.traditions),'INVALID_BACKUP','Projeto editorial inválido.');
  await c.query('insert into araread.edition_projects(id,owner_id,title,author,topics,traditions,rights,synthetic,source_ids,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[known(p.id),uid,p.title,p.author||'',json(p.topics),json(p.traditions),json(p.rights),p.synthetic===true,p.source_ids.map(known),timestamp(p.created_at)]);
 }
 const contentMap=new Map<string,any>();
 for(const p of passages.values()){
  const old=p.content,content={...old,review:{...old.review,claims:old.review.claims.map((r:any)=>({...r,evidence_ids:r.evidence_ids.map(known)}))},key:known(old.key),refs:old.refs.map(ref),segments:old.segments.map((s:any)=>({...s,id:known(s.id),refs:s.refs.map(ref)})),supports:old.supports.map((s:any)=>({...s,id:known(s.id),target:target(s.target),evidence_ids:s.evidence_ids.map(known)})),activities:old.activities.map((s:any)=>({...s,id:known(s.id)})),evidence:old.evidence.map((s:any)=>({...s,id:known(s.id)}))};
  const assessment=assessPassage(content,restoredSources,content.segments[0].language);contentMap.set(p.id,content);
  await c.query('insert into araread.edition_passages(id,owner_id,project_id,key,revision,content,assessment,sha256,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[known(p.id),uid,known(p.project_id),known(p.key),p.revision,json(content),json(assessment),hash(content),timestamp(p.created_at)]);
 }
 for(const p of projects.values()){
  ensure(ids.safeParse(p.manifest).success&&p.manifest.every((id:string)=>passages.get(id)?.project_id===p.id),'INVALID_BACKUP','Manifesto do projeto inválido.');
  await c.query('update araread.edition_projects set manifest=$2 where id=$1',[known(p.id),p.manifest.map(known)]);
 }
 for(const v of versions.values()){
  ensure(projects.has(v.project_id)&&ids.safeParse(v.source_ids).success&&ids.safeParse(v.manifest).success&&v.source_ids.every((id:string)=>sources.has(id))&&v.manifest.length>0&&v.manifest.every((id:string)=>passages.get(id)?.project_id===v.project_id)&&editionConfig.partial().safeParse(v.config?.values).success&&typeof v.config?.values?.language==='string'&&editionRights.safeParse(v.rights).success&&nat.safeParse(v.version).success&&digest.safeParse(v.sha256).success,'INVALID_BACKUP','Versão editorial inválida.');
  const all=v.manifest.map((id:string)=>passages.get(id));
  const oldDigest=hash({manifest:[...all].sort((a,b)=>a.content.ordinal-b.content.ordinal).map(r=>({id:r.id,sha256:r.sha256})),sources:v.source_ids.map((id:string)=>({id,sha256:sources.get(id).canonical_sha256})),config:v.config,rights:v.rights,version:v.version});
  ensure(oldDigest===v.sha256,'INVALID_BACKUP','Hash da versão editorial não confere.');
  const newDigest=hash({manifest:all.map((r:any)=>({id:known(r.id),sha256:hash(contentMap.get(r.id))})),sources:v.source_ids.map((id:string)=>({id:known(id),sha256:sources.get(id).canonical_sha256})),config:v.config,rights:v.rights,version:v.version});
  const review={...v.review,sample:v.review?.sample?{...v.review.sample,passage_id:known(v.review.sample.passage_id)}:null,restored_from:{version_id:v.id,sha256:v.sha256,visibility:v.visibility,state:v.state},academic_review_inferred:false};
  await c.query('insert into araread.edition_versions(id,owner_id,project_id,version,title,author,topics,traditions,rights,config,source_ids,manifest,sha256,review,visibility,state,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,\'private\',$15,$16)',[known(v.id),uid,known(v.project_id),v.version,v.title,v.author,json(v.topics),json(v.traditions),json(v.rights),json(v.config),v.source_ids.map(known),v.manifest.map(known),newDigest,json(review),'approved',timestamp(v.created_at)]);
 }
 for(const p of projects.values()){const history=Object.fromEntries(Object.entries(p.version_configurations||{}).map(([id,value])=>[map[id]||id,value]));await c.query('update araread.edition_projects set version_configurations=$2 where id=$1',[known(p.id),json(history)]);}
 for(const r of data.edition_reviews){ensure(passages.get(r.passage_id)?.project_id===r.project_id&&['accepted','needs_changes'].includes(r.decision)&&typeof r.note==='string'&&['assistant','author_action','synthetic_fixture'].includes(r.reviewer_kind),'INVALID_BACKUP','Revisão inválida.');await c.query('insert into araread.edition_reviews(id,owner_id,project_id,passage_id,decision,note,reviewer_kind,created_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[known(r.id),uid,known(r.project_id),known(r.passage_id),r.decision,r.note,r.reviewer_kind,timestamp(r.created_at)]);}
 for(const s of data.edition_settings){
  ensure(['account','profile','project','reader'].includes(s.scope)&&editionConfig.partial().safeParse(s.values).success&&nat.safeParse(s.revision).success,'INVALID_BACKUP','Configuração editorial inválida.');
  if(s.scope==='account'&&(await c.query("select id from araread.edition_settings where scope='account' and owner_id=$1",[uid])).rowCount)continue;
  if(s.scope==='reader'&&!versions.has(s.scope_id))continue;
  const scopeId=s.scope==='account'?uid:known(s.scope_id);
  await c.query('insert into araread.edition_settings(id,owner_id,scope,scope_id,revision,values,history) values($1,$2,$3,$4,$5,$6,$7)',[known(s.id),uid,s.scope,scopeId,s.revision,json(s.values),json(s.history||[])]);
 }
 const unavailable={readers:[] as any[],annotations:[] as any[],settings:data.edition_settings.filter(s=>s.scope==='reader'&&!versions.has(s.scope_id))};
 for(const r of data.edition_readers){
  const v=versions.get(r.version_id);if(!v){unavailable.readers.push(r);continue;}
  ensure(nat.safeParse(r.revision).success&&ids.safeParse(r.covered).success&&[r.opened,r.resume,...r.covered].filter(Boolean).every(id=>v.manifest.includes(id)),'INVALID_BACKUP','Estado pessoal fora da versão.');
  await c.query('insert into araread.edition_readers(owner_id,version_id,revision,opened,resume,covered) values($1,$2,$3,$4,$5,$6)',[uid,known(r.version_id),r.revision,r.opened?known(r.opened):null,r.resume?known(r.resume):null,r.covered.map(known)]);
 }
 for(const a of data.edition_annotations){
  const v=versions.get(a.version_id);if(!v){unavailable.annotations.push(a);continue;}
  ensure(v.manifest.includes(a.passage_id)&&['note','highlight','answer','request','review'].includes(a.kind)&&typeof a.text==='string'&&a.text.length<=10000,'INVALID_BACKUP','Anotação fora da versão.');
  const content=contentMap.get(a.passage_id);let anchor=null,response=null;
  if(a.target){ensure(editionSelector.safeParse(a.target).success&&a.target.passage_id===a.passage_id,'INVALID_BACKUP','Âncora editorial inválida.');anchor=target(a.target);checkSelection(content,restoredSources,anchor);}
  ensure(a.kind!=='highlight'||anchor,'INVALID_BACKUP','Grifo sem âncora.');
  if(a.kind==='answer'){const activity=content.activities.find((r:any)=>r.id===known(a.activity_id));ensure(activity,'INVALID_BACKUP','Atividade ausente.');response=activityFeedback(activity,a.text,a.response?.self_assessment);}
  await c.query('insert into araread.edition_annotations(id,owner_id,version_id,passage_id,kind,target,text,activity_id,response,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[known(a.id),uid,known(a.version_id),known(a.passage_id),a.kind,anchor?json(anchor):null,a.text,a.activity_id?known(a.activity_id):null,response?json(response):null,timestamp(a.created_at)]);
 }
 for(const v of versions.values())if(v.state==='withdrawn')await c.query("update araread.edition_versions set state='withdrawn' where id=$1",[known(v.id)]);
 for(const a of data.edition_archives)await c.query('insert into araread.edition_archives(id,owner_id,payload,created_at) values($1,$2,$3,$4)',[known(a.id),uid,json(a.payload),timestamp(a.created_at)]);
 const archiveId=randomUUID(),archive={format:'araread/4-restoration',id_map:map,unavailable,projects:data.edition_projects.map(p=>({id:p.id,sample:p.sample,profile_id:p.profile_id,revision:p.revision})),groups:data.edition_groups,invites:data.edition_invites,members:data.edition_members,comments:data.edition_comments,policy:'Histórico privado; compartilhamento, convites e aprovação para publicar não são reativados. Identidades originais permanecem no mapa; nenhuma nota foi remapeada para outra passagem.'};
 await c.query('insert into araread.edition_archives(id,owner_id,payload) values($1,$2,$3)',[archiveId,uid,json(archive)]);
 await quota(0);
 return {id_map:map,restored_editions:versions.size,restored_edition_readers:data.edition_readers.length-unavailable.readers.length,archived_unavailable_annotations:unavailable.annotations.length,edition_archive_id:archiveId,sharing_reactivated:false};
}
