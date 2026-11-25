-- A casa e a estadia pertencem ao mesmo condomínio. O link só identifica uma estadia.
create table stay (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  unit_id uuid not null,
  created_by uuid not null references person(id),
  request_id uuid not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  members jsonb not null check (jsonb_typeof(members) = 'array'),
  plates text[] not null default '{}',
  exception_reason text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  decision_note text,
  guest_token_hash bytea unique check (octet_length(guest_token_hash) = 32),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null,
  check (check_in_at < check_out_at),
  foreign key (condominium_id, unit_id) references unit (condominium_id, id),
  unique (condominium_id, created_by, request_id)
);
create index stay_unit_period_idx on stay (condominium_id, unit_id, check_in_at, check_out_at);
create index stay_confirmed_plates_idx on stay using gin (plates) where status = 'confirmed';
alter table stay enable row level security;
alter table stay force row level security;
create policy stay_condominium on stay using (condominium_id = app_condominium())
  with check (condominium_id = app_condominium());

-- A consulta pública conhece só o hash. A leitura seguinte volta para a transação protegida por RLS.
create function stay_by_guest_token(p_hash bytea) returns table (id uuid, condominium_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.condominium_id from stay s
  where s.guest_token_hash = p_hash and s.status = 'confirmed'
$$;
revoke all on function stay_by_guest_token(bytea) from public;
grant execute on function stay_by_guest_token(bytea) to vilazuni_app;
grant select, insert, update on stay to vilazuni_app;
