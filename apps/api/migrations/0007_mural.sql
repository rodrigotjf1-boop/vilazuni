create table bulletin (
  id uuid primary key,
  condominium_id uuid not null references condominium(id),
  kind text not null check (kind in ('rule', 'notice')),
  unique (condominium_id, id)
);

create table bulletin_revision (
  condominium_id uuid not null,
  bulletin_id uuid not null,
  version integer not null check (version > 0),
  translations jsonb not null check (jsonb_typeof(translations) = 'object' and translations ? 'pt-BR'),
  share_with_guests boolean not null,
  requires_acknowledgement boolean not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  published_by uuid not null references person(id),
  published_at timestamptz not null,
  foreign key (condominium_id, bulletin_id) references bulletin (condominium_id, id),
  primary key (condominium_id, bulletin_id, version),
  check (expires_at is null or expires_at > effective_at)
);

create table bulletin_receipt (
  condominium_id uuid not null,
  bulletin_id uuid not null,
  version integer not null,
  person_id uuid not null references person(id),
  read_at timestamptz not null,
  acknowledged_at timestamptz check (acknowledged_at is null or acknowledged_at >= read_at),
  foreign key (condominium_id, bulletin_id, version)
    references bulletin_revision (condominium_id, bulletin_id, version),
  primary key (condominium_id, bulletin_id, version, person_id)
);

alter table bulletin enable row level security;
alter table bulletin force row level security;
create policy bulletin_condominium on bulletin using (condominium_id = app_condominium())
  with check (condominium_id = app_condominium());

alter table bulletin_revision enable row level security;
alter table bulletin_revision force row level security;
create policy bulletin_revision_condominium on bulletin_revision using (condominium_id = app_condominium())
  with check (condominium_id = app_condominium());

alter table bulletin_receipt enable row level security;
alter table bulletin_receipt force row level security;
create policy bulletin_receipt_condominium on bulletin_receipt using (condominium_id = app_condominium())
  with check (condominium_id = app_condominium());

grant select, insert on bulletin, bulletin_revision to vilazuni_app;
-- SELECT FOR UPDATE só para serializar revisões. A API nunca atualiza o cadastro da publicação.
grant update (id) on bulletin to vilazuni_app;
grant select, insert, update (acknowledged_at) on bulletin_receipt to vilazuni_app;
