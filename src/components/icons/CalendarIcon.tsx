interface CalendarIconProps {
  color?: string;
}
export const CalendarIcon = ({ color = "#939393" }: CalendarIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16 2V6"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 2L8 6"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 9L21 9"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19 4L5 4C3.895 4 3 4.895 3 6L3 19C3 20.105 3.895 21 5 21L19 21C20.105 21 21 20.105 21 19L21 6C21 4.895 20.105 4 19 4Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.0132 12.729C11.8752 12.729 11.7632 12.841 11.7642 12.979C11.7642 13.117 11.8762 13.229 12.0142 13.229C12.1522 13.229 12.2642 13.117 12.2642 12.979C12.2642 12.841 12.1522 12.729 12.0132 12.729"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.0132 12.729C16.8752 12.729 16.7632 12.841 16.7642 12.979C16.7642 13.117 16.8762 13.229 17.0142 13.229C17.1522 13.229 17.2642 13.117 17.2642 12.979C17.2642 12.841 17.1522 12.729 17.0132 12.729"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.01316 16.729C6.87516 16.729 6.76316 16.841 6.76416 16.979C6.76416 17.117 6.87616 17.229 7.01416 17.229C7.15216 17.229 7.26416 17.117 7.26416 16.979C7.26416 16.841 7.15216 16.729 7.01316 16.729"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.0132 16.729C11.8752 16.729 11.7632 16.841 11.7642 16.979C11.7642 17.117 11.8762 17.229 12.0142 17.229C12.1522 17.229 12.2642 17.117 12.2642 16.979C12.2642 16.841 12.1522 16.729 12.0132 16.729"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
