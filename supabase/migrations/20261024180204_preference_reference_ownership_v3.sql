-- Application checks and direct authenticated SQL agree on ownership.
alter table araread.preference_records add constraint preference_catalog_key
 check(key in ('language','portion_size','support_mode','include_notes','repertoire','goal','active_profile','perspective_id'));

drop policy owner_access on araread.preference_records;
create policy owner_access on araread.preference_records for all to authenticated
 using(owner_id=(select araread.owner()))
 with check(
  owner_id=(select araread.owner())
  and (scope<>'session' or araread_private.session_active(owner_id,session_id))
  and (key<>'active_profile' or state='default' or value='null'::jsonb or exists(
   select 1 from araread.profiles p where to_jsonb(p.id::text)=value and p.owner_id=preference_records.owner_id
  ))
  and (key<>'perspective_id' or state='default' or value='null'::jsonb or exists(
   select 1 from araread.perspectives p where to_jsonb(p.id::text)=value and p.owner_id=preference_records.owner_id and p.reading_id=preference_records.reading_id
  ))
 );
