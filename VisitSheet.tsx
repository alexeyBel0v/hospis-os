import { useState } from 'react';
import type { IsoDate, Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { addDays, daysBetween, formatDayShortMonth, formatLongDate, isIsoDate } from '../lib/dates.ts';
import { intervalLong } from '../lib/format.ts';
import { recordVisit } from '../lib/patients.ts';
import { suggestNextVisitDate } from '../lib/schedule.ts';
import { hapticSuccess } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { Sheet } from './Sheet.tsx';
import { Segmented } from './ui.tsx';

type Props = { patient: Patient; today: IsoDate; onClose: () => void };

const OFFSETS = [1, 2, 3, 4, 5, 7, 10];

type WhenChoice = 'today' | 'yesterday' | 'other';

/** Отметить визит: следующая дата выбирается одной кнопкой (по графику уже выбрана), плюс заметка. */
export const VisitSheet = ({ patient, today, onClose }: Props) => {
  const { data, update } = useAppData();
  const { showToast } = useToast();
  const [when, setWhen] = useState<WhenChoice>('today');
  const [otherDate, setOtherDate] = useState<IsoDate>(addDays(today, -2));
  const [offset, setOffset] = useState<number | 'custom'>(OFFSETS.includes(patient.intervalDays) ? patient.intervalDays : 'custom');
  const [customDate, setCustomDate] = useState<IsoDate>(suggestNextVisitDate(today, patient.intervalDays));
  const [note, setNote] = useState('');

  const visitDate = when === 'today' ? today : when === 'yesterday' ? addDays(today, -1) : otherDate;
  const validVisit = isIsoDate(visitDate) && visitDate <= today;
  const nextDate = offset === 'custom' ? customDate : addDays(validVisit ? visitDate : today, offset);
  const scheduled = suggestNextVisitDate(validVisit ? visitDate : today, patient.intervalDays);
  const nextError = !isIsoDate(nextDate)
    ? 'Укажите дату'
    : validVisit && daysBetween(visitDate, nextDate) <= 0
      ? 'Следующий визит должен быть позже этого'
      : undefined;
  const canSave = validVisit && !nextError;

  const save = () => {
    if (!canSave) return;
    const before = data;
    update((current) => recordVisit(current, patient.id, { visitDate, nextVisitDate: nextDate, note }));
    hapticSuccess();
    onClose();
    showToast(`Визит отмечен. Следующий — ${formatDayShortMonth(nextDate)}`, {
      label: 'Отменить',
      onAction: () => update(() => before),
    });
  };

  return (
    <Sheet title="Отметить визит" subtitle={patient.fullName} onClose={onClose}>
      <div className="field">
        <span className="field__label">Когда был визит</span>
        <Segmented<WhenChoice>
          label="Когда был визит"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'today', label: 'Сегодня' },
            { value: 'yesterday', label: 'Вчера' },
            { value: 'other', label: 'Другой день' },
          ]}
        />
        {when === 'other' && (
          <input
            className={cn('input', !validVisit && 'input--error')}
            type="date"
            value={otherDate}
            max={today}
            aria-label="Дата визита"
            onChange={(event) => setOtherDate(event.target.value)}
          />
        )}
        {!validVisit && <p className="field__error">Визит не может быть в будущем</p>}
      </div>

      <div className="field">
        <span className="field__label">Когда следующий визит?</span>
        <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {OFFSETS.map((days) => (
            <button
              key={days}
              type="button"
              className={cn('chip chip--tall', offset === days && 'chip--on')}
              onClick={() => setOffset(days)}
            >
              <span>+{days}</span>
              <span className="chip__sub">{formatDayShortMonth(addDays(validVisit ? visitDate : today, days))}</span>
            </button>
          ))}
          <button
            type="button"
            className={cn('chip chip--tall', offset === 'custom' && 'chip--on')}
            onClick={() => setOffset('custom')}
          >
            <span>Дата</span>
            <span className="chip__sub">выбрать</span>
          </button>
        </div>
        {offset === 'custom' && (
          <input
            className={cn('input', nextError && 'input--error')}
            type="date"
            value={customDate}
            aria-label="Дата следующего визита"
            onChange={(event) => setCustomDate(event.target.value)}
          />
        )}
        {nextError ? (
          <p className="field__error">{nextError}</p>
        ) : (
          <p className="field__hint">
            По графику ({intervalLong(patient.intervalDays)}) — {formatLongDate(scheduled)}
          </p>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="visit-note">
          Заметка <span className="field__opt">необязательно</span>
        </label>
        <textarea
          id="visit-note"
          className="input textarea"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Состояние, что сделать в следующий раз"
        />
      </div>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save} disabled={!canSave}>
        Сохранить · следующий {isIsoDate(nextDate) ? formatDayShortMonth(nextDate) : '…'}
      </button>
    </Sheet>
  );
};
