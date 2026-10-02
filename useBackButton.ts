import { useEffect, useRef } from 'react';
import { pushBackHandler } from '../lib/telegram.ts';

/** Подключает кнопку «Назад» Telegram, пока компонент на экране. `null` — кнопка не нужна. */
export const useBackButton = (onBack: (() => void) | null) => {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  const enabled = onBack !== null;

  useEffect(() => {
    if (!enabled) return;
    return pushBackHandler(() => handlerRef.current?.());
  }, [enabled]);
};
