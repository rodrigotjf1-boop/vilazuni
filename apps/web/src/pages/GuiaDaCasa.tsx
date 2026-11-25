import {useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router';
import {AttractionList} from '../components/AttractionList';
import {AttractionEditor} from '../components/AttractionEditor';
import {Button, ErrorState, Loading, Notice, PageTitle} from '../components/ui';
import {get} from '../lib/api';
import {guidePath, loadUnitPhoto, type Attraction, type PhotoSource, type UnitGuide} from '../lib/guide';

export function GuiaDaCasa() {
  const {unitId = ''} = useParams();
  return <HouseGuide key={unitId} unitId={unitId} />;
}

function HouseGuide({unitId}: {unitId: string}) {
  const {t} = useTranslation();
  const client = useQueryClient();
  const queryKey = ['unit-guide', unitId];
  const query = useQuery({queryKey, queryFn: () => get<UnitGuide>(guidePath(unitId))});
  const [editor, setEditor] = useState<Attraction | 'new' | null>(null);
  const [feedback, setFeedback] = useState<'saved' | 'deleted' | null>(null);
  const photoSource: PhotoSource = {
    key: `unit:${unitId}`,
    load: (id, slot) => loadUnitPhoto(unitId, id, slot),
  };

  async function finished(message: 'saved' | 'deleted') {
    setEditor(null);
    setFeedback(message);
    await client.invalidateQueries({queryKey});
  }

  function start(attraction: Attraction | 'new') {
    setFeedback(null);
    setEditor(attraction);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Link to="/minha-casa" className="w-fit font-medium underline">
          {t('guide.back')}
        </Link>
        <PageTitle>{t('guide.title')}</PageTitle>
        {query.data && <p className="text-suave">{query.data.unitLabel}</p>}
      </div>
      {query.isPending && <Loading />}
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      {query.data && !query.error && (
        <>
          {feedback && <Notice tone="ok">{t(`guide.${feedback}`)}</Notice>}
          {query.data.canEdit && editor === null && (
            <div>
              <Button type="button" onClick={() => start('new')}>
                {t('guide.add')}
              </Button>
            </div>
          )}
          {query.data.canEdit && editor !== null && (
            <AttractionEditor
              key={editor === 'new' ? 'new' : editor.id}
              unitId={unitId}
              attraction={editor === 'new' ? undefined : editor}
              photoSource={photoSource}
              onCancel={() => setEditor(null)}
              onFinished={finished}
            />
          )}
          <AttractionList
            attractions={query.data.attractions}
            photoSource={photoSource}
            onEdit={query.data.canEdit && editor === null ? start : undefined}
          />
        </>
      )}
    </div>
  );
}
