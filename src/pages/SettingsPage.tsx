import { useState, type ChangeEvent } from 'react';
import type { AppData, Role, Settings, Subline, ThemeChoice } from '../types/index.ts';
import { ADMIN_TELEGRAM_USERNAME, APP_NAME, APP_VERSION } from '../config.ts';
import { useAppData, type SaveState } from '../hooks/useAppData.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { useToday } from '../hooks/useToday.ts';
import { DataFormatError } from '../lib/appData.ts';
import { copyText } from '../lib/clipboard.ts';
import { daysBetween, formatDays, todayIso } from '../lib/dates.ts';
import { createDemoData } from '../lib/demo.ts';
import { updateSettings } from '../lib/patients.ts';
import { buildShareText, mergeData, parseShareText, type MergePreview } from '../lib/share.ts';
import { confirmAction, getTelegramUser, openTelegramChat } from '../lib/telegram.ts';
import { ROLE_LABELS } from '../components/RoleGate.tsx';
import { AlertIcon, ChevronRightIcon, ImportIcon, ShareIcon } from '../components/icons.tsx';
import { Segmented, SectionTitle, Toggle } from '../components/ui.tsx';
import { cn } from '../utils/cn.ts';

const SAVE_TEXT: Record<SaveState, string> = {
  saved: 'Сохранено в облаке Telegram',
  saving: 'Сохраняю…',
  error: 'Облако недоступно — сохранено на телефоне, отправлю позже',
};

const BACKUP_WARN_DAYS = 7;
const INTERVALS = [1, 2, 3, 4, 5, 7];

type Pending = { incoming: AppData; preview: MergePreview } | null;

export const SettingsPage = () => {
  const { data, storageKind, saveState, update, replaceAll, clearAll } = useAppData();
  const { showToast } = useToast();
  const today = useToday();
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const user = getTelegramUser();
  const settings = data.settings;

  const activeCount = data.patients.filter((patient) => !patient.archived).length;
  const archivedCount = data.patients.length - activeCount;
  const backupAge = settings.lastBackupAt ? daysBetween(settings.lastBackupAt.slice(0, 10), today) : null;
  const backupStale = data.patients.length > 0 && (backupAge === null || backupAge >= BACKUP_WARN_DAYS);

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const patch: Partial<Settings> = {};
    patch[key] = value;
    update((current) => updateSettings(current, patch));
  };

  const copyBackup = async () => {
    const ok = await copyText(JSON.stringify(data));
    if (!ok) return showToast('Не получилось скопировать. Попробуйте «Скачать файл».');
    setSetting('lastBackupAt', new Date().toISOString());
    showToast('Копия скопирована — вставьте её в «Избранное» в Telegram');
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hospis-backup-${todayIso()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSetting('lastBackupAt', new Date().toISOString());
  };

  const shareAll = async () => {
    const ok = await copyText(buildShareText(data));
    showToast(ok ? `Скопировано пациентов: ${activeCount}. Отправьте коллеге в Telegram` : 'Не получилось скопировать');
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      setImportText(await file.text());
      setImportError('');
      setPending(null);
    }
  };

  const parseImport = () => {
    try {
      return parseShareText(importText);
    } catch (error) {
      setImportError(error instanceof DataFormatError ? error.message : 'Не удалось прочитать копию.');
      return null;
    }
  };

  const previewMerge = () => {
    const incoming = parseImport();
    if (!incoming) return;
    setPending({ incoming, preview: mergeData(data, incoming).preview });
  };

  const applyMerge = () => {
    if (!pending) return;
    update((current) => mergeData(current, pending.incoming).data);
    showToast(`Добавлено новых: ${pending.preview.added.length}, объединено: ${pending.preview.merged.length}`);
    setPending(null);
    setImportText('');
  };

  const replaceFromCopy = async () => {
    const incoming = parseImport();
    if (!incoming) return;
    const confirmed = await confirmAction(
      `Заменить все ваши данные копией?\n\nВ копии: ${incoming.patients.length} пациентов, ${incoming.visits.length} визитов. Текущие данные будут удалены.`,
    );
    if (!confirmed) return;
    replaceAll({ ...incoming, settings: { ...incoming.settings, role: settings.role, lastBackupAt: settings.lastBackupAt } });
    setImportText('');
    showToast('Данные восстановлены из копии');
  };

  const clear = async () => {
    const confirmed = await confirmAction('Удалить все данные?\n\nВсе пациенты и история визитов будут удалены. Сначала сделайте копию.');
    if (!confirmed) return;
    try {
      await clearAll();
      showToast('Все данные удалены');
    } catch {
      showToast('Не удалось удалить данные из облака. Проверьте связь');
    }
  };

  return (
    <main className="page">
      <h1 className="h1">Настройки</h1>

      <div className="profile">
        <span className="avatar">{(user?.first_name ?? 'H').charAt(0)}</span>
        <span className="page-head__text" style={{ flex: 1 }}>
          <strong>{user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'Режим проверки'}</strong>
          <span className="muted small num">
            {settings.role ? ROLE_LABELS[settings.role] : ''}
            {user ? ` · ID ${user.id}` : ' · вне Telegram'}
          </span>
        </span>
        <span className="tag tag--ok">Доступ открыт</span>
      </div>

      <section className="stack">
        <SectionTitle>Должность</SectionTitle>
        <div className="card card--stack">
          <Segmented<Exclude<Role, ''>>
            label="Должность"
            value={settings.role || 'nurse'}
            onChange={(value) => setSetting('role', value)}
            options={[
              { value: 'nurse', label: 'Медсестра' },
              { value: 'doctor', label: 'Врач' },
              { value: 'other', label: 'Другой' },
            ]}
          />
        </div>
      </section>

      <section className="stack">
        <SectionTitle>Работа</SectionTitle>
        <div className="card">
          <div className="set-block">
            <span>График для новых пациентов</span>
            <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
              {INTERVALS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={cn('chip', settings.defaultInterval === days && 'chip--on')}
                  style={{ padding: 0 }}
                  onClick={() => setSetting('defaultInterval', days)}
                >
                  1/{days}
                </button>
              ))}
            </div>
          </div>
          <div className="set-block">
            <span>Под ФИО в списках показывать</span>
            <Segmented<Subline>
              label="Под ФИО показывать"
              value={settings.subline}
              onChange={(value) => setSetting('subline', value)}
              options={[
                { value: 'policy', label: 'Полис' },
                { value: 'address', label: 'Адрес' },
                { value: 'phone', label: 'Телефон' },
              ]}
            />
          </div>
          <div className="set-row">
            <span className="set-row__text">
              <span>«Завтра» на главной</span>
              <span className="set-row__hint">чтобы сверять с расписанием админов</span>
            </span>
            <Toggle checked={settings.showTomorrow} label="Показывать завтра" onChange={(value) => setSetting('showTomorrow', value)} />
          </div>
          <div className="set-row">
            <span className="set-row__text">
              <span>Вибрация при отметке</span>
              <span className="set-row__hint">лёгкий отклик телефона</span>
            </span>
            <Toggle checked={settings.haptics} label="Вибрация" onChange={(value) => setSetting('haptics', value)} />
          </div>
        </div>
      </section>

      <section className="stack">
        <SectionTitle>Оформление</SectionTitle>
        <div className="card card--stack">
          <span>Тема</span>
          <Segmented<ThemeChoice>
            label="Тема"
            value={settings.theme}
            onChange={(value) => setSetting('theme', value)}
            options={[
              { value: 'telegram', label: 'Авто' },
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
            ]}
          />
        </div>
      </section>

      <section className="stack">
        <SectionTitle>Данные</SectionTitle>
        <div className="card">
          <div className="set-row">
            <span className="row-flex">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: saveState === 'error' ? 'var(--late)' : saveState === 'saving' ? 'var(--soon)' : 'var(--ok)',
                }}
              />
              <span className="set-row__text">
                <span>{storageKind === 'telegram' ? SAVE_TEXT[saveState] : 'Сохранено в этом браузере'}</span>
                <span className="set-row__hint">
                  В работе {activeCount} · в архиве {archivedCount} · визитов {data.visits.length}
                </span>
              </span>
            </span>
          </div>
          {backupStale && (
            <div className="set-row" style={{ background: 'var(--soon-soft)' }}>
              <span className="row-flex" style={{ color: 'var(--soon-text)' }}>
                <AlertIcon width={20} height={20} />
                <span className="small">
                  {backupAge === null ? 'Копию ещё не делали.' : `Последняя копия ${formatDays(backupAge)} назад.`} Сохраните новую.
                </span>
              </span>
            </div>
          )}
          <button type="button" className="set-row" onClick={copyBackup}>
            <span className="set-row__text">
              <span>Сохранить копию в «Избранное»</span>
              <span className="set-row__hint">скопирует все данные — вставьте в «Избранное» Telegram</span>
            </span>
            <ChevronRightIcon width={18} height={18} className="lrow__chev" />
          </button>
          <button type="button" className="set-row" onClick={downloadBackup}>
            <span>Скачать файл копии</span>
            <ChevronRightIcon width={18} height={18} className="lrow__chev" />
          </button>
        </div>
      </section>

      <section className="stack">
        <SectionTitle>Обмен с коллегами</SectionTitle>
        <div className="card card--stack">
          <button type="button" className="btn btn--soft btn--block" onClick={shareAll} disabled={activeCount === 0}>
            <ShareIcon width={18} height={18} />
            Поделиться всеми пациентами
          </button>
          <p className="muted small">Одного пациента можно отправить из его карточки — кнопка «Поделиться».</p>

          <div className="field">
            <label className="field__label" htmlFor="import-text">
              Вставьте копию от коллеги или из «Избранного»
            </label>
            <textarea
              id="import-text"
              className={cn('input textarea textarea--code', importError && 'input--error')}
              rows={3}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportError('');
                setPending(null);
              }}
              placeholder='{"schemaVersion":1, …}'
            />
            {importError && <p className="field__error">{importError}</p>}
          </div>
          <label className="btn btn--outline btn--block btn--sm file-btn">
            или выбрать файл
            <input type="file" accept="application/json,.json,.txt" onChange={readFile} />
          </label>

          {pending ? (
            <div className="reveal" style={{ gap: 8 }}>
              <div className="notice notice--ok">
                Новых: <strong>{pending.preview.added.length}</strong> · уже есть, объединю: <strong>{pending.preview.merged.length}</strong> · новых
                визитов: <strong>{pending.preview.newVisits}</strong>
                {pending.preview.merged.length > 0 && (
                  <span className="muted small" style={{ display: 'block', marginTop: 4 }}>
                    Совпали: {pending.preview.merged.map((item) => item.mine.fullName).join(', ')}
                  </span>
                )}
              </div>
              <div className="grid-2">
                <button type="button" className="btn btn--white" onClick={() => setPending(null)}>
                  Отмена
                </button>
                <button type="button" className="btn btn--primary" onClick={applyMerge}>
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <div className="grid-2">
              <button type="button" className="btn btn--primary" onClick={previewMerge} disabled={!importText.trim()}>
                <ImportIcon width={18} height={18} />
                Добавить к моим
              </button>
              <button type="button" className="btn btn--white" onClick={replaceFromCopy} disabled={!importText.trim()}>
                Заменить всё
              </button>
            </div>
          )}
        </div>
      </section>

      {data.patients.length === 0 && (
        <section className="stack">
          <SectionTitle>Пример</SectionTitle>
          <div className="card card--stack">
            <p className="muted small">Заполнить приложение вымышленными пациентами, чтобы посмотреть, как всё работает.</p>
            <button type="button" className="btn btn--soft btn--block" onClick={() => replaceAll(createDemoData(today, data.settings))}>
              Загрузить пример
            </button>
          </div>
        </section>
      )}

      {ADMIN_TELEGRAM_USERNAME && (
        <button type="button" className="btn btn--white btn--block" onClick={() => openTelegramChat(`https://t.me/${ADMIN_TELEGRAM_USERNAME}`)}>
          Написать администратору
        </button>
      )}

      <button type="button" className="btn btn--danger btn--block" onClick={clear}>
        Удалить все данные
      </button>

      <p className="footer-note">
        {APP_NAME} · версия {APP_VERSION}
        <br />
        Ваши пациенты хранятся в вашем Telegram — их видите только вы.
      </p>
    </main>
  );
};
