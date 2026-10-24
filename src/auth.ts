import { createRemoteJWKSet,jwtVerify } from 'jose';
import { config } from './config.ts';
import { AppError,ensure } from './errors.ts';
import { z } from 'zod';
import type { Identity } from './db.ts';
const jwks=createRemoteJWKSet(new URL(`${config.authUrl}/.well-known/jwks.json`));
export async function authenticate(header:string|undefined,mcp=false):Promise<Identity>{
 ensure(header?.startsWith('Bearer '),'UNAUTHENTICATED','Entre na conta para acessar a biblioteca.',401);
 const token=header!.slice(7);ensure(token.length<12000,'UNAUTHENTICATED','Token inválido.',401);
 try {
  const options={issuer:config.issuer,audience:mcp?config.mcpAudience:config.audience,algorithms:['ES256','RS256']};
  const {payload}=await jwtVerify(token,jwks,options);
  ensure(z.uuid().safeParse(payload.sub).success&&z.uuid().safeParse(payload.session_id).success&&payload.role==='authenticated','UNAUTHENTICATED','Identidade inválida.',401);
  if(mcp)ensure(z.uuid().safeParse(payload.client_id).success&&['read','write'].includes(String(payload.araread_permission)),'FORBIDDEN','Autorize este cliente para o recurso AraRead.',403);
  return {id:payload.sub!,session_id:payload.session_id as string,client_id:payload.client_id as string|undefined,permissions:payload.araread_permission==='read'?'read':'write'};
 }catch(e){if(e instanceof AppError)throw e;throw new AppError('UNAUTHENTICATED','Sessão inválida ou expirada. Entre novamente.',401);}
}
