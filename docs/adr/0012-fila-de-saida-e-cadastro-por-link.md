# ADR-0012 — Fila de saída dentro da API, e-mail por adaptador e cadastro por link

Situação: aceita (17/11/2026) · F1.1d. Implementa a decisão 2 do ADR-0011 (cadastro dos proprietários pelo link do condomínio) e o primeiro efeito externo da v1 (o e-mail do código). Revê, para o piloto, a parte do ADR-0006 que pedia um processo de worker e o pg-boss.

## 1. Fila de saída (outbox)

- A transação de negócio grava a mudança **e** o `outbox_event` (chave de idempotência única; repetir a chave não cria segundo envio). Nada sai de dentro da transação: o código só existe se o envio ficar registrado.
- **Despachante dentro da API** (`OutboxRunner`), a cada `OUTBOX_INTERVAL_MS` (5 s; `0` desliga): pega até 10 linhas vencidas com `FOR UPDATE SKIP LOCKED` (duas instâncias nunca pegam a mesma), trava por 60 s (linha presa de um processo que caiu volta sozinha), tenta até **5 vezes** com espera de 30 s × 2ⁿ⁻¹ (máximo 30 min) e então marca `dead`.
- Envio desligado → `skipped`; condomínio sem remetente e sem remetente de demonstração → `dead` com o motivo.
- Terminado (`sent`, `dead`, `skipped`), o registro **perde o conteúdo sensível**: o código e o texto saem; ficam o e-mail mascarado (`n***@dominio`), o modelo e o idioma, para conferência. O erro guardado é só o tipo e a mensagem curta do provedor.
- **Por que não o worker com pg-boss agora:** um só efeito (o e-mail do código) e uma instância no piloto; o `SKIP LOCKED` já aguenta várias instâncias. O worker próprio e o pg-boss entram quando chegar efeito que precise (cobrança, WhatsApp — Fases 2 e 3), e aí o ADR-0006 vale inteiro (revalidar antes do efeito, resultado incerto com conciliação).
- Repetir o e-mail de um código é inofensivo (o código vale 15 min e uma vez); por isso este efeito não tem o estado "incerto".

## 2. E-mail por adaptador (ADR-0008)

| Modo | O que faz |
|---|---|
| `disabled` (padrão) | não há envio; o cadastro responde 503 `envio_indisponivel` e a tela avisa "o envio ainda não está ligado" |
| `demo` | nada sai do servidor: o e-mail vai para a tabela `demo_mailbox`; a rota `GET /demo/mailbox?to=` mostra (só com `DEMO_MAILBOX_ROUTE=true`, que a configuração aceita **apenas** em demonstração com envio em modo demo) — usada nos testes de tela e para demonstrar |
| `sandbox` / `live` | Amazon SES v2 (conta da DMS, ADR-0011), região `SES_REGION` (padrão `sa-east-1`); credenciais pelas variáveis padrão da AWS **só no servidor** |

- Remetente = `condominium.email_sender` (por condomínio; o do Chandra será `nao-responda@chandra.vilazuni.com`). Produção recusa o modo demo.
- Texto simples, sem link clicável (o código se digita na página que a pessoa já abriu), em pt-BR, es e en.

## 3. Cadastro pelo link do condomínio

- **Link:** criado pela gestão com o poder `invitation.create` (o mesmo do convite); validade de 1 a 60 dias (padrão 14), limite de 1 a 500 cadastros (padrão 30). O token aparece **uma vez**; no banco fica o hash. Revogável. Criar e revogar ficam na auditoria (`signup_link.create`, `signup_link.revoke`). A tela lista os últimos 50 com a situação (ativo, vencido, esgotado, revogado) e o uso.
- **Código:** 6 dígitos aleatórios, guardado como hash de `id:código`, vale **15 minutos e uma vez**, **5 tentativas** (a tentativa errada fica gravada mesmo com o erro). Limites: 5 códigos por e-mail por hora (no banco, vale para várias instâncias) e 30 por endereço de rede por hora (na memória do processo; reinício zera — aceito no piloto).
- **Concluir:**
  - e-mail novo → a conta nasce (nome, senha de 12 a 128, idioma); o código acabou de provar o contato;
  - e-mail que já tem conta → **a senha dela** prova a posse (o código só prova o e-mail); o nome da conta não muda;
  - até 5 casas, cada uma vira pedido **pendente**; pedido aberto ou vínculo ativo na mesma casa não se duplica (índice `ownership_aberta`) e volta como "já tinha";
  - **nunca concede papel**; o link gasta 1 uso; a auditoria `signup.complete` guarda as casas pedidas e as que já tinham vínculo.
- Pedido de navegador de outra origem é recusado, como no entrar.

## 4. Configuração nova

`MESSAGING_MODE` (já existia; agora usado), `SES_REGION`, `OUTBOX_INTERVAL_MS`, `DEMO_MAILBOX_ROUTE`; no modo `live`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` de uma credencial que **só envia** (permissão `ses:SendEmail` restrita à identidade `chandra.vilazuni.com`).

## Consequências

- Para ligar de verdade (P23): verificar `chandra.vilazuni.com` no SES (registros DKIM no DNS da Hostinger), pedir a saída do sandbox do SES, criar a credencial só de envio, pôr no servidor da v1, gravar o remetente do Chandra e mudar para `MESSAGING_MODE=live`. O passo a passo vai ao dono quando a v1 for implantada.
- Até lá, a demonstração funciona inteira com a caixa da demonstração, e o convite individual (ADR-0009) continua como caminho sem e-mail.
- **Limpeza da base de teste (F1.1d, parte 3 — ADR-0011 §2):** `npm run limpar:demo -w @vilazuni/api` com o papel
  dono (`DATABASE_OWNER_URL`) e `VILAZUNI_ENV=demo` ou `sandbox` escrito (sem ele, ou em produção, recusa).
  Sem `-- --apagar` é só a prévia: faz tudo numa transação e desfaz, mostrando as contagens exatas. Apaga os
  condomínios com `environment = 'demo'` e tudo deles (inclusive a auditoria deles), as pessoas `[DEMO]` e as contas
  criadas nos condomínios de demonstração (cadastro pelo link, convite) — salvo quem tem qualquer registro em
  condomínio de sandbox ou produção, que fica e é contado. A limpeza deixa um registro na auditoria geral
  (`demo.cleanup`, com as contagens). Quem testou com o e-mail de verdade num condomínio de demonstração refaz o
  cadastro pelo link do condomínio real.
