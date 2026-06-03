import React from "react";

interface HeaderTabletIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Header tablet icon (width: 28px, height: 28px)
 * Simple tablet glyph to sit between desktop and mobile icons.
 */
export const HeaderTabletIcon: React.FC<HeaderTabletIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
    >
      <rect
        x="9.35"
        y="7.35"
        width="10.3"
        height="13.3"
        rx="0.65"
        stroke="#999999"
        strokeWidth="0.7"
      />
      <rect x="20" y="9" width="0.2" height="2" rx="0.1" fill="#999999" />
    </svg>
  );
};
