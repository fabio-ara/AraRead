import type {PoolClient} from 'pg';
import {dependentMediations} from './context.ts';
// Bibliography is reusable across the owner's works; deletion must leave honest gaps.
export async function withdrawEvidence(c:PoolClient,ids:string[]){
 if(!ids.length)return;
 const contexts=(await c.query("select id from araread.contexts where exists(select 1 from jsonb_array_elements(materials->'references') r where r->>'id'=any($1::text[]))",[ids])).rows.map(x=>x.id);
 const readings=new Set<string>(),seeds=new Map<string,string[]>();
 for(const [table,where,args] of [
  ['mediations',"evidence_ids ?| $1::text[] or context_id=any($2::uuid[]) or exists(select 1 from jsonb_array_elements(coalesce(editorial->'review'->'claims','[]'::jsonb)) claim where (claim->'evidence_ids') ?| $1::text[])",[ids,contexts]],
  ['notes','evidence_ids ?| $1::text[]',[ids]],
  ['terms',"(details->'evidence_ids') ?| $1::text[]",[ids]],
 ] as const){const rows=(await c.query(`update araread.${table} set status='needs_review' where ${where} returning id,reading_id`,args as any)).rows;for(const row of rows){readings.add(row.reading_id);if(table==='mediations')seeds.set(row.reading_id,[...(seeds.get(row.reading_id)||[]),row.id]);}}
 for(const [reading,meds]of seeds){const affected=await dependentMediations(c,reading,meds);await c.query("update araread.mediations set status='needs_review' where id=any($1::uuid[])",[affected]);await c.query("update araread.terms set status='needs_review' where details->>'derived_from'=any($1::text[])",[affected]);await c.query("update araread.notes set status='needs_review' where related_mediation_id=any($1::uuid[])",[affected]);}
 for(const p of (await c.query('select reading_id from araread.perspectives where evidence_ids ?| $1::text[]',[ids])).rows)readings.add(p.reading_id);
 if(readings.size)await c.query('update araread.readings set revision=revision+1 where id=any($1::uuid[])',[[...readings]]);
}
