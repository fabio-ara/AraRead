import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {config} from '../src/config.ts';
import {authenticate} from '../src/auth.ts';
import {execute} from '../src/service.ts';
import {transaction,pool,type Identity} from '../src/db.ts';
import {publicEdition} from '../src/editions/public.ts';
import {demoOriginals,demoRights,demoPassage} from './fixtures/study-edition.ts';
import {activityFeedback} from '../src/editions/model.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Teste exclusivo do banco isolado sintético.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(index:number){const response=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[index])});assert.equal(response.status,200);return authenticate(`Bearer ${(await response.json()).access_token}`);}
const alice=await login(0),bob=await login(1),call=(name:any,args:any,who:Identity=alice)=>execute(name,args,who),op=()=>randomUUID();
let p:any,version:any,first:any,group:any;const imported:any[]=[],content:any[]=[];
const edit=(args:any)=>({operation_id:op(),project_id:p.project_id,expected_revision:p.revision,...args});
after(async()=>{for(const s of imported)await call('work_delete',{operation_id:op(),work_id:s.work_id,confirm_title:s.title});await pool.end();});
test('edição compartilhada: autoria, duas contas, RLS, anonimato e estudo sem geração',async t=>{
 await t.test('fontes próprias são incorporadas sem modificar legado',async()=>{
  for(const [i,language]of ['en','pt-BR'].entries()){
   const title=`Homologação edição ${language} ${op()}`,s=await call('source_import',{operation_id:op(),title,original_language:language,partial:false,format:'structured',blocks:demoOriginals.slice(i*2,i*2+2).map(text=>({kind:'paragraph',text,meta:{}}))});imported.push({...s,title});
   const elements=await call('source_elements',{reading_id:s.reading_id,limit:50});for(const item of elements.items)content.push(demoPassage(content.length,item.full_ref));
  }
  p=await call('edition_project',{operation_id:op(),expected_revision:0,action:'create',title:`Edição sintética ${op()}`,author:'AraRead',rights:demoRights,synthetic:true,topics:['Hipótese','Evidência'],traditions:['Comparação sintética']});
  for(const s of imported)p={...p,...await call('edition_source',edit({source_id:s.source_id}))};
  const context=await call('edition_context',{project_id:p.project_id});assert.equal(context.coverage.complete,false);assert.equal(context.steps.length,4);assert.equal(context.sources.length,2);
  await assert.rejects(()=>call('edition_context',{project_id:p.project_id},bob),{code:'NOT_FOUND'});
  await assert.rejects(()=>publicEdition('edition_context',{project_id:p.project_id}),{code:'NOT_FOUND'});
  const legacy=await call('reading_context',{reading_id:imported[0].reading_id});assert.equal(legacy.reading.revision,0);assert.equal(legacy.original,demoOriginals[0]);
 });
 await t.test('configuração persistida tem origem e produção exige amostra',async()=>{
  const plan=await call('edition_plan',{operation_id:op(),expected_revision:0,project_id:p.project_id,scope:'project',action:'set',values:{language:'pt-BR',humor:'light',prior_knowledge:'Marcador privado de conhecimento prévio',font_size:27},explicit_request:true});p.revision=plan.project_revision;
  assert.equal(plan.config.origins.humor.scope,'project');assert.equal(plan.config.origins.font.scope,'default');
  await assert.rejects(()=>call('edition_batch',edit({passages:[content[1]]})),{code:'SAMPLE_REQUIRED'});
  const sample=await call('edition_sample',edit({action:'prepare',passage:content[0],reason:'A condição e a negação tornam esta passagem representativa.'}));p.revision=sample.revision;first=sample.sample.id;assert.equal(sample.sample.assessment.ready,true);
  await assert.rejects(()=>call('edition_sample',edit({action:'approve',reason:'Alegação indevida de ação humana.',decision_origin:'author_action'}),{...alice,client_id:op()}),{code:'HUMAN_ACTION_REQUIRED'});
  p={...p,...await call('edition_sample',edit({action:'approve',reason:'Homologação sintética expressamente autorizada no mandato.',decision_origin:'synthetic_fixture'}))};
 });
 await t.test('lote idempotente, concorrência e publicação verificam revisão e cobertura',async()=>{
  const args=edit({passages:content.slice(1)}),saved=await call('edition_batch',args);assert.deepEqual(await call('edition_batch',args),saved);p.revision=saved.revision;
  await assert.rejects(()=>call('edition_batch',{...args,operation_id:op()}),{code:'CONFLICT'});
  const context=await call('edition_context',{project_id:p.project_id});assert.equal(context.coverage.complete,true);assert.equal(context.outline.length,4);
  await assert.rejects(()=>call('edition_publish',edit({action:'publish',visibility:'public',note:'Verificação de cobertura antes de revisão.'})),{code:'REVIEW_REQUIRED'});
  p={...p,...await call('edition_review',edit({passage_ids:context.outline.map((x:any)=>x.id),decision:'accepted',note:'Revisão declarada dos quatro textos sintéticos, sem riscos estruturais pendentes.'}))};
  version=await call('edition_publish',edit({action:'publish',visibility:'public',note:'Demonstração original autorizada e revisada como fixture sintética.'}));p.revision=version.revision;
  const publicContext:any=await publicEdition('edition_context',{version_id:version.version_id});assert.equal(publicContext.outline.length,4);assert.equal(publicContext.generative_calls_required,false);assert.equal(publicContext.passage.originals[0].text,demoOriginals[0]);assert.equal(JSON.stringify(publicContext.config).includes(alice.session_id),false);assert.equal(JSON.stringify(publicContext).includes('Marcador privado de conhecimento prévio'),false);assert.equal(publicContext.config.values.font_size,undefined);const ownProject=await call('edition_context',{project_id:p.project_id});assert.equal(ownProject.project.version_configurations[version.version_id].values.prior_knowledge,'Marcador privado de conhecimento prévio');
  assert.equal((await call('edition_context',{version_id:version.version_id},bob)).passage.id,first);
 });
 await t.test('progresso e anotações são separados e acesso SQL cruzado é negado',async()=>{
  const a=await call('edition_reader',{version_id:version.version_id}),b=await call('edition_reader',{version_id:version.version_id},bob);assert.equal(a.state.revision,0);assert.equal(b.state.revision,0);
  const target={passage_id:first,...content[0].supports[0].target};
  const note=await call('edition_annotate',{operation_id:op(),expected_revision:0,version_id:version.version_id,action:'note',passage_id:first,target,text:'Nota privada de A.'});assert.equal(note.revision,1);
  await call('edition_annotate',{operation_id:op(),expected_revision:0,version_id:version.version_id,action:'highlight',passage_id:first,target},bob);
  const privateA=await call('edition_reader',{version_id:version.version_id}),privateB=await call('edition_reader',{version_id:version.version_id},bob);assert.equal(privateA.annotations.length,1);assert.equal(privateB.annotations.length,1);assert.equal(privateB.annotations[0].text,'');
  await transaction(bob,async c=>assert.equal((await c.query('select * from araread.edition_annotations where id=$1',[note.annotation_id])).rowCount,0));
  const answer=await call('edition_annotate',{operation_id:op(),expected_revision:1,version_id:version.version_id,action:'answer',passage_id:first,activity_id:content[0].activities[0].id,text:'Não'},bob);assert.equal(answer.response.correct,true);assert.equal(answer.response.generative_call,false);
  const move={expected_revision:1,version_id:version.version_id,action:'continue',passage_id:first};const results=await Promise.allSettled([call('edition_annotate',{...move,operation_id:op()}),call('edition_annotate',{...move,operation_id:op()})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual((await call('edition_reader',{version_id:version.version_id},bob)).state.covered,[]);
  const resumed=await call('edition_reader',{version_id:version.version_id},await login(0));assert.equal(resumed.state.covered.length,1);
  await call('edition_plan',{operation_id:op(),expected_revision:0,scope:'reader',scope_id:version.version_id,action:'set',values:{font_size:24},explicit_request:true});
  const personal=await call('edition_reader',{version_id:version.version_id});assert.equal(personal.preferences.values.font_size,24);assert.equal(personal.preferences.origins.font_size.scope,'reader');assert.deepEqual(personal.preferences.precedence,['reader','account','default']);assert.notEqual((await call('edition_reader',{version_id:version.version_id},bob)).preferences.values.font_size,24);
  const supports=content[0].supports;assert.equal(supports.some((s:any)=>s.kind==='mnemonic'),true);assert.equal(supports.some((s:any)=>s.kind==='humor'),true);
  assert.equal(activityFeedback(content[0].activities[1],'Texto livre').correct,null);
 });
 await t.test('leituras e apoios armazenados não efetuam HTTP de geração nem modificam estado',async()=>{
  const before=await call('edition_reader',{version_id:version.version_id},bob),requests:string[]=[],previous=globalThis.fetch;
  globalThis.fetch=async input=>{requests.push(String(input));throw Error('HTTP externo inesperado no leitor preparado.');};
  try{
   const opened=await call('edition_context',{version_id:version.version_id},bob);
   for(const row of opened.outline){const c=await call('edition_context',{version_id:version.version_id,passage_id:row.id},bob);assert(c.passage.content.segments.length>0);assert(c.passage.content.supports.length>0);for(const activity of c.passage.content.activities)assert.equal(activityFeedback(activity,activity.answer).generative_call,false);}
   assert.deepEqual(await call('edition_reader',{version_id:version.version_id},bob),before);assert.deepEqual(requests,[]);
  }finally{globalThis.fetch=previous;}
 });
 await t.test('grupos por convite isolam comentários e saída revoga acesso',async()=>{
  group=await call('edition_group',{operation_id:op(),expected_revision:0,action:'create',version_id:version.version_id,title:'Grupo sintético'});
  assert.equal((await call('edition_groups',{group_id:group.group_id},bob)).items.length,0);
  const invite=await call('edition_group',{operation_id:op(),expected_revision:group.revision,action:'invite',group_id:group.group_id});group.revision=invite.revision;
  await assert.rejects(()=>call('edition_group',{operation_id:op(),expected_revision:0,action:'join',invite_code:'inexistente'},bob),{code:'INVALID_INVITE'});
  group.revision=(await call('edition_group',{operation_id:op(),expected_revision:0,action:'join',invite_code:invite.invite_code},bob)).revision;
  const comment=await call('edition_group',{operation_id:op(),expected_revision:group.revision,action:'comment',group_id:group.group_id,passage_id:first,text:'Comentário voluntariamente compartilhado.'},bob);group.revision=comment.revision;
  const shared=await call('edition_groups',{group_id:group.group_id});assert.equal(shared.comments.length,1);assert.equal(shared.private_notes_included,false);
  await call('edition_group',{operation_id:op(),expected_revision:group.revision,action:'leave',group_id:group.group_id},bob);
  assert.equal((await call('edition_groups',{group_id:group.group_id},bob)).comments.length,0);
 });
 await t.test('remoção usa recibo da criação offline e continua disponível com a cota atingida',async()=>{
  let state=(await call('edition_reader',{version_id:version.version_id})).state;
  const creation={operation_id:op(),expected_revision:state.revision,version_id:version.version_id,action:'note',passage_id:first,text:'Nota temporária cuja identidade local é a operação.'};
  const saved=await call('edition_annotate',creation),limit=config.maxAccountBytes;
  try{
   config.maxAccountBytes=1;
   const usage=await call('account_context',{});assert(usage.capabilities.used_bytes>1);
   await assert.rejects(()=>call('edition_annotate',{...creation,operation_id:op(),expected_revision:saved.revision}),{code:'QUOTA'});
   const args={operation_id:op(),expected_revision:saved.revision,version_id:version.version_id,action:'delete',annotation_operation_id:creation.operation_id};
   const removed=await call('edition_annotate',args);assert.equal(removed.annotation_id,saved.annotation_id);assert.equal(removed.deleted,true);assert.deepEqual(await call('edition_annotate',args),removed);
   assert.equal((await call('edition_reader',{version_id:version.version_id})).annotations.some((n:any)=>n.id===saved.annotation_id),false);
  }finally{config.maxAccountBytes=limit;}
 });
 await t.test('mudança editorial exige regenerar passagens, preservando versão publicada e notas',async()=>{
  const before=await call('edition_context',{version_id:version.version_id}),personal=await call('edition_reader',{version_id:version.version_id});
  const plan=await call('edition_plan',{operation_id:op(),expected_revision:1,project_id:p.project_id,scope:'project',action:'set',values:{explanation:'detailed'},explicit_request:true});p.revision=plan.project_revision;
  p={...p,...await call('edition_sample',edit({action:'prepare',passage:content[0],reason:'Nova amostra para a configuração editorial alterada.'}))};
  p={...p,...await call('edition_sample',edit({action:'approve',reason:'Aprovação sintética da nova configuração.',decision_origin:'synthetic_fixture'}))};
  await assert.rejects(()=>call('edition_publish',edit({action:'publish',visibility:'public',note:'Tentativa controlada de misturar configurações diferentes.'})),{code:'STALE_PRODUCTION'});
  const after=await call('edition_context',{version_id:version.version_id});assert.equal(after.version.sha256,before.version.sha256);assert.deepEqual(after.passage,before.passage);assert.deepEqual(await call('edition_reader',{version_id:version.version_id}),personal);
  const display=await call('reading_display',{version_id:version.version_id});assert.equal(display.ready,true);assert.equal(display.edition,true);assert.equal(display.passage.id,first);assert.match(display.fallback_text,/Tradução/);
  const sample=await call('reading_display',{project_id:p.project_id});assert.equal(sample.permissions.write,false);
 });
});
