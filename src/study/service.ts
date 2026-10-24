import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {ensure} from '../errors.ts';
import {guidanceVersion} from '../guidance.ts';
import {digest,one,memberElement,ownEvidence,ownPerspective,prepareStudy,apa,dependentMediations} from './context.ts';
import {appendSegment} from './continuity.ts';
import {exportNotebook,importNotebook} from './notebooks.ts';
import {lookupVocabulary} from './vocabulary.ts';
import {deleteMemory} from './memory.ts';
import {studySchemas} from './contracts.ts';
import type {Identity} from '../db.ts';
import {resolvePreferences} from './preferences.ts';

const str=JSON.stringify;
export async function dispatchStudy(name:string,a:any,uid:string,c:PoolClient,r:any,quota:(n:number)=>Promise<unknown>,identity?:Identity){
 if(!Object.hasOwn(studySchemas,name))return undefined;
 r??=await one(c,'select * from araread.readings where id=$1',[a.reading_id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);
 if(a.ref)await memberElement(c,r.id,a.ref);
 if(name==='source_append')return appendSegment(c,r,a,uid,quota);
 if(name==='study_catalog'){
  const tables:Record<string,string>={references:'references',perspectives:'perspectives',contexts:'contexts',connections:'connections',notes:'notes'},table=tables[a.kind];
  const filter=`from araread."${table}" where reading_id=$1 and row_to_json("${table}")::text ilike $2`;
  const total=Number((await one(c,`select count(*) n ${filter}`,[r.id,`%${a.query}%`])).n);
  const items=(await c.query(`select * ${filter} order by created_at desc,id limit $3 offset $4`,[r.id,`%${a.query}%`,a.limit,a.offset])).rows;
  if(a.kind==='connections'){const ids=[...new Set<string>(items.flatMap(v=>v.evidence_ids))],available=new Set((await c.query('select id from araread."references" where id=any($1::uuid[]) and access=\'available\' and consulted_at is not null and excerpt<>\'\'',[ids])).rows.map(v=>v.id));for(const item of items)item.verification=!item.evidence_ids.length?'proposed_unverified':item.evidence_ids.every((id:string)=>available.has(id))?'evidence_recorded_not_certified':'source_unavailable';}
  return {reading_id:r.id,revision:r.revision,items:a.kind==='references'?items.map(v=>({...v,apa:apa(v),verification:'Consulta declarada e hash do trecho; apoio intelectual não certificado'})):items,pagination:{offset:a.offset,limit:a.limit,total,next_offset:a.offset+a.limit<total?a.offset+a.limit:null}};
 }
 if(name==='lexicon_lookup')return lookupVocabulary(c,a);
 if(name==='notebook_export')return exportNotebook(c,a);
 let result:any;
 if(name==='reference_save'){
  ensure(!a.consulted_at||(a.access==='available'&&a.excerpt.trim()&&a.locator.trim()),'MISSING_EVIDENCE','Declarar consulta exige trecho disponível e localizador.');
  const id=randomUUID();await c.query('insert into araread."references"(id,owner_id,reading_id,title,author,year,edition,translation,url,doi,kind,locator,excerpt,sha256,consulted_at,access,license) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[id,uid,r.id,a.title,a.author,a.year,a.edition,a.translation,a.url||null,a.doi||null,a.kind,a.locator,a.excerpt,digest(a.excerpt),a.consulted_at,a.access,a.license]);
  result={entity_id:id,reference_id:id,apa:apa(a),consultation:'declared',structural_hash:digest(a.excerpt)};
 }
 if(name==='perspective_save'){
  await ownEvidence(c,a.evidence_ids,r.id);const previous=await ownPerspective(c,a.previous_id,r.id);if(previous)ensure(previous.kind===a.kind,'INVALID_PERSPECTIVE','Uma nova versão conserva a natureza da perspectiva.');
  const id=randomUUID();await c.query('insert into araread.perspectives(id,owner_id,reading_id,name,kind,scope,description,version,previous_id,evidence_ids,declared_author,usage_terms) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,uid,r.id,a.name,a.kind,a.scope,a.description,(previous?.version||0)+1,a.previous_id||null,str(a.evidence_ids),a.declared_author,a.usage_terms]);
  result={entity_id:id,perspective_id:id,version:(previous?.version||0)+1};
 }
 if(name==='context_prepare'){
  const pref=await resolvePreferences(c,r,identity);const prepared=await prepareStudy(c,r,a.ref,a.language||String(pref.values.language),a.selection,identity);
  const id=randomUUID();await c.query('insert into araread.contexts(id,owner_id,reading_id,source_id,ref,selection,signature,materials,gaps,language,guidance_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,uid,r.id,a.ref.source_id,str(a.ref),str(prepared.selection),prepared.signature,str(prepared.material_keys),str(prepared.gaps),prepared.effective_language,guidanceVersion]);
  const {material_keys,...publicPrepared}=prepared;result={context_id:id,...publicPrepared,guidance_version:guidanceVersion,availability_is_not_causation:true};
 }
 if(name==='note_manage'){
  const note=await one(c,'select * from araread.notes where id=$1 and reading_id=$2',[a.note_id,r.id]);ensure(note,'NOT_FOUND','Nota não encontrada.',404);
  if(a.action==='delete'){
   result=await deleteMemory(c,r.id,note.id);
  }else if(a.action==='link'){
   ensure(a.ref&&note.pending_link,'INVALID_RELATION','Somente um comentário pendente pode ser vinculado explicitamente.');
   await c.query('update araread.notes set source_id=$2,element_id=$3,start_offset=$4,end_offset=$5,pending_link=false where id=$1',[note.id,a.ref.source_id,a.ref.element_id,a.ref.start,a.ref.end]);result={note_id:note.id,linked:true};
  }else{
   await c.query('update araread.notes set selected=$2,status=$3 where id=$1',[note.id,a.action==='activate',a.action==='activate'?'unreviewed':'disabled']);result={note_id:note.id,selected:a.action==='activate'};
  }
 }
 if(name==='connection_save'){
  await memberElement(c,a.target_reading_id,a.target_ref);const evidence=await ownEvidence(c,a.evidence_ids);
  ensure(!['formal','influence'].includes(a.kind)||evidence.some(v=>v.access==='available'&&v.consulted_at&&v.excerpt),'MISSING_EVIDENCE','Relação formal ou influência exige fonte pertinente disponível e consulta declarada.');
  const id=randomUUID();await c.query('insert into araread.connections(id,owner_id,reading_id,target_reading_id,ref,target_ref,kind,origin,problem,limits,evidence_ids) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,uid,r.id,a.target_reading_id,str(a.ref),str(a.target_ref),a.kind,a.origin,a.problem,a.limits,str(a.evidence_ids)]);result={entity_id:id,return_point:{reading_id:r.id,ref:a.ref}};
 }
 if(name==='notebook_import')result=await importNotebook(c,r,a,uid);
 if(name==='correction_save'){
  await ownEvidence(c,a.evidence_ids);const m=await one(c,'select * from araread.mediations where id=$1 and reading_id=$2',[a.mediation_id,r.id]);ensure(m,'NOT_FOUND','Mediação não encontrada.',404);
  ensure(m.source_id===a.ref.source_id&&m.element_id===a.ref.element_id&&m.start_offset===a.ref.start&&m.end_offset===a.ref.end,'INVALID_REF','O relato deve apontar para a mesma porção da mediação.');
  const affected=await dependentMediations(c,r.id,[m.id]);
  await c.query("update araread.mediations set status='needs_review' where id=any($1::uuid[])",[affected]);
  await c.query("update araread.terms set status='needs_review' where reading_id=$1 and details->>'derived_from'=any($2::text[])",[r.id,affected]);
  await c.query("update araread.notes set status='needs_review' where reading_id=$1 and related_mediation_id=any($2::uuid[])",[r.id,affected]);
  const id=randomUUID();await c.query('insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,related_mediation_id,evidence_ids) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,uid,r.id,a.ref.source_id,a.ref.element_id,a.ref.start,a.ref.end,'correction',a.problem,'assistant',m.id,str(a.evidence_ids)]);result={entity_id:id,affected_mediation_ids:affected,original_changed:false,human_review_inferred:false};
 }
 ensure(result,'TOOL_NOT_FOUND','Operação de estudo não reconhecida.');
 await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
 return {...result,reading_id:r.id,source_id:a.ref?.source_id||r.source_id,revision:r.revision+1};
}
