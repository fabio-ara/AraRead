# Estado verificável

Checkpoint de 24/10/2026, Brasília, após trabalho iniciado em 23/10. Repositório local `C:\Users\008031\Documents\AraRead`; [remoto privado](https://github.com/fabio-ara/AraRead).

| Nível | Estado | Evidência |
|---|---|---|
| Código e ambiente local | Núcleo implementado e validado | 32 verificações do núcleo e 3 jornadas web aprovadas; [matriz](docs/testes.md), código/fixtures e imagens reais no repositório |
| Hospedagem | Não implantado | Conta Supabase independente ainda depende do cadastro e validação pessoal do titular; nenhum recurso escrito na organização dos outros produtos |
| Cliente externo real | Não validado no ChatGPT | O SDK oficial foi exercitado localmente; isso não substitui o ChatGPT nem o gateway hospedado |

Endereços reais locais: interface `http://127.0.0.1:4317`, MCP `http://127.0.0.1:4317/mcp`, saúde `http://127.0.0.1:4317/health`. Auth local em loopback `4318`; PostgreSQL exclusivo em `56432`. O teste de reinício usa temporariamente `4316`.

Verificação final: `npm ci`, `npm run check`, `npm run build`, `npm run docs:check`, `npm audit --audit-level=moderate` (zero vulnerabilidades conhecidas na consulta), migrations reaplicadas sem alteração e suítes reais. Na execução conjunta, 31 testes passaram e o teste OAuth apontou um modo de pinagem inadequado na própria prova; ele foi corrigido para `mode:'legacy'`, conforme SDK, e repetido com sucesso, sem alteração do produto. As três jornadas Playwright passaram, incluindo recuperação do rascunho quando não há sessão e remoção no logout explícito. Os logs locais estão em `.local/evidence`, sem publicação de credenciais. A CI está configurada; seu resultado remoto será registrado após a publicação do código.

Fonte extensa: 10.000 elementos, 2.878.895 bytes de original; última página com 50 elementos em 32 ms e 21.351 bytes de resposta na medição final local. Imagem Docker construída e executada, com saúde/banco, HTML e extração PDF real. O backup >16 MiB foi restaurado e teve os bytes originais conferidos. O console DevTools do login ficou sem erros/avisos após a correção de fontes e CSP.

Próximo passo externo: concluir pessoalmente o cadastro oficial no Chrome dedicado, incluindo senha, termos e verificação de e-mail; conectar o Supabase à nova conta e identificar a organização de destino. Não enviar senha, token ou link de acesso pelo chat. Depois, verificar identidade/organização/projeto, provisionar somente o projeto exclusivo gratuito, aplicar os gates hospedados e realizar a prova de leitura, escrita e retomada no cliente externo.

O backend Node e a imagem Docker são artefatos de implantação. Não há adaptação homologada para Supabase Edge Functions nem hospedagem de backend já contratada. Será necessário um runtime Node com HTTPS e alcance ao banco exclusivo; nenhum custo está autorizado. O bloqueio de identidade não autoriza usar uma organização existente de AraLearn/AraHub.

Limites atuais: OCR, EPUB, DOCX, interpretação automática de imagens, sincronização de alterações offline e geração dentro do aplicativo não estão implementados. PDFs preservam bytes, mas a extração requer conferência; as amostras editoriais são sintéticas, avaliadas por IA, sem validação humana ou eficácia pedagógica comprovada. Consulte [capacidades e decisões](docs/decisoes.md).
