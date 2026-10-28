import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
test('IndexedDB real: duas abas conservam intenções e sincronização não perde nova escrita',async({page,context})=>{
 const bundle=(await build({entryPoints:['src/web/edition-cache.ts'],bundle:true,write:false,format:'iife',globalName:'EditionCache',platform:'browser',target:'es2023'})).outputFiles[0].text,owner=randomUUID();
 await context.route('https://araread.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Cache sintético</title>'}));
 const other=await context.newPage();for(const tab of [page,other]){await tab.goto('https://araread.test/');await tab.addScriptTag({content:bundle});}
 const add=(tab:typeof page)=>tab.evaluate(async owner=>{const c=(window as any).EditionCache;await Promise.all(Array.from({length:20},()=>c.addEditionIntent(owner,{tool:'edition_annotate',state:'pending',args:{operation_id:crypto.randomUUID(),version_id:'synthetic-version',action:'note',text:'Somente material sintético.'}})));},owner);
 await Promise.all([add(page),add(other)]);expect(await page.evaluate(async owner=>(await (window as any).EditionCache.editionQueue(owner)).length,owner)).toBe(40);
 const result=await page.evaluate(async owner=>{
  const c=(window as any).EditionCache,queue=await c.editionQueue(owner);await Promise.all(queue.map((q:any)=>c.removeEditionIntent(owner,q.args.operation_id)));
  const first=crypto.randomUUID(),later=crypto.randomUUID();await c.addEditionIntent(owner,{tool:'edition_annotate',state:'pending',args:{operation_id:first,version_id:'synthetic-version',action:'note',text:'Primeira intenção.'}});
  const calls:string[]=[];await c.reconcileEditions(owner,async(name:string)=>{calls.push(name);if(name==='operation_get')return {status:'unknown'};await c.addEditionIntent(owner,{tool:'edition_annotate',state:'pending',args:{operation_id:later,version_id:'synthetic-version',action:'note',text:'Nova intenção durante sincronização.'}});return {status:'confirmed',annotation_id:crypto.randomUUID()};});
  const remaining=await c.editionQueue(owner);await c.reconcileEditions(owner,async(name:string)=>{if(name!=='operation_get')throw Error('Não deve repetir escrita confirmada.');return {status:'confirmed'};});
  return {calls,remaining:remaining.map((q:any)=>q.args.operation_id),later,final:(await c.editionQueue(owner)).length};
 },owner);
 expect(result.remaining).toEqual([result.later]);expect(result.final).toBe(0);expect(result.calls).toEqual(['operation_get','edition_annotate']);
});
