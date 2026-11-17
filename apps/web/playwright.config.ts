import {defineConfig, devices} from '@playwright/test';

/**
 * Ponta a ponta contra a aplicação de verdade: banco novo, migrations, semeadura demonstrativa, API compilada e a
 * prévia do app web (e2e/global-setup.ts). Os fluxos que mudam dados rodam uma vez (computador); o celular confere
 * as telas na largura de um telefone.
 */
const WEB = `http://127.0.0.1:${process.env.VZ_WEB_PORT || 4173}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {timeout: 8_000},
  reporter: [['list']],
  use: {baseURL: WEB, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure'},
  projects: [
    {name: 'computador', use: {...devices['Desktop Chrome']}, testIgnore: /celular\.spec\.ts/},
    {name: 'celular', use: {...devices['Pixel 7']}, testMatch: /celular\.spec\.ts/},
  ],
});
