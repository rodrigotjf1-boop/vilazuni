-- Vilazuni v1 — F1.1: identidade, condomínio, unidades, vagas, vínculos, papéis, convites e auditoria.
-- Roda como vilazuni_owner (dono das tabelas). A aplicação usa vilazuni_app: sem BYPASSRLS, não dono (ADR-0004).
-- Toda tabela de negócio tem condominium_id, único (condominium_id, id) e FK composta entre tabelas de negócio.

-- ---------- Condomínio e unidades ----------
create table condominium (
  id uuid primary key,
  name text not null check (length(name) between 2 and 120),
  city text not null check (length(city) between 2 and 80),
  state char(2) not null,
  timezone text not null default 'America/Sao_Paulo',
  languages text[] not null default array['pt-BR','es','en'],
  environment text not null check (environment in ('demo','sandbox','production')),
  created_at timestamptz not null default now(),
  version integer not null default 1
);

create table unit (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  label text not null check (length(label) between 1 and 40),
  official_number text check (official_number is null or length(official_number) between 1 and 40),
  bedrooms integer check (bedrooms is null or bedrooms between 1 and 20),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  unique (condominium_id, label)
);

create table parking_space (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  number text not null check (length(number) between 1 and 20),
  unit_id uuid,
  accessible boolean not null default false,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  unique (condominium_id, number),
  -- Regra inicial do piloto: uma vaga por unidade (sujeita ao documento oficial).
  unique (condominium_id, unit_id),
  foreign key (condominium_id, unit_id) references unit(condominium_id, id)
);

-- ---------- Pessoas e autenticação (globais: uma pessoa pode estar em vários condomínios) ----------
create table person (
  id uuid primary key,
  display_name text not null check (length(display_name) between 2 and 120),
  preferred_language text not null default 'pt-BR' check (preferred_language in ('pt-BR','es','en')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  version integer not null default 1
);

create table verified_contact (
  id uuid primary key,
  person_id uuid not null references person(id),
  kind text not null check (kind in ('email','phone')),
  value text not null check (length(value) between 3 and 254),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, value),
  -- e-mail sempre normalizado: "Ana@x" e "ana@x" seriam duas contas e o entrar (que normaliza) não acharia
  check (kind <> 'email' or value = lower(btrim(value)))
);

create table auth_credential (
  id uuid primary key,
  person_id uuid not null references person(id),
  kind text not null check (kind in ('password','totp')),
  -- senha: hash argon2id; totp: segredo cifrado (nunca em claro)
  secret text not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (person_id, kind)
);

create table auth_session (
  id uuid primary key,
  person_id uuid not null references person(id),
  transport text not null check (transport in ('web','native')),
  token_hash bytea not null unique,
  csrf_hash bytea,
  refresh_hash bytea unique,
  refresh_family uuid,
  -- nativo: o access vale pouco (15 min); a sessão (refresh) vale até expires_at
  access_expires_at timestamptz,
  mfa_at timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  check (expires_at > created_at),
  check ((transport = 'web' and csrf_hash is not null) or
         (transport = 'native' and refresh_hash is not null and access_expires_at is not null))
);
create index auth_session_person on auth_session(person_id) where revoked_at is null;
create index auth_session_family on auth_session(refresh_family) where refresh_family is not null;

-- Refresh já trocado: se aparecer de novo, alguém copiou o token — a família inteira é revogada.
create table auth_refresh_retired (
  refresh_hash bytea primary key,
  refresh_family uuid not null,
  retired_at timestamptz not null default now()
);

-- ---------- Vínculos com unidades ----------
create table ownership (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  unit_id uuid not null,
  person_id uuid not null references person(id),
  share_note text check (share_note is null or length(share_note) <= 200),
  status text not null check (status in ('pending','validated','rejected','ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references person(id),
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  version integer not null default 1,
  unique (condominium_id, id),
  foreign key (condominium_id, unit_id) references unit(condominium_id, id),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (status <> 'validated' or (starts_at is not null and decided_by is not null))
);
-- A mesma pessoa não tem dois vínculos abertos na mesma casa (pendente ou validado sem fim).
create unique index ownership_aberta on ownership(condominium_id, unit_id, person_id)
  where status in ('pending','validated') and ends_at is null;

create table residency (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  unit_id uuid not null,
  person_id uuid not null references person(id),
  status text not null check (status in ('pending','active','ended')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references person(id),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  foreign key (condominium_id, unit_id) references unit(condominium_id, id),
  check (ends_at is null or ends_at > starts_at)
);

-- ---------- Papéis, mandatos e delegações ----------
create table role_assignment (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  person_id uuid not null references person(id),
  role text not null check (role in ('syndic','subsyndic','fiscal_council','administrator','service_provider','security_reviewer','support')),
  scopes text[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','ended')),
  granted_by uuid references person(id),
  reason text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  check (ends_at is null or ends_at > starts_at)
);

create table mandate (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  role_assignment_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  minutes_reference text not null check (length(minutes_reference) between 3 and 200),
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  foreign key (condominium_id, role_assignment_id) references role_assignment(condominium_id, id),
  check (ends_at > starts_at)
);

create table delegation (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  role_assignment_id uuid not null,
  actions text[] not null check (cardinality(actions) between 1 and 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  document_reference text not null check (length(document_reference) between 3 and 200),
  granted_by uuid not null references person(id),
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  unique (condominium_id, id),
  foreign key (condominium_id, role_assignment_id) references role_assignment(condominium_id, id),
  check (ends_at > starts_at)
);

-- ---------- Convites (uso único, token só como hash) ----------
create table invitation (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  purpose text not null check (purpose in ('ownership','residency','role')),
  unit_id uuid,
  role text check (role is null or role in ('syndic','subsyndic','fiscal_council','administrator','service_provider','security_reviewer')),
  scopes text[] not null default '{}',
  contact_kind text not null check (contact_kind in ('email','phone')),
  contact_value text not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  used_at timestamptz,
  used_by uuid references person(id),
  created_by uuid not null references person(id),
  created_at timestamptz not null default now(),
  unique (condominium_id, id),
  foreign key (condominium_id, unit_id) references unit(condominium_id, id),
  check (expires_at > created_at),
  check ((purpose = 'role') = (role is not null)),
  check (purpose = 'role' or unit_id is not null)
);

-- ---------- Auditoria (só acréscimo) ----------
create table audit_event (
  id bigint generated always as identity primary key,
  condominium_id uuid references condominium(id),
  actor_person_id uuid references person(id),
  actor_kind text not null check (actor_kind in ('person','service','system')),
  action text not null,
  object_type text,
  object_id uuid,
  result text not null check (result in ('ok','denied','error')),
  reason text,
  correlation_id text,
  at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
create index audit_event_condominium_at on audit_event(condominium_id, at desc);

-- ---------- RLS: segunda barreira por condomínio ----------
-- O contexto vem de set_config('app.condominium_id', <uuid>, true) — local à transação, some no fim dela.
create function app_condominium() returns uuid language sql stable as
  $$ select nullif(current_setting('app.condominium_id', true), '')::uuid $$;

alter table condominium enable row level security;
alter table condominium force row level security;
create policy isolamento on condominium using (id = app_condominium()) with check (id = app_condominium());

do $$
declare t text;
begin
  foreach t in array array['unit','parking_space','ownership','residency','role_assignment','mandate','delegation','invitation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy isolamento on %I using (condominium_id = app_condominium()) with check (condominium_id = app_condominium())', t);
  end loop;
end $$;

alter table audit_event enable row level security;
alter table audit_event force row level security;
create policy leitura on audit_event for select using (condominium_id = app_condominium());
create policy registro on audit_event for insert
  with check (condominium_id is null or condominium_id = app_condominium());

-- ---------- Funções de interface estreita (SECURITY DEFINER) ----------
-- Antes de existir contexto, a API precisa saber em quais condomínios a pessoa tem vínculo, e achar o convite
-- pelo hash do token. Estas funções devolvem SÓ isso — nada de linhas inteiras de outros condomínios.
create function person_condominiums(p_person uuid) returns table (condominium_id uuid)
  language sql stable security definer set search_path = public as $$
  select distinct c from (
    select o.condominium_id as c from ownership o where o.person_id = p_person and o.status in ('pending','validated')
    union select r.condominium_id from residency r where r.person_id = p_person and r.status in ('pending','active')
    union select a.condominium_id from role_assignment a where a.person_id = p_person and a.status = 'active'
  ) s;
$$;

create function invitation_by_token(p_token_hash bytea) returns table (id uuid, condominium_id uuid)
  language sql stable security definer set search_path = public as $$
  select i.id, i.condominium_id from invitation i where i.token_hash = p_token_hash;
$$;

revoke all on function person_condominiums(uuid) from public;
revoke all on function invitation_by_token(bytea) from public;
