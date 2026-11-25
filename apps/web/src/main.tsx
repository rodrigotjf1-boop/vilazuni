import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import {QueryCache, QueryClient, QueryClientProvider} from '@tanstack/react-query';
import './i18n';
import './styles.css';
import {ApiError} from './lib/api';
import {Shell} from './components/Shell';
import {Entrar} from './pages/Entrar';
import {Convite} from './pages/Convite';
import {Cadastro} from './pages/Cadastro';
import {MinhaCasa} from './pages/MinhaCasa';
import {Estadias} from './pages/Estadias';
import {Inicio} from './pages/Inicio';
import {Calendario} from './pages/Calendario';
import {Operacao} from './pages/Operacao';
import {Mais} from './pages/Mais';
import {MinhaEstadia} from './pages/MinhaEstadia';
import {Verificacao} from './pages/Verificacao';
import {Sessoes} from './pages/Sessoes';
import {EscolherCondominio} from './pages/EscolherCondominio';
import {NaoEncontrado} from './pages/NaoEncontrado';
import {Titularidades} from './pages/gestao/Titularidades';
import {Pessoas} from './pages/gestao/Pessoas';
import {Auditoria} from './pages/gestao/Auditoria';

const queryClient: QueryClient = new QueryClient({
  // sessão que venceu no meio do uso: relê "quem sou eu" e a moldura manda para "Entrar" com o caminho de volta
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== 'me')
        void queryClient.invalidateQueries({queryKey: ['me']});
    },
  }),
  defaultOptions: {
    queries: {
      // 4xx é resposta definitiva (sem permissão, não existe): não repete
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createBrowserRouter([
  {path: '/entrar', element: <Entrar />},
  {path: '/convite/:token', element: <Convite />},
  {path: '/cadastro/:token', element: <Cadastro />},
  {path: '/minha-estadia', element: <MinhaEstadia />},
  {
    element: <Shell />,
    children: [
      {index: true, element: <Inicio />},
      {path: '/minha-casa', element: <MinhaCasa />},
      {path: '/estadias', element: <Estadias />},
      {path: '/estadias/calendario', element: <Calendario />},
      {path: '/operacao', element: <Operacao />},
      {path: '/mais', element: <Mais />},
      {path: '/verificacao', element: <Verificacao />},
      {path: '/conta/sessoes', element: <Sessoes />},
      {path: '/escolher-condominio', element: <EscolherCondominio />},
      {path: '/gestao/titularidades', element: <Titularidades />},
      {path: '/gestao/pessoas', element: <Pessoas />},
      {path: '/gestao/auditoria', element: <Auditoria />},
    ],
  },
  {path: '*', element: <NaoEncontrado />},
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
