# Piloto 0.3.0: acessos, cobrança e agente

Atualização: 21/10/2026, Brasília. Decisão do usuário: uma conta própria do condomínio no Asaas, **sem subcontas/BaaS**, e Evolution API com n8n em VPS própria para WhatsApp.

## Perfis e validade

**Meu perfil** permite editar idade opcional, telefone, WhatsApp e foto. A ficha pessoal é privada para a própria pessoa e a gestão de pessoas. As fichas compartilhadas dos personagens do síndico/zelador continuam separadas e são preenchidas pela gestão. Fotos ficam no volume privado, com autorização em cada consulta.

**Pessoas e acessos** apresenta o diretório. Pelo menu da conta do síndico, **Pessoas, convites e acessos**, criam-se convites e revisam-se vínculos. O síndico aprova os acessos no piloto; proprietários informam/solicitam a renovação à gestão. Não há criação automática de contas ou senhas.

O anual exige cadastro residencial anual e **fim do contrato** explícito. O dia final é incluído até a meia-noite seguinte em Brasília; a validade concedida pode ser menor. Encerrar o cadastro ou reduzir o contrato interrompe o acesso. Renovar o contrato não amplia sozinho a validade concedida: a gestão revisa o vínculo da conta. Cadastros anuais antigos conservam a validade já concedida; novos convites e renovações exigem término contratual.

O temporário exige estadia aprovada. A entrada é inclusiva e a saída exclusiva. Não ativa a conta antes da chegada nem entra depois da saída. Cancelamento ou recusa impedem o acesso e encerram sessões vinculadas. O perfil tem somente a unidade atribuída e ações residenciais; não recebe fichas de moradores, listas de hóspedes ou tarefas internas.

## Uma conta Asaas do condomínio

Somente informar uma conta bancária não é suficiente: o recebedor precisa cadastrar/aprovar sua conta no Asaas e gerar uma chave de API. Não é exigido um banco externo específico. Os pagamentos entram no saldo Asaas; a transferência para banco/Pix de outra instituição é operada no Asaas. O Vilazuni não implementa transferências de dinheiro para fora do Asaas.

A orientação oficial sobre atividade de condomínio aceita conta PJ no CNPJ do condomínio ou PF com documentação complementar. Para este piloto, prefira identificar corretamente o recebedor do condomínio e concluir a análise documental indicada pelo Asaas; a integração não substitui essa aprovação.

1. No **Financeiro**, cadastre o fundo apropriado e uma conta bancária gerencial “Conta Asaas”, com saldo inicial conferido.
2. Em **Cobrança integrada → Conectar conta Asaas**, escolha homologação ou produção, selecione essa conta e informe a chave diretamente no formulário autenticado. Confirme o recebedor e, em produção, a finalidade real. A chave fica cifrada pelo cofre do servidor e não volta em consultas ou exportação do condomínio.
3. Clique **Configurar retorno automático**. O servidor cria ou atualiza o webhook da conexão com segredo próprio. O endereço público HTTPS precisa estar acessível pelo Asaas.
4. Cadastre o pagador com CPF/CNPJ, confira o vínculo privado ao recebível e prepare Pix ou boleto. Revise recebedor, pagador, valor, vencimento e ambiente. A cobrança é criada somente após confirmação explícita.
5. O pagador consulta em **Pix e boletos**. A gestão acompanha em **Cobrança integrada** e pode consultar ou cancelar a cobrança pendente no provedor. Cancelar o instrumento não apaga a dívida local.

Não há repetição automática do POST de emissão. Uma reserva persistida impede segunda cobrança da mesma contribuição. Se o retorno for incerto, consulte antes de emitir de novo. Clientes são recuperados por referência estável. Eventos de webhook são autenticados, deduplicados e consultados novamente na API Asaas; seu corpo não é usado como comprovação financeira.

Pagamento **RECEIVED** em produção lança receita bruta e despesa de tarifa na conta/fundo escolhidos, com identificadores de operação únicos e atualização atômica do saldo da contribuição. Usa a data de crédito/pagamento informada pelo provedor; data ausente, futura ou em período encerrado exige conferência, sem deslocar o recebimento silenciosamente para o dia da consulta. **CONFIRMED** aguarda disponibilização/recebimento; não antecipa dinheiro em caixa. Divergência de valores, pagamento fora do saldo local ou estorno/contestação do provedor requer conferência. Estornos não geram reversões automáticas: confira a movimentação efetiva e eventuais tarifas no provedor/extrato antes de ajustar o financeiro.

Cobranças externas de produção bloqueiam baixa manual duplicada, alteração de vencimento, mudança de pagador e renegociação da mesma origem enquanto não forem resolvidas no provedor. Encargos locais não são acrescidos automaticamente à emissão; a prévia impede sobrepor apuração ativa. A emissão deste piloto tem multa, juros e desconto automáticos zerados.

Homologação permanece identificada como simulação, não lança receita/despesa nem baixa a contribuição real. Pode-se trocar de Sandbox para produção após concluir/cancelar as simulações pendentes; o histórico de cada ambiente e seus clientes permanece separado. O piloto não permite trocar uma conta de produção com histórico por outra conta.

## Evolution e n8n

Os workflows e o prompt completo estão em [deploy/n8n](../deploy/n8n/README.md). A aprovação de comunicados acontece pelo mural. Lembretes de cobrança têm autorização por pagador, são privados e usam texto determinístico; não passam pela IA. Consultas do agente usam somente fontes vigentes publicadas para público externo. O conector não usa uma sessão administrativa do Vilazuni.

## Atualização e implantação

O servidor publica `/version.json` e `/healthz` com versão e impressão dos arquivos. Abas abertas verificam nova versão sem renovar a sessão e mostram **Atualizar aplicativo**, preservando o formulário até a decisão de recarregar. A PWA continua sem cache de API, fotos privadas ou credenciais.

Implante a branch/commit integrado pelo Easypanel, com o volume atual. Não regenere segredos nem reprovisione a base. Confira `/version.json` com versão **0.3.0**. Se a aba ainda usar a versão anterior, faça uma recarga completa; ela só passa a ter o aviso automático depois de receber esta atualização.

## Fontes oficiais consultadas

- [Atividades de uso restrito: cobrança de condomínio](https://central.ajuda.asaas.com/hc/pt-br/articles/31406442119067).
- [Transferências para outra instituição: Pix/TED](https://docs.asaas.com/docs/transferencia-para-contas-de-outra-instituicao-pix-ted).
- [Guia de cobranças, estados e recuperação de falhas](https://docs.asaas.com/docs/guia-de-cobrancas).
- [Notificações de clientes Asaas](https://docs.asaas.com/docs/alterando-notificacoes-de-um-cliente).
- [API e condições comerciais](https://www.asaas.com/api-de-pagamentos), [preços e tarifas](https://www.asaas.com/precos-e-taxas): integração sem tarifa própria não significa recebimentos ou mensagens gratuitos. Confirme as condições da conta na ativação.
- [API oficial de grupos Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups): a documentação de 15/10/2026 exige OBA e limita a 8 participantes. O usuário escolheu Evolution em sua infraestrutura; os workflows desta entrega usam essa escolha e precisam de homologação na versão instalada.
