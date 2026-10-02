import type { Allergy, AppData, Catheter, Hospital, IsoDate, Patient, PatientInput, Phone, Settings, Visit, Wounds } from '../types/index.ts';
import { maxIsoDate } from './dates.ts';
import { normalizeAddress } from './address.ts';
import { normalizePhone, normalizePolicy } from './masks.ts';

export type Context = { now: () => string; newId: () => string };

const fallbackId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const realContext: Context = {
  now: () => new Date().toISOString(),
  newId: () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackId()),
};

export const DEFAULT_SETTINGS: Settings = {
  role: '',
  defaultInterval: 3,
  subline: 'policy',
  showTomorrow: true,
  haptics: true,
  theme: 'telegram',
  lastBackupAt: '',
};

export const EMPTY_CATHETER: Catheter = { type: 'none', size: null, note: '', installedOn: '' };
export const EMPTY_ALLERGY: Allergy = { has: false, items: [], note: '' };

export const createEmptyData = (): AppData => ({
  schemaVersion: 1,
  patients: [],
  visits: [],
  settings: { ...DEFAULT_SETTINGS },
});

export const emptyPatientInput = (nextVisitDate: IsoDate, intervalDays = DEFAULT_SETTINGS.defaultInterval): PatientInput => ({
  fullName: '',
  policy: '',
  address: '',
  apartment: '',
  entrance: '',
  floor: '',
  intercom: '',
  phones: [],
  comment: '',
  intervalDays,
  visitTime: '',
  nextVisitDate,
  catheter: { ...EMPTY_CATHETER },
  allergy: { ...EMPTY_ALLERGY, items: [] },
  wounds: {},
  oxygen: false,
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «9:5» и мусор → пусто, «09:30» → «09:30». */
export const normalizeVisitTime = (value: string): string => (TIME_PATTERN.test(value.trim()) ? value.trim() : '');

const cleanPhones = (phones: Phone[]): Phone[] =>
  phones
    .map((phone) => ({ number: normalizePhone(phone.number), who: phone.who.trim() }))
    .filter((phone) => phone.number.length > 0);

const normalizeInput = (input: PatientInput): PatientInput => ({
  ...input,
  fullName: input.fullName.trim().replace(/\s+/g, ' '),
  policy: normalizePolicy(input.policy),
  address: normalizeAddress(input.address),
  apartment: input.apartment.trim(),
  entrance: input.entrance.trim(),
  floor: input.floor.trim(),
  intercom: input.intercom.trim(),
  phones: cleanPhones(input.phones),
  comment: input.comment.trim(),
  visitTime: normalizeVisitTime(input.visitTime),
  intervalDays: Math.max(1, Math.round(input.intervalDays)),
  catheter:
    input.catheter.type === 'none'
      ? { ...EMPTY_CATHETER }
      : { ...input.catheter, note: input.catheter.note.trim() },
  allergy: input.allergy.has
    ? { has: true, items: [...new Set(input.allergy.items)], note: input.allergy.note.trim() }
    : { ...EMPTY_ALLERGY, items: [] },
});

const mapPatient = (data: AppData, patientId: string, change: (patient: Patient) => Patient): AppData => ({
  ...data,
  patients: data.patients.map((patient) => (patient.id === patientId ? change(patient) : patient)),
});

type NewPatientResult = { data: AppData; patientId: string };

export const addPatient = (data: AppData, input: PatientInput, ctx: Context = realContext): NewPatientResult => {
  const now = ctx.now();
  const patient: Patient = { ...normalizeInput(input), id: ctx.newId(), hospital: null, archived: false, createdAt: now, updatedAt: now };
  return { data: { ...data, patients: [...data.patients, patient] }, patientId: patient.id };
};

export const updatePatient = (data: AppData, patientId: string, input: PatientInput, ctx: Context = realContext): AppData =>
  mapPatient(data, patientId, (patient) => ({ ...patient, ...normalizeInput(input), updatedAt: ctx.now() }));

/** Точечное изменение (раны, катетер) прямо из карточки. */
export const patchPatient = (
  data: AppData,
  patientId: string,
  patch: Partial<Pick<Patient, 'wounds' | 'catheter' | 'allergy' | 'oxygen'>>,
  ctx: Context = realContext,
): AppData => mapPatient(data, patientId, (patient) => ({ ...patient, ...patch, updatedAt: ctx.now() }));

type VisitRecord = { visitDate: IsoDate; nextVisitDate: IsoDate; note: string };

/** Отметить визит: запись попадает в историю, дата следующего визита — та, что выбрал пользователь. */
export const recordVisit = (
  data: AppData,
  patientId: string,
  { visitDate, nextVisitDate, note }: VisitRecord,
  ctx: Context = realContext,
): AppData => {
  const now = ctx.now();
  const visit: Visit = { id: ctx.newId(), patientId, date: visitDate, note: note.trim(), createdAt: now };
  const withNext = mapPatient(data, patientId, (patient) => ({ ...patient, nextVisitDate, updatedAt: now }));
  return { ...withNext, visits: [...withNext.visits, visit] };
};

export const setNextVisitDate = (data: AppData, patientId: string, nextVisitDate: IsoDate, ctx: Context = realContext) =>
  mapPatient(data, patientId, (patient) => ({ ...patient, nextVisitDate, updatedAt: ctx.now() }));

export const setArchived = (data: AppData, patientId: string, archived: boolean, ctx: Context = realContext) =>
  mapPatient(data, patientId, (patient) => ({ ...patient, archived, updatedAt: ctx.now() }));

/** Госпитализировать (визиты на паузе) или null — снять паузу. */
export const setHospital = (data: AppData, patientId: string, hospital: Hospital | null, ctx: Context = realContext) =>
  mapPatient(data, patientId, (patient) => ({ ...patient, hospital, updatedAt: ctx.now() }));

/** Выписали: пауза снята, следующий визит — выбранная дата. */
export const dischargePatient = (data: AppData, patientId: string, nextVisitDate: IsoDate, ctx: Context = realContext) =>
  mapPatient(data, patientId, (patient) => ({ ...patient, hospital: null, nextVisitDate, updatedAt: ctx.now() }));

/** В работе: не в архиве и не в больнице. */
export const isInWork = (patient: Patient): boolean => !patient.archived && !patient.hospital;

export const removePatient = (data: AppData, patientId: string): AppData => ({
  ...data,
  patients: data.patients.filter((patient) => patient.id !== patientId),
  visits: data.visits.filter((visit) => visit.patientId !== patientId),
});

export const removeVisit = (data: AppData, visitId: string): AppData => ({
  ...data,
  visits: data.visits.filter((visit) => visit.id !== visitId),
});

export const updateSettings = (data: AppData, patch: Partial<Settings>): AppData => ({
  ...data,
  settings: { ...data.settings, ...patch },
});

export const findPatient = (data: AppData, patientId: string): Patient | undefined =>
  data.patients.find((patient) => patient.id === patientId);

/** История визитов пациента, новые сверху. */
export const getPatientVisits = (data: AppData, patientId: string): Visit[] =>
  data.visits
    .filter((visit) => visit.patientId === patientId)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));

export const getLastVisitDate = (data: AppData, patientId: string): IsoDate | null =>
  data.visits
    .filter((visit) => visit.patientId === patientId)
    .reduce<IsoDate | null>((latest, visit) => (latest ? maxIsoDate(latest, visit.date) : visit.date), null);

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** Ключ полиса для сравнения: только цифры. Короче 6 цифр — не считаем полисом. */
export const policyKey = (policy: string): string => {
  const digits = digitsOnly(policy);
  return digits.length >= 6 ? digits : '';
};

export const nameKey = (fullName: string): string => fullName.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

/** Уже есть пациент с таким полисом (кроме exceptId)? */
export const findByPolicy = (patients: Patient[], policy: string, exceptId?: string): Patient | undefined => {
  const key = policyKey(policy);
  if (!key) return undefined;
  return patients.find((patient) => patient.id !== exceptId && policyKey(patient.policy) === key);
};

/** Поиск по ФИО, телефонам (по цифрам), полису и адресу. */
export const matchesQuery = (patient: Patient, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const phones = patient.phones.map((phone) => phone.number).join(' ');
  const text = [patient.fullName, patient.address, patient.policy, phones].join(' ').toLowerCase();
  if (text.includes(needle)) return true;
  const needleDigits = digitsOnly(needle);
  if (needleDigits.length < 3) return false;
  return digitsOnly(phones).includes(needleDigits) || digitsOnly(patient.policy).includes(needleDigits);
};

export const hasCatheter = (patient: Patient): boolean => patient.catheter.type !== 'none';

export const countOpenWounds = (wounds: Wounds): number => Object.keys(wounds).length;
