import {useState, type FormEvent} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {get, post} from '../lib/api';
import {safeNext} from '../lib/redirect';
import type {MfaStatus} from '../lib/types';
import {
  Button,
  Card,
  CopyButton,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageTitle,
  Pill,
  QrCode,
  useErrorText,
} from '../components/ui';
import {MfaPrompt} from '../components/MfaPrompt';

/** Verificação em duas etapas (ADR-0010): configurar, confirmar o código nesta sessão, trocar de celular. */
export function Verificacao() {
  const {t} = useTranslation();
  const status = useQuery({queryKey: ['mfa'], queryFn: () => get<MfaStatus>('/auth/mfa')});
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (
    <div className="grid max-w-2xl gap-6">
      <PageTitle lead={t('mfa.explica')}>{t('mfa.titulo')}</PageTitle>
      {status.isPending && <Loading />}
      {status.error && <ErrorState error={status.error} retry={() => void status.refetch()} />}
      {recoveryCodes ? (
        <RecoveryCodes
          codes={recoveryCodes}
          onDone={() => {
            setRecoveryCodes(null);
            // veio de uma tela de gestão: volta para ela (a sessão já está confirmada)
            const next = params.get('de');
            if (next) navigate(safeNext(next), {replace: true});
          }}
        />
      ) : (
        status.data &&
        (!status.data.enrolled ? (
          <Setup onEnrolled={setRecoveryCodes} />
        ) : status.data.satisfied ? (
          <Enrolled status={status.data} />
        ) : (
          <Verify />
        ))
      )}
    </div>
  );
}

function Setup({onEnrolled}: {onEnrolled: (codes: string[]) => void}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState<{secret: string; otpauthUri: string} | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSecret(await post<{secret: string; otpauthUri: string}>('/auth/mfa/totp/setup', {password}));
      setPassword('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{recoveryCodes: string[]}>('/auth/mfa/totp/confirm', {code});
      await client.invalidateQueries();
      onEnrolled(r.recoveryCodes);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (!secret)
    return (
      <Card>
        <p className="font-medium">
          <Pill tone="neutral">{t('mfa.situacaoInativa')}</Pill>
        </p>
        <form onSubmit={start} className="grid gap-4 sm:max-w-sm">
          <Field
            id="senha"
            label={t('mfa.passoSenha')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!!error && <Notice tone="error">{errorText(error)}</Notice>}
          <Button type="submit" busy={busy} disabled={!password}>
            {t('mfa.configurar')}
          </Button>
        </form>
      </Card>
    );

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('mfa.passoQr')}</h2>
      <p className="text-suave">{t('mfa.passoQrDica')}</p>
      <div className="flex flex-wrap items-start gap-6">
        <QrCode value={secret.otpauthUri} label={t('mfa.qrAlt')} />
        <div className="grid min-w-0 gap-3">
          <a
            href={secret.otpauthUri}
            className="inline-flex min-h-11 items-center font-medium text-primaria underline underline-offset-4"
          >
            {t('mfa.abrirApp')}
          </a>
          <p className="text-sm text-suave">{t('mfa.chaveManual')}</p>
          <code className="break-all rounded-lg bg-fundo px-3 py-2 font-mono text-base select-all">
            {secret.secret.match(/.{1,4}/g)?.join(' ')}
          </code>
        </div>
      </div>
      <form onSubmit={confirm} className="grid gap-4 sm:max-w-xs">
        <Field
          id="codigo"
          label={t('mfa.passoCodigo')}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        {!!error && <Notice tone="error">{errorText(error)}</Notice>}
        <Button type="submit" busy={busy} busyLabel={t('mfa.confirmando')} disabled={code.length !== 6}>
          {t('mfa.confirmar')}
        </Button>
      </form>
    </Card>
  );
}

function RecoveryCodes({codes, onDone}: {codes: string[]; onDone: () => void}) {
  const {t} = useTranslation();
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('mfa.codigosTitulo')}</h2>
      <Notice tone="warn">{t('mfa.codigosExplica')}</Notice>
      <ul
        className="grid grid-cols-1 gap-2 font-mono text-lg sm:grid-cols-2"
        aria-label={t('mfa.codigosTitulo')}
      >
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-fundo px-3 py-2 select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <CopyButton text={codes.join('\n')} label={t('mfa.codigosCopiar')} />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-5"
        />
        {t('mfa.codigosGuardei')}
      </label>
      <Button onClick={onDone} disabled={!saved}>
        {t('mfa.concluir')}
      </Button>
    </Card>
  );
}

/** Confirmar o código nesta sessão (gestão exige); volta para onde a pessoa estava. */
export function Verify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <MfaPrompt
      onDone={() => {
        const next = params.get('de');
        if (next) navigate(safeNext(next), {replace: true});
      }}
    />
  );
}

function Enrolled({status}: {status: MfaStatus}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/mfa/totp/reset', {password});
      await client.invalidateQueries();
    } catch (err) {
      setError(err);
      setBusy(false);
      // código antigo demais: a pessoa confirma de novo e repete
      void client.invalidateQueries({queryKey: ['mfa']});
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <Pill tone="ok">{t('mfa.situacaoAtiva')}</Pill>
        <Pill tone="ok">{t('mfa.sessaoVerificada')}</Pill>
      </div>
      <p>{t('mfa.restantes', {n: status.recoveryCodesLeft})}</p>
      {!open ? (
        <Button tone="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
          {t('mfa.trocar')}
        </Button>
      ) : !status.recent ? (
        // a API pede um código confirmado nos últimos 15 minutos para trocar de celular
        <Verify />
      ) : (
        <form onSubmit={reset} className="grid gap-4 sm:max-w-sm">
          <p className="text-suave">{t('mfa.trocarExplica')}</p>
          <Field
            id="senha-troca"
            label={t('mfa.senha')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!!error && <Notice tone="error">{errorText(error)}</Notice>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" tone="danger" busy={busy} disabled={!password}>
              {t('mfa.trocarConfirmar')}
            </Button>
            <Button tone="secondary" onClick={() => setOpen(false)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
