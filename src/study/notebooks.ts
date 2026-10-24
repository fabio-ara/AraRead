import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {ensure} from '../errors.ts';
import {citationSchema} from './contracts.ts';
import {digest,one,ownPerspective,apa} from './context.ts';

const noteItem=z.object({text:z.string().max(10000),kind:z.string().max(60),origin:z.enum(['user','assistant']),declared_author:z.string().max(200),source_sha256:z.string().length(64),edition:z.string().max(200),original_language:z.string().max(80),element_sha256:z.string().length(64),locator:z.string().max(200),start:z.number().int().nonnegative(),end:z.number().int().positive(),created_at:z.string(),attribution:z.record(z.string(),z.unknown()).default({}),evidence_keys:z.array(z.number().int().nonnegative()).max(40).default([])}).strict();
const bundleSchema=z.object({format:z.literal('araread-notebook/1'),notebook:z.object({name:z.string().min(1).max(200),description:z.string().max(4000),scope:z.string().min(1).max(2000),version:z.number().int().positive(),declared_author:z.string().max(200),usage_terms:z.string().max(1000)}).strict(),references:z.array(citationSchema).max(40),comments:z.array(noteItem).min(1).max(50),exported_at:z.iso.datetime()}).strict();

export async function exportNotebook(c:PoolClient,a:any){
 const p=await ownPerspective(c,a.notebook_id,a.reading_id);ensure(p.kind==='notebook','INVALID_NOTEBOOK','Selecione um caderno.');
 const ids=[...new Set(a.note_ids)];const notes=(await c.query('select n.*,s.sha256 source_sha256,s.edition,s.original_language,e.text element_text,e.locator from araread.notes n join araread.sources s on s.id=n.source_id join araread.elements e on e.id=n.element_id where n.reading_id=$1 and n.notebook_id=$2 and n.id=any($3::uuid[]) order by n.created_at,n.id',[a.reading_id,p.id,ids])).rows;
 ensure(notes.length===ids.length,'INVALID_NOTEBOOK','Exporte somente comentários escolhidos deste caderno.');
 const refIds=[...new Set<string>(notes.flatMap(n=>n.evidence_ids||[]))];
 const refs=refIds.length?(await c.query('select * from araread."references" where id=any($1::uuid[]) order by id',[refIds])).rows:[];
 const references=refs.map(v=>citationSchema.parse(Object.fromEntries(Object.keys(citationSchema.shape).map(k=>[k,v[k] instanceof Date?v[k].toISOString().slice(0,10):v[k]===null?undefined:v[k]]))));
 const bundle={format:'araread-notebook/1',notebook:{name:p.name,description:p.description,scope:p.scope,version:p.version,declared_author:p.declared_author,usage_terms:p.usage_terms},references,comments:notes.map(n=>({text:n.text,kind:n.kind,origin:n.origin,declared_author:n.declared_author,source_sha256:n.source_sha256,edition:n.edition,original_language:n.original_language,element_sha256:digest(n.element_text),locator:n.locator,start:n.start_offset,end:n.end_offset,created_at:new Date(n.created_at).toISOString(),attribution:n.attribution,evidence_keys:(n.evidence_ids||[]).map((id:string)=>refs.findIndex(v=>v.id===id)).filter((i:number)=>i>=0)})),exported_at:new Date().toISOString()};
 return {bundle,preview:{comments:notes.length,references:references.length,originals:false,reading_progress:false,other_notes:false,credentials:false,declared_authorship_only:true,usage_terms:p.usage_terms},warning:'Confira direitos e conteúdo antes de compartilhar. Uma cópia recebida não pode ser apagada remotamente.'};
}
export async function importNotebook(c:PoolClient,r:any,a:any,uid:string){
 ensure(Buffer.byteLength(JSON.stringify(a.bundle))<=1024*1024,'TOO_LARGE','Caderno limitado a 1 MiB.');
 const checked=bundleSchema.safeParse(a.bundle);ensure(checked.success,'INVALID_NOTEBOOK','Pacote de caderno inválido.');const b=checked.data;
 const notebookId=randomUUID(),referenceIds:string[]=[];
 for(const v of b.references){const id=randomUUID();referenceIds.push(id);await c.query('insert into araread."references"(id,owner_id,reading_id,title,author,year,edition,translation,url,doi,kind,locator,excerpt,sha256,consulted_at,access,license) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[id,uid,r.id,v.title,v.author,v.year,v.edition,v.translation,v.url||null,v.doi||null,v.kind,v.locator,v.excerpt,digest(v.excerpt),v.consulted_at,v.access,v.license]);}
 await c.query('insert into araread.perspectives(id,owner_id,reading_id,name,kind,scope,description,version,evidence_ids,declared_author,usage_terms) values($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10)',[notebookId,uid,r.id,b.notebook.name,'notebook',b.notebook.scope,b.notebook.description,JSON.stringify(referenceIds),b.notebook.declared_author,b.notebook.usage_terms]);
 let aligned=0,pending=0;
 for(const n of b.comments){
  const candidates=(await c.query('select e.*,s.sha256,s.edition,s.original_language from araread.elements e join araread.sources s on s.id=e.source_id join araread.reading_segments g on g.source_id=s.id where g.reading_id=$1 and s.sha256=$2 and s.edition=$3 and s.original_language=$4',[r.id,n.source_sha256,n.edition,n.original_language])).rows.filter(e=>digest(e.text)===n.element_sha256&&e.locator===n.locator&&n.start<n.end&&n.end<=Array.from(e.text).length);
  const e=candidates.length===1?candidates[0]:null,linked=!!e;linked?aligned++:pending++;
  const at=e?{source_id:e.source_id,element_id:e.id,start:n.start,end:n.end}:r.resume;
  ensure(n.evidence_keys.every(k=>k<referenceIds.length),'INVALID_NOTEBOOK','Referência ausente no caderno.');
  await c.query('insert into araread.notes(id,owner_id,reading_id,source_id,element_id,start_offset,end_offset,kind,text,origin,selected,notebook_id,declared_author,pending_link,attribution,evidence_ids) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15)',[randomUUID(),uid,r.id,at.source_id,at.element_id,at.start,at.end,'third_party',n.text,n.origin,notebookId,n.declared_author,!linked,JSON.stringify({imported:true,authorship_verified:false,original:n,notebook_version:b.notebook.version,adaptation:false}),JSON.stringify(n.evidence_keys.map(k=>referenceIds[k]))]);
 }
 return {reading_id:r.id,notebook_id:notebookId,aligned,pending,influence_enabled:false,attribution_verified:false};
}
