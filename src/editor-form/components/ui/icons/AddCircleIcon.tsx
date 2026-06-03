import React from "react";

interface AddCircleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Small 16x16 circular add icon used in sidebars (plus inside stroked circle).
 * Uses the exact SVG provided in design.
 */
export const AddCircleIcon: React.FC<AddCircleIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ width: "16px", height: "16px", aspectRatio: "1/1", ...style }}
      {...props}
    >
      <circle cx="8" cy="8" r="5.75" stroke="#1D4A88" strokeWidth="0.5" />
      <path
        d="M8.00636 11C7.74308 11 7.52966 10.7866 7.52966 10.5233V8.45205H5.44618C5.19976 8.45205 5 8.25229 5 8.00587C5 7.75945 5.19976 7.55969 5.44618 7.55969H7.52966V5.4767C7.52966 5.21342 7.74308 5 8.00636 5C8.26963 5 8.48305 5.21342 8.48305 5.4767V7.55969H10.5538C10.8002 7.55969 11 7.75945 11 8.00587C11 8.25229 10.8002 8.45205 10.5538 8.45205H8.48305V10.5233C8.48305 10.7866 8.26963 11 8.00636 11Z"
        fill="#1D4A88"
        stroke="white"
        strokeWidth="0.5"
      />
    </svg>
  );
};
