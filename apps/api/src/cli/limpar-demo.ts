import {Pool} from 'pg';
import {cleanDemoData, describeCleanup} from '../seed/limpar-demo.js';

/**
 * Limpa a base de TESTE (ADR-0011 §2): apaga os condomínios de demonstração e as contas de teste, nunca o que é de
 * sandbox ou produção. Roda como o papel DONO (`DATABASE_OWNER_URL`, como as migrations) e recusa
 * `VILAZUNI_ENV=production`. Sem `--apagar`, só mostra o que seria apagado.
 */
async function main() {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error('Defina DATABASE_OWNER_URL (papel dono das tabelas).');
  // o ambiente precisa estar ESCRITO: sem ele, não dá para saber se é produção
  const env = process.env.VILAZUNI_ENV;
  if (env !== 'demo' && env !== 'sandbox')
    throw new Error('Defina VILAZUNI_ENV=demo ou sandbox. A limpeza nunca roda em produção.');
  const pool = new Pool({connectionString: url, max: 1});
  try {
    const report = await cleanDemoData(pool, {env, apply: process.argv.includes('--apagar')});
    console.log(describeCleanup(report));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na limpeza da base de teste.');
  process.exit(1);
});
