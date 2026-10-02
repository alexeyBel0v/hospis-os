import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackButton } from '../hooks/useBackButton.ts';
import { CloseIcon } from './icons.tsx';

type Props = { title: string; subtitle?: string; onClose: () => void; children: ReactNode };

/** Шторка снизу экрана. Закрывается кнопкой «Назад» Telegram, крестиком, Esc или тапом по фону. */
export const Sheet = ({ title, subtitle, onClose, children }: Props) => {
  useBackButton(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-layer">
      <button type="button" className="sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__header">
          <div>
            <h2 className="sheet__title">{title}</h2>
            {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn icon-btn--round" onClick={onClose} aria-label="Закрыть">
            <CloseIcon width={20} height={20} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
};
