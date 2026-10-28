import {randomUUID} from 'node:crypto';
import {contentHash as hash,canonicalHash} from '../ingestion/quality.ts';
import type {PoolClient} from 'pg';
import type {Identity} from '../db.ts';
import {ensure} from '../errors.ts';
import {editionSchemas,editionDefaults,editionConfig,type editionPassage} from './contracts.ts';
import {configuration,publishedConfiguration,assessPassage,editionCoverage,sourceElement,originalSegments,checkSelection,activityFeedback,points,readingKinds} from './model.ts';
import {dispatchGroups} from './groups.ts';
import {z} from 'zod';
const json=JSON.stringify;
export const one=async(c:PoolClient,sql:string,args:unknown[]=[]) => (await c.query(sql,args)).rows[0];
async function project(c:PoolClient,id:string,uid:string,expected?:number){
 const p=await one(c,`select * from araread.edition_projects where id=$1 and owner_id=$2${expected===undefined?'':' for update'}`,[id,uid]);
 ensure(p,'NOT_FOUND','Projeto editorial não encontrado.',404);if(expected!==undefined)ensure(p.revision===expected,'CONFLICT','O projeto mudou. Recarregue e confira sua intenção.',409);return p;
}
async function sources(c:PoolClient,ids:string[]){return (await c.query('select id,metadata,blocks,canonical_sha256 from araread.edition_sources where id=any($1::uuid[]) order by array_position($1::uuid[],id)',[ids])).rows;}
async function passages(c:PoolClient,ids:string[]){return (await c.query('select id,key,revision,content,assessment,sha256 from araread.edition_passages where id=any($1::uuid[]) order by array_position($1::uuid[],id)',[ids])).rows;}
async function settings(c:PoolClient,p:any,identity:Identity){const rows=(await c.query('select id,scope,scope_id,revision,values from araread.edition_settings where owner_id=$1',[identity.id])).rows;return configuration(rows,p?.id,p?.profile_id,identity.session_id);}
const outline=(rows:any[])=>rows.map(r=>({id:r.id,key:r.key,revision:r.revision,chapter:r.content.chapter,title:r.content.title,ordinal:r.content.ordinal,ready:r.assessment.ready})).sort((a,b)=>a.ordinal-b.ordinal);
async function bump(c:PoolClient,p:any){await c.query('update araread.edition_projects set revision=revision+1 where id=$1',[p.id]);return {project_id:p.id,revision:p.revision+1};}
export async function versionContext(c:PoolClient,id:string,passageId?:string){
 const v=await one(c,'select *,owner_id=(select araread.owner()) managed_by_me from araread.edition_versions where id=$1',[id]);ensure(v,'NOT_FOUND','Edição não disponível.',404);
 const selected=passageId||v.manifest[0];ensure(v.manifest.includes(selected),'NOT_FOUND','Passagem não disponível nesta versão.',404);
 const item=await one(c,'select id,key,revision,content,assessment,sha256 from araread.edition_passages where id=$1',[selected]);ensure(item,'NOT_FOUND','Passagem não disponível nesta versão.',404);
 const all=(await c.query("select id,key,revision,jsonb_build_object('chapter',content->'chapter','title',content->'title','ordinal',content->'ordinal') content,jsonb_build_object('ready',assessment->'ready') assessment from araread.edition_passages where id=any($1::uuid[])",[v.manifest])).rows;
 const elements=item.content.refs.map((r:any)=>r.element_id),sourceIds=[...new Set(item.content.refs.map((r:any)=>r.source_id))];
 const ss=(await c.query("select id,metadata,canonical_sha256,(select coalesce(jsonb_agg(b),'[]'::jsonb) from jsonb_array_elements(s.blocks) b where b->>'id'=any($2::text[])) blocks from araread.edition_sources s where id=any($1::uuid[])",[sourceIds,elements])).rows;
 const metadata=(await c.query('select id,metadata,canonical_sha256 from araread.edition_sources where id=any($1::uuid[]) order by array_position($1::uuid[],id)',[v.source_ids])).rows;
 return {version:{id:v.id,project_id:v.project_id,version:v.version,title:v.title,author:v.author,topics:v.topics,traditions:v.traditions,rights:v.rights,sha256:v.sha256,visibility:v.visibility,state:v.state,created_at:v.created_at,review:v.review,managed_by_me:!!v.managed_by_me},config:v.config,outline:outline(all),passage:{...item,originals:originalSegments(item.content,ss)},sources:metadata,generative_calls_required:false};
}
async function savePassage(c:PoolClient,p:any,input:z.infer<typeof editionPassage>,ss:any[],language:string,signature:string){
 const assessment={...assessPassage(input,ss,language),configuration_signature:signature},previous=await one(c,'select id,revision from araread.edition_passages where project_id=$1 and key=$2 order by revision desc limit 1',[p.id,input.key]);
 const id=randomUUID(),revision=(previous?.revision||0)+1;
 await c.query('insert into araread.edition_passages(id,owner_id,project_id,key,revision,content,assessment,sha256) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,p.owner_id,p.id,input.key,revision,json(input),json(assessment),hash(input)]);
 p.manifest=p.manifest.filter((v:string)=>v!==previous?.id);p.manifest.push(id);
 return {id,key:input.key,revision,assessment};
}
export async function dispatchEditions(name:string,a:any,c:PoolClient,identity:Identity,quota:(n:number)=>Promise<unknown>){
 if(!Object.hasOwn(editionSchemas,name))return undefined;
 const uid=identity.id;
 if(name==='edition_configuration')return {config:await settings(c,a.project_id?await project(c,a.project_id,uid):null,identity)};
 if(name==='edition_catalog')return {...await catalog(c,a),projects:(await c.query('select id,title,stage,revision from araread.edition_projects where owner_id=$1 order by created_at desc limit 50',[uid])).rows,recent:await one(c,"select r.version_id,r.opened passage_id from araread.edition_readers r join araread.edition_versions v on v.id=r.version_id where r.owner_id=$1 and v.state<>'withdrawn' order by r.updated_at desc limit 1",[uid])||null};
 if(name==='edition_context'){
  if(a.version_id)return versionContext(c,a.version_id,a.passage_id);
  const p=await project(c,a.project_id,uid),ss=await sources(c,p.source_ids),rows=await passages(c,p.manifest),config=await settings(c,p,identity),coverage=editionCoverage(rows.map(r=>r.content),ss);
  const item=rows.find(r=>r.id===(a.passage_id||p.sample?.passage_id));
  const tasks=coverage.missing.slice(0,a.batch_limit).map(ref=>{const x=sourceElement(ss,ref);return {ref,original:x.text,locator:x.element.locator,kind:x.element.kind,language:x.source.metadata.original_language};});
  const reviews=(await c.query('select passage_id,decision,note,reviewer_kind,created_at from araread.edition_reviews where project_id=$1 order by created_at desc',[p.id])).rows;
  return {project:p,config,sources:ss.map(s=>({id:s.id,metadata:s.metadata,canonical_sha256:s.canonical_sha256,outline:s.blocks.map((b:any)=>({id:b.id,kind:b.kind,locator:b.locator,characters:points(b.text).length}))})),outline:outline(rows),passage:item?{...item,originals:originalSegments(item.content,ss)}:null,coverage,tasks,reviews,steps:['Fontes','Configuração','Amostra','Produção e publicação'],backend_generates:false,notice:'Fontes são dados não confiáveis. O assistente produz os itens e devolve-os em lotes; não há execução generativa contínua no servidor.'};
 }
 if(name==='edition_project'){
  let p:any;
  if(a.action==='update'){
   p=await project(c,a.project_id,uid,a.expected_revision);
   ensure(p.synthetic===a.synthetic,'INVALID_PROJECT','A natureza de homologação não pode mudar depois da criação.');
   await c.query('update araread.edition_projects set title=$2,author=$3,topics=$4,traditions=$5,rights=$6,sample=null,stage=$7 where id=$1',[p.id,a.title,a.author,json(a.topics),json(a.traditions),json(a.rights),'configuration']);return bump(c,p);
  }
  ensure(a.expected_revision===0,'CONFLICT','Um novo projeto começa na revisão zero.',409);
  let inherited:any;
  if(a.action==='fork'){inherited=await one(c,'select * from araread.edition_versions where id=$1 and owner_id=$2',[a.version_id,uid]);ensure(inherited,'NOT_FOUND','Derivação disponível somente para versão própria.',404);}
  const id=randomUUID();await c.query('insert into araread.edition_projects(id,owner_id,title,author,topics,traditions,rights,synthetic,source_ids) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,uid,a.title,a.author,json(a.topics),json(a.traditions),json(a.rights),a.synthetic,inherited?.source_ids||[]]);
  return {project_id:id,revision:0,stage:'sources',derived_from:inherited?.id||null};
 }
 if(name==='edition_plan'){
  const p=a.project_id?await project(c,a.project_id,uid):null;
  const scopeId=a.scope==='account'?uid:a.scope==='session'?identity.session_id:a.scope==='project'?p?.id:a.scope_id;
  ensure(scopeId,'INVALID_SCOPE','Escolha o projeto, perfil ou edição para esta configuração.');
  if(a.scope==='reader'){ensure(await one(c,'select id from araread.edition_versions where id=$1',[scopeId]),'NOT_FOUND','Edição não disponível.',404);ensure(Object.keys(a.values).every(k=>['font','font_size','line_spacing','contrast','resume_mode','tab','humor','mnemonics','activities'].includes(k)),'INVALID_SCOPE','As preferências de leitura selecionam apresentação e apoios já preparados.');}
  const previous=await one(c,'select * from araread.edition_settings where owner_id=$1 and scope=$2 and scope_id=$3 for update',[uid,a.scope,scopeId]);
  ensure((previous?.revision||0)===a.expected_revision,'CONFLICT','A configuração mudou. Recarregue antes de salvar.',409);
  const values=a.action==='reset'?{}:{...previous?.values,...a.values};editionConfig.parse({...editionDefaults,...values});
  const id=previous?.id||randomUUID(),history=[...(previous?.history||[]),{revision:a.expected_revision+1,action:a.action,values:a.values,at:new Date().toISOString(),origin:identity.client_id?'assistant_explicit_request':'author_action'}];
  ensure(history.length<=200,'HISTORY_LIMIT','Este perfil atingiu 200 revisões. Crie outro perfil conservando o histórico.');
  await c.query('insert into araread.edition_settings(id,owner_id,scope,scope_id,revision,values,history) values($1,$2,$3,$4,$5,$6,$7) on conflict(owner_id,scope,scope_id) do update set revision=excluded.revision,values=excluded.values,history=excluded.history',[id,uid,a.scope,scopeId,a.expected_revision+1,json(values),json(history)]);
  if(a.profile_id){ensure(p&&a.scope==='project'&&await one(c,"select id from araread.edition_settings where scope='profile' and scope_id=$1 and owner_id=$2",[a.profile_id,uid]),'INVALID_PROFILE','Selecione um perfil editorial próprio.');}
  if(p&&a.scope==='project'){p.profile_id=a.profile_id===undefined?p.profile_id:a.profile_id;await c.query("update araread.edition_projects set sample=null,stage='configuration',revision=revision+1,profile_id=$2 where id=$1",[p.id,p.profile_id]);}
  return {configuration_id:id,scope:a.scope,scope_id:scopeId,revision:a.expected_revision+1,project_revision:p&&a.scope==='project'?p.revision+1:undefined,config:await settings(c,p,identity)};
 }
 if(name==='edition_reader'){
  const version=await one(c,'select manifest from araread.edition_versions where id=$1',[a.version_id]);ensure(version,'NOT_FOUND','Edição não disponível.',404);const first=version.manifest[0];
  const state=await one(c,'select revision,opened,resume,covered from araread.edition_readers where owner_id=$1 and version_id=$2',[uid,a.version_id])||{revision:0,opened:first,resume:first,covered:[]};
  const annotations=(await c.query('select id,passage_id,kind,target,text,activity_id,response,created_at from araread.edition_annotations where owner_id=$1 and version_id=$2 order by created_at',[uid,a.version_id])).rows;
  const rows=(await c.query('select id,scope,scope_id,revision,values from araread.edition_settings where owner_id=$1 and scope in (\'account\',\'reader\')',[uid])).rows;
  return {version_id:a.version_id,state,annotations,preferences:configuration(rows,undefined,undefined,undefined,a.version_id),coverage_meaning:'Passagens confirmadas pelo leitor; abertura não comprova leitura nem compreensão.'};
 }
 if(name==='edition_annotate')return annotate(c,a,uid);
 if(name==='edition_groups'||name==='edition_group')return dispatchGroups(name,a,c,identity);
 const p=await project(c,a.project_id,uid,a.expected_revision);
 if(name==='edition_source'){
  let s=await one(c,'select id,owner_id from araread.edition_sources where id=$1 and owner_id=$2',[a.source_id,uid]);
  if(!s){
   const legacy=await one(c,'select * from araread.sources where id=$1 and owner_id=$2',[a.source_id,uid]);ensure(legacy,'NOT_FOUND','Fonte própria não encontrada. Importe e confira a extração antes de incorporá-la.',404);
   ensure(legacy.extraction?.quality?.status!=='rejected','INVALID_SOURCE','A extração rejeitada precisa de correção.');
   const work=await one(c,'select title,author from araread.works where id=$1',[legacy.work_id]),blocks=(await c.query('select id,source_id,ordinal,kind,text,locator,meta from araread.elements where source_id=$1 order by ordinal',[legacy.id])).rows;
   const {original,owner_id,work_id,...metadata}=legacy;await quota(Buffer.byteLength(json(blocks))+Buffer.byteLength(json(metadata))+(original?.length||0));
   await c.query('insert into araread.edition_sources(id,owner_id,metadata,blocks,canonical_sha256,original) values($1,$2,$3,$4,$5,$6)',[legacy.id,uid,json({...metadata,...work}),json(blocks),legacy.canonical_sha256||canonicalHash(blocks),original]);s=legacy;
  }
  ensure(!p.source_ids.includes(s.id),'EXISTS','A fonte já integra o projeto.');
  await c.query("update araread.edition_projects set source_ids=array_append(source_ids,$2),sample=null,stage='configuration' where id=$1",[p.id,s.id]);return {...await bump(c,p),source_id:s.id,immutable_snapshot:true};
 }
 const ss=await sources(c,p.source_ids),config=await settings(c,p,identity);
 const signature=hash({source_ids:p.source_ids,config:config.values,rights:p.rights});
 if(name==='edition_sample'){
  ensure(p.source_ids.length,'SOURCE_REQUIRED','Incorpore uma fonte antes da amostra.');
  if(a.action==='prepare'){
   ensure(a.passage,'SAMPLE_REQUIRED','Envie uma passagem completa com original alinhado e apoios.');
   ensure(a.passage.supports.some((s:any)=>['context','definition'].includes(s.kind))&&a.passage.supports.some((s:any)=>s.kind==='example'),'SAMPLE_REQUIRED','A amostra precisa de contexto ou terminologia e um exemplo.');
   const saved=await savePassage(c,p,a.passage,ss,config.values.language,signature);
   await c.query("update araread.edition_projects set manifest=$2,sample=$3,stage='sample' where id=$1",[p.id,p.manifest,json({passage_id:saved.id,signature,decision:'pending',reason:a.reason})]);return {...await bump(c,p),sample:saved};
  }
  ensure(p.sample?.signature===signature,'STALE_SAMPLE','Prepare a amostra com a configuração e fontes atuais.');
  if(a.action==='approve'){
   ensure(a.decision_origin==='synthetic_fixture'?p.synthetic:!identity.client_id&&a.decision_origin==='author_action','HUMAN_ACTION_REQUIRED','Aprovação da pessoa autora ocorre na interface. O assistente só simula aprovação em fixture sintética declarada.',403);
   const sample=await one(c,'select assessment from araread.edition_passages where id=$1',[p.sample.passage_id]);ensure(sample?.assessment.ready,'EDITORIAL_PENDING','Resolva os riscos editoriais da amostra.');
  }
  const sample={...p.sample,decision:a.action==='approve'?'approved':'needs_changes',decision_origin:a.decision_origin||'assistant_request',reason:a.reason,decided_at:new Date().toISOString()};
  await c.query('update araread.edition_projects set sample=$2,stage=$3 where id=$1',[p.id,json(sample),a.action==='approve'?'production':'sample']);return {...await bump(c,p),sample};
 }
 if(name==='edition_batch'){
  ensure(p.sample?.decision==='approved'&&p.sample.signature===signature,'SAMPLE_REQUIRED','A produção exige amostra aprovada com a configuração atual.');
  const saved=[];for(const passage of a.passages){ensure(passage.key!==(await one(c,'select key from araread.edition_passages where id=$1',[p.sample.passage_id]))?.key,'SAMPLE_CHANGED','Revise a amostra pela etapa própria antes de substituí-la.');saved.push(await savePassage(c,p,passage,ss,config.values.language,signature));}
  await c.query('update araread.edition_projects set manifest=$2 where id=$1',[p.id,p.manifest]);return {...await bump(c,p),saved};
 }
 if(name==='edition_review'){
  for(const id of a.passage_ids){ensure(p.manifest.includes(id),'INVALID_REVIEW','Revise versões atuais do projeto.');await c.query('insert into araread.edition_reviews(id,owner_id,project_id,passage_id,decision,note,reviewer_kind) values($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),uid,p.id,id,a.decision,a.note,p.synthetic?'synthetic_fixture':identity.client_id?'assistant':'author_action']);}
  return {...await bump(c,p),reviewed:a.passage_ids,academic_review_inferred:false};
 }
 if(name==='edition_publish'){
  if(a.action==='withdraw'){
   const v=await one(c,'select id from araread.edition_versions where id=$1 and project_id=$2 and owner_id=$3',[a.version_id,p.id,uid]);ensure(v,'NOT_FOUND','Versão própria não encontrada.',404);
   await c.query("update araread.edition_versions set state='withdrawn',revision=revision+1 where id=$1",[v.id]);return {...await bump(c,p),version_id:v.id,withdrawn:true};
  }
  ensure(p.sample?.decision==='approved'&&p.sample.signature===signature,'SAMPLE_REQUIRED','A publicação exige a aprovação válida da amostra.');
  ensure(a.visibility==='private'||p.rights.status!=='private_only'&&p.rights.license.trim()&&p.rights.evidence.trim()&&(a.visibility==='public'?p.rights.allow_public:p.rights.allow_sharing),'PUBLICATION_RIGHTS','Direitos insuficientes para disponibilizar esta edição. Mantenha privada.');
  const all=await passages(c,p.manifest),coverage=editionCoverage(all.map(r=>r.content),ss);ensure(coverage.complete,'INCOMPLETE_EDITION','Há lacunas ou sobreposições no texto preparado. Consulte a cobertura no projeto.');
  ensure(all.every(r=>r.assessment.ready),'EDITORIAL_PENDING','Há passagens com riscos editoriais pendentes.');
  ensure(all.every(r=>r.assessment.configuration_signature===signature),'STALE_PRODUCTION','Há passagens preparadas com outra configuração, fontes ou direitos. Prepare e revise as versões atuais antes de publicar.');
  ensure(new Set(all.map(r=>r.content.ordinal)).size===all.length,'INVALID_ORDER','Cada passagem precisa de posição distinta na ordem da fonte.');
  for(const item of all){const review=await one(c,'select decision from araread.edition_reviews where passage_id=$1 order by created_at desc,id desc limit 1',[item.id]);ensure(review?.decision==='accepted','REVIEW_REQUIRED','Revise todas as passagens atuais antes da publicação.');}
  const ordered=all.sort((a,b)=>a.content.ordinal-b.content.ordinal),refs=ordered.flatMap(r=>r.content.refs);
  const position=(r:any)=>[p.source_ids.indexOf(r.source_id),sourceElement(ss,r).element.ordinal,r.start];
  for(let i=1;i<refs.length;i++){const before=position(refs[i-1]),after=position(refs[i]);ensure(after[0]>before[0]||after[0]===before[0]&&(after[1]>before[1]||after[1]===before[1]&&after[2]>=before[2]),'INVALID_ORDER','A ordem editorial deve conservar a ordem dos intervalos da fonte.');}
  const manifest=ordered.map(r=>r.id),version=Number((await one(c,'select coalesce(max(version),0)+1 n from araread.edition_versions where project_id=$1',[p.id])).n),id=randomUUID();
  const publishedConfig=publishedConfiguration(config);
  const review={sample:p.sample,note:a.note,coverage,academic_review_inferred:false,synthetic:p.synthetic};
  const digest=hash({manifest:all.map(r=>({id:r.id,sha256:r.sha256})),sources:ss.map(s=>({id:s.id,sha256:s.canonical_sha256})),config:publishedConfig,rights:p.rights,version});
  await c.query('insert into araread.edition_versions(id,owner_id,project_id,version,title,author,topics,traditions,rights,config,source_ids,manifest,sha256,review,visibility,state) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[id,uid,p.id,version,p.title,p.author,json(p.topics),json(p.traditions),json(p.rights),json(publishedConfig),p.source_ids,manifest,digest,json(review),a.visibility,a.visibility==='public'?'published':a.visibility==='invited'?'shared':'approved']);
  await c.query('update araread.edition_projects set version_configurations=version_configurations||jsonb_build_object($2::text,$3::jsonb) where id=$1',[p.id,id,json({values:config.values,origins:config.origins,precedence:config.precedence})]);
  await c.query("update araread.edition_versions set state='replaced',revision=revision+1 where project_id=$1 and id<>$2 and state in ('published','shared')",[p.id,id]);
  return {...await bump(c,p),version_id:id,version,sha256:digest,visibility:a.visibility,coverage};
 }
 ensure(false,'TOOL_NOT_FOUND','Operação editorial desconhecida.');
}
export async function catalog(c:PoolClient,a:any){
 const field=a.entry==='concept'?'topics::text':a.entry==='tradition'?'traditions::text':"title||' '||author";
 const rows=(await c.query(`select id,project_id,version,title,author,topics,traditions,visibility,state,sha256,created_at from araread.edition_versions where (${field}) ilike $1 and state<>'withdrawn' order by created_at desc,id limit $2 offset $3`,[`%${a.query}%`,a.limit,a.offset])).rows;
 const total=Number((await one(c,`select count(*) n from araread.edition_versions where (${field}) ilike $1 and state<>'withdrawn'`,[`%${a.query}%`])).n);
 return {items:rows,pagination:{offset:a.offset,limit:a.limit,total,next_offset:a.offset+a.limit<total?a.offset+a.limit:null}};
}
async function annotate(c:PoolClient,a:any,uid:string){
 const v=await one(c,'select manifest,source_ids,state from araread.edition_versions where id=$1',[a.version_id]);ensure(v&&v.state!=='withdrawn','NOT_FOUND','Esta versão não está disponível para novas alterações.',404);
 let state=await one(c,'select * from araread.edition_readers where owner_id=$1 and version_id=$2 for update',[uid,a.version_id]);
 ensure((state?.revision||0)===a.expected_revision,'CONFLICT','O estado do leitor mudou. Confira a retomada antes de reaplicar a intenção.',409);
 if(!state){await c.query('insert into araread.edition_readers(owner_id,version_id,opened,resume) values($1,$2,$3,$3)',[uid,a.version_id,v.manifest[0]]);state={revision:0,opened:v.manifest[0],resume:v.manifest[0],covered:[]};}
 let result:any={};
 if(a.action==='resume')state.opened=state.resume;
 else if(a.action==='delete'){
  let id=a.annotation_id;if(a.annotation_operation_id){const receipt=await one(c,'select result from araread.receipts where owner_id=$1 and operation_id=$2',[uid,a.annotation_operation_id]);ensure(receipt?.result.version_id===a.version_id&&receipt.result.annotation_id,'NOT_FOUND','A criação desta anotação ainda não foi confirmada nesta conta e versão.',404);id=receipt.result.annotation_id;}
  const deleted=await c.query('delete from araread.edition_annotations where id=$1 and owner_id=$2 and version_id=$3 returning id',[id,uid,a.version_id]);ensure(deleted.rowCount,'NOT_FOUND','Anotação pessoal não encontrada.',404);result={deleted:true,annotation_id:id};
 }
 else {
  ensure(v.manifest.includes(a.passage_id),'INVALID_REF','Escolha uma passagem desta versão.');
  if(a.action==='open')state.opened=a.passage_id;
  else if(a.action==='continue'){
   ensure(state.opened===a.passage_id||state.resume===a.passage_id,'POSITION_CHANGED','Confirme somente a passagem aberta ou da retomada.',409);
   if(!state.covered.includes(a.passage_id))state.covered.push(a.passage_id);
   const next=v.manifest[v.manifest.indexOf(a.passage_id)+1]||a.passage_id;
   if(state.opened===a.passage_id)state.opened=next;if(state.resume===a.passage_id)state.resume=next;
  }else{
   const row=await one(c,'select content from araread.edition_passages where id=$1',[a.passage_id]);
   if(a.target){ensure(a.target.passage_id===a.passage_id,'INVALID_SELECTION','A seleção pertence a outra passagem.');checkSelection(row.content,await sources(c,v.source_ids),a.target);}
   ensure(a.action!=='highlight'||a.target,'INVALID_SELECTION','Selecione um trecho para destacar.');
   if(a.action==='review')ensure(!await one(c,"select id from araread.edition_annotations where owner_id=$1 and version_id=$2 and passage_id=$3 and kind='review'",[uid,a.version_id,a.passage_id]),'EXISTS','Esta passagem já está marcada para revisão.');
   let response=null;
   if(a.action==='answer'){const activity=row.content.activities.find((x:any)=>x.id===a.activity_id);ensure(activity,'NOT_FOUND','Atividade não encontrada nesta passagem.',404);response=activityFeedback(activity,a.text,a.self_assessment);}
   else if(!['highlight','review'].includes(a.action))ensure(a.text.trim(),'EMPTY_NOTE','Escreva o conteúdo da anotação.');
   const id=randomUUID();await c.query('insert into araread.edition_annotations(id,owner_id,version_id,passage_id,kind,target,text,activity_id,response) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,uid,a.version_id,a.passage_id,a.action,a.target?json(a.target):null,a.text,a.activity_id||null,response?json(response):null]);result={annotation_id:id,response};
  }
 }
 await c.query('update araread.edition_readers set revision=revision+1,opened=$3,resume=$4,covered=$5 where owner_id=$1 and version_id=$2',[uid,a.version_id,state.opened,state.resume,state.covered]);
 return {version_id:a.version_id,revision:a.expected_revision+1,state:{opened:state.opened,resume:state.resume,covered:state.covered,revision:a.expected_revision+1},...result};
}
