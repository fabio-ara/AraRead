import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {pool} from '../src/db.ts';
import {config} from '../src/config.ts';
if(!config.local)throw new Error('Fixtures editoriais exclusivas do ambiente local.');
const samples=JSON.parse(await readFile('tests/fixtures/editorial.json','utf8'));
const account=JSON.parse(await readFile('.local/test-accounts.json','utf8'))[0];
const auth=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(account)});assert.equal(auth.status,200);const identity=await authenticate(`Bearer ${(await auth.json()).access_token}`);
for(const sample of samples)test(`gêneros: preservação, mediação e segunda leitura — ${sample.name}`,async()=>{
 const source=await execute('source_import',{operation_id:randomUUID(),title:sample.name,genres:sample.genres,format:'structured',blocks:sample.blocks,original_language:'pt',partial:true},identity);
 try{
  const index=await execute('source_elements',{reading_id:source.reading_id},identity);assert.deepEqual(index.items.map((x:any)=>x.kind),sample.blocks.map((x:any)=>x.kind));
  const ref=index.items[sample.mediate_index].ref,ctx=await execute('reading_context',{reading_id:source.reading_id,ref,language:'pt-BR'},identity);assert.equal(ctx.original,sample.blocks[sample.mediate_index].text);
  await execute('mediation_save',{operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref,language:'pt-BR',rewrite:sample.rewrite,additions:sample.additions,provenance:{agent:'Amostra e avaliação editorial por IA; não revisada por humano',guidance_version:'1.0.0'}},identity);
  const again=await execute('reading_context',{reading_id:source.reading_id,ref,language:'pt-BR'},identity);assert.equal(again.mediation.rewrite,sample.rewrite);assert.deepEqual(again.mediation.additions,sample.additions);assert.deepEqual(again.reading.resume,ctx.reading.resume);assert.equal(again.reading.covered.length,0);
 }finally{await execute('work_delete',{operation_id:randomUUID(),work_id:source.work_id,confirm_title:sample.name},identity);}
});
after(()=>pool.end());
