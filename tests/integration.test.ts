import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { execute,sections as backupSections } from '../src/service.ts';
import { pool,transaction,type Identity } from '../src/db.ts';
import { authenticate } from '../src/auth.ts';
import { config } from '../src/config.ts';
import { SignJWT,importJWK } from 'jose';

if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw new Error('Esta suíte é exclusiva do banco local sintético do AraRead.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(index=0){const res=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[index])});assert.equal(res.status,200,'login real no Supabase Auth local');return res.json();}
const a=await login(),b=await login(1),alice=await authenticate(`Bearer ${a.access_token}`),bob=await authenticate(`Bearer ${b.access_token}`);
const call=(tool:any,args:any={},who:Identity=alice)=>execute(tool,args,who);
const op=()=>randomUUID();
const title=`Amostra sintética de leitura ${op()}`;
const long=('Uma hipótese (suposição a examinar) pode ser válida sob condições limitadas. Isso não implica certeza. ').repeat(85);
let created:any,context:any;
const refresh=async(position='resume',extra:any={})=>context=await call('reading_context',{reading_id:created.reading_id,position,...extra});
const mutation=(args:any)=>({operation_id:op(),reading_id:created.reading_id,expected_revision:context.reading.revision,...args});

test('percurso durável e isolamento com PostgreSQL e duas identidades reais',async t=>{
 const initial=await call('account_context');if(initial.preferences.language!=='pt-BR')await call('preferences_set',{operation_id:op(),expected_revision:initial.preferences.revision,language:'pt-BR'});
 await t.test('importar preserva original, referências e padrão pt-BR',async()=>{
  created=await call('source_import',{operation_id:op(),title,original_language:'en',partial:true,format:'structured',blocks:[{kind:'paragraph',text:long,meta:{}},{kind:'equation',text:'a² + b² = c²',meta:{notation:'original'}},{kind:'proof',text:'Amostra de demonstração: hipótese → construção → conclusão condicional. Não constitui prova de um teorema real.',meta:{figure:'F1'}},{kind:'figure',text:'F1: descrição sintética fornecida. Não observada pelo assistente.',meta:{observed:false}},{kind:'paragraph',text:'Talvez duas posições sejam compatíveis; a atribuição permanece ambígua. العربية 日本語 א ב 😀',meta:{}}]});
  await refresh();assert.equal(context.effective_language,'pt-BR');assert.equal(context.source.partial,true);assert.ok(context.ref.end<Array.from(long).length);assert.equal(context.reading.covered.length,0);
  const orig=await transaction(alice,async c=>(await c.query('select original,sha256 from araread.sources where id=$1',[created.source_id])).rows[0]);assert.equal(createHash('sha256').update(orig.original).digest('hex'),orig.sha256);
  const firstRev=context.reading.revision;await refresh();await call('source_elements',{reading_id:created.reading_id});assert.equal((await refresh()).reading.revision,firstRev);
 });
 await t.test('mediação salva, segunda leitura, histórico e idempotência após resposta perdida',async()=>{
  const args=mutation({ref:context.ref,rewrite:'A hipótese (suposição que será examinada) pode valer em certas condições. O texto não afirma que seja sempre verdadeira.',language:'pt-BR',provenance:{agent:'Teste editorial sintético',guidance_version:'1.0.0'}});
  const receipt=await call('mediation_save',args);assert.equal(receipt.status,'confirmed');const second=await call('operation_get',{operation_id:args.operation_id});assert.deepEqual(receipt,second);
  await refresh();assert.match(context.mediation.rewrite,/certas condições/);assert.deepEqual(await call('mediation_save',args),receipt);
  await assert.rejects(()=>call('mediation_save',{...args,rewrite:'Outra intenção'}),{code:'IDEMPOTENCY_MISMATCH'});
  await assert.rejects(()=>call('mediation_save',{...args,operation_id:op(),expected_revision:context.reading.revision}),{code:'EXISTS'});
  const regen=mutation({...args,operation_id:op(),expected_revision:context.reading.revision,regenerate:true,rewrite:'Versão alternativa sintética: a hipótese pode valer, se as condições forem satisfeitas.'});
  await call('mediation_save',regen);await refresh();const history=await call('reading_history',{reading_id:created.reading_id,kind:'mediations'});assert.equal(history.items.length,2);
 });
 await t.test('perguntas, respostas, termos e marcas preservam posição e origem',async()=>{
  const resume=context.reading.resume,question=await call('note_save',mutation({ref:context.ref,kind:'question',text:'A condição é suficiente?',origin:'user'}));await refresh();
  await call('note_save',mutation({ref:context.ref,kind:'answer',text:'O exemplo sintético não afirma suficiência.',origin:'assistant',reply_to:question.entity_id}));await refresh();
  await call('term_save',mutation({ref:context.ref,term:'hipótese',definition:'Suposição a examinar, neste contexto.',origin:'assistant'}));await refresh();
  await call('note_save',mutation({ref:context.ref,kind:'doubt',text:'Rever condição.',origin:'user'}));await refresh();
  assert.deepEqual(context.reading.resume,resume);assert.equal(context.reading.covered.length,0);assert.equal(context.terms[0].term,'hipótese');assert.equal(context.pending_questions.length,0);assert.equal(context.notes.find((n:any)=>n.kind==='answer').origin,'assistant');
 });
 await t.test('continuidade cobre só a porção confirmada; rever e saltar não preenchem lacunas',async()=>{
  const first=context.ref;await call('reading_move',mutation({action:'continue',ref:first}));await refresh();const principal=context.reading.resume;
  assert.equal(context.reading.covered[0].end,first.end);assert.ok(context.reading.covered[0].end<Array.from(long).length);
  await call('reading_move',mutation({action:'open',ref:first}));await refresh('opened');assert.deepEqual(context.reading.resume,principal);assert.deepEqual(context.ref,first);
  await call('reading_move',mutation({action:'continue',ref:first}));await refresh('opened');assert.deepEqual(context.reading.resume,principal);
  const index=await call('source_elements',{reading_id:created.reading_id});const later=index.items.at(-1).ref;await call('reading_move',mutation({action:'open',ref:later}));await refresh('opened');assert.deepEqual(context.reading.resume,principal);assert.equal(context.reading.covered.length,1);
  await call('reading_move',mutation({action:'resume'}));await refresh();assert.deepEqual(context.ref,principal);
 });
 await t.test('precedência de idioma e escolha temporária sem perda de estado',async()=>{
  const pref=await call('account_context');await call('preferences_set',{operation_id:op(),expected_revision:pref.preferences.revision,language:'en'});
  await refresh();assert.equal(context.effective_language,'en');await call('preferences_set',mutation({language:'ar'}));await refresh();assert.equal(context.effective_language,'ar');
  await refresh('resume',{language:'ja'});assert.equal(context.effective_language,'ja');await refresh();assert.equal(context.effective_language,'ar');
  await call('preferences_set',mutation({language:'pt-BR'}));await refresh();assert.equal(context.effective_language,'pt-BR');assert.ok(context.reading.covered.length);assert.ok((await call('reading_history',{reading_id:created.reading_id,kind:'mediations'})).items.length===2);
  await assert.rejects(()=>call('reading_context',{reading_id:created.reading_id,language:'not a language'}),{code:'VALIDATION'});
 });
 await t.test('revisões concorrentes e falha antes do commit não produzem estado parcial',async()=>{
  const args=mutation({action:'open',ref:context.ref}),other={...args,operation_id:op()};
  const result=await Promise.allSettled([call('reading_move',args),call('reading_move',other)]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.filter(x=>x.status==='rejected').length,1);await refresh();
  const bad=mutation({ref:{...context.ref,end:99999999},kind:'note',text:'Não salvar',origin:'user'}),before=context.reading.revision;
  await assert.rejects(()=>call('note_save',bad),{code:'INVALID_REF'});assert.equal((await call('operation_get',{operation_id:bad.operation_id})).status,'unknown');await refresh();assert.equal(context.reading.revision,before);
 });
 await t.test('duas contas: busca, fonte, recibo, exportação e relações cruzadas bloqueadas pelo RLS',async()=>{
  assert.equal((await call('library_list',{query:title},bob)).items.length,0);
  await assert.rejects(()=>call('reading_context',{reading_id:created.reading_id},bob),{code:'NOT_FOUND'});
  await assert.rejects(()=>call('note_save',mutation({ref:context.ref,kind:'note',text:'invasão',origin:'user'}),bob),{code:'NOT_FOUND'});
  const rows=await transaction(bob,async c=>(await c.query('select id from araread.sources where id=$1',[created.source_id])).rows);assert.equal(rows.length,0);
  await assert.rejects(()=>transaction(bob,async c=>c.query('insert into araread.elements(id,owner_id,source_id,ordinal,kind,text,locator) values($1,$2,$3,999,$4,$5,$6)',[op(),bob.id,created.source_id,'paragraph','sintético','x'])),(err:any)=>err.code==='23503');
  assert.equal((await call('operation_get',{operation_id:created.operation_id},bob)).status,'unknown');
  assert.ok(!(await call('data_export',{section:'works'},bob)).items.some((x:any)=>x.id===created.work_id));
 });
 await t.test('nota crítica exige proveniência e distingue verificação pendente',async()=>{
  const args=mutation({ref:context.ref,rewrite:'Amostra de reescrita.',additions:[{kind:'critical_note',text:'A afirmação exige exame.'}],provenance:{agent:'teste',guidance_version:'1.0.0'}});
  await assert.rejects(()=>call('mediation_save',args),{code:'MISSING_SUPPORT'});
  await call('mediation_save',{...args,additions:[{kind:'critical_note',text:'Verificação pendente.',support:{claim:'Afirmação da amostra.',relation:'Apoio ao trecho.',classification:'nao_verificado',claim_type:'empirica',sources:[],limits:'Nenhuma fonte externa foi consultada.'}}]});await refresh();
 });
 await t.test('fonte parcial, próxima passagem e nova versão conservam a leitura anterior',async()=>{
  const prior=context.reading.resume,newVersion=await call('source_import',{operation_id:op(),title,work_id:created.work_id,derives_from:created.source_id,format:'text',text:'Próxima passagem sintética; sequência ainda parcial.',original_language:'pt',partial:true,edition:'Transcrição corrigida vinculada'});
  const updated=await call('reading_context',{reading_id:newVersion.reading_id});assert.match(updated.end_message,/parcialmente/);assert.notEqual(updated.source.id,created.source_id);assert.deepEqual((await refresh()).reading.resume,prior);
  await assert.rejects(()=>call('reading_context',{reading_id:created.reading_id,ref:updated.ref}),{code:'INVALID_REF'});
 });
 await t.test('outra sessão e reconexão ao PostgreSQL preservam explicações, idioma e retomada',async()=>{
  const newSession=await login(),newIdentity=await authenticate(`Bearer ${newSession.access_token}`);
  const second=await call('reading_context',{reading_id:created.reading_id},newIdentity);assert.deepEqual(second.reading.resume,context.reading.resume);assert.equal(second.effective_language,'pt-BR');assert.ok(second.mediation);assert.ok((await call('reading_history',{reading_id:created.reading_id,kind:'notes'},newIdentity)).items.length>=3);
 });
 await t.test('exportação e restauração preservam relações, bytes, cobertura e histórico com IDs novos',async()=>{
  let snapshot:string|undefined;const sections:Record<string,any[]>={};for(const section of backupSections){
   let offset:number|null=0;sections[section]=[];while(offset!==null){const page=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=page.snapshot;sections[section].push(...page.items);offset=page.pagination.next_offset;}
  }
  const bundle={format:'araread/3',snapshot,sections};const restored=await call('data_restore',{operation_id:op(),bundle},bob);assert.ok(restored.id_map[created.reading_id]);
  const restoredContext=await call('reading_context',{reading_id:restored.id_map[created.reading_id]},bob);assert.equal(restoredContext.original,context.original);assert.equal(restoredContext.mediation.rewrite,context.mediation.rewrite);assert.equal(restoredContext.reading.covered.length,context.reading.covered.length);assert.notEqual(restoredContext.source.id,context.source.id);
  const tampered=structuredClone(bundle);tampered.sections.readings[0].resume.end=999999;await assert.rejects(()=>call('data_restore',{operation_id:op(),bundle:tampered},bob),{code:'INVALID_REF'});
  for(const work of sections.works)await call('work_delete',{operation_id:op(),work_id:restored.id_map[work.id],confirm_title:work.title},bob);
 });
 await t.test('tokens ausentes, inválidos, expirados, outro recurso e permissão insuficiente',async()=>{
  await assert.rejects(()=>authenticate(undefined),{code:'UNAUTHENTICATED'});await assert.rejects(()=>authenticate('Bearer invalid'),{code:'UNAUTHENTICATED'});
  const jwk=JSON.parse(await readFile('.local/jwt-keys.json','utf8'))[0],key=await importJWK({...jwk,key_ops:['sign']},'ES256'),claims={sub:alice.id,session_id:alice.session_id,role:'authenticated'};
  // exp explícito no passado; não depende de relógio ou espera para expirar.
  const past=await new SignJWT(claims).setProtectedHeader({alg:'ES256',kid:jwk.kid}).setIssuer(config.issuer).setAudience('authenticated').setExpirationTime(1).sign(key);await assert.rejects(()=>authenticate(`Bearer ${past}`),{code:'UNAUTHENTICATED'});
  await assert.rejects(()=>authenticate(`Bearer ${a.access_token}`,true),{code:'UNAUTHENTICATED'});
  await assert.rejects(()=>call('source_import',{operation_id:op(),title:'x',text:'x'}, {...alice,permissions:'read'}),{code:'FORBIDDEN'});
 });
 await t.test('logout revoga imediatamente a sessão no serviço sem esperar expiração JWT',async()=>{
  const session=await login(),who=await authenticate(`Bearer ${session.access_token}`);const res=await fetch(`${config.authUrl}/logout?scope=local`,{method:'POST',headers:{authorization:`Bearer ${session.access_token}`}});assert.equal(res.status,204);await assert.rejects(()=>call('account_context',{},who),{code:'SESSION_REVOKED'});
 });
});
after(async()=>{if(created)await call('work_delete',{operation_id:op(),work_id:created.work_id,confirm_title:title});await pool.end();});
