import { useState } from 'react';
import type { IsoDate, Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { addDays, formatDayShortMonth, formatLongDate, isIsoDate } from '../lib/dates.ts';
import { setNextVisitDate } from '../lib/patients.ts';
import { hapticSuccess } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { Sheet } from './Sheet.tsx';

type Props = { patient: Patient; today: IsoDate; onClose: () => void };

const QUICK = [
  { label: 'Сегодня', days: 0 },
  { label: 'Завтра', days: 1 },
  { label: '+2', days: 2 },
  { label: '+3', days: 3 },
  { label: '+5', days: 5 },
  { label: '+7', days: 7 },
];

/** Перенести следующий визит на другую дату (без отметки визита). */
export const RescheduleSheet = ({ patient, today, onClose }: Props) => {
  const { update } = useAppData();
  const { showToast } = useToast();
  const [date, setDate] = useState<IsoDate>(patient.nextVisitDate);
  const valid = isIsoDate(date);

  const save = () => {
    if (!valid) return;
    const previous = patient.nextVisitDate;
    update((data) => setNextVisitDate(data, patient.id, date));
    hapticSuccess();
    onClose();
    showToast(`Визит перенесён на ${formatDayShortMonth(date)}`, {
      label: 'Отменить',
      onAction: () => update((data) => setNextVisitDate(data, patient.id, previous)),
    });
  };

  return (
    <Sheet title="Перенести визит" subtitle={`${patient.fullName} · сейчас ${formatDayShortMonth(patient.nextVisitDate)}`} onClose={onClose}>
      <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {QUICK.map((item) => {
          const value = addDays(today, item.days);
          return (
            <button
              key={item.label}
              type="button"
              className={cn('chip chip--tall', date === value && 'chip--on')}
              onClick={() => setDate(value)}
            >
              <span>{item.label}</span>
              <span className="chip__sub">{formatDayShortMonth(value)}</span>
            </button>
          );
        })}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="reschedule-date">
          Или выберите дату
        </label>
        <input
          id="reschedule-date"
          className={cn('input', !valid && 'input--error')}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {valid && <p className="field__hint">{formatLongDate(date)}</p>}
      </div>
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save} disabled={!valid}>
        Перенести на {valid ? formatDayShortMonth(date) : '…'}
      </button>
    </Sheet>
  );
};
