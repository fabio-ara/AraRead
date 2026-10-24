// Gera o checkout estático da instalação existente, sem criar outro Site.
import {mkdir,readFile,copyFile,readdir,cp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const hosting=JSON.parse(await readFile('hosting/frontend.json','utf8')),root=resolve('.local/sites-araread');
if(!hosting.project_id||!hosting.api_base.startsWith('https://'))throw new Error('Configuração de hospedagem incompleta.');
for(const path of [root,`${root}/src/web`,`${root}/.openai`])await mkdir(path,{recursive:true});
const existing=await readFile(`${root}/.openai/hosting.json`,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
if(existing.project_id&&existing.project_id!==hosting.project_id)throw new Error('O checkout pertence a outro Site.');
for(const name of ['index.html','package.json','package-lock.json','tsconfig.json','LICENSE','THIRD_PARTY_NOTICES.md','THIRD_PARTY_LICENSES.txt'])await copyFile(name,`${root}/${name}`);
for(const name of await readdir('src/web'))await copyFile(`src/web/${name}`,`${root}/src/web/${name}`);
await cp('public',`${root}/public`,{recursive:true});
await writeFile(`${root}/.openai/hosting.json`,JSON.stringify({...existing,project_id:hosting.project_id,static:{directory:'dist'}},null,2));
await writeFile(`${root}/vite.config.ts`,`import {defineConfig} from 'vite';\nexport default defineConfig({define:{'import.meta.env.VITE_API_BASE':${JSON.stringify(JSON.stringify(hosting.api_base))}},build:{target:'es2023',outDir:'dist',assetsInlineLimit:0}});\n`);
await writeFile(`${root}/.gitignore`,'node_modules/\ndist/\n.openai/*.local.json\n');
console.log(`Interface preparada em ${root}; identidade do Site existente preservada.`);
