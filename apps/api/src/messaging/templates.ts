/**
 * Textos dos e-mails nos três idiomas do produto. Só texto simples (nada de HTML com link clicável no código:
 * o código se digita na tela que a pessoa já abriu).
 */
export type Lang = 'pt-BR' | 'es' | 'en';

export interface VerificationParams {
  code: string;
  condominiumName: string;
  minutes: number;
}

const verification: Record<Lang, (p: VerificationParams) => {subject: string; text: string}> = {
  'pt-BR': (p) => ({
    subject: `${p.code} é o seu código de cadastro no ${p.condominiumName}`,
    text: [
      `Seu código para concluir o cadastro no ${p.condominiumName}: ${p.code}`,
      '',
      `Ele vale por ${p.minutes} minutos e só uma vez. Digite-o na página de cadastro que você abriu.`,
      'Se não foi você quem pediu, ignore este e-mail: nada é feito sem o código.',
      '',
      'Vilazuni',
    ].join('\n'),
  }),
  es: (p) => ({
    subject: `${p.code} es su código de registro en ${p.condominiumName}`,
    text: [
      `Su código para completar el registro en ${p.condominiumName}: ${p.code}`,
      '',
      `Vale por ${p.minutes} minutos y una sola vez. Escríbalo en la página de registro que abrió.`,
      'Si no fue usted quien lo pidió, ignore este correo: nada se hace sin el código.',
      '',
      'Vilazuni',
    ].join('\n'),
  }),
  en: (p) => ({
    subject: `${p.code} is your sign-up code for ${p.condominiumName}`,
    text: [
      `Your code to finish signing up at ${p.condominiumName}: ${p.code}`,
      '',
      `It is valid for ${p.minutes} minutes and only once. Enter it on the sign-up page you opened.`,
      'If you did not ask for it, ignore this email: nothing happens without the code.',
      '',
      'Vilazuni',
    ].join('\n'),
  }),
};

export const TEMPLATES = {verification} as const;
export type TemplateName = keyof typeof TEMPLATES;

export function render(template: TemplateName, lang: string, params: VerificationParams) {
  const l: Lang = lang === 'es' || lang === 'en' ? lang : 'pt-BR';
  return TEMPLATES[template][l](params);
}
