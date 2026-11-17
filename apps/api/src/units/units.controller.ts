import {Controller, Get, Inject, Param, Req} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {ActorService} from '../authz/actor.service.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {pathId} from '../http/validate.js';
import {notFound} from '../http/errors.js';

const unitView = (u: Record<string, unknown>) => ({
  id: u.id as string,
  label: u.label as string,
  officialNumber: (u.official_number as string | null) ?? null,
  bedrooms: (u.bedrooms as number | null) ?? null,
  status: u.status as string,
  // Uma vaga por casa (regra inicial do piloto): coproprietários veem a MESMA vaga — nunca uma por pessoa (T05).
  parkingSpace: u.parking_number
    ? {number: u.parking_number as string, accessible: u.parking_accessible as boolean}
    : null,
});

const UNIT_SELECT = `select u.*, p.number as parking_number, p.accessible as parking_accessible
                       from unit u left join parking_space p on p.condominium_id = u.condominium_id and p.unit_id = u.id`;

@Controller()
export class UnitsController {
  constructor(@Inject(ActorService) private readonly actors: ActorService) {}

  /** Minhas casas no condomínio ativo, com a situação de cada vínculo (pendente aparece como pendente). */
  @Get('me/units')
  async mine(@Req() req: AuthedRequest) {
    if ((await this.actors.condominiumsOf(req.session!.personId)).length === 0) return {units: []};
    return this.actors.ownData(req, async (client) => {
      // titularidade e residência (morador de contrato) — cada uma com a sua situação; mesma casa = um cartão só
      const r = await client.query(
        `select v.*, u.*, p.number as parking_number, p.accessible as parking_accessible
           from (
             select o.id as link_id, 'ownership' as link_type, o.unit_id as link_unit, o.status as link_status,
                    o.starts_at as link_starts, o.ends_at as link_ends, o.requested_at as link_requested,
                    case when o.status = 'rejected' then o.decision_note end as link_note
               from ownership o where o.person_id = $1 and o.status in ('pending','validated','rejected')
             union all
             select r.id, 'residency', r.unit_id, r.status, r.starts_at, r.ends_at, r.created_at, null
               from residency r where r.person_id = $1 and r.status in ('pending','active')
           ) v
           join unit u on u.id = v.link_unit
           left join parking_space p on p.condominium_id = u.condominium_id and p.unit_id = u.id
          order by u.label, v.link_type, v.link_requested desc`,
        [req.session!.personId],
      );
      const units = new Map<string, ReturnType<typeof unitView> & {links: unknown[]}>();
      for (const row of r.rows) {
        const unit = units.get(row.id) ?? {...unitView(row), links: []};
        unit.links.push({
          id: row.link_id,
          type: row.link_type,
          status: row.link_status,
          startsAt: row.link_starts,
          endsAt: row.link_ends,
          requestedAt: row.link_requested,
          // o motivo da recusa é do próprio pedido da pessoa
          decisionNote: row.link_note ?? null,
        });
        units.set(row.id, unit);
      }
      return {units: [...units.values()]};
    });
  }

  /**
   * Só o nome de cada casa, para quem pode pedir titularidade escolher qual ("informa as casas", especificação §6).
   * Nada de titular, vaga ou situação — isso é da gestão.
   */
  @Get('unit-labels')
  async labels(@Req() req: AuthedRequest) {
    return this.actors.run(req, 'ownership.request', async (client) => {
      const r = await client.query(`select id, label from unit where status = 'active' order by label`);
      return {units: r.rows.map((u) => ({id: u.id as string, label: u.label as string}))};
    });
  }

  /** Todas as casas — só quem gere ou fiscaliza (sem dados pessoais na lista). */
  @Get('units')
  async list(@Req() req: AuthedRequest) {
    return this.actors.run(req, 'unit.read.all', async (client) => {
      const r = await client.query(`${UNIT_SELECT} order by u.label`);
      return {units: r.rows.map(unitView)};
    });
  }

  /**
   * Uma casa: a pessoa vê a dela; a gestão vê qualquer uma do condomínio. Casa de outra pessoa ou de outro
   * condomínio responde 404, igual a "não existe" (T02, T03, T54).
   */
  @Get('units/:id')
  async one(@Req() req: AuthedRequest, @Param('id') id: string) {
    const unitId = pathId(id);
    return this.actors.run(
      req,
      ['unit.read.own', 'unit.read.all'],
      async (client, actor) => {
        const r = await client.query(`${UNIT_SELECT} where u.id = $1`, [unitId]);
        if (!r.rows[0]) throw notFound();
        return {unit: {...unitView(r.rows[0]), owners: await this.owners(client, unitId, actor.now)}};
      },
      {unitId},
      {denyAs: 'not_found'},
    );
  }

  /** Proprietários vigentes da casa: só o nome (contato completo fica para a gestão autorizada, em rota própria). */
  private async owners(client: PoolClient, unitId: string, now: Date) {
    // "agora" é o relógio do servidor da aplicação (o mesmo da decisão), nunca o now() do banco
    const r = await client.query(
      `select p.id, p.display_name, o.starts_at from ownership o join person p on p.id = o.person_id
        where o.unit_id = $1 and o.status = 'validated' and o.starts_at <= $2 and (o.ends_at is null or o.ends_at > $2)
        order by o.starts_at`,
      [unitId, now],
    );
    return r.rows.map((o) => ({personId: o.id, displayName: o.display_name, since: o.starts_at}));
  }
}
