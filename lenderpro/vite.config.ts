import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Necesario para entornos en la nube como IDX/Docker
    port: 3000
  }
});