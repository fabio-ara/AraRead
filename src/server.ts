import express from 'express';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { config } from './config.ts';
import { authenticate } from './auth.ts';
import { execute } from './service.ts';
import { schemas,type ToolName } from './contracts.ts';
import { AppError,ensure } from './errors.ts';
import { mcpHandler } from './mcp.ts';
import { transaction,pool } from './db.ts';

export async function createApp(){
 if(config.local){ensure(['127.0.0.1','localhost'].includes(new URL(config.origin).hostname),'CONFIG','Modo local restrito ao loopback.');}
 else {ensure(config.origin.startsWith('https://')&&config.authUrl.startsWith('https://')&&process.env.DATABASE_URL,'CONFIG','Produção exige HTTPS e configuração de banco explícita.');}
 const app=express();app.disable('x-powered-by');
 const windows=new Map<string,{count:number,until:number}>();
 app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});
  // HTML e dados da obra nunca viram código. Vite precisa de scripts inline apenas no desenvolvimento.
  res.set('Content-Security-Policy',`default-src 'self'; script-src 'self' ${process.env.NODE_ENV==='production'?"":"'unsafe-inline'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${config.local&&process.env.NODE_ENV!=='production'?'ws://127.0.0.1:4319':new URL(config.authUrl).origin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  if(req.headers.host!==new URL(config.origin).host)return next(new AppError('INVALID_HOST','Host inválido.',403));
  if(req.headers.origin&&req.headers.origin!==config.origin)return next(new AppError('INVALID_ORIGIN','Origem não autorizada.',403));
  if(req.path.startsWith('/api/')||req.path==='/mcp'){
   const key=req.ip||'local',now=Date.now(),w=windows.get(key);if(!w||w.until<now)windows.set(key,{count:1,until:now+60000});else if(++w.count>240)return next(new AppError('RATE_LIMIT','Muitas operações. Aguarde um minuto.',429));
   if(windows.size>10000)for(const [k,v]of windows)if(v.until<now)windows.delete(k);
  }
  next();
 });
 app.get('/health',async(_req,res)=>{try{await pool.query('select 1');res.json({status:'ok',version:config.version});}catch{res.status(503).json({status:'unavailable'});}});
 app.get('/api/config',(_req,res)=>res.json({name:config.name,version:config.version,local:config.local,supabase_url:config.local?config.origin:new URL(config.authUrl).origin,publishable_key:process.env.AUTH_PUBLISHABLE_KEY||'local-publishable-placeholder',mcp_url:config.mcpAudience}));
 const metadata=()=>({resource:config.mcpAudience,authorization_servers:[config.issuer],scopes_supported:['email'],bearer_methods_supported:['header']});
 app.get(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'],(_req,res)=>res.json(metadata()));
 app.get('/.well-known/oauth-authorization-server/auth/v1',async(_req,res)=>{
  const response=await fetch(`${config.authUrl}/.well-known/oauth-authorization-server`,{signal:AbortSignal.timeout(5000)});res.status(response.status).type('json').send(await response.text());
 });
 app.use('/auth/v1',express.raw({type:()=>true,limit:'24kb'}),async(req,res)=>{
  const path=req.originalUrl.slice('/auth/v1'.length);ensure(!path.startsWith('/admin'),'FORBIDDEN','Administração de identidade não é exposta pelo aplicativo.',403);
  const headers:Record<string,string>={};for(const key of ['authorization','content-type','apikey','x-client-info','x-supabase-api-version'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key] as string;
  const response=await fetch(`${config.authUrl}${path}`,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body,redirect:'manual',signal:AbortSignal.timeout(10000)});
  for(const key of ['content-type','location','retry-after']){const v=response.headers.get(key);if(v)res.set(key,v);}
  res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
 });
 // Recuperação pode conter os originais de toda a cota, codificados em Base64.
 // Exige identidade e sessão ativa antes de ler um corpo maior que o MCP comum.
 app.post('/api/data_restore',async(req,res,next)=>{try{const identity=await authenticate(req.headers.authorization);await transaction(identity,async c=>ensure((await c.query('select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).rows[0].active,'SESSION_REVOKED','Sessão revogada.',401));res.locals.identity=identity;next();}catch(e){next(e);}},express.json({limit:'128mb'}),async(req,res)=>{res.json({ok:true,data:await execute('data_restore',req.body,res.locals.identity)});});
 app.use(express.json({limit:'16mb'}));
 app.post('/api/:tool',async(req,res)=>{
  const name=req.params.tool as ToolName;ensure(Object.hasOwn(schemas,name),'TOOL_NOT_FOUND','Operação inexistente.',404);
  const identity=await authenticate(req.headers.authorization);
  res.json({ok:true,data:await execute(name,req.body,identity)});
 });
 app.get('/api/original/:id',async(req,res)=>{
  const identity=await authenticate(req.headers.authorization);
  const row=await transaction(identity,async c=>{ensure((await c.query('select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).rows[0].active,'SESSION_REVOKED','Sessão revogada.',401);return (await c.query('select original,mime,filename,sha256 from araread.sources where id=$1',[req.params.id])).rows[0];});
  ensure(row,'NOT_FOUND','Original não encontrado.',404);
  // Servido como bytes sem executar HTML/SVG. A automação obtém pela API, nunca por download na UI.
  res.set({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="original"`,'X-Original-SHA256':row.sha256}).send(row.original);
 });
 const nodeMcp=toNodeHandler(mcpHandler,{maxRequestBodySize:16*1024*1024});
 app.all('/mcp',async(req,res)=>{
  try{
   const identity=await authenticate(req.headers.authorization,true);
   await transaction(identity,async c=>ensure((await c.query('select araread_private.session_active($1,$2) as active',[identity.id,identity.session_id])).rows[0].active,'SESSION_REVOKED','Sessão revogada.',401));
   (req as any).auth={token:'',clientId:identity.client_id!,scopes:['email'],identity};
   await nodeMcp(req,res,req.body);
  }catch(e){if(e instanceof AppError&&(e.status===401||e.status===403))res.set('WWW-Authenticate',`Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource", scope="email"`);throw e;}
 });
 if(process.env.NODE_ENV==='production'){
  app.use(express.static(resolve('dist'),{setHeaders:r=>r.setHeader('Cache-Control','no-cache')}));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
 }else{
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,hmr:{port:4319}},appType:'spa'});app.use(vite.middlewares);
 }
 app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const error=err instanceof AppError?err:err?.type==='entity.parse.failed'?new AppError('INVALID_JSON','Envie um objeto JSON válido.',400):new AppError(err?.type==='entity.too.large'?'TOO_LARGE':'INTERNAL',err?.type==='entity.too.large'?'Arquivo ou operação excessiva.':'Falha no serviço. Consulte o recibo antes de repetir.',err?.type==='entity.too.large'?413:500);
  if(error.status>=500)console.error(JSON.stringify({event:'request_failed',code:err?.code||'INTERNAL'}));
  res.status(error.status).json({ok:false,error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}});
 });
 return app;
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const app=await createApp();app.listen(config.port,config.local?'127.0.0.1':'0.0.0.0',()=>console.log(`${config.name} ${config.origin}`));}
