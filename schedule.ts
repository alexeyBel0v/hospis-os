import type { IsoDate, Patient, Visit } from '../types/index.ts';
import { addDays, daysBetween, formatDays, formatShortDate, maxIsoDate, pluralRu } from './dates.ts';

/** Сколько дней до визита считаются «пора планировать» (жёлтый): сегодня, завтра, послезавтра. */
export const SOON_WINDOW_DAYS = 2;
/** Горизонт блока «Ближайшие дни» на главном экране. */
export const UPCOMING_WINDOW_DAYS = 7;
export const INTERVAL_PRESETS = [1, 2, 3, 4, 5, 7] as const;

export type DueStatus = 'overdue' | 'soon' | 'ok';

export type PatientDue = {
  patient: Patient;
  lastVisitDate: IsoDate | null;
  daysUntilDue: number;
  status: DueStatus;
  /** Заполненность шкалы 0…1: сколько прошло от последнего визита до следующего. */
  progress: number;
};

export type DayGroup = { date: IsoDate; items: PatientDue[] };

export type TodayPlan = {
  overdue: PatientDue[];
  dueToday: PatientDue[];
  dueTomorrow: PatientDue[];
  upcoming: DayGroup[];
  visitedToday: PatientDue[];
  /** Сколько пациентов отмечено сегодня (включая тех, кто остался в «Завтра»). */
  visitedTodayCount: number;
};

export const getDueStatus = (daysUntilDue: number): DueStatus => {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= SOON_WINDOW_DAYS) return 'soon';
  return 'ok';
};

export const suggestNextVisitDate = (visitDate: IsoDate, intervalDays: number): IsoDate =>
  addDays(visitDate, intervalDays);

type ProgressInput = {
  lastVisitDate: IsoDate | null;
  nextVisitDate: IsoDate;
  intervalDays: number;
  today: IsoDate;
};

export const getDueProgress = ({ lastVisitDate, nextVisitDate, intervalDays, today }: ProgressInput): number => {
  if (today > nextVisitDate) return 1;
  const start = lastVisitDate ?? addDays(nextVisitDate, -intervalDays);
  const total = daysBetween(start, nextVisitDate);
  if (total <= 0) return 1;
  const elapsed = daysBetween(start, today);
  return Math.min(1, Math.max(0, elapsed / total));
};

export const buildLastVisitIndex = (visits: Visit[]): Map<string, IsoDate> => {
  const index = new Map<string, IsoDate>();
  for (const visit of visits) {
    const current = index.get(visit.patientId);
    index.set(visit.patientId, current ? maxIsoDate(current, visit.date) : visit.date);
  }
  return index;
};

export const describePatientDue = (patient: Patient, lastVisitDate: IsoDate | null, today: IsoDate): PatientDue => {
  const daysUntilDue = daysBetween(today, patient.nextVisitDate);
  return {
    patient,
    lastVisitDate,
    daysUntilDue,
    status: getDueStatus(daysUntilDue),
    progress: getDueProgress({
      lastVisitDate,
      nextVisitDate: patient.nextVisitDate,
      intervalDays: patient.intervalDays,
      today,
    }),
  };
};

const byName = (a: PatientDue, b: PatientDue): number => a.patient.fullName.localeCompare(b.patient.fullName, 'ru');

/** По фамилии. Время визита больше не используется — работаем без привязки ко времени. */
export const byPatientName = byName;

const byUrgency = (a: PatientDue, b: PatientDue): number => a.daysUntilDue - b.daysUntilDue || byPatientName(a, b);

/** Активные (не архивные) пациенты, самые срочные — сверху. */
export const describeActivePatients = (patients: Patient[], visits: Visit[], today: IsoDate): PatientDue[] => {
  const lastVisits = buildLastVisitIndex(visits);
  return patients
    .filter((patient) => !patient.archived && !patient.hospital)
    .map((patient) => describePatientDue(patient, lastVisits.get(patient.id) ?? null, today))
    .sort(byUrgency);
};

export const buildTodayPlan = (dues: PatientDue[], today: IsoDate): TodayPlan => {
  const plan: TodayPlan = {
    overdue: [],
    dueToday: [],
    dueTomorrow: [],
    upcoming: [],
    visitedToday: [],
    visitedTodayCount: dues.filter((due) => due.lastVisitDate === today).length,
  };
  const upcomingByDate = new Map<IsoDate, PatientDue[]>();

  for (const due of [...dues].sort(byUrgency)) {
    const { daysUntilDue } = due;
    // Был сегодня и следующий визит завтра — оставляем в «Завтра»: это надо сверить с расписанием.
    if (due.lastVisitDate === today && daysUntilDue > 1) plan.visitedToday.push(due);
    else if (daysUntilDue < 0) plan.overdue.push(due);
    else if (daysUntilDue === 0) plan.dueToday.push(due);
    else if (daysUntilDue === 1) plan.dueTomorrow.push(due);
    else if (daysUntilDue < UPCOMING_WINDOW_DAYS) {
      const group = upcomingByDate.get(due.patient.nextVisitDate) ?? [];
      group.push(due);
      upcomingByDate.set(due.patient.nextVisitDate, group);
    }
  }

  plan.upcoming = [...upcomingByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, items]) => ({ date, items }));
  return plan;
};

/** «ежедневно», «раз в 3 дня», «раз в 7 дней» */
export const formatInterval = (intervalDays: number): string =>
  intervalDays === 1 ? 'ежедневно' : `раз в ${intervalDays} ${pluralRu(intervalDays, 'день', 'дня', 'дней')}`;

/** Короткая подпись срока: «Просрочено на 2 дня», «Визит завтра, 01.10, чт». */
export const formatDueLabel = (daysUntilDue: number, nextVisitDate: IsoDate): string => {
  if (daysUntilDue < 0) return `Просрочено на ${formatDays(-daysUntilDue)}`;
  if (daysUntilDue === 0) return 'Визит сегодня';
  if (daysUntilDue === 1) return `Визит завтра, ${formatShortDate(nextVisitDate)}`;
  if (daysUntilDue === 2) return `Визит послезавтра, ${formatShortDate(nextVisitDate)}`;
  return `Визит через ${formatDays(daysUntilDue)}, ${formatShortDate(nextVisitDate)}`;
};

/** Первый, к кому ехать: сначала просроченные, потом сегодняшние по времени. */
export const getNextPatient = (plan: TodayPlan): PatientDue | null => plan.overdue[0] ?? plan.dueToday[0] ?? null;

/**
 * Будет ли у пациента визит в этот день по графику.
 * Просроченные считаются как будто визит сегодня, дальше — каждые N дней.
 */
export const isPlannedOn = (patient: Patient, date: IsoDate, today: IsoDate): boolean => {
  if (patient.archived || patient.hospital || date < today) return false;
  const base = maxIsoDate(patient.nextVisitDate, today);
  if (date < base) return false;
  return daysBetween(base, date) % Math.max(1, patient.intervalDays) === 0;
};

/** Пациенты, запланированные на день (для будущих дней — прогноз по графику). */
export const getPlannedForDate = (dues: PatientDue[], date: IsoDate, today: IsoDate): PatientDue[] =>
  dues.filter((due) => isPlannedOn(due.patient, date, today)).sort(byPatientName);

export const countPlannedByDate = (patients: Patient[], dates: IsoDate[], today: IsoDate): Map<IsoDate, number> =>
  new Map(dates.map((date) => [date, patients.filter((patient) => isPlannedOn(patient, date, today)).length]));

export const groupVisitsByDate = (visits: Visit[]): Map<IsoDate, Visit[]> => {
  const groups = new Map<IsoDate, Visit[]>();
  for (const visit of visits) groups.set(visit.date, [...(groups.get(visit.date) ?? []), visit]);
  return groups;
};
