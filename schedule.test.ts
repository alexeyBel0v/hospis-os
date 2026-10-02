import { describe, expect, it } from 'vitest';
import type { Patient, Visit } from '../types/index.ts';
import { emptyPatientInput } from './patients.ts';
import {
  buildTodayPlan,
  describeActivePatients,
  formatDueLabel,
  formatInterval,
  getDueProgress,
  getDueStatus,
  suggestNextVisitDate,
} from './schedule.ts';

const TODAY = '2026-09-29';

const patient = (overrides: Partial<Patient> & Pick<Patient, 'id' | 'nextVisitDate'>): Patient => ({
  ...emptyPatientInput(overrides.nextVisitDate),
  fullName: `Пациент ${overrides.id}`,
  intervalDays: 3,
  archived: false,
  hospital: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const visit = (patientId: string, date: string): Visit => ({ id: `${patientId}-${date}`, patientId, date, note: '', createdAt: '' });

describe('suggestNextVisitDate — следующий визит от фактического', () => {
  it.each([
    [1, '2026-09-30'],
    [2, '2026-10-01'],
    [3, '2026-10-02'],
    [4, '2026-10-03'],
    [5, '2026-10-04'],
    [7, '2026-10-06'],
  ])('раз в %i дн. от 29.09 → %s', (interval, expected) => {
    expect(suggestNextVisitDate(TODAY, interval)).toBe(expected);
  });

  it('цепочка раз в 3 дня от 10.09 совпадает с ТЗ', () => {
    const chain = ['2026-09-10'];
    for (let i = 0; i < 7; i += 1) chain.push(suggestNextVisitDate(chain.at(-1) ?? '', 3));
    expect(chain).toEqual([
      '2026-09-10', '2026-09-13', '2026-09-16', '2026-09-19', '2026-09-22', '2026-09-25', '2026-09-28', '2026-10-01',
    ]);
  });

  it('переходит через месяц и год', () => {
    expect(suggestNextVisitDate('2026-10-30', 3)).toBe('2026-11-02');
    expect(suggestNextVisitDate('2026-12-29', 5)).toBe('2027-01-03');
  });
});

describe('getDueStatus — цвет шкалы', () => {
  it('красный, если срок прошёл', () => {
    expect(getDueStatus(-1)).toBe('overdue');
  });
  it('жёлтый сегодня, завтра и послезавтра', () => {
    expect([0, 1, 2].map(getDueStatus)).toEqual(['soon', 'soon', 'soon']);
  });
  it('зелёный, если до визита 3 дня и больше', () => {
    expect(getDueStatus(3)).toBe('ok');
  });
});

describe('getDueProgress', () => {
  it('пустая шкала сразу после визита, полная в день визита', () => {
    const base = { lastVisitDate: '2026-09-29', nextVisitDate: '2026-10-02', intervalDays: 3 };
    expect(getDueProgress({ ...base, today: '2026-09-29' })).toBe(0);
    expect(getDueProgress({ ...base, today: '2026-09-30' })).toBeCloseTo(1 / 3);
    expect(getDueProgress({ ...base, today: '2026-10-02' })).toBe(1);
    expect(getDueProgress({ ...base, today: '2026-10-05' })).toBe(1);
  });

  it('без истории считает от интервала', () => {
    expect(getDueProgress({ lastVisitDate: null, nextVisitDate: '2026-09-30', intervalDays: 2, today: TODAY })).toBe(0.5);
  });
});

describe('buildTodayPlan', () => {
  const patients = [
    patient({ id: 'late', nextVisitDate: '2026-09-27' }),
    patient({ id: 'today', nextVisitDate: TODAY }),
    patient({ id: 'tomorrow', nextVisitDate: '2026-09-30' }),
    patient({ id: 'in3', nextVisitDate: '2026-10-02' }),
    patient({ id: 'in3b', nextVisitDate: '2026-10-02' }),
    patient({ id: 'far', nextVisitDate: '2026-10-20' }),
    patient({ id: 'done', nextVisitDate: '2026-10-02' }),
    patient({ id: 'doneTomorrow', nextVisitDate: '2026-09-30', intervalDays: 1 }),
    patient({ id: 'archived', nextVisitDate: '2026-09-01', archived: true }),
  ];
  const visits = [visit('done', TODAY), visit('doneTomorrow', TODAY), visit('late', '2026-09-24')];
  const plan = buildTodayPlan(describeActivePatients(patients, visits, TODAY), TODAY);
  const ids = (items: { patient: Patient }[]) => items.map((item) => item.patient.id);

  it('раскладывает пациентов по срочности', () => {
    expect(ids(plan.overdue)).toEqual(['late']);
    expect(ids(plan.dueToday)).toEqual(['today']);
    expect(ids(plan.dueTomorrow)).toEqual(['doneTomorrow', 'tomorrow']);
    expect(plan.upcoming.map((group) => [group.date, ids(group.items)])).toEqual([['2026-10-02', ['in3', 'in3b']]]);
    expect(ids(plan.visitedToday)).toEqual(['done']);
    expect(plan.visitedTodayCount).toBe(2);
  });

  it('не показывает архивных', () => {
    const all = [...plan.overdue, ...plan.dueToday, ...plan.dueTomorrow, ...plan.visitedToday];
    expect(ids(all)).not.toContain('archived');
  });

  it('берёт последний визит из истории', () => {
    expect(plan.overdue[0]?.lastVisitDate).toBe('2026-09-24');
  });
});

describe('подписи', () => {
  it('formatInterval', () => {
    expect([1, 2, 3, 5, 7].map(formatInterval)).toEqual([
      'ежедневно', 'раз в 2 дня', 'раз в 3 дня', 'раз в 5 дней', 'раз в 7 дней',
    ]);
  });

  it('formatDueLabel', () => {
    expect(formatDueLabel(-2, '2026-09-27')).toBe('Просрочено на 2 дня');
    expect(formatDueLabel(0, TODAY)).toBe('Визит сегодня');
    expect(formatDueLabel(1, '2026-09-30')).toBe('Визит завтра, 30.09, ср');
    expect(formatDueLabel(4, '2026-10-03')).toBe('Визит через 4 дня, 03.10, сб');
  });
});

describe('прогноз по графику', () => {
  it('раз в 3 дня от следующего визита', async () => {
    const { isPlannedOn } = await import('./schedule.ts');
    const p = patient({ id: 'a', nextVisitDate: '2026-10-01', intervalDays: 3 });
    const planned = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-07'].map((d) => isPlannedOn(p, d, TODAY));
    expect(planned).toEqual([false, true, false, true, true]);
  });

  it('просроченный — сегодня, потом каждые N дней от сегодня', async () => {
    const { isPlannedOn } = await import('./schedule.ts');
    const p = patient({ id: 'b', nextVisitDate: '2026-09-27', intervalDays: 2 });
    expect(['2026-09-28', TODAY, '2026-09-30', '2026-10-01'].map((d) => isPlannedOn(p, d, TODAY))).toEqual([
      false, true, false, true,
    ]);
  });

  it('архивные не планируются', async () => {
    const { isPlannedOn } = await import('./schedule.ts');
    expect(isPlannedOn(patient({ id: 'c', nextVisitDate: TODAY, archived: true }), TODAY, TODAY)).toBe(false);
  });

  it('сегодняшние сортируются по фамилии, время не учитывается', () => {
    const list = [
      patient({ id: 'v', nextVisitDate: TODAY, fullName: 'Волков', visitTime: '09:00' }),
      patient({ id: 'a', nextVisitDate: TODAY, fullName: 'Абрамов', visitTime: '14:00' }),
      patient({ id: 'p', nextVisitDate: TODAY, fullName: 'Петров' }),
    ];
    const plan = buildTodayPlan(describeActivePatients(list, [], TODAY), TODAY);
    expect(plan.dueToday.map((d) => d.patient.id)).toEqual(['a', 'v', 'p']);
  });
});

describe('госпитализация — пауза', () => {
  it('пациент в больнице не попадает в план и в расписание', () => {
    const home = patient({ id: 'home', nextVisitDate: TODAY });
    const away = patient({ id: 'away', nextVisitDate: '2026-09-20', hospital: { since: '2026-09-25', note: 'ГКБ №1' } });
    const dues = describeActivePatients([home, away], [], TODAY);
    expect(dues.map((due) => due.patient.id)).toEqual(['home']);
  });
});
