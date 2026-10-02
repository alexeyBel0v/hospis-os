import type { CSSProperties } from 'react';
import type { Patient } from '../types/index.ts';
import { cn } from '../utils/cn.ts';
import { CheckIcon } from './icons.tsx';

export type RowTone = 'late' | 'today' | 'soon' | 'later' | 'done';

type Props = {
  patient: Patient;
  tone: RowTone;
  /** Время визита или дата (для «потом»). */
  timeLabel: string;
  sub: string;
  /** Красная метка справа, например «−2 дн». */
  chip?: string;
  onOpen: (patientId: string) => void;
  /** Кружок-галочка: отметить визит. Нет — галочки нет. */
  onCheck?: (patientId: string) => void;
  index?: number;
};

/** Тонкая строка пациента для экрана «Сегодня». */
/** Короткие метки: катетер, кислород, аллергия. */
export const PatientFlags = ({ patient }: { patient: Patient }) => (
  <>
    {patient.catheter.type !== 'none' && (
      <span className="flag flag--cath" title="Катетер">
        К
      </span>
    )}
    {patient.oxygen && (
      <span className="flag flag--o2" title="Кислородный концентратор">
        O₂
      </span>
    )}
    {patient.allergy.has && (
      <span className="flag flag--late" title="Аллергия">
        !
      </span>
    )}
  </>
);

export const PatientRow = ({ patient, tone, timeLabel, sub, chip, onOpen, onCheck, index = 0 }: Props) => {
  const done = tone === 'done';
  return (
    <div className={cn('prow', `prow--${tone}`)} style={{ '--i': Math.min(index, 10) } as CSSProperties}>
      <span className="prow__bar" aria-hidden="true" />
      <span className="prow__time">{timeLabel}</span>
      <button type="button" className="prow__main" onClick={() => onOpen(patient.id)}>
        <span className="prow__name">{patient.fullName}</span>
        <span className="prow__meta">
          <PatientFlags patient={patient} />
          {sub && <span className="prow__sub">{sub}</span>}
        </span>
      </button>
      {chip && !done && <span className="tag tag--xs tag--late">{chip}</span>}
      {onCheck && (
        <button
          type="button"
          className={cn('check', done && 'check--done')}
          aria-label={done ? `Визит отмечен: ${patient.fullName}` : `Отметить визит: ${patient.fullName}`}
          onClick={() => (done ? onOpen(patient.id) : onCheck(patient.id))}
        >
          <CheckIcon width={20} height={20} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
};
