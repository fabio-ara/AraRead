import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve('.local/edge-release/supabase/functions/araread');
const {WorkerMessageHandler}=await import(pathToFileURL(`${root}/vendor/pdf.worker.mjs`).href);
(globalThis as any).pdfjsWorker={WorkerMessageHandler};
const packaged=await import(pathToFileURL(`${root}/vendor/pdf.mjs`).href),reference=await import('pdfjs-dist/legacy/build/pdf.mjs');
assert.equal(packaged.version,reference.version);
async function content(pdfjs:any,bytes:Uint8Array){
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,stopAtErrors:true,disableFontFace:true});
 try{const pdf=await task.promise,pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);pages.push({text:await page.getTextContent(),operators:await page.getOperatorList()});page.cleanup();}return pages;}finally{await task.destroy();}
}
for(const file of ['synthetic-extraction.pdf','synthetic-scanned.pdf']){
 const bytes=await readFile(`tests/fixtures/${file}`),expected=await content(reference,bytes),actual=await content(packaged,bytes);
 assert.deepEqual(actual,expected);console.log(`PDF.js ${packaged.version}: texto, posições e operadores equivalentes em ${file}.`);
}
