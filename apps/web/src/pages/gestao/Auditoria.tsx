import {useState, type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {formatDate} from '../../i18n';
import type {AuditEvent} from '../../lib/types';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageTitle,
  Pill,
  SelectField,
} from '../../components/ui';
import {MfaPrompt, needsMfa} from '../../components/MfaPrompt';

type Page = {events: AuditEvent[]; nextBefore: number | null};
const LIMIT = 50;

/** Gestão › Auditoria: só leitura, do condomínio ativo, paginada pelo número do registro. */
export function Auditoria() {
  const {t, i18n} = useTranslation();
  const [draft, setDraft] = useState({result: '', action: ''});
  const [filter, setFilter] = useState({result: '', action: ''});
  const query = useInfiniteQuery({
    queryKey: ['audit', filter],
    initialPageParam: null as number | null,
    queryFn: ({pageParam}) => {
      const params = new URLSearchParams({limit: String(LIMIT)});
      if (pageParam) params.set('before', String(pageParam));
      if (filter.result) params.set('result', filter.result);
      if (filter.action.trim()) params.set('action', filter.action.trim());
      return get<Page>(`/audit-events?${params}`);
    },
    getNextPageParam: (last) => last.nextBefore,
  });
  const events = query.data?.pages.flatMap((p) => p.events) ?? [];
  const label = (action: string) => {
    const key = `gestao.eventos.${action.replace(/\./g, '_')}`;
    return i18n.exists(key) ? t(key) : null;
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setFilter(draft);
  }

  return (
    <div className="grid gap-6">
      <PageTitle lead={t('gestao.auditoria.explica')}>{t('gestao.auditoria.titulo')}</PageTitle>
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end"
      >
        <SelectField
          id="auditoria-resultado"
          label={t('gestao.auditoria.resultado')}
          value={draft.result}
          onChange={(e) => setDraft({...draft, result: e.target.value})}
        >
          <option value="">{t('gestao.auditoria.todos')}</option>
          <option value="ok">{t('gestao.auditoria.ok')}</option>
          <option value="denied">{t('gestao.auditoria.denied')}</option>
          <option value="error">{t('gestao.auditoria.error')}</option>
        </SelectField>
        <Field
          id="auditoria-acao"
          label={t('gestao.auditoria.acao')}
          autoComplete="off"
          maxLength={80}
          value={draft.action}
          onChange={(e) => setDraft({...draft, action: e.target.value})}
        />
        <Button type="submit">{t('gestao.auditoria.filtrar')}</Button>
      </form>
      {query.isPending && <Loading />}
      {query.error &&
        (needsMfa(query.error) ? (
          <MfaPrompt onDone={() => void query.refetch()} />
        ) : (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ))}
      {query.data && events.length === 0 && <Notice tone="info">{t('gestao.auditoria.vazio')}</Notice>}
      {events.length > 0 && (
        <ol className="grid gap-2" aria-label={t('gestao.auditoria.titulo')}>
          {events.map((e) => (
            <li key={e.id}>
              <Card className="gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={e.result === 'ok' ? 'ok' : e.result === 'denied' ? 'bad' : 'wait'}>
                    {t(`gestao.auditoria.${e.result}`)}
                  </Pill>
                  <span className="font-medium">{label(e.action) ?? e.action}</span>
                  {label(e.action) && <code className="text-xs text-suave">{e.action}</code>}
                </div>
                <p className="text-sm text-suave">
                  {formatDate(e.at, i18n.language, true)} ·{' '}
                  {e.actor?.displayName ?? t('gestao.auditoria.sistema')}
                </p>
                {e.reason && (
                  <p className="text-sm">
                    {t('gestao.auditoria.motivo', {
                      motivo: t(`gestao.motivos.${e.reason}`, {defaultValue: e.reason}),
                    })}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}
      {query.hasNextPage ? (
        <Button
          tone="secondary"
          className="justify-self-start"
          busy={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('gestao.auditoria.maisAntigos')}
        </Button>
      ) : (
        events.length > 0 && <p className="text-sm text-suave">{t('gestao.auditoria.fimDoRegistro')}</p>
      )}
    </div>
  );
}
