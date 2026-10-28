import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {SignJWT,importJWK} from 'jose';

test('recuperacao real do Auth permite definir senha e entrar novamente',async({page,request})=>{
 const jwk=JSON.parse(await readFile('.local/jwt-keys.json','utf8'))[0];
 const adminToken=await new SignJWT({role:'service_role'}).setProtectedHeader({alg:'ES256',kid:jwk.kid}).setIssuer('http://127.0.0.1:4317/auth/v1').setAudience('authenticated').setExpirationTime('2m').sign(await importJWK({...jwk,key_ops:['sign']},'ES256'));
 const headers={authorization:`Bearer ${adminToken}`},auth='http://127.0.0.1:4318',email=`araread-password-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
 const created=await request.post(`${auth}/admin/users`,{headers,data:{email,password:randomBytes(24).toString('base64url'),email_confirm:true}});
 expect(created.ok()).toBeTruthy();const user=await created.json();
 try{
  const link=await request.post(`${auth}/admin/generate_link`,{headers,data:{type:'recovery',email,redirect_to:'http://127.0.0.1:4317/?account=setup'}});
  expect(link.ok()).toBeTruthy();const data=await link.json();
  await page.goto(data.action_link);
  await expect(page.getByRole('heading',{name:'Definir sua senha',exact:true})).toBeVisible();
  await mkdir('.local/evidence',{recursive:true});await page.screenshot({path:'.local/evidence/password-setup.png',fullPage:true});
  await page.getByLabel('Nova senha',{exact:true}).fill(password);await page.getByLabel('Repita a nova senha',{exact:true}).fill(password+'x');await page.getByRole('button',{name:'Salvar senha',exact:true}).click();await expect(page.getByText('As duas senhas precisam ser iguais.',{exact:true})).toBeVisible();
  await page.getByLabel('Repita a nova senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Salvar senha',exact:true}).click();await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();await expect(page.getByText('Senha definida.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na biblioteca',exact:true}).click();await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();
 }finally{const removed=await request.delete(`${auth}/admin/users/${user.id}`,{headers});expect(removed.ok()).toBeTruthy();}
});
