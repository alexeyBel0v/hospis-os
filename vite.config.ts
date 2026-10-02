import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — чтобы сайт работал из подпапки на GitHub Pages (username.github.io/hospis-os/)
export default defineConfig({
  base: './',
  plugins: [react()],
});
