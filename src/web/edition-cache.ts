import {cacheGet,cacheSet,cacheUpdate} from './private-cache.ts';
import {activityFeedback} from '../editions/model.ts';
export type EditionIntent={tool:string;args:any;state:'pending'|'conflict';message?:string};
export const editionQueue=async(owner:string):Promise<EditionIntent[]> => await cacheGet(owner,'edition-queue')||[];
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
export async function addEditionIntent(owner:string,item:EditionIntent){
 if(!owner)throw Error('Entre para guardar dados pessoais.');
 await cacheUpdate<EditionIntent[]>(owner,'edition-queue',value=>{const queue=value||[];if(queue.length>=80||bytes([...queue,item])>1048576)throw Error('A fila local atingiu seu limite. Sincronize antes de continuar.');return [...queue,item];});
}
export async function removeEditionIntent(owner:string,id:string){await cacheUpdate<EditionIntent[]>(owner,'edition-queue',value=>(value||[]).filter(i=>i.args.operation_id!==id));}
export async function reconcileEditions(owner:string,call:(name:string,args:any)=>Promise<any>){
 let queue=await editionQueue(owner);
 for(const item of [...queue]){
  if(item.state==='conflict')break;
  try{
   const receipt=await call('operation_get',{operation_id:item.args.operation_id});
   const result=receipt.status==='confirmed'?receipt:await call(item.tool,item.args);if(result.status!=='confirmed')throw Error('Sem confirmação da operação.');
   await removeEditionIntent(owner,item.args.operation_id);
  }catch(e:any){
   if(e.code==='CONFLICT')await cacheUpdate<EditionIntent[]>(owner,'edition-queue',value=>(value||[]).map(i=>i.args.operation_id===item.args.operation_id?{...i,state:'conflict',message:'Outra sessão mudou o estado. Confira a intenção antes de reaplicar.'}:i));break;
  }
 }
 return editionQueue(owner);
}
export async function localEditionChange(owner:string,context:any,state:any,args:any){
 if(!['open','continue','resume','note','highlight','answer','request','review','delete'].includes(args.action))throw Error('Esta operação exige conexão.');
 const next=structuredClone(state),manifest=context.outline.map((p:any)=>p.id),at=args.passage_id;
 if(args.action==='open')next.state.opened=at;
 else if(args.action==='resume')next.state.opened=next.state.resume;
 else if(args.action==='continue'){
  if(at!==next.state.opened&&at!==next.state.resume)throw Error('Confira a passagem aberta antes de confirmar a leitura.');
  if(!next.state.covered.includes(at))next.state.covered.push(at);const following=manifest[manifest.indexOf(at)+1]||at;
  if(next.state.opened===at)next.state.opened=following;if(next.state.resume===at)next.state.resume=following;
 }else if(args.action==='delete')next.annotations=next.annotations.filter((a:any)=>a.id!==(args.annotation_operation_id||args.annotation_id));
 else{
  const activity=context.passage.content.activities.find((a:any)=>a.id===args.activity_id);
  next.annotations.push({id:args.operation_id,passage_id:at,kind:args.action,target:args.target||null,text:args.text||'',activity_id:args.activity_id,response:activity?activityFeedback(activity,args.text,args.self_assessment):null,local:true});
 }
 next.state.revision++;await cacheSet(owner,`edition-state:${context.version.id}`,next);return next;
}
export async function preparedEditions(owner:string):Promise<any[]>{return await cacheGet(owner,'edition-bundles')||[];}
export async function saveEditionChapter(owner:string,context:any,chapter:string,load:(id:string)=>Promise<any>,limitMiB=8){
 const expected=context.outline.filter((p:any)=>p.chapter===chapter).map((p:any)=>p.id),contexts=[];
 if(!expected.length)throw Error('Capítulo vazio.');
 for(const id of expected){const result=await load(id);if(result.version.sha256!==context.version.sha256||result.passage.id!==id)throw Error('A versão mudou durante o preparo.');contexts.push(result);}
 if(contexts.length!==expected.length)throw Error('O capítulo ainda não foi preparado integralmente.');
 const entry={version_id:context.version.id,sha256:context.version.sha256,title:context.version.title,chapter,expected,contexts,complete:true,bytes:bytes(contexts),prepared_at:new Date().toISOString()};
 const entries=(await preparedEditions(owner)).filter(e=>!(e.version_id===entry.version_id&&e.chapter===chapter));entries.push(entry);
 if(bytes(entries)>Math.min(16,Math.max(1,limitMiB))*1048576)throw Error('Os capítulos ultrapassam o limite local escolhido. Remova uma cópia preparada antes de tentar novamente.');
 await cacheSet(owner,'edition-bundles',entries);return entry;
}
export async function cachedEdition(owner:string,version:string,passage?:string){
 const entries=await preparedEditions(owner);for(const entry of entries){if(entry.version_id!==version||!entry.complete||entry.expected.length!==entry.contexts.length)continue;const context=entry.contexts.find((c:any)=>!passage||c.passage.id===passage);if(context)return context;}return null;
}
export async function removeEditionChapter(owner:string,version:string,chapter:string){await cacheSet(owner,'edition-bundles',(await preparedEditions(owner)).filter(e=>e.version_id!==version||e.chapter!==chapter));}
