import type { IsoDate } from '../types/index.ts';
import { isIsoDate } from './dates.ts';

/**
 * Ключи доступа без сервера.
 *
 * Ключ = подпись строки «Telegram ID + дата окончания» секретным ключом администратора (ECDSA P-256).
 * В приложении лежит только открытый ключ: им можно проверить подпись, но нельзя создать новую.
 * Поэтому ключ нельзя подделать и нельзя передать другому аккаунту.
 *
 * Формат: HOS1-<telegramId>-<ГГГГММДД>-<подпись base64url>
 */

const PREFIX = 'HOS1';
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const;
const KEY_PATTERN = /^HOS1-(\d{1,20})-(\d{8})-([A-Za-z0-9_-]{40,})$/;

export type ParsedLicense = { telegramId: string; expiresOn: IsoDate; signature: Uint8Array<ArrayBuffer> };

export type LicenseCheck =
  | { ok: true; expiresOn: IsoDate }
  | { ok: false; reason: 'format' | 'signature' | 'other-account' }
  | { ok: false; reason: 'expired'; expiresOn: IsoDate };

const signedMessage = (telegramId: string, expiresOn: IsoDate): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(`hospis-os:v1:${telegramId}:${expiresOn}`);

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const compactToIso = (compact: string): IsoDate => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
const isoToCompact = (iso: IsoDate): string => iso.replace(/-/g, '');

/** Убирает пробелы и переносы, которые появляются при копировании из чата. */
export const normalizeLicenseKey = (raw: string): string => raw.replace(/\s+/g, '').trim();

export const parseLicenseKey = (raw: string): ParsedLicense | null => {
  const match = KEY_PATTERN.exec(normalizeLicenseKey(raw));
  if (!match) return null;
  const [, telegramId = '', compactDate = '', signatureText = ''] = match;
  const expiresOn = compactToIso(compactDate);
  if (!isIsoDate(expiresOn)) return null;
  try {
    return { telegramId, expiresOn, signature: fromBase64Url(signatureText) };
  } catch {
    return null;
  }
};

export const importLicensePublicKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', jwk, ALGORITHM, false, ['verify']);

type VerifyOptions = { publicKey: CryptoKey; telegramId: string; today: IsoDate };

export const verifyLicenseKey = async (raw: string, { publicKey, telegramId, today }: VerifyOptions): Promise<LicenseCheck> => {
  const parsed = parseLicenseKey(raw);
  if (!parsed) return { ok: false, reason: 'format' };
  const valid = await crypto.subtle
    .verify(SIGN_ALGORITHM, publicKey, parsed.signature, signedMessage(parsed.telegramId, parsed.expiresOn))
    .catch(() => false);
  if (!valid) return { ok: false, reason: 'signature' };
  if (parsed.telegramId !== telegramId) return { ok: false, reason: 'other-account' };
  if (parsed.expiresOn < today) return { ok: false, reason: 'expired', expiresOn: parsed.expiresOn };
  return { ok: true, expiresOn: parsed.expiresOn };
};

/** Создать ключ. Используется скриптом администратора `npm run key` и тестами — не приложением. */
export const signLicenseKey = async (privateKey: CryptoKey, telegramId: string, expiresOn: IsoDate): Promise<string> => {
  const signature = new Uint8Array(await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, signedMessage(telegramId, expiresOn)));
  return `${PREFIX}-${telegramId}-${isoToCompact(expiresOn)}-${toBase64Url(signature)}`;
};

export const generateLicenseKeyPair = (): Promise<CryptoKeyPair> =>
  crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
