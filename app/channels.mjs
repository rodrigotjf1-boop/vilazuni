import {isDemoTenant, requireLiveTenant} from './demo-policy.mjs';
import {randomUUID, timingSafeEqual, createHash, randomInt} from 'node:crypto';
import {can} from './permissions.mjs';
import {consultSources, publishedSources, text, fingerprint} from './knowledge.mjs';
import {localDay} from './residents.mjs';
function manager(u) {
  if (!can(u, 'communications') || !can(u, 'knowledge'))
    throw Error('Canais exigem comunicação e gestão das fontes.');
}
// Vínculo do grupo: o identificador digitado não prova nada (qualquer síndico digitaria o de outro grupo em
// que o bot está). O canal só vale depois que o código de uso único é postado NO grupo informado
// (`/vincular CÓDIGO`, ver telegramWebhook); até lá não envia, não agenda e não responde.
const LINK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  LINK_MS = 24 * 3600000,
  linkDigest = (code) =>
    createHash('sha256')
      .update(
        String(code)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ''),
      )
      .digest('hex'),
  linked = (c) => typeof c.verifiedAt === 'string';
function newLinkCode(c, now) {
  const raw = Array.from({length: 8}, () => LINK_ALPHABET[randomInt(LINK_ALPHABET.length)]).join('');
  c.linkCodeHash = linkDigest(raw);
  c.linkCodeUntil = now + LINK_MS;
  return raw.slice(0, 4) + '-' + raw.slice(4);
}
function channelView(c) {
  const {linkCodeHash, ...safe} = structuredClone(c);
  return {...safe, linked: linked(c)};
}
export function channelsView(state, u) {
  manager(u);
  return {
    channels: (state.channels || []).filter((c) => c.tenant === u.tenant).map(channelView),
    outbox: (state.channelOutbox || [])
      .filter((c) => c.tenant === u.tenant)
      .slice(-100)
      .reverse(),
  };
}
export function saveChannel(state, u, input, now = Date.now()) {
  manager(u);
  if (input.active === true || input.scheduled === true)
    requireLiveTenant(state, u.tenant, 'O canal Telegram');
  if (!/^-[0-9]{4,20}$/.test(input.chatId || '') || !/^@[a-z\d_]{5,32}$/i.test(input.botName || ''))
    throw Error('Informe grupo e usuário oficial do bot Telegram.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dailyAt || '')) throw Error('Informe horário de Brasília.');
  if (input.reviewed !== true) throw Error('Confira o grupo e a autorização para divulgação externa.');
  state.channels ??= [];
  // Só um vínculo confirmado bloqueia: um cadastro sem código postado não "ocupa" o grupo do condomínio dono.
  if (state.channels.some((c) => c.chatId === input.chatId && c.tenant !== u.tenant && linked(c)))
    throw Error('Este grupo já está vinculado a outro condomínio.');
  let c = state.channels.find((c) => c.tenant === u.tenant && c.chatId === input.chatId);
  if (c && input.version !== c.version) throw Error('O canal mudou. Atualize.');
  const values = {
    name: text(input.name, 'Nome do grupo'),
    chatId: input.chatId,
    botName: input.botName,
    dailyAt: input.dailyAt,
    active: input.active === true,
    scheduled: input.scheduled === true,
    reason: text(input.reason, 'Conferência de público e grupo', 500),
    reviewedAt: new Date(now).toISOString(),
    reviewedBy: u.id,
  };
  if (c) {
    Object.assign(c, values);
    c.version++;
  } else {
    if (state.channels.filter((c) => c.tenant === u.tenant).length >= 10)
      throw Error('Limite de grupos atingido.');
    c = {id: randomUUID(), tenant: u.tenant, version: 1, ...values};
    state.channels.push(c);
  }
  // O código aparece uma vez, na resposta; fica guardado só o resumo (sha256), por 24 h.
  const linkCode = !linked(c) && !isDemoTenant(state, u.tenant) ? newLinkCode(c, now) : null;
  return {...channelView(c), ...(linkCode ? {linkCode} : {})};
}
export function channelLinkCode(state, u, input, now = Date.now()) {
  manager(u);
  requireLiveTenant(state, u.tenant, 'O vínculo do grupo Telegram');
  const c = (state.channels || []).find((c) => c.id === input.id && c.tenant === u.tenant);
  if (!c) throw Error('Canal indisponível.');
  if (linked(c)) throw Error('Este grupo já está vinculado.');
  return {...channelView(c), linkCode: newLinkCode(c, now)};
}
function envelope(state, c, kind, key, body, evidence, now) {
  state.channelOutbox ??= [];
  const old = state.channelOutbox.find((o) => o.tenant === c.tenant && o.key === key);
  if (old) return old;
  const o = {
    id: randomUUID(),
    tenant: c.tenant,
    channelId: c.id,
    channelVersion: c.version,
    chatId: c.chatId,
    kind,
    key,
    body: body.slice(0, 3900),
    evidence,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    version: 1,
  };
  state.channelOutbox.push(o);
  return o;
}
export function prepareDaily(state, c, now = Date.now()) {
  if (isDemoTenant(state, c.tenant)) return null;
  const sources = publishedSources(state, {tenant: c.tenant}, 'external', now).slice(0, 8);
  if (!sources.length) return null;
  const body =
    'Resumo do condomínio · ' +
    localDay(now) +
    '\n' +
    sources
      .map(
        (r) =>
          '\n' +
          r.title +
          '\n' +
          r.body.split('\n')[0].slice(0, 240) +
          '\nFonte: ' +
          r.reference +
          ' · revisão ' +
          r.number,
      )
      .join('\n');
  return envelope(
    state,
    c,
    'daily',
    c.id + ':' + localDay(now),
    body,
    sources.map((r) => ({id: r.id, sha256: r.sha256})),
    now,
  );
}
export function prepareChannel(state, u, input, now = Date.now()) {
  manager(u);
  const c = (state.channels || []).find((c) => c.id === input.id && c.tenant === u.tenant && c.active);
  if (!c) throw Error('Canal indisponível.');
  if (!linked(c)) throw Error('Vincule o grupo pelo código antes de preparar resumos.');
  return prepareDaily(state, c, now) || {notice: 'Sem fontes liberadas para canal externo.'};
}
export function scheduledChannels(state, now = Date.now()) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return (state.channels || []).filter(
    (c) => !isDemoTenant(state, c.tenant) && c.active && linked(c) && c.scheduled && c.dailyAt <= hour,
  );
}
// Confere o segredo do webhook sem alterar nada (a API chama antes de copiar a base).
export function telegramSecretValid(secret, env = process.env) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  return (
    !!expected &&
    typeof secret === 'string' &&
    Buffer.byteLength(secret) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  );
}
export function telegramWebhook(state, input, secret, env = process.env, now = Date.now()) {
  if (!telegramSecretValid(secret, env)) throw Error('Webhook não autenticado.');
  if (!Number.isSafeInteger(input.update_id)) throw Error('Atualização inválida.');
  const m = input.message;
  if (!m?.chat?.id || typeof m.text !== 'string') return {ignored: true};
  const link = /^\/vincular(?:@[a-z\d_]{5,32})?\s+([a-z0-9]{4}-?[a-z0-9]{4})$/i.exec(m.text.trim());
  if (link) return linkGroup(state, m, link[1], now);
  const c = (state.channels || []).find(
    (c) => !isDemoTenant(state, c.tenant) && c.active && linked(c) && c.chatId === String(m.chat.id),
  );
  if (!c) return {ignored: true};
  const prefix = '/perguntar' + c.botName,
    mentioned =
      m.text.toLowerCase().startsWith(prefix.toLowerCase() + ' ') ||
      m.text.toLowerCase().startsWith(c.botName.toLowerCase() + ' ');
  if (!mentioned) return {ignored: true};
  const question = m.text.slice(m.text.indexOf(' ') + 1).trim();
  if (question.length < 3 || question.length > 1000) return {ignored: true};
  const key = c.id + ':telegram:' + input.update_id;
  if ((state.channelOutbox || []).some((o) => o.key === key)) return {duplicate: true};
  const recent = (state.channelOutbox || []).filter(
    (o) => o.channelId === c.id && Date.parse(o.createdAt) > now - 3600000,
  );
  if (recent.length >= 30) return {ignored: true};
  const answer = consultSources(state, {tenant: c.tenant}, {question, audience: 'external'}, now),
    body = answer.found
      ? answer.excerpts
          .map((r) => r.quote + '\nFonte: ' + r.reference + ' · revisão ' + r.revision)
          .join('\n\n')
      : 'Não encontrei base nas fontes liberadas para este grupo. Consulte a gestão.';
  envelope(
    state,
    c,
    'answer',
    key,
    body,
    answer.excerpts.map((r) => ({id: r.sourceId, sha256: r.sha256})),
    now,
  );
  return {accepted: true};
}
// O código só vale no grupo que o síndico informou, em grupo de verdade, dentro das 24 h, uma vez; um grupo já
// vinculado a outro condomínio não troca de dono. Resposta igual ("ignored") para todo caso recusado.
function linkGroup(state, m, code, now) {
  const hash = linkDigest(code),
    c = (state.channels || []).find(
      (c) => !isDemoTenant(state, c.tenant) && c.linkCodeHash === hash && c.linkCodeUntil > now,
    );
  if (!c || c.chatId !== String(m.chat.id) || !['group', 'supergroup'].includes(m.chat.type))
    return {ignored: true};
  if (state.channels.some((o) => o !== c && o.chatId === c.chatId && linked(o))) return {ignored: true};
  c.verifiedAt = new Date(now).toISOString();
  delete c.linkCodeHash;
  delete c.linkCodeUntil;
  c.version++;
  return {accepted: true, linked: true};
}
export function claimChannelMessage(state, tenant, id, now = Date.now()) {
  requireLiveTenant(state, tenant, 'O envio ao Telegram');
  const o = (state.channelOutbox || []).find(
    (o) => o.tenant === tenant && o.id === id && o.status === 'pending',
  );
  if (!o) throw Error('Mensagem indisponível.');
  const c = (state.channels || []).find(
    (c) =>
      c.tenant === tenant && c.id === o.channelId && c.active && linked(c) && c.version === o.channelVersion,
  );
  const sources = publishedSources(state, {tenant}, 'external', now);
  if (!c || o.evidence.some((e) => !sources.some((r) => r.id === e.id && r.sha256 === e.sha256)))
    throw Error('Grupo ou fontes mudaram. Prepare novo conteúdo antes do envio.');
  o.status = 'dispatching';
  o.version++;
  return structuredClone(o);
}
export async function deliverTelegram(o, env = process.env, fetcher = fetch) {
  if (o.demoMode === true)
    return {status: 'disabled', notice: 'Demonstração: nenhuma mensagem enviada ao Telegram.'};
  if (env.TELEGRAM_ENABLED !== 'true' || !env.TELEGRAM_BOT_TOKEN)
    return {status: 'failed', notice: 'Telegram ainda não habilitado no servidor.'};
  try {
    const r = await fetcher('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify({chat_id: o.chatId, text: o.body, disable_web_page_preview: true}),
    });
    if (!r.ok) throw Error();
    const result = await r.json();
    if (result.ok !== true) throw Error();
    return {
      status: 'sent',
      messageId: result.result?.message_id,
      notice: 'Telegram aceitou o envio; isso não confirma leitura.',
    };
  } catch {
    return {
      status: 'uncertain',
      notice: 'Entrega sem confirmação. Confira o grupo; não há repetição automática.',
    };
  }
}
