# Matriz de permissões

Regra geral: **negar por padrão**. Toda decisão é tomada no servidor a cada pedido, a partir de **papel + condomínio + unidade + vínculo + período + ação** (ADR-0004). Esconder menu não é barreira. A matriz abaixo é a fonte da função `can()` de `packages/domain` e dos testes T01–T06, T19, T20.

## Vínculos e papéis

| Tipo | Onde vive | Vale quando |
|---|---|---|
| Proprietário (`owner`) | `ownership` (unidade, pessoa, início, fim, situação) | situação `validada` e período vigente |
| Morador de contrato (`resident`) | `residency` | situação `ativa` e período vigente |
| Hóspede (`guest`) | `stay_access_grant` | estadia confirmada e janela `check_in − 3 h ≤ agora < check_out + 30 min` |
| Síndico (`syndic`) | `role_assignment` + `mandate` | mandato `vigente` (início ≤ agora < fim) |
| Subsíndico (`subsyndic`) | `role_assignment` + `delegation` | só o que a delegação documentada concede, no período dela |
| Conselheiro fiscal (`fiscal_council`) | `role_assignment` | período vigente; **só leitura** do que fiscaliza |
| Tenaz (`administrator`) | `role_assignment` com escopos | escopos contratuais listados, período vigente |
| Prestador (`service_provider`) | `role_assignment` | período do contrato |
| Segurança (`security_reviewer`) | `role_assignment` com prazo | papel adicional, delegado, com prazo e auditoria |
| Suporte técnico (`support`) | concessão temporária | justificada, com prazo, auditada; sem impersonação silenciosa |

Um usuário pode ter vários vínculos ao mesmo tempo; cada ação usa só o vínculo que a autoriza.

## Ações da Fase 1 (F1.1)

| Ação | Proprietário | Morador | Hóspede | Síndico | Subsíndico | Conselho | Tenaz | Prestador |
|---|---|---|---|---|---|---|---|---|
Legenda: **2F** = exige o segundo fator confirmado na sessão; **2F recente** = confirmado há até 15 minutos.

| Ação | Proprietário | Morador | Hóspede | Síndico | Subsíndico | Conselho | Tenaz | Prestador |
|---|---|---|---|---|---|---|---|---|
| `condominium.read` (nome, regras públicas) | ✅ | ✅ | ✅ (na janela) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `unit.read.own` (minhas casas) | ✅ próprias | ✅ a dele | — | — | — | — | — | — |
| `unit.read.all` (cadastro das 14 casas) | visão mínima (F1.2) | — | — | ✅ 2F | delegação, 2F | ✅ leitura | escopo `cadastro` | — |
| `unit.manage` (criar/editar casas e vagas) | — | — | — | ✅ 2F | delegação, 2F | — | — | — |
| `ownership.request` (pedir titularidade) | ✅ (pendente) | ✅ (pendente) | — | ✅ | com vínculo | ✅ | — | — |
| `ownership.validate` (validar/recusar) | — | — | — | ✅ 2F | delegação, 2F | — | escopo `cadastro` | — |
| `invitation.create` (convidar para titularidade; gerar, listar e revogar o link de cadastro do condomínio) | — | — | — | ✅ 2F | delegação, 2F | — | escopo `cadastro` | — |
| `person.read.all` (Gestão › Pessoas e papéis) | — | — | — | ✅ 2F | delegação, 2F | — | escopo `cadastro` | — |
| `audit.read` | — | — | — | ✅ 2F | delegação, 2F | ✅ | — | — |
| `role.assign` (papel e convite para papel) / `mandate.manage` / `delegation.manage` | — | — | — | ✅ 2F recente | nunca (não se delega) | — | — | — |
| `session.manage.own` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Notas:

- **Autocadastro/aceite** cria só pedido de titularidade **pendente**; campo de papel no corpo é **recusado** (`400 campo_nao_permitido`) e nada é concedido (T01).
- **Ninguém decide o próprio pedido** de titularidade (`403 nao_pode_decidir_o_proprio`) — ADR-0009.
- Casa de outra pessoa ou de outro condomínio responde `404` igual a "não existe" (T02, T03, T54); a negação fica na auditoria.
- Ação de gestão com **mandato vencido** é negada mesmo com sessão aberta; o vínculo de proprietário da mesma pessoa continua valendo (T19).
- Sem o segundo fator na sessão: `403 mfa_exigido`; sem ele recente nos atos críticos: `403 mfa_recente_exigido` (ADR-0010).
- **Ninguém concede papel ou delegação a si mesmo** (`403 nao_pode_conceder_a_si`); delegação não passa do fim do mandato de quem delega; mandatos de síndico não se sobrepõem (ADR-0010).
- Escopo `financeiro` da Tenaz (Fase 2) exigirá 2F.
- "Visão mínima" do proprietário sobre as outras casas (ocupação/vaga, identificação mínima) entra na F1.2, com a ocupação; até lá `GET /units` é só de gestão e conselho.
- Conselho fiscal **nunca** edita o que fiscaliza.
- Tenaz não tem superadmin, senhas residenciais nem gravações por padrão.

As ações das fases seguintes (estadia, segredos, finanças, piscina, câmeras, IA) entram nesta matriz no incremento que as implementa.
