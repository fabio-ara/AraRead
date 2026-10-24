import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool,transaction,type Identity} from '../src/db.ts';
import {outputs} from '../src/outputs.ts';
import {backupSections} from '../src/study/backup.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Apenas banco local isolado e identidades sintéticas.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(n=0){const res=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[n])});assert.equal(res.status,200);return authenticate(`Bearer ${(await res.json()).access_token}`);}
const alice=await login(),bob=await login(1),works:{id:string,title:string,who:Identity}[]=[],profiles:{id:string,who:Identity}[]=[];
const call=async(name:any,args:any={},who=alice)=>{const result=await execute(name,args,who);outputs[name as keyof typeof outputs].parse(result);return result;};
const op=()=>randomUUID();
async function create(extra:any={},who=alice){const title=extra.title||`AraRead 0.3 sintético ${op()}`,x=await call('source_import',{operation_id:op(),title,text:'A hipótese não demonstra certeza.',original_language:'pt-BR',partial:false,...extra},who);works.push({id:x.work_id,title,who});return x;}
const review={checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'not_applicable',coverage:'preserved'},rationale:'Exemplo sintético comparado com a passagem original; negação e possibilidade preservadas.',claims:[],limits:'Teste sintético, sem revisão humana especializada.'};
async function write(reading_id:string,name:any,extra:any,who=alice){const r=await call('reading_context',{reading_id},who);return call(name,{operation_id:op(),reading_id,expected_revision:r.reading.revision,...extra},who);}
async function accountWrite(name:any,extra:any,who=alice){const p=await call('preferences_get',{},who);return call(name,{operation_id:op(),expected_revision:p.revision,...extra},who);}

test('ingestão validada e text-first deduplicam por conta, conservam binário autorizado e canon em backup',async()=>{
 const w=await create(),ctx=await call('reading_context',{reading_id:w.reading_id});assert.equal(ctx.source.original_available,false);assert.equal(ctx.source.storage_policy,'text');
 const bytes=await transaction(alice,async c=>(await c.query('select original from araread.sources where id=$1',[w.source_id])).rows[0]);assert.equal(bytes.original,null);
 const again=await call('source_import',{operation_id:op(),title:works[0].title,text:ctx.original,original_language:'pt-BR',partial:false});assert.equal(again.deduplicated,true);assert.equal(again.source_id,w.source_id);
 const b=await create({title:works[0].title},bob);assert.notEqual(b.source_id,w.source_id);
 const retained=await create({retain_original:true});assert.equal(retained.original_available,true);
 const sections:Record<string,any[]>={};let snapshot:string|undefined;
 for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});assert.equal(p.format,'araread/3');snapshot=p.snapshot;sections[section].push(...p.items);offset=p.pagination.next_offset;}}
 const bundle={format:'araread/3',snapshot,sections};const restored=await call('data_restore',{operation_id:op(),bundle},bob);const copy=await call('reading_context',{reading_id:restored.id_map[w.reading_id]},bob);assert.equal(copy.original,ctx.original);assert.equal(copy.source.original_available,false);assert.equal(copy.source.canonical_sha256,ctx.source.canonical_sha256);
 for(const v of sections.works)works.push({id:restored.id_map[v.id],title:v.title,who:bob});
 const broken=structuredClone(bundle);broken.sections.elements.find((e:any)=>e.source_id===w.source_id).text='Texto adulterado.';await assert.rejects(()=>call('data_restore',{operation_id:op(),bundle:broken},bob),{code:'INVALID_BACKUP'});
});
test('navegação distingue aberto e principal, mede cobertura real e retoma em outra sessão',async()=>{
 const w=await create({format:'structured',text:undefined,blocks:[{kind:'navigation',text:'Menu preliminar',meta:{}},{kind:'paragraph',text:'Primeiro argumento válido.',meta:{}},{kind:'heading',text:'Formas',meta:{level:1}},{kind:'paragraph',text:'A hipótese das formas não é uma certeza.',meta:{}},{kind:'paragraph',text:'Última passagem disponível.',meta:{}}]});
 const ctx=await call('reading_context',{reading_id:w.reading_id});assert.equal(ctx.original,'Primeiro argumento válido.');
 const index=await call('reading_outline',{reading_id:w.reading_id});const later=index.items[3].ref;await write(w.reading_id,'reading_seek',{ref:later});
 await write(w.reading_id,'reading_move',{action:'continue',ref:later});const opened=await call('reading_context',{reading_id:w.reading_id,position:'opened'});assert.equal(opened.original,'Última passagem disponível.');assert.deepEqual(opened.reading.resume,ctx.ref);assert.deepEqual(opened.reading.covered,[later]);
 const progress=await call('reading_progress',{reading_id:w.reading_id});assert.equal(progress.units.total,4);assert.equal(progress.paragraphs.remaining,2);assert.ok(progress.percent>0&&progress.percent<100);
 await write(w.reading_id,'reading_move',{action:'resume'});assert.deepEqual((await call('reading_context',{reading_id:w.reading_id,position:'opened'},await login())).ref,ctx.ref);
 const map=await write(w.reading_id,'reading_map_save',{items:[{title:'Problema das formas',ref:later,level:1,nature:'organizational_interpretation'}],provenance:{agent:'Fixture',limits:'Título gerado, não atribuído ao autor.'}});assert.equal(map.version,1);assert.equal((await call('reading_outline',{reading_id:w.reading_id})).map.items[0].nature,'organizational_interpretation');
});
test('três representações só aparecem após preparação persistida e confronto editorial',async()=>{
 const w=await create();await write(w.reading_id,'preferences_set',{language:'pt-BR'});await assert.rejects(()=>call('reading_display',{reading_id:w.reading_id}),{code:'PREPARATION_REQUIRED'});
 const ctx=await call('reading_context',{reading_id:w.reading_id});const prepared=await write(w.reading_id,'context_prepare',{ref:ctx.ref});
 await write(w.reading_id,'mediation_save',{ref:ctx.ref,context_id:prepared.context_id,rewrite:'Uma hipótese é uma afirmação provisória. Ela não demonstra que algo seja certo.',editorial_review:review,provenance:{agent:'Fixture',guidance_version:'1.2.0'}});
 const panel=await call('reading_display',{reading_id:w.reading_id});assert.equal(panel.ready,true);assert.equal(panel.representations.translation.status,'same_language');assert.equal(panel.representations.original.text,ctx.original);assert.deepEqual(panel.reading.covered,[]);
 const en=await create({text:'A hypothesis may explain an observation. It does not prove certainty.',original_language:'en'});await write(en.reading_id,'preferences_set',{language:'pt-BR'});const initial=await call('reading_context',{reading_id:en.reading_id});
 for(const representation of ['rewrite','translation']){const p=await write(en.reading_id,'context_prepare',{ref:initial.ref,selection:{representation}});await write(en.reading_id,'mediation_save',{ref:initial.ref,representation,context_id:p.context_id,rewrite:representation==='translation'?'Uma hipótese pode explicar uma observação. Ela não prova certeza.':'Uma hipótese é uma proposta para explicar algo observado. Ela pode ajudar, mas não estabelece certeza.',editorial_review:review,provenance:{agent:'Fixture',guidance_version:'1.2.0'}});}
 const display=await call('reading_display',{reading_id:en.reading_id});assert.equal(display.representations.translation.status,'saved');assert.match(display.fallback_text,/Leitura facilitada/);
});
test('preferências têm precedência, sessões reais, exclusão e perfis privados selecionados explicitamente',async()=>{
 const w=await create(),lensId=op();const profile=await accountWrite('profile_save',{name:'Perfil sintético',explicit_request:true,declared_author:'Fixture',usage_terms:'Material sintético autorizado',definition:{values:{support_mode:'brief'},lenses:[{id:lensId,name:'Aplicação marxiana sintética',nature:'ai_application',scope:'Distinção local de conceitos',period:'',limits:'Não é comentário atribuído a Marx nem identidade do leitor.',sources:[]}],conflicts:['Combinações não verificadas'],compatibility:'not_assessed',limits:'Sem atribuição histórica ou adesão inferida.'}});profiles.push({id:profile.profile_id,who:alice});
 await accountWrite('preferences_set',{values:{support_mode:'standard'}});await accountWrite('preferences_set',{values:{active_profile:profile.profile_id},explicit_request:true});
 let p=await call('preferences_get',{reading_id:w.reading_id});assert.equal(p.values.support_mode,'brief');assert.equal(p.effective.support_mode.origin,'profile');
 const ref=(await call('reading_context',{reading_id:w.reading_id})).ref,prepared=await write(w.reading_id,'context_prepare',{ref});const recovered=await call('operation_get',{operation_id:prepared.operation_id});assert.equal(recovered.materials.profile.id,profile.profile_id);assert.equal(recovered.materials.profile.version,1);
 assert.equal((await call('preferences_get',{reading_id:w.reading_id,operation:{active_profile:profile.profile_id}})).effective.support_mode.temporary,true);
 await write(w.reading_id,'preferences_set',{values:{support_mode:'extended'}});p=await call('preferences_get',{reading_id:w.reading_id});assert.equal(p.values.support_mode,'extended');
 await accountWrite('preferences_set',{scope:'session',values:{support_mode:'standard'}});p=await call('preferences_get',{reading_id:w.reading_id});assert.equal(p.effective.support_mode.origin,'session');
 assert.equal((await call('preferences_get',{reading_id:w.reading_id,operation:{support_mode:'brief'}})).effective.support_mode.origin,'operation');assert.equal((await call('preferences_get',{reading_id:w.reading_id},await login())).values.support_mode,'extended');
 await accountWrite('preferences_unset',{scope:'session',keys:['support_mode'],action:'delete'});
 await write(w.reading_id,'preferences_unset',{keys:['support_mode'],action:'disable'});assert.equal((await call('preferences_get',{reading_id:w.reading_id})).values.support_mode,'brief');
 await write(w.reading_id,'preferences_unset',{keys:['support_mode'],action:'reset'});assert.equal((await call('preferences_get',{reading_id:w.reading_id})).values.support_mode,'standard');
 await write(w.reading_id,'preferences_unset',{keys:['support_mode'],action:'unset'});assert.equal((await call('preferences_get',{reading_id:w.reading_id})).values.support_mode,'brief');
 await assert.rejects(()=>accountWrite('preferences_set',{values:{goal:'Preferência privada sensível'}}),{code:'EXPLICIT_PREFERENCE_REQUIRED'});
 await assert.rejects(()=>write(w.reading_id,'preferences_set',{study:{goal:'Inferência legada indevida'}}),{code:'EXPLICIT_PREFERENCE_REQUIRED'});
 await write(w.reading_id,'preferences_set',{values:{language:'fr'}});assert.equal((await call('library_list',{query:works.find(v=>v.id===w.work_id)!.title})).items[0].language,'fr');
 const sessionExport=await call('data_export',{section:'preference_records',limit:50});assert.ok(sessionExport.items.every((v:any)=>v.scope!=='session'));
 await assert.rejects(()=>call('profile_get',{profile_id:profile.profile_id},bob),{code:'NOT_FOUND'});await assert.rejects(()=>accountWrite('preferences_set',{values:{active_profile:profile.profile_id},explicit_request:true},bob),{code:'INVALID_PROFILE'});
 await assert.rejects(()=>transaction(bob,c=>c.query("insert into araread.preference_records(id,owner_id,scope,key,value,state,provenance) values($1,$2,'account','active_profile',$3,'active','{}')",[op(),bob.id,JSON.stringify(profile.profile_id)])),{code:'42501'});
 await assert.rejects(()=>transaction(bob,c=>c.query("insert into araread.preference_records(id,owner_id,scope,session_id,key,value,state,provenance) values($1,$2,'session',$3,'goal','\"foreign session\"','active','{}')",[op(),bob.id,alice.session_id])),{code:'42501'});
 const exported=await call('profile_export',{profile_id:profile.profile_id,lens_ids:[lensId],include_values:true,declared_author:'Fixture',usage_terms:'MIT para conteúdo sintético',reviewed_for_sharing:true});const imported=await accountWrite('profile_import',{bundle:exported.bundle,explicit_request:true},bob);profiles.push({id:imported.profile_id,who:bob});assert.equal(imported.active,false);assert.equal(imported.selected,false);
 await accountWrite('profile_manage',{profile_id:profile.profile_id,action:'disable'});assert.equal((await call('preferences_get',{reading_id:w.reading_id})).values.active_profile,null);assert.deepEqual((await call('reading_context',{reading_id:w.reading_id})).reading.covered,[]);
 await accountWrite('preferences_unset',{keys:['support_mode','active_profile'],action:'delete'});
});
after(async()=>{for(const p of profiles)await accountWrite('profile_manage',{profile_id:p.id,action:'delete'},p.who);for(const w of works)await call('work_delete',{operation_id:op(),work_id:w.id,confirm_title:w.title},w.who);await pool.end();});
