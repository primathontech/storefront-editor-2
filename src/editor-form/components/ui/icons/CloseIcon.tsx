import React from "react";

interface CloseIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * X/close icon used for remove/delete actions.
 * Two diagonal lines forming an X shape.
 */
export const CloseIcon: React.FC<CloseIconProps> = ({
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
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
};
