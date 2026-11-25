import {useState, type FormEvent, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {get, post} from '../../lib/api';
import {formatDate} from '../../i18n';
import type {PersonRow, RoleRow} from '../../lib/types';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageTitle,
  Pill,
  SelectField,
  useErrorText,
} from '../../components/ui';
import {MfaPrompt, needsMfa, useMfaRetry} from '../../components/MfaPrompt';
import {InviteLink, type CreatedInvite} from './InviteOwner';

const ROLES = [
  'syndic',
  'subsyndic',
  'fiscal_council',
  'administrator',
  'service_provider',
  'security_reviewer',
];
const INVITABLE = ROLES.filter((r) => r !== 'syndic');
const SCOPES = ['cadastro', 'financeiro', 'assembleias'];
/** O que se delega (nunca papel, mandato ou delegação — ADR-0010). */
const DELEGABLE = [
  'unit.read.all',
  'unit.manage',
  'ownership.request',
  'ownership.validate',
  'invitation.create',
  'person.read.all',
  'audit.read',
  'stay.read.all',
];
type Guard = (error: unknown, again: () => void) => boolean;
const actionKey = (a: string) =>
  a === 'stay.read.all'
    ? 'stay.grantRead'
    : a === 'stay.manage'
      ? 'stay.grantManage'
      : `gestao.acoes.${a.replace(/\./g, '_')}`;
/** Síndico sem mandato vigente não tem poder de gestão (a API decide; aqui só se avisa). */
const hasCurrentMandate = (r: RoleRow) => {
  const now = Date.now();
  return r.mandates.some(
    (m) => m.status === 'active' && Date.parse(m.startsAt) <= now && now < Date.parse(m.endsAt),
  );
};

/** Gestão › Pessoas e papéis (atos críticos pedem o código recente; a API decide). */
export function Pessoas() {
  const {t} = useTranslation();
  const people = useQuery({queryKey: ['people'], queryFn: () => get<{people: PersonRow[]}>('/people')});
  const roles = useQuery({queryKey: ['roles'], queryFn: () => get<{roles: RoleRow[]}>('/roles')});
  const {guard, prompt} = useMfaRetry();
  const error = people.error ?? roles.error;
  const refetch = () => {
    void people.refetch();
    void roles.refetch();
  };

  return (
    <div className="grid gap-6">
      <PageTitle lead={t('gestao.pessoas.explica')}>{t('gestao.pessoas.titulo')}</PageTitle>
      {prompt}
      {(people.isPending || roles.isPending) && !error && <Loading />}
      {error &&
        (needsMfa(error) ? <MfaPrompt onDone={refetch} /> : <ErrorState error={error} retry={refetch} />)}
      {people.data && roles.data && (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <GrantRole people={people.data.people} guard={guard} />
            <InviteRole guard={guard} />
          </div>
          <section className="grid gap-3" aria-labelledby="titulo-papeis">
            <h2 id="titulo-papeis" className="text-xl font-semibold">
              {t('gestao.pessoas.papeis')}
            </h2>
            {roles.data.roles.length === 0 ? (
              <Notice tone="info">{t('gestao.pessoas.nenhumPapel')}</Notice>
            ) : (
              <ul className="grid gap-3">
                {roles.data.roles.map((r) => (
                  <li key={r.id}>
                    <RoleCard role={r} guard={guard} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="grid gap-3" aria-labelledby="titulo-pessoas">
            <h2 id="titulo-pessoas" className="text-xl font-semibold">
              {t('gestao.pessoas.pessoas')}
            </h2>
            {people.data.people.length === 0 ? (
              <Notice tone="info">{t('gestao.pessoas.vazio')}</Notice>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {people.data.people.map((p) => (
                  <li key={p.id} className="min-w-0">
                    <PersonCard person={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PersonCard({person: p}: {person: PersonRow}) {
  const {t} = useTranslation();
  return (
    <Card className="h-full">
      <h3 className="font-semibold">{p.displayName}</h3>
      <p className="break-all text-sm text-suave">{p.email ?? t('gestao.pessoas.semEmail')}</p>
      {p.ownerships.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.ownerships.map((o) => (
            <Pill key={o.id} tone={o.status === 'validated' ? 'ok' : 'wait'}>
              {o.unitLabel}
              {o.status === 'pending' ? ` · ${t('gestao.pessoas.pendente')}` : ''}
            </Pill>
          ))}
        </div>
      )}
      {p.roles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.roles.map((r) => (
            <Pill key={r.id} tone="neutral">
              {t(`papeis.${r.role}`)}
            </Pill>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Formulário de uma ação de papel: envia, pede o código se for preciso e avisa o resultado. */
function useAction(guard: Guard, success: string, keys: string[][] = [['roles'], ['people']]) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(send: () => Promise<unknown>, after?: (result: unknown) => void) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await send();
      setDone(success);
      after?.(result);
      for (const key of keys) await client.invalidateQueries({queryKey: key});
    } catch (err) {
      if (!guard(err, () => void run(send, after))) setError(err);
    } finally {
      setBusy(false);
    }
  }
  return {busy, error, done, run};
}

function Feedback({error, done}: {error: unknown; done: string | null}) {
  const errorText = useErrorText();
  return (
    <>
      {!!error && <Notice tone="error">{errorText(error)}</Notice>}
      {done && <Notice tone="ok">{done}</Notice>}
    </>
  );
}

function Period({startsAt, endsAt}: {startsAt: string | null; endsAt: string | null}) {
  const {t, i18n} = useTranslation();
  const inicio = formatDate(startsAt, i18n.language);
  return (
    <>
      {endsAt
        ? t('gestao.pessoas.periodo', {inicio, fim: formatDate(endsAt, i18n.language)})
        : t('gestao.pessoas.desde', {inicio})}
    </>
  );
}

function RoleCard({role: r, guard}: {role: RoleRow; guard: Guard}) {
  const {t} = useTranslation();
  const [mode, setMode] = useState<null | 'end' | 'mandate' | 'delegate'>(null);
  // salvo: o formulário fecha (nada fica preenchido para um segundo envio) e o aviso fica no cartão
  const [notice, setNotice] = useState<string | null>(null);
  const saved = (message: string) => {
    setMode(null);
    setNotice(message);
  };
  const close = () => setMode(null);
  const active = r.status === 'active';
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="text-lg font-semibold">
            {t(`papeis.${r.role}`)} · {r.person.displayName}
          </h3>
          <p className="text-sm text-suave">
            <Period startsAt={r.startsAt} endsAt={r.endsAt} />
          </p>
          {r.scopes.length > 0 && (
            <p>
              {t('gestao.pessoas.escopos', {
                escopos: r.scopes.map((s) => t(`gestao.escopos.${s}`)).join(', '),
              })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone={active ? 'ok' : 'neutral'}>
            {active ? t('gestao.pessoas.ativo') : t('gestao.pessoas.encerrado')}
          </Pill>
          {active && r.role === 'syndic' && !hasCurrentMandate(r) && (
            <Pill tone="wait">{t('gestao.pessoas.semMandato')}</Pill>
          )}
        </div>
      </div>
      {r.mandates.length > 0 && (
        <SubList title={t('gestao.pessoas.mandatos')}>
          {r.mandates.map((m) => (
            <li key={m.id} className="text-sm">
              <Period startsAt={m.startsAt} endsAt={m.endsAt} /> · {m.minutesReference}
              {m.status === 'ended' && ` · ${t('gestao.pessoas.encerrado')}`}
            </li>
          ))}
        </SubList>
      )}
      {r.delegations.length > 0 && (
        <SubList title={t('gestao.pessoas.delegacoes')}>
          {r.delegations.map((d) => (
            <DelegationItem key={d.id} delegation={d} guard={guard} />
          ))}
        </SubList>
      )}
      {active && !mode && (
        <div className="flex flex-wrap gap-2">
          {r.role === 'syndic' ? (
            <Button tone="secondary" onClick={() => setMode('mandate')}>
              {t('gestao.pessoas.registrarMandato')}
            </Button>
          ) : (
            <Button tone="secondary" onClick={() => setMode('delegate')}>
              {t('gestao.pessoas.delegar')}
            </Button>
          )}
          <Button tone="danger" onClick={() => setMode('end')}>
            {t('gestao.pessoas.encerrar')}
          </Button>
        </div>
      )}
      {notice && !mode && <Notice tone="ok">{notice}</Notice>}
      {mode === 'end' && <EndRole role={r} guard={guard} onClose={close} onSaved={saved} />}
      {mode === 'mandate' && <AddMandate role={r} guard={guard} onClose={close} onSaved={saved} />}
      {mode === 'delegate' && <Delegate role={r} guard={guard} onClose={close} onSaved={saved} />}
    </Card>
  );
}

function SubList({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium text-suave">{title}</p>
      <ul className="grid gap-2">{children}</ul>
    </div>
  );
}

function DelegationItem({delegation: d, guard}: {delegation: RoleRow['delegations'][number]; guard: Guard}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const action = useAction(guard, t('gestao.pessoas.delegacaoEncerrada'));
  return (
    <li className="grid gap-2 text-sm">
      <span>
        {d.actions.map((a) => t(actionKey(a))).join(', ')} ·{' '}
        <Period startsAt={d.startsAt} endsAt={d.endsAt} /> · {d.documentReference}
        {d.status === 'ended' && ` · ${t('gestao.pessoas.encerrado')}`}
      </span>
      {d.status === 'active' && !open && (
        <Button tone="quiet" className="justify-self-start" onClick={() => setOpen(true)}>
          {t('gestao.pessoas.encerrarDelegacao')}
        </Button>
      )}
      {open && (
        <form
          className="grid gap-3 sm:max-w-md"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void action.run(() => post(`/delegations/${d.id}/end`, {reason: reason.trim()}));
          }}
        >
          <Field
            id={`motivo-delegacao-${d.id}`}
            label={t('gestao.pessoas.motivo')}
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Feedback error={action.error} done={action.done} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" tone="danger" busy={action.busy} disabled={reason.trim().length < 3}>
              {t('gestao.pessoas.encerrarDelegacao')}
            </Button>
            <Button tone="secondary" onClick={() => setOpen(false)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

type FormProps = {role: RoleRow; guard: Guard; onClose: () => void; onSaved: (message: string) => void};

function EndRole({role: r, guard, onClose, onSaved}: FormProps) {
  const {t} = useTranslation();
  const [reason, setReason] = useState('');
  const action = useAction(guard, t('gestao.pessoas.encerradoOk'));
  return (
    <form
      className="grid gap-3 sm:max-w-md"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void action.run(
          () => post(`/roles/${r.id}/end`, {reason: reason.trim()}),
          () => onSaved(t('gestao.pessoas.encerradoOk')),
        );
      }}
    >
      <Field
        id={`motivo-papel-${r.id}`}
        label={t('gestao.pessoas.motivo')}
        required
        minLength={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Feedback error={action.error} done={action.done} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" tone="danger" busy={action.busy} disabled={reason.trim().length < 3}>
          {t('gestao.pessoas.encerrarConfirmar')}
        </Button>
        <Button tone="secondary" onClick={onClose}>
          {t('app.cancelar')}
        </Button>
      </div>
    </form>
  );
}

function AddMandate({role: r, guard, onClose, onSaved}: FormProps) {
  const {t} = useTranslation();
  const [form, setForm] = useState({startsAt: '', endsAt: '', minutesReference: ''});
  const action = useAction(guard, t('gestao.pessoas.mandatoRegistrado'));
  return (
    <form
      className="grid gap-3 sm:max-w-md"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void action.run(
          () =>
            post('/mandates', {
              roleAssignmentId: r.id,
              ...form,
              minutesReference: form.minutesReference.trim(),
            }),
          () => onSaved(t('gestao.pessoas.mandatoRegistrado')),
        );
      }}
    >
      <MandateFields form={form} setForm={setForm} idPrefix={`mandato-${r.id}`} />
      <Feedback error={action.error} done={action.done} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          busy={action.busy}
          disabled={!form.startsAt || !form.endsAt || form.minutesReference.trim().length < 3}
        >
          {t('gestao.pessoas.registrarMandato')}
        </Button>
        <Button tone="secondary" onClick={onClose}>
          {t('app.cancelar')}
        </Button>
      </div>
    </form>
  );
}

type MandateForm = {startsAt: string; endsAt: string; minutesReference: string};
function MandateFields({
  form,
  setForm,
  idPrefix,
}: {
  form: MandateForm;
  setForm: (f: MandateForm) => void;
  idPrefix: string;
}) {
  const {t} = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`${idPrefix}-inicio`}
        type="date"
        label={t('gestao.pessoas.inicio')}
        required
        value={form.startsAt}
        onChange={(e) => setForm({...form, startsAt: e.target.value})}
      />
      <Field
        id={`${idPrefix}-fim`}
        type="date"
        label={t('gestao.pessoas.fim')}
        required
        value={form.endsAt}
        onChange={(e) => setForm({...form, endsAt: e.target.value})}
      />
      <div className="sm:col-span-2">
        <Field
          id={`${idPrefix}-ata`}
          label={t('gestao.pessoas.ata')}
          hint={t('gestao.pessoas.ataDica')}
          required
          minLength={3}
          maxLength={200}
          value={form.minutesReference}
          onChange={(e) => setForm({...form, minutesReference: e.target.value})}
        />
      </div>
    </div>
  );
}

function Delegate({role: r, guard, onClose, onSaved}: FormProps) {
  const {t} = useTranslation();
  const [actions, setActions] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState('');
  const [doc, setDoc] = useState('');
  const action = useAction(guard, t('gestao.pessoas.delegacaoRegistrada'));
  return (
    <form
      className="grid gap-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void action.run(
          () =>
            post('/delegations', {roleAssignmentId: r.id, actions, endsAt, documentReference: doc.trim()}),
          () => onSaved(t('gestao.pessoas.delegacaoRegistrada')),
        );
      }}
    >
      <fieldset className="grid gap-1">
        <legend className="mb-1 font-medium">{t('gestao.pessoas.acoesDelegadas')}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {DELEGABLE.filter((a) => {
            if (a === 'stay.read.all') return r.role === 'subsyndic' || r.role === 'service_provider';
            return true;
          }).map((a) => (
            <label key={a} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={actions.includes(a)}
                onChange={(e) =>
                  setActions(e.target.checked ? [...actions, a] : actions.filter((x) => x !== a))
                }
              />
              {t(actionKey(a))}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:max-w-md">
        <Field
          id={`delegacao-fim-${r.id}`}
          type="date"
          label={t('gestao.pessoas.fim')}
          required
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <Field
          id={`delegacao-doc-${r.id}`}
          label={t('gestao.pessoas.documento')}
          required
          minLength={3}
          maxLength={200}
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        />
      </div>
      <Feedback error={action.error} done={action.done} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          busy={action.busy}
          disabled={!actions.length || !endsAt || doc.trim().length < 3}
        >
          {t('gestao.pessoas.delegar')}
        </Button>
        <Button tone="secondary" onClick={onClose}>
          {t('app.cancelar')}
        </Button>
      </div>
    </form>
  );
}

function ScopeChoice({
  scopes,
  setScopes,
  idPrefix,
}: {
  scopes: string[];
  setScopes: (s: string[]) => void;
  idPrefix: string;
}) {
  const {t} = useTranslation();
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 font-medium">{t('gestao.pessoas.escoposCampo')}</legend>
      <div className="flex flex-wrap gap-x-6">
        {SCOPES.map((s) => (
          <label key={s} className="flex min-h-11 items-center gap-3" htmlFor={`${idPrefix}-${s}`}>
            <input
              id={`${idPrefix}-${s}`}
              type="checkbox"
              className="size-5"
              checked={scopes.includes(s)}
              onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))}
            />
            {t(`gestao.escopos.${s}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GrantRole({people, guard}: {people: PersonRow[]; guard: Guard}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({personId: '', role: '', startsAt: '', endsAt: '', reason: ''});
  const [scopes, setScopes] = useState<string[]>([]);
  const [mandate, setMandate] = useState<MandateForm>({startsAt: '', endsAt: '', minutesReference: ''});
  const action = useAction(guard, t('gestao.pessoas.concedido'));
  const syndic = form.role === 'syndic';
  const ready =
    form.personId &&
    form.role &&
    form.reason.trim().length >= 3 &&
    (!syndic || (mandate.startsAt && mandate.endsAt && mandate.minutesReference.trim().length >= 3));

  if (!open)
    return (
      <Card>
        {/* concedido: o formulário fecha e volta vazio (nada para um segundo envio por engano) */}
        {action.done && <Notice tone="ok">{action.done}</Notice>}
        <Button tone="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
          {t('gestao.pessoas.conceder')}
        </Button>
      </Card>
    );

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('gestao.pessoas.conceder')}</h2>
      <form
        className="grid gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void action.run(
            () =>
              post('/roles', {
                personId: form.personId,
                role: form.role,
                scopes: form.role === 'administrator' ? scopes : [],
                ...(form.startsAt ? {startsAt: form.startsAt} : {}),
                ...(form.endsAt ? {endsAt: form.endsAt} : {}),
                reason: form.reason.trim(),
                ...(syndic ? {mandate: {...mandate, minutesReference: mandate.minutesReference.trim()}} : {}),
              }),
            () => {
              setOpen(false);
              setForm({personId: '', role: '', startsAt: '', endsAt: '', reason: ''});
              setScopes([]);
              setMandate({startsAt: '', endsAt: '', minutesReference: ''});
            },
          );
        }}
      >
        <SelectField
          id="papel-pessoa"
          label={t('gestao.pessoas.pessoa')}
          required
          value={form.personId}
          onChange={(e) => setForm({...form, personId: e.target.value})}
        >
          <option value="">{t('gestao.pessoas.escolhaPessoa')}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="papel-papel"
          label={t('gestao.pessoas.papel')}
          required
          value={form.role}
          onChange={(e) => setForm({...form, role: e.target.value})}
        >
          <option value="">{t('gestao.pessoas.escolhaPapel')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`papeis.${r}`)}
            </option>
          ))}
        </SelectField>
        {form.role === 'administrator' && (
          <ScopeChoice scopes={scopes} setScopes={setScopes} idPrefix="papel-escopo" />
        )}
        {syndic ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-medium">{t('gestao.pessoas.mandatoSindico')}</legend>
            <MandateFields form={mandate} setForm={setMandate} idPrefix="papel-mandato" />
          </fieldset>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="papel-inicio"
              type="date"
              label={t('gestao.pessoas.inicioOpcional')}
              value={form.startsAt}
              onChange={(e) => setForm({...form, startsAt: e.target.value})}
            />
            <Field
              id="papel-fim"
              type="date"
              label={t('gestao.pessoas.fimOpcional')}
              value={form.endsAt}
              onChange={(e) => setForm({...form, endsAt: e.target.value})}
            />
          </div>
        )}
        <Field
          id="papel-motivo"
          label={t('gestao.pessoas.motivo')}
          required
          minLength={3}
          maxLength={500}
          value={form.reason}
          onChange={(e) => setForm({...form, reason: e.target.value})}
        />
        <Feedback error={action.error} done={action.done} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={action.busy} disabled={!ready}>
            {t('gestao.pessoas.conceder')}
          </Button>
          <Button tone="secondary" onClick={() => setOpen(false)}>
            {t('app.cancelar')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function InviteRole({guard}: {guard: Guard}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const action = useAction(guard, '', []);

  if (!open)
    return (
      <Card>
        <Button tone="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
          {t('gestao.pessoas.convidarPapel')}
        </Button>
      </Card>
    );

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('gestao.pessoas.convidarPapel')}</h2>
      {created ? (
        <InviteLink
          invite={created}
          onAnother={() => {
            setCreated(null);
            setEmail('');
            setRole('');
            setScopes([]);
          }}
        />
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void action.run(
              () =>
                post<CreatedInvite>('/auth/invitations', {
                  purpose: 'role',
                  role,
                  scopes: role === 'administrator' ? scopes : [],
                  contactValue: email.trim(),
                }),
              (result) => setCreated(result as CreatedInvite),
            );
          }}
        >
          <p className="text-suave">{t('gestao.pessoas.convidarExplica')}</p>
          <SelectField
            id="convite-papel"
            label={t('gestao.pessoas.papel')}
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">{t('gestao.pessoas.escolhaPapel')}</option>
            {INVITABLE.map((r) => (
              <option key={r} value={r}>
                {t(`papeis.${r}`)}
              </option>
            ))}
          </SelectField>
          {role === 'administrator' && (
            <ScopeChoice scopes={scopes} setScopes={setScopes} idPrefix="convite-escopo" />
          )}
          <Field
            id="convite-papel-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            label={t('gestao.convite.email')}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Feedback error={action.error} done={null} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              busy={action.busy}
              busyLabel={t('gestao.convite.gerando')}
              disabled={!role || !email.trim()}
            >
              {t('gestao.convite.gerar')}
            </Button>
            <Button tone="secondary" onClick={() => setOpen(false)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
