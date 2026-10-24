# Leitura assistida 0.3

O leitor escolhe a obra e conduz o estudo pelo chat. O painel apresenta uma passagem em três abas: **Leitura facilitada**, **Tradução** e **Original**. Mudar de aba não marca leitura nem gera conteúdo. A aplicação guarda textos, versões, notas e escolhas; a geração intelectual permanece no assistente conectado, sem chave de modelo no servidor.

## Uma primeira explicação suficiente

A leitura facilitada deve introduzir o problema antes dos termos difíceis. Conforme a passagem exigir, o assistente explica contexto, pressupostos, etapas do argumento, conceitos e exemplos, com limites e controvérsias. Isso é orientação pedagógica desde a primeira preparação, não uma promessa de compreensão automática. A tradução preserva modalidade, terminologia e ambiguidades; não recebe as lentes do perfil.

Internamente, `rewrite` e `additions` separam reescrita, contexto, interpretação, exemplo e nota crítica. `editorial_review` registra o confronto com o original, sete dimensões de fidelidade, afirmações, evidências e limites. As heurísticas encontram alguns casos de perda de negação, modalidade, distinção conceitual e atribuição; textos em idiomas distintos exigem confronto declarado, sem falsa equivalência lexical. Um registro sem confronto ou com risco pendente não pode ser apresentado como preparação pronta.

O fluxo é `source_preview` → `source_import` → `reading_context` → `context_prepare` → `mediation_save`, preparando separadamente explicação e tradução quando necessária, e finalmente `reading_display`. Somente a última ferramenta anuncia o painel. Sem MCP Apps, seu `fallback_text` permite apresentar as mesmas três representações no chat. O assistente não deve repetir a passagem inteira depois de apresentar o painel.

## Ingestão e integridade

HTML passa por remoção de controles, seleção semântica, normalização de prosa, reconstrução e pré-verificação. Um corpo longo não pode excluir automaticamente título, preâmbulo, notas ou bibliografia. `citation_author` e informações editoriais são conservados como metadados. Tabelas e fórmulas conservam estrutura disponível; imagens não são interpretadas.

PDF.js usa posições para separar colunas, remontar linhas, reconhecer títulos/notas e retirar margens repetidas. Essa reconstrução é heurística. Páginas sem texto continuam lacunas; imagens, rotação e estruturas visuais exigem retenção do arquivo. A pré-verificação devolve estrutura, caracteres úteis, lacunas, avisos e estado `ready`, `partial` ou `rejected`. `ready` significa extração textual utilizável, não certificação intelectual.

O OCR local usa Poppler/Tesseract, até 8 MiB/30 páginas, subprocessos com prazo, imagem limitada e container sem rede. Seu suplemento identifica hash dos bytes, ferramenta, versão, idioma, data, confiança e regiões. Só completa páginas sem camada textual; baixa confiança continua lacuna. O resultado permanece parcial e exige conferência, especialmente para matemática e tabelas. O Edge recebe o preparo; não executa OCR nem simula que o executou.

A representação canônica contém blocos, localizadores, ordem, hash e proveniência. Novas extrações textuais validadas não precisam guardar bytes brutos. `retain_original:true`, lacunas e conteúdo visual essencial conservam os bytes. Fontes antigas mantêm seus binários. `original_available` informa a situação; a API de original devolve `410 ORIGINAL_NOT_RETAINED` quando não há bytes. O texto canônico nunca é substituído por resumo.

Deduplicação ocorre sob bloqueio de escrita da própria conta, por hash canônico, edição, idioma, título/autoria, situação parcial e relações de versão. Retenção solicitada não reutiliza uma versão que já não tenha bytes. A existência de conteúdo alheio não altera a resposta. Correções usam nova fonte com `work_id`/`derives_from`; nenhuma referência antiga é remapeada silenciosamente.

## Preferências e perfis

O catálogo v1 expõe idioma, tamanho da porção, extensão do apoio, inclusão de notas, repertório, objetivo, perfil ativo e perspectiva. O valor efetivo acompanha origem, escopo, estado, proveniência e duração.

| Prioridade | Escopo | Duração |
|---|---|---|
| 1 | Operação explícita | Só a chamada atual |
| 2 | Sessão Auth ativa | Só essa sessão; não é exportada |
| 3 | Leitura | Persistente nessa leitura |
| 4 | Perfil selecionado | Valores da versão selecionada |
| 5 | Conta | Persistente |
| 6 | Padrão | Configuração do AraRead |

`preferences_set` exige `explicit_request:true` para repertório, objetivo, perfil e perspectiva. Perguntas sobre uma tradição não são evidência de adesão pessoal. `preferences_unset` distingue retirar substituição (`unset`), apagar definição (`delete`), conservar sem influência (`disable`), reativar (`enable`) e aplicar o padrão mascarando valores inferiores (`reset`). Nenhuma dessas ações apaga notas ou progresso.

Perfis são versões privadas reutilizáveis entre obras. Cada lente informa natureza, escopo, período pertinente, fontes e limites; a combinação declara compatibilidade e conflitos. Naturezas distinguem posição do autor, comentário documentado, tradição, aplicação da IA e hipótese do leitor. Comentário documentado exige material declarado consultado, trecho e localizador; o sistema não certifica que a declaração é verdadeira. Fontes de terceiros continuam sujeitas a seus direitos.

`profile_export` seleciona lentes e, opcionalmente, valores, exige autoria, condições de uso e declaração de revisão. A prévia não publica nada. `profile_import` cria uma cópia privada inativa; habilitar e selecionar são atos distintos. Não há catálogo público de pessoas nem acesso cruzado a bibliotecas.

## Localização e progresso

`reading_outline` combina hierarquia original com a versão mais recente do mapa. `reading_map_save` registra títulos gerados como `organizational_interpretation`, sempre com referências reais. `reading_seek` abre uma referência ou busca inequívoca. Busca ambígua pede seleção pelo mapa, sem escolher arbitrariamente.

Abrir muda apenas a posição aberta. Continuar aceita a porção emitida da posição aberta ou da retomada: cobre só esse intervalo e avança a posição correspondente. Fora do percurso principal, a retomada permanece. Retomar abre o percurso principal. `reading_progress` mede intervalos reais de unidades válidas, exclui navegação/lacunas e esclarece material parcial. HTML não recebe páginas fictícias; PDF usa paginação efetivamente extraída. Cobertura não significa compreensão.

## Evolução e limites operacionais

As migrations `20261024171342_editorial_ingestion_v3.sql`, `20261024172646_preferences_profiles_v3.sql` e `20261024180204_preference_reference_ownership_v3.sql` acrescentam armazenamento canônico, revisão editorial, mapas, perfis e registros de preferência. Não alteram migrations anteriores nem removem bytes existentes. As 19 tabelas mantêm RLS forçado. UI/API/MCP usam os mesmos casos de uso, revisão, sessão verificada e recibos idempotentes.

Backup `araread/3` tem dezoito seções consistentes sob um `snapshot`, inclui fontes textuais, mapas e perfis e exclui preferências temporárias. Restauração aceita v1/v2/v3, verifica hashes e relações, remapeia IDs e não sobrescreve a biblioteca. Cotas continuam 16/32 MiB de conteúdo/restauração no Edge, 80/128 MiB no Node e 8 MiB por original. Cota lógica não equivale a disco PostgreSQL; medições físicas precisam incluir TOAST e índices.

As provas da 0.2 são históricas e não homologam esta versão. Consulte o [estado atual](../STATUS.md), [testes](testes.md), [contrato MCP](contrato-mcp.md) e [operação](operacao.md). A entrega depende dos gates, da revisão crítica e das provas hospedadas e em cliente externo que forem efetivamente executadas. Testes sintéticos editoriais não substituem revisão humana especializada nem estudo de eficácia pedagógica.
