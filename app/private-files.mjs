import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function attachments(db) {
  return [
    ...(db.state.residents || []).flatMap((p) => [
      ...(p.photo ? [{tenant: p.tenant, file: p.photo}] : []),
      ...(p.history || [])
        .filter((h) => h.before?.photo && typeof h.before.photo === 'object')
        .map((h) => ({tenant: p.tenant, file: h.before.photo})),
    ]),
    ...(db.state.stays || []).filter((p) => p.photo).map((p) => ({tenant: p.tenant, file: p.photo})),
    ...(db.state.memberProfiles || []).filter((p) => p.photo).map((p) => ({tenant: p.tenant, file: p.photo})),
    ...(db.state.communityProfiles || [])
      .filter((p) => p.photo)
      .map((p) => ({tenant: p.tenant, file: p.photo})),
    ...(db.state.documents || []).flatMap((d) => d.versions.map((file) => ({tenant: d.tenant, file}))),
    ...(db.state.tasks || []).flatMap((t) => (t.photos || []).map((file) => ({tenant: t.tenant, file}))),
  ];
}
const SWEEP_EVERY_MS = 10 * 60000,
  ORPHAN_AGE_MS = 60 * 60000;
export function privateFileStorage(storage, directory, {now = () => Date.now()} = {}) {
  const root = path.resolve(directory);
  let lastSweep = -Infinity;
  function location(tenant, sha) {
    if (typeof tenant !== 'string' || !/^[a-f\d]{64}$/.test(sha)) throw Error('Referência privada inválida.');
    return path.join(root, hash(Buffer.from(tenant)), sha);
  }
  // Apaga do disco o arquivo que nenhum registro aponta mais (foto trocada ou removida, condomínio removido):
  // sem isso, fotos e documentos ficavam guardados para sempre. Cuidados: roda só DEPOIS de a base nova estar
  // gravada; só apaga arquivo com mais de 1 h pelo relógio do disco (outra instância pode ter acabado de gravar
  // um arquivo que a base dela já aponta); no máximo a cada 10 min; nunca com a base sem contas.
  async function sweep(db) {
    const t = now();
    if (t - lastSweep < SWEEP_EVERY_MS || !db.users?.length) return;
    lastSweep = t;
    const keep = new Set(
      attachments(db)
        .filter(({file}) => file.sha256 || file.blob)
        .map(({tenant, file}) => location(tenant, file.sha256 || file.blob)),
    );
    for (const folder of await fs.readdir(root, {withFileTypes: true}).catch(() => [])) {
      if (!folder.isDirectory() || !/^[a-f\d]{64}$/.test(folder.name)) continue;
      const dir = path.join(root, folder.name);
      for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
        const target = path.join(dir, entry.name);
        // Só o que este módulo grava: o arquivo final (sha256) e o temporário de uma gravação interrompida.
        if (!entry.isFile() || !/^[a-f\d]{64}(\.[a-f\d-]{36})?$/.test(entry.name) || keep.has(target))
          continue;
        if (Date.now() - (await fs.stat(target)).mtimeMs < ORPHAN_AGE_MS) continue;
        await fs.unlink(target);
      }
    }
  }
  return {
    kind: storage.kind,
    ...(storage.current ? {current: () => storage.current()} : {}),
    async load() {
      return hydratePrivateDatabase(await storage.load(), root);
    },
    async save(db) {
      const next = structuredClone(db);
      for (const {tenant, file} of attachments(next)) {
        if (!file.data) continue;
        const bytes = Buffer.from(file.data, 'base64'),
          sha = hash(bytes);
        if (file.sha256 && sha !== file.sha256) throw Error('Integridade do anexo não confirmada.');
        const target = location(tenant, sha);
        await fs.mkdir(path.dirname(target), {recursive: true, mode: 0o700});
        try {
          await fs.access(target);
        } catch {
          const tmp = target + '.' + randomUUID();
          await fs.writeFile(tmp, bytes, {mode: 0o600, flag: 'wx'});
          await fs.rename(tmp, target);
        }
        file.sha256 = sha;
        file.blob = sha;
        delete file.data;
      }
      const saved = await storage.save(next);
      // A gravação já valeu: uma falha na limpeza fica no log e não vira erro para quem salvou.
      try {
        await sweep(next);
      } catch (e) {
        console.error('Limpeza de arquivos privados não concluída:', e.code || e.message);
      }
      return saved;
    },
    close: () => storage.close(),
  };
}

export async function hydratePrivateDatabase(db, directory) {
  const root = path.resolve(directory);
  for (const {tenant, file} of attachments(db)) {
    if (!file.blob) continue;
    if (!/^[a-f\d]{64}$/.test(file.blob) || typeof tenant !== 'string')
      throw Error('Referência de arquivo inválida.');
    const bytes = await fs.readFile(path.join(root, hash(Buffer.from(tenant)), file.blob));
    if (hash(bytes) !== file.sha256) throw Error('Integridade do arquivo privado não confirmada.');
    file.data = bytes.toString('base64');
    delete file.blob;
  }
  return db;
}
