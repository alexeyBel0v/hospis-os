import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Версия берётся из src/config.ts — одно место, где её меняют. */
const appVersion = (): string => {
  const config = readFileSync(new URL('./src/config.ts', import.meta.url), 'utf8');
  return /APP_VERSION\s*=\s*'([^']+)'/.exec(config)?.[1] ?? '0.0.0';
};

/**
 * Кладёт рядом с сайтом version.json. Приложение при открытии сверяет с ним свою версию
 * и, если на сайте уже новая, предлагает обновиться (Telegram любит держать старую копию в кэше).
 */
const versionFile = (): Plugin => ({
  name: 'hospis-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: appVersion() }) });
  },
});

// base: './' — чтобы сайт работал из подпапки на GitHub Pages (username.github.io/hospis-os/)
export default defineConfig({
  base: './',
  plugins: [react(), versionFile()],
});
