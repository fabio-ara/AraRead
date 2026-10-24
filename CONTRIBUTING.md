# Contribuir

Comece pelo [modelo de leitura](docs/produto.md), [arquitetura](docs/arquitetura.md) e [AGENTS](AGENTS.md). Use Node e versões do lockfile. Execute a [instalação isolada](docs/instalacao.md) e o [gate](docs/testes.md). Não acrescente uma dependência ou serviço sem consumidor atual e justificativa.

Uma alteração precisa explicar o comportamento antes/depois, efeito sobre referências e dados, testes afetados e limitações reais. Para migrations, preserve histórico, teste banco vazio e atualização com dados. Para UI, inspecione celular e desktop. Para MCP, confira schemas, metadados de efeitos, autenticação e cliente oficial. Atualize documentação e changelog no mesmo incremento.

Use fixtures sintéticas ou material com autorização identificável. Não envie biblioteca pessoal ou segredos em issues, PRs ou screenshots. Não confunda avaliação editorial por IA com validação humana. Não rode a suíte local contra recursos hospedados.
