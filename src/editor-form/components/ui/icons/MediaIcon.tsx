import React from "react";

interface MediaIconProps extends React.SVGProps<SVGSVGElement> {}

export const MediaIcon: React.FC<MediaIconProps> = ({
  width = 16,
  height = 16,
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M13.333 2H2.667A.667.667 0 002 2.667v10.666c0 .368.299.667.667.667h10.666a.667.667 0 00.667-.667V2.667A.667.667 0 0013.333 2zM5.333 4.667a1 1 0 110 2 1 1 0 010-2zM12 12H4l2.667-4 1.666 2.333L10 8l2 4z"
      fill="currentColor"
    />
  </svg>
);
