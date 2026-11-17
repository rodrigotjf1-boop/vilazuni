import {createHash, randomBytes} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {withCondominium} from '../db/tenant.js';
import {hashPassword} from '../auth/crypto.js';

/**
 * Semeadura DEMONSTRATIVA do piloto (especificação §24): 14 casas e 14 vagas com numeração PROVISÓRIA (P02),
 * pessoas FICTÍCIAS marcadas "[DEMO]" (nomes e contatos reais não foram fornecidos — P03) e os casos que a
 * Fase 1.1 já representa. Repetível: ids derivados de uma chave fixa e `on conflict do nothing`.
 * Senhas geradas na hora (nada de senha universal); só aparecem para quem rodou.
 */
export const DEMO_DOMAIN = 'demo.vilazuni.test';
const DAY = 24 * 60 * 60 * 1000;

/** UUID determinístico (versão 8, RFC 9562) a partir de uma chave da semeadura. */
export function demoId(key: string): string {
  const h = createHash('sha256').update(`vilazuni-demo-chandra:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x80;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

interface DemoPerson {
  key: string;
  name: string;
  /** o que esta pessoa demonstra */
  papel: string;
}

const PEOPLE: DemoPerson[] = [
  {
    key: 'sindica',
    name: '[DEMO] Síndica Vigente',
    papel: 'síndica com mandato vigente; proprietária da Casa 01',
  },
  {
    key: 'ex-sindico',
    name: '[DEMO] Ex-síndico',
    papel: 'mandato vencido (perde a gestão); proprietário da Casa 02',
  },
  {key: 'duas-casas', name: '[DEMO] Proprietário de Duas Casas', papel: 'proprietário das Casas 03 e 04'},
  {key: 'coproprietaria-a', name: '[DEMO] Coproprietária A', papel: 'copropriedade da Casa 05'},
  {key: 'coproprietario-b', name: '[DEMO] Coproprietário B', papel: 'copropriedade da Casa 05'},
  {key: 'proprietaria-06', name: '[DEMO] Proprietária da Casa 06', papel: 'proprietária da Casa 06'},
  {key: 'morador-contrato', name: '[DEMO] Morador de Contrato', papel: 'residente de contrato na Casa 06'},
  {key: 'conselheiro-1', name: '[DEMO] Conselheiro 1', papel: 'conselho fiscal; proprietário da Casa 07'},
  {key: 'conselheiro-2', name: '[DEMO] Conselheira 2', papel: 'conselho fiscal; proprietária da Casa 08'},
  {key: 'conselheiro-3', name: '[DEMO] Conselheiro 3', papel: 'conselho fiscal; proprietário da Casa 09'},
  {
    key: 'pedido-pendente',
    name: '[DEMO] Pedido Pendente',
    papel: 'titularidade da Casa 10 aguardando validação',
  },
  {
    key: 'subsindica',
    name: '[DEMO] Subsíndica',
    papel: 'subsíndica com delegação de cadastro; proprietária da Casa 11',
  },
  {key: 'tenaz', name: '[DEMO] Tenaz — Cadastro', papel: 'administradora com escopo "cadastro" só'},
  {
    key: 'prestador',
    name: '[DEMO] Prestador de Serviços',
    papel: 'prestador (tarefas contratuais nas fases seguintes)',
  },
];

export const emailOfDemo = (key: string) => `${key}@${DEMO_DOMAIN}`;

export interface SeedResult {
  condominiumId: string;
  created: boolean;
  /** só as contas criadas (ou com senha redefinida) NESTA execução */
  credentials: {email: string; password: string; name: string; papel: string}[];
}

export async function seedDemoChandra(
  pool: Pool,
  options: {env: string; now?: Date; resetPasswords?: boolean; allowWithRealData?: boolean},
): Promise<SeedResult> {
  if (options.env !== 'demo')
    throw new Error('A semeadura demonstrativa só roda com VILAZUNI_ENV=demo (nunca em produção).');
  const now = options.now ?? new Date();
  if (!options.allowWithRealData) {
    const reais = await pool.query(`select count(*)::int as n from person where not is_demo`);
    if (reais.rows[0].n > 0)
      throw new Error('O banco já tem pessoas reais: a semeadura demonstrativa não roda aqui.');
  }

  const condominiumId = demoId('condominio');
  const unit = (n: number) => demoId(`casa-${n}`);
  const person = (key: string) => demoId(`pessoa-${key}`);
  const credentials: SeedResult['credentials'] = [];

  // pessoas, contatos e senhas (globais)
  for (const p of PEOPLE) {
    const id = person(p.key);
    const novo = await pool.query(
      `insert into person (id, display_name, is_demo) values ($1, $2, true) on conflict (id) do nothing returning id`,
      [id, p.name],
    );
    await pool.query(
      `insert into verified_contact (id, person_id, kind, value, verified_at) values ($1, $2, 'email', $3, $4)
       on conflict do nothing`,
      [demoId(`contato-${p.key}`), id, emailOfDemo(p.key), now],
    );
    if (novo.rowCount || options.resetPasswords) {
      const password = randomBytes(12).toString('base64url');
      await pool.query(
        `insert into auth_credential (id, person_id, kind, secret, confirmed_at) values ($1, $2, 'password', $3, $4)
         on conflict (person_id, kind) do update set secret = excluded.secret`,
        [demoId(`senha-${p.key}`), id, await hashPassword(password), now],
      );
      credentials.push({email: emailOfDemo(p.key), password, name: p.name, papel: p.papel});
    }
  }

  const created = await withCondominium(pool, condominiumId, async (c) => {
    const r = await c.query(
      `insert into condominium (id, name, city, state, environment) values ($1, '[DEMO] Condomínio Chandra', 'Cidade Demo', 'RJ', 'demo')
       on conflict (id) do nothing returning id`,
      [condominiumId],
    );
    for (let n = 1; n <= 14; n++) {
      const label = `Casa ${String(n).padStart(2, '0')}`;
      // quartos (2 ou 3) e número oficial: pendentes (P02) — nada inventado
      await c.query(
        `insert into unit (id, condominium_id, label) values ($1, $2, $3) on conflict (id) do nothing`,
        [unit(n), condominiumId, label],
      );
      await c.query(
        `insert into parking_space (id, condominium_id, number, unit_id, notes) values ($1, $2, $3, $4, 'Numeração provisória (P02)')
         on conflict (id) do nothing`,
        [demoId(`vaga-${n}`), condominiumId, String(n).padStart(2, '0'), unit(n)],
      );
    }
    await seedLinks(c, condominiumId, now, unit, person);
    return r.rowCount === 1;
  });
  return {condominiumId, created, credentials};
}

async function seedLinks(
  c: PoolClient,
  condominiumId: string,
  now: Date,
  unit: (n: number) => string,
  person: (key: string) => string,
) {
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const owner = (key: string, n: number) =>
    c.query(
      `insert into ownership (id, condominium_id, unit_id, person_id, status, starts_at, decided_at, decided_by, decision_note)
       values ($1, $2, $3, $4, 'validated', $5, $5, $6, 'Semeadura demonstrativa') on conflict (id) do nothing`,
      [demoId(`titularidade-${key}-${n}`), condominiumId, unit(n), person(key), at(-400), person('sindica')],
    );
  await owner('sindica', 1);
  await owner('ex-sindico', 2);
  await owner('duas-casas', 3);
  await owner('duas-casas', 4);
  await owner('coproprietaria-a', 5);
  await owner('coproprietario-b', 5);
  await owner('proprietaria-06', 6);
  await owner('conselheiro-1', 7);
  await owner('conselheiro-2', 8);
  await owner('conselheiro-3', 9);
  await owner('subsindica', 11);
  // Casas 12 a 14 sem titular: aguardam os dados reais (P03)
  await c.query(
    `insert into ownership (id, condominium_id, unit_id, person_id, status, requested_at) values ($1, $2, $3, $4, 'pending', $5)
     on conflict (id) do nothing`,
    [demoId('titularidade-pendente-10'), condominiumId, unit(10), person('pedido-pendente'), at(-2)],
  );
  await c.query(
    `insert into residency (id, condominium_id, unit_id, person_id, status, starts_at, created_by)
     values ($1, $2, $3, $4, 'active', $5, $6) on conflict (id) do nothing`,
    [
      demoId('residencia-06'),
      condominiumId,
      unit(6),
      person('morador-contrato'),
      at(-90),
      person('proprietaria-06'),
    ],
  );

  const role = (key: string, roleName: string, scopes: string[] = [], reason = 'Semeadura demonstrativa') =>
    c.query(
      `insert into role_assignment (id, condominium_id, person_id, role, scopes, starts_at, granted_by, reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [
        demoId(`papel-${key}-${roleName}`),
        condominiumId,
        person(key),
        roleName,
        scopes,
        at(-430),
        person('sindica'),
        reason,
      ],
    );
  // mandatos de 1 ano (padrão do piloto; as datas reais são a P04) — o vencido termina antes do vigente começar
  await role('ex-sindico', 'syndic');
  await role('sindica', 'syndic');
  const mandate = (key: string, start: number, end: number) =>
    c.query(
      `insert into mandate (id, condominium_id, role_assignment_id, starts_at, ends_at, minutes_reference)
       values ($1, $2, $3, $4, $5, '[DEMO] Ata de eleição — referência fictícia') on conflict (id) do nothing`,
      [demoId(`mandato-${key}`), condominiumId, demoId(`papel-${key}-syndic`), at(start), at(end)],
    );
  await mandate('ex-sindico', -425, -60);
  await mandate('sindica', -60, 305);
  for (const k of ['conselheiro-1', 'conselheiro-2', 'conselheiro-3']) await role(k, 'fiscal_council');
  await role('tenaz', 'administrator', ['cadastro']);
  await role('prestador', 'service_provider');
  await role('subsindica', 'subsyndic');
  await c.query(
    `insert into delegation (id, condominium_id, role_assignment_id, actions, starts_at, ends_at, document_reference, granted_by)
     values ($1, $2, $3, $4, $5, $6, '[DEMO] Ata de delegação — referência fictícia', $7) on conflict (id) do nothing`,
    [
      demoId('delegacao-subsindica'),
      condominiumId,
      demoId('papel-subsindica-subsyndic'),
      ['ownership.validate', 'unit.read.all'],
      at(-30),
      at(305),
      person('sindica'),
    ],
  );
}
