import katex from 'katex';
const el=(tag:string,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
/** Original structure is shown alongside the selectable, immutable canonical text. */
export function renderOriginalBlock({kind,text,meta={}}:{kind:string;text:string;meta?:any}):HTMLElement{
 if(kind==='table'&&Array.isArray(meta.rows)){
  const wrapper=el('div','','wide'),table=el('table'),body=el('tbody');
  if(meta.caption)table.append(el('caption',String(meta.caption)));
  for(const row of meta.rows){const tr=el('tr');for(const cell of row)tr.append(el('td',String(cell)));body.append(tr);}table.append(body);wrapper.append(table);return wrapper;
 }
 if(kind==='equation'){
  const math=el('div','','wide math');math.setAttribute('aria-label','Fórmula original');
  if(meta.representation==='original_markup_as_text'){math.append(el('p','A marcação original foi preservada; a forma visual requer conferência no arquivo da fonte.'),el('pre',text));}
  else try{katex.render(text,math,{displayMode:true,output:'mathml',throwOnError:false,trust:false,strict:'warn'});}catch{math.textContent=text;}
  return math;
 }
 if(kind==='figure'){const figure=el('figure');figure.append(el('figcaption',text),el('small','Descrição fornecida pela fonte. A imagem não foi interpretada automaticamente.'));return figure;}
 if(['code','unknown'].includes(kind)){const pre=el('pre','','wide');pre.append(el('code',text));return pre;}
 const node=el(kind==='heading'?'h2':'div',text,`original-text ${kind==='verse'?'verse':''}`);node.dir='auto';return node;
}
export function editionOriginal(model:any){return renderOriginalBlock({kind:model.original_kind,text:model.text,meta:model.original_meta});}
