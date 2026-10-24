// Limite de memória/corpo real do Edge, com duas contas sintéticas isoladas.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {backupSections} from '../src/study/backup.ts';
const ref=process.env.CONFIRMED_ARAREAD_PROJECT_REF||'',base=process.env.HOSTED_API_BASE||'';
assert.match(ref,/^[a-z]{20}$/);assert.equal(new URL(base).origin,`https://${ref}.supabase.co`);assert.equal(new URL(base).pathname,'/functions/v1/araread');assert.ok(process.env.HOSTED_AUTH_ADMIN_KEY);assert.ok(process.env.AUTH_PUBLISHABLE_KEY);
const endpoint=`https://${ref}.supabase.co`,admin=createClient(endpoint,process.env.HOSTED_AUTH_ADMIN_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),users:string[]=[],tokens:string[]=[];
const passed:string[]=[];let bundleBytes=0;
const api=async(name:string,args:any,token:string)=>{const response=await fetch(base+'/api/'+name,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(135000)});const result=await response.json();assert.equal(result.ok,true,JSON.stringify({status:response.status,error:result.error}));return result.data;};
try{
 for(let i=0;i<2;i++){const email=`araread-restore-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;users.push(created.data.user.id);const client=createClient(endpoint,process.env.AUTH_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),logged=await client.auth.signInWithPassword({email,password});if(logged.error)throw logged.error;tokens.push(logged.data.session!.access_token);}
 const capabilities=await api('account_context',{},tokens[0]);assert.equal(capabilities.capabilities.max_account_bytes,16*1024*1024);
 const original=await api('source_import',{operation_id:randomUUID(),title:'Restauração grande Edge sintética',format:'structured',retain_original:true,blocks:Array.from({length:120},(_,i)=>({kind:'paragraph',text:`Passagem sintética ${i}: `+'x'.repeat(59970),meta:{}}))},tokens[0]);
 let snapshot:string|undefined;const sections:Record<string,any[]>={};for(const section of backupSections){sections[section]=[];let offset:number|null=0;while(offset!==null){const result=await api('data_export',{section,offset,limit:50,include_original:true,snapshot},tokens[0]);snapshot=result.snapshot;sections[section].push(...result.items);offset=result.pagination.next_offset;}}
 sections.receipts=[];const bundle={format:'araread/3',snapshot,sections};bundleBytes=Buffer.byteLength(JSON.stringify(bundle));assert.ok(bundleBytes>16*1024*1024);assert.ok(bundleBytes<32*1024*1024);
 const operation_id=randomUUID(),restored=await api('data_restore',{operation_id,bundle},tokens[1]);assert.equal(restored.restored_readings,1);assert.equal((await api('operation_get',{operation_id},tokens[1])).status,'confirmed');
 const context=await api('reading_context',{reading_id:restored.id_map[original.reading_id]},tokens[1]);assert.notEqual(context.source.id,original.source_id);
 const sourceBytes=await(await fetch(base+'/api/original/'+original.source_id,{headers:{authorization:`Bearer ${tokens[0]}`}})).arrayBuffer(),restoredBytes=await(await fetch(base+'/api/original/'+context.source.id,{headers:{authorization:`Bearer ${tokens[1]}`}})).arrayBuffer();assert.equal(createHash('sha256').update(new Uint8Array(sourceBytes)).digest('hex'),createHash('sha256').update(new Uint8Array(restoredBytes)).digest('hex'));
 passed.push('perfil Edge informa cota real de 16 MiB','backup acima de 16 MiB restaura no gateway de 32 MiB','recibo confirmado e IDs remapeados','bytes originais iguais em contas distintas');for(const name of passed)console.log('PASS '+name);
}finally{
 for(const id of users){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)throw removed.error;}
 await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/hosted-restore.json',JSON.stringify({checked_at:new Date().toISOString(),bundle_bytes:bundleBytes,passed,synthetic_identities_removed:users.length},null,2));
}
