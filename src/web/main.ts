import {createClient,type Session} from '@supabase/supabase-js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './style.css';
import {cacheGet,cacheSet,clearPrivate} from './private-cache.ts';

type NodeChild=Node|string|number|null|undefined|false;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,any>={},...children:NodeChild[]):HTMLElementTagNameMap[K]{
 const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(value==null)continue;if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else if(key==='class')node.className=value;else if(key in node)(node as any)[key]=value;else node.setAttribute(key,String(value));}
 for(const child of children)if(child!==null&&child!==undefined&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node;
}
const button=(text:string,action:()=>unknown,attrs:Record<string,any>={})=>el('button',{type:'button',onclick:()=>void guard(action),...attrs},text);
let fieldId=0;
const field=(label:string,input:HTMLElement,help?:string)=>{const id=input.id||`field-${++fieldId}`;input.id=id;if(help)input.setAttribute('aria-describedby',`${id}-help`);return el('div',{class:'field'},el('label',{htmlFor:id},label),input,help?el('small',{id:`${id}-help`},help):null);};
const tag=(text:string)=>el('span',{class:'tag'},text);
const app=document.querySelector<HTMLDivElement>('#app')!;
const config=await fetch('/api/config').then(r=>r.json()).catch(()=>JSON.parse(localStorage.getItem('araread-public-config')||'null'));
if(!config)throw new Error('A primeira abertura exige conexão.');
localStorage.setItem('araread-public-config',JSON.stringify(config));document.title=config.name;
const auth=createClient(config.supabase_url,config.publishable_key,{auth:{storageKey:'araread-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session:Session|null=(await auth.auth.getSession()).data.session;
let account:any,library:any={items:[],pagination:{}},ctx:any,screen='library',languageOverride:string|undefined,query='',offset=0,busy=false,mode:'mediation'|'original'='mediation';
let message='',severity='info',panel='',panelData:any,noteDraft='',pending:any=null;
const owner=()=>session?.user.id||'';
const online=()=>navigator.onLine;
const same=(a:any,b:any)=>a?.source_id===b?.source_id&&a?.element_id===b?.element_id&&a?.start===b?.start;
function notice(text:string,kind='info'){message=text;severity=kind;renderNotice();}
function renderNotice(){const old=document.querySelector('#notice');const next=el('div',{id:'notice',class:`notice ${severity}`,role:severity==='error'?'alert':'status',hidden:!message},message);old?.replaceWith(next);}
async function guard(action:()=>unknown){try{await action();}catch(e:any){notice(e.message||'A operação não pôde ser concluída.','error');}}
class ApiError extends Error {constructor(public code:string,message:string){super(message);}}
async function raw(tool:string,args:any={}){
 const current=(await auth.auth.getSession()).data.session;const response=await fetch(`/api/${tool}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${current?.access_token||session?.access_token||''}`},body:JSON.stringify(args)});
 const data=await response.json();if(!response.ok||!data.ok)throw new ApiError(data.error?.code||'ERROR',data.error?.message||`Falha ${response.status}`);return data.data;
}
async function call(tool:string,args:any={}){
 try{return await raw(tool,args);}catch(e){if(e instanceof ApiError&&['UNAUTHENTICATED','SESSION_REVOKED'].includes(e.code))notice('Sua sessão terminou. Entre novamente para sincronizar.','error');throw e;}
}
async function mutate(tool:string,args:any){
 if(!online())throw new Error('Sem conexão: o rascunho está preservado. Reconecte para salvar ou alterar o progresso.');
 if(pending)throw new Error('Há uma operação sem confirmação. Consulte seu recibo em Configurações antes de continuar.');
 const request={tool,args:{...args,operation_id:crypto.randomUUID()}};pending=request;await cacheSet(owner(),'pending',request);busy=true;render();
 try{const receipt=await call(tool,request.args);if(receipt.status!=='confirmed')throw new Error('Gravação ainda sem confirmação.');pending=null;await cacheSet(owner(),'pending',null);return receipt;}
 catch(e){if(e instanceof ApiError){pending=null;await cacheSet(owner(),'pending',null);}else notice('A resposta se perdeu. O resultado ainda é desconhecido; consulte o recibo em Configurações.','error');throw e;}
 finally{busy=false;render();}
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
 pending=await cacheGet(owner(),'pending');if(ctx&&screen==='reader')await loadReading(ctx.reading.id,'opened');else render();
}
async function loadReading(id:string,position='resume',ref?:any){
 try{ctx=await call('reading_context',{reading_id:id,position,...(ref?{ref}:{}),...(languageOverride?{language:languageOverride}:{})});await cacheSet(owner(),`context:${id}`,ctx);}
 catch(e){if(e instanceof ApiError)throw e;const cached=await cacheGet(owner(),`context:${id}`);if(!cached)throw new Error('Esta leitura ainda não foi carregada para uso sem rede.');ctx=cached;notice('Última porção carregada, sem sincronização. A retomada no servidor pode ter mudado.');}
 noteDraft=await cacheGet(owner(),`draft:${id}`)||'';screen='reader';panel='';render();
}
async function move(action:string,ref?:any){
 const result=await mutate('reading_move',{reading_id:ctx.reading.id,expected_revision:ctx.reading.revision,action,...(ref?{ref}:{})});await loadReading(result.reading_id,action==='open'?'opened':'resume');notice(action==='continue'?'Porção marcada como percorrida. Compreensão não foi inferida.':'Posição atualizada.');
}
function langSelect(value:string,change:(value:string)=>unknown){
 const select=el('select',{'aria-label':'Idioma de saída',onchange:()=>void guard(async()=>{let chosen=select.value;if(chosen==='other'){const custom=document.querySelector<HTMLInputElement>('#custom-language');if(custom){custom.hidden=false;custom.focus();}return;}await change(chosen);})});
 const list=[['pt-BR','Português (Brasil)'],['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['ar','العربية'],['ja','日本語'],['zh-Hans','中文']];if(value&&!list.some(x=>x[0]===value))list.push([value,value]);
 list.push(['other','Outro idioma…']);for(const [code,label]of list)select.append(el('option',{value:code,selected:code===value},label));
 const custom=el('input',{id:'custom-language',placeholder:'ex.: hi, he, pt-PT',hidden:true,'aria-label':'Outro idioma BCP 47'});
 const use=button('Usar idioma',()=>{const canonical=Intl.getCanonicalLocales(custom.value)[0];return change(canonical);},{class:'quiet'});use.hidden=true;select.addEventListener('change',()=>use.hidden=select.value!=='other');
 return el('div',{class:'language-control'},select,custom,use);
}
function render(){
 app.replaceChildren();
 const nav=el('nav',{'aria-label':'Navegação principal'},button('Biblioteca',()=>{screen='library';ctx=null;languageOverride=undefined;return load();},{class:screen==='library'?'active':''}),button('Importar',()=>{screen='import';render();},{class:screen==='import'?'active':''}),button('Configurações',()=>{screen='settings';render();},{class:screen==='settings'?'active':''}));
 app.append(el('header',{class:'top'},el('div',{class:'top-inner'},el('a',{href:'/',class:'brand','aria-label':`${config.name} — biblioteca`},el('span',{class:'brand-mark','aria-hidden':'true'},'AR'),config.name),session?nav:el('span',{class:'private-label'},'Sua biblioteca pessoal'),session?button('Sair',logout,{class:'quiet logout'}):null)));
 const main=el('main',{id:'main',tabIndex:-1});main.append(el('div',{id:'notice',class:'notice',hidden:true}));
 if(!online())main.append(el('p',{class:'offline',role:'status'},'Sem conexão · você pode consultar a última porção carregada. Salvar e avançar exigem rede.'));
 if(pending)main.append(el('p',{class:'offline'},'Existe uma operação sem confirmação. Consulte o recibo em Configurações.'));
 if(!session)main.append(loginView());else if(new URLSearchParams(location.search).has('authorization_id'))main.append(consentView());else if(screen==='library')main.append(libraryView());else if(screen==='import')main.append(importView());else if(screen==='settings')main.append(settingsView());else main.append(readerView());
 app.append(main,el('footer',{class:'footer'},`${config.name} · leitura na ordem da obra`,el('span',{},config.local?'Ambiente local exclusivo · dados sintéticos de teste disponíveis':'Biblioteca privada')));renderNotice();
 if(busy)document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
}
function loginView(){
 const email=el('input',{type:'email',name:'email',autocomplete:'username',required:true,placeholder:'voce@exemplo.com'}),password=el('input',{type:'password',name:'password',autocomplete:'current-password',required:true,minLength:8});
 const form=el('form',{class:'login-card',onsubmit:(event:Event)=>{event.preventDefault();void guard(async()=>{const result=await auth.auth.signInWithPassword({email:email.value,password:password.value});if(result.error)throw new Error('Não foi possível entrar. Confira os dados e tente novamente.');session=result.data.session;await switchOwner();await load();});}},el('p',{class:'eyebrow'},'CONTINUIDADE PARA O SEU ESTUDO'),el('h1',{},'Uma passagem de cada vez.'),el('p',{class:'lead'},'Leia na ordem da obra, guarde suas explicações e volte ao ponto em que parou.'),field('E-mail',email),field('Senha',password),el('button',{type:'submit',class:'primary'},'Entrar na biblioteca'));
 if(config.local)form.append(button('Criar conta local de teste',async()=>{const result=await auth.auth.signUp({email:email.value,password:password.value});if(result.error)throw new Error('Não foi possível criar a conta local. Use e-mail e senha de ao menos 8 caracteres.');session=result.data.session;await switchOwner();await load();},{class:'quiet'}),el('small',{class:'muted'},'Cadastro disponível somente neste ambiente local. Não use sua senha de outros serviços.'));
 return form;
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
 const atResume=same(ctx.ref,ctx.reading.resume),body=el('section',{class:'reader'});
 body.append(button('← Biblioteca',()=>{ctx=null;screen='library';return load();},{class:'quiet back'}),el('div',{class:'reader-title'},el('p',{class:'eyebrow'},ctx.work.author||'AUTORIA NÃO INFORMADA'),el('h1',{},ctx.work.title),el('p',{class:'muted'},[ctx.source.edition,ctx.element.locator].filter(Boolean).join(' · '))),el('div',{class:'reader-tools'},langSelect(ctx.effective_language,async lang=>{languageOverride=lang;await loadReading(ctx.reading.id,'opened',ctx.ref);notice('Idioma usado somente nesta consulta.');}),button('Guardar idioma nesta leitura',async()=>{await mutate('preferences_set',{reading_id:ctx.reading.id,expected_revision:ctx.reading.revision,language:ctx.effective_language});languageOverride=undefined;await loadReading(ctx.reading.id,'opened',ctx.ref);notice('Preferência desta leitura salva.');},{class:'quiet',disabled:!online()}),button('Índice',()=>showHistory('index'),{class:'quiet',disabled:!online()})));
 if(!atResume)body.append(el('div',{class:'review-bar'},el('span',{},'Você está revendo. A retomada principal foi conservada.'),button('Retomar de onde parei',()=>move('resume'),{disabled:!online()})));
 const toggle=el('div',{class:'segment','aria-label':'Apresentação'},button('Leitura assistida',()=>{mode='mediation';render();},{'aria-pressed':mode==='mediation',class:mode==='mediation'?'selected':''}),button('Original',()=>{mode='original';render();},{'aria-pressed':mode==='original',class:mode==='original'?'selected':''}));
 const paper=el('article',{class:'reading-paper'},el('div',{class:'paper-meta'},el('span',{},ctx.element.locator),tag(mode==='original'?ctx.source.original_language:ctx.effective_language)),toggle);
 if(mode==='original')paper.append(el('p',{class:'content-label'},'Texto original · representação desta versão'),originalBlock());
 else if(ctx.mediation){paper.append(el('p',{class:'content-label'},'Reescrita acessível · conteúdo acrescentado pelo assistente'),el('div',{class:'rewrite',lang:ctx.mediation.language,dir:'auto'},ctx.mediation.rewrite));for(const item of ctx.mediation.additions){const label=({context:'Esclarecimento',interpretation:'Interpretação',example:'Exemplo acrescentado',critical_note:'Nota crítica'} as Record<string,string>)[item.kind]||item.kind;paper.append(el('aside',{class:'addition'},el('h3',{},label),item.perspective?el('p',{class:'muted'},item.perspective):null,el('p',{dir:'auto'},item.text),item.support?el('details',{},el('summary',{},'Fontes e limites da nota'),el('p',{},item.support.claim),el('p',{},item.support.classification.replaceAll('_',' ')),el('p',{},item.support.limits),...item.support.sources.map((s:any)=>el('p',{},s.title,` · consultada em ${s.consulted_at} · ${s.url}`,el('br'),s.detail))):null));}paper.append(el('small',{class:'provenance'},`Versão salva em ${new Date(ctx.mediation.created_at).toLocaleDateString('pt-BR')} · ${ctx.mediation.provenance.agent} · sem revisão humana registrada`));}
 else paper.append(el('div',{class:'empty mediation-empty'},el('h2',{},'Uma explicação para esta passagem'),el('p',{},'Ainda não há reescrita salva neste idioma. Leia o original ou conecte seu assistente para produzir e guardar a mediação.'),ctx.other_languages.length?el('p',{},`Versões existentes: ${ctx.other_languages.join(', ')}`):null,button('Ler o original',()=>{mode='original';render();},{class:'primary'}),button('Conectar assistente',()=>{screen='settings';render();},{class:'quiet'})));
 body.append(paper);
 const coverage=ctx.reading.covered.filter((r:any)=>r.element_id===ctx.ref.element_id).reduce((n:number,r:any)=>n+r.end-r.start,0);
 body.append(el('div',{class:'portion-status'},el('span',{},`${ctx.ref.end-ctx.ref.start} caracteres nesta porção · ${coverage} marcados neste elemento`),el('span',{},ctx.source.partial?'Fonte parcial':'Versão fornecida')));
 if(ctx.end_message)body.append(el('p',{class:'end-message'},ctx.end_message));
 body.append(el('div',{class:'reading-actions'},button('← Voltar',()=>move('open',ctx.previous_ref),{class:'secondary',disabled:!ctx.previous_ref||!online()}),atResume?button(ctx.reading.available_end?'Material disponível percorrido':ctx.next_ref?'Continuar →':'Marcar esta porção como percorrida',()=>move('continue',ctx.ref),{class:'primary',disabled:!online()||ctx.reading.available_end}):button('Retomar percurso →',()=>move('resume'),{class:'primary',disabled:!online()})));
 const notes=el('div',{class:'notes-area'},el('h2',{},'Suas perguntas e anotações'),el('p',{class:'muted'},'Guardar uma dúvida mantém a posição da leitura.'));
 const draft=el('textarea',{rows:3,'aria-label':'Sua anotação',value:noteDraft,placeholder:'O que você quer guardar ou perguntar?',oninput:()=>{noteDraft=draft.value;void cacheSet(owner(),`draft:${ctx.reading.id}`,noteDraft);}}),kind=el('select',{'aria-label':'Tipo de anotação'},el('option',{value:'note'},'Anotação'),el('option',{value:'question'},'Pergunta'));
 notes.append(el('form',{onsubmit:(e:Event)=>{e.preventDefault();void guard(async()=>{if(!draft.value.trim())throw new Error('Escreva sua anotação antes de salvar.');const saved=await mutate('note_save',{reading_id:ctx.reading.id,expected_revision:ctx.reading.revision,ref:ctx.ref,kind:kind.value,text:draft.value,origin:'user'});noteDraft='';await cacheSet(owner(),`draft:${ctx.reading.id}`,'');await loadReading(saved.reading_id,'opened',ctx.ref);notice('Anotação salva e conferida na leitura.');});}},draft,el('div',{class:'note-actions'},kind,el('button',{type:'submit',class:'secondary',disabled:!online()},'Guardar anotação'))));
 notes.append(el('div',{class:'marks'},...([['doubt','Marcar dúvida'],['review','Rever depois'],['favorite','Favorito'],['understood','Marcar compreensão']] as const).map(([value,label])=>button(label,async()=>{await mutate('note_save',{reading_id:ctx.reading.id,expected_revision:ctx.reading.revision,ref:ctx.ref,kind:value,text:'',origin:'user'});await loadReading(ctx.reading.id,'opened',ctx.ref);notice('Marca pessoal salva.');},{disabled:!online(),class:'quiet'}))));
 const recent=ctx.notes.filter((n:any)=>n.text);for(const n of recent)notes.append(el('blockquote',{class:'saved-note'},el('small',{},`${n.kind==='question'?'Pergunta':n.kind==='answer'?'Resposta':'Anotação'} · ${n.origin==='user'?'usuário':'assistente'}`),el('p',{dir:'auto'},n.text)));
 body.append(notes,el('div',{class:'more-tools'},button('Glossário',()=>showHistory('terms'),{disabled:!online()}),button('Histórico de explicações',()=>showHistory('mediations'),{disabled:!online()}),button('Todas as notas',()=>showHistory('notes'),{disabled:!online()}),button('Sobre esta fonte',()=>{panel='source';render();})));
 if(panel)body.append(historyPanel());return body;
}
async function showHistory(kind:string,offset=0){panel=kind;panelData=await call(kind==='index'?'source_elements':'reading_history',{reading_id:ctx.reading.id,...(kind==='index'?{}:{kind}),offset,limit:20});render();document.querySelector('#reading-panel')?.scrollIntoView({behavior:'smooth'});}
function historyPanel(){
 const box=el('section',{class:'paper history-panel',id:'reading-panel'},button('Fechar',()=>{panel='';render();},{class:'quiet close'}),el('h2',{},({index:'Índice da fonte',terms:'Glossário contextual',mediations:'Explicações salvas',notes:'Notas e perguntas',source:'Sobre esta fonte'} as any)[panel]));
 if(panel==='source'){
  box.append(el('dl',{},el('dt',{},'Edição / tradução'),el('dd',{},ctx.source.edition||'Não informada'),el('dt',{},'Idioma original'),el('dd',{},ctx.source.original_language),el('dt',{},'Arquivo preservado'),el('dd',{},ctx.source.filename),el('dt',{},'Identificação da versão'),el('dd',{class:'wrap'},ctx.source.sha256)),...ctx.source.warnings.map((w:string)=>el('p',{class:'warning'},w)),el('p',{class:'muted'},'O original binário pode ser obtido pela API autenticada ou na exportação privada. Não é publicado. O índice mostra o texto extraído para conferência.'),button('Fornecer nova versão ou transcrição',()=>{importParent=ctx;screen='import';render();},{disabled:!online()}));
  return box;
 }
 for(const item of panelData?.items||[]){
  if(panel==='index')box.append(button(`${item.locator} · ${item.preview}`,()=>move('open',item.ref),{class:'index-item'}));
  else box.append(el('article',{class:'history-item'},el('small',{class:'muted'},[item.language,item.kind,item.origin,new Date(item.created_at).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')),el('h3',{},item.term||''),el('p',{dir:'auto'},item.definition||item.rewrite||item.text||`Marca: ${item.kind}`)));
 }
 if(!panelData?.items.length)box.append(el('p',{class:'muted'},'Nenhum registro nesta seção.'));
 box.append(pagination(panelData?.pagination||{},n=>showHistory(panel,n)));return box;
}
function settingsView(){
 const section=el('section',{class:'settings'},el('p',{class:'eyebrow'},'SUA LEITURA, SUAS ESCOLHAS'),el('h1',{},'Configurações'));
 const prefs=el('section',{class:'paper form-panel'},el('h2',{},'Preferências gerais'),el('p',{},'A leitura pode ter sua própria escolha. Uma seleção temporária no leitor vale só para aquela consulta.'),langSelect(account?.preferences.language||'pt-BR',async language=>{await mutate('preferences_set',{expected_revision:account.preferences.revision,language});await load();notice('Idioma padrão da conta salvo.');}));
 const size=el('select',{'aria-label':'Tamanho padrão das porções'},...['short','medium','long'].map((v,i)=>el('option',{value:v,selected:account?.preferences.portion_size===v},['Breve','Médio','Mais longo'][i])));prefs.append(field('Tamanho das porções',size,'Fórmulas, provas e tabelas permanecem inteiras.'),button('Guardar tamanho',async()=>{await mutate('preferences_set',{expected_revision:account.preferences.revision,portion_size:size.value});await load();notice('Tamanho padrão salvo.');},{disabled:!online(),class:'secondary'}));
 const connection=el('section',{class:'paper form-panel'},el('h2',{},'Conectar seu assistente'),el('p',{},'O assistente consulta o original, produz a reescrita e a salva aqui. Não é necessária chave de modelo no aplicativo.'),el('label',{class:'field'},el('span',{},'Endereço MCP desta instalação'),el('input',{readOnly:true,value:config.mcp_url,'aria-label':'Endereço MCP'})),el('p',{class:'muted'},config.local?'Este endereço é local. A conexão no ChatGPT depende de endpoint HTTPS ou túnel autorizado e da autenticação do titular. Ainda não foi homologada no ChatGPT.':'Adicione este MCP no cliente compatível, escolha OAuth e confira o consentimento da sua conta.'),button('Ver orientação do assistente',async()=>{const guide=await call('assistant_guidance');const pre=el('pre',{class:'guidance wide'},guide.instructions);connection.append(el('h3',{},`Orientação ${guide.version}`),pre);},{disabled:!online()}),el('p',{},'Na nova conversa, peça ao assistente para carregar assistant_guidance e retomar a leitura. A ferramenta não recebe o histórico completo do seu chat.'));
 const recovery=el('section',{class:'paper form-panel'},el('h2',{},'Recuperação e privacidade'),el('p',{},'Os dados canônicos ficam no servidor. A última biblioteca, porções carregadas e rascunhos ficam privados neste dispositivo até sair ou limpar a cópia.'),button('Limpar cópia deste dispositivo',async()=>{await clearPrivate();notice('Cópia privada local removida. Os dados no servidor foram preservados.');},{class:'secondary'}));
 if(pending)recovery.append(el('p',{class:'warning'},'Operação com resultado desconhecido.'),el('code',{class:'wrap'},pending.args.operation_id),button('Consultar recibo',()=>resolvePending(),{disabled:!online()}),button('Repetir mesma operação',()=>resolvePending(true),{disabled:!online()}));
 const backupText=el('textarea',{rows:5,'aria-label':'Backup privado',placeholder:'Exporte para obter o JSON privado, ou cole um backup completo para restaurar.'});
 recovery.append(el('h3',{},'Exportação privada'),el('p',{class:'muted'},'O backup inclui originais e notas. Proteja o arquivo. A ferramenta de linha de comando grava os bytes diretamente, sem download pelo navegador.'),backupText,el('div',{class:'note-actions'},button('Preparar JSON de exportação',async()=>{const sections:Record<string,unknown[]>={};for(const section of ['works','sources','elements','readings','mediations','notes','terms','events','preferences','receipts']){let next:number|null=0;sections[section]=[];while(next!==null){const data=await call('data_export',{section,offset:next,limit:50,include_original:true});sections[section].push(...data.items);next=data.pagination.next_offset;}}backupText.value=JSON.stringify({format:'araread/1',sections});notice('Backup privado preparado no campo. Nenhum arquivo foi publicado.');},{disabled:!online()}),button('Restaurar como novas leituras',async()=>{const result=await mutate('data_restore',{bundle:JSON.parse(backupText.value)});await load();notice(`${result.restored_readings} leitura(s) restaurada(s) com novos IDs. As leituras existentes foram preservadas.`);},{disabled:!online()})));
 section.append(prefs,connection,recovery);return section;
}
function consentView(){
 const section=el('section',{class:'paper form-panel'},el('h1',{},'Autorizar assistente'),el('p',{},'Carregando informações do cliente…'));const id=new URLSearchParams(location.search).get('authorization_id')!;
 void auth.auth.oauth.getAuthorizationDetails(id).then(({data,error})=>{if(error||!data){section.replaceChildren(el('h1',{},'Autorização indisponível'),el('p',{},'Reinicie a conexão no cliente.'));return;}if(!('authorization_id'in data)){location.assign(data.redirect_url);return;}
  section.replaceChildren(el('h1',{},`Autorizar ${data.client.name}`),el('p',{},'Esta conexão permite consultar sua biblioteca, guardar explicações e notas, registrar continuidade e executar exclusões explicitamente autorizadas. Confira a conta antes de conceder acesso.'),el('p',{class:'muted'},`Conta: ${session?.user.email} · Escopos de identidade: ${data.scope||'não informados'}`),button('Autorizar acesso',async()=>{const result=await auth.auth.oauth.approveAuthorization(id,{skipBrowserRedirect:true});if(result.error)throw new Error('Não foi possível autorizar.');if(result.data?.redirect_url)location.assign(result.data.redirect_url);},{class:'primary'}),button('Recusar',async()=>{const result=await auth.auth.oauth.denyAuthorization(id,{skipBrowserRedirect:true});if(result.data?.redirect_url)location.assign(result.data.redirect_url);},{class:'secondary'}));
 });return section;
}
async function switchOwner(){const previous=localStorage.getItem('araread-cache-owner');if(owner()&&previous!==owner()){await clearPrivate();localStorage.setItem('araread-cache-owner',owner());}ctx=null;account=null;pending=null;screen='library';}
async function logout(){const result=await auth.auth.signOut({scope:'local'});await clearPrivate();localStorage.removeItem('araread-auth-v1');localStorage.removeItem('araread-auth-v1-code-verifier');localStorage.removeItem('araread-cache-owner');session=null;ctx=null;account=null;pending=null;screen='library';message=result.error?'Sessão removida deste dispositivo. A revogação remota exige conexão.':'';render();}
window.addEventListener('online',()=>void guard(async()=>{notice('Conexão restabelecida. Confira suas alterações antes de enviar.');await load();}));window.addEventListener('offline',()=>{render();});
auth.auth.onAuthStateChange((event,next)=>{if(next&&session?.user.id===next.user.id){session=next;return;}if(event==='SIGNED_OUT'||(session&&next?.user.id!==session.user.id)){session=next;queueMicrotask(()=>void guard(async()=>{await switchOwner();if(!next)message='Sessão encerrada. Entre novamente para sincronizar.';await load();render();}));}});
await switchOwner();await guard(load);render();
if(import.meta.env.PROD&&'serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js');
