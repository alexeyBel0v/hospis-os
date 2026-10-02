import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastAction = { label: string; onAction: () => void };
type Toast = { id: number; message: string; action?: ToastAction };

type ToastContextValue = { showToast: (message: string, action?: ToastAction) => void };

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const TOAST_DURATION_MS = 5000;

export const useToast = (): ToastContextValue => useContext(ToastContext);

/** Короткое сообщение снизу с кнопкой «Отменить». */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const counterRef = useRef(0);

  const hide = useCallback(() => setToast(null), []);

  const showToast = useCallback(
    (message: string, action?: ToastAction) => {
      window.clearTimeout(timerRef.current);
      counterRef.current += 1;
      setToast({ id: counterRef.current, message, action });
      timerRef.current = window.setTimeout(hide, TOAST_DURATION_MS);
    },
    [hide],
  );

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.onAction();
                  hide();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
};
