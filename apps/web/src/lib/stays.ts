import {useQuery} from '@tanstack/react-query';
import {get, getCondominium} from './api';

export type Band = 'adult' | 'teen' | 'child';
export type Member = {name: string; band: Band; contact?: string};
export type Stay = {
  id: string;
  unitId: string;
  unitLabel: string;
  checkInAt: string;
  checkOutAt: string;
  members: Member[];
  counts: Record<Band, number>;
  plates: string[];
  exceptionReason: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  decisionNote: string | null;
  hasGuestLink: boolean;
  version: number;
};
type Unit = {id: string; label: string};
export type StayList = {
  stays: Stay[];
  ownUnits: Unit[];
  visibleUnits: Unit[];
  timezone: string;
  serverNow: string;
  manage: boolean;
  more: boolean;
};

type StayQuery = {
  scope?: 'own' | 'all';
  from?: string;
  to?: string;
  id?: string;
  view?: 'context' | 'arrivals' | 'upcoming';
};

export function useStays(query: StayQuery = {}) {
  const params = new URLSearchParams(query);
  return useQuery({
    queryKey: ['stays', getCondominium(), query],
    queryFn: () => get<StayList>('/stays' + (params.size ? `?${params}` : '')),
    gcTime: 0,
    refetchInterval: 30_000,
  });
}

export function canOpen(actions: Record<string, string> | undefined, action: string) {
  const permission = actions?.[action];
  return permission !== undefined && permission !== 'negado';
}

export const stayDetail = (id: string) => `/estadias?estadia=${encodeURIComponent(id)}`;
export const groupSize = (stay: Stay) => stay.counts.adult + stay.counts.teen + stay.counts.child;
