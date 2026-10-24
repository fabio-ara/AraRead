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
| Provedor/banco indisponível | Consulte só a cópia já carregada; não afirme que rascunho foi sincronizado |
| Fim de fonte parcial | Forneça material adicional vinculado; não complete por memória |
| PDF incompleto | Preserve bytes e forneça transcrição com página/região em nova versão |
| Cota atingida | Exporte, confira backup e exclua explicitamente o material escolhido; não aumente plano automaticamente |

A cota de 80 MiB conta bytes de originais, texto dos elementos, reescritas/acréscimos, notas e definições. Não é medição completa do tamanho físico do PostgreSQL: índices, eventos, recibos e overhead também ocupam espaço. O operador precisa acompanhar a quota real do provedor. Exclusão é permitida mesmo quando não há espaço para nova importação. Limites por arquivo, corpo HTTP e importador continuam aplicáveis separadamente.

## Backup privado

Na interface, Configurações prepara o JSON completo em um campo de texto, incluindo originais. Nenhum arquivo é baixado pela UI. A ferramenta CLI escreve bytes diretamente no sistema de arquivos:

```powershell
npm run backup -- export .local/minha-biblioteca.json
npm run backup -- restore .local/minha-biblioteca.json
```

Esses comandos exigem `ARAREAD_ACCESS_TOKEN` no ambiente do processo, obtido legitimamente para sua própria conta pela API Auth; não o passe como argumento, não o grave em script/commit e não o envie no chat. `APP_ORIGIN` escolhe a instância. A CLI não extrai credenciais do navegador. O usuário pode preferir a exportação no campo privado e a restauração pela própria interface, que usa a sessão já autenticada.

Interrompa escritas durante o backup: a exportação pagina seções e não fornece snapshot global entre chamadas. Verifique todas as páginas das dez seções e use `include_original:true`; sem os bytes a restauração deve falhar. Arquivo de destino existente não é sobrescrito. Guarde o backup em armazenamento confiável com criptografia e política de retenção apropriadas; o JSON em si não é criptografado.

A restauração aceita `araread/1`, valida originais por SHA-256 e relações/intervalos, cria IDs novos e conserva relações, proveniência, idiomas, cobertura e histórico. Ela não sobrescreve leituras existentes nem preferências já presentes na conta. O recibo traz `id_map` e os recibos antigos como arquivo de proveniência; chaves antigas não são reativadas. Duas restaurações intencionais com novas identidades criam duas cópias.

Para evitar duplicação em falha de rede, a CLI grava antes um arquivo `.restore-request.json` ao lado do backup, com identidade e hash da intenção. Reexecutar com o mesmo arquivo recupera o recibo ou repete a mesma chave. Não remova esse arquivo enquanto houver resultado incerto. O recibo confirmado fica em `.restore-receipt.json`; se ele já existir, a escrita local protegida não o substitui. A interface também conserva intenção pendente no IndexedDB e permite consultá-la/repeti-la em Configurações.

MCP e operações HTTP comuns limitam o corpo a 16 MiB. A rota de restauração web/CLI aceita até 128 MiB, após verificar identidade e sessão ativa, para comportar originais em Base64 dentro da cota de conteúdo. Backups excepcionalmente maiores por overhead/histórico de recibos precisam de tratamento operacional revisado; não há restauração multipart. Os testes cobrem também backup acima de 16 MiB e rejeição transacional de referências adulteradas. A cota é verificada pelo conteúdo efetivamente restaurado, não pelo tamanho maior da codificação Base64.

## Exclusão e reversão

Não existe botão destrutivo de exclusão no leitor. MCP/API oferecem exclusão explícita de obra, com UUID de operação e título exato; o cliente deve confirmar a intenção. Faça backup antes. A exclusão retira versões e leituras associadas, sem atingir outras obras/contas. Recibos e backups têm retenção separada, descrita em [segurança](seguranca.md).

Para código defeituoso, volte ao artefato anterior compatível com o schema; não edite migrations aplicadas nem execute reset em produção. Uma correção de dados exige backup, análise do impacto e migration ou operação explicitamente revisada. Para perda de volume local, reinstale a instância, crie uma identidade legítima e restaure o backup, conferindo o mapa de IDs. A suíte de atualização usa banco temporário exclusivo, sem apagar o banco de desenvolvimento.
