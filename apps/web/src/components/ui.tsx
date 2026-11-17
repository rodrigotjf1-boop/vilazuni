import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {useTranslation} from 'react-i18next';
import {encode} from 'uqr';
import {ApiError} from '../lib/api';

/** Peças pequenas e repetidas das telas. Alvo de toque confortável (44 px), foco visível, texto de 16 px. */

type Tone = 'primary' | 'secondary' | 'danger' | 'quiet';
// o recuo lateral fica em cada tom: "px-4" na base e "px-0" no discreto disputavam e o discreto saía recuado
const TONES: Record<Tone, string> = {
  primary: 'px-4 bg-primaria text-white hover:bg-primaria-escura disabled:opacity-60',
  secondary: 'px-4 bg-superficie text-texto border border-linha hover:border-primaria disabled:opacity-60',
  danger:
    'px-4 bg-superficie text-erro border border-erro hover:bg-erro hover:text-white disabled:opacity-60',
  quiet: 'text-primaria underline underline-offset-4 hover:text-primaria-escura',
};

export function Button({
  tone = 'primary',
  busy,
  busyLabel,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {tone?: Tone; busy?: boolean; busyLabel?: string}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-medium transition-colors ${TONES[tone]} ${className}`}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {label: string; hint?: string; error?: string | null}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={input.id ?? id} className="font-medium">
        {label}
      </label>
      <input
        id={input.id ?? id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${input.id ?? id}-ajuda` : undefined}
        className="min-h-11 w-full min-w-0 rounded-lg border border-linha bg-superficie px-3 text-base aria-invalid:border-erro"
      />
      {(hint || error) && (
        <p id={`${input.id ?? id}-ajuda`} className={`text-sm ${error ? 'text-erro' : 'text-suave'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & {label: string; children: ReactNode}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={select.id ?? id} className="font-medium">
        {label}
      </label>
      <select
        id={select.id ?? id}
        {...select}
        className="min-h-11 w-full min-w-0 rounded-lg border border-linha bg-superficie px-3 text-base"
      >
        {children}
      </select>
    </div>
  );
}

const NOTICE: Record<'info' | 'ok' | 'warn' | 'error', string> = {
  info: 'bg-primaria-clara text-texto',
  ok: 'bg-primaria-clara text-texto',
  warn: 'bg-areia-clara text-texto',
  error: 'bg-[#fbeaec] text-erro',
};
/** Aviso. Erro usa role=alert (lido na hora); o resto, role=status. */
export function Notice({tone = 'info', children}: {tone?: keyof typeof NOTICE; children: ReactNode}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 ${NOTICE[tone]}`}>
      {children}
    </div>
  );
}

export function Card({children, className = ''}: {children: ReactNode; className?: string}) {
  return (
    // content-start: cartão mais alto (h-full na grade) não estica as linhas de dentro (etiquetas ficavam altas)
    <section
      className={`grid content-start gap-3 rounded-xl border border-linha bg-superficie p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Pill({tone, children}: {tone: 'ok' | 'wait' | 'bad' | 'neutral'; children: ReactNode}) {
  const map = {
    ok: 'border-primaria text-primaria',
    wait: 'border-atencao text-atencao',
    bad: 'border-erro text-erro',
    neutral: 'border-linha text-suave',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function PageTitle({children, lead}: {children: ReactNode; lead?: ReactNode}) {
  return (
    <header className="grid gap-1">
      <h1 className="text-2xl font-semibold text-balance sm:text-3xl">{children}</h1>
      {lead && <p className="max-w-prose text-suave">{lead}</p>}
    </header>
  );
}

export function Loading() {
  const {t} = useTranslation();
  return (
    <p role="status" className="text-suave">
      {t('app.carregando')}
    </p>
  );
}

/** Texto do erro no idioma da pessoa, pelo código estável que a API devolve. */
export function useErrorText() {
  const {t} = useTranslation();
  return (error: unknown): string => {
    if (error instanceof ApiError)
      return t(`erros.${error.code}`, {defaultValue: error.message || t('erros.desconhecido')});
    return t('erros.desconhecido');
  };
}

export function ErrorState({error, retry}: {error: unknown; retry?: () => void}) {
  const {t} = useTranslation();
  const text = useErrorText();
  return (
    <Notice tone="error">
      <div className="flex flex-wrap items-center gap-3">
        <span>{text(error)}</span>
        {retry && (
          <Button tone="secondary" onClick={retry}>
            {t('app.tentarDeNovo')}
          </Button>
        )}
      </div>
    </Notice>
  );
}

/** QR Code desenhado como SVG a partir da matriz (sem innerHTML). */
export function QrCode({value, label}: {value: string; label: string}) {
  const {size, data} = encode(value, {ecc: 'M', border: 2});
  let d = '';
  data.forEach((row, y) => row.forEach((dark, x) => (d += dark ? `M${x},${y}h1v1h-1z` : '')));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-56 max-w-full rounded-lg bg-white p-1"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#173b3b" />
    </svg>
  );
}

/** Copiar para a área de transferência, com aviso; se o navegador recusar, a pessoa seleciona o texto. */
export function CopyButton({text, label}: {text: string; label?: string}) {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      tone="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* sem permissão de cópia: o texto está visível para selecionar */
        }
      }}
    >
      {copied ? t('app.copiado') : (label ?? t('app.copiar'))}
    </Button>
  );
}
