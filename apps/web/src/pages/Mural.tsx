import {useState} from 'react';
import {useOutletContext} from 'react-router';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {BulletinContent} from '../components/BulletinContent';
import type {ShellContext} from '../components/Shell';
import {ActionLink, WorkspaceError} from '../components/Workspace';
import {Button, Card, Loading, Notice, Pill} from '../components/ui';
import {get, post} from '../lib/api';
import type {BulletinKind, BulletinReaderEntry} from '../lib/bulletin';
import {canOpen} from '../lib/stays';
import {displayStayTime} from '../lib/stay-time';

function ReaderEntry({
  entry,
  condominiumId,
  timezone,
}: {
  entry: BulletinReaderEntry;
  condominiumId: string;
  timezone: string;
}) {
  const {t, i18n} = useTranslation();
  const cache = useQueryClient();
  const receipt = useMutation({
    mutationFn: (action: 'read' | 'acknowledge') =>
      post(`/bulletin/${entry.id}/receipt`, {action, version: entry.version}),
    onSuccess: () => cache.invalidateQueries({queryKey: ['bulletin', condominiumId]}),
  });
  const when = (value: string) => displayStayTime(value, timezone, i18n.language);
  return (
    <Card>
      <BulletinContent entry={entry} />
      <p className="text-sm text-suave">
        {t('bulletin.publishedBy', {name: entry.publishedBy, date: when(entry.publishedAt)})}
        {' · '}
        {t('bulletin.effective', {date: when(entry.effectiveAt)})}
        {entry.expiresAt && <> · {t('bulletin.expires', {date: when(entry.expiresAt)})}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {entry.acknowledgedAt ? (
          <Pill tone="ok">{t('bulletin.acknowledged', {date: when(entry.acknowledgedAt)})}</Pill>
        ) : (
          <>
            {entry.readAt ? (
              <Pill tone="ok">{t('bulletin.read')}</Pill>
            ) : (
              <Button tone="secondary" busy={receipt.isPending} onClick={() => receipt.mutate('read')}>
                {t('bulletin.markRead')}
              </Button>
            )}
            {entry.requiresAcknowledgement && (
              <Button busy={receipt.isPending} onClick={() => receipt.mutate('acknowledge')}>
                {t('bulletin.acknowledge')}
              </Button>
            )}
          </>
        )}
      </div>
      {receipt.error && (
        <WorkspaceError
          error={receipt.error}
          retry={() => void cache.invalidateQueries({queryKey: ['bulletin', condominiumId]})}
        />
      )}
    </Card>
  );
}

export function Mural() {
  const {t} = useTranslation();
  const {active, access} = useOutletContext<ShellContext>();
  const condominiumId = active?.id ?? '';
  const [page, setPage] = useState(0);
  const offset = page * 100;
  const list = useQuery({
    queryKey: ['bulletin', condominiumId, 'reader', offset],
    enabled: Boolean(active),
    queryFn: () =>
      get<{timezone: string; entries: BulletinReaderEntry[]; more: boolean}>(`/bulletin?offset=${offset}`),
    refetchInterval: 60_000,
  });
  const kinds: BulletinKind[] = ['notice', 'rule'];
  return (
    <div className="vz-flow">
      <header className="vz-section-head">
        <h1 className="vz-page-title">{t('bulletin.title')}</h1>
        {canOpen(access.data?.actions, 'bulletin.publish') && (
          <ActionLink to="/gestao/mural" icon="list" secondary>
            {t('bulletin.manage')}
          </ActionLink>
        )}
      </header>
      {active && list.isPending && <Loading />}
      {list.error && <WorkspaceError error={list.error} retry={() => void list.refetch()} />}
      {list.data && !list.error && (
        <>
          {kinds.map((kind) => {
            const entries = list.data.entries.filter((entry) => entry.kind === kind);
            return (
              <section key={kind} className="grid gap-3" aria-labelledby={`bulletin-${kind}`}>
                <h2 className="vz-subtitle" id={`bulletin-${kind}`}>
                  {t(`bulletin.${kind}List`)}
                </h2>
                {entries.length ? (
                  entries.map((entry) => (
                    <ReaderEntry
                      key={`${entry.id}:${entry.version}`}
                      entry={entry}
                      condominiumId={condominiumId}
                      timezone={list.data.timezone}
                    />
                  ))
                ) : (
                  <Notice>{t(`bulletin.empty_${kind}`)}</Notice>
                )}
              </section>
            );
          })}
          {(page > 0 || list.data.more) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="secondary" disabled={!page} onClick={() => setPage(page - 1)}>
                {t('bulletin.previous')}
              </Button>
              <Button tone="secondary" disabled={!list.data.more} onClick={() => setPage(page + 1)}>
                {t('bulletin.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
