import { useEffect, useState } from 'react';
import { APP_VERSION } from '../config.ts';

/** Как часто перепроверять, пока приложение открыто. */
const RECHECK_MS = 30 * 60 * 1000;

const fetchSiteVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'version' in body && typeof body.version === 'string') return body.version;
    return null;
  } catch {
    return null;
  }
};

/** Новая версия на сайте, если она отличается от запущенной. null — обновлять нечего (или нет сети). */
export const useUpdateCheck = (): string | null => {
  const [available, setAvailable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const version = await fetchSiteVersion();
      if (!cancelled && version && version !== APP_VERSION) setAvailable(version);
    };
    void check();
    const timer = window.setInterval(() => void check(), RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return available;
};

/** Перезагрузить с новой меткой в адресе — так WebView точно возьмёт свежий index.html. Данные не трогаются. */
export const reloadToVersion = (version: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('v', version);
  window.location.replace(url.toString());
};
