interface UserPlusIconProps {
  color?: string;
}

export const UserPlusIcon = ({ color = "#FFFFFF" }: UserPlusIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.5 7.5C14.5 9.433 12.933 11 11 11C9.067 11 7.5 9.433 7.5 7.5C7.5 5.567 9.067 4 11 4C12.933 4 14.5 5.567 14.5 7.5Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.75 19.25C5.707 16.861 8.136 15.25 11 15.25C13.864 15.25 16.293 16.861 17.25 19.25"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18 7V11" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <path d="M16 9H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);
