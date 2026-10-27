# Continuidade e apoios contextuais 0.4

O parágrafo é uma unidade da fonte imutável. A passagem é o intervalo apresentado; os parágrafos didáticos da explicação pertencem à sua versão de mediação. As três abas usam a mesma passagem. Esta evolução conserva o controle principal pelo chat e a coluna de até 480 px.

## Política de leitura e compatibilidade

`portion` é determinística e compartilhada pelo servidor. O modo padrão preserva parágrafos viáveis inteiros; leitura curta procura fronteiras de sentença fora de construções protegidas. Alvos são flexíveis. Versos, código, provas, fórmulas e tabelas conservam sua organização. A concatenação ordenada deve reproduzir todos os pontos de código do elemento, incluindo espaços e pontuação. Isso comprova integridade textual, não fidelidade intelectual.

`reading_context` conserva a referência salva por padrão. Um `size` explícito pede outro recorte sem gravar posição. `passage` identifica política, elemento completo, partes e interrupções; `source_elements.full_ref` distingue o elemento inteiro de sua passagem inicial. Referências legadas já abertas ou na retomada continuam válidas para `continue`. Intervalos arbitrários que apenas começam na posição atual são recusados.

“Próximo parágrafo” confirma somente a passagem apresentada. Se ela cobre o elemento inteiro, abre a unidade seguinte; se era um fragmento, entrega o restante explicitamente antes de sair do elemento. A abertura, seleção e consulta não cobrem texto. Em desvio, a retomada principal permanece.

A verificação estrutural é independente da comparação editorial declarada. Uma construção interrompida exige recomposição ou reconhecimento explícito da continuidade nas duas mediações. A tradução não acrescenta pontuação ou material para fechar o recorte. `supersedes` continua exigindo o mesmo intervalo, idioma e representação. A versão operacional da orientação evolui sem invalidar a assinatura de materiais idênticos; mudança de referência ou de materiais gera outra assinatura.

## Reparo de apresentação

1. Consulte `reading_repair_preview` na leitura autorizada. Confira referência anterior, elemento completo, revisão e campos preservados.
2. Aplique `reading_repair` com o `preview_token`, revisão e `operation_id` da intenção. Mudança de estado invalida a prévia.
3. Releia `reading_context(position:'opened')`, cobertura, retomada e histórico. O evento `presentation_repair` identifica a operação; o recibo permite recuperação sem duplicação.
4. Prepare novas representações para a referência completa antes de `reading_display`. Não substitua variantes de fragmentos usando `supersedes`.

O reparo altera somente a apresentação aberta e a revisão. Não troca fonte, não reimporta, não apaga variantes/notas e não marca o restante como percorrido. Backups e o histórico conservam as referências anteriores. A aplicação desse procedimento numa biblioteca pessoal é uma prova separada dos testes sintéticos.

## Estado da entrega

Consulte [STATUS](../STATUS.md) para gates e destinos efetivamente verificados. Implementação, prova local, serviço hospedado e host MCP são níveis distintos. Emulação de celular não comprova gestos nativos de iOS/Android.

## Seleção e grifos

A seleção nativa continua disponível nas três abas. Ao selecionar, aparecem Destacar, Entender e Calcular; nenhuma ação confirma leitura. Os apoios fecham por Escape, Fechar ou toque fora. Grifos têm uma lista acessível além da cor, com remoção isolada e consulta de versão antiga.

A referência canônica identifica o contexto. No Original, os índices são pontos de código absolutos do elemento. Na Tradução e na Leitura facilitada, pertencem ao segmento `main` ou `addition:N` de uma `mediation_id` imutável. Acréscimos permanecem separados. `exact`, `prefix` e `suffix` conferem citação e até 32 pontos de código de contexto; limites não interrompem grafemas. O DOM usa UTF-16 e mapa posicional explícito, inclusive quando espaços são normalizados. Não se procura a primeira ocorrência do texto selecionado nem se transferem índices entre abas.

`highlight_save`, `highlight_remove` e `highlight_list` reutilizam `notes`, com `kind=highlight` e `anchor` JSONB. A migration aditiva mantém 19 tabelas com RLS. Os estados são ancorado, versão substituída e versão indisponível/órfã; nenhum autoriza reancoragem aproximada. O backup v3 conserva o campo opcional, remapeia versões existentes e preserva órfãos declarados. Backups v1/v2 e notas antigas continuam aceitos. Remover grifo não remove notas ou explicações.

O SDK oficial `@modelcontextprotocol/ext-apps` 2.0.4 negocia `serverTools` e `message.text`. O painel chama uma lista restrita de ferramentas. Sem capacidade ou permissão de escrita, não oferece salvar. Uma resposta incerta conserva a mesma identidade: Recuperar gravação consulta o recibo antes de repetir. O iframe não contém token nem precisa de rede externa. Host sintético não equivale à homologação no ChatGPT real.

## Vocabulário ligado à ocorrência

`lexicon_lookup` filtra sentidos guardados por idioma e distingue mesma seleção, mesma passagem e outro contexto. Isso não comprova pertinência semântica: ocorrências iguais podem ter sentidos diferentes. A consulta externa é explícita e envia somente o termo/expressão ao Wikcionário. Retorna até três excertos de até 400 pontos de código, com título, URL, data, atribuição, licença e hash. Definição geral fica separada de interpretação do leitor/assistente. Etimologia e consenso não são inferidos. Links SEP/IEP são sugestões não consultadas.

A web consulta fontes e sentidos existentes sem chave de modelo. Uma interpretação nova pode ser encaminhada ao chat com pergunta, idioma, representação, seleção e referência; a interface independente oferece cópia explícita. O MCP App envia somente se o host negociar mensagens de texto. Pergunta e entrada sobrevivem à queda de conexão enquanto o apoio está aberto. Guardar definição geral ou sentido contextual é uma ação distinta via `term_save`, com origem e contexto. Termos no idioma efetivo podem alterar os materiais de preparação futura, conforme o mecanismo existente de assinaturas; a variante salva não é reescrita.

## Calculadora e datas civis

`contextual_calculate` é consulta autenticada vinculada à passagem. A web usa a mesma função pura, inclusive offline. Salvar cálculo como nota aciona `note_save` somente por escolha explícita, registrando seleção, conta, convenções e limite interpretativo.

Datas aceitam a.C./d.C., a.E.C./E.C. e BC/BCE/AD/CE. Uma era no fim pode ser compartilhada e aparece na interpretação. Anos devem ser inteiros entre 1 e 100.000, em ordem cronológica. Não se usa `Date`: na convenção civil não há ano zero. `429?–347 B.C.E.` resulta em aproximadamente 82 anos, conservando a incerteza do primeiro operando. De 1 a.C. a 1 d.C. decorre um ano. Sem dia/mês, a diferença não estabelece idade exata. Operandos e eras são corrigíveis; numeração astronômica não é implícita.

A científica admite aritmética, parênteses, potências, `sqrt`, `cbrt`, porcentagens, `ln`, `log`/`log10`, `exp`, `abs`, trigonométricas/inversas, `pi` e `e`. Graus/radianos e vírgula/ponto decimal são explícitos. Não há separador de milhares ou lista de argumentos. Potências associam à direita e precedem sinal unário: `-2^2=-4`. Porcentagem segue o parser: `x%=x/100`, `200*10%=20`, `200+10%=220`. `log` é base dez e `ln`, natural. Exibição tem até doze algarismos significativos; ponto flutuante não oferece aritmética decimal exata.

Math.js 15.2.0 (Apache-2.0) fornece somente o parser. O executor percorre nós e operações permitidos, sem `eval`, `Function`, compilação, propriedades, importações ou funções arbitrárias. Limites: 512 caracteres, 128 tokens/nós, 24 níveis de parênteses, 32 de visita, duas porcentagens, magnitude 10^100 e orçamento de 50 ms conferido durante a visita. A entrada é limitada antes do parser; o orçamento não é isolamento por processo. Divisão por zero, domínio complexo, tangente indefinida e magnitude excessiva retornam erro.

## Recuperação e dispositivo

O shell usa `araread-shell-v4`; dados privados continuam separados por conta em IndexedDB. A fila aceita grifos com identidade conservada e diferencia estado somente local de confirmação relida no servidor. Primeiro consulta o recibo; notas/grifos podem reaplicar a revisão corrente depois de conferir fonte e intenção, enquanto progresso conflitante exige conferência. Logout conserva o fluxo explícito de recuperação/descarte de pendências. Limites: 12 passagens/2 MiB e 40 operações/1 MiB.

Referências primárias: [Selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection), [CSS Custom Highlight](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API), [Web Annotation](https://www.w3.org/TR/annotation-model/), [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), [segurança Math.js](https://mathjs.org/docs/expressions/security.html) e [anos civis/astronômicos NASA](https://eclipse.gsfc.nasa.gov/SEhelp/dates.html). Alvos de interface de 44 px são escolha do produto, não alegação de certificação WCAG.
