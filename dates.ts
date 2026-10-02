import type { IsoDate } from '../types/index.ts';

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad2 = (value: number): string => String(value).padStart(2, '0');

// Арифметика дней идёт в UTC: так переход на летнее время и часовые пояса не сдвигают дату на ±1.
const toUtcMs = (iso: IsoDate): number => {
  const [year = NaN, month = NaN, day = NaN] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const fromUtcMs = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export const isIsoDate = (value: unknown): value is IsoDate => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const ms = toUtcMs(value);
  return !Number.isNaN(ms) && fromUtcMs(ms) === value;
};

/** Локальная дата устройства (часовой пояс телефона), а не UTC. */
export const toIsoDate = (date: Date): IsoDate =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const todayIso = (): IsoDate => toIsoDate(new Date());

export const addDays = (iso: IsoDate, days: number): IsoDate => fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);

/** Сколько дней от `from` до `to`: положительное — `to` позже. */
export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);

export const maxIsoDate = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b);
export const minIsoDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);

export const pluralRu = (count: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(count) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
};

/** Последний день месяца: «2026-10-31». */
export const endOfMonth = (iso: IsoDate): IsoDate => {
  const [year = 0, month = 1] = iso.split('-').map(Number);
  return fromUtcMs(Date.UTC(year, month, 0));
};

export const formatDays = (count: number): string => `${count} ${pluralRu(count, 'день', 'дня', 'дней')}`;

const parts = (iso: IsoDate) => {
  const date = new Date(toUtcMs(iso));
  return { day: date.getUTCDate(), month: date.getUTCMonth(), year: date.getUTCFullYear(), weekday: date.getUTCDay() };
};

/** «29 сентября, вторник» */
export const formatLongDate = (iso: IsoDate): string => {
  const { day, month, weekday } = parts(iso);
  return `${day} ${MONTHS_GENITIVE[month] ?? ''}, ${WEEKDAYS[weekday] ?? ''}`;
};

/** «1 октября» */
export const formatDayMonth = (iso: IsoDate): string => {
  const { day, month } = parts(iso);
  return `${day} ${MONTHS_GENITIVE[month] ?? ''}`;
};

/** «01.10, чт» */
export const formatShortDate = (iso: IsoDate): string => {
  const { day, month, weekday } = parts(iso);
  return `${pad2(day)}.${pad2(month + 1)}, ${WEEKDAYS_SHORT[weekday] ?? ''}`;
};

/** «2 окт» */
export const formatDayShortMonth = (iso: IsoDate): string => {
  const { day, month } = parts(iso);
  return `${day} ${MONTHS_SHORT[month] ?? ''}`;
};

/** «пт» */
export const formatWeekdayShort = (iso: IsoDate): string => WEEKDAYS_SHORT[parts(iso).weekday] ?? '';

/** «пятница» */
export const formatWeekday = (iso: IsoDate): string => WEEKDAYS[parts(iso).weekday] ?? '';

/** «октябрь» */
export const formatMonthName = (iso: IsoDate): string => MONTHS_NOMINATIVE[parts(iso).month] ?? '';

/** «01.10.2026» */
export const formatFullDate = (iso: IsoDate): string => {
  const { day, month, year } = parts(iso);
  return `${pad2(day)}.${pad2(month + 1)}.${year}`;
};

/** «сегодня», «завтра», «через 4 дня», «3 дня назад» */
export const formatRelativeDay = (iso: IsoDate, today: IsoDate): string => {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  if (diff === -1) return 'вчера';
  if (diff === -2) return 'позавчера';
  return diff > 0 ? `через ${formatDays(diff)}` : `${formatDays(-diff)} назад`;
};
