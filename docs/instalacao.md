# Instalação e implantação

A instância local é reproduzível e isolada. O destino hospedado exige uma conta Supabase independente confirmada pelo titular. A credencial administrativa disponível de outro produto não autoriza recursos AraRead naquela organização.

## Ambiente local

Versões testadas: Node 24.14.0, npm 11.9.0, Docker 29.8.2, PostgreSQL 17.11 e Supabase GoTrue 2.197.0. Dependências exatas estão no lockfile; use `npm ci`. No Windows, execute em PowerShell na raiz:

```powershell
npm ci
npm run local:setup
docker compose up -d --wait
npm run db:migrate
npm run local:accounts
npm run build
$env:NODE_ENV='production'
npm run dev
```

O setup cria `.env` a partir do exemplo e uma chave ES256 privada exclusivamente local, sem imprimir o segredo. O Compose usa esse material e cria banco e Auth reais. O primeiro boot do GoTrue aplica suas migrations. As migrations do aplicativo são aplicadas pelo comando separado, com checksum: editar uma migration já aplicada gera erro. Reexecutar não reimporta dados nem reseta o banco. As contas sintéticas são geradas em arquivo ignorado, nunca fixadas em código.

Acesso: `127.0.0.1:4317` (app/MCP), `4318` (Auth), `56432` (PostgreSQL). `4319` é HMR em desenvolvimento; `4316` é a prova temporária de reinício. A porta inicialmente considerada para Auth estava reservada pelo Windows, por isso foi escolhida `4318`. Não pare serviços irmãos. `npm run dev` sem `NODE_ENV=production` usa Vite; produção local serve o build e habilita service worker.

Para parar somente esta instância: encerre seu processo Node e execute `docker compose stop` nesta raiz. Não use `down -v` em dados úteis. Os volumes não são backups; faça exportação antes de alterações operacionais. Para atualizar, preserve `.env`, chaves e volume, faça backup, instale o lockfile, aplique novas migrations e reconstrua o build.

## Configuração hospedada necessária

A instalação hospedada usa Supabase Edge para API/MCP e o Site privado para a interface estática. O Node/container continua disponível para execução local. A adaptação mantém o mesmo domínio, PDF textual e proteção de URL; veja [decisões](decisoes.md). O projeto exclusivo Free já passou por gates HTTP, OAuth/MCP e interface reais. Nenhum serviço pago foi contratado. Os endereços vigentes estão no [checkpoint](../STATUS.md).

Antes de qualquer escrita remota, confira conta, organização, projeto novo/exclusivo, plano e políticas atuais. Não ative faturamento ou inscrições públicas, não migre para o projeto dos irmãos e não abra um diretório público de plugins. A [página de preços do Supabase](https://supabase.com/pricing), consultada em 23/10/2026, informa limites e pausa por inatividade no plano gratuito; eles podem mudar. Confirme novamente no provisionamento. Uma conta nova não autoriza contornar limites ou os [termos de uso aceitável](https://supabase.com/aup).

Provisionamento após a identidade estar confirmada:

1. Crie apenas o projeto AraRead gratuito e registre a identidade do destino sem credenciais na documentação operacional privada.
2. Provisione um papel PostgreSQL `araread_app LOGIN NOINHERIT`, sem `BYPASSRLS`, com associação a `authenticated` e senha exclusiva gerenciada como segredo. Use TLS com certificado validado na conexão; não use `rejectUnauthorized:false`. Não aplique `scripts/local-bootstrap.sql` ao hospedado.
3. Configure `MIGRATION_DATABASE_URL` por segredo de processo e `CONFIRMED_PROJECT_HOST` com o host exato do projeto exclusivo; execute `npm run db:migrate`. A conta de migration pode administrar schema; a aplicação não usa essa credencial.
4. Defina `araread_private.deployment.mcp_resource` com o endpoint HTTPS final, por parâmetro SQL protegido. Não deixe a audiência de loopback em produção.
5. No Auth, use assinatura assimétrica, ative o servidor OAuth e o cadastro de cliente compatível com o cliente real, configure site/redirects de consentimento para a origem final e habilite `araread_private.token_hook` como Custom Access Token Hook. Confira as [instruções oficiais atuais](https://supabase.com/docs/guides/auth/oauth-server). Desative cadastro público e provisione somente o titular/identidades de teste autorizadas. Não enfraqueça proteção do gateway.
6. Configure segredos/variáveis abaixo, publique o runtime e valide a cadeia completa no destino, com duas identidades sintéticas autorizadas.

| Variável | Destino hospedado |
|---|---|
| `APP_MODE` | `production` |
| `APP_NAME` | Nome centralizado, inicialmente AraRead |
| `APP_ORIGIN` | Origem HTTPS exata da interface, autorizada pelo CORS |
| `AUTH_URL` e `AUTH_ISSUER` | URL Auth real do projeto exclusivo, com `/auth/v1` |
| `AUTH_AUDIENCE` | `authenticated` para sessão web |
| `MCP_AUDIENCE` | Endpoint HTTPS exato `/mcp`, igual ao recurso no hook |
| `AUTH_PUBLISHABLE_KEY` | Chave publicável do projeto; nunca service role |
| `DATABASE_URL` | Papel mínimo de aplicação no projeto exclusivo, conexão TLS validada |
| `DATABASE_CA_CERT` | PEM público da CA confiável; validação TLS permanece obrigatória |
| `ARAREAD_RUNTIME` | `edge` no Supabase; cota 16 MiB, restauração HTTP 32 MiB, uma conexão e descarte ocioso em 1 s |
| `VITE_API_BASE` | URL base da API no build da interface estática separada |
| `PORT` | Porta interna do runtime, padrão 4317 |

`LOCAL_JWT_KEYS`, senhas do Compose e contas de teste locais não vão ao hospedado. Não exponha `araread`/`araread_private` na Data API. O proxy reverso precisa preservar Host final para a checagem de origem e encaminhar Streamable HTTP sem bufferização indevida. O backend usa o JWKS do provedor e valida audiência/identidade antes de acessar dados.

A prova híbrida Node usou o pooler de sessão. O Edge usa o pooler transacional na porta `6543`, com uma conexão por instância e descarte ocioso em 1 s: instâncias efêmeras esgotaram o limite de 15 conexões do modo de sessão em uma repetição do gate. As consultas `pg` não usam nomes de prepared statements; papel, identidade e configurações são `SET LOCAL` dentro da mesma transação. Confira o host real no painel, sem deduzi-lo da região. Ambos os modos usam TLS `verify-full` e CA pública em `certs/supabase-prod-ca-2021.crt`; no container, o caminho é `/app/certs/supabase-prod-ca-2021.crt`. A raiz veio do painel oficial, SHA-256 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Não desative a validação. Senhas ficam no gerenciador de segredos do runtime, nunca em migrations ou Git.

Render foi retirado por decisão do titular. A instalação não depende de outra conta de hospedagem Node. No Edge, `DATABASE_CA_CERT` recebe o PEM confiável pelo gerenciador de segredos, sem depender de caminho de arquivo; `db.ts` evita que parâmetros de URL substituam essa validação explícita. Nunca publique `.local` ou `.env`.

## Publicar a função e atualizar a interface

Após conferir identidade/organização/projeto exclusivos e configurar os segredos, execute `npx tsx scripts/prepare-edge.ts`. O pacote gerado fica em `.local/edge-release`, sem credenciais. Publique pela CLI Supabase 2.122.0, com `functions deploy araread --workdir .local/edge-release --project-ref <ref-confirmado>`, usando a autenticação legítima da conta independente. Preserve o projeto de destino em cada comando; não use `--prune`. O pacote aprovado tem cerca de 3 MB.

O adaptador verifica JWT ES256/RS256, emissor, audiência, sessão, cliente e permissão antes dos dados. `verify_jwt=false` desativa somente o verificador legado do gateway, necessário para descoberta OAuth pública e para os tokens assimétricos destinados ao recurso próprio; não habilita dados anônimos. Os gates comprovam 401 sem token, rejeição de audiência incorreta e revogação imediata. Veja [segurança](seguranca.md).

Para atualizar a interface existente, rode `npx tsx scripts/prepare-site.ts` e faça o build no checkout `.local/sites-araread` com o Vite do lockfile. `hosting/frontend.json` conserva a identidade e as URLs; não crie outro Site. A credencial de escrita vem do conector Sites e entra somente por stdin no helper oficial `site-workflow.mjs`. Ele sincroniza fonte e empacota o build; publique a revisão exata com a operação privada do conector. O Site conserva acesso do titular e o aplicativo continua exigindo sua sessão Supabase. A credencial de serviço usada na QA não é incluída no código ou no bundle.

## Artefato e gates externos

```powershell
docker build -t araread:local-0.1.0 .
```

A imagem contém app/build/dependências e roda como usuário `node`, sem `.env`, dados ou chaves locais. Um build bem-sucedido não demonstra implantação. Confira saúde, interface, migrações novas, originais privados, OAuth/PKCE pelo gateway, revogação, duas contas e escrita/retomada reais. Só depois execute a [prova no cliente externo](conectar-assistente.md). Na reversão, retorne o artefato compatível sem apagar banco; migrations com dados não são desfeitas automaticamente. Use backup e uma migration corretiva revisada quando necessário.
