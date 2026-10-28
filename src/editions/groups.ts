import {randomUUID,randomBytes,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Identity} from '../db.ts';
import {ensure} from '../errors.ts';
const one=async(c:PoolClient,sql:string,args:unknown[]=[]) => (await c.query(sql,args)).rows[0];
export async function dispatchGroups(name:string,a:any,c:PoolClient,identity:Identity){
 const uid=identity.id;
 if(name==='edition_groups'){
  const items=(await c.query('select id,version_id,title,revision,owner_id=$3 as managed_by_me from araread.edition_groups where ($1::uuid is null or version_id=$1) and ($2::uuid is null or id=$2) order by created_at desc',[a.version_id||null,a.group_id||null,uid])).rows;
  const comments=a.group_id?(await c.query('select id,passage_id,text,created_at,owner_id=$2 as mine from araread.edition_comments where group_id=$1 order by created_at limit 200',[a.group_id,uid])).rows:[];
  const members=a.group_id?(await c.query('select member_id,joined_at,member_id=$2 as me from araread.edition_members where group_id=$1',[a.group_id,uid])).rows:[];
  return {items,comments,members,private_notes_included:false};
 }
 if(a.action==='create'){
  ensure(a.expected_revision===0&&a.title.trim(),'INVALID_GROUP','Informe um título para o novo grupo.');
  const v=await one(c,"select id from araread.edition_versions where id=$1 and owner_id=$2 and visibility in ('invited','public') and state in ('shared','published','replaced')",[a.version_id,uid]);ensure(v,'NOT_FOUND','Crie um grupo em uma edição própria autorizada para compartilhamento.',404);
  const id=randomUUID();await c.query('insert into araread.edition_groups(id,owner_id,version_id,title) values($1,$2,$3,$4)',[id,uid,v.id,a.title]);return {group_id:id,revision:0};
 }
 if(a.action==='join'){
  ensure(a.expected_revision===0&&a.invite_code,'INVALID_INVITE','Uma nova participação usa revisão zero e o convite recebido.');const digest=createHash('sha256').update(a.invite_code).digest('hex');
  await c.query("select set_config('araread.invite_hash',$1,true)",[digest]);
  const candidate=await one(c,'select group_id from araread.edition_invites where token_hash=$1',[digest]);ensure(candidate,'INVALID_INVITE','Convite indisponível.',404);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,1))',[candidate.group_id]);
  const invite=await one(c,'select * from araread.edition_invites where token_hash=$1 and not revoked and expires_at>now() for update',[digest]);
  ensure(invite&&!invite.claimed_by,'INVALID_INVITE','Convite indisponível, já utilizado ou expirado.',404);
  ensure(invite.owner_id!==uid,'INVALID_INVITE','A pessoa proprietária já participa do grupo.');
  await c.query('update araread.edition_invites set claimed_by=$2 where id=$1',[invite.id,uid]);
  await c.query('insert into araread.edition_members(group_id,owner_id,version_id,member_id,invite_id) values($1,$2,$3,$4,$5)',[invite.group_id,invite.owner_id,invite.version_id,uid,invite.id]);
  ensure(await one(c,"select id from araread.edition_versions where id=$1 and state in ('shared','published','replaced') and visibility in ('invited','public')",[invite.version_id]),'INVALID_INVITE','A edição não está mais disponível para este convite.',404);
  const group=await one(c,'update araread.edition_groups set revision=revision+1 where id=$1 returning revision',[invite.group_id]);
  return {group_id:invite.group_id,version_id:invite.version_id,joined:true,revision:group.revision};
 }
 ensure(a.group_id,'NOT_FOUND','Escolha um grupo.',404);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,1))',[a.group_id]);
 const group=await one(c,'select * from araread.edition_groups where id=$1',[a.group_id]);ensure(group,'NOT_FOUND','Grupo não disponível.',404);
 ensure(group.revision===a.expected_revision,'CONFLICT','O grupo mudou. Recarregue antes de enviar.',409);
 let result:any={};
 if(a.action==='invite'){
  ensure(group.owner_id===uid,'FORBIDDEN','Somente quem administra o grupo pode convidar.',403);
  const invite=randomBytes(24).toString('base64url'),expires=new Date(Date.now()+7*86400000).toISOString();
  await c.query('insert into araread.edition_invites(id,owner_id,group_id,version_id,token_hash,expires_at) values($1,$2,$3,$4,$5,$6)',[randomUUID(),uid,group.id,group.version_id,createHash('sha256').update(invite).digest('hex'),expires]);result={invite_code:invite,expires_at:expires,uses:1};
 }else if(a.action==='comment'){
  const v=await one(c,'select manifest from araread.edition_versions where id=$1',[group.version_id]);ensure(v?.manifest.includes(a.passage_id)&&a.text.trim(),'INVALID_COMMENT','Escolha uma passagem da edição e escreva o comentário.');
  const id=randomUUID();await c.query('insert into araread.edition_comments(id,owner_id,group_id,passage_id,text) values($1,$2,$3,$4,$5)',[id,uid,group.id,a.passage_id,a.text]);result={comment_id:id};
 }else if(a.action==='remove_comment'){
  const removed=await c.query('delete from araread.edition_comments where id=$1 and group_id=$2 and owner_id=$3 returning id',[a.comment_id,group.id,uid]);ensure(removed.rowCount,'NOT_FOUND','Comentário próprio não encontrado.',404);result={deleted:true};
 }else if(a.action==='leave'||a.action==='revoke'){
  ensure(a.action==='leave'?group.owner_id!==uid:group.owner_id===uid,'FORBIDDEN','Operação não permitida para esta participação.',403);
  const member=a.action==='leave'?uid:a.member_id;ensure(member,'INVALID_MEMBER','Escolha a participação a revogar.');
  await c.query('update araread.edition_groups set revision=revision+1 where id=$1',[group.id]);
  const removed=await c.query('delete from araread.edition_members where group_id=$1 and member_id=$2 returning invite_id',[group.id,member]);ensure(removed.rowCount,'NOT_FOUND','Participação não encontrada.',404);
  if(a.action==='revoke')await c.query('update araread.edition_invites set revoked=true where id=$1',[removed.rows[0].invite_id]);
  return {group_id:group.id,revision:group.revision+1,left:a.action==='leave',revoked:a.action==='revoke'};
 }else ensure(false,'INVALID_ACTION','Ação de grupo desconhecida.');
 await c.query('update araread.edition_groups set revision=revision+1 where id=$1',[group.id]);return {group_id:group.id,revision:group.revision+1,...result};
}
