// Сменить ключ доступа: npm run access -- новыйключ
// В приложение записывается только отпечаток ключа (SHA-256), сам ключ в коде не хранится.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'src', 'config.ts');
const accessKey = (process.argv[2] ?? '').trim();

if (accessKey.length < 4) {
  console.error('\n⛔ Укажите новый ключ (не короче 4 символов).\n   Пример: npm run access -- hospis-2026\n');
  process.exit(1);
}

const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hospis-os:' + accessKey)));
const hash = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const source = readFileSync(configPath, 'utf8')
  .replace(/export const ACCESS_KEY_HASH = '[0-9a-f]*';/, `export const ACCESS_KEY_HASH = '${hash}';`);
writeFileSync(configPath, source);

console.log(`
✅ Ключ доступа сменён на «${accessKey}».

   Опубликуйте обновление (загрузите изменения на GitHub) — после этого
   у всех попросит новый ключ. Выдайте его сотрудникам.
`);
