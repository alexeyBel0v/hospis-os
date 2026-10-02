import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { AccessGate } from './components/AccessGate.tsx';
import { RoleGate } from './components/RoleGate.tsx';
import { Splash } from './components/Splash.tsx';
import { AppDataProvider } from './hooks/useAppData.tsx';
import { ToastProvider } from './hooks/useToast.tsx';
import { initTelegram } from './lib/telegram.ts';
import './index.css';

initTelegram();

const root = document.getElementById('root');
if (!root) throw new Error('Нет элемента #root в index.html');

// Порядок запуска: заставка → ключ доступа → выбор должности (один раз) → приложение.
root.dataset.started = '1';
createRoot(root).render(
  <StrictMode>
    <AccessGate>
      <AppDataProvider>
        {(loadState) => {
          if (loadState.status === 'loading') return <div className="splash-blank" aria-busy="true" />;
          if (loadState.status === 'error') {
            return (
              <main className="page page--plain">
                <p className="h1 h1--sm">Не удалось загрузить данные</p>
                <p className="muted">{loadState.message} Проверьте интернет и откройте приложение ещё раз.</p>
                <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                  Попробовать снова
                </button>
              </main>
            );
          }
          return (
            <ToastProvider>
              <RoleGate>
                <App />
              </RoleGate>
            </ToastProvider>
          );
        }}
      </AppDataProvider>
    </AccessGate>
    <Splash />
  </StrictMode>,
);
