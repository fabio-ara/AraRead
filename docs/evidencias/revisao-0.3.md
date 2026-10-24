# Revisão independente da 0.3

Em 24/10/2026, uma execução independente da CLI Codex em modo somente leitura revisou `6f0fcd5` contra `bf9cf1a`. Tentativas anteriores por subagente falharam por capacidade; a execução independente concluída examinou código, migrations/RLS e testes sem alterar arquivos. A revisão foi estática. O agente de implementação reproduziu os achados e aplicou as correções em `18e9855b2865cf61bd6ccc37f0fb3f6c63b16d40`.

| Achado | Correção verificada |
| --- | --- |
| Imagem essencial dentro de parágrafo desaparecia e permitia descartar o original | Extração conserva imagem inline, inclusive sem descrição, e exige bytes originais; imagem explicitamente decorativa continua dispensável |
| Originais visuais distintos colidiam na deduplicação textual | Fontes que exigem ou solicitam retenção também comparam o hash dos bytes |
| Variante sem contexto assinado podia ser apresentada sob outra seleção de perfil | Apresentação exige contexto e assinatura atuais; histórico legado permanece consultável |
| Referência usada apenas no confronto editorial não invalidava a variante ao ser retirada | Evidências editoriais integram as dependências; exclusão também contempla registros anteriores com vínculo apenas interno |
| Backup restaurava UUIDs editoriais da conta de origem | Restauração remapeia vínculos internos e preserva o isolamento entre duas contas |
| `values.language` não era normalizado | Idioma efetivo de registro, perfil e operação usa etiqueta BCP 47 canônica |
| Recibos 0.2 de preferências deixavam de ser idempotentes | Comparação compatível preserva campos e ordem do contrato original sem executar a intenção novamente |
| Web mostrava abas antes de haver preparação válida | Tela sem preparo orienta o uso do chat; painel só aparece com resultado pronto |

Os novos testes foram executados sobre `bdaabaf` em checkout isolado: sete regressões do serviço e uma jornada de navegador falharam como previsto. Um oitavo caso confirmou que a tradução já exigia contexto ao salvar. Sobre a correção, os oito testes do serviço passaram; a suíte completa passou em **78/78**, e o navegador em **7/7**. Auth/PostgreSQL reais, papel autenticado comum e duas identidades sintéticas; sem acesso administrativo aos dados do leitor.

A restauração cobre também o formato inicial da 0.3, em que uma evidência existia somente dentro da revisão editorial. Após restaurar na segunda conta e retirar a obra de apoio, a variante recebe `needs_review`. A repetição de um recibo 0.2 não altera a revisão atual.

A [captura nativa de 320 px antes do preparo](../assets/reader-v3-unprepared.png) foi inspecionada visualmente. As jornadas também repetiram as três abas preparadas, teclado, larguras 320/480/1440, escuro, zoom 200%, cópia offline e isolamento. Nenhum arquivo foi obtido por download na interface.

Hashes dos logs e revisões constam na [evidência local](leitura-0.3-local.json). Esses resultados são locais; a prova hospedada e a homologação no ChatGPT dependem das etapas registradas em [STATUS](../../STATUS.md). A revisão não constitui avaliação acadêmica humana nem estudo de eficácia pedagógica.
