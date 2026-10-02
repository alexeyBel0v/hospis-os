import { describe, expect, it } from 'vitest';
import { addressDetails, addressWarning, normalizeAddress, splitApartment, splitLegacyIntercom } from './address.ts';

describe('адрес', () => {
  it('убирает лишние пробелы и запятые', () => {
    expect(normalizeAddress('  Москва ,  ул.  Ленина,,15 , ')).toBe('Москва, ул. Ленина, 15');
  });

  it('отделяет квартиру от адреса', () => {
    expect(splitApartment('ул. Ленина, 15, кв. 4')).toEqual({ address: 'ул. Ленина, 15', apartment: '4' });
    expect(splitApartment('Профсоюзная ул., 104 квартира 12а')).toEqual({ address: 'Профсоюзная ул., 104', apartment: '12а' });
    expect(splitApartment('ул. Ленина, 15')).toEqual({ address: 'ул. Ленина, 15', apartment: '' });
  });

  it('разбирает старое поле «домофон, подъезд, этаж»', () => {
    expect(splitLegacyIntercom('Код 45К, подъезд 2, этаж 3')).toEqual({ entrance: '2', floor: '3', intercom: '45К' });
    expect(splitLegacyIntercom('звонить в 7')).toEqual({ entrance: '', floor: '', intercom: 'звонить в 7' });
  });

  it('подсказывает, если адрес не по правилам', () => {
    expect(addressWarning('Москва, ул. Ленина, 15')).toBe('');
    expect(addressWarning('ул. Ленина, 15, кв. 4')).toContain('Кв.');
    expect(addressWarning('ул. Ленина, 15, подъезд 2')).toContain('Подъезд');
    expect(addressWarning('ул. Ленина')).toContain('номера дома');
    expect(addressWarning('ул. Ленина 15')).toContain('город');
    expect(addressWarning('Профсоюзная ул., 104')).toBe('');
  });

  it('собирает строку подъезд/этаж/домофон', () => {
    expect(addressDetails({ apartment: '4', entrance: '2', floor: '', intercom: '45К' })).toBe('кв. 4 · подъезд 2 · домофон 45К');
  });
});
