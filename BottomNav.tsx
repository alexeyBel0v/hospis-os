import { cn } from '../utils/cn.ts';
import { BookIcon, CalendarIcon, PeopleIcon, SettingsIcon, TodayIcon } from './icons.tsx';

export type Tab = 'today' | 'patients' | 'calendar' | 'info' | 'settings';

type Props = { active: Tab; onChange: (tab: Tab) => void; overdueCount: number };

const TABS = [
  { id: 'today', label: 'Сегодня', Icon: TodayIcon },
  { id: 'patients', label: 'Пациенты', Icon: PeopleIcon },
  { id: 'calendar', label: 'Календарь', Icon: CalendarIcon },
  { id: 'info', label: 'Справка', Icon: BookIcon },
  { id: 'settings', label: 'Настройки', Icon: SettingsIcon },
] as const satisfies ReadonlyArray<{ id: Tab; label: string; Icon: typeof TodayIcon }>;

export const BottomNav = ({ active, onChange, overdueCount }: Props) => (
  <nav className="bottom-nav" aria-label="Разделы">
    {TABS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        className={cn('bottom-nav__item', active === id && 'bottom-nav__item--active')}
        aria-current={active === id ? 'page' : undefined}
        onClick={() => onChange(id)}
      >
        <span className="bottom-nav__icon">
          <Icon />
          {id === 'today' && overdueCount > 0 && (
            <span className="bottom-nav__badge" aria-label={`просрочено: ${overdueCount}`}>
              {overdueCount}
            </span>
          )}
        </span>
        {label}
      </button>
    ))}
  </nav>
);
