import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {ensure} from '../errors.ts';
import {validateRef,type Element} from '../anchors.ts';
import type {Ref} from '../contracts.ts';
import {guidanceVersion} from '../guidance.ts';

const canonical=(v:any):any=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const digest=(v:unknown)=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(canonical(v))).digest('hex');
export const one=async(c:PoolClient,sql:string,args:unknown[]=[]) => (await c.query(sql,args)).rows[0];
export async function memberElement(c:PoolClient,readingId:string,ref:Ref){
 const e=await one(c,'select e.* from araread.elements e join araread.reading_segments g on g.source_id=e.source_id and g.owner_id=e.owner_id where g.reading_id=$1 and e.id=$2 and e.source_id=$3',[readingId,ref.element_id,ref.source_id]);
 ensure(e,'INVALID_REF','A referência não pertence a um segmento desta leitura.');validateRef(ref,e,ref.source_id);return e as Element;
}
export async function ownEvidence(c:PoolClient,ids:string[],readingId?:string){
 const list=[...new Set(ids)];if(!list.length)return [];
 const rows=(await c.query('select * from araread."references" where id=any($1::uuid[]) order by id',[list])).rows;
 ensure(rows.length===list.length&&(!readingId||rows.every(x=>x.reading_id===readingId)),'INVALID_EVIDENCE','Fonte indisponível ou fora do escopo autorizado.');return rows;
}
export async function ownPerspective(c:PoolClient,id:string|null|undefined,readingId:string){
 if(!id)return null;const p=await one(c,'select * from araread.perspectives where id=$1 and reading_id=$2',[id,readingId]);ensure(p,'INVALID_PERSPECTIVE','Perspectiva não encontrada nesta leitura.');return p;
}
export async function dependentMediations(c:PoolClient,readingId:string,seeds:string[]){
 const affected=[...new Set(seeds)];let frontier=[...affected];
 while(frontier.length){const next=(await c.query('select id from araread.mediations where reading_id=$1 and dependencies ?| $2::text[] and not(id=any($3::uuid[]))',[readingId,frontier,affected])).rows.map(x=>x.id);affected.push(...next);frontier=next;ensure(affected.length<=500,'TOO_MANY_DEPENDENCIES','Dependências excedem o limite de revisão.');}
 return affected;
}
export async function prepareStudy(c:PoolClient,r:any,ref:Ref,language:string,explicit:any={}){
 const pref=await one(c,'select study from araread.preferences')||{study:{}};
 const selection={representation:'rewrite',support_mode:'standard',perspective_id:null,include_notes:true,...pref.study,...r.study,...explicit};
 const perspective=await ownPerspective(c,selection.perspective_id,r.id);
 const gaps:string[]=[];let remaining=64*1024-256,omitted=0;
 const bounded=(rows:any[])=>rows.filter(row=>{const bytes=Buffer.byteLength(JSON.stringify(row));if(bytes>remaining){omitted++;return false;}remaining-=bytes;return true;});
 if(perspective)remaining-=Buffer.byteLength(JSON.stringify(perspective));
 const notes=bounded(selection.include_notes?(await c.query(`select * from araread.notes where reading_id=$1 and element_id=$2 and not pending_link and status<>'disabled' and (selected or notebook_id=$3) and ($4::uuid[] is null or id=any($4)) order by created_at,id limit 40`,[r.id,ref.element_id,perspective?.kind==='notebook'?perspective.id:null,selection.note_ids||null])).rows:[]);
 const terms=bounded((await c.query('select * from araread.terms where reading_id=$1 and element_id=$2 and language=$3 order by created_at desc,id limit 25',[r.id,ref.element_id,language])).rows);
 const evidenceIds=[...new Set<string>([...(perspective?.evidence_ids||[]),...notes.flatMap(n=>n.evidence_ids||[]),...terms.flatMap(t=>t.details?.evidence_ids||[])])];
 if(evidenceIds.length>40)gaps.push('Mais de 40 referências selecionadas; consulte páginas específicas no catálogo para o restante.');
 const available=(await c.query('select * from araread."references" where id=any($1::uuid[]) order by id',[evidenceIds.slice(0,40)])).rows;
 if(available.length<Math.min(40,evidenceIds.length))gaps.push('Há fontes antes vinculadas que já não estão disponíveis nesta conta. Reexamine as afirmações dependentes; não presuma consulta atual.');
 const references=bounded(available);
 if(omitted)gaps.push(`${omitted} material(is) não foram disponibilizados por excederem o orçamento de 64 KiB de apoios; reduza a seleção para consultá-los. O original não foi cortado por esse orçamento.`);
 const e=await memberElement(c,r.id,ref),source=await one(c,'select sha256 from araread.sources where id=$1',[ref.source_id]);
 const materialKeys={source:{id:ref.source_id,sha256:source.sha256,ref},notes:notes.map(n=>({id:n.id,hash:digest([n.text,n.kind,n.attribution,n.evidence_ids])})),terms:terms.map(t=>({id:t.id,hash:digest([t.definition,t.sense,t.details])})),references:references.map(v=>({id:v.id,sha256:v.sha256,access:v.access,consulted_at:v.consulted_at})),perspective:perspective?{id:perspective.id,version:perspective.version}:null};
 const signature=digest({ref,language,selection,materials:materialKeys,guidance_version:guidanceVersion});
 if(perspective&&!references.some(v=>v.access==='available'&&v.excerpt))gaps.push('Esta perspectiva não tem material de referência disponível; não atribua posições ao comentador sem consultar fonte pertinente.');
 if(references.some(v=>v.access!=='available'||!v.consulted_at))gaps.push('Há referências sugeridas ou sem consulta declarada. Não apresentá-las como consultadas.');
 return {selection,signature,materials:{notes,terms,references,perspective},material_keys:materialKeys,gaps,ref,original:Array.from(e.text).slice(ref.start,ref.end).join(''),effective_language:language};
}
export function apa(v:any){
 const author=v.author||'Autoria não informada',year=v.year||'s.d.';
 return `${author}. (${year}). ${v.title}${v.edition?` (${v.edition})`:''}.${v.locator?` ${v.locator}.`:''}${v.url?` ${v.url}`:v.doi?` https://doi.org/${v.doi}`:''}`;
}
