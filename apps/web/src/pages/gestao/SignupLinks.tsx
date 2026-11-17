import {useState, type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiError, get, post} from '../../lib/api';
import {formatDate} from '../../i18n';
import type {SignupLinkRow} from '../../lib/types';
import {
  Button,
  Card,
  CopyButton,
  ErrorState,
  Field,
  Notice,
  Pill,
  QrCode,
  SelectField,
  useErrorText,
} from '../../components/ui';
import {needsMfa} from '../../components/MfaPrompt';

interface Created {
  token: string;
  expiresAt: string;
  maxUses: number;
}

const TONE = {active: 'ok', expired: 'neutral', exhausted: 'wait', revoked: 'bad'} as const;

/**
 * Link de cadastro do condomínio (ADR-0011): um link coletivo, com validade e limite, que a gestão envia a todos os
 * proprietários. O link aparece UMA vez (no banco fica só o hash); a lista mostra uso e situação, e revogar para na hora.
 */
export function SignupLinks({guard}: {guard: (error: unknown, again: () => void) => boolean}) {
  const {t} = useTranslation();
  const list = useQuery({
    queryKey: ['signup-links'],
    queryFn: () => get<{links: SignupLinkRow[]}>('/signup-links'),
  });
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  // sem permissão (ou falta o código, que a página já pede pela lista de pedidos): a seção não aparece
  if (list.error instanceof ApiError && (list.error.status === 403 || needsMfa(list.error))) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('gestao.linkCadastro.titulo')}</h2>
      <p className="max-w-prose text-suave">{t('gestao.linkCadastro.explica')}</p>
      {list.error && <ErrorState error={list.error} retry={() => void list.refetch()} />}
      {created ? (
        <CreatedLink created={created} onClose={() => setCreated(null)} />
      ) : open ? (
        <CreateForm
          guard={guard}
          onCreated={(c) => {
            setCreated(c);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        list.data && (
          <Button tone="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
            {t('gestao.linkCadastro.abrir')}
          </Button>
        )
      )}
      {list.data && (
        <div className="grid gap-2">
          <h3 className="font-semibold">{t('gestao.linkCadastro.lista')}</h3>
          {list.data.links.length === 0 ? (
            <p className="text-suave">{t('gestao.linkCadastro.vazio')}</p>
          ) : (
            <ul className="grid gap-2">
              {list.data.links.map((l) => (
                <li key={l.id}>
                  <LinkRow link={l} guard={guard} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function CreateForm({
  guard,
  onCreated,
  onCancel,
}: {
  guard: (error: unknown, again: () => void) => boolean;
  onCreated: (c: Created) => void;
  onCancel: () => void;
}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [days, setDays] = useState(14);
  const [maxUses, setMaxUses] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const uses = Number(maxUses);
  const usesOk = Number.isInteger(uses) && uses >= 1 && uses <= 500;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<Created>('/signup-links', {expiresInDays: days, maxUses: uses});
      await client.invalidateQueries({queryKey: ['signup-links']});
      onCreated(r);
    } catch (err) {
      if (!guard(err, () => void create())) setError(err);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (usesOk) void create();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
      <SelectField
        id="link-validade"
        label={t('gestao.linkCadastro.validade')}
        value={String(days)}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        <option value="7">{t('gestao.linkCadastro.d7')}</option>
        <option value="14">{t('gestao.linkCadastro.d14')}</option>
        <option value="30">{t('gestao.linkCadastro.d30')}</option>
      </SelectField>
      <Field
        id="link-limite"
        type="number"
        inputMode="numeric"
        min={1}
        max={500}
        label={t('gestao.linkCadastro.limite')}
        value={maxUses}
        onChange={(e) => setMaxUses(e.target.value)}
      />
      {!!error && <Notice tone="error">{errorText(error)}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} busyLabel={t('gestao.linkCadastro.gerando')} disabled={!usesOk}>
          {t('gestao.linkCadastro.gerar')}
        </Button>
        <Button tone="secondary" onClick={onCancel}>
          {t('app.cancelar')}
        </Button>
      </div>
    </form>
  );
}

function CreatedLink({created, onClose}: {created: Created; onClose: () => void}) {
  const {t, i18n} = useTranslation();
  const link = `${window.location.origin}/cadastro/${created.token}`;
  return (
    <div className="grid gap-3">
      <Notice tone="warn">{t('gestao.linkCadastro.gerado')}</Notice>
      <label className="grid gap-1">
        <span className="font-medium">{t('gestao.linkCadastro.link')}</span>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-lg border border-linha bg-fundo px-3 font-mono text-sm"
        />
      </label>
      <p className="text-sm text-suave">
        {t('gestao.linkCadastro.ate', {
          data: formatDate(created.expiresAt, i18n.language, true),
          n: created.maxUses,
        })}
      </p>
      <QrCode value={link} label={t('gestao.linkCadastro.qr')} />
      <div className="flex flex-wrap gap-2">
        <CopyButton text={link} />
        <Button tone="secondary" onClick={onClose}>
          {t('gestao.linkCadastro.fechar')}
        </Button>
      </div>
    </div>
  );
}

function LinkRow({
  link: l,
  guard,
}: {
  link: SignupLinkRow;
  guard: (error: unknown, again: () => void) => boolean;
}) {
  const {t, i18n} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await post(`/signup-links/${l.id}/revoke`);
      setConfirming(false);
      await client.invalidateQueries({queryKey: ['signup-links']});
    } catch (err) {
      if (!guard(err, () => void revoke())) setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-linha p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={TONE[l.status]}>{t(`gestao.linkCadastro.${l.status}`)}</Pill>
            <span>{t('gestao.linkCadastro.usos', {usos: l.uses, max: l.maxUses})}</span>
          </div>
          <p className="text-sm text-suave">
            {t('gestao.linkCadastro.criadoEm', {
              data: formatDate(l.createdAt, i18n.language),
              fim: formatDate(l.expiresAt, i18n.language, true),
            })}
          </p>
        </div>
        {l.status === 'active' && !confirming && (
          <Button tone="danger" onClick={() => setConfirming(true)}>
            {t('gestao.linkCadastro.revogar')}
          </Button>
        )}
      </div>
      {confirming && (
        <div className="grid gap-2">
          <p>{t('gestao.linkCadastro.revogarConfirma')}</p>
          <div className="flex flex-wrap gap-2">
            <Button tone="danger" busy={busy} onClick={() => void revoke()}>
              {t('gestao.linkCadastro.revogarSim')}
            </Button>
            <Button tone="secondary" onClick={() => setConfirming(false)}>
              {t('app.cancelar')}
            </Button>
          </div>
        </div>
      )}
      {!!error && <Notice tone="error">{errorText(error)}</Notice>}
    </div>
  );
}
