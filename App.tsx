import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from './hooks/useAppData.tsx';
import { useBackButton } from './hooks/useBackButton.ts';
import { useToday } from './hooks/useToday.ts';
import { buildTodayPlan, describeActivePatients } from './lib/schedule.ts';
import { setHapticsEnabled, setThemeChoice } from './lib/telegram.ts';
import { BottomNav, type Tab } from './components/BottomNav.tsx';
import { CalendarPage } from './pages/CalendarPage.tsx';
import { InfoPage } from './pages/InfoPage.tsx';
import { PatientFormPage } from './pages/PatientFormPage.tsx';
import { PatientPage } from './pages/PatientPage.tsx';
import { PatientsPage } from './pages/PatientsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TodayPage } from './pages/TodayPage.tsx';
import { reloadToVersion, useUpdateCheck } from './hooks/useUpdateCheck.ts';

type Screen =
  | { kind: 'patient'; patientId: string }
  | { kind: 'patient-form'; patientId: string | null }
  | { kind: 'article'; articleId: string };

export const App = () => {
  const { data } = useAppData();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);
  const top = stack[stack.length - 1];

  useEffect(() => setThemeChoice(data.settings.theme), [data.settings.theme]);
  useEffect(() => setHapticsEnabled(data.settings.haptics), [data.settings.haptics]);

  const overdueCount = useMemo(
    () => buildTodayPlan(describeActivePatients(data.patients, data.visits, today), today).overdue.length,
    [data, today],
  );

  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const push = useCallback((screen: Screen) => setStack((current) => [...current, screen]), []);
  const openPatient = useCallback((patientId: string) => push({ kind: 'patient', patientId }), [push]);
  const openForm = useCallback((patientId: string | null) => push({ kind: 'patient-form', patientId }), [push]);
  const openArticle = useCallback((articleId: string) => push({ kind: 'article', articleId }), [push]);

  // После сохранения формы: новый пациент открывается вместо формы, при редактировании — возврат в карточку.
  const finishForm = useCallback((patientId: string) => {
    setStack((current) => {
      const withoutForm = current.slice(0, -1);
      const previous = withoutForm[withoutForm.length - 1];
      const alreadyOpen = previous?.kind === 'patient' && previous.patientId === patientId;
      return alreadyOpen ? withoutForm : [...withoutForm, { kind: 'patient', patientId }];
    });
  }, []);

  useBackButton(stack.length > 0 ? back : null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, stack.length]);

  const changeTab = (next: Tab) => {
    setStack([]);
    setTab(next);
  };

  const renderScreen = () => {
    if (top?.kind === 'patient') {
      return <PatientPage key={top.patientId} patientId={top.patientId} onBack={back} onEdit={openForm} />;
    }
    if (top?.kind === 'patient-form') {
      return (
        <PatientFormPage
          key={top.patientId ?? 'new'}
          patientId={top.patientId}
          onSaved={finishForm}
          onCancel={back}
          onOpenPatient={openPatient}
        />
      );
    }
    if (top?.kind === 'article') return <InfoPage articleId={top.articleId} onOpenArticle={openArticle} onBack={back} />;
    if (tab === 'patients') return <PatientsPage onOpenPatient={openPatient} onAddPatient={() => openForm(null)} />;
    if (tab === 'calendar') return <CalendarPage onOpenPatient={openPatient} />;
    if (tab === 'info') return <InfoPage articleId={null} onOpenArticle={openArticle} onBack={back} />;
    if (tab === 'settings') return <SettingsPage />;
    return <TodayPage onOpenPatient={openPatient} onAddPatient={() => openForm(null)} />;
  };

  const showNav = !top || top.kind === 'article';
  const update = useUpdateCheck();

  // Нижнее меню — вне анимируемого контейнера: transform у родителя ломает position: fixed.
  return (
    <>
      {update && (
        <button type="button" className="update-bar" onClick={() => reloadToVersion(update)}>
          <span>Вышла новая версия {update}</span>
          <strong>Обновить</strong>
        </button>
      )}
      <div key={top ? `${top.kind}-${stack.length}` : tab} className="screen">
        {renderScreen()}
      </div>
      {showNav && <BottomNav active={tab} onChange={changeTab} overdueCount={overdueCount} />}
    </>
  );
};
