# Testes e evidências

O gate usa material sintético e identidades do Supabase Auth local real, em PostgreSQL isolado. Não exige chave de modelo. O teste de navegador interage com a interface servida e relê dados pela API; o teste MCP usa o cliente oficial e o provedor OAuth real. Simulação complementar de perda da resposta ocorre depois que a requisição real chegou ao servidor, sem substituir a persistência.

A evolução 0.2.0 tem [matriz F01–F10 própria](evolucao.md), incluindo limites das provas editoriais e do painel. Resultados atuais devem ser lidos no [checkpoint](../STATUS.md), sem atribuir as provas históricas à revisão nova.

Gate local 0.2.0: 52 testes do núcleo e oito jornadas web aprovados, tipos/build, links documentais e auditoria de dependências sem vulnerabilidades conhecidas. A prova de 10 mil elementos distingue tamanho lógico, compressão e tamanho físico das relações, sem prometer escala ilimitada. O [relatório sanitizado](evidencias/evolucao-2026-10-24.json) registra números e limites. Capturas nativas da [coluna no desktop](assets/evolution-phone-desktop.png) e das [configurações em 320 px](assets/evolution-settings-320.png) usam somente fixtures sintéticas. O teste também amplia texto a 200%, opera por teclado e confere foco/ausência de overflow; não é certificação assistiva completa.

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

## Evidências observadas

Os resultados finais ficam registrados no [STATUS](../STATUS.md). Durante o desenvolvimento passaram separadamente integração, OAuth/MCP, gêneros, reinício, instalação, restauração grande e jornadas web. O gate consolidado deve ser executado depois da última alteração; não atribua uma passagem anterior a uma revisão posterior sem verificar se ela permanece válida.

O caso extenso mediu uma fonte de 2.878.895 bytes, 10 mil elementos, página final de 50 elementos e resposta de 21.351 bytes. A última medição local registrou 574 ms para importação e 32 ms para essa página; não é benchmark de hospedagem, garantia de latência nem comparação entre sistemas. `.local/evidence/scale.json` contém a execução. A imagem Docker também foi executada com banco real, HTML e extração do PDF de duas páginas, com original preservado e lacuna explícita na segunda página.

Playwright grava diretamente pelo retorno nativo as imagens `.local/evidence/reader-desktop.png` e `reader-mobile.png`. Ambas foram inspecionadas: original/mediação identificados, controles de idioma, notas e retomada, leitura legível, sem overflow horizontal na largura de 390 px. As imagens contêm somente a obra sintética. As cópias selecionadas [desktop](assets/reader-desktop.png) e [celular](assets/reader-mobile.png) são derivadas desses bytes nativos, sem download pela interface.

Chrome DevTools foi usado para DOM, viewport, rede, screenshot nativa e console. Foi encontrado e corrigido um destino incorreto de HMR no CSP de desenvolvimento e uma fonte embutida bloqueada pelo CSP de produção; o build passou a emitir fontes como arquivos. A nova consulta do console ficou sem erros/avisos no login da aplicação. O teste E2E também observa erros de página e impede downloads. A ferramenta DevTools recusou gravação direta em disco por limite de raízes configuradas; não houve tentativa pela interface nem alteração de preferências para contornar isso. As evidências em disco vieram da API nativa de screenshot do Playwright.

Computer Use e Chrome DevTools foram usados na preparação do fluxo oficial de identidade e no painel do projeto exclusivo, sem executar senha/termos pessoais. O titular concluiu cadastro e autorização da CLI na nova conta. Essa autorização permitiu provisionar somente AraRead; não constitui prova do MCP no ChatGPT. Abas sem necessidade foram fechadas; a edição não salva do eXeLearning foi preservada por decisão expressa do titular.

A jornada `tests/e2e/account.spec.ts` cria uma identidade sintética, gera um link real de recuperação no GoTrue local, abre a tela de senha, rejeita confirmação divergente, altera a senha e entra novamente. Remove a identidade ao final. A screenshot nativa `.local/evidence/password-setup.png`, sem senha preenchida, foi inspecionada. O teste encontrou o caminho incorreto `/verify`; a configuração local do mailer foi corrigida para `/auth/v1/verify`.

## Gate remoto parcial

`tests/hosted-backend.ts` é separado da suíte local e não roda automaticamente na CI. Execute somente após conferir conta/organização/projeto exclusivos e disponibilizar por variáveis de processo `APP_MODE=production`, `AUTH_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE=authenticated`, `AUTH_PUBLISHABLE_KEY`, `DATABASE_URL`, `HOSTED_AUTH_ADMIN_KEY` e `CONFIRMED_ARAREAD_PROJECT_REF`. Com esses valores já definidos, use `npx tsx tests/hosted-backend.ts`. Não passe segredos na linha de comando nem crie um arquivo de credenciais rastreado pelo Git.

O gate exige host do Auth igual ao ref confirmado, usuário PostgreSQL `araread_app.<ref>` e TLS `verify-full` com raiz configurada. A chave administrativa cria/remove apenas as duas identidades sintéticas desta execução; as operações do domínio usam identidade comum e RLS. Foram aprovadas sete verificações: identidade/JWKS, cadastro público fechado, fonte/Unicode/idioma, mediação/recibo, continuidade/revisão, isolamento e revogação. Resultado em `.local/evidence/hosted-backend.json`, com as duas identidades removidas. Esse processo de domínio é Node local; as provas seguintes exercitam a aplicação hospedada.

## Aplicação HTTPS e cliente externo

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

## Homologação no ChatGPT e leitor pessoal

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

A [CI](../.github/workflows/ci.yml) fixa Ubuntu 24.04, configura Node, instalação pelo lockfile, tipos/docs/build, Compose real, identidades, testes e Chromium, sem segredos pessoais. O runner é fixado porque Playwright 1.56.1 não suporta Ubuntu 26.04, atualmente selecionado por `ubuntu-latest`. O comando opcional de rede pública não roda na CI. Não faça upload de `.local`, traces, tokens ou backups como artifacts. O estado da execução remota, quando disponível, deve ser registrado separadamente da evidência local.
