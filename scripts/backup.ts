import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
const mode=process.argv[2],file=process.argv[3];
if(!['export','restore'].includes(mode)||!file)throw new Error('Uso: npm run backup -- export|restore caminho.json. Token em ARAREAD_ACCESS_TOKEN; nunca em argumento.');
const origin=process.env.APP_ORIGIN||'http://127.0.0.1:4317',token=process.env.ARAREAD_ACCESS_TOKEN;
if(!token)throw new Error('Configure ARAREAD_ACCESS_TOKEN apenas no ambiente do processo.');
async function call(tool:string,args:unknown){const r=await fetch(`${origin}/api/${tool}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args)});const out=await r.json();if(!r.ok||!out.ok)throw new Error(out.error?.message||`HTTP ${r.status}`);return out.data;}
if(mode==='export'){
 const sections:Record<string,unknown[]>={};let snapshot:string|undefined;
 for(const section of ['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts','reading_segments','references','perspectives','contexts','connections']){
  sections[section]=[];let offset:number|null=0;
  while(offset!==null){const page=await call('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=page.snapshot;sections[section].push(...page.items);offset=page.pagination.next_offset;}
 }
 await writeFile(file,JSON.stringify({format:'araread/2',snapshot,exported_at:new Date().toISOString(),sections}),{mode:0o600,flag:'wx'});console.log('Backup privado consistente criado e originais incluídos. Proteja o arquivo.');
}else{
 const bytes=await readFile(file,'utf8'),bundle=JSON.parse(bytes),requestFile=`${file}.restore-request.json`,sha256=createHash('sha256').update(bytes).digest('hex');
 let intent:{operation_id:string,sha256:string};
 try{intent=JSON.parse(await readFile(requestFile,'utf8'));if(intent.sha256!==sha256)throw new Error('O backup mudou desde a primeira tentativa. Preserve o arquivo e o pedido original.');}
 catch(e:any){if(e.code!=='ENOENT')throw e;intent={operation_id:randomUUID(),sha256};await writeFile(requestFile,JSON.stringify(intent),{mode:0o600,flag:'wx'});}
 const existing=await call('operation_get',{operation_id:intent.operation_id});
 const receipt=existing.status==='confirmed'?existing:await call('data_restore',{operation_id:intent.operation_id,bundle});
 await writeFile(`${file}.restore-receipt.json`,JSON.stringify(receipt,null,2),{mode:0o600,flag:'wx'});console.log('Restauração confirmada. Mapa de IDs no recibo privado ao lado do backup.');
}
