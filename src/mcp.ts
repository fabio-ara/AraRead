import { McpServer,createMcpHandler,type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { schemas,descriptions,readTools,type ToolName } from './contracts.ts';
import { config } from './config.ts';
import { guidance,guidanceVersion } from './guidance.ts';
import { execute } from './service.ts';
import { AppError } from './errors.ts';
import type { Identity } from './db.ts';
import { outputs } from './outputs.ts';
import {widgetHtml,widgetUri,widgetMime} from './widget.ts';

export function makeMcp(identity:Identity){
 const server=new McpServer({name:config.name,version:config.version},{instructions:guidance});
 for(const name of Object.keys(schemas) as ToolName[]){
  server.registerTool(name,{
   title:name,description:descriptions[name],inputSchema:schemas[name],
   ...(name==='reading_display'?{_meta:{ui:{resourceUri:widgetUri,visibility:['model','app']}}}:['highlight_save','highlight_remove','highlight_list','reading_context','operation_get','lexicon_lookup','contextual_calculate','term_save','note_save'].includes(name)?{_meta:{ui:{visibility:['model','app']}}}:{}),
   outputSchema:z.object({ok:z.boolean(),data:outputs[name].optional(),error:z.object({code:z.string(),message:z.string(),details:z.unknown().optional()}).optional()}),
   annotations:{readOnlyHint:readTools.has(name),destructiveHint:['highlight_remove','work_delete','note_manage','preferences_unset','profile_manage'].includes(name),idempotentHint:true,openWorldHint:['source_import','source_preview','lexicon_lookup'].includes(name)},
  },async (input:unknown)=>{
   try{const data=await execute(name,input,identity),out={ok:true,data};return {content:[{type:'text' as const,text:JSON.stringify(out)}],structuredContent:out};}
   catch(e){const err=e instanceof AppError?e:new AppError('INTERNAL','Operação falhou. Consulte o recibo antes de repetir.',500);const out={ok:false,error:{code:err.code,message:err.message,...(err.details?{details:err.details}:{})}};return {isError:true,content:[{type:'text' as const,text:JSON.stringify(out)}],structuredContent:out};}
  });
 }
 server.registerResource('orientacao','araread://assistant/guidance',{description:`Orientação operacional ${guidanceVersion}`,mimeType:'text/plain'},async uri=>({contents:[{uri:uri.href,mimeType:'text/plain',text:guidance}]}));
 server.registerResource('leitor',widgetUri,{description:'Passagem preparada em três abas: Leitura facilitada, Tradução e Original. Seleção, grifos e apoios contextuais preservam o controle principal pelo chat.',mimeType:widgetMime},async uri=>({contents:[{uri:uri.href,mimeType:widgetMime,text:widgetHtml,_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}}}}]}));
 server.registerPrompt('retomar-leitura',{description:'Carregue a orientação e consulte a leitura sem avançar.',argsSchema:z.object({reading_id:z.string()})},async ({reading_id})=>({messages:[{role:'user',content:{type:'text',text:`${guidance}\nRetome a leitura de identidade ${reading_id}; consulte reading_context e não avance sem pedido explícito.`}}]}));
 return server;
}
export const mcpHandler=createMcpHandler(({authInfo})=>makeMcp((authInfo as AuthInfo & {identity:Identity}).identity),{legacy:'stateless',maxRequestBodySize:16*1024*1024});
