import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router';
import {Card, Loading, Notice, PageTitle} from '../components/ui';
import {ApiError} from '../lib/api';
import {displayStayTime} from '../lib/stay-time';

type GuestStay = {
  condominium: string;
  unitLabel: string;
  timezone: string;
  checkInAt: string;
  checkOutAt: string;
};

export function MinhaEstadia() {
  const {t, i18n} = useTranslation();
  const token = useLocation().hash.slice(1);
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token);
  const query = useQuery({
    queryKey: ['guest-stay', token],
    enabled: valid,
    gcTime: 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<GuestStay> => {
      const response = await fetch('/api/v1/stays/guest', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        cache: 'no-store',
        body: JSON.stringify({token}),
      });
      if (!response.ok) throw new ApiError(response.status, 'estadia_indisponivel', '');
      return response.json() as Promise<GuestStay>;
    },
  });
  const stay = query.data;
  const when = (time: string) => displayStayTime(time, stay!.timezone, i18n.language);
  return (
    <main className="mx-auto grid max-w-xl gap-5 p-5 sm:pt-12">
      <PageTitle>{t('stay.guestTitle')}</PageTitle>
      {valid && query.isPending && <Loading />}
      {(!valid || query.error) && <Notice tone="warn">{t('stay.unavailable')}</Notice>}
      {stay && !query.error && (
        <Card>
          <h2 className="text-xl font-semibold">{stay.condominium}</h2>
          <p>{stay.unitLabel}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-medium">{t('stay.in')}</dt>
            <dd>{when(stay.checkInAt)}</dd>
            <dt className="font-medium">{t('stay.out')}</dt>
            <dd>{when(stay.checkOutAt)}</dd>
          </dl>
        </Card>
      )}
    </main>
  );
}
