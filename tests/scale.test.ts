import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {pool,transaction} from '../src/db.ts';
import {config} from '../src/config.ts';
if(!config.local)throw new Error('Carga sintética apenas local.');
test('fonte extensa com 10 mil elementos mantém paginação e âncora estável',async()=>{
 const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
 const session=await(await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[0])})).json(),who=await authenticate(`Bearer ${session.access_token}`);
 const title=`Carga sintética ${randomUUID()}`,blocks=Array.from({length:10000},(_,i)=>({kind:'paragraph',text:`Elemento sintético ${i+1}. Uma premissa pode admitir exceção. `+('Condição preservada. '.repeat(8)),meta:{}}));
 const physical=async()=>transaction(who,async c=>Number((await c.query("select sum(pg_total_relation_size(c.oid)) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='araread' and c.relkind='r'")).rows[0].n));
 const physicalBefore=await physical(),before=performance.now(),source=await execute('source_import',{operation_id:randomUUID(),title,format:'structured',blocks,partial:true},who),importMs=performance.now()-before;
 try{
  const start=performance.now(),page=await execute('source_elements',{reading_id:source.reading_id,offset:9950,limit:50},who),pageMs=performance.now()-start;
  assert.equal(page.items.length,50);assert.equal(page.pagination.total,10000);assert.equal(page.pagination.next_offset,null);assert.equal(page.items[0].ordinal,9950);
  const ctx=await execute('reading_context',{reading_id:source.reading_id,ref:page.items[0].ref},who);assert.match(ctx.original,/9951/);assert.equal(ctx.reading.covered.length,0);
  const storage=await transaction(who,async c=>(await c.query('select octet_length(original) logical_original_bytes,pg_column_size(original) stored_original_bytes,(select sum(octet_length(text)) from araread.elements where source_id=$1) extracted_text_bytes from araread.sources where id=$1',[source.source_id])).rows[0]);
  const report={elements:10000,source_bytes:Buffer.byteLength(JSON.stringify(blocks)),import_ms:Math.round(importMs),last_page_ms:Math.round(pageMs),page_response_bytes:Buffer.byteLength(JSON.stringify(page)),max_limit:50,storage:{...storage,araread_relations_before:physicalBefore,araread_relations_after:await physical(),scope:'Local synthetic fixture; relation sizes include indexes, TOAST and previously allocated space; not a per-user capacity promise.'},measured_at:new Date().toISOString()};
  await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/scale.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await execute('work_delete',{operation_id:randomUUID(),work_id:source.work_id,confirm_title:title},who);}
});
after(async()=>{await pool.end();});
