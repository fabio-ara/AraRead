# Revisão crítica da evolução 0.5

Esta revisão cobre o domínio editorial, a integração com o leitor existente, os importadores, a persistência e a preparação da entrega. A implementação foi examinada pelo agente responsável e por análise estática focada. As tentativas de revisão por agentes independentes retornaram indisponibilidade por limite de uso (429), sem parecer concluído. Não houve revisão acadêmica humana, certificação de acessibilidade nem pesquisa de eficácia educacional.

## Dimensões examinadas

| Dimensão | Evidência e conclusão delimitada |
|---|---|
| Arquitetura e manutenção | `src/editions` concentra contratos, regras, grupos, apresentação e backup. Web, MCP e Edge invocam os mesmos casos de uso; o leitor e a calculadora existentes são reutilizados. Nenhum serviço de geração foi acrescentado. |
| Integridade das fontes | Fontes incorporadas preservam UUIDs, ordem, texto, hash e bytes necessários. Passagens/versionamento não atualizam originais. Testes conferem intervalos Unicode, referências cruzadas e hash independente da ordem de chaves JSONB. |
| Fidelidade editorial | Matriz adversarial cobre negação, modalidade, condições, ironia, ambiguidades, atribuições, objeções, polissemia e lacunas. Os três últimos casos conferem exemplo sem prova, traduções alternativas e correção com evidência. Parte dos riscos depende de declaração editorial explícita: aprovação estrutural não certifica equivalência semântica. |
| Segurança e privacidade | Auth/PostgreSQL reais, duas contas e acesso SQL sob papel comum. RLS forçado, referências entre entidades, sessão/concessão, revisões e recibos são exigidos. Texto livre e preferências pessoais são excluídos da configuração pública. Convites aleatórios de uso único são guardados por hash e têm expiração. |
| Armazenamento | O benchmark mede a mesma edição antes/depois de dois leitores. Conteúdo editorial permanece compartilhado; fonte incorporada conserva um snapshot do autor além da biblioteca legada. O custo pessoal, tráfego e capítulo offline são medidos separadamente. Não se extrapola capacidade do plano Free. |
| Autoria MCP | Cliente SDK percorre fontes, configuração com origem, amostra/aprovação, lotes, pareceres e publicação. Falta de amostra, revisão ou atualização da produção impede publicação. Aprovação humana não é simulada; fixtures usam a origem sintética explícita. |
| Simplicidade da interface | Entrada em Edições, quatro etapas de autoria, catálogo e retomada. Leitor mantém somente Leitura facilitada, Tradução e Original. Apoios preparados, notas, práticas e controles secundários ficam em áreas recolhíveis. |
| Acessibilidade | Jornada por teclado, três abas identificadas, seleção DOM/Unicode, texto ampliado, foco e controles mínimos. Inspeção nativa verificou 320 px e zoom 200%. Isso não representa auditoria WCAG completa. |
| Dispositivos móveis | Chromium/WebKit exercitam 320/390/480 px e desktop 1440 px, coluna máxima de 480 px e ausência de transbordamento. WebKit automatizado não substitui teste em iPhone físico. |
| Dados antigos | As jornadas legadas continuam na suíte. Instalação vazia/evolutiva, backup v1/v2/v3 e restauração v4 verificam identidade, texto e memória. Fixture de continuidade histórica é sintética; a leitura pessoal não é reparada nem usada como demonstração pública. |
| Publicação e recuperação | Migrations são aditivas, com hashes anteriores conferidos. Backup consistente é obtido por conta comum antes da mudança. A entrega exige CI da revisão exata e provas posteriores por HTTP, SDK e Pages; preparação local não equivale a implantação. |
| Direitos e licenças | Demonstração original, direitos explícitos e revisão antes de compartilhar. Dependências JavaScript fixadas e avisos preservados; LibreOffice/calibre/OCR usam suas próprias licenças de distribuição. Importação não concede direitos de publicação. |

## Achados tratados

- JSONB muda a ordem de chaves: o hash de conteúdo passou a ordenar objetos recursivamente, preservando a ordem de arrays e normalizando datas. Regressão inclui corrupção real, Unicode e restauração.
- Recibos de estado pessoal tinham datas que retornavam como objetos ou strings: a resposta idempotente usa somente estado semântico e revisão. A comparação real de repetição passou.
- Marca de revisão exigia texto embora o contrato permita marca simples: a operação agora aceita a intenção sem nota e mantém a unicidade por passagem.
- Preferências livres da autoria não devem acompanhar uma edição pública: a versão expõe apenas parâmetros editoriais permitidos; o snapshot completo permanece privado.
- A entrada de convite ficava numa edição ainda inacessível: o catálogo ganhou a ação de aceitar convite e abrir o conteúdo autorizado.
- A retomada anônima desconsiderava a posição local: o botão usa a última passagem do dispositivo. Uma regressão recarrega o site antes de retomar.
- A mensagem do painel sugeria chat mesmo com apoios preparados: o texto agora distingue indisponibilidade de gravação e disponibilidade da leitura/apoios.
- Fila offline foi conferida com duas abas e uma escrita durante a sincronização. Remoção pelo recibo da criação evita perder a intenção antes de conhecer o UUID remoto.
- Limpeza de dados pessoais continua permitida quando a cota está atingida. Consultas de conta/leitura não passam a exigir escrita ou espaço livre.
- A comparação de recibo no teste WebKit capturava a chamada anterior antes da entrega assíncrona. A regressão agora espera a chamada chegar ao host e o controle de recuperação aparecer.
- Uma resposta atrasada da Biblioteca redesenhava o formulário de importação iniciado durante a consulta e apagava o rascunho. A reprodução local com navegador real e HTTP controlado perdeu título/texto antes da correção e os preservou depois. O carregamento agora só redesenha a tela que iniciou a consulta; a jornada com Auth/banco reais também retém a resposta deliberadamente para conferir esse caso.
- A origem das preferências pessoais incluía escopos de autoria que não participavam da resolução: o leitor agora informa a precedência leitor → conta → padrão. A regressão salva tamanho 24 e confere origem, precedência e isolamento entre contas.
- O service worker impedia a interceptação deliberada da resposta no novo teste de rascunho em WebKit. A reprodução distinguiu esse problema do defeito do produto. Apenas esse teste desativa o service worker; as jornadas de leitura e offline continuam a exercitá-lo.
- A homologação no Pages encontrou um clique descartado durante a busca de edições: os botões pareciam disponíveis enquanto a operação estava ocupada. Os controles agora ficam desabilitados durante a requisição, inclusive quando a tela é recriada, e preservam suas condições próprias de disponibilidade. A regressão retém a busca real, confere o estado dos controles e abre a edição após a resposta.
- A exclusão de uma conta que consumiu um convite falhava no Auth por referência histórica. Uma migration posterior preserva o convite com destinatário removido e revogação obrigatória, sem reabrir o código. A regressão de evolução reproduz a falha antiga e confere exclusão, convite revogado, participação removida e edição do autor preservada. O teste hospedado também verifica esse ciclo pelo Auth real.

O analisador estático também apontou SHA-256 como armazenamento de senha, comparações de UUID/hash como comparação de segredo e interpolação de SQL. A inspeção não confirmou essas classificações: senhas pertencem ao Auth, convites têm 192 bits aleatórios, os valores SQL usam parâmetros e as interpolações escolhem expressões constantes. A iteração repetida de cobertura era pertinente e foi substituída por agrupamento de intervalos por fonte/elemento. Não se tratou a pontuação do analisador como aprovação ou reprovação automática do produto.

## Evidência e encerramento

A revisão `0f4fdf60d182aa6f9aa1d8b4a1fed7306cfd983c` passou integralmente nas CIs de [push](https://github.com/fabio-ara/AraRead/actions/runs/40790784552) e [PR](https://github.com/fabio-ara/AraRead/actions/runs/40790789894): 134/134 testes do núcleo, 16/16 jornadas Chromium e 16/16 WebKit, sem pulos. Conversão real DOC/MOBI, OCR, migrations, empacotamento Edge/PDF.js, Docker, tipos, documentação e auditorias passaram. Inclui os achados de recibo, retomada, perda de rascunho, precedência, clique durante a busca e exclusão de participante. Execuções anteriores com falha não são usadas como gate de entrega.

O critério de encerramento foi satisfeito para a implementação: revisão exata aprovada, ausência de defeito material conhecido, implantação nos destinos existentes e validação hospedada registrada em [STATUS](../../STATUS.md). O [gate hospedado](hospedado-0.5.json) aprovou 31 blocos, preservou a demonstração pública e confirmou a correção de exclusão no Auth real. A [inspeção no ChatGPT](chatgpt-0.5.json) acionou e conferiu visualmente as três abas dessa demonstração em conversa nova. Persistem os limites de avaliação acadêmica humana, aparelhos físicos e capacidades efetivamente oferecidas pelo host MCP externo.
