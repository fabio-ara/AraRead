import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {config} from '../src/config.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw new Error('Instalação isolada somente local.');
test('banco vazio, schema real do GoTrue, primeira migration e evolução preservando dados',async()=>{
 const admin=new pg.Client({connectionString:'postgres://postgres:araread-local-admin-only@127.0.0.1:56432/araread'});await admin.connect();
 const name=`araread_test_install_${randomUUID().replaceAll('-','')}`;assert.match(name,/^araread_test_install_[a-f0-9]{32}$/);
 let db:pg.Client|undefined;
 try{
  await admin.query(`create database "${name}" template template0`);
  db=new pg.Client({connectionString:`postgres://postgres:araread-local-admin-only@127.0.0.1:56432/${name}`});await db.connect();
  // Schema produzido pelo GoTrue real em execução. Não substitui o teste separado de identidade/OAuth.
  const schema=execFileSync('docker',['compose','exec','-T','db','pg_dump','-U','postgres','-d','araread','--schema=auth','--schema-only','--no-owner','--no-acl'],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}).replace(/^\\(?:un)?restrict .*$/gm,'');
  await db.query(schema);await db.query('create schema araread_private');
  const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
  await db.query(await readFile(`supabase/migrations/${files[0]}`,'utf8'));
  assert.equal((await db.query('select count(*)::int n from araread.works')).rows[0].n,0);
  const owner=randomUUID(),work=randomUUID();await db.query('insert into auth.users(id) values($1)',[owner]);await db.query('insert into araread.works(id,owner_id,title) values($1,$2,$3)',[work,owner,'Fixture SQL de atualização, não uma identidade de login']);
  const source=randomUUID(),element=randomUUID(),reading=randomUUID(),mediation=randomUUID(),ref={source_id:source,element_id:element,start:0,end:10};
  await db.query("insert into araread.sources(id,owner_id,work_id,original_language,partial,origin,sha256,original,mime,filename) values($1,$2,$3,'pt',true,'fixture','fixture',convert_to('Não é fato','UTF8'),'text/plain','fixture.txt')",[source,owner,work]);
  await db.query("insert into araread.elements(id,owner_id,source_id,ordinal,kind,text,locator) values($1,$2,$3,0,'paragraph','Não é fato','§ 1')",[element,owner,source]);
  await db.query("insert into araread.readings(id,owner_id,source_id,revision,opened,resume,covered) values($1,$2,$3,7,$4,$4,$5)",[reading,owner,source,JSON.stringify(ref),JSON.stringify([ref])]);
  await db.query("insert into araread.mediations(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,language,rewrite,additions,provenance) values($1,$2,$3,$4,$5,0,10,'pt-BR','Não é uma certeza.','[]','{}')",[mediation,owner,reading,source,element]);
  for(const file of files.slice(1))await db.query(await readFile(`supabase/migrations/${file}`,'utf8'));
  assert.equal((await db.query('select title from araread.works where id=$1',[work])).rows[0].title,'Fixture SQL de atualização, não uma identidade de login');
  const preserved=(await db.query('select * from araread.readings where id=$1',[reading])).rows[0];assert.equal(preserved.revision,7);assert.deepEqual(preserved.covered,[ref]);assert.deepEqual(preserved.resume,ref);
  assert.equal((await db.query('select source_id from araread.reading_segments where reading_id=$1',[reading])).rows[0].source_id,source);
  const old=(await db.query('select * from araread.mediations where id=$1',[mediation])).rows[0];assert.equal(old.rewrite,'Não é uma certeza.');assert.equal(old.context_id,null);assert.equal(old.context_signature,null);
  const policies=(await db.query("select count(*)::int n from pg_tables where schemaname='araread' and rowsecurity")).rows[0].n;assert.equal(policies,16);
  assert.equal((await db.query("select to_regprocedure('araread_private.token_hook(jsonb)') is not null ok")).rows[0].ok,true);
 }finally{await db?.end();await admin.query(`drop database if exists "${name}"`);await admin.end();}
});
