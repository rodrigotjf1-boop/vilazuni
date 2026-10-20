# Etapa 4 — encerramento do piloto financeiro manual

Atualização: 20/10/2026. Decisão do usuário: **manter somente cobrança manual por enquanto**. A etapa 4 fica concluída nesse escopo do piloto local. A condição original de integração com parceiro e retornos autenticados permanece adiada; não foi validada por simulação nem substituída por informação de pagamento do morador. Produção continua dependendo da infraestrutura e homologação previstas no plano.

## Entregas e critérios de aceite

| Frente | Entregue no piloto |
|---|---|
| Contas, fundos e razão | Centavos inteiros; saldo por conta/fundo; referências, versões, concorrência e estornos sem apagar originais |
| Compras e compromissos | Importação única de compras recebidas; contas a pagar e receber; baixas integrais/parciais e residual histórico |
| Orçamento | Previsão versionada por fundo/categoria e comparação ao caixa líquido |
| Taxas | Rateios por unidade aprovados, distribuição exata de centavos e geração única; modelos recorrentes preparados manualmente |
| Acordos | Proposta, aprovação, ativação de parcelas, cancelamento e restauração do residual sem duplicar principal |
| Cobrança manual | Aviso privado a conta explicitamente vinculada; instruções informadas pela gestão; cancelamento e substituição auditados |
| Atrasos e previsão | Faixas a vencer, 1–30, 31–60, 61–90 e mais de 90 dias; total por unidade/competência e previsão por vencimento |
| Encargos | Regra documentada, vigência e percentuais explícitos; aprovação por outra pessoa; memória diária e recebível separado |
| Contestação | Canal privado, acompanhamento, pagamento informado sem baixa, suspensão administrativa e bloqueio de novos avisos/lembretes/encargos durante análise |
| Lembretes | Régua configurada por controle; preparação manual dos avisos internos do dia, sem repetição |
| Conciliação | CSV com prévia, vínculos individuais, diferenças e cobertura mensal; não altera caixa |
| Fechamento | Corte histórico, revisão atual, relatório/exportação JSON com hash e reabertura auditada do último mês pelo síndico |

## Usar a cobrança manual

1. O síndico concede operação (`finance`), controle (`financeClose`), consulta (`financeRead`) e exportação (`financeExport`) de forma independente. Operação emite/cancela avisos e prepara lembretes. Controle vincula pagadores, configura régua, trata suspensões/análises e apura encargos. Leitura não concede escrita.
2. Em **Contas a receber → Cobrança e acesso do pagador**, controle escolhe uma conta residencial ativa com fundamento. Contribuições vinculadas a unidade exigem acesso dessa conta à unidade. Copropriedade, ocupação e área não determinam automaticamente pagador ou responsabilidade jurídica.
3. Operação emite aviso com referência única e orientações conferidas. Uma conta a receber tem no máximo um aviso ativo; cancelar aviso não cancela a dívida. Valor na emissão é preservado, e o portal também mostra o saldo restante atual. O aplicativo não gera boleto, QR Pix ou transação bancária.
4. O destinatário usa **Minhas cobranças**, sem acesso a fundos, contas bancárias, saldos gerais ou dívidas de outras pessoas. Pode contestar ou informar pagamento e acompanhar a análise. Informação de pagamento não cria receita nem baixa; a operação confere o fato e registra pelo fluxo existente.
5. Análise aberta/em andamento e suspensão administrativa são controles independentes. Resolver análise não retira suspensão administrativa, não registra entrada e não decide automaticamente a validade da dívida. Acompanhamentos da análise são compartilhados com o destinatário vigente. Trocar/remover pagador cancela avisos anteriores e revoga sua consulta e seus avisos de alteração; relatos antigos não são transferidos ao novo destinatário.
6. Em **Cobranças e atrasos**, controle configura dias relativos ao vencimento (-30 a 120, até 12 dias). Operação usa **Preparar lembretes de hoje**. Só avisos ativos com saldo aberto, pagador vigente e sem suspensão/análise geram lembrete. A mesma conta/vencimento/dia não é repetida, mesmo após substituição do aviso. Não há agendador ou mensagens externas.

As parcelas de acordo preservam o pagador explícito da origem, mas cada aviso exige emissão pela operação. Origem com contestação/suspensão não pode ser renegociada antes da análise. Cancelar acordo cancela avisos ativos das parcelas; baixas e apurações de encargos dessas parcelas precisam ser tratadas antes. O saldo de origem volta sem duplicação. Vínculos de acesso continuam individuais por recebível; alterações futuras não são propagadas automaticamente a outros registros.

## Encargos e memória de cálculo

Controle propõe referência, fundamento documental, intervalo de vencimentos, multa e juros anuais explícitos. Não há taxa padrão: zero deve ser informado no componente não aplicável. Outra pessoa com controle deve confirmar fundamento, vigência, método e percentuais antes da aplicação. A confirmação registra a validação informada; o aplicativo não a substitui por interpretação jurídica. Regra aprovada é imutável: retirar impede novas aplicações e preserva memórias; mudanças exigem outra referência.

Método disponível: multa única sobre saldo ao fim do vencimento e juros simples anuais divididos por 365, sobre saldo ao fim de cada dia. Baixas e estornos alteram a base diária. O cálculo acumula frações com inteiros e arredonda uma única vez ao centavo, com meio centavo para cima. Percentuais são guardados em centésimos de ponto percentual. O limite técnico de 0–100% não define limites legais. Aplique apenas se o método corresponder à regra validada.

A prévia não grava. A confirmação exige revisão atual e cria recebível separado, preservando principal, unidade/competência, pagador explícito e memória. Novas apurações começam após o último intervalo ativo; multa não é repetida e não há juros sobre encargos. Mudanças nos termos limitam a apuração ao dia da última alteração. Até 3.660 dias por apuração e R$ 1.000.000,00 por recebível. Período de apuração não pode ser futuro; registro é feito na data atual aberta. Baixa, estorno, revisão de termos ou ativação de acordo em dia já coberto por apuração ativa exige revisar/cancelar essa apuração antes de mudar a base. Para registrar recebimento hoje sem rever a apuração, o cálculo deve terminar antes de hoje.

Para cancelar, tratar primeiro avisos e baixas do encargo, da última apuração para a primeira. Memória e histórico permanecem; o principal não é apagado. Cancelar principal com encargos ativos exige revisar/cancelar suas apurações. Encargos não podem ser cancelados pela alteração genérica do recebível ou renegociados para gerar juros sobre juros.

Não estão implementados correção por índice, descontos, consolidação de várias origens ou métodos jurídicos alternativos. Acordos existentes são de principal sobre uma origem. Essas evoluções não foram apresentadas como entregues.

## Validação e continuação

`npm test --prefix app`: 151 testes aprovados. Incluem privacidade entre coproprietários/condomínios, revogação, concorrência de emissão/aplicação, persistência/reinício, régua sem duplicação, suspensão, acordos, bases diárias e arredondamento, versões, corte histórico e hashes anteriores. Chromium com dados sintéticos: criação, vínculo, aviso, portal móvel, análise sem baixa, lembrete único, segunda aprovação, memória sem gravação, encargo separado, baixa parcial, cancelamento/substituição, revogação, fechamento/exportação e consulta sem escrita.

Prévias: [aviso manual](../previa-cobranca-manual.png), [portal do pagador no celular](../previa-minhas-cobrancas-mobile.png) e [memória de encargos](../previa-memoria-encargos.png).

Próxima etapa do roadmap: **5 — Passeio virtual**, integração contextual às fichas, navegação móvel e alternativa por mapa/lista. Banco/parceiro, cobrança bancária, retornos autenticados e produção serão retomados quando autorizados e configurados, sem alterar a decisão atual de cobrança manual.
