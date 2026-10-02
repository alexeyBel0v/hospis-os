import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types/index.ts';
import { createEmptyData } from '../lib/patients.ts';
import { createAppStorage, createSaveQueue, type StorageKind } from '../lib/storage.ts';

export type SaveState = 'saved' | 'saving' | 'error';

type AppDataContextValue = {
  data: AppData;
  storageKind: StorageKind;
  saveState: SaveState;
  notice: string | null;
  /** Изменить данные. Сохранение происходит автоматически. */
  update: (change: (data: AppData) => AppData) => void;
  replaceAll: (data: AppData) => void;
  clearAll: () => Promise<void>;
};

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

const AppDataContext = createContext<AppDataContextValue | null>(null);

const SAVE_DELAY_MS = 400;
const RETRY_DELAY_MS = 15_000;

export const AppDataProvider = ({ children }: { children: (loadState: LoadState) => ReactNode }) => {
  const storage = useMemo(createAppStorage, []);
  const saveLatest = useMemo(() => createSaveQueue(storage.save), [storage]);

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [data, setData] = useState<AppData>(createEmptyData);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [notice, setNotice] = useState<string | null>(null);

  const dataRef = useRef(data);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    saveLatest(dataRef.current).then(
      () => {
        setSaveState(dirtyRef.current ? 'saving' : 'saved');
        setNotice(null);
      },
      () => {
        dirtyRef.current = true;
        setSaveState('error');
        timerRef.current = window.setTimeout(flush, RETRY_DELAY_MS);
      },
    );
  }, [saveLatest]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState('saving');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  const load = useCallback(() => {
    setLoadState({ status: 'loading' });
    storage.load().then(
      (result) => {
        dataRef.current = result.data;
        setData(result.data);
        setNotice(result.notice);
        setLoadState({ status: 'ready' });
        if (result.needsSync) scheduleSave();
      },
      (error: unknown) =>
        setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить данные.' }),
    );
  }, [storage, scheduleSave]);

  useEffect(load, [load]);

  // Сохранить сразу, когда приложение сворачивают, и повторить, когда появилась связь.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', flush);
    };
  }, [flush]);

  const update = useCallback(
    (change: (current: AppData) => AppData) => {
      const next = change(dataRef.current);
      dataRef.current = next;
      setData(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceAll = useCallback((next: AppData) => update(() => next), [update]);

  const clearAll = useCallback(async () => {
    window.clearTimeout(timerRef.current);
    dirtyRef.current = false;
    await storage.clear();
    const empty = { ...createEmptyData(), settings: dataRef.current.settings };
    dataRef.current = empty;
    setData(empty);
    setSaveState('saved');
  }, [storage]);

  const value = useMemo<AppDataContextValue>(
    () => ({ data, storageKind: storage.kind, saveState, notice, update, replaceAll, clearAll }),
    [data, storage.kind, saveState, notice, update, replaceAll, clearAll],
  );

  return <AppDataContext.Provider value={value}>{children(loadState)}</AppDataContext.Provider>;
};

export const useAppData = (): AppDataContextValue => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData должен вызываться внутри AppDataProvider');
  return context;
};
