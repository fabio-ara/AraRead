import {App} from '@modelcontextprotocol/ext-apps';
import {mountReader,type ReaderAdapter} from './reader-view.ts';
const app=new App({name:'AraRead',version:'0.4.0'},{},{strict:true,allowUnsafeEval:false});
const root=document.getElementById('reader')!,status=document.getElementById('status')!;let current:any,view:ReturnType<typeof mountReader>|undefined,connected=false;
const allowed=new Set(['highlight_save','highlight_remove','highlight_list','reading_context','operation_get','lexicon_lookup','term_save','note_save']);
async function call(name:string,args:any){
 if(!connected||!app.getHostCapabilities()?.serverTools||!allowed.has(name))throw Error('Este host não oferece essa ação. Use o chat ou a biblioteca web.');
 const result=await app.callServerTool({name,arguments:args});const out:any=result.structuredContent;
 if(result.isError||!out?.ok)throw Object.assign(Error(out?.error?.message||'A operação não foi confirmada.'),{code:out?.error?.code||'HOST_ERROR'});return out.data;
}
const pendingMemory=new Map<string,string>();
const pendingStore={getItem(key:string){try{return sessionStorage.getItem(key)||pendingMemory.get(key)||null;}catch{return pendingMemory.get(key)||null;}},setItem(key:string,value:string){pendingMemory.set(key,value);try{sessionStorage.setItem(key,value);}catch{}},removeItem(key:string){pendingMemory.delete(key);try{sessionStorage.removeItem(key);}catch{}}};
const pendingKey=()=>`araread-pending:${current.reading.owner_id}:${current.reading.id}`;
const recovery=document.createElement('div');status.after(recovery);
function refreshRecovery(){
 recovery.replaceChildren();if(!current||!connected||!app.getHostCapabilities()?.serverTools)return;
 const pending=pendingStore.getItem(pendingKey());if(!pending)return;
 const button=document.createElement('button');button.textContent='Recuperar gravação';button.onclick=()=>void view!.run(async()=>{
  const request=JSON.parse(pending),known=await call('operation_get',{operation_id:request.args.operation_id}),result=known.status==='confirmed'?known:await call(request.name,request.args);
  if(result.status!=='confirmed')throw Error('Sem confirmação.');pendingStore.removeItem(pendingKey());
  const latest=await call('reading_context',{reading_id:current.reading.id,ref:current.ref});current.reading.revision=latest.reading.revision;
  current.highlights=await call('highlight_list',{reading_id:current.reading.id,ref:current.ref});render();view!.announce('Gravação anterior confirmada pelo recibo.');
 });recovery.append(button);
}
async function write(name:string,args:any){
 let saved=pendingStore.getItem(pendingKey()),request=saved?JSON.parse(saved):null;
 if(request){refreshRecovery();throw Error('Há gravação incerta. Use “Recuperar gravação” antes de criar outra intenção.');}
 request={name,args:{...args,operation_id:crypto.randomUUID()}};pendingStore.setItem(pendingKey(),JSON.stringify(request));
 try{const result=await call(name,request.args);if(result.status!=='confirmed')throw Error('Gravação não confirmada.');pendingStore.removeItem(pendingKey());return result;}
 catch(e:any){if(typeof e.code==='string'&&!['INTERNAL','HOST_ERROR','ERROR'].includes(e.code))pendingStore.removeItem(pendingKey());refreshRecovery();throw e;}
}
function render(){
 if(!current)return;view?.dispose();const supported=connected&&!!app.getHostCapabilities()?.serverTools;
 const adapter:ReaderAdapter={...(supported?{call,write}:{}),...(app.getHostCapabilities()?.message?.text?{ask:async(text:string)=>{const result=await app.sendMessage({role:'user',content:[{type:'text',text}]});if(result.isError)throw Error('O host recusou a pergunta. O texto foi preservado.');}}:{}),online:()=>connected};
 view=mountReader(root,current,adapter);status.textContent=supported?'':'Ações de gravação indisponíveis neste host. Você pode selecionar e copiar; peça os apoios no chat.';
 refreshRecovery();
}
app.ontoolresult=result=>{const out:any=result.structuredContent;if(out?.ok===false){status.textContent=out.error?.message||'Passagem indisponível.';return;}const data=out?.data||out;if(!data?.ready||!data.ref||!data.representations)return;current=data;document.getElementById('title')!.textContent=data.work.title;document.getElementById('location')!.textContent=data.location.label;render();};
app.onhostcontextchanged=context=>{if(context.theme)document.documentElement.dataset.theme=context.theme;};
app.connect().then(()=>{connected=true;const theme=app.getHostContext()?.theme;if(theme)document.documentElement.dataset.theme=theme;render();}).catch(()=>{status.textContent='A ponte do host está indisponível. Retome pelo chat ou pela biblioteca web.';});
