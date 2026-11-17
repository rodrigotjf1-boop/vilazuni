-- Vilazuni v1 — F1.1d: cadastro dos proprietários por link do condomínio (decisão do dono, ADR-0011), confirmação
-- do e-mail por código, e a fila de saída (outbox, ADR-0006) que leva o e-mail ao provedor.

-- Remetente dos e-mails do condomínio (ex.: nao-responda@chandra.vilazuni.com). Configuração por condomínio:
-- cada um terá o seu subdomínio verificado no provedor.
alter table condominium add column email_sender text
  check (email_sender is null or email_sender ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$');

-- ---------- Link de cadastro do condomínio (coletivo, com validade, limite e revogação; token só como hash) ----------
create table signup_link (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  token_hash bytea not null unique,
  max_uses integer not null check (max_uses between 1 and 500),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  created_by uuid not null references person(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references person(id),
  unique (condominium_id, id),
  check (expires_at > created_at),
  check (uses <= max_uses)
);

-- ---------- Código de confirmação do e-mail (6 dígitos; no banco só o hash; validade e tentativas) ----------
create table email_verification (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  signup_link_id uuid not null,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  code_hash bytea not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (condominium_id, id),
  foreign key (condominium_id, signup_link_id) references signup_link(condominium_id, id),
  check (expires_at > created_at)
);
create index email_verification_recent on email_verification(condominium_id, email, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['signup_link','email_verification'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy isolamento on %I using (condominium_id = app_condominium()) with check (condominium_id = app_condominium())', t);
  end loop;
end $$;

-- Antes de existir contexto, a página pública precisa achar o link pelo hash do token — devolve só os ids.
create function signup_link_by_token(p_token_hash bytea) returns table (id uuid, condominium_id uuid)
  language sql stable security definer set search_path = public as $$
  select s.id, s.condominium_id from signup_link s where s.token_hash = p_token_hash;
$$;
revoke all on function signup_link_by_token(bytea) from public;

-- ---------- Fila de saída (outbox): a mudança e o "a enviar" na MESMA transação; o envio sai depois ----------
-- Global (o despachante atende todos os condomínios). O conteúdo sensível (o código) sai do registro depois do envio.
create table outbox_event (
  id uuid primary key,
  condominium_id uuid references condominium(id),
  kind text not null check (kind in ('email')),
  idempotency_key text not null unique check (length(idempotency_key) between 3 and 200),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','dead','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  provider_ref text check (provider_ref is null or length(provider_ref) <= 200),
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz
);
create index outbox_event_due on outbox_event(available_at) where status in ('pending','sending');

-- Caixa de e-mail da DEMONSTRAÇÃO: com o envio em modo "demo", nada sai — o e-mail fica aqui para ser lido no
-- ambiente de demonstração e nos testes. Produção recusa o modo "demo" (ADR-0008).
create table demo_mailbox (
  id bigint generated always as identity primary key,
  outbox_id uuid not null unique references outbox_event(id),
  to_address text not null,
  subject text not null,
  body_text text not null,
  created_at timestamptz not null default clock_timestamp()
);

grant select, insert, update on signup_link, email_verification to vilazuni_app;
grant select, insert, update on outbox_event to vilazuni_app;
grant select, insert on demo_mailbox to vilazuni_app;
grant execute on function signup_link_by_token(bytea) to vilazuni_app;
