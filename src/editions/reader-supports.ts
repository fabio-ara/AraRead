import {matchingSupport,selectorFromReader} from './presentation.ts';
const el=(tag:string,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
export function attachEditionSupports(v:any,context:any,preferences:any,write?:(action:string,args:any)=>Promise<any>){
 const button=(label:string,action:()=>Promise<void>|void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>void v.run(async()=>{await action();});return b;};
 const kinds=[['definition','Dicionário'],['context','Contexto'],['mnemonic','Memorizar'],['humor','Humor'],['example','Exemplo'],['interpretation','Perspectivas'],['objection','Objeções'],['correction','Correções']];
 for(const [kind,label]of kinds)v.menu.append(button(label,()=>{
  const chosen=v.getSelection();if(!chosen)return;
  const target=selectorFromReader(context.passage.id,chosen.target),result=kind==='mnemonic'&&preferences.mnemonics===false?{item:null,expanded:false,message:'Os apoios de memorização estão desabilitados nas suas preferências.'}:matchingSupport(context.passage.content,target,kind,preferences.humor==='light'),body=el('div');
  if(result.item){
   const s=result.item;body.append(el('h3',s.title));if(result.expanded)body.append(el('p','Este apoio se refere a um trecho maior que sua seleção.'));
   body.append(el('p',s.text),el('small',`${s.attribution} · ${s.nature==='synthetic'?'Material sintético':s.nature==='documented'?'Interpretação documentada':s.nature==='analogy'?'Analogia':s.nature==='hypothesis'?'Hipótese':'Apoio editorial'}`),el('p',s.limits));
   if(s.kind==='correction')body.append(el('p',`Afirmação original: ${s.original_claim}`),el('p',`Correção: ${s.corrected_claim}`),el('p',`Avaliada em ${s.evaluated_at}.`));
   for(const e of context.passage.content.evidence.filter((e:any)=>s.evidence_ids.includes(e.id)))body.append(el('p',`${e.author} — ${e.title}. ${e.edition}. ${e.locator}. ${e.kind==='documented'?`Consulta declarada em ${e.consulted_at}.`:e.kind==='synthetic'?'Evidência sintética.':'Fonte não consultada.'} ${e.limits}`));
  }else {body.append(el('p',result.message));if(write)body.append(button('Solicitar apoio editorial',async()=>{await write('request',{target,text:`Solicito ${label.toLocaleLowerCase()} para este trecho.`});v.announce('Solicitação guardada.');}));}
  v.show(label,body);
 }));
 if(write)v.menu.append(button('Notas',()=>{const chosen=v.getSelection();if(!chosen)return;const text=document.createElement('textarea');text.rows=4;text.maxLength=10000;const label=el('label','Minha nota sobre o trecho'),body=el('div');label.append(text);body.append(label,button('Guardar nota',async()=>{const result=await write('note',{target:selectorFromReader(context.passage.id,chosen.target),text:text.value});v.announce(result.status==='local'?'Nota guardada neste dispositivo; aguarda sincronização.':'Nota pessoal guardada.');}));v.show('Nota pessoal',body);}));
}
