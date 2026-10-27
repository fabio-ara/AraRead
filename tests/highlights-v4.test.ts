import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool,transaction} from '../src/db.ts';
import {outputs} from '../src/outputs.ts';
import {quoteSelector} from '../src/study/highlights.ts';
import {backupSections} from '../src/study/backup.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Somente ambiente local isolado.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(n=0){const response=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[n])});assert.equal(response.status,200);return authenticate(`Bearer ${(await response.json()).access_token}`);}
const alice=await login(),bob=await login(1),works:any[]=[];
const call=async(name:any,args:any={},who=alice)=>{const value=await execute(name,args,who);outputs[name as keyof typeof outputs].parse(value);return value;};
const op=()=>randomUUID();
const review={checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'not_applicable',coverage:'preserved'},rationale:'Comparação sintética, sem revisão acadêmica humana.',claims:[],limits:'Fixture.'};
async function fixture(who=alice){const title=`Grifos sintéticos ${op()}`,w=await call('source_import',{operation_id:op(),title,text:'Repeated word. Repeated word. é 😀 العربية 429?–347 B.C.E.',original_language:'en',partial:false},who);works.push({...w,title,who});return {...w,who};}
async function write(w:any,name:any,args:any,who=alice){const c=await call('reading_context',{reading_id:w.reading_id},who);return call(name,{operation_id:op(),reading_id:w.reading_id,expected_revision:c.reading.revision,...args},who);}
async function mediate(w:any,representation='rewrite',extra:any={}){const p=await write(w,'context_prepare',{ref:w.ref,language:'pt-BR',selection:{representation}},w.who);return call('mediation_save',{operation_id:op(),reading_id:w.reading_id,expected_revision:p.revision,ref:w.ref,language:'pt-BR',representation,context_id:p.context_id,rewrite:representation==='translation'?'Palavra repetida. Palavra repetida. é 😀 العربية 429?–347 a.C.':'A palavra aparece duas vezes. Um exemplo didático ajuda a comparar as ocorrências.',additions:representation==='rewrite'?[{kind:'example',text:'Exemplo separado, com limites.'}]:[],editorial_review:review,provenance:{agent:'Fixture',guidance_version:'1.3.0'},...extra},w.who);}
test('grifos persistem nas três representações e acréscimos com versões e índices distintos',async()=>{
 const w=await fixture();const explanation=await mediate(w),translation=await mediate(w,'translation');
 const panel=await call('reading_display',{reading_id:w.reading_id,language:'pt-BR'});const saved:any[]=[];
 for(const key of ['original','translation','facilitated'])for(const s of panel.representations[key].segments){
  const target={representation:s.representation,...(s.mediation_id?{mediation_id:s.mediation_id}:{}),segment:s.segment,...quoteSelector(s.text,0,7)};
  saved.push(await write(w,'highlight_save',{ref:w.ref,target}));
 }
 const list=await call('highlight_list',{reading_id:w.reading_id},await login());assert.equal(list.items.length,4);assert.ok(list.items.every((v:any)=>v.state==='anchored'));
 assert.equal(list.items.find((v:any)=>v.target.representation==='translation').target.mediation_id,translation.entity_id);
 assert.equal(list.items.find((v:any)=>v.target.segment==='addition:0').target.mediation_id,explanation.entity_id);
 await mediate(w,'rewrite',{regenerate:true,supersedes:explanation.entity_id});const versions=await call('highlight_list',{reading_id:w.reading_id});assert.equal(versions.items.find((v:any)=>v.target.mediation_id===explanation.entity_id).state,'version_superseded');
 const note=await write(w,'note_save',{ref:w.ref,kind:'note',text:'Nota independente sobre a passagem.',origin:'user'});
 await write(w,'highlight_remove',{highlight_id:saved[0].highlight_id});assert.equal((await call('highlight_list',{reading_id:w.reading_id})).items.length,3);
 assert.ok((await call('reading_history',{reading_id:w.reading_id,kind:'notes'})).items.some((v:any)=>v.id===note.entity_id));assert.deepEqual((await call('reading_context',{reading_id:w.reading_id})).reading.covered,[]);
});
test('seleção repetida, quote/contexto, grafema, sessão, leitura e conta são conferidos',async()=>{
 const w=await fixture(),other=await fixture(bob),m=await mediate(other);
 const ctx=await call('reading_context',{reading_id:w.reading_id}),target={representation:'original',segment:'main',...quoteSelector(ctx.original,15,23)};
 const request={operation_id:op(),reading_id:w.reading_id,expected_revision:ctx.reading.revision,ref:w.ref,target};
 const saved=await call('highlight_save',request);assert.deepEqual(await call('highlight_save',request),saved);assert.deepEqual(await call('operation_get',{operation_id:request.operation_id}),saved);
 await assert.rejects(()=>call('highlight_save',{...request,target:{...target,exact:'different'}}),{code:'IDEMPOTENCY_MISMATCH'});
 await assert.rejects(()=>write(w,'highlight_save',{ref:w.ref,target:{...target,start:0}}),{code:'ANCHOR_MISMATCH'});
 await assert.rejects(()=>write(w,'highlight_save',{ref:w.ref,target:{...target,representation:'translation',mediation_id:m.entity_id}}),{code:'INVALID_ANCHOR'});
 await assert.rejects(()=>call('highlight_list',{reading_id:w.reading_id},bob),{code:'NOT_FOUND'});
 await assert.rejects(()=>write(w,'highlight_remove',{highlight_id:saved.highlight_id},{...alice,permissions:'read'}),{code:'FORBIDDEN'});
 await assert.rejects(()=>call('highlight_list',{reading_id:w.reading_id},{...alice,session_id:op()}),{code:'SESSION_REVOKED'});
 const accent=Array.from(ctx.original).indexOf('e',29);assert.ok(accent>0);
 await assert.rejects(()=>write(w,'highlight_save',{ref:w.ref,target:{representation:'original',segment:'main',...quoteSelector(ctx.original,accent,accent+1)}}),{code:'INVALID_ANCHOR'});
 await assert.rejects(()=>transaction(bob,c=>c.query("insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,anchor) values($1,$2,$3,$4,$5,0,$6,'highlight',$7,'user',$8)",[op(),bob.id,other.reading_id,w.source_id,w.ref.element_id,w.ref.end,target.exact,JSON.stringify(target)])));
 const before=await call('reading_context',{reading_id:w.reading_id});const parallel=await Promise.allSettled([0,1].map(()=>call('highlight_save',{...request,operation_id:op(),expected_revision:before.reading.revision})));
 assert.equal(parallel.filter(v=>v.status==='fulfilled').length,1);assert.equal((parallel.find(v=>v.status==='rejected') as PromiseRejectedResult).reason.code,'CONFLICT');assert.equal((await call('highlight_list',{reading_id:w.reading_id})).items.length,2);
});
test('backup v3 conserva grifos e referências históricas sem reancoragem',async()=>{
 const w=await fixture(),m=await mediate(w),body='A palavra aparece duas vezes. Um exemplo didático ajuda a comparar as ocorrências.';
 await write(w,'highlight_save',{ref:w.ref,target:{representation:'rewrite',mediation_id:m.entity_id,segment:'main',...quoteSelector(body,2,9)}});
 const sections:Record<string,any[]>={};let snapshot:string|undefined;
 for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=p.snapshot;sections[section].push(...p.items);offset=p.pagination.next_offset;}}
 const restored=await call('data_restore',{operation_id:op(),bundle:{format:'araread/3',sections}},bob);
 for(const item of sections.works)works.push({work_id:restored.id_map[item.id],title:item.title,who:bob});
 const copy=await call('highlight_list',{reading_id:restored.id_map[w.reading_id]},bob);assert.equal(copy.items[0].state,'anchored');assert.equal(copy.items[0].target.mediation_id,restored.id_map[m.entity_id]);assert.equal(copy.items[0].target.exact,'palavra');
 await transaction(alice,c=>c.query('delete from araread.mediations where id=$1',[m.entity_id]));
 assert.equal((await call('highlight_list',{reading_id:w.reading_id})).items[0].state,'orphaned');
 const exported=await call('data_export',{section:'notes',limit:50});assert.equal(exported.items.find((n:any)=>n.anchor?.mediation_id===m.entity_id).anchor.unavailable_version,true);
 snapshot=undefined;for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=p.snapshot;sections[section].push(...p.items);offset=p.pagination.next_offset;}}
 const orphanCopy=await call('data_restore',{operation_id:op(),bundle:{format:'araread/3',sections}},bob);for(const item of sections.works)works.push({work_id:orphanCopy.id_map[item.id],title:item.title,who:bob});
 const orphan=await call('highlight_list',{reading_id:orphanCopy.id_map[w.reading_id]},bob);assert.equal(orphan.items[0].state,'orphaned');assert.notEqual(orphan.items[0].target.mediation_id,m.entity_id);assert.equal(orphan.items[0].target.exact,'palavra');
});
after(async()=>{for(const w of works)await call('work_delete',{operation_id:op(),work_id:w.work_id,confirm_title:w.title},w.who);await pool.end();});
