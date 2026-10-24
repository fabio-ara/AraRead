import {el} from './ui.ts';

/** Shared presentation semantics; study commands are requested in the chat. */
export function readingPanel(ctx:any,original:()=>HTMLElement){
 if(!ctx.display?.ready)return el('p',{class:'notice',role:'status'},'Peça ao assistente, no chat, para preparar e conferir esta passagem.');
 const display=ctx.display,keys=['facilitated','translation','original'],labels=['Leitura facilitada','Tradução','Original'];let active=0;
 const note=el('p',{class:'muted',hidden:true}),content=el('div',{id:'reading-passage',role:'tabpanel','aria-labelledby':'reading-tab-0',tabIndex:0,class:'passage',dir:'auto'});
 const tabs:HTMLButtonElement[]=[],select=(index:number)=>{active=index;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===active));tab.tabIndex=i===active?0:-1;});content.setAttribute('aria-labelledby',`reading-tab-${active}`);content.replaceChildren();note.hidden=true;
  if(active===2){content.lang=ctx.source.original_language;content.append(original());return;}
  content.lang=ctx.effective_language;
  const representation=display.representations[keys[active]];for(const paragraph of representation.text.split(/\n\s*\n/))content.append(el('p',{},paragraph.replace(/\s+/g,' ').trim()));
  if(active===1&&representation.status==='same_language'){note.hidden=false;note.textContent='O original já está no idioma de leitura.';}
 };
 for(const [i,label]of labels.entries())tabs.push(el('button',{type:'button',role:'tab',id:`reading-tab-${i}`,'aria-selected':String(i===0),'aria-controls':'reading-passage',tabIndex:i===0?0:-1,onclick:()=>select(i),onkeydown:(e:KeyboardEvent)=>{let n=i;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();select(n);tabs[n].focus();}},label));
 const box=el('article',{class:'reading-paper'},el('div',{class:'reading-tabs',role:'tablist','aria-label':'Representações da mesma passagem'},...tabs),note,content);select(0);return box;
}
