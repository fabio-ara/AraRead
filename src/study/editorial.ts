import {z} from 'zod';
const outcome=z.enum(['preserved','not_applicable','uncertain','problem']);
export const editorialReviewSchema=z.object({
 checked_against_original:z.literal(true),method:z.literal('assistant_comparison'),
 checks:z.object({negation:outcome,modality:outcome,conditions:outcome,terminology:outcome,attribution:outcome,context:outcome,coverage:outcome}).strict(),
 rationale:z.string().min(20).max(5000),
 claims:z.array(z.object({kind:z.enum(['explanation','context','interpretation','example','evidence','critical_note']),text:z.string().min(1).max(1500),source_quote:z.string().max(500).optional(),evidence_ids:z.array(z.uuid()).max(12).default([]),status:z.enum(['source_supported','documented','illustrative','hypothesis','uncertain'])}).strict()).max(40),
 limits:z.string().min(1).max(3000),
 continuity_acknowledged:z.boolean().optional(),
}).strict();
export type EditorialReview=z.infer<typeof editorialReviewSchema>;
export function editorialAssessment(original:string,rewrite:string,representation:string,review?:EditorialReview,sourceLanguage='und',targetLanguage='pt-BR'){
 const findings:{code:string;detail:string;severity:'risk'|'problem'}[]=[];
 const normalized=(s:string)=>s.toLocaleLowerCase().normalize('NFC').replace(/[\p{P}\s]+/gu,' ').trim();
 const a=normalized(original),b=normalized(rewrite),same=sourceLanguage.split('-')[0]===targetLanguage.split('-')[0];
 if(same&&representation==='rewrite'){
  const negative=/\b(não|nunca|jamais|not|never|neither|cannot|nenhum)\b/u,alternative=/\b(impossível|insuficiente|ausência|inviável|impossible|insufficient|absence|without|sem)\b/u;
  if(negative.test(a)&&!negative.test(b)&&(!alternative.test(b)||alternative.test(a)))findings.push({code:'NEGATION_RISK',detail:'O original contém negação sem correspondência lexical evidente. Confira o escopo da negação; a heurística não comprova inversão.',severity:'risk'});
  if(/\b(talvez|pode|poderia|may|might|perhaps|possible|possível)\b/u.test(a)&&/\b(sempre|certamente|necessariamente|always|certainly|definitely)\b/u.test(b)&&!/\b(talvez|pode|poderia|may|might|perhaps|possible|possível|não|not)\b/u.test(b))findings.push({code:'MODALITY_RISK',detail:'Uma hipótese pode ter sido transformada em certeza.',severity:'risk'});
  if(/marxian[oa]/u.test(a)&&/marxist[ae]/u.test(a)&&/\b(sinônimos|equivalentes|mesma coisa|synonyms|equivalent)\b/u.test(b)&&!/\b(não|not|distint)/u.test(b))findings.push({code:'CONCEPT_COLLAPSE',detail:'Marxiano e marxista foram possivelmente tratados como equivalentes apesar da distinção local.',severity:'problem'});
  if(/\b(narrador|narrator)\b/u.test(a)&&/\b(não|not)\b/u.test(a)&&/\b(narrador afirma|narrator asserts)\b/u.test(b))findings.push({code:'ATTRIBUTION_RISK',detail:'Confira se uma posição de interlocutor foi atribuída ao narrador.',severity:'risk'});
 }
 if(review){
  for(const [key,value]of Object.entries(review.checks))if(value==='problem'||value==='uncertain')findings.push({code:`DECLARED_${key.toUpperCase()}`,detail:`Confrontação declarou ${value==='problem'?'problema':'incerteza'} em ${key}.`,severity:value==='problem'?'problem':'risk'});
  for(const claim of review.claims){
   if(claim.source_quote&&!original.includes(claim.source_quote))findings.push({code:'QUOTE_NOT_IN_PASSAGE',detail:'Um excerto declarado não corresponde literalmente à passagem.',severity:'problem'});
   if(claim.status==='documented'&&!claim.evidence_ids.length)findings.push({code:'UNDOCUMENTED_ATTRIBUTION',detail:'Afirmação documentada sem referência consultada identificável.',severity:'problem'});
   if(claim.status==='source_supported'&&!claim.source_quote)findings.push({code:'MISSING_TEXTUAL_SUPPORT',detail:'Afirmação atribuída ao original sem excerto verificável nesta passagem.',severity:'risk'});
  }
 }
 return {version:'1',review:review||null,findings,status:findings.some(f=>f.severity==='problem')?'needs_review':review?'ai_compared':'not_compared',ready_to_present:!!review&&!findings.length,verification:'Heurísticas e comparação declarada pelo assistente; não certificam fidelidade acadêmica nem compreensão humana.',original_changed:false};
}
export const editorialPreparation={
 version:'1',purpose:'Explicar a passagem desde seu problema, construindo os pré-requisitos necessários para um leitor iniciante.',
 relevant_dimensions:['problema e argumento','contexto histórico e intelectual documentado','terminologia local e mudanças de sentido','pressupostos e passos implícitos','exemplos com limites','ressalvas, objeções e controvérsias'],
 instructions:'Integre os apoios em prosa fluente sem repetir uma lista. Diferencie texto do autor, comentário documentado, aplicação da IA e hipótese do leitor. Preserve modalidades, negações, condições, ironia e ambiguidades. Uma explicação de ontologia pode começar pelo problema do que significa algo ser, antes de nomear a disciplina. Não substitua marxiano por marxista se o trecho os distingue. Na tradução, preserve termos e tensões sem aplicar lentes. Contexto externo exige fonte consultada ou limite explícito.',
 verification:'Confronte a proposta com o original; declare editorial_review. Refaça riscos antes de reading_display. Limites não podem ser apagados para tornar a explicação mais simples.',
};
