import {z} from 'zod';
import {editorialReviewSchema} from '../study/editorial.ts';

const id=z.uuid(),revision=z.number().int().nonnegative();
const text=(n=3000)=>z.string().max(n);
const ref=z.object({source_id:id,element_id:id,start:revision,end:z.number().int().positive()}).strict();
const write={operation_id:id,expected_revision:revision};
const lang=z.string().min(2).max(80).refine(s=>{try{return !!Intl.getCanonicalLocales(s)[0];}catch{return false;}});
export const editionDefaults={language:'pt-BR',objective:'initial',prior_knowledge:'',explanation:'intermediate',definitions:'first_use',examples:'some',mnemonics:true,humor:'off',perspectives:'',activities:'optional',translation_style:'faithful',audience:'',editorial_criteria:'Preservar negações, condições, atribuição, ambiguidades e limites.',font:'serif',font_size:20,line_spacing:1.7,contrast:'system',resume_mode:'main',tab:'facilitated',visibility:'private'} as const;
export const editionConfig=z.object({
 language:lang,objective:z.enum(['initial','deep','revision','exam','language']),prior_knowledge:text(),
 explanation:z.enum(['essential','intermediate','detailed']),definitions:z.enum(['before','first_use','on_demand']),
 examples:z.enum(['off','some','many']),mnemonics:z.boolean(),humor:z.enum(['off','light']),perspectives:text(),
 activities:z.enum(['none','optional','integrated']),translation_style:z.enum(['faithful','literal','annotated']),
 audience:text(),editorial_criteria:text(),font:z.enum(['serif','sans']),font_size:z.number().int().min(16).max(36),
 line_spacing:z.number().min(1.3).max(2.5),contrast:z.enum(['system','light','dark','high']),resume_mode:z.enum(['main','opened']),tab:z.enum(['facilitated','translation','original']),visibility:z.enum(['private','invited','public']),
}).strict();
export const editionRights=z.object({status:z.enum(['original','public_domain','licensed','private_only']),license:text(500),attribution:text(),evidence:text(),allow_public:z.boolean(),allow_sharing:z.boolean()}).strict();
export const editionSegment=z.object({id:id,representation:z.enum(['facilitated','translation']),language:lang,text:z.string().min(1).max(20000),refs:z.array(ref).min(1).max(30)}).strict();
export const editionSelector=z.object({passage_id:id,representation:z.enum(['original','facilitated','translation']),segment_id:id,start:revision,end:z.number().int().positive(),exact:z.string().min(1).max(4000),prefix:text(128).default(''),suffix:text(128).default('')}).strict();
const evidence=z.object({id:id,title:z.string().min(1).max(500),author:text(300),edition:text(500),locator:text(500),url:z.string().url().max(2000).optional(),excerpt:text(5000),consulted_at:z.string().date().nullable(),kind:z.enum(['documented','synthetic','unconsulted']),limits:text()}).strict();
const support=z.object({id:id,kind:z.enum(['definition','context','example','mnemonic','humor','interpretation','objection','correction']),title:text(300),text:z.string().min(1).max(6000),target:editionSelector.omit({passage_id:true}),evidence_ids:z.array(id).max(20).default([]),attribution:text(500).default(''),nature:z.enum(['documented','editorial','analogy','hypothesis','synthetic']).default('editorial'),limits:text().default(''),original_claim:text().optional(),corrected_claim:text().optional(),evaluated_at:z.string().date().optional()}).strict();
const activity=z.object({id:id,kind:z.enum(['choice','short','classification','order','open']),question:z.string().min(1).max(2000),options:z.array(text(1000)).max(12).default([]),answer:text(3000),feedback:text(3000),criteria:text(3000).default('')}).strict();
export const editionPassage=z.object({key:id,chapter:z.string().min(1).max(200),title:text(300),ordinal:revision,refs:z.array(ref).min(1).max(30),segments:z.array(editionSegment).min(1).max(40),supports:z.array(support).max(80).default([]),activities:z.array(activity).max(12).default([]),evidence:z.array(evidence).max(40).default([]),review:editorialReviewSchema,provenance:z.object({agent:z.string().min(1).max(200),model:text(100).optional(),limits:z.string().min(1).max(3000)}).strict()}).strict();
const project={...write,project_id:id};
export const editionSchemas={
 edition_configuration:z.object({project_id:id.optional()}).strict(),
 edition_catalog:z.object({query:text(200).default(''),entry:z.enum(['work','concept','tradition']).default('work'),offset:revision.default(0),limit:z.number().int().min(1).max(50).default(20)}).strict(),
 edition_context:z.object({project_id:id.optional(),version_id:id.optional(),passage_id:id.optional(),batch_limit:z.number().int().min(1).max(5).default(3)}).strict().refine(a=>!!a.project_id!==!!a.version_id,{message:'Escolha projeto ou versão.'}),
 edition_project:z.object({...write,action:z.enum(['create','update','fork']),project_id:id.optional(),version_id:id.optional(),title:z.string().min(1).max(300),author:text(300).default(''),topics:z.array(text(100)).max(30).default([]),traditions:z.array(text(100)).max(30).default([]),rights:editionRights,synthetic:z.boolean().default(false)}).strict(),
 edition_source:z.object({...project,source_id:id}).strict(),
 edition_plan:z.object({...write,project_id:id.optional(),scope:z.enum(['account','profile','project','session','reader']),scope_id:id.optional(),profile_id:id.nullable().optional(),action:z.enum(['set','reset']),values:editionConfig.partial().default({}),explicit_request:z.literal(true)}).strict(),
 edition_sample:z.object({...project,action:z.enum(['prepare','approve','request_changes']),passage:editionPassage.optional(),reason:z.string().min(1).max(3000),decision_origin:z.enum(['author_action','synthetic_fixture']).optional()}).strict(),
 edition_batch:z.object({...project,passages:z.array(editionPassage).min(1).max(5)}).strict(),
 edition_review:z.object({...project,passage_ids:z.array(id).min(1).max(50),decision:z.enum(['accepted','needs_changes']),note:z.string().min(10).max(3000)}).strict(),
 edition_publish:z.object({...project,action:z.enum(['publish','withdraw']),visibility:z.enum(['private','invited','public']).default('private'),version_id:id.optional(),note:z.string().min(10).max(3000)}).strict(),
 edition_reader:z.object({version_id:id}).strict(),
 edition_annotate:z.object({...write,version_id:id,action:z.enum(['open','continue','resume','note','highlight','answer','request','review','delete']),passage_id:id.optional(),target:editionSelector.optional(),text:text(10000).default(''),activity_id:id.optional(),annotation_id:id.optional(),annotation_operation_id:id.optional(),self_assessment:z.enum(['again','partial','satisfied']).optional()}).strict(),
 edition_groups:z.object({version_id:id.optional(),group_id:id.optional()}).strict(),
 edition_group:z.object({...write,action:z.enum(['create','invite','join','leave','comment','remove_comment','revoke']),group_id:id.optional(),version_id:id.optional(),title:text(200).default(''),invite_code:text(100).optional(),member_id:id.optional(),passage_id:id.optional(),comment_id:id.optional(),text:text(5000).default('')}).strict(),
} as const;
export const editionReadTools=['edition_configuration','edition_catalog','edition_context','edition_reader','edition_groups'] as const;
export const editionDescriptions={
 edition_configuration:'Consulta a configuração editorial persistida com valores efetivos, origens, versões e perfis próprios. Não altera estado nem uma edição publicada.',
 edition_catalog:'Lista versões autorizadas por obra, conceito ou tradição. Leitura pública não exige IA. Não escreve estado pessoal.',
 edition_context:'Consulta projeto editorial (quatro etapas, configuração efetiva com origem, fontes, amostra e próximos itens) ou versão reproduzível. Devolve materiais para o assistente produzir; não gera texto nem anuncia painel.',
 edition_project:'Cria, atualiza ou deriva projeto editorial privado. Preserva versões e fontes anteriores. synthetic identifica exclusivamente homologação explicitamente autorizada.',
 edition_source:'Incorpora ao projeto uma fonte própria já importada e pré-verificada, preservando UUIDs, texto canônico, estrutura, direitos e bytes essenciais. Não torna a biblioteca pessoal pública.',
 edition_plan:'Guarda escolhas explícitas com revisão e escopo. Sessão > projeto > perfil selecionado > conta > padrão. Preferências do leitor só ajustam apresentação e apoios preparados. Não reescreve versões publicadas.',
 edition_sample:'Prepara uma amostra completa no leitor comum; aprovação pela interface exige ação explícita da pessoa autora. synthetic_fixture só aprova homologação declarada; MCP não fabrica decisão humana.',
 edition_batch:'Recebe até cinco passagens produzidas pelo assistente após amostra aprovada. Valida alinhamentos, cobertura e revisão e conserva versões anteriores. Nenhum modelo é executado pelo backend.',
 edition_review:'Registra parecer editorial sobre versões exatas das passagens. Comparação por assistente não equivale a revisão acadêmica humana.',
 edition_publish:'Confere cobertura integral, revisão, direitos e amostra e cria versão imutável privada, convidada ou pública. Retirada não apaga fontes, versões nem estado pessoal.',
 edition_reader:'Consulta somente o estado pessoal da identidade atual vinculado à versão exata; abrir não implica ler ou compreender.',
 edition_annotate:'Grava posição, cobertura explicitamente confirmada, nota, grifo, solicitação ou resposta pessoal. Âncoras pertencem à representação e versão exatas. Respostas abertas usam autoavaliação, sem IA.',
 edition_groups:'Consulta grupos aceitos e comentários voluntariamente compartilhados. Nunca inclui notas pessoais.',
 edition_group:'Cria grupo privado, emite convite limitado, aceita convite voluntário, sai ou registra comentário na passagem. Revogação retira acesso futuro; não compartilha memória pessoal.',
} satisfies Record<keyof typeof editionSchemas,string>;
const row=z.record(z.string(),z.unknown()),saved=z.object({operation_id:id,status:z.literal('confirmed'),revision}).passthrough();
export const editionOutputs={
 edition_configuration:z.object({config:row}),
 edition_catalog:z.object({items:z.array(row),pagination:row,projects:z.array(row).optional(),recent:row.nullable().optional()}),edition_context:z.union([z.object({project:row,config:row,sources:z.array(row),outline:z.array(row),coverage:row,tasks:z.array(row)}).passthrough(),z.object({version:row,config:row,outline:z.array(row),passage:row,sources:z.array(row),generative_calls_required:z.literal(false)}).passthrough()]),
 edition_reader:z.object({version_id:id,state:row,annotations:z.array(row),preferences:row,coverage_meaning:z.string()}),edition_groups:z.object({items:z.array(row),comments:z.array(row),members:z.array(row),private_notes_included:z.literal(false)}),
 edition_project:saved,edition_source:saved,edition_plan:saved,edition_sample:saved,edition_batch:saved,edition_review:saved,edition_publish:saved,edition_annotate:saved,edition_group:saved,
} satisfies Record<keyof typeof editionSchemas,z.ZodType>;
