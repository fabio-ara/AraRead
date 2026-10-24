import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {config} from '../src/config.ts';
if(!config.local)throw new Error('Restauração grande apenas local e sintética.');
test('backup com mais de 16 MiB restaura originais e elementos pela rota autenticada',async()=>{
 const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8')),auth=await fetch(`${config.origin}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[0])});assert.equal(auth.status,200);const token=(await auth.json()).access_token;
 const api=async(name:string,args:any)=>{const r=await fetch(`${config.origin}/api/${name}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args)});const data=await r.json();assert.equal(data.ok,true,data.error?.message);return data.data;};
 const title=`Fixture grande de restauração ${randomUUID()}`;let original:any,restored:any;
 try{
  original=await api('source_import',{operation_id:randomUUID(),title,format:'structured',blocks:Array.from({length:120},(_,i)=>({kind:'paragraph',text:`Passagem sintética ${i}: `+'x'.repeat(59970),meta:{}}))});
  const sections:Record<string,any[]>={};for(const section of ['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts']){sections[section]=[];let offset:number|null=0;while(offset!==null){const p=await api('data_export',{section,offset,limit:50,include_original:true});sections[section].push(...p.items);offset=p.pagination.next_offset;}}
  // Exporta somente a obra sintética deste teste; nunca duplica outra biblioteca.
  sections.works=sections.works.filter(x=>x.id===original.work_id);sections.sources=sections.sources.filter(x=>x.work_id===original.work_id);sections.elements=sections.elements.filter(x=>x.source_id===original.source_id);sections.readings=sections.readings.filter(x=>x.id===original.reading_id);for(const s of ['mediations','notes','terms','events'])sections[s]=sections[s].filter(x=>x.reading_id===original.reading_id);sections.receipts=[];
  const bundle={format:'araread/1',sections};assert.ok(Buffer.byteLength(JSON.stringify(bundle))>16*1024*1024);
  const denied=await fetch(`${config.origin}/api/data_restore`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(denied.status,401);
  restored=await api('data_restore',{operation_id:randomUUID(),bundle});assert.equal(restored.restored_readings,1);
  const again=await api('reading_context',{reading_id:restored.id_map[original.reading_id]});assert.equal(again.original.startsWith('Passagem sintética 0:'),true);assert.notEqual(again.source.id,original.source_id);
  const a=await fetch(`${config.origin}/api/original/${original.source_id}`,{headers:{authorization:`Bearer ${token}`}}),b=await fetch(`${config.origin}/api/original/${again.source.id}`,{headers:{authorization:`Bearer ${token}`}});assert.deepEqual(Buffer.from(await a.arrayBuffer()),Buffer.from(await b.arrayBuffer()));
 }finally{if(restored)await api('work_delete',{operation_id:randomUUID(),work_id:restored.id_map[original.work_id],confirm_title:title});if(original)await api('work_delete',{operation_id:randomUUID(),work_id:original.work_id,confirm_title:title});}
});
