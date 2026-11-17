import {useState, type FormEvent} from 'react';
import {Link, useLocation} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiError, get, post} from '../lib/api';
import type {MfaStatus} from '../lib/types';
import {Button, Card, Field, Notice, useErrorText} from './ui';

/**
 * Pedido do código de verificação (do aplicativo ou de recuperação). Usado na tela da verificação e em qualquer
 * ação de gestão que a API responda "confirme o código" — depois de confirmar, `onDone` repete o que a pessoa fazia.
 * Quem ainda não configurou recebe o caminho para configurar, com volta para a tela atual.
 */
export function MfaPrompt({onDone, title}: {onDone?: () => void; title?: string}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const location = useLocation();
  const [mode, setMode] = useState<'app' | 'recovery'>('app');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const status = useQuery({queryKey: ['mfa'], queryFn: () => get<MfaStatus>('/auth/mfa')});
  const notEnrolled =
    status.data?.enrolled === false || (error instanceof ApiError && error.code === 'mfa_nao_configurado');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/mfa/verify', mode === 'app' ? {code: value} : {recoveryCode: value});
      setValue('');
      await client.invalidateQueries();
      onDone?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">{title ?? t('mfa.verificar')}</h2>
      {notEnrolled ? (
        <Notice tone="warn">
          <p>{t('mfa.precisaConfigurar')}</p>
          <Link
            to={`/verificacao?de=${encodeURIComponent(location.pathname)}`}
            className="font-medium text-primaria underline underline-offset-4"
          >
            {t('mfa.configurar')}
          </Link>
        </Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:max-w-xs">
          {mode === 'app' ? (
            <Field
              id="codigo"
              label={t('mfa.codigo')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            />
          ) : (
            <Field
              id="recuperacao"
              label={t('mfa.recuperacao')}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={40}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
          {!!error && <Notice tone="error">{errorText(error)}</Notice>}
          <Button
            type="submit"
            busy={busy}
            busyLabel={t('mfa.confirmando')}
            disabled={mode === 'app' ? value.length !== 6 : value.length < 10}
          >
            {t('mfa.confirmar')}
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              setMode(mode === 'app' ? 'recovery' : 'app');
              setValue('');
              setError(null);
            }}
          >
            {mode === 'app' ? t('mfa.usarRecuperacao') : t('mfa.usarApp')}
          </Button>
        </form>
      )}
    </Card>
  );
}

/** O erro pede o código? (gestão sem código na sessão, ou ato crítico sem código recente) */
export const needsMfa = (error: unknown) =>
  error instanceof ApiError && (error.code === 'mfa_exigido' || error.code === 'mfa_recente_exigido');

/**
 * Ação de gestão que pode pedir o código: `guard(erro, repetir)` guarda a repetição quando a API pediu o código;
 * `prompt` mostra o pedido; confirmado, a ação é refeita sem a pessoa preencher nada de novo.
 */
export function useMfaRetry() {
  const [retry, setRetry] = useState<null | (() => void)>(null);
  const guard = (error: unknown, again: () => void) => {
    if (!needsMfa(error)) return false;
    setRetry(() => again);
    return true;
  };
  const prompt = retry ? (
    <MfaPrompt
      onDone={() => {
        const again = retry;
        setRetry(null);
        again();
      }}
    />
  ) : null;
  return {guard, prompt};
}
