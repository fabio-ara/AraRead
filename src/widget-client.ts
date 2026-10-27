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
const clearPending=(key:string,operation:string)=>{const saved=pendingStore.getItem(key);if(saved&&JSON.parse(saved).args.operation_id===operation)pendingStore.removeItem(key);};
const recovery=document.createElement('div');status.after(recovery);
function refreshRecovery(){
 recovery.replaceChildren();if(!current||!connected||!app.getHostCapabilities()?.serverTools)return;
 const key=pendingKey(),reading=current,pending=pendingStore.getItem(key);if(!pending)return;
 const request=JSON.parse(pending),button=document.createElement('button');button.textContent=request.conflict?'Conferir e reaplicar gravação':'Recuperar gravação';
 if(request.conflict){const description=document.createElement('p');description.textContent=`Outra sessão alterou a leitura. Confira antes de reaplicar: ${request.args.target?.exact||request.args.text||request.args.term||'remover o destaque selecionado'}.`;recovery.append(description);}
 button.onclick=()=>void view!.run(async()=>{
  const known=await call('operation_get',{operation_id:request.args.operation_id});let result=known;
  if(known.status!=='confirmed')try{result=await call(request.name,request.args);}catch(e:any){
   if(e.code!=='CONFLICT')throw e;
   const latest=await call('reading_context',{reading_id:reading.reading.id,ref:reading.ref}),saved=pendingStore.getItem(key);
   if(saved&&JSON.parse(saved).args.operation_id===request.args.operation_id)pendingStore.setItem(key,JSON.stringify({...request,conflict:true,args:{...request.args,expected_revision:latest.reading.revision}}));
   if(current===reading){reading.reading.revision=latest.reading.revision;refreshRecovery();view!.announce('A gravação não foi aplicada. Confira a intenção pendente antes de confirmar novamente.');}return;
  }
  if(result.status!=='confirmed')throw Error('Sem confirmação.');clearPending(key,request.args.operation_id);
  const latest=await call('reading_context',{reading_id:reading.reading.id,ref:reading.ref});reading.reading.revision=latest.reading.revision;
  reading.highlights=await call('highlight_list',{reading_id:reading.reading.id,ref:reading.ref});if(current===reading){render();view!.announce('Gravação anterior confirmada pelo recibo.');}
 });recovery.append(button);
}
async function write(name:string,args:any){
 const key=pendingKey();let saved=pendingStore.getItem(key),request=saved?JSON.parse(saved):null;
 if(request){refreshRecovery();throw Error('Há gravação incerta. Use “Recuperar gravação” antes de criar outra intenção.');}
 request={name,args:{...args,operation_id:crypto.randomUUID()}};pendingStore.setItem(key,JSON.stringify(request));
 try{const result=await call(name,request.args);if(result.status!=='confirmed')throw Error('Gravação não confirmada.');clearPending(key,request.args.operation_id);return result;}
 catch(e:any){if(typeof e.code==='string'&&!['INTERNAL','HOST_ERROR','ERROR'].includes(e.code))clearPending(key,request.args.operation_id);refreshRecovery();throw e;}
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
