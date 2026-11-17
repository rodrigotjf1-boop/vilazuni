import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router';
import {get, post, setCondominium, setCsrf, getCondominium, ApiError} from './api';
import type {Access, Me} from './types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => get<Me>('/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    staleTime: 30_000,
  });
}

/** O que mostrar no condomínio ativo. Não é barreira: a API decide de novo a cada pedido. */
export function useAccess(enabled: boolean) {
  return useQuery({
    queryKey: ['access', getCondominium()],
    queryFn: () => get<Access>('/me/access'),
    enabled,
    staleTime: 30_000,
  });
}

export function useLogout() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await post('/auth/logout').catch(() => undefined);
    setCsrf(null);
    setCondominium(null);
    client.clear();
    navigate('/entrar', {replace: true});
  };
}
