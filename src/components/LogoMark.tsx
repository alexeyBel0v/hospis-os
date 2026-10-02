import { useId } from 'react';

type Props = { size?: number; animated?: boolean };

/** Знак Hospis OS: бирюзовый квадрат с линией пульса. */
export const LogoMark = ({ size = 48, animated = false }: Props) => {
  const gradientId = useId();
  return (
    <svg
      className={animated ? 'logo-mark logo-mark--animated' : 'logo-mark'}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f9bb0" />
          <stop offset="1" stopColor="#0f5f73" />
        </linearGradient>
      </defs>
      <rect className="logo-mark__tile" width="64" height="64" rx="18" fill={`url(#${gradientId})`} />
      <path
        className="logo-mark__pulse"
        d="M9 33h11l5-11 7 20 5-13h18"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
};
