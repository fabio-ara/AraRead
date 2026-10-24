# Evolução 0.2 e critérios F01–F10 — histórico

A experiência corrente está descrita em [Leitura 0.3](leitura-0.3.md): chat conduz o estudo, painel tem três abas e fontes passam por pré-verificação. As provas de versões anteriores abaixo são históricas; o [STATUS](../STATUS.md) identifica a revisão efetivamente verificada.

A versão 0.2.0 conserva o domínio anterior e acrescenta estudo rastreável. A fonte determina a ordem; o assistente conectado faz a mediação intelectual. O aplicativo não chama um modelo nem promete que referências válidas ou cobertura de caracteres comprovem fidelidade. O [estado verificável](../STATUS.md) separa revisão local, CI, serviço hospedado e cliente externo.

## Rastreabilidade histórica 0.2

| Incremento | Implementação e contrato | Prova reproduzível e documentação |
|---|---|---|
| F01 — representações e alinhamento | `reading_context`, `mediation_save`; `anchors.ts`, `study/context.ts`, `web/main.ts` | `evolution.test.ts`, `genres.test.ts`, `e2e/evolution.spec.ts`: idiomas/representações distintas e mesmo intervalo, sem avanço. [Uso](guia-uso.md). Por determinação posterior do titular, alternância/blocos emparelhados em coluna de até 480 px também no desktop |
| F02 — apoio e repertório | `selection`, `preferences_set`, `context_prepare`; painel e orientação 1.1.0 | Evolução + E2E: apoio temporário reversível, variantes anteriores, perguntas/pré-requisitos voltam ao trecho. Repertório/objetivo opcionais; nenhum perfil sensível inferido |
| F03 — perspectivas | `perspective_save`, `reference_save`, contextos/variantes; painel de comparação | Evolução: duas perspectivas, livro sem URL, escopo/versionamento, origem e lacunas; [contrato](contrato-mcp.md). Comparar exige versões salvas; ausência de material não é preenchida por invenção |
| F04 — memória selecionável | `note_save`, `note_manage`; `study/memory.ts` | Evolução: hipótese pessoal não vira fato, seleção/desativação, exclusão transitiva de contexto/variantes/derivações conhecidas e recibo sem reconstrução privada. [Segurança](seguranca.md) |
| F05 — variantes recuperáveis | Assinatura canônica, IDs/hashes/versões, `variant_id`, histórico e estado de revisão | Evolução: mesma referência, dois idiomas/perspectivas, nova sessão, acesso histórico e desatualização sem regeneração. Assinatura identifica entradas, não repete a saída do modelo |
| F06 — evidência e correção | `reference_save`, `correction_save`, `mediation_save.supersedes`, `study/evidence.ts` | Evolução + `editorial-faults.test.ts`: três erros deliberados, dependentes sinalizados, versão corretiva e original intacto. Retirada de fonte deixa lacuna; hash/consulta declarada não certificam apoio intelectual |
| F07 — relações entre obras | `connection_save`, `study_catalog`, ponto de retorno e natureza/evidência/limites | Evolução: analogia sem alegar influência, relações formais/influência exigem material, outra conta bloqueada e progresso intacto |
| F08 — cadernos privados | `notebook_export/import`, perspectivas e comentários tipados; `study/notebooks.ts` | Evolução + E2E: seleção/prévia, sem original/progresso/outras notas, atribuição, edição divergente pendente, vínculo explícito e adaptação rastreável. Importação não publica nem ativa influência |
| F09 — continuidade de envios | `source_append`, `reading_segments`; `study/continuity.ts` | Evolução: múltiplos envios, referências/cobertura antigas, envio novo não lido, concorrência e recibo. `install.test.ts` preserva leitura anterior à migration. [Arquitetura](arquitetura.md) |
| F10 — offline e recuperação | `web/offline.ts`, cache privado e fila; `operation_get`, revisão/recibo | E2E: preparo explícito, nota offline após recarga, sincronização única, conflito real entre sessões, progresso sem fusão automática e recuperação antes de sair. [Operação](operacao.md) |

As ferramentas compartilham implementação com a UI, esquemas de entrada estritos e saída validada. Os testes usam Auth real e papel autenticado comum, não um bypass administrativo de RLS. Provisionar identidade sintética com API administrativa é separado de executar operações como leitor.

## Fidelidade intelectual e gêneros

As nove amostras sintéticas cobrem prosa filosófica, prova matemática, física, ciência, teologia, botânica, verso grego, aforismos e teses numeradas. As três últimas demonstram conservação da forma/referência, sem atribuir o texto inventado a Nietzsche, Wittgenstein ou um autor grego. Nenhum verso é apresentado como tradução histórica ou prova de métrica correta. Scripts, símbolos, escrita bidirecional e diacríticos permanecem ligados aos intervalos Unicode.

O teste editorial introduz negação invertida, modalidade transformada em certeza e atribuição indevida. O fluxo registra o problema e uma nova variante; não há classificador automático capaz de garantir que detectará esses erros em qualquer obra. Um comentador que discute outro autor dentro de sua própria obra pode ser cadastrado como fonte com edição, localizador e trecho pertinente, sem exigir que o livro inteiro seja dedicado ao autor comentado.

Uma consulta lexical geral não estabelece o uso de um termo por determinada escola ou época. A resposta precisa distinguir sentido contextual, equivalentes/alternativas, construção da frase, etimologia documentada e auxílio de memória. O material guardado é reutilizado antes da consulta externa. Links SEP/IEP são sugestões de pesquisa quando não houve obtenção/consulta, nunca referências supostamente lidas.

## Economia e capacidade

O serviço persiste fontes, extração, definições, notas, bibliografia, escolhas, referências e mediações produzidas; não recalcula esses registros com IA. Não gera variantes antecipadamente, embeddings ou explicações em lote. Contextos armazenam chaves/hashes em vez de cópias de todo material; recibos de preparação também são compactos. A consulta entrega uma variante e metadados limitados das alternativas. Apoios adicionais têm orçamento de 64 KiB, com omissões declaradas e original íntegro.

`bytea` e texto grandes usam TOAST/LZ4 onde configurado, preservando transação e recuperação junto ao manifesto. O original e sua extração ocupam espaço distinto. A cota de 16 MiB por conta no Edge é lógica e conservadora, não uma reserva física garantida. Índices, WAL, recibos, eventos, linhas e infraestrutura também ocupam recursos. Compressão depende do conteúdo; uma biblioteca de milhares de obras por pessoa e muitos usuários não cabe indefinidamente em um único projeto Free. O aplicativo não afirma essa capacidade nem ativa upgrades automaticamente.

O teste de 10 mil elementos mede importação, consulta paginada e payload; o de contexto mede limite/omissão e recibo compacto. Medições são amostras locais, não garantia de latência hospedada ou estimativa universal de tokens. O operador deve conferir uso físico no provedor e limitar adesão/capacidade. Migrar originais para Storage exigiria adapter, consistência e recuperação próprios; não foi acrescentado sem necessidade medida nesta biblioteca pessoal. Consulte [preços/limites atuais](https://supabase.com/pricing) antes de ampliar uma instalação.

## Roteiro de revisão humana

Esta rodada não realizou estudo com participantes nem revisão acadêmica independente. A avaliação sintética por IA e as asserções de código não substituem esses processos. Para revisão voluntária posterior, sem exames obrigatórios:

1. **Leitor:** escolha uma passagem autorizada e um objetivo, leia o original e a reescrita, peça termo/pré-requisito e confira o retorno ao trecho. Aponte onde uma explicação ajuda ou altera uma ressalva; registre a dúvida sem marcar compreensão por clique.
2. **Comentador:** declare escopo, edição e passagem efetivamente consultada. Compare duas interpretações breves e autossuficientes; identifique concordância, divergência e limite. Exporte só comentários escolhidos e confira autoria/condições antes de compartilhar.
3. **Operador:** restaure backup em identidade sintética, confira originais/hashes/referências, simule falta de rede e conflito entre duas sessões e examine isolamento. Não use dados de leitores reais em evidência pública.

Inclua voluntariamente leitores com repertórios, idades e objetivos diferentes, sem deduzir capacidades ou coletar esses atributos para permitir o uso. Registre observações autorizadas de clareza/fidelidade e limitações; não converta uma amostra em promessa de compreensão universal.

## Limites das provas

O harness MCP Apps executa chamadas reais ao domínio por uma ponte de host simulada; comprova o contrato do painel, não sua renderização em todo provider. O SDK oficial comprova transporte/autorização. Uma prova no ChatGPT comprova aquele cliente e revisão, separadamente. A interface exige interação e captura nativa; medidas de largura/DOM não substituem inspeção visual. O alvo é WCAG 2.2 AA, sem alegação de certificação ou auditoria assistiva completa.

O GitHub Pages publica o frontend estático e não a biblioteca. Código MIT, serviço próprio, conta de leitor e integração MCP são entregas distintas. Não há inscrição pública, diretório público de plugin, cobrança, rede social ou sincronização coletiva nesta versão.
