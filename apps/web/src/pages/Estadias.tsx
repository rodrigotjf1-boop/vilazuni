import {useState, type FormEvent} from 'react';
import {useOutletContext, useSearchParams} from 'react-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Button, Card, Field, Loading, Notice, SelectField, useErrorText} from '../components/ui';
import {post, ApiError} from '../lib/api';
import type {ShellContext} from '../components/Shell';
import {ActionLink, StayStatus, WorkspaceError} from '../components/Workspace';
import {canOpen, useStays, type Band, type Member, type Stay, type StayList} from '../lib/stays';
import {displayStayTime, localStayTime, stayTimeInput} from '../lib/stay-time';

const bands: Band[] = ['adult', 'teen', 'child'];
const own = (data: StayList, stay: Stay) => data.ownUnits.some((u) => u.id === stay.unitId);
const timeError = () => new ApiError(400, 'periodo_invalido', '');

export function Estadias() {
  const {t} = useTranslation();
  const {access} = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const selected = params.get('estadia');
  const list = useStays(selected ? {id: selected} : {});
  const create = params.get('nova') === '1';
  const setCreate = (open: boolean) => setParams(open ? {nova: '1'} : {}, {replace: true});
  const canPlan = canOpen(access.data?.actions, 'stay.read.all');
  return (
    <div className="grid gap-5">
      <header className="vz-section-head">
        <h1 className="vz-page-title">{t(selected ? 'layout.stayDetail' : 'stay.title')}</h1>
        <div className="vz-inline-actions">
          {selected && (
            <ActionLink to="/estadias" secondary>
              {t('layout.allStays')}
            </ActionLink>
          )}
          {canPlan && (
            <ActionLink to="/estadias/calendario" icon="calendar" secondary>
              {t('layout.calendarTitle')}
            </ActionLink>
          )}
        </div>
      </header>
      {list.isPending && <Loading />}
      {list.error && <WorkspaceError error={list.error} retry={() => void list.refetch()} />}
      {list.data && !list.error && (
        <>
          {!selected && !!list.data.ownUnits.length && (
            <div>
              <Button tone={create ? 'secondary' : 'primary'} onClick={() => setCreate(!create)}>
                {t(create ? 'stay.close' : 'stay.new')}
              </Button>
            </div>
          )}
          {create && !!list.data.ownUnits.length && (
            <StayForm data={list.data} close={() => setCreate(false)} />
          )}
          {!selected && !canPlan && <PlateLookup timezone={list.data.timezone} />}
          {!list.data.stays.length && <Notice>{t(selected ? 'layout.noStay' : 'stay.empty')}</Notice>}
          {list.data.stays.map((stay) => (
            <StayCard key={stay.id} stay={stay} data={list.data!} expanded={!!selected} />
          ))}
          {list.data.more && <Notice>{t('stay.limit')}</Notice>}
        </>
      )}
    </div>
  );
}

function readPeriod(form: HTMLFormElement, timezone: string) {
  const data = new FormData(form);
  try {
    return {
      checkInAt: localStayTime(String(data.get('in')), timezone),
      checkOutAt: localStayTime(String(data.get('out')), timezone),
    };
  } catch {
    throw timeError();
  }
}

function PeriodFields({timezone, stay}: {timezone: string; stay?: Stay}) {
  const {t} = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label={t('stay.in')}
        name="in"
        type="datetime-local"
        required
        defaultValue={stay && stayTimeInput(stay.checkInAt, timezone)}
      />
      <Field
        label={t('stay.out')}
        name="out"
        type="datetime-local"
        required
        defaultValue={stay && stayTimeInput(stay.checkOutAt, timezone)}
      />
      <p className="text-sm text-suave sm:col-span-2">{t('stay.timezone', {timezone})}</p>
    </div>
  );
}

function StayForm({data, close}: {data: StayList; close: () => void}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [requestId] = useState(() => crypto.randomUUID());
  const [single, setSingle] = useState(false);
  const [people, setPeople] = useState<Array<{id: number; band: Band}>>([]);
  const [next, setNext] = useState(1);
  const counts = {adult: single ? 1 : 2, teen: 0, child: 0};
  for (const person of people) counts[person.band] += 1;
  const create = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const fields = new FormData(form);
      const named = (key: string) => String(fields.get(key) ?? '').trim();
      const members: Member[] = [{name: named('primary'), band: 'adult', contact: named('contact')}];
      if (!single) members.push({name: named('backup'), band: 'adult', contact: named('backupContact')});
      for (const person of people) members.push({name: named(`person-${person.id}`), band: person.band});
      return post('/stays', {
        requestId,
        unitId: named('unitId'),
        ...readPeriod(form, data.timezone),
        members,
        plates: named('plates')
          .split(/[\s,;]+/)
          .filter(Boolean),
        ...(single ? {exceptionReason: named('exception')} : {}),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({queryKey: ['stays']});
      close();
    },
  });
  return (
    <Card>
      <h2 className="text-xl font-semibold">{t('stay.new')}</h2>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(event.currentTarget);
        }}
      >
        <SelectField label={t('stay.unit')} name="unitId" required>
          {data.ownUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </SelectField>
        <PeriodFields timezone={data.timezone} />
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-semibold">{t('stay.responsible')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('stay.primary')} name="primary" minLength={2} maxLength={120} required />
            <Field label={t('stay.contact')} name="contact" minLength={5} maxLength={160} required />
            {!single && (
              <>
                <Field label={t('stay.backup')} name="backup" minLength={2} maxLength={120} required />
                <Field
                  label={t('stay.backupContact')}
                  name="backupContact"
                  minLength={5}
                  maxLength={160}
                  required
                />
              </>
            )}
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={single} onChange={(event) => setSingle(event.target.checked)} />
            {t('stay.single')}
          </label>
          {single && (
            <Field label={t('stay.exception')} name="exception" minLength={3} maxLength={500} required />
          )}
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-semibold">{t('stay.members')}</legend>
          <GroupCounts counts={counts} />
          {people.map((person) => (
            <div key={person.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Field
                label={t('stay.name')}
                name={`person-${person.id}`}
                minLength={2}
                maxLength={120}
                required
              />
              <SelectField
                label={t('stay.band')}
                value={person.band}
                onChange={(event) => {
                  const band = event.target.value as Band;
                  setPeople(people.map((row) => (row.id === person.id ? {...row, band} : row)));
                }}
              >
                {bands.map((band) => (
                  <option key={band} value={band}>
                    {t(`stay.${band}`)}
                  </option>
                ))}
              </SelectField>
              <Button
                tone="secondary"
                onClick={() => setPeople(people.filter((row) => row.id !== person.id))}
              >
                {t('stay.remove')}
              </Button>
            </div>
          ))}
          <div>
            <Button
              tone="secondary"
              disabled={people.length >= 28}
              onClick={() => {
                setPeople([...people, {id: next, band: 'adult'}]);
                setNext(next + 1);
              }}
            >
              {t('stay.add')}
            </Button>
          </div>
        </fieldset>
        <Field label={t('stay.plates')} hint={t('stay.platesHint')} name="plates" maxLength={110} />
        {create.error && <Notice tone="error">{errorText(create.error)}</Notice>}
        <div>
          <Button type="submit" busy={create.isPending}>
            {t('stay.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function GroupCounts({counts}: {counts: Record<Band, number>}) {
  const {t} = useTranslation();
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {bands.map((band) => (
        <div key={band} className="flex gap-1">
          <dt>{t(`stay.${band}`)}</dt>
          <dd className="font-semibold">{counts[band]}</dd>
        </div>
      ))}
    </dl>
  );
}

function StayCard({stay, data, expanded}: {stay: Stay; data: StayList; expanded: boolean}) {
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [mode, setMode] = useState<'edit' | 'reject' | 'cancel' | null>(null);
  const [guestLink, setGuestLink] = useState('');
  const update = useMutation({
    mutationFn: async (input: {route: string; body?: Record<string, unknown>; form?: HTMLFormElement}) => {
      const body = input.form ? readPeriod(input.form, data.timezone) : input.body;
      return post<{token?: string}>(`/stays/${stay.id}/${input.route}`, {version: stay.version, ...body});
    },
    onSuccess: async (result) => {
      setMode(null);
      setGuestLink(result.token ? new URL(`/minha-estadia#${result.token}`, location.origin).href : '');
      await client.invalidateQueries({queryKey: ['stays']});
    },
  });
  const updateAllowed = own(data, stay) || data.manage;
  const open = stay.status === 'pending' || stay.status === 'confirmed';
  const when = (date: string) => displayStayTime(date, data.timezone, i18n.language);
  function decision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim();
    if (mode === 'reject' || mode === 'cancel')
      update.mutate({route: 'decision', body: {action: mode, ...(note ? {note} : {})}});
  }
  return (
    <Card>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{stay.unitLabel}</h2>
        <StayStatus status={stay.status} />
      </header>
      <p className="text-suave">
        {when(stay.checkInAt)} – {when(stay.checkOutAt)}
      </p>
      <GroupCounts counts={stay.counts} />
      <details open={expanded || undefined}>
        <summary className="cursor-pointer font-medium">{t('stay.details')}</summary>
        <ul className="mt-2 grid gap-1 break-words">
          {stay.members.map((member, index) => (
            <li key={index}>
              {member.name}
              {member.contact && ` · ${member.contact}`}
            </li>
          ))}
        </ul>
        {!!stay.plates.length && (
          <p className="mt-2 text-sm">
            {t('stay.plates')} · {stay.plates.join(', ')}
          </p>
        )}
        {stay.exceptionReason && (
          <p className="mt-2 text-sm">
            {t('stay.exception')} · {stay.exceptionReason}
          </p>
        )}
      </details>
      {stay.decisionNote && <p className="break-words text-suave">{stay.decisionNote}</p>}
      {updateAllowed && open && (
        <div className="flex flex-wrap gap-2">
          {stay.status === 'pending' && data.manage && (
            <>
              <Button
                busy={update.isPending}
                onClick={() => update.mutate({route: 'decision', body: {action: 'confirm'}})}
              >
                {t('stay.confirm')}
              </Button>
              <Button tone="secondary" onClick={() => setMode('reject')}>
                {t('stay.reject')}
              </Button>
            </>
          )}
          <Button tone="secondary" onClick={() => setMode('edit')}>
            {t('stay.edit')}
          </Button>
          <Button tone="danger" onClick={() => setMode('cancel')}>
            {t('stay.cancel')}
          </Button>
          {stay.status === 'confirmed' && (
            <Button
              tone="secondary"
              busy={update.isPending}
              onClick={() => update.mutate({route: 'guest-link'})}
            >
              {t(stay.hasGuestLink ? 'stay.replaceLink' : 'stay.makeLink')}
            </Button>
          )}
        </div>
      )}
      {guestLink && stay.status === 'confirmed' && stay.hasGuestLink && (
        <div className="grid gap-2">
          <Field
            label={t('stay.link')}
            value={guestLink}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="text-sm text-suave">{t('stay.linkHint')}</p>
        </div>
      )}
      {mode === 'edit' && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({route: 'period', form: event.currentTarget});
          }}
        >
          <Notice>{t('stay.editHint')}</Notice>
          <PeriodFields timezone={data.timezone} stay={stay} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={update.isPending}>
              {t('stay.save')}
            </Button>
            <Button tone="secondary" onClick={() => setMode(null)}>
              {t('stay.close')}
            </Button>
          </div>
        </form>
      )}
      {(mode === 'reject' || mode === 'cancel') && (
        <form className="grid gap-3" onSubmit={decision}>
          <Field
            label={t('stay.reason')}
            name="note"
            minLength={3}
            maxLength={500}
            required={mode === 'reject'}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" tone="danger" busy={update.isPending}>
              {t(mode === 'reject' ? 'stay.reject' : 'stay.cancel')}
            </Button>
            <Button tone="secondary" onClick={() => setMode(null)}>
              {t('stay.close')}
            </Button>
          </div>
        </form>
      )}
      {update.error && <Notice tone="error">{errorText(update.error)}</Notice>}
    </Card>
  );
}

export function PlateLookup({timezone, initialPlate = ''}: {timezone: string; initialPlate?: string}) {
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const [plate, setPlate] = useState(initialPlate);
  const lookup = useMutation({
    mutationFn: () =>
      post<{status: 'matched' | 'review' | 'none'; unitLabel?: string; checkOutAt?: string}>('/stays/plate', {
        plate,
      }),
  });
  const result = lookup.data;
  return (
    <Card>
      <h2 className="font-semibold">{t('stay.lookup')}</h2>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          lookup.mutate();
        }}
      >
        <Field
          label={t('stay.plate')}
          value={plate}
          maxLength={12}
          required
          onChange={(event) => {
            setPlate(event.target.value);
            lookup.reset();
          }}
        />
        <Button type="submit" tone="secondary" busy={lookup.isPending}>
          {t('stay.search')}
        </Button>
      </form>
      {lookup.error && <Notice tone="error">{errorText(lookup.error)}</Notice>}
      {result && (
        <Notice tone={result.status === 'matched' ? 'ok' : 'info'}>
          {t(`stay.plate_${result.status}`, {
            unit: result.unitLabel,
            end: result.checkOutAt && displayStayTime(result.checkOutAt, timezone, i18n.language),
          })}
        </Notice>
      )}
    </Card>
  );
}
