import type {PoolClient} from 'pg';

type Text = {title: string; body: string};
type Translations = Record<'pt-BR', Text> & Partial<Record<'es' | 'en', Text>>;

export type BulletinRow = {
  id: string;
  kind: 'rule' | 'notice';
  version: number;
  translations: Translations;
  share_with_guests: boolean;
  requires_acknowledgement: boolean;
  effective_at: Date;
  expires_at: Date | null;
  published_at: Date;
  published_by: string;
};

export const bulletinContent = (row: BulletinRow) => ({
  id: row.id,
  kind: row.kind,
  version: row.version,
  translations: row.translations,
  effectiveAt: row.effective_at,
  expiresAt: row.expires_at,
});

export const bulletinEntry = (row: BulletinRow) => ({
  ...bulletinContent(row),
  shareWithGuests: row.share_with_guests,
  requiresAcknowledgement: row.requires_acknowledgement,
  publishedAt: row.published_at,
  publishedBy: row.published_by,
});

export const bulletinLimit = 100;

/** A revisão vigente é escolhida antes de filtrar a expiração e o público da publicação. */
export const currentBulletins = `
   with current_revision as (
     select distinct on (r.bulletin_id) r.* from bulletin_revision r
      where r.effective_at <= $1
      order by r.bulletin_id, r.version desc
   )
   select b.id, b.kind, r.version, r.translations, r.share_with_guests, r.requires_acknowledgement,
          r.effective_at, r.expires_at, r.published_at, p.display_name as published_by
     from current_revision r
     join bulletin b on (b.condominium_id, b.id) = (r.condominium_id, r.bulletin_id)
     join person p on p.id = r.published_by
    where (r.expires_at is null or r.expires_at > $1)
`;

export async function guestBulletin(client: PoolClient, now: Date) {
  const result = await client.query<BulletinRow>(
    currentBulletins + ' and r.share_with_guests order by b.kind desc, r.effective_at desc, b.id limit $2',
    [now, bulletinLimit],
  );
  return result.rows.map(bulletinContent);
}
