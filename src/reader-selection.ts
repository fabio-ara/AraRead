/** The DOM uses UTF-16; persistent selectors use code points in one immutable segment. */
type Mapping={text:string;start:Map<number,number>;end:Map<number,number>};
const mappings=new WeakMap<HTMLElement,Mapping>();
function normalized(text:string){
 const chars=Array.from(text),units:{char:string;start:number;end:number}[]=[];
 for(let i=0;i<chars.length;){const start=i,char=chars[i++];if(/\s/u.test(char)){while(i<chars.length&&/\s/u.test(chars[i]))i++;units.push({char:' ',start,end:i});}else units.push({char,start,end:i});}
 if(units[0]?.char===' ')units.shift();if(units.at(-1)?.char===' ')units.pop();return units;
}
export function registerMappedText(root:HTMLElement,text:string){
 const rendered=root.textContent||'';let units:{char:string;start:number;end:number}[];
 if(rendered===text)units=Array.from(text,(char,i)=>({char,start:i,end:i+1}));
 else {units=normalized(text);if(units.map(u=>u.char).join('')!==rendered)throw Error('O texto visual não corresponde à versão canônica.');}
 const mapping:Mapping={text,start:new Map(),end:new Map()};let utf16=0;
 for(const unit of units){mapping.start.set(utf16,unit.start);mapping.end.set(utf16,unit.start);utf16+=unit.char.length;mapping.start.set(utf16,unit.end);mapping.end.set(utf16,unit.end);}
 mappings.set(root,mapping);return mapping;
}
export function renderMappedText(root:HTMLElement,text:string,options:{preserveWhitespace?:boolean}={}){
 root.textContent=options.preserveWhitespace===false?normalized(text).map(u=>u.char).join(''):text;
 root.style.whiteSpace=options.preserveWhitespace===false?'normal':'pre-wrap';return registerMappedText(root,text);
}
function domOffset(root:HTMLElement,node:Node,offset:number){if(!root.contains(node)&&node!==root)return null;const r=document.createRange();r.selectNodeContents(root);try{r.setEnd(node,offset);return r.toString().length;}catch{return null;}}
export function selectionOffsets(root:HTMLElement,selection=window.getSelection()){
 const m=mappings.get(root);if(!m||!selection||selection.isCollapsed||selection.rangeCount!==1)return null;
 const range=selection.getRangeAt(0),a=domOffset(root,range.startContainer,range.startOffset),b=domOffset(root,range.endContainer,range.endOffset);
 if(a===null||b===null)return null;const start=m.start.get(a),end=m.end.get(b);if(start===undefined||end===undefined||end<=start||end-start>4000)return null;
 const graphs=new Set([0]);let n=0;for(const g of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(m.text)){n+=Array.from(g.segment).length;graphs.add(n);}
 if(!graphs.has(start)||!graphs.has(end))return null;
 const chars=Array.from(m.text);return {start,end,exact:chars.slice(start,end).join(''),prefix:chars.slice(Math.max(0,start-32),start).join(''),suffix:chars.slice(end,end+32).join('')};
}
export function rangeForOffsets(root:HTMLElement,start:number,end:number){
 const m=mappings.get(root);if(!m)return null;const a=[...m.start].find(([,cp])=>cp===start)?.[0],b=[...m.end].find(([,cp])=>cp===end)?.[0];if(a===undefined||b===undefined)return null;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null,total=0,first:{node:Node;offset:number}|undefined,last:typeof first;
 while((node=walker.nextNode())){const len=node.textContent?.length||0;if(!first&&a<=total+len)first={node,offset:a-total};if(b<=total+len){last={node,offset:b-total};break;}total+=len;}
 if(!first||!last)return null;const r=document.createRange();r.setStart(first.node,first.offset);r.setEnd(last.node,last.offset);return r;
}
