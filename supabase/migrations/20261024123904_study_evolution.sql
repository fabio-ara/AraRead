-- Evolution preserves existing sources and anchors; each append adds a segment.
create table araread.reading_segments (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,source_id uuid not null,
 ordinal integer not null check(ordinal>=0),created_at timestamptz not null default now(),
 unique(reading_id,source_id,owner_id),unique(reading_id,ordinal),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade deferrable,
 foreign key(source_id,owner_id) references araread.sources(id,owner_id) on delete cascade deferrable
);
insert into araread.reading_segments(id,owner_id,reading_id,source_id,ordinal)
 select gen_random_uuid(),owner_id,id,source_id,0 from araread.readings;
alter table araread.readings add column study jsonb not null default '{}';
alter table araread.preferences add column study jsonb not null default '{}';

create table araread."references" (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,
 title text not null,author text not null default '',year text not null default '',edition text not null default '',
 translation text not null default '',url text,doi text,kind text not null,locator text not null default '',
 excerpt text not null default '',sha256 text not null,consulted_at date,access text not null,license text not null default '',
 created_at timestamptz not null default now(),unique(id,reading_id,owner_id),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade deferrable,
 check(consulted_at is null or (length(excerpt)>0 and length(locator)>0 and access='available'))
);
create table araread.perspectives (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,name text not null,kind text not null,
 scope text not null,description text not null,version integer not null check(version>0),previous_id uuid,
 evidence_ids jsonb not null default '[]',declared_author text not null default '',usage_terms text not null,
 created_at timestamptz not null default now(),unique(id,reading_id,owner_id),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade deferrable,
 foreign key(previous_id,reading_id,owner_id) references araread.perspectives(id,reading_id,owner_id) deferrable
);
create table araread.contexts (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,source_id uuid not null,
 ref jsonb not null,selection jsonb not null,signature text not null,materials jsonb not null,gaps jsonb not null,
 language text not null,guidance_version text not null,created_at timestamptz not null default now(),
 unique(id,reading_id,owner_id),
 foreign key(reading_id,source_id,owner_id) references araread.reading_segments(reading_id,source_id,owner_id) on delete cascade deferrable
);
create table araread.connections (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,target_reading_id uuid not null,
 ref jsonb not null,target_ref jsonb not null,kind text not null,origin text not null,problem text not null,limits text not null,
 evidence_ids jsonb not null default '[]',created_at timestamptz not null default now(),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade deferrable,
 foreign key(target_reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade deferrable
);
create table araread.export_clock (
 owner_id uuid primary key references auth.users(id) on delete cascade,generation bigint not null default 0
);
alter table araread.mediations add constraint mediation_identity unique(id,reading_id,owner_id);
alter table araread.mediations add column context_id uuid,add column context_signature text,
 add column representation text not null default 'rewrite',add column study_selection jsonb not null default '{}',
 add column alignment jsonb not null default '[]',add column evidence_ids jsonb not null default '[]',
 add column dependencies jsonb not null default '[]',add column supersedes uuid,
 add column status text not null default 'unreviewed',
 add foreign key(context_id,reading_id,owner_id) references araread.contexts(id,reading_id,owner_id) on delete cascade deferrable,
 add foreign key(supersedes,reading_id,owner_id) references araread.mediations(id,reading_id,owner_id) on delete set null (supersedes) deferrable;
alter table araread.notes add column selected boolean not null default false,add column notebook_id uuid,
 add column declared_author text not null default '',add column related_mediation_id uuid,
 add column evidence_ids jsonb not null default '[]',add column supersedes uuid,
 add column attribution jsonb not null default '{}',add column pending_link boolean not null default false,
 add column status text not null default 'unreviewed',
 add foreign key(notebook_id,reading_id,owner_id) references araread.perspectives(id,reading_id,owner_id) on delete cascade deferrable,
 add foreign key(related_mediation_id,reading_id,owner_id) references araread.mediations(id,reading_id,owner_id) on delete set null (related_mediation_id) deferrable,
 add foreign key(supersedes,reading_id,owner_id) references araread.notes(id,reading_id,owner_id) on delete set null (supersedes) deferrable;
alter table araread.terms add column details jsonb not null default '{}',add column status text not null default 'unreviewed';

do $$ declare t text; begin
 foreach t in array array['mediations','notes','terms'] loop
  execute format('alter table araread.%I drop constraint %I',t,t||'_reading_id_source_id_owner_id_fkey');
  execute format('alter table araread.%I add foreign key(reading_id,source_id,owner_id) references araread.reading_segments(reading_id,source_id,owner_id) on delete cascade deferrable',t);
 end loop;
 foreach t in array array['reading_segments','references','perspectives','contexts','connections','export_clock'] loop
  execute format('alter table araread.%I enable row level security',t);
  execute format('alter table araread.%I force row level security',t);
  execute format('create policy owner_access on araread.%I for all to authenticated using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()))',t);
  execute format('create index on araread.%I(owner_id)',t);
 end loop;
end $$;
create index on araread."references"(reading_id);
create index on araread.perspectives(reading_id,kind);
create index on araread.contexts(reading_id,signature);
create index on araread.connections(reading_id,target_reading_id);
create index on araread.notes(reading_id,selected,pending_link);
create index on araread.sources(owner_id,sha256);
create index on araread.terms(reading_id,lower(term),language);
grant select,insert,delete on araread.reading_segments,araread."references",araread.perspectives,araread.contexts,araread.connections,araread.export_clock to authenticated;
grant update on araread.export_clock to authenticated;
grant update(selected,pending_link,source_id,element_id,start_offset,end_offset,status) on araread.notes to authenticated;
grant update(status) on araread.mediations,araread.terms to authenticated;
-- PostgreSQL TOAST compresses long values privately; no cross-user deduplication.
alter table araread.sources alter column original set compression lz4;
alter table araread.elements alter column text set compression lz4;
alter table araread.mediations alter column rewrite set compression lz4;
alter table araread.notes alter column text set compression lz4;
