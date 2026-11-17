# Situação da implementação — Vilazuni v1

Atualizado a cada PR. "Implementado" = no código, com teste executado e resultado registrado. Mock, teste não executado ou integração sem homologação **não** contam como prontos.

Última atualização: 17/11/2026 — Fase 0 (F0.1–F0.3).

## Implementado e testado

| Item | Onde | Testes (resultado) |
|---|---|---|
| Janela do hóspede (−3 h / +30 min, semiaberta, relógio do servidor); entrada física separada | `packages/domain/src/time` | T07, T08, T09 e janelas independentes por estadia — 7 casos ✅ |
| Volume da piscina exato (19.305 + 9.045 = 28.350 L), confirmado > 0, provisório | `packages/domain/src/pool/volume.ts` | T34 — 3 casos ✅ |
| Energia da bomba, pendente × zero confirmado, união de horas da mesma bomba | `packages/domain/src/pool/energy.ts` | T35, T36 — 3 casos ✅ |
| Calculadora de custos idêntica à planilha (3,402 kg; R$ 122,1318; R$ 119,76; R$ 241,8918; R$ 316,8918; compra R$ 508,70; exemplo com energia R$ 465,39) | `packages/domain/src/pool/budget.ts` | 4 casos ✅ |
| Unidades do estoque (kg/g, L/mL; massa↔volume só com densidade e fonte; contagem não converte) | `packages/domain/src/stock` | T32 — 4 casos ✅ |
| Multa até 2% em centavos; juros sem regra = pendente | `packages/domain/src/money` | T28 — 4 casos ✅ |
| API: saúde, prontidão (banco), CORS só para origens permitidas, cabeçalhos seguros, configuração validada; produção recusa adaptador de demonstração | `apps/api` | 6 casos ✅ |

Total: **31 testes, 31 aprovados** (`npm test`, 17/11/2026). Compilação TypeScript 6.0.3 estrita sem erro.

## Em andamento

- **F1.1** Identidade, condomínio e permissões (ver `docs/PLANO.md`).

## Bloqueado por informação externa

Ver `docs/pendencias-implantacao.md` (P01–P22). Nada bloqueia o desenvolvimento; bloqueia só o efeito real ligado a cada item.

## App anterior

`app/` (0.7.8) segue no ar sem mudança até a troca (ADR-0001).
