# ADR-0006 — Fila durável e outbox transacional

- **Situação:** aceita (17/11/2026); implementação a partir do primeiro efeito externo (convite/notificação).

## Decisão

- **Outbox:** a transação de negócio grava a mudança **e** um `outbox_event` (tipo, carga mínima, chave de idempotência, versão do objeto). Nada de efeito externo dentro da transação.
- **Worker** (`apps/worker`, processo próprio) lê o outbox com `FOR UPDATE SKIP LOCKED` e publica em fila do **pg-boss** (no mesmo Postgres) com a chave de idempotência.
- Cada tarefa **revalida antes do efeito**: vínculo, consentimento, situação da cobrança, versão do aviso/estadia (T45, T47). Obsoleta → cancelada com motivo.
- Tentativas com recuo exponencial e limite; esgotou → **dead-letter**, com painel de reprocessamento só para papel autorizado e auditoria.
- Resultado incerto (tempo esgotado depois do envio) → estado "incerto" e **conciliação** pela referência externa antes de qualquer repetição (T57, T58).
- Nenhuma regra de negócio depende de `setTimeout` em memória; o worker parado não estende acessos (T10 — a janela é conferida na leitura).

Redis só se houver benefício medido.
