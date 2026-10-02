import type { IsoDate, Patient, Subline } from '../types/index.ts';
import { catheterInfo } from './body.ts';
import { daysBetween, formatDayShortMonth, formatDays, formatWeekdayShort, pluralRu } from './dates.ts';

/** «1/3», «ежедн.» */
export const intervalShort = (days: number): string => (days === 1 ? 'ежедн.' : `1/${days}`);

/** «раз в 3 дня», «каждый день» */
export const intervalLong = (days: number): string => {
  if (days === 1) return 'каждый день';
  return `раз в ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
};

/** Полис / адрес / телефон — что выбрано в настройках. */
export const patientInfo = (patient: Patient, subline: Subline): string => {
  if (subline === 'address') return patient.address;
  if (subline === 'phone') return patient.phones[0]?.number ?? '';
  return patient.policy ? `Полис ${patient.policy}` : '';
};

/** Строка под ФИО на главной: полис (или адрес, телефон) + график. */
export const patientSubline = (patient: Patient, subline: Subline): string =>
  [patientInfo(patient, subline), intervalShort(patient.intervalDays)].filter(Boolean).join(' · ');

/** «сегодня», «завтра», «5 окт, пн», «просрочен 2 дн» */
export const nextVisitLabel = (date: IsoDate, today: IsoDate): string => {
  const diff = daysBetween(today, date);
  if (diff < 0) return `просрочен ${formatDays(-diff)}`;
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  return `${formatDayShortMonth(date)}, ${formatWeekdayShort(date)}`;
};

/** «Мочевой Ch 16» */
export const catheterShort = (patient: Patient): string => {
  if (patient.catheter.type === 'none') return '';
  const info = catheterInfo(patient.catheter.type);
  const name = patient.catheter.type === 'other' && patient.catheter.note ? patient.catheter.note : info.short;
  return patient.catheter.size ? `${name} Ch ${patient.catheter.size}` : name;
};

export const initials = (fullName: string): string => {
  const [last = '', first = '', middle = ''] = fullName.split(' ');
  return [last, first ? `${first[0]}.` : '', middle ? `${middle[0]}.` : ''].filter(Boolean).join(' ');
};
