import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

/**
 * A tela fala com a API pela MESMA origem (`/api/v1`): o cookie de sessão é host-only e a API confere a origem.
 * Em desenvolvimento e na prévia, o Vite repassa `/api` para a API local; em produção quem faz isso é o proxy.
 */
const api = process.env.VZ_API_URL || 'http://127.0.0.1:3100';
const proxy = {'/api': {target: api, changeOrigin: false}};

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {host: '127.0.0.1', port: 5173, strictPort: true, proxy},
  preview: {host: '127.0.0.1', port: Number(process.env.VZ_WEB_PORT || 4173), strictPort: true, proxy},
  build: {target: 'es2022', sourcemap: true},
});
