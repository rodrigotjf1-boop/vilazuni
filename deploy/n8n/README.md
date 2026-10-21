# Agente Vilazuni com Evolution API e n8n

Piloto com **um condomínio e uma conta Asaas própria**, sem criação de subcontas. Os arquivos são modelos importáveis para n8n com nós nativos; chegam **desativados** e sem credenciais. A execução contra sua versão instalada do n8n/Evolution precisa ser homologada antes de ativar o grupo real.

## Preparação no Vilazuni

1. Implante a versão 0.3.0 no Easypanel. Mantenha banco, volume e chaves atuais. A atualização usa as coleções existentes; não execute novamente a primeira instalação.
2. Entre como síndico, com segundo fator ativo. Em **Agente WhatsApp**, informe o JID do grupo retornado pela Evolution (`…@g.us`), habilite a conexão e salve.
3. Copie a chave exibida uma única vez diretamente para uma credencial **Header Auth** no n8n: nome do cabeçalho `x-vilazuni-token`. O Vilazuni guarda somente seu hash. Gerar outra chave invalida a anterior. Desabilitar a conexão interrompe as consultas/entregas do workflow.
4. Em **Consultar → gestão de fontes**, cadastre e revise regras, horários, contatos institucionais e procedimentos reais. Publique para **público externo** somente o que pode ser respondido no grupo. Fontes apenas internas ou para usuários do aplicativo não são entregues ao agente.

## Workflow 01: comunicados e cobranças

Importe [01-entregar-comunicados-e-cobrancas.json](01-entregar-comunicados-e-cobrancas.json). No nó **Configuração**, preencha a URL HTTPS da Evolution e o nome da instância conectada ao número do condomínio. `vilazuniUrl` já usa `https://app.vilazuni.com`.

Crie/selecione as credenciais:

| Credencial | Tipo | Cabeçalho | Valor preenchido privadamente |
|---|---|---|---|
| Vilazuni - agente | Header Auth | `x-vilazuni-token` | Chave limitada gerada no aplicativo |
| Evolution - API | Header Auth | `apikey` | Chave da sua Evolution API |

O fluxo reserva uma mensagem a cada 30 segundos, envia por `POST /message/sendText/{instância}` e registra o identificador aceito pela Evolution. Há uma única reserva por mensagem. Timeouts, erros ou respostas sem identificador ficam como **entrega incerta**, sem repetir automaticamente. Se a confirmação ao Vilazuni falhar, a reserva também se torna incerta após cinco minutos. Confira o histórico da Evolution antes de qualquer reenvio manual. “Entregue à Evolution” não comprova leitura do WhatsApp.

**Comunicados:** abra um aviso no mural, clique **Enviar aviso ao agente**, confira o texto e aprove o envio. Somente a gestão de comunicação aprova. Editar, arquivar ou expirar o aviso antes da reserva cancela a versão antiga na fila. Depois da reserva, a entrega pode já estar em trânsito; retirar o aviso no aplicativo não apaga uma mensagem enviada ao WhatsApp. O compartilhamento manual pelo botão WhatsApp continua disponível.

**Cobranças:** configure antes a conta Asaas e sua régua de lembretes internos. Em **Cobrança integrada → Pagadores e vínculos**, confira o celular com DDD e registre a autorização para mensagens privadas via Evolution/n8n. A régua prepara lembretes 3 dias antes, no vencimento e 1, 7, 15 e 30 dias depois. Cada lembrete é único por dia/cobrança. Só entram cobranças de produção abertas, com pagador vigente e autorizado. Pagamento, suspensão, contestação, retirada da autorização ou fim do vínculo impedem novas reservas. Uma mensagem já reservada pode estar em trânsito; o texto orienta a conferir o pagamento no Asaas.

O destinatário e o texto são definidos pelo servidor. Cobranças individuais seguem para o número privado, nunca para o JID do grupo. **Esse workflow não usa IA** e não permite alterar valor, vencimento ou link. As notificações pagas próprias do Asaas permanecem desativadas para os clientes criados/geridos pela integração, evitando uma segunda régua independente.

## Workflow 02: perguntas ao agente

Importe [02-agente-perguntas-condominio.json](02-agente-perguntas-condominio.json). Preencha no nó **Configuração** o mesmo JID do grupo, URL da Evolution, instância, endpoint de chat da IA e nome do modelo disponível na sua conta. O exemplo usa a interface **OpenAI Chat Completions**. Provedores compatíveis podem ser usados com seu endpoint; provedores de outro protocolo exigem adaptar o nó de IA e seu parser.

Além das credenciais anteriores, configure:

| Credencial | Tipo | Cabeçalho | Valor |
|---|---|---|---|
| IA - Bearer token | Header Auth | `Authorization` | `Bearer ` seguido da chave da IA escolhida |
| Evolution - webhook | Header Auth | `x-vilazuni-webhook` | Um segredo próprio para a entrada do workflow |

Use a **Production URL** do nó **Entrada Evolution** no webhook `MESSAGES_UPSERT` da instância Evolution. Configure a Evolution para enviar o cabeçalho `x-vilazuni-webhook` com esse segredo. Se sua versão não oferecer cabeçalhos de webhook, faça a autenticação no proxy antes de publicar a entrada; não remova a autenticação para contornar isso. Não usar o token administrativo da Evolution como segredo do webhook.

O workflow ignora mensagens do próprio número, de outros grupos e sem o prefixo **`/vilazuni `**. Exemplo: `/vilazuni Qual é o horário da piscina?`. Ele consulta o contexto publicado do condomínio, aplica o [prompt completo](PROMPT_AGENTE_CONDOMINIO.md) e só aceita respostas JSON com IDs de fontes presentes no contexto. Na ausência de fontes válidas, encaminha à gestão. A verificação dos IDs limita a resposta às referências fornecidas; a qualidade factual do texto gerado ainda precisa de homologação com a IA escolhida.

Perguntas sobre cobrança, documentos pessoais, credenciais ou saldo recebem orientação de canal privado, sem chamada à IA. O agente não concede acesso, altera cadastros, cria obrigações, confirma pagamentos ou aciona portões. O destino da resposta é o grupo configurado, nunca um destino sugerido pela IA.

## Homologação antes de ativar

Use um grupo e um número privados de teste. Execute primeiro o workflow de fila com um aviso sintético aprovado. Confira destinatário, texto, identificador e estado de entrega no Vilazuni. Simule falha da Evolution e confirme que a mensagem não é repetida. Depois teste perguntas com regra publicada, informação ausente, pedido de dado pessoal, mensagem do próprio bot e mensagem de outro grupo.

Para cobrança, use Asaas Sandbox e pessoas sintéticas para testar a emissão. O Vilazuni não encaminha cobranças Sandbox para WhatsApp nem movimenta o caixa real; o teste da entrega privada pode usar uma mensagem sintética separada na Evolution. Homologue uma cobrança real somente depois de conferir conta aprovada, tarifas, pagador e sua autorização.

Os modelos desabilitam o armazenamento de execuções com sucesso ou erro no n8n. Evite fixar dados de execução, exportar credenciais ou registrar corpos completos nos proxies. As URLs e nomes da instância podem ficar na configuração do workflow; chaves ficam nas credenciais do n8n. Custos da IA, número/provedor e infraestrutura dependem dos serviços escolhidos.

Nenhum workflow foi ativado na sua VPS nem enviou mensagens reais nesta entrega.
