import { useState, type FormEvent } from 'react';
import type { CatheterType, IsoDate, Patient, PatientInput } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { useToday } from '../hooks/useToday.ts';
import { ALLERGEN_PRESETS, CATHETER_SIZES, CATHETER_TYPES } from '../lib/body.ts';
import { addDays, formatDayShortMonth, formatLongDate, isIsoDate } from '../lib/dates.ts';
import { formatPhone, formatPolicy, isPhoneComplete, isPolicyComplete } from '../lib/masks.ts';
import { intervalLong } from '../lib/format.ts';
import { addPatient, emptyPatientInput, findByPolicy, findPatient, updatePatient } from '../lib/patients.ts';
import { hapticError, hapticSuccess } from '../lib/telegram.ts';
import { ChevronLeftIcon, CloseIcon, PlusIcon } from '../components/icons.tsx';
import { Field, Segmented, Toggle } from '../components/ui.tsx';
import { cn } from '../utils/cn.ts';

type Props = {
  /** null — новый пациент. */
  patientId: string | null;
  onSaved: (patientId: string) => void;
  onCancel: () => void;
  onOpenPatient: (patientId: string) => void;
};

const INTERVALS = [1, 2, 3, 4, 5, 7];
const TIMES = ['09:00', '10:00', '12:00', '14:00', '16:00'];
const MAX_PHONES = 5;
const MAX_INTERVAL = 60;

const toInput = (patient: Patient): PatientInput => ({
  fullName: patient.fullName,
  policy: patient.policy,
  address: patient.address,
  intercom: patient.intercom,
  phones: patient.phones.map((phone) => ({ ...phone })),
  comment: patient.comment,
  intervalDays: patient.intervalDays,
  visitTime: patient.visitTime,
  nextVisitDate: patient.nextVisitDate,
  catheter: { ...patient.catheter },
  allergy: { ...patient.allergy, items: [...patient.allergy.items] },
  wounds: { ...patient.wounds },
  oxygen: patient.oxygen,
});

const freshInput = (today: IsoDate, interval: number): PatientInput => ({
  ...emptyPatientInput(today, interval),
  phones: [{ number: '', who: 'Пациент' }],
});

export const PatientFormPage = ({ patientId, onSaved, onCancel, onOpenPatient }: Props) => {
  const { data, update } = useAppData();
  const { showToast } = useToast();
  const today = useToday();
  const existing = patientId ? findPatient(data, patientId) : undefined;
  const isNew = !existing;
  const defaultInterval = data.settings.defaultInterval;

  const [form, setForm] = useState<PatientInput>(() => (existing ? toInput(existing) : freshInput(today, defaultInterval)));
  const [customInterval, setCustomInterval] = useState(() => !isNew && !INTERVALS.includes(form.intervalDays));
  // У нового пациента график и дата первого визита выбираются явно — чтобы ничего не перепуталось.
  const [intervalChosen, setIntervalChosen] = useState(!isNew);
  const [dateChosen, setDateChosen] = useState(!isNew);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) =>
    setForm((current) => {
      const next = { ...current };
      next[key] = value;
      return next;
    });

  const duplicate = findByPolicy(data.patients, form.policy, existing?.id);
  const phoneErrors = form.phones.map((phone) => (phone.number && !isPhoneComplete(phone.number) ? 'Номер не полный' : undefined));
  const errors = {
    fullName: form.fullName.trim() ? undefined : 'Введите ФИО',
    policy: !form.policy.trim()
      ? 'Введите полис — по нему не появятся дубли'
      : isPolicyComplete(form.policy)
        ? undefined
        : 'В полисе 16 цифр',
    interval: intervalChosen ? undefined : 'Выберите график посещений',
    next: !dateChosen ? (isNew ? 'Выберите дату первого визита' : 'Укажите дату') : isIsoDate(form.nextVisitDate) ? undefined : 'Укажите дату',
  };
  const hasErrors = Boolean(
    errors.fullName || errors.policy || errors.interval || errors.next || duplicate || phoneErrors.some(Boolean),
  );

  const scheduleReady = intervalChosen && dateChosen && isIsoDate(form.nextVisitDate);
  const preview = scheduleReady
    ? Array.from({ length: 5 }, (_, index) => addDays(form.nextVisitDate, (index + 1) * form.intervalDays))
    : [];

  const setPhone = (index: number, patch: Partial<PatientInput['phones'][number]>) =>
    set(
      'phones',
      form.phones.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)),
    );

  const setCatheterType = (type: CatheterType) =>
    set(
      'catheter',
      type === 'none'
        ? { type, size: null, note: '', installedOn: '' }
        : { ...form.catheter, type, installedOn: form.catheter.installedOn || today },
    );

  const toggleAllergen = (item: string) => {
    const items = form.allergy.items.includes(item) ? form.allergy.items.filter((value) => value !== item) : [...form.allergy.items, item];
    set('allergy', { ...form.allergy, items });
  };

  const save = (addAnother: boolean) => {
    setSubmitted(true);
    if (hasErrors) {
      hapticError();
      return;
    }
    if (existing) {
      update((current) => updatePatient(current, existing.id, form));
      hapticSuccess();
      onSaved(existing.id);
      return;
    }
    let createdId = '';
    update((current) => {
      const result = addPatient(current, form);
      createdId = result.patientId;
      return result.data;
    });
    hapticSuccess();
    if (addAnother) {
      showToast(`«${form.fullName.trim()}» добавлен(а)`);
      setForm(freshInput(today, defaultInterval));
      setCustomInterval(false);
      setIntervalChosen(false);
      setDateChosen(false);
      setSubmitted(false);
      window.scrollTo(0, 0);
      return;
    }
    onSaved(createdId);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save(false);
  };

  const nextChips = [
    { label: 'Сегодня', value: today },
    { label: 'Завтра', value: addDays(today, 1) },
    { label: 'Послезавтра', value: addDays(today, 2) },
  ];

  return (
    <main className="page page--form">
      <button type="button" className="back-link" onClick={onCancel}>
        <ChevronLeftIcon width={20} height={20} />
        Назад
      </button>
      <header className="stack">
        <h1 className="h1">{isNew ? 'Новый пациент' : 'Изменить данные'}</h1>
        {isNew && <p className="muted small">Обязательно: ФИО, полис, график и дата первого визита. Остальное можно дописать потом.</p>}
      </header>

      <form className="stack stack--12" onSubmit={submit} noValidate>
        <section className="card card--stack">
          <h2 className="card__title">Пациент</h2>
          <Field label={<>ФИО <span className="req">*</span></>} htmlFor="fullName" error={submitted ? errors.fullName : undefined}>
            <input
              id="fullName"
              className={cn('input', submitted && errors.fullName && 'input--error')}
              value={form.fullName}
              autoComplete="off"
              placeholder="Иванов Иван Иванович"
              onChange={(event) => set('fullName', event.target.value)}
            />
          </Field>
          <Field
            label={<>Полис <span className="req">*</span></>}
            htmlFor="policy"
            error={submitted ? errors.policy : undefined}
            hint="16 цифр, пробелы ставятся сами"
          >
            <input
              id="policy"
              className={cn('input num', (duplicate || (submitted && errors.policy)) && 'input--error')}
              value={form.policy}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              onChange={(event) => set('policy', formatPolicy(event.target.value))}
            />
          </Field>
          {duplicate && (
            <div className="notice notice--late row-flex" style={{ justifyContent: 'space-between' }}>
              <span>Этот полис уже у пациента «{duplicate.fullName}».</span>
              <button type="button" className="link-btn" onClick={() => onOpenPatient(duplicate.id)}>
                Открыть
              </button>
            </div>
          )}
          <Field label="Адрес" htmlFor="address" optional>
            <input id="address" className="input" value={form.address} placeholder="Улица, дом, квартира" onChange={(event) => set('address', event.target.value)} />
          </Field>
          <Field label="Домофон, подъезд, этаж" htmlFor="intercom" optional>
            <input id="intercom" className="input" value={form.intercom} placeholder="Код 45К, подъезд 2, этаж 3" onChange={(event) => set('intercom', event.target.value)} />
          </Field>
        </section>

        <section className="card card--stack">
          <h2 className="card__title">Телефоны</h2>
          {form.phones.map((phone, index) => (
            <div key={index} className="phone-edit">
              <input
                className="input num"
                type="tel"
                inputMode="tel"
                value={phone.number}
                placeholder="+7 909 909-97-97"
                aria-label={`Телефон ${index + 1}`}
                aria-invalid={Boolean(submitted && phoneErrors[index])}
                style={submitted && phoneErrors[index] ? { borderColor: 'var(--late)' } : undefined}
                onChange={(event) => setPhone(index, { number: formatPhone(event.target.value) })}
              />
              <input
                className="input"
                value={phone.who}
                placeholder="Чей: дочь, сын…"
                aria-label={`Чей телефон ${index + 1}`}
                onChange={(event) => setPhone(index, { who: event.target.value })}
              />
              <button
                type="button"
                className="icon-btn icon-btn--ghost"
                style={{ width: 40 }}
                aria-label={`Убрать телефон ${index + 1}`}
                onClick={() => set('phones', form.phones.filter((_, i) => i !== index))}
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
          ))}
          {submitted && phoneErrors.some(Boolean) && <p className="field__error">Допишите номер полностью: +7 и 10 цифр</p>}
          {form.phones.length < MAX_PHONES && (
            <button type="button" className="btn btn--soft btn--block btn--sm" onClick={() => set('phones', [...form.phones, { number: '', who: '' }])}>
              <PlusIcon width={18} height={18} />
              Добавить телефон
            </button>
          )}
        </section>

        <section className="card card--stack">
          <h2 className="card__title">
            График <span className="req">*</span>
          </h2>
          <div className="field">
            <span className="field__label">
              {isNew ? 'Как часто ездить' : 'График'}
              {intervalChosen && <span className="field__opt">{intervalLong(form.intervalDays)}</span>}
            </span>
            <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {INTERVALS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={cn('chip', intervalChosen && !customInterval && form.intervalDays === days && 'chip--on')}
                  style={{ padding: 0 }}
                  onClick={() => {
                    setCustomInterval(false);
                    setIntervalChosen(true);
                    set('intervalDays', days);
                  }}
                >
                  1/{days}
                </button>
              ))}
              <button
                type="button"
                className={cn('chip', customInterval && 'chip--on')}
                style={{ padding: 0 }}
                onClick={() => {
                  setCustomInterval(true);
                  setIntervalChosen(true);
                }}
              >
                …
              </button>
            </div>
            {customInterval && (
              <label className="row-flex">
                раз в
                <input
                  className="input num"
                  style={{ width: 88, textAlign: 'center' }}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_INTERVAL}
                  value={form.intervalDays}
                  aria-label="Интервал в днях"
                  onChange={(event) => set('intervalDays', Math.min(MAX_INTERVAL, Math.max(1, Math.round(Number(event.target.value)) || 1)))}
                />
                дней
              </label>
            )}
            {submitted && errors.interval && <p className="field__error">{errors.interval}</p>}
          </div>

          <div className="field">
            <span className="field__label">{isNew ? 'Первый визит' : 'Следующий визит'}</span>
            <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {nextChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className={cn('chip chip--tall', dateChosen && form.nextVisitDate === chip.value && 'chip--on')}
                  onClick={() => {
                    setDateChosen(true);
                    set('nextVisitDate', chip.value);
                  }}
                >
                  <span>{chip.label}</span>
                  <span className="chip__sub">{formatDayShortMonth(chip.value)}</span>
                </button>
              ))}
            </div>
            <input
              className={cn('input', submitted && errors.next && 'input--error')}
              type="date"
              value={dateChosen ? form.nextVisitDate : ''}
              aria-label="Дата визита"
              onChange={(event) => {
                setDateChosen(Boolean(event.target.value));
                set('nextVisitDate', event.target.value || today);
              }}
            />
            {submitted && errors.next && <p className="field__error">{errors.next}</p>}
          </div>

          <div className="field">
            <span className="field__label">
              Время <span className="field__opt">необязательно</span>
            </span>
            <div className="chips">
              {TIMES.map((time) => (
                <button key={time} type="button" className={cn('chip', form.visitTime === time && 'chip--on')} onClick={() => set('visitTime', time)}>
                  {time}
                </button>
              ))}
              <button type="button" className={cn('chip', !form.visitTime && 'chip--on')} onClick={() => set('visitTime', '')}>
                без времени
              </button>
            </div>
            <input className="input" style={{ maxWidth: 160 }} type="time" value={form.visitTime} aria-label="Время визита" onChange={(event) => set('visitTime', event.target.value)} />
          </div>

          {scheduleReady ? (
            <div className="preview-dates">
              <span className="preview-dates__title">
                {isNew ? 'Первый визит' : 'Следующий визит'} — {formatLongDate(form.nextVisitDate)}, далее {intervalLong(form.intervalDays)}:
              </span>
              <div className="chips">
                {preview.map((date) => (
                  <span key={date} className="tag num" style={{ background: 'var(--card)' }}>
                    {formatDayShortMonth(date)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="notice small">Выберите график и дату первого визита — ниже появятся даты следующих визитов.</p>
          )}
        </section>

        <section className="card card--stack">
          <h2 className="card__title">Катетер</h2>
          <Segmented<CatheterType>
            label="Тип катетера"
            value={form.catheter.type}
            onChange={setCatheterType}
            options={CATHETER_TYPES.map((item) => ({ value: item.type, label: item.short, tone: item.type === 'none' ? undefined : 'cath' }))}
          />
          {form.catheter.type !== 'none' && (
            <div className="reveal" style={{ gap: 10 }}>
              {form.catheter.type === 'other' && (
                <Field label="Какой катетер" htmlFor="cathNote">
                  <input
                    id="cathNote"
                    className="input"
                    value={form.catheter.note}
                    placeholder="Например: нефростома справа"
                    onChange={(event) => set('catheter', { ...form.catheter, note: event.target.value })}
                  />
                </Field>
              )}
              <span className="field__label">Размер, Ch</span>
              <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 5 }}>
                {CATHETER_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={cn('chip chip--cath', form.catheter.size === size && 'chip--on')}
                    style={{ padding: 0 }}
                    onClick={() => set('catheter', { ...form.catheter, size })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="row-flex" style={{ justifyContent: 'space-between', paddingTop: 4 }}>
            <span className="set-row__text">
              <span>
                <span className="tag tag--xs tag--o2" style={{ marginRight: 6 }}>
                  O₂
                </span>
                Кислородный концентратор
              </span>
              <span className="set-row__hint">Стоит у пациента дома</span>
            </span>
            <Toggle checked={form.oxygen} label="Кислородный концентратор" onChange={(oxygen) => set('oxygen', oxygen)} />
          </div>
        </section>

        <section className="card card--stack">
          <h2 className="card__title">Аллергия</h2>
          <Segmented<'no' | 'yes'>
            label="Аллергия"
            value={form.allergy.has ? 'yes' : 'no'}
            onChange={(value) => set('allergy', { ...form.allergy, has: value === 'yes' })}
            options={[
              { value: 'no', label: 'Нет' },
              { value: 'yes', label: 'Есть', tone: 'late' },
            ]}
          />
          {form.allergy.has && (
            <div className="reveal" style={{ gap: 10 }}>
              <span className="field__label">На что</span>
              <div className="chips">
                {ALLERGEN_PRESETS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cn('chip chip--pill chip--late', form.allergy.items.includes(item) && 'chip--on')}
                    aria-pressed={form.allergy.items.includes(item)}
                    onClick={() => toggleAllergen(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <Field label="Другое и реакция" htmlFor="allergyNote">
                <textarea
                  id="allergyNote"
                  className="input textarea"
                  rows={2}
                  value={form.allergy.note}
                  placeholder="Например: новокаин — отёк"
                  onChange={(event) => set('allergy', { ...form.allergy, note: event.target.value })}
                />
              </Field>
            </div>
          )}
        </section>

        <section className="card card--pad">
          <h2 className="card__title" style={{ marginBottom: 6 }}>
            Раны и пролежни
          </h2>
          <p className="muted small">Отмечаются на схеме тела в карточке: «О пациенте» → «Раны и пролежни».</p>
        </section>

        <section className="card card--stack">
          <Field label="Комментарий" htmlFor="comment" optional>
            <textarea
              id="comment"
              className="input textarea"
              rows={3}
              value={form.comment}
              placeholder="Особенности ухода, родственники, ключи"
              onChange={(event) => set('comment', event.target.value)}
            />
          </Field>
        </section>

        <div className="form-bar">
          {isNew && (
            <button type="button" className="btn btn--outline" onClick={() => save(true)}>
              + ещё одного
            </button>
          )}
          <button type="submit" className="btn btn--primary btn--lg">
            {isNew ? 'Сохранить пациента' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </main>
  );
};
