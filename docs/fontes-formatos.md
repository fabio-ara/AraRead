# Fontes, edições e formatos

Uma importação conserva texto canônico, estrutura, hash canônico e SHA-256 dos bytes adquiridos, origem informada ou URL, data de captura, título, autoria, edição/tradução, idioma, situação parcial e gêneros. Dados desconhecidos ficam vazios ou `und`; não são inferidos como fatos. Os hashes identificam conteúdo, sem comprovar autoria ou licença. `original_available` indica se os bytes foram conservados; novas fontes textuais dispensam bruto quando a extração é utilizável e não perde informação visual.

| Entrada | Representação entregue | Limites declarados |
|---|---|---|
| Texto colado / TXT UTF-8 | Parágrafos em ordem, separados por linhas vazias | Não reconhece automaticamente versos, provas ou estrutura canônica |
| Markdown | Títulos, parágrafos, listas, citações, notas, blocos de código, equação entre linhas `$$`, tabela com barras e figura com descrição | Subconjunto documentado; não é interpretador completo de CommonMark; sintaxe inline fica textual |
| HTML fornecido | Texto de títulos, parágrafos, listas, citações, notas, tabela e descrições de figuras | Scripts, anexos e interação não executados; SVG/MathML viram texto original com interpretação pendente; não reproduz layout |
| URL HTTPS pública | Obtém uma única página HTML e aplica o importador HTML | Sem login, cookies, paywall, páginas internas ou coleções; respeita bloqueios identificados em robots.txt |
| PDF com camada textual | Reconstrução posicional de parágrafos, títulos, colunas, notas e linhas de tabela, com página autêntica | Ordem e estrutura heurísticas, sujeitas a conferência; figuras não interpretadas; até 500 páginas e 15 s de extração |
| Blocos estruturados via MCP/API | Tipos e metadados fornecidos, incluindo versos, hipóteses, definições e provas | A estrutura é fornecida pelo remetente; tipos desconhecidos permanecem conservados, sem interpretação inventada |

EPUB e DOCX não estão implementados. PDF digitalizado recebe lacunas; a pré-verificação rejeita fonte inteiramente sem texto até receber transcrição ou suplemento do OCR local Poppler/Tesseract. O OCR não executa no Edge e permanece não revisado, com retenção obrigatória do PDF. Quando disponível, o binário original pode ser obtido pela API autenticada `/api/original/:source_id` ou pelo backup com originais. Ele é servido como bytes de anexo, nunca executado como HTML.

## Referências e correções

Uma referência é `{source_id, element_id, start, end}`. UUIDs identificam versão e elemento; `start` e `end` contam pontos de código Unicode, com início incluso e fim exclusivo. Não são offsets UTF-16 do JavaScript, bytes, posição de scroll ou número de página. O locador legível, como “página 2”, complementa a identidade, sem substituí-la.

Quando retido, o original binário é íntegro, mas a representação extraída pode normalizar espaços, remover markup ou separar blocos. Os offsets sempre se referem ao texto do elemento armazenado, não diretamente ao arquivo PDF/HTML. A ordem e a fidelidade dessa representação exigem conferência. Fórmulas, tabelas, provas e código são atômicos para paginação; um bloco acima de 100 mil caracteres deve ser fornecido em partes com sentido e relação explícita. A fonte aceita até 20 mil elementos.

Correções e material adicional usam `source_import` com `work_id` e `derives_from` da versão anterior. Isso conserva uma cadeia identificável da mesma obra, sem alterar a leitura anterior ou transferir marcas para um texto diferente. Forneça página/região em `locator` ou no próprio texto da transcrição. Não há alinhamento automático entre edições nem soma de cobertura entre versões.

## Direitos e obtenção pública

A biblioteca e as adaptações permanecem privadas. A licença do código não autoriza reproduzir obras de terceiros. O usuário deve ter direito de fornecer o material. A obtenção de uma página acessível não dispensa considerar seus termos; robots.txt não determina sozinho todos os direitos. O importador não autentica em sites, não interpreta links de anexos e não segue imagens.

URLs exigem HTTPS sem credenciais na porta padrão. Cada salto valida resolução DNS pública, fixa o endereço validado na conexão TLS e rejeita redes privadas/reservadas, inclusive IPv6 mapeado. Há limite de 8 MiB, dez segundos para a obtenção, três redirecionamentos e tipo HTML. A política pode rejeitar fontes legítimas; nesses casos, forneça texto autorizado em vez de enfraquecer o controle.

## Pré-verificação e OCR

`source_preview` é leitura sem persistência. Informa estado, estrutura, caracteres úteis, lacunas, avisos e necessidade de original. `source_import` repete a validação antes de gravar. HTML preserva preâmbulo, bibliografia e notas mesmo quando o corpo longo tem maior densidade textual. Prosa não mantém quebras artificiais; versos/código conservam linhas semânticas.

O preparo local está em [instalação](instalacao.md). O suplemento só preenche páginas originalmente sem texto, valida SHA-256, registra confiança e regiões, e nunca certifica uma equação por contagem de caracteres. Extração insuficiente exige correção versionada. `retain_original:true` permite retenção adicional explícita. Fontes antigas não são descartadas na migração.
