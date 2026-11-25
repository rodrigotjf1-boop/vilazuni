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
  | 'person.read.all'
  | 'role.assign'
  | 'mandate.manage'
  | 'delegation.manage'
  | 'stay.read.own'
  | 'stay.write.own'
  | 'stay.read.all'
  | 'bulletin.publish'
  | 'audit.read';

/** Todas as ações, para a tela saber o que mostrar (quem barra continua sendo `decide` em cada rota). */
export const ACTIONS: readonly Action[] = [
  'condominium.read',
  'unit.read.own',
  'unit.read.all',
  'unit.manage',
  'ownership.request',
  'ownership.validate',
  'invitation.create',
  'person.read.all',
  'role.assign',
  'mandate.manage',
  'delegation.manage',
  'stay.read.own',
  'stay.write.own',
  'stay.read.all',
  'bulletin.publish',
  'audit.read',
];

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
  /** Atribuições adicionais concedidas por delegação documentada. */
  delegations?: (Period & {status: 'active' | 'ended'; actions: string[]})[];
}

export interface ActorContext {
  personId: string;
  condominiumId: string;
  now: Date;
  /** a sessão cumpriu o segundo fator */
  mfaSatisfied: boolean;
  /** o segundo fator foi confirmado há pouco (MFA_RECENT_MS) — exigido nos atos críticos */
  mfaRecent: boolean;
  ownerships: OwnershipLink[];
  residencies: ResidencyLink[];
  roles: RoleLink[];
}

export interface Decision {
  allow: boolean;
  /**
   * motivo estável: 'ok' | 'sem_vinculo' | 'mfa_exigido' | 'mfa_recente_exigido' | 'fora_do_escopo' |
   * 'mandato_vencido'
   */
  reason: string;
}

const inPeriod = (p: Period, now: Date) =>
  (p.startsAt === null || p.startsAt.getTime() <= now.getTime()) &&
  (p.endsAt === null || now.getTime() < p.endsAt.getTime());

/**
 * Atos CRÍTICOS: além do segundo fator na sessão, exigem confirmação recente dele. Nunca entram em delegação —
 * senão o subsíndico daria poderes a si mesmo ou a outros.
 */
export const MFA_ACTIONS: ReadonlySet<Action> = new Set([
  'role.assign',
  'mandate.manage',
  'delegation.manage',
]);
/** Janela do "segundo fator recente" para os atos críticos. */
export const MFA_RECENT_MS = 15 * 60 * 1000;

/** Ações de gestão do síndico com mandato vigente (todas exigem o segundo fator na sessão). */
const SYNDIC_ACTIONS: ReadonlySet<Action> = new Set([
  'condominium.read',
  'unit.read.all',
  'unit.manage',
  'ownership.request',
  'ownership.validate',
  'invitation.create',
  'person.read.all',
  'role.assign',
  'mandate.manage',
  'delegation.manage',
  'stay.read.all',
  'bulletin.publish',
  'audit.read',
]);

/** O que uma delegação pode conceder: gestão do dia a dia, nunca os atos críticos. */
export const DELEGABLE_ACTIONS: ReadonlySet<Action> = new Set(
  [...SYNDIC_ACTIONS].filter((a) => !MFA_ACTIONS.has(a) && a !== 'condominium.read'),
);

export function canReceiveDelegation(role: Role, action: Action): boolean {
  if (!DELEGABLE_ACTIONS.has(action)) return false;
  if (action === 'stay.read.all') return role === 'subsyndic' || role === 'service_provider';
  if (action === 'bulletin.publish') return role === 'subsyndic';
  return true;
}

/** Conselho fiscal: leitura do que fiscaliza; nunca edita. */
const FISCAL_ACTIONS: ReadonlySet<Action> = new Set([
  'condominium.read',
  'unit.read.all',
  'audit.read',
  'ownership.request',
]);

/**
 * Tenaz: escopos contratuais → ações. Sem superadmin. `mfa`: escopo que exige segundo fator (poder financeiro,
 * especificação §6) — o financeiro entra na Fase 2.
 */
const ADMINISTRATOR_SCOPES: Record<string, {actions: Action[]; mfa: boolean}> = {
  cadastro: {
    actions: ['unit.read.all', 'ownership.validate', 'invitation.create', 'person.read.all'],
    mfa: false,
  },
  financeiro: {actions: [], mfa: true},
  assembleias: {actions: [], mfa: false},
};

export function activeOwnedUnits(ctx: ActorContext): string[] {
  return ctx.ownerships.filter((o) => o.status === 'validated' && inPeriod(o, ctx.now)).map((o) => o.unitId);
}
export function activeResidentUnits(ctx: ActorContext): string[] {
  return ctx.residencies.filter((r) => r.status === 'active' && inPeriod(r, ctx.now)).map((r) => r.unitId);
}

/**
 * Ações que cada papel vigente concede AGORA (mandato e delegações conferidos pelo relógio do servidor).
 * `free`: valem sem segundo fator; `managed`: gestão que exige o segundo fator na sessão (síndico, delegação,
 * escopo financeiro da Tenaz).
 */
function roleActions(ctx: ActorContext): {free: Set<Action>; managed: Set<Action>; expiredMandate: boolean} {
  const free = new Set<Action>();
  const managed = new Set<Action>();
  let expiredMandate = false;
  for (const r of ctx.roles) {
    if (r.status !== 'active' || !inPeriod(r, ctx.now)) continue;
    free.add('condominium.read');
    if (r.role === 'syndic') {
      const m = r.mandate;
      if (m && m.status === 'active' && inPeriod(m, ctx.now)) SYNDIC_ACTIONS.forEach((a) => managed.add(a));
      else expiredMandate = true;
    } else if (r.role === 'subsyndic') {
      managed.add('stay.read.all');
    } else if (r.role === 'fiscal_council') {
      FISCAL_ACTIONS.forEach((a) => free.add(a));
    } else if (r.role === 'administrator') {
      for (const s of r.scopes) {
        const scope = ADMINISTRATOR_SCOPES[s];
        scope?.actions.forEach((a) => (scope.mfa ? managed : free).add(a));
      }
    }
    // Outras ações de gestão exigem delegação vigente. A delegação exclui atos críticos.
    for (const d of r.delegations ?? [])
      if (d.status === 'active' && inPeriod(d, ctx.now))
        for (const a of d.actions) if (canReceiveDelegation(r.role, a as Action)) managed.add(a as Action);
  }
  return {free, managed, expiredMandate};
}

export function decide(ctx: ActorContext, action: Action, resource: {unitId?: string} = {}): Decision {
  const owned = activeOwnedUnits(ctx);
  const resident = activeResidentUnits(ctx);
  const {free, managed, expiredMandate} = roleActions(ctx);
  const hasOwnOrResident = owned.length > 0 || resident.length > 0;
  const pendingAny =
    ctx.ownerships.some((o) => o.status === 'pending') || ctx.residencies.some((r) => r.status === 'pending');

  // 1º: caminhos que não pedem segundo fator (vínculo com a casa, papéis de leitura, escopo sem poder financeiro)
  let allowed = false;
  switch (action) {
    case 'condominium.read':
      allowed = hasOwnOrResident || free.has(action);
      break;
    case 'unit.read.own':
      allowed =
        resource.unitId !== undefined &&
        (owned.includes(resource.unitId) || resident.includes(resource.unitId));
      break;
    case 'ownership.request':
      // quem já tem algum vínculo (mesmo pendente) no condomínio pode pedir outra casa; nasce PENDENTE
      allowed = hasOwnOrResident || pendingAny || free.has(action);
      break;
    case 'stay.read.own':
      allowed = resource.unitId ? owned.includes(resource.unitId) : owned.length > 0;
      break;
    case 'stay.write.own':
      allowed = resource.unitId !== undefined && owned.includes(resource.unitId);
      break;
    default:
      allowed = free.has(action);
  }
  // 2º: gestão — exige o segundo fator na sessão
  let needsMfa = false;
  if (!allowed && managed.has(action)) {
    allowed = true;
    needsMfa = true;
  }

  if (!allowed) {
    if (expiredMandate && SYNDIC_ACTIONS.has(action)) return {allow: false, reason: 'mandato_vencido'};
    return {
      allow: false,
      reason: hasOwnOrResident || free.size || managed.size ? 'fora_do_escopo' : 'sem_vinculo',
    };
  }
  if (needsMfa && !ctx.mfaSatisfied) return {allow: false, reason: 'mfa_exigido'};
  if (MFA_ACTIONS.has(action) && !ctx.mfaRecent) return {allow: false, reason: 'mfa_recente_exigido'};
  return {allow: true, reason: 'ok'};
}
