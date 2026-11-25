import {StreamableFile} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {badRequest, notFound} from '../http/errors.js';
import {parse} from '../http/validate.js';

export const photoSlots = [1, 2, 3] as const;
export const maxPhotoBytes = 2 * 1024 * 1024;
export const slotSchema = z.coerce.number().int().min(1).max(3);
export type Photo = {mimetype: string; buffer: Buffer};
export type PhotoFiles = Partial<Record<`photo${(typeof photoSlots)[number]}`, Photo[]>>;

export async function unitGuide(client: PoolClient, unitId: string) {
  const {rows} = await client.query<{
    id: string;
    title: string;
    description: string;
    directions: string;
    transport: string;
    tips: string;
    version: number;
    photoSlots: number[];
  }>(
    `select a.id, a.title, a.description, a.directions, a.transport, a.tips, a.version,
            array(select p.slot from unit_attraction_photo p
                   where p.condominium_id = a.condominium_id and p.attraction_id = a.id order by p.slot) as "photoSlots"
       from unit_attraction a where a.unit_id = $1 order by lower(a.title), a.id`,
    [unitId],
  );
  return rows;
}

export async function guidePhoto(client: PoolClient, unitId: string, id: string, slot: string) {
  const {rows} = await client.query<{mime: string; bytes: Buffer}>(
    `select p.mime, p.bytes from unit_attraction_photo p
       join unit_attraction a on a.condominium_id = p.condominium_id and a.id = p.attraction_id
      where a.unit_id = $1 and a.id = $2 and p.slot = $3`,
    [unitId, id, parse(slotSchema, slot)],
  );
  const photo = rows[0];
  if (!photo) throw notFound();
  return new StreamableFile(photo.bytes, {type: photo.mime});
}

function validPhoto({mimetype, buffer}: Photo): boolean {
  if (buffer.length > maxPhotoBytes) return false;
  switch (mimetype) {
    case 'image/jpeg':
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}

export async function updatePhotos(
  client: PoolClient,
  condominiumId: string,
  id: string,
  remove: number[],
  files: PhotoFiles,
) {
  for (const slot of photoSlots) {
    const photo = files[`photo${slot}`]?.[0];
    if (photo) {
      if (!validPhoto(photo))
        throw badRequest('guia_foto_invalida', 'Use uma foto JPEG, PNG ou WebP de até 2 MB.');
      await client.query(
        `insert into unit_attraction_photo (condominium_id, attraction_id, slot, mime, bytes)
         values ($1, $2, $3, $4, $5)
         on conflict (condominium_id, attraction_id, slot)
         do update set mime = excluded.mime, bytes = excluded.bytes`,
        [condominiumId, id, slot, photo.mimetype, photo.buffer],
      );
    } else if (remove.includes(slot)) {
      await client.query('delete from unit_attraction_photo where attraction_id = $1 and slot = $2', [
        id,
        slot,
      ]);
    }
  }
}
