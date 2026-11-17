import {useState, type FormEvent} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQueryClient} from '@tanstack/react-query';
import {login} from '../lib/api';
import {safeNext} from '../lib/redirect';
import {Button, Field, Notice, useErrorText} from '../components/ui';
import {LanguagePicker} from '../components/LanguagePicker';
import {CenaEntrada} from '../components/CenaEntrada';

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
    // `isolate`: a cena (atrás, -z-10) fica dentro deste grupo de camadas, à frente do fundo da página
    <div className="relative isolate">
      <CenaEntrada />
      {/* em tela larga o painel vai para a direita e o condomínio fica à vista; no celular, centralizado */}
      <main className="grid min-h-dvh content-center gap-6 px-4 py-10 *:w-full *:max-w-md *:justify-self-center lg:*:mr-[6vw] lg:*:justify-self-end">
        <div className="flex justify-end">
          <div className="rounded-lg bg-superficie/90 px-2 py-1 backdrop-blur-sm">
            <LanguagePicker />
          </div>
        </div>
        {/* painel claro por cima da cena: a leitura não depende do que está atrás */}
        <div className="grid gap-5 rounded-2xl border border-linha bg-superficie/95 p-5 shadow-lg backdrop-blur-sm sm:p-6">
          <header className="grid gap-1">
            <p className="text-lg font-semibold text-primaria">{t('app.nome')}</p>
            <h1 className="text-3xl font-semibold">{t('entrar.titulo')}</h1>
            <p className="text-suave">{t('entrar.subtitulo')}</p>
          </header>
          <form onSubmit={submit} className="grid gap-4" noValidate>
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
        </div>
      </main>
    </div>
  );
}
