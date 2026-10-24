import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editorialAssessment,editorialReviewSchema} from '../src/study/editorial.ts';
const review=editorialReviewSchema.parse({checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'not_applicable',coverage:'preserved'},rationale:'Confrontação sintética explícita, sem reivindicação de revisão humana.',claims:[],limits:'Exemplo sintético; teste estrutural, não avaliação humana.'});
const cases=[
 {genre:'filosofia',source:'O narrador não afirma a tese do interlocutor.',bad:'O narrador afirma a tese do interlocutor.',risk:'NEGATION_RISK'},
 {genre:'ciência',source:'A hipótese pode explicar a observação.',bad:'A hipótese sempre explica a observação.',risk:'MODALITY_RISK'},
 {genre:'matemática',source:'Se x não é zero, dividir por x é permitido.',bad:'Dividir por x é sempre permitido.',risk:'NEGATION_RISK'},
 {genre:'terminologia',source:'Marxiano e marxista têm usos distintos neste argumento.',bad:'Marxiano e marxista são sinônimos.',risk:'CONCEPT_COLLAPSE'},
 {genre:'poesia',source:'Não chamo toda noite de ausência.',bad:'Chamo toda noite de ausência.',risk:'NEGATION_RISK'},
 {genre:'ontologia sintética',source:'Perguntar pelo ser não equivale a listar os objetos que existem.',bad:'Perguntar pelo ser equivale a listar os objetos que existem.',risk:'NEGATION_RISK'},
];
for(const c of cases)test(`sinaliza risco editorial: ${c.genre}`,()=>{const report=editorialAssessment(c.source,c.bad,'rewrite',review,'pt-BR','pt-BR');assert.ok(report.findings.some(f=>f.code===c.risk));assert.equal(report.ready_to_present,false);});
test('comparação exige excerto real e evidência de atribuição, sem certificar verdade',()=>{
 const bad={...review,claims:[{kind:'context' as const,text:'Comentador adota a tese.',status:'documented' as const,evidence_ids:[],source_quote:'excerto inexistente'}]};const r=editorialAssessment('A tese é uma possibilidade.','A tese pode valer.','rewrite',bad,'pt','pt');assert.ok(r.findings.some(f=>f.code==='UNDOCUMENTED_ATTRIBUTION'));assert.ok(r.findings.some(f=>f.code==='QUOTE_NOT_IN_PASSAGE'));assert.equal(r.status,'needs_review');
});
test('tradução entre idiomas não aplica correspondência lexical ingênua; legado não vira revisado',()=>{
 assert.equal(editorialAssessment('It is not certain.','Não é certo.','translation',review,'en','pt-BR').ready_to_present,true);
 assert.equal(editorialAssessment('Uma afirmação.','Uma afirmação.','rewrite').ready_to_present,false);
});
