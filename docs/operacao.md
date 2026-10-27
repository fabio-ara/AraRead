# Operação e recuperação

O servidor é o registro canônico; uma resposta de sucesso ou uma cópia offline isolada não substitui a segunda leitura. `/health` verifica conexão básica com PostgreSQL. Configurações/capacidades informam cota e bytes aproximados de conteúdo, sem copiar a biblioteca para logs.

## Falhas comuns

| Situação | Procedimento |
|---|---|
| Rede caiu antes da resposta | Preserve a intenção e o `operation_id`; consulte recibo antes de repetir |
| Recibo confirmado | Releia contexto/histórico; não crie nova nota ou avanço equivalente |
| Recibo desconhecido | Ainda não há confirmação; repetir a mesma intenção/chave é seguro, sem concluir que falhou |
| Conflito de revisão | Consulte contexto atualizado e confira novamente sua intenção; não sobrescreva |
| Sessão expirada/revogada | Entre ou autorize novamente pelo provedor; não troque por chave administrativa |
| Senha esquecida | Informe o e-mail no login e use “Esqueci minha senha”; abra pessoalmente o link e defina a nova senha. Confira spam e limites do provedor; não encaminhe o link ao assistente |
| Provedor/banco indisponível | Consulte só a cópia já carregada; não afirme que rascunho foi sincronizado |
| Fim de fonte parcial | Forneça material adicional vinculado; não complete por memória |
| PDF incompleto | Preserve bytes e forneça transcrição com página/região em nova versão |
| Cota atingida | Exporte, confira backup e exclua explicitamente o material escolhido; não aumente plano automaticamente |

A cota conta originais, texto dos elementos, reescritas/acréscimos, seleções/proveniência, notas/atribuições, definições/detalhes e registros de estudo/bibliografia: 16 MiB no perfil Edge hospedado e 80 MiB no Node local. O valor ativo aparece nas capacidades da conta. Isso não mede o tamanho físico completo do PostgreSQL: índices, eventos, recibos e overhead também ocupam espaço. Acompanhe a quota do provedor. Exclusão é permitida mesmo sem espaço para nova importação. Limites por arquivo, corpo HTTP e importador são separados.

## Backup privado

Na interface, Configurações prepara o JSON completo em um campo de texto, incluindo originais. Nenhum arquivo é baixado pela UI. A ferramenta CLI escreve bytes diretamente no sistema de arquivos:

```powershell
npm run backup -- export .local/minha-biblioteca.json
npm run backup -- restore .local/minha-biblioteca.json
```

Esses comandos exigem `ARAREAD_ACCESS_TOKEN` no ambiente do processo, obtido legitimamente para sua própria conta pela API Auth; não o passe como argumento, não o grave em script/commit e não o envie no chat. `APP_ORIGIN` escolhe a instância. A CLI não extrai credenciais do navegador. O usuário pode preferir a exportação no campo privado e a restauração pela própria interface, que usa a sessão já autenticada.

A exportação v3 confere um snapshot lógico entre todas as páginas das dezoito seções. Use o mesmo token retornado na primeira chamada e `include_original:true`. `EXPORT_CHANGED` exige reiniciar a tentativa completa; não rotule um conjunto parcial como backup. Fontes antigas ou marcadas `original_available:true` exigem os bytes. Fontes textuais novas restauram pelo hash canônico dos elementos, sem inventar um binário ausente. Preferências temporárias de sessão não entram no backup. Arquivo de destino existente não é sobrescrito. Guarde o JSON em armazenamento confiável com criptografia externa e retenção adequada.

A restauração aceita `araread/1`, `araread/2` e `araread/3`, valida originais por SHA-256 e relações/intervalos, cria IDs novos e conserva relações, proveniência, idiomas, cobertura e histórico. Ela não sobrescreve leituras existentes nem preferências já presentes na conta. O recibo traz `id_map` e os recibos antigos como arquivo de proveniência; chaves antigas não são reativadas. Duas restaurações intencionais com novas identidades criam duas cópias.

Para evitar duplicação em falha de rede, a CLI grava antes um arquivo `.restore-request.json` ao lado do backup, com identidade e hash da intenção. Reexecutar com o mesmo arquivo recupera o recibo ou repete a mesma chave. Não remova esse arquivo enquanto houver resultado incerto. O recibo confirmado fica em `.restore-receipt.json`; se ele já existir, a escrita local protegida não o substitui. A interface também conserva intenção pendente no IndexedDB e permite consultá-la/repeti-la em Configurações.

MCP e operações HTTP comuns limitam o corpo a 16 MiB. A restauração web/CLI aceita até 32 MiB no Edge ou 128 MiB no Node, após verificar identidade e sessão ativa. O limite maior comporta Base64 dentro da cota de conteúdo; ela é verificada pelo conteúdo restaurado, não pela codificação. Backups maiores por overhead/histórico de recibos exigem tratamento operacional revisado; não há restauração multipart. O gate local cobre backup acima de 16 MiB e rejeição transacional de referências adulteradas.

## Exclusão e reversão

O chat oferece exclusão explícita de nota e de suas derivações registradas, distinta de desativar sua influência. MCP/API também oferecem exclusão de obra com UUID e título exato. A obra e suas leituras são retiradas; bibliografia utilizada por outra leitura deixa uma lacuna e sinaliza dependentes para revisão. A retirada não apaga o original de outra obra. Recibos/backups têm retenção separada; veja [segurança](seguranca.md).

Para código defeituoso, volte ao artefato anterior compatível com o schema; não edite migrations aplicadas nem execute reset em produção. Uma correção de dados exige backup, análise do impacto e migration ou operação explicitamente revisada. Para perda de volume local, reinstale a instância, crie uma identidade legítima e restaure o backup, conferindo o mapa de IDs. A suíte de atualização usa banco temporário exclusivo, sem apagar o banco de desenvolvimento.

## Fila e cópias no dispositivo

Filas anteriores de notas/progresso offline conservam proprietário, leitura, fonte, intervalo, revisão e identidade da intenção. O serviço é consultado antes de repetir. O acréscimo seguro de nota ou grifo admite revisão atualizada automaticamente; progresso conflitante pede conferir/reaplicar. Não altere uma chave para tentar contornar um resultado desconhecido. A recuperação de pendências é JSON privado, sem credenciais, importável apenas na mesma conta.

Uma escrita conhecida invalida as cópias preparadas dessa leitura; na entrada/reconexão, revisões remotas são conferidas. Uma cópia totalmente offline não pode ser apagada à distância. Backups e cadernos já entregues a outra pessoa também não podem ser revogados pelo aplicativo. Limpar cache ou sair não apaga o servidor.

## Atualizar para 0.3

Aplique as três migrations novas em ordem, sem editar as anteriores. A primeira permite texto canônico sem binário e registra mapas/revisão editorial; a segunda cria perfis e preferências por escopo com RLS; a terceira reforça a propriedade de sessão/perfil/perspectiva na própria política. Conferir compatibilidade de restauração, assinatura do contexto e leitor de três abas antes de publicar o frontend. O runtime anterior não deve ser usado para escrever fontes textuais sem entender `original_available`; prefira correção aditiva compatível em caso de falha.

`PREPARATION_REQUIRED` orienta o assistente a preparar ou revisar as representações. `POSITION_CHANGED` pede consultar a posição atual antes de continuar. `ORIGINAL_NOT_RETAINED` informa indisponibilidade dos bytes, preservando o texto canônico. Não transforme esses estados em confirmação de leitura ou perda de dados. Medidas físicas e cotas lógicas são relatadas separadamente.

Conexões existentes no ChatGPT podem conservar o catálogo anterior. Na interface verificada em 24/10/2026, use **Plugins → AraRead → Gerenciar → Atualizar ferramentas** e abra uma nova conversa. A orientação deve informar 1.2.0 e o catálogo, 41 ferramentas, incluindo `source_preview` e `reading_display`; `editorial_review` é um campo de `mediation_save`, não uma ferramenta separada. Preserve a concessão OAuth e a política de permissões existentes. A prova no cliente usou aprovações pontuais para as operações sintéticas autorizadas; nenhuma autorização permanente foi ampliada.

Uma representação preparada com escolhas temporárias precisa ser recuperada com seleção compatível. Para retomar pelas preferências persistidas, prepare novamente usando os valores efetivos da leitura; variantes anteriores permanecem no histórico. A troca de perfil afeta a explicação, mantendo a tradução independente. A aceitação entre conversas verificou a mesma revisão, variantes, notas, termos e referência antes e depois da recuperação.


## Atualizar para 0.4

Aplique somente `20261027142447_representation_highlights_v4.sql`, sem editar migrations aplicadas. A coluna `notes.anchor` é opcional para notas antigas; o trigger confere fonte, versão, representação, segmento, citação e contexto sob RLS. Instalação vazia e evolução fazem parte do gate. Atualize Edge/Node e frontend pelo destino existente após os gates; `npm run build` gera também o painel MCP autocontido. `scripts/prepare-edge.ts` inclui todos os módulos atuais e dependências fixadas. O cache público muda para v4; dados privados ficam separados por conta.

Atualize o catálogo do conector quando o cliente oferecer essa função: orientação 1.3.0, 47 ferramentas e recurso `ui://araread/reader-v4.html`. Não refaça consentimentos nem amplie permissões para contornar capacidade ausente. O SDK precisa de `serverTools` para chamadas e `message.text` para perguntar ao chat. A recuperação de escrita incerta consulta recibo e conserva a mesma chave.

Para a apresentação fragmentada de uma leitura antiga, use a [prévia e o reparo](leitura-0.4.md#reparo-de-apresentação) sob a conta proprietária. Não reimporte a fonte, não remapeie cobertura e não substitua uma mediação de intervalo diferente. Uma biblioteca pessoal só é alterada com autorização e acesso legítimo; prova sintética não comprova reparo pessoal.
