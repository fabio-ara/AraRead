import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {extract} from '../src/importers.ts';
const directory=resolve('.local',`legacy-fixture-${randomUUID()}`);await mkdir(directory,{recursive:true});await chmod(directory,0o777);
await writeFile(resolve(directory,'synthetic.html'),'<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conversão sintética AraRead</title></head><body><h1>Condição e negação</h1><p>Uma hipótese não é certeza. Se a condição mudar, o resultado pode mudar. Ação, Ελληνικά e العربية.</p><table><tr><td>Hipótese</td><td>Condição</td></tr></table><p>Fórmula fornecida: x² + 1.</p></body></html>');
await writeFile(resolve(directory,'generate.py'),`import subprocess, pathlib\np=pathlib.Path('/tmp/profile/user');p.mkdir(parents=True)\nsubprocess.run(['soffice','-env:UserInstallation=file:///tmp/profile','--headless','--norestore','--convert-to','doc:MS Word 97','--outdir','/fixture','/fixture/synthetic.html'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=90)\nsubprocess.run(['ebook-convert','/fixture/synthetic.html','/fixture/synthetic.mobi'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=90)\n`);
const generate=spawnSync('docker',['run','--rm','--network','none','--memory','1g','--cpus','1','--pids-limit','128','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,size=512m','-v',`${directory}:/fixture`,'--entrypoint','python3','araread-convert:1','/fixture/generate.py'],{timeout:200000,maxBuffer:1048576,encoding:'utf8',windowsHide:true});assert.equal(generate.status,0,'Criação de documentos sintéticos reais no conversor isolado.');
for(const format of ['doc','mobi']){
 const source=resolve(directory,`synthetic.${format}`),output=resolve(directory,`prepared-${format}.json`);
 const conversion=spawnSync(process.execPath,['--import','tsx','scripts/convert-legacy.ts',source,output],{timeout:150000,maxBuffer:1048576,encoding:'utf8',windowsHide:true});assert.equal(conversion.status,0,conversion.stderr);
 const prepared=JSON.parse(await readFile(output,'utf8')),original=await readFile(source),result=await extract(prepared),text=result.blocks.map(b=>b.text).join('\n');
 const provenance=result.blocks[0].meta.conversion as {original_sha256:string;tool:string;version:string};
 assert.match(text,/hipótese não é certeza/);assert.match(text,/Ελληνικά/);assert.match(text,/العربية/);assert.match(text,/x²/);assert.deepEqual(result.original,original);assert.equal(result.quality.original_required,true);assert.equal(result.quality.status,'partial');assert.equal(provenance.original_sha256,createHash('sha256').update(original).digest('hex'));
 console.log(JSON.stringify({format,original_bytes:original.length,canonical_elements:result.blocks.length,original_identical:true,unicode_preserved:true,tool:provenance.tool,version:provenance.version}));
}
