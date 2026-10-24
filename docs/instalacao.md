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

O artefato atual é Node/container, com frontend estático e conexão PostgreSQL. A hipótese de Edge Functions não foi homologada: esta versão foi testada no runtime Node, incluindo obtenção HTTPS com DNS fixado e extração PDF. Publicar só o frontend não cria backend ou MCP. Será necessário um runtime Node com HTTPS e acesso ao banco exclusivo; não foi contratado nem anunciado um serviço pago.

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
| `APP_ORIGIN` | Origem HTTPS final do aplicativo/backend |
| `AUTH_URL` e `AUTH_ISSUER` | URL Auth real do projeto exclusivo, com `/auth/v1` |
| `AUTH_AUDIENCE` | `authenticated` para sessão web |
| `MCP_AUDIENCE` | Endpoint HTTPS exato `/mcp`, igual ao recurso no hook |
| `AUTH_PUBLISHABLE_KEY` | Chave publicável do projeto; nunca service role |
| `DATABASE_URL` | Papel mínimo de aplicação no projeto exclusivo, conexão TLS validada |
| `PORT` | Porta interna do runtime, padrão 4317 |

`LOCAL_JWT_KEYS`, senhas do Compose e contas de teste locais não vão ao hospedado. Não exponha `araread`/`araread_private` na Data API. O proxy reverso precisa preservar Host final para a checagem de origem e encaminhar Streamable HTTP sem bufferização indevida. O backend usa o JWKS do provedor e valida audiência/identidade antes de acessar dados.

## Artefato e gates externos

```powershell
docker build -t araread:local-0.1.0 .
```

A imagem contém app/build/dependências e roda como usuário `node`, sem `.env`, dados ou chaves locais. Um build bem-sucedido não demonstra implantação. Confira saúde, interface, migrações novas, originais privados, OAuth/PKCE pelo gateway, revogação, duas contas e escrita/retomada reais. Só depois execute a [prova no cliente externo](conectar-assistente.md). Na reversão, retorne o artefato compatível sem apagar banco; migrations com dados não são desfeitas automaticamente. Use backup e uma migration corretiva revisada quando necessário.
