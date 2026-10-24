import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {config} from '../src/config.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw new Error('Prova de reinício exclusiva do ambiente local.');
const origin='http://127.0.0.1:4316';
async function start(){
 const child=spawn(process.execPath,['--import','tsx','--env-file-if-exists=.env','src/server.ts'],{env:{...process.env,PORT:'4316',APP_ORIGIN:origin,MCP_AUDIENCE:`${origin}/mcp`,NODE_ENV:'production'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Servidor de prova não iniciou.')),15000);child.stdout!.on('data',b=>{if(b.toString().includes(origin)){clearTimeout(timer);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Servidor de prova terminou: ${code}`));});});return child;
}
async function stop(child:ChildProcess){if(child.exitCode!==null)return;const exited=once(child,'exit');child.kill();await exited;}
test('reinício real do processo conserva posição, idioma, mediação, pergunta e glossário em outro cliente',async()=>{
 const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));let child=await start();let work:any;
 const login=async()=>{const r=await fetch(`${origin}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[0])});assert.equal(r.status,200);return (await r.json()).access_token;};
 let token=await login();
 const api=async(name:string,args:any)=>{const response=await fetch(`${origin}/api/${name}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args)});const result=await response.json();assert.equal(result.ok,true,result.error?.message);return result.data;};
 try{
  work=await api('source_import',{operation_id:randomUUID(),title:'Fixture sintética de reinício',text:('Possibilidade não significa certeza. ').repeat(100)});
  let ctx=await api('reading_context',{reading_id:work.reading_id});
  const mutate=async(name:string,args:any)=>{const receipt=await api(name,{operation_id:randomUUID(),reading_id:work.reading_id,expected_revision:ctx.reading.revision,...args});ctx=await api('reading_context',{reading_id:work.reading_id});return receipt;};
  await mutate('reading_move',{action:'continue',ref:ctx.ref});
  await mutate('preferences_set',{language:'ja'});
  await mutate('mediation_save',{ref:ctx.ref,rewrite:'可能性（起こり得ること）は確実性を意味しない。',provenance:{agent:'Fixture sintética de reinício',guidance_version:'1.0.0'}});
  await mutate('term_save',{ref:ctx.ref,term:'可能性',definition:'この文脈では、起こり得ること。',origin:'assistant'});
  await mutate('note_save',{ref:ctx.ref,kind:'question',text:'Que condição permanece em aberto?',origin:'user'});
  const before=ctx;
  await stop(child);child=await start();token=await login();
  const after=await api('reading_context',{reading_id:work.reading_id});assert.deepEqual(after.reading,before.reading);assert.equal(after.mediation.rewrite,before.mediation.rewrite);assert.deepEqual(after.terms,before.terms);assert.deepEqual(after.notes,before.notes);assert.equal(after.effective_language,'ja');
 }finally{if(work)await api('work_delete',{operation_id:randomUUID(),work_id:work.work_id,confirm_title:'Fixture sintética de reinício'});await stop(child);}
});
