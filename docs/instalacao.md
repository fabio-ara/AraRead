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

A instalação hospedada usa Supabase Edge para API/MCP e GitHub Pages para a interface estática. O Node/container continua disponível para execução local. A adaptação mantém o mesmo domínio, PDF textual e proteção de URL; veja [decisões](decisoes.md). O projeto exclusivo Free já passou por gates HTTP, OAuth/MCP e interface reais. Nenhum serviço pago foi contratado. Os endereços vigentes estão no [checkpoint](../STATUS.md).

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

Após conferir identidade/organização/projeto exclusivos e configurar os segredos, execute `npx tsx scripts/prepare-edge.ts`. O pacote gerado fica em `.local/edge-release`, sem credenciais. Publique pela CLI Supabase 2.122.0, com `functions deploy araread --workdir .local/edge-release --project-ref <ref-confirmado>`, usando a autenticação legítima da conta independente. Preserve o projeto de destino em cada comando; não use `--prune`. O tamanho e a compatibilidade de cada pacote precisam ser conferidos no gate da revisão corrente.

O adaptador verifica JWT ES256/RS256, emissor, audiência, sessão, cliente e permissão antes dos dados. `verify_jwt=false` desativa somente o verificador legado do gateway, necessário para descoberta OAuth pública e para os tokens assimétricos destinados ao recurso próprio; não libera dados privados. Os endpoints editoriais públicos usam apenas o conteúdo explicitamente publicado, com RLS e papel anônimo em transação de leitura. Os gates comprovam 401 sem token, rejeição de audiência incorreta e revogação imediata. Veja [segurança](seguranca.md).

Para publicar a interface, configure a variável do repositório `ARAREAD_API_BASE` com a URL pública da função exclusiva. O workflow `.github/workflows/pages.yml` compila com `ARAREAD_BASE_PATH=/AraRead/` e `VITE_API_BASE`, publica somente `dist` e exige CI aprovada para a revisão exata de `main`. Ative Pages com origem GitHub Actions depois da auditoria/autorização pública. Uma execução privada não torna a biblioteca pública nem é prova de publicação. Para forks, ajuste o caminho do projeto no workflow e as URLs Auth/CORS; não copie destinos do titular. O antigo `prepare-site.ts` foi retirado. O Site anterior agora contém somente uma página de encaminhamento ao Pages e conserva sua audiência privada; não é mais o frontend do produto.

## Artefato e gates externos

```powershell
docker build -t araread:local-0.5.0 .
```

A imagem contém app/build/dependências e roda como usuário `node`, sem `.env`, dados ou chaves locais. Um build bem-sucedido não demonstra implantação. Confira saúde, interface, migrações novas, originais privados, OAuth/PKCE pelo gateway, revogação, duas contas e escrita/retomada reais. Só depois execute a [prova no cliente externo](conectar-assistente.md). Na reversão, retorne o artefato compatível sem apagar banco; migrations com dados não são desfeitas automaticamente. Use backup e uma migration corretiva revisada quando necessário.

## Caminho Pages e evolução

`hosting/frontend.json` identifica URL completa, origem (sem caminho), base path e API. `APP_ORIGIN` recebe só a origem CORS; o Auth recebe a URL da interface e redirect exato no caminho do projeto. A página de consentimento usa o mesmo aplicativo com `authorization_id` na query, sem depender de rota SPA inexistente. Confira o redirecionamento real pelo SDK após qualquer alteração do Auth. Conserve consentimentos existentes; mudar frontend não exige apagar contas/concessões. Nesta instalação: site_url e redirect permitido são https://fabio-ara.github.io/AraRead/; APP_ORIGIN é https://fabio-ara.github.io; oauth_server_authorization_path é /, que o provedor combina com o site_url. Não use /AraRead/ novamente como authorization_path, pois duplicaria o caminho. O SDK hospedado comprovou o redirecionamento e o consentimento reais.

A terceira migration acrescenta seis tabelas com RLS forçado e preenche o segmento raiz de leituras existentes. Não reescreva os checksums anteriores. O gate cria banco temporário com dados anteriores à evolução e verifica posição, histórico e vínculos após as três migrations. Faça backup consistente antes de aplicar no destino confirmado. A 0.3 acrescenta três migrations: ingestão/mapas, perfis/preferências e propriedade das referências de preferência. O empacotador Edge copia recursivamente `src/study` e `src/ingestion`; publicar só os arquivos da raiz é incompleto.

## OCR local opcional

O servidor e o Edge não executam OCR. Para PDF digitalizado autorizado, construa o adaptador aberto e produza um payload fora da interface. O diretório de saída deve ser privado, novo e gravável pelo UID 65534; o comando recusa sobrescrever um arquivo.

```powershell
docker build -f Dockerfile.ocr -t araread-ocr:local .
New-Item -ItemType Directory -Force .local/ocr
$ocrInput = (Resolve-Path tests/fixtures).Path
$ocrOutput = (Resolve-Path .local/ocr).Path
docker run --rm --network none --memory 512m --cpus 1 --pids-limit 64 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m -v "${ocrInput}:/input:ro" -v "${ocrOutput}:/output" araread-ocr:local /input/synthetic-scanned.pdf /output/scanned-import.json --language eng
node --import tsx --env-file-if-exists=.env scripts/verify-ingestion-v3.ts .local/ocr/scanned-import.json
```

O último comando usa somente as identidades sintéticas locais. Para material pessoal, encaminhe o payload por API/conector autorizado, acrescente título/idioma e confira `source_preview` antes de importar; não publique esse JSON, que inclui o PDF. Também é possível executar `python scripts/ocr-pdf.py entrada.pdf novo-payload.json --language por+eng` com Poppler/Tesseract instalados, sob os mesmos limites de recursos. Confira os [avisos dos componentes](../THIRD_PARTY_NOTICES.md).

A CI testa o container sem rede e a ingestão real do OCR; o site Stanford é prova pontual explícita, não dependência permanente da suíte. O gerador das três fixtures PDF usa ReportLab/Pillow/MuPDF somente no preparo de material sintético, fora do runtime e do Edge.

## Conversão local de DOC e MOBI

DOCX, PPTX e EPUB são importados diretamente pelo backend. DOC e MOBI exigem preparação local com os conversores abertos LibreOffice e calibre. Não forneça documentos cifrados nem tente remover DRM. O payload resultante passa por `source_preview` antes de `source_import`.

```powershell
docker build -f Dockerfile.convert -t araread-convert:1 .
node --import tsx scripts/convert-legacy.ts entrada.doc .local/preparado-doc.json
node --import tsx scripts/convert-legacy.ts entrada.mobi .local/preparado-mobi.json
```

O script recusa sobrescrita e entrada acima do limite, monta a entrada somente para leitura, bloqueia rede e executa como usuário sem privilégios, com CPU, memória, processos, tempo e armazenamento temporário limitados. Conserva os bytes da entrada e a proveniência da conversão. A instalação das ferramentas exige espaço de disco adicional; não limpe nem reinicie serviços compartilhados de outros projetos para concluir o build. A CI gera documentos sintéticos reais e executa `scripts/verify-legacy-conversion.ts`; um script escrito não comprova conversão até esse gate passar.

## Evolução editorial 0.5

Aplique as migrations `20261028202053_study_editions_v5.sql` e `20261028211325_edition_restore_archive.sql`, nesta ordem, preservando todas as anteriores. Elas acrescentam treze tabelas editoriais com RLS forçado e proteções de referências; o total passa a 32. O pacote Edge deve incluir `src/editions` além de `src/study` e `src/ingestion`. Confira backup v4, os formatos anteriores, duas contas, leitura pública autorizada e revogação de convite antes de publicar. A interface e o MCP usam os mesmos casos de uso; publicação está condicionada ao gate da revisão exata.
