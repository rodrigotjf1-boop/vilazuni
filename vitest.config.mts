import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    // Os pacotes do monorepo são lidos pelo código-fonte nos testes (sem precisar compilar antes).
    conditions: ['development'],
  },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {name: 'regras', include: ['packages/*/src/**/*.test.ts']},
      },
      {
        extends: true,
        // regras puras das telas (as telas inteiras são conferidas no navegador: npm run e2e)
        test: {name: 'web', include: ['apps/web/src/**/*.test.ts']},
      },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['apps/api/test/**/*.test.ts'],
          // Banco novo e descartável por rodada, no Postgres de verdade.
          globalSetup: ['apps/api/test/global-setup.ts'],
        },
      },
    ],
  },
});
