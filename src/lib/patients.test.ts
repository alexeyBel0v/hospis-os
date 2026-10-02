import { describe, expect, it } from 'vitest';
import type { PatientInput } from '../types/index.ts';
import { DataFormatError, parseAppData, parseAppDataJson } from './appData.ts';
import {
  addPatient,
  createEmptyData,
  emptyPatientInput,
  findByPolicy,
  getLastVisitDate,
  getPatientVisits,
  matchesQuery,
  patchPatient,
  recordVisit,
  removePatient,
  removeVisit,
  setArchived,
  type Context,
} from './patients.ts';

const testContext = (): Context => {
  let counter = 0;
  return { now: () => '2026-09-29T10:00:00.000Z', newId: () => `id${(counter += 1)}` };
};

const input: PatientInput = {
  ...emptyPatientInput('2026-10-01'),
  fullName: '  Иванов   Иван Иванович ',
  address: 'ул. Ленина, 15',
  phones: [
    { number: '+7 (903) 578-73-78', who: 'Пациент' },
    { number: '  ', who: 'пустой' },
  ],
  policy: '7700 1234 5678 9012',
  visitTime: '09:30',
  catheter: { type: 'urinary', size: 16, note: '', installedOn: '' },
  allergy: { has: true, items: ['Йод', 'Йод', 'Латекс'], note: ' сыпь ' },
};

describe('пациенты и визиты', () => {
  it('добавляет пациента и чистит поля', () => {
    const { data, patientId } = addPatient(createEmptyData(), input, testContext());
    const patient = data.patients[0];
    expect(patientId).toBe('id1');
    expect(patient?.fullName).toBe('Иванов Иван Иванович');
    expect(patient?.phones).toEqual([{ number: '+7 903 578-73-78', who: 'Пациент' }]);
    expect(patient?.allergy).toEqual({ has: true, items: ['Йод', 'Латекс'], note: 'сыпь' });
  });

  it('без аллергии список аллергенов очищается, без катетера — размер', () => {
    const { data } = addPatient(
      createEmptyData(),
      {
        ...input,
        allergy: { has: false, items: ['Йод'], note: 'x' },
        catheter: { type: 'none', size: 18, note: 'x', installedOn: '' },
      },
      testContext(),
    );
    expect(data.patients[0]?.allergy.items).toEqual([]);
    expect(data.patients[0]?.catheter.size).toBeNull();
  });

  it('отметка визита ставит выбранную дату следующего визита', () => {
    const ctx = testContext();
    const created = addPatient(createEmptyData(), input, ctx);
    const data = recordVisit(created.data, created.patientId, { visitDate: '2026-09-29', nextVisitDate: '2026-10-03', note: ' ок ' }, ctx);
    expect(data.patients[0]?.nextVisitDate).toBe('2026-10-03');
    expect(getLastVisitDate(data, created.patientId)).toBe('2026-09-29');
    expect(getPatientVisits(data, created.patientId)[0]?.note).toBe('ок');
  });

  it('раны меняются прямо из карточки', () => {
    const created = addPatient(createEmptyData(), input, testContext());
    const data = patchPatient(created.data, created.patientId, { wounds: { sacrum: 2 } });
    expect(data.patients[0]?.wounds).toEqual({ sacrum: 2 });
  });

  it('удаление визита и пациента', () => {
    const ctx = testContext();
    const created = addPatient(createEmptyData(), input, ctx);
    const visited = recordVisit(created.data, created.patientId, { visitDate: '2026-09-29', nextVisitDate: '2026-10-02', note: '' }, ctx);
    expect(removeVisit(visited, visited.visits[0]?.id ?? '').visits).toHaveLength(0);
    const removed = removePatient(visited, created.patientId);
    expect(removed.patients).toHaveLength(0);
    expect(removed.visits).toHaveLength(0);
  });

  it('архивирует и возвращает', () => {
    const created = addPatient(createEmptyData(), input, testContext());
    const archived = setArchived(created.data, created.patientId, true);
    expect(archived.patients[0]?.archived).toBe(true);
    expect(setArchived(archived, created.patientId, false).patients[0]?.archived).toBe(false);
  });

  it('находит дубль по полису независимо от пробелов', () => {
    const { data } = addPatient(createEmptyData(), input, testContext());
    expect(findByPolicy(data.patients, '7700123456789012')?.fullName).toBe('Иванов Иван Иванович');
    expect(findByPolicy(data.patients, '12')).toBeUndefined();
  });
});

describe('поиск', () => {
  const { data } = addPatient(createEmptyData(), input, testContext());
  const patient = data.patients[0];
  if (!patient) throw new Error('нет пациента');

  it.each(['иванов', 'ЛЕНИНА', '9035787378', '578-73', '1234 5678'])('находит по «%s»', (query) => {
    expect(matchesQuery(patient, query)).toBe(true);
  });

  it('не находит лишнего', () => {
    expect(matchesQuery(patient, 'Петров')).toBe(false);
  });
});

describe('копия данных', () => {
  it('принимает свою же копию', () => {
    const { data } = addPatient(createEmptyData(), input, testContext());
    expect(parseAppDataJson(JSON.stringify(data))).toEqual(data);
  });

  it('понимает данные версии 0.2: телефон строкой и катетер да/нет', () => {
    const old = {
      schemaVersion: 1,
      patients: [
        {
          id: 'a', fullName: 'Старый Пациент', phone: '+7 900 000-00-00', policy: '', address: '', comment: '',
          intervalDays: 3, catheter: true, visitTime: '', nextVisitDate: '2026-10-01', archived: false,
          createdAt: '', updatedAt: '',
        },
      ],
      visits: [],
    };
    const parsed = parseAppData(old);
    expect(parsed.patients[0]?.phones).toEqual([{ number: '+7 900 000-00-00', who: 'Пациент' }]);
    expect(parsed.patients[0]?.catheter.type).toBe('other');
    expect(parsed.patients[0]?.allergy.has).toBe(false);
    expect(parsed.settings.defaultInterval).toBe(3);
  });

  it('понятно ругается на чужой текст', () => {
    expect(() => parseAppDataJson('не json')).toThrow(DataFormatError);
    expect(() => parseAppDataJson('{"foo":1}')).toThrow('Это не похоже на копию Hospis OS.');
  });
});
