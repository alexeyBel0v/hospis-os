import { useMemo, useState } from 'react';
import type { IsoDate, Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToday } from '../hooks/useToday.ts';
import { addDays, formatDayMonth, formatDayShortMonth, formatLongDate, formatWeekday, formatWeekdayShort } from '../lib/dates.ts';
import { createDemoData } from '../lib/demo.ts';
import { patientSubline } from '../lib/format.ts';
import { findPatient } from '../lib/patients.ts';
import { byVisitTime, countPlannedByDate, describeActivePatients, getPlannedForDate, type PatientDue } from '../lib/schedule.ts';
import { openExternalLink } from '../lib/telegram.ts';
import { PatientRow, type RowTone } from '../components/PatientRow.tsx';
import { VisitSheet } from '../components/VisitSheet.tsx';
import { ChevronRightIcon, PlusIcon, RouteIcon } from '../components/icons.tsx';
import { SectionTitle } from '../components/ui.tsx';

type Props = {
  onOpenPatient: (patientId: string) => void;
  onAddPatient: () => void;
  onOpenAll: () => void;
};

const STRIP_DAYS = 7;
const LATER_DAYS = 7;

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const TodayPage = ({ onOpenPatient, onAddPatient, onOpenAll }: Props) => {
  const { data, notice, replaceAll } = useAppData();
  const today = useToday();
  const [visitPatient, setVisitPatient] = useState<Patient | null>(null);
  const [selectedDay, setSelectedDay] = useState<IsoDate>(today);
  const { subline, showTomorrow } = data.settings;

  const dues = useMemo(() => describeActivePatients(data.patients, data.visits, today), [data, today]);
  const stripDates = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)), [today]);
  const counts = useMemo(() => countPlannedByDate(data.patients, stripDates, today), [data.patients, stripDates, today]);
  const day = stripDates.includes(selectedDay) ? selectedDay : today;

  const isDone = (due: PatientDue) => due.lastVisitDate === today;
  const overdue = dues.filter((due) => due.daysUntilDue < 0 && !isDone(due));
  const todayList = dues.filter((due) => due.daysUntilDue === 0 || isDone(due)).sort(byVisitTime);
  const tomorrow = dues.filter((due) => due.daysUntilDue === 1 && !isDone(due)).sort(byVisitTime);
  const later = dues.filter((due) => due.daysUntilDue >= 2 && due.daysUntilDue < LATER_DAYS && !isDone(due));

  const doneCount = todayList.filter(isDone).length;
  const total = overdue.length + todayList.length;
  const next = overdue[0] ?? todayList.find((due) => !isDone(due));
  const activeCount = dues.length;

  const openVisit = (patientId: string) => setVisitPatient(findPatient(data, patientId) ?? null);

  const row = (due: PatientDue, tone: RowTone, index: number, timeLabel?: string, chip?: string) => (
    <PatientRow
      key={due.patient.id}
      patient={due.patient}
      tone={tone}
      timeLabel={timeLabel ?? (due.patient.visitTime || '—')}
      sub={patientSubline(due.patient, subline)}
      chip={chip}
      onOpen={onOpenPatient}
      onCheck={tone === 'later' || tone === 'soon' ? undefined : openVisit}
      index={index}
    />
  );

  if (activeCount === 0) {
    return (
      <main className="page">
        <header className="page-head__text">
          <span className="muted">{capitalize(formatWeekday(today))}</span>
          <h1 className="h1">{formatDayMonth(today)}</h1>
        </header>
        {notice && <p className="notice">{notice}</p>}
        <div className="card card--stack">
          <p className="h1 h1--sm">Пока нет пациентов</p>
          <p className="muted">Добавьте первого — приложение само подскажет, к кому ехать сегодня и кого нельзя пропустить.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAddPatient}>
            <PlusIcon width={20} height={20} />
            Добавить пациента
          </button>
          <button type="button" className="btn btn--soft btn--block" onClick={() => replaceAll(createDemoData(today, data.settings))}>
            Посмотреть на примере
          </button>
        </div>
      </main>
    );
  }

  const planned = day === today ? [] : getPlannedForDate(dues, day, today);

  return (
    <main className="page">
      <header className="today-head">
        <div className="page-head__text">
          <span className="muted">{capitalize(formatWeekday(today))}</span>
          <h1 className="h1">{formatDayMonth(today)}</h1>
        </div>
        <div className="today-head__counter">
          <span className="today-head__value">
            {doneCount}
            <span> / {total}</span>
          </span>
          <span className="muted small">отмечено</span>
        </div>
      </header>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
        <div className="progress__fill" style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }} />
      </div>

      {notice && <p className="notice">{notice}</p>}

      {next ? (
        <div className="next-card">
          <button type="button" className="next-card__main" onClick={() => onOpenPatient(next.patient.id)}>
            <span className="next-card__label">Следующий</span>
            <span className="next-card__name">
              {next.patient.visitTime ? `${next.patient.visitTime} · ` : ''}
              {next.patient.fullName}
            </span>
            {next.patient.address && <span className="next-card__sub">{next.patient.address}</span>}
          </button>
          {next.patient.address && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Маршрут"
              onClick={() => openExternalLink(`https://yandex.ru/maps/?text=${encodeURIComponent(next.patient.address)}`)}
            >
              <RouteIcon width={22} height={22} />
            </button>
          )}
        </div>
      ) : (
        total > 0 && <p className="notice notice--ok">Все визиты на сегодня отмечены. Хорошая работа!</p>
      )}

      <div className="days" role="tablist" aria-label="Ближайшие дни">
        {stripDates.map((date, index) => {
          const count = counts.get(date) ?? 0;
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={date === day}
              className={`day${date === day ? ' day--on' : ''}`}
              onClick={() => setSelectedDay(date)}
            >
              <span className="day__wd">{index === 0 ? 'Сег.' : capitalize(formatWeekdayShort(date))}</span>
              <span className="day__d">{Number(date.slice(8))}</span>
              <span className={`day__n${count === 0 ? ' day__n--zero' : ''}`}>{count === 0 ? '—' : count}</span>
            </button>
          );
        })}
      </div>

      {day !== today ? (
        <section className="stack">
          <SectionTitle count={planned.length}>{formatLongDate(day)}</SectionTitle>
          {planned.length > 0 ? (
            <>
              {planned.map((due, index) => row(due, 'soon', index))}
              <p className="muted small" style={{ margin: '2px 4px 0' }}>
                Прогноз по графику. Изменится, если отметить визит в другой день.
              </p>
            </>
          ) : (
            <p className="empty-note">На этот день визитов по графику нет.</p>
          )}
        </section>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="stack">
              <SectionTitle count={overdue.length} late>
                Просрочено
              </SectionTitle>
              {overdue.map((due, index) => row(due, 'late', index, undefined, `−${-due.daysUntilDue} дн`))}
            </section>
          )}

          <section className="stack">
            <SectionTitle count={todayList.length}>Сегодня</SectionTitle>
            {todayList.length > 0 ? (
              todayList.map((due, index) => row(due, isDone(due) ? 'done' : 'today', index))
            ) : (
              <p className="empty-note">На сегодня по графику никого.</p>
            )}
          </section>

          {showTomorrow && tomorrow.length > 0 && (
            <section className="stack">
              <SectionTitle count={tomorrow.length}>Завтра — сверить с расписанием</SectionTitle>
              {tomorrow.map((due, index) => row(due, 'soon', index))}
            </section>
          )}

          {later.length > 0 && (
            <section className="stack">
              <SectionTitle count={later.length}>Потом — ближайшая неделя</SectionTitle>
              {later.map((due, index) => row(due, 'later', index, formatDayShortMonth(due.patient.nextVisitDate)))}
            </section>
          )}
        </>
      )}

      <button type="button" className="full-list-link" onClick={onOpenAll}>
        Весь список пациентов · {activeCount}
        <ChevronRightIcon width={20} height={20} />
      </button>

      {visitPatient && <VisitSheet patient={visitPatient} today={today} onClose={() => setVisitPatient(null)} />}
    </main>
  );
};
