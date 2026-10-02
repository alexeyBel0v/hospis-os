import { describe, expect, it } from 'vitest';
import { formatPhone, formatPolicy, isPhoneComplete, isPolicyComplete, normalizePhone, normalizePolicy } from './masks.ts';

describe('полис', () => {
  it('группирует по 4 цифры и обрезает лишнее', () => {
    expect(formatPolicy('7700')).toBe('7700');
    expect(formatPolicy('77001')).toBe('7700 1');
    expect(formatPolicy('7700-1234-5678-9012-999')).toBe('7700 1234 5678 9012');
    expect(formatPolicy('ab77 00')).toBe('7700');
  });
  it('полный — ровно 16 цифр', () => {
    expect(isPolicyComplete('7700 1234 5678 9012')).toBe(true);
    expect(isPolicyComplete('7700 1234')).toBe(false);
  });
  it('нормализует сохранённые', () => {
    expect(normalizePolicy('7700123456789012')).toBe('7700 1234 5678 9012');
    expect(normalizePolicy('старый 123')).toBe('старый 123');
  });
});

describe('телефон', () => {
  it.each([
    ['9', '+7 9'],
    ['909', '+7 909'],
    ['9099', '+7 909 9'],
    ['9099099797', '+7 909 909-97-97'],
    ['89099099797', '+7 909 909-97-97'],
    ['+7 (909) 909 97 97', '+7 909 909-97-97'],
    ['+79099099797123', '+7 909 909-97-97'],
  ])('«%s» → «%s»', (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });
  it('стирается до пустого поля', () => {
    expect(formatPhone('+7')).toBe('+7');
    expect(formatPhone('+')).toBe('');
    expect(formatPhone('')).toBe('');
  });
  it('полный — 10 цифр после +7', () => {
    expect(isPhoneComplete('+7 909 909-97-97')).toBe(true);
    expect(isPhoneComplete('+7 909 909')).toBe(false);
  });
  it('нормализует сохранённые', () => {
    expect(normalizePhone('8 (909) 909-97-97')).toBe('+7 909 909-97-97');
    expect(normalizePhone('112')).toBe('112');
  });
});
