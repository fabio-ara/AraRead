/** Explicit real local OCR/HTTPS acceptance, separate from the offline fixture suite. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {extract} from '../src/importers.ts';
import {execute} from '../src/service.ts';
import {authenticate} from '../src/auth.ts';
import {config} from '../src/config.ts';
import {pool} from '../src/db.ts';

if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Somente ambiente local isolado.');
const payloadPath=process.argv[2];assert.ok(payloadPath,'Informe o payload gerado pelo adaptador OCR real.');
const payload=JSON.parse(await readFile(payloadPath,'utf8'));
assert.equal(payload.ocr.engine,'tesseract');assert.doesNotMatch(payload.ocr.engine_version,/synthetic|fixture/i);
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
const response=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[0])});assert.equal(response.status,200);
const who=await authenticate(`Bearer ${(await response.json()).access_token}`),title=`OCR real sintético ${randomUUID()}`;
let imported:any;const evidence:any={date:new Date().toISOString(),environment:'PostgreSQL/Auth locais reais; material sintético; sem serviço pago'};
try{
 const x=await extract(payload),text=x.blocks.map(b=>b.text).join(' ');
 assert.match(text,/does not prove a necessary conclusion/i);assert.match(text,/condition must not be omitted/i);
 assert.equal(x.quality.original_required,true);assert.equal(x.quality.status,'partial');
 imported=await execute('source_import',{...payload,title,operation_id:randomUUID()},who);
 assert.equal(imported.original_available,true);
 const context=await execute('reading_context',{reading_id:imported.reading_id},who);assert.equal(context.source.partial,true);
 evidence.ocr={engine:payload.ocr.engine,version:payload.ocr.engine_version,pages:payload.ocr.pages.length,confidence:payload.ocr.pages.map((p:any)=>p.confidence),quality:x.quality,negations_preserved:true,original_retained:imported.original_available};
 if(process.argv.includes('--live-sep')){
  const live=await extract({format:'url',url:'https://plato.stanford.edu/entries/plato/'}),first=live.blocks.find(b=>b.kind==='paragraph')!;
  assert.ok(first);assert.match(live.metadata.title,/Plato/i);assert.match(first.text,/Plato/i);assert.doesNotMatch(first.text,/Browse|Table of Contents|Support SEP/i);assert.notEqual(live.quality.status,'rejected');assert.ok(live.blocks.some(b=>b.kind==='heading'&&b.text==='Bibliography'));assert.ok(live.blocks.some(b=>b.kind==='list'));assert.ok(live.metadata.author);
  evidence.sep={url:'https://plato.stanford.edu/entries/plato/',title:live.metadata.title,first_kind:first.kind,first_excerpt:Array.from(first.text).slice(0,85).join(''),elements:live.blocks.length,quality:live.quality,bytes:live.original.length,canonical_sha256:live.canonical_hash,persisted:false};
 }
 await writeFile('.local/ingestion-v3-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{if(imported)await execute('work_delete',{operation_id:randomUUID(),work_id:imported.work_id,confirm_title:title},who);await pool.end();}
