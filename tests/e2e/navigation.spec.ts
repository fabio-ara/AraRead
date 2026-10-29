import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {prepareDemo} from '../fixtures/study-edition.ts';
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));

// WebKit routes controlled requests through its service worker, outside page.route.
// This test deliberately delays an HTTP response. Offline coverage keeps service
// workers enabled in reading.spec.ts and editions.spec.ts.
test.use({serviceWorkers:'block'});
test('resposta atrasada da biblioteca preserva o rascunho aberto em outra tela',async({page})=>{
 await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Edições',exact:true})).toBeVisible();
 let release:(()=>void)|undefined;
 await page.route('**/api/library_list',async route=>{await new Promise<void>(resolve=>release=resolve);await route.continue();});
 try{
  await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect.poll(()=>!!release).toBe(true);
  await page.getByRole('button',{name:'Importar',exact:true}).click();await page.getByLabel('Título da obra',{exact:true}).fill('Rascunho sintético durante navegação');await page.getByLabel('Texto ou transcrição',{exact:true}).fill('Texto ainda não enviado.');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/library_list'));release!();await (await response).finished();
  // Allows the completed response and asynchronous IndexedDB writes to settle.
  await page.waitForTimeout(300);
  await expect(page.getByLabel('Título da obra',{exact:true})).toHaveValue('Rascunho sintético durante navegação');await expect(page.getByLabel('Texto ou transcrição',{exact:true})).toHaveValue('Texto ainda não enviado.');
 }finally{release?.();await page.unroute('**/api/library_list');}
});

test('busca de edições pendente sinaliza indisponibilidade e permite abrir após a resposta',async({page,request})=>{
 const signed=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await signed.json()).access_token;
 const demo=await prepareDemo(async(name,args)=>{const r=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args}),out=await r.json();expect(out.ok,out.error?.message).toBeTruthy();return out.data;},`Busca pendente sintética ${randomUUID()}`);
 await page.goto('/');await page.getByRole('button',{name:'Explorar edições públicas',exact:true}).click();
 const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:demo.title,exact:true})});await expect(card).toBeVisible();
 let release:(()=>void)|undefined;
 await page.route('**/api/public/edition_catalog',async route=>{await new Promise<void>(resolve=>release=resolve);await route.continue();});
 try{
  await page.getByLabel('Procurar',{exact:true}).fill(demo.title);await page.getByRole('button',{name:'Buscar',exact:true}).click();await expect.poll(()=>!!release).toBe(true);
  await expect(card.getByRole('button',{name:'Abrir edição',exact:true})).toBeDisabled();
  release!();await expect(card.getByRole('button',{name:'Abrir edição',exact:true})).toBeEnabled();
  await card.getByRole('button',{name:'Abrir edição',exact:true}).click();await expect(page.getByRole('heading',{name:'A luz da sala',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Anterior',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Próxima',exact:true})).toBeEnabled();
 }finally{release?.();await page.unroute('**/api/public/edition_catalog');}
});
