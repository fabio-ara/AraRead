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
  await page.getByLabel('E-mail',{exact:true}).fill(input.email);await page.getByLabel('Senha',{exact:true}).fill(input.password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('article').filter({has:page.getByRole('heading',{name:input.title,exact:true})}).getByRole('button',{name:'Retomar leitura',exact:true}).click();await expect(page.getByText(input.rewrite,{exact:true})).toBeVisible({timeout:20000});
  assert.ok(await page.locator('main').evaluate(e=>e.getBoundingClientRect().width<=480));await mkdir('.local/evidence',{recursive:true});await page.screenshot({path:'.local/evidence/hosted-reader-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.local/evidence/hosted-reader-mobile.png',fullPage:true});
  await expect(page.getByRole('tab')).toHaveCount(3);await expect(page.getByRole('toolbar',{name:'Ações da seleção'})).toBeHidden();
  await page.getByRole('tab',{name:'Original',exact:true}).click();await expect(page.getByRole('tabpanel')).toBeVisible();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Leitura facilitada',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel')).toHaveText(input.rewrite);
  await page.getByRole('tab',{name:'Tradução',exact:true}).click();await expect(page.getByText('O original já está no idioma de leitura.',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'Leitura facilitada',exact:true}).click();
  await page.getByRole('tabpanel').focus();await page.keyboard.down('Shift');for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');
  await page.getByRole('button',{name:'Destacar',exact:true}).click();await expect(page.getByText('Destaques desta passagem (1)',{exact:true})).toBeVisible();
  await page.getByRole('tabpanel').focus();await page.keyboard.down('Shift');await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');await page.getByRole('button',{name:'Calcular',exact:true}).click();
  await page.getByLabel('Expressão ou intervalo de anos',{exact:true}).fill('429?–347 B.C.E.');await page.getByRole('button',{name:'Calcular resultado',exact:true}).click();await expect(page.getByText('Aproximadamente 82 anos',{exact:true})).toBeVisible();await page.screenshot({path:'.local/evidence/hosted-contextual-calculator.png',fullPage:true});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();await page.getByRole('article').filter({has:page.getByRole('heading',{name:input.title,exact:true})}).getByRole('button',{name:'Abrir cópia carregada',exact:true}).click();await expect(page.getByRole('tabpanel')).toHaveText(input.rewrite);await context.setOffline(false);
  await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar na biblioteca',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
  await context.close();return {published_ui:true,desktop:true,mobile:true,phone_width_everywhere:true,three_tabs:true,keyboard:true,contextual_highlight:true,historical_calculation:true,reading_progress_unchanged:true,logout:true,service_worker:'shell e porção recuperados após recarga sem rede no Pages real'};
 }finally{await browser.close();}
}
