import {calculate,type CivilYear} from './calculator.ts';
import type {ReaderAdapter} from './reader-view.ts';
type View={show:(title:string,body:HTMLElement)=>void;announce:(message:string)=>void;getSelection:()=>any;menu:HTMLElement;run:(fn:()=>Promise<void>)=>Promise<void>;display:any;adapter:ReaderAdapter};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const button=(text:string,fn:()=>unknown)=>{const b=el('button',text);b.type='button';b.onclick=()=>void fn();return b;};
function field(title:string,input:HTMLElement){const label=el('label',title);input.setAttribute('aria-label',title);label.append(input);return label;}
function choices(items:[string,string][],value:string){const s=el('select');for(const [key,name]of items){const o=el('option',name);o.value=key;s.append(o);}s.value=value;return s;}
function question(v:View,chosen:any,language:string){
 const text=`Explique o sentido de “${chosen.exact}” nesta passagem de ${v.display.work.title}, no idioma ${language}. Distinga interpretação contextual, definição geral e fontes realmente consultadas. Não avance a leitura nem grave sem meu pedido.`,payload={reading_id:v.display.reading.id,ref:v.display.ref,language,selection:chosen.target};
 const body=el('div'),input=el('textarea');input.value=text;input.rows=4;body.append(field('Pergunta para o chat',input),el('p','Somente esta pergunta, a seleção e a referência serão encaminhadas; o histórico privado não é incluído.'));
 const message=()=>`${input.value}\n\nReferência e seleção: ${JSON.stringify(payload)}`;
 if(v.adapter.ask)body.append(button('Enviar pergunta ao chat',()=>v.run(async()=>{await v.adapter.ask!(message());v.announce('Pergunta enviada ao chat. A passagem foi preservada.');})));
 else {body.append(el('p','Uma nova interpretação contextual precisa do assistente. Copie a pergunta e cole no chat conectado ao AraRead.'));
  body.append(button('Copiar pergunta e referência',()=>v.run(async()=>{if(!navigator.clipboard?.writeText)throw Error('Cópia automática indisponível. Abra os dados para copiar manualmente.');await navigator.clipboard.writeText(message());v.announce('Pergunta copiada. Cole-a no chat para continuar.');})));
  const extra=el('details'),copy=el('textarea');copy.readOnly=true;copy.rows=5;copy.value=message();input.oninput=()=>copy.value=message();extra.append(el('summary','Dados para copiar manualmente'),copy);body.append(extra);
 }
 v.show('Perguntar ao assistente',body);
}
export function attachReaderSupports(v:View){
 const {display:d,adapter:a}=v;
 const persist=async(name:string,args:any)=>{if(!a.write)throw Error('Gravação indisponível neste host.');const result=await a.write(name,{reading_id:d.reading.id,expected_revision:d.reading.revision,ref:d.ref,...args});if(result.status==='local'){v.announce('Nota somente local, aguardando sincronização.');return result;}if(result.status!=='confirmed')throw Error('Gravação sem confirmação. Consulte o recibo antes de repetir.');d.reading.revision=result.revision;await a.changed?.(d);return result;};
 if(a.supports)a.supports(v);
 if(!a.supports)v.menu.append(button('Entender',()=>v.run(async()=>{
  const chosen=v.getSelection();if(!chosen)return;const language=chosen.target.representation==='original'?d.source.original_language:d.effective_language;
  const body=el('div'),term=el('input'),result=el('div');term.value=chosen.exact.trim().slice(0,120);term.maxLength=120;
  body.append(field('Palavra ou expressão',term),result);
  term.oninput=()=>result.replaceChildren(el('p','O termo mudou. Consulte novamente para conferir seu sentido e a fonte.'));
  const render=(data:any,queriedTerm:string)=>{if(term.value.trim()!==queriedTerm)return;result.replaceChildren();
   for(const saved of data.saved||[]){const card=el('div'),brief=el('p',saved.definition.slice(0,320));card.append(el('h3',saved.details?.definition_kind==='general'?'Definição geral guardada':'Sentido guardado'),brief,el('small',`${saved.context_match==='same_selection'?'Esta seleção':saved.context_match==='same_passage'?'Mesma passagem; confira a ocorrência':'Outro contexto; não aplicar automaticamente'} · ${saved.language} · origem: ${saved.origin==='assistant'?'assistente':'leitor'}`));
    if(saved.definition.length>320){const more=el('details');more.append(el('summary','Expandir sentido'),el('p',saved.definition));card.append(more);}if(saved.details?.source)card.append(el('p',`Fonte declarada: ${saved.details.source.title}`));result.append(card);
   }
   if(!data.saved?.length)result.append(el('p','Sentido neste trecho: ainda não há explicação contextual guardada para esta consulta.'));
   if(data.external){const source=data.external,card=el('div'),more=el('details'),link=el('a',source.title);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';card.append(el('h3','Definição geral'),el('p',source.brief));more.append(el('summary','Expandir definições'),el('p',source.text));card.append(more,el('h3','Fonte consultada'),link,el('p',`${source.attribution} · consultado em ${source.captured_at.slice(0,10)} · ${source.license}`));
    if(d.permissions?.write&&a.write)card.append(button('Guardar definição geral',()=>v.run(async()=>{const {title,url,captured_at,attribution,license,sha256}=source;await persist('term_save',{term:queriedTerm,language,definition:source.brief,sense:'Definição geral consultada; pertinência a esta ocorrência não inferida.',origin:'user',details:{definition_kind:'general',selection:chosen.target,source:{title,url,captured_at,attribution,license,sha256}}});v.announce('Definição guardada com fonte e seleção.');})));result.append(card);
   }
   result.append(el('p',data.notice||''));
  };
  const lookup=async(external=false)=>{const queriedTerm=term.value.trim();if(!queriedTerm)throw Error('Digite uma palavra ou expressão.');result.textContent='Consultando…';try{if(!a.call||a.online?.()===false){render({saved:(d.terms||[]).filter((t:any)=>t.term.toLocaleLowerCase()===queriedTerm.toLocaleLowerCase()&&t.language.split('-')[0]===language.split('-')[0]),notice:'Mostrando somente sentidos preparados neste dispositivo. Consulta pública exige conexão e capacidade do host.'},queriedTerm);return;}render(await a.call('lexicon_lookup',{reading_id:d.reading.id,ref:d.ref,selection:chosen.target,term:queriedTerm,language,consult_external:external}),queriedTerm);}catch(e:any){if(term.value.trim()===queriedTerm)result.textContent='Consulta indisponível. Sua pergunta e seleção foram preservadas.';throw e;}};
  body.append(button('Consultar sentidos guardados',()=>v.run(()=>lookup())),button('Consultar Wikcionário',()=>v.run(()=>lookup(true))),el('small','A consulta pública envia apenas a palavra ou expressão ao Wikcionário.'),button('Perguntar ao assistente',()=>question(v,chosen,language)));
  if(d.permissions?.write&&a.write){const manual=el('details'),definition=el('textarea');definition.maxLength=3000;definition.rows=3;manual.append(el('summary','Guardar meu sentido neste trecho'),field('Sentido contextual do leitor',definition),button('Guardar sentido contextual',()=>v.run(async()=>{if(!definition.value.trim())throw Error('Escreva o sentido que deseja guardar.');await persist('term_save',{term:term.value.trim(),language,definition:definition.value.trim(),sense:'Sentido registrado pelo leitor nesta seleção.',origin:'user',details:{definition_kind:'contextual',selection:chosen.target}});v.announce('Sentido contextual guardado.');})));body.append(manual);}
  v.show('Entender a seleção',body);await lookup();
 })));
 v.menu.append(button('Calcular',()=>{
  const chosen=v.getSelection();if(!chosen)return;const body=el('div'),input=el('input'),result=el('div'),dateFields=el('div');input.value=chosen.exact;input.maxLength=512;
  const mode=choices([['auto','Reconhecer entrada'],['scientific','Expressão científica'],['historical','Anos históricos']],'auto'),angle=choices([['degrees','Graus'],['radians','Radianos']],'degrees'),decimal=choices([[',','Vírgula decimal'],['.','Ponto decimal']],',');
  let last:ReturnType<typeof calculate>|null=null,editedDates:{from:()=>CivilYear;to:()=>CivilYear}|undefined;
  const drawDates=(dates:any)=>{dateFields.replaceChildren();const readers:any={};for(const key of ['from','to']){const year=el('input');year.type='number';year.min='1';year.max='100000';year.value=String(dates[key].year);const era=choices([['BCE','a.C. / a.E.C.'],['CE','d.C. / E.C.']],dates[key].era),approx=el('input');approx.type='checkbox';approx.checked=dates[key].approximate;dateFields.append(field(key==='from'?'Ano inicial':'Ano final',year),field(key==='from'?'Era inicial':'Era final',era),field(key==='from'?'Data inicial incerta':'Data final incerta',approx));readers[key]=()=>({year:Number(year.value),era:era.value,approximate:approx.checked});}editedDates=readers;};
  const compute=()=>{try{last=calculate({input:input.value,mode:mode.value as any,angle_unit:angle.value as any,decimal:decimal.value as any,...(editedDates?{dates:{from:editedDates.from(),to:editedDates.to()}}:{})});result.replaceChildren(el('strong',last.formatted),el('p',last.calculation),el('p',last.notice));if(last.kind==='historical')drawDates(last.dates);
    if(d.permissions?.write&&a.write){const snapshot=last;result.append(button('Salvar cálculo como nota',()=>v.run(async()=>{const saved=await persist('note_save',{kind:'note',origin:'user',text:`Seleção: ${chosen.exact}\n${snapshot.calculation}\n${snapshot.formatted}\n${snapshot.notice}\n${snapshot.kind==='scientific'?`Ângulos: ${snapshot.angle_unit}; decimal: ${snapshot.decimal}.`:'Convenção civil, sem ano zero.'}`,related_mediation_id:chosen.target.mediation_id});if(saved.status==='confirmed')v.announce('Cálculo guardado como nota. A leitura não avançou.');})));}
   }catch(e:any){last=null;result.textContent=e.message;}};
  input.oninput=()=>{editedDates=undefined;dateFields.replaceChildren();result.replaceChildren();};mode.onchange=()=>{editedDates=undefined;dateFields.replaceChildren();};
  const options=el('details');options.append(el('summary','Ajustar cálculo e operandos'),field('Tipo de cálculo',mode),field('Unidade angular',angle),field('Separador decimal',decimal),dateFields);
  body.append(result,field('Expressão ou intervalo de anos',input),options,button('Calcular resultado',compute));
  const help=el('details');help.append(el('summary','Operações e limites'),el('p','+ − × ÷, parênteses, ^, sqrt, cbrt, %, ln, log, exp, abs, sin, cos, tan, asin, acos, atan, pi e e. Até 512 caracteres, 128 tokens/nós, 24 níveis de parênteses e magnitude 10^100. Use uma função por argumento; vírgula não separa argumentos. Datas civis exigem eras, sem ano zero.'));body.append(help);
  v.show('Calcular na passagem',body);compute();
 }));
}
