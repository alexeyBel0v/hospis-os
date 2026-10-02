import { useEffect, useState } from 'react';
import { APP_NAME } from '../config.ts';
import { LogoMark } from './LogoMark.tsx';

const SPLASH_MS = 1900;
const SPLASH_REDUCED_MS = 500;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Заставка при запуске: значок «бьётся» как сердце, по нему бежит линия пульса,
 * снизу заполняется полоса загрузки, затем экран растворяется. Тап — пропустить.
 */
export const Splash = () => {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');

  useEffect(() => {
    const duration = prefersReducedMotion() ? SPLASH_REDUCED_MS : SPLASH_MS;
    const leave = window.setTimeout(() => setPhase('leave'), duration);
    const gone = window.setTimeout(() => setPhase('gone'), duration + 380);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`splash${phase === 'leave' ? ' splash--leave' : ''}`} onClick={() => setPhase('leave')} aria-hidden="true">
      <div className="splash__content">
        <div className="splash__logo">
          <span className="splash__ring" />
          <span className="splash__ring splash__ring--late" />
          <LogoMark size={96} animated />
        </div>
        <p className="splash__word">
          {[...APP_NAME].map((char, index) => (
            <span key={index} style={{ animationDelay: `${260 + index * 45}ms` }}>
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </p>
        <div className="splash__bar">
          <div className="splash__bar-fill" />
        </div>
        <p className="splash__hint">Загрузка…</p>
      </div>
    </div>
  );
};
