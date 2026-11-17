/**
 * Motor de permissões (docs/matriz-permissoes.md). Função PURA: recebe o contexto do ator montado no servidor
 * a cada pedido (vínculos lidos do banco naquele instante) e decide. Negar por padrão; o "agora" é o do servidor.
 * Esconder menu não é barreira — a API chama `decide` em toda ação.
 */
export type Role =
  | 'syndic'
  | 'subsyndic'
  | 'fiscal_council'
  | 'administrator'
  | 'service_provider'
  | 'security_reviewer'
  | 'support';

export type Action =
  | 'condominium.read'
  | 'unit.read.own'
  | 'unit.read.all'
  | 'unit.manage'
  | 'ownership.request'
  | 'ownership.validate'
  | 'invitation.create'
  | 'role.assign'
  | 'mandate.manage'
  | 'delegation.manage'
  | 'audit.read';

interface Period {
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface OwnershipLink extends Period {
  unitId: string;
  status: 'pending' | 'validated' | 'rejected' | 'ended';
}
export interface ResidencyLink extends Period {
  unitId: string;
  status: 'pending' | 'active' | 'ended';
}
export interface RoleLink extends Period {
  role: Role;
  status: 'active' | 'ended';
  scopes: string[];
  /** síndico: o mandato que dá os poderes */
  mandate?: (Period & {status: 'active' | 'ended'}) | null;
  /** subsíndico e outros: só o que a delegação documentada concede */
  delegations?: (Period & {status: 'active' | 'ended'; actions: string[]})[];
}

export interface ActorContext {
  personId: string;
  condominiumId: string;
  now: Date;
  /** a sessão cumpriu o segundo fator */
  mfaSatisfied: boolean;
  ownerships: OwnershipLink[];
  residencies: ResidencyLink[];
  roles: RoleLink[];
}

export interface Decision {
  allow: boolean;
  /** motivo estável: 'ok' | 'sem_vinculo' | 'mfa_exigido' | 'fora_do_escopo' | 'mandato_vencido' */
  reason: string;
}

const inPeriod = (p: Period, now: Date) =>
  (p.startsAt === null || p.startsAt.getTime() <= now.getTime()) &&
  (p.endsAt === null || now.getTime() < p.endsAt.getTime());

/** Atos que exigem o segundo fator cumprido na sessão. */
export const MFA_ACTIONS: ReadonlySet<Action> = new Set([
  'role.assign',
  'mandate.manage',
  'delegation.manage',
]);

/** Ações de gestão do síndico com mandato vigente. */
const SYNDIC_ACTIONS: ReadonlySet<Action> = new Set([
  'condominium.read',
  'unit.read.all',
  'unit.manage',
  'ownership.request',
  'ownership.validate',
  'invitation.create',
  'role.assign',
  'mandate.manage',
  'delegation.manage',
  'audit.read',
]);

/** Conselho fiscal: leitura do que fiscaliza; nunca edita. */
const FISCAL_ACTIONS: ReadonlySet<Action> = new Set([
  'condominium.read',
  'unit.read.all',
  'audit.read',
  'ownership.request',
]);

/** Tenaz: escopos contratuais → ações. Sem superadmin. */
const ADMINISTRATOR_SCOPES: Record<string, Action[]> = {
  cadastro: ['unit.read.all', 'ownership.validate', 'invitation.create'],
  financeiro: [],
  assembleias: [],
};

export function activeOwnedUnits(ctx: ActorContext): string[] {
  return ctx.ownerships.filter((o) => o.status === 'validated' && inPeriod(o, ctx.now)).map((o) => o.unitId);
}
export function activeResidentUnits(ctx: ActorContext): string[] {
  return ctx.residencies.filter((r) => r.status === 'active' && inPeriod(r, ctx.now)).map((r) => r.unitId);
}

/** Ações que cada papel vigente concede AGORA (mandato e delegações conferidos pelo relógio do servidor). */
function roleActions(ctx: ActorContext): {actions: Set<Action>; expiredMandate: boolean} {
  const actions = new Set<Action>();
  let expiredMandate = false;
  for (const r of ctx.roles) {
    if (r.status !== 'active' || !inPeriod(r, ctx.now)) continue;
    actions.add('condominium.read');
    if (r.role === 'syndic') {
      const m = r.mandate;
      if (m && m.status === 'active' && inPeriod(m, ctx.now)) SYNDIC_ACTIONS.forEach((a) => actions.add(a));
      else expiredMandate = true;
    } else if (r.role === 'fiscal_council') {
      FISCAL_ACTIONS.forEach((a) => actions.add(a));
    } else if (r.role === 'administrator') {
      for (const s of r.scopes) (ADMINISTRATOR_SCOPES[s] ?? []).forEach((a) => actions.add(a));
    }
    // Subsíndico e demais: o que delegação vigente conceder (nunca cópia automática dos poderes do síndico).
    for (const d of r.delegations ?? [])
      if (d.status === 'active' && inPeriod(d, ctx.now))
        for (const a of d.actions) if (SYNDIC_ACTIONS.has(a as Action)) actions.add(a as Action);
  }
  return {actions, expiredMandate};
}

export function decide(ctx: ActorContext, action: Action, resource: {unitId?: string} = {}): Decision {
  const owned = activeOwnedUnits(ctx);
  const resident = activeResidentUnits(ctx);
  const {actions, expiredMandate} = roleActions(ctx);
  const hasOwnOrResident = owned.length > 0 || resident.length > 0;
  const pendingAny =
    ctx.ownerships.some((o) => o.status === 'pending') || ctx.residencies.some((r) => r.status === 'pending');

  let allowed = false;
  switch (action) {
    case 'condominium.read':
      allowed = hasOwnOrResident || actions.has(action);
      break;
    case 'unit.read.own':
      allowed =
        resource.unitId !== undefined &&
        (owned.includes(resource.unitId) || resident.includes(resource.unitId));
      break;
    case 'ownership.request':
      // quem já tem algum vínculo (mesmo pendente) no condomínio pode pedir outra casa; nasce PENDENTE
      allowed = hasOwnOrResident || pendingAny || actions.has(action);
      break;
    default:
      allowed = actions.has(action);
  }

  if (!allowed) {
    if (expiredMandate && SYNDIC_ACTIONS.has(action)) return {allow: false, reason: 'mandato_vencido'};
    return {allow: false, reason: hasOwnOrResident || actions.size ? 'fora_do_escopo' : 'sem_vinculo'};
  }
  if (MFA_ACTIONS.has(action) && !ctx.mfaSatisfied) return {allow: false, reason: 'mfa_exigido'};
  return {allow: true, reason: 'ok'};
}
