import type { SVGProps } from "react";

const paths: Record<string, React.ReactNode> = {
  play: <path d="M4 2.8 12 8l-8 5.2z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M5 3v10M11 3v10" />
    </>
  ),
  fit: (
    <>
      <path d="M2.5 5V2.5H5M11 2.5h2.5V5M13.5 11v2.5H11M5 13.5H2.5V11" />
      <rect x="5.5" y="5.5" width="5" height="5" />
    </>
  ),
  orbit: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M2.2 8c0-2.1 2.6-3.8 5.8-3.8s5.8 1.7 5.8 3.8-2.6 3.8-5.8 3.8S2.2 10.1 2.2 8Z" />
      <path d="M5.4 4.7C4 5.3 3.1 6.2 3.1 7.2" />
    </>
  ),
  cube: (
    <>
      <path d="m8 1.9 5.2 3v6.2L8 14.1l-5.2-3V4.9z" />
      <path d="M2.8 4.9 8 8l5.2-3.1M8 8v6.1" />
    </>
  ),
  plate: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M4.5 12V6h3v6M9 12V8h2.5v4" />
    </>
  ),
  download: (
    <>
      <path d="M8 2v8M5 7.2 8 10.2l3-3M2.8 13.2h10.4" />
    </>
  ),
  share: (
    <>
      <circle cx="4" cy="8" r="1.8" />
      <circle cx="12" cy="4" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="m5.7 7.2 4.6-2.4M5.7 8.8l4.6 2.4" />
    </>
  ),
  undo: <path d="M5.5 4 2.8 6.7l2.7 2.7M3 6.7h6.2a4 4 0 0 1 0 8H7" />,
  redo: <path d="m10.5 4 2.7 2.7-2.7 2.7M13 6.7H6.8a4 4 0 0 0 0 8H9" />,
  folder: <path d="M2 4.5h4l1.4 2H14v6.8H2zM2 4.5V3h4.2" />,
  image: (
    <>
      <rect x="2" y="2.5" width="12" height="11" />
      <circle cx="5.6" cy="6" r="1.2" />
      <path d="m2.5 11.5 3.4-3.2 2.5 2.1 1.8-1.5 3.3 2.8" />
    </>
  ),
  printer: (
    <>
      <path d="M4 6V2.8h8V6M2.5 6h11v5.5h-11zM4.5 8.5h7v5h-7zM6 11h4" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 8s2.3-3.8 6.2-3.8S14.2 8 14.2 8s-2.3 3.8-6.2 3.8S1.8 8 1.8 8Z" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M2.2 2.2 13.8 13.8M6.2 4.5A6.8 6.8 0 0 1 8 4.2c3.9 0 6.2 3.8 6.2 3.8a11 11 0 0 1-2.2 2.6M4.2 5.3C2.6 6.5 1.8 8 1.8 8s2.3 3.8 6.2 3.8c.7 0 1.4-.1 2-.3" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2 15 14H1z" />
      <path d="M8 6v4M8 12.1v.1" />
    </>
  ),
  check: <path d="m3 8 3.2 3.2L13 4.8" />,
  close: <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />,
  spark: (
    <>
      <path d="M8 1.8c.4 3 1.4 4.4 4.6 6.2-3.2 1.8-4.2 3.2-4.6 6.2-.4-3-1.4-4.4-4.6-6.2C6.6 6.2 7.6 4.8 8 1.8Z" />
    </>
  ),
  arrow: <path d="M2.5 8h10M8.7 3.8 12.9 8l-4.2 4.2" />,
  plus: <path d="M8 2.5v11M2.5 8h11" />,
  minus: <path d="M2.5 8h11" />,
  refresh: (
    <>
      <path d="M13 4.5v3.2H9.8M3 11.5V8.3h3.2" />
      <path d="M4.1 6.2A5 5 0 0 1 13 4.5M12 9.8a5 5 0 0 1-8.9 1.7" />
    </>
  ),
  explode: (
    <>
      <path d="M8 1.8 13 4.7v6L8 13.6 3 10.7v-6z" />
      <path d="M3 4.7 8 7.6l5-2.9M8 7.6v6.2M5.5 14.8v-2M10.5 14.8v-2" />
    </>
  ),
  layers: (
    <>
      <path d="m8 1.8 6 3.3-6 3.3-6-3.3z" />
      <path d="m2 8.2 6 3.3 6-3.3M2 11.2l6 3.3 6-3.3" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v4M8 4.8v.2" />
    </>
  ),
  github: (
    <path
      d="M8 .8a7.2 7.2 0 0 0-2.3 14c.4.1.5-.2.5-.4v-1.4c-2 .4-2.4-1-2.4-1-.3-.8-.8-1-.8-1-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.8.9 2.2.7 0-.5.3-.9.5-1-1.6-.2-3.3-.8-3.3-3.6 0-.8.3-1.4.8-1.9-.1-.2-.3-.9.1-1.8 0 0 .6-.2 2 .7a6.8 6.8 0 0 1 3.5 0c1.3-.9 1.9-.7 1.9-.7.4.9.2 1.6.1 1.8.5.5.8 1.1.8 1.9 0 2.8-1.7 3.3-3.3 3.6.3.2.5.7.5 1.4V14c0 .2.1.5.5.4A7.2 7.2 0 0 0 8 .8Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" />
      <path d="M10.5 5.5V2.5h-8v8h3" />
    </>
  ),
  cursor: <path d="m3 2 4.8 11 1.5-4.5L13.8 7z" />,
  sliders: (
    <>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
      <circle cx="5.5" cy="4.5" r="1.4" fill="var(--panel, #fff)" />
      <circle cx="10.5" cy="8" r="1.4" fill="var(--panel, #fff)" />
      <circle cx="7" cy="11.5" r="1.4" fill="var(--panel, #fff)" />
    </>
  ),
  code: <path d="m5.5 4.2-3.2 3.8 3.2 3.8M10.5 4.2l3.2 3.8-3.2 3.8M9.3 2.8l-2.6 10.4" />,
  grid: (
    <>
      <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
    </>
  ),
  joint: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M1.5 8h3M11.5 8h3" />
    </>
  ),
  move: <path d="M8 1.8v12.4M1.8 8h12.4M8 1.8 6.2 3.9M8 1.8l1.8 2.1M8 14.2l-1.8-2.1M8 14.2l1.8-2.1M1.8 8l2.1-1.8M1.8 8l2.1 1.8M14.2 8l-2.1-1.8M14.2 8l-2.1 1.8" />,
};

export function Icon({
  name,
  size = 15,
  ...props
}: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      {...props}
    >
      {paths[name] ?? paths.cube}
    </svg>
  );
}
