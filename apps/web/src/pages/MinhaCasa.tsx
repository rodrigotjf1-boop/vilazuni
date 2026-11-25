import {useState, type FormEvent} from 'react';
import {Link} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {get, post} from '../lib/api';
import {useMe} from '../lib/session';
import {formatDate} from '../i18n';
import type {MyUnit, UnitDetail, UnitLink} from '../lib/types';
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
} from '../components/ui';

export function MinhaCasa() {
  const {t} = useTranslation();
  const me = useMe();
  const units = useQuery({queryKey: ['me-units'], queryFn: () => get<{units: MyUnit[]}>('/me/units')});
  const semVinculo = me.data?.condominiums.length === 0;

  return (
    <div className="grid gap-6">
      <PageTitle>{t('minhaCasa.titulo')}</PageTitle>
      {semVinculo && (
        <Notice tone="info">
          <p className="font-medium">{t('condominio.semVinculo')}</p>
          <p>{t('condominio.semVinculoDica')}</p>
        </Notice>
      )}
      {!semVinculo && units.isPending && <Loading />}
      {units.error && <ErrorState error={units.error} retry={() => void units.refetch()} />}
      {units.data && units.data.units.length === 0 && !semVinculo && (
        <Notice tone="info">{t('minhaCasa.vazio')}</Notice>
      )}
      {units.data && units.data.units.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {units.data.units.map((u) => (
            <li key={u.id} className="min-w-0">
              <UnitCard unit={u} />
            </li>
          ))}
        </ul>
      )}
      {units.data && !semVinculo && <RequestOwnership mine={units.data.units} />}
    </div>
  );
}

function linkStatus(link: UnitLink, t: (k: string, o?: Record<string, unknown>) => string, lang: string) {
  if (link.status === 'pending') return <Pill tone="wait">{t('minhaCasa.pendente')}</Pill>;
  if (link.status === 'rejected') return <Pill tone="bad">{t('minhaCasa.recusada')}</Pill>;
  if (link.status === 'validated')
    return <Pill tone="ok">{t('minhaCasa.validada', {data: formatDate(link.startsAt, lang)})}</Pill>;
  return <Pill tone="ok">{t('minhaCasa.ativa', {data: formatDate(link.startsAt, lang)})}</Pill>;
}

function UnitCard({unit}: {unit: MyUnit}) {
  const {t, i18n} = useTranslation();
  // os proprietários só aparecem para quem tem a casa de fato (pendente não abre a casa — 404 na API)
  const open = unit.links.some((l) => l.status === 'validated' || l.status === 'active');
  const detail = useQuery({
    queryKey: ['unit', unit.id],
    queryFn: () => get<{unit: UnitDetail}>(`/units/${unit.id}`),
    enabled: open,
  });
  const vaga = unit.parkingSpace;
  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{unit.label}</h2>
        <span className="text-suave">
          {vaga
            ? t(vaga.accessible ? 'minhaCasa.vagaAcessivel' : 'minhaCasa.vaga', {numero: vaga.number})
            : t('minhaCasa.semVaga')}
        </span>
      </div>
      <ul className="grid gap-2">
        {unit.links.map((l) => (
          <li key={l.id} className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {l.type === 'residency' ? t('minhaCasa.residencia') : t('minhaCasa.titularidade')}
              </span>
              {linkStatus(l, t, i18n.language)}
            </div>
            {l.status === 'rejected' && l.decisionNote && (
              <p className="text-sm text-suave">{t('minhaCasa.motivo', {motivo: l.decisionNote})}</p>
            )}
          </li>
        ))}
      </ul>
      {detail.data && detail.data.unit.status === 'active' && (
        <Link
          to={`/minha-casa/${unit.id}/guia`}
          className="inline-flex min-h-11 w-fit items-center rounded-lg border border-linha px-4 font-medium text-primaria hover:border-primaria"
        >
          {t('guide.title')}
        </Link>
      )}
      {detail.data && detail.data.unit.owners.length > 0 && (
        <div className="grid gap-1">
          <p className="text-sm font-medium text-suave">{t('minhaCasa.proprietarios')}</p>
          <p>{detail.data.unit.owners.map((o) => o.displayName).join(', ')}</p>
        </div>
      )}
    </Card>
  );
}

function RequestOwnership({mine}: {mine: MyUnit[]}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const client = useQueryClient();
  const labels = useQuery({
    queryKey: ['unit-labels'],
    queryFn: () => get<{units: {id: string; label: string}[]}>('/unit-labels'),
  });
  const [unitId, setUnitId] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const request = useMutation({
    mutationFn: () => post('/ownership-requests', note.trim() ? {unitId, shareNote: note.trim()} : {unitId}),
    onSuccess: async () => {
      setSent(true);
      setUnitId('');
      setNote('');
      await client.invalidateQueries({queryKey: ['me-units']});
    },
  });
  // quem não pode pedir (ex.: só papel de prestador) recebe 403: a seção simplesmente não aparece
  if (labels.error || !labels.data) return null;
  const taken = new Set(mine.filter((u) => u.links.some((l) => l.status !== 'rejected')).map((u) => u.id));
  const free = labels.data.units.filter((u) => !taken.has(u.id));

  function submit(e: FormEvent) {
    e.preventDefault();
    setSent(false);
    request.mutate();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">
        {mine.length ? t('minhaCasa.pedirOutra') : t('minhaCasa.pedirPrimeira')}
      </h2>
      {free.length === 0 ? (
        <p className="text-suave">{t('minhaCasa.semCasasLivres')}</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
          <SelectField
            id="casa"
            label={t('minhaCasa.casa')}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
          >
            <option value="">{t('minhaCasa.escolha')}</option>
            {free.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </SelectField>
          <Field
            id="observacao"
            label={t('minhaCasa.observacao')}
            hint={t('minhaCasa.observacaoDica')}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {request.error && <Notice tone="error">{errorText(request.error)}</Notice>}
          {sent && <Notice tone="ok">{t('minhaCasa.enviado')}</Notice>}
          <Button
            type="submit"
            busy={request.isPending}
            busyLabel={t('minhaCasa.enviando')}
            disabled={!unitId}
          >
            {t('minhaCasa.enviar')}
          </Button>
        </form>
      )}
    </Card>
  );
}
