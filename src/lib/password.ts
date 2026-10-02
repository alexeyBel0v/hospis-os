import { ACCESS_KEY_HASH } from '../config.ts';
import { createTelegramKv } from './storage.ts';
import { getCloudStorage } from './telegram.ts';

/**
 * Вход по ключу доступа.
 * Ключ один для всех, его выдаёт администратор. Введённый ключ запоминается (в облаке Telegram и на телефоне).
 * Когда администратор меняет ключ (новый отпечаток в config.ts), старый перестаёт подходить и приложение попросит новый.
 */

const ACCESS_STORE_KEY = 'hospis_access';

export type AccessRecord = { hash: string };

const SALT = 'hospis-os:';

export const hashAccessKey = async (key: string): Promise<string> => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + key.trim())));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const isAccessValid = (record: AccessRecord | null, expectedHash = ACCESS_KEY_HASH): boolean =>
  record !== null && record.hash === expectedHash;

const parseRecord = (raw: string | null | undefined): AccessRecord | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { hash } = value as Record<string, unknown>;
    return typeof hash === 'string' ? { hash } : null;
  } catch {
    return null;
  }
};

export const accessStore = {
  load: async (): Promise<AccessRecord | null> => {
    const cloud = getCloudStorage();
    if (cloud) {
      try {
        const record = parseRecord((await createTelegramKv(cloud).getItems([ACCESS_STORE_KEY]))[ACCESS_STORE_KEY]);
        if (record) return record;
      } catch {
        // нет связи — пробуем копию на телефоне
      }
    }
    try {
      return parseRecord(window.localStorage.getItem(ACCESS_STORE_KEY));
    } catch {
      return null;
    }
  },
  save: async (record: AccessRecord): Promise<void> => {
    const raw = JSON.stringify(record);
    try {
      window.localStorage.setItem(ACCESS_STORE_KEY, raw);
    } catch {
      // не критично
    }
    const cloud = getCloudStorage();
    if (cloud) await createTelegramKv(cloud).setItem(ACCESS_STORE_KEY, raw).catch(() => undefined);
  },
};
