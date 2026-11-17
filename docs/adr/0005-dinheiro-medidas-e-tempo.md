# ADR-0005 — Dinheiro, medidas e tempo

- **Situação:** aceita (17/11/2026).

## Dinheiro

- Valores em **centavos inteiros** (`bigint` no banco, `bigint`/inteiro seguro no código); nada de ponto flutuante em cálculo monetário.
- Multa, juros e correção calculados por função pura com **regra financeira versionada** e memória de cálculo; arredondamento declarado na regra.
- Multa até 2% (Código Civil art. 1.336 §1º, Lei 14.905/2024). Juros: os da convenção; sem regra cadastrada, a cobrança real fica **pendente** — nunca "1% ao mês" por padrão (T28).
- Correção de lançamento por **lançamento compensatório**, sem apagar.

## Medidas

- `numeric` com unidade explícita na coluna ou ao lado (`kg`, `g`, `L`, `mL`, `un`, `m`, `m³`, `W`, `h`, `kWh`, `R$/kWh`).
- Conversão só dentro da mesma grandeza (kg↔g, L↔mL); **massa ↔ volume nunca** sem densidade documentada (T32).
- "Ausente" é diferente de "zero confirmado": campo vazio fica `null` e o resultado que depende dele é **pendente** (T34, T35).

## Tempo

- Instantes em `timestamptz` (UTC). Regras de calendário e apresentação em `America/Sao_Paulo`.
- Janela do hóspede calculada sobre **instantes**: `inicio = check_in − 3 h`, `fim = check_out + 30 min`, permitido se `inicio ≤ agora_do_servidor < fim` (T07–T09). O "agora" vem de um **relógio injetável** do servidor — nunca do aparelho.
- Datas de fim sempre posteriores às de início (restrição no banco).
