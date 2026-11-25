import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ActionLink, Icon, StayStatus, WorkspaceError} from '../components/Workspace';
import {Loading, Notice} from '../components/ui';
import {groupSize, stayDetail, useStays} from '../lib/stays';
import {displayStayTime} from '../lib/stay-time';
import {PlateLookup} from './Estadias';

export function Operacao() {
  const {t, i18n} = useTranslation();
  const query = useStays({scope: 'all', view: 'arrivals'});
  const [selection, setSelection] = useState('');
  const data = query.data;
  const queue = data?.stays ?? [];
  const current = queue.find((stay) => stay.id === selection) ?? queue[0];
  const when = (date: string) => data && displayStayTime(date, data.timezone, i18n.language);
  return (
    <div className="vz-flow">
      <header className="vz-section-head">
        <h1 className="vz-page-title">{t('layout.operation')}</h1>
        <ActionLink to="/estadias/calendario" icon="calendar" secondary>
          {t('layout.calendarTitle')}
        </ActionLink>
      </header>
      {query.isPending && <Loading />}
      {query.error && <WorkspaceError error={query.error} retry={() => void query.refetch()} />}
      {data && !query.error && (
        <>
          {data.more && <Notice tone="warn">{t('stay.limit')}</Notice>}
          <div className="vz-operations">
            <section className="vz-queue" aria-labelledby="queue-title">
              <h2 id="queue-title" className="vz-subtitle">
                {t('layout.arrivalsToday')}
              </h2>
              {!queue.length && <p className="vz-empty">{t('layout.noArrivals')}</p>}
              <ul className="vz-lines">
                {queue.map((stay) => (
                  <li key={stay.id}>
                    <button
                      type="button"
                      aria-pressed={stay.id === current?.id}
                      onClick={() => setSelection(stay.id)}
                    >
                      <strong>{stay.unitLabel}</strong>
                      <span>{when(stay.checkInAt)}</span>
                      <small>{stay.members[0]?.name}</small>
                      <StayStatus status={stay.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <div className="vz-details">
              {current && (
                <section className="vz-selected">
                  <header className="vz-section-head">
                    <h2 className="vz-page-title">{current.unitLabel}</h2>
                    <StayStatus status={current.status} />
                  </header>
                  <p className="vz-selected-name">{current.members[0]?.name}</p>
                  <dl className="vz-fields">
                    <div>
                      <dt>{t('stay.in')}</dt>
                      <dd>{when(current.checkInAt)}</dd>
                    </div>
                    <div>
                      <dt>{t('stay.out')}</dt>
                      <dd>{when(current.checkOutAt)}</dd>
                    </div>
                    <div>
                      <dt>{t('stay.members')}</dt>
                      <dd>{t('layout.guestCount', {count: groupSize(current)})}</dd>
                    </div>
                  </dl>
                  {!!current.plates.length && (
                    <div className="vz-selected-plate">
                      <Icon name="car" />{' '}
                      <div>
                        <span>{t('stay.plates')}</span>
                        <strong>{current.plates.join(' · ')}</strong>
                      </div>
                    </div>
                  )}
                  <ActionLink to={stayDetail(current.id)} secondary>
                    {t('layout.viewStay')}
                  </ActionLink>
                </section>
              )}
              <PlateLookup
                key={current?.id ?? 'empty'}
                timezone={data.timezone}
                initialPlate={current?.plates[0]}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
