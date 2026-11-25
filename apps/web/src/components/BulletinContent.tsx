import {useTranslation} from 'react-i18next';
import {bulletinText, type BulletinContent as Entry} from '../lib/bulletin';
import {Pill} from './ui';

export function BulletinContent({entry}: {entry: Entry}) {
  const {t, i18n} = useTranslation();
  const {text, language} = bulletinText(entry, i18n.language);
  return (
    <>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold break-words" lang={language}>
          {text.title}
        </h3>
        <Pill tone="neutral">{t('bulletin.version', {version: entry.version})}</Pill>
      </header>
      {language !== i18n.language && (
        <p className="text-sm text-suave">{t('bulletin.availableInPortuguese')}</p>
      )}
      <p className="whitespace-pre-wrap break-words" lang={language}>
        {text.body}
      </p>
    </>
  );
}
