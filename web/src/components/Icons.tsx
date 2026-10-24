// Simple line icons drawn in the current text colour, so they follow the rail, rows and viewer.
type IconProps = { size?: number };

function Svg(props: IconProps & { children: any }) {
  return (
    <svg
      class="icon"
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export const FolderIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const ImageIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-8 9" />
  </Svg>
);

export const BackIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const UpIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const ChevronIcon = (props: IconProps & { open: boolean }) => (
  <Svg size={props.size ?? 14}>
    <path d={props.open ? "m6 9 6 6 6-6" : "m9 6 6 6-6 6"} />
  </Svg>
);

export const PrevIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

export const NextIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const FilterIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
  </Svg>
);

export const SortIcon = (props: IconProps) => (
  <Svg size={props.size}>
    <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg size={props.size ?? 14}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);
