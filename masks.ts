/**
 * Маски ввода: лишнее не печатается, формат одинаковый у всех.
 * Полис ОМС: 16 цифр, «0000 0000 0000 0000».
 * Телефон: «+7 909 909-97-97». Первую 8 или 7 можно не стирать — она станет +7.
 */

export const POLICY_DIGITS = 16;
const POLICY_SEPARATOR = ' ';

const digits = (value: string): string => value.replace(/\D/g, '');

export const formatPolicy = (value: string): string => {
  const clean = digits(value).slice(0, POLICY_DIGITS);
  return clean.match(/.{1,4}/g)?.join(POLICY_SEPARATOR) ?? '';
};

export const isPolicyComplete = (value: string): boolean => digits(value).length === POLICY_DIGITS;

/** 10 цифр номера без кода страны. */
const phoneBody = (value: string): string => {
  let clean = digits(value);
  if (clean.length > 10 && (clean.startsWith('7') || clean.startsWith('8'))) clean = clean.slice(1);
  else if (clean.length <= 10 && value.trim().startsWith('+7')) clean = clean.slice(1);
  else if (clean.length === 11) clean = clean.slice(1);
  return clean.slice(0, 10);
};

/** Форматирует по мере ввода: «9», «+7 909», «+7 909 909-97-97». */
export const formatPhone = (value: string): string => {
  const trimmed = value.trim();
  if (!digits(trimmed)) return '';
  let raw = digits(trimmed);
  if (trimmed.startsWith('+7') || ((raw.startsWith('7') || raw.startsWith('8')) && raw.length >= 2)) raw = raw.slice(1);
  raw = raw.slice(0, 10);
  const parts = [raw.slice(0, 3), raw.slice(3, 6), raw.slice(6, 8), raw.slice(8, 10)];
  let result = '+7';
  if (parts[0]) result += ` ${parts[0]}`;
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += `-${parts[2]}`;
  if (parts[3]) result += `-${parts[3]}`;
  return result;
};

export const isPhoneComplete = (value: string): boolean => phoneBody(value).length === 10;

/** Привести сохранённый номер к виду «+7 909 909-97-97», если в нём 10–11 цифр; иначе оставить как есть. */
export const normalizePhone = (value: string): string => {
  const clean = digits(value);
  if (clean.length === 10 || (clean.length === 11 && /^[78]/.test(clean))) return formatPhone(`+7${clean.slice(-10)}`);
  return value.trim();
};

/** Привести сохранённый полис к виду «0000 0000 0000 0000», если в нём ровно 16 цифр. */
export const normalizePolicy = (value: string): string => (isPolicyComplete(value) ? formatPolicy(value) : value.trim());
