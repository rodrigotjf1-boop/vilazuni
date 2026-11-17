import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    // Os pacotes do monorepo são lidos pelo código-fonte nos testes (sem precisar compilar antes).
    conditions: ['development'],
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    environment: 'node',
  },
});
