-- Vilazuni v1 — F1.1b: segundo fator (TOTP) e códigos de recuperação (ADR-0003, ADR-0007).
-- O segredo do TOTP fica em auth_credential.secret CIFRADO pelo cofre (envelope; a chave-mestra não está no banco).

-- Proteção contra código repetido: o passo de tempo do último código aceito; o mesmo código (ou um mais velho)
-- não vale de novo (T06). Tentativas erradas travam por um tempo.
alter table auth_credential add column last_used_step bigint;
alter table auth_credential add column failed_count integer not null default 0 check (failed_count >= 0);
alter table auth_credential add column locked_until timestamptz;

-- Códigos de recuperação: mostrados UMA vez; no banco só o SHA-256; cada um vale uma vez.
create table auth_recovery_code (
  id uuid primary key,
  person_id uuid not null references person(id),
  code_hash bytea not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index auth_recovery_code_person on auth_recovery_code(person_id) where used_at is null;

grant select, insert, update, delete on auth_recovery_code to vilazuni_app;
-- trocar de aparelho (redefinir o TOTP) apaga a credencial antiga
grant delete on auth_credential to vilazuni_app;
