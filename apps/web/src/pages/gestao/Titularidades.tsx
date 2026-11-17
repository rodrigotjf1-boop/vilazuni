import {useState, type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {get, post} from '../../lib/api';
import {formatDate} from '../../i18n';
import type {OwnershipRequest} from '../../lib/types';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageTitle,
  Pill,
  useErrorText,
} from '../../components/ui';
import {MfaPrompt, needsMfa, useMfaRetry} from '../../components/MfaPrompt';
import {InviteOwner} from './InviteOwner';
import {SignupLinks} from './SignupLinks';

type Status = 'pending' | 'validated' | 'rejected';
const TABS: {status: Status; key: string}[] = [
  {status: 'pending', key: 'pendentes'},
  {status: 'validated', key: 'validadas'},
  {status: 'rejected', key: 'recusadas'},
];

/** Gestão › Titularidades: a gestão autorizada valida ou recusa (com motivo) e convida proprietários. */
export function Titularidades() {
  const {t} = useTranslation();
  const [status, setStatus] = useState<Status>('pending');
  const list = useQuery({
    queryKey: ['ownership-requests', status],
    queryFn: () => get<{requests: OwnershipRequest[]}>(`/ownership-requests?status=${status}`),
  });
  const {guard, prompt} = useMfaRetry();

  return (
    <div className="grid gap-6">
      <PageTitle lead={t('gestao.titularidades.explica')}>{t('gestao.titularidades.titulo')}</PageTitle>
      {prompt}
      <SignupLinks guard={guard} />
      <InviteOwner guard={guard} />
      <div role="group" aria-label={t('gestao.titularidades.filtro')} className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            aria-pressed={status === tab.status}
            onClick={() => setStatus(tab.status)}
            className="min-h-11 rounded-full border border-linha bg-superficie px-4 aria-pressed:border-primaria aria-pressed:bg-primaria aria-pressed:text-white"
          >
            {t(`gestao.titularidades.${tab.key}`)}
          </button>
        ))}
      </div>
      {list.isPending && <Loading />}
      {list.error &&
        (needsMfa(list.error) ? (
          <MfaPrompt onDone={() => void list.refetch()} />
        ) : (
          <ErrorState error={list.error} retry={() => void list.refetch()} />
        ))}
      {list.data && list.data.requests.length === 0 && (
        <Notice tone="info">{t('gestao.titularidades.vazio')}</Notice>
      )}
      {list.data && list.data.requests.length > 0 && (
        <ul className="grid gap-3">
          {list.data.requests.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} guard={guard} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({
  request: r,
  guard,
}: {
  request: OwnershipRequest;
  guard: (error: unknown, again: () => void) => boolean;
}) {
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [open, setOpen] = useState<null | 'validate' | 'reject'>(null);
  const [startsAt, setStartsAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide() {
    setBusy(true);
    setError(null);
    try {
      if (open === 'validate')
        await post(`/ownership-requests/${r.id}/validate`, {
          version: r.version,
          ...(startsAt ? {startsAt} : {}),
          ...(note.trim() ? {note: note.trim()} : {}),
        });
      else await post(`/ownership-requests/${r.id}/reject`, {version: r.version, note: note.trim()});
      setDone(open === 'validate' ? t('gestao.titularidades.validado') : t('gestao.titularidades.recusado'));
      setOpen(null);
      await client.invalidateQueries({queryKey: ['ownership-requests']});
    } catch (err) {
      if (!guard(err, () => void decide())) setError(err);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void decide();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-lg font-semibold">
            {r.unit.label} · {r.person.displayName}
          </h2>
          <p className="break-all text-sm text-suave">{r.person.email}</p>
          <p className="text-sm text-suave">
            {t('gestao.titularidades.pedidoEm', {data: formatDate(r.requestedAt, i18n.language)})}
            {r.decidedAt && (
              <> · {t('gestao.titularidades.decididoEm', {data: formatDate(r.decidedAt, i18n.language)})}</>
            )}
          </p>
          {r.shareNote && <p>{t('gestao.titularidades.observacao', {texto: r.shareNote})}</p>}
          {r.decisionNote && <p>{t('gestao.titularidades.nota', {texto: r.decisionNote})}</p>}
          {r.status === 'validated' && r.startsAt && (
            <Pill tone="ok">
              {t('gestao.titularidades.titularDesde', {data: formatDate(r.startsAt, i18n.language)})}
            </Pill>
          )}
        </div>
        {r.status === 'pending' && !open && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen('validate')}>{t('gestao.titularidades.validar')}</Button>
            <Button tone="danger" onClick={() => setOpen('reject')}>
              {t('gestao.titularidades.recusar')}
            </Button>
          </div>
        )}
      </div>
      {done && <Notice tone="ok">{done}</Notice>}
      {open && (
        <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
          {open === 'validate' && (
            <Field
              id={`desde-${r.id}`}
              type="date"
              label={t('gestao.titularidades.desde')}
              hint={t('gestao.titularidades.desdeDica')}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
          <Field
            id={`nota-${r.id}`}
            label={
              open === 'validate' ? t('gestao.titularidades.notaCampo') : t('gestao.titularidades.motivo')
            }
            hint={open === 'reject' ? t('gestao.titularidades.motivoDica') : undefined}
            required={open === 'reject'}
            minLength={open === 'reject' ? 3 : undefined}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {!!error && <Notice tone="error">{errorText(error)}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              tone={open === 'reject' ? 'danger' : 'primary'}
              busy={busy}
              disabled={open === 'reject' && note.trim().length < 3}
            >
              {open === 'validate'
                ? t('gestao.titularidades.confirmarValidacao')
                : t('gestao.titularidades.confirmarRecusa')}
            </Button>
            <Button tone="secondary" onClick={() => setOpen(null)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
