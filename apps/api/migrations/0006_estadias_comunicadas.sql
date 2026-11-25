-- A comunicação do proprietário passa a ficar ativa assim que registrada.
alter table stay alter column status set default 'confirmed';
update stay set status = 'confirmed', version = version + 1 where status = 'pending';

-- Orientações podem conter dados da casa. O aplicativo grava só o envelope do cofre.
alter table stay add column arrival_instructions text;
