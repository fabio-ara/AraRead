// Gate separado: Auth/PostgreSQL hospedados, dominio executado neste processo Node.
// Nao e prova de gateway HTTP, interface hospedada ou ChatGPT.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {authenticate} from '../src/auth.ts';
import {execute} from '../src/service.ts';
import {pool,transaction} from '../src/db.ts';
import {config} from '../src/config.ts';

const ref=process.env.CONFIRMED_ARAREAD_PROJECT_REF||'',database=new URL(config.database);
assert.match(ref,/^[a-z]{20}$/,'Confirme o projeto exclusivo antes deste gate remoto.');
assert.equal(config.local,false);assert.equal(new URL(config.authUrl).hostname,`${ref}.supabase.co`);
assert.equal(database.username,`araread_app.${ref}`);assert.equal(database.searchParams.get('sslmode'),'verify-full');
assert.ok(database.searchParams.get('sslrootcert'));assert.ok(process.env.HOSTED_AUTH_ADMIN_KEY);
const endpoint=new URL(config.authUrl).origin,publishable=process.env.AUTH_PUBLISHABLE_KEY!;
const admin=createClient(endpoint,process.env.HOSTED_AUTH_ADMIN_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const run=randomUUID(),users:string[]=[],clients:any[]=[],passed:string[]=[];
const title=`AraRead hosted synthetic ${run}`;
const sourceText=('Uma hipotese pode valer sob condicoes limitadas. A ressalva e essencial. العربية 日本語 😀. ').repeat(30);
let reading:any,alice:any,aliceToken='',bob:any;
const pass=(name:string)=>{passed.push(name);console.log('PASS '+name);};
try{
 for(let i=0;i<2;i++){
  const email=`araread-${run}-${i}@example.invalid`,password=randomBytes(32).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error)throw created.error;users.push(created.data.user.id);
  const client=createClient(endpoint,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
  const logged=await client.auth.signInWithPassword({email,password});if(logged.error)throw logged.error;
  const identity=await authenticate(`Bearer ${logged.data.session!.access_token}`);
  clients.push(client);if(i===0){alice=identity;aliceToken=logged.data.session!.access_token;}else bob=identity;
 }
 pass('duas identidades sinteticas; assinatura, emissor e audiencia reais');
 const signup=await clients[1].auth.signUp({email:`araread-${run}-blocked@example.invalid`,password:randomBytes(32).toString('base64url')});
 assert.ok(signup.error,'Cadastro publico deve continuar fechado');pass('cadastro publico desativado');
 reading=await execute('source_import',{operation_id:randomUUID(),title,format:'text',text:sourceText,original_language:'pt',partial:true},alice);
 let context:any=await execute('reading_context',{reading_id:reading.reading_id},alice);
 assert.equal(context.effective_language,'pt-BR');assert.ok(context.ref.end<Array.from(sourceText).length);
 const original=await transaction(alice,async c=>(await c.query('select original,sha256 from araread.sources where id=$1',[reading.source_id])).rows[0]);
 assert.equal(original.original.toString(),sourceText);assert.equal(original.sha256,createHash('sha256').update(original.original).digest('hex'));
 pass('original imutavel, Unicode, porcao e idioma persistidos no banco remoto');
 const args={operation_id:randomUUID(),reading_id:reading.reading_id,expected_revision:context.reading.revision,ref:context.ref,rewrite:'A hipotese (suposicao a examinar) pode valer, desde que suas condicoes sejam respeitadas.',language:'pt-BR',provenance:{agent:'Gate sintetico remoto',guidance_version:'1.0.0'}};
 const receipt=await execute('mediation_save',args,alice);assert.equal(receipt.status,'confirmed');
 assert.deepEqual(await execute('operation_get',{operation_id:args.operation_id},alice),receipt);
 assert.deepEqual(await execute('mediation_save',args,alice),receipt);
 context=await execute('reading_context',{reading_id:reading.reading_id},alice);assert.equal(context.mediation.rewrite,args.rewrite);
 pass('mediacao conferida por segunda leitura e recibo idempotente');
 await execute('reading_move',{operation_id:randomUUID(),reading_id:reading.reading_id,expected_revision:context.reading.revision,action:'continue',ref:context.ref},alice);
 const resumed:any=await execute('reading_context',{reading_id:reading.reading_id},alice);
 assert.equal(resumed.reading.covered.length,1);assert.equal(resumed.reading.covered[0].end,context.ref.end);
 await execute('reading_move',{operation_id:randomUUID(),reading_id:reading.reading_id,expected_revision:resumed.reading.revision,action:'open',ref:context.ref},alice);
 const review:any=await execute('reading_context',{reading_id:reading.reading_id,position:'opened'},alice);
 assert.deepEqual(review.reading.resume,resumed.reading.resume);assert.equal(review.mediation.rewrite,args.rewrite);
 pass('continuidade e revisao conservam cobertura e retomada');
 assert.equal((await execute('library_list',{query:title},bob)).items.length,0);
 await assert.rejects(()=>execute('reading_context',{reading_id:reading.reading_id},bob),{code:'NOT_FOUND'});
 assert.equal((await transaction(bob,async c=>(await c.query('select id from araread.sources where id=$1',[reading.source_id])).rows)).length,0);
 assert.equal((await execute('operation_get',{operation_id:args.operation_id},bob)).status,'unknown');
 assert.equal((await execute('data_export',{section:'works'},bob)).items.length,0);
 await assert.rejects(()=>transaction(bob,async c=>c.query('insert into araread.elements(id,owner_id,source_id,ordinal,kind,text,locator) values($1,$2,$3,999,$4,$5,$6)',[randomUUID(),bob.id,reading.source_id,'paragraph','synthetic','x'])),(e:any)=>e.code==='23503');
 pass('RLS comum bloqueia fonte, busca, recibo, exportacao e referencia cruzada');
 const logout=await clients[0].auth.signOut({scope:'local'});if(logout.error)throw logout.error;
 const signedButRevoked=await authenticate(`Bearer ${aliceToken}`);
 await assert.rejects(()=>execute('account_context',{},signedButRevoked),{code:'SESSION_REVOKED'});
 pass('revogacao imediata de sessao ainda assinada');
}finally{
 for(const id of users){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)throw removed.error;}
 await pool.end();await mkdir('.local/evidence',{recursive:true});
 await writeFile('.local/evidence/hosted-backend.json',JSON.stringify({level:'Auth/PostgreSQL remotos; dominio Node local',checked_at:new Date().toISOString(),passed,synthetic_identities_removed:users.length,does_not_validate:['gateway HTTP hospedado','UI hospedada','ChatGPT']},null,2));
}
