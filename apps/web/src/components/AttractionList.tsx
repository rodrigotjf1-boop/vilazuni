import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import type {Attraction, PhotoSource, PhotoSlot} from '../lib/guide';
import {Button, Card, Loading, Notice} from './ui';

export function PhotoPreview({file, alt}: {file: Blob; alt: string}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : null;
}

export function AttractionPhoto({
  attraction,
  slot,
  photoSource,
}: {
  attraction: Attraction;
  slot: PhotoSlot;
  photoSource: PhotoSource;
}) {
  const {t} = useTranslation();
  const query = useQuery({
    queryKey: ['attraction-photo', photoSource.key, attraction.id, attraction.version, slot],
    queryFn: () => photoSource.load(attraction.id, slot),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  return (
    <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-fundo text-sm">
      {query.isPending && <Loading />}
      {query.error && (
        <button type="button" className="p-3 underline" onClick={() => void query.refetch()}>
          {t('guide.retryPhoto')}
        </button>
      )}
      {query.data && !query.error && (
        <PhotoPreview file={query.data} alt={t('guide.photoAlt', {slot, title: attraction.title})} />
      )}
    </div>
  );
}

const sections = ['description', 'directions', 'transport', 'tips'] as const;

export function AttractionList({
  attractions,
  photoSource,
  onEdit,
}: {
  attractions: Attraction[];
  photoSource: PhotoSource;
  onEdit?: (attraction: Attraction) => void;
}) {
  const {t} = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  if (!attractions.length) return <Notice tone="info">{t('guide.empty')}</Notice>;
  return (
    <ul className="grid gap-3">
      {attractions.map((attraction) => {
        const open = selected === attraction.id;
        return (
          <li key={attraction.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="min-w-0 break-words text-lg font-semibold">{attraction.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="secondary"
                    type="button"
                    aria-expanded={open}
                    aria-controls={`attraction-${attraction.id}`}
                    onClick={() => setSelected(open ? null : attraction.id)}
                  >
                    {t(open ? 'guide.hide' : 'guide.open')}
                  </Button>
                  {onEdit && (
                    <Button type="button" tone="secondary" onClick={() => onEdit(attraction)}>
                      {t('guide.edit')}
                    </Button>
                  )}
                </div>
              </div>
              <div
                id={`attraction-${attraction.id}`}
                hidden={!open}
                className={open ? 'grid gap-4' : undefined}
              >
                {open && (
                  <>
                    {attraction.photoSlots.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {attraction.photoSlots.map((slot) => (
                          <AttractionPhoto
                            key={slot}
                            attraction={attraction}
                            slot={slot}
                            photoSource={photoSource}
                          />
                        ))}
                      </div>
                    )}
                    <dl className="grid gap-4">
                      {sections
                        .filter((section) => attraction[section])
                        .map((section) => (
                          <div key={section} className="grid gap-1">
                            <dt className="font-semibold">{t(`guide.${section}`)}</dt>
                            <dd className="whitespace-pre-wrap break-words">{attraction[section]}</dd>
                          </div>
                        ))}
                    </dl>
                  </>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
