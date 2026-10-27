// Gate voluntário do HTTP hospedado. Não importa domínio/banco do servidor.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const ref=process.env.CONFIRMED_ARAREAD_PROJECT_REF||'',base=process.env.HOSTED_API_BASE||'',origin=process.env.HOSTED_FRONTEND_ORIGIN||'';
assert.match(ref,/^[a-z]{20}$/);assert.equal(new URL(base).origin,`https://${ref}.supabase.co`);assert.equal(new URL(base).pathname,'/functions/v1/araread');assert.ok(origin.startsWith('https://'));
assert.ok(process.env.HOSTED_AUTH_ADMIN_KEY);assert.ok(process.env.AUTH_PUBLISHABLE_KEY);
const endpoint=`https://${ref}.supabase.co`,admin=createClient(endpoint,process.env.HOSTED_AUTH_ADMIN_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),users:string[]=[],clients:any[]=[],passed:string[]=[];
const pass=(name:string)=>{passed.push(name);console.log('PASS '+name);};
const json=async(path:string,args:unknown,token?:string,extra:Record<string,string>={})=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{...extra}),...extra},body:JSON.stringify(args),signal:AbortSignal.timeout(45000)});return {status:r.status,body:await r.json(),headers:r.headers};};
try{
 const health=await fetch(`${base}/health`);assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
 const denied=await json('/api/library_list',{});assert.equal(denied.status,401);assert.ok(denied.headers.get('www-authenticate'));pass('saude com banco real; dados sem token recebem 401');
 for(let i=0;i<2;i++){
  const email=`araread-http-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;users.push(created.data.user.id);
  const client=createClient(endpoint,process.env.AUTH_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;clients.push({client,token:signed.data.session!.access_token});
 }
 const alice=clients[0].token,bob=clients[1].token;
 const foreign=await json('/api/library_list',{},alice,{origin:'https://untrusted.example'});assert.equal(foreign.status,403);assert.equal(foreign.headers.get('access-control-allow-origin'),null);
 const preflight=await fetch(base+'/api/library_list',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);pass('CORS aceita somente a origem da interface');
 const text=('Uma hipótese tem condições; uma possibilidade não é certeza. العربية 日本語 😀. ').repeat(26),title=`Gate HTTP ${randomUUID()}`;
 const imported=await json('/api/source_import',{operation_id:randomUUID(),format:'text',title,text,partial:true,retain_original:true},alice,{origin});assert.equal(imported.status,200,JSON.stringify(imported.body));const source=imported.body.data;
 const context=await json('/api/reading_context',{reading_id:source.reading_id},alice);assert.equal(context.body.data.effective_language,'pt-BR');
 const raw=await fetch(`${base}/api/original/${source.source_id}`,{headers:{authorization:`Bearer ${alice}`}});assert.equal(raw.status,200);const bytes=Buffer.from(await raw.arrayBuffer());assert.equal(bytes.toString(),text);assert.equal(raw.headers.get('x-original-sha256'),createHash('sha256').update(bytes).digest('hex'));pass('HTTP preserva bytes e hash; porcao e idioma reais');
 const args={operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref:context.body.data.ref,rewrite:'A hipótese (suposição que será examinada) depende das condições indicadas.',provenance:{agent:'Gate HTTP sintético',guidance_version:'1.0.0'}};
 const saved=await json('/api/mediation_save',args,alice);assert.equal(saved.body.data.status,'confirmed');assert.deepEqual((await json('/api/mediation_save',args,alice)).body,saved.body);assert.deepEqual((await json('/api/operation_get',{operation_id:args.operation_id},alice)).body.data,saved.body.data);
 const reread=await json('/api/reading_context',{reading_id:source.reading_id},alice);assert.equal(reread.body.data.mediation.rewrite,args.rewrite);pass('escrita, segunda leitura e recibo idempotente pelo gateway');
 assert.equal((await json('/api/library_list',{query:title},bob)).body.data.items.length,0);assert.equal((await json('/api/reading_context',{reading_id:source.reading_id},bob)).status,404);assert.equal((await fetch(`${base}/api/original/${source.source_id}`,{headers:{authorization:`Bearer ${bob}`}})).status,404);assert.equal((await json('/api/operation_get',{operation_id:args.operation_id},bob)).body.data.status,'unknown');pass('duas identidades isoladas por RLS atraves do HTTP');
 const pdf=await json('/api/source_import',{operation_id:randomUUID(),format:'pdf',title:'PDF sintético HTTP',file_base64:(await readFile('tests/fixtures/synthetic-extraction.pdf')).toString('base64')},alice);assert.equal(pdf.status,200,JSON.stringify(pdf.body));const pdfContext=await json('/api/reading_context',{reading_id:pdf.body.data.reading_id},alice);assert.ok(pdfContext.body.data.source.warnings.length);pass('PDF real no Edge, com avisos da extracao parcial');
 const url=await json('/api/source_import',{operation_id:randomUUID(),format:'url',title:'Página pública de teste',url:'https://example.com'},alice);assert.equal(url.status,200,JSON.stringify(url.body));
 const blocked=await json('/api/source_import',{operation_id:randomUUID(),format:'url',title:'SSRF sintético',url:'https://127.0.0.1/'},alice);assert.equal(blocked.body.error.code,'UNSAFE_URL');pass('URL publica funciona no Edge e loopback e recusado');
 const concurrent=await Promise.all(Array.from({length:24},(_,i)=>json('/api/account_context',{},clients[i%2].token)));
 for(const [i,result]of concurrent.entries()){assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.data.account.id,users[i%2]);}
 pass('24 chamadas concorrentes preservam identidades pelo pooler transacional');
 // Novos contratos da 0.4, exercitados somente por identidades comuns pelo Edge.
 const invoke=async(name:string,args:any,token=alice)=>{const r=await json('/api/'+name,args,token);assert.equal(r.status,200,JSON.stringify(r.body.error));assert.equal(r.body.ok,true);return r.body.data;};
 let current=await invoke('reading_context',{reading_id:source.reading_id});assert.equal(current.original,text.trim());assert.deepEqual(current.ref,current.passage.full_ref);assert.equal(current.passage.is_fragment,false);
 const target={representation:'original',segment:'main',start:0,end:3,exact:'Uma',prefix:'',suffix:[...text].slice(3,35).join('')};
 const highlightArgs={operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:current.reading.revision,ref:current.ref,target};
 const highlight=await invoke('highlight_save',highlightArgs);assert.equal(highlight.status,'confirmed');assert.deepEqual(await invoke('highlight_save',highlightArgs),highlight);
 assert.equal((await invoke('highlight_list',{reading_id:source.reading_id})).items[0].target.exact,'Uma');assert.equal((await json('/api/highlight_list',{reading_id:source.reading_id},bob)).status,404);assert.equal((await invoke('operation_get',{operation_id:highlightArgs.operation_id},bob)).status,'unknown');
 pass('0.4: paragrafo inteiro, grifo Unicode, recibo e isolamento no Edge');
 current=await invoke('reading_context',{reading_id:source.reading_id});await invoke('term_save',{operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:current.reading.revision,ref:current.ref,term:'Uma',language:'pt-BR',definition:'Artigo indefinido na passagem sintética.',origin:'user',details:{selection:target,definition_kind:'contextual'}});
 const beforeQueries=await invoke('reading_context',{reading_id:source.reading_id});const lexical=await invoke('lexicon_lookup',{reading_id:source.reading_id,ref:current.ref,selection:target,term:'Uma',language:'pt-BR'});assert.equal(lexical.saved[0].context_match,'same_selection');assert.equal(lexical.external,null);
 for(const [input,value]of [['429?–347 B.C.E.',82],['1 BCE–1 CE',1],['sin(30)',0.5]] as const)assert.equal((await invoke('contextual_calculate',{reading_id:source.reading_id,ref:current.ref,input})).value,value);
 assert.equal((await json('/api/contextual_calculate',{reading_id:source.reading_id,ref:current.ref,input:'1/0'},alice)).body.error.code,'CALCULATION_INPUT');
 const afterQueries=await invoke('reading_context',{reading_id:source.reading_id});assert.equal(afterQueries.reading.revision,beforeQueries.reading.revision);assert.deepEqual(afterQueries.reading.covered,[]);assert.deepEqual(afterQueries.reading.resume,beforeQueries.reading.resume);
 pass('0.4: vocabulario com selecao e calculos puros nao mudam progresso');
 const sections:Record<string,any[]>={};let snapshot:string|undefined;const manifest=await invoke('data_export',{section:'works',limit:1});
 for(const section of manifest.sections){sections[section]=[];let offset:number|null=0;while(offset!==null){const page=await invoke('data_export',{section,offset,limit:50,include_original:true,snapshot});snapshot=page.snapshot;sections[section].push(...page.items);offset=page.pagination.next_offset;}}
 const restored=await invoke('data_restore',{operation_id:randomUUID(),bundle:{format:'araread/3',snapshot,sections}},bob);const copied=await invoke('highlight_list',{reading_id:restored.id_map[source.reading_id]},bob);assert.equal(copied.items[0].state,'anchored');assert.equal(copied.items[0].target.exact,'Uma');assert.notEqual(copied.items[0].id,highlight.highlight_id);
 const copiedContext=await invoke('reading_context',{reading_id:restored.id_map[source.reading_id]},bob);assert.equal(copiedContext.original,current.original);assert.deepEqual(copiedContext.reading.covered,[]);
 pass('0.4: backup v3 restaura grifo em outra conta com novos IDs');
 const signed=await clients[0].client.auth.signOut({scope:'local'});if(signed.error)throw signed.error;const revoked=await json('/api/account_context',{},alice);assert.equal(revoked.status,401,JSON.stringify(revoked.body));assert.equal(revoked.body.error.code,'SESSION_REVOKED');pass('sessao revogada perde acesso imediatamente no gateway');
}finally{
 for(const id of users){const deleted=await admin.auth.admin.deleteUser(id);if(deleted.error)throw deleted.error;}
 await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/hosted-http.json',JSON.stringify({level:'HTTP Edge e Auth/PostgreSQL hospedados',checked_at:new Date().toISOString(),passed,synthetic_identities_removed:users.length,does_not_validate:['interface hospedada','ChatGPT']},null,2));
}
