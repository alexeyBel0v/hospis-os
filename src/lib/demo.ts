import type { AppData, Patient, Settings, Visit } from '../types/index.ts';
import { addDays } from './dates.ts';
import { DEFAULT_SETTINGS, EMPTY_ALLERGY, EMPTY_CATHETER } from './patients.ts';

/**
 * Пример с тремя вымышленными пациентами — разные графики, с катетером и без.
 * Чтобы посмотреть, как всё работает; удаляется в настройках.
 */
export const createDemoData = (today: string, settings: Settings = DEFAULT_SETTINGS): AppData => {
  const now = new Date().toISOString();
  const base = { archived: false, createdAt: now, updatedAt: now, intercom: '', wounds: {}, oxygen: false };

  const patients: Patient[] = [
    {
      ...base,
      id: 'demo-1',
      fullName: 'Иванова Галина Петровна',
      policy: '7700 1234 5678 0001',
      address: 'ул. Ленина, 15, кв. 4',
      intercom: 'Код 45К, подъезд 2, этаж 3',
      phones: [
        { number: '+7 909 909-97-97', who: 'Пациентка' },
        { number: '+7 909 111-22-33', who: 'Марина, дочь · звонить вечером' },
      ],
      comment: 'Лежачая, переворачивать вдвоём. Перед визитом позвонить дочери.',
      intervalDays: 1,
      visitTime: '09:00',
      nextVisitDate: today,
      catheter: { type: 'urinary', size: 16, note: '', installedOn: addDays(today, -10) },
      allergy: { has: true, items: ['Йод'], note: 'Покраснение кожи' },
      wounds: { sacrum: 2, heelR: 1 },
    },
    {
      ...base,
      id: 'demo-2',
      fullName: 'Петров Николай Сергеевич',
      policy: '7700 2345 6789 0002',
      address: 'Профсоюзная ул., 104, кв. 12',
      phones: [{ number: '+7 916 222-33-44', who: 'Пациент' }],
      comment: '',
      intervalDays: 3,
      visitTime: '11:30',
      nextVisitDate: addDays(today, -1),
      catheter: { ...EMPTY_CATHETER },
      allergy: { ...EMPTY_ALLERGY, items: [] },
      oxygen: true,
    },
    {
      ...base,
      id: 'demo-3',
      fullName: 'Смирнова Анна Викторовна',
      policy: '7700 3456 7890 0003',
      address: 'Ленинский пр-т, 32, кв. 7',
      phones: [{ number: '+7 925 555-66-77', who: 'Олег, сын' }],
      comment: '',
      intervalDays: 7,
      visitTime: '',
      nextVisitDate: addDays(today, 3),
      catheter: { type: 'cysto', size: 18, note: '', installedOn: addDays(today, -20) },
      allergy: { ...EMPTY_ALLERGY, items: [] },
    },
  ];

  const visits: Visit[] = [
    { id: 'demo-1-v1', patientId: 'demo-1', date: addDays(today, -1), note: 'Обработка пролежня на крестце, давление в норме.', createdAt: now },
    { id: 'demo-1-v2', patientId: 'demo-1', date: addDays(today, -2), note: '', createdAt: now },
    { id: 'demo-2-v1', patientId: 'demo-2', date: addDays(today, -4), note: 'Концентратор работает, жалоб нет.', createdAt: now },
    { id: 'demo-3-v1', patientId: 'demo-3', date: addDays(today, -4), note: 'Промывание цистостомы.', createdAt: now },
  ];

  return { schemaVersion: 1, patients, visits, settings: { ...settings } };
};
