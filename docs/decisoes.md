# Decisões, capacidades e referências

Registro da versão 0.1.0, iniciado em 23/10/2026 e finalizado conforme o [checkpoint](../STATUS.md). Decisões são derivadas do uso pessoal e das provas realizadas, sem atribuir sucesso hospedado a testes locais.

| Decisão | Motivo e consequência |
|---|---|
| Frontend TypeScript sem framework visual | Biblioteca/leitor/configurações cabem em DOM simples; reaproveita contratos sem acrescentar infraestrutura curricular |
| Um processo Node para web/API/MCP | Runtime efetivamente testado com SDK oficial, PostgreSQL, HTTPS com DNS fixado e PDF.js; evita manter uma segunda implementação de domínio |
| PostgreSQL/Auth Supabase; originais em `bytea` | Importação, referência e original entram no mesmo commit; suficiente para arquivos de 8 MiB e biblioteca pessoal; consome a cota de banco, sem depender de bucket público |
| Não adotar Edge Functions neste incremento | Não houve homologação das rotas Node/PDF/DNS no runtime Edge; container reproduzível está pronto. Hospedagem Node continua dependência externa, sem prometer compatibilidade não testada |
| GoTrue/OAuth do provedor | Identidade, consentimento, PKCE, DCR e concessões reais; não criar servidor OAuth artesanal |
| Revogação por consulta de sessão/concessão | Bloqueio imediato em operações, ao custo de consultar banco e depender dele para autorizar |
| Intervalos em pontos de código e fontes imutáveis | Mudança de porção/idioma não altera identidade; versão nova não desloca notas antigas |
| Versão adicional para material parcial | Cadeia vinculada e leituras separadas conservam o histórico; não existe alinhamento/fusão automática de progresso entre versões |
| Revisão e recibo na transação | Conflito explícito e repetição segura após resposta perdida, sem um sistema distribuído de eventos |
| Cache privado limitado | Consulta da última porção e rascunho offline, sem simular sincronização nem criptografia contra o dono do perfil |

## Aproveitamento dos irmãos

Foram consultados seletivamente README, mapas, arquitetura, persistência, autoria/conexão MCP, identidade, instalação, recuperação e documentação visual/de testes dos repositórios AraLearn/AraHub disponíveis como irmãos locais. Suas licenças MIT foram conferidas. Foram adaptados conceitos de documentação por objetivo, estado canônico, prova de recibo, jornada de conexão e explicitação dos níveis de teste. Nenhum código, segredo, project ref, OAuth client ID ou dado pessoal foi transplantado. Complexidade de cursos, integrações institucionais, serviços e sistemas visuais completos foi rejeitada por não servir ao leitor pessoal. Os repositórios e serviços permaneceram em leitura.

## Capacidades e limites

Implementado: importadores declarados, fonte versionada, leitura por porção, reescritas por idioma, comentários tipados, proveniência, notas/perguntas/respostas, glossário, marcas voluntárias, quatro estados de progresso, histórico, exportação/restauração pequena, cache privado, UI responsiva, API e MCP autenticados. A orientação chega pelo SDK em instruções/recurso/prompt/ferramenta. Não há geração interna ou chave de modelo exigida.

Validado localmente: persistência e Auth reais, duas contas e RLS, revisões concorrentes, falhas antes/depois do commit, revogação, PKCE e nova autorização, protocolos moderno/legado do SDK, reinício real, migração vazia/evolução, PDF imperfeito, seis gêneros sintéticos, mobile/desktop/offline e fonte de 10 mil elementos. Os resultados consolidados estão em [testes](testes.md).

Pendente externo: cadastro/consentimentos da conta independente, projeto exclusivo, runtime HTTPS sem custo não autorizado, migrações/configuração no destino, prova através do gateway e prova no ChatGPT. Não há URL hospedada ou alegação de homologação externa.

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

Matriz de bibliotecas fixadas: MCP server/client 2.4.0, adaptador Node 2.1.2, supabase-js 2.118.0, Express 5.1.0, pg 8.16.3, jose 6.1.0, Zod 4.6.7, PDF.js 6.4.299, KaTeX 0.19.1, linkedom 0.18.12, Vite 8.3.5, TypeScript 5.9.3, Playwright 1.56.1, Supabase CLI 2.122.0. O lockfile é a resolução autoritativa; a CI ainda precisa de execução no remoto para evidência própria.
