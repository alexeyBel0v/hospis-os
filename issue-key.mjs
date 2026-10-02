// Выдать ключ доступа: npm run key -- <TelegramID> <срок>
// Срок: дата 2026-12-31, число дней +30, или forever (бессрочно).
// Формат ключа совпадает с src/lib/license.ts.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const privatePath = join(root, 'admin-keys', 'private-key.json');

const fail = (message) => {
  console.error(`\n⛔ ${message}\n`);
  process.exit(1);
};

const [telegramId, term = '+30'] = process.argv.slice(2);

if (!existsSync(privatePath)) fail('Сначала создайте ключи: npm run keys:init');
if (!telegramId || !/^\d{1,20}$/.test(telegramId)) {
  fail('Укажите Telegram ID цифрами.\n   Пример: npm run key -- 123456789 +30');
}

const pad = (n) => String(n).padStart(2, '0');
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const resolveExpiry = (value) => {
  if (value === 'forever') return '2099-12-31';
  if (/^\+\d{1,4}$/.test(value)) {
    const date = new Date();
    date.setDate(date.getDate() + Number(value.slice(1)));
    return toIso(date);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value;
  return fail('Срок: дата 2026-12-31, число дней +30 или forever.');
};

const expiresOn = resolveExpiry(term);
const privateKey = await crypto.subtle.importKey(
  'jwk',
  JSON.parse(readFileSync(privatePath, 'utf8')),
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign'],
);
const message = new TextEncoder().encode(`hospis-os:v1:${telegramId}:${expiresOn}`);
const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, message));
const base64url = btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const key = `HOS1-${telegramId}-${expiresOn.replace(/-/g, '')}-${base64url}`;

const [year, month, day] = expiresOn.split('-');
console.log(`
✅ Ключ для Telegram ID ${telegramId}, действует до ${day}.${month}.${year} включительно:

${key}

Отправьте ключ человеку целиком. На другом аккаунте Telegram он не сработает.
`);
