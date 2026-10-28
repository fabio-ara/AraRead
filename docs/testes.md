# Testes e evidências

## Evolução 0.5 — validação em curso

O gate acrescenta autoria e leitura da mesma edição por duas contas, publicação anônima autorizada, configuração privada, convites, idempotência, revisão e integridade de versões. O cliente MCP oficial exercita o fluxo editorial e o painel com os contratos registrados. A restauração v4 confere hashes, referências, isolamento, preservação de notas e compartilhamento inativo. Esses testes escritos ainda aguardam a execução integrada desta revisão.

Vinte e uma verificações puras passaram: DOCX/PPTX/EPUB, proteção de pacotes compactados e matriz editorial adversarial, alinhamentos e seleção Unicode. O teste de IndexedDB com duas abas passou em Chromium e WebKit, incluindo escrita nova durante sincronização e repetição pelo recibo. O painel de três abas foi inspecionado em host sintético com tabela, fórmula e apoio preparado. Esses resultados não substituem PostgreSQL/Auth reais nem homologação no cliente externo. O gate real de DOC/MOBI usa LibreOffice e calibre isolados, e permanece pendente.

As jornadas antigas continuam exigidas. A navegação explícita para Biblioteca acompanha a nova página inicial Edições, preservando as asserções sobre leitura, notas, seleção, retomada e offline. A CI mantém banco isolado, duas contas e todas as migrations; não faz reset no projeto hospedado. Resultados e revisão definitiva serão registrados em [STATUS](../STATUS.md) após o gate completo.

## Validação local 0.4

O gate do núcleo passou em 102/102 testes locais com Auth/PostgreSQL reais, incluindo instalação/evolução, compatibilidade de recibos/backup, RLS entre contas, parágrafos legados, seleção por representação, versões órfãs, datas civis e entradas matemáticas hostis. As regressões da revisão independente incluem citações literais de UUID, espaços em fronteiras legadas, oração parentética e pontuação CJK. O cliente MCP oficial conferiu também o JSON Schema real de saída; o campo de contexto da seleção foi acrescentado ao contrato após essa verificação.

Os testes de navegador exercitam seleção/persistência, três abas, outra sessão, fila offline e remoção; apoios incluem consulta real, nota de cálculo, queda de conexão e pergunta preservada. O host MCP sintético negocia capacidades e simula perda antes/depois do commit, relendo recibo e dados reais. Isso não homologa o host externo. `tests/lexicon-live.ts` é prova de rede explícita, separada da suíte determinística, para palavra comum, conceito e locução. Resultados de Chromium/WebKit, revisão independente e publicação em [STATUS](../STATUS.md). Os bloqueios e correções estão na [revisão 0.4](evidencias/revisao-0.4.md).

Chromium e WebKit passaram em **10/10 jornadas cada**, sem testes pulados, com Playwright 1.64.1. O primeiro detectou uma corrida na reconexão que recriava o leitor durante uma consulta; a reconexão agora sincroniza/revalida o cache sem recriar a passagem aberta. A prova lexical real adicional consultou casa, ontology e free will. O pacote Edge passou em `deno check`, com tipos de PostgreSQL e DOM declarados, e uma prova local do executor no Deno conferiu quatro casos. Isso não equivale à execução no Supabase hospedado.

[Evidência estruturada](evidencias/leitura-0.4-local.json). Capturas nativas inspecionadas: [320 px](assets/reader-v4-highlights-320.png), [1440 px com coluna de até 480 px](assets/reader-v4-highlights-1440.png), [escuro](assets/reader-v4-highlights-dark.png), [zoom 200%](assets/reader-v4-highlights-zoom200.png) e [cálculo na passagem](assets/reader-v4-calculator.png). Somente material sintético. A captura registra a interface, não comprova sozinha persistência.

## Instalação e cliente 0.4

Após o merge e a publicação, `tests/hosted-http.ts` aprovou 12 verificações; `tests/hosted-mcp.ts` com `HOSTED_UI=true`, oito; `tests/hosted-restore.ts`, quatro. Auth/PostgreSQL e Edge são os serviços reais existentes, acessados por contas sintéticas comuns; administração limitada à criação/remoção dessas identidades. O Pages confirmou grifo salvo e relido por nova sessão MCP, cálculo, teclado, largura máxima e recarga offline. [Relatório hospedado](evidencias/hospedado-0.4.json), [desktop](assets/hosted-v4-desktop.png), [móvel](assets/hosted-v4-mobile.png) e [calculadora](assets/hosted-v4-calculator.png).

O [ChatGPT real](evidencias/chatgpt-0.4.json) confirmou catálogo, painel, dois grifos e [cálculo contextual](assets/chatgpt-v4-calculator.png). A homologação nesse cliente é parcial: controle de navegador interrompido por segurança, sem teste final de vocabulário, mensagem ao chat ou outra conversa. A leitura pessoal não foi reparada. Esses limites não anulam as provas automatizadas, mas impedem declarar concluído todo o mandato.

## Validação 0.3 concluída

Em 24/10/2026, o núcleo atual passou em 78/78 testes com PostgreSQL/Auth reais e duas identidades. A suíte inclui instalação vazia, evolução de dados, RLS direto, recibos, concorrência, OAuth/PKCE e SDK MCP oficial preparando e apresentando as três representações, restauração acima de 16 MiB e 10 mil elementos. Os 13 testes de ingestão cobrem HTML contaminado, preâmbulo/bibliografia, prosa, colunas, notas, tabelas, fórmulas, lacunas e OCR não revisado. Casos editoriais sintéticos incluem filosofia, ciência, matemática, poesia, distinção marxiano/marxista e problema ontológico; não são citações autênticas.

Sete jornadas Playwright passaram: autenticação/recuperação real, recibo após resposta perdida, recuperação de fila anterior com conflito, três abas, teclado, responsividade, privacidade offline e ponte MCP Apps de apresentação sem escrita. Capturas nativas de 320/480/1440 px, tema escuro e CSS zoom 200% foram inspecionadas. O zoom de 200% também foi exercitado sobre viewport de 320 px, com abas empilhadas. Isso não constitui certificação WCAG nem prova no host ChatGPT.

O adaptador real Poppler/Tesseract 5.3.0 processou `synthetic-scanned.pdf` sem rede, com memória limitada; a ingestão preservou as negações e reteve o PDF. O caso HTTPS pontual `https://plato.stanford.edu/entries/plato/` passou com 140 elementos úteis (17 títulos, 43 parágrafos, 80 itens), autoria, preâmbulo e bibliografia, sem menus iniciais. A página não foi versionada; regressões usam fixtures próprias.

Tipos, build, links documentais, auditoria de histórico/árvore e npm audit passaram no checkpoint. O código verificado após a revisão está no commit `18e9855`; [evidência local](evidencias/leitura-0.3-local.json), [ingestão real](evidencias/ingestao-0.3.json) e benchmark vinculam escopo/limites. A revisão independente teve oito achados corrigidos e reproduzidos em testes antes/depois ([relatório](evidencias/revisao-0.3.md)). CI exata e gates hospedados/ChatGPT passaram, com escopo e limites em [STATUS](../STATUS.md). Nenhuma prova 0.2 abaixo se aplica automaticamente à 0.3.

### Benchmark de armazenamento 0.3

O script [benchmark-storage-v3.ts](../scripts/benchmark-storage-v3.ts) importa dezesseis HTMLs sintéticos por política, cada um com 160 parágrafos, e cria duas variantes por leitura. Opera sob Auth real e papel `authenticated`. Compara retenção bruta explícita e texto canônico, copia a amostra para tabelas TEMP com o schema/compressão/índices reais e mede heap, TOAST/auxiliares e índices por relação. A exportação passa por todas as dezoito seções da API.

A medição local do commit `6f0fcd5` registrou 8,26% de economia física (221.184 bytes) e 46,32% no backup da amostra (1.196.252 bytes). A compressão LZ4 do bruto reduz a diferença de disco. Tabelas novas não representam bloat, WAL, backups do provedor ou concorrência; latências locais aquecidas e corpus sintético não estimam capacidade de muitos usuários no plano Free. O [relatório completo](evidencias/armazenamento-0.3.json) identifica revisão, ambiente, tamanhos por tabela, latências e limites. A execução exploratória anterior mediu 8,56% de ganho físico; variação de um bloco de 8 KiB nos índices mostra o limite da alocação em corpus pequeno.


O gate usa material sintético e identidades do Supabase Auth local real, em PostgreSQL isolado. Não exige chave de modelo. O teste de navegador interage com a interface servida e relê dados pela API; o teste MCP usa o cliente oficial e o provedor OAuth real. Simulação complementar de perda da resposta ocorre depois que a requisição real chegou ao servidor, sem substituir a persistência.

### Instalação e cliente 0.3

A [evidência hospedada](evidencias/hospedado-0.3.json) registra os gates do PostgreSQL/Auth remoto, HTTPS Edge, SDK e Pages, incluindo restauração de 17.086.902 bytes e isolamento. A [evidência ChatGPT](evidencias/chatgpt-0.3.json) registra ferramentas atualizadas, três abas acionadas, navegação, memória, preferências/perfis e recuperação em outra conversa sem escrita. O host mostrava CSP desativada no modo de desenvolvimento preexistente; essa configuração permaneceu intacta.

Capturas nativas inspecionadas: [explicação no ChatGPT](assets/chatgpt-v3-facilitated.png), [tradução](assets/chatgpt-v3-translation.png), [original](assets/chatgpt-v3-original.png), [retomada em outra conversa](assets/chatgpt-v3-resume.png), [Pages móvel](assets/hosted-v3-mobile.png) e [Pages desktop](assets/hosted-v3-desktop.png). Os materiais exibidos são sintéticos e as imagens foram preservadas diretamente dos bytes nativos, sem downloads na interface.

## Gates 0.2.0 — históricos — local, hospedado e ChatGPT

A evolução 0.2.0 tem [matriz F01–F10 própria](evolucao.md), incluindo limites das provas editoriais e do painel. Resultados atuais devem ser lidos no [checkpoint](../STATUS.md), sem atribuir as provas históricas à revisão nova.

Gate local 0.2.0: 52 testes do núcleo e oito jornadas web aprovados, tipos/build, links documentais e auditoria de dependências sem vulnerabilidades conhecidas. A prova de 10 mil elementos distingue tamanho lógico, compressão e tamanho físico das relações, sem prometer escala ilimitada. O [relatório sanitizado](evidencias/evolucao-2026-10-24.json) registra números e limites. Capturas nativas da [coluna no desktop](assets/evolution-phone-desktop.png) e das [configurações em 320 px](assets/evolution-settings-320.png) usam somente fixtures sintéticas. O teste também amplia texto a 200%, opera por teclado e confere foco/ausência de overflow; não é certificação assistiva completa.

O código [26687a4](https://github.com/fabio-ara/AraRead/commit/26687a4b89edac80d88af5720c3a57efb15b126c) passou na [CI](https://github.com/fabio-ara/AraRead/actions/runs/40102736244): 52 testes do núcleo, oito jornadas web, Docker, tipos/build/documentação e auditoria sem vulnerabilidades conhecidas. O [Pages aprovado](https://github.com/fabio-ara/AraRead/actions/runs/40103014546) publicou esse código com auditoria de 69 arquivos e licenças no artefato. O workflow exige CI aprovada na revisão exata; resultados posteriores aparecem nos links de workflows do checkpoint.

| Camada | Resultado atual observado | Limite |
|---|---|---|
| Banco hospedado | Três migrations, 16 tabelas com RLS forçado e aplicação sem bypass | Projeto exclusivo, sem alteração dos irmãos |
| HTTP Edge | Nove verificações: 401, CORS, original/hash, recibos, duas contas, PDF, URL/SSRF, 24 chamadas concorrentes e revogação | Material e identidades sintéticos |
| SDK MCP sobre HTTPS | Sete verificações, 27 ferramentas/orientação 1.1.0, DCR/PKCE, nova sessão, estudo/variantes/contexto/lexicon/source_append e recurso Apps, audiência e revogação/reautorização | Cliente oficial separado do ChatGPT |
| Pages com login comum | Mediação MCP relida, nota/continuidade salvas e confirmadas em outra sessão MCP; 1440 px com coluna ≤480 e celular 390 px; idioma e logout | Sem credencial de serviço Sites no caminho |
| Offline Pages | Service worker ativo; contexto sem rede e recarga recuperaram shell, biblioteca e porção preparada | Sem geração offline; limites explícitos de cache |
| Restauração Edge | Quatro verificações; backup v2 de 17.086.190 bytes, gateway 32 MiB, recibo/IDs novos e originais iguais entre duas contas | Não é restauração administrativa do provedor |
| ChatGPT real | Orientação atual, bibliografia/perspectiva/contexto, mediação, termo e diálogo, acréscimo na mesma leitura, painel interativo, nova conversa e comparação de duas variantes salvas | Modelo não identificado no registro; sem revisão humana; CSP do host preexistente desativada |

As capturas nativas do [Pages no desktop](assets/pages-reader-desktop.png) e [Pages no celular](assets/pages-reader-mobile.png) foram inspecionadas e contêm apenas material sintético. O [relatório consolidado](evidencias/evolucao-2026-10-24.json) preserva resultados, configuração pública e revisão sem credenciais. A [prova ChatGPT 0.2.0](evidencias/chatgpt-evolucao-2026-10-24.json) registra ações e limpeza exatas; não contém e-mail da conta, tokens, sidebar ou URL de conversa privada. As identidades sintéticas dos gates HTTPS foram removidas; as fixtures da sessão pessoal foram excluídas por título/ID exatos e recibo, preservando conta e concessão.

Para reproduzir a UI hospedada, o runner fornece HOSTED_FRONTEND_ORIGIN (origem CORS) e HOSTED_FRONTEND_URL (URL completa com /AraRead/); a função verifyHostedUi recebe essa URL completa. Não usa ARAREAD_SITE_SERVICE_ACCESS nem bloqueia service workers. Testes históricos abaixo conservam suas condições originais e não descrevem a implementação atual.

## Reproduzir

Execute a [instalação local](instalacao.md), mantenha o servidor em produção local ativo e rode:

```powershell
npm run check
npm test
npm run test:e2e
npm run build
npm run docs:check
npm audit --audit-level=moderate
```

`npm test` roda em série, com proteções contra banco remoto. A prova de instalação cria e remove somente um banco chamado `araread_test_install_<uuid>` no PostgreSQL exclusivo. Ela usa o schema real produzido pelo GoTrue em execução para conferir instalação/evolução das migrations do aplicativo; a identidade de login é comprovada separadamente pelo setup e integrações Auth/OAuth, sem chamar a fixture SQL de conta de login.

A prova de reinício sobe um processo Node temporário em `4316`, grava dados reais, termina e recria esse processo e relê em nova sessão. Não para o processo principal nem qualquer serviço irmão. A prova extensa cria 10 mil elementos e remove a obra sintética identificada. A restauração grande ultrapassa 16 MiB e compara os bytes originais após recuperação pela rota autenticada.

Para a prova adicional de rede pública, que depende de serviços externos e não faz parte da CI determinística:

```powershell
npx tsx scripts/verify-public-url.ts
```

Ela obtém somente `example.com` e usa o redirecionamento público do httpbin para comprovar rejeição de destino loopback. Uma tentativa inicial com httpbingo recebeu recusa do próprio serviço, sem provar o redirecionamento; foi substituída pelo endpoint httpbin, que permitiu exercitar o fluxo. Isso não envolve dados pessoais. Resultado em `.local/evidence/public-url.json`.

## Matriz da base 0.1.0 (histórica)

| Nº | Requisito → implementação | Teste e evidência |
|---|---|---|
| 1 | Instalação sem modelo, migrations e Auth reais → Compose/setup/migrate | `install.test.ts`, `scripts/accounts.ts`, login real nas integrações; checksum de migrations preservado |
| 2 | Original PT/outro idioma, padrão pt-BR, ordem/termos → fontes, contratos e orientação | `integration.test.ts`, `genres.test.ts`, fixtures editoriais e avaliação abaixo |
| 3 | Parágrafo longo, várias porções e cobertura parcial → `anchors.ts`, `reading_move` | `importers.test.ts`: união exata em pontos de código; integração: cobertura não conclui elemento inteiro |
| 4 | Matemática/física/filosofia/religião/ciência/botânica → blocos extensíveis e acréscimos tipados | `genres.test.ts`, seis amostras, gravação e segunda consulta; avaliação editorial por IA |
| 5 | Nota/tabela/figura/PDF imperfeito → importadores e original binário | `importers.test.ts`, PDF sintético de duas páginas; renderização MuPDF inspecionada, página sem texto sinalizada |
| 6 | Fonte parcial, fim disponível e nova versão → `partial`, `derives_from`, leituras separadas | Integração: versão nova não altera retomada anterior; contexto termina pedindo mais material |
| 7 | Pergunta/resposta salva sem avançar; explicação reutilizada → notas/mediações | Integração e MCP: `reply_to`, origem, histórico, segunda leitura sem regeneração |
| 8 | Outra sessão/cliente e reinício real → PostgreSQL canônico | `restart.test.ts`, OAuth: posição, idioma, glossário, perguntas e explicação relidos após encerrar processo |
| 9 | Rever/saltar sem cobrir lacunas ou inferir compreensão → estados separados | Integração e E2E: aberto ≠ retomada, cobertura só explícita, marca pessoal exige origem do usuário |
| 10 | Idiomas e escrita bidirecional → BCP 47, idiomas de fonte/saída independentes | Integração, reinício e E2E: ja/ar, PT, diacríticos, árabe/japonês/hebraico/emoji; escolha temporária não grava preferência |
| 11 | Falha antes/depois do commit e repetição → transação/recibo | Integração: rollback e dedupe; E2E: aborta resposta real já recebida do servidor, consulta recibo e confere nota única |
| 12 | Dois clientes concorrentes → bloqueio/revisão | Integração: uma escrita vence, outra recebe `CONFLICT`, sem sobrescrever |
| 13 | Mobile/rede lenta/offline/cache/logout → UI/IndexedDB/SW | E2E: latência 150 ms, limites 96/48 KB/s, viewport 390×844, reload offline, rascunho, troca de conta e logout em outra aba; uma fixture de sessão ausente comprova retenção do rascunho até entrar na mesma conta, sem confundi-la com logout explícito |
| 14 | Duas contas, arquivos/busca/exportação/recibos e relações → RLS forçado | Integração sob papel `authenticated`, API de original e tentativas de ligação cruzada |
| 15 | Tokens/permissões/revogação/reconexão → `auth.ts` e sessão ativa | Integração e OAuth real: PKCE errado, audiência errada, expirado, leitura sem escrita, logout/concessão e nova autorização |
| 16 | Fonte hostil/HTML/SVG/URL/limites/referências → dados sem execução, obtenção com DNS fixado | Importadores, integração, rede pública com redirecionamento; fronteira do servidor não é prova de imunidade do modelo |
| 17 | Exportação/restauração/proveniência/IDs → bundle validado e transação | Integração: hashes, relações, cobertura e rollback adulterado; `large-restore.test.ts`: backup >16 MiB e bytes iguais |
| 18 | Obra extensa/resposta limitada/docs → paginação e verificador de links | `scale.test.ts`: 10 mil elementos; `docs:check`: arquivos e links; métricas sem conteúdo pessoal |

## Evidências da base 0.1.0 (históricas)

Os resultados finais ficam registrados no [STATUS](../STATUS.md). Durante o desenvolvimento passaram separadamente integração, OAuth/MCP, gêneros, reinício, instalação, restauração grande e jornadas web. O gate consolidado deve ser executado depois da última alteração; não atribua uma passagem anterior a uma revisão posterior sem verificar se ela permanece válida.

O caso extenso mediu uma fonte de 2.878.895 bytes, 10 mil elementos, página final de 50 elementos e resposta de 21.351 bytes. A última medição local registrou 574 ms para importação e 32 ms para essa página; não é benchmark de hospedagem, garantia de latência nem comparação entre sistemas. `.local/evidence/scale.json` contém a execução. A imagem Docker também foi executada com banco real, HTML e extração do PDF de duas páginas, com original preservado e lacuna explícita na segunda página.

Playwright grava diretamente pelo retorno nativo as imagens `.local/evidence/reader-desktop.png` e `reader-mobile.png`. Ambas foram inspecionadas: original/mediação identificados, controles de idioma, notas e retomada, leitura legível, sem overflow horizontal na largura de 390 px. As imagens contêm somente a obra sintética. As cópias selecionadas [desktop](assets/reader-desktop.png) e [celular](assets/reader-mobile.png) são derivadas desses bytes nativos, sem download pela interface.

Chrome DevTools foi usado para DOM, viewport, rede, screenshot nativa e console. Foi encontrado e corrigido um destino incorreto de HMR no CSP de desenvolvimento e uma fonte embutida bloqueada pelo CSP de produção; o build passou a emitir fontes como arquivos. A nova consulta do console ficou sem erros/avisos no login da aplicação. O teste E2E também observa erros de página e impede downloads. A ferramenta DevTools recusou gravação direta em disco por limite de raízes configuradas; não houve tentativa pela interface nem alteração de preferências para contornar isso. As evidências em disco vieram da API nativa de screenshot do Playwright.

Computer Use e Chrome DevTools foram usados na preparação do fluxo oficial de identidade e no painel do projeto exclusivo, sem executar senha/termos pessoais. O titular concluiu cadastro e autorização da CLI na nova conta. Essa autorização permitiu provisionar somente AraRead; não constitui prova do MCP no ChatGPT. Abas sem necessidade foram fechadas; a edição não salva do eXeLearning foi preservada por decisão expressa do titular.

A jornada `tests/e2e/account.spec.ts` cria uma identidade sintética, gera um link real de recuperação no GoTrue local, abre a tela de senha, rejeita confirmação divergente, altera a senha e entra novamente. Remove a identidade ao final. A screenshot nativa `.local/evidence/password-setup.png`, sem senha preenchida, foi inspecionada. O teste encontrou o caminho incorreto `/verify`; a configuração local do mailer foi corrigida para `/auth/v1/verify`.

## Gate remoto parcial 0.1.0 (histórico)

`tests/hosted-backend.ts` é separado da suíte local e não roda automaticamente na CI. Execute somente após conferir conta/organização/projeto exclusivos e disponibilizar por variáveis de processo `APP_MODE=production`, `AUTH_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE=authenticated`, `AUTH_PUBLISHABLE_KEY`, `DATABASE_URL`, `HOSTED_AUTH_ADMIN_KEY` e `CONFIRMED_ARAREAD_PROJECT_REF`. Com esses valores já definidos, use `npx tsx tests/hosted-backend.ts`. Não passe segredos na linha de comando nem crie um arquivo de credenciais rastreado pelo Git.

O gate exige host do Auth igual ao ref confirmado, usuário PostgreSQL `araread_app.<ref>` e TLS `verify-full` com raiz configurada. A chave administrativa cria/remove apenas as duas identidades sintéticas desta execução; as operações do domínio usam identidade comum e RLS. Foram aprovadas sete verificações: identidade/JWKS, cadastro público fechado, fonte/Unicode/idioma, mediação/recibo, continuidade/revisão, isolamento e revogação. Resultado em `.local/evidence/hosted-backend.json`, com as duas identidades removidas. Esse processo de domínio é Node local; as provas seguintes exercitam a aplicação hospedada.

## Aplicação HTTPS e cliente externo 0.1.0 (histórico)

Os gates voluntários exigem `CONFIRMED_ARAREAD_PROJECT_REF`, `HOSTED_API_BASE`, `HOSTED_FRONTEND_ORIGIN`, `AUTH_PUBLISHABLE_KEY` e `HOSTED_AUTH_ADMIN_KEY` em variáveis do processo. Recusam API cujo host ou caminho não correspondam ao projeto confirmado. A chave administrativa somente provisiona e remove as identidades sintéticas; a jornada usa login comum, OAuth e RLS. Confira conta/organização/projeto antes de fornecer essas variáveis.

```powershell
npx tsx tests/hosted-http.ts
npx tsx tests/hosted-mcp.ts
npx tsx tests/hosted-restore.ts
```

| Prova real | Resultado observado em 24/10/2026 UTC | Relatório privado |
|---|---|---|
| Gateway Edge HTTP | Nove verificações: saúde/banco e 401, CORS exato, original/hash/Unicode/idioma, escrita/recibo/segunda leitura, duas contas, PDF com lacuna, URL pública e loopback recusado, 24 chamadas concorrentes alternando identidades, revogação imediata | `.local/evidence/hosted-http.json` |
| MCP pelo SDK oficial externo | Seis verificações: DCR/PKCE e recusa de verificador errado, orientação e 16 ferramentas, importação/mediação/recibo em nova sessão, audiência web recusada, revogação e nova autorização | `.local/evidence/hosted-mcp.json` |
| Interface publicada + nova sessão MCP | A interface leu a mediação do MCP, gravou nota e continuidade; outra sessão MCP confirmou ambas. Login real, pt-BR/ja/pt-BR, desktop/celular, sem overflow, logout, sem erro de página ou download | Campo `published_ui` do relatório MCP; `tests/hosted-ui.ts` |
| Restauração grande no Edge | Quatro verificações: perfil de 16 MiB, backup de 17.085.827 bytes aceito pela rota de 32 MiB, recibo/IDs remapeados e originais com hashes iguais em duas contas | `.local/evidence/hosted-restore.json` |

A prova UI é opcional dentro do gate MCP: recebe `ARAREAD_SITE_SERVICE_ACCESS` por entrada privada do runner e envia essa credencial somente no cabeçalho para a origem exata do Site. Não passa esse valor ao código da página nem ao Supabase; o login de leitor continua separado. Não grave a credencial em comando, arquivo rastreado ou URL. As imagens nativas [desktop hospedado](assets/hosted-reader-desktop.png) e [celular hospedado](assets/hosted-reader-mobile.png) foram inspecionadas visualmente.

O teste UI hospedado bloqueia service workers, porque a credencial de serviço não cria uma sessão de visitante Sites. Portanto, ele não comprova cache offline hospedado. A jornada local com quatro testes E2E cobre o service worker, rede lenta, rascunhos e troca de identidade. Todos os gates remotos removem suas identidades sintéticas; o MCP também remove o cliente OAuth criado por ele.

O [relatório consolidado sem credenciais](evidencias/2026-10-24.json) preserva datas e resultados desses gates no repositório. A prova abaixo acrescenta o ChatGPT real, após os atos pessoais do titular, e não substitui nem reclassifica as provas do SDK.

## Homologação 0.1.0 no ChatGPT e leitor pessoal (histórica)

Em 24/10/2026, o titular concluiu senha da biblioteca, confiança no plugin pessoal e consentimento OAuth. O cliente foi o ChatGPT web no Chrome dedicado, plugin pessoal AraRead cuja página mostrava versão 1.0.0; aplicação 0.1.0 e orientação 1.0.0. Foram usadas duas conversas e somente a obra sintética `Homologação AraRead ChatGPT c229730b`, com três parágrafos de 180, 181 e 103 pontos de código. O [relatório específico](evidencias/chatgpt-2026-10-24.json) registra referências e resultados, sem identidade da conta, tokens ou biblioteca pessoal.

| Verificação | Evidência observada |
|---|---|
| Orientação e contexto | ChatGPT recebeu `assistant_guidance` 1.0.0 e `account_context`; buscou a fixture e importou três blocos estruturados na ordem fornecida |
| Mediação e conversa salva | Reescrita pt-BR com proveniência ChatGPT/`ai_unreviewed`, uma pergunta de origem `user`, resposta `assistant` com `reply_to` correto e termo “hipótese” |
| Escrita sem avanço | Cinco recibos confirmados; revisão 4, retomada e posição aberta no Parágrafo 1 `[0,180)`, cobertura vazia, sem marca de compreensão |
| Interface independente | Leitor autenticado mostrou original, mesma reescrita, pergunta/resposta e termo no glossário; [captura nativa inspecionada](assets/chatgpt-reader-confirmed.png) |
| Continuidade explícita | Um `continue` confirmado por recibo mudou revisão 4→5; cobertura somente do Parágrafo 1 e retomada/aberto no Parágrafo 2 `[0,181)`, sem mediação inventada na segunda porção |
| Nova conversa | Nova busca pelo título encontrou a leitura; orientação, contexto, índice e históricos recuperaram original atual, idioma pt-BR, mediação anterior, notas e termo; releitura final manteve revisão 5 e as mesmas posições |
| Conferência após reconectar | Interface online retomou no Parágrafo 2, informou ausência real de mediação e manteve o rascunho sem enviá-lo |

A revisão editorial da reescrita sintética preservou hipótese provisória, condição de explicitação e distinção entre possibilidade e certeza, com definições no próprio parágrafo. Isso não é revisão humana nem prova geral de fidelidade ou aprendizagem. Uma busca inicial do ChatGPT retornou erro sem diagnóstico preservado; a repetição com paginação padrão funcionou. Não há evidência suficiente para atribuir uma causa. As operações posteriores e a busca na nova conversa passaram.

Na sessão pessoal do Site, o navegador confirmou service worker ativo/controlando a página. O bloqueio de requisições pelo DevTools, viewport 390×844 e recarga recuperaram shell, biblioteca, porção anterior, reescrita e notas em cache. Um rascunho digitado sobreviveu à recarga e nova abertura da leitura, sem ser salvo no servidor; a largura do documento permaneceu 390 px. A captura nativa foi inspecionada. O instrumento manteve `navigator.onLine=true`, logo esse ensaio não prova os estados desativados dos botões; o gate E2E local cobre o modo offline completo. O rascunho foi limpo e rede/viewport restaurados. Revogação e reconexão continuam comprovadas pelo SDK no provedor real, sem revogar a concessão pessoal recém-autorizada do ChatGPT.

Ao final, o ChatGPT conferiu o título e `work_id` reais, excluiu somente a fixture com `work_delete`, recuperou o recibo confirmado e obteve busca vazia pelo título. A interface online confirmou biblioteca vazia. A cópia privada local do ensaio foi removida pelo controle da própria aplicação, preservando identidade e conexão pessoal. Não foram excluídas outras obras ou contas.

## Avaliação editorial

As seis [amostras originais e mediações](../tests/fixtures/editorial.json) foram compostas e comparadas por IA. Não são literatura acadêmica autêntica nem citações de autores conhecidos. A avaliação observou:

| Amostra | Conferência concreta e limite |
|---|---|
| Matemática | Conserva H1 → conclusão condicional e a ausência da regra; não apresenta o exemplo como prova completa. Figura F1 permanece ilustração descrita, sem interpretação visual inventada |
| Física | Conserva massa constante, unidade kg e ausência de validade demonstrada fora das condições. Não moderniza silenciosamente a equação nem afirma ter verificado física atual |
| Filosofia | Mantém atribuição a A, objeção de B, ausência de escolha do narrador e ambiguidade de dever. A hipótese interpretativa fica em campo separado |
| Religioso | Mantém voz e espera sem determinar quem fala. Distingue perspectiva confessional e literária/histórico-crítica, sem inventar cânone, tradição real ou história |
| Artigo científico | Conserva 12 observações fictícias, associação sem causalidade e incerteza não quantificada. Define termos no próprio parágrafo e preserva a ressalva |
| Botânica | Conserva rótulos Taxon A/B, distinção alterna/oposta e ausência de identificação real/parentesco estabelecido. A explicação não inventa nomes de espécies |

As reescritas curtas cobrem as proposições fornecidas, mantêm sua sequência e identificam apoio acrescentado. Os testes verificam gravação e integridade estrutural, sem medir fidelidade automaticamente. Uma nota crítica verificada exige fontes no contrato; o teste de “não verificado” explicita a pendência. Não foi realizada atualização científica substantiva de obra real, revisão humana, avaliação com leitores ou medição de aprendizagem. O assistente continuará responsável por consulta real a fontes primárias/acadêmicas quando fizer afirmações atuais.

## Três níveis e CI

Local usa aplicação completa, banco/Auth reais e cliente SDK. Hospedado exige identidade/destino exclusivo, migrations/configuração, interface, gateway e OAuth/duas contas no destino. Cliente externo real exige leitura/escrita e retomada no ChatGPT ou cliente autorizado, com conferência na interface. Os três níveis passaram, incluindo a jornada específica no ChatGPT descrita acima. Descoberta de metadados, `/health`, 401 e token administrativo não foram usados como substitutos dessa jornada.

A [CI](../.github/workflows/ci.yml) fixa Ubuntu 24.04, configura Node, instalação pelo lockfile, tipos/docs/build, Compose real, identidades, testes e Chromium, sem segredos pessoais. O runner permanece em Ubuntu 24.04; Playwright foi atualizado para 1.64.1 para corrigir recarga offline no WebKit. A CI executa Chromium e WebKit na imagem oficial Playwright 1.64.1-noble, fixada por digest, com Node 24.22.1. O núcleo continua no Node 24.14.0 do runner e roda antes da obtenção dessa imagem. A imagem inclui os navegadores e suas bibliotecas; não exige baixar 181 pacotes APT em cada gate. O script lexical ampliado de rede pública é opcional; a jornada de apoios usa uma consulta real ao Wikcionário e pode apontar indisponibilidade externa. Não faça upload de `.local`, traces, tokens ou backups como artifacts. O estado da execução remota, quando disponível, deve ser registrado separadamente da evidência local.

## Capturas locais 0.3

[320 px](assets/reader-v3-320.png), [desktop com coluna de até 480 px](assets/reader-v3-desktop.png), [zoom de 200% em 320 px](assets/reader-v3-zoom200.png), [tema escuro](assets/reader-v3-dark.png) e [ponte MCP Apps local](assets/mcp-v3-320.png). São material sintético, capturado pelo retorno nativo do Playwright; não homologam o ChatGPT real.
