# AraRead

Um ambiente para preparar edições de estudo e ler obras difíceis, com **Leitura facilitada | Tradução | Original**. O assistente conectado produz e revisa o material; a edição publicada pode ser estudada pelo site, sem ChatGPT, MCP ou chamadas generativas. Fonte, edição e estado pessoal do leitor têm identidades e permissões distintas.

A evolução 0.5 em desenvolvimento acrescenta autoria em quatro etapas, configurações compartilhadas entre web e MCP, fontes canônicas reutilizadas, apoios preparados, atividades opcionais, grupos privados por convite e capítulos completos offline. Leituras pessoais anteriores continuam acessíveis. A tradução não adota perfis interpretativos; verificações automáticas não certificam compreensão nem fidelidade acadêmica. Todas as telas mantêm largura máxima de 480 px.

Veja o [guia de autoria e leitura](docs/guia-uso.md), a [arquitetura](docs/arquitetura.md) e os [formatos de entrada](docs/fontes-formatos.md). A [evolução 0.4](docs/leitura-0.4.md) documenta a continuidade das leituras pessoais anteriores.

**Publicada: 0.4.0. A evolução 0.5 ainda não foi publicada.** O [STATUS](STATUS.md) distingue implementação, testes locais, prova hospedada e limitações. O destino existente é o [GitHub Pages](https://fabio-ara.github.io/AraRead/), com API/Auth/[MCP OAuth](https://ltzoontstgpbegtakrgk.supabase.co/functions/v1/araread/mcp) no Supabase exclusivo Free. Não há chave de modelo, cadastro público nem descoberta de bibliotecas pessoais alheias.

## Usar localmente

Requer Node 24.14 ou superior e Docker com Compose. Execute na raiz deste repositório, sem reutilizar bancos, contas ou configurações dos produtos irmãos:

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

Abra **http://127.0.0.1:4317**. Para uso pessoal local, preencha e-mail e uma senha exclusiva de teste e use “Criar conta local de teste”. As duas identidades geradas pelo comando são exclusivamente sintéticas para a suíte; suas credenciais ficam em `.local/test-accounts.json`, ignorado pelo Git. Não use senhas reais de outros serviços nesse ambiente de desenvolvimento.

Para autoria, diga ao assistente: “Prepare uma edição a partir destas fontes; consulte a configuração do projeto e apresente uma amostra antes do lote”. Para estudar, abra uma edição no site e use índice, apoios, notas e retomada. A página também configura a autoria e registra aprovação, revisão e publicação. No chat, somente `reading_display` anuncia o painel pronto; sem MCP Apps, há uma apresentação textual equivalente.

## Verificar e conhecer

```powershell
npm run check
npm test
npm run test:e2e
npm run docs:check
npm run audit:public
npm run build
npm audit --audit-level=moderate
```

O servidor e o banco locais devem estar ativos para as integrações; o teste de navegador usa Chrome instalado. A CI usa Chromium e WebKit. Para WebKit local, instale-o com `npx playwright install webkit` e defina `PLAYWRIGHT_BROWSER=webkit`. As evidências e limites de cada prova estão na [matriz de testes](docs/testes.md).

- [Mapa da documentação](docs/README.md): uso, operação e desenvolvimento.
- [Guia de leitura](docs/guia-uso.md) e [fontes e formatos](docs/fontes-formatos.md).
- [Conexão do assistente](docs/conectar-assistente.md) e [contrato MCP](docs/contrato-mcp.md).
- [Instalação e implantação](docs/instalacao.md), [segurança](docs/seguranca.md) e [recuperação](docs/operacao.md).

Código sob [licença MIT](LICENSE). A licença do aplicativo não concede direitos sobre obras importadas. Veja os [avisos de terceiros](THIRD_PARTY_NOTICES.md).
