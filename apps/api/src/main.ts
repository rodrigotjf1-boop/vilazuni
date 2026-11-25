import {createApp} from './bootstrap.js';
import {loadConfig} from './config.js';

async function main() {
  const config = loadConfig();
  const app = await createApp(config, {}, {webDir: process.env.VILAZUNI_WEB_DIR});
  await app.listen(config.PORT, '0.0.0.0');
  console.log(`Vilazuni API ouvindo na porta ${config.PORT} (ambiente ${config.VILAZUNI_ENV}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao iniciar a API.');
  process.exit(1);
});
