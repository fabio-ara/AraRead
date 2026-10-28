-- Edições compartilhadas não abrem as tabelas da biblioteca pessoal.
create table araread.edition_projects (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null, author text not null default '', topics jsonb not null default '[]', traditions jsonb not null default '[]',
 rights jsonb not null, synthetic boolean not null default false, revision integer not null default 0,
 source_ids uuid[] not null default '{}', manifest uuid[] not null default '{}', profile_id uuid,
 sample jsonb, stage text not null default 'sources' check(stage in ('sources','configuration','sample','production')),
 created_at timestamptz not null default now(), unique(id,owner_id)
);
create table araread.edition_sources (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 metadata jsonb not null,blocks jsonb not null,canonical_sha256 text not null,original bytea,
 created_at timestamptz not null default now(),unique(id,owner_id)
);
create table araread.edition_passages (
 id uuid primary key,owner_id uuid not null,project_id uuid not null,key uuid not null,revision integer not null,
 content jsonb not null,assessment jsonb not null,sha256 text not null,created_at timestamptz not null default now(),
 unique(project_id,key,revision),unique(id,project_id,owner_id),
 foreign key(project_id,owner_id) references araread.edition_projects(id,owner_id) on delete cascade
);
create table araread.edition_reviews (
 id uuid primary key,owner_id uuid not null,project_id uuid not null,passage_id uuid not null,
 decision text not null check(decision in ('accepted','needs_changes')),note text not null,
 reviewer_kind text not null check(reviewer_kind in ('assistant','author_action','synthetic_fixture')),
 created_at timestamptz not null default now(),
 foreign key(passage_id,project_id,owner_id) references araread.edition_passages(id,project_id,owner_id) on delete cascade
);
create table araread.edition_versions (
 id uuid primary key,owner_id uuid not null,project_id uuid not null,version integer not null,
 title text not null,author text not null,topics jsonb not null,traditions jsonb not null,rights jsonb not null,
 config jsonb not null,source_ids uuid[] not null,manifest uuid[] not null,sha256 text not null,review jsonb not null,
 visibility text not null check(visibility in ('private','invited','public')),
 state text not null check(state in ('approved','shared','published','replaced','withdrawn')),
 revision integer not null default 0,created_at timestamptz not null default now(),
 unique(project_id,version),unique(id,owner_id),
 foreign key(project_id,owner_id) references araread.edition_projects(id,owner_id) on delete cascade
);
create table araread.edition_settings (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check(scope in ('account','profile','project','session','reader')),scope_id uuid not null,
 revision integer not null default 0,values jsonb not null,history jsonb not null default '[]',
 unique(owner_id,scope,scope_id)
);
create table araread.edition_readers (
 owner_id uuid not null references auth.users(id) on delete cascade,version_id uuid not null references araread.edition_versions(id) on delete cascade,
 revision integer not null default 0,opened uuid,resume uuid,covered uuid[] not null default '{}',
 primary key(owner_id,version_id)
);
create table araread.edition_annotations (
 id uuid primary key,owner_id uuid not null,version_id uuid not null,passage_id uuid not null references araread.edition_passages(id),
 kind text not null check(kind in ('note','highlight','answer','request')),target jsonb,text text not null,activity_id uuid,response jsonb,
 created_at timestamptz not null default now(),foreign key(owner_id,version_id) references araread.edition_readers(owner_id,version_id) on delete cascade
);
create table araread.edition_groups (
 id uuid primary key,owner_id uuid not null,version_id uuid not null,title text not null,revision integer not null default 0,
 created_at timestamptz not null default now(),unique(id,owner_id,version_id),
 foreign key(version_id,owner_id) references araread.edition_versions(id,owner_id) on delete cascade
);
create table araread.edition_invites (
 id uuid primary key,owner_id uuid not null,group_id uuid not null,version_id uuid not null,
 token_hash text not null unique,expires_at timestamptz not null,claimed_by uuid references auth.users(id),revoked boolean not null default false,
 foreign key(group_id,owner_id,version_id) references araread.edition_groups(id,owner_id,version_id) on delete cascade
);
create table araread.edition_members (
 group_id uuid not null,owner_id uuid not null,version_id uuid not null,member_id uuid not null references auth.users(id) on delete cascade,
 invite_id uuid not null references araread.edition_invites(id),joined_at timestamptz not null default now(),
 primary key(group_id,member_id),
 foreign key(group_id,owner_id,version_id) references araread.edition_groups(id,owner_id,version_id) on delete cascade
);
create table araread.edition_comments (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,group_id uuid not null references araread.edition_groups(id) on delete cascade,
 passage_id uuid not null references araread.edition_passages(id),text text not null,created_at timestamptz not null default now()
);

do $$ declare t text; begin
 foreach t in array array['edition_projects','edition_sources','edition_passages','edition_reviews','edition_versions','edition_settings','edition_readers','edition_annotations','edition_groups','edition_invites','edition_members','edition_comments'] loop
  execute format('alter table araread.%I enable row level security',t);
  execute format('alter table araread.%I force row level security',t);
  execute format('create index on araread.%I(owner_id)',t);
 end loop;
 foreach t in array array['edition_projects','edition_settings','edition_readers','edition_annotations'] loop
  execute format('create policy private_owner on araread.%I for all to authenticated using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()))',t);
 end loop;
end $$;

grant usage on schema araread to anon;
grant execute on function araread.owner() to anon;
grant select on araread.edition_versions,araread.edition_sources,araread.edition_passages to anon;
grant select,insert on araread.edition_projects,araread.edition_sources,araread.edition_passages,araread.edition_reviews,araread.edition_versions,araread.edition_settings,araread.edition_readers,araread.edition_annotations,araread.edition_groups,araread.edition_invites,araread.edition_members,araread.edition_comments to authenticated;
grant update on araread.edition_projects,araread.edition_settings,araread.edition_readers to authenticated;
grant update(revision) on araread.edition_groups to authenticated;
grant update(visibility,state,revision) on araread.edition_versions to authenticated;
grant update(claimed_by,revoked) on araread.edition_invites to authenticated;
grant delete on araread.edition_annotations,araread.edition_members,araread.edition_comments to authenticated;

create policy version_read on araread.edition_versions for select to authenticated using (
 owner_id=(select araread.owner()) or (state in ('published','replaced') and visibility='public') or
 (state in ('shared','published','replaced') and visibility in ('invited','public') and exists(select 1 from araread.edition_members m where m.version_id=id and m.member_id=(select araread.owner())))
);
create policy version_public on araread.edition_versions for select to anon using(state in ('published','replaced') and visibility='public');
create policy version_insert on araread.edition_versions for insert to authenticated with check(owner_id=(select araread.owner()));
create policy version_update on araread.edition_versions for update to authenticated using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()));
create policy source_read on araread.edition_sources for select to authenticated using(owner_id=(select araread.owner()) or exists(select 1 from araread.edition_versions v where edition_sources.id=any(v.source_ids)));
create policy source_public on araread.edition_sources for select to anon using(exists(select 1 from araread.edition_versions v where edition_sources.id=any(v.source_ids)));
create policy source_insert on araread.edition_sources for insert to authenticated with check(owner_id=(select araread.owner()));
create policy passage_read on araread.edition_passages for select to authenticated using(owner_id=(select araread.owner()) or exists(select 1 from araread.edition_versions v where edition_passages.id=any(v.manifest)));
create policy passage_public on araread.edition_passages for select to anon using(exists(select 1 from araread.edition_versions v where edition_passages.id=any(v.manifest)));
create policy passage_insert on araread.edition_passages for insert to authenticated with check(owner_id=(select araread.owner()));
create policy review_owner on araread.edition_reviews for all to authenticated using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()));

-- As políticas de membros não consultam grupos: evita recursão na RLS.
create policy member_read on araread.edition_members for select to authenticated using(owner_id=(select araread.owner()) or member_id=(select araread.owner()));
create policy member_insert on araread.edition_members for insert to authenticated with check(member_id=(select araread.owner()) and exists(
 select 1 from araread.edition_invites i where i.id=invite_id and i.group_id=edition_members.group_id and i.owner_id=edition_members.owner_id and i.version_id=edition_members.version_id and i.claimed_by=(select araread.owner()) and not i.revoked and i.expires_at>now()
));
create policy member_delete on araread.edition_members for delete to authenticated using(owner_id=(select araread.owner()) or member_id=(select araread.owner()));
create policy group_read on araread.edition_groups for select to authenticated using(owner_id=(select araread.owner()) or exists(select 1 from araread.edition_members m where m.group_id=id and m.member_id=(select araread.owner())));
create policy group_insert on araread.edition_groups for insert to authenticated with check(owner_id=(select araread.owner()));
create policy group_update on araread.edition_groups for update to authenticated using(owner_id=(select araread.owner()) or exists(select 1 from araread.edition_members m where m.group_id=id and m.member_id=(select araread.owner()))) with check(owner_id=(select araread.owner()) or exists(select 1 from araread.edition_members m where m.group_id=id and m.member_id=(select araread.owner())));
create policy invite_read on araread.edition_invites for select to authenticated using(owner_id=(select araread.owner()) or (token_hash=current_setting('araread.invite_hash',true) and expires_at>now() and not revoked and (claimed_by is null or claimed_by=(select araread.owner()))));
create policy invite_insert on araread.edition_invites for insert to authenticated with check(owner_id=(select araread.owner()));
create policy invite_update on araread.edition_invites for update to authenticated using(owner_id=(select araread.owner()) or (token_hash=current_setting('araread.invite_hash',true) and expires_at>now() and not revoked and claimed_by is null)) with check(owner_id=(select araread.owner()) or (claimed_by=(select araread.owner()) and token_hash=current_setting('araread.invite_hash',true) and expires_at>now() and not revoked));
create policy comment_read on araread.edition_comments for select to authenticated using(exists(select 1 from araread.edition_groups g where g.id=group_id));
create policy comment_insert on araread.edition_comments for insert to authenticated with check(owner_id=(select araread.owner()) and exists(select 1 from araread.edition_groups g where g.id=group_id));
create policy comment_delete on araread.edition_comments for delete to authenticated using(owner_id=(select araread.owner()) and exists(select 1 from araread.edition_groups g where g.id=group_id));

create index on araread.edition_versions using gin(source_ids);
create index on araread.edition_versions using gin(manifest);
create index on araread.edition_versions(project_id,created_at desc);
create index on araread.edition_reviews(passage_id,created_at desc);
create index on araread.edition_members(member_id,version_id);
create index on araread.edition_annotations(owner_id,version_id,passage_id);
create index on araread.edition_comments(group_id,created_at);

-- O papel de conexão continua sem bypass e passa a poder assumir anon somente
-- para os três conjuntos editoriais publicados. Nenhuma tabela pessoal recebe grant.
grant anon to araread_app;

-- Integridade dos manifestos e referências também sob acesso SQL comum.
create function araread_private.edition_relations() returns trigger language plpgsql security invoker set search_path='' as $$
declare vid uuid; gid uuid; begin
 if tg_table_name in ('edition_projects','edition_versions') then
  if exists(select 1 from unnest(new.source_ids) x where not exists(select 1 from araread.edition_sources s where s.id=x and s.owner_id=new.owner_id)) then raise exception 'edition source ownership' using errcode='23503'; end if;
  if tg_table_name='edition_projects' then vid:=new.id; else vid:=new.project_id; end if;
  if exists(select 1 from unnest(new.manifest) x where not exists(select 1 from araread.edition_passages p where p.id=x and p.project_id=vid and p.owner_id=new.owner_id)) then raise exception 'edition passage ownership' using errcode='23503'; end if;
 elsif tg_table_name='edition_annotations' then
  if not exists(select 1 from araread.edition_versions v where v.id=new.version_id and new.passage_id=any(v.manifest) and v.state<>'withdrawn') then raise exception 'annotation version mismatch' using errcode='23503'; end if;
 elsif tg_table_name='edition_comments' then
  if not exists(select 1 from araread.edition_groups g join araread.edition_versions v on v.id=g.version_id where g.id=new.group_id and new.passage_id=any(v.manifest)) then raise exception 'comment version mismatch' using errcode='23503'; end if;
 end if;
 return new;
end $$;
revoke all on function araread_private.edition_relations() from public,anon;
grant execute on function araread_private.edition_relations() to authenticated;
create trigger edition_project_relations before insert or update on araread.edition_projects for each row execute function araread_private.edition_relations();
create trigger edition_version_relations before insert or update on araread.edition_versions for each row execute function araread_private.edition_relations();
create trigger edition_annotation_relations before insert on araread.edition_annotations for each row execute function araread_private.edition_relations();
create trigger edition_comment_relations before insert on araread.edition_comments for each row execute function araread_private.edition_relations();
