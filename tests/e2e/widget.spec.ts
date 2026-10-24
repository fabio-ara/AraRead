import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {widgetHtml} from '../../src/widget.ts';
test('ponte MCP Apps usa domínio real; pergunta não avança e botão de continuar confirma',async({page,request})=>{
 const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8')),login=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await login.json()).access_token;
 const api=async(name:string,args:any={})=>{const r=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const v=await r.json();expect(v.ok,v.error?.message).toBeTruthy();return v;};
 const title=`Painel MCP sintético ${randomUUID()}`,w=(await api('source_import',{operation_id:randomUUID(),title,text:'Talvez a condição seja necessária.\n\nPróxima passagem.'})).data;
 try{
  const c=(await api('reading_context',{reading_id:w.reading_id})).data;
  await page.exposeFunction('hostCall',async(name:string,args:any)=>({structuredContent:await api(name,args)}));
  await page.setContent('<main><iframe title="AraRead MCP Apps" sandbox="allow-scripts" style="width:100%;max-width:480px;height:900px;border:0"></iframe></main>');
  await page.evaluate(()=>{(window as any).messages=[];window.addEventListener('message',async event=>{const m=event.data,frame=document.querySelector('iframe')!;if(event.source!==frame.contentWindow||m.jsonrpc!=='2.0'||!m.id)return;let result:any={};if(m.method==='tools/call')result=await(window as any).hostCall(m.params.name,m.params.arguments);if(m.method==='ui/message')(window as any).messages.push(m.params);event.source!.postMessage({jsonrpc:'2.0',id:m.id,result},{targetOrigin:'*'});});});
  await page.locator('iframe').evaluate((e:any,html)=>e.srcdoc=html,widgetHtml);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'AraRead',exact:true})).toBeVisible();
  await page.locator('iframe').evaluate((e:any,data)=>e.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{ok:true,data}}},'*'),c);
  await frame.getByRole('button',{name:'Original',exact:true}).click();await expect(frame.locator('#text')).toHaveText(c.original);
  await frame.getByText('Entender esta passagem',{exact:true}).click();await frame.getByLabel('Termo, expressão ou pergunta',{exact:true}).fill('O que é uma condição?');await frame.getByRole('button',{name:'Apoio breve',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).messages.length)).toBe(1);expect((await api('reading_context',{reading_id:w.reading_id})).data.reading.covered).toEqual([]);
  await frame.getByRole('button',{name:'Continuar →',exact:true}).click();await expect(frame.locator('#status')).toHaveText('Porção percorrida, sem inferir compreensão.');expect((await api('reading_context',{reading_id:w.reading_id})).data.reading.covered.length).toBe(1);
 }finally{await api('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:title});}
});
