import type {PoolClient} from 'pg';

/** Registro de auditoria na MESMA transação da mudança (só acréscimo; o papel da aplicação não altera nem apaga). */
export interface AuditEntry {
  condominiumId: string | null;
  actorPersonId: string | null;
  actorKind?: 'person' | 'service' | 'system';
  action: string;
  objectType?: string;
  objectId?: string;
  result?: 'ok' | 'denied' | 'error';
  reason?: string;
  correlationId?: string;
  /** nunca senha, token, segredo ou documento */
  detail?: Record<string, unknown>;
}

export async function audit(client: PoolClient, e: AuditEntry): Promise<void> {
  await client.query(
    `insert into audit_event (condominium_id, actor_person_id, actor_kind, action, object_type, object_id, result, reason, correlation_id, detail)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      e.condominiumId,
      e.actorPersonId,
      e.actorKind ?? 'person',
      e.action,
      e.objectType ?? null,
      e.objectId ?? null,
      e.result ?? 'ok',
      e.reason ?? null,
      e.correlationId ?? null,
      JSON.stringify(e.detail ?? {}),
    ],
  );
}
