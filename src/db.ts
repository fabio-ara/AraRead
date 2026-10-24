import pg from 'pg';
import { config } from './config.ts';
export const pool = new pg.Pool({connectionString:config.database,max:8,connectionTimeoutMillis:5000,application_name:'araread'});
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
