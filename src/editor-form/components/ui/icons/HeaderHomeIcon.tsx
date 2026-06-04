import React from "react";

interface HeaderHomeIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Header home/back icon shown to the left of the theme name.
 * Uses the provided SVG, keeping the brand color fill.
 */
export const HeaderHomeIcon: React.FC<HeaderHomeIconProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ width: "24px", height: "24px", aspectRatio: "1/1", ...style }}
      {...props}
    >
      <rect width="24" height="24" rx="4" fill="white" />
      <path
        d="M12.0233 17.7907H17.2558C17.5768 17.7907 17.8372 17.5302 17.8372 17.2093V6.7442C17.8372 6.42327 17.5767 6.16282 17.2558 6.16282H12.0233C11.7017 6.16282 11.4419 5.90295 11.4419 5.58144C11.4419 5.25993 11.7017 5 12.0233 5H17.2558C18.2175 5 19 5.78258 19 6.7442V17.2093C19 18.1709 18.2175 18.9535 17.2558 18.9535H12.0233C11.7017 18.9535 11.4419 18.6936 11.4419 18.3721C11.4419 18.0506 11.7017 17.7907 12.0233 17.7907Z"
        fill="#1D4A88"
      />
      <path
        d="M5.17325 11.5629L8.70814 8.07448C8.93605 7.8489 9.30464 7.85182 9.53023 8.08031C9.75582 8.30879 9.75349 8.67681 9.52441 8.9024L6.99825 11.3954H13.7674C14.089 11.3954 14.3488 11.6553 14.3488 11.9768C14.3488 12.2983 14.089 12.5582 13.7674 12.5582H6.99825L9.52441 15.0512C9.75346 15.2768 9.75521 15.6448 9.53023 15.8733C9.41629 15.9884 9.26628 16.0466 9.11627 16.0466C8.96859 16.0466 8.82093 15.9907 8.70814 15.8791L5.17325 12.3907C5.06278 12.2814 5 12.1326 5 11.9768C5 11.821 5.06221 11.6728 5.17325 11.5629Z"
        fill="#1D4A88"
      />
    </svg>
  );
};
