// Однократная настройка ключей доступа: `npm run keys:init`
// Создаёт секретный ключ администратора (admin-keys/private-key.json)
// и вписывает открытый ключ в приложение (src/lib/licensePublicKey.ts).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const privatePath = join(root, 'admin-keys', 'private-key.json');
const publicPath = join(root, 'src', 'lib', 'licensePublicKey.ts');

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  console.error('\n⛔ Ключи уже созданы: admin-keys/private-key.json');
  console.error('   Если создать новые, все выданные ключи перестанут работать.');
  console.error('   Если вы точно этого хотите: npm run keys:init -- --force\n');
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);

mkdirSync(dirname(privatePath), { recursive: true });
writeFileSync(privatePath, JSON.stringify(privateJwk, null, 2));
writeFileSync(
  publicPath,
  `// Этот файл создаёт команда \`npm run keys:init\`. Вручную не редактировать.
// null — доступ по ключам ещё не настроен, приложение открыто всем.
export const LICENSE_PUBLIC_KEY: JsonWebKey | null = ${JSON.stringify({ kty, crv, x, y })};
`,
);

console.log(`
✅ Ключи доступа созданы.

   Секретный ключ: admin-keys/private-key.json
   • Никому не отправляйте и не загружайте на GitHub (папка уже в .gitignore).
   • Сохраните копию файла (флешка, личное облако). Потеряете — придётся перевыпускать все ключи.

   Теперь приложение открывается только по ключу. Выдайте ключ себе:
   npm run key -- ВАШ_TELEGRAM_ID forever
   (ваш ID покажет экран входа в приложении)
`);
