/** Календарная дата без времени в формате YYYY-MM-DD. */
export type IsoDate = string;

export type Phone = {
  number: string;
  /** Чей номер: «Пациент», «Марина, дочь · звонить вечером». */
  who: string;
};

export type CatheterType = 'none' | 'urinary' | 'cysto' | 'other';

export type Catheter = {
  type: CatheterType;
  /** Размер по шкале Шарьера (Ch): 14…28. null — не указан. */
  size: number | null;
  /** Для «другого» — какой именно; для любого — где стоит, особенности. */
  note: string;
  installedOn: IsoDate | '';
};

export type Allergy = {
  has: boolean;
  items: string[];
  /** Другие аллергены и реакция. */
  note: string;
};

export type WoundStage = 1 | 2 | 3 | 4;

/** Раны по зонам тела: id зоны → стадия. Зоны описаны в lib/body.ts. */
export type Wounds = Record<string, WoundStage>;

/** Госпитализирован: визиты на паузе, пока не выпишут. */
export type Hospital = {
  since: IsoDate;
  /** Куда положили: «ГКБ №1, кардиология». */
  note: string;
};

export type Patient = {
  id: string;
  fullName: string;
  policy: string;
  /** Город, улица, дом (корпус) — без квартиры: по этой строке строится маршрут. */
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  /** Код домофона. */
  intercom: string;
  phones: Phone[];
  comment: string;
  /** Интервал между визитами в днях: 1 = ежедневно, 3 = раз в 3 дня. */
  intervalDays: number;
  /** Обычное время визита «09:30» или пусто. */
  visitTime: string;
  /** Дата следующего визита. Считается по графику, но всегда может быть поставлена вручную. */
  nextVisitDate: IsoDate;
  catheter: Catheter;
  allergy: Allergy;
  wounds: Wounds;
  /** Дома стоит кислородный концентратор. */
  oxygen: boolean;
  /** В больнице — не попадает в план, пока не отметят выписку. null — дома. */
  hospital: Hospital | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Отмеченный (состоявшийся) визит. Плановые визиты не хранятся — они вычисляются. */
export type Visit = {
  id: string;
  patientId: string;
  date: IsoDate;
  note: string;
  createdAt: string;
};

export type Subline = 'policy' | 'address' | 'phone';
export type ThemeChoice = 'telegram' | 'light' | 'dark';

export type Role = '' | 'nurse' | 'doctor' | 'other';

export type Settings = {
  /** Должность, выбранная при первом входе. Пусто — ещё не выбрана. */
  role: Role;
  defaultInterval: number;
  /** Что показывать под ФИО в списках. */
  subline: Subline;
  showTomorrow: boolean;
  haptics: boolean;
  theme: ThemeChoice;
  /** Когда последний раз делали резервную копию (ISO), пусто — ни разу. */
  lastBackupAt: string;
};

export type AppData = {
  schemaVersion: 1;
  patients: Patient[];
  visits: Visit[];
  settings: Settings;
};

export type PatientInput = Omit<Patient, 'id' | 'archived' | 'hospital' | 'createdAt' | 'updatedAt'>;
