# Relatar e corrigir vulnerabilidades

Relate pelo canal privado do proprietário ou pela função privada de security advisory do repositório, quando habilitada. Não publique obras, tokens, senhas, URLs de login, cookies ou cópias de banco para demonstrar a falha. Inclua versão, caminho afetado, passos com contas sintéticas e impacto observado.

Esta primeira versão recebeu provas locais de autorização, isolamento e entradas maliciosas; não recebeu auditoria independente nem validação hospedada. O papel de aplicação não é administrador, mas o backend é parte da fronteira de confiança. Comprometimento desse runtime exige rotação de credenciais e investigação; RLS não protege contra um servidor autorizado que deliberadamente falsifique a identidade interna.

Consulte [segurança e privacidade](docs/seguranca.md) para ameaças, sessões, cache, limites e resposta a incidentes. Após uma correção, repita os testes afetados e mantenha a distinção entre evidência local e externa.
