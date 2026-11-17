import {describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {avisosDoPg} from './support/api.js';

// Prova do detector usado pelos testes da API (ERR-023 do registro interno): consulta simultânea no MESMO cliente
// gera o aviso que vira erro no pg 9. Arquivo à parte — o aviso sai uma vez por processo.
describe('detector de consulta simultânea no mesmo cliente', () => {
  it('pega o Promise.all no mesmo cliente', async () => {
    const pool = new Pool({connectionString: inject('dbOwnerUrl'), max: 1});
    const client = await pool.connect();
    try {
      await Promise.all([client.query('select 1'), client.query('select 2')]);
      await new Promise((r) => setTimeout(r, 20));
      expect(avisosDoPg.length).toBeGreaterThan(0);
    } finally {
      client.release();
      await pool.end();
    }
  });
});
