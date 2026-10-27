import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PRODUCTION_API_BASE_URL =
  'https://adaptive-ecommerce-orchestration.onrender.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const resolvedProdUrl =
    (env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || '').trim() ||
    (mode === 'production' ? PRODUCTION_API_BASE_URL : '');

  return {
    plugins: [react()],
    ...(resolvedProdUrl
      ? {
          define: {
            'import.meta.env.VITE_API_BASE_URL':
              JSON.stringify(resolvedProdUrl),
          },
        }
      : {}),
    server: {
      port: 5173,
      open: false,
    },
  };
});
