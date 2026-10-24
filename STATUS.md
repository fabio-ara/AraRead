# Estado verificável

Checkpoint de 24/10/2026, Brasília. Raiz local `C:\Users\008031\Documents\AraRead`; [repositório privado](https://github.com/fabio-ara/AraRead).

| Nível | Estado | Evidência |
|---|---|---|
| Núcleo local | Implementado e validado | 32 testes e quatro jornadas web após a adaptação Edge; tipos, build, documentação e auditoria sem vulnerabilidades conhecidas |
| Auth/PostgreSQL hospedados | Projeto exclusivo Free na conta independente confirmada | Duas migrations com checksum, dez tabelas com RLS forçado, papel mínimo, TLS verificado, ES256, cadastro público fechado; sete verificações híbridas aprovadas |
| Aplicação hospedada | API/MCP Supabase e interface Sites privada publicados | Nove verificações HTTP reais, PDF/URL/RLS e 24 chamadas concorrentes; interface desktop/mobile e restauração de 17.085.827 bytes com hashes iguais |
| Cliente externo real | SDK oficial aprovado no HTTPS hospedado | OAuth/DCR/PKCE, 16 ferramentas/orientação, escrita, nova sessão, revogação e reconexão; seis verificações com conferência e escrita pela interface publicada |
| ChatGPT | Descoberta real aprovada; consentimento/jornada pendentes | Formulário identificou endpoints, DCR e recurso automaticamente; caixa pessoal de confiança não marcada |

Endereços: [interface privada](https://araread-biblioteca.stonyrain65.chatgpt.site), [MCP OAuth](https://ltzoontstgpbegtakrgk.supabase.co/functions/v1/araread/mcp). Local: `http://127.0.0.1:4317`, Auth `4318`, PostgreSQL `56432`; reinício temporário `4316`.

A revisão de implantação `af9ffd107b288f06ea458a03b85122f60203a09e` tem [CI final aprovada](https://github.com/fabio-ara/AraRead/actions/runs/40064353878), com banco/Auth novos, 32 testes do núcleo, quatro jornadas Playwright, tipos, build, documentação e auditoria sem vulnerabilidades conhecidas. O checkpoint posterior só registra esses resultados e os passos pessoais; não altera o código testado. Os relatórios privados ficam em `.local/evidence`; o [consolidado sem credenciais](docs/evidencias/2026-10-24.json) e a [matriz](docs/testes.md) distinguem execução híbrida, HTTPS, interface e cliente externo.

Supabase usa o projeto exclusivo AraRead, conta independente escolhida pelo titular, região São Paulo e plano Free. Conta/organização/projeto foram conferidos antes dos provisionamentos. Nada foi escrito em AraLearn/AraHub. OAuth remoto está habilitado, com audiência HTTPS final no hook e redirects da interface. Perfil Edge: conteúdo 16 MiB, restauração HTTP 32 MiB e originais até 8 MiB; Node mantém 80/128 MiB. Não houve cartão, faturamento, upgrade, cadastro público ou plugin público.

Render foi retirado conforme a escolha do titular. O transporte Edge usa Undici 7.30.1 com IP público validado e TLS vinculado ao hostname original; PDF.js é empacotado somente com os módulos necessários. O pacote de 3 MB passou no Edge real 1.77.7/Deno 2.1.4. Uma repetição revelou o limite de 15 conexões do pooler de sessão; a instalação passou ao modo transacional, uma conexão por instância e descarte ocioso em 1 s. Nove verificações HTTP, seis MCP/UI e quatro de restauração foram repetidas e aprovadas nessa configuração. As duas funções temporárias de diagnóstico foram removidas; somente `araread` permanece ativa. A imagem Docker iniciou com banco real, HTML, CA empacotada, porta `4321` e healthcheck aprovado; o container temporário foi removido.

O gate HTTP final usa identidades sintéticas e as remove. O MCP remove também o cliente OAuth de teste. A interface confirmou a mediação escrita pelo MCP, gravou nota/continuidade e outra sessão MCP releu ambas. A credencial oficial de serviço Sites foi enviada somente no cabeçalho para o próprio Site, fora do código da página, sem fornecer identidade de leitor. O teste hospedado bloqueou service workers; a prova de offline/SW vem dos quatro E2E locais. Screenshots nativas desktop/mobile e de definição de senha foram inspecionadas.

Fonte extensa: 10 mil elementos, original de 2.878.895 bytes, página final com 50 elementos/21.351 bytes; última medição local em 30 ms. Backup hospedado de 17.085.827 bytes restaurado entre duas contas com novos IDs, recibo e bytes originais conferidos. São medições dessa execução, sem garantia de desempenho do plano gratuito.

Intervenção pessoal restante: convite único da biblioteca enviado ao e-mail escolhido pelo titular, sem senha definida pelo agente. A conta do painel Supabase e a identidade de leitor são distintas. Para usar o Site, concluir o login privado com a conta ChatGPT proprietária, abrir o convite e definir a senha. Para testar o MCP no ChatGPT, concluir a caixa de confiança e a autorização OAuth. O §2 do mandato reserva identidade e consentimentos ao titular. A infraestrutura e os formulários estão prontos; não se declara homologação no ChatGPT antes dessa jornada. Não enviar senha, token ou link de login no chat.

Limites: OCR, EPUB/DOCX, interpretação automática de imagens, sincronização de escrita offline e geração interna não implementados. PDF exige conferência. As amostras editoriais são sintéticas e foram avaliadas por IA, sem revisão humana ou eficácia pedagógica demonstrada. [Capacidades e decisões](docs/decisoes.md).

Navegador: preservar a edição não salva do eXeLearning por decisão expressa do titular. Abas de Moodle, Render, previews e configurações concluídas foram fechadas. Restam as duas telas pessoais de entrada/MCP e caixas de e-mail já abertas. Não efetuar downloads pela interface. Credenciais/helpers de provisionamento ficam apenas em `.local`, ignorado pelo Git. Próximo passo: intervenção pessoal acima; depois, executar a jornada ChatGPT descrita no guia, sem repetir os gates já válidos.
