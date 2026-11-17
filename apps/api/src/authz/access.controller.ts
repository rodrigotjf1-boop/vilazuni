import {Controller, Get, Inject, Req} from '@nestjs/common';
import {ACTIONS, decide, type Action} from '@vilazuni/domain';
import {ActorService} from './actor.service.js';
import type {AuthedRequest} from '../auth/auth.guard.js';

const DAY = 24 * 60 * 60 * 1000;
/** A tela avisa o síndico quando o mandato está perto do fim (sem renovação registrada ninguém registra a nova). */
export const MANDATE_WARNING_DAYS = 30;

type Outcome = 'ok' | 'mfa_exigido' | 'mfa_recente_exigido' | 'negado';

/**
 * O que a pessoa pode fazer no condomínio ativo, para a tela decidir o que MOSTRAR. Não é barreira: cada rota decide
 * de novo, no servidor, a cada pedido (ADR-0004). Também informa o fim do mandato do síndico.
 */
@Controller()
export class AccessController {
  constructor(@Inject(ActorService) private readonly actors: ActorService) {}

  @Get('me/access')
  async access(@Req() req: AuthedRequest) {
    if ((await this.actors.condominiumsOf(req.session!.personId)).length === 0)
      return {condominiumId: null, actions: {}, mandate: null};
    return this.actors.ownData(req, async (client, condominiumId) => {
      const actor = await this.actors.load(client, req.session!.personId, condominiumId, req.session!.mfaAt);
      const actions = {} as Record<Action, Outcome>;
      for (const a of ACTIONS) {
        const d = decide(actor, a);
        actions[a] = d.allow
          ? 'ok'
          : d.reason === 'mfa_exigido' || d.reason === 'mfa_recente_exigido'
            ? d.reason
            : 'negado';
      }
      const now = actor.now.getTime();
      const mandates = actor.roles
        .filter((r) => r.role === 'syndic' && r.status === 'active' && r.mandate)
        .map((r) => r.mandate!)
        .filter((m) => m.status === 'active' && m.startsAt !== null && m.endsAt !== null)
        .filter((m) => m.startsAt!.getTime() <= now && now < m.endsAt!.getTime());
      const current = mandates[0];
      const daysLeft = current ? Math.ceil((current.endsAt!.getTime() - now) / DAY) : null;
      return {
        condominiumId,
        actions,
        mandate: current
          ? {endsAt: current.endsAt, daysLeft, warning: daysLeft !== null && daysLeft <= MANDATE_WARNING_DAYS}
          : null,
      };
    });
  }
}
