# Etapa 6 — assistência, comunicação e governança

Atualização: 20/10/2026, Brasília. Implementação do ciclo técnico 0.2.0 concluída para avaliação controlada. A ativação externa exige configuração de provedor/canal e revisão dos documentos reais do Chandra, em Arraial do Cabo/RJ.

## Fontes e respostas

Consultar → Fontes permite transcrever texto, referência, vigência, público e motivo; salvar cria rascunho, publicar exige revisão humana. Nova revisão preserva a anterior até a publicação; retirada/expiração interrompe consultas. PDFs privados não são publicados automaticamente.

Públicos distintos: **Gestão de fontes**, **Todos os usuários do condomínio** e **Liberado para grupos externos**. Comunidade inclui operadores e imobiliárias autorizados. Somente a última opção pode sair pelo Telegram, mesmo quando quem preparou é o síndico.

A busca local retorna até cinco trechos e funciona sem fornecedor de IA. A síntese opcional utiliza o endpoint oficial OpenAI Responses, modelo configurado no servidor, `store:false`, saída estruturada, limite de resposta e timeout. Não é pesquisa jurídica ou comprovação automática de verdade. A chave nunca vai ao navegador. Perguntas não são gravadas; a medição guarda apenas usuário/condomínio/dia/tentativas, com retenção de 32 dias. Há cem tentativas por pessoa/dia, uma chamada simultânea por contexto e quatro globais. Configure também orçamento e limites na conta do provedor.

A preparação filtra fontes antes da chamada. A conclusão revalida sessão, credenciais, condomínio e conteúdo das fontes; alteração durante a chamada descarta a resposta. Referências inexistentes e saídas inválidas geram retorno aos trechos autorizados. A interface apresenta síntese como IA e permite conferir a origem. A chamada externa não bloqueia a fila de operações do condomínio.

Antes de habilitar o provedor em produção, avaliar com os documentos reais: perguntas respondíveis, ausência/contradição de fontes, revisões retiradas, perguntas fora de escopo e tentativas de ampliar público ou inserir instruções no texto. Os testes locais usam fornecedor simulado; não medem a precisão de um modelo contratado. `AI_ENABLED=false` é o padrão.

## Ações assistidas e alertas

Assistência prepara criação de tarefa sem gravar. A confirmação usa proposta opaca, vinculada à pessoa/condomínio, com validade de cinco minutos e uso único; permissões e versões são conferidas novamente. API também permite preparar início/pedido de revisão de tarefa pelo fluxo existente. Não há aprovação automática de execução, operação financeira ou comando físico por IA.

Alertas objetivos cobrem tarefa vencida, estoque abaixo do mínimo, preventiva devida e prazo de documento. Preparar novamente não duplica o mesmo sinal/dia/versão. A gestão só prepara módulos aos quais tem acesso.

Triagem de ocorrência exige comunicação e ocorrências privadas. O operador redige mensagem própria, confere o público e indica destinatários relacionados à unidade ou operadores habilitados. Não é enviada cópia do relato original. A pessoa pode esclarecer; somente gestão habilitada muda apuração para conferido/encerrado. Alegação não se torna infração automaticamente. Avisos internos e push revalidam o acesso ao recurso.

## Telegram opcional

Canais registra grupo exato, bot oficial, horário de Brasília, habilitação e confirmação do público. Um grupo pertence a um condomínio. Bot API oficial, sem captura de sessões pessoais ou automação de WhatsApp. Credenciais ficam no servidor; webhook exige segredo próprio e grupo cadastrado. Somente `/perguntar@nome_do_bot pergunta` ou menção inicial explícita produz resposta; conversa comum é ignorada. Atualizações repetidas não duplicam mensagens; há limite horário por grupo.

Resumo diário inclui apenas fontes liberadas externamente, sem nomes, placas, cobranças, indicadores privados ou ocorrências provenientes dos outros módulos. Fila persistente registra pendente, em despacho, enviado, falhou ou incerto. A disponibilidade/público/revisão são revalidados antes de despachar. Fonte retirada ou grupo alterado invalida a mensagem preparada. Telegram aceitar o envio não comprova leitura. Timeout ou reinício durante despacho não dispara repetição automática; conferir o grupo antes de nova solicitação.

O processo verifica agendamentos a cada 30 segundos, em uma única instância da aplicação. Sem `TELEGRAM_ENABLED=true`, token e webhook configurados, não há envio. A escolha final do canal e grupo real permanece para ativação; nenhuma mensagem externa foi enviada neste desenvolvimento.

## Assembleias e mandatos

Nova delegação `assemblies`. Uma assembleia guarda regime jurídico informado, referência de convocação/convenção, período e até vinte matérias. Cada matéria exige fração de instalação, fração de aprovação, comparação (igual/maior ou estritamente maior), base de aprovação (todas as unidades, presentes ao abrir ou votos sim/não) e fundamento. Não há quórum jurídico presumido.

Todas as unidades ativas entram na relação congelada, inclusive as sem representante. Pesos são inteiros na mesma escala explicitamente informada. Um representante por unidade; coproprietários não multiplicam o voto. Uma conta pode representar várias unidades mediante poderes conferidos e vigentes até o fim da assembleia. A conferência registra referência da titularidade/procuração, validade, pessoa e motivo; o aplicativo não autentica por si só esses documentos.

Publicar exige pesos de todas as unidades e revisão das regras. Abertura respeita o período. Representantes declaram participação; a presença é autodeclarada no aplicativo, sem prova automática de presença física. Uma matéria por vez, com elegibilidade congelada na abertura. Voto definitivo por unidade, sem duplicação; suspensão/expiração bloqueia novas ações. Apuração usa aritmética inteira, não arredondamento de porcentagens; falta de instalação não vira aprovação.

Encerramento exige matérias apuradas/canceladas e ata revisada por humano. Snapshot conserva representação, presenças, votos e resultado. SHA-256 verifica integridade; não equivale a assinatura digital, registro cartorial ou certificação jurídica. Participante vê própria representação/votos e ata, sem procurações ou votos individuais alheios. Gestão autorizada exporta a apuração completa.

Transição de gestão exige proposta do síndico vigente, fundamento, prazo do novo mandato e aceitação pela conta indicada. Aceitar desativa o vínculo antigo e revoga sessões dos dois envolvidos, preservando os demais condomínios e o histórico. Convite comum não cria outro síndico.

Enquetes continuam separadas: uma opinião por conta, sem representação por unidade ou efeito deliberativo. Respostas individuais não são expostas pela API nem na exportação de cliente.

## Limites e ativação

Financeiro permanece manual por decisão do usuário. Município não determina regime jurídico, convenção, pesos ou quóruns. Antes do uso deliberativo real, a gestão deve validar esses documentos, convocação e regras aplicáveis. Provedores e canais estão preparados em código e testados com dados sintéticos; contratação, conta, precisão com documentos reais, entrega em grupo e validade formal dependem da ativação operacional.
