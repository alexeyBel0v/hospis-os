import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatFullDate,
  formatLongDate,
  formatRelativeDay,
  formatShortDate,
  isIsoDate,
  pluralRu,
  toIsoDate,
} from './dates.ts';

describe('addDays', () => {
  it('прибавляет дни внутри месяца', () => {
    expect(addDays('2026-09-10', 3)).toBe('2026-09-13');
  });

  it('переходит через конец месяца', () => {
    expect(addDays('2026-09-28', 3)).toBe('2026-10-01');
    expect(addDays('2026-01-30', 2)).toBe('2026-02-01');
  });

  it('переходит через год', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-01-02', -3)).toBe('2026-12-30');
  });

  it('учитывает високосный год', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('не сбивается на переходе на летнее время', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
});

describe('daysBetween', () => {
  it('считает разницу в днях со знаком', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toBe(3);
    expect(daysBetween('2026-10-02', '2026-09-29')).toBe(-3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-09-29', '2026-09-29')).toBe(0);
  });
});

describe('isIsoDate', () => {
  it('принимает только настоящие даты', () => {
    expect(isIsoDate('2026-09-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('29.09.2026')).toBe(false);
    expect(isIsoDate(20260929)).toBe(false);
  });
});

describe('toIsoDate', () => {
  it('берёт локальную дату устройства', () => {
    expect(toIsoDate(new Date(2026, 8, 29, 23, 59))).toBe('2026-09-29');
    expect(toIsoDate(new Date(2026, 8, 30, 0, 1))).toBe('2026-09-30');
  });
});

describe('форматирование', () => {
  it('pluralRu склоняет числительные', () => {
    const days = (n: number) => pluralRu(n, 'день', 'дня', 'дней');
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map(days)).toEqual([
      'день', 'дня', 'дней', 'дней', 'дней', 'день', 'дня', 'дней', 'дней',
    ]);
  });

  it('форматирует даты по-русски', () => {
    expect(formatLongDate('2026-09-29')).toBe('29 сентября, вторник');
    expect(formatShortDate('2026-10-01')).toBe('01.10, чт');
    expect(formatFullDate('2026-10-01')).toBe('01.10.2026');
  });

  it('пишет относительные дни', () => {
    const today = '2026-09-29';
    expect(formatRelativeDay('2026-09-29', today)).toBe('сегодня');
    expect(formatRelativeDay('2026-09-30', today)).toBe('завтра');
    expect(formatRelativeDay('2026-10-01', today)).toBe('послезавтра');
    expect(formatRelativeDay('2026-10-04', today)).toBe('через 5 дней');
    expect(formatRelativeDay('2026-09-28', today)).toBe('вчера');
    expect(formatRelativeDay('2026-09-26', today)).toBe('3 дня назад');
  });
});
