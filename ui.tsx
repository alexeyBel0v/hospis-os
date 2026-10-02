import type { ReactNode } from 'react';
import { cn } from '../utils/cn.ts';

type SegOption<T extends string> = { value: T; label: ReactNode; tone?: 'cath' | 'late' };

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: Array<SegOption<T>>;
  onChange: (value: T) => void;
};

/** Сегментированный переключатель: «Спереди | Сзади», «По алфавиту | По дате». */
export const Segmented = <T extends string>({ label, value, options, onChange }: SegmentedProps<T>) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={cn('seg__btn', option.tone && `seg__btn--${option.tone}`, option.value === value && 'seg__btn--on')}
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

type ToggleProps = { checked: boolean; onChange: (checked: boolean) => void; label: string };

export const Toggle = ({ checked, onChange, label }: ToggleProps) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />
);

type FieldProps = { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode };

export const Field = ({ label, htmlFor, hint, error, optional, children }: FieldProps) => (
  <div className="field">
    <label className="field__label" htmlFor={htmlFor}>
      {label}
      {optional && <span className="field__opt">необязательно</span>}
    </label>
    {children}
    {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
  </div>
);

export const SectionTitle = ({ children, count, late }: { children: ReactNode; count?: number; late?: boolean }) => (
  <h2 className={cn('section-title', late && 'section-title--late')}>
    {children}
    {count !== undefined && <span className="count">{count}</span>}
  </h2>
);
