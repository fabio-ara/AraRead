// Adaptador HTTP padrão Web para o runtime hospedado. O domínio e a autorização
// são os mesmos usados pelo processo Node; esta camada não implementa casos de uso.
import type {AuthInfo} from '@modelcontextprotocol/server';
import {config} from './config.ts';
import {authenticate} from './auth.ts';
import {execute} from './service.ts';
import {schemas,type ToolName} from './contracts.ts';
import {AppError,ensure} from './errors.ts';
import {mcpHandler} from './mcp.ts';
import {pool,transaction,type Identity} from './db.ts';

const windows=new Map<string,{count:number;until:number}>();
async function active(identity:Identity){await transaction(identity,async c=>ensure((await c.query('select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).rows[0].active,'SESSION_REVOKED','Sessão revogada.',401));}
async function jsonBody(request:Request,max:number){
 ensure(Number(request.headers.get('content-length')||0)<=max,'TOO_LARGE','Operação excede o limite de bytes.',413);
 ensure(request.headers.get('content-type')?.split(';')[0]==='application/json','INVALID_JSON','Envie um objeto JSON.',400);
 const reader=request.body?.getReader();ensure(reader,'INVALID_JSON','Envie um objeto JSON.',400);
 let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{for(;;){const part=await reader!.read();if(part.done)break;bytes+=part.value.byteLength;ensure(bytes<=max,'TOO_LARGE','Operação excede o limite de bytes.',413);text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
 catch(e){await reader!.cancel().catch(()=>{});if(e instanceof AppError)throw e;throw new AppError('INVALID_JSON','Envie um objeto JSON válido.',400);}
 finally{reader!.releaseLock();}
}
export async function edgeFetch(request:Request):Promise<Response>{
 const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Origin'});
 const json=(body:unknown,status=200)=>{headers.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(body),{status,headers});};
 try{
  ensure(!config.local&&config.origin.startsWith('https://')&&config.authUrl.startsWith('https://'),'CONFIG','O runtime hospedado exige configuração HTTPS explícita.',503);
  const origin=request.headers.get('origin');ensure(!origin||origin===config.origin,'INVALID_ORIGIN','Origem não autorizada.',403);
  if(origin){headers.set('access-control-allow-origin',origin);headers.set('access-control-allow-methods','GET, POST, DELETE, OPTIONS');headers.set('access-control-allow-headers','authorization, content-type, mcp-protocol-version, mcp-session-id');headers.set('access-control-expose-headers','WWW-Authenticate, mcp-session-id, mcp-protocol-version');}
  const url=new URL(request.url),base=new URL(config.mcpAudience).pathname.replace(/\/mcp$/,'');
  // O gateway usa o prefixo público completo; o runtime local pode retirar /functions/v1.
  const prefix=url.pathname.startsWith(base)?base:base.replace(/^\/functions\/v1/,'');
  ensure(url.pathname===prefix||url.pathname.startsWith(prefix+'/'),'NOT_FOUND','Rota não encontrada.',404);
  const path=url.pathname.slice(prefix.length)||'/';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(path==='/health'&&request.method==='GET'){await pool.query('select 1');return json({status:'ok',version:config.version});}
  if(path==='/api/config'&&request.method==='GET')return json({name:config.name,version:config.version,local:false,supabase_url:new URL(config.authUrl).origin,publishable_key:process.env.AUTH_PUBLISHABLE_KEY,mcp_url:config.mcpAudience});
  if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)&&request.method==='GET')return json({resource:config.mcpAudience,authorization_servers:[config.issuer],scopes_supported:['email'],bearer_methods_supported:['header']});
  const identity=await authenticate(request.headers.get('authorization')||undefined,path==='/mcp');
  const now=Date.now(),window=windows.get(identity.id);if(!window||window.until<now)windows.set(identity.id,{count:1,until:now+60000});else ensure(++window.count<=240,'RATE_LIMIT','Muitas operações. Aguarde um minuto.',429);
  if(windows.size>10000)for(const [key,value]of windows)if(value.until<now)windows.delete(key);
  if(path==='/mcp'){
   await active(identity);const response=await mcpHandler.fetch(request,{authInfo:{token:'',clientId:identity.client_id!,scopes:['email'],identity} as AuthInfo&{identity:Identity}});
   for(const [key,value]of headers)response.headers.set(key,value);return response;
  }
  if(path.startsWith('/api/original/')&&request.method==='GET'){
   await active(identity);const id=path.slice('/api/original/'.length);ensure(/^[a-f0-9-]{36}$/i.test(id),'INVALID_REFERENCE','Referência inválida.',400);
   const row=await transaction(identity,async c=>(await c.query('select original,sha256 from araread.sources where id=$1',[id])).rows[0]);
   ensure(row,'NOT_FOUND','Original não encontrado.',404);headers.set('content-type','application/octet-stream');headers.set('content-disposition','attachment; filename="original"');headers.set('x-original-sha256',row.sha256);return new Response(new Uint8Array(row.original),{headers});
  }
  const name=path.slice('/api/'.length) as ToolName;ensure(path.startsWith('/api/')&&request.method==='POST'&&Object.hasOwn(schemas,name),'NOT_FOUND','Rota não encontrada.',404);
  await active(identity);const body=await jsonBody(request,name==='data_restore'?32*1024*1024:16*1024*1024);
  return json({ok:true,data:await execute(name,body,identity)});
 }catch(e){
  const error=e instanceof AppError?e:new AppError('INTERNAL','Falha no serviço. Consulte o recibo antes de repetir.',500);
  if(error.status===401||error.status===403)headers.set('www-authenticate',`Bearer resource_metadata="${config.mcpAudience.replace(/\/mcp$/,'')}/.well-known/oauth-protected-resource/mcp", scope="email"`);
  if(error.status>=500)console.error(JSON.stringify({event:'edge_request_failed',code:(e as any)?.code||'INTERNAL'}));
  return json({ok:false,error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}},error.status);
 }
}
