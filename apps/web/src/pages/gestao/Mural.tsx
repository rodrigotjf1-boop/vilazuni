import {useId, useState, type FormEvent} from 'react';
import {useOutletContext} from 'react-router';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ActionLink, WorkspaceError} from '../../components/Workspace';
import {Button, Card, Field, Loading, Notice, SelectField, useErrorText} from '../../components/ui';
import type {ShellContext} from '../../components/Shell';
import {BulletinContent} from '../../components/BulletinContent';
import {LANGS, type Lang} from '../../i18n';
import {ApiError, get, post} from '../../lib/api';
import {
  bulletinText,
  type BulletinKind,
  type BulletinManagedEntry,
  type Translations,
} from '../../lib/bulletin';
import {displayStayTime, localStayTime, stayTimeInput} from '../../lib/stay-time';

type BulletinPage = {timezone: string; entries: BulletinManagedEntry[]; more: boolean};

function RevisionForm({
  entry,
  timezone,
  close,
  condominiumId,
}: {
  entry: BulletinManagedEntry | null;
  timezone: string;
  close: () => void;
  condominiumId: string;
}) {
  const {t} = useTranslation();
  const id = useId();
  const cache = useQueryClient();
  const errorText = useErrorText();
  const languages: Record<Lang, string> = {'pt-BR': 'Português', es: 'Español', en: 'English'};
  const [kind, setKind] = useState<BulletinKind>(entry?.kind ?? 'notice');
  const publish = useMutation({
    mutationFn: (form: FormData) => {
      const read = (field: string) => String(form.get(field) ?? '').trim();
      const translations: Translations = {'pt-BR': {title: read('pt-BR-title'), body: read('pt-BR-body')}};
      for (const lang of ['es', 'en'] as const) {
        const title = read(`${lang}-title`);
        const body = read(`${lang}-body`);
        if (Boolean(title) !== Boolean(body))
          throw new ApiError(
            400,
            'traducao_incompleta',
            t('bulletin.translationRequired', {language: languages[lang]}),
          );
        if (title && body) translations[lang] = {title, body};
      }
      const date = (field: string) => {
        const local = read(field);
        if (!local) return undefined;
        try {
          return localStayTime(local, timezone);
        } catch {
          throw new ApiError(400, 'data_invalida', t('bulletin.invalidDate'));
        }
      };
      const body = {
        translations,
        effectiveAt: date('effective'),
        expiresAt: date('expires'),
        shareWithGuests: form.has('guest'),
        requiresAcknowledgement: form.has('ack'),
      };
      return entry
        ? post(`/bulletin/${entry.id}/revisions`, {...body, version: entry.version})
        : post('/bulletin', {...body, kind});
    },
    onSuccess: async () => {
      await cache.invalidateQueries({queryKey: ['bulletin', condominiumId]});
      close();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    publish.mutate(new FormData(event.currentTarget));
  }
  return (
    <Card>
      <h2 className="vz-subtitle">{t(entry ? 'bulletin.revision' : 'bulletin.new')}</h2>
      <form className="grid gap-4" onSubmit={submit}>
        {!entry && (
          <SelectField
            label={t('bulletin.kind')}
            value={kind}
            onChange={(event) => setKind(event.target.value as BulletinKind)}
          >
            <option value="notice">{t('bulletin.notice')}</option>
            <option value="rule">{t('bulletin.rule')}</option>
          </SelectField>
        )}
        {LANGS.map((lang) => (
          <fieldset key={lang} className="grid min-w-0 gap-2 rounded-lg border border-linha p-3">
            <legend className="px-1 font-medium">{languages[lang]}</legend>
            <Field
              name={`${lang}-title`}
              label={t('bulletin.subject')}
              minLength={3}
              maxLength={120}
              required={lang === 'pt-BR'}
              defaultValue={entry?.translations[lang]?.title}
            />
            <label className="grid gap-1" htmlFor={`${id}-${lang}`}>
              <span className="font-medium">{t('bulletin.body')}</span>
              <textarea
                id={`${id}-${lang}`}
                name={`${lang}-body`}
                className="w-full min-w-0 rounded-lg border border-linha bg-superficie p-3"
                minLength={3}
                maxLength={12000}
                rows={3}
                required={lang === 'pt-BR'}
                defaultValue={entry?.translations[lang]?.body}
              />
            </label>
          </fieldset>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="effective"
            type="datetime-local"
            label={t('bulletin.startsAt')}
            hint={t('bulletin.immediate', {timezone})}
            defaultValue={
              entry && Date.parse(entry.effectiveAt) > Date.now()
                ? stayTimeInput(entry.effectiveAt, timezone)
                : undefined
            }
          />
          <Field
            name="expires"
            type="datetime-local"
            label={t('bulletin.endsAt')}
            defaultValue={
              entry?.expiresAt && Date.parse(entry.expiresAt) > Date.now()
                ? stayTimeInput(entry.expiresAt, timezone)
                : undefined
            }
          />
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="guest" defaultChecked={entry?.shareWithGuests} />
          {t('bulletin.share')}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="ack"
            defaultChecked={entry?.requiresAcknowledgement ?? kind === 'rule'}
            key={entry ? entry.id : kind}
          />
          {t('bulletin.requireAck')}
        </label>
        {publish.error && <Notice tone="error">{errorText(publish.error)}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={publish.isPending}>
            {t('bulletin.approvePublish')}
          </Button>
          <Button tone="secondary" disabled={publish.isPending} onClick={close}>
            {t('bulletin.close')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PublicationHistory({entry, condominiumId}: {entry: BulletinManagedEntry; condominiumId: string}) {
  const {t, i18n} = useTranslation();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const offset = page * 100;
  const list = useQuery({
    queryKey: ['bulletin', condominiumId, 'history', entry.id, offset],
    queryFn: () => get<BulletinPage>(`/bulletin/manage?id=${entry.id}&offset=${offset}`),
    enabled: open,
  });
  return (
    <>
      <div>
        <Button tone="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {t(open ? 'bulletin.hideHistory' : 'bulletin.history')}
        </Button>
      </div>
      {open && list.isPending && <Loading />}
      {open && list.error && <WorkspaceError error={list.error} retry={() => void list.refetch()} />}
      {open && list.data && (
        <>
          {list.data.entries.map((revision) => (
            <details key={revision.version} className="grid rounded-lg border border-linha p-3">
              <summary className="cursor-pointer font-medium break-words">
                {t('bulletin.version', {version: revision.version})} ·{' '}
                {bulletinText(revision, i18n.language).text.title}
              </summary>
              <div className="mt-3 grid gap-2">
                <BulletinContent entry={revision} />
                <p className="text-sm text-suave">
                  {t('bulletin.publishedBy', {
                    name: revision.publishedBy,
                    date: displayStayTime(revision.publishedAt, list.data.timezone, i18n.language),
                  })}
                </p>
                <p className="text-sm text-suave">{t('bulletin.receipts', revision)}</p>
              </div>
            </details>
          ))}
          {(page > 0 || list.data.more) && (
            <div className="flex flex-wrap gap-2">
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
    </>
  );
}

export function GerirMural() {
  const {t, i18n} = useTranslation();
  const {active} = useOutletContext<ShellContext>();
  const condominiumId = active?.id ?? '';
  const [editing, setEditing] = useState<BulletinManagedEntry | null | undefined>();
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ['bulletin', condominiumId, 'manage', page],
    enabled: Boolean(active),
    queryFn: () => get<BulletinPage>(`/bulletin/manage?offset=${page * 100}`),
  });
  const timezone = list.data?.timezone;
  const when = (value: string) => displayStayTime(value, timezone!, i18n.language);
  return (
    <div className="vz-flow">
      <header className="vz-section-head">
        <h1 className="vz-page-title">{t('bulletin.manage')}</h1>
        <div className="vz-inline-actions">
          <ActionLink to="/mural" secondary icon="list">
            {t('bulletin.title')}
          </ActionLink>
          {list.data && !list.error && (
            <Button disabled={editing !== undefined} onClick={() => setEditing(null)}>
              {t('bulletin.new')}
            </Button>
          )}
        </div>
      </header>
      {active && list.isPending && <Loading />}
      {list.error && <WorkspaceError error={list.error} retry={() => void list.refetch()} />}
      {list.data && !list.error && (
        <>
          {editing !== undefined && (
            <RevisionForm
              key={editing?.id ?? 'new'}
              entry={editing}
              timezone={list.data.timezone}
              condominiumId={condominiumId}
              close={() => setEditing(undefined)}
            />
          )}
          {!list.data.entries.length && <Notice>{t('bulletin.emptyManage')}</Notice>}
          {list.data.entries.map((entry) => (
            <Card key={entry.id}>
              <p className="text-sm font-medium text-suave">
                {t(`bulletin.${entry.kind}`)} · {t('bulletin.effective', {date: when(entry.effectiveAt)})}
                {entry.expiresAt && <> · {t('bulletin.expires', {date: when(entry.expiresAt)})}</>}
              </p>
              <BulletinContent entry={entry} />
              <p className="text-sm text-suave">
                {t('bulletin.publishedBy', {name: entry.publishedBy, date: when(entry.publishedAt)})}
                {' · '}
                {t('bulletin.receipts', entry)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button tone="secondary" disabled={editing !== undefined} onClick={() => setEditing(entry)}>
                  {t('bulletin.revision')}
                </Button>
              </div>
              {entry.version > 1 && <PublicationHistory entry={entry} condominiumId={condominiumId} />}
            </Card>
          ))}
          {(page > 0 || list.data.more) && (
            <div className="flex flex-wrap gap-2">
              <Button
                tone="secondary"
                disabled={!page || editing !== undefined}
                onClick={() => setPage(page - 1)}
              >
                {t('bulletin.previous')}
              </Button>
              <Button
                tone="secondary"
                disabled={!list.data.more || editing !== undefined}
                onClick={() => setPage(page + 1)}
              >
                {t('bulletin.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
