import pg from 'pg';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const connection=process.env.MIGRATION_DATABASE_URL || (process.env.APP_MODE==='local'?'postgres://postgres:araread-local-admin-only@127.0.0.1:56432/araread':'');
if(!connection)throw new Error('Configure MIGRATION_DATABASE_URL. O padrão só existe em APP_MODE=local.');
const url=new URL(connection);
if(!['localhost','127.0.0.1'].includes(url.hostname)&&process.env.CONFIRMED_PROJECT_HOST!==url.hostname)throw new Error('Confirme o host exclusivo do AraRead em CONFIRMED_PROJECT_HOST antes de escrever remotamente.');
if(process.env.APP_MODE==='local'){
 let ready=false;for(let attempt=0;attempt<30;attempt++){try{ready=(await fetch('http://127.0.0.1:4318/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));}
 if(!ready)throw new Error('Auth local ainda indisponível. Inicie docker compose up -d --wait e repita.');
}
const db=new pg.Client({connectionString:connection}); await db.connect();
try {
 await db.query('create schema if not exists araread_private');
 await db.query('create table if not exists araread_private.migrations (name text primary key,sha256 text not null,applied_at timestamptz default now())');
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()){
  const sql=await readFile(`supabase/migrations/${file}`,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const prior=(await db.query('select sha256 from araread_private.migrations where name=$1',[file])).rows[0];
  if(prior){if(prior.sha256!==hash)throw new Error(`Migration já aplicada foi alterada: ${file}`);continue;}
  await db.query('begin');try{await db.query(sql);await db.query('insert into araread_private.migrations(name,sha256) values($1,$2)',[file,hash]);await db.query('commit');console.log(`Aplicada: ${file}`);}catch(e){await db.query('rollback');throw e;}
 }
}finally{await db.end();}
