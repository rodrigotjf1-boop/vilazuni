import {accessPanel} from './access-ui.mjs';
import {ROLE_NAMES} from './permissions.mjs';
export {ROLE_NAMES};
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c],
  );
let apiEpoch = 0;
export function discardPendingApi() {
  apiEpoch++;
}
export async function api(route, data) {
  const epoch = apiEpoch,
    response = await fetch('/api' + route, {
      method: data === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: data === undefined ? {} : {'Content-Type': 'application/json'},
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const result = await response.json();
  if (epoch !== apiEpoch)
    throw Object.assign(new Error('Consulta de um contexto anterior descartada.'), {discarded: true});
  if (!response.ok) {
    if (response.status === 401 && !['/login', '/activate', '/setup', '/recovery/reset'].includes(route))
      window.dispatchEvent(new Event('session-ended'));
    throw new Error(result.error || 'Não foi possível concluir.');
  }
  return result;
}
export function authorizationStatus(stay, now = Date.now()) {
  if (stay.status !== 'approved') return 'Sem autorização';
  if (now >= Date.parse(stay.end)) return 'Expirada';
  if (now < Date.parse(stay.start)) return 'Agendada';
  return 'Vigente';
}
const ICON_EYE =
    '<svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  ICON_LOCK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
const AUTH_COPY = {
  login: [
    'Acesso ao condomínio',
    'Entre no seu espaço.',
    'Seu perfil e suas casas são reconhecidos automaticamente.',
    'Entrar',
  ],
  setup: [
    'Primeiro acesso',
    'Seu condomínio começa aqui.',
    'Configure a conta inicial da gestão.',
    'Criar minha conta de gestão',
  ],
  activate: [
    'Convite',
    'Bem-vindo à sua casa.',
    'Use o convite recebido da gestão e escolha sua senha.',
    'Ativar meu acesso',
  ],
  reset: [
    'Recuperação',
    'Crie uma nova senha.',
    'Escolha a senha que você vai usar daqui em diante.',
    'Salvar nova senha',
  ],
};
export function showLogin({setupRequired, onSuccess, production = false, mfaAvailable = false}) {
  const shell = document.querySelector('.world-shell');
  shell.classList.add('is-locked');
  let mode = setupRequired ? 'setup' : location.hash.startsWith('#reset=') ? 'reset' : 'login';
  const resetToken = mode === 'reset' ? decodeURIComponent(location.hash.slice(7)) : null;
  if (resetToken) history.replaceState(null, '', location.pathname);
  function render() {
    document.querySelector('#auth-entry')?.remove();
    const box = document.createElement('section');
    box.id = 'auth-entry';
    box.className = 'auth-entry';
    const [kicker, title, lead, submit] = AUTH_COPY[mode];
    box.innerHTML = `<header class="auth-head"><span class="auth-kicker">${kicker}</span><h1>${title}</h1><p class="auth-lead">${lead}</p></header><form class="float-wizard auth-form">${['setup', 'activate'].includes(mode) ? '<label>Seu nome<input name="name" autocomplete="name" required minlength="3" maxlength="120"></label>' : ''}${mode !== 'reset' ? '<label>E-mail<input name="email" type="email" autocomplete="username" required maxlength="200"></label>' : ''}${mode === 'activate' ? '<label>Código do convite<input name="code" required autocomplete="off"></label>' : ''}<div class="auth-field"><label for="auth-password">Senha</label><div class="auth-password"><input id="auth-password" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="12" maxlength="128"><button type="button" class="auth-reveal" aria-label="Mostrar senha" aria-pressed="false" aria-controls="auth-password">${ICON_EYE}</button></div>${mode !== 'login' ? '<small>Use ao menos 12 caracteres. Não compartilhe sua senha.</small>' : ''}</div>${mode === 'setup' ? '<label>Código da instalação · quando exigido<input name="bootstrapToken" autocomplete="off"></label>' : ''}${mfaAvailable && ['login', 'activate'].includes(mode) ? '<label>Código do autenticador · se ativado<input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}"></label><details><summary>Usar código de recuperação</summary><input name="recoveryCode" autocomplete="off" aria-label="Código de recuperação MFA"></details>' : ''}<p class="auth-error" role="alert"></p><button class="glass-primary" type="submit">${submit}</button></form><div class="auth-links">${!setupRequired ? `<button id="auth-switch" type="button" class="auth-link">${mode === 'login' ? 'Recebi um convite' : 'Já tenho acesso'}</button>` : ''}<button id="auth-recovery" type="button" class="auth-link">Esqueci minha senha</button></div><p class="auth-foot auth-local">${ICON_LOCK}<span>${production ? 'Acesso ao ambiente do condomínio.' : 'Piloto local · casas e operações de exemplo.'}</span></p>`;
    shell.append(box);
    box.querySelector('.auth-reveal').addEventListener('click', (e) => {
      const button = e.currentTarget,
        input = box.querySelector('#auth-password'),
        show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      input.focus();
    });
    box.querySelector('#auth-switch')?.addEventListener('click', () => {
      mode = mode === 'login' ? 'activate' : 'login';
      render();
    });
    box.querySelector('#auth-recovery').onclick = () => {
      box.innerHTML = `<header class="auth-head"><span class="auth-kicker">Recuperação</span><h1>Recuperar acesso</h1><p class="auth-lead">Informe o e-mail da sua conta. Se ela existir, você recebe as instruções por lá.</p></header><form class="float-wizard auth-form"><label>E-mail<input name="email" type="email" autocomplete="username" required maxlength="200"></label><button class="glass-primary" type="submit">Solicitar instruções</button><p class="auth-status" role="status"></p></form><div class="auth-links"><button id="return-login" type="button" class="auth-link">Voltar</button></div>`;
      box.querySelector('#return-login').onclick = () => {
        mode = 'login';
        render();
      };
      box.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await api('/recovery/request', Object.fromEntries(new FormData(e.currentTarget)));
          box.querySelector('[role=status]').textContent = r.notice;
        } catch (err) {
          box.querySelector('[role=status]').textContent = err.message;
        }
      };
    };
    const form = box.querySelector('form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        const result = await api(mode === 'reset' ? '/recovery/reset' : '/' + mode, {
          ...Object.fromEntries(new FormData(form)),
          ...(mode === 'reset' ? {token: resetToken} : {}),
        });
        form.reset();
        if (mode === 'reset') {
          mode = 'login';
          render();
          return;
        }
        if (result.user?.mfaRequired) return showMfaEnrollment({onSuccess});
        await onSuccess();
      } catch (err) {
        box.querySelector('.auth-error').textContent = err.message;
        button.disabled = false;
      }
    };
  }
  render();
}
// Sem resposta do servidor ao abrir (sem internet, 502 do proxy): em vez de uma tela vazia, o cartão explica,
// oferece "Tentar novamente", tenta sozinho com espera crescente (5 s → 60 s) e reage à volta da internet.
let retryDelay = 5;
export function resetConnectionRetry() {
  retryDelay = 5;
}
export function showConnectionError({retry}) {
  const shell = document.querySelector('.world-shell');
  if (!shell) return;
  shell.classList.add('is-locked');
  document.querySelector('#auth-entry')?.remove();
  const box = document.createElement('section');
  box.id = 'auth-entry';
  box.className = 'auth-entry';
  box.innerHTML = `<header class="auth-head"><span class="auth-kicker">Sem conexão</span><h1>Não conseguimos falar com o condomínio.</h1><p class="auth-lead">Confira a internet deste aparelho. O aplicativo tenta de novo sozinho.</p></header><p class="auth-status" role="status" aria-live="polite"></p><button id="auth-retry" type="button" class="glass-primary">Tentar novamente</button>`;
  shell.append(box);
  const status = box.querySelector('.auth-status'),
    wait = retryDelay;
  retryDelay = Math.min(60, retryDelay * 2);
  let timer = 0,
    left = wait;
  const attempt = () => {
    clearInterval(timer);
    window.removeEventListener('online', attempt);
    if (!box.isConnected) return;
    box.querySelector('#auth-retry').disabled = true;
    status.textContent = 'Tentando conectar…';
    retry();
  };
  status.textContent = `Nova tentativa em ${left} s.`;
  timer = setInterval(() => {
    if (!box.isConnected) return clearInterval(timer);
    left -= 1;
    if (left <= 0) attempt();
    else status.textContent = `Nova tentativa em ${left} s.`;
  }, 1000);
  window.addEventListener('online', attempt);
  box.querySelector('#auth-retry').onclick = attempt;
}
export async function accountPanel({user, houses, panel, toast}) {
  const admin = user.role === 'sindico';
  let data = {users: [], invites: []};
  try {
    if (admin) data = await api('/admin/users');
  } catch (e) {
    toast(e.message);
    return;
  }
  const dock = panel(
    'Seu acesso.',
    'CONTA E PERMISSÕES',
    `<div class="floating-note"><h3>${esc(user.name)}</h3><p>${esc(ROLE_NAMES[user.role])} · ${esc(user.tenantName || 'Condomínio')}</p><small>${esc(user.email)}</small></div>${admin ? `<button id="manage-bindings" class="glass-primary">Pessoas, convites e acessos</button><details class="account-section"><summary>Convidar uma pessoa</summary><form id="invite-form" class="float-wizard"><label>E-mail da pessoa<input name="email" type="email" required maxlength="200"></label><label>Perfil<select name="role"><option value="proprietario">Proprietário</option><option value="imobiliaria">Imobiliária de locação</option><option value="portaria">Portaria</option><option value="zelador">Zeladoria</option></select></label><fieldset><legend>Casas autorizadas · proprietário / imobiliária</legend><div class="scope-houses">${houses.map((h) => `<label><input type="checkbox" name="house" value="${esc(h.id)}">${esc(h.number)}</label>`).join('')}</div></fieldset><label>Validade do vínculo · obrigatória para imobiliária<input name="validUntil" type="date"></label><p class="micro-note">O convite vale 48 horas. A pessoa define a própria senha. Use “Pessoas, convites e acessos” para vínculos com validade e escopo explícitos.</p><p class="auth-error" role="alert"></p><button class="glass-primary">Gerar convite</button></form><div id="invite-result" role="status"></div></details><details class="account-section"><summary>Contas do condomínio (${data.users.length})</summary>${data.users.map((u) => `<div class="floating-note"><strong>${esc(u.name)}</strong><p>${esc(ROLE_NAMES[u.role])} · ${u.active ? 'Ativa' : 'Suspensa'}</p><small>${esc(u.email)}${u.houses.length ? ' · Casas ' + u.houses.map((id) => esc(houses.find((h) => h.id === id)?.number || id)).join(', ') : ''}</small>${u.role !== 'sindico' && u.active ? `<button class="glass-secondary" data-suspend="${esc(u.id)}">Suspender acesso</button>` : ''}</div>`).join('')}</details><details class="account-section"><summary>Convites pendentes (${data.invites.length})</summary>${data.invites.map((i) => `<div class="floating-note"><p>${esc(i.email)}</p><small>${esc(ROLE_NAMES[i.role])}</small><button class="glass-secondary" data-revoke="${esc(i.id)}">Revogar convite</button></div>`).join('')}</details>` : ''}${!user.mfaAvailable ? '<p class="micro-note">Entrada com e-mail e senha.</p>' : !user.mfaEnabled ? '<button id="mfa-enroll" class="glass-secondary">Ativar segundo fator</button>' : '<p class="micro-note">Segundo fator ativo.</p>'}<details class="account-section"><summary>Alterar minha senha</summary><form id="password-form" class="float-wizard"><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>Nova senha<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label><p class="auth-error" role="alert"></p><button class="glass-primary">Salvar nova senha</button></form></details><p class="micro-note">Sessão: até 8 horas, com expiração após 30 minutos sem consultas ao servidor. Alterar a senha encerra as outras sessões.</p>`,
  );
  dock
    .querySelector('#mfa-enroll')
    ?.addEventListener('click', () => showMfaEnrollment({onSuccess: () => location.reload()}));
  dock.querySelector('#manage-bindings')?.addEventListener('click', () => accessPanel({panel, toast}));
  const invite = dock.querySelector('#invite-form');
  if (invite)
    invite.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(invite),
        button = invite.querySelector('button');
      button.disabled = true;
      try {
        const r = await api('/admin/invites', {
          email: fd.get('email'),
          role: fd.get('role'),
          houses: fd.getAll('house'),
          validUntil: fd.get('validUntil') ? fd.get('validUntil') + 'T23:59:59-03:00' : null,
        });
        dock.querySelector('#invite-result').innerHTML =
          `<div class="floating-note"><p>Convite criado. Entregue este código à pessoa pelo canal combinado.</p><label>Código · exibido somente agora<textarea readonly>${esc(r.code)}</textarea></label><small>Válido por 48 horas. Nenhuma mensagem foi enviada.</small></div>`;
        invite.reset();
      } catch (err) {
        invite.querySelector('.auth-error').textContent = err.message;
      } finally {
        button.disabled = false;
      }
    };
  for (const b of dock.querySelectorAll('[data-suspend],[data-revoke]'))
    b.onclick = async () => {
      b.disabled = true;
      try {
        await api(b.dataset.suspend ? '/admin/suspend' : '/admin/revoke-invite', {
          id: b.dataset.suspend || b.dataset.revoke,
        });
        toast('Acesso revogado.');
        await accountPanel({user, houses, panel, toast});
      } catch (e) {
        toast(e.message);
        b.disabled = false;
      }
    };
  const form = dock.querySelector('#password-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/password', Object.fromEntries(new FormData(form)));
      form.reset();
      toast('Senha alterada. Outras sessões foram encerradas.');
    } catch (err) {
      form.querySelector('.auth-error').textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
}

export function showMfaEnrollment({onSuccess}) {
  document.querySelector('#auth-entry')?.remove();
  const box = document.createElement('section');
  box.id = 'auth-entry';
  box.className = 'auth-entry';
  document.querySelector('.world-shell').append(box);
  box.innerHTML =
    '<h1>Proteja sua conta.</h1><p>Ative um autenticador TOTP. Guarde os códigos de recuperação em local privado.</p><form class="float-wizard"><label>Senha atual<input name="password" type="password" autocomplete="current-password" required></label><button class="glass-primary">Preparar autenticador</button><p class="auth-error" role="alert"></p></form>';
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const factor = await api('/mfa/enroll', Object.fromEntries(new FormData(form)));
      box.innerHTML =
        '<h1>Configure seu autenticador.</h1><p>Cadastre esta chave no seu autenticador TOTP e informe o código gerado.</p><label>Chave privada<textarea readonly>' +
        esc(factor.secret) +
        '</textarea></label><form class="float-wizard"><label>Código de 6 dígitos<input name="otp" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required></label><button class="glass-primary">Confirmar segundo fator</button><p class="auth-error" role="alert"></p></form>';
      box.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        try {
          const result = await api('/mfa/confirm', Object.fromEntries(new FormData(event.currentTarget)));
          box.innerHTML =
            '<h1>Guarde seus códigos.</h1><p>Cada código substitui o segundo fator uma única vez. Eles são exibidos somente agora.</p><textarea readonly rows="8">' +
            esc(result.codes.join('\n')) +
            '</textarea><button class="glass-primary" id="mfa-finish">Guardei os códigos, continuar</button>';
          box.querySelector('#mfa-finish').onclick = async () => {
            box.remove();
            await onSuccess();
          };
        } catch (error) {
          box.querySelector('.auth-error').textContent = error.message;
        }
      };
    } catch (error) {
      form.querySelector('.auth-error').textContent = error.message;
    }
  };
}
