import type { AppData, IsoDate, Patient, Phone, Visit, Wounds } from '../types/index.ts';
import { parseAppDataJson } from './appData.ts';
import { minIsoDate } from './dates.ts';
import { DEFAULT_SETTINGS, nameKey, policyKey, realContext, type Context } from './patients.ts';

/**
 * Обмен пациентами между сотрудниками.
 * Копия — обычный JSON (как резервная копия), только с выбранными пациентами и их визитами.
 * При добавлении к своим одинаковые пациенты (по полису, иначе по ФИО) склеиваются в одного.
 */

/** Копия для отправки: выбранные пациенты (или все активные) с их визитами, без настроек. */
export const buildShareText = (data: AppData, patientIds?: string[]): string => {
  const ids = new Set(patientIds ?? data.patients.filter((patient) => !patient.archived).map((patient) => patient.id));
  const shared: AppData = {
    schemaVersion: 1,
    patients: data.patients.filter((patient) => ids.has(patient.id)),
    visits: data.visits.filter((visit) => ids.has(visit.patientId)),
    settings: { ...DEFAULT_SETTINGS },
  };
  return JSON.stringify(shared);
};

const sameKey = (a: Patient, b: Patient): boolean => {
  const policyA = policyKey(a.policy);
  const policyB = policyKey(b.policy);
  if (policyA && policyB) return policyA === policyB;
  return nameKey(a.fullName) === nameKey(b.fullName);
};

const mergePhones = (mine: Phone[], theirs: Phone[]): Phone[] => {
  const digits = (number: string) => number.replace(/\D/g, '').slice(-10);
  const seen = new Set(mine.map((phone) => digits(phone.number)));
  return [...mine, ...theirs.filter((phone) => !seen.has(digits(phone.number)))];
};

const mergeWounds = (mine: Wounds, theirs: Wounds): Wounds => {
  const result: Wounds = { ...theirs };
  for (const [zone, stage] of Object.entries(mine)) {
    const other = result[zone];
    result[zone] = other && other > stage ? other : stage;
  }
  return result;
};

const fill = (mine: string, theirs: string): string => mine || theirs;

/** Склеить двух одинаковых пациентов: мои данные главнее, пустое дополняется из копии. */
export const mergePatient = (mine: Patient, theirs: Patient, now: string): Patient => ({
  ...mine,
  policy: fill(mine.policy, theirs.policy),
  address: fill(mine.address, theirs.address),
  apartment: fill(mine.apartment, theirs.apartment),
  entrance: fill(mine.entrance, theirs.entrance),
  floor: fill(mine.floor, theirs.floor),
  intercom: fill(mine.intercom, theirs.intercom),
  visitTime: fill(mine.visitTime, theirs.visitTime),
  phones: mergePhones(mine.phones, theirs.phones),
  comment:
    mine.comment && theirs.comment && mine.comment !== theirs.comment
      ? `${mine.comment}\n${theirs.comment}`
      : fill(mine.comment, theirs.comment),
  nextVisitDate: minIsoDate(mine.nextVisitDate, theirs.nextVisitDate),
  catheter: mine.catheter.type === 'none' ? theirs.catheter : mine.catheter,
  allergy:
    mine.allergy.has || theirs.allergy.has
      ? {
          has: true,
          items: [...new Set([...mine.allergy.items, ...theirs.allergy.items])],
          note: [mine.allergy.note, theirs.allergy.note].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('; '),
        }
      : mine.allergy,
  wounds: mergeWounds(mine.wounds, theirs.wounds),
  oxygen: mine.oxygen || theirs.oxygen,
  hospital: mine.hospital ?? theirs.hospital,
  archived: mine.archived && theirs.archived,
  updatedAt: now,
});

export type MergePreview = {
  added: Patient[];
  merged: Array<{ mine: Patient; theirs: Patient }>;
  newVisits: number;
};

type MergeResult = { data: AppData; preview: MergePreview };

const visitKey = (patientId: string, date: IsoDate, note: string) => `${patientId}|${date}|${note.trim()}`;

/** Добавить пациентов из копии к своим. Повторы склеиваются, визиты одного дня с одинаковой заметкой не дублируются. */
export const mergeData = (mine: AppData, theirs: AppData, ctx: Context = realContext): MergeResult => {
  const now = ctx.now();
  const patients = [...mine.patients];
  const idMap = new Map<string, string>();
  const preview: MergePreview = { added: [], merged: [], newVisits: 0 };

  for (const incoming of theirs.patients) {
    const index = patients.findIndex((existing) => sameKey(existing, incoming));
    const existing = index >= 0 ? patients[index] : undefined;
    if (existing) {
      patients[index] = mergePatient(existing, incoming, now);
      idMap.set(incoming.id, existing.id);
      preview.merged.push({ mine: existing, theirs: incoming });
    } else {
      const takenId = patients.some((patient) => patient.id === incoming.id);
      const added = { ...incoming, id: takenId ? ctx.newId() : incoming.id, updatedAt: now };
      patients.push(added);
      idMap.set(incoming.id, added.id);
      preview.added.push(added);
    }
  }

  const seen = new Set(mine.visits.map((visit) => visitKey(visit.patientId, visit.date, visit.note)));
  const visits: Visit[] = [...mine.visits];
  const takenVisitIds = new Set(mine.visits.map((visit) => visit.id));
  for (const visit of theirs.visits) {
    const patientId = idMap.get(visit.patientId);
    if (!patientId) continue;
    const key = visitKey(patientId, visit.date, visit.note);
    if (seen.has(key)) continue;
    seen.add(key);
    visits.push({ ...visit, patientId, id: takenVisitIds.has(visit.id) ? ctx.newId() : visit.id });
    preview.newVisits += 1;
  }

  return { data: { ...mine, patients, visits }, preview };
};

export const parseShareText = (text: string): AppData => parseAppDataJson(text.trim());
