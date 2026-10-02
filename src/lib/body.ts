import type { CatheterType, Wounds } from '../types/index.ts';

export type BodyView = 'front' | 'back';

export type BodyZone = {
  id: string;
  name: string;
  /** Сторона пациента: «лев.» / «прав.», пусто — по центру. */
  side: string;
  view: BodyView;
  /** Координаты центра на фигуре 140×320. */
  x: number;
  y: number;
};

/** Типичные места пролежней. На виде сзади левая сторона пациента слева, спереди — справа. */
export const BODY_ZONES: BodyZone[] = [
  { id: 'occiput', name: 'Затылок', side: '', view: 'back', x: 70, y: 20 },
  { id: 'scapL', name: 'Лопатка', side: 'лев.', view: 'back', x: 52, y: 84 },
  { id: 'scapR', name: 'Лопатка', side: 'прав.', view: 'back', x: 88, y: 84 },
  { id: 'elbowL', name: 'Локоть', side: 'лев.', view: 'back', x: 25, y: 140 },
  { id: 'elbowR', name: 'Локоть', side: 'прав.', view: 'back', x: 115, y: 140 },
  { id: 'sacrum', name: 'Крестец', side: '', view: 'back', x: 70, y: 150 },
  { id: 'coccyx', name: 'Копчик', side: '', view: 'back', x: 70, y: 172 },
  { id: 'ischL', name: 'Седалищный бугор', side: 'лев.', view: 'back', x: 55, y: 186 },
  { id: 'ischR', name: 'Седалищный бугор', side: 'прав.', view: 'back', x: 85, y: 186 },
  { id: 'heelL', name: 'Пятка', side: 'лев.', view: 'back', x: 54, y: 312 },
  { id: 'heelR', name: 'Пятка', side: 'прав.', view: 'back', x: 86, y: 312 },
  { id: 'troR', name: 'Бедро (вертел)', side: 'прав.', view: 'front', x: 39, y: 160 },
  { id: 'troL', name: 'Бедро (вертел)', side: 'лев.', view: 'front', x: 101, y: 160 },
  { id: 'kneeR', name: 'Колено', side: 'прав.', view: 'front', x: 55, y: 252 },
  { id: 'kneeL', name: 'Колено', side: 'лев.', view: 'front', x: 85, y: 252 },
  { id: 'ankleR', name: 'Лодыжка', side: 'прав.', view: 'front', x: 52, y: 300 },
  { id: 'ankleL', name: 'Лодыжка', side: 'лев.', view: 'front', x: 88, y: 300 },
];

const ZONE_BY_ID = new Map(BODY_ZONES.map((zone) => [zone.id, zone]));

export const findZone = (id: string): BodyZone | undefined => ZONE_BY_ID.get(id);

export const zoneLabel = (zone: BodyZone): string => (zone.side ? `${zone.name} ${zone.side}` : zone.name);

export const countWounds = (wounds: Wounds, view?: BodyView): number =>
  Object.keys(wounds).filter((id) => {
    const zone = findZone(id);
    return zone && (!view || zone.view === view);
  }).length;

export const CATHETER_SIZES = [14, 16, 18, 20, 22, 24, 26, 28] as const;

export const CATHETER_TYPES: Array<{ type: CatheterType; short: string; full: string; place: string }> = [
  { type: 'none', short: 'Нет', full: 'Нет', place: '' },
  { type: 'urinary', short: 'Мочевой', full: 'Мочевой (уретральный)', place: 'Уретра' },
  { type: 'cysto', short: 'Цистостома', full: 'Цистостома', place: 'Над лобком' },
  { type: 'other', short: 'Другой', full: 'Другой катетер', place: '' },
];

export const catheterInfo = (type: CatheterType) =>
  CATHETER_TYPES.find((item) => item.type === type) ?? CATHETER_TYPES[0]!;

/** Где показать метку катетера на передней фигуре. */
export const CATHETER_MARK: Record<Exclude<CatheterType, 'none'>, { x: number; y: number }> = {
  urinary: { x: 70, y: 186 },
  cysto: { x: 70, y: 166 },
  other: { x: 70, y: 140 },
};

export const ALLERGEN_PRESETS = ['Антибиотики', 'Пенициллины', 'Йод', 'Латекс', 'Пластырь', 'Новокаин'];
