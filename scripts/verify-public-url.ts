import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {extract} from '../src/importers.ts';
const x=await extract({format:'url',url:'https://example.com/'});assert.match(x.original.toString(),/Example Domain/);assert.ok(x.blocks.length);
let rejected=false;try{await extract({format:'url',url:'https://httpbin.org/redirect-to?url=https%3A%2F%2F127.0.0.1%2F'});}catch(e:any){assert.equal(e.code,'UNSAFE_URL');rejected=true;}assert.equal(rejected,true,'redirecionamento para loopback deve ser bloqueado');
const evidence={measured_at:new Date().toISOString(),public_html:{url:'https://example.com/',bytes:x.original.length,blocks:x.blocks.length},redirect_to_loopback:'UNSAFE_URL',scope:'Duas requisições de teste a páginas públicas, além de robots e redirecionamentos; nenhum dado pessoal.'};await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/public-url.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
