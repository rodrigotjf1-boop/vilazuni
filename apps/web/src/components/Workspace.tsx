import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ErrorState, Pill} from './ui';
import {MfaPrompt, needsMfa} from './MfaPrompt';
import type {Stay} from '../lib/stays';

const shapes = {
  home: 'm3 10 9-7 9 7v10H3z M9 20v-7h6v7',
  house: 'M3 7h18v14H3z M9 3h6 M3 11h18 M9 21v-6h6v6',
  calendar: 'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M9 14h1 M14 14h1',
  car: 'm5 12 2-5h10l2 5 M3 18v-4l2-2h14l2 2v4z M6 18v2 M18 18v2 M7 15h1 M16 15h1',
  account: 'M12 4a4 4 0 1 0 0 8 4 4 0 1 0 0-8 M4 21a8 8 0 0 1 16 0',
  next: 'm9 5 7 7-7 7',
  previous: 'm15 5-7 7 7 7',
  plus: 'M12 4v16 M4 12h16',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 6v6l4 2',
  list: 'M6 4h12v17H6z M9 9h6 M9 13h6 M9 17h4',
} as const;

export type WorkspaceIcon = keyof typeof shapes;

export function Icon({name}: {name: WorkspaceIcon}) {
  return (
    <svg
      className="vz-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={shapes[name]} />
    </svg>
  );
}

export function Wordmark({caption}: {caption?: string}) {
  return (
    <span className="vz-brand">
      <span className="vz-mark" aria-hidden="true">
        V
      </span>
      <span>
        <strong>Vilazuni</strong>
        {caption && <small>{caption}</small>}
      </span>
    </span>
  );
}

export function ActionLink({
  to,
  icon,
  secondary,
  children,
}: {
  to: string;
  icon?: WorkspaceIcon;
  secondary?: boolean;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`vz-action${secondary ? ' vz-action-secondary' : ''}`}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function StayStatus({status}: {status: Stay['status']}) {
  const {t} = useTranslation();
  const tone = {pending: 'wait', confirmed: 'ok', rejected: 'bad', cancelled: 'neutral'} as const;
  return <Pill tone={tone[status]}>{t(`stay.${status}`)}</Pill>;
}

export function WorkspaceError({error, retry}: {error: unknown; retry: () => void}) {
  return needsMfa(error) ? <MfaPrompt onDone={retry} /> : <ErrorState error={error} retry={retry} />;
}
