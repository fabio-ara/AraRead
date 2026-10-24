# AraRead

Uma biblioteca pessoal para ler obras difíceis em períodos curtos, na ordem do original, guardar explicações e retomar em outra sessão. A aplicação conserva o material e o estado; o assistente conectado faz a reescrita e responde às perguntas. O núcleo funciona sem chave de modelo.

A versão 0.2.0 acrescenta perspectivas versionadas, vocabulário contextual, fontes bibliográficas, variantes comparáveis, cadernos privados e continuidade de envios na mesma leitura. Todas as telas mantêm uma coluna de celular, com largura máxima de 480 px inclusive no desktop, seguindo a identidade visual Ara. O original e a reescrita/tradução compartilham a mesma referência; consultar, comparar ou perguntar não marca progresso.

**Disponível em 24/10/2026:** abra o [AraRead no GitHub Pages](https://fabio-ara.github.io/AraRead/) e entre com sua conta de leitor. API, autenticação e [MCP OAuth](https://ltzoontstgpbegtakrgk.supabase.co/functions/v1/araread/mcp) usam o projeto Supabase exclusivo Free. O [repositório público](https://github.com/fabio-ara/AraRead) e a documentação própria estão sob MIT, após auditoria do histórico e do artefato. As provas locais, hospedadas e no ChatGPT real constam no [estado verificável](STATUS.md). A interface web funciona independentemente do ChatGPT; o painel MCP Apps é opcional e depende de suporte do cliente. Veja a [evolução e matriz F01–F10](docs/evolucao.md).

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

Cole um trecho em “Importar”, abra o original e guarde perguntas. Quando houver um assistente conectado, ele pode consultar a passagem e salvar uma mediação. “Continuar” confirma apenas a porção apresentada. “Voltar” conserva a retomada principal. Não há geração automática interna nem respostas fictícias apresentadas como IA.

## Verificar e conhecer

```powershell
npm run check
npm test
npm run test:e2e
npm run docs:check
npm audit --audit-level=moderate
```

O servidor e o banco locais devem estar ativos para as integrações; o teste de navegador usa Chrome instalado. A CI usa Chromium. As evidências e limites de cada prova estão na [matriz de testes](docs/testes.md).

- [Mapa da documentação](docs/README.md): uso, operação e desenvolvimento.
- [Guia de leitura](docs/guia-uso.md) e [fontes e formatos](docs/fontes-formatos.md).
- [Conexão do assistente](docs/conectar-assistente.md) e [contrato MCP](docs/contrato-mcp.md).
- [Instalação e implantação](docs/instalacao.md), [segurança](docs/seguranca.md) e [recuperação](docs/operacao.md).

Código sob [licença MIT](LICENSE). A licença do aplicativo não concede direitos sobre obras importadas. Veja os [avisos de terceiros](THIRD_PARTY_NOTICES.md).
