import {useState, type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {get, post} from '../../lib/api';
import {formatDate} from '../../i18n';
import {Button, Card, CopyButton, Field, Notice, SelectField, useErrorText} from '../../components/ui';

export interface CreatedInvite {
  token: string;
  expiresAt: string;
}

/** Link do convite: aparece UMA vez (no banco só fica o hash); a pessoa da gestão copia e envia. */
export function InviteLink({invite, onAnother}: {invite: CreatedInvite; onAnother: () => void}) {
  const {t, i18n} = useTranslation();
  const link = `${window.location.origin}/convite/${invite.token}`;
  return (
    <div className="grid gap-3">
      <Notice tone="warn">{t('gestao.convite.gerado')}</Notice>
      <label className="grid gap-1">
        <span className="font-medium">{t('gestao.convite.link')}</span>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-lg border border-linha bg-fundo px-3 font-mono text-sm"
        />
      </label>
      <p className="text-sm text-suave">
        {t('gestao.convite.ate', {data: formatDate(invite.expiresAt, i18n.language, true)})}
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={link} />
        <Button tone="quiet" onClick={onAnother}>
          {t('gestao.convite.outro')}
        </Button>
      </div>
    </div>
  );
}

/** Convidar proprietário de uma casa (a titularidade nasce pendente — ADR-0009). */
export function InviteOwner({guard}: {guard: (error: unknown, again: () => void) => boolean}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => get<{units: {id: string; label: string}[]}>('/units'),
  });
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  // quem não vê as casas (ou não pode convidar) não recebe o formulário; a API recusaria de qualquer jeito
  if (!units.data) return null;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setCreated(
        await post<CreatedInvite>('/auth/invitations', {
          purpose: 'ownership',
          unitId,
          contactValue: email.trim(),
          expiresInHours: hours,
        }),
      );
    } catch (err) {
      if (!guard(err, () => void create())) setError(err);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void create();
  }

  return (
    <Card>
      {!open ? (
        <Button tone="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
          {t('gestao.convite.abrir')}
        </Button>
      ) : created ? (
        <InviteLink
          invite={created}
          onAnother={() => {
            setCreated(null);
            setEmail('');
            setUnitId('');
          }}
        />
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
          <h2 className="text-lg font-semibold">{t('gestao.convite.abrir')}</h2>
          <p className="text-suave">{t('gestao.convite.explica')}</p>
          <SelectField
            id="convite-casa"
            label={t('gestao.convite.casa')}
            required
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">{t('gestao.convite.escolha')}</option>
            {units.data.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </SelectField>
          <Field
            id="convite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            label={t('gestao.convite.email')}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SelectField
            id="convite-validade"
            label={t('gestao.convite.validade')}
            value={String(hours)}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value="24">{t('gestao.convite.h24')}</option>
            <option value="72">{t('gestao.convite.h72')}</option>
            <option value="168">{t('gestao.convite.h168')}</option>
          </SelectField>
          {!!error && <Notice tone="error">{errorText(error)}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              busy={busy}
              busyLabel={t('gestao.convite.gerando')}
              disabled={!unitId || !email.trim()}
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
