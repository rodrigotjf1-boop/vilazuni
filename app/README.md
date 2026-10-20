# Vilazuni — piloto local com login

Requer Node.js 20 ou superior e `npm ci` nesta pasta. Dependências e integridades estão fixadas no lockfile. Estado atual da versão 0.2.0: [STATUS_DO_PROJETO](../STATUS_DO_PROJETO.md); implantação: [deploy](../deploy/README.md).

## Abrir e configurar

Executar `Iniciar Vilazuni.cmd` na raiz ou `node server.mjs` nesta pasta. Usar o endereço 127.0.0.1 exibido e manter o servidor aberto. No primeiro acesso, criar a conta inicial da gestão com nome, e-mail e senha de pelo menos 12 caracteres. O agente não cria essa senha. Depois de entrar, clicar no próprio nome para convidar pessoas, consultar contas, suspender acessos e alterar a senha.

Os convites valem 48 horas, são de uso único e devem ser entregues manualmente. A pessoa usa “Recebi um convite” e define a própria senha. Não há envio de e-mail nem verificação de caixa postal nesta etapa; a entrega do convite deve ser feita à pessoa pretendida.

## Perfis disponíveis

- Síndico: gestão do condomínio e emissão de convites comuns.
- Proprietário: somente casas atribuídas e respectivas estadias.
- Imobiliária de locação: casas delegadas e prazo obrigatório de validade.
- Portaria: dados mínimos das autorizações aprovadas; sem contatos particulares ou proprietários.
- Zeladoria: tarefas; sem fichas residenciais ou de hóspedes.

Subsíndico e administradora recebem somente módulos delegados explicitamente pelo síndico, com prazo e justificativa. Ocupante recebe convite ligado a um vínculo anual vigente, com validade obrigatória e escopo mínimo. Use “Delegações e ocupantes” no menu da conta do síndico. Convites comuns não concedem cargos de gestão.

## Dados e sessões

Operações autenticadas são persistidas pelo servidor em `.data/store.json` (fora do Git). A variável VILAZUNI_DATA_DIR permite configurar outro diretório. O caminho padrão está dentro do workspace, que pode ser sincronizado pelo OneDrive. Não executar múltiplos servidores sobre a mesma base. Dados antigos do navegador não são importados automaticamente nem apagados.

Senhas são armazenadas com scrypt e salt; convites com hash. Sessões ficam em memória e expiram em oito horas ou após trinta minutos sem consultas. Reiniciar o servidor exige novo login. Suspender a conta invalida suas sessões; alterar a senha encerra as anteriores. Recuperação opcional por e-mail e MFA TOTP estão implementados e exigem configuração segura do servidor; não existe senha mestra.

## Experiência e limites

Tour WebGL com 14 sobrados, áreas comuns e interiores ilustrativos em dois pavimentos. Consultas e cadastros abrem sobre o cenário. As operações usam o horário atual; o cenário e os dados operacionais são de exemplo. Login real local não significa ambiente de produção: não inserir dados reais de moradores antes de implantar a base central.

Por padrão local, o serviço atende em 127.0.0.1. A versão 0.2.0 acrescenta PostgreSQL/RLS, HTTPS via gateway, MFA, recuperação, vários vínculos, anexos privados e backup cifrado. Adaptadores de IA, Telegram, push e equipamentos ficam opcionais e desativados sem configuração. Pagamentos continuam manuais. A configuração inicial não verifica mandato de síndico; leia os critérios de ativação antes do uso real.

## Verificação

`npm test`: 214 testes (três PostgreSQL exigem configuração da base local descartável), incluindo integração HTTP com contas sintéticas temporárias, domínio, delegações, manutenção, reservas, encomendas, avisos e persistência após reinício. Cobre escopo de casas e condomínios, convite único, sessão, suspensão, expiração de delegação, troca de senha e campos mínimos por perfil. O teste HTTP exige conexão de loopback permitida. A tela inicial foi conferida no navegador; a senha da conta real deve ser criada pelo usuário.


## Moradores e vínculos

Após entrar, selecione uma casa e abra “Moradores e vínculos”, ou use o marcador Pessoas dentro da casa. Cadastre cada coproprietário individualmente. Para locação anual/residencial, informe titular, contato, período e relação nominal de moradores; placas são opcionais. O término previsto é planejamento, não confirmação de saída. “Registrar saída / término” preserva o histórico para a gestão. As alterações exigem motivo. Esta etapa foi verificada com 13 testes e com cadastro/encerramento pela interface em base isolada.


## Zeladoria com revisão — 18/10/2026

Implementado no piloto local: criação de tarefa com local, orientações, prazo e responsável; tarefas visíveis ao zelador somente quando atribuídas à sua conta; fotos de execução; envio para revisão; aprovação, pedido de ajuste ou cancelamento pela gestão, com observação e histórico. Reatribuir reinicia o andamento e exige nova evidência. Uma versão por tarefa impede sobrescrita por uma tela desatualizada; use “Atualizar tarefas” para recarregar.

As fotos são servidas por rota autenticada, restrita à gestão do condomínio e ao zelador responsável. A interface reduz imagens para até 1600 pixels e converte em JPEG. Limites do piloto: oito fotos por tarefa, 2 MB por arquivo recebido e limite global de armazenamento próximo de 64 MB. Os arquivos ainda ficam na base JSON local; armazenamento de objetos, retenção e backups de produção continuam pendentes. A validação do servidor verifica formato e tamanho, sem análise de conteúdo ou antivírus.

Verificação atual: 17 testes aprovados, incluindo envio/leitura de foto pela API, negação de acesso sem sessão e por proprietário, controle de versão, atribuição e revisão. Criação e início de tarefa também conferidos pela interface em base temporária com dados fictícios. Prévia: `previa-zeladoria.png` na raiz do projeto. Nenhuma conta do usuário foi criada.

## Ocorrências privadas — 19/10/2026

No menu “Ocorrências”, abra um relato com título, local, descrição e casa opcional autorizada. Cada conta acompanha apenas seus relatos; a gestão acompanha os do condomínio. A gestão atribui um responsável de gestão, inicia apuração, resolve/cancela com justificativa e pode reabrir. Comentários, decisões e atribuições preservam histórico e versão. Ao receber aviso de conflito, use “Atualizar ocorrências”.

Não há relatos anônimos ou anexos nesta etapa; avisos internos foram adicionados na etapa seguinte. Não encaminhamos relatos privados automaticamente ao zelador. O autor vê todos os acompanhamentos da gestão no próprio relato. Verificação original desta etapa: 21 testes aprovados, com conferência visual ainda pendente naquela entrega.

## Materiais e estoque — 19/10/2026

Menu “Materiais”: gestão cadastra consumíveis, unidade, depósito e mínimo, depois registra entradas com motivo. Gestão e zeladoria registram consumo escolhendo tarefa aberta; zeladoria só pode consumir em tarefas atribuídas à sua conta. Saldo e histórico da tarefa são atualizados juntos. Até três casas decimais; saldo insuficiente e versões desatualizadas são recusados. Use “Atualizar estoque” após conflito. O painel de tarefas mostra os materiais consumidos.

Zeladoria consulta saldos e apenas os próprios movimentos. Recebimentos de compras são integrados pelo menu Compras. Custos completos, estornos de estoque, ajustes de inventário e empréstimos continuam pendentes. Cancelar tarefa não devolve material automaticamente. Verificação original desta etapa: 25 testes aprovados.

Fluxo de materiais conferido no Chromium com base temporária: cadastro, entrada, tarefa, consumo e exibição na tarefa, sem erros JavaScript. Consulta do painel também verificada em viewport móvel. Nenhuma conta real criada.

## Novas operações — 19/10/2026

- **Delegações e ocupantes:** no menu da conta do síndico, convide com perfil, validade, módulos e justificativa; para ocupante selecione vínculo anual vigente. Atualizar delegação encerra sessões da conta. Encerrar o vínculo anual encerra o acesso do ocupante. Delegados não administram identidades nem repassam permissões.
- **Preventiva:** configure local/equipamento, intervalo em dias, primeiro prazo e checklist. Gere a execução quando devida e acompanhe em Tarefas. Há somente uma execução aberta por plano. Checklist completo e foto são exigidos para revisão. Geração manual, sem agendador.
- **Reservas:** configure dependência, capacidade, horário de Brasília, duração máxima e regras. Solicitações passam por aprovação e já reservam o horário pendente. Agenda de terceiros oculta dados pessoais. Interdição cancela agendamentos futuros com motivo; reabrir não restaura as reservas.
- **Encomendas:** portaria/gestão registra recebimento e retirada após conferência presencial. Destinatário com conta acompanha apenas encomendas endereçadas à própria conta. Sem conta, acompanhamento apenas pela operação.
- **Avisos:** mensagens internas individuais para alterações de tarefas, ocorrências, reservas e encomendas, com marcação de leitura. Use “Atualizar avisos”; nenhum serviço de mensagens externo está conectado.

As regras/frequências dos espaços e equipamentos são configuradas pela gestão. Use dados fictícios neste piloto. Os fluxos acima foram conferidos em Chromium com bases temporárias; menus também verificados em tela móvel. Permanecem pendentes edição de planos/regras, evolução de compras e financeiro, múltiplos condomínios por conta e infraestrutura de produção.

Prévias desta entrega com dados sintéticos: [manutenção preventiva](../previa-preventiva.png) e [reservas no celular](../previa-reservas-mobile.png).

## Fornecedores e compras — 19/10/2026

O menu “Compras” separa preparação e aprovação. O síndico concede os módulos “Fornecedores e compras” e “Aprovação de compras” no menu de delegações; para aprovadores delegados, informe limite por compra em reais. A aprovação exige outra pessoa, diferente de quem preparou e registrou o orçamento selecionado, inclusive para o síndico.

1. Cadastre fornecedores, contatos e categorias. Edição e inativação exigem motivo e preservam histórico; aprovadores sem preparação não recebem os contatos.
2. Prepare uma compra com especificação, quantidade e unidade. Selecione material de estoque e tarefa quando autorizado.
3. Registre propostas com total incluindo frete/tributos, validade, entrega e condições. A última por fornecedor entra na comparação; versões anteriores permanecem disponíveis.
4. Envie para análise. A segunda pessoa aprova uma proposta válida dentro do limite ou recusa com motivo; cotação única exige justificativa própria.
5. Confira o recebimento integral, com referência e observação. Para material, é necessário acesso ao estoque: a entrada e a compra são gravadas juntas. Repetições e versões antigas são recusadas.

Não há pedidos enviados, pagamentos ou despesas financeiras automáticas. Nesta entrega, cada compra tem uma especificação e um recebimento integral; ainda faltam itens múltiplos, recebimentos parciais, devoluções e garantias estruturadas. Limite de proposta: R$ 1.000.000,00. Nenhum fornecedor real foi contatado.

## Documentos e vencimentos — 19/10/2026

No menu “Documentos”, contas com o módulo “Documentos privados” cadastram título, categoria, responsável, vencimento opcional, antecedência de alerta e PDF. As versões anteriores permanecem disponíveis por download autenticado; novas versões exigem motivo. Arquivar conserva os arquivos e suspende alertas, sem excluir histórico.

O servidor confere formato, limite de tamanho e integridade SHA-256 no download. PDF de até 2 MB, dez versões por documento e 32 MB totais no piloto. Arquivos são baixados como anexo; não há link público, visualização incorporada, antivírus ou assinatura digital. Vencimentos e regras são definidos pela gestão.

Os prazos são calculados pelo dia de Brasília e consultados em “Documentos” e “Avisos”, sem envio externo. Arquivos continuam na base JSON local; armazenamento privado de objetos e backups permanecem pendentes. Use somente PDFs sintéticos neste piloto.

Verificação desta etapa, antes da base financeira: 58 testes, incluindo concorrência, limites de aprovação, segregação de funções, recebimento com estoque, arquivos privados, controle de versões, integridade e reinício. Fluxos também conferidos no Chromium, com renovação/download em tela móvel.

Prévias desta etapa com dados sintéticos: [compra recebida](../previa-compras.png) e [documentos no celular](../previa-documentos-mobile.png).

## Base financeira — 19/10/2026

No menu de delegações, o síndico concede separadamente:

- **Consulta financeira:** saldos, contas a pagar/receber, orçamento e relatórios, sem escrita.
- **Lançamentos, contas a pagar e receber:** receitas/despesas, transferências entre contas, contas a pagar/receber, geração de rateios aprovados e baixas manuais integrais/parciais; proposta e ativação de acordos.
- **Controle financeiro:** cadastros/saldos iniciais, realocação entre fundos, ajustes, previsões orçamentárias, preparação/aprovação de rateios, modelos recorrentes, aprovação/cancelamento de acordos, conciliação de extratos e fechamento.
- **Exportação financeira:** leitura e download de relatórios JSON, sem escrita.

Comece em Financeiro → Contas e fundos. Cadastre fundos/finalidades e uma conta bancária ou caixa com saldo inicial, data e origem. Fundos são destinações do saldo das contas; não some os totais das duas visões. Ajustes e estornos preservam os registros anteriores. O piloto não permite saldo negativo ao fim do dia por conta/fundo, nem lançamento anterior ao saldo inicial, no futuro ou em período encerrado.

Em Contas a pagar, registre compromissos manuais ou importe compras recebidas. A importação mantém o valor aprovado e data de recebimento e não duplica compromissos. Informe fundo, categoria e vencimento. Registrar saída manual exige conta, data, referência única e conferência; reduz o saldo somente após o registro. Estornar essa saída reabre o compromisso. Alterações de prazo/fundo/categoria, cancelamentos e reaberturas têm histórico e efeito no dia do registro.

Em Contas a receber, cadastre pagador, referência única para o pagador, valor, emissão, vencimento, categoria e fundo. O cadastro não altera o saldo; Registrar entrada manual registra receita integral ou parcial conferida na conta escolhida. Não confirma o banco ou envia cobrança. Cancelamento, reabertura e revisão de vencimento/fundo/categoria mantêm histórico; valor e identificação originais são fixos. Estornar uma entrada reabre o recebível e exige saldo disponível. A nova baixa, a pagar ou receber, não pode anteceder o estorno.

Em Orçamento, escolha o mês e cadastre previsões de receita/despesa por fundo e categoria com permissão de controle. Cada combinação é única; revisões mantêm valores/justificativas anteriores e zero retira a previsão sem apagar o registro. Pode planejar meses futuros e revisar qualquer mês aberto, inclusive após terminar. Comparar com o realizado abre o relatório mensal: categorias são comparadas ignorando maiúsculas/minúsculas; categorias sem previsão também aparecem. Realizado usa caixa líquido de estornos na data do estorno, podendo ficar negativo. Não inclui saldos iniciais, ajustes, transferências ou contas ainda não baixadas. Diferença = realizado − previsto; positiva em despesa indica gasto acima da previsão.

Em Rateios por unidade, controle financeiro prepara rascunho com referência única, competência, emissão, vencimento, fundo, categoria, total e fundamento da decisão. Selecione as unidades e informe pagadores explicitamente; não usamos nomes de proprietários/ocupantes como pagadores automáticos. Escolha divisão igual ou pesos inteiros positivos (1 a 1.000.000). Salvar e conferir prévia calcula no servidor os valores exatos em centavos: partes inteiras, depois maiores sobras, com desempate por número/identificador da unidade. Valores devem somar o total; cada contribuição tem pelo menos R$ 0,01. Limites: 100 unidades e R$ 1.000.000,00 por rateio.

Controle financeiro pode revisar o rascunho com histórico da distribuição anterior e aprovar a prévia. A aprovação congela a distribuição e registra a decisão informada, sem validação jurídica automática ou exigência de segundo aprovador. Operação financeira gera uma conta a receber por unidade usando somente os valores aprovados. O lote inteiro é gravado uma única vez; colisões não deixam contas parciais. Após outra conta aprovar ou gerar, use Atualizar financeiro para consultar a situação atual. Referências canceladas não podem ser reutilizadas. Geração não aumenta caixa ou envia cobrança. Competência pode ser futura; emissão não pode ser futura e ambas precisam estar em períodos abertos.

Rateios ainda não gerados podem ser cancelados por controle. Depois de gerar, recebimento/estorno, ajustes de prazo/fundo/categoria e cancelamento são feitos em cada conta a receber pela operação, preservando a distribuição aprovada. Não há emissão recorrente em segundo plano ou vários pagadores da mesma unidade no mesmo rateio. As referências de origem e unidade ficam visíveis no recebível.

Baixas parciais: em Registrar entrada/saída manual, informe o valor conferido até o saldo restante, data e uma referência nova para cada baixa. O painel lista todas as baixas para consulta e estorno individual. Estados parciais mostram registrado/restante. Para quitar, use o saldo restante exibido; para cancelar a conta, estorne antes suas baixas. Alterações de vencimento/fundo/categoria da conta original valem dali em diante, sem mudar lançamentos anteriores. Pendências dos relatórios somam apenas o residual.

Em Acordos de parcelamento, operação propõe sobre uma conta original aberta/parcial, usando só seu saldo restante. Informe referência única, 2–36 parcelas mensais, primeiro vencimento atual/futuro e condições/concordância informada. Centavos restantes ficam nas primeiras parcelas; dia do mês é limitado ao último dia nos meses curtos. Confira a prévia; controle aprova e operação ativa. Se o saldo/versão de origem mudou, cancele a proposta e prepare outra. Ativação cria as parcelas atomicamente e transfere o residual da origem, sem receita ou dupla contagem. Recebimentos anteriores continuam registrados.

Parcelas de acordo aceitam baixa integral/parcial e estorno. Vencimentos e fundo/categoria são preservados pelo acordo; não há cancelamento isolado de parcela ou nova renegociação sobre parcela. A origem fica bloqueada para baixa/estorno enquanto estiver em acordo. Controle pode cancelar após estornar todas as baixas das parcelas; as parcelas são canceladas e o residual original é restaurado, sem apagar o histórico. Quitação/reabertura é calculada pelos lançamentos. Acordos são de principal sobre uma origem, sem juros, multa, descontos, consolidação ou assinatura digital.

Em Rateios recorrentes, controle cria modelo a partir de rateio aprovado/gerado (também pelo botão Usar como modelo recorrente). Informe prefixo único, vigência e dia de vencimento. Preparar competência cria uma única prévia/rascunho por mês; depois confira/aprove o rateio e gere as contas pelo fluxo existente. Preparação não aumenta caixa ou gera recebíveis. Revisar modelo muda apenas próximas preparações; pausa/retomada não afeta meses existentes. Competência já preparada não é reutilizada mesmo após cancelamento: revise o rascunho existente ou crie substituição com referência distinta. Sem agendador, envio de cobrança ou débito automático.

Consulte um mês em Relatório mensal. O relatório mostra contas/fundos, movimentos, contas a pagar/receber na data de corte, orçamento versus realizado, distribuição dos rateios, acordos/parcelas na data de corte e pendências de compras/rateios aprovados ainda não gerados. Receitas/despesas aparecem antes dos estornos, mostrados separadamente. Feche somente mês concluído, após conferir saldos, compromissos das compras recebidas e gerar/cancelar os rateios aprovados com emissão no período. O fechamento bloqueia o período e anteriores; próximos meses devem seguir em sequência. Só o síndico reabre o último fechamento. Cada versão fechada mantém relatório, revisão orçamentária e hash; fechamentos anteriores aos novos módulos continuam sem campos retroativos; históricos podem ser consultados mesmo após reabertura. Exportação JSON requer permissão própria.

Em Conciliação por extrato, controle financeiro seleciona conta bancária, intervalo de um único mês aberto e saldos antes/depois dos movimentos. Envie CSV UTF-8 de até 200 KiB/500 movimentos, conforme [modelo sintético](modelo-extrato.csv): `id;data;descricao;valor`, data `AAAA-MM-DD`, valor com vírgula e duas casas, sem milhar; saídas negativas e ID estável/único na conta. Aceita BOM, CRLF e campos entre aspas. A prévia não grava; confira valores e confirme a importação com justificativa. Saldo inicial mais movimentos deve ser igual ao saldo final informado. O saldo inicial cadastrado é considerado antes dos movimentos da própria data. Intervalos ativos não podem se sobrepor.

Abra cada movimento e selecione explicitamente um lançamento existente com mesma conta, valor e sinal. Registre entradas/saídas pelos fluxos apropriados antes de vincular: importação e conferência não alteram caixa ou recebíveis. Cada lançamento aceita um vínculo por conta; transferências têm dois lados e realocação entre fundos não precisa de par bancário. Datas diferentes, lançamentos sem par, diferenças de saldo e movimentos ignorados permanecem visíveis. Ignorar exige motivo e mantém ressalva. Desfazer preserva histórico; cancelar exige desfazer todos os vínculos e permite substituir o intervalo sem apagar os dados anteriores. Conta com movimentos pendentes/ignorados em extrato ativo não pode ser inativada.

O relatório mostra cobertura por conta bancária; o mês só fica conferido com cobertura integral e sem diferenças/ressalvas. Fechar mês ainda aceita conciliação incompleta e preserva essas pendências no relatório/exportação. Para corrigir extratos de mês fechado, solicite reabertura ao síndico. Fechamentos anteriores mantêm conteúdo/hash. Estornar não desfaz a conferência do lançamento original; o lançamento inverso precisa de conferência própria. O hash identifica o conteúdo UTF-8 recebido, incluindo BOM; o CSV original não é armazenado, apenas dados normalizados e histórico. Consulta/operação/exportação financeira leem extratos, mas só controle pode importar, vincular ou cancelar.

Não há transferência bancária, pagamento, cobrança bancária ou emissão recorrente automática. Os saldos e extratos são informados manualmente, sem autenticação bancária. A etapa 4 está concluída para o piloto de cobrança manual por decisão do usuário; parceiro/retornos autenticados ficam adiados. OFX, formatos específicos de bancos, divisão/agregação de movimentos e evoluções de acordos/rateios continuam pendentes. Valores de teste são sintéticos. Até R$ 1.000.000,00 por movimento. Verificação atual: 165 testes aprovados e fluxo conferido no Chromium, incluindo consulta em tela móvel.

Prévias com valores sintéticos: [relatório mensal](../previa-financeiro.png) e [consulta no celular](../previa-financeiro-mobile.png).

Prévias desta continuação: [orçamento no relatório](../previa-orcamento.png) e [recebível no celular](../previa-recebiveis-mobile.png).

Prévias dos rateios com valores sintéticos: [distribuição por unidade](../previa-rateios.png) e [consulta no celular](../previa-rateios-mobile.png).

Prévias destas três etapas: [baixa parcial](../previa-baixas-parciais.png), [acordo e parcelas](../previa-acordos.png) e [recorrência no celular](../previa-recorrencia-mobile.png).

Prévias da conciliação: [extrato conferido](../previa-conciliacao.png) e [consulta no celular](../previa-conciliacao-mobile.png).

## Cobrança manual, análise e encargos — 20/10/2026

A etapa 4 está concluída no escopo manual escolhido pelo usuário. Leia os critérios, limites e passos em [ETAPA_4_FINANCEIRO.md](../fundacao/ETAPA_4_FINANCEIRO.md). Não há integração com instituição financeira ou homologação de retornos bancários.

Em Contas a receber → Cobrança e acesso do pagador, controle vincula explicitamente uma conta residencial ativa, com fundamento; contribuições por unidade exigem acesso à unidade. Operação emite aviso com referência única e orientações conferidas. No máximo um aviso ativo por recebível; cancelar aviso preserva dívida. Trocar/remover pagador cancela avisos anteriores e revoga consulta. O vínculo não presume responsabilidade jurídica. Parcelas de acordo e encargos preservam o pagador indicado na origem quando criados; cada aviso ainda exige emissão. Alterações posteriores de vínculo são individuais por recebível.

A pessoa indicada usa Minhas cobranças, sem fundos/saldos gerais ou dívidas de terceiros. Pode contestar ou informar pagamento; ambos abrem análise privada e não registram receita. Controle acompanha/resolve, e a operação registra entrada somente após conferir. Análise aberta e suspensão administrativa impedem novos avisos/lembretes/encargos e renegociação da origem. Retirar suspensão não encerra análise; resolver análise não dá baixa. Alterações são compartilhadas com o destinatário vigente; relatos antigos não são repassados ao novo pagador.

Cobranças e atrasos mostra saldo restante por faixa, unidade/competência e vencimento; previsões não são dinheiro disponível. Controle configura a régua (até 12 dias entre -30 e 120 em relação ao vencimento); operação usa Preparar lembretes de hoje. Somente avisos ativos com saldo, destinatário vigente e sem suspensão/análise geram aviso interno. Mesmo vencimento/dia não se repete. Sem agendador, e-mail ou WhatsApp.

Em Encargos aprovados, controle propõe referência, fundamento, vigência e percentuais explícitos; outra pessoa com controle aprova após confirmar a validação aplicável. Método disponível: multa única sobre saldo ao fim do vencimento, juros simples anuais / 365 sobre saldo ao fim de cada dia e arredondamento agregado em centavos. Informe zero no componente não aplicável. O aplicativo não presume taxas legais nem substitui validação jurídica. Regras aprovadas não são editadas; retirar impede novas aplicações e mantém memórias anteriores.

Calcular encargo mostra prévia sem gravação. Confirmar cria recebível separado com memória, principal preservado e nenhum efeito no caixa. Novos períodos começam após a última apuração ativa; multa não se repete e não há juros sobre encargos. Alteração de termos limita o início ao dia da alteração. Limites: 3.660 dias e R$ 1.000.000,00 por apuração. Cancelamento exige tratar avisos/baixas e apurações posteriores; memória e histórico permanecem. Para mudar a base por baixa, estorno, revisão ou ativação de acordo em dia já apurado, revise/cancele antes a apuração. Calcular até ontem permite registrar novos fatos de hoje sem mudar o período apurado. Sem correção por índice, descontos, consolidação de origens ou outros métodos de cálculo. Relatório/exportação congelam os novos dados na data de corte, conservando hashes anteriores.

Validação: 165 testes aprovados; fluxos conferidos no Chromium, incluindo portal móvel, isolamento, segunda aprovação, informação de pagamento sem baixa, lembrete único, baixa parcial, revogação e fechamento/exportação. Prévias sintéticas: [aviso manual](../previa-cobranca-manual.png), [pagador no celular](../previa-minhas-cobrancas-mobile.png) e [memória](../previa-memoria-encargos.png).

## Passeio virtual contextual — 19/10/2026

Etapa 5 concluída no piloto 3D ilustrativo, sem reconstrução/captura real. Ver [critérios, medições e plano de captura](../fundacao/ETAPA_5_PASSEIO_VIRTUAL.md). Layout aprovado preservado: 01–07 à direita, 08–14 à esquerda, churrasqueira junto à 14, festas/jogos no primeiro patamar e piscina acima.

Explorar ou Mapa oferece busca, tipo/acesso e ficha. Exterior não concede dados residenciais: ficha e cada atalho são revalidados no servidor. Casas autorizadas abrem moradores/vínculos, estadias, novo cadastro na casa correta e vagas; portaria usa autorizações por casa sem entrar no interior. Ocupante não recebe fichas pessoais/estadias. Gestão delegada fica nos seus módulos.

Gestão de dependências usa Vincular ou retirar dependência no marcador. Associação explícita, versionada e única, sem inferir nomes. Dependências sem marcador permanecem na lista. Ficha abre cadastro/agenda do registro correto e consulta interdição atual; reservar continua sujeito ao servidor.

Arraste para olhar; pinça/rolagem/+ e − ajustam zoom. Passear aceita toque ou setas/WASD e limita alameda/escadas antes da piscina/casas. Soltar/cancelar toque/perder foco interrompe caminhada. Interior permite térreo/superior e atalhos autorizados. Mapa/lista são alternativas sem movimento; preferência de mapa evita iniciar WebGL. Falta/perda gráfica preserva fichas e operações pela alternativa 2D. Escape/fechar retornam foco; movimento reduzido é respeitado.

165 testes aprovados e Chromium: computador, toque em 390×844, alternativa 2D em 320×568, teclado, revogação, falta/perda de WebGL e regressão financeira. Cena por demanda, cerca de 248 KiB de scripts e buffer de 2.018.880 bytes, sem requisições externas. Aparelho físico, imagens reais e produção continuam pendentes; sem nova dependência ou serviço contratado.

Prévias sintéticas: [mapa](../previa-passeio-mapa.png), [dependência](../previa-passeio-dependencia.png), [ficha móvel](../previa-passeio-ficha-mobile.png), [toque](../previa-passeio-toque-mobile.png) e [sem WebGL](../previa-passeio-sem-webgl.png).

## Assistência, governança e distribuição — 0.2.0

Consulte [etapa 6](../fundacao/ETAPA_6_FONTES_E_GOVERNANCA.md) e [etapas 7–8](../fundacao/ETAPAS_7_8_DISTRIBUICAO.md) para fluxos, delegações, configuração e limites atuais. Novos menus: Assembleias, Assistência, Alertas, Canais, Portaria física, Celular, Privacidade e Condomínio.

No modo local, dados sintéticos e arquivo JSON continuam disponíveis. Produção exige PostgreSQL, diretório de anexos privado persistente, chaves externas, HTTPS e MFA da gestão; a base nova começa sem dados fictícios. A implantação não é feita automaticamente ao iniciar o piloto.

`npm run test:browser` executa uma jornada sintética em Chromium. Instale o navegador com `npx playwright-core install chromium` ou informe `CHROMIUM_PATH`. Para testes de PostgreSQL, veja `scripts/prepare-pg-test.mjs`; nunca use banco com dados reais. Scripts operacionais: `npm run db:migrate`, `npm run db:import-json -- <store.json>`, `npm run backup -- create|restore <arquivo>`.
