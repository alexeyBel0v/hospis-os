import { Fragment, useMemo, useState } from 'react';
import type { Patient } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToday } from '../hooks/useToday.ts';
import { daysBetween } from '../lib/dates.ts';
import { createDemoData } from '../lib/demo.ts';
import { nextVisitLabel, patientInfo } from '../lib/format.ts';
import { matchesQuery } from '../lib/patients.ts';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, SearchIcon } from '../components/icons.tsx';
import { PatientRow } from '../components/PatientRow.tsx';
import { Segmented } from '../components/ui.tsx';
import { cn } from '../utils/cn.ts';

type Props = { onOpenPatient: (patientId: string) => void; onAddPatient: () => void };

type Sort = 'name' | 'date';

const byName = (a: Patient, b: Patient) => a.fullName.localeCompare(b.fullName, 'ru');

export const PatientsPage = ({ onOpenPatient, onAddPatient }: Props) => {
  const { data, replaceAll } = useAppData();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [catheterOnly, setCatheterOnly] = useState(false);
  const [hospitalOnly, setHospitalOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const subline = data.settings.subline;

  const active = useMemo(() => data.patients.filter((patient) => !patient.archived), [data.patients]);
  const inHospital = active.filter((patient) => patient.hospital).length;
  const visible = active
    .filter(
      (patient) =>
        matchesQuery(patient, query) &&
        (!catheterOnly || patient.catheter.type !== 'none') &&
        (!hospitalOnly || Boolean(patient.hospital)),
    )
    .sort(sort === 'name' ? byName : (a, b) => (a.nextVisitDate < b.nextVisitDate ? -1 : a.nextVisitDate > b.nextVisitDate ? 1 : byName(a, b)));
  const archived = data.patients.filter((patient) => patient.archived && matchesQuery(patient, query)).sort(byName);
  const archiveOpen = showArchive || Boolean(query);

  let previousLetter = '';

  return (
    <main className="page">
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="h1">Пациенты</h1>
          <span className="muted">
            В работе {active.length - inHospital}
            {inHospital > 0 && ` · в больнице ${inHospital}`}
          </span>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={onAddPatient}>
          <PlusIcon width={20} height={20} />
          Добавить
        </button>
      </header>

      {active.length === 0 && archived.length === 0 && !query ? (
        <div className="card card--stack">
          <p className="h1 h1--sm">Список пуст</p>
          <p className="muted">Добавьте пациента или посмотрите, как всё выглядит, на примере.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAddPatient}>
            <PlusIcon width={20} height={20} />
            Добавить пациента
          </button>
          <button type="button" className="btn btn--soft btn--block" onClick={() => replaceAll(createDemoData(today, data.settings))}>
            Посмотреть на примере
          </button>
        </div>
      ) : (
        <>
          <label className="search">
            <SearchIcon className="search__icon" width={20} height={20} />
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ФИО, полис, телефон, адрес"
              aria-label="Поиск пациента"
              enterKeyHint="search"
            />
          </label>

          <div className="toolbar">
            <Segmented<Sort>
              label="Сортировка"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'name', label: 'По алфавиту' },
                { value: 'date', label: 'По дате визита' },
              ]}
            />
            <button
              type="button"
              className={cn('chip chip--cath', catheterOnly && 'chip--on')}
              aria-pressed={catheterOnly}
              onClick={() => setCatheterOnly((value) => !value)}
              style={{ minHeight: 44 }}
            >
              Катетер
            </button>
            {inHospital > 0 && (
              <button
                type="button"
                className={cn('chip chip--hosp', hospitalOnly && 'chip--on')}
                aria-pressed={hospitalOnly}
                onClick={() => setHospitalOnly((value) => !value)}
                style={{ minHeight: 44 }}
              >
                Больница
              </button>
            )}
          </div>

          {visible.length > 0 ? (
            <div className="stack stack--tight">
              {visible.map((patient, index) => {
                const letter = patient.fullName.charAt(0).toUpperCase();
                const showLetter = sort === 'name' && letter !== previousLetter;
                previousLetter = letter;
                const days = daysBetween(today, patient.nextVisitDate);
                const aside = patient.hospital ? (
                  <span className="tag tag--xs tag--hosp">больница</span>
                ) : (
                  <span className={cn('prow__when', days < 0 && 'prow__when--late')}>
                    {days < 0 ? `−${-days} дн` : nextVisitLabel(patient.nextVisitDate, today)}
                  </span>
                );
                return (
                  <Fragment key={patient.id}>
                    {showLetter && <div className="list__letter list__letter--loose">{letter}</div>}
                    <PatientRow
                      patient={patient}
                      tone={patient.hospital ? 'plain' : days < 0 ? 'late' : days === 0 ? 'today' : 'plain'}
                      today={today}
                      sub={patientInfo(patient, subline) || 'без полиса'}
                      aside={aside}
                      expanded={openId === patient.id}
                      onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
                      onOpen={onOpenPatient}
                      index={index}
                    />
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <p className="empty-note">{query ? `Никого не нашлось по запросу «${query}».` : 'Под фильтр никто не подходит.'}</p>
          )}

          {visible.length > 0 && (
            <p className="legend-flags">
              <span><span className="flag flag--cath">К</span> катетер</span>
              <span><span className="flag flag--o2">O₂</span> концентратор</span>
              <span><span className="flag flag--late">!</span> аллергия</span>
            </p>
          )}

          {archived.length > 0 && (
            <section className="stack">
              <button
                type="button"
                className="set-row card"
                aria-expanded={archiveOpen}
                onClick={() => setShowArchive((value) => !value)}
              >
                <span className="muted">Архив · {archived.length}</span>
                <ChevronDownIcon width={20} height={20} className={cn('chev', archiveOpen && 'chev--open')} />
              </button>
              {archiveOpen && (
                <div className="list">
                  {archived.map((patient) => (
                    <button key={patient.id} type="button" className="lrow" onClick={() => onOpenPatient(patient.id)}>
                      <span className="lrow__main">
                        <span className="prow__name">{patient.fullName}</span>
                        <span className="prow__sub">{patient.policy ? `Полис ${patient.policy}` : 'в архиве'}</span>
                      </span>
                      <ChevronRightIcon className="lrow__chev" width={16} height={16} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
};
