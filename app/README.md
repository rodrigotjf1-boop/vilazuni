# Vilazuni — piloto local com login

Requer Node.js 20 ou superior. Sem dependências externas.

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

Senhas são armazenadas com scrypt e salt; convites com hash. Sessões ficam em memória e expiram em oito horas ou após trinta minutos sem consultas. Reiniciar o servidor exige novo login. Suspender a conta invalida suas sessões; alterar a senha encerra as anteriores. Recuperação de senha esquecida ainda não está implementada; não existe senha mestra.

## Experiência e limites

Tour WebGL com 14 sobrados, áreas comuns e interiores ilustrativos em dois pavimentos. Consultas e cadastros abrem sobre o cenário. As operações usam o horário atual; o cenário e os dados operacionais são de exemplo. Login real local não significa ambiente de produção: não inserir dados reais de moradores antes de implantar a base central.

O serviço atende somente em 127.0.0.1. Para distribuição ainda faltam PostgreSQL com migrações e isolamento no banco, HTTPS e cookies Secure, recuperação verificada de conta, MFA da gestão, múltiplos vínculos, backups e revisão de segurança. Não há integração com portão, pagamentos, mensagens ou IA. A configuração inicial local não verifica mandato de síndico.

## Verificação

`npm test`: 100 testes, incluindo integração HTTP com contas sintéticas temporárias, domínio, delegações, manutenção, reservas, encomendas, avisos e persistência após reinício. Cobre escopo de casas e condomínios, convite único, sessão, suspensão, expiração de delegação, troca de senha e campos mínimos por perfil. O teste HTTP exige conexão de loopback permitida. A tela inicial foi conferida no navegador; a senha da conta real deve ser criada pelo usuário.


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
- **Lançamentos, contas a pagar e receber:** receitas/despesas, transferências entre contas, contas a pagar/receber, geração de rateios aprovados e baixas manuais.
- **Contas, fundos, orçamento, rateios e fechamento:** cadastros/saldos iniciais, realocação entre fundos, ajustes, previsões orçamentárias, preparação/aprovação de rateios e fechamento.
- **Exportação financeira:** leitura e download de relatórios JSON, sem escrita.

Comece em Financeiro → Contas e fundos. Cadastre fundos/finalidades e uma conta bancária ou caixa com saldo inicial, data e origem. Fundos são destinações do saldo das contas; não some os totais das duas visões. Ajustes e estornos preservam os registros anteriores. O piloto não permite saldo negativo ao fim do dia por conta/fundo, nem lançamento anterior ao saldo inicial, no futuro ou em período encerrado.

Em Contas a pagar, registre compromissos manuais ou importe compras recebidas. A importação mantém o valor aprovado e data de recebimento e não duplica compromissos. Informe fundo, categoria e vencimento. Registrar saída manual exige conta, data, referência única e conferência; reduz o saldo somente após o registro. Estornar essa saída reabre o compromisso. Alterações de prazo/fundo/categoria, cancelamentos e reaberturas têm histórico e efeito no dia do registro.

Em Contas a receber, cadastre pagador, referência única para o pagador, valor, emissão, vencimento, categoria e fundo. O cadastro não altera o saldo; Registrar entrada manual registra receita integral conferida na conta escolhida. Não confirma o banco ou envia cobrança. Cancelamento, reabertura e revisão de vencimento/fundo/categoria mantêm histórico; valor e identificação originais são fixos. Estornar uma entrada reabre o recebível e exige saldo disponível. A nova baixa, a pagar ou receber, não pode anteceder o estorno.

Em Orçamento, escolha o mês e cadastre previsões de receita/despesa por fundo e categoria com permissão de controle. Cada combinação é única; revisões mantêm valores/justificativas anteriores e zero retira a previsão sem apagar o registro. Pode planejar meses futuros e revisar qualquer mês aberto, inclusive após terminar. Comparar com o realizado abre o relatório mensal: categorias são comparadas ignorando maiúsculas/minúsculas; categorias sem previsão também aparecem. Realizado usa caixa líquido de estornos na data do estorno, podendo ficar negativo. Não inclui saldos iniciais, ajustes, transferências ou contas ainda não baixadas. Diferença = realizado − previsto; positiva em despesa indica gasto acima da previsão.

Em Rateios por unidade, controle financeiro prepara rascunho com referência única, competência, emissão, vencimento, fundo, categoria, total e fundamento da decisão. Selecione as unidades e informe pagadores explicitamente; não usamos nomes de proprietários/ocupantes como pagadores automáticos. Escolha divisão igual ou pesos inteiros positivos (1 a 1.000.000). Salvar e conferir prévia calcula no servidor os valores exatos em centavos: partes inteiras, depois maiores sobras, com desempate por número/identificador da unidade. Valores devem somar o total; cada contribuição tem pelo menos R$ 0,01. Limites: 100 unidades e R$ 1.000.000,00 por rateio.

Controle financeiro pode revisar o rascunho com histórico da distribuição anterior e aprovar a prévia. A aprovação congela a distribuição e registra a decisão informada, sem validação jurídica automática ou exigência de segundo aprovador. Operação financeira gera uma conta a receber por unidade usando somente os valores aprovados. O lote inteiro é gravado uma única vez; colisões não deixam contas parciais. Após outra conta aprovar ou gerar, use Atualizar financeiro para consultar a situação atual. Referências canceladas não podem ser reutilizadas. Geração não aumenta caixa ou envia cobrança. Competência pode ser futura; emissão não pode ser futura e ambas precisam estar em períodos abertos.

Rateios ainda não gerados podem ser cancelados por controle. Depois de gerar, recebimento/estorno, ajustes de prazo/fundo/categoria e cancelamento são feitos em cada conta a receber pela operação, preservando a distribuição aprovada. Não há emissão recorrente ou vários pagadores da mesma unidade no mesmo rateio. As referências de origem e unidade ficam visíveis no recebível.

Consulte um mês em Relatório mensal. O relatório mostra contas/fundos, movimentos, contas a pagar/receber na data de corte, orçamento versus realizado, distribuição dos rateios e pendências de compras/rateios aprovados ainda não gerados. Receitas/despesas aparecem antes dos estornos, mostrados separadamente. Feche somente mês concluído, após conferir saldos, compromissos das compras recebidas e gerar/cancelar os rateios aprovados com emissão no período. O fechamento bloqueia o período e anteriores; próximos meses devem seguir em sequência. Só o síndico reabre o último fechamento. Cada versão fechada mantém relatório, revisão orçamentária e hash; fechamentos anteriores aos novos módulos continuam sem campos retroativos; históricos podem ser consultados mesmo após reabertura. Exportação JSON requer permissão própria.

Não há transferência bancária, pagamento, conciliação, cobrança externa ou emissão recorrente automática. Os saldos são registros gerenciais manuais, sem validação bancária. Ainda faltam baixas parciais/acordos, recorrência/evolução dos rateios e integração com parceiro. Valores de teste são sintéticos. Até R$ 1.000.000,00 por registro. Verificação atual: 100 testes aprovados e fluxo conferido no Chromium, incluindo consulta em tela móvel.

Prévias com valores sintéticos: [relatório mensal](../previa-financeiro.png) e [consulta no celular](../previa-financeiro-mobile.png).

Prévias desta continuação: [orçamento no relatório](../previa-orcamento.png) e [recebível no celular](../previa-recebiveis-mobile.png).

Prévias dos rateios com valores sintéticos: [distribuição por unidade](../previa-rateios.png) e [consulta no celular](../previa-rateios-mobile.png).
