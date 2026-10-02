import { useState } from 'react';
import type { IsoDate, Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { addDays, formatDayShortMonth, formatLongDate, isIsoDate } from '../lib/dates.ts';
import { dischargePatient, setHospital } from '../lib/patients.ts';
import { hapticSuccess } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { Sheet } from './Sheet.tsx';

type Props = { patient: Patient; today: IsoDate; onClose: () => void };

type Quick = { label: string; days: number };

const ADMIT_DAYS: Quick[] = [
  { label: 'Сегодня', days: 0 },
  { label: 'Вчера', days: -1 },
  { label: '2 дня назад', days: -2 },
];

const RETURN_DAYS: Quick[] = [
  { label: 'Сегодня', days: 0 },
  { label: 'Завтра', days: 1 },
  { label: 'Послезавтра', days: 2 },
];

type DatePickProps = { id: string; label: string; today: IsoDate; quick: Quick[]; value: IsoDate; onChange: (date: IsoDate) => void };

const DatePick = ({ id, label, today, quick, value, onChange }: DatePickProps) => {
  const valid = isIsoDate(value);
  return (
    <>
      <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {quick.map((item) => {
          const date = addDays(today, item.days);
          return (
            <button key={item.label} type="button" className={cn('chip chip--tall', value === date && 'chip--on')} onClick={() => onChange(date)}>
              <span>{item.label}</span>
              <span className="chip__sub">{formatDayShortMonth(date)}</span>
            </button>
          );
        })}
      </div>
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <input id={id} className={cn('input', !valid && 'input--error')} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
        {valid && <p className="field__hint">{formatLongDate(value)}</p>}
      </div>
    </>
  );
};

/** Госпитализация: визиты на паузе. Или выписка: вернуть в график с выбранной даты. */
export const HospitalSheet = ({ patient, today, onClose }: Props) => {
  const { update } = useAppData();
  const { showToast } = useToast();
  const inHospital = Boolean(patient.hospital);
  const [date, setDate] = useState<IsoDate>(today);
  const [note, setNote] = useState('');
  const valid = isIsoDate(date);
  const previous = patient.hospital;
  const previousNext = patient.nextVisitDate;

  const undo = () =>
    update((data) => {
      const restored = setHospital(data, patient.id, previous);
      return {
        ...restored,
        patients: restored.patients.map((item) => (item.id === patient.id ? { ...item, nextVisitDate: previousNext } : item)),
      };
    });

  const save = () => {
    if (!valid) return;
    if (inHospital) update((data) => dischargePatient(data, patient.id, date));
    else update((data) => setHospital(data, patient.id, { since: date, note: note.trim() }));
    hapticSuccess();
    onClose();
    showToast(inHospital ? `Снова в графике — визит ${formatDayShortMonth(date)}` : 'В больнице — визиты на паузе', {
      label: 'Отменить',
      onAction: undo,
    });
  };

  if (inHospital) {
    return (
      <Sheet title="Выписали домой" subtitle={`${patient.fullName} · когда первый визит?`} onClose={onClose}>
        <DatePick id="return-date" label="Или другая дата" today={today} quick={RETURN_DAYS} value={date} onChange={setDate} />
        <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!valid} onClick={save}>
          Вернуть в график · {valid ? formatDayShortMonth(date) : '…'}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Госпитализирован" subtitle="Визиты встанут на паузу и не будут считаться просроченными" onClose={onClose}>
      <DatePick id="admit-date" label="Дата госпитализации" today={today} quick={ADMIT_DAYS} value={date} onChange={setDate} />
      <div className="field">
        <label className="field__label" htmlFor="hospital-note">
          Куда положили <span className="field__opt">необязательно</span>
        </label>
        <input
          id="hospital-note"
          className="input"
          value={note}
          placeholder="ГКБ №1, кардиология"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!valid} onClick={save}>
        Поставить на паузу
      </button>
    </Sheet>
  );
};
