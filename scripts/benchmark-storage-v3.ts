/** Reproducible local-only comparison. No administrator bypass, no personal corpus. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool,transaction} from '../src/db.ts';
import {backupSections} from '../src/study/backup.ts';

assert.ok(config.local&&new URL(config.database).hostname==='127.0.0.1','Somente banco local isolado.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
const auth=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[1])});assert.equal(auth.status,200);
const who=await authenticate(`Bearer ${(await auth.json()).access_token}`),run=randomUUID(),count=16;
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const report:any={date:new Date().toISOString(),revision:git('rev-parse','HEAD'),working_tree_dirty:!!git('status','--porcelain'),node:process.version,documents:count,paragraphs_per_document:160,policies:{},limits:[
 'Corpus HTML sintético determinístico: prosa repetitiva, valores únicos, navegação e marcação. Não representa todo PDF ou biblioteca.',
 'Operações passam pelo domínio real com Auth e papel authenticated. Tabelas TEMP copiam schema, compressão e índices reais, incluindo TOAST; sem dados de outras contas.',
 'Tamanhos físicos são alocações de tabelas novas, sem WAL, backups do provedor, bloat preexistente ou concorrência. Não são previsão do limite Free.',
 'Tempos são uma execução local aquecida, sem teste de carga nem garantia de latência hospedada. Exportação pagina a conta sintética; bytes reportados separam a amostra.',
 'pg_column_size mede conteúdo após compressão quando aplicável, não substitui pg_table_size/pg_indexes_size. Pequenos ganhos podem ser absorvidos por blocos de alocação.'
]};
const digest=(n:string)=>createHash('sha256').update(n).digest('hex');
const docs=Array.from({length:count},(_,d)=>`<html><body><nav>${Array.from({length:80},(_,i)=>`<a href="https://example.invalid/${digest(`${d}-${i}`)}">Menu ${i}</a>`).join('')}</nav><article><h1>Modelo sintético ${d}</h1>${Array.from({length:160},(_,i)=>`<p data-layout="article-prose-block-${i}">No caso sintético ${d}, a hipótese ${i} pode explicar uma observação, mas não estabelece uma conclusão necessária. A condição permanece explícita e a objeção deve ser examinada. Identificador da observação: ${digest(`${d}/${i}`).slice(0,24)}.</p>`).join('')}</article></body></html>`);
const summary=(numbers:number[])=>{const sorted=[...numbers].sort((a,b)=>a-b);return {total_ms:+numbers.reduce((a,b)=>a+b,0).toFixed(2),median_ms:+sorted[Math.floor(sorted.length/2)].toFixed(2),p95_ms:+sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)].toFixed(2)};};
try{
 report.postgres=await transaction(who,async c=>(await c.query("select current_setting('server_version') version,current_setting('default_toast_compression') default_compression,current_user role")).rows[0]);
 for(const policy of ['raw_retained','text_first']){
  const works:any[]=[],operations=new Set<string>(),timings:{import:number[],query:number[],variant:number[]}={import:[],query:[],variant:[]};
  const write=async(name:any,args:any)=>{const operation_id=randomUUID();operations.add(operation_id);return execute(name,{...args,operation_id},who);};
  try{
   for(let i=0;i<count;i++){
    const title=`Benchmark 0.3 ${run} ${policy} ${i}`,start=performance.now();
    const source=await write('source_import',{title,format:'html',text:docs[i],original_language:'pt-BR',partial:false,retain_original:policy==='raw_retained'});timings.import.push(performance.now()-start);works.push({...source,title});assert.equal(source.original_available,policy==='raw_retained');
    const query=performance.now(),index=await execute('source_elements',{reading_id:source.reading_id,offset:1,limit:1},who),ref=index.items[0].ref;await execute('reading_context',{reading_id:source.reading_id,ref},who);timings.query.push(performance.now()-query);
    const variant=performance.now(),prepared=await write('context_prepare',{reading_id:source.reading_id,expected_revision:0,ref});
    for(let v=0;v<2;v++)await write('mediation_save',{reading_id:source.reading_id,expected_revision:prepared.revision+v,ref,context_id:prepared.context_id,regenerate:v>0,rewrite:`Variante sintética ${v}: uma hipótese é uma explicação possível, que depende de condições e não estabelece certeza. `.repeat(6),provenance:{agent:'Benchmark sintético',guidance_version:'1.2.0'}});
    timings.variant.push(performance.now()-variant);
   }
   const ids=works.map(w=>w.work_id),readingIds=works.map(w=>w.reading_id),sourceIds=works.map(w=>w.source_id);
   const storage=await transaction(who,async c=>{
    const conditions:Record<string,[string,string[]]>={works:['id',ids],sources:['work_id',ids],elements:['source_id',sourceIds],readings:['id',readingIds],reading_segments:['reading_id',readingIds],mediations:['reading_id',readingIds],contexts:['reading_id',readingIds],receipts:['operation_id',[...operations]]};
    const physical:any={};let total=0;
    for(const [table,[column,values]]of Object.entries(conditions)){
     const temp=`bench_${table}`;await c.query(`create temp table ${temp} (like araread.${table} including all) on commit drop`);
     await c.query(`insert into ${temp} select * from araread.${table} where ${column}=any($1::uuid[])`,[values]);await c.query(`analyze ${temp}`);
     const measured=(await c.query('select pg_relation_size($1::regclass)::integer heap,pg_table_size($1::regclass)::integer table_with_toast,pg_indexes_size($1::regclass)::integer indexes,pg_total_relation_size($1::regclass)::integer total',[temp])).rows[0];
     measured.toast_and_auxiliary=measured.table_with_toast-measured.heap;physical[table]=measured;total+=measured.total;
    }
    const logical=(await c.query(`select (select sum(octet_length(text)) from bench_elements)::bigint text_bytes,(select sum(coalesce(octet_length(original),0)) from bench_sources)::bigint raw_bytes,(select sum(octet_length(rewrite)+octet_length(additions::text)) from bench_mediations)::bigint variant_bytes,(select sum(pg_column_size(original)) from bench_sources)::bigint compressed_raw_column_bytes,(select sum(octet_length((to_jsonb(s)-'original')::text)) from bench_sources s)::bigint source_metadata_json_bytes,(select sum(octet_length((to_jsonb(e)-'text')::text)) from bench_elements e)::bigint element_metadata_json_bytes,(select sum(octet_length(row_to_json(c)::text)) from bench_contexts c)::bigint context_json_bytes`)).rows[0];
    const compression=(await c.query("select attname,attcompression from pg_attribute where attrelid='bench_sources'::regclass and attname='original'")).rows[0];
    return {logical:Object.fromEntries(Object.entries(logical).map(([k,v])=>[k,Number(v||0)])),physical,total_physical_bytes:total,original_compression:compression.attcompression};
   });
   const start=performance.now(),sections:Record<string,any[]>={};let snapshot:string|undefined,accountBytes=0,pages=0;
   for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await execute('data_export',{section,offset,limit:50,include_original:true,snapshot},who);snapshot=p.snapshot;pages++;accountBytes+=Buffer.byteLength(JSON.stringify(p));sections[section].push(...p.items.filter((r:any)=>ids.includes(r.id)||ids.includes(r.work_id)||sourceIds.includes(r.id)||sourceIds.includes(r.source_id)||readingIds.includes(r.id)||readingIds.includes(r.reading_id)||operations.has(r.operation_id)));offset=p.pagination.next_offset;}}
   report.policies[policy]={input_bytes:docs.reduce((n,s)=>n+Buffer.byteLength(s),0),...storage,timings:{import:summary(timings.import),query:summary(timings.query),two_variants:summary(timings.variant),backup_ms:+(performance.now()-start).toFixed(2)},backup_sample_bytes:Buffer.byteLength(JSON.stringify({format:'araread/3',sections})),backup_account_transfer_bytes:accountBytes,backup_pages:pages};
  }finally{for(const w of works)await execute('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:w.title},who);}
 }
 const a=report.policies.raw_retained,b=report.policies.text_first;
 report.comparison={physical_saved_bytes:a.total_physical_bytes-b.total_physical_bytes,physical_saved_percent:+((1-b.total_physical_bytes/a.total_physical_bytes)*100).toFixed(2),backup_saved_bytes:a.backup_sample_bytes-b.backup_sample_bytes,backup_saved_percent:+((1-b.backup_sample_bytes/a.backup_sample_bytes)*100).toFixed(2)};
 await writeFile('.local/benchmark-storage-v3.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.comparison));
}finally{await pool.end();}
