/** Synthetic corpus, ordinary Auth/RLS and isolated local PostgreSQL only. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {config} from '../src/config.ts';
import {authenticate} from '../src/auth.ts';
import {execute} from '../src/service.ts';
import {pool,transaction} from '../src/db.ts';
import {prepareDemo} from '../tests/fixtures/study-edition.ts';

assert(config.local&&new URL(config.database).hostname==='127.0.0.1','Somente banco local isolado.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
const identities=await Promise.all(accounts.slice(0,2).map(async(body:any)=>{const r=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);const token=(await r.json()).access_token;return {token,identity:await authenticate(`Bearer ${token}`)};}));
const call=(name:any,args:any,reader=0)=>execute(name,args,identities[reader].identity);
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
try{
 const demo=await prepareDemo(call,`Benchmark sintético ${randomUUID()}`),context=await call('edition_context',{version_id:demo.version_id});
 const conditions:Record<string,[string,string[]]>={edition_projects:['id',[demo.project_id]],edition_sources:['id',demo.imported.map(s=>s.source_id)],edition_passages:['project_id',[demo.project_id]],edition_versions:['id',[demo.version_id]],edition_settings:['scope_id',[demo.project_id]],edition_reviews:['project_id',[demo.project_id]]};
 const counts=()=>transaction(identities[0].identity,async c=>Object.fromEntries(await Promise.all(Object.entries(conditions).map(async([table,[column,ids]])=>[table,(await c.query(`select count(*)::integer n from araread.${table} where ${column}=any($1::uuid[])`,[ids])).rows[0].n]))));
 const before=await counts(),traffic:any[]=[],contexts:any[]=[];
 for(let reader=0;reader<2;reader++){
  let bytes=0,gzip=0;const start=performance.now();
  for(const p of context.outline){const r=await fetch(`${config.origin}/api/edition_context`,{method:'POST',headers:{authorization:`Bearer ${identities[reader].token}`,'content-type':'application/json'},body:JSON.stringify({version_id:demo.version_id,passage_id:p.id})});assert.equal(r.status,200);const body=Buffer.from(await r.arrayBuffer()),returned=JSON.parse(body.toString()).data;assert.equal(returned.passage.id,p.id);if(reader===0)contexts.push(returned);bytes+=body.length;gzip+=gzipSync(body).length;}
  traffic.push({reader:reader+1,passages:context.outline.length,response_body_bytes:bytes,gzip_if_transport_enabled_bytes:gzip,elapsed_ms:Math.round(performance.now()-start)});
  await call('edition_annotate',{operation_id:randomUUID(),expected_revision:0,version_id:demo.version_id,passage_id:context.passage.id,action:'note',text:`Nota sintética da conta ${reader+1}.`},reader);
 }
 assert.deepEqual(await counts(),before,'Ler e anotar não duplicam conteúdo editorial.');
 const size=(value:unknown)=>Buffer.byteLength(JSON.stringify(value)),components:Record<string,number>={original_structured:0,translation:0,facilitated:0,supports:0,activities:0,evidence:0};
 for(const c of contexts){const p=c.passage.content;components.original_structured+=size(c.passage.originals);components.translation+=size(p.segments.filter((s:any)=>s.representation==='translation'));components.facilitated+=size(p.segments.filter((s:any)=>s.representation==='facilitated'));components.supports+=size(p.supports);components.activities+=size(p.activities);components.evidence+=size(p.evidence);}
 const offlineChapters=[...new Set(contexts.map(c=>c.passage.content.chapter))].map(chapter=>{const subset=contexts.filter(c=>c.passage.content.chapter===chapter);return {chapter,passages:subset.length,contexts_json_bytes:size(subset),meaning:'Payload de contextos completo, antes do envelope e overhead do IndexedDB; a jornada web mede a entrada efetivamente gravada.'};});
 const physical:any={},logical:any={};
 await transaction(identities[0].identity,async c=>{
  for(const [table,[column,ids]]of Object.entries(conditions)){
   const temp=`bench_${table}`;await c.query(`create temp table ${temp} (like araread.${table} including all) on commit drop`);await c.query(`insert into ${temp} select * from araread.${table} where ${column}=any($1::uuid[])`,[ids]);await c.query(`analyze ${temp}`);
   physical[table]=(await c.query('select pg_relation_size($1::regclass)::integer heap,pg_table_size($1::regclass)::integer table_with_toast,pg_indexes_size($1::regclass)::integer indexes,pg_total_relation_size($1::regclass)::integer total',[temp])).rows[0];
   logical[table]=Number((await c.query(`select coalesce(sum(octet_length(row_to_json(t)::text)),0) bytes from ${temp} t`)).rows[0].bytes);
  }
 });
 const personal=[];
 for(const {identity}of identities)personal.push(await transaction(identity,async c=>{const states=(await c.query('select * from araread.edition_readers where version_id=$1',[demo.version_id])).rows,notes=(await c.query('select * from araread.edition_annotations where version_id=$1',[demo.version_id])).rows;assert.equal(states.length,1);assert.equal(notes.length,1);return {reader_rows:states.length,annotation_rows:notes.length,json_bytes:Buffer.byteLength(JSON.stringify({states,notes}))};}));
 const report={checked_at:new Date().toISOString(),revision:git('rev-parse','HEAD'),working_tree_dirty:!!git('status','--porcelain'),environment:'PostgreSQL/Auth locais reais, papel authenticated, duas contas sintéticas',content_rows_before_and_after:before,logical_json_bytes:logical,physical_new_tables:physical,personal_states:personal,traffic,limits:['Corpus pequeno: quatro passagens, dois capítulos. Não representa capacidade do Supabase Free nem teste de carga.','Tabelas TEMP copiam schema, compressão e índices; alocações excluem WAL, bloat e backups do provedor.','Tráfego conta corpo HTTP real sem cabeçalhos/TLS. Gzip é apenas estimativa separada, não compressão observada no transporte.','A fonte incorporada conserva um snapshot do autor além da biblioteca legada. Nenhum snapshot adicional é criado por leitor.','Recibos e histórico operacional não entram no total das tabelas editoriais selecionadas.']};
 await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/editions-storage.json',JSON.stringify({...report,component_json_bytes:components,offline_chapters:offlineChapters},null,2)+'\n');console.log(JSON.stringify({content_rows:before,shared_physical_bytes:Object.values(physical).reduce((n:number,p:any)=>n+p.total,0),personal,traffic,components,offlineChapters}));
}finally{await pool.end();}
