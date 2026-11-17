import {useState} from 'react';
import {useNavigate} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {del, get, setCondominium, setCsrf} from '../lib/api';
import {formatDate} from '../i18n';
import type {SessionRow} from '../lib/types';
import {Button, Card, ErrorState, Loading, Notice, PageTitle, Pill, useErrorText} from '../components/ui';

/** Onde a conta está aberta; encerrar uma sessão ou todas (inclusive esta). */
export function Sessoes() {
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => get<{sessions: SessionRow[]}>('/auth/sessions'),
  });
  const [confirmAll, setConfirmAll] = useState(false);
  const [ended, setEnded] = useState(false);
  const endOne = useMutation({
    mutationFn: (id: string) => del(`/auth/sessions/${id}`),
    onSuccess: async () => {
      setEnded(true);
      await client.invalidateQueries({queryKey: ['sessions']});
    },
  });
  const endAll = useMutation({
    mutationFn: () => del('/auth/sessions'),
    onSuccess: () => {
      setCsrf(null);
      setCondominium(null);
      client.clear();
      navigate('/entrar', {replace: true});
    },
  });

  return (
    <div className="grid max-w-3xl gap-6">
      <PageTitle lead={t('sessoes.explica')}>{t('sessoes.titulo')}</PageTitle>
      {sessions.isPending && <Loading />}
      {sessions.error && <ErrorState error={sessions.error} retry={() => void sessions.refetch()} />}
      {ended && <Notice tone="ok">{t('sessoes.encerrada')}</Notice>}
      {(endOne.error || endAll.error) && (
        <Notice tone="error">{errorText(endOne.error ?? endAll.error)}</Notice>
      )}
      {sessions.data && (
        <ul className="grid gap-3">
          {sessions.data.sessions.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {s.transport === 'web' ? t('sessoes.navegador') : t('sessoes.aplicativo')}
                      </span>
                      {s.current && <Pill tone="ok">{t('sessoes.atual')}</Pill>}
                    </div>
                    {s.device && (
                      <p className="truncate text-sm text-suave" title={s.device}>
                        {s.device}
                      </p>
                    )}
                    <p className="text-sm text-suave">
                      {t('sessoes.criada', {data: formatDate(s.createdAt, i18n.language, true)})} ·{' '}
                      {t('sessoes.usada', {data: formatDate(s.lastUsedAt, i18n.language, true)})}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      tone="secondary"
                      busy={endOne.isPending && endOne.variables === s.id}
                      onClick={() => endOne.mutate(s.id)}
                    >
                      {t('sessoes.encerrar')}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {!confirmAll ? (
        <Button tone="danger" className="justify-self-start" onClick={() => setConfirmAll(true)}>
          {t('sessoes.encerrarTodas')}
        </Button>
      ) : (
        <Card>
          <p className="font-medium">{t('sessoes.encerrarTodasConfirma')}</p>
          <div className="flex flex-wrap gap-3">
            <Button tone="danger" busy={endAll.isPending} onClick={() => endAll.mutate()}>
              {t('sessoes.sim')}
            </Button>
            <Button tone="secondary" onClick={() => setConfirmAll(false)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
