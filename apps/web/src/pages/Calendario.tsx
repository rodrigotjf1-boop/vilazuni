import {useState} from 'react';
import {Link} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ActionLink, Icon, StayStatus, WorkspaceError} from '../components/Workspace';
import {Loading, Notice} from '../components/ui';
import {addDays, asCivilDate, dayOf, occupancyRows, stayEvents, weekStart} from '../lib/agenda';
import {stayDetail, useStays} from '../lib/stays';
import {localStayTime} from '../lib/stay-time';

export function Calendario() {
  const {t} = useTranslation();
  const base = useStays({scope: 'all', view: 'context'});
  return (
    <div className="vz-flow">
      <header className="vz-section-head">
        <h1 className="vz-page-title">{t('layout.calendarTitle')}</h1>
        <ActionLink to="/estadias" icon="list" secondary>
          {t('layout.allStays')}
        </ActionLink>
      </header>
      {base.isPending && <Loading />}
      {base.error && <WorkspaceError error={base.error} retry={() => void base.refetch()} />}
      {base.data && !base.error && (
        <CalendarWeek today={dayOf(base.data.serverNow, base.data.timezone)} timezone={base.data.timezone} />
      )}
    </div>
  );
}

function CalendarWeek({today, timezone}: {today: string; timezone: string}) {
  const {t, i18n} = useTranslation();
  const [chosen, choose] = useState<string>();
  const selected = chosen ?? today;
  const start = weekStart(selected);
  const end = addDays(start, 7);
  const days = Array.from({length: 7}, (_, i) => addDays(start, i));
  const records = useStays({
    scope: 'all',
    from: localStayTime(`${start}T00:00`, timezone),
    to: localStayTime(`${end}T00:00`, timezone),
  });
  const civil = new Intl.DateTimeFormat(i18n.language, {day: 'numeric', month: 'short', timeZone: 'UTC'});
  const shortDay = new Intl.DateTimeFormat(i18n.language, {weekday: 'short', timeZone: 'UTC'});
  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
  const data = records.data;
  const events = stayEvents(data?.stays ?? [], selected, timezone);
  const includes = (date: string) => civil.format(asCivilDate(date));
  return (
    <>
      <div className="vz-calendar-toolbar">
        <div className="vz-week-controls">
          <button
            type="button"
            onClick={() => choose(addDays(selected, -7))}
            aria-label={t('layout.previousWeek')}
          >
            <Icon name="previous" />
          </button>
          <button type="button" onClick={() => choose(today)}>
            {t('layout.today')}
          </button>
          <button
            type="button"
            onClick={() => choose(addDays(selected, 7))}
            aria-label={t('layout.nextWeek')}
          >
            <Icon name="next" />
          </button>
        </div>
        <p className="vz-subtle">
          {includes(start)} – {includes(days[6]!)}
        </p>
        {!!data?.ownUnits.length && (
          <ActionLink to="/estadias?nova=1" icon="plus">
            {t('stay.new')}
          </ActionLink>
        )}
      </div>
      <div className="vz-day-selector" aria-label={t('layout.chooseDay')}>
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => choose(day)}
            aria-label={includes(day)}
            aria-pressed={day === selected}
          >
            <span>{shortDay.format(asCivilDate(day))}</span>
            <strong>{Number(day.slice(-2))}</strong>
          </button>
        ))}
      </div>
      {records.isPending && <Loading />}
      {records.error && <WorkspaceError error={records.error} retry={() => void records.refetch()} />}
      {data && !records.error && (
        <>
          {data.more && <Notice tone="warn">{t('layout.calendarLimited')}</Notice>}
          <div className="vz-planning">
            <section className="vz-occupancy" aria-label={t('layout.occupancy')}>
              <div className="vz-grid-head">
                <strong>{t('layout.units')}</strong>
                {days.map((day) => (
                  <button type="button" key={day} aria-pressed={day === selected} onClick={() => choose(day)}>
                    <span>{shortDay.format(asCivilDate(day))}</span>
                    <b>{Number(day.slice(-2))}</b>
                  </button>
                ))}
              </div>
              {data.visibleUnits.map((unit) => {
                const rows = occupancyRows(
                  data.stays.filter((stay) => stay.unitId === unit.id),
                  days,
                  timezone,
                );
                return (
                  <div className="vz-grid-row" key={unit.id}>
                    <strong className="vz-unit-label">{unit.label}</strong>
                    <div
                      className="vz-grid-stays"
                      style={{gridTemplateRows: `repeat(${rows.rowCount}, minmax(44px, auto))`}}
                    >
                      {days.map((day, i) => (
                        <span
                          aria-hidden="true"
                          className="vz-grid-cell"
                          key={day}
                          data-selected={day === selected}
                          style={{gridColumn: i + 1, gridRow: `1 / ${rows.rowCount + 1}`}}
                        />
                      ))}
                      {rows.segments.map(({stay, start, end, row}) => (
                        <Link
                          key={stay.id}
                          to={stayDetail(stay.id)}
                          className={`vz-slot vz-slot-${stay.status}`}
                          style={{gridColumn: `${start + 1} / ${end + 1}`, gridRow: row + 1}}
                          aria-label={`${unit.label} · ${stay.members[0]?.name ?? t('stay.title')} · ${t(`stay.${stay.status}`)}`}
                        >
                          <strong>{stay.members[0]?.name ?? t('stay.title')}</strong>
                          <small>{t(`stay.${stay.status}`)}</small>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!data.visibleUnits.length && <p className="vz-empty">{t('layout.noUnits')}</p>}
            </section>
            <section className="vz-daily" aria-labelledby="day-title">
              <h2 id="day-title" className="vz-subtitle">
                {includes(selected)}
              </h2>
              <p className="vz-subtle">{t('layout.dayEvents')}</p>
              {events.length ? (
                <ul className="vz-lines">
                  {events.map(({stay, kind, time}) => (
                    <li key={`${stay.id}-${kind}`}>
                      <Link to={stayDetail(stay.id)} className="vz-event">
                        <time dateTime={time}>{clock.format(new Date(time))}</time>
                        <div>
                          <strong>
                            {t(`stay.${kind}`)} · {stay.unitLabel}
                          </strong>
                          <p className="vz-subtle">{stay.members[0]?.name}</p>
                          <StayStatus status={stay.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vz-empty">{t('layout.noDayEvents')}</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
