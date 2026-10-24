import {z} from 'zod';

// Shared study selectors contain configuration, never inferred personal traits.
export const studySelection=z.object({
 representation:z.enum(['rewrite','translation']).optional(),support_mode:z.enum(['brief','standard','extended']).optional(),
 perspective_id:z.uuid().nullable().optional(),include_notes:z.boolean().optional(),note_ids:z.array(z.uuid()).max(40).optional(),
 repertoire:z.string().max(1200).optional(),goal:z.string().max(1200).optional(),
 provider:z.string().max(100).optional(),model:z.string().max(100).optional(),
}).strict();
const write={operation_id:z.uuid()},revision={...write,reading_id:z.uuid(),expected_revision:z.number().int().nonnegative()};
const page={offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(50).default(20)};
const ref=z.object({source_id:z.uuid(),element_id:z.uuid(),start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict();
const ids=z.array(z.uuid()).max(40).default([]);
export const citationUrl=z.url().max(2000).refine(s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'Referências aceitam apenas links HTTP/HTTPS sem credenciais.');
export const citationSchema=z.object({title:z.string().min(1).max(500),author:z.string().max(500).default(''),year:z.string().max(40).default(''),edition:z.string().max(200).default(''),translation:z.string().max(200).default(''),url:citationUrl.optional(),doi:z.string().max(200).optional(),kind:z.enum(['book','article','dictionary','web','local','commentary']).default('book'),locator:z.string().max(500).default(''),excerpt:z.string().max(16000).default(''),consulted_at:z.iso.date().nullable().default(null),access:z.enum(['available','suggested','unavailable']).default('suggested'),license:z.string().max(300).default('')}).strict();
export const termDetails=z.object({original_term:z.string().max(200).optional(),equivalent:z.string().max(200).optional(),alternatives:z.array(z.string().max(400)).max(8).default([]),etymology:z.string().max(2000).optional(),memory_aid:z.string().max(2000).optional(),construction:z.string().max(2000).optional(),evidence_ids:ids,derived_from:z.uuid().optional()}).strict();
export const studySchemas={
 source_append:z.object({...revision,text:z.string().min(1).max(2000000).optional(),format:z.enum(['text','markdown','structured']).default('text'),blocks:z.array(z.object({kind:z.string().min(1).max(60),text:z.string().min(1).max(100000),locator:z.string().max(200).optional(),meta:z.record(z.string(),z.unknown()).default({})})).min(1).max(20000).optional(),origin:z.string().min(1).max(2000).default('user_provided'),partial:z.boolean().default(true)}).strict(),
 reference_save:z.object({...revision,...citationSchema.shape}).strict(),
 perspective_save:z.object({...revision,name:z.string().min(1).max(200),kind:z.enum(['commentator','tradition','approach','notebook']),scope:z.string().min(1).max(2000),description:z.string().max(4000).default(''),evidence_ids:ids,previous_id:z.uuid().optional(),declared_author:z.string().max(200).default(''),usage_terms:z.string().max(1000).default('Private; no redistribution permission inferred')}).strict(),
 context_prepare:z.object({...revision,ref,language:z.string().min(2).max(80).refine(s=>{try{return !!Intl.getCanonicalLocales(s)[0];}catch{return false;}},'Use um idioma BCP 47 válido.').optional(),selection:studySelection.default({})}).strict(),
 note_manage:z.object({...revision,note_id:z.uuid(),action:z.enum(['activate','deactivate','delete','link']),ref:ref.optional()}).strict(),
 connection_save:z.object({...revision,ref,target_reading_id:z.uuid(),target_ref:ref,kind:z.enum(['analogy','contrast','application','formal','influence']),origin:z.enum(['reader','assistant','documented']),problem:z.string().min(1).max(3000),limits:z.string().min(1).max(3000),evidence_ids:ids}).strict(),
 study_catalog:z.object({reading_id:z.uuid(),kind:z.enum(['references','perspectives','connections','contexts','notes']),query:z.string().max(200).default(''),...page}).strict(),
 notebook_export:z.object({reading_id:z.uuid(),notebook_id:z.uuid(),note_ids:z.array(z.uuid()).min(1).max(50)}).strict(),
 notebook_import:z.object({...revision,bundle:z.unknown()}).strict(),
 correction_save:z.object({...revision,ref,mediation_id:z.uuid(),problem:z.string().min(1).max(4000),evidence_ids:ids}).strict(),
 lexicon_lookup:z.object({reading_id:z.uuid(),term:z.string().trim().min(1).max(120),language:z.enum(['pt','en','fr','es','de','el','la']).default('pt'),consult_external:z.boolean().default(false)}).strict(),
} as const;
export const studyReadTools=['study_catalog','notebook_export','lexicon_lookup'];
export const studyDescriptions:Record<keyof typeof studySchemas,string>={
 source_append:'Acrescenta material autorizado ao fim da MESMA leitura como segmento imutável, sem mover referências antigas nem marcar novas porções. Revisão e recibo obrigatórios.',
 reference_save:'Guarda referência bibliográfica e trecho disponível, inclusive livro sem URL. consulted_at exige trecho e localizador; é declaração de consulta, não certificação de verdade.',
 perspective_save:'Cria versão imutável de perspectiva ou caderno privado, com escopo e referências próprias. Não simula identidade nem inventa posições de um autor.',
 context_prepare:'Prepara contexto limitado e registra IDs/versões efetivamente disponibilizados, assinatura e lacunas. Retorna source, notas/termos/fontes selecionados; não avança. Use context_id ao salvar nova variante.',
 note_manage:'Seleciona/desativa nota para contexto, vincula comentário pendente a uma referência exata ou exclui nota e variantes derivadas. Exclusão é explícita e distinta de desativação.',
 connection_save:'Relaciona duas passagens próprias com problema, natureza, origem, evidência e limite; não altera progresso. Influência histórica e relação formal exigem apoio disponível.',
 study_catalog:'Busca catálogo privado paginado de referências, perspectivas/cadernos, relações, contextos ou notas; não altera posições.',
 notebook_export:'Prepara pacote seletivo de comentários escolhidos de um caderno, com prévia. Não exporta biblioteca, originais, progresso ou notas não selecionadas. Sem download automático.',
 notebook_import:'Importa caderno como cópia atribuída privada e inativa. Só alinha automaticamente por hash exato da edição/elemento e intervalos válidos; demais comentários ficam pendentes.',
 correction_save:'Registra problema em mediação e sinaliza dependentes para reexame; preserva original e histórico. Correção efetiva é nova mediation_save com supersedes.',
 lexicon_lookup:'Recupera primeiro termos já salvos da leitura. Opcionalmente consulta Wikcionário público com atribuição; retorna texto não confiável, data, revisão e links de pesquisa filosófica. Não inventa etimologia nem grava automaticamente.',
};
