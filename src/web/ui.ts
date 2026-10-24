export type Child=Node|string|number|null|undefined|false;
export function el<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,any>={},...children:Child[]):HTMLElementTagNameMap[K]{
 const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(value==null)continue;if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else if(key==='class')node.className=value;else if(key in node)(node as any)[key]=value;else node.setAttribute(key,String(value));}
 for(const child of children)if(child!==null&&child!==undefined&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node;
}
let nextId=0;
export function field(label:string,input:HTMLElement,help?:string){const id=input.id||`input-${++nextId}`;input.id=id;if(help)input.setAttribute('aria-describedby',`${id}-help`);return el('div',{class:'field'},el('label',{htmlFor:id},label),input,help?el('small',{id:`${id}-help`},help):null);}
export function action(label:string,run:()=>unknown,error:(message:string)=>void,attrs:Record<string,any>={}){return el('button',{type:'button',onclick:async()=>{try{await run();}catch(e:any){error(e.message||'Não foi possível concluir.');}},...attrs},label);}
