import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { parseHTML } from 'linkedom';
import ipaddr from 'ipaddr.js';
import { blockSchema,type Block,type Extraction } from './contracts.ts';
import { AppError,ensure } from './errors.ts';
const MAX=8*1024*1024;
export interface ImportInput {format:string;text?:string;file_base64?:string;filename?:string;url?:string;blocks?:Block[]}
export function publicAddress(address:string){try{const ip=ipaddr.process(address);return ip.range()==='unicast';}catch{return false;}}
export async function validatePublicUrl(value:string){
 const u=new URL(value);ensure(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443'),'UNSAFE_URL','Importação de página exige HTTPS público, sem credenciais e na porta padrão.');
 const host=u.hostname.replace(/^\[|\]$/g,'');ensure(!/(^|\.)(localhost|local|internal|test|onion)$/i.test(host),'UNSAFE_URL','Endereço interno não permitido.');
 const addresses=await lookup(host,{all:true,verbatim:true});ensure(addresses.length&&addresses.every(x=>publicAddress(x.address)),'UNSAFE_URL','A resolução do endereço aponta para rede interna ou reservada.');
 return {url:u,address:addresses[0]};
}
async function getPublic(value:string,maxBytes:number,signal:AbortSignal):Promise<{body:Buffer;mime:string;status:number;location?:string}>{
 const {url,address}=await validatePublicUrl(value);
 return new Promise((resolve,reject)=>{
  const req=request(url,{method:'GET',signal,headers:{'User-Agent':'AraRead/0.1 (single-page user-directed importer)','Accept':'text/html, text/plain;q=0.8','Accept-Encoding':'identity'},lookup:((_host:any,opts:any,cb:any)=>opts?.all?cb(null,[address]):cb(null,address.address,address.family)) as any},response=>{
   const status=response.statusCode||500,mime=(response.headers['content-type']||'').split(';')[0].toLowerCase();
   if(status>=300&&status<400){response.resume();resolve({body:Buffer.alloc(0),mime,status,location:response.headers.location});return;}
   if(Number(response.headers['content-length']||0)>maxBytes){response.destroy();reject(new AppError('TOO_LARGE','Página excede o limite de bytes.',413));return;}
   const chunks:Buffer[]=[];let bytes=0;
   response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>maxBytes){response.destroy();reject(new AppError('TOO_LARGE','Página excede o limite de bytes.',413));}else chunks.push(chunk);});
   response.on('end',()=>resolve({body:Buffer.concat(chunks),mime,status}));response.on('error',reject);
  });req.on('error',reject);req.end();
 });
}
export async function fetchPublicHtml(value:string){
 const signal=AbortSignal.timeout(10000);let current=new URL(value);
 for(let redirects=0;redirects<=3;redirects++){
  // Não contorna regras explícitas de obtenção automática do site.
  const robots=await getPublic(new URL('/robots.txt',current).href,65536,signal);
  if(robots.status===200){let applies=false;for(const line of robots.body.toString('utf8').split(/\r?\n/)){const [key,...parts]=line.split(':');const val=parts.join(':').split('#')[0].trim();if(key.trim().toLowerCase()==='user-agent')applies=val==='*'||/araread/i.test(val);if(applies&&key.trim().toLowerCase()==='disallow'&&val&&current.pathname.startsWith(val))throw new AppError('ROBOTS_DENIED','O site não permite obter esta página automaticamente. Forneça texto autorizado.');}}
  const result=await getPublic(current.href,MAX,signal);
  if(result.status>=300&&result.status<400){ensure(result.location&&redirects<3,'REDIRECT_LIMIT','Redirecionamentos excessivos ou inválidos.');current=new URL(result.location,current);continue;}
  ensure(result.status===200,'SOURCE_UNAVAILABLE','Página indisponível, protegida ou não autorizada. Não é possível contornar autenticação.');
  ensure(['text/html','application/xhtml+xml'].includes(result.mime),'UNSUPPORTED_TYPE','O endereço deve devolver uma página HTML pública.');
  return result.body;
 }
 throw new AppError('REDIRECT_LIMIT','Redirecionamentos excessivos.');
}
function utf8(bytes:Buffer){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new AppError('ENCODING','Forneça texto UTF-8 válido.');}}
function textBlocks(text:string,markdown=false):Block[]{
 if(!markdown)return text.split(/\r?\n\s*\r?\n/).filter(x=>x.trim()).map(text=>({kind:'paragraph',text,meta:{}}));
 const lines=text.split(/\r?\n/),blocks:Block[]=[];let pending:string[]=[];
 const flush=()=>{if(pending.length){blocks.push({kind:'paragraph',text:pending.join('\n'),meta:{}});pending=[];}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim()){flush();continue;}
  const fence=line.match(/^\s*(```+|~~~+)(.*)$/);if(fence){flush();const body=[];while(++i<lines.length&&!lines[i].trim().startsWith(fence[1]))body.push(lines[i]);blocks.push({kind:'code',text:body.join('\n')||' ',meta:{language:fence[2].trim()}});continue;}
  if(line.trim()==='$$'){flush();const body=[];while(++i<lines.length&&lines[i].trim()!=='$$')body.push(lines[i]);blocks.push({kind:'equation',text:body.join('\n')||' ',meta:{notation:'original'}});continue;}
  const heading=line.match(/^(#{1,6})\s+(.+)/);if(heading){flush();blocks.push({kind:'heading',text:heading[2],meta:{level:heading[1].length}});continue;}
  if(/^\s*\|/.test(line)&&i+1<lines.length&&/\|?\s*:?-{3}/.test(lines[i+1])){flush();const rows=[line.split('|').slice(1,-1).map(x=>x.trim())];i++;while(i+1<lines.length&&/^\s*\|/.test(lines[i+1]))rows.push(lines[++i].split('|').slice(1,-1).map(x=>x.trim()));blocks.push({kind:'table',text:rows.map(x=>x.join(' | ')).join('\n'),meta:{rows}});continue;}
  const figure=line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);if(figure){flush();blocks.push({kind:'figure',text:figure[1]||'Figura sem descrição na fonte.',meta:{alt:figure[1],source:figure[2],observed:false}});continue;}
  const note=line.match(/^\[\^([^\]]+)\]:\s*(.*)/);if(note){flush();blocks.push({kind:'note',text:note[2]||' ',locator:`nota ${note[1]}`,meta:{label:note[1]}});continue;}
  if(/^\s*>/.test(line)){flush();blocks.push({kind:'quote',text:line.replace(/^\s*> ?/,'' )||' ',meta:{}});continue;}
  if(/^\s*([-*+] |\d+\. )/.test(line)){flush();blocks.push({kind:'list',text:line,meta:{}});continue;}
  pending.push(line);
 }
 flush();return blocks;
}
function htmlBlocks(text:string):Block[]{
 const {document}=parseHTML(text),blocks:Block[]=[];
 document.querySelectorAll('script,style,noscript,template,iframe,object,embed').forEach(x=>x.remove());
 const root=document.querySelector('main,article')||document.body||document.documentElement;
 const walk=(node:any)=>{
  if(node.nodeType===3){if(node.textContent.trim())blocks.push({kind:'paragraph',text:node.textContent,meta:{}});return;}
  if(node.nodeType!==1)return;
  const tag=node.tagName.toLowerCase(),text=(node.textContent||'').trim();
  if(tag==='figure'||tag==='img'){const img=tag==='img'?node:node.querySelector('img'),caption=node.querySelector?.('figcaption')?.textContent||'',alt=img?.getAttribute('alt')||'';blocks.push({kind:'figure',text:[alt,caption].filter(Boolean).join('\n')||'Figura sem descrição. Imagem não interpretada.',meta:{alt,caption,observed:false}});return;}
  if(tag==='table'){const rows=Array.from(node.querySelectorAll('tr')).map((r:any)=>Array.from(r.querySelectorAll('th,td')).map((c:any)=>c.textContent.trim()));blocks.push({kind:'table',text:rows.map((r:any)=>r.join(' | ')).join('\n')||text||'Tabela sem texto extraível.',meta:{rows}});return;}
  if(['math','svg'].includes(tag)){blocks.push({kind:tag==='math'?'equation':'unknown',text:node.outerHTML,meta:{representation:'original_markup_as_text',interpretation:'not_verified'}});return;}
  const kind=/^h[1-6]$/.test(tag)?'heading':({p:'paragraph',pre:'code',blockquote:'quote',li:'list',aside:'note'} as Record<string,string>)[tag];
  if(kind&&text){blocks.push({kind,text,meta:kind==='heading'?{level:Number(tag[1])}:{}});return;}
  for(const child of node.childNodes)walk(child);
 };
 if(root)walk(root);return blocks;
}
async function pdfBlocks(bytes:Buffer){
 ensure(bytes.subarray(0,5).toString()==='%PDF-','INVALID_PDF','Arquivo sem cabeçalho PDF.');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,stopAtErrors:true,disableFontFace:true});
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([(async()=>{
   const pdf=await task.promise;ensure(pdf.numPages<=500,'TOO_MANY_PAGES','O limite desta versão é 500 páginas.');
   const blocks:Block[]=[],warnings=['Extração de PDF não verificada: confira a ordem, fórmulas, notas, tabelas e figuras no original. Imagens não foram interpretadas.'];let empty=0;
   for(let page=1;page<=pdf.numPages;page++){
    const p=await pdf.getPage(page),content=await p.getTextContent();let text='';
    for(const item of content.items){if('str'in item)text+=item.str+(item.hasEOL?'\n':' ');}
    if(!text.trim()){empty++;blocks.push({kind:'unknown',text:'Página sem texto extraível. Forneça uma transcrição vinculada a esta página.',locator:`página ${page}`,meta:{page,extraction:'missing',image_observed:false}});}
    else blocks.push({kind:'paragraph',text:text.trim(),locator:`página ${page}`,meta:{page,extraction:'unverified'}});
    p.cleanup();
   }
   if(empty)warnings.push(`${empty} página(s) sem camada textual. OCR não executado; extração parcial.`);
   return {blocks,warnings};
  })(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{void task.destroy();reject(new AppError('PDF_TIMEOUT','Extração demorou demais. Preserve o arquivo e forneça transcrição.'));},15000);})]);
 }catch(e){if(e instanceof AppError)throw e;throw new AppError('INVALID_PDF','PDF protegido, danificado ou sem extração segura. Forneça uma transcrição autorizada.');}finally{clearTimeout(timeout);await task.destroy();}
}
export async function extract(input:ImportInput):Promise<Extraction>{
 let bytes:Buffer;
 if(input.format==='url'){ensure(input.url,'VALIDATION','Informe o URL público.');bytes=await fetchPublicHtml(input.url);}
 else if(input.file_base64!==undefined){ensure(input.file_base64.length<=Math.ceil(MAX/3)*4&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.file_base64),'INVALID_FILE','Base64 inválido ou arquivo acima de 8 MiB.');bytes=Buffer.from(input.file_base64,'base64');}
 else if(input.format==='structured'){ensure(input.blocks?.length,'VALIDATION','Forneça blocos estruturados.');bytes=Buffer.from(JSON.stringify(input.blocks),'utf8');}
 else {ensure(input.text!==undefined,'VALIDATION','Forneça texto ou arquivo.');bytes=Buffer.from(input.text,'utf8');}
 ensure(bytes.length>0&&bytes.length<=MAX,'TOO_LARGE','Forneça um original de até 8 MiB.',413);
 let blocks:Block[],warnings:string[]=[],mime='text/plain';
 if(input.format==='pdf'){const result=await pdfBlocks(bytes);blocks=result.blocks;warnings=result.warnings;mime='application/pdf';}
 else if(input.format==='structured'){blocks=input.blocks!.map(x=>blockSchema.parse(x));mime='application/json';}
 else if(['url','html'].includes(input.format)){blocks=htmlBlocks(utf8(bytes));mime='text/html';warnings=['HTML: imagens não interpretadas; scripts e componentes interativos não foram executados. Confira a representação extraída.'];}
 else {blocks=textBlocks(utf8(bytes),input.format==='markdown');if(input.format==='markdown')mime='text/markdown';}
 ensure(blocks.length>0&&blocks.length<=20000,'EMPTY_SOURCE','A fonte não contém texto extraível dentro do limite de 20 mil elementos.');
 for(const b of blocks)ensure(blockSchema.safeParse(b).success,'ELEMENT_LIMIT','Um elemento excede 100 mil caracteres ou possui metadados inválidos. Forneça uma transcrição dividida por sentido; não divida fórmulas ou provas automaticamente.');
 return {blocks,warnings,original:bytes,mime,filename:input.filename||({pdf:'original.pdf',markdown:'original.md',html:'original.html',url:'original.html',structured:'original.json'} as Record<string,string>)[input.format]||'original.txt'};
}
