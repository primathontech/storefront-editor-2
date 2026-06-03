import React from "react";

interface ChevronDownIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const ChevronDownIcon: React.FC<ChevronDownIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: "16px", height: "16px", aspectRatio: "1/1", ...style }}
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
};
