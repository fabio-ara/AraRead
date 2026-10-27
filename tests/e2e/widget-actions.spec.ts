import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {widgetHtml} from '../../src/widget.ts';
import {editorialReview} from './support.ts';
test('SDK em host sintético negocia ferramentas/mensagem e recupera falhas antes e depois do commit',async({page,request})=>{
 page.setDefaultTimeout(10000);const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8')),login=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await login.json()).access_token;
 const api=async(name:string,args:any={})=>{const res=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const out=await res.json();expect(out.ok,out.error?.message).toBeTruthy();return out.data;};
 const title=`Ponte sintética ${randomUUID()}`,w=await api('source_import',{operation_id:randomUUID(),title,text:'Uma palavra aparece duas vezes. Uma palavra permite testar a seleção.',original_language:'pt-BR'});
 try{
  const c=await api('reading_context',{reading_id:w.reading_id,language:'pt-BR'}),p=await api('context_prepare',{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:c.reading.revision,ref:c.ref,language:'pt-BR'});
  await api('mediation_save',{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:p.revision,ref:c.ref,context_id:p.context_id,language:'pt-BR',rewrite:'A mesma palavra está em duas ocorrências. Podemos selecionar a segunda sem confundi-la com a primeira.',editorial_review:editorialReview,provenance:{agent:'Fixture de ponte',guidance_version:'1.3.0'}});
  const display=await api('reading_display',{reading_id:w.reading_id,language:'pt-BR'}),requests:any[]=[];let failure='before',messages:string[]=[];
  await page.exposeFunction('bridgeCall',async(name:string,args:any)=>{requests.push({name,args});if(name==='highlight_save'&&failure==='before'){failure='';return {transport_error:true};}const data=await api(name,args);if(name==='highlight_save'&&failure==='after'){failure='';return {transport_error:true};}return {content:[],structuredContent:{ok:true,data}};});
  await page.exposeFunction('bridgeMessage',async(text:string)=>{messages.push(text);return {};});
  await page.route('**/mcp-host-synthetic',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Host de teste</title>'}));await page.goto('/mcp-host-synthetic');await page.setContent('<main><iframe title="Host sintético" sandbox="allow-scripts" style="width:100%;max-width:480px;height:600px;border:0"></iframe></main>');
  await page.evaluate(()=>{window.addEventListener('message',async event=>{const m=event.data,frame=document.querySelector('iframe')!;if(event.source!==frame.contentWindow||m.jsonrpc!=='2.0')return;if(m.method==='ui/notifications/initialized'){(window as any).bridgeReady=true;return;}if(m.id===undefined)return;let result:any;
   if(m.method==='ui/initialize')result={protocolVersion:m.params.protocolVersion,hostInfo:{name:'Synthetic integration host',version:'1'},hostCapabilities:{serverTools:{},message:{text:{}}},hostContext:{theme:'light'}};
   else if(m.method==='tools/call')result=await (window as any).bridgeCall(m.params.name,m.params.arguments);
   else if(m.method==='ui/message')result=await (window as any).bridgeMessage(m.params.content[0].text);else return;
   frame.contentWindow!.postMessage(result.transport_error?{jsonrpc:'2.0',id:m.id,error:{code:-32603,message:'Falha sintética de transporte'}}:{jsonrpc:'2.0',id:m.id,result},'*');
  });});
  await page.locator('iframe').evaluate((e:any,html)=>e.srcdoc=html,widgetHtml);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'AraRead',exact:true})).toBeVisible();
  await page.waitForFunction(()=>(window as any).bridgeReady);
  await expect(frame.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('iframe').evaluate((e:any)=>e.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/host-context-changed',params:{theme:'dark'}},'*'));
  await expect(frame.locator('html')).toHaveCSS('background-color','rgb(17, 20, 24)');
  await page.locator('iframe').evaluate((e:any,data)=>e.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{content:[],structuredContent:{ok:true,data}}},'*'),display);await expect(frame.getByRole('tab')).toHaveCount(3);
  const select=async()=>frame.locator('.passage:visible .text-segment').first().evaluate(e=>{const t=e.firstChild!,s=window.getSelection()!;s.setBaseAndExtent(t,2,t,7);});
  await select();await frame.getByRole('button',{name:'Destacar',exact:true}).click();await expect(frame.getByRole('button',{name:'Recuperar gravação',exact:true})).toBeVisible();expect((await api('highlight_list',{reading_id:w.reading_id})).items).toHaveLength(0);
  await frame.getByRole('button',{name:'Recuperar gravação',exact:true}).click();await expect(frame.getByText('Destaques desta passagem (1)',{exact:true})).toBeVisible();const saves=requests.filter(x=>x.name==='highlight_save');expect(saves).toHaveLength(2);expect(saves[0].args.operation_id).toBe(saves[1].args.operation_id);
  failure='after';await select();await frame.getByRole('button',{name:'Destacar',exact:true}).click();await expect(frame.getByRole('button',{name:'Recuperar gravação',exact:true})).toBeVisible();expect((await api('highlight_list',{reading_id:w.reading_id})).items).toHaveLength(2);
  await frame.getByRole('button',{name:'Recuperar gravação',exact:true}).click();await expect(frame.getByText('Destaques desta passagem (2)',{exact:true})).toBeVisible();expect(requests.filter(x=>x.name==='highlight_save')).toHaveLength(3);
  await select();await frame.getByRole('button',{name:'Entender',exact:true}).click();await frame.getByRole('button',{name:'Perguntar ao assistente',exact:true}).click();await frame.getByRole('button',{name:'Enviar pergunta ao chat',exact:true}).click();await expect.poll(()=>messages.length).toBe(1);expect(messages[0]).toContain(w.reading_id);expect(messages[0]).toContain('selection');expect(messages[0]).not.toContain(token);expect((await api('reading_context',{reading_id:w.reading_id})).reading.covered).toEqual([]);
 }finally{await api('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:title});}
});
