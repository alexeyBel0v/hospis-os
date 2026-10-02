import { useMemo, useState } from 'react';
import type { Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToday } from '../hooks/useToday.ts';
import { addressDetails, fullAddress } from '../lib/address.ts';
import { addDays, formatDayMonth, formatDayShortMonth, formatDays, formatWeekday } from '../lib/dates.ts';
import { createDemoData } from '../lib/demo.ts';
import { patientInfo } from '../lib/format.ts';
import { findPatient } from '../lib/patients.ts';
import { byPatientName, describeActivePatients, getPlannedForDate, type PatientDue } from '../lib/schedule.ts';
import { openExternalLink } from '../lib/telegram.ts';
import { PatientRow, type RowTone } from '../components/PatientRow.tsx';
import { VisitSheet } from '../components/VisitSheet.tsx';
import { RouteSheet } from '../components/RouteSheet.tsx';
import { CheckIcon, ChevronDownIcon, NavigatorIcon, PlusIcon, RouteIcon } from '../components/icons.tsx';
import { cn } from '../utils/cn.ts';

type Props = {
  onOpenPatient: (patientId: string) => void;
  onAddPatient: () => void;
};

type Tab = 'today' | 'tomorrow' | 'later';

/** Вкладка «Потом»: у кого следующий визит в ближайшую неделю (после завтра). */
const LATER_DAYS = 7;

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const navigateTo = (address: string) => openExternalLink(`https://yandex.ru/maps/?rtext=~${encodeURIComponent(address)}&rtt=auto`);

/** Кольцо прогресса: сколько из запланированных на сегодня уже отмечено. */
const ProgressRing = ({ done, total }: { done: number; total: number }) => {
  const radius = 24;
  const length = 2 * Math.PI * radius;
  const share = total ? done / total : 0;
  return (
    <div className={cn('ring', total > 0 && done === total && 'ring--full')} role="img" aria-label={`Отмечено ${done} из ${total}`}>
      <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
        <circle className="ring__track" cx="30" cy="30" r={radius} />
        <circle className="ring__fill" cx="30" cy="30" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - share)} />
      </svg>
      <span className="ring__text">
        {done}
        <span>/{total}</span>
      </span>
    </div>
  );
};

export const TodayPage = ({ onOpenPatient, onAddPatient }: Props) => {
  const { data, notice, replaceAll } = useAppData();
  const today = useToday();
  const [visitPatient, setVisitPatient] = useState<Patient | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [doneOpen, setDoneOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { subline } = data.settings;

  const dues = useMemo(() => describeActivePatients(data.patients, data.visits, today), [data, today]);
  const tomorrowDate = addDays(today, 1);

  const isDone = (due: PatientDue) => due.lastVisitDate === today;
  const overdue = dues.filter((due) => due.daysUntilDue < 0 && !isDone(due));
  const dueToday = dues.filter((due) => due.daysUntilDue === 0 && !isDone(due)).sort(byPatientName);
  const done = dues.filter(isDone).sort(byPatientName);
  const tomorrow = getPlannedForDate(dues, tomorrowDate, today);
  const later = dues.filter((due) => due.daysUntilDue >= 2 && due.daysUntilDue <= LATER_DAYS && !isDone(due));

  const toVisit = [...overdue, ...dueToday];
  const doneToday = done.length;
  const total = toVisit.length + doneToday;
  const next = toVisit[0];
  const hospitalCount = data.patients.filter((patient) => !patient.archived && patient.hospital).length;

  const openVisit = (patientId: string) => setVisitPatient(findPatient(data, patientId) ?? null);

  const toggle = (patientId: string) => setOpenId((current) => (current === patientId ? null : patientId));

  const row = (due: PatientDue, tone: RowTone, index: number, aside?: string) => (
    <PatientRow
      key={due.patient.id}
      patient={due.patient}
      tone={tone}
      today={today}
      sub={patientInfo(due.patient, subline) || 'без полиса'}
      aside={aside ? <span className={cn('tag tag--xs', tone === 'late' ? 'tag--late' : 'tag--accent')}>{aside}</span> : undefined}
      expanded={openId === due.patient.id}
      onToggle={toggle}
      onOpen={onOpenPatient}
      onCheck={tone === 'later' || tone === 'soon' ? undefined : openVisit}
      index={index}
    />
  );

  if (dues.length === 0) {
    return (
      <main className="page">
        <header className="page-head__text">
          <span className="muted">{capitalize(formatWeekday(today))}</span>
          <h1 className="h1">{formatDayMonth(today)}</h1>
        </header>
        {notice && <p className="notice">{notice}</p>}
        <div className="card card--stack">
          <p className="h1 h1--sm">{hospitalCount > 0 ? 'Все пациенты в больнице' : 'Пока нет пациентов'}</p>
          <p className="muted">
            {hospitalCount > 0
              ? 'Когда кого-то выпишут — откройте его во вкладке «Пациенты» и нажмите «Выписан».'
              : 'Добавьте первого — приложение само подскажет, к кому ехать сегодня и кого нельзя пропустить.'}
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAddPatient}>
            <PlusIcon width={20} height={20} />
            Добавить пациента
          </button>
          {data.patients.length === 0 && (
            <button type="button" className="btn btn--soft btn--block" onClick={() => replaceAll(createDemoData(today, data.settings))}>
              Посмотреть на примере
            </button>
          )}
        </div>
      </main>
    );
  }

  const tabs: Array<{ value: Tab; label: string; count: number }> = [
    { value: 'today', label: 'Сегодня', count: toVisit.length },
    { value: 'tomorrow', label: 'Завтра', count: tomorrow.length },
    { value: 'later', label: 'Потом', count: later.length },
  ];

  const nextDetails = next ? addressDetails({ ...next.patient, apartment: '' }) : '';

  return (
    <main className="page">
      <header className="today-head">
        <div className="page-head__text">
          <span className="muted">{capitalize(formatWeekday(today))}</span>
          <h1 className="h1">{formatDayMonth(today)}</h1>
        </div>
        <ProgressRing done={doneToday} total={total} />
      </header>

      {notice && <p className="notice">{notice}</p>}

      {next ? (
        <section className={cn('next-card', next.daysUntilDue < 0 && 'next-card--late')}>
          <button type="button" className="next-card__main" onClick={() => onOpenPatient(next.patient.id)}>
            <span className="next-card__label">
              {next.daysUntilDue < 0 ? `Просрочен на ${formatDays(-next.daysUntilDue)}` : 'Следующий'}
            </span>
            <span className="next-card__name">{next.patient.fullName}</span>
            {next.patient.address && <span className="next-card__sub">{fullAddress(next.patient)}</span>}
            {nextDetails && <span className="next-card__sub next-card__sub--dim">{nextDetails}</span>}
          </button>
          <div className="next-card__actions">
            <button type="button" className="next-card__btn next-card__btn--main" onClick={() => openVisit(next.patient.id)}>
              <CheckIcon width={18} height={18} strokeWidth={2.6} />
              Был
            </button>
            {next.patient.address && (
              <button type="button" className="next-card__btn" onClick={() => navigateTo(next.patient.address)}>
                <NavigatorIcon width={18} height={18} />
                Поехали
              </button>
            )}
          </div>
        </section>
      ) : (
        total > 0 && <p className="notice notice--ok">Все визиты на сегодня отмечены. Хорошая работа!</p>
      )}

      <div className="tabs" role="tablist" aria-label="Когда">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={cn('tabs__btn', tab === item.value && 'tabs__btn--on')}
            onClick={() => {
              setTab(item.value);
              setOpenId(null);
            }}
          >
            {item.label}
            <span className={cn('tabs__count', item.value === 'today' && overdue.length > 0 && 'tabs__count--late')}>{item.count}</span>
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <section className="stack">
          {toVisit.length > 0 ? (
            <>
              {overdue.map((due, index) => row(due, 'late', index, `−${-due.daysUntilDue} дн`))}
              {dueToday.map((due, index) => row(due, 'today', overdue.length + index))}
            </>
          ) : (
            <p className="empty-note">{done.length > 0 ? 'Всех отметили — можно выдохнуть.' : 'На сегодня по графику никого.'}</p>
          )}

          {toVisit.length > 1 && (
            <button type="button" className="route-btn" onClick={() => setRouteOpen(true)}>
              <RouteIcon width={20} height={20} />
              <span>Маршрут по всем · {toVisit.length}</span>
            </button>
          )}

          {done.length > 0 && (
            <>
              <button type="button" className="done-toggle" aria-expanded={doneOpen} onClick={() => setDoneOpen((value) => !value)}>
                <CheckIcon width={16} height={16} strokeWidth={2.6} />
                <span>Отмечено · {done.length}</span>
                <ChevronDownIcon width={18} height={18} className={cn('chev', doneOpen && 'chev--open')} />
              </button>
              {doneOpen && done.map((due, index) => row(due, 'done', index))}
            </>
          )}
        </section>
      )}

      {tab === 'tomorrow' && (
        <section className="stack">
          {tomorrow.length > 0 ? (
            <>
              {tomorrow.map((due, index) => row(due, 'soon', index))}
              <p className="muted small" style={{ margin: '2px 4px 0' }}>
                Прогноз по графику — сверьте с расписанием админов.
              </p>
            </>
          ) : (
            <p className="empty-note">На завтра по графику никого.</p>
          )}
        </section>
      )}

      {tab === 'later' && (
        <section className="stack">
          {later.length > 0 ? (
            later.map((due, index) => row(due, 'later', index, formatDayShortMonth(due.patient.nextVisitDate)))
          ) : (
            <p className="empty-note">В ближайшую неделю больше никого.</p>
          )}
        </section>
      )}

      {hospitalCount > 0 && <p className="muted small today-foot">В больнице: {hospitalCount} — визиты на паузе</p>}

      {routeOpen && <RouteSheet patients={toVisit.map((due) => due.patient)} onClose={() => setRouteOpen(false)} />}
      {visitPatient && <VisitSheet patient={visitPatient} today={today} onClose={() => setVisitPatient(null)} />}
    </main>
  );
};
