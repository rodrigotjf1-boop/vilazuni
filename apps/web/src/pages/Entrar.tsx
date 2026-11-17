import {useState, type FormEvent} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQueryClient} from '@tanstack/react-query';
import {login} from '../lib/api';
import {safeNext} from '../lib/redirect';
import {Button, Field, Notice, useErrorText} from '../components/ui';
import {LanguagePicker} from '../components/LanguagePicker';

export function Entrar() {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      client.clear();
      navigate(safeNext(params.get('de')), {replace: true});
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <div className="flex justify-end">
        <LanguagePicker />
      </div>
      <header className="grid gap-1">
        <p className="text-lg font-semibold text-primaria">{t('app.nome')}</p>
        <h1 className="text-3xl font-semibold">{t('entrar.titulo')}</h1>
        <p className="text-suave">{t('entrar.subtitulo')}</p>
      </header>
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-xl border border-linha bg-superficie p-5"
        noValidate
      >
        <Field
          id="email"
          label={t('entrar.email')}
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="senha"
          label={t('entrar.senha')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!!error && <Notice tone="error">{errorText(error)}</Notice>}
        <Button type="submit" busy={busy} busyLabel={t('entrar.entrando')} disabled={!email || !password}>
          {t('entrar.botao')}
        </Button>
      </form>
      <p className="text-sm text-suave">{t('entrar.convite')}</p>
    </main>
  );
}
