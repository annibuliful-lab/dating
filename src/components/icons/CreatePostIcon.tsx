type CreatePostIconProps = {
  color?: string;
};

export const CreatePostIcon = ({
  color = '#989898',
}: CreatePostIconProps) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.66663 1.01001C14.6376 1.01001 18.6666 5.03901 18.6666 10.01C18.6666 14.981 14.6376 19.01 9.66663 19.01"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.59167 18.459C5.59567 18.096 4.67967 17.57 3.88367 16.902"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.88367 3.11804C4.67967 2.44904 5.59567 1.92304 6.59167 1.56104"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M0.810669 8.44806C0.995669 7.39506 1.36167 6.40606 1.87767 5.51306"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M0.810669 11.571C0.995669 12.624 1.36167 13.613 1.87767 14.506"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.66663 7.68005V12.3401"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.9967 10.01H7.33667"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
