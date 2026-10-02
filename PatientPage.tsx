import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatheterType, Visit } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { useToday } from '../hooks/useToday.ts';
import { CATHETER_SIZES, CATHETER_TYPES, catheterInfo, countWounds } from '../lib/body.ts';
import { addressDetails, fullAddress } from '../lib/address.ts';
import { copyText } from '../lib/clipboard.ts';
import { daysBetween, formatDayShortMonth, formatFullDate, formatLongDate } from '../lib/dates.ts';
import { catheterShort, intervalLong } from '../lib/format.ts';
import { findPatient, getLastVisitDate, getPatientVisits, patchPatient, removePatient, removeVisit, setArchived } from '../lib/patients.ts';
import { buildShareText } from '../lib/share.ts';
import { callPhone, confirmAction, openExternalLink } from '../lib/telegram.ts';
import { BodyMap } from '../components/BodyMap.tsx';
import { RescheduleSheet } from '../components/RescheduleSheet.tsx';
import { HospitalSheet } from '../components/HospitalSheet.tsx';
import { VisitSheet } from '../components/VisitSheet.tsx';
import {
  AlertIcon,
  CalendarMoveIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  PencilIcon,
  PersonIcon,
  PhoneIcon,
  RouteIcon,
  ShareIcon,
  TrashIcon,
  HospitalIcon,
} from '../components/icons.tsx';
import { Segmented, SectionTitle, Toggle } from '../components/ui.tsx';
import { cn } from '../utils/cn.ts';

type Props = { patientId: string; onBack: () => void; onEdit: (patientId: string) => void };

type OpenSheet = 'visit' | 'reschedule' | 'hospital' | null;

export const PatientPage = ({ patientId, onBack, onEdit }: Props) => {
  const { data, update } = useAppData();
  const { showToast } = useToast();
  const today = useToday();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(true);

  const patient = findPatient(data, patientId);
  const visits = useMemo(() => getPatientVisits(data, patientId), [data, patientId]);

  const closedRef = useRef(false);
  useEffect(() => {
    if (patient || closedRef.current) return;
    closedRef.current = true;
    onBack();
  }, [patient, onBack]);

  if (!patient) return null;

  const lastVisit = getLastVisitDate(data, patientId);
  const daysUntil = daysBetween(today, patient.nextVisitDate);
  const dueTone = daysUntil < 0 ? 'late' : daysUntil === 0 ? 'today' : 'ok';
  const woundsCount = countWounds(patient.wounds);
  const hasCath = patient.catheter.type !== 'none';

  const dueTitle =
    daysUntil < 0 ? 'Визит просрочен' : daysUntil === 0 ? 'Визит сегодня' : daysUntil === 1 ? 'Визит завтра' : `Визит ${formatDayShortMonth(patient.nextVisitDate)}`;
  const dueSub = [
    lastVisit ? `Был ${formatFullDate(lastVisit).slice(0, 5)}` : 'Визитов ещё не было',
    `${daysUntil < 0 ? 'по графику' : 'следующий'} ${formatLongDate(patient.nextVisitDate)}`,
  ].join(' · ');

  const setCatheterType = (type: CatheterType) =>
    update((current) =>
      patchPatient(current, patient.id, {
        catheter:
          type === 'none'
            ? { type: 'none', size: null, note: '', installedOn: '' }
            : { ...patient.catheter, type, installedOn: patient.catheter.installedOn || today },
      }),
    );

  const setCatheterSize = (size: number) =>
    update((current) => patchPatient(current, patient.id, { catheter: { ...patient.catheter, size } }));

  const share = async () => {
    const ok = await copyText(buildShareText(data, [patient.id]));
    showToast(ok ? 'Пациент скопирован — отправьте коллеге в Telegram' : 'Не получилось скопировать');
  };

  const archive = () => {
    update((current) => setArchived(current, patient.id, !patient.archived));
    showToast(patient.archived ? 'Пациент снова в работе' : 'Пациент в архиве', {
      label: 'Отменить',
      onAction: () => update((current) => setArchived(current, patient.id, patient.archived)),
    });
  };

  const deleteVisit = async (visit: Visit) => {
    if (await confirmAction(`Удалить запись о визите ${formatFullDate(visit.date)}?`)) {
      update((current) => removeVisit(current, visit.id));
    }
  };

  const deletePatient = async () => {
    const confirmed = await confirmAction(
      `Удалить пациента «${patient.fullName}»?\n\nВсе данные и история визитов будут удалены. Если пациент может вернуться — лучше отправить в архив.`,
    );
    if (confirmed) update((current) => removePatient(current, patient.id));
  };

  const route = () => openExternalLink(`https://yandex.ru/maps/?rtext=~${encodeURIComponent(patient.address)}&rtt=auto`);
  const details = addressDetails({ ...patient, apartment: '' });
  const copyAddress = async () => {
    const ok = await copyText(fullAddress(patient));
    showToast(ok ? 'Адрес скопирован' : 'Не получилось скопировать');
  };

  return (
    <main className="page page--plain">
      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="back-link" onClick={onBack}>
          <ChevronLeftIcon width={20} height={20} />
          Назад
        </button>
        <div className="row-flex">
          <button type="button" className="btn btn--soft btn--sm" onClick={() => onEdit(patient.id)}>
            <PencilIcon width={18} height={18} />
            Изменить
          </button>
          <button type="button" className="icon-btn" style={{ background: 'var(--late-soft)', color: 'var(--late-text)' }} aria-label="Удалить пациента" onClick={deletePatient}>
            <TrashIcon width={20} height={20} />
          </button>
        </div>
      </div>

      <header className="stack" style={{ gap: 8 }}>
        <h1 className="h1 h1--sm">{patient.fullName}</h1>
        {patient.policy && <span className="muted num">Полис {patient.policy}</span>}
        <div className="tags">
          {hasCath && <span className="tag tag--cath">Катетер · {catheterShort(patient)}</span>}
          {patient.oxygen && <span className="tag tag--o2">O₂ концентратор</span>}
          {patient.allergy.has && <span className="tag tag--late">Аллергия</span>}
          {woundsCount > 0 && <span className="tag tag--late">Раны: {woundsCount}</span>}
          <span className="tag">{intervalLong(patient.intervalDays)}</span>
          {patient.hospital && <span className="tag tag--hosp">В больнице</span>}
          {patient.archived && <span className="tag tag--late">В архиве</span>}
        </div>
      </header>

      {(patient.address || patient.phones.length > 0 || details) && (
        <section className="card contacts">
          {(patient.address || details) && (
            <div className="contact">
              <span className="contact__text">
                <span className="contact__label">Адрес</span>
                {patient.address && (
                  <button type="button" className="contact__value contact__copy" onClick={copyAddress}>
                    {fullAddress(patient)}
                  </button>
                )}
                {details && <span className="contact__details">{addressDetails({ ...patient, apartment: '' })}</span>}
              </span>
              <button type="button" className="icon-btn" aria-label="Маршрут" onClick={route} disabled={!patient.address}>
                <RouteIcon width={20} height={20} />
              </button>
            </div>
          )}
          {patient.phones.map((phone, index) => (
            <div key={`${phone.number}-${index}`} className="contact">
              <span className="contact__text">
                <span className="contact__value num">{phone.number}</span>
                {phone.who && <span className="contact__label">{phone.who}</span>}
              </span>
              <button type="button" className="icon-btn" aria-label={`Позвонить: ${phone.who || phone.number}`} onClick={() => callPhone(phone.number)}>
                <PhoneIcon width={20} height={20} />
              </button>
            </div>
          ))}
        </section>
      )}

      {patient.hospital && !patient.archived ? (
        <div className="hosp-banner">
          <span className="hosp-banner__icon">
            <HospitalIcon width={22} height={22} />
          </span>
          <span className="hosp-banner__text">
            <span className="hosp-banner__title">В больнице с {formatDayShortMonth(patient.hospital.since)}</span>
            <span className="hosp-banner__sub">
              {patient.hospital.note || 'Визиты на паузе'} · {daysBetween(patient.hospital.since, today) || 'сегодня'}
              {daysBetween(patient.hospital.since, today) ? ' дн.' : ''}
            </span>
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setSheet('hospital')}>
            Выписан
          </button>
        </div>
      ) : !patient.archived ? (
        <>
          <div className={cn('due', `due--${dueTone}`)}>
            <div className="due__badge">
              <span className="due__num">{daysUntil < 0 ? `−${-daysUntil}` : daysUntil === 0 ? '!' : daysUntil}</span>
              <span className="due__unit">{daysUntil === 0 ? 'сег.' : 'дн.'}</span>
            </div>
            <div className="due__text">
              <span className="due__title">{dueTitle}</span>
              <span className="due__sub">{dueSub}</span>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => setSheet('visit')}>
              <CheckIcon width={20} height={20} strokeWidth={2.6} />
              Был сегодня
            </button>
            <button type="button" className="btn btn--white btn--lg" onClick={() => setSheet('reschedule')}>
              <CalendarMoveIcon width={20} height={20} />
              Перенести
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={archive}>
          Вернуть в работу
        </button>
      )}

      <button type="button" className="about-toggle" aria-expanded={aboutOpen} onClick={() => setAboutOpen((value) => !value)}>
        <span className="about-toggle__icon">
          <PersonIcon width={20} height={20} />
        </span>
        <span className="about-toggle__text">
          <span className="about-toggle__title">О пациенте</span>
          <span className="tags" style={{ gap: 4 }}>
            {patient.allergy.has ? <span className="tag tag--xs tag--late">Аллергия</span> : <span className="tag tag--xs">Аллергии нет</span>}
            {woundsCount > 0 && <span className="tag tag--xs tag--late">Раны: {woundsCount}</span>}
            {hasCath && <span className="tag tag--xs tag--cath">{catheterShort(patient)}</span>}
            {patient.oxygen && <span className="tag tag--xs tag--o2">O₂</span>}
          </span>
        </span>
        <ChevronDownIcon width={22} height={22} className={cn('chev', aboutOpen && 'chev--open')} />
      </button>

      {aboutOpen && (
        <div className="reveal">
          <div className={cn('allergy', patient.allergy.has && 'allergy--yes')}>
            <button
              type="button"
              className="allergy__head"
              aria-expanded={patient.allergy.has ? allergyOpen : undefined}
              onClick={() => (patient.allergy.has ? setAllergyOpen((value) => !value) : onEdit(patient.id))}
            >
              <span className="allergy__icon">
                <AlertIcon width={18} height={18} strokeWidth={2.4} />
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span className="allergy__title">{patient.allergy.has ? 'Аллергия: есть' : 'Аллергии нет'}</span>
                <span className="muted small">
                  {patient.allergy.has ? (allergyOpen ? 'Нажмите, чтобы свернуть' : patient.allergy.items.join(', ') || 'Нажмите, чтобы раскрыть') : 'Изменить — в данных пациента'}
                </span>
              </span>
              {patient.allergy.has && <ChevronDownIcon width={20} height={20} className={cn('chev', allergyOpen && 'chev--open')} />}
            </button>
            {patient.allergy.has && allergyOpen && (
              <div className="allergy__list">
                {patient.allergy.items.map((item) => (
                  <span key={item} className="allergy__item">
                    {item}
                  </span>
                ))}
                {patient.allergy.note && <span className="allergy__note">{patient.allergy.note}</span>}
              </div>
            )}
          </div>

          <SectionTitle>Раны и пролежни</SectionTitle>
          <BodyMap
            wounds={patient.wounds}
            catheterType={patient.catheter.type}
            onChange={(wounds) => update((current) => patchPatient(current, patient.id, { wounds }))}
          />

          <SectionTitle>Катетер</SectionTitle>
          <div className="card card--stack">
            <Segmented<CatheterType>
              label="Тип катетера"
              value={patient.catheter.type}
              onChange={setCatheterType}
              options={CATHETER_TYPES.map((item) => ({ value: item.type, label: item.short, tone: item.type === 'none' ? undefined : 'cath' }))}
            />
            {hasCath && (
              <>
                <span className="muted small">Размер, Ch</span>
                <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 5 }}>
                  {CATHETER_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={cn('chip chip--cath', patient.catheter.size === size && 'chip--on')}
                      style={{ padding: 0 }}
                      onClick={() => setCatheterSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="cath-summary">
                  <span className="cath-summary__k">К</span>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span className="cath-summary__title">
                      {catheterInfo(patient.catheter.type).full}
                      {patient.catheter.size ? ` · Ch ${patient.catheter.size}` : ''}
                    </span>
                    <span className="muted small">
                      {[
                        patient.catheter.note || catheterInfo(patient.catheter.type).place,
                        patient.catheter.installedOn ? `установлен ${formatFullDate(patient.catheter.installedOn)}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="card set-row" style={{ borderTop: 0 }}>
            <span className="set-row__text">
              <span>
                <span className="tag tag--xs tag--o2" style={{ marginRight: 6 }}>
                  O₂
                </span>
                Кислородный концентратор
              </span>
              <span className="set-row__hint">Стоит у пациента дома</span>
            </span>
            <Toggle
              checked={patient.oxygen}
              label="Кислородный концентратор"
              onChange={(oxygen) => update((current) => patchPatient(current, patient.id, { oxygen }))}
            />
          </div>
        </div>
      )}

      {patient.comment && (
        <section className="stack">
          <SectionTitle>Комментарий</SectionTitle>
          <div className="comment">{patient.comment}</div>
        </section>
      )}

      <section className="stack">
        <SectionTitle count={visits.length || undefined}>История визитов</SectionTitle>
        {visits.length === 0 ? (
          <p className="empty-note">Визитов пока не отмечено.</p>
        ) : (
          <div className="card history">
            {visits.map((visit) => (
              <div key={visit.id} className="history__item">
                <span className="history__date">{formatFullDate(visit.date).slice(0, 5)}</span>
                <span className={cn('history__note', !visit.note && 'history__note--empty')}>{visit.note || 'без заметки'}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--ghost"
                  style={{ width: 36, height: 36, marginTop: -8 }}
                  aria-label={`Удалить визит ${formatFullDate(visit.date)}`}
                  onClick={() => deleteVisit(visit)}
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <button type="button" className="btn btn--white" onClick={() => onEdit(patient.id)}>
          Изменить данные
        </button>
        <button type="button" className="btn btn--white" onClick={share}>
          <ShareIcon width={18} height={18} />
          Поделиться
        </button>
        {!patient.archived && !patient.hospital && (
          <button type="button" className="btn btn--white" style={{ gridColumn: '1 / -1' }} onClick={() => setSheet('hospital')}>
            <HospitalIcon width={18} height={18} />
            Госпитализирован
          </button>
        )}
        {!patient.archived && (
          <button type="button" className="btn btn--ghost" onClick={archive}>
            В архив
          </button>
        )}
        <button type="button" className="btn btn--danger" onClick={deletePatient}>
          <TrashIcon width={18} height={18} />
          Удалить
        </button>
      </div>

      {sheet === 'visit' && <VisitSheet patient={patient} today={today} onClose={() => setSheet(null)} />}
      {sheet === 'hospital' && <HospitalSheet patient={patient} today={today} onClose={() => setSheet(null)} />}
      {sheet === 'reschedule' && <RescheduleSheet patient={patient} today={today} onClose={() => setSheet(null)} />}
    </main>
  );
};
