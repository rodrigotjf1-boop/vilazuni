import {Link, useOutletContext} from 'react-router';
import {useTranslation} from 'react-i18next';
import {ActionLink, Icon, WorkspaceError} from '../components/Workspace';
import {LanguagePicker} from '../components/LanguagePicker';
import {Button, Card, Loading} from '../components/ui';
import type {ShellContext} from '../components/Shell';
import {canOpen} from '../lib/stays';

export function Mais() {
  const {t} = useTranslation();
  const {active, access, logout, signingOut, name, hasChoices} = useOutletContext<ShellContext>();
  const actions = access.data?.actions;
  const links = [
    {to: '/operacao', label: t('layout.operation'), show: canOpen(actions, 'stay.read.all')},
    {to: '/estadias/calendario', label: t('layout.calendarTitle'), show: canOpen(actions, 'stay.read.all')},
    {
      to: '/gestao/titularidades',
      label: t('nav.titularidades'),
      show: canOpen(actions, 'ownership.validate'),
    },
    {to: '/gestao/pessoas', label: t('nav.pessoas'), show: canOpen(actions, 'person.read.all')},
    {to: '/gestao/auditoria', label: t('nav.auditoria'), show: canOpen(actions, 'audit.read')},
    {to: '/escolher-condominio', label: t('layout.switchCondo'), show: hasChoices},
    {to: '/verificacao', label: t('nav.verificacao'), show: true},
    {to: '/conta/sessoes', label: t('nav.sessoes'), show: true},
  ];
  return (
    <div className="vz-flow vz-account">
      <h1 className="vz-page-title">{t('layout.account')}</h1>
      <Card>
        <div className="vz-section-head">
          <div>
            <h2 className="vz-subtitle">{name}</h2>
            {active && <p className="vz-subtle">{active.name}</p>}
          </div>
          <LanguagePicker compact />
        </div>
      </Card>
      {active && access.isPending && <Loading />}
      {access.error && <WorkspaceError error={access.error} retry={() => void access.refetch()} />}
      <Card>
        <ul className="vz-lines">
          {links
            .filter((link) => link.show)
            .map((link) => (
              <li key={link.to}>
                <Link className="vz-list-row" to={link.to}>
                  {link.label}
                  <Icon name="next" />
                </Link>
              </li>
            ))}
        </ul>
      </Card>
      <div>
        <Button tone="secondary" busy={signingOut} busyLabel={t('app.saindo')} onClick={() => void logout()}>
          {t('app.sair')}
        </Button>
      </div>
    </div>
  );
}
