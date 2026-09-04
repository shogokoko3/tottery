/**
 * 画面で使う SVG アイコン。外部ライブラリは入れず、必要な形だけを手で持っている。
 * すべて 24x24 のビューボックスに currentColor のストロークで描く。
 */

export function IconBase({ size = 24, className, style, children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export const Crown = (props) => (
  <IconBase {...props}>
    <path d="M3 7l4 4 5-7 5 7 4-4v11H3z" />
  </IconBase>
);

export const Info = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </IconBase>
);

export const Close = (props) => (
  <IconBase {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </IconBase>
);

export const Check = (props) => (
  <IconBase {...props}>
    <path d="M4 12l5 5L20 6" />
  </IconBase>
);

export const ArrowRight = (props) => (
  <IconBase {...props}>
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </IconBase>
);

export const Dice = (props) => (
  <IconBase {...props}>
    <rect x="3" y="9" width="12" height="12" rx="2" />
    <path d="M7.5 13.5h.01" />
    <path d="M10.5 16.5h.01" />
    <path d="M9 3h10a2 2 0 0 1 2 2v10" />
    <path d="M16.5 7.5h.01" />
  </IconBase>
);

export const Users = (props) => (
  <IconBase {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6" />
    <path d="M18 14.5a6 6 0 0 1 3.5 5.5" />
  </IconBase>
);

export const Sparkle = (props) => (
  <IconBase {...props}>
    <path d="M11 3l1.8 4.2L17 9l-4.2 1.8L11 15l-1.8-4.2L5 9l4.2-1.8z" />
    <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z" />
  </IconBase>
);

export const Shuffle = (props) => (
  <IconBase {...props}>
    <path d="M3 6h3.5l4 6 3.5 6H18" />
    <path d="M3 18h3.5l3-4.5" />
    <path d="M14.5 7.5L18 6" />
    <path d="M15.5 3.5L19 6l-3.5 2.5" />
    <path d="M15.5 15.5L19 18l-3.5 2.5" />
  </IconBase>
);

export const RotateCcw = (props) => (
  <IconBase {...props}>
    <path d="M3 5v5h5" />
    <path d="M3.5 10a8.5 8.5 0 1 1 1.2 6.5" />
  </IconBase>
);

export const ArrowLeft = (props) => (
  <IconBase {...props}>
    <path d="M20 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </IconBase>
);

export const Settings = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5l1.4 2.6 2.9-.5.6 2.9 2.6 1.4-1.5 2.5 1.5 2.5-2.6 1.4-.6 2.9-2.9-.5L12 21.5l-1.4-2.6-2.9.5-.6-2.9-2.6-1.4L6 12.5 4.5 10l2.6-1.4.6-2.9 2.9.5z" />
  </IconBase>
);

export const Globe = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
  </IconBase>
);

export const DoorOut = (props) => (
  <IconBase {...props}>
    <path d="M13 3.5L5 5.5v14l8 2z" />
    <path d="M13 3.5h5v17h-5" />
    <path d="M10.5 12h.01" />
  </IconBase>
);

export const DoorIn = (props) => (
  <IconBase {...props}>
    <path d="M14 3h5v18h-5" />
    <path d="M4 12h10" />
    <path d="M10 7l5 5-5 5" />
  </IconBase>
);

export const Grid = (props) => (
  <IconBase {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </IconBase>
);

export const Play = (props) => (
  <IconBase {...props}>
    <path d="M7 4.5l12 7.5-12 7.5z" />
  </IconBase>
);

export const Flag = (props) => (
  <IconBase {...props}>
    <path d="M5 21V4" />
    <path d="M5 4.5h13l-2.5 4 2.5 4H5" />
  </IconBase>
);

export const Lock = (props) => (
  <IconBase {...props}>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </IconBase>
);

export const Book = (props) => (
  <IconBase {...props}>
    <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
    <path d="M8 3v18" />
  </IconBase>
);

/** 運営からの手紙。封筒 */
export const Mail = (props) => (
  <IconBase {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </IconBase>
);

/** チケット。切り取り線の入った札 */
export const Ticket = (props) => (
  <IconBase {...props}>
    <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2.5 2.5 0 0 0 0 5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2.5 2.5 0 0 0 0-5z" />
    <path d="M14 7.5v9" />
  </IconBase>
);

export const Hand = (props) => (
  <IconBase {...props}>
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v6" />
    <path d="M12 11V4a1.5 1.5 0 0 1 3 0v7" />
    <path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.2-3.4a1.5 1.5 0 0 1 2.4-1.8L9 14" />
  </IconBase>
);
