# ADR-0011 — Decisões do dono de 17/11/2026

Situação: aceita (17/11/2026) · respostas do dono às cinco decisões pendentes listadas na página de decisões.

## 1. E-mail transacional (P23)

- **Decidido:** usar o que a DMS já tem — **Amazon SES em São Paulo**, com assinatura DKIM alinhada. O Resend foi lembrado pelo dono como alternativa; fica fora enquanto o SES servir.
- **Remetente (decidido pelo dono em 17/11):** o domínio **`chandra.vilazuni.com`**, verificado na mesma conta do SES (registros DKIM desse subdomínio no DNS da Hostinger, onde está `vilazuni.com`). O passo a passo vai ao dono quando a integração entrar. Um segundo condomínio terá o seu próprio subdomínio — o remetente é configuração por condomínio, não fixo no código.
- **Falta:** a credencial de envio do SES (fica só no servidor, como as outras).
- **Como entra no código:** adaptador `MessagingProvider`/e-mail (ADR-0008) com os modos de sempre; o envio sai pela fila durável com outbox (ADR-0006) — será o primeiro efeito externo da v1.

## 2. Cadastro dos proprietários (P02–P05)

- **Decidido:** o dono envia aos proprietários um **link de cadastro do condomínio**. Cada proprietário cria a conta com o **e-mail confirmado por código** e informa as casas; a titularidade nasce **pendente** até a gestão validar (como a especificação §6 pede).
- Isso revê a decisão 1 do ADR-0009 ("no piloto, a conta nasce pelo convite"): o convite individual continua, e o cadastro por link do condomínio passa a existir também. Regras do link: criado pela gestão, com validade, limite de usos, revogável, guardado só como hash; o cadastro nunca concede papel.
- **Testes:** com pessoas fictícias marcadas `[DEMO]`. Antes do uso real, a base de teste é limpa (comando que apaga só o que é de demonstração e recusa rodar em produção).

## 3. Repositório

- **Decidido:** continua **público durante o desenvolvimento** — em repositório privado no plano gratuito, os minutos do GitHub Actions acabam com os PRs constantes e travam a evolução. O material sensível fica fora do git (`.gitignore`). Fica **privado ao final**.

## 4. Multa e juros no app atual (M4)

- **Decidido:** o padrão de mercado mais baixo — **multa de 2%** e **juros de 1% ao mês, proporcionais aos dias de atraso** (cerca de 0,033% ao dia), enviados ao Asaas nas cobranças do app 0.7.8.
- A frase do dono ("1% a cada dia excedente") foi lida como 1% ao mês por dia de atraso, que é o padrão de mercado e o que o Asaas aplica. 1% **ao dia** daria mais de 30% ao mês e passaria do limite legal; não é aplicado.
- Na v1, esses valores viram a proposta da regra financeira do piloto na Fase 2, a conferir com a convenção (P01, P07). A ADR-0005 continua: sem regra cadastrada, a cobrança fica pendente.
- **Como ficou no app atual (0.7.9):** os valores vêm da **regra de encargos aprovada** que cobre o vencimento da conta (cadastrada por uma pessoa e aprovada por outra, como já era). A cobrança leva multa (%) e juros ao mês (%) ao Asaas; a tela da prévia mostra os encargos. Pago com atraso, a conta quita pelo valor dela e os encargos entram à parte ("Encargos pagos pelo Asaas"); se os campos do Asaas não conferirem entre si, a cobrança vai para conferência, sem lançamento adivinhado. O estorno devolve primeiro os encargos e só depois reabre a conta. Sem regra aprovada, a cobrança sai sem encargos, como antes, e o cálculo manual continua recusado para conta cobrada pelo Asaas (nunca cobra duas vezes).
- **Limite conhecido:** conta que já estava vencida é emitida com vencimento no dia (ERR-021 do registro interno); o Asaas só cobra multa e juros depois desse novo vencimento — o atraso anterior à emissão não entra na cobrança.

## 5. Troca do app atual pela v1

- **Decidido:** seguir a recomendação — a v1 substitui o app atual (0.7.x) depois que a **Fase 1 inteira** funcionar em demonstração, com a **exportação dos dados atuais** antes. A troca terá registro próprio.
