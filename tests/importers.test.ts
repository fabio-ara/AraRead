import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract,publicAddress,validatePublicUrl } from '../src/importers.ts';
import { portion,cp,mergeIntervals } from '../src/anchors.ts';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('TXT/Markdown preservam bytes, ordem e elementos estruturados',async()=>{
 const text='# Amostra sintética\n\nA hipótese pode ser válida. Não é certeza.\n\n$$\na^2+b^2=c^2\n$$\n\n| Medida | Valor |\n|---|---|\n| n | 12 |\n\n![Descrição informada](figura.svg)\n\n```js\nthrow new Error("não executar");\n```\n\n[^1]: Nota da amostra.';
 const result=await extract({format:'markdown',text});assert.equal(result.original.toString(),text);
 assert.deepEqual(result.blocks.map(x=>x.kind),['heading','paragraph','equation','table','figure','code','note']);
 assert.equal(result.blocks[4].meta.observed,false);assert.equal((result.blocks[3].meta.rows as string[][])[1][0],'n');
});
test('HTML malicioso vira somente dados e mantém original',async()=>{
 const text='<html><body><article><h1>Amostra</h1><script>fetch("https://evil.test")</script><p onclick="alert(1)">Olá <b>mundo</b>.</p><svg onload="alert(1)"><text>Figura</text></svg><img src="http://169.254.169.254/" alt="não observada"><table><tr><td>1</td><td>2</td></tr></table></article></body></html>';
 const x=await extract({format:'html',text});assert.equal(x.original.toString(),text);assert.ok(!x.blocks.some(b=>b.text.includes('fetch(')));assert.ok(x.blocks.some(b=>b.kind==='unknown'));assert.ok(x.warnings.length);
});
test('SSRF rejeita redes internas IPv4/IPv6, credenciais e esquemas',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','192.168.1.1','172.16.0.1','169.254.169.254','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1','100.64.0.1'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const url of ['http://example.com','file:///etc/passwd','https://a:b@example.com','https://127.0.0.1','https://[::1]','https://localhost','https://example.com:444'])await assert.rejects(()=>validatePublicUrl(url));
});
test('UTF8 inválido, arquivo excessivo e Base64 inválido são rejeitados',async()=>{
 await assert.rejects(()=>extract({format:'text',file_base64:'/w=='}),/UTF-8/);
 await assert.rejects(()=>extract({format:'text',file_base64:'%%%'}),/Base64/);
 await assert.rejects(()=>extract({format:'text',text:'x'.repeat(8*1024*1024+1)}),/8 MiB/);
});
test('intervalos Unicode [início,fim) cobrem texto longo sem perder espaços',()=>{
 const text=('Ação possível 😀. العربية 日本語 é. ').repeat(250),element={id:randomUUID(),source_id:randomUUID(),ordinal:0,kind:'paragraph',text,locator:'sintético',meta:{}};
 let start=0,joined='',covered:any[]=[];while(start<cp(text).length){const ref=portion(element,start,'short');joined+=cp(text).slice(ref.start,ref.end).join('');covered=mergeIntervals(covered,ref);start=ref.end;}
 assert.equal(joined,text);assert.equal(covered.length,1);assert.equal(covered[0].end,cp(text).length);
 const proof={...element,kind:'proof'};assert.equal(portion(proof,0,'short').end,cp(text).length);
});
test('tipo desconhecido e figura permanecem preservados sem interpretação fabricada',async()=>{
 const blocks=[{kind:'ritual_structure',text:'א ב ג',locator:'região A',meta:{interpretation:'pending'}},{kind:'figure',text:'Imagem fornecida sem transcrição',meta:{observed:false}}];
 const x=await extract({format:'structured',blocks});assert.deepEqual(x.blocks,blocks);assert.equal(JSON.parse(x.original.toString())[0].kind,'ritual_structure');
});
test('PDF textual preserva bytes e declara página sem texto sem inventar imagem',async()=>{
 const original=await readFile('tests/fixtures/synthetic-extraction.pdf');const x=await extract({format:'pdf',filename:'synthetic-extraction.pdf',file_base64:original.toString('base64')});
 assert.deepEqual(x.original,original);assert.equal(x.blocks.length,2);assert.match(x.blocks[0].text,/Association is not a proof/);assert.equal(x.blocks[1].meta.extraction,'missing');assert.match(x.warnings.join(' '),/OCR não executado/);assert.equal(x.blocks[1].locator,'página 2');
});
