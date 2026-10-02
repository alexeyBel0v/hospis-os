import type {
  Allergy,
  AppData,
  Catheter,
  CatheterType,
  Hospital,
  Patient,
  Phone,
  Role,
  Settings,
  Subline,
  ThemeChoice,
  Visit,
  WoundStage,
  Wounds,
} from '../types/index.ts';
import { splitApartment, splitLegacyIntercom } from './address.ts';
import { findZone } from './body.ts';
import { isIsoDate } from './dates.ts';
import { DEFAULT_SETTINGS, EMPTY_ALLERGY, EMPTY_CATHETER, normalizeVisitTime } from './patients.ts';

/** Ошибка формата данных — текст можно показывать пользователю как есть. */
export class DataFormatError extends Error {}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (record: UnknownRecord, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const CATHETER_TYPES: CatheterType[] = ['none', 'urinary', 'cysto', 'other'];

const parsePhones = (value: UnknownRecord): Phone[] => {
  if (Array.isArray(value.phones)) {
    return value.phones
      .filter(isRecord)
      .map((phone) => ({ number: readString(phone, 'number'), who: readString(phone, 'who') }))
      .filter((phone) => phone.number);
  }
  // Версия 0.1–0.2: один телефон строкой.
  const single = readString(value, 'phone');
  return single ? [{ number: single, who: 'Пациент' }] : [];
};

const parseCatheter = (value: unknown): Catheter => {
  // Версия 0.1–0.2: catheter: true/false без типа.
  if (value === true) return { ...EMPTY_CATHETER, type: 'other' };
  if (!isRecord(value)) return { ...EMPTY_CATHETER };
  const type = CATHETER_TYPES.find((item) => item === value.type) ?? 'none';
  const size = typeof value.size === 'number' && Number.isFinite(value.size) ? Math.round(value.size) : null;
  const installedOn = readString(value, 'installedOn');
  return { type, size, note: readString(value, 'note'), installedOn: isIsoDate(installedOn) ? installedOn : '' };
};

const parseAllergy = (value: unknown): Allergy => {
  if (!isRecord(value) || value.has !== true) return { ...EMPTY_ALLERGY, items: [] };
  const items = Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === 'string') : [];
  return { has: true, items, note: readString(value, 'note') };
};

const isStage = (value: unknown): value is WoundStage => value === 1 || value === 2 || value === 3 || value === 4;

const parseWounds = (value: unknown): Wounds => {
  if (!isRecord(value)) return {};
  const wounds: Wounds = {};
  for (const [zoneId, stage] of Object.entries(value)) {
    if (findZone(zoneId) && isStage(stage)) wounds[zoneId] = stage;
  }
  return wounds;
};

/** Данные до v0.5: квартира внутри адреса, подъезд и этаж — в поле домофона. Разносим по полям. */
const parseAddress = (value: UnknownRecord) => {
  const address = readString(value, 'address');
  const intercom = readString(value, 'intercom');
  if ('entrance' in value || 'apartment' in value) {
    return {
      address,
      apartment: readString(value, 'apartment'),
      entrance: readString(value, 'entrance'),
      floor: readString(value, 'floor'),
      intercom,
    };
  }
  return { ...splitApartment(address), ...splitLegacyIntercom(intercom) };
};

const parseHospital = (value: unknown): Hospital | null => {
  if (!isRecord(value) || !isIsoDate(value.since)) return null;
  return { since: value.since, note: readString(value, 'note') };
};

const parsePatient = (value: unknown, index: number): Patient => {
  if (!isRecord(value)) throw new DataFormatError(`Пациент №${index + 1}: неверный формат.`);
  const id = readString(value, 'id');
  const fullName = readString(value, 'fullName');
  const nextVisitDate = value.nextVisitDate;
  const intervalDays = value.intervalDays;
  if (!id || !fullName) throw new DataFormatError(`Пациент №${index + 1}: нет id или ФИО.`);
  if (!isIsoDate(nextVisitDate)) throw new DataFormatError(`Пациент «${fullName}»: неверная дата следующего визита.`);
  if (typeof intervalDays !== 'number' || !Number.isFinite(intervalDays) || intervalDays < 1) {
    throw new DataFormatError(`Пациент «${fullName}»: неверный интервал визитов.`);
  }
  return {
    id,
    fullName,
    policy: readString(value, 'policy'),
    ...parseAddress(value),
    phones: parsePhones(value),
    comment: readString(value, 'comment'),
    intervalDays: Math.round(intervalDays),
    visitTime: normalizeVisitTime(readString(value, 'visitTime')),
    nextVisitDate,
    catheter: parseCatheter(value.catheter),
    allergy: parseAllergy(value.allergy),
    wounds: parseWounds(value.wounds),
    oxygen: value.oxygen === true,
    hospital: parseHospital(value.hospital),
    archived: value.archived === true,
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
  };
};

const parseVisit = (value: unknown, index: number): Visit => {
  if (!isRecord(value)) throw new DataFormatError(`Визит №${index + 1}: неверный формат.`);
  const id = readString(value, 'id');
  const patientId = readString(value, 'patientId');
  const date = value.date;
  if (!id || !patientId || !isIsoDate(date)) throw new DataFormatError(`Визит №${index + 1}: нет id, пациента или даты.`);
  return { id, patientId, date, note: readString(value, 'note'), createdAt: readString(value, 'createdAt') };
};

const SUBLINES: Subline[] = ['policy', 'address', 'phone'];
const ROLES: Role[] = ['nurse', 'doctor', 'other'];
const THEMES: ThemeChoice[] = ['telegram', 'light', 'dark'];

const parseSettings = (value: unknown): Settings => {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const interval = value.defaultInterval;
  return {
    role: ROLES.find((item) => item === value.role) ?? '',
    defaultInterval: typeof interval === 'number' && interval >= 1 ? Math.round(interval) : DEFAULT_SETTINGS.defaultInterval,
    subline: SUBLINES.find((item) => item === value.subline) ?? DEFAULT_SETTINGS.subline,
    showTomorrow: value.showTomorrow !== false,
    haptics: value.haptics !== false,
    theme: THEMES.find((item) => item === value.theme) ?? DEFAULT_SETTINGS.theme,
    lastBackupAt: readString(value, 'lastBackupAt'),
  };
};

/** Проверяет данные из хранилища или файла копии и приводит их к AppData. Старые версии данных дополняются. */
export const parseAppData = (value: unknown): AppData => {
  if (!isRecord(value) || !('schemaVersion' in value)) throw new DataFormatError('Это не похоже на копию Hospis OS.');
  if (value.schemaVersion !== 1) throw new DataFormatError('Неизвестная версия копии данных.');
  if (!Array.isArray(value.patients) || !Array.isArray(value.visits)) {
    throw new DataFormatError('В копии нет списка пациентов или визитов.');
  }
  const patients = value.patients.map(parsePatient);
  const patientIds = new Set(patients.map((patient) => patient.id));
  const visits = value.visits.map(parseVisit).filter((visit) => patientIds.has(visit.patientId));
  return { schemaVersion: 1, patients, visits, settings: parseSettings(value.settings) };
};

export const parseAppDataJson = (text: string): AppData => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DataFormatError('Текст повреждён или это не копия Hospis OS.');
  }
  return parseAppData(parsed);
};
