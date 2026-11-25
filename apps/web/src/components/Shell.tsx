import {useEffect, useState, type ReactNode} from 'react';
import {Link, NavLink, Navigate, Outlet, useLocation} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ApiError, getCondominium, setCondominium} from '../lib/api';
import {useAccess, useLogout, useMe} from '../lib/session';
import {canOpen} from '../lib/stays';
import type {Me} from '../lib/types';
import {formatDate} from '../i18n';
import {ErrorState, Loading, Notice} from './ui';
import {Icon, Wordmark, type WorkspaceIcon} from './Workspace';

export type ShellContext = {
  active: Me['condominiums'][number] | undefined;
  access: ReturnType<typeof useAccess>;
  name: string;
  hasChoices: boolean;
  signingOut: boolean;
  logout: () => Promise<void>;
};

export function Shell() {
  const {t, i18n} = useTranslation();
  const location = useLocation();
  const me = useMe();
  const signOut = useLogout();
  const [signingOut, setSigningOut] = useState(false);
  const [, revision] = useState(0);
  const condominiums = me.data?.condominiums ?? [];
  const stored = getCondominium();
  const storedValid = !!stored && condominiums.some((condo) => condo.id === stored);
  const active =
    condominiums.length === 1 ? condominiums[0] : condominiums.find((condo) => condo.id === stored);
  const access = useAccess(!!active && (!stored || storedValid));

  useEffect(() => {
    if (me.data && stored && !storedValid) {
      setCondominium(null);
      revision((current) => current + 1);
    }
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

  const hasChoices = condominiums.length > 1;
  if (hasChoices && !storedValid && location.pathname !== '/escolher-condominio')
    return (
      <Navigate
        to={`/escolher-condominio?de=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );

  const mandate = access.data?.mandate;
  const actions = access.data?.actions;
  const own = canOpen(actions, 'stay.read.own');
  const team = canOpen(actions, 'stay.read.all');
  const home = team && !own ? '/operacao' : '/';
  const name = me.data?.person.displayName ?? '';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase();
  const entries: {to: string; icon: WorkspaceIcon; label: string}[] = [
    {to: home, icon: 'home', label: t('layout.home')},
    {to: '/minha-casa', icon: 'house', label: t('nav.minhaCasa')},
    ...(own || team ? [{to: '/estadias', icon: 'calendar' as const, label: t('stay.title')}] : []),
    ...(canOpen(actions, 'condominium.read')
      ? [{to: '/mural', icon: 'list' as const, label: t('bulletin.nav')}]
      : []),
    {to: '/mais', icon: 'account', label: t('layout.account')},
  ];
  const context: ShellContext = {
    active,
    access,
    name,
    hasChoices,
    signingOut,
    logout: async () => {
      setSigningOut(true);
      try {
        await signOut();
      } finally {
        setSigningOut(false);
      }
    },
  };
  const navigation = (className: string) => (
    <nav aria-label={t('nav.principal')} className={className}>
      {entries.map(({to, icon, label}) => (
        <NavLink key={to} to={to} end={to !== '/estadias'}>
          <Icon name={icon} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="vz-shell">
      <a className="vz-skip" href="#conteudo">
        {t('layout.skip')}
      </a>
      <header className="vz-topbar">
        <div className="vz-top-inner">
          <Link to={home} className="vz-brand-link">
            <Wordmark caption={active?.name} />
          </Link>
          {navigation('vz-top-nav')}
          <Link to="/mais" className="vz-profile" aria-label={t('layout.profile')}>
            {initials || <Icon name="account" />}
          </Link>
        </div>
      </header>
      <main id="conteudo" className="vz-main">
        {active?.environment === 'demo' && <Notice tone="warn">{t('app.demonstracao')}</Notice>}
        {mandate?.warning && (
          <Notice tone="warn">
            {t('mandato.aviso', {dias: mandate.daysLeft, data: formatDate(mandate.endsAt, i18n.language)})}
          </Notice>
        )}
        <Outlet context={context} />
      </main>
      {navigation('vz-bottom-nav')}
    </div>
  );
}

function Frame({children}: {children: ReactNode}) {
  return <main className="vz-main">{children}</main>;
}
