import {useId, useState, type FormEvent} from 'react';
import {useMutation} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ApiError, del} from '../lib/api';
import {
  guideFields,
  guidePath,
  photoFormats,
  photoSlots,
  prepareGuidePhoto,
  saveAttraction,
  type Attraction,
  type GuideFields,
  type PhotoChanges,
  type PhotoSlot,
  type PhotoSource,
} from '../lib/guide';
import {AttractionPhoto, PhotoPreview} from './AttractionList';
import {Button, Card, Field, Notice, useErrorText} from './ui';

const emptyFields = {title: '', description: '', directions: '', transport: '', tips: ''};
const longFields = ['description', 'directions', 'transport', 'tips'] as const;

export function AttractionEditor({
  unitId,
  attraction,
  photoSource,
  onCancel,
  onFinished,
}: {
  unitId: string;
  attraction?: Attraction;
  photoSource: PhotoSource;
  onCancel: () => void;
  onFinished: (message: 'saved' | 'deleted') => Promise<void>;
}) {
  const {t} = useTranslation();
  const errorText = useErrorText();
  const fieldId = useId();
  const [text, setText] = useState<GuideFields>(() =>
    attraction
      ? {
          title: attraction.title,
          description: attraction.description,
          directions: attraction.directions,
          transport: attraction.transport,
          tips: attraction.tips,
        }
      : emptyFields,
  );
  const [photos, setPhotos] = useState<PhotoChanges>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const change = useMutation({
    mutationFn: async (operation: 'save' | 'delete') => {
      if (operation === 'delete' && attraction) {
        await del(`${guidePath(unitId)}/${attraction.id}?version=${attraction.version}`);
        return 'deleted' as const;
      }
      const prepared = {...photos};
      for (const slot of photoSlots) {
        const photo = prepared[slot];
        if (photo) {
          try {
            prepared[slot] = await prepareGuidePhoto(photo);
          } catch {
            throw new ApiError(400, 'guia_foto_invalida', '');
          }
        }
      }
      await saveAttraction(unitId, text, prepared, attraction);
      return 'saved' as const;
    },
    onSuccess: onFinished,
  });
  const failure = change.error;
  const failureText =
    failure instanceof ApiError && (failure.code === 'guia_foto_invalida' || failure.status === 413)
      ? t('guide.invalidPhoto')
      : errorText(failure);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!change.isPending && !confirmDelete) change.mutate('save');
  }

  function setPhoto(slot: PhotoSlot, value: File | null | undefined) {
    setPhotos((previous) => ({...previous, [slot]: value}));
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">{t(attraction ? 'guide.edit' : 'guide.add')}</h2>
      <form onSubmit={submit} className="grid gap-4">
        <fieldset disabled={change.isPending || confirmDelete} className="grid min-w-0 gap-4">
          <Field
            label={t('guide.name')}
            required
            autoFocus
            minLength={2}
            maxLength={guideFields.title}
            value={text.title}
            onChange={(e) => setText({...text, title: e.target.value})}
          />
          {longFields.map((field) => (
            <div key={field} className="grid gap-1">
              <label htmlFor={`${fieldId}-${field}`} className="font-medium">
                {t(field === 'tips' ? 'guide.optionalTips' : `guide.${field}`)}
              </label>
              {field === 'directions' && (
                <p id={`${fieldId}-origin`} className="text-sm text-suave">
                  {t('guide.originHint')}
                </p>
              )}
              <textarea
                id={`${fieldId}-${field}`}
                aria-describedby={field === 'directions' ? `${fieldId}-origin` : undefined}
                className="w-full rounded-lg border border-linha bg-superficie p-3 text-base"
                rows={field === 'description' || field === 'directions' ? 4 : 3}
                required={field !== 'tips'}
                minLength={field === 'tips' ? undefined : 3}
                maxLength={guideFields[field]}
                value={text[field]}
                onChange={(e) => setText({...text, [field]: e.target.value})}
              />
            </div>
          ))}
          <fieldset className="grid min-w-0 gap-2">
            <legend className="font-medium">{t('guide.photos')}</legend>
            <p className="text-sm text-suave">{t('guide.photoHint')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {photoSlots.map((slot) => {
                const chosen = photos[slot];
                const existing = attraction?.photoSlots.includes(slot) ?? false;
                const kept = chosen === undefined && existing;
                const label = t('guide.photo', {slot});
                return (
                  <div
                    key={slot}
                    className="grid min-w-0 content-start gap-2 rounded-xl border border-linha p-3"
                  >
                    <label className="font-medium" htmlFor={`${fieldId}-photo-${slot}`}>
                      {label}
                    </label>
                    {chosen && (
                      <div className="aspect-[4/3] overflow-hidden rounded-lg">
                        <PhotoPreview file={chosen} alt={label} />
                      </div>
                    )}
                    {kept && attraction && (
                      <AttractionPhoto attraction={attraction} slot={slot} photoSource={photoSource} />
                    )}
                    <input
                      id={`${fieldId}-photo-${slot}`}
                      className="w-full min-w-0 text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border-0 file:bg-fundo file:px-2"
                      type="file"
                      accept={photoFormats}
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) setPhoto(slot, file);
                        e.currentTarget.value = '';
                      }}
                    />
                    {(chosen || kept) && (
                      <Button tone="quiet" onClick={() => setPhoto(slot, null)}>
                        {t('guide.removePhoto', {slot})}
                      </Button>
                    )}
                    {chosen === null && existing && (
                      <Button tone="quiet" onClick={() => setPhoto(slot, undefined)}>
                        {t('guide.keepPhoto', {slot})}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        </fieldset>
        {failure && <Notice tone="error">{failureText}</Notice>}
        {confirmDelete ? (
          <div className="grid gap-2">
            <p>{t('guide.confirmDelete')}</p>
            <div className="flex flex-wrap gap-2">
              <Button tone="danger" busy={change.isPending} onClick={() => change.mutate('delete')}>
                {t('guide.delete')}
              </Button>
              <Button tone="secondary" disabled={change.isPending} onClick={() => setConfirmDelete(false)}>
                {t('guide.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={change.isPending} busyLabel={t('guide.saving')}>
              {t('guide.save')}
            </Button>
            <Button tone="secondary" disabled={change.isPending} onClick={onCancel}>
              {t('guide.cancel')}
            </Button>
            {attraction && (
              <Button tone="danger" disabled={change.isPending} onClick={() => setConfirmDelete(true)}>
                {t('guide.delete')}
              </Button>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
