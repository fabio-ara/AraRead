import type {PoolClient} from 'pg';
import {ensure} from '../errors.ts';
import {dependentMediations} from './context.ts';

// Explicit deletion follows the recorded graph. Deactivation never calls this.
export async function deleteMemory(c:PoolClient,readingId:string,noteId:string){
 let notes=[noteId],contexts:string[]=[],mediations:string[]=[],terms:string[]=[];
 for(;;){
  const before=notes.length+contexts.length+mediations.length+terms.length;
  notes=(await c.query(`with recursive related as (
   select id from araread.notes where reading_id=$1 and (id=any($2::uuid[]) or related_mediation_id=any($3::uuid[]))
   union select n.id from araread.notes n join related r on n.reply_to=r.id or n.supersedes=r.id where n.reading_id=$1
  ) select id from related`,[readingId,notes,mediations])).rows.map(x=>x.id);
  contexts=(await c.query(`select id from araread.contexts where reading_id=$1 and (
   exists(select 1 from jsonb_array_elements(materials->'notes') n where n->>'id'=any($2::text[])) or
   exists(select 1 from jsonb_array_elements(materials->'terms') t where t->>'id'=any($3::text[])))`,[readingId,notes,terms])).rows.map(x=>x.id);
  const direct=(await c.query('select id from araread.mediations where context_id=any($1::uuid[])',[contexts])).rows.map(x=>x.id);
  mediations=await dependentMediations(c,readingId,[...mediations,...direct]);
  terms=(await c.query("select id from araread.terms where reading_id=$1 and details->>'derived_from'=any($2::text[])",[readingId,mediations])).rows.map(x=>x.id);
  const after=notes.length+contexts.length+mediations.length+terms.length;
  ensure(after<=1500,'TOO_MANY_DEPENDENCIES','Memória extensa demais para esta exclusão; nenhuma alteração foi aplicada.');
  if(after===before)break;
 }
 await c.query('delete from araread.terms where id=any($1::uuid[])',[terms]);
 await c.query('delete from araread.notes where id=any($1::uuid[])',[notes]);
 await c.query('delete from araread.mediations where id=any($1::uuid[])',[mediations]);
 await c.query('delete from araread.contexts where id=any($1::uuid[])',[contexts]);
 return {deleted:true,note_id:noteId,derived_contexts_deleted:contexts.length,derived_mediations_deleted:mediations.length};
}
