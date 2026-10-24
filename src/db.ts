import pg from 'pg';
import { config } from './config.ts';
// Uma CA fornecida explicitamente tem precedência sobre parâmetros de URL;
// pg substitui o objeto ssl quando esses parâmetros permanecem na string.
const databaseUrl=new URL(config.database),ca=process.env.DATABASE_CA_CERT;
if(ca)for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])databaseUrl.searchParams.delete(key);
const edge=process.env.ARAREAD_RUNTIME==='edge';
export const pool = new pg.Pool({connectionString:ca?databaseUrl.href:config.database,ssl:ca?{ca,rejectUnauthorized:true}:undefined,max:edge?1:8,idleTimeoutMillis:edge?1000:10000,connectionTimeoutMillis:5000,application_name:'araread'});
// Falhas em conexão ociosa não podem derrubar o processo nem registrar consultas.
pool.on('error',error=>console.error(JSON.stringify({event:'database_idle_error',code:(error as any)?.code||'CONNECTION'})));
export interface Identity {id:string;session_id:string;client_id?:string;permissions:'read'|'write';}
export async function transaction<T>(identity:Identity,fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();
 try {
  await c.query('begin');
  await c.query('set local role authenticated');
  await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('statement_timeout','12000',true)",[identity.id,JSON.stringify({sub:identity.id,session_id:identity.session_id,client_id:identity.client_id})]);
  const result=await fn(c); await c.query('commit'); return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
