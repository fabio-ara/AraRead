import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assessPassage,checkSelection,originalSegments,activityFeedback,editionCoverage,type Passage} from '../src/editions/model.ts';
import {matchingSupport} from '../src/editions/presentation.ts';
import {contentHash} from '../src/ingestion/quality.ts';

function fixture(text:string,rewrite=text,language='pt-BR'){
 const source=randomUUID(),element=randomUUID(),ref={source_id:source,element_id:element,start:0,end:Array.from(text).length};
 const sources=[{id:source,metadata:{original_language:language},blocks:[{id:element,source_id:source,ordinal:0,kind:'paragraph',text,meta:{}}]}];
 const passage:Passage={key:randomUUID(),chapter:'Adversarial',title:'Passagem sintética',ordinal:0,refs:[ref],segments:[{id:randomUUID(),representation:'facilitated',language:'pt-BR',text:rewrite,refs:[ref]}],supports:[],activities:[],evidence:[],review:{checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'preserved',coverage:'preserved'},rationale:'Confrontação sintética controlada; os limites são declarados por teste, sem alegar avaliação humana.',claims:[],limits:'A aprovação estrutural não prova equivalência de significado.'},provenance:{agent:'Teste sintético',limits:'Sem alegação de eficácia educacional.'}};
 return {sources,passage,ref};
}
test('matriz adversarial editorial: riscos, limites e original imutável',async t=>{
 const cases=[
  {name:'negação',text:'O autor não afirma que a tese foi provada.',rewrite:'O autor afirma que a tese foi provada.',code:'NEGATION_RISK'},
  {name:'hipótese',text:'O resultado pode mudar.',rewrite:'O resultado certamente muda.',code:'MODALITY_RISK'},
  {name:'condição',text:'Se a premissa mudar, a conclusão pode mudar.',check:'conditions',code:'DECLARED_CONDITIONS'},
  {name:'ironia',text:'“Que pontualidade!”, diz a personagem diante do relógio parado.',check:'context',code:'DECLARED_CONTEXT'},
  {name:'ambiguidade',text:'A fala pode admitir dois sentidos; o contexto não permite escolher.',check:'context',code:'DECLARED_CONTEXT'},
  {name:'atribuição a terceiro',text:'A personagem afirma isso; o narrador não assume essa posição.',rewrite:'O narrador afirma essa posição.',code:'ATTRIBUTION_RISK'},
  {name:'objeção não respondida',text:'A objeção foi registrada e ainda não recebeu resposta.',check:'context',code:'DECLARED_CONTEXT'},
  {name:'polissemia',text:'Banco pode indicar assento ou instituição financeira.',check:'terminology',code:'DECLARED_TERMINOLOGY'},
  {name:'lacuna documental',text:'O documento está incompleto; a segunda premissa não foi conservada.',check:'coverage',code:'DECLARED_COVERAGE'},
 ];
 for(const item of cases)await t.test(item.name,()=>{const f=fixture(item.text,item.rewrite);if(item.check)(f.passage.review.checks as any)[item.check]='uncertain';const before=structuredClone(f.sources),result=assessPassage(f.passage,f.sources,'pt-BR');assert.equal(result.ready,false);assert(result.findings.some(r=>r.code===item.code));assert.deepEqual(f.sources,before);});
 await t.test('exemplo ilustrativo não constitui prova',()=>{const f=fixture('Um caso imaginário ilustra a hipótese; não a prova.');f.passage.review.claims=[{kind:'example',text:'Imagine um segundo caso.',status:'illustrative',evidence_ids:[]}];assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,true);assert.equal(f.passage.review.claims[0].status,'illustrative');});
 await t.test('traduções alternativas conservam alinhamentos próprios',()=>{const f=fixture('The bank may be closed.','A palavra pode designar banco ou margem; o contexto é insuficiente.','en');for(const text of ['O banco pode estar fechado.','A margem pode estar fechada.'])f.passage.segments.push({id:randomUUID(),representation:'translation',language:'pt-BR',text,refs:[f.ref]});assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,true);assert.equal(new Set(f.passage.segments.map(s=>s.id)).size,3);assert.match(originalSegments(f.passage,f.sources)[0].text,/bank/);});
 await t.test('correção de informação desatualizada exige evidência e limites',()=>{const f=fixture('A tabela antiga inclui ano zero na contagem civil.'),evidence=randomUUID();f.passage.supports=[{id:randomUUID(),kind:'correction',title:'Convenção da fixture',text:'Nesta convenção sintética não há ano zero.',target:{representation:'original',segment_id:f.ref.element_id,start:0,end:f.ref.end,exact:f.sources[0].blocks[0].text,prefix:'',suffix:''},evidence_ids:[],attribution:'Fixture sintética',nature:'synthetic',limits:'Não abrange outras convenções.',original_claim:'Há ano zero.',corrected_claim:'Não há ano zero nesta convenção.',evaluated_at:'2026-10-28'}];assert.throws(()=>assessPassage(f.passage,f.sources,'pt-BR'),{code:'MISSING_EVIDENCE'});f.passage.evidence=[{id:evidence,title:'Convenção explícita de teste',author:'Fixture',edition:'1',locator:'Regra 1',excerpt:'Não há ano zero.',consulted_at:null,kind:'synthetic',limits:'Material sintético.'}];f.passage.supports[0].evidence_ids=[evidence];assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,true);assert.equal(f.sources[0].blocks[0].text,'A tabela antiga inclui ano zero na contagem civil.');});
});
test('alinhamento muitos-para-muitos e citações pertencem à passagem integral',()=>{
 const f=fixture('Uma hipótese.'),second=randomUUID(),text='Não é uma certeza.';f.sources[0].blocks.push({id:second,source_id:f.ref.source_id,ordinal:1,kind:'paragraph',text,meta:{}});
 const ref={source_id:f.ref.source_id,element_id:second,start:0,end:Array.from(text).length};f.passage.refs.push(ref);f.passage.segments.push({id:randomUUID(),representation:'facilitated',language:'pt-BR',text,refs:[ref]});
 f.passage.review.claims=[{kind:'explanation',text:'A hipótese permanece aberta.',source_quote:'Uma hipótese.',status:'source_supported',evidence_ids:[]}];
 assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,true);
 f.passage.segments=[{id:randomUUID(),representation:'facilitated',language:'pt-BR',text:'Uma hipótese não é uma certeza.',refs:[f.ref,ref]}];assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,true);
 f.passage.review.claims[0].source_quote='Citação inventada.';assert.equal(assessPassage(f.passage,f.sources,'pt-BR').ready,false);
});
test('seleções Unicode distinguem ocorrências, grifos completos e menor apoio',()=>{
 const text='banco 👩‍🔬 e banco é',f=fixture(text),chars=Array.from(text),start=12,end=17;
 const selection={representation:'original' as const,segment_id:f.ref.element_id,start,end,exact:chars.slice(start,end).join(''),prefix:chars.slice(Math.max(0,start-32),start).join(''),suffix:chars.slice(end,end+32).join('')};
 // Localização calculada em pontos de código, sem transferir índice UTF-16.
 const second=chars.join('').lastIndexOf('banco'),pointStart=Array.from(text.slice(0,second)).length;selection.start=pointStart;selection.end=pointStart+5;selection.exact='banco';selection.prefix=chars.slice(Math.max(0,pointStart-32),pointStart).join('');selection.suffix=chars.slice(pointStart+5,pointStart+37).join('');checkSelection(f.passage,f.sources,selection);
 assert.throws(()=>checkSelection(f.passage,f.sources,{...selection,start:0,end:5}),{code:'INVALID_SELECTION'});
 const full={...selection,start:0,end:chars.length,exact:text,prefix:'',suffix:''},base={kind:'definition' as const,title:'Sentido',text:'Sentido preparado nesta ocorrência.',evidence_ids:[],attribution:'Teste',nature:'synthetic' as const,limits:'Fixture.'};
 f.passage.supports=[{...base,id:randomUUID(),target:full},{...base,id:randomUUID(),target:selection}];assert.equal(matchingSupport(f.passage,selection,'definition').item.id,f.passage.supports[1].id);
 const emojiStart=6;assert.throws(()=>checkSelection(f.passage,f.sources,{...selection,start:emojiStart,end:emojiStart+1,exact:chars[emojiStart],prefix:chars.slice(0,emojiStart).join(''),suffix:chars.slice(emojiStart+1,emojiStart+33).join('')}),{code:'INVALID_SELECTION'});
});
test('resposta aberta registra autoavaliação, sem julgar significado',()=>{const result=activityFeedback({id:randomUUID(),kind:'open',question:'Qual limite?',options:[],answer:'Uma referência.',feedback:'Compare pelos critérios.',criteria:'Preservar a condição.'},'Minha explicação','partial');assert.equal(result.correct,null);assert.equal(result.self_assessment,'partial');assert.equal(result.generative_call,false);});

test('cobertura Unicode identifica lacuna e sobreposição entre passagens sem duplicar caracteres',()=>{
 const f=fixture('A😀BC'),left={...f.passage,refs:[{...f.ref,end:2}]},right={...f.passage,key:randomUUID(),refs:[{...f.ref,start:2}]};
 assert.deepEqual(editionCoverage([right,left],f.sources),{total:4,covered:4,complete:true,missing:[],overlap:[],meaning:'Cobertura de texto canônico, não compreensão nem fidelidade intelectual.'});
 const gap=editionCoverage([left,{...right,refs:[{...f.ref,start:3}]}],f.sources);assert.equal(gap.complete,false);assert.deepEqual(gap.missing,[{...f.ref,start:2,end:3}]);assert.equal(gap.covered,3);
 const overlap=editionCoverage([left,{...right,refs:[{...f.ref,start:1}]}],f.sources);assert.equal(overlap.complete,false);assert.equal(overlap.overlap.length,1);assert.equal(overlap.covered,4);
});

test('hash editorial resiste à ordem das chaves JSONB e continua sensível ao conteúdo e à ordem da fonte',()=>{
 const original={segments:[{text:'Não é certeza.',language:'pt-BR',refs:[{start:0,end:14}]}],key:'fixture'};
 const returned={key:'fixture',segments:[{refs:[{end:14,start:0}],language:'pt-BR',text:'Não é certeza.'}]};
 assert.equal(contentHash(original),contentHash(returned));
 assert.notEqual(contentHash(original),contentHash({...returned,segments:[{...returned.segments[0],text:'É certeza.'}]}));
 assert.notEqual(contentHash(['a','b']),contentHash(['b','a']));
});
