import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
const ref=process.env.CONFIRMED_ARAREAD_PROJECT_REF||'',base=process.env.HOSTED_API_BASE||'',origin=process.env.HOSTED_FRONTEND_ORIGIN||'';
assert.match(ref,/^[a-z]{20}$/);assert.equal(new URL(base).origin,`https://${ref}.supabase.co`);assert.equal(new URL(base).pathname,'/functions/v1/araread');assert.ok(origin.startsWith('https://'));
const endpoint=`https://${ref}.supabase.co`,auth=endpoint+'/auth/v1',resource=base+'/mcp',key=process.env.AUTH_PUBLISHABLE_KEY!;
assert.ok(key);assert.ok(process.env.HOSTED_AUTH_ADMIN_KEY);
const admin=createClient(endpoint,process.env.HOSTED_AUTH_ADMIN_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),web=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}}),passed:string[]=[];
const pass=(name:string)=>{passed.push(name);console.log('PASS '+name);};
let userId='',clientId='',client:Client|undefined,ui:any=null;
const post=async(url:string,body:unknown,token?:string)=>{const r=await fetch(url,{method:'POST',headers:{apikey:key,'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};};
try{
 const email=`araread-mcp-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;userId=created.data.user.id;
 const logged=await web.auth.signInWithPassword({email,password});if(logged.error)throw logged.error;const webToken=logged.data.session!.access_token;
 const metadata=await(await fetch(base+'/.well-known/oauth-protected-resource/mcp')).json();assert.equal(metadata.resource,resource);
 const discovery=await(await fetch(auth+'/.well-known/oauth-authorization-server')).json();assert.ok(discovery.code_challenge_methods_supported.includes('S256'));
 const callback=origin+'/test-oauth-callback',registered=await post(auth+'/oauth/clients/register',{client_name:`AraRead gate MCP ${randomUUID()}`,redirect_uris:[callback],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'});assert.equal(registered.status,201);clientId=registered.data.client_id;
 async function authorize(){
  const verifier=randomBytes(40).toString('base64url'),state=randomUUID(),url=new URL(auth+'/oauth/authorize');for(const [name,value]of Object.entries({client_id:clientId,redirect_uri:callback,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state,scope:'openid email profile',resource}))url.searchParams.set(name,value);
  const redirected=await fetch(url,{headers:{apikey:key},redirect:'manual'});assert.equal(redirected.status,302);const location=new URL(redirected.headers.get('location')!);assert.equal(location.origin,origin);assert.equal(location.pathname,'/oauth/consent');const id=location.searchParams.get('authorization_id');assert.ok(id);
  const details=await web.auth.oauth.getAuthorizationDetails(id!);if(details.error)throw details.error;assert.ok('authorization_id'in details.data!);
  const approval=await web.auth.oauth.approveAuthorization(id!,{skipBrowserRedirect:true});if(approval.error)throw approval.error;const redirect=new URL(approval.data!.redirect_url);assert.equal(redirect.searchParams.get('state'),state);const code=redirect.searchParams.get('code')!;assert.ok(code);
  const exchange=async(codeVerifier:string)=>fetch(auth+'/oauth/token',{method:'POST',headers:{apikey:key,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,redirect_uri:callback,code_verifier:codeVerifier,resource}),signal:AbortSignal.timeout(20000)});
  assert.equal((await exchange('x'.repeat(43))).status,400);const token=await exchange(verifier);assert.equal(token.status,200);return await token.json();
 }
 const token=await authorize();assert.ok(token.id_token);pass('descoberta, DCR, consentimento sintetico e PKCE reais no provedor');
 const connect=async(mode:'modern'|'legacy')=>{const next=new Client({name:'araread-hosted-gate',version:'1.0.0'},{versionNegotiation:{mode:mode==='modern'?{pin:'2026-07-28'}:'legacy'}});await next.connect(new StreamableHTTPClientTransport(new URL(resource),{requestInit:{headers:{authorization:`Bearer ${token.access_token}`}}}));return next;};
 client=await connect('modern');assert.match(client.getInstructions()||'',/orientação do assistente/);const tools=await client.listTools();assert.equal(tools.tools.length,16);const guidance:any=await client.callTool({name:'assistant_guidance',arguments:{}});assert.equal(guidance.structuredContent.ok,true);pass('SDK oficial descobre 16 ferramentas e orientacao atraves do MCP hospedado');
 const title=`MCP hospedado ${randomUUID()}`,imported:any=await client.callTool({name:'source_import',arguments:{operation_id:randomUUID(),title,text:'A hipótese depende de condições. Uma possibilidade não é uma certeza. العربية 日本語 😀.',partial:true}});assert.equal(imported.structuredContent.ok,true,JSON.stringify(imported.structuredContent));const source=imported.structuredContent.data;
 const context:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});const args={operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref:context.structuredContent.data.ref,rewrite:'A hipótese (ideia a ser examinada) vale sob as condições indicadas; não afirma certeza.',provenance:{agent:'Cliente oficial em gate hospedado',guidance_version:'1.0.0'}};
 const saved:any=await client.callTool({name:'mediation_save',arguments:args});assert.equal(saved.structuredContent.data.status,'confirmed');await client.close();client=await connect('legacy');const resumed:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});assert.equal(resumed.structuredContent.data.mediation.rewrite,args.rewrite);assert.equal(resumed.structuredContent.data.reading.covered.length,0);
 const checked=await post(base+'/api/reading_context',{reading_id:source.reading_id},webToken);assert.equal(checked.data.data.mediation.rewrite,args.rewrite);pass('leitura e escrita reais, nova sessao MCP e conferencia independente pela API da interface');
 if(process.env.ARAREAD_SITE_SERVICE_ACCESS){
  const {verifyHostedUi}=await import('./hosted-ui.ts');ui=await verifyHostedUi({origin,siteAccessToken:process.env.ARAREAD_SITE_SERVICE_ACCESS,email,password,title,rewrite:args.rewrite});
  await client.close();client=await connect('modern');const afterUi:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});assert.equal(afterUi.structuredContent.data.reading.covered.length,1);
  const notes:any=await client.callTool({name:'reading_history',arguments:{reading_id:source.reading_id,kind:'notes'}});assert.ok(notes.structuredContent.data.items.some((n:any)=>n.text==='Pergunta sintética conferida na interface hospedada.'));pass('interface publicada confere mediação MCP e grava nota/continuidade relidas por nova sessao MCP');
 }
 const guidanceResource=await client.readResource({uri:'araread://assistant/guidance'});assert.match((guidanceResource.contents[0] as any).text,/AraRead/);assert.ok((await client.getPrompt({name:'retomar-leitura',arguments:{reading_id:source.reading_id}})).messages.length);
 const denied=await fetch(resource,{method:'POST',headers:{authorization:`Bearer ${webToken}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});assert.equal(denied.status,401);pass('token web nao substitui audiencia e permissao MCP');
 const revoked=await web.auth.oauth.revokeGrant({clientId});if(revoked.error)throw revoked.error;
 await client.close();client=undefined;const blocked=await fetch(resource,{method:'POST',headers:{authorization:`Bearer ${token.access_token}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})});assert.equal(blocked.status,401);assert.ok((await authorize()).access_token);pass('revogacao imediata e nova autorizacao real');
}finally{
 await client?.close().catch(()=>{});if(clientId){const removed=await admin.auth.admin.oauth.deleteClient(clientId);if(removed.error)throw removed.error;}if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error)throw removed.error;}
 await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/hosted-mcp.json',JSON.stringify({client:'SDK oficial MCP sobre HTTPS hospedado, fora do processo servidor',checked_at:new Date().toISOString(),passed,published_ui:ui,synthetic_identity_removed:!!userId,synthetic_oauth_client_removed:!!clientId,does_not_validate:['ChatGPT']},null,2));
}
