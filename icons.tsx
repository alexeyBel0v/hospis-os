import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const Icon = ({ children, ...props }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const TodayIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="m9 15 2 2 4-4" />
  </Icon>
);

export const PeopleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.6 3.1 2.4 3.5 5.2" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.6 3.5h2.6l1.4 4.1-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4.1 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  </Icon>
);

export const CalendarMoveIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15h6m-2-2 2 2-2 2" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m14.5 5.5-6 6.5 6 6.5" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.2a1.9 1.9 0 0 0 1.9 1.8h5.4a1.9 1.9 0 0 0 1.9-1.8L17.5 7" />
  </Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01" strokeWidth="2.6" />
  </Icon>
);

export const RouteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 5.5 6 6.5-6 6.5" />
  </Icon>
);

export const RotateIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4.5h-4.5" />
  </Icon>
);

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M6 12H5a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 19 12h-1" />
  </Icon>
);

export const ImportIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Icon>
);

export const PersonIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="5" r="2.5" />
    <path d="M12 8v7M8 11h8M12 15l-3 6M12 15l3 6" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 8v5M12 17h.01" />
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7.5h8M8 11h6" />
  </Icon>
);

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const HospitalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H10V3.5A1.5 1.5 0 0 1 11.5 2h1A1.5 1.5 0 0 1 14 3.5V5h4.5A1.5 1.5 0 0 1 20 6.5V21" />
    <path d="M2.5 21h19M12 8.5v5M9.5 11h5M10 21v-3.5h4V21" />
  </Icon>
);

export const NavigatorIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 11.2 20 4l-7.2 16.5-1.9-7.4z" />
  </Icon>
);
