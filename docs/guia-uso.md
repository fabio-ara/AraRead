# Usar a biblioteca

Entre na sua instância e importe material próprio ou autorizado. O ambiente local permite criar uma identidade exclusiva de teste; o ambiente hospedado deve manter inscrições públicas desativadas e provisionar o titular pelo fluxo legítimo do provedor.

Na interface GitHub Pages, entre diretamente com sua conta de leitor Supabase. Não é necessário entrar no ChatGPT para abrir o aplicativo. O login administrativo Supabase, a identidade de leitura e a autorização de um cliente MCP são operações distintas.

Se recebeu um convite ou link de recuperação, abra-o pessoalmente e use “Definir sua senha”. Escolha uma senha exclusiva de pelo menos 12 caracteres, confirme e guarde-a no seu gerenciador de senhas. Não envie a senha nem o link ao assistente. Para recuperar o acesso, preencha o e-mail no login e escolha “Esqueci minha senha”; a mensagem não revela se a conta existe. Dentro da biblioteca, Configurações oferece “Definir ou alterar minha senha”. O envio de e-mail depende da configuração e das quotas do provedor da instância.

## Importar e conferir

Em “Importar”, informe título, autoria e edição quando conhecidas, idioma do original e se o material é parcial. Cole o texto, escolha um arquivo ou informe uma página HTML pública HTTPS. O limite é 8 MiB por original. Não invente metadados ausentes. A aplicação conserva o original antes de abrir a representação extraída.

No leitor, use “Original”, “Índice” e “Sobre esta fonte” para conferir conteúdo, avisos e versão. A extração de PDF pode perder fórmulas, ordem de colunas, tabelas e imagens. Uma página vazia de texto extraível continua identificada como lacuna. Forneça uma transcrição autorizada e indique no texto página/região. “Fornecer nova versão ou transcrição” vincula a nova versão à anterior e cria uma leitura nova, conservando notas e progresso anteriores. Para a próxima passagem da mesma edição parcial, use “Acrescentar a próxima passagem” no painel de estudo: o envio entra como segmento imutável no fim da mesma leitura, sem marcar conteúdo novo nem alterar referências antigas. Uma transcrição corrigida ou outra edição continua sendo uma versão/leitura distinta.

## Ler e guardar

A aba “Leitura assistida” recupera a explicação já salva no idioma escolhido. Se não houver uma, isso é informado; o aplicativo não simula geração. Conecte o assistente pelas instruções em Configurações. Peça que ele carregue a orientação, consulte o contexto, produza a reescrita fiel, salve e confira o recibo.

“Continuar” confirma a porção apresentada como percorrida e abre a próxima. “Voltar” ou o índice permitem rever; a retomada principal fica conservada. O aviso de revisão oferece “Retomar de onde parei”. No fim da fonte parcial, a aplicação pede mais material; não completa a obra por memória.

Escreva em “Sua anotação” e escolha anotação ou pergunta. Guardar não avança. O assistente pode responder e salvar a resposta vinculada à pergunta; o aplicativo só conhece conteúdo enviado ao serviço, sem acesso automático ao histórico completo do chat. Notas mostram origem do usuário ou assistente. As marcas pessoais são voluntárias; guardar uma explicação não marca compreensão.

Consulte glossário, histórico de explicações e todas as notas nos controles do leitor. Uma regeneração explícita conserva a versão anterior no histórico. Não há edição silenciosa das explicações estudadas.

## Idioma e interrupções

O seletor no leitor afeta apenas a consulta atual. “Guardar idioma nesta leitura” torna essa escolha persistente. Configurações guarda o padrão da conta e o tamanho das porções. A prioridade é escolha da operação, preferência da leitura e padrão da conta, inicialmente `pt-BR`. “Outro idioma” aceita identificador BCP 47 válido. Trocar idioma não apaga versões, notas ou progresso; explicações salvas em outro idioma permanecem no histórico.

Use “Preparar esta porção para uso sem rede” para conservar explicitamente até 12 porções/variantes, no total de 2 MiB por conta neste dispositivo. A última consulta também fica disponível. Sem rede, notas e continuidade entram numa fila local limitada a 40 operações/1 MiB; a interface informa que o servidor ainda não confirmou. Não prepara o livro inteiro nem gera respostas de IA offline.

Se uma resposta se perder, Configurações mostra a operação pendente. Consulte o recibo; se continuar desconhecido, repita a mesma operação pela opção disponível. Não envie uma nova intenção equivalente com uma chave diferente. Em conflito, recarregue a leitura e reavalie a anotação ou avanço.

Ao reconectar, a fila confere recibos, identidade, versão e revisão. Uma nota pode ser acrescentada após conferir o mesmo intervalo; conflito de progresso pede decisão explícita, sem escolher automaticamente a página mais alta. “Sair” com pendências oferece recuperação em texto, descarte ou cancelamento. A recuperação não contém tokens. Outra conta não vê a fila anterior; para removê-la, entre na identidade correspondente. Cópias preparadas são revalidadas ao reconectar. Consulte [recuperação](operacao.md) antes de excluir obras ou restaurar backup.

## Apoios, fontes e cadernos

“Apoios, perspectivas e fontes” permite escolher representação, quantidade de apoio e perspectiva sem avançar. Repertório/objetivo são opcionais e editáveis; a aplicação não deduz idade, capacidade ou orientação pessoal. Peça ao assistente um termo, exemplo, premissa, etapa ou pré-requisito e volte à mesma referência. Compare variantes salvas em blocos emparelhados, em uma coluna também no desktop. Uma representação ausente é informada, sem conteúdo inventado.

“Entender e lembrar palavras” recupera primeiro definições e associações já guardadas. A consulta externa opcional ao Wikcionário é uma fonte geral, com data/link; sentido filosófico e etimologia exigem apoio pertinente. Dicas de memória são auxílios identificados, não fatos sobre a origem da palavra.

Em “Gerenciar perspectivas, fontes e cadernos”, cadastre referência bibliográfica (livro pode não ter URL), material realmente disponível e escopo da perspectiva. Fontes sugeridas não equivalem a obras consultadas. As referências APA usam apenas metadados disponíveis. Versões de um comentador podem ter escopos distintos; a seleção não transforma uma hipótese pessoal em verdade.

Notas podem participar ou não do contexto. Desativar conserva o registro; excluir pede confirmação e remove derivações registradas. Cadernos permitem escolher comentários para um pacote com prévia, autoria declarada e condições de uso. Não incluem originais/progresso/outras notas. A importação é privada e inativa; edição/hash/idioma divergentes ficam pendentes de vínculo explícito. Não publica o caderno ou verifica a identidade do autor.

Colegas podem abrir a mesma interface no celular e discutir suas leituras. Esta versão conserva bibliotecas individuais; não oferece sala compartilhada, chat coletivo ou sincronização de progresso entre pessoas.
