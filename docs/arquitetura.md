# Arquitetura e estado canônico

O AraRead precisa conservar o que foi estudado mesmo quando o processo ou a conversa termina. PostgreSQL guarda o estado canônico. A interface conserva apenas cópias privadas limitadas e rascunhos. O modelo de IA atua no cliente externo e não é dependência do backend.

## Responsabilidades

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| Contratos e âncoras | `src/contracts.ts`, `outputs.ts`, `anchors.ts` | Validação, limites, idiomas, intervalos e porções |
| Ingestão | `src/importers.ts` | Preservar bytes e representar formatos sem execução |
| Casos de uso | `src/service.ts`, `src/study/*` | Domínio comum de leitura, memória, evidências, continuidade e recuperação |
| Persistência e identidade | `src/db.ts`, `auth.ts`, migrations | Transações, papel mínimo, RLS, JWT e revogação |
| Transporte | `src/server.ts`, `edge-http.ts`, `mcp.ts` | Adaptadores Node/Web padrão para a mesma API, identidade, domínio e Streamable HTTP |
| Orientação | `src/guidance.ts` | Instrução, recurso e prompt versionados |
| Interface | `src/web/main.ts`, `study-panel.ts`, `offline.ts`, `private-cache.ts`, `public/sw.js` | Navegação, estudo, fila e cópias privadas limitadas |
| Painel opcional | `src/widget.ts` | MCP Apps padrão, sem geração interna nem dependência de API exclusiva de um host |

Localmente, um processo Node serve frontend, API e MCP, com PostgreSQL e GoTrue em containers exclusivos. Na instalação hospedada, a função Supabase `araread` serve API/MCP e o GitHub Pages serve somente a interface estática. `VITE_API_BASE` define esse destino no build; CORS permite somente a origem configurada. Os dois adaptadores chamam os mesmos casos de uso e a mesma autorização. Supabase Auth fornece identidade e OAuth; não existe servidor OAuth artesanal. Originais ficam em `bytea`, com o restante da importação na mesma transação; não há bucket público.

O empacotador `scripts/prepare-edge.ts` copia do lockfile somente os dois módulos PDF.js necessários à extração textual, com licença e worker embutido. Assim não distribui todos os recursos opcionais do pacote no Edge. HTTPS usa Undici com socket TLS ligado ao IP público previamente validado, mantendo SNI e verificação do certificado para o hostname original. Não faz uma segunda resolução DNS nem aceita certificado inválido. O Edge usa pooler transacional, uma conexão por instância, descarte ocioso em 1 s e CA explícita; nenhum cliente de aplicação recebe chave administrativa. Consultas não têm nomes de prepared statements e todo contexto de identidade é local à transação.

O perfil Edge limita conteúdo da conta a 16 MiB e restauração HTTP a 32 MiB para respeitar a memória do runtime; Node local mantém 80/128 MiB. O limite por original continua 8 MiB. Essas cotas são expostas por `account_context`; não são medidas de cobertura intelectual. Os limites de CPU do provedor podem interromper um PDF complexo: o cliente deve conferir o recibo e manter o arquivo original, sem alegar importação concluída.

## Dados e relações

`works` conserva título/autoria; `sources` conserva uma versão imutável e relação opcional com a anterior; `elements` conserva o texto ordenado e os metadados extensíveis. Cada `reading` tem uma fonte raiz e um manifesto ordenado `reading_segments` de envios imutáveis da mesma obra; mantém aberto, retomada, intervalos percorridos, fim disponível, idioma, tamanho e revisão. `mediations` guarda reescrita, acréscimos e proveniência por intervalo e idioma, sempre acrescentando histórico. `terms` guarda sentido contextual; `notes` guarda anotações, perguntas, respostas vinculadas e marcas voluntárias, com origem explícita. `events` registra comandos de posição, sem alegar entrega no chat. `preferences` guarda padrão da conta e revisão. `receipts` guarda identidade da operação, hash da intenção normalizada e resultado confirmado.

As 16 tabelas têm RLS forçado. `references` conserva bibliografia/trechos; `perspectives` conserva versões e escopo; `contexts` registra seleção, assinatura, IDs/hashes disponibilizados e lacunas, sem duplicar textos; `connections` liga passagens próprias com problema e limites; `export_clock` detecta mudanças durante backup. Relações compostas incluem proprietário e fonte/leitura pertinente, impedindo ligar uma nota própria a conteúdo de outra conta. `araread` e `araread_private` não devem ser schemas expostos pela Data API. A função de sessão e o hook OAuth vivem no schema privado com `search_path` fixo e concessões específicas.

## Escrita, concorrência e falha

O backend valida JWT e a sessão real, inicia transação com papel `authenticated` e define internamente o UUID verificado. Não aceita `owner_id` do remetente. Escritas usam um bloqueio transacional por conta, verificam recibo anterior, cota e revisão da leitura, fazem as alterações e inserem o recibo no mesmo commit. O bloqueio torna a verificação de cota e deduplicação determinística neste volume pessoal; não é uma fila distribuída.

Mesma operação/intenção devolve o mesmo recibo. A mesma chave com intenção diferente gera `IDEMPOTENCY_MISMATCH`. Revisão antiga gera `CONFLICT`, sem sobrescrita. Falha antes do commit reverte tudo. Depois do commit e antes da resposta, o resultado é desconhecido para o cliente: consultar `operation_get` recupera o recibo; repetir a mesma identidade evita duplicação. Leituras não criam eventos nem atualizam posição implicitamente.

Exportação v2 pagina quinze seções com o mesmo token `snapshot`, validado por um relógio de escritas da conta sob o mesmo bloqueio. Se houver mudança, retorna `EXPORT_CHANGED` e o cliente descarta a tentativa incompleta. Não segura uma transação de banco entre chamadas. Restauração valida relações, âncoras e hashes, executa numa transação e atribui IDs novos; aceita v1, reconstruindo apenas o manifesto raiz, sem inventar proveniência de estudo antiga. Recibos históricos são arquivados, não reativados; preferências existentes do destino não são sobrescritas.

Índices atendem proprietário, ordenação de elementos, histórico e intervalo/idioma. O caso de 10 mil elementos mede paginação e estabilidade; não demonstra capacidade para múltiplos locatários de grande porte. Consulte [testes](testes.md) e [segurança](seguranca.md).

## Contexto, variantes e memória

`src/study` separa contratos, preparação de contexto, continuidade, bibliografia, exclusão de memória, cadernos, vocabulário e backup. Contextos limitam apoios adicionais a 64 KiB e registram omissões; o original da porção não é truncado por esse orçamento. IDs realmente disponibilizados são distintos das fontes que o assistente declara ter usado. Assinatura estável identifica contexto/configuração, sem prometer saída idêntica de um modelo. Provider/model só são registrados quando conhecidos.

O leitor retorna um corpo de variante e até 30 metadados de variantes; o histórico paginado e `variant_id` recuperam versões antigas. Mudanças sinalizam contexto desatualizado sem regenerar. Exclusão de memória percorre dependências registradas, respostas e derivações; desativação apenas retira influência futura. A retirada de bibliografia deixa lacuna explícita nas leituras dependentes. Recibos de preparação não duplicam original e notas; após exclusão, a consulta pode retornar um recibo confirmado com conteúdo privado retirado.

Veja [evolução](evolucao.md), [operação](operacao.md) e [segurança](seguranca.md) para limites de armazenamento, cópias offline e retenção.
