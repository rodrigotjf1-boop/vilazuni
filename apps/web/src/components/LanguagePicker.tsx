import {useTranslation} from 'react-i18next';
import {LANGS, isLang, setLanguage} from '../i18n';

/** Troca o idioma da tela (pt-BR, es, en). */
export function LanguagePicker({compact = false}: {compact?: boolean}) {
  const {t, i18n} = useTranslation();
  return (
    <label className="flex items-center gap-2">
      <span className={compact ? 'sr-only' : 'font-medium'}>{t('app.idioma')}</span>
      <select
        value={i18n.language}
        onChange={(e) => isLang(e.target.value) && setLanguage(e.target.value)}
        className="min-h-11 rounded-lg border border-linha bg-superficie px-2 text-base"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {t(`idiomas.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
