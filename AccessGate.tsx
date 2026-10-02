import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ADMIN_TELEGRAM_USERNAME, APP_NAME } from '../config.ts';
import { accessStore, hashAccessKey, isAccessValid } from '../lib/password.ts';
import { getTelegramUser, hapticError, hapticSuccess, openTelegramChat } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { LogoMark } from './LogoMark.tsx';
import { EyeIcon } from './icons.tsx';

type State = 'checking' | 'locked' | 'open';

/** Вход по ключу доступа. Ключ запоминается, пока администратор его не сменит. */
export const AccessGate = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>('checking');
  const [accessKey, setAccessKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [buyHint, setBuyHint] = useState(false);
  const user = getTelegramUser();

  useEffect(() => {
    accessStore.load().then((record) => setState(isAccessValid(record) ? 'open' : 'locked'));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessKey.trim()) return;
    setBusy(true);
    const record = { hash: await hashAccessKey(accessKey) };
    if (!isAccessValid(record)) {
      setBusy(false);
      setError(true);
      setAttempt((value) => value + 1);
      hapticError();
      return;
    }
    await accessStore.save(record);
    hapticSuccess();
    setState('open');
  };

  const buy = () => {
    if (!ADMIN_TELEGRAM_USERNAME) {
      setBuyHint(true);
      return;
    }
    const text = `Здравствуйте! Хочу купить доступ к ${APP_NAME}.${user ? ` Мой ID: ${user.id}` : ''}`;
    openTelegramChat(`https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(text)}`);
  };

  if (state === 'checking') return <div className="splash-blank" />;
  if (state === 'open') return <>{children}</>;

  return (
    <main className="login">
      <LogoMark size={76} />
      <h1 className="login__title">{APP_NAME}</h1>
      <p className="login__text">Учёт выездов к пациентам: кто сегодня, кто просрочен, раны, катетеры.</p>

      <form className="login__form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Ключ доступа</span>
          <span key={attempt} className={cn('login__field', error && attempt > 0 && 'shake')}>
            <input
              className={cn('input', error && 'input--error')}
              type={visible ? 'text' : 'password'}
              value={accessKey}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Введите ключ"
              aria-label="Ключ доступа"
              onChange={(event) => {
                setAccessKey(event.target.value);
                setError(false);
              }}
            />
            <button
              type="button"
              className="icon-btn icon-btn--ghost login__eye"
              aria-label={visible ? 'Скрыть ключ' : 'Показать ключ'}
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              <EyeIcon width={22} height={22} />
            </button>
          </span>
          {error && <span className="field__error">Ключ не подходит. Проверьте раскладку или запросите новый.</span>}
        </label>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy || !accessKey.trim()}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
      </form>

      <div className="login__divider">
        <span>нет ключа?</span>
      </div>
      <button type="button" className="btn btn--outline btn--block btn--lg" onClick={buy}>
        Купить доступ
      </button>
      {buyHint && <p className="notice small">Напишите администратору — он пришлёт ключ после оплаты.</p>}

      <div className="login__foot">
        <span>Ваши пациенты хранятся в вашем Telegram — их видите только вы.</span>
        {user && <span className="num">ID {user.id}</span>}
      </div>
    </main>
  );
};
