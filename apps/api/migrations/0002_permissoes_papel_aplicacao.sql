-- Permissões do papel de APLICAÇÃO (vilazuni_app). Ele não é dono de nada e não tem BYPASSRLS (ADR-0004).
-- Vínculos não se apagam: encerram-se com histórico. Auditoria: só leitura e acréscimo.
grant usage on schema public to vilazuni_app;

grant select, insert, update on
  condominium, unit, parking_space, person, verified_contact, auth_credential,
  ownership, residency, role_assignment, mandate, delegation, invitation
  to vilazuni_app;

grant select, insert, update, delete on auth_session to vilazuni_app;
grant select, insert on auth_refresh_retired to vilazuni_app;
grant select, insert on audit_event to vilazuni_app;

grant execute on function app_condominium() to vilazuni_app;
grant execute on function person_condominiums(uuid) to vilazuni_app;
grant execute on function invitation_by_token(bytea) to vilazuni_app;
