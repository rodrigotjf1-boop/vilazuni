import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import ptBR from './pt-BR';
import es from './es';
import en from './en';
import {stayText} from './stays';
import {layoutText} from './layout';
import {bulletinText} from './bulletin';
import {guideText} from './guide';

export const LANGS = ['pt-BR', 'es', 'en'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'vz.idioma';

export const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

/** Escolha guardada neste aparelho (conveniência, não dado de negócio) → idioma do navegador → português. */
export function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* armazenamento bloqueado: segue sem */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('en')) return 'en';
  return 'pt-BR';
}

export function setLanguage(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  document.documentElement.lang = lang;
  void i18n.changeLanguage(lang);
}

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': {
      translation: {
        ...ptBR,
        stay: stayText['pt-BR'],
        layout: layoutText['pt-BR'],
        bulletin: bulletinText['pt-BR'],
        guide: guideText['pt-BR'],
      },
    },
    es: {
      translation: {
        ...es,
        stay: stayText.es,
        layout: layoutText.es,
        bulletin: bulletinText.es,
        guide: guideText.es,
      },
    },
    en: {
      translation: {
        ...en,
        stay: stayText.en,
        layout: layoutText.en,
        bulletin: bulletinText.en,
        guide: guideText.en,
      },
    },
  },
  lng: initialLanguage(),
  fallbackLng: 'pt-BR',
  // o React já escapa o que mostra
  interpolation: {escapeValue: false},
  returnNull: false,
});
document.documentElement.lang = i18n.language;

/** Data curta no idioma e no fuso do condomínio (o "agora" e as regras são do servidor; aqui é só exibição). */
export const formatDate = (iso: string | null | undefined, lang: string, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat(lang, {
        dateStyle: 'short',
        ...(withTime ? {timeStyle: 'short'} : {}),
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(iso))
    : '';

export default i18n;
