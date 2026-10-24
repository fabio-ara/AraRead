import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool,transaction,type Identity} from '../src/db.ts';
import {backupSections} from '../src/study/backup.ts';
import {extract} from '../src/importers.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Apenas banco local isolado e identidades sintéticas.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(n:number){const res=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[n])});assert.equal(res.status,200);return authenticate(`Bearer ${(await res.json()).access_token}`);}
const alice=await login(0),bob=await login(1),works:{id:string,title:string,who:Identity}[]=[],profiles:{id:string,who:Identity}[]=[];
const op=()=>randomUUID(),call=(name:any,args:any={},who=alice)=>execute(name,args,who);
const review={checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'not_applicable',coverage:'preserved'},rationale:'Comparação sintética preserva hipótese, negação e limite da afirmação.',claims:[] as any[],limits:'Material sintético; sem revisão especializada.'};
const provenance={agent:'Regressão sintética da revisão 0.3',guidance_version:'1.2.0'};
async function write(id:string,name:any,args:any={},who=alice){const c=await call('reading_context',{reading_id:id},who);return call(name,{operation_id:op(),reading_id:id,expected_revision:c.reading.revision,...args},who);}
async function accountWrite(name:any,args:any={},who=alice){const p=await call('preferences_get',{},who);return call(name,{operation_id:op(),expected_revision:p.revision,...args},who);}
async function create(extra:any={}){const title=extra.title||`Regressão sintética ${op()}`,w=await call('source_import',{operation_id:op(),title,text:'A hipótese não demonstra certeza.',original_language:'pt-BR',partial:false,...extra});if(!works.some(v=>v.id===w.work_id))works.push({id:w.work_id,title,who:alice});await write(w.reading_id,'preferences_set',{language:'pt-BR'});return w;}
async function remove(id:string){const at=works.findIndex(w=>w.id===id),w=works[at];await call('work_delete',{operation_id:op(),work_id:id,confirm_title:w.title},w.who);works.splice(at,1);}
async function save(id:string,extra:any={}){const c=await call('reading_context',{reading_id:id});return write(id,'mediation_save',{ref:c.ref,rewrite:'Uma hipótese é provisória e não demonstra certeza.',editorial_review:review,provenance,...extra});}
async function support(){const w=await create(),b=await create(),reference=await write(b.reading_id,'reference_save',{title:'Apoio sintético consultado',locator:'§ 1',excerpt:'A comparação conserva uma hipótese sem afirmar certeza.',access:'available',consulted_at:'2026-10-24'}),c=await call('reading_context',{reading_id:w.reading_id}),prepared=await write(w.reading_id,'context_prepare',{ref:c.ref});
 const m=await save(w.reading_id,{context_id:prepared.context_id,editorial_review:{...review,claims:[{kind:'context',text:'Comparação documentada em material sintético.',status:'documented',evidence_ids:[reference.reference_id]}]}});return {w,b,reference,m};}

test('imagem inline essencial ou sem alt permanece na extração e exige original',async()=>{
 for(const alt of ['alt="Diagrama essencial"','']){const x=await extract({format:'html',text:`<article><p>Este argumento depende da figura seguinte: <img src="data:image/svg+xml,synthetic" ${alt}> A figura conserva condições que o texto não substitui.</p></article>`});assert.ok(x.blocks.some(b=>b.kind==='figure'));assert.equal(x.quality.original_required,true);}
 const decorative=await extract({format:'html',text:'<article><p>O argumento é textual e a imagem apenas decorativa. <img src="decoration.png" alt=""> A negação não pode ser retirada.</p></article>'});assert.ok(!decorative.blocks.some(b=>b.kind==='figure'));assert.equal(decorative.quality.original_required,false);
});

test('originais visuais diferentes não colidem na deduplicação textual',async()=>{
 const title=`Originais visuais sintéticos ${op()}`,html=(color:string)=>`<article><p>A figura distingue uma condição essencial; a descrição não contém sua forma.</p><figure><img src="data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="${color}"/></svg>`).toString('base64')}" alt="Condição sintética"><figcaption>Figura indispensável ao argumento.</figcaption></figure></article>`;
 const a=await create({title,format:'html',text:html('red')}),b=await create({title,format:'html',text:html('blue')});assert.notEqual(a.source_id,b.source_id);assert.equal(a.original_available,true);assert.equal(b.original_available,true);
 const again=await create({title,format:'html',text:html('blue')});assert.equal(again.deduplicated,true);assert.equal(again.source_id,b.source_id);
});

test('variante sem contexto assinado permanece arquivada e não abre painel',async()=>{
 const w=await create(),m=await save(w.reading_id);assert.equal((await call('reading_context',{reading_id:w.reading_id})).mediation.id,m.entity_id);
 await assert.rejects(()=>call('reading_display',{reading_id:w.reading_id}),{code:'PREPARATION_REQUIRED'});
});

test('tradução sem contexto assinado também impede apresentação final',async()=>{
 const w=await create({text:'A hypothesis does not prove certainty.',original_language:'en'}),c=await call('reading_context',{reading_id:w.reading_id}),p=await write(w.reading_id,'context_prepare',{ref:c.ref});await save(w.reading_id,{context_id:p.context_id});await assert.rejects(()=>save(w.reading_id,{representation:'translation',rewrite:'Uma hipótese não prova certeza.'}),{code:'MISSING_CONTEXT'});
 await assert.rejects(()=>call('reading_display',{reading_id:w.reading_id}),{code:'PREPARATION_REQUIRED'});
});

test('retirar fonte usada apenas na revisão editorial invalida a variante',async()=>{
 const {w,b,reference}=await support();assert.equal((await call('reading_display',{reading_id:w.reading_id})).ready,true);assert.ok((await call('reading_context',{reading_id:w.reading_id})).mediation.evidence_ids.includes(reference.reference_id));await remove(b.work_id);
 const c=await call('reading_context',{reading_id:w.reading_id});assert.equal(c.mediation.status,'needs_review');await assert.rejects(()=>call('reading_display',{reading_id:w.reading_id}),{code:'PREPARATION_REQUIRED'});
});

test('backup remapeia referências dentro da revisão editorial para a outra conta',async()=>{
 const {w,b,reference,m}=await support(),sections:Record<string,any[]>={};let snapshot:string|undefined;
 for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=p.snapshot;sections[section].push(...p.items);offset=p.pagination.next_offset;}}
 // Older 0.3 rows kept a claim's evidence only inside editorial.review.
 sections.mediations.find(v=>v.id===m.entity_id).evidence_ids=[];
 const restored=await call('data_restore',{operation_id:op(),bundle:{format:'araread/3',snapshot,sections}},bob);for(const v of sections.works)works.push({id:restored.id_map[v.id],title:v.title,who:bob});for(const v of sections.profiles)profiles.push({id:restored.id_map[v.id],who:bob});
 const history=await call('reading_history',{reading_id:restored.id_map[w.reading_id],kind:'mediations'},bob),copy=history.items.find((v:any)=>v.id===restored.id_map[m.entity_id]);assert.deepEqual(copy.editorial.review.claims[0].evidence_ids,[restored.id_map[reference.reference_id]]);
 assert.equal(await transaction(alice,async c=>(await c.query('select id from araread."references" where id=$1',[restored.id_map[reference.reference_id]])).rows.length),0);
 await remove(restored.id_map[b.work_id]);assert.equal((await call('reading_context',{reading_id:restored.id_map[w.reading_id]},bob)).mediation.status,'needs_review');
});

test('idioma em values, operação e perfil converge para a mesma etiqueta BCP 47',async()=>{
 const w=await create();await write(w.reading_id,'preferences_set',{values:{language:'pt-br'}});const preferences=await call('preferences_get',{reading_id:w.reading_id});assert.equal(preferences.values.language,'pt-BR');
 const c=await call('reading_context',{reading_id:w.reading_id}),p=await write(w.reading_id,'context_prepare',{ref:c.ref});await save(w.reading_id,{context_id:p.context_id,language:preferences.values.language});assert.equal((await call('reading_display',{reading_id:w.reading_id})).ready,true);
 assert.equal((await call('preferences_get',{reading_id:w.reading_id,operation:{language:'en-us'}})).values.language,'en-US');
 const profile=await accountWrite('profile_save',{name:'Idioma sintético',explicit_request:true,declared_author:'Fixture',usage_terms:'MIT sintético',definition:{values:{language:'fr-fr'},lenses:[],conflicts:[],compatibility:'not_assessed',limits:'Somente teste de idioma.'}});profiles.push({id:profile.profile_id,who:alice});await write(w.reading_id,'preferences_unset',{keys:['language'],action:'delete'});await write(w.reading_id,'preferences_set',{values:{active_profile:profile.profile_id},explicit_request:true});assert.equal((await call('preferences_get',{reading_id:w.reading_id})).values.language,'fr-FR');
});

test('recibo preferences_set 0.2 preserva ordem original dos campos e não reexecuta',async()=>{
 const w=await create(),before=await call('reading_context',{reading_id:w.reading_id});
 // Exact object order emitted by the 0.2 Zod schema, including reading_id before expected_revision.
 const request={operation_id:op(),reading_id:w.reading_id,expected_revision:999,language:'pt-BR',portion_size:'short'};
 const hash=createHash('sha256').update('preferences_set'+JSON.stringify(request)).digest('hex'),receipt={operation_id:request.operation_id,status:'confirmed',reading_id:w.reading_id,revision:2};
 await transaction(alice,c=>c.query('insert into araread.receipts(owner_id,operation_id,request_hash,result) values($1,$2,$3,$4)',[alice.id,request.operation_id,hash,JSON.stringify(receipt)]));assert.deepEqual(await call('preferences_set',request),receipt);assert.equal((await call('reading_context',{reading_id:w.reading_id})).reading.revision,before.reading.revision);
});

after(async()=>{for(const p of profiles)await accountWrite('profile_manage',{profile_id:p.id,action:'delete'},p.who);for(const w of [...works])await remove(w.id);await pool.end();});
