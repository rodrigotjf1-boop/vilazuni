import {useState, type FormEvent} from 'react';
import {Link, useParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {ApiError, get, post} from '../lib/api';
import {formatDate, isLang, type Lang} from '../i18n';
import type {SignupPreview} from '../lib/types';
import {Button, Card, ErrorState, Field, Loading, Notice, PageTitle, SelectField, useErrorText} from '../components/ui';
import {LanguagePicker} from '../components/LanguagePicker';

const MAX_CASAS = 5;

interface Sent {
  verificationId: string;
  email: string;
}
interface Done {
  requested: string[];
  alreadyLinked: string[];
}

/**
 * Cadastro pelo link do condomínio (ADR-0011): (1) o e-mail recebe um código; (2) com o código, a pessoa cria a
 * conta (ou prova a senha da que já tem) e pede as casas. Tudo fica pendente até a validação da gestão.
 */
export function Cadastro() {
  const {token = ''} = useParams();
  const {t, i18n} = useTranslation();
  const path = `/signup/${encodeURIComponent(token)}`;
  const preview = useQuery({
    queryKey: ['cadastro', token],
    queryFn: () => get<SignupPreview>(path),
    retry: false,
  });
  const [sent, setSent] = useState<Sent | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [lang, setLang] = useState<Lang>(isLang(i18n.language) ? i18n.language : 'pt-BR');
  const info = preview.data;
  // link que deixou de valer no meio do cadastro: relê a prévia, que mostra o motivo
  const linkGone = (err: unknown) => {
    if (err instanceof ApiError && err.status === 410 && err.code.startsWith('link_')) void preview.refetch();
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-lg content-start gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-semibold text-primaria">{t('app.nome')}</p>
        <LanguagePicker />
      </div>
      <PageTitle lead={t('cadastro.explica')}>{t('cadastro.titulo')}</PageTitle>

      {preview.isPending && <Loading />}
      {preview.error instanceof ApiError && preview.error.status === 404 && (
        <Notice tone="error">{t('cadastro.naoEncontrado')}</Notice>
      )}
      {preview.error && !(preview.error instanceof ApiError && preview.error.status === 404) && (
        <ErrorState
          error={preview.error}
          retry={
            preview.error instanceof ApiError && preview.error.status === 410
              ? undefined
              : () => void preview.refetch()
          }
        />
      )}

      {done && (
        <Card>
          <Notice tone="ok">{t('cadastro.pronto')}</Notice>
          {done.requested.length > 0 && <p>{t('cadastro.pedidas', {casas: done.requested.join(', ')})}</p>}
          {done.alreadyLinked.length > 0 && (
            <p className="text-suave">{t('cadastro.jaLigadas', {casas: done.alreadyLinked.join(', ')})}</p>
          )}
          <Link
            to="/entrar"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primaria px-4 font-medium text-white"
          >
            {t('cadastro.irEntrar')}
          </Link>
        </Card>
      )}

      {info && !done && (
        <>
          <Card>
            <p className="text-xl font-semibold">{info.condominiumName}</p>
            <p className="text-suave">
              {t('cadastro.validoAte', {data: formatDate(info.expiresAt, i18n.language, true)})}
            </p>
          </Card>
          {!info.emailAvailable ? (
            <Notice tone="warn">{t('cadastro.semEnvio')}</Notice>
          ) : !sent ? (
            <EmailStep path={path} lang={lang} setLang={setLang} onSent={setSent} onError={linkGone} />
          ) : (
            <FinishStep
              path={path}
              lang={lang}
              units={info.units}
              sent={sent}
              onResent={setSent}
              onBack={() => setSent(null)}
              onDone={setDone}
              onError={linkGone}
            />
          )}
        </>
      )}
    </main>
  );
}

function EmailStep({
  path,
  lang,
  setLang,
  onSent,
  onError,
}: {
  path: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  onSent: (s: Sent) => void;
  onError: (err: unknown) => void;
}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{verificationId: string}>(`${path}/code`, {email: email.trim(), preferredLanguage: lang});
      onSent({verificationId: r.verificationId, email: email.trim().toLowerCase()});
    } catch (err) {
      setError(err);
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-linha bg-superficie p-5" noValidate>
      <h2 className="text-lg font-semibold">{t('cadastro.passoEmail')}</h2>
      <p className="text-suave">{t('cadastro.passoEmailDica')}</p>
      <Field
        id="cadastro-email"
        label={t('cadastro.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SelectField
        id="cadastro-idioma"
        label={t('cadastro.idioma')}
        value={lang}
        onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
      >
        <option value="pt-BR">{t('idiomas.pt-BR')}</option>
        <option value="es">{t('idiomas.es')}</option>
        <option value="en">{t('idiomas.en')}</option>
      </SelectField>
      {!!error && <Notice tone="error">{errorText(error)}</Notice>}
      <Button type="submit" busy={busy} busyLabel={t('cadastro.enviando')} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>
        {t('cadastro.enviarCodigo')}
      </Button>
    </form>
  );
}

function FinishStep({
  path,
  lang,
  units,
  sent,
  onResent,
  onBack,
  onDone,
  onError,
}: {
  path: string;
  lang: Lang;
  units: {id: string; label: string}[];
  sent: Sent;
  onResent: (s: Sent) => void;
  onBack: () => void;
  onDone: (d: Done) => void;
  onError: (err: unknown) => void;
}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const [form, setForm] = useState({code: '', displayName: '', password: '', confirm: '', shareNote: ''});
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | 'finish' | 'resend'>(null);
  const [error, setError] = useState<unknown>(null);
  const [resent, setResent] = useState(false);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;
  const full = chosen.length >= MAX_CASAS;

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_CASAS ? [...c, id] : c));

  async function resend() {
    setBusy('resend');
    setError(null);
    try {
      const r = await post<{verificationId: string}>(`${path}/code`, {email: sent.email, preferredLanguage: lang});
      onResent({verificationId: r.verificationId, email: sent.email});
      setForm((f) => ({...f, code: ''}));
      setResent(true);
    } catch (err) {
      setError(err);
      onError(err);
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy('finish');
    setError(null);
    try {
      onDone(
        await post<Done>(`${path}/finish`, {
          verificationId: sent.verificationId,
          code: form.code.trim(),
          displayName: form.displayName.trim(),
          password: form.password,
          preferredLanguage: lang,
          unitIds: chosen,
          ...(form.shareNote.trim() ? {shareNote: form.shareNote.trim()} : {}),
        }),
      );
    } catch (err) {
      setError(err);
      onError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-linha bg-superficie p-5" noValidate>
      <h2 className="text-lg font-semibold">{t('cadastro.passoDados')}</h2>
      <Notice tone="info">{t('cadastro.codigoEnviado', {email: sent.email})}</Notice>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Button tone="quiet" onClick={onBack}>
          {t('cadastro.outroEmail')}
        </Button>
        <Button tone="quiet" busy={busy === 'resend'} busyLabel={t('cadastro.enviando')} onClick={() => void resend()}>
          {resent ? `${t('cadastro.reenviar')} ✓` : t('cadastro.reenviar')}
        </Button>
      </div>
      <Field
        id="cadastro-codigo"
        label={t('cadastro.codigo')}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        value={form.code}
        onChange={(e) => setForm({...form, code: e.target.value.replace(/\D/g, '')})}
      />
      <Field
        id="cadastro-nome"
        label={t('cadastro.nome')}
        hint={t('cadastro.nomeDica')}
        autoComplete="name"
        required
        minLength={2}
        maxLength={120}
        value={form.displayName}
        onChange={(e) => setForm({...form, displayName: e.target.value})}
      />
      <Field
        id="cadastro-senha"
        label={t('cadastro.senha')}
        type="password"
        autoComplete="new-password"
        hint={t('cadastro.senhaDica')}
        required
        minLength={12}
        maxLength={128}
        value={form.password}
        onChange={(e) => setForm({...form, password: e.target.value})}
      />
      <Field
        id="cadastro-confirmar"
        label={t('cadastro.confirmar')}
        type="password"
        autoComplete="new-password"
        required
        error={mismatch ? t('cadastro.naoConfere') : null}
        value={form.confirm}
        onChange={(e) => setForm({...form, confirm: e.target.value})}
      />
      <fieldset className="grid gap-2">
        <legend className="font-medium">{t('cadastro.casas')}</legend>
        <p className="text-sm text-suave">{full ? t('cadastro.casasLimite') : t('cadastro.casasDica')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {units.map((u) => {
            const checked = chosen.includes(u.id);
            return (
              <label
                key={u.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-linha px-3 has-checked:border-primaria has-checked:bg-primaria-clara"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primaria"
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => toggle(u.id)}
                />
                <span>{u.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field
        id="cadastro-observacao"
        label={t('cadastro.observacao')}
        hint={t('cadastro.observacaoDica')}
        maxLength={200}
        value={form.shareNote}
        onChange={(e) => setForm({...form, shareNote: e.target.value})}
      />
      {!!error && <Notice tone="error">{errorText(error)}</Notice>}
      <Button
        type="submit"
        busy={busy === 'finish'}
        busyLabel={t('cadastro.concluindo')}
        disabled={
          form.code.length !== 6 ||
          form.displayName.trim().length < 2 ||
          form.password.length < 12 ||
          !form.confirm ||
          mismatch ||
          chosen.length === 0 ||
          busy !== null
        }
      >
        {t('cadastro.concluir')}
      </Button>
    </form>
  );
}
