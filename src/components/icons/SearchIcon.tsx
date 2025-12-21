type SearchIconProps = {
  color?: string;
  size?: number;
};

export const SearchIcon = ({
  color = "var(--mantine-color-dimmed)",
  size = 18,
}: SearchIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.5} />
    <path
      d="M16 16L20 20"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </svg>
);
