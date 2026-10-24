import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {pool} from '../src/db.ts';
import {config} from '../src/config.ts';
if(!config.local)throw Error('Somente fixtures sintéticas locais.');
const account=JSON.parse(await readFile('.local/test-accounts.json','utf8'))[0],session=await(await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(account)})).json(),who=await authenticate(`Bearer ${session.access_token}`);
// Authored defects exercise review/versioning. These are not an automatic fidelity evaluator.
const cases=[
 {name:'negação',original:'A hipótese não estabelece certeza.',bad:'A hipótese estabelece certeza.',fixed:'A hipótese (afirmação provisória) não estabelece certeza.',problem:'A negação foi retirada, invertendo a afirmação.'},
 {name:'modalidade e condição',original:'Talvez A ocorra, somente se B for satisfeita.',bad:'A ocorre sempre.',fixed:'A pode ocorrer, mas o texto exige a condição B; não afirma que sempre ocorra.',problem:'Possibilidade virou certeza e a condição necessária desapareceu.'},
 {name:'atribuição',original:'A afirma P. B objeta P. O narrador não escolhe entre eles.',bad:'O narrador afirma P.',fixed:'A defende P; B apresenta uma objeção. O narrador não adota nenhuma das duas posições.',problem:'Uma posição citada foi atribuída indevidamente ao narrador.'},
];
for(const fixture of cases)test(`revisão editorial declarada: ${fixture.name}, histórico e original preservados`,async()=>{
 const title=`Defeito editorial sintético: ${fixture.name}`,w=await execute('source_import',{operation_id:randomUUID(),title,text:fixture.original},who);let c=await execute('reading_context',{reading_id:w.reading_id,language:'pt-BR'},who);
 const write=async(name:any,args:any)=>{const saved=await execute(name,{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:c.reading.revision,...args},who);c=await execute('reading_context',{reading_id:w.reading_id,language:'pt-BR'},who);return saved;};
 try{
  const prepared=await write('context_prepare',{ref:c.ref,language:'pt-BR'}),provenance={agent:'Fixture deliberadamente defeituosa, revisão por IA',guidance_version:'1.1.0'};
  const bad=await write('mediation_save',{ref:c.ref,language:'pt-BR',context_id:prepared.context_id,rewrite:fixture.bad,provenance});
  await write('correction_save',{ref:c.ref,mediation_id:bad.entity_id,problem:fixture.problem});
  const fixed=await write('mediation_save',{ref:c.ref,language:'pt-BR',context_id:prepared.context_id,rewrite:fixture.fixed,provenance,supersedes:bad.entity_id,regenerate:true});
  assert.equal(c.original,fixture.original);assert.deepEqual(c.reading.covered,[]);assert.equal(c.mediation.id,fixed.entity_id);
  const old=await execute('reading_context',{reading_id:w.reading_id,language:'pt-BR',ref:c.ref,variant_id:bad.entity_id},who);assert.equal(old.mediation.rewrite,fixture.bad);assert.equal(old.mediation.status,'needs_review');assert.equal(old.mediation.provenance.editorial_status,'ai_unreviewed');
 }finally{await execute('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:title},who);}
});
after(()=>pool.end());
