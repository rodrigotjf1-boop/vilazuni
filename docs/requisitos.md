# Requisitos rastreáveis

Situação: ⬜ não iniciado · 🟡 em andamento · ✅ implementado e testado · ⛔ bloqueado (pendência externa). Seção = seção da especificação v1.0.

## Fase 0 e Fase 1

| ID | Requisito | Seção | Tela | Endpoint | Entidade | Teste | Situação |
|---|---|---|---|---|---|---|---|
| RQ-001 | Janela do hóspede: `check_in − 3 h ≤ agora < check_out + 30 min`, pelo relógio do servidor | §7 | Minha estadia | toda rota de hóspede | `stay_access_grant` | T07, T08, T09 | 🟡 regra pura |
| RQ-002 | Volume da piscina: nominal por trechos, confirmado opcional > 0, tipo "provisório"/"confirmado" | §13 | Piscina | `/pool/profile` | `pool_profile` | T34 | 🟡 regra pura |
| RQ-003 | Energia: `kWh = W/1000 × h/dia × dias`; vazio = pendente; zero confirmado ≠ ausente; mesma bomba não duplica horas | §13 | Piscina › Custos | `/pool/cost-estimates` | `pump_usage` | T35, T36 | 🟡 regra pura |
| RQ-004 | Unidades de estoque: kg↔g e L↔mL; massa↔volume nunca sem densidade | §12 | Estoque | `/stock/*` | `stock_item` | T32 | 🟡 regra pura |
| RQ-005 | Dinheiro em centavos inteiros; multa até 2%; juros sem regra = pendente | §9 | Minhas contribuições | `/charges` | `financial_rule_version` | T28 | 🟡 regra pura |
| RQ-010 | Autocadastro nunca concede papel; titularidade nasce pendente | §6 | Pedir titularidade | `POST /ownership-requests` | `ownership` | T01 | ⬜ |
| RQ-011 | Autorização por papel + condomínio + unidade + vínculo + período + ação, negar por padrão | §6 | todas | todas | `role_assignment`, `ownership` | T02–T05, T20 | ⬜ |
| RQ-012 | Isolamento por condomínio com chave composta e RLS | §5, §6 | — | todas | todas de negócio | T03, T54 | ⬜ |
| RQ-013 | Convite de uso único, hash, validade, tentativas | §6 | Aceitar convite | `/auth/invitations` | `invitation` | T06 | ⬜ |
| RQ-014 | Sessão web por cookie HttpOnly + CSRF + origem; nativa por bearer + refresh rotativo | §6 | Entrar, Sessões | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/sessions` | `auth_session` | T56 | ⬜ |
| RQ-015 | Mandato do síndico com início, fim e ata; vencido perde gestão, mantém proprietário | §6 | Gestão › Pessoas | `/mandates` | `mandate` | T19 | ⬜ |
| RQ-016 | Subsíndico, conselho e Tenaz só no escopo concedido | §6 | Gestão › Pessoas | `/delegations` | `delegation`, `role_assignment` | T20 | ⬜ |
| RQ-017 | Proprietário com duas casas; copropriedade sem duplicar dívida ou vaga | §5, §6 | Minha casa | `/me/units` | `ownership` | T04, T05 | ⬜ |
| RQ-018 | MFA obrigatório para síndico, Tenaz financeiro, suporte e atos críticos | §6 | Entrar, Conta | `/auth/mfa` | `auth_credential` | — | ⬜ |
| RQ-019 | Seed repetível do Chandra com 14 casas, 14 vagas e pessoas fictícias identificadas; impossível em produção | §24 | — | — | todas | — | ⬜ |
| RQ-020 | Auditoria só acréscimo: ator, papel, ação, objeto, resultado, motivo, correlation_id | §22 | Gestão › Auditoria | `/audit-events` | `audit_event` | — | ⬜ |

## Fases seguintes

Os requisitos das Fases 1.2 a 5 recebem IDs (RQ-030 em diante) no incremento que os detalha, ligados aos testes T07–T58 da especificação.
