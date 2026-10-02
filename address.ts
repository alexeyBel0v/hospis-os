import type { Patient } from '../types/index.ts';

/**
 * Адрес пациента. Правило простое:
 *   «Адрес» — только город, улица и дом (корпус, строение). По этой строке Яндекс строит маршрут.
 *   Квартира, подъезд, этаж и домофон — в отдельных полях: в маршрут не идут, показываются в карточке.
 */

export const ADDRESS_PLACEHOLDER = 'Москва, Профсоюзная ул., 104к2';

export const ADDRESS_RULES = [
  'Сначала город, потом улица и дом: «Москва, ул. Ленина, 15».',
  'Корпус и строение — сразу после дома: «15к2», «15с1».',
  'Квартиру, подъезд, этаж и домофон — в поля ниже, не в адрес.',
] as const;

/** Лишние пробелы и запятые: « ул.  Ленина ,15 » → «ул. Ленина, 15». */
export const normalizeAddress = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

/** Адрес начинается сразу с улицы — значит, город не указан. */
const STREET_FIRST = /^(ул\.?|улица|пр-т|просп|пр\.|проспект|пер\.?|переулок|ш\.|шоссе|б-р|бул|наб|проезд|пл\.|площадь|мкр)(\s|\.|$)/i;

const APARTMENT_PATTERN = /,?\s*(?:кв\.?|квартира)\s*(\d+[а-яa-z]?)\s*$/i;
const ENTRANCE_PATTERN = /(?:подъезд|под\.)\s*(\d+)/i;
const FLOOR_PATTERN = /(?:этаж|эт\.)\s*(\d+)/i;
const INTERCOM_PATTERN = /(?:код|домофон)\s*([0-9a-zа-я#*]+)/i;

/** «ул. Ленина, 15, кв. 4» → { address: «ул. Ленина, 15», apartment: «4» }. */
export const splitApartment = (address: string): { address: string; apartment: string } => {
  const match = APARTMENT_PATTERN.exec(address);
  if (!match || match.index === undefined) return { address: normalizeAddress(address), apartment: '' };
  return { address: normalizeAddress(address.slice(0, match.index)), apartment: match[1] ?? '' };
};

type Details = { entrance: string; floor: string; intercom: string };

/** Старое поле «Код 45К, подъезд 2, этаж 3» → отдельные поля. */
export const splitLegacyIntercom = (text: string): Details => {
  const entrance = ENTRANCE_PATTERN.exec(text)?.[1] ?? '';
  const floor = FLOOR_PATTERN.exec(text)?.[1] ?? '';
  const code = INTERCOM_PATTERN.exec(text)?.[1] ?? '';
  const parsedSomething = Boolean(entrance || floor || code);
  return { entrance, floor, intercom: parsedSomething ? code : text.trim() };
};

/** Подсказка, если адрес заполнен не по правилам. Пусто — всё хорошо. */
export const addressWarning = (address: string): string => {
  const value = address.trim();
  if (!value) return '';
  if (APARTMENT_PATTERN.test(value) || /\bкв\.?\s*\d/i.test(value)) return 'Квартиру лучше указать в поле «Кв.» — так маршрут точнее.';
  if (ENTRANCE_PATTERN.test(value) || FLOOR_PATTERN.test(value)) return 'Подъезд и этаж — в поля ниже, не в адрес.';
  if (!/\d/.test(value)) return 'Не видно номера дома.';
  if (STREET_FIRST.test(value)) return 'Добавьте город в начало: «Москва, …» — иначе Яндекс может найти улицу в другом городе.';
  return '';
};

/** «кв. 4 · подъезд 2 · этаж 3 · домофон 45К» */
export const addressDetails = (patient: Pick<Patient, 'apartment' | 'entrance' | 'floor' | 'intercom'>): string =>
  [
    patient.apartment && `кв. ${patient.apartment}`,
    patient.entrance && `подъезд ${patient.entrance}`,
    patient.floor && `этаж ${patient.floor}`,
    patient.intercom && `домофон ${patient.intercom}`,
  ]
    .filter(Boolean)
    .join(' · ');

/** Адрес с квартирой одной строкой — для копирования и списков. */
export const fullAddress = (patient: Pick<Patient, 'address' | 'apartment'>): string =>
  [patient.address, patient.apartment && `кв. ${patient.apartment}`].filter(Boolean).join(', ');
