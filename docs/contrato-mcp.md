# Contrato MCP e API

O endpoint `/mcp` usa Streamable HTTP pelo SDK oficial. A implementação foi exercitada com protocolo `2026-07-28` e compatibilidade do SDK com o fluxo legado `2025-11-25`. A aplicação não trata um handshake antigo como regra universal. Os contratos executáveis estão em [contracts.ts](../src/contracts.ts) e [outputs.ts](../src/outputs.ts); o SDK publica seus JSON Schemas. A API web `/api/:ferramenta` chama os mesmos casos de uso, com sessão web em vez de token OAuth do recurso MCP.

| Ferramenta | Efeito e contrato principal |
|---|---|
| `account_context` | Lê conta autenticada, preferências, cota e capacidades |
| `library_list` | Busca título/autoria e pagina leituras próprias |
| `source_import` | Preserva original, cria fonte/leitura; `work_id`/`derives_from` vinculam uma versão adicional |
| `reading_context` | Consulta porção, idioma, revisão, fonte, explicação e contexto limitado; não altera posição |
| `source_elements` | Índice paginado com referências válidas |
| `reading_history` | Histórico paginado de mediações, notas, termos ou eventos |
| `mediation_save` | Acrescenta reescrita e comentários com proveniência; `regenerate:true` mantém histórico |
| `term_save` | Guarda termo/sentido/definição por idioma e referência, sem avançar |
| `note_save` | Guarda nota, pergunta, resposta ou marca com origem; resposta exige `reply_to` da pergunta |
| `reading_move` | `open`, `resume`, `continue` ou `mark_read`, com efeitos distintos sobre aberto/retomada/cobertura |
| `preferences_set` | Altera conta ou leitura com revisão; idioma nulo na leitura remove substituição |
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

`continue` exige uma porção emitida a partir da retomada, marca somente esse intervalo e abre o próximo. `open` muda somente aberto; `resume` abre a retomada; `mark_read` marca o intervalo explicitamente indicado e não desloca a retomada. Nenhum deles infere compreensão.

## Exemplo real do teste

O [teste OAuth/MCP](../tests/oauth.test.ts) importa a frase sintética “Amostra sintética OAuth: o possível permanece possível.”, recebe a referência e executa:

```typescript
await mcp.callTool({name:'reading_context',arguments:{reading_id:source.reading_id}});
await mcp.callTool({name:'mediation_save',arguments:{
  operation_id:randomUUID(),reading_id:source.reading_id,expected_revision:0,ref,
  rewrite:'O texto apresenta uma possibilidade (algo que pode ocorrer), sem afirmar certeza.',
  provenance:{agent:'Cliente sintético MCP',guidance_version:'1.1.0'}
}});
```

`source`, `ref` e `mcp` são objetos obtidos e autenticados no próprio teste, não identificadores para copiar de outra instalação. A segunda conexão lê a mesma mediação, sem cobertura automática. Execute `npm test` com servidor/banco locais ativos para reproduzir.

## Limites e erros

Paginação usa `offset`, `limit` de 1 a 50 e `next_offset:null` no fim. Fontes com bytes na exportação limitam a página a uma fonte. Contexto inclui no máximo 25 termos, 25 notas da passagem e 15 perguntas abertas; use histórico para percorrer o restante. Originais: 8 MiB; texto colado no contrato: 2 milhões de unidades de string; até 20 mil elementos de 100 mil caracteres; reescrita: 20 mil caracteres; até 20 acréscimos; anotação: 10 mil; biblioteca: cota lógica de 80 MiB local ou 16 MiB no Edge. MCP e operações HTTP comuns limitam JSON a 16 MiB. A rota web/CLI autenticada `POST /api/data_restore` aceita até 128 MiB local ou 32 MiB no Edge para o backup com originais; verifica sessão antes de ler o corpo maior e aplica a cota ao conteúdo restaurado. Para recuperar backups acima de 16 MiB, use essa rota; não há restauração multipart.

Erros principais: `VALIDATION`, `INVALID_REF`, `NOT_FOUND`, `CONFLICT`, `NOT_AT_RESUME`, `EXISTS`, `IDEMPOTENCY_MISMATCH`, `UNAUTHENTICATED`, `SESSION_REVOKED`, `FORBIDDEN`, `QUOTA`, `TOO_LARGE`, `UNSAFE_URL`, `ROBOTS_DENIED`, `SOURCE_UNAVAILABLE`, `INVALID_BACKUP`, `EXPORT_CHANGED`, `INVALID_CONTEXT`, `MISSING_EVIDENCE`. `INTERNAL` pede consultar recibo antes de repetir. Mensagens não retornam SQL ou credenciais. `operation_get` não recebe IDs de outra conta nem distingue existência alheia.

## Seleção, contexto, histórico e painel

Os contratos adicionais ficam em [study/contracts.ts](../src/study/contracts.ts); há 27 ferramentas. `selection` separa representação, apoio, perspectiva, inclusão/IDs de notas e repertório/objetivo opcionais. `context_prepare` retorna `context_id`, assinatura, material disponibilizado e lacunas; incrementa revisão e gera recibo sem mudar posição. `mediation_save` pode referenciar esse contexto, alinhamento real, referências usadas, dependências e versão substituída. Campos provider/model só são enviados quando conhecidos. A assinatura não garante determinismo do modelo.

`reading_context` pode selecionar `variant_id` histórica na mesma porção/idioma; retorna um corpo e metadados limitados das demais variantes, com sinalização de desatualização. `data_export` v2 exige o mesmo `snapshot` nas quinze seções; conflito invalida o conjunto. `data_restore` aceita v1/v2 com IDs novos. `operation_get` pode retornar recibo de contexto com `privacy_redacted:true` após exclusão, sem recriar dados removidos.

`reading_context` anuncia opcionalmente o recurso `ui://araread/reader-v2.html`, MIME `text/html;profile=mcp-app`. O painel usa MCP Apps `ui/initialize`, `ui/notifications/tool-result`, `tools/call` e `ui/message` por JSON-RPC ao host. Botões pedem explicação/pergunta sem avanço; continuidade usa revisão, chave e recibo. Não exige `window.openai`; clientes sem suporte continuam usando ferramentas textuais. O harness local testa a ponte; a prova em host externo é registrada separadamente. Consulte a [especificação MCP Apps](https://apps.extensions.modelcontextprotocol.io/api/documents/Overview.html).
