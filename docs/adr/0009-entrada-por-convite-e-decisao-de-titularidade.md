# ADR-0009 — Entrada por convite e decisão de titularidade

Situação: aceita (17/11/2026) · F1.1a

## Contexto

A especificação (§6) pede: titularidade nasce **pendente** até validação por responsável autorizado; convite individual de uso único, com token guardado só como hash, validade e tentativas limitadas; e-mail **verificado**; recuperação de conta nunca concede propriedade. Ainda não há provedor real de e-mail transacional (pendência P23).

## Decisões

1. **No piloto, a conta nasce pelo convite.** A gestão autorizada (`invitation.create`) gera o convite para uma casa e um e-mail; a API devolve o link **uma vez** (no banco fica só o SHA-256 do token) e a gestão o envia pelo canal que já usa. Abrir o link prova a posse do e-mail; o aceite cria a pessoa, o contato verificado, a senha (argon2id) e a titularidade **pendente**. Autocadastro aberto (sem convite) fica para quando houver verificação de e-mail por provedor real (P23).
2. **Quem já tem conta aceita com a senha dela.** O convite nunca troca senha nem "assume" conta existente pelo e-mail.
3. **Aceite errado conta tentativa.** E-mail diferente do convite ou senha errada da conta existente gravam `attempts + 1` (a transação confirma antes de responder o erro); no limite (5), o convite fica bloqueado (`410 convite_bloqueado`). Dois aceites ao mesmo tempo: a linha do convite é travada (`for update`); só um vínculo nasce.
4. **Ninguém decide o próprio pedido de titularidade** (`403 nao_pode_decidir_o_proprio`). Sem isso, quem tem `ownership.validate` (síndico, Tenaz com escopo `cadastro`, subsíndico delegado) se daria a casa que quisesse.
5. **Decisão com versão e repetição idempotente.** Validar/recusar exige a `version` lida; versão diferente = `409 versao_desatualizada`. A MESMA decisão repetida pela mesma pessoa (rede caiu, app reenviou) devolve o estado atual sem gravar de novo nem duplicar a auditoria. Recusa exige motivo, que a própria pessoa vê em "Minhas casas".
6. **Pendente não abre a casa.** A pessoa pendente vê em "Minhas casas" que está pendente, mas `GET /units/:id` responde 404 até a validação.
7. **E-mail normalizado no banco** (`check` em `verified_contact`): a API normaliza na entrada, e semeadura, importação e migração do app anterior não passam pela API (ERR-022 do registro interno).
8. **Morador de contrato por convite** entra na F1.2, junto com a validação do vínculo dele — nenhum vínculo fica pendente sem rota de decisão.

## Consequências

- Convite repetido por clique duplo gera dois tokens; o não usado vence sozinho. Chave de idempotência genérica (`Idempotency-Key`) entra na F1.2, com as estadias.
- Recuperação de acesso (esqueci a senha) depende de P23 e nunca altera vínculo.

## Testes

`apps/api/test/identidade.test.ts` (T01, T06, validação, T04, T05, T02/T03/T54, T20, T19) e `apps/api/test/auth.test.ts` (T56, sessões, limite de tentativas).
