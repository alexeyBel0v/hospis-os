import { describe, expect, it } from 'vitest';
import type { AppData, PatientInput } from '../types/index.ts';
import { addPatient, createEmptyData, emptyPatientInput, recordVisit, type Context } from './patients.ts';
import { buildShareText, mergeData, parseShareText } from './share.ts';

const ctx = (prefix: string): Context => {
  let n = 0;
  return { now: () => '2026-10-02T10:00:00.000Z', newId: () => `${prefix}${(n += 1)}` };
};

const person = (patch: Partial<PatientInput>): PatientInput => ({ ...emptyPatientInput('2026-10-05'), ...patch });

const build = (prefix: string, people: PatientInput[]): AppData =>
  people.reduce((data, p) => addPatient(data, p, ctx(prefix + data.patients.length)).data, createEmptyData());

describe('обмен пациентами', () => {
  it('копия содержит только выбранных пациентов и их визиты', () => {
    let data = build('a', [person({ fullName: 'Иванов И. И.' }), person({ fullName: 'Петров П. П.' })]);
    const first = data.patients[0]?.id ?? '';
    data = recordVisit(data, first, { visitDate: '2026-10-01', nextVisitDate: '2026-10-04', note: '' });
    const shared = parseShareText(buildShareText(data, [first]));
    expect(shared.patients.map((p) => p.fullName)).toEqual(['Иванов И. И.']);
    expect(shared.visits).toHaveLength(1);
  });

  it('новых добавляет, одинаковых по полису склеивает в одного', () => {
    const mine = build('m', [
      person({ fullName: 'Иванов Иван', policy: '7700 1234 5678 0001', phones: [{ number: '+7 900 111-11-11', who: 'Пациент' }] }),
    ]);
    const theirs = build('t', [
      person({
        fullName: 'Иванов И.',
        policy: '7700123456780001',
        address: 'ул. Ленина, 15',
        nextVisitDate: '2026-10-03',
        phones: [
          { number: '8 900 111 11 11', who: 'Пациент' },
          { number: '+7 900 222-22-22', who: 'Дочь' },
        ],
        allergy: { has: true, items: ['Йод'], note: '' },
        wounds: { sacrum: 2 },
      }),
      person({ fullName: 'Сидорова Анна', policy: '7700 9999 0000 0002' }),
    ]);

    const { data, preview } = mergeData(mine, theirs, ctx('x'));
    expect(preview.added.map((p) => p.fullName)).toEqual(['Сидорова Анна']);
    expect(preview.merged).toHaveLength(1);
    expect(data.patients).toHaveLength(2);

    const merged = data.patients[0];
    expect(merged?.fullName).toBe('Иванов Иван');
    expect(merged?.address).toBe('ул. Ленина, 15');
    expect(merged?.phones.map((p) => p.who)).toEqual(['Пациент', 'Дочь']);
    expect(merged?.nextVisitDate).toBe('2026-10-03');
    expect(merged?.allergy.items).toEqual(['Йод']);
    expect(merged?.wounds).toEqual({ sacrum: 2 });
  });

  it('без полиса сравнивает по ФИО, повторный импорт ничего не дублирует', () => {
    let theirs = build('t', [person({ fullName: 'Орлова  Татьяна' })]);
    theirs = recordVisit(theirs, theirs.patients[0]?.id ?? '', { visitDate: '2026-10-01', nextVisitDate: '2026-10-03', note: 'ок' });
    const mine = build('m', [person({ fullName: 'орлова татьяна' })]);

    const once = mergeData(mine, theirs, ctx('x')).data;
    const twice = mergeData(once, theirs, ctx('y'));
    expect(twice.data.patients).toHaveLength(1);
    expect(twice.data.visits).toHaveLength(1);
    expect(twice.preview.newVisits).toBe(0);
  });
});
