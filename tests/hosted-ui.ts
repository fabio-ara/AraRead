import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
// Frontend público Pages, biblioteca privada: autenticação comum de leitor.
export async function verifyHostedUi(input:{url:string;email:string;password:string;title:string;rewrite:string}){
 const url=new URL(input.url);assert.equal(url.protocol,'https:');
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors:string[]=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:false});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));page.on('download',()=>errors.push('UI_DOWNLOAD_FORBIDDEN'));
  const opened=await page.goto(url.href);assert.equal(opened?.status(),200);
  await page.getByLabel('E-mail',{exact:true}).fill(input.email);await page.getByLabel('Senha',{exact:true}).fill(input.password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('article').filter({has:page.getByRole('heading',{name:input.title,exact:true})}).getByRole('button',{name:'Retomar leitura',exact:true}).click();await expect(page.getByText(input.rewrite,{exact:true})).toBeVisible({timeout:20000});
  assert.ok(await page.locator('main').evaluate(e=>e.getBoundingClientRect().width<=480));await mkdir('.local/evidence',{recursive:true});await page.screenshot({path:'.local/evidence/hosted-reader-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.local/evidence/hosted-reader-mobile.png',fullPage:true});
  await page.getByLabel('Sua anotação',{exact:true}).fill('Pergunta sintética conferida na interface hospedada.');await page.getByRole('button',{name:'Guardar anotação',exact:true}).click();await expect(page.getByText('Anotação salva e conferida na leitura.',{exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('combobox',{name:'Idioma de saída',exact:true}).selectOption('ja');await expect(page.getByText('Idioma usado somente nesta consulta.',{exact:true})).toBeVisible({timeout:15000});await page.getByRole('combobox',{name:'Idioma de saída',exact:true}).selectOption('pt-BR');await expect(page.getByText(input.rewrite,{exact:true})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Marcar esta porção como percorrida',exact:true}).click();await expect(page.getByText('Porção marcada como percorrida. Compreensão não foi inferida.',{exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:'Preparar esta porção para uso sem rede',exact:true}).click();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();await page.getByRole('article').filter({has:page.getByRole('heading',{name:input.title,exact:true})}).getByRole('button',{name:'Abrir cópia carregada',exact:true}).click();await expect(page.getByLabel('Sua anotação',{exact:true})).toBeVisible();await context.setOffline(false);
  await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar na biblioteca',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
  await context.close();return {published_ui:true,desktop:true,mobile:true,phone_width_everywhere:true,annotations:true,language_switch:true,continue:true,logout:true,service_worker:'shell e porção recuperados após recarga sem rede no Pages real'};
 }finally{await browser.close();}
}
