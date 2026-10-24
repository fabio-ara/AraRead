-- Keep existing binaries; new editions may use the immutable elements as canonical text.
alter table araread.sources alter column original drop not null;
alter table araread.sources add column original_available boolean not null default true,
 add column canonical_sha256 text,
 add column extraction jsonb not null default '{}',
 add column storage_policy text not null default 'retained' check(storage_policy in ('retained','text')),
 add constraint source_bytes_consistent check(original_available=(original is not null)),
 add constraint canonical_text_required check(original is not null or canonical_sha256 ~ '^[a-f0-9]{64}$');
create index sources_canonical_edition on araread.sources(owner_id,canonical_sha256,edition,original_language);
alter table araread.mediations add column editorial jsonb not null default '{}';
create table araread.reading_maps (
 id uuid primary key,owner_id uuid not null,reading_id uuid not null,
 version integer not null check(version>0),items jsonb not null,provenance jsonb not null,
 created_at timestamptz not null default now(),unique(reading_id,version),
 foreign key(reading_id,owner_id) references araread.readings(id,owner_id) on delete cascade
);
alter table araread.reading_maps enable row level security;
alter table araread.reading_maps force row level security;
create policy owner_access on araread.reading_maps for all to authenticated
 using(owner_id=(select araread.owner())) with check(owner_id=(select araread.owner()));
create index reading_maps_owner on araread.reading_maps(owner_id);
grant select,insert,delete on araread.reading_maps to authenticated;
