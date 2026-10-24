import { randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
if(process.env.APP_MODE!=='local')throw new Error('Contas sintéticas só podem ser criadas em APP_MODE=local.');
const path='.local/test-accounts.json';await mkdir('.local',{recursive:true});
let accounts:{email:string;password:string}[];
try{accounts=JSON.parse(await readFile(path,'utf8'));}catch{accounts=[1,2].map(i=>({email:`leitor-${i}-${randomBytes(4).toString('hex')}@araread.test`,password:randomBytes(24).toString('base64url')}));}
for(const account of accounts){
 const login=await fetch('http://127.0.0.1:4318/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(account)});
 if(login.ok)continue;
 const response=await fetch('http://127.0.0.1:4318/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(account)});
 if(!response.ok)throw new Error(`Falha ao criar identidade sintética (${response.status}).`);
}
await writeFile(path,JSON.stringify(accounts,null,2),{mode:0o600});
console.log('Duas contas locais prontas. Credenciais exclusivamente em .local/test-accounts.json (ignorado pelo Git).');
