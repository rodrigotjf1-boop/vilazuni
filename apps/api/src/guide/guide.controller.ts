import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {FileFieldsInterceptor} from '@nestjs/platform-express';
import {decide, type Action} from '@vilazuni/domain';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {audit} from '../audit/audit.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {ActorService} from '../authz/actor.service.js';
import {uuidv7} from '../db/tenant.js';
import {conflict, notFound} from '../http/errors.js';
import {parse, pathId} from '../http/validate.js';
import {
  guidePhoto,
  maxPhotoBytes,
  photoSlots,
  type PhotoFiles,
  unitGuide,
  updatePhotos,
} from './guide-store.js';

const fields = z
  .object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().min(3).max(3000),
    directions: z.string().trim().min(3).max(2000),
    transport: z.string().trim().min(3).max(1200),
    tips: z.string().trim().max(2000).default(''),
  })
  .strict();
const versionSchema = z.number().int().positive().max(2147483647);
const updateSchema = fields.extend({
  version: versionSchema,
  removePhotos: z.array(z.number().int().min(1).max(3)).max(3).default([]),
});
const Photos = FileFieldsInterceptor(
  photoSlots.map((slot) => ({name: `photo${slot}`, maxCount: 1})),
  {limits: {fileSize: maxPhotoBytes, files: 3, fields: 1, fieldSize: 48 * 1024}},
);

function multipartData(raw: unknown): unknown {
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

const values = ({title, description, directions, transport, tips}: z.infer<typeof fields>) => [
  title,
  description,
  directions,
  transport,
  tips,
];

const changed = () =>
  conflict('versao_desatualizada', 'A atração foi atualizada. Recarregue o guia e tente de novo.');

async function activeUnit(client: PoolClient, unitId: string) {
  const {rows} = await client.query<{label: string}>(
    "select label from unit where id = $1 and status = 'active'",
    [unitId],
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

const readAction: Action = 'unit.read.own';
const writeAction: Action = 'guide.write.own';
const hideDenied = {denyAs: 'not_found'} as const;

@Controller('units/:unitId/guide')
export class GuideController {
  constructor(@Inject(ActorService) private readonly actors: ActorService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: AuthedRequest, @Param('unitId') unit: string) {
    const unitId = pathId(unit);
    return this.actors.run(
      req,
      readAction,
      async (client, actor) => {
        const {label} = await activeUnit(client, unitId);
        return {
          unitLabel: label,
          canEdit: decide(actor, writeAction, {unitId}).allow,
          attractions: await unitGuide(client, unitId),
        };
      },
      {unitId},
      hideDenied,
    );
  }

  @Get(':attractionId/photos/:slot')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(
    @Req() req: AuthedRequest,
    @Param('unitId') unit: string,
    @Param('attractionId') attraction: string,
    @Param('slot') slot: string,
  ) {
    const unitId = pathId(unit);
    const id = pathId(attraction);
    return this.actors.run(
      req,
      readAction,
      async (client) => {
        await activeUnit(client, unitId);
        return guidePhoto(client, unitId, id, slot);
      },
      {unitId},
      hideDenied,
    );
  }

  @Post()
  @UseInterceptors(Photos)
  async create(
    @Req() req: AuthedRequest,
    @Param('unitId') unit: string,
    @Body('data') raw: unknown,
    @UploadedFiles() files: PhotoFiles = {},
  ) {
    const unitId = pathId(unit);
    const data = parse(fields, multipartData(raw));
    return this.actors.run(
      req,
      writeAction,
      async (client, actor) => {
        await activeUnit(client, unitId);
        const id = uuidv7(actor.now.getTime());
        await client.query(
          `insert into unit_attraction (id, condominium_id, unit_id, title, description, directions, transport, tips)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, actor.condominiumId, unitId, ...values(data)],
        );
        await updatePhotos(client, actor.condominiumId, id, [], files);
        await audit(client, {
          condominiumId: actor.condominiumId,
          actorPersonId: actor.personId,
          actorKind: 'person',
          action: 'guide.create',
          objectType: 'unit_attraction',
          objectId: id,
        });
        return {id};
      },
      {unitId},
      hideDenied,
    );
  }

  @Post(':attractionId')
  @UseInterceptors(Photos)
  async edit(
    @Req() req: AuthedRequest,
    @Param('unitId') unit: string,
    @Param('attractionId') attraction: string,
    @Body('data') raw: unknown,
    @UploadedFiles() files: PhotoFiles = {},
  ) {
    const unitId = pathId(unit);
    const id = pathId(attraction);
    const data = parse(updateSchema, multipartData(raw));
    return this.actors.run(
      req,
      writeAction,
      async (client, actor) => {
        await activeUnit(client, unitId);
        const result = await client.query(
          `update unit_attraction
            set title = $4, description = $5, directions = $6, transport = $7, tips = $8, version = version + 1
          where unit_id = $1 and id = $2 and version = $3`,
          [unitId, id, data.version, ...values(data)],
        );
        if (!result.rowCount) await this.checkMissingOrChanged(client, unitId, id);
        await updatePhotos(client, actor.condominiumId, id, data.removePhotos, files);
        await audit(client, {
          condominiumId: actor.condominiumId,
          actorPersonId: actor.personId,
          actorKind: 'person',
          action: 'guide.edit',
          objectType: 'unit_attraction',
          objectId: id,
        });
        return {id};
      },
      {unitId},
      hideDenied,
    );
  }

  @Delete(':attractionId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('unitId') unit: string,
    @Param('attractionId') attraction: string,
    @Query('version') inputVersion: unknown,
  ) {
    const unitId = pathId(unit);
    const id = pathId(attraction);
    const version = parse(z.coerce.number().pipe(versionSchema), inputVersion);
    return this.actors.run(
      req,
      writeAction,
      async (client, actor) => {
        await activeUnit(client, unitId);
        const result = await client.query(
          'delete from unit_attraction where unit_id = $1 and id = $2 and version = $3',
          [unitId, id, version],
        );
        if (!result.rowCount) await this.checkMissingOrChanged(client, unitId, id);
        await audit(client, {
          condominiumId: actor.condominiumId,
          actorPersonId: actor.personId,
          actorKind: 'person',
          action: 'guide.remove',
          objectType: 'unit_attraction',
          objectId: id,
        });
        return {id};
      },
      {unitId},
      hideDenied,
    );
  }

  private async checkMissingOrChanged(client: PoolClient, unitId: string, id: string): Promise<never> {
    const {rowCount} = await client.query('select id from unit_attraction where unit_id = $1 and id = $2', [
      unitId,
      id,
    ]);
    throw rowCount ? changed() : notFound();
  }
}
