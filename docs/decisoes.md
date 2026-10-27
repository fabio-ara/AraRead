# Decisões, capacidades e referências

Registro consolidado da evolução 0.2.0. As provas históricas 0.1.0 permanecem em [testes](testes.md); o [checkpoint](../STATUS.md) identifica quais gates da revisão atual foram concluídos.

| Decisão | Motivo e consequência |
|---|---|
| Frontend TypeScript sem framework visual | Biblioteca/leitor/configurações cabem em DOM simples; reaproveita contratos sem acrescentar infraestrutura curricular |
| Um domínio, adaptadores Node e Web padrão | Node reproduz o ambiente local; Edge serve a instalação hospedada. Ambos chamam o mesmo serviço, autorização e persistência |
| PostgreSQL/Auth Supabase; cânone textual e bytes opcionais | Texto, estrutura, hashes e referências entram no mesmo commit. Bytes antigos permanecem; fontes novas guardam binário quando necessário ou solicitado. Economia física precisa de benchmark com TOAST/índices |
| Supabase Edge e interface estática pública no GitHub Pages | A incompatibilidade de `https.request.lookup` foi resolvida com Undici 7.30.1 e socket TLS para IP já validado, sem segunda resolução. O PDF foi reduzido de um pacote de 33 MB recusado para os módulos necessários; o pacote final de 3 MB passou no Edge real. Render foi retirado conforme a escolha do titular |
| Perfil de memória para Edge | Conta com 16 MiB de conteúdo e restauração HTTP de 32 MiB, mantendo original de até 8 MiB. Backup v2 real de 17.086.190 bytes foi restaurado, com IDs novos e hashes iguais. Node local mantém 80/128 MiB |
| Pooler transacional no Edge | A repetição do gate atingiu `EMAXCONNSESSION`: instâncias efêmeras ocuparam as 15 conexões do modo de sessão. Porta 6543, pool de uma conexão e descarte ocioso em 1 s evitam prender uma sessão PostgreSQL por instância. Identidade/RLS continuam locais à transação, sem prepared statements nomeados |
| GoTrue/OAuth do provedor | Identidade, consentimento, PKCE, DCR e concessões reais; não criar servidor OAuth artesanal |
| Revogação por consulta de sessão/concessão | Bloqueio imediato em operações, ao custo de consultar banco e depender dele para autorizar |
| Intervalos em pontos de código e fontes imutáveis | Mudança de porção/idioma não altera identidade; versão nova não desloca notas antigas |
| Manifesto de segmentos para envios parciais | A próxima passagem da mesma edição entra no fim da mesma leitura. Outra edição/transcrição continua em versão/leitura distinta, sem remapear progresso |
| Revisão e recibo na transação | Conflito explícito e repetição segura após resposta perdida, sem um sistema distribuído de eventos |
| Cache e fila limitados | Última porção e preparo explícito, fila de notas/progresso com recibos e conflitos; sem download do livro inteiro nem criptografia contra o dono do perfil |

## Aproveitamento dos irmãos

Foram consultados seletivamente mapas, arquitetura, persistência, conexão, recuperação e documentação dos irmãos em modo somente leitura. Tokens visuais de cor, tipografia, espaçamento e controles foram adaptados da família Ara, sob MIT e autorização do titular; os avisos constam em [terceiros](../THIRD_PARTY_NOTICES.md). Nenhum segredo, identificador de instalação ou dado pessoal foi transplantado. A coluna de até 480 px vale em todas as telas por determinação posterior do titular, para leitura pelo celular e discussão com colegas.

## Capacidades e limites

Implementado: importadores declarados, fonte versionada, leitura por porção, reescritas por idioma, comentários tipados, proveniência, notas/perguntas/respostas, glossário, marcas voluntárias, quatro estados de progresso, histórico, exportação/restauração, cache privado, UI responsiva, API e MCP autenticados. A orientação chega pelo SDK em instruções/recurso/prompt/ferramenta. Não há geração interna ou chave de modelo exigida.

Validado localmente: persistência e Auth reais, duas contas e RLS, revisões concorrentes, falhas antes/depois do commit, revogação, PKCE e nova autorização, protocolos moderno/legado do SDK, reinício real, migração vazia/evolução, PDF imperfeito, nove gêneros sintéticos, mobile/desktop/offline e fonte de 10 mil elementos. Os resultados consolidados estão em [testes](testes.md).

A infraestrutura remota 0.1.0 foi comprovada com identidades sintéticas e cliente externo; as evidências originais estão em [testes](testes.md). Elas não comprovam automaticamente as funções 0.2.0. O estado corrente de migrations, runtime, Pages e cliente real deve ser consultado no [checkpoint](../STATUS.md), sem confundir publicação de código com publicação do serviço.

Validado no destino completo 0.2.0: nove verificações pelo gateway HTTPS, incluindo 24 chamadas concorrentes com identidades alternadas, sete verificações MCP com OAuth/PKCE, 27 ferramentas e cliente oficial fora do servidor, interface Pages desktop/mobile com recarga offline e restauração v2 acima de 16 MiB. A interface conferiu a mediação gravada pelo MCP e suas escritas foram relidas por nova sessão MCP. Não confundir esse cliente compatível com o ChatGPT.

Prova histórica 0.1.0 no ChatGPT após os atos pessoais do titular: orientação 1.0.0, importação sintética, reescrita, pergunta/resposta vinculada, glossário, recibos, continuidade explícita e recuperação em nova conversa. A interface autenticada confirmou os registros e a retomada. A revisão passou de 4 a 5 somente no avanço solicitado; a nova conversa manteve a revisão 5. A [evidência específica](evidencias/chatgpt-2026-10-24.json) separa essa jornada das provas anteriores do SDK. Revogação/reconexão permanecem comprovadas pelo SDK oficial no provedor real; a concessão pessoal do ChatGPT foi preservada. Nenhum cartão, upgrade, plugin público ou recurso Render foi criado.

Na evolução 0.2.0, o mesmo cliente pessoal atualizou as ferramentas e carregou orientação 1.1.0. Guardou referência consultada, perspectiva, contexto, variante, vocabulário e diálogo; acrescentou material à mesma leitura. O painel confirmou uma continuidade e uma nova conversa recuperou os dados sem escrever. Duas variantes com perspectivas/contextos diferentes foram recuperadas por ID e comparadas, sem geração para a comparação. Evidência e limites em [ChatGPT 0.2.0](evidencias/chatgpt-evolucao-2026-10-24.json); concessão pessoal preservada.

Fora desta versão: OCR automático, EPUB/DOCX, interpretação automática de imagem, extração perfeita de layout/PDF, alinhamento de edições distintas, busca vetorial, geração interna, restauração multipart, salas coletivas e classificação automática de verdade. Fila offline, perspectivas e cadernos seletivos agora estão implementados; suas garantias e limites estão na [evolução](evolucao.md).

## Fontes técnicas primárias

Consultas em 23/10/2026 (algumas já em 24/10 UTC). As especificações técnicas orientam a integração; não certificam o valor acadêmico da mediação.

- [MCP, transporte 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) e [autorização](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): revisão efetiva resolvida por `latest`, descoberta e recurso protegido.
- [SDK TypeScript oficial](https://github.com/modelcontextprotocol/typescript-sdk): pacotes instalados, tipos e implementação oficial foram inspecionados; a prova usa o cliente real, sem transporte simulado.
- [OpenAI, autenticação](https://developers.openai.com/plugins/build/auth) e [conexão no ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt): autorização e procedimento do cliente; não confundir com teste efetivamente executado.
- [Supabase, MCP próprio](https://supabase.com/docs/guides/ai-tools/byo-mcp), [OAuth Server](https://supabase.com/docs/guides/auth/oauth-server) e [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): uso do provedor e isolamento.
- [Preços](https://supabase.com/pricing), [changelog](https://supabase.com/changelog) e [uso aceitável](https://supabase.com/aup): plano gratuito e limitações a conferir novamente antes de criar recursos. Não houve aceite de termos pelo agente.
- [PDF.js](https://github.com/mozilla/pdf.js) e [KaTeX](https://katex.org/docs/security.html): componentes de representação, com limites e avisos conservados.
- [GitHub Actions checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) e [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0): versões oficiais consultadas pela API GitHub ao montar a CI.

Matriz de bibliotecas fixadas: MCP server/client 2.4.0, adaptador Node 2.1.2, supabase-js 2.118.0, Express 5.1.0, pg 8.16.3, jose 6.1.0, Zod 4.6.7, PDF.js 6.4.299, KaTeX 0.19.1, linkedom 0.18.12, Undici 7.30.1, Vite 8.3.5, TypeScript 5.9.3, Playwright 1.56.1, Supabase CLI 2.122.0. O lockfile é a resolução autoritativa; a [CI da revisão `af9ffd1`](https://github.com/fabio-ara/AraRead/actions/runs/40064353878) aprovou 32 testes do núcleo e quatro jornadas web, além de tipos, build, documentação e auditoria.

Consultas adicionais em 24/10/2026: [limites Edge](https://supabase.com/docs/guides/functions/limits), [autenticação Edge](https://supabase.com/docs/guides/functions/auth), [API oficial de gerenciamento](https://api.supabase.com/api/v1-json) e [conectores TLS Undici](https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Connector.md). O Edge documenta 256 MB e 2 s de CPU por requisição; PDF complexo pode ser interrompido. Undici 7.30.1 foi fixado após a auditoria identificar correções de segurança ausentes em 7.30.0. Não usar tráfego artificial para impedir pausas do plano gratuito.

A configuração final de conexões segue [conexão PostgreSQL para funções](https://supabase.com/docs/guides/database/connecting-to-postgres): pooler transacional, pool de uma conexão, ausência de prepared statements nomeados e contexto local à transação. A investigação de `EMAXCONNSESSION` consultou os [logs por SQL](https://supabase.com/docs/guides/observability/advanced-log-filtering), somente no projeto exclusivo e em janela delimitada, sem registrar tokens ou corpos de requisição.

Consultas primárias da evolução: [GitHub Pages por workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [MCP Apps](https://apps.extensions.modelcontextprotocol.io/api/documents/Overview.html), [Supabase OAuth Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started) e [armazenamento TOAST](https://www.postgresql.org/docs/current/storage-toast.html). A interface estática não hospeda um backend. Compressão e contexto limitado economizam recursos; não tornam o Free adequado a um número ilimitado de usuários/obras.

## Decisões da leitura 0.3

- Extração em módulos HTML/PDF/qualidade/OCR, compartilhados por Node e Edge. O adaptador aberto de OCR fica fora do Edge por custo de recursos; não há serviço pago ou chave de modelo.
- Separar `reading_context` de `reading_display` evita painel prematuro. A UI só apresenta três representações; o chat conserva o controle do estudo. Preparação persistida e comparação editorial precedem a apresentação.
- Perfis reutilizáveis são dados privados versionados, distintos de perspectivas presas a uma leitura. Pacotes opt-in não criam descoberta pública nem certificação de autoria.
- Preferências de sessão usam o ID real de Auth e não entram no backup. Exclusão, desativação e padrão têm efeitos distintos; valores sensíveis exigem pedido explícito.
- Mapa organizacional não reescreve títulos nem ordem do autor. Continuar fora da retomada conserva o percurso principal e só cobre o intervalo realmente confirmado.

Veja [Leitura 0.3](leitura-0.3.md), [testes](testes.md) e [STATUS](../STATUS.md) para evidência e limitações, sem extrapolar provas anteriores.


## Decisões da leitura 0.4

- Parágrafo pertence à fonte; passagem é intervalo; parágrafo didático pertence à versão. Limites estruturais flexíveis evitam cortes artificiais sem reescrever o cânone. Referências legadas são preservadas, com reparo explícito e reversível da abertura.
- Âncoras pertencem à representação/versão/segmento e usam pontos de código, citação e contexto. Reutilizar `notes` mantém RLS, backup, cotas e recibos; não foi criada tabela de marcações paralela.
- Componente DOM compartilhado reduz divergência entre web e iframe, conservando seleção nativa. SDK MCP Apps 2.0.4 (MIT) negocia capacidades; esbuild 0.28.2 empacota o recurso sem rede externa. Math.js 15.2.0 (Apache-2.0) fornece parser mantido; executor escalar restrito evita executar a linguagem de expressões completa. Versões, dependências transitivas e avisos estão no lockfile e inventário de licenças.
- `lexicon_lookup` e `term_save` foram evoluídos; o chat continua responsável por nova interpretação contextual. Não há serviço de modelo, chave ou banco de verbetes paralelo.

- Playwright 1.64.1 substitui 1.56.1 somente na infraestrutura de testes: incorpora a correção oficial de recarga offline com service worker no WebKit. A CI executa os dois motores na imagem oficial 1.64.1-noble, fixada por digest. O download APT de bibliotecas WebKit excedeu 20 minutos no primeiro gate; a imagem já contém essas dependências e evita reconstruí-las em cada execução.
