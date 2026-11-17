/**
 * Formatos das respostas da API usados pelas telas. Ficam aqui até o pacote de contratos compartilhado
 * (`packages/contracts`, ADR-0002) existir — a API é a fonte; os testes de ponta a ponta conferem.
 */
export interface Me {
  person: {id: string; displayName: string; preferredLanguage: string};
  mfa: {enrolled: boolean; satisfied: boolean};
  condominiums: {id: string; name: string; environment: 'demo' | 'sandbox' | 'production'}[];
}

export type Outcome = 'ok' | 'mfa_exigido' | 'mfa_recente_exigido' | 'negado';
export interface Access {
  condominiumId: string | null;
  actions: Record<string, Outcome>;
  mandate: {endsAt: string; daysLeft: number; warning: boolean} | null;
}

export interface UnitLink {
  id: string;
  type: 'ownership' | 'residency';
  status: 'pending' | 'validated' | 'rejected' | 'active';
  startsAt: string | null;
  endsAt: string | null;
  requestedAt: string | null;
  decisionNote: string | null;
}
export interface MyUnit {
  id: string;
  label: string;
  bedrooms: number | null;
  parkingSpace: {number: string; accessible: boolean} | null;
  links: UnitLink[];
}
export interface UnitDetail {
  id: string;
  label: string;
  parkingSpace: {number: string; accessible: boolean} | null;
  owners: {personId: string; displayName: string; since: string}[];
}

export interface InvitationPreview {
  condominiumName: string;
  purpose: 'ownership' | 'residency' | 'role';
  unitLabel: string | null;
  role: string | null;
  scopes: string[];
  contactHint: string;
  expiresAt: string;
}

export interface MfaStatus {
  enrolled: boolean;
  setupPending: boolean;
  satisfied: boolean;
  recent: boolean;
  recoveryCodesLeft: number;
}

export interface SessionRow {
  id: string;
  transport: 'web' | 'native';
  device: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}
