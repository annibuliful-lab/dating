interface SendIconProps {
  color?: string;
}

export const SendIcon = ({ color = "#FFD700" }: SendIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.75401 12.149L10.525 20.118C10.746 21.111 12.065 21.325 12.588 20.453L20.837 6.704C21.288 5.954 20.748 5 19.873 5H4.32201C3.31901 5 2.81701 6.212 3.52601 6.921L8.75401 12.149Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20.84 5.56006L8.75 12.1501"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
