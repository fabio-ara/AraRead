# Testes e evidências

O gate usa material sintético e identidades do Supabase Auth local real, em PostgreSQL isolado. Não exige chave de modelo. O teste de navegador interage com a interface servida e relê dados pela API; o teste MCP usa o cliente oficial e o provedor OAuth real. Simulação complementar de perda da resposta ocorre depois que a requisição real chegou ao servidor, sem substituir a persistência.

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

## Matriz de aceitação local

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

Computer Use foi usado no fluxo oficial de cadastro, sem executar senha/termos. O usuário pediu transferência para o Chrome dedicado, e o cadastro foi aberto por Chrome DevTools em contexto isolado, com o e-mail indicado. Essa jornada é preparação de identidade, não conta criada ou integração homologada. Nenhuma outra aba autenticada foi usada para obter dados do usuário.

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

Local usa aplicação completa, banco/Auth reais e cliente SDK. Hospedado exige identidade/destino exclusivo, migrations/configuração, interface, gateway e OAuth/duas contas no destino. Cliente externo real exige leitura/escrita e retomada no ChatGPT ou cliente autorizado, com conferência na interface. A ausência dos dois últimos níveis está no [STATUS](../STATUS.md), sem substituí-los por `/health`, 401 ou token administrativo.

A [CI](../.github/workflows/ci.yml) configura Node, instalação pelo lockfile, tipos/docs/build, Compose real, identidades, testes e Chromium, sem segredos pessoais. O comando opcional de rede pública não roda na CI. Não faça upload de `.local`, traces, tokens ou backups como artifacts. O estado da execução remota, quando disponível, deve ser registrado separadamente da evidência local.
