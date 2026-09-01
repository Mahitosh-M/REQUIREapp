import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase is the only large shared dependency; its 561 kB minified chunk is 167 kB gzip.
    chunkSizeWarningLimit: 600
  },
  server: {
    host: '0.0.0.0'
  }
});
