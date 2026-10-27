import {createClient,type Session} from '@supabase/supabase-js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './style.css';
import {cacheGet,cacheSet,clearOwner,clearLegacyContexts} from './private-cache.ts';
import {el,field} from './ui.ts';
import {queue,enqueue,syncQueue,discardQueue,removeQueued,recoverQueue,restoreQueue,invalidateReading,revalidatePrepared,preparePassage,cachedPassages,removePassage,type Queued} from './offline.ts';
import {readingPanel,disposeReadingPanel,refreshReadingPanel} from './study-panel.ts';

const button=(text:string,action:()=>unknown,attrs:Record<string,any>={})=>el('button',{type:'button',onclick:()=>busy?notice('Aguarde a confirmação da gravação em andamento.'):void guard(action),...attrs},text);
const tag=(text:string)=>el('span',{class:'tag'},text);
const app=document.querySelector<HTMLDivElement>('#app')!;
if(window.self!==window.top){app.textContent='Abra a biblioteca em uma aba própria para entrar e estudar.';throw Error('Biblioteca indisponível em frame externo. Use o painel MCP Apps no assistente.');}
const apiBase=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
const config=await fetch(`${apiBase}/api/config`).then(r=>{if(!r.ok)throw new Error('Configuração indisponível.');return r.json();}).catch(()=>JSON.parse(localStorage.getItem('araread-public-config')||'null'));
if(!config)throw new Error('A primeira abertura exige conexão.');
localStorage.setItem('araread-public-config',JSON.stringify(config));document.title=config.name;
const auth=createClient(config.supabase_url,config.publishable_key,{auth:{storageKey:'araread-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session:Session|null=(await auth.auth.getSession()).data.session;
let passwordSetup=new URLSearchParams(location.search).get('account')==='setup';
let account:any,library:any={items:[],pagination:{}},ctx:any,screen='library',languageOverride:string|undefined,query='',offset=0,busy=false;
let message='',severity='info',pending:any=null;
let queued:Queued[]=[],prepared:any[]=[],logoutRequested=false,signingOut=false;
let focusIntent:{tag:string,label:string,text:string}|null=null;
const owner=()=>session?.user.id||'';
const online=()=>navigator.onLine;
const same=(a:any,b:any)=>a?.source_id===b?.source_id&&a?.element_id===b?.element_id&&a?.start===b?.start;
function notice(text:string,kind='info'){message=text;severity=kind;renderNotice();}
function renderNotice(){const old=document.querySelector('#notice');const next=el('div',{id:'notice',class:`notice ${severity}`,role:severity==='error'?'alert':'status',hidden:!message},message);old?.replaceWith(next);}
async function guard(action:()=>unknown){try{await action();}catch(e:any){notice(e.message||'A operação não pôde ser concluída.','error');}}
class ApiError extends Error {constructor(public code:string,message:string){super(message);}}
async function raw(tool:string,args:any={},expectedOwner?:string){
 const current=(await auth.auth.getSession()).data.session;if(expectedOwner&&current?.user.id!==expectedOwner)throw new ApiError('SESSION_CHANGED','A conta mudou antes do envio. Retome a intenção na conta de origem.');const response=await fetch(`${apiBase}/api/${tool}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${current?.access_token||session?.access_token||''}`},body:JSON.stringify(args)});
 const data=await response.json();if(!response.ok||!data.ok)throw new ApiError(data.error?.code||'ERROR',data.error?.message||`Falha ${response.status}`);return data.data;
}
async function call(tool:string,args:any={},expectedOwner?:string){
 try{return await raw(tool,args,expectedOwner);}catch(e){if(e instanceof ApiError&&['UNAUTHENTICATED','SESSION_REVOKED'].includes(e.code))notice('Sua sessão terminou. Entre novamente para sincronizar.','error');throw e;}
}
async function mutate(tool:string,args:any,quiet=false){
 if(busy)throw new Error('Aguarde a confirmação da gravação em andamento.');const uid=owner(),opened=ctx;
 if(!online()&&ctx){const local=await enqueue(owner(),tool,args,ctx);queued=await queue(owner());if(!quiet)render();return local;}
 if(!online())throw new Error('Esta alteração exige conexão.');
 if(pending)throw new Error('Há uma operação sem confirmação. Consulte seu recibo em Configurações antes de continuar.');
 const request={tool,args:{...args,operation_id:crypto.randomUUID()}};pending=request;busy=true;if(!quiet)render();
 try{await cacheSet(uid,'pending',request);const receipt=await call(tool,request.args,uid);if(receipt.status!=='confirmed')throw new Error('Gravação ainda sem confirmação.');if(pending===request)pending=null;await cacheSet(uid,'pending',null);if(receipt.reading_id){await invalidateReading(uid,receipt.reading_id);if(owner()===uid)prepared=await cachedPassages(uid);}return receipt;}
 catch(e){if(e instanceof ApiError&&!['INTERNAL','ERROR'].includes(e.code)){if(pending===request)pending=null;await cacheSet(uid,'pending',null);}else if(owner()===uid)notice('A resposta se perdeu. O resultado ainda é desconhecido; consulte o recibo em Configurações.','error');throw e;}
 finally{busy=false;if(!quiet||owner()!==uid||ctx!==opened)render();}
}
async function resolvePending(repeat=false){
 if(!pending)return;const request=pending;const result=await call('operation_get',{operation_id:request.args.operation_id});
 if(result.status==='confirmed'){pending=null;await cacheSet(owner(),'pending',null);notice('O recibo confirmou a gravação.');await load();return;}
 if(repeat){const saved=await call(request.tool,request.args);if(saved.status==='confirmed'){pending=null;await cacheSet(owner(),'pending',null);notice('Operação confirmada com a mesma identidade.');await load();return;}}
 notice('O recibo ainda não foi encontrado. O resultado permanece desconhecido. Repetir usará a mesma chave de operação.');render();
}
async function load(){
 if(!session){render();return;}
 try{account=await call('account_context');await cacheSet(owner(),'account',account);library=await call('library_list',{query,offset,limit:12});await cacheSet(owner(),'library',library);}
 catch(e){if(e instanceof ApiError)throw e;account=await cacheGet(owner(),'account');library=await cacheGet(owner(),'library')||{items:[],pagination:{}};notice('Mostrando somente o material carregado neste dispositivo. Alterações exigem conexão.');}
 pending=await cacheGet(owner(),'pending');queued=await queue(owner());prepared=online()?await revalidatePrepared(owner(),call):await cachedPassages(owner());if(ctx&&screen==='reader')await loadReading(ctx.reading.id,'opened');else render();
}
async function loadReading(id:string,position='resume',ref?:any){
 try{ctx=await call('reading_context',{reading_id:id,position,...(ref?{ref}:{}),...(languageOverride?{language:languageOverride}:{})});try{ctx.display=await call('reading_display',{reading_id:id,ref:ctx.ref,language:ctx.effective_language});}catch(e){if(!(e instanceof ApiError)||e.code!=='PREPARATION_REQUIRED')throw e;ctx.display=null;}await cacheSet(owner(),'last-context',ctx);if(ctx.display)prepared=await preparePassage(owner(),ctx);}
 catch(e){if(e instanceof ApiError)throw e;const exact=prepared.find(x=>x.context.reading.id===id&&(!ref||JSON.stringify(x.context.ref)===JSON.stringify(ref))&&(!languageOverride||x.context.effective_language===languageOverride));const cached=exact?.context||await cacheGet(owner(),'last-context');if(!cached||cached.reading.id!==id||ref&&!same(ref,cached.ref))throw new Error('Esta porção não foi preparada para uso sem rede.');ctx=cached;notice('Cópia local, sem confirmação de estado atual do servidor.');}
 screen='reader';render();
}
function render(){
 const active=document.activeElement as HTMLInputElement;
 if(active&&app.contains(active))focusIntent={tag:active.tagName,label:active.getAttribute('aria-label')||active.labels?.[0]?.textContent||'',text:active.textContent||''};
 const openSummaries=[...app.querySelectorAll('details[open]>summary')].map(e=>e.textContent);
 disposeReadingPanel();app.replaceChildren();
 const nav=el('nav',{'aria-label':'Navegação principal'},button('Biblioteca',()=>{screen='library';ctx=null;languageOverride=undefined;return load();},{class:screen==='library'?'active':''}),button('Importar',()=>{screen='import';render();},{class:screen==='import'?'active':''}),button('Configurações',()=>{screen='settings';render();},{class:screen==='settings'?'active':''}));
 app.append(el('header',{class:'top'},el('div',{class:'top-inner'},el('a',{href:import.meta.env.BASE_URL,class:'brand','aria-label':`${config.name} — biblioteca`},el('span',{class:'brand-mark','aria-hidden':'true'},'AR'),config.name),session?nav:el('span',{class:'private-label'},'Sua biblioteca pessoal'),session?button('Sair',()=>logout(),{class:'quiet logout'}):null)));
 const main=el('main',{id:'main',tabIndex:-1});main.append(el('div',{id:'notice',class:'notice',hidden:true}));
 if(!online())main.append(el('p',{class:'offline',role:'status'},'Sem conexão · consulte as porções preparadas. A cópia disponível não confirma o estado atual do servidor.'));
 if(queued.length)main.append(el('p',{class:'offline',role:'status'},`${queued.length} alteração(ões) local(is) aguardando sincronização.`,button('Ver pendências',()=>{screen='settings';render();})));
 if(pending)main.append(el('p',{class:'offline'},'Existe uma operação sem confirmação. Consulte o recibo em Configurações.'));
 if(!session)main.append(loginView());else if(passwordSetup)main.append(passwordView());else if(new URLSearchParams(location.search).has('authorization_id'))main.append(consentView());else if(screen==='library')main.append(libraryView());else if(screen==='import')main.append(importView());else if(screen==='settings')main.append(settingsView());else main.append(readerView());
 app.append(main,el('footer',{class:'footer'},`${config.name} · leitura na ordem da obra`,el('span',{},config.local?'Ambiente local exclusivo · dados sintéticos de teste disponíveis':'Biblioteca privada')));renderNotice();
 if(logoutRequested)main.prepend(logoutPanel());
 if(busy)document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
 for(const detail of app.querySelectorAll('details'))if(openSummaries.includes(detail.querySelector(':scope>summary')?.textContent||''))detail.open=true;
 if(!busy&&focusIntent){const mark=focusIntent;focusIntent=null;const next=[...app.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a')].find(e=>{const input=e as HTMLInputElement;return e.tagName===mark.tag&&(mark.label?(e.getAttribute('aria-label')||input.labels?.[0]?.textContent||'')===mark.label:e.textContent===mark.text);});if(next&&next.getClientRects().length)next.focus({preventScroll:true});}
}
function loginView(){
 const email=el('input',{type:'email',name:'email',autocomplete:'username',required:true,placeholder:'voce@exemplo.com'}),password=el('input',{type:'password',name:'password',autocomplete:'current-password',required:true,minLength:8});
 const form=el('form',{class:'login-card',onsubmit:(event:Event)=>{event.preventDefault();void guard(async()=>{const result=await auth.auth.signInWithPassword({email:email.value,password:password.value});if(result.error)throw new Error('Não foi possível entrar. Confira os dados e tente novamente.');session=result.data.session;await switchOwner();await load();});}},el('p',{class:'eyebrow'},'CONTINUIDADE PARA O SEU ESTUDO'),el('h1',{},'Uma passagem de cada vez.'),el('p',{class:'lead'},'Leia na ordem da obra, guarde suas explicações e volte ao ponto em que parou.'),field('E-mail',email),field('Senha',password),el('button',{type:'submit',class:'primary'},'Entrar na biblioteca'));
 if(config.local)form.append(button('Criar conta local de teste',async()=>{const result=await auth.auth.signUp({email:email.value,password:password.value});if(result.error)throw new Error('Não foi possível criar a conta local. Use e-mail e senha de ao menos 8 caracteres.');session=result.data.session;await switchOwner();await load();},{class:'quiet'}),el('small',{class:'muted'},'Cadastro disponível somente neste ambiente local. Não use sua senha de outros serviços.'));
 form.append(button('Esqueci minha senha',async()=>{if(!email.reportValidity())return;const result=await auth.auth.resetPasswordForEmail(email.value,{redirectTo:`${location.origin}${import.meta.env.BASE_URL}?account=setup`});if(result.error)throw new Error('Não foi possível enviar o link agora. Tente novamente mais tarde.');notice('Se este e-mail tiver acesso permitido, receberá as instruções de recuperação. Confira também a pasta de spam.');},{class:'quiet',disabled:!online()}));
 return form;
}
function closePasswordSetup(){passwordSetup=false;const url=new URL(location.href);url.searchParams.delete('account');history.replaceState(null,'',url.pathname+url.search);}
function passwordView(){
 const password=el('input',{type:'password',autocomplete:'new-password',required:true,minLength:12}),confirmation=el('input',{type:'password',autocomplete:'new-password',required:true,minLength:12});
 return el('form',{class:'paper form-panel',onsubmit:(event:Event)=>{event.preventDefault();void guard(async()=>{if(password.value!==confirmation.value)throw new Error('As duas senhas precisam ser iguais.');const result=await auth.auth.updateUser({password:password.value});if(result.error)throw new Error('Não foi possível definir a senha. Use uma senha nova com ao menos 12 caracteres; se o link expirou, solicite outro.');closePasswordSetup();await load();notice('Senha definida. Use seu e-mail e a nova senha nas próximas entradas.');});}},el('h1',{},'Definir sua senha'),el('p',{},`Conta: ${session?.user.email||''}`),el('p',{},'Escolha uma senha exclusiva com pelo menos 12 caracteres. Não a envie ao assistente.'),field('Nova senha',password),field('Repita a nova senha',confirmation),el('button',{type:'submit',class:'primary',disabled:!online()},'Salvar senha'),button('Voltar para a biblioteca',async()=>{closePasswordSetup();await load();},{class:'quiet'}));
}
function libraryView(){
 const section=el('section',{},el('div',{class:'page-heading'},el('div',{},el('p',{class:'eyebrow'},'TEMPO PARA ENTENDER'),el('h1',{},'Minha biblioteca'),el('p',{class:'lead'},'O percurso é da obra. O ritmo é seu.')),button('+ Importar uma obra',()=>{screen='import';render();},{class:'primary'})));
 const search=el('input',{type:'search',value:query,placeholder:'Buscar por título ou autoria','aria-label':'Buscar na biblioteca'});
 section.append(el('form',{class:'search',onsubmit:(e:Event)=>{e.preventDefault();query=search.value;offset=0;void guard(load);}},search,el('button',{type:'submit',class:'secondary'},'Buscar')));
 if(!library.items.length)section.append(el('div',{class:'empty'},el('span',{class:'book-symbol','aria-hidden':'true'},'▤'),el('h2',{},'Sua próxima leitura começa aqui'),el('p',{},'Cole um trecho ou importe um arquivo. O original fica preservado, e as explicações podem ser guardadas pelo assistente conectado.'),button('Importar material',()=>{screen='import';render();},{class:'primary'})));
 const grid=el('div',{class:'library-grid'});
 for(const book of library.items){grid.append(el('article',{class:'book-card'},el('div',{class:'book-spine','aria-hidden':'true'},el('span',{},book.title.slice(0,1).toLocaleUpperCase())),el('div',{class:'book-info'},el('div',{class:'tags'},tag(book.language),book.partial?tag('Fonte parcial'):tag('Versão fornecida')),el('h2',{},book.title),el('p',{class:'author'},book.author||'Autoria não informada'),book.edition?el('p',{class:'muted'},book.edition):null,el('p',{class:'position'},book.available_end?'Fim do material disponível':'Retomada preservada nesta versão'),button(online()?'Retomar leitura':'Abrir cópia carregada',()=>{languageOverride=undefined;return loadReading(book.reading_id);},{class:'secondary'}))));}
 section.append(grid,pagination(library.pagination,async next=>{offset=next;await load();}));return section;
}
function pagination(page:any,action:(n:number)=>unknown){return el('div',{class:'pagination'},page.offset?button('← Anterior',()=>action(Math.max(0,page.offset-page.limit))):null,page.total?el('small',{class:'muted'},`${page.offset+1}–${Math.min(page.offset+page.limit,page.total)} de ${page.total}`):null,page.next_offset!==null&&page.next_offset!==undefined?button('Próxima →',()=>action(page.next_offset)):null);}
let importParent:any=null;
function importView(){
 const title=el('input',{name:'title',required:true,maxLength:300,value:importParent?.work.title||''}),author=el('input',{name:'author',maxLength:300,value:importParent?.work.author||''}),edition=el('input',{name:'edition',maxLength:300,placeholder:'Edição, tradução ou transcrição, quando conhecida'}),originalLang=el('input',{name:'original-language',value:importParent?.source.original_language||'pt',required:true}),text=el('textarea',{name:'text',rows:10,placeholder:'Cole aqui o material autorizado. Não complete passagens ausentes por memória.'}),url=el('input',{type:'url',name:'url',placeholder:'https://…'}),file=el('input',{type:'file',name:'file',accept:'.txt,.md,.markdown,.pdf,.html'}),format=el('select',{name:'format'},...['text','markdown','html','pdf','url'].map((v,i)=>el('option',{value:v},['Texto colado / TXT','Markdown','HTML fornecido','PDF com texto','Página HTML pública'][i]))),partial=el('input',{type:'checkbox',name:'partial',checked:true});
 file.addEventListener('change',()=>{const name=file.files?.[0]?.name.toLowerCase()||'';format.value=name.endsWith('.pdf')?'pdf':/\.(md|markdown)$/.test(name)?'markdown':name.endsWith('.html')?'html':'text';});
 const form=el('form',{class:'paper form-panel',onsubmit:(e:Event)=>{e.preventDefault();void guard(async()=>{
  const args:any={title:title.value,author:author.value,edition:edition.value,original_language:Intl.getCanonicalLocales(originalLang.value)[0],partial:partial.checked,format:format.value};
  if(importParent){args.work_id=importParent.work.id;args.derives_from=importParent.source.id;}
  if(format.value==='url')args.url=url.value;else if(file.files?.[0]){const f=file.files[0];if(f.size>8*1024*1024)throw new Error('O arquivo deve ter no máximo 8 MiB.');const bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));args.file_base64=btoa(binary);args.filename=f.name;}else args.text=text.value;
  const receipt=await mutate('source_import',args);importParent=null;languageOverride=undefined;await loadReading(receipt.reading_id);notice(receipt.warnings.length?'Material preservado. Confira os avisos e a extração antes de mediar.':'Material preservado. A explicação será produzida e salva pelo assistente.');
 });}},field('Título da obra',title),el('div',{class:'form-row'},field('Autoria',author),field('Idioma do original',originalLang,'Independente do idioma de saída. Ex.: pt, en, ar.')),field('Edição ou tradução',edition),field('Formato',format),field('Arquivo de até 8 MiB',file,'TXT/Markdown em UTF-8, HTML fornecido ou PDF com camada textual. Sem OCR automático.'),field('Página pública',url,'Somente uma página HTTPS acessível sem login, dentro das condições do site.'),field('Texto ou transcrição',text,'Para corrigir PDF, indique página/região no próprio texto da transcrição.'),el('label',{class:'check'},partial,'Este material é apenas parte da obra'),el('p',{class:'muted'},'Importe material próprio, autorizado ou dentro das condições de uso. Originais e adaptações permanecem privados.'),el('button',{type:'submit',class:'primary',disabled:!online()},'Preservar e abrir leitura'));
 return el('section',{},el('p',{class:'eyebrow'},'COMEÇAR PELO ORIGINAL'),el('h1',{},importParent?'Nova versão vinculada':'Importar material'),el('p',{class:'lead'},importParent?'A leitura anterior, suas referências e notas serão conservadas. Esta versão terá uma nova leitura.':'Uma obra inteira ou só a próxima passagem. Sem inventar o que ainda falta.'),form,button('Cancelar',()=>{importParent=null;screen='library';return load();},{class:'quiet'}));
}
function originalBlock(){
 const kind=ctx.element.kind,text=ctx.original;let content:HTMLElement;
 if(kind==='equation'&&ctx.element.meta.representation!=='original_markup_as_text'){content=el('div',{class:'wide math','aria-label':'Fórmula original'});try{katex.render(text,content,{displayMode:true,throwOnError:false,trust:false,strict:'warn'});}catch{content.textContent=text;}}
 else if(kind==='table'&&Array.isArray(ctx.element.meta.rows)){content=el('div',{class:'wide'});content.append(el('table',{},el('tbody',{},...ctx.element.meta.rows.map((row:any,i:number)=>el('tr',{},...row.map((cell:any)=>el(i===0?'th':'td',{},String(cell))))))));}
 else if(kind==='code'||kind==='unknown')content=el('pre',{class:'wide'},el('code',{},text));
 else if(kind==='figure')content=el('figure',{},el('div',{class:'figure-placeholder','aria-hidden':'true'},'▧'),el('figcaption',{},text),el('small',{class:'muted'},'Descrição fornecida pela fonte. Imagem não interpretada automaticamente.'));
 else content=el(kind==='heading'?'h2':'div',{class:`original-text ${kind==='verse'?'verse':''}`,dir:'auto'},text);
 return content;
}
function readerView(){
 if(!ctx)return el('p',{},'Abra uma leitura na biblioteca.');
 const opened=ctx,uid=owner();
 return el('section',{class:'reader'},el('div',{class:'reader-title'},el('h1',{},ctx.work.title),el('p',{class:'muted'},[ctx.work.author,ctx.passage?.label||ctx.element.locator].filter(Boolean).join(' · '))),readingPanel(ctx,originalBlock,{call,write:(tool,args)=>mutate(tool,args,true),online,changed:async display=>{if(ctx!==opened||owner()!==uid)return;opened.display=display;opened.reading.revision=display.reading.revision;await cacheSet(uid,'last-context',opened);const entries=await preparePassage(uid,opened);if(ctx===opened&&owner()===uid)prepared=entries;}}));
}
function settingsView(){
 const section=el('section',{class:'settings'},el('p',{class:'eyebrow'},'SUA LEITURA, SUAS ESCOLHAS'),el('h1',{},'Configurações'));
 const prefs=el('section',{class:'paper form-panel'},el('h2',{},'Preferências de leitura'),el('p',{},'No chat, peça “Quais são minhas preferências?” ou “Quero mudar minha abordagem nesta obra”. O assistente informa as escolhas e sua origem.'));
 const connection=el('section',{class:'paper form-panel'},el('h2',{},'Conectar seu assistente'),el('p',{},'O assistente consulta o original, produz a reescrita e a salva aqui. Não é necessária chave de modelo no aplicativo.'),el('label',{class:'field'},el('span',{},'Endereço MCP desta instalação'),el('input',{readOnly:true,value:config.mcp_url,'aria-label':'Endereço MCP'})),el('p',{class:'muted'},config.local?'Este endereço é local. A conexão no ChatGPT depende de endpoint HTTPS ou túnel autorizado e da autenticação do titular. Ainda não foi homologada no ChatGPT.':'Adicione este MCP no cliente compatível, escolha OAuth e confira o consentimento da sua conta.'),button('Ver orientação do assistente',async()=>{const guide=await call('assistant_guidance');const pre=el('pre',{class:'guidance wide'},guide.instructions);connection.append(el('h3',{},`Orientação ${guide.version}`),pre);},{disabled:!online()}),el('p',{},'Na nova conversa, peça ao assistente para carregar assistant_guidance e retomar a leitura. A ferramenta não recebe o histórico completo do seu chat.'));
 const recovery=el('section',{class:'paper form-panel'},el('h2',{},'Recuperação e privacidade'),el('p',{},'Os dados canônicos ficam no servidor. A última biblioteca, porções carregadas e rascunhos ficam privados neste dispositivo até sair ou limpar a cópia.'),button('Limpar cópia deste dispositivo',async()=>{if(queued.length||pending)throw Error('Recupere ou descarte explicitamente as pendências antes de limpar.');await clearOwner(owner());prepared=[];notice('Cópia privada local removida. Os dados no servidor foram preservados.');},{class:'secondary'}));
 if(pending)recovery.append(el('p',{class:'warning'},'Operação com resultado desconhecido.'),el('code',{class:'wrap'},pending.args.operation_id),button('Consultar recibo',()=>resolvePending(),{disabled:!online()}),button('Repetir mesma operação',()=>resolvePending(true),{disabled:!online()}));
 const backupText=el('textarea',{rows:5,'aria-label':'Backup privado',placeholder:'Exporte para obter o JSON privado, ou cole um backup completo para restaurar.'});
 recovery.append(el('h3',{},'Exportação privada'),el('p',{class:'muted'},'O backup inclui originais e notas. Proteja o arquivo. A ferramenta de linha de comando grava os bytes diretamente, sem download pelo navegador.'),backupText,el('div',{class:'note-actions'},button('Preparar JSON de exportação',async()=>{const sections:Record<string,unknown[]>={};let snapshot:string|undefined;for(const section of (await call('data_export',{section:'works',limit:1})).sections){let next:number|null=0;sections[section]=[];while(next!==null){const data=await call('data_export',{section,offset:next,limit:50,include_original:true,snapshot});snapshot=data.snapshot;sections[section].push(...data.items);next=data.pagination.next_offset;}}backupText.value=JSON.stringify({format:'araread/3',snapshot,sections});notice('Backup privado preparado no campo. Nenhum arquivo foi publicado.');},{disabled:!online()}),button('Restaurar como novas leituras',async()=>{const result=await mutate('data_restore',{bundle:JSON.parse(backupText.value)});await load();notice(`${result.restored_readings} leitura(s) restaurada(s) com novos IDs. As leituras existentes foram preservadas.`);},{disabled:!online()})));
 section.append(prefs,connection,recovery,syncPanel(),el('section',{class:'paper form-panel'},el('h2',{},'Acesso à conta'),button('Definir ou alterar minha senha',()=>{passwordSetup=true;render();},{disabled:!online()})));return section;
}
function syncPanel(){
 const box=el('section',{class:'paper form-panel'},el('h2',{},'Uso sem rede e sincronização'),el('p',{},'Até 12 porções preparadas (2 MiB) e 40 alterações locais (1 MiB). As cópias têm conta, leitura e versão próprias. Progresso local não é confirmação do servidor.'));
 box.append(button('Sincronizar pendências',async()=>{queued=await syncQueue(owner(),call,true);await load();notice(queued.length?'Há pendências que precisam de conferência.':'Fila sincronizada e confirmada.');},{disabled:!online()}));
 for(const item of queued){const card=el('div',{class:'sync-item'},el('p',{},`${item.tool==='note_save'?'Anotação':'Continuidade'} · ${item.state==='local'?'somente local':item.state==='syncing'?'sincronizando':item.state==='conflict'?'conflito':'falhou / confirmação incerta'}`),el('p',{},item.args.text||`Intervalo [${item.args.ref?.start}, ${item.args.ref?.end})`),item.error?el('p',{class:'warning'},item.error):null,button('Conferir estado no servidor',async()=>{const current=await call('reading_context',{reading_id:item.reading});card.append(el('p',{class:'wrap'},`Retomada do servidor: ${current.element.locator} · [${current.ref.start}, ${current.ref.end}) · revisão ${current.reading.revision}. Sua intenção: [${item.args.ref?.start}, ${item.args.ref?.end}) · revisão ${item.args.expected_revision}.`));},{disabled:!online()}),button('Descartar somente esta pendência local',async()=>{await removeQueued(owner(),item.args.operation_id);queued=await queue(owner());render();}));
  if(item.state==='conflict')card.append(button('Conferir e reaplicar continuidade',async()=>{const confirmed=await call('operation_get',{operation_id:item.args.operation_id});if(confirmed.status==='confirmed'){await removeQueued(owner(),item.args.operation_id);await load();return;}const current=await call('reading_context',{reading_id:item.reading});if(!same(current.ref,item.args.ref)||current.ref.end!==item.args.ref.end)throw Error('A retomada do servidor é outra. Abra-a e escolha a continuidade a partir dela; nenhum progresso foi mesclado.');await mutate(item.tool,{...item.args,expected_revision:current.reading.revision});await removeQueued(owner(),item.args.operation_id);queued=await queue(owner());await load();notice('Intenção reaplicada explicitamente e confirmada.');},{disabled:!online()}));box.append(card);}
 if(!queued.length)box.append(el('p',{class:'muted'},'Nenhuma alteração local pendente.'));
 const recovery=el('textarea',{rows:4});box.append(el('details',{},el('summary',{},'Recuperar fila preparada anteriormente'),field('Recuperação local da mesma conta',recovery),button('Conferir e importar intenções locais',async()=>{queued=await restoreQueue(owner(),recovery.value);render();notice('Intenções recuperadas localmente; ainda exigem validação e confirmação no servidor.');})));
 for(const entry of prepared)box.append(el('div',{class:'sync-item'},el('p',{},`${entry.context.work.title} · ${entry.context.element.locator} · ${Math.ceil(entry.bytes/1024)} KiB`),button('Abrir porção preparada',async()=>{languageOverride=entry.context.effective_language;await loadReading(entry.context.reading.id,'opened',entry.context.ref);}),button('Remover esta cópia preparada',async()=>{await removePassage(owner(),entry.key);prepared=await cachedPassages(owner());render();})));
 return box;
}
function logoutPanel(){
 const text=el('textarea',{rows:6,readOnly:true,'aria-label':'Recuperação de pendências'});let ready=false;
 return el('section',{class:'paper form-panel',role:'region','aria-label':'Sair com pendências'},el('h2',{},'Há alterações sem confirmação'),el('p',{},'Antes de sair, prepare uma cópia recuperável ou descarte explicitamente as pendências. A recuperação contém suas intenções e nenhum token de acesso.'),button('Preparar recuperação das pendências',async()=>{text.value=JSON.stringify({...await recoverQueue(owner()),unconfirmed:pending?[pending]:[]},null,2);ready=true;notice('Recuperação preparada no campo. Copie e guarde o conteúdo antes de sair.');}),text,button('Sair após preparar recuperação',async()=>{if(!ready)throw Error('Prepare e guarde a recuperação antes de sair.');await discardQueue(owner());await logout(true);}),button('Descartar pendências e sair',async()=>{await discardQueue(owner());await logout(true);}),button('Cancelar saída',()=>{logoutRequested=false;render();}));
}
function consentView(){
 const section=el('section',{class:'paper form-panel'},el('h1',{},'Autorizar assistente'),el('p',{},'Carregando informações do cliente…'));const id=new URLSearchParams(location.search).get('authorization_id')!;
 void auth.auth.oauth.getAuthorizationDetails(id).then(({data,error})=>{if(error||!data){section.replaceChildren(el('h1',{},'Autorização indisponível'),el('p',{},'Reinicie a conexão no cliente.'));return;}if(!('authorization_id'in data)){location.assign(data.redirect_url);return;}
  section.replaceChildren(el('h1',{},`Autorizar ${data.client.name}`),el('p',{},'Esta conexão permite consultar sua biblioteca, guardar explicações e notas, registrar continuidade e executar exclusões explicitamente autorizadas. Confira a conta antes de conceder acesso.'),el('p',{class:'muted'},`Conta: ${session?.user.email} · Escopos de identidade: ${data.scope||'não informados'}`),button('Autorizar acesso',async()=>{const result=await auth.auth.oauth.approveAuthorization(id,{skipBrowserRedirect:true});if(result.error)throw new Error('Não foi possível autorizar.');if(result.data?.redirect_url)location.assign(result.data.redirect_url);},{class:'primary'}),button('Recusar',async()=>{const result=await auth.auth.oauth.denyAuthorization(id,{skipBrowserRedirect:true});if(result.data?.redirect_url)location.assign(result.data.redirect_url);},{class:'secondary'}));
 });return section;
}
async function switchOwner(){const previous=localStorage.getItem('araread-cache-owner');if(owner()&&previous!==owner()){if(previous&&!(await queue(previous)).length&&!await cacheGet(previous,'pending'))await clearOwner(previous);localStorage.setItem('araread-cache-owner',owner());}if(owner())await clearLegacyContexts(owner());ctx=null;account=null;pending=null;screen='library';}
async function logout(force=false){const uid=owner();queued=await queue(uid);pending=await cacheGet(uid,'pending');if(!force&&(queued.length||pending)){logoutRequested=true;render();return;}logoutRequested=false;signingOut=true;try{const result=await auth.auth.signOut({scope:'local'});await clearOwner(uid);localStorage.removeItem('araread-auth-v1');localStorage.removeItem('araread-auth-v1-code-verifier');localStorage.removeItem('araread-cache-owner');session=null;ctx=null;account=null;pending=null;screen='library';message=result.error?'Sessão removida deste dispositivo. A revogação remota exige conexão.':'';render();}finally{signingOut=false;}}
let reconnecting:Promise<void>|undefined;
function reconnect(){
 if(reconnecting)return reconnecting;
 reconnecting=(async()=>{
  const uid=owner();if(!uid)return;const ownedCall=(tool:string,args:any)=>call(tool,args,uid);const synced=await syncQueue(uid,ownedCall);if(owner()!==uid)return;queued=synced;
  if(screen!=='reader')await load();else{
   const opened=ctx,revision=opened?.reading.revision;prepared=await revalidatePrepared(uid,ownedCall);
   if(opened?.display){const fresh=await ownedCall('reading_context',{reading_id:opened.reading.id,ref:opened.ref,language:opened.effective_language}),highlights=await ownedCall('highlight_list',{reading_id:opened.reading.id,ref:opened.ref});
    if(owner()===uid&&ctx===opened&&opened.reading.revision===revision&&!busy){Object.assign(opened.reading,fresh.reading);Object.assign(opened.display.reading,fresh.reading);opened.display.highlights=highlights;opened.display.terms=fresh.terms;refreshReadingPanel(opened.display);await cacheSet(uid,'last-context',opened);const entries=await preparePassage(uid,opened);if(owner()===uid&&ctx===opened)prepared=entries;}
   }
  }
  if(owner()===uid)notice(queued.length?'Conexão restabelecida. Confira as pendências em Configurações.':'Conexão restabelecida; alterações locais confirmadas quando havia pendências.');
 })().finally(()=>{reconnecting=undefined;});
 return reconnecting;
}
window.addEventListener('offline',()=>{if(screen==='reader')notice('Sem conexão. A seleção e a pergunta foram preservadas; gravações locais aguardam sincronização.');else render();});
auth.auth.onAuthStateChange((event,next)=>{if(event==='SIGNED_OUT'&&signingOut){session=next;return;}if(event==='PASSWORD_RECOVERY'&&next){const alreadyOpen=passwordSetup&&session?.user.id===next.user.id;session=next;passwordSetup=true;if(!alreadyOpen)queueMicrotask(()=>void guard(async()=>{await switchOwner();render();}));return;}if(next&&session?.user.id===next.user.id){session=next;return;}if(event==='SIGNED_OUT'||(session&&next?.user.id!==session.user.id)){session=next;queueMicrotask(()=>void guard(async()=>{await switchOwner();if(!next)message='Sessão encerrada. Entre novamente para sincronizar.';await load();render();}));}});
await switchOwner();await guard(load);render();
window.addEventListener('online',()=>void guard(reconnect));
// The browser can reconnect while the asynchronous module is still loading.
// Recover that missed event after identity and private storage are initialized.
if(online()&&owner()&&(await queue(owner())).length)await guard(reconnect);
if(import.meta.env.PROD&&'serviceWorker'in navigator)void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
