import {randomUUID} from 'node:crypto';
import type {Passage} from '../../src/editions/model.ts';
export const demoRights={status:'original',license:'CC0-1.0',attribution:'AraRead — material sintético de homologação',evidence:'Texto original criado para a demonstração autorizada; sem atribuição a autores reais.',allow_public:true,allow_sharing:true};
export const demoOriginals=[
 'If a lamp is off, the room may be dark; this does not prove that the lamp is broken. The observer proposes a hypothesis, not a certainty. A window may provide light.',
 'One fictional commentator says that measuring twice reduces mistakes. Another warns that a repeated measurement may repeat the same error. This example is not proof of either view.',
 'A tabela antiga afirma que de 1 a.C. a 1 d.C. decorreram dois anos. Na contagem civil sem ano zero, decorreu um ano. A correção vale para essa convenção; não resolve calendários diferentes.',
 '“Que pontualidade!”, diz uma personagem diante de um relógio parado. A fala pode ser irônica, mas o contexto é incompleto. “Banco” pode indicar assento ou instituição. A lacuna não autoriza escolher um sentido com certeza.',
];
const facilitated=[
 'Uma sala pode ficar escura quando a lâmpada está apagada. Isso não basta para concluir que a lâmpada quebrou: ela pode estar apenas desligada. Trata-se de uma hipótese, uma possibilidade a examinar. A luz de uma janela também pode iluminar a sala.',
 'Duas pessoas fictícias discordam sobre repetir uma medição. Uma considera que medir duas vezes ajuda a perceber erros. A outra lembra que o mesmo erro pode ocorrer nas duas medições. O exemplo apresenta a divergência; não prova que alguma posição sempre esteja certa.',
 'A tabela antiga contou dois anos entre 1 a.C. e 1 d.C. Nessa contagem civil não existe ano zero: de um ano ao outro decorre um ano. Essa correção depende da convenção usada; não estabelece a equivalência de outros calendários.',
 'Uma personagem elogia a pontualidade de um relógio parado. Talvez esteja usando ironia: o elogio pode transmitir uma crítica. Como falta contexto, não há certeza. A palavra “banco” também permite sentidos diferentes, como assento ou instituição. A lacuna precisa continuar visível.',
];
const translation=[
 'Se uma lâmpada está apagada, a sala pode estar escura; isso não prova que a lâmpada esteja quebrada. O observador propõe uma hipótese, não uma certeza. Uma janela pode fornecer luz.',
 'Um comentador fictício diz que medir duas vezes reduz erros. Outro adverte que uma medição repetida pode repetir o mesmo erro. Este exemplo não é prova de nenhuma das duas posições.',
];
export function demoPassage(index:number,ref:any):Passage{
 const exact=demoOriginals[index],target={representation:'original' as const,segment_id:ref.element_id,start:0,end:Array.from(exact).length,exact,prefix:'',suffix:''};
 const support=(kind:any,title:string,text:string,extra:any={})=>({id:randomUUID(),kind,title,text,target,evidence_ids:[],attribution:'Edição sintética AraRead',nature:'synthetic' as const,limits:'Recurso didático sintético; não é evidência científica.',...extra});
 const evidenceId=randomUUID();
 return {key:randomUUID(),chapter:index<2?'1. Hipóteses e evidências':'2. Datas e sentidos',title:['A luz da sala','Duas medidas','Um intervalo civil','O relógio e o banco'][index],ordinal:index,refs:[ref],segments:[{id:randomUUID(),representation:'facilitated',language:'pt-BR',text:facilitated[index],refs:[ref]},...(index<2?[{id:randomUUID(),representation:'translation' as const,language:'pt-BR',text:translation[index],refs:[ref]}]:[])],
 supports:[support('definition','Hipótese','Uma possibilidade que precisa ser examinada, sem se tornar certeza por ter sido formulada.'),support('context','O limite do exemplo','Estas situações foram inventadas para comparar afirmação, hipótese e evidência.'),support('example','Outra possibilidade','Um aparelho silencioso pode estar desligado; o silêncio sozinho não comprova defeito.'),support('mnemonic','Lembrar a condição','Lembre “se, então, conferir”: conserve a condição antes de avaliar a conclusão.'),support('humor','A lâmpada testemunha','A lâmpada apagada ainda não prestou depoimento sobre a causa da escuridão.'),
 ...(index===1?[support('interpretation','Perspectiva sintética A','A repetição pode revelar diferenças entre observações.',{attribution:'Comentador sintético A'}),support('objection','Perspectiva sintética B','O mesmo método pode repetir um erro; a objeção não está resolvida.',{attribution:'Comentador sintético B'})]:[]),
 ...(index===2?[support('correction','Correção da tabela','A tabela preservada contém um erro na contagem civil.',{evidence_ids:[evidenceId],original_claim:'Decorreram dois anos.',corrected_claim:'Decorreu um ano na convenção sem ano zero.',evaluated_at:'2026-10-28'})]:[])],
 activities:[{id:randomUUID(),kind:'choice',question:'Abrir esta passagem comprova compreensão?',options:['Sim','Não'],answer:'Não',feedback:'Abertura, cobertura confirmada e compreensão são coisas distintas.',criteria:''},{id:randomUUID(),kind:'open',question:'Qual limite do exemplo você conservaria?',options:[],answer:'Conservar a condição e a ausência de prova suficiente.',feedback:'Compare sua resposta com o argumento, sem assumir avaliação automática do significado.',criteria:'Verifique se distinguiu hipótese, evidência e conclusão.'}],
 evidence:index===2?[{id:evidenceId,title:'Convenção civil da fixture sintética',author:'AraRead',edition:'Homologação',locator:'Capítulo 2',excerpt:'Na contagem civil sem ano zero, decorreu um ano.',consulted_at:'2026-10-28',kind:'synthetic',limits:'Convenção explicitamente definida no material de teste, sem atribuição acadêmica.'}]:[],
 review:{checked_against_original:true,method:'assistant_comparison',checks:{negation:'preserved',modality:'preserved',conditions:'preserved',terminology:'preserved',attribution:'preserved',context:'preserved',coverage:'preserved'},rationale:'Comparação declarada do material sintético, com condições, negações, atribuições e limites preservados.',claims:[],limits:'Fixture sintética de homologação. Não representa aprovação acadêmica humana.'},provenance:{agent:'Fixture sintética AraRead',limits:'Conteúdo original de teste; sem alegação de eficácia educacional.'}};
}
export async function prepareDemo(call:(name:string,args:any)=>Promise<any>,title='Aprender a examinar uma hipótese — demonstração AraRead',visibility='public'){
 const imported:any[]=[],content:Passage[]=[];
 for(const [i,language]of ['en','pt-BR'].entries()){
  const s=await call('source_import',{operation_id:randomUUID(),title:`${title} · ${language}`,author:'AraRead',original_language:language,partial:false,format:'structured',blocks:demoOriginals.slice(i*2,i*2+2).map(text=>({kind:'paragraph',text,meta:{}}))});imported.push(s);
  for(const item of (await call('source_elements',{reading_id:s.reading_id,limit:50})).items)content.push(demoPassage(content.length,item.full_ref));
 }
 let p=await call('edition_project',{operation_id:randomUUID(),expected_revision:0,action:'create',title,author:'AraRead',rights:demoRights,synthetic:true,topics:['Hipótese','Evidência'],traditions:['Comparação sintética']});
 const edit=(args:any)=>({operation_id:randomUUID(),project_id:p.project_id,expected_revision:p.revision,...args});
 for(const s of imported)p={...p,...await call('edition_source',edit({source_id:s.source_id}))};
 const plan=await call('edition_plan',{operation_id:randomUUID(),expected_revision:0,project_id:p.project_id,scope:'project',action:'set',values:{language:'pt-BR'},explicit_request:true});p.revision=plan.project_revision;
 p={...p,...await call('edition_sample',edit({action:'prepare',passage:content[0],reason:'A passagem exige distinguir hipótese, condição e evidência.'}))};
 p={...p,...await call('edition_sample',edit({action:'approve',reason:'Aprovação simulada somente na fixture sintética autorizada.',decision_origin:'synthetic_fixture'}))};
 p={...p,...await call('edition_batch',edit({passages:content.slice(1)}))};
 const context=await call('edition_context',{project_id:p.project_id});
 p={...p,...await call('edition_review',edit({passage_ids:context.outline.map((x:any)=>x.id),decision:'accepted',note:'Conferência sintética do alinhamento, condições, atribuições e atividades.'}))};
 const version=await call('edition_publish',edit({action:'publish',visibility,note:'Edição demonstrativa de conteúdo original autorizada para homologação.'}));
 return {project_id:p.project_id,revision:version.revision,version_id:version.version_id,content,imported,title};
}
