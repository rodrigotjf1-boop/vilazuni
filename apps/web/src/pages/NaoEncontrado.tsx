import {Link} from 'react-router';
import {useTranslation} from 'react-i18next';

export function NaoEncontrado() {
  const {t} = useTranslation();
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('naoEncontrado.titulo')}</h1>
      <Link to="/" className="font-medium text-primaria underline underline-offset-4">
        {t('naoEncontrado.voltar')}
      </Link>
    </main>
  );
}
