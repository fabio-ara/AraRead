import {z} from 'zod';
import {refSchema,language,type ToolName} from './contracts.ts';
const id=z.uuid(),rev=z.number().int().nonnegative(),page=z.object({offset:rev,limit:z.number().int().positive().max(50),total:rev,next_offset:rev.nullable()});
const row=z.record(z.string(),z.unknown());
const receipt=z.object({operation_id:id,status:z.literal('confirmed')});
const saved=receipt.extend({reading_id:id,source_id:id.optional(),revision:rev,ref:refSchema.optional(),entity_id:id.optional(),effective_language:language.optional()}).passthrough();
export const outputs:Record<ToolName,z.ZodType>={
 source_append:saved.extend({segment_id:id,manifest_version:rev,first_new_ref:refSchema,resume:refSchema,previous_references_preserved:z.boolean(),warnings:z.array(z.string())}),
 reference_save:saved.extend({reference_id:id,apa:z.string(),consultation:z.literal('declared'),structural_hash:z.string()}),
 perspective_save:saved.extend({perspective_id:id,version:rev}),
 context_prepare:z.union([saved.extend({context_id:id,signature:z.string(),selection:row,materials:row,gaps:z.array(z.string()),ref:refSchema,original:z.string(),effective_language:language,guidance_version:z.string(),availability_is_not_causation:z.boolean()}),receipt.extend({privacy_redacted:z.literal(true),reading_id:id,revision:rev,message:z.string()})]),
 note_manage:saved.extend({note_id:id,selected:z.boolean().optional(),deleted:z.boolean().optional(),linked:z.boolean().optional()}),
 connection_save:saved.extend({return_point:z.object({reading_id:id,ref:refSchema})}),
 study_catalog:z.object({reading_id:id,revision:rev,items:z.array(row),pagination:page}),
 notebook_export:z.object({bundle:z.unknown(),preview:row,warning:z.string()}),
 notebook_import:saved.extend({notebook_id:id,aligned:rev,pending:rev,influence_enabled:z.literal(false),attribution_verified:z.literal(false)}),
 correction_save:saved.extend({affected_mediation_ids:z.array(id),original_changed:z.literal(false),human_review_inferred:z.literal(false)}),
 lexicon_lookup:z.object({saved:z.array(row),suggestions:z.array(z.object({title:z.string(),url:z.url()})),external:row.nullable(),requires_inference:z.boolean().optional(),notice:z.string()}),
 account_context:z.object({account:z.object({id}),preferences:z.object({language,portion_size:z.string(),revision:rev}).passthrough(),capabilities:row,guidance_version:z.string()}),
 assistant_guidance:z.object({version:z.string(),instructions:z.string()}),
 library_list:z.object({items:z.array(z.object({reading_id:id,source_id:id,work_id:id,title:z.string(),author:z.string(),edition:z.string(),original_language:language,language,revision:rev,resume:refSchema,opened:refSchema,partial:z.boolean(),available_end:z.boolean()})),pagination:page}),
 source_import:receipt.extend({work_id:id,source_id:id,reading_id:id,revision:rev,ref:refSchema,warnings:z.array(z.string())}),
 reading_context:z.object({work:z.object({id,title:z.string(),author:z.string()}),source:z.object({id,work_id:id,edition:z.string(),original_language:language,partial:z.boolean(),warnings:z.array(z.string()),mime:z.string(),filename:z.string(),sha256:z.string(),genres:z.array(z.string())}).passthrough(),reading:z.object({id,source_id:id,revision:rev,language:language.nullable(),portion_size:z.string().nullable(),opened:refSchema,resume:refSchema,covered:z.array(refSchema),available_end:z.boolean()}).passthrough(),ref:refSchema,element:z.object({id,kind:z.string(),locator:z.string(),meta:row,ordinal:rev}),original:z.string(),mediation:z.object({id,language,rewrite:z.string(),additions:z.array(row),provenance:row,created_at:z.unknown()}).passthrough().nullable(),other_languages:z.array(language),effective_language:language,next_ref:refSchema.nullable(),previous_ref:refSchema.nullable(),terms:z.array(row),notes:z.array(row),pending_questions:z.array(row),end_message:z.string().optional(),study:z.object({selection:row,signature:z.string(),materials:row,gaps:z.array(z.string()),variants:z.array(row),stale:z.boolean(),legacy_context_unknown:z.boolean()})}),
 source_elements:z.object({reading_id:id,source_id:id,revision:rev,items:z.array(z.object({id,kind:z.string(),locator:z.string(),ordinal:rev,segment_ordinal:rev,preview:z.string(),ref:refSchema})),pagination:page}),
 reading_history:z.object({reading_id:id,source_id:id,revision:rev,items:z.array(row),pagination:page}),
 mediation_save:saved,term_save:saved,note_save:saved,reading_move:saved,
 preferences_set:receipt.extend({reading_id:id.optional(),revision:rev}),
 operation_get:z.union([receipt.passthrough(),z.object({operation_id:id,status:z.literal('unknown'),message:z.string()})]),
 data_export:z.object({format:z.literal('araread/2'),snapshot:z.string(),sections:z.array(z.string()),section:z.string(),items:z.array(row),pagination:page}),
 data_restore:receipt.extend({id_map:z.record(id,id),restored_readings:rev,archived_receipts:z.array(row),receipt_policy:z.string()}),
 work_delete:receipt.extend({work_id:id,deleted:z.literal(true)}),
};
