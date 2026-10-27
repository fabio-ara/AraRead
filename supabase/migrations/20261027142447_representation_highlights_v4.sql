-- Grifos são anotações explícitas. Dados e tabelas anteriores permanecem intactos.
alter table araread.notes add column anchor jsonb;
alter table araread.notes add constraint highlight_anchor_kind check ((kind='highlight')=(anchor is not null));
create index notes_highlights on araread.notes(reading_id,element_id) where kind='highlight';

create function araread_private.validate_highlight() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a jsonb; body text; m araread.mediations%rowtype; s integer; e integer;
begin
 if new.kind<>'highlight' then return new; end if;
 a:=new.anchor; s:=(a->>'start')::integer; e:=(a->>'end')::integer;
 if new.origin<>'user' or s<0 or e<=s or e-s>4000 or a->>'representation' not in ('original','rewrite','translation') then
  raise exception 'invalid highlight' using errcode='23514';
 end if;
 if a->>'representation'='original' then
  if a ? 'mediation_id' or a->>'segment'<>'main' or s<new.start_offset or e>new.end_offset then raise exception 'invalid original anchor' using errcode='23514'; end if;
  select text into body from araread.elements where id=new.element_id and source_id=new.source_id and owner_id=new.owner_id;
 else
  select * into m from araread.mediations where id=(a->>'mediation_id')::uuid and reading_id=new.reading_id and owner_id=new.owner_id;
  if not found then
   -- Only backup recovery can intentionally preserve a missing historical version.
   -- The public save schema rejects this flag; no text is silently reanchored.
   if a->>'unavailable_version'='true' and new.text=a->>'exact' then return new; end if;
   raise exception 'unavailable mediation' using errcode='23514';
  end if;
  if m.source_id<>new.source_id or m.element_id<>new.element_id or m.start_offset<>new.start_offset or m.end_offset<>new.end_offset or m.representation<>a->>'representation' then raise exception 'crossed mediation anchor' using errcode='23514'; end if;
  if a->>'segment'='main' then body:=m.rewrite;
  elsif a->>'segment' ~ '^addition:([0-9]|1[0-9])$' then body:=m.additions->(split_part(a->>'segment',':',2)::integer)->>'text';
  end if;
 end if;
 if body is null or e>char_length(body) or substring(body from s+1 for e-s) is distinct from a->>'exact' or new.text is distinct from a->>'exact'
 or substring(body from greatest(0,s-32)+1 for least(32,s)) is distinct from a->>'prefix' or substring(body from e+1 for 32) is distinct from a->>'suffix' then
  raise exception 'highlight quote mismatch' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function araread_private.validate_highlight() from public;
create trigger validate_highlight before insert or update on araread.notes for each row execute function araread_private.validate_highlight();
