# Comunidade e próximas integrações

Atualização: 21/10/2026, Brasília. Este documento registra a entrega de comunidade 0.2.0 e o planejamento daquele ciclo. **Os itens seguintes de perfis, Asaas e WhatsApp evoluíram na versão 0.3.0**; o estado atual e os limites estão em [PILOTO_ASAAS_E_ACESSOS](PILOTO_ASAAS_E_ACESSOS.md) e [Evolution/n8n](../deploy/n8n/README.md).

## Entrega: personagens, contatos e mural

No passeio ilustrativo do Chandra, dois personagens representam síndico e zelador. Tocar na pessoa, no marcador, no mapa ou em **Equipe** abre a ficha. A posição não confirma presença física. Outros condomínios acessam as fichas e o mural pelos menus, sem receber o modelo ilustrativo do Chandra.

A gestão com permissão de pessoas preenche nome, idade opcional, foto, telefone com DDI/DDD, WhatsApp e e-mail. A ficha do síndico também tem vigência, unidade e indicação de proprietário. A conta vinculada precisa estar ativa, no mesmo condomínio e no papel correspondente; suspensão, expiração ou mudança de papel retiram a exposição da ficha até revisão. Ficha sem conta vinculada é cadastro informativo e não cria acesso. Os botões abrem os aplicativos de contato; o Vilazuni não envia mensagem nem inicia cobrança automaticamente.

Fotos são reduzidas no navegador, armazenadas no volume privado e servidas somente a sessões autorizadas no condomínio. JSON e PostgreSQL usam as mesmas coleções particionadas. A atualização não exige reprovisionar a base ou regenerar segredos. O volume privado continua necessário.

O zelador tem calendário por hoje, semana de segunda a domingo e mês civil, no fuso de Brasília. A agenda usa a conta vinculada e a atribuição real da tarefa. A gestão e o responsável consultam suas tarefas autorizadas; moradores recebem somente título, local, prazo e andamento das tarefas marcadas **Exibir no calendário do zelador** na criação. Tarefas anteriores permanecem privadas; descrições, fotos e evidências não são publicadas pelo calendário.

O mural aparece como quadro no cenário e no menu. Síndico, zelador, proprietário e ocupante com sessão vigente podem publicar; delegados com comunicação também. Autor pode editar/arquivar seu aviso; gestão de comunicação pode moderar. Texto é exibido como texto, sem executar HTML. Validade é opcional. Há limite de 300 avisos vigentes por condomínio; o histórico arquivado é preservado.

Exclamação no marcador e no menu representa avisos não vistos pela conta atual. Listar ou consultar pela API não marca leitura; a interface registra a versão ao abrir o conteúdo. A leitura de uma conta não afeta outra; editar um aviso gera nova versão e volta a alertar os demais. O estado persiste após reinício, fica separado por condomínio e é atualizado a cada 30 segundos enquanto a página está visível, ao voltar à aba ou atualizar o mural. A consulta automática não renova o prazo de inatividade da sessão. Fotos, contatos, avisos e leituras não entram no cache público da PWA.

O nome configurado do condomínio é o título principal do cabeçalho; Vilazuni é a assinatura secundária. O menu reúne convivência, comunidade, operação, gestão e configurações, com busca, indicação da opção selecionada, rolagem e abertura em gaveta no celular. A disponibilidade das ações continua seguindo as permissões existentes.

## Próximo ciclo solicitado: perfis e prazo de acesso

O usuário pediu ampliar os perfis de síndico, zelador, proprietários e inquilinos depois desta entrega. O sistema atual já possui papéis, delegações e ocupante de locação anual, mas isso não equivale à conclusão desse novo ciclo.

- Temporário: associar conta pessoal à estadia aprovada; permitir acesso somente no intervalo de entrada inclusive e saída exclusiva. Cancelamento/recusa, redução da estadia e mudança de unidade precisam revogar sessões, fotos, ações, convites e notificações associadas.
- Anual: vincular conta ao contrato residencial e ao prazo aprovado pelo proprietário/gestão. A validade não pode exceder o contrato. Hoje o prazo previsto do cadastro é apenas planejamento; o novo fluxo deve distinguir contrato e saída efetiva e revisar o acesso automaticamente no fim contratual.
- Preservar copropriedade, papéis em vários condomínios e limites por unidade; definir quem convida/renova e quais informações ficam publicadas.
- Testar limites de horário, renovação, cancelamento, revogação e troca de contexto. Não importar contas fictícias para produção.

## Próximo ciclo solicitado: WhatsApp e cobrança

O usuário confirmou **WhatsApp** para o grupo e **Asaas** como provedor de interesse; também pediu comparação com Mercado Pago. A decisão anterior de cobrança manual continua descrevendo a implementação atual. O novo pedido autoriza preparar essa evolução, mas nenhuma integração, conta financeira, mensagem paga ou cobrança real foi ativada nesta entrega.

Para avisos gerais no grupo, identificar primeiro um canal/API que suporte o grupo pretendido e seus requisitos. O adaptador existente é Telegram; ele não envia ao WhatsApp. Notificação individual de cobrança do Asaas não é uma integração com grupo de condomínio. Evitar notificações duplicadas entre o agente e a régua do provedor. Mensagens sobre cobrança individual ficam no canal do pagador; a visão pública permanece com comunicados gerais.

Para cobrança Asaas, implementar em homologação: cliente/pagador por condomínio, vínculo entre recebível e cobrança externa, prévia e confirmação da emissão, links Pix/boleto, eventos autenticados e deduplicados, conciliação de valor bruto/tarifas/líquido e estados de pagamento, atraso, cancelamento e estorno. Notificações devem parar após pagamento confirmado, contestação/suspensão aplicável ou perda do vínculo. Atraso não implica negativação automática. Reconciliar falhas e eventos fora de ordem sem cobrar ou baixar duas vezes.

Requisitos de ativação posterior: conta aprovada do recebedor adequado ao condomínio, condições/tarifas conferidas, credencial e segredo do webhook configurados no servidor e escolha do canal WhatsApp compatível. Não solicitar segredos pela conversa nem compartilhar chave entre condomínios.

## Pesquisa de custos em 21/10/2026

Conferidos na [página oficial de API do Asaas](https://www.asaas.com/api-de-pagamentos): integração sem tarifa própria, ambiente de testes e webhooks. Na [página oficial de preços](https://www.asaas.com/precos-e-taxas): sem mensalidade/adesão; emissão, alteração e cancelamento gratuitos; cobrança por recebimento e serviços utilizados.

| Item Asaas | Valor anunciado na consulta |
|---|---|
| Pix recebido | R$ 0,99 por recebimento por 3 meses para novos clientes; padrão R$ 1,99 |
| Boleto recebido | R$ 0,99 por recebimento por 3 meses para novos clientes; padrão R$ 1,99 |
| WhatsApp | R$ 0,55 por notificação enviada |
| Pacote e-mail/SMS | R$ 0,99 por transação em que o pacote é utilizado, descontado após pagamento segundo a explicação pública |

A promoção começa na criação da conta. A tabela não representa proposta contratual nem garantia de tarifa futura; conferir na conta antes da ativação. Os custos de mensagens são adicionais ao recebimento.

O serviço de pagamentos do Mercado Livre é o **Mercado Pago**. Seu [SDK Node.js oficial](https://github.com/mercadopago/sdk-nodejs) tem licença MIT, gratuita. Isso comprova a disponibilidade do software de integração, não gratuidade do processamento financeiro. As páginas de tarifas/Checkout retornaram HTTP 403 nesta consulta; não foi possível confirmar a tabela atual. Não comparar preços nem prometer recebimento gratuito sem obter as condições da conta. Ambos exigem tratar autorização, eventos, repetição, conciliação e falhas; o Asaas tem recursos de recorrência/régua que se ajustam ao fluxo pretendido.
