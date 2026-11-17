import {useEffect, useState, type ReactNode} from 'react';
import {NavLink, Navigate, Outlet, useLocation} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ApiError, getCondominium, setCondominium} from '../lib/api';
import {useAccess, useLogout, useMe} from '../lib/session';
import {formatDate} from '../i18n';
import {Button, ErrorState, Loading, Notice} from './ui';
import {LanguagePicker} from './LanguagePicker';

/**
 * Moldura de toda tela com sessão: confere quem entrou, escolhe o condomínio (quem tem mais de um), mostra o aviso de
 * demonstração e o de fim de mandato. Sem sessão, manda para "Entrar" com o caminho de volta.
 */
export function Shell() {
  const {t, i18n} = useTranslation();
  const location = useLocation();
  const me = useMe();
  const logout = useLogout();
  const [saindo, setSaindo] = useState(false);
  const condominiums = me.data?.condominiums ?? [];
  const stored = getCondominium();
  const storedValid = !!stored && condominiums.some((c) => c.id === stored);
  const active = condominiums.length === 1 ? condominiums[0] : condominiums.find((c) => c.id === stored);
  const access = useAccess(!!active);

  useEffect(() => {
    // condomínio guardado nesta aba que não é desta conta (outra pessoa entrou na mesma aba): esquece
    if (me.data && stored && !storedValid) setCondominium(null);
  }, [me.data, stored, storedValid]);

  if (me.isPending)
    return (
      <Frame>
        <Loading />
      </Frame>
    );
  if (me.error instanceof ApiError && me.error.status === 401) {
    const next = location.pathname + location.search;
    return <Navigate to={`/entrar?de=${encodeURIComponent(next)}`} replace />;
  }
  if (me.error)
    return (
      <Frame>
        <ErrorState error={me.error} retry={() => void me.refetch()} />
      </Frame>
    );

  const needsChoice = condominiums.length > 1 && !storedValid && location.pathname !== '/escolher-condominio';
  if (needsChoice)
    return <Navigate to={`/escolher-condominio?de=${encodeURIComponent(location.pathname)}`} replace />;

  const mandate = access.data?.mandate;
  // Gestão aparece para quem pode agir (já ou depois do código de verificação). Esconder não é barreira: cada rota
  // da API decide de novo.
  const can = (action: string) => {
    const outcome = access.data?.actions[action];
    return !!outcome && outcome !== 'negado';
  };
  const links = [
    {to: '/minha-casa', label: t('nav.minhaCasa')},
    ...(can('ownership.validate') ? [{to: '/gestao/titularidades', label: t('nav.titularidades')}] : []),
    ...(can('person.read.all') ? [{to: '/gestao/pessoas', label: t('nav.pessoas')}] : []),
    ...(can('audit.read') ? [{to: '/gestao/auditoria', label: t('nav.auditoria')}] : []),
    {to: '/verificacao', label: t('nav.verificacao')},
    {to: '/conta/sessoes', label: t('nav.sessoes')},
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-linha bg-superficie">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="grid">
            <span className="text-lg font-semibold text-primaria">{t('app.nome')}</span>
            {active && <span className="text-sm text-suave">{active.name}</span>}
          </div>
          <nav aria-label={t('nav.principal')} className="order-3 w-full sm:order-none sm:w-auto">
            {/* quebra a linha no celular: nada escondido atrás de rolagem lateral */}
            <ul className="flex flex-wrap gap-1">
              {links.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className={({isActive}) =>
                      `flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 ${isActive ? 'bg-primaria-clara font-medium text-primaria' : 'text-texto hover:bg-fundo'}`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguagePicker compact />
            <Button
              tone="secondary"
              busy={saindo}
              busyLabel={t('app.saindo')}
              onClick={async () => {
                setSaindo(true);
                await logout();
              }}
            >
              {t('app.sair')}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:py-8">
        {active?.environment === 'demo' && <Notice tone="warn">{t('app.demonstracao')}</Notice>}
        {mandate?.warning && (
          <Notice tone="warn">
            {t('mandato.aviso', {dias: mandate.daysLeft, data: formatDate(mandate.endsAt, i18n.language)})}
          </Notice>
        )}
        <Outlet />
      </main>
    </div>
  );
}

function Frame({children}: {children: ReactNode}) {
  return <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10">{children}</main>;
}
