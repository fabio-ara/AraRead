# Alterações

## 0.4.0 — 27/10/2026 (validação em andamento)

- Passagens respeitam parágrafos e fronteiras estruturais; referências legadas continuam válidas, com reparo explícito que conserva progresso e histórico.
- Seleção nativa e grifos nas três representações, com versão, segmento, pontos de código, confirmação, recuperação offline e backup compatível.
- Vocabulário distingue ocorrência, definição geral e fonte; calculadora científica e datas civis compartilham execução determinística.
- Painel compartilhado web/MCP, SDK oficial de capacidades e recuperação de resposta perdida. Migration aditiva em notas.
- Estado efetivo de publicação e gates em [STATUS](STATUS.md); comportamento e limites em [Leitura 0.4](docs/leitura-0.4.md).

## 0.3.0 — 24/10/2026

- Ingestão HTML/PDF com pré-verificação, reconstrução posicional, lacunas explícitas e adaptador OCR local aberto. Armazenamento textual canônico, retenção excepcional e deduplicação privada.
- Leitor com três abas, preparação sem painel e apresentação final por `reading_display`. Chat controla navegação, memória e preferências.
- Confronto editorial, mapa/progresso, continuidade fora do percurso principal, catálogo de preferências e perfis versionados com pacotes opt-in.
- Três migrations novas, 19 tabelas com RLS e backup v3 compatível com v1/v2. Oito achados de revisão independente corrigidos; 78 testes do núcleo, sete jornadas web e gates hospedados/ChatGPT real aprovados. Provas e limites em [STATUS](STATUS.md).

## 0.2.0 — 24/10/2026

- Interface GitHub Pages independente do ChatGPT; identidade visual Ara e coluna de celular de até 480 px em todas as telas.
- Original, tradução e reescrita distintos; perspectivas versionadas, variantes históricas, contexto limitado e bibliografia/consulta rastreáveis.
- Vocabulário contextual e consulta pública opcional; notas selecionáveis, exclusão de derivações, relações entre obras e cadernos seletivos privados.
- Envios parciais na mesma leitura; preparo offline limitado e fila com recibos, conflitos e recuperação antes de sair.
- Backup v2 consistente de quinze seções, restauração v1 e migration de dados antigos. Painel opcional MCP Apps e 27 ferramentas no mesmo domínio.
- Auditoria pública de histórico/artefatos e matriz F01–F10 em [evolução](docs/evolucao.md). Código MIT público, Pages e runtime 0.2.0 publicados; gates locais, hospedados e ChatGPT real concluídos no [checkpoint](STATUS.md).

## 0.1.0 — 23/10/2026

- Biblioteca privada, importação TXT/Markdown/HTML/PDF textual e página HTTPS pública, original imutável e versões vinculadas.
- Leitor responsivo com idioma temporário e persistente, notas, marcas voluntárias, histórico, glossário, retomada e cobertura explícita por intervalos.
- PostgreSQL com RLS, Supabase Auth real, OAuth PKCE e revogação consultada por operação; casos de uso compartilhados por interface e MCP.
- Streamable HTTP com SDK oficial, contratos, recurso/prompt/orientação versionada e recibos para operações incertas.
- Exportação/restauração com mapa de IDs, cache privado da última leitura e rascunhos offline.
- Suítes reais, fixtures editoriais sintéticas, imagem Docker, CI e documentação de implantação e limites.

## Implantação 0.1.0 (histórica) — 24/10/2026

- API e MCP publicados no Supabase Edge do projeto exclusivo; frontend estático privado no Sites, sem Render.
- Adaptador HTTP Web com a mesma autorização/domínio do Node; TLS para IP público fixado, PDF.js empacotado em 3 MB e CA PostgreSQL verificada.
- OAuth/PKCE, cliente externo oficial, interface hospedada desktop/celular e restauração de 17 MB comprovados no destino real.
- Recuperação/definição de senha testada com GoTrue real; quatro jornadas E2E locais.
- Documentação dos perfis de memória e implantação reproduzível. Veja [STATUS](STATUS.md).

## Homologação 0.1.0 no ChatGPT (histórica) — 24/10/2026

- Titular concluiu senha da biblioteca, confiança no plugin pessoal e consentimento OAuth.
- ChatGPT carregou a orientação 1.0.0, importou fonte sintética, salvou reescrita, pergunta/resposta e glossário, conferiu recibos e avançou somente após pedido explícito.
- Nova conversa recuperou revisão, idioma, retomada e registros anteriores sem regeneração ou escrita; interface autenticada confirmou os dados.
- Leitor hospedado recarregou shell, porção e rascunho sob bloqueio de rede. Limites da emulação estão na [matriz de testes](docs/testes.md).
- Fixture removida com recibo e confirmação independente na biblioteca; conexão pessoal preservada.
