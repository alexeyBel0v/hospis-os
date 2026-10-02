import { useEffect, useState } from 'react';
import type { IsoDate } from '../types/index.ts';
import { todayIso } from '../lib/dates.ts';

const REFRESH_MS = 60_000;

/** Сегодняшняя дата, которая сама обновляется после полуночи и при возвращении в приложение. */
export const useToday = (): IsoDate => {
  const [today, setToday] = useState(todayIso);

  useEffect(() => {
    const refresh = () => setToday(todayIso());
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
};
