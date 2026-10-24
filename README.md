# AraRead

Um ambiente pessoal para estudar obras difíceis pelo chat. Peça uma leitura, acompanhe a passagem nas abas **Leitura facilitada | Tradução | Original** e converse para entender conceitos, consultar fontes, escolher outra seção ou retomar o estudo. O AraRead conserva obras, versões, notas, progresso e preferências explícitas. A IA continua no assistente conectado, sem chave de modelo no backend.

A evolução 0.3 acrescenta ingestão editorial validada, armazenamento textual, OCR local aberto, navegação conversacional e perfis reutilizáveis. A tradução permanece fiel ao original e separada de lentes interpretativas. A primeira explicação deve construir os conhecimentos necessários à passagem; verificações automáticas não certificam compreensão nem fidelidade acadêmica universal. Todas as telas mantêm largura máxima de 480 px.

**Disponível: 0.3.0, validada também no ChatGPT real.** Veja [STATUS](STATUS.md) para revisões, testes locais/hospedados, evidências e limites. O destino existente é o [GitHub Pages](https://fabio-ara.github.io/AraRead/), com API/Auth/[MCP OAuth](https://ltzoontstgpbegtakrgk.supabase.co/functions/v1/araread/mcp) no Supabase exclusivo Free. Não há serviços pagos, cadastro público nem descoberta de bibliotecas alheias. Conheça o [comportamento da 0.3](docs/leitura-0.3.md).

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

Diga ao assistente: “Quero estudar este artigo”, “Explique o problema antes dos termos”, “Mostre o mapa da obra” ou “Retome meu percurso principal”. O chat prepara e guarda as representações antes de apresentar um único painel. A página web oferece autenticação, visualização e recuperação técnica; os controles de estudo ficam no chat. Sem MCP Apps, o assistente apresenta o conteúdo em texto.

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

O servidor e o banco locais devem estar ativos para as integrações; o teste de navegador usa Chrome instalado. A CI usa Chromium. As evidências e limites de cada prova estão na [matriz de testes](docs/testes.md).

- [Mapa da documentação](docs/README.md): uso, operação e desenvolvimento.
- [Guia de leitura](docs/guia-uso.md) e [fontes e formatos](docs/fontes-formatos.md).
- [Conexão do assistente](docs/conectar-assistente.md) e [contrato MCP](docs/contrato-mcp.md).
- [Instalação e implantação](docs/instalacao.md), [segurança](docs/seguranca.md) e [recuperação](docs/operacao.md).

Código sob [licença MIT](LICENSE). A licença do aplicativo não concede direitos sobre obras importadas. Veja os [avisos de terceiros](THIRD_PARTY_NOTICES.md).
