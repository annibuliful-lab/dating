type HomeIconProps = {
  color?: string;
};
// #FFFFFF
// #989898
export const HomeIcon = ({ color = '#989898' }: HomeIconProps) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.842 6.30902L11.842 1.64202C10.759 0.799016 9.242 0.799016 8.158 1.64202L2.158 6.30902C1.427 6.87702 1 7.75102 1 8.67702V16.01C1 17.667 2.343 19.01 4 19.01H16C17.657 19.01 19 17.667 19 16.01V8.67702C19 7.75102 18.573 6.87702 17.842 6.30902Z"
      stroke={color}
      strokeWidth={1.5}
    />
    <path
      d="M7 15.01H13"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
