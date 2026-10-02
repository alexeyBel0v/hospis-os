/**
 * Тонкая обёртка над Telegram WebApp API.
 * Остальной код не обращается к window.Telegram напрямую — только через эти функции.
 */

type Callback<T extends unknown[]> = (...args: T) => void;

export type TelegramCloudStorage = {
  setItem: (key: string, value: string, callback?: Callback<[Error | string | null, boolean?]>) => void;
  getItems: (keys: string[], callback: Callback<[Error | string | null, Record<string, string>?]>) => void;
  removeItems: (keys: string[], callback?: Callback<[Error | string | null, boolean?]>) => void;
};

type TelegramUser = { id: number; first_name: string; last_name?: string; username?: string };

type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  version: string;
  colorScheme: 'light' | 'dark';
  isVersionAtLeast: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent: (event: string, handler: () => void) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
  HapticFeedback?: {
    notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
    selectionChanged: () => void;
  };
  CloudStorage?: TelegramCloudStorage;
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** WebApp, только если приложение действительно открыто внутри Telegram. */
export const getTelegram = (): TelegramWebApp | null => {
  if (typeof window === 'undefined') return null;
  const webApp = window.Telegram?.WebApp;
  return webApp && webApp.initData ? webApp : null;
};

export const isInsideTelegram = (): boolean => getTelegram() !== null;

type Scheme = 'light' | 'dark';
type ThemeChoice = 'telegram' | 'light' | 'dark';

const SCHEME_COLORS: Record<Scheme, string> = { light: '#F2F4F5', dark: '#0F1519' };

let themeChoice: ThemeChoice = 'telegram';
let systemScheme: Scheme = 'light';

const applyScheme = () => {
  const scheme: Scheme = themeChoice === 'telegram' ? systemScheme : themeChoice;
  document.documentElement.dataset.theme = scheme;
  const tg = getTelegram();
  if (tg && tg.isVersionAtLeast('6.1')) {
    tg.setHeaderColor?.(SCHEME_COLORS[scheme]);
    tg.setBackgroundColor?.(SCHEME_COLORS[scheme]);
  }
};

/** Тема из настроек: «как в Telegram» (или в системе вне Telegram), светлая или тёмная. */
export const setThemeChoice = (choice: ThemeChoice) => {
  themeChoice = choice;
  applyScheme();
};

let hapticsEnabled = true;
export const setHapticsEnabled = (enabled: boolean) => {
  hapticsEnabled = enabled;
};

export const initTelegram = () => {
  const tg = getTelegram();
  if (!tg) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    systemScheme = media.matches ? 'dark' : 'light';
    media.addEventListener('change', (event) => {
      systemScheme = event.matches ? 'dark' : 'light';
      applyScheme();
    });
    applyScheme();
    return;
  }
  tg.ready();
  tg.expand();
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
  systemScheme = tg.colorScheme;
  tg.onEvent('themeChanged', () => {
    systemScheme = tg.colorScheme;
    applyScheme();
  });
  applyScheme();
};

export const getCloudStorage = (): TelegramCloudStorage | null => {
  const tg = getTelegram();
  return tg && tg.isVersionAtLeast('6.9') && tg.CloudStorage ? tg.CloudStorage : null;
};

export const getTelegramUser = (): TelegramUser | null => getTelegram()?.initDataUnsafe.user ?? null;

/** Открыть внешнюю ссылку (карты и т.п.): в Telegram — через встроенный браузер. */
export const openExternalLink = (url: string) => {
  const tg = getTelegram();
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
};

/** Позвонить: tel:-ссылка. */
export const callPhone = (number: string) => {
  window.location.href = `tel:${number.replace(/[^\d+]/g, '')}`;
};

/** Открыть ссылку t.me внутри Telegram (чат с администратором). */
export const openTelegramChat = (url: string) => {
  const tg = getTelegram();
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
};

export const hapticSuccess = () => {
  if (hapticsEnabled) getTelegram()?.HapticFeedback?.notificationOccurred('success');
};
export const hapticSelection = () => {
  if (hapticsEnabled) getTelegram()?.HapticFeedback?.selectionChanged();
};
export const hapticError = () => {
  if (hapticsEnabled) getTelegram()?.HapticFeedback?.notificationOccurred('error');
};

/** Нативное окно подтверждения Telegram, вне Telegram — обычный confirm браузера. */
export const confirmAction = (message: string): Promise<boolean> => {
  const tg = getTelegram();
  if (tg?.showConfirm && tg.isVersionAtLeast('6.2')) {
    return new Promise((resolve) => tg.showConfirm?.(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
};

// Кнопка «Назад» в шапке Telegram одна на всё приложение, поэтому обработчики складываются в стек:
// срабатывает самый верхний (например, сначала закрывается шторка, потом экран пациента).
const backHandlers: Array<() => void> = [];
let backButtonBound = false;

const syncBackButton = (tg: TelegramWebApp) => {
  if (backHandlers.length > 0) tg.BackButton.show();
  else tg.BackButton.hide();
};

export const pushBackHandler = (handler: () => void): (() => void) => {
  const tg = getTelegram();
  if (!tg) return () => {};
  if (!backButtonBound) {
    tg.BackButton.onClick(() => backHandlers[backHandlers.length - 1]?.());
    backButtonBound = true;
  }
  backHandlers.push(handler);
  syncBackButton(tg);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
    syncBackButton(tg);
  };
};
