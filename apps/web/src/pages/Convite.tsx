import {useState, type FormEvent} from 'react';
import {Link, useParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {ApiError, get, post} from '../lib/api';
import {formatDate, isLang, type Lang} from '../i18n';
import type {InvitationPreview} from '../lib/types';
import {Button, Card, ErrorState, Field, Loading, Notice, SelectField, useErrorText} from '../components/ui';
import {LanguagePicker} from '../components/LanguagePicker';

/** Aceitar convite (especificação §6): o link prova o e-mail; titularidade nasce pendente; papel nasce ativo. */
export function Convite() {
  const {token = ''} = useParams();
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const preview = useQuery({
    queryKey: ['convite', token],
    queryFn: () => get<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`),
    retry: false,
  });
  const [form, setForm] = useState({displayName: '', email: '', password: '', confirm: ''});
  const [lang, setLang] = useState<Lang>(isLang(i18n.language) ? i18n.language : 'pt-BR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<'ownership' | 'role' | null>(null);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{link: {type: 'ownership' | 'role'}}>(
        `/auth/invitations/${encodeURIComponent(token)}/accept`,
        {
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          password: form.password,
          preferredLanguage: lang,
        },
      );
      setDone(r.link.type);
    } catch (err) {
      setError(err);
      // convite que deixou de valer (usado, vencido, bloqueado): recarrega a prévia para mostrar o estado
      if (err instanceof ApiError && err.status === 410) void preview.refetch();
    } finally {
      setBusy(false);
    }
  }

  const inv = preview.data;
  return (
    <main className="mx-auto grid min-h-dvh max-w-lg content-start gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-semibold text-primaria">{t('app.nome')}</p>
        <LanguagePicker />
      </div>
      <h1 className="text-3xl font-semibold">{t('convite.titulo')}</h1>

      {preview.isPending && <Loading />}
      {preview.error instanceof ApiError && preview.error.status === 404 && (
        <Notice tone="error">{t('convite.naoEncontrado')}</Notice>
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
          <Notice tone="ok">
            {done === 'role' ? t('convite.prontoPapel') : t('convite.prontoTitularidade')}
          </Notice>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primaria px-4 font-medium text-white"
          >
            {t('convite.irEntrar')}
          </Link>
        </Card>
      )}

      {inv && !done && (
        <>
          <Card>
            <p className="text-sm text-suave">{inv.condominiumName}</p>
            <p className="text-xl font-semibold">
              {inv.purpose === 'role'
                ? t('convite.paraPapel', {papel: t(`papeis.${inv.role}`, {defaultValue: inv.role ?? ''})})
                : t('convite.paraTitularidade', {casa: inv.unitLabel})}
            </p>
            {inv.scopes.length > 0 && <p>{t('convite.escopos', {escopos: inv.scopes.join(', ')})}</p>}
            <p className="text-suave">
              {t('convite.enviadoPara', {contato: inv.contactHint})} ·{' '}
              {t('convite.validoAte', {data: formatDate(inv.expiresAt, i18n.language, true)})}
            </p>
          </Card>
          <form
            onSubmit={submit}
            className="grid gap-4 rounded-xl border border-linha bg-superficie p-5"
            noValidate
          >
            <Field
              id="nome"
              label={t('convite.nome')}
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={form.displayName}
              onChange={(e) => setForm({...form, displayName: e.target.value})}
            />
            <Field
              id="email"
              label={t('convite.email')}
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
            />
            <Field
              id="senha"
              label={t('convite.senha')}
              type="password"
              autoComplete="new-password"
              hint={t('convite.senhaDica')}
              required
              minLength={12}
              maxLength={128}
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
            />
            <Field
              id="confirmar"
              label={t('convite.confirmar')}
              type="password"
              autoComplete="new-password"
              required
              error={mismatch ? t('convite.naoConfere') : null}
              value={form.confirm}
              onChange={(e) => setForm({...form, confirm: e.target.value})}
            />
            <SelectField
              id="idioma"
              label={t('convite.idioma')}
              value={lang}
              onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
            >
              <option value="pt-BR">{t('idiomas.pt-BR')}</option>
              <option value="es">{t('idiomas.es')}</option>
              <option value="en">{t('idiomas.en')}</option>
            </SelectField>
            {!!error && <Notice tone="error">{errorText(error)}</Notice>}
            <Button
              type="submit"
              busy={busy}
              busyLabel={t('convite.aceitando')}
              disabled={
                !form.displayName.trim() ||
                !form.email.trim() ||
                form.password.length < 12 ||
                mismatch ||
                !form.confirm
              }
            >
              {t('convite.aceitar')}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
