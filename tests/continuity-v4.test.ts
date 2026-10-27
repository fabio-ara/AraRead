import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool,transaction} from '../src/db.ts';
import {outputs} from '../src/outputs.ts';
import {legacyPortion} from '../src/anchors.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Somente ambiente local isolado.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(n=0){const response=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[n])});assert.equal(response.status,200);return authenticate(`Bearer ${(await response.json()).access_token}`);}
const alice=await login(),bob=await login(1),works:any[]=[];
const call=async(name:any,args:any={},who=alice)=>{const value=await execute(name,['reading_context','reading_display','mediation_save','context_prepare'].includes(name)?{language:'pt-BR',...args}:args,who);outputs[name as keyof typeof outputs].parse(value);return value;};
const op=()=>randomUUID();
const review={checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'not_applicable',coverage:'preserved'},rationale:'Comparação sintética para exercitar continuidade estrutural sem alegar fidelidade humana.',claims:[],limits:'Fixture sintética.'};
const text='Uma proposta sintética ('+'observação encadeada; '.repeat(100)+'fim da observação). Outra sentença completa. '+ 'Texto complementar. '.repeat(20);
async function fixture(){const title=`Continuidade sintética ${op()}`,w=await call('source_import',{operation_id:op(),title,format:'structured',blocks:[{kind:'paragraph',text},{kind:'paragraph',text:'Unidade seguinte.'}],original_language:'pt-BR',partial:false});works.push({...w,title});return w;}
test('referências legadas abertas sobrevivem à política nova e continuam sem recobrir restante',async()=>{
 const w=await fixture(),first={...w.ref,end:791},second={...w.ref,start:791,end:1817};
 await transaction(alice,c=>c.query('update araread.readings set opened=$2,resume=$2 where id=$1',[w.reading_id,JSON.stringify(first)]));
 let ctx=await call('reading_context',{reading_id:w.reading_id});assert.deepEqual(ctx.ref,first);
 let moved=await call('reading_move',{operation_id:op(),reading_id:w.reading_id,expected_revision:0,action:'continue',ref:first});
 ctx=await call('reading_context',{reading_id:w.reading_id});assert.deepEqual(ctx.reading.covered,[first]);assert.equal(ctx.ref.start,791);
 await call('reading_move',{operation_id:op(),reading_id:w.reading_id,expected_revision:moved.revision,action:'open',ref:second});
 ctx=await call('reading_context',{reading_id:w.reading_id,position:'opened'},await login());assert.deepEqual(ctx.ref,second);assert.equal(ctx.passage.is_fragment,true);
 moved=await call('reading_move',{operation_id:op(),reading_id:w.reading_id,expected_revision:ctx.reading.revision,action:'continue',ref:second});
 ctx=await call('reading_context',{reading_id:w.reading_id,position:'opened'});assert.deepEqual(ctx.reading.covered,[{...first,end:1817}]);assert.equal(ctx.ref.start,1817);
 await assert.rejects(()=>call('reading_move',{operation_id:op(),reading_id:w.reading_id,expected_revision:moved.revision,action:'continue',ref:{...ctx.ref,end:ctx.ref.start+17}}),{code:'INVALID_REF'});
});
test('recomposição tem prévia, recibo, isolamento e conserva retomada, cobertura e histórico',async()=>{
 const w=await fixture(),old={...w.ref,start:791,end:1817};
 await transaction(alice,c=>c.query('update araread.readings set opened=$2,resume=$2 where id=$1',[w.reading_id,JSON.stringify(old)]));
 const before=await call('reading_context',{reading_id:w.reading_id});
 const preview=await call('reading_repair_preview',{reading_id:w.reading_id});assert.equal(preview.target_ref.start,0);assert.equal(preview.target_ref.end,Array.from(text).length);
 assert.deepEqual((await call('reading_context',{reading_id:w.reading_id})).reading,before.reading);
 const request={operation_id:op(),reading_id:w.reading_id,expected_revision:before.reading.revision,preview_token:preview.preview_token};
 await assert.rejects(()=>call('reading_repair',request,bob),{code:'NOT_FOUND'});
 await assert.rejects(()=>call('reading_repair',request,{...alice,permissions:'read'}),{code:'FORBIDDEN'});
 const repaired=await call('reading_repair',request);assert.deepEqual(await call('reading_repair',request),repaired);
 const after=await call('reading_context',{reading_id:w.reading_id,position:'opened'});assert.deepEqual(after.ref,preview.target_ref);assert.deepEqual(after.reading.resume,before.reading.resume);assert.deepEqual(after.reading.covered,before.reading.covered);assert.equal(after.original,text);
 const history=await call('reading_history',{reading_id:w.reading_id,kind:'events'});assert.equal(history.items[0].kind,'presentation_repair');
 await assert.rejects(()=>call('reading_repair',{...request,operation_id:op(),expected_revision:repaired.revision}),{code:'PREVIEW_CHANGED'});
});
test('confronto semântico não oculta fragmento; três abas e índice expõem o mesmo escopo',async()=>{
 const w=await fixture();
 const whole=(await call('source_elements',{reading_id:w.reading_id})).items[0];assert.deepEqual(whole.ref,whole.full_ref);
 const fragment={...w.ref,start:791,end:1817};
 async function save(ref:any,ack=false,supersedes?:string){const c=await call('reading_context',{reading_id:w.reading_id});const p=await call('context_prepare',{operation_id:op(),reading_id:w.reading_id,expected_revision:c.reading.revision,ref});return call('mediation_save',{operation_id:op(),reading_id:w.reading_id,expected_revision:p.revision,ref,context_id:p.context_id,rewrite:'Uma observação encadeada integra uma proposta sintética. A explicação didática preserva seu caráter provisório.',editorial_review:{...review,continuity_acknowledged:ack},provenance:{agent:'Fixture',guidance_version:'1.3.0'},regenerate:true,...(supersedes?{supersedes}:{})});}
 const old=await save(fragment);await assert.rejects(()=>call('reading_display',{reading_id:w.reading_id,ref:fragment}),{code:'PREPARATION_REQUIRED'});
 await save(fragment,true,old.entity_id);const small=await call('reading_display',{reading_id:w.reading_id,ref:fragment});assert.equal(small.passage.is_fragment,true);assert.match(small.location.label,/continua|parte|trecho|fragmento/i);
 await assert.rejects(()=>save(whole.full_ref,true,old.entity_id),{code:'INVALID_RELATION'});
 await save(whole.full_ref);const full=await call('reading_display',{reading_id:w.reading_id,ref:whole.full_ref});assert.equal(full.passage.is_fragment,false);assert.equal(full.original,text);assert.equal(full.representations.translation.text,text);assert.deepEqual(full.reading.covered,[]);
 assert.equal((await call('reading_history',{reading_id:w.reading_id,kind:'mediations'})).items.length,3);
});
test('painel reaproveita fim de sentença legado sem exigir reconhecimento de interrupção inexistente',async()=>{
 const title=`Sentença legada ${op()}`,w=await call('source_import',{operation_id:op(),title,text:'Uma sentença completa. '.repeat(100),original_language:'pt-BR'});works.push({...w,title});
 const c=await call('reading_context',{reading_id:w.reading_id}),old=legacyPortion({...c.element,text:c.original,source_id:c.source.id});
 await transaction(alice,db=>db.query('update araread.readings set opened=$2,resume=$2 where id=$1',[w.reading_id,JSON.stringify(old)]));
 const prepared=await call('context_prepare',{operation_id:op(),reading_id:w.reading_id,expected_revision:c.reading.revision,ref:old});await call('mediation_save',{operation_id:op(),reading_id:w.reading_id,expected_revision:prepared.revision,ref:old,context_id:prepared.context_id,rewrite:'A passagem contém sentenças completas repetidas para um teste de compatibilidade.',editorial_review:review,provenance:{agent:'Fixture legada',guidance_version:'1.2.0'}});
 const display=await call('reading_display',{reading_id:w.reading_id,ref:old});assert.equal(display.ready,true);assert.equal(display.passage.ends_mid_unit,false);assert.deepEqual(display.ref,old);assert.deepEqual(display.reading.covered,[]);
});
after(async()=>{for(const w of works)await call('work_delete',{operation_id:op(),work_id:w.work_id,confirm_title:w.title});await pool.end();});
