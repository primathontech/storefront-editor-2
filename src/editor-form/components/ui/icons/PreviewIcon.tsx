import React from "react";

interface PreviewIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Preview icon component
 */
export const PreviewIcon: React.FC<PreviewIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={{ width: "20px", height: "20px", aspectRatio: "1/1", ...style }}
      {...props}
    >
      <g clipPath="url(#clip0_2317_6794)">
        <path
          d="M15.2501 9.06738C15.5832 9.25986 15.5832 9.74013 15.2501 9.93262L4.00012 16.4277C3.66679 16.6202 3.25012 16.38 3.25012 15.9951L3.25012 3.00488C3.25012 2.64404 3.61621 2.41028 3.93665 2.54101L4.00012 2.57226L15.2501 9.06738Z"
          fill="white"
          stroke="#333333"
        />
      </g>
      <defs>
        <clipPath id="clip0_2317_6794">
          <rect width="20" height="20" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
