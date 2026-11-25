create table unit_attraction (
  id uuid primary key,
  condominium_id uuid not null,
  unit_id uuid not null,
  title text not null check (char_length(title) between 2 and 100),
  description text not null check (char_length(description) between 3 and 3000),
  directions text not null check (char_length(directions) between 3 and 2000),
  transport text not null check (char_length(transport) between 3 and 1200),
  tips text not null default '' check (char_length(tips) <= 2000),
  version integer not null default 1 check (version > 0),
  unique (condominium_id, id),
  foreign key (condominium_id, unit_id) references unit (condominium_id, id)
);

create index unit_attraction_guide on unit_attraction (condominium_id, unit_id, title, id);

create table unit_attraction_photo (
  condominium_id uuid not null,
  attraction_id uuid not null,
  slot smallint not null check (slot between 1 and 3),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null check (octet_length(bytes) between 1 and 2097152),
  primary key (condominium_id, attraction_id, slot),
  foreign key (condominium_id, attraction_id)
    references unit_attraction (condominium_id, id) on delete cascade
);

alter table unit_attraction enable row level security;
alter table unit_attraction force row level security;
create policy unit_attraction_condominium on unit_attraction
  using (condominium_id = app_condominium()) with check (condominium_id = app_condominium());

alter table unit_attraction_photo enable row level security;
alter table unit_attraction_photo force row level security;
create policy unit_attraction_photo_condominium on unit_attraction_photo
  using (condominium_id = app_condominium()) with check (condominium_id = app_condominium());

grant select, insert, update, delete on unit_attraction, unit_attraction_photo to vilazuni_app;
