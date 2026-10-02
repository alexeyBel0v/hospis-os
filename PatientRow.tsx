import type { CSSProperties, ReactNode } from 'react';
import type { IsoDate, Patient } from '../types/index.ts';
import { addressDetails, fullAddress } from '../lib/address.ts';
import { formatDayShortMonth } from '../lib/dates.ts';
import { initials, intervalLong, nextVisitLabel } from '../lib/format.ts';
import { callPhone, openExternalLink } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, NavigatorIcon, PhoneIcon } from './icons.tsx';

export type RowTone = 'late' | 'today' | 'soon' | 'later' | 'done' | 'plain';

type Props = {
  patient: Patient;
  tone: RowTone;
  today: IsoDate;
  /** Вторая строка под фамилией: обычно полис. */
  sub: string;
  /** Справа от имени: «−2 дн», «5 окт», «в больнице». */
  aside?: ReactNode;
  expanded: boolean;
  onToggle: (patientId: string) => void;
  /** Открыть полную карточку. */
  onOpen: (patientId: string) => void;
  /** Кружок-галочка: отметить визит. Нет — галочки нет. */
  onCheck?: (patientId: string) => void;
  index?: number;
};

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

const MAX_PHONES = 3;

const navigateTo = (address: string) => openExternalLink(`https://yandex.ru/maps/?rtext=~${encodeURIComponent(address)}&rtt=auto`);

/** Выдвижная часть строки: адрес, телефоны, когда следующий визит, комментарий — и вход в полную карточку. */
const PatientPeek = ({ patient, today, onOpen }: { patient: Patient; today: IsoDate; onOpen: (patientId: string) => void }) => {
  const details = addressDetails({ ...patient, apartment: '' });
  const when = patient.hospital
    ? `В больнице с ${formatDayShortMonth(patient.hospital.since)}${patient.hospital.note ? ` · ${patient.hospital.note}` : ''}`
    : `Следующий визит: ${nextVisitLabel(patient.nextVisitDate, today)} · ${intervalLong(patient.intervalDays)}`;

  return (
    <div className="peek">
      <p className="peek__name">{patient.fullName}</p>

      {(patient.address || details) && (
        <div className="peek__line">
          <span className="peek__text">
            <span>{fullAddress(patient) || 'Адрес не указан'}</span>
            {details && <span className="peek__muted">{details}</span>}
          </span>
          {patient.address && (
            <button type="button" className="icon-btn" aria-label="Маршрут на машине" onClick={() => navigateTo(patient.address)}>
              <NavigatorIcon width={18} height={18} />
            </button>
          )}
        </div>
      )}

      {patient.phones.slice(0, MAX_PHONES).map((phone, index) => (
        <div key={`${phone.number}-${index}`} className="peek__line">
          <span className="peek__text">
            <span className="num">{phone.number}</span>
            {phone.who && <span className="peek__muted">{phone.who}</span>}
          </span>
          <button type="button" className="icon-btn" aria-label={`Позвонить: ${phone.who || phone.number}`} onClick={() => callPhone(phone.number)}>
            <PhoneIcon width={18} height={18} />
          </button>
        </div>
      ))}

      <p className={cn('peek__when', patient.hospital && 'peek__when--hosp')}>{when}</p>
      {patient.comment && <p className="peek__comment">{patient.comment}</p>}

      <button type="button" className="btn btn--soft btn--block" onClick={() => onOpen(patient.id)}>
        Открыть карточку
        <ChevronRightIcon width={18} height={18} />
      </button>
    </div>
  );
};

/** Строка пациента: «Фамилия И. О.», ниже полис. Нажатие — выдвигается краткая информация. */
export const PatientRow = ({ patient, tone, today, sub, aside, expanded, onToggle, onOpen, onCheck, index = 0 }: Props) => {
  const done = tone === 'done';
  return (
    <div className={cn('prow-wrap', expanded && 'prow-wrap--open')} style={{ '--i': Math.min(index, 10) } as CSSProperties}>
      <div className={cn('prow', `prow--${tone}`)}>
        <span className="prow__bar" aria-hidden="true" />
        <button type="button" className="prow__main" aria-expanded={expanded} onClick={() => onToggle(patient.id)}>
          <span className="prow__title">
            <span className="prow__name">{initials(patient.fullName)}</span>
            <PatientFlags patient={patient} />
          </span>
          <span className="prow__sub">{sub}</span>
        </button>
        {aside}
        {onCheck ? (
          <button
            type="button"
            className={cn('check', done && 'check--done')}
            aria-label={done ? `Визит отмечен: ${patient.fullName}` : `Отметить визит: ${patient.fullName}`}
            onClick={() => (done ? onToggle(patient.id) : onCheck(patient.id))}
          >
            <CheckIcon width={20} height={20} strokeWidth={2.6} />
          </button>
        ) : (
          <ChevronDownIcon width={20} height={20} className={cn('chev prow__chev', expanded && 'chev--open')} />
        )}
      </div>
      {expanded && <PatientPeek patient={patient} today={today} onOpen={onOpen} />}
    </div>
  );
};

/** Что писать под фамилией: полис (или «без полиса»). */
export const policyLine = (patient: Patient): string => (patient.policy ? `Полис ${patient.policy}` : 'без полиса');
