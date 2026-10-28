-- Excluir uma identidade não reabre o convite que ela já consumiu.
alter table araread.edition_invites drop constraint edition_invites_claimed_by_fkey;
alter table araread.edition_invites add constraint edition_invites_claimed_by_fkey
 foreign key(claimed_by) references auth.users(id) on delete set null;
create function araread_private.revoke_orphaned_edition_invite() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 new.revoked:=true;
 return new;
end $$;
revoke all on function araread_private.revoke_orphaned_edition_invite() from public,anon;
grant execute on function araread_private.revoke_orphaned_edition_invite() to authenticated;
create trigger edition_invite_deleted_claimant before update of claimed_by on araread.edition_invites
 for each row when(old.claimed_by is not null and new.claimed_by is null)
 execute function araread_private.revoke_orphaned_edition_invite();
