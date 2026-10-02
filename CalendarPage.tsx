import { useMemo, useState } from 'react';
import type { IsoDate } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToday } from '../hooks/useToday.ts';
import { addDays, formatLongDate } from '../lib/dates.ts';
import { describeActivePatients, getPlannedForDate, groupVisitsByDate, isPlannedOn } from '../lib/schedule.ts';
import { patientInfo } from '../lib/format.ts';
import { PatientRow } from '../components/PatientRow.tsx';
import { SectionTitle } from '../components/ui.tsx';
import { CheckIcon, ChevronLeftIcon } from '../components/icons.tsx';
import { cn } from '../utils/cn.ts';

type Props = { onOpenPatient: (patientId: string) => void };

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_HEADERS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const firstOfMonth = (iso: IsoDate): IsoDate => `${iso.slice(0, 7)}-01`;

const shiftMonth = (monthStart: IsoDate, delta: number): IsoDate => {
  const [year = 0, month = 1] = monthStart.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
};

/** Все дни сетки месяца: с понедельника первой недели. null — пустая клетка до 1-го числа. */
const monthCells = (monthStart: IsoDate): Array<IsoDate | null> => {
  const weekday = (new Date(`${monthStart}T12:00:00`).getDay() + 6) % 7;
  const cells: Array<IsoDate | null> = Array.from({ length: weekday }, () => null);
  for (let date = monthStart; date.slice(0, 7) === monthStart.slice(0, 7); date = addDays(date, 1)) cells.push(date);
  return cells;
};

export const CalendarPage = ({ onOpenPatient }: Props) => {
  const { data } = useAppData();
  const today = useToday();
  const [month, setMonth] = useState<IsoDate>(firstOfMonth(today));
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<IsoDate>(today);

  const visitsByDate = useMemo(() => groupVisitsByDate(data.visits), [data.visits]);
  const dues = useMemo(() => describeActivePatients(data.patients, data.visits, today), [data, today]);
  const namesById = useMemo(() => new Map(data.patients.map((patient) => [patient.id, patient.fullName])), [data.patients]);
  const cells = useMemo(() => monthCells(month), [month]);
  const [year, monthNumber] = month.split('-').map(Number);

  const plannedCount = (date: IsoDate): number =>
    date < today ? 0 : data.patients.filter((patient) => isPlannedOn(patient, date, today)).length;
  const doneVisits = visitsByDate.get(selected) ?? [];
  const planned = selected >= today ? getPlannedForDate(dues, selected, today) : [];

  return (
    <main className="page">
      <header className="page-head__text">
        <h1 className="h1">Календарь</h1>
        <span className="muted">Отмеченные визиты и прогноз по графику</span>
      </header>

      <div className="card calendar">
        <div className="calendar__header">
          <button type="button" className="icon-btn icon-btn--round" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
            <ChevronLeftIcon />
          </button>
          <span className="calendar__title">
            {MONTHS[(monthNumber ?? 1) - 1]} {year}
          </span>
          <button type="button" className="icon-btn icon-btn--round" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Следующий месяц">
            <ChevronLeftIcon className="flip" />
          </button>
        </div>

        <div className="calendar__grid" role="grid">
          {WEEKDAY_HEADERS.map((name) => (
            <span key={name} className="calendar__weekday">
              {name}
            </span>
          ))}
          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} />;
            const done = visitsByDate.get(date)?.length ?? 0;
            const plan = plannedCount(date);
            return (
              <button
                key={date}
                type="button"
                className={cn(
                  'calendar__day',
                  date === today && 'calendar__day--today',
                  date === selected && 'calendar__day--selected',
                  date < today && 'calendar__day--past',
                )}
                onClick={() => setSelected(date)}
                aria-label={`${formatLongDate(date)}: отмечено ${done}, по плану ${plan}`}
              >
                <span className="calendar__number">{Number(date.slice(8))}</span>
                <span className="calendar__marks">
                  {done > 0 && <span className="calendar__mark calendar__mark--done">{done}</span>}
                  {plan > 0 && <span className="calendar__mark calendar__mark--plan">{plan}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="calendar__legend">
          <span>
            <i className="calendar__mark calendar__mark--done">2</i> отмечено
          </span>
          <span>
            <i className="calendar__mark calendar__mark--plan">3</i> по графику
          </span>
          {firstOfMonth(today) !== month && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMonth(firstOfMonth(today));
                setSelected(today);
              }}
            >
              К сегодня
            </button>
          )}
        </div>
      </div>

      {selected >= today && (
        <section className="stack">
          <SectionTitle count={planned.length}>{selected === today ? 'Сегодня по графику' : formatLongDate(selected)}</SectionTitle>
          {planned.length > 0 ? (
            planned.map((due, index) => (
              <PatientRow
                key={due.patient.id}
                patient={due.patient}
                tone={due.daysUntilDue < 0 ? 'late' : 'soon'}
                today={today}
                sub={patientInfo(due.patient, data.settings.subline) || 'без полиса'}
                expanded={openId === due.patient.id}
                onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
                onOpen={onOpenPatient}
                index={index}
              />
            ))
          ) : (
            <p className="empty-note">По графику визитов нет.</p>
          )}
        </section>
      )}

      {(selected <= today || doneVisits.length > 0) && (
        <section className="stack">
          <SectionTitle count={doneVisits.length}>{selected === today ? 'Отмечено сегодня' : `Отмечено ${formatLongDate(selected)}`}</SectionTitle>
          {doneVisits.length > 0 ? (
            <div className="list">
              {doneVisits.map((visit) => (
                <button key={visit.id} type="button" className="lrow" onClick={() => onOpenPatient(visit.patientId)}>
                  <span className="check check--done" style={{ width: 28, height: 28, borderWidth: 0 }} aria-hidden="true">
                    <CheckIcon width={16} height={16} strokeWidth={2.6} />
                  </span>
                  <span className="lrow__main">
                    <span className="prow__name">{namesById.get(visit.patientId) ?? 'Удалённый пациент'}</span>
                    {visit.note && <span className="prow__sub" style={{ whiteSpace: 'normal' }}>{visit.note}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-note">В этот день визитов не отмечено.</p>
          )}
        </section>
      )}
    </main>
  );
};
