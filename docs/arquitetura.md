# Arquitetura e estado canônico

O AraRead precisa conservar o que foi estudado mesmo quando o processo ou a conversa termina. PostgreSQL guarda o estado canônico. A interface conserva apenas cópias privadas limitadas e rascunhos. O modelo de IA atua no cliente externo e não é dependência do backend.

## Responsabilidades

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| Contratos e âncoras | `src/contracts.ts`, `outputs.ts`, `anchors.ts` | Validação, limites, idiomas, intervalos e porções |
| Ingestão | `src/importers.ts` | Preservar bytes e representar formatos sem execução |
| Casos de uso | `src/service.ts` | Única implementação de leitura, progresso, histórico, importação e recuperação |
| Persistência e identidade | `src/db.ts`, `auth.ts`, migrations | Transações, papel mínimo, RLS, JWT e revogação |
| Transporte | `src/server.ts`, `edge-http.ts`, `mcp.ts` | Adaptadores Node/Web padrão para a mesma API, identidade, domínio e Streamable HTTP |
| Orientação | `src/guidance.ts` | Instrução, recurso e prompt versionados |
| Interface | `src/web`, `public/sw.js` | Leitura responsiva, controles e cache privado |

Localmente, um processo Node serve frontend, API e MCP, com PostgreSQL e GoTrue em containers exclusivos. Na instalação hospedada, a função Supabase `araread` serve API/MCP e o Site privado serve somente a interface estática. `VITE_API_BASE` define esse destino no build; CORS permite somente a origem configurada. Os dois adaptadores chamam os mesmos casos de uso e a mesma autorização. Supabase Auth fornece identidade e OAuth; não existe servidor OAuth artesanal. Originais ficam em `bytea`, com o restante da importação na mesma transação; não há bucket público.

O empacotador `scripts/prepare-edge.ts` copia do lockfile somente os dois módulos PDF.js necessários à extração textual, com licença e worker embutido. Assim não distribui todos os recursos opcionais do pacote no Edge. HTTPS usa Undici com socket TLS ligado ao IP público previamente validado, mantendo SNI e verificação do certificado para o hostname original. Não faz uma segunda resolução DNS nem aceita certificado inválido. O Edge usa pooler transacional, uma conexão por instância, descarte ocioso em 1 s e CA explícita; nenhum cliente de aplicação recebe chave administrativa. Consultas não têm nomes de prepared statements e todo contexto de identidade é local à transação.

O perfil Edge limita conteúdo da conta a 16 MiB e restauração HTTP a 32 MiB para respeitar a memória do runtime; Node local mantém 80/128 MiB. O limite por original continua 8 MiB. Essas cotas são expostas por `account_context`; não são medidas de cobertura intelectual. Os limites de CPU do provedor podem interromper um PDF complexo: o cliente deve conferir o recibo e manter o arquivo original, sem alegar importação concluída.

## Dados e relações

`works` conserva título/autoria; `sources` conserva uma versão imutável e relação opcional com a anterior; `elements` conserva o texto ordenado e os metadados extensíveis. Cada `reading` pertence a uma fonte e mantém aberto, retomada, intervalos percorridos, fim disponível, idioma, tamanho e revisão. `mediations` guarda reescrita, acréscimos e proveniência por intervalo e idioma, sempre acrescentando histórico. `terms` guarda sentido contextual; `notes` guarda anotações, perguntas, respostas vinculadas e marcas voluntárias, com origem explícita. `events` registra comandos de posição, sem alegar entrega no chat. `preferences` guarda padrão da conta e revisão. `receipts` guarda identidade da operação, hash da intenção normalizada e resultado confirmado.

As dez tabelas têm RLS forçado. Relações compostas incluem proprietário e fonte/leitura pertinente, impedindo ligar uma nota própria a conteúdo de outra conta. `araread` e `araread_private` não devem ser schemas expostos pela Data API. A função de sessão e o hook OAuth vivem no schema privado com `search_path` fixo e concessões específicas.

## Escrita, concorrência e falha

O backend valida JWT e a sessão real, inicia transação com papel `authenticated` e define internamente o UUID verificado. Não aceita `owner_id` do remetente. Escritas usam um bloqueio transacional por conta, verificam recibo anterior, cota e revisão da leitura, fazem as alterações e inserem o recibo no mesmo commit. O bloqueio torna a verificação de cota e deduplicação determinística neste volume pessoal; não é uma fila distribuída.

Mesma operação/intenção devolve o mesmo recibo. A mesma chave com intenção diferente gera `IDEMPOTENCY_MISMATCH`. Revisão antiga gera `CONFLICT`, sem sobrescrita. Falha antes do commit reverte tudo. Depois do commit e antes da resposta, o resultado é desconhecido para o cliente: consultar `operation_get` recupera o recibo; repetir a mesma identidade evita duplicação. Leituras não criam eventos nem atualizam posição implicitamente.

Exportação é paginada por seção. Pare escritas durante um backup completo: páginas sucessivas não são um snapshot transacional global. A restauração valida formato, relações, âncoras e hashes, executa numa transação e atribui IDs novos; o mapa é devolvido no recibo. Recibos antigos ficam arquivados no resultado da restauração, sem reativar suas chaves como novas intenções. Preferências existentes da conta de destino não são sobrescritas.

Índices atendem proprietário, ordenação de elementos, histórico e intervalo/idioma. O caso de 10 mil elementos mede paginação e estabilidade; não demonstra capacidade para múltiplos locatários de grande porte. Consulte [testes](testes.md) e [segurança](seguranca.md).
