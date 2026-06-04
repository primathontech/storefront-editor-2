import React from "react";

interface VisibilityIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Eye / visibility icon used for show/hide section actions.
 */
export const VisibilityIcon: React.FC<VisibilityIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="12"
      viewBox="0 0 12 8"
      fill="none"
      className={className}
      style={{ width: "16px", height: "12px", ...style }}
      {...props}
    >
      <path
        d="M6 7.2C9.92559 7.2 11.8718 3.91464 11.9527 3.77487C12.0157 3.66606 12.0157 3.53385 11.9527 3.42504C11.8718 3.28536 9.92559 0 6 0C2.07441 0 0.128156 3.28536 0.0472498 3.42513C-0.0157499 3.53394 -0.0157499 3.66615 0.0472498 3.77496C0.128156 3.91464 2.07441 7.2 6 7.2ZM11.1837 3.59946C10.7377 4.24845 8.98631 6.48 6 6.48C3.00422 6.48 1.26066 4.25025 0.816281 3.60054C1.26234 2.95155 3.01369 0.72 6 0.72C8.99578 0.72 10.7393 2.94975 11.1837 3.59946ZM6 5.76C7.24069 5.76 8.25 4.79106 8.25 3.6C8.25 2.40894 7.24069 1.44 6 1.44C4.75931 1.44 3.75 2.40894 3.75 3.6C3.75 4.79106 4.75931 5.76 6 5.76ZM6 2.16C6.82706 2.16 7.5 2.80602 7.5 3.6C7.5 4.39398 6.82706 5.04 6 5.04C5.17294 5.04 4.5 4.39398 4.5 3.6C4.5 2.80602 5.17294 2.16 6 2.16Z"
        fill="#666666"
      />
    </svg>
  );
};

/**
 * Eye with slash icon used for "hidden" state.
 */
export const VisibilityOffIcon: React.FC<VisibilityIconProps> = ({
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
      {/* Eye outline */}
      <path
        d="M1.333 8C2.24 5.667 4.427 4 8 4c3.573 0 5.76 1.667 6.667 4-0.907 2.333-3.094 4-6.667 4-3.573 0-5.76-1.667-6.667-4Z"
        stroke="#666666"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pupil */}
      <path
        d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke="#666666"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Slash */}
      <path
        d="M3 13L13 3"
        stroke="#666666"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  );
};
