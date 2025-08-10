interface UserIconProps {
  color?: string;
}

export const UserIcon = ({ color = "#989898" }: UserIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18.3639 5.64605C21.8787 9.16077 21.8787 14.8593 18.3639 18.374C14.8492 21.8887 9.15074 21.8887 5.63604 18.374C2.12132 14.8592 2.12132 9.16075 5.63604 5.64605C9.15076 2.13133 14.8492 2.13133 18.3639 5.64605"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.9891 8.33391C15.0876 9.43245 15.0876 11.2136 13.9891 12.3121C12.8906 13.4106 11.1095 13.4106 10.0109 12.3121C8.91238 11.2136 8.91238 9.43245 10.0109 8.33391C11.1095 7.23537 12.8906 7.23537 13.9891 8.33391"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.707 18.968C16.272 17.457 14.248 16.51 12 16.51C9.75197 16.51 7.72797 17.457 6.29297 18.969"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
