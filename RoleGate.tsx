import { useState, type ReactNode } from 'react';
import type { Role } from '../types/index.ts';
import { useAppData } from '../hooks/useAppData.tsx';
import { updateSettings } from '../lib/patients.ts';
import { getTelegramUser, hapticSuccess } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { CheckIcon } from './icons.tsx';

export const ROLE_LABELS: Record<Exclude<Role, ''>, string> = {
  nurse: 'Медсестра / медбрат',
  doctor: 'Врач',
  other: 'Другой сотрудник',
};

const ROLE_HINTS: Record<Exclude<Role, ''>, string> = {
  nurse: 'Выезды, перевязки, катетеры',
  doctor: 'Осмотры и назначения',
  other: 'Администратор, координатор и др.',
};

const ROLE_ICONS: Record<Exclude<Role, ''>, string> = { nurse: 'М', doctor: 'В', other: 'С' };

const ROLES: Array<Exclude<Role, ''>> = ['nurse', 'doctor', 'other'];

/** При первом входе — выбор должности. Потом её можно поменять в настройках. */
export const RoleGate = ({ children }: { children: ReactNode }) => {
  const { data, update } = useAppData();
  const [picked, setPicked] = useState<Exclude<Role, ''>>('nurse');
  const name = getTelegramUser()?.first_name;

  if (data.settings.role) return <>{children}</>;

  const confirm = () => {
    hapticSuccess();
    update((current) => updateSettings(current, { role: picked }));
  };

  return (
    <main className="login login--roles">
      <h1 className="login__title">{name ? `${name}, кто вы?` : 'Кто вы?'}</h1>
      <p className="login__text">Выберите должность. Её можно поменять в настройках.</p>
      <div className="role-list" role="radiogroup" aria-label="Должность">
        {ROLES.map((role, index) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={picked === role}
            className={cn('role-card', picked === role && 'role-card--on')}
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={() => setPicked(role)}
          >
            <span className="role-card__icon">{ROLE_ICONS[role]}</span>
            <span className="role-card__text">
              <span className="role-card__title">{ROLE_LABELS[role]}</span>
              <span className="role-card__hint">{ROLE_HINTS[role]}</span>
            </span>
            <span className="role-card__check">
              <CheckIcon width={18} height={18} strokeWidth={2.8} />
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={confirm}>
        Продолжить
      </button>
    </main>
  );
};
