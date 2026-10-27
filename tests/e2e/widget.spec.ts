import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {widgetHtml} from '../../src/widget.ts';
import {editorialReview} from './support.ts';
test('ponte MCP Apps exibe somente resultado final, três abas acessíveis e nenhuma escrita',async({page,request})=>{
 const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8')),login=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await login.json()).access_token;
 const api=async(name:string,args:any={})=>{const res=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const v=await res.json();expect(v.ok,v.error?.message).toBeTruthy();return v.data;};
 const title=`Painel sintético ${randomUUID().slice(0,8)}`,w=await api('source_import',{operation_id:randomUUID(),title,text:'A hypothesis may hold. It does not imply certainty.',original_language:'en'});
 try{
  const c=await api('reading_context',{reading_id:w.reading_id,language:'pt-BR'});
  await page.setContent('<main><iframe title="AraRead MCP Apps" sandbox="allow-scripts" style="width:100%;max-width:480px;height:900px;border:0"></iframe></main>');
  await page.evaluate(()=>{(window as any).messages=[];window.addEventListener('message',event=>{const m=event.data,frame=document.querySelector('iframe')!;if(event.source!==frame.contentWindow||m.jsonrpc!=='2.0')return;(window as any).messages.push(m.method);if(m.method==='ui/initialize')event.source!.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Synthetic host',version:'1'},hostCapabilities:{},hostContext:{}}},{targetOrigin:'*'});});});
  await page.locator('iframe').evaluate((e:any,html)=>e.srcdoc=html,widgetHtml);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'AraRead',exact:true})).toBeVisible();
  const send=(data:any)=>page.locator('iframe').evaluate((e:any,data)=>e.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{content:[],structuredContent:{ok:true,data}}},'*'),data);
  await send(c);await expect(frame.getByRole('tablist')).toBeHidden();
  for(const representation of ['rewrite','translation']){const current=await api('reading_context',{reading_id:w.reading_id}),p=await api('context_prepare',{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:current.reading.revision,ref:c.ref,language:'pt-BR',selection:{representation}});await api('mediation_save',{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:p.revision,ref:c.ref,language:'pt-BR',representation,context_id:p.context_id,rewrite:representation==='translation'?'Uma hipótese pode valer. Ela não implica certeza.':'Uma hipótese é uma afirmação provisória. Ela pode valer, mas não implica certeza.',editorial_review:editorialReview,provenance:{agent:'Fixture MCP Apps',guidance_version:'1.2.0'}});}
  const display=await api('reading_display',{reading_id:w.reading_id,language:'pt-BR'});await send(display);await expect(frame.getByRole('tab')).toHaveCount(3);await expect(frame.locator('button:visible')).toHaveCount(3);await expect(frame.getByRole('tabpanel')).toContainText('afirmação provisória');
  await frame.getByRole('tab',{name:'Leitura facilitada',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(frame.getByRole('tab',{name:'Tradução',exact:true})).toBeFocused();await expect(frame.getByRole('tabpanel')).toHaveText(display.representations.translation.text);
  await page.keyboard.press('End');await expect(frame.getByRole('tabpanel')).toContainText(c.original);await frame.getByRole('tab',{name:'Leitura facilitada',exact:true}).click();
  await page.setViewportSize({width:320,height:900});await mkdir('.local/evidence',{recursive:true});await page.screenshot({path:'.local/evidence/v3-widget-320.png',fullPage:true});
  expect(await page.evaluate(()=>(window as any).messages.filter((x:string)=>x==='tools/call'||x==='ui/message'))).toEqual([]);expect((await api('reading_context',{reading_id:w.reading_id})).reading.covered).toEqual([]);
 }finally{await api('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:title});}
});
