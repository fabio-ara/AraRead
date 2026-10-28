# Contrato MCP e API

O endpoint `/mcp` usa Streamable HTTP pelo SDK oficial. A implementação foi exercitada com protocolo `2026-07-28` e compatibilidade do SDK com o fluxo legado `2025-11-25`. A aplicação não trata um handshake antigo como regra universal. Os contratos executáveis estão em [contracts.ts](../src/contracts.ts) e [outputs.ts](../src/outputs.ts); o SDK publica seus JSON Schemas. A API web `/api/:ferramenta` chama os mesmos casos de uso, com sessão web em vez de token OAuth do recurso MCP.

## Edições de estudo

As ferramentas novas agrupam operações por etapa. Todas usam os mesmos casos de uso na web e no MCP; cada escrita exige identidade, sessão, permissão, revisão esperada e recibo idempotente.

| Ferramenta | Operação |
|---|---|
| `edition_configuration` | Configuração privada efetiva, origens, revisões e perfis próprios |
| `edition_catalog` | Edições acessíveis por obra, conceito ou tradição; consulta autenticada também retorna projetos próprios e retomada recente |
| `edition_context` | Projeto e tarefas limitadas para autoria, ou passagem de uma versão exata; não anuncia painel |
| `edition_project` | Criar, atualizar identificação/direitos ou derivar projeto próprio |
| `edition_source` | Incorporar fonte própria pré-verificada, sem tornar pública a biblioteca pessoal |
| `edition_plan` | Guardar/restaurar escolhas explícitas no escopo e revisão indicados |
| `edition_sample` | Preparar amostra, pedir mudanças ou registrar aprovação pela pessoa autora na interface |
| `edition_batch` | Receber até cinco passagens completas por lote, após amostra aprovada |
| `edition_review` | Registrar parecer sobre IDs exatos de versões das passagens |
| `edition_publish` | Publicar versão privada, por convite ou pública; retirar versão própria |
| `edition_reader` | Consultar estado pessoal sem alterá-lo |
| `edition_annotate` | Abrir, confirmar/continuar, retomar, anotar, destacar, responder, pedir apoio, marcar para revisar ou excluir registro próprio |
| `edition_groups` / `edition_group` | Consultar grupos; criar, convidar, aderir, sair, revogar participação e gerir comentários próprios |

`reading_display` continua sendo o único anúncio de MCP Apps. Aceita `reading_id` do domínio anterior, ou `version_id`/`project_id` editorial com `passage_id` opcional. O projeto apresenta uma amostra sem gravação pessoal; a versão permite ações conforme identidade/capacidade do host. O fallback textual contém as três representações. A UI usa os mesmos segmentos e apoios guardados do site.

Projeto, configuração e leitor possuem revisões distintas. Adesão por convite usa revisão zero para a participação nova e retorna a revisão atual do grupo; operações posteriores conferem essa revisão. Uma exclusão de anotação criada offline pode indicar `annotation_operation_id`: o serviço resolve somente o recibo confirmado da mesma conta e versão, sem aproximação textual.

A API pública aceita apenas `POST /api/public/edition_catalog` e `edition_context` com `version_id`. Rascunhos, configurações privadas, notas, preferências e grupos não fazem parte desse acesso. Nenhuma consulta pública escreve progresso. Conteúdo de uma versão substituída continua identificável; retirada impede acesso público e novas anotações.

Para recuperação completa use `data_export` com `format: "araread/4"`, mesma `snapshot` e `include_original:true` em todas as páginas. O padrão v3 mantém clientes antigos. O v4 inclui domínio anterior, edições e estado pessoal; `data_restore` continua aceitando v1/v2/v3. Consulte [recuperação](operacao.md).

## Biblioteca pessoal anterior

| Ferramenta | Efeito e contrato principal |
|---|---|
| `account_context` | Lê conta autenticada, preferências, cota e capacidades |
| `library_list` | Busca título/autoria e pagina leituras próprias |
| `source_preview` | Pré-verificação sem persistência: estrutura, qualidade, lacunas, avisos e necessidade de bytes |
| `source_import` | Cria fonte textual canônica após validação; retenção excepcional e deduplicação privada; `work_id`/`derives_from` vinculam correção versionada |
| `reading_context` | Consulta porção, idioma, revisão, fonte, explicação e contexto limitado; não altera posição |
| `reading_display` | Apresenta explicação/tradução conferidas da mesma referência; único recurso MCP Apps |
| `reading_repair_preview` | Prévia de abertura do elemento inteiro, sem escrita, com revisão e token do estado |
| `reading_repair` | Aplica prévia vigente, alterando somente aberto/revisão; conserva retomada, cobertura e versões |
| `highlight_list` | Grifos por elemento e representação, versões substituídas/órfãs e paginação |
| `highlight_save` | Grava seleção por versão/segmento/pontos de código com citação e contexto conferidos |
| `highlight_remove` | Remove só o grifo escolhido, preservando notas e variantes |
| `contextual_calculate` | Cálculo científico ou datas civis determinísticos, sem persistir nem avançar |
| `reading_progress` | Cobertura de unidades válidas, parágrafos restantes, aberto/retomada e limites de fonte parcial |
| `reading_outline` | Hierarquia original e mapa interpretativo salvo, com referências reais |
| `reading_seek` | Abre referência ou busca inequívoca, preservando retomada principal e cobertura |
| `reading_map_save` | Guarda versão de mapa gerado, distinguindo títulos organizacionais dos originais |
| `source_elements` | Índice paginado com referências válidas |
| `reading_history` | Histórico paginado de mediações, notas, termos ou eventos |
| `mediation_save` | Acrescenta reescrita e comentários com proveniência; `regenerate:true` mantém histórico |
| `term_save` | Guarda termo/sentido/definição por idioma e referência, sem avançar |
| `note_save` | Guarda nota, pergunta, resposta ou marca com origem; resposta exige `reply_to` da pergunta |
| `reading_move` | `open`, `resume`, `continue` ou `mark_read`, com efeitos distintos sobre aberto/retomada/cobertura |
| `preferences_catalog` | Catálogo versionado de parâmetros, padrões, escopos e privacidade |
| `preferences_get` | Valores efetivos, origem, escopo, duração e definições; operação temporária opcional |
| `preferences_set` | Altera conta, leitura ou sessão com revisão; campos interpretativos exigem solicitação explícita |
| `preferences_unset` | Retira, exclui, desativa, reativa ou aplica padrão explicitamente |
| `profile_save` / `profile_get` | Cria versão ou consulta perfis privados reutilizáveis, lentes, conflitos e fontes |
| `profile_manage` | Desativa, reativa ou exclui perfil próprio sem apagar notas/progresso |
| `profile_export` / `profile_import` | Pacote selecionado opt-in e cópia privada inicialmente inativa |
| `operation_get` | Recupera recibo próprio ou resultado `unknown` |
| `data_export` | Seção privada paginada; bytes originais só com `include_original:true` |
| `data_restore` | Restaura bundle íntegro em novos IDs, sem sobrescrever leituras existentes |
| `work_delete` | Exclusão destrutiva própria, exigindo `confirm_title` exato |
| `assistant_guidance` | Carrega orientação operacional versionada |
| `source_append` | Acrescenta segmento imutável à mesma leitura parcial, sem avançar |
| `reference_save` | Bibliografia e trecho, inclusive livro sem URL; consulta exige material/localizador |
| `perspective_save` | Versão imutável de comentador/tradição/abordagem/caderno e escopo |
| `context_prepare` | Escrita com revisão/recibo: registra contexto disponibilizado limitado, sem avançar |
| `note_manage` | Ativa/desativa, vincula pendente ou exclui memória e derivações registradas |
| `connection_save` | Relação entre duas passagens próprias, com problema, natureza, evidência e limites |
| `study_catalog` | Catálogo privado paginado de fontes, perspectivas, contextos, notas ou relações |
| `notebook_export` | Pacote seletivo com prévia, sem originais/progresso/credenciais |
| `notebook_import` | Cópia privada inativa; alinhamento exato ou vínculo pendente |
| `correction_save` | Sinaliza erro e dependentes; correção efetiva é nova variante com `supersedes` |
| `lexicon_lookup` | Vocabulário salvo primeiro; consulta externa opcional atribuída |

Leituras têm `readOnlyHint:true`; escritas têm `false`; exclusão de obra e gestão de notas declaram potencial destrutivo. Repetição de escrita é idempotente com identidade de operação. Importação e consulta de léxico declaram mundo aberto pois podem obter material público. Anotações são dicas ao cliente, sem substituir autenticação e permissões reais. Não há SQL arbitrário, terminal ou execução de conteúdo.

## Referência, revisão e idioma

Toda escrita recebe `operation_id` UUID. Escritas numa leitura recebem também `reading_id` e `expected_revision`. Use os IDs e intervalos devolvidos pelo servidor; offsets contam pontos de código Unicode em `[start,end)`. Resultados identificam fonte/leitura, revisão, referência e idioma quando aplicável. Consulta de contexto pode escolher idioma/tamanho temporários, sem gravar preferências.

Um resultado de ferramenta tem `{ok:true,data:...}`; falhas têm `{ok:false,error:{code,message,details?}}` e `isError:true`. O conteúdo textual acompanha `structuredContent`. HTTP de identidade pode falhar antes da chamada MCP com 401/403 e desafio `WWW-Authenticate`. Escrita confirmada inclui `{operation_id,status:"confirmed",...}`. O recibo não prova que a resposta foi mostrada ao usuário no chat.

`continue` exige uma porção emitida da posição aberta ou da retomada, marca somente esse intervalo e avança. Fora do percurso principal, preserva a retomada; no percurso principal, avança ambos. `open` muda somente aberto; `resume` abre a retomada; `mark_read` marca o intervalo explicitamente indicado sem deslocar a retomada. Nenhum deles infere compreensão.

## Exemplo de persistência básica

O [teste OAuth/MCP](../tests/oauth.test.ts) importa a frase sintética “Amostra sintética OAuth: o possível permanece possível.”, recebe a referência e executa:

```typescript
await mcp.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});
await mcp.callTool({name:'mediation_save',arguments:{
  operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref,
  rewrite:'O texto apresenta uma possibilidade (algo que pode ocorrer), sem afirmar certeza.',
  provenance:{agent:'Cliente sintético MCP',guidance_version:'1.2.0'}
}});
```

`source`, `ref` e `mcp` são objetos obtidos e autenticados no próprio teste, não identificadores para copiar de outra instalação. Esse exemplo arquiva uma mediação; para apresentá-la como pronta, prepare contexto e forneça `editorial_review` como nos testes da 0.3. A segunda conexão lê a mesma mediação, sem cobertura automática. Execute `npm test` com servidor/banco locais ativos para reproduzir.

## Limites e erros

Paginação usa `offset`, `limit` de 1 a 50 e `next_offset:null` no fim. Fontes com bytes na exportação limitam a página a uma fonte. Contexto inclui no máximo 25 termos, 25 notas da passagem e 15 perguntas abertas; use histórico para percorrer o restante. Originais: 8 MiB; texto colado no contrato: 2 milhões de unidades de string; até 20 mil elementos de 100 mil caracteres; reescrita: 20 mil caracteres; até 20 acréscimos; anotação: 10 mil; biblioteca: cota lógica de 80 MiB local ou 16 MiB no Edge. MCP e operações HTTP comuns limitam JSON a 16 MiB. A rota web/CLI autenticada `POST /api/data_restore` aceita até 128 MiB local ou 32 MiB no Edge para o backup com originais; verifica sessão antes de ler o corpo maior e aplica a cota ao conteúdo restaurado. Para recuperar backups acima de 16 MiB, use essa rota; não há restauração multipart.

Erros principais: `VALIDATION`, `INVALID_REF`, `NOT_FOUND`, `CONFLICT`, `POSITION_CHANGED`, `PREPARATION_REQUIRED`, `EXTRACTION_REJECTED`, `EXPLICIT_PREFERENCE_REQUIRED`, `EXISTS`, `IDEMPOTENCY_MISMATCH`, `UNAUTHENTICATED`, `SESSION_REVOKED`, `FORBIDDEN`, `QUOTA`, `TOO_LARGE`, `UNSAFE_URL`, `ROBOTS_DENIED`, `SOURCE_UNAVAILABLE`, `INVALID_BACKUP`, `EXPORT_CHANGED`, `INVALID_CONTEXT`, `MISSING_EVIDENCE`. `INTERNAL` pede consultar recibo antes de repetir. Mensagens não retornam SQL ou credenciais. `operation_get` não recebe IDs de outra conta nem distingue existência alheia.

## Seleção, contexto, histórico e painel

Os contratos adicionais ficam em [study/contracts.ts](../src/study/contracts.ts); navegação e perfis ficam em `study/navigation.ts` e `study/preference-contracts.ts`. `selection` separa representação, apoio, perspectiva, inclusão/IDs de notas e repertório/objetivo opcionais. `context_prepare` retorna `context_id`, assinatura, material disponibilizado e lacunas; incrementa revisão e gera recibo sem mudar posição. `mediation_save` pode referenciar esse contexto, alinhamento real, referências usadas, dependências e versão substituída. Campos provider/model só são enviados quando conhecidos. A assinatura não garante determinismo do modelo.

`reading_context` pode selecionar `variant_id` histórica na mesma porção/idioma; retorna um corpo e metadados limitados das demais variantes, com sinalização de desatualização. `data_export` v3 exige o mesmo `snapshot` nas dezoito seções; conflito invalida o conjunto. `data_restore` aceita v1/v2/v3 com IDs novos. `operation_get` pode retornar recibo de contexto com `privacy_redacted:true` após exclusão, sem recriar dados removidos.

Somente `reading_display` anuncia `ui://araread/reader-v3.html`, MIME `text/html;profile=mcp-app`. Exige representações persistidas da mesma referência, com contexto atual e `editorial.ready_to_present`. A tradução dispensa geração quando o original já está no idioma de leitura. `fallback_text` entrega as mesmas representações a clientes sem painel.

O painel usa `ui/initialize` e `ui/notifications/tool-result` por JSON-RPC ao host; suas três abas são controles locais de apresentação. Não usa `tools/call` nem `ui/message` para conduzir estudo. Resultados intermediários sem `ready:true` não abrem o leitor. O harness testa ponte, teclado, estados e ausência de escritas; prova em host externo é separada. Veja a [especificação MCP Apps](https://apps.extensions.modelcontextprotocol.io/api/documents/Overview.html).

`editorial_review` em `mediation_save` registra confronto, negação/modalidade/condições/terminologia/atribuição/contexto/cobertura, afirmações, fontes e limites. Sem confronto, a variante pode ser arquivada mas não apresentada como pronta. Uma correção exige nova variante, mantendo a anterior. A [orientação 1.2.0](../src/guidance.ts) fornece o fluxo completo.

Preferências seguem operação > sessão Auth > leitura > perfil > conta > padrão. `profile_save`/`profile_import` exigem `explicit_request:true`; `profile_export` exige lentes selecionadas e `reviewed_for_sharing:true`. Perfil importado fica inativo e não selecionado. Consulte [Leitura 0.3](leitura-0.3.md) para os efeitos de cada escopo e ação. Declarações de consulta/autoria não são certificadas pelo backend.
