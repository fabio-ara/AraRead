# Revisão e limites da evolução 0.4

Data: 27/10/2026. Base: `28dc609`. Esta evidência descreve a implementação na branch `feat/reading-integrity-context`; não homologa uma publicação.

## Falhas reproduzidas e correções verificadas

| Problema | Correção e evidência |
|---|---|
| Recorte salvo recalculado e interrupção em parêntese | Referência persistida preservada; segmentador estrutural e recomposição explícita. Regressões falharam antes da mudança e passaram depois. |
| Índices incompatíveis entre original e mediação | Âncora por representação, versão e segmento; mapa DOM/UTF-16/pontos de código. Testes com repetição, reversão, grafemas, RTL e duas contas. |
| Grifo de versão ausente na restauração | Órfão declarado permanece consultável, sem reancoragem. Backup v3 e concorrência verificados com Auth/PostgreSQL reais. |
| Saída MCP com campo não descrito no schema | `selection_context` incluído no contrato. Cliente oficial OAuth validou a saída real. |
| Resposta perdida confundida com escrita recusada | Operação incerta mantém a mesma chave; recuperação consulta recibo antes de repetir. Host sintético ligado à API real simula perda antes/depois do commit. |
| Resposta atrasada de uma leitura apagava a pendência de outra no painel MCP | Chave e leitura de origem capturadas antes do envio; resposta e recuperação não alteram o novo painel. O teste segura a resposta de A, abre B e perde a resposta de B; falhou antes e passou depois da correção. |
| Navegação durante gravação retirava a confirmação da tela web | Navegação por botões aguarda o recibo; cache e resultado ficam associados à conta e passagem de origem. O teste segura a resposta HTTP após o commit e tenta abrir a biblioteca; falhou antes e passou depois. |
| Leitor removido conservava ouvintes de eventos e destaques globais | Desmontagem explícita aborta os ouvintes e remove as faixas visuais; respostas antigas não redesenham o leitor descartado. A regressão falhou ao verificar a biblioteca antes da correção e passou depois; reabrir recupera os três grifos persistidos. |
| Recuperação de senha e saída recriavam campos durante eventos Auth | Tratamento de eventos repetidos e saída em andamento. Jornadas reais nos dois motores. |
| Rede voltava antes de a página terminar de iniciar | Fila verificada também após inicialização da identidade/cache. Grifo offline, recarga e confirmação por nova consulta. A reconexão também preserva o DOM da passagem aberta para não apagar uma consulta iniciada durante a revalidação. |
| Tema inicial do host ignorado | Contexto inicial e notificações do SDK atualizam o tema; teste verifica a cor efetiva. |

O executor matemático foi revisto quanto a operações permitidas, tamanho/profundidade, valores não finitos, domínio real e convenção civil sem ano zero. Vocabulário separa contexto salvo, definição geral e fonte consultada; testes incluem vazio/falha externa e consulta real de palavra, conceito e locução. Isso não constitui revisão acadêmica humana.

## Ferramentas e revisão independente

A análise estática focada de segurança/autenticação/soberania não retornou achados no conjunto enviado. Seu alcance é limitado às regras executadas; não cobre toda a semântica do mandato.

Os revisores automatizados independentes não concluíram: o serviço retornou HTTP 429 após as tentativas. Uma tentativa separada pela CLI também não produziu revisão, com erros de inicialização/transporte; foi encerrada. Nenhum parecer inexistente é contado como aprovação. **A revisão independente de integridade, seleção, isolamento, cálculos, vocabulário e capacidades do host permanece pendente e impede a entrega integral/publicação.**

## Motores de navegador

Playwright 1.56.1 passou em Chromium, mas WebKit 26.0 falhou em duas recargas com `setOffline(true)`, apesar de service worker ativo. A falha corresponde ao [relato upstream #42775](https://github.com/microsoft/playwright/issues/42775). A [correção #42894](https://github.com/microsoft/playwright/pull/42894) foi integrada em outubro; a dependência de testes foi atualizada para 1.64.1 e WebKit 27.2 passou nas dez jornadas sem pular testes. O host sintético teve a altura ajustada ao viewport para permitir interação real com seus controles fixos.

Mouse, teclado e toque emulado foram exercitados. Não houve teste em aparelhos físicos iOS/Android, certificação de acessibilidade nem homologação das novas ações no ChatGPT real. O serviço hospedado e a leitura pessoal continuam na versão anterior, sem reparo ou alteração administrativa.

## Preparação da CI

A execução [40537650170](https://github.com/fabio-ara/AraRead/actions/runs/40537650170) aprovou tipos, documentação, auditoria pública, build, Docker, migrations e OCR, mas atingiu o limite de 20 minutos durante o download de 119 MB de bibliotecas WebKit pelo espelho Ubuntu do Azure. As suítes não chegaram a executar nessa tentativa. Uma troca de espelho também permaneceu demorada e foi substituída.

A configuração final usa a imagem oficial `mcr.microsoft.com/playwright:v1.64.1-noble`, fixada por digest. Chromium 156 e WebKit 27.2 iniciaram e renderizaram a fixture local dentro dessa imagem, com Node 24.22.1. O núcleo roda antes da obtenção da imagem, e os mesmos testes de navegador continuam obrigatórios. Não houve remoção de testes nem substituição da prova remota por uma aprovação local. O resultado da revisão exata aparece nos checks do PR.

A [CI com imagem oficial](https://github.com/fabio-ara/AraRead/actions/runs/40543214317), revisão `f03d0d6`, passou em todos os gates. Os logs da tentativa anterior também mostraram `RATE_LIMIT` entre suítes rápidas que compartilham o endereço local do servidor. O workflow agora aguarda a janela real de um minuto antes de cada motor; o limite da aplicação permanece intacto. Esta separação impede que o consumo de uma suíte contamine a seguinte. A revisão `457dd69` passou tanto no [push](https://github.com/fabio-ara/AraRead/actions/runs/40544559777) quanto no [PR](https://github.com/fabio-ara/AraRead/actions/runs/40544570466). As correções posteriores de resposta atrasada exigem os checks da nova revisão, visíveis no PR.
