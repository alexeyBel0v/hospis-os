import { describe, expect, it } from 'vitest';
import type { AppData } from '../types/index.ts';
import { addPatient, createEmptyData, emptyPatientInput } from './patients.ts';
import { CHUNK_SIZE, createChunkedStore, createSaveQueue, splitIntoChunks, type KeyValueStore } from './storage.ts';

const createMemoryKv = () => {
  const items = new Map<string, string>();
  let failOnWrite = false;
  const kv: KeyValueStore = {
    getItems: async (keys) => Object.fromEntries(keys.map((key) => [key, items.get(key) ?? ''])),
    setItem: async (key, value) => {
      if (failOnWrite) throw new Error('нет связи');
      if (value.length > 4096) throw new Error('слишком длинное значение');
      items.set(key, value);
    },
    removeItems: async (keys) => {
      keys.forEach((key) => items.delete(key));
    },
  };
  return { kv, items, setFailOnWrite: (value: boolean) => (failOnWrite = value) };
};

const bigData = (count: number): AppData => {
  let data = createEmptyData();
  for (let i = 0; i < count; i += 1) {
    data = addPatient(data, {
      ...emptyPatientInput('2026-10-01'),
      fullName: `Пациентова Анна Сергеевна ${i}`,
      address: 'г. Москва, ул. Длинная-Предлинная, д. 150, корп. 3, кв. 47, подъезд 2, код домофона 47К',
      phones: [{ number: '+7 903 578-73-78', who: 'Дочь Мария, звонить после 18:00' }],
      policy: '7700123456789012',
      comment: 'Комментарий с кириллицей и «кавычками», чтобы проверить длину частей.',
      catheter: { type: i % 2 === 0 ? 'urinary' : 'none', size: i % 2 === 0 ? 16 : null, note: '', installedOn: '' },
      wounds: { sacrum: 2, heelL: 1 },
    }).data;
  }
  return data;
};

describe('splitIntoChunks', () => {
  it('режет строку на части заданной длины', () => {
    expect(splitIntoChunks('абвгд', 2)).toEqual(['аб', 'вг', 'д']);
  });
});

describe('createChunkedStore', () => {
  it('сохраняет и загружает большие данные частями', async () => {
    const { kv, items } = createMemoryKv();
    const store = createChunkedStore(kv);
    const data = bigData(60);
    await store.save({ data, savedAt: '2026-09-29T10:00:00.000Z' });

    expect(JSON.stringify(data).length).toBeGreaterThan(CHUNK_SIZE * 3);
    expect([...items.values()].every((value) => value.length <= 4096)).toBe(true);

    const loaded = await createChunkedStore(kv).load();
    expect(loaded?.data).toEqual(data);
    expect(loaded?.savedAt).toBe('2026-09-29T10:00:00.000Z');
  });

  it('пустое хранилище → null', async () => {
    expect(await createChunkedStore(createMemoryKv().kv).load()).toBeNull();
  });

  it('чередует поколения и удаляет старые части', async () => {
    const { kv, items } = createMemoryKv();
    const store = createChunkedStore(kv);
    const latest = bigData(2);
    await store.save({ data: bigData(30), savedAt: '1' });
    await store.save({ data: latest, savedAt: '2' });
    const keys = [...items.keys()];
    expect(keys.some((key) => key.startsWith('hospis_a_'))).toBe(false);
    expect(keys.filter((key) => key.startsWith('hospis_b_'))).toHaveLength(1);
    expect((await createChunkedStore(kv).load())?.data).toEqual(latest);
  });

  it('оборванная запись не портит предыдущую версию', async () => {
    const { kv, setFailOnWrite } = createMemoryKv();
    const store = createChunkedStore(kv);
    const first = bigData(5);
    await store.save({ data: first, savedAt: '1' });
    setFailOnWrite(true);
    await expect(store.save({ data: bigData(10), savedAt: '2' })).rejects.toThrow('нет связи');
    setFailOnWrite(false);
    expect((await createChunkedStore(kv).load())?.data).toEqual(first);
  });

  it('очищает всё', async () => {
    const { kv, items } = createMemoryKv();
    const store = createChunkedStore(kv);
    await store.save({ data: bigData(10), savedAt: '1' });
    await store.clear();
    expect(items.size).toBe(0);
  });
});

describe('createSaveQueue', () => {
  it('пока идёт запись, сохраняет только последнюю версию', async () => {
    const saved: number[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const save = createSaveQueue(async (data) => {
      if (saved.length === 0) await gate;
      saved.push(data.patients.length);
    });
    const runs = [save(bigData(1)), save(bigData(2)), save(bigData(3))];
    release();
    await Promise.all(runs);
    expect(saved).toEqual([1, 3]);
  });
});
