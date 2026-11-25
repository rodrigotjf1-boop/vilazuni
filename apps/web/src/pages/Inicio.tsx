import {Link, Navigate, useOutletContext} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ActionLink, Icon, StayStatus, WorkspaceError} from '../components/Workspace';
import {Loading} from '../components/ui';
import type {ShellContext} from '../components/Shell';
import {canOpen, groupSize, stayDetail, useStays} from '../lib/stays';
import {displayStayTime} from '../lib/stay-time';
import {MinhaCasa} from './MinhaCasa';

export function Inicio() {
  const {active, access} = useOutletContext<ShellContext>();
  if (active && access.isPending) return <Loading />;
  if (access.error) return <WorkspaceError error={access.error} retry={() => void access.refetch()} />;
  const actions = access.data?.actions;
  if (canOpen(actions, 'stay.read.own')) return <Portal />;
  if (canOpen(actions, 'stay.read.all')) return <Navigate to="/operacao" replace />;
  return <MinhaCasa />;
}

function Portal() {
  const {t, i18n} = useTranslation();
  const {active, name} = useOutletContext<ShellContext>();
  const query = useStays({scope: 'own', view: 'upcoming'});
  const data = query.data;
  const upcoming = data?.stays ?? [];
  const next = upcoming.find((stay) => stay.status === 'confirmed');
  const when = (value: string) => data && displayStayTime(value, data.timezone, i18n.language);

  return (
    <div className="vz-flow">
      <section className="vz-portal-top">
        <header className="vz-hero">
          <p className="vz-kicker">
            <Icon name="home" />
            {active?.name ?? t('nav.minhaCasa')}
          </p>
          <h1>{t('layout.homeTitle')}</h1>
          <p>{t('layout.hello', {name})}</p>
          <ActionLink to="/minha-casa" icon="house" secondary>
            {t('nav.minhaCasa')}
          </ActionLink>
        </header>
        <section className="vz-spotlight">
          <Icon name="calendar" />
          <h2>{t('layout.nextStay')}</h2>
          {query.isPending && <Loading />}
          {!query.error &&
            data &&
            (next ? (
              <>
                <strong className="vz-display-value">{next.unitLabel}</strong>
                <p>{when(next.checkInAt)}</p>
                <p className="vz-subtle">{t('layout.guestCount', {count: groupSize(next)})}</p>
                <ActionLink to={stayDetail(next.id)} secondary>
                  {t('layout.viewStay')}
                </ActionLink>
              </>
            ) : (
              <p>{t('layout.noConfirmed')}</p>
            ))}
          {query.error && <WorkspaceError error={query.error} retry={() => void query.refetch()} />}
        </section>
      </section>
      {data && !query.error && (
        <section className="vz-portal-bottom" aria-labelledby="upcoming">
          <div className="vz-section-head">
            <h2 id="upcoming">{t('layout.upcoming')}</h2>
            <ActionLink to="/estadias" icon="list" secondary>
              {t('layout.allStays')}
            </ActionLink>
          </div>
          {upcoming.length ? (
            <ul className="vz-lines">
              {upcoming.slice(0, 4).map((stay) => (
                <li key={stay.id}>
                  <Link className="vz-list-row" to={stayDetail(stay.id)}>
                    <div>
                      <strong>{stay.unitLabel}</strong>
                      <p className="vz-subtle">{when(stay.checkInAt)}</p>
                    </div>
                    <StayStatus status={stay.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vz-empty">{t('layout.noUpcoming')}</p>
          )}
          {!!data.ownUnits.length && (
            <ActionLink to="/estadias?nova=1" icon="plus">
              {t('stay.new')}
            </ActionLink>
          )}
        </section>
      )}
    </div>
  );
}
