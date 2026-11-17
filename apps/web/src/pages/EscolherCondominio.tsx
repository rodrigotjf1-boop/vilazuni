import {useNavigate, useSearchParams} from 'react-router';
import {useTranslation} from 'react-i18next';
import {useQueryClient} from '@tanstack/react-query';
import {setCondominium} from '../lib/api';
import {safeNext} from '../lib/redirect';
import {useMe} from '../lib/session';
import {Card, Loading, PageTitle} from '../components/ui';

/** Pessoa com vínculo em mais de um condomínio escolhe qual usar nesta aba; nada se mistura entre eles. */
export function EscolherCondominio() {
  const {t} = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  if (!me.data) return <Loading />;
  return (
    <div className="grid max-w-xl gap-6">
      <PageTitle>{t('condominio.escolher')}</PageTitle>
      <ul className="grid gap-3">
        {me.data.condominiums.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => {
                setCondominium(c.id);
                // dados de outro condomínio não ficam na tela
                client.removeQueries({predicate: (q) => q.queryKey[0] !== 'me'});
                navigate(safeNext(params.get('de')), {replace: true});
              }}
            >
              <Card className="hover:border-primaria">
                <span className="text-lg font-medium">{c.name}</span>
              </Card>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
