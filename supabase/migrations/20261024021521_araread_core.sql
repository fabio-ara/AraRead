-- Dados privados do AraRead. O schema não é exposto pela Data API.
create schema if not exists araread;
revoke all on schema araread from public,anon;
grant usage on schema araread to authenticated;

create function araread.owner() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
revoke all on function araread.owner() from public;
grant execute on function araread.owner() to authenticated;

create table araread.preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 language text not null default 'pt-BR', portion_size text not null default 'medium',
 revision integer not null default 0 check(revision>=0)
);
create table araread.works (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,author text not null default '',created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table araread.sources (
 id uuid primary key,owner_id uuid not null,work_id uuid not null,
 edition text not null default '',original_language text not null,partial boolean not null,
 genres jsonb not null default '[]',origin text not null, captured_at timestamptz not null default now(),
 sha256 text not null, original bytea not null,mime text not null,filename text not null,
 warnings jsonb not null default '[]', derives_from uuid,
 unique(id,owner_id),unique(id,work_id,owner_id),
 foreign key(work_id,owner_id) references araread.works(id,owner_id) on delete cascade,
 foreign key(derives_from,work_id,owner_id) references araread.sources(id,work_id,owner_id)
);
create table araread.elements (
 id uuid primary key,owner_id uuid not null,source_id uuid not null,ordinal integer not null,
 kind text not null,text text not null check(length(text)>0),locator text not null,meta jsonb not null default '{}',
 unique(id,source_id,owner_id), unique(source_id,ordinal),
 foreign key(source_id,owner_id) references araread.sources(id,owner_id) on delete cascade
);
create table araread.readings (
 id uuid primary key,owner_id uuid not null,source_id uuid not null,
 revision integer not null default 0,language text,portion_size text,
 opened jsonb not null,resume jsonb not null,covered jsonb not null default '[]',
 available_end boolean not null default false,created_at timestamptz not null default now(),
 unique(id,source_id,owner_id),unique(id,owner_id),
 foreign key(source_id,owner_id) references araread.sources(id,owner_id) on delete cascade
);
create table araread.mediations (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,source_id uuid not null,element_id uuid not null,
 start_offset integer not null,end_offset integer not null check(end_offset>start_offset),language text not null,
 rewrite text not null,additions jsonb not null,provenance jsonb not null,created_at timestamptz not null default now(),
 foreign key(reading_id,source_id,owner_id) references araread.readings(id,source_id,owner_id) on delete cascade,
 foreign key(element_id,source_id,owner_id) references araread.elements(id,source_id,owner_id) on delete cascade
);
create table araread.notes (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,source_id uuid not null,element_id uuid not null,
 start_offset integer not null,end_offset integer not null check(end_offset>start_offset),
 kind text not null,text text not null,origin text not null check(origin in ('user','assistant')),
 reply_to uuid,resolved boolean not null default false,created_at timestamptz not null default now(),
 unique(id,reading_id,owner_id),
 foreign key(reading_id,source_id,owner_id) references araread.readings(id,source_id,owner_id) on delete cascade,
 foreign key(element_id,source_id,owner_id) references araread.elements(id,source_id,owner_id) on delete cascade,
 foreign key(reply_to,reading_id,owner_id) references araread.notes(id,reading_id,owner_id)
);
create table araread.terms (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,source_id uuid not null,element_id uuid not null,
 start_offset integer not null,end_offset integer not null check(end_offset>start_offset),language text not null,
 term text not null,definition text not null,sense text not null,origin text not null,
 created_at timestamptz not null default now(),
 foreign key(reading_id,source_id,owner_id) references araread.readings(id,source_id,owner_id) on delete cascade,
 foreign key(element_id,source_id,owner_id) references araread.elements(id,source_id,owner_id) on delete cascade
);
create table araread.events (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,kind text not null,
 ref jsonb,revision integer not null,created_at timestamptz not null default now(),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade
);
create table araread.receipts (
 owner_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,
 request_hash text not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(owner_id,operation_id)
);

do $$ declare t text; begin
 foreach t in array array['preferences','works','sources','elements','readings','mediations','notes','terms','events','receipts'] loop
  execute format('alter table araread.%I enable row level security',t);
  execute format('alter table araread.%I force row level security',t);
  execute format('create policy owner_access on araread.%I for all to authenticated using (owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()))',t);
  execute format('create index on araread.%I(owner_id)',t);
 end loop;
end $$;
create index on araread.readings(source_id);
create index on araread.sources(work_id);
create index on araread.mediations(reading_id,element_id,start_offset,end_offset,language,created_at desc);
create index on araread.notes(reading_id,created_at);
create index on araread.terms(reading_id,language);
create index on araread.events(reading_id,created_at);
grant select,insert,delete on all tables in schema araread to authenticated;
grant update on araread.readings,araread.preferences to authenticated;
-- Fontes, elementos e histórico permanecem imutáveis sob o papel da aplicação.

-- Consulta pontual de sessão para revogação imediata. Não permite ler sessões alheias.
create function araread_private.session_active(uid uuid,sid uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select uid=araread.owner() and exists(select 1 from auth.sessions s where s.id=sid and s.user_id=uid and (s.not_after is null or s.not_after>now()))
$$;
revoke all on function araread_private.session_active(uuid,uuid) from public,anon;
grant usage on schema araread_private to authenticated;
grant execute on function araread_private.session_active(uuid,uuid) to authenticated;
