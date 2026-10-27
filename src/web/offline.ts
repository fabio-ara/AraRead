import {cacheGet,cacheSet,cacheRemove} from './private-cache.ts';
export type Queued={tool:'note_save'|'reading_move'|'highlight_save',args:any,owner:string,reading:string,version:string,created:string,state:'local'|'syncing'|'conflict'|'failed',error?:string};
export async function queue(owner:string):Promise<Queued[]>{return await cacheGet(owner,'queue')||[];}
export async function enqueue(owner:string,tool:string,args:any,ctx:any){
 if(!['note_save','reading_move','highlight_save'].includes(tool))throw Error('Esta alteração exige conexão.');
 const items=await queue(owner),item:Queued={owner,tool:tool as Queued['tool'],args:{...args,operation_id:crypto.randomUUID()},reading:args.reading_id,version:ctx.source.sha256,created:new Date().toISOString(),state:'local'};
 if(tool==='reading_move'&&items.some(x=>x.tool===tool&&x.reading===args.reading_id))throw Error('Já há uma continuidade local para esta leitura. Sincronize ou confira essa intenção antes de registrar outra.');
 if(items.length>=40||new Blob([JSON.stringify([...items,item])]).size>1024*1024)throw Error('Limite local: 40 operações ou 1 MiB. Sincronize ou recupere as pendências.');
 items.push(item);await cacheSet(owner,'queue',items);return {local:true,reading_id:args.reading_id,status:'local',operation_id:item.args.operation_id};
}
export async function syncQueue(owner:string,call:(tool:string,args:any)=>Promise<any>,retry=false):Promise<Queued[]>{
 const items=await queue(owner);for(const item of items){
  if(item.owner!==owner)throw Error('A fila pertence a outra conta.');
  if(item.state==='conflict'||item.state==='failed'&&!retry)break;
  try{
   const receipt=await call('operation_get',{operation_id:item.args.operation_id});if(receipt.status==='confirmed'){items.splice(items.indexOf(item),1);await cacheSet(owner,'queue',items);return syncQueue(owner,call,retry);}
   const current=await call('reading_context',{reading_id:item.reading,ref:item.args.ref});
   if(current.source.sha256!==item.version)throw Object.assign(Error('A versão da fonte mudou.'),{code:'CONFLICT'});
   if(current.reading.revision!==item.args.expected_revision){
    if(item.tool==='note_save'||item.tool==='highlight_save')item.args.expected_revision=current.reading.revision;
    else throw Object.assign(Error('Outra sessão alterou o percurso. Confira antes de reaplicar.'),{code:'CONFLICT'});
   }
   item.state='syncing';await cacheSet(owner,'queue',items);
   const saved=await call(item.tool,item.args);if(saved.status!=='confirmed')throw Error('Sem confirmação.');items.splice(items.indexOf(item),1);await cacheSet(owner,'queue',items);return syncQueue(owner,call,retry);
  }catch(e:any){item.state=e.code==='CONFLICT'?'conflict':'failed';item.error=e.message;await cacheSet(owner,'queue',items);break;}
 }
 return items;
}
export async function discardQueue(owner:string){await cacheSet(owner,'queue',[]);}
export async function removeQueued(owner:string,id:string){await cacheSet(owner,'queue',(await queue(owner)).filter(x=>x.args.operation_id!==id));}
export async function recoverQueue(owner:string){return {format:'araread-pending/1',created_at:new Date().toISOString(),operations:await queue(owner)};}
export async function restoreQueue(owner:string,text:string){
 if(new Blob([text]).size>1024*1024)throw Error('Recuperação excede 1 MiB.');const v=JSON.parse(text);
 if(v.format!=='araread-pending/1'||!Array.isArray(v.operations)||v.operations.length>40)throw Error('Formato de recuperação inválido.');
 if(v.unconfirmed?.length)throw Error('A recuperação tem uma operação online incerta. Consulte seu operation_id no assistente antes de reaplicá-la; ela não foi importada automaticamente.');
 const items=await queue(owner);
 for(const item of v.operations){if(item.owner!==owner||!['note_save','reading_move','highlight_save'].includes(item.tool)||typeof item.reading!=='string'||item.args?.reading_id!==item.reading||typeof item.args?.operation_id!=='string'||!item.args?.ref||typeof item.version!=='string')throw Error('Operação inválida ou pertencente a outra conta.');if(!items.some(x=>x.args.operation_id===item.args.operation_id))items.push({...item,state:'local'});}
 if(items.length>40||new Blob([JSON.stringify(items)]).size>1024*1024)throw Error('A recuperação excederia o limite da fila.');await cacheSet(owner,'queue',items);return items;
}
export async function cachedPassages(owner:string):Promise<any[]>{return await cacheGet(owner,'passages')||[];}
export async function preparePassage(owner:string,ctx:any){
 const passages=await cachedPassages(owner),key=JSON.stringify([ctx.reading.id,ctx.ref,ctx.effective_language,ctx.study?.signature,ctx.mediation?.id]);
 const entries=passages.filter(x=>x.key!==key);entries.push({key,context:ctx,bytes:new Blob([JSON.stringify(ctx)]).size,prepared_at:new Date().toISOString()});
 if(entries.length>12||entries.reduce((n,x)=>n+x.bytes,0)>2*1024*1024)throw Error('Limite local: 12 porções ou 2 MiB. Remova cópias antes de preparar outras.');
 await cacheSet(owner,'passages',entries);return entries;
}
export async function removePassage(owner:string,key:string){await cacheSet(owner,'passages',(await cachedPassages(owner)).filter(x=>x.key!==key));}
export async function invalidateReading(owner:string,reading:string){await cacheSet(owner,'passages',(await cachedPassages(owner)).filter(x=>x.context.reading.id!==reading));const last=await cacheGet(owner,'last-context');if(last?.reading.id===reading)await cacheRemove(owner,'last-context');}
export async function revalidatePrepared(owner:string,call:(tool:string,args:any)=>Promise<any>){
 const entries=await cachedPassages(owner),revisions=new Map<string,number|null>();
 for(const reading of new Set(entries.map(x=>x.context.reading.id as string)))try{const v=await call('source_elements',{reading_id:reading,limit:1});revisions.set(reading,v.revision);}catch(e:any){if(e.code==='NOT_FOUND')revisions.set(reading,null);}
 for(const entry of entries)if(revisions.has(entry.context.reading.id)&&revisions.get(entry.context.reading.id)!==entry.context.reading.revision)await invalidateReading(owner,entry.context.reading.id);
 return cachedPassages(owner);
}
