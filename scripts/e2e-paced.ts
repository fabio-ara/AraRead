import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const extra=process.argv.slice(2);
const files=(await readdir('tests/e2e')).filter(name=>name.endsWith('.spec.ts')).sort();
// Every file belongs to exactly one batch. Keep the real 240/minute protection;
// the automation's much faster pace must not exhaust the shared loopback IP.
const groups=extra.length?[extra]:[
 files.filter(f=>!f.startsWith('edition')&&!f.startsWith('widget')),
 files.filter(f=>f.startsWith('edition')),
 files.filter(f=>f.startsWith('widget')),
].filter(group=>group.length).map(group=>group.map(file=>`tests/e2e/${file}`));
let failed=false;
for(const [index,args]of groups.entries()){
 if(index){console.log('Respeitando a janela real do limite HTTP entre jornadas independentes (60 s).');await new Promise(resolve=>setTimeout(resolve,60000));}
 const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...args],{stdio:'inherit',env:process.env,windowsHide:true});
 const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});if(code!==0)failed=true;
}
if(failed)process.exitCode=1;
