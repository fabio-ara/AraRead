-- Preserva história inacessível e compartilhamentos sem reativar consentimentos.
create table araread.edition_archives (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,created_at timestamptz not null default now()
);
alter table araread.edition_archives enable row level security;
alter table araread.edition_archives force row level security;
create index on araread.edition_archives(owner_id);
create policy archive_owner on araread.edition_archives for all to authenticated
 using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()));
grant select,insert,delete on araread.edition_archives to authenticated;
-- A versão pública guarda somente opções editoriais não pessoais. O snapshot
-- completo da configuração de autoria permanece no projeto privado.
alter table araread.edition_projects add column version_configurations jsonb not null default '{}';
alter table araread.edition_annotations drop constraint edition_annotations_kind_check;
alter table araread.edition_annotations add constraint edition_annotations_kind_check check(kind in ('note','highlight','answer','request','review'));
create unique index edition_one_review_mark on araread.edition_annotations(owner_id,version_id,passage_id) where kind='review';

-- FK sozinha aceita uma versão cujo UUID foi obtido por outra via. O invoker
-- precisa enxergar a versão e todas as posições precisam pertencer ao manifesto.
alter table araread.edition_readers add column updated_at timestamptz not null default now();
create function araread_private.edition_reader_relations() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare manifest uuid[]; begin
 new.updated_at:=now();
 select v.manifest into manifest from araread.edition_versions v where v.id=new.version_id and v.state<>'withdrawn';
 if manifest is null or new.revision<0
  or (new.opened is not null and not new.opened=any(manifest))
  or (new.resume is not null and not new.resume=any(manifest))
  or not new.covered<@manifest
 then raise exception 'reader version mismatch' using errcode='23503'; end if;
 return new;
end $$;
revoke all on function araread_private.edition_reader_relations() from public,anon;
grant execute on function araread_private.edition_reader_relations() to authenticated;
create trigger edition_reader_relations before insert or update on araread.edition_readers
 for each row execute function araread_private.edition_reader_relations();
