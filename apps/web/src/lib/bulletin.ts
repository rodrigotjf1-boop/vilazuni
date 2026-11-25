import {isLang, type Lang} from '../i18n';

export type BulletinKind = 'rule' | 'notice';
export type Text = {title: string; body: string};
export type Translations = Record<'pt-BR', Text> & Partial<Record<'es' | 'en', Text>>;

export type BulletinContent = {
  id: string;
  kind: BulletinKind;
  version: number;
  translations: Translations;
  effectiveAt: string;
  expiresAt: string | null;
};

export type BulletinEntry = BulletinContent & {
  shareWithGuests: boolean;
  requiresAcknowledgement: boolean;
  publishedAt: string;
  publishedBy: string;
};

export type BulletinReaderEntry = BulletinEntry & {
  readAt: string | null;
  acknowledgedAt: string | null;
};

export type BulletinManagedEntry = BulletinEntry & {reads: number; acknowledgements: number};

export function bulletinText(entry: BulletinContent, language: string): {text: Text; language: Lang} {
  if (isLang(language)) {
    const translated = entry.translations[language];
    if (translated) return {text: translated, language};
  }
  return {text: entry.translations['pt-BR'], language: 'pt-BR'};
}
