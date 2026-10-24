import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));

test('resposta perdida na importação técnica recupera recibo sem duplicar obra',async({page,request})=>{
 const login=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),token=(await login.json()).access_token;
 const api=async(name:string,args:any={})=>{const r=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const out=await r.json();expect(out.ok,out.error?.message).toBeTruthy();return out.data;};
 const title=`Resposta perdida 0.3 ${randomUUID()}`;let work:any;
 try{
  await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await page.getByRole('button',{name:'Importar',exact:true}).click();
  await page.getByLabel('Título da obra',{exact:true}).fill(title);await page.getByLabel('Texto ou transcrição',{exact:true}).fill('Material sintético com resposta perdida depois do commit.');
  await page.route('**/api/source_import',async route=>{await route.fetch();await route.abort('failed');},{times:1});await page.getByRole('button',{name:'Preservar e abrir leitura',exact:true}).click();await expect(page.getByText('Existe uma operação sem confirmação.',{exact:false})).toBeVisible();
  await expect.poll(async()=>(await api('library_list',{query:title})).items.length).toBe(1);work=(await api('library_list',{query:title})).items[0];
  await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'Consultar recibo',exact:true}).click();await expect(page.getByText('O recibo confirmou a gravação.',{exact:true})).toBeVisible();expect((await api('library_list',{query:title})).items).toHaveLength(1);
 }finally{if(work)await api('work_delete',{operation_id:randomUUID(),work_id:work.work_id,confirm_title:title});}
});

test('recuperação de fila anterior preserva conflito, revisão e confirmação explícita',async({page,request})=>{
 const login=await request.post('/auth/v1/token?grant_type=password',{data:accounts[0]}),session=await login.json(),token=session.access_token;
 const api=async(name:string,args:any={})=>{const r=await request.post(`/api/${name}`,{headers:{authorization:`Bearer ${token}`},data:args});const out=await r.json();expect(out.ok,out.error?.message).toBeTruthy();return out.data;};
 const title=`Recuperação legada 0.3 ${randomUUID()}`,w=await api('source_import',{operation_id:randomUUID(),title,text:'Primeira passagem.\n\nSegunda passagem.'});
 try{
  const c=await api('reading_context',{reading_id:w.reading_id});const pending={format:'araread-pending/1',operations:[{owner:session.user.id,tool:'reading_move',args:{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:c.reading.revision,ref:c.ref,action:'continue'},reading:w.reading_id,version:c.source.sha256,created:new Date().toISOString(),state:'local'}]};
  await api('note_save',{operation_id:randomUUID(),reading_id:w.reading_id,expected_revision:c.reading.revision,ref:c.ref,kind:'note',text:'Outra sessão criou uma nota antes da recuperação.',origin:'user'});
  await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(accounts[0].email);await page.getByLabel('Senha',{exact:true}).fill(accounts[0].password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await page.getByText('Recuperar fila preparada anteriormente',{exact:true}).click();await page.getByLabel('Recuperação local da mesma conta',{exact:true}).fill(JSON.stringify(pending));await page.getByRole('button',{name:'Conferir e importar intenções locais',exact:true}).click();await page.getByRole('button',{name:'Sincronizar pendências',exact:true}).click();await expect(page.getByText('Continuidade · conflito',{exact:true})).toBeVisible();expect((await api('reading_context',{reading_id:w.reading_id})).reading.covered).toEqual([]);
  await page.getByRole('button',{name:'Conferir estado no servidor',exact:true}).click();await page.getByRole('button',{name:'Conferir e reaplicar continuidade',exact:true}).click();await expect(page.getByText('Intenção reaplicada explicitamente e confirmada.',{exact:true})).toBeVisible();expect((await api('reading_context',{reading_id:w.reading_id})).reading.covered).toEqual([c.ref]);
 }finally{await api('work_delete',{operation_id:randomUUID(),work_id:w.work_id,confirm_title:title});}
});
