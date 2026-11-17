# ADR-0010 — Segundo fator e poderes de gestão

Situação: aceita (17/11/2026) · F1.1b

## Contexto

Especificação §6: MFA obrigatório para síndico, Tenaz com poder financeiro, suporte privilegiado e alterações críticas; mandato com início, fim e ata; subsíndico, conselho e Tenaz só no escopo concedido. ADR-0003 escolheu `otplib` para TOTP; ADR-0007 definiu o cofre de campo.

## Decisões

1. **TOTP com segredo no cofre.** `otplib` 13.6.0; o segredo vai cifrado (XChaCha20-Poly1305 com envelope, `@noble/ciphers` 2.4.0), com o id da pessoa como dado associado — o texto cifrado de uma pessoa não abre como de outra. Chaves-mestras em `VILAZUNI_MASTER_KEYS` (`id:base64`, a primeira cifra, as demais só abrem — rotação). Fora da demonstração a API não sobe sem chave; sem chave, configurar o segundo fator responde `503 cofre_indisponivel`.
2. **Proteção contra repetição e força bruta.** O passo de tempo do último código aceito fica gravado: o mesmo código (ou um mais antigo) não vale de novo (T06). Cinco códigos errados travam por 15 minutos (a tentativa errada é gravada antes do erro sair).
3. **Códigos de recuperação**: 10 por pessoa, mostrados uma vez, guardados como SHA-256, uso único; aceitam maiúscula/minúscula e com ou sem hífen.
4. **Configurar e trocar de aparelho pedem a senha**; trocar também pede o segundo fator recente, apaga a credencial e os códigos e tira a verificação de TODAS as sessões da pessoa.
5. **Gestão exige o segundo fator na sessão.** O que vem do papel de síndico (com mandato vigente), de delegação ou de escopo financeiro da Tenaz só vale com a sessão verificada (`403 mfa_exigido`). O que vem do vínculo com a casa, do conselho (só leitura) e do escopo `cadastro` da Tenaz não pede.
6. **Atos críticos** (papel, mandato, delegação, convite para papel) exigem o segundo fator **recente** — até 15 minutos (`403 mfa_recente_exigido`).
7. **Ninguém concede papel ou delegação a si mesmo** (`403 nao_pode_conceder_a_si`), inclusive aceitando o próprio convite de papel. Sem isso, o poder sobreviveria ao fim do mandato.
8. **Delegação**: nunca repassa ato crítico (só `DELEGABLE_ACTIONS`); não passa do fim do mandato de quem delega; síndico não recebe delegação. Encerrar um papel encerra junto os mandatos e delegações dele.
9. **Mandatos de síndico não se sobrepõem** no condomínio (trava por condomínio na transação). Renovar o próprio mandato é permitido — pela ata registrada — e fica marcado na auditoria (`own: true`) para o conselho ver. O mandato que vale é o **vigente agora**: uma renovação já registrada para o futuro não tira a gestão de hoje.
10. **Síndico não entra por convite** (precisa do mandato e da ata, por `POST /roles`); os demais papéis podem entrar por convite, que cria o papel ativo no aceite.
11. **Auditoria** é lida por quem tem `audit.read` (síndico com segundo fator, conselho fiscal), paginada pelo id; mostra só o condomínio ativo. Eventos pessoais do segundo fator ficam sem condomínio e não aparecem ali.

## Consequências

- Mandato que venceu sem a renovação registrada deixa o condomínio sem quem registre o novo: a renovação precisa entrar antes do fim (a tela avisará 30 dias antes, F1.1c). O caminho de exceção é o suporte com concessão temporária (Fase 2, papel `support`).
- A lista de quem precisa de segundo fator acompanha a matriz (`docs/matriz-permissoes.md`).

## Testes

`packages/domain/src/authz/policy.test.ts`, `apps/api/test/governanca.test.ts`, `apps/api/test/vault.test.ts`, `apps/api/test/seed.test.ts`.
