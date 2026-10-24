import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {extract} from '../importers.ts';
import {ensure} from '../errors.ts';
import {portion} from '../anchors.ts';
import {config} from '../config.ts';
import {digest,one} from './context.ts';
import {requireReadable} from '../ingestion/quality.ts';

export async function appendSegment(c:PoolClient,r:any,a:any,uid:string,quota:(bytes:number)=>Promise<unknown>){
 const old=await one(c,'select s.* from araread.sources s join araread.reading_segments g on g.source_id=s.id where g.reading_id=$1 order by g.ordinal desc limit 1',[r.id]);
 ensure(old.partial,'NOT_PARTIAL','Marque uma fonte parcial no início; acréscimo não é correção nem nova edição.');
 const x=await extract(a);requireReadable(x.quality);ensure(x.blocks.length>0&&x.blocks.length<=20000,'EMPTY_SOURCE','Forneça elementos válidos para o acréscimo.');
 const original=x.quality.original_required?x.original:null;
 ensure(x.original.length<=config.maxBytes,'TOO_LARGE','O segmento excede 8 MiB.');await quota((original?.length||0)+x.blocks.reduce((n,b)=>n+Buffer.byteLength(b.text),0));
 const sourceId=randomUUID(),segmentId=randomUUID(),ordinal=Number((await one(c,'select coalesce(max(ordinal),-1)+1 n from araread.reading_segments where reading_id=$1',[r.id])).n);
 await c.query('insert into araread.sources(id,owner_id,work_id,edition,original_language,partial,genres,origin,sha256,original,mime,filename,warnings,original_available,canonical_sha256,extraction,storage_policy) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[sourceId,uid,old.work_id,old.edition,old.original_language,a.partial||x.quality.status==='partial',JSON.stringify(old.genres),a.origin,digest(x.original),original,x.mime,x.filename,JSON.stringify(x.warnings),!!original,x.canonical_hash,JSON.stringify({quality:x.quality,metadata:x.metadata}),original?'retained':'text']);
 const elements=x.blocks.map((b,i)=>({id:randomUUID(),owner_id:uid,source_id:sourceId,ordinal:i,kind:b.kind,text:b.text,locator:b.locator||`Segmento ${ordinal+1} · elemento ${i+1}`,meta:b.meta}));
 await c.query('insert into araread.elements select * from jsonb_to_recordset($1::jsonb) as x(id uuid,owner_id uuid,source_id uuid,ordinal integer,kind text,text text,locator text,meta jsonb)',[JSON.stringify(elements)]);
 await c.query('insert into araread.reading_segments(id,owner_id,reading_id,source_id,ordinal) values($1,$2,$3,$4,$5)',[segmentId,uid,r.id,sourceId,ordinal]);
 await c.query('update araread.readings set revision=revision+1,available_end=false where id=$1',[r.id]);
 return {reading_id:r.id,source_id:sourceId,segment_id:segmentId,manifest_version:r.revision+1,revision:r.revision+1,first_new_ref:portion(elements[0]),resume:r.resume,previous_references_preserved:true,warnings:x.warnings};
}
