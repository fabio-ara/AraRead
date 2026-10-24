# Decisões, capacidades e referências

Registro da versão 0.1.0, iniciado em 23/10/2026 e finalizado conforme o [checkpoint](../STATUS.md). Decisões são derivadas do uso pessoal e das provas realizadas, sem atribuir sucesso hospedado a testes locais.

| Decisão | Motivo e consequência |
|---|---|
| Frontend TypeScript sem framework visual | Biblioteca/leitor/configurações cabem em DOM simples; reaproveita contratos sem acrescentar infraestrutura curricular |
| Um domínio, adaptadores Node e Web padrão | Node reproduz o ambiente local; Edge serve a instalação hospedada. Ambos chamam o mesmo serviço, autorização e persistência |
| PostgreSQL/Auth Supabase; originais em `bytea` | Importação, referência e original entram no mesmo commit; suficiente para arquivos de 8 MiB e biblioteca pessoal; consome a cota de banco, sem depender de bucket público |
| Supabase Edge e interface estática privada no Sites | A incompatibilidade de `https.request.lookup` foi resolvida com Undici 7.30.1 e socket TLS para IP já validado, sem segunda resolução. O PDF foi reduzido de um pacote de 33 MB recusado para os módulos necessários; o pacote final de 3 MB passou no Edge real. Render foi retirado conforme a escolha do titular |
| Perfil de memória para Edge | Conta com 16 MiB de conteúdo e restauração HTTP de 32 MiB, mantendo original de até 8 MiB. Backup real de 17.085.827 bytes foi restaurado, com IDs novos e hashes iguais. Node local mantém 80/128 MiB |
| Pooler transacional no Edge | A repetição do gate atingiu `EMAXCONNSESSION`: instâncias efêmeras ocuparam as 15 conexões do modo de sessão. Porta 6543, pool de uma conexão e descarte ocioso em 1 s evitam prender uma sessão PostgreSQL por instância. Identidade/RLS continuam locais à transação, sem prepared statements nomeados |
| GoTrue/OAuth do provedor | Identidade, consentimento, PKCE, DCR e concessões reais; não criar servidor OAuth artesanal |
| Revogação por consulta de sessão/concessão | Bloqueio imediato em operações, ao custo de consultar banco e depender dele para autorizar |
| Intervalos em pontos de código e fontes imutáveis | Mudança de porção/idioma não altera identidade; versão nova não desloca notas antigas |
| Versão adicional para material parcial | Cadeia vinculada e leituras separadas conservam o histórico; não existe alinhamento/fusão automática de progresso entre versões |
| Revisão e recibo na transação | Conflito explícito e repetição segura após resposta perdida, sem um sistema distribuído de eventos |
| Cache privado limitado | Consulta da última porção e rascunho offline, sem simular sincronização nem criptografia contra o dono do perfil |

## Aproveitamento dos irmãos

Foram consultados seletivamente README, mapas, arquitetura, persistência, autoria/conexão MCP, identidade, instalação, recuperação e documentação visual/de testes dos repositórios AraLearn/AraHub disponíveis como irmãos locais. Suas licenças MIT foram conferidas. Foram adaptados conceitos de documentação por objetivo, estado canônico, prova de recibo, jornada de conexão e explicitação dos níveis de teste. Nenhum código, segredo, project ref, OAuth client ID ou dado pessoal foi transplantado. Complexidade de cursos, integrações institucionais, serviços e sistemas visuais completos foi rejeitada por não servir ao leitor pessoal. Os repositórios e serviços permaneceram em leitura.

## Capacidades e limites

Implementado: importadores declarados, fonte versionada, leitura por porção, reescritas por idioma, comentários tipados, proveniência, notas/perguntas/respostas, glossário, marcas voluntárias, quatro estados de progresso, histórico, exportação/restauração, cache privado, UI responsiva, API e MCP autenticados. A orientação chega pelo SDK em instruções/recurso/prompt/ferramenta. Não há geração interna ou chave de modelo exigida.

Validado localmente: persistência e Auth reais, duas contas e RLS, revisões concorrentes, falhas antes/depois do commit, revogação, PKCE e nova autorização, protocolos moderno/legado do SDK, reinício real, migração vazia/evolução, PDF imperfeito, seis gêneros sintéticos, mobile/desktop/offline e fonte de 10 mil elementos. Os resultados consolidados estão em [testes](testes.md).

Validado com infraestrutura remota: conta independente e projeto exclusivo Free confirmados, migrations aplicadas com checksum, dez tabelas com RLS forçado, papel mínimo e conexão PostgreSQL com TLS verificado, Auth ES256 e inscrições públicas desativadas. Sete verificações exercitaram duas identidades sintéticas, fontes, recibos, retomada, isolamento e revogação; ambas foram removidas ao final. O domínio rodou em Node local: isso não prova gateway ou interface hospedados.

Validado no destino completo: nove verificações pelo gateway HTTPS, incluindo 24 chamadas concorrentes com identidades alternadas, seis verificações MCP com OAuth/PKCE e cliente oficial fora do servidor, interface publicada desktop/mobile e restauração acima de 16 MiB. A interface conferiu a mediação gravada pelo MCP e suas escritas foram relidas por nova sessão MCP. Não confundir esse cliente compatível com o ChatGPT.

Pendente pessoal: aceite/confirmação do titular para conectar o MCP no ChatGPT e definição da senha da biblioteca após convite. A descoberta OAuth no formulário real do ChatGPT identificou automaticamente endpoints, recurso e DCR; a caixa de confiança permaneceu desmarcada. Nenhum cartão, upgrade, plugin público ou recurso Render foi criado.

Fora desta versão: OCR automático, EPUB/DOCX, imagem interpretada automaticamente, extração perfeita de layout/PDF, alinhamento de edições, busca vetorial, geração interna, fila, sincronização de escrita offline, restauração multipart e classificação automática de verdade. Nenhuma dessas ausências autoriza descartar material original ou esconder uma lacuna.

## Fontes técnicas primárias

Consultas em 23/10/2026 (algumas já em 24/10 UTC). As especificações técnicas orientam a integração; não certificam o valor acadêmico da mediação.

- [MCP, transporte 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) e [autorização](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): revisão efetiva resolvida por `latest`, descoberta e recurso protegido.
- [SDK TypeScript oficial](https://github.com/modelcontextprotocol/typescript-sdk): pacotes instalados, tipos e implementação oficial foram inspecionados; a prova usa o cliente real, sem transporte simulado.
- [OpenAI, autenticação](https://developers.openai.com/plugins/build/auth) e [conexão no ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt): autorização e procedimento do cliente; não confundir com teste efetivamente executado.
- [Supabase, MCP próprio](https://supabase.com/docs/guides/ai-tools/byo-mcp), [OAuth Server](https://supabase.com/docs/guides/auth/oauth-server) e [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): uso do provedor e isolamento.
- [Preços](https://supabase.com/pricing), [changelog](https://supabase.com/changelog) e [uso aceitável](https://supabase.com/aup): plano gratuito e limitações a conferir novamente antes de criar recursos. Não houve aceite de termos pelo agente.
- [PDF.js](https://github.com/mozilla/pdf.js) e [KaTeX](https://katex.org/docs/security.html): componentes de representação, com limites e avisos conservados.
- [GitHub Actions checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) e [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0): versões oficiais consultadas pela API GitHub ao montar a CI.

Matriz de bibliotecas fixadas: MCP server/client 2.4.0, adaptador Node 2.1.2, supabase-js 2.118.0, Express 5.1.0, pg 8.16.3, jose 6.1.0, Zod 4.6.7, PDF.js 6.4.299, KaTeX 0.19.1, linkedom 0.18.12, Vite 8.3.5, TypeScript 5.9.3, Playwright 1.56.1, Supabase CLI 2.122.0. O lockfile é a resolução autoritativa; a CI da revisão `6716226` aprovou 32 testes do núcleo e três jornadas web. Mudanças posteriores têm evidência própria no checkpoint.

Consultas adicionais em 24/10/2026: [limites Edge](https://supabase.com/docs/guides/functions/limits), [autenticação Edge](https://supabase.com/docs/guides/functions/auth), [API oficial de gerenciamento](https://api.supabase.com/api/v1-json) e [conectores TLS Undici](https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Connector.md). O Edge documenta 256 MB e 2 s de CPU por requisição; PDF complexo pode ser interrompido. Undici 7.30.1 foi fixado após a auditoria identificar correções de segurança ausentes em 7.30.0. Não usar tráfego artificial para impedir pausas do plano gratuito.

A configuração final de conexões segue [conexão PostgreSQL para funções](https://supabase.com/docs/guides/database/connecting-to-postgres): pooler transacional, pool de uma conexão, ausência de prepared statements nomeados e contexto local à transação. A investigação de `EMAXCONNSESSION` consultou os [logs por SQL](https://supabase.com/docs/guides/observability/advanced-log-filtering), somente no projeto exclusivo e em janela delimitada, sem registrar tokens ou corpos de requisição.
