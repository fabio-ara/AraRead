import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {portion,cp,sentenceBoundaries,passageInfo,legacyPortion,type Element} from '../src/anchors.ts';
const element=(text:string,kind='paragraph'):Element=>({id:randomUUID(),source_id:randomUUID(),ordinal:1,kind,text,locator:'Parágrafo 2',meta:{language:'pt-BR'}});
test('padrão preserva parágrafo de 2777 pontos de código com construção parentética',()=>{
 const begin='Uma proposta (',end='; continuação das “ideias” e das “formas”.) Encerramento.';
 const e=element(begin+'x'.repeat(2777-cp(begin+end).length)+end);assert.equal(portion(e).end,2777);
});
test('short só divide depois da construção completa, incluindo aspas e parênteses',()=>{
 const a='Ela disse: “Uma proposta ('+'observação; '.repeat(90)+'fim da observação).” ',e=element(a+'Uma sentença final. '.repeat(100));
 const p=portion(e,0,'short');assert.equal(p.end,cp(a).length);
});
test('versos permanecem atômicos',()=>{const e=element(('Verso aberto;\nOutro verso.\n').repeat(100),'verse');assert.equal(portion(e,0,'short').end,cp(e.text).length);});
test('abreviaturas, iniciais, datas, decimais e reticências não viram finais artificiais',()=>{
 const text='Dr. A. B. Silva nasceu em 1.2.1900 e mediu 3.14 unidades; hesitou... depois concluiu. Próxima sentença!';
 const limits=sentenceBoundaries(text).boundaries;assert.deepEqual(limits,[0,cp(text.slice(0,text.indexOf('Próxima'))).length,cp(text).length]);
});
test('aspas tipográficas, parênteses aninhados e finais acompanhados de fechamento',()=>{
 const a='Ela disse: “Uma ideia (com uma ressalva [ainda provisória!]).” ',text=a+'Outra ideia.';
 assert.deepEqual(sentenceBoundaries(text).boundaries,[0,cp(a).length,cp(text).length]);
});
test('Unicode, RTL e línguas sem espaço têm reconstrução exata e fronteiras de grafema',()=>{
 for(const text of [('Ação é 👩🏽‍🔬 👨‍👩‍👧‍👦. العربية كلام! עברית. ').repeat(100),('这是一个句子。これは文です！다음 문장입니다. ').repeat(100),('Sentença sem fim '+'x'.repeat(500)).repeat(20)]){
  const e=element(text),graphs=new Set([0]);let pos=0;for(const g of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)){pos+=cp(g.segment).length;graphs.add(pos);}
  let start=0,joined='';while(start<cp(text).length){const ref=portion(e,start,'short');assert.ok(ref.end>start);assert.ok(graphs.has(ref.end));joined+=cp(text).slice(ref.start,ref.end).join('');start=ref.end;}assert.equal(joined,text);
 }
});
test('estruturas protegidas e fonte incompleta conservam todos os caracteres sem exigir ponto final',()=>{
 for(const kind of ['code','equation','table','proof','verse','heading']){const e=element('Conteúdo; sem fecho\n'.repeat(400),kind);assert.equal(portion(e,0,'short').end,cp(e.text).length);assert.equal(passageInfo(e,portion(e)).is_fragment,false);}
 const incomplete=element('Uma construção ('+'sem fechamento; '.repeat(500));assert.equal(portion(incomplete,0,'short').end,cp(incomplete.text).length);assert.equal(passageInfo(incomplete,portion(incomplete)).unclosed_source_structure,true);
});
test('posição legada tem continuidade explícita e algoritmo histórico permanece identificado',()=>{
 const e=element('Observação ('+'encadeada; '.repeat(300)+') fim.'),old=legacyPortion(e);
 assert.ok(old.end<cp(e.text).length);assert.equal(passageInfo(e,old).ends_mid_unit,true);assert.equal(passageInfo(e,old).reason,'existing_or_explicit_interval');
 const remainder=portion(e,old.end);assert.equal(remainder.start,old.end);assert.equal(passageInfo(e,remainder).starts_mid_unit,true);
 assert.throws(()=>portion(e,cp(e.text).length));
});
