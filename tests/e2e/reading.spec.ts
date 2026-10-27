import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {editorialReview} from './support.ts';
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));

test('leitor apresenta três abas, preserva estudo pelo chat, responsividade e cópia offline privada',async({page,context,request})=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));page.on('download',()=>failures.push('Download pela UI é proibido.'));
 const auth=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await auth.json()).access_token;
 const api=async(name:string,args:any={})=>{const res=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const out=await res.json();expect(out.ok,out.error?.message).toBeTruthy();return out.data;};
 const pref=await api('account_context');await api('preferences_set',{operation_id:randomUUID(),expected_revision:pref.preferences.revision,language:'pt-BR'});
 await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();
 const title=`Leitor sintético ${randomUUID().slice(0,8)}`;
 await page.getByRole('button',{name:'Importar',exact:true}).click();await page.getByLabel('Título da obra',{exact:true}).fill(title);await page.getByLabel('Autoria',{exact:true}).fill('Autoria sintética');await page.getByLabel('Texto ou transcrição',{exact:true}).fill('Uma hipótese pode explicar uma observação. Isso não estabelece certeza.');await page.getByRole('button',{name:'Preservar e abrir leitura',exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 const work=(await api('library_list',{query:title})).items[0];
 try{
  await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.getByRole('tabpanel')).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText:'Peça ao assistente, no chat, para preparar e conferir esta passagem.'})).toBeVisible();
  await mkdir('.local/evidence',{recursive:true});await page.setViewportSize({width:320,height:900});await page.screenshot({path:'.local/evidence/v3-reader-unprepared.png',fullPage:true});
  let c=await api('reading_context',{reading_id:work.reading_id});const prepared=await api('context_prepare',{operation_id:randomUUID(),reading_id:work.reading_id,expected_revision:c.reading.revision,ref:c.ref,language:'pt-BR'});
  const text='Uma hipótese é uma proposta para explicar algo que observamos. Ela pode ajudar a compreender o caso, mas não estabelece certeza.';
  await api('mediation_save',{operation_id:randomUUID(),reading_id:work.reading_id,expected_revision:prepared.revision,ref:c.ref,context_id:prepared.context_id,rewrite:text,editorial_review:editorialReview,provenance:{agent:'Fixture sintética de interface',guidance_version:'1.2.0'}});
  await page.reload();await page.getByRole('article').filter({has:page.getByRole('heading',{name:title,exact:true})}).getByRole('button',{name:'Retomar leitura',exact:true}).click();await expect(page.getByRole('tabpanel')).toHaveText(text);
  await expect(page.locator('.reader button:visible')).toHaveCount(3);await expect(page.getByRole('tab')).toHaveCount(3);
  expect((await page.locator('.reader').innerText()).replace(title,'')).not.toMatch(/UUID|sha256|revisão|recibo|offset|[a-f0-9]{8}-[a-f0-9]{4}/i);
  await page.getByRole('tab',{name:'Tradução',exact:true}).click();await expect(page.getByText('O original já está no idioma de leitura.',{exact:true})).toBeVisible();await expect(page.getByRole('tabpanel')).toContainText(c.original);
  await page.getByRole('tab',{name:'Original',exact:true}).click();await expect(page.getByRole('tabpanel')).toContainText(c.original);expect((await api('reading_context',{reading_id:work.reading_id})).reading.covered).toEqual([]);
  await page.getByRole('tab',{name:'Original',exact:true}).focus();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Leitura facilitada',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel')).toHaveText(text);
  await mkdir('.local/evidence',{recursive:true});
  for(const width of [320,480,1440]){await page.setViewportSize({width,height:900});expect(await page.locator('main').evaluate(e=>e.getBoundingClientRect().width)).toBeLessThanOrEqual(480);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.local/evidence/v3-reader-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:320,height:900});await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.local/evidence/v3-reader-zoom200.png',fullPage:true});await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'.local/evidence/v3-reader-dark.png',fullPage:true});await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.getByRole('article').filter({has:page.getByRole('heading',{name:title,exact:true})}).getByRole('button',{name:'Abrir cópia carregada',exact:true}).click();await expect(page.getByRole('tabpanel')).toHaveText(text);
  await context.setOffline(false);await page.getByRole('button',{name:'Sair',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(accounts[1].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[1].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
  expect(failures).toEqual([]);
 }finally{await context.setOffline(false);await api('work_delete',{operation_id:randomUUID(),work_id:work.work_id,confirm_title:title});}
});

test('sair em outra aba remove a biblioteca privada da aba aberta',async({page,context})=>{
 await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();
 const other=await context.newPage();await other.goto('/');await expect(other.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();await other.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar na biblioteca',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toHaveCount(0);
});

test('sessão ausente conserva rascunho para a mesma conta; logout explícito o remove',async({page,request})=>{
 const auth=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]});expect(auth.ok()).toBeTruthy();const owner=(await auth.json()).user.id,key=`${owner}:draft:fixture-session-missing`;
 await page.goto('/');await page.evaluate(async({owner,key})=>{localStorage.setItem('araread-cache-owner',owner);const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('araread-private-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const t=db.transaction('data','readwrite');t.objectStore('data').put('Rascunho sintético a recuperar',key);t.oncomplete=()=>resolve();});},{owner,key});
 const draft=()=>page.evaluate(async key=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('araread-private-v1',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);});},key);
 await page.reload();await expect(page.getByRole('button',{name:'Entrar na biblioteca',exact:true})).toBeVisible();expect(await draft()).toBe('Rascunho sintético a recuperar');
 await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();expect(await draft()).toBe('Rascunho sintético a recuperar');
 await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar na biblioteca',exact:true})).toBeVisible();expect(await draft()).toBeUndefined();
});
