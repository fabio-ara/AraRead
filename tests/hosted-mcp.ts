import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {schemas} from '../src/contracts.ts';
import {editorialReview} from './e2e/support.ts';
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
  const redirected=await fetch(url,{headers:{apikey:key},redirect:'manual'});assert.equal(redirected.status,302);const location=new URL(redirected.headers.get('location')!);assert.equal(location.origin,origin);assert.equal(location.pathname,new URL(process.env.HOSTED_FRONTEND_URL!).pathname);const id=location.searchParams.get('authorization_id');assert.ok(id);
  const details=await web.auth.oauth.getAuthorizationDetails(id!);if(details.error)throw details.error;assert.ok('authorization_id'in details.data!);
  const approval=await web.auth.oauth.approveAuthorization(id!,{skipBrowserRedirect:true});if(approval.error)throw approval.error;const redirect=new URL(approval.data!.redirect_url);assert.equal(redirect.searchParams.get('state'),state);const code=redirect.searchParams.get('code')!;assert.ok(code);
  const exchange=async(codeVerifier:string)=>fetch(auth+'/oauth/token',{method:'POST',headers:{apikey:key,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,redirect_uri:callback,code_verifier:codeVerifier,resource}),signal:AbortSignal.timeout(20000)});
  assert.equal((await exchange('x'.repeat(43))).status,400);const token=await exchange(verifier);assert.equal(token.status,200);return await token.json();
 }
 const token=await authorize();assert.ok(token.id_token);pass('descoberta, DCR, consentimento sintetico e PKCE reais no provedor');
 const connect=async(mode:'modern'|'legacy')=>{const next=new Client({name:'araread-hosted-gate',version:'1.0.0'},{versionNegotiation:{mode:mode==='modern'?{pin:'2026-07-28'}:'legacy'}});await next.connect(new StreamableHTTPClientTransport(new URL(resource),{requestInit:{headers:{authorization:`Bearer ${token.access_token}`}}}));return next;};
 client=await connect('modern');assert.match(client.getInstructions()||'',/orientação do assistente/);const tools=await client.listTools();assert.equal(tools.tools.length,Object.keys(schemas).length);const guidance:any=await client.callTool({name:'assistant_guidance',arguments:{}});assert.equal(guidance.structuredContent.ok,true);pass('SDK oficial descobre contratos 0.4 e orientacao atraves do MCP hospedado');
 const title=`MCP hospedado ${randomUUID()}`,imported:any=await client.callTool({name:'source_import',arguments:{operation_id:randomUUID(),title,text:'A hipótese depende de condições. Uma possibilidade não é uma certeza. العربية 日本語 😀.',partial:true,original_language:'pt-BR'}});assert.equal(imported.structuredContent.ok,true,JSON.stringify(imported.structuredContent));const source=imported.structuredContent.data;
 const context:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});const args={operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref:context.structuredContent.data.ref,rewrite:'A hipótese (ideia a ser examinada) vale sob as condições indicadas; não afirma certeza.',provenance:{agent:'Cliente oficial em gate hospedado',guidance_version:'1.2.0'}};
 const saved:any=await client.callTool({name:'mediation_save',arguments:args});assert.equal(saved.structuredContent.data.status,'confirmed');await client.close();client=await connect('legacy');const resumed:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});assert.equal(resumed.structuredContent.data.mediation.rewrite,args.rewrite);assert.equal(resumed.structuredContent.data.reading.covered.length,0);
 const checked=await post(base+'/api/reading_context',{reading_id:source.reading_id},webToken);assert.equal(checked.data.data.mediation.rewrite,args.rewrite);pass('leitura e escrita reais, nova sessao MCP e conferencia independente pela API da interface');
 const displayPreparation:any=await client.callTool({name:'context_prepare',arguments:{operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:1,ref:args.ref}});
 const displaySaved:any=await client.callTool({name:'mediation_save',arguments:{...args,operation_id:randomUUID(),expected_revision:displayPreparation.structuredContent.data.revision,context_id:displayPreparation.structuredContent.data.context_id,regenerate:true,editorial_review:editorialReview}});assert.equal(displaySaved.structuredContent.ok,true);
 const displayed:any=await client.callTool({name:'reading_display',arguments:{reading_id:source.reading_id}});assert.equal(displayed.structuredContent.data.ready,true);assert.equal(displayed.structuredContent.data.representations.translation.status,'same_language');
 if(process.env.HOSTED_UI==='true'){
  const {verifyHostedUi}=await import('./hosted-ui.ts');ui=await verifyHostedUi({url:process.env.HOSTED_FRONTEND_URL!,email,password,title,rewrite:args.rewrite});
  await client.close();client=await connect('modern');const afterUi:any=await client.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});assert.equal(afterUi.structuredContent.data.reading.covered.length,0);const highlights:any=await client.callTool({name:'highlight_list',arguments:{reading_id:source.reading_id}});assert.equal(highlights.structuredContent.data.items.length,1);pass('Pages apresenta três abas, salva grifo relido pelo MCP, calcula e retoma offline sem avanço');
 }
 const invoke=async(name:string,args:any={})=>{const out:any=await client!.callTool({name,arguments:args});assert.equal(out.structuredContent?.ok,true,JSON.stringify(out.structuredContent?.error));return out.structuredContent.data;};
 const current=()=>invoke('reading_context',{reading_id:source.reading_id});
 const write=async(name:string,args:any={})=>invoke(name,{operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:(await current()).reading.revision,...args});
 const reference=await write('reference_save',{title:'Livro sintético de apoio',kind:'book',locator:'§ 1',excerpt:'Possibilidade não é certeza.',access:'available',consulted_at:'2026-10-24'});
 const perspective=await write('perspective_save',{name:'Abordagem sintética delimitada',kind:'approach',scope:'Somente a condição da passagem',evidence_ids:[reference.reference_id]});
 const beforeStudy=await current(),prepared=await write('context_prepare',{ref:beforeStudy.ref,selection:{perspective_id:perspective.perspective_id,support_mode:'brief'}});
 await write('mediation_save',{ref:beforeStudy.ref,context_id:prepared.context_id,rewrite:'Leitura sintética delimitada: a condição não é uma certeza.',evidence_ids:[reference.reference_id],provenance:{agent:'Gate hospedado sintético',guidance_version:'1.2.0'}});
 await write('term_save',{ref:beforeStudy.ref,term:'possibilidade',definition:'Algo que pode acontecer, sem afirmar que acontecerá.',origin:'assistant',details:{memory_aid:'Lembre do verbo poder.',evidence_ids:[reference.reference_id]}});
 assert.equal((await invoke('lexicon_lookup',{reading_id:source.reading_id,term:'possibilidade'})).saved.length,1);
 await write('source_append',{text:'Envio seguinte sintético, ainda não percorrido.',partial:true});assert.deepEqual((await current()).reading.covered,beforeStudy.reading.covered);
 assert.equal((await invoke('source_elements',{reading_id:source.reading_id})).items.length,2);
 const outline=await invoke('reading_outline',{reading_id:source.reading_id}),mainRef=(await current()).reading.resume;
 await write('reading_map_save',{items:[{title:'Condição e limite',ref:outline.items[0].ref,level:1,nature:'organizational_interpretation'}],provenance:{agent:'Gate sintético',limits:'Título organizacional, não título do autor.'}});
 await write('reading_seek',{ref:outline.items[1].ref});await write('reading_move',{action:'continue',ref:outline.items[1].ref});assert.deepEqual((await current()).reading.resume,mainRef);await write('reading_move',{action:'resume'});
 assert.ok((await invoke('reading_progress',{reading_id:source.reading_id})).characters.covered>0);assert.equal((await invoke('preferences_catalog')).version,'1');
 await write('preferences_set',{values:{support_mode:'extended'}});assert.equal((await invoke('preferences_get',{reading_id:source.reading_id})).values.support_mode,'extended');await write('preferences_unset',{keys:['support_mode'],action:'delete'});
 const accountWrite=async(name:string,args:any)=>invoke(name,{operation_id:randomUUID(),expected_revision:(await invoke('preferences_get')).revision,...args});
 const lens=randomUUID(),profile=await accountWrite('profile_save',{name:'Perfil sintético hospedado',explicit_request:true,declared_author:'Gate sintético',usage_terms:'MIT para esta fixture',definition:{values:{support_mode:'brief'},lenses:[{id:lens,name:'Hipótese didática',nature:'ai_application',scope:'Exemplo sintético',period:'',limits:'Não atribuído a autor real',sources:[]}],conflicts:[],compatibility:'not_assessed',limits:'Não infere identidade do leitor'}});
 await accountWrite('preferences_set',{values:{active_profile:profile.profile_id},explicit_request:true});assert.equal((await invoke('preferences_get',{reading_id:source.reading_id})).profile.id,profile.profile_id);
 const bundle=(await invoke('profile_export',{profile_id:profile.profile_id,lens_ids:[lens],declared_author:'Gate sintético',usage_terms:'MIT',reviewed_for_sharing:true})).bundle;
 const copy=await accountWrite('profile_import',{bundle,explicit_request:true});assert.equal(copy.active,false);await accountWrite('profile_manage',{profile_id:profile.profile_id,action:'delete'});await accountWrite('profile_manage',{profile_id:copy.profile_id,action:'delete'});
 pass('mapa, progresso, navegação fora de sequência, preferências e pacote privado de perfil no MCP hospedado');
 const widget=await client.readResource({uri:'ui://araread/reader-v4.html'});assert.equal((widget.contents[0] as any).mimeType,'text/html;profile=mcp-app');assert.match((widget.contents[0] as any).text,/ui\/initialize/);
 pass('perspectiva, livro sem URL, contexto/variante, vocabulário salvo, envio na mesma leitura e recurso MCP Apps no runtime hospedado');
 const guidanceResource=await client.readResource({uri:'araread://assistant/guidance'});assert.match((guidanceResource.contents[0] as any).text,/AraRead/);assert.ok((await client.getPrompt({name:'retomar-leitura',arguments:{reading_id:source.reading_id}})).messages.length);
 const denied=await fetch(resource,{method:'POST',headers:{authorization:`Bearer ${webToken}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});assert.equal(denied.status,401);pass('token web nao substitui audiencia e permissao MCP');
 const revoked=await web.auth.oauth.revokeGrant({clientId});if(revoked.error)throw revoked.error;
 await client.close();client=undefined;const blocked=await fetch(resource,{method:'POST',headers:{authorization:`Bearer ${token.access_token}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})});assert.equal(blocked.status,401);assert.ok((await authorize()).access_token);pass('revogacao imediata e nova autorizacao real');
}finally{
 await client?.close().catch(()=>{});if(clientId){const removed=await admin.auth.admin.oauth.deleteClient(clientId);if(removed.error)throw removed.error;}if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error)throw removed.error;}
 await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/hosted-mcp.json',JSON.stringify({client:'SDK oficial MCP sobre HTTPS hospedado, fora do processo servidor',checked_at:new Date().toISOString(),passed,published_ui:ui,synthetic_identity_removed:!!userId,synthetic_oauth_client_removed:!!clientId,does_not_validate:['ChatGPT']},null,2));
}

