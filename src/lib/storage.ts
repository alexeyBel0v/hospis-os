import type { AppData } from '../types/index.ts';
import { parseAppDataJson } from './appData.ts';
import { createEmptyData } from './patients.ts';
import { getCloudStorage, type TelegramCloudStorage } from './telegram.ts';

/**
 * Хранилище данных.
 *
 * В Telegram данные лежат в CloudStorage (облако Telegram, привязано к аккаунту).
 * У CloudStorage лимит ~4096 символов на ключ, поэтому JSON режется на части.
 * Части пишутся в «поколение» a или b по очереди, а ключ meta переключается последним —
 * если запись оборвётся на середине, останется целая предыдущая версия.
 *
 * Дополнительно на телефоне хранится копия (localStorage), чтобы приложение открывалось без связи.
 * Вне Telegram (проверка в браузере) используется только эта локальная копия.
 */

export type KeyValueStore = {
  getItems: (keys: string[]) => Promise<Record<string, string>>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItems: (keys: string[]) => Promise<void>;
};

export type Snapshot = { data: AppData; savedAt: string };

export const CHUNK_SIZE = 3000;
const META_KEY = 'hospis_meta';
const LOCAL_CACHE_KEY = 'hospis_local_copy';
const CLOUD_TIMEOUT_MS = 8000;
const READ_BATCH_SIZE = 20;

type Generation = 'a' | 'b';
type Meta = { generation: Generation; chunkCount: number; savedAt: string };

const chunkKey = (generation: Generation, index: number): string => `hospis_${generation}_${index}`;
const chunkKeys = (meta: Meta): string[] =>
  Array.from({ length: meta.chunkCount }, (_, index) => chunkKey(meta.generation, index));

export const splitIntoChunks = (text: string, size: number): string[] => {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += size) chunks.push(text.slice(start, start + size));
  return chunks.length > 0 ? chunks : [''];
};

const parseMeta = (raw: string | undefined): Meta | null => {
  if (!raw) return null;
  try {
    const meta: unknown = JSON.parse(raw);
    if (typeof meta !== 'object' || meta === null) return null;
    const { generation, chunkCount, savedAt } = meta as Record<string, unknown>;
    if ((generation !== 'a' && generation !== 'b') || typeof chunkCount !== 'number' || typeof savedAt !== 'string') {
      return null;
    }
    return { generation, chunkCount, savedAt };
  } catch {
    return null;
  }
};

const getItemsBatched = async (kv: KeyValueStore, keys: string[]): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  for (let start = 0; start < keys.length; start += READ_BATCH_SIZE) {
    Object.assign(result, await kv.getItems(keys.slice(start, start + READ_BATCH_SIZE)));
  }
  return result;
};

export type ChunkedStore = {
  load: () => Promise<Snapshot | null>;
  save: (snapshot: Snapshot) => Promise<void>;
  clear: () => Promise<void>;
};

export const createChunkedStore = (kv: KeyValueStore): ChunkedStore => {
  let currentMeta: Meta | null = null;
  let metaKnown = false;

  const readMeta = async (): Promise<Meta | null> => {
    currentMeta = parseMeta((await kv.getItems([META_KEY]))[META_KEY]);
    metaKnown = true;
    return currentMeta;
  };

  const load = async (): Promise<Snapshot | null> => {
    const meta = await readMeta();
    if (!meta) return null;
    const keys = chunkKeys(meta);
    const values = await getItemsBatched(kv, keys);
    const text = keys
      .map((key) => {
        const value = values[key];
        if (!value) throw new Error('Часть данных в облаке не найдена.');
        return value;
      })
      .join('');
    return { data: parseAppDataJson(text), savedAt: meta.savedAt };
  };

  const save = async ({ data, savedAt }: Snapshot): Promise<void> => {
    const previous = metaKnown ? currentMeta : await readMeta();
    const generation: Generation = previous?.generation === 'a' ? 'b' : 'a';
    const chunks = splitIntoChunks(JSON.stringify(data), CHUNK_SIZE);
    for (const [index, chunk] of chunks.entries()) await kv.setItem(chunkKey(generation, index), chunk);

    const meta: Meta = { generation, chunkCount: chunks.length, savedAt };
    await kv.setItem(META_KEY, JSON.stringify(meta));
    currentMeta = meta;
    metaKnown = true;

    if (previous) await kv.removeItems(chunkKeys(previous)).catch(() => undefined);
  };

  const clear = async (): Promise<void> => {
    const meta = metaKnown ? currentMeta : await readMeta();
    await kv.removeItems([META_KEY, ...(meta ? chunkKeys(meta) : [])]);
    currentMeta = null;
    metaKnown = true;
  };

  return { load, save, clear };
};

const withTimeout = <T>(promise: Promise<T>, message: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), CLOUD_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const toError = (error: Error | string): Error => (error instanceof Error ? error : new Error(String(error)));

export const createTelegramKv = (cloud: TelegramCloudStorage): KeyValueStore => ({
  getItems: (keys) =>
    withTimeout(
      new Promise((resolve, reject) =>
        cloud.getItems(keys, (error, values) => (error ? reject(toError(error)) : resolve(values ?? {}))),
      ),
      'Облако Telegram не ответило.',
    ),
  setItem: (key, value) =>
    withTimeout(
      new Promise((resolve, reject) => cloud.setItem(key, value, (error) => (error ? reject(toError(error)) : resolve()))),
      'Облако Telegram не ответило.',
    ),
  removeItems: (keys) =>
    withTimeout(
      new Promise((resolve, reject) => cloud.removeItems(keys, (error) => (error ? reject(toError(error)) : resolve()))),
      'Облако Telegram не ответило.',
    ),
});

const createLocalCopy = () => ({
  read: (): Snapshot | null => {
    try {
      const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt?: unknown; data?: unknown };
      if (typeof parsed.savedAt !== 'string') return null;
      return { savedAt: parsed.savedAt, data: parseAppDataJson(JSON.stringify(parsed.data)) };
    } catch {
      return null;
    }
  },
  write: (snapshot: Snapshot): boolean => {
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(LOCAL_CACHE_KEY);
    } catch {
      // localStorage может быть недоступен — тогда и чистить нечего
    }
  },
});

export type StorageKind = 'telegram' | 'browser';

export type LoadResult = {
  data: AppData;
  /** Сообщение для пользователя, если данные загружены не из основного места. */
  notice: string | null;
  /** Локальная копия новее облака — её нужно отправить в облако. */
  needsSync: boolean;
};

export type AppStorage = {
  kind: StorageKind;
  load: () => Promise<LoadResult>;
  save: (data: AppData) => Promise<void>;
  clear: () => Promise<void>;
};

const createBrowserStorage = (): AppStorage => {
  const local = createLocalCopy();
  return {
    kind: 'browser',
    load: async () => ({ data: local.read()?.data ?? createEmptyData(), notice: null, needsSync: false }),
    save: async (data) => {
      if (!local.write({ data, savedAt: new Date().toISOString() })) {
        throw new Error('Браузер не дал сохранить данные.');
      }
    },
    clear: async () => local.clear(),
  };
};

const createTelegramStorage = (cloud: TelegramCloudStorage): AppStorage => {
  const remote = createChunkedStore(createTelegramKv(cloud));
  const local = createLocalCopy();

  return {
    kind: 'telegram',
    load: async () => {
      const localSnapshot = local.read();
      try {
        const remoteSnapshot = await remote.load();
        if (localSnapshot && (!remoteSnapshot || localSnapshot.savedAt > remoteSnapshot.savedAt)) {
          return { data: localSnapshot.data, notice: null, needsSync: true };
        }
        if (remoteSnapshot) {
          local.write(remoteSnapshot);
          return { data: remoteSnapshot.data, notice: null, needsSync: false };
        }
        return { data: createEmptyData(), notice: null, needsSync: false };
      } catch (error) {
        if (!localSnapshot) throw error;
        return {
          data: localSnapshot.data,
          notice: 'Нет связи с облаком Telegram. Показаны данные, сохранённые на телефоне.',
          needsSync: true,
        };
      }
    },
    save: async (data) => {
      const snapshot = { data, savedAt: new Date().toISOString() };
      local.write(snapshot);
      await remote.save(snapshot);
    },
    clear: async () => {
      local.clear();
      await remote.clear();
    },
  };
};

export const createAppStorage = (): AppStorage => {
  const cloud = getCloudStorage();
  return cloud ? createTelegramStorage(cloud) : createBrowserStorage();
};

/** Сохраняет только последнюю версию: если пока идёт запись пришли новые изменения, промежуточные пропускаются. */
export const createSaveQueue = (save: (data: AppData) => Promise<void>) => {
  let pending: AppData | null = null;
  let running: Promise<void> | null = null;

  const drain = async () => {
    while (pending) {
      const next = pending;
      pending = null;
      await save(next);
    }
  };

  return (data: AppData): Promise<void> => {
    pending = data;
    running ??= drain().finally(() => {
      running = null;
    });
    return running;
  };
};

const LICENSE_KEY_NAME = 'hospis_license';

/** Ключ доступа: хранится в облаке Telegram (переживёт смену телефона) и копией на устройстве. */
export const licenseKeyStore = {
  load: async (): Promise<string | null> => {
    const cloud = getCloudStorage();
    if (cloud) {
      try {
        const value = (await createTelegramKv(cloud).getItems([LICENSE_KEY_NAME]))[LICENSE_KEY_NAME];
        if (value) return value;
      } catch {
        // нет связи — пробуем копию на устройстве
      }
    }
    try {
      return window.localStorage.getItem(LICENSE_KEY_NAME);
    } catch {
      return null;
    }
  },
  save: async (key: string): Promise<void> => {
    try {
      window.localStorage.setItem(LICENSE_KEY_NAME, key);
    } catch {
      // не критично: основное место — облако
    }
    const cloud = getCloudStorage();
    if (cloud) await createTelegramKv(cloud).setItem(LICENSE_KEY_NAME, key);
  },
};
