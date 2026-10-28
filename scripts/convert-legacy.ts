import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,extname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {extract} from '../src/importers.ts';
const [input,output]=process.argv.slice(2);
if(!input||!output){console.log('Uso: npx tsx scripts/convert-legacy.ts arquivo.doc|mobi preparo.json\nRequer: docker build -f Dockerfile.convert -t araread-convert:1 .');process.exit(1);}
const source=resolve(input),kind=extname(source).slice(1).toLowerCase();if(!['doc','mobi'].includes(kind))throw Error('Escolha DOC binário ou MOBI. EPUB, DOCX e PPTX têm adaptadores diretos.');
const original=await readFile(source);if(!original.length||original.length>8*1024*1024)throw Error('O original deve ter até 8 MiB.');
const stage=resolve('.local',`conversion-${randomUUID()}`),incoming=resolve(stage,'input'),outgoing=resolve(stage,'output');await mkdir(incoming,{recursive:true});await mkdir(outgoing,{recursive:true});await chmod(outgoing,0o777);await writeFile(resolve(incoming,`source.${kind}`),original);
const result=spawnSync('docker',['run','--rm','--network','none','--memory','1g','--cpus','1','--pids-limit','128','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,size=512m','-v',`${incoming}:/input:ro`,'-v',`${outgoing}:/output`,'araread-convert:1',kind],{timeout:120000,maxBuffer:1048576,windowsHide:true,encoding:'utf8'});
if(result.error||result.status!==0)throw Error('Conversão isolada falhou. Confira a instalação da imagem e o formato; nenhum original foi alterado.');
const provenance=JSON.parse(await readFile(resolve(outgoing,'provenance.json'),'utf8')),converted=await readFile(resolve(outgoing,`converted.${provenance.converted_format}`));
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');if(provenance.original_sha256!==digest(original)||provenance.converted_sha256!==digest(converted))throw Error('Os hashes de conversão não conferem.');
const prepared=await extract({format:provenance.converted_format,file_base64:converted.toString('base64')});
prepared.blocks[0].meta={...prepared.blocks[0].meta,conversion:{...provenance,prepared_at:new Date().toISOString()},essential_visual:true};
const bundle={format:'structured',blocks:prepared.blocks,file_base64:original.toString('base64'),filename:basename(source),retain_original:true};
const body=JSON.stringify(bundle);if(Buffer.byteLength(body)>8*1024*1024)throw Error('O preparo excede 8 MiB; conserve o original e divida o material por unidades estruturais antes da importação.');
await writeFile(resolve(output),body,{flag:'wx'});console.log(JSON.stringify({format:kind,canonical_elements:prepared.blocks.length,original_bytes:original.length,prepared_bytes:Buffer.byteLength(body),tool:provenance.tool,version:provenance.version,original_preserved:true}));
