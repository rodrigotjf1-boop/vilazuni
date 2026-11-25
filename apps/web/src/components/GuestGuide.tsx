import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {guestGuide, loadGuestPhoto} from '../lib/guide';
import {AttractionList} from './AttractionList';
import {Button, Card, Loading, Notice} from './ui';

export function GuestGuide({token}: {token: string}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['guest-guide', token],
    queryFn: () => guestGuide(token),
    enabled: open,
    gcTime: 0,
    refetchInterval: open ? 30_000 : false,
  });
  return (
    <section className="grid gap-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t('guide.title')}</h2>
          <Button
            type="button"
            tone="secondary"
            aria-expanded={open}
            aria-controls="guest-guide"
            onClick={() => {
              if (!open && query.isFetched) void query.refetch();
              setOpen(!open);
            }}
          >
            {t(open ? 'guide.hide' : 'guide.openGuide')}
          </Button>
        </div>
      </Card>
      <div id="guest-guide" hidden={!open}>
        {open && (
          <>
            {query.isPending && <Loading />}
            {query.error && (
              <Notice tone="warn">
                <p>{t('guide.unavailable')}</p>
                <Button type="button" tone="secondary" onClick={() => void query.refetch()}>
                  {t('guide.retry')}
                </Button>
              </Notice>
            )}
            {query.data && !query.error && (
              <AttractionList
                attractions={query.data.attractions}
                photoSource={{key: `guest:${token}`, load: (id, slot) => loadGuestPhoto(token, id, slot)}}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
