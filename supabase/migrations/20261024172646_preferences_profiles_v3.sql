create table araread.profiles (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null,version integer not null check(version>0),previous_id uuid,
 definition jsonb not null,provenance jsonb not null,active boolean not null default true,
 created_at timestamptz not null default now(),unique(id,owner_id),
 foreign key(previous_id,owner_id) references araread.profiles(id,owner_id) on delete set null(previous_id) deferrable
);
create table araread.preference_records (
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check(scope in ('account','reading','session')),reading_id uuid,session_id uuid references auth.sessions(id) on delete cascade,
 key text not null,value jsonb,state text not null check(state in ('active','disabled','default')),
 provenance jsonb not null,created_at timestamptz not null default now(),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade,
 check((scope='account' and reading_id is null and session_id is null) or (scope='reading' and reading_id is not null and session_id is null) or (scope='session' and session_id is not null))
);
create unique index preference_scope_key on araread.preference_records(owner_id,scope,coalesce(reading_id,'00000000-0000-0000-0000-000000000000'),coalesce(session_id,'00000000-0000-0000-0000-000000000000'),key);
do $$ declare t text; begin
 foreach t in array array['profiles','preference_records'] loop
  execute format('alter table araread.%I enable row level security',t);
  execute format('alter table araread.%I force row level security',t);
  execute format('create policy owner_access on araread.%I for all to authenticated using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()))',t);
  execute format('create index on araread.%I(owner_id)',t);
 end loop;
end $$;
grant select,insert,delete on araread.profiles,araread.preference_records to authenticated;
grant update(active) on araread.profiles to authenticated;
grant update(value,state,provenance) on araread.preference_records to authenticated;
