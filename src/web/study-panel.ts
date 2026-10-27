import {el} from './ui.ts';
import {mountReader,type ReaderAdapter} from '../reader-view.ts';
import '../reader.css';
export function readingPanel(ctx:any,original:()=>HTMLElement,adapter:ReaderAdapter={}){
 if(!ctx.display?.ready)return el('p',{class:'notice',role:'status'},'Peça ao assistente, no chat, para preparar e conferir esta passagem.');
 const root=el('div',{class:'reader-surface'});mountReader(root,ctx.display,{...adapter,original});return root;
}
