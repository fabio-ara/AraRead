import {z} from 'zod';
import {citationSchema,studySelection} from './contracts.ts';
const language=z.string().min(2).max(80).refine(s=>{try{return !!Intl.getCanonicalLocales(s)[0];}catch{return false;}});
export const parameterSchemas={language,portion_size:z.enum(['short','medium','long']),support_mode:z.enum(['brief','standard','extended']),include_notes:z.boolean(),repertoire:z.string().max(1200),goal:z.string().max(1200),active_profile:z.uuid().nullable(),perspective_id:z.uuid().nullable()};
export type Parameter=keyof typeof parameterSchemas;
export const parameterDefaults:Record<Parameter,unknown>={language:'pt-BR',portion_size:'medium',support_mode:'standard',include_notes:true,repertoire:'',goal:'',active_profile:null,perspective_id:null};
export const parameterDescriptions:Record<Parameter,string>={language:'Idioma de leitura em etiqueta BCP 47, como pt-BR. Não altera o original.',portion_size:'Extensão da porção: short, medium ou long. Blocos atômicos preservam integridade.',support_mode:'Extensão dos apoios: brief, standard ou extended. Não autoriza omitir premissas essenciais.',include_notes:'true inclui notas selecionadas disponíveis; false retira sua influência nesta preparação.',repertoire:'Repertório declarado pelo leitor, até 1200 caracteres. Nunca inferido de perguntas.',goal:'Objetivo declarado de estudo, até 1200 caracteres. Vazio retira o objetivo neste escopo.',active_profile:'UUID de perfil privado ativo ou null para não usar perfil. Seleção não implica adesão pessoal.',perspective_id:'UUID de perspectiva dessa leitura ou null. Não pertence ao escopo geral da conta.'};
export const preferenceValues=z.object(Object.fromEntries(Object.entries(parameterSchemas).map(([k,v])=>[k,v.optional()])) as z.ZodRawShape).strict();
const write={operation_id:z.uuid(),expected_revision:z.number().int().nonnegative()},scope={reading_id:z.uuid().optional(),scope:z.enum(['account','reading','session']).optional()};
const lens=z.object({id:z.uuid(),name:z.string().min(1).max(200),nature:z.enum(['author_position','documented_commentary','tradition','ai_application','reader_hypothesis']),scope:z.string().min(1).max(2000),period:z.string().max(200).default(''),limits:z.string().min(1).max(2000),sources:z.array(citationSchema).max(12)}).strict();
export const profileDefinition=z.object({values:preferenceValues.default({}),lenses:z.array(lens).max(12),conflicts:z.array(z.string().min(1).max(2000)).max(20),compatibility:z.enum(['not_assessed','declared']),limits:z.string().min(1).max(3000)}).strict();
export const profileBundle=z.object({format:z.literal('araread-profile/1'),name:z.string().min(1).max(200),definition:profileDefinition,declared_author:z.string().min(1).max(200),usage_terms:z.string().min(1).max(2000),reviewed_for_sharing:z.literal(true)}).strict();
export const preferenceSchemas={
 preferences_catalog:z.object({}).strict(),
 preferences_get:z.object({reading_id:z.uuid().optional(),operation:preferenceValues.optional()}).strict(),
 preferences_set:z.object({...write,...scope,values:preferenceValues.optional(),explicit_request:z.boolean().default(false),language:language.nullable().optional(),portion_size:parameterSchemas.portion_size.optional(),study:studySelection.optional()}).strict(),
 preferences_unset:z.object({...write,...scope,keys:z.array(z.enum(Object.keys(parameterSchemas) as [Parameter,...Parameter[]])).min(1).max(8),action:z.enum(['unset','delete','disable','enable','reset'])}).strict(),
 profile_save:z.object({...write,name:z.string().min(1).max(200),definition:profileDefinition,previous_id:z.uuid().optional(),declared_author:z.string().min(1).max(200),usage_terms:z.string().min(1).max(2000),explicit_request:z.literal(true)}).strict(),
 profile_get:z.object({profile_id:z.uuid().optional()}).strict(),
 profile_manage:z.object({...write,profile_id:z.uuid(),action:z.enum(['disable','enable','delete'])}).strict(),
 profile_export:z.object({profile_id:z.uuid(),lens_ids:z.array(z.uuid()).max(12),include_values:z.boolean().default(false),declared_author:z.string().min(1).max(200),usage_terms:z.string().min(1).max(2000),reviewed_for_sharing:z.literal(true)}).strict(),
 profile_import:z.object({...write,bundle:profileBundle,explicit_request:z.literal(true)}).strict(),
};
export const preferenceReadTools=['preferences_catalog','preferences_get','profile_get','profile_export'] as const;
export const preferenceDescriptions={
 preferences_catalog:'Lista parâmetros configuráveis versionados, padrões, escopos e regras de privacidade. Nenhuma preferência sensível é inferida.',
 preferences_get:'Mostra preferências, valor efetivo, origem, escopo, estado e caráter temporário. Ordem: operação > sessão autenticada > leitura > perfil > conta > padrão.',
 preferences_set:'Registra escolha explícita da conta, leitura ou sessão atual. values aceita parâmetros do catálogo; valores interpretativos exigem explicit_request. Usa revisão da leitura se reading_id; caso contrário revisão da conta.',
 preferences_unset:'unset remove a substituição; delete apaga definição; disable conserva valor sem influência; enable reativa; reset aplica padrão mascarando níveis inferiores. Exige revisão e recibo. Não apaga notas/progresso.',
 profile_save:'Cria versão privada de perfil reutilizável, com lentes, natureza, fontes consultadas, limites, conflitos, autoria e condições de uso. explicit_request confirma solicitação; nunca infere adesão pessoal.',
 profile_get:'Consulta versões de perfis privados, sem ativar ou inferir preferência. Sem ID lista até 50 versões recentes.',
 profile_manage:'Desativa, reativa ou exclui explicitamente um perfil próprio. Notas e progresso permanecem. Seleção usa preferences_set active_profile no escopo desejado.',
 profile_export:'Prepara pacote opt-in somente das lentes escolhidas e valores autorizados, após revisão para compartilhamento e termos declarados. Não publica nem acessa outra conta.',
 profile_import:'Importa pacote revisado como cópia privada inativa e atribuída. Autorias/consulta são declarações, não certificadas. Ativação e seleção exigem comandos explícitos posteriores.',
};
const anyObject=z.record(z.string(),z.unknown());
export const preferenceOutputs:Record<keyof typeof preferenceSchemas,z.ZodType>={preferences_catalog:anyObject,preferences_get:anyObject,preferences_set:anyObject,preferences_unset:anyObject,profile_save:anyObject,profile_get:anyObject,profile_manage:anyObject,profile_export:anyObject,profile_import:anyObject};
