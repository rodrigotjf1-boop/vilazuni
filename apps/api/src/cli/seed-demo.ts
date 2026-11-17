import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {Pool} from 'pg';
import {loadConfig} from '../config.js';
import {seedDemoChandra} from '../seed/demo-chandra.js';

/**
 * Semeia o Chandra DEMONSTRATIVO. Recusa fora de VILAZUNI_ENV=demo e em banco com pessoas reais.
 * As senhas geradas vão para `.demo/credenciais-chandra.txt` (fora do git) e para a tela — só desta vez.
 * `--redefinir-senhas` gera senhas novas para as contas demonstrativas que já existem.
 */
async function main() {
  const config = loadConfig();
  const pool = new Pool({connectionString: config.DATABASE_URL, max: 2});
  try {
    const result = await seedDemoChandra(pool, {
      env: config.VILAZUNI_ENV,
      resetPasswords: process.argv.includes('--redefinir-senhas'),
    });
    console.log(
      result.created
        ? 'Condomínio demonstrativo criado.'
        : 'Condomínio demonstrativo já existia (nada duplicado).',
    );
    if (!result.credentials.length) {
      console.log(
        'Nenhuma senha nova. Para gerar de novo: npm run seed:demo -w @vilazuni/api -- --redefinir-senhas',
      );
      return;
    }
    const linhas = [
      '# Credenciais DEMONSTRATIVAS do Chandra — pessoas fictícias, só para ambiente de demonstração.',
      `# Geradas em ${new Date().toISOString()}. Não reutilize estas senhas em lugar nenhum.`,
      '# Síndica e subsíndica precisam configurar a verificação em duas etapas no primeiro acesso de gestão.',
      '',
      ...result.credentials.map((c) => `${c.email}\t${c.password}\t${c.name} — ${c.papel}`),
      '',
    ];
    const dir = path.resolve(process.cwd(), '.demo');
    mkdirSync(dir, {recursive: true});
    const file = path.join(dir, 'credenciais-chandra.txt');
    writeFileSync(file, linhas.join('\n'), {encoding: 'utf8', mode: 0o600});
    console.log(linhas.join('\n'));
    console.log(`Gravado em ${file}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na semeadura demonstrativa.');
  process.exit(1);
});
