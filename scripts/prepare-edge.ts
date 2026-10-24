// Empacotamento local, sem credenciais ou operações remotas. A CLI recebe
// explicitamente o ref confirmado somente na etapa posterior de implantação.
import {mkdir,readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.local/edge-release'),fn=resolve(root,'supabase/functions/araread');
for(const path of [fn,`${fn}/src`,`${fn}/vendor`])await mkdir(path,{recursive:true});
for(const name of await readdir('src'))if(name.endsWith('.ts'))await copyFile(`src/${name}`,`${fn}/src/${name}`);
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile(`node_modules/pdfjs-dist/legacy/build/${name}`,`${fn}/vendor/${name}`);
await copyFile('node_modules/pdfjs-dist/LICENSE',`${fn}/vendor/PDFJS-LICENSE`);
const pkg=JSON.parse(await readFile('package.json','utf8')),imports:Record<string,string>={};
for(const [name,version]of Object.entries(pkg.dependencies))imports[name]=`npm:${name}@${version}`;
imports['pdfjs-dist/legacy/build/pdf.mjs']='./vendor/pdf.mjs';
await writeFile(`${fn}/deno.json`,JSON.stringify({imports},null,2));
await writeFile(`${fn}/index.ts`,[
 "import {Buffer} from 'node:buffer';",
 "import {WorkerMessageHandler} from './vendor/pdf.worker.mjs';",
 '(globalThis as any).Buffer=Buffer;',
 '(globalThis as any).pdfjsWorker={WorkerMessageHandler};',
 "const {edgeFetch}=await import('./src/edge-http.ts');",
 'Deno.serve(edgeFetch);','',
].join('\n'));
// ES256 e descoberta OAuth são verificados pelo aplicativo. O verificador
// legado do gateway não aceita o JWT assimétrico do projeto nem rotas públicas.
await writeFile(`${root}/supabase/config.toml`,'project_id = "araread-edge"\n[functions.araread]\nverify_jwt = false\n');
console.log(`Pacote preparado em ${root}; nenhum recurso remoto alterado.`);
