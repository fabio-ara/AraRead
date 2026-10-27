import {renderMappedText,registerMappedText,selectionOffsets,rangeForOffsets} from './reader-selection.ts';
import {attachReaderSupports} from './reader-support.ts';
export type ReaderAdapter={call?:(name:string,args:any)=>Promise<any>;write?:(name:string,args:any)=>Promise<any>;online?:()=>boolean;ask?:(text:string)=>Promise<void>;original?:()=>HTMLElement;changed?:(display:any)=>Promise<void>};
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const cp=(text:string)=>Array.from(text);
const buttons=(text:string,fn:()=>unknown)=>{const b=node('button',text);b.type='button';b.onclick=()=>void fn();return b;};
export function mountReader(root:HTMLElement,display:any,adapter:ReaderAdapter={}){
 const abort=new AbortController(),keys=['facilitated','translation','original'],labels=['Leitura facilitada','Tradução','Original'];let active=0,selection:any=null,working=false;
 const panels:HTMLElement[]=[],segments:{root:HTMLElement;model:any}[][]=[],tabs:HTMLButtonElement[]=[],scrolls=[0,0,0];
 const article=node('article','','reading-paper'),tablist=node('div','','reading-tabs');tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label','Representações da mesma passagem');
 const status=node('p','','reader-status');status.setAttribute('role','status');status.hidden=true;
 const menu=node('div','','selection-actions');menu.setAttribute('role','toolbar');menu.setAttribute('aria-label','Ações da seleção');menu.hidden=true;
 const sheet=node('section','','context-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Apoio à passagem');sheet.hidden=true;sheet.tabIndex=-1;
 const details=node('details','','highlight-list'),summary=node('summary','Destaques desta passagem'),list=node('div');details.append(summary,list);
 const announce=(message:string)=>{status.textContent=message;status.hidden=!message;};
 const close=()=>{sheet.hidden=true;menu.hidden=true;panels[active].focus({preventScroll:true});};
 const show=(title:string,body:HTMLElement)=>{const header=node('div','','context-sheet-header');header.append(node('h2',title),buttons('Fechar',close));sheet.replaceChildren(header,body);sheet.scrollTop=0;sheet.hidden=false;menu.hidden=true;sheet.focus({preventScroll:true});};
 const run=async(fn:()=>Promise<void>)=>{if(working)return;working=true;try{await fn();}catch(e:any){announce(e.message||'Não foi possível concluir. Sua seleção foi preservada.');if(e.code==='CONFLICT'&&adapter.call){const c=await adapter.call('reading_context',{reading_id:display.reading.id,ref:display.ref});display.reading.revision=c.reading.revision;}}finally{working=false;}};
 function paint(){
  if(abort.signal.aborted)return;
  const ranges:Range[]=[];for(const group of segments)for(const entry of group){
   // CSS highlights do not recreate nodes, so native selection and focus survive writes.
   for(const h of display.highlights?.items||[]){const t=h.target,m=entry.model;if(h.state==='orphaned'||t.representation!==m.representation||t.mediation_id!==m.mediation_id||t.segment!==m.segment)continue;const r=rangeForOffsets(entry.root,t.start-m.base_offset,t.end-m.base_offset);if(r)ranges.push(r);}
  }
  const css=globalThis.CSS as any,Highlight=(globalThis as any).Highlight;
  if(css?.highlights&&Highlight)css.highlights.set('araread-saved',new Highlight(...ranges));
  // The list is also the accessible and unsupported-browser alternative to color.
  list.replaceChildren();summary.textContent=`Destaques desta passagem (${display.highlights?.items?.length||0})`;
  for(const h of display.highlights?.items||[]){const card=node('div','','highlight-item');card.append(node('blockquote',h.target.exact),node('small',h.state==='orphaned'?'Versão indisponível; âncora órfã.':h.state==='version_superseded'?'Destaque de uma versão anterior.':h.target.representation==='original'?'Original':h.target.representation==='translation'?'Tradução':'Leitura facilitada'));
   if(h.target.mediation_id&&h.state!=='orphaned'&&adapter.call)card.append(buttons('Rever versão',()=>run(async()=>{const c=await adapter.call!('reading_context',{reading_id:display.reading.id,ref:h.ref,variant_id:h.target.mediation_id,language:h.language});const text=h.target.segment==='main'?c.mediation.rewrite:c.mediation.additions[Number(h.target.segment.split(':')[1])]?.text;const body=node('div','','archived-text');renderMappedText(body,text);show('Versão guardada',body);})));
   if(display.permissions?.write&&adapter.write)card.append(buttons('Remover destaque',()=>run(async()=>{const receipt=await adapter.write!('highlight_remove',{reading_id:display.reading.id,expected_revision:display.reading.revision,highlight_id:h.id});if(receipt.status!=='confirmed')throw Error('Remoção ainda não confirmada.');display.reading.revision=receipt.revision;display.highlights.items=display.highlights.items.filter((v:any)=>v.id!==h.id);paint();await adapter.changed?.(display);announce('Destaque removido. Notas preservadas.');})));
   list.append(card);
  }
  const next=display.highlights?.pagination?.next_offset;if(next!=null&&adapter.call)list.append(buttons('Mais destaques',()=>run(async()=>{const page=await adapter.call!('highlight_list',{reading_id:display.reading.id,ref:display.ref,offset:next});display.highlights={...page,items:[...display.highlights.items,...page.items]};paint();})));
 }
 function select(index:number){scrolls[active]=window.scrollY;active=index;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});selection=null;menu.hidden=true;sheet.hidden=true;window.scrollTo({top:scrolls[index],behavior:'instant'});}
 for(const [i,key]of keys.entries()){
  const panel=node('div','','passage');panel.id=`reading-passage-${i}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`reading-tab-${i}`);panel.tabIndex=0;panel.setAttribute('aria-keyshortcuts','Shift+ArrowRight Shift+ArrowLeft');panel.setAttribute('aria-description','Com foco no texto, use Shift com as setas para selecionar; Ctrl ou Command seleciona por palavras.');panel.dir='auto';panel.lang=i===2?display.source.original_language:display.effective_language;panels.push(panel);segments.push([]);
  const tab=buttons(labels[i],()=>select(i));tab.id=`reading-tab-${i}`;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tabs.push(tab);tablist.append(tab);
  tab.onkeydown=e=>{const n=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(n===null)return;e.preventDefault();select(n);tabs[n].focus({preventScroll:true});};
  const representation=display.representations[key];
  if(i===1&&representation.status==='same_language')panel.append(node('p','O original já está no idioma de leitura.','representation-notice'));
  const models=representation.segments||[];
  if(!models.length)panel.append(node('p',representation.text));
  for(const m of models){let body=node('div','','text-segment');
   if(i===2&&adapter.original&&['equation','table','figure'].includes(display.element.kind)){const rich=adapter.original();panel.append(rich);const canonical=node('details');canonical.append(node('summary','Selecionar texto canônico'));renderMappedText(body,m.text);canonical.append(body);panel.append(canonical);}
   else {renderMappedText(body,m.text);if(m.kind!=='main'){const label=({context:'Contexto',interpretation:'Interpretação',example:'Exemplo',critical_note:'Nota crítica'} as Record<string,string>)[m.kind]||'Acréscimo';panel.append(node('p',label,'segment-label'));}panel.append(body);}
   segments[i].push({root:body,model:m});
  }
 }
 const save=buttons('Destacar',()=>run(async()=>{
  if(!selection||!adapter.write)return;const chosen=selection;announce('Salvando destaque…');
  const receipt=await adapter.write('highlight_save',{reading_id:display.reading.id,expected_revision:display.reading.revision,ref:display.ref,target:chosen.target});
  if(receipt.status==='local'){announce('Destaque somente local, aguardando sincronização.');menu.hidden=true;return;}
  if(receipt.status!=='confirmed')throw Error('O destaque ainda não foi confirmado. Consulte o recibo antes de repetir.');
  display.reading.revision=receipt.revision;
  if(adapter.call)display.highlights=await adapter.call('highlight_list',{reading_id:display.reading.id,ref:display.ref});
  paint();await adapter.changed?.(display);announce('Destaque salvo e relido no servidor.');menu.hidden=true;
 }));
 save.hidden=!display.permissions?.write||!adapter.write;menu.append(save);
 function capture(){if(!root.isConnected){abort.abort();return;}if(!sheet.hidden)return;for(const entry of segments[active]){const at=selectionOffsets(entry.root);if(!at)continue;const m=entry.model,chars=cp(m.text);const prefix=cp((m.selector_prefix||'')+chars.slice(0,at.start).join('')).slice(-32).join(''),suffix=cp(chars.slice(at.end).join('')+(m.selector_suffix||'')).slice(0,32).join('');selection={...at,target:{representation:m.representation,...(m.mediation_id?{mediation_id:m.mediation_id}:{}),segment:m.segment,start:at.start+m.base_offset,end:at.end+m.base_offset,exact:at.exact,prefix,suffix},model:m};menu.hidden=false;return;}if(!menu.contains(document.activeElement)){selection=null;menu.hidden=true;}}
 document.addEventListener('selectionchange',capture,{signal:abort.signal});
 root.addEventListener('keyup',capture,{signal:abort.signal});root.addEventListener('pointerup',capture,{signal:abort.signal});
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(!panels[active].contains(e.target as Node)||!e.shiftKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;
  const s=window.getSelection();if(!s||typeof s.modify!=='function')return;e.preventDefault();
  if(!s.anchorNode||!panels[active].contains(s.anchorNode)){const first=segments[active][0]?.root.firstChild;if(!first)return;s.collapse(first,0);}
  s.modify('extend',e.key==='ArrowRight'?'right':'left',e.ctrlKey||e.metaKey?'word':'character');capture();
 },{signal:abort.signal});
 document.addEventListener('pointerdown',e=>{if(!sheet.hidden&&!sheet.contains(e.target as Node)&&!menu.contains(e.target as Node))sheet.hidden=true;},{signal:abort.signal});
 article.append(tablist,...panels,status,details,menu,sheet);root.replaceChildren(article);select(0);paint();
 const view={dispose(){abort.abort();(globalThis.CSS as any)?.highlights?.delete('araread-saved');},show,announce,getSelection:()=>selection,menu,run,display,adapter};attachReaderSupports(view);return view;
}
