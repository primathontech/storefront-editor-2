import * as React from "react";

export interface DragDotsIconProps extends React.SVGProps<SVGSVGElement> {}

export const DragDotsIcon: React.FC<DragDotsIconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={8}
    height={13}
    viewBox="0 0 8 13"
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <circle cx="1.5" cy="1.5" r="1.5" fill="#999999" />
    <circle cx="6.5" cy="1.5" r="1.5" fill="#999999" />
    <circle cx="1.5" cy="6.5" r="1.5" fill="#999999" />
    <circle cx="6.5" cy="6.5" r="1.5" fill="#999999" />
    <circle cx="1.5" cy="11.5" r="1.5" fill="#999999" />
    <circle cx="6.5" cy="11.5" r="1.5" fill="#999999" />
  </svg>
);
