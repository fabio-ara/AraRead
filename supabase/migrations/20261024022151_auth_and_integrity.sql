create or replace function araread_private.session_active(uid uuid,sid uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select uid=araread.owner() and exists(
  select 1 from auth.sessions s where s.id=sid and s.user_id=uid
  and (s.not_after is null or s.not_after>now())
  and (s.oauth_client_id is null or exists(select 1 from auth.oauth_consents g join auth.oauth_clients client on client.id=g.client_id where g.user_id=uid and g.client_id=s.oauth_client_id and g.revoked_at is null and client.deleted_at is null))
 )
$$;
-- O provedor emite tokens OAuth para o único recurso desta instalação. Nunca
-- deriva audiência ou permissão de user_metadata. Configure o resource após deploy.
create table araread_private.deployment (singleton boolean primary key default true check(singleton),mcp_resource text not null);
insert into araread_private.deployment values(true,'http://127.0.0.1:4317/mcp');
revoke all on araread_private.deployment from public,anon,authenticated;
create function araread_private.token_hook(event jsonb) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; resource text; begin
 if coalesce(event->>'client_id',claims->>'client_id','')<>'' then
  select mcp_resource into resource from araread_private.deployment where singleton;
  claims:=jsonb_set(claims,'{aud}',to_jsonb(resource));
  claims:=jsonb_set(claims,'{araread_permission}','"write"'::jsonb);
 end if;
 return jsonb_set(event,'{claims}',claims);
end $$;
revoke all on function araread_private.token_hook(jsonb) from public,anon,authenticated;
grant usage on schema araread_private to supabase_auth_admin;
grant execute on function araread_private.token_hook(jsonb) to supabase_auth_admin;
-- Restauração é transacional e pode inserir versões/perguntas antes dos seus pais.
do $$ declare fk record; begin
 for fk in select conrelid::regclass as tbl,conname from pg_constraint where contype='f' and connamespace='araread'::regnamespace loop
  execute format('alter table %s alter constraint %I deferrable initially immediate',fk.tbl,fk.conname);
 end loop;
end $$;
