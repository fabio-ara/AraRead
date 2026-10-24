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

Leituras têm `readOnlyHint:true`; escritas têm `false`; só exclusão declara destruição. Repetição de escrita é idempotente com identidade de operação. Importação declara mundo aberto pois pode obter uma URL pública. Anotações são dicas ao cliente, sem substituir autenticação e permissões reais. Não há SQL arbitrário, terminal ou execução de conteúdo.

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
  provenance:{agent:'Cliente sintético MCP',guidance_version:'1.0.0'}
}});
```

`source`, `ref` e `mcp` são objetos obtidos e autenticados no próprio teste, não identificadores para copiar de outra instalação. A segunda conexão lê a mesma mediação, sem cobertura automática. Execute `npm test` com servidor/banco locais ativos para reproduzir.

## Limites e erros

Paginação usa `offset`, `limit` de 1 a 50 e `next_offset:null` no fim. Fontes com bytes na exportação limitam a página a uma fonte. Contexto inclui no máximo 25 termos, 25 notas da passagem e 15 perguntas abertas; use histórico para percorrer o restante. Originais: 8 MiB; texto colado no contrato: 2 milhões de unidades de string; até 20 mil elementos de 100 mil caracteres; reescrita: 20 mil caracteres; até 20 acréscimos; anotação: 10 mil; biblioteca: cota de conteúdo de 80 MiB. MCP e operações HTTP comuns limitam JSON a 16 MiB. A rota web/CLI autenticada `POST /api/data_restore` aceita até 128 MiB para o backup com originais; verifica sessão antes de ler o corpo maior e aplica a cota ao conteúdo restaurado. Para recuperar backups acima de 16 MiB, use essa rota; não há restauração multipart.

Erros principais: `VALIDATION`, `INVALID_REF`, `NOT_FOUND`, `CONFLICT`, `NOT_AT_RESUME`, `EXISTS`, `IDEMPOTENCY_MISMATCH`, `UNAUTHENTICATED`, `SESSION_REVOKED`, `FORBIDDEN`, `QUOTA`, `TOO_LARGE`, `UNSAFE_URL`, `ROBOTS_DENIED`, `SOURCE_UNAVAILABLE`, `INVALID_BACKUP`. `INTERNAL` pede consultar recibo antes de repetir. Mensagens não retornam SQL ou credenciais. `operation_get` não recebe IDs de outra conta nem distingue existência alheia.
