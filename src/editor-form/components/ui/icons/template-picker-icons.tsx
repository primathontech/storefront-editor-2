// 16px line icons for the TemplatePicker. Each inherits `currentColor` so the
// caller controls color via text-*.
//
// Only three page-type icons exist — Home, Collection, Product — plus a single
// generic default (TemplateIcon) for every other type. The rest are structural
// (chevrons / check / plus).

type IconProps = { size?: number };

const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

// ── Page-type icons ─────────────────────────────────────────────
export const HomeIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M2.5 7L8 2.5L13.5 7" />
    <path d="M4 6.5V13H12V6.5" />
  </svg>
);

export const CollectionIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </svg>
);

export const ProductIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M8.5 2H3.5C3 2 2.5 2.5 2.5 3V8L8 13.5L13.5 8L8.5 2.5V2Z" />
    <circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

// ── Default page-type icon (everything that isn't home/collection/product) ──
export const TemplateIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    <path d="M2.5 6H13.5" />
    <path d="M6 6V13.5" />
  </svg>
);

// ── Structural icons ────────────────────────────────────────────
export const PlusIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M8 3V13M3 8H13" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M6 4L10 8L6 12" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M10 4L6 8L10 12" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M4 6L8 10L12 6" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M13 4.5L6.5 11L3 7.5" />
  </svg>
);

// ── Action icons ────────────────────────────────────────────────
// Vertical "more actions" kebab (⋮).
export const KebabIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <circle cx="8" cy="3.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const PencilIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M11 2.5L13.5 5L5.5 13H3V10.5L11 2.5Z" />
    <path d="M9.5 4L12 6.5" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size }) => (
  <svg {...base(size)}>
    <path d="M3 4.5H13" />
    <path d="M6.5 4.5V3.5C6.5 3 6.8 2.5 7.5 2.5H8.5C9.2 2.5 9.5 3 9.5 3.5V4.5" />
    <path d="M4.5 4.5L5 12.5C5 13 5.4 13.5 6 13.5H10C10.6 13.5 11 13 11 12.5L11.5 4.5" />
  </svg>
);
